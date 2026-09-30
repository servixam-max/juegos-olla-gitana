/* MUNDOS NUEVOS (5-8) — Olla Gitana 3D v2
   4 = La Procesión (Semana Santa)  · plataformas horizontales + cirios que caen
   5 = El Entierro de la Sardina      · JEFE Fermín Cascabel + antorchas y humo
   6 = La Huerta Perdida              · agua que frena, saltos entre árboles, abejas
   7 = El Casino de Murcia            · espejos, lámparas oscilantes, suelo pulido
*/
import * as THREE from 'three';
import { Box } from '../engine/physics.js';
import {
  PALETA, makeCrate, makeNote, makeMask, makeSpeaker, makeAmp, makeGuitar, makeMicStand,
  makeBarrel, makeLampPost, makeFloodlight, makePlanter, makePuddle, makeCone, makeTree,
  toonMat, makeStage, makeOlla
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
  const g = makeCrate(type);
  g.position.set(x, y + 0.46, z);
  scene.add(g);
  const b = world.add(new Box({ x, y: y + 0.46, z, w: 0.92, h: 0.92, d: 0.92, tag: 'crate' }));
  b.mesh = g; b.crateType = type;
  b.hp = (type === 'steel' || type === 'iron') ? 2 : 1;
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

/* =========================================================
   MUNDO 4 — "LA PROCESIÓN" (Semana Santa)
   Plataformas que se mueven en horizontal + cirios que caen del cielo.
   ========================================================= */
export function buildLevel4(world, scene, fx) {
  MUNDO2 = 4;
  const rnd = R(4821);
  const crates = [], notes = [], masks = [], checkpoints = [], puddles = [], enemies = [], switches = [], deco = [];
  const L = 172;

  // suelo continuo (plataformas que se mueven son el reto, no los huecos)
  const segs = [];
  let z = 0;
  while (z < L) { const d = 9 + rnd() * 10; segs.push({ z: z + d / 2, d }); z += d; }
  segs.forEach((s, i) => floorSeg(world, scene, { z: s.z, d: s.d, w: 15, color: i % 2 ? 0x5b4a6e : 0x4a3b5c }));
  corridor(world, scene, { z0: 0, z1: L, halfW: 7.2, h: 6.2, color: 0x6b4a7a, step: 14 });

  // plataformas que se mueven en HORIZONTAL (tranvías procesionales)
  const vias = [22, 46, 70, 96, 124, 150];
  vias.forEach((vz, i) => {
    floorSeg(world, scene, {
      z: vz, d: 3.4, w: 5.0, y: 1.1, color: 0x9d0208, tag: 'mover',
      moving: { axis: 'x', amp: 3.6 - i * 0.2, speed: 0.9 + i * 0.12, phase: Math.random() * 3 }
    });
    // notas encima de cada plataforma móvil
    notes.push(buildNote(world, scene, { x: 0, y: 2.2, z: vz }));
  });

  // cirios (columnas que caen: se avisan con una sombra en el suelo)
  // a los LADOS del pasillo (nunca en el centro, que es donde va la cámara)
  let ci = 0;
  for (let cz = 20; cz < L - 10; cz += 11) {
    const lado = (ci % 2 === 0) ? -1 : 1;
    enemies.push(enemy('candle', { x: lado * 4.6, z: cz, period: 2.6 + rnd() * 1.4 }));
    ci++;
  }

  // atrezzo procesional: tronos y estandartes
  for (const tz of [30, 78, 132]) {
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
  for (let i = 0; i < 22; i++) {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.9 + rnd() * 0.6, 8), toonMat(0xfff5e1));
    v.position.set((i % 2 ? 1 : -1) * (6.2 + rnd() * 0.4), 0.45 + rnd() * 0.3, 10 + i * 7);
    scene.add(v); deco.push(v);
    const llama = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffbe0b }));
    llama.position.set(v.position.x, v.position.y + 0.6, v.position.z);
    scene.add(llama); deco.push(llama);
  }

  // cajas y coleccionables
  const clusters = [
    { z: 16, kind: 'line', type: 'normal', n: 4 },
    { z: 40, kind: 'pyramid' },
    { z: 64, kind: 'bounce' },
    { z: 88, kind: 'tnt' },
    { z: 112, kind: 'mix' },
    { z: 140, kind: 'line', type: 'steel', n: 3 }
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
      crates.push(buildCrate(world, scene, { x: 1.4, z: c.z, type: 'nitro' }));
      crates.push(buildCrate(world, scene, { x: 2.4, z: c.z, type: 'steel' }));
    }
  }
  for (let zi = 12; zi < L - 10; zi += 6) {
    notes.push(buildNote(world, scene, { x: Math.sin(zi * 0.4) * 3.4, y: 1.0 + Math.abs(Math.sin(zi * 0.2)) * 2.4, z: zi }));
  }
  // RUTA SECRETA: subiendo por las plataformas móviles más altas
  for (let i = 0; i < 5; i++) notes.push(buildNote(world, scene, { x: 4.4, y: 5.4 + i * 0.5, z: 46 + i * 3 }));
  masks.push(buildMask(world, scene, { x: 0, y: 1.3, z: 36 }));
  masks.push(buildMask(world, scene, { x: -4.2, y: 4.6, z: 90 }));
  masks.push(buildMask(world, scene, { x: 3.6, y: 1.2, z: 132 }));

  [30, 76, 124].forEach((cz) => { crates.push(buildCrate(world, scene, { x: 0, z: cz, type: 'checkpoint' })); checkpoints.push({ z: cz }); });
  crates.push(buildCrate(world, scene, { x: 0, z: 156, type: 'switch' }));
  switches.push({ z: 156, doorZ: 166 });

  enemies.push(enemy('patrol', { x: -3.2, z: 34, span: 6, speed: 3.2, axis: 'x' }));
  enemies.push(enemy('patrol', { x: 3.2, z: 58, span: 7, speed: 3.5, axis: 'x' }));
  enemies.push(enemy('turret', { x: 5.6, z: 84, period: 2.3 }));
  enemies.push(enemy('patrol', { x: 0, z: 108, span: 11, speed: 3.9, axis: 'z' }));
  enemies.push(enemy('patrol', { x: -3.0, z: 148, span: 6, speed: 3.4, axis: 'x' }));

  return {
    id: 4, nombre: 'La Procesión',
    tip: 'Las plataformas rojas van y vienen: móntate y salta. ¡Cuidado con los cirios que caen!',
    length: L, spawn: { x: 0, y: 0.1, z: 3 }, goal: { x: 0, z: 169 },
    crates, notes, masks, checkpoints, puddles, enemies, switches,
    chase: false, arena: false, bg: 4, colorTecho: 0x1a0f2e, lampIntensity: 1.15
  };
}

/* =========================================================
   MUNDO 5 — "EL ENTIERRO DE LA SARDINA" (jefe intermedio Fermín)
   Desfile nocturno: antorchas, humo que empuja, y Fermín al final.
   ========================================================= */
export function buildLevel5(world, scene, fx) {
  MUNDO2 = 5;
  const rnd = R(7733);
  const crates = [], notes = [], masks = [], checkpoints = [], puddles = [], enemies = [], switches = [], deco = [];
  const L = 96;

  const segs = [];
  let z = 0;
  while (z < L) { const d = 8 + rnd() * 9; segs.push({ z: z + d / 2, d }); z += d; }
  segs.forEach((s, i) => floorSeg(world, scene, { z: s.z, d: s.d, w: 16, color: i % 2 ? 0x2e2438 : 0x372b44 }));
  corridor(world, scene, { z0: 0, z1: L, halfW: 7.6, h: 6.4, color: 0x4a3560, step: 14 });

  // antorchas del desfile
  for (let i = 0; i < 20; i++) {
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
  for (const hz of [24, 52]) {
    solid(world, scene, { x: (hz % 8) - 4, y: 0, z: hz, w: 6.5, h: 2.2, d: 4.5, color: 0x6a6a7a, tag: 'humo', visible: true }).solid = false;
  }

  // cajas y notas
  const clusters = [
    { z: 14, kind: 'line', type: 'normal', n: 4 },
    { z: 34, kind: 'pyramid' },
    { z: 58, kind: 'mix' },
    { z: 76, kind: 'line', type: 'normal', n: 3 }
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
  for (let zi = 10; zi < L - 8; zi += 5.5) {
    notes.push(buildNote(world, scene, { x: Math.cos(zi * 0.35) * 3.8, y: 1.0 + Math.abs(Math.sin(zi * 0.25)) * 2.0, z: zi }));
  }
  masks.push(buildMask(world, scene, { x: -4.4, y: 1.2, z: 20 }));
  masks.push(buildMask(world, scene, { x: 4.4, y: 3.2, z: 62 }));

  [26, 60].forEach((cz) => { crates.push(buildCrate(world, scene, { x: 0, z: cz, type: 'checkpoint' })); checkpoints.push({ z: cz }); });

  enemies.push(enemy('patrol', { x: -3.4, z: 22, span: 7, speed: 3.3, axis: 'x' }));
  enemies.push(enemy('patrol', { x: 3.4, z: 46, span: 8, speed: 3.7, axis: 'x' }));
  enemies.push(enemy('turret', { x: -6.0, z: 66, period: 2.1 }));

  return {
    id: 5, nombre: 'El Entierro de la Sardina',
    tip: '¡Menudo desfile! Esquiva el humo y al jefe Fermín Cascabel: písale la cabeza cuando esté rojo.',
    length: L, spawn: { x: 0, y: 0.1, z: 3 }, goal: { x: 0, z: 93 },
    crates, notes, masks, checkpoints, puddles, enemies, switches,
    chase: false, arena: false, bossIntermedio: 'fermin', bossIntermedioZ: 74,
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
  const L = 180;

  const segs = [];
  let z = 0;
  while (z < L) { const d = 9 + rnd() * 11; segs.push({ z: z + d / 2, d }); z += d; }
  segs.forEach((s, i) => floorSeg(world, scene, { z: s.z, d: s.d, w: 17, color: i % 2 ? 0x4a5a35 : 0x3f4f2e }));

  // agua/acequias que frenan (zonas marcadas) — con troncos a los lados, el centro libre
  const acequias = [26, 54, 88, 120, 152];
  acequias.forEach((az, i) => {
    const agua = new THREE.Mesh(new THREE.BoxGeometry(15, 0.1, 3.4), new THREE.MeshToonMaterial({ color: 0x3d6f8e, transparent: true, opacity: 0.8 }));
    agua.position.set(0, 0.04, az);
    scene.add(agua); deco.push(agua);
    puddles.push({ x: 0, z: az, r: 7.0 });
    // troncos de piedra a los lados (el centro queda con agua, es el reto)
    for (const k of [-1, 1]) {
      solid(world, scene, { x: k * 5.2, y: 0, z: az, w: 3.4, h: 0.55, d: 4.2, color: 0x8b6b3a, tag: 'tabla' });
    }
    if (i % 2 === 0) crates.push(buildCrate(world, scene, { x: 1.8, y: 0.6, z: az + 1.2, type: 'bounce' }));
  });

  // árboles de huerta (con plataformas en las ramas)
  for (let i = 0; i < 24; i++) {
    const x = (i % 2 ? 1 : -1) * (5.4 + rnd() * 2.2);
    const z = 12 + i * 7;
    if (z > L - 8) break;
    const t = makeTree({ scale: 1.1 + rnd() * 0.5 });
    t.position.set(x, 0, z);
    scene.add(t); deco.push(t);
    if (i % 3 === 0) {
      floorSeg(world, scene, { x: x * 0.75, y: 3.2, z: z, w: 3.0, d: 3.0, color: 0x8b6b3a, tag: 'rama' });
      notes.push(buildNote(world, scene, { x: x * 0.75, y: 4.1, z: z }));
    }
  }
  // hortalizas decorativas + planter
  for (let i = 0; i < 16; i++) {
    const p = makePlanter();
    p.position.set(-6 + rnd() * 12, 0, 18 + i * 9);
    p.scale.setScalar(0.7 + rnd() * 0.5);
    scene.add(p); deco.push(p);
  }
  // espantapájaros
  for (const sz of [40, 100, 150]) {
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

  // ABEJAS: enemigo nuevo que vuela en zigzag (menos y más lentas)
  for (const bz of [34, 74, 116]) {
    enemies.push(enemy('bee', { x: -2.5 + (bz % 5), z: bz, span: 3.6, speed: 2.0, height: 2.6 }));
  }
  enemies.push(enemy('patrol', { x: 0, z: 44, span: 9, speed: 3.2, axis: 'z' }));
  enemies.push(enemy('turret', { x: 6.4, z: 132, period: 2.8 }));

  // cajas
  const clusters = [
    { z: 22, kind: 'line', type: 'normal', n: 5 },
    { z: 48, kind: 'pyramid' },
    { z: 72, kind: 'tnt' },
    { z: 104, kind: 'mix' },
    { z: 138, kind: 'bounce' },
    { z: 166, kind: 'line', type: 'normal', n: 4 }
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
      crates.push(buildCrate(world, scene, { x: 1.4, z: c.z, type: 'nitro' }));
      crates.push(buildCrate(world, scene, { x: 2.4, z: c.z, type: 'steel' }));
    }
  }
  for (let zi = 14; zi < L - 10; zi += 6) {
    notes.push(buildNote(world, scene, { x: Math.sin(zi * 0.32) * 4.2, y: 1.0 + Math.abs(Math.cos(zi * 0.21)) * 2.2, z: zi }));
  }
  masks.push(buildMask(world, scene, { x: 0, y: 1.3, z: 42 }));
  masks.push(buildMask(world, scene, { x: -5.2, y: 4.2, z: 96 }));
  masks.push(buildMask(world, scene, { x: 5.0, y: 1.2, z: 158 }));

  [36, 82, 128].forEach((cz) => { crates.push(buildCrate(world, scene, { x: 0, z: cz, type: 'checkpoint' })); checkpoints.push({ z: cz }); });
  crates.push(buildCrate(world, scene, { x: 0, z: 172, type: 'switch' }));
  switches.push({ z: 172, doorZ: 176 });

  return {
    id: 6, nombre: 'La Huerta Perdida',
    tip: 'El agua de las acequias te frena: cruza por los troncos. ¡Y ojo con las abejas!',
    length: L, spawn: { x: 0, y: 0.1, z: 3 }, goal: { x: 0, z: 177 },
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
  const L = 168;

  // suelo pulido (resbaladizo de verdad: se marca con tag y el juego lo aplica)
  const segs = [];
  let z = 0;
  while (z < L) { const d = 10 + rnd() * 10; segs.push({ z: z + d / 2, d }); z += d; }
  segs.forEach((s, i) => floorSeg(world, scene, { z: s.z, d: s.d, w: 16, color: i % 2 ? 0x8a7f6a : 0x9c9079, tag: 'pulido' }));

  // columnas y arcos del casino
  for (let i = 0; i < 14; i++) {
    const cz = 8 + i * 11;
    if (cz > L - 6) break;
    for (const x of [-6.6, 6.6]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 6.2, 12), toonMat(0xe8dcc0));
      col.position.set(x, 3.1, cz);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.2), toonMat(0xd4c6a6));
      cap.position.set(x, 6.2, cz);
      scene.add(col, cap); deco.push(col, cap);
    }
    // arco superior
    const arco = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.22, 8, 16, Math.PI), toonMat(0xe8dcc0));
    arco.position.set(0, 6.2, cz);
    scene.add(arco); deco.push(arco);
  }
  // lámparas oscilantes (peligro: te dan si te tocan)
  for (const lz of [26, 52, 80, 108, 134]) {
    enemies.push(enemy('lamp', { x: -4 + (lz % 8), z: lz, period: 2.2, amp: 2.6 }));
  }
  // candelabros y espejos decorativos
  for (let i = 0; i < 10; i++) {
    const cz = 14 + i * 15;
    if (cz > L - 10) break;
    const espejo = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.2), new THREE.MeshToonMaterial({ color: 0xbfe3ef, transparent: true, opacity: 0.55 }));
    espejo.position.set(i % 2 ? -7.4 : 7.4, 3.0, cz);
    espejo.rotation.y = i % 2 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(espejo); deco.push(espejo);
  }

  // ESPEJOS JUGABLES: plataformas invisibles que se materializan al acercarse
  const espejos = [20, 44, 68, 94, 118, 144];
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

  // cajas
  const clusters = [
    { z: 18, kind: 'line', type: 'normal', n: 4 },
    { z: 40, kind: 'pyramid' },
    { z: 66, kind: 'mix' },
    { z: 92, kind: 'tnt' },
    { z: 120, kind: 'bounce' },
    { z: 150, kind: 'line', type: 'steel', n: 3 }
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
      crates.push(buildCrate(world, scene, { x: 2.4, z: c.z, type: 'nitro' }));
    }
  }
  for (let zi = 12; zi < L - 10; zi += 5.5) {
    notes.push(buildNote(world, scene, { x: Math.sin(zi * 0.45) * 4.6, y: 1.0 + Math.abs(Math.sin(zi * 0.3)) * 2.6, z: zi }));
  }
  masks.push(buildMask(world, scene, { x: 0, y: 1.3, z: 34 }));
  masks.push(buildMask(world, scene, { x: -5.4, y: 4.4, z: 88 }));
  masks.push(buildMask(world, scene, { x: 5.2, y: 1.3, z: 148 }));

  [32, 78, 124].forEach((cz) => { crates.push(buildCrate(world, scene, { x: 0, z: cz, type: 'checkpoint' })); checkpoints.push({ z: cz }); });
  crates.push(buildCrate(world, scene, { x: 0, z: 158, type: 'switch' }));
  switches.push({ z: 158, doorZ: 162 });

  enemies.push(enemy('patrol', { x: -3.6, z: 28, span: 6, speed: 3.4, axis: 'x' }));
  enemies.push(enemy('turret', { x: 6.0, z: 60, period: 2.2 }));
  enemies.push(enemy('patrol', { x: 3.6, z: 100, span: 8, speed: 3.8, axis: 'x' }));
  enemies.push(enemy('turret', { x: -6.0, z: 138, period: 2.0 }));

  return {
    id: 7, nombre: 'El Casino de Murcia',
    tip: 'Suelo pulido: resbala. Los espejos se materializan al acercarte y las lámparas se balancean.',
    length: L, spawn: { x: 0, y: 0.1, z: 3 }, goal: { x: 0, z: 164 },
    crates, notes, masks, checkpoints, puddles, enemies, switches,
    chase: false, arena: false, resbalon: true,
    bg: 7, colorTecho: 0x2a2418, lampIntensity: 1.45
  };
}

export { R };
