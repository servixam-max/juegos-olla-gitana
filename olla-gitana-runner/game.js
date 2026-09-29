/* Olla Gitana: La Huerta Runner — endless runner mobile-first
   Reusa los assets de la banda (fondos de Murcia, música, sfx). */
'use strict';

/* ---------------- Setup ---------------- */
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1, S = 1;          // S = escala relativa a 800px de alto

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  S = Math.max(0.62, Math.min(1.5, H / 800));
  GROUND_Y = H * 0.80;
}
const el = id => document.getElementById(id);
const show = n => n.classList.remove('hidden');
const hide = n => n.classList.add('hidden');
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------------- Config ---------------- */
const GAME_ID = 'runner';
const STORAGE_KEY = 'olla_runner_scores_v1';

const DIFF = {
  easy:   { label: 'FÁCIL 🐢',   speed: 0.82, spawn: 1.28, gaps: [1.30, 2.30] },
  normal: { label: 'NORMAL 🥘',  speed: 1.00, spawn: 1.00, gaps: [1.05, 1.95] },
  hard:   { label: 'CANALLA 🔥', speed: 1.22, spawn: 0.82, gaps: [0.86, 1.62] }
};

const ITEMS = ['🍐', '🌿', '🧆', '🌶️', '🥘'];
const OBSTACLES_GROUND = ['🚧', '💊', '🧱'];
const OBSTACLES_AIR = ['🚬', '💉', '🦟'];

const PHRASES_UP = ['¡Acho, qué bueno!', '¡Zarangollo Power!', '¡Vaya tela!', '¡Gusa!', '¡Ole tu pijo!',
  '¡Paparajote!', '¡Zagala, dale!', '¡A la fresca!', '¡Menudo estropicio!', '¡Tira p\'alante!',
  '¡Picoesquina!', '¡Encaramarse!'];
const PHRASES_HIT = ['¡Arrea!', '¡Ojú!', '¡Miaja!', '¡Emperifollá!', '¡Follonero!', '¡Sobaquillo!'];
const PHRASES_END = ['¡Se te ha ido la olla!', '¡Menudo pijo!', '¡Gambitero!', '¡Te has quedao pajarito!', '¡Ojete calor!'];

const BACKGROUNDS = Array.from({ length: 14 }, (_, i) => `assets/bg_${i + 1}.jpg`);

/* ---------------- Estado ---------------- */
let running = false, paused = false, rafId = 0, lastT = 0;
let difficulty = 'normal';
let GROUND_Y = 0;

let meters = 0, itemPoints = 0, points = 0, lives = 3, level = 1;
let combo = 0, maxCombo = 0, itemsGot = 0, invuln = 0, shake = 0;
let speed = 0, spawnTimer = 0, itemTimer = 0;
let obstacles = [], items = [], particles = [], popups = [];
let bgIdx = 0, bgImgs = {}, bgReady = null;
let soundOn = true;

const audio = {
  music: null, started: false,
  hit: new Audio('assets/hit.mp3'),
  up: new Audio('assets/levelup_special.mp3')
};

function multTier(c) { return c >= 40 ? 5 : c >= 25 ? 4 : c >= 12 ? 3 : c >= 5 ? 2 : 1; }
const mult = () => multTier(combo);

/* ---------------- Jugador ---------------- */
const player = {
  x: 0, y: 0, vy: 0, w: 0, h: 0,
  onGround: true, jumps: 0, ducking: false, holdJump: 0, rot: 0, squash: 1
};

function resetPlayer() {
  player.w = 74 * S; player.h = 56 * S;
  player.x = Math.max(70 * S, W * 0.17);
  player.y = GROUND_Y - player.h;
  player.vy = 0; player.onGround = true; player.jumps = 0;
  player.ducking = false; player.holdJump = 0; player.rot = 0; player.squash = 1;
}

function playerRect() {
  const h = player.ducking && player.onGround ? player.h * 0.55 : player.h;
  return { x: player.x - player.w * 0.42, y: GROUND_Y - h + (player.onGround ? 0 : player.y + player.h - GROUND_Y), w: player.w * 0.84, h };
}

/* ---------------- Audio ---------------- */
function initMusic() {
  if (audio.music) return;
  audio.music = new Audio('assets/music.mp3');
  audio.music.loop = true;
  audio.music.volume = 0.55;
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

/* ---------------- Fondos ---------------- */
function loadBg(i) {
  const src = BACKGROUNDS[i % BACKGROUNDS.length];
  if (bgImgs[src]) { bgReady = bgImgs[src]; return; }
  const img = new Image();
  img.onload = () => { bgImgs[src] = img; if (i % BACKGROUNDS.length === bgIdx) bgReady = img; };
  img.src = src;
}
function setBg(i) { bgIdx = i % BACKGROUNDS.length; bgReady = bgImgs[BACKGROUNDS[i]] || null; loadBg(bgIdx); loadBg(bgIdx + 1); }

/* ---------------- Partida ---------------- */
function startGame(diff) {
  difficulty = diff || difficulty;
  const cfg = DIFF[difficulty];
  running = true; paused = false;
  meters = 0; itemPoints = 0; points = 0; lives = 3; level = 1; combo = 0; maxCombo = 0; itemsGot = 0;
  invuln = 0; shake = 0;
  obstacles = []; items = []; particles = []; popups = [];
  speed = 330 * S * cfg.speed;
  spawnTimer = 1.1; itemTimer = 0.8;
  setBg(Math.floor(Math.random() * 3));
  resize(); resetPlayer();
  hide(el('startScreen')); hide(el('endScreen')); hide(el('pauseScreen')); hide(el('rankScreen'));
  show(el('hud'));
  el('progressBar').style.width = '0%';
  playMusic();
  lastT = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
  document.addEventListener('visibilitychange', onVisibility);
}

function gameOver() {
  running = false; stopMusic();
  cancelAnimationFrame(rafId);
  hide(el('hud'));
  el('endTitle').textContent = PHRASES_END[Math.floor(Math.random() * PHRASES_END.length)];
  el('endPhrase').textContent = `${Math.floor(meters)} m en la huerta · nivel ${level}`;
  el('endScore').textContent = points;
  el('endMeters').textContent = Math.floor(meters);
  el('endItems').textContent = itemsGot;
  el('endLevel').textContent = level;
  el('nameRow').classList.remove('hidden');
  show(el('endScreen'));
}

function onVisibility() { if (document.hidden && running && !paused) togglePause(); }

function togglePause() {
  if (!running) return;
  paused = !paused;
  if (paused) { el('pauseScreen').classList.remove('hidden'); try { audio.music && audio.music.pause(); } catch (e) {} }
  else { el('pauseScreen').classList.add('hidden'); lastT = performance.now(); playMusic(); }
}

/* ---------------- Spawns ---------------- */
function spawnObstacle() {
  const cfg = DIFF[difficulty];
  const air = Math.random() < (level >= 2 ? 0.34 : 0.16);
  const kind = air ? OBSTACLES_AIR[Math.floor(Math.random() * OBSTACLES_AIR.length)]
                   : OBSTACLES_GROUND[Math.floor(Math.random() * OBSTACLES_GROUND.length)];
  const size = (air ? 52 : 58) * S;
  obstacles.push({
    type: air ? 'air' : 'ground', emoji: kind,
    x: W + size, w: size, h: size,
    y: air ? GROUND_Y - 86 * S : GROUND_Y - size      // aire = a la altura de la cabeza: agacharse o saltar
  });
  const gapScale = clamp(1.06 - level * 0.028, 0.72, 1.06);
  spawnTimer = rand(cfg.gaps[0], cfg.gaps[1]) * gapScale;
}

function spawnItem() {
  const emoji = ITEMS[Math.floor(Math.random() * ITEMS.length)];
  const size = 44 * S;
  const air = Math.random() < 0.55;
  items.push({
    emoji, x: W + size, w: size, h: size,
    y: air ? GROUND_Y - rand(96, 190) * S : GROUND_Y - size - 6 * S
  });
  itemTimer = rand(0.7, 1.5);
}

/* ---------------- Update ---------------- */
function update(dt) {
  const cfg = DIFF[difficulty];
  const targetSpeed = (330 + level * 26) * S * cfg.speed;
  speed += (targetSpeed - speed) * Math.min(1, dt * 0.9);

  // distancia y puntos base
  meters += (speed * dt) / (46 * S);

  // física del jugador
  const gravity = 2350 * S;
  if (player.holdJump > 0 && player.vy < 0) { player.vy -= gravity * 0.42 * dt; player.holdJump -= dt; }
  if (player.ducking && !player.onGround) player.vy += gravity * 0.9 * dt;    // caída rápida
  player.vy += gravity * dt;
  const py = player.y + player.vy * dt;
  const floorY = GROUND_Y - player.h;
  if (py >= floorY) {
    if (!player.onGround) { player.squash = 0.82; landDust(); }
    player.y = floorY; player.vy = 0; player.onGround = true; player.jumps = 0;
  } else { player.y = py; player.onGround = false; }
  player.squash += (1 - player.squash) * Math.min(1, dt * 9);
  if (!player.onGround) player.rot += dt * (player.vy < 0 ? 5.2 : 7.5);
  else player.rot += (0 - player.rot) * Math.min(1, dt * 8);

  // invulnerabilidad
  if (invuln > 0) invuln -= dt;
  if (shake > 0) shake -= dt * 2.4;

  // obstáculos
  spawnTimer -= dt;
  if (spawnTimer <= 0) spawnObstacle();
  const pr = playerRect();
  for (const o of obstacles) o.x -= speed * dt;
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    if (o.x + o.w < -20) { obstacles.splice(i, 1); continue; }
    const ob = { x: o.x + o.w * 0.18, y: o.y + o.h * 0.12, w: o.w * 0.64, h: o.h * 0.76 };
    if (invuln <= 0 && hit(pr, ob)) {
      lives--; combo = 0; invuln = 1.6; shake = 1;
      sfx('hit', 0.85);
      popup(PHRASES_HIT[Math.floor(Math.random() * PHRASES_HIT.length)], '#fca5a5', player.x + 40 * S, GROUND_Y - 170 * S);
      burst(o.x, o.y + o.h / 2, 12, '#f87171');
      obstacles.splice(i, 1);
      if (lives <= 0) { gameOver(); return; }
    }
  }

  // ingredientes
  itemTimer -= dt;
  if (itemTimer <= 0) spawnItem();
  for (const it of items) it.x -= speed * dt;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.x + it.w < -20) { items.splice(i, 1); continue; }
    if (hit(pr, { x: it.x + 6 * S, y: it.y + 6 * S, w: it.w - 12 * S, h: it.h - 12 * S })) {
      itemsGot++; combo++; maxCombo = Math.max(maxCombo, combo);
      itemPoints += 10 * mult();
      burst(it.x, it.y + it.h / 2, 7, '#fcd34d');
      popup('+' + 10 * mult(), '#fde68a', it.x, it.y - 10 * S);
      sfx('hit', 0.45);
      items.splice(i, 1);
    }
  }

  // partículas / popups
  for (const p of particles) { p.x -= speed * dt * 0.55; p.y += p.vy * dt; p.vy += 900 * S * dt; p.life -= dt * 1.5; }
  particles = particles.filter(p => p.life > 0);
  for (const p of popups) { p.y -= 60 * S * dt; p.life -= dt * 0.9; }
  popups = popups.filter(p => p.life > 0);

  // puntuación y niveles
  points = Math.floor(meters) + itemPoints;
  const nextLevel = Math.floor(points / 500) + 1;
  if (nextLevel > level) {
    level = nextLevel;
    setBg(bgIdx + 1);
    sfx('up', 0.8); shake = 0.5;
    popup(PHRASES_UP[Math.floor(Math.random() * PHRASES_UP.length)], '#86efac', W * 0.5, H * 0.32);
  }
  el('progressBar').style.width = ((points % 500) / 5) + '%';
}

function hit(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

function burst(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    particles.push({ x, y, vx: rand(-160, 160) * S, vy: rand(-320, -60) * S, life: rand(0.4, 0.95), color, r: rand(2, 5) * S });
  }
}
function landDust() { for (let i = 0; i < 6; i++) burst(player.x - 20 * S, GROUND_Y, 1, 'rgba(255,255,255,.5)'); }
function popup(text, color, x, y) { popups.push({ text, color, x, y, life: 1, size: 22 * S }); }

/* ---------------- Dibujo ---------------- */
function draw() {
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * 16 * shake * S, (Math.random() - .5) * 12 * shake * S);

  // fondo con parallax
  if (bgReady && bgReady.width) {
    const scale = Math.max(W / bgReady.width, H / bgReady.height) * 1.04;
    const dw = bgReady.width * scale, dh = bgReady.height * scale;
    const off = (meters * 9 * S) % dw;
    ctx.globalAlpha = 0.62;
    ctx.drawImage(bgReady, -off, (H - dh) / 2, dw, dh);
    ctx.drawImage(bgReady, dw - off, (H - dh) / 2, dw, dh);
    ctx.globalAlpha = 1;
  }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(9,5,3,.68)'); g.addColorStop(.55, 'rgba(9,5,3,.34)'); g.addColorStop(1, 'rgba(9,5,3,.82)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // suelo
  const gy = GROUND_Y;
  ctx.fillStyle = 'rgba(20,12,6,.85)'; ctx.fillRect(0, gy, W, H - gy);
  ctx.strokeStyle = 'rgba(250,204,21,.65)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2;
  const dash = 46 * S, offD = (meters * 20 * S) % (dash * 2);
  ctx.beginPath();
  for (let x = -offD; x < W + dash; x += dash * 2) { ctx.moveTo(x, gy + 14 * S); ctx.lineTo(x + dash, gy + 14 * S); }
  ctx.stroke();

  // obstáculos
  for (const o of obstacles) {
    ctx.font = `${Math.round(o.h)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, GROUND_Y + 4 * S, o.w * 0.42, o.h * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillText(o.emoji, o.x + o.w / 2, o.y + o.h / 2);
    if (o.type === 'air') {
      ctx.strokeStyle = 'rgba(255,120,120,.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(o.x + o.w / 2, GROUND_Y); ctx.lineTo(o.x + o.w / 2, o.y + o.h); ctx.stroke();
    }
  }
  // ingredientes (con brillo)
  for (const it of items) {
    const pulse = 1 + Math.sin((it.x + performance.now() / 260)) * 0.06;
    ctx.font = `${Math.round(it.h * pulse)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(250,204,21,.85)'; ctx.shadowBlur = 14 * S;
    ctx.fillText(it.emoji, it.x + it.w / 2, it.y + it.h / 2);
    ctx.shadowBlur = 0;
  }

  // jugador (la olla)
  const blink = invuln > 0 && Math.floor(invuln * 12) % 2 === 0;
  ctx.globalAlpha = blink ? 0.35 : 1;
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath(); ctx.ellipse(player.x, GROUND_Y + 4 * S, player.w * 0.4, player.h * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(player.x, player.y + player.h / 2);
  ctx.rotate(player.rot * 0.06);
  const sq = player.squash, w = player.w * (2 - sq), h = player.h * sq;
  ctx.font = `${Math.round(h * 1.06)}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🥘', 0, 0);
  ctx.restore();
  ctx.globalAlpha = 1;

  // partículas
  for (const p of particles) { ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;

  // popups
  for (const p of popups) {
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.font = `900 ${Math.round(p.size)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.72)';
    ctx.strokeText(p.text, p.x, p.y); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // HUD
  el('lives').textContent = Math.max(0, lives);
  el('score').textContent = points;
  el('level').textContent = level;
  const m = el('mult'); m.textContent = 'x' + mult(); m.classList.toggle('pop', mult() > 1);
}

function loop(now) {
  if (!running) return;
  const dt = clamp((now - lastT) / 1000, 0, 0.05);
  lastT = now;
  if (!paused) { update(dt); }
  draw();
  if (running) rafId = requestAnimationFrame(loop);
}

/* ---------------- Controles ---------------- */
let touchId = null, touchStartY = 0;
function jump() {
  if (!running || paused) return;
  if (player.onGround && !player.ducking) { player.vy = -900 * S; player.onGround = false; player.jumps = 1; player.holdJump = 0.17; }
  else if (player.jumps < 2) { player.vy = -780 * S; player.jumps = 2; player.holdJump = 0.13; }
}
canvas.addEventListener('pointerdown', e => {
  if (!running) return;
  touchId = e.pointerId; touchStartY = e.clientY;
  jump();
});
canvas.addEventListener('pointermove', e => {
  if (!running || e.pointerId !== touchId) return;
  if (e.clientY - touchStartY > 42 * S) { player.ducking = true; }
});
canvas.addEventListener('pointerup', e => {
  if (e.pointerId === touchId) { touchId = null; player.ducking = false; player.holdJump = 0; }
});
canvas.addEventListener('pointercancel', () => { touchId = null; player.ducking = false; player.holdJump = 0; });

document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w') { e.preventDefault(); jump(); }
  if (e.code === 'ArrowDown' || e.key === 's') player.ducking = true;
  if (e.key === 'p' || e.key === 'P') togglePause();
  if (e.key === 'm' || e.key === 'M') toggleSound();
});
document.addEventListener('keyup', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') player.holdJump = 0;
  if (e.code === 'ArrowDown' || e.key === 's') player.ducking = false;
});
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());

/* ---------------- Ranking (servidor de casa + respaldo local) ---------------- */
const API = (function () {
  const p = location.pathname;                        // '/juegos-olla/olla-gitana-runner/…'
  const i = p.indexOf('/olla-gitana-runner');
  const base = i >= 0 ? p.slice(0, i) : '/';
  return base.replace(/\/$/, '') + '/api';
})();

function readLocal() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; } }
function writeLocal(rows) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, 200))); } catch (e) {} }

async function saveScore(name) {
  const entry = {
    game: GAME_ID, diff: difficulty, name: (name || 'Zagal anónimo').slice(0, 14),
    score: points, combo: maxCombo, acc: Math.floor(meters)
  };
  const local = readLocal();
  local.push({ name: entry.name, score: entry.score, combo: entry.combo, acc: entry.acc, diff: difficulty, ts: Date.now() });
  local.sort((a, b) => b.score - a.score); writeLocal(local);
  try {
    const res = await fetch(`${API}/score`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
    return { online: res.ok };
  } catch (e) { return { online: false }; }
}

async function renderRanking(diff) {
  const body = el('rankBody');
  body.innerHTML = '<tr><td colspan="4" class="muted">Cargando…</td></tr>';
  let rows = [], online = false;
  try {
    const res = await fetch(`${API}/top?game=${GAME_ID}&diff=${diff}&limit=50`, { cache: 'no-store' });
    if (!res.ok) throw new Error('api');
    const data = await res.json();
    rows = (data.scores || []).map(s => ({ name: s.name, score: s.score, acc: s.acc || 0, combo: s.combo || 0 }));
    online = true;
  } catch (e) { rows = readLocal().filter(s => s.diff === diff).sort((a, b) => b.score - a.score).slice(0, 20); }
  const src = el('rankSource');
  if (src) src.textContent = online
    ? 'Ranking guardado en el servidor de casa (Mac) — se comparte entre todos los móviles.'
    : 'Sin conexión al servidor: mostrando el ranking guardado en este dispositivo.';
  if (!rows.length) { body.innerHTML = '<tr><td colspan="4" class="muted">Aún no hay zagales aquí.</td></tr>'; return; }
  body.innerHTML = rows.slice(0, 20).map((s, i) =>
    `<tr class="${i === 0 ? 'top1' : ''}"><td>${i + 1}</td><td>${esc(s.name)}</td><td>${s.acc || 0} m</td><td>${s.score}</td></tr>`
  ).join('');
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- UI ---------------- */
let rankDiff = 'normal';
el('diffRow').addEventListener('click', e => {
  const b = e.target.closest('.diff'); if (!b) return;
  difficulty = b.dataset.diff;
  [...el('diffRow').children].forEach(c => c.classList.toggle('active', c === b));
  rankDiff = difficulty;
});
el('btnPlay').addEventListener('click', () => startGame(difficulty));
el('btnHow').addEventListener('click', () => show(el('howModal')));
el('btnCloseHow').addEventListener('click', () => hide(el('howModal')));
el('btnCloseHow2').addEventListener('click', () => hide(el('howModal')));
el('btnPause').addEventListener('click', togglePause);
el('btnResume').addEventListener('click', togglePause);
el('btnRestart').addEventListener('click', () => { hide(el('pauseScreen')); startGame(difficulty); });
el('btnQuit').addEventListener('click', backToMenu);
el('btnMenu').addEventListener('click', backToMenu);
el('btnAgain').addEventListener('click', () => startGame(difficulty));
el('btnEndMenu').addEventListener('click', backToMenu);

function backToMenu() {
  running = false; paused = false; cancelAnimationFrame(rafId); stopMusic();
  hide(el('pauseScreen')); hide(el('endScreen')); hide(el('rankScreen')); hide(el('hud'));
  show(el('startScreen'));
}
el('btnSound').addEventListener('click', toggleSound);
function toggleSound() {
  soundOn = !soundOn;
  el('btnSound').textContent = soundOn ? '🔊' : '🔇';
  if (audio.music) audio.music.muted = !soundOn;
}
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
  const r = await saveScore(el('playerName').value.trim());
  el('nameRow').classList.add('hidden');
  toast(r.online ? '¡Guardada en el ranking de casa! 🏆' : 'Guardada en este dispositivo (servidor no disponible)', 2200);
});

/* ---------------- Toast ---------------- */
let toastT = null;
function toast(msg, ms = 1600) {
  const t = el('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}

/* ---------------- Arranque ---------------- */
resize();
window.addEventListener('resize', () => { if (!running) { resize(); resetPlayer(); draw(); } });
setBg(0); loadBg(1); loadBg(2);
resetPlayer();
draw();
window.__runnerState = () => ({ running, paused, score: points, meters: Math.floor(meters), lives, level, combo: maxCombo, items: itemsGot, obstacles: obstacles.length, itemsOnScreen: items.length, api: API, difficulty });
