/* Escena completa de la INTRO cinemática (~47 s): escenario, banda animada,
   pantalla del Cacharro, público entregado y la olla escapando. Todo por tiempo
   (sin setTimeout), saltable en cualquier momento.
   Reglas de encuadre: la cara de makeOlla está en +Z, así que TODO lo que debe
   mirar a la cámara/público va con rotation.y = 0 (antes la banda y la heroína
   iban con π y salían de espaldas). */
import * as THREE from 'three';
import {
  makeOlla, makeStage, makeSpeaker, makeMicStand, makeFloodlight,
  toonMat, PALETA, makeNote, makeBarrel, makeTree, makeCadenaLuces
} from '../game/art.js';
import { makeTextSprite } from '../engine/fx.js';
import { INTRO } from './dialogos.js';
import { HUIDA, huidaPos, huidaY } from './director.js';

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
    this.publico = [];
    this.banderines = [];
    this.luces = [];
    this.t = 0;
    this.activa = false;
    this.ollaHero = null;
    this.pantalla = null;
    this.built = false;
    this.planId = '';
    this.planStartT = 0;
    this._fadeIn = false;
    this._landOk = false;
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

    // banda: 4 ollas con instrumentos, DE CARA AL PÚBLICO (rotation.y = 0:
    // la cara de makeOlla vive en +Z, que es donde está la cámara)
    const cols = [0xe63946, 0x4cc9f0, 0xffbe0b, 0x38b000];
    const xs = [-6.2, -2.1, 2.1, 6.2];
    this.banda = [];
    xs.forEach((x, i) => {
      const olla = makeOlla({ color: cols[i], rim: 0xffbe0b, band: true, guitar: true });
      olla.position.set(x, 1.4, -13.6);
      olla.scale.setScalar(1.25);
      olla.rotation.y = 0;   // de cara al público (cámara)
      olla.userData.baseY = 1.4;
      olla.userData.ph = i * 1.7;
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

    // atrezzo de fiesta: bidones junto a los amplis y olivos/árboles de marco
    for (const [x, z, col] of [[-12.3, -11.9, PALETA.rojo], [12.3, -11.9, PALETA.azul], [-9.4, -17.4, PALETA.dorado], [9.4, -17.4, PALETA.verde]]) {
      const b = makeBarrel({ color: col });
      b.position.set(x, 0, z);
      b.scale.setScalar(1.1);
      g.add(b);
    }
    for (const [x, z, s] of [[-19.5, -4, 1.35], [19.5, -4, 1.35], [-24, 5, 1.1], [24, 5, 1.1], [-13.5, 10.5, 0.95], [13.5, 10.5, 0.95]]) {
      const tr = makeTree({ scale: s });
      tr.position.set(x, 0, z);
      g.add(tr);
    }

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

    // dos luces de color de verdad sobre el escenario (se encienden con la banda)
    this.luces = [];
    for (const [x, col] of [[-8, 0xff5d5d], [8, 0x4cc9f0]]) {
      const pl = new THREE.PointLight(col, 0, 30, 2);
      pl.position.set(x, 6.6, -15.5);
      g.add(pl);
      this.luces.push(pl);
    }

    // guirnaldas de luces: sobre el escenario y sobre el público
    for (const [span, n, y, z] of [[24, 22, 8.1, -18.7], [24, 22, 5.9, -5.4]]) {
      const cad = makeCadenaLuces({ span, n });
      cad.position.set(0, y, z);
      cad.userData.ph = Math.random() * 6;
      g.add(cad);
      this.cadenas = this.cadenas || [];
      this.cadenas.push(cad);
    }

    // cartel del festival sobre el escenario
    const banner = makeTextSprite('¡GIRA MUNDIAL! 🎸', { color: '#ffbe0b', size: 58, stroke: '#5a2400' });
    banner.scale.set(10.5, 3.3, 1);
    banner.position.set(0, 9.1, -18.2);
    g.add(banner);

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
    // la CARA (ojos, pupilas, boca y dientes) va en su propio grupo: en el plano
    // de 'silencio' la pantalla se ve APAGADA (solo panel negro) y la cara
    // aparece de golpe al arrancar el discurso del villano
    const cara = new THREE.Group();
    cara.add(ojoL, ojoR, pupL, pupR, boca);
    // dientes de mala leche
    for (let i = 0; i < 5; i++) {
      const d = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 4), new THREE.MeshBasicMaterial({ color: 0xfff5e1 }));
      d.position.set(-1.1 + i * 0.55, -0.85, 0.30);
      d.rotation.x = Math.PI;
      cara.add(d);
    }
    pant.add(marco, panel, cara);
    pant.position.set(0, 5.2, -14);   // más cerca: tiene que llenar el encuadre
    pant.visible = false;
    // por defecto la cara está puesta (el modo DEMO del vídeo solo enciende el
    // grupo de la pantalla); la intro real la apaga hasta el discurso
    cara.visible = true;
    g.add(pant);
    this.pantalla = { grupo: pant, cara, ojoL, ojoR, boca, pupL, pupR };

    // LA OLLA protagonista (aparece en el plano 5). Mira al público: +Z.
    const hero = makeOlla({ color: 0xd62828, rim: 0xffbe0b, band: true });
    hero.position.set(0, 1.4, -8);
    hero.scale.setScalar(1.1);
    hero.rotation.y = 0;   // de cara a la cámara
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

    // público lejano (bultos) — con brazos en alto, cabecita y saltando.
    // Cada 6º fan graba el concierto con el móvil (guiño visual).
    // Se deja un pasillo central (|x| ≥ 3.4) por el que luego escapa la olla:
    // si no, la heroína atravesaría a los fans y parecería un fallo.
    for (let i = 0; i < 34; i++) {
      let fx0 = -15 + Math.random() * 30;
      if (Math.abs(fx0) < 3.4) fx0 += (fx0 < 0 ? -1 : 1) * 3.4;
      const fan = this._mkFan(
        fx0,
        -2.5 + Math.random() * 7.5,
        i % 3 === 0 ? 0x6b5b9a : 0x3a2f4d,
        i % 6 === 0
      );
      g.add(fan.obj);
      this.publico.push(fan);
    }
    // banderines de fiesta colgando entre los focos
    const banCols = [0xe63946, 0xffbe0b, 0x4cc9f0, 0x38b000, 0xff70a6];
    for (let i = 0; i < 18; i++) {
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 4), new THREE.MeshBasicMaterial({ color: banCols[i % banCols.length] }));
      b.position.set(-12 + i * 1.4, 6.6 + Math.sin(i * 0.8) * 0.25, -17.6);
      b.rotation.x = Math.PI;
      b.userData.ph = i * 0.5;
      g.add(b);
      this.banderines.push(b);
    }

    this.scene.add(g);
    this.grupo = g;
    this.built = true;
    // hook de QA: permite medir el encuadre real (NDC) de la olla en cada plano
    if (typeof window !== 'undefined') {
      window.__introQA = () => {
        const cam = this.director && this.director.camera;
        if (!this.ollaHero || !cam) return null;
        const v = this.ollaHero.position.clone().project(cam);
        return { plano: this.planId, t: +this.t.toFixed(2), hero: { x: +this.ollaHero.position.x.toFixed(2), y: +this.ollaHero.position.y.toFixed(2), z: +this.ollaHero.position.z.toFixed(2) }, ndc: { x: +v.x.toFixed(2), y: +v.y.toFixed(2) }, heroVisible: this.ollaHero.visible, pantallaVisible: this.pantalla.grupo.visible, caraVisible: this.pantalla.cara.visible };
      };
      window.__introRef = this;   // QA: acceso a la escena para depurar
    }
  }

  /* un fan del público: cuerpo + cabeza + brazos en alto (y móvil si toca) */
  _mkFan(x, z, color, conMovil) {
    const obj = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.5, 3, 6), toonMat(color));
    body.position.y = 0.5;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 7), toonMat(0xd9b48a));
    head.position.y = 1.05;
    obj.add(body, head);
    const armMat = toonMat(color);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.5, 0.09), armMat);
    armL.position.set(-0.32, 1.0, 0); armL.rotation.z = 0.5;
    const armR = armL.clone();
    armR.position.set(0.32, 1.0, 0); armR.rotation.z = -0.5;
    obj.add(armL, armR);
    let movil = null;
    if (conMovil) {
      movil = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.22, 0.04), new THREE.MeshBasicMaterial({ color: 0xfff5e1 }));
      movil.position.set(0.34, 1.34, 0.1);
      obj.add(movil);
    }
    obj.position.set(x, 0, z);
    return { obj, armL, armR, movil, baseY: 0, ph: Math.random() * 6.28 };
  }

  /* La olla JUGADORA está parada en el origen (0,1.2,0) y asomaba por el
     encuadre de varios planos (se veía una olla roja "flotando" entre el
     público y cortada por abajo). Se ocultan durante la intro TODAS las ollas
     ajenas al grupo de la intro (se reconocen por la firma de makeOlla:
     userData con pupils+eyes+armL+legL) y se restauran al terminar. */
  _ocultarJugador() {
    const dentro = new Set();
    if (this.grupo) this.grupo.traverse((o) => dentro.add(o));
    this._jugador = [];
    this.scene.traverse((o) => {
      if (dentro.has(o)) return;
      const ud = o.userData;
      if (ud && Array.isArray(ud.pupils) && Array.isArray(ud.eyes) && ud.armL && ud.legL) {
        this._jugador.push({ obj: o, visible: o.visible });
        o.visible = false;
      }
    });
  }

  _restaurarJugador() {
    if (!Array.isArray(this._jugador)) return;
    for (const j of this._jugador) j.obj.visible = j.visible !== false;
  }

  play(onEnd) {
    this.build();
    this.grupo.visible = true;
    this._ocultarJugador();   // la olla del juego no debe asomar en el encuadre
    this.activa = true;
    this.t = 0;
    this.planId = '';
    this.planStartT = 0;
    this._landOk = false;
    this.ollaHero.visible = false;
    this.ollaHero.position.set(huidaPos(0).x, HUIDA.yEscenario, huidaPos(0).z);
    this.ollaHero.rotation.y = 0;
    this.pantalla.grupo.visible = false;
    this.pantalla.grupo.position.y = 4.4;
    this.pantalla.cara.visible = false;   // el villano se enciende en el discurso
    this.notas.forEach((n) => { n.obj.visible = true; });
    // entramos desde negro (fundido corto de apertura)
    this._fadeIn = true;
    this.director.fade(1, 12);

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
          // la banda hace "pop": salto de entrada con retardo escalonado
          this.banda.forEach((o, i) => { o.userData.popAt = i * 0.09; });
        }
        if (p.id === 'silencio') {
          this.audio.stopGenerative();   // SILENCIO dramático
          this.audio.sfx('pause');
          d.addKick(0.5);
          // el robo de las notas APAGA la música: la pantalla se ve sin cara
          this.pantalla.grupo.visible = true;
          this.pantalla.cara.visible = false;
        }
        if (p.id === 'cacharro') {
          this.pantalla.grupo.visible = true;
          this.pantalla.cara.visible = true;   // ¡aquí aparece la cara del villano!
          this.audio.startGenerative({ intensity: 1 });
          this.audio.sfx('bossroar');
          d.addKick(0.6);                // el villano enciende la pantalla: golpe
          if (this.fx) this.fx.flash({ x: 0, y: 5.2, z: -13.2 }, { color: 0xff3b30, size: 5.6, life: 0.4, grow: 1.8 });
        }
        if (p.id === 'huida') {
          this.ollaHero.visible = true;
          this.ollaHero.position.set(huidaPos(0).x, HUIDA.yEscenario, huidaPos(0).z);
          this.audio.setIntensity(2);
          this.audio.sfx('jump');
          this._landOk = false;
        }
        if (p.id === 'titulo') {
          this.audio.sfx('victory');
          if (this.fx) this.fx.confettiScene({ x: this.ollaHero.position.x, y: 0.4, z: this.ollaHero.position.z }, 34);
        }
      }
    }));

    this.director.start(planos, {
      cutscene: false,
      onEnd: () => {
        this.activa = false;
        this.grupo.visible = false;
        this._restaurarJugador();   // el juego (menú) vuelve a necesitar la olla
        this.audio.stopGenerative();
        // cierre: fundido a negro CORTO con el título del juego dentro, y fuera
        this.director.cierreConTitulo(onEnd);
      }
    });
  }

  stop() {
    this.activa = false;
    if (this.grupo) this.grupo.visible = false;
    this._restaurarJugador();
    this.audio.stopGenerative();
  }

  update(dt) {
    if (!this.activa) return;
    this.t += dt;
    const P = this.director.i >= 0 ? INTRO.planos[this.director.i] : null;
    const id = P ? P.id : '';
    const pt = this.director.planoT;
    if (id !== this.planId) { this.planId = id; this.planStartT = this.t; }
    const enPlano = this.t - this.planStartT;   // segundos dentro del plano actual

    const toca = id === 'luces' || id === 'concierto' || id === 'huida' || id === 'titulo';
    const nerviosos = id === 'cacharro';        // la banda escucha al villano, tensa

    // fundido de apertura (desde negro)
    if (this._fadeIn && this.t > 0.15) { this._fadeIn = false; this.director.fade(0, 620); }

    // notas flotando
    this.notas.forEach((n, i) => {
      if (!n.obj.visible) return;
      n.obj.rotation.y += dt * 1.6;
      n.obj.position.y = n.base + Math.sin(this.t * 2 + n.ph) * 0.25;
      // en el plano de silencio, las notas se van apagando/robando una a una
      if (id === 'silencio') {
        const idx = Math.floor(pt / 0.55);
        if (i >= 9 - idx - 1) {
          n.obj.visible = false;
          // chispazo de "robo": se desvanece con un destello
          if (this.fx) this.fx.flash({ x: n.obj.position.x, y: n.obj.position.y, z: n.obj.position.z }, { color: 0xfff5e1, size: 0.9, life: 0.35 });
        }
      }
    });

    // banda: tocar, parar o temblar
    this.banda.forEach((o, i) => {
      const ud = o.userData;
      const base = ud.baseY || 1.4;
      let extra = 0;
      // salto de entrada del concierto (userData.popAt = retardo de cada olla)
      if (ud.popAt != null) {
        const q = (enPlano - ud.popAt) / 0.45;
        if (q >= 1) { ud.popAt = null; }
        else if (q > 0) extra = Math.sin(q * Math.PI) * 0.55;
      }
      if (nerviosos) {
        // temblor de susto mirando a la pantalla
        o.position.y = base;
        o.rotation.z = Math.sin(this.t * 26 + i) * 0.035;
        if (ud.armL) { ud.armL.rotation.z = 0.25 + Math.sin(this.t * 26 + i) * 0.05; ud.armR.rotation.z = -0.25 - Math.sin(this.t * 26 + i) * 0.05; ud.armL.rotation.x = ud.armR.rotation.x = 0; }
      } else if (toca) {
        const b = Math.sin(this.t * (10 + i) + i) * 0.5;
        if (ud.armL) { ud.armL.rotation.z = 0.6 + b; ud.armR.rotation.z = -0.6 - b; ud.armL.rotation.x = -b; ud.armR.rotation.x = b; }
        o.position.y = base + Math.abs(Math.sin(this.t * 5 + i)) * (id === 'titulo' ? 0.22 : 0.13) + extra;
        o.rotation.z = Math.sin(this.t * 5 + i) * 0.05;
        if (ud.legL) { ud.legL.rotation.x = b * 0.5; ud.legR.rotation.x = -b * 0.5; }
      } else {
        // se quedan quietas (sorpresa) — pero mantienen el salto de entrada
        if (ud.armL) { ud.armL.rotation.z = 0.2; ud.armR.rotation.z = -0.2; ud.armL.rotation.x = 0; ud.armR.rotation.x = 0; }
        o.rotation.z = 0;
        o.position.y = base + extra;
      }
    });

    // focos girando con luz (y más locos en el título)
    this.focos.forEach((f, i) => {
      if (f.userData.yoke) f.userData.yoke.rotation.x = -0.55 + Math.sin(this.t * (id === 'titulo' ? 2.1 : 1.2) + i) * (toca ? 0.35 : 0.06);
    });
    // luces de color: se encienden con la banda, parpadean al ritmo
    this.luces.forEach((l, i) => {
      const objetivo = toca ? (id === 'titulo' ? 70 : 52) : (id === 'cacharro' ? 26 : 4);
      const parpadeo = 0.85 + Math.abs(Math.sin(this.t * 5 + i * 2)) * 0.3;
      l.intensity += (objetivo * parpadeo - l.intensity) * Math.min(1, dt * 6);
    });

    // público entregado: salta al ritmo (más cuando la banda toca) y agita los brazos
    {
      const fuerza = toca ? 0.5 : (id === 'huida' ? 0.35 : 0.12);
      for (const c of this.publico) {
        const salto = Math.abs(Math.sin(this.t * 4 + c.ph)) * fuerza;
        c.obj.position.y = salto;
        const agita = Math.sin(this.t * (toca ? 9 : 3) + c.ph) * (toca ? 0.45 : 0.15);
        c.armL.rotation.z = 0.35 + agita;
        c.armR.rotation.z = -0.35 - agita;
        if (c.movil) c.movil.visible = Math.floor(this.t * 1.6 + c.ph) % 3 !== 0;   // flashes
      }
    }
    // banderines ondeando (con pulso al ritmo)
    this.banderines.forEach((b) => {
      b.rotation.z = Math.sin(this.t * 2 + b.userData.ph) * 0.28;
      b.scale.y = 1 + (toca ? Math.sin(this.t * 8 + b.userData.ph) * 0.14 : 0);
    });
    if (this.cadenas) this.cadenas.forEach((c) => { c.rotation.z = Math.sin(this.t * 0.8 + c.userData.ph) * 0.02; });

    // pantalla: la cara solo se anima cuando está encendida (+ pupilas que
    // siguen a la olla en la huida)
    if (this.pantalla && this.pantalla.grupo.visible && this.pantalla.cara.visible) {
      const blink = Math.floor(this.t * 2.2) % 6 === 0 ? 0.12 : 1;
      this.pantalla.ojoL.scale.y = blink; this.pantalla.ojoR.scale.y = blink;
      const habla = this.dialog && this.dialog.active && this.dialog.bubble && this.dialog.bubble.shown < (this.dialog.bubble.text || '').length;
      this.pantalla.boca.scale.y = habla ? 1 + Math.sin(this.t * 22) * 0.7 : 0.5;
      this.pantalla.grupo.position.y = 4.4 + Math.sin(this.t * 1.6) * 0.08;
      // las pupilas siguen a la protagonista cuando corre
      if (id === 'huida' && this.ollaHero.visible) {
        const dx = Math.max(-0.32, Math.min(0.32, this.ollaHero.position.x * 0.07));
        this.pantalla.pupL.position.x = -1.35 + dx;
        this.pantalla.pupR.position.x = 1.35 + dx;
      } else {
        this.pantalla.pupL.position.x = -1.35 + Math.sin(this.t * 0.9) * 0.09;
        this.pantalla.pupR.position.x = 1.35 + Math.sin(this.t * 0.9) * 0.09;
      }
      // gestos del villano: risotadas con golpe de cámara + chispas rojas
      // (marcas alineadas con el arranque de cada línea del discurso)
      if (id === 'cacharro') {
        const marcas = [0.35, 4.95, 8.65];
        for (const m of marcas) {
          if (pt >= m && pt < m + dt * 1.5) {
            this.director.addKick(0.45);
            if (this.fx) this.fx.burst({ x: (Math.random() - 0.5) * 5, y: 4.9, z: -13.6 }, { count: 6, color: 0xff3b30, speed: 2.4, up: 1.6, life: 0.5, size: 0.8 });
          }
        }
      }
    }
    if (this.dialog && (!this.director.activo || !P || !INTRO.dialogos[P.id])) this.dialog.update(dt);

    // ---- la olla heroína huye hacia el público ----
    if (id === 'huida' && this.ollaHero) {
      const k = Math.min(1, this.director.planoT / (this.director.dur || 1));
      const p = huidaPos(k);
      const hop = Math.abs(Math.sin(this.t * 9)) * 0.34 * Math.min(1, Math.max(0, (k - 0.26) / 0.06));
      this.ollaHero.position.set(p.x, huidaY(k) + hop, p.z);
      this.ollaHero.rotation.z = Math.sin(this.t * 9) * 0.06;
      // aterrizaje del salto: polvo + anillo + golpe de cámara
      if (!this._landOk && k > HUIDA.saltoK + HUIDA.saltoDur + 0.01) {
        this._landOk = true;
        this.director.addKick(0.5);
        this.audio.sfx('hardland');
        if (this.fx) {
          this.fx.ring({ x: p.x, y: 0.07, z: p.z }, { color: 0xcbb9a0, r0: 0.4, r1: 2.6, life: 0.5 });
          this.fx.burst({ x: p.x, y: 0.3, z: p.z }, { count: 10, color: 0xcbb9a0, speed: 2.2, up: 2.6, life: 0.6, size: 1.1 });
        }
      }
      // chispas bajo la olla mientras corre
      if (k > 0.2 && Math.random() < 0.5 && this.fx) {
        this.fx.burst({ x: p.x, y: 0.4, z: p.z }, { count: 1, color: 0xffbe0b, speed: 1.2, up: 1.6, life: 0.4, size: 0.7 });
      }
    }
    // en el título sigue dando botes en primera fila (festeja con el público)
    if (id === 'titulo' && this.ollaHero && this.ollaHero.visible) {
      const p = huidaPos(1);
      this.ollaHero.position.set(p.x, Math.abs(Math.sin(this.t * 6)) * 0.4, p.z);
      this.ollaHero.rotation.z = Math.sin(this.t * 6) * 0.08;
    }
  }
}
