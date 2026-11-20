// The Solmar PD wanted system: stars 0-5, heat that cools off when the player
// lays low, and busted / wasted endings when the law (or the damage) catches up.

import { clamp } from './rng.js';

export function createWanted() {
  return {
    level: 0,
    lastCrimeAt: -1000,
    decayTimer: 0,
    bustedTimer: 0,
    heat: 0, // 0..1, drives police aggression
  };
}

export function policeCountFor(level) {
  if (level <= 0) return 0;
  if (level === 1) return 1;
  if (level === 2) return 1;
  if (level === 3) return 2;
  if (level === 4) return 3;
  return 4;
}

export function addWanted(w, amount, now, reason) {
  const before = w.level;
  w.level = clamp(w.level + amount, 0, 5);
  w.lastCrimeAt = now;
  w.decayTimer = 0;
  w.heat = 1;
  return { before, after: w.level, reason };
}

// Called every tick. Returns 'busted' when the police finally grab the player.
export function updateWanted(w, dt, now, playerSpeed, nearestPoliceDist) {
  if (w.level > 0) {
    // heat cools: no fresh crime for a while and no cruiser nearby
    if (now - w.lastCrimeAt > 14 && nearestPoliceDist > 45) {
      w.decayTimer += dt;
      if (w.decayTimer > 11) {
        w.level -= 1;
        w.decayTimer = 0;
        w.lastCrimeAt = now; // fresh grace period before the next star drops
      }
    } else {
      w.decayTimer = 0;
    }
    w.heat = clamp(w.heat - dt * 0.03, 0.35, 1);
    // busted: a cruiser sits on the player while slow, at 2+ stars
    if (w.level >= 2 && nearestPoliceDist < 3.6 && playerSpeed < 3) {
      w.bustedTimer += dt;
      if (w.bustedTimer > 2.6) return 'busted';
    } else {
      w.bustedTimer = 0;
    }
  }
  return null;
}

export function wantedLabel(level) {
  return ['Clean', 'One star', 'Two stars', 'Three stars', 'Four stars', 'FIVE STARS'][level];
}
