/* Logros de los juegos de Olla Gitana — módulo compartido.
   Se incluye en los 4 juegos y guarda en la MISMA clave que las preferencias,
   así el progreso es común: un logro conseguido en un juego aparece en todos.

   Uso desde cada juego:
     logros.check('primeraPartida');
     logros.count('items', 1);          // contador acumulable
     logros.set('nivelMax', 7);         // valor máximo alcanzado
     logros.panel();                    // abre/cierra el panel de logros
*/
(function () {
  'use strict';

  const KEY = 'olla_logros_v1';

  // Definición de todos los logros: id, nombre, descripción, icono, meta
  const DEFS = [
    { id: 'primera',      n: 'Primer bocado',      d: 'Juega tu primera partida',              i: '🥄', meta: 1 },
    { id: 'puntos1k',     n: 'Mil puntos',         d: 'Consigue 1.000 puntos en una partida',  i: '💯', meta: 1000 },
    { id: 'puntos5k',     n: 'Cinco mil',          d: 'Consigue 5.000 puntos en una partida',  i: '🔥', meta: 5000 },
    { id: 'items50',      n: 'Cincuentón',         d: 'Coge 50 ingredientes en total',         i: '🧺', meta: 50 },
    { id: 'items250',     n: 'Despensa llena',     d: 'Coge 250 ingredientes en total',        i: '🏪', meta: 250 },
    { id: 'combo10',      n: 'En racha',           d: 'Haz un combo de 10',                    i: '⚡', meta: 10 },
    { id: 'combo25',      n: 'Imparable',          d: 'Haz un combo de 25',                    i: '🌪️', meta: 25 },
    { id: 'nivel5',       n: 'Nivel 5',            d: 'Llega al nivel 5',                      i: '🖐️', meta: 5 },
    { id: 'nivel10',      n: 'Nivel 10',           d: 'Llega al nivel 10',                     i: '🔟', meta: 10 },
    { id: 'sinfallo',     n: 'Sin un rasguño',     d: 'Termina sin perder ninguna vida',       i: '🛡️', meta: 1 },
    { id: 'partidas10',   n: 'Vicio huertano',     d: 'Juega 10 partidas',                     i: '🎮', meta: 10 },
    { id: 'partidas50',   n: 'Leyenda de Murcia',  d: 'Juega 50 partidas',                     i: '👑', meta: 50 },
    { id: 'zenpartida',   n: 'Paz interior',       d: 'Termina una partida en modo ZEN',       i: '🧘', meta: 1 },
    { id: 'perfecto',     n: 'Oído absoluto',      d: 'Termina El Ritmo sin fallar una nota',  i: '🎼', meta: 1 },
    { id: 'sieteymedia',  n: 'Siete y media',      d: 'Haz 7½ exacto en las cartas',           i: '🎴', meta: 1 },
    { id: 'doblar',       n: 'Farolero',           d: 'Gana una mano doblada en las cartas',   i: '💰', meta: 1 },
    { id: 'zarangollo10', n: 'Fan del zarangollo', d: 'Coge 10 zarangollos',                   i: '🥘', meta: 10 },
    { id: 'velocidad',    n: 'A toda mecha',       d: 'Llega al nivel 5 en el runner',         i: '🏃', meta: 5 }
  ];
  const BY_ID = {};
  DEFS.forEach(d => { BY_ID[d.id] = d; });

  let state = load();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      return { got: raw.got || {}, c: raw.c || {}, v: raw.v || {} };
    } catch (e) { return { got: {}, c: {}, v: {} }; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function toast(msg, icon) {
    let t = document.getElementById('logroToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'logroToast';
      t.style.cssText = 'position:fixed;left:50%;top:14%;transform:translate(-50%,-14px);z-index:60;' +
        'background:linear-gradient(180deg,#fbbf24,#d97706);color:#3b1d05;border:3px solid #fff;' +
        'border-radius:16px;padding:10px 18px;font-weight:900;font-size:15px;text-align:center;' +
        'box-shadow:0 8px 26px rgba(0,0,0,.55);opacity:0;transition:opacity .3s ease,transform .3s ease;' +
        'max-width:80vw;pointer-events:none';
      document.body.appendChild(t);
    }
    t.innerHTML = `${icon || '🏆'} ${msg}<br><span style="font-size:11px;font-weight:800;opacity:.75">LOGRO CONSEGUIDO</span>`;
    t.style.opacity = '1'; t.style.transform = 'translate(-50%,0)';
    clearTimeout(t.__tm);
    t.__tm = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translate(-50%,-14px)'; }, 2600);
    if (navigator.vibrate) { try { navigator.vibrate([20, 50, 20]); } catch (e) {} }
  }

  function unlock(id) {
    const def = BY_ID[id];
    if (!def || state.got[id]) return false;
    state.got[id] = Date.now();
    save();
    toast(def.n, def.i);
    window.dispatchEvent(new CustomEvent('logro', { detail: def }));
    return true;
  }

  const api = {
    /** desbloquea un logro directamente */
    check(id) { return unlock(id); },
    /** suma a un contador acumulable; devuelve true si acaba de desbloquear */
    count(id, add) {
      const def = BY_ID[id]; if (!def) return false;
      state.c[id] = (state.c[id] || 0) + (add || 1); save();
      if (state.c[id] >= (def.meta || 1)) return unlock(id);
      return false;
    },
    /** guarda el máximo alcanzado (progreso hacia la meta) */
    set(id, value) {
      const def = BY_ID[id]; if (!def) return false;
      if (value > (state.v[id] || 0)) { state.v[id] = value; save(); }
      if (value >= (def.meta || 1)) return unlock(id);
      return false;
    },
    /** ¿ya está conseguido? */
    has(id) { return !!state.got[id]; },
    /** progreso hacia una meta: {actual, meta, pct, done} */
    progress(id) {
      const def = BY_ID[id]; if (!def) return null;
      const cur = Math.max(state.c[id] || 0, state.v[id] || 0);
      const meta = def.meta || 1;
      return { actual: Math.min(cur, meta), meta, pct: Math.min(100, Math.round(cur / meta * 100)), done: !!state.got[id] };
    },
    /** todos los logros con su estado (para el panel) */
    all() { return DEFS.map(d => ({ ...d, ...api.progress(d.id) })); },
    /** nº conseguidos / total */
    tally() { return { got: Object.keys(state.got).length, total: DEFS.length }; },
    /** panel emergente de logros (se crea solo) */
    panel() {
      let p = document.getElementById('logroPanel');
      if (p) { p.remove(); return; }
      const list = api.all();
      const t = api.tally();
      p = document.createElement('div');
      p.id = 'logroPanel';
      p.style.cssText = 'position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.82);backdrop-filter:blur(4px);' +
        'display:flex;align-items:center;justify-content:center;padding:16px';
      p.innerHTML = `
        <div style="background:#fff7ed;color:#1c1917;border:4px solid #ea580c;border-radius:20px;width:min(94vw,470px);max-height:88vh;overflow-y:auto;padding:18px">
          <h3 style="margin:0 0 4px;font-size:23px;font-weight:900;color:#9a3412;text-align:center">🏆 LOGROS</h3>
          <p style="margin:0 0 14px;text-align:center;font-size:13px;color:#78716c">${t.got} de ${t.total} conseguidos</p>
          ${list.map(l => `
            <div style="display:flex;gap:10px;align-items:center;padding:8px;border-radius:12px;margin-bottom:6px;
                 background:${l.done ? 'rgba(52,211,153,.14)' : 'rgba(0,0,0,.05)'};border:2px solid ${l.done ? '#34d399' : 'rgba(0,0,0,.1)'}">
              <span style="font-size:24px;${l.done ? '' : 'filter:grayscale(1);opacity:.45'}">${l.i}</span>
              <span style="flex:1;min-width:0">
                <b style="display:block;font-size:14.5px;color:${l.done ? '#065f46' : '#57534e'}">${l.n}</b>
                <span style="font-size:11.5px;color:#78716c">${l.d}</span>
                ${!l.done && l.meta > 1 ? `<span style="display:block;height:5px;border-radius:99px;background:rgba(0,0,0,.12);margin-top:4px">
                  <span style="display:block;height:100%;width:${l.pct}%;border-radius:99px;background:#f59e0b"></span></span>` : ''}
              </span>
              ${l.done ? '<span style="font-size:18px">✅</span>' : `<span style="font-size:12px;font-weight:800;color:#a16207">${l.meta>1 ? l.actual+'/'+l.meta : ''}</span>`}
            </div>`).join('')}
          <button id="logroClose" style="display:block;width:100%;margin-top:10px;padding:13px;border-radius:999px;
            border:3px solid #fff;background:linear-gradient(180deg,#34d399,#15803d);color:#fff;font-weight:900;font-size:17px;cursor:pointer">
            ¡ENTENDIDO!
          </button>
        </div>`;
      document.body.appendChild(p);
      p.addEventListener('click', e => { if (e.target === p || e.target.id === 'logroClose') p.remove(); });
    },
    reset() { state = { got: {}, c: {}, v: {} }; save(); }
  };

  window.logros = api;
})();
