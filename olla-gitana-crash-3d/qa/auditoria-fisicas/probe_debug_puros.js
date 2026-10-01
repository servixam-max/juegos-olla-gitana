/* DEBUG: recoger los puros de N1 uno a uno verificando paso a paso. */
const R = { pasos: [], errors: [] };
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
qa.start(0);
qa.step(1/30, 10);
const puros = qa.purosPos();
R.puros = puros;
for (let i = 0; i < Math.min(4, puros.length); i++) {
  const p = puros[i];
  qa.teleport(p.x, p.y - 0.4, p.z);
  qa.step(1/30, 10);
  R.pasos.push({ i, puro: p, mascara: qa.mascara(), puroBuff: qa.puroBuff(), pos: { ...qa.state().pos } });
  if (qa.mascara().nivel >= 2) break;
}
// si no llegó a 2, probar teleport directo a la posición exacta
if (qa.mascara().nivel < 2) {
  const p2 = qa.purosPos().find((x) => !x.cogido);
  if (p2) {
    qa.teleport(p2.x, p2.y, p2.z);
    qa.step(1/30, 20);
    R.extra = { p2, mascara: qa.mascara(), puroBuff: qa.puroBuff() };
  }
}
R.errors = qa.data.errors.slice(0, 10);
return R;
