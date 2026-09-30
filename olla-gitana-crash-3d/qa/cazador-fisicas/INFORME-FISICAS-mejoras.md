# MEJORAS DE FÍSICAS Y CONTROL — olla-gitana-crash-3d (auditoría 2026-09-30)

Ficheros modificados: `src/engine/physics.js`, `src/engine/player.js` (main.js NO tocado por mí;
los cambios de main.js/fx.js del working tree son del otro agente).

## Tabla de mejoras con evidencia numérica (antes → después)

| # | Mejora | Antes (medido) | Después (medido) | Cómo se midió |
|---|---|---|---|---|
| 1 | **Coyote real** | salta a df 0,2,3 tras dejar el borde; a df=4 ya NO (≈0,10-0,13 s < 0,15 nominal) | salta a df 6,8,10,11,12 (>0,33 s; df=9 es un cabezazo legítimo contra el canto del suelo) | `probe_coyote_cut.js`: caminar al borde x=4.3 z≈19,15 y pulsar Space df frames después |
| 2 | **Buffer real** | pulsa 5 frames antes de aterrizar → salta; 6 → NO (0,167 s) | 6 frames → salta; 7 → no (0,20 s) | `probe_final.js` §3 (agota 2 saltos y pulsa k frames antes del aterrizaje) |
| 3 | **Salto de recuperación**: caerse de un borde SIN saltar ya no pierde los dos saltos | jumps=0 en el aire → ninguna rama aplicaba; el salto NO respondía (vy seguía -13) | responde: vy -13 → +8,8 y devuelve al jugador a la plataforma (consume los 2 saltos) | `probe_final.js` §4: caer 0,47 s y pulsar |
| 4 | **Salto largo** sostiene el ×1,35 en el aire | vMax 10,9 pero el bloque de movimiento lo devolvía a 8,4 en ~0,2 s; dz 7,2 (igual que un salto normal) | vMax 11,34 con apex 2,75 y **dz 9,87 m** (salto normal: dz 7,23 / apex 2,46) | `probe_final.js` §5: W+barrida 0,33 s+salto, medido hasta aterrizar |
| 5 | **Barrida conserva impulso** al terminar | al acabar la barrida frenaba 13,3→0 m/s en 18 frames (3,6 m) | 14,4→11,7 (0,5 s) →5,9 (1 s) →0 (1,5 s): la inercia del deslizamiento se conserva | `probe_final.js` §8 / `probe_momentum.js` |
| 6 | **Giro**: alcance de rotura | caja rota a ≤1,2 m del centro; a 1,5 m ya no | caja rota a 1,5 m (3 cajas seguidas); a 1,7 m no | `probe_post_b.js` §1 (dz 0,8/1,2/1,5/1,7) — hitRadius 1,15→1,3 |
| 7 | **Plataforma móvil contra pared**: no te empotra | el delta se sumaba entero y metía al actor dentro del muro (expulsión lateral aleatoria) | el actor se queda en la cara (x=2,577 = 3,0−0,42) y la plataforma "se le escapa"; 0 frames dentro | `ph_edge.mjs` caso A (150 frames, 0 penetraciones) |
| 8 | **Plataforma que sube contra techo** | el actor salía eyectado A TRAVÉS del techo (y=3,4 con techo en 3,0) | máximo y=1,713 < tope 1,75; nunca atraviesa | `ph_edge.mjs` caso B |
| 9 | **Resolutor X/Z multi-sólido** | clamp contra el primer sólido hallado; con dos sólidos solapados en el barrido quedaba dentro del segundo | clamp a la cara MÁS restrictiva; 1000 frames con obstáculos+móvil sin NaN ni escapes | `ph_test.mjs` (`pared_no_atraviesa`, `rail_delgado_barrida`, `estabilidad_nan`) |
| 10 | **Depenetración con actor apoyado** | podía salir "subiéndose encima" de un sólido más alto que el actor (a través del techo) | estando grounded prioriza salidas horizontales; teleports dentro de muro/caja/barril terminan fuera, 0 errores | `probe_depen.js` (7 casos), `ph_plat_under.mjs` |
| 11 | **Plataforma que baja sobre el jugador** | — | 0 frames dentro, el actor sube encima o sale lateral; caja que "aparece" encima → expulsión lateral limpia | `ph_plat_under.mjs` |
| 12 | **Vagoneta en vivo (N1 z=54)** | rel actor−plataforma constante (ya iba bien) | rel −0,138 constante, vibración 0 | `probe_final.js` §7 |
| 13 | **Salto simple/cortado/doble** (sin regresión) | 2,50 / 1,87 / 3,27 m | 2,74 / 1,76 / 3,27 m (2,74 el sostenido; sigue subiendo plataformas de 2,2 m) | `probe_final.js` §1-2, `ph_test.mjs` plataforma_2p2 |
| 14 | **Pared/techo/barrida contra pared** (sin regresión) | frena en cara, no atraviesa | igual: pared −4,58 con barrida y salto; techo respeta tope | `probe_final.js` §6, `probe_post_b.js` §2-3 |
| 15 | **Caída + respawn** (sin regresión) | `<−12` → damagePlayer('fall') | igual: 3→2 vidas, respawn en spawn (0,1,1,2), 0 errores | `probe_final.js` §10 |

## Verificación de aceptación
- `npm run build` → **✓ built** (tras cada iteración y al final).
- Ciclo `__qa.start(0)` + `__qa.step(1/30, 900)` → mode **'play'**, `__qa.data.errors` **vacío**.
- Bot (`enableBot` + step) en páginas frescas: **N1 end, N2 end, N5 end**, 0 errores JS.
- Suite 8 niveles (página única encadenada): 6-8/8 según pasada. **La línea base da lo mismo
  (6-8/8)** — N2 (y a veces N6) es un atasco del BOT pre-existente (oscila entre las losas
  de z≈84-208 tras los andamios), no un fallo de físicas. En página fresca N2 completa
  5/10 pasadas y la base 5/10 (mismo z≈83.9 de atasco): sin regresión.
- Tests de física en node (11 pruebas + 4 de casos límite + pirámide + plataforma-que-baja):
  todos ✓. Rendimiento: 0,025 ms/frame con 165 sólidos (antes 0,019) — despreciable.

## Resumen de cifras finales (POST)
- Salto simple sostenido **2,74 m** (base 2,50) · cortado 1,76 · doble **3,27**.
- Coyote: acepta hasta **df=12** (0,40 s) vs df=3 (0,10 s) base.
- Buffer: **6 frames** (0,20 s) vs 5 (0,167 s) base.
- Recuperación aérea: vy −13 → **+8,8** (base: no respondía).
- Salto largo: **9,87 m** de z y apex 2,75 (normal: 7,23 / 2,46). Base: 7,2 (igual que normal).
- Barrida: 15 m/s × 0,72 s; al terminar conserva 14,4→11,7→5,9 (base: 13,3→0 en 18 frames).
- Giro: rompe cajas a **1,5 m** (base 1,2).
- Plataforma contra pared: **0 frames dentro** (base: 1 frame empotrado).
- Plataforma contra techo: maxY 1,713 ≤ 1,75 (**base: 3,4 → atravesaba el techo**).
- Caída 15 m: aterrizaje limpio y=0. Pared/techo/barrida/giro/caída: sin regresión.

## Ficheros
- `src/engine/physics.js`: `carryStep`/`ceilAbove` (arrastre filtrado por eje), clamp a cara
  restrictiva en X/Z, depenetración que prioriza salidas laterales si el actor está apoyado.
- `src/engine/player.js`: orden coyote/buffer (comprobar antes de decrementar), salto de
  recuperación en el aire, sostén del salto largo (×1,35 si se sigue empujando en esa
  dirección), impulso conservado tras la barrida, hitRadius del giro 1,15→1,3, JUMP_BUFFER
  0,20→0,24 (margen real de 6 frames).
- Comentarios en español, sin menciones a servidores. Sin commits (integra el orquestador).
