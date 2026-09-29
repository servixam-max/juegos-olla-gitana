# Game Specifications: Olla Gitana: El Juego

## Concept
- **Genre:** Mobile-first arcade minigame.
- **Theme:** Canalla/Murcian humor. Catch good ingredients for an "Olla Gitana" stew, avoid toxic items.
- **Player:** Controls a pot ("Olla") at the bottom.
- **Goal:** Maximize score by catching ingredients. Avoid 3 hits (lives). Progressive difficulty.

## Mechanics
1.  **Controls:** Touch/Mouse (horizontal slide). Restricted to screen bounds. Smooth movement.
2.  **Physics:** Objects fall from top (random X position). Speed increases with levels.
3.  **Collision:** Axis-Aligned Bounding Box (AABB) or circle collision between Pot and Falling Objects.
4.  **Good Objects (+10 pts):** 🎃 (Calabaza), 🍐 (Pera), 🌿 (Hierbabuena), 🧆 (Garbanzos), 🌶️ (Pimentón).
5.  **Bad Objects (-1 Life):** 💊 (Pastillas), 💉 (Jeringuillas), 🚬 (Cigarros). Visual red flash on hit.
6.  **Lives:** Start with 3. 0 = Game Over.
7.  **Levels:** Every 100 pts -> Level Up (Speed +15%, Spawn Rate increases). Big "Nivel X!" text overlay.

## UI/UX
- **Responsive:** Fullscreen canvas (100% viewport width/height). Mobile-first (touch events essential).
- **HUD:** Score (top-right), Lives (top-left), Level (top-center).
- **Screens:**
    - Start Screen: Title, "Jugar" button.
    - Game Over: Final Score, "Volver a Jugar", Name Input + "Enviar Puntuación".
- **Leaderboard:** Mockup table showing Top 10. `saveScore(name, score)` function prepared for API integration (Firebase/Supabase).

## Technical Requirements
- **Stack:** HTML5 Canvas + Vanilla JS + TailwindCSS (via CDN is fine for prototype).
- **Loop:** `requestAnimationFrame`.
- **Optimization:** Object pooling or efficient garbage collection handling for mobile.
- **Output:** Single file `index.html` (with embedded CSS/JS) or separated files `style.css`, `script.js`.
- **Backend Stub:** Clear comments on where to add API keys/endpoints.

## Tone
Humorous, slightly edgy ("canalla"), culturally relevant to Murcia (Spain).
