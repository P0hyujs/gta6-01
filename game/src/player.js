// Danny Reyes on foot: a stylised low-poly walker with a swing animation,
// jump, punch, and the ability to steal any parked car he stands next to.

import * as THREE from 'three';
import { clamp, angleLerp } from './rng.js';
import { collideCircle } from './city.js';

export function createPlayerMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e7fb8 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2a3550 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);
  const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair);
  hairTop.position.y = 1.66;
  group.add(hairTop);
  const legGeo = new THREE.BoxGeometry(0.24, 0.72, 0.26);
  const legL = new THREE.Mesh(legGeo, jeans);
  legL.position.set(-0.17, 0.36, 0);
  legL.geometry.translate(0, -0.36, 0);
  legL.position.y = 0.72;
  legL.castShadow = true;
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  group.add(legR);
  const armGeo = new THREE.BoxGeometry(0.18, 0.62, 0.2);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.geometry.translate(0, -0.31, 0);
  armL.position.set(-0.42, 1.36, 0);
  armL.castShadow = true;
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armR);
  return { group, legL, legR, armL, armR, head };
}

export function createPlayer(scene, x, z) {
  const parts = createPlayerMesh();
  parts.group.position.set(x, 0, z);
  scene.add(parts.group);
  return {
    parts, x, z, y: 0, vy: 0, heading: 0, speed: 0,
    health: 100, cash: 0, onFoot: true, car: null,
    walkPhase: 0, punchTimer: 0, grounded: true,
  };
}

// On-foot step: move relative to the camera yaw. Returns horizontal speed.
export function stepPlayerOnFoot(p, input, camYaw, dt, solids, cars) {
  let mx = 0, mz = 0;
  if (input.forward) { mx += -Math.sin(camYaw); mz += -Math.cos(camYaw); }
  if (input.back) { mx += Math.sin(camYaw); mz += Math.cos(camYaw); }
  if (input.left) { mx += -Math.cos(camYaw); mz += Math.sin(camYaw); }
  if (input.right) { mx += Math.cos(camYaw); mz += -Math.sin(camYaw); }
  const len = Math.hypot(mx, mz);
  const running = input.run ? 1.8 : 1;
  const targetSpeed = len > 0 ? 5.2 * running : 0;
  if (len > 0) {
    mx /= len; mz /= len;
    p.heading = angleLerp(p.heading, Math.atan2(mx, mz), Math.min(1, dt * 12));
  }
  p.speed += (targetSpeed - p.speed) * Math.min(1, dt * 10);
  const nx = p.x + mx * p.speed * dt;
  const nz = p.z + mz * p.speed * dt;
  const probe = { x: nx, z: nz };
  if (!collideCircle(probe, 0.55, solids)) { p.x = nx; p.z = nz; }
  // soft push-out from cars
  for (const car of cars) {
    const dx = p.x - car.x, dz = p.z - car.z;
    const d = Math.hypot(dx, dz);
    if (d < 2.4 && d > 0.01) {
      p.x = car.x + (dx / d) * 2.4;
      p.z = car.z + (dz / d) * 2.4;
    }
  }
  // jump + gravity
  if (input.jump && p.grounded) {
    p.vy = 6.5;
    p.grounded = false;
  }
  p.vy -= 18 * dt;
  p.y += p.vy * dt;
  if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; }
  // pose
  p.walkPhase += p.speed * dt * 1.9;
  const swing = Math.sin(p.walkPhase) * clamp(p.speed / 5, 0, 1) * 0.7;
  p.parts.legL.rotation.x = swing;
  p.parts.legR.rotation.x = -swing;
  p.parts.armL.rotation.x = -swing * 0.8;
  p.parts.armR.rotation.x = swing * 0.8;
  if (p.punchTimer > 0) {
    p.punchTimer -= dt;
    const k = 1 - p.punchTimer / 0.28;
    p.parts.armR.rotation.x = -1.5 * Math.sin(k * Math.PI);
  }
  p.parts.group.position.set(p.x, p.y, p.z);
  p.parts.group.rotation.y = p.heading;
  return p.speed;
}

// Punch: returns the ped hit, if any.
export function punch(p, peds) {
  if (p.punchTimer > 0) return null;
  p.punchTimer = 0.28;
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  for (const ped of peds) {
    if (ped.down) continue;
    const dx = ped.x - p.x, dz = ped.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 2.1 && (dx * fx + dz * fz) / Math.max(d, 0.01) > 0.3) {
      ped.down = true;
      ped.downTimer = 2.2;
      ped.flee = true;
      return ped;
    }
  }
  return null;
}
