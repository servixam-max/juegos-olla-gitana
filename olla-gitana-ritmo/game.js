/**
 * Olla Gitana: El Ritmo — motor del juego
 * Notas al ritmo de "Los Olla Gitana" (beatmap generado con librosa).
 * Vanilla JS + Canvas. Mobile-first: 4 carriles táctiles + teclado.
 */
'use strict';

/* ---------------- Assets / configuración ---------------- */
const BACKGROUNDS = [
  'assets/bg_1.jpg', 'assets/bg_2.jpg', 'assets/bg_3.jpg', 'assets/bg_4.jpg', 'assets/bg_5.jpg',
  'assets/bg_6.jpg', 'assets/bg_7.jpg', 'assets/bg_8.jpg', 'assets/bg_9.jpg', 'assets/bg_10.jpg',
  'assets/bg_11.jpg', 'assets/bg_12.jpg', 'assets/bg_13.jpg', 'assets/bg_14.jpg'
];

const LANES = 4;
const LANE_EMOJI = ['🍐', '🌿', '🧆', '🌶️'];     // ingrediente por carril
const TRAP_EMOJI = ['💊', '💉', '🚬', '🦂'];       // trampas (según dificultad)
const SPECIAL_ZARANGOLLO = '🥘';
const GOOD_HITS = ['¡Toma!', '¡Ole!', '¡Acho!', '¡Dale!', '¡Rico!', '¡Ñam!', '¡Sabor!', '¡Murcia!', '¡Huerta!', '¡Fresco!'];
const PHRASES_END = ['¡Ojete calor!', '¡Menudo pijo!', '¡Gambitero!', '¡Te has quedao pajarito!', '¡Acho, pijo, huevo!', '¡Se te ha ido la olla!'];

const DIFF = {
  easy:   { label: 'FÁCIL 🐢',   scroll: 0.42, window: 0.175, trapChance: 0.10, scoreMiss: 0, lives: 3 },
  normal: { label: 'NORMAL 🥘',  scroll: 0.60, window: 0.135, trapChance: 0.17, scoreMiss: 0, lives: 3 },
  hard:   { label: 'CANALLA 🔥', scroll: 0.80, window: 0.105, trapChance: 0.26, scoreMiss: 0, lives: 2 }
};

const KEYMAP = { d: 0, f: 1, j: 2, k: 3, arrowleft: 0, arrowdown: 1, arrowup: 2, arrowright: 3 };

/* Velocidad de caída de las notas (multiplica el scroll de la dificultad) */
const SPEED_MULT = { slow: 0.72, normal: 1.0, fast: 1.35 };
let noteSpeed = 'normal';
let nivelRitmo = 1;            // sube con la puntuación: acelera las notas
let zenMode = false;             // sin trampas ni vidas: modo práctica

const STORAGE_KEY = 'olla_gitana_ritmo_scores_v1';

/* ---------------- Estado ---------------- */
const FPS_HINT = 60;
let audio = null;          // HTMLAudioElement (music.mp3)
let sfx = { hit: null, level: null };
let beatmap = null;        // {bpm, duration, notes:[{t,lane,s}]}
let notes = [];            // notas de la partida en curso (con estado)
let running = false, paused = false, finished = false;
let difficulty = 'normal';
let startedAt = 0, songTime = 0, rafId = 0, lastFrame = 0;
let score = 0, lives = 3, combo = 0, maxCombo = 0, mult = 1;
let perfect = 0, good = 0, miss = 0, hitsCount = 0, judged = 0;
let bgIndex = -1, lastBgChange = -1;
let laneFlash = [0, 0, 0, 0];
let laneRipple = [0, 0, 0, 0];
let popups = [];            // textos flotantes {x,y,text,life,color,size}
let particles = [];         // chispas al acertar {x,y,vx,vy,life,color,r}
let judgePulse = 0;         // pulso de la línea de juicio al golpear
let countdownBeeps = [false, false, false];   // pitidos 3-2-1 del arranque
let shake = 0;
let soundOn = true;
let bgImg = null, bgLoaded = -1;
let vibrateOk = true;

/* Vibración suave en móvil (algunos navegadores no la soportan) */
function buzz(ms) {
  if (!vibrateOk || !soundOn) return;
  try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { vibrateOk = false; }
}

/* Chispas de color al acertar una nota */
function spark(x, y, color, n = 10) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 90 + Math.random() * 210;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.45 + Math.random() * 0.35, color, r: 2 + Math.random() * 3.2 });
  }
}

/* ---------------- Canvas ---------------- */
const stage = document.getElementById('stage');
const ctx = stage.getContext('2d');
let W = 0, H = 0, DPR = 1;
let laneW = 0, judgeY = 0, noteH = 0, noteW = 0;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  stage.width = Math.floor(W * DPR); stage.height = Math.floor(H * DPR);
  stage.style.width = W + 'px'; stage.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  laneW = W / LANES;
  judgeY = H - Math.max(88, H * 0.14);
  noteH = Math.max(26, Math.min(46, H * 0.062));
  noteW = Math.min(laneW * 0.78, 132);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 220));

/* ---------------- Utilidades ---------------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const laneCenter = i => laneW * i + laneW / 2;

function el(id) { return document.getElementById(id); }
function show(node) { node.classList.remove('hidden'); }
function hide(node) { node.classList.add('hidden'); }

let toastTimer = 0;
function toast(msg, ms = 1600) {
  const t = el('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function popup(x, y, text, color = '#fff', size = 26) {
  popups.push({ x, y, text, color, size, life: 1 });
}


/* ---------------- Preferencias del jugador (nombre, sonido) ---------------- */
const PREFS_KEY = 'olla_prefs_v1';
function loadPrefs() { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch (e) { return {}; } }
function savePref(name, sound, extra) {
  try {
    const p = loadPrefs();
    if (name !== undefined) p.name = name;
    if (sound !== undefined) p.sound = sound;
    if (extra) Object.assign(p, extra);          // p.ej. {speed, zen} del ritmo
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch (e) {}
}
function ollaPrefs() { return loadPrefs(); }

/* ---------------- Audio ---------------- */
function initAudio() {
  if (audio) return;
  audio = new Audio('assets/music.mp3');
  audio.preload = 'auto';
  audio.volume = 0.85;
  sfx.hit = new Audio('assets/hit.mp3'); sfx.hit.volume = 0.5; sfx.hit.preload = 'auto';
  sfx.level = new Audio('assets/levelup_special.mp3'); sfx.level.volume = 0.6; sfx.level.preload = 'auto';
}
function playSfx(kind) {
  if (!soundOn) return;
  try {
    const a = kind === 'level' ? sfx.level : sfx.hit;
    if (a) { a.currentTime = 0; a.play().catch(() => {}); }
  } catch (e) {}
}

// Pitido leve al acertar (WebAudio, sin ficheros): el audio "hit" queda solo para fallos
let beepCtx = null;
function beep(freq = 880, dur = 0.075, vol = 0.085) {
  if (!soundOn) return;
  try {
    if (!beepCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      beepCtx = new AC();
    }
    if (beepCtx.state === 'suspended') beepCtx.resume().catch(() => {});
    const now = beepCtx.currentTime;
    const osc = beepCtx.createOscillator(), g = beepCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    osc.connect(g); g.connect(beepCtx.destination);
    osc.start(now); osc.stop(now + dur + 0.02);
  } catch (e) {}
}
function ensureMusic() {
  initAudio();
  audio.muted = !soundOn;
  if (audio.paused) audio.play().catch(() => toast('Pulsa ▶ otra vez para activar la música', 2200));
}

/* Velocidad efectiva de las notas: dificultad x ajuste del jugador */
function scrollEff(cfg) {
  // velocidad del jugador x factor del NIVEL (cada nivel acelera las notas)
  const fNivel = Math.min(1.55, 1 + (nivelRitmo - 1) * 0.06);
  return cfg.scroll * (SPEED_MULT[noteSpeed] || 1) * fNivel;
}

/* ---------------- Beatmap ---------------- */
function prepareNotes(diff) {
  const cfg = DIFF[diff];
  const seed = (Math.random() * 1e9) | 0;
  const r2 = mulberry32(seed);
  notes = beatmap.notes.map((n, idx) => {
    const isTrap = !zenMode && r2() < cfg.trapChance;      // en ZEN no hay trampas
    const isZarangollo = !isTrap && idx > 0 && idx % 47 === 0;
    return {
      t: n.t, lane: n.lane, s: n.s,
      kind: isTrap ? 'trap' : (isZarangollo ? 'zarangollo' : 'good'),
      emoji: isTrap ? TRAP_EMOJI[(r2() * TRAP_EMOJI.length) | 0] : (isZarangollo ? SPECIAL_ZARANGOLLO : LANE_EMOJI[n.lane]),
      state: 'idle',        // idle | hit | missed
      hitAt: 0, judgedAt: 0
    };
  });
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------------- Flujo de partida ---------------- */
function startGame(diff) {
  difficulty = diff;
  const cfg = DIFF[diff];
  resize();
  prepareNotes(diff);
  score = 0; combo = 0; maxCombo = 0; mult = 1; perfect = 0; good = 0; miss = 0; hitsCount = 0; judged = 0;
  nivelRitmo = 1;
  lives = zenMode ? 99 : cfg.lives;
  popups = []; shake = 0; laneFlash = [0, 0, 0, 0]; particles = []; judgePulse = 0;
  bgIndex = -1; lastBgChange = -1;
  running = true; paused = false; finished = false;
  try { logros.check('primera'); logros.count('partidas10'); } catch (e) {}
  el('endScreen').classList.add('hidden');
  hide(el('startScreen')); show(el('hud'));
  ensureMusic();
  try { audio.currentTime = 0; } catch (e) {}
  startedAt = performance.now();
  countdownBeeps = [false, false, false];
  updateHUD();
  lastFrame = startedAt;
  syncZenBadge();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function endGame(timedOut) {
  if (finished) return;
  finished = true; running = false;
  cancelAnimationFrame(rafId);
  const dur = beatmap.duration;
  const acc = judged ? Math.round((hitsCount / judged) * 100) : 0;
  el('endTitle').textContent = timedOut ? '¡CANCIÓN TERMINADA! 🎉' : '¡SE TE HA IDO LA OLLA!';
  el('endPhrase').textContent = timedOut
    ? (score > 4000 ? '¡Vaya tela, qué máquina!' : '¡Buena cocina, zagal!')
    : PHRASES_END[(Math.random() * PHRASES_END.length) | 0];
  el('endScore').textContent = score;
  el('endCombo').textContent = 'x' + maxCombo;
  el('endAcc').textContent = acc + '%';
  el('endPerfect').textContent = perfect;
  try {
    logros.set('puntos1k', score); logros.set('puntos5k', score); logros.set('combo10', maxCombo); logros.set('combo25', maxCombo);
    logros.count('items50', hitsCount);                       // cada nota acertada cuenta como ingrediente
    logros.set('nivel5', Math.floor(score / 1000) + 1);       // nivel aproximado por puntos
    logros.set('nivel10', Math.floor(score / 1000) + 1);
    if (zenMode) logros.check('zenpartida');
    if (miss === 0 && hitsCount > 50) logros.check('perfecto');
    if (lives === DIFF[difficulty].lives && !zenMode && timedOut) logros.check('sinfallo');
  } catch (e) {}
  // ¿récord nuevo? (antes de guardar, comparamos con el mejor local)
  try {
    const best = readLocal().reduce((m, r) => Math.max(m, r.score || 0), 0);
    if (score > best && score > 0) {
      const t = el('endTitle');
      t.textContent = '¡RÉCORD NUEVO! 🏆 ' + t.textContent.replace('¡RÉCORD NUEVO! 🏆 ', '');
      beep(1318, .12, .1); setTimeout(() => beep(1760, .16, .08), 110);
      if (navigator.vibrate) { try { navigator.vibrate([25, 40, 25]); } catch (e) {} }
    }
  } catch (e) {}
  syncZenBadge();
  el('nameRow').classList.remove('hidden');
  try { const pr = ollaPrefs(); if (pr.name) el('playerName').value = pr.name; } catch (e) {}
  show(el('endScreen'));
  try { audio.pause(); } catch (e) {}
}

function loop(now) {
  rafId = requestAnimationFrame(loop);
  const dt = clamp((now - lastFrame) / 1000, 0, 0.05);   // nunca negativo (pestañas dormidas, relojes raros)
  lastFrame = now;
  if (!running || paused) { draw(dt); return; }
  songTime = audio && !audio.paused ? audio.currentTime : songTime + dt;
  update(dt);
  draw(dt);
  if (songTime >= beatmap.duration - 0.05) endGame(true);
}

function update(dt) {
  // juicio de notas no tocadas
  const cfg = DIFF[difficulty];
  const missLine = judgeY - noteH * 0.55;
  for (const n of notes) {
    if (n.state !== 'idle') continue;
    const y = judgeY - (n.t - songTime) * scrollEff(cfg) * H;
    if (n.t < songTime - cfg.window * 1.6) {
      n.state = 'missed'; n.judgedAt = songTime;
      // Trampa esquivada = jugada CORRECTA: no penaliza precisión ni misseos
      // (antes hacía miss++/judged++ y bloqueaba el logro 'perfecto' aunque
      //  esquivaras todas las trampas — hallazgo de la revisión de codex).
      if (n.kind === 'trap') { /* esquivar trampa = bien: ni miss ni judged */ }
      else {
        miss++; judged++;
        combo = 0; mult = 1;
        popup(laneCenter(n.lane), judgeY - 40, '✗', '#f87171', 30);
        // NUEVO (petición del usuario): si se te ESCAPA una nota buena (verde)
        // sin pulsarla, también pierdes vida — antes solo rompía el combo.
        if (!zenMode) {
          lives--; shake = 1;
          playSfx('hit');
          buzz(30);
          spark(laneCenter(n.lane), judgeY - 30, '#fbbf24', 12);
          popup(laneCenter(n.lane), judgeY - 78, '💨 ¡Se escapó!', '#fca5a5', 22);
          updateHUD();
          if (lives <= 0) { endGame(false); return; }
        }
      }
    }
  }
  // fondo cambia cada ~13 s
  const bi = Math.floor(songTime / 13) % BACKGROUNDS.length;
  if (bi !== lastBgChange) { lastBgChange = bi; bgIndex = bi; loadBg(BACKGROUNDS[bi]); }

  for (let i = 0; i < LANES; i++) {
    laneFlash[i] = Math.max(0, laneFlash[i] - dt * 3.2);
    laneRipple[i] = Math.max(0, laneRipple[i] - dt * 2.4);
  }
  shake = Math.max(0, shake - dt * 3);
  judgePulse = Math.max(0, judgePulse - dt * 5);
  // pitido 3-2-1 del arranque (la primera nota llega a 1,6 s)
  if (songTime < 1.55) {
    const idx = songTime < 0.5 ? 0 : songTime < 1.0 ? 1 : 2;
    if (!countdownBeeps[idx]) { countdownBeeps[idx] = true; beep(idx === 2 ? 1046 : 660, 0.07, 0.06); }
  }
  popups.forEach(p => { p.life -= dt * 1.25; p.y -= dt * 42; });
  popups = popups.filter(p => p.life > 0);
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 620 * dt; p.life -= dt * 1.6; }
  particles = particles.filter(p => p.life > 0);
}

/* ---------------- Input ---------------- */
function laneAtX(x) { return clamp(Math.floor(x / laneW), 0, LANES - 1); }

function pressLane(i, x, y) {
  if (!running || paused) return;
  laneFlash[i] = 1; laneRipple[i] = 1;
  const cfg = DIFF[difficulty];
  // la nota más cercana en ese carril dentro de la ventana
  let best = null, bestDt = 1e9;
  for (const n of notes) {
    if (n.lane !== i || n.state !== 'idle') continue;
    const dt = Math.abs(n.t - songTime);
    if (dt < bestDt) { bestDt = dt; best = n; }
  }
  if (best && bestDt <= cfg.window * 1.35) {
    const isPerfect = bestDt <= cfg.window * 0.55;
    best.state = 'hit'; best.hitAt = songTime;
    if (best.kind === 'trap') {
      // Pulsar una trampa = fallo: NO cuenta como acierto de precisión
      // (antes hacía judged++/hitsCount++ y subía la precisión por pulsar
      //  mal — hallazgo de la revisión de codex).
      if (!zenMode) lives--; shake = 1; combo = 0; mult = 1;
      playSfx('hit');
      buzz(38);
      spark(x || laneCenter(i), y || judgeY - 30, '#f87171', 16);
      popup(x || laneCenter(i), y || judgeY - 30, '💥 ¡Trampa!', '#fca5a5', 24);
      updateHUD();
      if (lives <= 0) { endGame(false); return; }
    } else {
      const base = best.kind === 'zarangollo' ? 50 : (isPerfect ? 20 : 12);
      judged++; hitsCount++;   // acierto real: cuenta para precisión
      if (isPerfect) { perfect++; } else { good++; }
      combo++; maxCombo = Math.max(maxCombo, combo);
      try { logros.set('combo10', combo); logros.set('combo25', combo); } catch (e) {}
      mult = combo >= 40 ? 4 : combo >= 25 ? 3 : combo >= 12 ? 2 : 1;
      score += base * mult;
      if (best.kind === 'zarangollo') { beep(1318, 0.10, 0.10); beep(1760, 0.13, 0.07); try { logros.count('zarangollo10'); } catch (e) {} }
      else beep(isPerfect ? 1046 : 880);
      spark(x || laneCenter(i), (y || judgeY) - 6, isPerfect ? '#fde047' : '#a7f3d0', isPerfect ? 12 : 7);
      judgePulse = 1;
      buzz(isPerfect ? 12 : 8);
      popup(x || laneCenter(i), (y || judgeY) - 34,
        best.kind === 'zarangollo' ? '🥘 +50' : `+${base * mult}`,
        isPerfect ? '#fde047' : '#bbf7d0', isPerfect ? 30 : 24);
      // NIVEL: cada 800 puntos la cosa se pone más rápida
      const nivelNuevo = Math.min(10, 1 + Math.floor(score / 800));
      if (nivelNuevo > nivelRitmo) {
        nivelRitmo = nivelNuevo;
        popup(W / 2, H * 0.24, `⚡ NIVEL ${nivelRitmo} — ¡más rápido!`, '#fbbf24', 30);
        beep(1318, 0.10, 0.10); setTimeout(() => beep(1760, 0.12, 0.08), 90);
        try { logros.set('nivel5', nivelRitmo); logros.set('nivel10', nivelRitmo); } catch (e) {}
      }
      if (combo > 0 && combo % 12 === 0) {
        const txt = GOOD_HITS[(Math.random() * GOOD_HITS.length) | 0];
        popup(W / 2, H * 0.32, txt, '#fbbf24', 34);
        const m = el('mult'); m.classList.add('pop'); setTimeout(() => m.classList.remove('pop'), 160);
      }
      updateHUD();
    }
  } else {
    // golpe al aire: rompe combo (suave)
    if (bestDt < cfg.window * 3) { combo = 0; mult = 1; updateHUD(); }
  }
}

function updateHUD() {
  el('score').textContent = score;
  const nl = el('nivelR');
  if (nl) nl.textContent = nivelRitmo;
  el('lives').textContent = lives;
  el('combo').textContent = 'x' + combo;
  el('mult').textContent = 'x' + mult;
  const p = audio && beatmap ? clamp(audio.currentTime / beatmap.duration, 0, 1) : 0;
  el('progressBar').style.width = (p * 100).toFixed(1) + '%';
}

stage.addEventListener('pointerdown', e => {
  e.preventDefault();
  pressLane(laneAtX(e.clientX), e.clientX, e.clientY);
}, { passive: false });

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k in KEYMAP) { e.preventDefault(); pressLane(KEYMAP[k]); }
  else if (k === 'escape' && running) togglePause();
  else if (k === ' ' && !running && !el('startScreen').classList.contains('hidden')) { e.preventDefault(); startGame(difficulty); }
}, { passive: false });

/* ---------------- Pausa / menú ---------------- */
function togglePause() {
  if (!running) return;
  paused = !paused;
  if (paused) { audio && audio.pause(); show(el('pauseScreen')); }
  else { hide(el('pauseScreen')); audio && audio.play().catch(() => {}); lastFrame = performance.now(); }
}
el('btnPause').addEventListener('click', togglePause);
el('btnResume').addEventListener('click', togglePause);
el('btnRestart').addEventListener('click', () => { hide(el('pauseScreen')); startGame(difficulty); });
el('btnQuit').addEventListener('click', backToMenu);
el('btnMenu').addEventListener('click', backToMenu);
function backToMenu() {
  updateBest();
  running = false; paused = false; cancelAnimationFrame(rafId);
  try { audio && audio.pause(); } catch (e) {}
  hide(el('pauseScreen')); hide(el('endScreen')); hide(el('hud'));
  show(el('startScreen'));
  loadBg('assets/background.jpg');
}
el('btnSound').addEventListener('click', toggleSound);
function toggleSound() {
  soundOn = !soundOn;
  savePref(undefined, soundOn);
  el('btnSound').textContent = soundOn ? '🔊' : '🔇';
  if (audio) audio.muted = !soundOn;
  toast(soundOn ? 'Sonido ON' : 'Sonido OFF', 1000);
}

/* ---------------- Ranking (PC con respaldo local) ---------------- */
const API = (function () {
  const p = location.pathname;                     // '/juegos-olla/olla-gitana-ritmo/…' o '/…'
  const i = p.indexOf('/olla-gitana-ritmo');
  const base = i >= 0 ? p.slice(0, i) : '/';
  return base.replace(/\/$/, '') + '/api';
})();                                              // p.ej. '/juegos-olla/api'
const GAME_ID = 'ritmo';

function readLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; }
}
function writeLocal(rows) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, 200))); } catch (e) {}
}

async function fetchTop(diff) {
  const d = zenMode ? diff + '_zen' : diff;      // el ranking de ZEN es aparte
  const res = await fetch(`${API}/top?game=${GAME_ID}&diff=${d}&limit=50`, { cache: 'no-store' });
  if (!res.ok) throw new Error('api ' + res.status);
  const data = await res.json();
  return (data.scores || []).map(s => ({ name: s.name, score: s.score, combo: s.combo || 0, ts: s.ts || 0 }));
}

async function apiSave(entry) {
  const res = await fetch(`${API}/score`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry)
  });
  if (!res.ok) throw new Error('api ' + res.status);
  return res.json();
}

async function saveScore(name) {
  const entry = {
    game: GAME_ID, diff: difficulty + (zenMode ? '_zen' : ''),
    name: (name || 'Zagal anónimo').slice(0, 14),
    score, combo: maxCombo, acc: judged ? Math.round(hitsCount / judged * 100) : 0
  };
  // respaldo local primero, para que nunca se pierda
  const local = readLocal();
  local.push({ name: entry.name, score: entry.score, combo: entry.combo, acc: entry.acc, diff: difficulty, ts: Date.now() });
  local.sort((a, b) => b.score - a.score);
  writeLocal(local);
  try { await apiSave(entry); return { online: true }; }
  catch (e) { return { online: false }; }
}

async function renderRanking(diff) {
  const body = el('rankBody');
  body.innerHTML = '<tr><td colspan="4" class="muted">Cargando…</td></tr>';
  let rows = [], online = false;
  try { rows = await fetchTop(diff); online = true; } catch (e) { online = false; }
  if (!rows.length) {
    rows = readLocal().filter(s => s.diff === diff).sort((a, b) => b.score - a.score).slice(0, 20);
  }
  setRankSource(online);
  if (!rows.length) { body.innerHTML = '<tr><td colspan="4" class="muted">Aún no hay zagales aquí.</td></tr>'; return; }
  body.innerHTML = rows.slice(0, 20).map((s, i) =>
    `<tr class="${i === 0 ? 'top1' : ''}"><td>${i + 1}</td><td>${escapeHtml(s.name)}</td><td>x${s.combo || 0}</td><td>${s.score}</td></tr>`
  ).join('');
}

let rankDiff = 'normal';
el('rankTabs').addEventListener('click', e => {
  const b = e.target.closest('.tab'); if (!b) return;
  rankDiff = b.dataset.diff;
  [...el('rankTabs').children].forEach(c => c.classList.toggle('active', c === b));
  renderRanking(rankDiff);
});
el('btnLogros').addEventListener('click', () => { try { logros.panel(); } catch (e) {} });
el('btnRanking').addEventListener('click', () => { rankDiff = difficulty; [...el('rankTabs').children].forEach(c => c.classList.toggle('active', c.dataset.diff === rankDiff)); renderRanking(rankDiff); show(el('rankScreen')); });
el('btnCloseRank').addEventListener('click', () => hide(el('rankScreen')));
el('btnSaveScore').addEventListener('click', async () => {
  const r = await saveScore(el('playerName').value.trim());
  savePref(el('playerName').value.trim(), undefined);
  el('nameRow').classList.add('hidden'); updateBest();
  toast(r.online ? '¡Puntuación guardada! 🏆' : 'Guardada en este dispositivo', 2200);
});
function setRankSource(online) {
  const p = document.getElementById('rankSource');
  if (!p) return;
  p.textContent = online ? '' : 'Sin conexión — mostrando las puntuaciones de este dispositivo.';
  p.style.display = online ? 'none' : 'block';
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

el('btnAgain').addEventListener('click', () => startGame(difficulty));
el('btnEndMenu').addEventListener('click', backToMenu);

/* ---------------- Instrucciones / dificultad ---------------- */
el('btnHow').addEventListener('click', () => show(el('howModal')));
el('btnCloseHow').addEventListener('click', () => hide(el('howModal')));
el('btnCloseHow2').addEventListener('click', () => hide(el('howModal')));
el('diffRow').addEventListener('click', e => {
  const b = e.target.closest('.diff'); if (!b) return;
  difficulty = b.dataset.diff;
  [...el('diffRow').children].forEach(c => c.classList.toggle('active', c === b));
});
el('btnPlay').addEventListener('click', () => startGame(difficulty));
el('speedRow').addEventListener('click', e => {
  const b = e.target.closest('.diff'); if (!b) return;
  noteSpeed = b.dataset.speed;
  [...el('speedRow').children].forEach(c => c.classList.toggle('active', c === b));
});
el('zenCheck').addEventListener('change', () => {
  zenMode = el('zenCheck').checked;
  savePref(undefined, undefined, {speed: noteSpeed, zen: zenMode});
  el('zenLabel').style.opacity = zenMode ? '1' : '.9';
});
/* etiqueta ZEN durante la partida */
(function addZenBadge(){
  const b = document.createElement('div');
  b.id = 'zenBadge'; b.className = 'zenBadge hidden'; b.textContent = '🧘 MODO ZEN';
  document.body.appendChild(b);
})();
function syncZenBadge() { const b = el('zenBadge'); if (b) b.classList.toggle('hidden', !zenMode || !running); }

/* ---------------- Fondo ---------------- */
function loadBg(src) {
  if (bgLoaded === src) return;
  const img = new Image();
  img.onload = () => { bgImg = img; bgLoaded = src; };
  img.onerror = () => { bgImg = null; bgLoaded = null; };
  img.src = src;
}

/* ---------------- Dibujo ---------------- */
function draw(dt) {
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * 14 * shake, (Math.random() - .5) * 14 * shake);

  // fondo
  if (bgImg) {
    const scale = Math.max(W / bgImg.width, H / bgImg.height) * 1.02;
    const dw = bgImg.width * scale, dh = bgImg.height * scale;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(bgImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.globalAlpha = 1;
  }
  // velo + carriles
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(10,6,4,.72)'); g.addColorStop(.55, 'rgba(10,6,4,.42)'); g.addColorStop(1, 'rgba(10,6,4,.86)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < LANES; i++) {
    if (i % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,.045)'; ctx.fillRect(laneW * i, 0, laneW, H); }
    if (laneFlash[i] > 0) { ctx.fillStyle = `rgba(250,204,21,${laneFlash[i] * .14})`; ctx.fillRect(laneW * i, 0, laneW, H); }
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(laneW * (i + 1), 0); ctx.lineTo(laneW * (i + 1), H); ctx.stroke();
  }

  // notas
  const cfg = DIFF[difficulty];
  for (const n of notes) {
    if (n.state === 'hit') continue;
    const y = judgeY - (n.t - songTime) * scrollEff(cfg) * H;
    if (y < -noteH * 2 || y > H + noteH) continue;
    const missed = n.state === 'missed';
    const x = laneCenter(n.lane);
    drawNote(x, y, n, missed);
  }

  // cuenta atrás en los primeros 1,5 s (la primera nota llega a 1,6 s):
  // da tiempo a prepararse y hace que el arranque no sea de golpe.
  if (running && !paused && songTime < 1.55) {
    const n = songTime < 0.5 ? 3 : songTime < 1.0 ? 2 : 1;
    const frac = (songTime % 0.5) / 0.5;
    ctx.save();
    ctx.globalAlpha = 0.85 - frac * 0.55;
    ctx.font = `900 ${Math.round(H * 0.19 * (1 + frac * 0.18))}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,.65)';
    ctx.strokeText(String(n), W / 2, H * 0.42);
    ctx.fillStyle = '#fde047';
    ctx.fillText(String(n), W / 2, H * 0.42);
    ctx.globalAlpha = 1;
    ctx.font = `900 ${Math.round(H * 0.032)}px system-ui`;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.strokeText('¡PREPARADO!', W / 2, H * 0.42 + H * 0.13);
    ctx.fillText('¡PREPARADO!', W / 2, H * 0.42 + H * 0.13);
    ctx.restore();
  }

  // línea de juicio + pads
  const jp = 1 + judgePulse * 0.9;
  ctx.fillStyle = `rgba(255,255,255,${0.85 - judgePulse * 0.25})`;
  ctx.fillRect(0, judgeY - 1.5 * jp, W, 3 * jp);
  if (judgePulse > 0) {
    ctx.globalAlpha = judgePulse * 0.5;
    const jg = ctx.createLinearGradient(0, judgeY - 26, 0, judgeY + 26);
    jg.addColorStop(0, 'rgba(250,204,21,0)'); jg.addColorStop(.5, 'rgba(250,204,21,.55)'); jg.addColorStop(1, 'rgba(250,204,21,0)');
    ctx.fillStyle = jg; ctx.fillRect(0, judgeY - 26, W, 52);
    ctx.globalAlpha = 1;
  }
  // chispas
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < LANES; i++) {
    const x = laneCenter(i);
    ctx.globalAlpha = 0.9;
    ctx.font = `${Math.round(noteH * 0.72)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.beginPath(); ctx.arc(x, judgeY + noteH * 0.75, noteH * 0.72, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(LANE_EMOJI[i], x, judgeY + noteH * 0.78);
    ctx.globalAlpha = 1;
  }

  // popups
  for (const p of popups) {
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.font = `900 ${p.size}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)';
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (running && !paused) updateHUD();
}

function drawNote(x, y, n, missed) {
  const w = noteW, h = noteH;
  ctx.globalAlpha = missed ? 0.22 : 1;
  ctx.save();
  ctx.translate(x, y);
  // cuerpo
  const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  if (n.kind === 'trap') { grad.addColorStop(0, '#7f1d1d'); grad.addColorStop(1, '#dc2626'); }
  else if (n.kind === 'zarangollo') { grad.addColorStop(0, '#fcd34d'); grad.addColorStop(1, '#d97706'); }
  else { grad.addColorStop(0, '#065f46'); grad.addColorStop(1, '#10b981'); }
  ctx.beginPath();
  const r = h * 0.34;
  const x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2;
  ctx.moveTo(x0 + r, y0); ctx.lineTo(x1 - r, y0); ctx.quadraticCurveTo(x1, y0, x1, y0 + r);
  ctx.lineTo(x1, y1 - r); ctx.quadraticCurveTo(x1, y1, x1 - r, y1);
  ctx.lineTo(x0 + r, y1); ctx.quadraticCurveTo(x0, y1, x0, y1 - r);
  ctx.lineTo(x0, y0 + r); ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
  // emoji
  ctx.font = `${Math.round(h * 0.6)}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(n.emoji, 0, 1);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* ---------------- Arranque ---------------- */
resize();
loadBg('assets/background.jpg');

// Cargar beatmap (js file para evitar problemas de file://)
try {
  beatmap = window.OLLA_RITMO_BEATMAP;
  if (!beatmap) throw new Error('sin beatmap');
} catch (e) {
  toast('No se pudo cargar el mapa de ritmo', 4000);
}

// precargar un par de fondos
BACKGROUNDS.slice(0, 3).forEach(loadBg);

// Pausa automática si se va a segundo plano
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running && !paused) togglePause();
});

// Evitar gestos que hagan scroll/zoom
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());

/* Récord personal en este dispositivo (se ve en la pantalla de inicio) */
function updateBest() {
  const node = el('bestScore');
  if (!node) return;
  try {
    const rows = readLocal();
    const best = rows.reduce((m, r) => Math.max(m, r.score || 0), 0);
    node.textContent = best ? `🏆 Tu récord: ${best} puntos` : '';
  } catch (e) {}
}
updateBest();

/* restaurar sonido guardado (si el jugador lo apagó, sigue apagado) */
(function restoreGamePrefs(){
  try {
    const p = ollaPrefs();
    if (p.speed && SPEED_MULT[p.speed]) {
      noteSpeed = p.speed;
      const row = el('speedRow');
      if (row) [...row.children].forEach(c => c.classList.toggle('active', c.dataset.speed === noteSpeed));
    }
    if (p.zen) { zenMode = true; const c = el('zenCheck'); if (c) c.checked = true; }
  } catch (e) {}
})();

(function restoreSound(){
  try {
    const p = ollaPrefs();
    if (p.sound === false) {
      soundOn = false;
      const b = el('btnSound'); if (b) b.textContent = '🔇';
    }
  } catch (e) {}
})();

