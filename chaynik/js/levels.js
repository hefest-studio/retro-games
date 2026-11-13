/* ЧАЙНИК · levels.js — данные шести уровней (без DOM, детерминированно).
   Уровни-платформеры (1 «Кухонные джунгли», 3 «Чайная глубина», 6 «Сервиз») собираются билдером из команд:
   земля, ямы, полки, конфорки, вилки-шипы, крюки, краны, магниты, предметы, враги. Уровень 2 — трасса гонки
   (профиль скатерти + препятствия), 4 — головоломка на клетках (вид сверху), 5 — сценарий волн полёта.
   CHAYNIK.levels = { T, C, build(n), KINDS, PUZZLE, raceTrack(), FLY } */
(function (global) {
  'use strict';
  var CH = global.CHAYNIK = global.CHAYNIK || {};
  var T = 16;
  // коды клеток
  var C = { E: 0, S: 1, P: 2, F: 3, X: 4, W: 5 };   // пусто, твердь, полка (твёрда сверху), конфорка (огонь), вилки (шипы), стенка чашки (твердь, другой вид)
  // тип уровня
  var KINDS = { 1: 'plat', 2: 'race', 3: 'plat', 4: 'puzzle', 5: 'fly', 6: 'boss' };

  function Builder(w, h) {
    var t = new Uint8Array(w * h);
    var L = { w: w, h: h, t: t, hooks: [], taps: [], magnets: [], items: [], enemies: [], cps: [], bubbles: [], start: null, goal: null, signs: [], cycle: [] };
    var nid = 0;
    var B = {
      L: L,
      set: function (c, r, v) { if (c >= 0 && r >= 0 && c < w && r < h) t[r * w + c] = v; },
      fill: function (c0, r0, c1, r1, v) { for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) B.set(c, r, v); },
      ground: function (c0, c1, top) { B.fill(c0, top, c1, h - 1, C.S); },
      plat: function (c, r, n) { B.fill(c, r, c + n - 1, r, C.P); },
      burner: function (c0, c1, r, cyc) { B.fill(c0, r, c1, r, C.F); if (cyc) L.cycle.push({ c0: c0, c1: c1, r: r, per: cyc[0], on: cyc[1], ph: cyc[2] || 0 }); },
      forks: function (c0, c1, r) { B.fill(c0, r, c1, r, C.X); },
      hook: function (c, r) { L.hooks.push({ id: 'h' + (nid++), x: c * T + 8, y: r * T + 8 }); },
      tap: function (c, r, len) { L.taps.push({ id: 't' + (nid++), x: c * T + 8, y: r * T + 12, len: (len || 6) * T }); },
      magnet: function (c, r) { L.magnets.push({ id: 'm' + (nid++), x: c * T + 8, y: r * T + 8 }); },
      item: function (k, c, r) { L.items.push({ id: 'i' + (nid++), k: k, x: c * T + 8, y: r * T + 8 }); },
      row: function (k, c0, c1, r) { for (var c = c0; c <= c1; c++) B.item(k, c, r); },
      arc: function (k, c0, n, r, hgt) { for (var i = 0; i < n; i++) B.item(k, c0 + i, r - Math.round(Math.sin(i / (n - 1) * Math.PI) * hgt)); },
      enemy: function (k, c, r, o) { var e = { id: 'e' + (nid++), k: k, x: c * T + 8, y: (r + 1) * T }; if (o) for (var q in o) e[q] = o[q]; L.enemies.push(e); },
      cp: function (c, r) { L.cps.push({ id: 'c' + (nid++), x: c * T + 8, y: (r + 1) * T }); },
      bubble: function (c, r0, r1) { L.bubbles.push({ id: 'b' + (nid++), x0: c * T, x1: (c + 2) * T, y0: r0 * T, y1: (r1 + 1) * T }); },
      start: function (c, r) { L.start = { x: c * T + 8, y: (r + 1) * T }; },
      goal: function (c, r, k) { L.goal = { x: c * T + 8, y: (r + 1) * T, k: k || 'door' }; },
      sign: function (c, r, key) { L.signs.push({ x: c * T + 8, y: (r + 1) * T, key: key }); }
    };
    return B;
  }

  // ---------- Уровень 1: Кухонные джунгли (вилки-лианы, конфорки, магниты, краны) ----------
  function level1() {
    var W = 336, H = 23, G = 18, B = Builder(W, H), L = B.L;
    B.ground(0, 14, G); B.start(3, G - 1); B.sign(6, G - 1, 's_move');
    B.row('sugar', 8, 12, G - 2); B.item('leaf', 13, G - 4);
    // яма
    B.ground(18, 30, G); B.enemy('beetle', 25, G - 1); B.arc('sugar', 15, 3, G - 3, 2);
    // ступень и конфорка под крюком
    B.ground(31, 40, G - 3); B.item('leaf', 36, G - 6); B.sign(38, G - 4, 's_hook');
    B.ground(41, 49, G + 2); B.burner(41, 49, G + 1); B.hook(45, 9); B.arc('sugar', 42, 7, 10, 2);
    B.ground(50, 63, G); B.tap(54, 9, 7); B.sign(52, G - 1, 's_tap'); B.enemy('toaster', 61, G - 1);
    B.row('sugar', 56, 59, G - 2);
    // полки вверх, мухи
    B.plat(64, G - 3, 3); B.plat(68, G - 6, 3); B.plat(72, G - 9, 4); B.enemy('fly', 70, G - 10);
    B.ground(64, 66, G); B.ground(67, 82, G);
    B.fill(76, G - 9, 82, G - 1, C.S); B.item('heart', 79, G - 11); B.row('sugar', 76, 81, G - 11);
    B.ground(83, 98, G); B.cp(84, G - 1);
    // магнит на потолочной балке
    B.fill(86, 2, 95, 7, C.S); B.magnet(90, 8); B.sign(87, G - 1, 's_magnet'); B.row('sugar', 88, 92, G - 3);
    B.enemy('pea', 96, G - 1);
    // длинная яма с конфорками и двумя вилками-лианами
    B.ground(99, 113, G + 3); B.burner(99, 113, G + 2, [3.2, 1.6, 0]); B.hook(103, 9); B.hook(109, 9);
    B.arc('sugar', 101, 11, 9, 2);
    B.ground(114, 132, G); B.cp(116, G - 1); B.enemy('beetle', 121, G - 1); B.enemy('pea', 128, G - 1);
    B.item('leaf', 125, G - 5); B.tap(118, 9, 7);
    // стенка, полки и ряд вилок
    B.fill(133, G - 4, 136, G - 1, C.S); B.ground(133, 136, G);
    B.ground(137, 149, G + 1); B.forks(137, 149, G); B.plat(139, G - 6, 3); B.plat(144, G - 7, 3); B.enemy('fly', 143, G - 11);
    B.row('sugar', 139, 141, G - 8); B.row('sugar', 144, 146, G - 9);
    B.ground(150, 160, G - 4); B.ground(161, 170, G); B.enemy('toaster', 158, G - 5); B.item('heart', 165, G - 2);
    // крюк + магнит
    B.ground(171, 180, G + 3); B.burner(171, 180, G + 2); B.hook(175, 9); B.fill(180, 1, 184, 5, C.S); B.magnet(182, 6);
    B.ground(181, 200, G); B.cp(184, G - 1); B.enemy('beetle', 190, G - 1); B.enemy('fly', 196, G - 9);
    B.tap(187, 9, 7);
    B.ground(201, 204, G + 2); B.burner(201, 204, G + 1, [2.6, 1.3, 0.6]);
    B.ground(205, 222, G); B.enemy('toaster', 214, G - 1); B.enemy('pea', 220, G - 1); B.row('sugar', 208, 212, G - 2);
    // вторая половина: полки к высокому крюку, тройка крюков над вилками, финишный рывок
    B.ground(227, 240, G); B.cp(228, G - 1); B.plat(231, G - 4, 3); B.plat(235, G - 7, 3); B.enemy('beetle', 236, G - 1);
    B.ground(241, 250, G + 3); B.burner(241, 250, G + 2); B.hook(243, 7); B.item('leaf', 246, 8);
    B.fill(251, G - 6, 262, G - 1, C.S); B.ground(251, 262, G); B.row('sugar', 252, 258, G - 8); B.enemy('fly', 257, G - 11);
    B.ground(263, 272, G); B.enemy('beetle', 268, G - 1); B.item('heart', 271, G - 2);
    B.ground(273, 289, G + 1); B.forks(273, 289, G); B.hook(276, 9); B.hook(281, 9); B.hook(286, 9); B.arc('sugar', 274, 15, 11, 2);
    B.ground(290, 302, G); B.cp(291, G - 1); B.tap(294, 9, 7); B.enemy('toaster', 301, G - 1);
    B.ground(303, 308, G + 2); B.burner(303, 308, G + 1, [2.8, 1.4, 0]); B.hook(305, 9);
    B.ground(309, W - 1, G); B.enemy('pea', 314, G - 1); B.enemy('beetle', 320, G - 1); B.row('sugar', 312, 318, G - 2);
    B.goal(328, G - 1, 'hole');
    // края мира
    B.fill(0, 0, 0, H - 1, C.S); B.fill(W - 1, 0, W - 1, H - 1, C.S);
    L.bgKind = 'kitchen';
    return L;
  }

  // ---------- Уровень 3: Чайная глубина (внутри чашки; вверх на пузырях, тепло тает) ----------
  function level3() {
    var W = 40, H = 100, B = Builder(W, H), L = B.L;
    B.fill(0, 0, 1, H - 1, C.W); B.fill(38, 0, 39, H - 1, C.W); B.fill(0, 97, 39, H - 1, C.W);
    L.surface = 5 * T;   // уровень чая (выше — воздух)
    B.start(5, 96); B.sign(9, 96, 's_warm');
    // дно: кристаллы сахара, чаинка, «ёжик» из вилок
    B.row('sugar', 8, 13, 94); B.enemy('leaffish', 16, 92, { x0: 10 * T, x1: 28 * T }); B.forks(20, 24, 96);
    B.bubble(31, 76, 96); B.sign(28, 96, 's_bubble');
    // дольки лимона (полки) — вверх влево
    B.plat(24, 78, 6); B.plat(14, 74, 6); B.plat(4, 70, 6); B.item('leaf', 6, 68); B.cp(7, 69);
    B.enemy('leaffish', 16, 72, { x0: 10 * T, x1: 26 * T });
    B.bubble(2, 50, 72);
    // уступ с сахарными колючками
    B.fill(4, 50, 22, 50, C.W); B.forks(13, 17, 49); B.row('sugar', 6, 10, 48);
    B.plat(22, 46, 5); B.item('heart', 24, 44); B.enemy('leaffish', 28, 42, { x0: 22 * T, x1: 36 * T });
    B.plat(30, 42, 6); B.cp(31, 41);
    B.bubble(34, 30, 42); B.row('sugar', 34, 35, 36);
    // переправа над грядой колючек: маленькие дольки, косточки снуют вверх-вниз
    B.plat(28, 29, 5); B.fill(6, 37, 26, 37, C.W); B.forks(6, 26, 36);
    B.plat(20, 27, 3); B.plat(12, 25, 3); B.enemy('pip', 24, 32); B.enemy('pip', 16, 30); B.enemy('leaffish', 14, 21, { x0: 6 * T, x1: 24 * T });
    B.item('leaf', 13, 22); B.plat(3, 23, 6); B.cp(5, 22);
    B.bubble(10, 8, 22);
    // к плотику-дольке у края чашки
    B.plat(14, 7, 5); B.plat(22, 7, 4); B.enemy('pip', 20, 13); B.enemy('pip', 26, 12); B.row('sugar', 15, 18, 5);
    B.plat(28, 5, 9); B.goal(32, 4, 'raft');
    L.bgKind = 'tea'; L.water = true;
    return L;
  }

  // ---------- Уровень 6: Сервиз (арена с крюками под потолком) ----------
  function level6() {
    var W = 48, H = 23, G = 18, B = Builder(W, H), L = B.L;
    B.fill(0, 0, 0, H - 1, C.S); B.fill(W - 1, 0, W - 1, H - 1, C.S); B.fill(0, 0, W - 1, 2, C.S);
    B.ground(0, W - 1, G); B.start(4, G - 1);
    B.plat(2, G - 6, 6); B.plat(40, G - 6, 6);
    [8, 16, 24, 32, 40].forEach(function (c) { B.hook(c, 7); });
    B.tap(3, 4, 7); B.tap(44, 4, 7);
    L.arena = { x0: 1 * T, x1: (W - 1) * T, floor: G * T };
    L.bgKind = 'cupboard';
    return L;
  }

  // ---------- Уровень 2: гонка на сахарнице по скатерти ----------
  // Профиль трассы: y(x) — высота поверхности в px (больше — ниже). Стол накренился: общий спуск со складками.
  function raceTrack() {
    var len = 9800, step = 8, n = Math.ceil(len / step) + 80, ys = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = i * step;
      ys[i] = 200 + x * 0.045 + Math.sin(x / 260) * 26 + Math.sin(x / 97 + 1.3) * 9 + Math.max(0, Math.sin(x / 610)) * 40;
    }
    // препятствия: crumb (крошка), shaker (солонка), jam (лужица варенья), hole (прореха), spoon (ложка-трамплин),
    // tap (кап из крана — охлаждение), leaf / sugar — бонусы
    var obs = [
      { k: 'crumb', x: 700 }, { k: 'sugar', x: 820, h: 50 }, { k: 'shaker', x: 1300 }, { k: 'jam', x: 1800, w: 90 },
      { k: 'leaf', x: 1960, h: 60 }, { k: 'hole', x: 2350, w: 56 }, { k: 'crumb', x: 2900 }, { k: 'tap', x: 3000, w: 160 },
      { k: 'spoon', x: 3300 }, { k: 'sugar', x: 3460, h: 110 }, { k: 'sugar', x: 3520, h: 120 }, { k: 'shaker', x: 4100 },
      { k: 'crumb', x: 4600 }, { k: 'crumb', x: 4690 }, { k: 'hole', x: 5200, w: 64 }, { k: 'jam', x: 5650, w: 120 },
      { k: 'tap', x: 5900, w: 180 }, { k: 'shaker', x: 6250 }, { k: 'leaf', x: 6420, h: 60 }, { k: 'spoon', x: 6800 },
      { k: 'sugar', x: 6980, h: 120 }, { k: 'hole', x: 7700, w: 72 }, { k: 'crumb', x: 8100 }, { k: 'jam', x: 8450, w: 100 },
      { k: 'shaker', x: 8900 }, { k: 'hole', x: 9400, w: 60 }, { k: 'sugar', x: 9620, h: 50 }
    ];
    obs.forEach(function (o, i) { o.id = 'r' + i; o.w = o.w || ({ crumb: 14, shaker: 18, spoon: 40, sugar: 12, leaf: 12 }[o.k] || 12); });
    return { len: len, step: step, ys: ys, obs: obs,
      // соперник — перечница: «ровная» скорость по участкам (px/с) и две запинки
      rival: { v: [[0, 290], [1500, 320], [3000, 340], [4500, 330], [6000, 350], [7500, 340], [9000, 360]], trips: [[2380, 0.8], [7730, 0.8]] } };
  }

  // ---------- Уровень 4: головоломка «Спящий сахарок» (клетки, вид сверху) ----------
  // # стена (банки, хлебница) · . скатерть · , крошка (хрустит!) · o чашка (толкается) · B конфорка (горит 2 хода из 4)
  // Z будильник (наступи — выключится; иначе звенит на ходу LIMIT) · S спящий сахарок · G чашка чая (цель) · P чайник · W кран
  var PUZZLE = {
    limit: 40, burnPer: 4, burnOn: 2,
    map: [
      '################',
      '#S#....P....#.Z#',
      '#,#.####.##.#..#',
      '#,..,..o..#...##',
      '#.###.###.#.##.#',
      '#...#.B.....,,.#',
      '###.#.###.###..#',
      '#W.....,....#.G#',
      '################'
    ]
  };

  // ---------- Уровень 5: полёт на шаре из чайного пакетика (сценарий волн) ----------
  // t — секунда появления, k — тип, y — высота (0..1 экрана), n — сколько, gap — интервал, cloud — морозное облако
  var FLY = {
    len: 84, cp: 42, boss: 'swatter',
    waves: [
      { t: 2, k: 'fly', y: 0.3, n: 4, gap: 0.5 }, { t: 5, k: 'fly', y: 0.7, n: 4, gap: 0.5 }, { t: 8, k: 'leaf', y: 0.5 },
      { t: 10, k: 'moth', y: 0.2, n: 2, gap: 0.8 }, { t: 13, k: 'pop', y: 0.55, n: 2, gap: 1.2 }, { t: 15, k: 'cloud', y: 0.5 },
      { t: 17, k: 'fly', y: 0.45, n: 6, gap: 0.35 }, { t: 21, k: 'bee', y: 0.25 },
      { t: 26, k: 'moth', y: 0.8, n: 3, gap: 0.7 }, { t: 29, k: 'heart', y: 0.4 }, { t: 30, k: 'pop', y: 0.3, n: 2, gap: 1.2 },
      { t: 34, k: 'fly', y: 0.2, n: 5, gap: 0.4 }, { t: 37, k: 'fly', y: 0.8, n: 4, gap: 0.4 }, { t: 38, k: 'cloud', y: 0.3 },
      { t: 40, k: 'leaf', y: 0.6 }, { t: 44, k: 'bee', y: 0.5 }, { t: 46, k: 'moth', y: 0.15, n: 4, gap: 0.6 },
      { t: 50, k: 'pop', y: 0.7, n: 3, gap: 0.8 }, { t: 53, k: 'fly', y: 0.5, n: 8, gap: 0.3 }, { t: 56, k: 'cloud', y: 0.7 },
      { t: 58, k: 'bee', y: 0.3 }, { t: 62, k: 'moth', y: 0.5, n: 4, gap: 0.5 },
      { t: 65, k: 'heart', y: 0.6 }, { t: 66, k: 'pop', y: 0.4, n: 4, gap: 0.7 }, { t: 70, k: 'fly', y: 0.35, n: 6, gap: 0.3 },
      { t: 72, k: 'leaf', y: 0.5 }, { t: 74, k: 'cloud', y: 0.45 }, { t: 76, k: 'leaf', y: 0.3 }
    ]
  };

  var cache = {};
  function build(n) {
    if (cache[n]) return cache[n];
    var L = n === 1 ? level1() : n === 3 ? level3() : n === 6 ? level6() : null;
    if (L) { L.n = n; L.kind = KINDS[n]; }
    cache[n] = L; return L;
  }

  CH.levels = { T: T, C: C, KINDS: KINDS, COUNT: 6, build: build, raceTrack: raceTrack, PUZZLE: PUZZLE, FLY: FLY };
})(typeof window !== 'undefined' ? window : globalThis);
