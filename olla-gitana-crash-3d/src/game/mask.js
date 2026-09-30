/* Máscara compañera (tipo Aku Aku): sigue a la olla, aguanta un golpe y
   desaparece, mejora al coger otra y con 3 se vuelve invulnerable 1 minuto.
   Niveles de máscara: 1 (básica), 2 (con plumas pintadas), 3 (dorada radiactiva). */
import * as THREE from 'three';
import { toonMat, PALETA } from './art.js';

export class MaskCompanion {
  constructor(scene) {
    this.scene = scene;
    this.nivel = 0;
    this.invT = 0;          // invulnerabilidad restante cuando nivel 3
    this.obj = null;
    this.t = 0;
    this.hideT = 0;         // pequeña animación al romperse
    this.onChange = null;
  }

  /* construye la máscara del nivel pedido (1..3) */
  build(nivel) {
    if (this.obj) { this.scene.remove(this.obj); this.obj = null; }
    if (nivel <= 0) return;
    const g = new THREE.Group();

    // cara: madera clara (n1), más oscura y pintada (n2), dorada (n3)
    const faceCol = nivel === 3 ? 0xffd23f : (nivel === 2 ? 0xc98a3c : PALETA.madera);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), toonMat(faceCol));
    face.scale.set(1, 1.25, 0.72);
    g.add(face);

    // ojos (blancos con pupila) — brillan solos para leerse en sitios oscuros
    const eyeW = new THREE.MeshBasicMaterial({ color: 0xfff8e7 });
    const eyeB = new THREE.MeshBasicMaterial({ color: 0x15100a });
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), eyeW);
      w.position.set(s * 0.115, 0.09, 0.19);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), eyeB);
      b.position.set(s * 0.115, 0.09, 0.245);
      g.add(w, b);
    }
    // boca sonriente
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 12, Math.PI), toonMat(0x3b2a12));
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, -0.08, 0.2);
    g.add(mouth);

    // pintura roja de guerra (n2 y n3)
    if (nivel >= 2) {
      const paint = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 6, 18), toonMat(PALETA.rojo));
      paint.position.z = 0.05;
      g.add(paint);
    }
    // plumas (n2: 1, n3: 3 doradas)
    const featherMat = toonMat(nivel === 3 ? 0xffbe0b : PALETA.amarillo);
    const nFeathers = nivel === 3 ? 3 : (nivel === 2 ? 1 : 0);
    for (let i = 0; i < nFeathers; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.32, 6), featherMat);
      const a = (i - (nFeathers - 1) / 2) * 0.5;
      f.position.set(Math.sin(a) * 0.16, 0.42, -0.06 + Math.cos(a) * 0.02);
      f.rotation.z = a * 0.8;
      g.add(f);
    }
    // aura dorada del nivel 3 (se ve desde lejos)
    if (nivel === 3) {
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.18, depthWrite: false })
      );
      g.add(halo);
      g.userData.halo = halo;
    }
    g.scale.setScalar(1.15);
    this.obj = g;
    this.scene.add(g);
  }

  /* coge una máscara: sube de nivel; al 3 → invulnerable 60 s */
  add() {
    if (this.invT > 0) return 3;              // ya está en modo dorado
    this.nivel = Math.min(3, this.nivel + 1);
    this.build(this.nivel);
    if (this.nivel === 3) this.invT = 60;
    if (this.onChange) this.onChange(this.nivel);
    return this.nivel;
  }

  /* un golpe: la máscara lo absorbe y se va (o baja de nivel) */
  hit() {
    if (this.invT > 0) return false;          // dorada: no la tumban
    if (this.nivel <= 0) return false;
    this.nivel--;
    this.hideT = 0.45;
    this.build(this.nivel > 0 ? this.nivel : 0);
    if (this.onChange) this.onChange(this.nivel);
    return true;
  }

  get invulnerable() { return this.invT > 0; }

  reset() {
    this.nivel = 0;
    this.invT = 0;
    this.hideT = 0;
    this.build(0);
  }

  update(dt, player, camera) {
    this.t += dt;
    if (this.invT > 0) {
      this.invT -= dt;
      if (this.invT <= 0) { this.nivel = 0; this.build(0); if (this.onChange) this.onChange(0); }
    }
    if (!this.obj) return;
    // sigue a la olla: un poco por detrás y arriba, flotando
    const p = player.pos;
    const bob = Math.sin(this.t * 2.6) * 0.11;
    const targetX = p.x - Math.sin(player.facing) * 0.55;
    const targetZ = p.z - Math.cos(player.facing) * 0.55;
    this.obj.position.x += (targetX - this.obj.position.x) * Math.min(1, dt * 6);
    this.obj.position.z += (targetZ - this.obj.position.z) * Math.min(1, dt * 6);
    this.obj.position.y += ((p.y + 1.5 + bob) - this.obj.position.y) * Math.min(1, dt * 6);
    // mira hacia la cámara (siempre se ve la cara)
    if (camera) {
      const dx = camera.position.x - this.obj.position.x;
      const dz = camera.position.z - this.obj.position.z;
      this.obj.rotation.y = Math.atan2(dx, dz);
    }
    // balanceo suave
    this.obj.rotation.z = Math.sin(this.t * 2.2) * 0.12;
    if (this.obj.userData.halo) {
      this.obj.userData.halo.scale.setScalar(1 + Math.sin(this.t * 5) * 0.12);
    }
    if (this.hideT > 0) this.hideT -= dt;
  }
}
