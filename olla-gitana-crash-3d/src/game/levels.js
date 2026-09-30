/* Los 3 mundos + arena del jefe (Worker 3).
   Convención: el pasillo avanza en +Z. x lateral, y arriba.
   Unidad ≈ 1 m. El jugador mide 1.25 de alto. */
import * as THREE from 'three';
import { Box } from '../engine/physics.js';
import {
  PALETA, makeCrate, makeNote, makeMask, makeSpeaker, makeAmp, makeGuitar, makeMicStand,
  makeBarrel, makeLampPost, makeFloodlight, makePlanter, makePuddle, makeCone, makeVan,
  makeTree, makeStage, toonMat, makeOlla
} from './art.js';
import { buildLevel4, buildLevel5, buildLevel6, buildLevel7 } from './levels2.js';
import { matSuperficie, claseDeTag } from '../engine/surfaces.js';

/* mundo activo: cada buildLevelN lo fija al empezar; los helpers de geometría
   lo usan para elegir la textura de cada superficie (suelo/muro/plataforma…). */
let MUNDO = 1;

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
  const g = makeCrate(type);
  g.position.set(x, y + 0.46, z);
  scene.add(g);
  const b = world.add(new Box({ x, y: y + 0.46, z, w: 0.92, h: 0.92, d: 0.92, tag: 'crate' }));
  b.mesh = g;
  b.crateType = type;
  b.hp = (type === 'steel' || type === 'iron') ? 2 : 1;
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

/* =========================================================
   NIVEL 1 — "El Ensayo Callejero"
   ========================================================= */
export function buildLevel1(world, scene, fx) {
  MUNDO = 1;
  const rnd = R(1337);
  const crates = [], notes = [], masks = [], checkpoints = [], puddles = [], enemies = [], lamps = [], switches = [], deco = [];
  const L = 150; // longitud total

  // suelo por tramos con algún hueco pequeño (siempre saltable) + plataforma en cada hueco
  let z = 0;
  const segs = [];
  const gaps = [];
  while (z < L) {
    const d = 8 + rnd() * 10;
    segs.push({ z: z + d / 2, d });
    z += d;
    if (z < L - 24 && rnd() < 0.22) {   // sin huecos en los últimos 24 m (recta final)
      const gw = 3.0 + rnd() * 1.2;   // 3.0–4.2 (saltable de sobra)
      gaps.push({ z: z + gw / 2, w: gw });
      z += gw;
    }
  }
  // el suelo es MÁS ancho que las paredes: sin hueco en los bordes
  segs.forEach((s, i) => {
    floorSeg(world, scene, { z: s.z, d: s.d, w: 13, color: i % 2 ? 0x43484e : PALETA.asfalto });
  });
  // cada hueco lleva una plataforma oscilante a TODO lo ancho (nunca se cae)
  for (const g of gaps) {
    floorSeg(world, scene, {
      z: g.z, d: 2.8, w: 13, y: 0.9, color: PALETA.dorado, tag: 'mover',
      moving: { axis: 'y', amp: 0.45, speed: 1.6, phase: Math.random() * 3 }
    });
  }

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
  for (let zi = 8; zi < L - 10; zi += 14) {
    const l = makeLampPost();
    l.position.set(-4.6, 0, zi);
    scene.add(l); lamps.push(l);
    const p = makePlanter();
    p.position.set(4.7, 0, zi + 5);
    scene.add(p); deco.push(p);
  }

  // charcos resbaladizos
  [[ -2.2, 26 ], [ 1.6, 40 ], [ -1.4, 58 ], [ 2.4, 76 ], [ -2.6, 96 ], [ 0.8, 116 ]].forEach(([x, zz]) => {
    const p = makePuddle(1.25 + Math.random() * 0.5);
    p.position.set(x, 0.03, zz);
    scene.add(p);
    puddles.push({ x, z: zz, r: 1.7 });
  });

  // cajones: racimos clásicos
  const clusters = [
    { z: 14, kind: 'line', type: 'normal', n: 4 },
    { z: 30, kind: 'pyramid', type: 'normal' },
    { z: 48, kind: 'line', type: 'bounce', n: 3 },
    { z: 62, kind: 'mix' },
    { z: 84, kind: 'line', type: 'normal', n: 5 },
    { z: 102, kind: 'tnt' },
    { z: 118, kind: 'pyramid', type: 'normal' },
    { z: 132, kind: 'mix' }
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

  // notas musicales (arcos y líneas)
  for (let zi = 10; zi < L - 8; zi += 7) {
    const arc = Math.sin(zi * 0.35) * 2.4;
    notes.push(buildNote(world, scene, { x: arc, y: 0.9 + Math.abs(Math.sin(zi * 0.12)) * 1.6, z: zi }));
  }
  // línea de notas elevada tras los cajones ? (bonus)
  for (let i = 0; i < 5; i++) notes.push(buildNote(world, scene, { x: -2 + i * 1.0, y: 3.4, z: 48 }));

  // máscaras
  masks.push(buildMask(world, scene, { x: 0, y: 1.2, z: 34 }));
  masks.push(buildMask(world, scene, { x: 2.6, y: 2.4, z: 86 }));
  masks.push(buildMask(world, scene, { x: -2.8, y: 1.2, z: 120 }));

  // checkpoints
  [40, 90].forEach((cz) => {
    crates.push(buildCrate(world, scene, { x: 0, z: cz, type: 'checkpoint' }));
    checkpoints.push({ z: cz });
  });

  // interruptor (!) que abre el muro final y suelta notas
  crates.push(buildCrate(world, scene, { x: 0, y: 0, z: 112, type: 'switch' }));
  switches.push({ z: 112, doorZ: 142 });

  // enemigos: amplis patrulleros
  enemies.push(enemy('patrol', { x: -2.4, z: 22, span: 8, speed: 3.1, axis: 'x' }));
  enemies.push(enemy('patrol', { x: 2.2, z: 52, span: 9, speed: 3.6, axis: 'x' }));
  enemies.push(enemy('patrol', { x: 0, z: 74, span: 12, speed: 3.4, axis: 'z' }));
  enemies.push(enemy('patrol', { x: -1.8, z: 106, span: 8, speed: 4.0, axis: 'x' }));
  enemies.push(enemy('patrol', { x: 2.0, z: 126, span: 10, speed: 3.8, axis: 'x' }));

  // meta
  const goal = { z: 147, x: 0 };

  return {
    id: 1, nombre: 'El Ensayo Callejero',
    tip: 'Rompe cajones con el giro (X) o saltando encima. Cuidado con los charcos: resbalan.',
    length: L, spawn: { x: 0, y: 0.1, z: 2 }, goal, crates, notes, masks, checkpoints, puddles, enemies, switches,
    chase: false, arena: false, bg: 1, colorTecho: 0x2a1b40,
    lampIntensity: 1.0
  };
}

/* =========================================================
   NIVEL 2 — "Ruta al Festi" (andamios verticales)
   ========================================================= */
export function buildLevel2(world, scene, fx) {
  MUNDO = 2;
  const rnd = R(2451);
  const crates = [], notes = [], masks = [], checkpoints = [], puddles = [], enemies = [], lamps = [], switches = [], deco = [];
  const L = 165;

  // suelo base (asfalto + tramos de madera) con huecos cubiertos por plataformas
  let z = 0;
  const segs = [];
  const gaps2 = [];
  while (z < L) {
    const d = 7 + rnd() * 9;
    segs.push({ z: z + d / 2, d });
    z += d;
    if (z < L - 20 && rnd() < 0.34) {
      const gw = 3.4 + rnd() * 1.2;
      gaps2.push({ z: z + gw / 2, w: gw });
      z += gw;
    }
  }
  segs.forEach((s, i) => floorSeg(world, scene, { z: s.z, d: s.d, w: 13, color: i % 3 === 0 ? PALETA.madera : 0x4b4550 }));
  for (const g of gaps2) {
    floorSeg(world, scene, {
      z: g.z, d: 3.0, w: 13, y: 0.85, color: PALETA.dorado, tag: 'mover',
      moving: { axis: 'y', amp: 0.4, speed: 1.5, phase: Math.random() * 3 }
    });
  }

  // andamios verticales: plataformas a distintas alturas con barrotes
  const scaffolds = [
    { z: 18, h: [1.6, 3.2], side: -1 },
    { z: 34, h: [1.8, 3.6, 5.2], side: 1 },
    { z: 56, h: [2.2, 4.2], side: -1 },
    { z: 78, h: [1.5, 3.0, 4.6], side: 1 },
    { z: 100, h: [2.0, 3.8], side: -1 },
    { z: 122, h: [1.7, 3.4, 5.0], side: 1 },
    { z: 142, h: [2.4, 4.4], side: -1 }
  ];
  for (const s of scaffolds) {
    s.h.forEach((h, i) => {
      const x = s.side * (2.6 + i * 0.5);
      floorSeg(world, scene, { x, y: h, z: s.z, w: 3.2, d: 3.4, color: PALETA.madera, tag: 'platform' });
      // barrotes
      solid(world, scene, { x: x + s.side * 1.6, y: h, z: s.z, w: 0.14, h: 1.1, d: 3.4, color: 0x8a5a2b, tag: 'rail' });
      // notas sobre las plataformas
      if (i % 2 === 0) notes.push(buildNote(world, scene, { x, y: h + 0.9, z: s.z }));
    });
    // poste del andamio
    solid(world, scene, { x: s.side * 2.2, y: 0, z: s.z, w: 0.18, h: 5.6, d: 0.18, color: 0x6f6f7a, tag: 'pole' });
  }

  // plataformas oscilantes (suben y bajan) sobre los huecos — con barandas
  const movers = [
    { z: 26, y: 1.6, amp: 1.2, speed: 1.4 },
    { z: 48, y: 2.0, amp: 1.5, speed: 1.1 },
    { z: 70, y: 1.8, amp: 1.3, speed: 1.6 },
    { z: 92, y: 2.2, amp: 1.6, speed: 1.2 },
    { z: 116, y: 1.7, amp: 1.4, speed: 1.5 },
    { z: 136, y: 2.1, amp: 1.7, speed: 1.0 }
  ];
  for (const m of movers) {
    floorSeg(world, scene, { z: m.z, d: 4.0, w: 4.2, y: m.y, color: PALETA.azul, tag: 'mover', moving: { axis: 'y', amp: m.amp, speed: m.speed, phase: Math.random() * 3 } });
  }

  // focos móviles (giran y apuntan)
  for (const fz of [24, 60, 96, 130]) {
    const f = makeFloodlight({ height: 4.6, swing: 0.35 });
    f.position.set(-4.4, 0, fz);
    scene.add(f); lamps.push(f);
  }
  // truss y altavoces
  for (const sz of [30, 66, 104, 140]) {
    solid(world, scene, { x: 4.6, y: 0, z: sz, w: 1.0, h: 0.8, d: 1.0, color: 0x2b2b2b, tag: 'speakerBase' });
    const sp = makeSpeaker({ big: true });
    sp.position.set(4.6, 0.8, sz);
    scene.add(sp); deco.push(sp);
  }
  for (let zi = 12; zi < L - 10; zi += 18) {
    const g = makeGuitar({ color: [PALETA.rojo, PALETA.azul, PALETA.dorado][zi % 3], scale: 1.4 });
    g.position.set(-4.2, 1.3, zi + 6);
    g.rotation.z = -0.3;
    scene.add(g); deco.push(g);
  }

  // pilas de cajones y TNT
  const clusters = [
    { z: 16, kind: 'pyramid', type: 'normal' },
    { z: 44, kind: 'line', type: 'normal', n: 5 },
    { z: 52, kind: 'bounce' },
    { z: 88, kind: 'mix' },
    { z: 110, kind: 'tnt' },
    { z: 150, kind: 'pyramid', type: 'normal' }
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

  // arcos de notas
  for (let zi = 20; zi < L - 12; zi += 8) {
    const arc = Math.cos(zi * 0.22) * 3.0;
    notes.push(buildNote(world, scene, { x: arc, y: 1.0 + Math.abs(Math.sin(zi * 0.18)) * 2.2, z: zi }));
  }
  masks.push(buildMask(world, scene, { x: -2.6, y: 3.6, z: 34 }));
  masks.push(buildMask(world, scene, { x: 3.0, y: 4.8, z: 78 }));
  masks.push(buildMask(world, scene, { x: -3.0, y: 3.2, z: 122 }));

  [30, 66, 104].forEach((cz) => {
    crates.push(buildCrate(world, scene, { x: 0, z: cz, type: 'checkpoint' }));
    checkpoints.push({ z: cz });
  });

  crates.push(buildCrate(world, scene, { x: 0, z: 132, type: 'switch' }));
  switches.push({ z: 132, doorZ: 158 });

  enemies.push(enemy('patrol', { x: -2.6, z: 20, span: 5, speed: 3.0, axis: 'x' }));
  enemies.push(enemy('patrol', { x: 2.6, z: 40, span: 6, speed: 3.4, axis: 'x' }));
  enemies.push(enemy('turret', { x: 4.2, z: 62, period: 2.2 }));
  enemies.push(enemy('patrol', { x: 0, z: 84, span: 10, speed: 4.2, axis: 'z' }));
  enemies.push(enemy('turret', { x: -4.2, z: 118, period: 1.9 }));
  enemies.push(enemy('patrol', { x: 2.4, z: 148, span: 7, speed: 3.6, axis: 'x' }));

  return {
    id: 2, nombre: 'Ruta al Festi',
    tip: 'Usa los andamios y las plataformas que oscilan. Los focos giran y los altavoces disparan ondas.',
    length: L, spawn: { x: 0, y: 0.1, z: 2 }, goal: { z: 161, x: 0 },
    crates, notes, masks, checkpoints, puddles, enemies, switches,
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
  const L = 210;

  // carretera CONTINUA (sin huecos: con la furgo detrás, caer sería injusto).
  // Los "baches" son visuales (manchas de tierra) y los obstáculos se esquivan.
  const segs = [];
  let z = 0;
  while (z < L) {
    const d = 9 + rnd() * 11;
    segs.push({ z: z + d / 2, d });
    z += d;
  }
  segs.forEach((s, i) => floorSeg(world, scene, { z: s.z, d: s.d + 0.4, w: 11, color: i % 2 ? 0x3c4148 : 0x474c53 }));
  // manchas de barro/baches visuales
  for (let i = 0; i < 14; i++) {
    const p = makePuddle(1.0 + Math.random() * 0.8);
    p.material.color.set(0x6b5a3e);
    p.position.set(-4 + Math.random() * 8, 0.03, 12 + Math.random() * (L - 30));
    scene.add(p);
  }

  // arcenes y barandilla
  for (let zi = 0; zi < L; zi += 14) {
    solid(world, scene, { x: -5.9, y: 0, z: zi + 7, w: 0.8, h: 0.5, d: 14, color: 0x6b7280, tag: 'curb' });
    solid(world, scene, { x: 5.9, y: 0, z: zi + 7, w: 0.8, h: 0.5, d: 14, color: 0x6b7280, tag: 'curb' });
  }

  // carteles y conos
  for (const cz of [18, 44, 70, 96, 124, 152, 180]) {
    const c = makeCone();
    c.position.set(-4.4 + Math.random() * 1.2, 0, cz);
    scene.add(c); deco.push(c);
  }
  for (const sz of [30, 80, 130, 175]) {
    solid(world, scene, { x: 5.0, y: 0, z: sz, w: 0.4, h: 2.6, d: 0.4, color: 0x9aa5b1, tag: 'sign' });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 0.16), toonMat(sz % 60 === 30 ? PALETA.dorado : PALETA.rojo));
    sign.position.set(5.0, 2.6, sz);
    scene.add(sign); deco.push(sign);
  }

  // obstáculos rodantes (amplificadores que bajan por la carretera)
  enemies.push(enemy('roller', { x: -2.2, z: 60, speed: 7.5 }));
  enemies.push(enemy('roller', { x: 1.8, z: 96, speed: 8.4 }));
  enemies.push(enemy('roller', { x: -1.2, z: 132, speed: 9.0 }));
  enemies.push(enemy('roller', { x: 2.6, z: 168, speed: 9.6 }));

  // barriles estáticos
  for (const [bx, bz] of [[-3.2, 24], [3.0, 40], [-2.6, 88], [2.8, 112], [-3.4, 146], [2.2, 158]]) {
    const bar = makeBarrel({ color: [PALETA.rojo, PALETA.azul, PALETA.dorado][(bx + bz) % 3] });
    bar.position.set(bx, 0, bz);
    scene.add(bar); deco.push(bar);
    world.add(new Box({ x: bx, y: 0.45, z: bz, w: 0.66, h: 0.9, d: 0.66, tag: 'barrel' })).mesh = bar;
  }

  // cajas: pocas (es una carrera), casi todas TNT/Nitro para esquivar
  crates.push(buildCrate(world, scene, { x: -1.5, z: 34, type: 'normal' }));
  crates.push(buildCrate(world, scene, { x: 1.5, z: 34, type: 'normal' }));
  crates.push(buildCrate(world, scene, { x: 0, z: 72, type: 'checkpoint' }));
  crates.push(buildCrate(world, scene, { x: -2.4, z: 108, type: 'tnt' }));
  crates.push(buildCrate(world, scene, { x: 2.4, z: 108, type: 'tnt' }));
  crates.push(buildCrate(world, scene, { x: 0, z: 156, type: 'bounce' }));
  crates.push(buildCrate(world, scene, { x: 0, z: 196, type: 'normal' }));

  // notas en fila india por el centro
  for (let zi = 12; zi < L - 14; zi += 5) {
    const arc = Math.sin(zi * 0.3) * 2.6;
    notes.push(buildNote(world, scene, { x: arc, y: 0.9, z: zi }));
  }
  masks.push(buildMask(world, scene, { x: 0, y: 1.4, z: 120 }));
  masks.push(buildMask(world, scene, { x: -2.8, y: 1.2, z: 186 }));

  [50, 110, 165].forEach((cz) => {
    crates.push(buildCrate(world, scene, { x: 0, z: cz, type: 'checkpoint' }));
    checkpoints.push({ z: cz });
  });

  return {
    id: 3, nombre: 'Furgoneta Desbocada',
    tip: '¡Corre hacia la cámara! La furgoneta no frena. Esquiva baches, barriles y amplis rodantes.',
    length: L, spawn: { x: 0, y: 0.1, z: 4 }, goal: { z: 205, x: 0 },
    crates, notes, masks, checkpoints, puddles, enemies, switches,
    chase: true, arena: false, bg: 3, colorTecho: 0x101a2e, lampIntensity: 0.9,
    van: { startZ: -8, speed: 6.2, accel: 0.12, catchUp: true }
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
    crates, notes, masks, checkpoints, puddles, enemies, switches,
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
