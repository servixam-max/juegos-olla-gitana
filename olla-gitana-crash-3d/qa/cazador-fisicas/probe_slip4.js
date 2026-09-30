// N1 puddle slip at z=76 (x=2.4), verifying no mover is in the way.
const R = {};
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const up = (c) => key(c, false);

qa.start(0); qa.step(1/30, 10);
R.movers = qa.moviles().map((m) => ({ z: +m.pos.z.toFixed(1), y: +m.pos.y.toFixed(2) }));

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

R.puddle76 = coast(2.4, 58, 76);   // puddle at x=2.4 z=76
qa.start(0); qa.step(1/30, 10);
R.dry76 = coast(5.5, 58, 76);      // dry lane x=5.5 (inside 13/2=6.5 corridor, away from walls)
R.errors = qa.data.errors.slice();
return R;
