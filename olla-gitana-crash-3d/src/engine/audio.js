/* Motor de audio: rumba generativa (Web Audio) + efectos + canciones de la banda.
   Reglas del proyecto:
   - hit.mp3  -> SOLO golpes / pérdida de vida.
   - levelup_special.mp3 -> subidas de nivel, victoria.
   - recoger cosas -> pitido leve sintetizado (nunca un fichero de fallo).

   DECISIÓN DE MÚSICA (v3):
   - music.mp3 = la canción REAL de la banda ("Los Olla Gitana", 178 s): suena en
     el MENÚ, en la INTRO (plano del concierto) y en el CONCIERTO FINAL. Carga
     diferida (no bloquea el arranque), en bucle y con volumen bajo, por DEBAJO
     de los efectos (menú 0.32 · final 0.35 del bus de música).
   - Durante la PARTIDA manda la RUMBA GENERATIVA: es corta (32 pasos ≈ 9 s),
     no cansa al repetirse y responde al juego (intensidad 1/2 y modo aura).
     La canción real no se usa en los niveles justo por eso: perdería la
     dinámica de intensidad, y su mezcla original competiría con los sfx.

   MEZCLA (ganancias relativas, antes del master del usuario):
     master 0.7 · bus música 0.5 · bus sfx 0.9
     canción efectiva ≈ 0.32·0.5·0.7 = 0.112 (bien bajo la de un golpe: 0.3·0.9·0.7)
     duck (muerte/continue): el bus de música baja a 0.14 mientras dura la cinemática. */

const NOTES = { D2: 73.42, F2: 87.31, A2: 110.0, G2: 98.0, Bb2: 116.54, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, A3: 220.0, C4: 261.63, D4: 293.66, F4: 349.23, A4: 440.0 };

/* niveles de mezcla (un solo sitio para equilibrar música vs efectos) */
const MIX = {
  music: 0.5,       // bus de música (generativa + canción)
  sfx: 0.9,         // bus de efectos
  songMenu: 0.32,   // la canción de la banda en el menú / intro
  songFinal: 0.35,  // la canción en el concierto final
  songBajo: 0.20,   // canción de fondo bajo la despedida
  duck: 0.14        // bus de música agachado durante muerte/continue
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.volume = 0.7;
    this.buffers = {};
    this.music = { playing: false, timer: null, next: 0, step: 0, intensity: 0, aura: false, tempo: 104 };
    /* canción real de la banda (menuAudio se mantiene por compatibilidad interna) */
    this.song = { playing: false, src: null, vol: 0 };
    this.menuAudio = null;
    this.ducked = false;
    this._concertOn = false;     // modo concierto: suena LA CANCIÓN REAL (final del juego)
    this._wantSong = false;      // ¿alguien quiere la canción sonando? (carga diferida)
    this._songPendiente = null;
    this._prevSrc = null;        // copia anterior de la canción en fase de fundido de salida
    this._noise = null;
    this._lastSfx = {};
    this._stepN = 0;             // alterna el tono de los pasos
    this.log = [];               // historial corto de efectos reproducidos (lo lee QA)
  }

  init() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = MIX.music;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = MIX.sfx;
    this.sfxGain.connect(this.master);
    /* bus propio de la canción: permite fundidos y bajar el volumen sin tocar
       la rumba generativa (nunca suenan a la vez, pero así cada uno se regula solo) */
    this.songGain = this.ctx.createGain();
    this.songGain.gain.value = 0.0001;
    this.songGain.connect(this.musicGain);
    this.ready = true;
    return this.ctx;
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }
  setMuted(m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    // al quitar el mute, re-sincroniza el planificador para no soltar un racimo de notas
    if (!this.muted && this.ctx && this.music.playing) this.music.next = this.ctx.currentTime + 0.08;
  }
  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); if (this.master && !this.muted) this.master.gain.value = this.volume; }

  async loadSamples(map) {
    this.init();
    const entries = Object.entries(map);
    await Promise.all(entries.map(([key, url]) => this.loadSample(key, url)));
  }

  /* carga de UN sample (la canción de la banda la usa en diferido) */
  async loadSample(key, url) {
    this.init();
    try {
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      this.buffers[key] = await this.ctx.decodeAudioData(arr);
      // la canción de la banda: si alguien la pidió antes de terminar la descarga
      // (menú/intro/concierto), arranca ahora y retira el respaldo rumbero
      if (key === 'music') {
        if (typeof this.song.onLista === 'function') { try { this.song.onLista(); } catch (_) {} }
        if (this._wantSong && !this.song.playing) {
          this.playSong(this._songPendiente || {});
          this._songPendiente = null;
        }
      }
      return this.buffers[key];
    } catch (err) { console.warn('audio no cargado:', key, err); return null; }
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

  /* ---------- LA CANCIÓN REAL DE LA BANDA (menú, intro y concierto final) ---------- */
  get songPlaying() { return !!(this.song && this.song.playing); }

  /* arranca (o reajusta) la canción en bucle. Devuelve false si aún no está cargada. */
  playSong({ volume = MIX.songMenu, fade = 0.8, offset = 0 } = {}) {
    this.init();
    this._wantSong = true;
    if (!this.buffers.music) { this._songPendiente = { volume, fade, offset }; return false; }
    this._songPendiente = null;
    const t = this.ctx.currentTime;
    const g = this.songGain.gain;
    if (this.song.playing) {                  // ya suena: solo ajusta el volumen (sin cortes)
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(0.0001, g.value), t);
      g.linearRampToValueAtTime(Math.max(0.0001, volume), t + fade);
      this.song.vol = volume;
      return true;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.music;
    src.loop = true;
    src.connect(this.songGain);
    // si había una copia anterior con parada programada, se corta ya (evita
    // medio segundo con dos copias de la canción sonando a la vez)
    if (this._prevSrc) { try { this._prevSrc.stop(); } catch (_) {} this._prevSrc = null; }
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.linearRampToValueAtTime(Math.max(0.0001, volume), t + fade);
    src.start(t, Math.max(0, offset));
    src.onended = () => { if (this.song.src === src) { this.song.playing = false; this.song.src = null; } };
    this.song.src = src;
    this.song.playing = true;
    this.song.vol = volume;
    return true;
  }

  /* baja/sube el volumen de la canción sin pararla (despedida del final, etc.) */
  songVolume(v, fade = 0.6) {
    if (!this.song.playing || !this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.songGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(0.0001, g.value), t);
    g.linearRampToValueAtTime(Math.max(0.0001, v), t + fade);
    this.song.vol = v;
  }

  /* para la canción con fundido (corto: no debe chocar con el arranque de un nivel) */
  stopSong({ fade = 0.35 } = {}) {
    this._wantSong = false;
    this._songPendiente = null;
    if (!this.song.playing || !this.ctx) { this.menuAudio = null; return; }
    const s = this.song;
    const t = this.ctx.currentTime;
    s.playing = false;
    this.menuAudio = null;
    const g = this.songGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(0.0001, g.value), t);
    g.linearRampToValueAtTime(0.0001, t + fade);
    try { s.src.stop(t + fade + 0.05); } catch (_) {}
    this._prevSrc = s.src;
    s.src = null;
    s.vol = 0;
  }

  /* ---------- música del menú: la canción real de la banda ---------- */
  playMenuMusic() {
    this.init();
    this.duckMusic(false);         // el menú siempre a volumen normal
    this._stopGenRaw();
    this.playSong({ volume: MIX.songMenu, fade: 0.9, offset: 0 });
  }
  stopMenuMusic() { this.stopSong({ fade: 0.35 }); }

  /* ---------- rumba generativa ---------- */
  /* MODO CONCIERTO: el FINAL del juego toca LA CANCIÓN REAL DE LA BANDA.
     final.js llama a startGenerative/stopGenerative, así que aquí se intercepta
     esa llamada y se suena la canción (en bucle, volumen bajo y sin chocar con
     los sfx). La rumba generativa queda para los niveles. */
  setConcert(on) {
    this.init();
    const v = !!on;
    if (v === this._concertOn) { if (v) this.playSong({ volume: MIX.songFinal, fade: 0.8 }); return; }
    this._concertOn = v;
    this._stopGenRaw();          // en concierto NO suena la rumba generativa
    if (v) {
      this.duckMusic(false);     // el concierto suena a su volumen, sin duck
      if (this.buffers.music) { this.playSong({ volume: MIX.songFinal, fade: 0.9, offset: 0 }); return; }
      this.playSong({ volume: MIX.songFinal, fade: 0.9 });   // queda pedida: arranca al cargar
      // respaldo: si la canción aún no está lista (partida rápida), que el
      // concierto no se quede mudo mientras tanto: fondo rumbero suave
      this.music.playing = true;
      this.music.step = 0;
      this.music.intensity = 2;
      this.music.aura = true;
      this.music.next = this.ctx.currentTime + 0.08;
      this.music.timer = setInterval(() => this._schedule(), 25);
      // cuando la canción real esté lista, fuera la rumba de respaldo
      this.song.onLista = () => this._stopGenRaw();
    } else {
      this.song.onLista = null;
      this.stopSong({ fade: 0.45 });
    }
  }

  startGenerative({ intensity = 1, aura = false } = {}) {
    this.init();
    // en modo concierto manda LA CANCIÓN: no se arranca la rumba (final.js llama
    // a startGenerative al empezar el concierto; aquí se redirige a la canción)
    if (this._concertOn) { this.setConcert(true); return; }
    this.stopMenuMusic();          // menú/intro/final -> partida: fuera la canción
    this.duckMusic(false);         // cualquier arranque de música desagacha el bus
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
  /* parada cruda de la rumba (sin mirar el modo concierto) */
  _stopGenRaw() {
    if (this.music.timer) { clearInterval(this.music.timer); this.music.timer = null; }
    this.music.playing = false;
  }
  stopGenerative() {
    if (this._concertOn) {
      // en pleno concierto la música ES la canción: parar la "generativa" no
      // debe cortar el concierto (final.js llama a stopGenerative dentro de su
      // play()). Solo se para la rumba de respaldo si es la que suena.
      if (!this.song.playing) this._stopGenRaw();
      return;
    }
    this._stopGenRaw();
  }
  /* fin del concierto (lo llama main.js al terminar el final del juego) */

  /* agacha el bus de música (muerte / continue / carteles): la música sigue
     pero se aparta para que se lean los avisos y suenen los sfx */
  duckMusic(on) {
    this.ducked = !!on;
    if (!this.musicGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.musicGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(0.0001, g.value), t);
    g.linearRampToValueAtTime(this.ducked ? MIX.duck : MIX.music, t + (this.ducked ? 0.35 : 0.8));
  }

  stopAll() { this.stopGenerative(); this.stopSong({ fade: 0.3 }); }

  /* valores reales de mezcla (los lee el QA desde __qa.audio()) */
  debugInfo() {
    const g = (n) => (n && n.gain ? +n.gain.value.toFixed(3) : null);
    return {
      ctx: this.ctx ? this.ctx.state : 'none',
      muted: this.muted, volume: this.volume,
      master: g(this.master), musicBus: g(this.musicGain), sfxBus: g(this.sfxGain),
      cancionBus: g(this.songGain), ducked: !!this.ducked,
      generativa: { playing: this.music.playing, intensidad: this.music.intensity, aura: this.music.aura, paso: this.music.step },
      cancion: { playing: this.song.playing, vol: this.song.vol || null, cargada: !!this.buffers.music, pedida: !!this._wantSong }
    };
  }

  // 8th notes · 32 steps = 4 compases · Dm Gm A Dm
  _schedule() {
    if (!this.ctx) return;
    if (this.muted) return;        // en silencio no se programa nada (ahorra CPU)
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
    // registro para QA (independiente de que el audio esté listo o silenciado)
    this.log.push(name);
    if (this.log.length > 200) this.log.shift();
    if (!this.ready || this.muted) return;
    switch (name) {
      case 'jump': this.tone({ type: 'triangle', f0: 330, f1: 720, dur: 0.14, vol: 0.16 }); break;
      /* salpicadura del guiso al saltar (la olla va llena) */
      case 'splash': this.noise({ dur: 0.14, vol: 0.14, freq: 2100, sweep: 700, type: 'bandpass' }); this.tone({ type: 'sine', f0: 420, f1: 220, dur: 0.1, vol: 0.07 }); break;
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
      /* super-vida conseguida (al gastar la reserva también se reconoce) */
      case 'supervida': [659, 784, 988, 1319].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.2, vol: 0.17, delay: i * 0.075 })); break;
      /* moneda/nota especial de nivel nuevo desbloqueado */
      case 'unlock': [523, 659, 784].forEach((f, i) => this.tone({ type: 'sine', f0: f, dur: 0.26, vol: 0.16, delay: i * 0.1 })); this.tone({ type: 'triangle', f0: 1046, dur: 0.4, vol: 0.14, delay: 0.3 }); break;
      /* paso a fase 2/3 del jefe */
      case 'phaseup': this.tone({ type: 'sawtooth', f0: 150, f1: 420, dur: 0.5, vol: 0.2, filter: 1200 }); this.noise({ dur: 0.35, vol: 0.2, freq: 800, sweep: 2600, type: 'bandpass' }); break;
      /* el jefe cae (victoria de jefe) */
      case 'bossdown': this.noise({ dur: 1.0, vol: 0.4, freq: 1800, sweep: 90 }); [196, 165, 131].forEach((f, i) => this.tone({ type: 'square', f0: f, dur: 0.4, vol: 0.16, delay: i * 0.22 })); break;
      case 'levelup': this._playBuffer('levelup', { vol: 0.8 }); break;
      case 'victory': this._playBuffer('levelup', { vol: 0.9 }); break;
      /* ---- efectos nuevos (v2) ---- */
      /* salto largo (barrida + salto): silbido ascendente + golpe de aire */
      case 'longjump': this.tone({ type: 'triangle', f0: 380, f1: 1240, dur: 0.24, vol: 0.17 }); this.noise({ dur: 0.26, vol: 0.18, freq: 600, sweep: 3200, type: 'bandpass' }); break;
      /* aterrizaje fuerte (caída alta o pisotón): impacto grave + tierra */
      case 'hardland': this.tone({ type: 'sine', f0: 150, f1: 52, dur: 0.28, vol: 0.26 }); this.noise({ dur: 0.3, vol: 0.3, freq: 1400, sweep: 200 }); break;
      /* racha de notas encadenadas (combo x3+): campanilla corta y aguda */
      case 'combo': this.tone({ type: 'triangle', f0: 1174, dur: 0.07, vol: 0.12 }); this.tone({ type: 'triangle', f0: 1760, dur: 0.1, vol: 0.1, delay: 0.06 }); break;
      /* racha máxima (combo x5+): arpegio dorado más largo */
      case 'combohi': [1046, 1318, 1568, 2093].forEach((f, i) => this.tone({ type: 'square', f0: f, dur: 0.16, vol: 0.12, delay: i * 0.055 })); break;
      /* interruptor (!) pulsado: la puerta del final se abre */
      case 'gate': [392, 523].forEach((f, i) => this.tone({ type: 'square', f0: f, dur: 0.18, vol: 0.14, delay: i * 0.07 })); this.noise({ dur: 0.5, vol: 0.2, freq: 260, sweep: 1600, type: 'bandpass' }); break;
      /* puerta de salida abierta: dos golpes de aldaba + brillo */
      case 'door': this.tone({ type: 'square', f0: 196, f1: 150, dur: 0.16, vol: 0.2 }); this.tone({ type: 'square', f0: 196, f1: 150, dur: 0.2, vol: 0.18, delay: 0.14 }); this.tone({ type: 'triangle', f0: 1568, dur: 0.4, vol: 0.1, delay: 0.3 }); break;
      /* rugido del jefe al entrar / al cambiar de fase: grave + aire */
      case 'bossroar': this.tone({ type: 'sawtooth', f0: 110, f1: 62, dur: 0.55, vol: 0.22, filter: 700 }); this.tone({ type: 'square', f0: 74, f1: 48, dur: 0.7, vol: 0.16, delay: 0.05, filter: 500 }); this.noise({ dur: 0.6, vol: 0.22, freq: 900, sweep: 180 }); break;
      /* aviso: el jefe está VULNERABLE (salta encima) — ping agudo doble */
      case 'alert': this.tone({ type: 'triangle', f0: 1480, dur: 0.09, vol: 0.13 }); this.tone({ type: 'triangle', f0: 1976, dur: 0.12, vol: 0.11, delay: 0.1 }); break;
      /* telegrafía del golpe del jefe: subida corta y seca */
      case 'warn': this.tone({ type: 'square', f0: 300, f1: 220, dur: 0.1, vol: 0.1, filter: 900 }); break;
      /* ---- efectos nuevos (v3: los que faltaban de verdad) ---- */
      /* PASOS al correr: golpecito sordo y corto, alternando el pie (muy sutil,
         va colgado del polvo de player.onDust cada 0,12 s) */
      case 'step': {
        if (!this._throttle('step', 95)) break;
        const pie = (this._stepN = (this._stepN || 0) + 1) % 2 === 0;
        this.tone({ type: 'sine', f0: pie ? 108 : 92, f1: 54, dur: 0.055, vol: 0.055 });
        this.noise({ dur: 0.045, vol: 0.05, freq: 760, sweep: 320 });
        break;
      }
      /* ROCE continuo de la barrida (bajo la estela de chispas, sin tapar el 'slide') */
      case 'slideLoop': {
        if (!this._throttle('slideLoop', 70)) break;
        this.noise({ dur: 0.13, vol: 0.065, freq: 1900, sweep: 850, type: 'bandpass' });
        break;
      }
      /* IMPACTO contra caja de HIERRO/ACERO que no cede: campana metálica corta
         (se suma al golpe de madera, no lo sustituye: suena a metal hueco) */
      case 'clank': {
        if (!this._throttle('clank', 60)) break;
        this.tone({ type: 'square', f0: 1180, f1: 760, dur: 0.07, vol: 0.1, filter: 3200 });
        this.tone({ type: 'triangle', f0: 2360, dur: 0.15, vol: 0.07, delay: 0.012 });
        this.noise({ dur: 0.05, vol: 0.1, freq: 3600, sweep: 1500, type: 'bandpass' });
        break;
      }
      /* el hierro/acero CEDE: chatarra cayendo + golpe grave */
      case 'clankBreak': {
        this.tone({ type: 'square', f0: 1560, f1: 430, dur: 0.2, vol: 0.14, filter: 2600, delay: 0.04 });
        this.tone({ type: 'triangle', f0: 980, f1: 520, dur: 0.3, vol: 0.1, delay: 0.07 });
        this.noise({ dur: 0.32, vol: 0.2, freq: 3000, sweep: 500, type: 'bandpass' });
        break;
      }
      /* CRUZAR LA META (nivel normal, sin jefe): aldaba + acorde + clamor del público */
      case 'goal': {
        this.tone({ type: 'sine', f0: 523, dur: 0.2, vol: 0.14 });
        [659, 784, 1046].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.3, vol: 0.15, delay: 0.08 + i * 0.09 }));
        this.noise({ dur: 0.8, vol: 0.12, freq: 900, sweep: 2400, type: 'bandpass' });
        break;
      }
      /* el ESCUDO aguanta el golpe (antes sonaba una caja, que no pegaba nada) */
      case 'shieldBlock': {
        this.tone({ type: 'sine', f0: 1480, f1: 980, dur: 0.16, vol: 0.13 });
        this.tone({ type: 'triangle', f0: 2960, dur: 0.12, vol: 0.06, delay: 0.02 });
        this.noise({ dur: 0.2, vol: 0.11, freq: 1500, sweep: 3400, type: 'bandpass' });
        break;
      }
    }
  }
}

export const Audio = new AudioEngine();
