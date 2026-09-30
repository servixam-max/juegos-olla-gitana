// Probe 1: lateral wall collision + input injection sanity + floor landing.
const R = {};
const qa = window.__qa;
window.__recordPaused = true;            // freeze rAF loop -> deterministic __qa.step
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const up = (c) => key(c, false);

qa.start(0);
qa.step(1/30, 20);

// --- input injection sanity: ArrowUp should advance +Z ---
qa.teleport(0, 0.1, 6);
qa.step(1/30, 3);
const z0 = qa.state().pos.z;
key('ArrowUp', true); qa.step(1/30, 30); up('ArrowUp');
const z1 = qa.state().pos.z;
R.inputWorks = { z0: +z0.toFixed(2), z1: +z1.toFixed(2), dz: +(z1 - z0).toFixed(2), ok: z1 - z0 > 1 };

// --- wall +X: push left on screen (ArrowLeft -> world +X with yaw=0) ---
qa.teleport(0, 0.1, 6);
qa.step(1/30, 5);
key('ArrowLeft', true);
let maxX = -99, groundedAll = true;
for (let i = 0; i < 180; i++) {
  qa.step(1/30, 1);
  const p = qa.state().pos;
  maxX = Math.max(maxX, p.x);
  if (!qa.diag().grounded && i > 30) groundedAll = false;
}
up('ArrowLeft');
R.wallRight = { maxX: +maxX.toFixed(3), wallInnerFace: 5.0, expectedMax: 4.58, tunneled: maxX > 5.0, groundedAll };

// --- wall -X ---
qa.teleport(0, 0.1, 6);
qa.step(1/30, 5);
key('ArrowRight', true);
let minX = 99;
for (let i = 0; i < 180; i++) { qa.step(1/30, 1); minX = Math.min(minX, qa.state().pos.x); }
up('ArrowRight');
R.wallLeft = { minX: +minX.toFixed(3), wallInnerFace: -5.0, expectedMin: -4.58, tunneled: minX < -5.0 };

// --- push into wall for a long time (tunneling stress) ---
qa.teleport(0, 0.1, 6);
qa.step(1/30, 5);
key('ArrowLeft', true); key('ArrowUp', true);
let maxX2 = -99;
for (let i = 0; i < 300; i++) { qa.step(1/30, 1); maxX2 = Math.max(maxX2, qa.state().pos.x); }
up('ArrowLeft'); up('ArrowUp');
R.wallStress = { maxX: +maxX2.toFixed(3), tunneled: maxX2 > 5.0 };

// --- landing from high up over the floor ---
qa.teleport(0, 15, 4);
qa.step(1/30, 120);
R.landFloor = { pos: { ...qa.state().pos }, grounded: qa.diag().grounded };

// --- landing over a crate pile (pyramid at z=30: top crate at y 1.92+0.46=2.38) ---
qa.start(0); qa.step(1/30, 10);
R.sondaCrateTop = qa.sonda(0, 2.3, 30);
R.sondaCrateSide = qa.sonda(1.0, 0.5, 30);
qa.teleport(0, 4.5, 30);
qa.step(1/30, 90);
R.landCrate = { pos: { ...qa.state().pos }, grounded: qa.diag().grounded };

R.errors = qa.data.errors.slice();
return R;
