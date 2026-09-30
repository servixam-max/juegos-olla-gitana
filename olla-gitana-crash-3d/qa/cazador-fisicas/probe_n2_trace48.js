// Frame trace of the N2 z=48 mover (amp 1.5) — find why some frames are airborne.
const R = { frames: [] };
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
qa.start(1);
qa.step(1/30, 10);

const idx = qa.moviles().findIndex((m) => Math.abs(m.pos.z - 48) < 0.5);
R.idx = idx;
// mount at the platform's CURRENT phase
let m = qa.moviles()[idx];
let mounted = false;
for (let a = 0; a < 30 && !mounted; a++) {
  m = qa.moviles()[idx];
  qa.teleport(m.pos.x, m.pos.y + 0.3 + 0.04, m.pos.z);
  qa.step(1/30, 2);
  const m2 = qa.moviles()[idx];
  if (qa.diag().grounded && Math.abs(qa.state().pos.y - (m2.pos.y + 0.3)) < 0.1) mounted = true;
  else qa.step(1/30, 4);
}
R.mounted = mounted;
for (let i = 0; i < 150; i++) {
  const before = qa.moviles()[idx];
  const topPrev = before.pos.y + 0.3;
  qa.step(1/30, 1);
  const after = qa.moviles()[idx];
  const top = after.pos.y + 0.3;
  const d = qa.diag();
  R.frames.push({
    i, top: +top.toFixed(4), dTop: +(top - topPrev).toFixed(4), y: +qa.state().pos.y.toFixed(4),
    vy: +d.vel.y.toFixed(3), grounded: d.grounded, dev: +(qa.state().pos.y - top).toFixed(4)
  });
}
R.errors = qa.data.errors.slice();
return R;
