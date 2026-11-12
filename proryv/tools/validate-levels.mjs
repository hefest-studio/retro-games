#!/usr/bin/env node
/**
 * Валидатор данных уровней ПРОРЫВ HTML5.
 *
 *   node proryv/tools/validate-levels.mjs [--verbose]
 *
 * Проверяет структуру, тайлы, сущности, спавн/выход, пары телепортов,
 * грубую достижимость выхода и печатает статистику сложности.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src", "levels.js");

const COLS = 32, ROWS = 24;
const TILES = new Set([" ", "#", "=", "%", "^", "x"]);
const SOLID = new Set(["#", "%", "^"]);          // опора/блок (шипы смертельны, но стоят)
const OPAQUE = new Set(["#", "%"]);              // блокирует движение
const THIN = new Set(["="]);
const HAZARD = new Set(["^"]);

const ENTITY_SPEC = {
  walker:          { solidForbidden: true },
  flyer:           { solidForbidden: false },
  swarmer:         { solidForbidden: false },
  turret:          { solidForbidden: true },
  tank:            { solidForbidden: true },
  mine:            { solidForbidden: true },
  crusher:         { solidForbidden: false },
  pod:             { solidForbidden: true },
  homer:           { solidForbidden: false },
  double_launcher: { solidForbidden: true },
  combo_launcher:  { solidForbidden: true },
  power_laser:     { solidForbidden: false },
  power_rocket:    { solidForbidden: false },
  exo:             { solidForbidden: true },
  teleporter:      { solidForbidden: true }
};

const SIZE = {
  walker: [14, 12], flyer: [16, 12], swarmer: [8, 8], turret: [12, 10], tank: [16, 12],
  mine: [8, 6], crusher: [16, 16], pod: [14, 12], homer: [14, 12],
  double_launcher: [12, 16], combo_launcher: [14, 16], power_laser: [8, 8],
  power_rocket: [8, 8], exo: [16, 20], teleporter: [12, 16]
};

const errors = [];
const warnings = [];
let errCount = 0;
const err = (where, msg) => { errCount++; errors.push(`${where}: ${msg}`); };
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

/* ---------- загрузка ---------- */
let levels;
try {
  const code = readFileSync(SRC, "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox, { filename: "levels.js", timeout: 5000 });
  levels = sandbox.window.PR_LEVELS;
} catch (e) {
  console.error("✗ levels.js не загружается:", e.message);
  process.exit(1);
}

/* ---------- утилиты ---------- */
function tileAt(tiles, x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return y >= ROWS ? "#" : " ";
  const row = tiles[y];
  return row ? (row[x] || " ") : " ";
}
const isOpaque = (tiles, x, y) => OPAQUE.has(tileAt(tiles, x, y));
const isSolid = (tiles, x, y) => SOLID.has(tileAt(tiles, x, y)) || y >= ROWS;

/** Стоит ли игрок на тайле (x,y): клетка свободна, под ней опора. */
function standable(tiles, x, y) {
  if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return false;
  const here = tileAt(tiles, x, y);
  if (here !== " " && here !== "x") return false;
  const below = tileAt(tiles, x, y + 1);
  return SOLID.has(below) || THIN.has(below);
}

/** Автоспавн — как в игре: нижний левый проходимый участок. */
function findSpawn(tiles) {
  for (let y = ROWS - 2; y >= 0; y--) {
    for (let x = 1; x < COLS - 1; x++) {
      if (standable(tiles, x, y) && !HAZARD.has(tileAt(tiles, x, y + 1))) return { x, y };
    }
  }
  return null;
}

/** Грубая достижимость: шаги/прыжки/падения по «стоячим» клеткам. */
function reachable(tiles, start) {
  const seen = new Set();
  const key = (x, y) => y * COLS + x;
  const q = [start];
  seen.add(key(start.x, start.y));
  let head = 0;
  const stand = (x, y) => standable(tiles, x, y);
  const blockedCol = (x, y0, y1) => {
    for (let y = y0; y <= y1; y++) if (isOpaque(tiles, x, y) || y < 0) return true;
    return false;
  };
  while (head < q.length) {
    const { x, y } = q[head++];
    /* падение вниз по той же колонке */
    for (let ny = y + 1; ny < ROWS; ny++) {
      if (isOpaque(tiles, x, ny)) break;
      if (stand(x, ny)) { push(x, ny); break; }
    }
    /* прыжок/шаг по горизонтали, вверх до 3 тайлов, вниз до 8 */
    for (let dx = -5; dx <= 5; dx++) {
      if (!dx) continue;
      const nx = x + dx;
      if (nx < 0 || nx >= COLS) continue;
      for (let dy = -3; dy <= 8; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= ROWS) continue;
        if (!stand(nx, ny)) continue;
        if (dy < 0) {
          // перепрыгивание: нужен просвет над стартом и над целью
          const top = Math.min(y, ny) - 1;
          if (top < 0) continue;
          if (blockedCol(x, ny - 1, y - 1) || blockedCol(nx, ny - 1, ny - 1)) continue;
        } else if (dy > 0) {
          // падение: горизонтальная траектория должна быть свободна на уровне цели
          let clear = true;
          for (let cx = Math.min(x, nx); cx <= Math.max(x, nx); cx++) {
            if (isOpaque(tiles, cx, ny - 1)) { clear = false; break; }
          }
          if (!clear) continue;
        } else if (isOpaque(tiles, nx, ny)) continue;
        push(nx, ny);
      }
    }
  }
  function push(x, y) {
    const k = key(x, y);
    if (seen.has(k)) return;
    seen.add(k);
    q.push({ x, y });
  }
  return seen;
}

/* ---------- проверки ---------- */
if (!Array.isArray(levels)) err("PR_LEVELS", "должен быть массивом");
else if (levels.length !== 5) err("PR_LEVELS", `уровней ${levels.length}, ожидается 5`);

const stats = [];

(levels || []).forEach((lv, li) => {
  const L = `уровень ${li + 1}`;
  if (!lv || typeof lv !== "object") { err(L, "не объект"); return; }
  if (!lv.name || !lv.name.ru || !lv.name.en) err(L, "нет name.ru / name.en");
  if (!["space", "cavern", "reactor", "hive", "core"].includes(lv.theme)) err(L, `theme «${lv.theme}» неизвестен`);
  if (!lv.intro || !lv.intro.ru) err(L, "нет intro.ru");
  if (!Array.isArray(lv.screens) || lv.screens.length !== 5) {
    err(L, `экранов ${lv.screens ? lv.screens.length : 0}, ожидается 5`);
    return;
  }

  lv.screens.forEach((sc, si) => {
    const W = `${L}/${si + 1}`;
    if (!sc || !Array.isArray(sc.tiles)) { err(W, "нет tiles[]"); return; }
    if (sc.tiles.length !== ROWS) err(W, `строк ${sc.tiles.length}, нужно ${ROWS}`);
    sc.tiles.forEach((row, y) => {
      if (typeof row !== "string") { err(W, `строка ${y} не строка`); return; }
      if (row.length !== COLS) err(W, `строка ${y}: длина ${row.length}, нужно ${COLS}`);
      for (let x = 0; x < row.length; x++) {
        if (!TILES.has(row[x])) err(W, `строка ${y} колонка ${x}: недопустимый тайл «${row[x]}»`);
      }
    });

    const tiles = sc.tiles.map((r) => (r + " ".repeat(COLS)).slice(0, COLS));

    /* спавн */
    const spawn = sc.spawn || findSpawn(tiles);
    if (!spawn) err(W, "нет ни одной площадки для спавна");
    else {
      if (!standable(tiles, spawn.x, spawn.y)) err(W, `спавн (${spawn.x},${spawn.y}) не на опоре`);
      if (HAZARD.has(tileAt(tiles, spawn.x, spawn.y + 1))) err(W, "спавн на шипах");
      if (spawn.x > 4) warn(W, `спавн слишком справа: x=${spawn.x}`);
    }

    /* выход справа */
    let exitCells = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = COLS - 2; x < COLS; x++) {
        if (standable(tiles, x, y)) exitCells.push({ x, y });
      }
    }
    if (!exitCells.length) err(W, "нет площадки у правого края — игрок не сможет выйти");
    if (spawn) {
      const reach = reachable(tiles, spawn);
      const ok = exitCells.some((c) => reach.has(c.y * COLS + c.x));
      if (!ok) warn(W, "выход справа недостижим по грубой оценке (проверьте прыжки/уступы)");
    }

    /* сущности */
    const ents = Array.isArray(sc.entities) ? sc.entities : [];
    if (!Array.isArray(sc.entities)) warn(W, "нет entities[] — пусть будет []");
    const teleGroups = {};
    ents.forEach((e, ei) => {
      const where = `${W} entity#${ei} ${e && e.t}`;
      if (!e || typeof e !== "object") { err(W, `entity#${ei} не объект`); return; }
      const spec = ENTITY_SPEC[e.t];
      if (!spec) { err(where, "неизвестный тип"); return; }
      if (!Number.isInteger(e.x) || !Number.isInteger(e.y)) { err(where, "x/y должны быть целыми"); return; }
      if (e.x < 0 || e.x >= COLS || e.y < 0 || e.y >= ROWS) { err(where, `координаты вне сетки (${e.x},${e.y})`); return; }
      const [w, h] = SIZE[e.t];
      const px = e.x * 8, py = (e.y + 1) * 8 - h;
      const x0 = Math.floor(px / 8), x1 = Math.floor((px + w - 1) / 8);
      const y0 = Math.floor(py / 8), y1 = Math.floor((py + h - 1) / 8);
      let insideSolid = false;
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (isOpaque(tiles, tx, ty)) insideSolid = true;
        }
      }
      if (insideSolid && spec.solidForbidden) err(where, `стоит внутри твёрдого блока (низ в строке ${e.y})`);
      if (e.t === "teleporter") {
        if (![1, 2, 3].includes(e.group)) err(where, "телепорту нужен group 1..3");
        else teleGroups[e.group] = (teleGroups[e.group] || 0) + 1;
      }
      if (e.t === "crusher" && y0 < 1) warn(where, "молот должен крепиться к потолку");
    });
    Object.keys(teleGroups).forEach((g) => {
      if (teleGroups[g] !== 2) err(W, `телепортов с group=${g}: ${teleGroups[g]}, нужно ровно 2`);
    });

    /* обязательные элементы уровня */
    if (si === 2 && li >= 0) {
      if (!ents.some((e) => e && e.t === "exo")) err(W, "на 3-м экране уровня нет капсулы exo");
      if (ents.filter((e) => e && e.t === "exo").length > 1) err(W, "капсул exo больше одной");
    }

    stats.push({
      level: li + 1, screen: si + 1,
      enemies: ents.filter((e) => e && ["walker", "flyer", "turret", "tank", "mine", "pod", "homer", "swarmer", "crusher", "colony"].includes(e.t)).length,
      pickups: ents.filter((e) => e && ["power_laser", "power_rocket", "double_launcher", "combo_launcher", "exo"].includes(e.t)).length,
      destructible: tiles.join("").split("%").length - 1,
      hazards: tiles.join("").split("^").length - 1
    });
  });
});

/* ---------- отчёт ---------- */
const verbose = process.argv.includes("--verbose");
if (errors.length) {
  console.log(`✗ ОШИБКИ (${errors.length}):`);
  errors.slice(0, 60).forEach((e) => console.log("   " + e));
  if (errors.length > 60) console.log(`   ... ещё ${errors.length - 60}`);
} else {
  console.log("✓ структура и правила — без ошибок");
}
if (warnings.length) {
  console.log(`⚠ предупреждения (${warnings.length}):`);
  warnings.slice(0, verbose ? 100 : 15).forEach((w) => console.log("   " + w));
}

if (verbose || !errors.length) {
  console.log("\nуровень/экран  враги  подборы  камни  шипы");
  stats.forEach((s) => {
    console.log(`${String(s.level).padStart(3)}/${s.screen}          ${String(s.enemies).padStart(3)}  ${String(s.pickups).padStart(4)}  ${String(s.destructible).padStart(5)}  ${String(s.hazards).padStart(4)}`);
  });
}

process.exit(errCount ? 1 : 0);
