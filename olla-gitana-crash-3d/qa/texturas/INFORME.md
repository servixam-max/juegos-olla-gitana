# Sprint TEXTURAS — Olla Gitana 3D (mejora visual)

Objetivo del usuario: *"quiero mejora de texturas y visual para que parezca mucho
mejor el juego"*. Ronda hecha SOLO en `src/engine/textures.js`,
`src/engine/surfaces.js` y los material-factories de `src/game/art.js`
(no se tocó geometría de levels/levels2 — lo confirmó `git diff`).

## Qué se cambió

### 1. UV medido en METROS por cara (`uvPorCara`)
El bug de fondo de la ronda anterior: se aplicaban las texturas con
`texture.repeat` (3×8 etc.), y en una caja larga y estrecha el patrón se
**estiraba** por las caras laterales (calzada de 16×9 con repeat fijo = grano
aplastado en un eje). Ahora `uvPorCara(mat, escalaMetros)` sustituye el
`#include <uv_vertex>` del shader toon y calcula el UV con la `position` local
(en metros) proyectada según la normal dominante — mapeado tipo caja, igual en
un suelo de 16 m, un muro de 1,2 m o una losa de 6 m. `customProgramCacheKey`
mantiene los shaders separados de los toon sin UV de cara.

### 2. Texturas nuevas (misma caché que las 8 originales)
| textura | uso | detalle |
|---|---|---|
| `texCesped` | Huerta (N6), taludes | matas, briznas curvas, tréboles, calvas |
| `texMarmol(tono)` | Casino (N7) suelos/paredes/losas | losas con junta, vetas, vena dorada, bisel |
| `texArena` | Festi (N2) | albero: grano fino, rodadas, piedras, rastrojos |

Las briznas usan un helper `brizna()` **tileable** (se dibuja también desplazada
±TAM) para que no aparezcan costuras al repetir.

### 3. Recetas por mundo (`surfaces.js`)
`matSuperficie(mundo, clase)` ahora cubre: suelo (tierra por mundo, albero N2,
asfalto N3, adoquín N4, tierra noche N5, césped N6, mármol N7, recinto N8), muro
(ladrillo por mundo, piedra N7, vallas N8), plataforma (madera, mármol N7),
móvil (metal), agua, pilar (mármol), metal (postes), curb (bordillos).

### 4. Fábricas de `art.js` con textura
`texturedMat(estilo, escala, color)` (nuevo, cacheado por estilo+escala+color):
cajas de madera (cuerpo + tablones) y cajas metálicas, altavoces, barriles (y
barril rodante), furgoneta (chapa metálica), escenario (tarima de tablones),
árboles (tronco + copa de follaje), plataforma ruinosa. `toonMat` NO se tocó
(sigue disponible para todo lo que no lleva textura: personajes, jefes, etc.).

## Verificación (todo ejecutado, no descrito)

| Comprobación | Resultado |
|---|---|
| `npm run build` | ✓ built (2.5-4.3 s) |
| Bot godMode 8/8 (página nueva por nivel, `probe_bot1.js`) | **8/8 mode=end**, 0 errores, 0 falls, 0 golpes de muro |
| FPS real (rAF libre, bot jugando, `probe_fps.js`) | **avg 60 / min 60 en los 8 niveles**; draw calls 459-727 |
| Texturas en GPU | 12-46 por nivel (las 11 de la caché + canvas de UI) |
| Errores JS | 0 en todas las pasadas |
| Comparativas antes/después | 6 pares en `capturas/` (N1 callejón, N2 festi, N6 huerta, N7 casino, N8 arena, N3 carretera) |

Medición del A/B de geometría: antes de la ronda el bot tardaba 30-45 s por 8
niveles; con las texturas el mismo bot hace los 8 niveles en ~2.9 s de CPU en
headless (los fps reales son 60/60). No hay coste apreciable: las texturas son
compartidas por material (misma instancia de textura, repeat 1×1) y el trabajo
por píxel es un `texture2D` extra en el shader toon.

## Ficheros
- `qa/texturas/` (este directorio): harness CDP + probes + planes + capturas.
  Uso: `node qa/texturas/suiteFps.mjs qa/texturas/probe_bot1.js --levels=0,1,2 --port=9482`
  y `node qa/texturas/suiteShots.mjs qa/texturas/plan_despues.json --port=9483 --out=salida`.
  Necesita `ws` (ya está en dependencias del proyecto): enlaza o copia
  `node_modules` en el directorio desde el que se lance el harness.

## Pendiente / avisos
- `levels.js`/`levels2.js` los editan otros agentes a la vez: si el bot falla un
  nivel, comprobar con `git log` si la geometría cambió en esa ventana antes de
  culpar a las texturas (la geometría de los niveles pasó de ~340 m a 400-466 m
  durante esta ronda).
- Los ficheros `textures.js`/`surfaces.js`/`art.js` quedaron **dentro de HEAD**
  (commits de la ronda de 5 agentes). Si otro agente revierte a `6ba515f`, el
  sprint se recupera con: `git checkout <commit-que-lo-contiene> -- olla-gitana-crash-3d/src/engine/textures.js ...`
