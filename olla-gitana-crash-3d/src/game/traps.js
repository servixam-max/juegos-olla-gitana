/* Trampas de la arena del jefe final: cuchillas que cruzan de lado a lado.
   Por cada asalto al Cacharro se activa una tanda nueva (petición del usuario:
   "mete obstáculos para llegar a él, cuchillas en los laterales de lado a lado,
   más difícil, algo nuevo por cada fase").

   Fase 1: 2 cuchillas lentas.
   Fase 2: + 3 cuchillas rápidas y una vertical.
   Fase 3: + doble fila y más veloces (el pasillo se pone criminal). */
import * as THREE from 'three';
import { toonMat, PALETA } from './art.js';

function makeCuchilla(len = 9) {
  const g = new THREE.Group();
  const mat = toonMat(0xc9d1d9);
  const filo = toonMat(0xeef2f6);
  // barra base
  const barra = new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, 0.34), mat);
  barra.position.y = 0.5;
  g.add(barra);
  // dientes (sierras) a lo largo
  const n = Math.max(6, Math.round(len * 2.2));
  for (let i = 0; i < n; i++) {
    const d = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4), filo);
    d.position.set(-len / 2 + 0.3 + (i / (n - 1)) * (len - 0.6), 0.68, 0);
    d.rotation.z = Math.PI;         // punta hacia arriba
    g.add(d);
  }
  // eje decorativo
  const eje = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), toonMat(0x6b7280));
  eje.position.y = 0.25;
  g.add(eje);
  // luz de aviso que parpadea
  const luz = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5d5d }));
  luz.position.set(-len / 2 + 0.2, 0.86, 0);
  g.add(luz);
  g.userData.luz = luz;
  return g;
}

export class TrapSystem {
  constructor({ scene, fx, audio, world }) {
    this.scene = scene;
    this.fx = fx;
    this.audio = audio;
    this.world = world;
    this.traps = [];
    this.fase = 0;
    this.t = 0;
    this.onHit = null;      // callback cuando pillan al jugador
  }

  /* construye las tandas de cuchillas de la arena (una por fase) */
  load() {
    this.clear();
    const defs = [
      // ---- FASE 1: dos cuchillas lentas cruzando el centro ----
      { z: 8, len: 9, speed: 2.2, amp: 9, fase: 1, y: 0 },
      { z: -3, len: 9, speed: 2.4, amp: 9, fase: 1, y: 0 },
      // ---- FASE 2: tres más rápidas + una vertical deslizante ----
      { z: 14, len: 8, speed: 3.4, amp: 10, fase: 2, y: 0 },
      { z: 2, len: 8, speed: 3.6, amp: 10, fase: 2, y: 0 },
      { z: -9, len: 8, speed: 3.2, amp: 10, fase: 2, y: 0 },
      { z: 6, len: 6, speed: 3.0, amp: 7, fase: 2, y: 1.6, vert: true },
      // ---- FASE 3: doble fila y a toda velocidad ----
      { z: 16, len: 10, speed: 4.6, amp: 11, fase: 3, y: 0 },
      { z: 9, len: 10, speed: 4.8, amp: 11, fase: 3, y: 0 },
      { z: 1, len: 10, speed: 5.0, amp: 11, fase: 3, y: 0 },
      { z: -7, len: 10, speed: 4.7, amp: 11, fase: 3, y: 0 },
      { z: -14, len: 10, speed: 4.4, amp: 11, fase: 3, y: 0 }
    ];
    for (const d of defs) {
      const obj = makeCuchilla(d.len);
      if (d.vert) obj.rotation.x = Math.PI / 2;   // filo vertical (rueda que sube)
      obj.position.set(0, d.y, d.z);
      this.scene.add(obj);
      this.traps.push({ ...d, obj, ph: Math.random() * 6.28, activa: false, hitCd: 0 });
    }
    this.fase = 0;
    this.setFase(1);
  }

  clear() {
    for (const t of this.traps) this.scene.remove(t.obj);
    this.traps = [];
    this.fase = 0;
  }

  /* activa los obstáculos hasta la fase n (las anteriores siguen) */
  setFase(n) {
    this.fase = Math.max(this.fase, n);
    for (const t of this.traps) t.activa = t.fase <= this.fase;
  }

  reset() {
    this.fase = 0;
    this.setFase(1);
    for (const t of this.traps) t.hitCd = 0;
  }

  /* ¿pilla al jugador? devuelve true si le da este frame */
  update(dt, player) {
    this.t += dt;
    let hit = false;
    const p = player.pos;
    for (const t of this.traps) {
      if (!t.activa) { if (t.obj) t.obj.visible = false; continue; }
      if (t.obj) t.obj.visible = true;
      t.hitCd = Math.max(0, t.hitCd - dt);
      // vaivén lateral (o vertical si es la rueda)
      const o = Math.sin(this.t * (t.speed * 0.45) + t.ph) * t.amp;
      if (t.vert) {
        t.obj.position.y = t.y + Math.abs(o) * 0.35;
        t.obj.position.x = o;
        t.obj.rotation.z += dt * t.speed * 2.4;
      } else {
        t.obj.position.x = o;
      }
      if (t.obj.userData.luz) {
        t.obj.userData.luz.material.color.setHex((Math.floor(this.t * 4) % 2) ? 0xff2e2e : 0x5a1010);
      }
      // COLISIÓN: la barra es un rectángulo (largo t.len en x, fino en z)
      const dx = Math.abs(p.x - t.obj.position.x);
      const dz = Math.abs(p.z - t.z);
      const dy = Math.abs((p.y + 0.5) - t.obj.position.y);
      if (dx < t.len / 2 + 0.3 && dz < 0.45 && dy < (t.vert ? 1.4 : 1.0) && t.hitCd <= 0) {
        t.hitCd = 1.2;
        hit = true;
        this.fx.burst({ x: p.x, y: p.y + 0.5, z: p.z }, { count: 14, speed: 6, up: 4, life: 0.7, colors: [0xc9d1d9, 0xff5d5d, 0xffffff] });
        this.audio.sfx('crate');
      }
    }
    return hit;
  }
}
