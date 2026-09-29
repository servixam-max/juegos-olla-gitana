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
let connected = false, rivalNombre = '', conBotNow = false;
let fondoImg = null, fondoIdx = 11, fondoListo = false;   // por defecto, la huerta
const FONDOS = Array.from({ length: 14 }, (_, i) => `../olla-gitana-runner/assets/bg_${i + 1}.jpg`);
let input = { mx: 0, my: 0, ax: 0, ay: 0, fire: false };
let joyActivo = false, joyCx = 0, joyCy = 0, joyId = null;

/* ---------------- Audio ---------------- */
let ultimoShot = 0;
function sfxShot() {
  const ahora = performance.now();
  if (ahora - ultimoShot < 90) return;      // no spamear
  ultimoShot = ahora;
  // ¿tengo el arco? -> sonido más grave y potente
  const ef = (estado && estado.efectos && estado.efectos[mySlot]) || {};
  if ((ef.arco || 0) > 0) { beep(180, .12, .12, 'sawtooth'); setTimeout(() => beep(90, .1, .1, 'square'), 30); }
  else { beep(320, .05, .09, 'square'); }
}
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
function conectar(room, name, createRoom, conBot) {
  try { ws && ws.close(); } catch (e) {}
  ws = new WebSocket(WS_BASE);
  ws.onopen = () => {
    connected = true;
    ws.send(JSON.stringify({ t: 'join', room: room || '', game: GAME, name,
                             bot: !!conBot, vw: window.innerWidth, vh: window.innerHeight }));
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
      if (conBotNow && !jugando) {
        ws.send(JSON.stringify({ t: 'ready', v: true }));   // el bot ya está listo: arranca
      }
    } else if (m.t === 'left') {
      pintarLobby(m.players);
      if (jugando) { toast('Tu rival se fue'); terminar({ ganador: mySlot, abandonó: true }); }
    } else if (m.t === 'start') {
      empezarPartida();
    } else if (m.t === 'state') {
      estado = m; lastEstado = performance.now();
      if (m.fase === 'over' && m.res && !finMostrado) terminar(m.res);
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
    node.className = 'playerSlot' + (p.bot ? ' bot' : '');
    node.innerHTML = `<span class="ico">${p.bot ? '🤖' : '🥘'}</span><b class="nm">${esc(p.name)}${etiqueta}</b>${st}`;
  };
  const porSlot = s => players.find(p => p.slot === s);
  pinta(s0, porSlot(0), porSlot(0) && porSlot(0).slot === mySlot ? ' (tú)' : '');
  pinta(s1, porSlot(1), porSlot(1) && porSlot(1).slot === mySlot ? ' (tú)' : '');
  const listos = players.length === 2 && players.every(p => p.ready);
  el('lobbyMsg').textContent = players.length < 2
    ? 'Manda el código a quien quieras jugar…'
    : (listos ? '¡Empieza el duelo!' : 'Cuando los dos estéis listos, empieza.');
  rivalNombre = (players.find(p => p.slot !== mySlot) || {}).name || '';
  const nm = el('nameMe'); if (nm) nm.textContent = myName || 'Tú';
  const nr = el('nameRival'); if (nr) nr.textContent = rivalNombre || 'Rival';
}

/* ---------------- Partida ---------------- */
let finMostrado = false;
function empezarPartida() {
  jugando = true; finMostrado = false;
  hide(el('lobbyScreen')); hide(el('startScreen')); hide(el('endScreen'));
  show(el('hud')); show(el('controls'));
  toast('¡A por el rival! 🔫');
  beep(880, .1, .1);
}

function terminar(res) {
  if (finMostrado) return;
  finMostrado = true; jugando = false;
  hide(el('controls'));
  const gane = res.ganador === mySlot;
  el('endTitle').textContent = res.abandonó ? '¡TU RIVAL SE FUE!' : (gane ? '¡HAS GANADO! 🏆' : '¡TE HAN GANAO!');
  el('endPhrase').textContent = gane ? PHRASES_WIN[(Math.random() * PHRASES_WIN.length) | 0] : PHRASES_LOSE[(Math.random() * PHRASES_LOSE.length) | 0];
  const ron = res.rondas || [0, 0];
  el('endMe').textContent = `🏆 ${ron[mySlot] ?? 0}`;
  el('endRival').textContent = `🏆 ${ron[1 - mySlot] ?? 0}`;
  try {
    const lbls = document.querySelectorAll('#endScreen .resultGrid span.k');
    if (lbls[0]) lbls[0].textContent = 'Tus rondas';
    if (lbls[1]) lbls[1].textContent = 'Rondas rival';
  } catch (e) {}
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

let GW = 800, GH = 1100;              // alto: que llene el móvil en vertical
function ajustarEscena() {
  scale = W / GW;                     // ocupa todo el ancho
  const altoMundo = GH * scale;
  offX = 0;
  offY = Math.max(0, (H - altoMundo) / 2);   // centrado si sobra
  if (altoMundo > H) offY = 0;               // si no cabe, alineado arriba
}

let lastFrame = performance.now(), ultimoEnvio = 0, flash = 0;
function loop(now) {
  const dt = clamp((now - lastFrame) / 1000, 0, 0.05); lastFrame = now;
  if (flash > 0) flash -= dt * 3;
  ajustarEscena();

  // enviar input al servidor (~22/s)
  if (jugando && ws && ws.readyState === 1 && now - ultimoEnvio > 45) {
    ultimoEnvio = now;
    ws.send(JSON.stringify({ t: 'input', mx: input.mx, my: input.my,
                             ax: input.ax, ay: input.ay, fire: input.fire }));
  }

  dibujar();
  requestAnimationFrame(loop);
}

function dibujar() {
  ctx.clearRect(0, 0, W, H);
  // fondo de Murcia
  if (fondoListo && fondoImg) {
    const es = Math.max(W / fondoImg.width, H / fondoImg.height) * 1.05;
    const dw = fondoImg.width * es, dh = fondoImg.height * es;
    ctx.globalAlpha = 0.42;
    ctx.drawImage(fondoImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.globalAlpha = 1;
  }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(10,8,4,.8)'); g.addColorStop(.6, 'rgba(16,12,6,.6)'); g.addColorStop(1, 'rgba(6,4,2,.86)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const e = estado;
  // ---- arena cenital RECTANGULAR: usa toda la pantalla disponible ----
  const MW = (e && e.W) || 800, MH = (e && e.H) || 1500;
  const arriba = 104, abajo = Math.min(186, H * 0.23);     // hueco del marcador y controles
  const dispW = W - 8, dispH = H - arriba - abajo;
  const esc = Math.min(dispW / MW, dispH / MH);
  const ox = (W - MW * esc) / 2, oy = arriba + (dispH - MH * esc) / 2;

  ctx.save();
  ctx.translate(ox, oy); ctx.scale(esc, esc);

  // suelo de la arena
  const grad = ctx.createLinearGradient(0, 0, 0, MH);
  grad.addColorStop(0, 'rgba(46,34,20,.92)'); grad.addColorStop(1, 'rgba(30,20,12,.95)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, MW, MH);
  // rejilla sutil
  ctx.strokeStyle = 'rgba(250,204,21,.06)'; ctx.lineWidth = 2;
  for (let x = 0; x <= MW; x += 100) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MH); ctx.stroke(); }
  for (let y = 0; y <= MH; y += 100) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MW, y); ctx.stroke(); }

  if (e) {
    // ---- paredes y bloques (con sombra 3D) ----
    for (const w of (e.wall || [])) {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(w.x + 6, w.y + 8, w.w, w.h);
      const gw = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
      gw.addColorStop(0, '#8a5a2b'); gw.addColorStop(1, '#5d3a18');
      ctx.fillStyle = gw; ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = 'rgba(250,204,21,.45)'; ctx.lineWidth = 3;
      ctx.strokeRect(w.x, w.y, w.w, w.h);
      // ladrillos
      ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 2;
      for (let yy = w.y + 14; yy < w.y + w.h - 4; yy += 14) {
        ctx.beginPath(); ctx.moveTo(w.x + 2, yy); ctx.lineTo(w.x + w.w - 2, yy); ctx.stroke();
      }
    }
    // ---- power-ups (curaciones, arco, escudo, rapidez, invisibilidad) ----
    const EST = {
      curar: { ic: '❤️', co: '52,211,153' }, arco: { ic: '🏹', co: '251,146,60' },
      escudo: { ic: '🛡️', co: '125,211,252' }, rapido: { ic: '⚡', co: '250,204,21' },
      invisible: { ic: '🌫️', co: '196,181,253' },
    };
    for (const pw of (e.poder || [])) {
      const est = EST[pw.clase] || EST.curar;
      const pulso = 1 + Math.sin(performance.now() / 220) * 0.12;
      ctx.save(); ctx.translate(pw.x, pw.y); ctx.scale(pulso, pulso);
      ctx.fillStyle = `rgba(${est.co},.28)`;
      ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.fill();
      const gp2 = ctx.createRadialGradient(-6, -8, 3, 0, 0, 26);
      gp2.addColorStop(0, 'rgba(255,255,255,.98)'); gp2.addColorStop(1, `rgba(${est.co},.9)`);
      ctx.fillStyle = gp2;
      ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.font = '26px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(est.ic, 0, 0);
      ctx.restore();
    }
    // ---- balas (con estela; las del arco son gordas y naranjas) ----
    for (const b of (e.b || [])) {
      const mio = b.o === mySlot;
      const rr = b.r || 11;
      // estela
      const vx = b.vx || 0, vy = b.vy || 0, vl = Math.hypot(vx, vy) || 1;
      const tg = ctx.createLinearGradient(b.x, b.y, b.x - vx / vl * rr * 3.2, b.y - vy / vl * rr * 3.2);
      tg.addColorStop(0, mio ? 'rgba(167,243,208,.55)' : 'rgba(253,230,138,.55)');
      tg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.strokeStyle = tg; ctx.lineWidth = rr * 1.15; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - vx / vl * rr * 3.2, b.y - vy / vl * rr * 3.2); ctx.stroke();
      // halo
      ctx.fillStyle = b.arco ? 'rgba(251,146,60,.35)' : (mio ? 'rgba(167,243,208,.3)' : 'rgba(253,230,138,.3)');
      ctx.beginPath(); ctx.arc(b.x, b.y, rr * 1.8, 0, Math.PI * 2); ctx.fill();
      // núcleo
      ctx.fillStyle = b.arco ? '#fb923c' : (mio ? '#a7f3d0' : '#fde68a');
      ctx.beginPath(); ctx.arc(b.x, b.y, rr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
      if (b.arco) {   // chispa del arco
        ctx.font = '20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🔥', b.x, b.y);
      }
    }
    // ---- impactos (chispas) ----
    for (const im of (e.impactos || [])) {
      const k = im.t / 0.4, r = 12 + k * 46;
      ctx.globalAlpha = 1 - k;
      const col = im.tipo === 'ko' ? '248,113,113' : im.tipo === 'poder' ? '134,239,172'
                : im.tipo === 'escudo' ? '125,211,252' : '253,224,71';
      ctx.strokeStyle = `rgba(${col},.95)`; ctx.lineWidth = 5 - k * 3;
      ctx.beginPath(); ctx.arc(im.x, im.y, r, 0, Math.PI * 2); ctx.stroke();
      for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * Math.PI * 2 + k * 2;
        ctx.fillStyle = `rgba(${col},${.9 - k})`;
        ctx.beginPath(); ctx.arc(im.x + Math.cos(ang) * r, im.y + Math.sin(ang) * r, 5 - k * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // ---- números de daño flotantes ----
    for (const dn of (e.daños || [])) {
      const k = dn.t / 0.8;
      ctx.globalAlpha = 1 - k;
      ctx.font = '900 30px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(`-${dn.n}`, dn.x + 2, dn.y - k * 44 + 2);
      ctx.fillStyle = '#f87171'; ctx.fillText(`-${dn.n}`, dn.x, dn.y - k * 44);
      ctx.globalAlpha = 1;
    }
    // ---- jugadores ----
    e.p.forEach((p, i) => {
      const esYo = i === mySlot;
      const r = p.r || 34;
      // sombra
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y + r * 0.55, r * 1.05, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      // cuerpo (círculo del equipo)
      const gp = ctx.createRadialGradient(p.x - r * .3, p.y - r * .35, r * .1, p.x, p.y, r);
      if (esYo) { gp.addColorStop(0, '#86efac'); gp.addColorStop(1, '#15803d'); }
      else { gp.addColorStop(0, '#fde68a'); gp.addColorStop(1, '#b45309'); }
      ctx.fillStyle = gp;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
      // la olla encima
      ctx.font = `${Math.round(r * 1.5)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(esYo ? '🥘' : '🍳', p.x, p.y);
      // cañón apuntando
      const ax = p.dirx || 1, ay = p.diry || 0;
      ctx.save(); ctx.translate(p.x + ax * r * 1.15, p.y + ay * r * 1.15);
      ctx.rotate(Math.atan2(ay, ax));
      ctx.font = `${Math.round(r * 0.9)}px system-ui`;
      ctx.fillText('🔫', 0, 0);
      ctx.restore();
      // nombre + vidas
      ctx.font = '900 18px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillText(esYo ? (myName || 'Tú') : (rivalNombre || 'Rival'), p.x + 1, p.y - r - 19);
      ctx.fillStyle = esYo ? '#86efac' : '#fde68a';
      ctx.fillText(esYo ? (myName || 'Tú') : (rivalNombre || 'Rival'), p.x, p.y - r - 20);
      // corazones
      const hp = Math.max(0, p.hp || 0);
      ctx.font = '900 15px system-ui';
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText('❤️'.repeat(hp), p.x + 1, p.y - r - 2);
      ctx.fillStyle = '#fff'; ctx.fillText('❤️'.repeat(hp), p.x, p.y - r - 3);
    });
  } else {
    ctx.font = '900 30px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillText('Esperando al rival…', MW / 2, MH / 2);
  }
  ctx.restore();

  // marcador: nombre + corazones de cada uno (el servidor manda 6 vidas)
  if (e && e.p) {
    const boxW = Math.min(W * .92, 420), bx = (W - boxW) / 2, by = 50;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, boxW, 46, 23); else ctx.rect(bx, by, boxW, 46);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; ctx.stroke();
    const yo = e.p[mySlot] || { hp: 0 }, el2 = e.p[1 - mySlot] || { hp: 0 };
    ctx.textBaseline = 'middle';
    // mi lado
    ctx.textAlign = 'left';
    ctx.font = '900 15px system-ui'; ctx.fillStyle = '#86efac';
    ctx.fillText((myName || 'Tú').slice(0, 10), bx + 14, by + 16);      // nombre
    ctx.font = '900 14px system-ui';
    ctx.fillText('❤️'.repeat(Math.max(0, Math.min(6, yo.hp))), bx + 14, by + 33);  // corazones
    // su lado
    ctx.textAlign = 'right';
    ctx.font = '900 15px system-ui'; ctx.fillStyle = '#fde68a';
    ctx.fillText((rivalNombre || 'Rival').slice(0, 10), bx + boxW - 14, by + 16);
    ctx.font = '900 14px system-ui';
    ctx.fillText('❤️'.repeat(Math.max(0, Math.min(6, el2.hp))), bx + boxW - 14, by + 33);
    // centro: marcador de RONDAS (al mejor de 5)
    const ron = e.rondas || [0, 0];
    ctx.textAlign = 'center';
    ctx.font = '900 22px system-ui'; ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillText(`${ron[mySlot] ?? 0} - ${ron[1 - mySlot] ?? 0}`, bx + boxW / 2, by + 17);
    const rt = e.ronda_t == null ? 75 : e.ronda_t;
    const presion = rt <= 0;
    ctx.font = '900 11px system-ui';
    ctx.fillStyle = presion ? '#f87171' : 'rgba(255,255,255,.5)';
    const segs = presion ? '¡PRESIÓN!' : `${Math.ceil(rt)}s`;
    ctx.fillText(`RONDA ${e.ronda_n || 1} · al mejor de 5 · ${segs}`, bx + boxW / 2, by + 34);
    // barra de tiempo de ronda
    const frac = clamp(rt / 75, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.fillRect(bx + 12, by + 44, boxW - 24, 5);
    ctx.fillStyle = presion ? '#f87171' : (frac < 0.3 ? '#fbbf24' : '#4ade80');
    ctx.fillRect(bx + 12, by + 44, (boxW - 24) * frac, 5);
    // ---- efectos activos de cada jugador (bajo el marcador) ----
    const EFE = { arco: '🏹', escudo: '🛡️', rapido: '⚡', invisible: '🌫️' };
    const ef = (e.efectos || [])[mySlot] || {};
    let ex = bx + 12;
    ctx.font = '900 13px system-ui'; ctx.textAlign = 'left';
    for (const k in EFE) {
      if ((ef[k] || 0) > 0) {
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(ex, by + 46, 40, 22, 11); ctx.fill(); }
        ctx.fillStyle = '#fff';
        ctx.fillText(EFE[k], ex + 8, by + 57);
        ex += 44;
      }
    }
  }
  // ---- PRESIÓN: tinte rojo late ----
  if (e && e.presion) {
    const pulso = 0.5 + Math.sin(performance.now() / 260) * 0.5;
    ctx.fillStyle = `rgba(220,38,38,${0.06 + pulso * 0.07})`;
    ctx.fillRect(0, 0, W, H);
    ctx.font = '900 15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(248,113,113,${0.6 + pulso * 0.4})`;
    ctx.fillText('💀 ¡PRESIÓN! Se acaba el tiempo', W / 2, 96);
  }
  // ---- SACUDIDA al recibir un golpe ----
  if (flash > 0) {
    ctx.save();
    ctx.translate((Math.random() - 0.5) * 10 * flash, (Math.random() - 0.5) * 10 * flash);
    ctx.restore();
  }

  // ---- CUENTA ATRÁS 3·2·1 (grande, en el centro) ----
  const cd = (e && e.countdown) || 0;
  if (cd > 0) {
    const n = Math.ceil(cd);
    const frac = cd - Math.floor(cd);
    const esc2 = 1 + (1 - frac) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.translate(W / 2, H * 0.42);
    ctx.scale(esc2, esc2);
    ctx.font = '900 120px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(n > 0 ? String(n) : '¡YA!', 4, 6);
    ctx.fillStyle = n === 1 ? '#fde68a' : n === 2 ? '#fca5a5' : '#86efac';
    ctx.fillText(n > 0 ? String(n) : '¡YA!', 0, 0);
    ctx.font = '900 22px system-ui'; ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillText(`RONDA ${(e && e.ronda_n) || 1}`, 0, 92);
    ctx.restore();
  }
  // joystick visual
  if (joyActivo) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#facc15'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(joyCx, joyCy, 60, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(250,204,21,.35)';
    ctx.beginPath(); ctx.arc(joyCx + input.mx * 50, joyCy + input.my * 50, 26, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/* ---------------- Controles cenitales: joystick + disparo ---------------- */
const cv = el('stage');
function posCanvas(ev) {
  const r = cv.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}
function actualizarJoystick(ev) {
  const { x, y } = posCanvas(ev);
  let dx = x - joyCx, dy = y - joyCy;
  const d = Math.hypot(dx, dy) || 1;
  const max = 68;
  const k = Math.min(1, d / max);
  // zona muerta mínima para que no tiemble al apoyar el dedo
  if (d < 8) { input.mx = 0; input.my = 0; return; }
  input.mx = (dx / d) * k;
  input.my = (dy / d) * k;
  if (k > 0.2) { input.ax = dx / d; input.ay = dy / d; }   // apunta hacia donde empujas
  // aro visual del joystick de la izquierda
  const js = document.getElementById('joyStick');
  if (js) js.style.transform = `translate(${(dx / d) * k * 36}px, ${(dy / d) * k * 36}px)`;
}
cv.addEventListener('pointerdown', ev => {
  if (!jugando) return;
  ev.preventDefault();
  const { x, y } = posCanvas(ev);
  // toda la mitad izquierda mueve (el pad se centra donde toques)
  if (x < W * 0.5) {
    joyId = ev.pointerId; joyActivo = true;
    joyCx = W * 0.16 + 66; joyCy = H - 90 - 66;      // centro del pad de la izquierda
    if (Math.abs(x - joyCx) < 110 && Math.abs(y - joyCy) < 110) { joyCx = x; joyCy = y; }
    input.mx = 0; input.my = 0;
    actualizarJoystick(ev);
    try { cv.setPointerCapture && cv.setPointerCapture(ev.pointerId); } catch (e) {}
  }
}, { passive: false });
cv.addEventListener('pointermove', ev => {
  if (!joyActivo || ev.pointerId !== joyId) return;
  ev.preventDefault();
  actualizarJoystick(ev);
}, { passive: false });
function soltarJoystick(ev) {
  if (ev && ev.pointerId !== joyId) return;
  joyActivo = false; joyId = null; input.mx = 0; input.my = 0;
  const js = document.getElementById('joyStick');
  if (js) js.style.transform = 'translate(0,0)';
}
cv.addEventListener('pointerup', soltarJoystick);
cv.addEventListener('pointercancel', soltarJoystick);

// El canvas debe capturar los toques del joystick aunque haya controles encima
cv.style.touchAction = 'none';
cv.style.zIndex = '5';

// botón de disparo
function bindFire(id, val) {
  const n = el(id); if (!n) return;
  const down = e => { e.preventDefault(); n.classList.add('on'); input.fire = val; if (val) sfxShot(); };
  const up = () => { n.classList.remove('on'); input.fire = false; };
  n.addEventListener('pointerdown', down);
  n.addEventListener('pointerup', up);
  n.addEventListener('pointerleave', up);
  n.addEventListener('pointercancel', up);
}
bindFire('btnFire', true);

// teclado: WASD/flechas para mover, ratón para apuntar, click para disparar
const teclas = {};
function recalcularTeclas() {
  let mx = 0, my = 0;
  if (teclas['a'] || teclas['arrowleft']) mx -= 1;
  if (teclas['d'] || teclas['arrowright']) mx += 1;
  if (teclas['w'] || teclas['arrowup']) my -= 1;
  if (teclas['s'] || teclas['arrowdown']) my += 1;
  input.mx = mx; input.my = my;
  if (mx || my) { const n = Math.hypot(mx, my) || 1; input.ax = mx / n; input.ay = my / n; }
}
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
    e.preventDefault(); teclas[k] = true; recalcularTeclas();
  }
  if (k === 'f' || k === ' ') { e.preventDefault(); input.fire = true; }
});
document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (teclas[k] !== undefined) { teclas[k] = false; recalcularTeclas(); }
  if (k === 'f' || k === ' ') input.fire = false;
});
// en escritorio: apuntar con el ratón
cv.addEventListener('pointermove', ev => {
  if (joyActivo) return;
  if (ev.pointerType !== 'mouse' || !estado || !estado.p) return;
  const { x, y } = posCanvas(ev);
  const MW = estado.W || 1000, MH = estado.H || 1000;
  const tam = Math.min(W, H * 0.92), esc2 = tam / Math.max(MW, MH);
  const ox = (W - MW * esc2) / 2, oy = 44 + (H - 100 - MH * esc2) / 2;
  const wx = (x - ox) / esc2, wy = (y - oy) / esc2;
  const yo = estado.p[mySlot];
  if (yo) { const dx = wx - yo.x, dy = wy - yo.y; const n = Math.hypot(dx, dy) || 1; input.ax = dx / n; input.ay = dy / n; }
});
cv.addEventListener('pointerdown', ev => { if (ev.pointerType === 'mouse' && jugando) { input.fire = true; sfxShot(); } });
cv.addEventListener('pointerup', ev => { if (ev.pointerType === 'mouse') input.fire = false; });

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
  conBotNow = false; conectar('', myName, true);
});
el('btnBot').addEventListener('click', () => {
  myName = (el('inputName').value.trim() || 'Zagal').slice(0, 14);
  conBotNow = true; conectar('', myName, false, true);
  el('lobbyMsg') && (el('lobbyMsg').textContent = 'Jugando contra la máquina 🤖');
  el('btnCopy') && (el('btnCopy').style.display = 'none');
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

function salir() {
  try { ws && ws.readyState === 1 && ws.send(JSON.stringify({ t: 'leave' })); } catch (e) {}
  try { ws && ws.close(); } catch (e) {}
  jugando = false; estado = null; finMostrado = false;
  hide(el('lobbyScreen')); hide(el('endScreen')); hide(el('hud'));
  hide(el('controls')); const cb = el('chatBox'); if (cb) hide(cb);
  el('btnReady').classList.remove('on');
  show(el('startScreen'));
}

/* ---------------- Escenarios (fotos de Murcia) ---------------- */
function prefsD() { try { return JSON.parse(localStorage.getItem('olla_prefs_v1') || '{}'); } catch (e) { return {}; } }
function setPrefsD(o) { try { localStorage.setItem('olla_prefs_v1', JSON.stringify(Object.assign(prefsD(), o))); } catch (e) {} }
function cargarFondoD(i) {
  fondoIdx = ((i % FONDOS.length) + FONDOS.length) % FONDOS.length;
  const img = new Image();
  img.onload = () => { fondoImg = img; fondoListo = true; };
  img.src = FONDOS[fondoIdx];
}
function pintarEscenarios() {
  const c = el('fondoRow'); if (!c) return;
  c.innerHTML = FONDOS.map((f, i) => `<button class="fondoBtn ${i === fondoIdx ? 'on' : ''}" data-i="${i}" aria-label="Escenario ${i + 1}"></button>`).join('');
  c.querySelectorAll('.fondoBtn').forEach(b => {
    b.style.backgroundImage = `url('${FONDOS[+b.dataset.i]}')`;
    b.addEventListener('click', () => {
      cargarFondoD(+b.dataset.i); setPrefsD({ fondoDuelo: +b.dataset.i });
      c.querySelectorAll('.fondoBtn').forEach(x => x.classList.toggle('on', x === b));
      beep(880, .06, .07);
    });
  });
}

/* ---------------- Arranque ---------------- */
cargarFondoD(typeof prefsD().fondoDuelo === 'number' ? prefsD().fondoDuelo : 11);
pintarEscenarios();
resize();
requestAnimationFrame(loop);
window.__dueloState = () => ({ conectado: connected, slot: mySlot, sala: roomCode, jugando, finMostrado, ws: !!ws, rival: rivalNombre, bot: conBotNow, fondo: fondoIdx, fondoListo });
