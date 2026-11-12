/* ============================================================================
   РАЗРЕЗ · движок логики (без DOM, детерминированный при заданном rng)
   Поле — сетка клеток: 0 — свободное поле («море»), 1 — захваченная зона
   («суша»), 2 — след резца. Резец ходит по суше, уходит в море и оставляет
   след; замкнув след на суше, отрезает области, куда не дотягиваются шары.
   Шары летают по морю и отскакивают от суши; клещи ползают по суше.
   Цель уровня — захватить ≥75% поля. Интерфейс — CONTRACT.md.
   ========================================================================== */
(function (global) {
  'use strict';
  var R = global.RAZREZ = global.RAZREZ || {};

  var FREE = 0, LAND = 1, TRAIL = 2;
  var COLS = 78, ROWS = 50, BORDER = 2;
  var MAX_LEVEL = 5, TARGET = 75, MAX_LIVES = 5;   // +1 жизнь за пройденный уровень, не больше 5
  var BALL_R = 0.45;   // полуразмер шара в клетках (AABB)
  var MITE_R = 0.40;   // полуразмер клеща
  var SUB = 0.25;      // макс. смещение врага за подшаг (против «туннелирования»)

  // Линейный рост параметра с потолком — та же формула, что g.difficulty движка.
  function defaultDiff(level, base, step, max) {
    var v = base + (level - 1) * step;
    return max == null ? v : (step >= 0 ? Math.min(v, max) : Math.max(v, max));
  }

  // Параметры уровня: больше и быстрее врагов с ростом уровня.
  function levelParams(level, diff) {
    diff = diff || defaultDiff;
    // «Финальный рывок» 4–5 уровней: late = 0,0,0,1,2 (баланс по боту — README, «Баланс»)
    var late = Math.max(0, Math.round(diff(level, -2, 1)));
    return {
      level: level,
      sea: Math.round(diff(level, 2, 1, 6)) + late,        // шары: 2,3,4,6,8
      seaSpeed: diff(level, 7, 1, 11) + late * 0.75,       // клеток/с: 7,8,9,10.75,12.5 (резец — 15)
      land: Math.round(diff(level, 0, 0.75, 3)) + Math.min(1, late), // клещи: 0,1,2,3,4
      landSpeed: diff(level, 4.5, 0.75, 7.5) + late * 0.75, // 4.5,5.25,6,7.5,9
      playerSpeed: 15                               // клеток/с
    };
  }

  // Заливка: всё свободное, куда не дотягиваются враги (seeds), становится сушей.
  // Возвращает { count, mask } — сколько клеток захвачено и маску новых клеток.
  function floodCapture(grid, cols, rows, seeds) {
    var n = cols * rows, seen = new Uint8Array(n), stack = [];
    for (var s = 0; s < seeds.length; s++) {
      var sx = seeds[s].x, sy = seeds[s].y;
      if (sx < 0 || sy < 0 || sx >= cols || sy >= rows) continue;
      var si = sy * cols + sx;
      if (grid[si] === FREE && !seen[si]) { seen[si] = 1; stack.push(si); }
    }
    while (stack.length) {
      var i = stack.pop(), x = i % cols, y = (i / cols) | 0, j;
      if (x > 0 && grid[j = i - 1] === FREE && !seen[j]) { seen[j] = 1; stack.push(j); }
      if (x < cols - 1 && grid[j = i + 1] === FREE && !seen[j]) { seen[j] = 1; stack.push(j); }
      if (y > 0 && grid[j = i - cols] === FREE && !seen[j]) { seen[j] = 1; stack.push(j); }
      if (y < rows - 1 && grid[j = i + cols] === FREE && !seen[j]) { seen[j] = 1; stack.push(j); }
    }
    var mask = new Uint8Array(n), count = 0;
    for (var k = 0; k < n; k++) if (grid[k] === FREE && !seen[k]) { grid[k] = LAND; mask[k] = 1; count++; }
    return { count: count, mask: mask };
  }

  // Процент захвата внутренней части поля (рамка не считается).
  function percent(grid, cols, rows, border) {
    border = border == null ? BORDER : border;
    var land = 0, total = 0;
    for (var y = border; y < rows - border; y++)
      for (var x = border; x < cols - border; x++) { total++; if (grid[y * cols + x] === LAND) land++; }
    return total ? land * 100 / total : 0;
  }

  // Клетки, которые перекрывает квадрат врага с центром (x,y) и полуразмером r.
  function cellsOf(x, y, r, cb) {
    var x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.floor(y - r), y1 = Math.floor(y + r);
    for (var cy = y0; cy <= y1; cy++) for (var cx = x0; cx <= x1; cx++) if (cb(cx, cy)) return true;
    return false;
  }

  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var cols = opts.cols || COLS, rows = opts.rows || ROWS;
    var emit = opts.onEvent || function () {};
    var S = {
      cols: cols, rows: rows, border: BORDER, grid: new Uint8Array(cols * rows),
      level: opts.level || 1, maxLevel: opts.maxLevel || MAX_LEVEL, target: opts.target || TARGET,
      lives: opts.lives == null ? 3 : opts.lives, score: 0, pct: 0,
      player: { x: 0, y: 0, dx: 0, dy: 0, trailing: false, sx: 0, sy: 0 },
      trail: [], sea: [], land: [], params: null,
      phase: 'ready', phaseT: 0, inv: 0, acc: 0, want: { x: 0, y: 0 },
      ver: 0, flash: null, flashT: 0, clearBonus: 0, over: false, won: false, time: 0
    };

    function idx(x, y) { return y * cols + x; }
    function cell(x, y) { return (x < 0 || y < 0 || x >= cols || y >= rows) ? -1 : S.grid[idx(x, y)]; }
    function seaSolid(x, y) { var c = cell(x, y); return c === LAND || c === -1; }
    function landSolid(x, y) { return cell(x, y) !== LAND; }
    function rnd(a, b) { return a + Math.floor(rng() * (b - a + 1)); }
    function diag(speed) {
      var k = speed / Math.SQRT2;
      return { vx: rng() < 0.5 ? -k : k, vy: rng() < 0.5 ? -k : k };
    }

    function buildLevel() {
      // opts.difficulty(level, base, step, max) — в игре это обёртка над g.difficulty
      var p = S.params = levelParams(S.level, opts.difficulty || null);
      var G = S.grid;
      for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++)
        G[idx(x, y)] = (x < BORDER || y < BORDER || x >= cols - BORDER || y >= rows - BORDER) ? LAND : FREE;
      S.player = { x: cols >> 1, y: 0, dx: 0, dy: 0, trailing: false, sx: cols >> 1, sy: 0 };
      S.trail = []; S.sea = []; S.land = [];
      // шары — в море, подальше от резца (верхняя кромка)
      for (var i = 0; i < p.sea; i++) {
        var bx = rnd(BORDER + 2, cols - BORDER - 3), by = rnd(Math.min(14, rows - BORDER - 3), rows - BORDER - 3);
        var v = diag(p.seaSpeed);
        S.sea.push({ x: bx + 0.5, y: by + 0.5, vx: v.vx, vy: v.vy });
      }
      // клещи — на нижней кромке, расставлены по ширине
      for (var j = 0; j < p.land; j++) {
        var mx = Math.floor((j + 1) * cols / (p.land + 1)) + 0.5;
        var w = diag(p.landSpeed);
        S.land.push({ x: mx, y: rows - 1, vx: w.vx, vy: w.vy });
      }
      S.pct = 0; S.phase = 'ready'; S.phaseT = 1.3; S.acc = 0; S.inv = 0;
      S.flash = null; S.flashT = 0; S.ver++;
    }

    function die(reason) {
      if (S.phase !== 'play') return;
      for (var i = 0; i < S.trail.length; i++) S.grid[S.trail[i]] = FREE;
      S.trail = [];
      S.lives--; S.phase = 'dead'; S.phaseT = 1.1; S.ver++;
      emit('death', { lives: S.lives, x: S.player.x, y: S.player.y, reason: reason || 'hit' });
    }

    function respawn() {
      var P = S.player;
      if (P.trailing) { P.x = P.sx; P.y = P.sy; }
      P.trailing = false; P.dx = 0; P.dy = 0;
      S.inv = 1.5; S.acc = 0; S.phase = 'play';
    }

    // Замыкание следа: след → суша, затем заливка от шаров.
    function close() {
      var P = S.player, n = S.trail.length, G = S.grid, i;
      var mask0 = S.trail.slice();
      for (i = 0; i < n; i++) G[S.trail[i]] = LAND;
      S.trail = []; P.trailing = false;
      var seeds = [];
      for (i = 0; i < S.sea.length; i++) {
        var b = S.sea[i];
        cellsOf(b.x, b.y, BALL_R, function (cx, cy) { seeds.push({ x: cx, y: cy }); return false; });
      }
      var r = floodCapture(G, cols, rows, seeds);
      for (i = 0; i < mask0.length; i++) r.mask[mask0[i]] = 1;
      var total = n + r.count;
      S.flash = r.mask; S.flashT = 0.6; S.ver++;
      S.pct = percent(G, cols, rows, BORDER);
      var gain = total * S.level + (r.count >= 300 ? Math.floor(r.count / 2) * S.level : 0);
      S.score += gain;
      emit('capture', { count: total, pct: S.pct, gain: gain });
      if (S.pct >= S.target) {
        var bonus = 1000 * S.level + Math.floor(S.pct - S.target) * 200 + S.lives * 250;
        S.score += bonus; S.clearBonus = bonus;
        S.phase = 'clear'; S.phaseT = 2.2;
        emit('clear', { level: S.level, pct: S.pct, bonus: bonus });
      }
    }

    function stepPlayer() {
      var P = S.player, nx = P.x + P.dx, ny = P.y + P.dy;
      if (!P.dx && !P.dy) return;
      var c = cell(nx, ny);
      if (c === -1) { if (!P.trailing) { P.dx = 0; P.dy = 0; } return; }
      if (c === TRAIL) { die('self'); return; }
      if (c === FREE) {
        if (!P.trailing) { P.trailing = true; P.sx = P.x; P.sy = P.y; S.trail = []; }
        S.grid[idx(nx, ny)] = TRAIL; S.trail.push(idx(nx, ny));
        P.x = nx; P.y = ny; emit('step', { n: S.trail.length });
        return;
      }
      P.x = nx; P.y = ny;
      if (P.trailing) close();
    }

    function movePlayer(dt) {
      var P = S.player, w = S.want, step = 1 / S.params.playerSpeed;
      if (w.x || w.y) {
        var reverse = P.trailing && w.x === -P.dx && w.y === -P.dy;
        if (!reverse) { P.dx = w.x; P.dy = w.y; }
      } else if (!P.trailing) { S.acc = step; return; }   // на суше без клавиши — стоим
      S.acc += dt;
      while (S.acc >= step && S.phase === 'play') { S.acc -= step; stepPlayer(); }
    }

    // Отражение от сетки: проверка AABB по каждой оси отдельно.
    function bounce(e, dt, r, solid) {
      var nx = e.x + e.vx * dt;
      if (cellsOf(nx, e.y, r, solid)) e.vx = -e.vx; else e.x = nx;
      var ny = e.y + e.vy * dt;
      if (cellsOf(e.x, ny, r, solid)) e.vy = -e.vy; else e.y = ny;
    }

    function overlapPlayer(e, r, shrink) {
      var P = S.player;
      return Math.abs(e.x - (P.x + 0.5)) < r + 0.5 - shrink && Math.abs(e.y - (P.y + 0.5)) < r + 0.5 - shrink;
    }

    function moveEnemies(dt) {
      var maxV = Math.max(S.params.seaSpeed, S.params.landSpeed);
      var n = Math.max(1, Math.ceil(maxV * dt / SUB)), h = dt / n, i, e;
      var isTrail = function (cx, cy) { return cell(cx, cy) === TRAIL; };
      for (var k = 0; k < n && S.phase === 'play'; k++) {
        for (i = 0; i < S.sea.length; i++) {
          e = S.sea[i]; bounce(e, h, BALL_R, seaSolid);
          if (cellsOf(e.x, e.y, BALL_R, isTrail) || (S.player.trailing && overlapPlayer(e, BALL_R, 0.1))) { die('ball'); return; }
        }
        for (i = 0; i < S.land.length; i++) {
          e = S.land[i]; bounce(e, h, MITE_R, landSolid);
          if (S.inv <= 0 && overlapPlayer(e, MITE_R, 0.15)) { die('mite'); return; }
        }
      }
    }

    var api = {
      COLS: cols, ROWS: rows, FREE: FREE, LAND: LAND, TRAIL: TRAIL,
      start: function () { buildLevel(); return api; },
      state: function () { return S; },
      // Направление от ввода: (0,0) — клавиши отпущены. Диагонали не бывает.
      setDir: function (dx, dy) { S.want.x = dx ? (dx > 0 ? 1 : -1) : 0; S.want.y = dx ? 0 : (dy ? (dy > 0 ? 1 : -1) : 0); },
      update: function (dt) {
        if (S.over) return;
        S.time += dt;
        if (S.flashT > 0) S.flashT -= dt;
        if (S.inv > 0) S.inv -= dt;
        if (S.phase === 'ready') { S.phaseT -= dt; if (S.phaseT <= 0) { S.phase = 'play'; emit('go', { level: S.level }); } return; }
        if (S.phase === 'dead') {
          S.phaseT -= dt;
          if (S.phaseT <= 0) { if (S.lives <= 0) { S.over = true; emit('gameover', { score: S.score }); } else respawn(); }
          return;
        }
        if (S.phase === 'clear') {
          S.phaseT -= dt;
          if (S.phaseT <= 0) {
            if (S.level >= S.maxLevel) { S.over = true; S.won = true; emit('win', { score: S.score }); }
            else { S.level++; if (S.lives < MAX_LIVES) S.lives++; buildLevel(); emit('level', { level: S.level, lives: S.lives }); }
          }
          return;
        }
        movePlayer(dt);
        if (S.phase === 'play') moveEnemies(dt);
      },
      // служебное — для тестов
      _S: S, _close: close, _die: die, _build: buildLevel
    };
    return api;
  }

  R.Game = Game;
  R.logic = { floodCapture: floodCapture, percent: percent, levelParams: levelParams, cellsOf: cellsOf,
    FREE: FREE, LAND: LAND, TRAIL: TRAIL, COLS: COLS, ROWS: ROWS, BORDER: BORDER, MAX_LEVEL: MAX_LEVEL, TARGET: TARGET };
})(typeof window !== 'undefined' ? window : globalThis);
