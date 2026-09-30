// Baseline: slippery surfaces (N1 puddles, N7 polished casino floor).
const R = {};
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const up = (c) => key(c, false);

function runAndStop(x, fromZ, toZ, label) {
  qa.teleport(x, 0.1, fromZ);
  qa.step(1/30, 4);
  key('ArrowUp', true);
  let reached = false;
  for (let i = 0; i < 600; i++) {
    qa.step(1/30, 1);
    if (qa.state().pos.z >= toZ) { reached = true; break; }
  }
  const zRelease = qa.state().pos.z;
  const spRelease = Math.hypot(qa.diag().vel.x, qa.diag().vel.z);
  up('ArrowUp');
  let frames = 0;
  for (let i = 0; i < 300; i++) {
    qa.step(1/30, 1); frames++;
    if (Math.hypot(qa.diag().vel.x, qa.diag().vel.z) < 0.05) break;
  }
  return { label, reached, zRelease: +zRelease.toFixed(2), spRelease: +spRelease.toFixed(2), stopFrames: frames, stopDist: +(qa.state().pos.z - zRelease).toFixed(2) };
}

qa.start(0);   // N1
qa.step(1/30, 20);
R.n1_dry = runAndStop(4.0, 88, 96, 'N1 dry x=4.0 (control, z88->96)');
qa.start(0); qa.step(1/30, 20);
R.n1_puddle = runAndStop(-2.6, 88, 96, 'N1 puddle x=-2.6 z=96');

qa.start(6);   // N7 casino (resbalon)
qa.step(1/30, 20);
R.n7_sondaFloor = qa.sonda(0, 0.05, 30);
R.n7_shiny = runAndStop(4.0, 14, 22, 'N7 polished x=4.0 (z14->22)');

qa.start(0); qa.step(1/30, 20);
R.n1_sondaFloorTag = qa.sonda(4.0, 0.05, 90);

R.errors = qa.data.errors.slice();
return R;
