/* Enemigos: amplis patrulleros, altavoces-turret con ondas y amplis rodantes. */
import * as THREE from 'three';
import { makeAmp, makeSpeaker, toonMat, PALETA, makeBarrelRodante } from './art.js';

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

/* ---------- bicho enemigo con bandera de España ----------
   El usuario pidió enemigos que "se noten que son enemigos": bichos con la
   bandera de España (rojo-amarillo-rojo) y cara rara. Son los "pelotas" del
   juego: el patrullero lleva la bandera a la espalda y antenas con ojos. */
function makeBicho({ color = 0x6a1f6a, escala = 1, bandera = true, cara = 'rara' } = {}) {
  const g = new THREE.Group();
  const bodyMat = toonMat(color, { emissive: new THREE.Color(color).multiplyScalar(0.16) });
  // cuerpo: bola rechoncha con patas
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.44, 14, 12), bodyMat);
  body.scale.set(1, 0.92, 1);
  body.position.y = 0.5;
  g.add(body);
  // panza más clara
  const panza = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), toonMat(0xf6e7c9));
  panza.scale.set(1, 0.8, 0.62); panza.position.set(0, 0.4, 0.28);
  g.add(panza);
  // ojos saltones sobre pedúnculos
  const stemMat = toonMat(color);
  const ojoB = new THREE.MeshBasicMaterial({ color: 0xfff8e7 });
  const pupiB = new THREE.MeshBasicMaterial({ color: 0x101010 });
  for (const s of [-1, 1]) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.24, 6), stemMat);
    stem.position.set(s * 0.19, 0.95, 0.06);
    const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.135, 10, 8), ojoB);
    ojo.position.set(s * 0.19, 1.11, 0.06);
    const pupi = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 6), pupiB);
    pupi.position.set(s * 0.21, 1.11, 0.17);
    g.add(stem, ojo, pupi);
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
  // patas cortas
  const pataMat = toonMat(0x2a0d2a);
  for (const s of [-1, 1]) {
    const pata = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.12, 4, 6), pataMat);
    pata.position.set(s * 0.22, 0.12, 0.02);
    g.add(pata);
    const pie = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.24), pataMat);
    pie.position.set(s * 0.22, 0.04, 0.08);
    g.add(pie);
  }
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
    tela.position.set(0, 1.15, -0.3);
    tela.rotation.y = 0.3;
    g.add(tela);
    g.userData.tela = tela;
  }
  g.scale.setScalar(escala);
  g.userData.body = body;
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
  }

  load(defs, levelCtx = {}) {
    // limpia los anteriores
    for (const e of this.list) { if (e.obj) this.scene.remove(e.obj); }
    for (const w of this.waves) this.scene.remove(w.mesh);
    this.list = []; this.waves = [];
    for (const d of defs) {
      if (d.type === 'patrol') this.list.push(this.makePatrol(d));
      else if (d.type === 'turret') this.list.push(this.makeTurret(d));
      else if (d.type === 'roller') this.list.push(this.makeRoller(d));
      else if (d.type === 'bee') this.list.push(this.makeBee(d));
      else if (d.type === 'lamp') this.list.push(this.makeLamp(d));
      else if (d.type === 'candle') this.list.push(this.makeCandle(d));
      else if (d.type === 'barril') this.list.push(this.makeBarrilRodante(d));
    }
  }

  /* abeja: vuela en zigzag a media altura.
     Detalle v2: cuerpo con franjas, cabeza con ojos brillantes que siguen al
     jugador, alas que baten de verdad, antenas, patas, aguijón y halo
     luminoso. Todo lo que debe verse en la oscuridad va con MeshBasicMaterial. */
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
    return { ...d, obj: g, base: { x: d.x, z: d.z }, t: Math.random() * 10, alive: true, kind: 'bee', hp: 1 };
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
    return { ...d, obj: g, base: { x: d.x, y: 5.0, z: d.z }, t: Math.random() * 10, alive: true, kind: 'lamp', hp: 1 };
  }

  /* cirio que cae del cielo (Semana Santa): avisa con sombra y cae.
     Detalle v2: plato de latón, chorretones de cera, pabilo y llama en tres
     capas con halo; mientras cae suelta chispas y el aviso late más rápido. */
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
    return { ...d, obj, base: { x: d.x, z: d.z }, t: Math.random() * 10, alive: true, kind: 'patrol', hp: 1 };
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
    return { ...d, obj, t: Math.random() * 2, alive: true, kind: 'turret', cd: d.period || 2.0, hp: 2 };
  }
  makeRoller(d) {
    // bicho gordo rodante (rojo, con bandera): el que empuja sin piedad
    const obj = makeBicho({ color: 0x8f2a2a, escala: 1.55, bandera: true });
    obj.position.set(d.x, 0, d.z);
    this.scene.add(obj);
    return { ...d, obj, alive: true, kind: 'roller', vz: -(d.speed || 8), base: { x: d.x, z: d.z }, hp: 1 };
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

  /* Devuelve true si el jugador recibe daño este frame */
  update(dt, player, ctx) {
    let hit = false;
    const p = player.pos;
    const playerBox = { minX: p.x - 0.4, maxX: p.x + 0.4, minZ: p.z - 0.4, maxZ: p.z + 0.4, minY: p.y + 0.05, maxY: p.y + player.hitHeight - 0.1 };

    for (const e of this.list) {
      if (!e.alive) continue;
      if (e.kind === 'patrol') {
        e.t += dt * (e.speed || 3) * 0.5;
        const o = Math.sin(e.t) * (e.span || 6) * 0.5;
        if (e.axis === 'z') { e.obj.position.z = e.base.z + o; e.obj.position.x = e.base.x; }
        else { e.obj.position.x = e.base.x + o; e.obj.position.z = e.base.z; }
        e.obj.rotation.y = Math.sin(e.t) * 0.5;
        e.obj.position.y = Math.abs(Math.sin(e.t * 3)) * 0.06;
        // daño por contacto (salvo si el jugador gira)
        const dx = Math.abs(e.obj.position.x - p.x), dz = Math.abs(e.obj.position.z - p.z);
        if (dx < 0.75 && dz < 0.75 && Math.abs(p.y - 0) < 1.1) {
          if (player.spinning) {
            e.alive = false;
            this.fx.burst({ x: e.obj.position.x, y: 0.5, z: e.obj.position.z }, { count: 16, color: 0x9aa5b1, speed: 5, up: 5, life: 0.8, colors: [0x9aa5b1, PALETA.rojo, 0x2b2b2b] });
            this.audio.sfx('crate');
            this.scene.remove(e.obj);
          } else if (player.grounded === false && p.y > 1.0) {
            // pisotón: también lo revienta
            e.alive = false;
            this.fx.burst({ x: e.obj.position.x, y: 0.5, z: e.obj.position.z }, { count: 12, color: 0x9aa5b1, speed: 4, up: 4, life: 0.7 });
            this.audio.sfx('crate');
            this.scene.remove(e.obj);
          } else hit = true;
        }
      } else if (e.kind === 'turret') {
        e.t += dt;
        e.obj.rotation.y = Math.sin(e.t * 0.6) * 0.9;
        e.flash = Math.max(0, (e.flash || 0) - dt);
        // la luz del altavoz late siempre y destella al disparar (se ve de noche)
        const luz = e.obj.userData.luz;
        if (luz) {
          const on = e.flash > 0;
          luz.material.color.setHex(on ? 0xffffff : 0xff5d5d);
          luz.scale.setScalar(on ? 1.9 : 1 + Math.sin(e.t * 7) * 0.16);
        }
        e.cd -= dt;
        if (e.cd <= 0) {
          e.cd = e.period || 2.0;
          e.flash = 0.3;
          this.spawnWave(e);
        }
      } else if (e.kind === 'roller') {
        e.obj.position.z += e.vz * dt;
        e.obj.rotation.x -= e.vz * dt * 0.4;
        if (e.obj.position.z < e.base.z - 26) { e.obj.position.z = e.base.z + 8; }
        if (e.obj.position.z < -6) { e.obj.position.z = e.base.z; }
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
        // aviso sonoro periódico mientras rueda
        e.sfxT = (e.sfxT || 0) - dt;
        if (e.sfxT <= 0) { e.sfxT = 0.34; this.audio.sfx('rodar'); }
        // el tramo es largo: al llegar al final vuelve arriba a empezar
        if (e.obj.position.z < e.base.z - 30) e.obj.position.z = e.base.z + 6;
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
        // zigzag a media altura
        e.t += dt;
        e.obj.position.x = e.base.x + Math.sin(e.t * 1.8) * (e.span || 5);
        e.obj.position.z = e.base.z + Math.cos(e.t * 1.1) * 1.6;
        e.obj.position.y = (e.height || 2.4) + Math.sin(e.t * 4.2) * 0.45;
        e.obj.rotation.y = Math.sin(e.t * 1.8) * 0.8;
        // presentación: alas batiendo, halo latiendo y ojos que siguen al jugador
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
        const d = Math.hypot(e.obj.position.x - p.x, e.obj.position.z - p.z);
        const dy = Math.abs(e.obj.position.y - (p.y + 0.6));
        if (d < 0.85 && dy < 1.3) {
          if (player.spinning) {
            e.alive = false;
            this.fx.burst({ x: e.obj.position.x, y: e.obj.position.y, z: e.obj.position.z }, { count: 14, speed: 5, up: 4, life: 0.7, colors: [0xffbe0b, 0x1a1a1a, 0xffffff] });
            this.audio.sfx('crate');
            this.scene.remove(e.obj);
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
        const d = Math.hypot(e.obj.position.x - p.x, e.obj.position.z - p.z);
        if (d < 0.75 && p.y > 1.6 && p.y < 5.4) {
          if (player.spinning) {
            e.alive = false;
            this.fx.burst({ x: e.obj.position.x, y: e.obj.position.y, z: e.obj.position.z }, { count: 12, speed: 4, up: 4, life: 0.7, colors: [0xd62828, 0xffe9a8] });
            this.audio.sfx('crate');
            this.scene.remove(e.obj);
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
      }
    }

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