/* ЗВЕРО-ОТРЯД · уровни (переделка 2026-11). Один экран = сетка 30×17 клеток по 32 px; строки карт собираются из примитивов.
   Знаки: # блок · = подмостки (проходимы снизу) · ^ шипы · S звезда · P Пыж · T Тяпа · E дверь · w жук · B босс
          1 2 3 — плиты (держат, пока на них стоят) ворота a b c · 4 5 6 — защёлки (открывают d e f насовсем).
   Поля уровня: rope — длина каната, par — «норма» времени (с), hint — ключ подсказки, sky — оттенок фона (0…2), boss/arena — босс. */
(function (global) {
  'use strict';
  var Z = global.ZVERO = global.ZVERO || {};
  var COLS = 30, ROWS = 17;
  function M() {
    var g = [], r, c;
    for (r = 0; r < ROWS; r++) { g[r] = []; for (c = 0; c < COLS; c++) g[r][c] = (r === 0 || c === 0 || c === COLS - 1) ? '#' : '.'; }
    var m = {
      fill: function (c0, r0, c1, r1, ch) { for (var j = r0; j <= r1; j++) for (var i = c0; i <= c1; i++) g[j][i] = ch; return m; },
      put: function (c, r, ch) { g[r][c] = ch; return m; },
      out: function () { return g.map(function (a) { return a.join(''); }); }
    };
    return m;
  }
  var L = [];

  // 1. Первая связка: ход, прыжок, канат тянет за собой
  L.push((function () {
    var m = M().fill(1, 15, 28, 16, '#');
    m.fill(9, 13, 10, 14, '#').fill(14, 13, 17, 14, '#').fill(21, 15, 22, 15, '^');
    m.put(15, 12, 'S').put(21, 11, 'S').put(26, 12, 'S').put(2, 14, 'P').put(4, 14, 'T').put(27, 14, 'E');
    return { rope: 150, par: 60, hint: 'h_move', sky: 0, map: m.out() };
  })());

  // 2. Через пропасть: Тяпа перепрыгивает, Пыж «ныряет» и вытаскивает себя канатом
  L.push((function () {
    var m = M().fill(1, 13, 10, 16, '#').fill(14, 13, 28, 16, '#');
    m.fill(3, 10, 6, 10, '=').put(5, 9, 'S').put(12, 9, 'S').put(22, 11, 'S');
    m.fill(17, 1, 19, 3, '#').put(2, 12, 'P').put(4, 12, 'T').put(26, 12, 'E');
    return { rope: 150, par: 80, hint: 'h_reel', sky: 0, map: m.out() };
  })());

  // 3. Нажми и проходи: плита держит люк, в яме — защёлка, открывающая ворота
  L.push((function () {
    var m = M().fill(1, 13, 28, 16, '#');
    m.fill(11, 13, 13, 13, 'a').fill(11, 14, 13, 14, '.').put(12, 14, '4').put(8, 12, '1');
    m.fill(18, 1, 18, 8, '#').fill(18, 9, 18, 12, 'd');
    m.put(6, 10, 'S').put(12, 10, 'S').put(23, 11, 'S').put(2, 12, 'P').put(4, 12, 'T').put(26, 12, 'E');
    return { rope: 150, par: 100, hint: 'h_plate', sky: 1, map: m.out() };
  })());

  // 4. Качели: Тяпа — якорь на балке над пропастью, Пыж срывается с края и качается на канате
  L.push((function () {
    var m = M().fill(1, 12, 9, 16, '#').fill(18, 13, 28, 16, '#');
    m.fill(4, 9, 4, 11, '#').fill(5, 8, 14, 8, '#');
    m.put(9, 7, 'S').put(14, 13, 'S').put(24, 11, 'S').put(6, 11, 'P').put(2, 11, 'T').put(26, 12, 'E');
    return { rope: 200, par: 110, hint: 'h_swing', sky: 1, map: m.out() };
  })());

  // 5. Жуки: две пропасти и патрульные
  L.push((function () {
    var m = M().fill(1, 14, 8, 16, '#').fill(12, 14, 17, 16, '#').fill(21, 14, 28, 16, '#');
    m.fill(13, 11, 15, 11, '=');
    m.put(10, 10, 'S').put(14, 10, 'S').put(19, 10, 'S').put(14, 13, '#').put(16, 13, 'w').put(24, 13, 'w').put(2, 13, 'P').put(4, 13, 'T').put(27, 13, 'E');
    return { rope: 150, par: 100, hint: 'h_bug', sky: 2, map: m.out() };
  })());

  // 6. Башня: ступени по три клетки — Тяпа запрыгивает, Пыжа поднимает канат
  L.push((function () {
    var m = M().fill(1, 13, 7, 16, '#').fill(8, 10, 14, 16, '#').fill(15, 7, 21, 16, '#').fill(22, 4, 28, 16, '#');
    m.put(11, 9, '#').put(13, 9, 'w').put(18, 6, '#').put(20, 6, 'w').put(3, 10, 'S').put(12, 7, 'S').put(25, 1, 'S');
    m.put(2, 12, 'P').put(3, 12, 'T').put(27, 3, 'E');
    return { rope: 150, par: 120, hint: 'h_haul', sky: 2, map: m.out() };
  })());

  // 7. Большие качели: пропасть шире, плита и ворота на том берегу
  L.push((function () {
    var m = M().fill(1, 12, 9, 16, '#').fill(18, 13, 28, 16, '#');
    m.fill(4, 9, 4, 11, '#').fill(5, 8, 14, 8, '#');
    m.put(8, 11, 'w');
    m.put(21, 12, '1').fill(23, 13, 25, 13, 'a').fill(23, 14, 25, 14, '.').put(24, 14, '4');
    m.fill(27, 1, 27, 8, '#').fill(27, 9, 27, 12, 'd');
    m.put(9, 7, 'S').put(14, 13, 'S').put(24, 11, 'S').put(6, 11, 'P').put(2, 11, 'T').put(28, 12, 'E');
    return { rope: 200, par: 150, hint: 'h_combo', sky: 0, map: m.out() };
  })());

  // 8. Колотун: канат поперёк арены подсекает босса
  L.push((function () {
    var m = M().fill(1, 15, 28, 16, '#').fill(1, 13, 7, 14, '#').fill(22, 13, 28, 14, '#');
    m.put(14, 14, 'B').put(6, 12, 'P').put(23, 12, 'T').put(27, 12, 'E').put(3, 9, 'S').put(26, 9, 'S').put(15, 7, 'S');
    m.fill(3, 10, 5, 10, '=').fill(24, 10, 26, 10, '=');
    return { rope: 560, par: 120, hint: 'h_boss', sky: 2, boss: true, arena: [8, 21], map: m.out() };
  })());

  Z.LEVELS = L;
})(typeof window !== 'undefined' ? window : globalThis);
