/* Logros del 3D de «Olla Gitana» — 16 retos con guasa murciana.
   Se guarda TODO en localStorage ('olla3d_logros_v1'): los acumulados de la
   partida (cajones rotos, notas, vidas perdidas, mundos, jefes, máscaras…)
   y los logros ya conseguidos. Cada logro trae su `cond`, una función sobre
   esas estadísticas; el módulo reevalúa tras cada evento y avisa con su toast
   especial + el sonido 'unlock' (el gancho lo pone main.js).

   Uso desde main.js:
     logros3d.registrar('caja', { tipo: c.crateType });   // suma y reevalúa
     logros3d.pintaPanel();                               // rellena el panel
     logros3d.onUnlock = () => Audio.sfx('unlock');       // gancho del sonido

   Eventos que entiende `registrar`:
     nivelIniciado {index} · nota {n} · mascara {nivel} · caja {tipo}
     dano {nivel} · continue · superVida · combo {valor}
     nivelCompletado {index, estrellas, tiempo, sinDano} · jefe {jefe}
*/
const KEY = 'olla3d_logros_v1';

/* rarezas: común · raro · épico · legendario */
export const LOGROS = [
  {
    id: 'primer-concierto', icono: '🥁', rareza: 'común', nombre: 'Primer concierto',
    desc: 'Supera el mundo 1: la banda ya ensaya.',
    pista: 'Termina el Ensayo Callejero (mundo 1).',
    cond: (s) => s.mundos.includes(0)
  },
  {
    id: 'gira-mundial', icono: '🚐', rareza: 'raro', nombre: 'De gira por Murcia',
    desc: 'Juega los 8 mundos. La furgo no descansa.',
    pista: 'Entra alguna vez en cada uno de los 8 mundos.',
    cond: (s) => s.visitados.length >= 8
  },
  {
    id: 'sin-miedo', icono: '🗺️', rareza: 'legendario', nombre: 'Sin miedo',
    desc: 'Completa los 8 mundos. ¡Ole tu rumba!',
    pista: 'Termina los 8 mundos (cuando puedas y como puedas).',
    cond: (s) => s.mundos.length >= 8
  },
  {
    id: 'rumbero-pro', icono: '🌟', rareza: 'raro', nombre: 'Rumbero de pro',
    desc: 'Sácale las 3 estrellas a un nivel.',
    pista: '3 estrellas = muchas notas, casi todos los cajones y tiempo rápido.',
    cond: (s) => s.estrellas3 >= 1
  },
  {
    id: 'invencible', icono: '🛡️', rareza: 'raro', nombre: 'Invencible',
    desc: 'Termina un nivel sin perder ni una vida.',
    pista: 'Nada de golpes, caídas ni sustos: sal limpio del nivel.',
    cond: (s) => s.sinDano >= 1
  },
  {
    id: 'cazador-cajas', icono: '📦', rareza: 'común', nombre: 'Cazador de cajones',
    desc: 'Rompe 100 cajones en total. ¡Al garrote!',
    pista: 'Los cajones rotos se acumulan entre partidas.',
    meta: 100, cond: (s) => s.cajas >= 100
  },
  {
    id: 'rey-carton', icono: '🧨', rareza: 'épico', nombre: 'El rey del cartón',
    desc: '500 cajones rotos. Ni el Cacharro te llega.',
    pista: 'Sigue sumando cajones: cuentan todas tus partidas.',
    meta: 500, cond: (s) => s.cajas >= 500
  },
  {
    id: 'bailaor', icono: '🎵', rareza: 'épico', nombre: 'Bailaor',
    desc: 'Coge 1.000 notas. ¡Qué arte, chiquillo!',
    pista: 'Las notas y las máscaras suman entre todas tus partidas.',
    meta: 1000, cond: (s) => s.notas >= 1000
  },
  {
    id: 'coleccionista', icono: '🎭', rareza: 'raro', nombre: 'Coleccionista',
    desc: 'Consigue la máscara dorada juntando 3 de una sentada.',
    pista: 'Coge 3 máscaras sin perder ninguna en un mismo nivel.',
    cond: (s) => s.doradas >= 1
  },
  {
    id: 'cacharro-polvo', icono: '🎸', rareza: 'épico', nombre: 'El Cacharro muerde el polvo',
    desc: 'Vence al Cacharro en el duelo final.',
    pista: 'Gana la pelea del mundo 8 (tres asaltos y a por él).',
    cond: (s) => s.jefes.includes('cacharro')
  },
  {
    id: 'cascabel-mudo', icono: '🎺', rareza: 'raro', nombre: 'Cascabel apagado',
    desc: 'Vence a Fermín Cascabel en el Entierro.',
    pista: 'Salta encima de Fermín cuando se ponga rojo (mundo 5).',
    cond: (s) => s.jefes.includes('fermin')
  },
  {
    id: 'todoterreno', icono: '💀', rareza: 'común', nombre: 'Todoterreno',
    desc: 'Pierde vidas en 3 mundos distintos. Morir también es viajar.',
    pista: 'Cae con dignidad en 3 mundos diferentes.',
    meta: 3, cond: (s) => Object.keys(s.muertesPorNivel || {}).length >= 3
  },
  {
    id: 'en-racha', icono: '🔥', rareza: 'raro', nombre: 'En racha rumbera',
    desc: 'Llega a un combo x5. ¡Fuego en la olla!',
    pista: 'Rompe cajones seguidos sin que se enfríe el combo.',
    meta: 5, cond: (s) => s.combo >= 5
  },
  {
    id: 'sin-abandonar', icono: '⏩', rareza: 'común', nombre: 'Aquí no se abandona',
    desc: 'Gasta un continue y sigue dándolo todo.',
    pista: 'Cuando te quedes sin vidas, acepta el continue.',
    cond: (s) => s.continues >= 1
  },
  {
    id: 'cofre-super', icono: '💛', rareza: 'raro', nombre: 'Cofre huertano',
    desc: 'Junta 10 super-vidas en total.',
    pista: 'Los ✔ de punto de control dan una super-vida: no los dejes pasar.',
    meta: 10, cond: (s) => s.superVidas >= 10
  },
  {
    id: 'rapido-furgo', icono: '⏱️', rareza: 'raro', nombre: 'Más rápido que la furgo',
    desc: 'Termina un nivel en menos de 2 minutos.',
    pista: 'Corre, salta y no te entretengas: menos de 2:00.',
    cond: (s) => s.mejorTiempo > 0 && s.mejorTiempo < 120
  }
];

const porId = {};
LOGROS.forEach((l) => { porId[l.id] = l; });

/* estadísticas acumuladas de la partida (lo que miran las condiciones) */
function statsBase() {
  return {
    cajas: 0,            // cajones rotos en total
    notas: 0,            // notas cogidas en total (cada máscara suma 3)
    muertes: 0,          // vidas perdidas en total
    combo: 1,            // combo máximo alcanzado
    mundos: [],          // índices (0-7) de mundos COMPLETADOS
    visitados: [],       // índices de mundos en los que se ha ENTRADO
    jefes: [],           // 'fermin' | 'cacharro'
    mascaras: 0,         // máscaras cogidas
    doradas: 0,          // máscaras doradas conseguidas
    superVidas: 0,       // super-vidas ganadas con los ✔
    continues: 0,        // continues gastados
    estrellas3: 0,       // niveles con 3 estrellas
    sinDano: 0,          // niveles terminados sin perder vida
    niveles: 0,          // niveles completados en total
    mejorTiempo: 0,      // mejor tiempo al completar un nivel (segundos)
    muertesPorNivel: {}  // id de nivel → vidas perdidas ahí
  };
}

let data = cargar();

function cargar() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { got: raw.got || {}, stats: { ...statsBase(), ...(raw.stats || {}) } };
  } catch (e) {
    return { got: {}, stats: statsBase() };
  }
}
function guardar() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
}

/* ---------- aviso al conseguir un logro (con cola: no se pisan) ---------- */
const colaToast = [];
let toastActivo = false;

function mostrarToast(l) {
  colaToast.push(l);
  if (!toastActivo) siguienteToast();
}
function siguienteToast() {
  const l = colaToast.shift();
  if (!l || typeof document === 'undefined') { toastActivo = false; return; }
  toastActivo = true;
  let t = document.getElementById('logro3dToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'logro3dToast';
    t.className = 'logroToast';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.innerHTML = `<span class="ltIco">🏆</span><span class="ltTxt"><b>¡LOGRO!</b> ${l.nombre}` +
    `<span class="ltSub">Logro conseguido · ${l.rareza}</span></span>`;
  t.classList.remove('on');
  void t.offsetWidth;
  t.classList.add('on');
  clearTimeout(t.__tm);
  t.__tm = setTimeout(() => {
    t.classList.remove('on');
    setTimeout(siguienteToast, 420);
  }, 2700);
  if (navigator.vibrate) { try { navigator.vibrate([24, 60, 24]); } catch (e) {} }
}

/* ---------- progreso hacia la meta (para el panel) ---------- */
function progresoDe(l, s) {
  if (!l.meta) return null;
  let actual = 0;
  if (l.id === 'cazador-cajas' || l.id === 'rey-carton') actual = s.cajas;
  else if (l.id === 'bailaor') actual = s.notas;
  else if (l.id === 'todoterreno') actual = Object.keys(s.muertesPorNivel || {}).length;
  else if (l.id === 'en-racha') actual = Math.floor(s.combo * 10) / 10;
  else if (l.id === 'cofre-super') actual = s.superVidas;
  const meta = l.meta;
  return { actual: Math.min(actual, meta), meta, pct: Math.min(100, Math.round((actual / meta) * 100)) };
}

const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/* ---------- evaluación: ¿qué logros se cumplen ya? ---------- */
function evaluar() {
  const nuevos = [];
  for (const l of LOGROS) {
    if (data.got[l.id]) continue;
    let ok = false;
    try { ok = !!l.cond(data.stats); } catch (e) { ok = false; }
    if (ok) { data.got[l.id] = Date.now(); nuevos.push(l); }
  }
  if (nuevos.length) {
    guardar();
    for (const l of nuevos) {
      mostrarToast(l);
      if (logros3d.onUnlock) { try { logros3d.onUnlock(l); } catch (e) {} }
      if (l.rareza === 'legendario') { try { window.dispatchEvent(new CustomEvent('logro3d', { detail: l })); } catch (e) {} }
    }
  }
  return nuevos;
}

/* ---------- API pública ---------- */
export const logros3d = {
  DEFS: LOGROS,
  onUnlock: null,          // gancho del sonido: main.js pone Audio.sfx('unlock')
  silencioso: false,       // en modo demo (grabación del vídeo) no registra ni avisa

  /** registra un evento de partida, acumula y reevalúa los logros */
  registrar(evento, datos = {}) {
    if (this.silencioso) return [];
    const s = data.stats;
    switch (evento) {
      case 'nivelIniciado': {
        const i = datos.index | 0;
        if (!s.visitados.includes(i)) s.visitados.push(i);
        break;
      }
      case 'nota':      s.notas += (datos.n || 1); break;
      case 'mascara':   s.mascaras++; s.notas += 3; if (datos.nivel >= 3) s.doradas++; break;
      case 'caja':      s.cajas++; break;
      case 'dano': {
        s.muertes++;
        const k = String(datos.nivel != null ? datos.nivel : '?');
        s.muertesPorNivel[k] = (s.muertesPorNivel[k] || 0) + 1;
        break;
      }
      case 'continue':  s.continues++; break;
      case 'superVida': s.superVidas++; break;
      case 'combo':     s.combo = Math.max(s.combo || 1, datos.valor || 0); break;
      case 'nivelCompletado': {
        const i = datos.index | 0;
        if (!s.mundos.includes(i)) s.mundos.push(i);
        s.niveles++;
        if ((datos.estrellas || 0) >= 3) s.estrellas3++;
        if (datos.sinDano) s.sinDano++;
        const t = datos.tiempo | 0;
        if (t > 0 && (!s.mejorTiempo || t < s.mejorTiempo)) s.mejorTiempo = t;
        break;
      }
      case 'jefe': {
        const j = datos.jefe;
        if (j && !s.jefes.includes(j)) s.jefes.push(j);
        break;
      }
      default: break;
    }
    guardar();
    return evaluar();
  },

  /** lista completa con estado y progreso (para el panel y para QA) */
  lista() {
    return LOGROS.map((l) => ({
      ...l, done: !!data.got[l.id], fecha: data.got[l.id] || 0,
      progreso: progresoDe(l, data.stats)
    }));
  },

  tally() {
    let got = 0;
    for (const l of LOGROS) if (data.got[l.id]) got++;
    return { got, total: LOGROS.length };
  },

  tiene(id) { return !!data.got[id]; },

  /** copia del estado guardado (logros + acumulados) */
  estado() { return JSON.parse(JSON.stringify(data)); },

  /** rellena el panel de logros del menú (index.html) */
  pintaPanel() {
    if (typeof document === 'undefined') return;
    const body = document.getElementById('logrosBody');
    if (!body) return;
    const t = this.tally();
    const cnt = document.getElementById('logrosCount');
    if (cnt) cnt.textContent = `${t.got} de ${t.total} logros conseguidos`;
    const bar = document.getElementById('logrosBar');
    if (bar) bar.style.width = `${Math.round((t.got / t.total) * 100)}%`;
    body.innerHTML = this.lista().map((l) => {
      const p = l.progreso;
      const prog = !l.done && p && p.meta > 1
        ? `<span class="logroMini"><i style="width:${p.pct}%"></i></span>` +
          `<span class="logroProg">${fmt(p.actual)} / ${fmt(p.meta)}</span>`
        : '';
      return `<div class="logroItem ${l.done ? 'got' : 'locked'}">
        <span class="logroIco">${l.icono}</span>
        <span class="logroTxt">
          <b class="logroNom">${l.nombre}${l.done ? ' <span class="logroOk">✔</span>' : ''}</b>
          <span class="logroDes">${l.desc}</span>
          ${l.done ? '' : `<span class="logroPista">💡 ${l.pista}</span>`}
          ${prog}
        </span>
        <span class="logroRar rar-${l.rareza.replace('é', 'e').replace('í', 'i')}">${l.rareza}</span>
      </div>`;
    }).join('');
    const panel = document.getElementById('logrosPanel');
    const scroll = panel && panel.querySelector('.panel');
    if (scroll) scroll.scrollTop = 0;
  },

  /** borra todo (por si alguien quiere empezar de cero) */
  reset() {
    data = { got: {}, stats: statsBase() };
    guardar();
  }
};

/* el objeto en window simplifica las pruebas del navegador */
if (typeof window !== 'undefined') window.logros3d = logros3d;

export default logros3d;
