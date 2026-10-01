/* VIDAS (ciclo completo determinista). Requiere que el run anterior dejara
   localStorage olla3d_progreso_v1 con superVidas:1, continues:1 (probe_setprog). */
const qa = window.__qa;
window.__recordPaused = true;
const P = () => qa.state().pos;
const S = () => qa.state();
const sleep = (n) => qa.step(1/30, n);
const R = { pasos: [], errors: [] };
const reg = (etq) => { const s = S(), p = qa.progreso(); R.pasos.push({ etq, lives: s.lives, mode: s.mode, ended: !!s.ended, superV: p.superVidas, cont: p.continues }); };

qa.start(0);
sleep(6);
R.inicio = qa.progreso();
reg('inicio');

// helper: 3 daños espaciados (invT 2.2 s), luego esperar transición
function perder3(etq) {
  for (let k = 0; k < 3; k++) { qa.damage(); sleep(75); }
  sleep(140);                     // transición super-vida (~2,6 s) o continue (~2,9 s)
  reg(etq);
}

perder3('tras3golpes_1');          // super-vida 1 → 0 (si queda) o continue
perder3('tras3golpes_2');
perder3('tras3golpes_3');
perder3('tras3golpes_4');
perder3('tras3golpes_5');
perder3('tras3golpes_6');
perder3('tras3golpes_7');
perder3('tras3golpes_8');
R.over = { mode: S().mode, ended: !!S().ended, overPanelVisible: !document.getElementById('overPanel').classList.contains('hidden'), progreso: qa.progreso() };
R.errores = qa.data.errors.slice(0, 8);
return R;
