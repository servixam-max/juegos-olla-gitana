/* REPRODUCCIÓN del bug 'atravesamos paredes sin sentido'.
   Muro de N1: wall(x:5.6, w:1.2) -> cara interior x=5.0; jugador r=0.42 -> |x|<=4.58.
   Se prueba con dt=1/30 (nominal) y dt=0.05 (peor frame real admitido por el loop).
   Evidencia: maxX alcanzado, frames DENTRO de un sólido (__qa.sonda), cruce del muro. */
const R = { casos: [], muro: { caraInteriorX: 5.0, xMaxJugador: 4.58 } };
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const allUp = () => ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyC', 'KeyX', 'Space'].forEach((c) => key(c, false));
const sonda = (p) => qa.sonda(p.x, p.y + 0.6, p.z);

qa.start(0);
for (let i = 0; i < 900 && qa.state().mode !== 'play'; i++) qa.step(1 / 30, 1);

function run({ nombre, dt, teclas, pre = 2, frames = 200, desde = [0, 0.2, 8] }) {
  allUp();
  qa.teleport(desde[0], desde[1], desde[2]);
  qa.step(dt, 12);
  teclas.forEach((c) => key(c, true));
  qa.step(dt, pre);
  let maxX = -99, minX = 99, maxZ = -99, dentro = 0, fuera = 0, primerFuera = null;
  for (let i = 0; i < frames; i++) {
    qa.step(dt, 1);
    const p = qa.state().pos;
    maxX = Math.max(maxX, p.x); minX = Math.min(minX, p.x); maxZ = Math.max(maxZ, p.z);
    if (sonda(p)) { dentro++; if (!primerFuera) primerFuera = { i, ...p }; }
    if (p.x > 4.58) fuera++;
  }
  allUp();
  const c = {
    nombre, dt: +dt.toFixed(4), teclas, frames,
    maxX: +maxX.toFixed(3), minX: +minX.toFixed(3), maxZ: +maxZ.toFixed(3),
    cruzaCara: maxX > 4.58, dentroDeMuro: fuera, framesDentroSolido: dentro, primerDentro: primerFuera
  };
  R.casos.push(c);
  return c;
}

// (a) barrida recta a 15 m/s contra el muro +X
run({ nombre: 'a_slide_recto_dt30', dt: 1 / 30, teclas: ['ArrowLeft', 'KeyC'], frames: 90 });
run({ nombre: 'a_slide_recto_dt50', dt: 0.05, teclas: ['ArrowLeft', 'KeyC'], frames: 60 });
// (b) giro con impulso contra el muro (correr +X + spin repetido)
run({ nombre: 'b_spin_impulso_dt30', dt: 1 / 30, teclas: ['ArrowLeft', 'KeyX'], frames: 90 });
run({ nombre: 'b_spin_impulso_dt50', dt: 0.05, teclas: ['ArrowLeft', 'KeyX'], frames: 60 });
// (b2) giro tras barrida (impulso encadenado)
run({ nombre: 'b2_slide_spin_dt50', dt: 0.05, teclas: ['ArrowLeft', 'KeyC', 'KeyX'], frames: 60 });
// (d) diagonal contra la pared a velocidad máxima (slide diagonal +X +Z)
run({ nombre: 'd_diagonal_slide_dt30', dt: 1 / 30, teclas: ['ArrowLeft', 'ArrowUp', 'KeyC'], frames: 120 });
run({ nombre: 'd_diagonal_slide_dt50', dt: 0.05, teclas: ['ArrowLeft', 'ArrowUp', 'KeyC'], frames: 60 });
// (d2) diagonal con salto largo (barrida -> salto) contra la pared
run({ nombre: 'd2_longjump_diag_dt50', dt: 0.05, teclas: ['ArrowLeft', 'ArrowUp', 'KeyC', 'Space'], frames: 60 });
// (e) caída desde 15 m contra el borde de la plataforma gruesa (isla z=66, w=5.4 -> borde x=2.7)
run({ nombre: 'e_caida_borde_dt30', dt: 1 / 30, teclas: ['ArrowLeft'], frames: 150, desde: [2.4, 15, 68] });
run({ nombre: 'e_caida_borde_dt50', dt: 0.05, teclas: ['ArrowLeft'], frames: 100, desde: [2.4, 15, 68] });
run({ nombre: 'e2_caida_diag_borde_dt50', dt: 0.05, teclas: ['ArrowLeft', 'ArrowUp'], frames: 100, desde: [2.0, 15, 66] });

// (c) salto contra el techo del muro: en N1 el techo es NO solido; se prueba el cabezazo contra la cara del muro
run({ nombre: 'c_salto_pared_dt30', dt: 1 / 30, teclas: ['ArrowLeft', 'Space'], frames: 120 });
run({ nombre: 'c_salto_pared_dt50', dt: 0.05, teclas: ['ArrowLeft', 'Space'], frames: 80 });

// (f) estrés: barrida diagonal + salto + giro, 400 frames a dt 0.05 con teleports cerca del muro
allUp();
const stress = { cruces: 0, dentro: 0, maxX: -99 };
for (let k = 0; k < 12; k++) {
  qa.teleport(3.6 + Math.random() * 0.9, 0.2 + Math.random() * 2, 6 + k * 12);
  qa.step(0.05, 6);
  key('ArrowLeft', true); key(Math.random() < 0.5 ? 'ArrowUp' : 'ArrowRight', true);
  if (k % 3 === 0) key('KeyC', true); else key('KeyC', false);
  if (k % 4 === 0) { key('Space', true); qa.step(0.05, 1); key('Space', false); } 
  if (k % 2 === 0) { key('KeyX', true); qa.step(0.05, 1); key('KeyX', false); }
  for (let i = 0; i < 25; i++) {
    qa.step(0.05, 1);
    const p = qa.state().pos;
    stress.maxX = Math.max(stress.maxX, p.x);
    if (p.x > 4.58) stress.cruces++;
    if (sonda(p)) stress.dentro++;
  }
  allUp();
}
R.estres = { ...stress, maxX: +stress.maxX.toFixed(3) };

R.sondaMuro = { en5_2: qa.sonda(5.2, 1.0, 12), en4_5: qa.sonda(4.5, 1.0, 12) };
R.errors = qa.data.errors.slice();
return R;
