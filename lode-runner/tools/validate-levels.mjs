#!/usr/bin/env node
/**
 * validate-levels.mjs — автотест уровней Lode Runner по CONTRACT.md (раздел 1).
 * Без внешних зависимостей. Проверяет формат 28×16, символы, счётчики,
 * периметр, опоры @ и X, положение выхода и BFS-достижимость
 * всего золота и выхода от @ без копания кирпичей (=).
 *
 * Запуск:
 *   node tools/validate-levels.mjs
 *   node tools/validate-levels.mjs --map=1     # карта уровня 1 + зоны достижимости (*)
 *   node tools/validate-levels.mjs --map=all
 *
 * Код выхода: 0 — все уровни OK, 1 — есть ошибки.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const LEVELS_FILE = resolve(ROOT, 'js', 'levels.js');

const W = 28;
const H = 16;
const MAX_NAME = 22;
const MAX_HINT = 90;
const MAX_EXIT_Y = 4; // выход — в верхней части поля (y = 0..4)
const ALLOWED = '#=H-$@XE.';
const PASSABLE = new Set(['.', '$', 'H', '-', '@', 'X', 'E']);
const SUPPORT_BELOW = new Set(['#', '=', 'H', '-']);
const CYRILLIC = /[А-Яа-яЁё]/;

const at = (x, y) => y * W + x;

/* ------------------------------------------------------------------ */
/* Правила движения (CONTRACT.md, «Правила движения для проверки»)     */
/* ------------------------------------------------------------------ */

/** Опора в клетке (x, y): сама клетка — H/- ИЛИ снизу # = H -. */
function hasSupport(grid, x, y) {
  if (x < 0 || x >= W || y < 0 || y >= H) return false;
  const ch = grid[y][x];
  if (ch === 'H' || ch === '-') return true;
  // Контракт: выход за нижнюю границу считается опорой «для страховки».
  if (y + 1 >= H) return true;
  return SUPPORT_BELOW.has(grid[y + 1][x]);
}

/** Падение вниз по проходимым клеткам до опоры. null — вылет за нижнюю границу. */
function settle(grid, x, y) {
  let guard = 0;
  while (!hasSupport(grid, x, y)) {
    y += 1;
    if (y >= H) return null;
    if (!PASSABLE.has(grid[y][x])) return null;
    if (++guard > H) return null;
  }
  return { x, y };
}

/** BFS по состояниям покоя. Возвращает Set ключей (y * W + x). */
function bfs(grid, startX, startY) {
  const reachable = new Set();
  if (!PASSABLE.has(grid[startY][startX])) return reachable;
  const start = settle(grid, startX, startY);
  if (!start) return reachable;

  const push = (x, y) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    if (!PASSABLE.has(grid[y][x])) return;
    const rest = settle(grid, x, y);
    if (!rest) return; // вылет за нижнюю границу — смерть
    const k = at(rest.x, rest.y);
    if (reachable.has(k)) return;
    reachable.add(k);
    queue.push(rest);
  };

  const queue = [];
  reachable.add(at(start.x, start.y));
  queue.push(start);

  while (queue.length > 0) {
    const { x, y } = queue.pop();

    // 1) горизонтальная ходьба с любой опоры
    push(x - 1, y);
    push(x + 1, y);

    // 2) вверх по лестнице: текущая клетка H, целевая проходима
    if (grid[y][x] === 'H') push(x, y - 1);

    // 3) вниз: текущая H или под нами H, целевая проходима
    const onLadder = grid[y][x] === 'H';
    const ladderBelow = y + 1 < H && grid[y + 1][x] === 'H';
    if (onLadder || ladderBelow) push(x, y + 1);
  }

  return reachable;
}

/* ------------------------------------------------------------------ */
/* Загрузка levels.js                                                  */
/* ------------------------------------------------------------------ */

function loadLevels() {
  let src;
  try {
    src = readFileSync(LEVELS_FILE, 'utf8');
  } catch (err) {
    throw new Error(`не удалось прочитать js/levels.js: ${err.message}`);
  }
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  try {
    vm.runInContext(src, sandbox, { filename: 'js/levels.js', timeout: 3000 });
  } catch (err) {
    throw new Error(`js/levels.js не исполняется: ${err.message}`);
  }
  if (!sandbox.window || !sandbox.window.LR_LEVELS) {
    throw new Error('js/levels.js не определяет window.LR_LEVELS');
  }
  return sandbox.window.LR_LEVELS;
}

/* ------------------------------------------------------------------ */
/* Проверка одного уровня                                              */
/* ------------------------------------------------------------------ */

function checkLevel(raw, index) {
  const errors = [];
  const warnings = [];
  const tag = `Уровень ${index + 1}`;
  const info = {
    name: '',
    gold: 0,
    goldReached: 0,
    exitOk: false,
    enemies: 0,
    ladders: 0,
    ropes: 0,
    bricks: 0,
  };
  const fail = (msg) => errors.push(`${tag}: ${msg}`);
  const empty = { errors, warnings, info, grid: null, reachable: null };

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('элемент массива должен быть объектом { name, hint, rows }');
    return empty;
  }

  // --- name / hint ---
  if (typeof raw.name !== 'string' || raw.name.trim() === '') {
    fail('name отсутствует или пуст');
  } else {
    info.name = raw.name;
    if (raw.name.length > MAX_NAME) fail(`name длиннее ${MAX_NAME} символов (${raw.name.length})`);
    else if (!CYRILLIC.test(raw.name)) fail('name должен быть на русском');
  }
  if (typeof raw.hint !== 'string' || raw.hint.trim() === '') {
    fail('hint отсутствует или пуст');
  } else {
    if (raw.hint.length > MAX_HINT) fail(`hint длиннее ${MAX_HINT} символов (${raw.hint.length})`);
    else if (!CYRILLIC.test(raw.hint)) fail('hint должен быть на русском');
  }

  // --- rows ---
  if (!Array.isArray(raw.rows)) {
    fail('rows должен быть массивом строк');
    return empty;
  }
  if (raw.rows.length !== H) fail(`rows.length = ${raw.rows.length}, ожидается ${H}`);

  const grid = [];
  let rowsOk = true;
  for (let y = 0; y < raw.rows.length; y++) {
    const row = raw.rows[y];
    if (typeof row !== 'string') {
      fail(`строка ${y}: не строка`);
      rowsOk = false;
      continue;
    }
    if (row.length !== W) {
      fail(`строка ${y}: длина ${row.length}, ожидается ${W} — ${JSON.stringify(row)}`);
      rowsOk = false;
      continue;
    }
    const bad = [];
    for (const ch of row) if (!ALLOWED.includes(ch)) bad.push(ch);
    if (bad.length > 0) {
      fail(`строка ${y}: недопустимые символы ${JSON.stringify(bad.join(''))}`);
      rowsOk = false;
      continue;
    }
    grid.push([...row]);
  }
  if (!rowsOk || grid.length !== H) return empty;

  // --- счётчики ---
  const golds = [];
  const enemies = [];
  let start = null;
  let exit = null;
  const counts = { '=': 0, H: 0, '-': 0, $: 0, '@': 0, X: 0, E: 0 };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = grid[y][x];
      if (Object.prototype.hasOwnProperty.call(counts, ch)) counts[ch] += 1;
      if (ch === '$') golds.push({ x, y });
      else if (ch === 'X') enemies.push({ x, y });
      else if (ch === '@') start = { x, y };
      else if (ch === 'E') exit = { x, y };
    }
  }
  info.gold = golds.length;
  info.enemies = enemies.length;
  info.ladders = counts.H;
  info.ropes = counts['-'];
  info.bricks = counts['='];

  if (counts['@'] !== 1) fail(`символ @ должен встречаться ровно 1 раз (сейчас ${counts['@']})`);
  if (counts['E'] !== 1) fail(`символ E должен встречаться ровно 1 раз (сейчас ${counts['E']})`);
  if (counts.X < 1 || counts.X > 3) fail(`врагов X должно быть 1–3 (сейчас ${counts.X})`);
  if (counts.$ < 3 || counts.$ > 8) fail(`золота $ должно быть 3–8 (сейчас ${counts.$})`);

  // --- периметр ---
  for (let x = 0; x < W; x++) {
    if (grid[H - 1][x] !== '#') {
      fail(`периметр: нижняя строка (y=${H - 1}) должна быть из #, найдено '${grid[H - 1][x]}' в x=${x}`);
    }
  }
  for (let y = 1; y < H; y++) {
    if (grid[y][0] !== '#') fail(`периметр: левая стена (x=0) должна быть из # (y=${y})`);
    if (grid[y][W - 1] !== '#') fail(`периметр: правая стена (x=${W - 1}) должна быть из # (y=${y})`);
  }
  for (let x = 0; x < W; x++) {
    const ch = grid[0][x];
    if (ch === '#') continue;
    if (ch !== 'E' && ch !== 'H') {
      fail(`периметр: в верхней стене допустим проём только для E/H, найдено '${ch}' (x=${x})`);
      continue;
    }
    if (grid[1][x] !== 'H') {
      fail(`периметр: проём '${ch}' в верхней стене (x=${x}) должен опираться на лестницу H`);
    }
  }

  // --- опоры старта и врагов, выход в верхней части ---
  if (start && !hasSupport(grid, start.x, start.y)) {
    fail(`старт @ (${start.x},${start.y}) не стоит на опоре`);
  }
  for (const e of enemies) {
    if (!hasSupport(grid, e.x, e.y)) fail(`враг X (${e.x},${e.y}) не стоит на опоре`);
  }
  if (exit && exit.y > MAX_EXIT_Y) {
    fail(`выход E (${exit.x},${exit.y}) должен быть в верхней части поля (y ≤ ${MAX_EXIT_Y})`);
  }

  // --- BFS: достижимость золота и выхода без копания ---
  let reachable = null;
  if (start) {
    if (!PASSABLE.has(grid[start.y][start.x])) {
      fail('старт @ находится внутри стены');
    } else {
      reachable = bfs(grid, start.x, start.y);
      const missingGold = golds.filter((g) => !reachable.has(at(g.x, g.y)));
      info.goldReached = golds.length - missingGold.length;
      if (missingGold.length > 0) {
        fail(
          `недостижимо без копания золото: ${missingGold.map((g) => `(${g.x},${g.y})`).join(', ')}`,
        );
      }
      if (exit) {
        info.exitOk = reachable.has(at(exit.x, exit.y));
        if (!info.exitOk) fail(`выход E (${exit.x},${exit.y}) недостижим от @ без копания`);
      }
    }
  }

  // --- мягкие замечания (не влияют на OK/FAIL) ---
  if (info.ladders === 0) warnings.push('нет ни одной лестницы H');
  if (info.bricks === 0) warnings.push('нет кирпича = — уровень «стерильный», нечего копать');
  if (info.ropes === 0 && index >= 4 && index <= 5) warnings.push('уровень 5–6 без канатов');

  return { errors, warnings, info, grid, reachable };
}

/* ------------------------------------------------------------------ */
/* Печать карты с зонами достижимости                                  */
/* ------------------------------------------------------------------ */

function printMap(index, result) {
  const { grid, reachable, info } = result;
  console.log(`  карта ${index + 1}: «${info.name}»   (* = достижимо от @ без копания, ` +
    `строки — y, столбцы — x)`);
  console.log(`     ${Array.from({ length: W }, (_, x) => String(x % 10)).join('')}`);
  for (let y = 0; y < H; y++) {
    let line = '';
    for (let x = 0; x < W; x++) {
      const ch = grid[y][x];
      line += ch === '.' && reachable && reachable.has(at(x, y)) ? '*' : ch;
    }
    console.log(`  ${String(y).padStart(2, ' ')} ${line}`);
  }
  console.log('');
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

function main() {
  const argv = process.argv.slice(2);
  const mapFlag = argv.find((a) => a.startsWith('--map='));
  let mapTarget = null;
  if (mapFlag) {
    const val = mapFlag.slice('--map='.length);
    if (val === 'all') mapTarget = 'all';
    else {
      const n = Number(val);
      mapTarget = Number.isInteger(n) ? n : 'all';
    }
  }

  console.log('Lode Runner · валидатор уровней (28×16)\n');

  let levels;
  try {
    levels = loadLevels();
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
  if (!Array.isArray(levels)) {
    console.error('✗ window.LR_LEVELS должен быть массивом');
    process.exit(1);
  }

  const globalErrors = [];
  if (levels.length !== 10) {
    globalErrors.push(`window.LR_LEVELS: уровней ${levels.length}, ожидается ровно 10`);
  }

  const seenNames = new Map();
  let totalErrors = globalErrors.length;
  let totalGold = 0;
  let totalGoldReached = 0;
  let totalEnemies = 0;
  let okLevels = 0;

  levels.forEach((raw, i) => {
    const result = checkLevel(raw, i);
    const { info, errors, warnings } = result;

    if (info.name) {
      if (seenNames.has(info.name)) {
        errors.push(`Уровень ${i + 1}: имя «${info.name}» повторяет уровень ${seenNames.get(info.name) + 1}`);
      } else {
        seenNames.set(info.name, i);
      }
    }

    totalErrors += errors.length;
    totalGold += info.gold;
    totalGoldReached += info.goldReached;
    totalEnemies += info.enemies;
    if (errors.length === 0) okLevels += 1;

    const status = errors.length === 0 ? 'OK' : 'FAIL';
    const gold = `${info.goldReached}/${info.gold}`.padStart(5);
    const exit = (info.exitOk ? 'OK' : '--').padEnd(2);
    const name = (info.name || '???').padEnd(24, ' ');
    console.log(
      `[${String(i + 1).padStart(2)}] ${name} золото ${gold}  выход ${exit}  ` +
        `X=${info.enemies}  H=${String(info.ladders).padStart(2)}  ` +
        `-=${String(info.ropes).padStart(2)}  ${status}`,
    );

    for (const w of warnings) console.log(`     ! ${w}`);
    for (const e of errors) console.log(`     ✗ ${e}`);

    if (mapTarget !== null && (mapTarget === 'all' || mapTarget === i + 1)) {
      if (result.grid) printMap(i, result);
      else console.log('     (карта недоступна: сначала исправьте формат)\n');
    }
  });

  for (const e of globalErrors) console.log(`✗ ${e}`);

  if (totalErrors === 0) {
    console.log(
      `\nИтог: OK — ${levels.length} уровней, золото ${totalGoldReached}/${totalGold} достижимо, ` +
        `врагов ${totalEnemies}, ошибок нет.`,
    );
    process.exit(0);
  }

  console.log(`\nИтог: FAIL — ${totalErrors} ошибок, прошло уровней ${okLevels}/${levels.length}.`);
  process.exit(1);
}

main();
