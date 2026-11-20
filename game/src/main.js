// SOLMAR — Streets of Gold. The orchestrator: renderer, lights, game loop,
// camera, missions, wanted police, interactions, save/load and the title flow.
// Every system lives in its own module; this file wires them together.

import * as THREE from 'three';
import { mulberry32, range, clamp, angleLerp, distance2D } from './rng.js';
import { buildCity, buildCityPlan, collideCircle, CITY_SEED, STREET_PITCH } from './city.js';
import { createCar, stepCar, spawnParkedCars, spawnTraffic, updateTraffic, spawnPolice, updatePolice } from './vehicles.js';
import { createPlayer, stepPlayerOnFoot, punch } from './player.js';
import { spawnPeds, updatePeds } from './peds.js';
import { createWanted, addWanted, updateWanted, policeCountFor } from './wanted.js';
import { MISSIONS, createMissionState, currentMission, currentStep, advanceStep } from './missions.js';
import { initHud, showHud, showBanner, showMessage, showHint, updateHud } from './hud.js';
import { AudioEngine } from './audio.js';
import { saveGame, loadSave, clearSave, applySave } from './save.js';
import { createInput } from './input.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') || 1);

const rng = mulberry32(CITY_SEED + SEED);

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xef9a5e);
scene.fog = new THREE.Fog(0xef9a5e, 190, 640);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(-70, 42, 150);

// Golden-hour light: warm sun low in the west, soft sky fill.
const hemi = new THREE.HemisphereLight(0xffd9b0, 0x6a4a3a, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffb36b, 1.9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
sun.shadow.camera.far = 700;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(sun.target);

const city = buildCity(scene, rng);
const solids = city.solids;

const G = {
  scene, camera, renderer, rng, time: 0, clockMinutes: 18 * 60 + 42,
  mode: 'title', shotName: SHOT, fixedCamera: null,
  player: createPlayer(scene, 0, 24),
  parked: [], traffic: [], police: [], peds: [],
  wanted: createWanted(),
  missionState: createMissionState(),
  missionTitle: 'JOB 1 — THE WHEELMAN',
  missionText: 'Steal a car — walk up to any parked car and press E',
  markerTarget: null,
  camYaw: Math.PI, camPitch: 0.3, camDist: 7,
  audio: new AudioEngine(),
  input: createInput(),
  playerCar: null,
  policeGoneTimer: 0,
  beacon: null,
};
G.parked = spawnParkedCars(scene, rng, buildCityPlan());
G.traffic = spawnTraffic(scene, rng, 14);
G.peds = spawnPeds(scene, rng, 26);

// Mission beacon: a shaft of golden light over the current objective.
{
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.32, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 46, 12, 1, true), beaconMat);
  beam.position.y = 23;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  const beacon = new THREE.Group();
  beacon.add(beam); beacon.add(ring);
  beacon.visible = false;
  scene.add(beacon);
  G.beacon = beacon;
}

const hud = initHud();
const saved = loadSave();
const btnContinue = document.getElementById('btn-continue');
if (saved) {
  btnContinue.classList.remove('hidden');
  btnContinue.textContent = `CONTINUE — $${saved.cash} · JOB ${Math.min(saved.missionIndex + 1, 4)}`;
}

function setMode(mode) {
  G.mode = mode;
  document.getElementById('title-screen').classList.toggle('hidden', mode !== 'title');
  document.getElementById('pause-screen').classList.toggle('hidden', mode !== 'paused');
  document.getElementById('end-screen').classList.toggle('hidden', mode !== 'ended');
  showHud(mode === 'playing');
}

function startGame(useSave) {
  G.audio.init();
  if (useSave && saved) applySave(G, saved);
  setMode('playing');
  showBanner(currentMission(G.missionState)?.title ?? 'FREE ROAM');
  showMessage(currentMission(G.missionState)?.briefing ?? 'Solmar is yours, Danny.');
}

document.getElementById('btn-start').addEventListener('click', () => startGame(false));
btnContinue.addEventListener('click', () => startGame(true));
document.getElementById('btn-resume').addEventListener('click', () => setMode('playing'));
document.getElementById('btn-save').addEventListener('click', () => {
  const ok = saveGame(G);
  document.getElementById('save-note').textContent = ok ? 'Saved. The city remembers.' : 'Save failed — storage unavailable.';
});
document.getElementById('btn-quit').addEventListener('click', () => setMode('title'));
document.getElementById('btn-retry').addEventListener('click', () => {
  const p = G.player;
  p.health = 100;
  p.cash = Math.floor(p.cash * 0.75);
  p.x = -120; p.z = -150; p.y = 0; p.vy = 0;
  p.onFoot = true;
  if (p.car) { p.car.speed = 0; G.parked.push(p.car); p.car = null; G.playerCar = null; }
  p.parts.group.visible = true;
  p.parts.group.position.set(p.x, 0, p.z);
  G.wanted.level = 0;
  for (const cop of G.police) scene.remove(cop.mesh);
  G.police = [];
  setMode('playing');
  showBanner('BACK ON THE STREETS');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- interactions ----------
function nearestCar(maxDist) {
  const p = G.player;
  let best = null, bestD = maxDist;
  for (const car of [...G.parked, ...G.traffic]) {
    const d = distance2D(p.x, p.z, car.x, car.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

function enterCar(car) {
  const p = G.player;
  const wasParked = G.parked.includes(car);
  if (wasParked) {
    G.parked = G.parked.filter((c) => c !== car);
    addWanted(G.wanted, 1, G.time, 'grand theft auto');
    showMessage('You stole the car! The owner will not be pleased.');
  } else {
    G.traffic = G.traffic.filter((c) => c !== car);
    addWanted(G.wanted, 1, G.time, 'carjacking');
    showMessage('You jacked the car! The driver ran for it.');
  }
  car.parked = false;
  car.speed = 0;
  p.car = car;
  p.onFoot = false;
  G.playerCar = car;
  p.parts.group.visible = false;
  G.audio.blip(440, 0.1, 'square', 0.1);
}

function exitCar() {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  car.speed = 0;
  car.parked = true;
  G.parked.push(car);
  p.x = car.x - Math.cos(car.heading) * 2.6;
  p.z = car.z + Math.sin(car.heading) * 2.6;
  p.heading = car.heading;
  p.onFoot = true;
  p.car = null;
  G.playerCar = null;
  p.parts.group.visible = true;
  p.parts.group.position.set(p.x, 0, p.z);
}

function handleInteract() {
  const p = G.player;
  const step = currentStep(G.missionState);
  if (p.onFoot && step && step.kind === 'interact' && step.target) {
    const d = distance2D(p.x, p.z, step.target.x, step.target.z);
    if (d < (step.radius ?? 4)) {
      completeStep();
      return;
    }
  }
  if (p.onFoot) {
    const car = nearestCar(4.2);
    if (car) enterCar(car);
  } else {
    exitCar();
  }
}

function completeStep() {
  const step = currentStep(G.missionState);
  if (!step) return;
  const res = advanceStep(G.missionState);
  G.audio.jingle();
  if (res.completed === 'mission') {
    G.player.cash += res.reward;
    showBanner(`${currentMission(G.missionState)?.title ?? 'JOB COMPLETE'} — +$${res.reward}`);
    showMessage(currentMission(G.missionState)?.briefing ?? '');
    saveGame(G);
  } else if (res.completed === 'story') {
    G.player.cash += res.reward;
    showBanner(`STORY COMPLETE — +$${res.reward}`);
    showMessage('The Big Score is yours. Solmar is yours, Danny. Free roam — keep the engine running.');
    saveGame(G);
  } else {
    G.audio.blip(990, 0.12, 'sine', 0.12);
    // stepping into a "hot" step puts the law on the player at once
    const next = currentStep(G.missionState);
    if (next && next.onStart === 'hot') {
      addWanted(G.wanted, 2, G.time, 'the job went loud');
      showMessage('The PD is on you — run!');
    }
  }
}

// ---------- missions ----------
function updateMissions(dt) {
  const ms = G.missionState;
  const m = currentMission(ms);
  const step = currentStep(ms);
  if (!m || !step) {
    G.missionTitle = 'FREE ROAM';
    G.missionText = 'Solmar is yours, Danny. Steal cars, dodge the PD, enjoy the gold.';
    G.markerTarget = null;
    return;
  }
  G.missionTitle = m.title;
  G.missionText = step.text;
  const p = G.player;
  if (step.kind === 'steal') {
    const car = nearestCar(400);
    G.markerTarget = car ? { x: car.x, z: car.z, label: 'Steal a car' } : null;
    if (!p.onFoot) completeStep();
  } else if (step.kind === 'loseheat') {
    G.markerTarget = null;
    if (G.wanted.level === 0) completeStep();
  } else if (step.kind === 'interact') {
    G.markerTarget = step.target;
    const d = distance2D(p.x, p.z, step.target.x, step.target.z);
    if (d < (step.radius ?? 4) + 3) showHint('Press E');
  } else if (step.kind === 'arrive') {
    G.markerTarget = step.target;
    const d = distance2D(p.x, p.z, step.target.x, step.target.z);
    if (d < (step.radius ?? 6)) completeStep();
  }
}

// ---------- police ----------
function managePolice(dt) {
  const want = policeCountFor(G.wanted.level);
  // spawn cruisers at a street corner behind the player
  while (G.police.length < want) {
    const streets = [];
    for (let i = -4; i <= 4; i++) streets.push(i * STREET_PITCH);
    const sx = streets[Math.floor(Math.random() * streets.length)];
    const sz = streets[Math.floor(Math.random() * streets.length)];
    const cop = spawnPolice(scene, rng, sx + 40, sz + 40);
    cop.x = G.player.x + (Math.random() < 0.5 ? -1 : 1) * 55;
    cop.z = G.player.z + (Math.random() < 0.5 ? -1 : 1) * 55;
    cop.x = Math.max(-200, Math.min(200, cop.x));
    cop.z = Math.max(-200, Math.min(200, cop.z));
    cop.mesh.position.set(cop.x, 0, cop.z);
    G.police.push(cop);
  }
  if (G.wanted.level === 0 && G.police.length > 0) {
    G.policeGoneTimer += dt;
    if (G.policeGoneTimer > 3) {
      for (const cop of G.police) scene.remove(cop.mesh);
      G.police = [];
      G.policeGoneTimer = 0;
    }
  } else {
    G.policeGoneTimer = 0;
  }
}

function nearestPoliceDist() {
  let best = 1e9;
  for (const cop of G.police) best = Math.min(best, distance2D(G.player.x, G.player.z, cop.x, cop.z));
  return best;
}

// ---------- camera ----------
function updateCamera(dt) {
  const p = G.player;
  if (G.fixedCamera) {
    camera.position.set(...G.fixedCamera.pos);
    camera.lookAt(...G.fixedCamera.look);
    return;
  }
  const cam = G.input.consumeCamera();
  G.camYaw += cam.yaw;
  G.camPitch = clamp(G.camPitch + cam.pitch, 0.05, 1.1);
  if (G.mode === 'title') {
    const a = G.time * 0.03;
    camera.position.set(Math.sin(a) * 170, 62, Math.cos(a) * 170);
    camera.lookAt(0, 22, 0);
    return;
  }
  if (p.onFoot) {
    const dist = G.camDist;
    const cx = p.x + Math.sin(G.camYaw) * Math.cos(G.camPitch) * dist;
    const cz = p.z + Math.cos(G.camYaw) * Math.cos(G.camPitch) * dist;
    const cy = 1.7 + Math.sin(G.camPitch) * dist;
    camera.position.set(cx, cy, cz);
    camera.lookAt(p.x, p.y + 1.7, p.z);
  } else if (p.car) {
    const car = p.car;
    const back = 14 + Math.abs(car.speed) * 0.05;
    const tx = car.x - Math.sin(car.heading) * back;
    const tz = car.z - Math.cos(car.heading) * back;
    const ty = 7.5 + Math.abs(car.speed) * 0.01;
    if (G.shotName) {
      // staged shots: snap straight to the chase position (software
      // rendering runs at few fps, so a lerp would never converge in time)
      camera.position.set(tx, ty, tz);
    } else {
      camera.position.x += (tx - camera.position.x) * Math.min(1, dt * 5);
      camera.position.y += (ty - camera.position.y) * Math.min(1, dt * 5);
      camera.position.z += (tz - camera.position.z) * Math.min(1, dt * 5);
    }
    camera.lookAt(car.x + Math.sin(car.heading) * 6, 2.0, car.z + Math.cos(car.heading) * 6);
    camera.fov += ((62 + Math.abs(car.speed) * 0.25) - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }
}

// ---------- main loop ----------
const clock = new THREE.Clock();
let frames = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  G.time += dt;
  const pressed = G.input.consume();

  if (pressed.mute) {
    G.audio.setMuted(!G.audio.muted);
    showMessage(G.audio.muted ? 'Sound off' : 'Sound on');
  }
  if (pressed.pause) {
    if (G.mode === 'playing') setMode('paused');
    else if (G.mode === 'paused') setMode('playing');
  }

  const simRunning = G.mode === 'playing' || G.mode === 'title';
  if (simRunning) {
    const p = G.player;
    // traffic + pedestrians always live, even on the title screen
    updateTraffic(G.traffic, dt, solids, [...G.traffic, ...G.police, ...(G.playerCar ? [G.playerCar] : [])]);
    updatePeds(G.peds, dt, solids, p.onFoot ? null : { x: p.x, z: p.z, speed: Math.abs(p.car?.speed ?? 0) });

    if (G.mode === 'playing') {
      G.clockMinutes = Math.min(19 * 60 + 30, G.clockMinutes + dt * 0.25);
      // player / vehicle
      if (p.onFoot) {
        stepPlayerOnFoot(p, G.input, G.camYaw, dt, solids, [...G.traffic, ...G.parked, ...G.police]);
        if (pressed.punch) {
          const hit = punch(p, G.peds);
          if (hit) {
            addWanted(G.wanted, 1, G.time, 'assault');
            showMessage('You decked a pedestrian! Someone called the cops.');
            G.audio.thud();
          } else {
            G.audio.blip(180, 0.08, 'square', 0.08);
          }
        }
      } else if (p.car) {
        const throttle = G.shotDrive ? 1 : (G.input.forward ? 1 : G.input.back ? -0.75 : 0);
        const steer = (G.input.left ? -1 : 0) + (G.input.right ? 1 : 0);
        stepCar(p.car, throttle, steer, dt, solids, 33);
        p.x = p.car.x; p.z = p.car.z; p.heading = p.car.heading;
        // running over a pedestrian at speed
        for (const ped of G.peds) {
          if (ped.down || ped.hitCooldown > 0) continue;
          const d = distance2D(p.x, p.z, ped.x, ped.z);
          if (d < 2.4 && Math.abs(p.car.speed) > 6) {
            ped.down = true; ped.downTimer = 2.2; ped.flee = true; ped.hitCooldown = 3;
            p.car.speed *= 0.75;
            addWanted(G.wanted, 1, G.time, 'hit and run');
            showMessage('You hit a pedestrian! The PD is coming.');
            G.audio.thud();
          }
        }
        for (const ped of G.peds) if (ped.hitCooldown > 0) ped.hitCooldown -= dt;
        // bump traffic cars
        for (const other of [...G.traffic, ...G.police]) {
          const d = distance2D(p.x, p.z, other.x, other.z);
          if (d < 4.4 && d > 0.01) {
            const push = (4.4 - d) / 2;
            const nx = (other.x - p.x) / d, nz = (other.z - p.z) / d;
            other.x += nx * push; other.z += nz * push;
            p.car.speed *= 0.82;
            other.speed *= 0.7;
          }
        }
      }
      if (pressed.interact) handleInteract();

      // police
      managePolice(dt);
      let damage = 0;
      for (const cop of G.police) {
        damage += updatePolice(cop, p.x, p.z, Math.abs(p.car?.speed ?? p.speed), dt, solids);
      }
      if (damage > 0) {
        p.health -= damage;
        if (Math.random() < dt * 2) G.audio.blip(220, 0.1, 'sawtooth', 0.1);
      }
      const busted = updateWanted(G.wanted, dt, G.time, Math.abs(p.car?.speed ?? p.speed), nearestPoliceDist());
      if (busted === 'busted') endGame('BUSTED', 'The Solmar PD finally boxed you in. You lose a quarter of your cash — but the city is still out there.');
      if (p.health <= 0) endGame('WASTED', 'That was a rough one, Danny. The hospital patches you up — minus a quarter of your cash.');
      if (G.wanted.level === 0 && p.health < 100) p.health = Math.min(100, p.health + 2.5 * dt);

      updateMissions(dt);
      // mission 3 starts hot: three stars the moment the job begins
      const m = currentMission(G.missionState);
      if (m && m.id === 'heat' && G.missionState.step === 0 && G.wanted.level < 3 && !G.heatStarted) {
        G.heatStarted = true;
        addWanted(G.wanted, 3, G.time, 'the heat is on');
        showMessage('Three stars! Every cruiser in Solmar is after you.');
      }
      if (m && m.id !== 'heat') G.heatStarted = false;
    }

    // beacon follows the marker
    if (G.markerTarget && G.mode === 'playing') {
      G.beacon.visible = true;
      G.beacon.position.set(G.markerTarget.x, 0, G.markerTarget.z);
      G.beacon.children[0].material.opacity = 0.26 + Math.sin(G.time * 3) * 0.1;
    } else {
      G.beacon.visible = false;
    }

    // sun shadow follows the player
    const px = G.player.x, pz = G.player.z;
    sun.position.set(px - 260, 190, pz - 140);
    sun.target.position.set(px, 0, pz);
    // ocean scroll
    city.waterTex.offset.x = (G.time * 0.008) % 1;
    city.waterTex.offset.y = (G.time * 0.004) % 1;
  }

  updateCamera(dt);
  if (G.mode === 'playing') {
    updateHud(G, dt);
    const speed01 = G.player.onFoot ? Math.abs(G.player.speed) / 9 : Math.abs(G.player.car?.speed ?? 0) / 33;
    const siren = G.police.length > 0 ? Math.min(1, 60 / Math.max(nearestPoliceDist(), 10)) : 0;
    G.audio.update(speed01, siren, G.time);
  }
  renderer.render(scene, camera);

  frames += 1;
  if (frames === 3 && SHOT) {
    window.__shotReady = true;
  }
}

function endGame(title, text) {
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-text').textContent = text;
  setMode('ended');
  G.audio.setMuted(true);
}

// ---------- boot ----------
document.getElementById('loading').classList.add('hidden');
if (SHOT) {
  applyShot(G, SHOT);
  // clean frame for screenshots: no controls cheat-sheet over the picture
  document.getElementById('controls-help').style.display = 'none';
  if (SHOT !== 'start') {
    document.getElementById('title-screen').classList.add('hidden');
    showHud(true);
  }
}
window.__SOLMAR__ = G;
animate();
