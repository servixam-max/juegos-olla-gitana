/* Entrada unificada: teclado + gamepad + táctil (stick y botones).
   Se consulta una vez por frame con poll(): devuelve el estado y los flancos
   (pulsado este frame) comparando con el frame anterior. */

/* --- ajustes del pad táctil (afinar aquí) --- */
const DEAD_ZONE = 0.12;      // zona muerta: por debajo de esto no hay movimiento
const EXPO = 1.2;            // curva de respuesta: 1 = lineal, >1 = más fino cerca del centro
const STICK_RECENTER = 1.1;  // stick dinámico: si el dedo pasa de radius*esto, el origen le sigue
const KNOB_TRAVEL = 0.72;    // recorrido visual del knob (fracción del radio del pad)
const VIBRATE_MS = 8;        // vibración al pulsar un botón

/* vibración corta (móvil): nunca lanza si no existe o el navegador la bloquea */
const buzz = (ms = VIBRATE_MS) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {} };

const MOVE_KEYS = {
  ArrowUp: [0, 1], KeyW: [0, 1],
  ArrowDown: [0, -1], KeyS: [0, -1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0]
};
const JUMP_KEYS = ['Space', 'KeyZ', 'KeyK'];
const SPIN_KEYS = ['KeyX', 'ShiftLeft', 'ShiftRight', 'KeyL'];
const SLIDE_KEYS = ['KeyC', 'ControlLeft', 'ControlRight', 'KeyJ', 'KeyB'];
const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export class Input {
  constructor() {
    this.keys = new Set();
    this.gamepadIndex = null;
    this.prev = { jump: false, spin: false, slide: false };
    this.touch = { x: 0, y: 0, jump: false, spin: false, slide: false };
    this.enabled = true;
    this._stickId = null;
    this._stickOrigin = { x: 0, y: 0 };
    this._knob = null;
    this._bound = false;
    this.onPause = null;
    this.onAny = null;
  }

  /* suelta el stick: sin dedo activo y knob de vuelta al centro */
  _resetStick() {
    this._stickId = null;
    this.touch.x = 0; this.touch.y = 0;
    if (this._knob) this._knob.style.transform = 'translate(0px, 0px)';
  }

  bindDom({ stick, knob, jumpBtn, spinBtn, slideBtn }) {
    if (this._bound) return;
    this._bound = true;
    this._knob = knob || null;

    window.addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (this.onAny) this.onAny(e.code);
      if (e.code === 'KeyP' || e.code === 'Escape') { if (this.onPause) this.onPause(); return; }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.touch.jump = this.touch.spin = this.touch.slide = false; this._resetStick(); });

    const hold = (el, prop) => {
      if (!el) return;
      const on = (ev) => { ev.preventDefault(); el.classList.add('on'); this.touch[prop] = true; buzz(); if (this.onAny) this.onAny('touch'); try { el.setPointerCapture(ev.pointerId); } catch (_) {} };
      const off = (ev) => { ev.preventDefault(); el.classList.remove('on'); this.touch[prop] = false; };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    };
    hold(jumpBtn, 'jump'); hold(spinBtn, 'spin'); hold(slideBtn, 'slide');

    if (stick) {
      const radius = () => Math.max(38, stick.clientWidth * 0.34);
      const move = (ev) => {
        if (this._stickId !== ev.pointerId) return;
        const r = radius();
        let dx = ev.clientX - this._stickOrigin.x;
        let dy = ev.clientY - this._stickOrigin.y;
        let dist = Math.hypot(dx, dy);
        // stick dinámico (estilo Brawl Stars): si el dedo se aleja más allá del
        // aro, el origen le sigue en vez de recortar el vector — el control
        // nunca "se queda corto" al arrastrar lejos.
        const maxD = r * STICK_RECENTER;
        if (dist > maxD) {
          this._stickOrigin.x += dx * ((dist - maxD) / dist);
          this._stickOrigin.y += dy * ((dist - maxD) / dist);
          dx = ev.clientX - this._stickOrigin.x;
          dy = ev.clientY - this._stickOrigin.y;
          dist = Math.hypot(dx, dy);
        }
        const nx = dist > 1e-6 ? dx / dist : 0;
        const ny = dist > 1e-6 ? dy / dist : 0;
        const mag = Math.min(1, dist / r);
        this.touch.x = nx * mag; this.touch.y = ny * mag;
        // el knob apunta siempre hacia el dedo respecto al origen (nuevo)
        if (knob) knob.style.transform = `translate(${nx * mag * r * KNOB_TRAVEL}px, ${ny * mag * r * KNOB_TRAVEL}px)`;
      };
      const end = (ev) => {
        if (this._stickId !== ev.pointerId) return;
        this._resetStick();
      };
      // pointerleave solo suelta si NO tenemos captura del puntero: con captura
      // el dedo puede salir del pad y el stick sigue vivo hasta pointerup/cancel
      const leave = (ev) => {
        if (this._stickId !== ev.pointerId) return;
        let captured = false;
        try { captured = !!(stick.hasPointerCapture && stick.hasPointerCapture(ev.pointerId)); } catch (_) { captured = false; }
        if (!captured) end(ev);
      };
      stick.addEventListener('pointerdown', (ev) => {
        if (this._stickId !== null) return;   // ya hay un dedo en el stick
        ev.preventDefault();
        const r = stick.getBoundingClientRect();
        this._stickId = ev.pointerId;
        this._stickOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        try { stick.setPointerCapture(ev.pointerId); } catch (_) {}   // el dedo no se pierde al salir del pad
        move(ev);
      });
      stick.addEventListener('pointermove', move);
      stick.addEventListener('pointerup', end);
      stick.addEventListener('pointercancel', end);
      stick.addEventListener('lostpointercapture', end);
      stick.addEventListener('pointerleave', leave);
    }

    window.addEventListener('gamepadconnected', (e) => { this.gamepadIndex = e.gamepad.index; });
    window.addEventListener('gamepaddisconnected', () => { this.gamepadIndex = null; });
  }

  setEnabled(v) { this.enabled = v; if (!v) { this.keys.clear(); this.touch.jump = this.touch.spin = this.touch.slide = false; this._resetStick(); } }

  gamepad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    if (!pads) return null;
    if (this.gamepadIndex != null && pads[this.gamepadIndex]) return pads[this.gamepadIndex];
    for (const p of pads) if (p && p.connected) { this.gamepadIndex = p.index; return p; }
    return null;
  }

  hasGamepad() { return !!this.gamepad(); }

  /* Devuelve { x, z, jump, jumpP, spin, spinP, slide, slideP, stick } */
  poll() {
    const out = { x: 0, z: 0, jump: false, spin: false, slide: false, jumpP: false, spinP: false, slideP: false, stick: 0 };
    if (this.enabled) {
      for (const code of this.keys) {
        const m = MOVE_KEYS[code];
        if (m) { out.x += m[0]; out.z += m[1]; }
      }
      const gp = this.gamepad();
      if (gp) {
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        const dead = 0.22;
        if (Math.abs(ax) > dead) out.x += ax;
        if (Math.abs(ay) > dead) out.z -= ay;
        if (gp.buttons[12] && gp.buttons[12].pressed) out.z += 1;
        if (gp.buttons[13] && gp.buttons[13].pressed) out.z -= 1;
        if (gp.buttons[14] && gp.buttons[14].pressed) out.x -= 1;
        if (gp.buttons[15] && gp.buttons[15].pressed) out.x += 1;
        out.jump = out.jump || (gp.buttons[0] && gp.buttons[0].pressed);
        out.spin = out.spin || (gp.buttons[2] && gp.buttons[2].pressed) || (gp.buttons[1] && gp.buttons[1].pressed);
        out.slide = out.slide || (gp.buttons[3] && gp.buttons[3].pressed) || (gp.buttons[6] && gp.buttons[6].value > 0.4);
      }
      for (const k of JUMP_KEYS) if (this.keys.has(k)) out.jump = true;
      for (const k of SPIN_KEYS) if (this.keys.has(k)) out.spin = true;
      for (const k of SLIDE_KEYS) if (this.keys.has(k)) out.slide = true;
      out.jump = out.jump || this.touch.jump;
      out.spin = out.spin || this.touch.spin;
      out.slide = out.slide || this.touch.slide;
      // pad: zona muerta + curva (control fino cerca del centro, tope en el borde)
      let tx = this.touch.x, ty = this.touch.y;
      const tm = Math.hypot(tx, ty);
      if (tm <= DEAD_ZONE) { tx = 0; ty = 0; }
      else {
        const c = Math.pow(Math.min(1, (tm - DEAD_ZONE) / (1 - DEAD_ZONE)), EXPO);
        tx = (tx / tm) * c; ty = (ty / tm) * c;
      }
      out.x += tx;
      out.z += -ty;   // arrastrar hacia arriba en pantalla = avanzar
      out.stick = tm;
    }
    const len = Math.hypot(out.x, out.z);
    if (len > 1) { out.x /= len; out.z /= len; }
    out.jumpP = out.jump && !this.prev.jump;
    out.spinP = out.spin && !this.prev.spin;
    out.slideP = out.slide && !this.prev.slide;
    this.prev.jump = out.jump; this.prev.spin = out.spin; this.prev.slide = out.slide;
    return out;
  }
}

export const input = new Input();
