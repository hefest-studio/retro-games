/* ЦЕПЬ · этажи башни Остановленных Часов и сборка карт.
   Карта рисуется «кистью» (paint-API ниже) в сетку символов, затем собирается в типизированный массив.
   Символы клеток:
     ' ' пусто · '#' кладка/литьё (твердь) · '=' балка (только сверху) · '/' '\' ступени лестницы (наискось; не твердь)
     '*' зубчатка-пила (ранит) · фонари-лампы (разбиваются цепью): i искра, I пять искр, k ключ, f склянка, g шестерня,
     s пружина, p стоп-маятник, c звено цепи (апгрейд), h маслёнка (здоровье), m латунный жетон (очки)
     враги: T тикун, Y моль (гнездо), R маслёнщик, J попрыгун, G часовой
     @ старт · C отметка (возрождение) · | ворота арены (колонна) · B место стража · 1 2 двери развилки (после стража 3-го этажа)
   Лестница P.st(x, y, n, dir): нижняя точка (x, y) — угол клетки на поверхности пола; dir = +1 — вверх вправо, −1 — вверх влево;
     ступени — клетки (x+i, y−1−i) или (x−1−i, y−1−i); верхняя точка (x + dir·n, y − n) — там должен начинаться пол.
   Подвижные опоры (порядок — как вызваны): P.pend(px, py, len, amp, per, ph, from, to) — маятник-площадка: ось (px, py),
     площадка шириной 2.4 на расстоянии len, угол amp·sin(2πt/per + ph); P.lift(x, y, w, h, per, ph, from, to) — шестерня-подъёмник
     шириной w, верх — от y (низ) до y − h. from/to — [колонка, поверхность] опор по краям (для графа проходимости и бота).
   Маршрут: этажи 1–3 общие, после стража 3-го этажа — две двери: «1» → Ход шестерён → Зал маховиков, «2» → Колокольная галерея →
   Звонница; 6-й этаж — Часовое Сердце. */
(function (global) {
  'use strict';
  var T = global.TSEP = global.TSEP || {};
  var E = 0, SOL = 1, ONE = 2, STR = 3, STL = 4, SAW = 5;
  T.TILES = { E: E, SOL: SOL, ONE: ONE, STR: STR, STL: STL, SAW: SAW };
  var LAMPS = { i: 'spark', I: 'spark5', k: 'key', f: 'flask', g: 'gear', s: 'spring', p: 'stopper', c: 'chain', h: 'oil', m: 'token' };
  var FOES = { T: 'tick', Y: 'moth', R: 'oiler', J: 'springer', G: 'guard' };
  T.LAMPS = LAMPS; T.FOES = FOES;

  function Painter(w, h) {
    var g = []; for (var r = 0; r < h; r++) { g.push(new Array(w).fill(' ')); }
    var mov = [];
    var P = {
      w: w, h: h, g: g, mov: mov,
      put: function (x, y, ch) { if (x < 0 || y < 0 || x >= w || y >= h) throw new Error('вне карты ' + x + ',' + y); g[y][x] = ch; return P; },
      fill: function (x0, y0, x1, y1, ch) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) P.put(x, y, ch); return P; },
      ground: function (x0, x1, y) { return P.fill(x0, y, x1, h - 1, '#'); },
      ceil: function (x0, x1, y) { return P.fill(x0, 0, x1, y, '#'); },
      clear: function (x0, y0, x1, y1) { return P.fill(x0, y0, x1, y1, ' '); },
      girder: function (x0, x1, y) { return P.fill(x0, y, x1, y, '='); },
      st: function (x, y, n, dir) { for (var i = 0; i < n; i++) P.put(dir > 0 ? x + i : x - 1 - i, y - 1 - i, dir > 0 ? '/' : '\\'); return P; },
      pend: function (px, py, len, amp, per, ph, from, to) { mov.push({ kind: 'pend', px: px, py: py, len: len, amp: amp, per: per, ph: ph || 0, w: 2.4, from: from, to: to }); return P; },
      lift: function (x, y, w2, hh, per, ph, from, to) { mov.push({ kind: 'lift', x: x, y: y, w: w2, h: hh, per: per, ph: ph || 0, from: from, to: to }); return P; }
    };
    return P;
  }

  // ---------- этажи ----------
  // key, boss, theme, w, h, arena:{x (колонна ворот), y (верхний ряд вида арены)}, paint(P)
  T.FLOORS = {
    works: { key: 'works', boss: 'cuckoo', bhp: 10, w: 132, h: 16, arena: { x: 100, y: 0 }, paint: function (P) {
      P.ceil(0, 131, 1); P.fill(0, 0, 0, 15, '#');
      P.ground(1, 12, 13); P.put(3, 12, '@');
      P.put(6, 11, 'i').put(10, 11, 'k').put(9, 12, 'T');
      // пролом 13..14
      P.ground(15, 44, 13);
      P.put(18, 11, 'i').st(22, 13, 4, 1).fill(26, 9, 36, 10, '#');
      P.put(30, 7, 'c').put(34, 8, 'J').put(41, 11, 'i').put(39, 12, 'T');
      // пролом 45..46
      P.ground(47, 56, 13).fill(55, 11, 56, 12, '#');
      P.put(50, 11, 'i').put(52, 12, 'R');
      // маятник над пропастью 57..66
      P.pend(62, 2.5, 8.6, 0.42, 3.4, 0, [56, 11], [67, 11]);
      P.ground(67, 68, 11).ground(69, 86, 13);
      P.put(71, 12, 'C').put(73, 11, 'I').put(80, 12, 'G').put(77, 11, 'i');
      P.st(84, 13, 3, 1).ground(87, 99, 10);
      P.put(91, 8, 'h').put(95, 6, 'Y');
      // арена
      P.ground(100, 131, 13).fill(131, 0, 131, 15, '#').put(100, 12, '|');
      P.girder(104, 107, 11).girder(124, 127, 11);
      P.put(115, 6, 'B');
    } },
    pendulum: { key: 'pendulum', boss: 'pendulum', bhp: 16, w: 140, h: 16, arena: { x: 108, y: 0 }, paint: function (P) {
      P.ceil(0, 139, 1); P.fill(0, 0, 0, 15, '#');
      P.ground(1, 24, 13); P.put(3, 12, '@');
      P.st(8, 13, 4, 1).girder(12, 22, 9);
      P.put(5, 11, 'i').put(16, 7, 's').put(20, 7, 'i').put(18, 12, 'T').put(21, 8, 'J');
      // пролом 25..26
      P.ground(27, 34, 13).fill(33, 11, 34, 12, '#');
      P.put(30, 11, 'i').put(29, 12, 'T');
      P.pend(40, 2.5, 8.6, 0.42, 3.2, 0, [34, 11], [45, 11]);
      P.ground(45, 46, 11).ground(47, 60, 13).fill(59, 11, 60, 12, '#');
      P.put(51, 12, '*').put(49, 11, 'i').put(55, 12, 'R').put(57, 11, 'I');
      P.pend(66, 2.5, 8.6, 0.42, 3.6, 1.2, [60, 11], [71, 11]);
      P.ground(71, 72, 11).ground(73, 92, 13);
      P.put(75, 12, 'C').put(78, 11, 'h').put(83, 12, 'G').put(88, 7, 'Y').put(86, 11, 'i');
      P.st(90, 13, 3, 1).ground(93, 99, 10).put(96, 8, 'c');
      // пролом 100..101, затем уступ к арене
      P.ground(102, 107, 11).put(104, 9, 'i');
      P.ground(108, 139, 13).fill(139, 0, 139, 15, '#').put(108, 12, '|');
      P.put(123, 5, 'B');
    } },
    springs: { key: 'springs', boss: 'drake', bhp: 18, w: 100, h: 30, arena: { x: 68, y: 0 }, branch: true, paint: function (P) {
      P.fill(0, 0, 0, 29, '#').ceil(0, 99, 1).ground(1, 46, 27);
      P.put(3, 26, '@').put(7, 25, 'i').put(14, 26, 'T').put(25, 25, 'm').put(38, 25, 'I').put(33, 26, 'J');
      P.st(12, 27, 5, 1).girder(17, 27, 22);
      P.put(21, 20, 'f').put(24, 21, 'T');
      P.lift(28, 22, 3, 7, 4.0, 0, [27, 22], [31, 15]);
      P.fill(31, 15, 46, 16, '#').fill(47, 13, 47, 29, '#');
      P.put(34, 13, 'c').put(37, 14, 'J').put(32, 13, 'i');
      P.st(40, 15, 4, 1).fill(44, 11, 58, 12, '#').fill(48, 13, 58, 29, '#');
      P.put(48, 10, 'C').put(52, 9, 'i').put(55, 7, 'Y').put(57, 10, 'R');
      // смертельный пролом 59..60
      P.ground(61, 67, 13).put(65, 11, 'h');
      P.ground(68, 99, 13).fill(99, 0, 99, 29, '#').put(68, 12, '|');
      P.put(84, 9, 'B').put(72, 12, '1').put(95, 12, '2');
    } },
    gears: { key: 'gears', boss: 'spider', bhp: 20, w: 140, h: 16, arena: { x: 108, y: 0 }, paint: function (P) {
      P.ceil(0, 139, 1); P.fill(0, 0, 0, 15, '#');
      P.ground(1, 16, 13); P.put(3, 12, '@').put(7, 11, 'i').put(12, 12, 'T');
      P.lift(17, 13, 3, 4, 3.6, 0, [16, 13], [20, 9]);
      P.ground(20, 33, 9).put(24, 8, '*').put(29, 7, 'g').put(31, 8, 'J');
      P.lift(34, 13, 3, 4, 3.2, 1.5, [33, 9], [37, 11]);
      P.ground(37, 50, 11).put(41, 10, 'R').put(44, 9, 'i').put(47, 7, 'Y');
      P.ground(53, 62, 13).put(56, 12, 'C').put(58, 11, 'I').put(60, 12, 'T');
      P.fill(61, 11, 62, 12, '#');
      P.pend(68, 2.5, 8.6, 0.42, 3.4, 0.6, [62, 11], [73, 11]);
      P.ground(73, 74, 11).ground(75, 90, 13).put(80, 12, '*').put(84, 12, 'G').put(87, 11, 'h');
      P.lift(91, 13, 3, 3, 3.0, 0, [90, 13], [94, 10]);
      P.ground(94, 107, 10).put(97, 8, 'c').put(102, 8, 'i').put(104, 9, 'J');
      P.ground(108, 139, 13).fill(139, 0, 139, 15, '#').put(108, 12, '|');
      P.girder(112, 115, 11).girder(132, 135, 11);
      P.put(123, 3, 'B');
    } },
    flywheel: { key: 'flywheel', boss: 'flywheel', bhp: 18, w: 140, h: 16, arena: { x: 108, y: 0 }, paint: function (P) {
      P.ceil(0, 139, 1); P.fill(0, 0, 0, 15, '#');
      P.ground(1, 20, 13); P.put(3, 12, '@').put(8, 11, 'I').put(11, 12, 'J');
      P.st(14, 13, 4, 1).ground(18, 27, 9).put(22, 7, 'p').put(25, 8, 'T');
      P.pend(33, 2.0, 7.6, 0.5, 3.2, 0, [27, 9], [39, 9]);
      P.ground(39, 46, 9).put(42, 7, 'i').put(44, 8, 'R');
      P.lift(47, 13, 3, 4, 3.4, 0.8, [46, 9], [50, 11]);
      P.ground(50, 64, 11).put(53, 10, 'C').put(56, 9, 'h').put(60, 10, 'G').put(62, 7, 'Y');
      P.pend(70, 2.5, 8.6, 0.42, 3.0, 2.0, [64, 11], [75, 11]);
      P.ground(75, 80, 11).ground(81, 96, 13).put(85, 12, '*').put(90, 12, 'T').put(92, 11, 'i').put(88, 12, 'J');
      P.st(93, 13, 3, 1).ground(96, 107, 10).put(100, 8, 'c').put(104, 8, 'i');
      P.ground(108, 139, 13).fill(139, 0, 139, 15, '#').put(108, 12, '|');
      P.put(124, 12, 'B');
    } },
    gallery: { key: 'gallery', boss: 'bellows', bhp: 16, w: 140, h: 16, arena: { x: 108, y: 0 }, open: true, paint: function (P) {
      P.fill(0, 0, 0, 15, '#');
      P.ground(1, 14, 12); P.put(3, 11, '@').put(8, 10, 'i').put(12, 11, 'T');
      P.ground(17, 24, 12).put(20, 10, 'f').put(23, 8, 'Y');
      P.ground(27, 32, 11).put(30, 9, 'i');
      P.ground(35, 46, 12).put(38, 11, 'J').put(42, 10, 'I').put(45, 11, 'T');
      P.pend(52, 2.0, 7.8, 0.42, 3.2, 0.4, [46, 12], [57, 11]);
      P.ground(57, 58, 11).ground(59, 70, 12).put(61, 11, 'C').put(64, 10, 'h').put(68, 11, 'R');
      P.girder(72, 76, 10).ground(79, 84, 12).put(74, 8, 'i').put(81, 11, 'G').put(77, 6, 'Y');
      P.ground(87, 92, 11).put(90, 9, 'c');
      P.ground(95, 107, 12).put(98, 11, 'T').put(102, 10, 'i').put(105, 11, 'J');
      P.ground(108, 139, 13).fill(139, 0, 139, 15, '#').put(108, 12, '|');
      P.put(130, 12, 'B');
    } },
    belfry: { key: 'belfry', boss: 'ringer', bhp: 22, w: 100, h: 30, arena: { x: 68, y: 0 }, paint: function (P) {
      P.fill(0, 0, 0, 29, '#').ceil(0, 99, 1).ground(1, 36, 27);
      P.put(3, 26, '@').put(8, 25, 'i').put(14, 26, 'T').put(11, 22, 'Y').put(30, 25, 'm');
      P.st(20, 27, 5, 1).fill(25, 22, 36, 23, '#');
      P.put(28, 20, 'k').put(35, 21, 'J');
      P.st(34, 22, 4, -1).fill(18, 18, 29, 19, '#');
      P.put(19, 16, 'i').put(26, 17, 'R');
      P.st(20, 18, 4, 1).fill(24, 14, 40, 15, '#').fill(37, 16, 67, 29, '#');
      P.put(27, 13, 'C').put(31, 12, 's').put(36, 13, 'T').put(39, 9, 'Y').put(34, 12, 'c');
      P.lift(41, 14, 3, 6, 3.6, 0, [40, 14], [44, 8]).fill(41, 15, 43, 15, '#');
      P.fill(44, 8, 52, 29, '#').put(47, 6, 'i').put(50, 7, 'J');
      // смертельный пролом 53..62 с маятником
      P.clear(53, 2, 62, 29);
      P.pend(58, 1.5, 8.0, 0.42, 3.4, 0.3, [52, 8], [63, 9]);
      P.fill(63, 9, 67, 29, '#').put(65, 7, 'h');
      P.ground(68, 99, 13).fill(99, 0, 99, 29, '#').put(68, 12, '|');
      P.put(88, 12, 'B');
    } },
    heart: { key: 'heart', boss: 'heart', bhp: 24, final: true, w: 120, h: 16, arena: { x: 88, y: 0 }, paint: function (P) {
      P.ceil(0, 119, 1); P.fill(0, 0, 0, 15, '#');
      P.ground(1, 14, 13); P.put(3, 12, '@').put(7, 11, 'I').put(12, 11, 'h');
      P.st(10, 13, 4, 1).ground(14, 22, 9).put(17, 8, 'J').put(20, 7, 'i');
      P.pend(28, 2.0, 7.6, 0.5, 3.0, 0, [22, 9], [34, 9]);
      P.ground(34, 40, 9).put(39, 8, 'T').put(37, 7, 'c');
      P.lift(41, 13, 3, 4, 3.0, 1.0, [40, 9], [44, 11]);
      P.ground(44, 56, 11).put(47, 10, 'C').put(50, 9, 'I').put(54, 10, 'G').put(52, 6, 'Y');
      P.pend(62, 2.5, 8.6, 0.42, 3.2, 0.9, [56, 11], [67, 11]);
      P.ground(67, 87, 11).put(70, 9, 'p').put(74, 10, 'T').put(78, 10, '*').put(82, 9, 'h').put(85, 10, 'J');
      P.ground(88, 119, 13).fill(119, 0, 119, 15, '#').put(88, 12, '|');
      P.girder(91, 95, 11).girder(112, 116, 11);
      P.put(104, 5, 'B');
    } }
  };
  T.ROUTES = { A: ['works', 'pendulum', 'springs', 'gears', 'flywheel', 'heart'], B: ['works', 'pendulum', 'springs', 'gallery', 'belfry', 'heart'] };
  T.BRANCH = 2;   // индекс этажа развилки (3-й этаж)
  T.floorKey = function (fi, route) { return T.ROUTES[route || 'A'][fi]; };

  // ---------- сборка ----------
  T.build = function (key) {
    var def = T.FLOORS[key];
    if (!def) throw new Error('нет этажа ' + key);
    var P = Painter(def.w, def.h); def.paint(P);
    var W = def.w, H = def.h, t = new Uint8Array(W * H);
    var lamps = [], foes = [], start = null, cps = [], boss = null, doors = [], gate = null;
    for (var r = 0; r < H; r++) for (var c = 0; c < W; c++) {
      var ch = P.g[r][c], v = E;
      if (ch === '#') v = SOL; else if (ch === '=') v = ONE; else if (ch === '/') v = STR; else if (ch === '\\') v = STL; else if (ch === '*') v = SAW;
      else if (LAMPS[ch]) lamps.push({ x: c + 0.5, y: r + 0.5, k: LAMPS[ch] });
      else if (FOES[ch]) foes.push({ type: FOES[ch], x: c + 0.5, y: r + 1 });
      else if (ch === '@') start = { x: c + 0.5, y: r + 1 };
      else if (ch === 'C') cps.push({ x: c + 0.5, y: r + 1 });
      else if (ch === 'B') boss = { x: c + 0.5, y: r + 1 };
      else if (ch === '1' || ch === '2') doors.push({ x: c + 0.5, y: r + 1, route: ch === '1' ? 'A' : 'B' });
      else if (ch === '|') gate = { x: c, y: r + 1 };
      else if (ch !== ' ') throw new Error(key + ': неизвестный знак ' + ch);
      t[r * W + c] = v;
    }
    if (!start || !boss || !gate) throw new Error(key + ': нет старта, стража или ворот');
    if (gate.x !== def.arena.x || W - gate.x !== 32) throw new Error(key + ': арена должна занимать последние 32 колонки');
    // лестницы: цепочки ступеней
    var stairs = [], seen = {};
    for (var r2 = H - 1; r2 >= 0; r2--) for (var c2 = 0; c2 < W; c2++) {
      var v2 = t[r2 * W + c2]; if ((v2 !== STR && v2 !== STL) || seen[r2 * W + c2]) continue;
      var dir = v2 === STR ? 1 : -1;
      // начало цепочки — нижняя ступень (ниже-«позади» нет ступени того же типа)
      var pc = c2 - dir, pr = r2 + 1;
      if (pr < H && pc >= 0 && pc < W && t[pr * W + pc] === v2) continue;
      var n = 0, cc = c2, rr = r2;
      while (rr >= 0 && cc >= 0 && cc < W && t[rr * W + cc] === v2) { seen[rr * W + cc] = 1; n++; cc += dir; rr--; }
      var bx = dir > 0 ? c2 : c2 + 1, by = r2 + 1;
      stairs.push({ dir: dir, n: n, bx: bx, by: by, tx: bx + dir * n, ty: by - n });
    }
    var mov = P.mov.map(function (m, i) { return Object.assign({ id: i }, m); });
    return { key: key, def: def, W: W, H: H, t: t, lamps: lamps, foes: foes, start: start, cps: cps, boss: boss, bossKind: def.boss, bhp: def.bhp,
      doors: doors, gate: gate, arena: { x0: gate.x, x1: W - 1, y0: def.arena.y, y1: def.arena.y + 15 }, stairs: stairs, mov: mov,
      branch: !!def.branch, final: !!def.final, open: !!def.open, grid: P.g.map(function (row) { return row.join(''); }) };
  };
})(typeof window !== 'undefined' ? window : globalThis);
