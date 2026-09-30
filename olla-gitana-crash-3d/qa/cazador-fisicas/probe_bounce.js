// Bounce crate: hit with spin -> flies (non-collidable) -> lands -> breaks. Verify no ghost collision.
const R = {};
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const up = (c) => key(c, false);

qa.start(0); qa.step(1/30, 10);
// walk to the bounce crate at (-0.5, 48) and spin next to it
qa.teleport(-0.5, 0.05, 47.2);
qa.step(1/30, 5);
key('KeyX', true); qa.step(1/30, 1); up('KeyX');
let seen = [];
for (let i = 0; i < 300; i++) {
  qa.step(1/30, 1);
  const s = qa.sonda(-0.5, 0.46, 48);
  if (i % 15 === 0) seen.push({ i, y: +qa.state().pos.y.toFixed(2), cajas: qa.state().cajas, sonda: s ? s.tag : null });
}
R.trace = seen;
R.brokenTotal = qa.state().cajas;
R.sondaEnd = qa.sonda(-0.5, 0.46, 48);
// can we now walk through where the crate was?
qa.teleport(-0.5, 0.05, 47.2);
qa.step(1/30, 3);
key('ArrowUp', true); qa.step(1/30, 60); up('ArrowUp');
R.walkThroughEnd = { z: +qa.state().pos.z.toFixed(2) };
R.errors = qa.data.errors.slice();
return R;
