// Sound of Solmar, all synthesised with WebAudio — no audio files are shipped.
// Engine hum follows speed, sirens wail when the PD is near, and little blips
// mark pickups, punches and mission wins.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
  }

  // Must be called from a user gesture (the Start button).
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    // engine: sawtooth through a low-pass, pitch follows speed
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter).connect(this.engineGain).connect(this.ctx.destination);
    this.engineOsc.start();
    // siren: triangle that wails between two tones
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
    this.sirenOsc.start();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.engineGain) this.engineGain.gain.value = 0;
    if (this.sirenGain) this.sirenGain.gain.value = 0;
  }

  // Called every frame: speed01 0..1, siren 0..1 intensity, time seconds.
  update(speed01, siren, time) {
    if (!this.ctx || this.muted) return;
    if (this.engineOsc) {
      this.engineOsc.frequency.value = 55 + speed01 * 130;
      this.engineGain.gain.value = 0.028 + speed01 * 0.05;
    }
    if (this.sirenOsc) {
      this.sirenOsc.frequency.value = 720 + Math.sin(time * 5.2) * 260;
      this.sirenGain.gain.value = siren * 0.035;
    }
  }

  blip(freq = 880, dur = 0.12, type = 'sine', vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start();
    o.stop(this.ctx.currentTime + dur);
  }

  thud() {
    this.blip(90, 0.18, 'square', 0.2);
  }

  jingle() {
    if (!this.ctx || this.muted) return;
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.22, 'triangle', 0.14), i * 110);
    });
  }
}
