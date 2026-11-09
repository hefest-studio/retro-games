/* ============================================================================
   TETRIS · движок (DOM-free, детерминированный)
   Классический тетрис: поле 10×20, 7 фигур (7-bag), вращение матрицей с
   простыми wall-kick, линии, счёт (100/300/500/800×уровень), уровни/скорость,
   hold, lock-delay. Владелец: Lead. Интерфейс — CONTRACT.md.
   ========================================================================== */
(function (global) {
  'use strict';
  var TT = global.TT = global.TT || {};

  var COLS = 10, ROWS = 20;

  // Матрицы фигур в спавн-ориентации (1 — заполнено). id цвета = индекс+1.
  var SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]]
  };
  var TYPES = ['I','O','T','S','Z','J','L'];
  var COLOR = { I:1, O:2, T:3, S:4, Z:5, J:6, L:7 };
  // Задержки гравитации по уровню (мс на клетку), классическая кривая.
  var GRAV = [800,720,630,550,470,380,300,220,130,100,80,80,70,70,70,50,50,50,30,30,20];
  var LOCK_DELAY = 500; // мс на земле до фиксации
  var SCORE_LINES = [0,100,300,500,800];

  function rotateCW(m) {
    var n = m.length, r = [];
    for (var y = 0; y < n; y++) { r[y] = []; for (var x = 0; x < n; x++) r[y][x] = m[n-1-x][y]; }
    return r;
  }
  function rotateCCW(m) {
    var n = m.length, r = [];
    for (var y = 0; y < n; y++) { r[y] = []; for (var x = 0; x < n; x++) r[y][x] = m[x][n-1-y]; }
    return r;
  }
  function clone(m) { return m.map(function (row) { return row.slice(); }); }

  function emptyBoard() {
    var b = [];
    for (var y = 0; y < ROWS; y++) { b[y] = []; for (var x = 0; x < COLS; x++) b[y][x] = 0; }
    return b;
  }

  // 7-bag рандомайзер (детерминируемый через seed, если задан)
  function Bag(rngFn) {
    this.rng = rngFn || Math.random;
    this.queue = [];
  }
  Bag.prototype._refill = function () {
    var t = TYPES.slice();
    for (var i = t.length - 1; i > 0; i--) {
      var j = Math.floor(this.rng() * (i + 1));
      var tmp = t[i]; t[i] = t[j]; t[j] = tmp;
    }
    this.queue = this.queue.concat(t);
  };
  Bag.prototype.next = function () { if (this.queue.length < 1) this._refill(); return this.queue.shift(); };
  Bag.prototype.peek = function (n) { while (this.queue.length < n) this._refill(); return this.queue.slice(0, n); };

  function makePiece(type) {
    return { type: type, m: clone(SHAPES[type]), x: 0, y: 0 };
  }

  TT.Game = function (opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var onEventFn = typeof opts.onEvent === 'function' ? opts.onEvent : null;

    var S = {
      board: emptyBoard(),
      bag: new Bag(rng),
      cur: null, hold: null, canHold: true,
      score: 0, lines: 0, level: opts.startLevel ? (opts.startLevel|0) : 0,
      over: false, paused: false, started: false,
      gravT: 0, lockT: 0, onGround: false,
      hi: opts.hi ? (opts.hi|0) : 0
    };

    function emit(type, data) { if (onEventFn) onEventFn(type, data || {}); }

    function collides(m, px, py) {
      for (var y = 0; y < m.length; y++) {
        for (var x = 0; x < m.length; x++) {
          if (!m[y][x]) continue;
          var bx = px + x, by = py + y;
          if (bx < 0 || bx >= COLS || by >= ROWS) return true;
          if (by >= 0 && S.board[by][bx]) return true;
        }
      }
      return false;
    }

    function spawn() {
      var type = S.bag.next();
      var p = makePiece(type);
      p.x = Math.floor((COLS - p.m.length) / 2);
      p.y = (type === 'I') ? -1 : 0;
      S.cur = p; S.canHold = true; S.onGround = false; S.lockT = 0;
      if (collides(p.m, p.x, p.y)) { S.over = true; emit('gameover', { score: S.score }); }
      else emit('spawn', { type: type });
    }

    function lockPiece() {
      var p = S.cur, m = p.m;
      for (var y = 0; y < m.length; y++)
        for (var x = 0; x < m.length; x++)
          if (m[y][x] && p.y + y >= 0) S.board[p.y + y][p.x + x] = COLOR[p.type];
      emit('lock', {});
      clearLines();
      spawn();
    }

    function clearLines() {
      var full = [];
      for (var y = 0; y < ROWS; y++) {
        var all = true;
        for (var x = 0; x < COLS; x++) if (!S.board[y][x]) { all = false; break; }
        if (all) full.push(y);
      }
      if (!full.length) return 0;
      for (var i = 0; i < full.length; i++) {
        S.board.splice(full[i], 1);
        S.board.unshift(new Array(COLS).fill(0));
      }
      var n = full.length;
      S.lines += n;
      S.score += SCORE_LINES[n] * (S.level + 1);
      var newLevel = Math.floor(S.lines / 10);
      if (newLevel > S.level) { S.level = newLevel; emit('levelup', { level: S.level }); }
      if (S.score > S.hi) S.hi = S.score;
      emit('clear', { rows: full, count: n, score: S.score });
      return n;
    }

    function tryMove(dx, dy) {
      if (!S.cur) return false;
      if (!collides(S.cur.m, S.cur.x + dx, S.cur.y + dy)) { S.cur.x += dx; S.cur.y += dy; return true; }
      return false;
    }

    function rotate(dir) {
      if (!S.cur) return false;
      var m2 = dir > 0 ? rotateCW(S.cur.m) : rotateCCW(S.cur.m);
      var kicks = [0, -1, 1, -2, 2];
      for (var i = 0; i < kicks.length; i++) {
        if (!collides(m2, S.cur.x + kicks[i], S.cur.y)) {
          S.cur.m = m2; S.cur.x += kicks[i]; emit('rotate', {}); resetLock(); return true;
        }
      }
      return false;
    }

    function resetLock() {
      if (S.cur && !collides(S.cur.m, S.cur.x, S.cur.y + 1)) { S.onGround = false; S.lockT = 0; }
    }

    function hardDrop() {
      if (!S.cur || S.over || S.paused) return;
      var d = 0;
      while (!collides(S.cur.m, S.cur.x, S.cur.y + 1)) { S.cur.y++; d++; }
      S.score += d * 2;
      emit('harddrop', { cells: d });
      lockPiece();
    }

    function hold() {
      if (!S.cur || !S.canHold || S.over || S.paused) return;
      var curType = S.cur.type;
      if (S.hold) { var h = S.hold; S.hold = curType; var p = makePiece(h); p.x = Math.floor((COLS - p.m.length)/2); p.y = (h==='I')?-1:0; S.cur = p; }
      else { S.hold = curType; spawn(); }
      S.canHold = false; emit('hold', {});
    }

    function gravMs() { var i = Math.min(S.level, GRAV.length - 1); return GRAV[i]; }

    function step(dt) { // dt в секундах
      if (!S.started || S.over || S.paused || !S.cur) return;
      var ground = collides(S.cur.m, S.cur.x, S.cur.y + 1);
      if (ground) {
        S.onGround = true; S.lockT += dt * 1000;
        if (S.lockT >= LOCK_DELAY) lockPiece();
      } else {
        S.onGround = false; S.lockT = 0;
        S.gravT += dt * 1000;
        while (S.gravT >= gravMs()) {
          S.gravT -= gravMs();
          if (!tryMove(0, 1)) break;
        }
      }
    }

    function reset() {
      S.board = emptyBoard(); S.bag = new Bag(rng); S.hold = null; S.canHold = true;
      S.score = 0; S.lines = 0; S.level = opts.startLevel ? (opts.startLevel|0) : 0;
      S.over = false; S.paused = false; S.gravT = 0; S.lockT = 0; S.onGround = false;
      S.cur = null; S.started = true; spawn(); emit('start', {});
    }

    function ghostY() {
      if (!S.cur) return 0; var y = S.cur.y;
      while (!collides(S.cur.m, S.cur.x, y + 1)) y++;
      return y;
    }

    var api = {
      COLS: COLS, ROWS: ROWS,
      start: reset, reset: reset,
      step: step,
      left: function () { if (!S.over && !S.paused && tryMove(-1,0)) { emit('move',{}); resetLock(); } },
      right: function () { if (!S.over && !S.paused && tryMove(1,0)) { emit('move',{}); resetLock(); } },
      softDrop: function () { if (!S.over && !S.paused && tryMove(0,1)) { S.score += 1; } },
      hardDrop: hardDrop,
      rotateCW: function () { if (!S.over && !S.paused) rotate(1); },
      rotateCCW: function () { if (!S.over && !S.paused) rotate(-1); },
      hold: hold,
      pause: function (v) { S.paused = (v === undefined) ? !S.paused : !!v; },
      isPaused: function () { return S.paused; },
      isOver: function () { return S.over; },
      state: function () {
        return {
          board: S.board, cur: S.cur, ghostY: ghostY(),
          next: S.bag.peek(5), hold: S.hold, canHold: S.canHold,
          score: S.score, lines: S.lines, level: S.level, hi: S.hi,
          over: S.over, paused: S.paused, started: S.started
        };
      },
      // для тестов:
      _S: S, _collides: collides, _clearLines: clearLines, _spawn: spawn
    };
    return api;
  };

  TT.consts = { COLS: COLS, ROWS: ROWS, TYPES: TYPES, COLOR: COLOR, SHAPES: SHAPES };
})(typeof window !== 'undefined' ? window : globalThis);
