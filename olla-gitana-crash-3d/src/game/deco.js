/* Atrezzo ambiental (solo visual, SIN colisión) — decoración de escena.
   Vive en su propio fichero para no depender del arte de personajes/enemigos:
   nada de lo que se construye aquí entra en world.boxes, así que no bloquea el
   paso ni altera suelos, plataformas o meta. Se usa desde main.js. */
import * as THREE from 'three';
import { PALETA, toonMat } from './art.js';

/* cartel con texto (canvas): p. ej. "MURCIA" o "LA HUERTA" */
export function makeSignPost({ text = 'MURCIA', color = PALETA.dorado, height = 1.9, dark = false } = {}) {
  const g = new THREE.Group();
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, 512, 128);
  c.fillStyle = dark ? 'rgba(20,10,30,.88)' : 'rgba(255,245,225,.92)';
  c.beginPath();
  if (c.roundRect) { c.roundRect(6, 6, 500, 116, 14); c.fill(); } else c.fillRect(6, 6, 500, 116);
  c.lineWidth = 8; c.strokeStyle = dark ? '#ffbe0b' : '#9d1f2b'; c.stroke();
  c.font = '900 62px "Luckiest Guy", Nunito, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 8; c.strokeStyle = 'rgba(0,0,0,.5)';
  c.strokeText(text, 256, 68);
  c.fillStyle = dark ? '#fff5e1' : '#7a1010';
  c.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const tablon = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  const marco = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.5, 0.07), toonMat(dark ? 0x3a2f4d : 0xb5651d));
  marco.position.z = -0.04;
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, height, 6), toonMat(0x6b4a2a));
  poste.position.y = height / 2;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), toonMat(color));
  cap.position.y = height;
  tablon.position.y = height - 0.16;
  marco.position.y = height - 0.16;
  g.add(poste, cap, marco, tablon);
  return g;
}

/* papelera de calle (aro + bolsa) */
export function makeBin({ color = 0x38b000 } = {}) {
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.72, 12), toonMat(0x4a5057));
  cuerpo.position.y = 0.36;
  const boca = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 6, 14), toonMat(0x9aa5b1));
  boca.rotation.x = Math.PI / 2; boca.position.y = 0.72;
  const bolsa = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), toonMat(color));
  bolsa.scale.set(1, 0.72, 1); bolsa.position.y = 0.66;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.06, 10), toonMat(0x2f3439));
  base.position.y = 0.03;
  g.add(cuerpo, boca, bolsa, base);
  return g;
}

/* farola de forja clásica (poste + báculo + farol que brilla) */
export function makeStreetLamp({ h = 3.6, color = PALETA.dorado } = {}) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.34, 10), toonMat(0x33383d));
  base.position.y = 0.17;
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, h, 8), toonMat(0x33383d));
  poste.position.y = h / 2;
  const brazo = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 6, 12, Math.PI / 2), toonMat(0x33383d));
  brazo.position.set(0.32, h - 0.1, 0); brazo.rotation.z = -Math.PI / 2;
  const farol = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.36, 8), toonMat(0x33383d));
  farol.position.set(0.64, h - 0.24, 0);
  const luz = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  luz.position.set(0.64, h - 0.28, 0);
  const copa = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.18, 8), toonMat(color));
  copa.position.set(0.64, h - 0.02, 0);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.14, depthWrite: false }));
  halo.position.copy(luz.position);
  g.add(base, poste, brazo, farol, luz, copa, halo);
  g.userData.luz = luz;
  return g;
}

/* toldo de tienda (paño a rayas + faldón + varillas) */
export function makeAwning({ w = 3.0, d = 1.3, color = PALETA.rojo } = {}) {
  const g = new THREE.Group();
  const incl = -0.32;
  const tela = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), toonMat(color));
  tela.position.set(0, 0, d / 2);
  tela.rotation.x = incl;
  for (let i = 0; i < Math.floor(w / 0.45); i++) {
    const raya = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, d + 0.02), toonMat(PALETA.crema));
    raya.position.set(-w / 2 + 0.28 + i * 0.45, 0.005, d / 2 + (0.02 * d));
    raya.rotation.x = incl;
    g.add(raya);
  }
  for (let i = 0; i < Math.floor(w / 0.3); i++) {
    const on = i % 2 === 0;
    const fl = new THREE.Mesh(new THREE.BoxGeometry(0.3, on ? 0.26 : 0.18, 0.05), toonMat(on ? color : PALETA.crema));
    fl.position.set(-w / 2 + 0.15 + i * 0.3, Math.sin(incl), d + 0.02);
    g.add(fl);
  }
  const varilla = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, w, 6), toonMat(0x545454));
  varilla.rotation.z = Math.PI / 2;
  varilla.position.set(0, 0.03, 0.02);
  g.add(tela, varilla);
  return g;
}

/* banderines de la banda: cuerda con triángulos de colores */
export function makeBunting({ n = 9, span = 6.5, colors = [PALETA.rojo, PALETA.dorado, PALETA.azul, PALETA.verde, PALETA.rosa] } = {}) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = -span / 2 + (i / n) * span;
    const y = -Math.sin((i / n) * Math.PI) * 0.6;
    pts.push([x, y]);
  }
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const cuerda = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, len, 5), toonMat(0x3b2a12));
    cuerda.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
    cuerda.rotation.z = Math.PI / 2 - Math.atan2(y1 - y0, x1 - x0);
    const tri = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 4), toonMat(colors[i % colors.length]));
    tri.rotation.x = Math.PI;
    tri.position.set((x0 + x1) / 2, (y0 + y1) / 2 - 0.22, 0);
    g.add(cuerda, tri);
  }
  return g;
}

/* maceta de barro con planta (variante pequeña del arriate) */
export function makePotPlant({ scale = 1 } = {}) {
  const g = new THREE.Group();
  const maceta = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.19, 0.34, 10), toonMat(0xb5651d));
  maceta.position.y = 0.17;
  const hoja = toonMat(0x2d6a4f);
  for (let i = 0; i < 4; i++) {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5 + (i % 2) * 0.2, 6), hoja);
    h.position.set(Math.sin(i * 1.7) * 0.08, 0.5 + (i % 2) * 0.08, Math.cos(i * 1.7) * 0.08);
    h.rotation.z = Math.sin(i * 1.7) * 0.35;
    h.rotation.x = Math.cos(i * 1.7) * 0.35;
    g.add(h);
  }
  const flor = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: PALETA.rosa }));
  flor.position.y = 0.78;
  g.add(maceta, flor);
  g.scale.setScalar(scale);
  return g;
}

/* caja de fruta de la huerta (con naranjas dentro) */
export function makeFruitBox() {
  const g = new THREE.Group();
  const caja = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.46), toonMat(0x7c4519));
  caja.position.y = 0.17;
  g.add(caja);
  const naranja = new THREE.MeshBasicMaterial({ color: 0xff9500 });
  for (let i = 0; i < 4; i++) {
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), naranja);
    n.position.set(-0.16 + (i % 2) * 0.32, 0.38 + Math.floor(i / 2) * 0.1, -0.08 + Math.floor(i / 2) * 0.16);
    g.add(n);
  }
  return g;
}

/* azulejo huertano decorativo (placa con motivo pintado) */
export function makeTileSign({ text = 'MURCIA', color = PALETA.azul } = {}) {
  const g = new THREE.Group();
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#fff5e1'; c.fillRect(0, 0, 256, 256);
  c.fillStyle = color;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) c.fillRect(8 + i * 30, 8 + j * 30, 22, 22);
  for (let i = 0; i < 8; i++) c.fillRect(8 + i * 30, 218, 22, 22);
  c.strokeStyle = color; c.lineWidth = 6; c.strokeRect(60, 60, 136, 136);
  c.font = '900 40px "Luckiest Guy", Nunito, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#7a1010';
  c.fillText(text.slice(0, 7), 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: tex }));
  placa.position.y = 1.5;
  const respaldo = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.78, 0.08), toonMat(0x9aa5b1));
  respaldo.position.y = 1.5;
  g.add(respaldo, placa);
  return g;
}

/* panel de concierto: póster de la gira sobre dos postes */
export function makePoster({ text = 'FESTI', color = PALETA.morado, h = 2.6, w = 1.3 } = {}) {
  const g = new THREE.Group();
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 384;
  const c = cv.getContext('2d');
  c.fillStyle = '#1b0f2e'; c.fillRect(0, 0, 256, 384);
  c.strokeStyle = '#' + new THREE.Color(color).getHexString(); c.lineWidth = 10; c.strokeRect(8, 8, 240, 368);
  c.font = '900 54px "Luckiest Guy", Nunito, sans-serif';
  c.textAlign = 'center'; c.fillStyle = '#' + new THREE.Color(PALETA.dorado).getHexString();
  c.fillText(text.slice(0, 6), 128, 110);
  c.font = '900 26px Nunito, sans-serif';
  c.fillStyle = '#fff5e1';
  c.fillText('OLLA GITANA', 128, 168);
  c.fillText('GIRA 2026', 128, 200);
  c.fillStyle = '#' + new THREE.Color(PALETA.rosa).getHexString();
  for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(40 + i * 44, 260, 9, 0, Math.PI * 2); c.fill(); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const cartel = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 1.5), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  cartel.position.y = h + w * 0.75;
  for (const s of [-1, 1]) {
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, h + w * 1.5, 6), toonMat(0x6b4a2a));
    poste.position.set(s * (w / 2 + 0.12), (h + w * 1.5) / 2, -0.03);
    g.add(poste);
  }
  g.add(cartel);
  return g;
}

/* torre de focos del escenario (para arenas de jefe) */
export function makeFloodlightTower({ height = 5.4, swing = -0.5 } = {}) {
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
