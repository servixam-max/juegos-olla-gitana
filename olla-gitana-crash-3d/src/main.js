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
import { TrapSystem } from './game/traps.js';
import { LEVELS } from './game/levels.js';
import { MaskCompanion } from './game/mask.js';
import { Progreso, VIDAS_NIVEL, SUPER_VIDAS_INICIAL, CONTINUES } from './game/progreso.js';
import { logros3d } from './game/logros3d.js';
import { toonMat, makeOlla, makeVan, PALETA, makeNote, sfxMecanicas } from './game/art.js';
/* sonidos de las mecánicas Crash (ruinas, barriles, secretos): tono propio
   sintetizado — nunca hit.mp3 para aciertos (regla del proyecto). El motor
   no tiene estos casos, así que se registra un 'ui' y se sustituye el sonido. */
const SFX_MEC = new Set(['arrow', 'crujido', 'derrumb', 'rodar', 'barril', 'secreto', 'materializa']);
const _sfxOriginal = Audio.sfx.bind(Audio);
Audio.sfx = (name) => {
  if (SFX_MEC.has(name)) {
    _sfxOriginal('ui');
    if (Audio.log.length) Audio.log[Audio.log.length - 1] = name;   // el registro de QA muestra el nombre real
    if (Audio.ready && !Audio.muted) sfxMecanicas(Audio, name);
    return;
  }
  _sfxOriginal(name);
};
/* atrezzo ambiental en su propio módulo (decoración de escena, sin colisión) */
import {
  makeSignPost, makeBin, makeStreetLamp, makeAwning, makeBunting,
  makePotPlant, makeFruitBox, makeTileSign, makePoster, makeFloodlightTower
} from './game/deco.js';
/* atrezzo nuevo (art.js): solo visual, pegado a paredes o colgado alto */
import {
  makeBotijo, makeOlivo, makeCipres, makeCaseta, makeCadenaLuces, makeFuente
} from './game/art.js';
import { DialogQueue } from './narrative/bocadillos.js';
import { Director } from './narrative/director.js';
import { IntroScene } from './narrative/intro.js';
import { FinalScene } from './narrative/final.js';
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
  god: false,
  pendingScore: null,
  // vidas de nivel actuales (3) + super-vidas de reserva + continues: ver progreso.js
  superVidas: SUPER_VIDAS_INICIAL,
  continues: CONTINUES,
  mascara: 0,           // nivel de la máscara compañera (0-3)
  invT: 0,              // invulnerabilidad de la máscara dorada (s)
  pendingRanking: false  // subir al ranking solo al pasarse el juego (jefe final)
};

const records = loadRecords();
function loadRecords() {
  try { return JSON.parse(localStorage.getItem('olla3d_records_v1') || '{}'); } catch { return {}; }
}
/* progreso del jugador: niveles desbloqueados, super-vidas y continues */
const progreso = new Progreso();
/* logros del 3D: al conseguir uno suena el desbloqueo (el aviso lo pinta el módulo) */
logros3d.onUnlock = () => Audio.sfx('unlock');
/* en modo demo (vídeo de presentación) los logros no se registran ni avisan */
logros3d.silencioso = DEMO;
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
const traps = new TrapSystem({ scene, fx, audio: Audio, world });
const pickups = new Pickups({ scene, fx, audio: Audio });
const player = new Player(scene);
const boss = new Boss({ scene, fx, audio: Audio, enemies, pickups });
const fermin = new BossFermin({ scene, fx, audio: Audio, enemies });
/* máscara compañera (tipo Aku Aku): sigue a la olla y absorbe un golpe */
const maskCompanion = new MaskCompanion(scene);

let van = null;
let bgPlane = null, bgTexs = {};
let goalMesh = null, doorMesh = null;
let coverBoxes = [];
let ambientDecor = [];   // atrezzo ambiental del nivel (solo visual, sin colisión)

/* ---------- narrativa ---------- */
const dialog = new DialogQueue({ audio: Audio, camera, scene });
const director = new Director({ camera, scene, audio: Audio, fx, dialog, hud });
const intro = new IntroScene({ scene, director, audio: Audio, fx, dialog });
const finalScene = new FinalScene({ scene, director, audio: Audio, fx, dialog, camera });
let cineTitleEl = null;
function cineTitle(on, l1 = '', l2 = '', l3 = '') {
  if (!cineTitleEl) {
    cineTitleEl = document.createElement('div');
    cineTitleEl.id = 'cineTitle';
    cineTitleEl.innerHTML = '<div><div class="t1"></div><div class="t2"></div><div class="t3"></div></div>';
    document.getElementById('app').appendChild(cineTitleEl);
  }
  cineTitleEl.querySelector('.t1').textContent = l1;
  cineTitleEl.querySelector('.t2').textContent = l2;
  const t3 = cineTitleEl.querySelector('.t3');
  t3.textContent = l3 || '';
  t3.style.display = l3 ? '' : 'none';
  cineTitleEl.classList.toggle('on', !!on);
}

/* Reproduce una cutscene de diálogo sencilla (sin cámara especial):
   se usa al ganar un nivel y al entrar en un jefe.
   IMPORTANTE: hud.show(false) oculta HUD **y controles táctiles**; hay que
   restaurarlos SIEMPRE al acabar (si no, el jugador se queda sin mandos y
   parece que el juego está pillado — bug reportado por el usuario). */
function playCutscene(lineas, { onEnd = null, speaker = null, camara = 'cajaFija', dur = null, foco = null } = {}) {
  if (!lineas || !lineas.length) { if (onEnd) onEnd(); return; }
  const durTotal = dur || Math.max(4.5, lineas.reduce((a, l) => a + (l.t.length / 21 + (l.hold || 1.4) + 0.35), 0));
  state.mode = 'cine';
  hud.show(false);
  dialog.speaker = speaker;
  // foco por defecto: el propio interlocutor (así NUNCA se enfoca el vacío)
  const focoFinal = foco || (speaker ? { x: speaker.position.x, y: speaker.position.y + 2.6, z: speaker.position.z } : null);
  const planos = [{ camara, t: durTotal, dialogos: lineas }];
  director.start(planos, {
    cutscene: true,
    foco: focoFinal,
    onEnd: () => {
      dialog.speaker = null;
      // restaurar mandos si seguimos en partida (no en menú/fin de nivel)
      if (state.mode !== 'end' && state.mode !== 'over' && state.mode !== 'menu') {
        state.mode = 'play';
        hud.show(true);
      }
      if (onEnd) onEnd();
    }
  });
}

function showCineTitle(l1, l2, dur = 2.6, l3 = '') {
  cineTitle(true, l1, l2, l3);
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
  /* MÚSICA DE LA INTRO: en el plano del concierto (la banda tocando en el
     escenario) suena LA CANCIÓN REAL de la banda; el resto de la intro sigue
     con la rumba generativa tal cual está montada (luces: rumba · silencio:
     mudez dramática · cacharro: vuelve la rumba). Con guardas de modo para que
     saltar la intro no meta la canción encima del menú. */
  const planosIntro = INTRO.planos || [];
  let tConcierto = 0, durConcierto = 0, acc = 0, hayConcierto = false;
  for (const p of planosIntro) {
    const d = p.t / (intro.skipSpeed || 1);
    if (p.id === 'concierto') { tConcierto = acc; durConcierto = d; hayConcierto = true; }
    acc += d;
  }
  if (hayConcierto) {
    state.pending.push({ after: Math.max(0.05, tConcierto + 0.05), fn: () => {
      if (!intro.activa) return;                 // intro saltada antes: manda el menú
      Audio.stopGenerative();                    // la rumba cede el sitio a la banda real
      Audio.playSong({ volume: 0.30, fade: 0.8 });
    } });
    state.pending.push({ after: Math.max(1, tConcierto + durConcierto - 0.05), fn: () => {
      // empieza el ROBO de las notas: se hace el silencio dramático (también la
      // canción). Solo si la intro sigue en marcha: saltada, manda el menú.
      if (!intro.activa) return;
      Audio.stopSong({ fade: 0.5 });
    } });
  }
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

  // carga diferida: los sfx primero (ligeros); la canción de la banda (4,4 MB) en
  // segundo plano — el menú/intro ya la piden y arranca sola al terminar
  await Audio.loadSamples({
    hit: BGDIR + 'hit.mp3',
    levelup: BGDIR + 'levelup_special.mp3'
  });
  Audio.loadSample('music', BGDIR + 'music.mp3').catch(() => {});
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
    Audio.setMuted(!!prefs.muted);     // el botón de sonido (mute) se respeta desde el arranque
    if (prefs.vol != null) Audio.setVolume(prefs.vol);   // volumen general guardado
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
  // chip de progreso: super-vidas y continues disponibles
  hud.setSuper(progreso.superVidas, progreso.continues);
  const grid = $('levelGrid');
  grid.innerHTML = '';
  const desbloqueados = progreso.desbloqueados;
  LEVELS.forEach((lv, i) => {
    const rec = records[lv.id];
    const abierto = i < desbloqueados;
    const card = document.createElement('button');
    card.className = 'lvCard' + (abierto ? '' : ' locked');
    if (!abierto) {
      card.innerHTML = `
        <div class="thumb lockedThumb">🔒</div>
        <div class="body">
          <div class="t">${lv.nombre}</div>
          <div class="d">Supera el mundo ${i} para desbloquear</div>
          <div class="meta"><span class="tag lock">🔒 BLOQUEADO</span></div>
        </div>`;
      card.onclick = () => { Audio.sfx('land'); hud.toast('🔒 Supera el mundo anterior', 'bad'); };
      grid.appendChild(card);
      return;
    }
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
  // botón "Ver final": solo si ya se ha visto el final del juego (desbloqueado)
  const btnFinal = $('btnFinal');
  if (btnFinal) btnFinal.classList.toggle('hidden', !loadPrefs().finalVisto);
  $('gamepadHint').textContent = input.hasGamepad() ? '🎮 Mando detectado' : '';
  const prefs = loadPrefs();
  pintaBotonesSonido(!!prefs.muted);
  const vv = Math.round((prefs.vol != null ? prefs.vol : Audio.volume) * 100);
  if ($('volRange')) { $('volRange').value = vv; $('volLbl').textContent = vv + '%'; }
}
function hideOverlays() {
  ['menuPanel', 'helpPanel', 'pausePanel', 'endPanel', 'overPanel', 'rankPanel', 'videoPanel', 'logrosPanel'].forEach((id) => $(id).classList.add('hidden'));
  if ($('presentacion')) $('presentacion').pause();
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
  clearAmbientDecor();
  traps.clear();                                      // cuchillas de la arena
  // DECORACIÓN DE LOS NIVELES (levels.js/levels2.js): los `deco.push()` de los
  // constructores NO se limpiaban aquí → al montar el concierto final encima de
  // la arena del jefe quedaban pilares, guitarras y vallas del nivel 8 flotando
  // tras la banda (el usuario lo veía como "cosas raras" en el suelo del final).
  if (state.level && Array.isArray(state.level.deco)) {
    for (const d of state.level.deco) if (d && d.parent) scene.remove(d);
  }
}

/* ================= decoración ambiental (solo visual) =================
   Se monta en main.js (no en levels.js/levels2.js) para no chocar con la
   geometría jugable: nada de lo que hay aquí entra en world.boxes, así que
   NO bloquea el paso ni altera el suelo, las plataformas o la meta.
   Se coloca pegado a las paredes (|x| >= 4.4) y los carteles/paneles cuelgan
   altos, fuera del alcance del jugador. */
const DECO_SEED = (n) => {
  let s = Math.floor(n) || 1;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
};

function place(x, y, z, obj) {
  obj.position.set(x, y, z);
  scene.add(obj);
  ambientDecor.push(obj);
  return obj;
}

/* --- colocación de atrezzo pegada a la pared REAL de cada nivel ---
   Los pasillos no tienen todos el mismo ancho (13, 11, 9…): con una x fija
   el atrezzo acababa enterrado en el muro (niveles estrechos) o flotando
   sobre el vacío (calzadas con agujeros). Aquí se busca el borde interior
   del muro y el borde del suelo en esa z, la pieza se pega al menor de los
   dos y se comprueba que hay suelo justo debajo. Todo sigue siendo SOLO
   visual: nada de esto entra en world.boxes. */
const _bbTmp = new THREE.Box3();
function bordeMuro(z) {              // |x| del borde interior del muro, o null
  let b = null;
  for (const box of world.boxes) {
    if (box.tag !== 'wall') continue;
    if (z < box.pos.z - box.half.z - 0.6 || z > box.pos.z + box.half.z + 0.6) continue;
    const interior = Math.abs(box.pos.x) - box.half.x;
    if (interior < 0.8) continue;    // muro central: no es pared lateral
    b = b === null ? interior : Math.min(b, interior);
  }
  return b;
}
function bordeSuelo(z) {             // |x| máximo con suelo firme a esa z
  let b = null;
  for (const box of world.boxes) {
    if (box.tag !== 'floor' && box.tag !== 'pulido') continue;
    if (z < box.pos.z - box.half.z || z > box.pos.z + box.half.z) continue;
    if (box.max.y < -0.6 || box.max.y > 2.0) continue;
    const e = Math.abs(box.pos.x) + box.half.x;
    b = b === null ? e : Math.max(b, e);
  }
  return b;
}
function soporteSuelo(x, z) {
  for (const b of world.boxes) {
    if (b.tag !== 'floor' && b.tag !== 'pulido') continue;
    if (b.max.y < -0.6 || b.max.y > 2.0) continue;
    if (x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z) return b;
  }
  return null;
}
let decoFails = 0, decoPlaced = 0;   // QA: piezas descartadas/colocadas
function placeAlBorde(z, s, obj, margen = 0.18) {
  const bs = bordeSuelo(z), bm = bordeMuro(z);
  const limite = Math.min(bs === null ? 6.6 : bs, bm === null ? 6.6 : bm);
  obj.position.set(0, 0, z);
  obj.updateMatrixWorld(true);
  _bbTmp.setFromObject(obj);
  const rx = Math.max(Math.abs(_bbTmp.min.x), Math.abs(_bbTmp.max.x), 0.2);
  const x = s * Math.max(2.9, limite - margen - rx);
  for (const dx of [0, 0.35, 0.8]) {           // si el borde cae en un agujero, un poco más adentro
    const x2 = x - s * dx;
    if (soporteSuelo(x2, z) && soporteSuelo(x2 - s * rx * 0.6, z)) { place(x2, 0, z, obj); decoPlaced++; return x2; }
  }
  decoFails++;
  return null;   // sin suelo firme ahí: no se coloca (nada flotante sobre el vacío)
}

function buildAmbientDecor(level) {
  clearAmbientDecor();
  decoFails = 0; decoPlaced = 0;
  if (!level || state.decoOff) return;   // QA: permite apagar el atrezzo para aislar su efecto
  // arenas de jefe: torres de luz y faroles del duelo
  if (level.arena) {
    const rndA = DECO_SEED(99);
    for (const [tx, tz] of [[-17, 10], [17, 10], [-17, -10], [17, -10]]) {
      const fl = makeFloodlightTower({ height: 5.4, swing: -0.5 });
      fl.scale.setScalar(1.25);
      place(tx, 0, tz, fl);
    }
    // banderines de fiesta cruzando el escenario
    for (const bz of [-20, -15]) {
      const tr = makeBunting({ n: 13, span: 19 });
      place(0, 7.4, bz, tr);
    }
    // faroles alrededor del ring
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const p = makeStreetLamp({ h: 4.2, color: PALETA.morado });
      p.scale.setScalar(1.15);
      p.rotation.y = -a + Math.PI / 2;
      place(Math.cos(a) * 21.5, 0, Math.sin(a) * 21.5, p);
      if (rndA() < 0.5) {
        const b = makeBin({ color: PALETA.rosa });
        place(Math.cos(a) * 20.2, 0, Math.sin(a) * 20.2, b);
      }
    }
    // fuentes de la plaza en las esquinas traseras (detalle nuevo, sin colisión)
    for (const s of [-1, 1]) {
      const fu = makeFuente({ r: 1.3 });
      fu.scale.setScalar(1.15);
      place(s * 13.5, 0, 15.5, fu);
    }
    return;
  }

  const len = level.length || 160;
  const rnd = DECO_SEED(level.id * 7717 + 13);
  const m = level.id;
  const dark = (m === 5 || m === 7 || m === 8);      // mundos nocturnos / casino

  // (1) LUZ: farolas de forja suplementarias en los bordes del pasillo
  for (let z = 10; z < len - 6; z += 17) {
    for (const s of [-1, 1]) {
      if (rnd() < 0.35) continue;
      const h = 3.2 + rnd() * 0.8;
      const lap = makeStreetLamp({ h, color: dark ? PALETA.dorado : PALETA.rojoOsc });
      lap.rotation.y = s < 0 ? 0 : Math.PI;      // el báculo apunta hacia dentro
      placeAlBorde(z + s * 3.5, s, lap);
    }
  }
  // (2) CARTELES de Murcia: postes con nombre de la peña
  const carteles = ['MURCIA', 'AL SARDINERO', 'LA HUERTA', 'A LA GLORIA', 'EL CONTRAPASO', 'LAS 7 NOTAS', 'LA PARRA', 'A LA FLORIDA'];
  for (let z = 16, i = 0; z < len - 8; z += 26, i++) {
    const c = makeSignPost({ text: carteles[i % carteles.length], color: dark ? PALETA.dorado : PALETA.rojo, height: 2.0, dark });
    c.rotation.y = Math.PI * 0.5;
    placeAlBorde(z, -1, c);
    const t = makeTileSign({ text: carteles[(i + 3) % carteles.length].split(' ')[0], color: dark ? PALETA.azul : PALETA.verde });
    t.rotation.y = -Math.PI * 0.5;
    placeAlBorde(z + 12, 1, t);
  }
  // (3) PAPELERAS + MACETAS + CAJAS DE FRUTA (pegadas a las paredes)
  for (let z = 22; z < len - 10; z += 19) {
    const s = rnd() < 0.5 ? -1 : 1;
    const bi = makeBin({ color: dark ? PALETA.rosa : PALETA.verde });
    placeAlBorde(z, s, bi);
    const pp = makePotPlant({ scale: 0.9 + rnd() * 0.5 });
    placeAlBorde(z + 6, -s, pp);
    if (m === 1 || m === 6) {
      const fb = makeFruitBox();
      fb.rotation.y = rnd() * 0.6 - 0.3;
      placeAlBorde(z + 11, s, fb);
    }
  }
  // (4) TOLDOS sobre las paredes (como balcones de calle)
  for (let z = 30, i = 0; z < len - 14; z += 34, i++) {
    const s = i % 2 ? -1 : 1;
    const aw = makeAwning({ w: 3.2, d: 1.4, color: [PALETA.rojo, PALETA.verde, PALETA.azul, PALETA.naranja][i % 4] });
    const bs = bordeSuelo(z), bm = bordeMuro(z);
    const limite = Math.min(bs === null ? 6.6 : bs, bm === null ? 6.6 : bm);
    aw.position.set(s * (limite - 0.05), 3.6, z);       // pegado al muro, a 3,6 m de alto
    aw.rotation.y = s < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    scene.add(aw); ambientDecor.push(aw);
  }
  // (5) BANDERINES cruzando el pasillo (a 4.5 de alto, por encima del jugador)
  for (let z = 26; z < len - 12; z += 30) {
    const bu = makeBunting({ n: 10, span: 10.5 });
    bu.position.set(0, 4.5, z);
    scene.add(bu); ambientDecor.push(bu);
  }
  // (6) PÓSTERES de la gira en la calle, la procesión y la huerta
  //     Pegados al muro REAL de cada tramo (antes x fija ±5.5: en los pasillos
  //     estrechos el póster quedaba DENTRO del muro — reportado por la auditoría)
  if (m === 1 || m === 4 || m === 6) {
    for (let z = 44, i = 0; z < len - 20; z += 48, i++) {
      const po = makePoster({ text: ['FESTI', 'VERBENA', 'ROMERIA', 'FESTIVAL'][i % 4], color: [PALETA.morado, PALETA.rojo, PALETA.azul][i % 3], h: 2.8, w: 1.4 });
      const s = i % 2 ? -1 : 1;
      po.rotation.y = i % 2 ? Math.PI * 0.42 : -Math.PI * 0.42;
      const bs = bordeSuelo(z), bm = bordeMuro(z);
      const limite = Math.min(bs === null ? 6.6 : bs, bm === null ? 6.6 : bm);
      const x = s * Math.min(5.5, Math.max(3.2, limite - 0.05));
      if (soporteSuelo(x, z)) place(x, 0, z, po);
    }
  }
  // (7) ATRREZZO NUEVO por mundo (todo pegado a las paredes o colgado alto:
  //     nada invade el pasillo ni el aire de juego)
  // (7a) botijos y cajas de fruta junto a las macetas (calle, festi, huerta)
  if (m === 1 || m === 2 || m === 6) {
    for (let z = 26, i = 0; z < len - 12; z += 41, i++) {
      const s = i % 2 ? 1 : -1;
      const bo = makeBotijo({ scale: 0.85 + rnd() * 0.35 });
      bo.rotation.y = rnd() * 1.2 - 0.6;
      placeAlBorde(z + 3, s, bo);
      if (m !== 2) {
        const fb2 = makeFruitBox();
        fb2.rotation.y = rnd() * 0.5 - 0.25;
        placeAlBorde(z + 4.4, -s, fb2);
      }
    }
  }
  // (7b) casetas de feria (calle y festi): puesto de churros mirando al pasillo
  if (m === 1 || m === 2) {
    const rotulos = ['CHURROS', 'BUÑUELOS', 'LA PARRA', 'MELÓN'];
    for (let z = 58, i = 0; z < len - 26; z += 74, i++) {
      const s = i % 2 ? -1 : 1;
      const ca = makeCaseta({ text: rotulos[i % rotulos.length], color: [PALETA.rojo, PALETA.verde, PALETA.naranja][i % 3] });
      ca.rotation.y = s < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;   // el mostrador mira al centro
      placeAlBorde(z, s, ca, 0.05);
    }
  }
  // (7c) cadenas de luces de fiesta: cruzan el pasillo a 4,3 m (por encima del salto)
  if (m === 2 || m === 4) {
    for (let z = 40; z < len - 16; z += 34) {
      const cl = makeCadenaLuces({ span: 11.6, n: 12, colors: m === 4 ? [PALETA.dorado, PALETA.crema, PALETA.morado] : undefined });
      cl.position.set(0, 4.3, z);
      scene.add(cl); ambientDecor.push(cl);
    }
  }
  // (7d) arbolado por mundo: cipreses en la procesión, olivos en la huerta
  for (let z = 34, i = 0; z < len - 14; z += 53, i++) {
    const s = i % 2 ? 1 : -1;
    if (m === 4) {
      const cip = makeCipres({ h: 3.0 + rnd() * 0.9 });
      placeAlBorde(z, s, cip);
    } else if (m === 6) {
      const ol = makeOlivo({ scale: 0.9 + rnd() * 0.35 });
      placeAlBorde(z, s, ol);
    }
  }
}
function clearAmbientDecor() {
  for (const o of ambientDecor) scene.remove(o);
  ambientDecor = [];
}

/* Animación muy barata del atrezzo (solo lo que tiene userData preparado):
   el agua de las fuentes ondula y las cadenas de luces parpadean. */
function animateAmbientDecor(dt, t) {
  for (const o of ambientDecor) {
    const ud = o.userData;
    if (ud && ud.water) {
      ud.water.position.y = 0.53 + Math.sin(t * 2.4 + o.position.x) * 0.02;
      if (ud.chorro) ud.chorro.scale.y = 1 + Math.sin(t * 6) * 0.06;
    }
  }
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
  state.vidasPerdidasNivel = 0;      // para el logro de terminar sin perder vida

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
      // la caja de CONTORNO es un dibujo: no es sólida hasta materializarse
      if (c.crateType === 'outline') b.solid = false;
      c.worldBox = b;
    } else if (c.worldBox && c.crateType === 'outline') {
      c.worldBox.solid = false;   // al reiniciar el nivel vuelve a ser fantasma
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
    // si el nivel no tiene jefe, la meta ya estaba a la vista: sin aviso.
    // Si tiene jefe (Fermín), el aviso de "¡La salida está abierta!" sale
    // justo cuando cae el jefe y la meta se hace visible.
    goalMesh.userData.avisado = !level.bossIntermedio;
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
    state.assaults = 0;
    state.invicto = false;              // el Cacharro está vivo: hay peligro
    boss.hp = boss.maxHp;
    // CUCHILLAS de la arena: la fase 1 ya trae 2 (petición del usuario).
    // zSegura: NINGUNA cuchilla dentro de los 3,5 m del punto de reaparición
    // (queja del usuario: "las cuchillas salen donde el personaje y te matan
    // sin llegar a manejar").
    traps.load({ zSegura: (level.spawn ? level.spawn.z : 14) - 3.5 });
    boss.onHp = (hp, max) => {
      if (hp <= 0) state.invicto = true;   // jefe derrotado: ya no te pueden matar
      hud.toast(`👹 CACHARRO ${Math.max(0, hp)}/${max}`, hp <= 1 ? 'bad' : '');
    };
    /* FASE: SOLO aviso + obstáculos nuevos. La cutscene y el retorno al inicio
       los lleva el ASALTO de abajo (antes se pisaban: al quitarle una vida se
       disparaban onPhase y onHit a la vez, cada uno con su cutscene, y el
       retorno al inicio se abortaba). */
    boss.onPhase = (ph) => {
      Audio.sfx('phaseup');
      traps.setFase(ph);          // cada fase trae obstáculos nuevos
    };
    /* ASALTO: al quitarle una vida, el juego se para, sale la cutscene y te
       DEVUELVE AL INICIO del mapa (spawn). Una sola secuencia limpia, sin
       solapes. 3 asaltos = victoria. */
    boss.onHit = () => {
      if (!boss.alive || boss.hp <= 0) return;
      state.assaults = (state.assaults || 0) + 1;
      const fases = [null, 'FASE 1 → 2', 'FASE 2 → 3', 'ÚLTIMA FASE'];
      hud.toast(`⚡ ${fases[state.assaults] || 'FASE'}`, 'bad');
      const linea = (JEFE.asaltos && JEFE.asaltos[state.assaults]) || null;
      // parar el juego YA (modo cine) para que nada más se dispare encima
      state.mode = 'cine';
      state.pending.push({ after: 0.55, fn: () => {
        if (state.ended) return;
        const onEnd = () => { volverAlInicioJefe(); };
        if (linea) playCutscene(linea, { speaker: boss.obj, camara: 'jefe', dur: 3.2, onEnd });
        else { hud.show(false); director.start([{ camara: 'jefe', t: 1.2, foco: { x: boss.pos.x, y: 3.4, z: boss.pos.z }, onEnd }], { cutscene: true, foco: { x: boss.pos.x, y: 3.4, z: boss.pos.z } }); }
      } });
    };
    boss.onDefeat = () => {
      // jefe muerto: la arena se despeja (las cuchillas se van) y ya no te
      // pueden matar (petición del usuario: "una vez matado el jefe del todo
      // no te pueden matar")
      state.invicto = true;
      traps.clear();
      enemies.waves = enemies.waves.filter((w) => { if (w.alive) { scene.remove(w.mesh); w.alive = false; } return false; });
      boss.projectiles.forEach((p) => { if (p.alive) { scene.remove(p.mesh); p.alive = false; } });
      boss.projectiles = [];
      logros3d.registrar('jefe', { jefe: 'cacharro' });
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

  // atrezzo ambiental del mundo (carteles, farolas, toldos, banderines…): decorativo
  buildAmbientDecor(level);

  hideOverlays();
  hud.show(true);
  hud.start();
  crates.publish();                                        // re-sincroniza el contador de cajones
  hud.setLives(state.lives);
  hud.setSuper(progreso.superVidas, progreso.continues);
  maskCompanion.reset();                                   // el puro no sobrevive entre niveles
  state.invT = 0;
  state.invicto = false;                                   // sin jefe muerto: hay peligro
  // la meta NO se ve hasta cumplir el objetivo del nivel (matar al jefe si lo hay)
  actualizarMetaVisible();
  hud.setHint(level.tip.length > 52 ? level.tip.slice(0, 50) + '…' : level.tip);
  state.mode = 'play';
  Audio.resume();
  Audio.startGenerative({ intensity: 1 });
  Audio.setAura(false);
  savePrefs({ lastLevel: index });
  logros3d.registrar('nivelIniciado', { index });
  // cartel del mundo al empezar (con subtítulo narrativo de la historia)
  const SUBTITULOS = [
    'Las 7 notas están escondidas por Murcia. ¡A por ellas!',
    'El Cacharro anda cerca: recupera lo robado en los andamios.',
    '¡La furgo no perdona! Corre hacia el escenario.',
    'En Semana Santa también se toca: sigue el desfile.',
    'Fermín Cascabel guarda una nota. ¡Dale su merecido!',
    'En la huerta hay acequias, abejas y mucho ritmo.',
    'El Cacharro se esconde en el Casino. ¡Que no se escape!',
    'El duelo final: devuélvele sus cajones y que pare la rumba.'
  ];
  showCineTitle(`MUNDO ${index + 1}`, def.nombre.toUpperCase(), 2.9, SUBTITULOS[index] || '');
  // frases habladas cortas del jugador (bocadillo sobre la olla)
  pickups.onNote = (n, total) => {
    logros3d.registrar('nota');
    if (n % 10 === 0 && !dialog.active) {
      dialog.speaker = player.obj;
      dialog.play([{ t: pick(FRASES.nota), tone: 'exito', tail: 'down', hold: 0.9 }]);
    }
  };
  crates.onBreak = (c) => {
    logros3d.registrar('caja', { tipo: c && c.crateType });
    if (Math.random() < 0.22 && !dialog.active) {
      dialog.speaker = null;
      dialog.play([{ t: pick(FRASES.caja), tone: 'grito', tail: 'down', hold: 0.8 }]);
    }
    // racha rumbera: 5 cajones seguidos suben el combo (x3.0 → x4.0 → x5.0)
    state.combo = Math.min(5, +(state.combo + 0.2).toFixed(1));
    state.comboT = 3.2;
    hud.setCombo(state.combo);
    logros3d.registrar('combo', { valor: state.combo });
    // chispas de madera + destello en el sitio de la caja (refuerza el 'crate')
    if (c && c.mesh) {
      const cp = c.mesh.position;
      fx.flash({ x: cp.x, y: cp.y + 0.3, z: cp.z }, { color: 0xffe9a8, size: 1.9, life: 0.24 });
      fx.ring({ x: cp.x, y: Math.max(0.05, cp.y - 0.4), z: cp.z }, { color: PALETA.madera, r0: 0.3, r1: 1.7, life: 0.36 });
    }
    // subida de combo: aviso rápido en pantalla (solo cuando sube, no al mantenerse)
    if (state.combo >= 3 && state.combo !== state._comboToast) {
      state._comboToast = state.combo;
      hud.toast(`🔥 COMBO x${state.combo.toFixed(1)}`, 'record');
    }
  };
  // interruptor (!) pulsado: la puerta del final se abre con su propio sonido
  crates.onSwitch = () => {
    hud.toast('🔔 ¡MECANISMO! La salida se desbloquea', 'good');
    Audio.sfx('gate');
    // la onda también MATERIALIZA las cajas de contorno del tramo (atajo secreto)
    materializarContornos(player.pos.z);
    // onda azul en el sitio del mecanismo (feedback inmediato)
    fx.ring({ x: player.pos.x, y: player.pos.y, z: player.pos.z }, { color: PALETA.azul, r0: 0.4, r1: 3.4, life: 0.6 });
    fx.flash({ x: player.pos.x, y: player.pos.y + 0.8, z: player.pos.z }, { color: 0x4cc9f0, size: 2.2, life: 0.35 });
  };
  // caja ? agotada: cierre dorado
  crates.onBounceUnlock = () => { Audio.sfx('combo'); };
  pickups.onMask = () => {
    // PUROS voladores (antes máscaras): nivel 1 = a la boca, nivel 2 = BUFF
    const nivel = maskCompanion.add();
    logros3d.registrar('mascara', { nivel });
    // el puro FIJO de la boca se esconde: el compañero (MaskCompanion) ya pone
    // el puro real en la boca, y si no, se verían dos superpuestos
    if (player.obj && player.obj.userData.puroBoca) player.obj.userData.puroBoca.visible = false;
    const txt = nivel >= 2
      ? '🚬 ¡2 PUROS! 30 s invulnerable, más rápido y salto extra 🔥'
      : '🚬 ¡Puro en la boca! Consigue otro para el subidón';
    hud.toast(txt, 'record');
    if (nivel >= 2) Audio.sfx('aura');
    // bocanada de humo al cogerlo (feedback claro)
    const mp = { x: player.pos.x, y: player.pos.y + 1.1, z: player.pos.z };
    fx.flash(mp, { color: 0xf5f5f5, size: 2.6, life: 0.36 });
    fx.ring(mp, { color: 0xffd9a0, r0: 0.4, r1: 3.0, life: 0.55 });
    fx.burst(mp, { count: 14, speed: 4.5, up: 5.5, life: 0.9, size: 1, colors: [0xf5f5f5, 0xffd9a0, 0xd7d7d7, 0xffffff] });
    fx.addShake(nivel >= 2 ? 0.3 : 0.15);
    if (!dialog.active) { dialog.speaker = player.obj; dialog.play([{ t: pick(FRASES.mask), tone: 'exito', tail: 'down', hold: 0.9 }]); }
  };
  pickups.onAura = () => {
    hud.toast('¡AURA RUMBERA! 🎸', 'record');
    // abanico dorado alrededor de la olla
    fx.flash({ x: player.pos.x, y: player.pos.y + 1, z: player.pos.z }, { color: 0xffbe0b, size: 3, life: 0.45 });
    fx.ring({ x: player.pos.x, y: player.pos.y, z: player.pos.z }, { color: PALETA.dorado, r0: 0.5, r1: 4.2, life: 0.7 });
    fx.burst({ x: player.pos.x, y: player.pos.y + 0.8, z: player.pos.z }, { count: 18, speed: 6, up: 6, life: 1, size: 1.1, colors: [PALETA.dorado, 0xff8800, 0xffffff] });
    dialog.speaker = player.obj;
    dialog.play([{ t: pick(FRASES.aura), tone: 'grito', tail: 'down', hold: 1.6 }]);
  };
  player.onFall = () => { if (!dialog.active) { dialog.speaker = player.obj; dialog.play([{ t: pick(FRASES.dano), tone: 'grito', tail: 'down', hold: 0.9 }]); } };
  // polvo al correr y estela de la barrida (sparks a ras de suelo)
  player.onDust = () => {
    if (player.sliding) {
      // roce continuo de la barrida (sutil; la estela visual ya está en fx)
      Audio.sfx('slideLoop');
      fx.burst({ x: player.pos.x, y: player.pos.y + 0.12, z: player.pos.z }, { count: 2, speed: 2.2, up: 2.0, life: 0.32, size: 0.8, colors: [0xffbe0b, 0xffe9a8, 0xcbb9a0] });
    } else {
      // PASOS al correr: golpecito sordo sincronizado con el polvo (muy bajo)
      Audio.sfx('step');
      fx.burst({ x: player.pos.x, y: player.pos.y + 0.08, z: player.pos.z }, { count: 1, speed: 1.1, up: 1.2, life: 0.4, size: 0.75, colors: [0x9a9aa8, 0xcbb9a0], puff: 0.4 });
    }
  };
  // AL SALTAR: el guiso salpica (la olla va llena y en movimiento)
  player.onJump = () => {
    const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = 0.12 + Math.random() * 0.22;
      fx.burst({
        x: player.pos.x + Math.sin(a) * rr, y: player.pos.y + 1.05, z: player.pos.z + Math.cos(a) * rr
      }, {
        count: 1, speed: 1.6 + Math.random() * 1.8, up: 3.4 + Math.random() * 2.4,
        life: 0.42 + Math.random() * 0.22, size: 0.85,
        colors: [0xc4530e, 0xe07b1f, 0xffbe0b, 0x8c3b08]
      });
    }
    // aro del salto: el guiso se derrama en redondo al despegar
    fx.ring({ x: player.pos.x, y: player.pos.y, z: player.pos.z }, { color: 0xc4530e, r0: 0.22, r1: 1.15, life: 0.34 });
    Audio.sfx('splash');
  };
  // salto largo (barrida + salto): el silbido propio del impulso
  player.onLongJump = () => {
    Audio.sfx('longjump');
    hud.toast('¡SALTO LARGO! 🚀', 'good');
    // estela dorada del impulso
    fx.burst({ x: player.pos.x, y: player.pos.y + 0.3, z: player.pos.z }, { count: 10, speed: 3, up: 2.2, life: 0.55, size: 0.9, colors: [PALETA.dorado, 0xffe9a8, PALETA.azul] });
  };
  // aterrizaje fuerte: caída desde alto o pisotón desde el aire
  player.onLand = () => {
    const impacto = player.landImpact || 0;
    if (impacto > 9.5) {
      Audio.sfx('hardland');
      // polvo en abanico pegado al suelo + sacudida + destello (aterrizaje contundente)
      fx.burst({ x: player.pos.x, y: player.pos.y + 0.1, z: player.pos.z }, { count: 10, speed: 3.4, up: 1.3, life: 0.55, size: 1.2, colors: [0xcbb9a0, 0x9a9aa8], puff: 0.5, drag: 2.2 });
      fx.ring({ x: player.pos.x, y: player.pos.y, z: player.pos.z }, { color: 0xcbb9a0, r0: 0.3, r1: 2.2, life: 0.42 });
      fx.addShake(0.3);
    } else if (impacto > 6.5) {
      // aterrizaje medio: un puff suave (menos que antes, pero se nota)
      fx.burst({ x: player.pos.x, y: player.pos.y + 0.08, z: player.pos.z }, { count: 4, speed: 2.2, up: 1.1, life: 0.4, size: 0.9, colors: [0xcbb9a0, 0x9a9aa8], puff: 0.5, drag: 2.4 });
    }
  };
  // al pisar una caja desde el aire ya suena 'bounce' (collectCrateHits)
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
  // nivel superado: se desbloquea el siguiente (guardado local, como los logros)
  if (win) {
    progreso.completarNivel(state.levelIndex);
    const desb = progreso.desbloqueados;
    if (desb > state.levelIndex + 1 && desb <= LEVELS.length) {
      hud.toast(`🔓 ¡MUNDO ${desb} desbloqueado!`, 'record');
      Audio.sfx('unlock');
    }
  }
  const totalNotes = lv.notes.length + lv.masks.length * 3;
  const earnedNotes = pickups.noteCount + pickups.maskCount * 3;
  const time = Math.max(1, Math.floor(state.t));
  const stars = win ? starsFor(lv, earnedNotes, totalNotes, crates.broken, crates.total, time) : 0;
  const data = { notas: earnedNotes, cajas: crates.broken, tiempo: time, estrellas: stars, fecha: Date.now() };
  const prevForBest = records[lv.id];
  const { better } = win ? saveRecord(lv.id, data) : { better: false };
  if (win) {
    logros3d.registrar('nivelCompletado', {
      index: state.levelIndex, estrellas: stars, tiempo: time,
      sinDano: (state.vidasPerdidasNivel || 0) === 0
    });
  }

  Audio.stopGenerative();
  if (win) { Audio.sfx(extra.boss ? 'bossdown' : 'victory'); fx.confettiBurst(); } else { Audio.sfx('death'); }

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
    // NOMBRE: al acabar cada nivel NO se pide el nombre ni se guarda nada
    // (petición del usuario: "cuando acabas cada nivel no te lo tiene que pedir
    // el nombre ni guardar, solo se guarda al final"). El campo solo aparece al
    // PASARSE EL JUEGO ENTERO (jefe final derrotado).
    const filaFinal = $('finalNameRow');
    if (filaFinal) filaFinal.classList.toggle('hidden', !extra.boss);
    $('playerName').value = loadPrefs().name || '';
    state.pendingScore = { id: lv.id, score: earnedNotes, stars, time };
    $('endPanel').classList.remove('hidden');
    // ¿ha ganado el JUEGO? (jefe final derrotado) → al guardar el nombre sale el
    // FINAL del concierto con la banda (petición del usuario)
    state.esFinal = !!extra.boss;
    // el envío al ranking SOLO ocurre al pasarse el juego (aquí), no en cada nivel
    if (extra.boss) state.pendingRanking = true;
    // diálogo al ganar el mundo (se lanza al pulsar Siguiente/Repetir)
    state.postWin = ENTRE_NIVELES[lv.id] || null; if (extra.boss) state.postWin = FINAL;
  } else {
    $('overBest').textContent = prevForBest && prevForBest.tiempo ? `${Math.floor(prevForBest.tiempo / 60)}:${String(prevForBest.tiempo % 60).padStart(2, '0')}` : '—';
    $('overNotes').textContent = `${earnedNotes}/${totalNotes}`;
    $('overCrates').textContent = `${crates.broken}/${crates.total}`;
    state.pendingScore = { id: lv.id, score: earnedNotes, stars: 0, time };
    $('overPanel').classList.remove('hidden');
    // OJO: al perder NO se pide nombre ni se guarda nada en el ranking —
    // solo se guarda al PASARSE EL JUEGO entero (petición del usuario)
  }
}

function apiBase() {
  // La API vive en /ollagitana/api (o /juegos-olla/api) — NO dentro de la carpeta del juego.
  const p = location.pathname;
  if (p.startsWith('/ollagitana/')) return '/ollagitana/api';
  if (p.startsWith('/champi/')) return '/champi/api';
  if (p.startsWith('/juegos-olla/')) return '/juegos-olla/api';
  return 'api';
}

function postScore(levelId, score, stars, time, name) {
  // Ranking propio del juego (separado de los otros juegos por el nombre "crash3d").
  // Petición del usuario: SOLO sube al ranking quien se ha PASADO EL JUEGO
  // (derrotado al Cacharro). Los récords por nivel se quedan en local.
  try {
    fetch(`${apiBase()}/score`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: 'crash3d', diff: 'final', name: String(name || loadPrefs().name || 'Zagal').slice(0, 12), score, stars, time })
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

/* ---------- arena del jefe: vuelta al inicio y reset de fases ---------- */
/* Al quitarle una vida al jefe (asalto) o al morir el jugador en la arena, se
   vuelve AL INICIO DEL MAPA (el spawn del nivel, no a un z fijo) y el jefe se
   queda esperando en su sitio. Si el jugador MUERE, el jefe se resetea a fase 1
   (petición del usuario: "si te matan tienes que empezar desde la fase 1, no
   continuar; hay que matar las 3 fases sin que te mate"). */
function volverAlInicioJefe() {
  const sp = state.level && state.level.spawn ? state.level.spawn : { x: 0, y: 0.2, z: 14 };
  player.reset(sp.x, sp.y, sp.z);
  camState.x = sp.x; camState.z = sp.z - 7.4; camState.yaw = 0;
  if (boss.obj) boss.obj.position.set(0, 0, -8);
  traps.reset();
  traps.setFase(boss.phase);
  // limpia las ondas/bombas que siguieran activas (no te pueden tocar al volver)
  enemies.waves = enemies.waves.filter((w) => { if (w.alive) { scene.remove(w.mesh); w.alive = false; } return false; });
  boss.projectiles.forEach((p) => { if (p.alive) { scene.remove(p.mesh); p.alive = false; } });
  boss.projectiles = [];
  // unos segundos de invulnerabilidad al volver: el jugador acaba de pegarle
  // al jefe y no debe morir nada más reaparecer (petición del usuario)
  player.invulnT = Math.max(player.invulnT, 2.5);
  traps.grace(2.5);
  state.mode = 'play';
  hud.show(true);
  hud.toast('¡Vuelve a por él! 🏃', 'bad');
}

/* muerte del jugador en la arena: el Cacharro vuelve a FASE 1 con toda la vida */
function resetJefeFase1() {
  if (!state.level || !state.level.arena) return;
  boss.hp = boss.maxHp;
  boss.phase = 1;
  boss.phaseT = 0;
  boss.invT = 0;
  boss.alive = true;
  boss.cd = 2.2;
  if (boss.obj) { boss.obj.position.set(0, 0, -8); boss.obj.visible = true; }
  boss.projectiles.forEach((p) => scene.remove(p.mesh));
  boss.projectiles = [];
  // limpia también las ondas del suelo que hubiera dejado el jefe
  enemies.waves = enemies.waves.filter((w) => { if (w.alive) { scene.remove(w.mesh); w.alive = false; } return false; });
  traps.reset();               // vuelven las 2 cuchillas de la fase 1
  traps.grace(2.0);            // y se arman con aviso ámbar (no te matan al salir)
  state.assaults = 0;
  state.invicto = false;       // el jefe revive: vuelve el peligro
  boss.onHp && boss.onHp(boss.hp, boss.maxHp);
  hud.toast('👹 ¡El Cacharro se recompone! Vuelve a FASE 1', 'bad');
}

function checkFerminAppear() {  if (!state.ferminPending) return;
  if (player.pos.z > state.ferminZ - 6) {
    state.ferminPending = false;
    state.ferminActive = true;
    fermin.start();
    fermin.pos.x = 0; fermin.pos.z = state.ferminZ;
    if (fermin.obj) { fermin.obj.position.set(0, 0, state.ferminZ); }
    // margen extra de vidas para la pelea del jefe (como la arena del Cacharro:
    // antes llegabas con 1-2 vidas y era imposible)
    state.lives = Math.max(state.lives, 6);
    hud.setLives(state.lives);
    hud.toast('¡JEFE! Ahora tienes más margen 💛');
    // un toque de drama: el escenario se tiñe
    fermin.onHp = (hp, max) => {
      if (hp <= 0) state.invicto = true;   // jefe derrotado: ya no te pueden matar
      hud.toast(`🎺 FERMÍN ${Math.max(0, hp)}/${max}`, hp <= 1 ? 'bad' : '');
    };
    fermin.onDefeat = () => {
      // jefe derrotado: no te pueden matar mientras celebra (petición del usuario)
      state.invicto = true;
      logros3d.registrar('jefe', { jefe: 'fermin' });
      playCutscene(JEFE_INTERMEDIO.derrota, {
        speaker: fermin.obj, camara: 'jefe', dur: 5.5,
        onEnd: () => { endLevel(true, { fermin: true }); }
      });
    };
    // aviso cuando se queda vulnerable (ojos rojos): ¡salta encima!
    fermin.onVulnerable = () => hud.toast('🔴 ¡SALTA ENCIMA!', 'good');
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
  // pantalla vertical (móvil): cámara más alta y cerca, mira más adelante
  const portrait = window.innerHeight > window.innerWidth;
  if (lv && lv.arena) {
    // arena: cámara alta y alejada siguiendo al jugador.
    // La cámara mira hacia -Z (está en el lado +Z), así que el yaw para el
    // movimiento relativo es π: pantalla-arriba = -Z (hacia el jefe).
    const tx = p.x * 0.55, tz = p.z + (portrait ? 10.5 : 12.5);
    camState.x += (tx - camState.x) * Math.min(1, dt * 3);
    camState.z += (tz - camState.z) * Math.min(1, dt * 3);
    camState.y += ((portrait ? 9.5 : 10.5) - camState.y) * Math.min(1, dt * 3);
    camera.position.set(camState.x, camState.y, camState.z);
    camera.lookAt(p.x * 0.4, 1.4, p.z * 0.35);
    camState.yaw = Math.PI;
  } else if (lv && lv.chase) {
    // persecución: cámara detrás pero más alta y atrás (la furgo asoma por abajo)
    const tz = p.z - (portrait ? 8.8 : 10.2);
    camState.x += (p.x * 0.55 - camState.x) * Math.min(1, dt * 4);
    camState.z += (tz - camState.z) * Math.min(1, dt * 4);
    camState.y += ((portrait ? 5.0 : 4.7) - camState.y) * Math.min(1, dt * 4);
    camera.position.set(camState.x, camState.y, camState.z);
    camera.lookAt(p.x * 0.5, portrait ? 1.4 : 1.2, p.z + 5.5);
    camState.yaw = 0;
  } else {
    // raíl: detrás y arriba, yaw fijo
    const behind = portrait ? 6.2 : 7.2, up = portrait ? 4.6 : 4.15;
    const tx = p.x * 0.72, tz = p.z - behind;
    camState.x += (tx - camState.x) * Math.min(1, dt * 2.6);
    camState.z += (tz - camState.z) * Math.min(1, dt * 2.6);
    camState.y += (up - camState.y) * Math.min(1, dt * 2.4);
    camera.position.set(camState.x, camState.y, camState.z);
    camera.lookAt(p.x * 0.8, portrait ? 1.3 : 1.0, p.z + (portrait ? 4.2 : 3.6));
    camState.yaw = 0;
  }
  if (fx.shake > 0) {
    // sacudida más suave (el usuario se quejaba de que la pantalla se mueve
    // demasiado y no se ve bien): antes 0.32, ahora 0.20
    camera.position.x += (Math.random() - 0.5) * fx.shake * 0.20;
    camera.position.y += (Math.random() - 0.5) * fx.shake * 0.20;
  }
}

function inPuddle() {
  const lv = state.level;
  if (!lv) return false;
  for (const p of lv.puddles) {
    // 0.62 → 0.45: el charco no debe frenar tanto (el agua de la Huerta dejaba
    // al jugador al 39 % de velocidad: queja reportada del nivel que "va lento")
    if (Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < p.r * 0.45 && player.pos.y < 0.4) return true;
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

/* ---------- MECÁNICAS CRASH (v4) en el motor ---------- */

/* PLATAFORMAS QUE SE DESMORONAN: al pisarlas tiemblan, se agrietan más y a
   los ~0,75 s se desploman (dejan de ser sólidas y caen al vacío). */
function updateRuinas(dt) {
  for (const b of world.boxes) {
    if (!b.ruina || b.ruina.caida) continue;
    const r = b.ruina;
    const pisada = player.grounded && player.groundBox === b;
    if (pisada || r.t > 0) {
      r.t += dt;
      // tiembla (cada vez más): el jugador LEE que se va a caer
      const amp = Math.min(0.06, 0.012 + r.t * 0.05);
      b.pos.x = b.base.x + Math.sin(state.t * 45) * amp;
      b.pos.z = b.base.z + Math.cos(state.t * 51) * amp;
      if (b.mesh) { b.mesh.position.x = b.pos.x; b.mesh.position.z = b.pos.z; }
      if (r.t < 0.1) Audio.sfx('crujido');
      // la marca de aviso ya está en el arte; se oscurece la tabla al ceder
      if (b.mesh && r.t > 0.5) b.mesh.scale.setScalar(1 - (r.t - 0.5) * 0.12);
      if (r.t >= 0.75) {
        r.caida = true;
        b.solid = false;
        Audio.sfx('derrumb');
        fx.burst({ x: b.pos.x, y: b.pos.y, z: b.pos.z }, { count: 18, speed: 5, up: 3, life: 0.9, colors: [0x8a6a3f, PALETA.maderaOsc, 0xffffff] });
        fx.addShake(0.22);
        if (b.mesh) {
          // se hunde fuera de la escena (sin colisión)
          b.mesh.userData.cayendo = true;
        }
      }
    }
  }
  // animación de la caída (los que ya cedieron)
  for (const b of world.boxes) {
    if (!b.ruina || !b.ruina.caida || !b.mesh || !b.mesh.userData.cayendo) continue;
    b.mesh.position.y -= dt * 9;
    b.mesh.rotation.z += dt * 1.6;
    if (b.mesh.position.y < -14) { b.mesh.visible = false; b.mesh.userData.cayendo = false; }
  }
}

/* CAJAS DE CONTORNO: no son sólidas hasta que una caja '!' cercana las
   materializa (mecánica crash: la caja fantasma). Se materializan también
   todas a la vez si el jugador pulsa cualquier interruptor del nivel. */
function materializarContornos(zona) {
  let n = 0;
  for (const c of crates.items) {
    if (c.crateType !== 'outline' || c.materializada) continue;
    if (zona != null && Math.abs(c.mesh.position.z - zona) > 26) continue;
    c.materializada = true;
    c.worldBox && (c.worldBox.solid = true);
    if (c.mesh) {
      c.mesh.userData.ghostMat.opacity = 0.95;
      c.mesh.scale.setScalar(1.25);
      c.mesh.userData.hitT = 0.3;
      for (const h of c.mesh.children) if (h.material && h.material.color && h.material !== c.mesh.userData.ghostMat) h.material.opacity = 1;
    }
    // chispas doradas: ¡la caja aparece!
    fx.burst({ x: c.mesh.position.x, y: c.mesh.position.y, z: c.mesh.position.z }, { count: 14, speed: 4, up: 4, life: 0.7, colors: [0xffe9a8, PALETA.dorado, 0xffffff] });
    n++;
  }
  if (n) Audio.sfx('materializa');
  return n;
}
function updateContornos() {
  for (const c of crates.items) {
    if (c.crateType !== 'outline' || !c.mesh) continue;
    // respira: se nota que es una caja fantasma esperando su interruptor
    const p = 0.24 + Math.sin(state.t * 3 + c.mesh.position.z) * 0.12;
    if (c.mesh.userData.ghostMat) c.mesh.userData.ghostMat.opacity = c.materializada ? 0.95 : p;
  }
}

/* CAJA FLECHA bajo los pies: chequeo CILÍNDRICO (no la esfera de
   crates.nearest: al caer en vertical la caja queda por DEBAJO del jugador y
   el hipotenuso 3D se la comía). Devuelve la más cercana en horizontal. */
function cajaFlecha() {
  let best = null, bd = 1.05;
  for (const c of crates.items) {
    if (c.crateType !== 'arrow' || c.dead || c.disabled || !c.mesh || !c.mesh.visible) continue;
    if (c.mesh.position.y > player.pos.y + 0.2) continue;          // por debajo de los pies
    if (c.mesh.position.y < player.pos.y - 1.6) continue;          // demasiado abajo
    const d = Math.hypot(c.mesh.position.x - player.pos.x, c.mesh.position.z - player.pos.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
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
  if (state.invicto) return;             // jefe derrotado: ya no te pueden matar
  // máscara dorada: invulnerable 1 min
  if (maskCompanion.invulnerable) return;
  // la máscara compañera absorbe el golpe (tipo Aku Aku)
  if (maskCompanion.nivel > 0) {
    if (maskCompanion.hit()) {
      hud.toast('🚬 ¡El puro aguantó el golpe!', 'good');
      Audio.sfx('maskBreak');
      fx.burst({ x: player.pos.x, y: player.pos.y + 1.4, z: player.pos.z }, { count: 16, speed: 5, up: 5, life: 0.8, colors: [PALETA.madera, PALETA.rojo, 0xffbe0b] });
      fx.flash({ x: player.pos.x, y: player.pos.y + 1.3, z: player.pos.z }, { color: PALETA.dorado, size: 2.4, life: 0.3 });
      fx.addShake(0.4);
      player.invulnT = 1.6;
      if (navigator.vibrate) navigator.vibrate(40);
      return;
    }
  }
  const res = player.hurt();
  if (res === 'shield') { hud.toast('🛡️ ¡Escudo aguantó!', 'good'); Audio.sfx('shieldBlock'); fx.flash({ x: player.pos.x, y: player.pos.y + 0.9, z: player.pos.z }, { color: 0x4cc9f0, size: 2.2, life: 0.32 }); fx.ring({ x: player.pos.x, y: player.pos.y, z: player.pos.z }, { color: 0x4cc9f0, r0: 0.3, r1: 2.6, life: 0.45 }); fx.addShake(0.25); return; }
  if (res !== 'hurt') return;
  if (window.__qa) window.__qa.data.damageLog.push({ reason, z: +player.pos.z.toFixed(1), x: +player.pos.x.toFixed(1), y: +player.pos.y.toFixed(1) });
  state.lives--;
  state.vidasPerdidasNivel = (state.vidasPerdidasNivel || 0) + 1;
  logros3d.registrar('dano', { nivel: state.level ? state.level.id : null, reason });
  hud.setLives(state.lives);
  hud.damage();
  Audio.sfx('damage');
  // fogonazo rojo + chispas de daño en la olla (se ve el golpe, no solo se siente)
  fx.burst({ x: player.pos.x, y: player.pos.y + 0.9, z: player.pos.z }, { count: 14, speed: 4.5, up: 4.5, life: 0.7, size: 1, colors: [PALETA.rojo, PALETA.rojoOsc, 0xfff5e1] });
  fx.flash({ x: player.pos.x, y: player.pos.y + 0.9, z: player.pos.z }, { color: PALETA.rojo, size: 2.6, life: 0.3 });
  fx.addShake(0.5);
  state.combo = 1;
  if (navigator.vibrate) navigator.vibrate(60);
  if (state.lives <= 0) perderVidasNivel();
}

/* el jugador pierde las 3 vidas del nivel: transición SUAVE de ~3 s
   (pantalla a negro lento + cartel "SUPER-VIDA") y luego se reanuda.
   El usuario pidió que no fuera tan brusco. Va con el reloj DEL JUEGO
   (state.pending) para que sea determinista y el QA pueda verificarlo. */
function perderVidasNivel() {
  player.dead = true;
  const sv = progreso.superVidas;
  if (sv > 0) {
    progreso.gastarSuperVida();
    hud.toast(`💛 ¡Super-vida! Te quedan ${progreso.superVidas}`, 'bad');
    Audio.sfx('supervida');   // "te salva la reserva": suena a premio, no a derrota
    hud.show(false);
    state.mode = 'cine';
    director.fade(1, 900);
    Audio.duckMusic(true);    // la música se aparta mientras se lee el cartel
    state.pending.push({ after: 0.5, fn: () => cineTitle(true, 'SUPER-VIDA', `Te quedan ${progreso.superVidas} 💛`, 'Aguanta, rumbero') });
    state.pending.push({ after: 1.9, fn: () => cineTitle(false) });
    state.pending.push({ after: 2.6, fn: () => {
      director.fade(0, 800);
      Audio.duckMusic(false);   // vuelve la música a su volumen
      player.dead = false;
      state.lives = VIDAS_NIVEL;
      hud.setLives(state.lives);
      respawnAtCheckpoint();
      state.mode = 'play';
      hud.show(true);
    } });
    return;
  }
  // sin super-vidas → continue
  if (progreso.continues > 0) {
    const cont = progreso.gastarContinue();
    logros3d.registrar('continue');
    hud.toast(`⏩ ¡CONTINUE! Te quedan ${cont}`, 'record');
    Audio.sfx('continue');
    hud.show(false);
    state.mode = 'cine';
    director.fade(1, 1000);
    Audio.duckMusic(true);    // misma pausa sonora que en la super-vida
    state.pending.push({ after: 0.5, fn: () => cineTitle(true, '¡CONTINUE!', `Te quedan ${cont} ⏩`, 'La rumba sigue') });
    state.pending.push({ after: 2.1, fn: () => cineTitle(false) });
    state.pending.push({ after: 2.9, fn: () => {
      director.fade(0, 800);
      Audio.duckMusic(false);
      player.dead = false;
      progreso.addSuperVida(SUPER_VIDAS_INICIAL);   // el continue rellena las super-vidas
      startLevel(state.levelIndex, { keepLives: false });
    } });
    return;
  }
  // sin continues → GAME OVER de verdad: se borra el progreso guardado
  gameOverTotal();
}
function gameOverTotal() {
  progreso.reset();
  state.superVidas = SUPER_VIDAS_INICIAL;
  state.continues = CONTINUES;
  state.pending.push({ after: 0.6, fn: () => {
    Audio.sfx('gameover');
    hud.toast('💀 GAME OVER… ¡a empezar de cero!', 'bad');
    endLevelGameOver();
  } });
}
function endLevelGameOver() {
  if (state.ended) return;
  state.ended = true;
  state.gameOver = true;              // el reintento debe empezar en el mundo 1
  Audio.stopGenerative();
  hud.show(false);
  state.mode = 'over';
  hideOverlays();
  $('overTitle') && ($('overTitle').textContent = '¡GAME OVER!');
  $('overBest').textContent = '—';
  $('overNotes').textContent = `${pickups.noteCount + pickups.maskCount * 3}`;
  $('overCrates').textContent = `${crates.broken}/${crates.total}`;
  $('overPanel').classList.remove('hidden');
  // aviso de progreso borrado en el panel
  const av = $('overWarn');
  if (av) av.classList.remove('hidden');
  const avc = $('overCont');
  if (avc) avc.classList.add('hidden');
}

function useCheckpoint(z) {
  state.checkpoint = { x: 0, y: 0.1, z: z - 3 };
  // los checkpoints dan una super-vida (+1 de reserva): sin esto el jugador no
  // podía recuperarse nunca y llegaba a los jefes con 1 vida (queja del usuario)
  const sv = progreso.addSuperVida(1);
  logros3d.registrar('superVida');
  hud.toast(`✔ Punto de control · +1 super-vida (${sv} 💛)`, 'good');
  Audio.sfx('heart');
  // destello verde en el punto guardado
  const cp = { x: player.pos.x, y: player.pos.y + 0.6, z: player.pos.z };
  fx.flash(cp, { color: PALETA.verde, size: 2.4, life: 0.4 });
  fx.ring({ x: player.pos.x, y: player.pos.y, z: player.pos.z }, { color: PALETA.verde, r0: 0.35, r1: 3.2, life: 0.6 });
}

function respawnAtCheckpoint() {
  const c = state.checkpoint || state.level.spawn;
  player.reset(c.x, c.y + 0.4, c.z);
  player.vel.y = 6;
  // en la arena del jefe: al morir, el Cacharro vuelve a FASE 1 con toda la vida
  // (petición del usuario: hay que matar las 3 fases sin que te mate)
  if (state.level && state.level.arena) resetJefeFase1();
  hud.toast('¡Vuelta a la carga!', 'bad');
  Audio.sfx('damage');
}

function collectCrateHits() {
  // giro rompiendo cajas y aturdiendo enemigos
  if (player.spinning) {
    const c = crates.nearest(player.pos, player.hitRadius + 0.35, (cr) => !cr.dead && !cr.disabled);
    if (c) crates.hit(c, { fromSpin: true });
  }
  // BARRIDA: ahora sirve — arrasa las cajas a ras de suelo por delante y
  // atropella a los enemigos pequeños que pilla (antes solo frenaba)
  if (player.sliding) {
    const c = crates.nearest(player.pos, 1.15, (cr) => !cr.dead && !cr.disabled && cr.crateType !== 'checkpoint' && cr.mesh.position.y < 0.7);
    if (c) crates.hit(c, { fromStomp: true, power: 2 });
    for (const e of enemies.list) {
      if (!e.alive || (e.kind !== 'patrol' && e.kind !== 'bee')) continue;
      const dx = Math.abs(e.obj.position.x - player.pos.x), dz = Math.abs(e.obj.position.z - player.pos.z);
      if (dx < 0.85 && dz < 0.85 && e.obj.position.y < 1.6) {
        e.alive = false;
        scene.remove(e.obj);
        // bicho pisado: chispas de la bandera + fogonazo corto (remate con juice)
        const ep = { x: e.obj.position.x, y: 0.6, z: e.obj.position.z };
        fx.impact(ep, {
          count: 14, speed: 5.5, up: 4.5, life: 0.75, size: 1,
          colors: [0xc60b1e, 0xffc400, 0xffffff],
          shake: 0.12, flash: 0xffc400, flashSize: 1.6, ring: PALETA.rojo, ringSize: 1.8
        });
        Audio.sfx('crate');
      }
    }
  }
  // pisotón
  if (!player.grounded && player.vel.y < -1.5) {
    const c = crates.nearest(player.pos, 0.95, (cr) => !cr.dead && !cr.disabled && cr.crateType !== 'checkpoint');
    if (c && Math.abs(c.mesh.position.y - (player.pos.y - player.hitHeight * 0.5)) < 0.8) {
      crates.hit(c, { fromStomp: true, power: 2 });
      if (c.crateType === 'arrow') {
        /* CAJA FLECHA: lanzamiento MUY alto (llega a los 5,5 m de las zonas
           secretas) — el sello de Crash para alcanzar lo inalcanzable. */
        player.vel.y = 17.2;
        Audio.sfx('arrow');
        hud.toast('▲ ¡MUELLE! Al aparato de arriba', 'good');
      } else {
        player.vel.y = 7.6; // rebotar como en Crash
        Audio.sfx('bounce');
      }
      // golpe seco al pisar: anillo dorado + chispas + micro-shake
      const sp = { x: c.mesh.position.x, y: c.mesh.position.y + 0.3, z: c.mesh.position.z };
      fx.ring(sp, { color: PALETA.dorado, r0: 0.3, r1: c.crateType === 'arrow' ? 2.6 : 1.9, life: 0.38, y: Math.max(0.06, c.mesh.position.y + 0.5) });
      fx.flash(sp, { color: 0xffe9a8, size: c.crateType === 'arrow' ? 2.4 : 1.8, life: 0.22 });
      fx.burst(sp, { count: c.crateType === 'arrow' ? 14 : 8, speed: 3.4, up: c.crateType === 'arrow' ? 6 : 3.2, life: 0.5, size: 0.9, colors: [PALETA.dorado, PALETA.crema] });
      fx.addShake(c.crateType === 'arrow' ? 0.3 : 0.16);
    }
    /* CAJA FLECHA (segunda pasada, a propósito): si caes justo encima de una,
       el lanzamiento sale SIEMPRE. El chequeo de arriba solo pilla el roce en
       el aire: al aterrizar sobre la caja el resolutor ya te deja grounded y
       este bloque es el que da el rebote (como el pisotón clásico de Crash). */
    const fa = cajaFlecha();
    if (fa && player.vel.y <= 0.5 && Math.abs(player.pos.y - fa.mesh.position.y) < 1.35
        && Math.hypot(fa.mesh.position.x - player.pos.x, fa.mesh.position.z - player.pos.z) < 1.05) {
      crates.hit(fa, { fromStomp: true, power: 2 });
      player.vel.y = 17.2;
      player.grounded = false;
      player.jumps = 1;
      Audio.sfx('arrow');
      hud.toast('▲ ¡MUELLE! Al aparato de arriba', 'good');
      const sp = { x: fa.mesh.position.x, y: fa.mesh.position.y + 0.3, z: fa.mesh.position.z };
      fx.ring(sp, { color: PALETA.dorado, r0: 0.3, r1: 2.6, life: 0.4, y: Math.max(0.06, fa.mesh.position.y + 0.5) });
      fx.flash(sp, { color: 0xffe9a8, size: 2.4, life: 0.24 });
      fx.burst(sp, { count: 14, speed: 3.6, up: 6, life: 0.5, size: 1, colors: [PALETA.dorado, PALETA.crema] });
      fx.addShake(0.3);
    }
  }
}

function crateInteractions() {
  for (const c of crates.items) {
    if (c.dead || c.disabled || !c.mesh || !c.mesh.visible) continue;
    const dx = Math.abs(c.mesh.position.x - player.pos.x);
    const dz = Math.abs(c.mesh.position.z - player.pos.z);
    const dy = Math.abs(c.mesh.position.y - (player.pos.y + 0.5));
    // CHECKPOINT: se activa de forma MUY generosa (petición del usuario: "a veces
    // no me lo hace"): radio amplio 1.9, en cualquier altura razonable y sin
    // exigir caer encima. Es una caja de vida: quedársela nunca debe fallar.
    if (c.crateType === 'checkpoint' && dx < 1.9 && dz < 1.9 && dy < 2.6) {
      crates.checkpoint(c); useCheckpoint(c.mesh.position.z);
      continue;
    }
    if (dx < 0.8 && dz < 0.8 && dy < 1.0) {
      if (c.crateType === 'nitro') { crates.nitro(c); damagePlayer('nitro'); }
      else if (c.crateType === 'tnt' && !c.lit) crates.igniteTnt(c);
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
  // campanilla de racha rumbera: suena al cruzar x3 (y arpegio dorado en x5)
  if (state.combo !== state._comboSfx) {
    const antes = state._comboSfx || 1;
    if (state.combo >= 5 && antes < 5) Audio.sfx('combohi');
    else if (state.combo >= 3 && antes < 3) Audio.sfx('combo');
    state._comboSfx = state.combo;
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
  // OJO: antes bastaba con z > goal.z+1.5 sin mirar la x, así que se podía
  // "ganar" el nivel desde fuera del pasillo (detrás del muro). Ahora hace
  // falta estar cerca de la meta Y dentro del ancho jugable.
  const enAncho = Math.abs(player.pos.x - (lv.goal.x || 0)) < 4.5;
  if (d < 3.6 || (enAncho && player.pos.z > lv.goal.z + 1.5)) { Audio.sfx('goal'); endLevel(true); }
}

/* La salida solo se ve cuando el nivel está "abierto": si hay jefe pendiente o
   vivo, la meta permanece oculta hasta derrotarlo (petición del usuario). */
function metaAbierta() {
  const lv = state.level;
  if (!lv) return true;
  if (state.ferminPending) return false;
  if (state.ferminActive && fermin.alive) return false;
  return true;
}
function actualizarMetaVisible(anunciar = false) {
  const abierta = metaAbierta();
  if (goalMesh) {
    goalMesh.visible = abierta;
    // aviso luminoso para localizarla cuando se abre (solo en la transición)
    if (anunciar && abierta && !goalMesh.userData.avisado) {
      goalMesh.userData.avisado = true;
      hud.toast('🏁 ¡La salida está abierta!', 'good');
      Audio.sfx('unlock');
      Audio.sfx('door');
      // destello dorado al abrirse la puerta (flash grande + anillo + confeti 3D)
      fx.flash({ x: goalMesh.position.x, y: 1.8, z: goalMesh.position.z }, { color: 0xffe9a8, size: 4.2, life: 0.5 });
      fx.ring({ x: goalMesh.position.x, y: 0.04, z: goalMesh.position.z }, { color: PALETA.dorado, r0: 0.5, r1: 4.5, life: 0.75 });
      fx.burst({ x: goalMesh.position.x, y: 1.6, z: goalMesh.position.z }, { count: 20, speed: 3.4, up: 2.4, life: 0.9, size: 1.1, colors: [0xffe9a8, PALETA.dorado, 0xffffff] });
      fx.confettiScene({ x: goalMesh.position.x, y: 1.6, z: goalMesh.position.z }, 20);
    }
  }
}

function updateVan(dt) {
  const lv = state.level;
  if (!lv || !lv.chase || !van) return;
  state.vanGrace = Math.max(0, (state.vanGrace || 0) - dt);
  // LA FURGO TE SIGUE TODO EL NIVEL: más lenta que tú (tope 8.4) y pegada a ti.
  // Antes se quedaba atrás y desaparecía (queja del usuario: "al matarme hay un
  // momento que desapareció"). Ahora se mantiene a ~6 m por detrás: si te alejas
  // acelera para recuperarte, si te acercas no te embiste de golpe.
  const objetivo = Math.max(2.5, player.pos.z - 6);   // 6 m por detrás
  const dObjetivo = objetivo - van.position.z;
  // "más lenta" (tope 7.6 < 8.4 del jugador) pero SIEMPRE te sigue: si se
  // queda atrás de más (12 m), acelera para recuperar y nunca desaparece
  const cap = Math.abs(dObjetivo) > 12 ? 9.6 : 7.6;
  const base = Math.min(cap, lv.van.speed + player.pos.z * 0.004);
  const speed = Math.max(1.2, base + Math.max(-3.2, Math.min(4.2, dObjetivo * 1.05)));
  van.position.z += speed * dt;
  van.userData.wheels.forEach((w) => { w.rotation.x += speed * dt * 1.2; });
  van.position.x += (player.pos.x * 0.62 - van.position.x) * Math.min(1, dt * 1.0);
  // nube de polvo tras la furgo
  if (Math.random() < 0.6) {
    fx.burst({ x: van.position.x + (Math.random() - 0.5) * 1.2, y: 0.25, z: van.position.z - 1.8 },
      { count: 1, color: 0x8b8b8b, speed: 1.4, up: 1.6, life: 0.5, size: 0.9 });
  }
  const dist = player.pos.z - van.position.z;
  // sacudida MUY leve solo si está encima (antes temblaba todo el rato y no se veía bien)
  if (dist < 5) fx.addShake(0.025);
  if (dist < 1.4 && state.vanGrace <= 0) {
    damagePlayer('van');
    // empujón hacia ADELANTE (la furgo te embiste, no te manda al vacío)
    player.vel.z = Math.max(player.vel.z, 9);
    player.vel.y = 5.5;
    van.position.z = player.pos.z - 9.5;
    state.vanGrace = 3.5;
    fx.addShake(0.6);
  }
}

/* ---------- bot de QA: recorre el nivel automáticamente ---------- */
/* El bot piensa en coordenadas de MUNDO (persigue notas, la meta, esquiva);
   el input de player.update va en coordenadas de PANTALLA, así que se hace la
   transformación inversa de la cámara antes de devolverlo. */
function botToScreen(out) {
  const c = Math.cos(camState.yaw), s = Math.sin(camState.yaw);
  const ix = -out.x * c + out.z * s;
  const iz = out.x * s + out.z * c;
  out.x = Math.max(-1, Math.min(1, ix));
  out.z = Math.max(-1, Math.min(1, iz));
  return out;
}
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
  // Atascado contra una plataforma móvil/andamio: soltar el objetivo por
  // delante y saltar INSISTENTEMENTE hacia arriba (los andamios no tienen
  // rampa y la plataforma oscila; quedarse empujando no desencalla nunca).
  // Bug conocido y reproducido: N2 (Ruta al Festi) z≈134 (y 117-120) ~30% de rondas.
  // GUARDA: state.level puede ser null (menú / final del juego / demo) — antes
  // esto lanzaba `Cannot read properties of null (reading 'arena')` en el bucle.
  const enArena = !!(state.level && state.level.arena);
  const atascado = b.stuckT > 1.6 && !enArena;
  if (atascado) {
    out.x = Math.sin(b.t * 3) * 0.5;   // zigzag suave en los saltos
    out.z = 1;
    if (b.jumpCd <= 0) { out.jump = true; out.jumpP = true; b.jumpCd = 0.32; }
  }
  // en la arena del jefe: colocarse, cubrirse tras los pilares y girar para devolver cajones
  if (enArena) {
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
    // ESQUIVA LAS CUCHILLAS (traps): si una barra se acerca a su z, salta su
    // banda o muévete al lado seguro. Sin esto el bot moría siempre en fase 3.
    if (traps.traps.length) {
      for (const t of traps.traps) {
        if (!t.activa) continue;
        const dz = Math.abs(t.z - p.z);
        const dx = Math.abs(t.obj.position.x - p.x);
        // la barra barre en x: si está cerca en z y su x se acerca, salta/desvía
        if (dz < 1.6 && dx < t.len / 2 + 1.4) {
          if (player.grounded && b.jumpCd <= 0) { out.jump = true; out.jumpP = true; b.jumpCd = 0.45; }
          // desvío lateral hacia donde la barra NO está
          out.x = Math.max(-1, Math.min(1, (t.obj.position.x - p.x) > 0 ? -1.2 : 1.2));
        }
      }
    }
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
    const fx2 = fermin.pos.x - p.x, fz2 = fermin.pos.z - p.z;
    const dF = Math.hypot(fx2, fz2);
    out.x = Math.max(-1, Math.min(1, fx2 * 0.5));
    out.z = Math.max(-1, Math.min(1, fz2 * 0.5));
    // ESTRATEGIA: si NO está vulnerable, mantenerse a distancia de seguridad
    // (acercarse sin más = choque lateral = muerte, el bug que veía el usuario).
    if (fermin.vulnerable > 0) {
      // vulnerable: acércate y salta ENCIMA
      if (dF < 2.6 && player.grounded && b.jumpCd <= 0) { out.jump = true; out.jumpP = true; b.jumpCd = 0.6; }
    } else {
      // peligro: mantén 3.5-5 de distancia y gira para parar las ondas
      if (dF < 3.4) { out.x = -out.x; out.z = -out.z; }
      if (b.spinCd <= 0) { out.spinP = true; b.spinCd = 0.6; }
    }
    return botToScreen(out);
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
      // si ya venimos con el salto anti-atasco, no pisar la bandera (era el bug
      // por el que el bot no saltaba al quedarse clavado: el CD recién puesto
      // dejaba jumpP=false y el salto nunca salía)
      if (!atascado) {
        out.jumpP = b.jumpCd <= 0;
        if (out.jumpP) b.jumpCd = 0.34;
      }
    }
    if (b.spinCd <= 0 && (crateAhead || b.stuckT > 0.7)) { out.spinP = true; b.spinCd = 0.55; }
  }
  return botToScreen(out);
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
function tick(dt) {  // tareas diferidas (sin setTimeout: deben correr también en simulación)
  for (let i = state.pending.length - 1; i >= 0; i--) {
    const p = state.pending[i];
    p.after -= dt;
    if (p.after <= 0) { state.pending.splice(i, 1); try { p.fn(); } catch (e) { console.warn(e); } }
  }
  // fps + resolución ADAPTATIVA: si el móvil va justo (<45 fps sostenidos) se
  // baja el pixelRatio para recuperar fluidez (queja: "el mundo 7 me va lento")
  state.frames++; state.fpsT += dt;
  if (state.fpsT >= 0.5) {
    state.fps = Math.round(state.frames / state.fpsT); state.frames = 0; state.fpsT = 0;
    if (!DEMO) {
      const dprMax = Math.min(2, window.devicePixelRatio || 1);
      if (state.fps < 45) state.lowFps = (state.lowFps || 0) + 1; else state.lowFps = 0;
      if (state.lowFps >= 3 && (state.dpr || dprMax) > 0.75) {
        state.dpr = Math.max(0.75, (state.dpr || dprMax) - 0.25);
        renderer.setPixelRatio(state.dpr);
        state.lowFps = 0;
      } else if (state.fps > 58 && state.dpr != null && state.dpr < dprMax) {
        state.recover = (state.recover || 0) + 1;
        if (state.recover >= 6) { state.dpr = Math.min(dprMax, state.dpr + 0.25); renderer.setPixelRatio(state.dpr); state.recover = 0; }
      }
    }
  }

  // MODO DEMO: manda el director de vídeo, sin HUD ni pantallas de fin
  if (DEMO && demoDir && demoDir.activo) {
    demoDir.update(dt);
    hud.show(false);
    if (state.mode === 'play') {
      world.update(dt);
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
    world.update(dt);   // ¡las plataformas móviles deben avanzar ANTES de resolver el actor!
    const inp = botStep(dt) || input.poll();
    const slippery = inPuddle();
    const frictionSave = slippery ? (state.level.resbalon ? 0.75 : 0.55) : 1;
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
    // cuchillas de la arena del jefe: cruzan de lado a lado y hacen daño
    if (state.level && state.level.arena && traps.traps.length) {
    if (traps.update(dt, player)) damagePlayer('trampa');
    }
    updateVan(dt);
    updateCombos(dt);
    updateEspejos();
    updateRuinas(dt);
    updateContornos();
    applyHumo(dt);
    checkFerminAppear();
    checkGoal();
    actualizarMetaVisible(true);
    maskCompanion.update(dt, player, camera);
    // El buff del puro SÍ o SÍ se limpia al expirar: con la asignación antigua
    // (`invT > 0 && (state.invT = invT)`) el último valor positivo se quedaba
    // pegado para siempre y el jugador era inmune al daño durante TODO el nivel
    // (auditoría de vidas: tras el buff de 30 s, 2 daños de prueba no quitaban
    // vida y damagePlayer salía siempre por state.invT). Con el ternario, al
    // acabarse el buff la invulnerabilidad fantasma desaparece.
    state.invT = maskCompanion.invT > 0 ? maskCompanion.invT : 0;
    // BUFF DEL PURO (2 puros): más velocidad y más salto mientras dure (30 s)
    player.speedBoost = maskCompanion.velocidadExtra;
    player.jumpBoost = maskCompanion.saltoExtra;
    fx.update(dt);
    updateCamera(dt);
    fx.ambient(null, dt, camera, state.level);   // partículas ambientales del mundo
    animateAmbientDecor(dt, state.t);            // agua de fuentes, luces de fiesta…
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
    // la máscara dorada mantiene al jugador invulnerable también al contacto
    if (state.invT > 0 && player.invulnT < 0.5) player.invulnT = Math.max(player.invulnT, 0.4);
  } else if (state.mode === 'cine') {
    // cinemática: manda el director (cámara + diálogos)
    director.update(dt, {});
    if (intro.activa) intro.update(dt);
    if (finalScene.activa) finalScene.update(dt);
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
$('btnOverRetry').onclick = () => {
  // tras un GAME OVER el progreso está borrado: se empieza desde el mundo 1
  const desde = state.gameOver ? 0 : state.levelIndex;
  state.gameOver = false;
  $('overWarn') && $('overWarn').classList.add('hidden');
  startLevel(desde);
};
$('btnOverLevels').onclick = () => { $('overWarn') && $('overWarn').classList.add('hidden'); clearLevel(); showMenu(); };
$('btnHelp').onclick = () => { Audio.sfx('ui'); $('helpPanel').classList.remove('hidden'); };
$('btnHelpBack').onclick = () => $('helpPanel').classList.add('hidden');
$('btnIntro').onclick = () => { Audio.sfx('ui'); hideOverlays(); startIntro(() => { showMenu(); Audio.playMenuMusic(); }); };
/* Ver final: solo aparece si ya lo has desbloqueado (ganaste el juego una vez) */
$('btnFinal').onclick = () => {
  Audio.sfx('ui');
  hideOverlays();
  state.mode = 'cine';
  clearLevel();             // sin restos del nivel en el escenario del concierto
  Audio.setConcert(true);   // el "Ver final" también toca la canción real
  state.pending.push({ after: 0.2, fn: () => finalScene.play(() => { Audio.setConcert(false); showMenu(); Audio.playMenuMusic(); }) });
};
$('btnMute').onclick = () => toggleMute();
$('btnMute2').onclick = () => toggleMute();
/* botón de sonido del propio HUD (jugando) y de las pantallas de fin */
const btnHudMute = $('muteBtn');
if (btnHudMute) btnHudMute.onclick = (e) => { e.stopPropagation(); toggleMute(); };
$('btnMute3') && ($('btnMute3').onclick = () => toggleMute());
$('btnMute4') && ($('btnMute4').onclick = () => toggleMute());
pintaBotonesSonido();            // estado inicial del icono (según preferencia guardada)
/* RANKING: se puede VER desde el menú y desde el panel de fin de nivel.
   Solo aparece en él quien se ha PASADO EL JUEGO entero (se guarda solo al final). */
let rankFrom = 'menu';
const abrirRank = () => { Audio.sfx('ui'); showRank(state.mode === 'end' ? 'end' : 'menu'); };
if ($('btnRank')) $('btnRank').onclick = abrirRank;
if ($('btnRankFinal')) $('btnRankFinal').onclick = abrirRank;
/* logros: panel del menú (conseguidos en color, bloqueados en gris con pista) */
$('btnLogros').onclick = () => {
  Audio.sfx('ui');
  logros3d.pintaPanel();
  $('menuPanel').classList.add('hidden');
  $('logrosPanel').classList.remove('hidden');
};
$('btnLogrosBack').onclick = () => {
  Audio.sfx('ui');
  $('logrosPanel').classList.add('hidden');
  $('menuPanel').classList.remove('hidden');
};
$('btnRankBack').onclick = () => {
  $('rankPanel').classList.add('hidden');
  // se vuelve al sitio desde donde se abrió el ranking (menú o fin de nivel)
  if (rankFrom === 'end') $('endPanel').classList.remove('hidden');
  else $('menuPanel').classList.remove('hidden');
};
/* vídeo de presentación */
$('btnVideo').onclick = () => {
  Audio.sfx('ui');
  $('menuPanel').classList.add('hidden');
  $('videoPanel').classList.remove('hidden');
  const v = $('presentacion');
  v.currentTime = 0;
  v.play().catch(() => {});   // si el navegador lo bloquea, se queda en pausa con controles
};
$('btnVideoBack').onclick = () => {
  $('presentacion').pause();
  $('videoPanel').classList.add('hidden');
  $('menuPanel').classList.remove('hidden');
};

/* Suma de los mejores récords locales (notas y tiempo de TODOS los niveles):
   es lo que se sube al ranking cuando alguien se pasa el juego entero.
   Así el ranking premia al que mejor ha jugado la aventura completa. */
function totalRecords() {
  let notas = 0, tiempo = 0;
  for (const k of Object.keys(records)) {
    const r = records[k]; if (!r) continue;
    notas += r.notas || 0; tiempo += r.tiempo || 0;
  }
  return { notas, tiempo };
}

/* Guardar puntuación con el nombre puesto a mano (patrón de los demás juegos) */
function guardarPuntuacion(inputId) {
  const nombre = ($(inputId).value || '').trim().slice(0, 14) || 'Zagal';
  savePrefs({ name: nombre });
  const ps = state.pendingScore;
  // Al ranking SOLO se sube si te has pasado el juego (jefe final derrotado) y
  // con la puntuación TOTAL del juego (suma de tus récords de los 8 niveles).
  if (ps && state.pendingRanking) {
    const tr = totalRecords();
    postScore(ps.id, tr.notas, ps.stars, tr.tiempo, nombre);
  }
  hud.toast(state.pendingRanking ? '¡En el ranking de los que se lo han pasao! 🏆' : '¡Puntuación guardada! 🏆', 'record');
  Audio.sfx('levelup');
  // FINAL DEL JUEGO: si acabas de derrotar al Cacharro, tras guardar el nombre
  // arranca el concierto final con la banda (y luego el mensaje de despedida)
  if (state.esFinal) {
    state.esFinal = false;
    state.pendingRanking = false;      // ya ha subido; no repetir
    savePrefs({ finalVisto: true });   // desbloquea el botón "Ver final" del menú
    hideOverlays();
    state.mode = 'cine';
    // LIMPIEZA: el concierto se monta en su propio escenario; si el nivel 8
    // (arena del jefe) siguiera cargado, sus pilares, vallas y suelo flotarían
    // entre la banda y el público (el usuario lo describía como "cosas raras"
    // en el suelo del final). Se vacía el nivel ANTES de construir el concierto.
    clearLevel();
    state.pending.push({ after: 0.9, fn: () => { Audio.setConcert(true); finalScene.play(() => { Audio.setConcert(false); showMenu(); Audio.playMenuMusic(); }) } });
  }
}
$('btnSaveScore').onclick = () => guardarPuntuacion('playerName');
$('playerName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnSaveScore').click(); });

function toggleMute() {
  const prefs = loadPrefs();
  const m = !prefs.muted;
  Audio.setMuted(m);
  savePrefs({ muted: m });
  pintaBotonesSonido(m);
  hud.toast(m ? '🔇 Sonido apagado' : '🔊 Sonido encendido');
}
/* el estado del sonido se pinta igual en TODOS los estados del juego
   (menú, pausa, fin de nivel, fin de partida y botón del HUD) */
function pintaBotonesSonido(m = !!loadPrefs().muted) {
  const txt = m ? '🔇 Sonido' : '🔊 Sonido';
  ['btnMute', 'btnMute2', 'btnMute3', 'btnMute4'].forEach((id) => { const el = $(id); if (el) el.textContent = txt; });
  if ($('muteBtn')) { $('muteBtn').textContent = m ? '🔇' : '🔊'; $('muteBtn').title = m ? 'Sonido apagado' : 'Sonido encendido'; }
}
/* el volumen general se ajusta en la pausa y se recuerda entre partidas */
const volRange = $('volRange');
if (volRange) {
  const v0 = Math.round((loadPrefs().vol != null ? loadPrefs().vol : Audio.volume) * 100);
  volRange.value = v0;
  $('volLbl').textContent = v0 + '%';
  volRange.addEventListener('input', () => {
    const k = Number(volRange.value) / 100;
    Audio.setVolume(k);
    $('volLbl').textContent = volRange.value + '%';
    savePrefs({ vol: k });
  });
}

function showRank(from = 'menu') {
  rankFrom = from === 'end' ? 'end' : 'menu';
  // RANKING DEL JUEGO COMPLETO: solo aparecen los que se han PASADO EL JUEGO
  // (diff 'final': el POST solo se manda al derrotar al Cacharro). Petición del
  // usuario: "el ranking solo te lo debería poner en la última pantalla, o sea
  // que solo salgan los que se han pasao el juego de verdad".
  $('menuPanel').classList.add('hidden');
  $('endPanel').classList.add('hidden');
  const box = $('rankBody');
  box.innerHTML = '<p class="small">Cargando…</p>';
  $('rankPanel').classList.remove('hidden');
  fetch(`${apiBase()}/top?game=crash3d&diff=final&limit=20`, { cache: 'no-store' }).then((r) => r.json()).then((data) => {
    const rows = (data.scores || data.top || data || []);
    if (!Array.isArray(rows) || !rows.length) {
      box.innerHTML = '<p class="small">Todavía nadie se ha pasao el juego. ¡Sé el primero en callar al Cacharro! 🎸</p>';
      return;
    }
    box.innerHTML = '<ol>' + rows.map((r) => {
      const t = r.time ? `${Math.floor(r.time / 60)}:${String(r.time % 60).padStart(2, '0')}` : '';
      return `<li><b>${escapeHtml(r.name || '?')}</b> — ${r.score ?? 0} notas${t ? ` · ${t}` : ''}</li>`;
    }).join('') + '</ol>';
  }).catch(() => {
    box.innerHTML = '<p class="small">Sin conexión: no se puede cargar el ranking.</p>';
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
  state: () => ({ mode: state.mode, level: state.levelIndex, levelId: state.level && state.level.id, lives: state.lives, pos: { ...player.pos }, notas: pickups.noteCount, cajas: crates.broken, totalCajas: crates.total, fps: state.fps, ended: state.ended, boss: state.bossActive ? { hp: boss.hp, phase: boss.phase, alive: boss.alive } : (state.ferminActive ? { hp: fermin.hp, phase: 1, alive: fermin.alive, fermin: true } : null), ferminPending: !!state.ferminPending }),
  /* progreso, máscara y vidas (para QA) */
  progreso: () => ({ desbloqueados: progreso.desbloqueados, superVidas: progreso.superVidas, continues: progreso.continues }),
  mascara: () => ({ nivel: maskCompanion.nivel, invT: +maskCompanion.invT.toFixed(1), invulnerable: maskCompanion.invulnerable, visible: !!(maskCompanion.obj && maskCompanion.obj.visible) }),
  metaVisible: () => !!(goalMesh && goalMesh.visible),
  /* daña al jefe/boss para QA (probar el final sin jugar 10 minutos) */
  hitBoss: (n = 1) => { if (state.bossActive && boss.alive) boss.hit(n); else if (state.ferminActive && fermin.alive) fermin.hit(n); return true; },
  /* info de ataques del jefe (QA: ondas vs cajas bomba) */
  ataques: () => ({ ondas: enemies.waves.length, bombas: boss.projectiles.filter((p) => p.alive).length, cd: +(boss.cd || 0).toFixed(2), fase: boss.phase }),
  /* cuchillas de la arena (QA) */
  trapsInfo: () => ({ n: traps.traps.length, activas: traps.traps.filter((t) => t.activa).length, fase: traps.fase, pos: traps.traps.filter((t) => t.activa).map((t) => +t.obj.position.x.toFixed(1)) }),
  /* arranca el concierto final directamente (QA); con la canción real de la banda */
  finalPlay: (cb) => { state.mode = 'cine'; hud.show(false); hideOverlays(); clearLevel(); Audio.setConcert(true); finalScene.play(() => { Audio.setConcert(false); if (cb) cb(); }); },
  /* diagnóstico para los agentes de QA: estado interno del motor */
  diag: () => ({
    grounded: player.grounded, vel: { ...player.vel }, facing: player.facing,
    jumps: player.jumps, invuln: +player.invulnT.toFixed(2), aura: player.aura, shield: player.shield,
    slideT: +player.slideT.toFixed(2), spinT: +player.spinT.toFixed(2), grounded: player.grounded,
    cajas: crates.items.filter((c) => !c.dead).length, tnts: crates.tnts.length,
    enemigos: enemies.list.filter((e) => e.alive).length,
    cajas_moviles: world.boxes.filter((b) => b.moving).length,
    solidas: world.boxes.filter((b) => b.solid).length,
    combo: state.combo, deco: ambientDecor.length,
    decoColocadas: decoPlaced, decoDescartadas: decoFails,
    enemigosDetalle: enemies.list.filter((e) => e.alive).map((e) => e.kind),
    enemigosPos: enemies.list.filter((e) => e.alive).map((e) => ({
      k: e.kind, x: +e.obj.position.x.toFixed(1), y: +e.obj.position.y.toFixed(1), z: +e.obj.position.z.toFixed(1)
    })),
    jefes: { boss: boss.alive ? { hp: boss.hp, fase: boss.phase, x: +boss.pos.x.toFixed(1), z: +boss.pos.z.toFixed(1) } : null,
             fermin: fermin.alive ? { hp: fermin.hp, vuln: +fermin.vulnerable.toFixed(1), x: +fermin.pos.x.toFixed(1), z: +fermin.pos.z.toFixed(1) } : null }
  }),
  /* sonidos reproducidos (los nuevos: longjump, hardland, combo, combohi, gate, door, step, slideLoop, clank, goal, shieldBlock, supervida) */
  sonidos: (n = 40) => Audio.log.slice(-n),
  sonidosUsados: () => { const s = new Set(Audio.log); return [...s]; },
  sonidosReset: () => { Audio.log.length = 0; return true; },
  /* MEZCLA (QA): volúmenes reales de los buses y estado de la música/canción */
  audio: () => Audio.debugInfo(),
  /* posiciones de las plataformas móviles (para detectar si están congeladas) */
  moviles: () => world.boxes.filter((b) => b.moving).map((b) => ({ tag: b.tag, pos: { ...b.pos }, moving: b.moving })),
  /* estado de la furgo del nivel 3 (para QA: debe seguir al jugador todo el nivel) */
  van: () => (van ? { x: +van.position.x.toFixed(2), z: +van.position.z.toFixed(1), dist: +(player.pos.z - van.position.z).toFixed(1) } : null),
  /* sonda de colisión: ¿qué sólido hay en ese punto? */
  sonda: (x, y, z) => {
    const b = world.overlap({ minX: x - 0.2, maxX: x + 0.2, minY: y - 0.2, maxY: y + 0.2, minZ: z - 0.2, maxZ: z + 0.2 });
    return b ? { tag: b.tag, pos: { ...b.pos }, half: { ...b.half } } : null;
  },
  /* estado de las TNT encendidas (para QA del contador) */
  tnts: () => crates.tnts.map((t) => {
    const cd = t.mesh && t.mesh.userData.countdown;
    return {
      fuse: +t.fuse.toFixed(2),
      spriteVisible: !!(cd && cd.spr.visible),
      spriteWorldY: cd ? +(t.mesh.position.y + cd.spr.position.y).toFixed(2) : null,
      spriteScale: cd ? +cd.spr.scale.x.toFixed(2) : null,
      canvasPainted: !!(cd && cd.cv.width)
    };
  }),
  start: (i) => startLevel(i),
  /* QA: recorrido del SUELO del nivel por columnas de x (para colocar la
     geometría nueva donde el bot puede pisar y no sobre el vacío) */
  mapa: (x = 0, z0 = 0, z1 = 300, paso = 1) => {
    const out = [];
    for (let z = z0; z <= z1; z += paso) {
      const g = world.groundUnder({ minX: x - 0.35, maxX: x + 0.35, minZ: z - 0.4, maxZ: z + 0.4, minY: -50, maxY: 6.5 });
      out.push(g ? [z, +g.top.toFixed(2), g.box.tag] : [z, null, null]);
    }
    return out;
  },
  /* QA: cajas vivas por tipo (para verificar materialización/rotura) */
  cajasTipo: () => crates.items.map((c) => ({
    t: c.crateType, x: +c.mesh.position.x.toFixed(1), y: +c.mesh.position.y.toFixed(1), z: +c.mesh.position.z.toFixed(1),
    dead: !!c.dead, mat: !!c.materializada
  })),
  /* QA: notas y máscaras (posición y si están cogidas) */
  notasPos: () => pickups.notes.map((n) => ({ x: +n.pos.x.toFixed(1), y: +n.pos.y.toFixed(1), z: +n.pos.z.toFixed(1), cogida: !!n.taken })),
  /* QA: puros del nivel (posiciones, si están cogidos) + estado del buff */
  purosPos: () => pickups.masks.map((p) => ({ x: +p.pos.x.toFixed(1), y: +p.pos.y.toFixed(1), z: +p.pos.z.toFixed(1), cogido: !!p.taken })),
  puroBuff: () => ({ nivel: maskCompanion.nivel, invT: +maskCompanion.invT.toFixed(1), speed: player.speedBoost, jump: player.jumpBoost || 1 }),
  /* QA: piezas de las mecánicas Crash (ruinas y estado de los contornos) */
  mecanicas: () => ({
    ruinas: world.boxes.filter((b) => b.ruina).map((b) => ({ x: +b.pos.x.toFixed(1), z: +b.pos.z.toFixed(1), y: +b.pos.y.toFixed(2), caida: b.ruina.caida, t: +b.ruina.t.toFixed(2), solida: !!b.solid })),
    barriles: enemies.list.filter((e) => e.kind === 'barril').map((e) => ({ x: +e.obj.position.x.toFixed(1), z: +e.obj.position.z.toFixed(1), vz: +e.vz.toFixed(1), alive: e.alive })),
    contornos: crates.items.filter((c) => c.crateType === 'outline').map((c) => ({ z: +c.mesh.position.z.toFixed(1), mat: !!c.materializada, solido: !!(c.worldBox && c.worldBox.solid) })),
    flechas: crates.items.filter((c) => c.crateType === 'arrow').length,
    secretos: world.boxes.filter((b) => b.tag === 'platform' && b.pos.y > 3.0 && b.pos.y < 4.2).map((b) => ({ x: +b.pos.x.toFixed(1), z: +b.pos.z.toFixed(1), y: +b.pos.y.toFixed(2) })),
    notasSeguras: 0
  }),
  /* foto de QA: congela la cámara en un punto para inspeccionar detalle */
  foto: (px, py, pz, lx, ly, lz) => {
    state.mode = '_foto';
    camera.position.set(px, py, pz);
    camera.lookAt(lx, ly, lz);
    renderer.render(scene, camera);
    return true;
  },
  fotoFin: () => { state.mode = 'play'; return true; },
  /* QA: apaga/enciende el atrezzo ambiental para aislar su efecto */
  decoOff: (off = true) => {
    state.decoOff = !!off;
    if (state.level) buildAmbientDecor(state.level);
    return ambientDecor.length;
  },
  /* QA: enciende/apaga las mejoras visuales de los jefes para aislar su efecto */
  jefesVisual: (on = true) => {
    const v = !!on;
    if (boss.tell) { boss.tell.visible = false; boss.tellOff = !v; }
    if (fermin.vulnRing) fermin.vulnRingOff = !v;
    if (fermin.duelRing) fermin.duelRingOff = !v;
    return { bossTell: !boss.tellOff, ferminRing: !fermin.vulnRingOff };
  },
  /* QA: estado de los anillos de legibilidad de los jefes (telegrafía/aviso) */
  anillos: () => ({
    bossTell: !!(boss.tell && boss.tell.visible), bossTellOp: boss.tell ? +boss.tell.material.opacity.toFixed(2) : null,
    ferminVuln: !!(fermin.vulnRing && fermin.vulnRing.visible), ferminPeligro: !!(fermin.duelRing && fermin.duelRing.visible),
    cdBoss: +boss.cd.toFixed(2), vulnFermin: +fermin.vulnerable.toFixed(2)
  }),
  teleport: (x, y, z) => player.reset(x, y, z),
  enableBot: () => { state.bot = { t: 0, jumpCd: 0, spinCd: 0, stuckT: 0, lastZ: null, log: () => {} }; },
  damage: () => damagePlayer('qa'),
  win: () => endLevel(true),
  /* logros del 3D: estado, lista y reinicio (QA) */
  logros: () => logros3d.lista(),
  logrosEstado: () => logros3d.estado(),
  logrosReset: () => { logros3d.reset(); return true; },
  logrosPanel: () => { logros3d.pintaPanel(); return logros3d.tally(); },
  godMode: (on = true) => { state.god = !!on; },
  /* QA de efectos: dispara un burst/flash/ring y devuelve el nº de partículas vivas */
  fxProbe: (n = 1) => {
    const p = { x: player.pos.x, y: player.pos.y + 0.9, z: player.pos.z };
    fx.flash(p, { color: 0xffe9a8, size: 2, life: 0.5 });
    fx.ring({ x: p.x, y: Math.max(0.05, player.pos.y), z: p.z }, { color: 0xffbe0b, r1: 2.4, life: 0.8 });
    fx.burst(p, { count: n, colors: [0xffbe0b, 0xe63946, 0x38b000], speed: 5, up: 5, life: 3.0, size: 1.4 });
    let vivos = 0;
    for (const it of fx.items) if (it.alive) vivos++;
    return { vivos, flash: fx.flashes.filter((f) => f.life > 0).length, rings: fx.rings.filter((r) => r.life > 0).length };
  },
  /* QA: ¿el atrezzo de tipo `tag` está fuera del suelo/pasillo? (x, z de cada pieza) */
  decorPos: () => ambientDecor.slice(-40).map((o) => ({ x: +o.position.x.toFixed(2), z: +o.position.z.toFixed(1), y: +o.position.y.toFixed(2) })),
  alive: () => !player.dead,
  notes: () => pickups.notes.filter((n) => !n.taken).map((n) => ({ x: n.pos.x, y: n.pos.y, z: n.pos.z })),
  /* cajas vivas (tipo y posición): para QA de rotura/combo/interruptor */
  cajas: () => crates.items.filter((c) => !c.dead && !c.disabled).map((c) => ({ t: c.crateType, x: +c.mesh.position.x.toFixed(1), y: +c.mesh.position.y.toFixed(1), z: +c.mesh.position.z.toFixed(1) })),
  /* golpea la caja viva nº i por el camino real del giro (QA) */
  golpearCaja: (i) => {
    const c = crates.items.filter((x) => !x.dead && !x.disabled)[i];
    if (!c) return null;
    crates.hit(c, { fromSpin: true });
    return c.crateType;
  },
  minFps: function () { const s = this.data.fpsSamples.filter((x) => x > 0); return s.length ? Math.min(...s) : null; },
  avgFps: function () { const s = this.data.fpsSamples.filter((x) => x > 0); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null; }
};
window.addEventListener('error', (e) => { if (window.__qa) window.__qa.data.errors.push(String(e.message)); });
window.addEventListener('unhandledrejection', (e) => { if (window.__qa) window.__qa.data.errors.push('promise: ' + String((e.reason && e.reason.message) || e.reason)); });

boot();
requestAnimationFrame((t) => { state.lastTime = t; loop(t); });
