# Revisión completa — Olla Gitana: El Duelo 🔫🥘

Fecha: 2026-10-02 · Zona: `olla-gitana-duelo/` (servido en http://127.0.0.1:8086/ollagitana/olla-gitana-duelo/)
Método: Chrome headless vía CDP (viewport móvil 390×844, táctil), 2 pestañas simultáneas para el
multijugador real, y cliente Python WebSocket directo contra el servidor de salas (ws://127.0.0.1:8094).

---

## 1. Fallos encontrados (con evidencia)

| # | Severidad | Fallo | Evidencia | Estado |
|---|-----------|-------|-----------|--------|
| 1 | **CRÍTICO (servidor)** | **La revancha quedaba congelada.** Tras terminar una partida (fase `over`), al pulsar los dos "Revancha"+"LISTO" la partida NO se reiniciaba: marcador, vidas y muerto seguían igual y el estado no avanzaba NUNCA (estado estático durante 24 s+). El servidor no tenía transición de `over` → `play`. | `diag3.py` (estado congelado 24 s: `fase=play ronda=3 hp=[6,0] alive=[True,False] rondas=[3,0]` para siempre) | ✅ **ARREGLADO** (salas.py) |
| 2 | Alto (cliente) | **Doble joystick.** Se dibujaba un aro translúcido en el canvas sobre el pad DOM, desalineado (dos círculos a la vez). Screenshot `05-joystick-arrastre.png`. | captura | ✅ arreglado |
| 3 | Alto (cliente) | **Marcador ilegible/solapado:** los 6 corazones de cada lado se pisaban con el texto central "RONDA 1 · al mejor de 5 · 75s" y con los corazones del rival; la barra de tiempo quedaba FUERA del recuadro. | captura `04-juego-bot.png` (zoom) | ✅ arreglado |
| 4 | Medio (cliente) | **Sacudida de golpe muerta:** `flash` se aplicaba con save/translate/restore vacíos (no desplazaba nada) y además el canvas no reseteaba la transformada por frame. | código + prueba | ✅ arreglado |
| 5 | Medio (cliente) | **Sin feedback al recibir un golpe**: no había ni sacudida ni sonido ni vibración cuando te quitaban vida (el `sfxHit` solo sonaba al perder). | auditoría | ✅ arreglado |
| 6 | Medio (cliente) | **Revancha en modo bot rota en el cliente**: con la máquina, `ready:true` se reenviaba automáticamente al volver al lobby (auto-arranque en bucle); además tras el fin no se reseteaba el "listo". | prueba regresión | ✅ arreglado |
| 7 | Medio (cliente) | **Puntería con ratón (escritorio) desalineada**: usaba una transformación de cámara DISTINTA a la del dibujo (`tam=min(W,H*.92)` vs cálculo real), así que apuntabas a un sitio y apuntaba a otro. | código | ✅ arreglado |
| 8 | Bajo (cliente) | **Botón "Menú" ilegible en la pantalla final**: texto blanco sobre fondo crema (`.modalBox .btn{color:#fff}`). | captura `17-fin-A.png` (zoom) | ✅ arreglado |
| 9 | Bajo (cliente) | **Clases del lobby mal**: la clase `me`/`rival`/`bot` se sobreescribía (el recuadro del bot perdía color); mensajes del lobby no distinguían "esperando rival" de "faltas tú". | código + capturas | ✅ arreglado |
| 10 | Bajo (cliente) | **Instrucciones desactualizadas**: decían "6 vidas cada uno / gana quien deje a cero" (ahora es al mejor de 5 rondas) y "dispara hacia donde te mueves" (el apuntado es la dirección del joystick). | `index.html` | ✅ arreglado |
| 11 | Bajo (cliente) | Código muerto/duplicado: bloque de sacudida vacío, `#controls` definido dos veces en CSS, `.ctl-jump` sin uso (los controles del duelo son mx/my + ax/ay). | auditoría | ✅ limpiado |

**Nota de protocolo (PITFALL histórico)**: verificado que el cliente sigue enviando `mx/my` (movimiento)
y `ax/ay` (apuntado) y que el servidor los lee correctamente — el bug de antaño (cliente mandaba mx/my
pero servidor leía dir/fire) NO se ha reintroducido. HUD con `pointer-events:auto`: correcto.

---

## 2. Cambios aplicados

### `olla-gitana-duelo/game.js`
- Feedback de golpe: sacudida de pantalla real (transformada al inicio de `dibujar()` + `setTransform` por frame), tinte rojo, `sfxHit()`, vibración (`navigator.vibrate`).
- Cartel de fin de ronda: **"¡RONDA TUYA! 🏆" / "¡RONDA DEL RIVAL! 💀"** bajo el marcador (2,6 s, no tapa la cuenta atrás).
- **Marcador rediseñado**: corazones con huecos vacíos (`❤️`/`🖤`), nombre recortado a 9, texto central "RONDA N DE 5 · Ns", barra de tiempo DENTRO del recuadro (caja de 54 px). Los iconos de efectos bajan debajo.
- **Joystick**: un solo indicador visible; si el toque nace en el pad, mueve el stick del DOM y no dibuja nada en canvas; si el toque nace fuera (centro virtual), dibuja el vector y NO mueve el stick. Fin del doble joystick.
- Apuntado con ratón con la MISMA transformación que el render (`pantallaA_Mundo()`).
- Revancha (modo bot): `botAutoReady` para auto-arrancar solo la PRIMERA partida; "Revancha" vuelve al lobby y requiere pulsar LISTO.
- `terminar()`: suelta disparo/movimiento, envía `ready:false`, limpia estado.
- Lobby: clases correctas (`me`/`rival`/`bot`), mensajes contextuales, y **pulso del botón LISTO** cuando el rival ya está dentro y falta tu pulsación.
- Sonda de QA `window.__dueloHud()` (hp, rondas, fase, posiciones) para pruebas automáticas.
- Aviso "¡PRESIÓN!" movido a y=146 para no chocar con los iconos de efectos.

### `olla-gitana-duelo/style.css`
- `.modalBox .btn-ghost` con texto oscuro (botón Menú legible sobre fondo claro).
- Animación `readyPulse` para el botón LISTO.
- (Se mantienen `#controls` con `pointer-events:none` y `.ctl` con `auto`: el HUD/controles no bloquean el canvas.)

### `scripts/ollajuegos/salas.py` (solo ruta `duel`, bug crítico documentado)
- `duel_matar()`: al acabar la partida, los humanos quedan `ready:false` (la revancha se pide de nuevo).
- Nueva `duel_nueva_partida()`: resetea marcador `[0,0]`, `ronda_n=1`, `res/ganador` y llama a `duel_nueva_ronda()` (vidas, posiciones, mapa nuevo, countdown).
- Enganchada en los dos caminos de `ready` (modo bot y 2 humanos) cuando `fase == "over"`.
- Backup: `salas.py.bak-antes-revancha`. El resto del fichero (cartas/pang/chat) intacto.

---

## 3. Verificación (todo con ejecución real)

### Multijugador REAL — 2 pestañas de Chrome (viewports 390×844 táctiles), **16/16 OK**
`qa/duelo-revision/multijugador-2-pestanas.json`
- A crea sala (código `LAMC`), B se une desde otra pestaña, slots 0/1, cada uno ve el nombre del rival.
- Ambos LISTOS → partida en marcha en las dos pestañas.
- A juega con multitáctil (joystick + botón disparo, ids de toque separados): B ve las balas (sync), B pierde vidas (hp 6→0), rondas 1-0, 2-0, 3-0, fin de partida.
- Pantalla final correcta: A "¡HAS GANADO! 🏆", B "¡TE HAN GANAO!" (3/0).
- **REVANCHA desde la UI**: ambos pulsan Revancha → LISTO → nueva partida con rondas [0,0], hp [6,6].
- 0 errores JS en ambas pestañas.

### Protocolo directo (Python) — **8/8 OK** (`verify3.py` con servidor ya arreglado)
- P1 completa 3-0 con victoria de Ana; fase `over` congelada correctamente; perdedor muerto.
- Revancha: `rondas=[0,0] hp=[6,6] alive=[True,True]` a los pocos segundos de pulsar LISTO.
- P2 completa 3-0 para Bea (marcador reiniciado de verdad, no 4-0/3-2).

### Cliente (1 pestaña, modo bot + controles) — **12/13 OK** (+ 1 artefacto del test)
`qa/duelo-revision/regresion-cliente.json`
- Menú completo visible en 390×844.
- **Joystick mueve al jugador**: (90,90) → (479,62), d=390 px (evidencia de que mx/my llegan y el servidor los aplica).
- Al soltar, el jugador se para; el stick del DOM vuelve a `translate(0,0)`.
- Botón DISPARAR crea balas (max 3 simultáneas en vuelo, el cd es 0,26 s).
- Teclado WASD mueve (d=280 px).
- Partida completa vs bot: 0-3 (el bot ganó), pantalla final, revancha → rondas [0,0] hp [6,6] countdown 2,9 s.
- *(El único FAIL es un artefacto: en modo bot la partida arranca sola antes de que el test mire el lobby; "arranca solo" pasó OK.)*

### Smoke final tras los últimos retoques — **6/6 OK** (`smoke-final.json`)
- Carga limpia, 0 errores JS, instrucciones nuevas (mejor de 5 + power-ups), partida viva contra el bot.

### Abandono del rival (`abandono.py`)
- Si el rival cierra la pestaña: el que queda recibe `left` y la sala NO se rompe (sigue recibiendo estados). El cliente muestra "¡TU RIVAL SE FUE!" (código existente, verificado).

### Rendimiento
- ~61 fps con fondo a pantalla completa; 0 errores JS en todas las sesiones (audit1, multi2, regfinal, smoke).

---

## 4. Capturas (qa/duelo-revision/)
- `01-menu-390x844.png`, `20-menu-final.png`, `27-menu-definitivo.png` — menú.
- `02-como-se-juega.png`, `28-como-se-juega-definitivo.png` — instrucciones (antes/después).
- `03-lobby-bot.png`, `21-lobby-bot.png`, `11-lobby-A-con-rival.png`, `12-lobby-B-con-rival.png`, `25-revancha-lobby.png` — lobbies.
- `04-juego-bot.png` (HUD viejo con solapes) vs `13-partida-A.png`, `29-partida-definitiva.png` (HUD nuevo limpio).
- `05-joystick-arrastre.png` (doble joystick viejo) vs `22-pad-movimiento.png` (arreglado).
- `15-ronda-1-0.png` (cartel "¡RONDA TUYA!") · `17-fin-A.png` / `24-fin-bot.png` (final + botón Menú legible).
- `19-revancha-A.png` / `26-revancha-jugando.png` — revancha.
- JSON de resultados: `audit1.json`, `multijugador-2-pestanas.json`, `regresion-cliente.json`, `smoke-final.json`.

---

## 5. Cómo re-ejecutar las pruebas
- Multijugador 2 pestañas: `node /Users/servimac/.hermes/cache/scratch/ogj10/multi2.mjs`
- Cliente completo: `node /Users/servimac/.hermes/cache/scratch/ogj10/regfinal.mjs`
- Protocolo + revancha: `/usr/bin/python3 /Users/servimac/.hermes/cache/scratch/duelo-qa/verify3.py`
- Requiere Chrome + servidor de salas (launchd `com.servimac.ollajuegos.salas`, puerto 8094).
