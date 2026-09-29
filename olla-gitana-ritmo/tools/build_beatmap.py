#!/usr/bin/env python3
"""
Genera el mapa de ritmo de "Los Olla Gitana" para el juego de ritmo.
Salida: assets/beatmap.json  {bpm, duration, offset, notes:[{t, lane}]}

Heurística: onsets fuertes (librosa) + fase de beats (beat_track) + 4 carriles
asignados por banda de frecuencia (graves -> izquierda, agudos -> derecha).
"""
import json, sys
import numpy as np
import librosa

SRC = "assets/music.mp3"
OUT = "assets/beatmap.json"
LANES = 4
MAX_NOTES = 280           # jugable en ~3 min
MIN_GAP = 0.32           # segundos mínimos entre notas del mismo carril

def main():
    y, sr = librosa.load(SRC, sr=22050, mono=True)
    dur = float(librosa.get_duration(y=y, sr=sr))

    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
    bpm = float(np.atleast_1d(tempo)[0])

    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=512)
    onsets = librosa.onset.onset_detect(
        onset_envelope=onset_env, sr=sr, hop_length=512,
        backtrack=False, units="time", delta=0.06, wait=3,
    )
    # fuerza espectral por onset para filtrar los débiles
    S = np.abs(librosa.stft(y, hop_length=512))
    freqs = librosa.fft_frequencies(sr=sr)
    strengths = []
    for t in onsets:
        idx = int(t * sr / 512)
        idx = min(max(idx, 0), S.shape[1] - 1)
        col = S[:, max(0, idx - 2): idx + 3].mean(axis=1)
        strengths.append(float(col.sum()))
    strengths = np.array(strengths)

    # fase de beat: alinear onsets a la rejilla (para el "feel" musical)
    if len(beats) > 4:
        beat_times = np.array(beats)
        grid = np.min(np.abs(onsets[:, None] - beat_times[None, :]), axis=1)
    else:
        grid = np.zeros_like(onsets)

    # 1) candidatos: onsets con fuerza suficiente o alineados a la rejilla
    thr = np.percentile(strengths, 35) if len(strengths) else 0
    cand = []
    for t, s, g in zip(onsets, strengths, grid):
        if s >= thr or g <= 0.05:
            idx = int(t * sr / 512)
            idx = min(max(idx, 0), S.shape[1] - 1)
            col = S[:, max(0, idx - 2): idx + 3].mean(axis=1)
            centroid = float((col * freqs).sum() / (col.sum() + 1e-9))
            cand.append((float(t), float(s), centroid))
    if len(cand) > MAX_NOTES:
        cand = sorted(sorted(cand, key=lambda k: -k[1])[:MAX_NOTES])

    # 2) umbrales por cuartiles del centroide espectral -> carriles balanceados
    cents = np.array([c[2] for c in cand])
    qs = np.quantile(cents, [0.25, 0.50, 0.75]) if len(cents) >= 8 else np.array([500., 1500., 3000.])

    # 3) asignación de carriles con separación mínima por carril
    notes = []
    last_in_lane = {i: -99.0 for i in range(LANES)}
    prev_lane = -1
    for t, s, centroid in sorted(cand):
        lane = int(np.clip(np.digitize(centroid, qs), 0, LANES - 1))
        r = np.random.default_rng(int(t * 1000) % (2**32))
        if lane == prev_lane:  # variedad: evita repetir carril consecutivo
            lane = int(np.clip(lane + (1 if r.random() < 0.5 else -1), 0, LANES - 1))
        if t - last_in_lane[lane] < MIN_GAP:
            alt = [l for l in range(LANES) if t - last_in_lane[l] >= MIN_GAP]
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
        "notes": notes,
        "count": len(notes),
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"OK {OUT}: {len(notes)} notas | bpm={bpm:.1f} | dur={dur:.1f}s")

if __name__ == "__main__":
    sys.exit(main())
