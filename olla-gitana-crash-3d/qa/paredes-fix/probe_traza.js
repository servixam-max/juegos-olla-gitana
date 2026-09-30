/* Traza frame a frame del fallo diagonal: por dónde y por qué se cruza el muro.
   Muro N1: x∈[5.0,6.2], z∈[0,12] (tag wall). Jugador r=0.42 -> debe quedar x<=4.58. */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const up = (c) => key(c, false);
const R = {};

qa.start(0);
for (let i = 0; i < 900 && qa.state().mode !== 'play'; i++) qa.step(1 / 30, 1);

// geometría: suelo/techo por z en x=0 y x=4
R.mapaX0 = qa.mapa(0, 0, 40, 4);
R.mapaX4 = qa.mapa(4, 0, 40, 4);
R.muroZ8 = { dentro: qa.sonda(5.2, 1.0, 8), fuera: qa.sonda(4.9, 1.0, 8) };

// --- traza (d) slide diagonal contra el muro, dt=0.05
qa.teleport(0, 0.2, 8);
qa.step(0.05, 12);
key('ArrowLeft', true); key('ArrowUp', true); key('KeyC', true);
qa.step(0.05, 4);
const tr = [];
for (let i = 0; i < 40; i++) {
  qa.step(0.05, 1);
  const p = qa.state().pos, d = qa.diag();
  tr.push({
    i, x: +p.x.toFixed(3), z: +p.z.toFixed(3), y: +p.y.toFixed(3),
    vx: +d.vel.x.toFixed(2), vz: +d.vel.z.toFixed(2), vy: +d.vel.y.toFixed(2),
    g: d.grounded ? 1 : 0, slide: d.slideT, spin: d.spinT,
    enMuro: qa.sonda(p.x, p.y + 0.6, p.z) ? qa.sonda(p.x, p.y + 0.6, p.z).tag : null,
    muroEnZ: qa.sonda(5.6, 1.0, p.z) ? 1 : 0
  });
}
['ArrowLeft', 'ArrowUp', 'KeyC'].forEach(up);
R.trazaDiag = tr;
R.finalDiag = { ...qa.state().pos };

// --- ¿qué hay en el punto final?
R.sondaFinal = qa.sonda(qa.state().pos.x, qa.state().pos.y + 0.6, qa.state().pos.z);

// --- traza (e) caída desde 15 m sobre el borde de una plataforma gruesa
qa.teleport(2.4, 15, 68);
qa.step(0.05, 4);
key('ArrowLeft', true);
const tr2 = [];
for (let i = 0; i < 60; i++) {
  qa.step(0.05, 1);
  const p = qa.state().pos, d = qa.diag();
  tr2.push({
    i, x: +p.x.toFixed(3), z: +p.z.toFixed(3), y: +p.y.toFixed(3),
    vx: +d.vel.x.toFixed(2), vy: +d.vel.y.toFixed(2), g: d.grounded ? 1 : 0,
    solid: qa.sonda(p.x, p.y + 0.6, p.z) ? qa.sonda(p.x, p.y + 0.6, p.z).tag : null
  });
}
up('ArrowLeft');
R.trazaCaida = tr2;
R.finalCaida = { ...qa.state().pos };
R.errors = qa.data.errors.slice();
return R;
