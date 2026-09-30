/* JEFE INTERMEDIO: "FERMÍN CASCABEL" (mundo 5 — El Entierro de la Sardina)
   Un ampli gigante con patas que lanza ondas a ritmo de sevillanas.
   Patrones: compás de sevillana (1-2-3 · 1-2-3) con ráfagas dobles.
   Se le daña saltando encima de su cabeza (3 veces) o devolviéndole sus
   propias ondas con el giro. */
import * as THREE from 'three';
import { makeSpeaker, makeAmp, toonMat, PALETA, makeCrate } from './art.js';

export class BossFermin {
  constructor({ scene, fx, audio, enemies }) {
    this.scene = scene;
    this.fx = fx;
    this.audio = audio;
    this.enemies = enemies;
    this.obj = null;
    this.hp = 3;
    this.maxHp = 3;
    this.alive = false;
    this.t = 0;
    this.beat = 0;
    this.compases = 0;
    this.state = 'idle';
    this.danceSide = 1;
    this.hitFlash = 0;
    this.vulnerable = 0;
    this.onHp = null;
    this.onDefeat = null;
    this.onBeat = null;
    this.bpm = 108;
  }

  start() {
    if (this.obj) this.scene.remove(this.obj);
    this.obj = this._make();
    this.obj.position.set(0, 0, -10);
    this.scene.add(this.obj);
    this.hp = this.maxHp = 3;
    this.alive = true;
    this.t = 0;
    this.beat = 0;
    this.compases = 0;
    this.state = 'idle';
    this.vulnerable = 0;
    this.onHp && this.onHp(this.hp, this.maxHp);
  }

  _make() {
    const g = new THREE.Group();
    // cuerpo: ampli gigante
    const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.2, 2.2), toonMat(0x2b2b2b));
    cuerpo.position.y = 2.6;
    g.add(cuerpo);
    // panel dorado con mandos
    const panel = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.7, 0.12), toonMat(PALETA.dorado));
    panel.position.set(0, 4.0, 1.15);
    g.add(panel);
    for (let i = 0; i < 5; i++) {
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 8), toonMat(0xfff5e1));
      k.rotation.x = Math.PI / 2; k.position.set(-1.0 + i * 0.5, 4.0, 1.22);
      g.add(k);
    }
    // dos conos altavoz (pecho)
    for (const y of [2.9, 1.5]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, 0.22, 18), toonMat(0x111111));
      c.rotation.x = Math.PI / 2; c.position.set(0, y, 1.1);
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.1, 8, 20), toonMat(PALETA.rojo));
      r.position.set(0, y, 1.1);
      g.add(c, r);
    }
    // cabeza: pantalla con bigote
    const cabeza = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.3, 1.4), toonMat(0x353535));
    cabeza.position.y = 5.3;
    g.add(cabeza);
    const ojoMat = new THREE.MeshBasicMaterial({ color: 0xffbe0b });
    const ojoL = new THREE.Mesh(new THREE.CircleGeometry(0.26, 14), ojoMat);
    const ojoR = ojoL.clone();
    ojoL.position.set(-0.44, 5.5, 0.72); ojoR.position.set(0.44, 5.5, 0.72);
    g.add(ojoL, ojoR);
    const pupL = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    const pupR = pupL.clone();
    pupL.position.set(-0.44, 5.5, 0.74); pupR.position.set(0.44, 5.5, 0.74);
    g.add(pupL, pupR);
    // bigote de cascabel
    const bigote = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 0.14), toonMat(0x1a1a1a));
    bigote.position.set(0, 5.0, 0.72);
    g.add(bigote);
    // brazos con altavoces (para lanzar)
    const armMat = toonMat(0x3a3a3a);
    const mkArm = (side) => {
      const arm = new THREE.Group();
      const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 1.1, 4, 10), armMat);
      up.position.y = -0.6;
      const sp = makeSpeaker({ big: false });
      sp.scale.setScalar(0.7);
      sp.position.y = -1.35;
      arm.add(up, sp);
      arm.position.set(side * 1.95, 3.9, 0);
      return arm;
    };
    const armL = mkArm(-1), armR = mkArm(1);
    g.add(armL, armR);
    // patas zancudas de ampli
    for (const s of [-1, 1]) {
      const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 1.5, 10), toonMat(0x1f1f1f));
      pata.position.set(s * 0.9, 0.75, 0);
      const pie = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 1.3), toonMat(0x111111));
      pie.position.set(s * 0.9, 0.14, 0.15);
      g.add(pata, pie);
    }
    g.userData = { armL, armR, cabeza, ojoL, ojoR, pupL, pupR, cuerpo, headY: 6.4 };
    return g;
  }

  get pos() { return this.obj ? this.obj.position : { x: 0, y: 0, z: 0 }; }

  hit(n = 1) {
    if (!this.alive || this.vulnerable <= 0) return false;
    this.hp -= n;
    this.hitFlash = 1;
    this.vulnerable = 0;
    this.audio.sfx('crate');
    this.fx.addShake(0.4);
    this.onHp && this.onHp(this.hp, this.maxHp);
    if (this.hp <= 0) { this.defeat(); return true; }
    return true;
  }

  defeat() {
    this.alive = false;
    this.audio.sfx('victory');
    this.fx.addShake(1.2);
    this.deathT = 1.4;
    this.fx.burst({ x: this.pos.x, y: 3, z: this.pos.z }, { count: 50, speed: 11, up: 9, life: 1.6, colors: [0xffbe0b, 0xe63946, 0x4cc9f0, 0xffffff] });
  }

  updateDeath(dt) {
    if (this.deathT == null) return;
    this.deathT -= dt;
    const o = this.obj;
    if (o) {
      o.rotation.z += (Math.random() - 0.5) * 0.12;
      o.position.y = Math.max(0, o.position.y - dt * 0.5);
      this.fx.burst({ x: o.position.x + (Math.random() - 0.5) * 2.4, y: 1 + Math.random() * 4, z: o.position.z + (Math.random() - 0.5) * 2.4 },
        { count: 2, speed: 7, up: 6, life: 0.9, colors: [0xffbe0b, 0xff7b00, 0x2b2b2b] });
    }
    if (this.deathT <= 0) {
      this.deathT = null;
      if (o) o.visible = false;
      this.fx.confettiBurst();
      this.onDefeat && this.onDefeat();
    }
  }

  update(dt, player) {
    if (!this.alive || !this.obj) return false;
    this.t += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 3);
    this.vulnerable = Math.max(0, this.vulnerable - dt);
    let hitPlayer = false;

    const ud = this.obj.userData;
    const spb = 60 / this.bpm;          // segundos por pulso
    const beatDur = spb * 0.5;          // corcheas
    const phase = (this.t % (beatDur * 6)) / beatDur;   // 6 corcheas = compás de sevillana
    const onBeat = Math.floor(this.t / beatDur);

    // --- baile de sevillanas: se balancea a cada pulso ---
    const swing = Math.sin(this.t * Math.PI / beatDur) * 0.35;
    ud.armL.rotation.z = 0.4 + swing;
    ud.armR.rotation.z = -0.4 + swing;
    this.obj.rotation.z = Math.sin(this.t * Math.PI / beatDur) * 0.045;
    this.obj.position.y = Math.abs(Math.sin(this.t * Math.PI / (beatDur * 2))) * 0.16;

    // --- patrones por compás (1-2-3·1-2-3) ---
    const compas = Math.floor(this.t / (beatDur * 6));
    if (compas !== this.compases) {
      this.compases = compas;
      this.onBeat && this.onBeat(compas);
      // cada compás: ráfaga doble
      this.enemies.spawnBossWave(this.pos.x, this.pos.z, 6.0, 17);
      this.audio.sfx('wave');
      this.pendingWave = 0.36;
      // vulnerable un momento tras el lanzamiento (para el pisotón)
      const eraVulnerable = this.vulnerable > 0;
      this.vulnerable = 1.8;
      if (!eraVulnerable && this.onVulnerable) this.onVulnerable();
      // en el segundo compás de cada ciclo, además salta
      if (compas % 2 === 1) { this.jump = 0.7; }
    }
    if (this.pendingWave > 0) {
      this.pendingWave -= dt;
      if (this.pendingWave <= 0) {
        this.pendingWave = 0;
        if (this.alive) this.enemies.spawnBossWave(this.pos.x, this.pos.z, 8.4, 20);
      }
    }
    if (this.jump > 0) {
      this.jump -= dt;
      this.obj.position.y = Math.abs(Math.sin((0.7 - this.jump) * 9)) * 1.5;
      if (this.jump <= 0) {
        this.obj.position.y = 0;
        this.fx.addShake(0.5);
        this.audio.sfx('boom');
        this.enemies.spawnBossWave(this.pos.x, this.pos.z, 10.5, 13);
      }
    }

    // --- mirar al jugador (girando el conjunto) ---
    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
    this.obj.rotation.y = Math.atan2(dx, dz) * 0.28;

    // --- daño por pisotón en la cabeza (se golpea desde arriba).
    // El umbral era y>3.2 y un salto normal llega a ~2.68: era IMPOSIBLE
    // pisarlo de un salto simple (los jugadores "fallaban y morían").
    // Ahora con y>2.2 basta con un salto bien dado (o doble salto).
    const distH = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
    if (distH < 2.4 && player.pos.y > 2.2 && player.vel.y < -1.0 && this.vulnerable > 0) {
      if (this.hit(1)) {
        player.vel.y = 10;   // rebote
        this.fx.burst({ x: this.pos.x, y: 5.4, z: this.pos.z }, { count: 18, speed: 6, up: 6, life: 0.9, colors: [0xffbe0b, 0xffffff] });
        this.audio.sfx('bounce');
      }
    }
    // devolverle una onda con el giro cuando está vulnerable (antes era
    // aleatorio 6%/frame ≈ injusto: ahora golpe garantizado con enfriamiento)
    this.spinHitCd = Math.max(0, (this.spinHitCd || 0) - dt);
    if (distH < 3.2 && player.spinning && this.vulnerable > 0 && this.spinHitCd <= 0) {
      this.spinHitCd = 1.2;
      this.hit(1);
      this.fx.burst({ x: this.pos.x, y: 4.4, z: this.pos.z }, { count: 16, speed: 5, up: 5, life: 0.8, colors: [0xffbe0b, 0xffffff] });
    }
    // choque lateral en la ventana de peligro: empujón de aviso + daño.
    // Girando (parry) NO te hace daño — el giro también sirve de defensa,
    // y el empujón evita quedarse clavado dentro del jefe (causa de las
    // muertes repetidas que reportó el usuario).
    if (distH < 1.7 && player.pos.y < 4.4 && this.vulnerable <= 0 && !player.spinning) {
      const kx = (player.pos.x - this.pos.x) || 0.01;
      const kz = (player.pos.z - this.pos.z) || 0.01;
      const km = Math.hypot(kx, kz) || 1;
      player.vel.x += (kx / km) * 7.5;
      player.vel.z += (kz / km) * 7.5;
      player.vel.y = Math.max(player.vel.y, 3.5);
      hitPlayer = true;
    }

    // --- flash de daño ---
    if (this.hitFlash > 0) {
      this.obj.position.x = (Math.random() - 0.5) * 0.2;
      if (ud.ojoL) { ud.ojoL.material.color.set(0xffffff); ud.ojoR.material.color.set(0xffffff); }
    } else if (ud.ojoL) {
      ud.ojoL.material.color.set(this.vulnerable > 0 ? 0xff5555 : 0xffbe0b);
      ud.ojoR.material.color.set(this.vulnerable > 0 ? 0xff5555 : 0xffbe0b);
      const blink = Math.floor(this.t * 2.4) % 7 === 0 ? 0.1 : 1;
      ud.ojoL.scale.y = blink; ud.ojoR.scale.y = blink;
    }

    return hitPlayer;
  }
}
