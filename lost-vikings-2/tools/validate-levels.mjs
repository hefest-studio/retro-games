#!/usr/bin/env node
/* ==========================================================================
   Валидатор уровней Lost Vikings 2 (node, без зависимостей).
   Проверяет: формат/тайлы/границы, спавны, exit/руны/чекпоинты/знаки,
   группы дверей и их активаторы, ломаемость льда Эриком,
   BFS-эвристику достижимости выхода для каждого викинга с учётом
   способностей (прыжок, парение, крюк, лестницы, щит Олафа).

   Запуск: node tools/validate-levels.mjs
   Выход: 0 и "OK: 6 уровней" либо 1 и список ошибок.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEVELS_FILE = path.join(ROOT, 'js', 'levels.js');

const errors = [];
const warnings = [];
function err(lv, msg) { errors.push(lv === null ? msg : `[У${lv + 1}] ${msg}`); }
function warn(lv, msg) { warnings.push(lv === null ? msg : `[У${lv + 1}] ${msg}`); }

/* ------------------------------------------------------------------ загрузка */
let LEVELS;
try {
  const src = fs.readFileSync(LEVELS_FILE, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { filename: 'js/levels.js', timeout: 2000 });
  const LV = sandbox.window && sandbox.window.LV;
  LEVELS = LV && LV.LEVELS;
} catch (e) {
  console.error('FAIL: не удалось загрузить js/levels.js —', e.message);
  process.exit(1);
}
if (!Array.isArray(LEVELS)) {
  console.error('FAIL: LV.LEVELS не массив');
  process.exit(1);
}

const TILE_CHARS = new Set(['.', '#', '=', '^', '~', 'L', 'G', 'T']);
const ACTORS = ['erik', 'baleog', 'olaf'];
const GROUPS = ['a', 'b', 'c', 'd'];
const ENEMY_KINDS = new Set(['grunt', 'thrower', 'bat']);
const SOLID_TILES = new Set(['#', '=']);

/* --------------------------------------------------------------- модель уровня */
function buildModel(lv) {
  const grid = lv.rows.map((r) => String(r).split(''));
  const rows = grid.length;
  const cols = rows ? grid[0].length : 0;
  const ents = Array.isArray(lv.entities) ? lv.entities : [];
  const doors = ents.filter((e) => e.type === 'door');
  const plates = ents.filter((e) => e.type === 'plate');
  const levers = ents.filter((e) => e.type === 'lever');
  const platforms = ents.filter((e) => e.type === 'platform');
  return { lv, grid, rows, cols, ents, doors, plates, levers, platforms };
}

/* --------------------------------------------------------- карта проходимости */
/**
 * Строит проходимость/опоры для BFS.
 * opts.doorsClosed — группа дверей, которые считаются закрытыми.
 */
function buildTiles(M, opts) {
  opts = opts || {};
  const closed = opts.doorsClosed || null;
  const { cols, rows, grid, doors, platforms } = M;
  const inb = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows;

  // какие клетки заняты дверями
  const doorAt = new Map();
  for (const d of doors) {
    const dw = d.w || 1, dh = d.h || 3;
    const open = !closed || d.group !== closed;
    for (let y = d.y; y < d.y + dh; y++) {
      for (let x = d.x; x < d.x + dw; x++) {
        if (inb(x, y)) doorAt.set(y * 10000 + x, { open, group: d.group });
      }
    }
  }

  // клетки-опоры движущихся платформ (все позиции пути)
  const platSupport = new Set();
  for (const p of platforms) {
    const w = p.w || 3;
    const dx = p.dx || 0, dy = p.dy || 0;
    const steps = Math.max(1, Math.round(Math.max(Math.abs(dx), Math.abs(dy))));
    for (let s = 0; s <= steps; s++) {
      const bx = p.x + Math.round((dx * s) / steps);
      const by = p.y + Math.round((dy * s) / steps);
      for (let x = bx; x < bx + w; x++) {
        if (inb(x, by)) platSupport.add(by * 10000 + x);
      }
    }
  }

  function tile(c, r) {
    if (!inb(c, r)) return '#';
    return grid[r][c];
  }
  function isDoor(c, r) { return doorAt.get(r * 10000 + c) || null; }
  function solid(c, r) {
    if (!inb(c, r)) return true;
    const t = grid[r][c];
    if (t === '#' || t === '=') return true;
    const d = isDoor(c, r);
    if (d && !d.open) return true;
    return false;
  }
  function hazard(c, r) {
    if (!inb(c, r)) return false;
    const t = grid[r][c];
    return t === '^' || t === '~';
  }
  // проходимость: лёд считаем уже разбитым (Эрик может его сломать)
  function passable(c, r) {
    if (!inb(c, r)) return false;
    const t = grid[r][c];
    if (t === '#' || t === '^' || t === '~') return false;
    if (t === '=') return true; // предполагаем разбитым
    const d = isDoor(c, r);
    if (d && !d.open) return false;
    return true;
  }
  function support(c, r) {
    if (!inb(c, r)) return false;
    if (platSupport.has(r * 10000 + c)) return true;
    return solid(c, r);
  }
  function isAnchor(c, r) {
    if (!inb(c, r)) return false;
    if (grid[r][c] === 'G') return true;
    return solid(c, r);
  }
  function isLadder(c, r) {
    return inb(c, r) && grid[r][c] === 'L';
  }
  return { inb, tile, passable, support, solid, hazard, isDoor, isAnchor, isLadder, platSupport };
}

function key(c, r) { return r * 10000 + c; }

/* ----------------------------------------------------------------- BFS-обход */
/**
 * Возвращает { stood: Map<key,{c,r}>, all:Set } — достижимые клетки-стоянки.
 * Правила: ходьба/падение, лестницы, прыжок (по способностям), крюк (Балеог),
 * щит-подъём (Эрик от Олафа).
 */
function reachability(M, actor, opts) {
  const T = buildTiles(M, opts);
  const { cols, rows } = M;

  // профили прыжка: [макс. |dx| при dy = 0,1,2,3...]
  const jumpProfile =
    actor === 'erik' ? [6, 5, 4, 3] :
    actor === 'olaf' ? [3, 2, 1] :
    [];

  const stood = new Map();   // достижимые клетки-стоянки
  const queue = [];
  const seen = new Set();

  function addNode(c, r) {
    if (!T.inb(c, r)) return;
    if (!T.passable(c, r)) return;
    const k = key(c, r);
    if (seen.has(k)) return;
    const standing = T.support(c, r + 1);
    const ladder = T.isLadder(c, r);
    if (!standing && !ladder) return;
    seen.add(k);
    if (standing) stood.set(k, { c, r });
    queue.push({ c, r, standing, ladder });
  }

  /** падение из клетки (c,r): стоянка или null (смерть/упор) */
  function drop(c, r) {
    let y = r;
    let guard = 0;
    while (guard++ < 300) {
      if (!T.inb(c, y)) return null;
      if (T.hazard(c, y)) return null;
      if (T.support(c, y + 1)) return { c, r: y };
      if (!T.passable(c, y + 1)) return null;
      if (y + 1 >= rows) return null;
      y++;
    }
    return null;
  }

  function addLanding(c, r) {
    if (!T.inb(c, r) || !T.passable(c, r)) return;
    if (T.support(c, r + 1)) addNode(c, r);
    else {
      const f = drop(c, r);
      if (f) addNode(f.c, f.r);
    }
  }

  const spawn = M.lv.spawn || {};
  const sp = spawn[actor];
  if (Array.isArray(sp)) addNode(sp[0] | 0, sp[1] | 0);

  // Олаф нужен Эрику для прыжка со щита
  let olafStood = null;
  if (actor === 'erik') {
    olafStood = Array.from(reachability(M, 'olaf', opts).stood.values());
  }

  while (queue.length) {
    const node = queue.shift();
    const { c, r, standing, ladder } = node;

    // соседние лестницы: на них можно шагнуть
    for (const d of [-1, 1]) {
      if (T.isLadder(c + d, r)) addNode(c + d, r);
    }

    // ---- лестничные переходы ----
    if (ladder) {
      if (T.inb(c, r - 1) && T.passable(c, r - 1)) {
        if (T.isLadder(c, r - 1)) addNode(c, r - 1);
        else {
          // сход с лестницы на верхнюю площадку
          for (const d of [-1, 1]) {
            if (T.passable(c + d, r - 1) && T.support(c + d, r)) addNode(c + d, r - 1);
          }
        }
      }
      if (T.inb(c, r + 1) && T.passable(c, r + 1)) {
        if (T.isLadder(c, r + 1)) addNode(c, r + 1);
        else {
          const f = drop(c, r + 1);
          if (f) addNode(f.c, f.r);
        }
      }
      for (const d of [-1, 1]) {
        if (T.passable(c + d, r) && T.support(c + d, r + 1)) addNode(c + d, r);
      }
    }

    if (!standing) continue; // ниже — только для стоянок

    // ---- ходьба и падение с края ----
    for (const d of [-1, 1]) {
      const nc = c + d;
      if (!T.passable(nc, r)) continue;
      if (T.support(nc, r + 1)) addNode(nc, r);
      else {
        const f = drop(nc, r);
        if (f) addNode(f.c, f.r);
      }
    }

    // ---- прыжок ----
    for (let dy = 0; dy < jumpProfile.length; dy++) {
      const maxDx = jumpProfile[dy];
      let clear = true;
      for (let k = 1; k <= dy; k++) {
        if (!T.passable(c, r - k)) { clear = false; break; }
      }
      if (!clear) break;
      for (let dx = -maxDx; dx <= maxDx; dx++) {
        const tc = c + dx, tr = r - dy;
        if (!T.inb(tc, tr) || !T.passable(tc, tr)) continue;
        addLanding(tc, tr);
      }
    }

    // ---- парение Эрика (длинные планирующие спуски) ----
    if (actor === 'erik') {
      for (let drow = 2; drow <= 14; drow++) {
        const maxDx = Math.min(14, Math.floor(2.2 * drow) + 3);
        for (const dir of [-1, 1]) {
          for (let dx = 1; dx <= maxDx; dx++) {
            const tc = c + dir * dx, tr = r + drow;
            if (!T.inb(tc, tr) || !T.passable(tc, tr)) continue;
            // грубая проверка траектории: препятствия ниже стартовой площадки
            const steps = Math.max(Math.abs(dx), drow);
            let blocked = false;
            for (let k = 1; k < steps; k++) {
              const sx = c + Math.round((dir * dx * k) / steps);
              const sy = r + Math.round((drow * k) / steps);
              if (sy <= r + 1) continue; // сход с края площадки
              if (!T.passable(sx, sy)) { blocked = true; break; }
            }
            if (blocked) continue;
            addLanding(tc, tr);
          }
        }
      }
    }

    // ---- крюк Балеога: до 7 клеток в 4 стороны ----
    if (actor === 'baleog') {
      const dirs = [[1, 0], [-1, 0], [0, -1], [0, 1]];
      for (const [dc, dr] of dirs) {
        for (let k = 1; k <= 7; k++) {
          const ac = c + dc * k, ar = r + dr * k;
          if (!T.inb(ac, ar)) break;
          if (T.isAnchor(ac, ar)) {
            let sc = null, sr = null;
            if (T.tile(ac, ar) === 'G') { sc = ac; sr = ar; }
            else { sc = c + dc * (k - 1); sr = r + dr * (k - 1); }
            const f = drop(sc, sr);
            if (f) addNode(f.c, f.r);
            break;
          }
          if (!T.passable(ac, ar)) break;
        }
      }
    }

    // ---- щит Олафа: Эрик прыгает со щита ----
    if (actor === 'erik' && olafStood) {
      for (const o of olafStood) {
        if (Math.abs(o.c - c) > 2 || Math.abs(o.r - r) > 2) continue;
        for (let dx = -3; dx <= 3; dx++) {
          for (let s = o.r - 4; s <= o.r - 1; s++) {
            const tc = o.c + dx, tr = s;
            if (!T.inb(tc, tr) || !T.passable(tc, tr)) continue;
            if (T.support(tc, tr + 1)) addNode(tc, tr);
            else {
              const f = drop(tc, tr);
              if (f) addNode(f.c, f.r);
            }
          }
        }
      }
    }
  }

  return { stood, T };
}

/* ---------------------------------------------------------------- проверки */

function checkStructure() {
  if (LEVELS.length !== 6) err(null, `должно быть ровно 6 уровней, найдено ${LEVELS.length}`);
}

function checkLevelBasics(i, M) {
  const { lv, rows, cols, grid } = M;
  if (typeof lv.name !== 'string' || !lv.name.trim()) err(i, 'пустое поле name');
  else if (lv.name.length > 26) err(i, `name длиннее 26 символов (${lv.name.length})`);
  if (typeof lv.nameEn !== 'string' || !lv.nameEn.trim()) err(i, 'пустое поле nameEn');
  else if (lv.nameEn.length > 26) err(i, `nameEn длиннее 26 символов (${lv.nameEn.length})`);
  if (typeof lv.hint !== 'string' || !lv.hint.trim()) err(i, 'пустое поле hint');
  else if (lv.hint.length > 140) err(i, `hint длиннее 140 символов (${lv.hint.length})`);
  if (typeof lv.hintEn !== 'string' || !lv.hintEn.trim()) err(i, 'пустое поле hintEn');
  else if (lv.hintEn.length > 140) err(i, `hintEn длиннее 140 символов (${lv.hintEn.length})`);
  if (![0, 1, 2].includes(lv.music)) err(i, 'music должен быть 0|1|2');
  if (!Array.isArray(lv.walkthrough) || lv.walkthrough.length < 5 || lv.walkthrough.length > 15) {
    err(i, `walkthrough: нужно 5–15 шагов, есть ${Array.isArray(lv.walkthrough) ? lv.walkthrough.length : 0}`);
  } else if (lv.walkthrough.some((s) => typeof s !== 'string' || !s.trim())) {
    err(i, 'walkthrough содержит пустой шаг');
  }

  if (rows < 18 || rows > 30) err(i, `rows=${rows}, нужно 18–30`);
  if (cols < 48 || cols > 80) err(i, `cols=${cols}, нужно 48–80`);
  for (let r = 0; r < rows; r++) {
    const line = String(lv.rows[r]);
    if (line.length !== cols) err(i, `строка ${r} длиной ${line.length}, ожидалось ${cols}`);
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (!TILE_CHARS.has(ch)) err(i, `недопустимый тайл '${ch}' в (${c},${r})`);
    }
  }
  if (grid.length !== rows) err(i, 'grid.length не совпадает с rows');
}

function entityInBounds(i, M, e, cellsW, cellsH, name) {
  const { cols, rows } = M;
  const w = cellsW || 1, h = cellsH || 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = e.x + x, cy = e.y + y;
      if (cx < 1 || cy < 0 || cx > cols - 2 || cy > rows - 1) {
        err(i, `${name} вне карты в (${cx},${cy})`);
        return false;
      }
    }
  }
  return true;
}

function cellAir(M, x, y) {
  if (y < 0 || y >= M.rows || x < 0 || x >= M.cols) return false;
  const t = M.grid[y][x];
  return t === '.' || t === 'G' || t === 'T' || t === 'L';
}

function checkEntities(i, M) {
  const { lv, ents, doors, plates, levers, platforms } = M;
  const spawn = lv.spawn || {};
  const spawnKeys = Object.keys(spawn).sort();
  if (spawnKeys.length !== 3 || spawnKeys.join(',') !== 'baleog,erik,olaf') {
    err(i, `spawn должен содержать ровно erik/baleog/olaf, есть [${spawnKeys.join(', ')}]`);
  }
  const iceBroken = buildTiles(M, {});
  for (const id of ACTORS) {
    const p = spawn[id];
    if (!Array.isArray(p) || p.length !== 2) { err(i, `spawn.${id} должен быть [col,row]`); continue; }
    const [c, r] = p;
    if (c < 1 || r < 0 || c > M.cols - 2 || r > M.rows - 1) { err(i, `spawn.${id} вне карты`); continue; }
    if (M.grid[r][c] !== '.') err(i, `spawn.${id} (${c},${r}) не на свободной клетке ('${M.grid[r][c]}')`);
    if (!iceBroken.support(c, r + 1)) err(i, `spawn.${id} (${c},${r}) без опоры под ногами`);
    else {
      const below = M.grid[r + 1][c];
      if (below === '^' || below === '~') err(i, `spawn.${id} стоит над опасным тайлом`);
    }
  }

  const exits = ents.filter((e) => e.type === 'exit');
  if (exits.length !== 1) err(i, `exit: ровно 1, найдено ${exits.length}`);
  else {
    const ex = exits[0];
    if (ex.w !== 2 || ex.h !== 2) err(i, `exit должен быть 2×2, а не ${ex.w}×${ex.h}`);
    if (entityInBounds(i, M, ex, 2, 2, 'exit')) {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
        if (!cellAir(M, ex.x + x, ex.y + y)) err(i, `exit занимает непустую клетку (${ex.x + x},${ex.y + y})`);
      }
    }
  }

  const runes = ents.filter((e) => e.type === 'rune');
  if (runes.length !== 3) err(i, `руны: ровно 3, найдено ${runes.length}`);
  const checkpoints = ents.filter((e) => e.type === 'checkpoint');
  if (checkpoints.length < 1 || checkpoints.length > 3) err(i, `чекпоинты: 1–3, найдено ${checkpoints.length}`);
  const signs = ents.filter((e) => e.type === 'sign');
  if (signs.length < 1 || signs.length > 2) err(i, `знаки: 1–2, найдено ${signs.length}`);

  for (const kind of ['rune', 'checkpoint', 'sign', 'torch', 'plate', 'lever']) {
    for (const e of ents.filter((x) => x.type === kind)) {
      if (!entityInBounds(i, M, e, 1, 1, kind)) continue;
      if (!cellAir(M, e.x, e.y)) err(i, `${kind} (${e.x},${e.y}) стоит в непроходимой клетке`);
    }
  }
  for (const e of runes) {
    // руна должна висеть в воздухе, а не в стене
    if (M.grid[e.y] && SOLID_TILES.has(M.grid[e.y][e.x])) err(i, `rune (${e.x},${e.y}) внутри стены`);
  }
  for (const e of signs) {
    if (!e.ru || !e.en) err(i, `sign (${e.x},${e.y}) без ru/en текста`);
  }
  for (const e of platforms) {
    if (!entityInBounds(i, M, e, e.w || 3, 1, 'platform')) continue;
    if (e.y >= M.rows || e.y < 1) err(i, 'platform y вне карты');
    const steps = Math.max(Math.abs(e.dx || 0), Math.abs(e.dy || 0));
    if (steps < 1) err(i, 'platform без движения (dx и dy = 0)');
  }
  for (const e of ents.filter((x) => x.type === 'enemy')) {
    if (!ENEMY_KINDS.has(e.kind)) err(i, `enemy: неизвестный kind '${e.kind}'`);
    if (!entityInBounds(i, M, e, 1, 1, 'enemy')) continue;
    if (!cellAir(M, e.x, e.y)) err(i, `enemy (${e.x},${e.y}) в непроходимой клетке`);
    if (e.kind !== 'bat') {
      const T = iceBroken;
      if (!T.support(e.x, e.y + 1)) err(i, `${e.kind} (${e.x},${e.y}) без опоры под ногами`);
    }
  }
  for (const e of doors) {
    if (!entityInBounds(i, M, e, e.w || 1, e.h || 3, 'door')) continue;
    for (let y = 0; y < (e.h || 3); y++) {
      for (let x = 0; x < (e.w || 1); x++) {
        if (!cellAir(M, e.x + x, e.y + y)) {
          err(i, `door (${e.x},${e.y}) перекрывает непустой тайл (${e.x + x},${e.y + y})`);
        }
      }
    }
  }
}

function checkGroups(i, M) {
  const groups = new Map();
  for (const g of GROUPS) groups.set(g, { doors: [], activators: [] });
  for (const d of M.doors) {
    if (!GROUPS.includes(d.group)) err(i, `door: недопустимая группа '${d.group}'`);
    else groups.get(d.group).doors.push(d);
  }
  for (const a of [...M.plates, ...M.levers]) {
    if (!GROUPS.includes(a.group)) err(i, `${a.type}: недопустимая группа '${a.group}'`);
    else groups.get(a.group).activators.push(a);
  }
  for (const [g, v] of groups) {
    if (!v.doors.length && !v.activators.length) continue;
    if (!v.doors.length) err(i, `группа '${g}': есть активаторы, но нет дверей`);
    if (!v.activators.length) err(i, `группа '${g}': есть двери, но нет ни плиты, ни рычага`);
  }
}

/** Проверка ломаемости льда: низ каждой ледяной колонны доступен Эрику. */
function checkIce(i, M) {
  const T = buildTiles(M, {});
  const erik = reachability(M, 'erik', {});
  for (let c = 1; c < M.cols - 1; c++) {
    let r = 0;
    while (r < M.rows) {
      if (M.grid[r][c] !== '=') { r++; continue; }
      let end = r;
      while (end + 1 < M.rows && M.grid[end + 1][c] === '=') end++;
      // нижний тайл колонны льда
      const low = end;
      let ok = false;
      for (const dv of [-1, 0, 1]) {
        for (const dc of [-1, 0, 1]) {
          const k = key(c + dc, low + dv);
          if (erik.stood.has(k)) { ok = true; break; }
        }
        if (ok) break;
      }
      if (!ok) err(i, `лёд в колонне (${c},${r}..${end}) недосягаем для Эрика — не сломать`);
      r = end + 1;
    }
  }
}

function checkIceReachNoop() { /* слот под будущие проверки */ }

/** Достижим ли активатор группы при закрытых дверях этой группы. */
function checkActivators(i, M) {
  const groups = new Set([...M.doors.map((d) => d.group)]);
  for (const g of groups) {
    if (!GROUPS.includes(g)) continue;
    const reach = {};
    for (const a of ACTORS) reach[a] = reachability(M, a, { doorsClosed: g });
    for (const p of M.plates.filter((x) => x.group === g)) {
      let ok = false;
      for (const a of ACTORS) {
        if (reach[a].stood.has(key(p.x, p.y))) { ok = true; break; }
      }
      if (!ok) err(i, `плита '${p.group}' (${p.x},${p.y}) недостижима при закрытой двери группы '${g}'`);
    }
    for (const lv of M.levers.filter((x) => x.group === g)) {
      const b = reach.baleog;
      let ok = false;
      for (const spot of b.stood.values()) {
        const dc = Math.abs(spot.c - lv.x);
        const dr = lv.y - spot.r; // >0 — рычаг выше
        const upShot = dc <= 1 && dr >= 0 && dr <= 5;
        const melee = dc <= 2 && Math.abs(dr) <= 2;
        const flatShot = Math.abs(dr) <= 1 && dc <= 7;
        if (upShot || melee || flatShot) { ok = true; break; }
      }
      if (!ok) err(i, `рычаг '${lv.group}' (${lv.x},${lv.y}): Балеог не может достать его стрелой/мечом`);
    }
  }
}

function checkExitReachable(i, M) {
  const ex = M.ents.find((e) => e.type === 'exit');
  if (!ex) return;
  const targetRow = ex.y + (ex.h || 2);
  const targets = [];
  for (let x = ex.x; x < ex.x + (ex.w || 2); x++) targets.push({ c: x, r: targetRow });
  for (const a of ACTORS) {
    const reach = reachability(M, a, {});
    const ok = targets.some((t) => reach.stood.has(key(t.c, t.r)));
    if (!ok) err(i, `выход недостижим для ${a} (BFS-эвристика)`);
  }
}

function checkCollectibles(i, M) {
  const reaches = {};
  for (const a of ACTORS) reaches[a] = reachability(M, a, {});
  const all = [];
  for (const a of ACTORS) for (const v of reaches[a].stood.values()) all.push(v);

  const near = (x, y, dc, dr) => all.some((s) => Math.abs(s.c - x) <= dc && Math.abs(s.r - y) <= dr);

  for (const e of M.ents.filter((x) => x.type === 'rune')) {
    if (!near(e.x, e.y, 1, 1)) err(i, `руна (${e.x},${e.y}) недостижима ни одним викингом`);
  }
  for (const e of M.ents.filter((x) => x.type === 'checkpoint')) {
    if (!near(e.x, e.y, 1, 1)) warn(i, `чекпоинт (${e.x},${e.y}) недостижим ни одним викингом`);
  }
  for (const e of M.ents.filter((x) => x.type === 'sign')) {
    if (!near(e.x, e.y, 2, 2)) warn(i, `знак (${e.x},${e.y}) далеко от достижимых мест`);
  }
}

/* -------------------------------------------------------------------- прогон */
checkStructure();

const summary = [];
for (let i = 0; i < LEVELS.length; i++) {
  const M = buildModel(LEVELS[i]);
  checkLevelBasics(i, M);
  if (errors.some((e) => e.startsWith(`[У${i + 1}]`))) {
    // при битом формате BFS-проверки могут падать — всё равно попробуем
  }
  checkEntities(i, M);
  checkGroups(i, M);
  try {
    checkIce(i, M);
    checkActivators(i, M);
    checkExitReachable(i, M);
    checkCollectibles(i, M);
  } catch (e) {
    err(i, `исключение в BFS-проверках: ${e.message}`);
  }

  // сводка
  const reaches = {};
  for (const a of ACTORS) reaches[a] = reachability(M, a, {});
  const ex = M.ents.find((e) => e.type === 'exit');
  const exitOk = ex
    ? ACTORS.filter((a) => {
        for (let x = ex.x; x < ex.x + (ex.w || 2); x++) {
          if (reaches[a].stood.has(key(x, ex.y + (ex.h || 2)))) return true;
        }
        return false;
      })
    : [];
  summary.push({
    idx: i,
    name: LEVELS[i].name,
    size: `${M.cols}x${M.rows}`,
    runes: M.ents.filter((e) => e.type === 'rune').length,
    checkpoints: M.ents.filter((e) => e.type === 'checkpoint').length,
    signs: M.ents.filter((e) => e.type === 'sign').length,
    groups: [...new Set(M.doors.map((d) => d.group))].sort().join(','),
    reach: ACTORS.map((a) => `${a}:${reaches[a].stood.size}`).join(' '),
    exit: exitOk.join('/')
  });
}

if (process.env.DEBUG_REACH) {
  const idx = Number(process.env.DEBUG_REACH) - 1;
  const M = buildModel(LEVELS[idx]);
  for (const a of ACTORS) {
    const r = reachability(M, a, {});
    const pts = Array.from(r.stood.values()).sort((p, q) => p.c - q.c || p.r - q.r);
    console.log('REACH', a, 'n=' + pts.length);
    const byCol = {};
    for (const p of pts) (byCol[p.c] = byCol[p.c] || []).push(p.r);
    console.log(Object.keys(byCol).sort((x, y) => x - y).map((c) => c + ':' + byCol[c].join('/')).join(' '));
  }
}

console.log('=== Lost Vikings 2 · валидация уровней ===');
for (const s of summary) {
  console.log(
    ` ${s.idx + 1}. ${s.name.padEnd(16)} ${s.size.padEnd(6)} руны:${s.runes} чек:${s.checkpoints} знаки:${s.signs} ` +
    `группы:${s.groups || '—'}  вых:${s.exit || '—'}  (${s.reach})`
  );
}
console.log('');
if (warnings.length) {
  console.log(`Предупреждения (${warnings.length}):`);
  for (const w of warnings) console.log('  ~ ' + w);
  console.log('');
}
if (errors.length) {
  console.log(`FAIL: ${errors.length} ошибок`);
  for (const e of errors) console.log('  ✗ ' + e);
  process.exit(1);
}
console.log(`OK: ${LEVELS.length} уровней`);
process.exit(0);
