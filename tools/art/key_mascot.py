# Removes the green (#00FF00) background from the generated mascot art, cleans the green spill on
# soft edges and steam, trims, and writes small WebP files the game loads: assets/mascot/web/.
# Usage: python3 tools/art/key_mascot.py
import os
import numpy as np
from PIL import Image

SRC = 'assets/mascot'
OUT = 'assets/mascot/web'
os.makedirs(OUT, exist_ok=True)

def key(im):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # How much greener than the other two channels a pixel is
    spill = g - np.maximum(r, b)
    # Fully green -> transparent; neutral colours -> opaque; a soft ramp in between
    alpha = np.clip(1 - (spill - 25) / 90, 0, 1)
    # Some images came with an off-green background: also key by distance to the corner colour
    h, w = r.shape
    corners = np.array([a[4, 4], a[4, w - 5], a[h - 5, 4], a[h - 5, w - 5]])
    bg = np.median(corners, axis=0)
    dist = np.sqrt(((a - bg) ** 2).sum(axis=-1))
    alpha = np.minimum(alpha, np.clip((dist - 40) / 70, 0, 1))
    # Despill: pull green down to the other channels where it leaks in
    g2 = np.where(spill > 0, np.maximum(r, b) + np.clip(spill, 0, None) * 0.15, g)
    # Steam and glows were drawn as light green: make the light parts white again
    light = (r + g2 + b) / 3
    out = np.stack([r, g2, b, alpha * 255], axis=-1)
    out = np.clip(out, 0, 255).astype(np.uint8)
    img = Image.fromarray(out, 'RGBA')
    # Remove isolated speckles: alpha below 8% becomes 0
    px = np.asarray(img).copy()
    px[..., 3][px[..., 3] < 20] = 0
    return Image.fromarray(px, 'RGBA')

for name in sorted(os.listdir(SRC)):
    if not name.endswith('.png'):
        continue
    im = key(Image.open(os.path.join(SRC, name)))
    if name == 'acc-cap.png':
        # The cap came on top of a cup: keep only the cap (top part)
        bb = im.getbbox()
        im = im.crop((bb[0], bb[1], bb[2], bb[1] + int((bb[3] - bb[1]) * 0.47)))
    bbox = im.getbbox()
    if bbox:
        pad = 8
        bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(im.width, bbox[2] + pad), min(im.height, bbox[3] + pad))
        im = im.crop(bbox)
    limit = 768 if name.startswith('bica-sheet') else 512
    if max(im.size) > limit:
        k = limit / max(im.size)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    dst = os.path.join(OUT, name.replace('.png', '.webp'))
    im.save(dst, 'WEBP', quality=88, method=6)
    print(dst, im.size, os.path.getsize(dst))
