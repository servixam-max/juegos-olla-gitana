/* Olla Gitana: NENA Y MIGUEL — LA MARATÓN 42K 🏃
   Endless-runner pseudo-3D (vista trasera) mobile-first.
   Personajes inspirados en la foto real (dorsales 2015 y 301, gorras,
   chaleco de trail, manga de tatuajes...). Obstáculos: los "vicios"
   (cigarros, chocolatinas, pastillas, birras...) y vallas del recorrido.
   Meta: 42,195 km con avituallamiento cada 5 km. */
'use strict';

/* ---------------- Setup ---------------- */
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1, S = 1;          // S = escala relativa a 800px de alto

/* Constantes de la proyección (se recalculan en resize) */
let CX = 0, yH = 0, feetY = 0, hPx = 0, F = 0, CAM = 0;
const ZP = 4.5;                            // distancia de cámara al corredor (m)
const LANES = [-2.2, 0, 2.2];              // carriles en metros

let skyGrad = null, skyH = 0, fogGrad = null, fogH = 0;

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  S = Math.max(0.62, Math.min(1.5, H / 800));
  CX = W / 2; yH = H * 0.30; feetY = H * 0.80;
  hPx = clamp(Math.min(H * 0.135, W * 0.22), 66, 170);
  F = 2.65 * hPx;                          // focal en px
  CAM = (feetY - yH) * ZP / F;             // altura "efectiva" de cámara
  skyGrad = null; fogGrad = null;         // dependen de H: invalidar
}

/* RESOLUCIÓN ADAPTATIVA: si el FPS sostenido baja de 50 se reduce el DPR por
   pasos (mín 0.75); si va sobrado (>58) se recupera. Mismo patrón que el resto. */
let fpsFrames = 0, fpsT = 0, lowFps = 0, recover = 0;
function checkFps(dt) {
  fpsFrames++; fpsT += dt;
  if (fpsT < 0.5) return;
  const fps = fpsFrames / fpsT;
  fpsFrames = 0; fpsT = 0;
  const dprMax = Math.min(2, window.devicePixelRatio || 1);
  if (fps < 50) lowFps++; else lowFps = 0;
  if (lowFps >= 3 && DPR > 0.75) {
    DPR = Math.max(0.75, DPR - 0.25); lowFps = 0; resize();
  } else if (fps > 58 && DPR < dprMax) {
    recover++;
    if (recover >= 6) { DPR = Math.min(dprMax, DPR + 0.25); recover = 0; resize(); }
  }
}

const el = id => document.getElementById(id);
const show = n => n && n.classList.remove('hidden');
const hide = n => n && n.classList.add('hidden');
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/* Proyección: mundo (x lateral m, y altura m, z distancia m) -> pantalla */
function proj(x, y, z) {
  const s = F / z;
  return [CX + x * s, yH + (CAM - y) * s, s];
}
/* Rect redondeado sobre un contexto cualquiera */
function R(c, x, y, w, h, r) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
}

/* ---------------- Config ---------------- */
const GAME_ID = 'maraton';
const STORAGE_KEY = 'olla_maraton_scores_v1';
const MARATHON_KM = 42.195;

const DIFF = {
  easy:   { label: 'FÁCIL 🐢',   speed: 0.85, spawn: 1.30 },
  normal: { label: 'NORMAL 🥘',  speed: 1.00, spawn: 1.00 },
  hard:   { label: 'CANALLA 🔥', speed: 1.20, spawn: 0.80 }
};

const V_BASE = 7.4;                        // m/s del mundo a ritmo normal (arranque ya vivo)
const KM_RATE = 0.0125;                    // km mostrados por metro de mundo (≈12 s/km)
const GRAV = 19;                           // m/s²
const JUMP_V = 6.3;                       // ≈ 1,05 m de salto
const DUCK_H = 0.55;                      // altura agachado (en "hombres")
const VICE_EMOJI = ['🚬', '🍫', '💊', '🍺', '🍩', '🍭'];
const TALL_EMOJI = ['🚧', '🛢️'];
const ITEMS = [
  { k: '🍌', w: 0.22, v: 10 }, { k: '💧', w: 0.20, v: 10 },
  { k: '🍊', w: 0.16, v: 15 }, { k: '⚡', w: 0.08, v: 20 },
  { k: '🧃', w: 0.10, v: 10, power: 'shield' },
  { k: '🚀', w: 0.09, v: 10, power: 'turbo' },
  { k: '🧲', w: 0.08, v: 10, power: 'magnet' },
  { k: '⏳', w: 0.07, v: 15, power: 'slow' }
];

const PHRASES_HIT = ['¡Ojú, la mala vida!', '¡Aparta, trasto!', '¡Eso no es de corredores!',
  '¡Miaja, el vicio!', '¡Acho, la chocolatina!', '¡Que te lías, pijo!'];
const PHRASES_END = ['¡Se te ha ido la olla!', '¡Menudo calentón!', '¡Has acabado como el Rosario de la Aurora!',
  '¡Te sobraba la maratón, chaval/a!', '¡Gambitero sin dorsal!'];
const BANNER_TEXTS = ['MARATÓN 42K', 'CARAVACA DE LA CRUZ', '¡ÁNIMO CORREDORES!', 'NOV EM NIK',
  '¡OLLA GITANA!', 'META 42,195', '¡A LA FRESCA!'];
const CROWD_TEXTS = ['¡VAMOS NENA!', '¡ÁNIMO MIGUEL!', '¡CHAMPI, TIRA!', '42K 💪', '¡A POR ELLOS!',
  'CARAVACA ♥', '¡MENSAJERO DE LA CRUZ!', '¡OLLA GITANA!', '¡VAYA TELA!', '¡GUSA!'];
const PANCA_TEXTS = ['¡AGÁCHATE!', '¡ABAJO!', '¡PANCARTA!', '¡LIMBO!'];

/* ---------------- Personajes (según la foto) ---------------- */
const CHARS = {
  miguel: {
    nombre: 'MIGUEL', dorsal: '2015', label: 'Miguel',
    skin: '#c98a5e', skinD: '#a96f47', hair: '#2e2417', cap: '#c2b492', capD: '#877a5c',
    shirtA: '#e8437a', shirtB: '#f9eef2', shorts: '#23262d', shoe: '#17181c',
    logo: '#17181c', sleeve: '#33302c'
  },
  nena: {
    nombre: 'NENA', dorsal: '301', label: 'Nena',
    skin: '#e9b48c', skinD: '#cf9770', hair: '#6b4a33', cap: '#1d1d20', capD: '#2b2b30',
    shirtA: '#e8437a', shirtB: '#f6e7ec', shorts: '#1b1d22', shoe: '#141414',
    vest: '#232326', vestL: '#3c3c41', sleeve: '#e9b48c'
  }
};

/* ---------------- Estado ---------------- */
let state = 'menu';                        // menu | count | run | pause | end | win
let rafId = 0, lastT = 0;
let difficulty = 'normal';
let charId = 'miguel';

let km = 0, kmShown = 0, kmGate = 5, traveled = 0, score = 0, itemPoints = 0;
let lives = 3, combo = 0, maxCombo = 0, itemsGot = 0, vicios = 0, invuln = 0, shield = 0;
let turbo = 0, magnet = 0, slow = 0;
let shake = 0, comboTimer = 0, lastPowers = '';
let speed = 0, spawnTimer = 1.0, itemTimer = 1.2, countT = 0, mediaDone = false;
let phase = 0;                            // ciclo de carrera del personaje
let obstacles = [], items = [], gates = [], particles = [], popups = [];
let soundOn = true;
let savingScore = false, bestAtStart = 0, recordShown = false;
let crowdSeed = 1;

const player = { lane: 1, x: 0, y: 0, vy: 0, ducking: false, holdJump: 0, tilt: 0 };

const audio = {
  music: null,
  hit: new Audio('assets/hit.mp3'),
  up: new Audio('assets/levelup_special.mp3')
};

function multTier(c) { return c >= 40 ? 5 : c >= 25 ? 4 : c >= 12 ? 3 : c >= 5 ? 2 : 1; }
const mult = () => multTier(combo);
const kmFloor = () => Math.floor(km);
const speedFactor = k => Math.min(1.9, 1 + k * 0.021);   // ~+2,1% por km, todo el maratón subiendo

/* ---------------- Preferencias (compartidas con los otros juegos) ---------------- */
const PREFS_KEY = 'olla_prefs_v1';
function loadPrefs() { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch (e) { return {}; } }
function savePref(obj) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(Object.assign(loadPrefs(), obj))); } catch (e) {}
}

/* ---------------- Audio ---------------- */
function initMusic() {
  if (audio.music) return;
  // tema original de la maratón (NO es la canción de la banda, para no repetirla)
  audio.music = new Audio('assets/maraton_theme.mp3');
  audio.music.loop = true;
  audio.music.volume = 0.5;
}
function playMusic() {
  initMusic();
  try { audio.music.muted = !soundOn; audio.music.play().catch(() => {}); } catch (e) {}
}
function stopMusic() { try { audio.music && audio.music.pause(); } catch (e) {} }
function sfx(name, vol = 0.7) {
  if (!soundOn) return;
  try { const a = audio[name].cloneNode(); a.volume = vol; a.play().catch(() => {}); } catch (e) {}
}

/* Vibración suave (móvil) */
let vibrateOk = true;
function buzz(ms) { if (!vibrateOk || !soundOn) return; try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { vibrateOk = false; } }

/* Pitido leve WebAudio — para aciertos (los ficheros "hit" SOLO son para golpes) */
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

/* ---------------- Partida ---------------- */
function startGame(diff, chr) {
  if (diff) difficulty = diff;
  if (chr) charId = chr;
  const cfg = DIFF[difficulty];
  km = 0; kmShown = 0; kmGate = 5; traveled = 0; score = 0; itemPoints = 0;
  lives = 3; combo = 0; maxCombo = 0; itemsGot = 0; vicios = 0;
  invuln = 0; shield = 0; turbo = 0; magnet = 0; slow = 0; shake = 0; comboTimer = 0; mediaDone = false;
  speed = V_BASE * speedFactor(0) * cfg.speed * 0.95;   // arranque ya a ritmo (sin rampa muerta)
  spawnTimer = 0.9; itemTimer = 1.0; phase = 0; lastPowers = '';
  obstacles = []; items = []; gates = []; particles = []; popups = [];
  player.lane = 1; player.x = 0; player.y = 0; player.vy = 0;
  player.ducking = false; player.holdJump = 0; player.tilt = 0;
  countT = 1.8;
  crowdSeed = Math.floor(Math.random() * 1000);
  try { logros.check('primera'); logros.count('partidas10'); } catch (e) {}
  hide(el('startScreen')); hide(el('endScreen')); hide(el('winScreen'));
  hide(el('pauseScreen')); hide(el('rankScreen')); hide(el('howModal'));
  show(el('hud'));
  el('progressBar').style.width = '0%';
  el('kmChip').textContent = '🏁 0.0 km';
  el('lives').textContent = lives;
  el('score').textContent = 0;
  el('mult').textContent = 'x1';
  try { bestAtStart = readLocal().reduce((m, r) => Math.max(m, r.score || 0), 0); } catch (e) { bestAtStart = 0; }
  recordShown = false;
  state = 'count';
  playMusic();
  lastT = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function gameOver() {
  state = 'end'; stopMusic();
  hide(el('hud'));
  el('endTitle').textContent = pick(PHRASES_END);
  el('endPhrase').textContent = `Km ${km.toFixed(2)} de 42,2 · carril ${player.lane + 1}`;
  el('endScore').textContent = score;
  el('endKm').textContent = km.toFixed(2);
  el('endVicios').textContent = vicios;
  el('endItems').textContent = itemsGot;
  try {
    logros.set('puntos1k', score); logros.set('puntos5k', score);
    logros.set('nivel5', kmFloor()); logros.set('nivel10', kmFloor());
    logros.set('velocidad', kmFloor());
    logros.set('combo10', maxCombo); logros.set('combo25', maxCombo);
    logros.count('esquiva50', vicios);
    if (lives === 3) logros.check('sinfallo');
  } catch (e) {}
  try {
    const best = readLocal().reduce((m, r) => Math.max(m, r.score || 0), 0);
    if (score > best && score > 0) {
      const t = el('endTitle');
      t.textContent = '¡RÉCORD NUEVO! 🏆 ' + t.textContent;
      buzz(30);
    }
  } catch (e) {}
  el('nameRow').classList.remove('hidden');
  savingScore = false;
  const sb = el('btnSaveScore'); if (sb) { sb.disabled = false; sb.textContent = 'Guardar'; }
  try { const pr = loadPrefs(); if (pr.name) el('playerName').value = pr.name; } catch (e) {}
  show(el('endScreen'));
}

function winGame() {
  state = 'win'; stopMusic();
  km = MARATHON_KM;                        // la carrera terminada es la maratón exacta
  score = Math.floor(km * 1000) + itemPoints;
  sfx('up', 0.9); buzz([40, 60, 40]);
  // confeti de meta (se anima también con la pantalla de victoria encima)
  for (let k = 0; k < 4; k++) burst(W * (0.2 + k * 0.2), H * (0.3 + (k % 2) * 0.12), 26, ['#fde047', '#fca5a5', '#86efac', '#93c5fd'][k]);
  hide(el('hud'));
  el('winScore').textContent = score;
  el('winKm').textContent = '42,195';
  el('winVicios').textContent = vicios;
  el('winItems').textContent = itemsGot;
  try {
    logros.set('nivel5', kmFloor()); logros.set('nivel10', kmFloor());
    logros.set('puntos1k', score); logros.set('puntos5k', score);
    logros.set('combo10', maxCombo); logros.set('combo25', maxCombo);
    logros.count('esquiva50', vicios);
    logros.check('maraton42k');
    if (lives === 3) logros.check('sinfallo');
  } catch (e) {}
  savingScore = false;
  const wb = el('btnWinSave'); if (wb) { wb.disabled = false; wb.textContent = 'Guardar'; }
  try { const pr = loadPrefs(); if (pr.name) el('winName').value = pr.name; } catch (e) {}
  show(el('winScreen'));
}

function togglePause() {
  if (state === 'run') {
    state = 'pause'; show(el('pauseScreen'));
    try { audio.music && audio.music.pause(); } catch (e) {}
  } else if (state === 'pause') {
    state = 'run'; hide(el('pauseScreen'));
    lastT = performance.now(); playMusic();
  }
}
function onVisibility() { if (document.hidden && state === 'run') togglePause(); }

/* ---------------- Spawns ---------------- */
function gapScale() {
  const base = clamp(1.06 - kmFloor() * 0.012, 0.70, 1.06);
  return base * DIFF[difficulty].spawn;
}
function spawnObstacleRow() {
  const k = kmFloor();
  // pancarta a lo ancho (hay que AGACHARSE) a partir del km 2
  if (k >= 2 && Math.random() < 0.11) {
    obstacles.push({ type: 'banner', lane: -1, x: 0, z: 100, hit: false, counted: false,
      text: pick(PANCA_TEXTS) });
    spawnTimer = rand(0.9, 1.5) * gapScale();
    return;
  }
  const twoLane = Math.random() < (k >= 2 ? 0.20 : 0);
  const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
  const n = twoLane ? 2 : 1;
  const tallChance = k >= 3 ? 0.24 : 0.10;
  for (let i = 0; i < n; i++) {
    const lane = lanes[i];
    const tall = Math.random() < tallChance;
    obstacles.push({
      type: tall ? 'tall' : 'vice', lane, x: LANES[lane], z: 100,
      emoji: tall ? pick(TALL_EMOJI) : pick(VICE_EMOJI), hit: false, counted: false
    });
  }
  spawnTimer = Math.max(0.62, rand(0.85, 1.45) * gapScale());
}
function spawnItemString() {
  const lane = Math.floor(Math.random() * 3);
  const r = Math.random();
  let acc = 0, kind = ITEMS[0];
  for (const it of ITEMS) { acc += it.w; if (r <= acc) { kind = it; break; } }
  const n = kind.power ? 1 : (Math.random() < 0.5 ? 2 : 3);
  for (let i = 0; i < n; i++) {
    items.push({ k: kind.k, v: kind.v, power: kind.power || null, lane, x: LANES[lane], z: 100 + i * 1.6, y: 1.15 });
  }
  itemTimer = rand(1.6, 3.0);
}

/* Aplica el efecto de un power-up (🚀 turbo, 🧲 imán, ⏳ cámara lenta, 🧃 escudo) */
function applyPower(kind) {
  if (kind === 'shield') {
    shield = Math.max(shield, 6);
    popup('🧃 ¡ISOTÓNICA! ESCUDO 🛡️', '#a5f3fc', CX, H * 0.34); beep(1200, 0.1, 0.09);
  } else if (kind === 'turbo') {
    turbo = Math.max(turbo, 5);
    popup('🚀 ¡TURBO! +50% velocidad', '#fdba74', CX, H * 0.34); beep(1400, 0.12, 0.1); buzz(20);
  } else if (kind === 'magnet') {
    magnet = Math.max(magnet, 6);
    popup('🧲 ¡IMÁN! la fruta viene sola', '#d8b4fe', CX, H * 0.34); beep(1100, 0.1, 0.09);
  } else if (kind === 'slow') {
    slow = Math.max(slow, 4);
    popup('⏳ ¡CÁMARA LENTA!', '#93c5fd', CX, H * 0.34); beep(520, 0.14, 0.09);
  }
}

/* ---------------- Update ---------------- */
function update(dt) {
  const cfg = DIFF[difficulty];
  phase += dt * (7 + speed * 0.9);

  if (state === 'count') {
    const prev = Math.ceil(countT);
    countT -= dt;
    const nowC = Math.ceil(countT);
    if (nowC !== prev && nowC >= 1) beep(660, 0.09, 0.09);
    if (countT <= 0) { state = 'run'; popup('¡YA! 🏃', '#86efac', W * 0.5, H * 0.34); beep(1320, 0.12, 0.1); }
    updateFx(dt);
    return;
  }

  // velocidad (sube con el km) y avance; turbo acelera, cámara lenta frena
  let targetSpeed = V_BASE * speedFactor(kmFloor()) * cfg.speed;
  if (turbo > 0) targetSpeed *= 1.5;
  if (slow > 0) targetSpeed *= 0.65;
  speed += (targetSpeed - speed) * Math.min(1, dt * 1.3);
  traveled += speed * dt;
  km += speed * dt * KM_RATE;

  // hitos por km
  if (kmFloor() > kmShown) {
    kmShown = kmFloor();
    beep(988 + Math.min(6, kmShown % 10) * 40, 0.05, 0.05);
    // aviso pequeño de km: la velocidad va subiendo en todos y cada uno
    popup(`km ${kmShown} · +2% ⚡`, '#a7f3d0', W * 0.5, H * 0.22, 14 * S);
    try { logros.set('maraton5k', kmShown); logros.set('maraton21k', kmShown); logros.set('nivel5', kmShown); logros.set('velocidad', kmShown); } catch (e) {}
    if (!mediaDone && km >= 21.1) {
      mediaDone = true;
      popup('¡MEDIA MARATÓN! 🥇', '#fde047', W * 0.5, H * 0.30);
      sfx('up', 0.85); buzz(30);
      for (let k2 = 0; k2 < 3; k2++) burst(W * (0.3 + k2 * 0.2), H * 0.4, 14, ['#fde047', '#fca5a5', '#86efac'][k2]);
    }
  }
  // puertas de km cada 5 (viajan z*KM_RATE km → llegan justo al km)
  if (km >= kmGate - 0.6) {
    gates.push({ km: kmGate, z: 48, done: false });
    kmGate += 5;
  }
  if (!gates.some(g => g.final) && km >= MARATHON_KM - 0.62) {
    gates.push({ km: 'META', final: true, z: 48, done: false });
  }

  // física
  if (player.holdJump > 0 && player.vy > 0) { player.vy += GRAV * 0.45 * dt; player.holdJump -= dt; }
  player.vy -= GRAV * dt;
  player.y += player.vy * dt;
  if (player.y <= 0) { player.y = 0; player.vy = 0; }
  // carril
  const tx = LANES[player.lane];
  const dx = tx - player.x;
  player.x += clamp(dx, -1, 1) * Math.min(1, dt * 11);
  if (Math.abs(dx) < 0.01) player.x = tx;
  player.tilt = clamp(-dx * 0.35, -0.22, 0.22);

  if (invuln > 0) invuln -= dt;
  if (shield > 0) shield -= dt;
  if (turbo > 0) turbo -= dt;
  if (magnet > 0) magnet -= dt;
  if (slow > 0) slow -= dt;
  if (shake > 0) shake -= dt * 2.2;
  if (duckTimer > 0) { duckTimer -= dt; if (duckTimer <= 0 && !duckHold) setDuck(false); }

  // obstáculos
  spawnTimer -= dt;
  if (spawnTimer <= 0) spawnObstacleRow();
  for (const o of obstacles) o.z -= speed * dt;
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    if (o.z < 0.9) { obstacles.splice(i, 1); continue; }
    // hit
    if (!o.hit && Math.abs(o.z - ZP) < 0.6) {
      const overlap = o.type === 'banner' ? true : Math.abs(o.x - player.x) < 1.12;
      if (overlap) {
        let safe = false;
        if (o.type === 'vice') safe = player.y > 0.62;
        else if (o.type === 'tall') safe = player.y > 1.3;
        else if (o.type === 'banner') safe = player.ducking && player.y < 0.05;
        if (!safe && invuln <= 0 && shield <= 0) {
          o.hit = true; lives--; combo = 0;
          invuln = 1.6; shake = 1;
          sfx('hit', 0.85); buzz(45);
          popup(pick(PHRASES_HIT), '#fca5a5', CX, H * 0.42);
          burst(CX, H * 0.55, 12, '#f87171');
          if (lives <= 0) { gameOver(); return; }
        } else if (!safe) { o.hit = true; }   // invulnerable/escudo: pasa de largo
      }
    }
    // contado al superarlo
    if (!o.counted && o.z < ZP - 0.6) { o.counted = true; vicios++; }
  }

  // items
  itemTimer -= dt;
  if (itemTimer <= 0) spawnItemString();
  for (const it of items) it.z -= speed * dt;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.z < 0.9) { items.splice(i, 1); continue; }
    // imán: los items cercanos se vienen al corredor
    if (magnet > 0 && it.z < 45) {
      it.x += (player.x - it.x) * Math.min(1, dt * 7);
      it.y += ((1.1 + player.y) - it.y) * Math.min(1, dt * 3.5);
    }
    if (Math.abs(it.z - ZP) < 0.65 && Math.abs(it.x - player.x) < (magnet > 0 ? 3.4 : 1.05) && player.y < 2.4) {
      itemsGot++; combo++; maxCombo = Math.max(maxCombo, combo); comboTimer = 0;
      try { logros.set('combo10', combo); logros.set('combo25', combo); logros.count('items50'); } catch (e) {}
      if (it.power) applyPower(it.power);
      itemPoints += it.v * mult();
      const [ix, iy] = proj(player.x, 1.1 + player.y * 0.5, ZP);
      popup('+' + it.v * mult(), '#fde68a', ix, iy - 60 * S);
      burst(ix, iy, 7, '#fcd34d');
      beep(784 + Math.min(6, Math.floor(combo / 4)) * 66, 0.07, 0.08);
      buzz(8);
      items.splice(i, 1);
    }
  }

  // puertas
  for (const g of gates) {
    g.z -= speed * dt;
    if (!g.done && g.z < ZP - 0.4) {
      g.done = true;
      if (g.final) { if (state === 'run') { winGame(); return; } }
      else {
        popup(`¡KM ${g.km}! ⚡`, '#fde047', W * 0.5, H * 0.30);
        sfx('up', 0.75); buzz(25);
        if (g.km % 5 === 0) {
          lives = Math.min(3, lives + 1);
          popup('⛽ AVITUALLAMIENTO +1 ❤️', '#86efac', W * 0.5, H * 0.30 + 40 * S);
          for (let k2 = 0; k2 < 3; k2++) burst(W * (0.3 + k2 * 0.2), H * 0.42, 12, ['#86efac', '#fde047', '#fca5a5'][k2]);
        }
      }
    }
  }
  gates = gates.filter(g => g.z > 0.9);
  if (state !== 'run') return;

  // combo se enfría si no coges nada en 4 s
  comboTimer += dt;
  if (comboTimer > 4.0 && combo > 0) {
    comboTimer = 0;
    combo = Math.max(0, combo - Math.ceil(combo * 0.25));
  }

  // estela de polvo en la posición real del corredor + llamas de turbo
  const [ppx] = proj(player.x, 0, ZP);
  if (Math.random() < 0.5) {
    particles.push({ x: ppx + rand(-14, 14), y: feetY - rand(0, 8), vx: rand(-90, -30), vy: rand(-40, 0),
      life: rand(0.25, 0.5), color: 'rgba(255,255,255,.4)', r: rand(1.4, 2.8) * S });
  }
  if (turbo > 0 && Math.random() < 0.85) {
    particles.push({ x: ppx + rand(-12, 12), y: feetY - rand(0, 10), vx: rand(-300, -140), vy: rand(-60, 20),
      life: rand(0.14, 0.3), color: Math.random() < 0.5 ? 'rgba(255,166,60,.85)' : 'rgba(255,224,130,.85)', r: rand(1.6, 3.2) * S });
  }

  updateFx(dt);

  // puntuación
  score = Math.floor(km * 1000) + itemPoints;

  // meta
  if (km >= MARATHON_KM) { winGame(); return; }

  // HUD
  el('lives').textContent = Math.max(0, lives);
  el('score').textContent = score;
  el('kmChip').textContent = `🏁 ${km.toFixed(1)} km`;
  el('progressBar').style.width = Math.min(100, (km / MARATHON_KM) * 100) + '%';
  const m = el('mult'); m.textContent = 'x' + mult(); m.classList.toggle('pop', mult() > 1);
  const pstr = (turbo > 0 ? `🚀${Math.ceil(turbo)} ` : '') + (shield > 0 ? `🛡️${Math.ceil(shield)} ` : '') +
    (magnet > 0 ? `🧲${Math.ceil(magnet)} ` : '') + (slow > 0 ? `⏳${Math.ceil(slow)}` : '');
  if (pstr !== lastPowers) { lastPowers = pstr; el('powers').textContent = pstr; }
}

function updateFx(dt) {
  for (const p of particles) { p.x += (p.vx || 0) * dt; p.y += p.vy * dt; p.vy += 700 * S * dt; p.life -= dt * 1.6; }
  particles = particles.filter(p => p.life > 0);
  for (const p of popups) { p.y -= 42 * S * dt; p.life -= dt * 0.85; }
  popups = popups.filter(p => p.life > 0);
}

function burst(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    particles.push({ x, y, vx: rand(-150, 150) * S, vy: rand(-300, -60) * S, life: rand(0.4, 0.95), color, r: rand(2, 5) * S });
  }
}
function popup(text, color, x, y, size) { popups.push({ text, color, x, y, life: 1, size: size || 22 * S }); }

/* ---------------- Dibujo de escena ---------------- */
function drawSky() {
  if (!skyGrad || skyH !== H) {
    skyGrad = ctx.createLinearGradient(0, 0, 0, yH + 40);
    skyGrad.addColorStop(0, '#6db8f0');
    skyGrad.addColorStop(0.65, '#a8d4f5');
    skyGrad.addColorStop(1, '#e8f2fb');
    skyH = H;
  }
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, yH + 40);
  // suelo base bajo el horizonte: sin esto, las zonas fuera de la calle no se
  // repintan cada frame y el tinte de cámara lenta se acumulaba hasta saturar
  ctx.fillStyle = '#7d7365';
  ctx.fillRect(0, yH + 38, W, H - (yH + 38));
  // sol
  ctx.fillStyle = 'rgba(255,236,170,.85)';
  ctx.beginPath(); ctx.arc(W * 0.78, yH * 0.30, 26 * S, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,236,170,.18)';
  ctx.beginPath(); ctx.arc(W * 0.78, yH * 0.30, 52 * S, 0, Math.PI * 2); ctx.fill();
  // nubes (parallax suave con el avance)
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  const off = (traveled * 2.2) % (W + 260);
  cloud(W * 0.18 - off, yH * 0.42, 1); cloud(W * 0.62 - off * 0.8, yH * 0.26, 0.8); cloud(W * 0.95 - off * 1.2, yH * 0.5, 1.1);
  function cloud(x, y, s2) {
    let xx = x % (W + 260); if (xx < -130) xx += W + 260;
    ctx.beginPath();
    ctx.ellipse(xx, y, 60 * s2 * S, 16 * s2 * S, 0, 0, Math.PI * 2);
    ctx.ellipse(xx + 34 * s2 * S, y - 10 * s2 * S, 34 * s2 * S, 13 * s2 * S, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* Edificios: manzanas a ambos lados, crema/terracota con balcones (estilo
   Caravaca, como la foto). Se generan de forma procedural con pseudorandom. */
function hash(i) { const x = Math.sin(i * 127.1 + crowdSeed * 13.7) * 43758.5453; return x - Math.floor(x); }
function drawBuildings() {
  const cols = ['#f2e7d5', '#efe3cc', '#e8d9c2', '#f7f0e2', '#e2c9a8', '#e6d2b6'];
  const trims = ['#cbb693', '#c2a87f', '#b9a486', '#d2bd9a'];
  const spacing = 7.5;
  const phaseZ = traveled % spacing;
  for (let side = -1; side <= 1; side += 2) {
    for (let k = 1; k <= 14; k++) {          // de lejos a cerca
      const z = k * spacing - phaseZ + 6;
      if (z < 1.6 || z > 96) continue;
      const idx = Math.round((traveled - phaseZ) / spacing) + k;
      const h = 9 + hash(idx * 3 + side) * 6;
      const wm = 5.5 + hash(idx * 7 + side * 11) * 2.2;
      const xc = side * (7.4 + hash(idx * 5) * 1.4);
      const [xa, ya, sa] = proj(xc - wm / 2, 0, z);
      const [xb] = proj(xc + wm / 2, 0, z);
      const yTop = yH + (CAM - h) * sa;
      const alpha = clamp((96 - z) / 26, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = cols[Math.floor(hash(idx + side * 31) * cols.length)];
      ctx.fillRect(xa, yTop, xb - xa, ya - yTop);
      // alero superior
      ctx.fillStyle = trims[Math.floor(hash(idx * 2 + side * 5) * trims.length)];
      ctx.fillRect(xa, yTop, xb - xa, Math.max(1.5, 0.22 * sa * 0) + 1.5);
      // bajo comercial (para que los edificios cercanos no se vean como muros planos)
      const baseH = Math.min(3.4 * sa, (ya - yTop) * 0.34);
      ctx.fillStyle = 'rgba(88,68,48,.38)';
      ctx.fillRect(xa, ya - baseH, xb - xa, baseH);
      if (baseH > 6) {
        ctx.fillStyle = 'rgba(40,30,22,.5)';
        const dx = xa + (xb - xa) * 0.3;
        ctx.fillRect(dx, ya - baseH * 0.86, Math.max(3, (xb - xa) * 0.16), baseH * 0.86);
        ctx.fillRect(xa + (xb - xa) * 0.62, ya - baseH * 0.86, Math.max(3, (xb - xa) * 0.16), baseH * 0.86);
      }
      // ventanas + balcones
      const floors = Math.floor(h / 2.6);
      const wcols = Math.max(2, Math.round((xb - xa) / (16 * sa)));
      ctx.fillStyle = 'rgba(64,52,38,.8)';
      for (let f = 1; f <= floors; f++) {
        const wy = yTop + (ya - yTop) * (1 - f / (floors + 1));
        const ww = Math.max(1.2, 0.7 * sa), wh = Math.max(1.6, 1.0 * sa);
        for (let c = 0; c < wcols; c++) {
          const wx = xa + (xb - xa) * ((c + 0.5) / wcols);
          ctx.fillRect(wx - ww / 2, wy - wh / 2, ww, wh);
        }
        // balcón de hierro
        if (f < floors && sa > 2) {
          ctx.fillRect(xa + (xb - xa) * 0.12, wy + wh * 0.7, (xb - xa) * 0.76, Math.max(1, 0.5 * sa * 0.18));
        }
      }
      // toldo ocasional
      if (hash(idx * 17 + side) > 0.72 && sa > 2.5) {
        ctx.fillStyle = ['#c0392b', '#d97706', '#2f6fd0'][Math.floor(hash(idx * 23) * 3)];
        ctx.fillRect(xa, ya - (ya - yTop) * 0.42, xb - xa, Math.max(2, 1.4 * sa * 0.3));
      }
      ctx.globalAlpha = 1;
    }
  }
}

/* Vallas de carrera (a los lados, con el público detrás) y coches aparcados:
   llenan los arcenes y dan aspecto real de maratón por la calle. */
function drawStreetFurniture() {
  const step = 2.6;
  const phaseZ = traveled % step;
  for (let side = -1; side <= 1; side += 2) {
    // barrotes longitudinales (dos travesaños) como polilínea hacia el horizonte
    ctx.strokeStyle = 'rgba(245,245,245,.75)'; ctx.lineWidth = Math.max(1, 0.05 * (F / 10));
    for (const hy of [0.32, 0.6]) {
      ctx.beginPath();
      let first = true;
      for (let z = 2.6; z <= 60; z += 2.6) {
        const [x1, y1] = proj(side * 4.15, hy, z);
        if (first) { ctx.moveTo(x1, y1); first = false; } else ctx.lineTo(x1, y1);
      }
      ctx.stroke();
    }
    // postes naranjas
    for (let k = 23; k >= 1; k--) {
      const z = k * step - phaseZ + 2.2;
      if (z < 2.6 || z > 60) continue;
      const [x1, y1, sc] = proj(side * 4.15, 0.62, z);
      const [, y2] = proj(side * 4.15, 0, z);
      const w = Math.max(1.2, 0.07 * sc);
      ctx.fillStyle = '#e8542f';
      ctx.fillRect(x1 - w / 2, y1, w, y2 - y1);
    }
  }
  // coches aparcados en los arcenes (x ≈ ±6,3)
  const carCols = ['#c0392b', '#2f6fd0', '#bdc3c7', '#27ae60', '#8e44ad', '#e67e22', '#34495e'];
  const cstep = 13;
  const cphase = traveled % cstep;
  for (let side = -1; side <= 1; side += 2) {
    for (let k = 1; k <= 5; k++) {
      const z = k * cstep - cphase + 4.5;
      if (z < 3.4 || z > 52) continue;
      const idx = Math.round((traveled - cphase) / cstep) + k;
      if (hash(idx * 19 + side * 3) < 0.28) continue;      // algún hueco
      const [cx2, cy2, csc] = proj(side * 6.3, 0, z);
      const bw = 1.85 * csc, bh = 0.62 * csc, ch = 0.5 * csc;
      const col = carCols[Math.floor(hash(idx * 29 + side) * carCols.length)];
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(cx2, cy2, bw * 0.55, bh * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col;
      R(ctx, cx2 - bw / 2, cy2 - bh, bw, bh, bh * 0.3); ctx.fill();                    // carrocería
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      R(ctx, cx2 - bw * 0.34, cy2 - bh - ch, bw * 0.68, ch, ch * 0.4); ctx.fill();     // cabina
      ctx.fillStyle = 'rgba(20,20,24,.85)';
      ctx.beginPath(); ctx.arc(cx2 - bw * 0.3, cy2 - bh * 0.08, bh * 0.28, 0, Math.PI * 2);
      ctx.arc(cx2 + bw * 0.3, cy2 - bh * 0.08, bh * 0.28, 0, Math.PI * 2); ctx.fill(); // ruedas
    }
  }
}

/* Público animado a los dos lados de la calle */
function drawCrowd(t) {
  const colP = ['#e74c3c', '#f39c12', '#27ae60', '#2980b9', '#8e44ad', '#e84393', '#16a085', '#f1c40f', '#ecf0f1'];
  const spacing = 2.3;
  const phaseZ = traveled % spacing;
  for (let side = -1; side <= 1; side += 2) {
    for (let k = 16; k >= 1; k--) {          // de lejos a cerca
      const z = k * spacing - phaseZ + 2.4;
      if (z < 2.4 || z > 52) continue;              // de cerca ya pasan fuera de encuadre
      const idx = Math.round((traveled - phaseZ) / spacing) + k;
      if (z < 4.2 && idx % 2) continue;             // de muy cerca, la mitad (menos amontonamiento)
      const h2 = hash(idx * 13 + side * 7);
      const xc = side * (4.75 + hash(idx * 3 + side) * 0.55);
      const [xs, ys, sc] = proj(xc, 0, z);
      const alpha = clamp((52 - z) / 16, 0, 1);
      const bob = Math.abs(Math.sin(t * 4 + idx)) * 0.09;
      const Hh = 1.05 * sc;                   // ~1,05 m de alto en pantalla
      const x0 = xs + (side < 0 ? -1 : 1) * 0.15 * sc;
      ctx.globalAlpha = alpha;
      const col = colP[Math.floor(h2 * colP.length)];
      // cuerpo
      ctx.fillStyle = col;
      R(ctx, x0 - Hh * 0.14, ys - Hh * (0.78 + bob), Hh * 0.28, Hh * 0.62, Hh * 0.1); ctx.fill();
      // cabeza
      ctx.fillStyle = '#e8b48c';
      ctx.beginPath(); ctx.arc(x0, ys - Hh * (0.88 + bob), Hh * 0.11, 0, Math.PI * 2); ctx.fill();
      // brazos arriba animando
      ctx.strokeStyle = '#e8b48c'; ctx.lineWidth = Math.max(1, Hh * 0.055); ctx.lineCap = 'round';
      const armS = Math.sin(t * 6 + idx * 1.7) * 0.25;
      ctx.beginPath();
      ctx.moveTo(x0 - Hh * 0.13, ys - Hh * 0.68);
      ctx.lineTo(x0 - Hh * (0.3 + armS * 0.3), ys - Hh * (1.05 + bob + armS * 0.2));
      ctx.moveTo(x0 + Hh * 0.13, ys - Hh * 0.68);
      ctx.lineTo(x0 + Hh * (0.3 - armS * 0.3), ys - Hh * (1.05 + bob - armS * 0.2));
      ctx.stroke();
      // pancarta ocasional (solo a media distancia: de cerca se amontonarían)
      if (h2 > 0.86 && z < 18 && z > 6.5) {
        ctx.font = `900 ${Math.max(5, Hh * 0.2)}px system-ui`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const txt = CROWD_TEXTS[idx % CROWD_TEXTS.length];
        const tw = ctx.measureText(txt).width + Hh * 0.2;
        ctx.fillStyle = 'rgba(20,16,12,.82)';
        R(ctx, x0 - tw / 2, ys - Hh * (1.5 + bob), tw, Hh * 0.3, Hh * 0.05); ctx.fill();
        ctx.fillStyle = '#fde68a';
        ctx.fillText(txt, x0, ys - Hh * (1.35 + bob));
      }
      ctx.globalAlpha = 1;
    }
  }
}

/* Pancartas colgadas en alto cruzando la calle (decoración) */
function drawStreetBanners() {
  const spacing = 26;
  const phaseZ = traveled % spacing;
  for (let k = 1; k <= 4; k++) {
    const z = k * spacing - phaseZ + 10;
    if (z < 5 || z > 78) continue;
    const idx = Math.round((traveled - phaseZ) / spacing) + k;
    const [x1, yTop] = proj(-4.3, 4.5, z);
    const [x2] = proj(4.3, 4.5, z);
    const [, yBot] = proj(-4.3, 3.75, z);
    const alpha = clamp((78 - z) / 22, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ['#c0392b', '#2f6fd0', '#b03a8c', '#1f7a4d'][idx % 4];
    ctx.fillRect(x1, yTop, x2 - x1, yBot - yTop);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillRect(x1, yTop + (yBot - yTop) * 0.12, x2 - x1, Math.max(1, (yBot - yTop) * 0.1));
    if (z < 42) {
      ctx.font = `900 ${Math.max(7, (yBot - yTop) * 0.5)}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(BANNER_TEXTS[idx % BANNER_TEXTS.length], (x1 + x2) / 2, (yTop + yBot) / 2 + (yBot - yTop) * 0.06);
    }
    ctx.globalAlpha = 1;
  }
}

function drawRoad() {
  // asfalto
  const [xa0, ya0] = proj(-4, 0, 2.0);
  const [xb0] = proj(4, 0, 2.0);
  const [xa1, ya1] = proj(-4, 0, 400);
  const [xb1] = proj(4, 0, 400);
  ctx.fillStyle = '#3b3b41';
  ctx.beginPath();
  ctx.moveTo(xa0, ya0); ctx.lineTo(xb0, ya0); ctx.lineTo(xb1, ya1); ctx.lineTo(xa1, ya1);
  ctx.closePath(); ctx.fill();
  // arcenes claros
  const [sa0x, sa0y] = proj(-5.6, 0, 2.0);
  const [sa1x, sa1y] = proj(-5.6, 0, 240);
  ctx.fillStyle = '#9b9184';
  ctx.beginPath();
  ctx.moveTo(sa0x, sa0y); ctx.lineTo(xa0, ya0); ctx.lineTo(xa1, ya1); ctx.lineTo(sa1x, sa1y);
  ctx.closePath(); ctx.fill();
  const [sb0x, sb0y] = proj(5.6, 0, 2.0);
  const [sb1x, sb1y] = proj(5.6, 0, 240);
  ctx.fillStyle = '#9b9184';
  ctx.beginPath();
  ctx.moveTo(sb0x, sb0y); ctx.lineTo(xb0, ya0); ctx.lineTo(xb1, ya1); ctx.lineTo(sb1x, sb1y);
  ctx.closePath(); ctx.fill();
  // líneas discontinuas de los carriles
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  const dashes = 6, dashLen = 3, phaseZ = traveled % dashes;
  for (let k = 0; k < 26; k++) {
    const z = k * dashes - phaseZ + 3;
    if (z < 2 || z > 160) continue;
    const z2 = z + dashLen * 0.9;
    if (z2 > 170) continue;
    for (const lx of [-1.1, 1.1]) {
      const [x1, y1] = proj(lx - 0.09, 0, z);
      const [x2] = proj(lx + 0.09, 0, z);
      const [, y2] = proj(lx, 0, z2);
      ctx.fillRect(x1, y1, Math.max(1, x2 - x1), Math.max(1, y1 - y2));
    }
  }
  // línea de salida/meta sutil junto al corredor
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5;
  const [lx1, ly1] = proj(-4, 0, 2.4);
  const [lx2] = proj(4, 0, 2.4);
  ctx.beginPath(); ctx.moveTo(lx1, ly1); ctx.lineTo(lx2, ly1); ctx.stroke();
}

function drawFog() {
  if (!fogGrad || fogH !== H) {
    fogGrad = ctx.createLinearGradient(0, yH - 34, 0, yH + 26);
    fogGrad.addColorStop(0, 'rgba(232,242,251,0)');
    fogGrad.addColorStop(0.5, 'rgba(232,242,251,.75)');
    fogGrad.addColorStop(1, 'rgba(232,242,251,0)');
    fogH = H;
  }
  ctx.fillStyle = fogGrad;
  ctx.fillRect(0, yH - 34, W, 60);
}

/* ---------------- Personajes: vista trasera (en juego) ---------------- */
function drawRunnerBack(px, py, h, chr, ph, pose) {
  const C = CHARS[chr];
  ctx.save();
  ctx.translate(px, py);
  if (pose.tilt) ctx.rotate(pose.tilt);
  if (pose.crouch) ctx.scale(1, 0.56);
  const s = h;

  const swing = Math.sin(ph), swing2 = Math.sin(ph + Math.PI);
  const air = pose.air;

  function leg(side, sw) {
    const lift = air ? 0.55 + 0.2 * Math.sin(ph + side) : Math.max(0, sw);
    const hipX = side * 0.075 * s, hipY = -0.46 * s;
    const kneeX = side * (0.10 + 0.02 * lift) * s, kneeY = -0.24 * s - lift * 0.075 * s;
    const footX = side * 0.085 * s, footY = (-0.02 * s) - lift * 0.14 * s;
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.shorts; ctx.lineWidth = 0.078 * s;
    ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kneeX, kneeY); ctx.stroke();
    ctx.strokeStyle = C.skin; ctx.lineWidth = 0.056 * s;
    ctx.beginPath(); ctx.moveTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
    ctx.fillStyle = C.shoe;
    R(ctx, footX - 0.055 * s, footY - 0.035 * s, 0.11 * s, 0.06 * s, 0.028 * s); ctx.fill();
  }
  leg(-1, swing); leg(1, swing2);

  // pantalón corto
  ctx.fillStyle = C.shorts;
  R(ctx, -0.13 * s, -0.52 * s, 0.26 * s, 0.14 * s, 0.05 * s); ctx.fill();

  // brazos ANTES del torso (la unión hombro-brazo queda oculta bajo la camiseta;
  // la función `arm` se declara más abajo — las declaraciones de función se hoistean)
  arm(-1, swing2); arm(1, swing);

  // torso (camiseta con degradado rosa->claro, como la foto)
  const grad = ctx.createLinearGradient(0, -0.86 * s, 0, -0.44 * s);
  grad.addColorStop(0, C.shirtA); grad.addColorStop(1, C.shirtB);
  ctx.fillStyle = grad;
  R(ctx, -0.155 * s, -0.87 * s, 0.31 * s, 0.43 * s, 0.075 * s); ctx.fill();

  if (chr === 'nena') {
    // chaleco de trail negro con tirantes, manguera y dorsales
    ctx.fillStyle = C.vest;
    R(ctx, -0.17 * s, -0.88 * s, 0.34 * s, 0.42 * s, 0.07 * s); ctx.fill();
    ctx.strokeStyle = C.vestL; ctx.lineWidth = Math.max(1, 0.018 * s);
    ctx.beginPath();
    ctx.moveTo(-0.1 * s, -0.88 * s); ctx.lineTo(-0.06 * s, -0.6 * s);
    ctx.moveTo(0.1 * s, -0.88 * s); ctx.lineTo(0.06 * s, -0.6 * s);
    ctx.stroke();
    // manguera azul (como la foto)
    ctx.strokeStyle = '#2f7fd6'; ctx.lineWidth = Math.max(1.2, 0.02 * s);
    ctx.beginPath();
    ctx.moveTo(-0.13 * s, -0.68 * s);
    ctx.quadraticCurveTo(-0.2 * s, -0.5 * s, -0.11 * s, -0.44 * s);
    ctx.stroke();
    ctx.fillStyle = '#1f6fc0';
    ctx.beginPath(); ctx.arc(-0.11 * s, -0.44 * s, 0.02 * s, 0, Math.PI * 2); ctx.fill();
    // bidones asomando por los hombros
    ctx.fillStyle = '#e8e8ea';
    R(ctx, -0.115 * s, -0.94 * s, 0.05 * s, 0.075 * s, 0.02 * s); ctx.fill();
    R(ctx, 0.065 * s, -0.94 * s, 0.05 * s, 0.075 * s, 0.02 * s); ctx.fill();
    bibBack(s, C.dorsal, -0.70 * s, 0.155 * s);
  } else {
    // logotipo oscuro en la espalda + riñonera
    ctx.fillStyle = C.logo;
    R(ctx, -0.065 * s, -0.83 * s, 0.13 * s, 0.075 * s, 0.012 * s); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillRect(-0.05 * s, -0.815 * s, 0.10 * s, Math.max(1, 0.012 * s));
    ctx.fillRect(-0.05 * s, -0.79 * s, 0.07 * s, Math.max(1, 0.012 * s));
    bibBack(s, C.dorsal, -0.63 * s, 0.16 * s);
    ctx.fillStyle = '#17181c';
    R(ctx, -0.115 * s, -0.40 * s, 0.23 * s, 0.08 * s, 0.03 * s); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = Math.max(1, 0.012 * s);
    ctx.beginPath(); ctx.moveTo(-0.08 * s, -0.355 * s); ctx.lineTo(0.08 * s, -0.355 * s); ctx.stroke();
  }

  // brazos (manga tatuada en el zurdo de Miguel)
  function arm(side, sw) {
    const tattoo = chr === 'miguel' && side === -1;
    const shX = side * 0.16 * s, shY = -0.80 * s;
    const elX = side * (0.235 + 0.01 * Math.max(0, sw)) * s;
    const elY = -0.62 * s - (air ? 0.06 * s : Math.max(0, sw) * 0.02 * s);
    const haX = side * 0.215 * s;
    const haY = (air ? -0.58 * s : -0.47 * s + Math.max(0, -sw) * 0.06 * s);
    ctx.lineCap = 'round';
    ctx.strokeStyle = tattoo ? C.sleeve : C.skin;
    ctx.lineWidth = 0.058 * s;
    ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(elX, elY); ctx.lineTo(haX, haY); ctx.stroke();
    if (tattoo) {
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.beginPath(); ctx.arc(elX + side * 0.006 * s, elY + 0.03 * s, 0.014 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(shX + side * 0.02 * s, shY + 0.05 * s, 0.012 * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = C.skin;
    ctx.beginPath(); ctx.arc(haX, haY, 0.04 * s, 0, Math.PI * 2); ctx.fill();
    if (chr === 'nena' && side === -1) {   // reloj Garmin
      ctx.fillStyle = '#101114';
      ctx.fillRect(haX - side * 0.045 * s - 0.02 * s, haY - 0.02 * s, 0.04 * s, 0.035 * s);
    }
  }

  // cabeza + gorra
  const hy = -0.92 * s, r = 0.088 * s;
  ctx.fillStyle = C.skin;
  ctx.fillRect(-0.032 * s, -0.90 * s, 0.064 * s, 0.07 * s);
  ctx.beginPath(); ctx.arc(0, hy, r, 0, Math.PI * 2); ctx.fill();

  if (chr === 'nena') {
    // pelo castaño bajo la gorra + coleta que bota
    ctx.fillStyle = C.hair;
    ctx.beginPath();
    ctx.arc(0, hy + 0.02 * s, r * 1.02, 0.15, Math.PI - 0.15);
    ctx.fill();
    const pt = Math.sin(ph * 2) * 0.2;
    ctx.strokeStyle = C.hair; ctx.lineWidth = 0.055 * s; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0.01 * s, hy + 0.055 * s);
    ctx.quadraticCurveTo((0.09 + pt * 0.05) * s, hy + 0.12 * s, (0.06 + pt * 0.08) * s, hy + 0.20 * s);
    ctx.stroke();
    ctx.fillStyle = '#c78be0';
    ctx.beginPath(); ctx.arc(0.03 * s, hy + 0.085 * s, 0.018 * s, 0, Math.PI * 2); ctx.fill();
    // gorra
    ctx.fillStyle = C.cap;
    ctx.beginPath(); ctx.arc(0, hy, r * 1.06, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#efefef';
    ctx.beginPath(); ctx.arc(0, hy - r * 0.35, 0.012 * s, 0, Math.PI * 2); ctx.fill();
    // pendientes
    ctx.fillStyle = '#f6c344';
    ctx.beginPath(); ctx.arc(-r * 0.95, hy + 0.015 * s, 0.014 * s, 0, Math.PI * 2);
    ctx.arc(r * 0.95, hy + 0.015 * s, 0.014 * s, 0, Math.PI * 2); ctx.fill();
  } else {
    // Miguel: gorra beige + barba + patillas de las gafas
    ctx.fillStyle = 'rgba(46,36,23,.85)';
    ctx.beginPath(); ctx.arc(0, hy + 0.035 * s, r * 0.92, 0.15, Math.PI - 0.15); ctx.fill();
    ctx.fillStyle = C.cap;
    ctx.beginPath(); ctx.arc(0, hy, r * 1.06, Math.PI, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.capD; ctx.lineWidth = Math.max(1, 0.01 * s);
    ctx.beginPath(); ctx.arc(0, hy, r * 1.06, Math.PI, Math.PI * 2); ctx.stroke();
    // nuca con pelo corto bajo la gorra
    ctx.fillStyle = 'rgba(46,36,23,.5)';
    ctx.beginPath(); ctx.arc(0, hy + 0.004 * s, r * 0.92, 0.1, Math.PI - 0.1); ctx.fill();
    // cierre trasero de la gorra (hebilla)
    ctx.fillStyle = 'rgba(72,62,44,.85)';
    R(ctx, -0.024 * s, hy - 0.016 * s, 0.048 * s, 0.028 * s, 0.01 * s); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillRect(-0.01 * s, hy - 0.008 * s, 0.02 * s, Math.max(1, 0.006 * s));
    ctx.strokeStyle = '#17181c'; ctx.lineWidth = Math.max(1, 0.014 * s);
    ctx.beginPath();
    ctx.moveTo(-r * 0.98, hy - 0.012 * s); ctx.lineTo(-r * 0.5, hy - 0.02 * s);
    ctx.moveTo(r * 0.98, hy - 0.012 * s); ctx.lineTo(r * 0.5, hy - 0.02 * s);
    ctx.stroke();
  }

  ctx.restore();
}

function bibBack(s, num, y, w) {
  const hh = w * 0.72;
  ctx.fillStyle = '#fff';
  R(ctx, -w / 2, y, w, hh, 0.012 * s); ctx.fill();
  ctx.fillStyle = '#f97316';
  ctx.fillRect(-w / 2, y, w, hh * 0.2);
  ctx.fillStyle = '#151515';
  ctx.font = `900 ${Math.round(hh * 0.44)}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(num, 0, y + hh * 0.62);
}

/* ---------------- Personajes: retrato frontal (menú) ---------------- */
function drawRunnerFront(c, chr, h, t) {
  const C = CHARS[chr];
  const s = h;
  c.save();
  c.translate(0, 0);
  const bob = Math.sin(t * 4) * 0.012;
  c.translate(0, -h * bob);
  const outl = '#241d16';

  // piernas
  c.lineCap = 'round';
  c.strokeStyle = C.skin; c.lineWidth = 0.06 * s;
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(side * 0.07 * s, -0.46 * s);
    c.lineTo(side * 0.08 * s, -0.06 * s);
    c.stroke();
  }
  c.fillStyle = C.shorts;
  R(c, -0.15 * s, -0.52 * s, 0.30 * s, 0.16 * s, 0.05 * s); c.fill();
  c.strokeStyle = outl; c.lineWidth = Math.max(1, 0.012 * s); c.stroke();
  c.fillStyle = C.shoe;
  for (const side of [-1, 1]) { R(c, side * 0.08 * s - 0.06 * s, -0.05 * s, 0.12 * s, 0.05 * s, 0.02 * s); c.fill(); }

  // torso
  const grad = c.createLinearGradient(0, -0.88 * s, 0, -0.44 * s);
  grad.addColorStop(0, C.shirtA); grad.addColorStop(1, C.shirtB);
  c.fillStyle = grad;
  R(c, -0.16 * s, -0.88 * s, 0.32 * s, 0.44 * s, 0.08 * s); c.fill();
  c.strokeStyle = outl; c.lineWidth = Math.max(1, 0.012 * s); c.stroke();

  if (chr === 'miguel') {
    // logotipo + dorsal 2015 + riñonera + medalla
    c.fillStyle = C.logo;
    R(c, -0.07 * s, -0.83 * s, 0.14 * s, 0.08 * s, 0.012 * s); c.fill();
    c.fillStyle = 'rgba(255,255,255,.9)';
    c.font = `900 ${Math.round(0.035 * s)}px system-ui`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('NOV', 0, -0.805 * s); c.fillText('EM NIK', 0, -0.775 * s);
    bibFront(c, s, '2015', -0.62 * s, 'OLLA GITANA');
    c.fillStyle = '#17181c';
    R(c, -0.12 * s, -0.42 * s, 0.24 * s, 0.08 * s, 0.03 * s); c.fill();
    medal(c, s);
  } else {
    // chaleco negro con bidones + manguera + dorsal 301
    c.fillStyle = C.vest;
    R(c, -0.175 * s, -0.89 * s, 0.12 * s, 0.45 * s, 0.05 * s); c.fill();
    R(c, 0.055 * s, -0.89 * s, 0.12 * s, 0.45 * s, 0.05 * s); c.fill();
    c.strokeStyle = C.vestL; c.lineWidth = Math.max(1, 0.012 * s);
    c.beginPath(); c.moveTo(-0.055 * s, -0.86 * s); c.lineTo(-0.055 * s, -0.5 * s);
    c.moveTo(0.055 * s, -0.86 * s); c.lineTo(0.055 * s, -0.5 * s); c.stroke();
    // bidones blandos en el pecho
    c.fillStyle = '#e9e9ec';
    for (const side of [-1, 1]) {
      R(c, side * 0.115 * s - 0.028 * s, -0.80 * s, 0.056 * s, 0.10 * s, 0.02 * s); c.fill();
      c.strokeStyle = outl; c.lineWidth = Math.max(1, 0.01 * s); c.stroke();
      c.fillStyle = '#2b2b30';
      R(c, side * 0.115 * s - 0.02 * s, -0.815 * s, 0.04 * s, 0.028 * s, 0.01 * s); c.fill();
      c.fillStyle = '#e9e9ec';
    }
    // manguera
    c.strokeStyle = '#2f7fd6'; c.lineWidth = Math.max(1.4, 0.02 * s);
    c.beginPath();
    c.moveTo(-0.14 * s, -0.72 * s);
    c.quadraticCurveTo(-0.22 * s, -0.52 * s, -0.12 * s, -0.47 * s);
    c.stroke();
    c.fillStyle = '#1f6fc0';
    c.beginPath(); c.arc(-0.12 * s, -0.47 * s, 0.022 * s, 0, Math.PI * 2); c.fill();
    bibFront(c, s, '301', -0.60 * s, 'LA NENA', true);
    medal(c, s);
  }

  // brazos
  c.lineCap = 'round';
  for (const side of [-1, 1]) {
    const tattoo = chr === 'miguel' && side === -1;
    c.strokeStyle = tattoo ? C.sleeve : C.skin;
    c.lineWidth = 0.058 * s;
    c.beginPath();
    c.moveTo(side * 0.17 * s, -0.82 * s);
    c.quadraticCurveTo(side * 0.26 * s, -0.66 * s, side * 0.22 * s, -0.5 * s);
    c.stroke();
    if (tattoo) {
      c.fillStyle = 'rgba(255,255,255,.25)';
      c.beginPath(); c.arc(side * 0.22 * s, -0.68 * s, 0.016 * s, 0, Math.PI * 2);
      c.arc(side * 0.19 * s, -0.6 * s, 0.013 * s, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = C.skin;
    c.beginPath(); c.arc(side * 0.22 * s, -0.5 * s, 0.032 * s, 0, Math.PI * 2); c.fill();
    if (chr === 'nena' && side === -1) {
      c.fillStyle = '#101114';
      c.fillRect(side * 0.22 * s - 0.02 * s, -0.53 * s, 0.04 * s, 0.035 * s);
    }
    if (chr === 'nena' && side === 1) {   // tatuaje pequeño en el antebrazo
      c.fillStyle = '#3a2f28';
      c.beginPath(); c.arc(side * 0.235 * s, -0.63 * s, 0.014 * s, 0, Math.PI * 2); c.fill();
    }
  }

  // cabeza
  const hy = -0.97 * s, r = 0.095 * s;
  c.fillStyle = C.skin;
  c.beginPath(); c.arc(0, hy, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = outl; c.lineWidth = Math.max(1, 0.012 * s); c.stroke();

  if (chr === 'miguel') {
    // barba
    c.fillStyle = 'rgba(46,36,23,.92)';
    c.beginPath(); c.arc(0, hy + 0.018 * s, r * 0.96, 0.12, Math.PI - 0.12); c.fill();
    // sonrisa
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(0, hy + 0.062 * s, r * 0.46, 0, Math.PI); c.fill();
    c.strokeStyle = outl; c.lineWidth = Math.max(1, 0.01 * s);
    c.beginPath(); c.arc(0, hy + 0.062 * s, r * 0.46, 0, Math.PI); c.stroke();
    // gafas redondas
    c.fillStyle = '#1c1c1f';
    c.beginPath();
    c.arc(-r * 0.42, hy - 0.012 * s, r * 0.27, 0, Math.PI * 2);
    c.arc(r * 0.42, hy - 0.012 * s, r * 0.27, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#1c1c1f'; c.lineWidth = Math.max(1, 0.014 * s);
    c.beginPath(); c.moveTo(-r * 0.15, hy - 0.012 * s); c.lineTo(r * 0.15, hy - 0.012 * s); c.stroke();
    // gorra beige con visera
    c.fillStyle = C.cap;
    c.beginPath(); c.arc(0, hy - r * 0.22, r * 1.08, Math.PI, Math.PI * 2); c.fill();
    c.strokeStyle = outl; c.lineWidth = Math.max(1, 0.01 * s); c.stroke();
    c.fillStyle = C.capD;
    c.beginPath(); c.ellipse(0, hy - r * 0.20, r * 1.25, r * 0.3, 0, 0, Math.PI); c.fill();
    c.fillStyle = '#3a3a3c';
    c.beginPath(); c.arc(0, hy - r * 0.62, r * 0.13, 0, Math.PI * 2); c.fill();
  } else {
    // pelo a los lados
    c.fillStyle = C.hair;
    c.beginPath(); c.arc(-r * 0.85, hy + 0.02 * s, r * 0.38, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(r * 0.85, hy + 0.02 * s, r * 0.38, 0, Math.PI * 2); c.fill();
    // pendientes
    c.fillStyle = '#f6c344';
    c.beginPath(); c.arc(-r * 0.95, hy + 0.14 * s, 0.016 * s, 0, Math.PI * 2);
    c.arc(r * 0.95, hy + 0.14 * s, 0.016 * s, 0, Math.PI * 2); c.fill();
    // sonrisa
    c.strokeStyle = '#7c4a3a'; c.lineWidth = Math.max(1, 0.012 * s);
    c.beginPath(); c.arc(0, hy + 0.045 * s, r * 0.4, 0.25, Math.PI - 0.25); c.stroke();
    // gafas espejo naranja
    for (const side of [-1, 1]) {
      const gx = side * r * 0.44;
      const gg = c.createLinearGradient(gx - r * 0.3, hy - r * 0.3, gx + r * 0.3, hy + r * 0.3);
      gg.addColorStop(0, '#ffb347'); gg.addColorStop(0.5, '#ff8c1a'); gg.addColorStop(1, '#e2620f');
      c.fillStyle = gg;
      R(c, gx - r * 0.3, hy - r * 0.34, r * 0.6, r * 0.42, r * 0.12); c.fill();
      c.strokeStyle = '#26262a'; c.lineWidth = Math.max(1, 0.012 * s); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.35)';
      c.beginPath(); c.moveTo(gx - r * 0.2, hy + r * 0.05); c.lineTo(gx + r * 0.05, hy - r * 0.3); c.lineTo(gx + r * 0.18, hy - r * 0.3); c.lineTo(gx - r * 0.1, hy + r * 0.05); c.closePath(); c.fill();
    }
    // gorra negra
    c.fillStyle = C.cap;
    c.beginPath(); c.arc(0, hy - r * 0.25, r * 1.06, Math.PI, Math.PI * 2); c.fill();
    c.strokeStyle = outl; c.lineWidth = Math.max(1, 0.01 * s); c.stroke();
    c.fillStyle = '#101014';
    c.beginPath(); c.ellipse(0, hy - r * 0.23, r * 1.22, r * 0.28, 0, 0, Math.PI); c.fill();
  }

  c.restore();
}

function bibFront(c, s, num, y, team, hang) {
  const w = 0.19 * s, hh = w * 0.68;
  c.save();
  if (hang) c.translate(0, 0);
  c.fillStyle = '#fff';
  R(c, -w / 2, y, w, hh, 0.012 * s); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.stroke();
  c.fillStyle = '#f97316';
  c.fillRect(-w / 2, y, w, hh * 0.22);
  c.fillStyle = '#151515';
  c.font = `900 ${Math.round(hh * 0.42)}px system-ui`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(num, 0, y + hh * 0.58);
  c.fillStyle = '#7a2f12';
  c.font = `700 ${Math.round(hh * 0.13)}px system-ui`;
  c.fillText(team, 0, y + hh * 0.9);
  c.restore();
}

function medal(c, s) {
  c.strokeStyle = '#e9d8a6'; c.lineWidth = Math.max(1, 0.012 * s);
  c.beginPath();
  c.moveTo(-0.05 * s, -0.86 * s); c.lineTo(0, -0.78 * s); c.lineTo(0.05 * s, -0.86 * s);
  c.stroke();
  c.fillStyle = '#f2c542';
  c.beginPath(); c.arc(0, -0.76 * s, 0.026 * s, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#b8860b'; c.lineWidth = Math.max(1, 0.008 * s); c.stroke();
}

/* ---------------- Obstáculos, items, puertas ---------------- */
function drawObstacle(o) {
  const [xs, ys, sc] = proj(o.x, 0, o.z);
  const alpha = clamp((100 - o.z) / 24, 0, 1);
  ctx.globalAlpha = alpha;
  if (o.type === 'banner') {
    // pancarta baja cruzando la calle: hay que AGACHARSE
    const [x1, yTop] = proj(-3.9, 1.62, o.z);
    const [x2] = proj(3.9, 1.62, o.z);
    const [, yBot] = proj(-3.9, 1.02, o.z);
    ctx.fillStyle = 'rgba(200,40,40,.95)';
    ctx.fillRect(x1, yTop, x2 - x1, yBot - yTop);
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.fillRect(x1, yTop + (yBot - yTop) * 0.1, x2 - x1, Math.max(1, (yBot - yTop) * 0.12));
    if (o.z < 40) {
      ctx.font = `900 ${Math.max(7, (yBot - yTop) * 0.5)}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(o.text, (x1 + x2) / 2, (yTop + yBot) / 2 + (yBot - yTop) * 0.05);
    }
    // pista de agacharse
    const [ax, ay] = proj(0, 0.25, o.z);
    if (o.z < 26) {
      ctx.font = `900 ${Math.round(20 * S * clamp(14 / o.z, 0.7, 2.4))}px system-ui`;
      ctx.fillStyle = 'rgba(255,190,190,.95)';
      ctx.fillText('⬇', ax, ay);
    }
    ctx.globalAlpha = 1;
    return;
  }
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(xs, ys, 0.42 * sc, 0.13 * sc, 0, 0, Math.PI * 2); ctx.fill();
  if (o.type === 'tall') {
    // valla/bidón: alto de verdad — no se salta, hay que cambiar de carril
    ctx.fillStyle = 'rgba(239,68,68,.16)';
    ctx.fillRect(xs - 0.55 * sc, ys - 2.0 * sc, 1.1 * sc, 2.0 * sc);
    ctx.font = `${Math.round(1.25 * sc)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(o.emoji, xs, ys - 0.62 * sc);
  } else {
    ctx.font = `${Math.round(0.85 * sc)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(o.emoji, xs, ys - 0.42 * sc);
  }
  ctx.globalAlpha = 1;
}

function drawItem(it, t) {
  const [xs, ys, sc] = proj(it.x, it.y, it.z);
  const alpha = clamp((100 - it.z) / 24, 0, 1);
  const pulse = 1 + Math.sin(t * 4 + it.z) * 0.06;
  ctx.globalAlpha = alpha;
  if (DPR >= 1.25) { ctx.shadowColor = 'rgba(250,204,21,.85)'; ctx.shadowBlur = 12 * S; }
  ctx.font = `${Math.round(0.5 * sc * pulse)}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(it.k, xs, ys);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawGate(g) {
  const [x1, yb1, s1] = proj(-3.9, 0, g.z);
  const [, yt1] = proj(-3.9, 3.0, g.z);
  const [x2, yb2, s2] = proj(3.9, 0, g.z);
  const [, yt2] = proj(3.9, 3.6, g.z);
  const alpha = clamp((100 - g.z) / 30, 0, 1);
  ctx.globalAlpha = alpha;
  // postes
  ctx.fillStyle = '#2b4a8f';
  ctx.fillRect(x1 - 0.1 * s1, yt1, 0.24 * s1, yb1 - yt1);
  ctx.fillRect(x2 - 0.1 * s2, yt2, 0.24 * s2, yb2 - yt2);
  // travesaño con el cartel
  const [xa, ya] = proj(-3.9, 3.6, g.z);
  const [xb] = proj(3.9, 3.6, g.z);
  const [, yb2p] = proj(-3.9, 2.7, g.z);
  ctx.fillStyle = '#1d3a75';
  ctx.fillRect(xa, ya, xb - xa, yb2p - ya);
  ctx.fillStyle = '#f5f5f5';
  ctx.font = `900 ${Math.max(8, (yb2p - ya) * 0.55)}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('KM ' + String(g.km).padStart(2, '0'), (xa + xb) / 2, (ya + yb2p) / 2);
  ctx.globalAlpha = 1;
}

/* ---------------- Escena completa ---------------- */
function draw() {
  const t = performance.now() / 1000;
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * 16 * shake * S, (Math.random() - .5) * 12 * shake * S);

  drawSky();
  drawBuildings();
  drawRoad();
  drawFog();
  drawStreetFurniture();
  drawStreetBanners();
  drawCrowd(t);

  // entidades ordenadas de lejos a cerca (incluye al corredor)
  const list = [];
  for (const o of obstacles) list.push({ z: o.z, kind: 'obs', o });
  for (const it of items) list.push({ z: it.z, kind: 'item', o: it });
  for (const g of gates) list.push({ z: g.z, kind: 'gate', o: g });
  list.push({ z: ZP, kind: 'player' });
  list.sort((a, b) => b.z - a.z);
  for (const e of list) {
    if (e.kind === 'obs') drawObstacle(e.o);
    else if (e.kind === 'item') drawItem(e.o, t);
    else if (e.kind === 'gate') drawGate(e.o);
    else {
      // jugador
      const [px, py, sc] = proj(player.x, player.y, ZP);
      const blink = invuln > 0 && Math.floor(invuln * 12) % 2 === 0;
      ctx.globalAlpha = blink ? 0.35 : 1;
      // sombra
      const [, sy0, sc0] = proj(player.x, 0, ZP);
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.beginPath();
      ctx.ellipse(px, sy0, 0.5 * sc0 * clamp(1 - player.y * 0.3, 0.4, 1), 0.16 * sc0 * clamp(1 - player.y * 0.3, 0.4, 1), 0, 0, Math.PI * 2);
      ctx.fill();
      if (shield > 0) {
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 7);
        ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 3.5 * S;
        ctx.beginPath(); ctx.ellipse(px, py - hPx * 0.5, hPx * 0.42, hPx * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      drawRunnerBack(px, py, hPx, charId, phase, {
        crouch: player.ducking && player.y < 0.05,
        air: player.y > 0.045,
        tilt: player.tilt
      });
      ctx.globalAlpha = 1;
    }
  }

  // partículas
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // líneas de velocidad (solo sobre la calzada; doradas durante el turbo)
  const speedFx = clamp((speed - 6.6) / 5.2, 0, 1) + (turbo > 0 ? 0.35 : 0);
  if (state === 'run' && speedFx > 0.18) {
    const nL = 3 + Math.round(speedFx * 8);
    const bandY = yH + 26, bandH = Math.max(80, H - yH - 70);
    ctx.strokeStyle = turbo > 0 ? 'rgba(255,205,120,.34)' : `rgba(255,255,255,${(0.07 + speedFx * 0.1).toFixed(3)})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < nL; i++) {
      const yy = bandY + ((i * 97) % bandH);
      const ln = (46 + ((i * 61) % 70)) * (1 + speedFx * 0.9);
      const xx = ((traveled * 190 * (1 + (i % 3) * 0.4)) % (W + 260)) - 130;
      ctx.beginPath();
      ctx.moveTo(W - xx, yy); ctx.lineTo(W - xx + ln, yy); ctx.stroke();
    }
  }
  // tinte azulado suave en cámara lenta
  if (state === 'run' && slow > 0) {
    ctx.fillStyle = 'rgba(120,180,255,.09)';
    ctx.fillRect(0, 0, W, H);
  }

  // popups
  for (const p of popups) {
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.font = `900 ${Math.round(p.size)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.72)';
    ctx.strokeText(p.text, p.x, p.y); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
    ctx.globalAlpha = 1;
  }

  // cuenta atrás
  if (state === 'count') {
    const n = Math.ceil(countT);
    const frac = 1 - (countT - Math.floor(countT));
    const sc2 = 1 + (1 - frac) * 0.35;
    ctx.globalAlpha = 0.92;
    ctx.font = `900 ${Math.round(120 * S * sc2)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(0,0,0,.7)';
    ctx.strokeText(n, CX, H * 0.38); ctx.fillStyle = '#fde047';
    ctx.fillText(n, CX, H * 0.38);
    ctx.font = `900 ${Math.round(24 * S)}px system-ui`;
    ctx.strokeText('¡PREPARADOS!', CX, H * 0.24); ctx.fillText('¡PREPARADOS!', CX, H * 0.24);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

window.__maratonState = () => ({
  state, km: +km.toFixed(3), score, lives, combo: maxCombo, vicios, items: itemsGot,
  lane: player.lane, x: +player.x.toFixed(2), y: +player.y.toFixed(2),
  ducking: player.ducking, shield: +shield.toFixed(2), turbo: +turbo.toFixed(2),
  magnet: +magnet.toFixed(2), slow: +slow.toFixed(2), speed: +speed.toFixed(2),
  obstacles: obstacles.length, itemsOnScreen: items.length, gates: gates.length,
  char: charId, difficulty, api: API, sound: soundOn
});

/* ---------------- Ranking ---------------- */
const API = (function () {
  // Montajes válidos: hub (/ollagitana/olla-gitana-maraton/…) y enlace directo (/nena-y-miguel/)
  const p = location.pathname;
  for (const marker of ['/olla-gitana-maraton', '/nena-y-miguel', '/gitana-nena-miguel']) {
    const i = p.indexOf(marker);
    if (i >= 0) {
      const prefix = p.slice(0, i);
      return (prefix ? prefix.replace(/\/$/, '') : marker) + '/api';
    }
  }
  return p.replace(/\/index\.html$/, '').replace(/\/$/, '') + '/api';
})();

function readLocal() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; } }
function writeLocal(rows) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, 200))); } catch (e) {} }

async function saveScore(name) {
  const entry = {
    game: GAME_ID, diff: difficulty, name: (name || 'Corredor anónimo').slice(0, 14),
    score, combo: maxCombo, acc: Math.floor(km * 1000)
  };
  const local = readLocal();
  local.push({ name: entry.name, score: entry.score, combo: entry.combo, acc: entry.acc, diff: difficulty, ts: Date.now() });
  local.sort((a, b) => b.score - a.score); writeLocal(local);
  try {
    const res = await fetch(`${API}/score`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
    return { online: res.ok };
  } catch (e) { return { online: false }; }
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function renderRanking(diff) {
  const body = el('rankBody');
  body.innerHTML = '<tr><td colspan="4" class="muted">Cargando…</td></tr>';
  let rows = [], online = false;
  try {
    const res = await fetch(`${API}/top?game=${GAME_ID}&diff=${diff}&limit=50`, { cache: 'no-store' });
    if (!res.ok) throw new Error('api');
    const data = await res.json();
    rows = (data.scores || []).map(s => ({ name: s.name, score: s.score, acc: s.acc || 0 }));
    online = true;
  } catch (e) { rows = readLocal().filter(s => s.diff === diff).sort((a, b) => b.score - a.score).slice(0, 20); }
  const src = el('rankSource');
  if (src) {
    src.textContent = online ? '' : 'Sin conexión — mostrando las puntuaciones de este dispositivo.';
    src.style.display = online ? 'none' : 'block';
  }
  if (!rows.length) { body.innerHTML = '<tr><td colspan="4" class="muted">Aún no hay corredores aquí.</td></tr>'; return; }
  body.innerHTML = rows.slice(0, 20).map((s, i) =>
    `<tr class="${i === 0 ? 'top1' : ''}"><td>${i + 1}</td><td>${esc(s.name)}</td><td>${(s.acc / 1000).toFixed(2)} km</td><td>${s.score}</td></tr>`
  ).join('');
}

function updateBest() {
  const node = el('bestScore');
  if (!node) return;
  try {
    const rows = readLocal();
    const best = rows.reduce((m, r) => Math.max(m, r.score || 0), 0);
    node.textContent = best ? `🏆 Tu récord: ${best} puntos` : '';
  } catch (e) {}
}

/* ---------------- Menú: retratos animados ---------------- */
function drawPreviews(t) {
  for (const chr of ['miguel', 'nena']) {
    const cv = el('prev_' + chr);
    if (!cv) continue;
    const c = cv.getContext('2d');
    const cw = cv.width, chh = cv.height;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cw, chh);
    c.save();
    c.translate(cw / 2, chh * 0.96);
    const h = chh * 0.88;
    // sombra
    c.fillStyle = 'rgba(0,0,0,.3)';
    c.beginPath(); c.ellipse(0, 0, h * 0.24, h * 0.05, 0, 0, Math.PI * 2); c.fill();
    drawRunnerFront(c, chr, h, t);
    c.restore();
  }
}

/* ---------------- Bucle ---------------- */
function loop(now) {
  const dt = clamp((now - lastT) / 1000, 0, 0.05);
  lastT = now;
  if (state === 'run' || state === 'count') { update(dt); }
  else if (state === 'end' || state === 'win') { updateFx(dt); }   // el confeti sigue vivo tras la meta
  else if (state === 'menu') { drawPreviews(now / 1000); }
  if (state === 'run' || state === 'count' || state === 'pause' || state === 'end' || state === 'win') draw();
  checkFps(dt);
  rafId = requestAnimationFrame(loop);
}

/* ---------------- Controles ---------------- */
function jump() {
  if (state !== 'run') return;
  if (player.y <= 0.001) {
    player.ducking = false;
    player.vy = JUMP_V; player.holdJump = 0.16;
    beep(520, 0.05, 0.05);
  }
}
function setLane(l) {
  if (state !== 'run') return;
  const nl = clamp(l, 0, 2);
  if (nl !== player.lane) { player.lane = nl; beep(340, 0.035, 0.04); }
}
function setDuck(on) {
  if (state !== 'run') return;
  player.ducking = on;
  if (on && player.y > 0.001) player.vy -= 6;        // caída rápida al agacharse en el aire
}

let touchId = null, touchX = 0, touchY = 0, touchMoved = false, duckHold = false, duckTimer = 0;
canvas.addEventListener('pointerdown', e => {
  if (state !== 'run') return;
  touchId = e.pointerId; touchX = e.clientX; touchY = e.clientY; touchMoved = false;
});
canvas.addEventListener('pointermove', e => {
  if (state !== 'run' || e.pointerId !== touchId) return;
  const dx = e.clientX - touchX, dy = e.clientY - touchY;
  if (Math.abs(dx) > 34 * S && Math.abs(dx) > Math.abs(dy)) {
    setLane(player.lane + (dx > 0 ? 1 : -1));
    touchX = e.clientX; touchMoved = true;
  } else if (dy > 40 * S && Math.abs(dy) > Math.abs(dx)) {
    setDuck(true); duckHold = true; touchMoved = true; duckTimer = 0;
    touchY = e.clientY;
  } else if (dy < -40 * S && Math.abs(dy) > Math.abs(dx)) {
    jump(); touchMoved = true; touchY = e.clientY;
  }
});
canvas.addEventListener('pointerup', e => {
  if (e.pointerId !== touchId) return;
  touchId = null;
  if (duckHold) { duckHold = false; duckTimer = 0.28; }        // pequeña gracia al soltar
  else if (!touchMoved) jump();                                  // toque simple = saltar
});
canvas.addEventListener('pointercancel', () => { touchId = null; duckHold = false; setDuck(false); });

document.addEventListener('keydown', e => {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w') { e.preventDefault(); jump(); }
  if (e.code === 'ArrowLeft' || e.key === 'a') setLane(player.lane - 1);
  if (e.code === 'ArrowRight' || e.key === 'd') setLane(player.lane + 1);
  if (e.code === 'ArrowDown' || e.key === 's') { e.preventDefault(); setDuck(true); }
  if (e.key === 'p' || e.key === 'P') togglePause();
  if (e.key === 'm' || e.key === 'M') toggleSound();
});
document.addEventListener('keyup', e => {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (e.code === 'ArrowDown' || e.key === 's') setDuck(false);
});
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());

/* ---------------- UI ---------------- */
let rankDiff = 'normal';

function selectChar(chr) {
  charId = chr;
  savePref({ maratonChar: chr });
  for (const c of ['miguel', 'nena']) {
    const card = el('card_' + c);
    if (card) card.classList.toggle('sel', c === chr);
  }
}

el('charRow').addEventListener('click', e => {
  const b = e.target.closest('.charCard'); if (!b) return;
  selectChar(b.dataset.chr);
});
el('diffRow').addEventListener('click', e => {
  const b = e.target.closest('.diff'); if (!b) return;
  difficulty = b.dataset.diff;
  [...el('diffRow').children].forEach(c => c.classList.toggle('active', c === b));
});
el('btnPlay').addEventListener('click', () => startGame(difficulty, charId));
el('btnHow').addEventListener('click', () => show(el('howModal')));
el('btnCloseHow').addEventListener('click', () => hide(el('howModal')));
el('btnCloseHow2').addEventListener('click', () => hide(el('howModal')));
el('btnPause').addEventListener('click', togglePause);
el('btnResume').addEventListener('click', togglePause);
el('btnRestart').addEventListener('click', () => { hide(el('pauseScreen')); startGame(difficulty, charId); });
el('btnQuit').addEventListener('click', backToMenu);
el('btnMenu').addEventListener('click', backToMenu);
el('btnAgain').addEventListener('click', () => startGame(difficulty, charId));
el('btnEndMenu').addEventListener('click', backToMenu);
el('btnWinAgain').addEventListener('click', () => startGame(difficulty, charId));
el('btnWinMenu').addEventListener('click', backToMenu);

function backToMenu() {
  state = 'menu';
  stopMusic();
  hide(el('pauseScreen')); hide(el('endScreen')); hide(el('winScreen')); hide(el('rankScreen')); hide(el('hud'));
  show(el('startScreen'));
  updateBest();
}

function toggleSound() {
  soundOn = !soundOn;
  savePref({ sound: soundOn });
  el('btnSound').textContent = soundOn ? '🔊' : '🔇';
  if (audio.music) audio.music.muted = !soundOn;
}
el('btnSound').addEventListener('click', toggleSound);
el('btnLogros').addEventListener('click', () => { try { logros.panel(); } catch (e) {} });
el('btnRanking').addEventListener('click', () => {
  rankDiff = difficulty;
  [...el('rankTabs').children].forEach(c => c.classList.toggle('active', c.dataset.diff === rankDiff));
  renderRanking(rankDiff); show(el('rankScreen'));
});
el('btnCloseRank').addEventListener('click', () => hide(el('rankScreen')));
el('rankTabs').addEventListener('click', e => {
  const b = e.target.closest('.tab'); if (!b) return;
  rankDiff = b.dataset.diff;
  [...el('rankTabs').children].forEach(c => c.classList.toggle('active', c === b));
  renderRanking(rankDiff);
});
el('btnSaveScore').addEventListener('click', async () => {
  if (savingScore) return;
  savingScore = true;
  const b = el('btnSaveScore'); if (b) { b.disabled = true; b.textContent = 'Guardando…'; }
  let r = { online: false };
  try { r = await saveScore(el('playerName').value.trim()); } catch (e) {}
  savePref({ name: el('playerName').value.trim() });
  el('nameRow').classList.add('hidden'); updateBest();
  toast(r.online ? '¡Puntuación guardada! 🏆' : 'Guardada en este dispositivo', 2200);
});
el('btnWinSave').addEventListener('click', async () => {
  if (savingScore) return;
  savingScore = true;
  const b = el('btnWinSave'); if (b) { b.disabled = true; b.textContent = 'Guardando…'; }
  let r = { online: false };
  try { r = await saveScore(el('winName').value.trim()); } catch (e) {}
  savePref({ name: el('winName').value.trim() });
  el('winNameRow').classList.add('hidden'); updateBest();
  toast(r.online ? '¡Puntuación guardada! 🏆' : 'Guardada en este dispositivo', 2200);
});

let toastT = null;
function toast(msg, ms = 1600) {
  const t = el('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}

/* ---------------- Arranque ---------------- */
resize();
window.addEventListener('resize', () => { resize(); });

// tamaño de los canvas de retrato (nítidos en pantalla)
(function sizePortraits() {
  for (const chr of ['miguel', 'nena']) {
    const cv = el('prev_' + chr);
    if (!cv) continue;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = cv.getBoundingClientRect();
    cv.width = Math.round((r.width || 120) * dpr);
    cv.height = Math.round((r.height || 150) * dpr);
  }
})();

// restaurar preferencias (nombre, sonido, corredor)
(function restorePrefs() {
  try {
    const p = loadPrefs();
    if (p.sound === false) { soundOn = false; const b = el('btnSound'); if (b) b.textContent = '🔇'; }
    if (p.maratonChar === 'nena' || p.maratonChar === 'miguel') selectChar(p.maratonChar);
    else selectChar('miguel');
    if (p.name) el('playerName').value = p.name, el('winName').value = p.name;
  } catch (e) { selectChar('miguel'); }
})();

updateBest();
lastT = performance.now();
rafId = requestAnimationFrame(loop);

document.addEventListener('visibilitychange', onVisibility);

/* Enganches de test/QA */
window.__maraton = {
  start: (d, c) => startGame(d || difficulty, c || charId),
  state: () => window.__maratonState(),
  jump, duck: on => setDuck(!!on), lane: l => setLane(l),
  setKm: v => { km = v; kmShown = Math.floor(v) - 1; },
  god: v => { invuln = v; },
  power: k => applyPower(k),
  obstacles: () => obstacles.map(o => ({ type: o.type, z: +o.z.toFixed(2), x: +o.x.toFixed(2), hit: o.hit })),
  itemsDbg: () => items.map(it => ({ k: it.k, z: +it.z.toFixed(2), x: +it.x.toFixed(2) })),
  hitDebug: () => { lives = Math.max(0, lives - 1); if (lives <= 0) gameOver(); },
  win: () => { km = MARATHON_KM; winGame(); }
};
