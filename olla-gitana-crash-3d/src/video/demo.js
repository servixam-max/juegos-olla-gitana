/* MODO DEMO — grabación del vídeo de presentación.
   Captura determinista: sin HUD, con cámara guionizada, movimiento automático
   y diálogos. Se activa con ?demo=1 y se controla por `window.__demo`:
     __demo.start()      → arranca el guion completo
     __demo.scene(n)     → ejecuta un plano concreto (0..N)
     __demo.state()      → estado actual
   El grabador (tools/record.mjs) saca capturas por CDP y las monta con ffmpeg. */
import * as THREE from 'three';
import { INTRO } from '../narrative/dialogos.js';

export const GUION = [
  { id: 'titulo1', t: 3.0, camara: 'titulo', texto: { l1: 'OLLA GITANA 3D', l2: 'GIRA MUNDIAL' } },
  { id: 'intro1', t: 7.0, camara: 'paneoEscenario', dialogo: 'luces' },
  { id: 'intro2', t: 7.5, camara: 'lateralEscenario', dialogo: 'concierto' },
  { id: 'intro3', t: 5.5, camara: 'zoomPantalla', dialogo: 'silencio' },
  { id: 'intro4', t: 10.0, camara: 'frenteCacharro', dialogo: 'cacharro' },
  { id: 'intro5', t: 6.5, camara: 'seguimientoOlla', dialogo: 'huida' },
  { id: 'n1', t: 10.0, nivel: 0, camara: 'rail' },
  { id: 'n2', t: 8.5, nivel: 1, camara: 'rail' },
  { id: 'n3', t: 8.5, nivel: 2, camara: 'chase' },
  { id: 'n4', t: 7.5, nivel: 3, camara: 'rail' },
  { id: 'n5', t: 9.0, nivel: 4, camara: 'bossfermin' },
  { id: 'n6', t: 7.5, nivel: 5, camara: 'rail' },
  { id: 'n7', t: 7.5, nivel: 6, camara: 'rail' },
  { id: 'boss', t: 13.0, nivel: 7, camara: 'bossfinal' },
  { id: 'fin', t: 5.0, camara: 'titulo', texto: { l1: '¡QUE NO PARE LA RUMBA!', l2: 'SERVI.TAIL31979D.TS.NET/OLLAGITANA' } }
];

export class DemoDirector {
  constructor({ game, camera, scene, hud, dialog, intro, director }) {
    this.game = game;
    this.camera = camera;
    this.scene = scene;
    this.hud = hud;
    this.dialog = dialog;
    this.intro = intro;
    this.director = director;
    this.i = -1;
    this.t = 0;
    this.activo = false;
    this.onEnd = null;
  }

  start(onEnd) { this.i = -1; this.activo = true; this.onEnd = onEnd; this._next(); }

  /* ¿el plano actual es de la escena de la intro? */
  get enIntro() {
    const p = GUION[this.i];
    return !!p && ['paneoEscenario', 'lateralEscenario', 'zoomPantalla', 'frenteCacharro', 'seguimientoOlla'].includes(p.camara);
  }

  _next() {
    this.i++;
    if (this.i >= GUION.length) { this.activo = false; if (this.onEnd) this.onEnd(); return; }
    const p = GUION[this.i];
    this.t = 0;
    this.escena = p;
    if (this.hud) this.hud.show(false);

    const esIntro = this.enIntro;

    if (esIntro) {
      // monta y muestra la escena del escenario (banda, focos, pantalla del villano)
      if (this.intro) {
        this.intro.build();
        this.intro.grupo.visible = true;
        this.intro.activa = true;
        this.intro.notas.forEach((n) => { n.obj.visible = true; });
        // la pantalla del villano aparece en el plano de zoom
        if (this.intro.pantalla) {
          this.intro.pantalla.grupo.visible = (p.camara === 'zoomPantalla' || p.camara === 'frenteCacharro');
        }
        if (this.intro.ollaHero) this.intro.ollaHero.visible = (p.camara === 'seguimientoOlla');
        // sincroniza el "director" de la intro para que intro.update anime el plano correcto
        if (this.intro.director) {
          const idx = INTRO.planos.findIndex((pl) => pl.camara === p.camara);
          if (idx >= 0) {
            this.intro.director.i = idx;
            this.intro.director.planoT = 0;
            this.intro.director.dur = p.t;
          }
        }
        // diálogos del plano (bocadillos), como en la intro real
        const dl = p.dialogo ? INTRO.dialogos[p.dialogo] : null;
        if (dl && this.dialog) this.dialog.play(dl);
      }
      if (p.texto) this.game.showCineTitle(p.texto.l1, p.texto.l2, p.t);
      return;
    }
    // planos de juego: oculta la escena de la intro y para los bocadillos
    if (this.dialog) this.dialog.abort();
    if (this.intro && this.intro.grupo) this.intro.grupo.visible = false;

    // preparar la escena
    if (p.nivel != null) {
      this.game.startLevelForDemo(p.nivel);
      // el bot conduce al jugador durante el vídeo, en modo dios (sin morir)
      this.game.botOn();
      this.game.godOn();
    }
    if (p.texto) this.game.showCineTitle(p.texto.l1, p.texto.l2, p.t);
  }

  update(dt) {
    if (!this.activo) return;
    if (this._inUpdate) return;        // guardia anti-recursión
    this._inUpdate = true;
    try {
      this._updateInternal(dt);
    } finally {
      this._inUpdate = false;
    }
  }

  _updateInternal(dt) {
    this.t += dt;
    const p = GUION[this.i];
    if (!p) return;
    const k = Math.min(1, this.t / p.t);
    const cam = this.camera;
    const ease = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

    // sincroniza el reloj del "director" de la intro (notas, olla, bocadillos)
    if (this.enIntro && this.intro && this.intro.director) {
      this.intro.director.planoT = this.t;
      this.intro.director.dur = p.t;
    }

    switch (p.camara) {
      case 'rail': {
        const pl = this.game.playerPos();
        cam.position.set(pl.x * 0.35 + Math.sin(k * 6) * 0.4, 3.8 + Math.sin(k * 3) * 0.25, pl.z - 6.8);
        cam.lookAt(pl.x * 0.4, 1.2, pl.z + 3.2);
        break;
      }
      case 'chase': {
        const pl = this.game.playerPos();
        cam.position.set(pl.x * 0.35, 4.8, pl.z - 9.8);
        cam.lookAt(pl.x * 0.35, 1.3, pl.z + 5.5);
        break;
      }
      case 'bossfermin': {
        const fp = this.game.ferminPos();
        cam.position.set(fp.x * 0.5 + Math.sin(k * 2) * 3.0, 5.4, fp.z + 10 - k * 2.5);
        cam.lookAt(fp.x, 3.4, fp.z);
        break;
      }
      case 'bossfinal': {
        const bp = this.game.bossPos();
        cam.position.set(bp.x * 0.5 + Math.sin(k * 3) * 4.0, 5.8, bp.z + 12 - k * 3.5);
        cam.lookAt(bp.x, 3.0, bp.z);
        break;
      }
      case 'titulo': {
        cam.position.set(0, 6.2, 20 - k * 4);
        cam.lookAt(0, 3.0, -6);
        break;
      }
      case 'paneoEscenario': {
        const a = -0.7 + k * 1.4;
        cam.position.set(Math.sin(a) * 22, 7.5 + Math.sin(k * Math.PI) * 1.5, 16 + Math.cos(a) * 10);
        cam.lookAt(0, 2.2, -10);
        break;
      }
      case 'lateralEscenario': {
        cam.position.set(-16 + k * 4, 4.2, 4 - k * 2);
        cam.lookAt(0, 3.0, -12);
        break;
      }
      case 'zoomPantalla': {
        const z = 4.5 - (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2) * 2.5;
        cam.position.set(0, 5.4, z);
        cam.lookAt(0, 5.2, -14);
        break;
      }
      case 'frenteCacharro': {
        cam.position.set(Math.sin(k * 0.7) * 1.2, 5.4 + Math.sin(k * 1.4) * 0.2, 2.6 - k * 0.8);
        cam.lookAt(0, 5.2, -14);
        break;
      }
      case 'seguimientoOlla': {
        const z = -2 + (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2) * 22;
        cam.position.set(Math.sin(k * 3) * 1.4, 3.4, z - 6);
        cam.lookAt(Math.sin(k * 3) * 1.4, 1.4, z + 4);
        break;
      }
      default: {
        // cualquier otro plano: congelar cámara
      }
    }
    if (!this.activo) return;
    if (this.t >= p.t) this._next();
  }
}