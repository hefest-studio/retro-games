/* ЛАЗУТЧИК · map.js — Ржавый Арсенал: связный комплекс из экранов (флип-скрин) на одной общей карте клеток.
   Комплекс — сетка 12×6 экранов (62 существуют), экран — 20×10 клеток по 32 px. Пол экрана — ряд 9, потолок — ряд 0,
   внутри — ряды 1..8 (герой ростом ~1,75 клетки). Связи: проходы по полу между соседями (или стена / цветная дверь /
   решётка с рычагом / створка тревоги), лестницы сквозь перекрытие, лифт (площадки на этажах), люки-сбросы (вниз,
   один путь), дрезина по канализации. Мостки (ряд 5) с лесенкой. Ящики и прочие укрытия дают тень.
   LZ.MAP.build(diff) → карта (детерминированно). Константы клеток — LZ.MAP.C. */
(function (global) {
  'use strict';
  var LZ = global.LZ = global.LZ || {};
  var T = 32, SW = 20, SH = 10, CX = 12, CY = 6, W = SW * CX, H = SH * CY;
  // клетки: E пусто, S твердь, L лестница, H люк (закрыт — пол), D цветная дверь, G створка тревоги, V площадка лифта, O решётка с рычагом
  var C = { E: 0, S: 1, L: 2, H: 3, D: 4, G: 5, V: 6, O: 7 };

  // экраны: буква — зона, '.' — скала
  var ROWS = [
    '....RRRRRR..',   // 0 крыша
    'WWWWWWOOOOOO',   // 1 антресоли склада · контора
    'KKKKCCCCCCCC',   // 2 нижний склад · цеха
    'MMMAAAAABBB.',   // 3 шахты · сборочный цех · котельная
    'MMMM..FFTTTT',   // 4 шахты · литейка · машинный зал
    'SSSSSSSSSSS.'    // 5 канализация
  ];
  var ZONES = { R: 'roof', W: 'loft', O: 'office', K: 'store', C: 'shop', M: 'mine', A: 'assembly', B: 'boiler', F: 'foundry', T: 'engine', S: 'sewer' };
  var DARK = { roof: 1, mine: 1, sewer: 1, store: 1, loft: 0, office: 0, shop: 0, assembly: 0, boiler: 0, foundry: 0, engine: 0 };
  var CATP = { loft: 0.8, store: 0.5, shop: 0.55, assembly: 0.5, boiler: 0.45, engine: 0.4, office: 0.25 };
  var COVER = { roof: 'vent', loft: 'crate', office: 'cabinet', store: 'crate', shop: 'crate', mine: 'cart', assembly: 'crate', boiler: 'coal', foundry: 'mold', engine: 'casing', sewer: 'barrel' };

  // стены между (X,Y) и (X+1,Y): цвет двери, 'grate' (рычаг с восточной стороны), 'shutter' (закрывается по тревоге), 'wall'
  var LINKS = { '3,2': 'red', '5,1': 'blue', '10,1': 'yellow', '1,5': 'grate', '2,3': 'wall', '4,2': 'shutter', '8,2': 'shutter', '5,3': 'shutter', '9,4': 'shutter', '7,4': 'wall' };
  // лестницы [X, Yверх, колонка]: от пола экрана (X,Y) вниз до пола (X,Y+1)
  var LADDERS = [[1, 4, 4], [2, 3, 12], [0, 3, 5], [0, 2, 8], [3, 1, 6], [1, 1, 15], [6, 2, 5], [10, 2, 6], [4, 2, 14], [7, 3, 4], [7, 0, 10], [9, 0, 4], [8, 3, 14]];
  // люки-сбросы [X, Y, колонка]: в полу экрана (X,Y) → падение в (X,Y+1)
  var HATCHES = [[11, 1, 15], [8, 4, 5]];
  // лифты: колонка шахты (2 клетки) и этажи-остановки
  var LIFTS = [{ X: 9, c: 9, stops: [2, 3, 4] }];
  // дрезина: станции [X, колонка] в канализации
  var CART = { Y: 5, a: [2, 6], b: [8, 12] };
  // явные мостки 'X,Y': [от, до, колонка лесенки]
  var CATS = { '1,1': [3, 11, 3], '4,1': [5, 14, 14], '9,1': [12, 17, 17], '6,3': [8, 15, 15], '10,4': [3, 9, 3], '2,2': [9, 16, 16] };
  var START = [0, 5, 6], EXIT_C = 3, MATRIX = [11, 1, 11], PLANT = [11, 4, 12];
  var CARDS = [['red', 1, 1, 8, 'c'], ['blue', 5, 3, 10, 'f'], ['yellow', 9, 0, 15, 'f']];
  var THERMOS = [[0, 4, 15], [2, 2, 4], [7, 2, 4], [9, 3, 4], [8, 0, 14], [10, 1, 4], [6, 4, 14], [10, 5, 10], [3, 3, 8], [4, 1, 17], [2, 4, 16]];
  var THROW = [[0, 5, 9, 'brick'], [1, 4, 8, 'wrench'], [0, 4, 10, 'brick'], [2, 3, 6, 'crowbar'], [0, 2, 4, 'brick'], [2, 2, 6, 'washer'],
    [1, 1, 17, 'wrench'], [4, 1, 3, 'brick'], [4, 2, 4, 'wrench'], [6, 2, 12, 'washer'], [8, 2, 4, 'brick'], [10, 2, 12, 'crowbar'],
    [4, 3, 4, 'brick'], [6, 3, 8, 'washer'], [9, 3, 14, 'wrench'], [7, 1, 4, 'washer'], [9, 1, 8, 'brick'], [6, 0, 12, 'brick'],
    [8, 4, 8, 'crowbar'], [10, 4, 14, 'washer'], [6, 4, 4, 'brick'], [3, 5, 8, 'brick'], [9, 5, 6, 'wrench'], [1, 3, 14, 'washer'], [3, 4, 6, 'wrench']];
  // стража [X, Y, вид, колонка, уровень f|c, с какой сложности, опции]; вид: boxer вахтёр-кулачник, heavy кочегар, thrower метальщик, dog пёс-автомат
  var GUARDS = [
    [1, 4, 'dog', 13, 'f', 2], [3, 4, 'boxer', 10, 'f', 1], [0, 3, 'boxer', 12, 'f', 2], [1, 3, 'thrower', 8, 'f', 3], [2, 4, 'boxer', 8, 'f', 4],
    [1, 2, 'boxer', 10, 'f', 1], [2, 2, 'heavy', 6, 'f', 2, { sleep: 1 }], [3, 2, 'boxer', 12, 'f', 5],
    [1, 1, 'boxer', 14, 'f', 1], [4, 1, 'thrower', 9, 'c', 2], [5, 1, 'boxer', 8, 'f', 1], [2, 1, 'dog', 10, 'f', 4],
    [4, 2, 'boxer', 10, 'f', 1], [5, 2, 'heavy', 6, 'f', 1], [7, 2, 'boxer', 12, 'f', 1], [8, 2, 'dog', 8, 'f', 2], [9, 2, 'thrower', 15, 'f', 3], [11, 2, 'boxer', 8, 'f', 2], [6, 2, 'boxer', 14, 'f', 4], [10, 2, 'heavy', 14, 'f', 5],
    [4, 3, 'boxer', 8, 'f', 2], [5, 3, 'heavy', 13, 'f', 1], [7, 3, 'thrower', 10, 'f', 2], [8, 3, 'boxer', 9, 'f', 1, { sleep: 1 }], [10, 3, 'heavy', 8, 'f', 3], [3, 3, 'dog', 12, 'f', 5],
    [6, 1, 'boxer', 10, 'f', 1], [8, 1, 'boxer', 6, 'f', 1, { sleep: 1 }], [9, 1, 'thrower', 8, 'f', 2], [10, 1, 'heavy', 12, 'f', 3], [11, 1, 'heavy', 6, 'f', 1], [7, 1, 'thrower', 14, 'f', 4],
    [5, 0, 'dog', 10, 'f', 2], [8, 0, 'boxer', 8, 'f', 1], [4, 0, 'boxer', 12, 'f', 4], [6, 0, 'thrower', 6, 'f', 5],
    [6, 4, 'heavy', 10, 'f', 2], [8, 4, 'boxer', 13, 'f', 1], [10, 4, 'boxer', 14, 'f', 1], [11, 4, 'heavy', 6, 'f', 2], [9, 4, 'dog', 5, 'f', 3], [7, 4, 'thrower', 8, 'f', 5],
    [4, 5, 'dog', 10, 'f', 1], [9, 5, 'dog', 8, 'f', 2], [6, 5, 'boxer', 8, 'f', 4], [2, 5, 'dog', 14, 'f', 5],
    // вторые стражи в экране — со «Лазутчика» и выше
    [6, 1, 'thrower', 4, 'f', 3], [5, 2, 'boxer', 3, 'f', 3], [8, 4, 'heavy', 4, 'f', 4], [4, 3, 'dog', 15, 'f', 4], [9, 1, 'boxer', 16, 'f', 4],
    [7, 2, 'dog', 4, 'f', 5], [10, 4, 'thrower', 4, 'f', 5], [1, 2, 'thrower', 4, 'f', 5], [11, 2, 'heavy', 16, 'f', 5]
  ];

  function hash(a, b, c) { var h = (a * 374761393 + b * 668265263 + (c || 0) * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function has(X, Y) { return X >= 0 && Y >= 0 && X < CX && Y < CY && ROWS[Y][X] !== '.'; }
  function zoneOf(X, Y) { return has(X, Y) ? ZONES[ROWS[Y][X]] : null; }

  function build(diff) {
    diff = Math.max(1, Math.min(5, diff | 0 || 1));
    var t = new Uint8Array(W * H).fill(C.S);
    function set(x, y, v) { if (x >= 0 && y >= 0 && x < W && y < H) t[y * W + x] = v; }
    function get(x, y) { return (x < 0 || y < 0 || x >= W || y >= H) ? C.S : t[y * W + x]; }
    var screens = [], X, Y, r, c;
    // 1) полости экранов
    for (Y = 0; Y < CY; Y++) for (X = 0; X < CX; X++) {
      if (!has(X, Y)) { screens.push(null); continue; }
      var z = zoneOf(X, Y);
      screens.push({ X: X, Y: Y, zone: z, dark: DARK[z], idx: 0 });
      for (r = (Y === 0 ? 0 : 1); r <= 8; r++) for (c = 0; c < SW; c++) set(X * SW + c, Y * SH + r, C.E);
    }
    // номер экрана в зоне (для подписи)
    var cnt = {}; screens.forEach(function (s) { if (s) { cnt[s.zone] = (cnt[s.zone] || 0) + 1; s.idx = cnt[s.zone]; } });
    // 2) стены, двери, решётки, створки
    var doors = [], grates = [], shutters = [];
    for (Y = 0; Y < CY; Y++) for (X = 0; X < CX; X++) {
      if (!has(X, Y)) continue;
      var gx0 = X * SW, fr = Y * SH + 9;
      if (!has(X - 1, Y)) for (r = Y * SH; r < fr; r++) set(gx0, r, C.S);
      if (!has(X + 1, Y)) for (r = Y * SH; r < fr; r++) set(gx0 + SW - 1, r, C.S);
      var lk = has(X - 1, Y) ? LINKS[(X - 1) + ',' + Y] : null;
      if (lk) {
        for (r = Y * SH; r < fr; r++) set(gx0, r, C.S);
        if (lk !== 'wall') {
          var code = lk === 'grate' ? C.O : lk === 'shutter' ? C.G : C.D;
          for (r = fr - 3; r < fr; r++) set(gx0, r, code);
          var rec = { tx: gx0, r0: fr - 3, r1: fr - 1, X: X, Y: Y };
          if (code === C.D) { rec.color = lk; doors.push(rec); } else if (code === C.O) grates.push(rec); else shutters.push(rec);
        }
      }
    }
    // 3) лестницы
    var ladders = [];
    LADDERS.forEach(function (L) {
      var gx = L[0] * SW + L[2], y0 = L[1] * SH + 9, y1 = (L[1] + 1) * SH + 8;
      for (r = y0; r <= y1; r++) set(gx, r, C.L);
      ladders.push({ tx: gx, r0: y0, r1: y1 });
    });
    // 4) лифты
    var lifts = [];
    LIFTS.forEach(function (Lf, i) {
      var gx = Lf.X * SW + Lf.c, top = Lf.stops[0], bot = Lf.stops[Lf.stops.length - 1];
      for (r = top * SH + 1; r <= bot * SH + 9; r++) { set(gx, r, C.E); set(gx + 1, r, C.E); }
      var stops = Lf.stops.map(function (s) { var fr = s * SH + 9; set(gx, fr, C.V); set(gx + 1, fr, C.V); return fr; });
      lifts.push({ id: i, tx: gx, x: (gx + 1) * T, stops: stops });
    });
    // 5) люки
    var hatches = HATCHES.map(function (h) { var gx = h[0] * SW + h[2], fr = h[1] * SH + 9; set(gx, fr, C.H); set(gx, (h[1] + 1) * SH, C.E); return { tx: gx, ty: fr }; });
    // 6) мостки
    var cats = [], liftCols = {}; lifts.forEach(function (l) { liftCols[l.tx] = liftCols[l.tx + 1] = 1; });
    var ladCol = {}; ladders.forEach(function (l) { for (var rr = l.r0; rr <= l.r1; rr++) ladCol[l.tx + ':' + rr] = 1; });
    function catOK(X, Y, a, b, lc) {
      for (var cc = a - 1; cc <= b + 1; cc++) {
        var gx = X * SW + cc; if (liftCols[gx]) return false;
        for (var rr = Y * SH + 1; rr <= Y * SH + 9; rr++) if (ladCol[gx + ':' + rr]) return false;
        for (rr = Y * SH + 1; rr <= Y * SH + 8; rr++) if (get(gx, rr) !== C.E) return false;
      }
      return lc === a || lc === b;
    }
    for (Y = 0; Y < CY; Y++) for (X = 0; X < CX; X++) {
      if (!has(X, Y)) continue;
      var key = X + ',' + Y, spec = CATS[key];
      if (!spec) {
        var p = CATP[zoneOf(X, Y)] || 0;
        if (hash(X, Y, 1) >= p) continue;
        var a = 3 + Math.floor(hash(X, Y, 2) * 5), b = Math.min(16, a + 5 + Math.floor(hash(X, Y, 3) * 6));
        spec = [a, b, hash(X, Y, 4) < 0.5 ? a : b];
        if (!catOK(X, Y, spec[0], spec[1], spec[2])) continue;
      }
      var cr = Y * SH + 5;
      for (c = spec[0]; c <= spec[1]; c++) set(X * SW + c, cr, C.S);
      for (r = cr; r <= Y * SH + 8; r++) set(X * SW + spec[2], r, C.L);
      cats.push({ X: X, Y: Y, a: spec[0], b: spec[1], lc: spec[2], ty: cr });
      ladders.push({ tx: X * SW + spec[2], r0: cr, r1: Y * SH + 8, cat: true });
    }
    // 7) укрытия (тень), лампы
    var covers = [], lamps = [], shadows = [], pools = [];
    for (Y = 0; Y < CY; Y++) for (X = 0; X < CX; X++) {
      if (!has(X, Y)) continue;
      var zn = zoneOf(X, Y), n = 1 + Math.floor(hash(X, Y, 5) * 2.6), used = {};
      for (var k = 0; k < n; k++) {
        var cc0 = 2 + Math.floor(hash(X, Y, 10 + k) * 15), fr2 = Y * SH + 9, okc = true;
        for (var q = cc0 - 1; q <= cc0 + 2; q++) { var gq = X * SW + q; if (used[q] || q < 1 || q > 18 || liftCols[gq] || get(gq, fr2 - 1) !== C.E || get(gq, fr2 - 2) !== C.E || get(gq, fr2) === C.H) okc = false; if (get(gq, fr2 - 1) === C.L) okc = false; }
        if (!okc) continue;
        for (q = cc0 - 1; q <= cc0 + 2; q++) used[q] = 1;
        var hgt = 1 + (hash(X, Y, 20 + k) < 0.45 ? 1 : 0);
        covers.push({ tx: X * SW + cc0, ty: fr2 - hgt, w: 2, h: hgt, kind: COVER[zn], X: X, Y: Y });
        shadows.push({ x0: (X * SW + cc0) * T - 10, x1: (X * SW + cc0 + 2) * T + 10, y: fr2 * T });
      }
      var nl = DARK[zn] ? Math.floor(hash(X, Y, 30) * 2.2) : 2;
      for (k = 0; k < nl; k++) {
        var lc = 3 + Math.floor((k + hash(X, Y, 31 + k) * 0.8) * 14 / Math.max(1, nl)) + (nl === 1 ? 4 : 0);
        var lx = (X * SW + lc) * T + 16, fy = (Y * SH + 9) * T;
        lamps.push({ x: lx, y: (Y * SH + 1) * T + (Y === 0 ? 40 : 0), fy: fy, X: X, Y: Y, dark: DARK[zn] });
        if (DARK[zn]) pools.push({ x0: lx - 78, x1: lx + 78, y: fy });
      }
    }
    // 8) предметы
    function levelY(X, Y, lv) { return (Y * SH + (lv === 'c' ? 5 : 9)) * T; }
    function cx(X, c) { return (X * SW + c) * T + 16; }
    var items = [];
    CARDS.forEach(function (cd) { items.push({ k: 'card', color: cd[0], x: cx(cd[1], cd[3]), y: levelY(cd[1], cd[2], cd[4]) }); });
    items.push({ k: 'matrix', x: cx(MATRIX[0], MATRIX[2]), y: levelY(MATRIX[0], MATRIX[1], 'f') });
    THERMOS.forEach(function (th) { items.push({ k: 'thermos', x: cx(th[0], th[2]), y: levelY(th[0], th[1], 'f') }); });
    THROW.forEach(function (tw) { items.push({ k: tw[3], x: cx(tw[0], tw[2]), y: levelY(tw[0], tw[1], 'f') }); });
    // 9) стража
    function support(x, y) { var v = get(x, y); if (v === C.S || v === C.V || v === C.H || v === C.D || v === C.O || v === C.G) return true; if (v === C.L) return get(x, y - 1) !== C.L || get(x - 1, y) === C.S || get(x + 1, y) === C.S; return false; }
    function free(x, y) { var v = get(x, y); return v === C.E || v === C.L; }
    function runOf(X, ty, c) {
      var gx = X * SW + c, lo = gx, hi = gx;
      while (lo - 1 >= X * SW && support(lo - 1, ty) && free(lo - 1, ty - 1) && free(lo - 1, ty - 2)) lo--;
      while (hi + 1 < (X + 1) * SW && support(hi + 1, ty) && free(hi + 1, ty - 1) && free(hi + 1, ty - 2)) hi++;
      return [lo * T + 14, (hi + 1) * T - 14];
    }
    var guards = [];
    GUARDS.forEach(function (g, i) {
      if (g[5] > diff) return;
      var X = g[0], Y = g[1], lv = g[4], ty = Y * SH + (lv === 'c' ? 5 : 9), col = g[3];
      if (diff >= 3 && !(g[6] && g[6].sleep) && lv === 'f') col = 19 - col;   // изменённые маршруты
      col = Math.max(1, Math.min(18, col));
      var run = runOf(X, ty, col), x = cx(X, col);
      x = Math.max(run[0], Math.min(run[1], x));
      var span = diff >= 3 ? 9 : 4 + Math.floor(hash(i, diff, 7) * 3);
      var p0 = Math.max(run[0], x - span * T / 2), p1 = Math.min(run[1], x + span * T / 2);
      guards.push({ k: g[2], x: x, y: ty * T, p0: p0, p1: p1, b0: run[0], b1: run[1], sleep: !!(g[6] && g[6].sleep), face: hash(i, 3, diff) < 0.5 ? -1 : 1, X: X, Y: Y, id: i });
    });
    var cart = { y: (CART.Y * SH + 9) * T, a: cx(CART.a[0], CART.a[1]), b: cx(CART.b[0], CART.b[1]) };
    return {
      T: T, SW: SW, SH: SH, CX: CX, CY: CY, W: W, H: H, t: t, C: C, diff: diff,
      screens: screens, doors: doors, grates: grates, shutters: shutters, ladders: ladders, lifts: lifts, hatches: hatches, cats: cats,
      covers: covers, lamps: lamps, shadows: shadows, pools: pools, items: items, guards: guards, cart: cart,
      start: { x: cx(START[0], START[2]), y: levelY(START[0], START[1], 'f') },
      exit: { x1: (START[0] * SW + EXIT_C) * T, y: levelY(START[0], START[1], 'f'), X: START[0], Y: START[1] },
      plant: { x: cx(PLANT[0], PLANT[2]), y: levelY(PLANT[0], PLANT[1], 'f') }
    };
  }
  LZ.MAP = { T: T, SW: SW, SH: SH, CX: CX, CY: CY, W: W, H: H, C: C, ROWS: ROWS, ZONES: ZONES, DARK: DARK, build: build, has: has, zoneOf: zoneOf,
    count: function () { var n = 0; ROWS.forEach(function (r) { for (var i = 0; i < r.length; i++) if (r[i] !== '.') n++; }); return n; } };
})(typeof window !== 'undefined' ? window : globalThis);
