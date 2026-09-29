/* Olla Gitana: Las Burbujas — estilo Super Pang (rediseño visual 2026-09)
   - El mundo LLENA la pantalla (800 de ancho; alto proporcional al móvil).
   - Fondos de Murcia de la banda (seleccionables) + decorado de cocina.
   - Física clásica: las burbujas CAEN y REBOTAN en el suelo (servidor).
   - Modos: solo / contra la máquina / con un amigo (sala con código).
   Servidor autoritativo: salas.py (juego "pang"). */
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

/* Fondos de Murcia reutilizados (mismos que el runner/ritmo) */
const FONDOS = Array.from({ length: 14 }, (_, i) => `../olla-gitana-runner/assets/bg_${i + 1}.jpg`);

let ws = null, mySlot = 0, roomCode = '', myName = '';
let jugando = false, estado = null, finMostrado = false, modoSolo = false, conBot = false;
let soundOn = true, beepCtx = null, connected = false, rivalNombre = '';
let input = { dir: 0 };
let fondoImg = null, fondoIdx = 11, fondoListo = false, fondoManual = false;   // por defecto, la huerta
let particulas = [], miX = 400, ultimoN = 0;

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
function sfxPop() { beep(880, 0.09, 0.10, 'sine'); setTimeout(() => beep(1320, 0.07, 0.07, 'sine'), 45); }

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function prefs() { try { return JSON.parse(localStorage.getItem('olla_prefs_v1') || '{}'); } catch (e) { return {}; } }
function setPrefs(o) { try { localStorage.setItem('olla_prefs_v1', JSON.stringify(Object.assign(prefs(), o))); } catch (e) {} }
function guardarNombre(n) { if (n) setPrefs({ name: n }); }
function leerNombre() { return prefs().name || ''; }
function leerEscenario() { const f = prefs().fondo; return typeof f === 'number' ? f : 11; }

/* ---------------- Fondo ---------------- */
function cargarFondo(i) {
  fondoIdx = ((i % FONDOS.length) + FONDOS.length) % FONDOS.length;
  const img = new Image();
  img.onload = () => { fondoImg = img; fondoListo = true; };
  img.src = FONDOS[fondoIdx];
}
function pintarSelectorFondos() {
  const cont = el('fondoRow');
  if (!cont) return;
  cont.innerHTML = FONDOS.map((f, i) =>
    `<button class="fondoBtn ${i === fondoIdx ? 'on' : ''}" data-i="${i}" aria-label="Escenario ${i + 1}"></button>`
  ).join('');
  // miniatura por CSS (background-image en style para que no lo bloquee el CSP)
  cont.querySelectorAll('.fondoBtn').forEach(b => {
    b.style.backgroundImage = `url('${FONDOS[+b.dataset.i]}')`;
    b.addEventListener('click', () => {
      cargarFondo(+b.dataset.i);
      fondoManual = true;
      setPrefs({ fondo: +b.dataset.i });
      cont.querySelectorAll('.fondoBtn').forEach(x => x.classList.toggle('on', x === b));
      beep(880, .06, .07);
    });
  });
}

/* ---------------- WebSocket ---------------- */
function conectar(room, name, esBot) {
  conBot = !!esBot;
  try { ws && ws.close(); } catch (e) {}
  ws = new WebSocket(WS_BASE);
  ws.onopen = () => {
    connected = true;
    ws.send(JSON.stringify({ t: 'join', room: room || '', game: GAME, name,
                             bot: conBot, vw: window.innerWidth, vh: window.innerHeight }));
  };
  ws.onclose = () => { connected = false; };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.t === 'welcome') {
      mySlot = m.you; roomCode = m.room;
      const rc = el('roomCode'); if (rc) rc.textContent = roomCode;
      const bc = el('bigCode'); if (bc) bc.textContent = roomCode;
      pintarLobby(m.players);
      hide(el('startScreen')); show(el('lobbyScreen'));
      guardarNombre(myName);
      if (el('btnCopy')) el('btnCopy').style.display = 'none';
      // en solitario: arranca ya (sin lobby ni esperas)
      if (!conBot && modoSolo) {
        setTimeout(() => {
          try {
            ws.send(JSON.stringify({ t: 'ready', v: true }));
            ws.send(JSON.stringify({ t: 'startgame' }));
          } catch (e) {}
        }, 120);
      }
    } else if (m.t === 'joined') {
      pintarLobby(m.players);
      // contra la máquina: arranca solo (el bot ya está listo)
      if (conBot && !jugando) {
        ws.send(JSON.stringify({ t: 'ready', v: true }));
        setTimeout(() => { try { ws.send(JSON.stringify({ t: 'startgame' })); } catch (e) {} }, 250);
      }
    } else if (m.t === 'left') {
      pintarLobby(m.players); toast('Tu rival se fue, sigues tú solo');
    } else if (m.t === 'start') {
      empezar();
    } else if (m.t === 'state') {
      if (m.fase === 'play' && !jugando) empezar();
      // reventón: efecto de anillo + sonido
      if (estado && estado.b && m.b && m.b.length < estado.b.length) {
        sfxPop();
        const perdidas = Math.min(3, estado.b.length - m.b.length);
        for (let i = 0; i < perdidas; i++) {
          const b = estado.b[i] || { x: 400, y: 400, r: 40 };
          particulas.push({ x: b.x, y: b.y, r: b.r, t: 0 });
        }
      }
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
    node.className = 'playerSlot ' + (soy ? 'me' : (p.bot ? 'bot' : 'rival'));
    node.innerHTML = `<span class="ico">${p.bot ? '🤖' : '🥘'}</span><b class="nm">${esc(p.name)}${soy ? ' (tú)' : ''}</b><span class="st">${p.score || 0} pts</span>`;
  };
  pinta(el('slot0'), porSlot(0), porSlot(0) && porSlot(0).slot === mySlot);
  pinta(el('slot1'), porSlot(1), porSlot(1) && porSlot(1).slot === mySlot);
  rivalNombre = (players.find(p => p.slot !== mySlot) || {}).name || '';
  const nm = el('nameMe'); if (nm) nm.textContent = myName || 'Tú';
  const nr = el('nameRival'); if (nr) { nr.textContent = rivalNombre || 'Rival'; nr.parentElement && (nr.parentElement.style.display = rivalNombre ? '' : 'none'); }
  const hay2 = players.length >= 2;
  const esBot = players.some(p => p.bot);
  el('lobbyMsg').textContent = esBot ? 'Jugando contra la máquina 🤖 ¡dale a empezar!'
    : hay2 ? '¡Los dos dentro! Dale a empezar cuando quieras.'
    : 'Puedes empezar tú solo y esperar a que entre alguien…';
  el('btnStart').textContent = esBot ? '▶ ¡JUGAR CONTRA LA MÁQUINA!' : '▶ ¡EMPEZAR!';
}

function empezar() {
  jugando = true; finMostrado = false; particulas = [];
  hide(el('lobbyScreen')); hide(el('startScreen')); hide(el('endScreen'));
  show(el('hud')); show(el('controls'));
  toast('¡A reventar burbujas! 🫧');
  setTimeout(() => { try { ws.send(JSON.stringify({ t: 'move', x: miX })); } catch (e) {} }, 200);
  beep(880, .1, .1);
}

function terminar(res) {
  if (finMostrado) return;
  finMostrado = true; jugando = false;
  hide(el('controls'));
  const sc = res.score || [0, 0];
  const mio = sc[mySlot] ?? sc[0] ?? 0;
  const niv = (estado && estado.nivel) || 1;
  // en solitario: no hay "empate" ni rival -> puntuación, nivel y récord
  const modo1 = modoSolo || !rivalNombre;
  if (modo1) {
    let rec = 0;
    try { rec = +(localStorage.getItem('olla_burbujas_rec') || 0); } catch (e) {}
    const nuevoRecord = mio > rec;
    if (nuevoRecord) { try { localStorage.setItem('olla_burbujas_rec', String(mio)); } catch (e) {} rec = mio; }
    el('endTitle').textContent = nuevoRecord ? '¡RÉCORD! 🏆' : '¡SE ACABÓ!';
    el('endPhrase').textContent = `Llegaste al nivel ${niv} · ${(PHRASES_LOSE[(Math.random() * PHRASES_LOSE.length) | 0])}`;
    el('endMe').textContent = mio;
    const elR = el('endRival'); if (elR) elR.textContent = rec;
    if (nuevoRecord) { beep(1046, .12, .1); setTimeout(() => beep(1318, .16, .09), 110); }
    else sfxHit();
    guardarPuntuacion(mio);   // ranking (1 jugador)
    show(el('endScreen'));
    return;
  }
  el('endTitle').textContent = '¡SE ACABARON!';
  try { el('endPhrase').dataset.nivel = niv; } catch (e) {}
  el('endPhrase').textContent = `Llegaste al nivel ${niv}`;
  el('endMe').textContent = mio;
  el('endRival').textContent = sc[1 - mySlot] ?? 0;
  show(el('endScreen'));
  sfxHit();
}

const API = (function () {
  const p = location.pathname;                    // '/champi/olla-gitana-burbujas/…'
  const i = p.indexOf('/olla-gitana-burbujas');
  const base = i >= 0 ? p.slice(0, i) : '/';
  return base.replace(/\/$/, '') + '/api';
})();

// guarda la puntuación en el ranking (1 jugador)
function guardarPuntuacion(puntos) {
  try {
    fetch(`${API}/score`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: 'burbujas', diff: 'normal', name: myName || 'Zagal', score: puntos })
    }).then(r => r.ok ? toast('¡Puntuación guardada! 🏆') : null).catch(() => {});
  } catch (e) {}
}

/* ---------------- Dibujo ---------------- */
const canvas = el('stage'), ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1, scale = 1, offY = 0;
let GW = 800, GH = 1776;

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', () => { resize(); if (estado && estado.W) { GW = estado.W; GH = estado.H; } });
resize();

let lastFrame = performance.now();

function loop(now) {
  const dt = clamp((now - lastFrame) / 1000, 0, 0.05); lastFrame = now;
  if (jugando) { miX = clamp(miX + input.dir * 460 * dt, 26, GW - 26); avisarPosicion(now); }
  for (const p of particulas) p.t += dt;
  particulas = particulas.filter(p => p.t < 0.5);
  dibujar();
  requestAnimationFrame(loop);
}

function disparar() {
  if (!jugando || !ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ t: 'shoot', x: miX }));
  beep(520, .07, .08, 'sawtooth');
}
// avisar al servidor de dónde estamos (para el daño de las burbujas)
let ultimoMove = 0;
function avisarPosicion(now) {
  if (!jugando || !ws || ws.readyState !== 1) return;
  if (now - ultimoMove < 120) return;
  ultimoMove = now;
  ws.send(JSON.stringify({ t: 'move', x: miX }));
}

function dibujar() {
  ctx.clearRect(0, 0, W, H);
  if (estado && estado.W) { GW = estado.W; GH = estado.H; }
  // fondo por nivel (el servidor manda cuál toca)
  if (estado && typeof estado.fondo === 'number' && estado.fondo !== fondoIdx && !fondoManual) {
    cargarFondo(estado.fondo);
  }
  // el mundo ocupa TODO el ancho y el alto que haga falta: llena la pantalla
  scale = W / GW;
  const altoMundo = GH * scale;
  offY = H - altoMundo;                  // alineado ABAJO (el suelo siempre visible)
  if (offY > 0) offY = 0;

  // ---------- fondo de Murcia ----------
  if (fondoListo && fondoImg) {
    const es = Math.max(W / fondoImg.width, H / fondoImg.height) * 1.05;
    const dw = fondoImg.width * es, dh = fondoImg.height * es;
    ctx.globalAlpha = 0.62;
    ctx.drawImage(fondoImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.globalAlpha = 1;
  }
  const vg = ctx.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, 'rgba(6,12,22,.78)');
  vg.addColorStop(.45, 'rgba(6,12,22,.42)');
  vg.addColorStop(1, 'rgba(4,8,16,.85)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(0, offY); ctx.scale(scale, scale);

  const e = estado;
  const gy = GH - 96;                    // línea del suelo

  // ---------- decorado ----------
  // estantes de cocina
  ctx.strokeStyle = 'rgba(125,211,252,.10)'; ctx.lineWidth = 2;
  for (let y = 90; y < gy - 40; y += 150) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(GW, y); ctx.stroke();
  }
  // ---------- LADRILLOS (las burbujas rebotan en ellos) ----------
  if (e && e.ladrillos) {
    for (const L of e.ladrillos) {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(L.x + 5, L.y + 7, L.w, L.h);
      const gl = ctx.createLinearGradient(L.x, L.y, L.x, L.y + L.h);
      gl.addColorStop(0, '#b06a30'); gl.addColorStop(1, '#7c4519');
      ctx.fillStyle = gl; ctx.fillRect(L.x, L.y, L.w, L.h);
      ctx.strokeStyle = 'rgba(250,204,21,.5)'; ctx.lineWidth = 3;
      ctx.strokeRect(L.x, L.y, L.w, L.h);
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2;
      for (let yy = L.y + 15; yy < L.y + L.h - 3; yy += 15) {
        ctx.beginPath(); ctx.moveTo(L.x + 3, yy); ctx.lineTo(L.x + L.w - 3, yy); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(L.x + L.w / 2, L.y + 3); ctx.lineTo(L.x + L.w / 2, L.y + L.h - 3); ctx.stroke();
    }
  }
  // suelo de cocina (baldosas)
  const gs = ctx.createLinearGradient(0, gy, 0, GH);
  gs.addColorStop(0, 'rgba(30,48,66,.94)'); gs.addColorStop(1, 'rgba(14,24,36,.98)');
  ctx.fillStyle = gs; ctx.fillRect(0, gy, GW, GH - gy);
  ctx.strokeStyle = 'rgba(125,211,252,.7)'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(GW, gy); ctx.stroke();
  ctx.strokeStyle = 'rgba(125,211,252,.14)'; ctx.lineWidth = 2;
  for (let x = -40; x < GW + 80; x += 90) {
    ctx.beginPath(); ctx.moveTo(x + 40, gy); ctx.lineTo(x, GH); ctx.stroke();
  }

  // ---------- burbujas ----------
  if (e && e.b) {
    for (const b of e.b) {
      const r = b.r;
      // sombra proyectada en el suelo (más pequeña cuanto más alta)
      const altura = clamp(1 - (b.y / Math.max(1, gy)), 0, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.34 * (1 - altura * 0.55)})`;
      ctx.beginPath(); ctx.ellipse(b.x, gy + 6, r * 0.85 * (1 - altura * 0.35), r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      // cuerpo con brillo irisado
      const col = r >= 50 ? '253,224,71' : r >= 36 ? '110,231,183' : '147,197,253';
      const gb = ctx.createRadialGradient(b.x - r * .33, b.y - r * .38, r * .06, b.x, b.y, r);
      gb.addColorStop(0, 'rgba(255,255,255,.99)');
      gb.addColorStop(.30, `rgba(${col},.95)`);
      gb.addColorStop(.78, `rgba(${col},.72)`);
      gb.addColorStop(1, 'rgba(10,26,48,.6)');
      ctx.fillStyle = gb;
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3.5; ctx.stroke();
      // reflejo
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath(); ctx.ellipse(b.x - r * .34, b.y - r * .4, r * .26, r * .15, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.beginPath(); ctx.arc(b.x + r * .3, b.y + r * .34, r * .12, 0, Math.PI * 2); ctx.fill();
      // puntos que vale
      ctx.font = `900 ${Math.round(r * .5)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillText(String({ 54: 30, 40: 50, 28: 70 }[r] || 30), b.x, b.y + 1);
    }
  }

  // ---------- anillos de reventón ----------
  for (const p of particulas) {
    const k = p.t / 0.5;
    ctx.globalAlpha = (1 - k) * 0.9;
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + k * 1.8), 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(125,211,252,.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + k * 1.2), 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---------- arpones ----------
  if (e && e.arp) {
    for (const a of e.arp) {
      const mio = a.slot === mySlot;
      // cuerda hasta el suelo
      ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y + 44); ctx.lineTo(a.x, gy - 30); ctx.stroke();
      // lanza
      ctx.strokeStyle = mio ? 'rgba(167,243,208,.95)' : 'rgba(253,230,138,.95)';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x, a.y + 44); ctx.stroke();
      ctx.fillStyle = mio ? '#a7f3d0' : '#fde68a';
      ctx.beginPath(); ctx.moveTo(a.x, a.y - 16); ctx.lineTo(a.x - 12, a.y + 10); ctx.lineTo(a.x + 12, a.y + 10); ctx.closePath(); ctx.fill();
    }
  }

  // ---------- jugadores ----------
  dibujarOlla(miX, gy, true, myName || 'Tú');
  if (e && e.botx != null) dibujarOlla(e.botx, gy, false, rivalNombre || 'Máquina');

  ctx.restore();

  // ---------- marcador flotante ----------
  if (e && e.score) {
    const boxW = Math.min(W * .8, 360), bx = (W - boxW) / 2, by = 52;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, boxW, 66, 22); else ctx.rect(bx, by, boxW, 66);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 24px system-ui';
    ctx.fillStyle = '#bbf7d0'; ctx.font = '900 26px system-ui';
    ctx.fillText(`${e.score[mySlot] ?? 0}`, bx + boxW * .5, by + 20);
    ctx.font = '900 14px system-ui'; ctx.fillStyle = '#fde68a';
    const quedan = (e.b || []).length;
    ctx.fillText(`NIVEL ${e.nivel || 1} · quedan ${quedan} 🫧`, bx + boxW * .5, by + 41);
    ctx.font = '900 16px system-ui'; ctx.fillStyle = '#fff';
    ctx.fillText('❤️'.repeat(Math.max(0, Math.min(3, (e.vidas || [3, 3])[mySlot] ?? 3))), bx + boxW * .5, by + 57);
  }
}

function dibujarOlla(x, gy, soy, nombre) {
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.beginPath(); ctx.ellipse(x, gy + 6, 32, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.font = '900 16px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = soy ? '#86efac' : '#fde68a';
  ctx.fillText(nombre, x, gy - 84);
  ctx.font = '62px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(soy ? '🥘' : '🍳', x, gy - 42);
  ctx.font = '28px system-ui';
  ctx.fillText('🔱', x, gy - 78);
}

/* ---------------- Controles ---------------- */
function setInput(k, v) { input[k] = v; }
function bindHold(id, on, off) {
  const n = el(id);
  if (!n) return;
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

el('btnSolo').addEventListener('click', () => {
  myName = (el('inputName').value.trim() || 'Zagal').slice(0, 14);
  modoSolo = true;
  conectar('', myName, false);          // partida en solitario (arranca sola)
});
el('btnStart').addEventListener('click', () => {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ t: 'ready', v: true }));
  ws.send(JSON.stringify({ t: 'startgame' }));
});
el('btnLeave').addEventListener('click', salir);
el('btnMenu').addEventListener('click', salir);
el('btnAgain').addEventListener('click', () => { hide(el('endScreen')); salir(); });
el('btnEndMenu').addEventListener('click', salir);
el('btnCopy') && el('btnCopy').addEventListener('click', async () => {
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
  jugando = false; estado = null; finMostrado = false; particulas = [];
  hide(el('lobbyScreen')); hide(el('endScreen')); hide(el('hud')); hide(el('controls'));
  show(el('startScreen'));
  pintarSelectorFondos();
}

cargarFondo(leerEscenario());
pintarSelectorFondos();
requestAnimationFrame(loop);
window.__burbujasState = () => ({ conectado: connected, slot: mySlot, sala: roomCode, jugando, finMostrado,
  rival: rivalNombre, score: estado ? estado.score : null,
  burbujas: estado && estado.b ? estado.b.length : 0, miX: Math.round(miX),
  mundo: estado ? [estado.W, estado.H] : null, fondo: fondoIdx, fondoListo });
