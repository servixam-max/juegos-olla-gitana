/* TRAMPAS (cuchillas de la arena, N8): (a) contacto real dentro de la banda
   z±0,45 → daño; (b) fuera de la banda (z+2) → 0 daños; (c) la luz/grace
   funciona (primeros 1,6 s sin daño). */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(false);
const P = () => qa.state().pos;
const S = () => qa.state();
const sleep = (n) => qa.step(1/30, n);
const R = { a: {}, b: {}, errors: [] };
localStorage.removeItem('olla3d_progreso_v1');
qa.start(7);
sleep(4);
const marca = () => qa.data.damageLog.length;
// (c) grace: en los primeros 1,6 s, metido en la banda, no debe haber daño
qa.teleport(0, 0.1, 8);
let danosGrace = 0;
for (let i = 0; i < 40; i++) { qa.teleport(0, 0.1, 8); sleep(1); if (S().lives < 3) { danosGrace++; break; } }
R.grace = { vidas: S().lives, danosGrace };
sleep(70);   // fuera del grace inicial
// (a) banda de la cuchilla 1 (z=8): esperar a que barra por x=0
const v0 = S().lives;
let hit = 0;
for (let i = 0; i < 900 && hit < 1; i++) {
  const t = qa.trapsInfo();
  qa.teleport(0, 0.1, 8);      // de pie en el centro de su banda
  sleep(1);
  if (S().lives < v0) hit++;
  if (S().mode !== 'play') break;
}
R.a = { vidas: S().lives, v0, hit, log: qa.data.damageLog.slice(-3) };
// (b) fuera de la banda (z=8+2): 6 s sin daño
sleep(80);
const m1 = marca(); const v1 = S().lives;
for (let i = 0; i < 180; i++) { qa.teleport(0, 0.1, 10); sleep(1); }
R.b = { vidas: S().lives, v1, danosFuera: qa.data.damageLog.length - m1 };
R.errors = qa.data.errors.slice(0, 6);
return R;
