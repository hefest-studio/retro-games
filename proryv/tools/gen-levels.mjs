#!/usr/bin/env node
/**
 * ЧЕРНОВИК-генератор proryv/src/levels.js.
 * Рисуем экраны «операциями» (прямоугольники, платформы, шипы), печатаем
 * читаемый ASCII-арт в levels.js. Файл tmp/ в артефакт не попадает.
 *
 *   node proryv/tmp/gen-levels.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'src', 'levels.js');
const COLS = 32, ROWS = 24;

/* ---------- мини-DSL ---------- */
const R = (y, x0, x1, ch = '#') => ['R', y, x0, x1, ch];
const B = (x0, y0, x1, y1, ch = '#') => ['B', x0, y0, x1, y1, ch];
const P = (y, x0, x1) => ['R', y, x0, x1, '='];
const G = (y = 21) => ['B', 0, y, 31, 23, '#'];
const CARVE = (x0, y0, x1, y1) => ['B', x0, y0, x1, y1, ' '];

function render(ops) {
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill(' '));
  const put = (x, y, ch) => { if (x >= 0 && x < COLS && y >= 0 && y < ROWS) g[y][x] = ch; };
  for (const [op, a, b, c, d, e] of ops) {
    if (op === 'R') { const [y, x0, x1, ch] = [a, b, c, d]; for (let x = x0; x <= x1; x++) put(x, y, ch); }
    else if (op === 'B') { const [x0, y0, x1, y1, ch] = [a, b, c, d, e]; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, ch); }
  }
  return g.map((r) => r.join(''));
}

const SIZE = {
  walker: [14, 12], flyer: [16, 12], swarmer: [8, 8], turret: [12, 10], tank: [16, 12],
  mine: [8, 6], crusher: [16, 16], pod: [14, 12], homer: [14, 12],
  double_launcher: [12, 16], combo_launcher: [14, 16], power_laser: [8, 8],
  power_rocket: [8, 8], exo: [16, 20], teleporter: [12, 16]
};

/* ---------- экраны ---------- */
const SCREENS = {};

/* ============ 1. ВНЕШНИЙ ПЕРИМЕТР ============ */

SCREENS.S1_1 = {
  title: '1.1 — десант на периметр',
  name: { ru: 'Десант на периметр', en: 'Landing zone' },
  ops: [G(), P(18, 5, 9), P(18, 22, 27), B(28, 19, 31, 20)],
  ents: [
    { t: 'walker', x: 13, y: 20, dir: -1, range: 4 },
    { t: 'walker', x: 20, y: 20, dir: 1, range: 3 },
    { t: 'flyer', x: 16, y: 11, dir: -1 },
    { t: 'mine', x: 24, y: 20 }
  ]
};

SCREENS.S1_2 = {
  title: '1.2 — разлом',
  name: { ru: 'Разлом', en: 'The rift' },
  ops: [G(), CARVE(9, 21, 11, 22), CARVE(19, 21, 21, 22), P(18, 13, 18), P(15, 15, 19)],
  ents: [
    { t: 'walker', x: 6, y: 20, dir: 1, range: 3 },
    { t: 'walker', x: 15, y: 20, dir: -1, range: 3 },
    { t: 'flyer', x: 22, y: 9, dir: -1 },
    { t: 'flyer', x: 17, y: 5, dir: 1 },
    { t: 'mine', x: 26, y: 20 }
  ]
};

SCREENS.S1_3 = {
  title: '1.3 — капсула скафандра',
  name: { ru: 'Капсула скафандра', en: 'Exo pod' },
  ops: [G(), B(17, 19, 19, 20), B(21, 17, 27, 20), P(18, 5, 8), P(18, 28, 30), P(9, 27, 31)],
  ents: [
    { t: 'exo', x: 24, y: 16 },
    { t: 'teleporter', x: 12, y: 20, group: 1 },
    { t: 'teleporter', x: 29, y: 8, group: 1 },
    { t: 'walker', x: 15, y: 20, dir: -1, range: 3 },
    { t: 'walker', x: 26, y: 16, dir: -1, range: 1 },
    { t: 'flyer', x: 8, y: 7, dir: 1 },
    { t: 'flyer', x: 23, y: 4, dir: -1 },
    { t: 'mine', x: 10, y: 20 },
    { t: 'power_laser', x: 27, y: 8 }
  ]
};

SCREENS.S1_4 = {
  title: '1.4 — мёртвый сектор',
  name: { ru: 'Мёртвый сектор', en: 'Dead sector' },
  ops: [G(), B(13, 20, 14, 20), B(20, 20, 21, 20), P(18, 3, 7), P(15, 9, 12),
    R(21, 27, 29, '%'), CARVE(27, 22, 29, 22)],
  ents: [
    { t: 'walker', x: 6, y: 20, dir: 1, range: 3 },
    { t: 'walker', x: 17, y: 20, dir: -1, range: 2 },
    { t: 'flyer', x: 10, y: 8, dir: 1 },
    { t: 'flyer', x: 24, y: 6, dir: -1 },
    { t: 'mine', x: 11, y: 20 },
    { t: 'power_rocket', x: 28, y: 22 }
  ]
};

SCREENS.S1_5 = {
  title: '1.5 — стартовая площадка',
  name: { ru: 'Стартовая площадка', en: 'Launch pad' },
  ops: [G(), B(22, 19, 23, 20), B(24, 18, 31, 20), P(18, 4, 8), P(15, 8, 13)],
  ents: [
    { t: 'walker', x: 9, y: 20, dir: -1, range: 4 },
    { t: 'walker', x: 14, y: 20, dir: 1, range: 3 },
    { t: 'walker', x: 20, y: 20, dir: -1, range: 2 },
    { t: 'flyer', x: 7, y: 6, dir: 1 },
    { t: 'flyer', x: 21, y: 5, dir: -1 },
    { t: 'mine', x: 16, y: 20 },
    { t: 'double_launcher', x: 10, y: 14 }
  ]
};

/* ============ 2. ПЕЩЕРЫ ============ */

SCREENS.S2_1 = {
  title: '2.1 — вход в пещеры',
  name: { ru: 'Вход в пещеры', en: 'Cave mouth' },
  ops: [R(0, 0, 31, '#'), R(1, 0, 12, '#'), R(1, 20, 31, '#'), B(5, 2, 8, 5), B(23, 2, 27, 5),
    B(9, 0, 9, 3), G(), B(12, 20, 13, 20), P(18, 4, 8), P(15, 10, 14), P(18, 17, 22)],
  ents: [
    { t: 'walker', x: 7, y: 20, dir: 1, range: 3 },
    { t: 'walker', x: 17, y: 20, dir: -1, range: 3 },
    { t: 'walker', x: 26, y: 20, dir: -1, range: 3 },
    { t: 'flyer', x: 14, y: 10, dir: 1 },
    { t: 'mine', x: 21, y: 20 }
  ]
};

SCREENS.S2_2 = {
  title: '2.2 — грот шипов',
  name: { ru: 'Грот шипов', en: 'Spike grotto' },
  ops: [R(0, 0, 31, '#'), B(3, 2, 9, 3), G(), R(21, 12, 14, '^'), CARVE(5, 21, 6, 22),
    R(23, 5, 6, '^'), P(18, 3, 7), P(18, 18, 23)],
  ents: [
    { t: 'walker', x: 8, y: 20, dir: 1, range: 2 },
    { t: 'walker', x: 17, y: 20, dir: -1, range: 2 },
    { t: 'walker', x: 25, y: 20, dir: -1, range: 4 },
    { t: 'flyer', x: 10, y: 9, dir: 1 },
    { t: 'flyer', x: 19, y: 5, dir: -1 },
    { t: 'mine', x: 28, y: 20 },
    { t: 'power_laser', x: 21, y: 17 }
  ]
};

SCREENS.S2_3 = {
  title: '2.3 — грот капсулы',
  name: { ru: 'Грот капсулы', en: 'Pod grotto' },
  ops: [R(0, 0, 31, '#'), B(4, 2, 9, 3), G(), B(18, 19, 19, 20), B(20, 18, 21, 20),
    B(22, 17, 31, 20), P(7, 26, 31)],
  ents: [
    { t: 'exo', x: 26, y: 16 },
    { t: 'teleporter', x: 11, y: 20, group: 1 },
    { t: 'teleporter', x: 29, y: 6, group: 1 },
    { t: 'walker', x: 7, y: 20, dir: 1, range: 3 },
    { t: 'walker', x: 15, y: 20, dir: -1, range: 1 },
    { t: 'flyer', x: 19, y: 9, dir: 1 },
    { t: 'flyer', x: 25, y: 8, dir: -1 },
    { t: 'mine', x: 17, y: 20 },
    { t: 'combo_launcher', x: 26, y: 6 }
  ]
};

SCREENS.S2_4 = {
  title: '2.4 — обвал',
  name: { ru: 'Обвал', en: 'Rockfall' },
  ops: [R(0, 0, 31, '#'), B(2, 2, 6, 3), G(), R(21, 26, 28, '%'), CARVE(26, 22, 28, 22),
    B(14, 20, 16, 20), B(9, 20, 10, 20), P(18, 3, 6), P(15, 10, 13), P(18, 17, 22)],
  ents: [
    { t: 'tank', x: 20, y: 20, dir: -1 },
    { t: 'walker', x: 6, y: 20, dir: 1, range: 3 },
    { t: 'walker', x: 24, y: 20, dir: -1, range: 2 },
    { t: 'flyer', x: 12, y: 8, dir: 1 },
    { t: 'mine', x: 11, y: 20 },
    { t: 'power_rocket', x: 27, y: 22 }
  ]
};

SCREENS.S2_5 = {
  title: '2.5 — выход из пещер',
  name: { ru: 'Выход из пещер', en: 'Cave exit' },
  ops: [R(0, 0, 31, '#'), B(3, 2, 7, 4), G(), B(21, 19, 22, 20), B(25, 18, 31, 20),
    P(18, 3, 7), P(15, 11, 15)],
  ents: [
    { t: 'walker', x: 9, y: 20, dir: -1, range: 3 },
    { t: 'walker', x: 19, y: 20, dir: 1, range: 2 },
    { t: 'flyer', x: 11, y: 8, dir: 1 },
    { t: 'turret', x: 14, y: 20 },
    { t: 'homer', x: 13, y: 14 },
    { t: 'mine', x: 8, y: 20 },
    { t: 'double_launcher', x: 5, y: 17 }
  ]
};

/* ============ 3. РЕАКТОР ============ */

SCREENS.S3_1 = {
  title: '3.1 — техэтаж',
  name: { ru: 'Техэтаж', en: 'Service deck' },
  ops: [G(), P(18, 4, 7), P(15, 9, 12), B(13, 20, 15, 20), B(14, 14, 20, 15),
    B(24, 19, 25, 20), B(27, 17, 31, 19)],
  ents: [
    { t: 'turret', x: 10, y: 14 },
    { t: 'turret', x: 17, y: 20 },
    { t: 'crusher', x: 16, y: 17 },
    { t: 'walker', x: 20, y: 20, dir: -1, range: 2 },
    { t: 'walker', x: 28, y: 16, dir: -1, range: 1 },
    { t: 'flyer', x: 11, y: 8, dir: 1 },
    { t: 'mine', x: 23, y: 20 }
  ]
};

SCREENS.S3_2 = {
  title: '3.2 — шахта',
  name: { ru: 'Шахта', en: 'The shaft' },
  ops: [G(), P(18, 3, 5), P(15, 3, 5), P(12, 3, 5), P(9, 3, 5), B(6, 8, 31, 9),
    B(20, 14, 25, 15), P(15, 7, 11), P(18, 18, 23)],
  ents: [
    { t: 'tank', x: 20, y: 20, dir: -1 },
    { t: 'turret', x: 15, y: 7 },
    { t: 'crusher', x: 22, y: 17 },
    { t: 'walker', x: 8, y: 20, dir: 1, range: 3 },
    { t: 'walker', x: 28, y: 20, dir: -1, range: 3 },
    { t: 'flyer', x: 12, y: 10, dir: 1 },
    { t: 'mine', x: 26, y: 20 },
    { t: 'power_laser', x: 13, y: 7 }
  ]
};

SCREENS.S3_3 = {
  title: '3.3 — капсула реактора',
  name: { ru: 'Капсула реактора', en: 'Reactor pod' },
  ops: [G(), B(15, 19, 16, 20), B(18, 18, 20, 20), P(19, 21, 22), B(22, 14, 29, 14),
    P(10, 27, 31)],
  ents: [
    { t: 'exo', x: 19, y: 17 },
    { t: 'teleporter', x: 25, y: 20, group: 2 },
    { t: 'teleporter', x: 29, y: 9, group: 2 },
    { t: 'crusher', x: 24, y: 16 },
    { t: 'crusher', x: 28, y: 16 },
    { t: 'walker', x: 8, y: 20, dir: 1, range: 3 },
    { t: 'flyer', x: 13, y: 9, dir: -1 },
    { t: 'turret', x: 6, y: 20 },
    { t: 'mine', x: 11, y: 20 },
    { t: 'double_launcher', x: 27, y: 9 }
  ]
};

SCREENS.S3_4 = {
  title: '3.4 — шиповой коридор',
  name: { ru: 'Шиповой коридор', en: 'Spike run' },
  ops: [G(), R(21, 8, 9, '^'), R(21, 15, 17, '^'), P(18, 4, 7), P(15, 11, 14),
    P(18, 20, 23), R(21, 27, 29, '%'), CARVE(27, 22, 29, 22)],
  ents: [
    { t: 'turret', x: 24, y: 20 },
    { t: 'homer', x: 13, y: 8 },
    { t: 'walker', x: 5, y: 20, dir: 1, range: 2 },
    { t: 'walker', x: 20, y: 20, dir: -1, range: 1 },
    { t: 'walker', x: 29, y: 20, dir: -1, range: 1 },
    { t: 'flyer', x: 21, y: 5, dir: -1 },
    { t: 'power_rocket', x: 28, y: 22 }
  ]
};

SCREENS.S3_5 = {
  title: '3.5 — к шлюзу',
  name: { ru: 'К шлюзу', en: 'To the airlock' },
  ops: [G(), B(8, 14, 19, 15), B(24, 19, 25, 20), B(27, 18, 31, 20), P(18, 3, 6)],
  ents: [
    { t: 'crusher', x: 10, y: 17 },
    { t: 'crusher', x: 16, y: 17 },
    { t: 'tank', x: 21, y: 20, dir: -1 },
    { t: 'turret', x: 11, y: 20 },
    { t: 'walker', x: 5, y: 20, dir: 1, range: 2 },
    { t: 'flyer', x: 20, y: 8, dir: -1 },
    { t: 'mine', x: 23, y: 20 }
  ]
};

/* ============ 4. УЛЕЙ ============ */

SCREENS.S4_1 = {
  title: '4.1 — коконовый зал',
  name: { ru: 'Коконовый зал', en: 'Cocoon hall' },
  ops: [R(0, 0, 31, '#'), B(3, 1, 9, 4), G(), P(18, 6, 10), P(18, 20, 24),
    R(20, 16, 17, 'x'), R(20, 29, 30, 'x')],
  ents: [
    { t: 'pod', x: 8, y: 17 },
    { t: 'pod', x: 22, y: 17 },
    { t: 'walker', x: 6, y: 20, dir: 1, range: 2 },
    { t: 'walker', x: 27, y: 20, dir: -1, range: 3 },
    { t: 'swarmer', x: 17, y: 10 },
    { t: 'swarmer', x: 15, y: 5 },
    { t: 'mine', x: 13, y: 20 }
  ]
};

SCREENS.S4_2 = {
  title: '4.2 — органические шахты',
  name: { ru: 'Органические шахты', en: 'Hive shafts' },
  ops: [R(0, 0, 31, '#'), G(), P(18, 4, 7), P(15, 7, 10), P(12, 10, 14), P(9, 13, 17),
    CARVE(20, 21, 21, 22), R(23, 20, 21, '^'), R(20, 4, 5, 'x')],
  ents: [
    { t: 'pod', x: 5, y: 17 },
    { t: 'pod', x: 8, y: 14 },
    { t: 'pod', x: 11, y: 11 },
    { t: 'walker', x: 14, y: 20, dir: 1, range: 3 },
    { t: 'walker', x: 26, y: 20, dir: -1, range: 3 },
    { t: 'flyer', x: 26, y: 9, dir: -1 },
    { t: 'swarmer', x: 16, y: 5 },
    { t: 'swarmer', x: 23, y: 12 },
    { t: 'power_laser', x: 16, y: 8 }
  ]
};

SCREENS.S4_3 = {
  title: '4.3 — капсула улья',
  name: { ru: 'Капсула улья', en: 'Hive pod' },
  ops: [R(0, 0, 31, '#'), G(), B(17, 19, 18, 20), B(20, 18, 31, 20), P(8, 26, 31),
    R(20, 2, 3, 'x')],
  ents: [
    { t: 'exo', x: 22, y: 17 },
    { t: 'teleporter', x: 13, y: 20, group: 3 },
    { t: 'teleporter', x: 29, y: 7, group: 3 },
    { t: 'pod', x: 5, y: 20 },
    { t: 'pod', x: 24, y: 17 },
    { t: 'walker', x: 10, y: 20, dir: 1, range: 2 },
    { t: 'swarmer', x: 15, y: 8 },
    { t: 'swarmer', x: 18, y: 12 },
    { t: 'flyer', x: 9, y: 6, dir: 1 },
    { t: 'mine', x: 15, y: 20 },
    { t: 'combo_launcher', x: 27, y: 7 }
  ]
};

SCREENS.S4_4 = {
  title: '4.4 — плотный рой',
  name: { ru: 'Плотный рой', en: 'The swarm' },
  ops: [G(), R(21, 25, 27, '%'), CARVE(25, 22, 27, 22), P(18, 5, 9), P(15, 12, 16),
    P(18, 20, 24), R(20, 2, 3, 'x'), R(20, 10, 11, 'x')],
  ents: [
    { t: 'pod', x: 7, y: 17 },
    { t: 'pod', x: 14, y: 14 },
    { t: 'pod', x: 22, y: 17 },
    { t: 'walker', x: 6, y: 20, dir: 1, range: 2 },
    { t: 'walker', x: 29, y: 20, dir: -1, range: 2 },
    { t: 'swarmer', x: 11, y: 9 },
    { t: 'swarmer', x: 17, y: 7 },
    { t: 'swarmer', x: 24, y: 12 },
    { t: 'power_rocket', x: 26, y: 22 }
  ]
};

SCREENS.S4_5 = {
  title: '4.5 — матка',
  name: { ru: 'Матка', en: 'The queen' },
  ops: [R(0, 0, 31, '#'), G(), P(18, 6, 12), B(21, 19, 22, 20), B(23, 18, 23, 20),
    B(24, 16, 31, 19), R(20, 4, 5, 'x'), R(20, 12, 13, 'x')],
  ents: [
    { t: 'double_launcher', x: 10, y: 17 },
    { t: 'pod', x: 15, y: 20 },
    { t: 'pod', x: 26, y: 15 },
    { t: 'walker', x: 6, y: 20, dir: 1, range: 2 },
    { t: 'walker', x: 18, y: 20, dir: -1, range: 1 },
    { t: 'swarmer', x: 6, y: 8 },
    { t: 'swarmer', x: 16, y: 10 },
    { t: 'swarmer', x: 19, y: 5 },
    { t: 'homer', x: 29, y: 8 }
  ]
};

/* ============ 5. ЯДРО ============ */

SCREENS.S5_1 = {
  title: '5.1 — вход в ядро',
  name: { ru: 'Вход в ядро', en: 'Core entry' },
  ops: [G(), B(10, 14, 20, 15), P(18, 6, 9), P(11, 22, 26), B(25, 20, 26, 20)],
  ents: [
    { t: 'crusher', x: 13, y: 17 },
    { t: 'crusher', x: 17, y: 17 },
    { t: 'turret', x: 8, y: 20 },
    { t: 'tank', x: 28, y: 20, dir: -1 },
    { t: 'walker', x: 11, y: 20, dir: 1, range: 1 },
    { t: 'walker', x: 21, y: 20, dir: -1, range: 2 },
    { t: 'flyer', x: 15, y: 8, dir: 1 },
    { t: 'mine', x: 15, y: 20 },
    { t: 'swarmer', x: 23, y: 6 }
  ]
};

SCREENS.S5_2 = {
  title: '5.2 — шлюз',
  name: { ru: 'Шлюз', en: 'The gate' },
  ops: [G(), R(21, 8, 10, '^'), R(21, 17, 19, '^'), B(5, 14, 10, 15), P(18, 12, 15),
    P(15, 17, 21), P(12, 12, 16)],
  ents: [
    { t: 'crusher', x: 5, y: 17 },
    { t: 'turret', x: 13, y: 20 },
    { t: 'tank', x: 23, y: 20, dir: -1 },
    { t: 'walker', x: 5, y: 20, dir: 1, range: 2 },
    { t: 'walker', x: 28, y: 20, dir: 1, range: 2 },
    { t: 'flyer', x: 11, y: 7, dir: -1 },
    { t: 'swarmer', x: 16, y: 10 },
    { t: 'swarmer', x: 21, y: 5 },
    { t: 'mine', x: 15, y: 20 },
    { t: 'power_laser', x: 19, y: 14 }
  ]
};

SCREENS.S5_3 = {
  title: '5.3 — капсула ядра',
  name: { ru: 'Капсула ядра', en: 'Core pod' },
  ops: [G(), B(12, 14, 18, 15), P(18, 20, 24), P(7, 27, 31)],
  ents: [
    { t: 'exo', x: 22, y: 17 },
    { t: 'teleporter', x: 8, y: 20, group: 1 },
    { t: 'teleporter', x: 29, y: 6, group: 1 },
    { t: 'crusher', x: 14, y: 17 },
    { t: 'crusher', x: 17, y: 17 },
    { t: 'pod', x: 5, y: 20 },
    { t: 'walker', x: 12, y: 20, dir: 1, range: 2 },
    { t: 'tank', x: 27, y: 20, dir: -1 },
    { t: 'swarmer', x: 20, y: 6 },
    { t: 'swarmer', x: 24, y: 9 },
    { t: 'flyer', x: 8, y: 5, dir: 1 },
    { t: 'mine', x: 16, y: 20 },
    { t: 'combo_launcher', x: 27, y: 6 }
  ]
};

SCREENS.S5_4 = {
  title: '5.4 — сердце ядра',
  name: { ru: 'Сердце ядра', en: 'Core heart' },
  ops: [G(), R(21, 9, 11, '^'), R(21, 22, 24, '%'), CARVE(22, 22, 24, 22),
    B(14, 14, 20, 15), P(18, 3, 6), P(18, 26, 30)],
  ents: [
    { t: 'crusher', x: 16, y: 17 },
    { t: 'crusher', x: 19, y: 17 },
    { t: 'turret', x: 13, y: 20 },
    { t: 'turret', x: 21, y: 20 },
    { t: 'tank', x: 28, y: 20, dir: -1 },
    { t: 'walker', x: 5, y: 20, dir: 1, range: 2 },
    { t: 'swarmer', x: 12, y: 8 },
    { t: 'swarmer', x: 17, y: 6 },
    { t: 'swarmer', x: 25, y: 10 },
    { t: 'swarmer', x: 6, y: 12 },
    { t: 'flyer', x: 30, y: 6, dir: -1 },
    { t: 'power_rocket', x: 23, y: 22 }
  ]
};

SCREENS.S5_5 = {
  title: '5.5 — последний рубеж',
  name: { ru: 'Последний рубеж', en: 'Last stand' },
  ops: [R(0, 0, 31, '#'), G(), B(6, 20, 7, 20), B(8, 19, 12, 20), B(13, 18, 17, 20),
    B(18, 17, 22, 20), B(24, 16, 31, 20), B(8, 13, 12, 13), B(13, 12, 17, 12), P(18, 1, 3)],
  ents: [
    { t: 'double_launcher', x: 2, y: 17 },
    { t: 'pod', x: 15, y: 17 },
    { t: 'pod', x: 20, y: 16 },
    { t: 'turret', x: 28, y: 15 },
    { t: 'crusher', x: 10, y: 15 },
    { t: 'crusher', x: 15, y: 14 },
    { t: 'swarmer', x: 7, y: 10 },
    { t: 'swarmer', x: 9, y: 8 },
    { t: 'swarmer', x: 20, y: 6 },
    { t: 'swarmer', x: 27, y: 10 },
    { t: 'flyer', x: 12, y: 6 },
    { t: 'flyer', x: 30, y: 8 },
    { t: 'homer', x: 19, y: 10 }
  ]
};

/* ---------- уровни ---------- */
const LEVELS = [
  {
    id: 0,
    name: { ru: 'ВНЕШНИЙ ПЕРИМЕТР', en: 'OUTER PERIMETER' },
    theme: 'space',
    intro: {
      ru: 'Орбитальный периметр станции. Патрули, мины, обрыв.\nПробейся к шлюзу.',
      en: 'Orbital perimeter of the station. Patrols, mines, the drop.\nFight your way to the airlock.'
    },
    screens: ['S1_1', 'S1_2', 'S1_3', 'S1_4', 'S1_5']
  },
  {
    id: 1,
    name: { ru: 'ПЕЩЕРЫ', en: 'THE CAVES' },
    theme: 'cavern',
    intro: {
      ru: 'Подземные гроты: камни рушатся, тьма шевелится.\nКапсула скафандра ждёт внутри.',
      en: 'Underground grottos: rocks fall, the dark moves.\nThe exoskeleton pod waits inside.'
    },
    screens: ['S2_1', 'S2_2', 'S2_3', 'S2_4', 'S2_5']
  },
  {
    id: 2,
    name: { ru: 'РЕАКТОР', en: 'REACTOR' },
    theme: 'reactor',
    intro: {
      ru: 'Сердце станции: этажи, пушки и пневмомолоты.\nДержи ритм — или тебя расплющит.',
      en: 'The station heart: decks, guns and piston hammers.\nKeep the rhythm — or get flattened.'
    },
    screens: ['S3_1', 'S3_2', 'S3_3', 'S3_4', 'S3_5']
  },
  {
    id: 3,
    name: { ru: 'УЛЕЙ', en: 'THE HIVE' },
    theme: 'hive',
    intro: {
      ru: 'Коконы вскрываются один за другим.\nРой идёт за тобой, живой коридор сжимается.',
      en: 'Cocoons crack open one by one.\nThe swarm follows, the living corridor closes in.'
    },
    screens: ['S4_1', 'S4_2', 'S4_3', 'S4_4', 'S4_5']
  },
  {
    id: 4,
    name: { ru: 'ЯДРО', en: 'THE CORE' },
    theme: 'core',
    intro: {
      ru: 'Ядро. Здесь всё против тебя: молоты, пушки, рой.\nДойди до выхода и выбери награду.',
      en: 'The core. Everything is against you: hammers, guns, swarm.\nReach the exit and choose your reward.'
    },
    screens: ['S5_1', 'S5_2', 'S5_3', 'S5_4', 'S5_5']
  }
];

/* ---------- сборка ---------- */
const tileset = {};
const problems = [];
for (const [key, sc] of Object.entries(SCREENS)) {
  const rows = render(sc.ops);
  tileset[key] = rows;
  // эвристика: сущности не должны пересекаться по тайлам
  const seen = [];
  for (const e of sc.ents) {
    const [w, h] = SIZE[e.t] || [8, 8];
    const px = e.x * 8, py = (e.y + 1) * 8 - h;
    const box = { x0: Math.floor(px / 8), x1: Math.floor((px + w - 1) / 8), y0: Math.floor(py / 8), y1: Math.floor((py + h - 1) / 8), t: e.t, x: e.x, y: e.y };
    for (const o of seen) {
      if (box.x0 <= o.x1 && box.x1 >= o.x0 && box.y0 <= o.y1 && box.y1 >= o.y0) {
        problems.push(`${key}: ${box.t}(${box.x},${box.y}) пересекается с ${o.t}(${o.x},${o.y})`);
      }
    }
    seen.push(box);
  }
}

const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
const ruler = '//   ' + Array.from({ length: COLS }, (_, i) => String(i % 10)).join('');

function emitScreen(key, sc) {
  const rows = tileset[key];
  const out = [];
  out.push(`  /* ${sc.title} */`);
  out.push(`  const ${key} = {`);
  out.push(`    name: { ru: ${q(sc.name.ru)}, en: ${q(sc.name.en)} },`);
  out.push(`    spawn: { x: 1, y: 20 },`);
  out.push(`    tiles: [`);
  out.push(`      ${ruler}`);
  rows.forEach((r, y) => {
    out.push(`      ${q(r)},${y === ROWS - 1 ? '' : ''}`);
  });
  out.push(`    ],`);
  out.push(`    entities: [`);
  const byType = {};
  for (const e of sc.ents) (byType[e.t] = byType[e.t] || []).push(e);
  const order = ['exo', 'teleporter', 'double_launcher', 'combo_launcher', 'crusher', 'tank', 'turret', 'pod', 'homer', 'walker', 'flyer', 'swarmer', 'mine', 'power_laser', 'power_rocket'];
  const lines = [];
  for (const t of order) {
    for (const e of byType[t] || []) {
      const bits = [`t: '${e.t}'`, `x: ${e.x}`, `y: ${e.y}`];
      if (e.dir !== undefined) bits.push(`dir: ${e.dir}`);
      if (e.range !== undefined) bits.push(`range: ${e.range}`);
      if (e.group !== undefined) bits.push(`group: ${e.group}`);
      lines.push(`      { ${bits.join(', ')} }`);
    }
  }
  out.push(lines.join(',\n') + (lines.length ? '' : ''));
  out.push(`    ]`);
  out.push(`  };`);
  out.push('');
  return out.join('\n');
}

const head = `/* ============================================================
   ПРОРЫВ HTML5 — данные уровней
   5 секторов × 5 экранов = 25 экранов по 32×24 тайла (256×192 px).
   Механика флип-скрина: ушёл за правый край — следующий экран.

   Формат: docs/LEVELS.md · проверка: node proryv/tools/validate-levels.mjs

   Тайлы:
     ' '  пусто              '#'  твёрдый блок (порода / металл)
     '='  тонкая платформа   '%'  разрушаемый камень (граната)
     '^'  шипы (смертельно)  'x'  декоративная флора

   Координаты сущностей — в тайлах; y — тайл, на нижнюю границу которого
   опирается сущность (низ = (y+1)*8).
   Игрок стартует слева, цель — уйти за правый край (нужна опора у x=30..31).

   Баланс: ур.1 — 3–6 врагов/экран, ур.5 — 7–12; капсула exo — screens[2];
   1 пара телепортов на уровень; патроны и статуи-бонусы — по 1–2 на уровень.
   ============================================================ */
(function () {
  'use strict';

`;

let body = '';
for (const [key, sc] of Object.entries(SCREENS)) body += emitScreen(key, sc) + '\n';

let levelsSrc = '';
for (const lv of LEVELS) {
  levelsSrc += `  /* ======================= СЕКТОР ${lv.id + 1}: ${lv.name.ru} / ${lv.name.en} ======================= */\n`;
  levelsSrc += `  {\n    id: ${lv.id},\n    name: { ru: ${q(lv.name.ru)}, en: ${q(lv.name.en)} },\n    theme: '${lv.theme}',\n`;
  levelsSrc += `    intro: {\n      ru: ${q(lv.intro.ru)},\n      en: ${q(lv.intro.en)}\n    },\n`;
  levelsSrc += `    screens: [${lv.screens.join(', ')}]\n  }${lv.id === LEVELS.length - 1 ? '' : ','}\n\n`;
}

const tail = `  window.PR_LEVELS = [\n${levelsSrc}  ];\n})();\n`;

writeFileSync(OUT, head + body + tail, 'utf8');
if (problems.length) {
  console.log('⚠ пересечения сущностей:');
  problems.forEach((p) => console.log('  ' + p));
} else {
  console.log('✓ пересечений сущностей нет');
}
console.log(`✓ записано ${OUT}: ${Object.keys(SCREENS).length} экранов`);
