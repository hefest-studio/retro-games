/* ==========================================================================
   СТАРАТЕЛЬ · Обвал в шахте — логика игры (без DOM и без своего цикла).
   Перенесена 1:1 из инлайн-скрипта прежней страницы (теперь legacy.html):
   поле 15×15, порода/стены/валуны/золото/кристаллы, гравитация с перекатом,
   големы, норма золота → выход, 3 жизни. Константы, вероятности и шаги физики
   (165 мс, враги — каждый 2-й шаг) не менялись. Звук и HUD — через события
   onEvent(type, data); оболочка v2 (index.html) превращает их в SFX движка.
   API: STARATEL.Game({onEvent, random}) → {state, start, update(dtMs), move(dx,dy)}.
   ========================================================================== */
(function (global) {
  'use strict';
  var N = 15, TS = 32;
  var WALL = 1, DIRT = 0, EMPTY = 2, BOULDER = 3, GOLD = 4, GEM = 5, EXIT = 6;
  var STEP = 165; // фиксированный шаг физики, мс — реальное время

  function Game(opts) {
    opts = opts || {};
    var rnd = typeof opts.random === 'function' ? opts.random : Math.random;
    var emit = function (type, data) { if (typeof opts.onEvent === 'function') { try { opts.onEvent(type, data || {}); } catch (e) { if (global.console) console.error(e); } } };

    var S = {
      N: N, TS: TS, grid: null, fall: null, player: null, enemies: [],
      score: 0, lives: 3, level: 1, running: false, inv: 0,
      need: 0, got: 0, exitPos: null, shake: 0, flash: 0,
      over: false, phys: 0, acc: 0, pendingLevel: 0, time: 0
    };

    function entityAt(gx, gy) {
      if (S.player.gx === gx && S.player.gy === gy) return 'player';
      if (S.enemies.some(function (e) { return e.gx === gx && e.gy === gy; })) return 'enemy';
      return null;
    }

    function genLevel() {
      var grid = [], fall = [], y, xx, t;
      for (y = 0; y < N; y++) {
        grid.push([]); fall.push([]);
        for (xx = 0; xx < N; xx++) {
          fall[y].push(false);
          t = (xx === 0 || y === 0 || xx === N - 1 || y === N - 1) ? WALL : DIRT;
          if (t === DIRT) {
            var r = rnd();
            if (r < 0.07) t = WALL; else if (r < 0.21) t = BOULDER; else if (r < 0.32) t = GOLD; else if (r < 0.355) t = GEM;
          }
          grid[y].push(t);
        }
      }
      S.grid = grid; S.fall = fall;
      S.player = { gx: 1, gy: 1, bob: 0 };
      // безопасный карман у старта: ничего не падает на спавн
      for (var dy = 0; dy < 3; dy++) for (var dx = 0; dx < 3; dx++) {
        var gx = 1 + dx, gy = 1 + dy;
        if (gx < N - 1 && gy < N - 1 && grid[gy][gx] !== WALL) grid[gy][gx] = DIRT;
      }
      grid[1][1] = EMPTY;
      // выход — подальше от старта, в породе
      var ex, ey, k = 0;
      do { ex = 2 + Math.floor(rnd() * (N - 4)); ey = 2 + Math.floor(rnd() * (N - 4)); k++; }
      while (k < 300 && (grid[ey][ex] === WALL || (ex - 1) + (ey - 1) < 12));
      S.exitPos = { gx: ex, gy: ey }; grid[ey][ex] = EXIT;
      // враги
      S.enemies = []; var ne = Math.min(1 + S.level, 5);
      for (var i = 0; i < ne; i++) {
        var egx, egy, kk = 0;
        do { egx = 2 + Math.floor(rnd() * (N - 4)); egy = 2 + Math.floor(rnd() * (N - 4)); kk++; }
        while (kk < 400 && (grid[egy][egx] === WALL || grid[egy][egx] === EXIT || Math.abs(egx - 1) + Math.abs(egy - 1) < 8));
        grid[egy][egx] = EMPTY; S.enemies.push({ gx: egx, gy: egy, slow: 0 });
      }
      // норма золота
      var total = 0;
      for (y = 0; y < N; y++) for (xx = 0; xx < N; xx++) if (grid[y][xx] === GOLD || grid[y][xx] === GEM) total++;
      S.need = Math.max(3, Math.min(14, Math.ceil(total * 0.5))); S.got = 0;
      emit('level', { level: S.level, need: S.need });
    }

    function collect(t) {
      S.score += t === GEM ? 150 : 100; S.got++;
      emit('pickup', { gem: t === GEM });
      if (S.got === S.need) emit('quota', {});
    }

    function move(dx, dy) {
      if (!S.running) return;
      var nx = S.player.gx + dx, ny = S.player.gy + dy, grid = S.grid;
      if (!grid[ny] || grid[ny][nx] === undefined) return;
      var t = grid[ny][nx];
      if (t === WALL) return;
      if (t === BOULDER) {
        if (dy !== 0) return;                       // валун толкаем только вбок
        var bx = nx + dx; if (grid[ny][bx] !== EMPTY || entityAt(bx, ny)) return;
        grid[ny][bx] = BOULDER; S.fall[ny][bx] = false; grid[ny][nx] = EMPTY; emit('push', {});
      } else if (t === EXIT) {
        if (S.got < S.need) return;                 // выход закрыт, пока нет нормы
        emit('exit', {}); S.level++; S.running = false; S.flash = 1;
        S.pendingLevel = 260;                       // как setTimeout(…, 260) в оригинале
        S.player.gx = nx; S.player.gy = ny; return;
      } else if (t === GOLD || t === GEM) {
        grid[ny][nx] = EMPTY; collect(t);
      } else if (t === DIRT) { grid[ny][nx] = EMPTY; }
      S.player.gx = nx; S.player.gy = ny; S.player.bob = 1;
      if (entityAt(nx, ny) === 'enemy') hit();
    }

    function gravity() {
      var grid = S.grid, fall = S.fall;
      // снизу вверх, один шаг за тик → каскад
      for (var y = N - 2; y >= 1; y--) for (var xx = 1; xx < N - 1; xx++) {
        var t = grid[y][xx]; if (t !== BOULDER && t !== GOLD && t !== GEM) continue;
        var below = grid[y + 1][xx], ent = entityAt(xx, y + 1);
        if (below === EMPTY && !ent) { grid[y + 1][xx] = t; fall[y + 1][xx] = true; grid[y][xx] = EMPTY; fall[y][xx] = false; continue; }
        if (below === EMPTY && ent && fall[y][xx]) {
          if (t === BOULDER) {
            if (ent === 'enemy') {
              S.enemies = S.enemies.filter(function (e) { return !(e.gx === xx && e.gy === y + 1); });
              grid[y + 1][xx] = BOULDER; fall[y + 1][xx] = true; grid[y][xx] = EMPTY; fall[y][xx] = false;
              S.score += 250; emit('crush', {}); S.shake = 6; continue;
            }
            if (ent === 'player') { fall[y][xx] = false; hit(); S.shake = 6; continue; }
          } else { // золото/кристалл безвредны
            if (ent === 'player') { // подбираем на лету
              grid[y][xx] = EMPTY; fall[y][xx] = false; collect(t); continue;
            }
            fall[y][xx] = false; continue; // на враге просто лежит
          }
        }
        // перекат с округлого (валун/стена) вбок
        if (below === BOULDER || below === WALL) {
          if (grid[y][xx - 1] === EMPTY && grid[y + 1][xx - 1] === EMPTY && !entityAt(xx - 1, y) && !entityAt(xx - 1, y + 1)) {
            grid[y][xx - 1] = t; fall[y][xx - 1] = true; grid[y][xx] = EMPTY; fall[y][xx] = false; continue;
          }
          if (grid[y][xx + 1] === EMPTY && grid[y + 1][xx + 1] === EMPTY && !entityAt(xx + 1, y) && !entityAt(xx + 1, y + 1)) {
            grid[y][xx + 1] = t; fall[y][xx + 1] = true; grid[y][xx] = EMPTY; fall[y][xx] = false; continue;
          }
        }
        fall[y][xx] = false;
      }
    }

    function enemyStep() {
      var grid = S.grid, p = S.player;
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i];
        var opts2 = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(function (d) {
          var nx = e.gx + d[0], ny = e.gy + d[1];
          return (grid[ny] && grid[ny][nx] === EMPTY) || (nx === p.gx && ny === p.gy);
        });
        if (!opts2.length) continue;
        opts2.sort(function (a, b) {
          return (Math.abs(e.gx + a[0] - p.gx) + Math.abs(e.gy + a[1] - p.gy)) - (Math.abs(e.gx + b[0] - p.gx) + Math.abs(e.gy + b[1] - p.gy));
        });
        var pick = rnd() < 0.72 ? opts2[0] : opts2[Math.floor(rnd() * opts2.length)];
        e.gx += pick[0]; e.gy += pick[1];
        if (e.gx === p.gx && e.gy === p.gy) hit();
      }
    }

    function hit() {
      if (S.inv > 0 || !S.running) return;
      S.lives--; emit('hit', {}); S.inv = 900; S.shake = 8;
      if (S.lives <= 0) { S.running = false; S.over = true; emit('gameover', { score: S.score, level: S.level }); return; }
      S.player.gx = 1; S.player.gy = 1; S.grid[1][1] = EMPTY;
      for (var dy = 0; dy < 3; dy++) for (var dx = 0; dx < 3; dx++) {
        var gx = 1 + dx, gy = 1 + dy;
        if (S.grid[gy] && S.grid[gy][gx] === BOULDER) S.grid[gy][gx] = DIRT;
      }
      S.enemies.forEach(function (e) { if (Math.abs(e.gx - 1) + Math.abs(e.gy - 1) < 6) { e.gx = N - 2; e.gy = N - 2; } });
    }

    function start() {
      S.score = 0; S.lives = 3; S.level = 1; S.inv = 0; S.over = false;
      S.acc = 0; S.phys = 0; S.pendingLevel = 0; S.shake = 0; S.flash = 0;
      genLevel(); S.running = true;
    }

    // dt — миллисекунды кадра. Тряска/вспышка в оригинале гасли «за кадр» (0.6 и 0.06 при ~60 к/с) —
    // здесь то же самое, но пересчитано на время кадра; это только визуал.
    function update(dt) {
      if (!(dt >= 0)) dt = 0;
      var f = dt / (1000 / 60);
      S.time += dt;
      if (S.shake > 0) S.shake -= 0.6 * f; if (S.shake < 0) S.shake = 0;
      if (S.flash > 0) S.flash -= 0.06 * f; if (S.flash < 0) S.flash = 0;
      if (S.inv > 0) S.inv -= dt;
      if (S.pendingLevel > 0) {
        S.pendingLevel -= dt;
        if (S.pendingLevel <= 0) { S.pendingLevel = 0; genLevel(); S.running = true; }
      }
      if (S.running) {
        S.acc += dt;
        while (S.acc >= STEP) { S.acc -= STEP; S.phys++; gravity(); if (S.phys % 2 === 0) enemyStep(); }
      } else S.acc = 0;
    }

    return { state: S, start: start, update: update, move: move, _gravity: gravity, _enemyStep: enemyStep, _genLevel: genLevel };
  }

  global.STARATEL = global.STARATEL || {};
  global.STARATEL.Game = Game;
  global.STARATEL.T = { N: N, TS: TS, WALL: WALL, DIRT: DIRT, EMPTY: EMPTY, BOULDER: BOULDER, GOLD: GOLD, GEM: GEM, EXIT: EXIT, STEP: STEP };
})(typeof window !== 'undefined' ? window : globalThis);
