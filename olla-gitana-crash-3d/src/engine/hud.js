/* HUD: vidas, notas, cajas, combo, cronómetro, power-ups y textos flotantes. */
export class Hud {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      lives: document.getElementById('lives'),
      noteNum: document.getElementById('noteNum'),
      crateNum: document.getElementById('crateNum'),
      superNum: document.getElementById('superNum'),
      contNum: document.getElementById('contNum'),
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
  setHint(t) {
    const el = this.el.hint;
    if (!el) return;
    const txt = (t || '').trim();
    el.textContent = txt ? '💡 ' + txt : '';
    el.classList.toggle('hidden', !txt);
  }

  setLives(n) {
    if (n === this.lastLives) return;
    this.lastLives = n;
    const wrap = this.el.lives;
    wrap.innerHTML = '';
    if (!n || n <= 0) {
      wrap.textContent = '—';
    } else {
      // corazones: 3 vidas de nivel (siempre pocas, se dibujan una a una)
      for (let i = 0; i < Math.min(n, 8); i++) {
        const img = document.createElement('span');
        img.className = 'lifeOlla';
        img.textContent = '❤️';
        img.style.fontSize = '15px';
        wrap.appendChild(img);
      }
      if (n > 8) {
        const num = document.createElement('span');
        num.className = 'num';
        num.textContent = 'x' + n;
        wrap.appendChild(num);
      }
    }
    this.flash('livesChip');
  }
  setNotes(n) { this.el.noteNum.textContent = n; this.flash('noteChip'); }
  setCrates(b, t) { this.el.crateNum.textContent = `${b}/${t}`; }
  /* super-vidas de reserva y continues restantes */
  setSuper(sv, cont) {
    if (this.el.superNum) this.el.superNum.textContent = sv;
    if (this.el.contNum) this.el.contNum.textContent = cont;
  }
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
    const bar = el.querySelector('.track > i') || el.querySelector('i');
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
  tick() {
    // solo escribe el DOM cuando cambia el texto (antes escribía cada frame)
    const s = this.timeStr();
    if (s !== this._lastTime) { this._lastTime = s; this.el.timerNum.textContent = s; }
  }

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
    const raw = String(text);
    const PICTO = '(?:\\p{Extended_Pictographic}[\\uFE0F\\u200D\\p{Emoji_Modifier}]*)+';
    // 1) si el aviso empieza por emoji, ese va al hueco de icono
    const head = raw.match(new RegExp('^(' + PICTO + ')\\s*', 'u'));
    // 2) si el emoji está al final, se mueve al hueco de icono (no se duplica)
    const tail = head ? null : raw.match(new RegExp('\\s*(' + PICTO + ')\\s*$', 'u'));
    let ico = head ? head[1] : (tail ? tail[1] : '');
    let rest = head ? raw.slice(head[0].length) : (tail ? raw.slice(0, tail.index) : raw);
    // 3) sin emoji: uno según el tipo de aviso
    if (!ico) ico = kind === 'record' ? '🏆' : kind === 'good' ? '✅' : kind === 'bad' ? '💥' : '💬';
    // pintar siempre el icono en versión emoji (✔ o ⏱ salen apagados sin el FE0F)
    if (!/\uFE0F/u.test(ico) && !/\p{Emoji_Presentation}/u.test(ico)) ico += '\uFE0F';
    const i = document.createElement('span');
    i.className = 'tIco';
    i.textContent = ico;
    const s = document.createElement('span');
    s.className = 'tTxt';
    s.textContent = rest;
    d.append(i, s);
    this.el.toasts.appendChild(d);
    setTimeout(() => d.remove(), 2250);
  }

  damage() {
    this.el.dmgFlash.classList.add('on');
    setTimeout(() => this.el.dmgFlash.classList.remove('on'), 220);
  }
}
