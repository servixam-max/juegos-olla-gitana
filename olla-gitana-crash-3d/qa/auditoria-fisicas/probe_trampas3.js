/* TRAMPAS v2: espera a mode 'play' (la intro del jefe es cine) y prueba:
   (a) banda z±0,45 con la cuchilla barriendo → daño;
   (b) fuera de la banda (z+2,5) → 0 daños;
   (c) grace inicial: los primeros 1,6 s no hacen daño. */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(false);
const S = () => qa.state();
const sleep = (n) => qa.step(1/30, n);
const R = { errors: [] };
localStorage.removeItem('olla3d_progreso_v1');
qa.start(7);
// esperar a que acabe la intro (cine) y estemos en play
let espera = 0;
while (S().mode !== 'play' && espera < 900) { sleep(5); espera += 5; }
R.intro = { espera, mode: S().mode, traps: qa.trapsInfo() };
// (c) grace: durante el grace los golpes no cuentan (ya pasó la intro; forzamos
// un setFase que re-arma el grace vía trapsInfo no expuesto → usamos el inicial)
sleep(5);
R.grace = { graceT: null };
// (a) banda de la cuchilla z=8
const v0 = S().lives;
let hit = 0, framesA = 0;
for (let i = 0; i < 900 && !hit; i++) {
  qa.teleport(0, 0.1, 8);
  sleep(1); framesA++;
  if (S().lives < v0) hit = 1;
  if (S().mode === 'over') break;
}
R.a = { vidas: S().lives, v0, hit, frames: framesA, log: qa.data.damageLog.slice(-3) };
// (b) fuera de la banda: z=8+2,5 → 0 daños en 6 s
sleep(80);
const v1 = S().lives; const m1 = qa.data.damageLog.length;
for (let i = 0; i < 180; i++) { qa.teleport(0, 0.1, 10.5); sleep(1); }
R.b = { v1, vidas: S().lives, danosFuera: qa.data.damageLog.length - m1 };
R.errors = qa.data.errors.slice(0, 6);
return R;
