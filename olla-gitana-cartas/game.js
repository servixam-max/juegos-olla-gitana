/* Olla Gitana: Siete y Media — juego de cartas (baraja española)
   Reglas: acercarse a 7½ sin pasarse. Figuras (sota/caballo/rey) valen ½.
   Audio: pitido leve al pedir carta / ganar mano; hit.mp3 SOLO al perder vida. */
'use strict';

const el = id => document.getElementById(id);
const show = n => n.classList.remove('hidden');
const hide = n => n.classList.add('hidden');
const rand = (a, b) => a + Math.random() * (b - a);

/* ---------------- Preferencias compartidas (nombre, sonido) ----------------
   Misma clave que el resto de juegos de la banda: olla_prefs_v1 */
const PREFS_KEY = 'olla_prefs_v1';
function loadPrefs() { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch (e) { return {}; } }
function savePrefs(patch) {
  try { const p = loadPrefs(); Object.assign(p, patch); localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch (e) {}
}
window.savePref = (name, sound) => {
  const p = {};
  if (name !== undefined) p.name = name;
  if (sound !== undefined) p.sound = sound;
  savePrefs(p);
};

/* ---------------- Config ---------------- */
const GAME_ID = 'cartas';
const STORAGE_KEY = 'olla_cartas_scores_v1';
const TARGET = 7.5;

const DIFF = {
  easy:   { label: 'FÁCIL 🐢',   stand: 5.0, tiePlayer: true,  dealerBustBias: 0.22 },
  normal: { label: 'NORMAL 🥘',  stand: 5.5, tiePlayer: false, dealerBustBias: 0.12 },
  hard:   { label: 'CANALLA 🔥', stand: 6.0, tiePlayer: false, dealerBustBias: 0.05 }
};

const SUITS = [
  { id: 'oro',    emoji: '🪙', name: 'oros' },
  { id: 'copa',   emoji: '🍷', name: 'copas' },
  { id: 'espada', emoji: '⚔️', name: 'espadas' },
  { id: 'basto',  emoji: '🌿', name: 'bastos' }
];
const FIGURES = { 10: { name: 'SOTA', emoji: '🧑' }, 11: { name: 'CABALLO', emoji: '🐴' }, 12: { name: 'REY', emoji: '👑' } };

const PHRASES_WIN = ['¡Toma ya!', '¡Ole tu pijo!', '¡Zarangollo!', '¡Vaya tela!', '¡Gusa!', '¡Miaja!'];
const PHRASES_LOSE = ['¡Arrea!', '¡Menudo pijo!', '¡Ojú!', '¡Cagüen la mar!', '¡Emperifollá!'];
const PHRASES_END = ['¡Se te ha ido la olla!', '¡Gambitero!', '¡Te has quedao pajarito!', '¡Ojete calor!'];

/* ---------------- Audio ---------------- */
let soundOn = true;
let music = null;
let beepCtx = null;

function initAudio() {
  if (music) return;
  music = new Audio('../olla-gitana/music.mp3');
  music.loop = true;
  music.volume = 0.32;
}
function playMusic() { initAudio(); try { music.muted = !soundOn; music.play().catch(() => {}); } catch (e) {} }
function stopMusic() { try { music && music.pause(); } catch (e) {} }

// pitido leve (aciertos / cartas / manos ganadas)
function beep(freq = 880, dur = 0.075, vol = 0.085, type = 'triangle') {
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
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    osc.connect(g); g.connect(beepCtx.destination);
    osc.start(now); osc.stop(now + dur + 0.02);
  } catch (e) {}
}
// audio del usuario: SOLO fallos / pérdida de vida
function sfxLoss(vol = 0.85) {
  if (!soundOn) return;
  try { const a = new Audio('../olla-gitana/hit.mp3'); a.volume = vol; a.play().catch(() => {}); } catch (e) {}
}
function sfxLevel() {
  if (!soundOn) return;
  try { const a = new Audio('../olla-gitana/levelup_special.mp3'); a.volume = 0.8; a.play().catch(() => {}); } catch (e) {}
}

/* ---------------- Baraja ---------------- */
function buildDeck() {
  const deck = [];
  for (const s of SUITS) {
    for (const r of [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]) deck.push({ rank: r, suit: s.id, emoji: s.emoji });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
const cardValue = c => (c.rank <= 7 ? c.rank : 0.5);
const handTotal = h => h.reduce((a, c) => a + cardValue(c), 0);
function fmt(t) {
  if (t === 0) return '0';
  const whole = Math.floor(t), half = t - whole === 0.5;
  if (whole === 0) return '½';
  return whole + (half ? '½' : '');
}

/* ---------------- Estado ---------------- */
let difficulty = 'normal';
let running = false, paused = false;
let deck = [], player = [], dealer = [];
let lives = 3, points = 0, level = 1, streak = 0, maxStreak = 0, handsWon = 0, handsPlayed = 0;
let dealerHidden = false, phase = 'idle', busy = false, handResolved = false;
let doubled = false;          // apuesta DOBLAR activa en esta mano
let epoch = 0;                // sube al reiniciar partida: los temporizadores viejos se ignoran

/* Temporizador "seguro": si la partida se reinició (epoch distinto), no se ejecuta;
   si el juego está en pausa, espera a reanudar (antes la banca seguía jugando
   detrás de la pantalla de pausa). */
function later(ms, fn) {
  const ep = epoch;
  const run = () => {
    if (ep !== epoch || !running) return;
    if (paused) { setTimeout(run, 150); return; }
    fn();
  };
  setTimeout(run, ms);
}

const multTier = s => (s >= 10 ? 5 : s >= 6 ? 4 : s >= 4 ? 3 : s >= 2 ? 2 : 1);
const mult = () => multTier(streak);

/* ---------------- Render ---------------- */
let prevN = { p: 0, d: 0 };        // nº de cartas ya pintadas (anima solo las nuevas)
let prevDealerHidden = true;

function cardEl(card, faceDown, animate = true) {
  const d = document.createElement('div');
  d.className = 'card' + (animate ? ' deal' : '');
  if (faceDown) {
    d.classList.add('back');
    d.innerHTML = `<div class="fig"><span class="num">🥘</span><span class="figName">OLLA</span></div>`;
    return d;
  }
  d.classList.add(card.suit);
  const fig = FIGURES[card.rank];
  const label = fig ? '½' : String(card.rank);
  const center = fig
    ? `<div class="fig"><span class="num">${fig.emoji}</span><span class="figName">${fig.name}</span><span class="suit">${card.emoji} ½</span></div>`
    : `<div class="fig"><span class="num">${card.rank}</span><span class="suit">${card.emoji}</span></div>`;
  d.innerHTML = `<span class="corner tl">${label}</span>${center}<span class="corner br">${label}</span>`;
  return d;
}

/* Ajusta la mano para que NUNCA se corte: si las cartas no caben, se solapan.
   (Antes, con 5+ cartas, la primera y la última se salían de la pantalla.) */
function fitHand(node, n) {
  if (!node) return;
  const kids = [...node.children];
  kids.forEach(c => { c.style.marginLeft = ''; });
  node.style.gap = '';
  if (n <= 1 || !kids.length) return;
  const cs = getComputedStyle(node);
  const avail = node.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  const cw = kids[0].offsetWidth || 1;
  const baseGap = 6;
  if (!avail || avail >= n * cw + (n - 1) * baseGap) return;   // caben con hueco normal
  const step = (avail - cw) / (n - 1);
  const minStep = Math.min(cw, 18);                            // al menos 18px visibles por carta
  const s = Math.max(step, minStep);
  if (s >= cw) { node.style.gap = Math.max(0, s - cw) + 'px'; }
  else { node.style.gap = '0px'; kids.forEach((c, i) => { if (i > 0) c.style.marginLeft = (s - cw) + 'px'; }); }
}

function render() {
  const ph = el('youHand'), dh = el('bancaHand');
  const nP = player.length, nD = dealer.length;
  ph.innerHTML = ''; dh.innerHTML = '';
  player.forEach((c, i) => ph.appendChild(cardEl(c, false, i >= prevN.p)));
  dealer.forEach((c, i) => {
    const hidden = dealerHidden && i === nD - 1;
    const flip = !dealerHidden && prevDealerHidden && i === nD - 1;   // la tapada se voltea
    dh.appendChild(cardEl(c, hidden, i >= prevN.d || flip));
  });
  el('youTotal').textContent = nP ? fmt(handTotal(player)) : '—';
  el('bancaTotal').textContent = nD
    ? (dealerHidden ? (nD > 1 ? fmt(handTotal(dealer.slice(0, -1))) + ' + ?' : '?') : fmt(handTotal(dealer)))
    : '—';
  el('lives').textContent = Math.max(0, lives);
  el('score').textContent = points;
  el('level').textContent = level;
  const m = el('mult');
  m.textContent = 'x' + mult();
  m.classList.toggle('pop', mult() > 1);
  prevN.p = nP; prevN.d = nD; prevDealerHidden = dealerHidden;
  fitHand(ph, nP); fitHand(dh, nD);
}

function say(text, big) {
  const m = el('msg');
  m.textContent = text;
  m.classList.toggle('big', !!big);
  if (big) { m.style.animation = 'none'; void m.offsetWidth; m.style.animation = ''; }
}

function shakeTable() {
  const t = el('table');
  t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake');
}

/* vibración suave (juice, como en el resto de juegos) */
function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

function actions(state) {
  el('btnPedir').classList.toggle('hidden', state !== 'play');
  el('btnPlantar').classList.toggle('hidden', state !== 'play');
  el('btnNext').classList.toggle('hidden', state !== 'next');
  el('btnPedir').disabled = state !== 'play';
  el('btnPlantar').disabled = state !== 'play';
  // DOBLAR: solo en 'play', con vidas de sobra y sin haber doblado ya
  const canDouble = state === 'play' && !doubled && lives > 1;
  const db = el('btnDoblar');
  if (db) { db.classList.toggle('hidden', state !== 'play'); db.disabled = !canDouble; db.classList.toggle('active', doubled); }
}

/* ---------------- Flujo de partida ---------------- */
function startGame(diff) {
  difficulty = diff || difficulty;
  epoch++;                     // cancela los temporizadores de la partida anterior
  running = true; paused = false; busy = false; handResolved = false;
  try { logros.check('primera'); logros.count('partidas10'); } catch (e) {}
  lives = 3; points = 0; level = 1; streak = 0; maxStreak = 0; handsWon = 0; handsPlayed = 0;
  hide(el('startScreen')); hide(el('endScreen')); hide(el('pauseScreen')); hide(el('rankScreen'));
  show(el('hud')); show(el('table'));
  playMusic();
  newHand();
}

function newHand() {
  if (lives <= 0) return;      // nunca repartir una mano sin vidas (gameOver va en camino)
  epoch++;                     // cancela los repartos/cadencias de la mano anterior
  deck = buildDeck();
  player = []; dealer = [];
  dealerHidden = true; handResolved = false; busy = false; doubled = false;
  prevN.p = 0; prevN.d = 0;
  actions('none');
  render();
  say('Se reparte la mano…');
  // 1 carta al jugador, 1 a la banca (tapada)
  later(260, () => { if (!running) return; player.push(deck.pop()); beep(760, 0.06, 0.07); render(); });
  later(560, () => { if (!running) return; dealer.push(deck.pop()); beep(700, 0.06, 0.07); render(); });
  later(900, () => {
    if (!running) return;
    phase = 'play';
    actions('play');
    if (handTotal(player) === TARGET) { say('¡SIETE Y MEDIA a la primera! 🎉', true); sfxLevel(); stand(); }
    else say('¿Pides o te plantas?');
  });
}

function pedir() {
  if (!running || paused || busy || phase !== 'play' || handResolved) return;
  if (!deck.length) deck = buildDeck();          // red de seguridad (la baraja de 40 nunca debería agotarse)
  busy = true;
  const c = deck.pop();
  player.push(c);
  beep(880 + Math.min(5, player.length) * 40, 0.07, 0.08);
  buzz(10);
  render();
  const t = handTotal(player);
  later(180, () => {
    busy = false;
    if (!running || handResolved) return;
    if (t > TARGET) {
      say('¡Te has pasao! 💥', true);
      sfxLoss(0.85); buzz([40, 60, 40]); shakeTable();
      revealAndLose();
    } else if (t === TARGET) {
      say('¡SIETE Y MEDIA! 🎉', true);
      sfxLevel();
      stand();
    } else if (player.length >= 5) {
      say('Cinco cartas… ¡plántate, zagal!');
    }
  });
}

/* DOBLAR: pagas 1 vida y, si ganas, los puntos van x2. Se decide antes de plantarse. */
function doblar() {
  if (!running || paused || busy || phase !== 'play' || handResolved || doubled || lives <= 1) return;
  doubled = true;
  lives--;                       // la apuesta se paga ya
  beep(700, .08, .09); setTimeout(() => beep(950, .1, .08), 80);
  buzz(15);
  say('💰 ¡DOBLADO! Si ganas, x2 puntos', true);
  render();
  actions('play');               // refresca el botón (queda marcado)
  if (lives <= 0) later(800, () => { if (running) gameOver(); });
}

/* Te has pasao: se revela la banca y se pierde la mano (sin que juegue) */
function revealAndLose() {
  if (handResolved) return;
  handResolved = true;
  phase = 'over';
  handsPlayed++;
  dealerHidden = false;
  render();
  loseLife();
}

function stand() {
  if (!running || paused || handResolved) return;
  if (phase !== 'play' && phase !== 'auto') return;
  phase = 'dealer';
  actions('none');
  dealerHidden = false;
  render();
  beep(520, 0.09, 0.08, 'sine');
  say('La banca juega…');
  dealerPlay();
}

function dealerPlay() {
  const cfg = DIFF[difficulty];
  // La banca se planta según la dificultad; en CANALLA juega más fina.
  // (cfg.dealerBustBias quedó sin uso: se elimina la ambigüedad y se mantiene
  //  el comportamiento real del juego desde el primer día.)
  const target = Math.min(6.5, cfg.stand + (level - 1) * 0.25);
  const step = () => {
    if (!running) return;
    const t = handTotal(dealer);
    const playerBust = handTotal(player) > TARGET;
    const mustDraw = !playerBust && t < target;
    if (mustDraw) {
      later(620, () => {
        if (!running || handResolved) return;
        if (!deck.length) deck = buildDeck();
        dealer.push(deck.pop());
        beep(640, 0.06, 0.07);
        render();
        if (handTotal(dealer) > TARGET) { say('¡La banca se pasa! 🎉'); settle(); return; }
        step();
      });
    } else {
      later(420, () => { if (running && !handResolved) settle(); });
    }
  };
  step();
}

function settle() {
  if (handResolved) return;
  handResolved = true;
  phase = 'over';
  handsPlayed++;
  const cfg = DIFF[difficulty];
  const pt = handTotal(player), dt = handTotal(dealer);
  const playerBust = pt > TARGET, dealerBust = dt > TARGET;
  let won = false;
  if (!playerBust && (dealerBust || pt > dt)) won = true;
  else if (!playerBust && !dealerBust && pt === dt) won = !!cfg.tiePlayer;

  if (won) {
    streak++; maxStreak = Math.max(maxStreak, streak); handsWon++;
    try { logros.set('combo10', streak); logros.set('combo25', streak); if (doubled) logros.check('doblar'); } catch (e) {}
    const exact = pt === TARGET;
    const baseGain = (100 + Math.round(pt * 40) + (exact ? 300 : 0)) * mult();
    const gain = doubled ? baseGain * 2 : baseGain;
    points += gain;
    if (exact) { say(`¡SIETE Y MEDIA! +${gain}${doubled ? ' 💰x2' : ''} 🎉`, true); sfxLevel(); buzz(30); try { logros.check('sieteymedia'); } catch (e) {} }
    else { say(`${PHRASES_WIN[Math.floor(Math.random() * PHRASES_WIN.length)]} +${gain}${doubled ? ' 💰x2' : ''}`, true); beep(988, 0.09, 0.09); setTimeout(() => beep(1319, 0.11, 0.08), 90); buzz(15); }
    const nextLevel = Math.floor(points / 500) + 1;
    if (nextLevel > level) {
      level = nextLevel;
      later(700, () => { if (!running) return; sfxLevel(); say(`¡NIVEL ${level}! La banca aprieta…`, true); });
    }
  } else {
    streak = 0;
    say(playerBust ? 'Mano perdía…' : (PHRASES_LOSE[Math.floor(Math.random() * PHRASES_LOSE.length)]), true);
    if (!playerBust) sfxLoss(0.7);
    lives--;
    render();
    if (lives <= 0) { actions('none'); later(900, () => { if (running) gameOver(); }); }
    else actions('next');
    return;
  }
  render();
  actions('next');
}

function loseLife() {
  lives--;
  render();
  if (lives <= 0) { actions('none'); later(900, () => { if (running) gameOver(); }); }
  else actions('next');
}

function gameOver() {
  running = false; phase = 'over';
  stopMusic();
  hide(el('hud')); hide(el('table'));
  el('endTitle').textContent = PHRASES_END[Math.floor(Math.random() * PHRASES_END.length)];
  el('endPhrase').textContent = `Nivel ${level} · ${handsWon} de ${handsPlayed} manos ganadas`;
  el('endScore').textContent = points;
  el('endHands').textContent = handsWon;
  el('endStreak').textContent = maxStreak;
  el('endLevel').textContent = level;
  try {
    logros.set('puntos1k', points); logros.set('puntos5k', points);
    logros.set('nivel5', level); logros.set('nivel10', level);
    if (lives === 3) logros.check('sinfallo');
  } catch (e) {}
  // ¿récord nuevo?
  try {
    const best = readLocal().reduce((m, r) => Math.max(m, r.score || 0), 0);
    if (points > best && points > 0) {
      const t = el('endTitle');
      t.textContent = '¡RÉCORD NUEVO! 🏆 ' + t.textContent.replace('¡RÉCORD NUEVO! 🏆 ', '');
      beep(1318, .12, .1); setTimeout(() => beep(1760, .16, .08), 110);
    }
  } catch (e) {}
  // rellenar el nombre recordado (igual que el resto de juegos)
  try { const p = loadPrefs(); if (p.name) el('playerName').value = p.name; } catch (e) {}
  el('nameRow').classList.remove('hidden');
  show(el('endScreen'));
}

/* ---------------- Pausa / menú ---------------- */
function togglePause() {
  if (!running) return;
  paused = !paused;
  if (paused) { try { music && music.pause(); } catch (e) {} show(el('pauseScreen')); }
  else { hide(el('pauseScreen')); playMusic(); }
}
function backToMenu() {
  updateBest();
  running = false; paused = false;
  stopMusic();
  hide(el('pauseScreen')); hide(el('endScreen')); hide(el('rankScreen')); hide(el('hud')); hide(el('table'));
  show(el('startScreen'));
}

/* ---------------- Ranking (servidor + respaldo local) ---------------- */
const API = (function () {
  const p = location.pathname;                        // '/ollagitana/olla-gitana-cartas/…' o alias viejos
  let i = p.indexOf('/olla-gitana-cartas');
  if (i >= 0) return p.slice(0, i).replace(/\/$/, '') + '/api';
  i = p.indexOf('/ollagitana');
  if (i >= 0) return p.slice(0, i).replace(/\/$/, '') + '/api';
  i = p.indexOf('/champi');   // alias viejo: sigue soportado
  if (i >= 0) return p.slice(0, i).replace(/\/$/, '') + '/api';
  return '/api';
})();

function readLocal() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; } }
function writeLocal(rows) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, 200))); } catch (e) {} }

async function saveScore(name) {
  const entry = { game: GAME_ID, diff: difficulty, name: (name || 'Zagal anónimo').slice(0, 14), score: points, combo: maxStreak, acc: handsWon };
  const local = readLocal();
  local.push({ ...entry, ts: Date.now() });
  local.sort((a, b) => b.score - a.score);
  writeLocal(local);
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
    rows = (data.scores || []).map(s => ({ name: s.name, score: s.score, combo: s.combo || 0 }));
    online = true;
  } catch (e) { rows = readLocal().filter(s => s.diff === diff).sort((a, b) => b.score - a.score).slice(0, 20); }
  const src = el('rankSource');
  if (src) {
    src.textContent = online ? '' : 'Sin conexión — mostrando las puntuaciones de este dispositivo.';
    src.style.display = online ? 'none' : 'block';
  }
  if (!rows.length) { body.innerHTML = '<tr><td colspan="4" class="muted">Aún no hay zagales aquí.</td></tr>'; return; }
  body.innerHTML = rows.slice(0, 20).map((s, i) =>
    `<tr class="${i === 0 ? 'top1' : ''}"><td>${i + 1}</td><td>${esc(s.name)}</td><td>x${s.combo || 0}</td><td>${s.score}</td></tr>`
  ).join('');
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- Toast ---------------- */
let toastT = null;
function toast(msg, ms = 1600) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), ms);
}


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
el('btnPedir').addEventListener('click', pedir);
el('btnPlantar').addEventListener('click', stand);
el('btnDoblar').addEventListener('click', doblar);
el('btnNext').addEventListener('click', () => { if (running) newHand(); });
el('btnPause').addEventListener('click', togglePause);
el('btnResume').addEventListener('click', togglePause);
el('btnRestart').addEventListener('click', () => { hide(el('pauseScreen')); startGame(difficulty); });
el('btnQuit').addEventListener('click', backToMenu);
el('btnMenu').addEventListener('click', backToMenu);
el('btnAgain').addEventListener('click', () => startGame(difficulty));
el('btnEndMenu').addEventListener('click', backToMenu);
el('btnSound').addEventListener('click', () => {
  soundOn = !soundOn;
  el('btnSound').textContent = soundOn ? '🔊' : '🔇';
  if (music) music.muted = !soundOn;
  savePrefs({ sound: soundOn });            // se recuerda (igual que el resto de juegos)
  toast(soundOn ? 'Sonido ON' : 'Sonido OFF', 1000);
});
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
  const name = el('playerName').value.trim();
  savePrefs({ name });                       // recordar el nombre (igual que el resto de juegos)
  const r = await saveScore(name);
  el('nameRow').classList.add('hidden'); updateBest();
  toast(r.online ? '¡Puntuación guardada! 🏆' : 'Guardada en este dispositivo', 2200);
});

/* Compartir por WhatsApp: usa el share nativo si existe y si no, wa.me */
function compartir(texto) {
  const url = location.origin + '/ollagitana/';
  const txt = texto || '¡Echa una partida al Siete y Media de Olla Gitana! 🎴\nLa baraja española de la banda, con ranking.';
  if (navigator.share) { navigator.share({ title: 'Olla Gitana — Siete y Media 🎴', text: txt, url }).catch(() => {}); return; }
  window.open('https://wa.me/?text=' + encodeURIComponent(txt + '\n\n' + url), '_blank');
}
const btnShare = el('btnShare');
if (btnShare) btnShare.addEventListener('click', () => compartir());

const btnShareEnd = el('btnShareEnd');
if (btnShareEnd) btnShareEnd.addEventListener('click', () => {
  compartir(`He hecho ${points} puntos al Siete y Media de Olla Gitana 🎴 (nivel ${level}, mejor racha x${maxStreak}). ¿Juegas tú?`);
});

document.addEventListener('keydown', e => {
  // Escribiendo el nombre (input/textarea): NO secuestrar las teclas del juego
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (e.code === 'Space') { e.preventDefault(); if (phase === 'play') pedir(); else if (phase === 'over' && running) newHand(); }
  if (e.key === 'd' || e.key === 'D') doblar();
  if (e.key === 'p' || e.key === 'P') togglePause();
  if (e.key === 'm' || e.key === 'M') el('btnSound').click();
});
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused) togglePause(); });

/* ---------------- Arranque ---------------- */
render();
actions('none');
window.__cartasState = () => ({
  running, paused, phase, lives, points, level, streak, maxStreak,
  handsWon, handsPlayed, playerTotal: handTotal(player), dealerTotal: handTotal(dealer),
  dealerHidden, api: API, difficulty, doubled
});
updateBest();
