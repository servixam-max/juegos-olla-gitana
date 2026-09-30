// Probe: trace walking INSIDE the left wall (how does the player end up at x=0?)
const R = { trace: [] };
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const up = (c) => key(c, false);

qa.start(0);
qa.step(1/30, 20);
qa.teleport(-5.6, 1.5, 6);
qa.step(1/30, 60);                     // idle: falls to floor inside the wall
R.beforeWalk = { ...qa.state().pos };
key('ArrowUp', true);
for (let i = 0; i < 60; i++) {
  qa.step(1/30, 1);
  const p = qa.state().pos, d = qa.diag();
  R.trace.push({ i, x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3), vx: +d.vel.x.toFixed(3), vz: +d.vel.z.toFixed(3), grounded: d.grounded });
}
up('ArrowUp');
R.errors = qa.data.errors.slice();
return R;
