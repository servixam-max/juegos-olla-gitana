/* Bocadillos de diálogo en 3D (sin voces): sprites con cola, efecto máquina de
   escribir, animación de entrada/salida y pitidos por sílaba (estilo Animal
   Crossing). Regla del proyecto: NUNCA usar hit.mp3 para esto. */
import * as THREE from 'three';

const CACHE = new Map();

export class SpeechBubble {
  constructor({ maxWidth = 512, scale = 1 } = {}) {
    this.maxWidth = maxWidth;
    this.scale = scale;
    this.text = '';
    this.shown = 0;        // caracteres revelados
    this.speed = 34;       // caracteres por segundo
    this.t = 0;
    this.state = 'out';    // out | in | hold | out2
    this.holdT = 0;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = 320;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.anisotropy = 2;
    this.material = new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, depthTest: false });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.renderOrder = 999;
    this.sprite.scale.set(5.6, 2.8, 1);
    this.sprite.visible = false;
    this.tone = 'normal';
    this.tail = 'none';
    this._blip = 0;
    this.onBlip = null;
  }

  set(text, { tone = 'normal', tail = 'none', speed = 34, hold = null } = {}) {
    this.text = text;
    this.tone = tone;
    this.tail = tail;
    this.speed = speed;
    this.shown = 0;
    this.t = 0;
    this.state = 'in';
    this.holdT = hold != null ? hold : Math.max(1.4, text.length / 21);
    this.sprite.visible = true;
    this.sprite.scale.set(0.1, 0.05, 1);
    this._blip = 0;
    this._draw();
  }

  hide() { if (this.state !== 'out') { this.state = 'out'; this.t = 0; } }
  get finished() { return this.state === 'out' && !this.sprite.visible; }
  get holding() { return this.state === 'hold'; }

  update(dt) {
    if (this.state === 'out' && !this.sprite.visible) return;
    this.t += dt;
    if (this.state === 'in') {
      const k = Math.min(1, this.t / 0.28);
      const e = 1 - Math.pow(1 - k, 3);
      const s = 0.35 + 0.65 * e;
      this.sprite.scale.set(5.6 * s, 2.8 * s, 1);
      if (k >= 1) { this.state = 'hold'; this.t = 0; }
    } else if (this.state === 'hold') {
      const prev = this.shown;
      this.shown = Math.min(this.text.length, this.shown + this.speed * dt);
      // pitido cada ~4 caracteres
      if (Math.floor(this.shown / 4) > Math.floor(prev / 4)) { this._blip = 1; if (this.onBlip) this.onBlip(); }
      this._draw();
      if (this.shown >= this.text.length) {
        this.holdT -= dt;
        if (this.holdT <= 0) this.hide();
      }
    } else if (this.state === 'out') {
      const k = Math.min(1, this.t / 0.22);
      const s = Math.max(0.05, 1 - k);
      this.sprite.scale.set(5.6 * s, 2.8 * s, 1);
      this.sprite.position.y += dt * 0.6;
      if (k >= 1) { this.sprite.visible = false; this.sprite.position.y -= 0.6 * 0.22 / 0.22 * 0.22; }
    }
  }

  _draw() {
    const g = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    g.clearRect(0, 0, W, H);

    const tones = {
      normal: { fill: 'rgba(255,246,222,0.97)', stroke: '#3a1c00', text: '#2b1400', lw: 9 },
      grito: { fill: 'rgba(255,231,231,0.98)', stroke: '#7a1010', text: '#5a0000', lw: 12 },
      pensamiento: { fill: 'rgba(238,232,255,0.96)', stroke: '#4c1d95', text: '#2a1055', lw: 8 },
      radio: { fill: 'rgba(226,242,255,0.97)', stroke: '#1c4b6b', text: '#0d2438', lw: 9 },
      exito: { fill: 'rgba(232,255,224,0.97)', stroke: '#1f5c2a', text: '#0f3a17', lw: 9 }
    };
    const tone = tones[this.tone] || tones.normal;

    // fuente y ajuste de líneas
    const fs = this.tone === 'grito' ? 52 : 46;
    g.font = `900 ${fs}px "Luckiest Guy", Nunito, sans-serif`;
    const maxW = W - 96;
    const visible = this.text.slice(0, Math.floor(this.shown));
    const words = visible.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (g.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) lines.push(cur);

    const lh = fs * 1.14;
    const boxH = Math.max(120, lines.length * lh + 74);
    const boxW = W - 24;
    const x = 12, y = 12;
    const r = 30;

    // nube / bocadillo
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.45)';
    g.shadowBlur = 14; g.shadowOffsetY = 5;
    g.beginPath();
    roundRect(g, x, y, boxW, boxH, r);
    g.fillStyle = tone.fill;
    g.fill();
    g.restore();

    g.lineWidth = tone.lw;
    g.strokeStyle = tone.stroke;
    g.stroke();

    // cola
    if (this.tail === 'left' || this.tail === 'right' || this.tail === 'down') {
      g.beginPath();
      const cx = this.tail === 'left' ? x + 90 : this.tail === 'right' ? x + boxW - 90 : x + boxW / 2;
      const by = y + boxH;
      if (this.tail === 'down') {
        g.moveTo(cx - 34, by - 4); g.lineTo(cx, by + 46); g.lineTo(cx + 34, by - 4);
      } else if (this.tail === 'left') {
        g.moveTo(cx - 30, by - 4); g.lineTo(cx - 70, by + 40); g.lineTo(cx + 26, by - 4);
      } else {
        g.moveTo(cx - 26, by - 4); g.lineTo(cx + 70, by + 40); g.lineTo(cx + 30, by - 4);
      }
      g.closePath();
      g.fillStyle = tone.fill; g.fill();
      g.lineWidth = tone.lw * 0.8; g.strokeStyle = tone.stroke; g.stroke();
    }

    // texto
    g.font = `900 ${fs}px "Luckiest Guy", Nunito, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = tone.text;
    const startY = y + boxH / 2 - (lines.length - 1) * lh / 2;
    lines.forEach((ln, i) => {
      g.fillText(ln, x + boxW / 2, startY + i * lh);
    });

    // cursor parpadeante mientras escribe
    if (this.state === 'hold' && this.shown < this.text.length && Math.floor(this.t * 3) % 2 === 0) {
      const lastW = g.measureText(lines[lines.length - 1] || '').width;
      g.fillStyle = tone.stroke;
      g.fillRect(x + boxW / 2 + lastW / 2 + 8, startY + (lines.length - 1) * lh - fs * 0.34, fs * 0.5, fs * 0.14);
    }

    this.tex.needsUpdate = true;

    // reescalar el sprite según la forma real del bocadillo
    const aspect = boxH / boxW;
    const baseH = 5.6;
    this.sprite.userData.aspect = aspect;
  }
}

function roundRect(g, x, y, w, h, r) {
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/* ---------- cola de diálogo: secuencia de líneas con hablante ---------- */
export class DialogQueue {
  constructor({ audio = null, speaker = null, camera = null, scene = null } = {}) {
    this.audio = audio;
    this.speaker = speaker;     // objeto THREE al que apuntan los bocadillos
    this.camera = camera;       // si no hay hablante, el bocadillo va en pantalla
    this.scene = scene;
    this.screenDist = 5.2;
    this.screenX = 0;
    this.screenY = 0.55;
    this.bubble = new SpeechBubble();
    if (scene) scene.add(this.bubble.sprite);   // ¡sin esto el bocadillo no se ve!
    if (audio) this.bubble.onBlip = () => audio.tone({ type: 'triangle', f0: 1180, dur: 0.028, vol: 0.045 });
    this.queue = [];
    this.i = -1;
    this.waitT = 0;
    this.onEnd = null;
    this.active = false;
  }

  play(lines) {
    this.queue = lines.slice();
    this.i = -1;
    this.active = true;
    this._next();
  }

  _next() {
    this.i++;
    if (this.i >= this.queue.length) { this.active = false; this.bubble.hide(); if (this.onEnd) this.onEnd(); return; }
    const ln = this.queue[this.i];
    const tail = ln.tail || 'down';
    this.bubble.set(ln.t, { tone: ln.tone || 'normal', tail, speed: ln.speed || 34, hold: ln.hold });
    this.waitT = ln.gap != null ? ln.gap : 0.35;
    // el bocadillo sigue al hablante si lo hay
  }

  update(dt) {
    if (!this.active && !this.bubble.sprite.visible) return;
    this.bubble.update(dt);
    if (this.speaker) {
      const y = (this.speaker.userData && this.speaker.userData.headY) || 3.2;
      this.bubble.sprite.position.set(this.speaker.position.x, this.speaker.position.y + y, this.speaker.position.z);
      this.bubble.sprite.userData.mode = 'world';
    } else if (this.camera) {
      // narrador / pantalla: el bocadillo va delante de la cámara (espacio de pantalla)
      const cam = this.camera;
      const fwd = new THREE.Vector3();
      cam.getWorldDirection(fwd);
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
      const pos = cam.position.clone()
        .add(fwd.multiplyScalar(this.screenDist || 5.2))
        .add(right.multiplyScalar((this.screenX || 0)))
        .add(up.multiplyScalar((this.screenY != null ? this.screenY : 0.55)));
      this.bubble.sprite.position.copy(pos);
      this.bubble.sprite.userData.mode = 'screen';
    }
    if (this.bubble.finished && this.active) {
      this.waitT -= dt;
      if (this.waitT <= 0) this._next();
    }
  }

  skip() { if (this.active) this._next(); }
  abort() { this.active = false; this.queue = []; this.bubble.hide(); }
  get done() { return !this.active && !this.bubble.sprite.visible; }
}
