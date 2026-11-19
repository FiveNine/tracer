"""Tracy as the line itself: the line-art mascot vectorised into strokes the trace can draw, plus the filled art that
fills in once the drawing is done (the fill itself: tracy-fill.py).

  python3 tracy-line.py   (needs numpy, scipy, scikit-image)
    -> 'tracyArt' in ../../assets/marks.json, tracy-line-preview.png

Thin strokes become their centrelines: the skeleton is pruned of short spurs, walked into polylines, joined straight
through junctions, and ends that stop just short of another stroke are carried on to meet it (no gaps). Filled parts
(pupils, nose, heart, eyebrows, the t badge) are drawn by their outline, traced sub-pixel from a softened mask.
Every polyline is resampled evenly, then smoothed, so curves are as clean as the art.
Coordinates are normalised like the 'tracy' silhouette: centred on the line art's box, height 1, y up.
"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage.morphology import skeletonize, opening, dilation, disk, remove_small_objects
from skimage.measure import find_contours

HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, '..', '..', 'assets')
H_PX = 1400                    # working height: strokes are ~9-12 px wide here
THICK = 9                      # parts wider than ~2x this are "filled" and get an outline
SPUR = 16                      # skeleton branches shorter than this (px) that end in nothing are noise
GAP = 22                       # a stroke end this close to another stroke is carried on to meet it

src = Image.open(os.path.join(HERE, '6.webp')).convert('RGBA')
r, g, b, a = [np.asarray(c, dtype=np.float32) for c in src.split()]
ys, xs = np.nonzero(a > 10); box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
inkf = np.clip(((b - r) - 30) / 60, 0, 1) * (a / 255)            # soft ink coverage 0..1
inkf = inkf[box[1]:box[3], box[0]:box[2]]
s = H_PX / inkf.shape[0]
W = round(inkf.shape[1] * s)
inkf = np.asarray(Image.fromarray((inkf * 255).astype(np.uint8)).resize((W, H_PX), Image.BICUBIC)).astype(np.float32) / 255
ink = remove_small_objects(inkf > 0.5, max_size=30)
Hh, Ww = ink.shape

filled = opening(ink, disk(THICK))
filled = remove_small_objects(filled, max_size=500)   # fur tips and specks are not shapes; a circle drawn round them looks like a fault
thin = ink & ~dilation(filled, disk(1))
thin = remove_small_objects(thin, max_size=20)

# ---------- skeleton graph ----------
def graph(sk):
    P = set(zip(*np.nonzero(sk)))
    nb = lambda p: [(p[0] + dy, p[1] + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx) and (p[0] + dy, p[1] + dx) in P]
    return P, nb

def walk_all(sk):
    P, nb = graph(sk)
    deg = {p: len(nb(p)) for p in P}
    seen, paths = set(), []
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
            if frozenset((p, q)) not in seen: paths.append(walk(p, q))
    for p in P:
        for q in nb(p):
            if frozenset((p, q)) not in seen: paths.append(walk(p, q))
    return paths, deg

sk = skeletonize(thin)
# prune spurs: short branches from a junction to a dead end
for _ in range(3):
    paths, deg = walk_all(sk)
    cut = False
    for pth in paths:
        ends = [deg[pth[0]], deg[pth[-1]]]
        if len(pth) < SPUR and 1 in ends and max(ends) >= 3:
            for p in pth:
                if deg[p] <= 2: sk[p] = False
            cut = True
    if not cut: break
paths, deg = walk_all(sk)
strokes = [{'pts': [(float(x), float(y)) for y, x in p], 'closed': len(p) > 3 and p[0] == p[-1]} for p in paths if len(p) > 3]

def length(pts): return float(sum(np.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1)))

# join strokes through junctions where they continue straight (each skeleton junction splits a line in two)
def join(strokes, tol=3.0, straight=0.45):
    opn = [s for s in strokes if not s['closed']]; done = [s for s in strokes if s['closed']]
    def dirn(pts, end):
        k = min(6, len(pts) - 1)
        v = np.subtract(pts[-1], pts[-1 - k]) if end else np.subtract(pts[0], pts[k])
        return v / (np.linalg.norm(v) + 1e-9)
    while True:
        best = None
        for i in range(len(opn)):
            for j in range(len(opn)):
                if i == j: continue
                for ra in (False, True):
                    for rb in (False, True):
                        a_ = opn[i]['pts'][::-1] if ra else opn[i]['pts']; b_ = opn[j]['pts'][::-1] if rb else opn[j]['pts']
                        d = np.hypot(a_[-1][0] - b_[0][0], a_[-1][1] - b_[0][1])
                        if d > tol: continue
                        c = float(np.dot(dirn(a_, True), -dirn(b_, False)))   # 1 = straight on
                        if c < straight: continue
                        if best is None or c > best[0]: best = (c, i, j, a_, b_)
        if not best: break
        _, i, j, a_, b_ = best
        merged = {'pts': a_ + b_[1:], 'closed': False}
        if np.hypot(merged['pts'][0][0] - merged['pts'][-1][0], merged['pts'][0][1] - merged['pts'][-1][1]) < tol and len(merged['pts']) > 20:
            merged = {'pts': merged['pts'] + [merged['pts'][0]], 'closed': True}
        opn = [s for k, s in enumerate(opn) if k not in (i, j)] + ([merged] if not merged['closed'] else []); done += [merged] if merged['closed'] else []
    return done + opn
strokes = join(strokes)

# outlines of the filled parts (sub-pixel, from a softened mask)
soft = ndi.gaussian_filter(np.pad(filled, 4).astype(np.float32), 1.2)
lab, n = ndi.label(np.pad(filled, 4))
for i in range(1, n + 1):
    m = ndi.gaussian_filter((lab == i).astype(np.float32), 1.2)
    for c in find_contours(m, 0.5):
        pts = [(float(x - 4), float(y - 4)) for y, x in c]
        if length(pts) > 20: strokes.append({'pts': pts, 'closed': True})

# carry open ends on to a stroke just ahead of them (T-junctions the skeleton left short)
allpts = np.array([p for st in strokes for p in st['pts']])
owner = np.concatenate([[k] * len(st['pts']) for k, st in enumerate(strokes)])
for k, st in enumerate(strokes):
    if st['closed'] or len(st['pts']) < 4: continue
    for end in (0, -1):
        e = np.array(st['pts'][end]); prev = np.array(st['pts'][1 if end == 0 else -2])
        d = np.hypot(*(allpts - e).T); d[owner == k] = 1e9
        j = int(np.argmin(d))
        if 1.5 < d[j] < GAP:
            v = e - prev; w = allpts[j] - e
            if np.dot(v, w) > -0.2 * np.linalg.norm(v) * np.linalg.norm(w):   # roughly ahead, not behind
                if end == 0: st['pts'].insert(0, tuple(allpts[j]))
                else: st['pts'].append(tuple(allpts[j]))

# even resampling, then smoothing (pixel stairs out, curves kept), then light simplification
def resample(pts, step):
    p = np.array(pts); seg = np.hypot(*np.diff(p, axis=0).T); cum = np.concatenate([[0], np.cumsum(seg)])
    if cum[-1] < step: return [tuple(v) for v in p]
    t = np.linspace(0, cum[-1], max(2, int(cum[-1] / step) + 1))
    return list(zip(np.interp(t, cum, p[:, 0]), np.interp(t, cum, p[:, 1])))
def smooth(pts, closed, k, passes):
    p = np.array(pts, dtype=float)
    if closed: p = p[:-1]
    for _ in range(passes):
        if closed: q = sum(np.roll(p, j, axis=0) for j in range(-k, k + 1)) / (2 * k + 1)
        else:
            pad = np.concatenate([np.repeat(p[:1], k, 0), p, np.repeat(p[-1:], k, 0)])
            q = np.array([pad[i:i + 2 * k + 1].mean(axis=0) for i in range(len(p))]); q[0], q[-1] = p[0], p[-1]
        p = q
    if closed: p = np.vstack([p, p[:1]])
    return [tuple(v) for v in p]
def dp(pts, eps):
    if len(pts) < 3: return pts
    a, b = np.array(pts[0]), np.array(pts[-1]); d = b - a; L = np.hypot(*d) or 1e-9
    P = np.array(pts[1:-1]); dist = np.abs(d[1] * P[:, 0] - d[0] * P[:, 1] + b[0] * a[1] - b[1] * a[0]) / L
    i = int(np.argmax(dist)) + 1
    return dp(pts[:i + 1], eps)[:-1] + dp(pts[i:], eps) if dist[i - 1] > eps else [pts[0], pts[-1]]

out = []
for st in strokes:
    if length(st['pts']) < 14: continue
    pts = resample(st['pts'], 2.0)
    pts = smooth(pts, st['closed'], 3, 3)
    if st['closed']:   # a loop starts and ends on one point: split it at its far side and simplify both halves
        far = max(range(len(pts)), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
        pts = dp(pts[:far + 1], 0.25)[:-1] + dp(pts[far:], 0.25)
    else:
        pts = dp(pts, 0.25)
    if not st['closed'] and len(pts) > 2:   # reach a little past each end, so strokes close their joins (overlaps never show)
        def ext(a, b, d=5.0):
            v = np.subtract(a, b); n_ = np.linalg.norm(v); return tuple(np.add(a, v / n_ * d)) if n_ > 1e-6 else a
        pts = [ext(pts[0], pts[1])] + list(pts) + [ext(pts[-1], pts[-2])]
    out.append({'pts': pts, 'closed': st['closed']})

# drawing order: the big outline first, then nearest-next, so the trace builds her like a drawing
out.sort(key=lambda s: -length(s['pts']))
order = [out.pop(0)]
while out:
    e = order[-1]['pts'][-1]
    dist = lambda st: min(np.hypot(st['pts'][0][0] - e[0], st['pts'][0][1] - e[1]), np.hypot(st['pts'][-1][0] - e[0], st['pts'][-1][1] - e[1]))
    k = min(range(len(out)), key=lambda i: dist(out[i]) - length(out[i]['pts']) * 0.02)
    st = out.pop(k)
    if not st['closed'] and np.hypot(st['pts'][-1][0] - e[0], st['pts'][-1][1] - e[1]) < np.hypot(st['pts'][0][0] - e[0], st['pts'][0][1] - e[1]):
        st['pts'] = st['pts'][::-1]
    order.append(st)

cx, cy = Ww / 2, Hh / 2
marks_p = os.path.join(A, 'marks.json'); marks = json.load(open(marks_p))
marks['tracyArt'] = {'aspect': round(Ww / Hh, 4), 'strokes': [[[round((x - cx) / Hh, 5), round(-(y - cy) / Hh, 5)] for x, y in st['pts']] for st in order]}
json.dump(marks, open(marks_p, 'w'))

total = sum(length(st['pts']) for st in order)
print(f"strokes {len(order)}  points {sum(len(s['pts']) for s in order)}  length {total:.0f}px of {Hh}px  filled parts {n}")

from PIL import ImageDraw
im = Image.new('RGB', (Ww, Hh), (244, 246, 251)); d = ImageDraw.Draw(im)
for st in order: d.line(st['pts'], fill=(6, 87, 255), width=3, joint='curve')
im.save(os.path.join(HERE, 'tracy-line-preview.png'))
