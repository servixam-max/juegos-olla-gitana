// Frame-by-frame trace of riding a y-mover: how does landing fire?
const R = { frames: [] };
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
qa.start(1);                       // N2
qa.step(1/30, 10);
const mv = qa.moviles().filter((m) => Math.abs(m.pos.z - 26) < 1.5);
R.moversNear26 = mv.map((m) => ({ z: +m.pos.z.toFixed(2), y: +m.pos.y.toFixed(3), amp: m.moving.amp, speed: m.moving.speed, axis: m.moving.axis }));
// pick the oscillating one (amp 1.2)
const target = mv.find((m) => m.moving.amp === 1.2) || mv[0];
if (target) {
  const tz = target.pos.z;
  qa.teleport(target.pos.x, target.pos.y + 0.3 + 0.05, tz);
  qa.step(1/30, 2);
  for (let i = 0; i < 70; i++) {
    const before = qa.moviles().find((m) => Math.abs(m.pos.z - tz) < 0.01);
    const beforeTop = before.pos.y + 0.3;
    qa.step(1/30, 1);
    const after = qa.moviles().find((m) => Math.abs(m.pos.z - tz) < 0.01);
    const afterTop = after.pos.y + 0.3;
    const d = qa.diag();
    R.frames.push({
      i, y: +qa.state().pos.y.toFixed(4), vy: +d.vel.y.toFixed(3), grounded: d.grounded,
      topPrev: +beforeTop.toFixed(4), top: +afterTop.toFixed(4), dTop: +(afterTop - beforeTop).toFixed(4),
      dev: +(qa.state().pos.y - afterTop).toFixed(4)
    });
  }
}
return R;
