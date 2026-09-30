// Edge case: a moving platform sweeps INTO a standing player (the N4 tram case).
// Teleport player onto the tram's path at z=22, at the tram's height, standing on floor? no:
// stand on the SIDE where the tram will arrive; measure what depenetration does.
const R = {};
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
qa.start(3);
qa.step(1/30, 10);
function moverAt(zc) { return qa.moviles().find((m) => Math.abs(m.pos.z - zc) < 0.6); }

// mount on the tram
let p = moverAt(22);
for (let a = 0; a < 20; a++) { p = moverAt(22); qa.teleport(p.pos.x, p.pos.y + 0.34, p.pos.z); qa.step(1/30, 2); if (qa.diag().grounded) break; }
R.mount = { grounded: qa.diag().grounded, pos: { ...qa.state().pos } };

// now walk sideways off the tram (ArrowRight => -X per mapping) and stand on the floor; the tram will come back
qa.teleport(-4.0, 0.05, 22);
qa.step(1/30, 5);
R.onFloor = { pos: { ...qa.state().pos }, grounded: qa.diag().grounded };
// wait for the tram to sweep into us; sample
let minDist = 99, overlapFrames = 0, maxPen = 0, trace = [];
for (let i = 0; i < 300; i++) {
  qa.step(1/30, 1);
  const m = moverAt(22);
  const dx = Math.abs(m.pos.x - qa.state().pos.x);
  const dy = (m.pos.y + 0.3) - qa.state().pos.y;   // tram top above our feet?
  if (dx < 0.5 && dy > 0.05 && dy < 1.5) overlapFrames++;
  minDist = Math.min(minDist, dx);
  if (i % 30 === 0) trace.push({ i, platX: +m.pos.x.toFixed(2), playerX: +qa.state().pos.x.toFixed(2), playerY: +qa.state().pos.y.toFixed(2), grounded: qa.diag().grounded, dist: +dx.toFixed(2) });
}
R.sweep = { overlapFrames, minDist: +minDist.toFixed(3), endPlayer: { ...qa.state().pos }, endGrounded: qa.diag().grounded, trace };
R.errors = qa.data.errors.slice();
return R;
