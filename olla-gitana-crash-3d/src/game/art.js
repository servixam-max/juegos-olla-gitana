/* Arte procedimental: mallas low-poly con toon shading, personajes, cajas,
   coleccionables y atrezzo de los 3 mundos. Todo generado en código (sin assets). */
import * as THREE from 'three';

/* ---------- gradiente compartido para el toon ---------- */
let GRAD = null;
export function toonGradient() {
  if (GRAD) return GRAD;
  // Antes [90,150,205,255]: el primer escalón dejaba las zonas en sombra
  // casi NEGRAS, y en los niveles oscuros (Procesión, Casino) los enemigos y
  // jefes se veían como bloques negros (queja del usuario). Con el suelo en
  // 140 todas las caras conservan color y forma.
  const steps = new Uint8Array([140, 190, 225, 255]);
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
  // cejas expresivas (arco + punta) — mucho más "personaje"
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.06, 0.07), darkMat);
  const brow2 = brow.clone();
  brow.position.set(-0.175, 0.885, 0.575); brow.rotation.z = 0.30;
  brow2.position.set(0.175, 0.885, 0.575); brow2.rotation.z = -0.30;
  g.add(brow, brow2);
  const browTip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.06), darkMat);
  const browTip2 = browTip.clone();
  browTip.position.set(-0.275, 0.915, 0.5); browTip.rotation.z = 0.7;
  browTip2.position.set(0.275, 0.915, 0.5); browTip2.rotation.z = -0.7;
  g.add(browTip, browTip2);
  // chispita de luz en cada pupila (mirada viva)
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), shineMat);
  const shine2 = shine.clone();
  shine.position.set(-0.132, 0.719, 0.741);
  shine2.position.set(0.172, 0.719, 0.741);
  g.add(shine, shine2);
  // mejillas sonrosadas
  const blushMat = toonMat(0xff8fa5, { emissive: new THREE.Color(0x772233).multiplyScalar(0.35) });
  const blushL = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), blushMat);
  blushL.scale.set(1, 0.8, 0.45); blushL.position.set(-0.33, 0.56, 0.5); blushL.rotation.y = -0.52;
  const blushR = blushL.clone();
  blushR.position.set(0.33, 0.56, 0.5); blushR.rotation.y = 0.52;
  g.add(blushL, blushR);
  // bigote rumbero
  if (band) {
    const m1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.06), darkMat);
    const m2 = m1.clone();
    m1.position.set(-0.1, 0.5, 0.62); m1.rotation.z = 0.18;
    m2.position.set(0.1, 0.5, 0.62); m2.rotation.z = -0.18;
    // puntas del bigote: le dan el gesto rumbero
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 6), darkMat);
    tip.position.set(-0.22, 0.53, 0.6); tip.rotation.z = 1.05;
    const tip2 = tip.clone();
    tip2.position.set(0.22, 0.53, 0.6); tip2.rotation.z = -1.05;
    g.add(m1, m2, tip, tip2);
    // pañuelo de la banda: doble vuelta, lunares y nudo al costado
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.062, 6, 18), toonMat(PALETA.rojoOsc));
    scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.2;
    g.add(scarf);
    const scarf2 = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.045, 6, 18), toonMat(PALETA.crema));
    scarf2.rotation.x = Math.PI / 2; scarf2.position.y = 0.115;
    g.add(scarf2);
    // lunares del pañuelo
    const dotMat = toonMat(PALETA.crema);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.036, 6, 6), dotMat);
      d.position.set(Math.sin(a) * 0.42, 0.2, Math.cos(a) * 0.42);
      g.add(d);
    }
    // nudo lateral + colas al viento
    const knot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.1), toonMat(PALETA.rojo));
    knot.position.set(-0.42, 0.2, 0.06); knot.rotation.z = 0.4;
    const tailA = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.05), toonMat(PALETA.rojo));
    tailA.position.set(-0.5, 0.08, 0.12); tailA.rotation.z = 0.55;
    const tailB = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.05), toonMat(PALETA.rojoOsc));
    tailB.position.set(-0.52, 0.13, -0.02); tailB.rotation.z = 0.95;
    g.add(knot, tailA, tailB);
    // botones de la banda (como una chaquetilla): 3 dorados en el pecho
    const btnMat = new THREE.MeshBasicMaterial({ color: PALETA.dorado });
    const btnRing = toonMat(PALETA.maderaOsc);
    for (let i = 0; i < 3; i++) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 10), btnMat);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(0, 0.44 - i * 0.13, 0.62 + i * 0.012);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.014, 6, 12), btnRing);
      ring.position.set(0, 0.44 - i * 0.13, 0.625 + i * 0.012);
      g.add(btn, ring);
    }
  }
  // SIN sombrero (petición del usuario): se quiere ver la olla llena de
  // ingredientes desde arriba. El toque rockero lo dan el pañuelo, la cadena
  // y las gafas, no un sombrero tapando el guiso.
  // ---- olla LLENA DE INGREDIENTES (burbujea y se ve al saltar) ----
  // superficie del guiso (caldo espeso)
  const estofadoMat = toonMat(0xc4530e, { emissive: new THREE.Color(0x842800).multiplyScalar(0.35) });
  const guiso = new THREE.Mesh(new THREE.CircleGeometry(0.37, 20), estofadoMat);
  guiso.rotation.x = -Math.PI / 2; guiso.position.y = 1.005;
  g.add(guiso);
  // ingredientes flotando: pimiento, cebolla, tomate, garbanzos, laurel...
  const ingCols = [0xe63946, 0xf1c40f, 0x38b000, 0xff7b00, 0xb5651d, 0x9c6644];
  const ings = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const rr = i % 3 === 0 ? 0.06 : 0.2 + (i % 4) * 0.045;
    const im = new THREE.MeshBasicMaterial({ color: ingCols[i % ingCols.length] });
    let mesh;
    if (i % 3 === 0) mesh = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), im);            // garbanzo
    else if (i % 3 === 1) mesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.055, 0.09), im);    // trozo de pimiento
    else mesh = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.026, 5, 10), im);                  // anilla de cebolla
    mesh.position.set(Math.sin(a) * rr, 1.03 + (i % 2) * 0.02, Math.cos(a) * rr);
    mesh.rotation.set((i % 2) * 0.4, a, (i % 3) * 0.5);
    mesh.userData.baseY = mesh.position.y;
    mesh.userData.fase = Math.random() * 6.28;
    g.add(mesh);
    ings.push(mesh);
  }
  // hojita de laurel
  const laurel = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.13, 5), toonMat(0x2d6a1f));
  laurel.position.set(0.1, 1.05, -0.08); laurel.rotation.z = 1.2;
  g.add(laurel);
  // vapor del guiso (dos columnas suaves)
  const vapMat = new THREE.MeshBasicMaterial({ color: 0xfff5e1, transparent: true, opacity: 0.22, depthWrite: false });
  const vaporG = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const v = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), vapMat);
    v.position.set((i ? 0.12 : -0.1), 0.14 + i * 0.16, (i ? -0.05 : 0.04));
    v.scale.set(1, 1.25, 1);
    vaporG.add(v);
  }
  vaporG.position.y = 1.02;
  g.add(vaporG);
  g.userData.vapor = vaporG;
  g.userData.ings = ings;
  // toque ROCKERO: cadena dorada al cuello con colgante de púa de guitarra
  const chainMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.022, 5, 22, Math.PI * 1.15), chainMat);
  chain.rotation.x = Math.PI / 2 + 0.35; chain.rotation.z = -0.2;
  chain.position.set(0, 0.86, 0.14);
  g.add(chain);
  const pua = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 3), toonMat(PALETA.crema));
  pua.rotation.x = Math.PI; pua.position.set(0, 0.6, 0.66);
  g.add(pua);
  // gafas de sol de roquero (montura negra + cristal reflectante)
  if (band && !guitar) {
    const montMat = toonMat(0x141414);
    const cristalMat = new THREE.MeshBasicMaterial({ color: 0x2b3a55 });
    for (const s of [-1, 1]) {
      const lente = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.03), cristalMat);
      lente.position.set(s * 0.185, 0.7, 0.6);
      const montura = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.16, 0.02), montMat);
      montura.position.set(s * 0.185, 0.7, 0.585);
      const patilla = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.26), montMat);
      patilla.position.set(s * 0.33, 0.73, 0.48);
      g.add(montura, lente, patilla);
    }
    const puente = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.03), montMat);
    puente.position.set(0, 0.7, 0.6);
    g.add(puente);
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
    // contador de cuenta atrás (sprite sobre la caja): 3·2·1 visible al encenderse
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const tex = new THREE.CanvasTexture(cv);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(0.85, 0.85, 1);
    spr.position.set(0, 1.15, 0);
    spr.visible = false;
    spr.renderOrder = 998;
    g.add(spr);
    g.userData.countdown = { spr, cv, tex };
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

  // ---- torso: torre de altavoces apilados ----
  const torso = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 1.5), toonMat(0x2b2b2b));
  torso.position.y = 2.1;
  g.add(torso);
  // carcasa lateral (madera oscura) + listones de refuerzo
  const woodMat = toonMat(0x1c1410);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 1.5), woodMat);
    side.position.set(s * 1.14, 2.1, 0);
    g.add(side);
  }
  const braceMat = toonMat(0x4a4a4a);
  for (const y of [1.15, 3.05]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.12, 1.56), braceMat);
    brace.position.set(0, y, 0);
    g.add(brace);
  }
  // ---- altavoces apilados del pecho (clúster con borde plateado) ----
  const coneMat = toonMat(0x111111);
  const edgeMat = toonMat(0xd9dde2);
  const mkSpeakerUnit = (x, y, r, z = 0.8) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r, 0.3, 18), coneMat);
    c.rotation.x = Math.PI / 2; c.position.set(x, y, z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 8, 20), toonMat(PALETA.dorado));
    ring.position.set(x, y, z);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(r * 0.72, 0.05, 8, 20), edgeMat);
    inner.position.set(x, y, z + 0.07);
    const dust = new THREE.Mesh(new THREE.SphereGeometry(r * 0.26, 12, 10), toonMat(0x232323));
    dust.position.set(x, y, z + 0.1);
    g.add(c, ring, inner, dust);
  };
  mkSpeakerUnit(0, 2.2, 0.78);                 // el grande, en su sitio original
  mkSpeakerUnit(0, 3.12, 0.2, 0.72);           // tweeter arriba
  mkSpeakerUnit(0, 1.28, 0.2, 0.72);           // mid abajo
  for (const sx of [-1, 1]) {                  // 4 satélites alrededor del grande
    mkSpeakerUnit(sx * 0.8, 1.7, 0.22, 0.72);
    mkSpeakerUnit(sx * 0.8, 2.7, 0.22, 0.72);
  }
  // esquinas frontales atornilladas (detalle de mueble)
  const screwMat = toonMat(PALETA.metal);
  for (const sx of [-1, 1]) for (const sy of [0.98, 3.22]) {
    const screw = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), screwMat);
    screw.position.set(sx * 1.04, sy, 0.79);
    g.add(screw);
  }

  // ---- cabeza: pantalla con cara (ceño furioso) ----
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.2), toonMat(0x353535));
  head.position.y = 4.0;
  g.add(head);
  // marco de la pantalla + antena
  const frameMat = toonMat(0x141414);
  for (const s of [-1, 1]) {
    const pil = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 1.24), frameMat);
    pil.position.set(s * 0.78, 4.0, 0); g.add(pil);
  }
  const browBar = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.1, 1.24), frameMat);
  browBar.position.set(0, 4.58, 0); g.add(browBar);
  const chinBar = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.1, 1.24), frameMat);
  chinBar.position.set(0, 3.42, 0); g.add(chinBar);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 6), toonMat(0x6b6b6b));
  antenna.position.set(-0.55, 4.95, 0); g.add(antenna);
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: PALETA.rojo }));
  antennaTip.position.set(-0.55, 5.37, 0); g.add(antennaTip);

  // cara: ojos (con pupila que sigue mirando al frente) + cejas enojadas
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2e2e });
  const eyeL = new THREE.Mesh(new THREE.CircleGeometry(0.19, 14), eyeMat);
  const eyeR = eyeL.clone();
  eyeL.position.set(-0.34, 4.14, 0.62); eyeR.position.set(0.34, 4.14, 0.62);
  g.add(eyeL, eyeR);
  // pupilas móviles: siguen al jugador (las mueve boss.js vía userData.pupila)
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x3a0000 });
  const pupL = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), pupilMat);
  const pupR = pupL.clone();
  pupL.position.set(-0.34, 4.14, 0.63); pupR.position.set(0.34, 4.14, 0.63);
  g.add(pupL, pupR);
  const angMat = new THREE.MeshBasicMaterial({ color: 0x7a0c0c });
  const browL = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.07, 0.04), angMat);
  const browR = browL.clone();
  browL.position.set(-0.34, 4.36, 0.62); browL.rotation.z = -0.42;   // ceño: las puntas caen hacia la nariz
  browR.position.set(0.34, 4.36, 0.62); browR.rotation.z = 0.42;
  g.add(browL, browR);
  // boca: rejilla de ampli (líneas verticales) en vez del bloque liso
  const mouthMat = toonMat(0xffbe0b);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.16, 0.08), mouthMat);
  mouth.position.set(0, 3.72, 0.62);
  g.add(mouth);
  for (let i = 0; i < 6; i++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), toonMat(0x2b2b2b));
    tooth.position.set(-0.3 + i * 0.12, 3.72, 0.65);
    g.add(tooth);
  }
  // ---- ojo LED central: brilla en el centro del altavoz grande y parpadea ----
  // (delante de la tapa antipolvo: z=1.14 > 1.10 = superficie de la tapa)
  const ledEyeMat = new THREE.MeshBasicMaterial({ color: 0x4cc9f0 });
  const ledEye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), ledEyeMat);
  ledEye.position.set(0, 2.2, 1.14);
  ledEye.scale.set(1, 1, 0.55);
  g.add(ledEye);
  const ledEyeRing = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 6, 18), toonMat(0x222222));
  ledEyeRing.position.set(0, 2.2, 1.14);
  g.add(ledEyeRing);

  // ---- brazos con altavoces ----
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

  // ---- cables entre altavoces (serpentean por la torre) ----
  const cableMat = toonMat(0x101010);
  const mkCable = (pts, r = 0.05) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 16, r, 6, false), cableMat);
  };
  g.add(mkCable([[1.12, 3.4, 0.55], [1.35, 2.8, 0.8], [1.1, 2.2, 1.0], [1.25, 1.5, 0.6], [1.1, 0.9, 0.2]]));
  g.add(mkCable([[-1.12, 3.5, 0.5], [-1.4, 3.0, 0.9], [-1.15, 2.4, 1.05], [-1.3, 1.8, 0.5]]));
  g.add(mkCable([[-0.9, 4.45, -0.55], [-1.2, 4.1, -0.85], [-0.6, 3.7, -0.9], [0.2, 3.4, -0.7]]));
  // clavijas de conexión
  const plugMat = toonMat(0xff70a6);
  for (let i = 0; i < 3; i++) {
    const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8), plugMat);
    plug.rotation.z = Math.PI / 2;
    plug.position.set(-1.05, 3.3 - i * 0.22, 0.62);
    g.add(plug);
  }

  // ---- piernas ----
  const legMat = toonMat(0x1f1f1f);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 1.1, 10), legMat);
    leg.position.set(s * 0.6, 0.55, 0);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 1.0), toonMat(0x111111));
    foot.position.set(s * 0.6, 0.11, 0.1);
    g.add(leg, foot);
  }

  // ---- respiraderos laterales (rejillas del mueble) ----
  const ventMat = toonMat(0x4a4a4a);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const vet = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 1.1), ventMat);
      vet.position.set(s * 1.21, 1.6 + i * 0.18, 0);
      g.add(vet);
    }
  }
  // ---- pilas/batería de la parte baja: indicador de vida (color por boss.js) ----
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x4cc9f0 });
  const ledVida = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), ledMat);
  ledVida.position.set(0, 0.86, 0.79);
  const ledVidaRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 14), toonMat(0x141414));
  ledVidaRing.position.set(0, 0.86, 0.79);
  g.add(ledVida, ledVidaRing);
  // ---- corazones de vida (se apagan al recibir daño; los toca boss.js) ----
  const corazones = [];
  for (let i = 0; i < 3; i++) {
    const cv = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2e2e }));
    cv.scale.set(1, 0.85, 0.55);
    const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.082, 8, 6), cv.material);
    c1.position.set(-0.072, 0.078, 0);
    const c2 = c1.clone(); c2.position.x = 0.072;
    const punta = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), cv.material);
    punta.rotation.x = Math.PI; punta.position.y = -0.105;
    cv.add(c1, c2, punta);
    cv.position.set(-0.85 + i * 0.85, 4.78, 0.62);
    cv.scale.multiplyScalar(0.85);
    g.add(cv);
    corazones.push(cv);
  }

  // ---- parpadeo del ojo LED (solo visual, no toca update()) ----
  const blink = () => {
    const cyc = performance.now() * 0.001 % 4.2;
    const off = cyc < 0.16;
    ledEye.scale.y = off ? 0.06 : 0.4 + Math.sin(performance.now() * 0.004) * 0.06;
    ledEyeMat.color.setHex(off ? 0x123a4a : (Math.floor(performance.now() * 0.004) % 2 ? 0x4cc9f0 : 0x2aa8d8));
    ledEyeRing.rotation.z += 0.001;
  };
  ledEye.onBeforeRender = blink;

  g.userData = { armL, armR, torso, head, ledEye, browL, browR, antennaTip, pupL, pupR, ledVida, corazones };
  return g;
}
