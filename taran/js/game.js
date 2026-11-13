/* ТАРАН · логика без DOM (детерминирована при заданном rng). TARAN.Game(opts), TARAN.logic, TARAN.champ
   Боевые гонки паровых самоходов с видом сверху: кольцевые трассы Кубка Заводских Дворов (цеха, крыши, рельсы, склады),
   оружие спереди (заклёпочник, ракеты-самоходки) и сзади (масло, мины-гайки), таран-бампер, нитро-котёл.
   Трасса — замкнутая осевая линия (сплайн по опорным точкам, выборка через DS px) с полушириной hw(s); препятствия
   трассы (развилки-острова, трамплины со шлаковой канавой, лужи масла, рельсы с вагонетками, прессы, ремонтные боксы)
   расставляются по «рецепту» трассы детерминированно — только на подходящих (прямых) участках.
   Общий экран на двоих: камера ведёт лидирующего игрока, отставший за краем кадра дольше CUT_T снимается с заезда. */
(function (global) {
  'use strict';
  var T = global.TARAN = global.TARAN || {};

  // ---------- Константы ----------
  var W = 640, H = 480, HUD = 34, VIEW = { w: 640, h: H - HUD };
  var U = 64, DS = 8, MARGIN = 300, LAPS = 3, CAR_R = 11, COUNT_T = 3, CUT_T = 2.0, END_T = 2.6, RACE_MAX = 420;
  var RIVETS = 12, FORK_EXTRA = 44, ISLAND_W = 30, TRENCH = [34, 124], RAMP = 22, JUMP_MIN = 120;
  // Корпуса: hp — броня, v — скорость, acc — разгон, turn — поворот (рад/с), mass — масса, ram — сила тарана
  var BODIES = [
    { id: 'ladle', hp: 60, v: 250, acc: 300, turn: 3.4, mass: 1.0, ram: 1.0, price: 0 },
    { id: 'steamer', hp: 82, v: 266, acc: 320, turn: 3.3, mass: 1.3, ram: 1.35, price: 3600 },
    { id: 'hammer', hp: 110, v: 280, acc: 330, turn: 3.15, mass: 1.7, ram: 1.8, price: 8200 }
  ];
  var UPG = ['armor', 'tires', 'engine', 'weapon'], TIERS = 5;
  var UPG_PRICE = { armor: 320, tires: 260, engine: 420, weapon: 360 };
  var START_MONEY = 600, PRIZE = [1500, 1000, 700, 450, 300, 200], POINTS = [10, 6, 4, 3, 2, 1];
  var LEAGUE_MULT = [1, 1.6, 2.3, 3.1], KILL_BONUS = 150, CHAMP_BONUS = 10000, MAX_TRIES = 2, LEAGUES = 4, RACES = 4;
  // Соперники с характерами: pace — темп, aggr — стрельба, ramp — тяга к тарану, drop — сброс назад, lane — любимая полоса,
  // side — сторона на развилке, boost — любовь к нитро, rear — что сбрасывает
  var RIVALS = [
    { id: 'conrod', color: '#c8483a', pace: 1.0, aggr: 0.35, ramp: 1.0, drop: 0.3, lane: -0.25, side: -1, boost: 0.6, rear: 'mine', up: { armor: 1 } },
    { id: 'whistle', color: '#e2dccb', pace: 1.04, aggr: 0.15, ramp: 0.0, drop: 0.2, lane: 0.3, side: 1, boost: 1.0, rear: 'oil', up: { engine: 1 } },
    { id: 'soot', color: '#6c9a4a', pace: 0.98, aggr: 1.0, ramp: 0.2, drop: 0.2, lane: 0.0, side: 1, boost: 0.4, rear: 'mine', up: { weapon: 1 } },
    { id: 'latch', color: '#8a5ab8', pace: 0.99, aggr: 0.4, ramp: 0.3, drop: 1.0, lane: 0.15, side: -1, boost: 0.5, rear: 'oil', up: { tires: 1 } }
  ];
  var HUMANS = [{ id: 'p1', color: '#e8a33a' }, { id: 'p2', color: '#4fb3c9' }];
  var PACE = [0.86, 0.93, 0.97, 1.0];
  var SETTINGS = ['shop', 'roof', 'rail', 'store'];
  // Трассы: 4 лиги × 4 трассы; точки в единицах U (по часовой; старт — на отрезке 0→1). r — «рецепт» препятствий.
  var TRACKS = [
    { id: 'foundry', set: 'shop', hw: 58, pts: [[0, 0], [14, 0], [19, 2], [20, 7], [16, 10], [11, 9], [7, 11], [1, 11], [-3, 8], [-3, 3]], r: { fork: 1, jump: 0, oil: 2, pit: 1, rail: 0, press: 1 } },
    { id: 'tiles', set: 'roof', hw: 58, pts: [[0, 0], [12, 0], [17, -2], [22, 0], [23, 5], [19, 8], [19, 13], [15, 15], [5, 15], [1, 12], [3, 8], [-1, 5], [-2, 2]], r: { fork: 1, jump: 1, oil: 2, pit: 1, rail: 0, press: 0 } },
    { id: 'switch', set: 'rail', hw: 56, pts: [[0, 0], [16, 0], [21, 3], [21, 8], [16, 9], [12, 12], [13, 16], [9, 19], [2, 18], [-2, 14], [0, 9], [-3, 5]], r: { fork: 0, jump: 1, oil: 1, pit: 1, rail: 1, press: 0 } },
    { id: 'bales', set: 'store', hw: 56, pts: [[0, 0], [10, 0], [14, 3], [18, 0], [23, 1], [24, 6], [20, 9], [22, 13], [19, 17], [9, 17], [4, 14], [6, 9], [0, 8], [-3, 4]], r: { fork: 1, jump: 1, oil: 2, pit: 1, rail: 0, press: 0 } },
    { id: 'assembly', set: 'shop', hw: 54, pts: [[0, 0], [18, 0], [23, 3], [22, 8], [16, 9], [14, 13], [18, 16], [16, 20], [6, 20], [2, 17], [5, 12], [0, 9], [-3, 5]], r: { fork: 1, jump: 1, oil: 2, pit: 1, rail: 1, press: 1 } },
    { id: 'chimneys', set: 'roof', hw: 54, pts: [[0, 0], [8, 0], [12, -3], [17, -3], [21, 0], [26, 0], [28, 5], [25, 9], [25, 15], [20, 18], [14, 15], [9, 18], [3, 17], [-1, 13], [2, 8], [-2, 4]], r: { fork: 1, jump: 2, oil: 2, pit: 1, rail: 0, press: 1 } },
    { id: 'sorting', set: 'rail', hw: 54, pts: [[0, 0], [20, 0], [25, 3], [25, 8], [20, 10], [10, 10], [7, 13], [10, 16], [24, 16], [27, 19], [24, 23], [2, 23], [-2, 19], [-2, 4]], r: { fork: 1, jump: 1, oil: 1, pit: 1, rail: 2, press: 0 } },
    { id: 'barrels', set: 'store', hw: 54, pts: [[0, 0], [12, 0], [15, 4], [19, 0], [25, 0], [27, 5], [23, 9], [26, 13], [24, 18], [16, 17], [12, 20], [5, 19], [1, 15], [3, 10], [-1, 6], [-2, 2]], r: { fork: 2, jump: 1, oil: 2, pit: 1, rail: 0, press: 1 } },
    { id: 'rolling', set: 'shop', hw: 52, pts: [[0, 0], [22, 0], [27, 3], [26, 9], [21, 10], [17, 7], [12, 8], [10, 13], [14, 17], [24, 17], [27, 21], [22, 25], [4, 25], [0, 21], [2, 15], [-2, 10], [-3, 4]], r: { fork: 1, jump: 1, oil: 2, pit: 1, rail: 1, press: 2 } },
    { id: 'gutter', set: 'roof', hw: 52, pts: [[0, 0], [10, 0], [14, 4], [20, 4], [24, 0], [29, 1], [30, 7], [25, 10], [26, 16], [22, 20], [15, 18], [10, 21], [3, 20], [0, 16], [3, 11], [-2, 7], [-2, 2]], r: { fork: 1, jump: 2, oil: 3, pit: 1, rail: 1, press: 1 } },
    { id: 'depot', set: 'rail', hw: 52, pts: [[0, 0], [24, 0], [29, 3], [29, 9], [25, 11], [18, 11], [15, 14], [18, 18], [26, 18], [29, 22], [25, 26], [8, 26], [3, 23], [6, 18], [3, 13], [-2, 10], [-3, 4]], r: { fork: 1, jump: 1, oil: 2, pit: 1, rail: 2, press: 1 } },
    { id: 'crates', set: 'store', hw: 52, pts: [[0, 0], [9, 0], [12, 3], [16, 0], [22, 0], [25, 4], [22, 8], [26, 11], [26, 17], [21, 20], [17, 17], [13, 20], [8, 20], [4, 16], [6, 11], [1, 9], [-2, 5]], r: { fork: 2, jump: 1, oil: 2, pit: 1, rail: 1, press: 1 } },
    { id: 'boiler', set: 'shop', hw: 50, pts: [[0, 0], [20, 0], [26, 2], [28, 8], [24, 12], [18, 10], [14, 12], [15, 17], [21, 19], [27, 19], [29, 24], [24, 27], [8, 27], [3, 24], [5, 18], [0, 14], [-3, 8], [-2, 3]], r: { fork: 1, jump: 2, oil: 2, pit: 1, rail: 1, press: 2 } },
    { id: 'ridge', set: 'roof', hw: 50, pts: [[0, 0], [12, 0], [17, 3], [22, 0], [28, 0], [31, 5], [28, 10], [22, 11], [20, 15], [25, 18], [28, 23], [23, 27], [12, 26], [8, 22], [3, 24], [-1, 20], [1, 14], [-3, 9], [-3, 3]], r: { fork: 2, jump: 2, oil: 3, pit: 1, rail: 1, press: 1 } },
    { id: 'hump', set: 'rail', hw: 50, pts: [[0, 0], [26, 0], [31, 4], [29, 10], [23, 11], [19, 14], [22, 19], [29, 20], [31, 25], [26, 29], [14, 28], [10, 24], [5, 27], [0, 24], [1, 17], [-3, 12], [-3, 4]], r: { fork: 1, jump: 2, oil: 2, pit: 1, rail: 3, press: 1 } },
    { id: 'shed', set: 'store', hw: 50, pts: [[0, 0], [14, 0], [18, 4], [24, 4], [28, 0], [33, 2], [33, 8], [28, 11], [30, 16], [27, 21], [20, 21], [16, 25], [8, 25], [3, 21], [6, 15], [1, 12], [-3, 8], [-3, 3]], r: { fork: 2, jump: 2, oil: 3, pit: 1, rail: 2, press: 2 } }
  ];

  // Раскладка: И1 — стрелки + / . , ПравыйShift (и цифр. блок 0–3); И2 — WASD + F G R ЛевыйShift/Q.
  // P, Esc, M, L, T, Enter — горячие клавиши движка; Space допустим у И1 как «огонь».
  var BIND = {
    p1: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
      fire: ['Slash', 'Numpad0', 'Space'], rocket: ['Period', 'NumpadDecimal'], drop: ['Comma', 'Numpad3'], nitro: ['ShiftRight', 'NumpadAdd'] },
    p2: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
      fire: ['KeyF'], rocket: ['KeyG'], drop: ['KeyR'], nitro: ['ShiftLeft', 'KeyQ'] }
  };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function wrapA(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
  function hyp(x, y) { return Math.sqrt(x * x + y * y); }

  // ---------- Построение трассы ----------
  function catmull(p0, p1, p2, p3, t) {
    var t2 = t * t, t3 = t2 * t;
    return [0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
      0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)];
  }
  function resample(raw, dstep) {
    var total = 0, seg = [], i, m = raw.length;
    for (i = 0; i < m; i++) { var a = raw[i], b = raw[(i + 1) % m], d = hyp(b[0] - a[0], b[1] - a[1]); seg.push(d); total += d; }
    var n = Math.round(total / dstep), step = total / n, xs = [], ys = [], acc = 0, j = 0;
    for (i = 0; i < n; i++) {
      var want = i * step;
      while (acc + seg[j] < want && j < m - 1) { acc += seg[j]; j++; }
      var f = seg[j] ? (want - acc) / seg[j] : 0, A = raw[j], B = raw[(j + 1) % m];
      xs.push(A[0] + (B[0] - A[0]) * f); ys.push(A[1] + (B[1] - A[1]) * f);
    }
    return { n: n, step: step, xs: xs, ys: ys, total: total };
  }
  var cache = {};
  function buildTrack(ix) {
    var def = typeof ix === 'number' ? TRACKS[ix] : ix;
    if (cache[def.id]) return cache[def.id];
    var pts = def.pts.map(function (p) { return [p[0] * U, p[1] * U]; }), n0 = pts.length, raw = [], i, k;
    for (i = 0; i < n0; i++) {
      var p0 = pts[(i - 1 + n0) % n0], p1 = pts[i], p2 = pts[(i + 1) % n0], p3 = pts[(i + 2) % n0];
      for (k = 0; k < 40; k++) raw.push(catmull(p0, p1, p2, p3, k / 40));
    }
    var total = 0;
    // сглаживание (скругляет острые углы: радиус поворота не меньше полуширины дороги), затем равномерная перевыборка
    for (var pass = 0; pass < 6; pass++) {
      var m = raw.length, sm2 = [];
      for (i = 0; i < m; i++) { var sx = 0, sy = 0; for (k = -12; k <= 12; k++) { var rp = raw[(i + k + m) % m]; sx += rp[0]; sy += rp[1]; } sm2.push([sx / 25, sy / 25]); }
      raw = sm2;
    }
    var rs = resample(raw, DS), n = rs.n, step = rs.step, xs = rs.xs, ys = rs.ys; total = rs.total;
    // линия старта — на 45 % первого отрезка (стартовая решётка позади тоже на прямой)
    var sx0 = pts[0][0] + (pts[1][0] - pts[0][0]) * 0.45, sy0 = pts[0][1] + (pts[1][1] - pts[0][1]) * 0.45, k0 = 0, kd = 1e18;
    for (i = 0; i < n; i++) { var dk = (xs[i] - sx0) * (xs[i] - sx0) + (ys[i] - sy0) * (ys[i] - sy0); if (dk < kd) { kd = dk; k0 = i; } }
    xs = xs.slice(k0).concat(xs.slice(0, k0)); ys = ys.slice(k0).concat(ys.slice(0, k0));
    var minX = Math.min.apply(null, xs), minY = Math.min.apply(null, ys), maxX = Math.max.apply(null, xs), maxY = Math.max.apply(null, ys);
    var ox = MARGIN - minX, oy = MARGIN - minY, smp = [];
    for (i = 0; i < n; i++) smp.push({ x: xs[i] + ox, y: ys[i] + oy, s: i * step, hw: def.hw, isl: 0 });
    for (i = 0; i < n; i++) {
      var pa = smp[(i - 1 + n) % n], pb = smp[(i + 1) % n], tx = pb.x - pa.x, ty = pb.y - pa.y, tl = hyp(tx, ty) || 1;
      smp[i].tx = tx / tl; smp[i].ty = ty / tl; smp[i].nx = -ty / tl; smp[i].ny = tx / tl; smp[i].ang = Math.atan2(ty, tx);
    }
    for (i = 0; i < n; i++) smp[i].turn = wrapA(smp[(i + 1) % n].ang - smp[i].ang);
    var tr = { id: def.id, def: def, set: def.set, n: n, len: total, ds: step, smp: smp,
      w: Math.ceil(maxX - minX + 2 * MARGIN), h: Math.ceil(maxY - minY + 2 * MARGIN), hw0: def.hw,
      forks: [], jumps: [], oils: [], rails: [], presses: [], pits: [] };
    placeHazards(tr);
    cache[def.id] = tr;
    return tr;
  }
  // извилистость вокруг выборки i: сумма |поворота| на ±win выборок
  function bend(tr, i, win) { var s = 0; for (var k = -win; k <= win; k++) s += Math.abs(tr.smp[(i + k + tr.n) % tr.n].turn); return s; }
  // Расстановка препятствий по рецепту: прямые участки, разнос ≥ 34 выборок (≈ 270 px), старт/финиш свободны
  function placeHazards(tr) {
    var def = tr.def, r = def.r, n = tr.n, rng = mulberry32(n * 31 + def.hw * 7 + def.pts.length), used = [], i;
    var straight = []; for (i = 0; i < n; i++) straight.push(bend(tr, i, 6));
    function free(i0, i1, gap) { for (var u = 0; u < used.length; u++) { var a = used[u][0] - gap, b = used[u][1] + gap; for (var q = i0; q <= i1; q++) { var qq = (q + n) % n; if (inR(qq, a, b)) return false; } } return true; }
    function inR(q, a, b) { a = (a + n) % n; b = (b + n) % n; return a <= b ? q >= a && q <= b : q >= a || q <= b; }
    function cands(lenS, maxBend, from, to) {
      var out = [];
      for (var c = from; c < to; c++) {
        var okc = true; for (var q = 0; q <= lenS; q += 2) if (straight[(c + q) % n] > maxBend) { okc = false; break; }
        if (okc) out.push(c);
      }
      return out;
    }
    function take(kind, count, lenS, maxBend, gap, mk) {
      var from = 40, to = n - lenS - 30;
      for (var t = 0; t < count; t++) {
        var cs = cands(lenS, maxBend, from, to).filter(function (c) { return free(c, c + lenS, gap); }), c = -1;
        while (cs.length) {   // случайный подходящий участок (развилке ещё нужно место для раздвинутой дороги)
          var j = Math.floor(rng() * cs.length), cj = cs[j];
          if (kind !== 'fork' || forkFits(tr, cj, cj + lenS)) { c = cj; break; }
          cs.splice(j, 1);
        }
        if (c < 0) return;
        used.push([c, c + lenS]); mk(c);
      }
    }
    take('fork', r.fork, 44, 0.7, 30, function (c) { tr.forks.push({ a: c, b: c + 44 }); });
    take('pit', r.pit, 34, 0.3, 20, function (c) { tr.pits.push({ a: c, b: c + 34, side: rng() < 0.5 ? -1 : 1 }); });
    take('jump', r.jump, 18, 0.22, 26, function (c) { tr.jumps.push({ i: c }); });
    take('rail', r.rail, 6, 0.35, 26, function (c) { tr.rails.push({ i: c + 3, period: 4.2 + rng() * 1.6, ph: rng() * 4, speed: 120 + rng() * 40 }); });
    take('press', r.press, 8, 0.4, 26, function (c) { tr.presses.push({ i: c + 4, o: rng() < 0.5 ? -1 : 1, ph: rng() * 3.4 }); });
    take('oil', r.oil, 5, 0.9, 18, function (c) { tr.oils.push({ i: c + 2, o: (rng() < 0.5 ? -1 : 1) * (0.35 + rng() * 0.3), r: 24 }); });
    // ширина: развилки раздвигают дорогу, посередине — остров
    tr.forks.forEach(function (fk) {
      for (var q = fk.a - 12; q <= fk.b + 12; q++) {
        var sm = tr.smp[(q + n) % n], t = q < fk.a ? (q - fk.a + 12) / 12 : q > fk.b ? (fk.b + 12 - q) / 12 : 1;
        sm.hw = Math.max(sm.hw, tr.hw0 + FORK_EXTRA * smooth(t));
        var ti = q < fk.a + 5 ? (q - fk.a) / 5 : q > fk.b - 5 ? (fk.b - q) / 5 : 1;
        if (q >= fk.a && q <= fk.b) sm.isl = Math.max(sm.isl, ISLAND_W * clamp(ti, 0.25, 1));
      }
    });
    tr.hazardCount = tr.forks.length + tr.jumps.length + tr.oils.length + tr.rails.length + tr.presses.length + tr.pits.length;
  }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  // развилка влезает: раздвинутая дорога не заходит на соседние участки трассы
  function forkFits(tr, a, b) {
    var n = tr.n, need = tr.hw0 * 2 + FORK_EXTRA + 40;
    for (var q = a - 12; q <= b + 12; q += 2) {
      var p = tr.smp[(q + n) % n];
      for (var k = 0; k < n; k += 2) {
        var dd = Math.abs(k - (q + n) % n); dd = Math.min(dd, n - dd); if (dd * tr.ds < 400) continue;
        var o = tr.smp[k]; if (hyp(o.x - p.x, o.y - p.y) < need) return false;
      }
    }
    return true;
  }
  // Ближайшая выборка: локальный поиск от подсказки si (или полный перебор)
  function nearest(tr, x, y, si) {
    var n = tr.n, smp = tr.smp, best = 1e18, bi = 0, i;
    if (si == null || si < 0) { for (i = 0; i < n; i++) { var dx = smp[i].x - x, dy = smp[i].y - y, d = dx * dx + dy * dy; if (d < best) { best = d; bi = i; } } return bi; }
    bi = si; var p = smp[si]; best = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
    for (var dir = -1; dir <= 1; dir += 2) {
      var miss = 0;
      for (i = 1; i < 80 && miss < 6; i++) {
        var q = (si + dir * i + n * 4) % n, s = smp[q], d2 = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y);
        if (d2 < best) { best = d2; bi = q; miss = 0; } else miss++;
      }
    }
    return bi;
  }
  function local(tr, x, y, si) { var p = tr.smp[si], dx = x - p.x, dy = y - p.y; return { lat: dx * p.nx + dy * p.ny, lon: dx * p.tx + dy * p.ty }; }
  function sAt(tr, si, lon) { return (tr.smp[si].s + lon + tr.len) % tr.len; }
  function dS(tr, a, b) { var d = b - a; if (d > tr.len / 2) d -= tr.len; if (d < -tr.len / 2) d += tr.len; return d; }   // b − a по кругу
  // проверка трассы: радиус поворота и разнос соседних участков (для тестов)
  function checkTrack(ix) {
    var tr = buildTrack(ix), n = tr.n, minGap = 1e9, minR = 1e9;
    for (var i = 0; i < n; i += 2) {
      var p = tr.smp[i], bnd = bend(tr, i, 3) / (7 * tr.ds); if (bnd > 0) minR = Math.min(minR, 1 / bnd);
      for (var k = 0; k < n; k += 2) {
        var dd = Math.abs(k - i); dd = Math.min(dd, n - dd); if (dd * tr.ds < 420) continue;
        var o = tr.smp[k], g = hyp(o.x - p.x, o.y - p.y) - p.hw - o.hw; if (g < minGap) minGap = g;
      }
    }
    return { gap: minGap, minR: minR, len: tr.len, hazards: tr.hazardCount, forks: tr.forks.length, jumps: tr.jumps.length, rails: tr.rails.length, presses: tr.presses.length, pits: tr.pits.length, oils: tr.oils.length };
  }

  // ---------- Характеристики машины ----------
  function defCfg() { return { body: 0, up: { armor: 1, tires: 1, engine: 1, weapon: 1 }, rear: 'oil' }; }
  function stats(cfg, pace) {
    var b = BODIES[cfg.body || 0], u = cfg.up || {}, A = u.armor || 1, Ti = u.tires || 1, E = u.engine || 1, Wp = u.weapon || 1;
    pace = pace || 1;
    return {
      body: b.id, maxV: b.v * (1 + 0.055 * (E - 1)) * pace, acc: b.acc * (1 + 0.07 * (E - 1)) * pace, turn: b.turn * (1 + 0.04 * (Ti - 1)),
      grip: 6 + 1.0 * (Ti - 1), spinK: 1 - 0.1 * (Ti - 1), hp: Math.round(b.hp * (1 + 0.2 * (A - 1))), mass: b.mass, ram: b.ram * (1 + 0.1 * (A - 1)),
      rivet: 2.2 + 0.6 * (Wp - 1), rivetCd: 0.14 - 0.01 * (Wp - 1), rocketDmg: 20 + 4 * (Wp - 1), rockets: 1 + Math.floor(Wp / 2),
      rear: 2 + Math.floor(Wp / 2), mineDmg: 16 + 3 * (Wp - 1), nitro: 2 + Math.floor((E - 1) / 2)
    };
  }
  function rivalCfg(league, ri) {
    var R = RIVALS[ri], t = 1 + league, up = { armor: t, tires: t, engine: t, weapon: t };
    for (var k in R.up) up[k] = Math.min(TIERS, up[k] + R.up[k]);
    return { body: [0, 1, 1, 2][league], up: up, rear: R.rear };
  }

  // ---------- Заезд ----------
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || mulberry32(opts.seed || 1), onEvent = opts.onEvent || function () {};
    var tr = buildTrack(opts.track || 0), smp = tr.smp, n = tr.n;
    var laps = opts.laps || LAPS, control = opts.control || 'tank', mode = opts.mode || 'race';
    var humans = opts.humans || [defCfg()], nh = Math.min(2, opts.players || humans.length);
    var rivals = opts.rivals != null ? opts.rivals : (mode === 'time' ? [] : RIVALS.map(function (r, i) { return { ch: i, cfg: rivalCfg(0, i) }; }));
    var pace = opts.pace || PACE[0];
    var S = {
      t: 0, raceT: 0, phase: 'count', countT: opts.countT != null ? opts.countT : COUNT_T, endT: -1, laps: laps, track: tr, mode: mode,
      cars: [], bullets: [], rockets: [], drops: [], booms: [], carts: [], cam: { x: 0, y: 0 }, finish: [], outs: [], results: null,
      control: control, players: nh, demo: !!opts.demo, team: opts.team === 'duel' ? 'duel' : 'coop'
    };
    function emit(t, d) { onEvent(t, d || {}); }

    // --- машины ---
    function mkCar(idx, human, cfg, ch) {
      var st = stats(cfg, human >= 0 ? 1 : pace * RIVALS[ch].pace);
      var c = { idx: idx, human: human, ch: ch, id: human >= 0 ? HUMANS[human].id : RIVALS[ch].id, color: human >= 0 ? HUMANS[human].color : RIVALS[ch].color,
        cfg: cfg, st: st, x: 0, y: 0, a: 0, vx: 0, vy: 0, vf: 0, si: 0, s: 0, lat: 0, prog: 0, lap: 0, z: 0, airT: 0, airMax: 0,
        hp: st.hp, wreckT: 0, invT: 0, spinT: 0, spinW: 0, stunT: 0, nitroT: 0, nitro: st.nitro, rockets: st.rockets, rear: st.rear,
        rearType: cfg.rear || 'oil', rivets: RIVETS, cd: 0, finished: false, finishT: 0, out: false, offT: 0, lapT0: 0, bestLap: 0, lapTimes: [],
        kills: 0, wrecks: 0, stuckT: 0, revT: 0, unstuck: 0, ramCd: {}, inp: {}, prevInp: {}, lane: human >= 0 ? 0 : RIVALS[ch].lane, laneT: 0,
        fireT: 0, smoke: 0, inPit: false, gas: 0, steer: 0, place: 0, auto: human < 0 };
      return c;
    }
    var order = [];
    rivals.forEach(function (r) { order.push(mkCar(0, -1, r.cfg, r.ch)); });
    for (var h = 0; h < nh; h++) order.push(mkCar(0, h, humans[h] || defCfg(), 0));
    order.forEach(function (c, i) {
      c.idx = i;
      var row = Math.floor(i / 2), col = i % 2, back = 34 + row * 40;
      var si = (n - Math.round(back / tr.ds)) % n, p = smp[si], off = (col ? 1 : -1) * p.hw * 0.42;
      c.si = si; c.x = p.x + p.nx * off; c.y = p.y + p.ny * off; c.a = p.ang; c.s = p.s; c.prog = -(tr.len - p.s); c.lap = -1;
      c.lat = off;
    });
    S.cars = order;
    var hum = order.filter(function (c) { return c.human >= 0; });
    var lead0 = hum[0] || order[0]; S.cam.x = lead0.x; S.cam.y = lead0.y;
    // вагонетки
    tr.rails.forEach(function (rl, i) { S.carts.push({ rail: i, i: rl.i, lat: -999, dir: i % 2 ? -1 : 1, t: rl.ph, active: false }); });

    // --- управление игрока → руль/газ ---
    function humanCtl(c) {
      var k = c.inp, out = { steer: 0, gas: 0, brake: 0 };
      if (control === 'arcade') {
        var dx = (k.right ? 1 : 0) - (k.left ? 1 : 0), dy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
        if (dx || dy) {
          var want = Math.atan2(dy, dx), d = wrapA(want - c.a);
          out.steer = clamp(d * 3, -1, 1);
          if (Math.abs(d) < 1.9) out.gas = Math.abs(d) < 1.2 ? 1 : 0.4; else out.gas = 0.25;
        }
      } else {
        out.steer = (k.right ? 1 : 0) - (k.left ? 1 : 0);
        out.gas = k.up ? 1 : 0; out.brake = k.down ? 1 : 0;
      }
      out.fire = !!k.fire; out.rocket = k.rocket && !c.prevInp.rocket; out.drop = k.drop && !c.prevInp.drop; out.nitro = k.nitro && !c.prevInp.nitro;
      c.prevInp = { rocket: k.rocket, drop: k.drop, nitro: k.nitro };
      return out;
    }

    // --- ИИ водителя (V — «картина мира», которую видит водитель; по умолчанию — текущая) ---
    function drive(c, V, o) {
      V = V || S; o = o || {};
      var R = c.human >= 0 ? (o.char || { aggr: 0.6, ramp: 0, drop: 0.4, lane: 0, side: 1, boost: 0.7 }) : RIVALS[c.ch];
      var st = c.st, v = Math.max(0, c.vf), out = { steer: 0, gas: 1, brake: 0 };
      var look = 50 + v * 0.42, ti = (c.si + Math.round(look / tr.ds)) % n, tp = smp[ti];
      // полоса: характер + внутренняя сторона поворота + препятствия
      var ahead = 0; for (var q = 4; q < 30; q++) ahead += smp[(c.si + q) % n].turn;
      var lane = R.lane * 0.5 - clamp(ahead * 1.6, -0.55, 0.55), vT = st.maxV * (c.nitroT > 0 ? 1.4 : 1);
      var fk = null, ki;
      for (ki = 0; ki < tr.forks.length; ki++) { var dF = (tr.forks[ki].a - c.si + n) % n; if (dF < 46 || (c.si >= tr.forks[ki].a && c.si <= tr.forks[ki].b + 4)) fk = tr.forks[ki]; }
      if (fk) lane = (R.side || 1) * (c.human >= 0 ? (o.side || 1) : 1) * 0.62;
      tr.oils.forEach(function (ol) { var d = (ol.i - c.si + n) % n; if (d > 2 && d < 32) lane = ol.o > 0 ? -0.5 : 0.5; });
      (V.drops || S.drops).forEach(function (dr) { if (dr.owner === c.idx && dr.t < 1) return; var l = local(tr, dr.x, dr.y, c.si); if (l.lon > 10 && l.lon < 160 && Math.abs(l.lat - c.lat) < 30) lane = clamp((l.lat > c.lat ? -1 : 1) * 0.6 + lane * 0.2, -0.7, 0.7); });
      tr.presses.forEach(function (pr, pi) {
        var d = (pr.i - c.si + n) % n; if (d > 30 || d < -2) return;
        var dist = d * tr.ds, eta = dist / Math.max(60, v), ph = pressPhase(pr, (V.t != null ? V.t : S.t) + eta);
        if (ph.state !== 'up' || ph.left < 0.5) lane = -pr.o * 0.6;
      });
      // ремонтный бокс, если броня просела
      var needPit = c.hp < c.st.hp * (c.human >= 0 ? 0.5 : 0.42);
      tr.pits.forEach(function (pt) { var d = (pt.a - c.si + n) % n; if (needPit && (d < 30 || (c.si >= pt.a && c.si <= pt.b))) { lane = pt.side * 0.7; if (c.si >= pt.a - 4 && c.si <= pt.b) vT = Math.min(vT, st.maxV * 0.45); } });
      // вагонетка: если перекроет полосу к нашему приезду — придержать
      (V.carts || S.carts).forEach(function (ct) {
        if (!ct.active) return; var d = (ct.i - c.si + n) % n; if (d > 26) return;
        var eta = d * tr.ds / Math.max(50, v), latAt = ct.lat + ct.dir * tr.rails[ct.rail].speed * eta;
        if (Math.abs(latAt - c.lat) < 46 && d > 1) vT = Math.min(vT, d < 8 ? 0 : 50);
      });
      // таран: тянуться к соседу сбоку/впереди
      if (R.ramp > 0.5 && c.human < 0) S.cars.forEach(function (o2) {
        if (o2 === c || o2.wreckT > 0 || o2.out || o2.finished) return; var l = local(tr, o2.x, o2.y, c.si);
        if (l.lon > 0 && l.lon < 110 && Math.abs(l.lat - c.lat) < 70) lane = clamp(l.lat / Math.max(30, smp[c.si].hw), -0.8, 0.8);
      });
      c.laneT += (lane - c.laneT) * 0.12;
      var off = c.laneT * (tp.hw - 14);
      if (fk) {
        // развилка: держимся середины выбранного рукава, смотрим ближе — чтобы не срезать через остров
        var fs = c.si >= fk.a - 2 && c.si <= fk.b ? (c.lat >= 0 ? 1 : -1) : (lane >= 0 ? 1 : -1);
        if (c.si >= fk.a - 2 && c.si <= fk.b) c.laneT = fs * 0.62;
        ti = (c.si + Math.round((34 + v * 0.18) / tr.ds)) % n; tp = smp[ti];
        var isw = Math.max(tp.isl, smp[c.si].isl, ISLAND_W * 0.6);
        off = fs * (isw + (tp.hw - isw) / 2);
      }
      var tx = tp.x + tp.nx * off, ty = tp.y + tp.ny * off;
      var want = Math.atan2(ty - c.y, tx - c.x), d = wrapA(want - c.a);
      out.steer = clamp(d * 2.6, -1, 1);
      // скорость перед поворотом: требуемая угловая скорость не больше доступной
      var sharp = 0; for (q = 0; q < 40; q++) { var acc2 = 0; for (var w2 = 0; w2 < 10; w2++) acc2 += smp[(c.si + q + w2) % n].turn; sharp = Math.max(sharp, Math.abs(acc2)); }
      var curv = sharp / (10 * tr.ds); if (curv > 0.002) vT = Math.min(vT, 0.62 * st.turn / curv);
      // трамплин впереди — полный газ
      tr.jumps.forEach(function (jp) { var dj = (jp.i - c.si + n) % n; if (dj < 30) vT = Math.max(vT, st.maxV); });
      if (Math.abs(d) > 1.2) vT = Math.min(vT, 110);
      if (v > vT + 12) { out.gas = 0; out.brake = v > vT + 40 ? 1 : 0.5; } else out.gas = 1;
      // оружие
      out.fire = false;
      var tgt = null, tgtD = 1e9, behind = false;
      S.cars.forEach(function (o2) {
        if (o2 === c || o2.wreckT > 0 || o2.out || o2.finished || o2.z > 0 || mates(c, o2)) return;
        var dx = o2.x - c.x, dy = o2.y - c.y, dd = hyp(dx, dy), ang = Math.abs(wrapA(Math.atan2(dy, dx) - c.a));
        if (ang < 0.22 && dd < 300 && dd < tgtD) { tgt = o2; tgtD = dd; }
        if (ang > 2.6 && dd < 150) behind = true;
      });
      var rr = o.rand || rng;
      if (tgt && rr() < R.aggr * 0.35 + 0.05) out.fire = true;
      if (tgt && c.rockets > 0 && tgtD > 90 && rr() < R.aggr * 0.012) out.rocket = true;
      if (behind && c.rear > 0 && rr() < R.drop * 0.01) out.drop = true;
      if (c.nitro > 0 && c.nitroT <= 0 && sharp < 0.18 && v > st.maxV * 0.7 && !needPit && rr() < R.boost * 0.004 * (c.lap >= laps - 1 ? 3 : 1)) out.nitro = true;
      // разворот при застревании
      if (c.revT > 0) { out.gas = 0; out.brake = 1; out.steer = -out.steer || 1; }
      return out;
    }
    function pressPhase(pr, t) { var P = 3.4, x = ((t + pr.ph) % P + P) % P; if (x < 1.9) return { state: 'up', x: x, left: 1.9 - x }; if (x < 2.6) return { state: 'warn', x: x, left: 2.6 - x }; return { state: 'down', x: x, left: P - x }; }

    // --- физика ---
    function physics(c, ctl, dt) {
      var st = c.st, f = { x: Math.cos(c.a), y: Math.sin(c.a) }, vf = c.vx * f.x + c.vy * f.y, vs = -c.vx * f.y + c.vy * f.x;
      var air = c.z > 0 || c.airT > 0, maxV = st.maxV * (c.nitroT > 0 ? 1.4 : 1) * (c.inPit ? 0.7 : 1), acc = st.acc * (c.nitroT > 0 ? 1.8 : 1);
      var grip = st.grip, stun = c.stunT > 0;
      c.gas = ctl.gas; c.steer = ctl.steer;
      if (!air) {
        if (stun) { ctl = { steer: 0, gas: 0, brake: 0 }; }
        if (c.spinT > 0) { grip = 0.6; c.a += c.spinW * dt; ctl.gas *= 0.4; ctl.steer *= 0.3; }
        if (c.nitroT > 0) ctl.gas = 1;
        if (ctl.gas > 0 && vf < maxV) vf = Math.min(maxV, vf + acc * ctl.gas * dt);
        if (ctl.brake > 0) { if (vf > 0) vf = Math.max(0, vf - 520 * ctl.brake * dt); else vf = Math.max(-90, vf - 160 * ctl.brake * dt); }
        if (!ctl.gas && !ctl.brake) vf *= Math.exp(-0.7 * dt);
        if (vf > maxV) vf += (maxV - vf) * Math.min(1, 3 * dt);
        vs *= Math.exp(-grip * dt);
        var av = Math.abs(vf), tf = av < 90 ? 0.35 + 0.65 * av / 90 : 1 - 0.25 * clamp((av - 90) / Math.max(1, st.maxV - 90), 0, 1);
        c.a = wrapA(c.a + ctl.steer * st.turn * tf * (vf < -5 ? -1 : 1) * dt);
        var nf = { x: Math.cos(c.a), y: Math.sin(c.a) };
        c.vx = nf.x * vf - nf.y * vs; c.vy = nf.y * vf + nf.x * vs;
      }
      c.vf = vf;
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.airT > 0) { c.airT -= dt; c.z = Math.sin(Math.PI * clamp(1 - c.airT / c.airMax, 0, 1)) * 18; if (c.airT <= 0) { c.z = 0; c.airT = 0; emit('land', { car: c.idx, x: c.x, y: c.y }); } }
      // стены трассы и остров
      var osi = c.si; c.si = nearest(tr, c.x, c.y, c.si);
      var p = smp[c.si], l = local(tr, c.x, c.y, c.si), lim = p.hw - CAR_R, hit = 0;
      if (Math.abs(l.lat) > lim) { hit = Math.abs(l.lat) - lim; var sg = l.lat > 0 ? 1 : -1; push(c, p.nx * sg, p.ny * sg, Math.abs(l.lat) - lim); l.lat = sg * lim; }
      if (p.isl && Math.abs(l.lat) < p.isl + CAR_R) { var sg2 = l.lat >= 0 ? -1 : 1, dpen = p.isl + CAR_R - Math.abs(l.lat); push(c, p.nx * sg2, p.ny * sg2, dpen); l.lat = -sg2 * (p.isl + CAR_R); hit = dpen; }
      c.lat = l.lat;
      var s = sAt(tr, c.si, clamp(l.lon, -tr.ds, tr.ds)), ds = dS(tr, c.s, s);
      c.s = s; c.prog += ds;
      return hit;
    }
    // вытолкнуть машину вдоль нормали (nx,ny — наружу из препятствия, т.е. к дороге) и погасить скорость в стену
    function push(c, nx, ny, pen) {
      c.x -= nx * pen; c.y -= ny * pen;
      var vn = c.vx * nx + c.vy * ny;
      if (vn > 0) {
        c.vx -= vn * nx * 1.35; c.vy -= vn * ny * 1.35; c.vx *= 0.93; c.vy *= 0.93;
        if (vn > 160 && c.invT <= 0) damage(c, (vn - 160) * 0.05, -1, 'wall');
        if (vn > 90) emit('wall', { car: c.idx, x: c.x, y: c.y, v: vn });
      }
    }

    function mates(a, b) { return S.team === 'coop' && a && b && a.human >= 0 && b.human >= 0; }   // кооп: свои своих не бьют
    function damage(c, dmg, by, how) {
      if (c.wreckT > 0 || c.out || c.finished || dmg <= 0 || c.invT > 0) return;
      if (by >= 0 && mates(c, S.cars[by])) return;
      c.hp -= dmg;
      if (c.hp <= 0) {
        c.hp = 0; c.wreckT = 1.8; c.wrecks++; c.vx *= 0.25; c.vy *= 0.25; c.nitroT = 0; c.spinT = 0; c.stunT = 0;
        var k = by >= 0 && by !== c.idx ? S.cars[by] : null; if (k) k.kills++;
        emit('wreck', { car: c.idx, by: by, how: how, x: c.x, y: c.y });
      }
    }
    function respawn(c) {
      var p = smp[c.si]; c.x = p.x; c.y = p.y; c.a = p.ang; c.vx = c.vy = c.vf = 0; c.lat = 0; c.z = 0; c.airT = 0;
      if (p.isl) { c.x += p.nx * (p.isl + 30); c.y += p.ny * (p.isl + 30); c.lat = p.isl + 30; }
      c.hp = Math.round(c.st.hp * 0.6); c.invT = 2.4; c.wreckT = 0; c.stuckT = 0; c.revT = 0;
      emit('respawn', { car: c.idx, x: c.x, y: c.y });
    }

    // --- оружие ---
    function fire(c) {
      if (c.cd > 0 || c.rivets < 1) return;
      c.cd = c.st.rivetCd; c.rivets -= 1;
      var f = { x: Math.cos(c.a), y: Math.sin(c.a) }, side = (c.fireT++ % 2 ? 1 : -1) * 5;
      S.bullets.push({ x: c.x + f.x * 16 - f.y * side, y: c.y + f.y * 16 + f.x * side, vx: f.x * 560 + c.vx * 0.6, vy: f.y * 560 + c.vy * 0.6, owner: c.idx, dmg: c.st.rivet, life: 0.6, si: c.si });
      emit('shot', { car: c.idx, x: c.x, y: c.y });
    }
    function launch(c) {
      if (c.rockets <= 0) return; c.rockets--;
      var f = { x: Math.cos(c.a), y: Math.sin(c.a) };
      S.rockets.push({ x: c.x + f.x * 18, y: c.y + f.y * 18, a: c.a, v: Math.max(380, c.vf + 220), owner: c.idx, dmg: c.st.rocketDmg, life: 3, si: c.si, tgt: -1, trail: 0 });
      emit('rocket', { car: c.idx, x: c.x, y: c.y });
    }
    function dropRear(c) {
      if (c.rear <= 0) return; c.rear--;
      var f = { x: Math.cos(c.a), y: Math.sin(c.a) };
      S.drops.push({ k: c.rearType, x: c.x - f.x * 20, y: c.y - f.y * 20, owner: c.idx, t: 0, life: c.rearType === 'oil' ? 14 : 25, r: c.rearType === 'oil' ? 22 : 8, dmg: c.st.mineDmg });
      emit(c.rearType === 'oil' ? 'oilDrop' : 'mineDrop', { car: c.idx, x: c.x, y: c.y });
    }
    function useNitro(c) { if (c.nitro <= 0 || c.nitroT > 0) return; c.nitro--; c.nitroT = 1.4; emit('nitro', { car: c.idx, x: c.x, y: c.y }); }
    function boom(x, y, r, dmg, by, kind) {
      S.booms.push({ x: x, y: y, r: r, t: 0.45, max: 0.45, kind: kind });
      S.cars.forEach(function (c) {
        if (c.wreckT > 0 || c.out || c.finished) return; var d = hyp(c.x - x, c.y - y); if (d > r + CAR_R) return;
        var k = 1 - 0.5 * clamp(d / r, 0, 1); damage(c, dmg * k, by, kind);
        var nx = (c.x - x) / (d || 1), ny = (c.y - y) / (d || 1); c.vx += nx * 160 * k; c.vy += ny * 160 * k; c.spinT = Math.max(c.spinT, 0.35); c.spinW = (nx > 0 ? 1 : -1) * 6;
      });
      emit('boom', { x: x, y: y, r: r, kind: kind });
    }

    function projectiles(dt) {
      var i, j;
      for (i = S.bullets.length - 1; i >= 0; i--) {
        var b = S.bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        b.si = nearest(tr, b.x, b.y, b.si); var p = smp[b.si], l = local(tr, b.x, b.y, b.si), dead = b.life <= 0 || Math.abs(l.lat) > p.hw + 4 || (p.isl && Math.abs(l.lat) < p.isl);
        if (!dead) for (j = 0; j < S.cars.length; j++) {
          var c = S.cars[j]; if (j === b.owner || c.wreckT > 0 || c.out || c.finished || c.z > 4) continue;
          if (hyp(c.x - b.x, c.y - b.y) < CAR_R + 3) { damage(c, b.dmg, b.owner, 'rivet'); c.vx += b.vx * 0.02; c.vy += b.vy * 0.02; emit('hit', { car: j, by: b.owner, x: b.x, y: b.y }); dead = true; break; }
        }
        if (dead) S.bullets.splice(i, 1);
      }
      for (i = S.rockets.length - 1; i >= 0; i--) {
        var r = S.rockets[i], own = S.cars[r.owner]; r.life -= dt;
        // наведение: ближайшая машина впереди в конусе ±0.7 рад, иначе — вдоль трассы
        var best = null, bd = 420;
        S.cars.forEach(function (c) {
          if (c.idx === r.owner || c.wreckT > 0 || c.out || c.finished) return;
          var dx = c.x - r.x, dy = c.y - r.y, dd = hyp(dx, dy); if (dd > bd) return;
          if (Math.abs(wrapA(Math.atan2(dy, dx) - r.a)) < 0.7) { best = c; bd = dd; }
        });
        var want = best ? Math.atan2(best.y - r.y, best.x - r.x) : (function () { var q = smp[(r.si + 8) % n]; return Math.atan2(q.y - r.y, q.x - r.x); })();
        r.a = wrapA(r.a + clamp(wrapA(want - r.a), -2.6 * dt, 2.6 * dt)); r.v = Math.min(520, r.v + 200 * dt);
        r.x += Math.cos(r.a) * r.v * dt; r.y += Math.sin(r.a) * r.v * dt; r.si = nearest(tr, r.x, r.y, r.si);
        var p2 = smp[r.si], l2 = local(tr, r.x, r.y, r.si), hitc = null;
        S.cars.forEach(function (c) { if (!hitc && c.idx !== r.owner && c.wreckT <= 0 && !c.out && !c.finished && hyp(c.x - r.x, c.y - r.y) < CAR_R + 6) hitc = c; });
        if (hitc || r.life <= 0 || Math.abs(l2.lat) > p2.hw + 2 || (p2.isl && Math.abs(l2.lat) < p2.isl)) {
          if (hitc) damage(hitc, r.dmg * 0.6, r.owner, 'rocket');
          boom(r.x, r.y, 42, r.dmg * 0.5, r.owner, 'rocket'); S.rockets.splice(i, 1);
        }
      }
      for (i = S.drops.length - 1; i >= 0; i--) {
        var d = S.drops[i]; d.t += dt; if (d.t > d.life) { S.drops.splice(i, 1); continue; }
        for (j = 0; j < S.cars.length; j++) {
          var c2 = S.cars[j]; if (c2.wreckT > 0 || c2.out || c2.finished || c2.z > 2) continue;
          if (j === d.owner && d.t < 1.5) continue;
          if (hyp(c2.x - d.x, c2.y - d.y) > d.r + CAR_R - 3) continue;
          if (d.k === 'oil') { if (c2.spinT <= 0.05 && (c2.oilCd || 0) <= S.t) { c2.spinT = 1.0 * c2.st.spinK; c2.oilCd = S.t + c2.spinT + 1.2; c2.spinW = (rng() < 0.5 ? -1 : 1) * 5.5; emit('spin', { car: j, x: c2.x, y: c2.y, by: d.owner }); } }
          else if (d.t > 0.5) { S.drops.splice(i, 1); damage(c2, d.dmg * 0.5, d.owner, 'mine'); boom(d.x, d.y, 34, d.dmg * 0.5, d.owner, 'mine'); break; }
        }
      }
      for (i = S.booms.length - 1; i >= 0; i--) { S.booms[i].t -= dt; if (S.booms[i].t <= 0) S.booms.splice(i, 1); }
    }

    // --- препятствия трассы ---
    function hazards(c, dt) {
      if (c.wreckT > 0 || c.out) return;
      var ground = c.z <= 0 && c.airT <= 0;
      c.inPit = false;
      tr.jumps.forEach(function (jp) {
        var ds = dS(tr, smp[jp.i].s, c.s);
        if (ground && ds >= 0 && ds < RAMP && c.vf > JUMP_MIN) { c.airMax = c.airT = 0.24 + c.vf / 680; c.z = 0.01; emit('jump', { car: c.idx, x: c.x, y: c.y }); }
        else if (ground && ds > TRENCH[0] && ds < TRENCH[1]) {   // шлаковая канава за трамплином: жжёт и вязнет
          c.vx *= Math.exp(-2.2 * dt); c.vy *= Math.exp(-2.2 * dt); damage(c, 20 * dt, -1, 'slag');
          if (rng() < dt * 4) emit('slag', { car: c.idx, x: c.x, y: c.y });
        }
      });
      if (!ground) return;
      tr.oils.forEach(function (ol) {
        var p = smp[ol.i]; if (hyp(c.x - (p.x + p.nx * ol.o * p.hw), c.y - (p.y + p.ny * ol.o * p.hw)) < ol.r + CAR_R - 4 && c.spinT <= 0.05 && (c.oilCd || 0) <= S.t) {
          c.spinT = 0.8 * c.st.spinK; c.oilCd = S.t + c.spinT + 1.2; c.spinW = (c.lat > ol.o * p.hw ? 1 : -1) * 5; emit('spin', { car: c.idx, x: c.x, y: c.y, by: -1 });
        }
      });
      tr.presses.forEach(function (pr, k) {
        var p = smp[pr.i], ds = dS(tr, p.s, c.s), ph = pressPhase(pr, S.t), lat0 = pr.o > 0 ? 0 : -p.hw, lat1 = pr.o > 0 ? p.hw : 0;
        if (Math.abs(ds) > 28 + CAR_R || c.lat < lat0 - CAR_R || c.lat > lat1 + CAR_R) return;
        if (ph.state === 'down') {
          if (ph.x - 2.6 < dt * 1.5 && c.invT <= 0) { damage(c, 32, -1, 'press'); c.stunT = 0.7; c.vx = c.vy = 0; emit('press', { car: c.idx, x: c.x, y: c.y }); }
          else if (c.lat > lat0 && c.lat < lat1) { var dir = ds < 0 ? -1 : 1, pen = 28 + CAR_R - Math.abs(ds); c.x += p.tx * dir * pen; c.y += p.ty * dir * pen; var vt = c.vx * p.tx + c.vy * p.ty; if (vt * dir < 0) { c.vx -= vt * p.tx * 1.3; c.vy -= vt * p.ty * 1.3; } }
        }
      });
      S.carts.forEach(function (ct) {
        if (!ct.active) return; var p = smp[ct.i], ds = dS(tr, p.s, c.s);
        if (Math.abs(ds) < 12 + CAR_R && Math.abs(c.lat - ct.lat) < 18 + CAR_R && (c.cartCd || 0) <= 0) {
          c.cartCd = 0.6; damage(c, 14, -1, 'cart');
          var dir = ds < 0 ? -1 : 1; c.vx = p.nx * ct.dir * 170 + p.tx * dir * 60; c.vy = p.ny * ct.dir * 170 + p.ty * dir * 60; c.spinT = 0.4; c.spinW = ct.dir * 5;
          emit('cart', { car: c.idx, x: c.x, y: c.y });
        }
      });
      if (c.cartCd > 0) c.cartCd -= dt;
      tr.pits.forEach(function (pt) {
        if (c.si >= pt.a && c.si <= pt.b && c.lat * pt.side > smp[c.si].hw * 0.35) {
          c.inPit = true; if (c.hp < c.st.hp) { var was = c.hp; c.hp = Math.min(c.st.hp, c.hp + 34 * dt * (1.2 - 0.8 * clamp(Math.abs(c.vf) / c.st.maxV, 0, 1))); if (was < c.st.hp && c.hp >= c.st.hp) emit('repaired', { car: c.idx }); if (rng() < dt * 3) emit('pit', { car: c.idx, x: c.x, y: c.y }); }
        }
      });
    }
    function updateCarts(dt) {
      S.carts.forEach(function (ct) {
        var rl = tr.rails[ct.rail], hw = smp[ct.i].hw, span = hw + 70;
        if (!ct.active) { ct.t -= dt; if (ct.t <= 0) { ct.active = true; ct.lat = -ct.dir * span; emit('cartHorn', { i: ct.i }); } return; }
        ct.lat += ct.dir * rl.speed * dt;
        if (Math.abs(ct.lat) > span && ct.lat * ct.dir > 0) { ct.active = false; ct.t = rl.period; ct.dir = -ct.dir; }
      });
    }

    // --- столкновения машин (таран) ---
    function carsCollide() {
      var cs = S.cars;
      for (var i = 0; i < cs.length; i++) for (var j = i + 1; j < cs.length; j++) {
        var a = cs[i], b = cs[j];
        if (a.wreckT > 0 || b.wreckT > 0 || a.out || b.out || a.finished || b.finished || Math.abs(a.z - b.z) > 6) continue;
        var dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy); if (d >= CAR_R * 2 || d < 0.001) continue;
        var nx = dx / d, ny = dy / d, pen = CAR_R * 2 - d, ma = a.st.mass, mb = b.st.mass, tot = ma + mb;
        a.x -= nx * pen * mb / tot; a.y -= ny * pen * mb / tot; b.x += nx * pen * ma / tot; b.y += ny * pen * ma / tot;
        var rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny; if (rv <= 0) continue;
        var jimp = (1 + 0.35) * rv / (1 / ma + 1 / mb);
        a.vx -= jimp / ma * nx; a.vy -= jimp / ma * ny; b.vx += jimp / mb * nx; b.vy += jimp / mb * ny;
        var key = i + ':' + j; if ((a.ramCd[key] || 0) > S.t) continue; a.ramCd[key] = S.t + 0.3;
        // урон тарана: кто бьёт «лбом» — сильнее; нитро удваивает удар (таран-бампер)
        var fa = Math.cos(a.a) * nx + Math.sin(a.a) * ny, fb = -(Math.cos(b.a) * nx + Math.sin(b.a) * ny);
        var base = Math.max(0, rv - 50) * 0.11;
        var toB = base * a.st.ram * (fa > 0.5 ? 1 : 0.3) * (a.nitroT > 0 ? 1.9 : 1), toA = base * b.st.ram * (fb > 0.5 ? 1 : 0.3) * (b.nitroT > 0 ? 1.9 : 1);
        if (toB > 0.5 || toA > 0.5) { damage(b, toB, a.idx, 'ram'); damage(a, toA, b.idx, 'ram'); emit('ram', { a: a.idx, b: b.idx, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, power: Math.max(toA, toB) }); }
      }
    }

    // --- камера и отсечка отстающего ---
    function camera(dt) {
      var act = S.cars.filter(function (c) { return c.human >= 0 && !c.out && !c.finished; });   // финишировавший кадр не ведёт
      if (!act.length) act = S.cars.filter(function (c) { return c.human >= 0 && !c.out; });
      var lead = null; act.forEach(function (c) { if (!lead || c.prog > lead.prog) lead = c; });
      if (!lead) lead = S.cars.filter(function (c) { return !c.out; }).sort(function (a, b) { return b.prog - a.prog; })[0];
      if (!lead) return;
      S.lead = lead.idx;
      var tx = lead.x + lead.vx * 0.32, ty = lead.y + lead.vy * 0.32, k = Math.min(1, 5 * dt);
      // вдвоём кадр тянется к середине между лидером и напарником (лидер всё равно остаётся в кадре — см. ниже)
      var mate = act.filter(function (c) { return c !== lead && !c.finished; })[0];
      if (mate) { tx = (lead.x + lead.vx * 0.2 + mate.x) / 2; ty = (lead.y + lead.vy * 0.2 + mate.y) / 2; }
      S.cam.x += (tx - S.cam.x) * k; S.cam.y += (ty - S.cam.y) * k;
      // лидер не должен уйти за кадр
      var mx = VIEW.w / 2 - 60, my = VIEW.h / 2 - 50;
      S.cam.x = clamp(S.cam.x, lead.x - mx, lead.x + mx); S.cam.y = clamp(S.cam.y, lead.y - my, lead.y + my);
      if (act.length < 2 || S.phase !== 'race') return;
      act.forEach(function (c) {
        // не отсекаем на первых секундах, разбитого и только что вернувшегося на трассу — дадим догнать
        if (c === lead || c.finished || c.wreckT > 0 || c.invT > 0 || S.raceT < 5) { c.offT = 0; return; }
        var off = Math.abs(c.x - S.cam.x) > VIEW.w / 2 + 6 || Math.abs(c.y - S.cam.y) > VIEW.h / 2 + 6;
        c.offT = off ? c.offT + dt : 0;
        if (c.offT > CUT_T) { c.out = true; S.outs.push(c.idx); emit('cut', { car: c.idx, human: c.human }); }
      });
    }

    // --- круги и финиш ---
    function laps_(c) {
      if (c.finished) return;
      var lap = Math.floor(c.prog / tr.len);
      if (lap > c.lap) {
        if (c.lap >= 0) {
          var lt = S.raceT - c.lapT0; c.lapTimes.push(lt);
          var best = !c.bestLap || lt < c.bestLap; if (best) c.bestLap = lt;
          emit('lap', { car: c.idx, lap: lap, time: lt, best: best, human: c.human });
        }
        c.lap = lap; c.lapT0 = S.raceT;
        if (lap >= laps && !c.finished && !S.demo) {
          c.finished = true; c.finishT = S.raceT; S.finish.push(c.idx); c.place = S.finish.length;
          emit('finish', { car: c.idx, place: c.place, human: c.human, time: c.finishT });
        }
      }
    }
    function finalize() {
      var placed = S.finish.slice();
      var racing = S.cars.filter(function (c) { return !c.finished && !c.out; }).sort(function (a, b) { return b.prog - a.prog; });
      racing.forEach(function (c) { placed.push(c.idx); });
      S.outs.slice().reverse().forEach(function (i) { placed.push(i); });
      S.results = placed.map(function (idx, k) {
        var c = S.cars[idx]; c.place = k + 1;
        return { idx: idx, id: c.id, human: c.human, ch: c.ch, place: k + 1, time: c.finished ? c.finishT : 0, best: c.bestLap, kills: c.kills, wrecks: c.wrecks, out: c.out, finished: c.finished, unstuck: c.unstuck };
      });
      S.phase = 'done'; emit('raceEnd', { results: S.results });
    }
    function positions() {
      var arr = S.cars.slice().sort(function (a, b) {
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        if (a.finished) return a.place - b.place;
        if (a.out !== b.out) return a.out ? 1 : -1;
        return b.prog - a.prog;
      });
      arr.forEach(function (c, k) { c.pos = k + 1; });
    }

    // --- шаг ---
    function step(dt) {
      S.t += dt;
      updateCarts(dt);
      if (S.phase === 'count') {
        var before = Math.ceil(S.countT); S.countT -= dt;
        if (Math.ceil(S.countT) < before && S.countT > 0) emit('count', { n: Math.ceil(S.countT) });
        if (S.countT <= 0) { S.phase = 'race'; S.raceT = 0; S.cars.forEach(function (c) { c.lapT0 = 0; }); emit('go'); }
        camera(dt); return;
      }
      if (S.phase === 'done') { camera(dt); return; }
      S.raceT += dt;
      S.cars.forEach(function (c) {
        if (c.out) return;
        if (c.ramCd && S.t % 5 < dt) c.ramCd = {};
        if (c.wreckT > 0) { c.wreckT -= dt; c.vx *= Math.exp(-3 * dt); c.vy *= Math.exp(-3 * dt); c.x += c.vx * dt; c.y += c.vy * dt; c.si = nearest(tr, c.x, c.y, c.si); if (c.wreckT <= 0) respawn(c); return; }
        var ctl = (c.human >= 0 && !c.finished && !c.auto) ? humanCtl(c) : drive(c, null, c.aiOpts);
        if (c.invT > 0) c.invT -= dt; if (c.spinT > 0) c.spinT -= dt; if (c.stunT > 0) c.stunT -= dt; if (c.nitroT > 0) c.nitroT -= dt;
        c.cd -= dt; if (c.cd < -0.5) c.rivets = Math.min(RIVETS, c.rivets + 6 * dt);   // пар копится, когда не стреляем
        if (!c.finished && c.z <= 0) {
          if (ctl.fire) fire(c); if (ctl.rocket) launch(c); if (ctl.drop) dropRear(c); if (ctl.nitro) useNitro(c);
        }
        physics(c, ctl, dt);
        hazards(c, dt);
        // детектор застревания: стоим > 1.2 с — задний ход; > 4 с — на трассу
        var moving = hyp(c.vx, c.vy) > 22;
        if (!moving && c.stunT <= 0 && c.z <= 0 && (c.human < 0 || c.auto || c.finished)) {
          c.stuckT += dt; if (c.stuckT > 1.2 && c.revT <= 0) c.revT = 0.7;
          if (c.stuckT > 4) { c.unstuck++; c.stuckT = 0; var p = smp[c.si]; c.x = p.x; c.y = p.y; c.a = p.ang; c.vx = c.vy = 0; if (p.isl) { c.x += p.nx * (p.isl + 30); c.y += p.ny * (p.isl + 30); } emit('unstuck', { car: c.idx }); }
        } else c.stuckT = Math.max(0, c.stuckT - dt * 2);
        if (c.revT > 0) c.revT -= dt;
        laps_(c);
      });
      carsCollide();
      projectiles(dt);
      camera(dt);
      positions();
      if (!S.demo && S.endT < 0) {
        var hum2 = S.cars.filter(function (c) { return c.human >= 0; });
        if (hum2.length && hum2.every(function (c) { return c.finished || c.out; })) S.endT = END_T;
        if (!hum2.length && S.cars.every(function (c) { return c.finished; })) S.endT = 0.01;   // заезд одних ИИ (тесты)
        if (S.raceT > RACE_MAX) S.endT = 0.01;
      }
      if (S.endT > 0) { S.endT -= dt; if (S.endT <= 0) finalize(); }
    }

    var api = {
      _S: S,
      start: function () { emit('start', { track: tr.id }); return api; },
      update: function (dt) { dt = Math.min(dt, 0.1); var k = Math.max(1, Math.ceil(dt / (1 / 60) - 1e-6)); for (var i = 0; i < k; i++) step(dt / k); },
      setInput: function (pi, keys) { var c = S.cars.filter(function (x) { return x.human === pi; })[0]; if (c) c.inp = keys || {}; },
      setControl: function (m) { control = m; S.control = m; },
      state: function () { return S; },
      results: function () { return S.results; },
      drive: drive, pressPhase: pressPhase, humanCar: function (pi) { return S.cars.filter(function (x) { return x.human === pi; })[0]; },
      _damage: damage, _boom: boom, _respawn: respawn, _finalize: finalize
    };
    return api;
  }

  // ---------- Чемпионат (чистые функции над сериализуемым объектом) ----------
  function newChamp(o) {
    o = o || {}; var n = o.players === 2 ? 2 : 1, team = n === 2 && o.team === 'duel' ? 'duel' : 'coop';
    return { v: 1, players: n, team: team, league: 0, race: 0, tries: 0, money: team === 'duel' ? [START_MONEY, START_MONEY] : [START_MONEY],
      cars: n === 2 ? [defCfg(), defCfg()] : [defCfg()], pts: {}, total: 0, done: null, log: [] };
  }
  function purse(ch, pi) { return ch.team === 'duel' ? pi : 0; }
  // цена покупки: 'armor'|'tires'|'engine'|'weapon' — следующая ступень; 'body1'|'body2' — корпус. null — недоступно
  function price(ch, pi, item) {
    var car = ch.cars[pi]; if (!car) return null;
    if (item.indexOf('body') === 0) { var b = +item.slice(4); if (!BODIES[b] || b <= car.body) return null; return BODIES[b].price; }
    if (UPG.indexOf(item) < 0) return null;
    var t = car.up[item]; if (t >= TIERS) return null;
    return Math.round(UPG_PRICE[item] * t * (1 + 0.5 * car.body));
  }
  function buy(ch, pi, item) {
    var p = price(ch, pi, item), k = purse(ch, pi); if (p == null || ch.money[k] < p) return false;
    ch.money[k] -= p; var car = ch.cars[pi];
    if (item.indexOf('body') === 0) { car.body = +item.slice(4); UPG.forEach(function (u) { car.up[u] = Math.max(1, car.up[u] - 1); }); }   // новый корпус — ступени на одну ниже
    else car.up[item]++;
    return true;
  }
  function trackOf(ch) { return ch.league * RACES + ch.race; }
  function raceOpts(ch) {
    return { track: trackOf(ch), players: ch.players, humans: ch.cars.map(function (c) { return JSON.parse(JSON.stringify(c)); }),
      rivals: RIVALS.map(function (r, i) { return { ch: i, cfg: rivalCfg(ch.league, i) }; }), pace: PACE[ch.league], laps: LAPS, team: ch.team };
  }
  // Итог заезда → призы, очки, переход по лигам. results — из Game (place, human, ch, kills).
  function applyRace(ch, results) {
    var mult = LEAGUE_MULT[ch.league], out = { prizes: [], league: ch.league, race: ch.race, leagueEnd: false, qualified: null, champion: false, lost: false, standings: null };
    results.forEach(function (r) {
      var key = r.human >= 0 ? 'p' + (r.human + 1) : RIVALS[r.ch].id, pts = POINTS[r.place - 1] || 0;
      var prize = r.human >= 0 ? Math.round((PRIZE[r.place - 1] || 0) * mult) + r.kills * KILL_BONUS : 0;
      ch.pts[key] = (ch.pts[key] || 0) + pts;
      if (r.human >= 0) { ch.money[purse(ch, r.human)] += prize; ch.total += prize; }
      out.prizes.push({ key: key, human: r.human, place: r.place, points: pts, prize: prize, kills: r.kills });
    });
    ch.log.push({ t: trackOf(ch), places: results.filter(function (r) { return r.human >= 0; }).map(function (r) { return r.place; }) });
    if (ch.log.length > 40) ch.log.shift();
    ch.race++;
    if (ch.race >= RACES) {
      out.leagueEnd = true; out.standings = standings(ch);
      var q = out.standings.slice(0, 3).some(function (s) { return s.key === 'p1' || s.key === 'p2'; });
      out.qualified = q;
      if (q) {
        ch.league++; ch.race = 0; ch.pts = {}; ch.tries = 0;
        if (ch.league >= LEAGUES) { ch.done = 'win'; out.champion = true; ch.money[0] += CHAMP_BONUS; ch.total += CHAMP_BONUS; ch.league = LEAGUES - 1; ch.race = RACES; }
      } else {
        ch.tries++; ch.race = 0; ch.pts = {};
        if (ch.tries > MAX_TRIES) { ch.done = 'lose'; out.lost = true; }
      }
    }
    return out;
  }
  function standings(ch) {
    var keys = RIVALS.map(function (r) { return r.id; }).concat(ch.cars.map(function (c, i) { return 'p' + (i + 1); }));
    return keys.map(function (k) { return { key: k, pts: ch.pts[k] || 0 }; }).sort(function (a, b) { return b.pts - a.pts || (a.key < b.key ? -1 : 1); });
  }
  function serialize(ch) { return JSON.stringify(ch); }
  function load(str) {
    try {
      var o = JSON.parse(str);
      if (!o || o.v !== 1 || !Array.isArray(o.money) || !Array.isArray(o.cars) || !o.cars.length || o.cars.length > 2) return null;
      if (!(o.league >= 0 && o.league < LEAGUES) || !(o.race >= 0 && o.race <= RACES)) return null;
      if (o.money.some(function (m) { return typeof m !== 'number' || m < 0 || !isFinite(m); })) return null;
      for (var i = 0; i < o.cars.length; i++) {
        var c = o.cars[i]; if (!c || !BODIES[c.body] || !c.up) return null;
        for (var k = 0; k < UPG.length; k++) { var t = c.up[UPG[k]]; if (!(t >= 1 && t <= TIERS)) return null; }
        if (c.rear !== 'oil' && c.rear !== 'mine') c.rear = 'oil';
      }
      o.pts = o.pts || {}; o.log = o.log || []; o.total = o.total || 0;
      return o;
    } catch (e) { return null; }
  }

  T.logic = {
    W: W, H: H, HUD: HUD, VIEW: VIEW, U: U, DS: DS, LAPS: LAPS, CAR_R: CAR_R, COUNT_T: COUNT_T, CUT_T: CUT_T, END_T: END_T, RAMP: RAMP, TRENCH: TRENCH,
    BODIES: BODIES, UPG: UPG, TIERS: TIERS, UPG_PRICE: UPG_PRICE, PRIZE: PRIZE, POINTS: POINTS, RIVALS: RIVALS, HUMANS: HUMANS, PACE: PACE,
    TRACKS: TRACKS, SETTINGS: SETTINGS, BIND: BIND, LEAGUES: LEAGUES, RACES: RACES, START_MONEY: START_MONEY, KILL_BONUS: KILL_BONUS, MAX_TRIES: MAX_TRIES,
    buildTrack: buildTrack, checkTrack: checkTrack, nearest: nearest, local: local, stats: stats, defCfg: defCfg, rivalCfg: rivalCfg,
    mulberry32: mulberry32, wrapA: wrapA, clamp: clamp
  };
  T.champ = { newChamp: newChamp, price: price, buy: buy, raceOpts: raceOpts, applyRace: applyRace, standings: standings, serialize: serialize, load: load, purse: purse, trackOf: trackOf };
  T.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
