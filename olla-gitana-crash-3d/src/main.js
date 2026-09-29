/* Olla Gitana 3D — orquestador: escena, cámara en raíl, bucle, niveles,
   jefe, HUD, pausa, ranking y bot de QA (?bot=1). */
import * as THREE from 'three';
import './styles.css';
import { input } from './engine/input.js';
import { Audio } from './engine/audio.js';
import { FX } from './engine/fx.js';
import { Hud } from './engine/hud.js';
import { Player } from './engine/player.js';
import { World, Box } from './engine/physics.js';
import { CrateSystem } from './game/crates.js';
import { EnemySystem } from './game/enemies.js';
import { Pickups } from './game/pickups.js';
import { Boss } from './game/boss.js';
import { BossFermin } from './game/boss2.js';
import { LEVELS } from './game/levels.js';
import { toonMat, makeOlla, makeVan, PALETA, makeNote } from './game/art.js';
import { DialogQueue } from './narrative/bocadillos.js';
import { Director } from './narrative/director.js';
import { IntroScene } from './narrative/intro.js';
import { INTRO, ENTRE_NIVELES, JEFE, JEFE_INTERMEDIO, FINAL, FRASES, pick } from './narrative/dialogos.js';
import { DemoDirector, GUION as DEMO_GUION } from './video/demo.js';

const $ = (id) => document.getElementById(id);
const BOT = new URLSearchParams(location.search).has('bot');
const DEMO = new URLSearchParams(location.search).has('demo');
const BGDIR = 'assets/';
const BACKGROUNDS = Array.from({ length: 14 }, (_, i) => `${BGDIR}bg_${i + 1}.jpg`);

/* ================= estado ================= */
const state = {
  mode: 'load',         // load | menu | play | pause | end | over | rank
  levelIndex: 0,
  level: null,
  lives: 3,
  noteCount: 0,
  maskCount: 0,
  combo: 1,
  comboT: 0,
  auraT: 0,
  ghostT: 0,
  shieldT: 0,
  t: 0,
  lastTime: 0,
  checkpoint: null,
  paused: false,
  ended: false,
  fps: 0,
  frames: 0,
  fpsT: 0,
  bot: null,
  bossRef: null,
  bossActive: false,
  pressure: false,
  vanCatchT: 0,
  cratesBrokenAtEnd: 0,
  pending: [],
  god: false
};

const records = loadRecords();
function loadRecords() {
  try { return JSON.parse(localStorage.getItem('olla3d_records_v1') || '{}'); } catch { return {}; }
}
function saveRecord(id, data) {
  const prev = records[id];
  const better = !prev || data.notas > prev.notas || (data.notas === prev.notas && data.cajas > prev.cajas);
  if (better) { records[id] = data; localStorage.setItem('olla3d_records_v1', JSON.stringify(records)); }
  return { better, prev };
}
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem('olla3d_prefs_v1') || '{}'); } catch { return {}; }
}
function savePrefs(p) {
  const cur = loadPrefs();
  localStorage.setItem('olla3d_prefs_v1', JSON.stringify({ ...cur, ...p }));
}

/* ================= render / escena ================= */
const renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight, false);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x1a0f2b, 34, 78);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 260);
const camState = { x: 0, y: 3.6, z: -7.4, yaw: 0, mode: 'rail' };

const hemi = new THREE.HemisphereLight(0xfff1cf, 0x2a1b40, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.15);
sun.position.set(6, 14, 6);
scene.add(sun);
const rim = new THREE.DirectionalLight(0xb5179e, 0.5);
rim.position.set(-8, 6, -8);
scene.add(rim);

const fx = new FX(scene, { pool: 300 });
const hud = new Hud();
const world = new World();
const crates = new CrateSystem({ scene, fx, audio: Audio, hud });
crates._blastCb = (p, r) => blastCallback(p, r);
const enemies = new EnemySystem({ scene, fx, audio: Audio, world });
const pickups = new Pickups({ scene, fx, audio: Audio });
const player = new Player(scene);
const boss = new Boss({ scene, fx, audio: Audio, enemies, pickups });
const fermin = new BossFermin({ scene, fx, audio: Audio, enemies });

let van = null;
let bgPlane = null, bgTexs = {};
let goalMesh = null, doorMesh = null;
let coverBoxes = [];

/* ---------- narrativa ---------- */
const dialog = new DialogQueue({ audio: Audio, camera, scene });
const director = new Director({ camera, scene, audio: Audio, fx, dialog, hud });
const intro = new IntroScene({ scene, director, audio: Audio, fx, dialog });
let cineTitleEl = null;
function cineTitle(on, l1 = '', l2 = '') {
  if (!cineTitleEl) {
    cineTitleEl = document.createElement('div');
    cineTitleEl.id = 'cineTitle';
    cineTitleEl.innerHTML = '<div><div class="t1"></div><div class="t2"></div></div>';
    document.getElementById('app').appendChild(cineTitleEl);
  }
  cineTitleEl.querySelector('.t1').textContent = l1;
  cineTitleEl.querySelector('.t2').textContent = l2;
  cineTitleEl.classList.toggle('on', !!on);
}

/* Reproduce una cutscene de diálogo sencilla (sin cámara especial):
   se usa al ganar un nivel y al entrar en un jefe. */
function playCutscene(lineas, { onEnd = null, speaker = null, camara = 'cajaFija', dur = null } = {}) {
  if (!lineas || !lineas.length) { if (onEnd) onEnd(); return; }
  const durTotal = dur || Math.max(4.5, lineas.reduce((a, l) => a + (l.t.length / 21 + (l.hold || 1.4) + 0.35), 0));
  state.mode = 'cine';
  hud.show(false);
  dialog.speaker = speaker;
  const planos = [{ camara, t: durTotal, dialogos: lineas }];
  director.start(planos, { cutscene: true, onEnd: () => { dialog.speaker = null; if (onEnd) onEnd(); } });
}

function showCineTitle(l1, l2, dur = 2.6) {
  cineTitle(true, l1, l2);
  state.pending.push({ after: dur, fn: () => cineTitle(false) });
}

function startIntro(onEnd) {
  state.mode = 'cine';
  director.letterboxOn();
  director.letterbox.classList.add('on');
  intro.play(() => {
    director.letterbox.classList.remove('on');
    if (onEnd) onEnd();
  });
  // el título aparece al final del último plano
  state.pending.push({
    after: Math.max(0.1, INTRO.planos.slice(0, -1).reduce((a, p) => a + p.t, 0)),
    fn: () => showCineTitle(INTRO.titulo.linea1, INTRO.titulo.linea2, 3.2)
  });
}

/* ================= carga ================= */
const loadTips = [
  'Afinando las guitarras…', 'Calentando la olla…', 'Sacando los cajones al escenario…',
  'Colocando los focos…', 'Aceitando la furgoneta…', 'Repartiendo notas musicales…'
];
async function boot() {
  const bar = $('loadBar'), tip = $('loadTip');
  let progress = 8;
  bar.style.width = progress + '%';
  let ti = 0;
  const tipTimer = setInterval(() => { tip.textContent = loadTips[ti++ % loadTips.length]; }, 900);

  await Audio.loadSamples({
    music: BGDIR + 'music.mp3',
    hit: BGDIR + 'hit.mp3',
    levelup: BGDIR + 'levelup_special.mp3'
  });
  progress = 45; bar.style.width = progress + '%';

  // fondos de Murcia como "skybox" de pasillo (planos lejanos)
  const texLoader = new THREE.TextureLoader();
  const loadOne = (url) => new Promise((res) => texLoader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, () => res(null)));
  const bgs = await Promise.all([BACKGROUNDS[0], BACKGROUNDS[1], BACKGROUNDS[2], BACKGROUNDS[3], 'assets/background.jpg'].map(loadOne));
  bgTexs = bgs;
  progress = 80; bar.style.width = progress + '%';

  clearInterval(tipTimer);
  progress = 100; bar.style.width = '100%';
  setTimeout(() => {
    $('loadPanel').classList.add('hidden');
    const prefs = loadPrefs();
    if (DEMO) {
      // modo demo: arranca el guion del vídeo directamente
      hud.show(false);
      demoHooks();
      startDemo(() => { /* fin del guion: la imagen se queda como está */ });
      document.querySelectorAll('body > :not(#app), #app > :not(canvas)').forEach((el) => {
        if (el.id !== 'cineTitle' && el.tagName !== 'STYLE' && el.id !== 'loadPanel') el.classList.add('hidden');
      });
    } else if (prefs.introVista && !BOT) {
      showMenu();
    } else {
      // primer arranque (o pedido expreso): intro cinemática
      savePrefs({ introVista: true });
      Audio.stopMenuMusic();
      startIntro(() => { showMenu(); Audio.playMenuMusic(); });
    }
  }, 260);
}

/* ================= menú ================= */
function showMenu() {
  state.mode = 'menu';
  hud.show(false);
  boss.alive = false;
  Audio.playMenuMusic();
  const grid = $('levelGrid');
  grid.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const rec = records[lv.id];
    const card = document.createElement('button');
    card.className = 'lvCard';
    card.innerHTML = `
      <img class="thumb" src="${BACKGROUNDS[(i * 4) % 14]}" alt="" />
      <div class="body">
        <div class="t">${lv.nombre}</div>
        <div class="d">${lv.desc}</div>
        <div class="meta">
          <span class="tag">${lv.tag}</span>
          ${rec ? `<span class="tag done">🎵 ${rec.notas} notas</span>` : ''}
          ${rec ? `<span class="tag gold">★ ${'★'.repeat(rec.estrellas || 1)}</span>` : ''}
        </div>
      </div>`;
    card.onclick = () => { Audio.sfx('ui'); startLevel(i); };
    grid.appendChild(card);
  });
  $('menuImg').classList.add('hidden');
  if (bgTexs[4] && bgTexs[4].image) {
    const img = $('menuImg');
    img.src = 'assets/background.jpg';
    img.classList.remove('hidden');
  }
  $('menuPanel').classList.remove('hidden');
  $('gamepadHint').textContent = input.hasGamepad() ? '🎮 Mando detectado' : '';
  const prefs = loadPrefs();
  $('btnMute2').textContent = prefs.muted ? '🔇 Sonido' : '🔊 Sonido';
}
function hideOverlays() {
  ['menuPanel', 'helpPanel', 'pausePanel', 'endPanel', 'overPanel', 'rankPanel'].forEach((id) => $(id).classList.add('hidden'));
}

/* ================= arrancar nivel ================= */
function clearLevel() {
  for (const b of world.boxes) { if (b.mesh) scene.remove(b.mesh); }
  world.boxes.length = 0;
  for (const c of crates.items) { if (c.mesh) scene.remove(c.mesh); }
  crates.items = [];
  for (const n of pickups.notes) if (n.obj) scene.remove(n.obj);
  for (const m of pickups.masks) if (m.obj) scene.remove(m.obj);
  pickups.notes = []; pickups.masks = [];
  for (const e of enemies.list) if (e.obj) scene.remove(e.obj);
  enemies.list = [];
  for (const w of enemies.waves) scene.remove(w.mesh);
  enemies.waves = [];
  if (van) { scene.remove(van); van = null; }
  if (goalMesh) { scene.remove(goalMesh); goalMesh = null; }
  if (bgPlane) { scene.remove(bgPlane); bgPlane = null; }
  if (boss.obj) { scene.remove(boss.obj); boss.obj = null; }
  boss.alive = false;
}

function startLevel(index, { keepLives = false } = {}) {
  clearLevel();
  state.levelIndex = index;
  const def = LEVELS[index];
  const level = def.build(world, scene, fx);
  state.level = level;
  state.ended = false;
  state.paused = false;
  if (!keepLives) state.lives = 3;
  state.noteCount = 0;
  state.maskCount = 0;
  state.auraT = 0; state.ghostT = 0; state.shieldT = 0;
  state.combo = 1; state.comboT = 0;
  state.t = 0;
  state.checkpoint = null;
  state.pressure = false;
  state.vanCatchT = 0;

  // fondo lejano con la imagen de Murcia (DoubleSide: el plano debe verse desde la cámara)
  const tex = bgTexs[(level.bg - 1) % bgTexs.length];
  if (tex) {
    const geo = new THREE.PlaneGeometry(level.arena ? 220 : 170, level.arena ? 120 : 100);
    const mat = new THREE.MeshBasicMaterial({ map: tex, depthWrite: false, fog: false, side: THREE.DoubleSide });
    bgPlane = new THREE.Mesh(geo, mat);
    bgPlane.position.set(0, level.arena ? 26 : 28, level.arena ? -95 : 72);
    bgPlane.renderOrder = -1;
    scene.add(bgPlane);
    scene.background = new THREE.Color(0x12081f);
    scene.fog = new THREE.Fog(level.arena ? 0x1b0f2e : 0x241640, 40, 110);
  }

  // cajas de mundo sólidas para los cajones
  crates.load(level.crates);
  for (const c of level.crates) {
    if (!c.worldBox && c.mesh) {
      const b = world.add(new Box({
        x: c.mesh.position.x, y: c.mesh.position.y, z: c.mesh.position.z, w: 0.92, h: 0.92, d: 0.92, tag: 'crateBody'
      }));
      b.mesh = c.mesh;
      b.crateRef = c;
      c.worldBox = b;
    }
    if (c.mesh) { c.mesh.visible = true; }
  }

  pickups.load(level);
  enemies.load(level.enemies, { cover: [] });
  // coberturas (pilares) para que las ondas sonoras se bloqueen
  coverBoxes = world.boxes
    .filter((b) => b.tag === 'pillar' || b.tag === 'speakerBase')
    .map((b) => ({ x: b.pos.x, z: b.pos.z, hw: b.half.x, hd: b.half.z }));

  // meta
  if (level.goal) {
    goalMesh = new THREE.Group();
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.18, 8, 24, Math.PI), toonMat(PALETA.morado));
    arch.position.y = 1.5;
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), toonMat(PALETA.dorado));
    left.position.set(-1.5, 1.5, 0);
    const right = left.clone(); right.position.x = 1.5;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
    glow.position.y = 1.5;
    goalMesh.add(arch, left, right, glow);
    goalMesh.position.set(level.goal.x, 0, level.goal.z);
    scene.add(goalMesh);
  }

  // furgoneta (nivel 3)
  if (level.chase) {
    van = makeVan();
    van.position.set(0, 0, level.van.startZ);
    scene.add(van);
  }

  // jefe
  if (level.arena) {
    boss.start();
    state.bossActive = true;
    boss.onHp = (hp, max) => hud.toast(`👹 CACHARRO ${Math.max(0, hp)}/${max}`, hp <= 1 ? 'bad' : '');
    boss.onPhase = (ph) => {
      hud.toast(`⚡ ¡FASE ${ph}!`, 'bad');
      Audio.sfx('levelup');
      const lineas = JEFE.fases[ph];
      if (lineas) { state.pending.push({ after: 0.6, fn: () => { if (state.mode === 'play') playCutscene(lineas, { speaker: boss.obj, camara: 'jefe', dur: 3.4, onEnd: () => { state.mode = 'play'; } }); } }); }
    };
    boss.onDefeat = () => {
      playCutscene(JEFE.derrota, {
        speaker: boss.obj, camara: 'jefe', dur: 6.5,
        onEnd: () => { endLevel(true, { boss: true }); }
      });
    };
  } else state.bossActive = false;

  // jefe intermedio (Fermín Cascabel, mundo 5): aparece al llegar al final del desfile
  if (level.bossIntermedio === 'fermin') {
    state.ferminActive = false;
    state.ferminPending = true;
    state.ferminZ = level.bossIntermedioZ || 84;
  } else { state.ferminActive = false; state.ferminPending = false; }

  // jugador
  const sp = level.spawn;
  player.reset(sp.x, sp.y, sp.z);
  player.aura = false; player.shield = 0; player.ghost = 0;
  camState.x = sp.x; camState.y = 3.6; camState.z = sp.z - 7.4; camState.yaw = 0;

  hideOverlays();
  hud.show(true);
  hud.start();
  crates.publish();                                        // re-sincroniza el contador de cajones
  if (level.arena) { state.lives = 6; hud.setLives(6); }   // el jefe se juega con más margen
  hud.setHint(level.tip.length > 52 ? level.tip.slice(0, 50) + '…' : level.tip);
  state.mode = 'play';
  Audio.resume();
  Audio.startGenerative({ intensity: 1 });
  Audio.setAura(false);
  savePrefs({ lastLevel: index });
  // cartel del mundo al empezar
  showCineTitle(`MUNDO ${index + 1}`, def.nombre.toUpperCase(), 2.4);
  // frases habladas cortas del jugador (bocadillo sobre la olla)
  pickups.onNote = (n, total) => {
    if (n % 10 === 0 && !dialog.active) {
      dialog.speaker = player.obj;
      dialog.play([{ t: pick(FRASES.nota), tone: 'exito', tail: 'down', hold: 0.9 }]);
    }
  };
  crates.onBreak = (c) => {
    if (Math.random() < 0.22 && !dialog.active) {
      dialog.speaker = null;
      dialog.play([{ t: pick(FRASES.caja), tone: 'grito', tail: 'down', hold: 0.8 }]);
    }
  };
  pickups.onMask = () => { if (!dialog.active) { dialog.speaker = player.obj; dialog.play([{ t: pick(FRASES.mask), tone: 'exito', tail: 'down', hold: 0.9 }]); } };
  pickups.onAura = () => {
    hud.toast('¡AURA RUMBERA! 🎸', 'record');
    dialog.speaker = player.obj;
    dialog.play([{ t: pick(FRASES.aura), tone: 'grito', tail: 'down', hold: 1.6 }]);
  };
  player.onFall = () => { if (!dialog.active) { dialog.speaker = player.obj; dialog.play([{ t: pick(FRASES.dano), tone: 'grito', tail: 'down', hold: 0.9 }]); } };
  // cutscene de entrada del jefe
  if (level.arena) {
    state.pending.push({
      after: 2.5, fn: () => {
        if (state.mode !== 'play') return;
        const prevMode = state.mode;
        state.mode = 'cine';
        playCutscene(JEFE.entrada, {
          speaker: boss.obj, camara: 'jefe', dur: 7.5,
          onEnd: () => { state.mode = 'play'; }
        });
      }
    });
  }
}

/* ================= fin de nivel / partida ================= */
function starsFor(level, notes, totalNotes, cratesBroken, totalCrates, time) {
  let s = 0;
  const noteRatio = totalNotes ? notes / totalNotes : 1;
  const crateRatio = totalCrates ? cratesBroken / totalCrates : 1;
  if (noteRatio >= 0.75) s++;
  if (crateRatio >= 0.8) s++;
  if (time < 200) s++;
  return Math.max(1, Math.min(3, s));
}
function endLevel(win, extra = {}) {
  if (state.ended) return;
  if (DEMO && demoDir && demoDir.activo) return;   // el vídeo nunca termina el nivel
  state.ended = true;
  const lv = state.level;
  const totalNotes = lv.notes.length + lv.masks.length * 3;
  const earnedNotes = pickups.noteCount + pickups.maskCount * 3;
  const time = Math.max(1, Math.floor(state.t));
  const stars = win ? starsFor(lv, earnedNotes, totalNotes, crates.broken, crates.total, time) : 0;
  const data = { notas: earnedNotes, cajas: crates.broken, tiempo: time, estrellas: stars, fecha: Date.now() };
  const prevForBest = records[lv.id];
  const { better } = win ? saveRecord(lv.id, data) : { better: false };

  Audio.stopGenerative();
  if (win) { Audio.sfx('victory'); fx.confettiBurst(); } else { Audio.sfx('death'); }

  hud.show(false);
  state.mode = win ? 'end' : 'over';

  if (win) {
    $('endTitle').textContent = extra.boss ? '¡CACHARRO DERROTADO! 🎸' : '¡Nivel completado!';
    $('stars').innerHTML = [1, 2, 3].map((i) => `<span class="s ${i <= stars ? 'on' : ''}">★</span>`).join('');
    $('statTime').textContent = `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`;
    $('statCrates').textContent = `${crates.broken}/${crates.total}`;
    $('statNotes').textContent = `${earnedNotes}/${totalNotes}`;
    const prev = prevForBest;
    const bestTxt = prev && prev.tiempo ? `${Math.floor(prev.tiempo / 60)}:${String(prev.tiempo % 60).padStart(2, '0')}` : '—';
    $('statBest').textContent = bestTxt;
    const hasNext = state.levelIndex < LEVELS.length - 1;
    $('btnNext').classList.toggle('hidden', !hasNext);
    if (better) hud.toast('¡RÉCORD NUEVO! 🏆', 'record');
    $('endPanel').classList.remove('hidden');
    postScore(lv.id, earnedNotes, stars, time);
    // diálogo al ganar el mundo (se lanza al pulsar Siguiente/Repetir)
    state.postWin = ENTRE_NIVELES[lv.id] || null; if (extra.boss) state.postWin = FINAL;
  } else {
    $('overPanel').classList.remove('hidden');
  }
}

function postScore(levelId, score, stars, time) {
  // Ranking propio del juego (separado de los otros juegos por el nombre "crash3d")
  try {
    const base = location.pathname.includes('/ollagitana') || location.pathname.includes('/juegos-olla') ? (location.pathname.split('/').slice(0, 3).join('/') + '/api') : '/api';
    fetch(`${base}/score`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: 'crash3d', diff: `n${levelId}`, name: (loadPrefs().name || 'Zagal').slice(0, 12), score, stars, time })
    }).catch(() => {});
  } catch (_) {}
}

/* ================= pausa ================= */
function togglePause(force) {
  if (state.mode !== 'play' && state.mode !== 'pause') return;
  const to = force != null ? force : state.mode === 'play';
  state.paused = to;
  state.mode = to ? 'pause' : 'play';
  hud.show(!to);
  $('pausePanel').classList.toggle('hidden', !to);
  if (to) {
    Audio.sfx('pause');
    Audio.stopGenerative();
    $('pauseStats').textContent = `Nivel ${LEVELS[state.levelIndex].nombre} · ${pickups.noteCount} notas · ${crates.broken}/${crates.total} cajones`;
  } else {
    Audio.startGenerative({ intensity: state.auraT > 0 ? 2 : 1 });
    Audio.setAura(state.auraT > 0);
  }
}

/* arranca el siguiente nivel (o repite) pasando por el diálogo del mundo */
function nextOrRetry(fn) {
  const lineas = state.postWin;
  state.postWin = null;
  if (lineas) {
    hideOverlays();
    state.mode = 'cine';
    dialog.speaker = null;
    playCutscene(lineas, { camara: 'cajaFija', onEnd: fn });
  } else fn();
}

/* ================= MODO DEMO (vídeo de presentación) ================= */
let demoDir = null;
function startDemo(onEnd) {
  if (!demoDir) demoDir = new DemoDirector({
    game: {
      startLevelForDemo: (i) => startLevel(i),
      playerPos: () => ({ ...player.pos }),
      ferminPos: () => ({ ...fermin.pos }),
      bossPos: () => ({ ...boss.pos }),
      showCineTitle,
      botOn: () => { if (!state.bot) state.bot = { t: 0, jumpCd: 0, spinCd: 0, stuckT: 0, lastZ: null, log: () => {} }; },
      godOn: () => { state.god = true; }
    },
    camera, scene, hud, dialog, intro, director
  });
  demoDir.start(onEnd);
}
function demoStep(dt) { if (demoDir) demoDir.update(dt); }
/* avanza exactamente un fotograma del guion (grabación determinista) */
function demoFrame(dt = 1 / 30) {
  if (!demoDir) return null;
  window.__recordPaused = true;
  if (demoDir.activo) tick(dt);   // tras el final del guion, la imagen se queda congelada
  renderer.render(scene, camera);
  return { activo: demoDir.activo, escena: demoDir.i, id: demoDir.escena ? demoDir.escena.id : null, t: demoDir.t };
}

function demoHooks() {
  window.__demo = {
    guion: DEMO_GUION,
    start: (onEnd) => startDemo(onEnd),
    state: () => ({ activo: demoDir ? demoDir.activo : false, escena: demoDir ? demoDir.i : -1, id: demoDir && demoDir.escena ? demoDir.escena.id : null, t: demoDir ? demoDir.t : 0 }),
    step: (dt = 1 / 30, n = 1) => { for (let i = 0; i < n; i++) demoStep(dt); },
    stepFrame: (dt = 1 / 30) => demoFrame(dt),
    pause: () => { window.__recordPaused = true; },
    resume: () => { window.__recordPaused = false; },
    jumpTo: (nivel) => startLevel(nivel),
    setCam: (x, y, z, lx, ly, lz) => { camera.position.set(x, y, z); camera.lookAt(lx, ly, lz); },
    hud: (v) => hud.show(v),
    cine: (l1, l2) => cineTitle(true, l1, l2),
    cineOff: () => cineTitle(false)
  };
}

/* ---------- aparición del jefe intermedio ---------- */
function checkFerminAppear() {  if (!state.ferminPending) return;
  if (player.pos.z > state.ferminZ - 6) {
    state.ferminPending = false;
    state.ferminActive = true;
    fermin.start();
    fermin.pos.x = 0; fermin.pos.z = state.ferminZ;
    if (fermin.obj) { fermin.obj.position.set(0, 0, state.ferminZ); }
    // un toque de drama: el escenario se tiñe
    fermin.onHp = (hp, max) => hud.toast(`🎺 FERMÍN ${Math.max(0, hp)}/${max}`, hp <= 1 ? 'bad' : '');
    fermin.onDefeat = () => {
      playCutscene(JEFE_INTERMEDIO.derrota, {
        speaker: fermin.obj, camara: 'jefe', dur: 5.5,
        onEnd: () => { endLevel(true, { fermin: true }); }
      });
    };
    // cutscene de entrada
    state.pending.push({
      after: 0.4, fn: () => {
        if (state.mode !== 'play') return;
        state.mode = 'cine';
        playCutscene(JEFE_INTERMEDIO.entrada, {
          speaker: fermin.obj, camara: 'jefe', dur: 6.0,
          onEnd: () => { state.mode = 'play'; }
        });
      }
    });
  }
}

/* ================= bucle ================= */
function updateCamera(dt) {
  const lv = state.level;
  const p = player.pos;
  if (lv && lv.arena) {
    // arena: cámara alta y alejada siguiendo al jugador
    const tx = p.x * 0.55, tz = p.z + 12.5;
    camState.x += (tx - camState.x) * Math.min(1, dt * 3);
    camState.z += (tz - camState.z) * Math.min(1, dt * 3);
    camState.y += (10.5 - camState.y) * Math.min(1, dt * 3);
    camera.position.set(camState.x, camState.y, camState.z);
    camera.lookAt(p.x * 0.4, 1.4, p.z * 0.35);
    camState.yaw = 0;
  } else if (lv && lv.chase) {
    // persecución: cámara detrás pero más alta y atrás (la furgo asoma por abajo)
    const tz = p.z - 10.2;
    camState.x += (p.x * 0.55 - camState.x) * Math.min(1, dt * 4);
    camState.z += (tz - camState.z) * Math.min(1, dt * 4);
    camState.y += (4.7 - camState.y) * Math.min(1, dt * 4);
    camera.position.set(camState.x, camState.y, camState.z);
    camera.lookAt(p.x * 0.5, 1.2, p.z + 5.5);
    camState.yaw = 0;
  } else {
    // raíl: detrás y arriba, yaw fijo
    const behind = 7.2, up = 4.15;
    const tx = p.x * 0.72, tz = p.z - behind;
    camState.x += (tx - camState.x) * Math.min(1, dt * 2.6);
    camState.z += (tz - camState.z) * Math.min(1, dt * 2.6);
    camState.y += (up - camState.y) * Math.min(1, dt * 2.4);
    camera.position.set(camState.x, camState.y, camState.z);
    camera.lookAt(p.x * 0.8, 1.0, p.z + 3.6);
    camState.yaw = 0;
  }
  if (fx.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * fx.shake * 0.32;
    camera.position.y += (Math.random() - 0.5) * fx.shake * 0.32;
  }
}

function inPuddle() {
  const lv = state.level;
  if (!lv) return false;
  for (const p of lv.puddles) {
    if (Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < p.r * 0.62 && player.pos.y < 0.4) return true;
  }
  if (lv.resbalon) {
    // el Casino: todo el suelo resbala (fricción muy baja)
    const onPulido = world.groundUnder({ minX: player.pos.x - 0.3, maxX: player.pos.x + 0.3, minZ: player.pos.z - 0.3, maxZ: player.pos.z + 0.3, minY: -50, maxY: 0 });
    if (onPulido && onPulido.box.tag === 'pulido') return true;
  }
  return false;
}

/* espejos del Casino: se materializan al acercarse el jugador */
function updateEspejos() {
  const lv = state.level;
  if (!lv) return;
  for (const b of world.boxes) {
    if (!b.espejo || !b.mesh) continue;
    const d = Math.hypot(player.pos.x - b.pos.x, player.pos.z - b.pos.z);
    const target = d < 6.5 ? 0.85 : 0.06;
    b.mesh.material.opacity += (target - b.mesh.material.opacity) * 0.12;
  }
}

/* humo del Entierro: frena y empuja al jugador */
function applyHumo(dt) {
  const lv = state.level;
  if (!lv) return;
  for (const b of world.boxes) {
    if (b.tag !== 'humo') continue;
    const inside = Math.abs(player.pos.x - b.pos.x) < b.half.x && Math.abs(player.pos.z - b.pos.z) < b.half.z && player.pos.y < 2.4;
    if (inside) {
      player.vel.x += Math.sin(state.t * 2.2) * 5 * dt;
      player.vel.z -= 2.4 * dt;
      if (Math.random() < 0.25) fx.burst({ x: player.pos.x, y: player.pos.y + 0.6, z: player.pos.z }, { count: 1, color: 0x9a9aa8, speed: 1.2, up: 1.8, life: 0.6, size: 1.1 });
    }
  }
}

/* ¿está el jugador dentro del anillo de la arena? (si no, aviso) */
function outOfArena() {
  const lv = state.level;
  if (!lv || !lv.arena) return false;
  return Math.abs(player.pos.x) > 21 || Math.abs(player.pos.z) > 21;
}

function damagePlayer(reason) {
  if (player.dead) return;
  if (state.god) return;                 // QA: modo dios
  const res = player.hurt();
  if (res === 'shield') { hud.toast('🛡️ ¡Escudo aguantó!', 'good'); Audio.sfx('crate'); return; }
  if (res !== 'hurt') return;
  if (window.__qa) window.__qa.data.damageLog.push({ reason, z: +player.pos.z.toFixed(1), x: +player.pos.x.toFixed(1), y: +player.pos.y.toFixed(1) });
  state.lives--;
  hud.setLives(state.lives);
  hud.damage();
  Audio.sfx('damage');
  fx.addShake(0.5);
  state.combo = 1;
  if (navigator.vibrate) navigator.vibrate(60);
  if (state.lives <= 0) {
    player.dead = true;
    state.pending.push({ after: 0.55, fn: () => endLevel(false) });
  }
}

function useCheckpoint(z) {
  state.checkpoint = { x: 0, y: 0.1, z: z - 3 };
  hud.toast('✔ Punto de control', 'good');
  Audio.sfx('checkpoint');
}

function respawnAtCheckpoint() {
  const c = state.checkpoint || state.level.spawn;
  player.reset(c.x, c.y + 0.4, c.z);
  player.vel.y = 6;
  hud.toast('¡Vuelta a la carga!', 'bad');
  Audio.sfx('damage');
}

function collectCrateHits() {
  // giro rompiendo cajas y aturdiendo enemigos
  if (player.spinning) {
    const c = crates.nearest(player.pos, player.hitRadius + 0.35, (cr) => !cr.dead && !cr.disabled);
    if (c) crates.hit(c, { fromSpin: true });
  }
  // pisotón
  if (!player.grounded && player.vel.y < -1.5) {
    const c = crates.nearest(player.pos, 0.95, (cr) => !cr.dead && !cr.disabled && cr.crateType !== 'checkpoint');
    if (c && Math.abs(c.mesh.position.y - (player.pos.y - player.hitHeight * 0.5)) < 0.8) {
      crates.hit(c, { fromStomp: true, power: 2 });
      player.vel.y = 7.6; // rebotar como en Crash
      Audio.sfx('bounce');
    }
  }
}

function crateInteractions() {
  for (const c of crates.items) {
    if (c.dead || c.disabled || !c.mesh || !c.mesh.visible) continue;
    const dx = Math.abs(c.mesh.position.x - player.pos.x);
    const dz = Math.abs(c.mesh.position.z - player.pos.z);
    const dy = Math.abs(c.mesh.position.y - (player.pos.y + 0.5));
    if (dx < 0.8 && dz < 0.8 && dy < 1.0) {
      if (c.crateType === 'nitro') { crates.nitro(c); damagePlayer('nitro'); }
      else if (c.crateType === 'tnt' && !c.lit) crates.igniteTnt(c);
      else if (c.crateType === 'checkpoint') { crates.checkpoint(c); useCheckpoint(c.mesh.position.z); }
    }
    // explosiones de TNT que toquen al jugador
    if (c.explodedNear && Math.hypot(c.mesh.position.x - player.pos.x, c.mesh.position.z - player.pos.z) < 3.4) damagePlayer('tnt');
  }
}

function blastCallback(p, radius) {
  // daño del nitro/tnt al jugador y a enemigos
  const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
  if (d < radius) damagePlayer('blast');
  for (const e of enemies.list) {
    if (!e.alive) continue;
    if (Math.hypot(e.obj.position.x - p.x, e.obj.position.z - p.z) < radius) {
      e.alive = false;
      scene.remove(e.obj);
      fx.burst({ x: e.obj.position.x, y: 0.6, z: e.obj.position.z }, { count: 14, speed: 6, up: 5, life: 0.8, colors: [0x9aa5b1, PALETA.rojo] });
    }
  }
}

function updateCombos(dt) {
  if (state.comboT > 0) {
    state.comboT -= dt;
    if (state.comboT <= 0 && state.combo > 1) {
      state.combo = Math.max(1, state.combo - 1);
      hud.setCombo(state.combo);
      state.comboT = 3.2;
    }
  }
  // power-ups temporizados
  if (state.auraT > 0) { state.auraT -= dt; player.aura = state.auraT > 0; Audio.setAura(state.auraT > 0); hud.setPower('aura', state.auraT / 14); if (state.auraT <= 0) { player.aura = false; hud.toast('Se fue el aura…'); } }
  if (state.ghostT > 0) { state.ghostT -= dt; player.ghost = state.ghostT; hud.setPower('ghost', state.ghostT / 6); }
  if (state.shieldT > 0) { state.shieldT -= dt; player.shield = state.shieldT > 0 ? 1 : 0; hud.setPower('shield', state.shieldT / 10); }
}

function checkGoal() {
  const lv = state.level;
  if (!lv || !lv.goal || lv.arena) return;
  // si hay jefe intermedio pendiente o vivo, la meta está cerrada
  if (state.ferminPending || (state.ferminActive && fermin.alive)) return;
  const d = Math.hypot(player.pos.x - lv.goal.x, player.pos.z - lv.goal.z);
  if (d < 3.6 || player.pos.z > lv.goal.z + 1.5) endLevel(true);
}

function updateVan(dt) {
  const lv = state.level;
  if (!lv || !lv.chase || !van) return;
  state.vanGrace = Math.max(0, (state.vanGrace || 0) - dt);
  // la furgo acelera contigo pero SIEMPRE queda algo más lenta que tu tope (8.4)
  const speed = Math.min(7.0, lv.van.speed + player.pos.z * 0.006);
  van.position.z += speed * dt;
  van.userData.wheels.forEach((w) => { w.rotation.x += speed * dt * 1.2; });
  van.position.x += (player.pos.x * 0.7 - van.position.x) * Math.min(1, dt * 1.2);
  // nube de polvo tras la furgo + sacudida cuando está cerca
  if (Math.random() < 0.6) {
    fx.burst({ x: van.position.x + (Math.random() - 0.5) * 1.2, y: 0.25, z: van.position.z - 1.8 },
      { count: 1, color: 0x8b8b8b, speed: 1.4, up: 1.6, life: 0.5, size: 0.9 });
  }
  const dist = player.pos.z - van.position.z;
  if (dist < 12) fx.addShake(0.06);
  if (dist < 1.4 && state.vanGrace <= 0) {
    damagePlayer('van');
    // empujón hacia ADELANTE (la furgo te embiste, no te manda al vacío)
    player.vel.z = Math.max(player.vel.z, 9);
    player.vel.y = 5.5;
    van.position.z = player.pos.z - 9.5;
    state.vanGrace = 2.2;
    fx.addShake(0.8);
  }
}

/* ---------- bot de QA: recorre el nivel automáticamente ---------- */
function botStep(dt) {
  if (!state.bot) return null;
  const b = state.bot;
  b.t += dt;
  b.jumpCd = Math.max(0, b.jumpCd - dt);
  b.spinCd = Math.max(0, b.spinCd - dt);
  b.stuckT = (b.stuckT || 0) + dt;
  const p = player.pos;
  if (b.lastZ == null) b.lastZ = p.z;
  if (Math.abs(p.z - b.lastZ) > 0.6) { b.lastZ = p.z; b.stuckT = 0; }

  // objetivo: la meta si está cerca, si no la nota más próxima por delante,
  // y si no hay, avanzar recto por el pasillo
  let target = state.level.goal ? { x: state.level.goal.x, z: state.level.goal.z } : { x: 0, z: p.z + 6 };
  if (state.level.goal && Math.abs(state.level.goal.z - p.z) < 14) {
    target = { x: state.level.goal.x, z: state.level.goal.z };
  } else {
    let best = 30;
    for (const n of pickups.notes) {
      if (n.taken) continue;
      const d = n.pos.z - p.z;
      if (d > 0.4 && d < best) { best = d; target = { x: n.pos.x, z: n.pos.z }; }
    }
  }
  // si lleva atascado, empuja en diagonal para desencallarse
  let dx = target.x - p.x;
  if (b.stuckT > 0.9) { dx += (Math.sin(b.t * 2) > 0 ? 1.4 : -1.4); }
  const out = {
    x: Math.max(-1, Math.min(1, dx * 0.8)),
    z: 1,
    jump: false, jumpP: false, spin: false, spinP: false, slide: false, slideP: false
  };
  // en la arena del jefe: colocarse, cubrirse tras los pilares y girar para devolver cajones
  if (state.level.arena) {
    out.jump = false; out.jumpP = false;
    // gira siempre (devuelve cajones y esquiva)
    if (b.spinCd <= 0) { out.spinP = true; b.spinCd = 0.42; }
    // ¿hay un cajón cerca? sal a por él girando
    const near = boss.projectiles.find((pr) => pr.alive && Math.hypot(pr.mesh.position.x - p.x, pr.mesh.position.z - p.z) < 3.4);
    if (near) {
      out.x = Math.max(-1, Math.min(1, (near.mesh.position.x - p.x) * 1.8));
      out.z = Math.max(-1, Math.min(1, (near.mesh.position.z - p.z) * 1.8));
    } else {
      // persigue al jefe para el pisotón (salta encima cuando está cerca)
      const bx = boss.pos.x, bz = boss.pos.z;
      const d = Math.hypot(bx - p.x, bz - p.z);
      out.x = Math.max(-1, Math.min(1, (bx - p.x) * 0.5));
      out.z = Math.max(-1, Math.min(1, (bz - p.z) * 0.5));
      if (d < 5.2 && player.grounded && b.jumpCd <= 0) { out.jump = true; out.jumpP = true; b.jumpCd = 0.6; }
    }
    // no salirse del ring
    if (Math.abs(p.x) > 17) out.x = p.x > 0 ? -1 : 1;
    if (Math.abs(p.z) > 17) out.z = p.z > 0 ? -1 : 1;
    // SALTA si hay una onda sonora acercándose
    const wave = enemies.waves.find((w) => Math.abs(Math.hypot(w.x - p.x, w.z - p.z) - w.r) < 2.0 && w.r > 2);
    if (wave && player.grounded) { out.jump = true; out.jumpP = true; }
  } else {
    // si va sobre el agua/acequia, busca el tronco lateral
  if (state.level.puddles && state.level.puddles.length) {
    for (const pd of state.level.puddles) {
      const dz = pd.z - p.z;
      if (dz > 0 && dz < 6) {
        // busca el lado con tronco más cercano
        const tx = p.x >= 0 ? 5.2 : -5.2;
        out.x = Math.max(-1, Math.min(1, (tx - p.x) * 0.7));
      }
    }
  }

  // esquiva de enemigos: solo si está MUY cerca y hay suelo a los lados
  let danger = null, dangerD = 2.4;
  for (const e of enemies.list) {
    if (!e.alive) continue;
    const d = Math.hypot(e.obj.position.x - p.x, e.obj.position.z - p.z);
    if (d < dangerD) { danger = e; dangerD = d; }
  }
  if (danger) {
    const ex = danger.obj.position.x - p.x;
    const side = ex > 0 ? -1 : 1;
    // ¿hay suelo si me aparto? si no, mejor saltar y seguir
    const safe = world.groundUnder({ minX: p.x + side * 0.8 - 0.4, maxX: p.x + side * 0.8 + 0.4, minZ: p.z - 0.4, maxZ: p.z + 0.4, minY: -50, maxY: p.y + 0.3 });
    if (safe) out.x = side;
    if (player.grounded && b.jumpCd <= 0) { out.jump = true; out.jumpP = true; b.jumpCd = 0.5; }
    if (b.spinCd <= 0) { out.spinP = true; b.spinCd = 0.5; }
  }
  // ondas sonoras o cirios: saltar
  const wave = enemies.waves.find((w) => Math.abs(Math.hypot(w.x - p.x, w.z - p.z) - w.r) < 2.2 && w.r > 2);
  if (wave && player.grounded && b.jumpCd <= 0) { out.jump = true; out.jumpP = true; b.jumpCd = 0.45; }

  // cuando Fermín está activo, el bot le ataca (salta encima)
  if (state.ferminActive && fermin.alive) {
    // persigue a Fermín y salta encima
    const fx2 = fermin.pos.x - p.x, fz2 = fermin.pos.z - p.z;
    const dF = Math.hypot(fx2, fz2);
    out.x = Math.max(-1, Math.min(1, fx2 * 0.5));
    out.z = Math.max(-1, Math.min(1, fz2 * 0.5));
    if (dF < 4.6 && player.grounded && b.jumpCd <= 0) { out.jump = true; out.jumpP = true; b.jumpCd = 0.55; }
    if (b.spinCd <= 0) { out.spinP = true; b.spinCd = 0.5; }
    return out;
  }

  // ¿hay que saltar? cajas, muros o huecos justo delante
    const crateAhead = crates.nearest({ x: p.x, y: p.y, z: p.z + 1.1 }, 1.6, (c) => !c.dead && !c.disabled && c.mesh && c.mesh.visible);
    const wallAhead = world.overlap({ minX: p.x - 0.3, maxX: p.x + 0.3, minZ: p.z + 0.45, maxZ: p.z + 1.15, minY: p.y + 0.15, maxY: p.y + 0.7 });
    const gapAhead = !world.groundUnder({ minX: p.x - 0.25, maxX: p.x + 0.25, minZ: p.z + 1.3, maxZ: p.z + 2.1, minY: -50, maxY: 0.1 });
    // cajas peligrosas (nitro/tnt): esquivarlas en vez de tocarlas
    const peligrosa = crates.items.find((c) => !c.dead && !c.disabled && c.mesh && c.mesh.visible
      && (c.crateType === 'nitro' || (c.crateType === 'tnt' && !c.lit))
      && Math.abs(c.mesh.position.z - p.z) < 3.4 && Math.abs(c.mesh.position.x - p.x) < 2.0);
    if (peligrosa) {
      const sx = peligrosa.mesh.position.x - p.x;
      const side = sx >= 0 ? -1 : 1;
      const safe = world.groundUnder({ minX: p.x + side * 1.0 - 0.4, maxX: p.x + side * 1.0 + 0.4, minZ: p.z - 0.4, maxZ: p.z + 0.4, minY: -50, maxY: p.y + 0.3 });
      if (safe) out.x = side;
    }
    if ((crateAhead || wallAhead || gapAhead || b.stuckT > 1.4) && (player.grounded || player.jumps < 2)) {
      out.jump = true;
      out.jumpP = b.jumpCd <= 0;
      if (out.jumpP) b.jumpCd = 0.34;
    }
    if (b.spinCd <= 0 && (crateAhead || b.stuckT > 0.7)) { out.spinP = true; b.spinCd = 0.55; }
  }
  return out;
}

function loop(now) {
  requestAnimationFrame(loop);
  // en modo grabación determinista el bucle no avanza solo: lo maneja __demo.stepFrame
  if (window.__recordPaused) return;
  const dt = Math.min(0.05, Math.max(0, (now - state.lastTime) / 1000 || 0));
  state.lastTime = now;
  tick(dt);
  renderer.render(scene, camera);
  if (BOT && window.__qa) window.__qa.tick(state, player, crates, pickups);
}

/* un paso de simulación (separado de rAF para poder testear en headless) */
function tick(dt) {
  // tareas diferidas (sin setTimeout: deben correr también en simulación)
  for (let i = state.pending.length - 1; i >= 0; i--) {
    const p = state.pending[i];
    p.after -= dt;
    if (p.after <= 0) { state.pending.splice(i, 1); try { p.fn(); } catch (e) { console.warn(e); } }
  }
  // fps
  state.frames++; state.fpsT += dt;
  if (state.fpsT >= 0.5) { state.fps = Math.round(state.frames / state.fpsT); state.frames = 0; state.fpsT = 0; }

  // MODO DEMO: manda el director de vídeo, sin HUD ni pantallas de fin
  if (DEMO && demoDir && demoDir.activo) {
    demoDir.update(dt);
    hud.show(false);
    if (state.mode === 'play') {
      const inp = botStep(dt) || input.poll();
      player.update(dt, inp, world, camState.yaw);
      crates.update(dt, player);
      collectCrateHits();
      crateInteractions();
      pickups.update(dt, player, { aura: player.aura });
      enemies.update(dt, player, { cover: coverBoxes });
      updateVan(dt);
      updateCombos(dt);
      if (dialog.sprite?.visible || dialog.active) dialog.update(dt);
      if (state.ferminActive) { if (fermin.alive) fermin.update(dt, player); else fermin.updateDeath(dt); }
      if (state.bossActive) { if (boss.alive) boss.update(dt, player); else boss.updateDeath(dt); }
    } else if (intro.activa) {
      intro.update(dt);
    }
    fx.update(dt);
    state.t += dt;
    return;
  }
  if (state.mode === 'play') {
    const inp = botStep(dt) || input.poll();
    const slippery = inPuddle();
    const frictionSave = slippery ? (state.level.resbalon ? 0.3 : 0.55) : 1;
    player.update(dt * frictionSave, inp, world, camState.yaw);
    crates.update(dt, player);
    collectCrateHits();
    crateInteractions();
    pickups.update(dt, player, { aura: player.aura });
    hud.setNotes(pickups.noteCount + pickups.maskCount * 3);
    const enemyHit = enemies.update(dt, player, { cover: coverBoxes });
    if (enemyHit) damagePlayer('enemy');
    if (state.bossActive) {
      if (boss.alive) {
        const bossHit = boss.update(dt, player);
        if (bossHit) damagePlayer('boss');
      } else {
        boss.updateDeath(dt);
      }
    }
    updateVan(dt);
    updateCombos(dt);
    updateEspejos();
    applyHumo(dt);
    checkFerminAppear();
    checkGoal();
    fx.update(dt);
    updateCamera(dt);
    hud.tick();
    state.t += dt;
    if (dialog.sprite?.visible || dialog.active) dialog.update(dt);
    if (state.ferminActive) {
      if (fermin.alive) {
        const fh = fermin.update(dt, player);
        if (fh) damagePlayer('fermin');
      } else fermin.updateDeath(dt);
    }
    if (state.level.chase && player.pos.z < state.level.spawn.z - 4) state.pressure = true;
    hud.setPressure(state.pressure && state.level.chase);
    if (player.pos.y < -12) { if (state.god) { respawnAtCheckpoint(); } else { damagePlayer('fall'); if (!player.dead) respawnAtCheckpoint(); } }
  } else if (state.mode === 'cine') {
    // cinemática: manda el director (cámara + diálogos)
    director.update(dt, {});
    if (intro.activa) intro.update(dt);
    fx.update(dt);
    state.t += dt;
  } else {
    fx.update(dt);
    if (state.mode === 'menu') {
      camState.z += dt * 1.4;
      camera.position.set(Math.sin(state.t * 0.4) * 2.2, 3.2, camState.z);
      camera.lookAt(0, 1.6, camState.z + 8);
      state.t += dt;
    }
  }

  if (bgPlane) bgPlane.position.z = camera.position.z + (state.level && state.level.arena ? -95 : 72);
  if (bgPlane && state.level && state.level.chase) bgPlane.position.z = camera.position.z + 68;
}

/* ================= eventos de UI ================= */
input.bindDom({
  stick: $('tStick'), knob: document.querySelector('#tStick .knob'),
  jumpBtn: $('tJump'), spinBtn: $('tSpin'), slideBtn: $('tSlide')
});
input.onPause = () => togglePause();
input.onAny = () => Audio.resume();

$('pauseBtn').onclick = () => togglePause();
$('btnResume').onclick = () => togglePause(false);
$('btnRestart').onclick = () => { togglePause(false); startLevel(state.levelIndex); };
$('btnLevels').onclick = () => { togglePause(false); clearLevel(); showMenu(); };
$('btnLevels2').onclick = () => { clearLevel(); showMenu(); };
$('btnNext').onclick = () => { const n = Math.min(LEVELS.length - 1, state.levelIndex + 1); nextOrRetry(() => startLevel(n)); };
$('btnRetry').onclick = () => nextOrRetry(() => startLevel(state.levelIndex));
$('btnOverRetry').onclick = () => startLevel(state.levelIndex);
$('btnOverLevels').onclick = () => { clearLevel(); showMenu(); };
$('btnHelp').onclick = () => { Audio.sfx('ui'); $('helpPanel').classList.remove('hidden'); };
$('btnHelpBack').onclick = () => $('helpPanel').classList.add('hidden');
$('btnIntro').onclick = () => { Audio.sfx('ui'); hideOverlays(); startIntro(() => { showMenu(); Audio.playMenuMusic(); }); };
$('btnMute').onclick = () => toggleMute();
$('btnMute2').onclick = () => toggleMute();
$('btnRank').onclick = () => showRank();
$('btnRankBack').onclick = () => { $('rankPanel').classList.add('hidden'); $('menuPanel').classList.remove('hidden'); };

function toggleMute() {
  const prefs = loadPrefs();
  const m = !prefs.muted;
  Audio.setMuted(m);
  savePrefs({ muted: m });
  $('btnMute').textContent = m ? '🔇 Sonido' : '🔊 Sonido';
  $('btnMute2').textContent = m ? '🔇 Sonido' : '🔊 Sonido';
  hud.toast(m ? '🔇 Sonido apagado' : '🔊 Sonido encendido');
}

function showRank() {
  $('menuPanel').classList.add('hidden');
  const box = $('rankBody');
  box.innerHTML = '<p class="small">Cargando…</p>';
  $('rankPanel').classList.remove('hidden');
  const base = location.pathname.includes('/ollagitana') || location.pathname.includes('/juegos-olla') ? (location.pathname.split('/').slice(0, 3).join('/') + '/api') : '/api';
  fetch(`${base}/top?game=crash3d&limit=12`).then((r) => r.json()).then((data) => {
    const rows = (data.scores || data.top || data || []);
    if (!Array.isArray(rows) || !rows.length) { box.innerHTML = '<p class="small">Todavía no hay puntuaciones. ¡Sé el primero!</p>'; return; }
    box.innerHTML = '<ol>' + rows.map((r) => `<li><b>${escapeHtml(r.name || '?')}</b> — ${r.score ?? r.puntos ?? 0} notas · nivel ${r.diff || ''}</li>`).join('') + '</ol>';
  }).catch(() => {
    const local = Object.entries(records).map(([k, v]) => ({ name: 'Tú', score: v.notas, diff: 'n' + k }));
    box.innerHTML = local.length ? '<ol>' + local.map((r) => `<li><b>${r.name}</b> — ${r.score} notas (nivel ${r.diff.replace('n', '')})</li>`).join('') + '</ol><p class="small">Sin conexión: mostrando tus récords de este dispositivo.</p>' : '<p class="small">Sin conexión y sin récords aún.</p>';
  });
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

/* QA: API expuesta */
window.__qa = {
  data: { errors: [], frames: 0, fpsSamples: [], damageLog: [] },
  tick(stateRef, p, cr, pk) {
    this.data.frames++;
    if (this.data.frames % 30 === 0) this.data.fpsSamples.push(stateRef.fps);
    if (this.data.fpsSamples.length > 40) this.data.fpsSamples.shift();
  },
  step: (dt = 1 / 30, n = 1) => { for (let i = 0; i < n; i++) tick(dt); },
  state: () => ({ mode: state.mode, level: state.level && state.level.id, lives: state.lives, pos: { ...player.pos }, notas: pickups.noteCount, cajas: crates.broken, totalCajas: crates.total, fps: state.fps, ended: state.ended, boss: state.bossActive ? { hp: boss.hp, phase: boss.phase, alive: boss.alive } : (state.ferminActive ? { hp: fermin.hp, phase: 1, alive: fermin.alive, fermin: true } : null), ferminPending: !!state.ferminPending }),
  start: (i) => startLevel(i),
  teleport: (x, y, z) => player.reset(x, y, z),
  enableBot: () => { state.bot = { t: 0, jumpCd: 0, spinCd: 0, stuckT: 0, lastZ: null, log: () => {} }; },
  damage: () => damagePlayer('qa'),
  win: () => endLevel(true),
  godMode: (on = true) => { state.god = !!on; },
  alive: () => !player.dead,
  notes: () => pickups.notes.filter((n) => !n.taken).map((n) => ({ x: n.pos.x, y: n.pos.y, z: n.pos.z })),
  minFps: function () { const s = this.data.fpsSamples.filter((x) => x > 0); return s.length ? Math.min(...s) : null; },
  avgFps: function () { const s = this.data.fpsSamples.filter((x) => x > 0); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null; }
};
window.addEventListener('error', (e) => { if (window.__qa) window.__qa.data.errors.push(String(e.message)); });

boot();
requestAnimationFrame((t) => { state.lastTime = t; loop(t); });
