// Probe: crates must stop colliding when broken; player must not float on ghosts.
const R = {};
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const up = (c) => key(c, false);

qa.start(0);
qa.step(1/30, 20);

// crates at z=14: x = -1.5, -0.5, 0.5, 1.5. Probe a crate at ground level.
R.sondaCrateBefore = qa.sonda(-1.5, 0.46, 14);
R.sondaCrateTopBefore = qa.sonda(-1.5, 0.9, 14);

// stand on the crate (top at 0.92) and break it with a spin (KeyX)
qa.teleport(-1.5, 1.0, 14);
qa.step(1/30, 10);
R.posOnCrate = { ...qa.state().pos };
R.groundedOnCrate = qa.diag().grounded;
// spin -> crates.nearest + hit
key('KeyX', true); qa.step(1/30, 2); up('KeyX');
qa.step(1/30, 30);
R.posAfterSpin = { ...qa.state().pos };
R.groundedAfterSpin = qa.diag().grounded;
R.sondaCrateAfter = qa.sonda(-1.5, 0.46, 14);
R.sondaCrateTopAfter = qa.sonda(-1.5, 0.9, 14);

// stay put 1 s more: do we fall to the floor (y=0) or float at 0.92?
qa.step(1/30, 60);
R.posSettled = { ...qa.state().pos };
R.groundedSettled = qa.diag().grounded;
R.floating = Math.abs(qa.state().pos.y - 0.92) < 0.05;

// walk across where the crate was
key('ArrowUp', true); qa.step(1/30, 30); up('ArrowUp');
R.posWalkThrough = { ...qa.state().pos };

// steel crate (2 hp) at z=62 cluster? use the pyramid top crate at z=30 (y 2.38)
R.sondaPyramidTop = qa.sonda(0, 2.35, 30);
qa.teleport(0, 2.5, 30);
qa.step(1/30, 10);
R.pyramidStand = { pos: { ...qa.state().pos }, grounded: qa.diag().grounded };

R.errors = qa.data.errors.slice();
return R;
