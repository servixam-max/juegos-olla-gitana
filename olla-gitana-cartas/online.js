/* Olla Gitana: Siete y Media — modo ONLINE 1v1.
   Se engancha a la pantalla de inicio del juego de cartas: crea/entra en una sala
   y juega contra otra persona por WebSocket (servidor autoritativo, salas.py). */
'use strict';

(function () {
  const WS_BASE = (function () {
    const p = location.pathname;
    let base = '/champi';
    if (p.includes('/juegos-olla')) base = '/juegos-olla';
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}${base}/ws`;
  })();

  let ws = null, mySlot = 0, roomCode = '', online = false, finMostrado = false, misVidas = {};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- UI: añadir botón y pantalla de sala al HTML existente ----------
  const el = id => document.getElementById(id);

  function montarUI() {
    // botón en la pantalla de inicio
    const pane = document.querySelector('#startScreen .pane');
    if (!pane || el('btnOnline')) return;
    const btn = document.createElement('button');
    btn.id = 'btnOnline';
    btn.className = 'btn btn-ghost';
    btn.textContent = '👥 Jugar con alguien (online)';
    const ref = el('btnRanking');
    ref ? ref.parentNode.insertBefore(btn, ref) : pane.appendChild(btn);

    // pantalla de sala (reusa el estilo de modales del juego)
    const sala = document.createElement('div');
    sala.id = 'salaScreen';
    sala.className = 'modal hidden';
    sala.innerHTML = `
      <div class="modalBox center">
        <h3>SALA ONLINE 🎴</h3>
        <div id="salaIni">
          <div id="nameRowOnline" style="display:flex;gap:8px;margin-bottom:10px">
            <input id="onlineName" maxlength="14" placeholder="Tu mote" style="flex:1;padding:13px 14px;border-radius:12px;border:2px solid #d6d3d1;font-size:16px;min-width:0;user-select:text">
          </div>
          <button id="btnMaquina" class="btn btn-play">🤖 Jugar contra la máquina</button>
          <button id="btnCrearSala" class="btn btn-call">🏠 Crear sala (con un amigo)</button>
          <div style="display:flex;gap:8px;margin:10px 0">
            <input id="onlineCode" maxlength="6" placeholder="CÓDIGO" style="flex:1;padding:13px;border-radius:12px;border:2px solid #d6d3d1;font-size:16px;text-align:center;letter-spacing:.15em;text-transform:uppercase;min-width:0;user-select:text">
            <button id="btnEntrarSala" class="btn btn-call small">🔑 Entrar</button>
          </div>
        </div>
        <div id="salaEspera" class="hidden">
          <p style="font-size:13px;color:#78716c;margin:0 0 4px">Manda este código a tu rival:</p>
          <div id="onlineBigCode" style="font-size:44px;font-weight:900;letter-spacing:.18em;color:#b45309;margin-bottom:10px">----</div>
          <div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px">
            <div id="onSlot0" class="playerSlot" style="flex:1;background:rgba(0,0,0,.05);border:2px solid #d6d3d1;border-radius:12px;padding:8px">—</div>
            <div id="onSlot1" class="playerSlot" style="flex:1;background:rgba(0,0,0,.05);border:2px solid #d6d3d1;border-radius:12px;padding:8px">—</div>
          </div>
          <p id="onlineMsg" style="font-size:13px;color:#a16207;font-weight:700;min-height:32px">Esperando al rival…</p>
          <button id="btnCopyOnline" class="btn btn-ghost small">📋 Copiar invitación</button>
        </div>
        <button id="btnCerrarSala" class="btn btn-ghost">⬅️ Volver</button>
      </div>`;
    document.body.appendChild(sala);

    // tablero online (reusa la mesa del juego, pero en modo online)
    const board = document.createElement('div');
    board.id = 'onlineBoard';
    board.className = 'modal hidden';
    board.innerHTML = `
      <div class="modalBox">
        <h3 id="onTitle">MANO</h3>
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#57534e;margin-bottom:6px">
          <span>TÚ <b id="onMarcadorYo" style="color:#15803d">0</b> · ❤️ <b id="onVidasYo">3</b></span>
          <span>RIVAL <b id="onMarcadorRival" style="color:#b45309">0</b> · ❤️ <b id="onVidasRival">3</b></span>
        </div>
        <p style="font-size:12px;color:#78716c;margin:0 0 8px">TU MANO: <b id="onTotalYo">—</b> / 7½</p>
        <div id="onMiMano" style="display:flex;gap:6px;flex-wrap:wrap;min-height:70px;justify-content:center"></div>
        <p style="font-size:12px;color:#78716c;margin:10px 0 6px">MANO DEL RIVAL: <b id="onTotalRival">—</b></p>
        <div id="onManoRival" style="display:flex;gap:6px;flex-wrap:wrap;min-height:70px;justify-content:center"></div>
        <p id="onMsg" style="font-size:15px;font-weight:800;color:#9a3412;text-align:center;min-height:40px;margin:10px 0">Reparto…</p>
        <div id="onAcciones" style="display:flex;gap:8px">
          <button id="onPedir" class="btn btn-play" style="flex:1">🃏 PEDIR</button>
          <button id="onPlantar" class="btn btn-call" style="flex:1">✋ ME PLANTO</button>
        </div>
        <button id="onNext" class="btn btn-play hidden">▶ SIGUIENTE MANO</button>
        <button id="onSalir" class="btn btn-ghost">⬅️ Salir de la sala</button>
      </div>`;
    document.body.appendChild(board);

    // estilos mínimos para los botones ocultos
    const st = document.createElement('style');
    st.textContent = '#onlineBoard .hidden,#salaScreen .hidden{display:none!important}';
    document.head.appendChild(st);

    bindEventos();
  }

  function bindEventos() {
    el('btnOnline').addEventListener('click', () => { showe('salaScreen'); });
    el('btnCerrarSala').addEventListener('click', () => { cerrarTodo(); });
    el('btnCrearSala').addEventListener('click', () => conectar('', false));
    el('btnMaquina').addEventListener('click', () => { conBotNow = true; conectar('', true); });
    el('btnEntrarSala').addEventListener('click', () => {
      const c = (el('onlineCode').value || '').trim().toUpperCase();
      if (!c) return alert('Escribe el código de la sala');
      conectar(c);
    });
    el('btnCopyOnline').addEventListener('click', async () => {
      const txt = `¿Echamos una partida de Siete y Media? 🎴\nEntra con el código: ${roomCode}\n${location.origin}/champi/olla-gitana-cartas/`;
      try { await navigator.clipboard.writeText(txt); alert('¡Copiado! Mándalo por WhatsApp o donde quieras'); }
      catch (e) { if (navigator.share) navigator.share({ text: txt }).catch(() => {}); }
    });
    el('onPedir').addEventListener('click', () => wsSend({ t: 'draw' }));
    el('onPlantar').addEventListener('click', () => wsSend({ t: 'stand' }));
    el('onNext').addEventListener('click', () => wsSend({ t: 'next' }));
    el('onSalir').addEventListener('click', cerrarTodo);
  }

  const showe = id => { const n = el(id); n && n.classList.remove('hidden'); };
  const hideo = id => { const n = el(id); n && n.classList.add('hidden'); };
  const wsSend = o => { try { ws && ws.readyState === 1 && ws.send(JSON.stringify(o)); } catch (e) {} };

  let conBotNow = false;
  function conectar(code, conBot) {
    const name = (el('onlineName').value || '').trim().slice(0, 14) || 'Zagal';
    try { window.savePref && window.savePref(name, undefined); } catch (e) {}
    conBotNow = !!conBot;
    try { ws && ws.close(); } catch (e) {}
    ws = new WebSocket(WS_BASE);
    ws.onopen = () => wsSend({ t: 'join', room: code, game: 'cartas', name, bot: conBotNow });
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'welcome') {
        mySlot = m.you; roomCode = m.room;
        el('onlineBigCode').textContent = roomCode;
        hideo('salaIni'); showe('salaEspera');
        pintarSala(m.players);
      } else if (m.t === 'joined') {
        pintarSala(m.players);
        if (conBotNow && !online) wsSend({ t: 'ready' });
      } else if (m.t === 'left') {
        pintarSala(m.players);
        if (online) { el('onMsg').textContent = 'Tu rival se fue.'; setTimeout(cerrarTodo, 1600); }
      } else if (m.t === 'start') {
        online = true; finMostrado = false;
        hideo('salaScreen');
        showe('onlineBoard');
      } else if (m.t === 'state') {
        if (!online) return;
        pintarMesa(m);
        if (m.fase === 'over' && m.res && !finMostrado) {
          finMostrado = true;
          const gane = m.res.ganador === mySlot;
          el('onMsg').textContent = gane ? '¡HAS GANAO LA PARTIDA! 🏆' : '¡Te ha ganao el rival! 😤';
          hideo('onAcciones'); el('onNext').classList.add('hidden');
          try { logros && logros.check('cartasonline'); } catch (e) {}
        }
      } else if (m.t === 'error') {
        alert(m.msg || 'Error de sala');
      }
    };
  }

  function pintarSala(players) {
    players = players || [];
    const p0 = players.find(p => p.slot === 0), p1 = players.find(p => p.slot === 1);
    const pinta = (node, p) => { if (!node) return; node.innerHTML = p ? `<b>${esc(p.name)}</b>${p.ready ? ' ✅' : ' …'}` : 'Esperando…'; };
    pinta(el('onSlot0'), p0); pinta(el('onSlot1'), p1);
    el('onlineMsg').textContent = players.length < 2
      ? 'Esperando al rival… pásale el código'
      : (players.every(p => p.ready) ? '¡Empieza la partida!' : 'Pulsa listo cuando quieras empezar');
    if (players.length === 2 && !players.every(p => p.ready)) wsSend({ t: 'ready' });
  }

  function cartaEl(c) {
    const SUITS = { oro: '🪙', copa: '🍷', espada: '⚔️', basto: '🌿' };
    const FIG = { 10: '½', 11: '½', 12: '½' };
    const val = FIG[c.n] ? '½' : c.n;
    const d = document.createElement('div');
    d.style.cssText = 'width:56px;height:80px;background:#fffef9;border:2px solid #d6c9a8;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#1c1917;font-weight:900;box-shadow:0 4px 10px rgba(0,0,0,.35)';
    d.innerHTML = `<span style="font-size:20px">${val}</span><span style="font-size:18px">${SUITS[c.p] || ''}</span>`;
    return d;
  }
  function pintarMano(node, mano, ocultar) {
    if (!node) return;
    node.innerHTML = '';
    (mano || []).forEach((c, i) => {
      if (ocultar && i === mano.length - 1) {
        const d = document.createElement('div');
        d.style.cssText = 'width:56px;height:80px;background:repeating-linear-gradient(45deg,#9a3412 0 6px,#7c2d12 6px 12px);border:2px solid #facc15;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px;color:#fde68a';
        d.textContent = '🥘';
        node.appendChild(d);
      } else node.appendChild(cartaEl(c));
    });
  }
  const tot = mano => (mano || []).reduce((a, c) => a + (c.n <= 7 ? c.n : 0.5), 0);
  const fmt = t => t === 0 ? '0' : (Math.floor(t) === 0 ? '½' : Math.floor(t) + (t % 1 ? '½' : ''));

  function pintarMesa(m) {
    const mia = m.manos[mySlot] || [], suya = m.manos[1 - mySlot] || [];
    pintarMano(el('onMiMano'), mia, false);
    pintarMano(el('onManoRival'), suya, true);
    el('onTotalYo').textContent = fmt(tot(mia));
    el('onTotalRival').textContent = fmt(tot(suya));
    el('onMarcadorYo').textContent = m.marcador[mySlot];
    el('onMarcadorRival').textContent = m.marcador[1 - mySlot];
    el('onVidasYo').textContent = m.vidas[mySlot];
    el('onVidasRival').textContent = m.vidas[1 - mySlot];
    if (m.msg) el('onMsg').textContent = m.msg;
    const miTurno = m.turno === mySlot && m.fase === 'play' && !m.listo;
    el('onAcciones').style.display = miTurno ? 'flex' : 'none';
    el('onNext').classList.toggle('hidden', !(m.listo && m.fase !== 'over'));
  }

  function cerrarTodo() {
    wsSend({ t: 'leave' });
    try { ws && ws.close(); } catch (e) {}
    ws = null; online = false;
    hideo('salaScreen'); hideo('onlineBoard');
    hideo('salaEspera');
    el('salaIni') && el('salaIni').classList.remove('hidden');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montarUI);
  else montarUI();

  window.__cartasOnline = () => ({ conectado: !!(ws && ws.readyState === 1), online, sala: roomCode, slot: mySlot, bot: conBotNow });
})();
