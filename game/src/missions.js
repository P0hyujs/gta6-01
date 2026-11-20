// The story of SOLMAR — Streets of Gold: four jobs for wheelman Danny Reyes.
// Each mission is a list of steps; a step is done by arriving at its marker,
// and some steps ask for a key press (E) at the marker. The module only holds
// the data and the small state machine — the game loop drives it.

export const MISSIONS = [
  {
    id: 'wheelman',
    title: 'JOB 1 — THE WHEELMAN',
    briefing: 'Your first job. Any car on the street is yours — take one and make it move.',
    reward: 200,
    steps: [
      { text: 'Steal a car — walk up to any parked car and press E', kind: 'steal', target: null },
    ],
  },
  {
    id: 'package',
    title: 'JOB 2 — THE PACKAGE',
    briefing: 'A package is waiting at the plaza. Pick it up, then run it to the safehouse. The cops will not like it.',
    reward: 500,
    steps: [
      { text: 'Pick up the package at the plaza fountain', kind: 'interact', target: { x: 14, z: 14, label: 'Package' }, radius: 4 },
      { text: 'Deliver the package to the safehouse — watch for the law', kind: 'arrive', target: { x: -180, z: 120, label: 'Safehouse' }, radius: 7, onStart: 'hot' },
    ],
  },
  {
    id: 'heat',
    title: 'JOB 3 — LOSE THE HEAT',
    briefing: 'Three stars and every cruiser in Solmar is on your tail. Lose them. Hide, weave, outrun.',
    reward: 750,
    steps: [
      { text: 'Lose the cops — get your wanted level back to zero', kind: 'loseheat', target: null },
    ],
  },
  {
    id: 'score',
    title: 'JOB 4 — THE BIG SCORE',
    briefing: 'Solmar Bank, high noon. Grab the gold, then run for the marina. This is the one, Danny.',
    reward: 2000,
    steps: [
      { text: 'Get to Solmar Bank and grab the gold (press E at the door)', kind: 'interact', target: { x: 60, z: 74, label: 'Solmar Bank' }, radius: 5 },
      { text: 'Escape to the marina pier — do not get caught', kind: 'arrive', target: { x: 292, z: 120, label: 'Marina' }, radius: 9, onStart: 'hot' },
    ],
  },
];

export function createMissionState() {
  return { index: 0, step: 0, done: false, storyComplete: false };
}

export function currentMission(state) {
  return MISSIONS[state.index] ?? null;
}

export function currentStep(state) {
  const m = currentMission(state);
  return m ? m.steps[state.step] ?? null : null;
}

// Advance one step. Returns { completed: 'mission'|'story'|null, reward }.
export function advanceStep(state) {
  const m = currentMission(state);
  if (!m) return { completed: null, reward: 0 };
  state.step += 1;
  if (state.step >= m.steps.length) {
    const reward = m.reward;
    state.index += 1;
    state.step = 0;
    if (state.index >= MISSIONS.length) {
      state.done = true;
      state.storyComplete = true;
      return { completed: 'story', reward };
    }
    return { completed: 'mission', reward };
  }
  return { completed: null, reward: 0 };
}

export function missionProgressText(state) {
  const m = currentMission(state);
  if (!m) return 'Free roam — Solmar is yours, Danny.';
  return `${m.title} — ${m.steps[state.step]?.text ?? ''}`;
}
