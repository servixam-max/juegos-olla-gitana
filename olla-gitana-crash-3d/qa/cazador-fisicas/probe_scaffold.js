// Trace: teleport onto the N2 z=34 scaffold and watch each frame.
const R = { trace: [] };
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
qa.start(1);
qa.step(1/30, 10);

// what solids are near (2.6, 34)?
R.boxes = [];
const M = await import('/src/engine/physics.js');
// can't access world directly; use sonda sampling grid
for (const y of [1.0, 1.5, 1.7, 2.0]) {
  const s = qa.sonda(2.6, y, 34);
  R.boxes.push({ y, s: s ? { tag: s.tag, pos: s.pos, half: s.half } : null });
}

qa.teleport(2.6, 1.9, 34);
for (let i = 0; i < 40; i++) {
  qa.step(1/30, 1);
  const p = qa.state().pos, d = qa.diag();
  R.trace.push({ i, x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3), vy: +d.vel.y.toFixed(2), grounded: d.grounded });
}
R.errors = qa.data.errors.slice();
return R;
