#!/usr/bin/env python3
# Builds a map file for the editor from a map description (a JSON spec), so one script makes any map.
# Usage: python3 tools/map-editor/build_map.py samples/maps/specs/<name>.json [reference image]
#
# Everything in a spec is measured in reference pixels (the picture you trace, or any made-up canvas) and scaled by
# "scale" to map pixels. Steps run in this order:
#   base      the ground everywhere
#   trace     optional: materials found from the reference image's brightness (needs the image on the command line)
#   paint     shapes painted in order, each with a material and/or a level
#   rooms     floors with walls round them, then openings cut through the walls
#   finish    more painting after the rooms (bridges, stair stubs, …); then small pockets that rooms and walls shut in
#             (up to rooms.pocket map pixels, default 1500) are filled with wall
#   objects   placed things; "look" picks a seed whose sprite has that color or style
# Shapes:
#   {"rect": [x0, y0, x1, y1]}   {"oct": [x0, y0, x1, y1, cut], "corners": "all|top|bottom|left|right"}
#   {"poly": [[x, y], …]}   {"circle": [cx, cy, r]}   {"ellipse": [cx, cy, rx, ry]}   {"line": [[x, y], …], "width": w}
#   any shape may add "minus": shape, and {"union": [shape, …]} joins shapes.
# Paint options: "material" (any material id from the editor, or "nowater" / "noscatter" to clear a layer), "level"
# (flat terrace level), "wobble": [pixels, size] (ragged edge), "patches": [fraction, size] (keep only noise patches),
# "onlyOn": [material ids] (only over that ground), "rim": {"of": material id, "width": [min, max]} (a band round it).
import base64, json, math, os, re, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
EDITOR = os.path.join(HERE, '..', '..', 'map-editor')
MAPS = os.path.join(HERE, '..', '..', 'samples', 'maps')


# ---------- Materials, read from the editor so names always match ----------

def editor_materials():
    src = open(os.path.join(EDITOR, 'js', 'model', 'constants.js')).read()
    consts = {}
    for name in ('GROUND', 'WATER', 'SCATTER'):
        body = re.search(r'const %s = \{([^}]*)\}' % name, src).group(1)
        consts[name] = {k: int(v) for k, v in re.findall(r'(\w+):\s*(\d+)', body)}
    mats = {}
    for mid, layer, value in re.findall(r"\{ id: '(\w+)',[^}]*?layer: '(\w+)',\s*value: ([\w.\-]+)", src):
        if '.' in value:
            group, key = value.split('.')
            value = consts[group][key]
        mats[mid] = (layer, int(value))
    return mats, consts


MATERIALS, CONSTS = editor_materials()
LAYERS = ('ground', 'water', 'scatter', 'terrace')


# ---------- Masks ----------

class Canvas:
    def __init__(self, spec):
        self.k = spec['scale']
        rw, rh = spec['reference']
        self.w, self.h = round(rw * self.k), round(rh * self.k)

    def m(self, v): return v * self.k

    def draw(self, fn):
        im = Image.new('L', (self.w, self.h), 0)
        fn(ImageDraw.Draw(im))
        return np.asarray(im).astype(bool)

    def shape(self, s):
        if 'union' in s:
            out = np.zeros((self.h, self.w), bool)
            for part in s['union']: out |= self.shape(part)
        elif 'rect' in s:
            x0, y0, x1, y1 = s['rect']
            out = np.zeros((self.h, self.w), bool)
            out[round(self.m(y0)):round(self.m(y1)), round(self.m(x0)):round(self.m(x1))] = True
        elif 'oct' in s:
            x0, y0, x1, y1, cut = s['oct']
            side = s.get('corners', 'all')
            c = {k: cut if side == 'all' or side in names else 0 for k, names in
                 (('tl', ('top', 'left')), ('tr', ('top', 'right')), ('bl', ('bottom', 'left')), ('br', ('bottom', 'right')))}
            out = self.poly([(x0 + c['tl'], y0), (x1 - c['tr'], y0), (x1, y0 + c['tr']), (x1, y1 - c['br']),
                             (x1 - c['br'], y1), (x0 + c['bl'], y1), (x0, y1 - c['bl']), (x0, y0 + c['tl'])])
        elif 'poly' in s:
            out = self.poly(s['poly'])
        elif 'circle' in s:
            cx, cy, r = s['circle']
            out = self.ellipse(cx, cy, r, r)
        elif 'ellipse' in s:
            out = self.ellipse(*s['ellipse'])
        elif 'line' in s:
            out = self.line(s['line'], s.get('width', 10))
        else:
            raise ValueError('unknown shape: %s' % s)
        if 'minus' in s: out = out & ~self.shape(s['minus'])
        return out

    def poly(self, pts):
        return self.draw(lambda d: d.polygon([(self.m(x), self.m(y)) for x, y in pts], fill=1))

    def ellipse(self, cx, cy, rx, ry):
        yy, xx = np.mgrid[0:self.h, 0:self.w]
        return ((xx + 0.5 - self.m(cx)) / self.m(rx)) ** 2 + ((yy + 0.5 - self.m(cy)) / self.m(ry)) ** 2 <= 1

    def line(self, pts, width):
        q = [(self.m(x), self.m(y)) for x, y in pts]
        r = self.m(width) / 2

        def fn(d):
            d.line(q, fill=1, width=max(1, round(self.m(width))), joint='curve')
            for x, y in (q[0], q[-1]): d.ellipse([x - r, y - r, x + r, y + r], fill=1)
        return self.draw(fn)


def dilate(a, r):
    out = a.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(a, dy, 0), dx, 1)
    return out


def components(a):
    """4-connected component labels and sizes."""
    lab = np.zeros(a.shape, np.int32)
    sizes = [0]
    hh, ww = a.shape
    n = 0
    for sy, sx in zip(*np.nonzero(a)):
        if lab[sy, sx]: continue
        n += 1
        stack, count = [(sy, sx)], 0
        lab[sy, sx] = n
        while stack:
            y, x = stack.pop()
            count += 1
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < hh and 0 <= nx < ww and a[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = n
                    stack.append((ny, nx))
        sizes.append(count)
    return lab, np.array(sizes)


def drop_small(a, min_size):
    lab, sizes = components(a)
    keep = sizes >= min_size
    keep[0] = False
    return keep[lab]


def distance(a):
    """Chamfer distance from every pixel to the nearest True pixel."""
    d = np.where(a, 0.0, 1e9)
    hh, ww = a.shape
    s2 = math.sqrt(2)
    for y in range(hh):
        row = d[y]
        if y > 0:
            up = d[y - 1]
            row = np.minimum(row, up + 1)
            row[1:] = np.minimum(row[1:], up[:-1] + s2)
            row[:-1] = np.minimum(row[:-1], up[1:] + s2)
        for x in range(1, ww):
            if row[x - 1] + 1 < row[x]: row[x] = row[x - 1] + 1
        d[y] = row
    for y in range(hh - 1, -1, -1):
        row = d[y]
        if y < hh - 1:
            dn = d[y + 1]
            row = np.minimum(row, dn + 1)
            row[1:] = np.minimum(row[1:], dn[:-1] + s2)
            row[:-1] = np.minimum(row[:-1], dn[1:] + s2)
        for x in range(ww - 2, -1, -1):
            if row[x + 1] + 1 < row[x]: row[x] = row[x + 1] + 1
        d[y] = row
    return d


def noise(w, h, size, salt):
    """Smooth value noise in 0..1."""
    rng = np.random.default_rng(salt)
    size = max(1, size)
    grid = rng.random((h // size + 2, w // size + 2))
    yy, xx = np.mgrid[0:h, 0:w] / size
    x0, y0 = xx.astype(int), yy.astype(int)
    fx, fy = xx - x0, yy - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    top = grid[y0, x0] * (1 - fx) + grid[y0, x0 + 1] * fx
    bottom = grid[y0 + 1, x0] * (1 - fx) + grid[y0 + 1, x0 + 1] * fx
    return top * (1 - fy) + bottom * fy


# ---------- Building ----------

class Builder:
    def __init__(self, spec, image):
        self.spec = spec
        self.cv = Canvas(spec)
        w, h = self.cv.w, self.cv.h
        self.layer = {name: np.zeros((h, w), np.uint8) for name in LAYERS}
        self.image = image
        self.salt = 0

    def material(self, mid):
        if mid not in MATERIALS: raise ValueError('unknown material "%s" (one of: %s)' % (mid, ', '.join(sorted(MATERIALS))))
        return MATERIALS[mid]

    def put(self, mask, mid=None, level=None):
        """Writes a material and/or a terrace level. Ground clears water, as painting does in the editor."""
        if mid == 'nowater': self.layer['water'][mask] = 0
        elif mid == 'noscatter': self.layer['scatter'][mask] = 0
        elif mid:
            layer, value = self.material(mid)
            self.layer[layer][mask] = value
            if layer == 'ground': self.layer['water'][mask] = 0
        if level is not None: self.layer['terrace'][mask] = level + 1 if level > 0 else 0

    def is_material(self, mid):
        layer, value = self.material(mid)
        return self.layer[layer] == value

    def paint(self, op):
        self.salt += 1
        if 'rim' in op:
            r = op['rim']
            inside = self.is_material(r['of'])
            lo, hi = r.get('width', [2, 5])
            mask = ~inside & (distance(inside) <= lo + (hi - lo) * noise(self.cv.w, self.cv.h, 9, 100 + self.salt))
        else:
            mask = self.cv.shape(op['shape'])
        if 'wobble' in op:
            amp, size = op['wobble']
            inner, outer = distance(~mask), distance(mask)
            signed = np.where(mask, inner, -outer) + (noise(self.cv.w, self.cv.h, size, 200 + self.salt) - 0.5) * 2 * amp
            mask = signed > 0
        if 'patches' in op:
            keep, size = op['patches']
            mask &= noise(self.cv.w, self.cv.h, size, 300 + self.salt) < keep
        if 'onlyOn' in op:
            mask &= np.any([self.is_material(m) for m in op['onlyOn']], axis=0)
        self.put(mask, op.get('material'), op.get('level'))

    def trace(self, op):
        """A material wherever the reference is darker than a brightness (0-255): dark voids, deep water…"""
        if self.image is None: raise SystemExit('this spec traces the reference: pass its image after the spec')
        img = Image.open(self.image).convert('RGB')
        if list(img.size) != list(self.spec['reference']): raise SystemExit('the reference image should be %d x %d' % tuple(self.spec['reference']))
        small = np.asarray(img.resize((self.cv.w, self.cv.h), Image.BOX).filter(ImageFilter.GaussianBlur(op.get('blur', 1.5)))).astype(float)
        mask = small.mean(2) < op['darkerThan']
        if 'skip' in op: mask &= ~dilate(self.cv.shape(op['skip']), 2)
        mask = drop_small(mask, op.get('minArea', 150))
        mask |= ~drop_small(~mask, op.get('fillSpecks', 80))
        self.put(mask, op['material'])

    def rooms(self, spec):
        w, h = self.cv.w, self.cv.h
        thick = spec.get('thickness', 4)
        floor, mat, lvl = np.zeros((h, w), bool), np.zeros((h, w), np.uint8), np.zeros((h, w), np.uint8)
        ground = lambda mid: self.material(mid)[1]
        for r in spec['list']:
            mk = self.cv.shape(r['shape'])
            floor |= mk
            mat[mk] = ground(r['floor'])
            lvl[mk] = r.get('level', 0)
        walls = dilate(floor, thick) & ~floor
        wall_lvl = np.zeros((h, w), np.uint8)
        for dy in range(-thick, thick + 1):
            for dx in range(-thick, thick + 1):
                wall_lvl = np.maximum(wall_lvl, np.roll(np.roll(np.where(floor, lvl, 0), dy, 0), dx, 1))
        for o in spec.get('openings', []):
            mk = self.cv.shape(o['shape'])
            walls &= ~mk
            floor |= mk
            mat[mk] = ground(o['floor'])
            lvl[mk] = o.get('level', 0)
        wall = ground(spec.get('wall', 'stonewall'))
        g, t = self.layer['ground'], self.layer['terrace']
        g[floor], g[walls] = mat[floor], wall
        t[floor] = np.where(lvl[floor] > 0, lvl[floor] + 1, 0)
        t[walls] = np.where(wall_lvl[walls] > 0, wall_lvl[walls] + 1, 0)
        self.layer['water'][floor | walls] = 0
        self.layer['scatter'][floor | walls] = 0
        self.room_floor, self.wall = floor, wall

    def fill_pockets(self, max_size):
        """Small spaces shut in by rooms and walls (not reaching the map edge) become wall at the walls' level."""
        g, t = self.layer['ground'], self.layer['terrace']
        lab, sizes = components(~(self.room_floor | (g == self.wall)))
        edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
        pocket = np.array([n not in edge and 0 < sizes[n] <= max_size for n in range(len(sizes))])[lab]
        g[pocket] = self.wall
        self.layer['water'][pocket] = self.layer['scatter'][pocket] = 0
        level = np.where(pocket, 0, t)
        while True:
            grown = level.copy()
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                grown = np.maximum(grown, np.roll(np.roll(level, dy, 0), dx, 1))
            grown = np.where(pocket, grown, t)
            if (grown == level).all(): break
            level = grown
        t[pocket] = level[pocket]

    def build(self):
        s = self.spec
        self.put(np.ones((self.cv.h, self.cv.w), bool), s.get('base', 'dirt'))
        for op in s.get('trace', []): self.trace(op)
        for op in s.get('paint', []): self.paint(op)
        if 'rooms' in s: self.rooms(s['rooms'])
        for op in s.get('finish', []): self.paint(op)
        if 'rooms' in s: self.fill_pockets(s['rooms'].get('pocket', 1500))
        return Objects(self.cv).place(s.get('objects', []))


# ---------- Objects and their looks ----------

def make_rng(seed):
    """Random.makeRng from the editor (mulberry32)."""
    a = [seed & 0xFFFFFFFF]
    def imul(p, q): return (p * q) & 0xFFFFFFFF
    def nxt():
        a[0] = (a[0] + 0x6D2B79F5) & 0xFFFFFFFF
        v = a[0]
        t = imul(v ^ (v >> 15), 1 | v)
        t = ((t + imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF) ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return nxt


CLOTH = ['red', 'blue', 'green']
BEDROLL = ['red', 'blue', 'green', 'yellow', 'canvas']


def tent_test(look):
    color, _, shape = look.partition(' ')
    def test(r):
        c = r()
        c = 'canvas' if c < 0.7 else 'purple' if c < 0.85 else 'blue'
        return c == color and (r() < 0.7) == ((shape or 'round') == 'round')
    return test


# For each type: look name → a test of the sprite's rolls (after the size roll every sprite makes first).
LOOKS = {
    'bed': lambda look: lambda r: CLOTH[int(r() * 3)] == look,
    'rug': lambda look: lambda r: CLOTH[int(r() * 3)] == look,
    'roundrug': lambda look: (lambda r: r() < 0.25) if look == 'stone' else (lambda r: r() >= 0.25 and CLOTH[int(r() * 3)] == look),
    'bedroll': lambda look: lambda r: BEDROLL[int(r() * 5)] == look,
    'tent': tent_test,
}


def seed_for(type_, look, start):
    if type_ not in LOOKS: raise ValueError('"%s" has no looks to pick (looks work for: %s)' % (type_, ', '.join(LOOKS)))
    test = LOOKS[type_](look)
    for s in range(start, start + 100000):
        rng = make_rng(s)
        rng()
        if test(rng): return s
    raise ValueError('no seed gives a %s "%s"' % (type_, look))


class Objects:
    def __init__(self, cv):
        self.cv = cv
        self.out = []

    def add(self, type_, x, y, opts):
        n = len(self.out) + 1
        start = opts.get('seed', 1000 + n * 7919)
        seed = seed_for(type_, opts['look'], start) if 'look' in opts else start
        o = {'id': n, 'type': type_, 'x': int(round(self.cv.m(x))), 'y': int(round(self.cv.m(y))), 'seed': seed, 'scale': opts.get('scale', 1)}
        if opts.get('turn'): o['turn'] = 1
        self.out.append(o)

    def place(self, items):
        """Items: ["type", x, y, {options}] or {"type": …, "at": [[x, y], …], options}."""
        for it in items:
            if isinstance(it, dict):
                opts = {k: v for k, v in it.items() if k not in ('type', 'at')}
                for x, y in it['at']: self.add(it['type'], x, y, opts)
            else:
                self.add(it[0], it[1], it[2], it[3] if len(it) > 3 else {})
        return self.out


def main():
    if len(sys.argv) < 2: raise SystemExit(__doc__ or 'usage: build_map.py spec.json [reference image]')
    spec_path = sys.argv[1]
    spec = json.load(open(spec_path))
    b = Builder(spec, sys.argv[2] if len(sys.argv) > 2 else None)
    objects = b.build()
    settings = dict(spec.get('settings', {}))
    if 'colors' in spec: settings['colors'] = spec['colors']
    enc = lambda a: base64.b64encode(a.astype(np.uint8).tobytes()).decode()
    w, h = b.cv.w, b.cv.h
    data = {
        'version': 1, 'name': spec['name'], 'width': w, 'height': h, 'seed': spec.get('seed', 1),
        'ground': enc(b.layer['ground']), 'water': enc(b.layer['water']), 'scatter': enc(b.layer['scatter']),
        'elevation': enc(np.zeros((h, w))), 'terrace': enc(b.layer['terrace']),
        'rivers': [], 'objects': objects, 'nextId': len(objects) + 1, 'settings': settings,
    }
    name = spec.get('file', re.sub(r'[^a-z0-9]+', '-', spec['name'].lower()).strip('-'))
    out = os.path.normpath(os.path.join(MAPS, name + '.json'))
    with open(out, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    print('wrote', out, w, 'x', h, len(objects), 'objects')


if __name__ == '__main__':
    main()
