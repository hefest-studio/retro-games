/* ОСКОЛОК · уровни. Шесть залов заброшенной стекловарни; карта собирается кистью B из готовых «мотивов» (яма, уступ, стеклянная стена…).
   Знаки карты: '.' пусто, '#' камень (герой и осколок упираются), 'g' стекло (герой упирается, осколок проходит насквозь),
   '^' острые стекляшки (урон), 'P' старт, 'X' дверь горна (выход), 'o' бусина, 'h' сердечко, 'k' лампа-отметка,
   'e' ползун (ходит по полу), 'b' мотылёк (летает), 't'/'T' лампа-стрелок (смотрит влево/вправо).
   OSKOLOK.LEVELS[i] = { key, W, H, map[H строк × W], zones[{x0,x1,k}] — места подсказок первого зала }. */
(function (global) {
  'use strict';
  var O = global.OSKOLOK = global.OSKOLOK || {};
  var GR = 16;   // верх пола обычных залов (ряд); зал высотой 20
  function Brush(W, H) {
    var g = [], r, c;
    for (r = 0; r < H; r++) { g.push([]); for (c = 0; c < W; c++) g[r].push('.'); }
    var B = {
      W: W, H: H, g: g,
      put: function (c, r, ch) { if (c >= 0 && c < W && r >= 0 && r < H) g[r][c] = ch; return B; },
      fill: function (c0, r0, c1, r1, ch) { for (var rr = r0; rr <= r1; rr++) for (var cc = c0; cc <= c1; cc++) B.put(cc, rr, ch); return B; },
      frame: function () { B.fill(0, 0, W - 1, 1, '#').fill(0, 0, 0, H - 1, '#').fill(W - 1, 0, W - 1, H - 1, '#'); return B; },
      ground: function (c0, c1, top) { B.fill(c0, top == null ? GR : top, c1, H - 1, '#'); return B; },
      pit: function (c0, c1) { B.fill(c0, GR, c1, H - 1, '.'); B.fill(c0, H - 1, c1, H - 1, '^'); return B; },   // яма: на дне — стекляшки
      dip: function (c0, c1) { B.fill(c0, GR, c1, GR, '^'); return B; },                                          // мелкий ров со стекляшками (дно на ряд ниже)
      ledge: function (c0, c1, top) { B.fill(c0, top, c1, GR - 1, '#'); return B; },                              // уступ с пола
      slab: function (c0, c1, top, th) { B.fill(c0, top, c1, top + (th || 2) - 1, '#'); return B; },              // плавающая плита
      pane: function (c, r0, r1) { B.fill(c, 2, c, r0 - 1, '#').fill(c, r0, c, r1, 'g'); return B; },              // стеклянная стена от потолка до r1
      wall: function (c, r0, r1) { B.fill(c, r0, c, r1, '#'); return B; },
      ceil: function (c0, c1, r1) { B.fill(c0, 2, c1, r1, '#'); return B; },
      spikes: function (c0, c1, r) { B.fill(c0, r, c1, r, '^'); return B; },
      beads: function (pts) { pts.forEach(function (p) { B.put(p[0], p[1], 'o'); }); return B; },
      mob: function (ch, c, r) { return B.put(c, r, ch); },
      out: function () { return g.map(function (row) { return row.join(''); }); }
    };
    return B;
  }
  O.Brush = Brush;
  var LV = [];
  // ---------- 1. Двор (обучение): яма, высокий уступ, стеклянная стена ----------
  (function () {
    var B = Brush(60, 20).frame().ground(1, 58).pit(15, 21).ledge(30, 37, 12).pane(45, 2, 15);
    B.mob('P', 3, 15).mob('X', 56, 15).mob('X', 56, 14).mob('k', 25, 15);
    B.beads([[6, 15], [8, 15], [17, 12], [19, 12], [26, 15], [28, 15], [33, 11], [35, 11], [41, 15], [48, 15], [51, 15], [53, 15]]);
    LV.push({ key: 'yard', W: 60, H: 20, map: B.out(),
      zones: [{ x0: 4, x1: 13.5, k: 'tutThrow' }, { x0: 22, x1: 29.5, k: 'tutUp' }, { x0: 38, x1: 44.5, k: 'tutGlass' }] });
  })();
  // ---------- 2. Цех: рвы, ползуны, лампа-стрелок за стеклом ----------
  (function () {
    var B = Brush(78, 20).frame().ground(1, 76).pit(10, 18).ledge(31, 36, 13).pane(41, 2, 15).pit(51, 58).ledge(64, 68, 12).dip(70, 72);
    B.mob('P', 3, 15).mob('X', 75, 15).mob('X', 75, 14).mob('k', 21, 15).mob('k', 47, 15);
    B.mob('e', 25, 15).mob('T', 44, 15).mob('e', 46, 15).mob('e', 61, 15).mob('b', 66, 9).mob('e', 73, 15);
    B.beads([[5, 15], [7, 15], [14, 13], [22, 15], [24, 15], [33, 12], [35, 12], [49, 15], [54, 12], [56, 12], [66, 11], [69, 15], [71, 14]]);
    B.mob('h', 34, 12);
    LV.push({ key: 'works', W: 78, H: 20, map: B.out(), zones: [] });
  })();
  // ---------- 3. Башня: подъём плитами по зигзагу (диагональный бросок вверх), мотыльки ----------
  (function () {
    var W = 36, H = 40, B = Brush(W, H).frame().fill(1, 36, W - 2, H - 1, '#');
    B.slab(21, 34, 32).slab(1, 18, 28).slab(21, 34, 24).slab(1, 18, 20).slab(21, 34, 16).slab(1, 18, 12).slab(21, 34, 8);
    B.spikes(8, 12, 27).spikes(25, 29, 23).spikes(5, 9, 19).spikes(26, 30, 15);
    B.mob('P', 3, 35).mob('k', 26, 31).mob('k', 4, 11).mob('X', 33, 7).mob('X', 33, 6);
    B.mob('b', 19, 30).mob('b', 19, 22).mob('b', 19, 14).mob('e', 12, 27).mob('e', 15, 19).mob('e', 28, 31);
    B.beads([[8, 35], [12, 35], [24, 31], [28, 31], [4, 27], [14, 27], [24, 23], [4, 19], [24, 15], [30, 7], [5, 11], [10, 11]]);
    B.mob('h', 14, 11);
    LV.push({ key: 'tower', W: W, H: H, map: B.out(), zones: [] });
  })();
  // ---------- 4. Горячий цех: лампы-стрелки, стеклянные стены, рвы ----------
  (function () {
    var B = Brush(96, 20).frame().ground(1, 94).pit(11, 19).ledge(25, 29, 12).pane(34, 2, 15).dip(40, 49).ledge(56, 62, 13).pane(66, 2, 15).pit(70, 77).ledge(83, 87, 12);
    B.mob('P', 3, 15).mob('X', 93, 15).mob('X', 93, 14).mob('k', 23, 15).mob('k', 52, 15).mob('k', 80, 15);
    B.mob('t', 33, 15).mob('T', 38, 15).mob('e', 44, 15).mob('t', 52, 12).mob('b', 60, 8).mob('T', 69, 15).mob('e', 73, 12).mob('e', 90, 15).mob('t', 79, 15).mob('b', 85, 8);
    B.beads([[6, 15], [15, 12], [27, 11], [36, 15], [44, 14], [58, 12], [64, 15], [74, 13], [85, 11], [89, 15], [91, 15]]);
    B.mob('h', 27, 11);
    LV.push({ key: 'hot', W: 96, H: 20, map: B.out(), zones: [] });
  })();
  // ---------- 5. Теплица: цепочка стеклянных камер; враги видны сквозь стекло ----------
  (function () {
    var B = Brush(96, 20).frame().ground(1, 94).pane(14, 2, 15).pane(24, 2, 15).ledge(31, 35, 13).pane(40, 2, 15).pit(46, 53).pane(58, 2, 15).ceil(62, 72, 12).pane(73, 2, 15).pane(82, 2, 15);
    B.mob('P', 3, 15).mob('X', 93, 15).mob('X', 93, 14).mob('k', 20, 15).mob('k', 44, 15).mob('k', 76, 15);
    B.mob('e', 18, 15).mob('b', 19, 11).mob('e', 28, 15).mob('T', 38, 15).mob('e', 43, 15).mob('b', 50, 9).mob('e', 55, 15).mob('e', 67, 15).mob('t', 71, 15).mob('e', 78, 15).mob('b', 79, 10).mob('e', 87, 15).mob('T', 80, 15);
    B.beads([[6, 15], [10, 15], [17, 15], [20, 12], [27, 15], [33, 12], [43, 14], [49, 12], [56, 15], [66, 15], [76, 14], [86, 15]]);
    B.mob('h', 33, 12);
    LV.push({ key: 'glasshouse', W: 96, H: 20, map: B.out(), zones: [] });
  })();
  // ---------- 6. Большой горн: всё вместе ----------
  (function () {
    var B = Brush(116, 20).frame().ground(1, 114).pit(10, 17).ledge(23, 27, 12).pane(32, 2, 15).dip(38, 47).pane(53, 2, 15).ledge(60, 66, 12).pit(70, 79).ledge(84, 88, 13).pane(92, 2, 15).pit(96, 104).ledge(109, 112, 12);
    B.mob('P', 3, 15).mob('X', 113, 15).mob('X', 113, 14).mob('k', 21, 15).mob('k', 50, 15).mob('k', 82, 15);
    B.mob('e', 30, 15).mob('T', 36, 15).mob('b', 44, 9).mob('t', 56, 15).mob('e', 57, 15).mob('b', 65, 8).mob('e', 75, 11).mob('t', 90, 12).mob('T', 94, 15).mob('e', 100, 15).mob('b', 101, 9).mob('e', 106, 15);
    B.beads([[5, 15], [13, 12], [25, 11], [35, 15], [42, 14], [62, 11], [74, 13], [86, 12], [98, 12], [110, 11]]);
    B.mob('h', 26, 11).mob('h', 85, 12);
    LV.push({ key: 'furnace', W: 116, H: 20, map: B.out(), zones: [] });
  })();
  O.LEVELS = LV;
  O.KEYS = LV.map(function (l) { return l.key; });
})(typeof window !== 'undefined' ? window : globalThis);
