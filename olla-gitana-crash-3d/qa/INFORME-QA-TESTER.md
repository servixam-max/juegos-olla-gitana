# INFORME QA — Olla Gitana 3D (testeador automático)

**Fecha:** 2026-09-30 · **URL:** http://localhost:5199/?bot=1 · **Entorno:** macOS, Chrome headless (ANGLE Metal, Apple M4), viewport escritorio 1280×633 y móvil 390×844 (DPR 3).
**Método:** API `__qa` (start/enableBot/godMode/step/state/diag/moviles/sonda/teleport) + `__qa.step()` para simular sin rAF + input sintético por eventos de teclado reales para las pruebas de jugador humano. Cada nivel se probó en **página nueva**.
**Nota de método importante:** en este headless el `requestAnimationFrame` está congelado (`visibilityState=hidden`, 0 frames/2s) y los FPS no son medibles con el flujo documentado. Se desbloqueó con CDP (`Emulation.setFocusEmulationEnabled` + `Page.bringToFront`) para poder medir FPS reales.

Evidencia cruda: `qa/qa_tester_suite_*.json`, `qa/qa_tester_danos_por_nivel.json`, captura `qa/qa_tester_evidencia_fuera_pared.png`.

---

## 1. SUITE ESTRUCTURAL (dios, bot, 3×8 = 24 corridas) — **PASA con asterisco**

| idx | nivel | 3 corridas → modo | tiempo simul. hasta `end` | notas | cajas | errores JS |
|---|---|---|---|---|---|---|
| 0 | El Ensayo Callejero | end / end / end | 33,2 s | 2 | 0/40 | 0 |
| 1 | Ruta al Festi | end / end / end | 30,1 s | 8–14 | 2–9/29 | 0 |
| 2 | Furgoneta Desbocada | end / end / end | 30,4 s | 13 | 1/7 | 0 |
| 3 | La Procesión | end / end / end | 26,0 s | 14 | 5/23 | 0 |
| 4 | El Entierro (Fermín) | end / end / end | 31,8 s | 5 | 2/15 | 0 |
| 5 | La Huerta Perdida | end / end / end | 29,2 s | 9 | 6/28 | 0 |
| 6 | El Casino | end / end / end | 25,7 s | 9 | 6/21 | 0 |
| 7 | Arena Cacharro | end / end / end | 32,2 s | 0 | — | 0 |

**24/24 `end`, 0 errores JS, 0 errores de consola.** Ningún nivel se atasca.

**ASTERISCO (FALLA de legitimidad):** en **24/24 corridas del nivel 1** el bot termina **fuera del pasillo**, en `x = −6,62` (cara exterior de la pared izquierda = −5,6 − 0,6 − 0,42). El bot no recorre el nivel: sale disparado por un bug de física (ver TOP BUGS nº1) en el primer doble salto y corre el resto del nivel por detrás de la pared, activando la meta desde fuera (`z > 147+1,5`). El "8/8 recorribles" del POSTMORTEM está **contaminado** en el nivel 1.

## 2. SUITE SIN DIOS (juego real) — **PASA** (con 2 muertes de bot por 32 corridas)

- Primera pasada (8 corridas, 1 por nivel): **8/8 `end`**, vidas finales 1–3.
- Segunda pasada (16 corridas, 2 por nivel, continuando a través de cinemáticas): **15/16 `end`, 1/16 `over`** — muere en el Casino (idx 6) con 0 vidas. En una tercera pasada el nivel 1 (Ruta al Festi) también murió una vez. Ambos niveles se completan en otras corridas → **todos los niveles son superables sin dios**.
- **Cero atascos** en todas las corridas (máx. 9000 pasos = 300 s simulados).
- Causas de daño registradas (`data.damageLog`), 16 corridas: `enemy` 8, `blast` 6, `fermin` 2, `boss` 2. También se registró `van` (furgo) y `fall` en pruebas puntuales. Ningún daño con causa desconocida.
- El mismo escape del nivel 1 ocurre también sin dios (`x=−6,62`).

## 3. ESTRÉS (30 s encadenando giro+barrida+salto+zigzag) — **PASA**

4 corridas de 30 s en Casino (idx 6) y Furgoneta (idx 2), con y sin dios:
- **0 errores JS, 0 errores/avisos de consola, 0 NaN** en posición o velocidad.
- Nunca cayó del mundo (`yMin = 0`), altura máxima 3,6 m, sin atascos.
- Furgoneta: 1 daño de furgo; a los 30 s seguía avanzando en `play` (z 4→195,7) — no terminó por tiempo, no se quedó.
- Casino: desplazamientos laterales hasta |x|=6,59 pero **dentro de su suelo de 16 m de ancho** (no es fuga).

## 4. JEFES — **PASA (derrotables)** / **FALLA (fase 2 inexistente)**

- **Fermín (idx 4):** HP 3 → 2 (t=24 s) → 1 (t=29 s) → **0 (t=30,3 s)**, `end` a los 37,3 s con cutscene. Derrotado por el bot solo a base de pisotones/giros.
- **Cacharro (idx 7):** HP 3 → 2 (t=12 s) → 1 (t=17,3 s) → **0 (t=24 s)**, `cine` → `end` a los 31,9–32,2 s. Derrotado.
- **FALLA:** las transiciones fueron `hp3/fase1 → hp2/fase1 → hp1/fase3`. **La fase 2 nunca ocurre** (bug de fórmula en `boss.js` L62: `3 - hp + 1 >= 3` → 1,1,3 en vez de 1,2,3). El Cacharro salta de la fase 1 a la 3 sin las "ráfagas dobles + salto".
- En la arena hay daños registrados `boss` (2 en 16 corridas) y `enemy`; el bot no explota ni se bloquea.

## 5. COLISIONES — **FALLA** (paredes no contienen; suelo bien)

- **Teleport (7; 0,3; 40)** en N1: el jugador aparece **fuera de la pared derecha** (`x≈6,98`) y sigue corriendo por fuera (z 69,9 a los 5,3 s) sin límites del mundo ni reseteo. No hay contención fuera del pasillo.
- **Teleport (0; 15; 4)** en N1: **aterriza correctamente** a los 1,0 s (`y=0`, `grounded=true`, sin caída al vacío). PASA.
- **Empuje real contra la pared izquierda** (teclado `←` desde (0;0,3;40)): a ~2 s el jugador está en **`x=+6,62` (pared opuesta)**, teleportado a través del pasillo. FALLA.
- **Sondas:** pared sólida presente en (±5,6; 2,7; z) con half 0,6×2,7×6; **techo invisible** (`tag:roof`, y 4,6–5,1, ancho ±5,6) confirmado en z 16–96 del nivel 1; fuera del pasillo no hay sólido.
- **Plataformas móviles:** se mueven todas — N2 (idx 1) 11/11, Procesión (idx 3) 6/6, Huerta (idx 5) 11/11 en 5 s de simulación. PASA.

## 6. RENDIMIENTO (FPS reales, rAF desbloqueado por CDP) — **PASA**

| idx | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| avg | 60 | 57,8* | 60 | 60,5 | 59,8 | 60,2 | 59,5 | 60 |
| min | 60 | 29* | 60 | 60 | 58 | 60 | 54 | 60 |

\* idx 1 medido con el bot corriendo tras una recarga (una muestra baja de 29). En el resto, 54–60 min. Equipo: Apple M4 / ANGLE Metal, 1280×633. **Se confirma el ~60 FPS del POSTMORTEM** (con la salvedad de que en headless estándar el rAF está congelado y no se puede medir sin CDP).

## 7. MÓVIL vertical 390×844 (DPR 3) — **PASA con asterisco**

- **24/24 corridas god → `end`, 0 errores JS**, mismos tiempos que en escritorio.
- **Mismo escape del nivel 1** (3/3 corridas terminan en `x=−6,62`).
- Limitación honesta: no probé los controles táctiles reales ni FPS en móvil (solo el bot con viewport móvil).

---

## TOP BUGS ENCONTRADOS (por gravedad)

### 1. CRÍTICO — El "techo invisible" del nivel 1 teletransporta al jugador atravesando la pared
En el nivel 1 hay cajas sólidas invisibles (`tag:'roof'`, techo del pasillo, z 16–96) que **solo** se resuelven en el eje Y al caer/subir verticalmente. Si el jugador está **en el aire con velocidad lateral** y su cabeza cruza el borde inferior del techo (pies > 3,37 m, p. ej. con **doble salto**), `resolveActor` (physics.js, eje X/Z) lo detecta "dentro" de la caja y lo expulsa **por el lado contrario al de avance**, atravesándola. Evidencia exacta (nivel 1, un frame de 1/30 s):
`antes {x:1,137; y:3,226; z:18,70; vx:4,67; vz:5,35}` → `después {x:−6,02; y:3,444; z:11,58; vx:0; vz:0}` — Δx=−7,16 m y Δz=−7,12 m en un solo frame. −6,02 = `mn.x − r` del techo y 11,58 = `mn.z − r` de la pared contigua: el jugador acaba **detrás de la pared izquierda** (x=−6,62 = cara exterior) y desde ahí recorre/termina el nivel.
**Reproducido con teclado real** (correr + doble salto bajo el techo, z=16): expulsión en 0,7 s al mismo punto (−6,02; 3,45; 11,58) y final del nivel en x=−6,62. Afecta al 100 % de las corridas del bot (24 escritorio + 24 móvil) y también sin dios. Es el primer nivel del juego y el jugador hace dobles saltos constantemente bajo ese techo (z 16–96: cajas, notas…).

### 2. ALTO — La meta del nivel 1 se activa desde fuera del pasillo
`checkGoal`: `if (d < 3.6 || player.pos.z > goal.z + 1.5) endLevel(true)` — la condición de z **no comprueba x**: cualquiera que llegue a z>148,5 gana, aunque esté detrás de las paredes (como el bot vía bug nº1). Combinado con nº1, el nivel 1 se "pasa" sin recorrerlo. Igual de relevante: el bot de QA **nunca** jugó el nivel 1 por dentro → la cobertura de QA de ese nivel es falsa.

### 3. ALTO — Colisión de identificadores de nivel: la arena del jefe usa id=4
`buildBossArena` (levels.js) devuelve `id: 4`, el mismo que "La Procesión" (idx 3). Confirmado: `state().level` = 4 en idx 7. Consecuencias medidas: `localStorage` guarda récords bajo la clave `"4"` para ambos niveles (verificado: jugar idx 3 y luego idx 7 escribe/pisa `{"4":{...}}`), y el ranking usa `diff: "n4"` para los dos → las puntuaciones de la arena del jefe se mezclan con las de la procesión.

### 4. MEDIO — La fase 2 del Cacharro es inalcanzable
`boss.js` L62: `const newPhase = 3 - Math.max(0, this.hp - 1) >= 3 ? 3 : Math.max(1, 3 - this.hp);` produce fases 1, 1, 3 (hp 3, 2, 1). Traza real: `hp3/f1 → hp2/f1 → hp1/f3`. El jefe nunca usa el patrón de fase 2 ("ráfaga doble + salto") descrito en el POSTMORTEM.

### 5. MEDIO — El bot de QA no puede recorrer el nivel 1 (cobertura rota)
Como consecuencia del nº1, el 100 % de las corridas del bot terminan fuera del pasillo. Cualquier métrica de QA del nivel 1 (notas, cajas, tiempo, "recorrible") no refleja el juego real. Conviene arreglar el nº1 antes de fiarse de esta suite.

### 6. BAJO / PROCESO — Los FPS no se pueden medir en headless con el flujo documentado
Con `?bot=1` y Chrome headless normal, rAF está congelado (0 frames/2 s, `visibilityState:hidden`): `avgFps()/minFps()` devuelven `null`. Hay que desbloquear con CDP (`Emulation.setFocusEmulationEnabled(true)` + `Page.bringToFront`) para medir 60/54–60. No está documentado en POSTMORTEM/SUPERPROMPT.

### 7. BAJO — `__qa.state().level` devuelve el *id* del nivel, no su índice
`{level: 4}` tanto para idx 3 como para idx 7 — ambiguo para QA y fue lo que ocultó el bug nº3 (las suites "3×8" parecían consistentes). Mejor exponer ambos.

---

## Lo que NO se pudo probar (honestidad)
- Controles táctiles reales en móvil (stick/botones): solo se probó el bot con viewport móvil.
- FPS en móvil (no medidos; solo escritorio).
- Intro cinemática, menús, ranking y narración: fuera del alcance de esta suite (solo se usó `?bot=1`).
- No se modificó ni una línea de código del juego: esto es solo reporte.
