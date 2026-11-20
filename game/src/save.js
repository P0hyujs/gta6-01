// Save and load for Solmar: cash, mission progress, position and health,
// kept in localStorage so a run survives a closed tab.

const SAVE_KEY = 'solmar-save-v1';

export function saveGame(G) {
  try {
    const data = {
      version: 1,
      cash: G.player.cash,
      health: G.player.health,
      missionIndex: G.missionState.index,
      missionStep: G.missionState.step,
      x: G.player.x,
      z: G.player.z,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}

export function applySave(G, data) {
  G.player.cash = data.cash ?? 0;
  G.player.health = data.health ?? 100;
  G.missionState.index = data.missionIndex ?? 0;
  G.missionState.step = data.missionStep ?? 0;
  G.player.x = data.x ?? 0;
  G.player.z = data.z ?? 24;
  G.player.parts.group.position.set(G.player.x, 0, G.player.z);
}
