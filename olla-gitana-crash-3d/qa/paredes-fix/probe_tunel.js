/* TÚNEL: demuestra que el resolutor actual no barre (sweep) y a partir de cierto
   paso por frame el actor atraviesa sólidos DELGADOS.
   - N2 (idx1) andamio z=58: rail x=4.6 w=0.14 h=1.1 (y 2.9..4.0), protege el borde
     de la plataforma x∈[1.0,4.2].
   - Techo: tablón del andamio z=46 x=-2.6 (y 2.7..3.3): el actor salta debajo.
   dt grande = paso por frame grande (el loop real clampa dt a 0.05; se prueba
   también dt mayor para exponer el fallo del algoritmo, no del juego). */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const allUp = () => ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyC', 'KeyX', 'Space'].forEach((c) => key(c, false));
const R = { rail: [], techo: [] };

qa.start(1);
for (let i = 0; i < 900 && qa.state().mode !== 'play'; i++) qa.step(1 / 30, 1);

R.sondaRail = qa.sonda(4.6, 3.2, 58);
R.sondaPlataforma = qa.sonda(3.6, 2.5, 58);

function barrido(dt) {
  allUp();
  qa.teleport(3.6, 2.9, 58);
  qa.step(dt, 3);
  const start = { ...qa.state().pos };
  key('ArrowLeft', true); key('KeyC', true);
  let maxX = -99, minY = 99;
  for (let i = 0; i < 40; i++) {
    qa.step(dt, 1);
    const p = qa.state().pos;
    maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y);
    if (p.y < -3) break;
  }
  allUp();
  return { dt, start, maxX: +maxX.toFixed(3), minY: +minY.toFixed(2), cruzaRail: maxX > 4.6, final: { ...qa.state().pos } };
}
for (const dt of [1 / 30, 0.05, 0.08, 0.15]) R.rail.push(barrido(dt));

function techo(dt) {
  allUp();
  qa.teleport(-2.6, 0, 46);
  qa.step(dt, 4);
  let maxY = -99, dentro = 0;
  key('Space', true); qa.step(dt, 1); key('Space', false);
  for (let i = 0; i < 12; i++) { qa.step(dt, 1); maxY = Math.max(maxY, qa.state().pos.y); }
  key('Space', true); qa.step(dt, 1); key('Space', false);
  for (let i = 0; i < 40; i++) {
    qa.step(dt, 1);
    const p = qa.state().pos;
    maxY = Math.max(maxY, p.y);
    if (qa.sonda(p.x, p.y + 0.6, p.z)) dentro++;
  }
  allUp();
  return { dt, maxYpies: +maxY.toFixed(3), esperadoBloqueado: 1.45, atraviesaTecho: maxY > 2.3, framesDentro: dentro, final: { ...qa.state().pos } };
}
for (const dt of [1 / 30, 0.05, 0.2]) R.techo.push(techo(dt));

R.errors = qa.data.errors.slice();
return R;
