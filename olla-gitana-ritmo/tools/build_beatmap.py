#!/usr/bin/env python3
"""
Genera el mapa de ritmo de "Los Olla Gitana" para el juego de ritmo.
Salida: assets/beatmap.json  {bpm, duration, offset, grid_ms, notes:[{t, lane, s}]}

Versión 2 (notas ACORDES con la música):
- Onsets con backtrack=True -> la marca temporal cae donde EMPIEZA el golpe
  (con backtrack=False cae en el pico de energía, ~30-50 ms tarde, y se notaba
  desfasado respecto a la música).
- Selección con umbral LOCAL en ventana ±12 s: el intro (más suave) también
  entra en el mapa; antes se tomaban "los N más fuertes" y la canción no
  empezaba hasta el 18 (los onsets del intro se descartaban).
- Decimación temporal (por bloques, la más fuerte de cada bloque) para una
  densidad jugable y estable, sin sesgar las zonas densas.
- Carriles por cuartiles del centroide espectral + variedad + MIN_GAP por carril.
"""
import json, sys
import numpy as np
import librosa

SRC = "assets/music.mp3"
OUT = "assets/beatmap.json"
LANES = 4
TARGET_NOTES = 330        # ~1.85 notas/s en 178 s: ritmo constante y jugable
START_MIN = 1.0           # margen para el jugador tras pulsar JUGAR
MIN_GAP_GLOBAL = 0.16     # nunca dos notas casi simultáneas
MIN_GAP_LANE = 0.30       # separación mínima dentro del mismo carril

def main():
    y, sr = librosa.load(SRC, sr=22050, mono=True)
    dur = float(librosa.get_duration(y=y, sr=sr))

    # onsets PRECISOS (backtrack -> inicio real del golpe)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=512)
    onsets = librosa.onset.onset_detect(
        onset_envelope=onset_env, sr=sr, hop_length=512,
        backtrack=True, units="time", delta=0.04, wait=3,
    )
    # pulso (solo informativo para el fichero)
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr, units="time")
    bpm = float(np.atleast_1d(tempo)[0])

    # fuerza + centroide espectral por onset
    S = np.abs(librosa.stft(y, hop_length=512))
    freqs = librosa.fft_frequencies(sr=sr)
    strengths, centroids = [], []
    for t in onsets:
        idx = min(max(int(t * sr / 512), 0), S.shape[1] - 1)
        col = S[:, max(0, idx - 2): idx + 3].mean(axis=1)
        strengths.append(float(col.sum()))
        centroids.append(float((col * freqs).sum() / (col.sum() + 1e-9)))
    strengths = np.array(strengths)
    centroids = np.array(centroids)

    # 1) umbral LOCAL anti-ruido: percentil 20 de la fuerza en ±12 s
    half = 12.0
    keep = np.zeros(len(onsets), dtype=bool)
    for i, t in enumerate(onsets):
        m = (onsets >= t - half) & (onsets <= t + half)
        keep[i] = strengths[i] >= np.percentile(strengths[m], 20)
    idx_keep = np.where(keep)[0]

    # 2) dedupe: dos onsets a < MIN_GAP_GLOBAL -> la más fuerte
    picked = []
    for i in idx_keep:
        if picked and onsets[i] - onsets[picked[-1]] < MIN_GAP_GLOBAL:
            if strengths[i] > strengths[picked[-1]]:
                picked[-1] = i
        else:
            picked.append(i)

    # 3) decimación temporal a ~TARGET_NOTES (la más fuerte de cada bloque)
    n = len(picked)
    if n > TARGET_NOTES:
        block = n / float(TARGET_NOTES)
        sel = []
        i = 0.0
        while i < n:
            a, b = int(i), max(int(i) + 1, int(i + block))
            seg = picked[a:min(b, n)]
            if seg:
                sel.append(max(seg, key=lambda k: strengths[k]))
            i += block
        picked = sel
    cand = [(float(onsets[i]), float(strengths[i]), float(centroids[i])) for i in picked]
    # margen inicial para el jugador
    cand = [c for c in cand if c[0] >= START_MIN]
    cand.sort(key=lambda c: c[0])

    # 4) carriles por cuartiles del centroide (balanceado) + variedad + MIN_GAP
    cents = np.array([c[2] for c in cand])
    qs = np.quantile(cents, [0.25, 0.50, 0.75]) if len(cents) >= 8 else np.array([500., 1500., 3000.])

    notes = []
    last_in_lane = {i: -99.0 for i in range(LANES)}
    prev_lane = -1
    for t, s, cet in cand:
        lane = int(np.clip(np.digitize(cet, qs), 0, LANES - 1))
        r = np.random.default_rng(int(t * 1000) % (2**32))
        if lane == prev_lane:                      # evita repetir carril consecutivo
            lane = int(np.clip(lane + (1 if r.random() < 0.5 else -1), 0, LANES - 1))
        if t - last_in_lane[lane] < MIN_GAP_LANE:
            alt = [l for l in range(LANES) if t - last_in_lane[l] >= MIN_GAP_LANE]
            if not alt:
                continue
            lane = alt[int(r.integers(0, len(alt)))]
        last_in_lane[lane] = t
        prev_lane = lane
        notes.append({"t": round(t, 3), "lane": lane,
                      "s": round(min(1.0, s / (strengths.max() + 1e-9)), 3)})
    notes.sort(key=lambda n: n["t"])

    data = {
        "song": "Los Olla Gitana",
        "src": "assets/music.mp3",
        "duration": round(dur, 2),
        "bpm": round(bpm, 1),
        "grid_ms": 150,
        "offset": notes[0]["t"] if notes else 0.0,
        "notes": notes,
        "count": len(notes),
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

    print(f"OK {OUT}: {len(notes)} notas | bpm={bpm:.1f} | dur={dur:.1f}s | "
          f"primera={notes[0]['t']:.2f}s última={notes[-1]['t']:.2f}s")
    # densidad por tramos (para revisar el reparto)
    print("densidad por tramo de 20 s:")
    tt = [n["t"] for n in notes]
    for a in range(0, int(dur), 20):
        k = sum(1 for t in tt if a <= t < a + 20)
        print(f"  {a:3d}-{a+20:3d}s: {k:3d} {'#' * k}")
    lanes = {i: sum(1 for n in notes if n['lane'] == i) for i in range(LANES)}
    print("carriles:", lanes)

if __name__ == "__main__":
    sys.exit(main())
