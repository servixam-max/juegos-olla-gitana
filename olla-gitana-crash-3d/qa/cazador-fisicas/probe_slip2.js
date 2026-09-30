// Slippery floor test v2: build full speed, release the key INSIDE the zone, measure coast.
const R = {};
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const up = (c) => key(c, false);

function coastTest(lvlIdx, x, runFromZ, releaseZ, label) {
  qa.start(lvlIdx);
  qa.step(1/30, 10);
  qa.teleport(x, 0.05, runFromZ);
  qa.step(1/30, 3);
  key('ArrowUp', true);
  let ok = false;
  for (let i = 0; i < 900; i++) {
    qa.step(1/30, 1);
    if (qa.state().pos.z >= releaseZ) { ok = true; break; }
  }
  const zRel = qa.state().pos.z;
  const spRel = Math.hypot(qa.diag().vel.x, qa.diag().vel.z);
  up('ArrowUp');
  let frames = 0, dist = 0;
  for (let i = 0; i < 400; i++) {
    const z0 = qa.state().pos.z;
    qa.step(1/30, 1); frames++;
    dist += qa.state().pos.z - z0;
    if (Math.hypot(qa.diag().vel.x, qa.diag().vel.z) < 0.05) break;
  }
  return { label, reached: ok, speedAtRelease: +spRel.toFixed(2), coastFrames: frames, coastDist: +dist.toFixed(2), coastTimeS: +(frames/30).toFixed(2) };
}

R.casino_pulido = coastTest(6, 4.5, 6, 24, 'N7 casino polished (release at z=24)');
R.n2_dry = coastTest(1, 4.5, 6, 24, 'N2 dry control (release at z=24)');
R.n1_puddle = coastTest(0, -2.2, 14, 26, 'N1 puddle x=-2.2 (release at z=26)');
R.n1_dry = coastTest(0, 4.0, 14, 26, 'N1 dry x=4.0 (release at z=26)');

// sanity that the slip actually triggers: log friction factor while crossing
qa.start(6); qa.step(1/30, 10);
qa.teleport(4.5, 0.05, 14);
qa.step(1/30, 3);
key('ArrowUp', true);
let sp = [];
for (let i = 0; i < 60; i++) { qa.step(1/30, 1); sp.push(+Math.hypot(qa.diag().vel.x, qa.diag().vel.z).toFixed(2)); }
up('ArrowUp');
R.casinoSpeedRamp = sp;
R.errors = qa.data.errors.slice();
return R;
