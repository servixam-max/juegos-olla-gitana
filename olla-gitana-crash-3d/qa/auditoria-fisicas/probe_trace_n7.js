/* TRACE del escape de N7: teleport al hueco de z=30 (sala pulida), andar +x y
   registrar frame a frame x,y,z,grounded para localizar cómo se cruza el muro. */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const P = () => qa.state().pos;
const D = () => qa.diag();
const R = { traza: [] };
qa.start(6);
qa.step(1/30, 5);
// sólidos a la altura del pecho en z=30 y z=3 (¿dónde están los muros?)
R.sondas = {};
for (const z of [2, 3, 10, 18, 30, 40, 55]) {
  const fila = [];
  for (const x of [-9, -8.2, -7.6, -7, -6.6, -1, 0, 1, 6.6, 7, 7.6, 8.2, 9]) {
    const s = qa.sonda(x, 0.6, z);
    fila.push([x, s ? s.tag : null]);
  }
  R.sondas['z' + z] = fila;
}
qa.teleport(0, 0.05, 30);
qa.step(1/30, 2);
key('ArrowUp', true); key('KeyD', true);
for (let i = 0; i < 200; i++) {
  qa.step(1/30, 1);
  const p = P(), d = D();
  R.traza.push([i, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(1), +d.vel.x.toFixed(1), +d.vel.y.toFixed(1), d.grounded ? 1 : 0]);
}
key('KeyD', false); key('ArrowUp', false);
R.errors = qa.data.errors.slice(0, 6);
qa.godMode(false);
return R;
