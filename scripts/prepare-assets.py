"""One-off asset prep. Reads brand/ logo, writes src/assets/*.

Palette provenance (sampled, never invented):
  brand/LOGO AEGOS PNG...png   RGBA, alpha histogram {0: 3724533, 254: 165211, ...}, ink = (0,0,0) on alpha
  brand/LOGO AEGOS PNG.png     RGBA opaque, bg (246,240,228) = #F6F0E4, ink (1,1,1)
Premultiplied resize is used: the transparent logo has pure-black (0,0,0,0) regions.
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'brand', 'LOGO AEGOS PNG...png')
OUT = os.path.join(ROOT, 'src', 'assets')
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert('RGBA')
assert im.size == (2000, 2000)
a = im.getchannel('A')


def premul_resize(img, size):
    pm = img.convert('RGBa')  # premultiplied
    pm = pm.resize(size, Image.LANCZOS)
    return pm.convert('RGBA')


def alpha_bbox(box_img, thresh=8):
    return box_img.point(lambda v: 255 if v > thresh else 0).getbbox()


# full lockup (emblem + wordmark), tight with small pad
bb = alpha_bbox(a)
pad = 24
lock = im.crop((bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad))
w = 720
lock = premul_resize(lock, (w, round(lock.height * w / lock.width)))
lock.save(os.path.join(OUT, 'aegos-lockup.png'), optimize=True)

# emblem only: rows above the wordmark gap
rows = [y for y in range(bb[1], bb[3]) if a.crop((0, y, 2000, y + 1)).getbbox()]
gap_start = None
for y0, y1 in zip(rows, rows[1:]):
    if y1 - y0 > 20:
        gap_start = y0
        break
eb = alpha_bbox(a.crop((0, 0, 2000, gap_start + 1)))
emb = im.crop((eb[0] - pad, eb[1] - pad, eb[2] + pad, eb[3] + pad))
side = max(emb.size)
sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
sq.paste(emb, ((side - emb.width) // 2, (side - emb.height) // 2))
mark = premul_resize(sq, (512, 512))
mark.save(os.path.join(OUT, 'aegos-mark.png'), optimize=True)

# favicon: 32x32 coverage grid of the emblem, traced into SVG runs
fav = premul_resize(sq, (32, 32)).getchannel('A')
full, part = [], []
for y in range(32):
    x = 0
    while x < 32:
        v = fav.getpixel((x, y))
        k = 2 if v >= 191 else (1 if v >= 64 else 0)
        if k == 0:
            x += 1
            continue
        x0 = x
        while x < 32:
            v2 = fav.getpixel((x, y))
            k2 = 2 if v2 >= 191 else (1 if v2 >= 64 else 0)
            if k2 != k:
                break
            x += 1
        (full if k == 2 else part).append(f'M{x0} {y}h{x-x0}v1h-{x-x0}z')
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" '
       'shape-rendering="crispEdges">'
       '<rect width="32" height="32" fill="#F6F0E4"/>'
       f'<path fill="#010101" d="{"".join(full)}"/>'
       f'<path fill="#010101" fill-opacity=".5" d="{"".join(part)}"/></svg>')
open(os.path.join(OUT, 'favicon.svg'), 'w').write(svg)
print('lockup', lock.size, 'mark', mark.size, 'emblem bbox', eb, 'fav runs', len(full), len(part))
