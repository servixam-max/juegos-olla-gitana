/* TRACE N2: caída por el bache de z=30 y cruce lateral del muro.
   Registra frame a frame x,y,z,vy,grounded y si está dentro de un sólido. */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const P = () => qa.state().pos;
const D = () => qa.diag();
const R = { traza: [], sondas: {} };
qa.start(1);
qa.step(1/30, 5);
// sólidos: muros en z=24..36
for (const z of [24, 30, 36, 12]) {
  const fila = [];
  for (const x of [-6.2, -5.6, -5.0, -4.8, -4.58, 0, 4.58, 5.0, 5.6, 6.2]) {
    for (const y of [0.6, 2.0, -2.0]) {
      const s = qa.sonda(x, y, z);
      if (s) fila.push([x, y, s.tag]);
    }
  }
  R.sondas['z' + z] = fila;
}
qa.teleport(0, 0.1, 30);
qa.step(1/30, 2);
key('ArrowUp', true); key('KeyD', true);
for (let i = 0; i < 240; i++) {
  qa.step(1/30, 1);
  const p = P(), d = D();
  const s = qa.sonda(p.x, p.y + 0.5, p.z);
  R.traza.push([i, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(1), +d.vel.x.toFixed(1), +d.vel.y.toFixed(1), d.grounded ? 1 : 0, s ? s.tag : '']);
}
key('KeyD', false); key('ArrowUp', false);
R.errors = qa.data.errors.slice(0, 6);
qa.godMode(false);
return R;
