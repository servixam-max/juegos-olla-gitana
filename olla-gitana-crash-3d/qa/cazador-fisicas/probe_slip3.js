// N1 puddle slip, at z=40 (x=1.6), away from the gap movers.
const R = {};
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const up = (c) => key(c, false);

function coast(lvlIdx, x, runFromZ, releaseZ, label) {
  qa.start(lvlIdx);
  qa.step(1/30, 10);
  qa.teleport(x, 0.05, runFromZ);
  qa.step(1/30, 3);
  key('ArrowUp', true);
  let reached = false;
  for (let i = 0; i < 900; i++) { qa.step(1/30, 1); if (qa.state().pos.z >= releaseZ) { reached = true; break; } }
  const zRel = qa.state().pos.z, spRel = Math.hypot(qa.diag().vel.x, qa.diag().vel.z);
  up('ArrowUp');
  let frames = 0, dist = 0;
  for (let i = 0; i < 400; i++) {
    const z0 = qa.state().pos.z;
    qa.step(1/30, 1); frames++;
    dist += qa.state().pos.z - z0;
    if (Math.hypot(qa.diag().vel.x, qa.diag().vel.z) < 0.05) break;
  }
  return { label, reached, releaseZ: +zRel.toFixed(2), speedAtRelease: +spRel.toFixed(2), coastFrames: frames, coastDist: +dist.toFixed(2), coastTimeS: +(frames/30).toFixed(2) };
}

R.puddle40 = coast(0, 1.6, 24, 40, 'N1 puddle z=40 x=1.6');
R.dry40 = coast(0, 4.5, 24, 40, 'N1 dry z=40 x=4.5');
R.errors = qa.data.errors.slice();
return R;
