#!/usr/bin/env node
/**
 * validate-levels.mjs — автотест уровней СЕВЕРНОЙ САГИ (без зависимостей).
 *
 * Проверяет CONTRACT.md, раздел 3:
 *   1. ровно 10 уровней, id 1..10, theme/name/hint (RU+EN), hint <= 100;
 *   2. rows: ровно 15 строк по 24 символа, только символы из таблицы 2.5;
 *   3. периметр — только '#';
 *   4. ровно один E, один &, один O; ровно три X; exitFor — перестановка
 *      ["snorri","gunnar","bjorn"] в порядке X при сканировании (сверху вниз, слева
 *      направо); каждый викинг обязан достигать ИМЕННО своей двери;
 *   5. старты/выходы: клетка не твёрдая/не шипы/не ловушка, под ней опора;
 *      плиты 1–4 стоят на твёрдой опоре (#/B);
 *   6. щедрая достижимость: ворота открыты, B убраны, враги/ловушки игнорируются;
 *      каждый старт достигает хотя бы одного X, каждый * — хотя бы одним викингом.
 *      Модель: шаг по горизонтали, прыжок вверх (Snorri +3, Gunnar +2, Bjorn +1),
 *      прыжок через пропасть (Snorri 4, Gunnar 3, Bjorn 2 кл.), падение вниз,
 *      односторонние платформы '=', плюс щит Бьорна как ступень (щедро/кооперативно:
 *      стоящий на щите = на 1 клетку выше узла Бьорна).
 *   7. покрытие механик по всем уровням (таран B, рычаги 5–8, плиты 1–4, ловушки,
 *      враги, '=', шипы). Обязательность щита/плиты доказывается в docs/LEVELS.md.
 *
 * Использование:
 *   node saga/tools/validate-levels.mjs [путь-к-файлу-с-уровнями] [--verbose]
 *   По умолчанию уровни берутся из js/game.js (секция «src/levels.js» сборки).
 *   --verbose печатает карты достижимости по каждому викингу (для дизайна);
 *   --matrix  печатает матрицу «викинг → доступные двери» (для дизайна).
 *
 * Код возврата: 0 — OK, 1 — ошибки/не все уровни прошли.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(HERE, "..");

const W = 24;
const H = 15;
const LEVEL_COUNT = 10;
const THEMES = new Set(["cave", "forge", "ice", "forest", "castle", "void"]);

// Прыжки (CONTRACT 2.2.1): вверх — клетки; через пропасть — щедрая оценка запаса хода.
// Точная модель прыжков (по высоте из CONTRACT 2.2.1 + запас хода по физике):
//   up — на сколько клеток вверх берёт уступ; upDx — горизонтальный снос при
//   прыжке вверх; across — максимальная ширина пропасти (в клетках, dy=0).
// Snorri: 130 px/с, 400 вверх, g=1400 -> ~74 px хода, уступ 3.
// Gunnar: 95 px/с, 330 -> ~45 px, уступ 2. Bjorn: 75 px/с, 260 -> ~28 px, уступ 1.
const CHARS = {
  snorri: { up: 3, upDx: 2, across: 4 },
  gunnar: { up: 2, upDx: 1, across: 2 },
  bjorn: { up: 1, upDx: 1, across: 1 }
};
const CHAR_LABEL = { snorri: "E", gunnar: "&", bjorn: "O" };

// --- классификация тайлов -------------------------------------------------
const isGate = (c) => c >= "a" && c <= "d";
const isPlate = (c) => c >= "1" && c <= "4";
const isLever = (c) => c >= "5" && c <= "8";
const isTrap = (c) => c === "<" || c === ">";
const isSpawn = (c) => c === "E" || c === "&" || c === "O";

const ALLOWED = new Set([
  ".", "#", "B", "=", "^",
  "a", "b", "c", "d",
  "1", "2", "3", "4",
  "5", "6", "7", "8",
  "<", ">", "M", "*",
  "E", "&", "O", "X"
]);

// Свободная для тела клетка в «щедром» мире (ворота открыты, B убраны).
// Плита 1–4 — НЕ опора: викинг стоит в её клетке, а твёрдая опора лежит под плитой
// (уточнено Lead: клетка P, опора P+1, ноги на P+1).
const freeGen = (c) =>
  c === "." || c === "*" || c === "X" ||
  c === "M" || isTrap(c) || isLever(c) || isSpawn(c) || isPlate(c);

// Опора, на которую можно встать.
const supportGen = (c) => c === "#" || c === "=";

// Вверх сквозь '=' можно пролезть (односторонняя платформа снизу).
const freeUp = (c) => freeGen(c) || c === "=";

// --- загрузка -------------------------------------------------------------
function parseArgs(argv) {
  const out = { file: null, verbose: false, matrix: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--verbose" || a === "-v") out.verbose = true;
    else if (a === "--matrix" || a === "-m") out.matrix = true;
    else if (!a.startsWith("-")) out.file = a;
    else {
      console.error(`Неизвестный флаг: ${a}`);
      process.exit(2);
    }
  }
  return out;
}

function loadLevels(file) {
  if (!existsSync(file)) {
    console.error(`Файл не найден: ${file}`);
    process.exit(2);
  }
  let src = readFileSync(file, "utf8");
  // js/game.js — склейка модулей: берём только секцию уровней
  const START = "/* ==== src/levels.js ==== */";
  const at = src.indexOf(START);
  if (at >= 0) {
    const rest = src.slice(at + START.length);
    const end = rest.indexOf("/* ==== src/");
    src = end >= 0 ? rest.slice(0, end) : rest;
  }
  const sandbox = { window: {} };
  try {
    vm.createContext(sandbox);
    new vm.Script(src, { filename: file }).runInContext(sandbox);
  } catch (e) {
    console.error(`Ошибка выполнения ${file}:`);
    console.error(`  ${e && e.stack ? e.stack.split("\n").slice(0, 4).join("\n  ") : e}`);
    process.exit(2);
  }
  const levels = sandbox.window && sandbox.window.SAGA_LEVELS;
  if (!Array.isArray(levels)) {
    console.error(`В ${file} нет window.SAGA_LEVELS (массива).`);
    process.exit(2);
  }
  return levels;
}

// --- мир уровня -----------------------------------------------------------
function makeWorld(rows) {
  const real = rows.map((r) => r.split(""));
  // «Щедрый» мир: ворота открыты, кирпичи сломаны.
  const gen = real.map((row) => row.map((c) => (c === "B" || isGate(c) ? "." : c)));
  const atR = (x, y) =>
    y < 0 || y >= H || x < 0 || x >= W ? "#" : real[y][x];
  const atG = (x, y) =>
    y < 0 || y >= H || x < 0 || x >= W ? "#" : gen[y][x];

  const standable = (x, y) =>
    x >= 0 && x < W && y >= 1 && y < H &&
    freeGen(atG(x, y)) && freeGen(atG(x, y - 1)) && supportGen(atG(x, y + 1));

  return { real, gen, atR, atG, standable };
}

// --- щедрая достижимость --------------------------------------------------
function reachSet(world, charId, extraNodes) {
  const { atG, standable } = world;
  const extra = extraNodes || new Set();
  const key = (x, y) => y * W + x;
  const nodeOk = (x, y) =>
    standable(x, y) || extra.has(key(x, y));

  const start = world.spawns[charId];
  if (!start) return { set: new Set(), start: null };
  const seen = new Set([key(start.x, start.y)]);
  const queue = [start];
  const sk = CHARS[charId];

  const push = (x, y) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    if (!nodeOk(x, y)) return;
    const k = key(x, y);
    if (seen.has(k)) return;
    seen.add(k);
    queue.push({ x, y });
  };

  while (queue.length) {
    const cur = queue.shift();
    const { x, y } = cur;

    // горизонтальный шаг на том же уровне
    for (const dx of [-1, 1]) push(x + dx, y);

    // прыжок вверх (до 3/2/1 клетки): сначала проверяем, что над головой свободно
    let clear = true;
    for (let dy = 1; dy <= sk.up; dy++) {
      if (!freeUp(atG(x, y - dy))) { clear = false; break; }
    }
    if (clear) {
      for (let dy = 1; dy <= sk.up; dy++) {
        for (let dx = -sk.upDx; dx <= sk.upDx; dx++) push(x + dx, y - dy);
      }
    }

    // прыжок через пропасть/шипы на том же уровне
    for (let dx = 2; dx <= sk.across; dx++) {
      // промежуточные клетки не должны быть твёрдыми
      let pathOk = true;
      for (let k = 1; k < dx; k++) {
        if (!freeGen(atG(x + Math.sign(dx) * k, y))) { pathOk = false; break; }
      }
      if (pathOk) {
        push(x + dx, y);
        push(x - dx, y);
      }
    }

    // падение вниз (шаг за край / спрыгивание)
    for (let dx = -1; dx <= 1; dx++) {
      const x2 = x + dx;
      if (dx !== 0) {
        const side = atG(x2, y);
        if (!freeGen(side)) continue; // вбок упёрлись
      }
      for (let y2 = y + 1; y2 < H; y2++) {
        if (nodeOk(x2, y2)) { push(x2, y2); break; }
        const c = atG(x2, y2);
        if (c === "^") break;                    // напоролись на шипы
        if (c === "#" || c === "=" || isPlate(c)) break; // упёрлись в опору
      }
    }
  }

  return { set: seen, start };
}

function computeReach(world) {
  const key = (x, y) => y * W + x;
  const bjorn = reachSet(world, "bjorn", null);

  // Щит Бьорна как ступень: узел на 1 клетку выше Бьорна.
  const shield = new Set();
  for (const k of bjorn.set) {
    const x = k % W;
    const y = (k - x) / W;
    const sy = y - 1;
    if (sy >= 2 && freeGen(world.atG(x, sy)) && freeGen(world.atG(x, sy - 1))) {
      shield.add(key(x, sy));
    }
  }

  const snorri = reachSet(world, "snorri", shield);
  const gunnar = reachSet(world, "gunnar", shield);
  return { snorri, gunnar, bjorn, shield };
}

// --- проверка одного уровня ----------------------------------------------
function checkLevel(level, idx) {
  const errors = [];
  const stats = {
    treasures: 0, gates: 0, plates: 0, levers: 0, traps: 0,
    enemies: 0, bricks: 0, spikes: 0, exits: 0, oneway: 0
  };
  const err = (m) => errors.push(`ур. ${idx + 1}: ${m}`);

  if (!level || typeof level !== "object") {
    return { errors: [`ур. ${idx + 1}: не объект`], stats, reach: null };
  }
  if (level.id !== idx + 1) err(`id = ${JSON.stringify(level.id)}, ожидается ${idx + 1}`);
  if (!THEMES.has(level.theme)) err(`theme = ${JSON.stringify(level.theme)} (не из cave|forge|ice|forest|castle|void)`);
  for (const lang of ["ru", "en"]) {
    for (const field of ["name", "hint"]) {
      const v = level[field] && level[field][lang];
      if (typeof v !== "string" || v.trim() === "") {
        err(`${field}.${lang} пуст или не строка`);
      } else if (field === "hint" && v.length > 100) {
        err(`hint.${lang} длиной ${v.length} > 100 символов`);
      }
    }
  }

  const rows = level.rows;
  if (!Array.isArray(rows) || rows.length !== H) {
    err(`rows.length = ${Array.isArray(rows) ? rows.length : "не массив"}, ожидается ${H}`);
    return { errors, stats, reach: null };
  }

  // 2. строки/символы
  for (let y = 0; y < H; y++) {
    const row = rows[y];
    if (typeof row !== "string") {
      err(`rows[${y}] не строка`);
      continue;
    }
    if (row.length !== W) err(`rows[${y}].length = ${row.length}, ожидается ${W}`);
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (!ALLOWED.has(c)) err(`rows[${y}][${x}] = ${JSON.stringify(c)} — символ не из таблицы 2.5`);
    }
  }
  if (errors.length) return { errors, stats, reach: null };

  const world = makeWorld(rows);
  const { atR } = world;

  // 3. периметр
  for (let x = 0; x < W; x++) {
    if (atR(x, 0) !== "#") err(`периметр: (${x},0) = ${JSON.stringify(atR(x, 0))}, нужен '#'`);
    if (atR(x, H - 1) !== "#") err(`периметр: (${x},${H - 1}) = ${JSON.stringify(atR(x, H - 1))}, нужен '#'`);
  }
  for (let y = 0; y < H; y++) {
    if (atR(0, y) !== "#") err(`периметр: (0,${y}) = ${JSON.stringify(atR(0, y))}, нужен '#'`);
    if (atR(W - 1, y) !== "#") err(`периметр: (${W - 1},${y}) = ${JSON.stringify(atR(W - 1, y))}, нужен '#'`);
  }

  // 4. спавны/выходы + статистика
  const spawnPos = {};
  const exits = [];
  const treasures = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = atR(x, y);
      if (isSpawn(c)) {
        if (spawnPos[c]) err(`спавн '${c}' встречается больше одного раза`);
        spawnPos[c] = { x, y };
      }
      if (c === "X") exits.push({ x, y });
      if (c === "*") treasures.push({ x, y });
      if (c === "B") stats.bricks++;
      if (c === "=") stats.oneway++;
      if (c === "^") stats.spikes++;
      if (c === "M") stats.enemies++;
      if (isTrap(c)) stats.traps++;
      if (isLever(c)) stats.levers++;
      if (isPlate(c)) stats.plates++;
      if (isGate(c)) stats.gates++;
    }
  }
  stats.treasures = treasures.length;
  stats.exits = exits.length;
  stats.exitFor = null;
  world.spawns = {};
  if (!spawnPos.E) err("нет старта E (Снорри)");
  if (!spawnPos["&"]) err("нет старта & (Гуннар)");
  if (!spawnPos.O) err("нет старта O (Бьорн)");
  world.spawns.snorri = spawnPos.E;
  world.spawns.gunnar = spawnPos["&"];
  world.spawns.bjorn = spawnPos.O;

  if (exits.length !== 3) err(`выходов X = ${exits.length}, ожидается ровно 3`);

  // 4b. назначение дверей: перестановка ролей в порядке обхода X
  const ROLES = ["snorri", "gunnar", "bjorn"];
  let exitFor = level.exitFor;
  if (!Array.isArray(exitFor) || exitFor.length !== 3) {
    err("нет exitFor: нужен массив из 3 ролей (snorri/gunnar/bjorn)");
    exitFor = null;
  } else {
    const seenRoles = {};
    for (let i = 0; i < exitFor.length; i++) {
      const role = exitFor[i];
      if (!ROLES.includes(role)) {
        err(`exitFor[${i}] = ${JSON.stringify(role)}, ожидается snorri|gunnar|bjorn`);
      } else if (seenRoles[role]) {
        err(`exitFor: роль ${role} встречается дважды`);
      }
      seenRoles[role] = true;
    }
    for (const role of ROLES) {
      if (!seenRoles[role]) err(`exitFor: нет роли ${role}`);
    }
    if (exitFor.every((r) => ROLES.includes(r)) && new Set(exitFor).size === 3) {
      stats.exitFor = exitFor.slice();
    } else {
      exitFor = null;
    }
  }
  stats.exitCoords = exits.slice();
  if (exitFor) {
    // выход должен быть дверью именно этого викинга
    stats.exitForCoords = {};
    for (let i = 0; i < 3; i++) stats.exitForCoords[exitFor[i]] = exits[i];
  }

  // 5. опоры стартов/выходов; плиты на твёрдой опоре
  const solidReal = (c) => c === "#" || c === "B" || isGate(c);
  const supportReal = (c) => c === "#" || c === "B" || c === "=" || isGate(c);
  const checkPost = (p, what, allowX) => {
    const x = p.x, y = p.y;
    const c = atR(x, y);
    if (solidReal(c)) err(`${what} (${x},${y}) стоит в твёрдом тайле '${c}'`);
    if (c === "^") err(`${what} (${x},${y}) на шипах`);
    if (isTrap(c)) err(`${what} (${x},${y}) на ловушке '${c}'`);
    if (!allowX && c === "X") err(`${what} (${x},${y}) совпадает с выходом`);
    const below = atR(x, y + 1);
    if (!supportReal(below)) err(`${what} (${x},${y}): под клеткой '${below}', нужна опора #/B/=/закрытые ворота`);
    // место под тело (22 px): клетка и клетка над ней не твёрдые
    if (solidReal(atR(x, y - 1))) err(`${what} (${x},${y}): над головой твёрдый тайл '${atR(x, y - 1)}'`);
  };
  for (const id of ["snorri", "gunnar", "bjorn"]) {
    const p = world.spawns[id];
    if (!p) continue;
    checkPost(p, `старт ${CHAR_LABEL[id]}`, false);
  }
  for (const p of exits) checkPost(p, "выход X", true);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isPlate(atR(x, y))) continue;
      const below = atR(x, y + 1);
      if (below !== "#" && below !== "B") {
        err(`плита '${atR(x, y)}' (${x},${y}): под ней '${below}', нужна твёрдая опора #/B`);
      }
    }
  }

  // ошибки exitFor не мешают посчитать достижимость (нужно для подбора дверей)
  const geomErrors = errors.filter((e) => !/exitFor/.test(e));
  if (geomErrors.length) return { errors, stats, reach: null };

  // 6. достижимость
  const reach = computeReach(world);
  const keyOf = (p) => p.y * W + p.x;
  const reachable = {
    snorri: reach.snorri.set,
    gunnar: reach.gunnar.set,
    bjorn: reach.bjorn.set
  };
  // каждый викинг должен достигать СВОЕЙ двери (exitFor), а не «какой-нибудь»
  const xReach = { snorri: false, gunnar: false, bjorn: false };
  const exitsOf = { snorri: [], gunnar: [], bjorn: [] };
  for (const id of ["snorri", "gunnar", "bjorn"]) {
    for (const p of exits) if (reachable[id].has(keyOf(p))) exitsOf[id].push(p);
  }
  if (exitFor) {
    for (let i = 0; i < 3; i++) {
      const id = exitFor[i];
      const p = exits[i];
      xReach[id] = reachable[id].has(keyOf(p));
      if (!xReach[id]) {
        const list = exitsOf[id].length
          ? "доступны только X: " + exitsOf[id].map((q) => `(${q.x},${q.y})`).join(", ")
          : "не достигает ни одного X";
        err(`дверь ${CHAR_LABEL[id]} — X(${p.x},${p.y}), но ${id} её не достигает (${list})`);
      }
    }
  } else {
    for (const id of ["snorri", "gunnar", "bjorn"]) {
      xReach[id] = exitsOf[id].length > 0;
    }
  }

  // сокровища: достижимы хотя бы одним живым викингом (щедро: клетка или соседняя по сетке)
  const allReach = new Set([...reachable.snorri, ...reachable.gunnar, ...reachable.bjorn]);
  const treasureOk = treasures.map((p) => {
    const k = keyOf(p);
    if (allReach.has(k)) return true;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = p.x + dx, y = p.y + dy;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        if (allReach.has(y * W + x)) return true;
      }
    }
    return false;
  });
  const treasureTotal = treasures.length;
  const treasureReached = treasureOk.filter(Boolean).length;
  if (treasureReached !== treasureTotal) {
    const bad = treasures.filter((_, i) => !treasureOk[i]).map((p) => `(${p.x},${p.y})`).join(", ");
    err(`щедрая достижимость: сокровища недоступны ни одному викингу: ${bad}`);
  }

  if (errors.length) {
    return { errors, stats, reach, xReach, treasureReached, treasureTotal, exitFor: exitFor || null, exits: exits.slice(), exitsOf };
  }

  return {
    errors, stats, reach, xReach,
    treasureReached, treasureTotal,
    exitFor: exitFor || null,
    exits: exits.slice(),
    exitsOf,
    checks: {
      treasures: treasureTotal,
      reachX: xReach,
      shieldUsed: reach.shield.size > 0
    }
  };
}

// --- вывод ----------------------------------------------------------------
function pad(s, n) {
  s = String(s);
  // грубая ширина без учёта кириллицы: достаточно для таблицы
  let len = 0;
  for (const ch of s) len += /[А-Яа-яЁё]/.test(ch) ? 1 : 1;
  while (len < n) { s += " "; len++; }
  return s;
}

function doorLabel(r) {
  if (!r.exitFor || !r.exits) return "-";
  const short = { snorri: "E", gunnar: "&", bjorn: "O" };
  return r.exitFor
    .map((role, i) => `${short[role]}\u2192(${r.exits[i].x},${r.exits[i].y})`)
    .join(" ");
}

function printTable(rows) {
  const head = [
    pad("id", 3), pad("тема", 7), pad("название", 20),
    pad("24×15", 6), pad("*", 6), pad("вор", 4), pad("плит", 5),
    pad("рыч", 4), pad("лов", 4), pad("враг", 5), pad("кирп", 5),
    pad("шипы", 5), pad("двери (E/&/O)", 30), pad("ok", 4)
  ].join(" ");
  console.log(head);
  console.log("-".repeat(head.length));
  for (const r of rows) {
    const st = r.stats || {};
    const tx = r.treasureTotal == null ? "-" : `${r.treasureReached}/${r.treasureTotal}`;
    const xr = r.xReach
      ? [r.xReach.snorri, r.xReach.gunnar, r.xReach.bjorn].map((v) => (v ? "+" : "-")).join(" ")
      : "- - -";
    console.log([
      pad(r.id, 3), pad(r.theme || "?", 7), pad(r.name || "?", 20),
      pad(r.rowsOk == null ? "?" : (r.rowsOk ? "OK" : "FAIL"), 6),
      pad(tx, 6), pad(st.gates || 0, 4), pad(st.plates || 0, 5),
      pad(st.levers || 0, 4), pad(st.traps || 0, 4), pad(st.enemies || 0, 5),
      pad(st.bricks || 0, 5), pad(st.spikes || 0, 5),
      pad(doorLabel(r) + " " + xr, 30),
      pad(r.ok ? "OK" : "FAIL", 4)
    ].join(" "));
  }
}

// Для дизайна: какие двери достижимы каждым викингом (щедрая модель).
function printMatrix(results) {
  console.log("");
  console.log("Матрица достижимости дверей (E / & / O):");
  for (const r of results) {
    if (!r.exits || !r.exitsOf) continue;
    const parts = ["snorri", "gunnar", "bjorn"].map((id) => {
      const list = r.exitsOf[id].map((p) => `(${p.x},${p.y})`).join(",") || "-";
      return `${CHAR_LABEL[id]}: [${list}]`;
    });
    const doors = r.exits.map((p, i) => `${r.exitFor ? (r.exitFor[i] || "?") : "?"}(${p.x},${p.y})`).join(" ");
    console.log(`  ур.${String(r.id).padStart(2)}  X: ${doors}   ${parts.join("  ")}`);
  }
}

function printVerbose(level, idx, result) {
  if (!result || !result.reach) return;
  console.log(`\n── уровень ${idx + 1}: ${level.name ? level.name.ru : "?"} ──`);
  const { real } = makeWorld(level.rows);
  const sets = {
    e: result.reach.snorri.set,
    b: result.reach.gunnar.set,
    o: result.reach.bjorn.set
  };
  for (let y = 0; y < H; y++) {
    let line = "";
    for (let x = 0; x < W; x++) {
      const c = real[y][x];
      if (c !== ".") { line += c; continue; }
      const k = y * W + x;
      const marks = [];
      if (sets.e.has(k)) marks.push("e");
      if (sets.b.has(k)) marks.push("b");
      if (sets.o.has(k)) marks.push("o");
      line += marks.length ? (marks.length === 3 ? "3" : marks.join("")) : ".";
    }
    console.log(String(y).padStart(2, " ") + " " + line);
  }
}

// --- main -----------------------------------------------------------------
function main() {
  const args = parseArgs(process.argv);
  const file = args.file ? resolve(args.file) : join(PROJECT, "js", "game.js");
  const levels = loadLevels(file);

  console.log("СЕВЕРНАЯ САГА — проверка уровней");
  console.log(`файл: ${file}`);
  console.log("");

  const results = [];
  const allErrors = [];

  if (levels.length !== LEVEL_COUNT) {
    allErrors.push(`уровней ${levels.length}, ожидается ровно ${LEVEL_COUNT}`);
  }

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const rowsOk = Array.isArray(level && level.rows) &&
      level.rows.length === H &&
      level.rows.every((r) => typeof r === "string" && r.length === W);
    let res;
    try {
      res = checkLevel(level, i);
    } catch (e) {
      res = { errors: [`ур. ${i + 1}: исключение при проверке: ${e && e.message ? e.message : e}`], stats: {} };
    }
    const ok = res.errors.length === 0;
    if (!ok) allErrors.push(...res.errors);
    results.push({
      id: level && level.id != null ? level.id : i + 1,
      theme: level && level.theme,
      name: level && level.name && level.name.ru,
      rowsOk,
      ok,
      stats: res.stats,
      xReach: res.xReach,
      exitFor: res.exitFor,
      exits: res.exits,
      exitsOf: res.exitsOf,
      treasureReached: res.treasureReached,
      treasureTotal: res.treasureTotal
    });
    if (args.verbose) printVerbose(level, i, res);
  }

  if (args.verbose) console.log("");
  printTable(results);
  if (args.matrix) printMatrix(results);

  // покрытие механик (п.7)
  const sum = (field) => results.reduce((a, r) => a + ((r.stats && r.stats[field]) || 0), 0);
  const totals = {
    bricks: sum("bricks"), levers: sum("levers"), plates: sum("plates"),
    traps: sum("traps"), enemies: sum("enemies"), oneway: sum("oneway"),
    spikes: sum("spikes")
  };
  const coverage = [
    ["таран B (кирпичи)", totals.bricks > 0],
    ["рычаги 5–8", totals.levers > 0],
    ["плиты 1–4", totals.plates > 0],
    ["ловушки < >", totals.traps > 0],
    ["враги M", totals.enemies > 0],
    ["платформы =", totals.oneway > 0],
    ["шипы ^", totals.spikes > 0]
  ];
  console.log("");
  console.log("Покрытие механик (обязательность щита/плиты — в docs/LEVELS.md):");
  for (const [name, ok] of coverage) {
    console.log(`  ${ok ? "OK  " : "FAIL"} ${name}`);
    if (!ok) allErrors.push(`механика не встречается ни в одном уровне: ${name}`);
  }

  const passed = results.filter((r) => r.ok).length;
  const reachCount = { snorri: 0, gunnar: 0, bjorn: 0 };
  let trTotal = 0, trReached = 0;
  for (const r of results) {
    if (r.xReach) {
      for (const id of ["snorri", "gunnar", "bjorn"]) if (r.xReach[id]) reachCount[id]++;
    }
    trTotal += r.treasureTotal || 0;
    trReached += r.treasureReached || 0;
  }

  // docs/LEVELS.md — необязательный, но ожидаемый артефакт задачи
  const docsPath = join(PROJECT, "docs", "LEVELS.md");
  const docsText = existsSync(docsPath) ? readFileSync(docsPath, "utf8") : "";
  const missingDocs = [];
  for (let i = 1; i <= LEVEL_COUNT; i++) {
    if (!docsText.includes(`## Уровень ${i} `)) missingDocs.push(i);
  }
  const docsOk = docsText.includes("## Уровень 1 ") && missingDocs.length === 0;

  console.log("");
  console.log(`Достижимость X: E ${reachCount.snorri}/${passed || LEVEL_COUNT}, ` +
    `& ${reachCount.gunnar}/${passed || LEVEL_COUNT}, O ${reachCount.bjorn}/${passed || LEVEL_COUNT}; ` +
    `сокровища ${trReached}/${trTotal}`);
  console.log(`docs/LEVELS.md: ${docsOk ? "OK (10/10 прохождений)" : "нет/неполный" + (missingDocs.length ? " (нет уровней: " + missingDocs.join(", ") + ")" : "")}`);
  console.log("");

  if (allErrors.length) {
    console.log("Ошибки:");
    for (const e of allErrors) console.log(`  ✗ ${e}`);
    console.log("");
    console.log(`FAIL — ${passed}/${levels.length}`);
    process.exitCode = 1;
    return;
  }

  console.log(`OK — ${passed}/${levels.length}`);
  process.exitCode = passed === LEVEL_COUNT ? 0 : 1;
}

main();
