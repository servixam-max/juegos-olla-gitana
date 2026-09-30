// Probe: can the player RIDE moving platforms (y-axis N2/N1, x-axis N4)?
const R = { rides: [] };
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);

function topOf(m) { return m.pos.y + 0.3; }  // floorSeg h=0.6 -> half 0.3

// --- N2 (index 1): oscillating platform at z=26 ---
qa.start(1);
qa.step(1/30, 10);
let mv = qa.moviles();
R.n2_count = mv.length;
const p26 = mv.find((m) => Math.abs(m.pos.z - 26) < 0.6);
R.n2_p26 = p26 ? { tag: p26.tag, pos: { ...p26.pos }, moving: p26.moving } : null;
if (p26) {
  qa.teleport(0, topOf(p26) + 0.06, 26);
  qa.step(1/30, 4);
  // ride 8 s
  let maxDev = -9, minDev = 9, notGrounded = 0, y0 = qa.state().pos.y, samples = [];
  for (let i = 0; i < 240; i++) {
    const before = qa.moviles().find((m) => Math.abs(m.pos.z - 26) < 0.6);
    qa.step(1/30, 1);
    const after = qa.moviles().find((m) => Math.abs(m.pos.z - 26) < 0.6);
    const top = topOf(after);
    const delta = after.pos.y - before.pos.y;
    const dev = qa.state().pos.y - top;
    maxDev = Math.max(maxDev, dev); minDev = Math.min(minDev, dev);
    if (!qa.diag().grounded) notGrounded++;
    if (i % 20 === 0) samples.push({ i, dev: +dev.toFixed(3), delta: +delta.toFixed(4), grounded: qa.diag().grounded, y: +qa.state().pos.y.toFixed(3), top: +top.toFixed(3) });
  }
  R.rides.push({ level: 'N2 z26', maxDev: +maxDev.toFixed(3), minDev: +minDev.toFixed(3), notGroundedFrames: notGrounded, of: 240, endPos: { ...qa.state().pos }, samples });
}

// --- N4 (index 3): horizontal platform at z=22 ---
qa.start(3);
qa.step(1/30, 10);
mv = qa.moviles();
R.n4_count = mv.length;
const v22 = mv.find((m) => Math.abs(m.pos.z - 22) < 0.6);
R.n4_v22 = v22 ? { tag: v22.tag, pos: { ...v22.pos }, moving: v22.moving } : null;
if (v22) {
  qa.teleport(0, topOf(v22) + 0.06, 22);
  qa.step(1/30, 4);
  let maxDevX = -9, maxDevY = -9, minDevY = 9, notGrounded = 0, samples = [];
  for (let i = 0; i < 240; i++) {
    qa.step(1/30, 1);
    const after = qa.moviles().find((m) => Math.abs(m.pos.z - 22) < 0.6);
    const devX = qa.state().pos.x - after.pos.x;
    const devY = qa.state().pos.y - topOf(after);
    maxDevX = Math.max(maxDevX, Math.abs(devX));
    maxDevY = Math.max(maxDevY, devY); minDevY = Math.min(minDevY, devY);
    if (!qa.diag().grounded) notGrounded++;
    if (i % 20 === 0) samples.push({ i, devX: +devX.toFixed(3), devY: +devY.toFixed(3), grounded: qa.diag().grounded });
  }
  R.rides.push({ level: 'N4 z22 (x-mover)', maxAbsDevX: +maxDevX.toFixed(3), maxDevY: +maxDevY.toFixed(3), minDevY: +minDevY.toFixed(3), notGroundedFrames: notGrounded, of: 240, platformEndX: +qa.moviles().find((m) => Math.abs(m.pos.z - 22) < 0.6).pos.x.toFixed(2), playerEndX: +qa.state().pos.x.toFixed(2), samples });
}

// --- N1 (index 0): mover over a gap, ride test ---
qa.start(0);
qa.step(1/30, 10);
mv = qa.moviles();
R.n1_count = mv.length;
const g1 = mv[0];
if (g1) {
  qa.teleport(g1.pos.x, topOf(g1) + 0.06, g1.pos.z);
  qa.step(1/30, 4);
  let notGrounded = 0, maxDev = -9, minDev = 9;
  for (let i = 0; i < 240; i++) {
    qa.step(1/30, 1);
    const after = qa.moviles()[0];
    const dev = qa.state().pos.y - topOf(after);
    maxDev = Math.max(maxDev, dev); minDev = Math.min(minDev, dev);
    if (!qa.diag().grounded) notGrounded++;
  }
  R.rides.push({ level: 'N1 gap mover', maxDev: +maxDev.toFixed(3), minDev: +minDev.toFixed(3), notGroundedFrames: notGrounded, of: 240, endPos: { ...qa.state().pos }, endTop: +topOf(qa.moviles()[0]).toFixed(3) });
}

R.errors = qa.data.errors.slice();
return R;
