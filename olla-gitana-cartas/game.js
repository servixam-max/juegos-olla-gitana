/* Olla Gitana: Siete y Media — juego de cartas (baraja española)
   Reglas: acercarse a 7½ sin pasarse. Figuras (sota/caballo/rey) valen ½.
   Audio: pitido leve al pedir carta / ganar mano; hit.mp3 SOLO al perder vida. */
'use strict';

const el = id => document.getElementById(id);
const show = n => n.classList.remove('hidden');
const hide = n => n.classList.add('hidden');
const rand = (a, b) => a + Math.random() * (b - a);

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

const multTier = s => (s >= 10 ? 5 : s >= 6 ? 4 : s >= 4 ? 3 : s >= 2 ? 2 : 1);
const mult = () => multTier(streak);

/* ---------------- Render ---------------- */
function cardEl(card, faceDown) {
  const d = document.createElement('div');
  d.className = 'card deal';
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

function render() {
  const ph = el('youHand'), dh = el('bancaHand');
  ph.innerHTML = ''; dh.innerHTML = '';
  player.forEach(c => ph.appendChild(cardEl(c)));
  dealer.forEach((c, i) => dh.appendChild(cardEl(c, dealerHidden && i === dealer.length - 1)));
  el('youTotal').textContent = player.length ? fmt(handTotal(player)) : '—';
  el('bancaTotal').textContent = dealer.length ? (dealerHidden ? fmt(handTotal(dealer.slice(0, -1))) + ' + ?' : fmt(handTotal(dealer))) : '—';
  el('lives').textContent = Math.max(0, lives);
  el('score').textContent = points;
  el('level').textContent = level;
  const m = el('mult');
  m.textContent = 'x' + mult();
  m.classList.toggle('pop', mult() > 1);
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
  running = true; paused = false; busy = false; handResolved = false;
  lives = 3; points = 0; level = 1; streak = 0; maxStreak = 0; handsWon = 0; handsPlayed = 0;
  hide(el('startScreen')); hide(el('endScreen')); hide(el('pauseScreen')); hide(el('rankScreen'));
  show(el('hud')); show(el('table'));
  playMusic();
  newHand();
}

function newHand() {
  deck = buildDeck();
  player = []; dealer = [];
  dealerHidden = true; handResolved = false; busy = false; doubled = false;
  actions('none');
  render();
  say('Se reparte la mano…');
  // 1 carta al jugador, 1 a la banca (tapada)
  setTimeout(() => { player.push(deck.pop()); beep(760, 0.06, 0.07); render(); }, 260);
  setTimeout(() => { dealer.push(deck.pop()); beep(700, 0.06, 0.07); render(); }, 560);
  setTimeout(() => {
    if (!running) return;
    phase = 'play';
    actions('play');
    if (handTotal(player) === TARGET) { say('¡SIETE Y MEDIA a la primera! 🎉', true); sfxLevel(); stand(); }
    else say('¿Pides o te plantas?');
  }, 900);
}

function pedir() {
  if (!running || paused || busy || phase !== 'play' || handResolved) return;
  busy = true;
  const c = deck.pop();
  player.push(c);
  beep(880 + Math.min(5, player.length) * 40, 0.07, 0.08);
  render();
  const t = handTotal(player);
  setTimeout(() => {
    busy = false;
    if (t > TARGET) {
      say('¡Te has pasao! 💥', true);
      sfxLoss(0.85); shakeTable();
      revealAndLose();
    } else if (t === TARGET) {
      say('¡SIETE Y MEDIA! 🎉', true);
      sfxLevel();
      stand();
    } else if (player.length >= 5) {
      say('Cinco cartas… ¡plántate, zagal!');
    }
  }, 180);
}

/* DOBLAR: pagas 1 vida y, si ganas, los puntos van x2. Se decide antes de plantarse. */
function doblar() {
  if (!running || paused || busy || phase !== 'play' || handResolved || doubled || lives <= 1) return;
  doubled = true;
  lives--;                       // la apuesta se paga ya
  beep(700, .08, .09); setTimeout(() => beep(950, .1, .08), 80);
  say('💰 ¡DOBLADO! Si ganas, x2 puntos', true);
  render();
  actions('play');               // refresca el botón (queda marcado)
  if (lives <= 0) { setTimeout(() => { if (running) gameOver(); }, 800); }
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
  const target = Math.min(6.5, cfg.stand + (level - 1) * 0.25);
  const step = () => {
    if (!running) return;
    const t = handTotal(dealer);
    const playerBust = handTotal(player) > TARGET;
    const mustDraw = !playerBust && t < target;
    if (mustDraw) {
      setTimeout(() => {
        if (!running) return;
        dealer.push(deck.pop());
        beep(640, 0.06, 0.07);
        render();
        if (handTotal(dealer) > TARGET) { say('¡La banca se pasa! 🎉'); settle(); return; }
        step();
      }, 620);
    } else {
      setTimeout(() => { if (running) settle(); }, 420);
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
    const exact = pt === TARGET;
    const baseGain = (100 + Math.round(pt * 40) + (exact ? 300 : 0)) * mult();
    const gain = doubled ? baseGain * 2 : baseGain;
    points += gain;
    if (exact) { say(`¡SIETE Y MEDIA! +${gain}${doubled ? ' 💰x2' : ''} 🎉`, true); sfxLevel(); }
    else { say(`${PHRASES_WIN[Math.floor(Math.random() * PHRASES_WIN.length)]} +${gain}${doubled ? ' 💰x2' : ''}`, true); beep(988, 0.09, 0.09); setTimeout(() => beep(1319, 0.11, 0.08), 90); }
    const nextLevel = Math.floor(points / 500) + 1;
    if (nextLevel > level) {
      level = nextLevel;
      setTimeout(() => { sfxLevel(); say(`¡NIVEL ${level}! La banca aprieta…`, true); }, 700);
    }
  } else {
    streak = 0;
    say(playerBust ? 'Mano perdía…' : (PHRASES_LOSE[Math.floor(Math.random() * PHRASES_LOSE.length)]), true);
    if (!playerBust) sfxLoss(0.7);
    lives--;
    render();
    if (lives <= 0) setTimeout(() => { if (running) gameOver(); }, 900);
    else actions('next');
    return;
  }
  render();
  actions('next');
}

function loseLife() {
  lives--;
  render();
  if (lives <= 0) setTimeout(() => { if (running) gameOver(); }, 900);
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
  // ¿récord nuevo?
  try {
    const best = readLocal().reduce((m, r) => Math.max(m, r.score || 0), 0);
    if (points > best && points > 0) {
      const t = el('endTitle');
      t.textContent = '¡RÉCORD NUEVO! 🏆 ' + t.textContent.replace('¡RÉCORD NUEVO! 🏆 ', '');
      beep(1318, .12, .1); setTimeout(() => beep(1760, .16, .08), 110);
    }
  } catch (e) {}
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
  const p = location.pathname;                        // '/juegos-olla/olla-gitana-cartas/…' o '/champi/…'
  let i = p.indexOf('/olla-gitana-cartas');
  if (i >= 0) return p.slice(0, i).replace(/\/$/, '') + '/api';
  i = p.indexOf('/champi');
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
  toast(soundOn ? 'Sonido ON' : 'Sonido OFF', 1000);
});
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
  el('nameRow').classList.add('hidden'); updateBest();
  toast(r.online ? '¡Puntuación guardada! 🏆' : 'Guardada en este dispositivo', 2200);
});

document.addEventListener('keydown', e => {
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
