#!/usr/bin/env python3
"""Convierte assets/beatmap.json en beatmap.js (window.OLLA_RITMO_BEATMAP) para que
el juego funcione también servido desde file:// sin CORS."""
import json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
data = json.loads((root / "assets" / "beatmap.json").read_text(encoding="utf-8"))
out = root / "beatmap.js"
payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
out.write_text("/* Generado por tools/make_beatmap_js.py — no editar a mano */\n"
               "window.OLLA_RITMO_BEATMAP = " + payload + ";\n", encoding="utf-8")
print(f"OK {out} ({out.stat().st_size} bytes, {data['count']} notas)")
