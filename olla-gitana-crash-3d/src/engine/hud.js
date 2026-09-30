/* HUD: vidas, notas, cajas, combo, cronómetro, power-ups y textos flotantes. */
export class Hud {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      lives: document.getElementById('lives'),
      noteNum: document.getElementById('noteNum'),
      crateNum: document.getElementById('crateNum'),
      comboNum: document.getElementById('comboNum'),
      comboChip: document.getElementById('comboChip'),
      timerNum: document.getElementById('timerNum'),
      toasts: document.getElementById('toasts'),
      dmgFlash: document.getElementById('dmgFlash'),
      pressFlash: document.getElementById('pressFlash'),
      pressLbl: document.getElementById('pressLbl'),
      pwAura: document.getElementById('pwAura'),
      pwGhost: document.getElementById('pwGhost'),
      pwShield: document.getElementById('pwShield'),
      hint: document.getElementById('hintChip'),
      touch: document.getElementById('touch')
    };
    this.t0 = 0;
    this.lastCombo = 1;
    this.lastLives = -1;
  }

  show(v) { this.el.hud.classList.toggle('hidden', !v); this.el.touch.classList.toggle('hidden', !v); }
  start() {
    this.t0 = performance.now();
    this.setLives(3);
    this.setNotes(0);
    this.setCrates(0, 0);
    this.setCombo(1);
    this.setPower('aura', 0); this.setPower('ghost', 0); this.setPower('shield', 0);
    this.setPressure(false);
  }
  setHint(t) { this.el.hint.textContent = t; }

  setLives(n) {
    if (n === this.lastLives) return;
    this.lastLives = n;
    const wrap = this.el.lives;
    wrap.innerHTML = '';
    if (!n || n <= 0) {
      wrap.textContent = '—';
    } else if (n <= 5) {
      // hasta 5 vidas: se dibujan las ollitas una a una
      for (let i = 0; i < n; i++) {
        const img = document.createElement('span');
        img.className = 'lifeOlla';
        img.textContent = '🥘';
        img.style.fontSize = '15px';
        wrap.appendChild(img);
      }
    } else {
      // muchas vidas: contador compacto para no comerse la pantalla
      wrap.innerHTML = '<span class="lifeOlla" style="font-size:15px">🥘</span>';
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = 'x' + n;
      wrap.appendChild(num);
    }
    this.flash('livesChip');
  }
  setNotes(n) { this.el.noteNum.textContent = n; this.flash('noteChip'); }
  setCrates(b, t) { this.el.crateNum.textContent = `${b}/${t}`; }
  setCombo(m) {
    this.el.comboNum.textContent = 'x' + m.toFixed(1);
    this.el.comboChip.classList.toggle('hot', m >= 3);
    if (m !== this.lastCombo) this.flash('comboChip');
    this.lastCombo = m;
  }
  setPower(kind, frac) {
    const el = this.el['pw' + kind[0].toUpperCase() + kind.slice(1)];
    if (!el) return;
    el.classList.toggle('hidden', frac <= 0);
    const bar = el.querySelector('i');
    if (bar) bar.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
  }
  setPressure(on) {
    this.el.pressFlash.classList.toggle('hidden', !on);
    this.el.pressLbl.classList.toggle('hidden', !on);
  }
  timeStr() {
    const s = Math.floor((performance.now() - this.t0) / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }
  tick() { this.el.timerNum.textContent = this.timeStr(); }

  flash(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  toast(text, kind = '') {
    const d = document.createElement('div');
    d.className = 'toast ' + kind;
    d.textContent = text;
    this.el.toasts.appendChild(d);
    setTimeout(() => d.remove(), 2100);
  }

  damage() {
    this.el.dmgFlash.classList.add('on');
    setTimeout(() => this.el.dmgFlash.classList.remove('on'), 220);
  }
}
