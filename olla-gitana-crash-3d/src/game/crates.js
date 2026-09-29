/* Sistema de cajas (Worker 2): romper con giro/salto/pisotón, TNT con cuenta
   atrás de 3 s, Nitro explosiva al tacto, cajas ?, !, ✔, hierro y acero. */
import * as THREE from 'three';
import { PALETA } from './art.js';

export class CrateSystem {
  constructor({ scene, fx, audio, hud }) {
    this.scene = scene;
    this.fx = fx;
    this.audio = audio;
    this.hud = hud;
    this.items = [];
    this.total = 0;
    this.broken = 0;
    this.tnts = [];
    this.switchesPulsed = 0;
    this.onBreak = null;
    this.onSwitch = null;
    this.onCheckpoint = null;
    this.onBounceUnlock = null;
    this.time = 0;
  }

  load(crates) {
    this.items = crates;
    this.total = crates.filter((c) => !['checkpoint'].includes(c.crateType)).length;
    this.broken = 0;
    this.tnts = [];
    for (const c of crates) {
      c.dead = false;
      c.hp = (c.crateType === 'steel' || c.crateType === 'iron') ? 2 : 1;
      if (c.mesh) {
        c.mesh.rotation.set(0, 0, 0);
        const spark = c.mesh.userData.spark;
        if (spark) spark.visible = false;
      }
    }
    this.publish();
  }

  publish() {
    if (this.hud) this.hud.setCrates(this.broken, this.total);
  }

  /* caja alcanzada por el giro o el pisotón */
  hit(crate, { fromSpin = false, fromStomp = false, power = 1 } = {}) {
    if (!crate || crate.dead) return false;
    if (crate.crateType === 'iron') {
      // el hierro solo se rompe con el pisotón en el aire o con el aura
      if (!fromStomp && power < 2) { this.audio.sfx('land'); return false; }
    }
    crate.hp -= (fromStomp ? 2 : power);
    if (crate.hp > 0) {
      if (crate.mesh) crate.mesh.userData.hitT = 0.18;
      this.audio.sfx('crate');
      return false;
    }
    return this.break(crate);
  }

  break(crate) {
    if (crate.dead) return false;
    crate.dead = true;

    if (crate.crateType === 'tnt') { this.explode(crate); return true; }
    if (crate.crateType === 'nitro') { this.nitro(crate); return true; }
    if (crate.crateType === 'bounce') { this.bounce(crate); return true; }
    if (crate.crateType === 'switch') { this.pulseSwitch(crate); return true; }
    if (crate.crateType === 'checkpoint') { return false; }

    this.finishBreak(crate, PALETA.madera);
    return true;
  }

  finishBreak(crate, color) {
    crate.dead = true;
    this.broken++;
    this.publish();
    if (crate.mesh) crate.mesh.visible = false;
    if (crate.worldBox) crate.worldBox.solid = false;
    crate.disabled = true;
    this.fx.burst({ x: crate.mesh.position.x, y: crate.mesh.position.y, z: crate.mesh.position.z }, {
      count: 14, color, speed: 5.5, up: 6, life: 0.9, colors: [PALETA.madera, PALETA.maderaOsc, 0xf0c27a]
    });
    this.fx.addShake(0.18);
    this.audio.sfx('crate');
    if (this.onBreak) this.onBreak(crate);
  }

  bounce(crate) {
    crate.dead = false;              // rebota, no se rompe
    crate.bounces = (crate.bounces || 0) + 1;
    const mesh = crate.mesh;
    mesh.position.y = Math.max(0.46, mesh.position.y);
    crate.vy = 9.5;
    crate.bouncing = true;
    if (crate.worldBox) crate.worldBox.pos.y = -100;   // fuera del mundo físico mientras vuela
    this.audio.sfx('bounce');
    if (this.onBounceUnlock) this.onBounceUnlock(crate);
  }

  pulseSwitch(crate) {
    this.switchesPulsed++;
    this.finishBreak(crate, PALETA.azul);
    if (this.onSwitch) this.onSwitch(crate, this.switchesPulsed);
    this.audio.sfx('checkpoint');
  }

  checkpoint(crate) {
    crate.dead = true;
    if (crate.worldBox) crate.worldBox.solid = false;
    if (crate.mesh) {
      crate.mesh.userData.hitT = 0;
      crate.mesh.traverse((c) => { if (c.isMesh && c.material && c.material.color) c.material.color.set(0x38b000); });
    }
    if (this.onCheckpoint) this.onCheckpoint(crate);
  }

  explode(crate) {
    if (crate.mesh) crate.mesh.visible = false;
    if (crate.worldBox) crate.worldBox.solid = false;
    crate.dead = true; crate.disabled = true;
    const p = crate.mesh.position;
    this.fx.burst(p, { count: 26, speed: 8, up: 7, life: 1.1, colors: [0xffbe0b, 0xff7b00, 0xe63946, 0x2b2b2b] });
    this.fx.addShake(0.7);
    this.audio.sfx('boom');
    if (this.onBreak) this.onBreak(crate);
    this.broken++; this.publish();
    this.blast(p, 4.2);
  }

  nitro(crate) {
    if (crate.mesh) crate.mesh.visible = false;
    if (crate.worldBox) crate.worldBox.solid = false;
    crate.dead = true; crate.disabled = true;
    const p = crate.mesh.position;
    this.fx.burst(p, { count: 34, speed: 10, up: 8, life: 1.2, colors: [0x38b000, 0xb7f399, 0xffffff] });
    this.fx.addShake(0.9);
    this.audio.sfx('boom');
    if (this.onBreak) this.onBreak(crate);
    this.broken++; this.publish();
    this.blast(p, 5.0);
  }

  blast(p, radius) {
    // daño en área (el nivel decide qué hacer con él)
    this._blastCb && this._blastCb(p, radius);
  }

  /* TNT: encender mecha */
  igniteTnt(crate) {
    if (crate.lit || crate.dead) return;
    crate.lit = true;
    crate.fuse = 3.0;
    const spark = crate.mesh && crate.mesh.userData.spark;
    if (spark) spark.visible = true;
    this.tnts.push(crate);
    this.audio.sfx('tnt');
  }

  update(dt, player) {
    this.time += dt;
    // TNT encendidas
    for (const t of this.tnts) {
      if (t.dead) continue;
      t.fuse -= dt;
      if (t.mesh) {
        const k = Math.max(0, t.fuse);
        t.mesh.visible = Math.floor(k * 8) % 2 === 0 || k > 0.6;
        t.mesh.position.x += Math.sin(this.time * 60) * 0.012;
      }
      if (t.fuse <= 0) this.explode(t);
    }
    this.tnts = this.tnts.filter((t) => !t.dead);

    // cajas que rebotan
    for (const c of this.items) {
      if (!c.bouncing || c.dead) continue;
      c.vy -= 26 * dt;
      c.mesh.position.y += c.vy * dt;
      c.mesh.rotation.x += dt * 6;
      if (c.mesh.position.y <= 0.46) {
        c.mesh.position.y = 0.46;
        c.bounces++;
        if (c.bounces >= 5) {
          c.bouncing = false; c.dead = false;
          c.mesh.visible = false;
          this.finishBreak(c, PALETA.dorado);
        } else {
          c.vy = 9.5; this.audio.sfx('bounce');
        }
      }
    }

    // destello de golpe
    for (const c of this.items) {
      if (!c.mesh || c.mesh.userData.hitT == null) continue;
      c.mesh.userData.hitT -= dt;
      if (c.mesh.userData.hitT <= 0) {
        c.mesh.userData.hitT = null;
        c.mesh.scale.setScalar(1);
      } else {
        c.mesh.scale.setScalar(1 + Math.sin(c.mesh.userData.hitT * 40) * 0.08);
      }
    }
  }

  /* busca la caja más cercana al punto (para el giro) */
  nearest(pos, radius, filter) {
    let best = null, bd = Infinity;
    for (const c of this.items) {
      if (c.dead || c.disabled || !c.mesh || !c.mesh.visible) continue;
      if (filter && !filter(c)) continue;
      const d = Math.hypot(c.mesh.position.x - pos.x, c.mesh.position.y - (pos.y + 0.6), c.mesh.position.z - pos.z);
      if (d < radius && d < bd) { bd = d; best = c; }
    }
    return best;
  }
}
