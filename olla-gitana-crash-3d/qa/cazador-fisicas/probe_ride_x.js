// Precise x-mover ride test: get onto the platform (retry until grounded on it), then ride 8s.
const R = {};
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
qa.start(3);
qa.step(1/30, 10);

function moverAt(zc) { return qa.moviles().find((m) => Math.abs(m.pos.z - zc) < 0.6); }
let plat = moverAt(22);
R.plat0 = { pos: { ...plat.pos }, moving: plat.moving };

// attempt to mount: teleport at current pos + step 2; retry up to 40 times
let mounted = false;
for (let a = 0; a < 40 && !mounted; a++) {
  const p = moverAt(22);
  qa.teleport(p.pos.x, p.pos.y + 0.3 + 0.04, p.pos.z);
  qa.step(1/30, 2);
  const d = qa.diag();
  if (d.grounded && Math.abs(qa.state().pos.y - (moverAt(22).pos.y + 0.3)) < 0.08) mounted = true;
  else qa.step(1/30, 6);   // let it settle / fall, retry
}
R.mounted = mounted;
R.mountTries = 'ok';
if (mounted) {
  let maxAbsDevX = 0, maxAbsDevY = 0, minDevY = 9, notGrounded = 0, samples = [];
  let minX = 99, maxX = -99;
  for (let i = 0; i < 240; i++) {
    qa.step(1/30, 1);
    const after = moverAt(22);
    const devX = Math.abs(qa.state().pos.x - after.pos.x);
    const devY = qa.state().pos.y - (after.pos.y + 0.3);
    maxAbsDevX = Math.max(maxAbsDevX, devX);
    maxAbsDevY = Math.max(maxAbsDevY, devY); minDevY = Math.min(minDevY, devY);
    if (!qa.diag().grounded) notGrounded++;
    minX = Math.min(minX, after.pos.x); maxX = Math.max(maxX, after.pos.x);
    if (i % 24 === 0) samples.push({ i, devX: +devX.toFixed(3), devY: +devY.toFixed(3), platX: +after.pos.x.toFixed(2), playerX: +qa.state().pos.x.toFixed(2), grounded: qa.diag().grounded });
  }
  R.ride = { maxAbsDevX: +maxAbsDevX.toFixed(3), maxDevY: +maxAbsDevY.toFixed(3), minDevY: +minDevY.toFixed(3), notGroundedFrames: notGrounded, of: 240, platformSweepX: [+minX.toFixed(2), +maxX.toFixed(2)], playerEndX: +qa.state().pos.x.toFixed(2), samples };
}
R.errors = qa.data.errors.slice();
return R;
