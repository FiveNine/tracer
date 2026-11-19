"""Tracy as the line itself: the line-art mascot vectorised into strokes the trace can draw.

  python3 tracy-line.py   (needs numpy, scipy, scikit-image)  ->  adds 'tracyArt' to ../../assets/marks.json

Thin strokes become their centrelines (skeleton walked into polylines); filled parts (pupils, nose, heart, eyebrows,
the t badge) are drawn by their outline instead, so they read as shapes and not as a scribble down the middle.
Coordinates are normalised like the 'tracy' silhouette: centred on the art's box, height 1, y up.
"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage.morphology import skeletonize, binary_opening, binary_dilation, disk, remove_small_objects
from skimage.measure import find_contours

HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, '..', '..', 'assets')
H_PX = 900                     # working height: strokes are ~6-9 px wide here
THICK = 6.5                    # a part wider than ~2x this is "filled" and gets an outline

src = Image.open(os.path.join(HERE, '6.webp')).convert('RGBA')
r, g, b, a = [np.asarray(c, dtype=np.float32) for c in src.split()]
ink = ((b - r) > 60) & (a > 128)                                   # the blue strokes
ys, xs = np.nonzero(a > 10); box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)   # the art's box (same as tracy-line.png)
ink = ink[box[1]:box[3], box[0]:box[2]]
s = H_PX / ink.shape[0]
ink = np.asarray(Image.fromarray(ink.astype(np.uint8) * 255).resize((round(ink.shape[1] * s), H_PX), Image.LANCZOS)) > 127
ink = remove_small_objects(ink, 12)
Hh, Ww = ink.shape

# filled parts survive an opening with a disk wider than any stroke; the rest is line work
filled = binary_opening(ink, disk(THICK))
filled = remove_small_objects(filled, 40)
thin = ink & ~binary_dilation(filled, disk(2))
thin = remove_small_objects(thin, 10)

strokes = []

# 1. outlines of the filled parts
lab, n = ndi.label(np.pad(filled, 2))
for i in range(1, n + 1):
    for c in find_contours((lab == i).astype(float), 0.5):
        pts = [(x - 2, y - 2) for y, x in c]
        if len(pts) > 12: strokes.append({'pts': pts, 'closed': True})

# 2. centrelines of the line work: walk the skeleton between ends/junctions, then the remaining loops
sk = skeletonize(thin)
P = set(zip(*np.nonzero(sk)))
nb = lambda p: [(p[0] + dy, p[1] + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx) and (p[0] + dy, p[1] + dx) in P]
deg = {p: len(nb(p)) for p in P}
seen = set()
def walk(a, b):
    path = [a, b]; seen.add(frozenset((a, b)))
    while deg[path[-1]] == 2:
        nxt = [q for q in nb(path[-1]) if frozenset((path[-1], q)) not in seen]
        if not nxt: break
        seen.add(frozenset((path[-1], nxt[0]))); path.append(nxt[0])
        if nxt[0] == path[0]: break
    return path
for p in [p for p in P if deg[p] != 2]:
    for q in nb(p):
        if frozenset((p, q)) not in seen: strokes.append({'pts': [(x, y) for y, x in walk(p, q)], 'closed': False})
for p in P:                                    # pure loops (no ends): eye rings, the badge circle
    for q in nb(p):
        if frozenset((p, q)) not in seen:
            path = walk(p, q); strokes.append({'pts': [(x, y) for y, x in path], 'closed': path[0] == path[-1]})

def length(pts): return sum(np.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1))
def dp(pts, eps):
    if len(pts) < 3: return pts
    a, b = np.array(pts[0]), np.array(pts[-1]); d = b - a; L = np.hypot(*d) or 1e-9
    dist = [abs(d[1] * x - d[0] * y + b[0] * a[1] - b[1] * a[0]) / L for x, y in pts[1:-1]]
    i = int(np.argmax(dist)) + 1
    return dp(pts[:i + 1], eps)[:-1] + dp(pts[i:], eps) if dist[i - 1] > eps else [pts[0], pts[-1]]
def smooth(pts, closed, k=3, passes=2):
    p = np.array(pts, dtype=float)
    for _ in range(passes):
        q = p.copy()
        for i in range(len(p)):
            idx = [(i + j) % len(p) if closed else min(max(i + j, 0), len(p) - 1) for j in range(-k, k + 1)]
            q[i] = p[idx].mean(axis=0)
        if not closed: q[0], q[-1] = p[0], p[-1]
        p = q
    return [tuple(v) for v in p]

# tidy: drop crumbs, smooth the pixel steps, simplify
out = []
for st in strokes:
    pts = st['pts']
    if length(pts) < 9: continue
    pts = smooth(pts, st['closed'])
    pts = dp(pts, 0.35)
    if st['closed'] and pts[0] != pts[-1]: pts = pts + [pts[0]]
    out.append({'pts': pts, 'closed': st['closed']})

# join strokes that meet end to end (a skeleton breaks lines at every junction), so the trace runs on through them
def join(strokes, tol=2.5):
    opn = [s for s in strokes if not s['closed']]; done = [s for s in strokes if s['closed']]
    changed = True
    while changed:
        changed = False
        for i in range(len(opn)):
            for j in range(len(opn)):
                if i == j: continue
                a, b = opn[i]['pts'], opn[j]['pts']
                for A_, B_ in ((a, b), (a, b[::-1])):
                    if np.hypot(A_[-1][0] - B_[0][0], A_[-1][1] - B_[0][1]) < tol:
                        # only continue straight-ish (keep corners of a T junction as separate strokes)
                        if len(A_) > 1 and len(B_) > 1:
                            u = np.subtract(A_[-1], A_[-2]); v = np.subtract(B_[1], B_[0])
                            if np.dot(u, v) / (np.linalg.norm(u) * np.linalg.norm(v) + 1e-9) < 0.3: continue
                        opn[i] = {'pts': A_ + B_[1:], 'closed': False}; opn.pop(j); changed = True; break
                if changed: break
            if changed: break
    return done + opn
out = join(out)

# drawing order: big strokes first (the outline), then nearest-next, so the trace builds her like a drawing
out.sort(key=lambda s: -length(s['pts']))
order = [out.pop(0)]
while out:
    e = order[-1]['pts'][-1]
    k = min(range(len(out)), key=lambda i: min(np.hypot(out[i]['pts'][0][0] - e[0], out[i]['pts'][0][1] - e[1]), np.hypot(out[i]['pts'][-1][0] - e[0], out[i]['pts'][-1][1] - e[1])) - length(out[i]['pts']) * 0.02)
    st = out.pop(k)
    if not st['closed'] and np.hypot(st['pts'][-1][0] - e[0], st['pts'][-1][1] - e[1]) < np.hypot(st['pts'][0][0] - e[0], st['pts'][0][1] - e[1]):
        st['pts'] = st['pts'][::-1]
    order.append(st)

cx, cy = Ww / 2, Hh / 2
marks_p = os.path.join(A, 'marks.json'); marks = json.load(open(marks_p))
marks['tracyArt'] = {'aspect': round(Ww / Hh, 4), 'strokes': [[[round((x - cx) / Hh, 4), round(-(y - cy) / Hh, 4)] for x, y in st['pts']] for st in order]}
json.dump(marks, open(marks_p, 'w'))
total = sum(length(st['pts']) for st in order)
print(f"strokes {len(order)}  points {sum(len(s['pts']) for s in order)}  length {total:.0f}px of {Hh}px height  filled parts {n}")

# preview
from PIL import ImageDraw
im = Image.new('RGB', (Ww, Hh), (6, 87, 255)); d = ImageDraw.Draw(im)
for st in order: d.line(st['pts'], fill='white', width=2)
im.save(os.path.join(HERE, 'tracy-line-preview.png'))
