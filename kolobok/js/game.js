/* ============================================================================
   КОЛОБОК · движок (DOM-free, детерминированный)
   Флип-скрин головоломка-платформер: круглый герой катится, прыгает (гравитация
   + платформы), собирает ягоды и носит до 3 предметов. Правильный предмет
   снимает препятствие: ключ → калитка, доска → речка, ведро → костёр.
   Экран не скроллится — каждая поляна рисуется целиком; уход за край открывает
   соседнюю поляну. Победа: собрать все ягоды и дойти до дома.
   Рендереры (classic/modern) и main.js только читают K.Game.state().
   ========================================================================== */
(function (global) {
  'use strict';
  var K = global.KOLOBOK = global.KOLOBOK || {};

  // --- геометрия мира ---
  var TILE = 40;                 // размер клетки
  var COLS = 24, ROWS = 15;      // поляна 24*40 x 15*40 = 960 x 600
  var VIEW_W = COLS * TILE, VIEW_H = ROWS * TILE;

  // --- физика ---
  var GRAVITY = 1600, MOVE = 198, JUMP = -720, MAX_FALL = 800;
  var INVULN = 1.4;              // неуязвимость после респавна
  var BAG_MAX = 3;               // предметов в сумке

  // --- поляны (флип-скрин). Легенда:
  //   #  земля/стена (твёрдо)   =  платформа (твёрдо)   D  калитка (твёрдо, ключ)
  //   ~  речка (гибель, доска)  ^  костёр (гибель, ведро)
  //   *  ягода   k ключ   p доска   u ведро   X лиса (патруль, гибель)
  //   G  дом (финиш)   P старт   (пробел — воздух)
  var ROOMS = [
    [ // 0 — опушка (старт): ягода, ключ на тумбе
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      'P                       ',
      '   *          k         ',
      '########################',
      '########################'
    ],
    [ // 1 — калитка: доска, ягода, запертая калитка D (слева от неё)
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '             D          ',
      '             D          ',
      '             D          ',
      '             D          ',
      '             D          ',
      '  p   *      D          ',
      '########################',
      '########################'
    ],
    [ // 2 — речка: провал ~, лиса на уступе (опасна сверху), ягода за рекой
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                  X     ',
      '                 =====  ',
      '                *       ',
      '##########~~~~##########',
      '##########~~~~##########'
    ],
    [ // 3 — костёр: сплошная лесенка вверх (на поляну 5), ягода, высокая стена огня ^
      '                        ',
      '            #      ^^   ',
      '           ##      ^^   ',
      '          ###      ^^   ',
      '         ####      ^^   ',
      '        #####      ^^   ',
      '       ######      ^^   ',
      '      #######      ^^   ',
      '     ########      ^^   ',
      '    #########      ^^   ',
      '   ##########      ^^   ',
      '  ###########      ^^   ',
      ' ############   *  ^^   ',
      '########################',
      '########################'
    ],
    [ // 4 — дом (финиш): ягода, дом G
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '          *       GG    ',
      '########################',
      '########################'
    ],
    [ // 5 — верхняя поляна (бонус над 3): ведро, ягода, провал вниз
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '                        ',
      '   u    *               ',
      '##########   ###########',
      '##########   ###########'
    ]
  ];

  // Связи полян. Для каждой: left/right/up/down = null или
  // { room, x?, y? } (x/y — принудительная клетка-колонка/ряд приземления).
  var ADJ = [
    { right: { room: 1 } },                                   // 0
    { left: { room: 0 }, right: { room: 2 } },                // 1
    { left: { room: 1 }, right: { room: 3 } },                // 2
    { left: { room: 2 }, right: { room: 4 }, up: { room: 5, x: 2 } }, // 3
    { left: { room: 3 } },                                    // 4
    { down: { room: 3, x: 16 } }                              // 5
  ];

  function solidChar(c) { return c === '#' || c === '=' || c === 'D'; }
  function hazardChar(c) { return c === '~' || c === '^'; }

  // Клон шаблона поляны в изменяемый массив строк (правки сохраняются).
  function cloneRoom(idx) { return ROOMS[idx].map(function (r) { return r; }); }

  // Всего ягод в мире — для условия победы.
  function countBerries() {
    var n = 0;
    for (var i = 0; i < ROOMS.length; i++)
      for (var r = 0; r < ROOMS[i].length; r++)
        for (var c = 0; c < ROOMS[i][r].length; c++)
          if (ROOMS[i][r][c] === '*') n++;
    return n;
  }

  K.Game = function (opts) {
    opts = opts || {};
    var emit = opts.onEvent || function () {};

    var S = {
      phase: 'title',   // title | play | dying | warp | gameover | win
      paused: false,
      roomId: 0,
      roomCache: {},    // id -> изменяемая сетка (сохраняет открытые калитки и т.п.)
      lives: 3,
      score: 0,
      hi: opts.hi || 0,
      berries: 0,
      totalBerries: countBerries(),
      bag: [],          // предметы: 'key' | 'plank' | 'bucket' (до 3)
      tile: TILE, rows: ROWS, cols: COLS,
      pixelW: COLS * TILE, pixelH: ROWS * TILE,
      viewW: VIEW_W, viewH: VIEW_H,
      grid: [],
      player: null,
      enemies: [],
      particles: [],
      goal: null,
      entry: { x: TILE, y: 12 * TILE }, // точка респавна на текущей поляне
      intro: 0,
      banner: 0,
      flash: '',        // краткое сообщение (needberries и т.п.)
      flashT: 0,
      hold: { left: false, right: false }
    };

    // ---------- загрузка поляны ----------
    function buildRoom(id) {
      var grid = S.roomCache[id] || (S.roomCache[id] = cloneRoom(id));
      S.grid = grid;
      S.enemies = [];
      S.goal = null;
      for (var r = 0; r < ROWS; r++) {
        var row = grid[r];
        for (var c = 0; c < COLS; c++) {
          var ch = row[c];
          if (ch === 'X') S.enemies.push(makeFox(c, r));
          else if (ch === 'G' && !S.goal) S.goal = { x: c * TILE, y: r * TILE, w: TILE * 2, h: TILE };
        }
      }
    }

    function makeFox(c, r) {
      return { type: 'fox', x: c * TILE + 3, y: r * TILE + TILE - 24, w: 30, h: 24, vx: -58, dir: -1, t: Math.random() * 6 };
    }

    function spawnPlayer(x, y) {
      S.player = { x: x, y: y, w: 26, h: 26, vx: 0, vy: 0, dir: 1, onGround: false, invuln: INVULN, roll: 0 };
    }

    // Найти старт 'P' на поляне (по умолчанию низ слева).
    function findStart(id) {
      var g = ROOMS[id];
      for (var r = 0; r < g.length; r++) for (var c = 0; c < g[r].length; c++) if (g[r][c] === 'P') return { x: c * TILE + 7, y: r * TILE };
      return { x: TILE, y: (ROWS - 3) * TILE };
    }

    // ---------- тайловые помощники ----------
    function tileAt(col, row) {
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return ' ';
      return S.grid[row][col];
    }
    function setTile(col, row, ch) {
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
      var row0 = S.grid[row];
      S.grid[row] = row0.substring(0, col) + ch + row0.substring(col + 1);
    }
    function solidAtPx(px, py) { return solidChar(tileAt(Math.floor(px / TILE), Math.floor(py / TILE))); }
    function rectSolid(x, y, w, h) {
      var c0 = Math.floor(x / TILE), c1 = Math.floor((x + w - 1) / TILE);
      var r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 1) / TILE);
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (solidChar(tileAt(c, r))) return true;
      return false;
    }
    // Любая клетка под игроком содержит опасность?
    function rectHazard(x, y, w, h) {
      var c0 = Math.floor(x / TILE), c1 = Math.floor((x + w - 1) / TILE);
      var r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 1) / TILE);
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (hazardChar(tileAt(c, r))) return true;
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

    // ---------- переход между полянами (флип-скрин) ----------
    function go(exit, placeX, placeY) {
      S.roomId = exit.room;
      buildRoom(exit.room);
      var p = S.player;
      var nx = (exit.x != null) ? exit.x * TILE + (TILE - p.w) / 2 : placeX;
      var ny = (exit.y != null) ? exit.y * TILE : placeY;
      p.x = Math.max(1, Math.min(nx, S.pixelW - p.w - 1));
      p.y = Math.max(1, Math.min(ny, S.pixelH - p.h - 1));
      p.vx = 0; p.invuln = Math.max(p.invuln, 0.8);
      S.entry = { x: p.x, y: p.y };
      S.phase = 'warp'; S.banner = 0.45; emit('warp');
    }

    function edges() {
      var p = S.player, a = ADJ[S.roomId] || {};
      if (p.x < 0) { if (a.left) { go(a.left, S.pixelW - p.w - 2, p.y); return true; } p.x = 0; p.vx = 0; }
      else if (p.x + p.w > S.pixelW) { if (a.right) { go(a.right, 2, p.y); return true; } p.x = S.pixelW - p.w; p.vx = 0; }
      if (p.y < 0) { if (a.up) { go(a.up, p.x, S.pixelH - 3 * TILE); return true; } p.y = 0; p.vy = 0; }
      else if (p.y > S.pixelH + 8) { if (a.down) { go(a.down, p.x, S.pixelH - 3 * TILE); return true; } hurt(); return true; }
      return false;
    }

    // ---------- сбор ягод/предметов ----------
    function pickups() {
      var p = S.player;
      var c0 = Math.floor(p.x / TILE), c1 = Math.floor((p.x + p.w - 1) / TILE);
      var r0 = Math.floor(p.y / TILE), r1 = Math.floor((p.y + p.h - 1) / TILE);
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
        var ch = tileAt(c, r);
        if (ch === '*') { setTile(c, r, ' '); S.berries++; S.score += 100; burst(c * TILE + TILE / 2, r * TILE + TILE / 2, 1); emit('berry'); }
        else if (ch === 'k' || ch === 'p' || ch === 'u') {
          var item = ch === 'k' ? 'key' : ch === 'p' ? 'plank' : 'bucket';
          if (S.bag.length < BAG_MAX) { S.bag.push(item); setTile(c, r, ' '); S.score += 25; emit('pickup'); }
        }
      }
    }

    // ---------- применить предмет к препятствию на поляне ----------
    function useItem() {
      if (S.phase !== 'play' || S.paused || S.intro > 0) return;
      var has = function (it) { return S.bag.indexOf(it) >= 0; };
      var drop = function (it) { var i = S.bag.indexOf(it); if (i >= 0) S.bag.splice(i, 1); };
      var roomHas = function (ch) {
        for (var r = 0; r < ROWS; r++) if (S.grid[r].indexOf(ch) >= 0) return true;
        return false;
      };
      var replaceAll = function (from, to) {
        for (var r = 0; r < ROWS; r++) {
          var row = S.grid[r], out = '';
          for (var c = 0; c < row.length; c++) out += (row[c] === from ? to : row[c]);
          S.grid[r] = out;
        }
      };
      if (has('key') && roomHas('D')) { replaceAll('D', ' '); drop('key'); emit('door'); return; }
      if (has('plank') && roomHas('~')) { replaceAll('~', '='); drop('plank'); emit('plank'); return; }
      if (has('bucket') && roomHas('^')) { replaceAll('^', ' '); drop('bucket'); emit('splash'); return; }
      emit('nope');
    }

    // ---------- урон / жизни ----------
    function hurt() {
      if (S.player && S.player.invuln > 0 && S.phase === 'play') return;
      S.lives--; emit('hurt');
      if (S.lives <= 0) { S.phase = 'gameover'; S.banner = 0; emit('gameover', { score: S.score }); }
      else { S.phase = 'dying'; S.banner = 1.0; burst(S.player.x + S.player.w / 2, S.player.y + S.player.h / 2, 0); }
    }
    function respawn() {
      buildRoom(S.roomId);
      spawnPlayer(S.entry.x, S.entry.y);
      S.phase = 'play'; S.intro = 0.6;
    }

    // ---------- частицы ----------
    function burst(x, y, kind) {
      for (var i = 0; i < 10; i++) {
        var a = Math.random() * Math.PI * 2, sp = 50 + Math.random() * 130;
        S.particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.4 + Math.random() * 0.3, c: kind });
      }
    }
    function stepParticles(dt) {
      for (var i = S.particles.length - 1; i >= 0; i--) {
        var pp = S.particles[i];
        pp.vy += 560 * dt; pp.x += pp.vx * dt; pp.y += pp.vy * dt; pp.life -= dt;
        if (pp.life <= 0) S.particles.splice(i, 1);
      }
    }

    // ---------- сущности ----------
    function stepPlayer(dt) {
      var p = S.player, ax = 0;
      if (S.hold.left) { ax -= 1; p.dir = -1; }
      if (S.hold.right) { ax += 1; p.dir = 1; }
      p.vx = ax * MOVE;
      p.vy += GRAVITY * dt; if (p.vy > MAX_FALL) p.vy = MAX_FALL;
      moveActor(p, p.vx * dt, 0);
      moveActor(p, 0, p.vy * dt);
      p.roll += (p.vx * dt) / 13;               // вращение катящегося колобка
      if (p.invuln > 0) p.invuln -= dt;
      if (edges()) return;                       // смена поляны/падение
      pickups();
      if (rectHazard(p.x + 4, p.y + 4, p.w - 8, p.h - 8)) { hurt(); return; }
      checkGoal();
    }

    function stepEnemies(dt) {
      var p = S.player;
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; e.t += dt;
        var nx = e.x + e.vx * dt;
        var probeX = e.vx < 0 ? nx : nx + e.w;
        var wall = solidChar(tileAt(Math.floor(probeX / TILE), Math.floor((e.y + e.h / 2) / TILE)));
        var footX = e.vx < 0 ? nx + 2 : nx + e.w - 2;
        var ground = solidChar(tileAt(Math.floor(footX / TILE), Math.floor((e.y + e.h + 2) / TILE)));
        if (wall || !ground || nx < 0 || nx + e.w > S.pixelW) { e.vx = -e.vx; e.dir = -e.dir; }
        else e.x = nx;
        if (p.x < e.x + e.w && p.x + p.w > e.x && p.y < e.y + e.h && p.y + p.h > e.y) { hurt(); return; }
      }
    }

    function checkGoal() {
      var g = S.goal; if (!g) return;
      var p = S.player;
      if (p.x < g.x + g.w && p.x + p.w > g.x && p.y < g.y + g.h && p.y + p.h > g.y) {
        if (S.berries >= S.totalBerries) { S.phase = 'win'; emit('win', { score: S.score }); }
        else if (S.flashT <= 0) { S.flash = 'needberries'; S.flashT = 1.4; emit('nope'); }
      }
    }

    // ---------- главный шаг ----------
    function step(dt) {
      if (dt > 0.05) dt = 0.05;
      if (S.paused) return;
      if (S.flashT > 0) S.flashT -= dt;
      if (S.phase === 'play') {
        if (S.intro > 0) { S.intro -= dt; stepParticles(dt); return; }
        stepPlayer(dt);
        if (S.phase !== 'play') { stepParticles(dt); return; }
        stepEnemies(dt);
        stepParticles(dt);
      } else if (S.phase === 'warp') {
        S.banner -= dt; stepParticles(dt); if (S.banner <= 0) { S.phase = 'play'; S.intro = 0.25; }
      } else if (S.phase === 'dying') {
        stepParticles(dt); S.banner -= dt; if (S.banner <= 0) respawn();
      }
    }

    // ---------- публичный API ----------
    var api = {
      start: function () {
        S.phase = 'play'; S.paused = false; S.roomId = 0; S.lives = 3; S.score = 0;
        S.berries = 0; S.bag = []; S.roomCache = {}; S.particles = [];
        buildRoom(0);
        var st = findStart(0); spawnPlayer(st.x, st.y);
        S.entry = { x: st.x, y: st.y };
        S.intro = 0.9; S.banner = 0; S.flash = ''; S.flashT = 0;
      },
      update: step,
      step: step,
      state: function () { return S; },
      setHeld: function (name, down) { if (name === 'left' || name === 'right') S.hold[name] = !!down; },
      jump: function () {
        if (S.phase !== 'play' || S.paused || S.intro > 0) return;
        var p = S.player; if (p && p.onGround) { p.vy = JUMP; p.onGround = false; emit('jump'); }
      },
      use: useItem,
      pause: function () { if (S.phase === 'play' || S.phase === 'warp') S.paused = !S.paused; },
      isPaused: function () { return S.paused; },
      phase: function () { return S.phase; },
      setHi: function (v) { S.hi = v; }
    };
    return api;
  };

  // Константы для рендереров (общая геометрия).
  K.consts = { TILE: TILE, COLS: COLS, ROWS: ROWS, VIEW_W: VIEW_W, VIEW_H: VIEW_H };
})(typeof window !== 'undefined' ? window : globalThis);
