/* TRAMPAS v3: grace de 1,6 s (los primeros golpes no cuentan) + contacto real
   después. Vuelve a arrancar el nivel 8 y mide el daño en los primeros frames. */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(false);
const S = () => qa.state();
const sleep = (n) => qa.step(1/30, n);
const R = { errors: [] };
localStorage.removeItem('olla3d_progreso_v1');
qa.start(7);
// esperar 'play' (intro)
let e = 0; while (S().mode !== 'play' && e < 900) { sleep(5); e += 5; }
// grace: en los primeros ~1,3 s de play, dentro de la banda → sin daño
let danosGrace = 0;
const t0 = e;
for (let i = 0; i < 36; i++) { qa.teleport(0, 0.1, 8); sleep(1); if (S().lives < 3) danosGrace++; }
R.grace = { desdeFrame: t0, danosGrace, vidas: S().lives };
// tras el grace, mismo sitio → daño
const v0 = S().lives; let hit = 0;
for (let i = 0; i < 600 && !hit; i++) {
  qa.teleport(0, 0.1, 8); sleep(1);
  if (S().lives < v0) hit = 1;
}
R.contacto = { v0, vidas: S().lives, hit, log: qa.data.damageLog.slice(-2) };
R.errors = qa.data.errors.slice(0, 6);
return R;
