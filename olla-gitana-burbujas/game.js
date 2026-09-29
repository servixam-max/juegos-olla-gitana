/* Olla Gitana: Las Burbujas — estilo Super Pang.
   Servidor autoritativo (salas.py, juego "pang"); aquí se pinta y se mandan inputs.
   Modo solo para 1 jugador: se conecta igual (sala propia) y el servidor simula. */
'use strict';

const el = id => document.getElementById(id);
const show = n => n.classList.remove('hidden');
const hide = n => n.classList.add('hidden');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const GAME = 'pang';
const WS_BASE = (function () {
  const p = location.pathname;
  let base = '/champi';
  if (p.includes('/juegos-olla')) base = '/juegos-olla';
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}${base}/ws`;
})();

const PHRASES_WIN = ['¡Toma ya!', '¡Ole tu pijo!', '¡Zarangollo!', '¡Vaya tela!'];
const PHRASES_LOSE = ['¡Arrea!', '¡Menudo pijo!', '¡Ojú!', '¡Cagüen la mar!'];

let ws = null, mySlot = 0, roomCode = '', myName = '';
let jugando = false, estado = null, finMostrado = false;
let soundOn = true, beepCtx = null, connected = false, rivalNombre = '';
let input = { dir: 0 };

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

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function guardarNombre(n) { try { const p = JSON.parse(localStorage.getItem('olla_prefs_v1') || '{}'); if (n) p.name = n; localStorage.setItem('olla_prefs_v1', JSON.stringify(p)); } catch (e) {} }
function leerNombre() { try { return JSON.parse(localStorage.getItem('olla_prefs_v1') || '{}').name || ''; } catch (e) { return ''; } }

/* ---------------- WebSocket ---------------- */
function conectar(room, name) {
  try { ws && ws.close(); } catch (e) {}
  ws = new WebSocket(WS_BASE);
  ws.onopen = () => { connected = true; ws.send(JSON.stringify({ t: 'join', room: room || '', game: GAME, name })); };
  ws.onclose = () => { connected = false; };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.t === 'welcome') {
      mySlot = m.you; roomCode = m.room;
      el('roomCode').textContent = roomCode; el('bigCode').textContent = roomCode;
      pintarLobby(m.players);
      hide(el('startScreen')); show(el('lobbyScreen'));
      guardarNombre(myName);
    } else if (m.t === 'joined') {
      pintarLobby(m.players);
    } else if (m.t === 'left') {
      pintarLobby(m.players);
      toast('Tu rival se fue, sigues tú solo');
    } else if (m.t === 'state') {
      // el servidor arranca cuando el jugador pulsa empezar (fase play)
      if (m.fase === 'play' && !jugando) empezar();
      estado = m;
      if (m.fase === 'over' && m.res && !finMostrado) terminar(m.res);
    } else if (m.t === 'error') {
      toast(m.msg || 'Error de sala', 2600);
      hide(el('lobbyScreen')); show(el('startScreen'));
    }
  };
}

function pintarLobby(players) {
  players = players || [];
  const porSlot = s => players.find(p => p.slot === s);
  const pinta = (node, p, soy) => {
    if (!p) { node.innerHTML = '<span class="ico">⏳</span><b class="nm">Esperando…</b>'; node.className = 'playerSlot'; return; }
    node.className = 'playerSlot ' + (soy ? 'me' : 'rival');
    node.innerHTML = `<span class="ico">🥘</span><b class="nm">${esc(p.name)}${soy ? ' (tú)' : ''}</b><span class="st">${p.score || 0} pts</span>`;
  };
  pinta(el('slot0'), porSlot(0), porSlot(0) && porSlot(0).slot === mySlot);
  pinta(el('slot1'), porSlot(1), porSlot(1) && porSlot(1).slot === mySlot);
  rivalNombre = (players.find(p => p.slot !== mySlot) || {}).name || '';
  el('nameMe').textContent = myName || 'Tú';
  el('nameRival').textContent = rivalNombre || 'Rival';
  el('lobbyMsg').textContent = players.length < 2
    ? 'Puedes empezar tú solo y esperar a que entre alguien…'
    : '¡Los dos dentro! Dale a empezar cuando quieras.';
}

function empezar() {
  jugando = true; finMostrado = false;
  hide(el('lobbyScreen')); hide(el('startScreen')); hide(el('endScreen'));
  show(el('hud')); show(el('controls'));
  toast('¡A reventar burbujas! 🫧');
  beep(880, .1, .1);
}

function terminar(res) {
  if (finMostrado) return;
  finMostrado = true; jugando = false;
  hide(el('controls'));
  const sc = res.score || [0, 0];
  const empate = sc[0] === sc[1];
  const gane = !empate && res.ganador === mySlot;
  el('endTitle').textContent = empate ? '¡EMPATE!' : (gane ? '¡HAS GANAO! 🏆' : '¡TE HAN GANAO!');
  el('endPhrase').textContent = empate ? '¡Menudo empate, zagal!' : (gane ? PHRASES_WIN[(Math.random() * PHRASES_WIN.length) | 0] : PHRASES_LOSE[(Math.random() * PHRASES_LOSE.length) | 0]);
  el('endMe').textContent = sc[mySlot] ?? 0;
  el('endRival').textContent = sc[1 - mySlot] ?? 0;
  show(el('endScreen'));
  if (gane) { beep(1046, .12, .1); setTimeout(() => beep(1318, .16, .09), 110); try { logros.check('burbujas'); } catch (e) {} }
  else if (!empate) sfxHit();
}

/* ---------------- Dibujo ---------------- */
const canvas = el('stage'), ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1, scale = 1, offX = 0, offY = 0;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize); resize();

const GW = 800, GH = 420;
let lastFrame = performance.now(), ultimoEnvio = 0, miX = GW / 2, arpLocal = [];
let ultimoScore = [0, 0];

function loop(now) {
  const dt = clamp((now - lastFrame) / 1000, 0, 0.05); lastFrame = now;

  // mover al jugador local (predicción suave)
  if (jugando) {
    miX = clamp(miX + input.dir * 340 * dt, 24, GW - 24);
    if (ws && ws.readyState === 1 && now - ultimoEnvio > 60) {
      ultimoEnvio = now;
      // mandar movimiento + disparo (el disparo va por evento aparte)
    }
  }
  dibujar();
  requestAnimationFrame(loop);
}

function disparar() {
  if (!jugando || !ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ t: 'shoot', x: miX }));
  beep(520, .07, .08, 'sawtooth');
  arpLocal.push({ x: miX, y: GH, t: performance.now() });
}

function dibujar() {
  ctx.clearRect(0, 0, W, H);
  scale = Math.min(W / GW, H / GH); offX = (W - GW * scale) / 2; offY = (H - GH * scale) / 2;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0d1a26'); g.addColorStop(.6, '#12202e'); g.addColorStop(1, '#070d13');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  ctx.save(); ctx.translate(offX, offY); ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(125,211,252,.05)'; ctx.fillRect(0, 0, GW, GH);
  ctx.strokeStyle = 'rgba(125,211,252,.3)'; ctx.lineWidth = 3; ctx.strokeRect(0, 0, GW, GH);

  const e = estado;
  const suelo = GH - 40;
  // suelo
  ctx.fillStyle = 'rgba(8,16,24,.92)'; ctx.fillRect(0, suelo, GW, GH - suelo);
  ctx.strokeStyle = 'rgba(125,211,252,.55)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, suelo); ctx.lineTo(GW, suelo); ctx.stroke();

  // burbujas (el servidor manda su estado)
  if (e && e.b) {
    for (const b of e.b) {
      const r = b.r;
      // brillo
      const grad = ctx.createRadialGradient(b.x - r * .3, b.y - r * .35, r * .1, b.x, b.y, r);
      grad.addColorStop(0, 'rgba(255,255,255,.95)');
      grad.addColorStop(.35, b.r > 40 ? 'rgba(96,165,250,.85)' : b.r > 30 ? 'rgba(52,211,153,.85)' : 'rgba(250,204,21,.9)');
      grad.addColorStop(1, 'rgba(30,64,175,.75)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2.5; ctx.stroke();
      // puntitos de puntos que vale
      ctx.font = `900 ${Math.round(r * .5)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillText(String({ 46: 30, 34: 50, 23: 70 }[r] || 30), b.x, b.y);
    }
  }
  // arpones del servidor
  if (e && e.arp) {
    for (const a of e.arp) {
      ctx.strokeStyle = a.slot === mySlot ? '#a7f3d0' : '#fde68a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x, a.y + 26); ctx.stroke();
      ctx.fillStyle = a.slot === mySlot ? '#a7f3d0' : '#fde68a';
      ctx.beginPath(); ctx.moveTo(a.x, a.y - 8); ctx.lineTo(a.x - 8, a.y + 8); ctx.lineTo(a.x + 8, a.y + 8); ctx.closePath(); ctx.fill();
    }
  }

  // jugador local (la olla con el arpón)
  dibujarOlla(miX, suelo, true, myName || 'Tú');
  // rival
  if (e && e.score && rivalNombre) {
    // el rival se dibuja en su lado: no tenemos su x (juego cooperativo/versus por puntos)
    dibujarOlla(GW - 70, suelo, false, rivalNombre);
  }

  // marcador en el centro
  if (e && e.score) {
    ctx.font = '900 22px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(GW / 2 - 90, 12, 180, 34);
    ctx.fillStyle = '#bbf7d0'; ctx.fillText(`${e.score[mySlot] ?? 0}`, GW / 2 - 30, 18);
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillText('·', GW / 2, 18);
    ctx.fillStyle = '#fde68a'; ctx.fillText(`${e.score[1 - mySlot] ?? 0}`, GW / 2 + 30, 18);
  }
  ctx.restore();
}

function dibujarOlla(x, suelo, soy, nombre) {
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath(); ctx.ellipse(x, suelo + 3, 24, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.font = '900 13px system-ui'; ctx.textAlign = 'center';
  ctx.fillStyle = soy ? '#86efac' : '#fde68a';
  ctx.fillText(nombre, x, suelo - 56);
  ctx.font = '48px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🥘', x, suelo - 26);
  ctx.font = '24px system-ui';
  ctx.fillText('🔱', x, suelo - 52);
}

/* ---------------- Controles ---------------- */
function setInput(k, v) { input[k] = v; }
function bindHold(id, on, off) {
  const n = el(id);
  const down = e => { e.preventDefault(); n.classList.add('on'); on(); };
  const up = () => { n.classList.remove('on'); off && off(); };
  n.addEventListener('pointerdown', down);
  n.addEventListener('pointerup', up);
  n.addEventListener('pointerleave', up);
  n.addEventListener('pointercancel', up);
}
bindHold('btnLeft', () => setInput('dir', -1), () => setInput('dir', 0));
bindHold('btnRight', () => setInput('dir', 1), () => setInput('dir', 0));
bindHold('btnFire', () => disparar(), null);

document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') setInput('dir', -1);
  else if (k === 'arrowright' || k === 'd') setInput('dir', 1);
  else if (k === ' ' || k === 'arrowup' || k === 'w') { e.preventDefault(); disparar(); }
});
document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a' || k === 'arrowright' || k === 'd') setInput('dir', 0);
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
  conectar('', myName);
});
el('btnSolo').addEventListener('click', () => {
  myName = (el('inputName').value.trim() || 'Zagal').slice(0, 14);
  conectar('SOLO', myName);   // sala privada de práctica
});
el('btnJoin').addEventListener('click', () => {
  const code = (el('inputCode').value.trim() || '').toUpperCase();
  if (!code) { toast('Escribe el código'); return; }
  myName = (el('inputName').value.trim() || 'Zagal').slice(0, 14);
  conectar(code, myName);
});
el('btnStart').addEventListener('click', () => {
  if (!ws || ws.readyState !== 1) return;
  // arrancar en el servidor: pedimos empezar (fase play) vía ready
  ws.send(JSON.stringify({ t: 'ready', v: true }));
  ws.send(JSON.stringify({ t: 'startgame' }));
  empezar();
});
el('btnLeave').addEventListener('click', salir);
el('btnMenu').addEventListener('click', salir);
el('btnAgain').addEventListener('click', () => { hide(el('endScreen')); show(el('lobbyScreen')); });
el('btnEndMenu').addEventListener('click', salir);
el('btnCopy').addEventListener('click', async () => {
  const txt = `¡Vaya reto de burbujas en los juegos de Olla Gitana! 🫧🥘\nEntra con el código: ${roomCode}\n${location.origin}/champi/olla-gitana-burbujas/`;
  try { await navigator.clipboard.writeText(txt); toast('¡Copiado! Mándalo por WhatsApp'); }
  catch (e) { if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else toast('Código: ' + roomCode, 2600); }
});
el('btnSound').addEventListener('click', () => { soundOn = !soundOn; el('btnSound').textContent = soundOn ? '🔊' : '🔇'; });
el('btnHow').addEventListener('click', () => show(el('howModal')));
el('btnCloseHow').addEventListener('click', () => hide(el('howModal')));
el('btnCloseHow2').addEventListener('click', () => hide(el('howModal')));

function salir() {
  try { ws && ws.readyState === 1 && ws.send(JSON.stringify({ t: 'leave' })); } catch (e) {}
  try { ws && ws.close(); } catch (e) {}
  jugando = false; estado = null; finMostrado = false; arpLocal = [];
  hide(el('lobbyScreen')); hide(el('endScreen')); hide(el('hud')); hide(el('controls'));
  show(el('startScreen'));
}

resize();
requestAnimationFrame(loop);
window.__burbujasState = () => ({ conectado: connected, slot: mySlot, sala: roomCode, jugando, finMostrado, rival: rivalNombre,
  score: estado ? estado.score : null, burbujas: estado && estado.b ? estado.b.length : 0, miX: Math.round(miX) });
