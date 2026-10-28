#!/usr/bin/env python3
"""Development helper: build + validate Boulder Dash level maps."""
from __future__ import annotations
import random

COLS, ROWS = 40, 22


def blank(fill="."):
    g = [[fill] * COLS for _ in range(ROWS)]
    for x in range(COLS):
        g[0][x] = g[ROWS - 1][x] = "#"
    for y in range(ROWS):
        g[y][0] = g[y][COLS - 1] = "#"
    return g


def rect(g, x1, y1, x2, y2, ch=" "):
    for y in range(y1, y2 + 1):
        for x in range(x1, x2 + 1):
            if 0 < x < COLS - 1 and 0 < y < ROWS - 1:
                g[y][x] = ch


def line(g, points, ch=" ", width=1):
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        if x1 == x2:
            for y in range(min(y1, y2), max(y1, y2) + 1):
                for w in range(width):
                    xx = x1 + w
                    if 0 < xx < COLS - 1 and 0 < y < ROWS - 1:
                        g[y][xx] = ch
        elif y1 == y2:
            for x in range(min(x1, x2), max(x1, x2) + 1):
                for w in range(width):
                    yy = y1 + w
                    if 0 < x < COLS - 1 and 0 < yy < ROWS - 1:
                        g[yy][x] = ch


def put(g, x, y, ch):
    assert 0 < x < COLS - 1 and 0 < y < ROWS - 1, (x, y)
    g[y][x] = ch


def scatter(g, rng, ch, cells):
    for x, y in cells:
        if g[y][x] == " ":
            g[y][x] = ch



def add_gems(g, count, seed=1):
    rng = random.Random(seed)
    cells = [(x, y) for y in range(1, ROWS - 1) for x in range(1, COLS - 1) if g[y][x] == " "]
    rng.shuffle(cells)
    added = 0
    for x, y in cells:
        if g[y][x] != " ":
            continue
        # keep the tile next to the player / exit clear
        if abs(x - 3) <= 1 and abs(y - 19) <= 1:
            continue
        g[y][x] = "*"
        added += 1
        if added >= count:
            return


def emit(name, rows, quota, difficulty, brief_ru, brief_en, ru, en):
    print("\n/* " + "=" * 70 + " */")
    print(f"// {ru} / {en}")
    print("  {")
    print(f"    name: {{ ru: {ru!r}, en: {en!r} }},")
    print(f"    brief: {{ ru: {brief_ru!r}, en: {brief_en!r} }},")
    print(f"    quota: {quota}, difficulty: {difficulty},")
    print("    rows: [")
    for r in rows:
        assert len(r) == COLS, (len(r), r)
        print(f"      {r!r},")
    print("    ]")
    print("  },")


# ---------------------------------------------------------------------------
# 1. First Descent — open cave network, generous crystals, no enemies
# ---------------------------------------------------------------------------
g = blank()
rect(g, 3, 14, 15, 19)
rect(g, 16, 16, 24, 18)
rect(g, 22, 13, 36, 19)
rect(g, 12, 9, 25, 12)
line(g, [(17, 13), (17, 15)])
line(g, [(20, 12), (20, 13)])
line(g, [(24, 12), (24, 13)])
rect(g, 27, 5, 36, 9)
line(g, [(30, 9), (30, 12)])
# a couple of dirt islands
rect(g, 7, 15, 9, 15, ".")
rect(g, 26, 15, 29, 15, ".")
put(g, 4, 18, "@")
put(g, 34, 17, "E")
for x, y in [(6, 16), (10, 18), (13, 19), (18, 17), (23, 18), (30, 16), (34, 18),
             (14, 10), (24, 11), (28, 6), (34, 7), (35, 8)]:
    put(g, x, y, "*")
for x, y in [(12, 13), (20, 15), (27, 13), (31, 9), (32, 11), (29, 7)]:
    put(g, x, y, "O")
emit("first", ["".join(r) for r in g], 8, 1,
     "Мягкий грунт, немного камней и щедрая жила кристаллов. Отличный момент, чтобы вспомнить, как работает гравитация.",
     "Soft soil, a few rocks and a generous crystal vein. A good moment to remember how gravity works.",
     "Первый спуск", "First Descent")

# ---------------------------------------------------------------------------
# 2. Rockfall — vertical shafts, boulders over the crystal floor
# ---------------------------------------------------------------------------
g = blank()
rect(g, 3, 16, 36, 20)
rect(g, 5, 11, 12, 14)
rect(g, 15, 9, 22, 13)
rect(g, 26, 8, 36, 13)
line(g, [(12, 14), (12, 16)])
line(g, [(18, 13), (18, 16)])
line(g, [(29, 13), (29, 16)])
line(g, [(9, 14), (9, 16)])
# pillars / dirt walls
for x in (8, 13, 20, 25, 31):
    for y in range(17, 21):
        put(g, x, y, ".")
        put(g, x, y - 1, ".")
# shafts with stones hanging above open floor
for x, y in [(7, 12), (10, 12), (17, 10), (20, 10), (28, 9), (30, 10), (33, 11)]:
    put(g, x, y, "O")
for x, y in [(6, 14), (11, 13), (16, 12), (21, 12), (27, 11), (32, 12), (35, 12)]:
    put(g, x, y, "O")
put(g, 4, 19, "@")
put(g, 35, 19, "E")
for x, y in [(5, 18), (9, 19), (14, 18), (18, 17), (23, 19), (27, 18), (33, 18),
             (6, 13), (16, 11), (27, 10), (34, 9), (30, 7)]:
    put(g, x, y, "*")
emit("rockfall", ["".join(r) for r in g], 10, 2,
     "Потолок держится на честном слове. Камни падают в шахты, а кристаллы ждут внизу. Копайте аккуратно.",
     "The ceiling is held together by hope. Rocks fall down the shafts, crystals wait below. Dig carefully.",
     "Каменный дождь", "Rockfall")

# ---------------------------------------------------------------------------
# 3. Labyrinth — narrow corridors and four chambers
# ---------------------------------------------------------------------------
g = blank()
rect(g, 3, 3, 12, 8)
rect(g, 27, 3, 36, 8)
rect(g, 3, 14, 12, 19)
rect(g, 27, 14, 36, 19)
rect(g, 15, 9, 24, 12)
line(g, [(12, 6), (16, 6), (16, 9)])
line(g, [(24, 11), (27, 11), (27, 6)])
line(g, [(12, 16), (16, 16), (16, 12)])
line(g, [(24, 16), (27, 16)])
line(g, [(15, 10), (12, 10), (12, 14)])
line(g, [(24, 10), (27, 10), (27, 14)])
put(g, 4, 18, "@")
put(g, 35, 17, "E")
for x, y in [(5, 4), (9, 6), (11, 7), (30, 4), (33, 7), (35, 5), (5, 15), (8, 19),
             (30, 15), (34, 18), (18, 10), (22, 11), (17, 8), (26, 12), (13, 5), (28, 9)]:
    put(g, x, y, "*")
for x, y in [(7, 8), (10, 7), (29, 8), (32, 3), (6, 14), (34, 14), (19, 12), (23, 9)]:
    put(g, x, y, "O")
put(g, 18, 12, "F")
emit("labyrinth", ["".join(r) for r in g], 12, 3,
     "Четыре камеры, узкие перемычки и один очень голодный светлячок. Найдите выход, прежде чем он найдёт вас.",
     "Four chambers, narrow bridges and one very hungry firefly. Find the exit before it finds you.",
     "Лабиринт", "The Labyrinth")

# ---------------------------------------------------------------------------
# 4. Fireflies — two enemies and rock ammunition
# ---------------------------------------------------------------------------
g = blank()
rect(g, 3, 15, 18, 20)
rect(g, 21, 14, 36, 20)
rect(g, 5, 7, 17, 12)
rect(g, 23, 6, 35, 12)
line(g, [(18, 17), (21, 17)])
line(g, [(15, 12), (15, 15)])
line(g, [(27, 12), (27, 14)])
line(g, [(6, 12), (6, 15)])
line(g, [(34, 12), (34, 14)])
# central dirt wall
for y in range(6, 21):
    for x in (19, 20):
        if 0 < y < ROWS - 1:
            put(g, x, y, ".")
put(g, 19, 17, " ")
put(g, 20, 17, " ")
put(g, 4, 19, "@")
put(g, 35, 19, "E")
for x, y in [(5, 16), (9, 18), (13, 19), (17, 16), (23, 17), (28, 18), (33, 15),
             (7, 9), (11, 11), (16, 8), (25, 7), (30, 10), (34, 7), (26, 13), (6, 13)]:
    put(g, x, y, "*")
for x, y in [(8, 13), (14, 7), (24, 12), (31, 12), (28, 6), (11, 12)]:
    put(g, x, y, "O")
put(g, 15, 18, "F")
put(g, 31, 16, "B")
add_gems(g, 2, 11)
emit("fireflies", ["".join(r) for r in g], 14, 4,
     "Светлячки вышли на охоту. Камни — ваше единственное оружие: уроните один на жука, и он рассыплется кристаллами.",
     "Fireflies are on the hunt. Rocks are your only weapon: drop one on a bug and it bursts into crystals.",
     "Светлячки", "Fireflies")

# ---------------------------------------------------------------------------
# 5. Crystal Garden — a large crystal cluster guarded by falling rocks
# ---------------------------------------------------------------------------
g = blank()
rect(g, 3, 3, 36, 8)
rect(g, 3, 11, 14, 20)
rect(g, 18, 12, 27, 20)
rect(g, 30, 10, 36, 20)
line(g, [(14, 16), (18, 16)])
line(g, [(27, 16), (30, 16)])
line(g, [(8, 8), (8, 11)])
line(g, [(22, 8), (22, 12)])
line(g, [(33, 8), (33, 10)])
# middle dirt shelf
for x in range(15, 30):
    for y in range(9, 11):
        put(g, x, y, ".")
put(g, 15, 9, " ")
put(g, 26, 9, " ")
put(g, 4, 19, "@")
put(g, 35, 19, "E")
# crystal garden
for x, y in [(6, 5), (10, 6), (14, 4), (18, 5), (22, 6), (27, 4), (31, 5), (35, 6),
             (5, 12), (12, 18), (20, 16), (25, 19), (32, 13), (35, 17), (8, 14), (23, 13)]:
    put(g, x, y, "*")
for x, y in [(7, 9), (12, 9), (17, 9), (24, 9), (29, 9), (10, 12), (19, 10), (26, 11)]:
    put(g, x, y, "O")
put(g, 12, 14, "F")
put(g, 24, 18, "F")
add_gems(g, 4, 12)
emit("garden", ["".join(r) for r in g], 16, 5,
     "Целый сад кристаллов под каменным потолком. Богатство лежит на виду — и падает вам на голову.",
     "A whole garden of crystals beneath a stone ceiling. The riches are in plain sight — and falling on your head.",
     "Кристальный сад", "Crystal Garden")

# ---------------------------------------------------------------------------
# 6. Collapse — unstable ledges and three bugs
# ---------------------------------------------------------------------------
g = blank()
rect(g, 3, 16, 36, 20)
rect(g, 5, 12, 34, 14)
rect(g, 5, 7, 15, 9)
rect(g, 23, 7, 34, 9)
line(g, [(15, 8), (23, 8)])
line(g, [(6, 9), (6, 12)])
line(g, [(33, 9), (33, 12)])
line(g, [(12, 14), (12, 16)])
line(g, [(27, 14), (27, 16)])
put(g, 4, 19, "@")
put(g, 35, 19, "E")
# ledges with stones
for x in range(6, 34, 3):
    if x not in (18, 21):
        put(g, x, 13, "O")
for x, y in [(8, 8), (12, 7), (27, 8), (32, 7)]:
    put(g, x, y, "O")
for x, y in [(5, 17), (10, 18), (15, 16), (19, 19), (24, 17), (29, 18), (34, 16),
             (7, 13), (13, 13), (22, 13), (31, 13), (9, 8), (11, 9), (29, 9), (33, 8)]:
    put(g, x, y, "*")
put(g, 16, 18, "F")
put(g, 21, 18, "B")
put(g, 24, 8, "F")
add_gems(g, 7, 13)
emit("collapse", ["".join(r) for r in g], 18, 6,
     "Тонкие полки, тяжёлые камни и три жука. Здесь важно не столько копать, сколько вовремя отходить.",
     "Thin ledges, heavy rocks and three bugs. Here it matters less how you dig and more when you step aside.",
     "Обвал", "Collapse")

# ---------------------------------------------------------------------------
# 7. Butterfly Effect — maze with butterflies and deep crystal pockets
# ---------------------------------------------------------------------------
g = blank()
rect(g, 3, 3, 10, 18)
rect(g, 13, 3, 22, 8)
rect(g, 25, 3, 36, 8)
rect(g, 13, 11, 36, 18)
line(g, [(10, 5), (13, 5)])
line(g, [(10, 15), (13, 15)])
line(g, [(22, 14), (25, 14)])
line(g, [(22, 5), (25, 5)])
line(g, [(18, 8), (18, 11)])
line(g, [(30, 8), (30, 11)])
# inner dirt lattice
for x in range(13, 37):
    if x not in (18, 25, 30):
        put(g, x, 10, ".")
for y in range(3, 19):
    if y not in (5, 15):
        put(g, 12, y, ".")
put(g, 7, 17, "@")
put(g, 35, 17, "E")
for x, y in [(5, 4), (8, 8), (10, 12), (14, 4), (18, 6), (22, 7), (27, 4), (31, 6), (35, 5),
             (14, 15), (19, 17), (24, 12), (28, 16), (33, 13), (35, 18), (15, 12), (26, 14), (32, 9)]:
    put(g, x, y, "*")
for x, y in [(6, 10), (15, 7), (20, 4), (29, 7), (34, 4), (17, 16), (23, 15), (31, 12), (34, 14)]:
    put(g, x, y, "O")
put(g, 16, 16, "B")
put(g, 28, 16, "F")
put(g, 26, 6, "B")
add_gems(g, 7, 14)
emit("butterfly", ["".join(r) for r in g], 20, 7,
     "Бабочки летят против часовой стрелки, светлячки — по часовой. Запомните это, и лабиринт станет вашим.",
     "Butterflies fly counter-clockwise, fireflies clockwise. Remember that and the maze is yours.",
     "Эффект бабочки", "Butterfly Effect")

# ---------------------------------------------------------------------------
# 8. Heart of the Deep — final chamber
# ---------------------------------------------------------------------------
g = blank()
rect(g, 3, 14, 36, 20)
rect(g, 5, 8, 16, 12)
rect(g, 23, 8, 34, 12)
rect(g, 17, 3, 22, 6)
line(g, [(16, 10), (23, 10)])
line(g, [(8, 12), (8, 14)])
line(g, [(31, 12), (31, 14)])
line(g, [(20, 6), (20, 8)])
# central vault walls
for y in range(8, 14):
    put(g, 19, y, "#")
    put(g, 20, y, "#")
put(g, 19, 10, " ")
put(g, 20, 10, " ")
# treasure vault
for x, y in [(19, 5), (20, 5), (18, 4), (21, 4), (19, 3), (20, 3)]:
    put(g, x, y, "*")
for x, y in [(8, 9), (12, 10), (15, 11), (24, 9), (28, 10), (31, 11)]:
    put(g, x, y, "O")
put(g, 4, 18, "@")
put(g, 35, 18, "E")
for x, y in [(6, 16), (11, 18), (15, 19), (18, 16), (22, 18), (26, 16), (30, 19), (34, 15),
             (6, 13), (14, 14), (25, 14), (33, 13), (10, 8), (24, 12), (12, 5), (18, 7)]:
    put(g, x, y, "*")
for x, y in [(10, 15), (17, 17), (24, 17), (30, 15), (7, 12), (33, 11)]:
    put(g, x, y, "O")
put(g, 16, 18, "F")
put(g, 23, 18, "F")
put(g, 28, 17, "B")
add_gems(g, 8, 15)
emit("heart", ["".join(r) for r in g], 24, 8,
     "Последняя камера. Сердце глубины бьётся в камне, светлячки охраняют жилу. Восемь уровней позади — не ошибись сейчас.",
     "The last chamber. The heart of the deep beats in stone, fireflies guard the vein. Eight levels behind you — do not slip now.",
     "Сердце глубины", "Heart of the Deep")
