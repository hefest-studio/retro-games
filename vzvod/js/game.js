/* ВЗВОД · логика миссии (без DOM, детерминирована при заданном rng). VZVOD.Game, VZVOD.logic.
   Дружина ремонтников мастерской «Гефест» — заводные болванчики с паяльниками-излучателями — отбивает заводские
   кварталы у механизмов Ржавого Улья. Карта — клетки 16 px (генератор по сиду с проверкой достижимости),
   отряд из 2–6 болванчиков идёт гуськом за лидером (A* лидера + «хлебные крошки» для ведомых), делится на 2 группы,
   садится в транспорт; цели миссий: ульи / зачистка / сопровождение / удержание точки. */
(function (global) {
  'use strict';
  var V = global.VZVOD = global.VZVOD || {};

  var TS = 16, W = 640, HUD = 32, VH = 480, SCREEN_H = 512;
  var GROUND = 0, WALL = 1, LIQ = 2, CRATE = 3, DECOR = 4, PIPE = 5, RAIL = 6, HIVE = 7;
  function solidFoot(t) { return t === WALL || t === LIQ || t === CRATE || t === PIPE || t === HIVE; }
  function solidHover(t) { return t === WALL || t === CRATE || t === PIPE || t === HIVE; }
  function blocksShot(t) { return t === WALL || t === CRATE || t === PIPE || t === HIVE; }
  function groundLike(t) { return t === GROUND || t === DECOR || t === RAIL; }
  var footPass = function (t) { return !solidFoot(t); }, hoverPass = function (t) { return !solidHover(t); };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // ---------- Параметры ----------
  var GAP = 11;                     // дистанция между болванчиками в колонне, px
  var UNIT_R = 5;
  // Ранг болванчика (0..5) → скорость, перезарядка паяльника, разброс, дальность
  var RANK_XP = [0, 4, 10, 18, 30, 45];
  function rankOf(xp) { var r = 0; for (var i = 0; i < RANK_XP.length; i++) if (xp >= RANK_XP[i]) r = i; return r; }
  function stats(rank) { rank = Math.max(0, Math.min(5, rank | 0)); return { speed: 56 + 3 * rank, cd: 0.40 - 0.03 * rank, spread: 0.13 - 0.016 * rank, range: 220 + 6 * rank }; }
  var BULLET_V = 380, BOLT_DMG = 1;
  var ENEMY = {
    drone:  { hp: 1, r: 5, speed: 40, sight: 165, range: 150, cd: [2.0, 3.0], err: 0.17, bolt: 125, burst: 1 },
    rusher: { hp: 1, r: 5, speed: 70, sight: 160, range: 0,   cd: [1, 1],     err: 0,    bolt: 0,   burst: 0 },
    turret: { hp: 4, r: 7, speed: 0,  sight: 185, range: 180, cd: [2.2, 2.9], err: 0.11, bolt: 145, burst: 3 },
    heavy:  { hp: 6, r: 8, speed: 27, sight: 180, range: 170, cd: [1.4, 2.0], err: 0.13, bolt: 135, burst: 2 }
  };
  var SCORE = { drone: 50, rusher: 60, turret: 150, heavy: 200, hive: 400, mission: 500 };
  var VEH = {
    cart:    { hp: 8, speed: 68,  mover: 'foot',  weapon: 'shell', cd: 1.0,  r: 8 },
    skimmer: { hp: 5, speed: 104, mover: 'hover', weapon: 'gun',   cd: 0.13, r: 8 }
  };
  var AMMO = { gear: 3, rocket: 2 };      // сколько даёт ящик
  var GEAR_RANGE = 175, GEAR_R = 30, ROCKET_R = 28, SHELL_R = 24, ROCKET_V = 300, SHELL_V = 260;

  // ---------- Операции и миссии (6 × 2–4) ----------
  function M(o) {
    return Object.assign({ obj: 'hives', biome: 'factory', w: 52, h: 38, hives: 2, hiveHp: 1, drones: 4, rushers: 0, turrets: 0, heavies: 0,
      gear: 1, rocket: 0, veh: [], gears: 4, rockets: 0, spawn: ['drone'], spawnInt: 7.5, hiveCap: 3, holdT: 35, waveInt: 9, waveN: 2 }, o);
  }
  var OPS = [
    { squad: 4, missions: [
      M({ obj: 'hives', w: 46, h: 34, hives: 2, drones: 4, gear: 1, gears: 4 }),
      M({ obj: 'clear', w: 50, h: 36, hives: 2, drones: 5, rushers: 2, turrets: 1, gear: 1, rocket: 1, gears: 3, rockets: 1, spawn: ['drone', 'rusher'] })] },
    { squad: 4, missions: [
      M({ obj: 'hives', w: 56, h: 40, hives: 3, hiveHp: 2, drones: 6, rushers: 2, turrets: 2, gear: 2, rocket: 1, gears: 4, rockets: 1, spawn: ['drone', 'rusher'] }),
      M({ obj: 'escort', w: 58, h: 40, hives: 1, drones: 7, rushers: 2, turrets: 1, gear: 1, rocket: 1, gears: 3, rockets: 1 }),
      M({ obj: 'hold', w: 52, h: 40, hives: 1, hiveHp: 2, drones: 4, rushers: 2, holdT: 35, gear: 1, rocket: 1, gears: 3, rockets: 1, spawn: ['rusher', 'drone'] })] },
    { squad: 5, missions: [
      M({ obj: 'hives', biome: 'snow', w: 60, h: 44, hives: 3, hiveHp: 2, drones: 8, rushers: 3, turrets: 1, gear: 2, rocket: 1, gears: 4, rockets: 1, spawn: ['drone', 'rusher'] }),
      M({ obj: 'hives', biome: 'snow', w: 62, h: 44, hives: 4, hiveHp: 2, drones: 7, rushers: 2, turrets: 2, heavies: 1, gear: 1, rocket: 1, veh: ['cart'], gears: 3, rockets: 1 }),
      M({ obj: 'escort', biome: 'snow', w: 60, h: 42, hives: 2, drones: 8, rushers: 3, turrets: 1, gear: 2, rocket: 1, gears: 3, rockets: 1, spawn: ['drone', 'rusher'] })] },
    { squad: 5, missions: [
      M({ obj: 'hives', biome: 'swamp', w: 62, h: 44, hives: 3, hiveHp: 2, drones: 8, rushers: 3, turrets: 2, gear: 2, rocket: 1, veh: ['skimmer'], gears: 4, rockets: 1, spawn: ['drone', 'rusher'] }),
      M({ obj: 'hold', biome: 'swamp', w: 56, h: 42, hives: 2, hiveHp: 2, drones: 6, rushers: 3, turrets: 1, holdT: 40, gear: 1, rocket: 1, gears: 3, rockets: 1, waveN: 2, spawn: ['rusher', 'drone'] }),
      M({ obj: 'clear', biome: 'swamp', w: 56, h: 42, hives: 2, hiveHp: 2, drones: 6, rushers: 3, turrets: 1, heavies: 1, gear: 2, rocket: 1, gears: 4, rockets: 2, spawn: ['drone', 'rusher'] })] },
    { squad: 6, missions: [
      M({ obj: 'hives', biome: 'snow', w: 64, h: 46, hives: 4, hiveHp: 2, drones: 8, rushers: 3, turrets: 2, heavies: 1, gear: 2, rocket: 2, veh: ['cart'], gears: 4, rockets: 1, spawn: ['drone', 'rusher'] }),
      M({ obj: 'hold', biome: 'snow', w: 58, h: 44, hives: 2, hiveHp: 2, drones: 7, rushers: 3, turrets: 2, heavies: 1, holdT: 45, gear: 2, rocket: 1, gears: 3, rockets: 1, waveN: 3, spawn: ['rusher', 'drone'] }),
      M({ obj: 'escort', biome: 'snow', w: 62, h: 44, hives: 2, hiveHp: 2, drones: 9, rushers: 4, turrets: 2, heavies: 1, gear: 2, rocket: 1, veh: ['cart'], gears: 3, rockets: 1, spawn: ['drone', 'rusher'] })] },
    { squad: 6, missions: [
      M({ obj: 'hives', biome: 'swamp', w: 64, h: 46, hives: 4, hiveHp: 2, drones: 9, rushers: 4, turrets: 2, heavies: 1, gear: 2, rocket: 2, veh: ['skimmer'], gears: 4, rockets: 2, spawn: ['drone', 'rusher'] }),
      M({ obj: 'escort', biome: 'factory', w: 62, h: 44, hives: 2, hiveHp: 2, drones: 10, rushers: 4, turrets: 3, heavies: 1, gear: 2, rocket: 1, gears: 3, rockets: 2, spawn: ['drone', 'rusher'] }),
      M({ obj: 'hold', biome: 'factory', w: 58, h: 44, hives: 2, hiveHp: 2, drones: 6, rushers: 3, turrets: 1, heavies: 1, holdT: 45, gear: 2, rocket: 2, gears: 3, rockets: 2, waveN: 2, waveInt: 8, spawn: ['rusher', 'drone', 'drone', 'heavy'] }),
      M({ obj: 'clear', biome: 'factory', w: 64, h: 46, hives: 4, hiveHp: 2, drones: 7, rushers: 3, turrets: 2, heavies: 1, gear: 3, rocket: 2, veh: ['cart'], gears: 5, rockets: 2, spawn: ['drone', 'rusher'] })] }
  ];
  OPS.forEach(function (op, oi) { op.missions.forEach(function (m, mi) { m.op = oi; m.mi = mi; m.id = (oi + 1) + '-' + (mi + 1); m.squad = op.squad; }); });
  function mission(oi, mi) { return OPS[oi] && OPS[oi].missions[mi]; }

  // ---------- Сетка ----------
  function tget(Mp, x, y) { return (x < 0 || y < 0 || x >= Mp.w || y >= Mp.h) ? WALL : Mp.t[y * Mp.w + x]; }
  function tset(Mp, x, y, v) { if (x >= 0 && y >= 0 && x < Mp.w && y < Mp.h) Mp.t[y * Mp.w + x] = v; }
  function tileAt(Mp, px, py) { return tget(Mp, Math.floor(px / TS), Math.floor(py / TS)); }
  function bfs(Mp, sx, sy, pass) {
    var w = Mp.w, d = new Int32Array(w * Mp.h).fill(-1), q = new Int32Array(w * Mp.h), qh = 0, qt = 0;
    if (!pass(tget(Mp, sx, sy))) return d;
    d[sy * w + sx] = 0; q[qt++] = sy * w + sx;
    while (qh < qt) {
      var i = q[qh++], x = i % w, y = (i / w) | 0;
      for (var k = 0; k < 4; k++) {
        var nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0), j = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= Mp.h || d[j] >= 0 || !pass(Mp.t[j])) continue;
        d[j] = d[i] + 1; q[qt++] = j;
      }
    }
    return d;
  }
  // A* по клеткам, 8 направлений без «срезания углов». → [[x,y],…] (от старта до цели) или null
  function astar(Mp, sx, sy, gx, gy, pass) {
    var w = Mp.w, h = Mp.h, N = w * h;
    if (!pass(tget(Mp, sx, sy)) || !pass(tget(Mp, gx, gy))) return null;
    if (!Mp._g || Mp._g.length !== N) { Mp._g = new Float32Array(N); Mp._from = new Int32Array(N); Mp._st = new Uint32Array(N); Mp._stamp = 0; }
    var g = Mp._g, from = Mp._from, st = Mp._st, stamp = (Mp._stamp += 2), open = stamp, closed = stamp + 1;
    var heapI = [], heapF = [];
    function push(i, f) { heapI.push(i); heapF.push(f); var c = heapI.length - 1; while (c > 0) { var p = (c - 1) >> 1; if (heapF[p] <= heapF[c]) break; var ti = heapI[p]; heapI[p] = heapI[c]; heapI[c] = ti; var tf = heapF[p]; heapF[p] = heapF[c]; heapF[c] = tf; c = p; } }
    function pop() { var top = heapI[0], li = heapI.pop(), lf = heapF.pop(); if (heapI.length) { heapI[0] = li; heapF[0] = lf; var c = 0; for (;;) { var l = 2 * c + 1, r = l + 1, m = c; if (l < heapI.length && heapF[l] < heapF[m]) m = l; if (r < heapI.length && heapF[r] < heapF[m]) m = r; if (m === c) break; var ti = heapI[m]; heapI[m] = heapI[c]; heapI[c] = ti; var tf = heapF[m]; heapF[m] = heapF[c]; heapF[c] = tf; c = m; } } return top; }
    function hh(x, y) { var dx = Math.abs(x - gx), dy = Math.abs(y - gy); return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy); }
    var s = sy * w + sx, goal = gy * w + gx;
    g[s] = 0; from[s] = -1; st[s] = open; push(s, hh(sx, sy));
    while (heapI.length) {
      var i = pop(); if (st[i] === closed) continue; st[i] = closed;
      if (i === goal) { var out = []; while (i >= 0) { out.push([i % w, (i / w) | 0]); i = from[i]; } return out.reverse(); }
      var x = i % w, y = (i / w) | 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        var j = ny * w + nx; if (st[j] === closed || !pass(Mp.t[j])) continue;
        if (dx && dy && (!pass(Mp.t[y * w + nx]) || !pass(Mp.t[ny * w + x]))) continue;
        var ng = g[i] + (dx && dy ? 1.4142 : 1);
        if (st[j] !== open || ng < g[j]) { g[j] = ng; from[j] = i; st[j] = open; push(j, ng + hh(nx, ny)); }
      }
    }
    return null;
  }
  function nearestPass(Mp, tx, ty, pass, maxR) {
    if (pass(tget(Mp, tx, ty))) return [tx, ty];
    for (var r = 1; r <= (maxR || 8); r++) {
      var best = null, bd = 1e9;
      for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (pass(tget(Mp, tx + dx, ty + dy))) { var d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [tx + dx, ty + dy]; } }
      }
      if (best) return best;
    }
    return null;
  }
  // Прямая проходимость отрезка (с «толщиной» rad) — для сглаживания пути
  function walkable(Mp, ax, ay, bx, by, pass, rad) {
    var d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / 4));
    for (var i = 0; i <= n; i++) {
      var x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n;
      if (!pass(tileAt(Mp, x - rad, y - rad)) || !pass(tileAt(Mp, x + rad, y - rad)) || !pass(tileAt(Mp, x - rad, y + rad)) || !pass(tileAt(Mp, x + rad, y + rad))) return false;
    }
    return true;
  }
  // Путь в пикселях: A* по клеткам + сглаживание. → [{x,y}, …] (без стартовой точки) или null
  function findPath(Mp, x0, y0, x1, y1, mover) {
    var pass = mover === 'hover' ? hoverPass : footPass, rad = mover === 'hover' || mover === 'cart' ? 6 : 4;
    var s = nearestPass(Mp, Math.floor(x0 / TS), Math.floor(y0 / TS), pass, 3); if (!s) return null;
    var gt = [Math.floor(x1 / TS), Math.floor(y1 / TS)], exact = pass(tget(Mp, gt[0], gt[1]));
    if (!exact) { gt = nearestPass(Mp, gt[0], gt[1], pass, 8); if (!gt) return null; }
    var tiles = astar(Mp, s[0], s[1], gt[0], gt[1], pass); if (!tiles) return null;
    var pts = tiles.map(function (c) { return { x: c[0] * TS + TS / 2, y: c[1] * TS + TS / 2 }; });
    if (exact) pts[pts.length - 1] = { x: x1, y: y1 };
    var out = [], cx = x0, cy = y0, i = 0;
    while (i < pts.length) {
      var j = Math.min(pts.length - 1, i + 14);
      while (j > i && !walkable(Mp, cx, cy, pts[j].x, pts[j].y, pass, rad)) j--;
      out.push(pts[j]); cx = pts[j].x; cy = pts[j].y; i = j + 1;
    }
    return out;
  }
  function los(Mp, ax, ay, bx, by) {
    var d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / 3));
    for (var i = 1; i < n; i++) if (blocksShot(tileAt(Mp, ax + (bx - ax) * i / n, ay + (by - ay) * i / n))) return false;
    return true;
  }

  // ---------- Генератор карты миссии ----------
  function genMission(spec, seed) {
    for (var a = 0; a < 80; a++) { var m = tryGen(spec, ((seed | 0) * 7919 + a * 104729 + 17) >>> 0); if (m) { m.seed = seed; m.tries = a + 1; return m; } }
    throw new Error('vzvod: карта ' + spec.id + ' не собралась');
  }
  function tryGen(spec, seed) {
    var r = mulberry32(seed), w = spec.w, h = spec.h, Mp = { w: w, h: h, t: new Uint8Array(w * h), biome: spec.biome };
    function ri(a, b) { return a + Math.floor(r() * (b - a + 1)); }
    var x, y, i, k;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (!x || !y || x === w - 1 || y === h - 1) tset(Mp, x, y, WALL);
    var sx = 4, sy = h - 5;
    function nearStart(x0, y0, rw, rh) { return x0 <= 12 && y0 + rh >= h - 12; }
    function setIf(x0, y0, v, only) { var t = tget(Mp, x0, y0); if (x0 > 0 && y0 > 0 && x0 < w - 1 && y0 < h - 1 && (!only || only(t))) tset(Mp, x0, y0, v); }
    function block(x0, y0, rw, rh, v) { for (var yy = y0; yy < y0 + rh; yy++) for (var xx = x0; xx < x0 + rw; xx++) setIf(xx, yy, v); }
    function hollow(x0, y0, rw, rh, v) {
      for (var yy = y0; yy < y0 + rh; yy++) for (var xx = x0; xx < x0 + rw; xx++) setIf(xx, yy, (xx === x0 || yy === y0 || xx === x0 + rw - 1 || yy === y0 + rh - 1) ? v : GROUND);
      for (var d = 0; d < 2; d++) { // две двери шириной в клетку — узкие проходы для колонны
        var side = ri(0, 3), px = side < 2 ? ri(x0 + 1, x0 + rw - 2) : (side === 2 ? x0 : x0 + rw - 1), py = side < 2 ? (side === 0 ? y0 : y0 + rh - 1) : ri(y0 + 1, y0 + rh - 2);
        setIf(px, py, GROUND);
      }
    }
    function puddle(cx, cy, rad, v) { for (var yy = Math.floor(cy - rad); yy <= cy + rad; yy++) for (var xx = Math.floor(cx - rad); xx <= cx + rad; xx++) { var dd = Math.hypot(xx - cx, (yy - cy) * 1.2); if (dd <= rad - r() * 0.8) setIf(xx, yy, v, groundLike); } }
    var area = w * h, n;
    if (spec.biome === 'factory') {
      n = Math.round(area / 115);
      for (i = 0; i < n; i++) {
        var rw = ri(3, 8), rh = ri(3, 6); x = ri(2, w - rw - 2); y = ri(2, h - rh - 2); if (nearStart(x, y, rw, rh)) continue;
        if (r() < 0.32 && rw >= 6 && rh >= 5) hollow(x, y, rw, rh, WALL); else block(x, y, rw, rh, WALL);
      }
      for (k = 0; k < 2; k++) { y = ri(4, h - 6); for (x = 1; x < w - 1; x++) setIf(x, y, RAIL, function (t) { return t === GROUND; }); }
      n = Math.round(area / 170); for (i = 0; i < n; i++) { x = ri(2, w - 3); y = ri(2, h - 3); for (k = ri(2, 4); k > 0; k--) setIf(x + ri(-1, 1), y + ri(-1, 1), CRATE, function (t) { return t === GROUND; }); }
      n = Math.round(area / 30); for (i = 0; i < n; i++) setIf(ri(1, w - 2), ri(1, h - 2), DECOR, function (t) { return t === GROUND; });
    } else if (spec.biome === 'snow') {
      n = Math.round(area / 250);
      for (i = 0; i < n; i++) { var ww = ri(8, 12), wh = ri(6, 9); x = ri(2, w - ww - 2); y = ri(2, h - wh - 2); if (nearStart(x, y, ww, wh)) continue; hollow(x, y, ww, wh, WALL); }
      n = Math.round(area / 300); for (i = 0; i < n; i++) { x = ri(3, w - 4); y = ri(3, h - 4); if (nearStart(x - 4, y - 4, 8, 8)) continue; puddle(x, y, 1.5 + r() * 2.2, LIQ); }
      n = Math.round(area / 220); for (i = 0; i < n; i++) { x = ri(2, w - 3); y = ri(2, h - 3); for (k = ri(2, 3); k > 0; k--) setIf(x + ri(-1, 1), y + ri(-1, 1), CRATE, function (t) { return t === GROUND; }); }
      n = Math.round(area / 22); for (i = 0; i < n; i++) setIf(ri(1, w - 2), ri(1, h - 2), DECOR, function (t) { return t === GROUND; });
    } else { // swamp
      n = Math.round(area / 170); for (i = 0; i < n; i++) { x = ri(3, w - 4); y = ri(3, h - 4); if (nearStart(x - 5, y - 5, 10, 10)) continue; puddle(x, y, 2 + r() * 3, LIQ); }
      n = Math.round(area / 230);
      for (i = 0; i < n; i++) {
        var len = ri(6, 14), hor = r() < 0.5, gap = ri(2, len - 3); x = ri(2, w - 3); y = ri(2, h - 3);
        for (k = 0; k < len; k++) if (k !== gap) setIf(hor ? x + k : x, hor ? y : y + k, PIPE, function (t) { return t !== WALL; });
      }
      n = Math.round(area / 420); for (i = 0; i < n; i++) { var bw = ri(3, 5), bh = ri(3, 4); x = ri(2, w - bw - 2); y = ri(2, h - bh - 2); if (!nearStart(x, y, bw, bh)) block(x, y, bw, bh, WALL); }
      n = Math.round(area / 26); for (i = 0; i < n; i++) setIf(ri(1, w - 2), ri(1, h - 2), DECOR, function (t) { return t === GROUND; });
    }
    for (y = h - 11; y < h - 1; y++) for (x = 1; x <= 11; x++) tset(Mp, x, y, GROUND);   // площадка высадки

    var D = bfs(Mp, sx, sy, footPass), maxd = 0;
    for (i = 0; i < D.length; i++) if (D[i] > maxd) maxd = D[i];
    if (maxd < 30) return null;
    var occ = new Uint8Array(w * h);
    function free(xx, yy) { var j = yy * w + xx; return xx > 0 && yy > 0 && xx < w - 1 && yy < h - 1 && D[j] >= 0 && groundLike(Mp.t[j]) && !occ[j]; }
    function cands(minD, maxD, extra) { var out = []; for (var yy = 1; yy < h - 1; yy++) for (var xx = 1; xx < w - 1; xx++) { var d0 = D[yy * w + xx]; if (d0 >= minD && d0 <= maxD && free(xx, yy) && (!extra || extra(xx, yy))) out.push([xx, yy]); } return out; }
    function pick(list) { return list.length ? list[Math.floor(r() * list.length)] : null; }
    // ульи (2×2) — подальше от высадки и друг от друга
    var hives = [], hmin = Math.max(16, Math.round(maxd * 0.35));
    for (i = 0; i < spec.hives; i++) {
      var hc = cands(hmin, 1e9, function (xx, yy) {
        if (!free(xx + 1, yy) || !free(xx, yy + 1) || !free(xx + 1, yy + 1)) return false;
        for (var q = 0; q < hives.length; q++) if (Math.abs(hives[q].tx - xx) + Math.abs(hives[q].ty - yy) < 12) return false;
        return true;
      });
      var hp = pick(hc); if (!hp) return null;
      hives.push({ tx: hp[0], ty: hp[1] });
      for (var dy2 = -1; dy2 <= 2; dy2++) for (var dx2 = -1; dx2 <= 2; dx2++) { var oxx = hp[0] + dx2, oyy = hp[1] + dy2; if (oxx >= 0 && oyy >= 0 && oxx < w && oyy < h) occ[oyy * w + oxx] = 1; }
      tset(Mp, hp[0], hp[1], HIVE); tset(Mp, hp[0] + 1, hp[1], HIVE); tset(Mp, hp[0], hp[1] + 1, HIVE); tset(Mp, hp[0] + 1, hp[1] + 1, HIVE);
    }
    D = bfs(Mp, sx, sy, footPass);
    for (i = 0; i < hives.length; i++) if (!hiveRing(Mp, D, hives[i]).length) return null;
    function take(p) { if (p) occ[p[1] * w + p[0]] = 1; return p; }
    function center(p) { return { x: p[0] * TS + TS / 2, y: p[1] * TS + TS / 2 }; }
    var enemies = [];
    function addEnemies(type, cnt, minD) { for (var e = 0; e < cnt; e++) { var p = take(pick(cands(minD, 1e9))); if (!p) return false; var c = center(p); enemies.push({ type: type, x: c.x, y: c.y }); } return true; }
    if (!addEnemies('drone', spec.drones, 14) || !addEnemies('rusher', spec.rushers, 18) || !addEnemies('turret', spec.turrets, 18) || !addEnemies('heavy', spec.heavies, 22)) return null;
    var pickups = [];
    for (i = 0; i < spec.gear + spec.rocket; i++) { var pp = take(pick(cands(Math.round(maxd * 0.2), Math.round(maxd * 0.85)))); if (!pp) return null; var pc = center(pp); pickups.push({ kind: i < spec.gear ? 'gear' : 'rocket', x: pc.x, y: pc.y }); }
    var vehicles = [];
    for (i = 0; i < spec.veh.length; i++) {
      var vt = spec.veh[i], vp;
      if (vt === 'skimmer') vp = take(pick(cands(5, 26, function (xx, yy) { return tget(Mp, xx + 1, yy) === LIQ || tget(Mp, xx - 1, yy) === LIQ || tget(Mp, xx, yy + 1) === LIQ || tget(Mp, xx, yy - 1) === LIQ; })));
      else vp = take(pick(cands(6, 20, function (xx, yy) { for (var a2 = -1; a2 <= 1; a2++) for (var b2 = -1; b2 <= 1; b2++) if (solidFoot(tget(Mp, xx + a2, yy + b2))) return false; return true; })));
      if (!vp) return null; var vc = center(vp); vehicles.push({ type: vt, x: vc.x, y: vc.y });
    }
    var vip = null, exit = null, zone = null, spawns = [];
    if (spec.obj === 'escort') {
      vip = center([sx + 3, sy - 1]);
      var far = cands(Math.round(maxd * 0.85), 1e9); var ep = take(pick(far)); if (!ep) return null; exit = center(ep);
    }
    if (spec.obj === 'hold') {
      var zp = take(pick(cands(Math.round(maxd * 0.4), Math.round(maxd * 0.65), function (xx, yy) {
        var c2 = 0; for (var a3 = -3; a3 <= 3; a3++) for (var b3 = -3; b3 <= 3; b3++) if (!solidFoot(tget(Mp, xx + a3, yy + b3))) c2++; return c2 >= 37;
      })));
      if (!zp) return null; zone = center(zp); zone.r = 44;
      var DZ = bfs(Mp, zp[0], zp[1], footPass), sp = [];
      for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) { var j2 = y * w + x; if (DZ[j2] >= 18 && D[j2] >= 14 && groundLike(Mp.t[j2])) sp.push([x, y]); }
      if (sp.length < 6) return null;
      for (i = 0; i < 10; i++) spawns.push(center(pick(sp)));
    }
    return { w: w, h: h, t: Mp.t, biome: spec.biome, start: center([sx, sy]), startTile: [sx, sy], hives: hives, enemies: enemies, pickups: pickups,
      vehicles: vehicles, vip: vip, exit: exit, zone: zone, spawns: spawns, maxd: maxd };
  }
  function hiveRing(Mp, D, hv) {
    var out = [];
    for (var dy = -1; dy <= 2; dy++) for (var dx = -1; dx <= 2; dx++) {
      if (dx >= 0 && dx <= 1 && dy >= 0 && dy <= 1) continue;
      var x = hv.tx + dx, y = hv.ty + dy; if (x < 0 || y < 0 || x >= Mp.w || y >= Mp.h) continue;
      if (D[y * Mp.w + x] >= 0) out.push([x, y]);
    }
    return out;
  }
  // Проверка миссии: все цели достижимы пешком от высадки, боеприпасов хватает на ульи
  function checkMission(spec, Mp) {
    var D = bfs(Mp, Mp.startTile[0], Mp.startTile[1], footPass), errs = [];
    function reach(p) { return D[Math.floor(p.y / TS) * Mp.w + Math.floor(p.x / TS)] >= 0; }
    Mp.hives.forEach(function (hv, i) { if (!hiveRing(Mp, D, hv).length) errs.push('улей ' + i); });
    Mp.pickups.forEach(function (p, i) { if (!reach(p)) errs.push('ящик ' + i); });
    Mp.vehicles.forEach(function (v, i) { if (!reach(v)) errs.push('транспорт ' + i); });
    Mp.enemies.forEach(function (e, i) { if (!reach(e)) errs.push('враг ' + i); });
    if (spec.obj === 'escort') { if (!Mp.vip || !reach(Mp.vip)) errs.push('наладчик'); if (!Mp.exit || !reach(Mp.exit)) errs.push('выход'); }
    if (spec.obj === 'hold' && (!Mp.zone || !reach(Mp.zone))) errs.push('точка');
    var need = spec.hives * spec.hiveHp, have = spec.gears + spec.rockets + spec.gear * AMMO.gear + spec.rocket * AMMO.rocket;
    if ((spec.obj === 'hives' || spec.obj === 'clear') && have < need + 1) errs.push('боеприпасы ' + have + '<' + (need + 1));
    return { ok: !errs.length, errs: errs, need: need, have: have };
  }

  // ---------- Игра (одна миссия) ----------
  function Game(o) {
    o = o || {};
    var spec = o.spec || mission(0, 0), rng = o.rng || mulberry32(o.seed || 1), emit = o.onEvent || function () {};
    var MP = o.map || genMission(spec, o.mapSeed != null ? o.mapSeed : (o.seed || 1));
    var map = { w: MP.w, h: MP.h, t: new Uint8Array(MP.t), biome: MP.biome };
    var S = {
      spec: spec, map: map, src: MP, time: 0, phase: 'play', phaseT: 0, reason: null,
      units: [], groups: [mkGroup(), mkGroup()], active: 0,
      enemies: [], hives: [], bullets: [], bolts: [], nades: [], missiles: [], booms: [], sparks: [], pickups: [], vehicles: [],
      vip: null, exit: MP.exit, zone: MP.zone ? { x: MP.zone.x, y: MP.zone.y, r: MP.zone.r } : null,
      ammo: { gear: o.gears != null ? o.gears : spec.gears, rocket: o.rockets != null ? o.rockets : spec.rockets },
      score: 0, kills: 0, hivesKilled: 0, obj: { kind: spec.obj, prog: 0, need: spec.obj === 'hold' ? spec.holdT : 1, started: false },
      mapVer: 0, holdWaveT: 3, result: null, invuln: !!o.invuln
    };
    var nextId = 1;
    function mkGroup() { return { order: [], vehicle: null, board: null, target: null, fire: { on: false, x: 0, y: 0 }, autoT: 0, auto: null }; }
    function U(id) { for (var i = 0; i < S.units.length; i++) if (S.units[i].id === id) return S.units[i]; return null; }
    function V2(id) { for (var i = 0; i < S.vehicles.length; i++) if (S.vehicles[i].id === id) return S.vehicles[i]; return null; }
    function path(x0, y0, x1, y1, mover) { return findPath(map, x0, y0, x1, y1, mover) || []; }

    // --- расстановка ---
    var squad = o.squad || [{ id: 1, name: 'A', rank: 0 }, { id: 2, name: 'B', rank: 0 }, { id: 3, name: 'C', rank: 0 }, { id: 4, name: 'D', rank: 0 }];
    (function place() {
      var st = MP.startTile, D = bfs(map, st[0], st[1], footPass), list = [];
      for (var y = 0; y < map.h; y++) for (var x = 0; x < map.w; x++) { var d = D[y * map.w + x]; if (d >= 0) list.push([d, x, y]); }
      list.sort(function (a, b) { return a[0] - b[0] || a[2] - b[2] || a[1] - b[1]; });
      squad.forEach(function (b, i) {
        var c = list[Math.min(i * 1, list.length - 1)];
        var u = { id: b.id, name: b.name, rank: b.rank | 0, st: stats(b.rank), x: c[1] * TS + TS / 2, y: c[2] * TS + TS / 2, alive: true, gi: 0,
          q: [], crumbs: [], ci: 0, cd: 0.3, ang: -Math.PI / 2, kills: 0, inV: null, moving: false, deadT: 0, need: false, chk: 0, flash: 0, walk: 0 };
        S.units.push(u); S.groups[0].order.push(u.id);
      });
      // колонна с лидером впереди (ближе к центру карты)
      S.groups[0].order.reverse();
    })();
    MP.hives.forEach(function (hv, i) { S.hives.push({ id: i, tx: hv.tx, ty: hv.ty, x: hv.tx * TS + TS, y: hv.ty * TS + TS, hp: spec.hiveHp, max: spec.hiveHp, dead: false, spawnT: 2 + i * 1.3, k: i, flash: 0 }); });
    MP.enemies.forEach(function (e) { spawnEnemy(e.type, e.x, e.y, null); });
    MP.pickups.forEach(function (p) { S.pickups.push({ kind: p.kind, x: p.x, y: p.y, taken: false }); });
    MP.vehicles.forEach(function (v, i) { var K = VEH[v.type]; S.vehicles.push({ id: i + 1, type: v.type, x: v.x, y: v.y, hp: K.hp, max: K.hp, crew: null, q: [], cd: 0, ang: -Math.PI / 2, dead: false, flash: 0 }); });
    if (MP.vip) S.vip = { x: MP.vip.x, y: MP.vip.y, hp: 4, max: 4, q: [], repath: 0, alive: true, ang: 0, moving: false, flash: 0 };
    resetFollowers(0);

    function spawnEnemy(type, x, y, from) {
      var K = ENEMY[type];
      var e = { id: nextId++, type: type, x: x, y: y, r: K.r, hp: K.hp, max: K.hp, q: [], repath: rng() * 0.5, cd: K.cd[0] * (0.5 + rng() * 0.6), burst: 0, burstT: 0,
        tgt: null, alertT: 0, dead: false, ang: rng() * Math.PI * 2, flash: 0, from: from, wander: 2 + rng() * 3, home: { x: x, y: y }, walk: 0 };
      S.enemies.push(e); return e;
    }

    // --- колонна ---
    function leader(gi) { var g = S.groups[gi]; return g.order.length ? U(g.order[0]) : null; }
    function resetFollowers(gi) {
      var g = S.groups[gi];
      for (var i = 1; i < g.order.length; i++) { var f = U(g.order[i]), p = U(g.order[i - 1]); f.q = []; f.ci = p.crumbs.length; f.need = true; }
    }
    function groupSpeed(g) { var s = 1e9; g.order.forEach(function (id) { s = Math.min(s, U(id).st.speed); }); return s; }
    function moveAlong(ent, speed, dt, pass) {
      var step = speed * dt, moved = false;
      while (step > 1e-6 && ent.q.length) {
        var p = ent.q[0], dx = p.x - ent.x, dy = p.y - ent.y, d = Math.hypot(dx, dy);
        if (d < 1e-6) { ent.q.shift(); continue; }
        var nx, ny, k;
        if (d <= step) { nx = p.x; ny = p.y; k = d; } else { nx = ent.x + dx / d * step; ny = ent.y + dy / d * step; k = step; }
        if (pass && !pass(tileAt(map, nx, ny))) { ent.q = []; break; }
        ent.x = nx; ent.y = ny; ent.ang = Math.atan2(dy, dx); moved = true; step -= k;
        if (k === d) ent.q.shift();
      }
      return moved;
    }
    function crumb(u) {
      var c = u.crumbs, l = c[c.length - 1];
      if (!l || Math.hypot(u.x - l.x, u.y - l.y) >= 3) c.push({ x: u.x, y: u.y });
      if (c.length > 500) {
        c.splice(0, 250);
        var g = S.groups[u.gi], i = g.order.indexOf(u.id);
        if (i >= 0 && i + 1 < g.order.length) { var f = U(g.order[i + 1]); f.ci = Math.max(0, f.ci - 250); }
      }
    }
    function qLen(u) { var s = 0, px = u.x, py = u.y; for (var i = 0; i < u.q.length; i++) { s += Math.hypot(u.q[i].x - px, u.q[i].y - py); px = u.q[i].x; py = u.q[i].y; } return s; }
    function stepGroup(gi, dt) {
      var g = S.groups[gi]; if (!g.order.length || g.vehicle) return;
      var gs = groupSpeed(g), L0 = U(g.order[0]);
      L0.moving = moveAlong(L0, gs, dt, footPass); if (L0.moving) { crumb(L0); L0.walk += dt; }
      if (g.board) {
        var v = V2(g.board);
        if (!v || v.dead || v.crew != null) g.board = null;
        else if (dist(L0, v) < 16) board(gi, v);
        if (g.vehicle) return;
      }
      for (var i = 1; i < g.order.length; i++) {
        var f = U(g.order[i]), p = U(g.order[i - 1]);
        while (f.ci < p.crumbs.length) f.q.push(p.crumbs[f.ci++]);
        var d = dist(f, p); f.moving = false; f.chk -= dt;
        if (d > GAP) {
          if (f.need || !f.q.length || (f.chk <= 0 && f.q.length > 4 && qLen(f) > d * 2.6 + 40)) {
            f.chk = 0.5; f.need = false; f.q = path(f.x, f.y, p.x, p.y, 'foot'); f.ci = p.crumbs.length;
          }
          f.moving = moveAlong(f, d > GAP * 1.8 ? gs * 1.3 : gs, dt, footPass);
          if (f.moving) { crumb(f); f.walk += dt; }
        }
      }
    }

    // --- команды игрока (активная группа) ---
    function other() { return 1 - S.active; }
    function clampPt(x, y) { return { x: Math.max(TS, Math.min(map.w * TS - TS, x)), y: Math.max(TS, Math.min(map.h * TS - TS, y)) }; }
    var api = {
      start: function () { emit('start', { id: spec.id }); return api; },
      state: function () { return S; },
      leader: leader,
      moveTo: function (x, y) {
        if (S.phase !== 'play') return false;
        var g = S.groups[S.active]; if (!g.order.length) return false;
        var p = clampPt(x, y); g.target = p;
        if (g.vehicle) { var v = V2(g.vehicle); v.q = path(v.x, v.y, p.x, p.y, VEH[v.type].mover === 'hover' ? 'hover' : 'cart'); emit('order', p); return true; }
        g.board = null;
        for (var i = 0; i < S.vehicles.length; i++) { var vv = S.vehicles[i]; if (!vv.dead && vv.crew == null && dist(vv, p) < 15) { g.board = vv.id; p = { x: vv.x, y: vv.y }; break; } }
        var L0 = leader(S.active); L0.q = path(L0.x, L0.y, p.x, p.y, 'foot');
        emit('order', p); return L0.q.length > 0 || dist(L0, p) < 2;
      },
      fire: function (on, x, y) { var g = S.groups[S.active]; g.fire.on = !!on && S.phase === 'play'; if (x != null) { g.fire.x = x; g.fire.y = y; } },
      aim: function (x, y) { var g = S.groups[S.active]; g.fire.x = x; g.fire.y = y; },
      gear: function (x, y) { return throwGear(x, y); },
      rocket: function (x, y) { return launchRocket(x, y); },
      split: split, merge: merge,
      splitMerge: function () { return S.groups[other()].order.length ? merge() : split(); },
      switchGroup: function () { if (!S.groups[other()].order.length) return false; S.groups[S.active].fire.on = false; S.active = other(); emit('switch', { gi: S.active }); return true; },
      exitVehicle: function () { return exitVehicle(S.active); },
      update: update,
      // отладка/тесты
      _S: S, _spawn: spawnEnemy, _explode: function (x, y, r, by) { explode(x, y, r, by); }, _break: function (u) { breakUnit(u, 'test'); },
      _resetFollowers: resetFollowers, _path: path, _board: function (gi, v) { board(gi, v); }
    };

    function split() {
      var a = S.active, g = S.groups[a], b = S.groups[other()];
      if (S.phase !== 'play' || b.order.length || g.vehicle || g.order.length < 2) return false;
      var n = Math.floor(g.order.length / 2), moving = g.order.splice(g.order.length - n, n);
      b.order = moving; b.target = null; b.board = null; b.fire.on = false; b.vehicle = null;
      moving.forEach(function (id) { var u = U(id); u.gi = other(); u.q = []; u.crumbs = []; });
      U(moving[0]).q = [];
      resetFollowers(a); resetFollowers(other());
      emit('split', { n: n }); return true;
    }
    function merge() {
      var a = S.active, b = other(), ga = S.groups[a], gb = S.groups[b];
      if (S.phase !== 'play' || !gb.order.length || !ga.order.length || ga.vehicle || gb.vehicle) return false;
      gb.order.forEach(function (id) { U(id).gi = a; ga.order.push(id); });
      gb.order = []; gb.target = null; gb.fire.on = false; gb.board = null;
      resetFollowers(a); emit('merge', {}); return true;
    }
    function board(gi, v) {
      var g = S.groups[gi]; g.board = null; g.vehicle = v.id; v.crew = gi; v.q = [];
      g.order.forEach(function (id) { var u = U(id); u.inV = v.id; u.q = []; u.crumbs = []; u.x = v.x; u.y = v.y; });
      emit('board', { type: v.type, x: v.x, y: v.y });
    }
    function eject(gi, v) {
      var g = S.groups[gi], t = nearestPass(map, Math.floor(v.x / TS), Math.floor(v.y / TS), footPass, 6);
      if (!t) return false;
      var px = t[0] * TS + TS / 2, py = t[1] * TS + TS / 2;
      g.order.forEach(function (id, i) { var u = U(id); u.inV = null; u.x = px + (i % 2 ? 2 : -2); u.y = py; u.q = []; u.crumbs = []; });
      g.vehicle = null; v.crew = null; v.q = []; g.target = null; resetFollowers(gi);
      return true;
    }
    function exitVehicle(gi) {
      var g = S.groups[gi]; if (!g.vehicle || S.phase !== 'play') return false;
      var v = V2(g.vehicle);
      if (solidFoot(tileAt(map, v.x, v.y))) { emit('noExit', {}); return false; }
      if (!eject(gi, v)) return false;
      emit('exitV', { type: v.type, x: v.x, y: v.y }); return true;
    }
    function throwGear(x, y) {
      var g = S.groups[S.active], L0 = leader(S.active);
      if (S.phase !== 'play' || !L0 || g.vehicle) return false;
      if (S.ammo.gear <= 0) { emit('noAmmo', { kind: 'gear' }); return false; }
      var dx = x - L0.x, dy = y - L0.y, d = Math.hypot(dx, dy) || 1;
      if (d > GEAR_RANGE) { x = L0.x + dx / d * GEAR_RANGE; y = L0.y + dy / d * GEAR_RANGE; d = GEAR_RANGE; }
      S.ammo.gear--; S.nades.push({ x0: L0.x, y0: L0.y, x1: x, y1: y, x: L0.x, y: L0.y, z: 0, t: 0, T: 0.35 + d / 260, by: L0.id });
      emit('throw', { x: L0.x, y: L0.y }); return true;
    }
    function launchRocket(x, y) {
      var g = S.groups[S.active], L0 = leader(S.active);
      if (S.phase !== 'play' || !L0 || g.vehicle) return false;
      if (S.ammo.rocket <= 0) { emit('noAmmo', { kind: 'rocket' }); return false; }
      var dx = x - L0.x, dy = y - L0.y, d = Math.hypot(dx, dy) || 1;
      S.ammo.rocket--; S.missiles.push({ kind: 'rocket', x: L0.x, y: L0.y, vx: dx / d * ROCKET_V, vy: dy / d * ROCKET_V, left: Math.min(320, Math.max(24, d)), by: L0.id, r: ROCKET_R });
      emit('rocket', { x: L0.x, y: L0.y }); return true;
    }

    // --- стрельба ---
    function shoot(u, tx, ty, slow) {
      var a = Math.atan2(ty - u.y, tx - u.x) + (rng() - 0.5) * 2 * u.st.spread;
      S.bullets.push({ x: u.x + Math.cos(a) * 5, y: u.y + Math.sin(a) * 5, vx: Math.cos(a) * BULLET_V, vy: Math.sin(a) * BULLET_V, life: u.st.range / BULLET_V, by: u.id });
      u.ang = a; u.cd = u.st.cd * (0.85 + rng() * 0.3) * (slow ? 1.6 : 1); u.flash = 0.06;
      emit('shot', { x: u.x, y: u.y });
    }
    function nearestEnemy(x, y, R, needLos) {
      var best = null, bd = R;
      for (var i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (e.dead) continue; var d = Math.hypot(e.x - x, e.y - y); if (d < bd && (!needLos || los(map, x, y, e.x, e.y))) { bd = d; best = e; } }
      return best;
    }
    function groupFire(gi, dt) {
      var g = S.groups[gi]; if (!g.order.length) return;
      var act = gi === S.active, tx, ty, slow = false;
      if (act && g.fire.on) { tx = g.fire.x; ty = g.fire.y; }
      else if (!act || !g.fire.on) {
        // неактивная группа (и транспорт неактивной группы) отстреливается сама
        if (act) return;
        g.autoT -= dt;
        if (g.autoT <= 0) { g.autoT = 0.25; var c = g.vehicle ? V2(g.vehicle) : leader(gi); g.auto = c ? nearestEnemy(c.x, c.y, 150, true) : null; }
        if (!g.auto || g.auto.dead) return; tx = g.auto.x; ty = g.auto.y; slow = true;
      }
      if (g.vehicle) { vehicleFire(V2(g.vehicle), tx, ty, slow); return; }
      g.order.forEach(function (id) { var u = U(id); if (u.cd <= 0 && Math.hypot(tx - u.x, ty - u.y) > 6) shoot(u, tx, ty, slow); });
    }
    function vehicleFire(v, tx, ty, slow) {
      if (v.cd > 0) return; var K = VEH[v.type], dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy) || 1;
      v.ang = Math.atan2(dy, dx);
      if (K.weapon === 'shell') {
        S.missiles.push({ kind: 'shell', x: v.x + dx / d * 9, y: v.y + dy / d * 9, vx: dx / d * SHELL_V, vy: dy / d * SHELL_V, left: Math.min(280, Math.max(30, d)), by: -1, r: SHELL_R, veh: v.id });
        v.cd = K.cd * (slow ? 1.5 : 1); emit('shell', { x: v.x, y: v.y });
      } else {
        for (var s = -1; s <= 1; s += 2) {
          var a = v.ang + (rng() - 0.5) * 0.12, ox = Math.cos(v.ang + Math.PI / 2) * 4 * s, oy = Math.sin(v.ang + Math.PI / 2) * 4 * s;
          S.bullets.push({ x: v.x + ox, y: v.y + oy, vx: Math.cos(a) * BULLET_V, vy: Math.sin(a) * BULLET_V, life: 240 / BULLET_V, by: -1 });
        }
        v.cd = K.cd * (slow ? 1.5 : 1); emit('shot', { x: v.x, y: v.y });
      }
    }
    function hitEnemy(e, dmg, by) {
      if (e.dead) return;
      e.hp -= dmg; e.flash = 0.12; alertNear(e.x, e.y, 150, 6);
      if (e.hp <= 0) {
        e.dead = true; S.kills++; S.score += SCORE[e.type];
        var u = by > 0 ? U(by) : null; if (u) u.kills++;
        emit('kill', { type: e.type, x: e.x, y: e.y });
      } else emit('hit', { x: e.x, y: e.y });
    }
    function alertNear(x, y, R, t) { S.enemies.forEach(function (e) { if (!e.dead && Math.hypot(e.x - x, e.y - y) < R) e.alertT = Math.max(e.alertT, t); }); }
    function explode(x, y, r, by) {
      S.booms.push({ x: x, y: y, r: r, t: 0, max: 0.45 }); emit('boom', { x: x, y: y, r: r });
      S.enemies.forEach(function (e) { if (!e.dead && Math.hypot(e.x - x, e.y - y) < r + e.r) hitEnemy(e, 4, by); });
      S.hives.forEach(function (hv) {
        if (hv.dead || Math.hypot(hv.x - x, hv.y - y) >= r + 14) return;
        hv.hp--; hv.flash = 0.25; emit('hiveHit', { x: hv.x, y: hv.y, hp: hv.hp });
        if (hv.hp <= 0) destroyHive(hv);
      });
      var t0x = Math.floor((x - r) / TS), t1x = Math.floor((x + r) / TS), t0y = Math.floor((y - r) / TS), t1y = Math.floor((y + r) / TS);
      for (var ty = t0y; ty <= t1y; ty++) for (var tx = t0x; tx <= t1x; tx++) {
        if (tget(map, tx, ty) === CRATE && Math.hypot(tx * TS + 8 - x, ty * TS + 8 - y) < r + 4) { tset(map, tx, ty, DECOR); S.mapVer++; }
      }
      S.units.forEach(function (u) { if (u.alive && u.inV == null && Math.hypot(u.x - x, u.y - y) < r * 0.5) breakUnit(u, 'blast'); });
      if (S.vip && S.vip.alive && Math.hypot(S.vip.x - x, S.vip.y - y) < r * 0.5) hurtVip(2);
      alertNear(x, y, 200, 5);
    }
    function destroyHive(hv) {
      hv.dead = true; S.hivesKilled++; S.score += SCORE.hive;
      for (var dy = 0; dy < 2; dy++) for (var dx = 0; dx < 2; dx++) tset(map, hv.tx + dx, hv.ty + dy, DECOR);
      S.mapVer++; emit('hiveDown', { x: hv.x, y: hv.y });
    }
    function breakUnit(u, src) {
      if (!u.alive || S.invuln) return;
      u.alive = false; u.deadT = 0; u.q = [];
      var g = S.groups[u.gi], i = g.order.indexOf(u.id);
      if (i >= 0) {
        g.order.splice(i, 1);
        if (i === 0 && g.order.length) { var nl = U(g.order[0]); nl.q = g.target ? path(nl.x, nl.y, g.target.x, g.target.y, 'foot') : []; }
        resetFollowers(u.gi);
      }
      emit('broken', { id: u.id, name: u.name, x: u.x, y: u.y, src: src });
      if (!g.order.length) { g.fire.on = false; g.target = null; if (u.gi === S.active && S.groups[1 - u.gi].order.length) { S.active = 1 - u.gi; emit('switch', { gi: S.active, auto: true }); } }
    }
    function hurtVip(d) { var v = S.vip; if (!v || !v.alive || S.invuln) return; v.hp -= d; v.flash = 0.2; emit('vipHit', { hp: v.hp }); if (v.hp <= 0) { v.alive = false; emit('vipDown', { x: v.x, y: v.y }); } }
    function hurtVehicle(v, d) {
      if (v.dead || S.invuln) return; v.hp -= d; v.flash = 0.15; emit('vhit', {});
      if (v.hp <= 0) {
        v.dead = true; S.booms.push({ x: v.x, y: v.y, r: 26, t: 0, max: 0.5 }); emit('vehDown', { type: v.type, x: v.x, y: v.y });
        if (v.crew != null) eject(v.crew, v);
      }
    }

    // --- цели врагов ---
    function targets() {
      var out = [];
      S.units.forEach(function (u) { if (u.alive && u.inV == null) out.push({ k: 'u', o: u }); });
      S.vehicles.forEach(function (v) { if (!v.dead && v.crew != null) out.push({ k: 'v', o: v }); });
      if (S.vip && S.vip.alive) out.push({ k: 'p', o: S.vip });
      return out;
    }
    function enemyThink(e, T) {
      var K = ENEMY[e.type], best = null, bd = 1e9, R = e.alertT > 0 ? (e.type === 'turret' ? K.sight : 600) : K.sight;
      for (var i = 0; i < T.length; i++) {
        var o = T[i].o, d = Math.hypot(o.x - e.x, o.y - e.y);
        if (d < R && d < bd && (e.alertT > 0 && e.type !== 'turret' && d > K.sight ? true : los(map, e.x, e.y, o.x, o.y))) { bd = d; best = T[i]; }
      }
      e.tgt = best; e.tgtD = bd;
      if (best && bd < K.sight && e.alertT <= 0) alertNear(e.x, e.y, 110, 4);
      if (K.speed <= 0) return;
      if (best) {
        var o2 = best.o, see = bd < K.sight && los(map, e.x, e.y, o2.x, o2.y);
        if (K.range && see && bd < K.range * 0.8) e.q = [];
        else e.q = path(e.x, e.y, o2.x, o2.y, 'foot').slice(0, 6);
      } else if (!e.q.length) {
        e.wander -= 0.6;
        if (e.wander <= 0) { e.wander = 2.5 + rng() * 3; var a = rng() * Math.PI * 2, dd = 16 + rng() * 40; e.q = path(e.x, e.y, e.home.x + Math.cos(a) * dd, e.home.y + Math.sin(a) * dd, 'foot').slice(0, 4); }
      }
    }
    function enemyFire(e, K) {
      var o = e.tgt.o, a = Math.atan2(o.y - e.y, o.x - e.x) + (rng() - 0.5) * 2 * K.err;
      S.bolts.push({ x: e.x + Math.cos(a) * (e.r + 2), y: e.y + Math.sin(a) * (e.r + 2), vx: Math.cos(a) * K.bolt, vy: Math.sin(a) * K.bolt, life: (K.range + 40) / K.bolt });
      e.ang = a; emit('eshot', { x: e.x, y: e.y, type: e.type });
    }
    function stepEnemies(dt) {
      var T = targets(), i, j;
      for (i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (e.dead) continue;
        var K = ENEMY[e.type];
        e.flash = Math.max(0, e.flash - dt); e.alertT = Math.max(0, e.alertT - dt); e.cd -= dt; e.repath -= dt;
        if (e.repath <= 0) { e.repath = (e.tgt ? 0.6 : 0.5) + rng() * 0.3; enemyThink(e, T); }
        if (e.tgt && (e.tgt.o.dead || e.tgt.o.alive === false || (e.tgt.k === 'u' && e.tgt.o.inV != null) || (e.tgt.k === 'v' && e.tgt.o.crew == null))) { e.tgt = null; e.q = []; }
        if (K.speed > 0) { var sp = K.speed * (e.tgt ? 1 : 0.5); if (moveAlong(e, sp, dt, footPass)) e.walk += dt; }
        if (!e.tgt) continue;
        var o = e.tgt.o, d = Math.hypot(o.x - e.x, o.y - e.y);
        if (e.type === 'rusher') {
          if (d < e.r + 7) {
            e.dead = true; S.sparks.push({ x: e.x, y: e.y, t: 0 }); emit('zap', { x: e.x, y: e.y });
            if (e.tgt.k === 'u') breakUnit(o, 'rusher'); else if (e.tgt.k === 'v') hurtVehicle(o, 2); else hurtVip(2);
          }
          continue;
        }
        if (e.burst > 0) { e.burstT -= dt; if (e.burstT <= 0) { e.burst--; e.burstT = 0.14; if (d < K.range + 30) enemyFire(e, K); } continue; }
        if (e.cd <= 0 && d < K.range && los(map, e.x, e.y, o.x, o.y)) {
          e.cd = K.cd[0] + rng() * (K.cd[1] - K.cd[0]); e.burst = K.burst - 1; e.burstT = 0.14; enemyFire(e, K);
        }
      }
      // расталкивание
      for (i = 0; i < S.enemies.length; i++) {
        var a = S.enemies[i]; if (a.dead || ENEMY[a.type].speed <= 0) continue;
        for (j = i + 1; j < S.enemies.length; j++) {
          var b = S.enemies[j]; if (b.dead) continue;
          var dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy), m = a.r + b.r;
          if (dd < m && dd > 0.01) { var k = (m - dd) / 2 / dd, nx = a.x - dx * k, ny = a.y - dy * k; if (footPass(tileAt(map, nx, ny))) { a.x = nx; a.y = ny; } if (ENEMY[b.type].speed > 0) { nx = b.x + dx * k; ny = b.y + dy * k; if (footPass(tileAt(map, nx, ny))) { b.x = nx; b.y = ny; } } }
        }
      }
      if (S.enemies.length > 60) S.enemies = S.enemies.filter(function (e) { return !e.dead; });
    }
    function stepHives(dt) {
      var alive = 0; S.enemies.forEach(function (e) { if (!e.dead) alive++; });
      S.hives.forEach(function (hv) {
        if (hv.dead) return; hv.flash = Math.max(0, hv.flash - dt); hv.spawnT -= dt;
        if (hv.spawnT > 0) return;
        hv.spawnT = spec.spawnInt * (0.8 + rng() * 0.4);
        var near = false; S.units.forEach(function (u) { if (u.alive && Math.hypot(u.x - hv.x, u.y - hv.y) < 340) near = true; });
        S.vehicles.forEach(function (v) { if (!v.dead && v.crew != null && Math.hypot(v.x - hv.x, v.y - hv.y) < 340) near = true; });
        if (!near || alive >= 28) return;
        var mine = 0; S.enemies.forEach(function (e) { if (!e.dead && e.from === hv.id) mine++; });
        if (mine >= spec.hiveCap) return;
        var ring = [];
        for (var dy = -1; dy <= 2; dy++) for (var dx = -1; dx <= 2; dx++) if ((dx < 0 || dx > 1 || dy < 0 || dy > 1) && footPass(tget(map, hv.tx + dx, hv.ty + dy))) ring.push([hv.tx + dx, hv.ty + dy]);
        if (!ring.length) return;
        var c = ring[Math.floor(rng() * ring.length)], type = spec.spawn[hv.k++ % spec.spawn.length];
        var e = spawnEnemy(type, c[0] * TS + 8, c[1] * TS + 8, hv.id); e.alertT = 8; alive++;
        emit('spawn', { type: type, x: e.x, y: e.y });
      });
    }
    function stepHold(dt) {
      var z = S.zone; if (!z) return;
      var inside = false;
      S.units.forEach(function (u) { if (u.alive && Math.hypot(u.x - z.x, u.y - z.y) < z.r) inside = true; });
      S.vehicles.forEach(function (v) { if (!v.dead && v.crew != null && Math.hypot(v.x - z.x, v.y - z.y) < z.r) inside = true; });
      z.inside = inside;
      if (inside) { if (!S.obj.started) { S.obj.started = true; emit('holdStart', {}); } S.obj.prog = Math.min(S.obj.need, S.obj.prog + dt); }
      if (!S.obj.started) return;
      S.holdWaveT -= dt;
      if (S.holdWaveT <= 0) {
        S.holdWaveT = spec.waveInt;
        var alive = 0; S.enemies.forEach(function (e) { if (!e.dead) alive++; }); if (alive >= 26) return;
        for (var i = 0; i < spec.waveN; i++) {
          var sp = MP.spawns[Math.floor(rng() * MP.spawns.length)], type = spec.spawn[(i + Math.floor(S.time)) % spec.spawn.length];
          var e = spawnEnemy(type, sp.x, sp.y, null); e.alertT = 40;
        }
        emit('wave', {});
      }
    }
    function stepVip(dt) {
      var v = S.vip; if (!v || !v.alive) return;
      v.flash = Math.max(0, v.flash - dt); v.repath -= dt;
      var near = false;
      S.units.forEach(function (u) { if (u.alive && Math.hypot(u.x - v.x, u.y - v.y) < 80) near = true; });
      S.vehicles.forEach(function (w) { if (!w.dead && w.crew != null && Math.hypot(w.x - v.x, w.y - v.y) < 80) near = true; });
      v.near = near; v.moving = false;
      if (!near) return;
      if (!v.q.length || v.repath <= 0) { v.repath = 1.5; v.q = path(v.x, v.y, S.exit.x, S.exit.y, 'foot'); }
      v.moving = moveAlong(v, 34, dt, footPass);
      S.obj.prog = Math.max(0, Math.min(1, 1 - dist(v, S.exit) / Math.max(1, dist(MP.vip, MP.exit))));
    }
    function stepVehicles(dt) {
      S.vehicles.forEach(function (v) {
        if (v.dead) return; v.cd -= dt; v.flash = Math.max(0, v.flash - dt);
        if (v.crew == null) return;
        var K = VEH[v.type];
        v.moving = moveAlong(v, K.speed, dt, K.mover === 'hover' ? hoverPass : footPass);
        S.groups[v.crew].order.forEach(function (id) { var u = U(id); u.x = v.x; u.y = v.y; });
      });
    }
    function stepShots(dt) {
      var i, b, k, n;
      for (i = 0; i < S.bullets.length; i++) {
        b = S.bullets[i]; n = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 4));
        for (k = 0; k < n && !b.dead; k++) {
          b.x += b.vx * dt / n; b.y += b.vy * dt / n;
          var t = tileAt(map, b.x, b.y);
          if (blocksShot(t)) { b.dead = true; S.sparks.push({ x: b.x, y: b.y, t: 0.15 }); if (t === HIVE) emit('ping', { x: b.x, y: b.y }); break; }
          for (var j = 0; j < S.enemies.length; j++) { var e = S.enemies[j]; if (!e.dead && Math.hypot(e.x - b.x, e.y - b.y) < e.r + 2) { hitEnemy(e, 1, b.by); b.dead = true; break; } }
        }
        b.life -= dt; if (b.life <= 0) b.dead = true;
      }
      S.bullets = S.bullets.filter(function (q) { return !q.dead; });
      for (i = 0; i < S.bolts.length; i++) {
        b = S.bolts[i]; n = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 4));
        for (k = 0; k < n && !b.dead; k++) {
          b.x += b.vx * dt / n; b.y += b.vy * dt / n;
          if (blocksShot(tileAt(map, b.x, b.y))) { b.dead = true; break; }
          for (var u2 = 0; u2 < S.units.length; u2++) { var u = S.units[u2]; if (u.alive && u.inV == null && Math.hypot(u.x - b.x, u.y - b.y) < UNIT_R + 2.5) { b.dead = true; breakUnit(u, 'bolt'); break; } }
          if (b.dead) break;
          for (var v2 = 0; v2 < S.vehicles.length; v2++) { var v = S.vehicles[v2]; if (!v.dead && v.crew != null && Math.hypot(v.x - b.x, v.y - b.y) < 10) { b.dead = true; hurtVehicle(v, BOLT_DMG); break; } }
          if (!b.dead && S.vip && S.vip.alive && Math.hypot(S.vip.x - b.x, S.vip.y - b.y) < 8) { b.dead = true; hurtVip(1); }
        }
        b.life -= dt; if (b.life <= 0) b.dead = true;
      }
      S.bolts = S.bolts.filter(function (q) { return !q.dead; });
      for (i = 0; i < S.nades.length; i++) {
        b = S.nades[i]; b.t += dt; var f = Math.min(1, b.t / b.T);
        b.x = b.x0 + (b.x1 - b.x0) * f; b.y = b.y0 + (b.y1 - b.y0) * f; b.z = Math.sin(Math.PI * f) * 26;
        if (f >= 1) { b.dead = true; explode(b.x1, b.y1, GEAR_R, b.by); }
      }
      S.nades = S.nades.filter(function (q) { return !q.dead; });
      for (i = 0; i < S.missiles.length; i++) {
        b = S.missiles[i]; var sp = Math.hypot(b.vx, b.vy); n = Math.max(1, Math.ceil(sp * dt / 4));
        for (k = 0; k < n && !b.dead; k++) {
          var sx = b.vx * dt / n, sy = b.vy * dt / n; b.x += sx; b.y += sy; b.left -= sp * dt / n;
          var hit = blocksShot(tileAt(map, b.x, b.y)) || b.left <= 0;
          if (!hit) for (var j2 = 0; j2 < S.enemies.length; j2++) { var e2 = S.enemies[j2]; if (!e2.dead && Math.hypot(e2.x - b.x, e2.y - b.y) < e2.r + 3) { hit = true; break; } }
          if (hit) { b.dead = true; explode(b.x - sx * 0.5, b.y - sy * 0.5, b.r, b.by); }
        }
      }
      S.missiles = S.missiles.filter(function (q) { return !q.dead; });
    }
    function stepPickups() {
      S.pickups.forEach(function (p) {
        if (p.taken) return;
        var got = false;
        S.units.forEach(function (u) { if (u.alive && Math.hypot(u.x - p.x, u.y - p.y) < 14) got = true; });
        if (got) { p.taken = true; S.ammo[p.kind] += AMMO[p.kind]; emit('pickup', { kind: p.kind, n: AMMO[p.kind], x: p.x, y: p.y }); }
      });
    }
    // Тупик «нечем взорвать улей»: боеприпасы кончились, ящиков нет — через 8 с мастерская присылает ящик шестерней к лидеру
    function stepSupply(dt) {
      if ((spec.obj !== 'hives' && spec.obj !== 'clear') || S.ammo.gear + S.ammo.rocket > 0 || S.nades.length || S.missiles.some(function (m) { return m.kind === 'rocket'; })) { S.supplyT = 0; return; }
      if (!S.hives.some(function (h) { return !h.dead; }) || S.pickups.some(function (p) { return !p.taken; })) { S.supplyT = 0; return; }
      S.supplyT = (S.supplyT || 0) + dt; if (S.supplyT < 8) return;
      S.supplyT = 0;
      var L0 = leader(S.active) || S.units.filter(function (u) { return u.alive; })[0]; if (!L0) return;
      var t = nearestPass(map, Math.floor(L0.x / TS) + 2, Math.floor(L0.y / TS), footPass, 6); if (!t) return;
      var p = { kind: 'gear', x: t[0] * TS + 8, y: t[1] * TS + 8, taken: false, supply: true };
      S.pickups.push(p); emit('supply', { x: p.x, y: p.y });
    }
    function aliveUnits() { var n = 0; S.units.forEach(function (u) { if (u.alive) n++; }); return n; }
    function checkEnd() {
      if (S.phase !== 'play') return;
      var o = S.obj, hivesLeft = S.hives.filter(function (h) { return !h.dead; }).length, enemiesLeft = S.enemies.filter(function (e) { return !e.dead; }).length;
      o.hivesLeft = hivesLeft; o.enemiesLeft = enemiesLeft;
      var done = false;
      if (o.kind === 'hives') { o.prog = S.hives.length ? (S.hives.length - hivesLeft) / S.hives.length : 1; done = hivesLeft === 0; }
      else if (o.kind === 'clear') { o.prog = hivesLeft + enemiesLeft; done = hivesLeft === 0 && enemiesLeft === 0; }
      else if (o.kind === 'escort') done = S.vip && S.vip.alive && dist(S.vip, S.exit) < 22;
      else if (o.kind === 'hold') done = o.prog >= o.need;
      if (done) { S.phase = 'won'; S.phaseT = 0; S.score += SCORE.mission * (spec.op + 1); finish(true); emit('won', {}); return; }
      if (!aliveUnits()) { S.phase = 'lost'; S.reason = 'squad'; S.phaseT = 0; finish(false); emit('lost', { reason: 'squad' }); return; }
      if (o.kind === 'escort' && S.vip && !S.vip.alive) { S.phase = 'lost'; S.reason = 'vip'; S.phaseT = 0; finish(false); emit('lost', { reason: 'vip' }); }
    }
    function finish(won) {
      S.groups.forEach(function (g) { g.fire.on = false; });
      S.result = { won: won, reason: S.reason, score: S.score, kills: S.kills, hives: S.hivesKilled, time: S.time, ammo: { gear: S.ammo.gear, rocket: S.ammo.rocket },
        units: S.units.map(function (u) { return { id: u.id, alive: u.alive, kills: u.kills }; }) };
    }
    function update(dt) {
      var n = Math.max(1, Math.ceil(dt / (1 / 60))), h = dt / n;
      for (var s = 0; s < n; s++) step(h);
    }
    function step(dt) {
      S.time += dt; if (S.phase !== 'play') S.phaseT += dt;
      S.units.forEach(function (u) { u.cd -= dt; u.flash = Math.max(0, u.flash - dt); if (!u.alive) u.deadT += dt; });
      if (S.phase === 'play') {
        stepGroup(0, dt); stepGroup(1, dt);
        stepVehicles(dt);
        groupFire(0, dt); groupFire(1, dt);
        stepEnemies(dt); stepHives(dt);
        if (spec.obj === 'hold') stepHold(dt);
        if (spec.obj === 'escort') stepVip(dt);
        stepPickups(); stepSupply(dt);
      }
      stepShots(dt);
      S.booms.forEach(function (b) { b.t += dt; }); S.booms = S.booms.filter(function (b) { return b.t < b.max; });
      S.sparks.forEach(function (b) { b.t += dt; }); S.sparks = S.sparks.filter(function (b) { return b.t < 0.35; });
      checkEnd();
    }
    return api;
  }

  V.Game = Game;
  V.logic = {
    TS: TS, W: W, HUD: HUD, VH: VH, SCREEN_H: SCREEN_H, ZOOM: 1.25, VIEW_W: W / 1.25, VIEW_H: VH / 1.25, GAP: GAP, UNIT_R: UNIT_R,
    T: { GROUND: GROUND, WALL: WALL, LIQ: LIQ, CRATE: CRATE, DECOR: DECOR, PIPE: PIPE, RAIL: RAIL, HIVE: HIVE },
    solidFoot: solidFoot, solidHover: solidHover, blocksShot: blocksShot, footPass: footPass, hoverPass: hoverPass,
    RANK_XP: RANK_XP, rankOf: rankOf, stats: stats, ENEMY: ENEMY, SCORE: SCORE, VEH: VEH, AMMO: AMMO,
    GEAR_RANGE: GEAR_RANGE, GEAR_R: GEAR_R, ROCKET_R: ROCKET_R,
    OPS: OPS, mission: mission, genMission: genMission, checkMission: checkMission, hiveRing: hiveRing,
    bfs: bfs, astar: astar, findPath: findPath, walkable: walkable, los: los, tget: tget, tileAt: tileAt, mulberry32: mulberry32
  };
})(typeof window !== 'undefined' ? window : globalThis);
