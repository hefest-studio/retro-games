/* ============================================================================
   КРОТ · tests/engine.test.mjs — автотесты логики движка (Node, без зависимостей)
   Владелец: qa-runner. Проверяет CONTRACT.md §3-§4 и §7.1.
   Запуск: node tests/engine.test.mjs
   Вывод:  строка на проверку, финал "OK n/n" (код 0) или "FAIL n/n" (код 1).
   Движок исполняется в node:vm с шимом window — никакой DOM не требуется.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

/* ------------------------------ загрузка движка ---------------------------- */
const sandbox = { window: null, globalThis: null, console, performance: { now: () => 0 } };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const file of ['js/i18n.js', 'js/game.js']) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(code, sandbox, { filename: file });
}
const KROT = sandbox.KROT;

/* ------------------------------ мини-фреймворк ----------------------------- */
const MODES = ['title', 'ready', 'play', 'bonus', 'dying', 'levelclear', 'gameover'];
const COLS = 15;
const ROWS = 10;

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('ok   ' + name);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.log('FAIL ' + name + ' — ' + (err && err.message ? err.message : String(err)));
  }
}
function ok(cond, msg) {
  if (!cond) throw new Error(msg || 'ожидается истина');
}
function eq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg ? msg + ': ' : '') + 'ожидалось ' + JSON.stringify(expected) + ', получено ' + JSON.stringify(actual));
  }
}
function approx(actual, expected, eps, msg) {
  const e = eps == null ? 1e-6 : eps;
  if (typeof actual !== 'number' || !isFinite(actual) || Math.abs(actual - expected) > e) {
    throw new Error((msg ? msg + ': ' : '') + 'ожидалось ~' + expected + ' ±' + e + ', получено ' + actual);
  }
}
function finite(value, msg) {
  if (typeof value !== 'number' || !isFinite(value)) throw new Error((msg || 'значение') + ' не конечное число: ' + String(value));
}
function inBounds(cx, cy) {
  return Number.isInteger(cx) && Number.isInteger(cy) && cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS;
}

/* --------------------------------- утилиты --------------------------------- */
function mk(seed, opts) {
  return KROT.Game(Object.assign({ seed: seed === undefined ? 1337 : seed }, opts || {}));
}
function eventCapture(engine) {
  const events = [];
  engine.onEvent((type, data) => events.push({ type, data: data || {} }));
  return events;
}
function types(events) { return events.map((e) => e.type); }
function ev(events, type) { return events.filter((e) => e.type === type); }
function countType(events, type) { return ev(events, type).length; }
function hasEvent(events, type) { return ev(events, type).length > 0; }

function step(engine, seconds, dt) {
  const delta = dt || 1 / 60;
  const n = Math.max(1, Math.round(seconds / delta));
  for (let i = 0; i < n; i++) engine.update(delta);
}
function idx(cx, cy) { return cy * COLS + cx; }
function digCell(S, cx, cy) { S.grid[idx(cx, cy)] = 1; }
function isTunnel(S, cx, cy) { return isFiniteCell(S, cx, cy) && S.grid[idx(cx, cy)] === 1; }
function isFiniteCell(S, cx, cy) { return inBounds(cx, cy); }

/* Свежий "чистый" уровень для точечных проверок механики.
   Всё поле — земля, игрок стоит в туннеле (7,5), бюджет монстров выключен
   (spawnLeft большой, таймер огромный), алмазов "много" (99), чтобы не
   срабатывало условие levelClear. */
function lab(seed) {
  const engine = KROT.Game({ seed: seed == null ? 7 : seed });
  engine.start();
  const S = engine.state;
  S.mode = 'play';
  S.readyT = 0;
  S.paused = false;
  S.items.length = 0;
  S.monsters.length = 0;
  S.bullets.length = 0;
  S.particles.length = 0;
  S.popups.length = 0;
  S.grid.fill(0);
  S.level = 1;
  S.score = 0;
  S.lives = 3;
  S.hi = 0;
  S.gemsLeft = 99;
  S.gemsTotal = 100;
  S.gemsCollected = 0;
  S.gemChain = 0;
  S.spawnLeft = 99;
  S.spawnTimer = 1e9;
  S.monstersMax = 4;
  S.gnawerChance = 0;
  S.bonus = false;
  S.bonusT = 0;
  S.bonusDur = 0;
  S.eatChain = 0;
  S.cherrySpawned = true;
  S.kills = 0;
  S.shake = 0;
  S.deadT = 0;
  S.clearT = 0;
  S.nextLife = 20000;
  S.stats = { dug: 0, bagKills: 0, shots: 0, gems: 0, levels: 0 };
  Object.assign(S.player, {
    cx: 7, cy: 5, x: 7.5, y: 5.5, tx: 7.5, ty: 5.5,
    dir: 0, inputDir: -1, moving: false, alive: true,
    invuln: 0, shootCd: 0, shootMax: 1.2, shootAnim: 0, walkPhase: 0
  });
  digCell(S, 7, 5);
  return { engine, S };
}
function putItem(S, type, cx, cy) {
  const item = { type, cx, cy, x: cx + 0.5, y: cy + 0.5 };
  if (type === 'bag') Object.assign(item, { falling: false, wobble: -1, vy: 0, fallFrom: cy });
  S.items.push(item);
  return item;
}
function putMonster(S, cx, cy, kind, extra) {
  const m = Object.assign({
    kind: kind || 'crawler', cx, cy, x: cx + 0.5, y: cy + 0.5, tx: cx + 0.5, ty: cy + 0.5,
    dir: 2, scared: !!S.bonus, dying: 0, spawnT: 1, moving: false,
    think: 999, fromX: cx, fromY: cy - 1, walkPhase: 0
  }, extra || {});
  S.monsters.push(m);
  return m;
}
function movePlayer(S, cx, cy) {
  Object.assign(S.player, {
    cx, cy, x: cx + 0.5, y: cy + 0.5, tx: cx + 0.5, ty: cy + 0.5,
    moving: false, inputDir: -1
  });
  digCell(S, cx, cy);
}
function r6(v) { return Math.round(v * 1e6) / 1e6; }
function snapshot(S) {
  return JSON.stringify({
    grid: Array.from(S.grid),
    items: S.items.map((i) => [i.type, i.cx, i.cy, r6(i.x), r6(i.y), !!i.falling, r6(i.wobble == null ? 0 : i.wobble)]),
    monsters: S.monsters.map((m) => [m.kind, m.cx, m.cy, r6(m.x), r6(m.y), m.dying > 0, !!m.scared, r6(m.spawnT)]),
    player: [S.player.cx, S.player.cy, r6(S.player.x), r6(S.player.y), S.player.dir, S.player.moving, S.player.alive],
    score: S.score, mode: S.mode, level: S.level, lives: S.lives,
    gemsLeft: S.gemsLeft, gemsTotal: S.gemsTotal, kills: S.kills, nextLife: S.nextLife,
    spawnLeft: S.spawnLeft, time: r6(S.time), stats: S.stats
  });
}
function monsterKindOf(S, ref) {
  const m = S.monsters.indexOf(ref) >= 0 ? ref : null;
  return m ? m.kind : null;
}

/* Проверка инвариантов state для длинных прогонов. */
function assertStateFinite(S, where) {
  const at = where ? ' (' + where + ')' : '';
  ['seed', 'level', 'score', 'hi', 'lives', 'time', 'anim', 'gemsLeft', 'gemsTotal',
    'gemChain', 'bonusT', 'bonusDur', 'spawnLeft', 'monstersMax', 'kills', 'shake',
    'readyT', 'clearT'].forEach((k) => {
    if (typeof S[k] !== 'number' || !isFinite(S[k])) throw new Error('S.' + k + ' не число' + at + ': ' + S[k]);
  });
  eq(typeof S.paused, 'boolean', 'S.paused' + at);
  eq(typeof S.bonus, 'boolean', 'S.bonus' + at);
  ok(MODES.indexOf(S.mode) >= 0, 'недопустимый mode' + at + ': ' + S.mode);
  ok(Object.prototype.toString.call(S.grid) === '[object Uint8Array]', 'grid не Uint8Array' + at);
  eq(S.grid.length, COLS * ROWS, 'длина grid' + at);
  for (let i = 0; i < S.grid.length; i++) {
    if (S.grid[i] !== 0 && S.grid[i] !== 1) throw new Error('grid[' + i + ']=' + S.grid[i] + at);
  }
  const p = S.player;
  finite(p.x, 'player.x' + at); finite(p.y, 'player.y' + at);
  finite(p.invuln, 'player.invuln' + at); finite(p.shootCd, 'player.shootCd' + at);
  ok(inBounds(p.cx, p.cy), 'player.cx/cy вне поля' + at + ': ' + p.cx + ',' + p.cy);
  eq(typeof p.alive, 'boolean', 'player.alive' + at);
  for (const it of S.items) {
    ok(['gem', 'gold', 'cherry', 'bag'].indexOf(it.type) >= 0, 'тип item' + at + ': ' + it.type);
    finite(it.x, 'item.x' + at); finite(it.y, 'item.y' + at);
    ok(inBounds(it.cx, it.cy), 'item.cx/cy вне поля' + at);
    if (it.type === 'bag') {
      eq(typeof it.falling, 'boolean', 'bag.falling' + at);
      finite(it.wobble, 'bag.wobble' + at);
    }
  }
  for (const m of S.monsters) {
    ok(m.kind === 'crawler' || m.kind === 'gnawer', 'kind монстра' + at);
    finite(m.x, 'monster.x' + at); finite(m.y, 'monster.y' + at);
    finite(m.spawnT, 'monster.spawnT' + at); finite(m.dying, 'monster.dying' + at);
    ok(inBounds(m.cx, m.cy), 'monster.cx/cy вне поля' + at);
  }
  for (const b of S.bullets) { finite(b.x, 'bullet.x' + at); finite(b.y, 'bullet.y' + at); }
  for (const q of S.particles) {
    finite(q.x, 'particle.x' + at); finite(q.y, 'particle.y' + at);
    finite(q.life, 'particle.life' + at);
  }
  for (const q of S.popups) { finite(q.x, 'popup.x' + at); finite(q.y, 'popup.y' + at); }
}

/* ========================================================================== */
/* 1. API                                                                     */
/* ========================================================================== */
test('API: KROT.G / KROT.rng / KROT.Game / KROT.t соответствуют §4', () => {
  eq(KROT.G.COLS, 15, 'COLS');
  eq(KROT.G.ROWS, 10, 'ROWS');
  eq(KROT.G.W, 960, 'W');
  eq(KROT.G.H, 600, 'H');
  ok(Array.isArray(KROT.G.DIRS) && KROT.G.DIRS.length === 4, 'DIRS — 4 направления');
  eq(JSON.stringify(KROT.G.DIRS), JSON.stringify([[0, -1], [1, 0], [0, 1], [-1, 0]]), 'порядок DIRS');
  eq(typeof KROT.rng, 'function', 'KROT.rng');
  eq(typeof KROT.Game, 'function', 'KROT.Game');
  eq(typeof KROT.t, 'function', 'KROT.t');
  eq(KROT.t('score'), 'СЧЁТ', 'KROT.t("score") по умолчанию RU');
});

test('KROT.rng: детерминированный PRNG, диапазон 0..1', () => {
  const a = KROT.rng(123), b = KROT.rng(123), c = KROT.rng(124);
  const seqA = [], seqB = [], seqC = [];
  for (let i = 0; i < 16; i++) { seqA.push(a()); seqB.push(b()); seqC.push(c()); }
  eq(JSON.stringify(seqA), JSON.stringify(seqB), 'один seed — одна последовательность');
  ok(JSON.stringify(seqA) !== JSON.stringify(seqC), 'разные seed — разные последовательности');
  for (const v of seqA) { finite(v, 'rng()'); ok(v >= 0 && v < 1, 'rng() в [0,1): ' + v); }
  const z = KROT.rng(0);
  for (let i = 0; i < 8; i++) { const v = z(); finite(v, 'rng(0)()'); ok(v >= 0 && v < 1, 'rng(0) в [0,1)'); }
});

/* ========================================================================== */
/* 2. Состояние и старт игры (§3)                                             */
/* ========================================================================== */
test('состояние §3: все обязательные поля и их типы', () => {
  const e = mk(1337);
  const S = e.state;
  const required = ['seed', 'level', 'score', 'hi', 'lives', 'mode', 'paused', 'time', 'anim',
    'gemsLeft', 'gemsTotal', 'gemChain', 'bonus', 'bonusT', 'bonusDur', 'spawnLeft',
    'monstersMax', 'kills', 'shake', 'grid', 'items', 'player', 'monsters', 'bullets',
    'particles', 'popups', 'readyT', 'clearT', 'stats'];
  for (const k of required) ok(k in S, 'нет поля S.' + k);
  eq(typeof S.seed, 'number', 'S.seed'); eq(typeof S.level, 'number', 'S.level');
  eq(typeof S.score, 'number', 'S.score'); eq(typeof S.hi, 'number', 'S.hi');
  eq(typeof S.lives, 'number', 'S.lives'); eq(typeof S.paused, 'boolean', 'S.paused');
  eq(typeof S.bonus, 'boolean', 'S.bonus');
  ok(MODES.indexOf(S.mode) >= 0, 'режим из §3: ' + S.mode);
  eq(Object.prototype.toString.call(S.grid), '[object Uint8Array]', 'grid — Uint8Array');
  eq(S.grid.length, 150);
  ok(Array.isArray(S.items) && Array.isArray(S.monsters) && Array.isArray(S.bullets) &&
    Array.isArray(S.particles) && Array.isArray(S.popups), 'массивы items/monsters/bullets/particles/popups');
  const p = S.player;
  for (const k of ['cx', 'cy', 'x', 'y', 'dir', 'moving', 'alive', 'invuln', 'shootCd', 'shootMax', 'shootAnim', 'walkPhase']) {
    ok(k in p, 'нет поля player.' + k);
  }
  for (const k of ['dug', 'bagKills', 'shots']) ok(k in S.stats, 'нет поля stats.' + k);
  assertStateFinite(S, 'после конструктора');
});

test('конструктор: режим title (демо-фон), opts.hiscore учитывается', () => {
  const e = mk(1, { hiscore: 777 });
  eq(e.state.mode, 'title', 'стартовый режим');
  eq(e.state.hi, 777, 'S.hi из opts.hiscore');
  ok(e.state.monsters.length >= 1, 'в демо-режиме есть монстры');
  eq(e.state.player.invuln, 99, 'на титуле игрок неуязвим');
});

test('start(): score 0, lives 3, level 1, mode ready, событие levelStart', () => {
  const e = mk(11);
  const evs = eventCapture(e);
  e.start();
  const S = e.state;
  eq(S.mode, 'ready', 'режим ready');
  eq(S.score, 0, 'score'); eq(S.lives, 3, 'lives'); eq(S.level, 1, 'level');
  ok(S.readyT > 0, 'readyT > 0');
  ok(S.gemsTotal > 0, 'есть алмазы');
  ok(S.player.invuln > 0, 'стартовая неуязвимость');
  const ls = ev(evs, 'levelStart');
  eq(ls.length, 1, 'levelStart');
  eq(ls[0].data.level, 1, 'levelStart.level');
  step(e, 2.0);
  eq(S.mode, 'play', 'после readyT — play');
});

test('toTitle(): демо-режим, уровень 1, mode title', () => {
  const e = mk(21);
  e.start();
  e.toTitle();
  const S = e.state;
  eq(S.mode, 'title', 'mode title');
  eq(S.level, 1, 'level 1');
  eq(S.score, 0, 'score 0');
  eq(S.lives, 3, 'lives 3');
  ok(S.gemsTotal > 0, 'уровень построен');
  eq(S.player.invuln, 99, 'игрок неуязвим в демо');
});

/* ========================================================================== */
/* 3. Генерация уровней (§4, §7.1)                                            */
/* ========================================================================== */
test('генерация: размеры, старт в туннеле, спавн-клетка, опора сумок, алмазы', () => {
  const seeds = [1, 42, 1337];
  const levels = [1, 2, 5, 10];
  for (const seed of seeds) {
    for (const level of levels) {
      const e = mk(seed);
      e.setLevel(level);
      const S = e.state;
      const tag = 'seed=' + seed + ' level=' + level;
      eq(S.level, level, 'level ' + tag);
      eq(Object.prototype.toString.call(S.grid), '[object Uint8Array]', 'grid ' + tag);
      eq(S.grid.length, COLS * ROWS, 'длина grid ' + tag);
      for (let i = 0; i < S.grid.length; i++) {
        if (S.grid[i] !== 0 && S.grid[i] !== 1) throw new Error('grid[' + i + ']=' + S.grid[i] + ' ' + tag);
      }
      const p = S.player;
      ok(inBounds(p.cx, p.cy), 'игрок в поле ' + tag);
      eq(S.grid[idx(p.cx, p.cy)], 1, 'игрок стоит в туннеле ' + tag);
      eq(p.cy, ROWS - 1, 'игрок в нижнем ряду ' + tag);
      eq(S.grid[idx(COLS - 1, 0)], 1, 'клетка спавна (14,0) — туннель ' + tag);
      approx(p.invuln, 2.5, 1e-9, 'invuln после генерации ' + tag);
      approx(p.x, p.cx + 0.5, 1e-9, 'player.x ' + tag);
      approx(p.y, p.cy + 0.5, 1e-9, 'player.y ' + tag);

      const cells = new Set();
      let gems = 0, bags = 0;
      for (const it of S.items) {
        ok(['gem', 'gold', 'cherry', 'bag'].indexOf(it.type) >= 0, 'тип item ' + tag);
        ok(inBounds(it.cx, it.cy), 'item в поле ' + tag);
        const key = it.cx + ':' + it.cy;
        ok(!cells.has(key), 'две сущности в одной клетке ' + key + ' ' + tag);
        cells.add(key);
        approx(it.x, it.cx + 0.5, 1e-9, 'item.x ' + tag);
        approx(it.y, it.cy + 0.5, 1e-9, 'item.y ' + tag);
        ok(!(it.cx === p.cx && it.cy === p.cy), 'предмет на клетке игрока ' + tag);
        if (it.type === 'gem') {
          gems++;
          eq(S.grid[idx(it.cx, it.cy)], 0, 'алмаз лежит в земле ' + tag);
        }
        if (it.type === 'bag') {
          bags++;
          eq(S.grid[idx(it.cx, it.cy)], 0, 'сумка лежит в земле ' + tag);
          eq(it.falling, false, 'сумка не падает сразу ' + tag);
          eq(it.wobble, -1, 'сумка стабильна ' + tag);
          eq(it.fallFrom, it.cy, 'fallFrom ' + tag);
          const supported = it.cy + 1 >= ROWS || S.grid[idx(it.cx, it.cy + 1)] === 0;
          ok(supported, 'сумка на опоре (' + it.cx + ',' + it.cy + ') ' + tag);
        }
      }
      const gemTarget = Math.min(26, 9 + 2 * level);
      ok(gems >= gemTarget && gems <= gemTarget + 4,
        'алмазов ' + gems + ', цель ' + gemTarget + ' (+до 4 из-за кластеров) ' + tag);
      eq(S.gemsTotal, gems, 'gemsTotal ' + tag);
      eq(S.gemsLeft, gems, 'gemsLeft ' + tag);
      ok(bags >= 2, 'сумок не меньше 2 (' + bags + ') ' + tag);
      eq(S.spawnLeft, Math.min(1 + level, 9), 'бюджет спавна ' + tag);
      eq(S.monstersMax, Math.min(1 + Math.floor((level - 1) / 2), 4), 'лимит одновременно ' + tag);
      approx(p.shootMax, Math.min(2.6, 1.2 + 0.12 * (level - 1)), 1e-9, 'shootMax ' + tag);
      eq(S.monsters.length, 0, 'монстров ещё нет ' + tag);
      assertStateFinite(S, tag);
    }
  }
});

test('генерация детерминирована: один seed → один уровень', () => {
  for (const level of [1, 4, 10]) {
    const A = mk(909); A.setLevel(level);
    const B = mk(909); B.setLevel(level);
    eq(JSON.stringify(Array.from(A.state.grid)), JSON.stringify(Array.from(B.state.grid)), 'grid level ' + level);
    eq(JSON.stringify(A.state.items.map((i) => [i.type, i.cx, i.cy])),
      JSON.stringify(B.state.items.map((i) => [i.type, i.cx, i.cy])), 'items level ' + level);
    eq(A.state.gemsTotal, B.state.gemsTotal, 'gemsTotal level ' + level);
  }
});

/* ========================================================================== */
/* 4. Копание и сбор (§4)                                                     */
/* ========================================================================== */
test('копание: клетка земли становится туннелем, событие dig, частицы', () => {
  const { engine, S } = lab();
  eq(S.grid[idx(8, 5)], 0, 'справа земля');
  const evs = eventCapture(engine);
  engine.setDir(1);
  eq(S.grid[idx(8, 5)], 1, 'клетка прокопана сразу');
  eq(S.player.cx, 8, 'игрок шагнул в клетку');
  eq(S.stats.dug, 1, 'stats.dug');
  ok(S.particles.length > 0, 'частицы земли');
  eq(countType(evs, 'dig'), 1, 'событие dig');
  eq(evs[0].data.by, 'player', 'dig.by');
  engine.setDir(-1);
  step(engine, 0.3);
  approx(S.player.x, 8.5, 1e-9, 'плавная позиция игрока');
  eq(S.player.moving, false, 'игрок дошёл до центра клетки');
});

test('движение по готовому туннелю не копает', () => {
  const { engine, S } = lab();
  digCell(S, 8, 5);
  const evs = eventCapture(engine);
  engine.setDir(1);
  engine.setDir(-1);
  step(engine, 0.2);
  eq(S.stats.dug, 0, 'земля не прокопана');
  eq(countType(evs, 'dig'), 0, 'события dig нет');
  eq(S.player.cx, 8, 'игрок прошёл в туннель');
});

test('копать можно в любую сторону', () => {
  for (const dir of [0, 1, 2, 3]) {
    const { engine, S } = lab();
    const d = KROT.G.DIRS[dir];
    const tx = S.player.cx + d[0], ty = S.player.cy + d[1];
    eq(S.grid[idx(tx, ty)], 0, 'целевая клетка — земля, dir=' + dir);
    engine.setDir(dir);
    eq(S.grid[idx(tx, ty)], 1, 'прокопано, dir=' + dir);
    eq(S.player.cx, tx, 'cx, dir=' + dir);
    eq(S.player.cy, ty, 'cy, dir=' + dir);
    eq(S.stats.dug, 1, 'stats.dug, dir=' + dir);
  }
});

test('границы поля не копаются и не ломают игрока', () => {
  const { engine, S } = lab();
  movePlayer(S, 0, 9);
  engine.setDir(3);
  step(engine, 0.2);
  eq(S.player.cx, 0, 'игрок не вышел влево');
  eq(S.player.cy, 9, 'игрок не вышел вниз');
  engine.setDir(2);
  step(engine, 0.2);
  eq(S.player.cx, 0, 'игрок не вышел за границу (низ)');
  assertStateFinite(S, 'границы поля');
});

test('алмаз: +25 очков, событие gem, счётчик и удаление из items', () => {
  const { engine, S } = lab();
  S.score = 0; S.gemsLeft = 5; S.gemsTotal = 5; S.gemChain = 0;
  const gem = putItem(S, 'gem', 8, 5);
  const evs = eventCapture(engine);
  engine.setDir(1);
  step(engine, 0.3);
  engine.setDir(-1);
  eq(S.score, 25, 'очки за алмаз');
  eq(S.gemsLeft, 4, 'gemsLeft');
  eq(S.gemChain, 1, 'цепочка алмазов');
  eq(S.gemsCollected, 1, 'gemsCollected');
  eq(S.stats.gems, 1, 'stats.gems');
  eq(S.items.indexOf(gem), -1, 'алмаз удалён из items');
  const g = ev(evs, 'gem');
  eq(g.length, 1, 'событие gem');
  eq(g[0].data.score, 25, 'gem.score');
  eq(g[0].data.chain, 1, 'gem.chain');
});

test('комбо: каждые 8 алмазов подряд дают +250 (8 алмазов = 450)', () => {
  const { engine, S } = lab();
  movePlayer(S, 1, 5);
  S.grid.fill(0);
  for (let cx = 1; cx <= 12; cx++) digCell(S, cx, 5);
  S.score = 0; S.gemsLeft = 99; S.gemsTotal = 100; S.gemChain = 0;
  for (let k = 0; k < 8; k++) putItem(S, 'gem', 2 + k, 5);
  const evs = eventCapture(engine);
  engine.setDir(1);
  step(engine, 1.4);
  engine.setDir(-1);
  eq(S.score, 450, 'очки: 8×25 + 250');
  eq(countType(evs, 'gem'), 8, 'событий gem');
  const gemEvents = ev(evs, 'gem');
  eq(gemEvents[6].data.score, 25, '7-й алмаз без бонуса');
  eq(gemEvents[7].data.score, 275, '8-й алмаз +250');
  eq(gemEvents[7].data.chain, 8, 'chain==8');
  eq(S.gemsLeft, 91, 'gemsLeft');
  eq(S.items.filter((i) => i.type === 'gem').length, 0, 'все алмазы собраны');
});

test('золото: +500 очков, событие gold', () => {
  const { engine, S } = lab();
  S.score = 0;
  putItem(S, 'gold', 8, 5);
  const evs = eventCapture(engine);
  engine.setDir(1);
  step(engine, 0.3);
  engine.setDir(-1);
  eq(S.score, 500, 'очки за золото');
  eq(countType(evs, 'gold'), 1, 'событие gold');
  eq(S.items.filter((i) => i.type === 'gold').length, 0, 'золото подобрано');
});

test('вишня: +1000 и запуск бонус-режима (§4)', () => {
  const { engine, S } = lab();
  S.score = 0;
  putItem(S, 'cherry', 8, 5);
  const evs = eventCapture(engine);
  engine.setDir(1);
  step(engine, 0.3);
  engine.setDir(-1);
  eq(S.score, 1000, 'очки за вишню');
  eq(S.bonus, true, 'S.bonus');
  eq(S.mode, 'bonus', 'mode bonus');
  ok(S.bonusT > 0, 'bonusT > 0');
  approx(S.bonusDur, 15, 1e-9, 'длительность бонуса на 1 уровне');
  eq(countType(evs, 'cherry'), 1, 'событие cherry');
  eq(countType(evs, 'bonusStart'), 1, 'событие bonusStart');
});

test('бонус: длительность 15 / 9 / 6 с для уровней 1 / 5 / 10', () => {
  for (const [level, expected] of [[1, 15], [5, 9], [10, 6]]) {
    const { engine, S } = lab();
    S.level = level;
    putItem(S, 'cherry', 8, 5);
    engine.setDir(1);
    step(engine, 0.2);
    engine.setDir(-1);
    eq(S.mode, 'bonus', 'bonус на уровне ' + level);
    approx(S.bonusDur, expected, 1e-9, 'bonusDur уровень ' + level);
  }
});

test('бонус заканчивается: mode play, новая волна монстров, событие bonusEnd', () => {
  const { engine, S } = lab();
  S.level = 1; S.gemsLeft = 5;
  putItem(S, 'cherry', 8, 5);
  engine.setDir(1);
  step(engine, 0.2);
  engine.setDir(-1);
  eq(S.mode, 'bonus', 'бонус начался');
  const evs = eventCapture(engine);
  step(engine, 15.4);
  eq(S.mode, 'play', 'после бонуса — play');
  eq(S.bonus, false, 'S.bonus сброшен');
  eq(countType(evs, 'bonusEnd'), 1, 'событие bonusEnd');
  ok(S.spawnLeft > 0, 'новая волна монстров (spawnLeft=' + S.spawnLeft + ')');
});

test('бонус: поедание монстров даёт 200 → 400 → ...', () => {
  const { engine, S } = lab();
  S.mode = 'bonus'; S.bonus = true; S.bonusT = 10; S.bonusDur = 10;
  S.eatChain = 0; S.score = 0;
  putMonster(S, 7, 5, 'crawler', { think: 999, spawnT: 1 });
  const evs = eventCapture(engine);
  engine.update(1 / 60);
  eq(S.score, 200, 'первый съеденный монстр');
  eq(S.eatChain, 1, 'eatChain');
  ok(S.monsters[0].dying > 0, 'монстр умирает');
  putMonster(S, 7, 5, 'crawler', { think: 999, spawnT: 1 });
  engine.update(1 / 60);
  eq(S.score, 600, 'второй съеденный монстр');
  eq(S.eatChain, 2, 'eatChain');
  putMonster(S, 7, 5, 'crawler', { think: 999, spawnT: 1 });
  engine.update(1 / 60);
  eq(S.score, 1400, 'третий съеденный монстр (+800)');
  eq(S.eatChain, 3, 'eatChain');
  const dies = ev(evs, 'monsterDie');
  eq(dies.length, 3, 'события monsterDie');
  eq(dies[0].data.by, 'eat', 'by=eat');
  eq(dies[0].data.score, 200, 'первая награда');
  eq(dies[1].data.score, 400, 'вторая награда');
  eq(dies[2].data.score, 800, 'третья награда');
});

/* ========================================================================== */
/* 5. Сумки золота (§4)                                                       */
/* ========================================================================== */
test('сумка трясётся, когда из-под неё прокопали (0.8 с)', () => {
  const { engine, S } = lab();
  const bag = putItem(S, 'bag', 5, 3);
  digCell(S, 5, 4);
  const evs = eventCapture(engine);
  engine.update(1 / 60);
  ok(bag.wobble > 0 && bag.wobble <= 0.8, 'wobble 0..0.8: ' + bag.wobble);
  eq(bag.falling, false, 'ещё не падает');
  eq(countType(evs, 'bagWobble'), 1, 'событие bagWobble');
  step(engine, 0.85);
  eq(bag.falling, true, 'через 0.8 с сумка падает');
  eq(countType(evs, 'bagFall'), 1, 'событие bagFall');
});

test('сумка: падение ≥2 клеток → лопается и оставляет золото (500)', () => {
  const { engine, S } = lab();
  const bag = putItem(S, 'bag', 5, 3);
  digCell(S, 5, 4); digCell(S, 5, 5); digCell(S, 5, 6);
  const evs = eventCapture(engine);
  step(engine, 2.0);
  eq(S.items.indexOf(bag), -1, 'сумка исчезла');
  const gold = S.items.filter((i) => i.type === 'gold');
  eq(gold.length, 1, 'появилось золото');
  eq(gold[0].cx, 5, 'золото по X');
  eq(gold[0].cy, 6, 'золото по Y');
  eq(countType(evs, 'bagBreak'), 1, 'событие bagBreak');
  eq(S.stats.bagKills, 1, 'stats.bagKills');
  eq(S.score, 0, 'золото ещё не подобрано');
  ok(S.items.indexOf(gold[0]) >= 0, 'золото в items');
});

test('сумка: падение на 1 клетку — лежит, не ломается', () => {
  const { engine, S } = lab();
  const bag = putItem(S, 'bag', 5, 3);
  digCell(S, 5, 4);
  const evs = eventCapture(engine);
  step(engine, 2.0);
  ok(S.items.indexOf(bag) >= 0, 'сумка осталась');
  eq(bag.falling, false, 'не падает');
  eq(bag.cy, 4, 'опустилась ровно на 1 клетку');
  eq(bag.wobble, -1, 'снова стабильна');
  eq(S.items.filter((i) => i.type === 'gold').length, 0, 'золота нет');
  eq(S.stats.bagKills, 0, 'ног не ломалось');
  eq(countType(evs, 'bagBreak'), 0, 'события bagBreak нет');
});

test('падающая сумка убивает монстра (+250, by=bag)', () => {
  const { engine, S } = lab();
  S.spawnLeft = 5;
  putItem(S, 'bag', 5, 3);
  digCell(S, 5, 4); digCell(S, 5, 5); digCell(S, 5, 6);
  const mon = putMonster(S, 5, 5, 'crawler', { think: 999, spawnT: 1 });
  const evs = eventCapture(engine);
  step(engine, 1.5);
  ok(mon.dying > 0 || S.monsters.indexOf(mon) < 0, 'монстр убит');
  eq(S.score, 250, 'очки за монстра');
  eq(S.kills, 1, 'S.kills');
  const dies = ev(evs, 'monsterDie');
  eq(dies.length, 1, 'событие monsterDie');
  eq(dies[0].data.by, 'bag', 'by=bag');
});

test('падающая сумка убивает игрока (squash + playerDie, lives−1)', () => {
  const { engine, S } = lab();
  putItem(S, 'bag', 5, 4);
  digCell(S, 5, 5);
  movePlayer(S, 5, 6);
  const evs = eventCapture(engine);
  step(engine, 2.0);
  eq(S.mode, 'dying', 'режим dying');
  eq(S.lives, 2, 'жизней стало 2');
  eq(S.player.alive, false, 'игрок мёртв');
  eq(countType(evs, 'squash'), 1, 'событие squash');
  const dies = ev(evs, 'playerDie');
  eq(dies.length, 1, 'событие playerDie');
  eq(dies[0].data.cause, 'bag', 'причина bag');
});

test('сумку можно толкать по горизонтали в туннель', () => {
  const { engine, S } = lab();
  const bag = putItem(S, 'bag', 8, 5);
  movePlayer(S, 7, 5);
  digCell(S, 9, 5);
  const evs = eventCapture(engine);
  engine.setDir(1);
  eq(bag.cx, 9, 'сумка сдвинулась в туннель');
  eq(S.player.cx, 8, 'игрок занял клетку сумки');
  eq(countType(evs, 'bagPush'), 1, 'событие bagPush');
  engine.setDir(-1);
  step(engine, 0.2);
  eq(bag.falling, false, 'сумка не падает на опоре');
});

test('сумку нельзя толкать в землю (игрок остаётся на месте)', () => {
  const { engine, S } = lab();
  putItem(S, 'bag', 8, 5);
  movePlayer(S, 7, 5);
  const evs = eventCapture(engine);
  engine.setDir(1);
  step(engine, 0.5);
  eq(S.player.cx, 7, 'игрок не сдвинулся');
  eq(S.items[0].cx, 8, 'сумка не сдвинулась');
  eq(countType(evs, 'bagPush'), 0, 'события bagPush нет');
});

/* ========================================================================== */
/* 6. Оружие и монстры (§4)                                                   */
/* ========================================================================== */
test('выстрел: пуля, событие shoot, перезарядка shootMax', () => {
  const { engine, S } = lab();
  const evs = eventCapture(engine);
  engine.shoot();
  eq(S.bullets.length, 1, 'пуля создана');
  eq(S.stats.shots, 1, 'stats.shots');
  approx(S.player.shootCd, S.player.shootMax, 1e-9, 'shootCd = shootMax');
  ok(S.player.shootAnim > 0, 'вспышка выстрела');
  eq(countType(evs, 'shoot'), 1, 'событие shoot');
  engine.shoot();
  eq(S.stats.shots, 1, 'перезарядка не даёт стрелять');
  step(engine, 1.3);
  engine.shoot();
  eq(S.stats.shots, 2, 'после перезарядки снова можно');
});

test('скорость пули 16 клеток/с', () => {
  const { engine, S } = lab();
  movePlayer(S, 1, 5);
  for (let cx = 1; cx <= 13; cx++) digCell(S, cx, 5);
  S.player.dir = 1;
  engine.shoot();
  const start = S.bullets[0].x;
  step(engine, 0.15);
  eq(S.bullets.length, 1, 'пуля ещё летит');
  approx(S.bullets[0].x - start, 16 * 0.15, 0.3, 'смещение пули за 0.15 с');
});

test('скорость игрока: 0.105 с на клетку (§4 баланс)', () => {
  const { engine, S } = lab();
  digCell(S, 8, 5);
  engine.setDir(1);
  engine.setDir(-1); // отменяем продолжение движения, меряем ровно одну клетку
  eq(S.player.moving, true, 'движение начато');
  let t = 0;
  const dt = 1 / 240;
  let guard = 0;
  while (S.player.moving && guard++ < 240) { engine.update(dt); t += dt; }
  eq(S.player.moving, false, 'игрок дошёл до центра клетки');
  approx(t, 0.105, 0.01, 'время прохождения клетки');
});

test('скорость монстров по балансу §4', () => {
  /* Меряем скорость внутри одного шага (меньше клетки), пока монстр не начал
     выбирать новый маршрут: смешение / время = 1/сек-на-клетку. */
  function measure(level, kind, scared, secPerCell) {
    const { engine, S } = lab();
    S.level = level;
    if (scared) { S.bonus = true; S.bonusT = 10; S.bonusDur = 10; S.mode = 'bonus'; }
    for (let cx = 1; cx <= 13; cx++) digCell(S, cx, 4);
    const m = putMonster(S, 2, 4, kind, { think: 999, spawnT: 1 });
    Object.assign(m, {
      moving: true, fromX: 1, fromY: 4, cx: 2, cy: 4,
      x: 2.5, y: 4.5, tx: 3.5, ty: 4.5
    });
    const x0 = m.x;
    const dt = 1 / 240;
    const seconds = secPerCell * 0.6;
    const n = Math.max(1, Math.round(seconds / dt));
    for (let i = 0; i < n; i++) engine.update(dt);
    return (m.x - x0) / (n * dt);
  }
  approx(measure(1, 'crawler', false, 0.38), 1 / 0.38, 0.01, 'crawler, 1 уровень (0.30+0.08 с/клетка)');
  approx(measure(4, 'crawler', false, 0.30), 1 / 0.30, 0.01, 'crawler, 4 уровень (0.30)');
  approx(measure(4, 'gnawer', false, 0.42), 1 / 0.42, 0.01, 'gnawer (0.42)');
  approx(measure(1, 'crawler', true, 0.22), 1 / 0.22, 0.02, 'испуганный монстр (0.22)');
});

test('выстрел убивает монстра (+250, by=bullet)', () => {
  const { engine, S } = lab();
  S.spawnLeft = 5;
  movePlayer(S, 3, 5);
  S.player.dir = 1;
  for (let cx = 1; cx <= 12; cx++) digCell(S, cx, 5);
  putMonster(S, 8, 5, 'crawler', { think: 999, spawnT: 1 });
  const evs = eventCapture(engine);
  engine.shoot();
  step(engine, 0.6);
  eq(S.kills, 1, 'монстр убит');
  eq(S.score, 250, 'очки');
  const dies = ev(evs, 'monsterDie');
  eq(dies.length, 1, 'событие monsterDie');
  eq(dies[0].data.by, 'bullet', 'by=bullet');
  ok(S.monsters.length === 0 || S.monsters[0].dying > 0, 'монстр мёртв');
});

test('пуля гаснет о землю и не копает её', () => {
  const { engine, S } = lab();
  movePlayer(S, 3, 5);
  S.player.dir = 1;
  engine.shoot();
  step(engine, 0.3);
  eq(S.bullets.length, 0, 'пуля исчезла');
  eq(S.grid[idx(8, 5)], 0, 'земля не прокопана');
  eq(S.stats.dug, 0, 'stats.dug не менялся');
});

test('контакт с монстром: ближе 0.58 клетки — смерть, 0.6 — нет (§4 баланс)', () => {
  let { engine, S } = lab();
  S.spawnLeft = 5;
  const m = putMonster(S, S.player.cx, S.player.cy, 'crawler', { think: 999, spawnT: 1 });
  m.x = S.player.x + 0.5; m.y = S.player.y;
  engine.update(1 / 60);
  eq(S.mode, 'dying', '0.5 клетки — смерть');

  ({ engine, S } = lab());
  S.spawnLeft = 5;
  const m2 = putMonster(S, S.player.cx, S.player.cy, 'crawler', { think: 999, spawnT: 1 });
  m2.x = S.player.x + 0.6; m2.y = S.player.y;
  engine.update(1 / 60);
  eq(S.mode, 'play', '0.6 клетки — ещё не смерть');
  eq(S.player.alive, true, 'игрок жив');
});

test('контакт с монстром убивает игрока (mode dying, lives−1, 1.6 с)', () => {
  const { engine, S } = lab();
  S.spawnLeft = 5;
  putMonster(S, 7, 5, 'crawler', { think: 999, spawnT: 1 });
  const evs = eventCapture(engine);
  engine.update(1 / 60);
  eq(S.mode, 'dying', 'mode dying');
  eq(S.lives, 2, 'жизней 2');
  eq(S.player.alive, false, 'игрок мёртв');
  approx(S.deadT, 1.6, 0.05, 'анимация смерти 1.6 с');
  const dies = ev(evs, 'playerDie');
  eq(dies.length, 1, 'событие playerDie');
  eq(dies[0].data.cause, 'monster', 'причина monster');
});

test('неуязвимость после респавна спасает от контакта', () => {
  const { engine, S } = lab();
  S.spawnLeft = 5;
  S.player.invuln = 1.0;
  putMonster(S, 7, 5, 'crawler', { think: 999, spawnT: 1 });
  step(engine, 0.5);
  eq(S.mode, 'play', 'игрок жив при invuln');
  eq(S.player.alive, true, 'alive');
  eq(S.lives, 3, 'жизни не потрачены');
});

test('смерть: респавн — mode ready, уровень перестроен, событие levelStart(respawn)', () => {
  const { engine, S } = lab();
  S.spawnLeft = 5;
  putMonster(S, 7, 5, 'crawler', { think: 999, spawnT: 1 });
  engine.update(1 / 60);
  eq(S.mode, 'dying', 'умер');
  const evs = eventCapture(engine);
  step(engine, 1.7);
  eq(S.mode, 'ready', 'режим ready после смерти');
  eq(S.lives, 2, 'жизней 2');
  eq(S.player.alive, true, 'игрок жив после респавна');
  ok(S.readyT > 0, 'readyT > 0');
  ok(S.gemsTotal > 0, 'уровень перестроен');
  ok(S.player.invuln > 2.3 && S.player.invuln <= 2.5, 'неуязвимость после респавна 2.5 с: ' + S.player.invuln);
  const ls = ev(evs, 'levelStart');
  ok(ls.length >= 1, 'levelStart после респавна');
  eq(ls[0].data.respawn, true, 'respawn=true');
  step(engine, 2.0);
  eq(S.mode, 'play', 'затем снова play');
});

test('жизни 0 → gameover, событие gameOver с score/hi/record', () => {
  const { engine, S } = lab();
  S.lives = 1;
  S.score = 4321;
  S.spawnLeft = 5;
  putMonster(S, 7, 5, 'crawler', { think: 999, spawnT: 1 });
  const evs = eventCapture(engine);
  engine.update(1 / 60);
  step(engine, 1.7);
  eq(S.mode, 'gameover', 'mode gameover');
  eq(S.lives, 0, 'жизней 0');
  eq(S.player.alive, false, 'игрок мёртв');
  const go = ev(evs, 'gameOver');
  eq(go.length, 1, 'событие gameOver');
  finite(go[0].data.score, 'gameOver.score');
  finite(go[0].data.hi, 'gameOver.hi');
  eq(typeof go[0].data.record, 'boolean', 'gameOver.record');
  ok(go[0].data.hi >= 4321, 'hi не меньше счёта');
});

test('три смерти подряд при 3 жизнях → gameover, lives 0', () => {
  const e = mk(55);
  e.start();
  const S = e.state;
  step(e, 2.0);
  eq(S.mode, 'play', 'игра началась');
  for (let k = 0; k < 3; k++) {
    S.player.invuln = 0;
    putMonster(S, S.player.cx, S.player.cy, 'crawler', { think: 999, spawnT: 1 });
    e.update(1 / 60);
    eq(S.mode, 'dying', 'смерть #' + (k + 1));
    eq(S.lives, 2 - k, 'жизни после смерти #' + (k + 1));
    step(e, 1.7);
    if (k < 2) {
      eq(S.mode, 'ready', 'респавн #' + (k + 1));
      step(e, 2.0);
      eq(S.mode, 'play', 'снова игра #' + (k + 1));
    } else {
      eq(S.mode, 'gameover', 'жизни кончились');
    }
  }
  eq(S.lives, 0, 'жизней 0');
  eq(S.player.alive, false, 'игрок мёртв');
});

test('extra life каждые 20 000 очков', () => {
  const { engine, S } = lab();
  S.score = 19990; S.nextLife = 20000; S.lives = 3;
  putItem(S, 'gem', 8, 5);
  const evs = eventCapture(engine);
  engine.setDir(1);
  step(engine, 0.3);
  engine.setDir(-1);
  eq(S.score, 20015, 'счёт перешагнул 20000');
  eq(S.lives, 4, 'дополнительная жизнь');
  eq(S.nextLife, 40000, 'следующий порог');
  eq(countType(evs, 'extraLife'), 1, 'событие extraLife');
});

/* ========================================================================== */
/* 7. Уровни, спавн, бонус-вишня                                              */
/* ========================================================================== */
test('уровень пройден сбором последнего алмаза: +1000, levelclear, следующий уровень', () => {
  const { engine, S } = lab();
  S.score = 0; S.gemsLeft = 1; S.gemsTotal = 1; S.gemsCollected = 0;
  putItem(S, 'gem', 8, 5);
  const evs = eventCapture(engine);
  engine.setDir(1);
  step(engine, 0.3);
  engine.setDir(-1);
  eq(S.mode, 'levelclear', 'mode levelclear');
  eq(S.score, 25 + 1000, 'алмаз + бонус за уровень');
  ok(S.clearT > 1.5, 'clearT ≈ 2 с');
  eq(countType(evs, 'levelClear'), 1, 'событие levelClear');
  step(engine, 2.2);
  eq(S.level, 2, 'следующий уровень');
  eq(S.mode, 'ready', 'mode ready');
  ok(S.gemsTotal > 0, 'уровень 2 построен');
  ok(ev(evs, 'levelStart').length >= 1, 'событие levelStart');
});

test('уровень пройден, когда бюджет монстров исчерпан и живых нет (+событие)', () => {
  const { engine, S } = lab();
  S.spawnLeft = 0;
  S.monsters.length = 0;
  S.gemsLeft = 99;
  digCell(S, 14, 0);
  const evs = eventCapture(engine);
  engine.update(1 / 60);
  eq(S.mode, 'levelclear', 'mode levelclear');
  eq(countType(evs, 'levelClear'), 1, 'событие levelClear');
});

test('уровень пройден, когда убит последний монстр (выстрелом, +1000)', () => {
  const { engine, S } = lab();
  S.score = 0;
  S.spawnLeft = 0;
  movePlayer(S, 3, 5);
  S.player.dir = 1;
  for (let cx = 1; cx <= 12; cx++) digCell(S, cx, 5);
  putMonster(S, 6, 5, 'crawler', { think: 999, spawnT: 1 });
  const evs = eventCapture(engine);
  engine.shoot();
  step(engine, 0.6);
  eq(S.mode, 'levelclear', 'последний монстр убит → levelclear');
  eq(S.score, 250 + 1000, 'монстр + бонус за уровень');
  eq(countType(evs, 'levelClear'), 1, 'событие levelClear');
});

test('вишня появляется в (14,0), когда бюджет спавна исчерпан', () => {
  const { engine, S } = lab();
  S.spawnLeft = 0;
  S.cherrySpawned = false;
  S.gemsLeft = 99;
  digCell(S, 14, 0);
  digCell(S, 2, 2);
  putMonster(S, 2, 2, 'crawler', { think: 999, spawnT: 1 });
  engine.update(1 / 60);
  const cherry = S.items.find((i) => i.type === 'cherry');
  ok(cherry, 'вишня появилась');
  eq(cherry.cx, 14, 'вишня по X');
  eq(cherry.cy, 0, 'вишня по Y');
  eq(S.cherrySpawned, true, 'флаг cherrySpawned');
  eq(S.mode, 'play', 'уровень не пройден, пока есть монстр');
});

test('спавн монстров: клетка (14,0), лимит одновременно', () => {
  const e = mk(77);
  e.setLevel(5);
  const S = e.state;
  const evs = eventCapture(e);
  step(e, 2.0);
  eq(S.mode, 'play', 'play');
  eq(S.monsters.length, 0, 'до первого спавна монстров нет');
  step(e, 1.3);
  eq(S.monsters.length, 1, 'первый монстр');
  const spawns = ev(evs, 'monsterSpawn');
  eq(spawns.length, 1, 'событие monsterSpawn');
  approx(spawns[0].data.x, 14.5, 1e-9, 'x спавна (14,0)');
  approx(spawns[0].data.y, 0.5, 1e-9, 'y спавна (14,0)');
  eq(S.spawnLeft, 5, 'бюджет уменьшился');
  step(e, 2.1);
  eq(S.monsters.length, 2, 'второй монстр');
});

test('интервал спавна монстров = max(1.3, 3.0-0.18*level) (§4)', () => {
  for (const [level, expected] of [[4, 2.28], [10, 1.3]]) {
    const e = mk(78);
    e.setLevel(level);
    const S = e.state;
    const times = [];
    e.onEvent((type) => { if (type === 'monsterSpawn') times.push(S.time); });
    let guard = 0;
    while (times.length < 2 && guard++ < 60 * 20) e.update(1 / 60);
    eq(times.length, 2, 'два спавна произошли на уровне ' + level);
    approx(times[1] - times[0], expected, 0.06, 'интервал спавна, уровень ' + level);
  }
});

test('баланс: бюджет/лимит/gnawer/shootMax/мешки по уровням (§4)', () => {
  const e = mk(5);
  e.setLevel(1);
  let S = e.state;
  eq(S.spawnLeft, 2, 'бюджет 1 уровня (1+level)');
  eq(S.monstersMax, 1, 'лимит 1 уровня');
  eq(S.gnawerChance, 0, 'на 1 уровне грызунов нет');
  approx(S.player.shootMax, 1.2, 1e-9, 'shootMax 1 ур.');
  eq(S.items.filter((i) => i.type === 'bag').length, 3, 'мешков на 1 уровне');
  ok(S.gemsTotal >= 11 && S.gemsTotal <= 15, 'алмазов на 1 уровне: ' + S.gemsTotal);

  e.setLevel(3);
  S = e.state;
  eq(S.spawnLeft, 4, 'бюджет 3 уровня');
  eq(S.monstersMax, 2, 'лимит 3 уровня (1+floor(2/2))');
  eq(S.gnawerChance, 0, 'на 3 уровне шанс грызуна 0 (появляются с 4-го)');

  e.setLevel(4);
  S = e.state;
  eq(S.spawnLeft, 5, 'бюджет 4 уровня');
  eq(S.monstersMax, 2, 'лимит 4 уровня (1+floor(3/2))');
  approx(S.gnawerChance, 0.15, 1e-9, 'шанс грызуна на 4 уровне');
  approx(S.player.shootMax, 1.56, 1e-9, 'shootMax 4 ур.');
  eq(S.items.filter((i) => i.type === 'bag').length, 5, 'мешков на 4 уровне');

  e.setLevel(5);
  S = e.state;
  eq(S.spawnLeft, 6, 'бюджет 5 уровня');
  eq(S.monstersMax, 3, 'лимит 5 уровня (1+floor(4/2))');
  approx(S.gnawerChance, 0.30, 1e-9, 'шанс грызуна на 5 уровне');

  e.setLevel(10);
  S = e.state;
  eq(S.spawnLeft, 9, 'бюджет 10 уровня (макс 9)');
  eq(S.monstersMax, 4, 'лимит 10 уровня (макс 4)');
  approx(S.gnawerChance, 0.65, 1e-9, 'доля грызунов (макс 0.65)');
  approx(S.player.shootMax, 2.28, 1e-9, 'shootMax 10 ур.');
  eq(S.items.filter((i) => i.type === 'bag').length, 5, 'мешков на 10 уровне');
  ok(S.gemsTotal >= 26 && S.gemsTotal <= 30, 'алмазов на 10 уровне: ' + S.gemsTotal);
});

test('грызуны: на 1–3 уровне только ползуны, на 10 уровне есть грызуны', () => {
  const e1 = mk(1234);
  e1.setLevel(1);
  const evs1 = eventCapture(e1);
  step(e1, 12);
  const kinds1 = ev(evs1, 'monsterSpawn').map((x) => x.data.kind);
  ok(kinds1.length > 0, 'на 1 уровне были спавны');
  for (const k of kinds1) eq(k, 'crawler', 'на 1 уровне только crawler');

  const e3 = mk(1234);
  e3.setLevel(3);
  const evs3 = eventCapture(e3);
  step(e3, 12);
  const kinds3 = ev(evs3, 'monsterSpawn').map((x) => x.data.kind);
  ok(kinds3.length > 0, 'на 3 уровне были спавны');
  for (const k of kinds3) eq(k, 'crawler', 'на 3 уровне грызунов нет (шанс 0)');

  const e2 = mk(1234);
  e2.setLevel(10);
  const evs2 = eventCapture(e2);
  step(e2, 30);
  const kinds2 = ev(evs2, 'monsterSpawn').map((x) => x.data.kind);
  ok(kinds2.length >= 3, 'на 10 уровне несколько спавнов: ' + kinds2.length);
  ok(kinds2.some((k) => k === 'gnawer'), 'среди них есть gnawer: ' + kinds2.join(','));
});

/* ========================================================================== */
/* 8. Пауза, debug-режимы, детерминизм                                        */
/* ========================================================================== */
test('пауза: анимации и игрок заморожены, S.time идёт, событие pause', () => {
  const { engine, S } = lab();
  S.spawnLeft = 5;
  const evs = eventCapture(engine);
  const x0 = S.player.x, anim0 = S.anim, time0 = S.time, mode0 = S.mode;
  engine.pause(true);
  eq(S.paused, true, 'paused');
  eq(countType(evs, 'pause'), 1, 'событие pause');
  eq(evs[0].data.paused, true, 'pause.paused');
  step(engine, 0.6);
  eq(S.player.x, x0, 'игрок не двигается');
  eq(S.anim, anim0, 'игровое время стоит');
  eq(S.mode, mode0, 'режим не меняется');
  ok(S.time > time0, 'wall time идёт');
  engine.togglePause();
  eq(S.paused, false, 'пауза снята');
  step(engine, 0.2);
  ok(S.anim > anim0, 'игра снова идёт');
});

test('forceMode: переключает title/play/bonus/gameover/levelclear/dying', () => {
  let e = mk(33); e.forceMode('title');
  eq(e.state.mode, 'title', 'title');
  e = mk(33); e.forceMode('play');
  eq(e.state.mode, 'play', 'play');
  eq(e.state.player.alive, true, 'play: игрок жив');
  e = mk(33); e.forceMode('bonus');
  eq(e.state.mode, 'bonus', 'bonus');
  eq(e.state.bonus, true, 'bonus: флаг');
  ok(e.state.monsters.length > 0 && e.state.monsters.every((m) => m.scared), 'bonus: монстры испуганы');
  e = mk(33); e.forceMode('gameover');
  eq(e.state.mode, 'gameover', 'gameover');
  eq(e.state.player.alive, false, 'gameover: игрок мёртв');
  e = mk(33); e.forceMode('levelclear');
  eq(e.state.mode, 'levelclear', 'levelclear');
  ok(e.state.clearT > 0, 'levelclear: clearT');
  e = mk(33); e.forceMode('dying');
  eq(e.state.mode, 'dying', 'dying');
  ok(e.state.deadT > 0, 'dying: deadT');
  e.forceMode('play');
  eq(e.state.mode, 'play', 'после dying снова play');
});

test('детерминизм: одинаковый seed + одинаковые команды → одинаковое состояние', () => {
  function scripted(engine) {
    const r = KROT.rng(555);
    for (let i = 0; i < 500; i++) {
      if (i % 9 === 0) engine.setDir(Math.floor(r() * 5) - 1);
      if (i % 13 === 0) engine.shoot();
      if (i === 250) engine.togglePause();
      if (i === 280) engine.togglePause();
      engine.update(1 / 60);
    }
  }
  const A = mk(4242), B = mk(4242);
  A.start(); B.start();
  eq(snapshot(A.state), snapshot(B.state), 'стартовое состояние');
  scripted(A);
  scripted(B);
  eq(snapshot(A.state), snapshot(B.state), 'состояние после 500 кадров');
  ok(A.state.stats.dug > 0 || A.state.score > 0 || A.state.monsters.length > 0, 'симуляция не пустая');
});

test('детерминизм: разные seed дают разные уровни', () => {
  const A = mk(4242); A.setLevel(3);
  const B = mk(4243); B.setLevel(3);
  ok(JSON.stringify(Array.from(A.state.grid)) !== JSON.stringify(Array.from(B.state.grid)),
    'сетки разных seed должны различаться');
});

/* ========================================================================== */
/* 9. Длинная симуляция и инварианты (§7.1)                                   */
/* ========================================================================== */
test('60 с симуляции со случайными вводами: нет NaN, исключений, невалидного state', () => {
  const e = mk(2024);
  const S = e.state;
  const rnd = KROT.rng(9001);
  let error = null;
  let steps = 0;
  e.start();
  try {
    for (let i = 0; i < 3600; i++) {
      const r = rnd();
      if (i % 3 === 0) e.setDir(Math.floor(rnd() * 5) - 1);
      if (r < 0.07) e.shoot();
      if (i === 900) e.togglePause();
      if (i === 940) e.togglePause();
      if (S.mode === 'gameover' && i % 120 === 0) e.start();
      e.update(1 / 60);
      steps++;
      assertStateFinite(S, 'кадр ' + i);
    }
  } catch (err) {
    error = err;
  }
  ok(!error, 'исключение/NaN: ' + (error && (error.stack || error.message)));
  eq(steps, 3600, 'все 3600 кадров выполнены');
  ok(S.score >= 0, 'счёт не отрицательный');
  ok(Number.isInteger(S.score), 'счёт целый');
  ok(Number.isInteger(S.lives) && S.lives >= 0, 'жизни — целое ≥ 0');
  ok(Number.isInteger(S.level) && S.level >= 1, 'уровень ≥ 1');
  ok(S.particles.length <= 260, 'частиц не больше 260');
  ok(S.popups.length <= 40, 'попапов не больше 40');
});

test('5 минут (300 с) симуляции со случайными вводами: нет NaN/исключений', () => {
  const e = mk(31337);
  const S = e.state;
  const rnd = KROT.rng(4242);
  let error = null;
  let steps = 0;
  e.start();
  try {
    for (let i = 0; i < 18000; i++) {
      if (i % 4 === 0) e.setDir(Math.floor(rnd() * 5) - 1);
      if (rnd() < 0.06) e.shoot();
      if (i % 3000 === 1500) e.togglePause();
      if (i % 3000 === 1560) e.togglePause();
      if (S.mode === 'gameover' && i % 90 === 0) e.start();
      e.update(1 / 60);
      steps++;
      if (i % 7 === 0) assertStateFinite(S, '5min кадр ' + i);
    }
  } catch (err) {
    error = err;
  }
  ok(!error, 'исключение/NaN: ' + (error && (error.stack || error.message)));
  eq(steps, 18000, 'все 18000 кадров выполнены');
  assertStateFinite(S, 'после 5 минут');
});

test('события движка: только документированные §4 (плюс известный лишний bulletHit)', () => {
  const { engine, S } = lab();
  S.spawnLeft = 6; S.monstersMax = 3; S.gnawerChance = 0.3; S.spawnTimer = 0.1; S.gemsLeft = 99;
  const evs = eventCapture(engine);
  const r = KROT.rng(31);
  for (let i = 0; i < 1200; i++) {
    if (i % 7 === 0) engine.setDir(Math.floor(r() * 5) - 1);
    if (i % 11 === 0) engine.shoot();
    engine.update(1 / 60);
  }
  ok(evs.length > 0, 'события были');
  const CONTRACT_EVENTS = ['dig', 'gem', 'gold', 'shoot', 'monsterDie', 'bulletHit', 'squash', 'bagPush',
    'bagWobble', 'bagFall', 'bagBreak', 'cherry', 'bonusStart', 'bonusEnd', 'eat',
    'playerDie', 'extraLife', 'levelStart', 'levelClear', 'gameOver', 'monsterSpawn', 'pause'];
  const used = Array.from(new Set(types(evs)));
  const unknown = used.filter((t) => CONTRACT_EVENTS.indexOf(t) < 0);
  eq(unknown.length, 0, 'недокументированные события: ' + unknown.join(','));
  for (const e of evs) eq(typeof e.type, 'string', 'тип события');
});

/* ========================================================================== */
/* 10. i18n и старт/ресет                                                     */
/* ========================================================================== */
test('i18n: наборы ключей RU/EN совпадают, все ключи §6.4 на месте', () => {
  const STR = KROT.i18n.STR;
  const ru = Object.keys(STR.ru).sort();
  const en = Object.keys(STR.en).sort();
  eq(JSON.stringify(ru), JSON.stringify(en), 'наборы ключей RU и EN');
  const contractKeys = ('appTitle appTagline play start resume restart menu toMenu settings help about back close ' +
    'score hiscore level lives gems bonus paused ready levelIntro cleared gameover yourScore newRecord pressEnter ' +
    'gfx gfxClassic gfxModern language music sfx crt on off controls controlsMove controlsShoot controlsPause ' +
    'controlsMenu controlsLang controlsMusic controlsGfx controlsRestart controlsHelp mechanics mechDig mechGems ' +
    'mechBags mechMonsters mechBonus mechWeapon aboutText aboutOriginal aboutTech aboutCredits resetRecord recordReset ' +
    'touchHint soundOn soundOff musicOn musicOff newGame quit bonusMode bonusTime recharge levelCleared livesShort ' +
    'hiscoreShort settingsSaved keyboard mouse footerHint version').split(' ');
  for (const key of contractKeys) {
    ok(STR.ru[key] != null, 'RU: нет ключа ' + key);
    ok(STR.en[key] != null, 'EN: нет ключа ' + key);
  }
  const HUD = ['score', 'hiscore', 'level', 'lives', 'gems', 'bonus', 'paused', 'ready', 'levelIntro', 'bonusMode'];
  for (const key of HUD) ok(KROT.t(key).length > 0, 'HUD-ключ ' + key);
  const saved = KROT.i18n.lang;
  KROT.i18n.setLang('en');
  eq(KROT.t('score'), 'SCORE', 'EN score');
  eq(KROT.t('levelIntro', { n: 3 }), 'LEVEL 3', 'EN подстановка');
  KROT.i18n.setLang('ru');
  eq(KROT.t('levelIntro', { n: 7 }), 'УРОВЕНЬ 7', 'RU подстановка');
  eq(KROT.t('__no_such_key__'), '__no_such_key__', 'фолбэк на имя ключа');
  eq(KROT.i18n.lang, 'ru', 'язык восстановлен');
});

test('start() после gameover сбрасывает прогресс, но сохраняет рекорд', () => {
  const e = mk(2);
  const S = e.state;
  e.start();
  step(e, 2.0);
  eq(S.mode, 'play', 'игра идёт');
  S.score = 9000;
  S.lives = 1;
  S.player.invuln = 0;
  putMonster(S, S.player.cx, S.player.cy, 'crawler', { think: 999, spawnT: 1 });
  e.update(1 / 60);
  step(e, 1.7);
  eq(S.mode, 'gameover', 'игра окончена');
  eq(S.hi, 9000, 'рекорд зафиксирован при gameover');
  e.start();
  eq(S.score, 0, 'score сброшен');
  eq(S.lives, 3, 'lives сброшены');
  eq(S.level, 1, 'level сброшен');
  eq(S.mode, 'ready', 'mode ready');
  eq(S.hi, 9000, 'рекорд сохранён после start()');
});

/* ------------------------- v2: музыка и оболочка -------------------------- */
test('v2: трек js/music.js — валидная нотация, 8 тактов, голоса кратны', () => {
  const sb = { window: { Arcade: {} } }; vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), sb);
  const t = sb.window.Arcade.tracks.krot; ok(t && t.bpm > 0, 'нет Arcade.tracks.krot');
  const toks = (s) => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/);
  const mel = toks(t.melody), bass = toks(t.bass), dr = toks(t.drums);
  eq(mel.length, 8 * t.div * 4, 'шагов мелодии (8 тактов)');
  ok(mel.length % bass.length === 0 && mel.length % dr.length === 0, 'голоса не кратны мелодии');
  mel.concat(bass).forEach((x) => ok(x === '-' || x === '.' || /^[A-G][#b]?\d$/.test(x), 'плохой токен ' + x));
  dr.forEach((x) => ok(x === '.' || /^[ksho]+$/.test(x), 'плохой удар ' + x));
});
test('v2: index.html — движок, music.js сразу после engine.js, рекорд мигрирует, legacy.html на месте', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  eq(srcs[0], './engine.js'); eq(srcs[1], './js/music.js');
  ok(fs.existsSync(path.join(ROOT, 'engine.js')) && fs.existsSync(path.join(ROOT, 'legacy.html')), 'нет engine.js/legacy.html');
  ok(/KROT\.migrateStorage\(localStorage\)/.test(html) && /KROT\.STORE_KEYS\.hi/.test(html) && /arcade\.best\.krot/.test(html), 'нет миграции рекорда');
  ok(/gameId:'krot'/.test(html), 'gameId');
});

test('миграция localStorage: digger.* → krot.*, старые удалены, новые не затираются', () => {
  const mk = (init) => { const m = new Map(Object.entries(init)); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const a = mk({ 'digger.settings.v1': '{"lang":"en"}', 'digger.hi.v1': '4242' });
  KROT.migrateStorage(a);
  eq(a.m.get('krot.settings.v1'), '{"lang":"en"}', 'настройки'); eq(a.m.get('krot.hi.v1'), '4242', 'рекорд');
  ok(!a.m.has('digger.settings.v1') && !a.m.has('digger.hi.v1'), 'старые ключи не удалены');
  const b = mk({ 'digger.hi.v1': '4242', 'krot.hi.v1': '5000' });
  KROT.migrateStorage(b);
  eq(b.m.get('krot.hi.v1'), '5000', 'новый рекорд затёрт старым'); ok(!b.m.has('digger.hi.v1'), 'старый не удалён');
  const c = mk({}); KROT.migrateStorage(c); eq(c.m.size, 0, 'пустое хранилище');
  KROT.migrateStorage(null);
});

/* --------------------------------- итог ----------------------------------- */
console.log('');
const total = passed + failed;
if (failed === 0) {
  console.log('OK ' + passed + '/' + total);
  process.exit(0);
} else {
  console.log('FAIL ' + passed + '/' + total);
  for (const f of failures) console.log('  ✗ ' + f.name + ': ' + (f.err && f.err.message));
  process.exit(1);
}
