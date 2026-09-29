/* Olla Gitana: El Duelo — 1v1 de disparos.
   El servidor (salas.py) es autoritativo: aquí solo se pinta el estado y se mandan inputs. */
'use strict';

const el = id => document.getElementById(id);
const show = n => n.classList.remove('hidden');
const hide = n => n.classList.add('hidden');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------------- Config ---------------- */
const GAME = 'duel';
const WS_BASE = (function () {
  // ws(s)://host + /champi/ws  (o /juegos-olla/ws)
  const p = location.pathname;
  let base = '/champi';
  if (p.includes('/juegos-olla')) base = '/juegos-olla';
  else if (p.includes('/champi')) base = '/champi';
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}${base}/ws`;
})();

const PHRASES_WIN = ['¡Toma ya!', '¡Ole tu pijo!', '¡Zarangollo!', '¡Vaya tela!'];
const PHRASES_LOSE = ['¡Arrea!', '¡Menudo pijo!', '¡Ojú!', '¡Cagüen la mar!'];

/* ---------------- Estado ---------------- */
let ws = null, mySlot = 0, roomCode = '', myName = '';
let jugando = false, estado = null, lastEstado = 0;
let soundOn = true, beepCtx = null;
let connected = false, rivalNombre = '';
let input = { dir: 0, fire: false, jump: false };

/* ---------------- Audio ---------------- */
function beep(freq = 880, dur = 0.07, vol = 0.09, type = 'triangle') {
  if (!soundOn) return;
  try {
    if (!beepCtx) beepCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (beepCtx.state === 'suspended') beepCtx.resume().catch(() => {});
    const now = beepCtx.currentTime, o = beepCtx.createOscillator(), g = beepCtx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    o.connect(g); g.connect(beepCtx.destination); o.start(now); o.stop(now + dur + 0.02);
  } catch (e) {}
}
function sfxHit() { if (!soundOn) return; try { const a = new Audio('../olla-gitana/hit.mp3'); a.volume = .8; a.play().catch(() => {}); } catch (e) {} }

/* ---------------- WebSocket ---------------- */
function conectar(room, name, createRoom) {
  try { ws && ws.close(); } catch (e) {}
  ws = new WebSocket(WS_BASE);
  ws.onopen = () => {
    connected = true;
    ws.send(JSON.stringify({ t: 'join', room: room || '', game: GAME, name }));
  };
  ws.onclose = () => { connected = false; if (jugando) toast('Conexión perdida'); };
  ws.onerror = () => { connected = false; };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.t === 'welcome') {
      mySlot = m.you; roomCode = m.room;
      el('roomCode').textContent = roomCode;
      el('bigCode').textContent = roomCode;
      pintarLobby(m.players);
      hide(el('startScreen')); show(el('lobbyScreen'));
      guardarNombre(myName);
    } else if (m.t === 'joined') {
      pintarLobby(m.players);
    } else if (m.t === 'left') {
      pintarLobby(m.players);
      if (jugando) { toast('Tu rival se fue'); terminar({ ganador: mySlot, abandonó: true }); }
    } else if (m.t === 'start') {
      empezarPartida();
    } else if (m.t === 'state') {
      estado = m; lastEstado = performance.now();
      if (m.fase === 'over' && m.res && !finMostrado) terminar(m.res);
    } else if (m.t === 'chat') {
      const log = el('chatLog');
      const d = document.createElement('div');
      d.innerHTML = `<b>${esc(m.name)}:</b> ${esc(m.msg)}`;
      log.appendChild(d); log.scrollTop = log.scrollHeight;
    } else if (m.t === 'error') {
      toast(m.msg || 'Error de sala', 2600);
      hide(el('lobbyScreen')); show(el('startScreen'));
    }
  };
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function guardarNombre(n) {
  try {
    const p = JSON.parse(localStorage.getItem('olla_prefs_v1') || '{}');
    if (n) p.name = n;
    localStorage.setItem('olla_prefs_v1', JSON.stringify(p));
  } catch (e) {}
}
function leerNombre() {
  try { return JSON.parse(localStorage.getItem('olla_prefs_v1') || '{}').name || ''; } catch (e) { return ''; }
}

/* ---------------- Lobby ---------------- */
function pintarLobby(players) {
  players = players || [];
  const s0 = el('slot0'), s1 = el('slot1');
  const mine = players.find(p => p.slot === mySlot);
  const other = players.find(p => p.slot !== mySlot);
  s0.className = 'playerSlot' + (mine && mine.slot === 0 ? ' me' : (other && other.slot === 0 ? ' rival' : ''));
  s1.className = 'playerSlot' + (mine && mine.slot === 1 ? ' me' : (other && other.slot === 1 ? ' rival' : ''));
  const pinta = (node, p, etiqueta) => {
    if (!p) { node.innerHTML = '<span class="ico">⏳</span><b class="nm">Esperando…</b>'; return; }
    const st = p.ready ? '<span class="st">✅ listo</span>' : '<span class="st" style="color:#fca5a5">…preparando</span>';
    node.innerHTML = `<span class="ico">🥘</span><b class="nm">${esc(p.name)}${etiqueta}</b>${st}`;
  };
  const porSlot = s => players.find(p => p.slot === s);
  pinta(s0, porSlot(0), porSlot(0) && porSlot(0).slot === mySlot ? ' (tú)' : '');
  pinta(s1, porSlot(1), porSlot(1) && porSlot(1).slot === mySlot ? ' (tú)' : '');
  const listos = players.length === 2 && players.every(p => p.ready);
  el('lobbyMsg').textContent = players.length < 2
    ? 'Manda el código a quien quieras jugar…'
    : (listos ? '¡Empieza el duelo!' : 'Cuando los dos estéis listos, empieza.');
  rivalNombre = (players.find(p => p.slot !== mySlot) || {}).name || '';
  el('nameMe').textContent = myName || 'Tú';
  el('nameRival').textContent = rivalNombre || 'Rival';
}

/* ---------------- Partida ---------------- */
let finMostrado = false;
function empezarPartida() {
  jugando = true; finMostrado = false;
  hide(el('lobbyScreen')); hide(el('startScreen')); hide(el('endScreen'));
  show(el('hud')); show(el('controls')); show(el('chatBox'));
  toast('¡A por el rival! 🔫');
  beep(880, .1, .1);
}

function terminar(res) {
  if (finMostrado) return;
  finMostrado = true; jugando = false;
  hide(el('controls')); hide(el('chatBox'));
  const gane = res.ganador === mySlot;
  el('endTitle').textContent = res.abandonó ? '¡TU RIVAL SE FUE!' : (gane ? '¡HAS GANADO! 🏆' : '¡TE HAN GANAO!');
  el('endPhrase').textContent = gane ? PHRASES_WIN[(Math.random() * PHRASES_WIN.length) | 0] : PHRASES_LOSE[(Math.random() * PHRASES_LOSE.length) | 0];
  const hp = res.hp || [0, 0];
  el('endMe').textContent = hp[mySlot] ?? 0;
  el('endRival').textContent = hp[1 - mySlot] ?? 0;
  show(el('endScreen'));
  if (gane) { beep(1046, .12, .1); setTimeout(() => beep(1318, .16, .09), 110); }
  else sfxHit();
  if (gane) { try { logros.check('duelo'); } catch (e) {} }
}

/* ---------------- Bucle de dibujo ---------------- */
const canvas = el('stage'), ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1, scale = 1, offX = 0, offY = 0;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const GW = 800, GH = 420;
function ajustarEscena() {
  scale = Math.min(W / GW, H / GH);
  offX = (W - GW * scale) / 2;
  offY = (H - GH * scale) / 2;
}

let lastFrame = performance.now(), ultimoEnvio = 0, flash = 0;
function loop(now) {
  const dt = clamp((now - lastFrame) / 1000, 0, 0.05); lastFrame = now;
  if (flash > 0) flash -= dt * 3;
  ajustarEscena();

  // enviar input al servidor (~20/s)
  if (jugando && ws && ws.readyState === 1 && now - ultimoEnvio > 50) {
    ultimoEnvio = now;
    ws.send(JSON.stringify({ t: 'input', ...input }));
  }

  dibujar();
  requestAnimationFrame(loop);
}

function dibujar() {
  ctx.clearRect(0, 0, W, H);
  // fondo
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1a0f08'); g.addColorStop(.6, '#2b1608'); g.addColorStop(1, '#0b0705');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(offX, offY); ctx.scale(scale, scale);
  // marco del escenario
  ctx.fillStyle = 'rgba(250,204,21,.06)'; ctx.fillRect(0, 0, GW, GH);
  ctx.strokeStyle = 'rgba(250,204,21,.35)'; ctx.lineWidth = 3; ctx.strokeRect(0, 0, GW, GH);

  const e = estado;
  if (e && e.p) {
    const suelo = e.suelo || 360;
    // suelo
    ctx.fillStyle = 'rgba(20,12,6,.9)'; ctx.fillRect(0, suelo, GW, GH - suelo);
    ctx.strokeStyle = 'rgba(250,204,21,.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, suelo); ctx.lineTo(GW, suelo); ctx.stroke();

    // jugadores
    e.p.forEach((p, i) => {
      const esYo = i === mySlot;
      const hp = p.hp;
      // sombra
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.beginPath(); ctx.ellipse(p.x, suelo + 3, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
      // etiqueta
      ctx.font = '900 14px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = esYo ? '#86efac' : '#fde68a';
      ctx.fillText(esYo ? (myName || 'Tú') : (rivalNombre || 'Rival'), p.x, p.y - 54);
      // barras de vida
      for (let h = 0; h < 3; h++) {
        ctx.fillStyle = h < hp ? (esYo ? '#34d399' : '#f59e0b') : 'rgba(255,255,255,.16)';
        ctx.fillRect(p.x - 24 + h * 17, p.y - 46, 14, 5);
      }
      // la olla
      ctx.save();
      ctx.translate(p.x, p.y - 20);
      if (!p.alive) ctx.rotate(Math.PI / 2 * Math.min(1, (performance.now() % 1000) / 500));
      ctx.font = '54px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🥘', 0, 0);
      ctx.restore();
      // cañón
      ctx.font = '26px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔫', p.x + (p.dir || 1) * 26, p.y - 22);
    });

    // balas
    ctx.font = '20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const b of (e.b || [])) {
      ctx.fillStyle = b.o === mySlot ? '#a7f3d0' : '#fde68a';
      ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.font = '900 26px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.fillText('Esperando al rival…', GW / 2, GH / 2);
  }
  ctx.restore();

  // aviso de espera
  if (!estado || !estado.p) {
    ctx.font = '900 16px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillText('Sala ' + roomCode, W / 2, H * .12);
  }
  // marco flash al recibir disparo
  if (flash > 0) { ctx.fillStyle = `rgba(239,68,68,${flash * .25})`; ctx.fillRect(0, 0, W, H); }
}

/* ---------------- Controles ---------------- */
function setInput(k, v) { input[k] = v; }
function bindHold(id, on, off) {
  const n = el(id);
  const down = e => { e.preventDefault(); n.classList.add('on'); on(); };
  const up = e => { n.classList.remove('on'); off && off(); };
  n.addEventListener('pointerdown', down);
  n.addEventListener('pointerup', up);
  n.addEventListener('pointerleave', up);
  n.addEventListener('pointercancel', up);
}
bindHold('btnLeft', () => setInput('dir', -1), () => setInput('dir', 0));
bindHold('btnRight', () => setInput('dir', 1), () => setInput('dir', 0));
bindHold('btnJump', () => setInput('jump', true), () => setInput('jump', false));
bindHold('btnFire', () => { setInput('fire', true); beep(300, .08, .09, 'square'); }, () => setInput('fire', false));

document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') setInput('dir', -1);
  else if (k === 'arrowright' || k === 'd') setInput('dir', 1);
  else if (k === 'arrowup' || k === 'w' || k === ' ') { e.preventDefault(); setInput('jump', true); }
  else if (k === 'f' || k === 'control') setInput('fire', true);
});
document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a' || k === 'arrowright' || k === 'd') setInput('dir', 0);
  if (k === 'arrowup' || k === 'w' || k === ' ') setInput('jump', false);
  if (k === 'f' || k === 'control') setInput('fire', false);
});

/* ---------------- UI ---------------- */
let toastT = null;
function toast(msg, ms = 1700) {
  const t = el('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}

const nombreGuardado = leerNombre();
if (nombreGuardado) el('inputName').value = nombreGuardado;

el('btnCreate').addEventListener('click', () => {
  myName = (el('inputName').value.trim() || 'Zagal').slice(0, 14);
  conectar('', myName, true);
});
el('btnJoin').addEventListener('click', () => {
  const code = (el('inputCode').value.trim() || '').toUpperCase();
  if (!code) { toast('Escribe el código de la sala'); return; }
  myName = (el('inputName').value.trim() || 'Zagal').slice(0, 14);
  conectar(code, myName, false);
});
el('btnReady').addEventListener('click', () => {
  if (!ws || ws.readyState !== 1) return;
  const yaListo = el('btnReady').classList.contains('on');
  el('btnReady').classList.toggle('on', !yaListo);
  ws.send(JSON.stringify({ t: 'ready', v: !yaListo }));
  beep(!yaListo ? 880 : 520, .1, .09);
});
el('btnLeave').addEventListener('click', () => { salir(); });
el('btnMenu').addEventListener('click', () => { salir(); });
el('btnAgain').addEventListener('click', () => { hide(el('endScreen')); show(el('lobbyScreen')); if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'ready', v: false })); });
el('btnEndMenu').addEventListener('click', () => { salir(); });
el('btnCopy').addEventListener('click', async () => {
  const txt = `¡Te reto a un duelo en los juegos de Olla Gitana! 🥘🔫\nEntra con el código: ${roomCode}\n${location.origin}/champi/olla-gitana-duelo/`;
  try {
    await navigator.clipboard.writeText(txt);
    toast('¡Copiado! Mándalo por WhatsApp');
  } catch (e) {
    if (navigator.share) { navigator.share({ text: txt }).catch(() => {}); }
    else toast('Copia el código: ' + roomCode, 2600);
  }
});
el('btnSound').addEventListener('click', () => {
  soundOn = !soundOn;
  el('btnSound').textContent = soundOn ? '🔊' : '🔇';
});
el('btnHow').addEventListener('click', () => show(el('howModal')));
el('btnCloseHow').addEventListener('click', () => hide(el('howModal')));
el('btnCloseHow2').addEventListener('click', () => hide(el('howModal')));
el('btnChat').addEventListener('click', enviarChat);
el('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') enviarChat(); });
function enviarChat() {
  const v = el('chatInput').value.trim();
  if (!v || !ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ t: 'chat', msg: v }));
  el('chatInput').value = '';
}

function salir() {
  try { ws && ws.readyState === 1 && ws.send(JSON.stringify({ t: 'leave' })); } catch (e) {}
  try { ws && ws.close(); } catch (e) {}
  jugando = false; estado = null; finMostrado = false;
  hide(el('lobbyScreen')); hide(el('endScreen')); hide(el('hud'));
  hide(el('controls')); hide(el('chatBox'));
  el('btnReady').classList.remove('on');
  show(el('startScreen'));
}

/* ---------------- Arranque ---------------- */
resize();
requestAnimationFrame(loop);
window.__dueloState = () => ({ conectado: connected, slot: mySlot, sala: roomCode, jugando, finMostrado, ws: !!ws, rival: rivalNombre });
