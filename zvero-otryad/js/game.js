/* ============================================================================
   ЗВЕРО-ОТРЯД · движок (DOM-free, детерминированный)
   Ко-оп платформер: двое зверей-напарников бегают, прыгают, ХВАТАЮТ ЯЩИКИ и
   ШВЫРЯЮТ их во врагов. На ящик можно встать. 1–2 игрока (общий запас жизней),
   уровни-«цеха», враги двух типов и финальный босс Крыс БАК.
   Рендереры (classic/modern) и main.js только читают Z.Game.state().
   ========================================================================== */
(function (global) {
  'use strict';
  var Z = global.ZVERO = global.ZVERO || {};

  // --- геометрия мира ---
  var TILE = 30, ROWS = 20, VIEW_W = 960, VIEW_H = 600;

  // --- физика ---
  var GRAVITY = 1700, MOVE = 190, JUMP = -560, MAX_FALL = 760;
  var THROW_SPD = 430, THROW_UP = -150, BOX_GRAV = 1500;
  var INVULN = 1.5, RESPAWN_T = 0.9;
  // --- кооп: «невидимый поводок» — герои не расходятся дальше ширины экрана минус отступы ---
  var LEASH_PAD = 40, LEASH_SPAN = VIEW_W - 2 * LEASH_PAD;   // 880 px от левого края левого до правого края правого

  // --- уровни: массивы строк (ragged-строки допускаются, движок выровняет) ---
  // Легенда: # кирпич  = платформа  P старт (И2 появляется рядом с И1)  c ящик
  //          W ходок   F летун      o звезда-друг   D дверь выхода   B босс
  var LEVELS = [
    [
      '                                                ',
      '                                                ',
      '                       o                        ',
      '                     =====                      ',
      '                                                ',
      '            o      c            c       o        ',
      '          =====  ===          ===    =====       ',
      '                                                ',
      '      o        W              W         o   D    ',
      '    =====    ======        ======    =========  ',
      '                                                ',
      '          c          o           c              ',
      '   P    =====  W   =====   W   =====             ',
      '#############     ########     #################',
      '#############  o  ########  o  #################',
      '#############=====########=====#################',
      '####   c   #####################   c   #########',
      '####=======#####################=======#########',
      '################################################',
      '################################################'
    ],
    [
      '                                                      ',
      '        F                 F                  F        ',
      '              o   o   o                               ',
      '            =============       c      c              ',
      '                              =====  =====            ',
      '    o     c       W                        o     D    ',
      '  =====  ===   =======      W           =========     ',
      '                                                      ',
      '        W        c        F        c        W         ',
      '   o  ======   =====   #######   =====   ======  o     ',
      ' =====                                                ',
      '           c        o         o        c              ',
      '   P    =======  W       W       W   =======           ',
      '######        ###################        #############',
      '######   o    ###################   o    #############',
      '######========###################========#############',
      '####   c  ###############################  c  ########',
      '####======###############################======######',
      '######################################################',
      '######################################################'
    ],
    [
      '                                                            ',
      '    F          F           F           F          F         ',
      '        o  o  o                    o  o  o                   ',
      '      ===========   c    c      ===========    c      D     ',
      '                  =====  ===                 =====  =====    ',
      '   W       o              W           o            W         ',
      ' =====  ========   c   ========    ========  c  ========     ',
      '                 =====                      =====           ',
      '      F      c       F        c       F      c      F        ',
      '  o     #########   o   #########   o   #########     o      ',
      '=====                                                       ',
      '        W       W         W        W         W      W        ',
      '   c ########  =====  ########  =====  ########  ===== c      ',
      '######     ##############     ##############     ###########',
      '###### o c ##############  o  ##############  o  ###########',
      '######=====##############=====##############=====##########',
      '#### P #############################################    ####',
      '####===#############################################===####',
      '###########################################################',
      '###########################################################'
    ],
    [
      '                                                                  ',
      '                                                                  ',
      '        c                                            c             ',
      '      =====                  B                      =====          ',
      '                                                                  ',
      '   c       c                                     c        c        ',
      ' =====   =====                                 =====    =====      ',
      '                   c                   c                           ',
      '                 =====               =====                         ',
      '      o                   o                   o           o   D    ',
      '    c   c      c   c    c    c     c   c     c    c     c   c       ',
      '  ===================================================  =========   ',
      '                                                                  ',
      '                                                                  ',
      '                                                                  ',
      '###########                                       #################',
      '######## P #                                     #   ##############',
      '########===#                                     #===##############',
      '##################################################################',
      '##################################################################'
    ]
  ];

  // Выровнять строки уровня по максимальной длине (пробелами справа).
  function normalize(rows) {
    var w = 0, i;
    for (i = 0; i < rows.length; i++) if (rows[i].length > w) w = rows[i].length;
    var out = [];
    for (i = 0; i < rows.length; i++) { var r = rows[i]; while (r.length < w) r += ' '; out.push(r); }
    return { grid: out, cols: w, rows: out.length };
  }

  function solidChar(c) { return c === '#' || c === '='; }

  Z.Game = function (opts) {
    opts = opts || {};
    var emit = opts.onEvent || function () {};

    var S = {
      phase: 'title',   // title | play | dying | levelclear | gameover | win
      paused: false,
      level: 0,
      lives: 5,
      score: 0,
      hi: opts.hi || 0,
      twoP: !!opts.twoP,
      tile: TILE, rows: ROWS, cols: 0, pixelW: 0, pixelH: ROWS * TILE,
      viewW: VIEW_W, viewH: VIEW_H,
      grid: [],
      players: [],
      boxes: [],
      enemies: [],
      pickups: [],
      particles: [],
      boss: null,
      door: null,
      camX: 0,
      intro: 0,           // показ баннера «ЦЕХ N» в начале
      banner: 0,          // общий таймер фаз-переходов
      hold: [ { left: false, right: false }, { left: false, right: false } ]
    };

    // ---------- загрузка уровня ----------
    function loadLevel(idx) {
      var n = normalize(LEVELS[idx].map(function (r) { return r; }));
      S.grid = n.grid; S.cols = n.cols; S.rows = n.rows;
      S.pixelW = n.cols * TILE; S.pixelH = n.rows * TILE;
      S.boxes = []; S.enemies = []; S.pickups = []; S.particles = [];
      S.door = null; S.boss = null;
      var spawn = [ { x: TILE, y: (n.rows - 3) * TILE }, { x: TILE * 3, y: (n.rows - 3) * TILE } ];
      for (var r = 0; r < n.rows; r++) {
        var row = n.grid[r];
        for (var c = 0; c < n.cols; c++) {
          var ch = row[c], wx = c * TILE, wy = r * TILE;
          if (ch === 'P') spawn[0] = { x: wx + 4, y: wy - 2 };
          else if (ch === 'c') S.boxes.push(makeBox(wx + 2, wy + 4));
          else if (ch === 'W') S.enemies.push(makeWalker(wx, wy));
          else if (ch === 'F') S.enemies.push(makeFlyer(wx, wy));
          else if (ch === 'o') S.pickups.push({ kind: 'star', x: wx + TILE / 2, y: wy + TILE / 2, r: 9, t: Math.random() * 6 });
          else if (ch === 'D') S.door = { col: c, row: r, x: wx, y: (r - 1) * TILE, w: TILE, h: TILE * 2, open: idx < LEVELS.length - 1 };
          else if (ch === 'B') S.boss = makeBoss(wx, wy);
        }
      }
      if (!S.door) S.door = { col: n.cols - 2, row: n.rows - 3, x: (n.cols - 2) * TILE, y: (n.rows - 4) * TILE, w: TILE, h: TILE * 2, open: idx < LEVELS.length - 1 };
      // игроки: И2 — рядом с И1 (оба в кадре с первого кадра цеха)
      spawn[1] = partnerSpawn(spawn[0]);
      S.spawn = spawn;
      var count = S.twoP ? 2 : 1;
      S.players = [];
      for (var i = 0; i < count; i++) S.players.push(makePlayer(spawn[i].x, spawn[i].y, i));
      updateCam();
    }

    // Точка появления напарника: ближайшая к И1 клетка той же высоты, где герой не в стене и
    // под ногами опора. Сначала вправо на ширину героя, затем влево, дальше — шире.
    function partnerSpawn(s0) {
      var W = 22, H = 28, offs = [28, -28, 56, -56, 84, -84, 112, -112];
      for (var i = 0; i < offs.length; i++) {
        var x = s0.x + offs[i];
        if (x < 0 || x + W > S.pixelW) continue;
        var c0 = Math.floor(x / TILE), c1 = Math.floor((x + W - 1) / TILE), row = Math.floor((s0.y + H - 1) / TILE), ok = true;
        for (var c = c0; c <= c1; c++) if (solidChar(tileAt(c, row)) || !solidChar(tileAt(c, row + 1))) ok = false;
        if (ok) return { x: x, y: s0.y };
      }
      return { x: s0.x, y: s0.y };
    }

    function makePlayer(x, y, id) {
      return { id: id, x: x, y: y, w: 22, h: 28, vx: 0, vy: 0, dir: 1,
        onGround: false, invuln: INVULN, walkT: 0, carry: null, respawn: 0, alive: true };
    }
    function makeBox(x, y) { return { x: x, y: y, w: 26, h: 26, vx: 0, vy: 0, held: false, thrown: false, onGround: false, carrier: -1 }; }
    function makeWalker(wx, wy) { return { type: 'walker', x: wx + 2, y: wy + TILE - 24, w: 26, h: 24, vx: -58, dir: -1, t: Math.random() * 6 }; }
    function makeFlyer(wx, wy) { return { type: 'flyer', x: wx + 3, y: wy + 2, w: 24, h: 20, baseY: wy + TILE / 2, t: Math.random() * 6, dir: -1 }; }
    function makeBoss(wx, wy) {
      return { type: 'boss', x: wx, y: wy, w: 58, h: 56, vx: 95, dir: 1, hp: 6, hpMax: 6, t: 0, hitFlash: 0, baseY: wy };
    }

    // ---------- тайловые помощники ----------
    function tileAt(col, row) {
      if (col < 0 || col >= S.cols || row < 0 || row >= S.rows) return row >= S.rows ? '#' : ' ';
      return S.grid[row][col];
    }
    function solidAtPx(px, py) { return solidChar(tileAt(Math.floor(px / TILE), Math.floor(py / TILE))); }
    function rectSolid(x, y, w, h) {
      var c0 = Math.floor(x / TILE), c1 = Math.floor((x + w - 1) / TILE);
      var r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 1) / TILE);
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (solidChar(tileAt(c, r))) return true;
      return false;
    }
    function aabb(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

    // Покоящийся ящик, на котором стоит игрок, работает как платформа.
    function restingBoxTop(a, dx) {
      // ищем ящик, на который можно приземлиться (верхняя грань)
      for (var i = 0; i < S.boxes.length; i++) {
        var bx = S.boxes[i]; if (bx.held || bx.thrown) continue;
        if (a.x + dx < bx.x + bx.w && a.x + a.w + dx > bx.x && a.y + a.h <= bx.y + 10 && a.y + a.h + (a.vy > 0 ? a.vy * 0.02 + 6 : 6) >= bx.y)
          return bx;
      }
      return null;
    }

    // ---------- движение актёра (игрок) с раздельными осями + стойка на ящике ----------
    function moveActor(a, dx, dy) {
      if (dx !== 0) {
        a.x += dx;
        if (rectSolid(a.x, a.y, a.w, a.h)) {
          if (dx > 0) a.x = Math.floor((a.x + a.w) / TILE) * TILE - a.w - 0.01;
          else a.x = (Math.floor(a.x / TILE) + 1) * TILE + 0.01;
          a.vx = 0;
        }
      }
      a.onGround = false;
      if (dy !== 0) {
        a.y += dy;
        if (rectSolid(a.x, a.y, a.w, a.h)) {
          if (dy > 0) { a.y = Math.floor((a.y + a.h) / TILE) * TILE - a.h - 0.01; a.onGround = true; }
          else a.y = (Math.floor(a.y / TILE) + 1) * TILE + 0.01;
          a.vy = 0;
        } else if (dy > 0) {
          // приземление на покоящийся ящик
          var bx = restingBoxTop(a, 0);
          if (bx) { a.y = bx.y - a.h - 0.01; a.vy = 0; a.onGround = true; }
        }
      }
    }

    // Поводок: перемещение героя по X урезается так, чтобы пара умещалась в LEASH_SPAN.
    // Срезается только сделанный за шаг сдвиг (не дальше старой позиции) — героя не «телепортирует» в стену.
    function leash(p, oldX) {
      if (S.players.length < 2 || !p.alive) return;
      var o = S.players[1 - p.id]; if (!o || !o.alive) return;
      var hi = o.x + LEASH_SPAN - p.w, lo = o.x + o.w - LEASH_SPAN;
      if (p.x > hi && p.x > oldX) { p.x = Math.max(oldX, hi); p.vx = 0; p.leashed = true; }
      else if (p.x < lo && p.x < oldX) { p.x = Math.min(oldX, lo); p.vx = 0; p.leashed = true; }
    }

    function updateCam() {
      var sx = 0, nn = 0, i;
      for (i = 0; i < S.players.length; i++) if (S.players[i].alive) { sx += S.players[i].x + S.players[i].w / 2; nn++; }
      var cx = (nn ? sx / nn : VIEW_W / 2) - VIEW_W / 2;
      S.camX = Math.max(0, Math.min(cx, Math.max(0, S.pixelW - VIEW_W)));
    }

    // ---------- действия игрока ----------
    function jump(pi) {
      if (S.phase !== 'play' || S.paused || S.intro > 0) return;
      var p = S.players[pi]; if (!p || !p.alive) return;
      if (p.onGround) { p.vy = JUMP; p.onGround = false; emit('jump'); }
    }
    // Схватить ближайший ящик или бросить тот, что в руках.
    function action(pi) {
      if (S.phase !== 'play' || S.paused || S.intro > 0) return;
      var p = S.players[pi]; if (!p || !p.alive) return;
      if (p.carry) {
        var bx = p.carry; p.carry = null; bx.held = false; bx.carrier = -1; bx.thrown = true;
        bx.vx = p.dir * THROW_SPD; bx.vy = THROW_UP; emit('throw'); return;
      }
      // найти ближайший свободный ящик в радиусе
      var best = null, bd = 44 * 44;
      for (var i = 0; i < S.boxes.length; i++) {
        var b = S.boxes[i]; if (b.held || b.thrown) continue;
        var dx = (b.x + b.w / 2) - (p.x + p.w / 2), dy = (b.y + b.h / 2) - (p.y + p.h / 2);
        var d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = b; }
      }
      if (best) { best.held = true; best.thrown = false; best.carrier = pi; best.vx = 0; best.vy = 0; p.carry = best; emit('grab'); }
    }

    // ---------- урон / жизни ----------
    function hurtPlayer(p) {
      if (!p || !p.alive || p.invuln > 0 || p.respawn > 0) return;
      S.lives--; emit('hurt');
      if (p.carry) { p.carry.held = false; p.carry.carrier = -1; p.carry.thrown = false; p.carry = null; }
      if (S.lives <= 0) { S.phase = 'gameover'; S.banner = 0; emit('gameover', { score: S.score }); return; }
      p.respawn = RESPAWN_T; p.alive = false;
    }
    function respawnPlayer(p) {
      // возродить рядом с живым напарником или на старте
      var ally = null, i;
      for (i = 0; i < S.players.length; i++) if (S.players[i] !== p && S.players[i].alive) ally = S.players[i];
      if (ally) { p.x = Math.min(ally.x + 30, S.pixelW - p.w - 4); p.y = ally.y - 20; }
      else { p.x = TILE + p.id * 40; p.y = (S.rows - 4) * TILE; }
      p.vx = 0; p.vy = 0; p.alive = true; p.invuln = INVULN; p.carry = null;
    }

    function allDown() { for (var i = 0; i < S.players.length; i++) if (S.players[i].alive) return false; return true; }

    function nextLevel() {
      if (S.level + 1 >= LEVELS.length) { S.phase = 'win'; emit('win', { score: S.score }); return; }
      S.level++; loadLevel(S.level); S.phase = 'play'; S.intro = 1.1;
    }

    // ---------- обновление сущностей ----------
    function stepPlayers(dt) {
      for (var i = 0; i < S.players.length; i++) {
        var p = S.players[i];
        if (!p.alive) { if (p.respawn > 0) { p.respawn -= dt; if (p.respawn <= 0) respawnPlayer(p); } continue; }
        var ax = 0, h = S.hold[i];
        if (h.left) { ax -= 1; p.dir = -1; }
        if (h.right) { ax += 1; p.dir = 1; }
        p.vx = ax * MOVE; p.leashed = false;
        p.vy += GRAVITY * dt; if (p.vy > MAX_FALL) p.vy = MAX_FALL;
        var oldX = p.x;
        moveActor(p, p.vx * dt, 0);
        leash(p, oldX);
        // края мира — стены: герой не уходит за левый/правый край карты (раньше падал в пустоту за кадром)
        if (p.x < 0) { p.x = 0; p.vx = 0; } else if (p.x + p.w > S.pixelW) { p.x = S.pixelW - p.w; p.vx = 0; }
        moveActor(p, 0, p.vy * dt);
        if (ax !== 0 && p.onGround) p.walkT += dt * 10; else p.walkT = 0;
        if (p.invuln > 0) p.invuln -= dt;
        // ящик в руках следует за головой
        if (p.carry) { p.carry.x = p.x + p.w / 2 - p.carry.w / 2; p.carry.y = p.y - p.carry.h - 2; }
        if (p.y > S.pixelH + 60) { hurtPlayer(p); }
      }
      updateCam();
    }

    function nearestPlayer(x) {
      var best = null, bd = Infinity;
      for (var i = 0; i < S.players.length; i++) { var p = S.players[i]; if (!p.alive) continue; var d = Math.abs(p.x - x); if (d < bd) { bd = d; best = p; } }
      return best;
    }

    function stepEnemies(dt) {
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; e.t += dt;
        if (e.type === 'walker') {
          var nx = e.x + e.vx * dt;
          var probeX = e.vx < 0 ? nx : nx + e.w;
          var wall = solidAtPx(probeX, e.y + e.h / 2);
          var footX = e.vx < 0 ? nx + 2 : nx + e.w - 2;
          var ground = solidAtPx(footX, e.y + e.h + 2);
          if (wall || !ground || nx < 0 || nx + e.w > S.pixelW) { e.vx = -e.vx; e.dir = -e.dir; }
          else e.x = nx;
        } else {
          var tgt = nearestPlayer(e.x);
          var toward = tgt ? Math.sign((tgt.x + tgt.w / 2) - (e.x + e.w / 2)) : e.dir;
          e.dir = toward || e.dir;
          e.x += toward * 48 * dt;
          if (e.x < 0) e.x = 0; if (e.x + e.w > S.pixelW) e.x = S.pixelW - e.w;
          e.y = e.baseY - e.h / 2 + Math.sin(e.t * 2.4) * 22;
        }
        for (var j = 0; j < S.players.length; j++) if (S.players[j].alive && aabb(S.players[j], e)) hurtPlayer(S.players[j]);
      }
    }

    function stepBoss(dt) {
      var b = S.boss; if (!b) return;
      b.t += dt; if (b.hitFlash > 0) b.hitFlash -= dt;
      var nx = b.x + b.vx * dt;
      if (nx < TILE || nx + b.w > S.pixelW - TILE) { b.vx = -b.vx; b.dir = -b.dir; nx = b.x + b.vx * dt; }
      b.x = nx; b.y = b.baseY + Math.sin(b.t * 2) * 8;
      for (var j = 0; j < S.players.length; j++) if (S.players[j].alive && aabb(S.players[j], b)) hurtPlayer(S.players[j]);
    }

    function hitBoss() {
      var b = S.boss; if (!b || b.hitFlash > 0.25) return;
      b.hp--; b.hitFlash = 0.4; S.score += 150; emit('bosshit');
      spawnBurst(b.x + b.w / 2, b.y + b.h / 2, 3);
      if (b.hp <= 0) { S.score += 500; S.boss = null; if (S.door) S.door.open = true; emit('smash'); }
    }

    function stepBoxes(dt) {
      for (var i = S.boxes.length - 1; i >= 0; i--) {
        var b = S.boxes[i];
        if (b.held) continue;
        if (b.thrown) {
          b.vy += BOX_GRAV * dt;
          b.x += b.vx * dt; b.y += b.vy * dt;
          var broke = false;
          if (b.x < 0 || b.x + b.w > S.pixelW || rectSolid(b.x, b.y, b.w, b.h) || solidAtPx(b.x + b.w / 2, b.y + b.h / 2)) broke = true;
          // попадание по врагам
          for (var j = S.enemies.length - 1; j >= 0 && !broke; j--) {
            if (aabb(b, S.enemies[j])) { spawnBurst(S.enemies[j].x + 12, S.enemies[j].y + 12, 10); S.enemies.splice(j, 1); S.score += 100; emit('smash'); broke = true; }
          }
          // попадание по боссу
          if (!broke && S.boss && aabb(b, S.boss)) { hitBoss(); broke = true; }
          if (broke) { spawnBurst(b.x + b.w / 2, b.y + b.h / 2, 8); S.boxes.splice(i, 1); }
        } else {
          // покоится: гравитация до опоры
          b.vy += BOX_GRAV * dt; if (b.vy > MAX_FALL) b.vy = MAX_FALL;
          b.y += b.vy * dt;
          if (rectSolid(b.x, b.y, b.w, b.h)) {
            b.y = Math.floor((b.y + b.h) / TILE) * TILE - b.h - 0.01; b.vy = 0; b.onGround = true;
          }
        }
      }
    }

    function stepPickups(dt) {
      for (var i = S.pickups.length - 1; i >= 0; i--) {
        var k = S.pickups[i]; k.t += dt;
        for (var j = 0; j < S.players.length; j++) {
          var p = S.players[j]; if (!p.alive) continue;
          if (p.x < k.x + k.r && p.x + p.w > k.x - k.r && p.y < k.y + k.r && p.y + p.h > k.y - k.r) {
            S.score += 50; emit('pickup'); S.pickups.splice(i, 1); break;
          }
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
    function spawnBurst(x, y, cnt) {
      cnt = cnt || 10;
      for (var i = 0; i < cnt; i++) {
        var a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 150;
        S.particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.4 + Math.random() * 0.3, c: i % 3 });
      }
    }

    function checkDoor() {
      var d = S.door; if (!d || !d.open) return;
      for (var i = 0; i < S.players.length; i++) {
        var p = S.players[i]; if (!p.alive) continue;
        if (p.x < d.x + d.w && p.x + p.w > d.x && p.y < d.y + d.h && p.y + p.h > d.y) {
          S.phase = 'levelclear'; S.banner = 1.2; emit('door'); return;
        }
      }
    }

    // ---------- главный шаг ----------
    function step(dt) {
      if (dt > 0.05) dt = 0.05;
      if (S.paused) return;
      if (S.phase === 'play') {
        if (S.intro > 0) { S.intro -= dt; return; }
        stepPlayers(dt);
        if (S.phase !== 'play') return;
        stepEnemies(dt);
        if (S.phase !== 'play') return;
        stepBoss(dt);
        if (S.phase !== 'play') return;
        stepBoxes(dt);
        stepPickups(dt);
        stepParticles(dt);
        if (allDown() && S.players.length) { /* обрабатывается через hurtPlayer/respawn */ }
        checkDoor();
      } else if (S.phase === 'levelclear') {
        stepParticles(dt);
        S.banner -= dt; if (S.banner <= 0) nextLevel();
      }
    }

    // ---------- публичный API ----------
    var api = {
      start: function () {
        S.phase = 'play'; S.paused = false; S.level = 0; S.lives = 5; S.score = 0;
        loadLevel(0); S.intro = 1.1; S.banner = 0;
      },
      update: step,
      step: step,
      state: function () { return S; },
      setHeld: function (pi, name, down) { if (S.hold[pi] && (name === 'left' || name === 'right')) S.hold[pi][name] = !!down; },
      jump: jump,
      action: action,
      setTwoP: function (on) { S.twoP = !!on; },
      isTwoP: function () { return S.twoP; },
      pause: function () { if (S.phase === 'play' || S.phase === 'levelclear') S.paused = !S.paused; },
      isPaused: function () { return S.paused; },
      phase: function () { return S.phase; },
      setHi: function (v) { S.hi = v; }
    };
    return api;
  };

  Z.consts = { TILE: TILE, ROWS: ROWS, VIEW_W: VIEW_W, VIEW_H: VIEW_H, LEASH_PAD: LEASH_PAD, LEASH_SPAN: LEASH_SPAN, LEVELS: LEVELS.length };
})(typeof window !== 'undefined' ? window : globalThis);
