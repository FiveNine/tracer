"""Tracy's blue areas as polygons (with holes), so the trace can fill them in its own colour once she is drawn.

  python3 tracy-fill.py   (needs numpy, scipy, scikit-image)  ->  'tracyFill' in ../../assets/marks.json

The blue of the filled mascot (5.webp) is traced sub-pixel; loops are nested by containment (even depth = a region,
odd depth = a hole in it, e.g. the white t in the badge, the eye highlights). Coordinates use the line art's box
(6.webp), normalised exactly like 'tracyArt', so fill and line coincide.
"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage.measure import find_contours

HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, '..', '..', 'assets')

line = np.asarray(Image.open(os.path.join(HERE, '6.webp')).convert('RGBA')).astype(np.float32)
ys, xs = np.nonzero(line[..., 3] > 10); bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
BW, BH = bx1 - bx0, by1 - by0

img = np.asarray(Image.open(os.path.join(HERE, '5.webp')).convert('RGBA')).astype(np.float32)
blue = np.clip(((img[..., 2] - img[..., 0]) - 40) / 60, 0, 1) * (img[..., 3] / 255)   # soft blue coverage
blue = ndi.gaussian_filter(np.pad(blue, 3), 0.8)

def area(p): x, y = p[:, 0], p[:, 1]; return 0.5 * np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y)
def inside(pt, poly):
    x, y = pt; px, py = poly[:, 0], poly[:, 1]; qx, qy = np.roll(px, -1), np.roll(py, -1)
    c = ((py > y) != (qy > y)) & (x < (qx - px) * (y - py) / (qy - py + 1e-12) + px)
    return np.count_nonzero(c) % 2 == 1
def dp(pts, eps):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; d = b - a; L = np.hypot(*d) or 1e-9
    dist = np.abs(d[1] * pts[1:-1, 0] - d[0] * pts[1:-1, 1] + b[0] * a[1] - b[1] * a[0]) / L
    i = int(np.argmax(dist)) + 1
    return np.vstack([dp(pts[:i + 1], eps)[:-1], dp(pts[i:], eps)]) if dist[i - 1] > eps else np.vstack([a, b])
def simplify(loop, eps=0.7):
    far = int(np.argmax(np.hypot(*(loop - loop[0]).T)))
    return np.vstack([dp(loop[:far + 1], eps)[:-1], dp(np.vstack([loop[far:], loop[:1]]), eps)[:-1]])

loops = []
for c in find_contours(blue, 0.5):
    p = np.stack([c[:, 1] - 3, c[:, 0] - 3], axis=1)        # x, y in image px
    if abs(area(p)) < 60: continue                           # specks
    loops.append(simplify(p[:-1] if np.allclose(p[0], p[-1]) else p))

# nesting: depth = how many other loops contain it
depth = [sum(inside(l[0], m) for j, m in enumerate(loops) if j != i) for i, l in enumerate(loops)]
regions = []
for i, l in enumerate(loops):
    if depth[i] % 2: continue
    holes = [loops[j] for j in range(len(loops)) if depth[j] == depth[i] + 1 and inside(loops[j][0], l)]
    regions.append((l, holes))

norm = lambda p: [[round(((x - bx0) - BW / 2) / BH, 5), round(-((y - by0) - BH / 2) / BH, 5)] for x, y in p]
marks_p = os.path.join(A, 'marks.json'); marks = json.load(open(marks_p))
marks['tracyFill'] = [{'outer': norm(o), 'holes': [norm(h) for h in hs]} for o, hs in regions]
json.dump(marks, open(marks_p, 'w'))
print(f"regions {len(regions)}  holes {sum(len(h) for _, h in regions)}  points {sum(len(o) + sum(len(x) for x in h) for o, h in regions)}")

# preview: the regions filled, holes cut
from PIL import ImageDraw
im = Image.new('RGB', (BW, BH), (244, 246, 251)); m = Image.new('L', (BW, BH), 0); d = ImageDraw.Draw(m)
for o, hs in regions:
    d.polygon([(x - bx0, y - by0) for x, y in o], fill=255)
    for h in hs: d.polygon([(x - bx0, y - by0) for x, y in h], fill=0)
im.paste((6, 87, 255), mask=m); im.resize((BW // 2, BH // 2)).save(os.path.join(HERE, 'tracy-fill-preview.png'))
