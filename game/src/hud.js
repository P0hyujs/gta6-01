// The HUD: wanted stars, cash, health, mission tracker, speed, clock, banners,
// and the minimap — a live top-down map of Solmar drawn on a small canvas.

import { distance2D } from './rng.js';

let els = null;

export function initHud() {
  els = {
    hud: document.getElementById('hud'),
    stars: document.getElementById('wanted-stars'),
    cash: document.getElementById('cash'),
    health: document.getElementById('health-bar'),
    clock: document.getElementById('clock'),
    missionTitle: document.getElementById('mission-title'),
    missionText: document.getElementById('mission-text'),
    missionDist: document.getElementById('mission-dist'),
    speed: document.getElementById('speed'),
    banner: document.getElementById('banner'),
    message: document.getElementById('message'),
    hint: document.getElementById('hint'),
    damage: document.getElementById('damage'),
    minimap: document.getElementById('minimap'),
  };
  return els;
}

export function showHud(show) {
  els.hud.classList.toggle('hidden', !show);
}

let bannerTimer = 0;
export function showBanner(text, seconds = 2.6) {
  els.banner.textContent = text;
  els.banner.style.opacity = '1';
  bannerTimer = seconds;
}

export function showMessage(text, seconds = 3) {
  els.message.textContent = text;
  els.message.dataset.until = String(performance.now() + seconds * 1000);
}

export function showHint(text) {
  els.hint.textContent = text || '';
}

function formatClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function updateHud(G, dt) {
  const p = G.player;
  // wanted stars
  let stars = '';
  for (let i = 0; i < 5; i++) stars += `<span class="${i < G.wanted.level ? '' : 'off'}">★</span>`;
  els.stars.innerHTML = stars;
  els.cash.textContent = `$${p.cash.toLocaleString('en-US')}`;
  els.health.style.width = `${Math.max(0, p.health)}%`;
  els.clock.textContent = formatClock(G.clockMinutes);
  els.missionTitle.textContent = G.missionTitle;
  els.missionText.textContent = G.missionText;
  // distance to the current marker
  const target = G.markerTarget;
  if (target) {
    const d = Math.round(distance2D(p.x, p.z, target.x, target.z));
    els.missionDist.textContent = `${target.label} — ${d} m`;
  } else {
    els.missionDist.textContent = '';
  }
  const speedMph = p.onFoot ? Math.round(Math.abs(p.speed) * 2.24) : Math.round(Math.abs(p.car ? p.car.speed : 0) * 2.24);
  els.speed.textContent = String(speedMph);
  // banner fade
  if (bannerTimer > 0) {
    bannerTimer -= dt;
    if (bannerTimer <= 0) els.banner.style.opacity = '0';
  }
  // transient message expiry
  if (els.message.dataset.until && performance.now() > Number(els.message.dataset.until)) {
    els.message.textContent = '';
    delete els.message.dataset.until;
  }
  // damage vignette
  els.damage.style.opacity = p.health < 55 ? String((55 - p.health) / 55 * 0.9) : '0';
  drawMinimap(G);
}

function drawMinimap(G) {
  const ctx = els.minimap.getContext('2d');
  const S = 190;
  const half = 264;
  const toPx = (v) => ((v + half) / (half * 2)) * S;
  ctx.clearRect(0, 0, S, S);
  // ocean + beach
  ctx.fillStyle = '#2e7fb8';
  ctx.fillRect(toPx(216), 0, S - toPx(216), S);
  ctx.fillStyle = '#e8d39a';
  ctx.fillRect(toPx(216), 0, toPx(264) - toPx(216), S);
  // city base
  ctx.fillStyle = '#3a3f47';
  ctx.fillRect(0, 0, toPx(216), S);
  // streets
  ctx.strokeStyle = '#6a707c';
  ctx.lineWidth = 3;
  for (let i = -4; i <= 4; i++) {
    const p = toPx(i * 48);
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(S, p); ctx.stroke();
  }
  // plaza
  ctx.fillStyle = '#c47a4a';
  ctx.fillRect(toPx(-24), toPx(-24), toPx(24) - toPx(-24), toPx(24) - toPx(-24));
  // mission marker
  const target = G.markerTarget;
  if (target) {
    const x = toPx(target.x), y = toPx(target.z);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(x, y - 7); ctx.lineTo(x + 6, y + 5); ctx.lineTo(x - 6, y + 5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // traffic dots
  ctx.fillStyle = '#ffffff';
  for (const car of G.traffic) {
    ctx.fillRect(toPx(car.x) - 1.5, toPx(car.z) - 1.5, 3, 3);
  }
  // police dots
  for (const car of G.police) {
    ctx.fillStyle = '#ff4040';
    ctx.beginPath(); ctx.arc(toPx(car.x), toPx(car.z), 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // player arrow
  const px = toPx(G.player.x), py = toPx(G.player.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.heading);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  // north tick
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('N', 6, 13);
}
