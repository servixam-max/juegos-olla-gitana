/* Enemigos v3 — bichos con bandera de España, CARA RARA, animación real
   (patas, alas, cola, bandera), telegrafía clara ANTES de atacar, muerte con
   efecto + sonido propio y sombra de presencia.

   Tipos: patrol, roller, bee, turret, lamp, candle, barril (los clásicos)
        + toro, globo, blindado (v3, nuevos, con contrajuego explícito).

   LOS SONIDOS nuevos se sintetizan en art.js (sfxMecanicas) y se registran
   aquí igual que hace main.js con SFX_MEC: se pide un 'ui' y se SUSTITUYE por
   el tono propio. Regla del proyecto: nunca hit.mp3 para aciertos/muertes de
   enemigo.

   CONTRALUEGO (regla de diseño, nada injusto):
   - Todo ataque tiene aviso visual (anillo en el suelo / luces / postura) y
     sonoro, y un hueco de reacción ≥ 0,9 s.
   - toro: embiste recto; esquivable de lado o saltando (p.y>1.35). Al chocar
     con muro se ATURDE (2,2 s) y en ese estado se remata con giro o pisotón.
   - globo: planea y suelta gotas que caen rectas; el aro rojo del suelo marca
     EXACTAMENTE dónde cae. Remachable con giro en el aire.
   - blindado: acorazado; el pisotón le REBOTA (CLANG, no muere) y solo lo
     rompe el giro. Se telegrafía con las luces del casco y se lanza a
     trompicones. Nunca ataca sin haber parpadeado en rojo antes. */
import * as THREE from 'three';
import {
  toonMat, PALETA, makeSpeaker, makeBarrelRodante, sfxMecanicas,
  makeToroBravo, makeGloboPlaneador, makeGotaFria, makeBlindado
} from './art.js';

/* Los sfx nuevos (tormenta de la huerta, toro, coraza…) no están en el set de
   main.js: los pedimos aquí con el mismo patrón (registrar + sustituir). */
function sfxNuevo(audio, name) {
  try {
    if (audio && audio.log && audio.log.push) audio.log.push(name);
    if (audio && audio.ready && !audio.muted) sfxMecanicas(audio, name);
  } catch (_) { /* motor de audio sin arrancar */ }
}

/* Textura del anillo de onda (compartida): banda nítida con doble línea y
   muescas radiales, para que la onda se lea como una onda de sonido. */
let WAVE_TEX = null;
function waveTexture() {
  if (WAVE_TEX) return WAVE_TEX;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  const cx = 128, cy = 128;
  // El anillo (RingGeometry 0.82→1.0) mapea a UV 0.41→0.5 del centro:
  // dibujamos la banda en la corona 105→128 px.
  const grad = g.createRadialGradient(cx, cy, 100, cx, cy, 128);
  grad.addColorStop(0.00, 'rgba(255,255,255,0)');
  grad.addColorStop(0.14, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.45, 'rgba(255,255,255,1)');
  grad.addColorStop(0.80, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.beginPath(); g.arc(cx, cy, 128, 0, Math.PI * 2);
  g.fillStyle = grad; g.fill();
  // doble línea interior (cresta de la onda)
  g.beginPath(); g.arc(cx, cy, 116, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 3; g.stroke();
  g.beginPath(); g.arc(cx, cy, 108, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.stroke();
  // muescas radiales tipo diapasón
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 104, cy + Math.sin(a) * 104);
    g.lineTo(cx + Math.cos(a) * 124, cy + Math.sin(a) * 124);
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 4; g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  WAVE_TEX = tex;
  return tex;
}

/* Sombra compartida (blob) para dar PRESENCIA a los bichos: el juego no usa
   shadow maps, así que una mancha oscura bajo cada enemigo hace mucho. */
let SHADOW_TEX = null, SHADOW_MAT = null;
function shadowTexture() {
  if (SHADOW_TEX) return SHADOW_TEX;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, 'rgba(8,3,14,0.72)');
  grd.addColorStop(0.6, 'rgba(8,3,14,0.38)');
  grd.addColorStop(1, 'rgba(8,3,14,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  SHADOW_TEX = new THREE.CanvasTexture(cv);
  return SHADOW_TEX;
}
function shadowMaterial() {
  if (!SHADOW_MAT) SHADOW_MAT = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, opacity: 0.5, depthWrite: false });
  return SHADOW_MAT;
}

/* ---------- bicho enemigo con bandera de España ----------
   El usuario pidió enemigos que "se noten que son enemigos": bichos con la
   bandera de España (rojo-amarillo-rojo) y cara rara (boca torcida, colmillos,
   cuernos ridículos, ojos saltones que SIGUEN al jugador).
   v3: patas que caminan de verdad, bracitos, cola, panza que respira y
   BANDERA que ondea; el "aviso" (barra roja sobre la cabeza) se enciende
   cuando el bicho te ha visto. */
function makeBicho({ color = 0x6a1f6a, escala = 1, bandera = true, cara = 'rara' } = {}) {
  const g = new THREE.Group();
  const bodyMat = toonMat(color, { emissive: new THREE.Color(color).multiplyScalar(0.16) });
  // cuerpo: bola rechoncha con patas
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.44, 14, 12), bodyMat);
  body.scale.set(1, 0.92, 1);
  body.position.y = 0.5;
  g.add(body);
  // panza más clara (late al respirar: se anima en update)
  const panza = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), toonMat(0xf6e7c9));
  panza.scale.set(1, 0.8, 0.62); panza.position.set(0, 0.4, 0.28);
  g.add(panza);
  // ojos saltones sobre pedúnculos
  const stemMat = toonMat(color);
  const ojoB = new THREE.MeshBasicMaterial({ color: 0xfff8e7 });
  const pupiB = new THREE.MeshBasicMaterial({ color: 0x101010 });
  const ojos = [];
  for (const s of [-1, 1]) {
    const tallo = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.24, 6), stemMat);
    stem.position.y = -0.12;
    const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.135, 10, 8), ojoB);
    ojo.position.y = 0.04;
    const pupi = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 6), pupiB);
    pupi.position.set(0, 0.04, 0.1);
    tallo.add(stem, ojo, pupi);
    tallo.position.set(s * 0.19, 1.03, 0.06);
    g.add(tallo);
    ojos.push({ tallo, pupi });
  }
  // cara rara: boca torcida con colmillos
  const bocaMat = toonMat(0x2a0d2a);
  const boca = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.06), bocaMat);
  boca.position.set(0, 0.35, 0.4); boca.rotation.z = 0.16;
  g.add(boca);
  const colmMat = new THREE.MeshBasicMaterial({ color: 0xfff8e7 });
  for (const s of [-1, 1]) {
    const colm = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 5), colmMat);
    colm.position.set(s * 0.12, 0.42, 0.41); colm.rotation.x = Math.PI;
    g.add(colm);
  }
  // cuernitos ridículos
  const cuerMat = toonMat(0x2a0d2a);
  for (const s of [-1, 1]) {
    const cuerno = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6), cuerMat);
    cuerno.position.set(s * 0.3, 0.82, -0.05); cuerno.rotation.z = s * 0.5;
    g.add(cuerno);
  }
  // PATAS articuladas (caminan: se animan en update)
  const pataMat = toonMat(0x2a0d2a);
  const patas = [];
  for (const s of [-1, 1]) {
    const cadera = new THREE.Group();
    const pata = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.12, 4, 6), pataMat);
    pata.position.y = -0.06;
    const pie = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.24), pataMat);
    pie.position.set(0, -0.16, 0.08);
    cadera.add(pata, pie);
    cadera.position.set(s * 0.22, 0.22, 0.02);
    g.add(cadera);
    patas.push(cadera);
  }
  // bracitos que se agitan al perseguirte
  const brazos = [];
  for (const s of [-1, 1]) {
    const brazo = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.16, 4, 6), pataMat);
    brazo.geometry.translate(0, -0.09, 0);
    brazo.position.set(s * 0.4, 0.6, 0.1);
    brazo.rotation.z = s * 0.9;
    g.add(brazo);
    brazos.push(brazo);
  }
  // cola corta
  const cola = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.3, 6), pataMat);
  cola.position.set(0, 0.42, -0.44); cola.rotation.x = -0.8;
  g.add(cola);
  // BANDERA DE ESPAÑA a la espalda (rojo, amarillo, rojo) con mástil
  if (bandera) {
    const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.9, 6), toonMat(0x8a6a3a));
    mastil.position.set(0, 0.85, -0.28); mastil.rotation.x = -0.22;
    g.add(mastil);
    const tela = new THREE.Group();
    const hR = 0.09, hY = 0.16;
    const rojo1 = new THREE.Mesh(new THREE.PlaneGeometry(0.38, hR), new THREE.MeshBasicMaterial({ color: 0xc60b1e, side: THREE.DoubleSide }));
    rojo1.position.y = hY + hR / 2;
    const amar = new THREE.Mesh(new THREE.PlaneGeometry(0.38, hY), new THREE.MeshBasicMaterial({ color: 0xffc400, side: THREE.DoubleSide }));
    const rojo2 = new THREE.Mesh(new THREE.PlaneGeometry(0.38, hR), new THREE.MeshBasicMaterial({ color: 0xc60b1e, side: THREE.DoubleSide }));
    rojo2.position.y = -hY - hR / 2;
    tela.add(rojo1, amar, rojo2);
    const pivote = new THREE.Group();       // ondea desde el mástil
    tela.position.x = 0.19;
    pivote.add(tela);
    pivote.position.set(0, 1.15, -0.3);
    pivote.rotation.y = 0.3;
    g.add(pivote);
    g.userData.tela = pivote;
  }
  // AVISO: barra roja sobre la cabeza que se enciende al verte (telegrafía)
  const aviso = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.26, 0.09), new THREE.MeshBasicMaterial({ color: 0xff2e2e, transparent: true, opacity: 0 }));
  aviso.position.set(0, 1.52, 0);
  g.add(aviso);
  g.scale.setScalar(escala);
  g.userData.body = body;
  g.userData.panza = panza;
  g.userData.patas = patas;
  g.userData.brazos = brazos;
  g.userData.cola = cola;
  g.userData.ojos = ojos;
  g.userData.aviso = aviso;
  return g;
}

export class EnemySystem {
  constructor({ scene, fx, audio, world }) {
    this.scene = scene;
    this.fx = fx;
    this.audio = audio;
    this.world = world;
    this.list = [];
    this.waves = [];
    this.projectiles = [];
    this._extras = [];   // sombras y anillos de aviso (se limpian en cada carga)
  }

  load(defs, levelCtx = {}) {
    // limpia los anteriores. OJO: main.js vacía enemies.list ANTES de llamar a
    // load(), así que las sombras y los anillos creados aparte viven en
    // _extras: si no los quitáramos aquí, el nivel siguiente arrastraría
    // manchas y aros del anterior.
    for (const e of this.list) if (e.obj) this.scene.remove(e.obj);
    for (const w of this.waves) this.scene.remove(w.mesh);
    for (const o of this._extras) this.scene.remove(o);
    for (const g of this.projectiles) { this.scene.remove(g.obj); if (g.anillo) this.scene.remove(g.anillo); }
    this._extras = [];
    this.projectiles = [];
    this.list = []; this.waves = [];
    for (const d of defs) {
      if (d.type === 'patrol') this.list.push(this.makePatrol(d));
      else if (d.type === 'turret') this.list.push(this.makeTurret(d));
      else if (d.type === 'roller') this.list.push(this.makeRoller(d));
      else if (d.type === 'bee') this.list.push(this.makeBee(d));
      else if (d.type === 'lamp') this.list.push(this.makeLamp(d));
      else if (d.type === 'candle') this.list.push(this.makeCandle(d));
      else if (d.type === 'barril') this.list.push(this.makeBarrilRodante(d));
      else if (d.type === 'toro') this.list.push(this.makeToro(d));
      else if (d.type === 'globo') this.list.push(this.makeGlobo(d));
      else if (d.type === 'blindado') this.list.push(this.makeBlindado(d));
    }
    // los bichos de vaivén se recortan al pasillo real: nada de muros, cajas ni
    // tramos sobre el vacío (auditoría de movimientos; ver _encajarBicho).
    // El altavoz-torreta es estático: si quedó colocado sobre el vacío, se
    // re-ancla al suelo firme más cercano hacia el centro del pasillo.
    for (const e of this.list) {
      if (e.kind === 'patrol' || e.kind === 'toro' || e.kind === 'blindado' || e.kind === 'bee' || e.kind === 'globo') this._encajarBicho(e);
      else if (e.kind === 'turret') this._anclarTurret(e);
    }
  }

  /* torreta sobre el vacío (p. ej. N6 x=6,4 en los tramos de bloques): se
     desliza hacia el centro del pasillo hasta el primer punto con suelo. */
  _anclarTurret(e) {
    // la torreta no guarda `base` (es estática): su sitio es el del objeto
    const bx = e.base ? e.base.x : (e.obj ? e.obj.position.x : 0);
    const bz = e.base ? e.base.z : (e.obj ? e.obj.position.z : 0);
    if (this._sueloAdelante(bx, bz)) return;
    const s = Math.sign(bx) || 1;
    for (let k = 1; k <= 14; k++) {
      const x2 = bx - s * k * 0.3;
      if (this._sueloAdelante(x2, bz)) {
        if (e.base) e.base.x = x2;
        if (e.obj) e.obj.position.x = x2;
        return;
      }
    }
  }

  /* ---------- utilidades compartidas (sombra + anillo de aviso) ---------- */

  /* Sombra bajo el bicho: da presencia y "peso" visual. Se pega al suelo. */
  _sombra(e, size = 1.1) {
    if (!e.sombra) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMaterial());
      s.rotation.x = -Math.PI / 2;
      s.renderOrder = 2;
      this.scene.add(s);
      this._extras.push(s);
      e.sombra = s;
    }
    const p = e.obj.position;
    let top = 0.02;
    const g = this.world && this.world.groundUnder({ minX: p.x - 0.4, maxX: p.x + 0.4, minZ: p.z - 0.4, maxZ: p.z + 0.4, minY: -50, maxY: 60 });
    if (g) top = g.top + 0.02;
    e.sombra.position.set(p.x, top, p.z);
    const alt = Math.max(0, p.y - top);
    const k = Math.max(0.35, 1 - alt * 0.07);
    e.sombra.scale.setScalar(size * k);
    e.sombra.material = shadowMaterial();
    e.sombra.visible = e.obj.visible !== false;
  }

  /* Anillo de AVISO reutilizable (el suelo "avisa" antes de cada ataque).
     Se crea la primera vez y se apaga poniendo opacity=0. */
  _aviso(e, { color = 0xff5d5d, r = 1.1, opacity = 0, r0 = 0.55, r1 = 0.8, y = 0.07 } = {}) {
    if (!e.ring) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(r0, r1, 22),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
      );
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 4;
      this.scene.add(m);
      this._extras.push(m);
      e.ring = m;
    }
    if (opacity <= 0) { e.ring.material.opacity = 0; return; }
    e.ring.material.color.setHex(color);
    e.ring.position.set(e.obj.position.x, y, e.obj.position.z);
    e.ring.scale.setScalar(r);
    e.ring.material.opacity = opacity;
  }

  /* muerte del bicho: efecto en su sitio + sonido propio + fuera de escena */
  _matar(e, { colors = [0x9aa5b1, PALETA.rojo, 0xffffff], sfx = 'bicho_pop', shake = 0.14, ring = PALETA.rojo, n = 16 } = {}) {
    const p = e.obj.position;
    this.fx.impact({ x: p.x, y: Math.max(0.4, p.y + 0.4), z: p.z }, {
      count: n, speed: 5.5, up: 5, life: 0.8, size: 1, colors,
      shake, flash: colors[0], flashSize: 1.7, ring, ringSize: 2.0
    });
    sfxNuevo(this.audio, sfx);
    this._despawn(e);
  }

  _despawn(e) {
    e.alive = false;
    if (e.obj) this.scene.remove(e.obj);
    if (e.sombra) { this.scene.remove(e.sombra); e.sombra = null; }
    if (e.ring) { this.scene.remove(e.ring); e.ring = null; }
  }

  /* ---------- toro bravo: embiste recto y se aturde al chocar ---------- */
  makeToro(d) {
    const obj = makeToroBravo({ color: d.color || 0xb31217 });
    obj.position.set(d.x, 0, d.z);
    this.scene.add(obj);
    return {
      ...d, obj, base: { x: d.x, z: d.z }, t: Math.random() * 3,
      alive: true, kind: 'toro', hp: 2,
      estado: 'paseo', tEstado: 0, dir: { x: 0, z: 1 }, avisoSfx: 0
    };
  }

  /* ---------- globo planeador: suelta gotas frías verticales ---------- */
  makeGlobo(d) {
    const obj = makeGloboPlaneador({ color: d.color || 0x1b7f79 });
    obj.position.set(d.x, d.height || 2.7, d.z);
    this.scene.add(obj);
    return {
      ...d, obj, base: { x: d.x, z: d.z }, t: Math.random() * 5,
      alive: true, kind: 'globo', hp: 1,
      cd: (d.period || 3.6) * (0.5 + Math.random() * 0.5), apuntando: 0
    };
  }

  /* ---------- blindado: acorazado, solo muere con el giro ---------- */
  makeBlindado(d) {
    const obj = makeBlindado({ color: d.color || 0x4b6b4a });
    obj.position.set(d.x, 0, d.z);
    this.scene.add(obj);
    return {
      ...d, obj, base: { x: d.x, z: d.z }, t: Math.random() * 3,
      alive: true, kind: 'blindado', hp: 3,
      estado: 'paseo', tEstado: 0, dir: { x: 0, z: 1 }
    };
  }

  /* abeja: vuela en zigzag a media altura.
     Detalle v2: cuerpo con franjas, cabeza con ojos brillantes que siguen al
     jugador, alas que baten de verdad, antenas, patas, aguijón y halo
     luminoso. Todo lo que debe verse en la oscuridad va con MeshBasicMaterial.
     v3: PICADO avisado — cuando te tiene cerca se queda quieta, se le enciende
     el aguijón y se lanza en picado; luego vuelve a su altura. */
  makeBee(d) {
    const g = new THREE.Group();
    const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), toonMat(0xffbe0b));
    cuerpo.scale.set(1, 0.85, 1.25);
    for (let i = 0; i < 2; i++) {
      const franja = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 6, 12), toonMat(0x1a1a1a));
      franja.position.z = -0.16 + i * 0.34;
      g.add(franja);
    }
    // cabeza + ojos grandes (brillan solos) con pupila que mira al jugador
    const cabeza = new THREE.Group();
    const craneo = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), toonMat(0x2b2b2b));
    cabeza.add(craneo);
    for (const s of [-1, 1]) {
      const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      ojo.position.set(s * 0.115, 0.05, 0.14);
      const pup = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshBasicMaterial({ color: 0x141414 }));
      pup.position.set(s * 0.1, 0.05, 0.225);
      cabeza.add(ojo, pup);
    }
    cabeza.position.set(0, 0.02, 0.42);
    g.add(cabeza);
    // antenas
    for (const s of [-1, 1]) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.26, 5), toonMat(0x2b2b2b));
      ant.position.set(s * 0.08, 0.24, 0.5);
      ant.rotation.set(-0.5, 0, s * 0.35);
      g.add(ant);
      const bola = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffbe0b }));
      bola.position.set(s * 0.14, 0.36, 0.6);
      g.add(bola);
    }
    // alas que baten (se animan en update)
    const alaMat = new THREE.MeshToonMaterial({ color: 0xdff3ff, transparent: true, opacity: 0.75 });
    const alas = [];
    for (const s of [-1, 1]) {
      const ala = new THREE.Mesh(new THREE.CircleGeometry(0.28, 10), alaMat);
      ala.position.set(s * 0.26, 0.22, 0);
      ala.rotation.set(-0.4, s * 0.4, 0);
      g.add(ala);
      alas.push(ala);
    }
    // patas colgando
    for (const s of [-1, 1]) {
      const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.016, 0.28, 5), toonMat(0x2b2b2b));
      pata.position.set(s * 0.14, -0.32, 0.1);
      pata.rotation.z = s * 0.25;
      g.add(pata);
    }
    // aguijón doble (púa oscura + punta al rojo que avisa del peligro)
    const aguijon = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 6), toonMat(0x2b2b2b));
    aguijon.rotation.x = Math.PI / 2; aguijon.position.z = 0.42;
    const punta = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2e2e }));
    punta.position.z = 0.35;
    g.add(cuerpo, aguijon, punta);
    // halo/zumbido: aro luminoso alrededor del cuerpo (visible de noche)
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.022, 5, 18), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.5 }));
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.04;
    g.add(halo);
    g.userData = { alas, cabeza, halo, punta };
    g.position.set(d.x, d.height || 2.4, d.z);
    this.scene.add(g);
    return {
      ...d, obj: g, base: { x: d.x, z: d.z }, t: Math.random() * 10, alive: true, kind: 'bee', hp: 1,
      estado: 'ronda', tEstado: 0, avisoSfx: 0
    };
  }

  /* lámpara oscilante del casino: va y viene colgada.
     Detalle v2: cadena con eslabones, casquete, pantalla con ribete dorado y
     flecos, bombilla con halo y un cono de luz que barre el suelo al
     balancearse — en el casino a oscuras se ve desde lejos. */
  makeLamp(d) {
    const g = new THREE.Group();
    const cadena = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), toonMat(0x9aa5b1));
    cadena.position.y = 1.2;
    g.add(cadena);
    // eslabones (aros alternos) a lo largo de la cadena
    for (let i = 0; i < 5; i++) {
      const eslabon = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 5, 8), toonMat(0x6b7280));
      eslabon.position.y = 0.42 + i * 0.42;
      eslabon.rotation.y = i % 2 ? Math.PI / 2 : 0;
      g.add(eslabon);
    }
    // casquete del techo + remate superior
    const casquete = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.14, 8), toonMat(0x4a4a4a));
    casquete.position.y = 2.42;
    const remate = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), toonMat(PALETA.dorado));
    remate.position.y = 0.24;
    // pantalla (cono) con ribete dorado inferior y flecos
    const pantalla = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.7, 12), toonMat(0xd62828));
    pantalla.position.y = -0.15;
    const ribete = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 6, 16), toonMat(PALETA.dorado));
    ribete.rotation.x = Math.PI / 2; ribete.position.y = -0.5;
    g.add(pantalla, ribete, remate);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 5), toonMat(PALETA.dorado));
      fl.position.set(Math.sin(a) * 0.5, -0.62, Math.cos(a) * 0.5);
      fl.rotation.x = Math.PI;
      g.add(fl);
    }
    // bombilla que brilla + halo (MeshBasicMaterial: se ve en la oscuridad)
    const bombilla = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    bombilla.position.y = -0.55;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.44, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.2, depthWrite: false }));
    halo.position.y = -0.55;
    g.add(bombilla, halo);
    // cono de luz abierto hacia el suelo (ápice en la bombilla, base abajo)
    const luzMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });
    const cono = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.6, 14, 1, true), luzMat);
    cono.position.y = -2.35;
    cono.renderOrder = 4;
    g.add(cono);
    g.userData = { bombilla, halo, cono, luzMat, pantalla };
    g.position.set(d.x, 5.0, d.z);
    this.scene.add(g);
    return { ...d, obj: g, base: { x: d.x, y: 5.0, z: d.z }, t: Math.random() * 10, alive: true, kind: 'lamp', hp: 1, crujido: 0 };
  }

  /* cirio que cae del cielo (Semana Santa): avisa con sombra y cae.
     Detalle v2: plato de latón, chorretones de cera, pabilo y llama en tres
     capas con halo; mientras cae suelta chispas y el aviso late más rápido.
     v3: además suelta una SOMBRA que crece al caer (se ve venir). */
  makeCandle(d) {
    const g = new THREE.Group();
    const plato = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.07, 12), toonMat(PALETA.dorado));
    plato.position.y = -0.03;
    const cera = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 1.6, 10), toonMat(0xfff1c0));
    cera.position.y = 0.8;
    g.add(plato, cera);
    // chorretones de cera derretida (cápsulas pegadas al cuerpo)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const gota = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.26 + (i % 3) * 0.18, 3, 6), toonMat(0xffe9c4));
      gota.position.set(Math.sin(a) * 0.19, 1.42 - (i % 3) * 0.22, Math.cos(a) * 0.19);
      g.add(gota);
    }
    // pabilo
    const pabilo = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.18, 5), toonMat(0x2b2b2b));
    pabilo.position.y = 1.68;
    // llama en 3 capas + halo (todo MeshBasicMaterial: brilla de noche)
    const llama = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.44, 8), new THREE.MeshBasicMaterial({ color: 0xff7b00 }));
    llama.position.y = 1.98;
    const nucleo = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 8), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
    nucleo.position.y = 1.94;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffbe0b, transparent: true, opacity: 0.24, depthWrite: false }));
    halo.position.y = 1.98;
    g.add(pabilo, llama, nucleo, halo);
    g.userData = { llama, nucleo, halo };
    g.position.set(d.x, 12, d.z);
    this.scene.add(g);
    // marca en el suelo (aviso)
    const aviso = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 16), new THREE.MeshBasicMaterial({ color: 0xff5d5d, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    aviso.rotation.x = -Math.PI / 2; aviso.position.set(d.x, 0.06, d.z);
    aviso.renderOrder = 3;
    this.scene.add(aviso);
    return { ...d, obj: g, aviso, base: { x: d.x, z: d.z }, t: Math.random() * 3, alive: true, kind: 'candle', hp: 1, cd: d.period || 2.8 };
  }

  makePatrol(d) {
    // bicho con bandera de España: se lee como enemigo de un vistazo
    const obj = makeBicho({ color: d.color || 0x7a2a8f, escala: 1.15, bandera: true });
    obj.position.set(d.x, 0, d.z);
    this.scene.add(obj);
    return { ...d, obj, base: { x: d.x, z: d.z }, t: Math.random() * 10, alive: true, kind: 'patrol', hp: 1, avisoSfx: 0 };
  }
  makeTurret(d) {
    const obj = makeSpeaker({ big: true, color: 0x9d0208 });
    // cono visible de altavoz + luz propia (antes era una caja roja oscura)
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.5, 12), toonMat(0x151515));
    cone.rotation.x = Math.PI / 2;
    cone.position.set(0, 1.05, 0.68);
    obj.add(cone);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 16), toonMat(0xd9dde2));
    ring.position.set(0, 1.05, 0.55);
    obj.add(ring);
    const luz = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5d5d }));
    luz.position.set(0, 1.6, 0.4);
    obj.add(luz);
    obj.userData.luz = luz;
    obj.position.set(d.x, 0, d.z);
    this.scene.add(obj);
    return { ...d, obj, t: Math.random() * 2, alive: true, kind: 'turret', cd: d.period || 2.0, hp: 2, carga: 0, warnSfx: 0 };
  }
  makeRoller(d) {
    // bicho gordo rodante (rojo, con bandera): el que empuja sin piedad
    const obj = makeBicho({ color: 0x8f2a2a, escala: 1.55, bandera: true });
    obj.position.set(d.x, 0, d.z);
    this.scene.add(obj);
    return { ...d, obj, alive: true, kind: 'roller', vz: -(d.speed || 8), base: { x: d.x, z: d.z }, hp: 1, dustT: 0 };
  }

  /* BARRIL RODANTE (mecánica Crash): barril tumbado que baja rodando por el
     pasillo hacia el jugador. Se esquiva saltando (o apartándose); no se
     destruye con el giro, hay que LEERLO y dejarle pasar. Al estrellarse
     contra el jugador estalla y vuelve a su sitio. */
  makeBarrilRodante(d) {
    const obj = makeBarrelRodante({ color: d.color || PALETA.madera });
    obj.position.set(d.x, 0, d.z);
    this.scene.add(obj);
    return { ...d, obj, alive: true, kind: 'barril', vz: -(d.speed || 7), base: { x: d.x, z: d.z }, hitCd: 0, rollT: 0 };
  }

  /* ================= CONTENCIÓN DE LOS BICHOS AL ESCENARIO =================
     Hallazgo de la auditoría de movimientos: patrol/toro/blindado/globo/abeja
     movían su vaivén por seno puro SIN mirar el mundo; con bases y span que
     salían del pasillo (span más ancho que la calle) el bicho entraba en el
     muro o en una caja —y desde dentro te dañaba a través de la pared— o se
     quedaba flotando sobre un hueco (el roller rodaba por el aire en los
     tramos de bloques). Aquí se corrige en el MOTOR (sin tocar niveles):
       (1) la base se re-ancla al punto válido más cercano si arranca dentro de
           un sólido o sobre el vacío, y
       (2) el vaivén se recorta al tramo continuo libre que contiene la base.
     `_libre` exige hueco de cuerpo y, para los de suelo, suelo debajo. */

  _libre(x, y, z, r, alto, volador) {
    if (!this.world) return true;
    const g = this.world.groundUnder({
      minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3, minY: -50, maxY: y + 0.6
    });
    if (!volador && !g) return false;
    // el suelo que se pisa no cuenta como sólido a atravesar (islas de 0,24 m)
    let base = y;
    if (g && g.top > base) base = g.top;
    const b = this.world.overlap({
      minX: x - r, maxX: x + r, minY: base + 0.25, maxY: y + alto, minZ: z - r, maxZ: z + r
    });
    return !b;
  }

  /* tramo continuo válido alrededor de la base, en offsets del vaivén */
  _rangoEje(e, eje, medio, r, alto, volador, yOf) {
    if (!(medio > 0)) return { lo: 0, hi: 0 };
    const paso = 0.25;
    const n = Math.max(1, Math.ceil(medio / paso));
    const ok = (o) => this._libre(
      eje === 'x' ? e.base.x + o : e.base.x,
      yOf(),
      eje === 'z' ? e.base.z + o : e.base.z,
      r, alto, volador);
    let hi = 0, lo = 0;
    for (let k = 1; k <= n; k++) { if (!ok(k * paso)) break; hi = k * paso; }
    for (let k = 1; k <= n; k++) { if (!ok(-k * paso)) break; lo = -k * paso; }
    return { lo, hi };
  }

  /* clamp del offset de vaivén al rango recortado del bicho */
  _clampR(e, eje, o) {
    const r = e.limites && e.limites[eje];
    if (!r) return o;
    return Math.max(r.lo, Math.min(r.hi, o));
  }

  /* ¿hay suelo (firme) en (x, z) a ras del bicho? (para roller/barril) */
  _sueloAdelante(x, z) {
    if (!this.world) return true;
    return !!this.world.groundUnder({ minX: x - 0.35, maxX: x + 0.35, minZ: z - 0.35, maxZ: z + 0.35, minY: -50, maxY: 1.3 });
  }

  /* sitio seguro para reenganchar un rodante: base.z+8 si vale y si no base.z */
  _reinicioRodante(e, dz = 8) {
    if (this._sueloAdelante(e.base.x, e.base.z + dz) && !this._solidoEn(e.base.x, e.base.z + dz)) return e.base.z + dz;
    if (this._sueloAdelante(e.base.x, e.base.z) && !this._solidoEn(e.base.x, e.base.z)) return e.base.z;
    return e.obj.position.z;   // sin sitio claro: se queda donde está (no se teletransporta)
  }

  _solidoEn(x, z) {
    if (!this.world) return false;
    return !!this.world.overlap({ minX: x - 0.5, maxX: x + 0.5, minY: 0.1, maxY: 1.3, minZ: z - 0.5, maxZ: z + 0.5 });
  }

  /* ajusta base + vaivén de un bicho al escenario real (se llama en load y cada
     vez que un toro/blindado reancla su base tras una embestida) */
  _encajarBicho(e) {
    const P = {
      patrol: { r: 0.5, alto: 1.5, span: (e.span || 6) * 0.5, volador: false, y: () => 0 },
      toro: { r: 0.6, alto: 1.6, span: (e.span || 3) * 0.5, volador: false, y: () => 0 },
      blindado: { r: 0.6, alto: 1.4, span: (e.span || 5) * 0.5, volador: false, y: () => 0 },
      bee: { r: 0.42, alto: 0.95, span: (e.span || 5), spanZ: 1.6, volador: true, y: () => (e.height || 2.4) - 0.45 },
      globo: { r: 0.5, alto: 1.1, span: (e.span || 3), spanZ: 1.3, volador: true, y: () => (e.height || 2.7) - 0.35 }
    }[e.kind];
    if (!P || !e.base) return;
    const volador = !!P.volador;
    // (1) base válida: si arranca dentro de algo o sobre el vacío, se re-ancla
    //     al punto libre más cercano a ≤2,4 m (más lejos sería un teletransporte
    //     visible; en ese caso se deja la base y el vaivén se congela)
    if (!this._libre(e.base.x, P.y(), e.base.z, P.r, P.alto, volador)) {
      let hit = null;
      for (let k = 1; k <= 8 && !hit; k++) {
        const pasos = [[-k * 0.3, 0], [k * 0.3, 0], [0, k * 0.3], [0, -k * 0.3]];
        for (const [dx, dz] of pasos) {
          if (this._libre(e.base.x + dx, P.y(), e.base.z + dz, P.r, P.alto, volador)) { hit = { x: e.base.x + dx, z: e.base.z + dz }; break; }
        }
      }
      if (hit) e.base = { x: hit.x, z: hit.z };
      else { e.limites = { x: { lo: 0, hi: 0 }, z: { lo: 0, hi: 0 } }; return; }
    }
    // (2) vaivén recortado
    if (e.kind === 'bee' || e.kind === 'globo') {
      e.limites = {
        x: this._rangoEje(e, 'x', P.span, P.r, P.alto, volador, P.y),
        z: this._rangoEje(e, 'z', P.spanZ || 0, P.r, P.alto, volador, P.y)
      };
    } else if (e.axis === 'z') {
      e.limites = { x: { lo: 0, hi: 0 }, z: this._rangoEje(e, 'z', P.span, P.r, P.alto, volador, P.y) };
    } else {
      e.limites = { x: this._rangoEje(e, 'x', P.span, P.r, P.alto, volador, P.y), z: { lo: 0, hi: 0 } };
    }
    // (3) altura del piso donde patrulla (islas con tope 0,24 m): los bichos de
    //     suelo caminan A RAS del piso, no hundidos
    if (!volador) {
      const g2 = this.world && this.world.groundUnder({ minX: e.base.x - 0.3, maxX: e.base.x + 0.3, minZ: e.base.z - 0.3, maxZ: e.base.z + 0.3, minY: -50, maxY: 0.6 });
      e.pisoY = g2 ? g2.top : 0;
    }
  }

  /* Devuelve true si el jugador recibe daño este frame */
  update(dt, player, ctx = {}) {
    let hit = false;
    const p = player.pos;

    for (const e of this.list) {
      if (!e.alive) continue;
      const ud = e.obj.userData || {};
      if (e.kind === 'patrol') {
        /* Bicho con bandera: patrulla en su eje. v3: camino de verdad (patas,
           brazos, panza respirando), la bandera ondea, te "ve" cuando estás
           cerca (barra roja + anillo + sonido) y su mirada te sigue. */
        e.t += dt * (e.speed || 3) * 0.5;
        const o = this._clampR(e, e.axis === 'z' ? 'z' : 'x', Math.sin(e.t) * (e.span || 6) * 0.5);
        if (e.axis === 'z') { e.obj.position.z = e.base.z + o; e.obj.position.x = e.base.x; }
        else { e.obj.position.x = e.base.x + o; e.obj.position.z = e.base.z; }
        const mirando = Math.cos(e.t) >= 0 ? 1 : -1;      // hacia dónde patrulla
        e.obj.rotation.y = e.axis === 'z' ? (mirando < 0 ? Math.PI : 0) : (mirando < 0 ? -Math.PI / 2 : Math.PI / 2);
        const paso = Math.sin(e.t * (e.speed || 3) * 2.4);
        e.obj.position.y = (e.pisoY || 0) + Math.abs(paso) * 0.05;
        if (ud.patas) {
          ud.patas[0].rotation.x = paso * 0.7;
          ud.patas[1].rotation.x = -paso * 0.7;
        }
        if (ud.brazos) {
          ud.brazos[0].rotation.x = Math.sin(e.t * 6) * 0.5;
          ud.brazos[1].rotation.x = Math.sin(e.t * 6 + 1.6) * 0.5;
        }
        if (ud.panza) ud.panza.scale.y = 0.8 + Math.sin(e.t * 3.4) * 0.06;
        if (ud.tela) ud.tela.rotation.y = 0.3 + Math.sin(e.t * 3.2) * 0.34;   // bandera ondeando
        // te ha visto: avisa (barra + anillo + alerta sonora con enfriamiento)
        const distP = Math.hypot(e.obj.position.x - p.x, e.obj.position.z - p.z);
        const alerta = distP < 3.4 && p.y < 1.6;
        if (ud.aviso) ud.aviso.material.opacity = alerta ? 0.55 + Math.sin(e.t * 14) * 0.45 : 0;
        this._aviso(e, { color: 0xff5d5d, r: 1.0 + Math.sin(e.t * 8) * 0.06, opacity: alerta ? 0.5 : 0 });
        if (ud.ojos) {
          const gy = Math.atan2(p.x - e.obj.position.x, p.z - e.obj.position.z) - e.obj.rotation.y;
          for (const ojo of ud.ojos) {
            ojo.tallo.rotation.y = Math.max(-0.6, Math.min(0.6, gy)) * 0.5;
            ojo.pupi.position.x = Math.max(-0.05, Math.min(0.05, Math.sin(gy) * 0.06));
          }
        }
        e.avisoSfx -= dt;
        if (alerta && e.avisoSfx <= 0) { e.avisoSfx = 1.4; this.audio.sfx('alert'); }
        this._sombra(e, 1.05);
        // daño por contacto (salvo si el jugador gira)
        const dx = Math.abs(e.obj.position.x - p.x), dz = Math.abs(e.obj.position.z - p.z);
        if (dx < 0.75 && dz < 0.75 && Math.abs(p.y - 0) < 1.1) {
          if (player.spinning) {
            this._matar(e, { colors: [0x9aa5b1, PALETA.rojo, 0x2b2b2b], sfx: 'bicho_pop' });
          } else if (player.grounded === false && p.y > 1.0) {
            // pisotón: también lo revienta
            this._matar(e, { colors: [PALETA.rojo, PALETA.dorado, 0xffffff], sfx: 'bicho_pop', n: 12, shake: 0.1 });
          } else hit = true;
        }
      } else if (e.kind === 'turret') {
        /* Altavoz-torreta: gira y dispara ondas. v3: TELEGRAFÍA de carga —
           antes de disparar, la luz se hincha y un anillo rojo late en el
           suelo medio segundo; solo entonces sale la onda. */
        e.t += dt;
        e.obj.rotation.y = Math.sin(e.t * 0.6) * 0.9;
        e.flash = Math.max(0, (e.flash || 0) - dt);
        const luz = e.obj.userData.luz;
        e.cd -= dt;
        const cargando = e.cd <= 0.6 && e.cd > 0;
        if (cargando && e.carga === 0) { e.carga = 1; this.audio.sfx('warn'); }
        if (!cargando) e.carga = 0;
        if (luz) {
          const on = e.flash > 0;
          luz.material.color.setHex(on ? 0xffffff : (cargando ? 0xffb020 : 0xff5d5d));
          luz.scale.setScalar(on ? 1.9 : (cargando ? 1 + (0.6 - e.cd) * 1.6 : 1 + Math.sin(e.t * 7) * 0.16));
        }
        this._aviso(e, { color: 0xffb020, r: 1.2 + (0.6 - Math.max(0, e.cd)) * 0.9, opacity: cargando ? 0.55 : 0, y: 0.05 });
        this._sombra(e, 1.6);
        if (e.cd <= 0) {
          e.cd = e.period || 2.0;
          e.flash = 0.3;
          e.carga = 0;
          this.spawnWave(e);
        }
        if (player.spinning) {
          const dx = Math.abs(e.obj.position.x - p.x), dz = Math.abs(e.obj.position.z - p.z);
          if (dx < 1.1 && dz < 1.1 && p.y < 1.8) this._matar(e, { colors: [0x9d0208, 0x151515, PALETA.dorado], sfx: 'bicho_pop' });
        }
      } else if (e.kind === 'roller') {
        /* Ampli rodante: baja a toda velocidad. v3: gira la bola de verdad
           (rotación en x), levanta polvo y suelta un retumbo que se oye
           acercarse; el giro lo repele.
           AUDITORÍA: el rodante cruza los baches a propósito (en N3 los niveles
           lo colocan también sobre los tramos de bloques), así que NO se le
           fuerza suelo; lo que sí se corrige es el punto de reenganche: antes
           volvía a `base.z + 8`, que en los tramos nuevos cae sobre el vacío
           (el jugador veía la bola reaparecer flotando). `_reinicioRodante`
           elige un punto con suelo. */
        e.obj.position.z += e.vz * dt;
        e.obj.rotation.x -= e.vz * dt * 0.4;
        // rueda a ras del piso real (las losas nuevas van a 0,24 m: antes
        // rodaba hundido 24 cm). maxY 0,6: no trepa a cajas (0,92) ni escaleras
        {
          const gR = this.world && this.world.groundUnder({ minX: e.obj.position.x - 0.35, maxX: e.obj.position.x + 0.35, minZ: e.obj.position.z - 0.35, maxZ: e.obj.position.z + 0.35, minY: -50, maxY: 0.6 });
          e.obj.position.y = gR ? gR.top : 0;
        }
        if (e.obj.position.z < e.base.z - 26) { e.obj.position.z = this._reinicioRodante(e); }
        if (e.obj.position.z < -6) { e.obj.position.z = e.base.z; }
        if (ud.tela) ud.tela.rotation.y = 0.3 + Math.sin(e.t * 9) * 0.3;
        this._sombra(e, 1.5);
        e.dustT = (e.dustT || 0) - dt;
        if (e.dustT <= 0 && Math.abs(e.obj.position.z - p.z) < 22) {
          e.dustT = 0.09;
          this.fx.burst({ x: e.obj.position.x, y: 0.15, z: e.obj.position.z + 0.6 }, { count: 1, speed: 0.8, up: 1.1, life: 0.45, size: 0.8, colors: [0x9aa5b1, 0x6b7280] });
        }
        const dx = Math.abs(e.obj.position.x - p.x), dz = Math.abs(e.obj.position.z - p.z);
        if (dx < 0.9 && dz < 0.9 && p.y < 1.3) {
          if (player.spinning || (p.y > 0.9)) {
            e.obj.position.z = e.base.z;
          } else hit = true;
        }
      } else if (e.kind === 'barril') {
        /* BARRIL RODANTE: baja por el pasillo hacia el jugador, girando.
           Esquiva = saltar (p.y > 1.0) o apartarse. Al tocarte, daña y
           estalla: vuelve a su sitio (así el tramo se puede reintentar). */
        e.rollT += dt;
        e.hitCd = Math.max(0, (e.hitCd || 0) - dt);
        if (e.stunned > 0) {
          e.stunned -= dt;
          e.obj.rotation.z += dt * 9;
          e.obj.position.y = Math.max(0.05, e.obj.position.y - dt * 2.2);
          if (e.stunned <= 0) {
            this.fx.burst({ x: e.obj.position.x, y: 0.3, z: e.obj.position.z }, { count: 14, speed: 5, up: 4.5, life: 0.8, colors: [PALETA.madera, PALETA.maderaOsc, 0xffffff] });
            this.audio.sfx('barril');
            e.obj.position.set(e.base.x, 0, e.base.z);
            e.obj.rotation.set(0, 0, 0);
          }
          continue;
        }
        e.obj.position.z += e.vz * dt;
        e.obj.rotation.x -= e.vz * dt * 0.9;    // rueda de verdad
        {
          const gB = this.world && this.world.groundUnder({ minX: e.obj.position.x - 0.35, maxX: e.obj.position.x + 0.35, minZ: e.obj.position.z - 0.35, maxZ: e.obj.position.z + 0.35, minY: -50, maxY: 0.6 });
          e.obj.position.y = gB ? gB.top : 0;
        }
        this._sombra(e, 1.5);
        // aviso sonoro periódico mientras rueda
        e.sfxT = (e.sfxT || 0) - dt;
        if (e.sfxT <= 0) { e.sfxT = 0.34; this.audio.sfx('rodar'); }
        /* El tramo es largo: al llegar al final vuelve arriba a empezar.
           OJO: el recorrido es `largo` (el MISMO que el constructor de niveles
           verifica que tenga suelo firme). Con 30 m fijos, un barril colocado
           en un tramo firme de 16 m se metía rodando en la sección de bloques
           sobre el vacío y el jugador (y el bot) caían al esquivarlo. */
        const largoB = e.largo || 22;
        if (e.obj.position.z < e.base.z - largoB) e.obj.position.z = this._reinicioRodante(e, 6);
        const dxB = Math.abs(e.obj.position.x - p.x), dzB = Math.abs(e.obj.position.z - p.z);
        if (dxB < 1.0 && dzB < 0.9 && p.y < 1.05) {
          if (e.hitCd <= 0) {
            e.hitCd = 1.6;
            if (player.spinning) {
              // el giro lo manda a la porra: se estrella y vuelve a su sitio
              e.stunned = 0.55;
              this.fx.burst({ x: e.obj.position.x, y: 0.4, z: e.obj.position.z }, { count: 12, speed: 5, up: 4, life: 0.6, colors: [PALETA.madera, 0xffffff] });
            } else {
              hit = true;
              this.fx.burst({ x: e.obj.position.x, y: 0.5, z: e.obj.position.z }, { count: 16, speed: 6, up: 5, life: 0.8, colors: [PALETA.madera, PALETA.rojo, 0xffffff] });
              this.audio.sfx('barril');
              e.obj.position.set(e.base.x, 0, e.base.z);   // vuelve arriba
            }
          }
        }
      } else if (e.kind === 'bee') {
        /* Abeja: zigzag + PICADO avisado. Se queda quieta medio segundo con
           el aguijón encendido y se lanza en picado; si no te pilla, sube. */
        e.t += dt;
        if (e.estado === 'pica') {
          e.tEstado += dt;
          // el picado persigue al jugador (puede salirse del vaivén): si el
          // hueco siguiente no está libre, no se mete en el muro
          const nxB = e.obj.position.x + e.dirX * dt * 6.5;
          const nzB = e.obj.position.z + e.dirZ * dt * 6.5;
          const yB = Math.max(0.9, e.obj.position.y - dt * 3.2);
          if (this._libre(nxB, yB, nzB, 0.42, 0.95, true)) { e.obj.position.x = nxB; e.obj.position.z = nzB; }
          e.obj.position.y = yB;
          if (e.tEstado > 0.55) { e.estado = 'sube'; e.tEstado = 0; }
        } else if (e.estado === 'sube') {
          e.tEstado += dt;
          e.obj.position.y = Math.min(e.height || 2.4, e.obj.position.y + dt * 2.6);
          if (e.tEstado > 0.9) { e.estado = 'ronda'; e.tEstado = 0; }
        } else {
          e.obj.position.x = e.base.x + this._clampR(e, 'x', Math.sin(e.t * 1.8) * (e.span || 5));
          e.obj.position.z = e.base.z + this._clampR(e, 'z', Math.cos(e.t * 1.1) * 1.6);
          e.obj.position.y = (e.height || 2.4) + Math.sin(e.t * 4.2) * 0.45;
          const dpx = p.x - e.obj.position.x, dpz = p.z - e.obj.position.z;
          const dist = Math.hypot(dpx, dpz);
          if (dist < 2.6 && p.y < 1.2) {
            e.avisoT = (e.avisoT || 0) + dt;
            e.obj.userData.punta.scale.setScalar(1 + Math.sin(e.t * 26) * 0.5);
            if (e.avisoT > 0.45) {
              e.estado = 'pica'; e.tEstado = 0; e.avisoT = 0;
              const m = dist || 1;
              e.dirX = dpx / m; e.dirZ = dpz / m;
              sfxNuevo(this.audio, 'globo_dispara');
            }
          } else { e.avisoT = 0; e.obj.userData.punta.scale.setScalar(1); }
        }
        e.obj.rotation.y = Math.atan2(p.x - e.obj.position.x, p.z - e.obj.position.z);
        const ub = e.obj.userData;
        if (ub.alas) {
          const flap = Math.sin(e.t * 42) * 0.7;
          ub.alas[0].rotation.z = -0.3 - flap;
          ub.alas[1].rotation.z = 0.3 + flap;
        }
        if (ub.halo) ub.halo.material.opacity = 0.34 + Math.sin(e.t * 5) * 0.2;
        if (ub.cabeza) {
          let gy = Math.atan2(p.x - e.obj.position.x, p.z - e.obj.position.z) - e.obj.rotation.y;
          while (gy > Math.PI) gy -= Math.PI * 2;
          while (gy < -Math.PI) gy += Math.PI * 2;
          ub.cabeza.rotation.y = Math.max(-0.7, Math.min(0.7, gy)) * 0.6;
          ub.cabeza.rotation.x = Math.max(-0.4, Math.min(0.4, (p.y + 0.6 - e.obj.position.y) * 0.25));
        }
        e.avisoSfx = (e.avisoSfx || 0) - dt;
        if (e.estado === 'ronda' && e.avisoT > 0 && e.avisoSfx <= 0) { e.avisoSfx = 0.45; this.audio.sfx('alert'); }
        this._sombra(e, 0.9);
        const d = Math.hypot(e.obj.position.x - p.x, e.obj.position.z - p.z);
        const dy = Math.abs(e.obj.position.y - (p.y + 0.6));
        if (d < 0.85 && dy < 1.3) {
          if (player.spinning) {
            this._matar(e, { colors: [0xffbe0b, 0x1a1a1a, 0xffffff], sfx: 'bicho_pop', n: 14 });
          } else hit = true;
        }
      } else if (e.kind === 'lamp') {
        // lámpara que se balancea: peligro si te pilla
        e.t += dt;
        const amp = e.amp || 2.6;
        const sw = Math.sin(e.t * (e.period || 2.2));
        e.obj.position.x = e.base.x + sw * amp * 0.5;
        e.obj.rotation.z = sw * 0.5;
        // presentación: la bombilla parpadea, el halo respira y el cono de luz
        // se inclina con el balanceo (barre el suelo del casino)
        const ul = e.obj.userData;
        if (ul.bombilla) {
          const flick = 0.82 + Math.sin(e.t * 28) * 0.08 + (Math.random() < 0.04 ? -0.3 : 0);
          ul.bombilla.material.color.setRGB(flick, flick * 0.92, flick * 0.66);
          ul.halo.material.opacity = 0.14 + flick * 0.12;
          ul.cono.rotation.z = -sw * 0.35;
          ul.cono.material.opacity = 0.08 + flick * 0.07;
        }
        // crujido de la cadena al acercarse (te avisa de que está ahí arriba)
        e.crujido = (e.crujido || 0) - dt;
        if (e.crujido <= 0 && Math.hypot(e.obj.position.x - p.x, e.obj.position.z - p.z) < 5) {
          e.crujido = 2.2; this.audio.sfx('crujido');
        }
        this._aviso(e, { color: 0xffe066, r: 1.0, opacity: 0.28 + Math.sin(e.t * 10) * 0.12, y: 0.05 });
        const d = Math.hypot(e.obj.position.x - p.x, e.obj.position.z - p.z);
        if (d < 0.75 && p.y > 1.6 && p.y < 5.4) {
          if (player.spinning) {
            this._matar(e, { colors: [0xd62828, 0xffe9a8], sfx: 'bicho_pop', n: 12, shake: 0.12 });
          } else hit = true;
        }
      } else if (e.kind === 'candle') {
        // cirio: sube, avisa y cae en picado
        e.t += dt;
        e.cd -= dt;
        const ciclo = 3.6;
        const fase = (e.t % ciclo) / ciclo;
        const suelo = 0.1;
        // presentación: la llama chisporrotea siempre (visible desde lejos)
        const uc = e.obj.userData;
        if (uc.llama) {
          const fl = 0.85 + Math.sin(e.t * 30) * 0.15 + (Math.random() < 0.06 ? 0.35 : 0);
          uc.llama.scale.set(1, fl, 1);
          uc.nucleo.scale.set(1, 0.8 + fl * 0.3, 1);
          uc.halo.material.opacity = 0.16 + fl * 0.14;
          uc.llama.rotation.z = Math.sin(e.t * 9) * 0.12;
        }
        if (fase < 0.25) {
          e.obj.position.y = 14 - (14 - suelo) * (fase / 0.25);
          e.obj.rotation.z = 0;
          if (e.aviso) { e.aviso.material.opacity = 0.25 + fase * 2.4; e.aviso.scale.setScalar(0.8 + fase * 1.6); }
          // chispas de la caída (estela) — avisa antes de impactar
          e._chispa = (e._chispa || 0) - dt;
          if (e._chispa <= 0) {
            e._chispa = 0.07;
            this.fx.burst({ x: e.base.x, y: Math.max(0.4, e.obj.position.y + 1.6), z: e.base.z }, { count: 1, speed: 0.7, up: 0.5, life: 0.4, size: 0.8, colors: [0xffbe0b, 0xff7b00] });
          }
        } else if (fase < 0.42) {
          // impacto: se rompe, salta chispas
          if (!e._golpe) {
            e._golpe = true;
            this.fx.burst({ x: e.base.x, y: 0.7, z: e.base.z }, { count: 16, speed: 6, up: 6, life: 0.8, colors: [0xfff1c0, 0xffbe0b, 0xff7b00] });
            this.fx.addShake(0.3);
            this.audio.sfx('crate');
            const d0 = Math.hypot(e.base.x - p.x, e.base.z - p.z);
            if (d0 < 1.5) hit = true;
          }
          e.obj.position.y = suelo;
          e.obj.visible = Math.floor(e.t * 30) % 2 === 0;
        } else {
          if (e._golpe) e._golpe = false;
          e.obj.visible = false;
          if (e.aviso) { e.aviso.material.opacity = 0; }
          if (fase > 0.9) e.t = 0;
        }
      } else if (e.kind === 'toro') {
        hit = this._updateToro(e, dt, player, hit) || hit;
      } else if (e.kind === 'globo') {
        hit = this._updateGlobo(e, dt, player, hit) || hit;
      } else if (e.kind === 'blindado') {
        hit = this._updateBlindado(e, dt, player, hit) || hit;
      }
    }

    // GOTAS FRÍAS del planeador (proyectiles verticales)
    for (const g of this.projectiles) {
      if (!g.alive) continue;
      g.t += dt;
      g.obj.position.y -= g.vy * dt;
      if (g.obj.userData.cuerpo) g.obj.userData.cuerpo.rotation.y += dt * 7;
      if (g.anillo) {                       // el aro del suelo marca DÓNDE cae
        g.anillo.material.opacity = 0.35 + Math.sin(g.t * 12) * 0.2;
        g.anillo.scale.setScalar(0.9 + Math.min(1, g.t * 0.6) * 0.5);
      }
      if (g.obj.position.y <= 0.35) {
        // SALPICÓN: moja en un radio pequeño; el aro ya lo avisaba
        g.alive = false;
        this.scene.remove(g.obj);
        if (g.anillo) this.scene.remove(g.anillo);
        this.fx.impact({ x: g.x, y: 0.3, z: g.z }, {
          count: 16, speed: 5.5, up: 5.5, life: 0.7, size: 1, colors: [0x59b7e8, 0x9fe1ff, 0xffffff],
          shake: 0.12, flash: 0x9fe1ff, flashSize: 1.6, ring: 0x59b7e8, ringSize: 2.2
        });
        sfxNuevo(this.audio, 'globo_pop');
        if (Math.hypot(g.x - p.x, g.z - p.z) < 1.15 && p.y < 1.2) hit = true;
      }
    }
    this.projectiles = this.projectiles.filter((g) => g.alive);

    // ondas sonoras
    for (const w of this.waves) {
      if (!w.alive) continue;
      w.r += w.speed * dt;
      w.life -= dt;
      w.mesh.scale.setScalar(w.r);
      w.mesh.material.opacity = Math.max(0, 0.95 * (1 - (w.r / w.max) * 0.6));
      if (w.r > w.max || w.life <= 0) { w.alive = false; this.scene.remove(w.mesh); continue; }
      const dist = Math.hypot(w.x - p.x, w.z - p.z);
      // COLISIÓN = BANDA VISIBLE: el anillo dibujado ocupa [0.82·r, 1.0·r].
      // Antes se usaba |dist - r| < 0.55, que disparaba el golpe ANTES de que
      // la onda llegara a dibujarse encima del jugador (el "me dieron antes de
      // saltar" que reportó el usuario). Ahora el golpe cae justo cuando el
      // frente de onda toca el cuerpo del jugador (radio 0.4) y termina cuando
      // la banda lo ha rebasado por completo.
      const inner = w.r * 0.82, outer = w.r, bodyR = 0.4;
      const ringHit = (dist - bodyR) <= outer && (dist + bodyR) >= inner;
      if (ringHit && !w.hitOnce && p.y < w.y + 1.6) {
        // ¿hay un pilar de por medio?
        if (this.hasCover(w.x, w.z, p.x, p.z, ctx)) continue;
        w.hitOnce = true;
        hit = true;
      }
    }
    this.waves = this.waves.filter((w) => w.alive);
    return hit;
  }

  /* ================= TORO BRAVO =================
     paseo → (te ve) aviso 1,7 s con resoplido → embestida recta (hasta 26 m o
     muro) → aturdido 2,2 s (estrellitas, rematable) → recupera. */
  _updateToro(e, dt, player, hit) {
    const p = player.pos;
    const ud = e.obj.userData;
    const pos = e.obj.position;
    e.avisoSfx = Math.max(0, (e.avisoSfx || 0) - dt);
    e.t += dt;

    if (e.estado === 'paseo') {
      // trota despacio en su eje, mirando hacia donde va (recorrido recortado
      // al pasillo real: la auditoría medía toros metidos en el muro)
      const o = this._clampR(e, e.axis === 'z' ? 'z' : 'x', Math.sin(e.t * 1.4) * (e.span || 3) * 0.5);
      pos.x = e.base.x + (e.axis === 'z' ? 0 : o);
      pos.z = e.base.z + (e.axis === 'z' ? o : 0);
      e.obj.rotation.y = (e.axis === 'z' ? (Math.cos(e.t * 1.4) > 0 ? 0 : Math.PI) : (Math.cos(e.t * 1.4) > 0 ? Math.PI / 2 : -Math.PI / 2));
      const paso = Math.sin(e.t * 6);
      if (ud.patas) {
        ud.patas[0].rotation.x = paso * 0.5; ud.patas[1].rotation.x = -paso * 0.5;
        ud.patas[2].rotation.x = -paso * 0.5; ud.patas[3].rotation.x = paso * 0.5;
      }
      pos.y = (e.pisoY || 0) + Math.abs(paso) * 0.04;
      const dist = Math.hypot(pos.x - p.x, pos.z - p.z);
      if (dist < (e.rango || 11) && p.y < 2.2) {
        e.estado = 'aviso'; e.tEstado = 0;
        // bloquea la dirección hacia el jugador (embestida RECTA, evitable)
        const dx = p.x - pos.x, dz = p.z - pos.z;
        const m = Math.hypot(dx, dz) || 1;
        e.dir = { x: dx / m, z: dz / m };
        sfxNuevo(this.audio, 'toro_aviso');
        this.fx.burst({ x: pos.x, y: 0.3, z: pos.z + 0.6 }, { count: 8, speed: 2.4, up: 1.6, life: 0.5, size: 0.9, colors: [0xd9cbb8, 0xffffff] });
      }
    } else if (e.estado === 'aviso') {
      // TELEGRAFÍA: escarba el suelo, resopla (vaho) y el anillo rojo crece
      e.tEstado += dt;
      const k = Math.min(1, e.tEstado / 1.7);
      pos.y = 0;
      e.obj.rotation.y = Math.atan2(e.dir.x, e.dir.z);
      if (ud.patas) { ud.patas[0].rotation.x = -1.1 - Math.sin(e.t * 22) * 0.5; }
      if (ud.cabeza) ud.cabeza.rotation.x = 0.25 * k;
      if (ud.vaho) ud.vaho.material.opacity = (Math.sin(e.t * 20) * 0.5 + 0.5) * 0.5;
      if (ud.tela) ud.tela.rotation.y = 0.3 + Math.sin(e.t * 16) * 0.5;
      this._aviso(e, { color: 0xff2e2e, r: 1.2 + k * 1.1, opacity: 0.35 + k * 0.4, r0: 0.62, r1: 0.82 });
      if (ud.cuerpo) ud.cuerpo.scale.set(1, 0.85 - 0.1 * k, 1.5 - 0.05 * k);   // se agacha
      this._sombra(e, 1.5);
      if (e.tEstado >= 1.7) {
        e.estado = 'embiste'; e.tEstado = 0; e.recorrido = 0;
        if (ud.vaho) ud.vaho.material.opacity = 0;
        if (ud.cuerpo) ud.cuerpo.scale.set(1, 0.85, 1.5);
        sfxNuevo(this.audio, 'toro_embiste');
        this.fx.burst({ x: pos.x, y: 0.4, z: pos.z }, { count: 16, speed: 4.5, up: 2, life: 0.6, colors: [0x9aa5b1, 0xd9cbb8] });
      }
    } else if (e.estado === 'embiste') {
      e.tEstado += dt;
      const V = e.speedCarga || 10.2;
      const nx = pos.x + e.dir.x * V * dt;
      const nz = pos.z + e.dir.z * V * dt;
      e.recorrido += V * dt;
      e.obj.rotation.y = Math.atan2(e.dir.x, e.dir.z);
      const paso = Math.sin(e.tEstado * 26);
      if (ud.patas) { ud.patas[0].rotation.x = paso * 0.9; ud.patas[1].rotation.x = -paso * 0.9; }
      pos.y = Math.abs(paso) * 0.08;
      if (ud.tela) ud.tela.rotation.y = 0.3 + Math.sin(e.tEstado * 14) * 0.6;
      // ¿choque? muro o caja por delante, o vacío (no se tira por un hueco)
      const blocker = this.world && this.world.overlap({ minX: nx - 0.45, maxX: nx + 0.45, minY: 0.15, maxY: 1.5, minZ: nz - 0.45, maxZ: nz + 0.45 },
        (b) => b.solid !== false && b.tag !== 'mover');
      const suelo = this.world && this.world.groundUnder({ minX: nx - 0.4, maxX: nx + 0.4, minZ: nz - 0.4, maxZ: nz + 0.4, minY: -50, maxY: 1.6 });
      if (blocker || !suelo || e.recorrido > 26) {
        // TROMPAZO: se aturde (estrellitas) — aquí se le puede rematar
        e.estado = 'aturdido'; e.tEstado = 0;
        pos.y = 0.06;
        this.fx.impact({ x: pos.x, y: 0.7, z: pos.z }, {
          count: 18, speed: 6, up: 6, life: 0.7, size: 1, colors: [0xfff1c0, 0xffbe0b, 0xffffff],
          shake: 0.32, flash: 0xffe066, flashSize: 2.0, ring: 0xffbe0b, ringSize: 2.4
        });
        sfxNuevo(this.audio, 'toro_trompa');
        if (ud.cabeza) ud.cabeza.rotation.x = 0;
      } else {
        pos.x = nx; pos.z = nz;
        this.fx.burst({ x: pos.x, y: 0.12, z: pos.z - e.dir.z * 0.7 }, { count: 1, speed: 1.2, up: 1.6, life: 0.4, size: 0.9, colors: [0x9aa5b1, 0x6b7280] });
      }
    } else if (e.estado === 'aturdido') {
      // estrellitas girando sobre la cabeza + trompa balanceándose
      e.tEstado += dt;
      pos.y = 0.05 + Math.sin(e.tEstado * 16) * 0.02;
      e.obj.rotation.z = Math.sin(e.tEstado * 9) * 0.22;
      if (ud.cabeza) ud.cabeza.rotation.x = -0.3;
      this._aviso(e, { color: 0xffe066, r: 1.0, opacity: 0.5 + Math.sin(e.tEstado * 14) * 0.3, r0: 0.55, r1: 0.8 });
      if (Math.random() < 0.3) {
        const a = Math.random() * Math.PI * 2;
        this.fx.burst({ x: pos.x + Math.cos(a) * 0.5, y: 1.7, z: pos.z + Math.sin(a) * 0.5 }, { count: 1, speed: 0.6, up: 0.4, life: 0.5, size: 0.8, colors: [0xffe066, 0xffffff] });
      }
      if (e.tEstado > 2.2) { e.estado = 'recover'; e.tEstado = 0; e.obj.rotation.z = 0; if (ud.cabeza) ud.cabeza.rotation.x = 0; }
      // remate fácil: giro o pisotón mientras está aturdido
      const dx = Math.abs(pos.x - p.x), dz = Math.abs(pos.z - p.z);
      if (dx < 1.0 && dz < 1.0) {
        if (player.spinning || (!player.grounded && p.y > 0.9)) {
          this._matar(e, { colors: [0xb31217, 0xffc400, 0xffffff], sfx: 'bicho_pop', n: 20, shake: 0.2 });
          return false;
        }
      }
    } else if (e.estado === 'recover') {
      e.tEstado += dt;
      if (e.tEstado > 1.0) { e.estado = 'paseo'; e.tEstado = 0; e.base = { x: pos.x, z: pos.z }; this._encajarBicho(e); }
    }

    if (e.estado === 'paseo') {
      // patrulla segura: si arranca o acaba la embestida fuera del pasillo, el
      // trotar no debe meterlo en un muro ni sacarlo por un hueco. La corrección
      // mueve la BASE (el seno la reescribe cada frame), 0,06 m/frame.
      if (!this._libre(e.base.x + (e.axis === 'z' ? 0 : this._clampR(e, 'x', 0)), 0, e.base.z + (e.axis === 'z' ? this._clampR(e, 'z', 0) : 0), 0.6, 1.4, false)
          || !this._libre(pos.x, 0, pos.z, 0.6, 1.4, false)) {
        const s2 = Math.sign(e.base.x) || 1;
        e.base.x -= s2 * 0.06;
        this._encajarBicho(e);
      }
    }
    // contacto durante paseo/embestida: hace daño si NO giras y NO vas por
    // encima (salto). Girando en la embestida lo revientas (como en Crash).
    if (e.estado === 'paseo' || e.estado === 'embiste') {
      const dx = Math.abs(pos.x - p.x), dz = Math.abs(pos.z - p.z);
      if (dx < 1.05 && dz < 1.05 && p.y < 1.35) {
        if (player.spinning) {
          this._matar(e, { colors: [0xb31217, 0xffc400, 0xffffff], sfx: 'bicho_pop', n: 20, shake: 0.2 });
          return false;
        }
        if (e.estado === 'embiste') hit = true;
      }
    }
    this._sombra(e, 1.5);
    return hit;
  }

  /* ================= GLOBO PLANEADOR ================= */
  _updateGlobo(e, dt, player, hit) {
    const p = player.pos;
    const ud = e.obj.userData;
    const pos = e.obj.position;
    e.t += dt;
    const H = e.height || 2.7;
    if (e.apuntando > 0) {
      // TELEGRAFÍA: la vela late en rojo, el globo mira al suelo y suena el
      // silbido; el aro de abajo marca el punto EXACTO de caída.
      e.apuntando -= dt;
      if (ud.vela) {
        const k = 1 - e.apuntando / 1.15;
        ud.vela.material.color.setRGB(1, 0.36 - 0.3 * k, 0.36 - 0.3 * k);
        ud.globo.scale.setScalar(1 + Math.sin(e.t * 18) * 0.05);
      }
      const ringOp = 0.35 + Math.sin(e.t * 16) * 0.3;
      this._aviso(e, { color: 0xff2e2e, r: 0.75, opacity: ringOp, r0: 0.2, r1: 0.95 });
      this._sombra(e, 1.4);
      if (e.apuntando <= 0) {
        // suelta la GOTA FRÍA (cae recta; el aro ya avisó dónde)
        const g = makeGotaFria();
        g.position.set(pos.x, pos.y - 1.2, pos.z);
        this.scene.add(g);
        const anillo = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.0, 20), new THREE.MeshBasicMaterial({ color: 0xff2e2e, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
        anillo.rotation.x = -Math.PI / 2; anillo.position.set(pos.x, 0.07, pos.z); anillo.renderOrder = 4;
        this.scene.add(anillo);
        this.projectiles.push({ obj: g, x: pos.x, z: pos.z, y: pos.y, vy: 8.4, t: 0, alive: true, anillo });
        if (ud.vela) { ud.vela.material.color.setHex(0xff5d5d); ud.globo.scale.setScalar(1); }
        sfxNuevo(this.audio, 'globo_dispara');
        this._aviso(e, { color: 0xff5d5d, r: 0.9, opacity: 0 });
      }
    } else {
      // planeo lento + bamboleo (recortado al pasillo); el globo te sigue con la mirada
      pos.x = e.base.x + this._clampR(e, 'x', Math.sin(e.t * 0.7) * (e.span || 3));
      pos.z = e.base.z + this._clampR(e, 'z', Math.cos(e.t * 0.9) * 1.3);
      pos.y = H + Math.sin(e.t * 1.6) * 0.22;
      if (ud.cabeza) {
        let gy = Math.atan2(p.x - pos.x, p.z - pos.z) - e.obj.rotation.y;
        while (gy > Math.PI) gy -= Math.PI * 2;
        while (gy < -Math.PI) gy += Math.PI * 2;
        ud.cabeza.rotation.y = Math.max(-1.1, Math.min(1.1, gy)) * 0.7;
      }
      if (ud.alas) {
        ud.alas[0].rotation.z = 0.12 + Math.sin(e.t * 2.2) * 0.08;
        ud.alas[1].rotation.z = -0.12 - Math.sin(e.t * 2.2) * 0.08;
      }
      if (ud.vela) ud.vela.material.color.setHex(0xff5d5d);
      // ¿toca atacar? avisa primero (1,15 s de silbido + vela roja pulsando)
      e.cd -= dt;
      const dist = Math.hypot(pos.x - p.x, pos.z - p.z);
      if (e.cd <= 0 && dist < 15 && p.y < 3.4) {
        e.cd = (e.period || 3.6) + Math.random() * 1.2;
        e.apuntando = 1.15;
        sfxNuevo(this.audio, 'globo_aviso');
      }
      this._sombra(e, 1.3);
    }
    // se remata con el giro en el aire (saltas y giras) — nunca desde el suelo
    if (player.spinning && p.y > 1.2) {
      const d = Math.hypot(pos.x - p.x, pos.z - p.z);
      if (d < 1.3 && Math.abs(pos.y - (p.y + 0.9)) < 2.0) {
        this._matar(e, { colors: [0xff5d5d, 0xffc400, 0x9fe1ff], sfx: 'bicho_pop', n: 18, shake: 0.18 });
        return false;
      }
    }
    // contacto (si te quedas debajo se te cae encima): daño suave y avisado
    const dx = Math.abs(pos.x - p.x), dz = Math.abs(pos.z - p.z);
    if (dx < 0.9 && dz < 0.9 && Math.abs(pos.y - 1.0 - p.y) < 0.9 && e.apuntando <= 0) hit = true;
    return hit;
  }

  /* ================= BLINDADO (solo muere con el giro) ================= */
  _updateBlindado(e, dt, player, hit) {
    const p = player.pos;
    const ud = e.obj.userData;
    const pos = e.obj.position;
    e.t += dt;

    if (e.estado === 'paseo') {
      const o = this._clampR(e, e.axis === 'z' ? 'z' : 'x', Math.sin(e.t * 1.1) * (e.span || 5) * 0.5);
      pos.x = e.base.x + (e.axis === 'z' ? 0 : o);
      pos.z = e.base.z + (e.axis === 'z' ? o : 0);
      const paso = Math.sin(e.t * 5);
      pos.y = (e.pisoY || 0) + Math.abs(paso) * 0.03;
      e.obj.rotation.y = (e.axis === 'z' ? (Math.cos(e.t * 1.1) > 0 ? 0 : Math.PI) : (Math.cos(e.t * 1.1) > 0 ? Math.PI / 2 : -Math.PI / 2));
      if (ud.patas) { ud.patas[0].rotation.x = paso * 0.5; ud.patas[1].rotation.x = -paso * 0.5; }
      if (ud.luces) for (const l of ud.luces) l.material.color.setHex(0x66ff88);
      const dist = Math.hypot(pos.x - p.x, pos.z - p.z);
      if (dist < 6.5 && p.y < 2.0) {
        e.estado = 'carga'; e.tEstado = 0;
        const dx = p.x - pos.x, dz = p.z - pos.z;
        const m = Math.hypot(dx, dz) || 1;
        e.dir = { x: dx / m, z: dz / m };
      }
    } else if (e.estado === 'carga') {
      // TELEGRAFÍA: las luces del casco parpadean en ROJO y se agacha
      e.tEstado += dt;
      const k = e.tEstado / 0.85;
      e.obj.rotation.y = Math.atan2(e.dir.x, e.dir.z);
      pos.y = -0.06 * Math.min(1, k);           // se agacha (aviso de embestida)
      if (ud.luces) {
        const on = Math.floor(e.tEstado * 10) % 2 === 0;
        for (const l of ud.luces) l.material.color.setHex(on ? 0xff2e2e : 0x5a1a1a);
      }
      this._aviso(e, { color: 0xff2e2e, r: 1.0 + k * 0.5, opacity: 0.4 + k * 0.35, r0: 0.62, r1: 0.85 });
      if (e.tEstado >= 0.85) { e.estado = 'lanzado'; e.tEstado = 0; e.recorrido = 0; sfxNuevo(this.audio, 'coraza'); }
    } else if (e.estado === 'lanzado') {
      // saltitos hacia delante (trompicones) durante ~1,6 s
      e.tEstado += dt;
      const V = e.speedLanzado || 4.4;
      const nx = pos.x + e.dir.x * V * dt;
      const nz = pos.z + e.dir.z * V * dt;
      e.recorrido += V * dt;
      e.obj.rotation.y = Math.atan2(e.dir.x, e.dir.z);
      const hop = Math.abs(Math.sin(e.tEstado * 13));
      pos.y = hop * 0.25;
      if (ud.patas) { ud.patas[0].rotation.x = Math.sin(e.tEstado * 26) * 0.7; ud.patas[1].rotation.x = -Math.sin(e.tEstado * 26) * 0.7; }
      if (ud.luces) for (const l of ud.luces) l.material.color.setHex(0xff2e2e);
      const suelo = this.world && this.world.groundUnder({ minX: nx - 0.4, maxX: nx + 0.4, minZ: nz - 0.4, maxZ: nz + 0.4, minY: -50, maxY: 1.6 });
      if (suelo && !this._solidoEn(nx, nz) && e.recorrido < 6.5) { pos.x = nx; pos.z = nz; }
      else { e.estado = 'paseo'; e.tEstado = 0; e.base = { x: pos.x, z: pos.z }; pos.y = 0; this._encajarBicho(e); }
      if (e.tEstado > 1.6) { e.estado = 'paseo'; e.tEstado = 0; e.base = { x: pos.x, z: pos.z }; pos.y = 0; this._encajarBicho(e); }
      // daño del envite
      const dxx = Math.abs(pos.x - p.x), dzz = Math.abs(pos.z - p.z);
      if (dxx < 0.98 && dzz < 0.98 && p.y < 1.2 && !player.spinning) hit = true;
    }
    // PISOTÓN: le REBOTA (CLANG) — el acorazado NO se muere pisándolo, en
    // ningún estado (contrajuego claro: hay que girarle encima)
    {
      const dx = Math.abs(pos.x - p.x), dz = Math.abs(pos.z - p.z);
      if (dx < 1.05 && dz < 1.05 && !player.grounded && p.y > 1.0 && player.vel.y < -1.0) {
        player.vel.y = 7.6;
        player.grounded = false;
        this.fx.impact({ x: pos.x, y: 0.6, z: pos.z }, {
          count: 10, speed: 4.5, up: 4, life: 0.5, colors: [0xdfe6ee, 0x9aa5b1, 0xffffff],
          shake: 0.14, flash: 0xdfe6ee, flashSize: 1.4, ring: 0x9aa5b1, ringSize: 1.7
        });
        sfxNuevo(this.audio, 'coraza');
      }
    }
    // contacto general (paseo/carga/lanzado): daño salvo giro
    const dx = Math.abs(pos.x - p.x), dz = Math.abs(pos.z - p.z);
    if (dx < 0.95 && dz < 0.95 && p.y < 1.15 && Math.abs(pos.y) < 0.6) {
      if (player.spinning) {
        // EL GIRO LO DESTROZA (única forma): chapa volando + chispas
        this._matar(e, { colors: [0xdfe6ee, PALETA.rojo, 0xffbe0b], sfx: 'coraza_rota', n: 22, shake: 0.25, ring: 0xffbe0b });
        return false;
      }
      if (e.estado === 'lanzado') hit = true;
    }
    this._sombra(e, 1.35);
    return hit;
  }

  hasCover(sx, sz, px, pz, ctx) {
    if (!ctx || !ctx.cover || !ctx.cover.length) return false;
    // raycast 2D: ¿el segmento origen→jugador cruza algún rectángulo de cobertura?
    for (const c of ctx.cover) {
      if (this.segRect(sx, sz, px, pz, c.x - c.hw, c.z - c.hd, c.x + c.hw, c.z + c.hd)) return true;
    }
    return false;
  }

  /* intersección segmento–rectángulo (slab method) */
  segRect(x0, z0, x1, z1, rx0, rz0, rx1, rz1) {
    const dx = x1 - x0, dz = z1 - z0;
    let tmin = 0, tmax = 1;
    for (const [p, d, lo, hi] of [[x0, dx, rx0, rx1], [z0, dz, rz0, rz1]]) {
      if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return false; continue; }
      let t1 = (lo - p) / d, t2 = (hi - p) / d;
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
    return true;
  }

  spawnWave(e) {
    const geo = new THREE.RingGeometry(0.82, 1.0, 48);
    const mat = new THREE.MeshBasicMaterial({
      map: waveTexture(), color: 0xff8fa3, transparent: true, opacity: 0.9,
      side: THREE.DoubleSide, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(e.obj.position.x, 0.35, e.obj.position.z);
    mesh.renderOrder = 5;
    this.scene.add(mesh);
    // ONDA MÁS LENTA (petición del usuario): 7.5 → 4.6 m/s y más aviso
    this.waves.push({ x: e.obj.position.x, z: e.obj.position.z, y: 0.35, r: 0.9, max: 16, speed: 4.6, life: 6, mesh, alive: true, hitOnce: false });
    this.audio.sfx('wave');
  }

  /* el jefe también lanza ondas (más lentas para que se puedan esquivar) */
  spawnBossWave(x, z, speed = 4.2, max = 20) {
    const geo = new THREE.RingGeometry(0.82, 1.0, 48);
    const mat = new THREE.MeshBasicMaterial({
      map: waveTexture(), color: 0xb5179e, transparent: true, opacity: 0.95,
      side: THREE.DoubleSide, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.35, z);
    mesh.renderOrder = 5;
    this.scene.add(mesh);
    this.waves.push({ x, z, y: 0.35, r: 1.0, max, speed, life: 8, mesh, alive: true, hitOnce: false, boss: true });
  }
}
