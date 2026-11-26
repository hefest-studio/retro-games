/* УДАЛЕЦ · логика (без DOM, детерминирована при заданном rng).
   Переделка 2026-11: главная механика — кузнечные МЕХИ. Удалец раздувает остывшие горны цеха (по 3 выдоха на горн);
   цех пройден, когда пылают все горны. Тем же выдохом он гасит искрокрылов, оглушает и сдувает обитателей (в шипы,
   огонь и кислоту), гасит угольки плевунов и раскручивает крыльчатки, которые поднимают заслонки. Выдох вниз в прыжке —
   подскок (раз за прыжок). Продухи в полу дают восходящий поток — на нём поднимаются в верхние ярусы.
   Уровень — сетка экранов 26×15 клеток, склеенных в одну карту; камера плавно следует за героем (main.js/render.js).
   Координаты — в клетках: hero.x — центр, hero.y — подошвы. Физика общая для игры и графа проходимости (heroStep).
   UDALETS.Game(opts) · UDALETS.logic */
(function (global) {
  'use strict';
  var U = global.UDALETS = global.UDALETS || {};

  var COLS = 26, ROWS = 15, T = 24;
  var RUN = 6, JV = 18.5, GRAV = 52, VMAX = 20, HW = 0.35, HH = 1.4, COY = 0.07, JBUF = 0.1;
  var LIFT_V = 15, PUFF_CD = 0.32, GUST_R = 3.5, HEAT_NEED = 3;
  var UP_H = 9, UPV = 6.5, UPA = 70;
  var ENEMY_UP = 0.09;   // обитатели к 10-му цеху быстрее (+9 % за уровень)
  var STUN = { w: 1.3, v: 1.6, s: 2.0 }, PUSH_V = 9, PUSH_T = 0.28;
  var LIVES = 3, LIFE_MAX = 5, LIFE_EVERY = 30000, INV_RESPAWN = 2, PAR_TIME = 150;
  var PTS = { '.': 50, g: 150, b: 300, R: 500, O: 1000, kill: 200, drop: 300, clear: 500, sec: 10 };
  var SOLID = { '#': 1, '=': 1, u: 1, H: 1 }, HAZ = { '^': 1, '~': 1, a: 1 };
  var ITEMS = { '.': 1, g: 1, b: 1, R: 1, '+': 1 };
  var ENEMY = { w: 1, f: 1, v: 1, s: 1 };
  var ESPD = { w: 2.8, f: 3.2, v: 2.8, s: 2.0 };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---------- Уровень: сетка экранов → одна карта ----------
  function build(def, idx) {
    var grid = def.grid || [def.rooms.map(function (_, i) { return i; })];
    var rh = grid.length, rw = 0; grid.forEach(function (r) { rw = Math.max(rw, r.length); });
    var w = rw * COLS, h = rh * ROWS, t = new Array(w * h);
    var LV = { idx: idx, def: def, w: w, h: h, rw: rw, rh: rh, t: t, items: [], spawns: [], start: null, furn: [], vanes: [], shut: [], vents: [], signs: [], up: {}, ver: 0, theme: def.theme || 0 };
    for (var i = 0; i < t.length; i++) t[i] = '#';
    grid.forEach(function (row, ry) {
      row.forEach(function (ri, rx) {
        if (ri == null) return;
        var room = def.rooms[ri];
        if (room.length !== ROWS) throw new Error('уровень ' + idx + ' экран ' + ri + ': строк ' + room.length);
        room.forEach(function (line, r) {
          if (line.length !== COLS) throw new Error('уровень ' + idx + ' экран ' + ri + ' строка ' + r + ': длина ' + line.length);
          for (var c = 0; c < COLS; c++) {
            var ch = line[c], X = rx * COLS + c, Y = ry * ROWS + r, k = Y * w + X, rm = ry * rw + rx;
            if (SOLID[ch] || HAZ[ch] || ch === '%' || ch === ' ') {
              t[k] = ch;
              if (ch === 'u') LV.vents.push({ c: X, r: Y });
              else if (ch === 'H') LV.shut.push({ id: LV.shut.length, c: X, r: Y, room: rm });
              continue;
            }
            t[k] = ' ';
            if (ch === 'P') LV.start = { c: X, r: Y + 1 };
            else if (ch === 'O') LV.furn.push({ id: LV.furn.length, c: X, r: Y, room: rm });
            else if (ch === 'Y') LV.vanes.push({ id: LV.vanes.length, c: X, r: Y, room: rm });
            else if (ch === 'i') LV.signs.push({ c: X, r: Y });
            else if (ITEMS[ch]) LV.items.push({ id: LV.items.length, k: ch, c: X, r: Y });
            else if (ENEMY[ch]) LV.spawns.push({ k: ch, c: X, r: Y, room: rm });
            else throw new Error('уровень ' + idx + ': неизвестный знак «' + ch + '»');
          }
        });
      });
    });
    if (!LV.start) throw new Error('уровень ' + idx + ': нет старта');
    if (!LV.furn.length) throw new Error('уровень ' + idx + ': нет горнов');
    // восходящие потоки: столб над продухом — до UP_H клеток или до тверди
    LV.vents.forEach(function (v) {
      var top = v.r;
      for (var r = v.r - 1; r >= Math.max(0, v.r - UP_H); r--) { if (SOLID[t[r * w + v.c]]) break; top = r; }
      v.top = top; LV.up[v.c] = (LV.up[v.c] || []).concat([{ top: top, bot: v.r }]);
    });
    return LV;
  }
  function tile(LV, c, r) { return c < 0 || r < 0 || c >= LV.w || r >= LV.h ? '#' : LV.t[r * LV.w + c]; }
  function isSolid(LV, c, r) { return !!SOLID[tile(LV, c, r)]; }
  function isHaz(LV, c, r) { return !!HAZ[tile(LV, c, r)]; }
  function free(LV, c, r) { var ch = tile(LV, c, r); return !SOLID[ch] && !HAZ[ch]; }
  function roomAt(LV, x, y) { var rx = clamp(Math.floor(x / COLS), 0, LV.rw - 1), ry = clamp(Math.floor(y / ROWS), 0, LV.rh - 1); return ry * LV.rw + rx; }
  function roomBox(LV, room) { var rx = room % LV.rw, ry = Math.floor(room / LV.rw); return { x0: rx * COLS, y0: ry * ROWS, x1: rx * COLS + COLS, y1: ry * ROWS + ROWS }; }
  // восходящий поток: центр героя над продухом, середина тела — в столбе
  function updraft(LV, H) {
    var cols = LV.up[Math.floor(H.x)]; if (!cols) return null;
    var mid = H.y - 0.7;
    for (var i = 0; i < cols.length; i++) if (mid >= cols[i].top && mid < cols[i].bot) return cols[i];
    return null;
  }
  // заслонки экрана поднимаются (насовсем): клетки становятся проходимыми
  function openShutters(LV, room) {
    var n = 0;
    LV.shut.forEach(function (s) { if (s.room === room && !s.open) { s.open = true; LV.t[s.r * LV.w + s.c] = ' '; n++; } });
    if (n) LV.ver++;
    return n;
  }

  // ---------- Физика героя (общая для игры и графа) ----------
  function newHero(c, r) { return { x: c + 0.5, y: r, vx: 0, vy: 0, ground: true, face: 1, coy: COY, jb: 0, jl: false, air: 1, walkT: 0, up: false }; }
  function hitSolidX(LV, H) {
    var top = Math.floor(H.y - HH + 1e-3), bot = Math.floor(H.y - 1e-3), r;
    if (H.vx > 0) { var cr = Math.floor(H.x + HW); for (r = top; r <= bot; r++) if (isSolid(LV, cr, r)) { H.x = cr - HW - 1e-4; return true; } }
    else if (H.vx < 0) { var cl = Math.floor(H.x - HW); for (r = top; r <= bot; r++) if (isSolid(LV, cl, r)) { H.x = cl + 1 + HW + 1e-4; return true; } }
    return false;
  }
  function hitSolidY(LV, H) {
    var c0 = Math.floor(H.x - HW + 1e-3), c1 = Math.floor(H.x + HW - 1e-3), c;
    if (H.vy > 0) { var rb = Math.floor(H.y - 1e-3); for (c = c0; c <= c1; c++) if (isSolid(LV, c, rb)) { H.y = rb; H.vy = 0; H.ground = true; return true; } }
    else if (H.vy < 0) { var rt = Math.floor(H.y - HH); for (c = c0; c <= c1; c++) if (isSolid(LV, c, rt)) { H.y = rt + 1 + HH + 1e-4; H.vy = 0; return true; } }
    return false;
  }
  // inp: {dx (-1..1, допускается дробное), dy, jump (зажат), lift (выдох вниз в воздухе — в этот шаг)}; → {jumped, landed, bump, lifted}
  function heroStep(LV, H, inp, dt) {
    var ev = { jumped: false, landed: false, bump: false, lifted: false }, wasGround = H.ground;
    var jumpEdge = inp.jump && !H.jl; H.jl = !!inp.jump;
    if (inp.dx) H.face = inp.dx > 0 ? 1 : -1;
    H.vx = inp.dx * RUN;
    if (jumpEdge) H.jb = JBUF; else H.jb = Math.max(0, H.jb - dt);
    if (H.jb > 0 && (H.ground || H.coy > 0)) { H.vy = -JV; H.ground = false; H.coy = 0; H.jb = 0; ev.jumped = true; }
    if (inp.lift && !H.ground && H.air > 0) { H.vy = -LIFT_V; H.air = 0; ev.lifted = true; }
    var up = inp.dy > 0.5 ? null : updraft(LV, H); H.up = !!up;   // «вниз» зажато — поток не держит
    if (up) H.vy = H.vy > -UPV ? Math.max(-UPV, H.vy - UPA * dt) : Math.min(-UPV, H.vy + UPA * dt);
    else H.vy = Math.min(VMAX, H.vy + GRAV * dt);
    H.x += H.vx * dt; if (hitSolidX(LV, H)) ev.bump = true;
    H.ground = false;
    var vyBefore = H.vy;
    H.y += H.vy * dt; if (hitSolidY(LV, H) && vyBefore < 0) ev.bump = true;
    if (H.ground) { H.coy = COY; H.air = 1; if (!wasGround) ev.landed = true; } else H.coy = Math.max(0, H.coy - dt);
    if (H.ground && H.vx) H.walkT += dt * Math.abs(H.vx);
    return ev;
  }
  // касание шипов/огня/кислоты: опасная часть клетки — нижние 55%
  function hazardHit(LV, H) {
    var c0 = Math.floor(H.x - 0.28), c1 = Math.floor(H.x + 0.28), r0 = Math.floor(H.y - 1.25), r1 = Math.floor(H.y - 1e-3);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (isHaz(LV, c, r) && H.y > r + 0.45) return tile(LV, c, r);
    return null;
  }
  function overlapCell(H, c, r, m) { m = m || 0.15; return H.x + HW > c + m && H.x - HW < c + 1 - m && H.y > r + m && H.y - HH < r + 1 - m; }

  // ---------- Выдох мехов: область действия ----------
  // dir: 1 / −1 — по горизонтали (куда смотрит герой), 'down' — вниз. Дальность — до тверди, не больше GUST_R.
  function gustBox(LV, H, dir) {
    var oy = H.y - 0.75, d, reach = 0, s;
    if (dir === 'down') {
      for (s = 0.25; s <= GUST_R; s += 0.25) { if (isSolid(LV, Math.floor(H.x), Math.floor(H.y - 0.2 + s))) break; reach = s; }
      return { x0: H.x - 0.7, x1: H.x + 0.7, y0: H.y - 0.6, y1: H.y + reach, dir: 'down', reach: reach };
    }
    d = dir > 0 ? 1 : -1;
    for (s = 0.25; s <= GUST_R; s += 0.25) { if (isSolid(LV, Math.floor(H.x + d * s), Math.floor(oy))) break; reach = s; }
    var xa = H.x - d * 0.2, xb = H.x + d * (reach + 0.35);
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: H.y - 1.5, y1: H.y + 0.1, dir: d, reach: reach };
  }
  function boxHitsCell(b, c, r) { return b.x1 > c + 0.05 && b.x0 < c + 0.95 && b.y1 > r + 0.05 && b.y0 < r + 0.95; }
  function boxHits(b, o) { return b.x1 > o.x0 && b.x0 < o.x1 && b.y1 > o.y0 && b.y0 < o.y1; }

  // ---------- Обитатели (детерминированно, двигаются, только когда герой рядом) ----------
  var NEAR_X = 16, NEAR_Y = 11;
  function near(e, H) { return Math.abs(e.x - H.x) < NEAR_X && Math.abs(e.y - H.y) < NEAR_Y; }
  function spawnEnemy(LV, s, i) {
    var e = { id: i, k: s.k, room: s.room, alive: true, dir: (s.c % 2) ? 1 : -1, t: 0, cd: 1.2 + (i % 3) * 0.5, stun: 0, pt: 0, pv: 0, vy: 0, fall: false };
    if (s.k === 'w') { e.x = s.c + 0.5; e.y = s.r + 1; }
    else { e.x = s.c + 0.5; e.y = s.r + 0.5; e.y0 = e.y; e.ph = (i * 1.7) % 6.28; }
    if (s.k === 'v') e.dir = 1;
    return e;
  }
  function enemyBox(e) { return e.k === 'w' ? { x0: e.x - 0.4, x1: e.x + 0.4, y0: e.y - 0.9, y1: e.y } : { x0: e.x - 0.4, x1: e.x + 0.4, y0: e.y - 0.35, y1: e.y + 0.35 }; }
  // → null | 'shoot' | 'drop' (ходок сдут в опасность или за край карты)
  function enemyStep(LV, e, dt, hero, shots) {
    var B = roomBox(LV, e.room), sp = ESPD[e.k] * (e.mul || 1), nx, col;
    e.t += dt;
    if (e.pt > 0) {   // сдувает выдохом
      e.pt -= dt; nx = e.x + e.pv * dt;
      var cx = Math.floor(nx + Math.sign(e.pv) * 0.4), rowM = Math.floor(e.k === 'w' ? e.y - 0.5 : e.y);
      if (cx >= B.x0 && cx < B.x1 && !isSolid(LV, cx, rowM) && (e.k !== 'w' || !isSolid(LV, cx, Math.floor(e.y - 0.95)))) e.x = nx; else e.pt = 0;
    }
    if (e.k === 'w') {
      if (!e.fall && !isSolid(LV, Math.floor(e.x), Math.floor(e.y + 0.01))) { e.fall = true; e.vy = 0; }
      if (e.fall) {
        e.vy = Math.min(VMAX, e.vy + GRAV * dt); var ny0 = e.y + e.vy * dt;
        if (isSolid(LV, Math.floor(e.x), Math.floor(ny0))) { e.y = Math.floor(ny0); e.vy = 0; e.fall = false; } else e.y = ny0;
        if (e.y >= LV.h) return 'drop';
      }
      if (isHaz(LV, Math.floor(e.x), Math.floor(e.y - 0.3))) return 'drop';
    }
    if (e.stun > 0) { e.stun -= dt; if (e.k !== 'w' && e.k !== 'f') e.cd = Math.max(e.cd, 1.2); return null; }
    if (e.k === 'w') {
      if (e.fall) return null;
      nx = e.x + e.dir * sp * dt; col = Math.floor(nx + e.dir * 0.45);
      if (col < B.x0 || col >= B.x1 || isSolid(LV, col, e.y - 1) || !isSolid(LV, col, e.y) || isHaz(LV, col, e.y - 1)) e.dir = -e.dir; else e.x = nx;
    } else if (e.k === 'v') {
      var ny = e.y + e.dir * sp * dt, row = Math.floor(ny + e.dir * 0.5);
      if (row < B.y0 || row >= B.y1 || !free(LV, Math.floor(e.x), row)) e.dir = -e.dir; else e.y = ny;
    } else {
      nx = e.x + e.dir * sp * dt; col = Math.floor(nx + e.dir * 0.5);
      if (col < B.x0 || col >= B.x1 || !free(LV, col, Math.floor(e.y0))) e.dir = -e.dir; else e.x = nx;
      e.y = e.y0 + 0.55 * Math.sin(e.t * 2.6 + e.ph);
      if (e.k === 's' && hero && shots) {
        if (Math.abs((hero.y - 0.8) - e.y) < 3.5) e.cd -= dt;
        if (e.cd <= 0) { e.cd = 2.4 / (e.mul || 1); var d = hero.x > e.x ? 1 : -1; shots.push({ x: e.x + d * 0.4, y: e.y, vx: d * 6, room: e.room, alive: true }); return 'shoot'; }
      }
    }
    return null;
  }
  function shotStep(LV, b, dt) {
    var B = roomBox(LV, b.room); b.x += b.vx * dt;
    if (b.x < B.x0 || b.x >= B.x1 || isSolid(LV, Math.floor(b.x), Math.floor(b.y))) b.alive = false;
  }
  function heroTouches(H, bx, m) { m = m || 0; return H.x + HW - 0.08 + m > bx.x0 && H.x - HW + 0.08 - m < bx.x1 && H.y - 0.05 + m > bx.y0 && H.y - HH + 0.15 - m < bx.y1; }
  function harmful(e) { return e.alive && !(e.stun > 0) && !e.fall; }

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var emit = opts.onEvent || function () {};
    var DEFS = opts.levels || U.LEVELS;
    var S = {
      phase: 'play', phaseT: 0, level: 1, LV: null, score: 0, lives: opts.lives || LIVES, nextLife: LIFE_EVERY,
      hero: null, got: {}, heat: [], lit: 0, spun: {}, enemies: [], eshots: [], gusts: [],
      time: 0, levelTime: 0, cp: null, room: 0, cpPending: false, inv: 0, puffCd: 0,
      kills: 0, deaths: 0, puffs: 0, over: false, won: false, god: !!opts.god, deathWhy: null
    };
    var inp = { dx: 0, dy: 0, jump: false }, pend = null;

    function addScore(n) {
      S.score += n;
      while (S.score >= S.nextLife) { S.nextLife += LIFE_EVERY; if (S.lives < LIFE_MAX) { S.lives++; emit('life', { lives: S.lives }); } }
    }
    function loadLevel(n) {
      var def = DEFS[n - 1];
      S.level = n; S.LV = build(def, n); S.got = {}; S.spun = {};
      S.heat = S.LV.furn.map(function () { return 0; }); S.lit = 0;
      S.enemies = S.LV.spawns.map(function (s, i) { var e = spawnEnemy(S.LV, s, i); e.mul = 1 + ENEMY_UP * (n - 1); return e; });
      S.eshots = []; S.gusts = []; S.levelTime = 0; pend = null;
      S.hero = newHero(S.LV.start.c, S.LV.start.r); S.cp = { x: S.hero.x, y: S.hero.y };
      S.room = roomAt(S.LV, S.hero.x, S.hero.y - 0.7); S.inv = 0; S.phase = 'play'; S.phaseT = 0;
      emit('level', { level: n, furn: S.LV.furn.length });
    }
    function die(why, k) {
      if (S.phase !== 'play') return false;
      if (S.god && (why === 'enemy' || why === 'shot')) return false;   // god — только для тестов: обитатели не трогают
      S.phase = 'dead'; S.phaseT = 0; S.deaths++; S.lives--; S.deathWhy = why; pend = null;
      emit('die', { why: why, k: k || null, level: S.level, lives: S.lives, x: S.hero.x, y: S.hero.y });
      return true;
    }
    function respawn() {
      if (S.lives <= 0) { S.phase = 'over'; S.over = true; emit('gameover', { score: S.score }); return; }
      S.hero = newHero(0, 0); S.hero.x = S.cp.x; S.hero.y = S.cp.y; S.room = roomAt(S.LV, S.hero.x, S.hero.y - 0.7);
      S.eshots = []; S.inv = INV_RESPAWN; S.phase = 'play';
      emit('respawn', {});
    }
    function pickup(it) {
      S.got[it.id] = true;
      var d = { k: it.k, x: it.c + 0.5, y: it.r + 0.5 };
      if (it.k === '+') { if (S.lives < LIFE_MAX) S.lives++; else addScore(1000); }
      else { addScore(PTS[it.k]); d.pts = PTS[it.k]; }
      emit('item', d);
    }
    // выдох: всё, что в области, — горны, крыльчатки, обитатели, угольки
    function gust(dir) {
      var LV = S.LV, H = S.hero, b = gustBox(LV, H, dir), hit = 0, i;
      S.gusts.push({ x: H.x, y: H.y - 0.75, dir: b.dir, reach: b.reach, t: 0 });
      emit('puff', { dir: b.dir, x: H.x, y: H.y });
      LV.furn.forEach(function (f) {
        if (S.heat[f.id] >= HEAT_NEED || !boxHitsCell(b, f.c, f.r)) return;
        S.heat[f.id]++; hit++;
        if (S.heat[f.id] >= HEAT_NEED) {
          S.lit++; addScore(PTS.O);
          if (H.ground) S.cp = { x: H.x, y: H.y };   // разожжённый горн — точка возврата
          emit('lit', { id: f.id, x: f.c + 0.5, y: f.r + 0.5, pts: PTS.O, left: LV.furn.length - S.lit });
        } else emit('heat', { id: f.id, x: f.c + 0.5, y: f.r + 0.5, heat: S.heat[f.id] });
      });
      LV.vanes.forEach(function (v) {
        if (S.spun[v.id] || !boxHitsCell(b, v.c, v.r)) return;
        S.spun[v.id] = S.time || 1e-6; hit++;
        var n = openShutters(LV, v.room);
        LV.shut.forEach(function (q) { if (q.room === v.room && q.openAt == null) q.openAt = S.time; });
        emit('vane', { id: v.id, x: v.c + 0.5, y: v.r + 0.5, opened: n });
      });
      var push = b.dir === 'down' ? 0 : b.dir;
      for (i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (!e.alive || !boxHits(b, enemyBox(e))) continue;
        hit++;
        if (e.k === 'f') { e.alive = false; S.kills++; addScore(PTS.kill); emit('kill', { x: e.x, y: e.y, k: e.k, pts: PTS.kill, how: 'snuff' }); continue; }
        e.stun = STUN[e.k]; if (push) { e.pv = push * PUSH_V; e.pt = PUSH_T; }
        emit('stun', { x: e.x, y: e.y, k: e.k });
      }
      for (i = 0; i < S.eshots.length; i++) {
        var s = S.eshots[i];
        if (s.alive && s.x > b.x0 - 0.2 && s.x < b.x1 + 0.2 && s.y > b.y0 - 0.2 && s.y < b.y1 + 0.2) { s.alive = false; hit++; emit('snuff', { x: s.x, y: s.y }); }
      }
      if (S.lit >= LV.furn.length) clear();
      return hit;
    }
    function clear() {
      var bonus = PTS.clear + Math.max(0, Math.round(PAR_TIME - S.levelTime)) * PTS.sec;
      addScore(bonus); S.phase = 'clear'; S.phaseT = 0; pend = null;
      emit('clear', { level: S.level, bonus: bonus });
    }

    var api = {
      start: function () { loadLevel(opts.level || 1); return api; },
      state: function () { return S; },
      setInput: function (dx, dy, jump) { inp.dx = dx || 0; inp.dy = dy || 0; inp.jump = !!jump; },
      // выдох мехов; dir: 'down' | 1 | −1 | undefined (вниз, если зажато «вниз», иначе — куда смотрит герой)
      puff: function (dir) {
        if (S.phase !== 'play' || S.puffCd > 0) return false;
        if (dir == null) dir = inp.dy > 0.5 ? 'down' : S.hero.face;
        S.puffCd = PUFF_CD; S.puffs++; pend = dir;
        return true;
      },
      update: function (dt) {
        if (S.over || S.won) return;
        S.time += dt; S.phaseT += dt;
        var i;
        for (i = 0; i < S.gusts.length; i++) S.gusts[i].t += dt;
        S.gusts = S.gusts.filter(function (q) { return q.t < 0.45; });
        if (S.phase === 'dead') { if (S.phaseT > 1.3) respawn(); return; }
        if (S.phase === 'clear') {
          if (S.phaseT > 2.2) { if (S.level >= DEFS.length) { S.phase = 'won'; S.won = true; emit('win', { score: S.score }); } else loadLevel(S.level + 1); }
          return;
        }
        S.levelTime += dt; S.puffCd = Math.max(0, S.puffCd - dt); S.inv = Math.max(0, S.inv - dt);
        var LV = S.LV, H = S.hero, dir = pend; pend = null;
        var hin = { dx: inp.dx, dy: inp.dy, jump: inp.jump, lift: dir === 'down' };
        var ev = heroStep(LV, H, hin, dt);
        if (ev.jumped) emit('jump', {});
        if (ev.landed) emit('land', {});
        if (ev.lifted) emit('lift', { x: H.x, y: H.y });
        if (dir != null) { gust(dir); if (S.phase !== 'play') return; }
        var room = roomAt(LV, H.x, H.y - 0.7);
        if (room !== S.room) { S.room = room; S.cpPending = true; emit('room', { room: room }); }
        if (S.cpPending && H.ground && !hazardHit(LV, H)) { S.cp = { x: H.x, y: H.y }; S.cpPending = false; }
        var hz = hazardHit(LV, H); if (hz) { die(hz === '~' ? 'fire' : hz === 'a' ? 'acid' : 'spike'); return; }
        if (H.y > LV.h + 1) { die('fall'); return; }
        // находки
        var c0 = Math.floor(H.x - 1), c1 = Math.floor(H.x + 1), r0 = Math.floor(H.y - 2), r1 = Math.floor(H.y);
        for (i = 0; i < LV.items.length; i++) {
          var it = LV.items[i];
          if (S.got[it.id] || it.c < c0 || it.c > c1 || it.r < r0 || it.r > r1) continue;
          if (overlapCell(H, it.c, it.r)) pickup(it);
        }
        // обитатели рядом с героем
        for (i = 0; i < S.enemies.length; i++) {
          var e = S.enemies[i]; if (!e.alive || !near(e, H)) continue;
          var r = enemyStep(LV, e, dt, H, S.eshots);
          if (r === 'shoot') emit('eshoot', { x: e.x, y: e.y });
          else if (r === 'drop') { e.alive = false; S.kills++; addScore(PTS.drop); emit('kill', { x: e.x, y: Math.min(e.y, LV.h - 1), k: e.k, pts: PTS.drop, how: 'drop' }); continue; }
          if (S.inv <= 0 && harmful(e) && heroTouches(H, enemyBox(e)) && die('enemy', e.k)) return;
        }
        for (i = 0; i < S.eshots.length; i++) {
          var b = S.eshots[i]; shotStep(LV, b, dt);
          if (b.alive && S.inv <= 0 && heroTouches(H, { x0: b.x - 0.15, x1: b.x + 0.15, y0: b.y - 0.15, y1: b.y + 0.15 }) && die('shot')) return;
        }
        S.eshots = S.eshots.filter(function (q) { return q.alive; });
      },
      // площадка: «ещё один шанс» за рекламу (после последней жизни — 1 жизнь у точки возврата) и бонус в паузе (+1 жизнь)
      reviveAd: function () { if (S.phase !== 'over') return false; S.over = false; S.lives = 1; respawn(); emit('continue', { ad: true }); return true; },
      canBoost: function () { return !S.over && !S.won && S.lives < LIFE_MAX && (S.phase === 'play' || S.phase === 'clear'); },
      boost: function () { if (!api.canBoost()) return false; S.lives++; emit('life', { lives: S.lives }); return true; },
      // тестовые хуки
      _goLevel: function (n) { loadLevel(n); },
      _place: function (c, r) { S.hero = newHero(c, r); S.room = roomAt(S.LV, S.hero.x, S.hero.y - 0.7); S.cp = { x: S.hero.x, y: S.hero.y }; },
      _die: die
    };
    return api;
  }

  // ---------- Граф проходимости (узлы «стою на клетке», рёбра — симуляция действий настоящей физикой) ----------
  // walk — шаг; jump — прыжок с удержанием направления hold после задержки delay; lift — то же, но с выдохом вниз в момент tp;
  // ride — шаг на продух, подъём на потоке wait секунд и уход в сторону d2; drop — спуск сквозь поток с зажатым «вниз».
  var HOLDS = [0.06, 0.12, 0.18, 0.24, 0.3, 0.38, 0.46, 0.56, 0.7, 9];
  var LHOLDS = [0.2, 0.4, 0.7, 9];
  var WAITS = [0.3, 0.6, 1.0, 1.4, 1.9, 2.5];
  var ACTS = [{ k: 'walk', d: -1 }, { k: 'walk', d: 1 }];
  [-1, 1].forEach(function (d) { [0, 0.16].forEach(function (dl) { HOLDS.forEach(function (h) { ACTS.push({ k: 'jump', d: d, hold: h, delay: dl }); }); }); });
  [-1, 1].forEach(function (d) { [0, 0.16].forEach(function (dl) { LHOLDS.forEach(function (h) { ACTS.push({ k: 'lift', d: d, hold: h, delay: dl, tp: 0.3 }); }); }); });
  ACTS.push({ k: 'lift', d: 0, hold: 0, delay: 0, tp: 0.3 });
  [-1, 1].forEach(function (d) { WAITS.forEach(function (w) { [-1, 1].forEach(function (d2) { ACTS.push({ k: 'ride', d: d, wait: w, d2: d2 }); }); }); });
  [-1, 1].forEach(function (d) { [-1, 1].forEach(function (d2) { ACTS.push({ k: 'drop', d: d, d2: d2 }); }); });
  var STEP = 1 / 60;
  // mem — состояние исполнения действия (для lift и ride); noise — ошибка удержания (бот)
  function drive(act, t, H, X0, noise, mem) {
    noise = noise || 0; mem = mem || {};
    if (act.k === 'walk') { var tx = X0 + act.d; return { dx: clamp((tx - H.x) / (RUN * STEP), -1, 1), dy: 0, jump: false }; }
    if (act.k === 'jump' || act.k === 'lift') {
      var on = t >= act.delay && t < act.delay + act.hold + noise;
      var o = { dx: on ? act.d : 0, dy: 0, jump: t < 0.05 };
      if (act.k === 'lift' && !mem.puffed && t >= act.tp) { mem.puffed = true; o.lift = true; o.dy = 1; }
      return o;
    }
    if (act.k === 'drop') {   // шаг в столб потока с зажатым «вниз»: спуск на продух и шаг с него
      var o2 = { dx: 0, dy: 1, jump: false };
      if (!mem.down) { var tx3 = X0 + act.d; o2.dx = clamp((tx3 - H.x) / (RUN * STEP), -1, 1); if (t > 0.1 && H.ground && Math.abs(H.x - tx3) < 1e-3) { mem.down = true; mem.tx = Math.floor(H.x) + 0.5 + act.d2; } }
      if (mem.down) o2.dx = clamp((mem.tx - H.x) / (RUN * STEP), -1, 1);
      return o2;
    }
    if (act.k === 'ride') {
      var tx2 = X0 + act.d;
      if (mem.at == null) { if (Math.abs(H.x - tx2) < 1e-3) mem.at = t; else return { dx: clamp((tx2 - H.x) / (RUN * STEP), -1, 1), dy: 0, jump: false }; }
      return { dx: t - mem.at < act.wait + noise ? 0 : act.d2, dy: 0, jump: false };
    }
    return { dx: 0, dy: 0, jump: false };
  }
  function finished(act, t, H, mem) {
    if (act.k === 'drop') {
      if (t > 4) return 'fail';
      if (mem.down && H.ground && Math.abs(H.x - mem.tx) < 1e-3) return 'ok';
      return null;
    }
    if (act.k === 'ride') {
      if (t > 6) return 'fail';
      if (mem.at != null && t - mem.at > act.wait + 0.05 && H.ground) return 'ok';
      return null;
    }
    if (t > 3) return 'fail';
    if (act.k === 'walk') {
      if (Math.abs(H.x - (mem.X0 + act.d)) < 1e-3 && H.ground) return 'ok';
      if (H.ground && t > 0.4 && Math.abs(H.x - mem.X0) < 0.5) return 'fail';
      return null;
    }
    if (t > 0.1 && H.ground) return 'ok';
    return null;
  }
  // шаг в сторону ведёт в восходящий поток: продух на том же полу или столб потока на высоте тела
  function rideable(LV, c, r) {
    if (tile(LV, c, r) === 'u') return true;
    var cols = LV.up[c]; if (!cols) return false;
    for (var i = 0; i < cols.length; i++) if (r - 0.7 >= cols[i].top && r - 0.7 < cols[i].bot) return true;
    return false;
  }
  function isNode(LV, c, r) { return isSolid(LV, c, r) && tile(LV, c, r) !== 'u' && free(LV, c, r - 1) && free(LV, c, r - 2); }
  function nodeOf(LV, H) {
    var r = Math.round(H.y), c = Math.floor(H.x);
    if (Math.abs(H.y - r) > 0.01) return null;
    if (isNode(LV, c, r)) return r * LV.w + c;
    var alt = H.x - c < 0.5 ? c - 1 : c + 1;
    return isNode(LV, alt, r) ? r * LV.w + alt : null;
  }
  // места, откуда выдох по горизонтали достаёт клетку (c, r): стоять на том же полу или на клетку ниже, 1–3 клетки в сторону, без тверди между
  function spotsFor(LV, c, r) {
    var out = [];
    [r + 1, r + 2].forEach(function (fr) {
      [-1, 1].forEach(function (side) {
        for (var k = 1; k <= 3; k++) {
          var x = c + side * k; if (!isNode(LV, x, fr)) continue;
          var H = newHero(x, fr), b = gustBox(LV, H, -side);
          if (boxHitsCell(b, c, r)) out.push({ n: fr * LV.w + x, face: -side });
        }
      });
    });
    return out;
  }
  function Nav(LV) {
    var W = LV.w, cache = {};
    function simulate(n, a) {
      var c = n % W, r = Math.floor(n / W), act = ACTS[a];
      if (act.k === 'ride' && !rideable(LV, c + act.d, r)) return null;
      if (act.k === 'drop' && !LV.up[c + act.d]) return null;
      var H = newHero(c, r), X0 = H.x, t = 0, f = null, mem = { X0: X0 };
      for (var i = 0; i < 420 && !f; i++) {
        heroStep(LV, H, drive(act, t, H, X0, 0, mem), STEP); t += STEP;
        if (hazardHit(LV, H)) return null;
        f = finished(act, t, H, mem);
      }
      if (f !== 'ok') return null;
      var to = nodeOf(LV, H); if (to == null || to === n) return null;
      return { to: to, a: a, t: t };
    }
    function edges(n) {
      if (cache[n]) return cache[n];
      var seen = {}, out = [];
      for (var a = 0; a < ACTS.length; a++) {
        var e = simulate(n, a); if (!e) continue;
        if (seen[e.to] != null && out[seen[e.to]].t <= e.t) continue;
        if (seen[e.to] != null) out[seen[e.to]] = e; else { seen[e.to] = out.length; out.push(e); }
      }
      return (cache[n] = out);
    }
    function reach(from) {
      var seen = {}, q = [].concat(from);
      q.forEach(function (n) { seen[n] = true; });
      while (q.length) { var n = q.pop(), list = edges(n); for (var i = 0; i < list.length; i++) if (!seen[list[i].to]) { seen[list[i].to] = true; q.push(list[i].to); } }
      return seen;
    }
    return { edges: edges, reach: reach, ver: LV.ver, isNode: function (c, r) { return isNode(LV, c, r); }, W: W };
  }

  U.logic = {
    COLS: COLS, ROWS: ROWS, T: T, RUN: RUN, JV: JV, GRAV: GRAV, HW: HW, HH: HH, LIFT_V: LIFT_V, PUFF_CD: PUFF_CD, GUST_R: GUST_R, HEAT_NEED: HEAT_NEED,
    UP_H: UP_H, UPV: UPV, STUN: STUN, LIVES: LIVES, LIFE_MAX: LIFE_MAX, LIFE_EVERY: LIFE_EVERY, PAR_TIME: PAR_TIME, PTS: PTS,
    SOLID: SOLID, HAZ: HAZ, ITEMS: ITEMS, ENEMY: ENEMY, mulberry32: mulberry32, clamp: clamp,
    build: build, tile: tile, isSolid: isSolid, isHaz: isHaz, free: free, roomAt: roomAt, roomBox: roomBox, updraft: updraft, openShutters: openShutters,
    newHero: newHero, heroStep: heroStep, hazardHit: hazardHit, gustBox: gustBox, boxHitsCell: boxHitsCell,
    enemyStep: enemyStep, enemyBox: enemyBox, shotStep: shotStep, heroTouches: heroTouches, harmful: harmful, near: near,
    ACTS: ACTS, drive: drive, finished: finished, isNode: isNode, nodeOf: nodeOf, spotsFor: spotsFor, Nav: Nav, STEP: STEP
  };
  U.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
