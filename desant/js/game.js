/* ЗАРЕВО (папка desant) · логика (без DOM, детерминирована при заданном rng/seed). DESANT.Game(opts), DESANT.logic.
   Run-and-gun с видом сверху: боец мастерской «Гефест» идёт вверх по вертикальной карте пяти зон, камера едет только вверх.
   Ствол — 8 направлений по ходу; при зажатом огне направление фиксируется (стрейф). Главная механика — ОГНЕВОЙ ВАЛ:
   кнопка «вал» пускает через всю ширину полосу огня, она сама идёт вверх, пока хватает заряда или пока не нажмёшь ещё раз;
   вал сжигает заграждения (частоколы, мешки, ящики), косит пехоту, бьёт гнёзда, дзоты, броневики и части машин-боссов,
   гасит вражеские пули — но жжёт и своего: держись позади. Заряд копится сам и с ящиков со снарядами. */
(function (global) {
  'use strict';
  var DS = global.DESANT = global.DESANT || {};

  // ---------- Константы ----------
  var T = 24, COLS = 20, W = COLS * T, VIEW_H = 640, HUD = 30, ARENA = 26;
  var G = 0, SOLID = 1, WATER = 2, BRIDGE = 3, COVER = 4, CRATE = 5, MUD = 6, WALL = 7, RUBBLE = 8, BUNKER = 9, BODY = 10;
  var WALK = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0];      // проходимо пешком (G, BRIDGE, MUD, RUBBLE)
  var BURN = [0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0];      // сгорает в огненном валу (укрытия, ящики, частоколы)
  var SHOTBLK = [0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0];   // гасит пули (деревья/скалы, укрытия, ящики, стены, дзоты)
  var SPEED = 112, HERO_R = 7, HP = 3, LIVES = 3, CONTINUES = 2, EXTRA_LIFE = 120000;
  // Огневой вал: полоса высотой h через всю ширину; стартует lead px впереди бойца (метка-«свист» wind с), идёт вверх со скоростью speed,
  // тратит drain зарядов/с (всего max); повторное нажатие — отбой (остаток заряда сохраняется), полоса догорает linger с.
  var BAR = { max: 100, h: 46, lead: 84, wind: 0.55, linger: 0.6, speed: 78, drain: 24, start: 6, min: 16, regen: 2.1, regenWait: 1.8, tick: 0.2,
    dmg: 3, car: 5, bossDmg: 1.2, shell: 30 };
  var GUN = { rifle: { cd: 0.16, n: 1, spread: 0 }, spread: { cd: 0.22, n: 3, spread: 0.2 }, rapid: { cd: 0.085, n: 1, spread: 0.03 } };
  var BULLET = { speed: 430, life: 1.15, r: 3 };
  var ENEMIES = {
    rifle: { r: 8, hp: 1, speed: 52, score: 100 },
    grenadier: { r: 8, hp: 1, speed: 44, score: 150 },
    nest: { r: 11, hp: 8, score: 500, still: true },
    bunker: { r: 22, hp: 3, score: 800, still: true },
    car: { r: 15, hp: 18, speed: 58, score: 1000 },
    boat: { r: 14, hp: 8, speed: 46, score: 600 }
  };
  var SCORE = { checkpoint: 200, zone: 3000, boss: 5000, pickup: 50 };
  var BOSSES = {
    icebreaker: { body: 7, parts: [['gun', -72, 22, 14, 14], ['gun', 72, 22, 14, 14], ['core', 0, 4, 20, 30]] },
    dredger: { body: 7, parts: [['mortar', 0, 30, 16, 18], ['gun', -64, 18, 13, 12], ['gun', 64, 18, 13, 12], ['core', 0, -12, 17, 30]] },
    crusher: { body: 7, parts: [['gun', -92, 14, 16, 16], ['gun', 92, 14, 16, 16], ['core', 0, 24, 21, 36]] },
    dam: { body: 5, water: 2, parts: [['port', -120, 0, 16, 14], ['port', 0, 0, 16, 14], ['port', 120, 0, 16, 14]] },
    engine: { body: 9, parts: [['boiler', -84, -34, 15, 10], ['boiler', 84, -34, 15, 10], ['boiler', -84, 46, 15, 10], ['boiler', 84, 46, 15, 10], ['core', 0, 6, 24, 40]] }
  };
  var ZONES = [
    { key: 'taiga', pri: ['river', 'bunker', 'line', 'road'], rows: 140, dens: 0.11, mud: 0, rivers: 2, lines: 2, bunkers: 1, roads: 1, depots: 2, stock: 1, boats: 0, gren: 0, ruins: 0, boss: 'icebreaker' },
    { key: 'marsh', pri: ['river', 'bunker', 'road', 'line'], rows: 148, dens: 0.05, mud: 0.5, rivers: 3, lines: 2, bunkers: 1, roads: 1, depots: 2, stock: 2, boats: 1, gren: 0.2, ruins: 0, boss: 'dredger' },
    { key: 'quarry', pri: ['bunker', 'road', 'line', 'river'], rows: 152, dens: 0.09, mud: 0, rivers: 2, lines: 3, bunkers: 2, roads: 2, depots: 3, stock: 2, boats: 0, gren: 0.25, ruins: 0, boss: 'crusher' },
    { key: 'rapids', pri: ['river', 'bunker', 'line', 'road'], rows: 156, dens: 0.07, mud: 0.15, rivers: 4, lines: 2, bunkers: 2, roads: 1, depots: 3, stock: 2, boats: 2, gren: 0.3, ruins: 0, boss: 'dam' },
    { key: 'fort', pri: ['bunker', 'road', 'line', 'river'], rows: 160, dens: 0.04, mud: 0, rivers: 1, lines: 2, bunkers: 3, roads: 2, depots: 3, stock: 3, boats: 0, gren: 0.35, ruins: 1, boss: 'engine' }
  ];
  var MAX_ZONE = ZONES.length;
  var DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  var BIND = {
    p1: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], fire: ['KeyF', 'Space'], bar: ['KeyG', 'KeyE'] },
    p2: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], fire: ['Period', 'Numpad0'], bar: ['Slash', 'NumpadDecimal'] }
  };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function oct(dx, dy) {   // ближайшее из 8 направлений (единичные целые)
    if (!dx && !dy) return [0, 0];
    var a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)), k = ((a % 8) + 8) % 8;
    return [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]][k];
  }
  function norm(v) { var l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }

  // ---------- Генератор зоны ----------
  // Карта: COLS×R тайлов, строка 0 — верх (арена босса: строки 0..ARENA-1), старт — внизу.
  function genZone(n, seed) {
    var Z = ZONES[n - 1], rng = mulberry32(((seed | 0) * 7919 + n * 104729 + 13) | 0);
    var R = Z.rows + ARENA, tl = new Uint8Array(COLS * R), spawns = [], items = [], crates = {};
    function ri(a, b) { return a + Math.floor(rng() * (b - a + 1)); }
    function at(x, y) { return x < 0 || x >= COLS || y < 0 || y >= R ? SOLID : tl[x + y * COLS]; }
    function set(x, y, v) { if (x > 0 && x < COLS - 1 && y >= 0 && y < R) tl[x + y * COLS] = v; }
    function clear(x0, y0, x1, y1) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) set(x, y, G); }
    function px(tx) { return tx * T + T / 2; }
    function mob(type, tx, ty, o) { spawns.push(Object.assign({ type: type, x: px(tx), y: px(ty) }, o || {})); }
    function crate(tx, ty, kind) { set(tx, ty, CRATE); if (kind) crates[tx + ty * COLS] = kind; }
    function loot() { var r = rng(); return r < 0.46 ? 'shell' : r < 0.62 ? 'med' : r < 0.82 ? 'spread' : 'rapid'; }
    function infantry(y0, y1, k) {
      for (var i = 0; i < k; i++) {
        for (var tries = 0; tries < 12; tries++) {
          var x = ri(2, COLS - 3), y = ri(y0, y1);
          if (at(x, y) === G) { mob(rng() < Z.gren ? 'grenadier' : 'rifle', x, y); break; }
        }
      }
    }
    for (var y = 0; y < R; y++) { tl[y * COLS] = SOLID; tl[COLS - 1 + y * COLS] = SOLID; }

    var SEG = {
      scatter: function (y0, y1) {
        var h = y1 - y0 + 1, k = Math.round(18 * h * Z.dens / 2);
        for (var i = 0; i < k; i++) {
          var x = ri(1, COLS - 2), y = ri(y0, y1), s = ri(1, 3);
          for (var j = 0; j < s; j++) set(x + (j === 1 ? 1 : 0), y + (j === 2 ? 1 : 0), Z.ruins && rng() < 0.6 ? WALL : SOLID);
        }
        if (Z.mud) for (var m = 0; m < Math.round(h * Z.mud / 3) + (rng() < Z.mud ? 1 : 0); m++) {
          var cx = ri(2, COLS - 3), cy = ri(y0, y1), rx = ri(2, 4), ry = ri(1, 2);
          for (var yy = -ry; yy <= ry; yy++) for (var xx = -rx; xx <= rx; xx++) if ((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry) <= 1 && at(cx + xx, cy + yy) === G) set(cx + xx, cy + yy, MUD);
        }
        if (Z.key === 'marsh' && rng() < 0.6) { var px0 = ri(3, COLS - 7), py0 = ri(y0, Math.max(y0, y1 - 2)); for (var a = 0; a < 3; a++) for (var b = 0; b < 2; b++) set(px0 + a, py0 + b, WATER); }
        for (var c = 0; c < ri(1, 2); c++) { var qx = ri(2, COLS - 3), qy = ri(y0, y1); if (at(qx, qy) === G) crate(qx, qy, rng() < 0.6 ? loot() : null); }
        infantry(y0, y1, ri(2, 3) + (n >= 3 ? 1 : 0));
        if (rng() < 0.25) { var ix = ri(2, COLS - 3), iy = ri(y0, y1); if (at(ix, iy) === G) items.push({ kind: loot(), x: px(ix), y: px(iy) }); }
      },
      river: function (y0, y1) {
        for (var y = y0 + 1; y <= y1 - 1; y++) for (var x = 1; x < COLS - 1; x++) set(x, y, WATER);
        var nb = ri(1, 2), bx = [];
        for (var i = 0; i < nb; i++) {
          var x0, tries = 0;
          do { x0 = ri(2, COLS - 5); tries++; } while (tries < 20 && bx.some(function (b) { return Math.abs(b - x0) < 5; }));
          bx.push(x0); var bw = ri(2, 3);
          for (var yy = y0 + 1; yy <= y1 - 1; yy++) for (var xx = x0; xx < x0 + bw; xx++) set(xx, yy, BRIDGE);
          clear(x0, y0, x0 + bw - 1, y0); clear(x0, y1, x0 + bw - 1, y1);
        }
        var b0 = bx[0], nx = Math.min(COLS - 3, Math.max(2, b0 + (rng() < 0.5 ? -2 : 4)));
        if (at(nx, y0) === G) { mob('nest', nx, y0); set(nx - 1, y0, COVER); set(nx + 1, y0, COVER); }
        if (Z.boats && rng() < 0.75) mob('boat', ri(3, COLS - 4), y0 + 2, { lane: y0 + 2 });
      },
      line: function (y0, y1) {
        var ly = y0 + 3, gaps = [], ng = ri(2, 3);
        for (var x = 1; x < COLS - 1; x++) set(x, ly, COVER);
        for (var i = 0; i < ng; i++) { var g0 = 2 + Math.floor((i + rng() * 0.7 + 0.15) * (COLS - 6) / ng); gaps.push(g0); set(g0, ly, G); set(g0 + 1, ly, G); }
        clear(1, y0, COLS - 2, y0 + 2);
        var nn = Math.min(1 + (n >= 3 ? 1 : 0) + (rng() < 0.4 ? 1 : 0), 2);
        for (var k = 0; k < nn; k++) {
          for (var t2 = 0; t2 < 10; t2++) { var nx = ri(3, COLS - 4); if (gaps.every(function (g) { return Math.abs(g - nx) > 1 && Math.abs(g + 1 - nx) > 1; })) { mob('nest', nx, ly - 1); break; } }
        }
        infantry(y0, y0 + 1, ri(1, 2));
        if (rng() < 0.5) items.push({ kind: 'shell', x: px(ri(3, COLS - 4)), y: px(y1) });
      },
      bunker: function (y0, y1) {
        clear(1, y0, COLS - 2, y1);
        var bx = ri(4, COLS - 6), by = y0 + 2;
        set(bx, by, BUNKER); set(bx + 1, by, BUNKER); set(bx, by + 1, BUNKER); set(bx + 1, by + 1, BUNKER);
        set(bx - 2, by + 2, COVER); set(bx - 1, by + 2, COVER); set(bx + 2, by + 2, COVER); set(bx + 3, by + 2, COVER);
        spawns.push({ type: 'bunker', x: (bx + 1) * T, y: (by + 1) * T, tx: bx, ty: by });
        for (var i = 0; i < 3; i++) { var sx = ri(1, COLS - 2), sy = ri(y0 + 5, y1); if (at(sx, sy) === G) set(sx, sy, SOLID); }
        infantry(y0, y0 + 1, 1);
      },
      road: function (y0, y1) {
        clear(1, y0 + 1, COLS - 2, y0 + 5);
        mob('car', ri(4, COLS - 5), y0 + 3, { lane: y0 + 3 });
        for (var i = 0; i < 3; i++) { var cx = ri(2, COLS - 4), cy = ri(y0 + 7, y1); if (at(cx, cy) === G) { set(cx, cy, COVER); set(cx + 1, cy, COVER); } }
        infantry(y0, y0, 1);
        if (rng() < 0.5) crate(ri(2, COLS - 3), y1, loot());
      },
      depot: function (y0, y1) {   // склад снарядов: ящики с зарядом вала, пара часовых
        clear(1, y0, COLS - 2, y1);
        var dx = ri(4, COLS - 8);
        for (var i = 0; i < 3; i++) crate(dx + i * 2, y0 + 3, i === 1 ? 'shell' : (rng() < 0.5 ? 'shell' : loot()));
        items.push({ kind: 'shell', x: px(dx + 2), y: px(y0 + 5) });
        for (var k = 0; k < 3; k++) { var sx = ri(1, COLS - 2), sy = ri(y0, y1); if (Math.abs(sx - dx - 2) > 3 && at(sx, sy) === G) crate(sx, sy, rng() < 0.5 ? loot() : null); }
        infantry(y0, y0 + 1, 2);
      },
      stockade: function (y0, y1) {   // частокол: сплошная стена в два ряда — берётся только огненным валом; за ней — стрелки
        clear(1, y0, COLS - 2, y1);
        for (var x = 1; x < COLS - 1; x++) { set(x, y0 + 3, WALL); set(x, y0 + 4, WALL); }
        for (var s2 = 0; s2 < 3; s2++) { var bx = ri(3, COLS - 5); set(bx, y0 + 5, COVER); set(bx + 1, y0 + 5, COVER); }
        infantry(y0, y0 + 1, 2); mob('nest', ri(4, COLS - 5), y0 + 1);
        items.push({ kind: 'shell', x: px(ri(3, COLS - 4)), y: px(y1) });
      }
    };
    var H = { scatter: [5, 8], river: [5, 5], line: [6, 6], bunker: [8, 8], road: [9, 9], depot: [8, 8], stockade: [8, 8] };
    var opt = [];
    function add(k, c) { for (var i = 0; i < c; i++) opt.push(k); }
    var cnt = { river: Z.rivers, line: Z.lines, bunker: Z.bunkers, road: Z.roads };
    Z.pri.forEach(function (k) { add(k, cnt[k]); });   // в порядке важности для зоны: при нехватке длины лишнее отбрасывается с конца
    // обязательные частоколы и склады раскладываются по зоне ровно (первый частокол — в начале: обучение валу)
    var cap = Math.floor((Z.rows - 10) / 13.8), keep = Math.max(2, cap - Z.stock - Z.depots);
    opt = opt.slice(0, keep);
    for (var i = opt.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = opt[i]; opt[i] = opt[j]; opt[j] = t; }
    var ins = [];
    for (var q = 0; q < Z.stock; q++) ins.push({ k: 'stockade', at: q === 0 ? 0 : (q + 0.3) * (opt.length + 1) / Z.stock });
    for (var d = 0; d < Z.depots; d++) ins.push({ k: 'depot', at: (d === 0 ? 1.2 : d + 0.55) * (opt.length + 1) / Z.depots });
    var seq = opt.map(function (k, ix) { return { k: k, at: ix + 0.5 }; }).concat(ins).sort(function (a, b) { return a.at - b.at; });
    var plan = [];
    seq.forEach(function (o) { plan.push('scatter'); plan.push(o.k); });
    var cy = R - 1 - 8, top = ARENA + 2, segs = [];
    for (var p = 0; p < plan.length || cy > top + 10; p++) {
      var kind = p < plan.length ? plan[p] : 'scatter', hh = H[kind], h = hh[0] + Math.floor(rng() * (hh[1] - hh[0] + 1));
      if (cy - h + 1 <= top) break;
      SEG[kind](cy - h + 1, cy); segs.push({ kind: kind, y0: cy - h + 1, y1: cy }); cy -= h;
    }
    // арена босса
    var B = BOSSES[Z.boss];
    for (var ay = 0; ay < ARENA + 2; ay++) for (var ax = 1; ax < COLS - 1; ax++) tl[ax + ay * COLS] = G;
    for (var by = 0; by < B.body; by++) for (var bx = 1; bx < COLS - 1; bx++) tl[bx + by * COLS] = Z.boss === 'dredger' ? WATER : BODY;
    if (B.water) for (var wy = B.body; wy < B.body + B.water; wy++) for (var wx = 1; wx < COLS - 1; wx++) tl[wx + wy * COLS] = WATER;
    [[4, 15], [14, 15], [9, 19]].forEach(function (c) { if (Z.boss !== 'crusher' && Z.boss !== 'dam') { set(c[0], c[1], COVER); set(c[0] + 1, c[1], COVER); } });
    // проходимость старт → арена: поиск 0-1 (через препятствия — «дорого»), препятствия на пути — расчищаются
    var repairs = 0;
    function passable(k) { return WALK[tl[k]] === 1 || BURN[tl[k]] === 1; }   // стены/укрытия сгорают в валу — не «ремонтируются»
    var start = (COLS >> 1) + (R - 2) * COLS, goalRow = ARENA - 1;
    var dist = new Int32Array(COLS * R).fill(1e9), prev = new Int32Array(COLS * R).fill(-1);
    dist[start] = 0;
    var deque = [start], front = [];
    while (deque.length || front.length) {
      var c0 = front.length ? front.pop() : deque.shift();
      var x0 = c0 % COLS, y0 = (c0 - x0) / COLS;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = x0 + d[0], ny = y0 + d[1]; if (nx < 1 || nx > COLS - 2 || ny < 0 || ny >= R) return;
        var k = nx + ny * COLS, tt = tl[k]; if (tt === BUNKER || tt === BODY) return;
        var w = passable(k) ? 0 : 1, nd = dist[c0] + w;
        if (nd < dist[k]) { dist[k] = nd; prev[k] = c0; if (w) deque.push(k); else front.push(k); }
      });
    }
    var best = -1;
    for (var gx2 = 1; gx2 < COLS - 1; gx2++) { var gk = gx2 + goalRow * COLS; if (best < 0 || dist[gk] < dist[best]) best = gk; }
    for (var q = best; q >= 0 && q !== start; q = prev[q]) if (!passable(q)) { tl[q] = tl[q] === WATER ? BRIDGE : RUBBLE; delete crates[q]; repairs++; }
    // чекпоинты: 1/3, 2/3 зоны и вход на арену
    var cps = [Math.round(R - Z.rows / 3), Math.round(R - Z.rows * 2 / 3), ARENA + 1].map(function (row) {
      var bx2 = COLS >> 1, found = false;
      for (var dr = 0; dr < 14 && !found; dr++) for (var d = 0; d < COLS && !found; d++) {   // ближайшая к центру проходимая клетка; строка сдвигается вниз, если вся занята частоколом
        var c1 = (COLS >> 1) + (d % 2 ? -1 : 1) * ((d + 1) >> 1);
        if (c1 > 0 && c1 < COLS - 1 && WALK[tl[c1 + (row + dr) * COLS]] && WALK[tl[c1 + (row + dr + 1) * COLS]]) { bx2 = c1; row += dr; found = true; }
      }
      return { row: row, y: row * T + T / 2, x: bx2 * T + T / 2 };
    });
    // мобы не стоят на непроходимом
    spawns = spawns.filter(function (s) { var tt = tl[Math.floor(s.x / T) + Math.floor(s.y / T) * COLS]; return s.type === 'bunker' || s.type === 'boat' || WALK[tt]; });
    return { n: n, key: Z.key, boss: Z.boss, rows: R, w: COLS, h: R, tiles: tl, spawns: spawns, items: items, crates: crates, cps: cps, segs: segs, repairs: repairs,
      start: { x: W / 2, y: (R - 2) * T } };
  }
  // BFS проходимости пешком (тесты и бот): от (sx,sy) в пикселях; → Uint8Array достижимых тайлов
  function reach(D, tiles, sx, sy, rowMin, rowMax, burn) {
    tiles = tiles || D.tiles; rowMin = rowMin == null ? 0 : rowMin; rowMax = rowMax == null ? D.h - 1 : rowMax;
    var seen = new Uint8Array(COLS * D.h), s = Math.floor(sx / T) + Math.floor(sy / T) * COLS, q = [s]; seen[s] = 1;
    for (var i = 0; i < q.length; i++) {
      var c = q[i], x = c % COLS, y = (c - x) / COLS;
      for (var d = 0; d < 4; d++) {
        var nx = x + [1, -1, 0, 0][d], ny = y + [0, 0, 1, -1][d];
        if (nx < 0 || nx >= COLS || ny < rowMin || ny > rowMax) continue;
        var k = nx + ny * COLS; if (!seen[k] && (WALK[tiles[k]] || (burn && BURN[tiles[k]]))) { seen[k] = 1; q.push(k); }
      }
    }
    return seen;
  }

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || mulberry32((opts.seed || 1) * 977 + 5);
    var seed = opts.seed == null ? 1 : opts.seed;
    var nPl = 1;
    var maxZone = opts.maxZone || MAX_ZONE;
    var emit = opts.onEvent || function () {};
    var S = {
      zone: opts.zone || 1, maxZone: maxZone, players: nPl, score: 0, nextLife: EXTRA_LIFE, continues: CONTINUES,
      phase: 'play', phaseT: 0, time: 0, banner: 2.6, D: null, tiles: null, camY: 0, cp: -1, chp: {},
      heroes: [], enemies: [], bullets: [], lobs: [], booms: [], items: [], marks: [], boulders: [], boss: null,
      runT: 4, kills: 0, zoneStats: [], lastCp: null, contT: 0, hold: false, boosts: 0, barUsed: 0, tipBar: false,
      charge: BAR.max, bar: { st: 'idle', y: 0, t: 0, tk: 0, idle: 0 }
    };
    var uid = 1;
    function hero(i) {
      return { id: i, x: 0, y: 0, hp: HP, lives: LIVES, alive: true, out: false, deadT: 0, inv: 1.5, face: [0, -1], mx: 0, my: 0, fire: false,
        cd: 0, weapon: 'rifle', kills: 0, hurtT: 0, moving: false, shots: 0 };
    }
    for (var i = 0; i < nPl; i++) S.heroes.push(hero(i));
    function scale() { return 1 + 0.12 * (S.zone - 1); }
    function coop() { return 1; }
    function addScore(v) {
      S.score += v;
      while (S.score >= S.nextLife) { S.nextLife += EXTRA_LIFE; S.heroes.forEach(function (h) { if (!h.out) h.lives++; }); emit('life', {}); }
    }

    // ---------- Тайлы и столкновения ----------
    function tileAt(px, py) { var x = Math.floor(px / T), y = Math.floor(py / T); if (x < 0 || x >= COLS || y < 0 || y >= S.D.h) return SOLID; return S.tiles[x + y * COLS]; }
    function setTile(tx, ty, v) { if (tx > 0 && tx < COLS - 1 && ty >= 0 && ty < S.D.h) S.tiles[tx + ty * COLS] = v; }
    function circleHits(x, y, r, tbl) {
      var x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
      for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
        var t = (tx < 0 || tx >= COLS || ty < 0 || ty >= S.D.h) ? SOLID : S.tiles[tx + ty * COLS];
        if (tbl[t]) continue;
        var cx = Math.max(tx * T, Math.min(x, tx * T + T)), cy = Math.max(ty * T, Math.min(y, ty * T + T));
        if ((cx - x) * (cx - x) + (cy - y) * (cy - y) < r * r) return true;
      }
      return false;
    }
    function los(x0, y0, x1, y1, cover) {
      var d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 8);
      for (var i = 1; i < n; i++) { var t = tileAt(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); if (SHOTBLK[t] && (cover || t !== COVER)) return false; }
      return true;
    }
    function breakCrate(tx, ty) {
      var k = tx + ty * COLS; S.tiles[k] = RUBBLE; delete S.chp[k];
      var kind = S.D.crates[k]; if (kind) { S.items.push({ kind: kind, x: tx * T + T / 2, y: ty * T + T / 2, taken: false }); delete S.D.crates[k]; }
      emit('crate', { x: tx * T + T / 2, y: ty * T + T / 2 });
    }
    function moveBody(o, dx, dy, r, tbl) {   // поосевое движение с соскальзыванием по углам
      if (dx) { var nx = o.x + dx; if (!circleHits(nx, o.y, r, tbl)) o.x = nx; else { for (var s = -1; s <= 1; s += 2) { if (!circleHits(nx, o.y + s * 3, r, tbl) && !circleHits(o.x, o.y + s * 3, r, tbl) && !dy) { o.y += s * Math.min(1.2, Math.abs(dx)); break; } } } }
      if (dy) { var ny = o.y + dy; if (!circleHits(o.x, ny, r, tbl)) o.y = ny; else { for (var s2 = -1; s2 <= 1; s2 += 2) { if (!circleHits(o.x + s2 * 3, ny, r, tbl) && !circleHits(o.x + s2 * 3, o.y, r, tbl) && !dx) { o.x += s2 * Math.min(1.2, Math.abs(dy)); break; } } } }
    }
    function blockers(o, r) {   // вытолкнуть из «твёрдых» объектов (гнёзда, броневики)
      S.enemies.forEach(function (e) {
        if (e.dead || !(e.type === 'nest' || e.type === 'car')) return;
        var dx = o.x - e.x, dy = o.y - e.y, d = Math.hypot(dx, dy), m = r + e.r;
        if (d < m && d > 0.01) { o.x = e.x + dx / d * m; o.y = e.y + dy / d * m; }
      });
    }
    function walkSpot(x, y) {   // ближайшая проходимая точка (возрождение)
      for (var rad = 0; rad < 8; rad++) for (var a = 0; a < 16; a++) {
        var px = x + Math.cos(a / 16 * Math.PI * 2) * rad * 12, py = y + Math.sin(a / 16 * Math.PI * 2) * rad * 12;
        if (rad === 0 && a > 0) break;
        if (px > T + 8 && px < W - T - 8 && py > S.camY + 50 && py < S.camY + VIEW_H - 12 && !circleHits(px, py, HERO_R + 1, WALK)) return [px, py];
      }
      return [x, y];
    }

    // ---------- Загрузка зоны ----------
    function loadZone(n, cpIdx) {
      S.zone = n; S.D = (opts.zones && opts.zones[n - 1]) ? opts.zones[n - 1] : genZone(n, seed * 31 + n);
      S.D = JSON.parse(JSON.stringify(Object.assign({}, S.D, { tiles: Array.from(S.D.tiles) })));
      S.tiles = new Uint8Array(S.D.tiles); S.chp = {};
      S.enemies = []; S.bullets = []; S.lobs = []; S.booms = []; S.marks = []; S.boulders = []; S.boss = null; S.bar = { st: 'idle', y: 0, t: 0, tk: 0, idle: 0 }; S.tipBar = false;
      S.items = S.D.items.map(function (it) { return { kind: it.kind, x: it.x, y: it.y, taken: false }; });
      S.pending = S.D.spawns.slice().sort(function (a, b) { return b.y - a.y; });
      S.cp = cpIdx == null ? -1 : cpIdx;
      var sy = cpIdx == null ? S.D.start.y : S.D.cps[cpIdx].y + 40, sx = cpIdx == null ? S.D.start.x : S.D.cps[cpIdx].x;
      S.camY = Math.max(0, Math.min(S.D.h * T - VIEW_H, sy + 90 - VIEW_H));
      if (cpIdx != null) S.pending = S.pending.filter(function (s) { return s.y < sy - 220; });   // пройденное и ближайшее к чекпоинту не оживает
      S.heroes.forEach(function (h, i) {
        h.x = sx; h.y = sy; h.inv = 2; h.face = [0, -1];
        var p = walkSpot(h.x, h.y); h.x = p[0]; h.y = p[1];
        if (!h.out) { h.alive = true; if (h.hp <= 0) h.hp = HP; }
      });
      S.runT = 4; S.banner = 2.6; S.phase = 'play'; S.phaseT = 0; S.zoneT = 0;
      emit('zone', { n: n, cp: cpIdx });
    }

    // ---------- Враги ----------
    function spawn(type, x, y, o) {
      var E = ENEMIES[type], hp = E.hp * (type === 'car' || type === 'nest' ? (1 + 0.08 * (S.zone - 1)) : 1);
      var e = Object.assign({ id: uid++, type: type, x: x, y: y, r: E.r, hp: hp, max: hp, t: rng() * 2, cd: 0.9 + rng() * 1.2, state: 'walk', warn: 0,
        dir: [0, 1], burst: 0, flash: 0, kids: 0, dead: false, turnT: 0, vx: rng() < 0.5 ? 1 : -1 }, o || {});
      if (e.turnT == null) e.turnT = 0;
      if (e.lane != null) e.y = e.lane * T + T / 2;
      S.enemies.push(e); return e;
    }
    function nearestHero(x, y, maxD) {
      var best = null, bd = maxD || 1e9;
      S.heroes.forEach(function (h) { if (!h.alive || h.out) return; var d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h; } });
      return best;
    }
    function onScreen(y, m) { m = m || 0; return y > S.camY - m && y < S.camY + VIEW_H + m; }
    function eShoot(x, y, ang, spd, ign, src) {
      S.bullets.push({ k: 'e', x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r: 3, life: 3.2, ign: ign || 0, dmg: 1, src: src || (S.boss && S.boss.active ? 'boss' : 'mob') });
    }
    function eSpeed() { return (140 + 9 * (S.zone - 1)); }
    function lobAt(x0, y0, x1, y1, r, dur, src) {   // навесной снаряд врага: метка на земле, затем взрыв
      S.lobs.push({ x0: x0, y0: y0, x1: x1, y1: y1, t: 0, dur: dur, r: r, enemy: true, src: src || 'lob' });
      S.marks.push({ x: x1, y: y1, r: r, t: dur });
    }
    function updEnemy(e, dt) {
      e.t += dt; if (e.flash > 0) e.flash -= dt;
      var h = nearestHero(e.x, e.y, 420), sc = scale() * coop();
      switch (e.type) {
        case 'rifle': case 'grenadier': {
          if (e.state === 'walk') {
            e.cd -= dt;
            var sp = ENEMIES[e.type].speed * dt;
            if (h && e.t > e.turnT) {
              e.turnT = e.t + 0.8 + rng() * 1.2;
              var dy = h.y - e.y, dist = Math.hypot(h.x - e.x, dy);
              e.dir = dist > 190 ? oct(h.x - e.x + (rng() - 0.5) * 160, dy) : oct((rng() - 0.5) * 2, rng() < 0.3 ? 1 : 0);
              if (!e.dir[0] && !e.dir[1]) e.dir = [rng() < 0.5 ? -1 : 1, 0];
            }
            var nd = norm(e.dir), ox = e.x, oy = e.y;
            moveBody(e, nd[0] * sp, nd[1] * sp, 7, WALK);
            if (ox === e.x && oy === e.y) { e.dir = DIRS[Math.floor(rng() * 8)]; e.turnT = e.t + 0.5 + rng() * 0.5; }
            if (e.cd <= 0 && h && onScreen(e.y, -10) && Math.hypot(h.x - e.x, h.y - e.y) < 380) {
              if (e.type === 'rifle' ? los(e.x, e.y, h.x, h.y, false) : true) { e.state = 'aim'; e.warn = 0.52; e.flash = 0.52; emit('aim', { x: e.x, y: e.y }); }
              else e.cd = 0.4;
            }
          } else if (e.state === 'aim') {
            e.warn -= dt;
            if (e.warn <= 0) {
              if (h) {
                if (e.type === 'rifle') { eShoot(e.x, e.y, Math.atan2(h.y - e.y, h.x - e.x) + (rng() - 0.5) * 0.17, eSpeed(), 0.05, 'rifle'); emit('eshot', { x: e.x, y: e.y }); }
                else { var lx = h.x + (rng() - 0.5) * 30, ly = h.y + (rng() - 0.5) * 30, ld = Math.hypot(lx - e.x, ly - e.y); if (ld > 200) { lx = e.x + (lx - e.x) / ld * 200; ly = e.y + (ly - e.y) / ld * 200; } lobAt(e.x, e.y, lx, ly, 28, 0.85, 'grenade'); emit('lob', { x: e.x, y: e.y }); }
              }
              e.state = 'walk'; e.cd = (e.type === 'rifle' ? 2.2 : 2.8) / sc + rng() * 0.9;
            }
          }
          break;
        }
        case 'nest': {
          if (!h || !onScreen(e.y, -20)) break;
          e.dir = norm([h.x - e.x, h.y - e.y]);
          if (e.burst > 0) {
            e.bt -= dt;
            if (e.bt <= 0) { e.burst--; e.bt = 0.1; var a = e.aim + (e.burst - 1.5) * 0.07; eShoot(e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14, a, eSpeed() + 20, 0.16, 'nest'); emit('eshot', { x: e.x, y: e.y, mg: true }); }
          } else if (e.warn > 0) { e.warn -= dt; if (e.warn <= 0) { e.burst = 4; e.bt = 0; e.aim = Math.atan2(h.y - e.y, h.x - e.x); } }
          else { e.cd -= dt; if (e.cd <= 0 && Math.hypot(h.x - e.x, h.y - e.y) < 400) { e.warn = 0.5; e.flash = 0.5; e.cd = 2.6 / sc + rng() * 0.8; } }
          break;
        }
        case 'bunker': {
          if (!onScreen(e.y, -10)) break;
          e.cd -= dt;
          if (e.cd <= 0 && e.kids < 3 && S.heroes.some(function (q) { return q.alive && !q.out && q.y > e.y; }) && S.enemies.filter(function (q) { return q.parent === e.id && !q.dead; }).length < 2) {
            var k = spawn(rng() < ZONES[S.zone - 1].gren ? 'grenadier' : 'rifle', e.x, e.y + 34, { parent: e.id, turnT: 0 });
            k.dir = [0, 1]; e.kids++; e.cd = 4.5 / sc; emit('spawn', { x: e.x, y: e.y });
          }
          if (e.kids >= 3 && e.cd <= -6) e.kids = 1;
          break;
        }
        case 'car': case 'boat': {
          var spd = ENEMIES[e.type].speed * dt, nx = e.x + e.vx * spd;
          var tbl = e.type === 'boat' ? [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0] : WALK;
          if (circleHits(nx, e.y, e.r - 4, tbl) || nx < T + e.r || nx > W - T - e.r) e.vx = -e.vx; else e.x = nx;
          if (!h || !onScreen(e.y, -10)) break;
          if (e.burst > 0) { e.bt -= dt; if (e.bt <= 0) { e.burst--; e.bt = 0.14; var a2 = Math.atan2(h.y - e.y, h.x - e.x); eShoot(e.x + Math.cos(a2) * 16, e.y + Math.sin(a2) * 16, a2, eSpeed(), 0.12, e.type); emit('eshot', { x: e.x, y: e.y }); } }
          else if (e.warn > 0) { e.warn -= dt; if (e.warn <= 0) { e.burst = 3; e.bt = 0; } }
          else { e.cd -= dt; if (e.cd <= 0) { e.warn = 0.4; e.flash = 0.4; e.cd = 2.4 / sc + rng() * 0.6; } }
          break;
        }
      }
    }
    function hurtEnemy(e, dmg, pi, kind) {
      if (e.dead) return;
      if (e.type === 'bunker' && kind === 'bullet') { emit('armor', { x: e.x, y: e.y }); return; }
      if (e.type === 'car' && kind === 'bullet') dmg *= 0.5;
      e.hp -= dmg; e.flash = Math.max(e.flash, 0.08); emit('hit', { x: e.x, y: e.y });
      if (e.hp <= 0) killEnemy(e, pi);
    }
    function killEnemy(e, pi) {
      e.dead = true; S.kills++;
      var hh = S.heroes[pi]; if (hh) hh.kills++;
      addScore(ENEMIES[e.type].score);
      if (e.type === 'bunker') for (var yy = 0; yy < 2; yy++) for (var xx = 0; xx < 2; xx++) setTile(e.tx + xx, e.ty + yy, RUBBLE);
      if (e.type === 'car' || e.type === 'nest' || e.type === 'bunker') { S.booms.push({ x: e.x, y: e.y, r: 30, t: 0.5, max: 0.5 }); if (rng() < 0.5) S.items.push({ kind: rng() < 0.8 ? 'shell' : 'med', x: e.x, y: e.y + 20, taken: false }); }
      else if (rng() < 0.06) S.items.push({ kind: rng() < 0.5 ? 'shell' : 'med', x: e.x, y: e.y, taken: false });
      emit('kill', { type: e.type, x: e.x, y: e.y, pi: pi });
    }

    // ---------- Взрывы (навесные снаряды врага) ----------
    function boom(x, y, r, dmg, pi, enemy, src) {
      S.booms.push({ x: x, y: y, r: r, t: 0.45, max: 0.45 });
      emit('boom', { x: x, y: y, r: r, enemy: !!enemy });
      S.heroes.forEach(function (h) { if (h.alive && !h.out && Math.hypot(h.x - x, h.y - y) < r + HERO_R) hurtHero(h, src || 'boom', 1); });
    }

    // ---------- Герои ----------
    function hurtHero(h, src) {
      if (!h.alive || h.out) return;
      if (h.inv > 0) return;
      h.hp--; h.inv = 1.4; h.hurtT = 0.3; emit('heroHurt', { pi: h.id, x: h.x, y: h.y, src: src });
      if (h.hp <= 0) killHero(h, src);
    }
    function killHero(h, src) {
      h.alive = false; h.deadT = 1.5; h.lives--; h.weapon = 'rifle'; h.fire = false; if (S.bar.st !== 'idle') endBar(true);
      emit('heroDie', { pi: h.id, x: h.x, y: h.y, src: src });
      if (h.lives <= 0) { h.out = true; emit('out', { pi: h.id }); }
      if (S.heroes.every(function (q) { return q.out; })) {
        if (S.continues > 0) { S.phase = 'cont'; S.contT = 9.99; emit('contAsk', { left: S.continues }); }
        else { S.phase = 'over'; emit('gameover', {}); }
      }
    }
    function respawn(h) {
      var p = walkSpot(Math.max(T * 2, Math.min(W - T * 2, h.x)), S.camY + VIEW_H - 60);
      h.x = p[0]; h.y = p[1]; h.alive = true; h.hp = HP; h.inv = 2.2; h.face = [0, -1]; S.charge = Math.max(S.charge, 40);
      emit('respawn', { pi: h.id, x: h.x, y: h.y });
    }
    function heroShoot(h) {
      var g = GUN[h.weapon], f = norm(h.face);
      if (h.cd > 0) return; h.cd = g.cd; h.shots++;
      var a0 = Math.atan2(f[1], f[0]);
      for (var i = 0; i < g.n; i++) {
        var a = a0 + (g.n > 1 ? (i - (g.n - 1) / 2) * g.spread : (rng() - 0.5) * 2 * g.spread);
        S.bullets.push({ k: 'p', pi: h.id, x: h.x + f[0] * 10, y: h.y + f[1] * 10, vx: Math.cos(a) * BULLET.speed, vy: Math.sin(a) * BULLET.speed, r: BULLET.r, life: BULLET.life, dmg: 1 });
      }
      emit('shot', { pi: h.id, w: h.weapon });
    }
    // ---------- Огненный вал ----------
    function startBar() {
      var h = S.heroes[0]; if (!h || !h.alive || h.out || S.phase !== 'play') return null;
      var b = S.bar;
      if (b.st === 'wind' || b.st === 'run') { endBar(false); return 'stop'; }
      if (b.st !== 'idle') return null;
      if (S.charge < BAR.min) { emit('noCharge', { x: h.x, y: h.y }); return 'empty'; }
      S.charge -= BAR.start; S.barUsed++;
      b.st = 'wind'; b.t = BAR.wind; b.tk = 0; b.y = Math.max(S.camY + HUD + 26, h.y - BAR.lead);
      emit('barStart', { x: h.x, y: b.y }); return 'start';
    }
    function endBar(now) {
      var b = S.bar; if (b.st === 'idle') return;
      if (now || b.st === 'wind') { b.st = 'idle'; b.idle = 0; return; }
      b.st = 'linger'; b.t = BAR.linger; emit('barEnd', { y: b.y });
    }
    function burnTiles(y) {
      var r0 = Math.floor((y - BAR.h / 2) / T), r1 = Math.floor((y + BAR.h / 2) / T);
      for (var ty = Math.max(0, r0); ty <= Math.min(S.D.h - 1, r1); ty++) for (var tx = 1; tx < COLS - 1; tx++) {
        var k = tx + ty * COLS, t = S.tiles[k];
        if (t === CRATE) breakCrate(tx, ty);
        else if (t === COVER || t === WALL) { S.tiles[k] = RUBBLE; S.booms.push({ x: tx * T + T / 2, y: ty * T + T / 2, r: 16, t: 0.35, max: 0.35 }); emit('burn', { x: tx * T + T / 2, y: ty * T + T / 2 }); }
      }
    }
    function updBar(dt) {
      var b = S.bar, h = S.heroes[0];
      if (b.st === 'idle') { b.idle += dt; if (b.idle > BAR.regenWait && S.charge < BAR.max) S.charge = Math.min(BAR.max, S.charge + BAR.regen * dt); return; }
      if (b.st === 'wind') { b.t -= dt; if (b.t <= 0) { b.st = 'run'; b.tk = 0; } return; }
      if (b.st === 'run') {
        b.y -= BAR.speed * dt; S.charge -= BAR.drain * dt;
        if (S.charge <= 0) { S.charge = 0; endBar(false); }
        else if (b.y < S.camY + HUD + 6) endBar(false);
      } else { b.t -= dt; if (b.t <= 0) { b.st = 'idle'; b.idle = 0; return; } }
      b.tk -= dt; if (b.tk > 0) return; b.tk = BAR.tick;
      var y0 = b.y - BAR.h / 2, y1 = b.y + BAR.h / 2;
      S.enemies.forEach(function (e) {
        if (e.dead || e.y + e.r < y0 || e.y - e.r > y1) return;
        var k = e.type === 'bunker' ? 1 : e.type === 'rifle' || e.type === 'grenadier' ? 9 : e.type === 'car' ? BAR.car : e.type === 'nest' ? 2.5 : BAR.dmg;
        hurtEnemy(e, k, 0, 'bar');
      });
      if (S.boss && S.boss.active && !S.boss.dead) S.boss.parts.forEach(function (p) { if (!p.dead && p.y + p.r > y0 && p.y - p.r < y1 && vuln(p)) hurtPart(p, BAR.bossDmg, 0); });
      S.boulders.forEach(function (bo) { if (bo.y + bo.r > y0 && bo.y - bo.r < y1) bo.hp -= 1; });
      S.bullets.forEach(function (q) { if (q.k === 'e' && q.y > y0 - 4 && q.y < y1 + 4) q.dead = true; });
      S.lobs.forEach(function (q) { if (q.enemy && q.y1 > y0 && q.y1 < y1 && q.t > q.dur * 0.5) q.done = true; });
      burnTiles(b.y);
      if (h && h.alive && !h.out && h.y + HERO_R > y0 && h.y - HERO_R < y1) hurtHero(h, 'bar');
    }

    function pickup(h, it) {
      it.taken = true; addScore(SCORE.pickup);
      if (it.kind === 'shell') S.charge = Math.min(BAR.max, S.charge + BAR.shell);
      else if (it.kind === 'med') h.hp = Math.min(HP, h.hp + 1);
      else if (it.kind === 'spread' || it.kind === 'rapid') h.weapon = it.kind;
      emit('pickup', { kind: it.kind, x: it.x, y: it.y, pi: h.id });
    }
    function updHero(h, dt) {
      if (h.out) return;
      if (!h.alive) { h.deadT -= dt; if (h.deadT <= 0 && h.lives > 0) respawn(h); return; }
      if (h.inv > 0) h.inv -= dt; if (h.cd > 0) h.cd -= dt; if (h.hurtT > 0) h.hurtT -= dt;
      var mv = (h.mx || h.my) ? norm([h.mx, h.my]) : [0, 0];
      h.moving = !!(h.mx || h.my);
      if (h.moving && !h.fire) h.face = [h.mx, h.my];
      var top = S.camY + 40, bot = S.camY + VIEW_H - 12;
      var spd = SPEED * dt * (tileAt(h.x, h.y) === MUD ? 0.62 : 1) * (h.fire ? 0.9 : 1);
      if (h.moving) moveBody(h, mv[0] * spd, mv[1] * spd, HERO_R, WALK);
      blockers(h, HERO_R);
      h.y = Math.max(top, Math.min(bot, h.y));
      if (h.fire) heroShoot(h);
      for (var i = 0; i < S.items.length; i++) { var it = S.items[i]; if (!it.taken && Math.hypot(it.x - h.x, it.y - h.y) < 16) pickup(h, it); }
    }

    // ---------- Пули ----------
    function updBullets(dt) {
      for (var i = 0; i < S.bullets.length; i++) {
        var b = S.bullets[i]; if (b.dead) continue;
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if (b.ign > 0) b.ign -= dt;
        if (b.life <= 0) { b.dead = true; continue; }
        if (b.y < S.camY - 30 || b.y > S.camY + VIEW_H + 30) { b.dead = true; continue; }
        var t = tileAt(b.x, b.y);
        if (b.k === 'e') {
          if (SHOTBLK[t] && !(t === COVER && b.ign > 0) && !(t === BUNKER && b.ign > 0)) { b.dead = true; emit('wallHit', { x: b.x, y: b.y, e: true }); continue; }
          for (var j = 0; j < S.heroes.length; j++) {
            var h = S.heroes[j]; if (!h.alive || h.out) continue;
            if (Math.hypot(h.x - b.x, h.y - b.y) < HERO_R + b.r - 1) { b.dead = true; hurtHero(h, b.src === 'boss' ? 'boss' : b.src || 'bullet'); break; }
          }
          continue;
        }
        // пули героя
        var hit = false;
        for (var k = 0; k < S.enemies.length; k++) {
          var e = S.enemies[k]; if (e.dead) continue;
          if (Math.abs(e.x - b.x) < e.r + b.r && Math.abs(e.y - b.y) < e.r + b.r && Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
            b.dead = true; hit = true;
            hurtEnemy(e, b.dmg, b.pi, 'bullet');
            break;
          }
        }
        if (hit) continue;
        if (S.boss && S.boss.active && !S.boss.dead) {
          for (var p = 0; p < S.boss.parts.length; p++) {
            var q = S.boss.parts[p]; if (q.dead) continue;
            if (Math.hypot(q.x - b.x, q.y - b.y) < q.r + b.r) { b.dead = true; hit = true; hurtPart(q, 1, b.pi); break; }
          }
          if (hit) continue;
        }
        for (var bi = 0; bi < S.boulders.length; bi++) { var bo = S.boulders[bi]; if (Math.hypot(bo.x - b.x, bo.y - b.y) < bo.r + b.r) { b.dead = true; hit = true; bo.hp -= 1; emit('hit', { x: bo.x, y: bo.y }); break; } }
        if (hit) continue;
        if (SHOTBLK[t]) {
          b.dead = true;
          if (t === CRATE) { var tx = Math.floor(b.x / T), ty = Math.floor(b.y / T), ck = tx + ty * COLS; S.chp[ck] = (S.chp[ck] || 3) - 1; if (S.chp[ck] <= 0) breakCrate(tx, ty); }
          emit('wallHit', { x: b.x, y: b.y, t: t });
        }
      }
      S.bullets = S.bullets.filter(function (b) { return !b.dead; });
    }
    function updLobs(dt) {
      for (var i = 0; i < S.lobs.length; i++) {
        var n = S.lobs[i]; n.t += dt;
        if (n.t >= n.dur) { n.done = true; boom(n.x1, n.y1, n.r, 1, null, true, n.src); }
      }
      S.lobs = S.lobs.filter(function (n) { return !n.done; });
      S.marks.forEach(function (m) { m.t -= dt; }); S.marks = S.marks.filter(function (m) { return m.t > 0; });
      S.booms.forEach(function (b) { b.t -= dt; }); S.booms = S.booms.filter(function (b) { return b.t > 0; });
    }

    // ---------- Босс ----------
    function makeBoss(key) {
      var B = BOSSES[key], hpK = 1.1;
      var b = { key: key, x: W / 2, y: key === 'dam' ? 84 : key === 'engine' ? 130 : key === 'crusher' ? 96 : 104, t: 0, active: false, intro: 0, dead: false, deadT: 0, spin: 0, summonT: 6, boulderT: 2.5, portT: 0, portI: 0, parts: [] };
      B.parts.forEach(function (p, i) { b.parts.push({ id: i, kind: p[0], dx: p[1], dy: p[2], r: p[3], hp: p[4] * hpK, max: p[4] * hpK, dead: false, cd: 1 + i * 0.5, warn: 0, open: p[0] !== 'port', flash: 0, burst: 0 }); });
      b.max = b.parts.reduce(function (a, p) { return a + p.max; }, 0);
      placeParts(b); return b;
    }
    function placeParts(b) { b.parts.forEach(function (p) { p.x = b.x + p.dx; p.y = b.y + p.dy; }); }
    function guarded(b) { return b.parts.some(function (p) { return !p.dead && p.kind !== 'core' && p.kind !== 'port'; }); }
    function vuln(p) { var b = S.boss; if (p.kind === 'core') return !guarded(b); if (p.kind === 'port') return p.open; return true; }
    function hurtPart(p, dmg, pi) {
      var b = S.boss; if (!b || p.dead) return;
      if (!vuln(p)) { emit('armor', { x: p.x, y: p.y }); return; }
      p.hp -= dmg; p.flash = 0.08; emit('bossHit', { x: p.x, y: p.y });
      if (p.hp <= 0) {
        p.dead = true; addScore(1000); S.booms.push({ x: p.x, y: p.y, r: 34, t: 0.6, max: 0.6 }); emit('partDie', { x: p.x, y: p.y, kind: p.kind });
        if (b.parts.filter(function (q) { return q.kind === 'core' || q.kind === 'port'; }).every(function (q) { return q.dead; })) {
          b.dead = true; b.deadT = 2.2; addScore(SCORE.boss * S.zone);
          S.bullets = S.bullets.filter(function (q) { return q.k !== 'e'; }); S.marks = []; S.lobs = [];
          S.enemies.forEach(function (e) { if (!e.dead) { e.dead = true; S.booms.push({ x: e.x, y: e.y, r: 18, t: 0.4, max: 0.4 }); } });
          emit('bossDie', { x: b.x, y: b.y, key: b.key });
        }
      }
    }
    function aimedBurst(p, n, gap, spd) {
      var h = nearestHero(p.x, p.y); if (!h) return;
      p.burst = n; p.bt = 0; p.aim = Math.atan2(h.y - p.y, h.x - p.x); p.bgap = gap; p.bspd = spd;
    }
    function fan(x, y, n, spread, spd, a0) { a0 = a0 == null ? Math.PI / 2 : a0; for (var i = 0; i < n; i++) eShoot(x, y, a0 + (i - (n - 1) / 2) * spread, spd, 0.3, 'fan'); emit('eshot', { x: x, y: y, mg: true }); }
    function updBoss(dt) {
      var b = S.boss; if (!b) return;
      if (!b.active) { if (S.camY <= 0.5) { b.active = true; b.intro = 2.2; emit('bossIntro', { key: b.key }); } else return; }
      if (b.dead) { b.deadT -= dt; if (b.deadT <= 0 && S.phase === 'play') { S.phase = 'clear'; S.phaseT = 3.2; S.zoneStats.push({ zone: S.zone, t: S.zoneT }); addScore(SCORE.zone * S.zone); emit('clear', { zone: S.zone }); } return; }
      if (b.intro > 0) { b.intro -= dt; return; }
      b.t += dt; var sc = scale() * coop(), spd = eSpeed();
      if (b.key === 'icebreaker') b.x = W / 2 + Math.sin(b.t * 0.45) * 100;
      else if (b.key === 'dredger') b.x = W / 2 + Math.sin(b.t * 0.38) * 120;
      placeParts(b);
      var exposed = !guarded(b);
      b.parts.forEach(function (p) {
        if (p.dead) return; if (p.flash > 0) p.flash -= dt;
        if (p.burst > 0) { p.bt -= dt; if (p.bt <= 0) { p.burst--; p.bt = p.bgap; eShoot(p.x, p.y + 6, p.aim + (rng() - 0.5) * 0.08, p.bspd, 0.3, 'burst'); emit('eshot', { x: p.x, y: p.y }); } return; }
        if (p.warn > 0) { p.warn -= dt; if (p.warn <= 0) p.fire(); return; }
        p.cd -= dt; if (p.cd > 0) return;
        var h = nearestHero(p.x, p.y);
        switch (p.kind) {
          case 'gun': p.warn = 0.4; p.flash = 0.4; p.fire = function () { aimedBurst(p, 3, 0.13, spd + 10); }; p.cd = 2.6 / sc + rng() * 0.8; break;
          case 'mortar': if (h) { lobAt(p.x, p.y, h.x + (rng() - 0.5) * 30, h.y + (rng() - 0.5) * 30, 30, 0.95, 'mortar'); emit('lob', { x: p.x, y: p.y }); } p.cd = 2.5 / sc; break;
          case 'core':
            if (b.key === 'engine') { if (exposed) { p.warn = 0.35; p.flash = 0.35; p.fire = function () { aimedBurst(p, 4, 0.14, spd + 10); }; p.cd = 2.5 / sc; } else p.cd = 1; }
            else if (b.key === 'dredger') { if (exposed) { var ring = 10; for (var r = 0; r < ring; r++) eShoot(p.x, p.y, r / ring * Math.PI * 2 + b.t, spd - 20, 0.3, 'ring'); emit('eshot', { x: p.x, y: p.y, mg: true }); p.cd = 2.6 / sc; if (h) lobAt(p.x, p.y, h.x, h.y, 30, 0.95, 'mortar'); } else p.cd = 1; }
            else { p.warn = 0.45; p.flash = 0.45; p.fire = function () { fan(p.x, p.y + 10, exposed ? 7 : 5, 0.22, spd - 10); if (exposed) aimedBurst(p, 3, 0.14, spd); }; p.cd = (exposed ? 2.8 : 4.2) / sc; }
            break;
          case 'port': break;
          case 'boiler': p.cd = 1; break;
        }
      });
      // особые приёмы
      if (b.key === 'icebreaker' || b.key === 'engine') {
        b.summonT -= dt;
        if (b.summonT <= 0) {
          b.summonT = (b.key === 'engine' ? 9 : 10) / sc;
          if (S.enemies.filter(function (e) { return !e.dead; }).length < 4) [T * 2, W - T * 2].forEach(function (x) { var e = spawn(rng() < 0.3 ? 'grenadier' : 'rifle', x, B_ROW() * T + 12, { turnT: 0 }); e.dir = [0, 1]; });
          emit('spawn', { x: b.x, y: b.y });
        }
      }
      if (b.key === 'engine') {   // спираль котлов: рукава по числу живых котлов (+1 у ядра)
        b.spin += dt * (exposed ? 1.6 : 1.1); b.spT = (b.spT || 0) - dt;
        if (b.spT <= 0) {
          b.spT = exposed ? 0.2 : 0.24;
          var arms = b.parts.filter(function (p) { return !p.dead && p.kind === 'boiler'; }).slice(0, 2);
          if (exposed) arms = [b.parts[4], { x: b.parts[4].x, y: b.parts[4].y, opp: 1 }];
          arms.forEach(function (p, i) { var a = b.spin + i * Math.PI * 2 / Math.max(1, arms.length); if (Math.sin(a) > -0.2) eShoot(p.x, p.y, a, spd - 40, 0.3, 'spiral'); });
        }
      }
      if (b.key === 'crusher') {
        b.boulderT -= dt;
        if (b.boulderT <= 0) {
          var h2 = nearestHero(b.x, b.y), lane = h2 ? Math.max(T * 2, Math.min(W - T * 2, h2.x + (rng() - 0.5) * 60)) : W / 2;
          S.marks.push({ x: lane, y: B_ROW() * T + 14, r: 16, t: 0.8, lane: true });
          S.boulders.push({ x: lane, y: B_ROW() * T - 6, r: 15, hp: 3, wait: 0.8, vy: 150 + 15 * (exposed ? 1 : 0) });
          b.boulderT = (exposed ? 1.5 : 2.1) / sc + rng() * 0.4; emit('rumble', { x: lane });
        }
      }
      if (b.key === 'dam') {
        b.portT -= dt;
        var alive = b.parts.filter(function (p) { return !p.dead; });
        if (b.portT <= 0 && alive.length) {
          b.parts.forEach(function (p) { p.open = false; });
          var k = alive[b.portI % alive.length]; b.portI++;
          (alive.length <= 2 ? alive : [k]).forEach(function (q) { q.open = true; q.openT = 3.2; q.shotT = 0.5; });
          b.portT = 3.2 + 0.5; emit('portOpen', { x: k.x, y: k.y });
        }
        b.parts.forEach(function (p) {
          if (p.dead || !p.open) return;
          p.openT = (p.openT || 3.2) - dt; if (p.openT <= 0) { p.open = false; return; }
          p.shotT = (p.shotT || 0) - dt; if (p.shotT <= 0) { p.shotT = 1.15 / sc; var h3 = nearestHero(p.x, p.y); fan(p.x, p.y + 12, 3, 0.22, spd, h3 ? Math.atan2(h3.y - p.y, h3.x - p.x) : Math.PI / 2); }
        });
        b.summonT -= dt;
        if (b.summonT <= 0) { b.summonT = 11 / sc; if (S.enemies.filter(function (e) { return !e.dead && e.type === 'boat'; }).length < 1) { spawn('boat', rng() < 0.5 ? T * 3 : W - T * 3, 0, { lane: BOSSES.dam.body }); emit('spawn', { x: b.x, y: b.y }); } }
      }
    }
    function B_ROW() { var B = BOSSES[S.boss.key]; return B.body + (B.water || 0); }
    function updBoulders(dt) {
      S.boulders.forEach(function (bo) {
        if (bo.wait > 0) { bo.wait -= dt; return; }
        bo.y += bo.vy * dt; bo.rot = (bo.rot || 0) + dt * 5;
        S.heroes.forEach(function (h) { if (h.alive && !h.out && Math.hypot(h.x - bo.x, h.y - bo.y) < bo.r + HERO_R) { hurtHero(h, 'boulder'); bo.hp = 0; } });
        if (bo.hp <= 0) { bo.dead = true; S.booms.push({ x: bo.x, y: bo.y, r: 20, t: 0.35, max: 0.35 }); emit('rock', { x: bo.x, y: bo.y }); }
        if (bo.y > S.camY + VIEW_H + 30) bo.dead = true;
      });
      S.boulders = S.boulders.filter(function (b) { return !b.dead; });
    }

    // ---------- Камера, появление врагов, чекпоинты ----------
    function updCamera(dt) {
      var live = S.heroes.filter(function (h) { return h.alive && !h.out; });
      if (!live.length) return;
      var lead = Math.min.apply(null, live.map(function (h) { return h.y; })), last = Math.max.apply(null, live.map(function (h) { return h.y; }));
      var target = Math.max(lead - VIEW_H * 0.42, last + 64 - VIEW_H);   // отстающему всегда остаётся ~2.5 клетки снизу
      if (target < S.camY) S.camY = Math.max(0, S.camY - Math.min(S.camY - target, 260 * dt));
      // чекпоинты
      S.D.cps.forEach(function (c, i) { if (i > S.cp && lead < c.y) { S.cp = i; addScore(SCORE.checkpoint); emit('checkpoint', { i: i, x: c.x, y: c.y }); } });
      // плановые враги входят в кадр сверху
      while (S.pending.length && S.pending[0].y > S.camY - 40) {
        var s = S.pending.shift(); if (s.y > S.camY + VIEW_H) continue;
        spawn(s.type, s.x, s.y, { lane: s.lane, tx: s.tx, ty: s.ty, turnT: 0 });
      }
      if (!S.boss && S.camY < VIEW_H * 0.6) S.boss = makeBoss(S.D.boss);
      // подкрепления сверху
      if (!(S.boss && S.boss.active)) {
        S.runT -= dt;
        if (S.runT <= 0) {
          S.runT = (5.0 - 0.4 * S.zone) / coop() + rng() * 1.6;
          var mobile = S.enemies.filter(function (e) { return !e.dead && (e.type === 'rifle' || e.type === 'grenadier'); }).length;
          if (mobile < 3 + S.zone) {
            var row = Math.floor((S.camY + 8) / T), k = 1 + (rng() < 0.3 + 0.08 * S.zone ? 1 : 0);
            for (var j = 0; j < k; j++) for (var tries = 0; tries < 10; tries++) {
              var tx = 2 + Math.floor(rng() * (COLS - 4));
              if (WALK[S.tiles[tx + row * COLS]] && live.every(function (h) { return Math.abs(h.x - tx * T) > 60 || h.y - row * T > 160; })) {
                var e = spawn(rng() < ZONES[S.zone - 1].gren ? 'grenadier' : 'rifle', tx * T + T / 2, row * T + 6, { turnT: 0 }); e.dir = [0, 1]; e.cd = 1.2 + rng(); break;
              }
            }
          }
        }
      }
      // уборка ушедших за нижний край
      S.enemies.forEach(function (e) { if (!e.dead && e.y > S.camY + VIEW_H + 90) { e.dead = true; e.gone = true; } });
      S.enemies = S.enemies.filter(function (e) { return !e.dead; });
      S.items = S.items.filter(function (it) { return !it.taken && it.y < S.camY + VIEW_H + 60; });
    }

    // ---------- Шаг ----------
    function step(dt) {
      S.time += dt;
      if (S.banner > 0) S.banner -= dt;
      if (S.phase === 'cont') { S.contT -= dt; if (S.contT <= 0) { S.phase = 'over'; emit('gameover', {}); } return; }
      if (S.phase === 'clear') {
        S.bar.st = 'idle';
        S.phaseT -= dt;
        if (S.phaseT <= 0 && S.hold && S.zone < S.maxZone) S.phaseT = 0.01;   // карточка «дальше» перед межстраничной — ждём действия игрока
        if (S.phaseT <= 0) { if (S.zone >= S.maxZone) { S.phase = 'won'; emit('win', {}); } else { S.heroes.forEach(function (h) { if (h.out && h.lives <= 0) { /* выбывший возвращается в новой зоне */ h.out = false; h.lives = 1; h.alive = true; h.hp = HP; } }); loadZone(S.zone + 1); } }
        S.heroes.forEach(function (h) { if (h.alive && !h.out) { var m = norm([h.mx, h.my]); moveBody(h, m[0] * SPEED * dt, m[1] * SPEED * dt, HERO_R, WALK); } });
        updLobs(dt); return;
      }
      if (S.phase !== 'play') return;
      S.zoneT = (S.zoneT || 0) + dt;
      S.heroes.forEach(function (h) { updHero(h, dt); });
      updBar(dt);
      if (S.zone === 1 && !S.tipBar && S.barUsed === 0) {   // обучение: первый частокол близко — подсказка про вал
        var hh = S.heroes[0], sg = S.D.segs.filter(function (q) { return q.kind === 'stockade'; })[0];
        if (sg && hh && hh.y - (sg.y0 + 4) * T < 250 && hh.y > (sg.y0 + 4) * T) { S.tipBar = true; emit('tip', { k: 'bar' }); }
      }
      updCamera(dt);
      for (var i = 0; i < S.enemies.length; i++) if (!S.enemies[i].dead) updEnemy(S.enemies[i], dt);
      // контакт с броневиком
      S.enemies.forEach(function (e) { if (e.type !== 'car' || e.dead) return; S.heroes.forEach(function (h) { if (h.alive && !h.out && Math.hypot(h.x - e.x, h.y - e.y) < e.r + HERO_R + 2) hurtHero(h, 'car', 1); }); });
      updBoss(dt); updBoulders(dt); updBullets(dt); updLobs(dt);
    }
    var api = {
      start: function () { loadZone(S.zone); return api; },
      update: function (dt) { var n = Math.ceil(dt / (1 / 60) - 1e-6); for (var i = 0; i < n; i++) step(dt / n); },
      setMove: function (pi, dx, dy) { var h = S.heroes[pi]; if (h) { h.mx = dx; h.my = dy; } },
      setFire: function (pi, on) { var h = S.heroes[pi]; if (h) h.fire = !!on; },
      bar: startBar,
      reviveAd: function () {   // реклама за награду: «ещё один шанс» — с места, 1 жизнь, полный заряд
        if (S.phase !== 'over' && S.phase !== 'cont') return false;
        S.phase = 'play'; S.phaseT = 0; S.charge = BAR.max;
        S.heroes.forEach(function (h) { h.out = false; h.lives = 1; h.alive = false; h.deadT = 0; h.hp = HP; respawn(h); });
        return true;
      },
      boost: function () { if (S.phase !== 'play' || S.boosts >= 2) return false; S.boosts++; S.heroes.forEach(function (h) { if (!h.out) { h.lives++; emit('life', {}); } }); return true; },
      canBoost: function () { return S.phase === 'play' && S.boosts < 2; },
      cont: function () {   // продолжить с последнего чекпоинта
        if (S.phase !== 'cont') return false;
        S.continues--; S.heroes.forEach(function (h) { h.out = false; h.lives = LIVES; h.alive = true; h.hp = HP; h.weapon = 'rifle'; }); S.charge = BAR.max;
        loadZone(S.zone, S.cp >= 0 ? S.cp : null); emit('continue', { left: S.continues }); return true;
      },
      state: function () { return S; },
      _S: S, _spawn: spawn, _loadZone: loadZone, _tileAt: tileAt, _setTile: setTile, _circleHits: circleHits, _los: los, _hurt: hurtHero,
      _boom: boom, _kill: killHero, _makeBoss: function (k) { S.boss = makeBoss(k); return S.boss; }, _hurtPart: hurtPart, _vuln: vuln
    };
    return api;
  }

  DS.Game = Game;
  DS.logic = { genZone: genZone, reach: reach, mulberry32: mulberry32, oct: oct, T: T, COLS: COLS, W: W, VIEW_H: VIEW_H, HUD: HUD, ARENA: ARENA,
    G: G, SOLID: SOLID, WATER: WATER, BRIDGE: BRIDGE, COVER: COVER, CRATE: CRATE, MUD: MUD, WALL: WALL, RUBBLE: RUBBLE, BUNKER: BUNKER, BODY: BODY,
    WALK: WALK, BURN: BURN, SHOTBLK: SHOTBLK, SPEED: SPEED, HERO_R: HERO_R, HP: HP, LIVES: LIVES, CONTINUES: CONTINUES,
    BAR: BAR, GUN: GUN, BULLET: BULLET, ENEMIES: ENEMIES, BOSSES: BOSSES, ZONES: ZONES, MAX_ZONE: MAX_ZONE, BIND: BIND, SCORE: SCORE, EXTRA_LIFE: EXTRA_LIFE, DIRS: DIRS };
})(typeof window !== 'undefined' ? window : globalThis);
