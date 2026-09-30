// Probe: crate break -> does the phantom collider remain?
const R = {};
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const up = (c) => key(c, false);

qa.start(0);
qa.step(1/30, 20);

const before = { broken: qa.state().cajas, alive: qa.diag().cajas, total: qa.state().totalCajas };
R.before = before;

// stand on the crate at (-1.5, top 0.92, 14) and SPIN
qa.teleport(-1.5, 0.95, 14);
qa.step(1/30, 5);
R.stand = { pos: { ...qa.state().pos }, grounded: qa.diag().grounded };
key('KeyX', true); qa.step(1/30, 1); up('KeyX');
qa.step(1/30, 10);
R.afterSpin = { broken: qa.state().cajas, alive: qa.diag().cajas, pos: { ...qa.state().pos }, grounded: qa.diag().grounded };
R.sondaAtCrate = qa.sonda(-1.5, 0.46, 14);
R.sondaAtCrateTop = qa.sonda(-1.5, 0.88, 14);
qa.step(1/30, 90);
R.settled = { pos: { ...qa.state().pos }, grounded: qa.diag().grounded, broken: qa.state().cajas, alive: qa.diag().cajas };
R.phantomFloat = Math.abs(qa.state().pos.y - 0.92) < 0.06;

// try to break the next crate too (spin again) and check
key('KeyX', true); qa.step(1/30, 1); up('KeyX');
qa.step(1/30, 40);
R.afterSpin2 = { broken: qa.state().cajas, alive: qa.diag().cajas, pos: { ...qa.state().pos }, grounded: qa.diag().grounded };

// walk forward over the broken area
key('ArrowUp', true); qa.step(1/30, 40); up('ArrowUp');
R.walked = { pos: { ...qa.state().pos }, grounded: qa.diag().grounded };

// now try to jump onto a broken crate area: teleport above the broken crate and fall
qa.teleport(-1.5, 3.0, 14);
qa.step(1/30, 60);
R.fallOntoBroken = { pos: { ...qa.state().pos }, grounded: qa.diag().grounded };

R.errors = qa.data.errors.slice();
return R;
