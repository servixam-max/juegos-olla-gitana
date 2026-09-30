/* FINAL: la olla protagonista sube al escenario con la banda y tocan juntas
   un tramo de la canción principal. Después, fundido a negro con el mensaje
   de despedida. Se lanza al guardar la puntuación tras ganar el juego. */
import * as THREE from 'three';
import { makeOlla, makeStage, makeSpeaker, makeMicStand, makeFloodlight, toonMat, PALETA, makeNote } from '../game/art.js';

const FRASES_FINAL = [
  '¡Menudo conciertazo, zagal! 🎸',
  'La rumba ya no para… ¡ni el Cacharro la para!',
  'De aquí al escenario grande, ¿eh?'
];

export class FinalScene {
  constructor({ scene, director, audio, fx, dialog, camera }) {
    this.scene = scene;
    this.director = director;
    this.audio = audio;
    this.fx = fx;
    this.dialog = dialog;
    this.camera = camera;
    this.grupo = null;
    this.banda = [];
    this.focos = [];
    this.notas = [];
    this.hero = null;
    this.t = 0;
    this.activa = false;
    this.built = false;
    this.tituloEl = null;
  }

  build() {
    if (this.built) return;
    const g = new THREE.Group();

    // explanada + escenario
    const suelo = new THREE.Mesh(new THREE.BoxGeometry(60, 0.6, 60), toonMat(0x2a1f3d));
    suelo.position.set(0, -0.3, -2);
    g.add(suelo);

    const stage = makeStage({ w: 24, d: 11, h: 1.4 });
    stage.position.set(0, 0, -14);
    g.add(stage);

    // la banda completa (4 ollas) + la protagonista en el centro.
    // OJO: la cara de makeOlla está en +Z y la cámara mira desde +Z, así que
    // rotation.y = 0 las pone DE CARA al público (con PI salían del revés).
    const cols = [0xe63946, 0x4cc9f0, 0xffbe0b, 0x38b000];
    const xs = [-7.2, -3.6, 3.6, 7.2];
    this.banda = [];
    xs.forEach((x, i) => {
      const olla = makeOlla({ color: cols[i], rim: 0xffbe0b, band: true, guitar: true });
      olla.position.set(x, 1.4, -13.6);
      olla.scale.setScalar(1.25);
      olla.rotation.y = 0;
      g.add(olla);
      this.banda.push(olla);
    });
    // LA HEROÍNA en el centro del escenario (sin guitarra: la suya es la voz)
    const hero = makeOlla({ color: 0xd62828, rim: 0xffbe0b, band: true });
    hero.position.set(0, 1.4, -13.2);
    hero.scale.setScalar(1.4);
    hero.rotation.y = 0;
    g.add(hero);
    this.hero = hero;

    // amplis, micro
    for (const [x, sc] of [[-11.5, 1.35], [11.5, 1.35]]) {
      const amp = makeSpeaker({ big: true });
      amp.position.set(x, 1.4, -13.2);
      amp.scale.setScalar(sc);
      g.add(amp);
    }
    const mic = makeMicStand();
    mic.position.set(0, 1.4, -11.2);
    mic.scale.setScalar(1.5);
    g.add(mic);

    // focos de colores girando
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

    // notas musicales flotando (fiesta)
    this.notas = [];
    for (let i = 0; i < 14; i++) {
      const n = makeNote();
      n.position.set(-9 + Math.random() * 18, 3.4 + Math.random() * 4, -13 + Math.random() * 5);
      n.scale.setScalar(1.25);
      g.add(n);
      this.notas.push({ obj: n, base: n.position.y, ph: Math.random() * 6 });
    }

    // público entregado (bultos que saltan)
    for (let i = 0; i < 34; i++) {
      const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.5, 3, 6), toonMat(i % 3 === 0 ? 0x6b5b9a : 0x3a2f4d));
      c.position.set(-15 + Math.random() * 30, 0.5, -1.5 + Math.random() * 7);
      c.userData.baseY = 0.5;
      c.userData.ph = Math.random() * 6;
      g.add(c);
      this.publico = this.publico || [];
      this.publico.push(c);
    }

    g.visible = false;
    this.scene.add(g);
    this.grupo = g;
    this.built = true;
  }

  /* arranca el final (modo cine para que el director mande la cámara) */
  play(onEnd) {
    this.build();
    this.grupo.visible = true;
    this.activa = true;
    this.t = 0;
    // limpiar cualquier bocadillo huérfano (artefacto blanco flotante)
    if (this.dialog) {
      try { this.dialog.abort && this.dialog.abort(); } catch (_) {}
      if (this.dialog.sprite) this.dialog.sprite.visible = false;
      this.dialog.speaker = null;
    }

    // música: la canción principal (rumba) a todo trapo
    this.audio.stopGenerative();
    this.audio.sfx('victory');
    this.audio.startGenerative({ intensity: 2 });
    this.audio.setAura(true);

    let cerrado = false;
    const planos = [
      // 1) plano general del escenario con la banda y la olla
      {
        camara: 'paneoEscenario', t: 7.5,
        onStart: (d) => {
          d.fade(1, 400);            // entra desde negro
          setTimeout(() => d.fade(0, 800), 420);
        },
        onUpdate: (k) => {
          // las 5 ollas tocan a la vez
        }
      },
      // 2) primer plano de la protagonista
      { camara: 'titulo', t: 6.0 },
      // 3) plano lateral y cierre
      { camara: 'lateralEscenario', t: 6.0 }
    ];
    const planosFinal = [
      ...planos,
      {
        camara: 'paneoEscenario', t: 3.0,
        onStart: (d) => {
          // fundido a negro con el mensaje de despedida.
          // OJO: `_cierre=true` evita que director.finish() haga fade(0) y
          // borre la pantalla negra final antes de tiempo.
          d._cierre = true;
          d.fade(1, 1400);
          setTimeout(() => this._mostrarDespedida(), 700);
        }
      }
    ];
    this.director.start(planosFinal, {
      cutscene: false,
      onEnd: () => {
        this.activa = false;
        this.audio.stopGenerative();
        // mantener el texto de despedida y luego volver al menú
        setTimeout(() => {
          this._ocultarDespedida();
          this.director._cierre = false;
          this.grupo.visible = false;
          if (onEnd) onEnd();
        }, 4200);
      }
    });
    // el botón de saltar dice otra cosa en el concierto
    const sk = document.getElementById('skipIntro');
    if (sk) sk.textContent = 'SALTAR CONCIERTO ▶';
  }

  _mostrarDespedida() {
    // el fadeOverlay del director trae dentro el título "OLLA GITANA"; aquí se
    // oculta para que el mensaje de despedida sea el protagonista
    const titulo = document.getElementById('fadeTitulo');
    if (titulo) titulo.style.opacity = '0';
    if (!this.tituloEl) {
      const fd = document.getElementById('fadeOverlay');
      this.tituloEl = document.getElementById('fadeFinal');
      if (!this.tituloEl) {
        this.tituloEl = document.createElement('div');
        this.tituloEl.id = 'fadeFinal';
        this.tituloEl.style.cssText = 'opacity:0;transition:opacity 1.1s linear;text-align:center;padding:0 18px';
        this.tituloEl.innerHTML =
          '<div style="font-family:\'Luckiest Guy\',\'Nunito\',sans-serif;font-size:clamp(26px,7.4vw,54px);' +
          'letter-spacing:2px;color:#ffbe0b;text-shadow:0 4px 0 #7a3c00,0 8px 24px rgba(255,190,11,.35)">¡GRACIAS POR JUGAR!</div>' +
          '<div style="font-family:\'Luckiest Guy\',\'Nunito\',sans-serif;font-size:clamp(16px,4.6vw,30px);' +
          'letter-spacing:3px;color:#fff5e1;margin-top:14px">LO SIGUIENTE: VER UN CONCIERTO NUESTRO 🎸</div>' +
          '<div style="font-family:\'Luckiest Guy\',\'Nunito\',sans-serif;font-size:clamp(18px,5vw,34px);' +
          'letter-spacing:4px;color:#38b000;margin-top:10px;text-shadow:0 3px 0 rgba(0,0,0,.6)">¡NOS VEMOS!</div>' +
          '<div style="font-family:Nunito,sans-serif;font-size:clamp(11px,2.8vw,16px);color:rgba(255,245,225,.75);margin-top:22px">' +
          '🥘 Olla Gitana · Gira Mundial</div>';
        fd.appendChild(this.tituloEl);
      }
    }
    this.tituloEl.style.opacity = '1';
  }

  _ocultarDespedida() {
    if (this.tituloEl) this.tituloEl.style.opacity = '0';
    const fd = document.getElementById('fadeOverlay');
    if (fd) fd.style.opacity = '0';
  }

  stop() {
    this.activa = false;
    if (this.grupo) this.grupo.visible = false;
    this._ocultarDespedida();
    this.audio.setAura(false);
  }

  update(dt) {
    if (!this.activa) return;
    this.t += dt;

    // la banda y la protagonista tocan: brazos + saltito
    const todos = [...this.banda, this.hero];
    todos.forEach((o, i) => {
      const ud = o.userData;
      const b = Math.sin(this.t * (9 + i * 0.7) + i) * 0.55;
      if (ud.armL) {
        ud.armL.rotation.z = 0.6 + b; ud.armR.rotation.z = -0.6 - b;
        ud.armL.rotation.x = -b; ud.armR.rotation.x = b;
      }
      o.position.y = 1.4 + Math.abs(Math.sin(this.t * 5 + i)) * 0.16;
      o.rotation.z = Math.sin(this.t * 5 + i) * 0.06;
      // ingredientes removiéndose
      if (ud.ings) for (const it of ud.ings) it.rotation.y += dt * 1.2;
    });

    // focos girando
    this.focos.forEach((f, i) => {
      if (f.userData.yoke) f.userData.yoke.rotation.x = -0.55 + Math.sin(this.t * 1.6 + i) * 0.5;
    });

    // notas flotando
    for (const n of this.notas) {
      n.obj.rotation.y += dt * 2;
      n.obj.position.y = n.base + Math.sin(this.t * 2.4 + n.ph) * 0.3;
    }

    // público saltando
    if (this.publico) {
      for (const c of this.publico) {
        c.position.y = c.userData.baseY + Math.abs(Math.sin(this.t * 3.5 + c.userData.ph)) * 0.45;
      }
    }

    // confeti de fiesta: ANTES se lanzaba confettiBurst() del DOM cada frame
    // (0.4 de probabilidad = ~12 por segundo) y reventaba el rendimiento,
    // dejando la pantalla pillada y con artefactos (queja del usuario).
    // Ahora va por el sistema de partículas 3D (pool reutilizado) con ritmo
    // controlado: rachas de 3 s al principio y luego solo de vez en cuando.
    this._confT = (this._confT || 0) - dt;
    if (this._confT <= 0 && this.t < 16) {
      this._confT = this.t < 9 ? 0.55 : 1.3;
      const h = this.hero || (todos[0] || null);
      if (h) this.fx.confettiScene({ x: h.position.x, y: 2.6, z: h.position.z + 1 }, 14);
    }
    if (Math.random() < 0.5) {
      const o = this.hero || todos[0];
      if (o) this.fx.burst({ x: o.position.x + (Math.random() - 0.5) * 10, y: 4 + Math.random() * 3, z: o.position.z + (Math.random() - 0.5) * 6 },
        { count: 1, speed: 1.4, up: 2.2, life: 0.8, size: 1.0, colors: [0xffbe0b, 0xff70a6, 0x4cc9f0, 0x38b000] });
    }
  }
}
