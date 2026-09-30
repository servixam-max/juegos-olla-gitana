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
    // rugido de entrada (el jefe se presenta)
    this.audio.sfx('bossroar');
    // anillo de telegrafía del golpe (solo presentación: no colisiona con nada)
    if (!this.tell) {
      this.tell = new THREE.Mesh(
        new THREE.RingGeometry(2.0, 2.5, 40),
        new THREE.MeshBasicMaterial({ color: 0xff5d5d, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
      );
      this.tell.rotation.x = -Math.PI / 2;
      this.tell.renderOrder = 4;
      this.tell.visible = false;
      this.scene.add(this.tell);
    }
    this.onHp && this.onHp(this.hp, this.maxHp);
  }

  get pos() { return this.obj ? this.obj.position : { x: 0, y: 0, z: 0 }; }

  update(dt, player) {
    if (!this.alive || !this.obj) return false;
    this.t += dt;
    this.phaseT += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 3);

    // fase por vida: hp 3 → fase 1, hp 2 → fase 2, hp 1 → fase 3
    // OJO: antes era `3 - Math.max(0, hp-1) >= 3 ? 3 : ...` y la precedencia lo
    // dejaba en `(3-x)>=3` → la fase 2 nunca se alcanzaba (bug de QA).
    const newPhase = Math.min(3, 4 - this.hp);
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
    // (a) balanceo normal; el golpe de ataque y el pisotón lo sobreescriben abajo
    ud.armL.rotation.z = 0.3 + sway;
    ud.armR.rotation.z = -0.3 + sway;
    this.obj.position.y = Math.abs(Math.sin(this.t * 2.2)) * 0.06;
    if (this.hitFlash > 0) this.obj.position.x = (Math.random() - 0.5) * 0.16;

    /* ---- presentación v2 (solo visual: nada de esto toca daño ni fases) ---- */
    // (b) los ojos siguen al jugador: pupilas dentro del ojo, ceño y antena
    const ang = Math.atan2(dx, dz);
    if (ud.pupL) {
      const off = Math.max(-1, Math.min(1, ang - this.obj.rotation.y));
      const mirada = (this.hitFlash > 0 ? 1.6 : 1) * off;
      ud.pupL.position.x = -0.34 + mirada * 0.1;
      ud.pupR.position.x = 0.34 + mirada * 0.1;
      ud.pupL.position.y = 4.14 - 0.05 + Math.sin(this.t * 3) * 0.012;
      ud.pupR.position.y = ud.pupL.position.y;
      ud.browL.rotation.z = -0.42 - Math.max(0, off) * 0.3;
      ud.browR.rotation.z = 0.42 - Math.min(0, off) * 0.3;
      ud.antennaTip.scale.setScalar(1 + Math.sin(this.t * 6) * 0.25 + this.hitFlash * 1.4);
    }
    // (c) indicador de vida: 1 corazón encendido por punto de vida
    if (ud.corazones) {
      for (let i = 0; i < ud.corazones.length; i++) {
        const vivo = i < this.hp;
        const c = ud.corazones[i];
        c.visible = vivo;
        if (vivo) c.scale.setScalar(0.85 + Math.sin(this.t * 5 + i) * 0.06);
      }
      if (ud.ledVida) {
        const col = this.hp <= 1 ? 0xff2e2e : (this.hp === 2 ? 0xff9500 : 0x4cc9f0);
        ud.ledVida.material.color.setHex(col);
        ud.ledVida.scale.setScalar(1 + Math.sin(this.t * 7) * 0.2 + this.hitFlash * 1.2);
      }
    }
    // (d) humo del motor + chispas cuando está tocado (más denso en fase 1 de vida)
    this._humoT = (this._humoT || 0) - dt;
    if (this._humoT <= 0) {
      this._humoT = this.hp <= 1 ? 0.16 : 0.3;
      this.fx.burst({ x: this.pos.x + (Math.random() - 0.5) * 1.2, y: 4.9, z: this.pos.z - 0.4 },
        { count: 1, speed: 0.5, up: 1.5, life: 0.9, size: 1.1, colors: [0x6a6a7a, 0x9a9aa8] });
      if (this.hp >= 2 && Math.random() < 0.25) {
        this.fx.burst({ x: this.pos.x + (Math.random() - 0.5) * 1.4, y: 1.2, z: this.pos.z + 0.6 },
          { count: 1, speed: 1.4, up: 0.8, life: 0.4, size: 0.6, colors: [0xffbe0b, 0xff7b00] });
      }
    }

    let hitPlayer = false;

    // ---- ataques ----
    this.cd -= dt;
    // (e) golpe de ataque: al acercarse el contador el jefe levanta los brazos
    //     y aparece un anillo rojo que marca el alcance (solo presentación)
    if (this.cd < 0.42 && this.cd > 0.0 && this.alive) {
      const alza = Math.min(0.5, (0.42 - this.cd) * 1.1);
      ud.armL.rotation.z = 0.5 + alza;
      ud.armR.rotation.z = -0.5 - alza;
      if (!this._golpeHecho) { this._golpeHecho = true; this.fx.addShake(0.22); this.audio.sfx('warn'); }
      if (this.tell && !this.tellOff) {
        this.tell.visible = true;
        this.tell.position.set(this.pos.x, 0.06, this.pos.z);
        const k = (0.42 - this.cd) / 0.42;              // 0 → 1 conforme carga
        this.tell.scale.setScalar(0.6 + k * 0.6);
        this.tell.material.opacity = 0.18 + k * 0.5;
        this.tell.rotation.z += dt * 1.6;
      }
    } else if (this.cd > 0.42) {
      this._golpeHecho = false;
      if (this.tell) this.tell.visible = false;
    }
    // el jefe también es vulnerable al pisotón desde arriba (para rematarlo).
    // El umbral era y>4.0: solo se alcanzaba con doble salto perfecto, así que
    // los jugadores no podían rematarlo y acababan muriendo. Ahora y>2.8
    // (un doble salto normal basta y un salto simple bien dado casi llega).
    const distP = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
    if (distP < 2.3 && player.pos.y > 2.8 && player.vel.y < -1.6) {
      this.hit(1);
      player.vel.y = 10;
      this.fx.burst({ x: this.pos.x, y: 4.2, z: this.pos.z }, { count: 20, speed: 6, up: 7, life: 1.0, colors: [0xffbe0b, 0xffffff] });
      this.audio.sfx('bounce');
    }
    if (this.cd <= 0) {
      const phase = this.phase;
      // REBALANCE (petición del usuario): el jefe lanzaba ondas sin parar y con
      // ellas te daba siempre. Ahora las ondas son un recurso ESCASO (cada
      // 3.6-5.5 s) y el peso lo llevan las CAJAS BOMBA, que se pueden devolver
      // con el giro (y encima son su punto débil). Le gustan más las bombas.
      if (phase === 1) {
        // fase 1: sobre todo cajas; una onda de aviso de vez en cuando
        if (Math.random() < 0.45) this.enemies.spawnBossWave(this.pos.x, this.pos.z, 3.8, 16);
        this.launchCrate(player);
        this.cd = 3.6;
      } else if (phase === 2) {
        // fase 2: lluvia de cajas + salto (la onda queda para el salto)
        this.launchCrate(player);
        this.pendingCrate = 0.4;   // segunda caja diferida
        this.jump = 0.6;
        this.cd = 2.9;
      } else {
        // fase 3: el jefe se pone serio: 2 cajas + onda ocasional
        this.launchCrate(player);
        this.pendingCrate = 0.35;
        if (Math.random() < 0.5) this.enemies.spawnBossWave(this.pos.x, this.pos.z, 4.4, 18);
        this.cd = 2.5;
      }
    }
    // caja bomba diferida (sin setTimeout)
    if (this.pendingCrate > 0) {
      this.pendingCrate -= dt;
      if (this.pendingCrate <= 0) {
        this.pendingCrate = 0;
        if (this.alive) this.launchCrate(player);
      }
    }
    // onda diferida de la fase 2
    if (this.pendingWave > 0) {
      this.pendingWave -= dt;
      if (this.pendingWave <= 0) {
        this.pendingWave = 0;
        if (this.alive) this.enemies.spawnBossWave(this.pos.x, this.pos.z, 3.6, 15);
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
        this.enemies.spawnBossWave(this.pos.x, this.pos.z, 5.5, 12);
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
        const px = p.mesh.position.x, pz = p.mesh.position.z;
        this.scene.remove(p.mesh);
        if (p.tipo === 'tnt') {
          // las TNT del jefe EXPLOTAN al caer: más bombas y más espectáculo
          this.fx.burst({ x: px, y: 0.5, z: pz }, { count: 22, speed: 8, up: 7, life: 0.9, colors: [0xffbe0b, 0xff7b00, 0xe63946] });
          this.fx.addShake(0.4);
          this.audio.sfx('boom');
        } else {
          this.fx.burst({ x: px, y: 0.4, z: pz }, { count: 10, color: PALETA.madera, speed: 4, up: 4, life: 0.7 });
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.alive);

    return hitPlayer;
  }

  launchCrate(player) {
    // caja bomba: TNT la mayoría de las veces, y a veces una caja normal que
    // rebota por la arena (más variedad de proyectiles, petición del usuario)
    const tipo = Math.random() < 0.75 ? 'tnt' : 'normal';
    const m = makeCrate(tipo);
    m.scale.setScalar(0.9);
    m.position.set(this.pos.x, 2.6, this.pos.z);
    this.scene.add(m);
    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
    const dist = Math.max(1, Math.hypot(dx, dz));
    const speed = 9.5 + this.phase;
    // ligero desvío para que no vengan todas en línea recta (más justo y vistoso)
    const desvio = (Math.random() - 0.5) * 2.2;
    this.projectiles.push({
      mesh: m, alive: true, life: 4.5, trail: 0.06, tipo,
      vx: (dx / dist) * speed + desvio, vz: (dz / dist) * speed, vy: 3.6 + Math.random() * 1.2
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
    if (this.tell) this.tell.visible = false;
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
