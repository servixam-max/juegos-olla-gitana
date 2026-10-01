/* AUDITORÍA FÍSICAS (1): muros |x|<=4.58, techos, barrida a 15 m/s, giro con
   impulso, salto largo, caída rápida. N1 (pasillo con muros en |x|≈5.0).
   Determinista: __recordPaused + __qa.step. */
const R = { tests: {}, errors: [] };
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const P = () => qa.state().pos;
const d = () => qa.diag();
const hold = async (code, frames) => { key(code, true); qa.step(1/30, frames); key(code, false); };

qa.start(0);
qa.step(1/30, 10);

// ---------- 1. Barrida contra el muro lateral (x=4.58 es la cara interior) ----------
qa.teleport(0, 0.1, 100);
qa.step(1/30, 30);
key('ArrowUp', true); key('KeyD', true);        // avanzar+der => se orienta a +x
qa.step(1/30, 40);
key('KeyC', true);                              // barrida 15 m/s
qa.step(1/30, 60);
key('KeyC', false); key('KeyD', false); key('ArrowUp', false);
R.tests.barrida_muro = { x: +P().x.toFixed(3), z: +P().z.toFixed(1), maxX_ok: P().x <= 4.6 };

// ---------- 2. Giro con impulso contra el muro ----------
qa.teleport(3.5, 0.1, 100);
qa.step(1/30, 20);
key('ArrowUp', true); key('KeyD', true);
qa.step(1/30, 30);
key('KeyX', true); qa.step(1/30, 2); key('KeyX', false);   // giro
qa.step(1/30, 60);
key('KeyD', false); key('ArrowUp', false);
R.tests.giro_muro = { x: +P().x.toFixed(3), maxX_ok: P().x <= 4.6 };

// ---------- 3. Salto largo contra el muro ----------
qa.teleport(3.0, 0.1, 96);
qa.step(1/30, 20);
key('ArrowUp', true); key('KeyD', true);
qa.step(1/30, 30);
key('KeyC', true); qa.step(1/30, 4); key('KeyC', false);
key('Space', true); qa.step(1/30, 2); key('Space', false);
let maxX3 = -99;
for (let i = 0; i < 70; i++) { qa.step(1/30, 1); maxX3 = Math.max(maxX3, P().x); }
key('KeyD', false); key('ArrowUp', false);
R.tests.saltolargo_muro = { maxX: +maxX3.toFixed(3), ok: maxX3 <= 4.6 };

// ---------- 4. Techo: no atravesar el techo del pasillo (roof no sólido en N1; probamos plataforma) ----------
qa.teleport(0, 0.1, 60);   // zona de plataforma móvil/andamios N1
qa.step(1/30, 30);
const roofY = 6.5;
R.tests.sin_techo_datos = { y: +P().y.toFixed(2) };

// ---------- 5. Caída rápida desde muy alto: sin atravesar el suelo ----------
qa.teleport(0, 30, 100);
let minY = 99, landed = false, frames = 0;
for (let i = 0; i < 240; i++) {
  qa.step(1/30, 1); frames++;
  const p = d();
  minY = Math.min(minY, p.vel.y);
  if (p.grounded && P().y < 0.5) { landed = true; break; }
}
R.tests.caida_alta = { landed, y: +P().y.toFixed(3), frames, velYmax: +minY.toFixed(2), x: +P().x.toFixed(2), z: +P().z.toFixed(1) };

// ---------- 6. Caída pegada al muro (el bug histórico): caer por un hueco junto al muro ----------
qa.teleport(4.5, 3, 100);   // pegado al muro a 3 m
qa.step(1/30, 5);
hold('ArrowUp', 30);
R.tests.caida_muro = { x: +P().x.toFixed(3), y: +P().y.toFixed(2), ok: P().x <= 4.6 };

// ---------- 7. Barrida por el hueco (bache) — no atravesar el borde ----------
qa.teleport(0, 0.1, 20.0);
qa.step(1/30, 15);
const zBefore = P().z;
hold('ArrowUp', 40);
R.tests.bache = { zAntes: +zBefore.toFixed(1), zDespues: +P().z.toFixed(1), y: +P().y.toFixed(2) };

R.errors = qa.data.errors.slice(0, 10);
qa.godMode(false);
return R;
