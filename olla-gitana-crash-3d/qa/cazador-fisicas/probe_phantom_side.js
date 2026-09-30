// Probe: broken crate phantom collider — side collision at floor level.
const R = {};
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const up = (c) => key(c, false);

qa.start(0);
qa.step(1/30, 20);

// crates at z=14 x=-1.5,-0.5,0.5,1.5 -> break the one at x=1.5 (right end of the line)
// stand on it and spin
qa.teleport(1.5, 0.95, 14);
qa.step(1/30, 5);
key('KeyX', true); qa.step(1/30, 1); up('KeyX');
qa.step(1/30, 40);
R.broken = qa.state().cajas;
R.sondaAfter = qa.sonda(1.5, 0.46, 14);

// walk from x=1.5 z=11 toward +Z at floor level -> should pass through z=14 freely
qa.teleport(1.5, 0.05, 10);
qa.step(1/30, 3);
key('ArrowUp', true);
let minZ = 99, maxZ = -99, blocked = false, trace = [];
for (let i = 0; i < 120; i++) {
  qa.step(1/30, 1);
  const p = qa.state().pos;
  minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  if (i % 10 === 0) trace.push({ z: +p.z.toFixed(2), y: +p.y.toFixed(2) });
}
up('ArrowUp');
R.walkThroughZ = { minZ: +minZ.toFixed(2), maxZ: +maxZ.toFixed(2), endZ: +qa.state().pos.z.toFixed(2) };
R.blockedByPhantom = qa.state().pos.z < 13.0;
R.trace = trace;

// control: try to walk into an INTACT crate at x=0.5 z=14 from the south
qa.teleport(0.5, 0.05, 10);
qa.step(1/30, 3);
key('ArrowUp', true);
for (let i = 0; i < 120; i++) { qa.step(1/30, 1); if (qa.state().pos.z > 15) break; }
up('ArrowUp');
R.controlIntactCrate = { endZ: +qa.state().pos.z.toFixed(2), stopped: qa.state().pos.z < 13.2 };

R.errors = qa.data.errors.slice();
return R;
