# Las Burbujas — Revisión completa (QA + arreglos + rendimiento móvil)

Fecha: 2026-10-02 · Juego: `olla-gitana-burbujas/` · Servido en `http://127.0.0.1:8086/ollagitana/olla-gitana-burbujas/`
Método: Chrome headless vía CDP (teclado/ratón sintéticos), viewport móvil 390x844 + escritorio 1280x800/1440x900,
interceptor WebSocket propio (`__qaLog`) y lectura del estado autoritativo del servidor (`__qaState`).

## 1. Fallos encontrados y arreglados

| # | Fallo (evidencia) | Arreglo | Verificación |
|---|---|---|---|
| 1 | **Modo 2 jugadores inalcanzable**: no existía campo para meter el código de un amigo. El botón "Copiar" se ocultaba por código (`btnCopy.style.display='none'`), así que no había forma de compartir el código. El lobby solo se abría creando sala, y `salas.py` no acepta unirse a una sala existente desde la UI. | Añadidos a la pantalla de inicio: botón **👥 Crear sala con un amigo**, campo **CÓDIGO** + botón **🔑 Entrar** (envía `room:<código>` al servidor), botón **📤 Compartir** en el lobby (Web Share API con fallback a clipboard). | Un segundo navegador entra con el código real y aparece como slot 1; ambos ven al rival y juegan (`jugx`, arpones de los 2 slots). Capturas 22/23/24/67/68. |
| 2 | **Sin feedback si el servidor de salas no responde**: `ws.onclose` solo ponía `connected=false`; en solitario te quedabas en la pantalla de inicio sin saber por qué (sin fallback local, el juego es autoritativo). | Aviso a los 5 s (`El servidor de salas no responde`), aviso en `onclose` si nunca llegó `welcome`, y mensaje distinto si se cae en mitad de partida. | `conectar()` con servidor caído → toast visible y vuelta al menú; 0 errores JS. |
| 3 | **El mundo se cortaba por arriba en escritorio apaisado**: se escalaba solo por ancho (`scale = W/GW`) y la parte superior (burbujas y ladrillos) quedaba fuera de pantalla. | Escala `min(W/GW, H/GH)` + centrado horizontal (`offX`). | 1440x900: `esTodoVisible: true`, mundo 800x900 completo, offX 320. Captura 71/33. |
| 4 | **Cierre por código decía "Rival" cuando jugabas solo**: la pantalla final usaba el rótulo "Rival" fijo; en solitario mostraba tu récord con etiqueta de rival. | Rótulo dinámico (`endRivalLbl`): "Récord" en solitario, "Rival · <nombre>" en 2 jugadores. | Captura 30 (solitaire) y 32/69 (2 jugadores: "Rival · ANA"). |
| 5 | **La etiqueta `endRivalLbl` no existía** en el HTML aunque se necesitaba para (4). | Añadido `<span class="k" id="endRivalLbl">`. | Sin errores en `getElementById`. |
| 6 | **Ranking no visible en el juego**: se guardaba puntuación (`POST /api/score`) pero no había ninguna tabla donde verla; `logros.js` se cargaba y nunca se usaba. | Modal **🏆 Ranking** (online con respaldo en `localStorage` si no hay red) y botón **🎖️ Logros** (`logros.panel()`). | Ranking carga 20 filas del API real; con red caída muestra "tus mejores marcas (local)". Capturas 61/52. |
| 7 | **Teclado movía la olla al escribir el mote**: `keydown` global capturaba `a`/`d`/espacio dentro del `<input>`. | Guarda `if (tag === 'INPUT' \|\| 'TEXTAREA') return`. | Escribiendo en el input, `miX` no cambia (test `teclado-en-input`). |
| 8 | **Sin aviso de subida de nivel**: al limpiar un nivel no pasaba nada visible. | Toast **¡NIVEL N! 🌟** + arpegio + anillos en las burbujas nuevas. | Test niveles: pasa de N1→N2→N3 con toast visible (`niveles:subida`, `toast-nivel`). |
| 9 | **Controles de "Cómo se juega" desactualizados**: prometía un selector de escenario que ya no existe y decía que solo se juega en solitario. | Texto actualizado (solitario o con un amigo vía código) y eliminada la línea falsa. | Captura 63 (texto nuevo). |
| 10 | **Marcador sin tope de nivel ni vidas gastadas**: "NIVEL 1" sin /20 y corazones solo llenos (no se veían las vidas perdidas). | "NIVEL n/20" + corazones `❤️/🖤` hasta 5. | Capturas 68 (2J: dos nombres + puntos) y 63. |
| 11 | **Sin botón "Otra vez" útil**: volvía al menú sin reenganchar. | Reengancha directo en solitario (nueva partida); con amigo avisa de crear sala. | `btnAgain` probado. |
| 12 | **El arpón del rival no se distinguía** y el marcador en 2J solo mostraba tus puntos, no los del rival. | Marcador a 2 columnas (tú/rival) cuando hay rival. | Captura 68: "ANA 0 / LUIS 0". |
| 13 | **Modal de ranking sin estilos** (`rankTable`, `muted` no existían en `style.css`). | Añadidos `.rankTable`, `.muted`, `.muted.tiny`. | Captura 61. |
| 14 | **Desbordamiento horizontal en modales** en móvil (scrollWidth > clientWidth). | `overflow-x: hidden` en `.modalBox`. | Probado; sin scroll horizontal. |

Mecánicas verificadas sin regresión (test automatizado con bot propio):
- **Arpón**: máximo 1 en vuelo por jugador (burst de 30 disparos → máx 1). ✔
- **Partido al 50%**: 54 → 2 hijas de 40; 40 → 2 de 28; 28 desaparece (sin hijas). ✔
- **Puntuación**: 72→20, 54→30, 40→50, 28→70 (pequeñas valen más). ✔
- **Vidas**: 3 al empezar; roce con burbuja = −1 vida + invulnerabilidad 3 s + flash rojo + vibración. ✔
- **Niveles**: avanzan al limpiar; el servidor genera ladrillos y burbujas nuevas. ✔
- **Pompa gigante (r=72)** y los 5 power-ups (⚡ línea, 🔫 pistola, ❄️ hielo, ❤️ corazón, 🌫️ fantasma): ruta de dibujo y chips de efectos verificados con payload idéntico al del servidor. ✔
- **Multijugador online**: unirse con código, empezar, mover/disparar ambos, fin de partida con etiquetas correctas. ✔
- **0 errores JS** en móvil, escritorio, 2 jugadores y sesión larga. ✔

## 2. Rendimiento móvil (petición nueva)

### Qué se optimizó

1. **DPR adaptativo por FPS medidos** (`ajustarCalidad()`): se cuentan frames en ventanas de 0,75 s; tras 3 ventanas
   seguidas y como máximo 1 cambio cada 2 s, se baja la escala a **0.75 / 1 / 1.5 / 2** si el FPS medio < 50, y se sube
   si > 56. `resize()` aplica el nuevo DPR y reconstruye las caches dependientes del tamaño.
2. **Cache de capa de fondo**: la foto de Murcia + viñeta se pintan **una vez** en un canvas offscreen y luego solo se
   copian con `drawImage` (antes: 2 `drawImage` + `createLinearGradient` + `fillRect` de pantalla completa por frame).
3. **Sprites cacheados** de burbujas (4 tamaños), de los 5 power-ups y de los anillos de reventón: antes cada burbuja
   creaba un `createRadialGradient` + 4 arcos + `stroke` por frame; ahora es 1 `drawImage` desde un canvas pequeño.
   Los sprites se regeneran solo si cambia el DPR.
4. **Sin allocations por frame**: partículas compactadas en el sitio (`particulas.length = nPart` en vez de `filter`
   que crea array nuevo), gradientes reutilizados vía cache (`grad()`), textos del marcador cacheados (`txtCache`),
   `performance.now()` una sola vez por frame en los power-ups.
5. **Menos partículas/efectos en gama baja**: tope de partículas (16 → 8) y `nivelDetalle` que quita adornos
   (estantes, juntas de ladrillo/suelo, segundo anillo) cuando la escala baja a 0.75/1.
6. **Sin `shadowBlur`** en el código (se comprobó: 0 usos) — era la petición de quitarlo; ya no había ninguno.

### Números (390x844, móvil)

FPS de rAF con carga alta y medición de coste por frame con *flush* forzado (getImageData 1x1 = rasterizado completo),
A/B contra el `game.js` original (git HEAD), 3 rondas entrelazadas cada uno:

| Métrica (escena 12 burbujas + 16 ladrillos + 5 ítems + 2 líneas) | ANTES (original) | DESPUÉS (optimizado) | Mejora |
|---|---|---|---|
| Coste por frame rasterizado (mediana) | **7,86 ms** | **6,31 ms** | **−19,7 %** |
| FPS de rAF sostenidos (techo del navegador) | 60,0 | 60,0 | — (tope vsync) |

La GPU de este Mac (headless) mantiene 60 fps en ambos casos, por eso el A/B con FPS no discrimina: la métrica que sí
escala con la potencia del dispositivo es el **coste por frame**, y ahí la mejora es del 19,7 % con la misma calidad.

Coste por frame según la escala adaptativa (escena 16 burbujas + 20 ladrillos, la misma máquina):

| Escala (DPR) | Píxeles del canvas | Coste/frame | Relativo a DPR 2 |
|---|---|---|---|
| **2** (alta) | 1.316.640 | 4,10 ms | 1,00× |
| **1,5** | 740.610 | 1,60 ms | **0,39×** |
| **1** | 329.160 | 0,70 ms | **0,17×** |
| **0,75** (gama muy baja) | 185.469 | 0,50 ms | **0,12×** |

Es decir: cuando el móvil no da 50 fps a DPR 2, el ajuste automático a 1,5 / 1 / 0,75 reduce el trabajo de rasterizado
hasta **8× menos**, que es lo que devuelve los 50-60 fps en un móvil de gama baja. La lógica se probó en vivo: con
rasterizado por software (SwiftShader) el juego bajó solo a 1,5 y a 1 (`perf.dpr` 2→1.5→1). El estado es consultable en
`window.__burbujasPerf()` y se puede fijar a mano con `window.__burbujasSetDpr(0..3)` (QA).

Verificado: mecánicas intactas, 0 errores JS, y todas las capturas regeneradas tras la optimización.

## 3. Capturas

`qa/burbujas-revision/antes/` (estado previo) · `qa/burbujas-revision/despues/` (estado final, fichero optimizado)

- `60-inicio-movil` · `61-ranking-online` · `62-logros` · `63-como-se-juega`
- `64-juego-movil-arpon` · `65-toast-nivel` · `66-gigantes-powerups`
- `67-lobby-compartir` · `68-lobby-2jugadores` · `69-2j-marcador`
- `70-escritorio-inicio` · `71-escritorio-juego` · `72-movil-pequeno` (viewport 375x667)
- `antes/01..11`: fallos originales (mundo cortado en escritorio, lobby sin botón de compartir ni campo de código)
