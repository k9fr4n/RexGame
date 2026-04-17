// -----------------------------------------------------------------------------
// audio.js — procedural WebAudio SFX (no external asset).
// Exposes: new Sfx().jump() | slide() | pickup() | hit() | step() | ambient()
// -----------------------------------------------------------------------------
export class Sfx {
  constructor() { this.ctx = null; this.master = null; this.muted = false; }
  _ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
  }
  resume() { this._ensure(); if (this.ctx.state === 'suspended') this.ctx.resume(); }
  _tone({ freq = 440, dur = 0.15, type = 'sine', gain = 0.3, sweepTo = null, attack = 0.005, release = 0.1 }) {
    if (this.muted) return;
    this._ensure();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (sweepTo != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + release + 0.05);
  }
  _noise({ dur = 0.2, gain = 0.25, hp = 800, lp = 6000 }) {
    if (this.muted) return;
    this._ensure();
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = gain;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = (hp + lp) / 2; bp.Q.value = 0.7;
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
  }
  jump()   { this._tone({ freq: 420, sweepTo: 900, dur: 0.18, type: 'triangle', gain: 0.25 }); }
  slide()  { this._noise({ dur: 0.35, gain: 0.2, hp: 400, lp: 2000 }); }
  pickup() { this._tone({ freq: 880, sweepTo: 1760, dur: 0.12, type: 'square', gain: 0.18 });
            setTimeout(() => this._tone({ freq: 1320, sweepTo: 2200, dur: 0.1, type: 'square', gain: 0.18 }), 80); }
  hit()    { this._noise({ dur: 0.4, gain: 0.45, hp: 60, lp: 900 });
             this._tone({ freq: 180, sweepTo: 50, dur: 0.35, type: 'sawtooth', gain: 0.35 }); }
  step()   { this._tone({ freq: 140, sweepTo: 80, dur: 0.05, type: 'sine', gain: 0.08 }); }
  toggle() { this.muted = !this.muted; return this.muted; }
}
