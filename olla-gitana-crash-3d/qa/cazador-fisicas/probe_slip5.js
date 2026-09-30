// N1 puddle slip at z=96 (x=-2.6) on a crate-free lane (x=-3.4).
const R = {};
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const up = (c) => key(c, false);

function coast(x, runFromZ, releaseZ) {
  qa.teleport(x, 0.05, runFromZ);
  qa.step(1/30, 3);
  key('ArrowUp', true);
  let reached = false;
  for (let i = 0; i < 1200; i++) { qa.step(1/30, 1); if (qa.state().pos.z >= releaseZ) { reached = true; break; } }
  const zRel = qa.state().pos.z, spRel = Math.hypot(qa.diag().vel.x, qa.diag().vel.z);
  up('ArrowUp');
  let frames = 0, dist = 0;
  for (let i = 0; i < 400; i++) {
    const z0 = qa.state().pos.z;
    qa.step(1/30, 1); frames++;
    dist += qa.state().pos.z - z0;
    if (Math.hypot(qa.diag().vel.x, qa.diag().vel.z) < 0.05) break;
  }
  return { reached, releaseZ: +zRel.toFixed(2), speedAtRelease: +spRel.toFixed(2), coastFrames: frames, coastDist: +dist.toFixed(2), coastTimeS: +(frames/30).toFixed(2) };
}

qa.start(0); qa.step(1/30, 10);
R.puddle96 = coast(-3.4, 80, 96);    // puddle x=-2.6 z=96 r=1.7; lane x=-3.4 clear of crates
qa.start(0); qa.step(1/30, 10);
R.dry96 = coast(3.5, 80, 96);        // dry lane
R.errors = qa.data.errors.slice();
return R;
