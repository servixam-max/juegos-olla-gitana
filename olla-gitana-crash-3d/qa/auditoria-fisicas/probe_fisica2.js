/* FÍSICAS (v2): muros, techos, bache (cruce limpio + caída al hueco), barrida,
   giro, salto largo, caída de 30 m. Todo con godMode para aislar la física. */
const R = { errores: [] };
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const P = () => qa.state().pos;
const D = () => qa.diag();
const sleep = (n) => qa.step(1/30, n);

qa.start(0);
sleep(10);

// ---------- 1. MUROS: barrida 15 m/s y giro contra el muro (cara interior 5.0) ----------
qa.teleport(0, 0.1, 100); sleep(30);
key('ArrowUp', true); key('KeyD', true); sleep(40);
key('KeyC', true); sleep(60); key('KeyC', false);
key('KeyX', true); sleep(3); key('KeyX', false); sleep(50);
key('KeyD', false); key('ArrowUp', false);
R.muro = { x: +P().x.toFixed(3), ok: P().x <= 4.6 };

// ---------- 2. SALTO LARGO contra el muro ----------
qa.teleport(3.0, 0.1, 96); sleep(20);
key('ArrowUp', true); key('KeyD', true); sleep(30);
key('KeyC', true); sleep(4); key('KeyC', false);
key('Space', true); sleep(2); key('Space', false);
let maxX = -99;
for (let i = 0; i < 70; i++) { sleep(1); maxX = Math.max(maxX, P().x); }
key('KeyD', false); key('ArrowUp', false);
R.saltoLargo = { maxX: +maxX.toFixed(3), ok: maxX <= 4.6 };

// ---------- 3. CAÍDA desde 30 m ----------
qa.teleport(0, 30, 100);
let frames = 0, minVy = 0, landed = false;
for (let i = 0; i < 240 && !landed; i++) { sleep(1); frames++; minVy = Math.min(minVy, D().vel.y); if (D().grounded && P().y < 0.5) landed = true; }
R.caida30 = { landed, y: +P().y.toFixed(3), frames, vyMax: +minVy.toFixed(1) };

// ---------- 4. BACHE z=20 (1.7 m): cruzar saltando sin caer ----------
qa.teleport(0, 0.1, 16); sleep(20);
key('ArrowUp', true); sleep(18);
key('Space', true); sleep(2); key('Space', false);
let yMin = 99, cayo = false;
for (let i = 0; i < 120; i++) { sleep(1); yMin = Math.min(yMin, P().y); if (P().y < -1) cayo = true; }
key('ArrowUp', false);
R.bacheCruce = { z: +P().z.toFixed(1), yMin: +yMin.toFixed(2), cayo };

// ---------- 5. BACHE: caída dentro (sin saltar) → y baja (killY) ----------
qa.teleport(0, 0.1, 20.0); sleep(4);
let bajo = false, yLow = 0;
for (let i = 0; i < 90; i++) { sleep(1); if (P().y < -3) { bajo = true; yLow = P().y; break; } }
R.bacheCaida = { bajo, y: +yLow.toFixed(1), fin: { y: +P().y.toFixed(2), z: +P().z.toFixed(1) } };
R.errores = qa.data.errors.slice(0, 6);
qa.godMode(false);
return R;
