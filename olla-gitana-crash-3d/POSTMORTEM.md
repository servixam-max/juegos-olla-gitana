# POSTMORTEM — Olla Gitana 3D v2.0 "GIRA MUNDIAL"

**Carpeta:** `/Volumes/465GB/migrated/juegos/olla-gitana-crash-3d`
**Estado:** 8 escenarios (7 niveles + jefe intermedio + jefe final), intro cinemática con
bocadillos, vídeo de presentación, 60 FPS, 0 errores JS. **8/8 recorribles, 2/2 jefes derrotables.**

---

## 1. Instrucciones de ejecución

```bash
cd /Volumes/465GB/migrated/juegos/olla-gitana-crash-3d

npm run dev            # http://localhost:5199  (--host: accesible desde el móvil)
npm run build          # build estático en dist/
npm run preview        # sirve dist/

# Modos especiales
#   ?bot=1     → QA automático (API __qa)
#   ?demo=1    → modo grabación del vídeo (API __demo)
#   (primer arranque → intro cinemática; botón "🎬 Ver intro" en el menú)

# Grabar el vídeo de presentación (Chrome + ffmpeg)
node tools/record.mjs                       # → presentacion-olla-gitana-3d.mp4
node tools/record.mjs http://localhost:5199 salida.mp4
```

### API de QA (`?bot=1`)
```js
__qa.start(n)          // arranca el escenario n (0..7)
__qa.enableBot()       // bot que recorre, esquiva enemigos y evita cajas peligrosas
__qa.godMode(true)     // invulnerable (QA estructural: ¿se llega a la meta?)
__qa.step(1/30, 6000)  // simula N pasos SIN depender de requestAnimationFrame
__qa.state()           // { mode, level, lives, pos, notas, cajas, boss, ferminPending }
__qa.data.errors       // errores JS capturados
__qa.data.damageLog    // causa de cada daño (fall/enemy/blast/van/boss/fermin)
__qa.minFps() / avgFps()
```

### Controles
| Acción | Teclado | Móvil | Mando |
|---|---|---|---|
| Moverse | `←→↑↓` / `WASD` | stick izq. | stick izq. |
| Saltar / doble salto | `Espacio`/`Z`/`K` | SALTO | A/✕ |
| Giro (atacar) | `X`/`Shift`/`L` | GIRA | X/□ |
| Barrida | `C`/`Ctrl`/`B`/`J` | BARROR | B/○ |
| Salto largo | saltar durante la barrida | — | — |
| Pausa | `P`/`Esc` | botón ⏸ | Start |

---

## 2. Dependencias

| Paquete | Versión | Uso |
|---|---|---|
| `three` | 0.186.1 | motor 3D (WebGL) |
| `canvas-confetti` | 1.9.4 | confeti de victoria |
| `ws` (dev) | última | grabador del vídeo (CDP) |
| `vite` (dev) | 8.3.1 | bundler + servidor |
| `ffmpeg` (sistema) | 9.0.2 | montaje del MP4 |
| Chrome/Chromium | sistema | captura para el vídeo |

Instaladas con `npm i` dentro del proyecto (sin globales ni sudo). Node v26.9.0.
**Sin librería de físicas externa**: AABB propia con resolución por ejes.

---

## 3. Árbol de archivos

```
olla-gitana-crash-3d/
├── index.html · vite.config.js · package.json · POSTMORTEM.md · SUPERPROMPT-v2.md
├── presentacion-olla-gitana-3d.mp4    # vídeo generado (1280×720, 30fps, H.264+AAC)
├── public/assets/                      # 19 assets de la banda (fondos, música, sfx)
├── tools/record.mjs                    # grabador (Chrome headless + CDP + ffmpeg)
└── src/
    ├── main.js                         # orquestador (bucle, niveles, QA, demo)
    ├── styles.css                      # HUD, paneles, cinemáticas (letterbox, títulos)
    ├── engine/
    │   ├── input.js                    # teclado + gamepad + táctil (poll con flancos)
    │   ├── physics.js                  # mundo AABB, plataformas móviles, resolución
    │   ├── player.js                   # controlador Crash
    │   ├── audio.js                    # rumba generativa + SFX + samples
    │   ├── fx.js                       # partículas (InstancedMesh), shake, confeti
    │   └── hud.js                      # vidas, notas, cajas, combo, cronómetro, power-ups
    ├── game/
    │   ├── art.js                      # arte procedimental (olla, cajas, atrezzo, jefes)
    │   ├── levels.js                   # mundos 1-3 + arena del jefe final
    │   ├── levels2.js                  # mundos 4-7 (nuevos)
    │   ├── crates.js                   # cajas: normal/TNT/Nitro/?/!/✔/acero/hierro
    │   ├── enemies.js                  # patrulleros, turret, rodantes, abejas, lámparas, cirios
    │   ├── pickups.js                  # notas y máscaras (aura rumbera)
    │   ├── boss.js                     # EL CACHARRO (jefe final, 3 fases)
    │   └── boss2.js                    # FERMÍN CASCABEL (jefe intermedio)
    ├── narrative/
    │   ├── dialogos.js                 # guion completo (intro, entre-niveles, jefes, final)
    │   ├── bocadillos.js               # SpeechBubble 3D + DialogQueue
    │   ├── director.js                 # cámaras cinemáticas, letterbox, fundidos
    │   └── intro.js                    # escena de la intro (banda, pantalla del villano)
    └── video/
        └── demo.js                     # guion del vídeo y su director de cámara
```

---

## 4. Contenido del juego

### Historia
*El Cacharro* (empresario del sonido) roba las **7 notas** de la banda y las reparte
por Murcia. La **olla** sale a recuperarlas. Final: duelo en el escenario.

### Los 8 escenarios
| # | Nombre | Tema | Mecánica nueva | Tag |
|---|---|---|---|---|
| 1 | El Ensayo Callejero | Catedral | charcos resbaladizos, cajas básicas | FÁCIL |
| 2 | Ruta al Festi | Andamios | plataformas oscilantes, focos, ondas | NORMAL |
| 3 | Furgoneta Desbocada | Carretera | **persecución** (la furgo no perdona) | DIFÍCIL |
| 4 | **La Procesión** | Semana Santa | **plataformas horizontales + cirios que caen** | NORMAL |
| 5 | **El Entierro de la Sardina** | Desfile nocturno | **jefe Fermín Cascabel** + humo que empuja | JEFE 1 |
| 6 | **La Huerta Perdida** | Huerta | **acequias que frenan, ramas, abejas** | DIFÍCIL |
| 7 | **El Casino de Murcia** | Casino modernista | **suelo pulido, lámparas, espejos que aparecen** | MUY DIFÍCIL |
| 8 | Duelo en el Escenario | Escenario | **jefe final Cacharro, 3 fases** | JEFE FINAL |

### Mecánicas
- **Controlador Crash**: gravedad variable, doble salto, giro (0.4 s activo), barrida,
  salto largo tras barrida, pisotón, sombra proyectada, inclinación al girar.
- **8 tipos de caja**: normal, TNT (mecha 3 s), Nitro (al tacto), ? (5 rebotes con notas),
  ! (interruptor), ✔ (checkpoint), acero (2 golpes), hierro (solo pisotón).
- **Coleccionables**: notas musicales + máscaras (3 = **aura rumbera**: invencible,
  +22 % velocidad, imán, música a tope con más tempo).
- **Enemigos**: amplis patrulleros, altavoces-turret (ondas sonoras), amplis rodantes,
  **abejas** (zigzag aéreo), **lámparas oscilantes** (Casino), **cirios que caen** (Procesión).
- **Narración**: bocadillos 3D con efecto máquina de escribir y pitidos por sílaba
  (estilo Animal Crossing; nunca `hit.mp3`, que es solo para golpes).

### Jefes
- **Fermín Cascabel** (mundo 5): ampli gigante con bigote que baila sevillanas al compás
  (108 BPM) y lanza ondas dobles. Se le daña **saltando en la cabeza** cuando está
  vulnerable (ojos rojos) o devolviéndole ondas con el giro. 3 golpes. Aparece al llegar
  al final del desfile (z=74) con su cutscene de entrada.
- **El Cacharro** (mundo 8): torre de altavoces con pantalla-cara. 3 fases:
  ondas lentas → ráfaga doble + salto → ondas rápidas + lluvia de cajas. Se le daña
  **devolviendo sus cajas con el giro** o con pisotón. 3 golpes. 6 vidas para el jugador.

### Narración (sin voces)
- **Intro cinemática (≈48 s)**: luces → concierto (la banda toca) → **silencio dramático**
  (la música se corta y las notas se apagan una a una) → discurso del Cacharro
  (bocadillos) → huida de la olla → título "GIRA MUNDIAL". Saltable con ESC/botón.
- **Cutscenes entre niveles**: cada mundo termina con un diálogo que avanza la historia.
- **Frases en juego**: al coger notas (cada 10), romper cajas, coger máscaras, aura y daño.
- **Cartel de mundo**: "MUNDO n · NOMBRE" al empezar cada nivel.

---

## 5. Hallazgos de QA (bug real → arreglo)

### Tanda 1 (prototipo) — 12 bugs
1. **Controles invertidos**: `ArrowUp` movía hacia atrás. → `z:+1` adelante; stick táctil `-touch.y`.
2. **Cámara del nivel 3 al revés** → ahora detrás y alta.
3. **Furgoneta imparable** (crecía sin tope) → tope 7.0 px/s < tope del jugador (8.4).
4. **La furgo mandaba al vacío** → empujón hacia adelante + `vanGrace` 2.2 s.
5. **Caída del ring del jefe** → vallas de 2.4 m, ring 48×48.
6. **Huecos sin cubrir** (N1/N2) → plataforma oscilante a todo lo ancho.
7. **Nivel 3 con huecos** (injusto con furgo) → carretera continua.
8. **Daño múltiple en el vacío** → respawn con invulnerabilidad.
9. **Cobertura del jefe imprecisa** → raycast segmento-rectángulo (slab method).
10. **`setTimeout` no corre en simulación** → cola `state.pending`.
11. **Fondo invisible** (single-sided) → `DoubleSide`.
12. **HUD no actualizaba notas / el contador de cajas se reseteaba**.

### Tanda 2 (v2) — 13 bugs
13. **Bocadillos invisibles**: el sprite nunca se añadía a la escena → `scene.add()` en el
    constructor. Era el bug que hacía que la intro saliera sin texto.
14. **Bocadillos sin hablante** caían al origen (0,0,0) → modo pantalla: delante de la cámara.
15. **Recursión infinita en el demo** (`demoTick→tick→demoStep→demoTick` → "Maximum call
    stack size exceeded" ×300) → guardia `_inUpdate` + el demo manda desde `tick()`.
16. **La meta no se activaba** al pasar de largo → radio 3.6 + `z > meta+1.5`.
17. **La meta del mundo 5 se cerraba con Fermín pendiente** → `checkGoal` bloqueado hasta derrotarlo.
18. **Fermín no aparecía** (lógica mal atada a la meta) → `ferminPending` + aparición al llegar a z=74.
19. **La cabeza de Fermín no se alcanzaba** (pedía y>4.6; el jugador salta a ~3.2) →
    umbral 3.2 con `vel.y < -1` y también daño por giro.
20. **Los cirios invadían la cámara** (caían en el centro del pasillo) → solo a los lados (±4.6).
21. **El humo bloqueaba el paso** (era sólido) → `solid = false`, solo empuja.
22. **El HUD salía en el vídeo** → `hud.show(false)` cada frame en modo demo.
23. **La pantalla de fin de nivel salía en el vídeo** → `endLevel` bloqueado en modo demo.
24. **La escena de la intro no existía en modo demo** → el demo llama a `intro.build()` y
    gestiona la visibilidad de la escena y de la pantalla del villano.
25. **El encuadre del villano apuntaba al vacío** → pantalla agrandada (9×6) y cámara a z=4.5.

### Cómo se detectó
Todo con el **bot de QA** (`__qa.step` simula sin depender de `requestAnimationFrame`, que
en headless se congela) + `__qa.data.damageLog` (causa de cada daño). Sin ese registro no se
habría sabido que el nivel 6 fallaba por abejas o que el bot moría contra cajas Nitro.

---

## 6. Verificación final

| Prueba | Resultado |
|---|---|
| 8 escenarios recorribles (bot + modo dios) | **8/8** |
| Jefe final (Cacharro) derrotado | ✅ hp 3→0 |
| Jefe intermedio (Fermín) derrotado | ✅ hp 3→0 |
| Errores JS en los 8 niveles | **0** |
| FPS (rAF real, bot corriendo) | **60 avg / 56 min** |
| Intro cinemática completa + saltables | ✅ |
| Bocadillos con texto (intro, jefes, entre niveles) | ✅ |
| Vídeo `presentacion-olla-gitana-3d.mp4` | ✅ 1280×720, 30 fps, ~92 s, H.264+AAC |

---

## 7. Rendimiento y decisiones técnicas

- **60 FPS** con partículas `InstancedMesh` (pool 300), sin `shadowMap` (blob shadow).
- Materiales **toon** con un único gradiente compartido.
- **Sin librería de físicas externa**: AABB propia con resolución por ejes (deslizamiento lateral).
- **Sin setTimeout/setInterval en la lógica**: cola `state.pending` (así la simulación headless
  reproduce el juego real) y animaciones por tiempo de juego.
- Bocadillos con **CanvasTexture** (no HTML): se integran con la cámara 3D y salen en el vídeo.
- El **vídeo** se genera capturando la página con CDP a 30 fps fijos (no screencast, que pierde
  frames) y montando con ffmpeg + la música real de la banda.

## 8. Publicación
- Build en `dist/` → copiado a `olla-gitana-crash-3d-servido/` (ruta de Caddy).
- Tarjeta en el menú de los juegos ("Olla Gitana 3D", NUEVO · 3D).
- Ranking propio: `game=crash3d` (mismo backend de la banda).

## 9. Para retomar
```bash
npm run dev
# ?bot=1 → __qa.start(i) + __qa.enableBot() + __qa.step(1/30, 6000)  → los 8 en 'end'
# ?demo=1 → ver el guion del vídeo
node tools/record.mjs    # regenerar el vídeo
```
