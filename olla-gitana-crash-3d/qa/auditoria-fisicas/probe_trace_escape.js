/* TRACE: cómo llega el jugador a |x|>7 en N7 (muro en |x|=7.0) y N2. */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const P = () => qa.state().pos;
const R = { n7: [], n2: [], sonda: {}, errors: [] };

function trace(levelIdx, zTest, out) {
  qa.start(levelIdx);
  qa.step(1/30, 10);
  // ¿dónde está el primer sólido a la derecha a la altura del pecho?
  for (const x of [4, 5, 6, 6.5, 7, 7.5, 8, 9, 10, 12, 14]) {
    const s = qa.sonda(x, 0.6, zTest);
    out.push({ probeX: x, tag: s ? s.tag : null, bx: s ? +s.pos.x.toFixed(2) : null, bhx: s ? +s.half.x.toFixed(2) : null, by: s ? +s.pos.y.toFixed(2) : null, bhy: s ? +s.half.y.toFixed(2) : null });
  }
  qa.teleport(0, 0.05, zTest);
  qa.step(1/30, 20);
  return out;
}
R.sonda.n7 = trace(6, 30, []);
R.sonda.n2 = trace(1, 30, []);

function walk(levelIdx, zTest, arr) {
  qa.start(levelIdx);
  qa.step(1/30, 10);
  qa.teleport(0, 0.05, zTest);
  qa.step(1/30, 20);
  key('ArrowUp', true); key('KeyD', true);
  qa.step(1/30, 25);
  key('KeyC', true);
  for (let i = 0; i < 120; i++) {
    qa.step(1/30, 1);
    if (i % 3 === 0) {
      const p = P(), d = qa.diag();
      arr.push({ i, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(1), vy: +d.vel.y.toFixed(1), grounded: d.grounded });
    }
  }
  key('KeyC', false); key('KeyD', false); key('ArrowUp', false);
}
walk(6, 30, R.n7);
walk(1, 30, R.n2);
R.errors = qa.data.errors.slice(0, 6);
qa.godMode(false);
return R;
