/* Olla Gitana: Las Burbujas — estilo Super Pang (rediseño visual 2026-09)
   - El mundo LLENA la pantalla (800 de ancho; alto proporcional al móvil).
   - Fondos de Murcia de la banda (seleccionables) + decorado de cocina.
   - Física clásica: las burbujas CAEN y REBOTAN en el suelo (servidor).
   - Modos: solo / con un amigo (sala con código) / ranking + logros.
   - Rendimiento móvil: DPR adaptativo por FPS, sprites cacheados, sin allocations por frame.
   Servidor autoritativo: salas.py (juego "pang"). */
'use strict';

const el = id => document.getElementById(id);
const show = n => n.classList.remove('hidden');
const hide = n => n.classList.add('hidden');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const GAME = 'pang';
const WS_BASE = (function () {
  const p = location.pathname;
  let base = '/ollagitana';
  if (p.includes('/juegos-olla')) base = '/juegos-olla';
  else if (p.includes('/champi')) base = '/champi';
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
let particulas = [], miX = 400, ultimoN = 0, flashRojo = 0;
let ultimoNivel = 1, esperandoSala = false, timerConexion = null, codigoPedido = '',
    vidasPerdidas = 0, saludoRecibido = false, partidaTerminada = false;

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
  img.onload = () => { fondoImg = img; fondoListo = true; cacheFondo = null; };
  img.src = FONDOS[fondoIdx];
}
function pintarSelectorFondos() {
  const cont = el('fondoRow');
  if (!cont) return;   // ya no hay selector: el fondo lo pone el nivel
  cont.innerHTML = FONDOS.map((f, i) =>
    `<button class="fondoBtn ${i === fondoIdx ? 'on' : ''}" data-i="${i}" aria-label="Escenario ${i + 1}"></button>`
  ).join('');
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
  clearTimeout(timerConexion);
  esperandoSala = true; saludoRecibido = false;
  const aviso = setTimeout(() => {
    esperandoSala = false;
    toast('El servidor de salas no responde 🙁 Revisa tu conexión', 3200);
  }, 5000);
  timerConexion = aviso;
  ws = new WebSocket(WS_BASE);
  ws.onerror = () => { /* lo cubre el timeout + onclose */ };
  ws.onopen = () => {
    connected = true;
    esperandoSala = false; clearTimeout(aviso);
    ws.send(JSON.stringify({ t: 'join', room: room || '', game: GAME, name,
                             bot: conBot, vw: window.innerWidth, vh: window.innerHeight }));
  };
  ws.onclose = () => {
    connected = false; esperandoSala = false; clearTimeout(aviso);
    if (jugando) {
      jugando = false;
      hide(el('controls'));
      toast('Se perdió la conexión con la sala', 2800);
      show(el('startScreen'));
    } else if (!saludoRecibido) {
      hide(el('lobbyScreen')); show(el('startScreen'));
      toast('No se pudo conectar con el servidor de salas 🙁', 3000);
    }
  };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.t === 'welcome') {
      mySlot = m.you; roomCode = m.room;
      saludoRecibido = true;
      const rc = el('roomCode'); if (rc) rc.textContent = roomCode;
      const bc = el('bigCode'); if (bc) bc.textContent = roomCode;
      pintarLobby(m.players);
      guardarNombre(myName);
      // entrabas con un código que no existía: el servidor creó una sala nueva
      if (codigoPedido && codigoPedido === m.room && m.you === 0 && (!m.players || m.players.length <= 1)) {
        toast(`La sala ${codigoPedido} no existía: has creado una nueva 🆕`, 3400);
      }
      codigoPedido = '';
      // en solitario: arranca ya (sin lobby ni esperas)
      if (!conBot && modoSolo) {
        setTimeout(() => {
          try {
            ws.send(JSON.stringify({ t: 'ready', v: true }));
            ws.send(JSON.stringify({ t: 'startgame' }));
          } catch (e) {}
        }, 120);
      } else {
        hide(el('startScreen')); show(el('lobbyScreen'));
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
      if (m.fase === 'play' && !jugando && !finMostrado) empezar();
      // reventón: efecto de anillo + sonido (los datos ya vienen del servidor)
      if (estado && estado.b && m.b && m.b.length < estado.b.length) {
        sfxPop();
        const perdidas = Math.min(3, estado.b.length - m.b.length);
        for (let i = 0; i < perdidas; i++) {
          const b = estado.b[i] || { x: 400, y: 400, r: 40 };
          addParticula(b.x, b.y, b.r);
        }
      }
      // ¿me han rozado? -> hit.mp3 del usuario + pantalla roja
      const vidasAntes = (estado && estado.vidas) ? estado.vidas[mySlot] : null;
      estado = m;
      // subida de nivel: aviso visible
      if (m.nivel && m.nivel !== ultimoNivel) {
        if (m.nivel > ultimoNivel && m.fase === 'play') {
          toast(`¡NIVEL ${m.nivel}! 🌟`, 1500);
          beep(1046, .10, .09); setTimeout(() => beep(1318, .12, .08), 90); setTimeout(() => beep(1568, .14, .07), 190);
          for (const b of (m.b || []).slice(0, 5)) addParticula(b.x, b.y, b.r);
        }
        ultimoNivel = m.nivel;
      }
      const vidasAhora = (m.vidas || [3, 3])[mySlot];
      if (vidasAntes != null && vidasAhora < vidasAntes) {
        sfxHit();                       // audio del usuario SOLO para golpes
        flashRojo = 0.5;
        vidasPerdidas++;
        try { navigator.vibrate && navigator.vibrate(60); } catch (e) {}
      }
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
  ultimoNivel = (estado && estado.nivel) || 1;
  vidasPerdidas = 0; partidaTerminada = false;
  hide(el('lobbyScreen')); hide(el('startScreen')); hide(el('endScreen')); hide(el('rankModal'));
  show(el('hud')); show(el('controls'));
  toast('¡A reventar burbujas! 🫧');
  setTimeout(() => { try { ws.send(JSON.stringify({ t: 'move', x: miX })); } catch (e) {} }, 200);
  beep(880, .1, .1);
}

function terminar(res) {
  if (finMostrado) return;
  finMostrado = true; jugando = false; partidaTerminada = true;
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
    const lbl1 = el('endRivalLbl'); if (lbl1) lbl1.textContent = 'Récord';
    const elR = el('endRival'); if (elR) elR.textContent = rec;
    if (nuevoRecord) { beep(1046, .12, .1); setTimeout(() => beep(1318, .16, .09), 110); }
    else sfxHit();
    registrarLogros(mio, niv, vidasPerdidas === 0);
    guardarPuntuacion(mio, niv);   // ranking (1 jugador)
    show(el('endScreen'));
    return;
  }
  el('endTitle').textContent = '¡SE ACABARON!';
  try { el('endPhrase').dataset.nivel = niv; } catch (e) {}
  el('endPhrase').textContent = `Llegaste al nivel ${niv}`;
  el('endMe').textContent = mio;
  const lbl = el('endRivalLbl'); if (lbl) lbl.textContent = `Rival · ${rivalNombre || 'Rival'}`.slice(0, 20);
  el('endRival').textContent = sc[1 - mySlot] ?? 0;
  show(el('endScreen'));
  sfxHit();
}

const API = (function () {
  const p = location.pathname;                    // '/ollagitana/olla-gitana-burbujas/…'
  let i = p.indexOf('/olla-gitana-burbujas');
  if (i >= 0) return p.slice(0, i).replace(/\/$/, '') + '/api';
  i = p.indexOf('/ollagitana');
  if (i >= 0) return p.slice(0, i).replace(/\/$/, '') + '/api';
  i = p.indexOf('/champi');
  if (i >= 0) return p.slice(0, i).replace(/\/$/, '') + '/api';
  return '/api';
})();

// guarda la puntuación en el ranking (1 jugador). Respaldo local primero: si el
// servidor no responde, la marca no se pierde.
const RANK_KEY = 'olla_burbujas_top_v1';
function leerRankingLocal() { try { return JSON.parse(localStorage.getItem(RANK_KEY) || '[]'); } catch (e) { return []; } }
function escribirRankingLocal(rows) { try { localStorage.setItem(RANK_KEY, JSON.stringify(rows.slice(0, 50))); } catch (e) {} }

function guardarPuntuacion(puntos, nivel) {
  const fila = { name: myName || 'Zagal', score: puntos, nivel: nivel || 1, ts: Date.now() };
  const local = leerRankingLocal();
  local.push(fila);
  local.sort((a, b) => b.score - a.score);
  escribirRankingLocal(local);
  try {
    fetch(`${API}/score`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: 'burbujas', diff: 'normal', name: fila.name, score: puntos, combo: null, acc: null })
    }).then(r => r.ok ? toast('¡Puntuación guardada! 🏆') : null).catch(() => {});
  } catch (e) {}
}

/* Logros compartidos con los otros juegos (logros.js ya está cargado) */
function registrarLogros(puntos, nivel, sinFallos) {
  try {
    if (!window.logros) return;
    logros.check('primera');
    logros.count('partidas10'); logros.count('partidas50');
    logros.set('puntos1k', puntos); logros.set('puntos5k', puntos);
    logros.set('nivel5', nivel); logros.set('nivel10', nivel);
    if (sinFallos) logros.check('sinfallo');
  } catch (e) {}
}

/* Ranking en pantalla: online si se puede, con respaldo local */
async function renderRanking() {
  const body = el('rankBody'), src = el('rankSource');
  if (!body) return;
  body.innerHTML = '<tr><td colspan="3" class="muted">Cargando…</td></tr>';
  let rows = [], online = false;
  try {
    const r = await fetch(`${API}/top?game=burbujas&diff=normal&limit=20`, { cache: 'no-store' });
    if (!r.ok) throw new Error('api ' + r.status);
    const d = await r.json();
    rows = (d.scores || []).map(s => ({ name: s.name, score: s.score, ts: s.ts || 0 }));
    online = true;
  } catch (e) { online = false; }
  if (!rows.length) rows = leerRankingLocal().slice(0, 20);
  if (src) src.textContent = online ? 'Ranking online de todos los zagales'
    : (rows.length ? 'Sin conexión: tus mejores marcas (local)' : 'Sin conexión y aún no tienes marcas');
  if (!rows.length) { body.innerHTML = '<tr><td colspan="3" class="muted">Aún no hay zagales aquí. ¡Sé el primero!</td></tr>'; return; }
  body.innerHTML = rows.slice(0, 20).map((s, i) =>
    `<tr class="${i === 0 ? 'top1' : ''}"><td>${i + 1}</td><td>${esc(s.name)}</td><td>${s.score}</td></tr>`).join('');
}
function abrirRanking() { show(el('rankModal')); renderRanking(); }

/* ---------------- Dibujo ---------------- */
const canvas = el('stage'), ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1, scale = 1, offY = 0;
let GW = 800, GH = 1776;

/* caches (deben existir antes de resize(), que los resetea al arrancar) */
let cvW = 0, cvH = 0, cacheFondo = null;
const _gradCache = new Map();          // gradientes por clave corta (evita crearlos por frame)
function grad(key, build) {
  let g = _gradCache.get(key);
  if (!g) { g = build(); if (_gradCache.size > 96) _gradCache.clear(); _gradCache.set(key, g); }
  return g;
}

/* ================= RENDIMIENTO MÓVIL =================
   En móviles de gama baja el navegador va justo: el canvas a DPR 2 en pantallas
   grandes cuesta 4x más por píxel. Medimos FPS reales y bajamos la resolución
   (0.75/1/1.5/2) si el juego no llega a ~50 fps, y la subimos si sobra. */
const CALIDAD = {
  escalas: [0.75, 1, 1.5, 2],
  fpsObjetivo: 50,      // por debajo de esto, bajamos resolución
  fpsRecuperar: 56,     // por encima de esto sostenido, la subimos
};
let dprIdx = 3;            // índice en escalas (3 = DPR 2)
let dprAuto = true;
let fpsMedidos = 60, framesVentana = 0, tVentana = 0, ultAjuste = 0, fpsHistorial = [];
let nivelDetalle = 2;      // 2 = todo, 1 = sin adornos caros

function ajustarCalidad(now) {
  if (!dprAuto || !jugando) return;
  const dt = (now - tVentana) / 1000;
  if (dt < 0.75) return;                              // ventana de ~0.75 s
  const fps = framesVentana / dt;
  framesVentana = 0; tVentana = now;
  fpsMedidos = fps;
  fpsHistorial.push(fps); if (fpsHistorial.length > 6) fpsHistorial.shift();
  if (fpsHistorial.length < 3 || now - ultAjuste < 2000) return;   // 3 ventanas y máx. 1 cambio/2 s
  const fpsSuaves = fpsHistorial.reduce((a, b) => a + b, 0) / fpsHistorial.length;
  let nuevo = dprIdx;
  if (fpsSuaves < CALIDAD.fpsObjetivo && dprIdx > 0) nuevo = dprIdx - 1;                          // baja resolución
  else if (fpsSuaves > CALIDAD.fpsRecuperar && dprIdx < CALIDAD.escalas.length - 1) nuevo = dprIdx + 1;  // la sube
  if (nuevo !== dprIdx) {
    dprIdx = nuevo; ultAjuste = now; fpsHistorial = [];
    resize();                                        // aplica el nuevo DPR
  }
  nivelDetalle = CALIDAD.escalas[dprIdx] >= 1.5 ? 2 : 1;   // a 0.75/1 quitamos adornos caros
}

function perfInfo() {
  return { fps: +fpsMedidos.toFixed(1), dpr: +(CALIDAD.escalas[dprIdx]).toFixed(2),
           escala: CALIDAD.escalas[dprIdx], detalle: nivelDetalle, auto: dprAuto,
           ventanas: fpsHistorial.map(v => +v.toFixed(0)) };
}

function resize() {
  DPR = Math.max(0.6, Math.min(CALIDAD.escalas[dprIdx], window.devicePixelRatio || 1));
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cvW = W; cvH = H;
  cacheFondo = null;                                 // el fondo cacheado depende del tamaño
}
window.addEventListener('resize', () => { resize(); if (estado && estado.W) { GW = estado.W; GH = estado.H; } });
resize();

let lastFrame = performance.now();

let velOlla = 0;      // velocidad actual (para acelerar/frenar suave)
function loop(now) {
  const dt = clamp((now - lastFrame) / 1000, 0, 0.05); lastFrame = now;
  if (jugando) {
    // manejo con inercia: acelera hasta 620 px/s y frena con roce (se siente fino)
    const objetivo = input.dir * 640;
    const acel = input.dir !== 0 ? 4200 : 5200;
    if (velOlla < objetivo) velOlla = Math.min(objetivo, velOlla + acel * dt);
    else if (velOlla > objetivo) velOlla = Math.max(objetivo, velOlla - acel * dt);
    miX = clamp(miX + velOlla * dt, 26, GW - 26);
    if (miX <= 26 || miX >= GW - 26) velOlla = 0;
    avisarPosicion(now);
  }
  // partículas SIN allocations: se actualizan y compactan en el sitio
  let nPart = 0;
  for (let i = 0; i < particulas.length; i++) {
    const p = particulas[i];
    p.t += dt;
    if (p.t < 0.5) particulas[nPart++] = p;
  }
  particulas.length = nPart;
  if (flashRojo > 0) flashRojo = Math.max(0, flashRojo - dt * 1.8);
  framesVentana++; ajustarCalidad(now);
  dibujar();
  requestAnimationFrame(loop);
}

/* ================= SPRITES CACHEADOS (rendimiento móvil) =================
   Las burbujas, los power-ups y los anillos se pintan una vez a un canvas
   pequeño y luego se copian con drawImage: mucho más barato que crear
   gradientes y docenas de arcos por frame en un móvil de gama baja. */
const VALOR_R = { 72: '20', 54: '30', 40: '50', 28: '70' };
const FONT_PTS = { 72: '900 36px system-ui', 54: '900 27px system-ui',
                   40: '900 20px system-ui', 28: '900 14px system-ui' };
const _sprBurbuja = new Map(), _sprItem = new Map(), _sprAnillo = new Map();

function spriteBurbuja(r) {
  let c = _sprBurbuja.get(r);
  if (c && c._dpr === DPR) return c;
  const esc2 = Math.min(1.5, Math.max(0.75, DPR));
  const pad = 6, rad = r + pad;
  const cv = document.createElement('canvas');
  cv.width = cv.height = Math.ceil(rad * 2 * esc2);
  const g = cv.getContext('2d');
  g.scale(esc2, esc2);
  const col = r >= 68 ? '244,114,182' : r >= 50 ? '253,224,71' : r >= 36 ? '110,231,183' : '147,197,253';
  const gb = g.createRadialGradient(rad - r * .33, rad - r * .38, r * .06, rad, rad, r);
  gb.addColorStop(0, 'rgba(255,255,255,.99)');
  gb.addColorStop(.30, `rgba(${col},.95)`);
  gb.addColorStop(.78, `rgba(${col},.72)`);
  gb.addColorStop(1, 'rgba(10,26,48,.6)');
  g.fillStyle = gb;
  g.beginPath(); g.arc(rad, rad, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3.5; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.8)';
  g.beginPath(); g.ellipse(rad - r * .34, rad - r * .4, r * .26, r * .15, -0.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.45)';
  g.beginPath(); g.arc(rad + r * .3, rad + r * .34, r * .12, 0, Math.PI * 2); g.fill();
  cv._r = rad; cv._dpr = DPR;
  _sprBurbuja.set(r, cv);
  return cv;
}

function spriteItem(clase) {
  let c = _sprItem.get(clase);
  if (c && c._dpr === DPR) return c;
  const col = { linea: '56,189,248', pistola: '251,146,60', hielo: '165,243,252',
                corazon: '248,113,113', fantasma: '196,181,253' }[clase] || '250,204,21';
  const icono = { linea: '⚡', pistola: '🔫', hielo: '❄️', corazon: '❤️', fantasma: '🌫️' }[clase] || '⭐';
  const rad = 28, cv = document.createElement('canvas');
  cv.width = cv.height = Math.ceil(rad * 2 * 1.25);
  const g = cv.getContext('2d'); g.scale(1.25, 1.25);
  g.fillStyle = `rgba(${col},.30)`;
  g.beginPath(); g.arc(rad, rad, 26, 0, Math.PI * 2); g.fill();
  const gi = g.createRadialGradient(rad - 8, rad - 10, 3, rad, rad, 26);
  gi.addColorStop(0, 'rgba(255,255,255,.98)'); gi.addColorStop(1, `rgba(${col},.92)`);
  g.fillStyle = gi;
  g.beginPath();
  if (g.roundRect) g.roundRect(rad - 24, rad - 24, 48, 48, 16); else g.rect(rad - 24, rad - 24, 48, 48);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 3;
  g.beginPath();
  if (g.roundRect) g.roundRect(rad - 24, rad - 24, 48, 48, 16); else g.rect(rad - 24, rad - 24, 48, 48);
  g.stroke();
  g.font = '26px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(icono, rad, rad + 1);
  cv._dpr = DPR;
  _sprItem.set(clase, cv);
  return cv;
}

function spriteAnillo(color) {
  let c = _sprAnillo.get(color);
  if (c && c._dpr === DPR) return c;
  const R = 64, cv = document.createElement('canvas');
  cv.width = cv.height = R * 2;
  const g = cv.getContext('2d');
  g.strokeStyle = color; g.lineWidth = 4;
  g.beginPath(); g.arc(R, R, R - 4, 0, Math.PI * 2); g.stroke();
  cv._r = R; cv._dpr = DPR;
  _sprAnillo.set(color, cv);
  return cv;
}

function addParticula(x, y, r) {
  const tope = nivelDetalle >= 2 ? 16 : 8;      // gama baja: menos anillos a la vez
  if (particulas.length >= tope) return;
  particulas.push({ x, y, r, t: 0 });
}

/* pinta la capa de fondo (foto de Murcia + viñeta) UNA vez a un canvas offscreen */
function construirFondo() {
  if (!fondoImg || !fondoImg.width) return null;
  const D = DPR;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(W * D)); c.height = Math.max(1, Math.round(H * D));
  const g = c.getContext('2d');
  g.scale(D, D);
  const es = Math.max(W / fondoImg.width, H / fondoImg.height) * 1.05;
  const dw = fondoImg.width * es, dh = fondoImg.height * es;
  g.globalAlpha = 0.62;
  g.drawImage(fondoImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
  g.globalAlpha = 1;
  const vg = g.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, 'rgba(6,12,22,.78)');
  vg.addColorStop(.45, 'rgba(6,12,22,.42)');
  vg.addColorStop(1, 'rgba(4,8,16,.85)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  c._dpr = DPR;
  return c;
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
  // el mundo se escala para que ENTERO quepa (sin cortar la parte de arriba):
  // en móvil llena justo; en escritorio apaisado se centra y se ve todo.
  scale = Math.min(W / GW, H / GH);
  const altoMundo = GH * scale, anchoMundo = GW * scale;
  offY = H - altoMundo;                  // alineado ABAJO (el suelo siempre visible)
  const offX = (W - anchoMundo) / 2;     // centrado horizontal

  // ---------- fondo de Murcia ----------
  // CAPA CACHEADA: foto + viñeta se pintan UNA vez y luego solo se copian
  if (fondoListo && fondoImg) {
    if (!cacheFondo || cvW !== W || cvH !== H) cacheFondo = construirFondo();
    if (cacheFondo) ctx.drawImage(cacheFondo, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, W, H);
  }

  ctx.save();
  ctx.translate(offX, offY); ctx.scale(scale, scale);

  const e = estado;
  const gy = GH - 96;                    // línea del suelo

  // ---------- decorado ----------
  if (nivelDetalle >= 2) {   // estantes de cocina (adorno: se omite en gama baja)
    ctx.strokeStyle = 'rgba(125,211,252,.10)'; ctx.lineWidth = 2;
    for (let y = 90; y < gy - 40; y += 150) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(GW, y); ctx.stroke();
    }
  }
  // ---------- LADRILLOS (las burbujas rebotan en ellos) ----------
  if (e && e.ladrillos) {
    for (const L of e.ladrillos) {
      if (nivelDetalle >= 2) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(L.x + 5, L.y + 7, L.w, L.h); }
      const gl = grad('ladrillo', () => {
        const g = ctx.createLinearGradient(0, 0, 0, 40);
        g.addColorStop(0, '#b06a30'); g.addColorStop(1, '#7c4519'); return g;
      });
      ctx.save(); ctx.translate(L.x, L.y); ctx.scale(1, L.h / 40);
      ctx.fillStyle = gl; ctx.fillRect(0, 0, L.w, 40);
      ctx.restore();
      ctx.strokeStyle = 'rgba(250,204,21,.5)'; ctx.lineWidth = 3;
      ctx.strokeRect(L.x, L.y, L.w, L.h);
      if (nivelDetalle >= 2) {   // juntas del ladrillo
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2;
        for (let yy = L.y + 15; yy < L.y + L.h - 3; yy += 15) {
          ctx.beginPath(); ctx.moveTo(L.x + 3, yy); ctx.lineTo(L.x + L.w - 3, yy); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(L.x + L.w / 2, L.y + 3); ctx.lineTo(L.x + L.w / 2, L.y + L.h - 3); ctx.stroke();
      }
    }
  }
  // suelo de cocina (baldosas) — gradiente cacheado, no se recrea por frame
  const gs = grad('suelo', () => {
    const g = ctx.createLinearGradient(0, 0, 0, 96);
    g.addColorStop(0, 'rgba(30,48,66,.94)'); g.addColorStop(1, 'rgba(14,24,36,.98)'); return g;
  });
  ctx.save(); ctx.translate(0, gy);
  ctx.fillStyle = gs; ctx.fillRect(0, 0, GW, GH - gy);
  ctx.restore();
  ctx.strokeStyle = 'rgba(125,211,252,.7)'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(GW, gy); ctx.stroke();
  if (nivelDetalle >= 2) {   // juntas del suelo (adorno)
    ctx.strokeStyle = 'rgba(125,211,252,.14)'; ctx.lineWidth = 2;
    for (let x = -40; x < GW + 80; x += 90) {
      ctx.beginPath(); ctx.moveTo(x + 40, gy); ctx.lineTo(x, GH); ctx.stroke();
    }
  }

  // ---------- burbujas ----------
  if (e && e.b) {
    for (const b of e.b) {
      const r = b.r;
      // sombra proyectada en el suelo (más pequeña cuanto más alta)
      const altura = clamp(1 - (b.y / Math.max(1, gy)), 0, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.34 * (1 - altura * 0.55)})`;
      ctx.beginPath(); ctx.ellipse(b.x, gy + 6, r * 0.85 * (1 - altura * 0.35), r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      // cuerpo: SPRITE cacheado (una copia de imagen en vez de gradiente+arcos)
      const sp = spriteBurbuja(r);
      if (sp) ctx.drawImage(sp, b.x - sp._r, b.y - sp._r, sp._r * 2, sp._r * 2);
      // puntos que vale
      ctx.font = FONT_PTS[r] || '900 20px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillText(VALOR_R[r] || '30', b.x, b.y + 1);
    }
  }

  // ---------- LÍNEAS FIJAS (Power Wire) ----------
  if (e && e.lineas) {
    for (const ln of e.lineas) {
      const alfa = Math.min(1, ln.t / 1.2);
      ctx.save();
      ctx.globalAlpha = alfa;
      const gr = grad('linea', () => {
        const g = ctx.createLinearGradient(0, 0, 52, 0);
        g.addColorStop(0, 'rgba(56,189,248,0)');
        g.addColorStop(.5, 'rgba(56,189,248,.85)');
        g.addColorStop(1, 'rgba(56,189,248,0)');
        return g;
      });
      ctx.save(); ctx.translate(ln.x - 26, 0);
      ctx.fillStyle = gr; ctx.fillRect(0, 40, 52, gy - 60);
      ctx.restore();
      ctx.strokeStyle = 'rgba(224,242,254,.95)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ln.x, 44); ctx.lineTo(ln.x, gy - 20); ctx.stroke();
      // chispas que suben por la línea (menos en gama baja)
      const nChispas = nivelDetalle >= 2 ? 5 : 3;
      for (let k = 0; k < nChispas; k++) {
        const yy = gy - ((performance.now() / 3 + k * 220) % (gy - 60));
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ctx.beginPath(); ctx.arc(ln.x, Math.max(46, yy), 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---------- ITEMS que caen (power-ups) ----------
  if (e && e.items) {
    const bobOff = performance.now() / 260;
    for (const it of e.items) {
      const bob = Math.sin(bobOff + it.x) * 3;
      const sp = spriteItem(it.clase);
      if (sp) { const rad = sp.width / 1.25 / 2; ctx.drawImage(sp, it.x - rad, it.y + bob - rad, rad * 2, rad * 2); }
    }
  }

  // ---------- anillos de reventón ----------
  for (const p of particulas) {
    const k = p.t / 0.5;
    ctx.globalAlpha = (1 - k) * 0.9;
    const spA = spriteAnillo('rgba(255,255,255,.95)');
    if (spA) { const rr = p.r * (1 + k * 1.8); ctx.drawImage(spA, p.x - rr, p.y - rr, rr * 2, rr * 2); }
    if (nivelDetalle >= 2) {   // segundo anillo (adorno)
      const spB = spriteAnillo('rgba(125,211,252,.7)');
      if (spB) { const r2 = p.r * (1 + k * 1.2); ctx.drawImage(spB, p.x - r2, p.y - r2, r2 * 2, r2 * 2); }
    }
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
  // la olla se ve TRANSPARENTE durante la invulnerabilidad (3 s tras el roce)
  const inv = (e && e.invuln) ? (e.invuln[mySlot] || 0) : 0;
  const fanta = (e && e.efectos && e.efectos[mySlot]) ? (e.efectos[mySlot].fantasma || 0) > 0 : false;
  ctx.save();
  if (inv > 0 || fanta) ctx.globalAlpha = fanta ? 0.45 : (0.35 + 0.65 * (1 - inv / 3));
  dibujarOlla(miX, gy, true, myName || 'Tú');
  ctx.restore();
  if (inv > 0 || fanta) {   // burbuja de protección alrededor
    ctx.strokeStyle = fanta ? 'rgba(196,181,253,.85)' : 'rgba(125,211,252,.8)';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.arc(miX, gy - 44, 52, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (e && e.botx != null) dibujarOlla(e.botx, gy, false, rivalNombre || 'Máquina');

  ctx.restore();   // fin del transform del mundo

  // ---------- EFECTOS activos: chips en pantalla (bajo el marcador) ----------
  if (e && e.efectos && e.efectos[mySlot]) {
    const ef = e.efectos[mySlot];
    const activos = [];
    if (ef.linea > 0) activos.push(['⚡ LÍNEA', ef.linea]);
    if (ef.pistola > 0) activos.push(['🔫 PISTOLA', ef.pistola]);
    if (ef.hielo > 0) activos.push(['❄️ HIELO', ef.hielo]);
    if (ef.fantasma > 0) activos.push(['🌫️ FANTASMA', ef.fantasma]);
    const DUR = { '⚡ LÍNEA': 8, '🔫 PISTOLA': 8, '❄️ HIELO': 4.5, '🌫️ FANTASMA': 6 };
    let yy = 140;                                     // justo debajo del marcador
    for (const [txt, t] of activos) {
      ctx.font = '900 14px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const wpx = ctx.measureText(txt).width + 34;
      ctx.fillStyle = 'rgba(0,0,0,.68)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(10, yy - 14, wpx, 28, 14); else ctx.rect(10, yy - 14, wpx, 28);
      ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(txt, 20, yy + 1);
      ctx.fillStyle = 'rgba(255,255,255,.30)';
      ctx.fillRect(20, yy + 10, (wpx - 34) * clamp(t / (DUR[txt] || 8), 0, 1), 4);
      yy += 34;
    }
    if (ef.hielo > 0) {   // tinte azul de pantalla congelada
      ctx.fillStyle = 'rgba(165,243,252,.10)'; ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- marcador flotante ----------
  if (e && e.score) {
    const dos = !!rivalNombre && rivalNombre.length > 0;
    const boxW = Math.min(W * .8, 360), bx = (W - boxW) / 2, by = 52;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, boxW, 66, 22); else ctx.rect(bx, by, boxW, 66);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // textos cacheados: solo se reconstruyen cuando cambian los datos (no por frame)
    const nivel = e.nivel || 1, quedan = (e.b || []).length;
    if (dos) {
      const mio = e.score[mySlot] ?? 0, su = e.score[1 - mySlot] ?? 0;
      ctx.font = '900 16px system-ui';
      ctx.fillStyle = '#bbf7d0'; ctx.fillText(txtCache('n0', `${myName || 'Tú'}  ${mio}`), bx + boxW * .27, by + 20);
      ctx.fillStyle = '#fde68a'; ctx.fillText(txtCache('n1', `${rivalNombre}  ${su}`), bx + boxW * .73, by + 20);
    } else {
      ctx.font = '900 26px system-ui';
      ctx.fillStyle = '#bbf7d0';
      ctx.fillText(txtCache('sc', String(e.score[mySlot] ?? 0)), bx + boxW * .5, by + 20);
    }
    ctx.font = '900 14px system-ui'; ctx.fillStyle = '#fde68a';
    ctx.fillText(txtCache('nv', `NIVEL ${nivel}/20 · quedan ${quedan} 🫧`), bx + boxW * .5, by + 41);
    ctx.font = '900 15px system-ui'; ctx.fillStyle = '#fff';
    const v = Math.max(0, Math.min(5, (e.vidas || [3, 3])[mySlot] ?? 3));
    ctx.fillText(txtCache('vid' + v, '❤️'.repeat(v) + '🖤'.repeat(Math.max(0, 3 - v))), bx + boxW * .5, by + 57);
  }
  dibujarFlash();
}

/* cache de cadenas de texto: evita crear strings nuevos cada frame */
const _txtCache = new Map();
function txtCache(key, val) {
  const c = _txtCache.get(key);
  if (c === val) return c;
  if (_txtCache.size > 64) _txtCache.clear();
  _txtCache.set(key, val);
  return val;
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

/* ---------------- Flash de daño ---------------- */
function dibujarFlash() {
  if (flashRojo <= 0) return;
  ctx.fillStyle = `rgba(220,38,38,${(0.30 * flashRojo).toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);
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
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;    // escribiendo el mote: no mover la olla
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
/* crear sala con un amigo: lobby con código para compartir */
el('btnFriend').addEventListener('click', () => {
  myName = (el('inputName').value.trim() || 'Zagal').slice(0, 14);
  modoSolo = false;
  conectar('', myName, false);
});
/* entrar en la sala de un amigo con su código */
function entrarConCodigo() {
  const code = (el('inputCode').value.trim() || '').toUpperCase().slice(0, 6);
  if (!code) { toast('Escribe el código de tu amigo'); el('inputCode').focus(); return; }
  myName = (el('inputName').value.trim() || 'Zagal').slice(0, 14);
  modoSolo = false;
  codigoPedido = code;
  conectar(code, myName, false);
}
el('btnJoin').addEventListener('click', entrarConCodigo);
el('inputCode').addEventListener('keydown', e => { if (e.key === 'Enter') entrarConCodigo(); });
el('btnStart').addEventListener('click', () => {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ t: 'ready', v: true }));
  ws.send(JSON.stringify({ t: 'startgame' }));
});
el('btnLeave').addEventListener('click', salir);
el('btnMenu').addEventListener('click', salir);
el('btnAgain').addEventListener('click', () => {
  // reengancha directo: en solitario arranca solo; con amigo, aviso
  hide(el('endScreen'));
  const solo = modoSolo;
  salir();
  if (solo) { myName = (el('inputName').value.trim() || 'Zagal').slice(0, 14); modoSolo = true; conectar('', myName, false); }
  else toast('Crea una sala nueva para el reván', 2400);
});
el('btnEndMenu').addEventListener('click', salir);
el('btnCopy') && el('btnCopy').addEventListener('click', async () => {
  const txt = `¡Vaya reto de burbujas en los juegos de Olla Gitana! 🫧🥘\nEntra con el código: ${roomCode}\n${location.origin}/ollagitana/olla-gitana-burbujas/`;
  try { await navigator.clipboard.writeText(txt); toast('¡Copiado! Mándalo por WhatsApp'); }
  catch (e) { if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else toast('Código: ' + roomCode, 2600); }
});
/* compartir nativo (móviles sin clipboard API) */
const btnShare = el('btnShare');
if (btnShare) btnShare.addEventListener('click', async () => {
  const txt = `¡Vaya reto de burbujas en los juegos de Olla Gitana! 🫧🥘\nEntra con el código: ${roomCode}\n${location.origin}/ollagitana/olla-gitana-burbujas/`;
  if (navigator.share) { try { await navigator.share({ title: 'Las Burbujas 🫧', text: txt, url: location.href }); return; } catch (e) {} }
  try { await navigator.clipboard.writeText(txt); toast('¡Copiado! Mándalo por WhatsApp'); }
  catch (e) { toast('Código: ' + roomCode, 2600); }
});
el('btnSound').addEventListener('click', () => {
  soundOn = !soundOn;
  el('btnSound').textContent = soundOn ? '🔊' : '🔇';
  el('btnSound').setAttribute('aria-label', soundOn ? 'Sonido activado' : 'Sonido silenciado');
  toast(soundOn ? 'Sonido ON' : 'Sonido OFF', 900);
  if (soundOn) beep(880, .06, .08);
});
el('btnRank').addEventListener('click', abrirRanking);
el('btnLogros').addEventListener('click', () => { try { logros.panel(); } catch (e) {} });
el('btnCloseRank').addEventListener('click', () => hide(el('rankModal')));
el('btnCloseRank2').addEventListener('click', () => hide(el('rankModal')));
el('btnHow').addEventListener('click', () => show(el('howModal')));
el('btnCloseHow').addEventListener('click', () => hide(el('howModal')));
el('btnCloseHow2').addEventListener('click', () => hide(el('howModal')));

function salir() {
  try { ws && ws.readyState === 1 && ws.send(JSON.stringify({ t: 'leave' })); } catch (e) {}
  try { ws && ws.close(); } catch (e) {}
  jugando = false; estado = null; finMostrado = false; particulas = []; partidaTerminada = false;
  hide(el('lobbyScreen')); hide(el('endScreen')); hide(el('hud')); hide(el('controls')); hide(el('rankModal'));
  show(el('startScreen'));
  pintarSelectorFondos();
}

cargarFondo(0);          // el fondo lo cambia el nivel automáticamente
requestAnimationFrame(loop);
window.__burbujasState = () => ({ conectado: connected, slot: mySlot, sala: roomCode, jugando, finMostrado,
  rival: rivalNombre, score: estado ? estado.score : null,
  burbujas: estado && estado.b ? estado.b.length : 0, miX: Math.round(miX),
  mundo: estado ? [estado.W, estado.H] : null, fondo: fondoIdx, fondoListo,
  nivel: estado ? estado.nivel : null, vidas: estado ? estado.vidas : null, ws: !!ws, esperandoSala });
window.__burbujasPerf = perfInfo;
window.__burbujasSetDpr = i => { dprAuto = false; dprIdx = Math.max(0, Math.min(3, i | 0)); resize(); };  // QA
