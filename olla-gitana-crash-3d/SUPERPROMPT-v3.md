# ⚡ SUPER PROMPT v3 — Olla Gitana 3D "GIRA MUNDIAL" · 7 SPRINTS

> **Directiva autónoma multi-agente.** Objetivo: pulir a fondo el juego 3D —
> **movimiento con pad (prioridad máxima)**, **texturas y riqueza 3D**, **interfaz
> vertical (bocadillos/cámara)** y **calidad visual general** — con varios agentes
> trabajando en paralelo, bots de QA automáticos en cada sprint y verificación en
> móvil real (emulador Android 1080×2400 vertical).
>
> **Regla de oro:** cada sprint termina con (a) build ✓, (b) QA de bots 8/8 ✓,
> (c) captura en móvil vertical ✓, (d) commit + push. Sin eso no se pasa al siguiente.

---

## 0. ESTADO DE PARTIDA (verificado 2026-09-30)

| Hecho | Estado |
|---|---|
| Bocadillos cortados en vertical | **ARREGLADO** — `baseW` adaptativo al viewport (`DialogQueue.update`: `fit = vw*0.94/5.6`) |
| Controles izq/der invertidos | **ARREGLADO** — cámara mira a +Z ⇒ derecha-pantalla = −X; `wx = -input.x*cos + input.z*sin` + `botToScreen()` |
| Cámara de arena (jefe final) | **ARREGLADO** — `camState.yaw = π` (mira a −Z) |
| Pad táctil | Zona muerta 0.14 + curva `^1.25` (mejora base; Sprint 1 la lleva a fondo) |
| QA bots | 8/8 niveles ✓ tras los cambios, 0 errores JS, 60 FPS |

### Arquitectura actual (para los agentes)

```
src/
├── main.js            ← orquestador: bucle tick(dt), cámara (updateCamera), bot QA (botStep/botToScreen),
│                        hooks __qa y __demo, niveles, HUD, cutscenes
├── engine/
│   ├── input.js       ← teclado/gamepad/táctil unificado, poll() con flancos
│   ├── player.js      ← controlador: accel 26, max 8.4, salto 10.6, giro 0.4 s, barrida, doble salto
│   ├── physics.js     ← AABB propio + plataformas móviles
│   ├── audio.js       ← rumba generativa + SFX (hit.mp3 solo golpes)
│   ├── fx.js          ← InstancedMesh pool 300, shake, confeti
│   └── hud.js
├── game/
│   ├── art.js         ← TODO el arte procedural (ollas, cajas, atrezzo, jefes, toonMat, PALETA)
│   ├── levels.js .    ← mundos 1-3 + arena · levels2.js ← mundos 4-7
│   ├── crates.js · enemies.js · pickups.js
│   └── boss.js (Cacharro) · boss2.js (Fermín)
├── narrative/
│   ├── bocadillos.js  ← SpeechBubble (canvas 640×320) + DialogQueue (viewport-fit)
│   ├── dialogos.js · director.js · intro.js
└── video/demo.js      ← guion del vídeo
```

**Cómo se toca sin romper:**
- **Nunca** usar `setTimeout` en lógica (colа `state.pending`).
- El movimiento del jugador es **relativo a la cámara** (`camState.yaw`).
  Si una cámara mira a −Z (arena), su yaw es **π**.
- Los bocadillos se dimensionan por `bubble.baseW`; el canvas mide 640×320 fijo.
- QA: `window.__qa` (start/enableBot/godMode/step/state/data.errors). `step(1/30,N)`
  simula sin rAF. Para el vídeo: `window.__demo` + `tools/record.mjs` (determinista).

---

## SPRINT 1 — MOVIMIENTO & PAD (prioridad máxima)

**Objetivo:** que la olla se sienta pegajosa, precisa y "de consola" en móvil.

**Worker A1 — Controlador (`player.js`):**
1. **Aceleración/frenada con inercia**: rampa de aceleración por estado (suelo 26 → subir a ~30 con
   llegada más rápida; aire mantener 14 pero permitir "drift" direccional).
2. **Salto**: añadir *variable jump* ya existe (JUMP_CUT) — subir ventana de coyote 0.12→0.15
   y buffer 0.16→0.2; probar salto a 10.9 si el doble salto queda flojo.
3. **Giro**: mantener 0.4 s pero añadir **pequeño impulso hacia delante** (×1.15 durante 0.15 s)
   para que encadenar giros se sienta ágil.
4. **Barrida + salto largo**: revisar que el salto largo salga del gesto (ya existe
   `longJumpWindow`); añadir partículas de polvo continuas durante la barrida.
5. **Facing suavizado**: turnRate 12 → 14 en suelo; en aire 8 (que no gire "robótico").

**Worker A2 — Pad táctil (`input.js` + `styles.css`):**
1. **Stick dinámico**: permitir que el knob se "recentre" si el jugador arrastra fuera del
   círculo base (origen sigue al puntero, estilo Brawl Stars): guardar origen y recolocar
   si el dedo se aleja > radius*1.2.
2. **Curva configurable**: exponer `deadZone` y `expo` como constantes al inicio del archivo
   (0.12 / 1.2) y afinar con pruebas en móvil.
3. **Botones**: agrandar un 12% (`tJump` 92→104 px, `tSpin` 78→88, `tSlide` 66→74) — testeado
   que no coman media pantalla en 1080×2400; añadir `touch-action: none` explícito y vibración
   `navigator.vibrate(8)` en cada pulsación.
4. **Reintroducir el pad si se pierde el dedo**: en `pointerleave` el estado ya se limpia —
   comprobar que el knob vuelve a 0 y el touch.x/y = 0 (ya está; verificar).

**Verificación Sprint 1 (obligatoria):**
- [ ] En móvil: empujar stick → derecha-pantalla = −X (Δx<0 con cámara +Z) — **test ya escrito**
      en `~/.hermes/cache/scratch/ogj8/test_controles_movil.py` (usar como base).
- [ ] Recorrer nivel 1 solo con el pad: sin toques muertos, giros con inercia.
- [ ] QA bots 8/8, 0 errores.
- [ ] Captura de la olla corriendo y girando en vertical.

---

## SPRINT 2 — CÁMARA Y DIÁLOGOS EN VERTICAL (pulido)

**Objetivo:** que la experiencia vertical sea *diseñada*, no adaptada.

**Worker B1 — Cámara vertical (`main.js`):**
1. **Según aspect**: `const portrait = innerHeight > innerWidth`. En vertical:
   - raíl: `behind` 7.2→`6.2`, `up` 4.15→`4.6` (más alta y cerca: el pasillo se lee mejor).
   - arena: `tz = p.z + 12.5` → `+10.5` y `y 10.5→9.5`.
   - chase: `z -10.2` → `-8.8`.
2. **lookAt más alto**: en vertical, subir el punto de mira `y` +0.3 para que la olla no
   quede al borde inferior con los controles.
3. **Añadir 3ª persona con ligero "lead"**: mirar un poco hacia delante (z +4.2 en vez de +3.6).

**Worker B2 — Bocadillos vertical (`bocadillos.js`):**
1. Ya se adaptan por viewport; ahora **reubicar**: en vertical el `screenY` 0.55 va justo
   debajo del HUD — subir a `0.75` cuando `portrait`.
2. **Fuente adaptativa**: si `vw` es pequeño, reducir `fs` de 46→40 y `maxW` (más líneas, más legible).
3. **Añadir retrato**: opcional — cuadrito con la "cara" del hablante (canvas simple: ojos+bigote de olla)
   al lado izquierdo del bocadillo. Valorar coste.
4. **Modo cine**: en letterbox vertical, mover el bocadillo al 62% de altura (hoy queda tapado
   por las barras).

**Verificación Sprint 2:**
- [ ] Captura vertical de: intro (villano), cutscene de nivel, frase de nota — todo legible y dentro.
- [ ] Captura horizontal (escritorio 1280×720) sin regresiones.
- [ ] QA 8/8.

---

## SPRINT 3 — TEXTURAS Y MATERIALES (arte procedural 2.0)

**Objetivo:** acabar con el look "colores planos" — dar detalle sin cargar texturas externas.

**Worker C1 — Biblioteca de texturas procedurales (`src/engine/textures.js` NUEVO):**
- Funciones que generan `CanvasTexture` **cacheadas** (Map por clave):
  - `texTierra()` — tierra murciana con motas y surcos.
  - `texLadrillo()` — ladrillo para muros de callejón.
  - `texMadera()` — vetas para cajas/cajones.
  - `texMetal()` — altavoces/amplis con brillos.
  - `texAgua()` — acequia/piscina con ondas.
  - `texFolleto()` — confeti de colores para el escenario.
  - `texEstrella()` — cielo nocturno para el nivel 5/7.
- Todas **sin filtrado externo**: `NearestFilter` NO; usar `LinearFilter` + `RepeatWrapping`
  y `tex.repeat.set(w,h)` por tamaño de superficie.
- **Coste**: canvas 256×256 máx (60 FPS objetivo — medir con `__qa.avgFps()`).

**Worker C2 — Aplicación en el juego (`art.js`, `levels*.js`):**
1. Suelo de cada mundo: `MeshToonMaterial` → `map: texTierra()` repetido; tinte por mundo
   (`color` mantiene la paleta actual).
2. Muros/paredes: ladrillo repetido (escala 2×1), con `color` de cada mundo.
3. Cajas: la cara del cajón usa `texMadera`; TNT/Nitro conservan su icono (ya es canvas).
4. Escenario de la intro: suelo madera + fondo póster (ya está) + confeti estático.
5. Jefes: Cacharro con `texMetal` en los altavoces; Fermín con "tela" de ampli.

**Verificación Sprint 3:**
- [ ] Capturas antes/después por mundo (m1..m8) en vertical.
- [ ] `__qa.avgFps() ≥ 55` con el bot en los 8 niveles.
- [ ] Tamaño del bundle: no subir >300 KB (las texturas son canvas en runtime).

---

## SPRINT 4 — MÁS COSAS EN 3D (riqueza y vida)

**Objetivo:** que cada mundo tenga "atrezzo" que lo identifique (lo que pide el usuario).

**Worker D1 — Props por mundo (`art.js` + `levels*.js`):**
- **N1 Callejero**: farolas con jaula, buzón "Correos", sombrillas de terraza, macetas.
- **N2 Festi**: torres de altavoces apiladas, cables por el suelo (planos finos), barrera
  metálica, camión de carga.
- **N3 Furgoneta**: conos de tráfico, vallas de obra, señales de "Murcia 5 km".
- **N4 Procesión**: palmas/ramas, velas extra en filas, estandarte.
- **N5 Sardina**: antorchas, humo volumétrico falso (sprites), el ataúd-sardina lejano.
- **N6 Huerta**: aperos (azada clavada), pozo con brocal, limonero con frutos.
- **N7 Casino**: mesas de juego, candelabro grande, columnas, espejos (ya), alfombra roja.
- **N8 Arena**: vallas de seguridad, focos de escenario, cajas apiladas de fondo.

**Worker D2 — Vida ambiental (`fx.js` + bucle):**
1. **Partículas ambientales por mundo**: hojas en N6, pétalos en N4, confeti en N2, chispas
   en N5/N7 (usa `fx.burst` a baja frecuencia: 1 cada 2-4 s en posiciones aleatorias
   del rango visible).
2. **NPCs decorativos**: 2-3 "ollas espectadoras" estáticas en las gradas de N2/N8 que
   saltan cuando el jugador pasa cerca (barato: `scale.y` oscilante).
3. **Carteles 3D**: letreros con `CanvasTexture` por mundo ("¡EN VIVO!", "¡QUE NO PARE LA RUMBA!").

**Verificación Sprint 4:**
- [ ] Capturas por mundo mostrando el atrezzo nuevo.
- [ ] QA 8/8 + FPS.
- [ ] Móvil: la escena no se satura visualmente (mirar 3 capturas seguidas).

---

## SPRINT 5 — ILUMINACIÓN Y POSTPROCESO (calidad visual)

**Objetivo:** subir de "web-3D" a "consola".

**Worker E1 — Luces (`main.js`):**
1. **Sombra real solo del jugador y jefes**: activar `renderer.shadowMap` (PCFSoft) con
   `sun.castShadow` y mapa 1024, `sun.shadow.camera` ajustada al pasillo (~24×24).
   Los demás objetos reciben sombra (`castShadow=false` salvo cajas cercanas).
   *Medir FPS — si baja de 55, volver a blob shadow (decisión por dato).*
2. **Rim light**: `DirectionalLight` trasero (azul-morado, 0.35) para silueta de la olla.
3. **Luces de color por mundo**: hemisferio con `color` según mundo (huerta verde, casino cálido).

**Worker E2 — Postproceso sin dependencias (`styles.css` + canvas):**
1. **Viñeta** CSS (`box-shadow` interior o capa con gradiente radial) — ya hay base; reforzar.
2. **Grano sutil** opcional (CanvasTexture overlay con `mix-blend-mode: overlay`, opacidad 0.05).
3. **Flash de daño** ya existe; añadir **desenfoque de muerte** (CSS `filter: blur(2px)` 0.3 s).

**Verificación Sprint 5:**
- [ ] Comparativa "antes/después" 4 capturas.
- [ ] FPS medidos: si <55 → desactivar sombras y anotar.
- [ ] QA 8/8.

---

## SPRINT 6 — PULIDO POR MUNDO + JEFES

**Objetivo:** dar el "toque de autor" a cada escenario y a las peleas.

1. **N1**: tutorial visual (flechas en el suelo con `CanvasTexture`).
2. **N2**: focos que barren el escenario (haz de luz con `ConeGeometry` transparente).
3. **N3**: la furgo con ruedas que giran + humo del tubo de escape; cartel "GIRA MUNDIAL" en el arcén.
4. **N4**: incienso/humo con sprites + paso lento de una "procesión" de fondo (3 ollas caminando, decorativas).
5. **N5 Fermín**: fase 2 — llamar a dos "coristas" (amplis pequeños) que bailan y hay que esquivar.
6. **N6**: riego automático (aspersores con partículas) en las acequias.
7. **N7**: ruleta girando en el fondo + espejos (ya) + reflejo de lámparas (pseudo: luz que va y viene).
8. **N8 Cacharro**: intro de jefe con cortinilla de humo y "público" (ollas) que se ilumina al empezar.
9. **Cartelas de nivel**: añadir subtítulo narrativo ("MUNDO 3 · La furgo no perdona") bajo "MUNDO n".

**Verificación Sprint 6:**
- [ ] Captura de cada mundo + pelea de cada jefe.
- [ ] QA: los 2 jefes derrotables por el bot.
- [ ] Vídeo de presentación regenerado si los cambios son visibles.

---

## SPRINT 7 — QA TOTAL, MÓVIL, VÍDEO Y RELEASE

**Objetivo:** cerrar con evidencia completa.

1. **QA multi-bot** (3 bots a la vez en paralelo, 3 navegadores): 8 niveles × 3 corridas
   sin errores (`__qa.data.errors` vacío, `damageLog` coherente).
2. **Pruebas de estrés**: giros+barridas encadenadas 30 s seguidos; 50 cajas rotas;
   entrar/salir del agua; morir 3 veces seguidas (el "over" con nombre debe funcionar).
3. **Móvil real**: recorrido completo con el pad grabando capturas cada 10 s; comprobar
   calor/batería (emulador no lo da — anotar como limitación).
4. **Regenerar el vídeo** con `node tools/record.mjs` si hay cambios visuales (SÍ los habrá):
   - Actualizar guion si hace falta (GUION en `src/video/demo.js`).
5. **Publicar**: `dist` → `olla-gitana-crash-3d-servido/` + `presentacion.mp4`.
6. **POSTMORTEM v3** + skill (`references/olla-gitana-3d.md`) + commit/push.

**Verificación Sprint 7 (acceptance):**
- [ ] 24/24 corridas de bot OK (8 niveles × 3).
- [ ] 0 errores JS acumulados.
- [ ] Vídeo nuevo generado y reproducible en móvil.
- [ ] Capturas móviles de: intro, 3 mundos, jefe, fin con nombre y ranking.
- [ ] `POSTMORTEM.md` actualizado.

---

## ORQUESTACIÓN MULTI-AGENTE (cómo se ejecuta)

**Estrategia:** un agente orquestador (esta sesión) + subagentes por sprint con
`delegate_task`, cada uno con su terminal y sus reglas:

| Agente | Sprint | Tarea | Entrega |
|---|---|---|---|
| **A1** | 1 | Controlador `player.js` + inercia/salto/giro | diff + notas de "feeling" |
| **A2** | 1 | Pad `input.js` + botones `styles.css` | diff + medidas |
| **B1** | 2 | Cámara vertical `main.js` | diffs + capturas |
| **B2** | 2 | Bocadillos vertical `bocadillos.js` | diffs + capturas |
| **C1** | 3 | `textures.js` nuevo | archivo + demo |
| **C2** | 3 | aplicación en levels/art | diffs |
| **D1/D2** | 4 | props + vida ambiental | diffs + capturas |
| **E1/E2** | 5 | luces + postproceso | diffs + FPS medidos |
| **F** | 6 | pulido por mundo | diffs + capturas |
| **QA-BOT** | 2..7 | bots de validación automática | reportes `__qa` |
| **REC** | 7 | grabación del vídeo | MP4 |

**Reglas para TODOS los subagentes (pegar en su contexto):**
1. **No romper**: tras cada cambio, `npm run build` debe pasar y **QA 8/8** con el bot.
2. **Sin `setTimeout`** en lógica; todo por `dt` o cola `state.pending`.
3. **Movimiento**: si tocas cámara, revisa `camState.yaw` (π = mira a −Z).
4. **Bocadillos**: `bubble.baseW` es el tamaño; NO fijar 5.6 a pelo.
5. **Español murciano** en textos visibles. **Nunca** mencionar el servidor/Mac.
6. **Nunca** `hit.mp3` para aciertos (solo golpes/vidas).
7. Verificación mínima de cada agente: `__qa.step(1/30, 4200)` en su nivel tocado.
8. Al terminar: `git add -A && git commit` con su mensaje y avisar al orquestador.

**Cadencia por sprint (el orquestador):**
```
1. Lanzar workers del sprint (delegate_task, en paralelo si tocan archivos distintos).
2. Esperar resultados; integrar diffs en la working copy.
3. npm run build → QA bots 8/8 → capturas móvil vertical.
4. Corregir regresiones (bucle hasta verde).
5. git commit -m "Sprint N: ..." && git push.
6. POSTMORTEM: anotar lo aprendido.
```

**Herramientas de verificación que YA existen (usar, no reinventar):**
- `window.__qa`: `start(n)`, `enableBot()`, `godMode(true)`, `step(1/30,N)`, `state()`,
  `data.errors`, `avgFps()`, `minFps()`, `damageLog`.
- `window.__demo` + `node tools/record.mjs` (vídeo determinista).
- Móvil: `adb shell am start -a android.intent.action.VIEW -d 'http://10.0.2.2:8086/ollagitana/olla-gitana-crash-3d-servido/'`,
  capturas con `adb shell screencap`; CDP del Chrome del móvil en `tcp:9334` con
  `suppress_origin=True`.
- Test de controles: `~/.hermes/cache/scratch/ogj8/test_controles_movil.py`.

---

## CRITERIOS DE ACEPTACIÓN GLOBALES (v3)

1. **Pad**: en móvil, mover/ saltar/girar/barrida responden con <100 ms y la dirección
   coincide siempre con la pantalla (izq=izq, der=der) en los 3 tipos de cámara.
2. **Bocadillos**: legibles y completos en vertical Y horizontal, en intro, cutscenes y frases.
3. **Texturas**: los 8 mundos se distinguen entre sí a simple vista (sin planos de color uniforme).
4. **Atrezzo**: al menos 3 props nuevos por mundo + 1 efecto ambiental.
5. **FPS**: ≥55 de media con el bot en los 8 niveles (medido).
6. **QA**: 8/8 niveles, 2/2 jefes, 0 errores JS.
7. **Vídeo**: regenerado, sin HUD y sin pantallas de fin, reproducible en móvil.
8. **Todo commiteado y publicado**; POSTMORTEM v3 y skill actualizados.

---

## NOTAS DE ESTILO (identidad)

- Paleta: `--rojo #e63946 · --dorado #ffbe0b · --verde #38b000 · --morado #8338ec`.
- Toon look: `MeshToonMaterial` + gradiente compartido; sombras suaves.
- Humor murciano en textos ("¡Miaja!", "¡Cachirulo!", "La furgo no perdona").
- Música rumba generativa ya integrada; `levelup_special.mp3` en eventos.
- **Nunca** mencionar servidor/Mac en pantalla.
