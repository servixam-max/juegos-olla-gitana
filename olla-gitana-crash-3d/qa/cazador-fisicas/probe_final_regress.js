// Final regression checks: crate landing surfaces below roof level; bounce crate lifecycle.
const R = {};
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const up = (c) => key(c, false);

qa.start(0); qa.step(1/30, 10);

// 1) fall onto the pyramid top crate from y=4.0 (below the roof at 4.6)
qa.teleport(0, 4.0, 30);
qa.step(1/30, 80);
R.landPyramid = { pos: { ...qa.state().pos }, grounded: qa.diag().grounded };
R.expectTop = 2.84;

// 2) fall onto a single crate (line at z=14, x=-0.5)
R.sondaLine = qa.sonda(-0.5, 0.46, 14);
qa.teleport(-0.5, 3.0, 14);
qa.step(1/30, 80);
R.landSingle = { pos: { ...qa.state().pos }, grounded: qa.diag().grounded };
R.expectSingle = 0.92;

// 3) bounce crate: stand on it -> should launch the player (bounce) and the box becomes non-collidable while flying
//    cluster z=48 line type bounce: x=-1.5,-0.5,0.5
R.sondaBounce = qa.sonda(-0.5, 0.46, 48);
qa.teleport(-0.5, 0.95, 48);
qa.step(1/30, 5);
R.bounceMount = { pos: { ...qa.state().pos }, grounded: qa.diag().grounded };
// jump on it to break/bounce (stomp)
key('Space', true); qa.step(1/30, 1); up('Space');
let maxY = 0, trace = [];
for (let i = 0; i < 200; i++) {
  qa.step(1/30, 1);
  maxY = Math.max(maxY, qa.state().pos.y);
  if (i % 20 === 0) trace.push({ i, y: +qa.state().pos.y.toFixed(2), grounded: qa.diag().grounded, cajas: qa.state().cajas });
}
R.bounceMaxY = +maxY.toFixed(2);
R.bounceTrace = trace;
R.sondaBounceAfter = qa.sonda(-0.5, 0.46, 48);
R.brokenAfterBounce = qa.state().cajas;

R.errors = qa.data.errors.slice();
return R;
