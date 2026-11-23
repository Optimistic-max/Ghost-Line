# Synthesized sound design for the race film. Every sound is generated here (sine partials and
# filtered noise): no third-party audio. Driven by qa/sfx-events.json (from the same timeline).
# python scripts/sfx.py  -> film/race-split-sfx-raw.wav (then loudness-normalised by ffmpeg)
import json, os, sys, wave
import numpy as np
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EV = json.load(open(os.path.join(ROOT, 'qa', 'sfx-events.json'), encoding='utf-8'))
SR = 48000
N = int(round(EV['duration_s'] * SR))
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(1938)          # deterministic


def place(x, t, pan=0.0, gain=1.0):
    """Add mono x at time t (s); pan -1 = left (1938 half), +1 = right (today's half)."""
    i = int(round(t * SR))
    if i >= N: return
    x = x[: N - i] * gain
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(x)] += x * gl; R[i:i + len(x)] += x * gr


def env(n, attack=0.004, tau=0.4):
    t = np.arange(n) / SR
    return np.minimum(1, t / attack) * np.exp(-t / tau)


def bell(f0=660.0, dur=1.3, tau=0.42):
    """Soft warm bell: a few inharmonic sine partials, the upper ones dying faster."""
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for ratio, amp, td in ((1.0, 1.0, 1.0), (2.0, 0.32, 0.6), (2.76, 0.18, 0.45), (5.40, 0.06, 0.25)):
        out += amp * np.sin(2 * np.pi * f0 * ratio * t) * env(n, 0.003, tau * td)
    fade = np.ones(n); fade[-int(0.05 * SR):] = np.linspace(1, 0, int(0.05 * SR))
    return out * fade / 1.6


def chime():
    """Gentle two-note door chime (E5 then C5)."""
    a = bell(659.25, 0.9, 0.30) * 0.8
    b = bell(523.25, 1.1, 0.36) * 0.8
    out = np.zeros(int(1.3 * SR)); out[: len(a)] += a; j = int(0.2 * SR); out[j:j + len(b)] += b[: len(out) - j]
    return out


def bed_mask(a, b, fade=0.3):
    """0..1 gain over [a, b] film seconds with soft fades."""
    t = np.arange(N) / SR
    g = np.clip((t - a) / fade, 0, 1) * np.clip((b - t) / fade, 0, 1)
    return g


t = np.arange(N) / SR
# ---- low electric hum while the 1938 trolley rides (120 Hz + soft harmonics, very quiet)
h = EV['hum']
hum = (np.sin(2 * np.pi * 120 * t) + 0.30 * np.sin(2 * np.pi * 240 * t) + 0.12 * np.sin(2 * np.pi * 360 * t)) * (1 + 0.08 * np.sin(2 * np.pi * 0.7 * t))
hum *= bed_mask(h['from'], h['to'], 0.35) * 0.05
# ---- muted low rumble while the bus is on screen and moving (low-passed brown noise)
brown = np.cumsum(rng.standard_normal(N))
brown = signal.sosfiltfilt(signal.butter(2, 20 / (SR / 2), 'high', output='sos'), brown)   # remove the drift
b_lp = signal.sosfiltfilt(signal.butter(4, 160 / (SR / 2), 'low', output='sos'), brown)
b_lp /= (np.max(np.abs(b_lp)) + 1e-9)
rum = np.zeros(N)
for seg in EV['rumble']:
    rum += bed_mask(seg['from'], seg['to'], 0.15)
rumble = b_lp * np.clip(rum, 0, 1) * 0.16
# ---- soft clock tick about once per real second during today's wait (silent while the clock is paused)
holds = [(c['t'], c['t'] + c.get('d', 0.6)) for c in EV['chimes']]
tk = EV['ticks']
click = signal.sosfilt(signal.butter(2, [1800 / (SR / 2), 4200 / (SR / 2)], 'band', output='sos'), rng.standard_normal(int(0.012 * SR))) * env(int(0.012 * SR), 0.0005, 0.003)
click /= np.max(np.abs(click)) + 1e-9
tt = tk['from'] + 0.25
while tt < tk['to'] - 0.1:
    if not any(a - 0.05 <= tt <= b for a, b in holds) and not (EV['hush_before_freeze']['from'] - 0.05 <= tt <= EV['freeze_bell']['t'] + 0.3):
        place(click, tt, 0.4, 0.05)
    tt += tk['every_s']
# ---- near-silence for 0.4 s before the trolley's 15:00 freeze: the hum ducks right down
hb = EV['hush_before_freeze']
duck = 1 - 0.92 * np.clip((t - (hb['from'] - 0.15)) / 0.15, 0, 1) * np.clip((hb['to'] + 0.05 - t) / 0.05, 0, 1)
hum *= duck
L += hum * 0.9 + rumble * 0.45; R += hum * 0.5 + rumble * 0.9     # hum leans to the 1938 half, rumble to today's
# ---- bells: a soft warm bell as each 1938 car passes today's rider (right half)
for b in EV['bells']:
    place(bell(660.0), b['t'], 0.35, 0.55)
# ---- the single bell at the 15:00 freeze (left half), a little lower and longer
place(bell(523.25, 1.8, 0.6), EV['freeze_bell']['t'], -0.35, 0.7)
# ---- door chimes at each boarding / getting-off hold (the 10:15 one waits a moment for the freeze bell)
for c in EV['chimes']:
    tc = c['t'] + (0.25 if abs(c['t'] - EV['freeze_bell']['t']) < 0.05 else 0.02)
    place(chime(), tc, -0.4 if c['what'].startswith('1938') else 0.4, 0.42)
# ---- the end card is quiet: fade everything out over the last 0.6 s of tiles
fo = np.clip((EV['tile_end_s'] + 0.6 - t) / 0.6, 0, 1); L *= fo; R *= fo

st = np.stack([L, R], 1)
st /= max(1e-9, np.max(np.abs(st))) / 0.5      # headroom; ffmpeg loudnorm sets the final level
pcm = (st * 32767).astype('<i2')
out = os.path.join(ROOT, 'film', 'race-split-sfx-raw.wav')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', out, f'{N / SR:.2f} s', 'bells', len(EV['bells']), 'chimes', len(EV['chimes']))
