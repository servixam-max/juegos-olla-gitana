/* Los 3 mundos + arena del jefe (Worker 3).
   Convención: el pasillo avanza en +Z. x lateral, y arriba.
   Unidad ≈ 1 m. El jugador mide 1.25 de alto.

   REDISEÑO "saltos que obligan" (petición del usuario): niveles más largos
   (+43/+57 %) y plataformas que SÍ tienen sentido:
     · calzada()  → suelo con agujeros REALES: debajo no hay nada (si no saltas
                    te caes: daño por caída y vuelta al checkpoint). Los huecos
                    anchos llevan plataforma móvil que se monta al paso (va y
                    viene en x, o sube y baja): cruzarlas tiene su ritmo.
     · islas()    → tramos "SOLO BLOQUES": el suelo desaparece y hay que ir
                    saltando 4-6 losas sobre el vacío (separación 2,2 m, altura
                    variable ±0,24 m, desplazadas en x). Caerse es posible.
     · escalera() → ruta ALTA opcional: escalones laterales que suben a notas,
                    caja ? y máscara. Subir es arriesgar; caerse no mata.
   Notas y cajas van ESPACIADAS en grupos (6-10 m de respiro entre grupos) y
   SOLO sobre suelo firme o sobre las losas: así guían el camino seguro.
   La ruta principal (cada losa y cada plataforma móvil) lleva su nota. */
import * as THREE from 'three';
import { Box } from '../engine/physics.js';
import {
  PALETA, makeCrate, makeNote, makeMask, makeSpeaker, makeAmp, makeGuitar, makeMicStand,
  makeBarrel, makeLampPost, makeFloodlight, makePlanter, makePuddle, makeCone, makeVan,
  makeTree, makeStage, toonMat, makeOlla, makeArrowCrate, makeOutlineCrate
} from './art.js';
import { buildLevel4, buildLevel5, buildLevel6, buildLevel7 } from './levels2.js';
import { matSuperficie, claseDeTag } from '../engine/surfaces.js';

/* mundo activo: cada buildLevelN lo fija al empezar; los helpers de geometría
   lo usan para elegir la textura de cada superficie (suelo/muro/plataforma…). */
let MUNDO = 1;

/* bandera de QA: ?nofeat=1 desactiva las features nuevas (lo usa levels2.js) */
const NOFEAT = (typeof location !== 'undefined') && /(\?|&)nofeat=1/.test(location.search);

const R = (seed) => {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
};

/* ---------- helpers de construcción ---------- */
function solid(world, scene, { x, y, z, w, h, d, color = PALETA.asfalto, tag = '', mat = null, moving = null, visible = true, solid: esSolido = true }) {
  const b = world.add(new Box({ x, y: y + h / 2, z, w, h, d, tag, solid: esSolido }));
  if (moving) b.moving = moving;
  if (visible) {
    // textura procedural según el mundo y el tipo de bloque (si hay receta)
    const clase = claseDeTag(tag);
    const matTex = mat && mat.isMaterial ? null : (clase ? matSuperficie(MUNDO, clase) : null);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matTex || toonMat(color));
    m.position.set(x, y + h / 2, z);
    m.receiveShadow = false;
    scene.add(m);
    b.mesh = m;
    if (moving) b.mat = m;
  }
  return b;
}

function floorSeg(world, scene, { x = 0, z, w = 9, d = 10, y = 0, color = PALETA.asfalto, tag = 'floor', moving = null }) {
  return solid(world, scene, { x, y: y - 0.6, z, w, h: 0.6, d, color, tag, moving });
}

function wall(world, scene, { x, z, w = 1, h = 3, d = 10, y = 0, color = 0x5b4b8a }) {
  return solid(world, scene, { x, y, z, w, h, d, color, tag: 'wall' });
}

function buildCrate(world, scene, { x, y = 0, z, type = 'normal' }) {
  const g = type === 'outline' ? makeOutlineCrate() : (type === 'arrow' ? makeArrowCrate() : makeCrate(type));
  g.position.set(x, y + 0.46, z);
  scene.add(g);
  const b = world.add(new Box({ x, y: y + 0.46, z, w: 0.92, h: 0.92, d: 0.92, tag: 'crate', solid: type !== 'outline' }));
  b.mesh = g;
  b.crateType = type;
  b.hp = (type === 'steel' || type === 'iron') ? 2 : 1;
  if (type === 'outline') b.contorno = { materializada: false };
  return b;
}

function buildNote(world, scene, { x, y = 0.8, z }) {
  const g = makeNote();
  g.position.set(x, y, z);
  scene.add(g);
  return { obj: g, pos: { x, y, z }, taken: false };
}

function buildMask(world, scene, { x, y = 1.0, z }) {
  const g = makeMask();
  g.position.set(x, y, z);
  scene.add(g);
  return { obj: g, pos: { x, y, z }, taken: false };
}

function enemy(type, opts) {
  return { type, ...opts };
}

/* Añade un enemigo de nivel SOLO si las features están activas. Sin esta
   definición, las llamadas de los barriles rodantes de abajo lanzaban
   ReferenceError en cuanto barrilSeguro() encontraba un recorrido válido
   (levels.js usaba addEnemy pero solo levels2.js la declaraba). */
const addEnemy = (list, def) => { if (!NOFEAT) list.push(def); };

/* ---------- MECÁNICAS CRASH (v4): secretos, ruinas y barriles ---------- */

/* ¿hay suelo FIRME bajo esta huella? Las notas atraen al bot: colocar una
   pieza (o una pista) sobre un agujero es una trampa que se paga con la vida. */
function haySuelo(world, { x, z, w = 1, d = 1, techoMin = -0.7, techoMax = 2.6, soloFirme = false }) {
  const pts = [];
  for (const dx of [-w / 2, 0, w / 2]) for (const dz of [-d / 2, 0, d / 2]) pts.push([dx, dz]);
  for (const [dx, dz] of pts) {
    const g = world.groundUnder({
      minX: x + dx - 0.3, maxX: x + dx + 0.3, minZ: z + dz - 0.3, maxZ: z + dz + 0.3, minY: -50, maxY: 14
    });
    if (!g || g.top > techoMax || g.top < techoMin) return false;
    /* soloFirme: la pieza nueva (cornisa/ruina/secreto) solo se monta sobre la
       CALZADA del nivel (tag 'floor'), nunca sobre las losas del tramo "solo
       bloques": ahí una cornisa al borde invita al jugador (y al bot) a
       saltar al vacío desde una plataforma estrecha. */
    if (soloFirme && g.box.tag !== 'floor') return false;
  }
  return true;
}
/* ¿hay una franja ANCHA de calzada? (huella + laterales de escape) */
function franjaFirme(world, { x, z, w = 3.0, d = 3.2, ancho = 2.4 }) {
  for (const dz of [-d / 2, 0, d / 2]) {
    for (const xc of [x - ancho, x, x + ancho]) {
      if (!haySuelo(world, { x: xc, z: z + dz, w: 0.7, d: 0.7, soloFirme: true })) return false;
    }
  }
  return true;
}
/* Busca un z cercano al pedido donde la huella tenga suelo firme. */
function zConSuelo(world, { x, z, w, d, desde = -8, hasta = 12, soloFirme = false }) {
  const max = Math.max(Math.abs(desde), Math.abs(hasta));
  for (let k = 0; k <= max; k++) {
    for (const s of (k === 0 ? [0] : [k, -k])) {
      const zz = z + s;
      if (zz < z + desde || zz > z + hasta) continue;
      if (soloFirme ? franjaFirme(world, { x, z: zz, w, d }) : haySuelo(world, { x, z: zz, w, d })) return zz;
    }
  }
  return null;
}
/* Nota de PISTA solo si el suelo bajo ella es firme (si no, el bot la
   perseguiría hasta el vacío). */
function notaSegura(notes, world, scene, { x, y = 0.95, z }) {
  if (!haySuelo(world, { x, z, w: 0.8, d: 0.8, techoMax: 8 })) return false;
  notes.push(buildNote(world, scene, { x, y, z }));
  return true;
}

/* BARRIL RODANTE con recorrido SEGURO: el barril baja rodando `largo` metros
   desde su base. Se coloca SOLO si todo el recorrido tiene suelo firme a los
   lados: si el tramo es de bloques sobre el vacío, un barril que empuja al
   jugador a un lado lo tira al agujero (livelock del bot: caía y volvía al
   checkpoint en bucle). Devuelve {x, z, speed, span} o null. */
function barrilSeguro(world, { x = 0, z, speed = 7, largo = 22, desde = -14, hasta = 16 }) {
  const max = Math.max(Math.abs(desde), Math.abs(hasta));
  for (let k = 0; k <= max; k++) {
    for (const s of (k === 0 ? [0] : [k, -k])) {
      const zz = z + s;
      if (zz < z + desde || zz > z + hasta) continue;
      // el recorrido [zz - largo, zz] debe ser firme en x y en los laterales de escape
      let ok = true;
      for (let zc = zz - largo; zc <= zz && ok; zc += 1) {
        for (const xc of [x, x - 1.6, x + 1.6]) {
          if (!haySuelo(world, { x: xc, z: zc, w: 0.7, d: 0.7 })) { ok = false; break; }
        }
      }
      if (ok) return { x, z: zz, speed, largo };
    }
  }
  return null;
}

/* Caja que SE DESMORONA al pisarla: tiembla ~0,75 s, se agrieta más y se
   desploma (deja de ser sólida). El sistema la revuelve en main.js. */
function ruina(world, scene, { x = 0, z, w = 3.0, d = 3.0, y = 0, color = 0x8a6a3f }) {
  const zz = zConSuelo(world, { x, z, w, d, desde: -10, hasta: 14, soloFirme: true });
  if (zz == null) return null;
  /* Y el suelo firme debe CONTINUAR 3 m por delante (y 1,5 por detrás): si el
     tablón acaba justo en el borde de un tramo de saltos, el jugador (y el
     bot) sube, sigue recto y se cae al vacío. */
  for (const dz of [d / 2 + 1, d / 2 + 3, -d / 2 - 1]) {
    for (const xc of [x - w / 2, x, x + w / 2]) {
      if (!haySuelo(world, { x: xc, z: zz + dz, w: 0.7, d: 0.7, soloFirme: true })) return null;
    }
  }
  const b = solid(world, scene, { x, y: y - 0.4, z: zz, w, h: 0.4, d, color, tag: 'ruina' });
  b.ruina = { t: 0, caida: false, baseY: y - 0.4 };
  return b;
}
/* Cornisa de tablas que se desmoronan, con su nota encima (la nota va donde
   la tabla exista de verdad: si no hay suelo, no se pone ninguna de las dos). */
function cornisaRuina(world, scene, notes, { x = 0, z, w = 3.0, d = 3.2, y = 2.2, color = 0x8a6a3f, notaY = null }) {
  const b = ruina(world, scene, { x, z, w, d, y, color });
  if (!b) return null;
  notaSegura(notes, world, scene, { x, y: notaY == null ? y + 1.0 : notaY, z: b.pos.z });
  return b;
}

/* Zona SECRETA: plataforma alta con premio, marcada con una fila de NOTAS
   DORADAS que suben en diagonal (la pista visual que en Crash te dice "por
   aquí hay algo"). Coloca la plataforma y devuelve dónde poner el premio. */
function zonaSecreta(world, scene, {
  x, y, z, w = 4.0, d = 4.4, color = 0xd4c6a6, pistaDesde = null, notasPista = 3, notas = null
}) {
  const zz = zConSuelo(world, { x, z, w, d, desde: -6, hasta: 12, soloFirme: true });
  if (zz == null) return null;
  floorSeg(world, scene, { x, y, z: zz, w, d, color, tag: 'platform' });
  const listaNotas = notas || [];
  // remate: caja de madera alrededor (se lee como "premio", no como suelo suelto)
  const borde = toonMat(PALETA.dorado);
  for (const [bx, bz, bw, bd] of [[-w / 2, 0, 0.16, d], [w / 2, 0, 0.16, d], [0, -d / 2, w, 0.16], [0, d / 2, w, 0.16]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.09, bd), borde);
    m.position.set(x + bx, y + 0.045, zz + bz);
    scene.add(m);
  }
  // pista de notas doradas subiendo hacia la plataforma (solo sobre firme)
  if (pistaDesde) {
    for (let i = 1; i <= notasPista; i++) {
      const t = i / (notasPista + 1);
      notaSegura(listaNotas, world, scene, {
        x: pistaDesde.x + (x - pistaDesde.x) * t,
        y: pistaDesde.y + (y + 0.95 - pistaDesde.y) * t,
        z: pistaDesde.z + (zz - pistaDesde.z) * t
      });
    }
  }
  return { x, y, z: zz, w, d };
}

/* ---------- patrones de plataformas (saltos con riesgo real) ---------- */

/* Calzada: suelo de z0 a z1 con "huecos" recortados DE VERDAD (debajo no hay
   nada: caerse = daño por caída). Los huecos anchos llevan plataforma móvil
   BAJA (y≈0.2) que se monta al paso: se mueve en x (te lleva y te trae) o sube
   y baja (es un ascensor). Devuelve los tramos de suelo FIRME, para colocar
   encima notas, cajas y enemigos sin dejarlos flotando sobre el vacío. */
function calzada(world, scene, { z0, z1, w = 13, color = PALETA.asfalto, saltos = [], rnd = Math.random }) {
  let z = +z0;
  const tramos = [];
  for (const s of saltos) {
    const a = s.z - s.w / 2;
    if (a > z) {
      floorSeg(world, scene, { z: (z + a) / 2, d: a - z, w, color: s.color || color });
      tramos.push([+z, +a]);
    }
    if (s.plataforma) {
      const p = s.plataforma;
      floorSeg(world, scene, {
        x: p.x || 0, z: s.z, d: p.d || (s.w - 0.2), w: p.w || 4.6, y: p.y == null ? 0.2 : p.y,
        color: p.color || PALETA.dorado, tag: 'mover',
        moving: { axis: p.axis || 'y', amp: p.amp == null ? 0.32 : p.amp, speed: p.speed || 1.4, phase: (p.phase || 0) + rnd() * 3 }
      });
    }
    z = s.z + s.w / 2;
  }
  if (z < z1) {
    floorSeg(world, scene, { z: (z + z1) / 2, d: z1 - z, w, color });
    tramos.push([+z, +z1]);
  }
  return { fin: +z1, tramos };
}

/* Islas: tramo "SOLO BLOQUES": el suelo desaparece y queda una cadena de losas
   separadas por agujeros al vacío. Losas de 6,6-8,6 m y saltos de 2,2 m (salto
   normal), 4-6 bloques encadenados. `tops` alterna la altura (0 / 0.24) y `zig`
   las desplaza en x para corregir en el aire. */
function islas(world, scene, { z0, n = 4, d = 7, sep = 2.2, w = 4.6, tops = [0, 0.24], zig = 1.0, color = PALETA.madera, tag = 'platform', salida = null }) {
  const puestas = [];
  let z = +z0;
  let ultSep = Array.isArray(sep) ? +sep[0] : +sep;
  for (let i = 0; i < n; i++) {
    const dd = +(Array.isArray(d) ? d[i % d.length] : d);
    const ss = +(Array.isArray(sep) ? sep[i % sep.length] : sep);
    ultSep = ss;
    const y = tops[i % tops.length];
    const xx = zig ? Math.round(Math.sin(i * 1.25 + 0.5) * zig * 10) / 10 : 0;
    floorSeg(world, scene, { x: xx, z: z + dd / 2, w, d: dd, y, color, tag });
    puestas.push({ x: xx, y, z: z + dd / 2, d: dd, w });
    z += dd;
    if (i < n - 1) z += ss;
  }
  // la separación de salida es SIEMPRE un número (con un array, el "+"
  // concatenaba strings y todas las z del nivel acababan siendo NaN)
  const fin = z + +(salida == null ? ultSep : salida);
  return { fin, losa: puestas };
}

/* Escalera: ruta ALTA opcional pegada al lateral del pasillo (el premio está
   arriba), MONTADA SOBRE EL SUELO FIRME: se puede pasar por debajo sin subir.
   Subir es saltar de escalón en escalón; caerse no mata, solo te deja sin las
   notas de la cima. */
function escalera(world, scene, { x = 3.6, z, w = 3.2, d = 3.2, alturas = [0.7, 1.4, 2.1], color = PALETA.madera }) {
  alturas.forEach((h, i) => {
    floorSeg(world, scene, { x, y: h, z: z + i * d, w, d, color, tag: 'platform' });
  });
  const cima = alturas[alturas.length - 1];
  return { fin: z + alturas.length * d, cima, z, x, w, d };
}

/* Notas en arco repartidas por una lista de tramos de suelo firme (nunca sobre
   el vacío: el bot va a por la nota más cercana y no debe poder suicidarse). */
function notasEnTramos(notes, world, scene, { tramos, paso = 9, fase = 0 }) {
  for (const [a, b] of tramos) {
    for (let z = a + 4; z < b - 2; z += paso) {
      const arc = Math.sin((z + fase) * 0.35) * 2.4;
      notes.push(buildNote(world, scene, { x: arc, y: 0.9 + Math.abs(Math.sin((z + fase) * 0.12)) * 1.5, z }));
    }
  }
}

/* =========================================================
   NIVEL 1 — "El Ensayo Callejero"
   ========================================================= */
export function buildLevel1(world, scene, fx) {
  MUNDO = 1;
  const rnd = R(1337);
  const crates = [], notes = [], masks = [], checkpoints = [], puddles = [], enemies = [], lamps = [], switches = [], deco = [];
  const tramosFirmes = [];   // para colocar charcos, enemigos y máscaras

  /* Reparto del pasillo (avanza en +Z):
     A  0-66     calle de entrada: 4 baches (uno con vagoneta que va y viene)
     B  66-103,6 SOLO BLOQUES 1 · "tarima rota": 4 losas sobre el vacío
     C  103,6-137,6  calle de los cajones: hueco con plataforma-ascensor
     D  137,6-185,6  plaza del ensayo: 2 huecos + ruta ALTA de premio (escalera)
     E  185,6-232,2  SOLO BLOQUES 2 · 5 losas sobre el vacío
     F  232,2-240    recta final: interruptor (!) y meta */

  // ---- A: calzada de entrada (baches y una vagoneta) ----
  const A = calzada(world, scene, { z0: 0, z1: 66, rnd, saltos: [
    { z: 20, w: 1.7 },
    { z: 42, w: 1.7 },
    { z: 54, w: 3.4, plataforma: { axis: 'x', w: 4.2, amp: 1.5, speed: 0.8 } },
    { z: 62, w: 1.7 }
  ] });
  tramosFirmes.push(...A.tramos);

  // ---- B: SOLO BLOQUES 1 · cuatro losas sobre el vacío ----
  const B = islas(world, scene, { z0: 66, n: 4, d: [8.6, 6.6, 6.6, 7.0], sep: 1.9, w: 5.4, zig: 0.5, tops: [0, 0.24], color: PALETA.madera });
  B.losa.forEach((l, i) => {
    notes.push(buildNote(world, scene, { x: l.x, y: l.y + 0.95, z: l.z }));
    if (i === 2) crates.push(buildCrate(world, scene, { x: l.x + 1.2, y: l.y, z: l.z, type: 'normal' }));
  });

  // ---- C: calle de los cajones (hueco con plataforma-ascensor) ----
  const C = calzada(world, scene, { z0: B.fin, z1: B.fin + 34, rnd, color: 0x43484e, saltos: [
    { z: B.fin + 14, w: 3.4, plataforma: { y: 0.5, w: 4.2, amp: 0.4, speed: 1.5 } },
    { z: B.fin + 27, w: 1.7 }
  ] });
  tramosFirmes.push(...C.tramos);

  // ---- D: plaza del ensayo + ruta ALTA (escalera sobre el suelo firme) ----
  const D = calzada(world, scene, { z0: C.fin, z1: C.fin + 48, rnd, color: 0x43484e, saltos: [
    { z: C.fin + 17, w: 3.4, plataforma: { y: 0.5, w: 4.2, amp: 0.4, speed: 1.3 } },
    { z: C.fin + 35, w: 1.7 }
  ] });
  tramosFirmes.push(...D.tramos);
  const esc = escalera(world, scene, { x: 3.6, z: C.fin + 3, alturas: [0.7, 1.4, 2.1] });
  notes.push(buildNote(world, scene, { x: esc.x, y: esc.cima + 1.0, z: esc.z + 3.2 }));
  notes.push(buildNote(world, scene, { x: esc.x, y: esc.cima + 1.0, z: esc.z + 6.4 }));
  crates.push(buildCrate(world, scene, { x: esc.x, y: esc.cima, z: esc.z + 6.4, type: 'bounce' }));
  masks.push(buildMask(world, scene, { x: esc.x, y: esc.cima + 1.2, z: esc.z }));

  /* ---- RUTA SECRETA 1: buhardilla del ensayo --------------
     CAJA FLECHA en la esquina de la plaza: al pisarla rebotas muy alto y te
     sube al andamio secreto (notas + caja de rebote). Las notas doradas en
     diagonal son la pista. */
  if (!NOFEAT) crates.push(buildCrate(world, scene, { x: 4.3, y: 0, z: C.fin + 40, type: 'arrow' }));
  if (!NOFEAT) zonaSecreta(world, scene, {
    x: 4.3, y: 3.5, z: C.fin + 44.2, w: 4.4, d: 4.4, color: 0xd4c6a6,
    pistaDesde: { x: 4.3, y: 1.6, z: C.fin + 40 }, notasPista: 3, notas: notes
  });
  if (!NOFEAT) {
    crates.push(buildCrate(world, scene, { x: 4.3, y: 3.5, z: C.fin + 44.2, type: 'bounce' }));
    crates.push(buildCrate(world, scene, { x: 3.2, y: 3.5, z: C.fin + 43.2, type: 'normal' }));
  }

  /* PLATAFORMAS QUE SE DESMORONAN: la cornisa del callejón se cae al pisarla
     (el atajo por arriba es rápido, pero no puedes quedarte parado). */
  if (!NOFEAT) {
    for (const [rx, rz] of [[-3.6, C.fin + 22], [-3.6, C.fin + 25.6], [-3.6, C.fin + 29.2]]) {
      cornisaRuina(world, scene, notes, { x: rx, z: rz, w: 3.0, d: 3.2, y: 2.2, notaY: 3.2 });
    }
    // caja flecha que abre la cornisa
    crates.push(buildCrate(world, scene, { x: -4.2, y: 0, z: C.fin + 19.5, type: 'arrow' }));
  }

  // ---- E: SOLO BLOQUES 2 · cinco losas sobre el vacío ----
  const E = islas(world, scene, { z0: D.fin, n: 5, d: [8.4, 6.6, 6.6, 6.6, 7.4], sep: 1.9, w: 5.4, zig: 0.5, tops: [0, 0.24, 0], color: PALETA.madera });
  E.losa.forEach((l, i) => {
    notes.push(buildNote(world, scene, { x: l.x, y: l.y + 0.95, z: l.z }));
    if (i === 3) crates.push(buildCrate(world, scene, { x: l.x, y: l.y, z: l.z, type: 'steel' }));
  });

  /* BARRILES RODANTES (mecánica Crash): bajan rodando por la calle. Se
     esquivan saltando o apartándose; al chocar estallan. Solo se colocan
     donde TODO el recorrido tiene suelo firme (si no, el barril empuja al
     jugador al vacío). */
  for (const bd of [{ x: -1.6, z: 176, speed: 7.0 }, { x: 2.4, z: 212, speed: 7.6 }, { x: 0.6, z: 236, speed: 6.4 }]) {
    const b = barrilSeguro(world, { ...bd, largo: 20 });
    if (b) addEnemy(enemies, enemy('barril', b));
  }

  // ---- F: recta final (ahora tramo intermedio: 196,7-240) ----
  const F = calzada(world, scene, { z0: E.fin, z1: 240, rnd });
  tramosFirmes.push(...F.tramos);

  /* ---- G2a: SOLO BLOQUES 3 · las losas de la travesía (240-277,4) ----
     Extensión pedida por el usuario: tramo de saltos sobre el vacío con
     separación 2,2 (al límite del salto normal) y zig en x. Es el pico de
     dificultad del nivel; cada losa lleva SU nota (ruta segura) y solo dos
     cajas repartidas, una cada dos losas. */
  const G2a = islas(world, scene, { z0: 240, n: 4, d: [8.4, 6.6, 6.6, 7.0], sep: 1.8, w: 5.4, zig: 0.5, tops: [0, 0.24, 0], color: PALETA.madera });
  G2a.losa.forEach((l, i) => {
    notes.push(buildNote(world, scene, { x: l.x, y: l.y + 0.95, z: l.z }));
    if (i === 0) crates.push(buildCrate(world, scene, { x: l.x + 1.2, y: l.y, z: l.z, type: 'normal' }));
  });

  /* ---- R: valle de respiro (277,4-291,4) ----
     14 m de calzada limpia, sin huecos ni piezas: la pausa entre el pico de
     las losas y el segundo tramo de saltos. Solo notas (guían) y un charco
     suave: el jugador respira y coloca la cámara antes del salto. */
  const R2 = calzada(world, scene, { z0: G2a.fin, z1: G2a.fin + 14, rnd });
  tramosFirmes.push(...R2.tramos);

  /* ---- G2b: SOLO BLOQUES 4 · segunda travesía (291,4-337,8) ---- */
  const G2b = islas(world, scene, { z0: R2.fin, n: 5, d: [8.4, 6.6, 6.6, 6.6, 7.2], sep: 1.8, w: 5.4, zig: 0.5, tops: [0, 0.24], color: PALETA.madera });
  G2b.losa.forEach((l, i) => {
    notes.push(buildNote(world, scene, { x: l.x, y: l.y + 0.95, z: l.z }));
    if (i === 1) crates.push(buildCrate(world, scene, { x: l.x - 1.2, y: l.y, z: l.z, type: 'steel' }));
    if (i === 3) crates.push(buildCrate(world, scene, { x: l.x, y: l.y, z: l.z, type: 'bounce' }));
    if (i === 2) masks.push(buildMask(world, scene, { x: l.x, y: l.y + 1.2, z: l.z }));
  });

  /* ---- H2: recta de cierre con hueco y plataforma móvil (332-348) ----
     Respiro de ~7 m, el hueco con su plataforma que se monta al paso y la
     meta. El checkpoint de H2 va ANTES del hueco (sobre suelo firme). */
  const H2 = calzada(world, scene, { z0: G2b.fin, z1: G2b.fin + 16, rnd, saltos: [
    { z: G2b.fin + 7.2, w: 3.4, plataforma: { axis: 'x', w: 4.2, amp: 1.5, speed: 1.0 } }
  ] });
  tramosFirmes.push(...H2.tramos);
  const L = H2.fin;

  // paredes laterales (callejones)
  for (let zi = 0; zi < L; zi += 12) {
    wall(world, scene, { x: -5.6, z: zi + 6, w: 1.2, h: 5.4, d: 12, color: 0x6d5a9c });
    wall(world, scene, { x: 5.6, z: zi + 6, w: 1.2, h: 5.4, d: 12, color: 0x5b4b8a });
  }
  // techo de pasillo abierto más adelante (sensación de calle)
  // OJO: era `visible:false` y sólido. Al resolver por ejes, un techo invisible
  // cuyo borde inferior cruzas en el aire te expulsaba lateralmente a través del
  // muro del pasillo (bug crítico encontrado por QA: N1 teletransporte a x=-6.6).
  // Solución: el techo NO es sólido (es solo decorativo/ambiental) → sin colisión,
  // sin eyección. La sensación de calle se mantiene igual.
  for (let zi = 24; zi < 96; zi += 16) {
    solid(world, scene, { x: 0, y: 4.6, z: zi, w: 11.2, h: 0.5, d: 16, color: 0x4a3f6b, tag: 'roof', visible: false, solid: false });
  }

  // farolas y decoración
  for (let zi = 8; zi < L - 10; zi += 16) {
    const l = makeLampPost();
    l.position.set(-4.6, 0, zi);
    scene.add(l); lamps.push(l);
    const p = makePlanter();
    p.position.set(4.7, 0, zi + 6);
    scene.add(p); deco.push(p);
  }

  // charcos resbaladizos (solo sobre suelo firme)
  [[-2.2, 33.6], [1.6, 50], [2.4, 110], [-2.6, 122], [0.8, 156], [2.2, 176], [-1.6, 214], [1.8, 284]]
    .forEach(([x, zz]) => {
      const p = makePuddle(1.25 + rnd() * 0.5);
      p.position.set(x, 0.03, zz);
      scene.add(p);
      puddles.push({ x, z: zz, r: 1.7 });
    });

  /* cajones: racimos ESPACIADOS (16-22 m de respiro entre grupos). En los
     tramos nuevos, los grupos van en los valles firmes (284,4 y 341), nunca
     sobre las losas: las cajas de las losas ya las pone el propio tramo. */
  const clusters = [
    { z: 14, kind: 'line', type: 'normal', n: 4 },
    { z: 32, kind: 'pyramid', type: 'normal' },
    { z: 51, kind: 'line', type: 'bounce', n: 3 },
    { z: 110, kind: 'mix' },
    { z: 124, kind: 'pyramid', type: 'normal' },
    { z: 146, kind: 'tnt' },
    { z: 164, kind: 'line', type: 'steel', n: 3 },
    { z: 178, kind: 'mix' },
    { z: 214, kind: 'line', type: 'normal', n: 3 },
    { z: 280, kind: 'pyramid', type: 'normal' }
  ];
  for (const c of clusters) {
    if (c.kind === 'line') {
      for (let i = 0; i < c.n; i++) crates.push(buildCrate(world, scene, { x: -1.5 + i * 1.0, z: c.z, type: c.type }));
    } else if (c.kind === 'pyramid') {
      for (let i = 0; i < 3; i++) crates.push(buildCrate(world, scene, { x: -1 + i * 1.0, z: c.z, type: c.type }));
      for (let i = 0; i < 2; i++) crates.push(buildCrate(world, scene, { x: -0.5 + i * 1.0, y: 0.96, z: c.z, type: c.type }));
      crates.push(buildCrate(world, scene, { x: 0, y: 1.92, z: c.z, type: c.type }));
    } else if (c.kind === 'tnt') {
      crates.push(buildCrate(world, scene, { x: -2, z: c.z, type: 'tnt' }));
      crates.push(buildCrate(world, scene, { x: 0, z: c.z, type: 'tnt' }));
      crates.push(buildCrate(world, scene, { x: 2, z: c.z, type: 'tnt' }));
      crates.push(buildCrate(world, scene, { x: -1, y: 0.96, z: c.z, type: 'steel' }));
      crates.push(buildCrate(world, scene, { x: 1, y: 0.96, z: c.z, type: 'steel' }));
    } else {
      crates.push(buildCrate(world, scene, { x: -2.2, z: c.z, type: 'normal' }));
      crates.push(buildCrate(world, scene, { x: -1.2, z: c.z, type: 'normal' }));
      crates.push(buildCrate(world, scene, { x: -2.2, y: 0.96, z: c.z, type: 'normal' }));
      crates.push(buildCrate(world, scene, { x: 1.4, z: c.z, type: 'bounce' }));
      crates.push(buildCrate(world, scene, { x: 2.4, z: c.z, type: 'steel' }));
    }
  }

  // notas: grupos de arco SOLO sobre los tramos firmes (nunca sobre el vacío)
  notasEnTramos(notes, world, scene, { tramos: tramosFirmes, paso: 9 });

  // máscaras (una al ras del suelo)
  masks.push(buildMask(world, scene, { x: 0, y: 1.2, z: 46 }));

  // checkpoints (antes de cada tramo de saltos, sobre suelo firme; en los
  // tramos nuevos: 232 antes de las losas de 240, 286 en el valle de respiro
  // y 334,5 antes del último hueco)
  [36, 60, C.fin - 6, D.fin - 6, 232, 286, 334.5].forEach((cz) => {
    crates.push(buildCrate(world, scene, { x: 0, z: cz, type: 'checkpoint' }));
    checkpoints.push({ z: cz });
  });

  // interruptor (!) que abre el muro final y suelta notas
  crates.push(buildCrate(world, scene, { x: 0, y: 0, z: 344.5, type: 'switch' }));
  switches.push({ z: 344.5, doorZ: 347 });

  // enemigos: amplis patrulleros (nunca dentro de los tramos de losas)
  enemies.push(enemy('patrol', { x: -2.4, z: 26, span: 8, speed: 3.1, axis: 'x' }));
  enemies.push(enemy('patrol', { x: 2.2, z: 46, span: 7, speed: 3.6, axis: 'x' }));
  enemies.push(enemy('patrol', { x: 1.6, z: 112, span: 6, speed: 3.4, axis: 'x' }));
  enemies.push(enemy('patrol', { x: -1.8, z: 126, span: 8, speed: 4.0, axis: 'x' }));
  enemies.push(enemy('patrol', { x: 2.0, z: 156, span: 9, speed: 3.8, axis: 'x' }));
  enemies.push(enemy('patrol', { x: -2.2, z: 176, span: 8, speed: 3.6, axis: 'x' }));
  enemies.push(enemy('turret', { x: 4.6, z: 236, period: 2.4 }));
  /* ENEMIGOS v3 (28 nuevos repartidos por los 8 mundos; ninguno a <8 m de
     otro ni tapando un paso obligatorio). Cada uno con su contrajuego:
       toro     → embiste en recto; esquiva de lado o saltando (y se aturde al
                  chocar: ahí se remata). Carrerilla de 12 m sobre calzada.
       blindado → acorazado: el pisotón rebota, solo lo rompe el GIRO.
       globo    → planea y suelta gotas frías; el aro rojo marca dónde caen.
       bee      → la de siempre, ahora con picado avisado. */
  enemies.push(enemy('toro', { x: -3, z: 36, axis: 'x', span: 3, speed: 3.0, rango: 10 }));
  enemies.push(enemy('globo', { x: -3, z: 62, height: 2.8, period: 3.8, span: 2.6 }));
  enemies.push(enemy('bee', { x: 0, z: 140, span: 3.4, speed: 2.0, height: 2.6 }));
  enemies.push(enemy('blindado', { x: 3, z: 166, axis: 'x', span: 4, speed: 2.6 }));
  enemies.push(enemy('patrol', { x: -2.6, z: 210, span: 6, speed: 3.4, axis: 'x' }));

  // meta
  const goal = { z: 345.5, x: 0 };

  return {
    id: 1, nombre: 'El Ensayo Callejero',
    tip: 'Salta los baches y busca las cajas flecha ▲: suben a la cornisa y al andamio secreto.',
    length: L, spawn: { x: 0, y: 0.1, z: 2 }, goal, crates, notes, masks, checkpoints, puddles, enemies, switches, lamps, deco,
    chase: false, arena: false, bg: 1, colorTecho: 0x2a1b40,
    lampIntensity: 1.0
  };
}

/* =========================================================
   NIVEL 2 — "Ruta al Festi" (andamios + tablones sobre el vacío)
   ========================================================= */
export function buildLevel2(world, scene, fx) {
  MUNDO = 2;
  const rnd = R(2451);
  const crates = [], notes = [], masks = [], checkpoints = [], puddles = [], enemies = [], lamps = [], switches = [], deco = [];
  const tramosFirmes = [];

  /* Reparto:
     A  0-40      entrada del recinto: 2 baches (uno con vagoneta)
     B  40-96     andamios verticales (subir por las ramas: notas arriba)
     C  96-142,4  SOLO BLOQUES 1 · cinco tablones sobre el vacío
     D  142,4-174,4  tránsito: vagoneta en x + hueco
     E  174,4-188,4  ruta ALTA (escalera lateral con la máscara arriba)
     F  188,4-243,4  SOLO BLOQUES 2 · seis tablones sobre el vacío
     G  243,4-252    recta final: torreta, interruptor (!) y meta */

  // ---- A: entrada con baches ----
  const A = calzada(world, scene, { z0: 0, z1: 40, rnd, color: 0x4b4550, saltos: [
    { z: 18, w: 1.7 },
    { z: 30, w: 3.4, plataforma: { axis: 'x', w: 4.2, amp: 1.5, speed: 0.85 } }
  ] });
  tramosFirmes.push(...A.tramos);

  // ---- B: 40-96 andamios verticales SOBRE SUELO FIRME ----
  const B = calzada(world, scene, { z0: 40, z1: 96, rnd, color: 0x4b4550 });
  tramosFirmes.push(...B.tramos);
  const scaffolds = [
    { z: 46, h: [2.7, 3.9], side: -1 },
    { z: 58, h: [2.9, 4.1, 5.3], side: 1 },
    { z: 72, h: [3.2, 4.4], side: -1 },
    { z: 86, h: [2.8, 4.0, 5.2], side: 1 }
  ];
  for (const s of scaffolds) {
    s.h.forEach((h, i) => {
      const x = s.side * (2.6 + i * 0.5);
      floorSeg(world, scene, { x, y: h, z: s.z, w: 3.2, d: 3.4, color: PALETA.madera, tag: 'platform' });
      // barrotes
      solid(world, scene, { x: x + s.side * 2.0, y: h, z: s.z, w: 0.14, h: 1.1, d: 3.4, color: 0x8a5a2b, tag: 'rail' });
      // notas SOLO en la plataforma más alta: el premio está arriba, pero el
      // bot no se queda atascado intentando subir a las intermedias
      if (i === s.h.length - 1) notes.push(buildNote(world, scene, { x, y: h + 0.9, z: s.z }));
    });
    // poste del andamio (retirado a x=±3.4: en ±2.2 bloqueaba el paso del jugador)
    solid(world, scene, { x: s.side * 3.4, y: 0, z: s.z, w: 0.18, h: 5.6, d: 0.18, color: 0x6f6f7a, tag: 'pole' });
  }

  // ---- C: SOLO BLOQUES 1 · cinco tablones sobre el vacío ----
  const C = islas(world, scene, { z0: 96, n: 5, d: [8.6, 6.6, 6.6, 6.6, 7.2], sep: 1.9, w: 5.4, zig: 0.5, tops: [0, 0.24, 0], color: PALETA.madera });
  C.losa.forEach((l, i) => {
    notes.push(buildNote(world, scene, { x: l.x, y: l.y + 0.95, z: l.z }));
    if (i % 2 === 1) crates.push(buildCrate(world, scene, { x: l.x - 1.2, y: l.y, z: l.z, type: 'normal' }));
  });

  // ---- D: tránsito con vagoneta ----
  const D = calzada(world, scene, { z0: C.fin, z1: C.fin + 32, rnd, color: 0x4b4550, saltos: [
    { z: C.fin + 13, w: 3.4, plataforma: { axis: 'x', w: 4.2, amp: 1.6, speed: 0.95 } },
    { z: C.fin + 24, w: 1.7 }
  ] });
  tramosFirmes.push(...D.tramos);

  // ---- E: ruta ALTA (escalera lateral: la máscara está arriba) ----
  const E = calzada(world, scene, { z0: D.fin, z1: D.fin + 18, rnd, color: 0x4b4550 });
  tramosFirmes.push(...E.tramos);
  const esc = escalera(world, scene, { x: -3.6, z: D.fin + 1.5, alturas: [0.8, 1.6, 2.4] });
  notes.push(buildNote(world, scene, { x: esc.x, y: esc.cima + 1.0, z: esc.z }));
  notes.push(buildNote(world, scene, { x: esc.x, y: esc.cima + 1.0, z: esc.z + 3.2 }));
  masks.push(buildMask(world, scene, { x: esc.x, y: esc.cima + 1.3, z: esc.z + 3.2 }));
  crates.push(buildCrate(world, scene, { x: esc.x, y: esc.cima, z: esc.z + 6.4, type: 'bounce' }));

  /* ---- RUTA SECRETA 2: el andamio invisible --------------
     CAJA DE CONTORNO (outline crate): al principio es solo un dibujo, NO se
     puede pisar. La caja '!' de al lado la MATERIALIZA y entonces sí aguanta
     (es el atajo que cruza el foso sin bajar a los tablones). */
  if (!NOFEAT) {
    crates.push(buildCrate(world, scene, { x: 0, y: 0, z: E.fin + 1.2, type: 'switch' }));
    for (const oz of [E.fin + 3.4, E.fin + 6.6, E.fin + 9.8]) {
      const fantasma = buildCrate(world, scene, { x: 0, y: 0.6, z: oz, type: 'outline' });
      crates.push(fantasma);
      notaSegura(notes, world, scene, { x: 0, y: 2.1, z: oz });
    }
    // premio del atajo: una máscara al final del andamio invisible
    masks.push(buildMask(world, scene, { x: 0, y: 2.4, z: E.fin + 12.4 }));
  }

  /* CAJA FLECHA de la recta de tránsito: sube a la viga con las notas. */
  if (!NOFEAT) {
    crates.push(buildCrate(world, scene, { x: -4.2, y: 0, z: D.fin + 12, type: 'arrow' }));
    floorSeg(world, scene, { x: -4.2, y: 3.4, z: D.fin + 16, w: 3.2, d: 3.4, color: 0x6b5b9a, tag: 'platform' });
    notaSegura(notes, world, scene, { x: -4.2, y: 4.4, z: D.fin + 16 });
  }

  /* BARRILES RODANTES por los andamios y la recta final (recorrido firme). */
  for (const bd of [{ x: 2.2, z: 132, speed: 6.6 }, { x: -2.2, z: 222, speed: 7.4 }]) {
    const b = barrilSeguro(world, { ...bd, largo: 18 });
    if (b) addEnemy(enemies, enemy('barril', b));
  }

  // ---- F: SOLO BLOQUES 2 · seis tablones sobre el vacío ----
  const F = islas(world, scene, { z0: E.fin + 4, n: 5, d: [8.4, 6.6, 6.6, 6.6, 7.4], sep: 1.7, w: 5.4, zig: 0.5, tops: [0, 0.24], color: PALETA.madera });
  F.losa.forEach((l, i) => {
    notes.push(buildNote(world, scene, { x: l.x, y: l.y + 0.95, z: l.z }));
    if (i === 1) crates.push(buildCrate(world, scene, { x: l.x + 1.2, y: l.y, z: l.z, type: 'steel' }));
    if (i === 3) crates.push(buildCrate(world, scene, { x: l.x - 1.2, y: l.y, z: l.z, type: 'bounce' }));
  });

  // ---- G: recta intermedia (243,4-252) ----
  const G = calzada(world, scene, { z0: F.fin, z1: 252, rnd, color: 0x4b4550 });
  tramosFirmes.push(...G.tramos);

  /* ---- P1: tránsito con dos huecos (252-282) ----
     Extensión: primero un tramo de paso con plataforma móvil y un bache
     simple (ritmo suave antes del pico). */
  const P1 = calzada(world, scene, { z0: 252, z1: 282, rnd, color: 0x4b4550, saltos: [
    { z: 265, w: 3.4, plataforma: { axis: 'x', w: 4.2, amp: 1.6, speed: 1.0 } },
    { z: 276, w: 1.7 }
  ] });
  tramosFirmes.push(...P1.tramos);

  /* ---- P2: SOLO BLOQUES 3 · cuatro tablones sobre el vacío ---- */
  const P2 = islas(world, scene, { z0: P1.fin, n: 4, d: [8.4, 6.6, 6.6, 7.0], sep: 1.9, w: 5.4, zig: 0.5, tops: [0, 0.24, 0], color: PALETA.madera });
  P2.losa.forEach((l, i) => {
    notes.push(buildNote(world, scene, { x: l.x, y: l.y + 0.95, z: l.z }));
    if (i === 2) crates.push(buildCrate(world, scene, { x: l.x + 1.2, y: l.y, z: l.z, type: 'normal' }));
  });

  /* ---- R2: valle de respiro (10 m limpios, sin huecos) ---- */
  const R2 = calzada(world, scene, { z0: P2.fin, z1: P2.fin + 10, rnd, color: 0x4b4550 });
  tramosFirmes.push(...R2.tramos);

  /* ---- P3: SOLO BLOQUES 4 · los últimos tres tablones ---- */
  const P3 = islas(world, scene, { z0: R2.fin, n: 3, d: [8.4, 6.6, 6.6], sep: 1.9, w: 5.4, zig: 0.5, tops: [0, 0.24], color: PALETA.madera });
  P3.losa.forEach((l, i) => {
    notes.push(buildNote(world, scene, { x: l.x, y: l.y + 0.95, z: l.z }));
    if (i === 1) crates.push(buildCrate(world, scene, { x: l.x - 1.2, y: l.y, z: l.z, type: 'steel' }));
  });

  /* ---- H2: recta final de cierre ---- */
  const H2 = calzada(world, scene, { z0: P3.fin, z1: P3.fin + 12, rnd, color: 0x4b4550 });
  tramosFirmes.push(...H2.tramos);
  const L = H2.fin;

  // focos móviles (giran y apuntan)
  for (const fz of [26, 62, 104, 146, 190, 236, 268, 312, 352]) {
    const f = makeFloodlight({ height: 4.6, swing: 0.35 });
    f.position.set(-4.4, 0, fz);
    scene.add(f); lamps.push(f);
  }
  // truss y altavoces
  for (const sz of [34, 74, 116, 156, 196, 244, 286, 330, 362]) {
    solid(world, scene, { x: 4.6, y: 0, z: sz, w: 1.0, h: 0.8, d: 1.0, color: 0x2b2b2b, tag: 'speakerBase' });
    const sp = makeSpeaker({ big: true });
    sp.position.set(4.6, 0.8, sz);
    scene.add(sp); deco.push(sp);
  }
  for (let zi = 14; zi < L - 10; zi += 20) {
    const g = makeGuitar({ color: [PALETA.rojo, PALETA.azul, PALETA.dorado][zi % 3], scale: 1.4 });
    g.position.set(-4.2, 1.3, zi + 6);
    g.rotation.z = -0.3;
    scene.add(g); deco.push(g);
  }

  // pilas de cajones y TNT (grupos espaciados ~18 m; los nuevos en los
  // valles firmes 252-282 y 328-355, nunca sobre los tablones)
  const clusters = [
    { z: 16, kind: 'pyramid', type: 'normal' },
    { z: 46, kind: 'line', type: 'normal', n: 5 },
    { z: 66, kind: 'bounce' },
    { z: 78, kind: 'pyramid', type: 'normal' },
    { z: 90, kind: 'mix' },
    { z: 150, kind: 'line', type: 'normal', n: 4 },
    { z: 170, kind: 'tnt' },
    { z: 200, kind: 'pyramid', type: 'normal' },
    { z: 248, kind: 'line', type: 'steel', n: 3 },
    { z: 258, kind: 'pyramid', type: 'normal' },
    { z: 332, kind: 'mix' }
  ];
  for (const c of clusters) {
    if (c.kind === 'line') for (let i = 0; i < c.n; i++) crates.push(buildCrate(world, scene, { x: -2 + i, z: c.z, type: c.type }));
    else if (c.kind === 'pyramid') {
      for (let i = 0; i < 3; i++) crates.push(buildCrate(world, scene, { x: -1 + i, z: c.z, type: c.type }));
      for (let i = 0; i < 2; i++) crates.push(buildCrate(world, scene, { x: -0.5 + i, y: 0.96, z: c.z, type: c.type }));
      crates.push(buildCrate(world, scene, { x: 0, y: 1.92, z: c.z, type: c.type }));
    } else if (c.kind === 'bounce') {
      crates.push(buildCrate(world, scene, { x: -1.5, z: c.z, type: 'bounce' }));
      crates.push(buildCrate(world, scene, { x: -0.5, z: c.z, type: 'bounce' }));
      crates.push(buildCrate(world, scene, { x: 0.5, z: c.z, type: 'bounce' }));
      for (let i = 0; i < 4; i++) notes.push(buildNote(world, scene, { x: -1.2 + i * 0.8, y: 4.4 + i * 0.5, z: c.z + 1 }));
    } else if (c.kind === 'tnt') {
      crates.push(buildCrate(world, scene, { x: -1.6, z: c.z, type: 'tnt' }));
      crates.push(buildCrate(world, scene, { x: 0, z: c.z, type: 'tnt' }));
      crates.push(buildCrate(world, scene, { x: 1.6, z: c.z, type: 'tnt' }));
      crates.push(buildCrate(world, scene, { x: -0.8, y: 0.96, z: c.z, type: 'iron' }));
    } else {
      crates.push(buildCrate(world, scene, { x: -2.4, z: c.z, type: 'normal' }));
      crates.push(buildCrate(world, scene, { x: -1.4, y: 0.96, z: c.z, type: 'normal' }));
      crates.push(buildCrate(world, scene, { x: 1.2, z: c.z, type: 'checkpoint' }));
      crates.push(buildCrate(world, scene, { x: 2.4, z: c.z, type: 'steel' }));
    }
  }

  // notas: grupos de arco SOLO sobre los tramos firmes
  notasEnTramos(notes, world, scene, { tramos: tramosFirmes, paso: 9 });
  masks.push(buildMask(world, scene, { x: -2.6, y: 3.6, z: 66 }));
  masks.push(buildMask(world, scene, { x: 3.0, y: 4.8, z: 148 }));

  [34, 92, 146, 246, 278, 356].forEach((cz) => {
    crates.push(buildCrate(world, scene, { x: 0, z: cz, type: 'checkpoint' }));
    checkpoints.push({ z: cz });
  });

  crates.push(buildCrate(world, scene, { x: 0, z: 361, type: 'switch' }));
  switches.push({ z: 361, doorZ: 364 });

  enemies.push(enemy('patrol', { x: -2.6, z: 22, span: 5, speed: 3.0, axis: 'x' }));
  enemies.push(enemy('patrol', { x: 2.6, z: 52, span: 6, speed: 3.4, axis: 'x' }));
  enemies.push(enemy('patrol', { x: 0, z: 60, span: 6, speed: 3.0, axis: 'z' }));
  enemies.push(enemy('patrol', { x: 2.4, z: 168, span: 5, speed: 3.2, axis: 'x' }));
  enemies.push(enemy('patrol', { x: -2.4, z: 248, span: 4, speed: 3.0, axis: 'x' }));
  /* ENEMIGOS v3 (N2): toro que embiste, globo que suelta gotas, blindado que
     solo muere con el giro y una abeja con picado avisado. */
  enemies.push(enemy('toro', { x: -3, z: 88, axis: 'x', span: 3, speed: 3.0, rango: 10 }));
  enemies.push(enemy('globo', { x: 3, z: 146, height: 2.8, period: 3.8, span: 2.6 }));
  enemies.push(enemy('blindado', { x: 2.5, z: 182, axis: 'x', span: 4, speed: 2.6 }));
  enemies.push(enemy('bee', { x: 0, z: 326, span: 3.4, speed: 2.0, height: 2.6 }));
  enemies.push(enemy('patrol', { x: -2.6, z: 258, span: 5, speed: 3.3, axis: 'x' }));

  return {
    id: 2, nombre: 'Ruta al Festi',
    tip: 'Cajas flecha ▲ para volar alto. La caja ! materializa el andamio invisible: ahí va el atajo.',
    length: L, spawn: { x: 0, y: 0.1, z: 2 }, goal: { z: 364, x: 0 },
    crates, notes, masks, checkpoints, puddles, enemies, switches, lamps, deco,
    chase: false, arena: false, bg: 2, colorTecho: 0x1c0f2e, lampIntensity: 1.25
  };
}

/* =========================================================
   NIVEL 3 — "Furgoneta Desbocada" (persecución)
   ========================================================= */
export function buildLevel3(world, scene, fx) {
  MUNDO = 3;
  const rnd = R(777);
  const crates = [], notes = [], masks = [], checkpoints = [], puddles = [], enemies = [], switches = [], deco = [];
  const tramosFirmes = [];

  /* Reparto (¡corre!):
     A  0-70      carretera con baches y una vagoneta en movimiento
     B  70-107,6  OBRAS 1: la calzada desaparece; 4 pilares para cruzar
     C  107,6-159,6  recta con barriles y dos huecos de obras
     D  159,6-206,2  OBRAS 2: cinco pilares encadenados sobre el vacío
     E  206,2-252,2  recta con amplis rodantes y un hueco con vagoneta
     F  252,2-298,6  OBRAS 3: cinco pilares más (el tramo más exigente)
     G  298,6-304   recta final y meta */

  // ---- A: carretera con huecos reales (OBRAS): caer = daño por caída ----
  const A = calzada(world, scene, { z0: 0, z1: 70, w: 11, color: 0x474c53, rnd, saltos: [
    { z: 22, w: 1.7 },
    { z: 40, w: 3.4, plataforma: { axis: 'x', w: 4.2, amp: 1.5, speed: 0.9 } },
    { z: 58, w: 1.7 }
  ] });
  tramosFirmes.push(...A.tramos);

  // ---- B: OBRAS 1: calzada cortada, pilares para cruzar ----
  const B = islas(world, scene, { z0: 70, n: 4, d: [8.6, 6.6, 6.6, 7.0], sep: 1.9, w: 5.4, zig: 0.5, tops: [0, 0.24], color: 0x6b7280 });
  B.losa.forEach((l, i) => {
    notes.push(buildNote(world, scene, { x: l.x, y: l.y + 0.95, z: l.z }));
    if (i === 2) crates.push(buildCrate(world, scene, { x: l.x + 1.2, y: l.y, z: l.z, type: 'normal' }));
  });

  // ---- C: recta con dos huecos de obras ----
  const C = calzada(world, scene, { z0: B.fin, z1: B.fin + 52, w: 11, color: 0x3c4148, rnd, saltos: [
    { z: B.fin + 14, w: 3.4, plataforma: { axis: 'x', w: 4.2, amp: 1.6, speed: 0.95 } },
    { z: B.fin + 28, w: 1.7 },
    { z: B.fin + 42, w: 3.4, plataforma: { y: 0.5, w: 4.2, amp: 0.4, speed: 1.4 } }
  ] });
  tramosFirmes.push(...C.tramos);

  // ---- D: OBRAS 2: cinco pilares encadenados sobre el vacío ----
  const D = islas(world, scene, { z0: C.fin, n: 5, d: [8.4, 6.6, 6.6, 6.6, 7.4], sep: 1.9, w: 5.4, zig: 0.5, tops: [0, 0.24, 0], color: 0x6b7280 });
  D.losa.forEach((l, i) => {
    notes.push(buildNote(world, scene, { x: l.x, y: l.y + 0.95, z: l.z }));
    if (i === 3) crates.push(buildCrate(world, scene, { x: l.x - 1.2, y: l.y, z: l.z, type: 'steel' }));
  });

  // ---- E: recta con baches ----
  const E = calzada(world, scene, { z0: D.fin, z1: D.fin + 46, w: 11, color: 0x474c53, rnd, saltos: [
    { z: D.fin + 14, w: 1.7 },
    { z: D.fin + 30, w: 3.4, plataforma: { axis: 'x', w: 4.2, amp: 1.5, speed: 1.0 } }
  ] });
  tramosFirmes.push(...E.tramos);

  /* BARRILES RODANTES EN LA CARRETERA: bajan a toda velocidad por el arcén.
     Van alternando carril, así que hay que LEERLOS y apartarse o saltar. */
  for (const bd of [{ x: -1.0, z: D.fin + 40, speed: 9.0 }, { x: 2.2, z: D.fin + 42, speed: 9.6 }]) {
    const b = barrilSeguro(world, { ...bd, largo: 18 });
    if (b) addEnemy(enemies, enemy('barril', b));
  }

  // ---- F: OBRAS 3: cinco pilares más (el tramo más exigente) ----
  const F = islas(world, scene, { z0: E.fin + 4, n: 5, d: [8.4, 6.6, 6.6, 6.6, 7.2], sep: 1.9, w: 5.4, zig: 0.5, tops: [0, 0.24], color: 0x6b7280 });
  F.losa.forEach((l) => {
    notes.push(buildNote(world, scene, { x: l.x, y: l.y + 0.95, z: l.z }));
  });

  // ---- G: recta intermedia (298,4-304) ----
  const G = calzada(world, scene, { z0: F.fin, z1: 304, w: 11, color: 0x3c4148, rnd });
  tramosFirmes.push(...G.tramos);

  /* ---- N3a: segunda tanda de obras (304-336) ----
     Extensión: la carrera sigue con dos cortes más, uno con vagoneta. */
  const N3a = calzada(world, scene, { z0: 304, z1: 336, w: 11, color: 0x474c53, rnd, saltos: [
    { z: 316, w: 3.4, plataforma: { axis: 'x', w: 4.2, amp: 1.6, speed: 1.05 } },
    { z: 328, w: 1.7 }
  ] });
  tramosFirmes.push(...N3a.tramos);

  /* ---- R: valle de respiro (336-346): recta limpia antes del pico ---- */
  const R3 = calzada(world, scene, { z0: 336, z1: 346, w: 11, color: 0x3c4148, rnd });
  tramosFirmes.push(...R3.tramos);

  /* ---- N3b: OBRAS 4 · cinco pilares seguidos (el cierre exigente) ---- */
  const N3b = islas(world, scene, { z0: 346, n: 5, d: [8.4, 6.6, 6.6, 6.6, 7.2], sep: 1.8, w: 5.4, zig: 0.5, tops: [0, 0.24], color: 0x6b7280 });
  N3b.losa.forEach((l, i) => {
    notes.push(buildNote(world, scene, { x: l.x, y: l.y + 0.95, z: l.z }));
    if (i === 1) crates.push(buildCrate(world, scene, { x: l.x - 1.2, y: l.y, z: l.z, type: 'normal' }));
    if (i === 4) crates.push(buildCrate(world, scene, { x: l.x, y: l.y, z: l.z, type: 'steel' }));
  });

  /* ---- H2: recta final de meta ---- */
  const H2 = calzada(world, scene, { z0: N3b.fin, z1: N3b.fin + 12, w: 11, color: 0x3c4148, rnd, saltos: [
    { z: N3b.fin + 6, w: 1.7 }
  ] });
  tramosFirmes.push(...H2.tramos);
  const L = H2.fin;
  // manchas de barro/baches visuales
  for (let i = 0; i < 18; i++) {
    const p = makePuddle(1.0 + rnd() * 0.8);
    p.material.color.set(0x6b5a3e);
    p.position.set(-4 + rnd() * 8, 0.03, 12 + rnd() * (L - 30));
    scene.add(p);
  }

  // arcenes y barandilla
  for (let zi = 0; zi < L; zi += 14) {
    solid(world, scene, { x: -5.9, y: 0, z: zi + 7, w: 0.8, h: 0.5, d: 14, color: 0x6b7280, tag: 'curb' });
    solid(world, scene, { x: 5.9, y: 0, z: zi + 7, w: 0.8, h: 0.5, d: 14, color: 0x6b7280, tag: 'curb' });
  }

  // carteles y conos
  for (const cz of [18, 44, 70, 96, 124, 152, 180, 210, 240, 270, 310, 344, 372]) {
    const c = makeCone();
    c.position.set(-4.4 + rnd() * 1.2, 0, cz);
    scene.add(c); deco.push(c);
  }
  for (const sz of [30, 80, 130, 175, 230, 280, 330, 368]) {
    solid(world, scene, { x: 5.0, y: 0, z: sz, w: 0.4, h: 2.6, d: 0.4, color: 0x9aa5b1, tag: 'sign' });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 0.16), toonMat(sz % 60 === 30 ? PALETA.dorado : PALETA.rojo));
    sign.position.set(5.0, 2.6, sz);
    scene.add(sign); deco.push(sign);
  }

  // obstáculos rodantes (amplificadores que bajan por la carretera)
  enemies.push(enemy('roller', { x: -2.2, z: 64, speed: 7.5 }));
  enemies.push(enemy('roller', { x: 1.8, z: 104, speed: 8.4 }));
  enemies.push(enemy('roller', { x: -1.2, z: 158, speed: 9.0 }));
  enemies.push(enemy('roller', { x: 2.6, z: 208, speed: 9.6 }));
  enemies.push(enemy('roller', { x: -2.0, z: 248, speed: 9.2 }));
  enemies.push(enemy('roller', { x: 1.4, z: 290, speed: 9.8 }));
  /* ENEMIGOS v3 (N3, persecución): bichos sobre la calzada (entre los rollers,
     que van por el centro). El toro embiste de lado, el blindado pasea en la
     acera y el globo suelta gotas donde el aro rojo avisa. */
  enemies.push(enemy('toro', { x: -3, z: 30, axis: 'x', span: 3, speed: 3.0, rango: 10 }));
  enemies.push(enemy('blindado', { x: -3, z: 131, axis: 'x', span: 4, speed: 2.6 }));
  enemies.push(enemy('globo', { x: 3, z: 222, height: 2.9, period: 3.8, span: 2.6 }));
  enemies.push(enemy('bee', { x: 0, z: 335, span: 3.4, speed: 2.0, height: 2.6 }));
  enemies.push(enemy('patrol', { x: 2.5, z: 302, span: 5, speed: 3.4, axis: 'x' }));

  // barriles estáticos
  for (const [bx, bz] of [[-3.2, 26], [3.0, 46], [-2.6, 92], [2.8, 118], [-3.4, 148], [2.2, 188], [-2.8, 216], [3.2, 256], [-3.0, 298]]) {
    const bar = makeBarrel({ color: [PALETA.rojo, PALETA.azul, PALETA.dorado][(bx + bz) % 3] });
    bar.position.set(bx, 0, bz);
    scene.add(bar); deco.push(bar);
    world.add(new Box({ x: bx, y: 0.45, z: bz, w: 0.66, h: 0.9, d: 0.66, tag: 'barrel' })).mesh = bar;
  }

  // cajas: pocas (es una carrera), casi todas TNT/Nitro para esquivar
  crates.push(buildCrate(world, scene, { x: -1.5, z: 34, type: 'normal' }));
  crates.push(buildCrate(world, scene, { x: 1.5, z: 34, type: 'normal' }));
  crates.push(buildCrate(world, scene, { x: 0, z: 108, type: 'checkpoint' }));
  crates.push(buildCrate(world, scene, { x: -2.4, z: 130, type: 'tnt' }));
  crates.push(buildCrate(world, scene, { x: 2.4, z: 130, type: 'tnt' }));
  crates.push(buildCrate(world, scene, { x: 0, z: 172, type: 'bounce' }));
  crates.push(buildCrate(world, scene, { x: 0, z: 212, type: 'normal' }));
  crates.push(buildCrate(world, scene, { x: -2.2, z: 238, type: 'normal' }));
  crates.push(buildCrate(world, scene, { x: 2.2, z: 238, type: 'normal' }));
  crates.push(buildCrate(world, scene, { x: 0, z: 300, type: 'normal' }));
  crates.push(buildCrate(world, scene, { x: -1.5, z: 340, type: 'normal' }));
  crates.push(buildCrate(world, scene, { x: 1.5, z: 340, type: 'normal' }));
  crates.push(buildCrate(world, scene, { x: 0, z: 384, type: 'normal' }));

  // notas: grupos de arco SOLO sobre los tramos firmes (nunca sobre el vacío)
  notasEnTramos(notes, world, scene, { tramos: tramosFirmes, paso: 8 });
  masks.push(buildMask(world, scene, { x: 0, y: 1.4, z: 152 }));
  masks.push(buildMask(world, scene, { x: -2.8, y: 1.2, z: 244 }));
  masks.push(buildMask(world, scene, { x: 2.6, y: 1.2, z: 292 }));
  masks.push(buildMask(world, scene, { x: -2.4, y: 1.2, z: 341 }));

  /* ---- RUTA SECRETA 3: el andamio de las obras --------------
     CAJA FLECHA junto al arcén: rebote alto al andamio con la máscara y las
     notas doradas. Es la recompensa de explorar en mitad de la carrera. */
  if (!NOFEAT) crates.push(buildCrate(world, scene, { x: -4.2, y: 0, z: 186, type: 'arrow' }));
  if (!NOFEAT) zonaSecreta(world, scene, {
    x: -4.2, y: 3.4, z: 190.4, w: 4.0, d: 4.0, color: 0x9aa5b1,
    pistaDesde: { x: -4.2, y: 1.6, z: 186 }, notasPista: 3, notas: notes
  });
  if (!NOFEAT) masks.push(buildMask(world, scene, { x: -4.2, y: 4.4, z: 190.4 }));

  // cajas flecha extra en la recta final (atajo a la cornisa de las obras)
  if (!NOFEAT) {
    crates.push(buildCrate(world, scene, { x: 4.0, y: 0, z: 262, type: 'arrow' }));
    for (const [rx, rz] of [[4.0, 265.6], [4.0, 269.2]]) {
      cornisaRuina(world, scene, notes, { x: rx, z: rz, w: 3.0, d: 3.2, y: 2.4, notaY: 3.4 });
    }
  }

  [66, 144, 240, 308, 340].forEach((cz) => {
    crates.push(buildCrate(world, scene, { x: 0, z: cz, type: 'checkpoint' }));
    checkpoints.push({ z: cz });
  });

  return {
    id: 3, nombre: 'Furgoneta Desbocada',
    tip: '¡Corre hacia la cámara! Esquiva los barriles que ruedan y usa las cajas flecha ▲ para ir por lo alto.',
    length: L, spawn: { x: 0, y: 0.1, z: 4 }, goal: { z: 399, x: 0 },
    crates, notes, masks, checkpoints, puddles, enemies, switches, deco,
    chase: true, arena: false, bg: 3, colorTecho: 0x101a2e, lampIntensity: 0.9,
    van: { startZ: -8, speed: 6.0, accel: 0.12, catchUp: true }
  };
}

/* =========================================================
   ARENA DEL JEFE — "Duelo en el Escenario Principal"
   ========================================================= */
export function buildBossArena(world, scene, fx) {
  MUNDO = 8;
  const crates = [], notes = [], masks = [], checkpoints = [], puddles = [], enemies = [], switches = [], deco = [];

  // plataforma circular (cuadrada con bordes) + escenario
  solid(world, scene, { x: 0, y: -0.6, z: 0, w: 48, h: 0.6, d: 48, color: 0x3a2f4d, tag: 'floor' });
  // vallas alrededor (sólidas para que nadie caiga del ring)
  for (const [x, z, w, d] of [[0, -24, 48, 1.2], [0, 24, 48, 1.2], [-24, 0, 1.2, 48], [24, 0, 1.2, 48]]) {
    solid(world, scene, { x, y: 0, z, w, h: 2.4, d, color: 0x5b4b8a, tag: 'rail' });
  }

  const stage = makeStage({ w: 18, d: 8, h: 1.2 });
  stage.position.set(0, 0, -12);
  scene.add(stage);
  deco.push(stage);

  // pilares para esconderse de las ondas sonoras
  for (const [px, pz] of [[-9, 4], [9, 4], [-9, -4], [9, -4]]) {
    solid(world, scene, { x: px, y: 0, z: pz, w: 2.2, h: 3.4, d: 2.2, color: 0x6b5b9a, tag: 'pillar' });
  }

  // atrezzo de escenario
  const g1 = makeGuitar({ color: PALETA.rojo, scale: 2.0 });
  g1.position.set(-6, 1.3, -14); g1.rotation.z = -0.25; scene.add(g1); deco.push(g1);
  const g2 = makeGuitar({ color: PALETA.azul, scale: 2.0 });
  g2.position.set(6, 1.3, -14); g2.rotation.z = 0.25; scene.add(g2); deco.push(g2);
  const sp1 = makeSpeaker({ big: true }); sp1.position.set(-8, 1.2, -11); sp1.scale.setScalar(1.4); scene.add(sp1);
  const sp2 = makeSpeaker({ big: true }); sp2.position.set(8, 1.2, -11); sp2.scale.setScalar(1.4); scene.add(sp2);

  // notas por el ring
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    notes.push(buildNote(world, scene, { x: Math.cos(a) * 15, y: 0.9, z: Math.sin(a) * 15 + 2 }));
  }

  return {
    id: 8, nombre: 'Duelo en el Escenario',
    tip: 'Devuelve los cajones con el giro cuando te los lance. Esquiva las ondas y escóndete tras los pilares.',
    length: 0, spawn: { x: 0, y: 0.1, z: 14 }, goal: null,
    crates, notes, masks, checkpoints, puddles, enemies, switches, deco,
    chase: false, arena: true, bg: 4, colorTecho: 0x120a24, lampIntensity: 1.4
  };
}

export const LEVELS = [
  { id: 1, build: buildLevel1, nombre: 'El Ensayo Callejero', desc: 'Callejones, charcos y cajones. Ideal para coger el ritmo.', tag: 'FÁCIL' },
  { id: 2, build: buildLevel2, nombre: 'Ruta al Festi', desc: 'Andamios, plataformas móviles y focos. Salta con cabeza.', tag: 'NORMAL' },
  { id: 3, build: buildLevel3, nombre: 'Furgoneta Desbocada', desc: 'Persecución: corre hacia la cámara, la furgo no perdona.', tag: 'DIFÍCIL' },
  { id: 4, build: buildLevel4, nombre: 'La Procesión', desc: 'Plataformas que van y vienen y cirios que caen del cielo.', tag: 'NORMAL' },
  { id: 5, build: buildLevel5, nombre: 'El Entierro de la Sardina', desc: 'Desfile nocturno con humo… y el jefe Fermín Cascabel.', tag: 'JEFE 1' },
  { id: 6, build: buildLevel6, nombre: 'La Huerta Perdida', desc: 'Acequias que frenan, ramas de árbol y abejas pillas.', tag: 'DIFÍCIL' },
  { id: 7, build: buildLevel7, nombre: 'El Casino de Murcia', desc: 'Suelo pulido que resbala, lámparas y espejos que aparecen.', tag: 'MUY DIFÍCIL' },
  { id: 8, build: buildBossArena, nombre: 'Duelo en el Escenario', desc: 'El Cacharro. Tres fases de rumba y ondas.', tag: 'JEFE FINAL' }
];