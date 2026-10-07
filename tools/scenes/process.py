#!/usr/bin/env python3
"""Turns the scene artworks (assets/scenes/<name>.png, 768x1376) into what the game loads:
  assets/scenes/web/<id>.webp    1080x1935 picture, centre slightly calmer so the pieces read well
  assets/scenes/thumb/<id>.webp  240x430 preview for the shop
  assets/scenes/web/<id>.json    where the ambient animations go (fractions of the picture):
    moon [x, y, radius]   sky [y0, y1] twinkling stars   clouds [y0, y1] drifting cloud / fog band
    water [y0, y1] (+ waterX [x0, x1]) shimmer   glows [[x, y, r]] pulsing lamps   windows [[x, y]]
    bubbles  tint colours as 0xRRGGBB numbers
Usage: python3 tools/scenes/process.py [id ...]   (windows are found automatically from warm lit pixels)
"""
import json, random, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[2] / 'assets' / 'scenes'
W, H = 1080, 1935

# id -> (source file, animation settings, region (y0, y1) where lit windows are searched or None)
SCENES = {
    'porto': ('porto', dict(sky=[0.02, 0.3], water=[0.46, 0.72]), (0.25, 0.5)),
    'sintra': ('sintra', dict(moon=[0.26, 0.13, 0.035], sky=[0.02, 0.28], clouds=[0.42, 0.6]), (0.25, 0.48)),
    'algarve': ('algarve', dict(sky=[0.02, 0.22], water=[0.32, 0.6], shimmer=0xffc78a, glows=[[0.55, 0.462, 0.03]]), None),
    'coimbra': ('coimbra', dict(moon=[0.22, 0.10, 0.03], sky=[0.02, 0.18], water=[0.6, 0.82]), (0.2, 0.55)),
    'obidos': ('obidos', dict(sky=[0.02, 0.25], glows=[[0.267, 0.37, 0.05], [0.267, 0.527, 0.035], [0.53, 0.45, 0.03]]), (0.3, 0.7)),
    'evora': ('evora', dict(sky=[0.02, 0.3]), None),
    'madeira': ('madeira', dict(moon=[0.25, 0.12, 0.03], sky=[0.02, 0.2], clouds=[0.22, 0.38], water=[0.84, 0.98]), (0.4, 0.82)),
    'acores': ('acores', dict(moon=[0.68, 0.30, 0.03], sky=[0.02, 0.26], clouds=[0.28, 0.38], water=[0.43, 0.72], shimmer=0xbfe3ff), (0.3, 0.55)),
    'ocean': ('ocean', dict(bubbles=True, moon=[0.5, 0.03, 0.12], moonTint=0xcfe8ff), None),
    'beach': ('beach', dict(moon=[0.32, 0.13, 0.03], sky=[0.02, 0.28], water=[0.47, 0.62], shimmer=0xffb08a, glows=[[0.67, 0.59, 0.035]]), None),
    'alfama': ('lisbon', dict(moon=[0.77, 0.125, 0.04], sky=[0.02, 0.28], water=[0.2, 0.3], waterX=[0.45, 1],
                              glows=[[0.06, 0.80, 0.05], [0.96, 0.82, 0.05]]), (0.3, 0.8)),
}


def calm_centre(im):
    """A little darker and less saturated in the middle, where the pieces pile up."""
    a = np.asarray(im).astype(np.float32) / 255
    y = np.linspace(0, 1, a.shape[0])[:, None]
    bump = np.exp(-((y - 0.58) / 0.26) ** 2)                      # 1 around 58% of the height
    top = np.clip(1 - y / 0.2, 0, 1) * 0.12                       # the score panel sits on the top fifth
    lum = a.mean(axis=2, keepdims=True)
    a = a + (lum - a) * (0.14 * bump)[..., None]                  # desaturate up to 14%
    a = a * (1 - 0.13 * bump - top)[..., None]                    # darken up to 13%
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))


def find_windows(src, region, rng):
    if not region:
        return []
    a = np.asarray(src).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mask = (r > 200) & (g > 140) & (b < 200) & (r - b > 50)
    h, w = mask.shape
    cell = 8
    pts = []
    for cy in range(int(h * region[0]) // cell, int(h * region[1]) // cell):
        for cx in range(w // cell):
            if mask[cy * cell:(cy + 1) * cell, cx * cell:(cx + 1) * cell].sum() >= 7:
                pts.append((cx * cell + cell / 2, cy * cell + cell / 2))
    rng.shuffle(pts)
    chosen = []
    for p in pts:
        if all((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 > 22 ** 2 for q in chosen):
            chosen.append(p)
        if len(chosen) >= 34:
            break
    return [[round(x / w, 4), round(y / h, 4)] for x, y in chosen]


def main(ids):
    (ROOT / 'web').mkdir(exist_ok=True)
    (ROOT / 'thumb').mkdir(exist_ok=True)
    for sid in ids:
        name, anim, region = SCENES[sid]
        src = Image.open(ROOT / f'{name}.png').convert('RGB')
        anim = dict(anim)
        anim['windows'] = find_windows(src, region, random.Random(sid))
        big = src.resize((W, H), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.2, percent=40, threshold=2))
        big = calm_centre(big)
        big.save(ROOT / 'web' / f'{sid}.webp', 'WEBP', quality=80, method=6)
        big.resize((240, 430), Image.LANCZOS).save(ROOT / 'thumb' / f'{sid}.webp', 'WEBP', quality=78, method=6)
        (ROOT / 'web' / f'{sid}.json').write_text(json.dumps(anim, separators=(',', ':')))
        print(sid, (ROOT / 'web' / f'{sid}.webp').stat().st_size // 1024, 'KB,', len(anim['windows']), 'windows')


if __name__ == '__main__':
    main(sys.argv[1:] or list(SCENES))
