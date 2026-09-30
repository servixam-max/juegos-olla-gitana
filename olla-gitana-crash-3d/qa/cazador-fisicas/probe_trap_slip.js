// Probe: stuck inside a solid — can the player get out? Plus slippery surfaces.
const R = {};
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const up = (c) => key(c, false);

qa.start(0);
qa.step(1/30, 20);

// --- teleport INSIDE the left wall (center x=-5.6, half 0.6, y 0..5.4) ---
R.insideSonda = qa.sonda(-5.6, 1.5, 6);
qa.teleport(-5.6, 1.5, 6);
R.posInside = { ...qa.state().pos };
qa.step(1/30, 60);          // no input, 2 s
R.posNoInput = { ...qa.state().pos };
R.diagNoInput = qa.diag();
// try to walk forward (ArrowUp => +Z)
key('ArrowUp', true); qa.step(1/30, 60); up('ArrowUp');
R.posAfterForward = { ...qa.state().pos };
// walk toward the street (-X? with yaw 0, ArrowRight => -X per inverted mapping? verify) -> use both
key('ArrowRight', true); qa.step(1/30, 60); up('ArrowRight');
R.posAfterRight = { ...qa.state().pos };
key('ArrowLeft', true); qa.step(1/30, 60); up('ArrowLeft');
R.posAfterLeft = { ...qa.state().pos };
// jump
key('Space', true); qa.step(1/30, 2); up('Space'); qa.step(1/30, 60);
R.posAfterJump = { ...qa.state().pos };
R.escaped = Math.abs(qa.state().pos.x) < 5.0;

// --- teleport inside a ground slab (y 0..0.6 at z=6) ---
qa.teleport(0, 0.3, 6);
qa.step(1/30, 30);
R.posInsideGround = { ...qa.state().pos };
R.diagInsideGround = qa.diag();

// --- slippery: N1 (index 0) puddle at x=-2.2 z=26 r=1.7 ---
function slideTest(x, z, label) {
  qa.teleport(x, 0.1, z - 20);         // run-up on dry ground
  qa.step(1/30, 5);
  key('ArrowUp', true);
  // run until z reaches the puddle center zone
  for (let i = 0; i < 400; i++) {
    qa.step(1/30, 1);
    if (qa.state().pos.z >= z - 0.4) break;
  }
  // keep running 0.4 s to be inside
  qa.step(1/30, 12);
  const zRelease = qa.state().pos.z, spRelease = Math.hypot(qa.diag().vel.x, qa.diag().vel.z);
  up('ArrowUp');
  let frames = 0;
  for (let i = 0; i < 200; i++) {
    qa.step(1/30, 1); frames++;
    const sp = Math.hypot(qa.diag().vel.x, qa.diag().vel.z);
    if (sp < 0.05) break;
  }
  return { label, zRelease: +zRelease.toFixed(2), spRelease: +spRelease.toFixed(2), stopFrames: frames, stopDist: +(qa.state().pos.z - zRelease).toFixed(2), stopTimeS: +(frames / 30).toFixed(2) };
}
R.puddleSlide = slideTest(-2.2, 26, 'N1 puddle x=-2.2 z=26');
R.drySlide = slideTest(4.0, 26, 'N1 dry x=4 (control)');

// --- casino N7 (index 6): polished floor ---
qa.start(6);
qa.step(1/30, 20);
R.n7_pulidoSonda = qa.sonda(0, 0.2, 20);
function slideTestN7(z) {
  qa.teleport(0, 0.1, z - 18);
  qa.step(1/30, 5);
  key('ArrowUp', true);
  for (let i = 0; i < 400; i++) { qa.step(1/30, 1); if (qa.state().pos.z >= z) break; }
  qa.step(1/30, 12);
  const zRelease = qa.state().pos.z, spRelease = Math.hypot(qa.diag().vel.x, qa.diag().vel.z);
  up('ArrowUp');
  let frames = 0;
  for (let i = 0; i < 240; i++) {
    qa.step(1/30, 1); frames++;
    if (Math.hypot(qa.diag().vel.x, qa.diag().vel.z) < 0.05) break;
  }
  return { zRelease: +zRelease.toFixed(2), spRelease: +spRelease.toFixed(2), stopFrames: frames, stopDist: +(qa.state().pos.z - zRelease).toFixed(2) };
}
R.casinoSlide = slideTestN7(20);

R.errors = qa.data.errors.slice();
return R;
