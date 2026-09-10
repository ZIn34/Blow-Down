// Tiny synthesized sound kit, so there are no audio files to load.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.last = {};
  }

  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 2;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch { this.ctx = null; return; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  // skip a sound if the same one played very recently
  gate(name, ms) {
    const now = performance.now();
    if (now - (this.last[name] || 0) < ms) return false;
    this.last[name] = now;
    return !!this.ctx;
  }

  env(node, t, attack, peak, decay) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  noiseBurst(t, dur, f0, f1, peak, type = 'lowpass') {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, 0.01, peak, dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.1);
  }

  tone(t, dur, f0, f1, peak, type = 'sine') {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, 0.005, peak, dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  boom() {
    if (!this.gate('boom', 50)) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, 1.2, 1400, 90, 0.9);
    this.tone(t, 0.7, 90, 32, 0.8);
  }

  rumble(k = 1) {
    if (!this.gate('rumble', 250)) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, 2.6, 380, 60, Math.min(0.9, 0.35 + k * 0.4));
  }

  glass() {
    if (!this.gate('glass', 120)) return;
    this.noiseBurst(this.ctx.currentTime, 0.35, 6000, 2500, 0.12, 'highpass');
  }

  beep(high = false) {
    if (!this.gate('beep', 60)) return;
    this.tone(this.ctx.currentTime, 0.14, high ? 1320 : 880, high ? 1320 : 880, 0.18, 'square');
  }

  click() {
    if (!this.gate('click', 30)) return;
    this.tone(this.ctx.currentTime, 0.05, 1800, 900, 0.12, 'triangle');
  }

  ding(i) {
    if (!this.ctx) return;
    this.tone(this.ctx.currentTime, 0.45, 880 * (1 + i * 0.26), 880 * (1 + i * 0.26), 0.2, 'triangle');
  }

  fail() {
    if (!this.gate('fail', 300)) return;
    this.tone(this.ctx.currentTime, 0.5, 220, 110, 0.25, 'sawtooth');
  }

  cheer() {
    if (!this.gate('cheer', 1000)) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, 2.2, 1800, 900, 0.18, 'bandpass');
  }
}
