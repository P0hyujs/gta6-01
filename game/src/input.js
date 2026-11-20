// Keyboard and mouse input for Solmar: WASD + arrows, Shift to run, Space to
// jump, E to interact, F to punch, Esc to pause, M to mute. The mouse drags
// the third-person camera around the player.

export function createInput() {
  const keys = new Set();
  const input = {
    forward: false, back: false, left: false, right: false,
    run: false, jump: false,
    camYawDelta: 0, camPitchDelta: 0,
    interactPressed: false, punchPressed: false, pausePressed: false, mutePressed: false,
  };
  let dragging = false;
  let lastX = 0, lastY = 0;

  function refresh() {
    input.forward = keys.has('KeyW') || keys.has('ArrowUp');
    input.back = keys.has('KeyS') || keys.has('ArrowDown');
    input.left = keys.has('KeyA') || keys.has('ArrowLeft');
    input.right = keys.has('KeyD') || keys.has('ArrowRight');
    input.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    input.jump = keys.has('Space');
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyE') input.interactPressed = true;
    if (e.code === 'KeyF') input.punchPressed = true;
    if (e.code === 'Escape') input.pausePressed = true;
    if (e.code === 'KeyM') input.mutePressed = true;
    refresh();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    refresh();
  });
  window.addEventListener('blur', () => {
    keys.clear();
    refresh();
  });

  const canvas = document.getElementById('game-canvas');
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    input.camYawDelta += (e.clientX - lastX) * 0.005;
    input.camPitchDelta += (e.clientY - lastY) * 0.004;
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });

  // One-shot flags are consumed by the game loop each frame.
  input.consume = () => {
    const out = {
      interact: input.interactPressed,
      punch: input.punchPressed,
      pause: input.pausePressed,
      mute: input.mutePressed,
    };
    input.interactPressed = false;
    input.punchPressed = false;
    input.pausePressed = false;
    input.mutePressed = false;
    return out;
  };
  input.consumeCamera = () => {
    const out = { yaw: input.camYawDelta, pitch: input.camPitchDelta };
    input.camYawDelta = 0;
    input.camPitchDelta = 0;
    return out;
  };
  return input;
}
