/* УДАЛЕЦ · логика (без DOM, детерминирована при заданном rng).
   Уровень — сетка экранов 26×15 клеток, склеенных в одну карту; показывается только экран, где стоит герой
   (флип-скрин). Координаты — в клетках: hero.x — центр, hero.y — подошвы. Физика общая для игры и
   графа проходимости (heroStep). UDALETS.Game(opts) · UDALETS.logic */
(function (global) {
  'use strict';
  var U = global.UDALETS = global.UDALETS || {};

  var COLS = 26, ROWS = 15, T = 24;
  var RUN = 6, JV = 18.5, GRAV = 52, VMAX = 20, JS = 4.8, HW = 0.35, HH = 1.4, COY = 0.07, JBUF = 0.1;
  var FUEL_MAX = 100, FUEL_DRAIN = 6, FUEL_CAN = 60, AMMO_GUN = 8, AMMO_BOX = 5, AMMO_MAX = 20;
  var LIVES = 3, LIFE_MAX = 5, LIFE_EVERY = 20000, BONUS_TIME = 25, INV_RESPAWN = 2;
  var PTS = { '.': 50, g: 150, b: 300, R: 500, K: 1000, kill: 200, exit: 500, sec: 10 };
  var SOLID = { '#': 1, '=': 1 }, HAZ = { '^': 1, '~': 1, a: 1 };
  var ITEMS = { '.': 1, g: 1, b: 1, R: 1, K: 1, G: 1, A: 1, J: 1, F: 1, W: 1, '+': 1 };
  var ENEMY = { w: 1, f: 1, v: 1, s: 1 };
  var ESPD = { w: 2.8, f: 3.2, v: 2.8, s: 2.0 };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---------- Уровень: сетка экранов → одна карта ----------
  function build(def, idx) {
    var grid = def.grid || [def.rooms.map(function (_, i) { return i; })];
    var rh = grid.length, rw = 0; grid.forEach(function (r) { rw = Math.max(rw, r.length); });
    var w = rw * COLS, h = rh * ROWS, t = new Array(w * h);
    var LV = { idx: idx, def: def, w: w, h: h, rw: rw, rh: rh, t: t, items: [], spawns: [], start: null, exit: null, cup: null, bonus: !!def.bonus, theme: def.theme || 0 };
    for (var i = 0; i < t.length; i++) t[i] = '#';
    grid.forEach(function (row, ry) {
      row.forEach(function (ri, rx) {
        if (ri == null) return;
        var room = def.rooms[ri];
        if (room.length !== ROWS) throw new Error('уровень ' + idx + ' экран ' + ri + ': строк ' + room.length);
        room.forEach(function (line, r) {
          if (line.length !== COLS) throw new Error('уровень ' + idx + ' экран ' + ri + ' строка ' + r + ': длина ' + line.length);
          for (var c = 0; c < COLS; c++) {
            var ch = line[c], X = rx * COLS + c, Y = ry * ROWS + r, k = Y * w + X;
            if (SOLID[ch] || HAZ[ch] || ch === '%' || ch === ' ') { t[k] = ch; continue; }
            t[k] = ' ';
            if (ch === 'P') LV.start = { c: X, r: Y + 1 };
            else if (ch === 'E') LV.exit = { c: X, r: Y + 1 };
            else if (ITEMS[ch]) { var it = { id: LV.items.length, k: ch, c: X, r: Y }; LV.items.push(it); if (ch === 'K') LV.cup = it; }
            else if (ENEMY[ch]) LV.spawns.push({ k: ch, c: X, r: Y, room: ry * rw + rx });
            else throw new Error('уровень ' + idx + ': неизвестный знак «' + ch + '»');
          }
        });
      });
    });
    if (!LV.start || !LV.exit) throw new Error('уровень ' + idx + ': нет старта или двери');
    if (!LV.cup && !LV.bonus) throw new Error('уровень ' + idx + ': нет Кубка');
    return LV;
  }
  function tile(LV, c, r) { return c < 0 || r < 0 || c >= LV.w || r >= LV.h ? '#' : LV.t[r * LV.w + c]; }
  function isSolid(LV, c, r) { return !!SOLID[tile(LV, c, r)]; }
  function isHaz(LV, c, r) { return !!HAZ[tile(LV, c, r)]; }
  function free(LV, c, r) { var ch = tile(LV, c, r); return !SOLID[ch] && !HAZ[ch]; }
  function roomAt(LV, x, y) { var rx = clamp(Math.floor(x / COLS), 0, LV.rw - 1), ry = clamp(Math.floor(y / ROWS), 0, LV.rh - 1); return ry * LV.rw + rx; }
  function roomBox(LV, room) { var rx = room % LV.rw, ry = Math.floor(room / LV.rw); return { x0: rx * COLS, y0: ry * ROWS, x1: rx * COLS + COLS, y1: ry * ROWS + ROWS }; }

  // ---------- Физика героя (общая для игры и графа) ----------
  function newHero(c, r) { return { x: c + 0.5, y: r, vx: 0, vy: 0, ground: true, face: 1, coy: COY, jb: 0, jl: false, jet: false, walkT: 0 }; }
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
  // inp: {dx (-1..1, допускается дробное), dy, jump (зажат)}; → {jumped, landed, bump}
  function heroStep(LV, H, inp, dt) {
    var ev = { jumped: false, landed: false, bump: false }, wasGround = H.ground;
    var jumpEdge = inp.jump && !H.jl; H.jl = !!inp.jump;
    if (inp.dx) H.face = inp.dx > 0 ? 1 : -1;
    if (H.jet) {
      H.vx = inp.dx * JS; H.vy = inp.dy * JS; H.jb = 0;
    } else {
      H.vx = inp.dx * RUN;
      if (jumpEdge) H.jb = JBUF; else H.jb = Math.max(0, H.jb - dt);
      if (H.jb > 0 && (H.ground || H.coy > 0)) { H.vy = -JV; H.ground = false; H.coy = 0; H.jb = 0; ev.jumped = true; }
      H.vy = Math.min(VMAX, H.vy + GRAV * dt);
    }
    H.x += H.vx * dt; if (hitSolidX(LV, H)) ev.bump = true;
    H.ground = false;
    var vyBefore = H.vy;
    H.y += H.vy * dt; if (hitSolidY(LV, H) && vyBefore < 0) ev.bump = true;
    if (H.ground) { H.coy = COY; if (!wasGround) ev.landed = true; } else H.coy = Math.max(0, H.coy - dt);
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

  // ---------- Обитатели (детерминированно, двигаются только на экране героя) ----------
  function spawnEnemy(LV, s, i) {
    var e = { id: i, k: s.k, room: s.room, alive: true, dir: (s.c % 2) ? 1 : -1, t: 0, cd: 1.2 + (i % 3) * 0.5 };
    if (s.k === 'w') { e.x = s.c + 0.5; e.y = s.r + 1; }
    else { e.x = s.c + 0.5; e.y = s.r + 0.5; e.y0 = e.y; e.ph = (i * 1.7) % 6.28; }
    if (s.k === 'v') e.dir = 1;
    return e;
  }
  function enemyBox(e) { return e.k === 'w' ? { x0: e.x - 0.4, x1: e.x + 0.4, y0: e.y - 0.9, y1: e.y } : { x0: e.x - 0.4, x1: e.x + 0.4, y0: e.y - 0.35, y1: e.y + 0.35 }; }
  function enemyStep(LV, e, dt, hero, shots) {
    var B = roomBox(LV, e.room), sp = ESPD[e.k], nx, col;
    e.t += dt;
    if (e.k === 'w') {
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
        if (e.cd <= 0) { e.cd = 2.4; var d = hero.x > e.x ? 1 : -1; shots.push({ x: e.x + d * 0.4, y: e.y, vx: d * 6, room: e.room, alive: true }); return 'shoot'; }
      }
    }
    return null;
  }
  function shotStep(LV, b, dt) {
    var B = roomBox(LV, b.room); b.x += b.vx * dt;
    if (b.x < B.x0 || b.x >= B.x1 || isSolid(LV, Math.floor(b.x), Math.floor(b.y))) b.alive = false;
  }
  function heroTouches(H, bx, m) { m = m || 0; return H.x + HW - 0.08 + m > bx.x0 && H.x - HW + 0.08 - m < bx.x1 && H.y - 0.05 + m > bx.y0 && H.y - HH + 0.15 - m < bx.y1; }

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, emit = opts.onEvent || function () {};
    var DEFS = opts.levels || U.LEVELS, BON = opts.bonus || U.BONUS;
    var S = {
      phase: 'play', phaseT: 0, level: 1, LV: null, score: 0, lives: opts.lives || LIVES, nextLife: LIFE_EVERY,
      hero: null, cup: false, got: {}, enemies: [], shots: [], eshots: [], gun: false, ammo: 0, jetOwned: false, fuel: 0,
      time: 0, levelTime: 0, cp: null, room: 0, cpPending: false, inv: 0, bonusT: 0, saved: null, inBonus: false,
      kills: 0, deaths: 0, over: false, won: false, fireCd: 0, god: !!opts.god, deathWhy: null
    };
    var inp = { dx: 0, dy: 0, jump: false };

    function addScore(n) {
      S.score += n;
      while (S.score >= S.nextLife) { S.nextLife += LIFE_EVERY; if (S.lives < LIFE_MAX) { S.lives++; emit('life', { lives: S.lives }); } }
    }
    function loadLevel(n) {
      var def = DEFS[n - 1];
      S.level = n; S.LV = build(def, n); S.cup = false; S.got = {}; S.jetOwned = false; S.fuel = 0;
      S.enemies = S.LV.spawns.map(function (s, i) { return spawnEnemy(S.LV, s, i); });
      S.shots = []; S.eshots = []; S.levelTime = 0; S.inBonus = false; S.saved = null;
      S.hero = newHero(S.LV.start.c, S.LV.start.r); S.cp = { x: S.hero.x, y: S.hero.y };
      S.room = roomAt(S.LV, S.hero.x, S.hero.y - 0.7); S.inv = 0; S.phase = 'play'; S.phaseT = 0;
      emit('level', { level: n });
    }
    function enterBonus(item) {
      S.saved = { LV: S.LV, got: S.got, enemies: S.enemies, hero: S.hero, cp: S.cp, room: S.room, item: item, cup: S.cup, jetOwned: S.jetOwned, fuel: S.fuel };
      S.saved.got[item.id] = true;
      S.LV = build(BON, 0); S.got = {}; S.enemies = []; S.shots = []; S.eshots = [];
      S.hero = newHero(S.LV.start.c, S.LV.start.r); S.cp = { x: S.hero.x, y: S.hero.y }; S.room = 0;
      S.inBonus = true; S.bonusT = BONUS_TIME; S.jetOwned = false; S.fuel = 0;
      emit('warp', {});
    }
    function leaveBonus(done) {
      var sv = S.saved;
      S.LV = sv.LV; S.got = sv.got; S.enemies = sv.enemies; S.hero = sv.hero; S.cp = sv.cp; S.room = sv.room; S.cup = sv.cup;
      S.jetOwned = sv.jetOwned; S.fuel = sv.fuel; S.hero.jet = false; S.shots = []; S.eshots = [];
      S.inBonus = false; S.saved = null; S.inv = 1;
      emit('bonusEnd', { done: !!done });
    }
    function die(why, k) {
      if (S.phase !== 'play') return false;
      if (S.god && (why === 'enemy' || why === 'shot')) return false;   // god — только для тестов: обитатели не трогают
      S.phase = 'dead'; S.phaseT = 0; S.deaths++; S.lives--; S.deathWhy = why; S.hero.jet = false;
      emit('die', { why: why, k: k || null, level: S.level, lives: S.lives, x: S.hero.x, y: S.hero.y });
      return true;
    }
    function respawn() {
      if (S.lives <= 0) { S.phase = 'over'; S.over = true; emit('gameover', { score: S.score }); return; }
      S.hero = newHero(0, 0); S.hero.x = S.cp.x; S.hero.y = S.cp.y; S.room = roomAt(S.LV, S.hero.x, S.hero.y - 0.7);
      S.eshots = []; S.shots = []; S.inv = INV_RESPAWN; S.phase = 'play';
      emit('respawn', {});
    }
    function pickup(it) {
      S.got[it.id] = true;
      var d = { k: it.k, x: it.c + 0.5, y: it.r + 0.5 };
      switch (it.k) {
        case 'K': S.cup = true; addScore(PTS.K); d.pts = PTS.K; break;
        case 'G': S.gun = true; S.ammo = Math.min(AMMO_MAX, S.ammo + AMMO_GUN); break;
        case 'A': S.ammo = Math.min(AMMO_MAX, S.ammo + AMMO_BOX); break;
        case 'J': S.jetOwned = true; S.fuel = FUEL_MAX; break;
        case 'F': S.fuel = Math.min(FUEL_MAX, S.fuel + FUEL_CAN); break;
        case '+': if (S.lives < LIFE_MAX) S.lives++; else addScore(1000); break;
        case 'W': enterBonus(it); return;
        default: addScore(PTS[it.k]); d.pts = PTS[it.k];
      }
      emit(it.k === 'K' ? 'cup' : 'item', d);
    }

    var api = {
      start: function () { loadLevel(opts.level || 1); return api; },
      state: function () { return S; },
      setInput: function (dx, dy, jump) { inp.dx = dx || 0; inp.dy = dy || 0; inp.jump = !!jump; },
      fire: function () {
        if (S.phase !== 'play' || !S.gun || S.fireCd > 0) return false;
        if (S.ammo <= 0) { emit('empty', {}); S.fireCd = 0.3; return false; }
        var H = S.hero; S.ammo--; S.fireCd = 0.22;
        S.shots.push({ x: H.x + H.face * 0.45, y: H.y - 0.85, vx: H.face * 16, room: S.room, alive: true });
        emit('fire', { ammo: S.ammo }); return true;
      },
      jet: function () {
        if (S.phase !== 'play') return false;
        var H = S.hero;
        if (H.jet) { H.jet = false; emit('jetOff', {}); return true; }
        if (!S.jetOwned || S.fuel <= 0) { if (S.jetOwned) emit('empty', {}); return false; }
        H.jet = true; H.vy = 0; H.ground = false; emit('jetOn', {}); return true;
      },
      update: function (dt) {
        if (S.over || S.won) return;
        S.time += dt; S.phaseT += dt;
        if (S.phase === 'dead') { if (S.phaseT > 1.3) respawn(); return; }
        if (S.phase === 'clear') {
          if (S.phaseT > 1.6) { if (S.level >= DEFS.length) { S.phase = 'won'; S.won = true; emit('win', { score: S.score }); } else loadLevel(S.level + 1); }
          return;
        }
        S.levelTime += dt; S.fireCd = Math.max(0, S.fireCd - dt); S.inv = Math.max(0, S.inv - dt);
        var LV = S.LV, H = S.hero, i;
        var hin = { dx: inp.dx, dy: inp.dy, jump: inp.jump };
        if (H.jet) {
          if (inp.jump && !inp.dy) hin.dy = -1;
          S.fuel -= FUEL_DRAIN * dt;
          if (S.fuel <= 0) { S.fuel = 0; H.jet = false; emit('fuelOut', {}); }
        }
        var ev = heroStep(LV, H, hin, dt);
        if (ev.jumped) emit('jump', {});
        if (ev.landed) emit('land', {});
        var room = roomAt(LV, H.x, H.y - 0.7);
        if (room !== S.room) { S.room = room; S.cpPending = true; S.shots = []; S.eshots = []; emit('room', { room: room }); }
        if (S.cpPending && H.ground && !H.jet && !hazardHit(LV, H)) { S.cp = { x: H.x, y: H.y }; S.cpPending = false; }
        var hz = hazardHit(LV, H); if (hz) { die(hz === '~' ? 'fire' : hz === 'a' ? 'acid' : 'spike'); return; }
        // предметы
        var c0 = Math.floor(H.x - 1), c1 = Math.floor(H.x + 1), r0 = Math.floor(H.y - 2), r1 = Math.floor(H.y);
        for (i = 0; i < LV.items.length; i++) {
          var it = LV.items[i];
          if (S.got[it.id] || it.c < c0 || it.c > c1 || it.r < r0 || it.r > r1) continue;
          if (overlapCell(H, it.c, it.r)) { pickup(it); if (S.LV !== LV) return; }
        }
        // дверь
        var E = LV.exit;
        if (overlapCell(H, E.c, E.r - 1, 0.25) && (S.cup || LV.bonus)) {
          if (S.inBonus) { leaveBonus(true); return; }
          var bonus = PTS.exit + Math.max(0, Math.round(120 - S.levelTime)) * PTS.sec;
          addScore(bonus); S.phase = 'clear'; S.phaseT = 0; H.jet = false; emit('clear', { level: S.level, bonus: bonus }); return;
        }
        if (S.inBonus) { S.bonusT -= dt; if (S.bonusT <= 0) { leaveBonus(false); return; } }
        // обитатели экрана
        for (i = 0; i < S.enemies.length; i++) {
          var e = S.enemies[i]; if (!e.alive || e.room !== S.room) continue;
          if (enemyStep(LV, e, dt, H, S.eshots) === 'shoot') emit('eshoot', { x: e.x, y: e.y });
          if (S.inv <= 0 && heroTouches(H, enemyBox(e)) && die('enemy', e.k)) return;
        }
        for (i = 0; i < S.eshots.length; i++) {
          var b = S.eshots[i]; shotStep(LV, b, dt);
          if (b.alive && S.inv <= 0 && heroTouches(H, { x0: b.x - 0.15, x1: b.x + 0.15, y0: b.y - 0.15, y1: b.y + 0.15 }) && die('shot')) return;
        }
        S.eshots = S.eshots.filter(function (q) { return q.alive; });
        for (i = 0; i < S.shots.length; i++) {
          var s = S.shots[i]; shotStep(LV, s, dt); if (!s.alive) continue;
          for (var j = 0; j < S.enemies.length; j++) {
            var en = S.enemies[j]; if (!en.alive || en.room !== S.room) continue;
            var bx = enemyBox(en);
            if (s.x > bx.x0 - 0.1 && s.x < bx.x1 + 0.1 && s.y > bx.y0 - 0.2 && s.y < bx.y1 + 0.2) {
              en.alive = false; s.alive = false; S.kills++; addScore(PTS.kill); emit('kill', { x: en.x, y: en.y, k: en.k, pts: PTS.kill }); break;
            }
          }
        }
        S.shots = S.shots.filter(function (q) { return q.alive; });
      },
      restartLevel: function () {   // спасение из тупика (пункт паузы): −1 жизнь, уровень заново, очки сохраняются
        if (S.over || S.won) return;
        S.lives--; S.deaths++;
        if (S.lives <= 0) { S.phase = 'over'; S.over = true; emit('gameover', { score: S.score }); return; }
        var keep = { lives: S.lives }; loadLevel(S.level); S.lives = keep.lives; emit('restart', {});
      },
      // тестовые хуки
      _goLevel: function (n) { loadLevel(n); },
      _place: function (c, r) { S.hero = newHero(c, r); S.room = roomAt(S.LV, S.hero.x, S.hero.y - 0.7); S.cp = { x: S.hero.x, y: S.hero.y }; },
      _die: die
    };
    return api;
  }

  // ---------- Граф проходимости (узлы «стою на клетке», рёбра — симуляция действий настоящей физикой) ----------
  var HOLDS = [0.06, 0.12, 0.18, 0.24, 0.3, 0.38, 0.46, 0.56, 0.7, 9];
  var ACTS = [{ k: 'walk', d: -1 }, { k: 'walk', d: 1 }];
  [-1, 1].forEach(function (d) { [0, 0.16].forEach(function (dl) { HOLDS.forEach(function (h) { ACTS.push({ k: 'jump', d: d, hold: h, delay: dl }); }); }); });
  var STEP = 1 / 60;
  function drive(act, t, H, X0, noise) {
    noise = noise || 0;
    if (act.k === 'walk') { var tx = X0 + act.d; return { dx: clamp((tx - H.x) / (RUN * STEP), -1, 1), dy: 0, jump: false }; }
    if (act.k === 'jump') { var on = t >= act.delay && t < act.delay + act.hold + noise; return { dx: on ? act.d : 0, dy: 0, jump: t < 0.05 }; }
    return { dx: 0, dy: 0, jump: false };
  }
  function finished(act, t, H, mem) {
    if (t > 3) return 'fail';
    if (act.k === 'walk') {
      if (Math.abs(H.x - (mem.X0 + act.d)) < 1e-3 && H.ground) return 'ok';
      if (H.ground && t > 0.4 && Math.abs(H.x - mem.X0) < 0.5) return 'fail';
      return null;
    }
    if (t > 0.1 && H.ground) return 'ok';
    return null;
  }
  function isNode(LV, c, r) { return isSolid(LV, c, r) && free(LV, c, r - 1) && free(LV, c, r - 2); }
  function nodeOf(LV, H) {
    var r = Math.round(H.y), c = Math.floor(H.x);
    if (Math.abs(H.y - r) > 0.01) return null;
    if (isNode(LV, c, r)) return r * LV.w + c;
    var alt = H.x - c < 0.5 ? c - 1 : c + 1;
    return isNode(LV, alt, r) ? r * LV.w + alt : null;
  }
  function Nav(LV) {
    var W = LV.w, cache = {}, fcache = {};
    function simulate(n, a) {
      var c = n % W, r = Math.floor(n / W), H = newHero(c, r), X0 = H.x, act = ACTS[a], t = 0, f = null, mem = { X0: X0 };
      for (var i = 0; i < 240 && !f; i++) {
        heroStep(LV, H, drive(act, t, H, X0), STEP); t += STEP;
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
    function fcell(c, y) { return free(LV, c, y - 1) && free(LV, c, y - 2) && !isHaz(LV, c, y); }
    // перелёты на ранце: BFS по клеткам «подошвы в (c,y)», до MAXF шагов; посадка — на узел
    var MAXF = 40;
    function flights(n) {
      if (fcache[n]) return fcache[n];
      var c = n % W, r = Math.floor(n / W), prev = {}, dist = {}, q = [[c, r]], out = [], k0 = r * W + c;
      dist[k0] = 0; prev[k0] = -1;
      while (q.length) {
        var p = q.shift(), pk = p[1] * W + p[0], d = dist[pk];
        if (pk !== k0 && isNode(LV, p[0], p[1])) {
          var path = [], k = pk; while (k !== -1) { path.push([k % W, Math.floor(k / W)]); k = prev[k]; }
          path.reverse(); out.push({ to: pk, fly: true, path: path, t: d / JS + 0.9, fuel: (d / JS + 0.5) * FUEL_DRAIN });
        }
        if (d >= MAXF) continue;
        var nb = [[p[0] + 1, p[1]], [p[0] - 1, p[1]], [p[0], p[1] - 1], [p[0], p[1] + 1]];
        for (var j = 0; j < 4; j++) {
          var x = nb[j][0], y = nb[j][1], kk = y * W + x;
          if (dist[kk] != null || !fcell(x, y)) continue;
          if (y > p[1] && isSolid(LV, p[0], p[1])) continue;    // сквозь пол вниз нельзя
          if (j < 2 && isSolid(LV, p[0], p[1])) continue;   // с опоры — только вверх (не «ползём» по полу на ранце)
          dist[kk] = d + 1; prev[kk] = pk; q.push([x, y]);
        }
      }
      return (fcache[n] = out);
    }
    function itemNode(it) { var r = it.r + 1; for (var dr = 0; dr <= 1; dr++) if (isNode(LV, it.c, r + dr)) return (r + dr) * W + it.c; return null; }
    // достижимость: состояния (узел, есть ранец)
    // → { 'узел:ранец': true }; ранец появляется в узле jetNode
    function reach(from, jet, jetNode) {
      var seen = {}, q = [];
      function add(n, j) { if (n === jetNode) j = 1; var k = n + ':' + j; if (!seen[k]) { seen[k] = true; q.push([n, j]); } }
      add(from, jet ? 1 : 0);
      while (q.length) {
        var s = q.pop(), list = edges(s[0]); if (s[1]) list = list.concat(flights(s[0]));
        for (var i = 0; i < list.length; i++) add(list[i].to, s[1]);
      }
      return seen;
    }
    return { edges: edges, flights: flights, reach: reach, itemNode: itemNode, isNode: function (c, r) { return isNode(LV, c, r); }, W: W };
  }

  U.logic = {
    COLS: COLS, ROWS: ROWS, T: T, RUN: RUN, JV: JV, GRAV: GRAV, JS: JS, HW: HW, HH: HH, FUEL_MAX: FUEL_MAX, FUEL_DRAIN: FUEL_DRAIN, FUEL_CAN: FUEL_CAN,
    AMMO_GUN: AMMO_GUN, AMMO_BOX: AMMO_BOX, AMMO_MAX: AMMO_MAX, LIVES: LIVES, LIFE_MAX: LIFE_MAX, LIFE_EVERY: LIFE_EVERY, BONUS_TIME: BONUS_TIME, PTS: PTS,
    SOLID: SOLID, HAZ: HAZ, ITEMS: ITEMS, ENEMY: ENEMY, mulberry32: mulberry32, clamp: clamp,
    build: build, tile: tile, isSolid: isSolid, isHaz: isHaz, free: free, roomAt: roomAt, roomBox: roomBox,
    newHero: newHero, heroStep: heroStep, hazardHit: hazardHit, enemyStep: enemyStep, enemyBox: enemyBox, shotStep: shotStep, heroTouches: heroTouches,
    ACTS: ACTS, drive: drive, finished: finished, isNode: isNode, nodeOf: nodeOf, Nav: Nav, STEP: STEP
  };
  U.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
