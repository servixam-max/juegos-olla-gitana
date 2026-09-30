// Probe: fine trace — teleport inside wall/ground/pyramid. Where does the player end up?
const R = { wallTrace: [], pyramidTrace: [] };
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
qa.start(0);
qa.step(1/30, 20);

// inside wall
qa.teleport(-5.6, 1.5, 6);
for (let i = 0; i < 20; i++) {
  qa.step(1/30, 1);
  const p = qa.state().pos, d = qa.diag();
  R.wallTrace.push({ i, x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3), vy: +d.vel.y.toFixed(2), grounded: d.grounded });
}

// inside ground slab
qa.teleport(0, 0.3, 6);
for (let i = 0; i < 10; i++) {
  qa.step(1/30, 1);
  const p = qa.state().pos, d = qa.diag();
  R.groundTrace = R.groundTrace || [];
  R.groundTrace.push({ i, y: +p.y.toFixed(3), vy: +d.vel.y.toFixed(2), grounded: d.grounded });
}

// inside the top crate of the pyramid (feet 2.5, crate top 2.84)
qa.teleport(0, 2.5, 30);
for (let i = 0; i < 30; i++) {
  qa.step(1/30, 1);
  const p = qa.state().pos, d = qa.diag();
  R.pyramidTrace.push({ i, x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3), vy: +d.vel.y.toFixed(2), vx: +d.vel.x.toFixed(2), grounded: d.grounded });
}

R.errors = qa.data.errors.slice();
return R;
