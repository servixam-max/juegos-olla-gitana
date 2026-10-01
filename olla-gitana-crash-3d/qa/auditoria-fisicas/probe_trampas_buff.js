/* AUDITORÍA TRAMPAS + JEFE: cuchillas de la arena (N8) — que hagan daño solo por
   contacto real, que el grace funcione y que el buff del puro (teleport al
   nivel 8 y coger 2 puros allí) aguante los golpes: __qa.damage x3, cuchillas.
   OJO: el nivel 8 tiene arena de jefe; se usa godMode para sobrevivir al daño. */
const R = { trampas: {}, buff: {}, errors: [] };
const qa = window.__qa;
window.__recordPaused = true;
const P = () => qa.state().pos;
const sleep = (n) => qa.step(1/30, n);
qa.godMode(false);
qa.start(7);
sleep(20);
R.inicio = { mode: qa.state().mode, traps: qa.trapsInfo(), invicto: null };

// ---------- (1) daño de cuchillas: contacto real ----------
// esperar a que pase el grace inicial (1.6 s)
sleep(90);
R.trampas.graceInicial = { fase: qa.trapsInfo().fase, activas: qa.trapsInfo().activas, posX: qa.trapsInfo().pos };
// situar al jugador en la columna de una cuchilla y esperar que pase
const c = qa.trapsInfo().pos;
let danos = 0, vidaAntes = qa.state().lives;
for (let i = 0; i < 600; i++) {
  const t = qa.trapsInfo().pos;
  if (t.length && Math.abs(P().x - t[0]) > 2) qa.teleport(t[0], 0.1, 5);   // ponerse delante de la cuchilla 1
  sleep(3);
  const v = qa.state().lives;
  if (v < vidaAntes) { danos++; vidaAntes = v; if (danos >= 2) break; }
  if (qa.state().mode !== 'play') break;
}
R.trampas.contacto = { danos, vidas: qa.state().lives, log: qa.data.damageLog.slice(-4) };

// ---------- (2) buff del puro en la arena: aguanta cuchillas ----------
localStorage.removeItem('olla3d_progreso_v1');
qa.start(7);
sleep(20);
qa.godMode(true);       // para llegar vivo y coger puros
const puros = qa.purosPos();
R.buff.puros = puros;
let nivel = 0;
for (const p of puros.slice(0, 3)) {
  qa.teleport(p.x, p.y - 0.6, p.z);
  sleep(8);
  nivel = qa.mascara().nivel;
  if (nivel >= 2) break;
}
R.buff.cogidos = { nivel, mascara: qa.mascara(), puroBuff: qa.puroBuff() };
qa.godMode(false);
sleep(3);
const v0 = qa.state().lives;
qa.damage(); sleep(2); qa.damage(); sleep(2); qa.damage(); sleep(2);
R.buff.damage_x3 = { antes: v0, vidas: qa.state().lives, danLog: qa.data.damageLog.length, mascara: qa.mascara() };
// con buff: meterse en el camino de las cuchillas
let vidasCuchilla = qa.state().lives;
for (let i = 0; i < 400; i++) {
  const t = qa.trapsInfo().pos;
  if (t.length) {
    const idx = i % t.length;
    qa.teleport(t[idx] + 0.1, 0.1, 6);
  }
  sleep(3);
  if (qa.state().lives !== vidasCuchilla) { vidasCuchilla = qa.state().lives; }
}
R.buff.cuchillas = { vidas: qa.state().lives, log: qa.data.damageLog.slice(-4), mascara: qa.mascara() };
// y sin buff (dejar acabar): comprobar que entonces SÍ hacen daño
sleep(900);
R.buff.tras30 = { mascara: qa.mascara() };
const vPre = qa.state().lives;
for (let i = 0; i < 400; i++) {
  const t = qa.trapsInfo().pos;
  if (t.length) qa.teleport(t[0], 0.1, 6);
  sleep(3);
  if (qa.state().lives < vPre) break;
  if (qa.state().mode !== 'play') break;
}
R.trampas.sinBuff = { antes: vPre, vidas: qa.state().lives, log: qa.data.damageLog.slice(-3) };
R.errors = qa.data.errors.slice(0, 10);
return R;
