# Revisión QA — Siete y Media (olla-gitana-cartas)

Fecha: 2026-10-02 · Commit: cdf3212 · URL: http://127.0.0.1:8086/ollagitana/olla-gitana-cartas/
Método: suite CDP en Chrome headless, viewport móvil 390×844, clics reales + `window.__cartasState()`.

## Resultado global

| | Checks | Errores JS | Errores consola | Fallos de red |
|---|---|---|---|---|
| **Antes** | 26/28 ❌ | 0 | 0 | favicon 404 + ERR_ABORTED |
| **Después** | **30/30 ✅** | 0 | 0 | 0 (ERR_ABORTED clasificado benigno) |

Evidencia completa: `audit-antes.json` / `audit-despues.json`.

## Fallos encontrados y corregidos

1. **Carrera SIGUIENTE MANO durante el grace de gameOver → mano zombie.**
   Al perder la última vida, el botón NEXT quedaba pulsable 900 ms (hasta que `gameOver()` mostraba la pantalla). Un toque rápido repartía una mano con 0 vidas. Evidencia: `FAIL S2-partida-termina` en audit-antes + análisis del flujo. Fix: `actions('none')` inmediato + `newHand()` aborta si `lives<=0` + temporizadores con `epoch` (los de la partida vieja mueren). Re-probado con probe2: tras bust+NEXT ya no hay reparto zombie (`nplayer:2, handsPlayed:1`, endScreen visible).

2. **La banca seguía robando con la partida en PAUSA.** Los `setTimeout` de `dealerPlay()` solo comprobaban `running`, no `paused`. Fix: helper `later()` que congela los turnos al pausar y sigue al reanudar. Verificado con probe5: `dealer antes=1 tras2s=1 (pausa) → dealer=3 al reanudar y la mano se resuelve`.

3. **Manos de 5+ cartas se salían de la pantalla** a 390 px (primera/última carta cortadas). Fix: `fitHand()` solapa en abanico con mínimo de 18 px visibles. Medido: 0 cortes con 2, 4, 5, 7 y 11 cartas; capturas `probe2-overflow-7.png` y `probe5-mano-7-fit.png`.

4. **El teclado secuestraba el input del nombre.** Con el foco en "Tu nombre", las teclas D/P/M se comían y Space hacía `preventDefault` (no se podían escribir espacios). Fix: guard de INPUT/TEXTAREA/contentEditable en el keydown. Verificado: escribir "dpm " en el input no dispara doblar/pausa/sonido y el texto entra (`QA-Zagaldpm `).

5. **favicon.ico → 404 en cada carga** (ruido de red). Fix: `<link rel="icon">` + `apple-touch-icon` reales (`../icons/`), 200 OK.

6. **Animaciones de reparto se re-disparaban en cada render** (todas las cartas volvían a "saltar" al robar). Fix: solo animan las cartas nuevas; la tapada se voltea al revelarse.

7. **DOBLAR quedaba activo-clicable tras usarlo** (el guard interno impedía el doble cobro, pero el botón no reflejaba el estado). Fix: `disabled` tras usarlo.

8. **ERR_ABORTED en la suite de red** → clasificado **benigno**: navegación cancelada por el propio arnés (canceled:true, tipo Document, sin URL de recurso). probe3/probe4 con mapeo requestId→URL: 0 fallos reales de recursos del juego.

## Mejoras añadidas (misma identidad de la banda)

- **Prefs compartidas `olla_prefs_v1`**: recordar nombre (se precarga en el modal de fin) y sonido, igual que el resto de juegos. Verificado `S4-prefs-nombre-guardado`.
- **Compartir por WhatsApp** en inicio y fin de partida (`navigator.share` con fallback `wa.me`).
- **Haptics** (`buzz()`) en pedir, doblar, ganar y bust.
- **Robustez**: si la baraja de 40 se agotara, se reconstruye (red de seguridad).
- **Banca**: documentada la eliminación de la ambigüedad de `dealerBustBias` (código muerto).

## Verificaciones de no-regresión (30/30)

Reglas: 7½ exacto +700, empate normal pierde vida, empate fácil gana, DOBLAR x2 = 760, racha x3 = 1020, bust resta 1 vida y revela, DOBLAR deshabilitado con 1 vida, teclas D/Espacio activas en juego, ranking local + servidor, online rechazado correctamente ("ya no está disponible"), sin solape de botones a 390 px, `__cartasState()` intacto.

## Capturas

- Antes: `antes-01-inicio.png`, `antes-02-mesa.png`, `antes-04-fin.png`, `antes-05-fin-nombre.png`, `antes-06-ranking.png`
- Después: `despues-01-inicio.png`, `despues-02-mesa.png`, `despues-03-mano5.png`, `despues-04-fin.png`, `despues-05-fin-nombre.png`, `despues-06-ranking.png`
- Probes: `probe2-overflow-7.png` (7 cartas), `probe5-mano-7-fit.png`
