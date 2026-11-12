/* ============================================================================
   ПЕРЕПРАВА · движок логики (без DOM, детерминированный при заданном rng)
   Жанр — переход дороги и реки на тайминг. Механический жук-курьер Шуруп
   из мастерской «Гефест» несёт детали через заводской проезд и канал
   в 5 ячеек склада на дальнем берегу. Прыжки по сетке; на дороге — тележки,
   погрузчики, мотороллеры, катки и фуры; в канале — брёвна, плоты, ныряющие
   поплавки и сом. Мир (транспорт, плавсредства, паук) — чистая функция времени,
   поэтому проверка проходимости и боты считают его точно. Интерфейс — CONTRACT.md.
   ========================================================================== */
(function (global) {
  'use strict';
  var K = global.PEREPRAVA = global.PEREPRAVA || {};

  // ---------- Геометрия (px канвы 480×640) ----------
  var W = 480, H = 640, CW = 32, RH = 40, COLS = 15, ROWS = 13, TOP = 48;
  var ROW_BAY = 0, RIVER0 = 1, RIVER1 = 5, MEDIAN = 6, ROAD0 = 7, ROAD1 = 11, START = 12;
  var BAY_COLS = [1, 4, 7, 10, 13], BAY_TOL = 20;      // ячейка: центр столбца ±20 px (приземление «примагничивает» к центру)
  var START_COL = 7;
  var HOP_T = 0.15;                                     // прыжок на клетку, с
  var HERO_HALF = 10, CAR_INSET = 3, FLOAT_INSET = 3, SPIDER_HALF = 11, EDGE = 4;
  var MAX_LEVEL = 10, MAX_LIVES = 5, EXTRA_EVERY = 10000;
  var DEAD_T = 1.3, CLEAR_T = 2.2, BANNER_T = 1.8;
  var PTS_ROW = 10, PTS_BAY = 50, PTS_SEC = 10, PTS_PRIZE = 200, PTS_MATE = 200, PTS_CLEAR = 1000;

  function mod(a, n) { return ((a % n) + n) % n; }
  function colX(c) { return c * CW + CW / 2; }
  function rowY(r) { return TOP + r * RH; }
  function isRiver(r) { return r >= RIVER0 && r <= RIVER1; }
  function isRoad(r) { return r >= ROAD0 && r <= ROAD1; }
  function snapX(x) { var c = Math.round((x - CW / 2) / CW); c = Math.max(0, Math.min(COLS - 1, c)); return colX(c); }

  // ---------- Полосы ----------
  // Шаблон полосы — строка клеток по периоду (≥ 15 + 2×длина самого длинного объекта):
  // дорога: c тележка · f погрузчик · m мотороллер · k каток · t фура (подряд идущие буквы — один объект)
  // канал:  l бревно · r плот · d ныряющие поплавки · s сом (голова — передняя клетка по ходу)
  var TYPES = { c: 'cart', f: 'lift', m: 'moto', k: 'roller', t: 'truck', l: 'log', r: 'raft', d: 'dive', s: 'fish' };
  // скорость — клеток/с, знак — направление (+ вправо)
  var LAYOUTS = [
    { river: [['llll....llll.....llll.......', 1.3], ['rrr...rrr....rrr....rrr.....', -1.6], ['llllll.......llllll.........', 2.0],
              ['rr..rr...rr..rr....rr..rr...', -1.3], ['lllll....lllll.....lllll....', 1.1]],
      road:  [['tt..........tt...........', -1.1], ['c.......c........c........', 2.4], ['f.....f......f........f.....', -1.5],
              ['c.......c.......c..........', 1.3], ['f........f........f.......', -0.9]] },
    { river: [['llll....llll.....llll......', 1.5], ['ddd....ddd....ddd....ddd....', -1.6], ['lllll.......lllll........', 2.2],
              ['rr...rr....rr...rr....rr...', -1.4], ['llll.....llll......llll....', 1.3]],
      road:  [['ttt.........ttt..........', -1.2], ['m..........m.........m......', 3.2], ['f....f....f.......f....f....', -1.6],
              ['kk......kk.......kk.........', 1.2], ['c.....c.......c.....c.......', -1.1]] },
    { river: [['llll.....llll......llll.....', 1.6], ['dd...dd....dd...dd....dd....', -1.8], ['llll.....sss......llll......', 2.0],
              ['ddd....rr.....ddd....rr.....', -1.5], ['lll....lll.....lll....lll...', 1.4]],
      road:  [['ttt.......ttt......ttt......', -1.3], ['m........m.........m.....', 3.4], ['kk.....kk......kk.....kk....', -1.5],
              ['c....c....c.......c.....c...', 1.6], ['f......f.....f.......f......', -1.2]] },
    { river: [['ll.....ll....ll......ll.....', 1.8], ['dd....dd....dd......dd......', -2.0], ['lll.....sss.......lll.......', 2.3],
              ['ddd.....ddd.......rr........', -1.7], ['lll.....lll......lll........', 1.6]],
      road:  [['ttt.....ttt.......ttt.......', -1.5], ['m.......m......m..........', 3.8], ['kk....kk.....kk.......kk....', -1.8],
              ['c...c.......c...c.........', 2.0], ['f.....f....f.......f.......', -1.4]] },
    { river: [['ll......ll.....ll........', 2.0], ['dd.....dd.....dd.....dd.....', -2.2], ['sss.....lll.......sss......', 2.4],
              ['dd....dd.....rr......dd.....', -1.9], ['lll......lll.....lll.......', 1.8]],
      road:  [['tttt.......tttt..........', -1.6], ['m......m.........m.....m....', 4.0], ['kk...kk......kk......kk.....', -2.0],
              ['c..c.......c..c........c...', 2.2], ['f....f.....f......f.....f...', -1.6]] }
  ];

  function makeLane(row, kind, pat, v) {
    var objs = [], n = pat.length, i = 0;
    if (pat[0] !== '.' && pat[n - 1] === pat[0]) throw new Error('ПЕРЕПРАВА: объект разрезан краем шаблона: ' + pat);
    while (i < n) {
      var ch = pat[i]; if (ch === '.') { i++; continue; }
      if (!TYPES[ch]) throw new Error('ПЕРЕПРАВА: неизвестный символ полосы «' + ch + '»');
      var j = i; while (j < n && pat[j] === ch) j++;
      objs.push({ off: i * CW, len: (j - i) * CW, type: TYPES[ch], idx: objs.length, ph: objs.length * 1.7 });
      i = j;
    }
    return { row: row, kind: kind, pat: pat, v: v * CW, P: n * CW, M: (n * CW - W) / 2, objs: objs };
  }

  // Параметры уровня: раскладка, множитель скорости, таймер, ныряние, враги
  function buildLevel(level, difficulty) {
    var li = Math.min(LAYOUTS.length - 1, Math.floor((level - 1) / 2)), lay = LAYOUTS[li];
    var mul = level % 2 === 0 ? 1.06 : 1.0;          // чётная смена — та же раскладка, но быстрее
    if (level >= MAX_LEVEL) mul = 1.18;
    if (difficulty) mul *= difficulty(level, 1, 0, 2);
    var lanes = []; for (var r = 0; r < ROWS; r++) lanes.push(null);
    lay.river.forEach(function (d, i) { lanes[RIVER0 + i] = makeLane(RIVER0 + i, 'river', d[0], d[1] * mul); });
    lay.road.forEach(function (d, i) { lanes[ROAD0 + i] = makeLane(ROAD0 + i, 'road', d[0], d[1] * mul); });
    var spiders = [];
    if (level >= 3) spiders.push({ sp: 34 + 5 * (level - 3), ph: 0.15 });
    if (level >= 8) spiders.push({ sp: 30 + 4 * (level - 8), ph: 0.62 });
    return {
      level: level, layout: li, mul: mul, lanes: lanes, spiders: spiders,
      time: Math.round((30 - (level - 1) * 0.6) * 10) / 10,
      dive: { per: 6 - li * 0.25, under: 0.17 + 0.03 * li },
      trap: level >= 4, prize: true, mate: level >= 2
    };
  }

  // ---------- Мир как функция времени ----------
  function objX(lane, o, t) { return mod(o.off + lane.v * t, lane.P) - lane.M; }
  // Ныряние: 0 — на плаву, (0..1) — погружается/всплывает (стоять можно), 1 — под водой (гибель)
  function diveDepth(cfg, o, t) {
    if (o.type !== 'dive') return 0;
    var per = cfg.dive.per, uf = cfg.dive.under, u = mod(t + o.ph, per) / per, a = 1 - 0.2 - uf;
    if (u < a) return 0;
    if (u < a + 0.1) return (u - a) / 0.1 * 0.6;
    if (u < a + 0.1 + uf) return 1;
    return (1 - (u - a - 0.1 - uf) / 0.1) * 0.6;
  }
  function supportAt(cfg, lane, x, t) {
    for (var i = 0; i < lane.objs.length; i++) {
      var o = lane.objs[i], ox = objX(lane, o, t);
      if (x >= ox + FLOAT_INSET && x <= ox + o.len - FLOAT_INSET && diveDepth(cfg, o, t) < 1) return o;
    }
    return null;
  }
  // Голова сома — передняя клетка по ходу
  function fishHead(lane, o, t) { var ox = objX(lane, o, t); return lane.v > 0 ? [ox + o.len - CW, ox + o.len] : [ox, ox + CW]; }
  function carHit(lane, x, t) {
    for (var i = 0; i < lane.objs.length; i++) {
      var o = lane.objs[i], ox = objX(lane, o, t);
      if (x + HERO_HALF > ox + CAR_INSET && x - HERO_HALF < ox + o.len - CAR_INSET) return o;
    }
    return null;
  }
  // Паук на насыпи ходит «маятником» вдоль ряда
  function spiderX(s, t) {
    var lo = 20, span = W - 40, u = mod(s.ph * 2 * span + s.sp * t, 2 * span);
    return lo + (u < span ? u : 2 * span - u);
  }
  function spiderDir(s, t) { var span = W - 40, u = mod(s.ph * 2 * span + s.sp * t, 2 * span); return u < span ? 1 : -1; }
  function spiderHit(cfg, x, t) {
    for (var i = 0; i < cfg.spiders.length; i++) if (Math.abs(spiderX(cfg.spiders[i], t) - x) < HERO_HALF + SPIDER_HALF) return true;
    return false;
  }

  // ---------- Герой ----------
  function newHero() { return { x: colX(START_COL), row: START, hop: null, face: 'up' }; }
  function cloneHero(h) { return { x: h.x, row: h.row, face: h.face, hop: h.hop ? { t: h.hop.t, fx: h.hop.fx, fr: h.hop.fr, tx: h.hop.tx, tr: h.hop.tr } : null }; }
  function heroPos(h) {
    if (!h.hop) return { x: h.x, row: h.row, y: h.row, k: 0 };
    var p = h.hop, k = Math.min(1, p.t / HOP_T);
    return { x: p.fx + (p.tx - p.fx) * k, row: k < 0.5 ? p.fr : p.tr, y: p.fr + (p.tr - p.fr) * k, k: k };
  }
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  // Начать прыжок. На суше край экрана — стена; на воде прыжок за край — гибель при приземлении.
  function hopStart(cfg, h, dir) {
    if (h.hop || !DIRS[dir]) return false;
    var d = DIRS[dir], tr = h.row + d[1], tx = h.x + d[0] * CW;
    if (tr < ROW_BAY || tr > START) return false;
    if (d[0] && !isRiver(h.row) && (tx < CW / 2 - 0.5 || tx > W - CW / 2 + 0.5)) return false;
    h.hop = { t: 0, fx: h.x, fr: h.row, tx: tx, tr: tr }; h.face = dir;
    return true;
  }
  // Шаг героя на dt (мир — на момент t, уже после шага). → null | 'bay' | причина гибели
  // ('water' вода, 'edge' унесло/прыгнул за край, 'fish' пасть сома, 'car' транспорт, 'spider' паук)
  function stepHero(cfg, h, t, dt) {
    if (h.hop) {
      h.hop.t += dt;
      if (h.hop.t >= HOP_T - 1e-9) {
        var p = h.hop; h.hop = null; h.x = p.tx; h.row = p.tr;
        if (h.row === ROW_BAY) return 'bay';
        if (!isRiver(h.row)) h.x = snapX(h.x);
        else if (h.x < EDGE || h.x > W - EDGE) return 'edge';
      }
    }
    if (!h.hop && isRiver(h.row)) {
      var lane = cfg.lanes[h.row], o = supportAt(cfg, lane, h.x, t);
      if (!o) return 'water';
      if (o.type === 'fish') { var hd = fishHead(lane, o, t); if (h.x >= hd[0] && h.x <= hd[1]) return 'fish'; }
      h.x += lane.v * dt;
      if (h.x < EDGE || h.x > W - EDGE) return 'edge';
    }
    var qx = h.x, qr = h.row;
    if (h.hop) { var hp = h.hop, k = hp.t / HOP_T; if (k > 1) k = 1; qx = hp.fx + (hp.tx - hp.fx) * k; qr = k < 0.5 ? hp.fr : hp.tr; }
    if (qr >= ROAD0 && qr <= ROAD1 && carHit(cfg.lanes[qr], qx, t)) return 'car';
    if (qr === MEDIAN && cfg.spiders.length && spiderHit(cfg, qx, t)) return 'spider';
    return null;
  }
  function bayAt(x) { for (var i = 0; i < BAY_COLS.length; i++) if (Math.abs(x - colX(BAY_COLS[i])) <= BAY_TOL) return i; return -1; }

  // ============================== Игра ==============================
  K.Game = function (opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, onEvent = opts.onEvent || function () {};
    var S = {
      level: opts.level || 1, maxLevel: opts.maxLevel || MAX_LEVEL, lives: opts.lives == null ? 3 : opts.lives,
      score: 0, phase: 'play', phaseT: 0, time: opts.time || 0, over: false, won: false,
      cfg: null, hero: null, bays: [], timer: 0, bestRow: START, carry: false,
      mate: null, mateT: 0, prizeT: 0, trapT: 0, banner: 0, death: null, nextExtra: EXTRA_EVERY, filled: 0, lastBay: -1
    };
    function emit(t, d) { onEvent(t, d || {}); }
    function addScore(n) {
      S.score += n;
      while (S.score >= S.nextExtra) { S.nextExtra += EXTRA_EVERY; if (S.lives < MAX_LIVES) { S.lives++; emit('extra', { lives: S.lives }); } }
    }
    function spawnHero() { S.hero = newHero(); S.timer = S.cfg.time; S.bestRow = START; S.carry = false; }
    function loadLevel() {
      S.cfg = buildLevel(S.level, opts.difficulty);
      S.bays = BAY_COLS.map(function (c) { return { col: c, x: colX(c), filled: false, prize: 0, trap: 0, warn: 0, mate: false }; });
      S.filled = 0; S.mate = null; S.mateT = 3 + rng() * 4; S.prizeT = 4 + rng() * 4; S.trapT = 5 + rng() * 4;
      S.banner = BANNER_T; S.phase = 'play'; S.death = null; spawnHero();
      emit('level', { level: S.level });
    }
    function freeBays(excl) {
      var out = []; S.bays.forEach(function (b, i) { if (!b.filled && !b.prize && !b.trap && !b.warn && i !== excl) out.push(i); }); return out;
    }
    function trapActive(b) { return b.warn <= 0 && b.trap > 0; }
    function die(reason) {
      var q = heroPos(S.hero);
      S.death = { reason: reason, x: q.x, row: q.row, carry: S.carry };
      S.phase = 'dead'; S.phaseT = DEAD_T; S.lives--; S.carry = false;
      if (S.mate && S.mate.ride) S.mate = null;
      emit('die', { reason: reason, x: q.x, y: rowY(q.row) + RH / 2, lives: S.lives });
    }
    function landBay() {
      var i = bayAt(S.hero.x), b = i >= 0 ? S.bays[i] : null;
      if (!b || b.filled) { die('wall'); return; }
      if (trapActive(b)) { die('trap'); return; }
      var secs = Math.max(0, Math.floor(S.timer));
      addScore(PTS_BAY + secs * PTS_SEC);
      if (b.prize > 0) { addScore(PTS_PRIZE); emit('prize', { bay: i, x: b.x }); }
      if (S.carry) { addScore(PTS_MATE); b.mate = true; emit('mate', { bay: i, x: b.x }); S.mateT = 5 + rng() * 5; }
      b.filled = true; b.prize = 0; b.trap = 0; b.warn = 0; S.filled++; S.lastBay = i;
      emit('bay', { bay: i, x: b.x, secs: secs });
      if (S.filled >= BAY_COLS.length) { addScore(PTS_CLEAR); S.phase = 'clear'; S.phaseT = CLEAR_T; emit('clear', { level: S.level }); }
      else spawnHero();
    }
    function updBays(dt) {
      S.bays.forEach(function (b) {
        if (b.prize > 0) b.prize = Math.max(0, b.prize - dt);
        if (b.warn > 0) { b.warn -= dt; if (b.warn <= 0) { b.warn = 0; emit('trap', { x: b.x }); } }
        else if (b.trap > 0) b.trap = Math.max(0, b.trap - dt);
      });
      if (S.cfg.prize && !S.bays.some(function (b) { return b.prize > 0; })) {
        S.prizeT -= dt;
        if (S.prizeT <= 0) { var f = freeBays(); S.prizeT = 8 + rng() * 6; if (f.length) { S.bays[f[(rng() * f.length) | 0]].prize = 6; emit('prizeShow'); } }
      }
      if (S.cfg.trap && !S.bays.some(function (b) { return b.trap > 0 || b.warn > 0; })) {
        S.trapT -= dt;
        if (S.trapT <= 0) { var g = freeBays(); S.trapT = 7 + rng() * 5; if (g.length > 1) { var tb = S.bays[g[(rng() * g.length) | 0]]; tb.warn = 1.0; tb.trap = 3.5; } }
      }
    }
    // Напарник Шайба (заводной жучок-подмастерье): появляется на бревне, гуляет по нему; встать рядом — подобрать
    function mateX(m, t) { var lane = S.cfg.lanes[m.row], o = lane.objs[m.idx]; return objX(lane, o, t) + m.off; }
    function updMate(dt) {
      if (!S.cfg.mate) return;
      if (!S.mate && !S.carry) {
        S.mateT -= dt;
        if (S.mateT <= 0) {
          S.mateT = 6 + rng() * 6;
          var cands = [];
          for (var r = RIVER0; r <= RIVER1; r++) S.cfg.lanes[r].objs.forEach(function (o) {
            var ox = objX(S.cfg.lanes[r], o, S.time);
            if (o.type === 'log' && o.len >= 3 * CW && ox > 0 && ox + o.len < W) cands.push({ row: r, idx: o.idx, len: o.len });
          });
          if (cands.length) { var c = cands[(rng() * cands.length) | 0]; S.mate = { row: c.row, idx: c.idx, off: c.len / 2, dir: rng() < 0.5 ? -1 : 1, life: 12, len: c.len }; emit('mateShow'); }
        }
        return;
      }
      var m = S.mate; if (!m) return;
      m.off += m.dir * 22 * dt;
      if (m.off < 10) { m.off = 10; m.dir = 1; } if (m.off > m.len - 10) { m.off = m.len - 10; m.dir = -1; }
      m.life -= dt; var mx = mateX(m, S.time);
      if (m.life <= 0 || mx < -20 || mx > W + 20) { S.mate = null; return; }
      var h = S.hero;
      if (S.phase === 'play' && !h.hop && h.row === m.row && Math.abs(h.x - mx) < 18) {
        var lane = S.cfg.lanes[h.row], o = supportAt(S.cfg, lane, h.x, S.time);
        if (o && o.idx === m.idx) { S.carry = true; S.mate = null; emit('pickup', { x: mx }); }
      }
    }

    var api = {
      _S: S,
      start: function () { loadLevel(); return api; },
      state: function () { return S; },
      // Прыжок: 'up' | 'down' | 'left' | 'right' → true, если начат
      move: function (dir) {
        if (S.phase !== 'play') return false;
        if (!hopStart(S.cfg, S.hero, dir)) return false;
        emit('jump', { dir: dir }); return true;
      },
      update: function (dt) {
        S.time += dt;
        if (S.banner > 0) S.banner = Math.max(0, S.banner - dt);
        if (S.phase === 'over' || S.phase === 'won') return;
        if (S.phase === 'dead') {
          S.phaseT -= dt; updBays(dt); updMate(dt);
          if (S.phaseT <= 0) {
            if (S.lives > 0) { S.phase = 'play'; S.death = null; spawnHero(); emit('respawn'); }
            else { S.phase = 'over'; S.over = true; emit('gameover', { score: S.score }); }
          }
          return;
        }
        if (S.phase === 'clear') {
          S.phaseT -= dt;
          if (S.phaseT <= 0) {
            if (S.level < S.maxLevel) { S.level++; loadLevel(); }
            else { S.phase = 'won'; S.won = true; emit('win', { score: S.score }); }
          }
          return;
        }
        // play
        S.timer -= dt;
        var was = S.hero.hop ? S.hero.hop.tr : -1;
        var res = stepHero(S.cfg, S.hero, S.time, dt);
        if (was >= 0 && !S.hero.hop && !res && S.hero.row < S.bestRow) { addScore(PTS_ROW * (S.bestRow - S.hero.row)); S.bestRow = S.hero.row; emit('row', { row: S.hero.row }); }
        if (res === 'bay') { landBay(); }
        else if (res) die(res);
        else if (S.timer <= 0) { S.timer = 0; die('time'); }
        if (S.phase === 'play' || S.phase === 'dead') { updBays(dt); updMate(dt); }
      },
      mateX: function () { return S.mate ? mateX(S.mate, S.time) : null; },
      _loadLevel: loadLevel
    };
    return api;
  };

  K.logic = {
    W: W, H: H, CW: CW, RH: RH, COLS: COLS, ROWS: ROWS, TOP: TOP,
    ROW_BAY: ROW_BAY, RIVER0: RIVER0, RIVER1: RIVER1, MEDIAN: MEDIAN, ROAD0: ROAD0, ROAD1: ROAD1, START: START,
    BAY_COLS: BAY_COLS, BAY_TOL: BAY_TOL, START_COL: START_COL, HOP_T: HOP_T, HERO_HALF: HERO_HALF, EDGE: EDGE,
    MAX_LEVEL: MAX_LEVEL, MAX_LIVES: MAX_LIVES, EXTRA_EVERY: EXTRA_EVERY, DEAD_T: DEAD_T, CLEAR_T: CLEAR_T,
    PTS: { row: PTS_ROW, bay: PTS_BAY, sec: PTS_SEC, prize: PTS_PRIZE, mate: PTS_MATE, clear: PTS_CLEAR },
    LAYOUTS: LAYOUTS, TYPES: TYPES,
    mod: mod, colX: colX, rowY: rowY, isRiver: isRiver, isRoad: isRoad, snapX: snapX,
    makeLane: makeLane, buildLevel: buildLevel, objX: objX, diveDepth: diveDepth, supportAt: supportAt, fishHead: fishHead,
    carHit: carHit, spiderX: spiderX, spiderDir: spiderDir, spiderHit: spiderHit,
    newHero: newHero, cloneHero: cloneHero, heroPos: heroPos, hopStart: hopStart, stepHero: stepHero, bayAt: bayAt
  };
})(typeof window !== 'undefined' ? window : globalThis);
