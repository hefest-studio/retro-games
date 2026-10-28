/* ==========================================================================
   LODE RUNNER · Погружение — игровая логика
   Сетка 28×16, движение по клеткам с плавной интерполяцией.
   Классическая механика: золото, лестницы, канаты, кирпич, ямы-ловушки, враги.
   ========================================================================== */
(function () {
  'use strict';

  var COLS = 28;
  var ROWS = 16;

  var WALK_MS = 105;      // шаг по горизонтали
  var CLIMB_MS = 125;     // шаг по лестнице
  var FALL_MS = 82;       // клетка падения
  var DIG_WINDUP = 150;   // замах перед рытьём
  var DIG_TOTAL = 300;    // полная анимация копания
  var HOLE_TIME = 4.6;    // сколько яма остаётся открытой
  var RESPAWN_TIME = 3.6; // возрождение врага
  var ESCAPE_TIME = 0.4;  // сколько сидим в яме, прежде чем можно выпрыгнуть
  var FREEZE_TIME = 0.7;  // пауза на старте уровня

  var DIRS = {
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 },
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 }
  };

  function key(x, y) { return x + ',' + y; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function makeEntity(x, y, kind) {
    return {
      kind: kind,
      x: x, y: y,
      px: x, py: y,
      dir: 1,
      move: null,
      state: 'idle',        // idle | walk | climb | fall | hole | dig | spawn | dead
      anim: Math.random() * 10,
      stepPhase: 0,
      hole: null,
      escape: 0,
      spawnTimer: 0,
      deadTimer: 0,
      spawnX: x, spawnY: y,
      digSide: 0,
      digT: 0,
      dug: false,
      wander: 0
    };
  }

  function Game(levels, hooks) {
    this.levels = levels || [];
    this.hooks = hooks || {};
    this.audio = null;

    this.levelIndex = 0;
    this.lives = 3;
    this.score = 0;
    this.levelStartScore = 0;
    this.levelTime = 0;
    this.time = 0;
    this.state = 'idle'; // idle | playing | dying | complete | gameover | victory
    this.freeze = 0;
    this.shake = 0;

    this.input = { left: false, right: false, up: false, down: false };

    this.base = [];
    this.gold = new Set();
    this.totalGold = 0;
    this.exit = { x: 0, y: 0, open: false };
    this.spawn = { x: 1, y: 1 };
    this.enemySpawns = [];

    this.player = makeEntity(1, 1, 'player');
    this.enemies = [];
    this.holes = new Map();
    this.particles = [];
    this.floaters = [];

    this.deathTimer = 0;
    this.deathReason = '';
    this.lastExitHint = 0;
    this.enemyId = 0;

    this._load(0);
    this.state = 'idle';
  }

  /* --------------------------------------------------------------------- */
  /*  Загрузка уровня                                                       */
  /* --------------------------------------------------------------------- */

  Game.prototype._load = function (index) {
    var lvl = this.levels[index];
    if (!lvl) return;
    this.levelIndex = index;
    this.levelTime = 0;
    this.freeze = FREEZE_TIME;
    this.shake = 0;
    this.particles = [];
    this.floaters = [];
    this.holes.clear();
    this.gold.clear();
    this.enemySpawns = [];
    this.enemies = [];
    this.deathTimer = 0;

    var rows = lvl.rows || [];
    this.base = [];
    this.totalGold = 0;
    this.spawn = { x: 1, y: ROWS - 2 };
    this.exit = { x: COLS - 2, y: 1, open: false };

    for (var y = 0; y < ROWS; y++) {
      var line = String(rows[y] || '').padEnd(COLS, '#');
      var row = [];
      for (var x = 0; x < COLS; x++) {
        var ch = line.charAt(x);
        if (ch === '@') { this.spawn = { x: x, y: y }; ch = '.'; }
        else if (ch === 'X') { this.enemySpawns.push({ x: x, y: y }); ch = '.'; }
        else if (ch === '$') { this.gold.add(key(x, y)); this.totalGold++; ch = '.'; }
        else if (ch === 'E') { this.exit = { x: x, y: y, open: false }; ch = '.'; }
        else if (ch !== '#' && ch !== '=' && ch !== 'H' && ch !== '-') { ch = '.'; }
        row.push(ch);
      }
      this.base.push(row);
    }

    this.player = makeEntity(this.spawn.x, this.spawn.y, 'player');
    this.player.dir = 1;
    if (!this.isSupported(this.spawn.x, this.spawn.y)) {
      // страховка: ставим игрока на ближайшую опору ниже
      for (var sy = this.spawn.y; sy < ROWS; sy++) {
        if (this.isSupported(this.spawn.x, sy)) {
          this.player.y = sy; this.player.py = sy;
          this.spawn.y = sy;
          break;
        }
      }
    }

    for (var i = 0; i < this.enemySpawns.length; i++) {
      var sp = this.enemySpawns[i];
      var en = makeEntity(sp.x, sp.y, 'enemy');
      en.id = ++this.enemyId;
      en.spawnTimer = 0.5 + i * 0.12;
      en.state = 'spawn';
      en.dir = i % 2 === 0 ? 1 : -1;
      this.enemies.push(en);
    }

    if (this.hooks.onEvent) this.hooks.onEvent('level', { index: index, level: lvl });
  };

  Game.prototype.startRun = function () {
    this.lives = 3;
    this.score = 0;
    this.levelStartScore = 0;
    this._load(0);
    this.state = 'playing';
    if (this.hooks.onEvent) this.hooks.onEvent('run', { lives: this.lives });
    this._sfx('click');
  };

  Game.prototype.startLevel = function (index) {
    this._load(index);
    this.state = 'playing';
  };

  Game.prototype.nextLevel = function () {
    if (this.state !== 'complete') return;
    var next = this.levelIndex + 1;
    if (next >= this.levels.length) {
      this.state = 'victory';
      if (this.hooks.onEvent) this.hooks.onEvent('victory', { score: this.score });
      return;
    }
    this.levelStartScore = this.score;
    this._load(next);
    this.state = 'playing';
  };

  Game.prototype.restartRun = function () { this.startRun(); };

  // Красивый фон для титульного экрана: уровень 1, всё замерло.
  Game.prototype.showTitlePreview = function () {
    this.lives = 3;
    this.score = 0;
    this.levelStartScore = 0;
    this._load(0);
    this.state = 'idle';
  };

  Game.prototype.levelName = function (lang) {
    var lvl = this.levels[this.levelIndex] || {};
    if (lang === 'en' && lvl.nameEn) return lvl.nameEn;
    return lvl.name || '???';
  };

  Game.prototype.levelHint = function (lang) {
    var lvl = this.levels[this.levelIndex] || {};
    if (lang === 'en' && lvl.hintEn) return lvl.hintEn;
    return lvl.hint || '';
  };

  /* --------------------------------------------------------------------- */
  /*  Тайлы и опоры                                                         */
  /* --------------------------------------------------------------------- */

  Game.prototype.tileAt = function (x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return '#';
    return this.base[y][x];
  };

  Game.prototype.isHole = function (x, y) {
    return this.holes.has(key(x, y));
  };

  Game.prototype.isPassable = function (x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    var t = this.base[y][x];
    return t !== '#' && t !== '=';
  };

  Game.prototype.isLadder = function (x, y) {
    return this.tileAt(x, y) === 'H';
  };

  Game.prototype.isRope = function (x, y) {
    return this.tileAt(x, y) === '-';
  };

  // Опора: клетка ниже — твёрдая/кирпич/лестница/канат; либо сам герой на лестнице/канате.
  Game.prototype.isSupported = function (x, y) {
    var here = this.tileAt(x, y);
    if (here === 'H' || here === '-') return true;
    var below = this.tileAt(x, y + 1);
    return below === '#' || below === '=' || below === 'H' || below === '-';
  };

  Game.prototype.exitIsUsable = function () {
    return this.exit.open && this.gold.size === 0;
  };

  /* --------------------------------------------------------------------- */
  /*  Движение                                                             */
  /* --------------------------------------------------------------------- */

  function finishMove(ent) {
    var m = ent.move;
    ent.x = m.toX; ent.y = m.toY;
    ent.px = ent.x; ent.py = ent.y;
    ent.move = null;
    ent.stepPhase = (ent.stepPhase + 1) % 2;
    return m;
  }

  Game.prototype._startMove = function (ent, dx, dy, ms, kind) {
    ent.move = {
      fromX: ent.x, fromY: ent.y,
      toX: ent.x + dx, toY: ent.y + dy,
      dx: dx, dy: dy,
      t: 0, dur: ms / 1000, kind: kind || 'walk'
    };
    if (dx !== 0) ent.dir = dx;
    ent.state = kind === 'fall' ? 'fall' : (dy !== 0 ? 'climb' : 'walk');
  };

  Game.prototype._progressMove = function (ent, dt) {
    var m = ent.move;
    if (!m) return null;
    m.t += dt;
    var k = clamp(m.t / m.dur, 0, 1);
    ent.px = lerp(m.fromX, m.toX, k);
    ent.py = lerp(m.fromY, m.toY, k);
    if (k >= 1) {
      var done = finishMove(ent);
      ent.anim += 0.1;
      return done;
    }
    return null;
  };

  Game.prototype.landing = function (x, y) {
    // куда приземлится объект, начавший падение из (x,y); null — улетел за карту
    var yy = y;
    while (yy < ROWS) {
      if (this.isHole(x, yy)) return { x: x, y: yy, hole: true };
      if (this.isSupported(x, yy)) return { x: x, y: yy, hole: false };
      yy++;
    }
    return null;
  };

  /* --------------------------------------------------------------------- */
  /*  Игрок                                                                */
  /* --------------------------------------------------------------------- */

  Game.prototype.canWalk = function (ent, dx) {
    return this.isPassable(ent.x + dx, ent.y);
  };

  Game.prototype.canUp = function (ent) {
    return this.isLadder(ent.x, ent.y) && this.isPassable(ent.x, ent.y - 1) && !this.isHole(ent.x, ent.y - 1);
  };

  Game.prototype.canDown = function (ent) {
    var ladderHere = this.isLadder(ent.x, ent.y);
    var ladderBelow = this.isLadder(ent.x, ent.y + 1);
    if (!(ladderHere || ladderBelow)) return false;
    if (!this.isPassable(ent.x, ent.y + 1)) return false;
    if (this.isHole(ent.x, ent.y + 1)) return false;
    return true;
  };

  Game.prototype._entitySupported = function (ent) {
    if (this.isHole(ent.x, ent.y)) return false;
    return this.isSupported(ent.x, ent.y);
  };

  Game.prototype._beginFall = function (ent) {
    if (ent.y >= ROWS - 1) {
      if (ent.kind === 'player') this.killPlayer('fall');
      return;
    }
    this._startMove(ent, 0, 1, FALL_MS, 'fall');
  };

  Game.prototype._arrive = function (ent) {
    if (ent.kind === 'player') {
      this._collectGoldAt(ent.x, ent.y);
      // Выход открыт — касание завершает уровень
      if (this.exitIsUsable() && ent.x === this.exit.x && ent.y === this.exit.y) {
        this.completeLevel();
        return;
      }
    }

    if (this.isHole(ent.x, ent.y)) {
      this._trapInHole(ent);
      return;
    }

    if (!this._entitySupported(ent)) {
      this._beginFall(ent);
      return;
    }

    ent.state = ent.kind === 'player' ? 'idle' : 'idle';
    ent.escape = 0;
  };

  Game.prototype._trapInHole = function (ent) {
    var h = this.holes.get(key(ent.x, ent.y));
    if (!h) { this._beginFall(ent); return; }
    ent.state = 'hole';
    ent.hole = key(ent.x, ent.y);
    ent.escape = 0;
    if (ent.kind === 'enemy') {
      this._sfx('trap');
      this._burst(ent.x, ent.y, 10, '#ff5c8a');
    } else {
      this._sfx('trap');
      this.shake = Math.max(this.shake, 4);
    }
  };

  Game.prototype.updatePlayer = function (dt) {
    var p = this.player;
    p.anim += dt;

    if (p.state === 'hole') {
      p.escape += dt;
      var hk = p.hole;
      if (!hk || !this.holes.has(hk)) { // яма закрылась — смерть
        this.killPlayer('hole');
        return;
      }
      // выбраться из ямы можно вверх после короткой задержки
      if (p.escape > ESCAPE_TIME && this.input.up && this.isPassable(p.x, p.y - 1)) {
        p.hole = null;
        p.state = 'climb';
        this._startMove(p, 0, -1, 165, 'climb');
        this._sfx('step');
      }
      return;
    }

    if (p.state === 'digging') {
      p.digT += dt;
      if (!p.dug && p.digT >= DIG_WINDUP / 1000) {
        p.dug = true;
        this._makeHole(p.x + p.digSide, p.y + 1);
      }
      if (p.digT >= DIG_TOTAL / 1000) {
        p.state = 'idle';
        p.digT = 0;
      }
      return;
    }

    // смертельная анимация обрабатывается на уровне Game.state

    if (p.move) {
      this._progressMove(p, dt);
      if (p.move) return;
      // прибыли в новую клетку
      this._arrive(p);
      return;
    }

    if (p.state === 'fall') {
      this._beginFall(p);
      return;
    }

    // после прибытия — проверить опору
    if (!this._entitySupported(p)) {
      if (p.state === 'idle' || p.state === 'walk' || p.state === 'climb') {
        this._beginFall(p);
        return;
      }
    }

    if (p.state === 'spawn') { p.state = 'idle'; return; }
    if (p.state !== 'idle' && p.state !== 'walk') p.state = 'idle';

    // управление по удержанию клавиш
    var inp = this.input;
    if (inp.up && this.canUp(p)) { this._startMove(p, 0, -1, CLIMB_MS, 'climb'); return; }
    if (inp.down && this.canDown(p)) { this._startMove(p, 0, 1, CLIMB_MS, 'climb'); return; }
    if (inp.left && this.canWalk(p, -1)) { this._startMove(p, -1, 0, WALK_MS, 'walk'); return; }
    if (inp.right && this.canWalk(p, 1)) { this._startMove(p, 1, 0, WALK_MS, 'walk'); return; }
    p.state = 'idle';
  };

  Game.prototype.movePlayer = function () {
    var p = this.player;
    if (p.state === 'idle' || p.state === 'walk') {
      // ускоренное решение в тот же кадр, чтобы ввод был отзывчивым
      var inp = this.input;
      if (inp.up && this.canUp(p)) { this._startMove(p, 0, -1, CLIMB_MS, 'climb'); return true; }
      if (inp.down && this.canDown(p)) { this._startMove(p, 0, 1, CLIMB_MS, 'climb'); return true; }
      if (inp.left && this.canWalk(p, -1)) { this._startMove(p, -1, 0, WALK_MS, 'walk'); return true; }
      if (inp.right && this.canWalk(p, 1)) { this._startMove(p, 1, 0, WALK_MS, 'walk'); return true; }
    }
    return false;
  };

  Game.prototype.dig = function (side) {
    var p = this.player;
    if (this.state !== 'playing' || this.freeze > 0) return false;
    if (p.move || p.state === 'hole' || p.state === 'digging' || p.state === 'fall') return false;
    if (!this._entitySupported(p)) return false;
    var tx = p.x + (side < 0 ? -1 : 1);
    var ty = p.y + 1;
    if (ty >= ROWS) return false;
    if (this.tileAt(tx, ty) !== '=') return false;
    if (this.holes.has(key(tx, ty))) return false;
    // не выкапываем опору из-под золота или выхода
    if (this.gold.has(key(tx, ty - 1))) return false;
    if (this.exit.x === tx && this.exit.y === ty - 1) return false;
    p.state = 'digging';
    p.digSide = side < 0 ? -1 : 1;
    p.digT = 0;
    p.dug = false;
    p.dir = p.digSide;
    this._sfx('dig');
    return true;
  };

  Game.prototype._makeHole = function (x, y) {
    if (this.tileAt(x, y) !== '=') return;
    this.base[y][x] = '.';
    this.holes.set(key(x, y), { timer: HOLE_TIME, max: HOLE_TIME, x: x, y: y });
    this._burst(x + 0.5, y + 0.5, 12, '#ff9f43');
    this.shake = Math.max(this.shake, 2.5);
  };

  Game.prototype._collectGoldAt = function (x, y) {
    var k = key(x, y);
    if (!this.gold.has(k)) return;
    this.gold.delete(k);
    this.score += 100;
    this._sfx('gold');
    this._burst(x + 0.5, y + 0.5, 14, '#ffd166');
    this._float('+100', x, y, '#ffd166');
    if (this.hooks.onEvent) {
      this.hooks.onEvent('gold', { left: this.gold.size, total: this.totalGold, score: this.score });
    }
    if (this.gold.size === 0) {
      this.exit.open = true;
      this._sfx('exit');
      this.shake = Math.max(this.shake, 5);
      this._burst(this.exit.x + 0.5, this.exit.y + 0.5, 30, '#7cf6ff');
      if (this.hooks.onEvent) this.hooks.onEvent('exitOpen', { x: this.exit.x, y: this.exit.y });
    }
  };

  Game.prototype.killPlayer = function (reason) {
    if (this.state !== 'playing') return;
    this.state = 'dying';
    this.deathTimer = 1.15;
    this.deathReason = reason || 'enemy';
    this.shake = 10;
    this._sfx('die');
    this._burst(this.player.px + 0.5, this.player.py + 0.5, 26, '#ff4d6d');
    if (this.hooks.onEvent) this.hooks.onEvent('die', { reason: this.deathReason });
  };

  Game.prototype._finishDeath = function () {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.lives = 0;
      this.state = 'gameover';
      if (this.hooks.onEvent) this.hooks.onEvent('gameover', { score: this.score });
      return;
    }
    this.score = this.levelStartScore;
    this._load(this.levelIndex);
    this.state = 'playing';
    if (this.hooks.onEvent) this.hooks.onEvent('respawn', { lives: this.lives });
  };

  Game.prototype.completeLevel = function () {
    if (this.state !== 'playing') return;
    this.state = 'complete';
    var timeBonus = Math.max(0, Math.round(420 - this.levelTime * 5));
    var levelBonus = 250;
    var total = timeBonus + levelBonus;
    this.score += total;
    this._sfx('win');
    this.shake = Math.max(this.shake, 6);
    this._burst(this.player.px + 0.5, this.player.py + 0.5, 36, '#7cf6ff');
    if (this.hooks.onEvent) {
      this.hooks.onEvent('complete', {
        level: this.levelIndex,
        time: this.levelTime,
        timeBonus: timeBonus,
        levelBonus: levelBonus,
        total: total,
        score: this.score,
        last: this.levelIndex >= this.levels.length - 1
      });
    }
  };

  /* --------------------------------------------------------------------- */
  /*  Враги                                                                */
  /* --------------------------------------------------------------------- */

  Game.prototype._enemyReachable = function (sx, sy) {
    // Узлы (x,y) — позиции с опорой; рёбра: шаг влево/вправо (с падением),
    // вверх/вниз по лестнице. Ямы избегаем.
    var seen = new Map();
    var q = [{ x: sx, y: sy }];
    var startK = key(sx, sy);
    seen.set(startK, { from: null, action: null });
    var nodes = [];
    var head = 0;
    while (head < q.length) {
      var cur = q[head++];
      nodes.push(cur);
      var dirs = [];
      if (this.isPassable(cur.x - 1, cur.y) && !this.isHole(cur.x - 1, cur.y)) dirs.push({ type: 'walk', dx: -1, dy: 0 });
      if (this.isPassable(cur.x + 1, cur.y) && !this.isHole(cur.x + 1, cur.y)) dirs.push({ type: 'walk', dx: 1, dy: 0 });
      if (this.isLadder(cur.x, cur.y) && this.isPassable(cur.x, cur.y - 1) && !this.isHole(cur.x, cur.y - 1)) dirs.push({ type: 'climb', dx: 0, dy: -1 });
      var ladderDown = this.isLadder(cur.x, cur.y) || this.isLadder(cur.x, cur.y + 1);
      if (ladderDown && this.isPassable(cur.x, cur.y + 1) && !this.isHole(cur.x, cur.y + 1)) dirs.push({ type: 'climb', dx: 0, dy: 1 });

      for (var i = 0; i < dirs.length; i++) {
        var d = dirs[i];
        var nx = cur.x + d.dx, ny = cur.y + d.dy;
        var land = this.landing(nx, ny);
        if (!land || land.hole) continue;
        // Если шаг по горизонтали был в воздух, приземление ниже: это валидное ребро.
        var nk = key(land.x, land.y);
        if (seen.has(nk)) continue;
        seen.set(nk, { from: cur, action: d });
        q.push(land);
      }
    }
    return { seen: seen, nodes: nodes, startK: startK };
  };

  Game.prototype._pathTo = function (sx, sy, targets) {
    if (!targets || !targets.length) return null;
    var startSupported = this.isSupported(sx, sy) || this.isLadder(sx, sy) || this.isRope(sx, sy);
    var start = { x: sx, y: sy };
    var seen = new Map();
    seen.set(key(sx, sy), { from: null, action: null });
    var q = [start], head = 0;
    var targetSet = new Set();
    for (var t = 0; t < targets.length; t++) targetSet.add(key(targets[t].x, targets[t].y));

    while (head < q.length) {
      var cur = q[head++];
      var curK = key(cur.x, cur.y);
      if (curK !== key(sx, sy) && targetSet.has(curK)) {
        var actions = [];
        var node = cur;
        var info = seen.get(key(node.x, node.y));
        while (info && info.from) {
          actions.push({ dx: info.action.dx, dy: info.action.dy });
          node = info.from;
          info = seen.get(key(node.x, node.y));
        }
        actions.reverse();
        return actions;
      }

      var dirs = [];
      if (this.isPassable(cur.x - 1, cur.y) && !this.isHole(cur.x - 1, cur.y)) dirs.push({ dx: -1, dy: 0 });
      if (this.isPassable(cur.x + 1, cur.y) && !this.isHole(cur.x + 1, cur.y)) dirs.push({ dx: 1, dy: 0 });
      if (this.isLadder(cur.x, cur.y) && this.isPassable(cur.x, cur.y - 1) && !this.isHole(cur.x, cur.y - 1)) dirs.push({ dx: 0, dy: -1 });
      var ld = this.isLadder(cur.x, cur.y) || this.isLadder(cur.x, cur.y + 1);
      if (ld && this.isPassable(cur.x, cur.y + 1) && !this.isHole(cur.x, cur.y + 1)) dirs.push({ dx: 0, dy: 1 });

      for (var i = 0; i < dirs.length; i++) {
        var d = dirs[i];
        var nx = cur.x + d.dx, ny = cur.y + d.dy;
        var land = this.landing(nx, ny);
        if (!land || land.hole) continue;
        var nk = key(land.x, land.y);
        if (seen.has(nk)) continue;
        seen.set(nk, { from: cur, action: d });
        q.push({ x: land.x, y: land.y });
      }
    }
    return null;
  };

  Game.prototype._enemyPickTarget = function (en) {
    var p = this.player;
    var targets = [];
    if (this.state === 'playing' && p.state !== 'dead') targets.push({ x: p.x, y: p.y });
    if (!targets.length) return [];
    return targets;
  };

  Game.prototype._enemyAct = function (en) {
    if (en.move || en.state === 'hole' || en.state === 'dead' || en.state === 'spawn') return;
    if (!this._entitySupported(en)) {
      this._beginFall(en);
      return;
    }
    var path = this._pathTo(en.x, en.y, this._enemyPickTarget(en));
    if (!path || !path.length) {
      // Игрок недостижим: бродим к золоту / выходу / по компоненте
      var rewards = [];
      this.gold.forEach(function (v) {
        var p2 = v.split(',');
        rewards.push({ x: +p2[0], y: +p2[1] });
      });
      if (this.exit.open) rewards.push({ x: this.exit.x, y: this.exit.y });
      var pth = this._pathTo(en.x, en.y, rewards);
      if (pth && pth.length) { this._enemyStep(en, pth[0]); return; }
      // случайное блуждание по достижимым клеткам
      var comp = this._enemyReachable(en.x, en.y);
      var choices = [];
      comp.nodes.forEach(function (n) {
        if (n.x !== en.x || n.y !== en.y) choices.push(n);
      });
      if (choices.length) {
        var randomNode = choices[(Math.random() * choices.length) | 0];
        var rp = this._pathTo(en.x, en.y, [randomNode]);
        if (rp && rp.length) { this._enemyStep(en, rp[0]); return; }
      }
      if (Math.random() < 0.3) en.dir = -en.dir;
      return;
    }
    this._enemyStep(en, path[0]);
  };

  Game.prototype._enemyStep = function (en, action) {
    if (!action) return;
    if (action.dy === -1) {
      if (this.canUp(en)) this._startMove(en, 0, -1, CLIMB_MS + 20, 'climb');
      return;
    }
    if (action.dy === 1) {
      if (this.canDown(en)) this._startMove(en, 0, 1, CLIMB_MS + 20, 'climb');
      return;
    }
    if (action.dx !== 0) {
      if (this.canWalk(en, action.dx)) this._startMove(en, action.dx, 0, WALK_MS + 45, 'walk');
    }
  };

  Game.prototype.updateEnemies = function (dt) {
    for (var i = 0; i < this.enemies.length; i++) {
      var en = this.enemies[i];
      en.anim += dt;

      if (en.state === 'dead') {
        en.deadTimer -= dt;
        if (en.deadTimer <= 0) {
          en.x = en.spawnX; en.y = en.spawnY;
          en.px = en.x; en.py = en.y;
          en.state = 'spawn';
          en.spawnTimer = 0.55;
          en.move = null;
          en.hole = null;
        }
        continue;
      }
      if (en.state === 'spawn') {
        en.spawnTimer -= dt;
        if (en.spawnTimer <= 0) en.state = 'idle';
        continue;
      }
      if (en.state === 'hole') {
        if (!this.holes.has(en.hole)) {
          this._enemyDie(en);
        }
        continue;
      }
      if (en.move) {
        this._progressMove(en, dt);
        if (en.move) continue;
        this._arrive(en);
        continue;
      }
      if (en.state === 'fall') {
        this._beginFall(en);
        continue;
      }
      if (!this._entitySupported(en)) {
        this._beginFall(en);
        continue;
      }
      en.wander -= dt;
      if (en.wander <= 0) {
        en.wander = rand(0.02, 0.12);
        this._enemyAct(en);
      }
    }
  };

  Game.prototype._enemyDie = function (en) {
    if (en.state === 'dead') return;
    en.state = 'dead';
    en.deadTimer = RESPAWN_TIME;
    en.move = null;
    this.score += 150;
    this._sfx('trap');
    this._burst(en.px + 0.5, en.py + 0.5, 22, '#ff5c8a');
    this._float('+150', en.px, en.py, '#ff5c8a');
    if (this.hooks.onEvent) this.hooks.onEvent('enemyTrap', { score: this.score });
  };

  Game.prototype._checkCollisions = function () {
    if (this.state !== 'playing') return;
    var p = this.player;
    if (p.state === 'hole') {
      // в яме игрок ещё может погибнуть от врага, свалившегося сверху
    }
    for (var i = 0; i < this.enemies.length; i++) {
      var en = this.enemies[i];
      if (en.state === 'dead' || en.state === 'spawn' || en.state === 'hole') continue;
      var dx = Math.abs((en.px + 0.5) - (p.px + 0.5));
      var dy = Math.abs((en.py + 0.5) - (p.py + 0.5));
      if (dx < 0.62 && dy < 0.7) {
        this.killPlayer('enemy');
        return;
      }
    }
  };

  /* --------------------------------------------------------------------- */
  /*  Ямы                                                                  */
  /* --------------------------------------------------------------------- */

  Game.prototype.updateHoles = function (dt) {
    var self = this;
    var closed = [];
    this.holes.forEach(function (h, k) {
      h.timer -= dt;
      if (h.timer <= 0) closed.push(k);
    });
    for (var i = 0; i < closed.length; i++) {
      var k = closed[i];
      var h = this.holes.get(k);
      var xy = k.split(',');
      var x = +xy[0], y = +xy[1];

      // игрок внутри закрывающейся ямы — погибает
      if (this.player.x === x && this.player.y === y &&
          (this.player.state === 'hole' || this.player.state === 'falling' || this.player.state === 'fall')) {
        this.holes.delete(k);
        this.base[y][x] = '=';
        this.killPlayer('hole');
        continue;
      }

      for (var j = 0; j < this.enemies.length; j++) {
        var en = this.enemies[j];
        if (en.state !== 'dead' && en.x === x && en.y === y) {
          this._enemyDie(en);
        }
      }

      this.holes.delete(k);
      this.base[y][x] = '=';
      this._burst(x + 0.5, y + 0.5, 16, '#9aa4c7');
    }
  };

  /* --------------------------------------------------------------------- */
  /*  Эффекты                                                              */
  /* --------------------------------------------------------------------- */

  Game.prototype._burst = function (x, y, count, color) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = rand(0.6, 4.2);
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - rand(0.2, 1.6),
        life: rand(0.35, 0.9),
        max: 1,
        size: rand(0.04, 0.12),
        color: color,
        gravity: rand(3, 8)
      });
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  };

  Game.prototype._float = function (text, x, y, color) {
    this.floaters.push({ text: text, x: x, y: y, life: 1.0, max: 1.0, color: color, vy: -0.7 });
    if (this.floaters.length > 12) this.floaters.shift();
  };

  Game.prototype.updateEffects = function (dt) {
    var i;
    for (i = this.particles.length - 1; i >= 0; i--) {
      var p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
    }
    for (i = this.floaters.length - 1; i >= 0; i--) {
      var f = this.floaters[i];
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 22);
  };

  /* --------------------------------------------------------------------- */
  /*  Главный цикл                                                         */
  /* --------------------------------------------------------------------- */

  Game.prototype.update = function (dt) {
    dt = Math.min(dt, 0.05);
    this.time += dt;

    if (this.state === 'playing') {
      if (this.freeze > 0) {
        this.freeze -= dt;
        this._checkCollisions();
        this.updateEffects(dt);
        return;
      }
      this.levelTime += dt;
      this.updateHoles(dt);
      if (this.state !== 'playing') { this.updateEffects(dt); return; }
      this.updatePlayer(dt);
      this.updateEnemies(dt);
      this._checkCollisions();
      this.updateEffects(dt);
      return;
    }

    if (this.state === 'dying') {
      this.deathTimer -= dt;
      this.updateEffects(dt);
      if (this.deathTimer <= 0) this._finishDeath();
      return;
    }

    if (this.state === 'complete') {
      this.updateEffects(dt);
      return;
    }

    if (this.state === 'gameover' || this.state === 'victory') {
      this.updateEffects(dt);
      return;
    }

    this.updateEffects(dt);
  };

  Game.prototype.setInput = function (input) {
    this.input.left = !!input.left;
    this.input.right = !!input.right;
    this.input.up = !!input.up;
    this.input.down = !!input.down;
  };

  Game.prototype._sfx = function (name) {
    if (this.hooks.audio && this.hooks.audio.sfx) {
      try { this.hooks.audio.sfx(name); } catch (e) { /* тишина */ }
    }
  };

  Game.prototype.getHud = function () {
    var lvl = this.levels[this.levelIndex] || {};
    return {
      level: this.levelIndex + 1,
      totalLevels: this.levels.length,
      name: lvl.name || '',
      nameEn: lvl.nameEn || lvl.name || '',
      goldLeft: this.gold.size,
      goldTotal: this.totalGold,
      score: this.score,
      lives: this.lives,
      best: 0,
      exitOpen: this.exit.open && this.gold.size === 0,
      time: this.levelTime,
      state: this.state
    };
  };

  Game.COLS = COLS;
  Game.ROWS = ROWS;
  Game.HOLE_TIME = HOLE_TIME;

  window.LR = window.LR || {};
  window.LR.Game = Game;
  window.LR.COLS = COLS;
  window.LR.ROWS = ROWS;
})();
