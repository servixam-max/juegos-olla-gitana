# ⚡ SUPER PROMPT — Olla Gitana 3D v2.0 "GIRA MUNDIAL"

> **Directiva operativa autónoma.** Objetivo: convertir el prototipo Olla Gitana 3D
> (3 mundos + jefe, funcional) en un **juego completo de presentación** con intro
> cinemática narrada por bocadillos, **7 mundos + 2 jefes**, y un **vídeo de
> presentación** en MP4. Ejecución por fases, con QA automatizado en cada una y
> verificación en móvil real. Sin parar hasta cumplir todos los criterios de aceptación.

---

## 0. ESTADO DE PARTIDA (verificado)

| Elemento | Estado |
|---|---|
| Proyecto | `/Volumes/465GB/migrated/juegos/olla-gitana-crash-3d` (Vite 8 + three 0.186) |
| Contenido actual | 3 niveles + arena de jefe, 4 escenarios jugables |
| Mecánicas | salto doble, giro, barrida, salto largo, pisotón, 8 tipos de caja, notas, máscaras/aura, combo |
| QA | bot `?bot=1` + API `__qa` (`start/enableBot/step/state/damageLog`) — 4/4 niveles completables, 12 bugs corregidos |
| Assets | 15 fondos de Murcia, póster de la banda, `music.mp3`, `hit.mp3`, `levelup_special.mp3` |
| Herramientas | ffmpeg 9.0.2, Chrome/Chromium (browser harness), PIL, Node 26 |
| Publicado | `https://servi.tail31979d.ts.net/ollagitana/olla-gitana-crash-3d-servido/` |

---

## 1. VISIÓN DEL PRODUCTO

**"Olla Gitana 3D: GIRA MUNDIAL"** — plataformas 3D estilo Crash Bandicoot con la
identidad de la banda: la olla protagonista recorre 7 escenarios de Murcia para
recuperar las **7 notas robadas** por *El Cacharro*, un desalmado empresario del
sonido que quiere quedarse con la música de la banda. Final: duelo en el escenario
contra El Cacharro (2 fases de jefe, con su secuaz intermedio).

### Historia (guion de la intro)
1. La banda está de gira y suena genial... pero **enmudece de golpe**.
2. *El Cacharro* aparece en pantalla: ha robado las 7 notas y las ha repartido por Murcia.
3. La **olla** (mascota rumbera) se calza la guitarra y sale a recuperarlas.
4. "¡Que no pare la rumba!" → fundido a negro y arranca el juego.

### Personajes (arte procedimental 3D)
- **La Olla** (protagonista): olla rechoncha roja con asas, bigote rumbero, pañuelo, ojos grandes. Animaciones: correr, saltar, girar, barrer, recibir daño, celebrar.
- **El Cacharro** (antagonista): torre de altavoces con pantalla-cara roja, brazos con altavoces.
- **Fermín Cascabel** (secuaz / jefe intermedio 2): ampli gigante con patas, lanza ondas a ritmo de sevillanas (aparece en el mundo 5).
- **Notas musicales** (objetivo): notas doradas con halo.

---

## 2. ARQUITECTURA DE LA v2

```
src/
├── narrative/
│   ├── dialogos.js        # guion completo: intro, entre-niveles, jefes, final
│   ├── intro.js           # máquina de estados de la cinemática de apertura
│   ├── bocadillos.js      # SpeechBubble 3D (sprite con cola) + cola de diálogo
│   └── director.js        # director de cámara cinemática (raíles, fades, letterbox)
├── game/
│   ├── levels2.js         # 4 mundos nuevos (5, 6, 7 y bonus)
│   ├── boss2.js           # Fermín Cascabel (jefe intermedio)
│   ├── trophies.js        # trofeos/logros internos del 3D
│   └── ...
├── video/
│   └── capture.js         # modo demo determinista para grabar el vídeo
└── tools/
    ├── record.mjs         # guion de captura CDP → PNG → MP4 (ffmpeg)
    └── make_title.py      # cartelas del vídeo con PIL
```

### Sistema de bocadillos (sin voces)
- `SpeechBubble(text, {speaker, side, tone})` → sprite `CanvasTexture` con el texto
  dibujado, forma de nube, cola apuntando al hablante, animación de entrada (pop) y
  salida, y **efecto máquina de escribir** (aparece letra a letra).
- Tono: `normal`, `grito` (borde rojo, texto más grande), `pensamiento` (bordes
  redondeados, nube con bolitas), `móvil` (texto corto entre corchetes).
- Sonidos por sílaba: pitido corto por cada 3-4 letras (estilo Animal Crossing) —
  **nunca** `hit.mp3` (reservado a golpes).

### Intro cinemática (≈70 s)
| Plano | Contenido | Duración |
|---|---|---|
| 1 | Escenario vacío con luces que se encienden (paneo lento) | 8 s |
| 2 | La banda toca (ollas-silueta animadas sobre el escenario) + notas saliendo | 10 s |
| 3 | La música se corta: fade de audio, zoom a la pantalla del Cacharro | 8 s |
| 4 | Monólogo del Cacharro (bocadillos, 4 líneas) | 14 s |
| 5 | La olla coge la guitarra y sale corriendo (plano de seguimiento) | 12 s |
| 6 | Cartel "GIRA MUNDIAL" + fundido (con logo de la banda) | 6 s |
> Saltable con `ESC` o cualquier botón ("SALTAR INTRO ▶"), y se puede re-ver desde el menú ("🎬 Ver intro").

### Mundos (7 + jefe final)
| # | Nombre | Tema / fondo | Mecánica nueva | Dificultad |
|---|---|---|---|---|
| 1 | El Ensayo Callejero | Catedral / callejones | base + charcos | ★ |
| 2 | Ruta al Festi | Andamios / festival | plataformas móviles, focos, ondas | ★★ |
| 3 | Furgoneta Desbocada | Carretera | persecución | ★★ |
| 4 | **La Procesión** (NUEVO) | Semana Santa | **plataformas que se mueven en horizontal + cirios que caen** | ★★ |
| 5 | **El Entierro de la Sardina** (NUEVO) | Noche / desfile | **jefe intermedio: Fermín Cascabel** + antorchas, humo que empuja | ★★★ |
| 6 | **La Huerta Perdida** (NUEVO) | Huerta murciana | **agua/acelgas que frenan, saltos entre árboles, abejas** | ★★★ |
| 7 | **El Casino de Murcia** (NUEVO) | Casino modernista | **espejos (plataformas invisibles), lámparas oscilantes, suelo pulido resbaladizo** | ★★★★ |
| 8 | Duelo en el Escenario (jefe final) | Escenario | 3 fases del Cacharro | JEFE |

### Mejoras a los niveles existentes
- **Rutas secretas**: ≥1 camino alternativo por nivel con recompensa (5 notas + máscara).
- **Más tipos de caja**: caja **temporizada** (se rompe sola a los 8 s), caja **imán**
  (atrae las notas de la zona), caja **reloj** (congela enemigos 5 s).
- **Bonus de nivel**: al 100 % de notas aparece una **caja de oro** con 10 puntos extra.
- **Enemigos nuevos**: **abeja** (vuela en zigzag), **turista** (patrulla y se gira al
  verte), **altavoz-torreta doble**.
- **Decorado vivo**: bandadas de pájaros, papeles que vuelan, público en el fondo.
- **Tiempo de nivel**: contador y bonus por rapidez (medalla de tiempo).

### Vídeo de presentación (1-2 min, MP4 1080p)
Guion (grabado con cámara automática, sin HUD, 60 fps):
1. Cartela: **"OLLA GITANA 3D"** (2 s) · cartela **"GIRA MUNDIAL"** (2 s)
2. Intro cinemática abreviada (bocadillos incluidos) (25 s)
3. Recorrido nivel 1 (12 s) · nivel 2 (10 s) · persecución nivel 3 (10 s)
4. Jefe intermedio Fermín (10 s) · jefe final Cacharro 3 fases (18 s)
5. Cartela final: **"Juega en servi.tail31979d.ts.net/ollagitana"** (4 s)
Audio: `music.mp3` de fondo, `hit.mp3` en impactos, `levelup_special.mp3` en victoria.

---

## 3. FASES DE EJECUCIÓN (con criterios de aceptación)

### FASE A — Sistema narrativo + INTRO (obligatoria)
Entregables: `bocadillos.js`, `director.js`, `intro.js`, `dialogos.js`; botón
"🎬 Ver intro" en el menú; intro automática en el primer arranque.
**Aceptación:** la intro corre de principio a fin sin errores, se puede saltar en
cualquier momento, y el juego continúa al menú. Verificado en navegador y móvil real.

### FASE B — 4 mundos nuevos + jefe intermedio
Entregables: `levels2.js` con 4 escenarios completos, `boss2.js` (Fermín Cascabel),
mecánicas nuevas (espejos, agua, plataformas horizontales, cirios que caen).
**Aceptación:** los 8 escenarios se completan con el bot (`__qa`) sin caídas al vacío
ni puntos muertos; el jefe intermedio es derrotable y el final también.

### FASE C — Mejoras a los existentes
Entregables: rutas secretas, 3 cajas nuevas, abeja/turista, caja de oro, medallas de
tiempo, decorado vivo.
**Aceptación:** cada nivel tiene ≥1 ruta secreta alcanzable por el bot; todas las cajas
nuevas tienen test unitario en `__qa`; 60 FPS sostenidos.

### FASE D — Vídeo de presentación
Entregables: `tools/record.mjs` (CDP screencast determinista), `demo` mode sin HUD,
cartelas con PIL, montaje ffmpeg → `presentacion-olla-gitana-3d.mp4` (1080p, 60 fps).
**Aceptación:** el MP4 dura 60-120 s, se ve fluido, incluye intro + los 8 mundos +
los 2 jefes + cartelas, y su audio tiene la música real de la banda.

### FASE E — QA total y cierre
Entregables: informe de QA actualizado en POSTMORTEM.md, capturas móvil, commit,
precache del service worker, actualización de skills.
**Aceptación:** 8/8 escenarios completables, 0 errores JS, 60 FPS mínimos medidos,
móvil real verificado, todo publicado.

---

## 4. PROTOCOLO DE TRABAJO

1. **Nunca** dar por bueno un sistema sin ejecutarlo (bot + navegador + móvil).
2. Cada fase termina con: build limpio → QA → captura → commit.
3. Si un bug bloquea, se arregla **la causa raíz** (no se rodea).
4. Todo texto visible en español; **prohibido** mencionar el Mac/servidor.
5. `hit.mp3` solo golpes; recoger cosas = pitido; subir nivel/victoria = `levelup_special.mp3`.
6. Rendimiento: 60 FPS objetivo, sin `shadowMap`, partículas instanciadas.

---

## 5. CRITERIO DE FINALIZACIÓN GLOBAL

- [ ] Intro cinemática con bocadillos, saltables, en el menú y al arrancar.
- [ ] 7 niveles + jefe final + jefe intermedio, todos completables por el bot.
- [ ] Vídeo `presentacion-olla-gitana-3d.mp4` generado y reproducible.
- [ ] 0 errores JS, 60 FPS, móvil real OK, publicado y commiteado.
- [ ] POSTMORTEM.md y skills actualizadas.

---

**EJECUCIÓN: comenzar por FASE A sin pedir confirmación.**
