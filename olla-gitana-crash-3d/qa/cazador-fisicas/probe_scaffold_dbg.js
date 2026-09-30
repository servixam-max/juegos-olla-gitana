// Debug: who pops the player on the scaffold?
const R = { trace: [] };
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
qa.start(1);
qa.step(1/30, 10);
window.__depenDebug = [];
qa.teleport(2.6, 1.9, 34);
for (let i = 0; i < 20; i++) {
  qa.step(1/30, 1);
  const p = qa.state().pos, d = qa.diag();
  R.trace.push({ i, y: +p.y.toFixed(4), x: +p.x.toFixed(3), vy: +d.vel.y.toFixed(2), grounded: d.grounded, depen: window.__depenDebug.length });
}
R.depen = window.__depenDebug.slice(0, 30);
R.errors = qa.data.errors.slice();
return R;
