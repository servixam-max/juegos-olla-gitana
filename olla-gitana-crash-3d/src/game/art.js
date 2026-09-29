/* Arte procedimental: mallas low-poly con toon shading, personajes, cajas,
   coleccionables y atrezzo de los 3 mundos. Todo generado en código (sin assets). */
import * as THREE from 'three';

/* ---------- gradiente compartido para el toon ---------- */
let GRAD = null;
export function toonGradient() {
  if (GRAD) return GRAD;
  const steps = new Uint8Array([90, 150, 205, 255]);
  const tex = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  GRAD = tex;
  return tex;
}
export function toonMat(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...opts });
}
const flat = (geo) => { geo.computeVertexNormals(); return geo; };

export function group(...children) {
  const g = new THREE.Group();
  children.forEach((c) => c && g.add(c));
  return g;
}
export function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/* ---------- paleta de la banda ---------- */
export const PALETA = {
  rojo: 0xe63946, rojoOsc: 0x9d1f2b, dorado: 0xffbe0b, naranja: 0xfb8500,
  verde: 0x38b000, morado: 0x8338ec, azul: 0x4cc9f0, crema: 0xfff5e1,
  madera: 0xb5651d, maderaOsc: 0x7c4519, metal: 0x9aa5b1, asfalto: 0x3a3f45,
  tela: 0xd62828, negro: 0x2b2b2b, rosa: 0xff70a6, amarillo: 0xffe066
};

/* =========================================================
   LA OLLA (jugador y rivales)
   ========================================================= */
export function makeOlla({ color = PALETA.rojo, rim = PALETA.dorado, band = true, guitar = false } = {}) {
  const g = new THREE.Group();
  const bodyMat = toonMat(color);
  const rimMat = toonMat(rim, { emissive: new THREE.Color(rim).multiplyScalar(0.12) });
  const darkMat = toonMat(0x2f1c08);

  // cuerpo: olla rechoncha
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), bodyMat);
  body.scale.set(1, 0.88, 1);
  body.position.y = 0.56;
  g.add(body);
  // panza inferior
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), bodyMat);
  belly.scale.set(1.05, 0.72, 1.05); belly.position.y = 0.36;
  g.add(belly);
  // borde de la olla
  const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.075, 8, 20), rimMat);
  rimMesh.rotation.x = Math.PI / 2; rimMesh.position.y = 1.0;
  g.add(rimMesh);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.38, 20), toonMat(0x5a3410));
  inner.rotation.x = -Math.PI / 2; inner.position.y = 0.99;
  g.add(inner);
  // asas
  const handleGeo = new THREE.TorusGeometry(0.17, 0.045, 6, 12, Math.PI);
  const h1 = new THREE.Mesh(handleGeo, rimMat); h1.position.set(-0.62, 0.66, 0); h1.rotation.z = Math.PI / 2;
  const h2 = new THREE.Mesh(handleGeo, rimMat); h2.position.set(0.62, 0.66, 0); h2.rotation.z = -Math.PI / 2;
  g.add(h1, h2);

  // ojos grandes
  const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), toonMat(0xffffff));
  const eyeW2 = eyeW.clone();
  eyeW.position.set(-0.18, 0.68, 0.54); eyeW2.position.set(0.18, 0.68, 0.54);
  g.add(eyeW, eyeW2);
  const pup = new THREE.Mesh(new THREE.SphereGeometry(0.078, 10, 8), darkMat);
  const pup2 = pup.clone();
  pup.position.set(-0.16, 0.68, 0.68); pup2.position.set(0.2, 0.68, 0.68);
  g.add(pup, pup2);
  // cejas
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.05), darkMat);
  const brow2 = brow.clone();
  brow.position.set(-0.18, 0.88, 0.58); brow.rotation.z = 0.22;
  brow2.position.set(0.18, 0.88, 0.58); brow2.rotation.z = -0.22;
  g.add(brow, brow2);
  // bigote rumbero
  if (band) {
    const m1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.06), darkMat);
    const m2 = m1.clone();
    m1.position.set(-0.1, 0.5, 0.62); m1.rotation.z = 0.18;
    m2.position.set(0.1, 0.5, 0.62); m2.rotation.z = -0.18;
    g.add(m1, m2);
    // pañuelo de la banda
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 18), toonMat(PALETA.rojoOsc));
    scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.2;
    g.add(scarf);
  }
  // brazos
  const armMat = toonMat(color);
  const mkArm = (side) => {
    const a = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.22, 4, 8), armMat);
    upper.position.y = -0.14;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), toonMat(rim));
    hand.position.y = -0.3;
    a.add(upper, hand);
    a.position.set(side * 0.66, 0.72, 0);
    return a;
  };
  const armL = mkArm(-1), armR = mkArm(1);
  g.add(armL, armR);
  // piernas
  const legMat = toonMat(0x3b2a12);
  const mkLeg = (side) => {
    const l = new THREE.Group();
    const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.16, 4, 8), legMat);
    th.position.y = -0.13;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.32), toonMat(PALETA.rojoOsc));
    shoe.position.set(0, -0.28, 0.05);
    l.add(th, shoe);
    l.position.set(side * 0.26, 0.3, 0);
    return l;
  };
  const legL = mkLeg(-1), legR = mkLeg(1);
  g.add(legL, legR);

  if (guitar) {
    const gb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.1), toonMat(PALETA.madera));
    gb.position.set(0.5, 0.5, 0.42); gb.rotation.z = -0.5;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.06), toonMat(0x3b2a12));
    neck.position.set(0.62, 0.78, 0.42); neck.rotation.z = -0.5;
    g.add(gb, neck);
  }

  g.userData = { armL, armR, legL, legR, body, eyes: [eyeW, eyeW2], pupils: [pup, pup2] };
  return g;
}

/* =========================================================
   CAJONES
   ========================================================= */
export function makeCrate(type = 'normal') {
  const g = new THREE.Group();
  let edgeColor = PALETA.maderaOsc, faceColor = PALETA.madera, label = null, metal = false;

  if (type === 'tnt') { faceColor = 0xd62828; edgeColor = 0x7a1010; label = 'TNT'; }
  else if (type === 'nitro') { faceColor = 0x2ea84f; edgeColor = 0x14522a; label = 'N'; metal = true; }
  else if (type === 'steel') { faceColor = PALETA.metal; edgeColor = 0x5c6672; metal = true; }
  else if (type === 'bounce') { faceColor = PALETA.dorado; edgeColor = 0xa86f00; label = '?'; }
  else if (type === 'switch') { faceColor = 0x4cc9f0; edgeColor = 0x1c6b86; label = '!'; }
  else if (type === 'checkpoint') { faceColor = 0xb5e48c; edgeColor = 0x4f772d; label = '✔'; }
  else if (type === 'iron') { faceColor = 0xc9a227; edgeColor = 0x7a5c00; metal = true; }

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.92, 0.92), toonMat(faceColor));
  g.add(body);

  if (!metal) {
    // tablones
    const plank = toonMat(edgeColor);
    const bar = new THREE.BoxGeometry(1.0, 0.13, 0.13);
    const barV = new THREE.BoxGeometry(0.13, 1.0, 0.13);
    for (const z of [-0.47, 0.47]) {
      for (const y of [-0.34, 0, 0.34]) g.add(mesh(bar, plank, 0, y, z));
      for (const x of [-0.34, 0, 0.34]) g.add(mesh(barV, plank, x, 0, z));
    }
    for (const x of [-0.47, 0.47]) {
      for (const y of [-0.34, 0, 0.34]) g.add(mesh(new THREE.BoxGeometry(0.13, 0.13, 1.0), plank, x, y, 0));
      for (const z2 of [-0.34, 0, 0.34]) g.add(mesh(new THREE.BoxGeometry(0.13, 1.0, 0.13), plank, x, 0, z2));
    }
  } else {
    const rivet = toonMat(0xe8eef5);
    for (const [x, y] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
      g.add(mesh(new THREE.SphereGeometry(0.05, 6, 6), rivet, x, y, 0.48));
      g.add(mesh(new THREE.SphereGeometry(0.05, 6, 6), rivet, x, y, -0.48));
    }
  }

  if (label) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const c = cv.getContext('2d');
    c.clearRect(0, 0, 256, 256);
    c.font = '900 150px "Luckiest Guy", Nunito, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = type === 'tnt' ? '#fff3b0' : type === 'nitro' ? '#d8ffd8' : '#3a1c00';
    c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 10;
    c.strokeText(label, 128, 138); c.fillText(label, 128, 138);
    const tex = new THREE.CanvasTexture(cv);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), mat);
    plane.position.z = 0.475;
    g.add(plane);
    const plane2 = plane.clone(); plane2.position.z = -0.475; plane2.rotation.y = Math.PI;
    g.add(plane2);
    const plane3 = plane.clone(); plane3.rotation.y = Math.PI / 2; plane3.position.set(0.475, 0, 0);
    g.add(plane3);
    const plane4 = plane.clone(); plane4.rotation.y = -Math.PI / 2; plane4.position.set(-0.475, 0, 0);
    g.add(plane4);
  }

  if (type === 'tnt') {
    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), toonMat(0x2b2b2b));
    fuse.position.set(0.2, 0.6, 0); fuse.rotation.z = 0.4;
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    spark.position.set(0.28, 0.76, 0);
    g.add(fuse, spark);
    g.userData.spark = spark;
  }
  g.userData.type = type;
  return g;
}

/* =========================================================
   COLECCIONABLES
   ========================================================= */
export function makeNote() {
  const g = new THREE.Group();
  const mat = new THREE.MeshToonMaterial({ color: PALETA.dorado, gradientMap: toonGradient(), emissive: 0x6b4a00, emissiveIntensity: 0.6 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), mat);
  head.scale.set(1, 0.72, 1); head.rotation.z = -0.4;
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.56, 0.07), mat);
  stem.position.set(0.18, 0.3, 0);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.05), mat);
  flag.position.set(0.3, 0.56, 0); flag.rotation.z = 0.5;
  g.add(head, stem, flag);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 6, 16), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.55 }));
  halo.rotation.x = Math.PI / 2; halo.position.y = 0.28;
  g.add(halo);
  g.userData.halo = halo;
  return g;
}

export function makeMask() {
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), toonMat(PALETA.madera));
  face.scale.set(1, 1.25, 0.7);
  face.position.y = 0.4;
  g.add(face);
  const dark = toonMat(0x3b2a12);
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), dark);
  const eyeR = eyeL.clone();
  eyeL.position.set(-0.13, 0.45, 0.26); eyeR.position.set(0.13, 0.45, 0.26);
  g.add(eyeL, eyeR);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.05), dark);
  mouth.position.set(0, 0.26, 0.26);
  g.add(mouth);
  const paint = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 18), toonMat(PALETA.rojo));
  paint.position.y = 0.4;
  g.add(paint);
  const feather = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 6), toonMat(PALETA.amarillo));
  feather.position.set(0, 0.85, -0.05);
  g.add(feather);
  return g;
}

/* =========================================================
   ATRREZZO
   ========================================================= */
export function makeSpeaker({ big = false, color = 0x2b2b2b } = {}) {
  const g = new THREE.Group();
  const s = big ? 1.7 : 1;
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 1.2 * s, 0.7 * s), toonMat(color));
  box.position.y = 0.6 * s;
  g.add(box);
  const coneMat = toonMat(0x1b1b1b);
  const ringMat = toonMat(0x545454);
  for (const y of [0.85, 0.34]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * s, 0.3 * s, 0.1, 14), coneMat);
    c.rotation.x = Math.PI / 2; c.position.set(0, y * s, 0.36 * s);
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.3 * s, 0.05, 6, 16), ringMat);
    r.position.set(0, y * s, 0.36 * s);
    g.add(c, r);
  }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.8 * s, 0.2 * s, 0.05), ringMat);
  grille.position.set(0, 1.08 * s, 0.36 * s);
  g.add(grille);
  return g;
}

export function makeAmp() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.6, 0.5), toonMat(0x1f1f1f));
  body.position.y = 0.3;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.16, 0.06), toonMat(PALETA.dorado));
  panel.position.set(0, 0.42, 0.27);
  const knobs = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 8), toonMat(0xfff5e1));
    k.rotation.x = Math.PI / 2; k.position.set(-0.27 + i * 0.18, 0.42, 0.31);
    knobs.add(k);
  }
  const grill = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.05), toonMat(0x6b6b6b));
  grill.position.set(0, 0.2, 0.27);
  g.add(body, panel, knobs, grill);
  return g;
}

export function makeGuitar({ color = PALETA.rojo, scale = 1 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), toonMat(color));
  body.scale.set(0.9, 1.1, 0.3);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.11, 12), toonMat(0x1b1b1b));
  hole.position.z = 0.11;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.08), toonMat(0x3b2a12));
  neck.position.y = 0.72;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.09), toonMat(0x2b2b2b));
  head.position.y = 1.25;
  g.add(body, hole, neck, head);
  g.scale.setScalar(scale);
  return g;
}

export function makeMicStand() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 8), toonMat(0x9aa5b1));
  pole.position.y = 0.85;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.06, 12), toonMat(0x545454));
  const mic = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.16, 4, 10), toonMat(0x1f1f1f));
  mic.position.y = 1.78;
  g.add(pole, base, mic);
  return g;
}

export function makeBarrel({ color = PALETA.rojo } = {}) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.9, 14), toonMat(color));
  b.position.y = 0.45;
  const ring = toonMat(0x545454);
  for (const y of [0.18, 0.72]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.035, 6, 16), ring);
    r.rotation.x = Math.PI / 2; r.position.y = y;
    g.add(r);
  }
  g.add(b);
  return g;
}

export function makeLampPost({ height = 3.4 } = {}) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, height, 8), toonMat(0x4a5057));
  pole.position.y = height / 2;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.09, 0.09), toonMat(0x4a5057));
  arm.position.set(0.32, height - 0.05, 0);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.24, 8), toonMat(0x4a5057));
  head.position.set(0.62, height - 0.12, 0);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  bulb.position.set(0.62, height - 0.3, 0);
  g.add(pole, arm, head, bulb);
  return g;
}

export function makeFloodlight({ height = 4.2, swing = 0.6 } = {}) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, height, 8), toonMat(0x3f464d));
  pole.position.y = height / 2;
  const yoke = new THREE.Group();
  yoke.position.y = height;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.12), toonMat(0x2f3439));
  const light = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.44, 0.34), toonMat(0x2f3439));
  light.position.y = 0.3;
  const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.36), new THREE.MeshBasicMaterial({ color: 0xfff1c0 }));
  lens.position.set(0, 0.3, 0.18);
  yoke.add(bar, light, lens);
  yoke.rotation.x = swing;
  g.add(pole, yoke);
  g.userData.yoke = yoke;
  return g;
}

export function makePlanter() {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.5, 12), toonMat(0xb5651d));
  pot.position.y = 0.25;
  const bushMat = toonMat(PALETA.verde);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.3 + Math.random() * 0.12, 10, 8), bushMat);
    b.position.set((Math.random() - 0.5) * 0.4, 0.6 + Math.random() * 0.25, (Math.random() - 0.5) * 0.3);
    g.add(b);
  }
  g.add(pot);
  return g;
}

export function makePuddle(r = 1.1) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 18), new THREE.MeshToonMaterial({ color: 0x3d6f8e, transparent: true, opacity: 0.75, gradientMap: toonGradient() }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  return m;
}

export function makeCone() {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.6, 10), toonMat(0xfb8500));
  c.position.y = 0.3;
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.09, 10), toonMat(0xfff5e1));
  stripe.position.y = 0.32;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), toonMat(0xfb8500));
  g.add(c, stripe, base);
  return g;
}

export function makeVan({ color = PALETA.crema } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 3.2), toonMat(color));
  body.position.y = 1.0;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.85, 1.2), toonMat(color));
  cab.position.set(0, 0.78, -1.95);
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.12), toonMat(0x4cc9f0));
  win.position.set(0, 1.12, -2.5);
  const wheelMat = toonMat(0x1b1b1b);
  const wheels = [];
  for (const [x, z] of [[-0.78, -1.6], [0.78, -1.6], [-0.78, 1.2], [0.78, 1.2]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 12), wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.34, z);
    wheels.push(w); g.add(w);
  }
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.2, 3.22), toonMat(PALETA.rojo));
  stripe.position.y = 1.32;
  g.add(body, cab, win, stripe);
  g.userData.wheels = wheels;
  return g;
}

export function makeTree({ scale = 1 } = {}) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.4, 8), toonMat(0x7c4519));
  trunk.position.y = 0.7;
  const leaves = toonMat(0x2d6a4f);
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random() * 0.3, 10, 8), leaves);
    s.position.set((Math.random() - 0.5) * 0.6, 1.5 + Math.random() * 0.7, (Math.random() - 0.5) * 0.6);
    g.add(s);
  }
  g.add(trunk);
  g.scale.setScalar(scale);
  return g;
}

export function makeStage({ w = 12, d = 6, h = 1.1 } = {}) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toonMat(0x4a3728));
  base.position.y = h / 2;
  g.add(base);
  const backdrop = new THREE.Mesh(new THREE.BoxGeometry(w, 4.2, 0.3), toonMat(PALETA.morado));
  backdrop.position.set(0, 2.1, -d / 2 - 0.2);
  g.add(backdrop);
  for (let i = 0; i < 5; i++) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5, 6), toonMat(0x9aa5b1));
    beam.position.set(-w / 2 + 1 + i * (w - 2) / 4, 2.9, -d / 2 + 0.6);
    g.add(beam);
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.1, 0.4, 8), new THREE.MeshBasicMaterial({ color: [0xffbe0b, 0xe63946, 0x4cc9f0, 0x38b000, 0xff70a6][i] }));
    can.position.set(-w / 2 + 1 + i * (w - 2) / 4, 5.1, -d / 2 + 0.6);
    g.add(can);
  }
  return g;
}

/* =========================================================
   JEFE: "EL CACHARRO" (torre de altavoces con guitarra)
   ========================================================= */
export function makeBoss() {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 1.5), toonMat(0x2b2b2b));
  torso.position.y = 2.1;
  g.add(torso);
  // cono altavoz pecho
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.78, 0.3, 18), toonMat(0x1b1b1b));
  cone.rotation.x = Math.PI / 2; cone.position.set(0, 2.2, 0.8);
  const coneRing = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.09, 8, 20), toonMat(PALETA.dorado));
  coneRing.position.set(0, 2.2, 0.8);
  g.add(cone, coneRing);
  // cabeza = pantalla con cara
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.2), toonMat(0x353535));
  head.position.y = 4.0;
  g.add(head);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2e2e });
  const eyeL = new THREE.Mesh(new THREE.CircleGeometry(0.19, 14), eyeMat);
  const eyeR = eyeL.clone();
  eyeL.position.set(-0.34, 4.14, 0.62); eyeR.position.set(0.34, 4.14, 0.62);
  g.add(eyeL, eyeR);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.16, 0.08), toonMat(0xffbe0b));
  mouth.position.set(0, 3.72, 0.62);
  g.add(mouth);
  // brazos con altavoces
  const armMat = toonMat(0x3a3a3a);
  const mkArm = (side) => {
    const arm = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 4, 10), armMat);
    upper.position.y = -0.5;
    const sp = makeSpeaker({ big: false });
    sp.scale.setScalar(0.62);
    sp.position.y = -1.15;
    arm.add(upper, sp);
    arm.position.set(side * 1.3, 3.3, 0);
    return arm;
  };
  const armL = mkArm(-1), armR = mkArm(1);
  g.add(armL, armR);
  // piernas
  const legMat = toonMat(0x1f1f1f);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 1.1, 10), legMat);
    leg.position.set(s * 0.6, 0.55, 0);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 1.0), toonMat(0x111111));
    foot.position.set(s * 0.6, 0.11, 0.1);
    g.add(leg, foot);
  }
  g.userData = { armL, armR, torso, head };
  return g;
}
