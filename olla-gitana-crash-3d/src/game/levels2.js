/* MUNDOS 4-7 — Olla Gitana 3D v2
   4 = La Procesión (Semana Santa)  · tranvías procesionales + cirios que caen
   5 = El Entierro de la Sardina    · JEFE Fermín Cascabel + antorchas y humo
   6 = La Huerta Perdida            · agua que frena, saltos entre árboles, abejas
   7 = El Casino de Murcia          · espejos, lámparas oscilantes, suelo pulido

   REDISEÑO "saltos que obligan" (petición del usuario): estos 4 mundos también
   son más largos (+43/+51 %) y tienen tramos donde hay que saltar de verdad:
     · calzada()  → suelo con agujeros REALES (caerse = daño por caída) con
                    plataforma móvil en los anchos.
     · islas()    → tramos "SOLO BLOQUES": 4-6 losas sobre el vacío separadas
                    1,7-2,2 m, alturas alternas y desplazadas en x.
     · escalera() → ruta ALTA opcional montada sobre suelo firme (premio arriba).
   Notas y cajas van ESPACIADAS en grupos (6-10 m de respiro) y SOLO sobre suelo
   firme o sobre las losas: guían el camino seguro. */
import * as THREE from 'three';
import { Box } from '../engine/physics.js';
import {
  PALETA, makeCrate, makeNote, makeMask, makeSpeaker, makeAmp, makeGuitar, makeMicStand,
  makeBarrel, makeLampPost, makeFloodlight, makePlanter, makePuddle, makeCone, makeTree,
  toonMat, makeStage, makeOlla, makeArrowCrate, makeOutlineCrate
} from './art.js';
import { matSuperficie, claseDeTag } from '../engine/surfaces.js';

/* mundo activo (lo fija cada buildLevelN): elige la textura de cada superficie */
let MUNDO2 = 4;

const R = (seed) => {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
};

function solid(world, scene, { x, y, z, w, h, d, color = PALETA.asfalto, tag = '', moving = null, visible = true }) {
  const b = world.add(new Box({ x, y: y + h / 2, z, w, h, d, tag }));
  if (moving) b.moving = moving;
  if (visible) {
    // textura procedural según el mundo y el tipo de bloque (si hay receta)
    const clase = claseDeTag(tag);
    const matTex = clase ? matSuperficie(MUNDO2, clase) : null;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matTex || toonMat(color));
    m.position.set(x, y + h / 2, z);
    scene.add(m);
    b.mesh = m;
    if (moving) b.mat = m;
  }
  return b;
}
function floorSeg(world, scene, { x = 0, z, w = 13, d = 10, y = 0, color = PALETA.asfalto, tag = 'floor', moving = null }) {
  return solid(world, scene, { x, y: y - 0.6, z, w, h: 0.6, d, color, tag, moving });
}
function corridor(world, scene, { z0, z1, halfW = 6.5, h = 5.4, color = 0x5b4b8a, step = 12 }) {
  for (let z = z0; z < z1; z += step) {
    solid(world, scene, { x: -halfW, y: 0, z: z + step / 2, w: 1.2, h, d: step, color, tag: 'wall' });
    solid(world, scene, { x: halfW, y: 0, z: z + step / 2, w: 1.2, h, d: step, color: 0x6d5a9c, tag: 'wall' });
  }
}
function buildCrate(world, scene, { x, y = 0, z, type = 'normal' }) {
  const g = type === 'outline' ? makeOutlineCrate() : (type === 'arrow' ? makeArrowCrate() : makeCrate(type));
  g.position.set(x, y + 0.46, z);
  scene.add(g);
  const b = world.add(new Box({ x, y: y + 0.46, z, w: 0.92, h: 0.92, d: 0.92, tag: 'crate', solid: type !== 'outline' }));
  b.mesh = g; b.crateType = type;
  b.hp = (type === 'steel' || type === 'iron') ? 2 : 1;
  if (type === 'outline') b.contorno = { materializada: false };
  return b;
}
function buildNote(world, scene, { x, y = 0.8, z }) {
  const g = makeNote(); g.position.set(x, y, z); scene.add(g);
  return { obj: g, pos: { x, y, z }, taken: false };
}
function buildMask(world, scene, { x, y = 1.0, z }) {
  const g = makeMask(); g.position.set(x, y, z); scene.add(g);
  return { obj: g, pos: { x, y, z }, taken: false };
}
const enemy = (type, opts) => ({ type, ...opts });

/* QA: `?nofeat=1` desactiva las piezas de la ronda v4 (secretos, ruinas,
   barriles) para poder A/B una regresión sin tocar el código. */
const NOFEAT = (typeof location !== 'undefined') && /(\?|&)nofeat=1/.test(location.search);
const NOBAR = (typeof location !== 'undefined') && /(\?|&)nobar=1/.test(location.search);
const addEnemy = (list, def) => { if (!NOFEAT && !NOBAR) list.push(def); };

/* ---------- MECÁNICAS CRASH (v4): secretos, ruinas y barriles ---------- */

/* ¿hay suelo FIRME bajo esta huella? Las notas atraen al bot: colocar una
   pieza (o una pista) sobre un agujero es una trampa que se paga con la vida.
   Se comprueban las esquinas, el centro y los bordes de la huella. */
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
/* Busca un z cercano al pedido donde la huella tenga suelo firme (para no
   colocar nada flotando sobre el vacío). Devuelve null si no hay ninguno. */
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
   perseguiría hasta el vacío: es como se rompió la suite). */
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

/* Caja que SE DESMORONA al pisarla: tiembla, se agrieta más y se desploma
   (deja de ser sólida). El sistema la resuelve en main.js. */
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

/* Zona SECRETA: plataforma alta con premio, marcada con notas doradas que
   suben hacia ella (la pista visual clásica de Crash). Plataforma y pista se
   colocan SOLO sobre suelo firme: nunca sobre un agujero. */
function zonaSecreta(world, scene, {
  x, y, z, w = 4.0, d = 4.4, color = 0xd4c6a6, pistaDesde = null, notasPista = 3, notas = null
}) {
  const zz = zConSuelo(world, { x, z, w, d, desde: -6, hasta: 12, soloFirme: true });
  if (zz == null) return null;
  floorSeg(world, scene, { x, y, z: zz, w, d, color, tag: 'platform' });
  const listaNotas = notas || [];
  const borde = toonMat(PALETA.dorado);
  for (const [bx, bz, bw, bd] of [[-w / 2, 0, 0.16, d], [w / 2, 0, 0.16, d], [0, -d / 2, w, 0.16], [0, d / 2, w, 0.16]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.09, bd), borde);
    m.position.set(x + bx, y + 0.045, zz + bz);
    scene.add(m);
  }
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

/* Calzada: suelo de z0 a z1 con huecos recortados DE VERDAD (debajo no hay
   nada: caerse = daño por caída). Los huecos anchos llevan plataforma móvil
   baja que se monta al paso. Devuelve los tramos firmes para colocar encima
   notas, cajas y enemigos sin dejarlos flotando sobre el vacío. */
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
   sobre el vacío. `tops` alterna la altura (0 / 0.24) y `zig` las desplaza en x. */
function islas(world, scene, { z0, n = 4, d = 7, sep = 1.7, w = 4.6, tops = [0, 0.24], zig = 0.5, color = PALETA.madera, tag = 'platform', salida = null }) {
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
  // la separación de salida es SIEMPRE un número (con un array el "+" concatenaba
  // strings y todas las z del nivel acababan siendo NaN)
  const fin = z + +(salida == null ? ultSep : salida);
  return { fin, losa: puestas };
}

/* Escalera: ruta ALTA opcional MONTADA SOBRE SUELO FIRME (se puede pasar por
   debajo). Subir es saltar de escalón en escalón; caerse no mata. */
function escalera(world, scene, { x = 3.6, z, w = 3.2, d = 3.2, alturas = [0.7, 1.4, 2.1], color = PALETA.madera }) {
  alturas.forEach((h, i) => {
    floorSeg(world, scene, { x, y: h, z: z + i * d, w, d, color, tag: 'platform' });
  });
  return { fin: z + alturas.length * d, cima: alturas[alturas.length - 1], z, x, w, d };
}

/* Notas en arco repartidas por tramos firmes (nunca sobre el vacío). */
function notasEnTramos(notes, world, scene, { tramos, paso = 9, fase = 0 }) {
  for (const [a, b] of tramos) {
    for (let z = a + 4; z < b - 2; z += paso) {
      const arc = Math.sin((z + fase) * 0.35) * 2.4;
      notes.push(buildNote(world, scene, { x: arc, y: 0.9 + Math.abs(Math.sin((z + fase) * 0.12)) * 1.5, z }));
    }
  }
}

/* =========================================================
   MUNDO 4 — "LA PROCESIÓN" (Semana Santa)
   Tranvías procesionales (plataformas que van y vienen) + cirios que caen.
   ========================================================= */
export function buildLevel4(world, scene, fx) {
  MUNDO2 = 4;
  const rnd = R(4821);
  const crates = [], notes = [], masks = [], checkpoints = [], puddles = [], enemies = [], switches = [], deco = [];
  const tramosFirmes = [];

  /* Reparto:
     A  0-52      carrera del trono: 3 huecos con tranvías procesionales
     B  52-90     procesión: suelo firme con cirios y tronos
     C  90-131,2  SOLO BLOQUES 1 · las andas se han roto: 5 losas sobre el vacío
     D  131,2-176,4  tramo con dos huecos anchos y plataformas que van y vienen
     E  176,4-190,4  ruta ALTA de premio (escalera con la máscara arriba)
     F  190,4-243   SOLO BLOQUES 2 · 6 losas + 2 huecos con tranvía
     G  243-250   recta final: interruptor (!) y meta */

  // ---- A: tranvías procesionales en huecos reales ----
  const A = calzada(world, scene, { z0: 0, z1: 52, rnd, w: 15, color: 0x4a3b5c, saltos: [
    { z: 14, w: 3.4, plataforma: { axis: 'x', w: 4.6, amp: 1.6, speed: 0.85, color: 0x9d0208 } },
    { z: 26, w: 1.7 },
    { z: 38, w: 3.4, plataforma: { axis: 'x', w: 4.6, amp: 1.5, speed: 0.95, color: 0x9d0208 } },
    { z: 47, w: 1.7 }
  ] });
  tramosFirmes.push(...A.tramos);

  // ---- B: procesión (firme, con cirios que caen) ----
  const B = calzada(world, scene, { z0: 52, z1: 90, rnd, w: 15, color: 0x5b4a6e });
  tramosFirmes.push(...B.tramos);
  let ci = 0;
  for (let cz = 56; cz < 88; cz += 9) {
    const lado = (ci % 2 === 0) ? -1 : 1;
    enemies.push(enemy('candle', { x: lado * 4.6, z: cz, period: 2.6 + rnd() * 1.4 }));
    ci++;
  }

  // ---- C: SOLO BLOQUES 1 · cinco losas sobre el vacío ----
  const C = islas(world, scene, { z0: 90, n: 5, d: [8.6, 6.6, 6.6, 6.6, 7.2], sep: 1.7, w: 5.4, zig: 0.5, tops: [0, 0.24, 0], color: 0x8b5a2b });
  C.losa.forEach((l, i) => {
    notes.push(buildNote(world, scene, { x: l.x, y: l.y + 0.95, z: l.z }));
    if (i === 2) crates.push(buildCrate(world, scene, { x: l.x + 1.2, y: l.y, z: l.z, type: 'normal' }));
  });

  // ---- D: dos huecos anchos con plataformas que van y vienen ----
  const D = calzada(world, scene, { z0: C.fin, z1: C.fin + 45, rnd, w: 15, color: 0x4a3b5c, saltos: [
    { z: C.fin + 14, w: 3.4, plataforma: { axis: 'x', w: 4.6, amp: 1.7, speed: 1.0, color: 0x9d0208 } },
    { z: C.fin + 26, w: 1.7 },
    { z: C.fin + 37, w: 3.4, plataforma: { y: 0.25, w: 4.6, amp: 0.55, speed: 1.4, color: 0x9d0208 } }
  ] });
  tramosFirmes.push(...D.tramos);
  for (let cz = D.tramos[0][0] + 4; cz < D.tramos[0][1] - 2; cz += 9) {
    enemies.push(enemy('candle', { x: (ci++ % 2 === 0) ? -4.6 : 4.6, z: cz, period: 2.8 + rnd() * 1.2 }));
  }

  // ---- E: ruta ALTA (escalera: la máscara está en la cima) ----
  const E = calzada(world, scene, { z0: D.fin, z1: D.fin + 14, rnd, w: 15, color: 0x5b4a6e });
  tramosFirmes.push(...E.tramos);
  const esc = escalera(world, scene, { x: 4.0, z: D.fin + 1.5, w: 3.4, d: 3.2, alturas: [0.8, 1.6, 2.4] });
  notes.push(buildNote(world, scene, { x: esc.x, y: esc.cima + 1.0, z: esc.z }));
  notes.push(buildNote(world, scene, { x: esc.x, y: esc.cima + 1.0, z: esc.z + 3.2 }));
  crates.push(buildCrate(world, scene, { x: esc.x, y: esc.cima, z: esc.z + 6.4, type: 'bounce' }));
  masks.push(buildMask(world, scene, { x: esc.x, y: esc.cima + 1.3, z: esc.z + 3.2 }));

  /* ---- RUTA SECRETA 4: el palco de la procesión --------------
     CAJA FLECHA en la acera: rebote muy alto al palco (notas + caja ?) con la
     pista de notas doradas subiendo en diagonal. */
  if (!NOFEAT) crates.push(buildCrate(world, scene, { x: -5.6, y: 0, z: D.fin + 8, type: 'arrow' }));
  if (!NOFEAT) zonaSecreta(world, scene, {
    x: -5.6, y: 3.6, z: D.fin + 12.4, w: 4.4, d: 4.4, color: 0x9d8bb0,
    pistaDesde: { x: -5.6, y: 1.6, z: D.fin + 8 }, notasPista: 3, notas: notes
  });
  if (!NOFEAT) {
    crates.push(buildCrate(world, scene, { x: -5.6, y: 3.6, z: D.fin + 12.4, type: 'bounce' }));

    /* PLATAFORMAS QUE SE DESMORONAN: los balcones de la carrera del trono. */
    crates.push(buildCrate(world, scene, { x: 5.4, y: 0, z: 30, type: 'arrow' }));
    for (const [rx, rz] of [[5.4, 33.6], [5.4, 37.2]]) {
      cornisaRuina(world, scene, notes, { x: rx, z: rz, w: 3.0, d: 3.2, y: 2.3, notaY: 3.3 });
    }
  }

  /* BARRILES RODANTES entre los cirios (esquiva o salta; recorrido firme). */
  for (const bd of [{ x: 1.4, z: D.fin + 22, speed: 7.2 }, { x: -1.8, z: 226, speed: 7.8 }]) {
    const b = barrilSeguro(world, { ...bd, largo: 20 });
    if (b) addEnemy(enemies, enemy('barril', b));
  }

  // ---- F: SOLO BLOQUES 2 · seis losas + dos huecos con tranvía ----
  const F1 = islas(world, scene, { z0: E.fin, n: 6, d: [8.4, 6.6, 6.6, 6.6, 6.6, 7.0], sep: 1.7, w: 5.4, zig: 0.5, tops: [0, 0.24], color: 0x8b5a2b });
  F1.losa.forEach((l, i) => {
    notes.push(buildNote(world, scene, { x: l.x, y: l.y + 0.95, z: l.z }));
    if (i === 1) crates.push(buildCrate(world, scene, { x: l.x + 1.2, y: l.y, z: l.z, type: 'steel' }));
    if (i === 4) crates.push(buildCrate(world, scene, { x: l.x - 1.2, y: l.y, z: l.z, type: 'bounce' }));
  });
  const F2 = calzada(world, scene, { z0: F1.fin, z1: F1.fin + 28, rnd, w: 15, color: 0x4a3b5c, saltos: [
    { z: F1.fin + 13, w: 3.4, plataforma: { axis: 'x', w: 4.6, amp: 1.6, speed: 1.05, color: 0x9d0208 } },
    { z: F1.fin + 23, w: 1.7 }
  ] });
  tramosFirmes.push(...F2.tramos);

  // ---- G: recta final ----
  const G = calzada(world, scene, { z0: F2.fin, z1: 252, rnd, w: 15, color: 0x5b4a6e });
  tramosFirmes.push(...G.tramos);
  const L = 252;
  corridor(world, scene, { z0: 0, z1: L, halfW: 7.6, h: 6.2, color: 0x6b4a7a, step: 14 });

  // atrezzo procesional: tronos (sobre suelo firme)
  for (const tz of [58, 74, 108, 150, 216]) {
    const trono = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 2.4), toonMat(0x8b5a2b));
    base.position.y = 1.2;
    const palio = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.2, 2.6), toonMat(PALETA.rojo));
    palio.position.y = 3.4;
    const cera = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.6, 10), toonMat(0xfff1c0));
    cera.position.y = 2.3;
    trono.add(base, palio, cera);
    trono.position.set(-2 + (tz % 5), 0, tz);
    scene.add(trono); deco.push(trono);
  }
  // velas por las paredes
  for (let i = 0; i < 26; i++) {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.9 + rnd() * 0.6, 8), toonMat(0xfff5e1));
    v.position.set((i % 2 ? 1 : -1) * (6.2 + rnd() * 0.4), 0.45 + rnd() * 0.3, 10 + i * 9);
    scene.add(v); deco.push(v);
    const llama = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffbe0b }));
    llama.position.set(v.position.x, v.position.y + 0.6, v.position.z);
    scene.add(llama); deco.push(llama);
  }

  // ---- cajas y coleccionables (grupos espaciados 15-18 m) ----
  const clusters = [
    { z: 10, kind: 'line', type: 'normal', n: 4 },
    { z: 44, kind: 'pyramid' },
    { z: 62, kind: 'bounce' },
    { z: 80, kind: 'tnt' },
    { z: 106, kind: 'mix' },
    { z: 136, kind: 'line', type: 'steel', n: 3 },
    { z: 168, kind: 'pyramid' },
    { z: 206, kind: 'tnt' },
    { z: 244, kind: 'line', type: 'normal', n: 4 }
  ];
  for (const c of clusters) {
    if (c.kind === 'line') for (let i = 0; i < c.n; i++) crates.push(buildCrate(world, scene, { x: -1.5 + i, z: c.z, type: c.type }));
    else if (c.kind === 'pyramid') {
      for (let i = 0; i < 3; i++) crates.push(buildCrate(world, scene, { x: -1 + i, z: c.z }));
      for (let i = 0; i < 2; i++) crates.push(buildCrate(world, scene, { x: -0.5 + i, y: 0.96, z: c.z }));
      crates.push(buildCrate(world, scene, { x: 0, y: 1.92, z: c.z }));
    } else if (c.kind === 'bounce') {
      crates.push(buildCrate(world, scene, { x: -1.5, z: c.z, type: 'bounce' }));
      crates.push(buildCrate(world, scene, { x: -0.4, z: c.z, type: 'bounce' }));
      for (let i = 0; i < 4; i++) notes.push(buildNote(world, scene, { x: -1.4 + i * 0.9, y: 4.2 + i * 0.6, z: c.z + 1.4 }));
    } else if (c.kind === 'tnt') {
      crates.push(buildCrate(world, scene, { x: -1.8, z: c.z, type: 'tnt' }));
      crates.push(buildCrate(world, scene, { x: 0, z: c.z, type: 'tnt' }));
      crates.push(buildCrate(world, scene, { x: 1.8, z: c.z, type: 'tnt' }));
    } else {
      crates.push(buildCrate(world, scene, { x: -2.4, z: c.z }));
      crates.push(buildCrate(world, scene, { x: -1.3, y: 0.96, z: c.z }));
      crates.push(buildCrate(world, scene, { x: 1.4, z: c.z, type: 'checkpoint' }));
      crates.push(buildCrate(world, scene, { x: 2.4, z: c.z, type: 'steel' }));
    }
  }

  // notas: grupos SOLO sobre tramos firmes (nunca sobre el vacío)
  notasEnTramos(notes, world, scene, { tramos: tramosFirmes, paso: 8 });
  masks.push(buildMask(world, scene, { x: 0, y: 1.3, z: 70 }));
  masks.push(buildMask(world, scene, { x: -3.6, y: 4.6, z: 214 }));

  [46, 88, 160, 232].forEach((cz) => { crates.push(buildCrate(world, scene, { x: 0, z: cz, type: 'checkpoint' })); checkpoints.push({ z: cz }); });
  crates.push(buildCrate(world, scene, { x: 0, z: 246, type: 'switch' }));
  switches.push({ z: 246, doorZ: 249 });

  enemies.push(enemy('patrol', { x: -3.2, z: 60, span: 6, speed: 3.2, axis: 'x' }));
  enemies.push(enemy('patrol', { x: 3.2, z: 84, span: 7, speed: 3.5, axis: 'x' }));
  enemies.push(enemy('turret', { x: 5.6, z: 158, period: 3.0 }));
  enemies.push(enemy('patrol', { x: 2.6, z: 200, span: 7, speed: 3.6, axis: 'x' }));
  enemies.push(enemy('patrol', { x: -3.0, z: 226, span: 6, speed: 3.4, axis: 'x' }));

  return {
    id: 4, nombre: 'La Procesión',
    tip: 'Tranvías rojos: móntate o salta. Cajas flecha ▲ suben a los balcones (ojo, se desmoronan).',
    length: L, spawn: { x: 0, y: 0.1, z: 3 }, goal: { x: 0, z: 249 },
    crates, notes, masks, checkpoints, puddles, enemies, switches,
    chase: false, arena: false, bg: 4, colorTecho: 0x1a0f2e, lampIntensity: 1.15
  };
}

/* =========================================================
   MUNDO 5 — "EL ENTIERRO DE LA SARDINA" (jefe intermedio Fermín)
   Desfile nocturno: antorchas, humo que empuja y Fermín al final.
   ========================================================= */
export function buildLevel5(world, scene, fx) {
  MUNDO2 = 5;
  const rnd = R(7733);
  const crates = [], notes = [], masks = [], checkpoints = [], puddles = [], enemies = [], switches = [], deco = [];
  const tramosFirmes = [];

  /* Reparto:
     A  0-44      desfile: charcos de humo y un hueco con plataforma que sube
     B  44-84     SOLO BLOQUES · 5 losas del desfile sobre el vacío
     C  84-118,6  recta del desfile: antorchas, cajas y máscara alta
     D  118,6-146 campo de Fermín: suelo firme (aquí es la pelea del jefe) y meta */

  // ---- A: desfile con un hueco ----
  const A = calzada(world, scene, { z0: 0, z1: 44, rnd, w: 16, color: 0x2e2438, saltos: [
    { z: 16, w: 1.7 },
    { z: 30, w: 3.4, plataforma: { y: 0.55, w: 4.6, amp: 0.45, speed: 1.4 } },
    { z: 40, w: 1.7 }
  ] });
  tramosFirmes.push(...A.tramos);

  // ---- B: SOLO BLOQUES · cinco losas sobre el vacío ----
  const B = islas(world, scene, { z0: 44, n: 5, d: [8.6, 6.6, 6.6, 6.6, 7.2], sep: 1.7, w: 5.4, zig: 0.5, tops: [0, 0.24, 0], color: 0x5a3a1a });
  B.losa.forEach((l, i) => {
    notes.push(buildNote(world, scene, { x: l.x, y: l.y + 0.95, z: l.z }));
    if (i === 2) crates.push(buildCrate(world, scene, { x: l.x + 1.2, y: l.y, z: l.z, type: 'normal' }));
  });

  // ---- C: recta del desfile (firme) ----
  const C = calzada(world, scene, { z0: B.fin, z1: B.fin + 34, rnd, w: 16, color: 0x372b44 });
  tramosFirmes.push(...C.tramos);
  corridor(world, scene, { z0: 0, z1: 118, halfW: 7.6, h: 6.4, color: 0x4a3560, step: 14 });

  // ---- D: campo de Fermín (TODO firme: la pelea del jefe no lleva huecos) ----
  const D = calzada(world, scene, { z0: C.fin, z1: 146, rnd, w: 16, color: 0x2e2438 });
  tramosFirmes.push(...D.tramos);
  corridor(world, scene, { z0: 118, z1: 146, halfW: 7.6, h: 6.4, color: 0x4a3560, step: 14 });
  const L = 146;

  // antorchas del desfile
  for (let i = 0; i < 30; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.5, 8), toonMat(0x5a3a1a));
    t.position.set((i % 2 ? 1 : -1) * 6.6, 0.75, 8 + i * 4.4);
    scene.add(t); deco.push(t);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff7b00 }));
    f.position.set(t.position.x, 1.7, t.position.z);
    scene.add(f); deco.push(f);
  }
  // la sardina gigante decorativa
  const sardina = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), toonMat(0x9aa5b1));
  cuerpo.scale.set(1, 0.7, 2.2);
  const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), toonMat(0x1a1a1a));
  ojo.position.set(0.5, 0.3, 1.6);
  const cola = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 8), toonMat(0x9aa5b1));
  cola.rotation.x = Math.PI / 2; cola.position.z = -2.6;
  sardina.add(cuerpo, ojo, cola);
  sardina.position.set(-3.5, 1.6, 30);
  sardina.rotation.y = 0.4;
  scene.add(sardina); deco.push(sardina);

  // humo que empuja (zonas que frenan y desplazan al jugador) — SIN colisión sólida
  for (const hz of [22, 60, 96]) {
    solid(world, scene, { x: (hz % 8) - 4, y: 0, z: hz, w: 6.5, h: 2.2, d: 4.5, color: 0x6a6a7a, tag: 'humo', visible: true }).solid = false;
  }

  // ruta ALTA opcional sobre el suelo firme (escalera)
  const esc = escalera(world, scene, { x: 4.2, z: B.fin + 4, alturas: [0.8, 1.6, 2.4] });
  notes.push(buildNote(world, scene, { x: esc.x, y: esc.cima + 1.0, z: esc.z + 3.2 }));
  notes.push(buildNote(world, scene, { x: esc.x, y: esc.cima + 1.0, z: esc.z + 6.4 }));
  crates.push(buildCrate(world, scene, { x: esc.x, y: esc.cima, z: esc.z + 6.4, type: 'bounce' }));

  /* NOTA: el Entierro de la Sardina se queda SIN piezas de esta ronda a
     propósito. Es el nivel del jefe intermedio y su tramo de bloques sobre el
     vacío castiga cualquier pieza de más (el bot cae al agujero y entra en
     bucle). El nivel ya tiene variedad de sobra (desfile, cirios, humo,
     Fermín), así que aquí manda la estabilidad del recorrido. */

  // cajas y notas (grupos espaciados)
  const clusters = [
    { z: 12, kind: 'line', type: 'normal', n: 4 },
    { z: 50, kind: 'pyramid' },
    { z: 76, kind: 'mix' },
    { z: 98, kind: 'line', type: 'steel', n: 3 },
    { z: 126, kind: 'pyramid' }
  ];
  for (const c of clusters) {
    if (c.kind === 'line') for (let i = 0; i < c.n; i++) crates.push(buildCrate(world, scene, { x: -1.5 + i, z: c.z, type: c.type }));
    else if (c.kind === 'pyramid') {
      for (let i = 0; i < 3; i++) crates.push(buildCrate(world, scene, { x: -1 + i, z: c.z }));
      for (let i = 0; i < 2; i++) crates.push(buildCrate(world, scene, { x: -0.5 + i, y: 0.96, z: c.z }));
    } else {
      crates.push(buildCrate(world, scene, { x: -2.2, z: c.z }));
      crates.push(buildCrate(world, scene, { x: 1.6, z: c.z, type: 'bounce' }));
      crates.push(buildCrate(world, scene, { x: 2.6, z: c.z, type: 'steel' }));
    }
  }

  notasEnTramos(notes, world, scene, { tramos: tramosFirmes, paso: 8 });
  masks.push(buildMask(world, scene, { x: -4.4, y: 1.2, z: 20 }));
  masks.push(buildMask(world, scene, { x: 4.4, y: 3.4, z: 108 }));

  [36, 90, 120].forEach((cz) => { crates.push(buildCrate(world, scene, { x: 0, z: cz, type: 'checkpoint' })); checkpoints.push({ z: cz }); });

  enemies.push(enemy('patrol', { x: -3.4, z: 24, span: 7, speed: 3.3, axis: 'x' }));
  enemies.push(enemy('patrol', { x: 3.4, z: 68, span: 8, speed: 3.7, axis: 'x' }));
  enemies.push(enemy('turret', { x: -6.0, z: 100, period: 2.9 }));

  return {
    id: 5, nombre: 'El Entierro de la Sardina',
    tip: 'Esquiva el humo y los barriles. Sube con las cajas flecha ▲: arriba está la máscara.',
    length: L, spawn: { x: 0, y: 0.1, z: 3 }, goal: { x: 0, z: 143 },
    crates, notes, masks, checkpoints, puddles, enemies, switches,
    chase: false, arena: false, bossIntermedio: 'fermin', bossIntermedioZ: 122,
    bg: 5, colorTecho: 0x120a24, lampIntensity: 1.3
  };
}

/* =========================================================
   MUNDO 6 — "LA HUERTA PERDIDA" (agua que frena, árboles, abejas)
   ========================================================= */
export function buildLevel6(world, scene, fx) {
  MUNDO2 = 6;
  const rnd = R(9166);
  const crates = [], notes = [], masks = [], checkpoints = [], puddles = [], enemies = [], switches = [], deco = [];
  const tramosFirmes = [];

  /* Reparto:
     A  0-46      huerta de entrada: 2 acequias (agua que frena) y un hueco
     B  46-89,2   SOLO BLOQUES 1 · los bancales se han hundido: 5 losas
     C  89,2-140  huerta con acequia y ramas de árbol (ruta alta)
     D  140-176,4 OBRAS del riego: 2 huecos con plataforma móvil
     E  176,4-219,6  SOLO BLOQUES 2 · 6 losas + hueco con plataforma
     F  219,6-248 huerta final con abejas, interruptor (!) y meta */

  // ---- A: huerta de entrada con una acequia ----
  const A = calzada(world, scene, { z0: 0, z1: 46, rnd, w: 17, color: 0x3f4f2e, saltos: [
    { z: 16, w: 1.7 },
    { z: 34, w: 3.4, plataforma: { axis: 'x', w: 4.6, amp: 1.6, speed: 0.9 } }
  ] });
  tramosFirmes.push(...A.tramos);

  // ---- B: SOLO BLOQUES 1 · cinco losas ----
  const B = islas(world, scene, { z0: 46, n: 5, d: [8.6, 6.6, 6.6, 6.6, 7.2], sep: 1.7, w: 5.4, zig: 0.5, tops: [0, 0.24, 0], color: 0x8b6b3a });
  B.losa.forEach((l, i) => {
    notes.push(buildNote(world, scene, { x: l.x, y: l.y + 0.95, z: l.z }));
    if (i === 2) crates.push(buildCrate(world, scene, { x: l.x + 1.2, y: l.y, z: l.z, type: 'normal' }));
  });

  // ---- C: huerta con acequias (agua que frena) y ramas ----
  const C = calzada(world, scene, { z0: B.fin, z1: B.fin + 51, rnd, w: 17, color: 0x4a5a35 });
  tramosFirmes.push(...C.tramos);
  const acequias = [B.fin + 12, B.fin + 28, B.fin + 42];
  acequias.forEach((az, i) => {
    const agua = new THREE.Mesh(new THREE.BoxGeometry(15, 0.1, 3.4), new THREE.MeshToonMaterial({ color: 0x3d6f8e, transparent: true, opacity: 0.8 }));
    agua.position.set(0, 0.04, az);
    scene.add(agua); deco.push(agua);
    puddles.push({ x: 0, z: az, r: 7.0 });
    // troncos de piedra a los lados (el centro queda con agua, es el reto)
    for (const k of [-1, 1]) {
      solid(world, scene, { x: k * 5.2, y: 0, z: az, w: 3.4, h: 0.55, d: 4.2, color: 0x8b6b3a, tag: 'tabla' });
    }
    if (i === 0) crates.push(buildCrate(world, scene, { x: 1.8, y: 0.6, z: az + 1.2, type: 'bounce' }));
  });

  // ---- D: obras del riego (huecos con plataformas móviles) ----
  const D = calzada(world, scene, { z0: C.fin, z1: C.fin + 36, rnd, w: 17, color: 0x3f4f2e, saltos: [
    { z: C.fin + 14, w: 3.4, plataforma: { y: 0.55, w: 4.6, amp: 0.45, speed: 1.5 } },
    { z: C.fin + 27, w: 1.7 }
  ] });
  tramosFirmes.push(...D.tramos);

  // ---- E: SOLO BLOQUES 2 · seis losas + hueco ----
  const E1 = islas(world, scene, { z0: D.fin, n: 6, d: [8.4, 6.6, 6.6, 6.6, 6.6, 7.0], sep: 1.7, w: 5.4, zig: 0.5, tops: [0, 0.24], color: 0x8b6b3a });
  E1.losa.forEach((l, i) => {
    notes.push(buildNote(world, scene, { x: l.x, y: l.y + 0.95, z: l.z }));
    if (i === 1) crates.push(buildCrate(world, scene, { x: l.x + 1.2, y: l.y, z: l.z, type: 'steel' }));
    if (i === 4) crates.push(buildCrate(world, scene, { x: l.x - 1.2, y: l.y, z: l.z, type: 'bounce' }));
  });
  const E2 = calzada(world, scene, { z0: E1.fin, z1: E1.fin + 25, rnd, w: 17, color: 0x4a5a35, saltos: [
    { z: E1.fin + 13, w: 3.4, plataforma: { axis: 'x', w: 4.6, amp: 1.6, speed: 1.0 } }
  ] });
  tramosFirmes.push(...E2.tramos);

  // ---- F: huerta final ----
  const F = calzada(world, scene, { z0: E2.fin, z1: 256, rnd, w: 17, color: 0x3f4f2e });
  tramosFirmes.push(...F.tramos);
  const L = 256;

  // árboles de huerta (con plataformas en las ramas) — sobre suelo firme
  for (let i = 0; i < 32; i++) {
    const x = (i % 2 ? 1 : -1) * (5.4 + rnd() * 2.2);
    const z = 12 + i * 7;
    if (z > L - 8) break;
    // los árboles solo donde hay suelo firme (no flotan sobre los agujeros)
    let firme = false;
    for (const [a, b] of tramosFirmes) if (z > a + 1 && z < b - 1) { firme = true; break; }
    if (!firme) continue;
    const t = makeTree({ scale: 1.1 + rnd() * 0.5 });
    t.position.set(x, 0, z);
    scene.add(t); deco.push(t);
    if (i % 3 === 0) {
      floorSeg(world, scene, { x: x * 0.75, y: 3.2, z: z, w: 3.0, d: 3.0, color: 0x8b6b3a, tag: 'rama' });
      notes.push(buildNote(world, scene, { x: x * 0.75, y: 4.1, z: z }));
    }
  }
  // ruta ALTA de premio (escalera sobre firme) — se ancla a un z conocido
  const esc = escalera(world, scene, { x: -4.2, z: E2.fin + 2, alturas: [0.8, 1.6, 2.4] });
  notes.push(buildNote(world, scene, { x: esc.x, y: esc.cima + 1.0, z: esc.z + 3.2 }));
  crates.push(buildCrate(world, scene, { x: esc.x, y: esc.cima, z: esc.z + 6.4, type: 'bounce' }));

  /* ---- RUTA SECRETA 6: el pajar de la huerta --------------
     CAJA FLECHA sobre el bancal: sube al pajar (notas + máscara) siguiendo las
     notas doradas en diagonal. */
  if (!NOFEAT) crates.push(buildCrate(world, scene, { x: 5.8, y: 0, z: 150, type: 'arrow' }));
  if (!NOFEAT) zonaSecreta(world, scene, {
    x: 5.8, y: 3.4, z: 154.4, w: 4.4, d: 4.4, color: 0x8b6b3a,
    pistaDesde: { x: 5.8, y: 1.6, z: 150 }, notasPista: 3, notas: notes
  });
  if (!NOFEAT) {
    masks.push(buildMask(world, scene, { x: 5.8, y: 4.4, z: 154.4 }));
    crates.push(buildCrate(world, scene, { x: 5.8, y: 3.4, z: 152.4, type: 'steel' }));

    /* PLATAFORMAS QUE SE DESMORONAN: tablones viejos junto al bancal, fuera de
       las acequias (por el agua el jugador va por los troncos laterales: una
       tabla que se cae justo en esa ruta estorba más que premia). */
    for (const [rx, rz] of [[-4.6, 96], [-4.6, 99.6]]) {
      cornisaRuina(world, scene, notes, { x: rx, z: rz, w: 3.0, d: 3.2, y: 2.3, notaY: 3.3 });
    }
  }

  /* BARRILES RODANTES por la huerta (entre las abejas; recorrido firme). */
  for (const bd of [{ x: -2.0, z: 192, speed: 7.0 }, { x: 2.0, z: 238, speed: 7.4 }]) {
    const b = barrilSeguro(world, { ...bd, largo: 18 });
    if (b) addEnemy(enemies, enemy('barril', b));
  }

  // hortalizas decorativas + planter
  for (let i = 0; i < 20; i++) {
    const p = makePlanter();
    p.position.set(-6 + rnd() * 12, 0, 18 + i * 11);
    p.scale.setScalar(0.7 + rnd() * 0.5);
    scene.add(p); deco.push(p);
  }
  // espantapájaros
  for (const sz of [58, 118, 176, 232]) {
    const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 8), toonMat(0x6b4a2a));
    palo.position.set((sz % 2 ? 1 : -1) * 5.0, 1.3, sz);
    const brazos = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.12), toonMat(0x6b4a2a));
    brazos.position.set(palo.position.x, 2.0, sz);
    const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), toonMat(0xd6b26a));
    cabeza.position.set(palo.position.x, 2.75, sz);
    const sombrero = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.42, 10), toonMat(PALETA.maderaOsc));
    sombrero.position.set(palo.position.x, 3.1, sz);
    scene.add(palo, brazos, cabeza, sombrero);
  }

  // ABEJAS: vuelan en zigzag (sobre suelo firme)
  for (const bz of [30, 76, 130, 210]) {
    enemies.push(enemy('bee', { x: -2.5 + (bz % 5), z: bz, span: 3.6, speed: 2.0, height: 2.6 }));
  }
  enemies.push(enemy('patrol', { x: 0, z: 100, span: 7, speed: 3.0, axis: 'z' }));
  enemies.push(enemy('turret', { x: 6.4, z: 190, period: 3.4 }));

  // cajas (grupos espaciados)
  const clusters = [
    { z: 12, kind: 'line', type: 'normal', n: 5 },
    { z: 40, kind: 'pyramid' },
    { z: 64, kind: 'tnt' },
    { z: 100, kind: 'mix' },
    { z: 124, kind: 'bounce' },
    { z: 152, kind: 'line', type: 'normal', n: 4 },
    { z: 200, kind: 'pyramid' },
    { z: 244, kind: 'line', type: 'steel', n: 3 }
  ];
  for (const c of clusters) {
    if (c.kind === 'line') for (let i = 0; i < c.n; i++) crates.push(buildCrate(world, scene, { x: -2 + i, z: c.z, type: c.type }));
    else if (c.kind === 'pyramid') {
      for (let i = 0; i < 3; i++) crates.push(buildCrate(world, scene, { x: -1 + i, z: c.z }));
      for (let i = 0; i < 2; i++) crates.push(buildCrate(world, scene, { x: -0.5 + i, y: 0.96, z: c.z }));
      crates.push(buildCrate(world, scene, { x: 0, y: 1.92, z: c.z }));
    } else if (c.kind === 'tnt') {
      crates.push(buildCrate(world, scene, { x: -1.8, z: c.z, type: 'tnt' }));
      crates.push(buildCrate(world, scene, { x: 0, z: c.z, type: 'tnt' }));
      crates.push(buildCrate(world, scene, { x: 1.8, z: c.z, type: 'tnt' }));
      crates.push(buildCrate(world, scene, { x: 0, y: 0.96, z: c.z, type: 'iron' }));
    } else if (c.kind === 'bounce') {
      crates.push(buildCrate(world, scene, { x: -1.4, z: c.z, type: 'bounce' }));
      crates.push(buildCrate(world, scene, { x: 0, z: c.z, type: 'bounce' }));
      for (let i = 0; i < 5; i++) notes.push(buildNote(world, scene, { x: -1.6 + i * 0.8, y: 4.4 + i * 0.5, z: c.z + 1.2 }));
    } else {
      crates.push(buildCrate(world, scene, { x: -2.4, z: c.z }));
      crates.push(buildCrate(world, scene, { x: 1.4, z: c.z, type: 'checkpoint' }));
      crates.push(buildCrate(world, scene, { x: 2.4, z: c.z, type: 'steel' }));
    }
  }

  notasEnTramos(notes, world, scene, { tramos: tramosFirmes, paso: 8, fase: 2 });
  masks.push(buildMask(world, scene, { x: 0, y: 1.3, z: 66 }));
  masks.push(buildMask(world, scene, { x: -5.2, y: 4.2, z: 148 }));
  masks.push(buildMask(world, scene, { x: 5.0, y: 1.2, z: 236 }));

  [42, 104, 172, 240].forEach((cz) => { crates.push(buildCrate(world, scene, { x: 0, z: cz, type: 'checkpoint' })); checkpoints.push({ z: cz }); });
  crates.push(buildCrate(world, scene, { x: 0, z: 248, type: 'switch' }));
  switches.push({ z: 248, doorZ: 251 });

  return {
    id: 6, nombre: 'La Huerta Perdida',
    tip: 'El agua frena: cruza por los troncos. Cajas flecha ▲ al pajar y ojo con los barriles.',
    length: L, spawn: { x: 0, y: 0.1, z: 3 }, goal: { x: 0, z: 253 },
    crates, notes, masks, checkpoints, puddles, enemies, switches,
    chase: false, arena: false, bg: 6, colorTecho: 0x1c2a1a, lampIntensity: 1.0
  };
}

/* =========================================================
   MUNDO 7 — "EL CASINO DE MURCIA"
   Suelo pulido resbaladizo, lámparas oscilantes y ESPEJOS
   (plataformas que solo se ven cuando estás cerca).
   ========================================================= */
export function buildLevel7(world, scene, fx) {
  MUNDO2 = 7;
  const rnd = R(1207);
  const crates = [], notes = [], masks = [], checkpoints = [], puddles = [], enemies = [], switches = [], deco = [];
  const tramosFirmes = [];

  /* Reparto:
     A  0-56      sala pulida: 2 huecos con plataforma que va y viene
     B  56-100    mesas de juego y lámparas (firme)
     C  100-142   SOLO BLOQUES 1 · las baldosas se han caído: 5 losas
     D  142-186   sala con espejos + 2 huecos (uno con plataforma)
     E  186-203   ruta ALTA de premio (escalera con la máscara arriba)
     F  203-250,4 SOLO BLOQUES 2 · 6 losas + hueco con plataforma
     G  250,4-258 recta final: interruptor (!) y meta */

  // ---- A: sala pulida con dos huecos ----
  const A = calzada(world, scene, { z0: 0, z1: 56, rnd, w: 16, color: 0x9c9079, saltos: [
    { z: 18, w: 1.7 },
    { z: 30, w: 3.4, plataforma: { axis: 'x', w: 4.6, amp: 1.5, speed: 0.9 } },
    { z: 46, w: 1.7 }
  ], tag: 'pulido' });
  tramosFirmes.push(...A.tramos);

  // ---- B: mesas de juego y lámparas (firme) ----
  const B = calzada(world, scene, { z0: 56, z1: 100, rnd, w: 16, color: 0x8a7f6a, tag: 'pulido' });
  tramosFirmes.push(...B.tramos);

  // ---- C: SOLO BLOQUES 1 · cinco losas ----
  const C = islas(world, scene, { z0: 100, n: 5, d: [8.6, 6.6, 6.6, 6.6, 7.2], sep: 1.7, w: 5.4, zig: 0.5, tops: [0, 0.24, 0], color: 0xd4c6a6 });
  C.losa.forEach((l, i) => {
    notes.push(buildNote(world, scene, { x: l.x, y: l.y + 0.95, z: l.z }));
    if (i === 2) crates.push(buildCrate(world, scene, { x: l.x + 1.2, y: l.y, z: l.z, type: 'normal' }));
  });

  // ---- D: sala con espejos + huecos ----
  const D = calzada(world, scene, { z0: C.fin, z1: C.fin + 44, rnd, w: 16, color: 0x9c9079, saltos: [
    { z: C.fin + 14, w: 3.4, plataforma: { y: 0.55, w: 4.6, amp: 0.45, speed: 1.45 } },
    { z: C.fin + 26, w: 1.7 },
    { z: C.fin + 37, w: 3.4, plataforma: { axis: 'x', w: 4.6, amp: 1.6, speed: 1.05 } }
  ], tag: 'pulido' });
  tramosFirmes.push(...D.tramos);

  // ---- E: ruta ALTA (escalera: la máscara está en la cima) ----
  const E = calzada(world, scene, { z0: D.fin, z1: D.fin + 17, rnd, w: 16, color: 0x8a7f6a, tag: 'pulido' });
  tramosFirmes.push(...E.tramos);
  const esc = escalera(world, scene, { x: -4.2, z: D.fin + 2, w: 3.4, d: 3.2, alturas: [0.8, 1.6, 2.4], color: 0xd4c6a6 });
  notes.push(buildNote(world, scene, { x: esc.x, y: esc.cima + 1.0, z: esc.z }));
  notes.push(buildNote(world, scene, { x: esc.x, y: esc.cima + 1.0, z: esc.z + 3.2 }));
  crates.push(buildCrate(world, scene, { x: esc.x, y: esc.cima, z: esc.z + 6.4, type: 'bounce' }));
  masks.push(buildMask(world, scene, { x: esc.x, y: esc.cima + 1.3, z: esc.z + 3.2 }));

  /* ---- RUTA SECRETA 7: el reservado del Casino --------------
     CAJA FLECHA con halo junto a la columnata: rebote al reservado, donde
     están las notas y la caja sorpresa. Notas doradas = pista. */
  if (!NOFEAT) crates.push(buildCrate(world, scene, { x: 5.2, y: 0, z: D.fin + 4, type: 'arrow' }));
  if (!NOFEAT) zonaSecreta(world, scene, {
    x: 5.2, y: 3.6, z: D.fin + 8.4, w: 4.4, d: 4.4, color: 0xd4c6a6,
    pistaDesde: { x: 5.2, y: 1.6, z: D.fin + 4 }, notasPista: 3, notas: notes
  });
  if (!NOFEAT) {
    crates.push(buildCrate(world, scene, { x: 5.2, y: 3.6, z: D.fin + 8.4, type: 'bounce' }));
    crates.push(buildCrate(world, scene, { x: 4.1, y: 3.6, z: D.fin + 7.4, type: 'steel' }));

    /* PLATAFORMAS QUE SE DESMORONAN: las cornisas de mármol del salón. */
    crates.push(buildCrate(world, scene, { x: -5.6, y: 0, z: 78, type: 'arrow' }));
    for (const [rx, rz] of [[-5.6, 81.6], [-5.6, 85.2]]) {
      cornisaRuina(world, scene, notes, { x: rx, z: rz, w: 3.0, d: 3.2, y: 2.4, color: 0xc9bda0, notaY: 3.4 });
    }
  }

  /* BARRILES RODANTES por el salón (¡que no te pillen entre las columnas!;
     recorrido verificado firme: esquivar el barril no puede tirarte al vacío). */
  for (const bd of [{ x: -1.6, z: 134, speed: 7.6 }, { x: 1.8, z: 228, speed: 8.0 }]) {
    const b = barrilSeguro(world, { ...bd, largo: 18 });
    if (b) addEnemy(enemies, enemy('barril', b));
  }

  // ---- F: SOLO BLOQUES 2 · seis losas + hueco con plataforma ----
  const F1 = islas(world, scene, { z0: E.fin, n: 6, d: [8.4, 6.6, 6.6, 6.6, 6.6, 7.0], sep: 1.7, w: 5.4, zig: 0.5, tops: [0, 0.24], color: 0xd4c6a6 });
  F1.losa.forEach((l, i) => {
    notes.push(buildNote(world, scene, { x: l.x, y: l.y + 0.95, z: l.z }));
    if (i === 1) crates.push(buildCrate(world, scene, { x: l.x + 1.2, y: l.y, z: l.z, type: 'steel' }));
    if (i === 4) crates.push(buildCrate(world, scene, { x: l.x - 1.2, y: l.y, z: l.z, type: 'bounce' }));
  });
  const F2 = calzada(world, scene, { z0: F1.fin, z1: F1.fin + 28, rnd, w: 16, color: 0x9c9079, saltos: [
    { z: F1.fin + 14, w: 3.4, plataforma: { axis: 'x', w: 4.6, amp: 1.6, speed: 1.1 } }
  ], tag: 'pulido' });
  tramosFirmes.push(...F2.tramos);

  // ---- G: recta final ----
  const G = calzada(world, scene, { z0: F2.fin, z1: 264, rnd, w: 16, color: 0x8a7f6a, tag: 'pulido' });
  tramosFirmes.push(...G.tramos);
  const L = 264;

  // columnas y arcos del casino — en InstancedMesh (4 draw calls: el Casino iba
  // lento en móvil con ~70 meshes sueltos + espejos transparentes).
  {
    const nCols = 20;
    const colGeo = new THREE.CylinderGeometry(0.42, 0.5, 6.2, 12);
    const capGeo = new THREE.BoxGeometry(1.2, 0.4, 1.2);
    const arcoGeo = new THREE.TorusGeometry(3.3, 0.22, 8, 16, Math.PI);
    const colInst = new THREE.InstancedMesh(colGeo, toonMat(0xe8dcc0), nCols * 2);
    const capInst = new THREE.InstancedMesh(capGeo, toonMat(0xd4c6a6), nCols * 2);
    const arcoInst = new THREE.InstancedMesh(arcoGeo, toonMat(0xe8dcc0), nCols);
    const dummy = new THREE.Object3D();
    let ci = 0, ai = 0;
    for (let i = 0; i < nCols; i++) {
      const cz = 8 + i * 13;
      if (cz > L - 6) break;
      for (const x of [-6.6, 6.6]) {
        dummy.position.set(x, 3.1, cz);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        colInst.setMatrixAt(ci, dummy.matrix);
        dummy.position.set(x, 6.2, cz);
        dummy.updateMatrix();
        capInst.setMatrixAt(ci, dummy.matrix);
        ci++;
      }
      dummy.position.set(0, 6.2, cz);
      dummy.updateMatrix();
      arcoInst.setMatrixAt(ai++, dummy.matrix);
    }
    colInst.count = ci; capInst.count = ci; arcoInst.count = ai;
    colInst.instanceMatrix.needsUpdate = true;
    capInst.instanceMatrix.needsUpdate = true;
    arcoInst.instanceMatrix.needsUpdate = true;
    scene.add(colInst, capInst, arcoInst);
    deco.push(colInst, capInst, arcoInst);
  }
  // lámparas oscilantes (peligro: te dan si te tocan) — sobre tramos firmes
  for (const lz of [26, 88, 162, 246]) {
    enemies.push(enemy('lamp', { x: -4 + (lz % 8), z: lz, period: 2.2, amp: 2.6 }));
  }
  // espejos decorativos: OPACOS (los transparentes obligaban a mezclar y
  // ordenar cada frame; con 10 de ellos el Casino perdía fps)
  for (let i = 0; i < 12; i++) {
    const cz = 14 + i * 20;
    if (cz > L - 10) break;
    const espejo = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.2), toonMat(0xd6ecf5));
    espejo.position.set(i % 2 ? -7.4 : 7.4, 3.0, cz);
    espejo.rotation.y = i % 2 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(espejo); deco.push(espejo);
  }

  // ESPEJOS JUGABLES: plataformas invisibles que se materializan al acercarse
  // (ruta de premio sobre suelo firme: si te caes, no pasa nada)
  const espejos = [20, 52, 86, 118, 150, 182];
  espejos.forEach((ez, i) => {
    const y = 1.4 + (i % 3) * 0.9;
    const b = floorSeg(world, scene, { z: ez, d: 3.0, w: 4.4, y, color: 0xbfe3ef, tag: 'espejo' });
    b.espejo = true;
    b.mesh.material.transparent = true;
    b.mesh.material.opacity = 0.06;
    notes.push(buildNote(world, scene, { x: 0, y: y + 1.1, z: ez }));
    // ruta secreta por los espejos altos
    if (i >= 3) notes.push(buildNote(world, scene, { x: 1.6, y: y + 1.6, z: ez + 1 }));
  });

  // cajas (grupos espaciados)
  const clusters = [
    { z: 12, kind: 'line', type: 'normal', n: 4 },
    { z: 40, kind: 'pyramid' },
    { z: 66, kind: 'mix' },
    { z: 90, kind: 'tnt' },
    { z: 116, kind: 'bounce' },
    { z: 138, kind: 'line', type: 'steel', n: 3 },
    { z: 168, kind: 'pyramid' },
    { z: 232, kind: 'mix' }
  ];
  for (const c of clusters) {
    if (c.kind === 'line') for (let i = 0; i < c.n; i++) crates.push(buildCrate(world, scene, { x: -1.8 + i, z: c.z, type: c.type }));
    else if (c.kind === 'pyramid') {
      for (let i = 0; i < 3; i++) crates.push(buildCrate(world, scene, { x: -1 + i, z: c.z }));
      for (let i = 0; i < 2; i++) crates.push(buildCrate(world, scene, { x: -0.5 + i, y: 0.96, z: c.z }));
    } else if (c.kind === 'tnt') {
      crates.push(buildCrate(world, scene, { x: -2, z: c.z, type: 'tnt' }));
      crates.push(buildCrate(world, scene, { x: 0, z: c.z, type: 'tnt' }));
      crates.push(buildCrate(world, scene, { x: 2, z: c.z, type: 'tnt' }));
    } else if (c.kind === 'bounce') {
      for (let i = 0; i < 3; i++) crates.push(buildCrate(world, scene, { x: -1.4 + i * 1.4, z: c.z, type: 'bounce' }));
    } else {
      crates.push(buildCrate(world, scene, { x: -2.4, z: c.z }));
      crates.push(buildCrate(world, scene, { x: 2.4, z: c.z, type: 'checkpoint' }));
    }
  }

  notasEnTramos(notes, world, scene, { tramos: tramosFirmes, paso: 8, fase: 1 });
  masks.push(buildMask(world, scene, { x: 0, y: 1.3, z: 74 }));
  masks.push(buildMask(world, scene, { x: 5.2, y: 1.3, z: 220 }));

  [56, 96, 160, 232].forEach((cz) => { crates.push(buildCrate(world, scene, { x: 0, z: cz, type: 'checkpoint' })); checkpoints.push({ z: cz }); });
  crates.push(buildCrate(world, scene, { x: 0, z: 256, type: 'switch' }));
  switches.push({ z: 256, doorZ: 260 });

  enemies.push(enemy('patrol', { x: -3.6, z: 34, span: 6, speed: 3.4, axis: 'x' }));
  enemies.push(enemy('turret', { x: 6.0, z: 74, period: 3.6 }));
  enemies.push(enemy('patrol', { x: 3.6, z: 132, span: 6, speed: 3.2, axis: 'x' }));
  enemies.push(enemy('turret', { x: -6.0, z: 178, period: 3.6 }));
  enemies.push(enemy('patrol', { x: 2.8, z: 210, span: 5, speed: 3.0, axis: 'x' }));

  return {
    id: 7, nombre: 'El Casino de Murcia',
    tip: 'El suelo resbala: frena antes de saltar. Cajas flecha ▲ al reservado y cuidado con los barriles.',
    length: L, spawn: { x: 0, y: 0.1, z: 3 }, goal: { x: 0, z: 259 },
    crates, notes, masks, checkpoints, puddles, enemies, switches,
    chase: false, arena: false, resbalon: true,
    bg: 7, colorTecho: 0x2a2418, lampIntensity: 1.45
  };
}

export { R };