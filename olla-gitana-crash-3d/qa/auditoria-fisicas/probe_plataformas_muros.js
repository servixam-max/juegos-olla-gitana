/* AUDITORÍA PLATAFORMAS MÓVILES + MUROS: (a) montar en una plataforma móvil y
   medir temblor (oscilación de la posición relativa) y empotramiento; (b) barrida
   y giro a alta velocidad contra muros laterales de varios niveles midiendo el
   máximo |x| alcanzado; (c) plataforma que sube/baja contra el jugador. */
const R = { plataformas: {}, muros: {}, errors: [] };
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const P = () => qa.state().pos;
const D = () => qa.diag();

// ---------- (a) montar en la vagoneta de N1 (z≈54, axis x) ----------
qa.start(0);
qa.step(1/30, 10);
let montada = null;
for (let i = 0; i < 200 && !montada; i++) {
  const mv = qa.moviles().find((m) => Math.abs(m.pos.z - 54) < 4 && m.moving.axis === 'x');
  if (mv) {
    qa.teleport(mv.pos.x, 0.55, mv.pos.z);
    qa.step(1/30, 6);
    if (D().grounded) montada = mv;
  }
  if (!montada) qa.step(1/30, 3);
}
if (montada) {
  const rel = [];
  let maxPen = 0;
  for (let i = 0; i < 180; i++) {
    qa.step(1/30, 1);
    const mv = qa.moviles().find((m) => Math.abs(m.pos.z - 54) < 6 && m.moving.axis === 'x');
    if (!mv) break;
    rel.push({ dx: +(P().x - mv.pos.x).toFixed(3), dy: +(P().y - mv.pos.y).toFixed(3), g: D().grounded });
    if (mv) maxPen = Math.max(maxPen, Math.abs(P().x - mv.pos.x));
  }
  const dxs = rel.map((r) => r.dx);
  const jitter = Math.max(...dxs) - Math.min(...dxs);
  R.plataformas.vagoneta_N1 = {
    frames: rel.length, jitterX: +jitter.toFixed(3), media: +(dxs.reduce((a, b) => a + b, 0) / dxs.length).toFixed(3),
    groundedPct: Math.round(100 * rel.filter((r) => r.g).length / rel.length), fin: { ...P() }
  };
} else R.plataformas.vagoneta_N1 = { montada: false };

// ---------- (b) muros laterales: barrida+giro a tope en N1, N2, N7 ----------
function stressMuro(levelIdx, zTest, dirKey, nombre) {
  qa.start(levelIdx);
  qa.step(1/30, 10);
  qa.teleport(0, 0.05, zTest);
  qa.step(1/30, 40);
  key('ArrowUp', true); key(dirKey, true);
  qa.step(1/30, 30);
  key('KeyC', true);
  let maxAbsX = 0, inside = 0;
  for (let i = 0; i < 90; i++) {
    qa.step(1/30, 1);
    const x = P().x;
    if (Math.abs(x) > maxAbsX) maxAbsX = Math.abs(x);
    if (qa.sonda(x, P().y + 0.6, P().z)) inside++;
  }
  key('KeyC', false);
  // giro con impulso contra el muro
  key('KeyX', true); qa.step(1/30, 2); key('KeyX', false);
  let maxAbsX2 = 0;
  for (let i = 0; i < 60; i++) {
    qa.step(1/30, 1); maxAbsX2 = Math.max(maxAbsX2, Math.abs(P().x));
  }
  key(dirKey, false); key('ArrowUp', false);
  R.muros[nombre] = { maxAbsX_barrida: +maxAbsX.toFixed(3), maxAbsX_giro: +maxAbsX2.toFixed(3), frames_dentro_solido: inside };
}
// N1 muros en |x|=5.6 (cara interior 5.0) → jugador a 4.58
stressMuro(0, 30, 'KeyD', 'N1_z30');
stressMuro(0, 100, 'KeyD', 'N1_z100');
// N2 (levels2): corridor halfW 6.5 → cara interior 5.9
stressMuro(1, 30, 'KeyD', 'N2_z30');
// N5 (levels2 N5): corridor halfW 7.6 → cara 7.0
stressMuro(4, 30, 'KeyD', 'N5_z30');
// N7 casino: corridor halfW 7.6 → cara 7.0
stressMuro(6, 30, 'KeyD', 'N7_z30');

// ---------- (c) plataforma móvil contra el jugador parado ----------
qa.start(0);
qa.step(1/30, 10);
let sw = null;
for (let i = 0; i < 400; i++) {
  qa.step(1/30, 1);
  const mv = qa.moviles().find((m) => m.moving.axis === 'x' && Math.abs(m.pos.z - 54) < 3);
  if (mv && Math.abs(mv.pos.x) < 0.35 && Math.abs(P().z - 54) > 6) {
    // esperar a estar al lado opuesto y quedarse quieto en su camino
    qa.teleport(mv.pos.x > 0 ? -1.2 : 1.2, 0.05, 54);
    sw = { start: true };
    break;
  }
}
if (sw) {
  let worst = null, inside = 0;
  for (let i = 0; i < 240; i++) {
    qa.step(1/30, 1);
    const mv = qa.moviles().find((m) => m.moving.axis === 'x' && Math.abs(m.pos.z - 54) < 6);
    if (!mv) break;
    const dx = Math.abs(P().x - mv.pos.x);
    if (qa.sonda(P().x, P().y + 0.6, P().z)) inside++;
    if (worst === null || dx < worst.dx) worst = { dx: +dx.toFixed(3), px: +P().x.toFixed(2), mx: +mv.pos.x.toFixed(2), py: +P().y.toFixed(2) };
  }
  R.plataformas.barrido_contra_jugador = { minDist: worst, frames_dentro_solido: inside, fin: { ...P() }, grounded: D().grounded };
}
R.errors = qa.data.errors.slice(0, 10);
qa.godMode(false);
return R;
