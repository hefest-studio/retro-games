/* ============================================================================
   ПЛАЩ · движок (DOM-free, детерминированный)
   Экшен-платформер: бег, прыжки, метание сюрикенов, ПРИСЕД (уклон от пуль)
   и КРЮК-КОШКА (вис на потолочных крюках, раскачка, подтяг). Враги-бандиты,
   стрелки, летуны, финальный босс — Барон. Рендереры (classic/modern) и
   main.js только читают P.Game.state().
   ========================================================================== */
(function (global) {
  'use strict';
  var P = global.PLASHCH = global.PLASHCH || {};

  // --- геометрия мира ---
  var TILE = 30;            // размер клетки в «мировых» пикселях
  var ROWS = 20;            // высота уровня в клетках (20*30 = 600 = высота канвы)
  var VIEW_W = 960, VIEW_H = 600;

  // --- физика ---
  var GRAVITY = 1700, MOVE = 205, JUMP = -560, MAX_FALL = 820, AIR_SPD = 520;
  var CROUCH_MOVE = 82;
  var BULLET_SPD = 520, SHOOT_CD = 0.22, BULLET_LIFE = 1.0;
  var EBULLET_SPD = 265, EBULLET_LIFE = 3.4;
  var INVULN = 1.3;
  var HP_MAX = 3;
  var STAND_H = 28, CROUCH_H = 16, PW = 20;
  // крюк-кошка (маятник)
  var GRAPPLE_RANGE = 215, PEND_G = 2400, SWING = 3.3, CLIMB = 135;
  var MIN_LEN = 34, MAX_LEN = 250, ROPE_DAMP = 0.45;

  // --- уровни: массивы строк (ragged-строки допускаются, движок выровняет) ---
  // Легенда: # кирпич  = платформа  P старт  G бандит(ходок)  S стрелок
  //          F летун   H крюк(потолочный якорь)  c монета  m аптечка
  //          D дверь выхода   B босс (финальная арена)   (пробел — пусто)
  var LEVELS = [
    [
      '                                                        ',
      '              H                      H                  ',
      '                      c   c                             ',
      '           c        =========              c            ',
      '         =====                           =====          ',
      '                          G                             ',
      '     c         S                   c                    ',
      '   =====                        =====          c   D    ',
      '                   c                        ======###   ',
      '                 =====         G                        ',
      '        G                             c       m         ',
      '                        c          =====   =====        ',
      '   c        =====                               G       ',
      ' =====                  G                               ',
      '                                                        ',
      '############        ############        ################',
      '############        ############        ################',
      '############  c  G  ############  c  G  ################',
      'P###########=====###############=====###################',
      '########################################################'
    ],
    [
      '                                                              ',
      '          H              H               H                    ',
      '                 c  c  c                        c   c         ',
      '      c        ==========            S       ========         ',
      '    =====                   c                                 ',
      '              S          =====          G            c    D   ',
      '   c     G                          c           =========##   ',
      ' =====        c   c            =========                      ',
      '           ==========                       m      S          ',
      '    S                   G          c     =========            ',
      '              c   c             =====                  G       ',
      '   =====   =========                         c   c            ',
      '                          S            G   =========          ',
      '        G          c                                          ',
      '              =========                                       ',
      '######      ######      ####        ######      ##########     ',
      '######  c   ######  G   ####   c    ######  G   ##########     ',
      '######=====########=====####==========#####=====##########     ',
      'P#############################################################',
      '##############################################################'
    ],
    [
      '                                                                  ',
      '        H          H          H          H          H             ',
      '    c  c  c     F        c  c        F        c  c  c      c       ',
      '  ==========         =========            =========     ======    ',
      '          F      S            F      S            F         m  D   ',
      '   c           ======      c         ======     c      =========  ',
      ' =====   G                           G                   #######   ',
      '              F      c  c  c      F           c  c  c              ',
      '    S     =========          S  =========             S           ',
      '   c                  G                     G       c              ',
      ' =====      c  c           =========               =====          ',
      '         =========   F                   F      G                 ',
      '    G                       c   c                                 ',
      '              S        =========       G        c  c              ',
      '    c  c                                       =========          ',
      '#######      ########      ########      ########      ########    ',
      '#######  c   ########  G   ########  c   ########  G   ########    ',
      '#######=====########==========#####==========####=====########    ',
      'P#################################################################',
      '##################################################################'
    ],
    [
      '                              ',
      '       H              H       ',
      '                              ',
      '     c                  c     ',
      '    =====          =====      ',
      '                              ',
      '          H        H          ',
      '                              ',
      '      c      m       c        ',
      '    =====          =====      ',
      '                              ',
      '                              ',
      '              B               ',
      '                              ',
      '    c                    c    ',
      '                              ',
      '                              ',
      '                              ',
      'P#############################',
      '##############################'
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

  P.Game = function (opts) {
    opts = opts || {};
    var emit = opts.onEvent || function () {};

    var S = {
      phase: 'title',   // title | play | dying | levelclear | gameover | win
      paused: false,
      level: 0,
      lives: 3,
      hp: HP_MAX,
      hpMax: HP_MAX,
      score: 0,
      hi: opts.hi || 0,
      tile: TILE, rows: ROWS, cols: 0, pixelW: 0, pixelH: ROWS * TILE,
      viewW: VIEW_W, viewH: VIEW_H,
      grid: [],
      player: null,
      bullets: [],       // сюрикены игрока
      ebullets: [],      // пули врагов
      enemies: [],
      pickups: [],
      particles: [],
      anchors: [],       // потолочные крюки {x,y}
      door: null,
      boss: null,
      camX: 0,
      intro: 0,
      banner: 0,
      shootCd: 0,
      hold: { left: false, right: false, up: false, down: false }
    };

    // ---------- загрузка уровня ----------
    function loadLevel(idx) {
      var n = normalize(LEVELS[idx].map(function (r) { return r; }));
      S.grid = n.grid; S.cols = n.cols; S.rows = n.rows;
      S.pixelW = n.cols * TILE; S.pixelH = n.rows * TILE;
      S.bullets = []; S.ebullets = []; S.enemies = []; S.pickups = []; S.particles = [];
      S.anchors = []; S.door = null; S.boss = null;
      var spawn = { x: TILE, y: (n.rows - 4) * TILE };
      for (var r = 0; r < n.rows; r++) {
        var row = n.grid[r];
        for (var c = 0; c < n.cols; c++) {
          var ch = row[c];
          var wx = c * TILE, wy = r * TILE;
          if (ch === 'P') spawn = { x: wx + 3, y: wy - 2 };
          else if (ch === 'G') S.enemies.push(makeWalker(wx, wy));
          else if (ch === 'S') S.enemies.push(makeShooter(wx, wy));
          else if (ch === 'F') S.enemies.push(makeFlyer(wx, wy));
          else if (ch === 'H') S.anchors.push({ x: wx + TILE / 2, y: wy + TILE / 2 });
          else if (ch === 'c') S.pickups.push({ kind: 'coin', x: wx + TILE / 2, y: wy + TILE / 2, r: 7, t: Math.random() * 6 });
          else if (ch === 'm') S.pickups.push({ kind: 'medkit', x: wx + TILE / 2, y: wy + TILE / 2, r: 10, t: Math.random() * 6 });
          else if (ch === 'D') S.door = { col: c, row: r, x: wx, y: (r - 1) * TILE, w: TILE, h: TILE * 2 };
          else if (ch === 'B') S.boss = makeBoss(wx, (n.rows - 2) * TILE);
        }
      }
      if (!S.door && !S.boss) S.door = { col: n.cols - 2, row: n.rows - 4, x: (n.cols - 2) * TILE, y: (n.rows - 5) * TILE, w: TILE, h: TILE * 2 };
      S.player = {
        x: spawn.x, y: spawn.y, w: PW, h: STAND_H,
        vx: 0, vy: 0, dir: 1, onGround: false, invuln: INVULN, walkT: 0,
        crouch: false,
        grapple: { on: false, ax: 0, ay: 0, len: 0, ang: 0, av: 0 }
      };
      updateCam();
    }

    function makeWalker(wx, wy) {
      return { type: 'walker', x: wx + 2, y: wy + TILE - 24, w: 26, h: 24, vx: -64, dir: -1, t: Math.random() * 6, dead: false };
    }
    function makeShooter(wx, wy) {
      return { type: 'shooter', x: wx + 3, y: wy + TILE - 26, w: 24, h: 26, dir: -1, cd: 0.8 + Math.random() * 1.2, t: Math.random() * 6, dead: false };
    }
    function makeFlyer(wx, wy) {
      return { type: 'flyer', x: wx + 3, y: wy + 2, w: 24, h: 20, baseY: wy + TILE / 2, t: Math.random() * 6, dir: -1, dead: false };
    }
    function makeBoss(wx, groundY) {
      return { x: wx, y: groundY - 58, w: 54, h: 58, hp: 12, hpMax: 12, dir: -1, vx: 78, invuln: 0, cd: 1.6, shots: 0, t: 0 };
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
    function rectSolid(x, y, w, h) {
      var c0 = Math.floor(x / TILE), c1 = Math.floor((x + w - 1) / TILE);
      var r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 1) / TILE);
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (solidChar(tileAt(c, r))) return true;
      return false;
    }

    // ---------- движение с раздельным разрешением осей ----------
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
        }
      }
    }

    function updateCam() {
      if (!S.player) return;
      var cx = S.player.x + S.player.w / 2 - VIEW_W / 2;
      S.camX = Math.max(0, Math.min(cx, Math.max(0, S.pixelW - VIEW_W)));
    }

    // ---------- присед ----------
    function setCrouch(p, want) {
      if (want === p.crouch) return;
      if (want) { var feet = p.y + p.h; p.h = CROUCH_H; p.y = feet - p.h; p.crouch = true; }
      else {
        var feet2 = p.y + p.h, ny = feet2 - STAND_H;
        if (!rectSolid(p.x, ny, p.w, STAND_H)) { p.h = STAND_H; p.y = ny; p.crouch = false; }
      }
    }

    // ---------- действия игрока ----------
    function jump() {
      if (S.phase !== 'play' || S.paused || S.intro > 0) return;
      var p = S.player;
      if (p.grapple.on) { releaseGrapple(true); return; }
      if (p.crouch) return;
      if (p.onGround) { p.vy = JUMP; p.onGround = false; emit('jump'); }
    }
    function shoot() {
      if (S.phase !== 'play' || S.paused || S.intro > 0) return;
      if (S.shootCd > 0) return;
      var p = S.player;
      var sy = p.y + (p.crouch ? 6 : 10);
      S.bullets.push({ x: p.x + p.w / 2 + p.dir * 12, y: sy, vx: BULLET_SPD * p.dir, dir: p.dir, life: BULLET_LIFE, t: 0 });
      S.shootCd = SHOOT_CD; emit('shoot');
    }
    function grapple() {
      if (S.phase !== 'play' || S.paused || S.intro > 0) return;
      var p = S.player;
      if (p.grapple.on) { releaseGrapple(true); return; }
      var cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      var best = null, bd = GRAPPLE_RANGE * GRAPPLE_RANGE;
      for (var i = 0; i < S.anchors.length; i++) {
        var a = S.anchors[i];
        if (a.y > cy - 10) continue;                 // якорь должен быть выше героя
        var d = (a.x - cx) * (a.x - cx) + (a.y - cy) * (a.y - cy);
        if (d < bd) { bd = d; best = a; }
      }
      if (!best) { emit('miss'); return; }
      attachGrapple(best, p);
    }
    function attachGrapple(a, p) {
      var cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      var dx = cx - a.x, dy = cy - a.y;
      var len = Math.sqrt(dx * dx + dy * dy) || MIN_LEN;
      var ang = Math.atan2(dx, dy);                  // 0 = прямо под якорем
      var tcos = Math.cos(ang), tsin = Math.sin(ang);
      var av = (p.vx * tcos - p.vy * tsin) / len;     // наследуем касательную скорость
      p.crouch = false; p.h = STAND_H;
      p.grapple = { on: true, ax: a.x, ay: a.y, len: Math.max(MIN_LEN, Math.min(MAX_LEN, len)), ang: ang, av: av };
      p.onGround = false;
      emit('grapple');
    }
    function releaseGrapple(boost) {
      var p = S.player, gr = p.grapple;
      if (!gr.on) return;
      p.vx = gr.len * gr.av * Math.cos(gr.ang);
      p.vy = -gr.len * gr.av * Math.sin(gr.ang);
      if (p.vx > AIR_SPD) p.vx = AIR_SPD; if (p.vx < -AIR_SPD) p.vx = -AIR_SPD;
      if (boost && S.hold.up) p.vy -= 170;            // подтяг-рывок вверх
      gr.on = false; p.onGround = false;
    }
    function stepGrapple(dt) {
      var p = S.player, gr = p.grapple;
      gr.av += -(PEND_G / gr.len) * Math.sin(gr.ang) * dt;
      if (S.hold.left) gr.av -= SWING * dt;
      if (S.hold.right) gr.av += SWING * dt;
      if (S.hold.up) gr.len = Math.max(MIN_LEN, gr.len - CLIMB * dt);
      if (S.hold.down) gr.len = Math.min(MAX_LEN, gr.len + CLIMB * dt);
      gr.av *= (1 - ROPE_DAMP * dt);
      gr.ang += gr.av * dt;
      var cx = gr.ax + gr.len * Math.sin(gr.ang), cy = gr.ay + gr.len * Math.cos(gr.ang);
      var nx = cx - p.w / 2, ny = cy - p.h / 2;
      if (rectSolid(nx, ny, p.w, p.h)) { releaseGrapple(false); return; }
      p.x = nx; p.y = ny;
      p.dir = gr.av >= 0 ? 1 : -1;
      updateCam();
    }

    // ---------- урон / жизни ----------
    function hurtPlayer() {
      var p = S.player;
      if (!p || p.invuln > 0) return;
      S.hp--; emit('hurt');
      if (S.hp <= 0) {
        S.lives--;
        if (S.lives <= 0) { S.phase = 'gameover'; S.banner = 0; emit('gameover', { score: S.score }); }
        else { S.phase = 'dying'; S.banner = 1.0; }
      } else {
        p.invuln = INVULN;
        if (p.grapple.on) releaseGrapple(false);
      }
    }

    function respawn() {
      loadLevel(S.level);
      S.hp = HP_MAX; S.phase = 'play'; S.intro = 1.1;
    }
    function nextLevel() {
      if (S.level + 1 >= LEVELS.length) { S.phase = 'win'; emit('win', { score: S.score }); return; }
      S.level++; loadLevel(S.level); S.hp = HP_MAX; S.phase = 'play'; S.intro = 1.1;
    }

    // ---------- сущности ----------
    function stepPlayer(dt) {
      var p = S.player;
      if (p.grapple.on) {
        if (p.invuln > 0) p.invuln -= dt;
        stepGrapple(dt);
        if (p.y > S.pixelH + 60) hurtPlayer();
        return;
      }
      var wantCrouch = S.hold.down && p.onGround;
      setCrouch(p, wantCrouch);
      var ax = 0;
      if (S.hold.left) { ax -= 1; p.dir = -1; }
      if (S.hold.right) { ax += 1; p.dir = 1; }
      if (p.crouch) { p.vx = ax * CROUCH_MOVE; }
      else if (p.onGround) { p.vx = ax * MOVE; }
      else {
        if (ax !== 0) p.vx += ax * MOVE * 3.5 * dt;
        p.vx *= (1 - 0.9 * dt);
        if (p.vx > AIR_SPD) p.vx = AIR_SPD; if (p.vx < -AIR_SPD) p.vx = -AIR_SPD;
      }
      p.vy += GRAVITY * dt; if (p.vy > MAX_FALL) p.vy = MAX_FALL;
      moveActor(p, p.vx * dt, 0);
      moveActor(p, 0, p.vy * dt);
      if (ax !== 0 && p.onGround && !p.crouch) p.walkT += dt * 10; else p.walkT = 0;
      if (p.invuln > 0) p.invuln -= dt;
      if (p.y > S.pixelH + 60) { hurtPlayer(); return; }
      updateCam();
    }

    function stepEnemies(dt) {
      var p = S.player;
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
        } else if (e.type === 'shooter') {
          var toward = Math.sign((p.x + p.w / 2) - (e.x + e.w / 2)) || e.dir;
          e.dir = toward;
          e.cd -= dt;
          var dx = Math.abs((p.x + p.w / 2) - (e.x + e.w / 2));
          var dy = Math.abs((p.y + p.h / 2) - (e.y + e.h / 2));
          if (e.cd <= 0 && dx < 400 && dy < 70) {
            S.ebullets.push({ x: e.x + (e.dir > 0 ? e.w : 0), y: e.y + 9, vx: EBULLET_SPD * e.dir, life: EBULLET_LIFE, t: 0 });
            e.cd = 1.5 + Math.random() * 0.7; emit('shoot');
          }
        } else { // flyer — дрейф к игроку + покачивание
          var tx = p.x + p.w / 2;
          var tw = Math.sign(tx - (e.x + e.w / 2));
          e.dir = tw || e.dir;
          e.x += tw * 54 * dt;
          if (e.x < 0) e.x = 0; if (e.x + e.w > S.pixelW) e.x = S.pixelW - e.w;
          e.y = e.baseY - e.h / 2 + Math.sin(e.t * 2.4) * 24;
        }
        if (aabb(p, e)) hurtPlayer();
      }
    }

    function stepBoss(dt) {
      var b = S.boss, p = S.player;
      b.t += dt; if (b.invuln > 0) b.invuln -= dt;
      var left = TILE * 1.2, right = S.pixelW - TILE * 1.2;
      b.x += b.vx * dt;
      if (b.x < left) { b.x = left; b.vx = Math.abs(b.vx); b.dir = 1; }
      if (b.x + b.w > right) { b.x = right - b.w; b.vx = -Math.abs(b.vx); b.dir = -1; }
      b.cd -= dt;
      if (b.cd <= 0) {
        var toP = (p.x + p.w / 2) > (b.x + b.w / 2) ? 1 : -1;
        var low = (b.shots % 3 === 2);               // каждый третий залп — низкий (перепрыгнуть)
        var by = low ? b.y + b.h - 12 : b.y + 16;
        S.ebullets.push({ x: b.x + b.w / 2, y: by, vx: EBULLET_SPD * 1.15 * toP, life: 4.5, t: 0, big: true });
        if (!low) S.ebullets.push({ x: b.x + b.w / 2, y: by, vx: EBULLET_SPD * 0.7 * toP, life: 4.5, t: 0, big: true });
        b.shots++; b.cd = 1.25;
        emit('shoot');
      }
      if (aabb(p, b)) hurtPlayer();
    }

    function stepBullets(dt) {
      for (var i = S.bullets.length - 1; i >= 0; i--) {
        var b = S.bullets[i];
        b.x += b.vx * dt; b.life -= dt; b.t += dt;
        var hit = b.life <= 0 || b.x < 0 || b.x > S.pixelW || solidAtPx(b.x, b.y);
        if (!hit) {
          for (var j = 0; j < S.enemies.length; j++) {
            var e = S.enemies[j];
            if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
              S.enemies.splice(j, 1); S.score += 100; spawnBurst(e.x + e.w / 2, e.y + e.h / 2, 0);
              emit('explode'); hit = true; break;
            }
          }
        }
        if (!hit && S.boss && S.boss.invuln <= 0) {
          var bo = S.boss;
          if (b.x > bo.x && b.x < bo.x + bo.w && b.y > bo.y && b.y < bo.y + bo.h) {
            bo.hp--; bo.invuln = 0.25; S.score += 50; spawnBurst(b.x, b.y, 1); emit('bosshit'); hit = true;
            if (bo.hp <= 0) {
              spawnBurst(bo.x + bo.w / 2, bo.y + bo.h / 2, 1); spawnBurst(bo.x + bo.w / 2, bo.y + bo.h / 3, 0);
              S.score += 1000; S.boss = null; S.phase = 'win'; emit('explode'); emit('win', { score: S.score });
            }
          }
        }
        if (hit) S.bullets.splice(i, 1);
      }
    }

    function stepEBullets(dt) {
      var p = S.player;
      for (var i = S.ebullets.length - 1; i >= 0; i--) {
        var b = S.ebullets[i];
        b.x += b.vx * dt; b.life -= dt; b.t += dt;
        var gone = b.life <= 0 || b.x < -20 || b.x > S.pixelW + 20 || solidAtPx(b.x, b.y);
        if (!gone && p && p.invuln <= 0 && b.x > p.x && b.x < p.x + p.w && b.y > p.y && b.y < p.y + p.h) {
          hurtPlayer(); gone = true;
        }
        if (gone) S.ebullets.splice(i, 1);
      }
    }

    function stepPickups(dt) {
      var p = S.player;
      for (var i = S.pickups.length - 1; i >= 0; i--) {
        var k = S.pickups[i]; k.t += dt;
        if (p.x < k.x + k.r && p.x + p.w > k.x - k.r && p.y < k.y + k.r && p.y + p.h > k.y - k.r) {
          if (k.kind === 'medkit') { S.hp = Math.min(HP_MAX, S.hp + 1); S.score += 30; emit('medkit'); }
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
    function spawnBurst(x, y, kind) {
      for (var i = 0; i < 11; i++) {
        var a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 150;
        S.particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.4 + Math.random() * 0.3, c: kind ? 1 : (i % 2) });
      }
    }

    function aabb(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

    function checkDoor() {
      if (!S.door || S.boss) return;
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
        stepPlayer(dt);
        if (S.phase !== 'play') return;
        stepEnemies(dt);
        if (S.phase !== 'play') return;
        if (S.boss) { stepBoss(dt); if (S.phase !== 'play') return; }
        stepBullets(dt);
        if (S.phase !== 'play') return;
        stepEBullets(dt);
        if (S.phase !== 'play') return;
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
        S.phase = 'play'; S.paused = false; S.level = 0; S.lives = 3; S.hp = HP_MAX; S.score = 0;
        loadLevel(0); S.intro = 1.1; S.banner = 0;
      },
      update: step,
      step: step,
      state: function () { return S; },
      setHeld: function (name, down) { if (S.hold.hasOwnProperty(name)) S.hold[name] = !!down; },
      jump: jump,
      shoot: shoot,
      grapple: grapple,
      pause: function () { if (S.phase === 'play' || S.phase === 'levelclear') S.paused = !S.paused; },
      isPaused: function () { return S.paused; },
      phase: function () { return S.phase; },
      setHi: function (v) { S.hi = v; }
    };
    return api;
  };

  // Константы для рендереров (общая геометрия).
  P.consts = { TILE: TILE, ROWS: ROWS, VIEW_W: VIEW_W, VIEW_H: VIEW_H };
})(typeof window !== 'undefined' ? window : globalThis);
