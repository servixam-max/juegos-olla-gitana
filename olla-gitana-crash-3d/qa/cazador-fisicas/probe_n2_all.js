// Enumerate N2 movers and run a rigorous per-platform ride check using stable identity.
const R = { movers: [], rides: [] };
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
qa.start(1);
qa.step(1/30, 10);
R.movers = qa.moviles().map((m) => ({ z: +m.pos.z.toFixed(2), y: +m.pos.y.toFixed(3), axis: m.moving.axis, amp: m.moving.amp, speed: m.moving.speed }));

// The world.boxes order is stable; index into the movers array to keep identity.
async function ride(i, frames = 240) {
  const mvs = qa.moviles();
  const m = mvs[i];
  if (!m) return null;
  const zc = m.pos.z;
  const match = (list) => list[i];
  // mount
  let mounted = false;
  for (let a = 0; a < 30 && !mounted; a++) {
    const cur = match(qa.moviles());
    qa.teleport(cur.pos.x, cur.pos.y + 0.3 + 0.04, cur.pos.z);
    qa.step(1/30, 2);
    const cur2 = match(qa.moviles());
    if (qa.diag().grounded && Math.abs(qa.state().pos.y - (cur2.pos.y + 0.3)) < 0.1) mounted = true;
    else qa.step(1/30, 4);
  }
  if (!mounted) return { mounted: false };
  let maxDev = -9, minDev = 9, notGrounded = 0, samples = [];
  for (let k = 0; k < frames; k++) {
    qa.step(1/30, 1);
    const cur = match(qa.moviles());
    const dev = qa.state().pos.y - (cur.pos.y + 0.3);
    maxDev = Math.max(maxDev, dev); minDev = Math.min(minDev, dev);
    if (!qa.diag().grounded) notGrounded++;
    if (k % 40 === 0) samples.push({ k, dev: +dev.toFixed(3), grounded: qa.diag().grounded, platY: +cur.pos.y.toFixed(3) });
  }
  return { mounted: true, amp: m.moving.amp, maxDev: +maxDev.toFixed(3), minDev: +minDev.toFixed(3), notGrounded, of: frames, samples };
}

// ride every mover that is a "mover" tag platform (N2 has gaps + movers list). Test the oscillating ones.
for (let i = 0; i < R.movers.length; i++) {
  const r = await ride(i, 240);
  if (r) R.rides.push({ i, z: R.movers[i].z, amp: R.movers[i].amp, ...r });
  qa.start(1); qa.step(1/30, 10);   // reset for next
}
R.errors = qa.data.errors.slice();
return R;
