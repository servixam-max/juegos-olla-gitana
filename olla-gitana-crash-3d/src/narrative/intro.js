/* Escena completa de la INTRO cinemática (≈72 s): escenario, banda animada,
   pantalla del Cacharro, y la olla escapando. Todo por tiempo (sin setTimeout),
   saltable en cualquier momento. */
import * as THREE from 'three';
import {
  makeOlla, makeStage, makeSpeaker, makeMicStand, makeFloodlight, makeGuitar,
  toonMat, PALETA, makeNote, makeBarrel, makeTree
} from '../game/art.js';
import { INTRO } from './dialogos.js';

export class IntroScene {
  constructor({ scene, director, audio, fx, dialog }) {
    this.scene = scene;
    this.director = director;
    this.audio = audio;
    this.fx = fx;
    this.dialog = dialog;
    this.grupo = null;
    this.banda = [];
    this.notas = [];
    this.focos = [];
    this.t = 0;
    this.activa = false;
    this.ollaHero = null;
    this.pantalla = null;
    this.built = false;
  }

  build() {
    if (this.built) return;
    const g = new THREE.Group();

    // suelo del escenario: explanada
    const suelo = new THREE.Mesh(new THREE.BoxGeometry(60, 0.6, 60), toonMat(0x2a1f3d));
    suelo.position.set(0, -0.3, -2);
    g.add(suelo);
    const cesped = new THREE.Mesh(new THREE.BoxGeometry(60, 0.62, 18), toonMat(0x1f3a2a));
    cesped.position.set(0, -0.3, -22);
    g.add(cesped);

    // escenario principal
    const stage = makeStage({ w: 24, d: 11, h: 1.4 });
    stage.position.set(0, 0, -14);
    g.add(stage);

    // banda: 4 ollas con instrumentos
    const cols = [0xe63946, 0x4cc9f0, 0xffbe0b, 0x38b000];
    const xs = [-6.2, -2.1, 2.1, 6.2];
    this.banda = [];
    xs.forEach((x, i) => {
      const olla = makeOlla({ color: cols[i], rim: 0xffbe0b, band: true, guitar: true });
      olla.position.set(x, 1.4, -13.6);
      olla.scale.setScalar(1.25);
      olla.rotation.y = Math.PI;   // de cara al público (cámara)
      g.add(olla);
      this.banda.push(olla);
    });

    // amplis, micro, batería improvisada
    for (const [x, sc] of [[-10.5, 1.35], [10.5, 1.35]]) {
      const amp = makeSpeaker({ big: true });
      amp.position.set(x, 1.4, -13.2);
      amp.scale.setScalar(sc);
      g.add(amp);
    }
    const mic = makeMicStand();
    mic.position.set(0, 1.4, -11.0);
    mic.scale.setScalar(1.4);
    g.add(mic);

    // focos de colores
    this.focos = [];
    const colFoco = [0xff5d5d, 0x4cc9f0, 0xffbe0b, 0x38b000, 0xff70a6];
    for (let i = 0; i < 5; i++) {
      const f = makeFloodlight({ height: 6.8, swing: -0.55 });
      f.position.set(-11 + i * 5.5, 0, -19);
      g.add(f);
      const can = f.userData.yoke.children[1];
      if (can && can.material) can.material = new THREE.MeshBasicMaterial({ color: colFoco[i] });
      this.focos.push(f);
    }

    // pantalla del Cacharro (aparece en el plano 3)
    const pant = new THREE.Group();
    const marco = new THREE.Mesh(new THREE.BoxGeometry(9.0, 6.0, 0.5), toonMat(0x141414));
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(7.8, 5.0), new THREE.MeshBasicMaterial({ color: 0x1a0a0a }));
    panel.position.z = 0.28;
    const ojoL = new THREE.Mesh(new THREE.CircleGeometry(0.72, 18), new THREE.MeshBasicMaterial({ color: 0xff2e2e }));
    const ojoR = ojoL.clone();
    ojoL.position.set(-1.35, 0.75, 0.30); ojoR.position.set(1.35, 0.75, 0.30);
    const pupL = new THREE.Mesh(new THREE.CircleGeometry(0.3, 14), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    const pupR = pupL.clone();
    pupL.position.set(-1.35, 0.75, 0.32); pupR.position.set(1.35, 0.75, 0.32);
    const boca = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.55, 0.12), new THREE.MeshBasicMaterial({ color: 0xffbe0b }));
    boca.position.set(0, -1.15, 0.30);
    // dientes de mala leche
    for (let i = 0; i < 5; i++) {
      const d = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 4), new THREE.MeshBasicMaterial({ color: 0xfff5e1 }));
      d.position.set(-1.1 + i * 0.55, -0.85, 0.30);
      d.rotation.x = Math.PI;
      pant.add(d);
    }
    pant.add(marco, panel, ojoL, ojoR, pupL, pupR, boca);
    pant.position.set(0, 5.2, -14);   // más cerca: tiene que llenar el encuadre
    pant.visible = false;
    g.add(pant);
    this.pantalla = { grupo: pant, ojoL, ojoR, boca, pupL, pupR };

    // LA OLLA protagonista (aparece en el plano 5)
    const hero = makeOlla({ color: 0xd62828, rim: 0xffbe0b, band: true });
    hero.position.set(0, 1.4, -8);
    hero.scale.setScalar(1.1);
    hero.visible = false;
    g.add(hero);
    this.ollaHero = hero;

    // notas musicales flotando (se van "robando": desaparecen en el plano 3)
    this.notas = [];
    for (let i = 0; i < 9; i++) {
      const n = makeNote();
      n.position.set(-8 + Math.random() * 16, 4 + Math.random() * 3.4, -13 + Math.random() * 4);
      n.scale.setScalar(1.2);
      g.add(n);
      this.notas.push({ obj: n, base: n.position.y, ph: Math.random() * 6 });
    }

    // público lejano (bultos) — con brazos en alto y saltando
    for (let i = 0; i < 26; i++) {
      const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.5, 3, 6), toonMat(i % 3 === 0 ? 0x6b5b9a : 0x3a2f4d));
      c.position.set(-14 + Math.random() * 28, 0.5, -2 + Math.random() * 6);
      c.userData.baseY = 0.5;
      c.userData.ph = Math.random() * 6;
      g.add(c);
      this.publico = this.publico || [];
      this.publico.push(c);
    }
    // banderines de fiesta colgando entre los focos
    const banCols = [0xe63946, 0xffbe0b, 0x4cc9f0, 0x38b000, 0xff70a6];
    for (let i = 0; i < 18; i++) {
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 4), new THREE.MeshBasicMaterial({ color: banCols[i % banCols.length] }));
      b.position.set(-12 + i * 1.4, 6.6 + Math.sin(i * 0.8) * 0.25, -17.6);
      b.rotation.x = Math.PI;
      b.userData.ph = i * 0.5;
      g.add(b);
      this.banderines = this.banderines || [];
      this.banderines.push(b);
    }

    this.scene.add(g);
    this.grupo = g;
    this.built = true;
  }

  play(onEnd) {
    this.build();
    this.grupo.visible = true;
    this.activa = true;
    this.t = 0;
    this.ollaHero.visible = false;
    this.pantalla.grupo.visible = false;
    this.notas.forEach((n) => { n.obj.visible = true; });

    const planos = INTRO.planos.map((p) => ({
      camara: p.camara,
      t: p.t / (this.skipSpeed || 1),
      dialogos: INTRO.dialogos[p.id] || null,
      onStart: (d) => {
        if (p.id === 'luces') {
          this.audio.stopAll();
          this.audio.startGenerative({ intensity: 1, aura: false });
        }
        if (p.id === 'concierto') {
          this.audio.setIntensity(2);
          this.audio.sfx('levelup');
          // la banda hace "pop": salto de entrada
          this.banda.forEach((o, i) => { o.userData.popT = 0.1 * i; });
        }
        if (p.id === 'silencio') {
          this.audio.stopGenerative();   // SILENCIO dramático
          this.audio.sfx('pause');
        }
        if (p.id === 'cacharro') {
          this.pantalla.grupo.visible = true;
          this.audio.startGenerative({ intensity: 1 });
        }
        if (p.id === 'huida') {
          this.ollaHero.visible = true;
          this.audio.setIntensity(2);
          this.audio.sfx('jump');
        }
        if (p.id === 'titulo') {
          this.audio.sfx('victory');
        }
      }
    }));

    this.director.start(planos, {
      cutscene: false,
      onEnd: () => {
        this.activa = false;
        this.grupo.visible = false;
        this.audio.stopGenerative();
        // cierre: fundido a negro CON el título del juego dentro, y fuera
        this.director.cierreConTitulo(onEnd);
      }
    });
  }

  stop() {
    this.activa = false;
    if (this.grupo) this.grupo.visible = false;
    this.audio.stopGenerative();
  }

  update(dt) {
    if (!this.activa) return;
    this.t += dt;
    const P = this.director.i >= 0 ? INTRO.planos[this.director.i] : null;
    const id = P ? P.id : '';

    // notas flotando
    this.notas.forEach((n, i) => {
      if (!n.obj.visible) return;
      n.obj.rotation.y += dt * 1.6;
      n.obj.position.y = n.base + Math.sin(this.t * 2 + n.ph) * 0.25;
      // en el plano de silencio, las notas se van apagando una a una
      if (id === 'silencio') {
        const idx = Math.floor(this.director.planoT / 0.7);
        if (i >= 9 - idx - 1) n.obj.visible = false;
      }
    });

    // banda: tocar y parar
    const toca = id === 'luces' || id === 'concierto';
    this.banda.forEach((o, i) => {
      const ud = o.userData;
      if (toca) {
        const b = Math.sin(this.t * (10 + i) + i) * 0.5;
        if (ud.armL) { ud.armL.rotation.z = 0.6 + b; ud.armR.rotation.z = -0.6 - b; ud.armL.rotation.x = -b; ud.armR.rotation.x = b; }
        o.position.y = 1.4 + Math.abs(Math.sin(this.t * 5 + i)) * 0.12;
        o.rotation.z = Math.sin(this.t * 5 + i) * 0.05;
      } else {
        // se quedan quietas (sorpresa)
        if (ud.armL) { ud.armL.rotation.z = 0.2; ud.armR.rotation.z = -0.2; ud.armL.rotation.x = 0; ud.armR.rotation.x = 0; }
        o.rotation.z = 0;
      }
    });

    // focos girando con luz
    this.focos.forEach((f, i) => {
      if (f.userData.yoke) f.userData.yoke.rotation.x = -0.55 + Math.sin(this.t * 1.2 + i) * (toca ? 0.35 : 0.06);
    });

    // público entregado: salta al ritmo (más cuando la banda toca)
    if (this.publico) {
      const fuerza = toca ? 0.5 : 0.12;
      for (const c of this.publico) {
        c.position.y = c.userData.baseY + Math.abs(Math.sin(this.t * 4 + c.userData.ph)) * fuerza;
      }
    }
    // banderines ondeando
    if (this.banderines) {
      this.banderines.forEach((b) => { b.rotation.z = Math.sin(this.t * 2 + b.userData.ph) * 0.28; });
    }

    // pantalla: ojos y boca vivos
    if (this.pantalla && this.pantalla.grupo.visible) {
      const blink = Math.floor(this.t * 2.2) % 6 === 0 ? 0.12 : 1;
      this.pantalla.ojoL.scale.y = blink; this.pantalla.ojoR.scale.y = blink;
      const habla = this.dialog && this.dialog.active && this.dialog.bubble && this.dialog.bubble.shown < (this.dialog.bubble.text || '').length;
      this.pantalla.boca.scale.y = habla ? 1 + Math.sin(this.t * 22) * 0.7 : 0.5;
      this.pantalla.grupo.position.y = 4.4 + Math.sin(this.t * 1.6) * 0.08;
    }
    if (this.dialog) this.dialog.update(dt);

    // la olla heroína corre hacia el fondo en el plano de huida
    if (id === 'huida' && this.ollaHero) {
      const k = Math.min(1, this.director.planoT / this.director.dur);
      this.ollaHero.position.z = -8 + k * 14;
      this.ollaHero.position.y = 1.4 + Math.abs(Math.sin(this.t * 9)) * 0.4;
      // chispas bajo la olla
      if (Math.random() < 0.5 && this.fx) {
        this.fx.burst({ x: this.ollaHero.position.x, y: 0.4, z: this.ollaHero.position.z }, { count: 1, color: 0xffbe0b, speed: 1.2, up: 1.6, life: 0.4, size: 0.7 });
      }
    }
  }
}
