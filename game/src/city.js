// Solmar city: a procedural sun-soaked coastal grid. Streets on a 48 m pitch,
// blocks of warm concrete, towers downtown, palms on the sidewalks, a beach and
// ocean on the east edge, hills to the north. Everything is deterministic from
// the seed, and every solid building registers an AABB for collision.

import * as THREE from 'three';
import { mulberry32, pick, range, rangeInt, clamp } from './rng.js';
import { makeFacadeTexture, makeGroundCanvas, makeWaterCanvas, canvasTexture } from './textures.js';

export const CITY_SEED = 20261117;
export const STREET_PITCH = 48;
export const STREET_HALF = 6;

export function buildCityPlan() {
  const streets = [];
  for (let i = -4; i <= 4; i++) streets.push(i * STREET_PITCH);
  const blocks = [];
  for (let ix = 0; ix < streets.length - 1; ix++) {
    for (let iz = 0; iz < streets.length - 1; iz++) {
      const x0 = streets[ix] + STREET_HALF, x1 = streets[ix + 1] - STREET_HALF;
      const z0 = streets[iz] + STREET_HALF, z1 = streets[iz + 1] - STREET_HALF;
      blocks.push({ x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 });
    }
  }
  return {
    half: 216, beachX0: 216, groundHalf: 264,
    streetsX: streets, streetsZ: streets, streetHalf: STREET_HALF, blocks,
  };
}

// Push a circle (x, z, radius) out of every solid AABB. Returns true if it hit.
export function collideCircle(pos, radius, solids) {
  let hit = false;
  for (const s of solids) {
    const cx = Math.max(s.x0, Math.min(pos.x, s.x1));
    const cz = Math.max(s.z0, Math.min(pos.z, s.z1));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        // centre inside the box: push out along the smallest penetration axis
        const pl = pos.x - s.x0, pr = s.x1 - pos.x, pt = pos.z - s.z0, pb = s.z1 - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = s.x0 - radius;
        else if (m === pr) pos.x = s.x1 + radius;
        else if (m === pt) pos.z = s.z0 - radius;
        else pos.z = s.z1 + radius;
      }
    }
  }
  return hit;
}

function textTexture(text, bg, fg, w = 512, h = 128) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.font = `bold ${Math.floor(h * 0.5)}px Trebuchet MS, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  return c;
}

export function buildCity(scene, rng) {
  const plan = buildCityPlan();
  const solids = [];
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  // --- ground: one painted map for the whole city ---
  const groundTex = canvasTexture(makeGroundCanvas(plan));
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(plan.groundHalf * 2, plan.groundHalf * 2),
    new THREE.MeshLambertMaterial({ map: groundTex }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // --- ocean east of the beach, scrolling water texture ---
  const waterTex = canvasTexture(makeWaterCanvas(), 16, 8);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 1300),
    new THREE.MeshLambertMaterial({ map: waterTex, color: 0x9fc8e8 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(plan.groundHalf + 260, -0.4, 0);
  group.add(ocean);

  // --- building facades: a few shared materials ---
  const facadeColors = ['#d8b48f', '#c9a184', '#b98d6e', '#d9c1a3', '#a8b8c4', '#c4a8b8', '#e0cfa8'];
  const facadeMats = facadeColors.map((col) => {
    const tex = canvasTexture(makeFacadeTexture(rng, col, 0.42), 1, 1);
    return new THREE.MeshLambertMaterial({ map: tex });
  });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x6e6258 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x2a4a66, emissive: 0x112233 });

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function addBuilding(x, z, w, d, h, mat, landmark = null) {
    const m = new THREE.Mesh(boxGeo, mat);
    m.scale.set(w, h, d);
    m.position.set(x, h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    // rooftop box for skyline variety
    if (h > 26 && rng() < 0.6) {
      const top = new THREE.Mesh(boxGeo, roofMat);
      const tw = w * range(rng, 0.3, 0.5), td = d * range(rng, 0.3, 0.5);
      top.scale.set(tw, range(rng, 2, 5), td);
      top.position.set(x + range(rng, -w * 0.15, w * 0.15), h + top.scale.y / 2, z + range(rng, -d * 0.15, d * 0.15));
      top.castShadow = true;
      group.add(top);
    }
    solids.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
    if (landmark) landmark(m, x, z, w, d, h);
    return m;
  }

  // --- blocks: 1-4 buildings each, taller near the centre ---
  for (const b of plan.blocks) {
    const distCentre = Math.abs(b.cx) + Math.abs(b.cz);
    const isPlaza = Math.abs(b.cx) < 1 && Math.abs(b.cz) < 1;
    if (isPlaza) continue; // downtown plaza stays open
    const tall = distCentre < 130;
    const count = tall ? rangeInt(rng, 2, 3) : rangeInt(rng, 1, 2);
    const bw = (b.x1 - b.x0) / (count === 1 ? 1 : 2);
    for (let i = 0; i < count; i++) {
      const w = bw * range(rng, 0.55, 0.8);
      const d = (b.z1 - b.z0) * range(rng, 0.55, 0.8);
      let x = b.x0 + (i % 2) * bw + bw / 2 + range(rng, -2, 2);
      let z = b.cz + range(rng, -4, 4);
      const h = tall ? range(rng, 24, 58) : range(rng, 8, 22);
      // keep every facade at least 1 m inside the block so cars at the kerb
      // (bounding circle 2.3 m) never scrape a wall
      x = clamp(x, b.x0 + w / 2 + 1, b.x1 - w / 2 - 1);
      z = clamp(z, b.z0 + d / 2 + 1, b.z1 - d / 2 - 1);
      addBuilding(x, z, w, d, h, pick(rng, facadeMats));
    }
  }
  // --- landmarks: bank, hospital, police station, safehouse ---
  const signMat = (text, bg, fg) => new THREE.MeshBasicMaterial({ map: canvasTexture(textTexture(text, bg, fg)) });
  function addSign(x, y, z, w, h, text, bg, fg, ry = 0) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMat(text, bg, fg));
    s.position.set(x, y, z); s.rotation.y = ry;
    group.add(s);
  }

  // Solmar Bank — gold tower on the downtown east block
  addBuilding(60, 60, 26, 22, 46, facadeMats[6], (m, x, z, w, d, h) => {
    addSign(x, h - 4, z + d / 2 + 0.2, 24, 5, 'SOLMAR BANK', '#1a1a2e', '#ffd23f');
  });
  // General Hospital — white block north
  addBuilding(-120, -168, 30, 20, 20, new THREE.MeshLambertMaterial({ color: 0xe8e8e2 }), () => {
    addSign(-120, 16, -168 + 10.2, 22, 4, 'HOSPITAL', '#ffffff', '#d23b3b');
  });
  // Solmar PD — blue-grey station west of the plaza
  addBuilding(-60, 96, 24, 20, 16, new THREE.MeshLambertMaterial({ color: 0x5a6d8a }), () => {
    addSign(-60, 13, 96 + 10.2, 20, 4, 'SOLMAR PD', '#22304a', '#9fd4ff');
  });
  // Safehouse — small peach house with a garage, west edge
  addBuilding(-180, 120, 14, 12, 7, new THREE.MeshLambertMaterial({ color: 0xe8a06a }), () => {
    addSign(-180, 6, 120 + 6.2, 12, 2.5, 'SAFEHOUSE', '#7a4a22', '#ffe9c9');
  });

  // --- plaza monument: a golden obelisk at the city heart ---
  const obelisk = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 2.4, 26, 4),
    new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x442200 }),
  );
  obelisk.position.set(0, 13, 0);
  obelisk.rotation.y = Math.PI / 4;
  obelisk.castShadow = true;
  group.add(obelisk);
  solids.push({ x0: -3, x1: 3, z0: -3, z1: 3 });

  // --- palms along the sidewalks ---
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2e8b4a });
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 7, 6);
  const frondGeo = new THREE.ConeGeometry(3.1, 2.0, 8);
  function addPalm(x, z) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.rotation.z = range(rng, -0.08, 0.08);
    trunk.castShadow = true;
    group.add(trunk);
    const fronds = new THREE.Mesh(frondGeo, frondMat);
    fronds.scale.y = 0.55;
    fronds.position.set(x, 7.4, z);
    fronds.castShadow = true;
    group.add(fronds);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), frondMat);
    crown.scale.y = 0.6;
    crown.position.set(x, 7.9, z);
    group.add(crown);
  }
  for (const b of plan.blocks) {
    if (rng() < 0.55) addPalm(b.x0 + 2, b.z0 + 2);
    if (rng() < 0.4) addPalm(b.x1 - 2, b.z1 - 2);
    if (rng() < 0.3) addPalm(b.x0 + 2, b.z1 - 2);
  }
  // beach palms
  for (let z = -180; z <= 180; z += 24) {
    if (rng() < 0.7) addPalm(plan.beachX0 + 6 + rng() * 10, z + range(rng, -6, 6));
  }

  // --- streetlights at intersections ---
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f47 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 6);
  const lampGeo = new THREE.SphereGeometry(0.5, 8, 6);
  for (const x of plan.streetsX) {
    for (const z of plan.streetsZ) {
      if ((x + z) % 96 !== 0) continue;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x + STREET_HALF + 0.6, 3.5, z + STREET_HALF + 0.6);
      group.add(pole);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(x + STREET_HALF + 0.6, 7.1, z + STREET_HALF + 0.6);
      group.add(lamp);
    }
  }

  // --- marina pier + boats on the south-east beach ---
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(60, 0.35, 8), pierMat);
  pier.position.set(292, 0.18, 120);
  pier.castShadow = true; pier.receiveShadow = true;
  group.add(pier);
  const boatMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const boatTrim = new THREE.MeshLambertMaterial({ color: 0xd23b3b });
  for (let i = 0; i < 4; i++) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 3.4), boatMat);
    hull.position.set(276 + i * 14, 0.4, 132 + (i % 2) * 8);
    hull.rotation.y = range(rng, -0.2, 0.2);
    group.add(hull);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.5, 3.5), boatTrim);
    trim.position.copy(hull.position).y = 1.4;
    trim.rotation.y = hull.rotation.y;
    group.add(trim);
  }

  // --- northern hills: wide low cones behind the city ---
  const hillMat = new THREE.MeshLambertMaterial({ color: 0x5a4a6e });
  for (let i = 0; i < 9; i++) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(range(rng, 80, 130), range(rng, 42, 72), 9), hillMat);
    hill.position.set(-320 + i * 80 + range(rng, -20, 20), 0, -320 - range(rng, 0, 60));
    group.add(hill);
  }

  // --- sun disc low on the western horizon + a few clouds ---
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xffdf8a, fog: false }),
  );
  sun.position.set(-420, 70, -260);
  sun.lookAt(0, 40, 0);
  group.add(sun);
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffd9c2, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 8; i++) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(range(rng, 14, 26), 8, 6), cloudMat);
    cloud.scale.y = 0.35;
    cloud.position.set(range(rng, -300, 300), range(rng, 90, 140), range(rng, -320, -120));
    group.add(cloud);
  }

  return { plan, solids, group, ocean, waterTex };
}
