/* Director cinemático: raíles de cámara, fundidos, letterbox y control del
   flujo de la intro/cutscenes sin depender de setTimeout (todo por tiempo). */
import * as THREE from 'three';

/* ---------- recorrido COMPARTIDO de la olla en el plano 'huida' ----------
   Lo usan a la vez el personaje (intro.js) y la cámara ('seguimientoOlla'):
   antes cada uno iba por su lado y la cámara se colocaba POR DELANTE de la
   olla, así que el plano de la huida enseñaba explanada vacía y la olla se
   quedaba fuera de encuadre. k ∈ [0,1] es el avance dentro del plano. */
export const HUIDA = {
  x0: -1.4, x1: 1.0,             // deriva lateral (serpenteo rumbero)
  z0: -9.6, z1: 7.0,             // del escenario a primera fila del público
  saltoK: 0.05, saltoDur: 0.17,  // ventana (en k) en la que salta del escenario
  yEscenario: 1.4,               // altura de la tarima
  zigzag: 0.85                   // amplitud del serpenteo
};
export function huidaPos(k) {
  const kk = Math.min(1, Math.max(0, k));
  return {
    x: HUIDA.x0 + (HUIDA.x1 - HUIDA.x0) * kk + Math.sin(kk * 5.6) * HUIDA.zigzag,
    z: HUIDA.z0 + (HUIDA.z1 - HUIDA.z0) * kk
  };
}
/* altura de la olla: corre por la tarima, salta al vacío y cae a la explanada */
export function huidaY(k) {
  const kk = Math.min(1, Math.max(0, k));
  if (kk <= HUIDA.saltoK) return HUIDA.yEscenario;
  const p = Math.min(1, (kk - HUIDA.saltoK) / HUIDA.saltoDur);
  if (p >= 1) return 0;
  return HUIDA.yEscenario * (1 - p) * (1 - p) + Math.sin(Math.PI * p) * 0.5;
}

export class Director {
  constructor({ camera, scene, audio, fx, dialog, hud }) {
    this.camera = camera;
    this.scene = scene;
    this.audio = audio;
    this.fx = fx;
    this.dialog = dialog;
    this.hud = hud;
    this.t = 0;
    this.activo = false;
    this.planos = [];
    this.i = -1;
    this.planoT = 0;
    this.dur = 0;
    this.target = new THREE.Vector3();
    this.pos = new THREE.Vector3();
    this.letterbox = null;
    this.fadeEl = null;
    this.skipCb = null;
    this.onEnd = null;
    this.cutscene = false;
    this.kick = 0;             // golpe de cámara (pisotón, grito del villano…)
    this._cierreTimers = [];
    this._createOverlays();
  }

  _createOverlays() {
    // letterbox (barras negras) y fundido
    let lb = document.getElementById('letterbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'letterbox';
      lb.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:15;';
      lb.innerHTML = '<div class="lbTop"></div><div class="lbBot"></div>';
      document.getElementById('app').appendChild(lb);
    }
    this.letterbox = lb;

    let fd = document.getElementById('fadeOverlay');
    if (!fd) {
      fd = document.createElement('div');
      fd.id = 'fadeOverlay';
      fd.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:16;transition:opacity .35s linear;display:grid;place-items:center';
      // título del juego que aparece DENTRO del fundido negro (cierre de la intro)
      fd.innerHTML = '<div id="fadeTitulo" style="opacity:0;transform:scale(.94);transition:opacity .2s linear,transform .2s ease-out;text-align:center">' +
        '<div style="font-family:\'Luckiest Guy\',\'Nunito\',sans-serif;font-size:clamp(30px,9vw,64px);' +
        'letter-spacing:2px;color:#ffbe0b;text-shadow:0 4px 0 #7a3c00,0 8px 24px rgba(255,190,11,.35)">OLLA GITANA</div>' +
        '<div style="font-family:\'Luckiest Guy\',\'Nunito\',sans-serif;font-size:clamp(16px,4.5vw,30px);' +
        'letter-spacing:6px;color:#fff5e1;margin-top:6px">GIRA MUNDIAL</div>' +
        '<div style="font-family:Nunito,sans-serif;font-size:clamp(11px,2.6vw,15px);color:rgba(255,245,225,.72);margin-top:14px">' +
        '🥘 La olla rumbera contra El Cacharro 🎸</div></div>';
      document.getElementById('app').appendChild(fd);
    }
    this.fadeEl = fd;
    this.fadeTitle = fd.querySelector('#fadeTitulo');

    let sk = document.getElementById('skipIntro');
    if (!sk) {
      sk = document.createElement('button');
      sk.id = 'skipIntro';
      sk.textContent = 'SALTAR INTRO ▶';
      sk.style.cssText = 'position:absolute;right:12px;bottom:14px;z-index:30;display:none;' +
        'font-family:"Luckiest Guy","Nunito",sans-serif;font-size:15px;letter-spacing:.6px;' +
        'padding:10px 16px;border-radius:12px;border:2px solid rgba(255,255,255,.5);' +
        'background:rgba(20,10,30,.72);color:#fff;cursor:pointer';
      sk.onclick = () => this.skip();
      document.getElementById('app').appendChild(sk);
    }
    this.skipBtn = sk;
  }

  /* Fundido de pantalla: 0 = claro, 1 = negro.
     `titulo` (opcional) saca/retira el rótulo del juego que vive DENTRO del
     negro: solo lo pide el cierre de la intro. Al aclarar, el rótulo se retira
     SIEMPRE (aunque nadie lo pida) para que no quede pegado sobre el menú.
     `msTitulo` (opcional) es la duración propia del rótulo. */
  fade(to, ms = 350, titulo = null, msTitulo = null) {
    this.fadeEl.style.transition = `opacity ${ms}ms linear`;
    this.fadeEl.style.opacity = String(to);
    if (!this.fadeTitle) return;
    if (to < 0.9) {
      // fuera: rápida y siempre (evita el rótulo fantasma sobre el menú)
      this._tituloFade(msTitulo != null ? msTitulo : Math.max(120, Math.min(260, Math.round(ms * 0.55))), false);
    } else if (titulo) {
      this._tituloFade(msTitulo != null ? msTitulo : Math.max(150, Math.min(380, Math.round(ms * 0.5))), true);
    }
  }

  _tituloFade(ms, on) {
    this.fadeTitle.style.transition = `opacity ${ms}ms linear, transform ${ms}ms cubic-bezier(.2,.9,.3,1.15)`;
    this.fadeTitle.style.opacity = on ? '1' : '0';
    this.fadeTitle.style.transform = on ? 'scale(1)' : 'scale(.94)';
  }

  /* fundido a negro con el título del juego dentro (cierre de la intro).
     Mantiene la firma antigua (on, ms, dur) y ahora es rápido por defecto. */
  fadeTitulo(on = true, ms = 420, dur = 480) {
    this.fade(on ? 1 : 0, ms, !!on);
    return new Promise((res) => setTimeout(res, dur));
  }

  letterboxOn() { this.letterbox.style.display = 'block'; }
  letterboxOff() { this.letterbox.style.display = 'none'; }

  /* golpe de cámara: sacudida corta que usan los planos de la intro
     (pisotón de la olla, grito del Cacharro) */
  addKick(a) { this.kick = Math.min(1.4, this.kick + a); }

  /* planos: [{ camara, t, lookAt?, dialogos? }] */
  start(planos, { skipCb = null, onEnd = null, cutscene = false, foco = null } = {}) {
    this.planos = planos;
    this.i = -1;
    this.t = 0;
    this.activo = true;
    this.kick = 0;
    this.cutscene = cutscene;
    this.skipCb = skipCb;
    this.onEnd = onEnd;
    // Punto de interés para las cámaras de cutscene. Las cámaras 'jefe' usaban
    // coordenadas ABSOLUTAS del escenario de la intro (z≈5); al aparecer Fermín
    // en z=84 la cámara enfocaba el vacío → pantalla negra. Con `foco` la
    // cutscene se encuadra sobre quien la protagoniza.
    this.foco = foco;
    this.letterboxOn();
    this.skipBtn.style.display = cutscene ? 'none' : 'block';
    if (this.hud) this.hud.show(false);
    this._next();
  }

  _next() {
    this.i++;
    if (this.i >= this.planos.length) return this.finish();
    const p = this.planos[this.i];
    this.planoT = 0;
    this.dur = p.t || 6;
    this.camara = p.camara;
    if (p.dialogos && this.dialog) this.dialog.play(p.dialogos);
    if (p.onStart) p.onStart(this);
    if (p.sound && this.audio) this.audio.sfx(p.sound);
  }

  skip() {
    if (!this.activo) return;
    // saltar dispara finish() → onEnd (la intro encadena el título en ese callback),
    // así que no se llama aquí a cierreConTitulo para no duplicarlo
    this.finish();
  }

  /* fundido con el título del juego (cierre de la intro, natural o saltada).
     Medido con getComputedStyle: ~1,5 s desde que empieza a oscurecer hasta que
     vuelve a verse el juego; negro pleno ~0,66 s con el rótulo dentro.
     Antes: ~3,9 s en negro (se hacía eterno). */
  cierreConTitulo(onEnd = null) {
    this._cierre = true;                        // finish() no debe pisar este fundido
    this._limpiarCierre();
    const T = this._cierreTimers;
    this.fade(1, 420, true, 280);                                // a negro + rótulo
    T.push(setTimeout(() => this._tituloFade(200, true), 210));  // rótulo a plena luz
    T.push(setTimeout(() => {
      this.fade(0, 420);                                         // fuera el negro (el rótulo se va solo)
      T.push(setTimeout(() => { this._cierre = false; if (onEnd) onEnd(); }, 440));
    }, 1080));
  }

  _limpiarCierre() {
    if (this._cierreTimers) { this._cierreTimers.forEach(clearTimeout); this._cierreTimers = []; }
  }

  finish() {
    this.activo = false;
    this.letterboxOff();
    this.skipBtn.style.display = 'none';
    if (this.dialog) this.dialog.abort();
    if (this.onEnd) this.onEnd();
    if (this.skipCb) this.skipCb();
    // si el cierre con título está en marcha, NO pisar su fundido
    if (!this._cierre) this.fade(0, 500);
  }

  update(dt, ctx = {}) {
    if (!this.activo) return;
    this.t += dt;
    this.planoT += dt;
    this.kick = Math.max(0, this.kick - dt * 2.4);
    const p = this.planos[this.i];
    if (!p) return;

    const k = Math.min(1, this.planoT / this.dur);
    const cam = this.camera;
    const ease = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    // jitter de cámara cuando hay un golpe (kick): se nota en los planos vivos
    const kx = Math.sin(this.t * 31) * 0.055 * this.kick;
    const ky = Math.sin(this.t * 47) * 0.05 * this.kick;

    switch (this.camara) {
      case 'paneoEscenario': {
        // panorámica amplia: entra por la izquierda, cruza el escenario y se
        // eleva al final (balanceo de steadicam, no un carril muerto)
        const a = -0.75 + k * 1.55;
        const r = 21.5 + Math.sin(k * Math.PI) * 2.6;
        cam.position.set(Math.sin(a) * r + kx, 7.2 + Math.sin(k * Math.PI) * 2.0 + ky, 15 + Math.cos(a) * 10.5);
        cam.lookAt(Math.sin(k * 0.9) * 0.8, 2.4 + Math.sin(k * Math.PI) * 0.5, -10.5);
        break;
      }
      case 'lateralEscenario': {
        // travelling lateral que se acerca a la banda mientras sube un poco
        cam.position.set(-15.5 + k * 5.5 + kx, 4.0 + Math.sin(k * Math.PI) * 1.3 + ky, 4.5 - k * 6.5);
        cam.lookAt(0, 2.8 + k * 0.9, -11.8);
        break;
      }
      case 'zoomPantalla': {
        // el encuadre se cierra sobre la pantalla APAGADA del Cacharro
        const e = ease(k);
        cam.position.set(Math.sin(k * 3.4) * 0.28 + kx, 4.15 + e * 1.25 + ky, 7.2 - e * 5.6);
        cam.lookAt(0, 3.1 + e * 2.1, -14);
        break;
      }
      case 'frenteCacharro': {
        // el villano da su discurso: presión lenta hacia la pantalla
        const e = ease(k);
        cam.position.set(Math.sin(k * 0.7) * 0.9 + kx, 5.35 + Math.sin(k * 1.4) * 0.18 + ky, 5.0 - e * 6.6);
        cam.lookAt(0, 5.15, -14);
        break;
      }
      case 'seguimientoOlla': {
        // retro-dolly DELANTE de la olla: la protagonista corre HACIA la cámara
        // con el escenario de fondo y la cámara se eleva en el tramo final
        const ph = huidaPos(k);
        const e = ease(k);
        cam.position.set(ph.x * 0.5 + Math.sin(k * 7.2) * 0.5 + kx, 2.05 + Math.sin(k * Math.PI) * 0.35 + e * 2.3 + ky, ph.z + 6.4 + e * 1.6);
        cam.lookAt(ph.x * 0.82, 1.15, ph.z - 1.2);
        break;
      }
      case 'titulo': {
        // plano final: la olla celebra en primera fila con el escenario detrás
        // (con la cámara anterior la heroína caía al borde inferior del cuadro)
        cam.position.set(Math.sin(k * 5) * 0.35 + kx, 5.2 + ease(k) * 0.5 + ky, 19 - ease(k) * 3.0);
        cam.lookAt(Math.sin(k * 5) * 0.2, 2.2, -2);
        break;
      }
      case 'jefe': {
        // si la cutscene trae foco (x,z), se encuadra sobre el jefe que la
        // protagoniza. La cámara se aleja a ~11 m: antes se ponía a 6.5 m y el
        // jefe (3.4 m de ancho, ~6 m de alto) llenaba la pantalla y se veía como
        // una masa enorme (el usuario lo describía como "pantalla negra").
        const f = this.foco || { x: 0, z: -6, y: 3.4 };
        cam.position.set(f.x + Math.sin(k * 0.6) * 1.6, 4.6 + Math.sin(k * Math.PI) * 0.5, f.z + 11 - k * 1.2);
        cam.lookAt(f.x, f.y != null ? f.y : 3.4, f.z);
        break;
      }
      case 'orbita': {
        const a = k * Math.PI * 0.9 - 0.45;
        cam.position.set(Math.sin(a) * 11, 6.2, Math.cos(a) * 11);
        cam.lookAt(0, 2.2, 0);
        break;
      }
      case 'cajaFija': {
        cam.position.set(0, 4.4, k * 1.4 + 5.5);
        cam.lookAt(0, 2.4, 0);
        break;
      }
      default: {
        // por defecto: plano fijo frente al escenario
        cam.position.set(0, 4.6, 9);
        cam.lookAt(0, 2.6, -8);
      }
    }

    if (p.dialogos && this.dialog) this.dialog.update(dt);
    if (this.fx) this.fx.update(dt);
    if (p.onUpdate) p.onUpdate(this.planoT / this.dur, this);
    if (this.planoT >= this.dur) this._next();
  }
}

/* ---------- utilidades de escena para la cinemática ---------- */
export function crearEscenarioIntro(scene, { makeOlla, makeStage, makeSpeaker, makeGuitar, makeMicStand, makeFloodlight, makeNote, toonMat }) {
  // escenario con luces, banda (ollas), pantalla del Cacharro y notas
  const g = new THREE.Group();
  const stage = makeStage({ w: 22, d: 10, h: 1.3 });
  stage.position.set(0, 0, -12);
  g.add(stage);

  // banda: 4 ollas con instrumentos, animadas (de cara al público: la cara de
  // makeOlla está en +Z, no hay que girarlas)
  const banda = [];
  const posiciones = [[-5.4, 1.3, -11.4, 0xe63946], [-1.8, 1.3, -11.8, 0x4cc9f0], [1.8, 1.3, -11.8, 0xffbe0b], [5.4, 1.3, -11.4, 0x38b000]];
  for (const [x, y, z, col] of posiciones) {
    const olla = makeOlla({ color: col, rim: 0xffbe0b, band: true, guitar: true });
    olla.position.set(x, y, z);
    olla.rotation.y = 0;
    olla.scale.setScalar(1.15);
    g.add(olla);
    banda.push(olla);
  }

  // amplis y micros
  const ampL = makeSpeaker({ big: true }); ampL.position.set(-9.5, 1.3, -11); ampL.scale.setScalar(1.3);
  const ampR = makeSpeaker({ big: true }); ampR.position.set(9.5, 1.3, -11); ampR.scale.setScalar(1.3);
  g.add(ampL, ampR);
  const mic = makeMicStand(); mic.position.set(0, 1.3, -9.4); mic.scale.setScalar(1.3);
  g.add(mic);

  // focos
  const focos = [];
  for (let i = 0; i < 5; i++) {
    const f = makeFloodlight({ height: 6.5, swing: -0.5 });
    f.position.set(-9 + i * 4.5, 0, -16);
    g.add(f);
    focos.push(f);
  }

  // pantalla del Cacharro (aparece en el plano 3)
  const pantalla = new THREE.Group();
  const marco = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.6, 0.4), toonMat(0x1f1f1f));
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.9), new THREE.MeshBasicMaterial({ color: 0x1a0a0a }));
  panel.position.z = 0.22;
  pantalla.add(marco, panel);
  pantalla.position.set(0, 3.6, -17.6);
  pantalla.visible = false;
  g.add(pantalla);

  scene.add(g);
  return { grupo: g, banda, focos, pantalla, ampL, ampR, mic, stage };
}
