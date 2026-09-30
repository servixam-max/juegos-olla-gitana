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
    // rugido de entrada del jefe
    this.audio.sfx('bossroar');
    // anillo dorado de VULNERABLE (solo presentación: marca cuándo saltar encima)
    if (!this.vulnRing) {
      this.vulnRing = new THREE.Mesh(
        new THREE.RingGeometry(2.2, 2.8, 44),
        new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
      );
      this.vulnRing.rotation.x = -Math.PI / 2;
      this.vulnRing.renderOrder = 4;
      this.vulnRing.visible = false;
      this.scene.add(this.vulnRing);
    }
    // anillo rojo de aviso (cuando NO se le puede tocar)
    if (!this.duelRing) {
      this.duelRing = new THREE.Mesh(
        new THREE.RingGeometry(1.9, 2.15, 40),
        new THREE.MeshBasicMaterial({ color: 0xff5d5d, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
      );
      this.duelRing.rotation.x = -Math.PI / 2;
      this.duelRing.renderOrder = 4;
      this.duelRing.visible = false;
      this.scene.add(this.duelRing);
    }
    this.onHp && this.onHp(this.hp, this.maxHp);
  }

  _make() {
    const g = new THREE.Group();
    const self = this;
    const mk = (geo, mat, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };

    // ---- cuerpo: ampli gigante ----
    const cuerpo = mk(new THREE.BoxGeometry(3.4, 4.2, 2.2), toonMat(0x2b2b2b), 0, 2.6, 0);
    // esquinas metálicas del mueble (más "cacharro de verdad")
    const cornerMat = toonMat(PALETA.metal);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [1, -1]) {
      mk(new THREE.BoxGeometry(0.18, 0.18, 0.18), cornerMat, sx * 1.63, 2.6 + sy * 2.02, sz * 1.03);
    }
    // rejilla inferior (tela de altavoz con listones)
    const grilleMat = toonMat(0x1a1a1a);
    const slatMat = toonMat(0x555555);
    mk(new THREE.BoxGeometry(2.6, 0.5, 0.06), grilleMat, 0, 0.75, 1.1);
    for (let i = 0; i < 7; i++) mk(new THREE.BoxGeometry(0.06, 0.44, 0.03), slatMat, -1.05 + i * 0.35, 0.75, 1.14);
    // chapa con el nombre (canvas, como las etiquetas de las cajas)
    {
      const cv = document.createElement('canvas');
      cv.width = 512; cv.height = 128;
      const c = cv.getContext('2d');
      c.clearRect(0, 0, 512, 128);
      c.font = '900 68px "Luckiest Guy", Nunito, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#ffbe0b'; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 8;
      c.strokeText('FERMÍN', 256, 66); c.fillText('FERMÍN', 256, 66);
      const tex = new THREE.CanvasTexture(cv);
      const plate = mk(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: tex, transparent: true }), 0, 3.05, 1.11);
      plate.renderOrder = 2;
    }

    // ---- panel dorado con mandos, leds y palancas ----
    const panel = mk(new THREE.BoxGeometry(3.0, 0.7, 0.12), toonMat(PALETA.dorado), 0, 4.0, 1.15);
    const knobMat = toonMat(0xfff5e1);
    for (let i = 0; i < 5; i++) {
      const k = mk(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 8), knobMat, -1.0 + i * 0.5, 4.0, 1.22);
      k.rotation.x = Math.PI / 2;
      // marcador rojo del mando
      mk(new THREE.BoxGeometry(0.035, 0.035, 0.05), toonMat(PALETA.rojo), -1.0 + i * 0.5, 4.0 + (i % 2 ? 0.07 : -0.07), 1.3);
    }
    // segunda fila de mandos pequeños (trim)
    for (let i = 0; i < 6; i++) {
      const k = mk(new THREE.CylinderGeometry(0.062, 0.062, 0.1, 8), toonMat(0xdcd3c0), -1.15 + i * 0.46, 3.78, 1.2);
      k.rotation.x = Math.PI / 2;
    }
    // palanca de encendido
    const palanca = mk(new THREE.BoxGeometry(0.09, 0.2, 0.08), toonMat(0x2f2f2f), 1.35, 3.8, 1.22);
    palanca.rotation.x = -0.4;
    mk(new THREE.SphereGeometry(0.06, 8, 6), toonMat(PALETA.rojo), 1.35, 3.92, 1.25);
    // leds de colores del panel (brillan solos: MeshBasicMaterial)
    const leds = [];
    for (let i = 0; i < 5; i++) {
      const led = mk(new THREE.SphereGeometry(0.052, 10, 8), new THREE.MeshBasicMaterial({ color: 0x35d94a }), -1.0 + i * 0.5, 4.24, 1.22);
      leds.push(led);
    }
    const powerLed = mk(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2e2e }), 1.35, 4.22, 1.2);
    // tornillos de las esquinas del panel
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      mk(new THREE.SphereGeometry(0.045, 8, 6), cornerMat, sx * 1.4, 4.0 + sy * 0.3, 1.22);
    }

    // ---- dos conos altavoz (pecho), con borde plateado y tapa antipolvo ----
    for (const y of [2.9, 1.5]) {
      const c = mk(new THREE.CylinderGeometry(0.62, 0.78, 0.22, 18), toonMat(0x111111), 0, y, 1.1);
      c.rotation.x = Math.PI / 2;
      mk(new THREE.TorusGeometry(0.78, 0.1, 8, 20), toonMat(PALETA.rojo), 0, y, 1.1);
      // aro plateado interior (el borde que pedía el diseño)
      mk(new THREE.TorusGeometry(0.56, 0.055, 8, 20), toonMat(0xd9dde2), 0, y, 1.18);
      // tapa antipolvo + tornillos
      mk(new THREE.SphereGeometry(0.2, 12, 10), toonMat(0x1f1f1f), 0, y, 1.2);
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        mk(new THREE.SphereGeometry(0.04, 8, 6), toonMat(0xd9dde2), Math.sin(a) * 0.72, y + Math.cos(a) * 0.72, 1.16);
      }
    }

    // ---- cabeza: pantalla con bigote (la altura NO se toca: 5.3) ----
    const cabeza = mk(new THREE.BoxGeometry(2.0, 1.3, 1.4), toonMat(0x353535), 0, 5.3, 0);
    const ojoMat = new THREE.MeshBasicMaterial({ color: 0xffbe0b });
    const ojoL = mk(new THREE.CircleGeometry(0.26, 14), ojoMat, -0.44, 5.5, 0.72);
    const ojoR = mk(new THREE.CircleGeometry(0.26, 14), ojoMat, 0.44, 5.5, 0.72);
    const pupMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const pupL = mk(new THREE.CircleGeometry(0.12, 12), pupMat, -0.44, 5.5, 0.74);
    const pupR = mk(new THREE.CircleGeometry(0.12, 12), pupMat, 0.44, 5.5, 0.74);
    // brillo fijo en la esquina de cada pupila (mirada viva, siempre igual)
    const brilloMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
    for (const s of [-1, 1]) mk(new THREE.CircleGeometry(0.035, 8), brilloMat, s * 0.44 - 0.04, 5.56, 0.76);
    // cejas pobladas sobre la pantalla
    const cejaMat = toonMat(0x141414);
    const cejaL = mk(new THREE.BoxGeometry(0.5, 0.11, 0.09), cejaMat, -0.44, 5.82, 0.72);
    const cejaR = mk(new THREE.BoxGeometry(0.5, 0.11, 0.09), cejaMat, 0.44, 5.82, 0.72);
    cejaL.rotation.z = 0.12; cejaR.rotation.z = -0.12;
    // bigote de cascabel (+ puntas)
    const bigote = mk(new THREE.BoxGeometry(1.5, 0.22, 0.14), toonMat(0x1a1a1a), 0, 5.0, 0.72);
    const puntaL = mk(new THREE.ConeGeometry(0.11, 0.34, 8), toonMat(0x1a1a1a), -0.82, 5.05, 0.7);
    puntaL.rotation.z = 1.15;
    const puntaR = mk(new THREE.ConeGeometry(0.11, 0.34, 8), toonMat(0x1a1a1a), 0.82, 5.05, 0.7);
    puntaR.rotation.z = -1.15;
    // pelo con entradas: tufos en las sienes, nuca y copete atrás (la calva se ve arriba)
    const peloMat = toonMat(0x241a12);
    mk(new THREE.BoxGeometry(0.26, 0.42, 1.0), peloMat, -0.96, 5.76, -0.1);
    mk(new THREE.BoxGeometry(0.26, 0.42, 1.0), peloMat, 0.96, 5.76, -0.1);
    mk(new THREE.BoxGeometry(1.7, 0.34, 0.3), peloMat, 0, 5.82, -0.58);
    mk(new THREE.BoxGeometry(1.72, 0.1, 0.42), peloMat, 0, 5.97, -0.36);
    // entradas marcadas (dos islotes de pelo en las esquinas frontales)
    const entradaL = mk(new THREE.BoxGeometry(0.3, 0.1, 0.22), peloMat, -0.78, 5.95, 0.5);
    const entradaR = mk(new THREE.BoxGeometry(0.3, 0.1, 0.22), peloMat, 0.78, 5.95, 0.5);
    entradaL.rotation.z = -0.25; entradaR.rotation.z = 0.25;

    // ---- pajarita con cascabeles (Fermín CASCABEL) ----
    const bowMat = toonMat(PALETA.rojo);
    const bowMat2 = toonMat(PALETA.rojoOsc);
    const bowY = 4.52, bowZ = 1.14;
    // alas de la pajarita: cajas inclinadas (triángulo clásico visto de frente)
    const wingL = mk(new THREE.BoxGeometry(0.48, 0.34, 0.12), bowMat, -0.29, bowY, bowZ);
    wingL.rotation.z = -0.34;
    const wingR = mk(new THREE.BoxGeometry(0.48, 0.34, 0.12), bowMat, 0.29, bowY, bowZ);
    wingR.rotation.z = 0.34;
    // borde oscuro inferior de cada ala (volumen)
    const wingL2 = mk(new THREE.BoxGeometry(0.44, 0.12, 0.1), bowMat2, -0.3, bowY - 0.14, bowZ);
    wingL2.rotation.z = -0.34;
    const wingR2 = mk(new THREE.BoxGeometry(0.44, 0.12, 0.1), bowMat2, 0.3, bowY - 0.14, bowZ);
    wingR2.rotation.z = 0.34;
    mk(new THREE.BoxGeometry(0.17, 0.26, 0.17), bowMat2, 0, bowY, bowZ);
    // cascabeles colgando de la pajarita
    const bellMat = new THREE.MeshBasicMaterial({ color: PALETA.dorado });
    const bellL = mk(new THREE.SphereGeometry(0.075, 10, 8), bellMat, -0.12, bowY - 0.28, bowZ);
    const bellR = mk(new THREE.SphereGeometry(0.075, 10, 8), bellMat, 0.12, bowY - 0.28, bowZ);
    mk(new THREE.BoxGeometry(0.02, 0.14, 0.02), toonMat(0x2b2b2b), -0.12, bowY - 0.13, bowZ);
    mk(new THREE.BoxGeometry(0.02, 0.14, 0.02), toonMat(0x2b2b2b), 0.12, bowY - 0.13, bowZ);

    // ---- brazos con altavoces (para lanzar) ----
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

    // ---- cables entre el ampli y la pantalla-cabeza ----
    const cableMat = toonMat(0x141414);
    const mkCable = (pts, r = 0.045) => {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
      return new THREE.Mesh(new THREE.TubeGeometry(curve, 14, r, 6, false), cableMat);
    };
    g.add(mkCable([[0.9, 4.62, -0.6], [1.25, 5.1, -0.95], [0.7, 5.5, -0.85], [0.25, 5.75, -0.6]]));
    g.add(mkCable([[-1.4, 3.2, -1.05], [-1.75, 2.4, -1.3], [-1.5, 1.6, -1.0], [-1.15, 0.9, -0.75]]));
    g.add(mkCable([[-1.55, 4.05, 1.1], [-1.9, 3.6, 0.6], [-1.85, 3.0, -0.3]]));

    // ---- patas zancudas de ampli, con pies que bailan ----
    const pataMat = toonMat(0x1f1f1f);
    const shoeMat = toonMat(0x111111);
    let pieL = null, pieR = null;
    for (const s of [-1, 1]) {
      mk(new THREE.CylinderGeometry(0.2, 0.26, 1.5, 10), pataMat, s * 0.9, 0.75, 0);
      // pivote en la puntera: al girar, el talón se levanta y la punta queda plantada
      const pieG = new THREE.Group();
      pieG.position.set(s * 0.9, 0, 0.78);
      const pie = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 1.3), shoeMat);
      pie.position.set(0, 0.14, -0.65);
      const puntera = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.1, 0.2), toonMat(0x2b2b2b));
      puntera.position.set(0, 0.24, -0.04);
      pieG.add(pie, puntera);
      g.add(pieG);
      if (s < 0) pieL = pieG; else pieR = pieG;
    }

    // ---- animación de baile: pies al ritmo de sevillanas (solo visual) ----
    // El hook va en los MESHES (los Group no son "renderables" y su onBeforeRender nunca dispara)
    const beatDur = 60 / this.bpm * 0.5;
    const animateDance = () => {
      const phL = Math.sin(self.t * Math.PI / beatDur);
      const phR = -phL;
      pieL.rotation.x = Math.max(0, phL) * 0.42;
      pieR.rotation.x = Math.max(0, phR) * 0.42;
      // golpe doble de compás: los dos pies a la vez cada 6 corcheas
      const compasPh = (self.t % (beatDur * 6)) / (beatDur * 6);
      if (compasPh < 0.12) { pieL.rotation.x = 0.3; pieR.rotation.x = 0.3; }
    };
    pieL.children[0].onBeforeRender = animateDance;
    pieR.children[0].onBeforeRender = animateDance;

    // ---- leds que cambian con el estado (vulnerable / vidas / golpe) ----
    const animateLeds = () => {
      const chase = Math.floor(self.t * 8) % leds.length;
      for (let i = 0; i < leds.length; i++) {
        let col = 0x35d94a;                                     // normal: verde
        if (self.hitFlash > 0.35) col = 0xffffff;               // golpe: blanco
        else if (self.vulnerable > 0) col = (Math.floor(self.t * 10) % 2 === 0) ? 0xff2e2e : 0xff9500;  // vulnerable: rojo/ámbar
        else if (self.hp <= 1) col = 0xff4d00;                  // última vida: naranja
        leds[i].material.color.setHex(col);
        leds[i].scale.setScalar(i === chase ? 1.55 : 1);
      }
      powerLed.material.color.setHex(self.alive ? 0xff2e2e : 0x4a0f0f);
      powerLed.scale.setScalar(1 + Math.sin(self.t * 6) * 0.18);
      // el bigote sube y baja con el jaleo (baile) y el cascabel se sacude
      const jal = Math.sin(self.t * 9) * 0.06;
      bigote.rotation.z = jal * 0.4;
      puntaL.rotation.z = 1.15 + jal;
      puntaR.rotation.z = -1.15 - jal;
      bellL.position.y = bowY - 0.28 + Math.abs(Math.sin(self.t * 11)) * 0.05;
      bellR.position.y = bowY - 0.28 + Math.abs(Math.sin(self.t * 11 + 1.2)) * 0.05;
    };
    cuerpo.onBeforeRender = animateLeds;

    g.userData = { armL, armR, cabeza, ojoL, ojoR, pupL, pupR, cuerpo, headY: 6.4, pieL, pieR, leds, cejaL, cejaR, powerLed, bellL, bellR, bigote, puntaL, puntaR };
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
    if (this.vulnRing) this.vulnRing.visible = false;
    if (this.duelRing) this.duelRing.visible = false;
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
      if (!eraVulnerable && this.onVulnerable) { this.onVulnerable(); this.audio.sfx('alert'); }
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

    // tufos de humo del motor al bailar (solo cuando está vivo y no vulnerable)
    this._humoT = (this._humoT || 0) - dt;
    if (this._humoT <= 0 && this.vulnerable <= 0) {
      this._humoT = this.hp <= 1 ? 0.22 : 0.42;
      this.fx.burst({ x: this.pos.x + (Math.random() - 0.5) * 1.6, y: 5.9, z: this.pos.z - 0.9 },
        { count: 1, speed: 0.4, up: 1.3, life: 0.9, size: 1.0, colors: [0x5a5a68, 0x8a8a98] });
    }

    /* ---- anillos de legibilidad (solo presentación: no colisionan) ----
       dorado = VULNERABLE (salta encima) · rojo = todavía no se le toca */
    if (this.vulnRing) {
      const vul = this.vulnerable > 0;
      this.vulnRing.visible = vul;
      if (vul) {
        this.vulnRing.position.set(this.pos.x, 0.07, this.pos.z);
        const late = 0.5 + Math.sin(this.t * 12) * 0.5;
        this.vulnRing.scale.setScalar(0.9 + late * 0.12);
        this.vulnRing.material.opacity = 0.35 + late * 0.4;
        this.vulnRing.rotation.z += dt * 2.2;
        this.fx.burst({ x: this.pos.x + (Math.random() - 0.5) * 3.2, y: 0.2, z: this.pos.z + (Math.random() - 0.5) * 3.2 },
          { count: 1, speed: 3.2, up: 3.4, life: 0.5, size: 0.7, colors: [0xffd23f, 0xffbe0b] });
      }
    }
    if (this.duelRing) {
      const peligro = this.vulnerable <= 0 && this.alive;
      this.duelRing.visible = peligro;
      if (peligro) {
        this.duelRing.position.set(this.pos.x, 0.06, this.pos.z);
        this.duelRing.material.opacity = 0.2 + Math.abs(Math.sin(this.t * 3)) * 0.25;
        this.duelRing.rotation.z -= dt * 0.9;
      }
    }

    // --- mirar al jugador (girando el conjunto) ---
    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
    this.obj.rotation.y = Math.atan2(dx, dz) * 0.28;
    // las pupilas siguen al jugador dentro de la pantalla-cara
    let go = Math.max(-1, Math.min(1, Math.atan2(dx, dz) * 1.6));
    if (this.hitFlash > 0) go = 1.4;
    ud.pupL.position.x = -0.44 + go * 0.13;
    ud.pupR.position.x = 0.44 + go * 0.13;
    // chispas de los cables cuando le queda poca vida
    if (this.hp <= 1 && Math.random() < 0.06) {
      this.fx.burst({ x: this.pos.x + (Math.random() - 0.5) * 2.2, y: 1.4 + Math.random() * 3.4, z: this.pos.z + 1.1 },
        { count: 1, speed: 1.6, up: 1.2, life: 0.35, size: 0.6, colors: [0xffbe0b, 0xff7b00, 0xfff6c8] });
    }

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
