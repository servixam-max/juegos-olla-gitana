/* Jefe final: "EL CACHARRO" (Worker 3)
   3 fases con patrones rítmicos:
   F1: lanza amplis rodantes y pisa fuerte (ondas lentas)
   F2: ráfaga de ondas + salto que aturde; cajas TNT rebotando
   F3: combo: ondas + amplis + devolución de cajones (vulnerable)
   Se le devuelven los cajones con el giro para dañarlo. */
import * as THREE from 'three';
import { makeBoss, makeCrate, makeNote, PALETA, toonMat } from './art.js';

export class Boss {
  constructor({ scene, fx, audio, enemies, pickups }) {
    this.scene = scene;
    this.fx = fx;
    this.audio = audio;
    this.enemies = enemies;
    this.pickups = pickups;
    this.obj = null;
    this.hp = 3;
    this.maxHp = 3;
    this.phase = 1;
    this.phaseT = 0;
    this.state = 'idle';
    this.t = 0;
    this.cd = 2.5;
    this.crateTimer = 4;
    this.projectiles = [];
    this.alive = false;
    this.onHp = null;
    this.onDefeat = null;
    this.onPhase = null;
    this.hitFlash = 0;
    this.baseScale = 1;
  }

  start() {
    if (this.obj) this.scene.remove(this.obj);
    this.obj = makeBoss();
    this.obj.position.set(0, 0, -8);
    this.scene.add(this.obj);
    this.hp = this.maxHp = 3;
    this.phase = 1;
    this.phaseT = 0;
    this.t = 0;
    this.cd = 2.2;
    this.crateTimer = 4.5;
    this.state = 'idle';
    this.alive = true;
    this.projectiles.forEach((p) => this.scene.remove(p.mesh));
    this.projectiles = [];
    this.onHp && this.onHp(this.hp, this.maxHp);
  }

  get pos() { return this.obj ? this.obj.position : { x: 0, y: 0, z: 0 }; }

  update(dt, player) {
    if (!this.alive || !this.obj) return false;
    this.t += dt;
    this.phaseT += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 3);

    // fase por vida
    const newPhase = 3 - Math.max(0, this.hp - 1) >= 3 ? 3 : Math.max(1, 3 - this.hp);
    if (newPhase !== this.phase) {
      this.phase = newPhase;
      this.phaseT = 0;
      this.audio.sfx('phase');
      this.onPhase && this.onPhase(this.phase);
      this.fx.burst({ x: this.pos.x, y: 2, z: this.pos.z }, { count: 24, speed: 6, up: 6, life: 0.9, colors: [0xb5179e, 0xffbe0b, 0x4cc9f0] });
    }

    // mirar al jugador
    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
    this.obj.rotation.y = Math.atan2(dx, dz) * 0.35;

    // balanceo de brazos
    const ud = this.obj.userData;
    const sway = Math.sin(this.t * (2 + this.phase)) * 0.16;
    ud.armL.rotation.z = 0.3 + sway;
    ud.armR.rotation.z = -0.3 + sway;
    this.obj.position.y = Math.abs(Math.sin(this.t * 2.2)) * 0.06;
    if (this.hitFlash > 0) this.obj.position.x = (Math.random() - 0.5) * 0.16;

    let hitPlayer = false;

    // ---- ataques ----
    this.cd -= dt;
    // el jefe también es vulnerable al pisotón desde arriba (para rematarlo)
    const distP = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
    if (distP < 2.2 && player.pos.y > 4.0 && player.vel.y < -2.5) {
      this.hit(1);
      player.vel.y = 10;
      this.fx.burst({ x: this.pos.x, y: 4.2, z: this.pos.z }, { count: 20, speed: 6, up: 7, life: 1.0, colors: [0xffbe0b, 0xffffff] });
      this.audio.sfx('bounce');
    }
    if (this.cd <= 0) {
      const phase = this.phase;
      if (phase === 1) {
        this.enemies.spawnBossWave(this.pos.x, this.pos.z, 6.0, 18);
        this.audio.sfx('wave');
        this.cd = 2.4;
      } else if (phase === 2) {
        // ráfaga de 2 ondas + salto
        this.enemies.spawnBossWave(this.pos.x, this.pos.z, 6.6, 19);
        this.pendingWave = 0.45;   // segunda onda diferida (sin setTimeout)
        this.audio.sfx('wave');
        this.jump = 0.6;
        this.cd = 2.2;
      } else {
        // fase 3: ondas + lanzamiento
        this.enemies.spawnBossWave(this.pos.x, this.pos.z, 7.2, 21);
        this.audio.sfx('wave');
        this.launchCrate(player);
        this.cd = 1.9;
      }
    }
    // onda diferida de la fase 2
    if (this.pendingWave > 0) {
      this.pendingWave -= dt;
      if (this.pendingWave <= 0) {
        this.pendingWave = 0;
        if (this.alive) this.enemies.spawnBossWave(this.pos.x, this.pos.z, 5.0, 15);
      }
    }

    // salto del jefe (fase 2+)
    if (this.jump > 0) {
      this.jump -= dt;
      this.obj.position.y = Math.abs(Math.sin((0.6 - this.jump) * 8)) * 1.4;
      if (this.jump <= 0) {
        this.obj.position.y = 0;
        this.fx.addShake(0.5);
        this.audio.sfx('boom');
        this.enemies.spawnBossWave(this.pos.x, this.pos.z, 9.5, 12);
      }
    }

    // lanza cajones al jugador (para devolvérselos) — Fermín también
    this.crateTimer -= dt;
    if (this.crateTimer <= 0) {
      this.crateTimer = this.phase === 3 ? 2.6 : 4.2;
      this.launchCrate(player);
    }
    // ---- proyectiles (cajones voladores) ----
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += dt * 6; p.mesh.rotation.y += dt * 5;
      p.vy -= 5 * dt;
      p.life -= dt;
      p.trail -= dt;
      if (p.trail <= 0 && this.fx) { p.trail = 0.06; this.fx.burst({ x: p.mesh.position.x, y: p.mesh.position.y, z: p.mesh.position.z }, { count: 1, color: PALETA.dorado, speed: 0.6, up: 0.4, life: 0.3, size: 0.5 }); }
      const d = Math.hypot(p.mesh.position.x - player.pos.x, p.mesh.position.y - (player.pos.y + 0.6), p.mesh.position.z - player.pos.z);
      if (d < (player.spinning ? 1.5 : 0.9)) {
        if (player.spinning) {
          // DEVOLUCIÓN: el cajón vuelve al jefe y le hace daño
          p.alive = false;
          this.scene.remove(p.mesh);
          this.hit(1);
          this.fx.burst({ x: this.pos.x, y: 2.2, z: this.pos.z }, { count: 22, speed: 6, up: 6, life: 0.9, colors: [0xffbe0b, 0xe63946] });
        } else {
          p.alive = false;
          this.scene.remove(p.mesh);
          hitPlayer = true;
        }
      }      if (p.mesh.position.y < 0.2 || p.life <= 0) {
        p.alive = false;
        this.scene.remove(p.mesh);
        this.fx.burst({ x: p.mesh.position.x, y: 0.4, z: p.mesh.position.z }, { count: 10, color: PALETA.madera, speed: 4, up: 4, life: 0.7 });
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.alive);

    return hitPlayer;
  }

  launchCrate(player) {
    const m = makeCrate('tnt');
    m.scale.setScalar(0.9);
    m.position.set(this.pos.x, 2.6, this.pos.z);
    this.scene.add(m);
    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
    const dist = Math.max(1, Math.hypot(dx, dz));
    const speed = 9.5 + this.phase;
    this.projectiles.push({
      mesh: m, alive: true, life: 4.5, trail: 0.06,
      vx: (dx / dist) * speed, vz: (dz / dist) * speed, vy: 3.6
    });
    this.audio.sfx('throw');
  }

  hit(n = 1) {
    if (!this.alive) return;
    this.hp -= n;
    this.hitFlash = 1;
    this.audio.sfx('crate');
    this.fx.addShake(0.4);
    this.onHp && this.onHp(this.hp, this.maxHp);
    if (this.hp <= 0) this.defeat();
  }

  defeat() {
    this.alive = false;
    this.audio.sfx('victory');
    this.fx.addShake(1.2);
    this.fx.burst({ x: this.pos.x, y: 2.4, z: this.pos.z }, { count: 54, speed: 11, up: 9, life: 1.6, colors: [0xffbe0b, 0xe63946, 0x4cc9f0, 0x38b000, 0xffffff] });
    this.deathT = 1.35;
    this.deathStep = 0;
  }

  /* animación de derrota basada en tiempo de juego (sin setInterval) */
  updateDeath(dt) {
    if (this.deathT == null) return;
    this.deathT -= dt;
    const obj = this.obj;
    if (obj) {
      this.deathStep += dt;
      obj.position.x += (Math.random() - 0.5) * 0.18;
      obj.rotation.z += (Math.random() - 0.5) * 0.1;
      if (this.deathT < 1.0) obj.position.y = Math.max(0, obj.position.y - dt * 0.6);
      this.fx.burst({ x: obj.position.x + (Math.random() - 0.5) * 2, y: 1 + Math.random() * 3, z: obj.position.z + (Math.random() - 0.5) * 2 },
        { count: 2, speed: 7, up: 6, life: 0.9, colors: [0xffbe0b, 0xff7b00, 0x2b2b2b] });
    }
    if (this.deathT <= 0) {
      this.deathT = null;
      if (obj) obj.visible = false;
      this.fx.confettiBurst();
      this.onDefeat && this.onDefeat();
    }
  }
}
