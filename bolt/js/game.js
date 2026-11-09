/* ============================================================================
   БОЛТ · движок (DOM-free, детерминированный)
   Ран-н-ган платформер: бег, прыжки (гравитация + платформы), стрельба по
   пришельцам, выход через дверь сектора. 3 жизни, очки, таймер заряда батареи.
   Рендереры (classic/modern) и main.js только читают B.Game.state().
   ========================================================================== */
(function (global) {
  'use strict';
  var B = global.BOLT = global.BOLT || {};

  // --- геометрия мира ---
  var TILE = 30;            // размер клетки в «мировых» пикселях
  var ROWS = 20;            // высота уровня в клетках (20*30 = 600 = высота канвы)
  var VIEW_W = 960, VIEW_H = 600;

  // --- физика ---
  var GRAVITY = 1700, MOVE = 205, JUMP = -560, MAX_FALL = 780;
  var BULLET_SPD = 470, SHOOT_CD = 0.22, BULLET_LIFE = 0.9;
  var CHARGE_MAX = 100, CHARGE_RATE = 6.5;   // расход заряда в секунду
  var INVULN = 1.4;                          // неуязвимость после респавна

  // --- уровни: массивы строк (ragged-строки допускаются, движок выровняет) ---
  // Легенда: # кирпич  = платформа  P старт  W ходок  F летун
  //          o очко    b батарея    D дверь выхода   (пробел — пусто)
  var LEVELS = [
    [
      '                                                ',
      '                                                ',
      '                                                ',
      '                              o                 ',
      '                            =====               ',
      '                                                ',
      '              o        F                        ',
      '            =====                          o    ',
      '                              b         =====   ',
      '                                                ',
      '       o          =====              o          ',
      '     =====                 W      =====         ',
      '                                                ',
      '                 W            o            D    ',
      '####     ####################     ##############',
      '####     ####################     ##############',
      '####  o  ####################  b  ##############',
      '####=====####################=====##############',
      'P###########################################  ##',
      '################################################'
    ],
    [
      '                                                      ',
      '                          o   o   o                   ',
      '                        =============                 ',
      '            F                            F            ',
      '                                                      ',
      '     o        b                       o        D      ',
      '   =====   =======        W         =====   =======   ',
      '                                                      ',
      '              W         o        W          o         ',
      '         ##########   =====   ##########   =====      ',
      '                                                      ',
      '   o           F                    b                 ',
      ' =====      ########     W     ########       o       ',
      '                                           =====      ',
      '        W            b              W                 ',
      '#####       ##################       #################',
      '#####   o   ##################   o   #################',
      '#####=======##################=======#################',
      'P#####################################################',
      '######################################################'
    ],
    [
      '                                                            ',
      '     F              F              F              F         ',
      '          o   o                         o    o              ',
      '        =========        b            =========       D     ',
      '                      =======                      =====    ',
      '   W         o                   W          o               ',
      ' =====   ========       W     ========    ========          ',
      '                                                            ',
      '        F         o         F         o         F           ',
      '   o        ##########  b  ##########  b  ##########         ',
      ' =====                                                      ',
      '         W          W           W          W                ',
      '    ##########   =======   ##########   =======   =====     ',
      '                                                            ',
      '       b         o          W          o         b          ',
      '####      #############        #############      ##########',
      '####  o   #############   o    #############  o   ##########',
      '####======#############=======#############======##########',
      'P##########################################################',
      '###########################################################'
    ],
    [
      '                                                                  ',
      '   F        F        F        F        F        F        F        ',
      '      o o o      b         o o o          b         o o o   D      ',
      '    =========   =====    =========     =====     =========  ====   ',
      '                                                                  ',
      ' W       o         W         o        W         o        W        ',
      '=====  ======   ======    ======   ======   ======    ======      ',
      '                                                                  ',
      '     F       o       F       o       F       o       F            ',
      '  o     ########   b    ########   b    ########   b    #####      ',
      '=====                                                             ',
      '      W       W        W       W        W       W       W          ',
      '   ########  =====  ########  =====  ########  =====  ########     ',
      '                                                                  ',
      '    b      o      W       b      o     W      b      o             ',
      '###    ###############    ###############   ###############        ',
      '### o  ###############  o ###############  o ###############       ',
      '###====###############====###############====###############      ',
      'P#################################################################',
      '##################################################################'
    ]
  ];

  // Выровнять строки уровня по максимальной длине (пробелами справа).
  function normalize(rows) {
    var w = 0, i;
    for (i = 0; i < rows.length; i++) if (rows[i].length > w) w = rows[i].length;
    var out = [];
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      while (r.length < w) r += ' ';
      out.push(r);
    }
    return { grid: out, cols: w, rows: out.length };
  }

  function solidChar(c) { return c === '#' || c === '='; }

  B.Game = function (opts) {
    opts = opts || {};
    var emit = opts.onEvent || function () {};

    var S = {
      phase: 'title',   // title | play | dying | levelclear | gameover | win
      paused: false,
      level: 0,
      lives: 3,
      score: 0,
      hi: opts.hi || 0,
      charge: CHARGE_MAX,
      chargeMax: CHARGE_MAX,
      tile: TILE, rows: ROWS, cols: 0, pixelW: 0, pixelH: ROWS * TILE,
      viewW: VIEW_W, viewH: VIEW_H,
      grid: [],
      player: null,
      bullets: [],
      enemies: [],
      pickups: [],
      particles: [],
      door: null,
      camX: 0,
      intro: 0,           // показ баннера «СЕКТОР N» в начале
      banner: 0,          // общий таймер фаз-переходов
      shootCd: 0,
      hold: { left: false, right: false }
    };

    // ---------- загрузка уровня ----------
    function loadLevel(idx) {
      var n = normalize(LEVELS[idx].map(function (r) { return r; }));
      S.grid = n.grid; S.cols = n.cols; S.rows = n.rows;
      S.pixelW = n.cols * TILE; S.pixelH = n.rows * TILE;
      S.bullets = []; S.enemies = []; S.pickups = []; S.particles = [];
      S.door = null;
      var spawn = { x: TILE, y: (n.rows - 3) * TILE };
      for (var r = 0; r < n.rows; r++) {
        var row = n.grid[r];
        for (var c = 0; c < n.cols; c++) {
          var ch = row[c];
          var wx = c * TILE, wy = r * TILE;
          if (ch === 'P') spawn = { x: wx + 3, y: wy - 2 };
          else if (ch === 'W') S.enemies.push(makeWalker(wx, wy));
          else if (ch === 'F') S.enemies.push(makeFlyer(wx, wy));
          else if (ch === 'o') S.pickups.push({ kind: 'coin', x: wx + TILE / 2, y: wy + TILE / 2, r: 7, t: Math.random() * 6 });
          else if (ch === 'b') S.pickups.push({ kind: 'battery', x: wx + TILE / 2, y: wy + TILE / 2, r: 10, t: Math.random() * 6 });
          else if (ch === 'D') S.door = { col: c, row: r, x: wx, y: (r - 1) * TILE, w: TILE, h: TILE * 2 };
        }
      }
      if (!S.door) S.door = { col: n.cols - 2, row: n.rows - 3, x: (n.cols - 2) * TILE, y: (n.rows - 4) * TILE, w: TILE, h: TILE * 2 };
      S.player = {
        x: spawn.x, y: spawn.y, w: 20, h: 28,
        vx: 0, vy: 0, dir: 1, onGround: false, invuln: INVULN, walkT: 0
      };
      S.charge = CHARGE_MAX;
      updateCam();
    }

    function makeWalker(wx, wy) {
      return { type: 'walker', x: wx + 2, y: wy + TILE - 24, w: 26, h: 24, vx: -62, dir: -1, t: Math.random() * 6, dead: false };
    }
    function makeFlyer(wx, wy) {
      return { type: 'flyer', x: wx + 3, y: wy + 2, w: 24, h: 20, baseY: wy + TILE / 2, t: Math.random() * 6, dir: -1, dead: false };
    }

    // ---------- тайловые помощники ----------
    function tileAt(col, row) {
      if (col < 0 || col >= S.cols || row < 0 || row >= S.rows) return row >= S.rows ? '#' : ' ';
      return S.grid[row][col];
    }
    function solidAtPx(px, py) {
      var col = Math.floor(px / TILE), row = Math.floor(py / TILE);
      return solidChar(tileAt(col, row));
    }
    // Пересечение AABB с твёрдыми клетками.
    function rectSolid(x, y, w, h) {
      var c0 = Math.floor(x / TILE), c1 = Math.floor((x + w - 1) / TILE);
      var r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 1) / TILE);
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (solidChar(tileAt(c, r))) return true;
      return false;
    }

    // ---------- движение игрока с раздельным разрешением осей ----------
    function moveActor(a, dx, dy) {
      // X
      if (dx !== 0) {
        a.x += dx;
        if (rectSolid(a.x, a.y, a.w, a.h)) {
          if (dx > 0) a.x = Math.floor((a.x + a.w) / TILE) * TILE - a.w - 0.01;
          else a.x = (Math.floor(a.x / TILE) + 1) * TILE + 0.01;
          a.vx = 0;
        }
      }
      // Y
      a.onGround = false;
      if (dy !== 0) {
        a.y += dy;
        if (rectSolid(a.x, a.y, a.w, a.h)) {
          if (dy > 0) { a.y = Math.floor((a.y + a.h) / TILE) * TILE - a.h - 0.01; a.onGround = true; }
          else a.y = (Math.floor(a.y / TILE) + 1) * TILE + 0.01;
          a.vy = 0;
        }
      }
    }

    function updateCam() {
      var cx = S.player.x + S.player.w / 2 - VIEW_W / 2;
      S.camX = Math.max(0, Math.min(cx, Math.max(0, S.pixelW - VIEW_W)));
    }

    // ---------- действия игрока ----------
    function jump() {
      if (S.phase !== 'play' || S.paused || S.intro > 0) return;
      var p = S.player;
      if (p.onGround) { p.vy = JUMP; p.onGround = false; emit('jump'); }
    }
    function shoot() {
      if (S.phase !== 'play' || S.paused || S.intro > 0) return;
      if (S.shootCd > 0) return;
      var p = S.player;
      S.bullets.push({ x: p.x + p.w / 2 + p.dir * 12, y: p.y + 10, vx: BULLET_SPD * p.dir, dir: p.dir, life: BULLET_LIFE });
      S.shootCd = SHOOT_CD; emit('shoot');
    }

    // ---------- урон / жизни ----------
    function hurtPlayer() {
      if (S.player.invuln > 0) return;
      S.lives--; emit('hurt');
      if (S.lives <= 0) { S.phase = 'gameover'; S.banner = 0; emit('gameover', { score: S.score }); }
      else { S.phase = 'dying'; S.banner = 1.0; }
    }

    function respawn() {
      loadLevel(S.level);
      S.phase = 'play'; S.intro = 1.1;
    }

    function nextLevel() {
      if (S.level + 1 >= LEVELS.length) { S.phase = 'win'; emit('win', { score: S.score }); return; }
      S.level++; loadLevel(S.level); S.phase = 'play'; S.intro = 1.1;
    }

    // ---------- обновление сущностей ----------
    function stepPlayer(dt) {
      var p = S.player;
      var ax = 0;
      if (S.hold.left) { ax -= 1; p.dir = -1; }
      if (S.hold.right) { ax += 1; p.dir = 1; }
      p.vx = ax * MOVE;
      p.vy += GRAVITY * dt; if (p.vy > MAX_FALL) p.vy = MAX_FALL;
      moveActor(p, p.vx * dt, 0);
      moveActor(p, 0, p.vy * dt);
      if (ax !== 0 && p.onGround) p.walkT += dt * 10; else p.walkT = 0;
      if (p.invuln > 0) p.invuln -= dt;
      // падение в бездну
      if (p.y > S.pixelH + 60) { hurtPlayer(); return; }
      updateCam();
    }

    function stepEnemies(dt) {
      var p = S.player;
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; e.t += dt;
        if (e.type === 'walker') {
          var nx = e.x + e.vx * dt;
          // стена впереди?
          var probeX = e.vx < 0 ? nx : nx + e.w;
          var wall = solidAtPx(probeX, e.y + e.h / 2);
          // есть ли земля впереди (чтобы не падать)?
          var footX = e.vx < 0 ? nx + 2 : nx + e.w - 2;
          var ground = solidAtPx(footX, e.y + e.h + 2);
          if (wall || !ground || nx < 0 || nx + e.w > S.pixelW) { e.vx = -e.vx; e.dir = -e.dir; }
          else e.x = nx;
        } else { // flyer — дрейф к игроку + покачивание
          var tx = p.x + p.w / 2;
          var toward = Math.sign(tx - (e.x + e.w / 2));
          e.dir = toward || e.dir;
          e.x += toward * 52 * dt;
          if (e.x < 0) e.x = 0; if (e.x + e.w > S.pixelW) e.x = S.pixelW - e.w;
          e.y = e.baseY - e.h / 2 + Math.sin(e.t * 2.4) * 22;
        }
        // контакт с игроком
        if (aabb(p, e)) hurtPlayer();
      }
    }

    function stepBullets(dt) {
      for (var i = S.bullets.length - 1; i >= 0; i--) {
        var b = S.bullets[i];
        b.x += b.vx * dt; b.life -= dt;
        var hit = b.life <= 0 || b.x < 0 || b.x > S.pixelW || solidAtPx(b.x, b.y);
        if (!hit) {
          for (var j = 0; j < S.enemies.length; j++) {
            var e = S.enemies[j];
            if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
              S.enemies.splice(j, 1); S.score += 100; spawnBurst(e.x + e.w / 2, e.y + e.h / 2);
              emit('explode'); hit = true; break;
            }
          }
        }
        if (hit) S.bullets.splice(i, 1);
      }
    }

    function stepPickups(dt) {
      var p = S.player;
      for (var i = S.pickups.length - 1; i >= 0; i--) {
        var k = S.pickups[i]; k.t += dt;
        if (p.x < k.x + k.r && p.x + p.w > k.x - k.r && p.y < k.y + k.r && p.y + p.h > k.y - k.r) {
          if (k.kind === 'battery') { S.charge = Math.min(CHARGE_MAX, S.charge + 42); S.score += 25; emit('battery'); }
          else { S.score += 50; emit('pickup'); }
          S.pickups.splice(i, 1);
        }
      }
    }

    function stepParticles(dt) {
      for (var i = S.particles.length - 1; i >= 0; i--) {
        var pp = S.particles[i];
        pp.vy += 600 * dt; pp.x += pp.vx * dt; pp.y += pp.vy * dt; pp.life -= dt;
        if (pp.life <= 0) S.particles.splice(i, 1);
      }
    }
    function spawnBurst(x, y) {
      for (var i = 0; i < 10; i++) {
        var a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 140;
        S.particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.4 + Math.random() * 0.3, c: i % 2 });
      }
    }

    function aabb(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

    function checkDoor() {
      var p = S.player, d = S.door;
      if (p.x < d.x + d.w && p.x + p.w > d.x && p.y < d.y + d.h && p.y + p.h > d.y) {
        S.phase = 'levelclear'; S.banner = 1.2; emit('door');
      }
    }

    // ---------- главный шаг ----------
    function step(dt) {
      if (dt > 0.05) dt = 0.05; // анти-скачок
      if (S.paused) return;
      if (S.phase === 'play') {
        if (S.intro > 0) { S.intro -= dt; return; }
        if (S.shootCd > 0) S.shootCd -= dt;
        // заряд батареи
        S.charge -= CHARGE_RATE * dt;
        if (S.charge <= 0) { S.charge = CHARGE_MAX; hurtPlayer(); return; }
        stepPlayer(dt);
        if (S.phase !== 'play') return;
        stepEnemies(dt);
        if (S.phase !== 'play') return;
        stepBullets(dt);
        stepPickups(dt);
        stepParticles(dt);
        checkDoor();
      } else if (S.phase === 'dying') {
        stepParticles(dt);
        S.banner -= dt; if (S.banner <= 0) respawn();
      } else if (S.phase === 'levelclear') {
        S.banner -= dt; if (S.banner <= 0) nextLevel();
      }
    }

    // ---------- публичный API ----------
    var api = {
      start: function () {
        S.phase = 'play'; S.paused = false; S.level = 0; S.lives = 3; S.score = 0;
        loadLevel(0); S.intro = 1.1; S.banner = 0;
      },
      update: step,
      step: step,
      state: function () { return S; },
      setHeld: function (name, down) { if (name === 'left' || name === 'right') S.hold[name] = !!down; },
      jump: jump,
      shoot: shoot,
      pause: function () { if (S.phase === 'play' || S.phase === 'levelclear') S.paused = !S.paused; },
      isPaused: function () { return S.paused; },
      phase: function () { return S.phase; },
      setHi: function (v) { S.hi = v; }
    };
    return api;
  };

  // Константы для рендереров (общая геометрия).
  B.consts = { TILE: TILE, ROWS: ROWS, VIEW_W: VIEW_W, VIEW_H: VIEW_H };
})(typeof window !== 'undefined' ? window : globalThis);
