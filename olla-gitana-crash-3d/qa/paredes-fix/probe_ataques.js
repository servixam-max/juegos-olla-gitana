/* Suite de ATAQUES (velocidad real del juego + variantes) contra muros, esquinas
   y geometría delgada. Muro N1: cara interior 5.0; jugador r=0.42 -> |x|<=4.58.
   Mide el peor |x| alcanzado y si la posición final queda dentro del muro.
   Sirve de ANTES/DESPUÉS con el mismo probe. */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const allUp = () => ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyC', 'KeyX', 'Space'].forEach((c) => key(c, false));
const R = { casos: [], limites: { muroIzq: -4.58, muroDer: 4.58 } };

function escenario(idx) {
  qa.start(idx);
  for (let i = 0; i < 900 && qa.state().mode !== 'play'; i++) qa.step(1 / 30, 1);
}
function ataque(nombre, { idx = 0, dt = 1 / 30, desde = [0, 0.2, 8], teclas, pre = 4, frames = 120, y = 0 }) {
  allUp();
  qa.teleport(desde[0], desde[1], desde[2]);
  qa.step(dt, 10);
  // fase de preparación (correr) y luego ataque
  key('ArrowLeft', teclas.includes('L') ? true : false);
  let fases = [];
  if (teclas.includes('S')) { key('KeyC', true); qa.step(dt, 3); }
  if (teclas.includes('X')) { key('KeyX', true); qa.step(dt, 1); key('KeyX', false); }
  if (teclas.includes('J')) { key('Space', true); qa.step(dt, 1); key('Space', false); }
  teclas.split('').forEach((t) => {
    if (t === 'U') key('ArrowUp', true);
    if (t === 'D') key('ArrowLeft', true);
    if (t === 'R') key('ArrowRight', true);
  });
  let maxAbs = 0, maxX = -99, dentro = 0, final;
  for (let i = 0; i < frames; i++) {
    qa.step(dt, 1);
    const p = qa.state().pos;
    maxX = Math.max(maxX, p.x); maxAbs = Math.max(maxAbs, Math.abs(p.x));
    if (qa.sonda(p.x, p.y + 0.6, p.z) || qa.sonda(p.x, p.y + 1.1, p.z)) dentro++;
    final = { x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(1) };
  }
  allUp(); key('KeyC', false); key('ArrowLeft', false);
  const c = { nombre, dt: +dt.toFixed(4), maxX: +maxX.toFixed(3), maxAbs: +maxAbs.toFixed(3), framesDentro: dentro, final };
  R.casos.push(c);
  return c;
}

escenario(0);
// A: barrida recta 15 m/s a dt 1/30 y 0.05
ataque('A_barrida_recto_dt30', { teclas: 'LD S', dt: 1 / 30, frames: 90 });
ataque('A_barrida_recto_dt50', { teclas: 'LD S', dt: 0.05, frames: 60 });
// B: giro con impulso sobre barrida (17.25 m/s)
ataque('B_spin_sobre_barrida_dt50', { teclas: 'LD S X', dt: 0.05, frames: 60 });
// C: salto largo diagonal (11.34 m/s)
ataque('C_longjump_diag_dt50', { teclas: 'LD U S J', dt: 0.05, frames: 60 });
// D: diagonal a máxima (slide+giro encadenados)
ataque('D_diag_slide_spin_dt50', { teclas: 'LD U S X', dt: 0.05, frames: 60 });
// E: caída 15 m junto al muro con empuje lateral
ataque('E_caida15_muro_dt50', { desde: [4.3, 15, 30], teclas: 'LD', dt: 0.05, frames: 90 });
// F: caída 40 m a 30 m/s con empuje lateral
ataque('F_caida40_muro_dt50', { desde: [4.3, 40, 30], teclas: 'LD', dt: 0.05, frames: 90 });
// G: esquina muro (z≈18 hueco) — caída por el hueco empujando en diagonal
ataque('G_hueco_diag_dt50', { desde: [4.0, 3, 16], teclas: 'LD U S', dt: 0.05, frames: 90 });
ataque('G2_hueco_diag_dt30', { desde: [4.0, 3, 16], teclas: 'LD U S', dt: 1 / 30, frames: 120 });

// H: N2 rail delgado (x=4.6 w=0.14, y 2.9..4.0) con barrida a 15 m/s
escenario(1);
ataque('H_rail_delgado_N2_dt30', { idx: 1, desde: [3.6, 2.9, 58], teclas: 'LD S', dt: 1 / 30, frames: 60 });
ataque('H_rail_delgado_N2_dt50', { idx: 1, desde: [3.6, 2.9, 58], teclas: 'LD S', dt: 0.05, frames: 40 });

// I: caída al vacío junto al muro empujando (sin hueco: 40 m en z=40, suelo continuo)
escenario(0);
ataque('I_caida40_z40_dt50', { desde: [4.3, 40, 40], teclas: 'LD', dt: 0.05, frames: 90 });

R.sondaMuro = { dentro: qa.sonda(5.2, 1.0, 30), fuera: qa.sonda(4.5, 1.0, 30) };
R.errors = qa.data.errors.slice();
return R;
