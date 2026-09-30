/* Motor de audio: rumba generativa (Web Audio) + efectos + canciones de la banda.
   Reglas del proyecto:
   - hit.mp3  -> SOLO golpes / pérdida de vida.
   - levelup_special.mp3 -> subidas de nivel, victoria.
   - recoger cosas -> pitido leve sintetizado (nunca un fichero de fallo). */

const NOTES = { D2: 73.42, F2: 87.31, A2: 110.0, G2: 98.0, Bb2: 116.54, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, A3: 220.0, C4: 261.63, D4: 293.66, F4: 349.23, A4: 440.0 };

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.volume = 0.7;
    this.buffers = {};
    this.music = { playing: false, timer: null, next: 0, step: 0, intensity: 0, aura: false, tempo: 104 };
    this.menuAudio = null;
    this._noise = null;
    this._lastSfx = {};
  }

  init() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
    this.ready = true;
    return this.ctx;
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }
  setMuted(m) { this.muted = !!m; if (this.master) this.master.gain.value = this.muted ? 0 : this.volume; }
  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); if (this.master && !this.muted) this.master.gain.value = this.volume; }

  async loadSamples(map) {
    this.init();
    const entries = Object.entries(map);
    await Promise.all(entries.map(async ([key, url]) => {
      try {
        const res = await fetch(url);
        const arr = await res.arrayBuffer();
        this.buffers[key] = await this.ctx.decodeAudioData(arr);
      } catch (err) { console.warn('audio no cargado:', key, err); }
    }));
  }

  _playBuffer(key, { vol = 1, rate = 1, loop = false, dest = null } = {}) {
    const buf = this.buffers[key];
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = loop; src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(dest || this.sfxGain);
    src.start();
    return { src, g };
  }

  /* ---------- música del menú: la canción real de la banda ---------- */
  playMenuMusic() {
    this.init();
    this.stopGenerative();
    if (!this.menuAudio && this.buffers.music) {
      this.menuAudio = this._playBuffer('music', { vol: 0.55, loop: true, dest: this.musicGain });
    } else if (this.menuAudio) {
      try { this.menuAudio.src.start(); } catch (_) {}
    }
  }
  stopMenuMusic() { if (this.menuAudio) { try { this.menuAudio.src.stop(); } catch (_) {} this.menuAudio = null; } }

  /* ---------- rumba generativa ---------- */
  startGenerative({ intensity = 1, aura = false } = {}) {
    this.init();
    this.stopMenuMusic();
    if (this.music.playing) { this.music.intensity = intensity; this.music.aura = aura; return; }
    this.music.playing = true;
    this.music.step = 0;
    this.music.intensity = intensity;
    this.music.aura = aura;
    this.music.next = this.ctx.currentTime + 0.08;
    this.music.timer = setInterval(() => this._schedule(), 25);
  }
  setIntensity(n) { this.music.intensity = n; }
  setAura(on) { this.music.aura = !!on; }
  stopGenerative() {
    if (this.music.timer) { clearInterval(this.music.timer); this.music.timer = null; }
    this.music.playing = false;
  }
  stopAll() { this.stopGenerative(); this.stopMenuMusic(); }

  // 8th notes · 32 steps = 4 compases · Dm Gm A Dm
  _schedule() {
    if (!this.ctx) return;
    const spb = 60 / (this.music.tempo * (this.music.aura ? 1.22 : 1));
    const stepDur = spb / 2;
    const ahead = this.ctx.currentTime + 0.14;
    let guard = 0;
    while (this.music.next < ahead && guard++ < 64) {
      this._step(this.music.step % 32, this.music.next, stepDur, this.music.intensity, this.music.aura);
      this.music.step++;
      this.music.next += stepDur;
    }
  }

  _step(s, t, d, inten, aura) {
    const kickPat = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 0];
    const clapPat = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0];
    const shkPat  = [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1];
    const bars = [[NOTES.D2, NOTES.F2, NOTES.A2], [NOTES.G2, NOTES.Bb2, NOTES.D3], [NOTES.A2, NOTES.C3, NOTES.E3], [NOTES.D2, NOTES.F2, NOTES.A3]];
    const bar = Math.floor(s / 8) % 4;
    const chord = bars[bar];

    if (kickPat[s]) this._kick(t, 0.9);
    if (inten >= 1 && clapPat[s]) this._clap(t, 0.5);
    if (inten >= 1 && shkPat[s]) this._shaker(t, s % 2 === 0 ? 0.10 : 0.16);
    // bajo rumbero: fundamental con empujes
    const bassPat = [1, 0, 0, 1, 0, 1, 0, 0];
    if (bassPat[s % 8]) this._bass(chord[0] / 2, t, d * 1.6, 0.5);
    if (inten >= 2) {
      // guitarra: arpegio en contratiempo
      const idx = [1, 2, 0, 2, 1, 2, 0, 1][s % 8];
      if (s % 2 === 1) this._pluck(chord[idx] * 2, t, 0.16, aura ? 0.30 : 0.22, aura);
      if (aura && s % 8 === 4) this._pluck(chord[2] * 4, t, 0.2, 0.20, true);
    }
    if (aura && s % 4 === 0) this._lead(chord[2] * 2, t, d * 1.2, 0.16);
  }

  _kick(t, v) {
    const o = this.ctx.createOscillator(); o.type = 'sine';
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 0.3);
  }
  _clap(t, v) {
    const n = this._noiseBuf();
    const src = this.ctx.createBufferSource(); src.buffer = n;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1600; f.Q.value = 0.9;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(f); f.connect(g); g.connect(this.musicGain); src.start(t); src.stop(t + 0.2);
  }
  _shaker(t, v) {
    const n = this._noiseBuf();
    const src = this.ctx.createBufferSource(); src.buffer = n;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(f); f.connect(g); g.connect(this.musicGain); src.start(t); src.stop(t + 0.12);
  }
  _bass(freq, t, dur, v) {
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    const o2 = this.ctx.createOscillator(); o2.type = 'sine';
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(420, t); f.frequency.exponentialRampToValueAtTime(180, t + dur * 0.8);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.frequency.value = freq; o2.frequency.value = freq / 2;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.musicGain);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  _pluck(freq, t, dur, v, drive) {
    const o = this.ctx.createOscillator(); o.type = drive ? 'square' : 'triangle';
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = drive ? 2400 : 3200;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.frequency.value = freq;
    o.connect(f); f.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  _lead(freq, t, dur, v) {
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq * 2; f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.frequency.setValueAtTime(freq, t); o.frequency.linearRampToValueAtTime(freq * 1.01, t + dur);
    o.connect(f); f.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  _noiseBuf() {
    if (this._noise) return this._noise;
    const len = Math.floor(this.ctx.sampleRate * 0.4);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;
    return buf;
  }

  /* ---------- efectos ---------- */
  _throttle(key, ms) {
    const now = performance.now();
    if (this._lastSfx[key] && now - this._lastSfx[key] < ms) return false;
    this._lastSfx[key] = now; return true;
  }

  tone({ type = 'triangle', f0 = 440, f1 = null, dur = 0.09, vol = 0.14, delay = 0, attack = 0.004, filter = 0, q = 1 }) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); o.type = type;
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) { const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; f.Q.value = q; o.connect(f); node = f; }
    node.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.06);
  }

  noise({ dur = 0.2, vol = 0.3, freq = 1200, type = 'lowpass', sweep = null }) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this._noiseBuf();
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(80, sweep), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t); src.stop(t + dur + 0.05);
  }

  sfx(name) {
    if (!this.ready || this.muted) return;
    switch (name) {
      case 'jump': this.tone({ type: 'triangle', f0: 330, f1: 720, dur: 0.14, vol: 0.16 }); break;
      case 'doublejump': this.tone({ type: 'triangle', f0: 520, f1: 1040, dur: 0.14, vol: 0.16 }); break;
      case 'spin': this.noise({ dur: 0.22, vol: 0.22, freq: 900, sweep: 3600, type: 'bandpass' }); break;
      case 'land': this.tone({ type: 'sine', f0: 180, f1: 90, dur: 0.09, vol: 0.12 }); break;
      case 'slide': this.noise({ dur: 0.3, vol: 0.16, freq: 1400, sweep: 500, type: 'bandpass' }); break;
      case 'crate': this.noise({ dur: 0.16, vol: 0.3, freq: 900, sweep: 300 }); this.tone({ type: 'triangle', f0: 190, f1: 90, dur: 0.12, vol: 0.14 }); break;
      case 'bounce': this.tone({ type: 'sine', f0: 300, f1: 900, dur: 0.16, vol: 0.2 }); this.tone({ type: 'sine', f0: 900, f1: 380, dur: 0.18, vol: 0.14, delay: 0.1 }); break;
      case 'note': if (this._throttle('note', 45)) this.tone({ type: 'triangle', f0: 880, f1: 1244, dur: 0.07, vol: 0.12 }); break;
      case 'noteHi': if (this._throttle('noteHi', 60)) { this.tone({ type: 'triangle', f0: 1046, dur: 0.06, vol: 0.12 }); this.tone({ type: 'triangle', f0: 1568, dur: 0.08, vol: 0.1, delay: 0.05 }); } break;
      case 'mask': [784, 988, 1319].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.14, vol: 0.16, delay: i * 0.07 })); break;
      case 'aura': [523, 659, 784, 1046, 1319].forEach((f, i) => this.tone({ type: 'square', f0: f, dur: 0.22, vol: 0.13, delay: i * 0.08 })); break;
      case 'checkpoint': [659, 880, 1319].forEach((f, i) => this.tone({ type: 'sine', f0: f, dur: 0.24, vol: 0.15, delay: i * 0.09 })); break;
      case 'heart': [523, 784, 1046, 1319].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.18, vol: 0.17, delay: i * 0.08 })); break;
      case 'tnt': this.tone({ type: 'square', f0: 1600, dur: 0.05, vol: 0.1 }); break;
      case 'boom': this.noise({ dur: 0.6, vol: 0.45, freq: 1400, sweep: 120 }); this.tone({ type: 'sine', f0: 120, f1: 40, dur: 0.5, vol: 0.3 }); break;
      case 'throw': this.noise({ dur: 0.18, vol: 0.16, freq: 700, sweep: 1900, type: 'bandpass' }); break;
      case 'wave': this.tone({ type: 'sawtooth', f0: 90, f1: 240, dur: 0.7, vol: 0.2, filter: 600 }); break;
      case 'phase': this.tone({ type: 'square', f0: 220, dur: 0.18, vol: 0.16 }); this.tone({ type: 'square', f0: 330, dur: 0.18, vol: 0.14, delay: 0.1 }); this.tone({ type: 'square', f0: 440, dur: 0.24, vol: 0.14, delay: 0.2 }); break;
      case 'pause': this.tone({ type: 'sine', f0: 660, f1: 330, dur: 0.12, vol: 0.14 }); break;
      case 'ui': this.tone({ type: 'triangle', f0: 720, dur: 0.06, vol: 0.1 }); break;
      case 'damage': this._playBuffer('hit', { vol: 0.75 }); break;
      case 'death': this._playBuffer('hit', { vol: 0.9, rate: 0.85 }); break;
      /* máscara rota: crujido de madera + caída */
      case 'maskBreak': this.noise({ dur: 0.22, vol: 0.3, freq: 1600, sweep: 260, type: 'bandpass' }); this.tone({ type: 'triangle', f0: 320, f1: 120, dur: 0.22, vol: 0.16 }); break;
      /* continue: barrido ascendente de "vuelves a la carga" */
      case 'continue': [392, 523, 659, 784].forEach((f, i) => this.tone({ type: 'square', f0: f, dur: 0.2, vol: 0.14, delay: i * 0.09 })); this.noise({ dur: 0.5, vol: 0.12, freq: 400, sweep: 3000, type: 'bandpass' }); break;
      /* game over: descenso grave y largo */
      case 'gameover': [440, 392, 330, 262, 196].forEach((f, i) => this.tone({ type: 'sawtooth', f0: f, dur: 0.34, vol: 0.16, delay: i * 0.18, filter: 900 })); this.tone({ type: 'sine', f0: 98, f1: 60, dur: 1.4, vol: 0.22, delay: 0.5 }); break;
      /* super-vida conseguida */
      case 'supervida': [659, 784, 988, 1319].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.2, vol: 0.17, delay: i * 0.075 })); break;
      /* moneda/nota especial de nivel nuevo desbloqueado */
      case 'unlock': [523, 659, 784].forEach((f, i) => this.tone({ type: 'sine', f0: f, dur: 0.26, vol: 0.16, delay: i * 0.1 })); this.tone({ type: 'triangle', f0: 1046, dur: 0.4, vol: 0.14, delay: 0.3 }); break;
      /* paso a fase 2/3 del jefe */
      case 'phaseup': this.tone({ type: 'sawtooth', f0: 150, f1: 420, dur: 0.5, vol: 0.2, filter: 1200 }); this.noise({ dur: 0.35, vol: 0.2, freq: 800, sweep: 2600, type: 'bandpass' }); break;
      /* el jefe cae (victoria de jefe) */
      case 'bossdown': this.noise({ dur: 1.0, vol: 0.4, freq: 1800, sweep: 90 }); [196, 165, 131].forEach((f, i) => this.tone({ type: 'square', f0: f, dur: 0.4, vol: 0.16, delay: i * 0.22 })); break;
      case 'levelup': this._playBuffer('levelup', { vol: 0.8 }); break;
      case 'victory': this._playBuffer('levelup', { vol: 0.9 }); break;
    }
  }
}

export const Audio = new AudioEngine();
