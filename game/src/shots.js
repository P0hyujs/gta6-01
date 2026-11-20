// Screenshot staging for Solmar: ?shot=start|street|chase|docks&seed=1 puts the
// game into a fixed, lively scene so the maker's screenshots show the city,
// the systems and the story at their best. The game itself is unchanged —
// staging only moves the player, the cars and the camera, then lets the
// simulation run for a couple of seconds before the capture.

import { createCar } from './vehicles.js';
import { addWanted } from './wanted.js';

export function applyShot(G, name) {
  G.shotName = name;
  const p = G.player;
  if (name === 'start') {
    // Title screen over a slow view of downtown at golden hour.
    G.mode = 'title';
    G.fixedCamera = { pos: [-70, 42, 150], look: [0, 18, -20] };
    p.x = 0; p.z = 24; p.heading = Math.PI;
    p.parts.group.position.set(p.x, 0, p.z);
    return;
  }
  if (name === 'street') {
    // On foot in the plaza, pedestrians around, traffic rolling past.
    G.mode = 'playing';
    p.x = 0; p.z = 8; p.heading = Math.PI;
    p.parts.group.position.set(p.x, 0, p.z);
    G.camYaw = Math.PI;
    G.camPitch = 0.28;
    G.missionState.index = 0;
    G.missionState.step = 0;
    // bring a few pedestrians into the plaza for life
    const spots = [[-8, 18, 0.6], [7, 16, 2.4], [-12, -6, 1.2], [11, -12, 2.9]];
    G.peds.slice(0, 4).forEach((ped, i) => {
      ped.x = spots[i][0]; ped.z = spots[i][1]; ped.heading = spots[i][2];
      ped.vertical = false; ped.line = 0; ped.dir = 1;
      ped.parts.group.position.set(ped.x, 0, ped.z);
    });
    return;
  }
  if (name === 'chase') {
    // Mid-chase: Danny driving north up the avenue, three stars, two cruisers
    // on his tail, the "Lose the Heat" job on the HUD.
    G.mode = 'playing';
    const car = createCar(G.scene, 0, 40, 0, 0xd23b3b);
    car.speed = 21;
    G.shotDrive = true;
    G.parked = G.parked.filter((c) => c !== car);
    G.playerCar = car;
    p.car = car;
    p.onFoot = false;
    p.x = car.x; p.z = car.z; p.heading = 0;
    p.parts.group.visible = false;
    addWanted(G.wanted, 3, G.time, 'shot staging');
    G.missionState.index = 2;
    G.missionState.step = 0;
    G.missionTitle = 'JOB 3 — LOSE THE HEAT';
    G.missionText = 'Lose the cops — get your wanted level back to zero';
    G.clockMinutes = 18 * 60 + 52;
    // two cruisers: one closing in from behind, one cutting across ahead
    const cop1 = createCar(G.scene, -5, 28, 0, 0x14161c, true);
    cop1.speed = 22;
    const cop2 = createCar(G.scene, 10, 84, -Math.PI / 2, 0x14161c, true);
    cop2.speed = 18;
    G.police.push(cop1, cop2);
    // a little traffic ahead on the avenue for life
    const ahead = createCar(G.scene, 2.5, 130, 0, 0x2e7fb8);
    ahead.speed = 10;
    G.traffic.push(ahead);
    return;
  }
  if (name === 'docks') {
    // The Big Score's ending: the getaway car on the marina pier at sunset,
    // the gold in the trunk, the city skyline behind.
    G.mode = 'playing';
    const car = createCar(G.scene, 312, 120, -Math.PI / 2, 0xffd23f);
    G.playerCar = car;
    p.car = car;
    p.onFoot = false;
    p.x = car.x; p.z = car.z; p.heading = -Math.PI / 2;
    p.parts.group.visible = false;
    p.cash = 2750;
    G.missionState.index = 3;
    G.missionState.step = 1;
    G.missionTitle = 'JOB 4 — THE BIG SCORE';
    G.missionText = 'Escape to the marina pier — do not get caught';
    G.markerTarget = { x: 292, z: 120, label: 'Marina' };
    G.clockMinutes = 19 * 60 + 8;
    return;
  }
  // unknown shot name: plain play
  G.mode = 'playing';
}
