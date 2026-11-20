// Cars of Solmar: the player's ride, parked cars to steal, traffic that cruises
// the street grid, and Solmar PD cruisers that chase the player when wanted.
// Arcade physics on purpose: quick, forgiving, fun to drive with a keyboard.

import * as THREE from 'three';
import { mulberry32, pick, range, rangeInt, clamp, angleLerp, distance2D } from './rng.js';
import { collideCircle, STREET_PITCH } from './city.js';

const CAR_COLORS = [0xd23b3b, 0x2e7fb8, 0xffd23f, 0x7dff9a, 0xe8e8e2, 0x1e1e26, 0xff7a59, 0x9a6bd2, 0x37b6ff, 0xff9ad2];

function buildCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1d3547, emissive: 0x0a1a26 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.05, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0c10 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    group.add(w);
    wheels.push(w);
  }
  // headlights + taillights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), headMat);
    h.position.set(x, 0.6, 2.22);
    group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), tailMat);
    t.position.set(x, 0.6, -2.22);
    group.add(t);
  }
  let lightBar = null;
  if (isPolice) {
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.4), darkMat);
    barBase.position.set(0, 1.42, -0.2);
    group.add(barBase);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.38, 1.44, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.42), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0.38, 1.44, -0.2);
    group.add(blue);
    lightBar = { red, blue };
    // PD livery: white doors band
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 2.4), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    band.position.set(0, 0.62, 0);
    group.add(band);
  }
  return { group, wheels, lightBar };
}

export function createCar(scene, x, z, heading, color, isPolice = false) {
  const { group, wheels, lightBar } = buildCarMesh(color, isPolice);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    mesh: group, wheels, lightBar, isPolice,
    x, z, heading, speed: 0, steer: 0,
    color, radius: 2.3, stuckTimer: 0, sirenPhase: Math.random() * 10,
  };
}

// Arcade car step: throttle -1..1, steer -1..1. Returns true if it hit a building.
export function stepCar(car, throttle, steer, dt, solids, maxSpeed) {
  const accel = throttle >= 0 ? 16 : 22;
  car.speed += throttle * accel * dt;
  car.speed -= car.speed * 0.9 * dt; // rolling drag
  car.speed = clamp(car.speed, -9, maxSpeed);
  if (Math.abs(car.speed) < 0.05 && throttle === 0) car.speed = 0;
  const steerAmount = steer * clamp(Math.abs(car.speed) / 8, 0, 1) * 1.9;
  car.heading += steerAmount * Math.sign(car.speed) * dt;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const probe = { x: nx, z: nz };
  const hit = collideCircle(probe, car.radius, solids);
  if (hit) {
    car.speed *= 0.45; // scrape along the wall
    // slide: keep the component that did not collide
    const px = { x: nx, z: car.z };
    const pz = { x: car.x, z: nz };
    if (!collideCircle(px, car.radius, solids)) { car.x = nx; }
    else if (!collideCircle(pz, car.radius, solids)) { car.z = nz; }
  } else {
    car.x = nx; car.z = nz;
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // wheels: spin with speed, front pair steers
  const spin = (car.speed * dt) / 0.36;
  for (let i = 0; i < 4; i++) {
    car.wheels[i].rotation.x += spin;
  }
  car.wheels[0].rotation.y = steer * 0.42;
  car.wheels[1].rotation.y = steer * 0.42;
  if (car.lightBar) {
    car.sirenPhase += dt * 6;
    const on = Math.sin(car.sirenPhase) > 0;
    car.lightBar.red.material.color.setHex(on ? 0xff2020 : 0x551010);
    car.lightBar.blue.material.color.setHex(on ? 0x101050 : 0x2040ff);
  }
  return hit;
}

export function spawnParkedCars(scene, rng, plan) {
  const parked = [];
  // Parked at the kerb, on the street grid (offset 3.5 m from the street
  // centre: inside the traffic lane's edge, clear of the facades), heading
  // along the street — never inside a block.
  const spots = [
    [3.5, -30, 0], [-3.5, 30, Math.PI],
    [72, -92.5, Math.PI / 2], [-72, -99.5, -Math.PI / 2],
    [99.5, 18, 0], [92.5, -18, Math.PI],
    [18, 99.5, Math.PI / 2], [-18, 92.5, -Math.PI / 2],
    [-140.5, -66, 0], [-147.5, 66, Math.PI],
    [66, -140.5, Math.PI / 2], [-66, -147.5, -Math.PI / 2],
  ];
  for (const [x, z, heading] of spots) {
    const car = createCar(scene, x, z, heading, pick(rng, CAR_COLORS));
    car.parked = true;
    parked.push(car);
  }
  return parked;
}

export function spawnTraffic(scene, rng, count = 14) {
  const traffic = [];
  const streets = [];
  for (let i = -4; i <= 4; i++) streets.push(i * STREET_PITCH);
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const line = pick(rng, streets);
    const pos = range(rng, -180, 180);
    const dir = rng() < 0.5 ? 1 : -1;
    const x = vertical ? line + 2.5 * dir : pos;
    const z = vertical ? pos : line + 2.5 * dir;
    const heading = vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = createCar(scene, x, z, heading, pick(rng, CAR_COLORS));
    car.cruise = range(rng, 8, 12.5);
    car.vertical = vertical;
    car.line = line;
    car.dir = dir;
    traffic.push(car);
  }
  return traffic;
}

// Traffic drives from intersection to intersection on the grid.
export function updateTraffic(cars, dt, solids, allCars) {
  const streets = [];
  for (let i = -4; i <= 4; i++) streets.push(i * STREET_PITCH);
  for (const car of cars) {
    // target: the next intersection along the current line
    if (!car.target) {
      const along = car.vertical ? car.z : car.x;
      const next = car.dir > 0 ? streets.find((s) => s > along + 6) ?? 192 : [...streets].reverse().find((s) => s < along - 6) ?? -192;
      car.target = car.vertical ? { x: car.line + 2.5 * car.dir, z: next } : { x: next, z: car.line + 2.5 * car.dir };
    }
    const dx = car.target.x - car.x, dz = car.target.z - car.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const wantHeading = Math.atan2(dx, dz);
    const steer = clamp(angleLerp(car.heading, wantHeading, 1) * 1.6, -1, 1);
    // slow down for a car ahead
    let throttle = 0.8;
    for (const other of allCars) {
      if (other === car) continue;
      const d = distance2D(car.x, car.z, other.x, other.z);
      if (d < 9) {
        const ahead = (other.x - car.x) * Math.sin(car.heading) + (other.z - car.z) * Math.cos(car.heading);
        if (ahead > 0) { throttle = 0.15; break; }
      }
    }
    stepCar(car, throttle, steer, dt, solids, car.cruise);
    if (dist < 5) {
      // at the intersection: mostly straight, sometimes turn
      const r = Math.random();
      const atLine = car.vertical ? car.target.z : car.target.x;
      if (r < 0.68) {
        car.target = null; // keep going straight on the same line
      } else {
        // turn onto the crossing street
        const turnDir = r < 0.84 ? 1 : -1;
        car.vertical = !car.vertical;
        car.line = atLine;
        car.dir = turnDir;
        car.target = null;
      }
    }
  }
}

export function spawnPolice(scene, rng, x, z) {
  const car = createCar(scene, x, z, 0, 0x14161c, true);
  car.cruise = 24;
  return car;
}

// Police chase: steer at the player, ram when close. Returns damage dealt this tick.
export function updatePolice(car, targetX, targetZ, targetSpeed, dt, solids) {
  const dx = targetX - car.x, dz = targetZ - car.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const wantHeading = Math.atan2(dx, dz);
  const steer = clamp(angleLerp(car.heading, wantHeading, 1) * 2.2, -1, 1);
  const throttle = dist > 6 ? 1 : 0.7;
  const hitWall = stepCar(car, throttle, steer, dt, solids, car.cruise);
  if (Math.abs(car.speed) < 0.5) {
    car.stuckTimer += dt;
    if (car.stuckTimer > 2.5) {
      car.speed = -6; // back out of the jam
      car.stuckTimer = 0;
    }
  } else {
    car.stuckTimer = 0;
  }
  let damage = 0;
  if (dist < 3.4 && Math.abs(car.speed) > 4) damage = 6 * dt * Math.abs(car.speed) / 10;
  return damage;
}
