// Tiny procedural soundtrack + SFX. No assets, everything synthesised.
// Uses a lookahead scheduler so timing survives tab throttling better than
// scheduling notes per animation frame.

const SCALES = {
  minor: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9],
  phrygian: [0, 1, 3, 5, 7, 8],
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.playing = false;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
    this.track = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.24;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.32;
    this.sfxGain.connect(this.master);
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.value = on ? 0.24 : 0;
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.sfxGain) this.sfxGain.gain.value = on ? 0.32 : 0;
  }

  // ---- helpers -----------------------------------------------------------
  tone(freq, dur, type, gain, dest, slideTo, delay = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(dest || this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, gain, dest, hp = 800, delay = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(dest || this.sfxGain);
    src.start(t0);
  }

  // ---- sfx ---------------------------------------------------------------
  jump() {
    if (!this.ctx || !this.sfxOn) return;
    this.tone(520, 0.07, 'square', 0.16, null, 880);
  }
  orb() {
    if (!this.ctx || !this.sfxOn) return;
    this.tone(760, 0.12, 'triangle', 0.2, null, 1420);
  }
  pad() {
    if (!this.ctx || !this.sfxOn) return;
    this.tone(300, 0.16, 'sawtooth', 0.16, null, 1200);
  }
  portal() {
    if (!this.ctx || !this.sfxOn) return;
    this.tone(220, 0.28, 'sine', 0.2, null, 880);
    this.tone(440, 0.22, 'triangle', 0.1, null, 1320, 0.02);
  }
  die() {
    if (!this.ctx || !this.sfxOn) return;
    this.noise(0.34, 0.5, null, 300);
    this.tone(180, 0.3, 'sawtooth', 0.26, null, 40);
  }
  win() {
    if (!this.ctx || !this.sfxOn) return;
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.2, null, null, i * 0.1));
  }
  click() {
    if (!this.ctx || !this.sfxOn) return;
    this.tone(880, 0.05, 'square', 0.1);
  }

  // ---- music -------------------------------------------------------------
  // Each level gets a bpm + scale + bassline; the sequencer jams over it.
  start(track) {
    this.init();
    if (!this.ctx) return;
    this.track = track;
    this.step = 0;
    this.playing = true;
    this.nextTime = this.ctx.currentTime + 0.08;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    this.playing = false;
  }

  schedule() {
    if (!this.ctx || !this.playing || !this.track) return;
    const spb = 60 / this.track.bpm / 4; // 16th note
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(step, time, spb) {
    const t = this.track;
    const delay = Math.max(0, time - this.ctx.currentTime);
    const dest = this.musicGain;
    if (!this.musicOn) return;
    const scale = SCALES[t.scale] || SCALES.minor;
    const root = t.root || 55;

    // drums
    if (step % 16 === 0 || step % 16 === 10) {
      this.tone(120, 0.16, 'sine', 0.55, dest, 45, delay);
    }
    if (step % 16 === 8 || step % 16 === 14) {
      this.noise(0.1, 0.22, dest, 1400, delay);
    }
    if (step % 4 === 2) this.noise(0.03, 0.08, dest, 6000, delay);

    // bass
    if (step % 2 === 0) {
      const b = t.bass[Math.floor(step / 4) % t.bass.length];
      this.tone(root * Math.pow(2, b / 12), spb * 1.7, 'sawtooth', 0.2, dest, null, delay);
    }

    // lead arpeggio
    const arp = t.arp[(step * 3) % t.arp.length];
    if (step % 2 === 1 || step % 8 < 4) {
      const semi = scale[arp % scale.length] + 12 * Math.floor(arp / scale.length) + 24;
      this.tone(root * 4 * Math.pow(2, semi / 12), spb * 0.9, 'square', 0.07, dest, null, delay);
    }
  }
}

export const TRACKS = {
  neon: { bpm: 140, root: 55, scale: 'minor', bass: [0, 0, 7, 5, 0, 3, 7, 10], arp: [0, 2, 1, 3, 2, 4, 1, 0, 3, 1, 4, 2] },
  shift: { bpm: 128, root: 49, scale: 'dorian', bass: [0, 5, 3, 7, 0, 8, 7, 5], arp: [1, 3, 0, 4, 2, 0, 3, 1, 4, 2, 0, 3] },
  hyper: { bpm: 168, root: 58, scale: 'phrygian', bass: [0, 0, 1, 0, 8, 7, 1, 3], arp: [0, 3, 1, 4, 1, 3, 0, 2, 4, 1, 3, 0] },
};
