/* Enemigos: amplis patrulleros, altavoces-turret con ondas y amplis rodantes. */
import * as THREE from 'three';
import { makeAmp, makeSpeaker, toonMat, PALETA } from './art.js';

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
    }
  }

  /* abeja: vuela en zigzag a media altura */
  makeBee(d) {
    const g = new THREE.Group();
    const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), toonMat(0xffbe0b));
    cuerpo.scale.set(1, 0.85, 1.25);
    for (let i = 0; i < 2; i++) {
      const franja = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 6, 12), toonMat(0x1a1a1a));
      franja.position.z = -0.16 + i * 0.34;
      g.add(franja);
    }
    const alaMat = new THREE.MeshToonMaterial({ color: 0xdff3ff, transparent: true, opacity: 0.7 });
    for (const s of [-1, 1]) {
      const ala = new THREE.Mesh(new THREE.CircleGeometry(0.26, 10), alaMat);
      ala.position.set(s * 0.26, 0.22, 0);
      ala.rotation.set(-0.4, s * 0.4, 0);
      g.add(ala);
    }
    const aguijon = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 6), toonMat(0x2b2b2b));
    aguijon.rotation.x = Math.PI / 2; aguijon.position.z = 0.42;
    g.add(cuerpo, aguijon);
    g.position.set(d.x, d.height || 2.4, d.z);
    this.scene.add(g);
    return { ...d, obj: g, base: { x: d.x, z: d.z }, t: Math.random() * 10, alive: true, kind: 'bee', hp: 1 };
  }

  /* lámpara oscilante del casino: va y viene colgada */
  makeLamp(d) {
    const g = new THREE.Group();
    const cadena = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), toonMat(0x9aa5b1));
    cadena.position.y = 1.2;
    const pantalla = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.7, 10), toonMat(0xd62828));
    pantalla.position.y = -0.15;
    const bombilla = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    bombilla.position.y = -0.55;
    g.add(cadena, pantalla, bombilla);
    g.position.set(d.x, 5.0, d.z);
    this.scene.add(g);
    return { ...d, obj: g, base: { x: d.x, y: 5.0, z: d.z }, t: Math.random() * 10, alive: true, kind: 'lamp', hp: 1 };
  }

  /* cirio que cae del cielo (Semana Santa): avisa con sombra y cae */
  makeCandle(d) {
    const g = new THREE.Group();
    const cera = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 1.6, 10), toonMat(0xfff1c0));
    cera.position.y = 0.8;
    const llama = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffbe0b }));
    llama.position.y = 1.7;
    g.add(cera, llama);
    g.position.set(d.x, 12, d.z);
    this.scene.add(g);
    // marca en el suelo (aviso)
    const aviso = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 16), new THREE.MeshBasicMaterial({ color: 0xff5d5d, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    aviso.rotation.x = -Math.PI / 2; aviso.position.set(d.x, 0.06, d.z);
    this.scene.add(aviso);
    return { ...d, obj: g, aviso, base: { x: d.x, z: d.z }, t: Math.random() * 3, alive: true, kind: 'candle', hp: 1, cd: d.period || 2.8 };
  }

  makePatrol(d) {
    const obj = makeAmp();
    // el ampli se veía como un bloque negro: se le da carácter (ojos, boca,
    // ribete dorado) para que se lea como enemigo y no como un cuadrado oscuro
    obj.traverse((c) => { if (c.isMesh && c.material && c.material.color) c.material.color.set(0x2f2f3a); });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff5d5d });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), eyeMat);
      eye.position.set(s * 0.2, 0.42, 0.28);
      obj.add(eye);
    }
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.54), toonMat(PALETA.dorado));
    rib.position.y = 0.58;
    obj.add(rib);
    // ruedas para que se lea "rodante"
    const wheelMat = toonMat(0x141414);
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 10), wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(s * 0.42, 0.13, 0);
      obj.add(w);
    }
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
    const obj = makeAmp();
    obj.scale.setScalar(1.5);
    obj.traverse((c) => { if (c.isMesh && c.material && c.material.color) c.material.color.set(0x6a1f1f); });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffbe0b });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeMat);
      eye.position.set(s * 0.22, 0.5, 0.3);
      obj.add(eye);
    }
    obj.position.set(d.x, 0, d.z);
    this.scene.add(obj);
    return { ...d, obj, alive: true, kind: 'roller', vz: -(d.speed || 8), base: { x: d.x, z: d.z }, hp: 1 };
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
        e.cd -= dt;
        if (e.cd <= 0) {
          e.cd = e.period || 2.0;
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
      } else if (e.kind === 'bee') {
        // zigzag a media altura
        e.t += dt;
        e.obj.position.x = e.base.x + Math.sin(e.t * 1.8) * (e.span || 5);
        e.obj.position.z = e.base.z + Math.cos(e.t * 1.1) * 1.6;
        e.obj.position.y = (e.height || 2.4) + Math.sin(e.t * 4.2) * 0.45;
        e.obj.rotation.y = Math.sin(e.t * 1.8) * 0.8;
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
        e.obj.position.x = e.base.x + Math.sin(e.t * (e.period || 2.2)) * amp * 0.5;
        e.obj.rotation.z = Math.sin(e.t * (e.period || 2.2)) * 0.5;
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
        if (fase < 0.25) {
          e.obj.position.y = 14 - (14 - suelo) * (fase / 0.25);
          e.obj.rotation.z = 0;
          if (e.aviso) { e.aviso.material.opacity = 0.25 + fase * 2.4; e.aviso.scale.setScalar(0.8 + fase * 1.6); }
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
    this.waves.push({ x: e.obj.position.x, z: e.obj.position.z, y: 0.35, r: 0.9, max: 16, speed: 7.5, life: 4, mesh, alive: true, hitOnce: false });
    this.audio.sfx('wave');
  }

  /* el jefe también lanza ondas */
  spawnBossWave(x, z, speed = 6.5, max = 20) {
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
    this.waves.push({ x, z, y: 0.35, r: 1.0, max, speed, life: 6, mesh, alive: true, hitOnce: false, boss: true });
  }
}
