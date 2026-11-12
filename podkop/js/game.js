/* ==========================================================================
   ПОДКОП — игровая логика (лестницы, канаты, ямы-ловушки)
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

  /* Цены шагов для поиска пути врага (Дейкстра, см. _pathTo).
   * Падение на одну клетку стоит заметно дороже шага/лестницы: иначе враг
   * считает «прыжок в шахту на 6–10 клеток» одним дешёвым действием и уходит
   * вниз напрямик вместо спуска по лестнице — со стороны это выглядит как
   * бессмысленное самоубийство с платформы. */
  var COST_STEP = 1;
  var COST_CLIMB = 1.1;
  var COST_FALL_CELL = 3;
  var ENEMY_RETRY = 0.12;         // пауза перед повторной попыткой, если шаг сорвался
  var ENEMY_FALLBACK_RETRY = 0.3; // пауза, когда игрок недостижим (враг караулит у ямы)

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
      // ИИ врага: cooldown до следующего решения и закэшированный маршрут.
      actCooldown: 0,
      path: null,
      pathKey: '',
      pathHoles: ''
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

  // ↓ на канате — разжать руки и упасть (только игрок; стража с канатов не прыгает).
  Game.prototype.canDropFromRope = function (ent) {
    return this.isRope(ent.x, ent.y) && !this.isLadder(ent.x, ent.y + 1) && this.isPassable(ent.x, ent.y + 1);
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
      // пока враг в яме, маршрут не нужен — сбрасываем кэш
      ent.path = null;
      ent.pathKey = '';
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
    if (inp.down && this.canDropFromRope(p)) { this._startMove(p, 0, 1, FALL_MS, 'fall'); return; }
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
      if (inp.down && this.canDropFromRope(p)) { this._startMove(p, 0, 1, FALL_MS, 'fall'); return true; }
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
      this.exit.openAt = this.time;
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

  // Клетки, куда враг может шагнуть из (x, y), и цена такого шага.
  // Общая логика для поиска пути и для «достижимой компоненты».
  Game.prototype._enemyMoves = function (x, y) {
    var moves = [];
    var self = this;
    function add(ax, ay, baseCost) {
      var nx = x + ax, ny = y + ay;
      var land = self.landing(nx, ny);
      if (!land || land.hole) return; // в открытую яму враг сам не полезет
      var fallCells = Math.max(0, land.y - ny); // сколько клеток летим после шага
      moves.push({
        land: land,
        action: { dx: ax, dy: ay },
        cost: baseCost + fallCells * COST_FALL_CELL
      });
    }
    if (this.isPassable(x - 1, y) && !this.isHole(x - 1, y)) add(-1, 0, COST_STEP);
    if (this.isPassable(x + 1, y) && !this.isHole(x + 1, y)) add(1, 0, COST_STEP);
    if (this.isLadder(x, y) && this.isPassable(x, y - 1) && !this.isHole(x, y - 1)) add(0, -1, COST_CLIMB);
    var ladderDown = this.isLadder(x, y) || this.isLadder(x, y + 1);
    if (ladderDown && this.isPassable(x, y + 1) && !this.isHole(x, y + 1)) add(0, 1, COST_CLIMB);
    return moves;
  };

  Game.prototype._enemyReachable = function (sx, sy) {
    // Узлы (x,y) — позиции с опорой; рёбра — _enemyMoves. Ямы недостижимы.
    var startK = key(sx, sy);
    var seen = new Set([startK]);
    var nodes = [{ x: sx, y: sy }];
    var q = [{ x: sx, y: sy }];
    var head = 0;
    while (head < q.length) {
      var cur = q[head++];
      var moves = this._enemyMoves(cur.x, cur.y);
      for (var i = 0; i < moves.length; i++) {
        var land = moves[i].land;
        var nk = key(land.x, land.y);
        if (seen.has(nk)) continue;
        seen.add(nk);
        nodes.push(land);
        q.push(land);
      }
    }
    return { seen: seen, nodes: nodes, startK: startK };
  };

  // --- маленькая двоичная куча для Дейкстры ---------------------------------
  function heapPush(h, item) {
    h.push(item);
    var i = h.length - 1;
    while (i > 0) {
      var p = (i - 1) >> 1;
      if (h[p].c <= h[i].c) break;
      var t = h[p]; h[p] = h[i]; h[i] = t;
      i = p;
    }
  }
  function heapPop(h) {
    var top = h[0];
    var last = h.pop();
    if (h.length) {
      h[0] = last;
      var i = 0;
      for (;;) {
        var l = i * 2 + 1, r = l + 1, m = i;
        if (l < h.length && h[l].c < h[m].c) m = l;
        if (r < h.length && h[r].c < h[m].c) m = r;
        if (m === i) break;
        var t = h[m]; h[m] = h[i]; h[i] = t;
        i = m;
      }
    }
    return top;
  }

  /* Маршрут врага. Раньше это был BFS «по числу действий»: длинное падение
   * считалось одним дешёвым действием, поэтому враг регулярно выбирал не
   * лестницу, а «прыжок в шахту» на 6–10 клеток — со стороны это выглядело
   * как бессмысленное падение с платформы. Теперь — Дейкстра по стоимости,
   * где каждая клетка падения добавляет штраф (COST_FALL_CELL). */
  Game.prototype._pathTo = function (sx, sy, targets) {
    if (!targets || !targets.length) return null;
    var startK = key(sx, sy);
    var targetSet = new Set();
    for (var t = 0; t < targets.length; t++) targetSet.add(key(targets[t].x, targets[t].y));

    var best = new Map();
    var prev = new Map();
    var heap = [];
    best.set(startK, 0);
    prev.set(startK, null);
    heapPush(heap, { x: sx, y: sy, c: 0 });

    while (heap.length) {
      var cur = heapPop(heap);
      var curK = key(cur.x, cur.y);
      if (cur.c > (best.has(curK) ? best.get(curK) : Infinity)) continue;

      if (curK !== startK && targetSet.has(curK)) {
        var actions = [];
        var node = { x: cur.x, y: cur.y };
        var info = prev.get(key(node.x, node.y));
        while (info && info.from) {
          actions.push({ dx: info.action.dx, dy: info.action.dy });
          node = info.from;
          info = prev.get(key(node.x, node.y));
        }
        actions.reverse();
        return actions;
      }

      var moves = this._enemyMoves(cur.x, cur.y);
      for (var i = 0; i < moves.length; i++) {
        var mv = moves[i];
        var nk = key(mv.land.x, mv.land.y);
        var nc = cur.c + mv.cost;
        if (nc >= (best.has(nk) ? best.get(nk) : Infinity)) continue;
        best.set(nk, nc);
        prev.set(nk, { from: { x: cur.x, y: cur.y }, action: mv.action });
        heapPush(heap, { x: mv.land.x, y: mv.land.y, c: nc });
      }
    }
    return null;
  };

  Game.prototype._enemyPickTarget = function (en) {
    var p = this.player;
    var targets = [];
    if (this.state === 'playing' && p.state !== 'dead') targets.push({ x: p.x, y: p.y });
    return targets;
  };

  /* Одно решение врага. Вызывается только когда враг стоит на опоре.
   * Держит закэшированный маршрут к игроку и продолжает его от шага к шагу:
   * пока игрок стоит на месте, враг не пересчитывает путь и не «передумывает»
   * на каждой клетке. */
  Game.prototype._enemyClassicStep = function (en) {
    var p = this.player;
    var dx = p.x > en.x ? 1 : (p.x < en.x ? -1 : 0);
    var dy = p.y > en.y ? 1 : (p.y < en.y ? -1 : 0);
    // 1) к ряду игрока по лестнице
    if (dy > 0 && this.canDown(en)) return this._enemyStep(en, { dx: 0, dy: 1 });
    if (dy < 0 && this.canUp(en)) return this._enemyStep(en, { dx: 0, dy: -1 });
    // 2) к колонне игрока по горизонтали (сход с края = падение к игроку)
    if (dx !== 0 && this.canWalk(en, dx)) return this._enemyStep(en, { dx: dx, dy: 0 });
    // 3) затык: любая доступная вертикаль к игроку, затем обход в сторону
    if (dy >= 0 && this.canDown(en)) return this._enemyStep(en, { dx: 0, dy: 1 });
    if (dy <= 0 && this.canUp(en)) return this._enemyStep(en, { dx: 0, dy: -1 });
    if (dx !== 0 && this.canWalk(en, -dx)) return this._enemyStep(en, { dx: -dx, dy: 0 });
    return false;
  };

  Game.prototype._enemyAct = function (en) {
    if (en.move || en.state === 'hole' || en.state === 'dead' || en.state === 'spawn') return;
    if (!this._entitySupported(en)) {
      this._beginFall(en);
      return;
    }

    // Классическая эвристика стражи: читаемое преследование.
    // Если ничего не вышло (тупик) — ниже фолбэк на поиск пути, чтобы страж не зависал.
    if (this._enemyClassicStep(en)) { en.actCooldown = 0; return; }

    var targets = this._enemyPickTarget(en);
    var playerReachableTarget = targets.length > 0;
    // Маршрут валиден, пока цель (клетка игрока) и состояние ям/золота не менялись.
    var goalKey = playerReachableTarget ? ('p:' + targets[0].x + ',' + targets[0].y) : 'none';
    var worldKey = this.holes.size + ':' + this.gold.size + ':' + (this.exit.open ? 1 : 0);
    if (!en.path || en.pathKey !== goalKey || en.pathHoles !== worldKey) {
      en.path = playerReachableTarget ? (this._pathTo(en.x, en.y, targets) || []) : [];
      en.pathKey = goalKey;
      en.pathHoles = worldKey;
    }

    var hadPath = false;
    while (en.path && en.path.length) {
      hadPath = true;
      var action = en.path.shift();
      if (this._enemyStep(en, action)) {
        en.actCooldown = 0;
        return;
      }
      // Шаг сорвался (яма/кирпич появились после расчёта) — пересчитаем путь.
      en.path = null;
      en.pathKey = '';
    }
    en.path = null;
    en.pathKey = '';
    if (hadPath) {
      // Маршрут к игроку был, но шаг не начался: короткая пауза и пересчёт,
      // чтобы не гонять Дейкстру каждый кадр.
      en.actCooldown = ENEMY_RETRY;
      return;
    }

    // Игрок недостижим (например, сидит в яме). Без случайного блуждания:
    // 1) подходим как можно ближе к игроку по достижимой части уровня;
    // 2) если ближе некуда — идём к награде (золото/открытый выход);
    // 3) иначе караулим на месте.
    var px = this.player.px, py = this.player.py;
    var myDist = Math.abs(en.x - px) + Math.abs(en.y - py);
    var comp = this._enemyReachable(en.x, en.y);
    var bestNode = null, bestDist = Infinity;
    for (var i = 0; i < comp.nodes.length; i++) {
      var n = comp.nodes[i];
      if (n.x === en.x && n.y === en.y) continue;
      var d = Math.abs(n.x - px) + Math.abs(n.y - py);
      if (d < bestDist) { bestDist = d; bestNode = n; }
    }
    if (bestNode && bestDist < myDist) {
      var bp = this._pathTo(en.x, en.y, [bestNode]);
      if (bp && bp.length && this._enemyStep(en, bp[0])) { en.actCooldown = 0; return; }
    }

    var rewards = [];
    this.gold.forEach(function (v) {
      var p2 = v.split(',');
      rewards.push({ x: +p2[0], y: +p2[1] });
    });
    if (this.exit.open) rewards.push({ x: this.exit.x, y: this.exit.y });
    var rp = this._pathTo(en.x, en.y, rewards);
    if (rp && rp.length && this._enemyStep(en, rp[0])) { en.actCooldown = 0; return; }

    en.actCooldown = ENEMY_FALLBACK_RETRY;
  };

  // Возвращает true, если шаг реально начался.
  Game.prototype._enemyStep = function (en, action) {
    if (!action) return false;
    if (action.dy === -1) {
      if (!this.canUp(en)) return false;
      this._startMove(en, 0, -1, CLIMB_MS + 20, 'climb');
      return true;
    }
    if (action.dy === 1) {
      if (!this.canDown(en)) return false;
      this._startMove(en, 0, 1, CLIMB_MS + 20, 'climb');
      return true;
    }
    if (action.dx !== 0) {
      if (!this.canWalk(en, action.dx)) return false;
      this._startMove(en, action.dx, 0, WALK_MS + 45, 'walk');
      return true;
    }
    return false;
  };

  Game.prototype.updateEnemies = function (dt) {
    for (var i = 0; i < this.enemies.length; i++) {
      var en = this.enemies[i];
      en.anim += dt;

      if (en.state === 'dead') {
        en.deadTimer -= dt;
        if (en.deadTimer <= 0) this._enemyRespawn(en);
        continue;
      }
      if (en.state === 'spawn') {
        en.spawnTimer -= dt;
        if (en.spawnTimer <= 0) { en.state = 'idle'; en.actCooldown = 0; }
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
        // Прибыли в клетку — сразу продолжаем маршрут в этом же кадре.
        // Раньше здесь была случайная пауза 20–120 мс перед каждым шагом,
        // из-за неё враг «дёргался»: шаг — стоп — шаг.
        if (!en.move && en.state !== 'hole' && en.state !== 'dead' &&
            en.state !== 'spawn' && en.actCooldown <= 0) {
          this._enemyAct(en);
        }
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
      if (en.actCooldown > 0) { en.actCooldown -= dt; continue; }
      this._enemyAct(en);
    }
  };

  /* Возрождение врага: возвращаем на его точку старта, но только если она
   * всё ещё пригодна (игрок мог выкопать под ней яму или застроить проход).
   * Иначе ищем ближайшую опорную клетку рядом — враг не должен появляться
   * внутри кирпича или ямы. */
  Game.prototype._enemyRespawn = function (en) {
    var sx = en.spawnX, sy = en.spawnY;
    var ok = function (x, y) {
      return this.isPassable(x, y) && !this.isHole(x, y) && this.isSupported(x, y);
    }.bind(this);
    if (!ok(sx, sy)) {
      var found = null;
      for (var r = 1; r <= 4 && !found; r++) {
        for (var dy = -r; dy <= r && !found; dy++) {
          for (var dx = -r; dx <= r && !found; dx++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            if (ok(sx + dx, sy + dy)) found = { x: sx + dx, y: sy + dy };
          }
        }
      }
      if (found) {
        sx = found.x; sy = found.y;
      } else {
        // Совсем некуда поставить — попробуем позже, но не спавним в стене.
        en.deadTimer = 0.5;
        return;
      }
    }
    en.x = sx; en.y = sy;
    en.px = sx; en.py = sy;
    en.state = 'spawn';
    en.spawnTimer = 0.55;
    en.move = null;
    en.hole = null;
    en.path = null;
    en.pathKey = '';
    en.actCooldown = 0.2;
  };

  Game.prototype._enemyDie = function (en) {
    if (en.state === 'dead') return;
    en.state = 'dead';
    en.deadTimer = RESPAWN_TIME;
    en.move = null;
    en.path = null;
    en.pathKey = '';
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

  window.PODKOP = window.PODKOP || {};
  window.PODKOP.Game = Game;
  window.PODKOP.COLS = COLS;
  window.PODKOP.ROWS = ROWS;
})();
