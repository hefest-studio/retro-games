/* ФИТИЛЬ · логика игры (без DOM, детерминирована при заданном rng).
   Лабиринт-подрывник сверху на 1–2 игроков: поле-сетка 15×13, неразрушимые колонны,
   ящики, бомбы с крестовым взрывом и цепными подрывами, бонусы из ящиков, четыре вида
   врагов, люк-выход (открывается, когда врагов не осталось), 8 уровней + Жернов в финале.
   FITIL.Game(opts) → api; FITIL.logic — константы, уровни, генератор поля, помощники. */
(function (global) {
  'use strict';
  var F = global.FITIL = global.FITIL || {};

  var COLS = 15, ROWS = 13;
  var FLOOR = 0, WALL = 1, CRATE = 2;
  var FUSE = 2.4;            // секунды до взрыва
  var FLAME_T = 0.55;        // сколько держится пламя
  var SLIDE_V = 9;           // скорость пнутой бомбы, клеток/с
  var BASE_SPEED = 3.6, SPEED_STEP = 0.55;   // скорость подрывника, клеток/с
  var RESPAWN_T = 2.2, INV_T = 2.6;
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var SPAWNS = [[1, 1], [13, 11]];            // И1 — левый верх, И2 — правый низ
  // Бонусы (свои названия — в i18n: pw_bomb ЗАРЯД, pw_flame ЖАР, pw_speed ПРЫТЬ, pw_kick ТОЛЧОК, pw_relay РЕЛЕ)
  var POWERS = { bomb: { max: 8 }, flame: { max: 8 }, speed: { max: 4 }, kick: {}, relay: {} };
  // Враги: шатун (бродит), ищейка (идёт по следу), мгла (сквозь ящики), юла (быстрая)
  var ENEMY = {
    wander: { speed: 1.7, score: 100, crates: false },
    chaser: { speed: 2.0, score: 200, crates: false },
    ghost:  { speed: 1.4, score: 300, crates: true },
    fast:   { speed: 2.9, score: 400, crates: false }
  };
  var BOSS_HP = 10;
  var CHASE_R = 6, CHASE_P = 0.6;   // ищейка чует подрывника в пределах 6 клеток и идёт по следу в 60% решений
  var EXTRA_LIFE = 10000;   // +1 жизнь каждому живому в игре за каждые 10 000 очков
  var MAX_LIVES = 9;
  var TOUCH = 0.5;          // касание врага (доля клетки по каждой оси)

  // Уровни: враги, плотность ящиков, бонусы под ящиками, узор доп. стен
  var LEVELS = [
    { name: 'yard',    enemies: { wander: 3 },                      crates: 0.36, items: ['bomb', 'flame', 'flame'] },
    { name: 'store',   enemies: { wander: 3, chaser: 1 },           crates: 0.42, items: ['bomb', 'speed', 'flame'] },
    { name: 'lanes',   enemies: { wander: 2, chaser: 2 },           crates: 0.42, items: ['bomb', 'flame', 'kick'], walls: 'lanes' },
    { name: 'cellar',  enemies: { wander: 2, ghost: 1, chaser: 1 }, crates: 0.4, items: ['bomb', 'speed', 'relay', 'flame'], walls: 'ring' },
    { name: 'mine',    enemies: { fast: 1, wander: 2, chaser: 2 },  crates: 0.45, items: ['bomb', 'flame', 'speed', 'kick'], walls: 'teeth' },
    { name: 'foundry', enemies: { ghost: 1, fast: 1, chaser: 2 },   crates: 0.46, items: ['bomb', 'flame', 'relay', 'bomb'], walls: 'cross' },
    { name: 'bridge',  enemies: { chaser: 2, fast: 2, ghost: 2 },   crates: 0.48, items: ['bomb', 'flame', 'speed', 'flame'], walls: 'bridge' },
    { name: 'citadel', enemies: { fast: 2, chaser: 3, ghost: 2 },   crates: 0.5,  items: ['bomb', 'flame', 'relay', 'speed', 'bomb'], walls: 'citadel' },
    { name: 'lair',    enemies: {}, boss: true,                     crates: 0.16, items: ['bomb', 'flame', 'kick', 'flame'] }
  ];
  // Кандидаты доп. стен (генератор берёт только те, что не рвут связность поля)
  var WALLS = {
    lanes:   [[3, 2], [3, 4], [11, 8], [11, 10], [7, 4], [7, 8], [5, 7], [9, 5]],
    ring:    [[5, 4], [7, 4], [9, 4], [5, 8], [7, 8], [9, 8], [4, 5], [4, 7], [10, 5], [10, 7]],
    teeth:   [[3, 2], [5, 2], [9, 10], [11, 10], [3, 6], [11, 6], [7, 3], [7, 9]],
    cross:   [[7, 3], [7, 5], [7, 7], [7, 9], [3, 6], [5, 6], [9, 6], [11, 6]],
    bridge:  [[1, 6], [3, 6], [11, 6], [13, 6], [5, 5], [9, 7], [6, 3], [8, 9]],
    citadel: [[5, 3], [6, 3], [8, 3], [9, 3], [5, 9], [6, 9], [8, 9], [9, 9], [3, 5], [3, 7], [11, 5], [11, 7]]
  };

  // Раскладки кооп-управления (g.usePlayers): И1 — стрелки, И2 — WASD; bomb — бомба, det — подрыв РЕЛЕ
  var BIND = {
    p1: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], bomb: ['Space', 'Slash', 'Numpad0'], det: ['Period', 'NumpadDecimal', 'ShiftRight'] },
    p2: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], bomb: ['KeyF', 'KeyE'], det: ['KeyG', 'KeyQ'] }
  };

  function idx(x, y) { return y * COLS + x; }
  function inside(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS; }
  function rnd(n) { return Math.round(n); }

  // BFS по полю: pass(x,y) → можно ли зайти; → массив расстояний (−1 — недостижимо)
  function bfs(sx, sy, pass) {
    var dist = new Array(COLS * ROWS).fill(-1), q = [sx, sy], h = 0;
    dist[idx(sx, sy)] = 0;
    while (h < q.length) {
      var x = q[h++], y = q[h++], d = dist[idx(x, y)];
      for (var i = 0; i < 4; i++) {
        var nx = x + DIRS[i][0], ny = y + DIRS[i][1];
        if (!inside(nx, ny) || dist[idx(nx, ny)] >= 0 || !pass(nx, ny)) continue;
        dist[idx(nx, ny)] = d + 1; q.push(nx, ny);
      }
    }
    return dist;
  }
  // Все не-стены связаны (ящики проходимы — их можно взорвать)
  function connected(grid) {
    var d = bfs(SPAWNS[0][0], SPAWNS[0][1], function (x, y) { return grid[idx(x, y)] !== WALL; });
    for (var i = 0; i < grid.length; i++) if (grid[i] !== WALL && d[i] < 0) return false;
    return true;
  }
  function safeZone(x, y) {
    for (var s = 0; s < SPAWNS.length; s++) {
      var dx = Math.abs(x - SPAWNS[s][0]), dy = Math.abs(y - SPAWNS[s][1]);
      if (dx + dy <= 2 && (dx === 0 || dy === 0 || dx + dy <= 1)) return true;
    }
    return false;
  }

  // Генерация поля уровня. → { grid, hidden{cell:kind}, hatch{x,y}, enemies[{type,x,y}], boss{x,y}|null }
  function buildLevel(n, rng) {
    var lv = LEVELS[n - 1], grid = new Uint8Array(COLS * ROWS);
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 || (x % 2 === 0 && y % 2 === 0)) grid[idx(x, y)] = WALL;
    }
    (WALLS[lv.walls] || []).forEach(function (c) {
      var i = idx(c[0], c[1]);
      if (grid[i] !== FLOOR || safeZone(c[0], c[1])) return;
      grid[i] = WALL; if (!connected(grid)) grid[i] = FLOOR;
    });
    // люк — свободная клетка подальше от И1 (и от И2)
    var far = [];
    for (y = 1; y < ROWS - 1; y++) for (x = 1; x < COLS - 1; x++) {
      if (grid[idx(x, y)] !== FLOOR) continue;
      var d1 = Math.abs(x - SPAWNS[0][0]) + Math.abs(y - SPAWNS[0][1]), d2 = Math.abs(x - SPAWNS[1][0]) + Math.abs(y - SPAWNS[1][1]);
      if (d1 >= 8 && d2 >= 6) far.push([x, y]);
    }
    var hatch = lv.boss ? { x: 7, y: 1 } : far[Math.floor(rng() * far.length)];
    hatch = { x: hatch[0] != null ? hatch[0] : hatch.x, y: hatch[1] != null ? hatch[1] : hatch.y };
    // враги — подальше от точек появления
    var enemies = [], used = {}, bossPos = lv.boss ? { x: 7, y: 7 } : null;
    used[idx(hatch.x, hatch.y)] = 1;
    if (bossPos) used[idx(bossPos.x, bossPos.y)] = 1;
    var types = [];
    Object.keys(lv.enemies).forEach(function (k) { for (var i = 0; i < lv.enemies[k]; i++) types.push(k); });
    var spots = [];
    for (y = 1; y < ROWS - 1; y++) for (x = 1; x < COLS - 1; x++) {
      if (grid[idx(x, y)] !== FLOOR) continue;
      var ok = SPAWNS.every(function (s) { return Math.abs(x - s[0]) + Math.abs(y - s[1]) >= 7; });
      if (ok) spots.push([x, y]);
    }
    types.forEach(function (t) {
      for (var tries = 0; tries < 200; tries++) {
        var s = spots[Math.floor(rng() * spots.length)];
        if (used[idx(s[0], s[1])]) continue;
        used[idx(s[0], s[1])] = 1; enemies.push({ type: t, x: s[0], y: s[1] }); return;
      }
    });
    // ящики
    var crates = [];
    for (y = 1; y < ROWS - 1; y++) for (x = 1; x < COLS - 1; x++) {
      var i2 = idx(x, y);
      if (grid[i2] !== FLOOR || safeZone(x, y) || used[i2]) continue;
      if (bossPos && Math.abs(x - bossPos.x) <= 1 && Math.abs(y - bossPos.y) <= 1) continue;
      if (rng() < lv.crates) { grid[i2] = CRATE; crates.push(i2); }
    }
    // бонусы — под случайными разными ящиками
    var hidden = {}, pool = crates.slice();
    lv.items.forEach(function (k) {
      if (!pool.length) return;
      var j = Math.floor(rng() * pool.length); hidden[pool[j]] = k; pool.splice(j, 1);
    });
    return { grid: grid, hidden: hidden, hatch: hatch, enemies: enemies, boss: bossPos };
  }

  // Клетки креста взрыва из (x,y) радиусом r: [{x,y,kind:'c'|'h'|'v',end,crate}], стены гасят, ящик — последний
  function blast(grid, x, y, r) {
    var out = [{ x: x, y: y, kind: 'c' }];
    for (var d = 0; d < 4; d++) {
      for (var k = 1; k <= r; k++) {
        var nx = x + DIRS[d][0] * k, ny = y + DIRS[d][1] * k;
        if (!inside(nx, ny)) break;
        var c = grid[idx(nx, ny)];
        if (c === WALL) break;
        out.push({ x: nx, y: ny, kind: d < 2 ? 'h' : 'v', end: k === r || c === CRATE, crate: c === CRATE, d: d });
        if (c === CRATE) break;
      }
    }
    return out;
  }

  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var emit = opts.onEvent || function () {};
    var diff = opts.difficulty || function (level, base, step, max) { var v = base + (level - 1) * step; return max == null ? v : Math.min(v, max); };
    var NP = opts.players === 2 ? 2 : 1;
    var S = {
      level: opts.level || 1, maxLevel: opts.maxLevel || LEVELS.length, score: 0, phase: 'ready', phaseT: 0, time: 0,
      grid: null, items: {}, hidden: {}, bombs: [], flames: {}, enemies: [], players: [], boss: null, hatch: null,
      ff: !!opts.friendlyFire, nplayers: NP, nextLife: EXTRA_LIFE, over: false, won: false, name: '', levelT: 0, clearBonus: 0, debris: [], banner: 0
    };
    for (var i = 0; i < NP; i++) {
      S.players.push({ i: i, x: SPAWNS[i][0], y: SPAWNS[i][1], alive: true, lives: opts.lives || 3, out: false,
        bombs: 1, flame: 2, speed: 0, kick: false, relay: false, inv: 0, deadT: 0, want: { x: 0, y: 0 }, axis: 'x', face: 'down', walk: 0, moving: false });
    }

    function cellOf(o) { return idx(rnd(o.x), rnd(o.y)); }
    function bombAt(x, y) { for (var j = 0; j < S.bombs.length; j++) { var b = S.bombs[j]; if (rnd(b.x) === x && rnd(b.y) === y) return b; } return null; }
    function free(x, y) { return inside(x, y) && S.grid[idx(x, y)] === FLOOR && !bombAt(x, y); }

    function loadLevel() {
      var L = buildLevel(S.level, rng), lv = LEVELS[S.level - 1];
      S.grid = L.grid; S.hidden = L.hidden; S.items = {}; S.bombs = []; S.flames = {}; S.debris = [];
      S.hatch = { x: L.hatch.x, y: L.hatch.y, open: false };
      S.name = lv.name; S.levelT = 0;
      var mul = diff(S.level, 1, 0.025, 1.2);
      S.enemies = L.enemies.map(function (e) { return mkEnemy(e.type, e.x, e.y, mul); });
      S.boss = L.boss ? { x: L.boss.x, y: L.boss.y, tx: L.boss.x, ty: L.boss.y, px: L.boss.x, py: L.boss.y,
        hp: BOSS_HP, max: BOSS_HP, inv: 0, alive: true, dir: [0, 1], spawnT: 4, bombT: 3, flash: 0, speed: 1.8 } : null;
      S.players.forEach(function (p) {
        p.x = SPAWNS[p.i][0]; p.y = SPAWNS[p.i][1]; p.want = { x: 0, y: 0 }; p.face = 'down'; p.moving = false;
        if (!p.out) { p.alive = true; p.inv = 0; p.deadT = 0; }
      });
      S.phase = 'ready'; S.phaseT = 0; S.banner = 1.4;
      emit('level', { level: S.level });
    }
    function mkEnemy(type, x, y, mul) {
      return { type: type, x: x, y: y, tx: x, ty: y, px: x, py: y, dir: DIRS[Math.floor(rng() * 4)], speed: ENEMY[type].speed * (mul || 1), alive: true, think: 0, t: rng() * 10 };
    }

    // ---------- Движение подрывника (поклеточно с «доводкой» на углах) ----------
    function approach(v, t, d) { return v < t ? Math.min(t, v + d) : Math.max(t, v - d); }
    function tryAxis(p, ax, s, dist) {
      // ax: 'x'|'y', s: ±1. → true, если удалось сдвинуться
      var along = ax === 'x' ? 'x' : 'y', perp = ax === 'x' ? 'y' : 'x';
      var c = rnd(p[perp]), off = p[perp] - c, ca = rnd(p[along]);
      var aheadX = ax === 'x' ? ca + s : c, aheadY = ax === 'x' ? c : ca + s;
      if (Math.abs(off) > 0.02) {
        // не на линии: доводим к центру ряда, если впереди свободно, иначе — к соседнему ряду
        if (free(aheadX, aheadY)) { p[perp] = approach(p[perp], c, dist); return true; }
        var c2 = c + (off > 0 ? 1 : -1), ax2 = ax === 'x' ? ca + s : c2, ay2 = ax === 'x' ? c2 : ca + s;
        if (Math.abs(off) > 0.22 && free(ax2, ay2) && free(ax === 'x' ? ca : c2, ax === 'x' ? c2 : ca)) { p[perp] = approach(p[perp], c2, dist); return true; }
        return false;
      }
      p[perp] = c;
      if (free(aheadX, aheadY)) { p[along] += s * dist; return true; }
      var b = bombAt(aheadX, aheadY);
      if (b && p.kick && !b.slide && Math.abs(p[along] - ca) < 0.08) { b.slide = { dx: ax === 'x' ? s : 0, dy: ax === 'y' ? s : 0 }; emit('kick', { x: b.x, y: b.y }); }
      if (Math.abs(p[along] - ca) > 1e-6) { p[along] = approach(p[along], ca, dist); return true; }
      return false;
    }
    function movePlayer(p, dt) {
      var w = p.want, dist = (BASE_SPEED + p.speed * SPEED_STEP) * dt, moved = false;
      if (w.x || w.y) {
        var order;
        if (w.x && w.y) order = p.axis === 'x' ? ['y', 'x'] : ['x', 'y'];   // зажаты обе — пробуем повернуть
        else order = [w.x ? 'x' : 'y'];
        for (var k = 0; k < order.length && !moved; k++) {
          var ax = order[k], s = ax === 'x' ? w.x : w.y;
          if (tryAxis(p, ax, s, dist)) { moved = true; p.axis = ax; p.face = ax === 'x' ? (s > 0 ? 'right' : 'left') : (s > 0 ? 'down' : 'up'); }
        }
      }
      p.moving = moved; if (moved) p.walk += dt;
    }

    // ---------- Бомбы и пламя ----------
    function placeBomb(pi) {
      var p = S.players[pi];
      if (!p || !p.alive || S.phase !== 'play') return false;
      var x = rnd(p.x), y = rnd(p.y);
      if (S.grid[idx(x, y)] !== FLOOR || bombAt(x, y)) return false;
      var own = S.bombs.filter(function (b) { return b.owner === pi; }).length;
      if (own >= p.bombs) return false;
      S.bombs.push({ x: x, y: y, owner: pi, fuse: FUSE, relay: p.relay, r: p.flame, slide: null, t: 0 });
      emit('bomb', { x: x, y: y, owner: pi });
      return true;
    }
    function detonate(pi) {
      var n = 0;
      S.bombs.forEach(function (b) { if (b.owner === pi && b.relay && !b.slide) { b.fuse = 0; b.relay = false; n++; } });
      if (n) emit('detonate', { owner: pi });
      return n;
    }
    function maskOf(owner) { return owner === 0 ? 1 : owner === 1 ? 2 : 4; }
    function explode(b) {
      var x = rnd(b.x), y = rnd(b.y), cells = blast(S.grid, x, y, b.r), m = maskOf(b.owner);
      S.bombs.splice(S.bombs.indexOf(b), 1);
      cells.forEach(function (c) {
        var i = idx(c.x, c.y), f = S.flames[i];
        if (!f) f = S.flames[i] = { t: FLAME_T, mask: 0, h: false, v: false, c: false, end: false, d: c.d };
        f.t = FLAME_T; f.mask |= m;
        if (c.kind === 'c') f.c = true; else if (c.kind === 'h') f.h = true; else f.v = true;
        if (c.end) f.end = true;
        if (c.crate) {
          S.grid[i] = FLOOR; S.score += 10; S.debris.push({ x: c.x, y: c.y, t: 0.5 });
          if (S.hidden[i]) { S.items[i] = S.hidden[i]; delete S.hidden[i]; emit('reveal', { x: c.x, y: c.y, kind: S.items[i] }); }
          emit('crate', { x: c.x, y: c.y });
        }
        var nb = bombAt(c.x, c.y);
        if (nb && nb.fuse > 0) { nb.fuse = 0; nb.relay = false; nb.chain = true; }
      });
      emit('boom', { x: x, y: y, r: b.r, chain: !!b.chain });
    }
    function bombBlocked(x, y) {
      if (!inside(x, y) || S.grid[idx(x, y)] !== FLOOR || bombAt(x, y)) return true;
      if (S.hatch && x === S.hatch.x && y === S.hatch.y) return false;
      for (var j = 0; j < S.enemies.length; j++) if (rnd(S.enemies[j].x) === x && rnd(S.enemies[j].y) === y) return true;
      for (j = 0; j < S.players.length; j++) { var p = S.players[j]; if (p.alive && rnd(p.x) === x && rnd(p.y) === y) return true; }
      if (S.boss && S.boss.alive && Math.abs(S.boss.x - x) < 1 && Math.abs(S.boss.y - y) < 1) return true;
      return false;
    }
    function updateBombs(dt) {
      S.bombs.forEach(function (b) {
        b.t += dt;
        var ownerP = S.players[b.owner];
        if (b.relay && ownerP && ownerP.alive) { /* ждёт РЕЛЕ */ } else { b.relay = false; b.fuse -= dt; }
        if (b.slide) {
          var cx = rnd(b.x), cy = rnd(b.y), d = SLIDE_V * dt, nx = cx + b.slide.dx, ny = cy + b.slide.dy;
          var past = (b.x - cx) * b.slide.dx + (b.y - cy) * b.slide.dy;   // >0 — уже за центром клетки
          S.bombs.splice(S.bombs.indexOf(b), 1);   // временно убрать, чтобы не мешала себе
          var blocked = bombBlocked(nx, ny);
          S.bombs.push(b);
          if (blocked && past >= -1e-6) { b.x = cx; b.y = cy; b.slide = null; emit('stop', {}); }
          else if (blocked) { b.x = approach(b.x, cx, d); b.y = approach(b.y, cy, d); }
          else { b.x += b.slide.dx * d; b.y += b.slide.dy * d; }
        }
      });
      var guard = 0;
      while (guard++ < 64) {
        var nb = null;
        for (var j = 0; j < S.bombs.length; j++) if (S.bombs[j].fuse <= 0) { nb = S.bombs[j]; break; }
        if (!nb) break;
        explode(nb);
      }
      for (var k in S.flames) { S.flames[k].t -= dt; if (S.flames[k].t <= 0) delete S.flames[k]; }
      S.debris = S.debris.filter(function (o) { o.t -= dt; return o.t > 0; });
    }

    // ---------- Враги ----------
    function enemyPass(e, x, y) {
      if (!inside(x, y)) return false;
      var c = S.grid[idx(x, y)];
      if (c === WALL) return false;
      if (c === CRATE && !(e.type === 'ghost')) return false;
      return !bombAt(x, y);
    }
    function nearestPlayer(x, y) {
      var best = null, bd = 1e9;
      S.players.forEach(function (p) { if (!p.alive) return; var d = Math.abs(p.x - x) + Math.abs(p.y - y); if (d < bd) { bd = d; best = p; } });
      return best ? { p: best, d: bd } : null;
    }
    function stepToward(e, tx, ty) {
      var d = bfs(tx, ty, function (x, y) { return enemyPass(e, x, y) || (x === e.x && y === e.y); });
      var best = null, bd = 1e9;
      for (var k = 0; k < 4; k++) {
        var nx = e.x + DIRS[k][0], ny = e.y + DIRS[k][1];
        if (!enemyPass(e, nx, ny)) continue;
        var v = d[idx(nx, ny)];
        if (v >= 0 && v < bd) { bd = v; best = DIRS[k]; }
      }
      return best;
    }
    function chooseDir(e) {
      var opts2 = DIRS.filter(function (dd) { return enemyPass(e, e.x + dd[0], e.y + dd[1]); });
      if (!opts2.length) return null;
      var rev = function (dd) { return dd[0] === -e.dir[0] && dd[1] === -e.dir[1]; };
      var keep = opts2.filter(function (dd) { return dd[0] === e.dir[0] && dd[1] === e.dir[1]; })[0];
      var near = nearestPlayer(e.x, e.y);
      if ((e.type === 'chaser' || e.boss) && near && near.d <= (e.boss ? 99 : CHASE_R) && rng() < (e.boss ? 0.8 : CHASE_P)) {
        var st = stepToward(e, rnd(near.p.x), rnd(near.p.y));
        if (st) return st;
      }
      if (e.type === 'ghost' && near && rng() < 0.4) {
        var toward = opts2.filter(function (dd) { return Math.abs(e.x + dd[0] - near.p.x) + Math.abs(e.y + dd[1] - near.p.y) < near.d; });
        if (toward.length) return toward[Math.floor(rng() * toward.length)];
      }
      var turn = e.type === 'fast' ? 0.35 : 0.18;
      if (keep && (opts2.length <= 2 || rng() > turn)) return keep;
      var fwd = opts2.filter(function (dd) { return !rev(dd); });
      var pool = fwd.length ? fwd : opts2;
      return pool[Math.floor(rng() * pool.length)];
    }
    function moveMover(e, dt) {
      // e: {x,y,tx,ty,px,py,dir,speed}; поклеточно
      if (e.x === e.tx && e.y === e.ty) {
        var dd = chooseDir(e);
        if (!dd) return;
        e.dir = dd; e.px = e.x; e.py = e.y; e.tx = e.x + dd[0]; e.ty = e.y + dd[1];
      } else if (bombAt(e.tx, e.ty) && !(e.boss && Math.abs(e.x - e.tx) + Math.abs(e.y - e.ty) < 0.5)) {
        // перед носом бомба — разворот
        var ox = e.tx, oy = e.ty; e.tx = e.px; e.ty = e.py; e.px = ox; e.py = oy; e.dir = [-e.dir[0], -e.dir[1]];
      }
      var d = e.speed * dt;
      e.x = approach(e.x, e.tx, d); e.y = approach(e.y, e.ty, d);
    }
    function updateEnemies(dt) {
      S.enemies.forEach(function (e) { e.t += dt; moveMover(e, dt); });
      var B = S.boss;
      if (B && B.alive) {
        B.inv = Math.max(0, B.inv - dt); B.flash = Math.max(0, B.flash - dt);
        B.speed = B.hp <= B.max / 2 ? 2.5 : 1.8;
        B.boss = true; B.type = 'boss';
        moveMover(B, dt);
        B.spawnT -= dt;
        if (B.spawnT <= 0) {
          B.spawnT = 6.5;
          if (S.enemies.length < 3) {
            var mt = B.hp <= B.max / 2 ? 'chaser' : 'wander', sx = rnd(B.x), sy = rnd(B.y);
            var e = mkEnemy(mt, sx, sy, 1); S.enemies.push(e); emit('spawn', { x: sx, y: sy });
          }
        }
        if (B.hp <= B.max / 2) {
          B.bombT -= dt;
          if (B.bombT <= 0 && B.x === B.tx && B.y === B.ty && !bombAt(B.x, B.y)) {
            B.bombT = 4.2; S.bombs.push({ x: B.x, y: B.y, owner: -1, fuse: FUSE, relay: false, r: 2, slide: null, t: 0 });
            emit('bomb', { x: B.x, y: B.y, owner: -1 });
          }
        }
      }
    }

    // ---------- Урон, бонусы, люк ----------
    function killPlayer(p, why) {
      if (!p.alive) return;
      p.alive = false; p.lives--; p.deadT = 0; p.kick = false; p.relay = false;
      S.bombs.forEach(function (b) { if (b.owner === p.i && b.relay) { b.relay = false; b.fuse = Math.min(b.fuse, FUSE); } });
      emit('die', { player: p.i, x: p.x, y: p.y, lives: p.lives, why: why });
      if (p.lives <= 0) p.out = true;
    }
    function hurts(f, pi) {
      if (f.mask & 4) return true;
      if (f.mask & (pi === 0 ? 1 : 2)) return true;
      return S.ff && (f.mask & (pi === 0 ? 2 : 1)) !== 0;
    }
    function checkHits() {
      // враги в огне
      for (var j = S.enemies.length - 1; j >= 0; j--) {
        var e = S.enemies[j], f = S.flames[cellOf(e)];
        if (f) { S.enemies.splice(j, 1); var sc = ENEMY[e.type].score; S.score += sc; emit('kill', { x: e.x, y: e.y, type: e.type, score: sc }); }
      }
      // Жернов
      var B = S.boss;
      if (B && B.alive && B.inv <= 0) {
        var hit = false;
        for (var yy = Math.floor(B.y); yy <= Math.ceil(B.y); yy++) for (var xx = Math.floor(B.x); xx <= Math.ceil(B.x); xx++) {
          var fb = S.flames[idx(xx, yy)];
          if (fb && (fb.mask & 3) && Math.abs(xx - B.x) < 0.95 && Math.abs(yy - B.y) < 0.95) hit = true;
        }
        if (hit) {
          B.hp--; B.inv = 1.2; B.flash = 0.4; S.score += 100;
          emit('bossHit', { x: B.x, y: B.y, hp: B.hp });
          if (B.hp <= 0) {
            B.alive = false; S.score += 5000; emit('bossDie', { x: B.x, y: B.y });
            S.enemies.forEach(function (e) { S.score += ENEMY[e.type].score; emit('kill', { x: e.x, y: e.y, type: e.type, score: ENEMY[e.type].score }); });
            S.enemies = [];
          }
        }
      }
      // игроки: огонь и касание врагов
      S.players.forEach(function (p) {
        if (!p.alive || p.inv > 0) return;
        var f = S.flames[cellOf(p)];
        if (f && hurts(f, p.i)) { killPlayer(p, 'fire'); return; }
        for (var k = 0; k < S.enemies.length; k++) {
          var e = S.enemies[k];
          if (Math.abs(e.x - p.x) < TOUCH && Math.abs(e.y - p.y) < TOUCH) { killPlayer(p, 'enemy'); return; }
        }
        if (B && B.alive && Math.abs(B.x - p.x) < 0.9 && Math.abs(B.y - p.y) < 0.9) killPlayer(p, 'boss');
      });
    }
    function pickups() {
      S.players.forEach(function (p) {
        if (!p.alive) return;
        var i = cellOf(p), k = S.items[i];
        if (!k) return;
        delete S.items[i];
        if (k === 'bomb') p.bombs = Math.min(POWERS.bomb.max, p.bombs + 1);
        else if (k === 'flame') p.flame = Math.min(POWERS.flame.max, p.flame + 1);
        else if (k === 'speed') p.speed = Math.min(POWERS.speed.max, p.speed + 1);
        else if (k === 'kick') p.kick = true;
        else if (k === 'relay') p.relay = true;
        S.score += 50;
        emit('power', { player: p.i, kind: k, x: rnd(p.x), y: rnd(p.y) });
      });
    }
    function checkHatch() {
      var open = S.enemies.length === 0 && !(S.boss && S.boss.alive);
      if (open && !S.hatch.open) { S.hatch.open = true; emit('open', { x: S.hatch.x, y: S.hatch.y }); }
      if (!S.hatch.open) return;
      for (var j = 0; j < S.players.length; j++) {
        var p = S.players[j];
        if (p.alive && rnd(p.x) === S.hatch.x && rnd(p.y) === S.hatch.y && Math.abs(p.x - S.hatch.x) + Math.abs(p.y - S.hatch.y) < 0.4) {
          var tb = Math.max(0, Math.round(200 - S.levelT)) * 5;
          S.clearBonus = 500 * S.level + tb; S.score += S.clearBonus;
          S.phase = 'clear'; S.phaseT = 0; emit('clear', { level: S.level, bonus: S.clearBonus });
          return;
        }
      }
    }
    function updatePlayers(dt) {
      S.players.forEach(function (p) {
        if (p.alive) { p.inv = Math.max(0, p.inv - dt); movePlayer(p, dt); return; }
        if (p.out) return;
        p.deadT += dt;
        if (p.deadT >= RESPAWN_T) {
          p.alive = true; p.x = SPAWNS[p.i][0]; p.y = SPAWNS[p.i][1]; p.inv = INV_T; p.deadT = 0;
          emit('respawn', { player: p.i });
        }
      });
    }

    // За каждые EXTRA_LIFE очков — +1 жизнь каждому, кто ещё в игре (выбывший не возвращается)
    function extraLife() {
      while (S.score >= S.nextLife) {
        S.nextLife += EXTRA_LIFE;
        S.players.forEach(function (p) { if (!p.out && p.lives < MAX_LIVES) p.lives++; });
        emit('life', { score: S.nextLife - EXTRA_LIFE });
      }
    }
    function update(dt) {
      if (S.over) return;
      S.time += dt; S.phaseT += dt; S.banner = Math.max(0, S.banner - dt);
      if (S.phase === 'ready') {
        if (S.phaseT >= 1.0) { S.phase = 'play'; S.phaseT = 0; }
        updatePlayers(dt);   // ходить уже можно, враги ждут
        return;
      }
      if (S.phase === 'clear') {
        if (S.phaseT >= 2.0) {
          if (S.level >= S.maxLevel) { S.over = true; S.won = true; S.phase = 'over'; emit('win', { score: S.score }); }
          else { S.level++; loadLevel(); }
        }
        return;
      }
      if (S.phase !== 'play') return;
      S.levelT += dt;
      updatePlayers(dt);
      updateBombs(dt);
      updateEnemies(dt);
      checkHits();
      pickups();
      extraLife();
      if (S.players.every(function (p) { return p.out; })) {
        S.over = true; S.phase = 'over'; emit('gameover', { score: S.score }); return;
      }
      checkHatch();
    }

    var api = {
      start: function () { loadLevel(); return api; },
      update: update,
      setDir: function (pi, dx, dy) { var p = S.players[pi]; if (p) { p.want.x = dx | 0; p.want.y = dy | 0; } },
      bomb: placeBomb,
      detonate: detonate,
      setFF: function (on) { S.ff = !!on; },
      state: function () { return S; },
      _S: S,
      _explode: explode, _bombAt: bombAt, _loadLevel: loadLevel, _mkEnemy: mkEnemy
    };
    return api;
  }

  F.logic = {
    COLS: COLS, ROWS: ROWS, FLOOR: FLOOR, WALL: WALL, CRATE: CRATE, FUSE: FUSE, FLAME_T: FLAME_T, SLIDE_V: SLIDE_V,
    BASE_SPEED: BASE_SPEED, SPEED_STEP: SPEED_STEP, RESPAWN_T: RESPAWN_T, INV_T: INV_T, DIRS: DIRS, SPAWNS: SPAWNS,
    BIND: BIND, POWERS: POWERS, ENEMY: ENEMY, BOSS_HP: BOSS_HP, TOUCH: TOUCH, EXTRA_LIFE: EXTRA_LIFE, CHASE_R: CHASE_R, CHASE_P: CHASE_P, LEVELS: LEVELS, WALLS: WALLS,
    idx: idx, inside: inside, bfs: bfs, connected: connected, buildLevel: buildLevel, blast: blast
  };
  F.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
