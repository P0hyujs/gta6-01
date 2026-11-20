// Pedestrians of Solmar: they stroll the sidewalks, cross at the corners,
// and scatter when a car or a fist comes too close.

import * as THREE from 'three';
import { pick, range, rangeInt, clamp, angleLerp, distance2D } from './rng.js';
import { collideCircle, STREET_PITCH } from './city.js';

const SHIRTS = [0xd23b3b, 0x2e7fb8, 0xffd23f, 0x7dff9a, 0xe8e8e2, 0xff7a59, 0x9a6bd2, 0x37b6ff, 0xff9ad2, 0x8a5a2e];
const SKINS = [0xd9a066, 0x8a5a3a, 0xe8b88a, 0x5a3a22, 0xc98a5a];

function createPedMesh(shirtColor, skinColor) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3550 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3), shirt);
  torso.position.y = 0.98;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), skin);
  head.position.y = 1.48;
  group.add(head);
  const legGeo = new THREE.BoxGeometry(0.19, 0.66, 0.2);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.geometry.translate(0, -0.33, 0);
  legL.position.set(-0.13, 0.66, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.13;
  group.add(legR);
  const armGeo = new THREE.BoxGeometry(0.14, 0.55, 0.16);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.geometry.translate(0, -0.27, 0);
  armL.position.set(-0.34, 1.24, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.34;
  group.add(armR);
  return { group, legL, legR, armL, armR };
}

export function spawnPeds(scene, rng, count = 26) {
  const peds = [];
  const streets = [];
  for (let i = -4; i <= 4; i++) streets.push(i * STREET_PITCH);
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const line = pick(rng, streets);
    const along = range(rng, -180, 180);
    const side = rng() < 0.5 ? -1 : 1;
    const x = vertical ? line + side * 8.2 : along;
    const z = vertical ? along : line + side * 8.2;
    const parts = createPedMesh(pick(rng, SHIRTS), pick(rng, SKINS));
    parts.group.position.set(x, 0, z);
    scene.add(parts.group);
    peds.push({
      parts, x, z, heading: range(rng, 0, Math.PI * 2),
      speed: range(rng, 1.1, 1.9), walkPhase: rng() * 6,
      vertical, line, side, dir: rng() < 0.5 ? 1 : -1,
      down: false, downTimer: 0, flee: false, fleeTimer: 0,
    });
  }
  return peds;
}

export function updatePeds(peds, dt, solids, threat) {
  for (const ped of peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      ped.parts.group.rotation.x = -Math.PI / 2 * clamp(1 - ped.downTimer / 2.2, 0, 1);
      if (ped.downTimer <= 0) {
        ped.down = false;
        ped.parts.group.rotation.x = 0;
        ped.flee = true;
        ped.fleeTimer = 4;
      }
      continue;
    }
    // flee from the threat (player car / player) when it is close and fast
    let fleeing = ped.flee;
    if (threat) {
      const d = distance2D(ped.x, ped.z, threat.x, threat.z);
      if (d < 7 && threat.speed > 4) fleeing = true;
    }
    if (ped.fleeTimer > 0) {
      ped.fleeTimer -= dt;
      if (ped.fleeTimer <= 0) ped.flee = false;
    }
    let speed = ped.speed;
    let heading = ped.heading;
    if (fleeing) {
      speed = 4.2;
      if (threat) heading = Math.atan2(ped.x - threat.x, ped.z - threat.z);
    } else {
      // stroll along the sidewalk; at intersections, sometimes turn
      const along = ped.vertical ? ped.z : ped.x;
      const atEnd = ped.dir > 0 ? along > 186 : along < -186;
      const nearCrossing = Math.abs(((along % STREET_PITCH) + STREET_PITCH) % STREET_PITCH - STREET_PITCH / 2) < 3;
      if (atEnd) {
        ped.dir *= -1;
      } else if (nearCrossing && Math.random() < dt * 0.25) {
        ped.vertical = !ped.vertical;
        ped.line = Math.round((ped.vertical ? ped.x : ped.z) / STREET_PITCH) * STREET_PITCH;
        ped.side = Math.random() < 0.5 ? -1 : 1;
        ped.dir = Math.random() < 0.5 ? 1 : -1;
      }
      heading = ped.vertical ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    ped.heading = angleLerp(ped.heading, heading, Math.min(1, dt * 6));
    const nx = ped.x + Math.sin(ped.heading) * speed * dt;
    const nz = ped.z + Math.cos(ped.heading) * speed * dt;
    const probe = { x: nx, z: nz };
    if (!collideCircle(probe, 0.4, solids)) { ped.x = nx; ped.z = nz; }
    ped.walkPhase += speed * dt * 2.4;
    const swing = Math.sin(ped.walkPhase) * 0.55;
    ped.parts.legL.rotation.x = swing;
    ped.parts.legR.rotation.x = -swing;
    ped.parts.armL.rotation.x = -swing * 0.7;
    ped.parts.armR.rotation.x = swing * 0.7;
    ped.parts.group.position.set(ped.x, 0, ped.z);
    ped.parts.group.rotation.y = ped.heading;
  }
}
