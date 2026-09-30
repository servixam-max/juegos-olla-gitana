// Baseline probe: sanity of __qa hooks + physics probes.
const R = {};
const qa = window.__qa;
qa.godMode(true);
qa.start(0);                     // nivel 1
qa.step(1/30, 30);
R.mode = qa.state().mode;
R.diag0 = qa.diag();
R.moviles0 = qa.moviles().map(m => ({ tag: m.tag, x: +m.pos.x.toFixed(2), y: +m.pos.y.toFixed(2), z: +m.pos.z.toFixed(2) }));
// step 30 more: do movers actually move?
qa.step(1/30, 30);
R.moviles1 = qa.moviles().map(m => ({ tag: m.tag, x: +m.pos.x.toFixed(2), y: +m.pos.y.toFixed(2), z: +m.pos.z.toFixed(2) }));
// mover delta
R.moverDelta = R.moviles0.map((m, i) => ({
  tag: m.tag,
  dy: +(R.moviles1[i].y - m.y).toFixed(3),
  dx: +(R.moviles1[i].x - m.x).toFixed(3),
  dz: +(R.moviles1[i].z - m.z).toFixed(3)
}));
// sonda: suelo en el spawn, muro lateral, aire
R.sondaSuelo = qa.sonda(0, 0.2, 4);
R.sondaMuroIzq = qa.sonda(-5.6, 2.0, 6);
R.sondaMuroDer = qa.sonda(5.6, 2.0, 6);
R.sondaAire = qa.sonda(0, 5.0, 4);
// teleport y caída desde y=15
qa.teleport(0, 15, 4);
R.posBeforeFall = { ...qa.state().pos };
qa.step(1/30, 90);               // 3 s
R.posAfterFall = { ...qa.state().pos };
R.diagAfterFall = qa.diag();
R.errors = qa.data.errors.slice();
return R;
