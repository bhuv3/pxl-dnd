#!/usr/bin/env python3
# Builds maps/canyon-hideout.json: a bandit hideout in a cave around an open canyon, traced from a 1034 x 1500 reference
# battle map (pass its path). The dark void around the caves is found from the reference's brightness; rooms, ridges,
# the canyon, bridges, and every object are measured by hand in reference pixels and scaled to the map.
# Usage: python3 tools/map-editor/build_hideout.py path/to/reference.webp
import base64, json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

REF_W, REF_H = 1034, 1500
K = 0.4                                   # map pixels per reference pixel
W, H = round(REF_W * K), round(REF_H * K)  # 414 x 600

DIRT, GRASS, SAND, PATH, COBBLE, GRAVEL, FLAG, CAVE, ROCK, WALL, WOOD, TILE = 0, 1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13
LAKE, CHASM = 1, 4
FOREST, BUSHES = 1, 5

ground = np.full((H, W), CAVE, np.uint8)
water = np.zeros((H, W), np.uint8)
scatter = np.zeros((H, W), np.uint8)
terrace = np.zeros((H, W), np.uint8)


def m(v): return v * K


def mask_poly(pts):
    """Map-sized mask of a polygon given in reference pixels."""
    im = Image.new('L', (W, H), 0)
    ImageDraw.Draw(im).polygon([(m(x), m(y)) for x, y in pts], fill=1)
    return np.asarray(im).astype(bool)


def mask_rect(x0, y0, x1, y1):
    out = np.zeros((H, W), bool)
    out[round(m(y0)):round(m(y1)), round(m(x0)):round(m(x1))] = True
    return out


def mask_oct(x0, y0, x1, y1, cut, corners='all'):
    """Rectangle with chamfered corners ('all', 'top', 'bottom', 'left', 'right')."""
    c = {'tl': cut if corners in ('all', 'top', 'left') else 0, 'tr': cut if corners in ('all', 'top', 'right') else 0,
         'bl': cut if corners in ('all', 'bottom', 'left') else 0, 'br': cut if corners in ('all', 'bottom', 'right') else 0}
    return mask_poly([(x0 + c['tl'], y0), (x1 - c['tr'], y0), (x1, y0 + c['tr']), (x1, y1 - c['br']),
                      (x1 - c['br'], y1), (x0 + c['bl'], y1), (x0, y1 - c['bl']), (x0, y0 + c['tl'])])


def mask_circle(cx, cy, r):
    yy, xx = np.mgrid[0:H, 0:W]
    return (xx + 0.5 - m(cx)) ** 2 + (yy + 0.5 - m(cy)) ** 2 <= m(r) ** 2


def mask_line(pts, width):
    """A stroke along a polyline (reference pixels), width in reference pixels, round ends."""
    im = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    q = [(m(x), m(y)) for x, y in pts]
    d.line(q, fill=1, width=max(1, round(m(width))), joint='curve')
    r = m(width) / 2
    for x, y in (q[0], q[-1]):
        d.ellipse([x - r, y - r, x + r, y + r], fill=1)
    return np.asarray(im).astype(bool)


def dilate(a, r):
    """Square dilation by r pixels."""
    out = a.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(a, dy, 0), dx, 1)
    return out


def components(a):
    """Labels of 4-connected components and their sizes."""
    lab = np.zeros(a.shape, np.int32)
    sizes = [0]
    hh, ww = a.shape
    n = 0
    for sy in range(hh):
        for sx in range(ww):
            if not a[sy, sx] or lab[sy, sx]:
                continue
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


def value_noise(scale, salt):
    """Smooth noise in 0..1 over the map."""
    rng = np.random.default_rng(salt)
    gw, gh = W // scale + 2, H // scale + 2
    grid = rng.random((gh, gw))
    yy, xx = np.mgrid[0:H, 0:W] / scale
    x0, y0 = xx.astype(int), yy.astype(int)
    fx, fy = xx - x0, yy - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = grid[y0, x0], grid[y0, x0 + 1]
    c, d = grid[y0 + 1, x0], grid[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def distance(a):
    """Chamfer distance (pixels) from every pixel to the nearest True pixel of a."""
    INF = 1e9
    d = np.where(a, 0.0, INF)
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


# ---------- The void (a chasm all round the caves), from the reference's dark pixels ----------

ref = Image.open(sys.argv[1]).convert('RGB')
assert ref.size == (REF_W, REF_H), 'expected the 1034 x 1500 reference'
small = np.asarray(ref.resize((W, H), Image.BOX).filter(ImageFilter.GaussianBlur(1.5))).astype(float)
lum = small.mean(2)

CANYON = [(560, 440), (650, 440), (652, 520), (648, 600), (665, 665), (690, 730), (700, 790), (690, 840), (650, 860),
          (645, 930), (640, 1000), (605, 1060), (595, 1150), (590, 1250), (595, 1350), (605, 1500), (455, 1500), (450, 1300),
          (430, 1180), (390, 1100), (395, 1000), (405, 930), (370, 880), (358, 820), (360, 745), (400, 715), (440, 700),
          (490, 700), (530, 690), (560, 655), (573, 600), (572, 520), (565, 470)]
SPUR = [(458, 452), (505, 440), (548, 458), (568, 500), (573, 560), (568, 620), (552, 660), (525, 688), (488, 698),
        (452, 690), (440, 640), (447, 560), (452, 500)]
EAST_RIDGE = [(650, 440), (700, 438), (745, 470), (765, 520), (800, 570), (835, 630), (840, 700), (820, 760), (790, 800),
              (740, 830), (700, 820), (700, 790), (690, 730), (665, 665), (648, 600), (652, 520)]
WEST_RIDGE = [(295, 700), (360, 682), (420, 690), (440, 700), (400, 715), (360, 745), (358, 820), (370, 880), (405, 930),
              (395, 1000), (390, 1100), (430, 1180), (450, 1300), (455, 1500), (330, 1500), (300, 1440), (345, 1380),
              (350, 1260), (335, 1180), (290, 1130), (275, 1100), (290, 1000), (300, 900), (298, 800)]
FOOT_ROCK = [(195, 1440), (300, 1428), (335, 1500), (195, 1500)]   # rock below the bottom-left camp (signature there)
SOUTH_RIDGE = [(650, 860), (700, 845), (725, 880), (720, 940), (690, 975), (665, 1000), (660, 1100), (655, 1200), (660, 1260),
               (720, 1290), (785, 1300), (795, 1380), (790, 1500), (605, 1500), (595, 1350), (590, 1250), (595, 1150),
               (605, 1060), (640, 1000), (645, 930)]
canyon = mask_poly(CANYON)
ridges = mask_poly(SPUR) | mask_poly(EAST_RIDGE) | mask_poly(WEST_RIDGE) | mask_poly(SOUTH_RIDGE) | mask_poly(FOOT_ROCK)

void = lum < 20
void &= ~dilate(canyon | ridges, 2)
void = drop_small(void, 150)
void |= ~drop_small(~void, 80)            # fill small bright specks (stars, haze) inside the void
void |= mask_poly([(774, 246), (666, 193), (641, 244), (749, 296)])   # the narrow crevice under the long bridge
void |= mask_rect(0, 1440, 200, 1500)                                  # under the reference's signature
water[void] = CHASM

# Rock rims along the edge of the drop, 2-5 pixels wide.
edge = distance(void)
rim = (~void) & (edge <= 2 + 3 * value_noise(9, 5))
ground[rim] = ROCK

# ---------- The canyon: grass, a dirt path, ridges, trees ----------

ground[canyon] = GRASS
water[canyon] = 0
clearing = mask_circle(520, 790, 95) | mask_circle(600, 690, 45)
ground[canyon & clearing & (value_noise(7, 11) < 0.62)] = DIRT
ground[ridges & ~canyon] = ROCK
water[ridges] = 0

TRAIL = [(612, 440), (614, 520), (618, 600), (612, 690), (590, 770), (555, 840), (525, 900), (505, 960), (495, 1050),
         (497, 1150), (502, 1250), (506, 1350), (512, 1500)]
trail = mask_line(TRAIL, 26)
ground[trail & canyon] = PATH

# Forest along the canyon sides (scatter keeps off the path), bushes at its feet.
inside = distance(~canyon)
scatter[canyon & (inside < 14) & (value_noise(6, 21) < 0.75)] = FOREST
scatter[canyon & (inside >= 14) & (inside < 20) & (value_noise(5, 23) < 0.35)] = BUSHES
scatter[clearing & mask_circle(520, 800, 70)] = 0

# ---------- The pond with its jetty ----------

pond = mask_poly([(852, 1030), (900, 1012), (958, 1018), (988, 1055), (986, 1118), (952, 1148), (902, 1150), (862, 1132), (846, 1082)])
water[pond] = LAKE
ground[pond] = CAVE

# ---------- Rooms ----------
# Each room: floor mask, floor material, level (0 = cave level). Walls are 4 pixels round every floor; a wall between two
# levels takes the higher one. Openings are carved afterwards.

rooms = []


def room(mask, mat, level=0):
    rooms.append((mask, mat, level))


# Top-left keep: tower of bunks (level 2) over a great hall (level 1), dining room, bedroom, dormitory, chapel.
room(mask_oct(30, 30, 175, 175, 22), WOOD, 2)
room(mask_rect(75, 30, 130, 175), FLAG, 2)
room(mask_rect(80, 175, 125, 205), FLAG, 2)
room(mask_rect(80, 205, 125, 228), FLAG, 1)
room(mask_rect(15, 228, 130, 382), FLAG, 1)                 # great hall
room(mask_rect(130, 228, 178, 266), FLAG, 1)
room(mask_rect(178, 228, 405, 266), FLAG, 0)                # east wing, down a flight of stairs
room(mask_rect(285, 266, 385, 345), FLAG, 0)                # passage to the cave arch
room(mask_rect(210, 30, 385, 175), FLAG, 1)                 # dormitory
room(mask_rect(385, 105, 470, 150), FLAG, 1)
room(mask_rect(310, 175, 360, 200), FLAG, 1)
room(mask_rect(310, 200, 360, 228), FLAG, 0)
room(mask_rect(415, 185, 535, 305), FLAG, 1)                # chapel
room(mask_circle(535, 245, 36) & mask_rect(535, 185, 600, 305), FLAG, 1)
room(mask_rect(405, 228, 415, 266), FLAG, 1)
room(mask_rect(160, 300, 255, 430), WOOD, 1)                # dining room
room(mask_rect(130, 335, 160, 357), FLAG, 1)
room(mask_rect(205, 430, 250, 470), FLAG, 1)
room(mask_oct(185, 470, 280, 565, 22, 'bottom'), WOOD, 1)  # bedroom
room(mask_rect(80, 382, 125, 418), FLAG, 1)                 # stairs down to the south gate
room(mask_rect(80, 418, 125, 466), FLAG, 0)
room(mask_oct(55, 466, 150, 568, 18, 'top'), FLAG, 0)
room(mask_rect(85, 568, 125, 590), FLAG, 0)

# East block: storeroom, well hall, mess hall, kitchen, stables.
room(mask_oct(805, 235, 910, 330, 20, 'left'), FLAG, 0)
room(mask_rect(910, 262, 935, 302), FLAG, 0)
room(mask_rect(935, 195, 975, 365), FLAG, 0)
room(mask_rect(920, 255, 1020, 302), FLAG, 0)
room(mask_rect(800, 365, 1015, 460), FLAG, 0)                # mess hall
room(mask_rect(978, 460, 1010, 482), WOOD, 0)
room(mask_poly([(910, 482), (1015, 482), (1015, 630), (960, 630), (960, 600), (930, 570), (910, 570)]), WOOD, 0)   # kitchen
room(mask_rect(935, 755, 1000, 965), GRAVEL, 0)              # stables

# Bottom-left: tavern with a tiled floor, bathhouse below.
room(mask_rect(130, 857, 205, 1035), TILE, 0)
room(mask_rect(80, 880, 205, 1035), TILE, 0)
room(mask_rect(25, 1040, 180, 1135), TILE, 0)
room(mask_rect(80, 1030, 130, 1042), TILE, 0)

floor = np.zeros((H, W), bool)
mat = np.zeros((H, W), np.uint8)
lvl = np.zeros((H, W), np.uint8)
for mk, mt, lv in rooms:
    floor |= mk
    mat[mk] = mt
    lvl[mk] = lv

walls = dilate(floor, 4) & ~floor
wall_lvl = np.zeros((H, W), np.uint8)
for dy in range(-4, 5):
    for dx in range(-4, 5):
        wall_lvl = np.maximum(wall_lvl, np.roll(np.roll(np.where(floor, lvl, 0), dy, 0), dx, 1))

# Openings in the outer walls: cave arches, the dormitory's back door, stable fronts, tavern doors.
OPENINGS = [
    (305, 345, 365, 362, FLAG, 0),        # arch below the east wing
    (470, 108, 480, 147, FLAG, 1),         # dormitory corridor into the upper tunnel
    (937, 180, 973, 195, FLAG, 0),         # well hall into the upper tunnel
    (785, 368, 800, 425, FLAG, 0),         # mess hall arch into the cave
    (925, 760, 935, 960, GRAVEL, 0),       # stables open to the cave
    (205, 975, 215, 1000, TILE, 0),        # tavern side door
    (90, 590, 120, 600, FLAG, 0),          # south gate
]
open_mask = np.zeros((H, W), bool)
for x0, y0, x1, y1, mt, lv in OPENINGS:
    o = mask_rect(x0, y0, x1, y1)
    open_mask |= o
    mat[o] = mt
    lvl[o] = lv
walls &= ~open_mask
floor |= open_mask

ground[floor] = mat[floor]
terrace[floor] = np.where(lvl[floor] > 0, lvl[floor] + 1, 0)
ground[walls] = WALL
terrace[walls] = np.where(wall_lvl[walls] > 0, wall_lvl[walls] + 1, 0)
water[floor | walls] = 0
scatter[floor | walls] = 0

# Steps out of the raised dormitory corridor onto the tunnel floor: a short stone path at cave level.
stub = mask_rect(480, 110, 500, 145)
ground[stub] = FLAG
water[stub] = 0

# ---------- Bridges ----------

# A long wooden bridge over the drop between the upper tunnel and the main cave (a path painted across the chasm).
span = mask_line([(668, 300), (738, 172)], 26)
ground[span] = WOOD
water[span] = 0

# Plank crossings over cracks in the caves.
for a, b in [((283, 742), (300, 780)), ((165, 742), (185, 772))]:
    plank = mask_line([a, b], 16)
    ground[plank & (water == CHASM)] = WOOD
    water[plank] = 0

# The trestle bridge across the canyon: a raised wooden deck on log piles, with a lookout platform at each end.
deck = mask_rect(400, 876, 595, 914) | mask_oct(355, 862, 412, 922, 12) | mask_oct(585, 860, 642, 922, 12)
ground[deck] = WOOD
terrace[deck] = 2
ground[dilate(deck, 3) & ~deck & (ground == PATH)] = DIRT    # the trail runs on under the bridge: no stairs up onto it
water[deck] = 0
scatter[dilate(deck, 2)] = 0
for x0, y0, x1, y1 in [(330, 880, 355, 905), (642, 880, 668, 905), (595, 840, 615, 862), (420, 845, 440, 876)]:
    s = mask_rect(x0, y0, x1, y1)
    ground[s] = WOOD
    water[s] = 0
    scatter[s] = 0

# A jetty into the pond.
jetty = mask_line([(882, 1185), (908, 1125)], 18)
ground[jetty] = WOOD
water[jetty & ~pond] = 0

# ---------- Objects ----------

objects = []


def make_rng(seed):
    """Random.makeRng from the editor (mulberry32), so seeds can be picked for a color or style."""
    a = [seed & 0xFFFFFFFF]
    def imul(p, q): return (p * q) & 0xFFFFFFFF
    def nxt():
        a[0] = (a[0] + 0x6D2B79F5) & 0xFFFFFFFF
        v = a[0]
        t = imul(v ^ (v >> 15), 1 | v)
        t = ((t + imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF) ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return nxt


def seed_where(test, start):
    """First seed from start whose rolls pass test(roll). Sprites.build rolls the size first, then the prop's own rolls."""
    s = start
    while True:
        rng = make_rng(s)
        rng()
        if test(rng): return s
        s += 1


# Look pickers, in the order each sprite rolls them.
CLOTH = {'red': 0, 'blue': 1, 'green': 2}
BEDROLL = {'red': 0, 'blue': 1, 'green': 2, 'yellow': 3, 'canvas': 4}
def bed(color): return lambda r: int(r() * 3) == CLOTH[color]
def bedroll(color): return lambda r: int(r() * 5) == BEDROLL[color]
def rug(color):   # round rugs: a stone medallion or a cloth
    return lambda r: (r() >= 0.25 and int(r() * 3) == CLOTH[color]) if color != 'stone' else r() < 0.25
def tent(color, shape='round'):
    def test(r):
        c = r()
        c = 'canvas' if c < 0.7 else 'purple' if c < 0.85 else 'blue'
        return c == color and (r() < 0.7) == (shape == 'round')
    return test


def add(type_, x, y, look=None, scale=1, turn=False):
    """An object with its base at a reference-pixel spot; look picks a seed whose sprite has that color or style."""
    n = len(objects) + 1
    seed = seed_where(look, 1000 + n * 7919) if look else 1000 + n * 7919
    o = {'id': n, 'type': type_, 'x': int(round(m(x))), 'y': int(round(m(y))), 'seed': seed, 'scale': scale}
    if turn: o['turn'] = 1
    objects.append(o)


def each(type_, spots, **kw):
    for x, y in spots: add(type_, x, y, **kw)


# Tower of bunks: four beds on round rugs, wooden partitions, a cupboard.
for (x, y), c in zip([(52, 84), (153, 84), (52, 150), (153, 150)], ['green', 'blue', 'blue', 'green']):
    add('roundrug', x, y, rug(c), 1.2)
for (x, y), c in zip([(44, 92), (160, 92), (44, 150), (160, 150)], ['green', 'blue', 'blue', 'green']):
    add('bed', x, y, bed(c))
each('stool', [(42, 44), (163, 44), (42, 170), (163, 170)])
add('bookshelf', 102, 60)
add('fence', 52, 106, scale=1.4); add('fence', 153, 106, scale=1.4)
add('candles', 102, 140)

# Great hall: weapon racks along the walls, urns, wall torches.
each('weaponrack', [(25, 275), (25, 325), (25, 375), (113, 320)], turn=True)
each('barrel', [(48, 245), (118, 245), (45, 378), (300, 282), (372, 282)])
each('sconce', [(70, 226), (165, 226), (240, 226), (330, 226), (380, 226), (100, 384)])

# Dormitory: two rows of beds, rugs at their feet, tables with stools, crates.
for x in (225, 250, 275, 300, 325, 350, 375): add('bed', x, 86, bed('red'))
for x in (225, 250, 275, 300): add('bed', x, 172, bed('red'))
add('rug', 258, 104, bed('red')); add('rug', 338, 104, bed('red'))   # a rug rolls its cloth like a bed
add('table', 258, 132); add('table', 340, 132)
each('stool', [(238, 128), (278, 128), (320, 128), (360, 128)])
each('crate', [(368, 168), (352, 160)]); add('barrel', 375, 120)
each('sconce', [(250, 28), (340, 28)])
add('planter', 420, 112); add('planter', 420, 152)

# Chapel: two rows of pews, a stone medallion, the altar.
for x in (432, 455, 478): add('bench', x, 222, turn=True); add('bench', x, 300, turn=True)
add('roundrug', 470, 272, rug('stone'), 2)
add('altar', 524, 262)
each('candles', [(512, 205), (512, 296)])
each('sconce', [(460, 183), (500, 183)])

# Dining hall: a long table with stools both sides.
add('longtable', 207, 418, scale=1.9, turn=True)
for y in (335, 360, 385, 410):
    add('stool', 186, y); add('stool', 229, y)
each('barrel', [(170, 312), (246, 312)])
add('planter', 166, 428, turn=True); add('planter', 249, 428, turn=True)
each('sconce', [(185, 298), (232, 298)])

# Bedroom: bed on a blue rug, a fireplace, a desk, a chest.
add('roundrug', 232, 556, rug('blue'), 1.5)
add('bed', 232, 552, bed('blue'))
add('oven', 266, 518)
add('table', 205, 505); add('stool', 205, 520)
add('chest', 232, 488)
add('candles', 198, 548)

# South gate hall.
each('barrel', [(66, 486), (140, 486)]); add('chest', 70, 540); add('crate', 138, 545)
each('sconce', [(70, 464), (135, 464)])

# Storeroom, well hall.
each('crate', [(825, 258), (846, 252), (870, 258), (855, 276)])
each('sacks', [(826, 304), (842, 326)])
each('barrel', [(866, 324), (884, 326), (900, 326), (882, 304)])
add('chest', 896, 258)
add('well', 996, 300)
each('sconce', [(955, 253), (1000, 253)])
add('planter', 943, 358, turn=True); add('planter', 968, 358, turn=True)

# Mess hall: three long tables with benches, barrels along the wall.
for x in (845, 902, 958):
    add('longtable', x, 452, scale=1.1, turn=True)
    for dx in (-20, 20):
        add('bench', x + dx, 424, turn=True); add('bench', x + dx, 454, turn=True)
each('barrel', [(1004, 388), (1004, 412), (1004, 436), (1004, 458)])
each('sconce', [(840, 363), (900, 363), (960, 363)])

# Kitchen.
add('oven', 945, 590)
add('table', 975, 530)
add('bookshelf', 955, 498)
each('barrel', [(1004, 562), (1004, 586)])
add('sacks', 925, 528); add('crate', 925, 552)
add('chest', 990, 620)
add('candles', 975, 500)

# Stables: stall rails, hay, torches on posts, hay bales outside.
for y in (792, 820, 848, 876, 904, 932): add('fence', 968, y, scale=1.8)
each('haybale', [(988, 808), (988, 892), (978, 960)])
each('torch', [(930, 812), (930, 868), (930, 922)])
each('haybale', [(840, 798), (862, 778), (826, 818), (842, 948)])
each('sacks', [(872, 944), (884, 966)])
add('crate', 852, 832, scale=1.3)

# Tavern: kegs behind a long bar, round tables and stools. Bathhouse: tubs, benches, a round rug.
each('barrel', [(94, 885), (94, 910), (94, 935), (94, 960), (94, 985), (94, 1010)])
add('longtable', 118, 1008, scale=1.7, turn=True)
add('roundtable', 158, 892); add('roundtable', 168, 978)
each('stool', [(140, 888), (176, 888), (150, 972), (186, 972), (158, 1005)])
add('barrel', 192, 884); add('bench', 197, 940, turn=True)
add('roundrug', 78, 1078, rug('red'), 1.3)
add('tub', 55, 1126); add('tub', 118, 1126)
add('bench', 155, 1078); add('chest', 165, 1128)
each('candles', [(35, 1052), (140, 1052), (88, 1132)])

# Cave lights.
each('torch', [(527, 118), (641, 176), (713, 94), (794, 87), (917, 171), (677, 324), (567, 344), (763, 428),
               (360, 355), (387, 456), (718, 507), (77, 620), (141, 706), (297, 645), (442, 612), (232, 814),
               (292, 965), (206, 1072), (825, 616), (743, 1067), (839, 1149), (832, 1232), (940, 1347),
               (245, 1202), (142, 1227), (272, 1356)])

# Upper tunnel camp.
add('bedroll', 820, 86, bedroll('green')); add('bedroll', 853, 76, bedroll('yellow')); add('bedroll', 880, 84, bedroll('green'))
each('barrel', [(905, 60), (925, 66), (905, 128), (925, 162)])
each('crate', [(888, 136), (902, 152), (955, 100)])
for x, y in [(595, 72), (612, 80), (700, 98), (722, 102), (780, 118), (800, 124)]: add('rock', x, y, scale=0.5)

# Main cave: supplies by the passage and the canyon edge.
each('crate', [(505, 388), (526, 380), (546, 392), (345, 448), (362, 458)])
each('barrel', [(482, 408), (496, 402), (516, 408), (340, 472)])
add('sacks', 470, 384)

# West cave and the camp passage.
each('barrel', [(90, 728), (96, 748), (118, 782)])
add('tent', 318, 636, tent('canvas', 'ridge'), 0.7); add('tent', 278, 646, tent('canvas', 'ridge'), 0.6)
add('bedroll', 246, 692, bedroll('blue')); add('bedroll', 336, 690, bedroll('canvas'), turn=True)
add('bedroll', 382, 692, bedroll('blue'), turn=True); add('bedroll', 415, 676, bedroll('yellow'))
each('crate', [(262, 664), (285, 670)]); each('barrel', [(430, 642), (440, 672)])
for x, y in [(258, 862), (272, 922), (212, 1002)]: add('rock', x, y, scale=0.7)
each('barrel', [(240, 1048), (250, 1064)])

# The canyon clearing: a tent and a campfire ringed by stumps.
add('tent', 440, 812, tent('canvas'), 1.5)
add('campfire', 505, 805)
each('stump', [(470, 790), (488, 778), (525, 778), (543, 795), (538, 820), (472, 822)])
add('barrel', 520, 708); add('crate', 575, 696)

# East cave: crates, barrels, a log pile.
each('crate', [(765, 620), (781, 634), (746, 528), (730, 518)])
each('barrel', [(746, 604), (800, 704), (812, 742), (830, 768)])
add('log', 830, 604); add('log', 838, 612)

# East strip camp.
add('bedroll', 672, 1098, bedroll('canvas')); add('bedroll', 668, 1138, bedroll('green'))
add('bedroll', 668, 1178, bedroll('yellow')); add('bedroll', 658, 1214, bedroll('blue'))
add('bedroll', 716, 1244, bedroll('canvas'), turn=True); add('bedroll', 772, 1252, bedroll('red'))
add('campfire', 690, 1182)
each('stump', [(708, 1168), (704, 1200)])
each('crate', [(720, 1012), (736, 1024)]); add('barrel', 760, 1032)

# Bottom-right camp.
add('campfire', 882, 1360)
add('bedroll', 943, 1408, bedroll('red'), turn=True); add('bedroll', 962, 1394, bedroll('yellow'))
add('bedroll', 970, 1376, bedroll('yellow'), turn=True); add('bedroll', 862, 1440, bedroll('yellow'))
add('bedroll', 830, 1414, bedroll('blue'), turn=True); add('bedroll', 810, 1382, bedroll('green'), turn=True)
each('crate', [(846, 1384), (872, 1396)]); each('barrel', [(810, 1312), (826, 1332)])
each('stool', [(868, 1344), (900, 1348)])
add('chest', 902, 1420)

# Bottom-left camp: a ring of tents round a campfire.
add('tent', 118, 1372, tent('canvas'), 1.6); add('tent', 315, 1410, tent('canvas'), 1.5)
add('tent', 165, 1442, tent('purple'), 1.4); add('tent', 255, 1452, tent('blue'), 1.4)
add('tent', 285, 1244, tent('canvas', 'ridge'), 1.1)
add('campfire', 220, 1308)
each('stump', [(196, 1294), (246, 1294), (200, 1328), (242, 1328)])
add('roundtable', 155, 1272); add('roundtable', 300, 1292)
each('barrel', [(120, 1234), (126, 1262), (172, 1286), (190, 1254), (132, 1302), (165, 1312)])
each('crate', [(150, 1186), (174, 1196), (146, 1214)])
add('bedroll', 240, 1182, bedroll('green')); add('sacks', 290, 1222)

# Trees and boulders on the ridges and in the canyon.
for x, y, sc in [(492, 600, 1.2), (512, 636, 1.0), (470, 664, 0.9), (705, 604, 1.0), (735, 646, 1.1), (792, 694, 1.0),
                 (805, 728, 0.9), (332, 846, 1.2), (318, 1000, 1.0), (652, 1060, 1.0), (690, 1310, 1.1), (722, 1424, 1.2),
                 (752, 1460, 1.0), (612, 470, 0.8)]:
    add('tree', x, y, scale=sc)
for x, y in [(455, 520), (548, 540), (668, 520), (760, 600), (330, 760), (380, 950), (420, 1460), (636, 1180), (668, 1380)]:
    add('bush', x, y)
for x, y in [(470, 1052), (445, 1132), (600, 1162), (500, 1302), (560, 1405), (470, 1480)]:
    add('rock', x, y, scale=0.8)

# Doors in a few of the wall gaps (each snaps into its gap on rebuild).
each('door', [(994, 471), (210, 987), (475, 127), (105, 594)])

# Braziers on the bridge's lookouts, torches down the canyon.
each('brazier', [(383, 902), (613, 902)])
each('torch', [(560, 705), (598, 560), (468, 962), (538, 1122), (468, 1330), (548, 1470)])

# Lanterns, so the rooms are lit through and through like the reference.
each('lantern', [(102, 100), (102, 165), (70, 300), (70, 352), (150, 247), (250, 247), (345, 247), (335, 305),
                 (300, 108), (300, 150), (445, 245), (505, 230), (176, 335), (240, 395), (210, 540), (100, 515),
                 (860, 292), (955, 232), (955, 330), (872, 400), (930, 400), (985, 400), (960, 545), (150, 935),
                 (150, 1010), (100, 1095), (968, 862), (430, 128)])

add('elf-wizard', 560, 830)

settings = {
    'edgeWobble': 1.5, 'tuftDensity': 1.2, 'flowerAmount': 0.1, 'pebbleAmount': 0.6, 'reeds': False, 'lilyPads': False,
    'beachWidth': 0, 'mudBanks': False, 'beachRocks': False, 'waveReach': 1,
    'butterflies': 0, 'birds': 0, 'fireflies': 40, 'fish': 2, 'clouds': False,
    'underground': True, 'ambient': 0.35, 'forestFloor': 0.3, 'forestDensity': 0.7,
    'levelHeight': 6, 'stairs': True, 'grid': False, 'gridSize': 10, 'gridFeet': 5,
}

data = {
    'version': 1, 'name': 'Canyon Hideout', 'width': W, 'height': H, 'seed': 1500,
    'ground': base64.b64encode(ground.tobytes()).decode(), 'water': base64.b64encode(water.tobytes()).decode(),
    'scatter': base64.b64encode(scatter.tobytes()).decode(), 'elevation': base64.b64encode(bytes(W * H)).decode(),
    'terrace': base64.b64encode(terrace.tobytes()).decode(),
    'rivers': [], 'objects': objects, 'nextId': len(objects) + 1, 'settings': settings,
}
out = os.path.join(os.path.dirname(__file__), '..', '..', 'samples', 'maps', 'canyon-hideout.json')
with open(out, 'w') as f:
    json.dump(data, f, separators=(',', ':'))
print('wrote', os.path.normpath(out), W, 'x', H, len(objects), 'objects')
