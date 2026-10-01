/* AUDITORÍA VIDAS + BUFF DEL PURO:
   (1) daño simple: 1 vida por golpe, invT 2.2 s (inmune durante él);
   (2) ciclo: 3 vidas → super-vida → continue → game over;
   (3) BUFF: coger 2 puros (__qa.purosPos + teleport) → invulnerable 30 s:
       __qa.damage() x3, caída, enemigos y trampas NO quitan vidas.
   Nota: los probes manipulan posiciones de puros por teleport (permitido). */
const R = { vidas: {}, buff: {}, errors: [] };
const qa = window.__qa;
window.__recordPaused = true;
const P = () => qa.state().pos;
const D = () => qa.diag();
const sleep = (n) => qa.step(1/30, n);

// ---- reset de progreso limpio ----
localStorage.removeItem('olla3d_progreso_v1');
qa.start(0);              // recarga progreso (superVidas 5, continues 3)
sleep(10);
R.vidas.inicio = { lives: qa.state().lives, progreso: qa.progreso() };

// ---------- (1) daño simple ----------
qa.teleport(0, 0.1, 10); sleep(5);
const l0 = qa.state().lives;
qa.damage();
sleep(1);
const l1 = qa.state().lives;
qa.damage();          // inmediato: debe rebotar por invT
sleep(1);
const l2 = qa.state().lives;
R.vidas.dano1 = { antes: l0, despues: l1, inmediato2: l2, resta1: l0 - l1 === 1, invT_activo: +D().invuln.toFixed(2) };
// esperar a que pase la invulnerabilidad (2.2 s) y volver a dañar
sleep(75);
qa.damage(); sleep(1);
R.vidas.dano2 = { tras_esperar_invT: qa.state().lives, invT_antes: +D().invuln.toFixed(2), baja: l2 - 1 === qa.state().lives };

// ---------- (2) ciclo 3 vidas → super-vida ----------
qa.start(0); sleep(6);
R.vidas.ciclo = { superInicial: qa.progreso().superVidas, contInicial: qa.progreso().continues };
// gastar las 3 vidas
for (let k = 0; k < 3; k++) { qa.damage(); sleep(80); }
const st = qa.state();
R.vidas.tras3golpes = { lives: st.lives, mode: st.mode, superVidas: qa.progreso().superVidas };
// esperar a la transición de super-vida (pending ~2.6 s)
sleep(120);
R.vidas.supervida = { lives: qa.state().lives, mode: qa.state().mode, superVidas: qa.progreso().superVidas, pos: { ...P() } };

// ---------- (3) super-vidas agotadas → continue ----------
// gastar super-vidas restantes hasta el continue
let vueltas = 0, usadoContinue = false;
while (vueltas < 12 && !usadoContinue) {
  vueltas++;
  for (let k = 0; k < 3; k++) { qa.damage(); sleep(80); }
  sleep(120);
  const p = qa.progreso();
  if (p.superVidas === 0 && p.continues < 3) usadoContinue = true;
}
R.vidas.continue = { vueltas, progreso: qa.progreso(), lives: qa.state().lives, mode: qa.state().mode };
// esperar el final del continue y comprobar que se rellenan super-vidas
sleep(150);
R.vidas.continueFin = { progreso: qa.progreso(), lives: qa.state().lives, mode: qa.state().mode };

// ---- reset limpio para la prueba del buff ----
localStorage.removeItem('olla3d_progreso_v1');
qa.start(0); sleep(10);

// ---------- (4) BUFF DEL PURO ----------
const puros = qa.purosPos();
R.buff.purosNivel0 = puros;
// coger 2 puros por teleport (en N1 hay >=2)
let cogidos = 0;
for (const p of puros.slice(0, 2)) {
  qa.teleport(p.x, p.y - 0.6, p.z);
  sleep(6);
  cogidos = qa.mascara().nivel;
}
R.buff.trasCoger = { cogidos, mascara: qa.mascara(), puroBuff: qa.puroBuff() };
sleep(3);
R.buff.estado = { mascara: qa.mascara(), puroBuff: qa.puroBuff(), speedBoost: D().aura !== null ? qa.puroBuff().speed : null };
R.buff.invulnerabilidad = {
  invulnerable: qa.mascara().invulnerable,
  invT: qa.mascara().invT,
  vidaAntes: qa.state().lives
};
// --- __qa.damage() x3 con buff ---
qa.damage(); sleep(2); qa.damage(); sleep(2); qa.damage(); sleep(2);
R.buff.damage_x3 = { vidas: qa.state().lives, danLog: qa.data.damageLog.length, invT: qa.mascara().invT };
// --- caída al vacío con buff (teleport bajo killY) ---
qa.teleport(0, -20, 100); sleep(30);
R.buff.caida = { vidas: qa.state().lives, y: +P().y.toFixed(1), z: +P().z.toFixed(1) };
// --- caída normal desde alto con buff ---
qa.teleport(0, 25, 60); sleep(150);
R.buff.caida2 = { vidas: qa.state().lives, y: +P().y.toFixed(2) };
// --- contacto con enemigo real con buff: llevar al enemigo más cercano ---
qa.teleport(0, 0.1, 26); sleep(20);
let vivo = qa.diag().enemigosPos[0];
if (vivo) {
  for (let i = 0; i < 60; i++) {
    const es = qa.diag().enemigosPos;
    const e = es.find((x) => x.k === 'patrol') || es[0];
    if (!e) break;
    qa.teleport(e.x, 0.1, e.z);
    sleep(2);
    if (qa.state().lives < 3) break;
  }
}
R.buff.enemigo_contacto = { vidas: qa.state().lives, buff: qa.mascara() };
// --- trampas: no aplican en N1 (arena). Verificar que traps no toca el buff ---
R.buff.nota_trampas = 'las cuchillas solo existen en la arena (nivel 8); se prueban allí';
// --- duración: avanzar 30 s y comprobar que el buff acaba ---
sleep(900);
R.buff.tras30s = { mascara: qa.mascara(), vidas: qa.state().lives, speed: qa.puroBuff().speed, jump: qa.puroBuff().jump };
sleep(5);
qa.damage(); sleep(2);
R.buff.dano_post = { vidaAntes: R.buff.tras30s.vidas, vidaDespues: qa.state().lives };
R.errors = qa.data.errors.slice(0, 10);
return R;
