/* Director cinemático: raíles de cámara, fundidos, letterbox y control del
   flujo de la intro/cutscenes sin depender de setTimeout (todo por tiempo). */
import * as THREE from 'three';

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
      fd.innerHTML = '<div id="fadeTitulo" style="opacity:0;transition:opacity .6s linear;text-align:center">' +
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

  fade(to, ms = 350) {
    this.fadeEl.style.transition = `opacity ${ms}ms linear`;
    this.fadeEl.style.opacity = String(to);
    // el título vive DENTRO del fundido: aparece al fundir a negro y se va al fundir a claro
    if (this.fadeTitle) {
      this.fadeTitle.style.transition = `opacity ${Math.round(ms * 1.6)}ms linear`;
      this.fadeTitle.style.opacity = to >= 0.9 ? '1' : '0';
    }
  }

  /* fundido a negro con el título del juego dentro (cierre de la intro) */
  fadeTitulo(on = true, ms = 900, dur = 2000) {
    if (on) {
      this.fade(1, ms);
    } else {
      this.fade(0, ms);
    }
    return new Promise((res) => setTimeout(res, dur));
  }

  letterboxOn() { this.letterbox.style.display = 'block'; }
  letterboxOff() { this.letterbox.style.display = 'none'; }

  /* planos: [{ camara, t, lookAt?, dialogos? }] */
  start(planos, { skipCb = null, onEnd = null, cutscene = false } = {}) {
    this.planos = planos;
    this.i = -1;
    this.t = 0;
    this.activo = true;
    this.cutscene = cutscene;
    this.skipCb = skipCb;
    this.onEnd = onEnd;
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
    // salta al final de la intro (con fundido)
    this.fade(1, 280);
    setTimeout(() => { this.finish(); this.fade(0, 380); }, 320);
  }

  finish() {
    this.activo = false;
    this.letterboxOff();
    this.skipBtn.style.display = 'none';
    if (this.dialog) this.dialog.abort();
    if (this.onEnd) this.onEnd();
    if (this.skipCb) this.skipCb();
    this.fade(0, 500);
  }

  update(dt, ctx = {}) {
    if (!this.activo) return;
    this.t += dt;
    this.planoT += dt;
    const p = this.planos[this.i];
    if (!p) return;

    const k = Math.min(1, this.planoT / this.dur);
    const cam = this.camera;
    const ease = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

    switch (this.camara) {
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
        // primer plano de la pantalla del Cacharro (con sus ojos rojos)
        const z = 4.5 - ease(k) * 2.5;
        cam.position.set(0, 5.4, z);
        cam.lookAt(0, 5.2, -14);
        break;
      }
      case 'frenteCacharro': {
        // el villano da su discurso: encuadre centrado en la pantalla
        cam.position.set(Math.sin(k * 0.7) * 1.2, 5.4 + Math.sin(k * 1.4) * 0.2, 2.6 - k * 0.8);
        cam.lookAt(0, 5.2, -14);
        break;
      }
      case 'seguimientoOlla': {
        const z = -2 + ease(k) * 22;
        cam.position.set(Math.sin(k * 3) * 1.4, 3.4, z - 6);
        cam.lookAt(Math.sin(k * 3) * 1.4, 1.4, z + 4);
        break;
      }
      case 'titulo': {
        cam.position.set(0, 6.5, 22 - k * 5);
        cam.lookAt(0, 3.2, -6);
        break;
      }
      case 'jefe': {
        cam.position.set(0, 5.6, 6.5 - k * 1.5);
        cam.lookAt(0, 3.4, -6);
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

  // banda: 4 ollas con instrumentos, animadas
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
