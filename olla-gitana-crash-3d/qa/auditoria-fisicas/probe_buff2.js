/* BUFF DEL PURO COMPLETO: 2 puros → 30 s invulnerable; con el buff: 3 daños,
   caída al vacío y contacto con enemigo NO quitan vidas. Después del buff se
   comprueba si queda "invulnerabilidad fantasma" (invuln se queda pegado). */
const qa = window.__qa;
window.__recordPaused = true;
const sleep = (n) => qa.step(1/30, n);
const P = () => qa.state().pos;
const S = () => qa.state();
const R = { pasos: [], errors: [] };
qa.start(0);
sleep(10);

// ---- coger 2 puros (teleport a cada uno) ----
let nivel = 0;
for (let intento = 0; intento < 6 && nivel < 2; intento++) {
  const p = qa.purosPos().find((x) => !x.cogido);
  if (!p) break;
  qa.teleport(p.x, Math.max(0.1, p.y - 0.5), p.z);
  sleep(12);
  nivel = qa.mascara().nivel;
}
R.coger = { nivel, mascara: qa.mascara(), buff: qa.puroBuff() };

// ---- con el buff: 3 daños ----
const v0 = S().lives;
qa.damage(); sleep(40); qa.damage(); sleep(40); qa.damage(); sleep(40);
R.damage3 = { v0, vidas: S().lives, invuln: qa.diag().invuln, danLog: qa.data.damageLog.length, buff: qa.mascara() };

// ---- caída al vacío con el buff ----
qa.teleport(0, -25, 100); sleep(60);
R.caida = { vidas: S().lives, y: +P().y.toFixed(1), z: +P().z.toFixed(1), buff: qa.mascara() };

// ---- contacto con un enemigo real, con el buff ----
for (let i = 0; i < 90; i++) {
  const e = qa.diag().enemigosPos.find((x) => x.k === 'patrol') || qa.diag().enemigosPos[0];
  if (e) qa.teleport(e.x, 0.1, e.z);
  sleep(2);
}
R.enemigo = { vidas: S().lives, invuln: qa.diag().invuln, danLog: qa.data.damageLog.length, buff: qa.mascara() };

// ---- expiración y posible invulnerabilidad fantasma ----
sleep(920);
R.trasExpirar = { mascara: qa.mascara(), buff: qa.puroBuff(), invulnA: qa.diag().invuln };
sleep(60);
R.trasExpirar.invulnB = qa.diag().invuln;
sleep(60);
R.trasExpirar.invulnC = qa.diag().invuln;
const v1 = S().lives;
qa.damage(); sleep(3);
R.post_damage = { antes: v1, vidas: S().lives, invuln: qa.diag().invuln };
sleep(90); qa.damage(); sleep(3);
R.post_damage2 = { vidas: S().lives, invuln: qa.diag().invuln };
R.errors = qa.data.errors.slice(0, 8);
return R;
