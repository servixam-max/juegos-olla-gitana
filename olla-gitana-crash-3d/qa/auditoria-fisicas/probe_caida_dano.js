/* CAÍDA CON DAÑO (sin godMode): la caída al vacío debe quitar 1 vida y
   respawnear en el checkpoint/spawn. Repetido: nunca 2 vidas por un golpe. */
const qa = window.__qa;
window.__recordPaused = true;
const P = () => qa.state().pos;
const S = () => qa.state();
const sleep = (n) => qa.step(1/30, n);
const R = { caidas: [], errors: [] };
qa.godMode(false);
localStorage.removeItem('olla3d_progreso_v1');
qa.start(0);
sleep(10);
R.inicio = { vidas: S().lives };
for (let k = 0; k < 3; k++) {
  const antes = S().lives;
  qa.teleport(0, -25, 60);
  sleep(45);
  R.caidas.push({ antes, despues: S().lives, y: +P().y.toFixed(1), z: +P().z.toFixed(1), modo: S().mode });
  sleep(70);   // deja pasar invT 2.2
}
// y una caída desde 30 m sobre el suelo: NO debe quitar vida (aterrizaje válido)
const antes2 = S().lives;
qa.teleport(0, 30, 100);
sleep(120);
R.caida_alta_sin_dano = { antes: antes2, despues: S().lives, y: +P().y.toFixed(2) };
R.log = qa.data.damageLog.slice(-6);
R.errors = qa.data.errors.slice(0, 6);
return R;
