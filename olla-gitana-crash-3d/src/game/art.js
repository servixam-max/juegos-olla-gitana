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

  // ===== CARA SIMPLE estilo Mario (rediseño pedido por el usuario) =====
  // Antes: cejas de 4 piezas + pestañas + chispas + mejillas + gafas = ruido.
  // Ahora: ojos con pupila, bigote con puntas, lengua/boquita. Nada más.
  const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.165, 12, 10), toonMat(0xffffff));
  const eyeW2 = eyeW.clone();
  eyeW.position.set(-0.175, 0.70, 0.545); eyeW2.position.set(0.175, 0.70, 0.545);
  g.add(eyeW, eyeW2);
  const pup = new THREE.Mesh(new THREE.SphereGeometry(0.082, 10, 8), darkMat);
  const pup2 = pup.clone();
  pup.position.set(-0.16, 0.70, 0.675); pup2.position.set(0.19, 0.70, 0.675);
  g.add(pup, pup2);
  // chispita de luz (una sola, simple)
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 6), shineMat);
  const shine2 = shine.clone();
  shine.position.set(-0.135, 0.745, 0.735);
  shine2.position.set(0.215, 0.745, 0.735);
  g.add(shine, shine2);
  // naricilla
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), toonMat(0xa8341f));
  nose.scale.set(1.15, 0.85, 0.9);
  nose.position.set(0, 0.585, 0.66);
  g.add(nose);
  // boca sonriente (media luna bajo el bigote) — pequeña y sutil, para que el
  // bigote y los ojos sigan siendo los protagonistas (petición: cara simple)
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.03, 6, 14, Math.PI), toonMat(0x3b1a12));
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, 0.468, 0.662);
  g.add(mouth);
  // bigote rumbero GRANDE y claro (seña de identidad, estilo Mario)
  if (band) {
    const m1 = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 8), darkMat);
    m1.scale.set(1.35, 0.5, 0.5);
    m1.position.set(-0.115, 0.525, 0.63);
    const m2 = m1.clone();
    m2.position.set(0.115, 0.525, 0.63);
    // puntas enroscadas hacia arriba (bucle)
    const tip = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.032, 6, 12, Math.PI * 1.3), darkMat);
    tip.position.set(-0.29, 0.565, 0.62); tip.rotation.z = 0.5;
    const tip2 = new THREE.Mesh(tip.geometry, darkMat);
    tip2.position.set(0.29, 0.565, 0.62); tip2.rotation.z = Math.PI - 0.5; tip2.rotation.y = Math.PI;
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
    // botones del pecho: RETIRADOS (limpieza del personaje pedida por el
    // usuario: "sigue habiendo algún detalle más que no se ha quitado").
    // La cara simple + el pañuelo + el puro bastan como identidad.
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
  // RETIRADOS (petición del usuario: "sigue habiendo algún detalle más del
  // personaje que no se ha quitado"). Con la cara simple, la cadena y la púa
  // añadían ruido sobre el pecho. Se quedan detrás de un flag.
  if (typeof window !== 'undefined' && window.__OG3D_ROCKERO === 1) {
    const chainMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.022, 5, 22, Math.PI * 1.15), chainMat);
    chain.rotation.x = Math.PI / 2 + 0.35; chain.rotation.z = -0.2;
    chain.position.set(0, 0.86, 0.14);
    g.add(chain);
    const pua = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 3), toonMat(PALETA.crema));
    pua.rotation.x = Math.PI; pua.position.set(0, 0.6, 0.66);
    g.add(pua);
  }
  /* El PURO de la boca lo coloca MaskCompanion (mask.js) cuando el jugador
     consigue 2 puros: vuela, se pone en la boca y enciende el humo. Aquí no
     se modela nada para no duplicarlo. */
  // gafas de sol de roquero: RETIRADAS (petición del usuario: "la cara se queda
  // rara, quiero algo más simple"). Las gafas tapaban los ojos y el bigote, que
  // son los rasgos que identifican al personaje. Se mantiene la cadena y la púa.
  // (Se deja el bloque detrás de un flag por si se quiere recuperar en el futuro.)
  if (band && !guitar && typeof window !== 'undefined' && window.__OG3D_GAFAS === 1) {
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
  else if (type === 'arrow') { faceColor = 0xfff5e1; edgeColor = PALETA.maderaOsc; label = '▲'; }
  else if (type === 'outline') { faceColor = 0xfff5e1; edgeColor = 0xa89b7a; }

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

/* PURO volador (sustituye a la máscara, petición del usuario):
   un cigarro puro con anilla dorada, brasa encendida y humo. Vuela flotando
   y se balancea; al cogerlo la olla se lo pone en la boca y suelta una
   bocanada de humo. Con 2 puros: invulnerable 30 s, más rápido y salta más. */
export function makePuro() {
  const g = new THREE.Group();
  const cuerpoMat = toonMat(0x6b4423);          // capa marrón tabaco
  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.105, 0.62, 12), cuerpoMat);
  cuerpo.rotation.z = Math.PI / 2 - 0.22;        // ligeramente inclinado
  g.add(cuerpo);
  // anilla dorada de la vitola
  const anilla = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.022, 6, 14), toonMat(PALETA.dorado));
  anilla.rotation.y = Math.PI / 2 - 0.22;
  anilla.position.set(0.1, 0.02, 0);
  g.add(anilla);
  // brasa encendida (brilla sola: se ve en los niveles oscuros)
  const brasa = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.06, 12),
    new THREE.MeshBasicMaterial({ color: 0xff5a2b }));
  brasa.rotation.z = Math.PI / 2 - 0.22;
  brasa.position.set(-0.32, 0.07, 0);
  g.add(brasa);
  // punta quemada (ceniza)
  const ceniza = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.08, 0.05, 12), toonMat(0x2a2a2a));
  ceniza.rotation.z = Math.PI / 2 - 0.22;
  ceniza.position.set(-0.36, 0.08, 0);
  g.add(ceniza);
  // humo: 3 bolas translúcidas que suben
  const humoMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.35, depthWrite: false });
  const humo = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.075 + i * 0.02, 8, 6), humoMat);
    b.position.set(-0.44 - i * 0.1, 0.14 + i * 0.1, 0);
    humo.add(b);
  }
  g.add(humo);
  g.userData.humo = humo;
  // aura de premio (se ve de lejos, como la de las notas)
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.028, 6, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.5 }));
  halo.rotation.x = Math.PI / 2; halo.position.y = -0.02;
  g.add(halo);
  g.userData.halo = halo;
  g.scale.setScalar(1.25);
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

/* ---------- sonidos nuevos de las mecánicas Crash (van aquí para no tocar
   audio.js: se registran con el sfx('ui') del motor y se REEMPLAZAN por un
   tono propio). Regla del proyecto: los aciertos NUNCA usan hit.mp3. ---------- */
function pito(engine, { type = 'triangle', f0 = 660, f1 = f0, dur = 0.12, vol = 0.14, delay = 0 }) {
  try { engine.tone({ type, f0, f1, dur, vol, delay }); } catch (_) { /* motor sin audio listo */ }
}
export function sfxMecanicas(engine, name) {
  switch (name) {
    /* MUELLE de la caja flecha: \"boing\" ascendente largo (rebote MUY alto) */
    case 'arrow':
      pito(engine, { type: 'triangle', f0: 420, f1: 1500, dur: 0.24, vol: 0.2 });
      pito(engine, { type: 'sine', f0: 1500, f1: 640, dur: 0.3, vol: 0.13, delay: 0.14 });
      break;
    /* la plataforma se agrieta al pisarla */
    case 'crujido': pito(engine, { type: 'sawtooth', f0: 220, f1: 90, dur: 0.16, vol: 0.12 }); break;
    /* la plataforma se desploma */
    case 'derrumb': {
      pito(engine, { type: 'sine', f0: 170, f1: 52, dur: 0.42, vol: 0.24 });
      pito(engine, { type: 'square', f0: 120, f1: 46, dur: 0.3, vol: 0.12, delay: 0.04 });
      break;
    }
    /* barril rodando: retumbo grave mientras avanza */
    case 'rodar': pito(engine, { type: 'sawtooth', f0: 92, f1: 148, dur: 0.22, vol: 0.1, delay: 0.02 }); break;
    /* el barril se estrella */
    case 'barril': {
      pito(engine, { type: 'sine', f0: 130, f1: 60, dur: 0.3, vol: 0.2 });
      pito(engine, { type: 'triangle', f0: 520, f1: 170, dur: 0.22, vol: 0.11, delay: 0.03 });
      break;
    }
    /* ¡SORPRESA! la zona secreta se revela */
    case 'secreto': [659, 880, 1046, 1319].forEach((f, i) => pito(engine, { type: 'triangle', f0: f, dur: 0.2, vol: 0.15, delay: i * 0.075 })); break;
    /* la caja de contorno se materializa */
    case 'materializa': pito(engine, { type: 'triangle', f0: 300, f1: 1200, dur: 0.2, vol: 0.14 }); pito(engine, { type: 'sine', f0: 1760, dur: 0.3, vol: 0.08, delay: 0.16 }); break;
    /* ===== enemigos v3 (el sistema de enemies.js los pide por su nombre) ===== */
    /* toro: resoplido de aviso ANTES de embestir (telegrafía sonora) */
    case 'toro_aviso':
      pito(engine, { type: 'sawtooth', f0: 132, f1: 86, dur: 0.34, vol: 0.16, filter: 900 });
      pito(engine, { type: 'square', f0: 96, f1: 62, dur: 0.28, vol: 0.1, delay: 0.17 });
      break;
    /* toro: mugido grave al arrancar la embestida */
    case 'toro_embiste':
      pito(engine, { type: 'sawtooth', f0: 240, f1: 68, dur: 0.5, vol: 0.22, filter: 800 });
      pito(engine, { type: 'square', f0: 112, f1: 54, dur: 0.42, vol: 0.13, delay: 0.03 });
      break;
    /* toro: choque contra el muro (se aturde) + estrellitas */
    case 'toro_trompa':
      pito(engine, { type: 'sine', f0: 190, f1: 46, dur: 0.34, vol: 0.26 });
      pito(engine, { type: 'triangle', f0: 1250, f1: 480, dur: 0.2, vol: 0.12, delay: 0.05 });
      break;
    /* globo del planeador: silbido descendente mientras apunta */
    case 'globo_aviso':
      pito(engine, { type: 'sine', f0: 1900, f1: 880, dur: 0.3, vol: 0.1 });
      pito(engine, { type: 'sine', f0: 1420, f1: 660, dur: 0.24, vol: 0.08, delay: 0.16 });
      break;
    /* el planeador suelta la gota */
    case 'globo_dispara': pito(engine, { type: 'triangle', f0: 920, f1: 300, dur: 0.16, vol: 0.14 }); break;
    /* la gota revienta en el suelo */
    case 'globo_pop':
      pito(engine, { type: 'square', f0: 700, f1: 170, dur: 0.12, vol: 0.16 });
      pito(engine, { type: 'triangle', f0: 1600, f1: 620, dur: 0.16, vol: 0.1, delay: 0.03 });
      break;
    /* acorazado: la chapa metálica rebota (pisotón inútil) */
    case 'coraza':
      pito(engine, { type: 'square', f0: 330, f1: 175, dur: 0.1, vol: 0.14 });
      pito(engine, { type: 'sine', f0: 1450, dur: 0.28, vol: 0.07, delay: 0.02 });
      break;
    /* acorazado destrozado: la chapa vuela (solo el giro lo rompe) */
    case 'coraza_rota':
      pito(engine, { type: 'sawtooth', f0: 480, f1: 86, dur: 0.4, vol: 0.2, filter: 1700 });
      pito(engine, { type: 'triangle', f0: 1320, f1: 420, dur: 0.3, vol: 0.12, delay: 0.04 });
      pito(engine, { type: 'sine', f0: 120, f1: 58, dur: 0.3, vol: 0.16, delay: 0.1 });
      break;
    /* bicho reventado con el giro: el "pop" genérico de muerte */
    case 'bicho_pop':
      pito(engine, { type: 'triangle', f0: 640, f1: 170, dur: 0.18, vol: 0.18 });
      pito(engine, { type: 'sine', f0: 180, f1: 68, dur: 0.24, vol: 0.14, delay: 0.03 });
      break;
    default: break;
  }
}


/* Barril RODANTE (mecánica Crash): barril tumbado que rueda por el pasillo
   hacia el jugador. Se lee como peligro a primera vista: duelas de madera,
   aros metálicos y una franja roja de aviso en el centro. */
export function makeBarrelRodante({ color = PALETA.madera } = {}) {
  const g = new THREE.Group();
  const mat = toonMat(color);
  const matOsc = toonMat(PALETA.maderaOsc);
  // cuerpo tumbado (eje X): rueda girando sobre x
  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.05, 14), mat);
  cuerpo.rotation.z = Math.PI / 2;
  cuerpo.position.y = 0.62;
  g.add(cuerpo);
  // aros metálicos
  for (const x of [-0.34, 0.34]) {
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.63, 0.06, 6, 16), matOsc);
    aro.rotation.y = Math.PI / 2;
    aro.position.set(x, 0.62, 0);
    g.add(aro);
  }
  // franja roja de aviso (centro) + remaches: peligro evidente
  const franja = new THREE.Mesh(new THREE.CylinderGeometry(0.635, 0.635, 0.2, 14), toonMat(PALETA.rojo));
  franja.rotation.z = Math.PI / 2;
  franja.position.y = 0.62;
  g.add(franja);
  for (const s of [-1, 1]) {
    const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
    ojo.position.set(s * 0.53, 0.95, 0.18);
    g.add(ojo);
  }
  g.userData.type = 'rodante';
  return g;
}

/* Caja FLECHA (arrow crate, Crash clásico): flecha amarilla hacia arriba.
   Al pisarla rebota MUY alto (no se rompe con el pisotón; sí con el giro).
   Sirve para alcanzar zonas altas y rutas secretas. */
export function makeArrowCrate() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.92, 0.92), toonMat(PALETA.crema));
  g.add(body);
  // marco de madera
  const plank = toonMat(PALETA.maderaOsc);
  const bar = new THREE.BoxGeometry(1.0, 0.13, 0.13);
  for (const y of [-0.46, 0.46]) for (const z of [-0.47, 0.47]) g.add(mesh(bar, plank, 0, y, z));
  // flecha hacia arriba en las 4 caras
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, 256, 256);
  c.fillStyle = '#ffbe0b';
  c.strokeStyle = 'rgba(0,0,0,.55)';
  c.lineWidth = 12;
  c.beginPath();                       // punta
  c.moveTo(128, 34); c.lineTo(206, 118); c.lineTo(160, 118);
  c.lineTo(160, 224); c.lineTo(96, 224); c.lineTo(96, 118); c.lineTo(50, 118);
  c.closePath(); c.fill(); c.stroke();
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const plano = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.76), mat);
  plano.position.z = 0.475; g.add(plano);
  const p2 = plano.clone(); p2.position.z = -0.475; p2.rotation.y = Math.PI; g.add(p2);
  const p3 = plano.clone(); p3.rotation.y = Math.PI / 2; p3.position.set(0.475, 0, 0); g.add(p3);
  const p4 = plano.clone(); p4.rotation.y = -Math.PI / 2; p4.position.set(-0.475, 0, 0); g.add(p4);
  // halo dorado: se ve desde lejos (pista visual del rebote)
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.045, 6, 20),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.5 })
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.05;
  g.add(halo);
  g.userData.halo = halo;
  g.userData.type = 'arrow';
  return g;
}

/* Caja CONTORNO (outline crate, Crash clásico): solo el contorno, NO es sólida
   hasta que el jugador pulsa una caja '!' cercana. Entonces se materializa
   (madera de verdad). Es la llave de las rutas secretas. */
export function makeOutlineCrate() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.3, wireframe: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.92, 0.92), mat);
  g.add(body);
  // esquinas marcadas para que se lea como caja fantasma
  const esq = new THREE.MeshBasicMaterial({ color: 0xfff5e1, transparent: true, opacity: 0.85 });
  const s = 0.14;
  for (const x of [-0.4, 0.4]) for (const y of [-0.4, 0.4]) for (const z of [-0.4, 0.4]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), esq);
    c.position.set(x, y, z);
    g.add(c);
  }
  g.userData.ghostMat = mat;
  g.userData.type = 'outline';
  return g;
}

/* Plataforma que SE DESMORONA (mecánica Crash): tabla de madera agrietada que
   tiembla al pisarla y se desploma. Lleva marcas de grieta visibles. */
export function makePlataformaRuina() {
  const g = new THREE.Group();
  const tablon = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), toonMat(0x8a6a3f));
  g.add(tablon);
  // grietas (líneas oscuras cruzando la cara superior)
  for (const [x, z, ry] of [[-0.18, 0, 0.5], [0.2, -0.12, -0.4], [0.04, 0.22, 1.1]]) {
    const gr = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.7), toonMat(0x2b1a08));
    gr.position.set(x, 0.505, z);
    gr.rotation.y = ry;
    g.add(gr);
  }
  // tablones laterales más oscuros (se ve la estructura de la tabla)
  const osc = toonMat(PALETA.maderaOsc);
  for (const z of [-0.5, 0.5]) g.add(mesh(new THREE.BoxGeometry(1.02, 0.14, 0.05), osc, 0, 0.42, z));
  // marca de aviso (X roja) en la cara superior: se cae
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.strokeStyle = '#e63946'; c.lineWidth = 14; c.lineCap = 'round';
  c.beginPath(); c.moveTo(28, 28); c.lineTo(100, 100); c.moveTo(100, 28); c.lineTo(28, 100); c.stroke();
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const marca = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), mat);
  marca.rotation.x = -Math.PI / 2;
  marca.position.y = 0.506;
  g.add(marca);
  g.userData.type = 'ruina';
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
  // halo suave alrededor de la bombilla: la farola "brilla" de noche sin coste
  // de luces reales (una esfera transparente aditiva, no afecta al rendimiento)
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.15, depthWrite: false })
  );
  halo.position.copy(bulb.position);
  g.add(pole, arm, head, bulb, halo);
  g.userData.bulb = bulb;
  g.userData.halo = halo;
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

/* =========================================================
   ATRREZZO NUEVO (solo visual; las colisiones viven en levels*.js)
   Se añaden al final para no tocar las firmas existentes.
   ========================================================= */

/* Botijo murciano: la pieza de alfarería más típica de la huerta. */
export function makeBotijo({ color = 0xc4530e, scale = 1 } = {}) {
  const g = new THREE.Group();
  const barro = toonMat(color);
  const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), barro);
  cuerpo.scale.set(1, 0.95, 0.86); cuerpo.position.y = 0.34;
  const boca = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.16, 10), barro);
  boca.position.set(0, 0.62, 0.02);
  const asa = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 6, 12, Math.PI), barro);
  asa.position.set(0, 0.56, -0.2); asa.rotation.x = Math.PI * 0.5;
  const pitorro = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.22, 8), barro);
  pitorro.position.set(0.2, 0.44, 0.18); pitorro.rotation.z = -0.9; pitorro.rotation.x = 0.4;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.07, 12), toonMat(0x7c4519));
  base.position.y = 0.03;
  // cenefa pintada (toque de alfarería tradicional)
  const cenefa = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.022, 6, 16), toonMat(PALETA.dorado));
  cenefa.rotation.x = Math.PI / 2; cenefa.position.y = 0.44;
  g.add(base, cuerpo, boca, asa, pitorro, cenefa);
  g.scale.setScalar(scale);
  return g;
}

/* Olivo de la huerta: tronco retorcido + copa plateada (no un árbol genérico). */
export function makeOlivo({ scale = 1 } = {}) {
  const g = new THREE.Group();
  const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 1.3, 7), toonMat(0x8a6a4a));
  tronco.position.y = 0.65;
  const tronco2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.6, 6), toonMat(0x7a5c3e));
  tronco2.position.set(0.12, 1.5, 0.06); tronco2.rotation.z = 0.35;
  g.add(tronco, tronco2);
  const copa = toonMat(0x8fb573);
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.34 + Math.random() * 0.16, 9, 7), copa);
    s.position.set((Math.random() - 0.5) * 0.7, 1.8 + Math.random() * 0.5, (Math.random() - 0.5) * 0.7);
    s.scale.set(1, 0.82, 1);
    g.add(s);
  }
  g.scale.setScalar(scale);
  return g;
}

/* Ciprés: el árbol alto y estrecho de las procesiones. */
export function makeCipres({ h = 3.2 } = {}) {
  const g = new THREE.Group();
  const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.5, 6), toonMat(0x3b2a12));
  tronco.position.y = 0.25;
  const copaMat = toonMat(0x25551c);
  const copa = new THREE.Mesh(new THREE.ConeGeometry(0.42, h, 9), copaMat);
  copa.position.y = 0.5 + h / 2;
  const copa2 = new THREE.Mesh(new THREE.ConeGeometry(0.3, h * 0.6, 8), toonMat(0x2d6a1f));
  copa2.position.y = 0.7 + h * 0.78;
  g.add(tronco, copa, copa2);
  return g;
}

/* Caseta de feria: puesto de churros con toldo, mostrador y letrero. */
export function makeCaseta({ text = 'CHURROS', color = PALETA.rojo } = {}) {
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 1.5), toonMat(PALETA.crema));
  cuerpo.position.y = 0.75;
  const marco = toonMat(color);
  for (const s of [-1, 1]) {
    const pilar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 0.16), marco);
    pilar.position.set(s * 1.06, 0.75, 0.72);
    g.add(pilar);
  }
  const mostrador = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.14, 0.7), toonMat(PALETA.madera));
  mostrador.position.set(0, 0.95, 0.85);
  const tapa = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.1, 1.6), toonMat(color));
  tapa.position.set(0, 1.52, 0.05);
  // rayas del toldo
  for (let i = 0; i < 5; i++) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 1.62), toonMat(PALETA.crema));
    r.position.set(-0.88 + i * 0.44, 1.54, 0.05);
    g.add(r);
  }
  // letrero pintado (canvas)
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 96;
  const c = cv.getContext('2d');
  c.fillStyle = '#e63946'; c.fillRect(0, 0, 256, 96);
  c.strokeStyle = '#ffbe0b'; c.lineWidth = 8; c.strokeRect(6, 6, 244, 84);
  c.font = '900 44px "Luckiest Guy", Nunito, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#fff5e1';
  c.fillText(text.slice(0, 9), 128, 52);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const rotulo = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.64), new THREE.MeshBasicMaterial({ map: tex }));
  rotulo.position.set(0, 1.1, 0.78);
  g.add(cuerpo, mostrador, tapa, rotulo);
  return g;
}

/* Cadena de luces de fiesta: cable curvado con bombillas de colores. */
export function makeCadenaLuces({ span = 7, n = 11, colors = [PALETA.dorado, PALETA.rojo, PALETA.azul, PALETA.verde, PALETA.rosa] } = {}) {
  const g = new THREE.Group();
  const bombillaMat = (i) => new THREE.MeshBasicMaterial({ color: colors[i % colors.length] });
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const x = -span / 2 + (i / n) * span;
    const y = -Math.sin((i / n) * Math.PI) * 0.5;
    if (prev) {
      const [x0, y0] = prev;
      const len = Math.hypot(x - x0, y - y0);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 5), toonMat(0x2b2b2b));
      cable.position.set((x0 + x) / 2, (y0 + y) / 2, 0);
      cable.rotation.z = Math.PI / 2 - Math.atan2(y - y0, x - x0);
      g.add(cable);
    }
    prev = [x, y];
    if (i < n) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), bombillaMat(i));
      b.position.set(x + span / (n * 2), y - 0.09, 0);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0.16, depthWrite: false }));
      halo.position.copy(b.position);
      g.add(b, halo);
    }
  }
  return g;
}

/* Fuente de la plaza (agua animada por el juego vía userData.water) */
export function makeFuente({ r = 1.5 } = {}) {
  const g = new THREE.Group();
  const pila = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, 0.5, 16), toonMat(0x9aa5b1));
  pila.position.y = 0.25;
  const borde = new THREE.Mesh(new THREE.TorusGeometry(r, 0.08, 6, 20), toonMat(0x6b7280));
  borde.rotation.x = Math.PI / 2; borde.position.y = 0.52;
  const columna = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.1, 10), toonMat(0x8b95a1));
  columna.position.y = 1.05;
  const taza = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 0.18, 14), toonMat(0x9aa5b1));
  taza.position.y = 1.66;
  const aguaMat = new THREE.MeshBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: 0.7 });
  const agua = new THREE.Mesh(new THREE.CircleGeometry(r - 0.12, 18), aguaMat);
  agua.rotation.x = -Math.PI / 2; agua.position.y = 0.53;   // por encima del borde de la pila
  const chorro = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.5, 4, 8), aguaMat);
  chorro.position.y = 1.32;
  g.add(pila, borde, columna, taza, agua, chorro);
  g.userData.water = agua;
  g.userData.chorro = chorro;
  return g;
}

/* =========================================================
   ENEMIGOS v3 (arte) — los 3 BICHOS NUEVOS con identidad murciana
   Cada uno lleva la BANDERA DE ESPAÑA (el usuario quiere que "se noten
   que son enemigos") y una CARA RARA propia. El sistema de enemies.js
   anima las piezas que se exponen por userData.
   ========================================================= */

/* ---------- TORO BRAVO "El Pimiento" ----------
   Bicho cuadrúpedo rojo con cuernos, bandera atada a la cola y una CARA
   muy avisada: se agacha (telegrafía) y luego embiste en línea recta. Al
   chocar contra un muro SE ATURDE (estrellitas) — contrajuego justo. */
export function makeToroBravo({ color = 0xb31217 } = {}) {
  const g = new THREE.Group();
  const mat = toonMat(color, { emissive: new THREE.Color(color).multiplyScalar(0.14) });
  const osc = toonMat(0x2a0d0d);
  // cuerpo alargado
  const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 12), mat);
  cuerpo.scale.set(1, 0.85, 1.5);
  cuerpo.position.y = 0.82;
  g.add(cuerpo);
  // joroba + panza clara
  const joroba = new THREE.Mesh(new THREE.SphereGeometry(0.44, 12, 10), mat);
  joroba.scale.set(0.9, 0.7, 1.1); joroba.position.set(0, 1.24, -0.18);
  const panza = new THREE.Mesh(new THREE.SphereGeometry(0.44, 12, 10), toonMat(0xf6e7c9));
  panza.scale.set(1, 0.6, 1.2); panza.position.set(0, 0.6, 0.1);
  g.add(joroba, panza);
  // cabeza ancha que SIEMPRE mira al frente (la mueve el sistema)
  const cabeza = new THREE.Group();
  const morro = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), mat);
  morro.scale.set(1.05, 0.9, 1.1);
  const hocico = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), toonMat(0xe9b8b8));
  hocico.scale.set(1, 0.8, 0.9); hocico.position.set(0, -0.12, 0.3);
  cabeza.add(morro, hocico);
  // ojos saltones furiosos (blancos con pupila; se ven de lejos)
  for (const s of [-1, 1]) {
    const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff8e7 }));
    ojo.position.set(s * 0.2, 0.14, 0.3);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.062, 8, 6), new THREE.MeshBasicMaterial({ color: 0x140404 }));
    pup.position.set(s * 0.235, 0.13, 0.4);
    cabeza.add(ojo, pup);
  }
  // ceño de mala leche
  for (const s of [-1, 1]) {
    const ceja = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.07), osc);
    ceja.position.set(s * 0.2, 0.3, 0.32); ceja.rotation.z = -s * 0.5;
    cabeza.add(ceja);
  }
  // cuernos de verdad (avisan del peligro) + orejas
  for (const s of [-1, 1]) {
    const cuerno = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.46, 7), toonMat(0xfff1c0));
    cuerno.position.set(s * 0.34, 0.32, 0.06); cuerno.rotation.z = s * 1.15; cuerno.rotation.x = -0.25;
    const oreja = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 6), mat);
    oreja.position.set(s * 0.42, 0.14, -0.14); oreja.rotation.z = s * 1.5;
    cabeza.add(cuerno, oreja);
  }
  cabeza.position.set(0, 0.86, 0.92);
  g.add(cabeza);
  // anillo de la nariz (bélico, se lee "toro") + vaho que sale al resoplar
  const anilla = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 5, 12), toonMat(0xffbe0b));
  anilla.position.set(0, -0.08, 0.52);
  cabeza.add(anilla);
  const vaho = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
  vaho.position.set(0, -0.12, 0.68); vaho.scale.set(1, 0.7, 1.4);
  cabeza.add(vaho);
  // 4 patas (trotan)
  const patas = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pata = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.34, 4, 7), osc);
    pata.position.set(sx * 0.32, 0.32, sz * 0.42);
    pata.geometry.translate(0, -0.2, 0);
    g.add(pata);
    patas.push(pata);
  }
  // cola con borla
  const cola = new THREE.Group();
  const rabo = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.7, 6), osc);
  rabo.position.y = -0.28;
  const borla = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), osc);
  borla.position.y = -0.62;
  cola.add(rabo, borla);
  cola.position.set(0, 1.06, -0.9); cola.rotation.x = 0.45;
  g.add(cola);
  // BANDERA DE ESPAÑA atada a la cola (identidad de la banda)
  const bandera = new THREE.Group();
  const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), toonMat(0x8a6a3a));
  mastil.position.y = 0.35;
  bandera.add(mastil);
  const tela = new THREE.Group();
  const hR = 0.065, hY = 0.12;
  const r1 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, hR), new THREE.MeshBasicMaterial({ color: 0xc60b1e, side: THREE.DoubleSide }));
  r1.position.y = hY + hR / 2;
  const am = new THREE.Mesh(new THREE.PlaneGeometry(0.3, hY), new THREE.MeshBasicMaterial({ color: 0xffc400, side: THREE.DoubleSide }));
  const r2 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, hR), new THREE.MeshBasicMaterial({ color: 0xc60b1e, side: THREE.DoubleSide }));
  r2.position.y = -hY - hR / 2;
  tela.add(r1, am, r2); tela.position.set(0, 0.72, 0);
  bandera.add(tela);
  bandera.position.copy(cola.position); bandera.position.y += 0.1;
  g.add(bandera);
  g.userData = { cuerpo, cabeza, patas, cola, bandera, tela, vaho, anilla };
  return g;
}

/* ---------- GLOBO-PLANEADOR "La Gota Fría" ----------
   Bicho con globo (¡la gota fría murciana!), alas de planeo, bandera y una
   boca-vertedero por la que suelta gotas. Avisa (globo rojo pulsando) antes
   de soltar: lo que cae es una gota que salpica abajo (esquivable). */
export function makeGloboPlaneador({ color = 0x1b7f79 } = {}) {
  const g = new THREE.Group();
  const mat = toonMat(color, { emissive: new THREE.Color(color).multiplyScalar(0.18) });
  const osc = toonMat(0x10201f);
  // CUERPO: pimiento/bicho rechoncho que cuelga del globo
  const cuerpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.3, 5, 12), mat);
  cuerpo.position.y = 1.28;
  cuerpo.scale.set(1, 1, 0.85);
  g.add(cuerpo);
  // panza clara
  const panza = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), toonMat(0xf6e7c9));
  panza.scale.set(0.9, 0.85, 0.5); panza.position.set(0, 1.2, 0.18);
  g.add(panza);
  // ojazos que miran al jugador
  const cabeza = new THREE.Group();
  for (const s of [-1, 1]) {
    const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff8e7 }));
    ojo.position.set(s * 0.14, 0.06, 0.16);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshBasicMaterial({ color: 0x101010 }));
    pup.position.set(s * 0.15, 0.06, 0.25);
    cabeza.add(ojo, pup);
  }
  const boca = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 6, 12), osc);
  boca.rotation.x = Math.PI / 2;
  boca.position.set(0, -0.12, 0.2);
  cabeza.add(boca);
  // gorra de rumbero (le da cara de "malo con estilo")
  const gorra = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), toonMat(0xc60b1e));
  gorra.position.y = 0.14;
  const visera = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.16), toonMat(0xc60b1e));
  visera.position.set(0, 0.12, 0.24);
  cabeza.add(gorra, visera);
  cabeza.position.set(0, 1.36, 0.24);
  g.add(cabeza);
  // ALAS de planeo (alas rígidas + alerón que se mueve)
  const alaMat = new THREE.MeshToonMaterial({ color: 0xdff3ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const alas = [];
  for (const s of [-1, 1]) {
    const ala = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.34), alaMat);
    ala.position.set(s * 0.5, 1.5, -0.04);
    ala.rotation.set(-0.15, s * 0.2, s * 0.12);
    g.add(ala);
    alas.push(ala);
  }
  // GLOBO que lo mantiene arriba (late en rojo cuando va a soltar la gota)
  const globo = new THREE.Group();
  const vela = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 12), toonMat(0xff5d5d));
  vela.scale.set(1, 1.1, 1);
  const gajos = new THREE.Mesh(new THREE.SphereGeometry(0.63, 14, 12), toonMat(0xffc400));
  gajos.scale.set(1, 1.1, 1);
  gajos.material = new THREE.MeshBasicMaterial({ color: 0xffc400, transparent: true, opacity: 0.28, wireframe: true });
  const nudo = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 8), toonMat(0x8a1f1f));
  nudo.position.y = -0.7; nudo.rotation.x = Math.PI;
  globo.add(vela, gajos, nudo);
  // cuerdas del globo al cuerpo
  for (const s of [-1, 1]) {
    const cuerda = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.72, 5), osc);
    cuerda.position.set(s * 0.2, 1.94, 0);
    cuerda.rotation.z = s * 0.3;
    globo.add(cuerda);
  }
  globo.position.set(0, 2.35, 0);
  g.add(globo);
  // BANDERA DE ESPAÑA en un mástil del globo (identidad: es de los enemigos)
  const bandera = new THREE.Group();
  const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.66, 5), toonMat(0x8a6a3a));
  mastil.position.y = 0.33;
  bandera.add(mastil);
  const hR = 0.055, hY = 0.1;
  const tela = new THREE.Group();
  const r1 = new THREE.Mesh(new THREE.PlaneGeometry(0.26, hR), new THREE.MeshBasicMaterial({ color: 0xc60b1e, side: THREE.DoubleSide }));
  r1.position.y = hY + hR / 2;
  const am = new THREE.Mesh(new THREE.PlaneGeometry(0.26, hY), new THREE.MeshBasicMaterial({ color: 0xffc400, side: THREE.DoubleSide }));
  const r2 = new THREE.Mesh(new THREE.PlaneGeometry(0.26, hR), new THREE.MeshBasicMaterial({ color: 0xc60b1e, side: THREE.DoubleSide }));
  r2.position.y = -hY - hR / 2;
  tela.add(r1, am, r2); tela.position.y = 0.68;
  bandera.add(tela);
  bandera.position.set(0.5, 2.6, 0);
  g.add(bandera);
  g.userData = { cuerpo, cabeza, alas, globo, vela, tela, bandera };
  return g;
}

/* GOTA FRÍA (proyectil del planeador): gota azul con brillo y una estela
   de gotitas; al tocar el suelo salpica (aviso: sombra/aro rojo en el suelo). */
export function makeGotaFria() {
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), new THREE.MeshBasicMaterial({ color: 0x59b7e8 }));
  cuerpo.scale.set(1, 1.15, 1);
  const brillo = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xeaf7ff }));
  brillo.scale.set(1, 1.3, 1); brillo.position.set(-0.07, 0.07, 0.16);
  const punta = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.34, 10), new THREE.MeshBasicMaterial({ color: 0x3f9ecf }));
  punta.rotation.x = Math.PI; punta.position.y = 0.28;
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), new THREE.MeshBasicMaterial({ color: 0x9fe1ff, transparent: true, opacity: 0.18, depthWrite: false }));
  g.add(cuerpo, punta, brillo, halo);
  g.userData = { cuerpo, brillo, halo };
  return g;
}

/* ---------- BLINDADO "El Cacharro Chico" ----------
   Bicho con CASCO de chapa remachada: el pisotón le rebota (suena CLANG) y
   solo lo revienta el GIRO. Telegrafía: se agacha y las luces del casco
   parpadean en rojo antes de tirarse hacia delante a trompicones. */
export function makeBlindado({ color = 0x4b6b4a } = {}) {
  const g = new THREE.Group();
  const mat = toonMat(color, { emissive: new THREE.Color(color).multiplyScalar(0.15) });
  const metal = toonMat(0x8f98a3);
  const osc = toonMat(0x1e2a1d);
  // cuerpo bajo y ancho
  const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), mat);
  cuerpo.scale.set(1.15, 0.8, 1.05);
  cuerpo.position.y = 0.55;
  g.add(cuerpo);
  const panza = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), toonMat(0xf6e7c9));
  panza.scale.set(1, 0.7, 0.6); panza.position.set(0, 0.44, 0.34);
  g.add(panza);
  // CASCO REMACHADO: casquete con remaches y franja de aviso
  const casco = new THREE.Group();
  const chapa = new THREE.Mesh(new THREE.SphereGeometry(0.54, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), metal);
  chapa.scale.set(1.1, 0.95, 1.05);
  const franja = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.045, 6, 18), toonMat(PALETA.rojo));
  franja.rotation.x = Math.PI / 2; franja.scale.set(1.08, 1.03, 1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const remache = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), toonMat(0x5a636e));
    remache.position.set(Math.sin(a) * 0.5, 0.12, Math.cos(a) * 0.5);
    casco.add(remache);
  }
  // crestón (le da silueta de "blindado")
  const creston = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.62), metal);
  creston.position.set(0, 0.46, 0);
  casco.add(chapa, franja, creston);
  casco.position.set(0, 0.62, 0);
  g.add(casco);
  // cara: ojos estrechos + boca de rendija con dientes
  const cara = new THREE.Group();
  for (const s of [-1, 1]) {
    const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff8e7 }));
    ojo.position.set(s * 0.17, 0.64, 0.42);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0x0c0c0c }));
    pup.position.set(s * 0.18, 0.63, 0.5);
    cara.add(ojo, pup);
  }
  const rendija = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.06), osc);
  rendija.position.set(0, 0.46, 0.48);
  cara.add(rendija);
  for (let i = 0; i < 3; i++) {
    const diente = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 5), new THREE.MeshBasicMaterial({ color: 0xfff8e7 }));
    diente.position.set(-0.12 + i * 0.12, 0.425, 0.5); diente.rotation.x = Math.PI;
    cara.add(diente);
  }
  g.add(cara);
  // LUCES DE AVISO del casco: 3 pilotos que parpadean en rojo (telegrafía)
  const luces = [];
  for (let i = 0; i < 3; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0x66ff88 }));
    l.position.set(-0.16 + i * 0.16, 1.02, 0.16);
    g.add(l);
    luces.push(l);
  }
  // patas cortas de blindado
  const patas = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pata = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.24, 4, 6), osc);
    pata.position.set(sx * 0.34, 0.24, sz * 0.3);
    pata.geometry.translate(0, -0.16, 0);
    g.add(pata);
    patas.push(pata);
  }
  // BANDERA DE ESPAÑA en el crestón (identidad de enemigo de la banda)
  const bandera = new THREE.Group();
  const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.58, 5), toonMat(0x8a6a3a));
  mastil.position.y = 0.29;
  bandera.add(mastil);
  const hR = 0.05, hY = 0.09;
  const tela = new THREE.Group();
  const r1 = new THREE.Mesh(new THREE.PlaneGeometry(0.24, hR), new THREE.MeshBasicMaterial({ color: 0xc60b1e, side: THREE.DoubleSide }));
  r1.position.y = hY + hR / 2;
  const am = new THREE.Mesh(new THREE.PlaneGeometry(0.24, hY), new THREE.MeshBasicMaterial({ color: 0xffc400, side: THREE.DoubleSide }));
  const r2 = new THREE.Mesh(new THREE.PlaneGeometry(0.24, hR), new THREE.MeshBasicMaterial({ color: 0xc60b1e, side: THREE.DoubleSide }));
  r2.position.y = -hY - hR / 2;
  tela.add(r1, am, r2); tela.position.y = 0.6;
  bandera.add(tela);
  bandera.position.set(0, 1.12, -0.2);
  g.add(bandera);
  g.userData = { cuerpo, casco, luces, patas, tela, bandera };
  return g;
}
