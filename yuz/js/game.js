/* ЮЗ · логика без DOM: трассы-«комнаты», физика машинки с заносом, покрытия, трамплины,
   чекпоинты/круги, выбывание за край экрана, бонусы, боты, чемпионат из 8 трасс.
   YUZ.Game(opts) → api; YUZ.logic — константы, трассы, buildTrack, drive (ИИ водителя). Детерминирована при заданном rng. */
(function (global) {
  'use strict';
  var Y = global.YUZ = global.YUZ || {};

  // ---------- Константы ----------
  var U = 40;            // единица точек трассы, px мира
  var CELL = 8;          // клетка сетки покрытий, px
  var DS = 6;            // шаг выборки осевой линии, px
  var MARGIN = 170;      // поля мира вокруг трассы
  var NCP = 10;          // чекпоинтов на круг
  var CP_WIN = 70;       // глубина «ворот» чекпоинта по ходу, px
  var LAPS = 3;
  var STEP = 1 / 60;
  var VIEW = { w: 512, h: 352 };   // видимая область мира (камера) — по ней считается выбывание
  var OUT_T = 0.7;       // сколько секунд вне экрана до выбывания
  var PTS = [5, 3, 2, 1];
  var ASPH = 0, WALL = 1, SAND = 2, ICE = 3, WATER = 4, OIL = 5, JUMP = 6;
  var SNAME = { sand: SAND, ice: ICE, water: WATER, oil: OIL, jump: JUMP };
  // grip — гашение бокового скольжения (1/с), drag — множитель сопротивления, acc — множитель тяги
  var SURF = [];
  SURF[ASPH] = { grip: 9, drag: 1, acc: 1 };
  SURF[SAND] = { grip: 6.5, drag: 2.3, acc: 0.8 };
  SURF[ICE] = { grip: 0.9, drag: 0.7, acc: 0.5 };
  SURF[WATER] = { grip: 1.8, drag: 1.5, acc: 0.75 };
  SURF[OIL] = { grip: 0.45, drag: 0.9, acc: 0.55 };
  SURF[JUMP] = SURF[ASPH];
  var CAR = { r: 7, acc: 270, k: 1.4, brake: 430, rev: 80, turn: 3.3, turnV: 70, jumpV: 90, boostT: 1.6, boostAcc: 1.35, shieldT: 6 };
  var ITEM_R = 12, ITEM_RESPAWN = 6;

  var BIND = {
    p1: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], drift: ['Slash', 'ShiftRight', 'Numpad0'] },
    p2: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], drift: ['KeyF', 'ShiftLeft'] }
  };

  // Соперники-боты: характер = темп (pace), осторожность к покрытиям (care), любимая полоса (lane), напор (push)
  var BOTS = [
    { id: 'pin', color: '#e8484f', pace: 1.0, care: 0.35, lane: -0.15, push: 1, look: 1.08 },
    { id: 'bun', color: '#f2b233', pace: 0.97, care: 1.0, lane: 0.2, push: 0, look: 0.95 }
  ];
  var HUMANS = [{ id: 'p1', color: '#3d8bff' }, { id: 'p2', color: '#33d17a' }];
  // Рост сложности по трассам: множитель темпа ботов (подобран ботом-игроком под каждую трассу:
  // на «Морозилке» боты осторожны на льду — им нужен запас темпа)
  var DIFF = [0.86, 0.89, 0.9, 0.915, 0.918, 0.928, 0.968, 0.918];

  // ---------- Трассы (8 «комнат»; точки в единицах U, по часовой; старт — точка 0 → 1) ----------
  // patches: a..b — доля круга, o — центр поперёк (−1..1 от полуширины), w — полуширина пятна, round — «лужа»-эллипс
  var TRACKS = [
    { id: 'warmup', room: 'desk', hw: 46, pts: [[0, 0], [8, 0], [16, 0], [20, 2], [20, 8], [16, 11], [12, 10], [8, 12], [2, 11], [-1, 7], [-1, 3]],
      patches: [{ a: 0.40, b: 0.47, s: 'sand', o: 0.55, w: 0.5 }, { a: 0.70, b: 0.74, s: 'oil', o: -0.35, w: 0.35, round: true }],
      items: [{ at: 0.12, o: 0.4, k: 'boost' }, { at: 0.58, o: -0.4, k: 'shield' }] },
    { id: 'shavings', room: 'bench', hw: 45, pts: [[0, 0], [10, 0], [18, 0], [22, 3], [22, 8], [18, 10], [13, 10], [11, 13], [11, 18], [8, 21], [3, 21], [0, 18], [0, 10], [-1, 4]],
      patches: [{ a: 0.52, b: 0.60, s: 'sand', o: -0.5, w: 0.55 }, { a: 0.735, s: 'jump', over: 'oil', len: 80 }, { a: 0.85, b: 0.91, s: 'sand', o: 0.5, w: 0.5 }],
      items: [{ at: 0.08, o: -0.3, k: 'boost' }, { at: 0.45, o: 0.3, k: 'shield' }, { at: 0.70, o: 0, k: 'boost' }] },
    { id: 'tablecloth', room: 'kitchen', hw: 44, pts: [[0, 0], [12, 0], [18, 1], [20, 5], [17, 8], [11, 7], [7, 8], [6, 12], [10, 15], [18, 15], [22, 18], [19, 22], [6, 22], [1, 19], [-1, 12], [-1, 5]],
      patches: [{ a: 0.10, b: 0.16, s: 'water', o: 0.4, w: 0.55, round: true }, { a: 0.38, b: 0.45, s: 'sand', o: 0, w: 0.45 }, { a: 0.62, b: 0.68, s: 'water', o: -0.4, w: 0.6, round: true }, { a: 0.86, b: 0.90, s: 'oil', o: 0.4, w: 0.4, round: true }],
      items: [{ at: 0.05, o: -0.4, k: 'shield' }, { at: 0.52, o: 0.35, k: 'boost' }, { at: 0.78, o: 0, k: 'boost' }] },
    { id: 'path', room: 'garden', hw: 44, pts: [[0, 0], [9, 0], [14, -2], [19, 0], [22, 4], [20, 8], [15, 8], [12, 11], [15, 14], [20, 14], [23, 18], [20, 22], [10, 22], [5, 19], [6, 14], [3, 10], [-1, 8], [-2, 3]],
      patches: [{ a: 0.20, b: 0.28, s: 'sand', o: -0.45, w: 0.55 }, { a: 0.575, s: 'jump', over: 'water', len: 80 }, { a: 0.74, b: 0.80, s: 'water', o: 0.45, w: 0.5, round: true }, { a: 0.90, b: 0.96, s: 'sand', o: 0.5, w: 0.5 }],
      items: [{ at: 0.10, o: 0.35, k: 'boost' }, { at: 0.40, o: -0.3, k: 'shield' }, { at: 0.66, o: 0, k: 'boost' }] },
    { id: 'vise', room: 'desk', hw: 41, pts: [[0, 0], [14, 0], [18, 2], [18, 6], [14, 7], [8, 7], [5, 9], [6, 12], [12, 12], [18, 13], [21, 16], [18, 20], [4, 20], [0, 17], [-2, 11], [-2, 4]],
      patches: [{ a: 0.08, b: 0.12, s: 'oil', o: 0.4, w: 0.45, round: true }, { a: 0.30, b: 0.36, s: 'sand', o: 0.45, w: 0.55 }, { a: 0.58, s: 'jump', over: 'oil', len: 80 }, { a: 0.80, b: 0.84, s: 'oil', o: -0.4, w: 0.45, round: true }],
      items: [{ at: 0.20, o: -0.3, k: 'shield' }, { at: 0.47, o: 0.3, k: 'boost' }, { at: 0.72, o: 0, k: 'boost' }, { at: 0.92, o: 0.3, k: 'shield' }] },
    { id: 'plane', room: 'bench', hw: 42, pts: [[0, 0], [16, 0], [24, 0], [28, 4], [28, 14], [24, 18], [20, 16], [18, 10], [14, 8], [10, 10], [8, 16], [4, 18], [0, 15], [-1, 8]],
      patches: [{ a: 0.06, s: 'jump', over: 'sand', len: 90 }, { a: 0.25, s: 'jump', over: 'oil', len: 80 }, { a: 0.35, b: 0.42, s: 'sand', o: -0.45, w: 0.55 }, { a: 0.63, b: 0.67, s: 'oil', o: 0.4, w: 0.45, round: true }, { a: 0.86, b: 0.92, s: 'sand', o: 0.45, w: 0.55 }],
      items: [{ at: 0.16, o: 0, k: 'boost' }, { at: 0.30, o: 0.3, k: 'shield' }, { at: 0.52, o: -0.3, k: 'boost' }, { at: 0.78, o: 0, k: 'boost' }] },
    { id: 'freezer', room: 'kitchen', hw: 45, pts: [[0, 0], [10, 0], [16, 3], [22, 0], [27, 2], [28, 8], [24, 11], [24, 16], [27, 20], [24, 24], [16, 24], [12, 20], [8, 24], [2, 24], [-1, 19], [2, 14], [-1, 9], [-1, 4]],
      patches: [{ a: 0.10, b: 0.22, s: 'ice', o: 0, w: 1 }, { a: 0.36, b: 0.44, s: 'ice', o: 0.3, w: 0.7 }, { a: 0.55, s: 'jump', over: 'water', len: 80 }, { a: 0.72, b: 0.80, s: 'ice', o: 0, w: 1 }, { a: 0.90, b: 0.94, s: 'oil', o: -0.4, w: 0.45, round: true }],
      items: [{ at: 0.05, o: 0.3, k: 'shield' }, { at: 0.30, o: -0.3, k: 'boost' }, { at: 0.66, o: 0.3, k: 'boost' }, { at: 0.85, o: 0, k: 'shield' }] },
    { id: 'flowerbed', room: 'garden', hw: 42, pts: [[0, 0], [12, 0], [18, -3], [25, -1], [28, 4], [25, 9], [19, 9], [16, 12], [19, 16], [27, 16], [30, 21], [27, 26], [18, 26], [13, 23], [8, 26], [2, 25], [-1, 20], [3, 15], [1, 10], [-2, 6], [-2, 2]],
      patches: [{ a: 0.08, b: 0.13, s: 'water', o: 0.4, w: 0.55, round: true }, { a: 0.26, b: 0.33, s: 'sand', o: -0.45, w: 0.55 }, { a: 0.545, s: 'jump', over: 'water', len: 80 }, { a: 0.62, b: 0.67, s: 'sand', o: 0.45, w: 0.55 }, { a: 0.74, b: 0.78, s: 'oil', o: 0, w: 0.45, round: true }, { a: 0.86, b: 0.92, s: 'water', o: -0.4, w: 0.55, round: true }],
      items: [{ at: 0.04, o: -0.3, k: 'boost' }, { at: 0.20, o: 0.3, k: 'shield' }, { at: 0.50, o: 0, k: 'boost' }, { at: 0.70, o: -0.35, k: 'shield' }, { at: 0.83, o: 0.3, k: 'boost' }] }
  ];

  // ---------- Построение трассы ----------
  function catmull(p0, p1, p2, p3, t) {
    var t2 = t * t, t3 = t2 * t;
    return [0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
            0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)];
  }
  function wrapA(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
  var cache = {};
  function buildTrack(def) {
    if (typeof def === 'number') def = TRACKS[def];
    if (cache[def.id]) return cache[def.id];
    var pts = def.pts.map(function (p) { return [p[0] * U, p[1] * U]; }), n0 = pts.length, raw = [];
    for (var i = 0; i < n0; i++) {
      var p0 = pts[(i - 1 + n0) % n0], p1 = pts[i], p2 = pts[(i + 1) % n0], p3 = pts[(i + 2) % n0];
      for (var k = 0; k < 40; k++) raw.push(catmull(p0, p1, p2, p3, k / 40));
    }
    // равномерная перевыборка с шагом DS
    var total = 0, seg = [];
    for (i = 0; i < raw.length; i++) { var a = raw[i], b = raw[(i + 1) % raw.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push(d); total += d; }
    var n = Math.round(total / DS), step = total / n, xs = [], ys = [], acc = 0, j = 0;
    for (i = 0; i < n; i++) {
      var want = i * step;
      while (acc + seg[j] < want) { acc += seg[j]; j++; }
      var f = seg[j] ? (want - acc) / seg[j] : 0, A = raw[j], B = raw[(j + 1) % raw.length];
      xs.push(A[0] + (B[0] - A[0]) * f); ys.push(A[1] + (B[1] - A[1]) * f);
    }
    // линия старта — на прямой: 40 % пути от точки 0 к точке 1 (решётка за ней тоже на прямой)
    var sx0 = pts[0][0] + (pts[1][0] - pts[0][0]) * 0.4, sy0 = pts[0][1] + (pts[1][1] - pts[0][1]) * 0.4, k0 = 0, kd = 1e18;
    for (i = 0; i < n; i++) { var dk = (xs[i] - sx0) * (xs[i] - sx0) + (ys[i] - sy0) * (ys[i] - sy0); if (dk < kd) { kd = dk; k0 = i; } }
    xs = xs.slice(k0).concat(xs.slice(0, k0)); ys = ys.slice(k0).concat(ys.slice(0, k0));
    var minX = Math.min.apply(null, xs), minY = Math.min.apply(null, ys), maxX = Math.max.apply(null, xs), maxY = Math.max.apply(null, ys);
    var ox = MARGIN - minX, oy = MARGIN - minY;
    var W = Math.ceil((maxX - minX + 2 * MARGIN) / CELL) * CELL, H = Math.ceil((maxY - minY + 2 * MARGIN) / CELL) * CELL;
    var smp = [];
    for (i = 0; i < n; i++) smp.push({ x: xs[i] + ox, y: ys[i] + oy, s: i * step });
    for (i = 0; i < n; i++) {
      var pa = smp[(i - 1 + n) % n], pb = smp[(i + 1) % n], tx = pb.x - pa.x, ty = pb.y - pa.y, tl = Math.hypot(tx, ty) || 1;
      smp[i].tx = tx / tl; smp[i].ty = ty / tl; smp[i].nx = -ty / tl; smp[i].ny = tx / tl; smp[i].ang = Math.atan2(ty, tx);
    }
    var hw = def.hw, len = total, cols = W / CELL, rows = H / CELL;
    var grid = new Uint8Array(cols * rows).fill(WALL), cellS = new Int16Array(cols * rows).fill(-1);
    // корзины выборки для быстрого поиска ближайшей точки
    var BK = 64, bc = Math.ceil(W / BK), br = Math.ceil(H / BK), buckets = [];
    for (i = 0; i < bc * br; i++) buckets.push([]);
    for (i = 0; i < n; i++) buckets[((smp[i].y / BK) | 0) * bc + ((smp[i].x / BK) | 0)].push(i);
    // трамплин с «препятствием» (over): сразу за ним покрытие во всю ширину — на скорости перелетаешь
    var patches = [];
    (def.patches || []).forEach(function (p) {
      patches.push({ a: p.a * len, b: (p.b == null ? p.a : p.b) * len, s: SNAME[p.s], o: p.o || 0, w: p.w == null ? 1 : p.w, round: !!p.round, jump: p.s === 'jump' });
      if (p.over) patches.push({ a: p.a * len + 26, b: p.a * len + 26 + p.len, s: SNAME[p.over], o: 0, w: 1, round: false, fly: true });
    });
    function along(s, a, b) { return a <= b ? (s >= a && s <= b) : (s >= a || s <= b); }
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var cx = c * CELL + CELL / 2, cy = r * CELL + CELL / 2, best = 1e9, bi = -1;
      var bx = (cx / BK) | 0, by = (cy / BK) | 0;
      for (var yy = by - 1; yy <= by + 1; yy++) for (var xx = bx - 1; xx <= bx + 1; xx++) {
        if (xx < 0 || yy < 0 || xx >= bc || yy >= br) continue;
        var L = buckets[yy * bc + xx];
        for (var q = 0; q < L.length; q++) { var sp = smp[L[q]], dd = (sp.x - cx) * (sp.x - cx) + (sp.y - cy) * (sp.y - cy); if (dd < best) { best = dd; bi = L[q]; } }
      }
      if (bi < 0 || best > (hw + DS) * (hw + DS)) continue;
      var S0 = smp[bi], lat = (cx - S0.x) * S0.nx + (cy - S0.y) * S0.ny, lon = (cx - S0.x) * S0.tx + (cy - S0.y) * S0.ty;
      if (Math.abs(lat) > hw) continue;
      var id = r * cols + c, sv = (S0.s + lon + len) % len, surf = ASPH;
      cellS[id] = bi;
      for (q = 0; q < patches.length; q++) {
        var P = patches[q];
        if (P.jump) { if (along(sv, P.a, P.a + 14)) surf = JUMP; continue; }
        if (!along(sv, P.a, P.b)) continue;
        var lo = lat / hw - P.o;
        if (P.round) {
          var mid = P.a <= P.b ? (P.a + P.b) / 2 : ((P.a + P.b + len) / 2) % len, hl = ((P.b - P.a + len) % len) / 2, ds = ((sv - mid + len * 1.5) % len) - len / 2;
          if ((ds / hl) * (ds / hl) + (lo / P.w) * (lo / P.w) <= 1) surf = P.s;
        } else if (Math.abs(lo) <= P.w) surf = P.s;
      }
      grid[id] = surf;
    }
    // клиренс (расстояние до стены, px) для клеток трассы и глубина стены (до трассы) — BFS по 8 соседям
    function dist(fromWall) {
      var D = new Float32Array(cols * rows).fill(1e9), Q = [];
      for (var i = 0; i < D.length; i++) if ((grid[i] === WALL) === fromWall) { D[i] = 0; Q.push(i); }
      for (var h = 0; h < Q.length; h++) {
        var id = Q[h], x = id % cols, y = (id / cols) | 0;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue; var nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          var ni = ny * cols + nx, nd = D[id] + (dx && dy ? 1.41 : 1) * CELL;
          if (nd < D[ni]) { D[ni] = nd; Q.push(ni); }
        }
      }
      return D;
    }
    var clear = dist(true), depth = dist(false);
    // профиль скорости по кривизне (для ботов): v ≤ sqrt(Aлат/κ), торможение назад по дуге
    var vp = new Float32Array(n), KC = 5, ALAT = 560, DEC = 300;
    for (i = 0; i < n; i++) {
      var t0 = smp[(i - KC + n) % n], t1 = smp[(i + KC) % n], kap = Math.abs(wrapA(t1.ang - t0.ang)) / (2 * KC * DS);
      var v = kap > 1e-4 ? Math.sqrt(ALAT / kap) : 999, sc = grid[Math.floor(smp[i].y / CELL) * cols + Math.floor(smp[i].x / CELL)];
      for (var fq = 0; fq < patches.length; fq++) if (patches[fq].fly && along(smp[i].s, patches[fq].a - 30, patches[fq].b)) sc = ASPH;   // перед трамплином не тормозим
      if (sc === SAND) v = Math.min(v, 100); else if (sc === ICE) v = Math.min(v, kap > 0.004 ? 95 : 150); else if (sc === WATER) v = Math.min(v, 135); else if (sc === OIL) v = Math.min(v, 120);
      vp[i] = Math.min(v, 200);
    }
    for (var pass = 0; pass < 2; pass++) for (i = n - 1; i >= 0; i--) { var nx2 = vp[(i + 1) % n], lim = Math.sqrt(nx2 * nx2 + 2 * DEC * DS); if (vp[i] > lim) vp[i] = lim; }
    var cps = []; for (i = 0; i < NCP; i++) cps.push(Math.round(i * n / NCP) % n);
    var T = { id: def.id, room: def.room, def: def, hw: hw, len: len, n: n, ds: step, smp: smp, W: W, H: H, cols: cols, rows: rows, grid: grid, cellS: cellS, clear: clear, depth: depth, vp: vp, cps: cps, patches: patches,
      items: (def.items || []).map(function (it) { var si = Math.round(it.at * n) % n, s0 = smp[si]; return { k: it.k, x: s0.x + s0.nx * it.o * hw, y: s0.y + s0.ny * it.o * hw, si: si }; }) };
    cache[def.id] = T; return T;
  }
  // кругов на трассе: короткие — 3, длинные — 2 (заезд ~40–70 с)
  function lapsFor(T) { return T.len < 3500 ? 3 : 2; }
  function cellAt(T, x, y) { var c = Math.floor(x / CELL), r = Math.floor(y / CELL); if (c < 0 || r < 0 || c >= T.cols || r >= T.rows) return -1; return r * T.cols + c; }
  function surfAt(T, x, y) { var i = cellAt(T, x, y); return i < 0 ? WALL : T.grid[i]; }
  function clearAt(T, x, y) { var i = cellAt(T, x, y); return i < 0 ? 0 : T.clear[i]; }
  // свободен ли отрезок для машинки (клиренс ≥ need по всей длине)
  function rayClear(T, x0, y0, x1, y1, need) {
    var d = Math.hypot(x1 - x0, y1 - y0), k = Math.max(1, Math.ceil(d / 4));
    for (var i = 1; i <= k; i++) { var f = i / k; if (clearAt(T, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f) < need) return false; }
    return true;
  }
  // ближайшая точка осевой в окне вокруг si (непрерывное отслеживание — сквозь стены не «перескакивает»)
  function track(T, x, y, si, win) {
    var best = 1e18, bi = si, n = T.n;
    for (var k = -win; k <= win; k++) { var j = (si + k + n) % n, p = T.smp[j], d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y); if (d < best) { best = d; bi = j; } }
    return bi;
  }

  // ---------- ИИ водителя: аналоговые {steer,gas,brake}. prof: pace, care, lane, look ----------
  var SPEN = []; SPEN[ASPH] = 0; SPEN[JUMP] = -0.2; SPEN[SAND] = 1.6; SPEN[ICE] = 0.8; SPEN[WATER] = 1.1; SPEN[OIL] = 2.4; SPEN[WALL] = 99;
  function drive(S, car, prof, mem) {
    var T = S.track, n = T.n, spd = Math.hypot(car.vx, car.vy), out = { steer: 0, gas: 0, brake: 0, drift: 0 };
    mem = mem || car.mem || (car.mem = {});
    var need = CAR.r + 7;
    // цель: самая дальняя достижимая по прямой точка впереди, с выбором полосы (покрытия, бонусы, «своя» полоса)
    var la = (40 + spd * 0.34) * (prof.look || 1), tgt = null;
    var lanes = [prof.lane || 0, 0, -0.45, 0.45, -0.7, 0.7];
    for (var f = 1; f >= 0.3 && !tgt; f -= 0.175) {
      var j = (car.si + Math.max(3, Math.round(la * f / T.ds))) % n, s0 = T.smp[j], bestSc = 1e9;
      // поворот впереди: внутренняя сторона выгоднее
      var turn = wrapA(T.smp[(j + 12) % n].ang - s0.ang), inner = turn > 0.08 ? 0.35 : turn < -0.08 ? -0.35 : 0;
      for (var q = 0; q < lanes.length; q++) {
        var o = lanes[q] * T.hw, px = s0.x + s0.nx * o, py = s0.y + s0.ny * o;
        if (clearAt(T, px, py) < need || !rayClear(T, car.x, car.y, px, py, need - 3)) continue;
        var sf = surfAt(T, px, py), sm = surfAt(T, (car.x + px) / 2, (car.y + py) / 2);
        var sc = (SPEN[sf] + SPEN[sm] * 0.6) * (prof.care == null ? 1 : prof.care) * 2 + Math.abs(lanes[q] - (prof.lane || 0) - inner) * 0.6;
        for (var ii = 0; ii < S.items.length; ii++) { var it = S.items[ii]; if (it.t <= 0 && Math.hypot(it.x - px, it.y - py) < 26) sc -= 0.5; }
        if (sc < bestSc) { bestSc = sc; tgt = { x: px, y: py }; }
      }
    }
    if (!tgt) { var s1 = T.smp[(car.si + 4) % n]; tgt = { x: s1.x, y: s1.y }; }
    var want = Math.atan2(tgt.y - car.y, tgt.x - car.x), diff = wrapA(want - car.a);
    out.steer = Math.max(-1, Math.min(1, diff * 2.4));
    // скорость: профиль трассы чуть впереди × темп
    var ahead = 0, vt = 1e9;
    for (var k = 0; k <= 10; k++) { var vv = T.vp[(car.si + k * 2) % n]; if (vv < vt) vt = vv; }
    vt = vt * (prof.pace || 1) * (prof.own ? 1 : (S.diff || 1));   // own — свой темп (игрок/автопилот), без сложности трассы
    var sNow = car.air > 0 ? ASPH : surfAt(T, car.x, car.y);
    if (sNow === ICE || sNow === OIL) vt = Math.min(vt, 125);
    if (Math.abs(diff) > 1.2) vt = Math.min(vt, 70);
    if (spd < vt - 4) out.gas = 1; else if (spd > vt + 14) out.brake = 1;
    // застрял (упёрся) — сдать назад, вывернув руль
    var fwd = car.vx * Math.cos(car.a) + car.vy * Math.sin(car.a);
    if (mem.rev > 0) { mem.rev -= STEP * 3; out.gas = 0; out.brake = 1; out.steer = -mem.rs; return out; }
    if (out.gas && fwd < 12) { mem.stk = (mem.stk || 0) + STEP * 3; if (mem.stk > 0.8) { mem.stk = 0; mem.rev = 0.6; mem.rs = diff > 0 ? 1 : -1; } } else mem.stk = 0;
    if (Math.abs(diff) > 2.2 && spd < 30) { out.steer = diff > 0 ? 1 : -1; }
    return out;
  }

  var AUTO = { pace: 0.7, care: 1, lane: 0, own: true };   // автопилот финишировавшего игрока

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, emit = opts.onEvent || function () {};
    var nHum = opts.players == null ? 1 : opts.players, elim = opts.elim !== false;
    var nBots = opts.bots == null ? BOTS.length : opts.bots, ntracks = opts.tracks || TRACKS.length;
    var S = {
      ti: opts.track || 0, ntracks: ntracks, laps: LAPS, phase: 'count', phaseT: 0, time: 0, raceT: 0, nplayers: nHum,
      track: null, cars: [], items: [], cam: { x: 0, y: 0 }, view: { w: VIEW.w, h: VIEW.h }, results: null, standings: null,
      champ: {}, wins: {}, finishN: 0, outN: 0, score: 0, pickups: 0, over: false, won: false, place: 0, diff: 1, leader: null, endT: 0
    };
    var cars = [];
    function mkCars() {
      cars = [];
      for (var i = 0; i < nHum; i++) cars.push({ id: HUMANS[i].id, human: true, pi: i, color: HUMANS[i].color });
      for (i = 0; i < nBots; i++) cars.push({ id: BOTS[i].id, human: false, prof: BOTS[i], color: BOTS[i].color });
      cars.forEach(function (c) { S.champ[c.id] = 0; S.wins[c.id] = 0; });
      S.cars = cars;
    }
    function loadTrack(ti) {
      var T = S.track = buildTrack(ti); S.ti = ti; S.diff = DIFF[Math.min(ti, DIFF.length - 1)];
      S.laps = opts.laps || lapsFor(T);
      S.phase = 'count'; S.phaseT = 0; S.raceT = 0; S.results = null; S.finishN = 0; S.outN = 0; S.endT = 0;
      S.items = T.items.map(function (it) { return { k: it.k, x: it.x, y: it.y, t: 0 }; });
      // стартовая решётка 2×2 за линией старта (порядок по очкам чемпионата: лидер — сзади)
      var order = cars.slice().sort(function (a, b) { return S.champ[a.id] - S.champ[b.id]; });
      order.forEach(function (c, k) {
        var row = (k / 2) | 0, side = k % 2 ? 1 : -1, si = (T.n - 4 - row * 5) % T.n, p = T.smp[si];
        Object.assign(c, { x: p.x + p.nx * side * T.hw * 0.42, y: p.y + p.ny * side * T.hw * 0.42, vx: 0, vy: 0, a: p.ang, si: si, s: p.s,
          next: 0, lap: 0, cp: 0, prog: 0, finished: false, out: false, offT: 0, place: 0, air: 0, airT: 0, z: 0, boost: 0, shield: 0,
          surf: ASPH, inp: { steer: 0, gas: 0, brake: 0, drift: 0 }, mem: {}, slip: 0, rank: 0, hitT: 0 });
      });
      var L0 = T.smp[0]; S.cam.x = L0.x; S.cam.y = L0.y; clampCam();
      emit('track', { ti: ti, id: T.id });
    }
    function clampCam() {
      var T = S.track, hw = S.view.w / 2, hh = S.view.h / 2;
      S.cam.x = Math.max(hw, Math.min(T.W - hw, S.cam.x)); S.cam.y = Math.max(hh, Math.min(T.H - hh, S.cam.y));
    }

    // --- физика одной машинки ---
    function physics(c, dt) {
      var T = S.track, inp = c.inp;
      if (c.boost > 0) c.boost -= dt; if (c.shield > 0) c.shield -= dt; if (c.hitT > 0) c.hitT -= dt;
      var fx = Math.cos(c.a), fy = Math.sin(c.a), vf = c.vx * fx + c.vy * fy;
      if (c.air > 0) {
        c.air -= dt; c.z = Math.sin(Math.PI * Math.max(0, c.air) / c.airT);
        c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= 0.999; c.vy *= 0.999;
        walls(c);
        if (c.air <= 0) { c.air = 0; c.z = 0; emit('land', { id: c.id }); }
        return;
      }
      var sf = surfAt(T, c.x, c.y); if (sf === WALL) sf = ASPH;
      if (sf === JUMP && vf > CAR.jumpV) { c.airT = c.air = 0.28 + vf / 520; c.surf = JUMP; emit('jump', { id: c.id, v: vf }); return; }
      if (c.shield > 0 && (sf === OIL || sf === WATER)) sf = ASPH;
      c.surf = sf;
      var P = SURF[sf], spd = Math.abs(vf);
      var drifting = inp.drift && spd > 80;
      // руль: скорость поворота растёт со скоростью, задним ходом — наоборот
      var turn = inp.steer * CAR.turn * Math.min(1, spd / CAR.turnV) * (vf >= 0 ? 1 : -1) * (drifting ? 1.35 : 1);
      c.a = wrapA(c.a + turn * dt);
      fx = Math.cos(c.a); fy = Math.sin(c.a);
      vf = c.vx * fx + c.vy * fy; var vl = -c.vx * fy + c.vy * fx;
      var acc = 0, boost = c.boost > 0 ? CAR.boostAcc : 1;
      if (inp.gas) acc += CAR.acc * P.acc * boost;
      if (inp.brake) { if (vf > 5) acc -= CAR.brake * (0.5 + 0.5 * P.acc); else if (vf > -CAR.rev) acc -= CAR.acc * 0.55; }
      if (c.boost > 0 && !inp.brake) acc = Math.max(acc, CAR.acc * 0.6 * boost);
      vf += acc * dt;
      vf -= vf * CAR.k * P.drag * (inp.gas || inp.brake ? 1 : 0.3) * dt;   // без педалей — накат по инерции
      vl *= Math.exp(-P.grip * (drifting ? 0.3 : 1) * dt);
      c.slip = Math.abs(vl);
      c.vx = fx * vf - fy * vl; c.vy = fy * vf + fx * vl;
      c.x += c.vx * dt; c.y += c.vy * dt;
      walls(c);
    }
    function walls(c) {
      var T = S.track, r = CAR.r, x0 = Math.floor((c.x - r) / CELL), x1 = Math.floor((c.x + r) / CELL), y0 = Math.floor((c.y - r) / CELL), y1 = Math.floor((c.y + r) / CELL), hit = 0;
      for (var it = 0; it < 2; it++) for (var gy = y0; gy <= y1; gy++) for (var gx = x0; gx <= x1; gx++) {
        var solid = gx < 0 || gy < 0 || gx >= T.cols || gy >= T.rows || T.grid[gy * T.cols + gx] === WALL;
        if (!solid) continue;
        var nx = Math.max(gx * CELL, Math.min(c.x, gx * CELL + CELL)), ny = Math.max(gy * CELL, Math.min(c.y, gy * CELL + CELL));
        var dx = c.x - nx, dy = c.y - ny, d = Math.hypot(dx, dy);
        if (d >= r) continue;
        if (d < 1e-6) { // центр внутри стены — выталкиваем к ближайшей точке осевой
          var p = T.smp[c.si]; dx = p.x - c.x; dy = p.y - c.y; d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d; c.x += dx * 2; c.y += dy * 2; continue;
        }
        dx /= d; dy /= d; c.x += dx * (r - d); c.y += dy * (r - d);
        var vn = c.vx * dx + c.vy * dy;
        if (vn < 0) { c.vx -= 1.3 * vn * dx; c.vy -= 1.3 * vn * dy; hit = Math.max(hit, -vn); }
      }
      if (hit > 0) { var fr = c.shield > 0 ? 0.97 : 0.9; c.vx *= fr; c.vy *= fr; if (hit > 50 && c.hitT <= 0) { c.hitT = 0.25; emit('wall', { id: c.id, f: hit }); } }
    }
    function bumps() {
      var r2 = CAR.r * 2;
      for (var i = 0; i < cars.length; i++) for (var j = i + 1; j < cars.length; j++) {
        var a = cars[i], b = cars[j];
        if (a.out || b.out || a.air > 0 || b.air > 0) continue;
        var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d >= r2 || d < 1e-6) continue;
        dx /= d; dy /= d;
        var ma = a.shield > 0 ? 4 : 1, mb = b.shield > 0 ? 4 : 1, sum = ma + mb, ov = r2 - d;
        a.x -= dx * ov * mb / sum; a.y -= dy * ov * mb / sum; b.x += dx * ov * ma / sum; b.y += dy * ov * ma / sum;
        var rv = (b.vx - a.vx) * dx + (b.vy - a.vy) * dy;
        if (rv < 0) {
          var jimp = -(1 + 0.55) * rv / (1 / ma + 1 / mb);
          a.vx -= jimp / ma * dx; a.vy -= jimp / ma * dy; b.vx += jimp / mb * dx; b.vy += jimp / mb * dy;
          if (-rv > 40) emit('bump', { a: a.id, b: b.id, f: -rv });
        }
        walls(a); walls(b);
      }
    }
    // --- бонусы ---
    function items(dt) {
      for (var i = 0; i < S.items.length; i++) {
        var it = S.items[i];
        if (it.t > 0) { it.t -= dt; continue; }
        for (var k = 0; k < cars.length; k++) {
          var c = cars[k]; if (c.out || c.air > 0) continue;
          if (Math.hypot(c.x - it.x, c.y - it.y) < ITEM_R + CAR.r) {
            it.t = ITEM_RESPAWN;
            if (it.k === 'boost') { c.boost = CAR.boostT; var sp = Math.hypot(c.vx, c.vy); if (sp < 200) { var add = 40; c.vx += Math.cos(c.a) * add; c.vy += Math.sin(c.a) * add; } }
            else c.shield = CAR.shieldT;
            if (c.human) { S.pickups++; }
            emit('pickup', { id: c.id, k: it.k, x: it.x, y: it.y, human: c.human });
            break;
          }
        }
      }
    }
    // --- круги/чекпоинты/прогресс ---
    function progress(c) {
      var T = S.track, n = T.n;
      c.si = track(T, c.x, c.y, c.si, 10); c.s = T.smp[c.si].s;
      if (c.finished || c.out) return;
      var cpS = T.smp[T.cps[c.next]].s, off = (c.s - cpS + T.len) % T.len;
      if (off < CP_WIN) {
        c.cp++;
        if (c.next === 0) {
          if (c.lap >= S.laps) { c.finished = true; c.place = ++S.finishN; c.finT = S.raceT; emit('finish', { id: c.id, place: c.place, human: c.human }); }
          else { c.lap++; if (c.lap > 1) emit('lap', { id: c.id, lap: c.lap, human: c.human }); }
        }
        c.next = (c.next + 1) % NCP;
      }
      var prev = T.cps[(c.next - 1 + NCP) % NCP], segLen = T.len / NCP, raw = (c.s - T.smp[prev].s + T.len) % T.len;
      var frac = raw > segLen * 1.5 ? 0 : Math.min(0.999, raw / segLen);
      c.prog = c.cp + frac;
    }
    function ranking() {
      var list = cars.slice().sort(function (a, b) {
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        if (a.finished) return a.place - b.place;
        if (a.out !== b.out) return a.out ? 1 : -1;
        if (a.out) return b.outN - a.outN;
        return b.prog - a.prog;
      });
      list.forEach(function (c, k) { c.rank = k + 1; });
      return list;
    }
    function camera(dt, list) {
      var lead = null;
      for (var i = 0; i < list.length; i++) if (!list[i].out) { lead = list[i]; break; }
      if (!lead) return;
      S.leader = lead.id;
      var tx = lead.x + lead.vx * 0.3, ty = lead.y + lead.vy * 0.3, k = 1 - Math.exp(-4.5 * dt);
      S.cam.x += (tx - S.cam.x) * k; S.cam.y += (ty - S.cam.y) * k;
      clampCam();
    }
    function outside(c) {
      var m = 2;
      return c.x < S.cam.x - S.view.w / 2 - m || c.x > S.cam.x + S.view.w / 2 + m || c.y < S.cam.y - S.view.h / 2 - m || c.y > S.cam.y + S.view.h / 2 + m;
    }
    function eliminate(dt) {
      if (!elim) return;
      var active = cars.filter(function (c) { return !c.out && !c.finished; });
      for (var i = 0; i < cars.length; i++) {
        var c = cars[i]; if (c.out || c.finished) continue;
        if (outside(c)) { c.offT += dt; if (c.offT >= OUT_T && active.length + S.finishN > 1) { c.out = true; c.outN = ++S.outN; c.vx = c.vy = 0; emit('out', { id: c.id, human: c.human }); } }
        else c.offT = Math.max(0, c.offT - dt * 2);
      }
    }
    function raceOver() {
      var hum = cars.filter(function (c) { return c.human; }), act = cars.filter(function (c) { return !c.out && !c.finished; });
      if (!act.length) return true;
      if (hum.length && hum.every(function (c) { return c.out || c.finished; })) return true;
      if (S.finishN === 0 && act.length === 1 && S.outN === cars.length - 1) return true;   // остался один — он и победил
      if (S.finishN > 0 && S.raceT - firstFin > 12) return true;                          // 12 с после первого финиша
      return S.raceT > 300;
    }
    var firstFin = 0;
    function endRace() {
      var list = ranking();
      S.results = list.map(function (c, k) { var pts = PTS[k] || 0; S.champ[c.id] += pts; if (k === 0) S.wins[c.id]++; return { id: c.id, place: k + 1, pts: pts, human: c.human, out: c.out, finished: c.finished }; });
      S.standings = standings();
      S.score = score();
      S.phase = 'results'; S.phaseT = 0;
      emit('raceEnd', { ti: S.ti, results: S.results });
    }
    function standings() {
      return cars.map(function (c) { return { id: c.id, pts: S.champ[c.id], wins: S.wins[c.id], human: c.human, last: S.results ? (S.results.filter(function (r) { return r.id === c.id; })[0] || {}).place || 9 : 9 }; })
        .sort(function (a, b) { return b.pts - a.pts || b.wins - a.wins || a.last - b.last; })
        .map(function (r, k) { r.place = k + 1; return r; });
    }
    function score() {
      var best = 0; cars.forEach(function (c) { if (c.human) best = Math.max(best, S.champ[c.id]); });
      return best * 100 + S.pickups * 10;
    }

    var acc = 0;
    function tick(dt) {
      S.time += dt; S.phaseT += dt;
      if (S.phase === 'results') return;
      if (S.phase === 'count') {
        var before = Math.ceil(2.4 - (S.phaseT - dt)), now = Math.ceil(2.4 - S.phaseT);
        if (now !== before && now > 0) emit('count', { n: now });
        if (S.phaseT >= 2.4) { S.phase = 'race'; S.phaseT = 0; emit('go', {}); }
        camera(dt, ranking());
        return;
      }
      if (S.phase === 'end') { S.raceT += dt; drives(dt); if (S.phaseT > 1.6) endRace(); return; }
      S.raceT += dt;
      drives(dt);
      items(dt);
      var list = ranking();
      camera(dt, list);
      if (S.raceT > 1.5) eliminate(dt);
      if (S.finishN > 0 && !firstFin) firstFin = S.raceT;
      if (raceOver()) { S.phase = 'end'; S.phaseT = 0; ranking(); emit('raceOver', {}); }
    }
    function drives(dt) {
      for (var i = 0; i < cars.length; i++) {
        var c = cars[i]; if (c.out) continue;
        // боты решают 20 раз в секунду (между решениями держат руль/педали)
        var auto = !c.human ? c.prof : (c.finished || S.phase === 'end') ? AUTO : null;
        if (auto && (c.mem.cd = (c.mem.cd || 0) - 1) <= 0) { c.mem.cd = 3; c.inp = drive(S, c, auto, c.mem); }
        physics(c, dt);
      }
      bumps();
      for (i = 0; i < cars.length; i++) progress(cars[i]);
    }

    var api = {
      start: function () { mkCars(); firstFin = 0; loadTrack(S.ti); return api; },
      update: function (dt) { acc += Math.min(dt, 0.1); while (acc >= STEP - 1e-9) { acc -= STEP; tick(STEP); } },
      setInput: function (pi, inp) { for (var i = 0; i < cars.length; i++) if (cars[i].human && cars[i].pi === pi) { var c = cars[i]; if (S.phase === 'race' && !c.finished) c.inp = { steer: inp.steer || 0, gas: inp.gas ? 1 : 0, brake: inp.brake ? 1 : 0, drift: inp.drift ? 1 : 0 }; else if (S.phase === 'count') c.inp = { steer: 0, gas: 0, brake: 0, drift: 0 }; } },
      // из итогов заезда → следующая трасса или финал чемпионата
      next: function () {
        if (S.phase !== 'results' || S.over) return false;
        if (S.ti + 1 < S.ntracks) { firstFin = 0; loadTrack(S.ti + 1); return true; }
        S.over = true; var st = S.standings, place = 9;
        st.forEach(function (r) { if (r.human) place = Math.min(place, r.place); });
        S.place = place; S.won = place === 1; S.score = score();
        emit(S.won ? 'win' : 'gameover', { place: place, score: S.score });
        return true;
      },
      state: function () { return S; },
      car: function (id) { for (var i = 0; i < cars.length; i++) if (cars[i].id === id) return cars[i]; return null; },
      ranking: ranking, _S: S, _tick: tick, _physics: physics, _progress: progress
    };
    return api;
  }

  Y.logic = {
    U: U, CELL: CELL, DS: DS, NCP: NCP, CP_WIN: CP_WIN, LAPS: LAPS, STEP: STEP, VIEW: VIEW, OUT_T: OUT_T, PTS: PTS, CAR: CAR, SURF: SURF, DIFF: DIFF,
    ASPH: ASPH, WALL: WALL, SAND: SAND, ICE: ICE, WATER: WATER, OIL: OIL, JUMP: JUMP, BIND: BIND, BOTS: BOTS, HUMANS: HUMANS, TRACKS: TRACKS, ITEM_R: ITEM_R,
    buildTrack: buildTrack, lapsFor: lapsFor, surfAt: surfAt, clearAt: clearAt, rayClear: rayClear, drive: drive, wrapA: wrapA
  };
  Y.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
