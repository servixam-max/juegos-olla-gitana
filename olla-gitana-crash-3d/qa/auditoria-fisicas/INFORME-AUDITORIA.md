# AUDITORÍA FÍSICAS + MOVIMIENTO DE ENEMIGOS + VIDAS — olla-gitana-crash-3d
(agente auditoría, 2026-10-01. Ficheros tocados: `src/game/enemies.js` y 1 línea en `src/main.js`)

## Bugs encontrados y arreglados

| # | Bug | Evidencia (antes → después) | Fichero |
|---|---|---|---|
| 1 | **INVULNERABILIDAD FANTASMA DEL BUFF**: al expirar los 30 s, `state.invT` se quedaba pegado en el último valor positivo y `damagePlayer` salía SIEMPRE por `state.invT` → el jugador era inmune el resto del nivel (enemigos, trampas, caídas y jefe no hacían nada) | Antes: tras el buff, `invuln=0,4` constante y 2 `__qa.damage()` no quitaban vida (probe: 3→3 vidas). Después: `invuln` 0 tras expirar y cada daño resta 1 (probe: 3→2→1) | `src/main.js` línea 2036 (**1 línea**, ver nota) |
| 2 | **TORO QUE NO EMBESTÍA** (introducido durante esta auditoría al recortar el vaivén: pisé `e.rango`, que en el toro es el RADIO DE EMBESTIDA 11 m, con el objeto de límites) | Antes: `vMax = 3 m/s` (solo paseo, 0 frames de embestida). Después: `vMax = 42-45 m/s` y 85-88 frames de embestida | `src/game/enemies.js` (`e.limites`) |
| 3 | **ENEMIGOS DENTRO DE MUROS/CAJAS o FLOTANDO SOBRE EL VACÍO**: patrol/toro/blindado/globo/abeja movían el vaivén con seno puro sin mirar el mundo; con `span` mayor que el pasillo entraban en el muro (desde dentro te dañaban a través de la pared) o patrullaban sobre los tramos de bloques | Antes: 211 muestras de patrol dentro de muro, 42 de globo, 19 de blindado, 156 de patrol sin suelo en N7. Después: **0 muestras dentro de sólido en los 8 niveles, 0 sin suelo** (excepto el roller, ver "aceptado") | `src/game/enemies.js` (`_encajarBicho`, `_libre`, `_rangoEje`, `_clampR`) |
| 4 | **TURRETA SOBRE EL VACÍO** (N6 x=6,4, tramo de bloques): flotaba en el aire | Antes: 150/150 muestras sin suelo. Después: 0 (anclada a x=3,4, con suelo) | `src/game/enemies.js` (`_anclarTurret`) |
| 5 | **ROLLER/BARRIL REENGANCHABAN SOBRE EL VACÍO**: al acabar el recorrido volvían a `base.z + 8` / `base.z + 6` fijos, que en los tramos nuevos caen en el aire | Ahora `_reinicioRodante()` busca un punto con suelo (y si no lo hay, se quedan donde están). El rodante sigue cruzando baches a propósito (regla del nivel N3) | `src/game/enemies.js` |
| 6 | **ROLLER/BARRIL RODABAN HUNDIDOS** en las losas a 0,24 m | Ahora ruedan a ras del piso real (`groundUnder` con tope 0,6: no trepan a cajas de 0,92) | `src/game/enemies.js` |
| 7 | **ABEJA EN PICADO ATRAVESABA PAREDES**: el picado se lanza hacia el jugador sin comprobar el mundo | Ahora si el paso siguiente no está libre, no se mete (seguía el eje y baja igual) | `src/game/enemies.js` |

### Nota sobre `main.js` (imprescindible, 1 línea)
La restricción era no tocar `main.js` salvo imprescindible. El bug #1 (inmunidad fantasma) es un
fallo de lógica en una sola línea y **no se puede arreglar desde mask.js** (el valor rancio vive
en `state.invT`). Cambio exacto:

```js
// antes (el último valor >0 se quedaba pegado para siempre):
maskCompanion.invT > 0 && (state.invT = maskCompanion.invT);
// ahora:
state.invT = maskCompanion.invT > 0 ? maskCompanion.invT : 0;
```

## Tabla de comprobaciones (medidas con `__qa`, dt=1/30, rAF pausado)

| Comprobación | Resultado |
|---|---|
| Muros N1: barrida 15 m/s + giro + salto largo contra muro (cara interior 5,0) | maxX = **4,58 / 4,58 / 4,262** (jugador r=0,42 → límite 4,58). 0 frames dentro |
| Muros N5 (cara 7,0) y N1 z=100 | maxX = **6,58** y **4,58**; 0 frames dentro |
| Caída de 30 m (vy −30) | aterriza en y=0,24 (tope más alto de la zona) sin hundirse; 45 frames |
| Caída pegada al muro (el bug histórico) | x = 4,58, no cruza |
| Bache z=20: cruce saltando | z pasa de 16 → 31,1 con yMin 0 (no cae) |
| Bache: caída sin saltar | y baja a −3,4 (sigue al killY −18 → daño por caída legítimo) |
| Plataforma móvil vagoneta N1 (180 frames) | jitter **0,000 m**, 100 % grounded |
| Plataforma barriendo contra jugador parado (240 frames) | minDist 1,49 m (te sube encima), **0 frames dentro** |
| **Enemigos**: 8 niveles × ~3.000 muestras | **0 dentro de sólidos, 0 sin suelo** (roller N3 exceptuado, ver abajo) |
| Toro: ciclo paseo→aviso→embestida→aturdido (N1/N2, 900 frames) | vMax **42-45 m/s**, 85-88 frames de embestida, vuelve a paseo |
| Blindado: envite (N1/N5) | vMax **60 m/s** (saltitos + aturdimiento), vuelve a paseo. Nunca muere por pisotón |
| **Contacto**: a 3 m y a 1,5 m de una patrulla (5 s cada uno) | **0 daños** (no daña a distancia) |
| **Contacto**: pegado a la patrulla | 1 daño (`reason: enemy`), 3→2 vidas |
| Giro contra patrulla | la mata (7→6 patrullas), 0 vidas perdidas |
| **Vidas**: 1 daño = 1 vida | 3→2 (no 2 vidas por golpe); invT = 2,2 s |
| Vidas: ciclo 3 vidas → super-vida → continue → game over | 3→(supervida: 1→0)→(continue: rellena 5 y gastando 5 más)→**game over** con progreso borrado (5💛/3⏩ y `desbloqueados:1`) |
| Caída al vacío sin godMode ×3 | resta **1 vida cada vez** y respawnea en spawn (z=2) |
| Caída de 30 m sobre suelo firme | **no** quita vida |
| **Buff del puro** (2 puros, teleport a `purosPos`) | nivel 2, invT 29,6 s, **speed 1,35, jump 1,22** |
| Buff + `__qa.damage()` ×3 | **3→3 vidas, 0 entradas nuevas en damageLog** |
| Buff + caída al vacío (teleport y=−25) | 3→3 vidas |
| Buff + contacto con enemigo (90 frames) | 3→3 vidas, 0 daños |
| Buff tras expirar → 2 daños espaciados | 3→2→1 (el daño vuelve: bug #1 corregido) |
| **Trampas** (cuchillas N8): fuera de la banda (z+2,5, 6 s) | **0 daños** |
| Trampas: dentro de la banda | 1 daño `reason: trampa` |
| Trampas: grace inicial | 0 daños en los primeros 1,6 s |
| Build | `npm run build` → **✓ built** |
| Errores JS en todas las pruebas | **0** |

## Aceptado / fuera de alcance (no es un bug)
- **roller de N3** (x=−1,2) roza cajas (z≈92 y 238) y el barril (z≈188) al bajar rodando: NO se
  esquiva, es un obstáculo rodante que atraviesa el pasillo; las cajas son rompibles y el
  contacto no hace daño de más. Sin suelo en 83/900 muestras: **es su diseño** (los niveles lo
  colocan también sobre tramos de bloques y en N3 el barril debe cruzar baches).
- **N2 y N7 (|x| 15-16)**: no hay muro que atravesar — esas zonas son calzadas de 13-16 m de
  ancho SIN paredes laterales en el tramo de z=30; el jugador sale del borde y cae al vacío
  (daño por caída y respawn, comportamiento previsto). En N2/N7 el `corridor` solo cubre parte
  del nivel (0-44 / 0-D.fin).
- **Suite 8 niveles con bot**: 4-7/8 por ronda, **0 errores** siempre. Los fallos son atascos del
  BOT en z de las extensiones nuevas (≥240-420) y en la persecución de N3 — **pre-existentes**:
  verificado A/B con PRNG sembrado (6 semillas × 8 niveles): **HEAD 32/48 vs MI versión 35/48**,
  sin regresión. La referencia del proyecto ya documenta este bot flaky.

## Ficheros
- `src/game/enemies.js`: contención al escenario (`_encajarBicho`, `_libre`, `_rangoEje`,
  `_clampR`, `_anclarTurret`, `_reinicioRodante`, `_sueloAdelante`, `_solidoEn`), clamps en
  patrol/toro/blindado/globo/abeja/picado, `pisoY` para que caminen a ras de las losas de 0,24 m,
  rodantes a ras del piso y reenganche con suelo. Renombrado `e.limites` (no pisar `e.rango` del toro).
- `src/main.js`: 1 línea (bug #1 de invulnerabilidad fantasma).
- `qa/auditoria-fisicas/`: harness `run.mjs` + 20 probes con sus resultados en `*.result.json`
  (física, muros, plataformas, enemigos, toro, ciclos, contacto, vidas, buff, trampas, suites,
  A/B con semillas).
- NO se han tocado: `levels*.js`, `textures.js`, `boss*.js`. Sin commits.
