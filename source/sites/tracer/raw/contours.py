"""Trace the Tracer logos into vector loops (no numpy/cv2: PIL + marching squares).

  python3 contours.py   ->  ../assets/marks.json (normalised loops for the line), ../assets/*.svg (crisp marks)

The white glyph on the blue tiles (1.webp: the t mark, 2.webp: the wordmark) is thresholded, every boundary loop is
traced on the pixel corners, simplified (Douglas-Peucker) and lightly smoothed (Chaikin), then normalised so the
wordmark's height is 1 and its centre is the origin.
"""
import json, math, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets')


def mask_of(path, scale):
    im = Image.open(path).convert('L')
    w, h = im.size
    im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    w, h = im.size
    px = im.load()
    return w, h, [[1 if px[x, y] > 170 else 0 for x in range(w)] for y in range(h)]


def loops_of(w, h, m):
    """Boundary edges between inside/outside pixels, chained into closed loops (inside on the left)."""
    nxt = {}
    get = lambda x, y: m[y][x] if 0 <= x < w and 0 <= y < h else 0
    for y in range(-1, h + 1):
        for x in range(-1, w + 1):
            if not get(x, y):
                continue
            # directed edges around the inside pixel, clockwise in image coords
            if not get(x, y - 1): nxt.setdefault((x, y), []).append((x + 1, y))
            if not get(x + 1, y): nxt.setdefault((x + 1, y), []).append((x + 1, y + 1))
            if not get(x, y + 1): nxt.setdefault((x + 1, y + 1), []).append((x, y + 1))
            if not get(x - 1, y): nxt.setdefault((x, y + 1), []).append((x, y))
    loops = []
    while nxt:
        start = next(iter(nxt))
        loop, p = [start], start
        while True:
            outs = nxt.get(p)
            if not outs:
                break
            q = outs.pop()
            if not outs:
                del nxt[p]
            if q == start:
                break
            loop.append(q)
            p = q
        if len(loop) > 20:
            loops.append(loop)
    return loops


def dp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1e-9
    i, dm = 0, -1
    for k in range(1, len(pts) - 1):
        d = abs(dy * pts[k][0] - dx * pts[k][1] + b[0] * a[1] - b[1] * a[0]) / L
        if d > dm:
            i, dm = k, d
    if dm > eps:
        return dp(pts[:i + 1], eps)[:-1] + dp(pts[i:], eps)
    return [a, b]


def chaikin(pts, n=2):
    for _ in range(n):
        out = []
        for i in range(len(pts)):
            p, q = pts[i], pts[(i + 1) % len(pts)]
            out += [(0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]), (0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1])]
        pts = out
    return pts


def area(pts):
    return 0.5 * sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))


def trace(path, scale, eps):
    w, h, m = mask_of(path, scale)
    loops = []
    for lp in loops_of(w, h, m):
        # a closed loop: split at the point farthest from the start, simplify both halves
        far = max(range(len(lp)), key=lambda k: (lp[k][0] - lp[0][0]) ** 2 + (lp[k][1] - lp[0][1]) ** 2)
        s = dp(lp[:far + 1], eps)[:-1] + dp(lp[far:] + [lp[0]], eps)[:-1]
        s = chaikin(s, 2)
        loops.append([(x / scale, y / scale) for x, y in s])
    loops.sort(key=lambda l: -abs(area(l)))
    return loops


def bbox(loops):
    xs = [p[0] for l in loops for p in l]; ys = [p[1] for l in loops for p in l]
    return min(xs), min(ys), max(xs), max(ys)


def svg(loops, pad=0):
    x0, y0, x1, y1 = bbox(loops)
    d = ' '.join('M' + ' L'.join(f'{x - x0 + pad:.1f} {y - y0 + pad:.1f}' for x, y in l) + 'Z' for l in loops)
    return x1 - x0 + 2 * pad, y1 - y0 + 2 * pad, d


os.makedirs(OUT, exist_ok=True)
word = trace(os.path.join(HERE, '2.webp'), 0.5, 0.6)
mark = trace(os.path.join(HERE, '1.webp'), 0.6, 0.6)

data = {}
for name, loops in (('word', word), ('mark', mark)):
    x0, y0, x1, y1 = bbox(loops)
    cx, cy, H = (x0 + x1) / 2, (y0 + y1) / 2, (y1 - y0)
    # y up for three.js; holes flagged by winding relative to the outer loop
    outer = area(loops[0])
    data[name] = {
        'aspect': round((x1 - x0) / H, 4),
        'loops': [{'hole': (area(l) > 0) != (outer > 0), 'pts': [[round((x - cx) / H, 4), round(-(y - cy) / H, 4)] for x, y in l]} for l in loops],
    }
    W, Hh, d = svg(loops)
    for col, suffix in (('#ffffff', 'white'), ('#0657FF', 'blue')):
        with open(os.path.join(OUT, f'{name}-{suffix}.svg'), 'w') as f:
            f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.1f} {Hh:.1f}"><path fill="{col}" fill-rule="evenodd" d="{d}"/></svg>')
    data[name]['svg'] = {'viewBox': f'0 0 {W:.1f} {Hh:.1f}', 'd': d}
    print(name, 'loops', len(loops), [len(l) for l in loops], 'aspect', data[name]['aspect'])

with open(os.path.join(OUT, 'marks.json'), 'w') as f:
    json.dump({k: {'aspect': v['aspect'], 'loops': v['loops']} for k, v in data.items()}, f)
with open(os.path.join(HERE, 'marks-svg.json'), 'w') as f:
    json.dump({k: v['svg'] for k, v in data.items()}, f)
