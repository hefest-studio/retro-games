/* Тестовый уровень для отладки движка (не входит в финальную игру).
   Здесь есть все механики: лёд, лава, лестница, дверь/плита/рычаг, крюк, враг,
   руны, чекпоинт, выход, движущаяся платформа. */
(function () {
  'use strict';
  window.LV = window.LV || {};

  var COLS = 40, ROWS = 18;
  var grid = [];
  var r, c;
  for (r = 0; r < ROWS; r++) {
    var row = [];
    for (c = 0; c < COLS; c++) row.push('.');
    grid.push(row);
  }
  for (c = 0; c < COLS; c++) { grid[0][c] = '#'; grid[17][c] = '#'; }
  for (r = 0; r < ROWS; r++) { grid[r][0] = '#'; grid[r][COLS - 1] = '#'; }
  for (c = 1; c < COLS - 1; c++) grid[16][c] = '#';
  for (c = 12; c <= 14; c++) grid[16][c] = '~';
  for (r = 13; r <= 15; r++) grid[r][8] = '=';
  for (c = 22; c <= 26; c++) grid[11][c] = '#';
  for (r = 12; r <= 15; r++) grid[r][5] = 'L';
  for (c = 20; c <= 24; c++) grid[8][c] = '=';
  grid[15][9] = '^';
  grid[12][26] = 'G';

  var rows = grid.map(function (line) { return line.join(''); });

  window.LV.LEVELS = [{
    name: 'Отладка',
    nameEn: 'Debug',
    hint: 'Тестовый уровень движка.',
    hintEn: 'Engine test level.',
    music: 0,
    rows: rows,
    spawn: { erik: [2, 15], baleog: [4, 15], olaf: [6, 15] },
    entities: [
      { type: 'plate', x: 18, y: 15, group: 'a' },
      { type: 'door', x: 26, y: 13, w: 1, h: 3, group: 'a' },
      { type: 'lever', x: 22, y: 15, group: 'b' },
      { type: 'door', x: 33, y: 13, w: 1, h: 3, group: 'b' },
      { type: 'platform', x: 29, y: 12, w: 3, dx: 0, dy: 3, speed: 1.2 },
      { type: 'enemy', x: 16, y: 15, kind: 'grunt', range: 2 },
      { type: 'enemy', x: 30, y: 15, kind: 'thrower', range: 1 },
      { type: 'rune', x: 3, y: 13 },
      { type: 'rune', x: 21, y: 10 },
      { type: 'rune', x: 36, y: 12 },
      { type: 'checkpoint', x: 10, y: 15 },
      { type: 'exit', x: 36, y: 14, w: 2, h: 2 },
      { type: 'sign', x: 11, y: 15, ru: 'Проверка знака: Эрик ломает лёд тараном.', en: 'Sign test: Erik breaks ice with a headbutt.' },
      { type: 'torch', x: 9, y: 10 },
      { type: 'torch', x: 20, y: 10 },
      { type: 'anchor', x: 24, y: 11 }
    ],
    walkthrough: ['Тестовый уровень.']
  }];
})();
