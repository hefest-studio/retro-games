/* PAC-MAN · «Лабиринт» — движок (DOM-free). PM.Game / PM.consts / PM.validate
   Чистая логика: лабиринт, точки, Пакман, 4 призрака с классическим ИИ (scatter/chase/fright).
   Запускается и в браузере, и в node (node:vm с шимом window) — без DOM и внешних зависимостей. */
(function (global) {
  'use strict';
  var PM = global.PM = global.PM || {};

  // ----- Лабиринт: левая половина 14×31, зеркалится в полную карту 28×31 -----
  // '#'=стена  '.'=точка  'o'=энергетик  '-'=проходимо без точки  '='=ворота дома  ' '=пустота(непроходима)
  var LEFT = [
    '##############',
    '#............#',
    '#.####.#####.#',
    '#o####.#####.#',
    '#.####.#####.#',
    '#.............',
    '#.####.##.####',
    '#.####.##.####',
    '#......##....-',
    '######.#####.-',
    '     #.#####.-',
    '     #.#####.-',
    '     #.## ###=',
    '######.## #---',
    '------.---#---',
    '######.## #---',
    '     #.## ####',
    '     #.##-----',
    '     #.#####.#',
    '######.#####.#',
    '#............#',
    '#.####.#####.#',
    '#.####.#####.#',
    '#o..##.......-',
    '###.##.##.####',
    '###.##.##.####',
    '#......##....#',
    '#.##########.#',
    '#.##########.#',
    '#.............',
    '##############'
  ];

  function buildMaze() {
    var rows = [];
    for (var i = 0; i < LEFT.length; i++) {
      var l = LEFT[i];
      while (l.length < 14) l += ' ';
      l = l.slice(0, 14);
      rows.push((l + l.split('').reverse().join('')).split(''));
    }
    return rows;
  }

  var ROWS = 31, COLS = 28;
  var DIRS = { up: { x: 0, y: -1 }, left: { x: -1, y: 0 }, down: { x: 0, y: 1 }, right: { x: 1, y: 0 } };
  var ORDER = ['up', 'left', 'down', 'right'];            // приоритет при равной дистанции
  var OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  var TUNNEL_ROW = 14;

  function isWall(ch) { return ch === '#' || ch === ' '; }
  function isDot(ch) { return ch === '.' || ch === 'o'; }

  // Проходимо ли из клетки (cx,cy) в сторону dir. Пакман не ходит сквозь ворота '='.
  function canGo(maze, cx, cy, dir, ghost) {
    var tx = cx + DIRS[dir].x, ty = cy + DIRS[dir].y;
    if (ty === TUNNEL_ROW && (tx < 0 || tx >= COLS)) return true; // туннель
    if (ty < 0 || ty >= ROWS || tx < 0 || tx >= COLS) return false;
    var ch = maze[ty][tx];
    if (isWall(ch)) return false;
    if (ch === '=') return !!ghost;         // ворота — только призракам
    return true;
  }

  // ----- RNG -----
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  var consts = {
    ROWS: ROWS, COLS: COLS, TUNNEL_ROW: TUNNEL_ROW,
    GHOSTS: ['blinky', 'pinky', 'inky', 'clyde'],
    COLORS: { blinky: '#ff2a2a', pinky: '#ff9ed6', inky: '#36d6ff', clyde: '#ffb347' },
    // стартовые клетки (в «шахте»/доме), целевые углы для режима scatter
    START: { blinky: [13, 11], pinky: [14, 11], inky: [13, 13], clyde: [14, 13] },
    SCATTER: { blinky: [26, 1], pinky: [1, 1], inky: [26, 29], clyde: [1, 29] },
    HOME: [13, 13], HOME_DOOR: [13, 11],
    // расписание scatter/chase (сек); последний chase — бесконечный
    PHASES: [['scatter', 7], ['chase', 20], ['scatter', 7], ['chase', 20], ['scatter', 5], ['chase', 20], ['scatter', 5], ['chase', 1e9]]
  };
  PM.consts = consts;

  // ----- Проверка карты (для тестов и разработки) -----
  PM.validate = function () {
    var maze = buildMaze(), problems = [];
    for (var y = 0; y < maze.length; y++) if (maze[y].length !== COLS) problems.push('строка ' + y + ' ширина ' + maze[y].length);
    // flood fill из старта Пакмана (13,23)
    var seen = {}, stack = [[13, 23]], dots = 0, reachDots = 0;
    for (var yy = 0; yy < ROWS; yy++) for (var xx = 0; xx < COLS; xx++) if (isDot(maze[yy][xx])) dots++;
    function key(x, y) { return x + ',' + y; }
    while (stack.length) {
      var p = stack.pop(), x = p[0], y = p[1];
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
      if (seen[key(x, y)]) continue;
      var ch = maze[y][x];
      if (isWall(ch) || ch === '=') continue;
      seen[key(x, y)] = 1;
      if (isDot(ch)) reachDots++;
      ['up', 'left', 'down', 'right'].forEach(function (d) {
        var tx = x + DIRS[d].x, ty = y + DIRS[d].y;
        if (ty === TUNNEL_ROW && tx < 0) tx = COLS - 1;
        if (ty === TUNNEL_ROW && tx >= COLS) tx = 0;
        stack.push([tx, ty]);
      });
    }
    if (reachDots !== dots) problems.push('достижимо точек ' + reachDots + ' из ' + dots);
    return { ok: problems.length === 0, dots: dots, reachDots: reachDots, problems: problems };
  };

  // ----- Игра -----
  PM.Game = function (opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var onEvent = opts.onEvent || function () {};
    var S = {
      maze: null, ROWS: ROWS, COLS: COLS,
      mode: 'title', level: 1, score: 0, hi: opts.hi || 0, lives: 3,
      dotsTotal: 0, dotsLeft: 0,
      pac: null, ghosts: [], chain: 0,
      fright: false, frightT: 0,
      phaseIdx: 0, phaseT: 0, globalMode: 'scatter',
      time: 0, anim: 0, ready: 0, flash: 0
    };

    function emit(t, d) { try { onEvent(t, d); } catch (e) {} }

    function loadLevel() {
      S.maze = buildMaze();
      var dots = 0;
      for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) if (isDot(S.maze[y][x])) dots++;
      S.dotsTotal = dots; S.dotsLeft = dots;
      S.pac = { x: 13.5, y: 23, dir: 'left', next: 'left', mouth: 0, alive: true };
      S.ghosts = consts.GHOSTS.map(function (n) {
        var s = consts.START[n];
        return { name: n, x: s[0], y: s[1], dir: 'up', mode: 'house', eaten: false, home: s };
      });
      S.phaseIdx = 0; S.phaseT = 0; S.globalMode = 'scatter';
      S.fright = false; S.frightT = 0; S.chain = 0;
    }

    function resetActors() {
      S.pac.x = 13.5; S.pac.y = 23; S.pac.dir = 'left'; S.pac.next = 'left'; S.pac.alive = true;
      S.ghosts.forEach(function (g) { g.x = g.home[0]; g.y = g.home[1]; g.dir = 'up'; g.mode = 'house'; g.eaten = false; });
      S.fright = false; S.frightT = 0; S.phaseIdx = 0; S.phaseT = 0; S.globalMode = 'scatter';
    }

    // ---- движение одного актёра на расстояние dist (сетка, со снапом в центрах) ----
    function moveActor(e, dist, decide, ghost) {
      var guard = 0;
      while (dist > 1e-9 && guard++ < 80) {
        var cx = Math.round(e.x), cy = Math.round(e.y);
        var atCenter = Math.abs(e.x - cx) < 1e-6 && Math.abs(e.y - cy) < 1e-6;
        if (atCenter) {
          e.x = cx; e.y = cy;
          if (cy === TUNNEL_ROW) { if (cx <= 0) { e.x = cx = COLS - 1; } else if (cx >= COLS - 1) { e.x = cx = 0; } }
          decide(e, cx, cy);
          if (!canGo(S.maze, cx, cy, e.dir, ghost)) return;
        }
        var dx = DIRS[e.dir].x, dy = DIRS[e.dir].y, tx, ty;
        if (atCenter) { tx = cx + dx; ty = cy + dy; }       // следующий центр в сторону движения
        else {                                              // середина клетки — целимся в ближайший центр по ходу
          tx = cx; ty = cy;
          if (dx < 0) tx = Math.floor(e.x); else if (dx > 0) tx = Math.ceil(e.x);
          if (dy < 0) ty = Math.floor(e.y); else if (dy > 0) ty = Math.ceil(e.y);
        }
        var toTarget = Math.abs(tx - e.x) + Math.abs(ty - e.y);
        if (toTarget < 1e-9) { if (!atCenter) { e.x = tx; e.y = ty; continue; } break; }
        var mv = Math.min(dist, toTarget);
        e.x += dx * mv; e.y += dy * mv; dist -= mv;
        if (Math.abs(e.x - tx) < 1e-6 && Math.abs(e.y - ty) < 1e-6) { e.x = tx; e.y = ty; } // дошли до центра — цикл переспросит направление
        else break;                                         // кончилось расстояние посреди клетки
      }
    }

    function decidePac(e, cx, cy) {
      if (e.next !== e.dir && canGo(S.maze, cx, cy, e.next, false)) { e.dir = e.next; emit('turn'); }
      else if (!canGo(S.maze, cx, cy, e.dir, false)) { /* стена — стоим */ }
    }

    function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

    function ghostTarget(g) {
      var p = S.pac, pcx = Math.round(p.x), pcy = Math.round(p.y);
      if (g.mode === 'eyes') return consts.HOME_DOOR;
      if (g.mode === 'fright') return null;
      if (S.globalMode === 'scatter') return consts.SCATTER[g.name];
      // chase
      if (g.name === 'blinky') return [pcx, pcy];
      if (g.name === 'pinky') return [pcx + DIRS[p.dir].x * 4, pcy + DIRS[p.dir].y * 4];
      if (g.name === 'clyde') return (dist2(g.x, g.y, pcx, pcy) > 64) ? [pcx, pcy] : consts.SCATTER.clyde;
      // inky: вектор от Блинки к точке в 2 клетки перед Пакманом, удвоенный
      var b = S.ghosts[0], ax = pcx + DIRS[p.dir].x * 2, ay = pcy + DIRS[p.dir].y * 2;
      return [ax + (ax - b.x), ay + (ay - b.y)];
    }

    function decideGhost(g, cx, cy) {
      // дом: подняться к воротам и выйти
      if (g.mode === 'house') {
        if (cy > 11) { g.dir = 'up'; if (!canGo(S.maze, cx, cy, 'up', true)) g.dir = (cx < 14 ? 'right' : 'left'); return; }
        g.mode = S.globalMode; // вышли
      }
      if (g.mode === 'eyes' && cx === consts.HOME[0] && cy >= consts.HOME[1]) { revive(g); return; }

      var opts2 = ORDER.filter(function (d) {
        if (d === OPP[g.dir]) return false;                 // нельзя разворот
        return canGo(S.maze, cx, cy, d, true);
      });
      if (!opts2.length) { opts2 = [OPP[g.dir]]; }           // тупик — только назад
      if (g.mode === 'fright') { g.dir = opts2[Math.floor(rng() * opts2.length)]; return; }
      var tgt = ghostTarget(g), best = opts2[0], bestD = Infinity;
      for (var i = 0; i < opts2.length; i++) {
        var d = opts2[i], nx = cx + DIRS[d].x, ny = cy + DIRS[d].y, dd = dist2(nx, ny, tgt[0], tgt[1]);
        if (dd < bestD) { bestD = dd; best = d; }
      }
      g.dir = best;
    }

    function revive(g) { g.mode = S.globalMode; g.eaten = false; g.x = consts.HOME[0]; g.y = consts.HOME[1]; g.dir = 'up'; }

    function speedPac() { return 5.4 + (S.level - 1) * 0.15; }
    function speedGhost(g) {
      if (g.mode === 'eyes') return 9.5;
      if (g.mode === 'fright') return 3.3;
      var base = 5.1 + (S.level - 1) * 0.12;
      var cy = Math.round(g.y);
      if (cy === TUNNEL_ROW) base *= 0.5;                    // в туннеле призраки медленнее
      return base;
    }

    function eatAt(cx, cy) {
      var ch = S.maze[cy][cx];
      if (ch === '.') { S.maze[cy][cx] = '-'; S.score += 10; S.dotsLeft--; emit('chomp'); }
      else if (ch === 'o') {
        S.maze[cy][cx] = '-'; S.score += 50; S.dotsLeft--; S.chain = 0;
        S.fright = true; S.frightT = Math.max(2, 7 - (S.level - 1) * 0.5);
        S.ghosts.forEach(function (g) { if (g.mode !== 'eyes' && g.mode !== 'house') { g.mode = 'fright'; g.dir = OPP[g.dir]; } });
        emit('power');
      }
      if (S.dotsLeft <= 0) winLevel();
    }

    function winLevel() { S.mode = 'win'; S.flash = 1.6; emit('win'); }

    function loseLife() {
      S.pac.alive = false; S.mode = 'dying'; S.ready = 1.4; emit('death');
    }

    function collide() {
      var p = S.pac, pcx = Math.round(p.x), pcy = Math.round(p.y);
      for (var i = 0; i < S.ghosts.length; i++) {
        var g = S.ghosts[i];
        if (Math.round(g.x) === pcx && Math.round(g.y) === pcy) {
          if (g.mode === 'fright') {
            S.chain++; var pts = 200 * Math.pow(2, Math.min(S.chain - 1, 3));
            S.score += pts; g.mode = 'eyes'; emit('eatghost', { pts: pts });
          } else if (g.mode !== 'eyes') {
            if (S.lives > 0) { S.lives--; loseLife(); } else { S.mode = 'gameover'; S.pac.alive = false; emit('gameover', { score: S.score }); }
            return;
          }
        }
      }
    }

    function updatePhases(dt) {
      if (S.fright) return;                                  // при испуге общий таймер режима стоит
      S.phaseT += dt;
      var ph = consts.PHASES[S.phaseIdx];
      if (S.phaseT >= ph[1]) {
        S.phaseIdx = Math.min(S.phaseIdx + 1, consts.PHASES.length - 1); S.phaseT = 0;
        var nm = consts.PHASES[S.phaseIdx][0];
        if (nm !== S.globalMode) { S.globalMode = nm; S.ghosts.forEach(function (g) { if (g.mode === 'scatter' || g.mode === 'chase') { g.mode = nm; g.dir = OPP[g.dir]; } }); }
      }
    }

    function step(dt) {
      if (dt > 0.1) dt = 0.1;
      S.time += dt;
      if (S.mode === 'ready') { S.ready -= dt; if (S.ready <= 0) S.mode = 'play'; return; }
      if (S.mode === 'dying') { S.ready -= dt; S.pac.mouth += dt * 6; if (S.ready <= 0) { resetActors(); S.mode = 'ready'; S.ready = 1.0; } return; }
      if (S.mode === 'win') { S.flash -= dt; if (S.flash <= 0) { S.level++; loadLevel(); S.mode = 'ready'; S.ready = 1.2; } return; }
      if (S.mode !== 'play') return;

      S.anim += dt;
      S.pac.mouth += dt * 10;
      // Пакман
      moveActor(S.pac, speedPac() * dt, decidePac, false);
      eatAt(Math.round(S.pac.x), Math.round(S.pac.y));
      collide();
      if (S.mode !== 'play') return;
      // призраки
      for (var i = 0; i < S.ghosts.length; i++) {
        var g = S.ghosts[i];
        moveActor(g, speedGhost(g) * dt, decideGhost, true);
      }
      collide();
      // таймеры режимов
      if (S.fright) { S.frightT -= dt; if (S.frightT <= 0) { S.fright = false; S.ghosts.forEach(function (gg) { if (gg.mode === 'fright') gg.mode = S.globalMode; }); } }
      updatePhases(dt);
    }

    loadLevel();

    return {
      COLS: COLS, ROWS: ROWS, consts: consts,
      start: function () { loadLevel(); S.mode = 'ready'; S.ready = 1.2; S.score = 0; S.lives = 3; S.level = 1; },
      reset: function () { loadLevel(); S.mode = 'title'; },
      step: step,
      state: function () { return S; },
      pause: function () { if (S.mode === 'play') S._paused = true, S.mode = 'paused'; else if (S.mode === 'paused') { S.mode = 'play'; S._paused = false; } },
      isPaused: function () { return S.mode === 'paused'; },
      setDir: function (d) { if (DIRS[d]) S.pac.next = d; },
      // тест-хуки
      _S: S, _canGo: function (x, y, d, g) { return canGo(S.maze, x, y, d, g); }, _eatAt: eatAt, _ghostTarget: ghostTarget, _step: step
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
