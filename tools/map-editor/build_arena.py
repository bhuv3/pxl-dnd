#!/usr/bin/env python3
# Builds maps/grand-arena.json: an arena traced from a 1200 x 1714 reference (27 x 39 squares).
# Shapes are measured in reference pixels and scaled to the map (10 map pixels = 1 square).
import base64, json, math, os

W, H = 270, 390
SX, SY = W / 1200, H / 1714
CX, CY = 600, 856            # centre of the round platform (reference pixels)

DIRT, SAND, COBBLE, FLAG, ROCK, WALL, WOOD = 0, 2, 5, 7, 10, 11, 12
LAKE = 1

ground = bytearray([SAND]) * (W * H)
water = bytearray(W * H)
terrace = bytearray(W * H)
objects = []


# Reference-pixel point at the centre of map pixel (i, j).
def ref(i, j):
    return (i + 0.5) / SX, (j + 0.5) / SY


# Calls fn(i, j, x, y) for every map pixel.
def each(fn):
    for j in range(H):
        for i in range(W):
            x, y = ref(i, j)
            fn(i, j, x, y)


# Distance outside the arena floor: a stadium with rounder corners at the bottom (negative inside).
def arena_dist(x, y):
    left, right, top, bottom = 192, 1008, 170, 1585
    r = 245 if y < CY else 300
    cy = top + r if y < CY else bottom - r
    cx = left + r if x < CX else right - r
    if (x < CX and x > cx) or (x >= CX and x < cx) or (y < CY and y > cy) or (y >= CY and y < cy):
        return max(left - x, x - right, top - y, y - bottom)
    return math.hypot(x - cx, y - cy) - r


# Mirrors a reference point into each quadrant around the platform centre.
def quad(x, y):
    return abs(x - CX), abs(y - CY)


# Rebuilds ground, water, and terrace for one pixel, painting in back-to-front order.
def paint(i, j, x, y):
    k = j * W + i
    d = arena_dist(x, y)
    g, wtr, t = SAND, 0, 0
    qx, qy = quad(x, y)
    r = math.hypot(x - CX, y - CY)

    # Stands: stone arena wall, a dark walkway, wooden benches with low stone risers, an outer wall.
    if d >= 0:
        if d < 30: g = WALL
        elif d < 44: g = COBBLE
        elif d > 60 and ((d - 80) % 36 < 4.5 or (d - 80) % 36 > 31.5): g = WALL
        else: g = WOOD
    else:
        # Corner pools: a rectangle cut by an arc around the platform, with a flagstone kerb.
        if 178 <= qx <= 422 and 172 <= qy <= 384 and r >= 390:
            wtr = LAKE
        elif 170 <= qx <= 431 and 163 <= qy <= 393 and r >= 381:
            g = FLAG
        # Moat ring and its kerb.
        if 240 <= r < 276: wtr = LAKE
        elif 276 <= r < 285: g = FLAG

    # Round platform: flagstones, a balustrade ring, and a cobble dais in the middle.
    if r < 240:
        wtr, t = 0, 2
        g = WALL if r >= 223 else FLAG
        if 30 <= r < 66: g = COBBLE
    # Causeways from the platform to the end platforms.
    if qx <= 47 and 223 <= qy <= 470:
        wtr, t = 0, 2
        g = WALL if qx > 32 else FLAG
    # End platforms (top at y 250-387, bottom mirrored around the centre), with walls on the outer edges.
    if qx <= 130 and 469 <= qy <= 606:
        wtr, t = 0, 2
        edge = qy > 591 or (qy < 484 and qx > 32) or (qx > 115 and not (500 <= qy <= 573))
        g = WALL if edge else FLAG
    # Stairs down each side of the end platforms (left at ground level: the editor adds the steps).
    if 130 < qx <= 180 and 493 <= qy <= 573:
        wtr, t, g = 0, 0, FLAG
    # Pillar bulges along the causeway walls.
    if math.hypot(qx - 40, qy - 341) < 17 and qx > 32:
        wtr, t, g = 0, 2, WALL
    # Brazier pedestals (diamonds) at the four diagonals of the moat.
    if abs(qx - 227) + abs(qy - 187) < 46:
        wtr, t, g = 0, 2, FLAG

    # Gatehouse at the top: walls round a tunnel to the map edge, a gap for the door.
    if 480 <= x <= 720 and y <= 215 and d >= -50:
        g, wtr, t = WALL, 0, 0
        if 540 <= x <= 660 and y < 192: g = FLAG
        if 576 <= x <= 624: g = FLAG
    # Bottom gate: a thicker stretch of wall with a doorway and a tunnel out.
    if 470 <= x <= 730 and 1580 <= y <= 1628:
        g, wtr, t = WALL, 0, 0
    if 576 <= x <= 624 and y >= 1580:
        g, wtr, t = FLAG, 0, 0
    # Statue niches in the side walls.
    for nx in (0, 1200):
        ax = abs(x - nx)
        if ax < 192 and 745 <= y <= 952 and d >= 0:
            g, wtr, t = WALL, 0, 0
            if 18 <= ax <= 166 and 762 <= y <= 935: g = FLAG

    ground[k], water[k], terrace[k] = g, wtr, t


each(paint)

# Seeded random numbers, the same as Random.makeRng in the editor.
def make_rng(seed):
    a = [seed & 0xFFFFFFFF]
    def imul(p, q): return (p * q) & 0xFFFFFFFF
    def nxt():
        a[0] = (a[0] + 0x6D2B79F5) & 0xFFFFFFFF
        v = a[0]
        t = imul(v ^ (v >> 15), 1 | v)
        t = ((t + imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF) ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return nxt


# First seed from start whose rug comes out in the first cloth (red): Sprites rolls size, then the rug its cloth.
def red_rug_seed(start):
    s = start
    while True:
        rng = make_rng(s); rng()
        if rng() < 1 / 3: return s
        s += 1


def add(type_, x, y, seed, scale=1):
    objects.append({'id': len(objects) + 1, 'type': type_, 'x': int(round(x)), 'y': int(round(y)), 'seed': seed, 'scale': scale})


def mx(x): return x * SX
def my(y): return y * SY

# Braziers on the pedestals.
for sx_ in (-1, 1):
    for sy_ in (-1, 1):
        add('brazier', mx(CX + sx_ * 227), my(CY + sy_ * 187) + 3, 700 + len(objects))

# Torches along the inside of the arena wall, where the reference has its wall lights.
for x, y in [(203, 345), (203, 518), (203, 688), (203, 1027), (203, 1197), (212, 1370), (383, 182), (383, 1572)]:
    for xx in (x, 1200 - x):
        add('torch', mx(xx), my(y), 900 + len(objects))

# Statues (big stones) in the side niches.
add('rock', mx(92), my(905), 4242, 2.6)
add('rock', mx(1108), my(905), 4243, 2.6)

# Doors in the two gates.
add('door', mx(600), my(205), 51)
add('door', mx(600), my(1610), 52)

# Red awnings over the stands: rugs around the outer ring, skipping gates and niches.
def ring_points(dist, step):
    pts = []
    for j in range(H):
        for i in range(W):
            x, y = ref(i, j)
            if abs(arena_dist(x, y) - dist) < 0.5 / SX: pts.append((x, y))
    pts.sort(key=lambda p: math.atan2(p[1] - CY, p[0] - CX))
    out, last = [], None
    for p in pts:
        if last is None or math.hypot(p[0] - last[0], p[1] - last[1]) >= step:
            out.append(p); last = p
    return out


seed = 3000
for dist, step in ((98, 120), (170, 125), (242, 130)):
    for x, y in ring_points(dist, step):
        if abs(x - CX) < 160 or (745 <= y <= 990) or not (40 < x < 1160 and 40 < y < 1690):
            continue
        seed = red_rug_seed(seed + 1)
        add('rug', mx(x), my(y) + 4, seed)

settings = {
    'edgeWobble': 0, 'raggedEdges': False, 'grassLip': False, 'tuftDensity': 0, 'flowerAmount': 0, 'pebbleAmount': 0.7,
    'beachWidth': 0, 'mudBanks': False, 'lakeSandRim': False, 'reeds': False, 'lilyPads': False, 'beachRocks': False,
    'bridges': False, 'steppingStones': False, 'waveReach': 1,
    'butterflies': 0, 'birds': 2, 'fireflies': 0, 'fish': 8, 'clouds': False, 'wind': False,
    'timeOfDay': 15, 'levelHeight': 8, 'stairs': True,
    'grid': True, 'gridSize': 10, 'gridFeet': 5, 'gridOpacity': 0.18,
    'colors': {
        'grassDark': '#6c6556',   # no grass here: this only colours the flagstone gaps
        'sand': '#d8904a', 'sandDark': '#c47c3c', 'wetSand': '#a8683a',
        'deep': '#123f55', 'mid': '#1b5b72', 'shallow': '#2b7b8e',
        'roof': '#c8302a', 'roofLight': '#e2503e', 'roofDark': '#8e1f1a',
    },
}

data = {
    'version': 1, 'name': 'Grand Arena', 'width': W, 'height': H, 'seed': 1714,
    'ground': base64.b64encode(bytes(ground)).decode(), 'water': base64.b64encode(bytes(water)).decode(),
    'scatter': base64.b64encode(bytes(W * H)).decode(), 'elevation': base64.b64encode(bytes(W * H)).decode(),
    'terrace': base64.b64encode(bytes(terrace)).decode(),
    'rivers': [], 'objects': objects, 'nextId': len(objects) + 1, 'settings': settings,
}
out = os.path.join(os.path.dirname(__file__), '..', '..', 'samples', 'maps', 'grand-arena.json')
with open(out, 'w') as f:
    json.dump(data, f, separators=(',', ':'))
print('wrote', os.path.normpath(out), len(objects), 'objects')
