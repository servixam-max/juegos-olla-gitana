// Probe: ceiling (cabezazo) resolution — N1 has invisible roof at y 4.6..5.1, z 24..96.
const R = {};
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const up = (c) => key(c, false);

qa.start(0);
qa.step(1/30, 20);
R.roofSonda = qa.sonda(0, 4.85, 30);

// stand under the roof
qa.teleport(0, 0.1, 30);
qa.step(1/30, 5);
R.startPos = { ...qa.state().pos };
// jump then double-jump mid-air
key('Space', true); qa.step(1/30, 1); up('Space');
let maxY = -99, trace = [];
for (let i = 0; i < 20; i++) { qa.step(1/30, 1); maxY = Math.max(maxY, qa.state().pos.y); }
key('Space', true); qa.step(1/30, 1); up('Space');
for (let i = 0; i < 90; i++) {
  qa.step(1/30, 1);
  const p = qa.state().pos;
  maxY = Math.max(maxY, p.y);
  if (i < 40) trace.push({ i, y: +p.y.toFixed(3), vy: +qa.diag().vel.y.toFixed(2), grounded: qa.diag().grounded });
}
R.jumpMaxY = +maxY.toFixed(3);
R.settle = { pos: { ...qa.state().pos }, grounded: qa.diag().grounded };
R.onRoof = Math.abs(qa.state().pos.y - 5.1) < 0.1;
R.trace = trace.slice(0, 26);
R.sondaAboveAfter = qa.sonda(0, qa.state().pos.y + 0.1, 30);
R.errors = qa.data.errors.slice();
return R;
