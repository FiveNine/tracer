"""Tracy for the site: the filled mascot (chat launcher), the line-art one as a stroke mask, and her silhouette for the line.
  python3 tracy.py  ->  ../../assets/tracy-face.png, ../../assets/tracy-line.png, adds 'tracy' to ../../assets/marks.json
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageChops, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, '..', '..', 'assets')
sys.path.insert(0, os.path.join(HERE, '..'))

def cutout(src):
    """the supplied art already has a transparent background"""
    return Image.open(src).convert('RGBA')

# 1. filled Tracy for the launcher: tight crop, 320 px wide
face = cutout(os.path.join(HERE, '5.webp'))
face = face.crop(face.split()[3].getbbox()); face.thumbnail((320, 400), Image.LANCZOS)
face.save(os.path.join(A, 'tracy-face.png'), optimize=True)

# 2. line-art Tracy as a mask: alpha = how blue the pixel is (strokes), colour set by CSS (mask-image)
line = Image.open(os.path.join(HERE, '6.webp')).convert('RGB')
r, g, b = line.split()
alpha = ImageChops.multiply(ImageChops.subtract(b, r).point(lambda v: min(255, int(v * 1.25))), Image.open(os.path.join(HERE, '6.webp')).split()[3])   # blue strokes: b - r is large; white: 0
fig = cutout(os.path.join(HERE, '6.webp'))
bbox = fig.split()[3].getbbox()
mask = Image.merge('RGBA', [Image.new('L', line.size, 255)] * 3 + [alpha]).crop(bbox)
mask.thumbnail((900, 1000), Image.LANCZOS)
mask.save(os.path.join(A, 'tracy-line.png'), optimize=True)

# 3. her silhouette (outer loop of the figure), normalised like the marks: height 1, centred on the crop box
import contextlib, io
with contextlib.redirect_stdout(io.StringIO()):
    from contours import loops_of, dp, chaikin, area
sil = fig.split()[3].crop(bbox)
W, H = sil.size; s = 0.35
small = sil.resize((int(W * s), int(H * s)), Image.LANCZOS).filter(ImageFilter.MaxFilter(3))
sw, sh = small.size; px = small.load()
m = [[1 if px[x, y] > 128 else 0 for x in range(sw)] for y in range(sh)]
loops = sorted(loops_of(sw, sh, m), key=lambda l: -abs(area(l)))
lp = loops[0]
far = max(range(len(lp)), key=lambda k: (lp[k][0] - lp[0][0]) ** 2 + (lp[k][1] - lp[0][1]) ** 2)
pts = chaikin(dp(lp[:far + 1], 0.7)[:-1] + dp(lp[far:] + [lp[0]], 0.7)[:-1], 2)
cx, cy = sw / 2, sh / 2
marks_p = os.path.join(A, 'marks.json'); marks = json.load(open(marks_p))
marks['tracy'] = {'aspect': round(sw / sh, 4), 'loops': [{'hole': False, 'pts': [[round((x - cx) / sh, 4), round(-(y - cy) / sh, 4)] for x, y in pts]}]}
json.dump(marks, open(marks_p, 'w'))
print('face', face.size, 'line', mask.size, 'silhouette pts', len(pts), 'aspect', marks['tracy']['aspect'])
