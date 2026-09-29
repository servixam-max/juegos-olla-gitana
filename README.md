# Juegos de Olla Gitana 🥘🎸🏃

Menú + los tres juegos de la banda **Olla Gitana**, con ranking compartido.

| Ruta | Juego |
|---|---|
| `index.html` | Menú de juegos |
| `olla-gitana/` | **El Juego** — arcade clásico (recuperado de `AntonioXam/olla-gitana`, ranking arreglado) |
| `olla-gitana-ritmo/` | **El Ritmo** — 4 carriles al ritmo de «Los Olla Gitana» (beatmap generado con librosa) |
| `olla-gitana-runner/` | **La Huerta Runner** — endless runner (salto, doble salto, agacharse) |
| `admin/` | Panel de rankings (borrado con token) |

## Dónde corre

- **Sirve el Mac**: Caddy → `https://servi.tail31979d.ts.net/juegos-olla/`
  - Alias corto: `https://servi.tail31979d.ts.net/champi/`
- **Rankings**: API local en el Mac (launchd `com.servimac.ollajuegos`, `127.0.0.1:8093`,
  datos en `~/scripts/ollajuegos/scores.json`).
  Los juegos guardan primero en localStorage (respaldo) y luego POSTean al Mac; si la API
  no responde, siguen funcionando en local.
  **GitHub Pages no puede alojar la API** (hosting estático, no acepta POST): aunque sirviera
  estos archivos desde GitHub, el ranking siempre apunta al Mac.

## Este repo

Respaldo/versionado del sitio desplegado (snapshot). El despliegue real vive en el Mac:
`/Volumes/465GB/migrated/juegos/`.
Token de borrado del panel: fichero `admin_token.txt` en el Mac (nunca en este repo).

## Assets

Reutilizados de la banda: 15 fondos de Murcia (`bg_1..bg_14`, `background.jpg`),
`music.mp3` («Los Olla Gitana», 178 s, 99,4 BPM), `hit.mp3`, `levelup_special.mp3`,
`victory.jpg`.

## Regenerar el beatmap del juego de ritmo

```bash
/Volumes/465GB/migrated/apps-ollagitana/backend/.venv/bin/python olla-gitana-ritmo/tools/build_beatmap.py
python3 olla-gitana-ritmo/tools/make_beatmap_js.py
```
