// Canvas-generated textures for Solmar. No image files are shipped: every facade,
// the whole street map and the water are painted once at load from the seeded city plan,
// which keeps game/ small and the look coherent.

import * as THREE from 'three';
import { rangeInt, pick } from './rng.js';

// One 256x256 building facade: lit windows on a coloured concrete face.
export function makeFacadeTexture(rng, baseColor, litRatio) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 256, 256);
  // subtle vertical shading so faces read as concrete panels
  for (let x = 0; x < 256; x += 32) {
    g.fillStyle = 'rgba(0,0,0,0.08)';
    g.fillRect(x, 0, 2, 256);
  }
  const cols = 8, rows = 12;
  const w = 256 / cols, h = 256 / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? pick(rng, ['#ffd98a', '#ffe9b0', '#ffc46b']) : pick(rng, ['#2a3547', '#1d2735', '#33405a']);
      g.fillRect(x * w + 4, y * h + 5, w - 8, h - 10);
      if (lit) {
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(x * w + 4, y * h + 5, w - 8, 3);
      }
    }
  }
  // ground-floor shopfront band
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.fillRect(0, 232, 256, 24);
  g.fillStyle = pick(rng, ['#ff7a59', '#37b6ff', '#ffd23f', '#7dff9a']);
  g.fillRect(10, 236, 60, 16);
  return c;
}

export function canvasTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The whole city ground as one 2048x2048 map: asphalt streets with lane dashes,
// pale sidewalks, crosswalks, a beach on the east edge and a plaza downtown.
// Streets run on the grid lines given by the city plan; blocks are the gaps between.
export function makeGroundCanvas(plan) {
  const S = 2048;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  const half = plan.half;
  const toPx = (v) => ((v + half) / (half * 2)) * S;
  const pxPerMeter = S / (half * 2);

  // base: dry grass / dirt lots
  g.fillStyle = '#8a7a52';
  g.fillRect(0, 0, S, S);
  // city blocks: warm concrete
  g.fillStyle = '#b8a98c';
  for (const b of plan.blocks) {
    g.fillRect(toPx(b.x0), toPx(b.z0), (b.x1 - b.x0) * pxPerMeter, (b.z1 - b.z0) * pxPerMeter);
  }
  // streets: warm asphalt over the grid
  g.fillStyle = '#484c56';
  for (const x of plan.streetsX) {
    g.fillRect(toPx(x - plan.streetHalf), 0, plan.streetHalf * 2 * pxPerMeter, S);
  }
  for (const z of plan.streetsZ) {
    g.fillRect(0, toPx(z - plan.streetHalf), S, plan.streetHalf * 2 * pxPerMeter);
  }
  // lane dashes
  g.fillStyle = '#d8c25a';
  for (const x of plan.streetsX) {
    for (let z = -half; z < half; z += 8) {
      g.fillRect(toPx(x) - 1.5, toPx(z), 3, 3.2 * pxPerMeter);
    }
  }
  for (const z of plan.streetsZ) {
    for (let x = -half; x < half; x += 8) {
      g.fillRect(toPx(x), toPx(z) - 1.5, 3.2 * pxPerMeter, 3);
    }
  }
  // crosswalks at every intersection
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (const x of plan.streetsX) {
    for (const z of plan.streetsZ) {
      for (let i = -2; i <= 2; i++) {
        g.fillRect(toPx(x - plan.streetHalf + 1 + i * 2.4), toPx(z - plan.streetHalf), 1.4 * pxPerMeter, plan.streetHalf * 2 * pxPerMeter);
      }
    }
  }
  // downtown plaza: terracotta tiles
  g.fillStyle = '#c47a4a';
  g.fillRect(toPx(-24), toPx(-24), 48 * pxPerMeter, 48 * pxPerMeter);
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  for (let i = 0; i <= 6; i++) {
    g.beginPath(); g.moveTo(toPx(-24 + i * 8), toPx(-24)); g.lineTo(toPx(-24 + i * 8), toPx(24)); g.stroke();
    g.beginPath(); g.moveTo(toPx(-24), toPx(-24 + i * 8)); g.lineTo(toPx(24), toPx(-24 + i * 8)); g.stroke();
  }
  // beach sand on the east edge, then the ground texture ends at the water line
  g.fillStyle = '#e8d39a';
  g.fillRect(toPx(plan.beachX0), 0, (half - plan.beachX0) * pxPerMeter, S);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 40; i++) {
    const y = (i / 40) * S;
    g.fillRect(toPx(plan.beachX0) + 4, y, (half - plan.beachX0) * pxPerMeter - 8, 2);
  }
  return c;
}

// Small water texture, tiled and scrolled slowly for a living sea.
export function makeWaterCanvas() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2e7fb8';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.12})`;
    const x = Math.random() * 256, y = Math.random() * 256;
    g.fillRect(x, y, 8 + Math.random() * 22, 2);
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = 'rgba(10,60,110,0.25)';
    g.fillRect(Math.random() * 256, Math.random() * 256, 30 + Math.random() * 60, 3);
  }
  return c;
}
