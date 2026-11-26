/* ПУЗЫРЬ (EN: GLASSGUST) · логика игры (без DOM, детерминирована при заданном rng).
   Переделка 2026-11: стеклодувы Колба и Реторта раздувают на трубке стеклянный пузырь и лопают его ХЛОПКОМ —
   волна воздуха сдувает врагов. Враги летят кувырком, сбивают других, оглушаются о стены и при падении,
   а в ВАННУ С РАСПЛАВОМ (проём в полу) — плавятся. Уровень пройден, когда все враги переплавлены.
   Поле 32×24 клетки: стены по бокам (по 2 колонки), сплошной потолок, пол с 1–3 ваннами по 2 клетки.
   Платформы односторонние: снизу проходишь, сверху стоишь. Сквозного прохода низ→верх нет: ванна — опасность и цель.
   30 уровней (6 ручных карт + процедурные с проверкой проходимости) + финал — Котёл (отражай хлопком его капли).
   PUZYR.Game(opts) → api; PUZYR.logic — константы, уровни, генератор/граф проходимости, помощники. */
(function (global) {
  'use strict';
  var Z = global.PUZYR = global.PUZYR || {};

  // ---------- Константы (единицы — клетки и секунды) ----------
  var COLS = 32, ROWS = 24, WL = 2, WR = 30;     // внутренняя ширина — колонки 2..29
  var G = 70, VMAX = 13, RUN = 6.5, JUMP_V = 26; // высота прыжка ≈ 4,8 клетки
  var JUMP_UP = 4, JUMP_CUT = 8, HOP_HOLD = 5;   // отпущенный прыжок гасится до JUMP_CUT; короткий прыжок — HOP_HOLD кадров                               // на сколько рядов вверх можно запрыгнуть
  var PW = 1.4, PH = 1.7, EW = 1.4, EH = 1.5;    // размеры героя и врага
  // Хлопок: удержание раздувает пузырь на трубке (0..CHARGE_MAX), отпускание — хлопок; сила 0,35..1
  var CHARGE_MAX = 0.7, CHARGE_AUTO = 1.1, BLAST_CD = 0.28, CHARGE_RUN = 0;
  var SHOT_TOP = 3.2, P_MIN = 0.35, R_BASE = 2.6, R_K = 3.4, V_BASE = 8, V_K = 10, AIR_HOP = 15;
  var FRICT = 14, FRICT_FLOOR = 7, BONK_V = 4, KNOCK_V = 5, BOUNCE = 0.75;       // трение кувырка о пол, скорость «удара о стену» и «кегли»
  var DAZE_WALL = 1.8, DAZE_FALL = 1.4, DAZE_STOP = 0.8, DAZE_SPARK = 2.0, DAZE_DOWN = 3.0, DAZE_BOP = 1.0, BOP_DEPTH = 1.0, BOP_V = 15, BUMP_DEPTH = 1.1;
  var WEIGHT = { cog: 1.0, spring: 1.1, soot: 1.5, spark: 0.65 };
  var MELT_PTS = 500, COMBO_T = 2.5, COMBO_MAX = 5, KNOCK_PTS = 100, LEDGE_PTS = 50, PAR_T = 60, TIME_PTS = 20;
  var WAKE_T = 0.5, RESPAWN_T = 1.6, INV_T = 2.5, START_INV = 2.5;
  var LIVES = 3, MAX_LIVES = 9, EXTRA_LIFE = 11000, HIT_PAD = 0.7;
  var CLEAR_T = 3.2;
  var SPAWNS = [{ x: 4.5, y: 23 }, { x: 27.5, y: 23 }];
  var ROWS_STD = [19, 15, 11, 7, 4];
  // Ванны в полу (колонки c0..c1 включительно): C — центр, S — по бокам, CS — все три
  var VATS = { C: [[15, 16]], S: [[8, 9], [22, 23]], CS: [[8, 9], [15, 16], [22, 23]] };
  // Враги (свои имена — в i18n): зубец ходит, пружина скачет, копоть летает, искрун ходит и мечет искры
  var ENEMY = {
    cog:    { speed: 3.0, fly: false },
    spring: { speed: 2.6, fly: false },
    soot:   { speed: 2.3, fly: true },
    spark:  { speed: 2.4, fly: false }
  };
  var BOSS = { w: 4.4, h: 4, hp: 8, speed: 2.6, spitT: 3.4, dropV: 4, pts: 20000, hitPts: 300 };

  // Раскладки кооп-управления (g.usePlayers): И1 — стрелки, И2 — WASD; jump — прыжок, blow — раздуть/хлопнуть
  var BIND = {
    p1: { left: ['ArrowLeft'], right: ['ArrowRight'], down: ['ArrowDown'], jump: ['ArrowUp', 'Slash'], blow: ['Space', 'Period', 'Numpad0'] },
    p2: { left: ['KeyA'], right: ['KeyD'], down: ['KeyS'], jump: ['KeyW', 'KeyG'], blow: ['KeyF', 'KeyE'] }
  };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function idx(x, y) { return y * COLS + x; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sgn(v) { return v < 0 ? -1 : v > 0 ? 1 : 0; }
  // трение кувырка: пол мастерской — гладкая чугунная плита, по нему враг скользит вдвое дальше
  function frict(b) { return Math.round(b.y) === ROWS - 1 ? FRICT_FLOOR : FRICT; }
  function power(charge) { return P_MIN + (1 - P_MIN) * Math.min(1, Math.max(0, charge) / CHARGE_MAX); }
  function blastRange(pw) { return R_BASE + R_K * pw; }

  // ---------- Карты ----------
  // Ручная карта: ряды → пролёты [c0,c1] (включительно) в левой половине (2..15), зеркалятся вправо (c → 31−c).
  var HAND = {
    1:  { vats: 'C',  rows: { 19: [[2, 9], [13, 15]], 15: [[6, 11]], 11: [[2, 7], [12, 15]], 7: [[6, 11]], 4: [[11, 15]] } },
    6:  { vats: 'S',  rows: { 20: [[5, 9], [13, 15]], 16: [[2, 5], [9, 12]], 12: [[5, 9], [13, 15]], 8: [[2, 6], [10, 13]], 4: [[6, 10], [14, 15]] } },
    12: { vats: 'C',  rows: { 19: [[2, 4], [8, 15]], 15: [[4, 9]], 11: [[2, 4], [9, 15]], 7: [[4, 8]], 4: [[5, 12]] } },
    18: { vats: 'CS', rows: { 20: [[2, 3], [7, 10], [14, 15]], 16: [[4, 6], [11, 13]], 12: [[2, 3], [7, 9], [14, 15]], 8: [[4, 6], [10, 13]], 4: [[6, 9], [13, 15]] } },
    24: { vats: 'S',  rows: { 19: [[4, 15]], 15: [[2, 5], [9, 12]], 11: [[6, 10]], 7: [[2, 4], [9, 15]], 4: [[5, 9]] } },
    30: { vats: 'CS', rows: { 20: [[2, 6], [12, 15]], 17: [[8, 10]], 14: [[2, 5], [12, 15]], 11: [[7, 9]], 8: [[3, 5], [12, 15]], 4: [[7, 10], [13, 15]] } }
  };
  var BOSS_MAP = { vats: 'C', rows: { 19: [[4, 8]], 15: [[2, 4], [9, 11]], 11: [[5, 8]], 7: [[2, 4]] } };
  var ZONES = ['workshop', 'kiln', 'glass', 'pipes', 'dome'];
  var VAT_KINDS = ['C', 'S', 'CS'];
  var MOTIFS = ['rows', 'islands', 'steps', 'ledges', 'zig'];

  function emptyGrid(vats) {
    var g = new Uint8Array(COLS * ROWS), holes = VATS[vats || 'C'];
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
      if (x < WL || x >= WR || y === 0) g[idx(x, y)] = 1;
      else if (y === ROWS - 1 && !holes.some(function (h) { return x >= h[0] && x <= h[1]; })) g[idx(x, y)] = 1;
    }
    return g;
  }
  function gridFromRows(rows, vats) {
    var g = emptyGrid(vats);
    Object.keys(rows).forEach(function (r) {
      rows[r].forEach(function (s) {
        for (var c = s[0]; c <= s[1]; c++) { g[idx(c, +r)] = 1; g[idx(COLS - 1 - c, +r)] = 1; }
      });
    });
    return g;
  }
  function vatsOf(kind) { return VATS[kind].map(function (h) { return { c0: h[0], c1: h[1], x: (h[0] + h[1] + 1) / 2 }; }); }
  function inVat(vats, x) { for (var i = 0; i < vats.length; i++) if (x > vats[i].c0 - 0.2 && x < vats[i].c1 + 1.2) return vats[i]; return null; }

  // Процедурная карта: мотив + зеркало; генератор перебирает подсиды, пока карта не пройдёт проверку
  function genRows(motif, rng) {
    var rows = {}, base = rng() < 0.5 ? ROWS_STD : [20, 16, 12, 8, 4];
    var ri = function (a, b) { return a + Math.floor(rng() * (b - a + 1)); };
    base.forEach(function (r, k) {
      var sp = [], top = r <= 5;
      if (top) { var c0 = ri(6, 11); sp.push([c0, Math.min(15, c0 + ri(3, 6))]); if (rng() < 0.4) sp.push([2, ri(3, 4)]); }
      else if (motif === 'rows') { sp.push([2, ri(5, 9)]); if (rng() < 0.7) sp.push([ri(11, 13), 15]); }
      else if (motif === 'islands') { var a = ri(3, 5); sp.push([a, a + ri(1, 3)]); var b = ri(9, 12); sp.push([b, Math.min(15, b + ri(1, 3))]); }
      else if (motif === 'steps') { if (k % 2) sp.push([2, ri(4, 7)]); else sp.push([ri(8, 10), 15]); if (rng() < 0.4) sp.push([k % 2 ? 11 : 4, k % 2 ? 13 : 6]); }
      else if (motif === 'ledges') { sp.push([2, ri(3, 5)]); var m = ri(8, 11); sp.push([m, m + ri(2, 4)]); }
      else { var z = (k % 2) ? ri(3, 6) : ri(8, 11); sp.push([z, z + ri(3, 5)]); }
      rows[r] = sp.filter(function (s) { return s[1] >= s[0]; }).map(function (s) { return [Math.max(2, s[0]), Math.min(15, s[1])]; });
    });
    return rows;
  }

  // ---------- Граф проходимости (для проверки карт и для бота) ----------
  // Сегмент — непрерывный ряд блоков с пустотой сверху; стоять можно, если центр героя в [lo, hi].
  function segments(grid) {
    var out = [];
    for (var r = 1; r < ROWS; r++) {
      var c = WL;
      while (c < WR) {
        if (grid[idx(c, r)] && !grid[idx(c, r - 1)]) {
          var c0 = c; while (c < WR && grid[idx(c, r)] && !grid[idx(c, r - 1)]) c++;
          var c1 = c - 1, lo = Math.max(WL + PW / 2, c0 - PW / 2 + 0.2), hi = Math.min(WR - PW / 2, c1 + 1 + PW / 2 - 0.2);
          out.push({ id: out.length, row: r, c0: c0, c1: c1, lo: lo, hi: hi, slo: Math.max(lo, c0 + 0.15), shi: Math.min(hi, c1 + 0.85), edges: [] });
        } else c++;
      }
    }
    return out;
  }
  function segAt(segs, x, row) {
    for (var i = 0; i < segs.length; i++) { var s = segs[i]; if (s.row === row && x > s.lo && x < s.hi) return s; }
    return null;
  }
  // Куда приземлится падающий по вертикали x из ряда row (null — в ванну)
  function landing(segs, x, row) {
    var best = null;
    for (var i = 0; i < segs.length; i++) { var s = segs[i]; if (s.row > row && x > s.lo && x < s.hi && (!best || s.row < best.row)) best = s; }
    return best;
  }
  function buildGraph(grid) {
    var segs = segments(grid);
    segs.forEach(function (A) {
      [-1, 1].forEach(function (side) {
        var x = side < 0 ? A.c0 - PW / 2 - 0.05 : A.c1 + 1 + PW / 2 + 0.05;
        if (x < WL + PW / 2 || x > WR - PW / 2) return;
        if (segAt(segs, x, A.row)) return;
        var B = landing(segs, x, A.row);
        if (B && B !== A) A.edges.push({ to: B.id, type: 'fall', x: side < 0 ? A.slo : A.shi, side: side, land: x });
      });
      segs.forEach(function (B) {
        if (B === A || B.row >= A.row || A.row - B.row > JUMP_UP) return;
        var lo = Math.max(A.slo, B.slo), hi = Math.min(A.shi, B.shi);
        if (hi - lo >= 0.5) { A.edges.push({ to: B.id, type: 'jump', x: (lo + hi) / 2, tx: (lo + hi) / 2 }); return; }
        var gapMax = A.row - B.row <= 3 ? 2.5 : 1.8;
        if (B.slo > A.shi && B.slo - A.shi <= gapMax) A.edges.push({ to: B.id, type: 'leap', x: A.shi - 0.3, tx: B.slo + 0.6, side: 1 });
        else if (B.shi < A.slo && A.slo - B.shi <= gapMax) A.edges.push({ to: B.id, type: 'leap', x: A.slo + 0.3, tx: B.shi - 0.6, side: -1 });
      });
      segs.forEach(function (B) {
        if (B === A || B.row !== A.row) return;
        // в одном ряду (через ванну) — короткий прыжок: прыжок отпущен через HOP_HOLD (иначе высокий прыжок ловит платформа сверху)
        if (B.slo > A.shi && B.slo - A.shi <= 3) A.edges.push({ to: B.id, type: 'hop', x: A.shi - 0.3, tx: B.slo + 0.6, side: 1 });
        else if (B.shi < A.slo && A.slo - B.shi <= 3) A.edges.push({ to: B.id, type: 'hop', x: A.slo + 0.3, tx: B.shi - 0.6, side: -1 });
      });
    });
    segs.forEach(function (A) {
      var seen = {};
      A.edges = A.edges.filter(function (e) {
        var to = simEdge(grid, segs, A, e);
        if (to < 0 || seen[to + e.type]) return false;
        seen[to + e.type] = true; e.to = to; return true;
      });
    });
    return segs;
  }
  function drive(p, e) {
    if (p.ground) {
      var dx = e.x - p.x;
      if (e.type === 'fall') return { dir: e.side, jump: false };
      if (e.type === 'jump') { if (Math.abs(dx) > 0.2) return { dir: dx < 0 ? -1 : 1, jump: false }; return { dir: 0, jump: true }; }
      if ((e.x - p.x) * e.side > 0.25) return { dir: e.side, jump: false };
      if ((p.x - e.x) * e.side > 0.6) return { dir: -e.side, jump: false };
      return { dir: e.side, jump: true };
    }
    if (e.type === 'fall') return { dir: (p.x - e.land) * e.side >= 0 ? 0 : e.side, jump: false };
    var d = e.tx - p.x;
    if (e.type === 'leap' || e.type === 'hop') return { dir: d * e.side > 0.1 ? e.side : 0, jump: false };
    return { dir: Math.abs(d) > 0.2 ? (d < 0 ? -1 : 1) : 0, jump: false };
  }
  function simEdge(grid, segs, A, e) {
    var p = { x: e.type === 'leap' || e.type === 'hop' ? clamp(e.x - e.side * 1.5, A.slo, A.shi) : e.x, y: A.row, vx: 0, vy: 0, w: PW, h: PH, ground: true }, jumped = false, jf = 0;
    for (var i = 0; i < 300; i++) {
      var c = drive(p, e);
      if (c.jump && p.ground && !jumped) { p.vy = -JUMP_V; jumped = true; p.ground = false; jf = i; }
      if (jumped && e.type === 'hop' && i - jf >= HOP_HOLD && p.vy < -JUMP_CUT) p.vy = -JUMP_CUT;
      p.vx = c.dir * RUN; moveBody(grid, p, 1 / 60);
      if (p.y > ROWS - 0.4) return -1;           // угодил в ванну
      if (p.ground && i > 2) {
        var s = segAt(segs, p.x, Math.round(p.y));
        if (s && s.id !== A.id) return s.id;
        if (s && jumped) return -1;
      }
    }
    return -1;
  }
  function reach(segs, from) {
    var seen = {}, q = [from]; seen[from] = true;
    for (var h = 0; h < q.length; h++) segs[q[h]].edges.forEach(function (e) { if (!seen[e.to]) { seen[e.to] = true; q.push(e.to); } });
    return seen;
  }
  function route(segs, a, b) {
    if (a === b) return null;
    var prev = {}, q = [a]; prev[a] = -1;
    for (var h = 0; h < q.length; h++) {
      var s = q[h]; if (s === b) break;
      for (var i = 0; i < segs[s].edges.length; i++) { var e = segs[s].edges[i]; if (prev[e.to] === undefined) { prev[e.to] = { from: s, e: e }; q.push(e.to); } }
    }
    if (prev[b] === undefined) return null;
    var cur = b, step = null;
    while (prev[cur] !== -1) { step = prev[cur]; cur = step.from; }
    return step.e;
  }
  // Проверка карты: граф сильно связен (без сквозного прохода — только прыжки и спуски), пол под обоими героями,
  // у каждой ванны с обеих сторон — пол (есть откуда сдуть врага), есть место для врагов.
  function validate(grid) {
    var segs = buildGraph(grid), spawn = segAt(segs, SPAWNS[0].x, ROWS - 1);
    if (!spawn) return { ok: false, why: 'нет пола под И1' };
    if (!segAt(segs, SPAWNS[1].x, ROWS - 1)) return { ok: false, why: 'нет пола под И2' };
    var r1 = reach(segs, spawn.id);
    for (var i = 0; i < segs.length; i++) {
      if (!r1[i]) return { ok: false, why: 'сегмент ' + i + ' (ряд ' + segs[i].row + ') недостижим' };
      if (!reach(segs, i)[spawn.id]) return { ok: false, why: 'из сегмента ' + i + ' (ряд ' + segs[i].row + ') не вернуться' };
    }
    if (segs.filter(function (s) { return s.row < ROWS - 1 && s.c1 - s.c0 >= 2; }).length < 4) return { ok: false, why: 'мало мест для врагов' };
    return { ok: true, segs: segs };
  }

  // Состав уровня n (1..30): зона, враги, ванны, карта
  function levelSpec(n) {
    var zone = Math.floor((n - 1) / 6), rng = mulberry32(n * 7919 + 17);
    var count = Math.min(7, 3 + Math.floor((n - 1) / 6) + (n % 6 === 0 ? 1 : 0));   // 3 → 7, финал зоны — +1
    var pool = [['cog', 'cog', 'cog', 'spring'], ['cog', 'spring', 'soot', 'cog'], ['cog', 'spring', 'soot', 'spark'],
      ['spring', 'soot', 'spark', 'cog'], ['soot', 'spark', 'spring', 'cog']][zone];
    var enemies = [];
    for (var i = 0; i < count; i++) enemies.push(n <= 2 ? 'cog' : pool[Math.floor(rng() * pool.length)]);
    var hand = HAND[n], vats, grid, tries = 0;
    if (hand) { vats = hand.vats; grid = gridFromRows(hand.rows, vats); }
    else {
      vats = n <= 4 ? 'C' : VAT_KINDS[n % 3];
      var motif = MOTIFS[n % MOTIFS.length];
      for (tries = 0; tries < 400; tries++) {
        grid = gridFromRows(genRows(motif, mulberry32(n * 104729 + tries * 31 + 1)), vats);
        if (validate(grid).ok) break;
      }
    }
    return { n: n, zone: ZONES[zone], enemies: enemies, vats: vats, grid: grid, hand: !!hand, tries: tries };
  }
  var LEVEL_CACHE = {};
  function level(n) {
    if (n > 30) return LEVEL_CACHE.boss || (LEVEL_CACHE.boss = { n: n, zone: 'boss', boss: true, enemies: [], vats: BOSS_MAP.vats, grid: gridFromRows(BOSS_MAP.rows, BOSS_MAP.vats) });
    return LEVEL_CACHE[n] || (LEVEL_CACHE[n] = levelSpec(n));
  }

  // ---------- Физика тела ----------
  function solidUnder(grid, x, w, r) {
    if (r < 1 || r >= ROWS) return false;
    var a = Math.floor(x - w / 2 + 0.2), b = Math.floor(x + w / 2 - 0.2);
    for (var c = Math.max(WL, a); c <= Math.min(WR - 1, b); c++) if (grid[idx(c, r)]) return true;
    return false;
  }
  // блок в клетке под точкой x ряда r (зонд края для врагов)
  function cellAt(grid, x, r) { var c = Math.floor(x); return r >= 0 && r < ROWS && c >= 0 && c < COLS && !!grid[idx(c, r)]; }
  function moveBody(grid, b, dt, gravity) {
    if (gravity !== false) { b.vy = Math.min(VMAX, b.vy + G * dt); }
    b.wall = 0;
    b.x += b.vx * dt;
    var lo = WL + b.w / 2, hi = WR - b.w / 2;
    if (b.x < lo) { b.x = lo; b.wall = -1; } else if (b.x > hi) { b.x = hi; b.wall = 1; }
    var py = b.y; b.y += b.vy * dt; b.ground = false;
    if (b.vy >= 0) {
      for (var r = Math.ceil(py - 1e-6); r <= Math.floor(b.y); r++) {
        if (py <= r + 1e-6 && b.y >= r && solidUnder(grid, b.x, b.w, r)) { b.y = r; b.vy = 0; b.ground = true; break; }
      }
    } else if (b.y - b.h < 1) { b.y = 1 + b.h; b.vy = 0; }
    if (b.y > ROWS + 3) { b.y = ROWS + 3; b.vy = 0; }   // ниже пола — только ванна
  }
  function overlapRect(a, b) { return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && a.y - a.h < b.y && b.y - b.h < a.y; }
  function circleRect(cx, cy, r, b) {
    var nx = clamp(cx, b.x - b.w / 2, b.x + b.w / 2), ny = clamp(cy, b.y - b.h, b.y);
    var dx = cx - nx, dy = cy - ny; return dx * dx + dy * dy < r * r;
  }

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, emit = opts.onEvent || function () {};
    var maxLevel = opts.maxLevel || 31;
    var waitAfter = opts.waitAfter || function () { return false; };
    var diffFn = opts.difficulty || function (lv, base, step, max) { return Math.min(max, base + (lv - 1) * step); };
    var S = {
      level: opts.level || 1, maxLevel: maxLevel, score: 0, phase: 'ready', phaseT: 0, time: 0, levelT: 0,
      over: false, won: false, nextLife: EXTRA_LIFE,
      players: [], enemies: [], shots: [], blasts: [], boss: null, grid: null, segs: null, vats: [],
      zone: 'workshop', combo: 0, comboT: 0, comboBest: 0, melted: 0, kills: 0, total: 0, timeBonus: 0
    };
    var nextId = 1;

    function mkPlayer(i, lives) {
      var sp = SPAWNS[i];
      return { i: i, x: sp.x, y: sp.y, vx: 0, vy: 0, w: PW, h: PH, ground: true, face: i ? -1 : 1, alive: true, lives: lives,
        out: false, inv: START_INV, deadT: 0, cd: 0, dir: 0, jumpHeld: false, prevJump: false, jumpBuf: 0, coyote: 0,
        blowHeld: false, charge: 0, charging: false, airUsed: false, walk: 0, blastT: 0, why: '', joined: S.time };
    }
    for (var pi = 0; pi < (opts.players || 1); pi++) S.players.push(mkPlayer(pi, opts.lives || LIVES));

    function addScore(n) {
      S.score += n;
      while (S.score >= S.nextLife) {
        S.nextLife += EXTRA_LIFE;
        S.players.forEach(function (p) { if (!p.out) p.lives = Math.min(MAX_LIVES, p.lives + 1); });
        emit('life', { score: S.score });
      }
    }
    function mkEnemy(type, x, y) {
      var d = ENEMY[type];
      return { id: nextId++, type: type, x: x, y: y, vx: 0, vy: 0, w: EW, h: EH, ground: false, dir: rng() < 0.5 ? -1 : 1, vdir: rng() < 0.5 ? -1 : 1,
        mode: 'walk', daze: 0, wake: 0, pend: 0, downed: false, airTop: y, spawnT: 1.4, think: 0.3 + rng() * 0.5, hopT: 0.6 + rng(), shotCd: 1.5 + rng() * 1.5,
        charge: 0, edgeT: 0, by: -1, speed: d.speed * diffFn(S.level, 1, 0.012, 1.35), fly: d.fly };
    }
    function loadLevel(n) {
      var LV = level(n);
      S.grid = LV.grid; S.segs = buildGraph(LV.grid); S.vats = vatsOf(LV.vats); S.zone = LV.zone; S.vatKind = LV.vats;
      S.enemies = []; S.shots = []; S.blasts = []; S.boss = null;
      S.levelT = 0; S.phase = 'ready'; S.phaseT = 1.6; S.combo = 0; S.comboT = 0; S.timeBonus = 0;
      var spots = S.segs.filter(function (s) { return s.row < ROWS - 1 && s.c1 - s.c0 >= 2; });
      var order = spots.slice().sort(function (a, b) { return a.row - b.row || a.c0 - b.c0; });
      var used = {};
      LV.enemies.forEach(function (t, k) {
        var s = order[(k * 3 + Math.floor(rng() * 2)) % order.length];
        var slot = used[s.id] = (used[s.id] || 0) + 1;
        var span = s.shi - s.slo, x = s.slo + span * (slot === 1 ? 0.5 : slot === 2 ? 0.2 : 0.8);
        var e = mkEnemy(t, x, s.row);
        if (e.fly) e.y = s.row - 1.2;
        S.enemies.push(e);
      });
      S.total = S.enemies.length;
      if (LV.boss) {
        S.boss = { x: 16, y: 10, w: BOSS.w, h: BOSS.h, vx: BOSS.speed, vy: BOSS.speed * 0.6, hp: BOSS.hp, max: BOSS.hp, alive: true, dying: false,
          spitT: BOSS.spitT, flash: 0, spawnT: 1.6, sink: 0 };
        S.total = 1;
      }
      S.players.forEach(function (p) {
        var sp = SPAWNS[p.i];
        p.x = sp.x; p.y = sp.y; p.vx = 0; p.vy = 0; p.face = p.i ? -1 : 1; p.cd = 0; p.charge = 0; p.charging = false;
        if (!p.out) { p.alive = true; p.deadT = 0; p.inv = START_INV; }
      });
      emit('level', { level: n, boss: !!LV.boss });
    }

    // ---------- Хлопок ----------
    function blast(i, pw) {
      var p = S.players[i];
      if (!p || !p.alive || p.cd > 0 || S.phase === 'over' || S.phase === 'ready') return false;
      pw = clamp(pw == null ? P_MIN : pw, P_MIN, 1);
      var f = p.face, range = blastRange(pw), top = p.y - PH - 0.6, bot = p.y + 0.4, hits = 0;
      p.cd = BLAST_CD; p.blastT = 0.22; p.charge = 0; p.charging = false;
      S.enemies.forEach(function (e) {
        if (e.spawnT > 0) return;
        var dx = (e.x - p.x) * f;
        if (dx < -0.6 || dx > range + e.w / 2) return;
        if (e.y - e.h > bot || e.y < top) return;
        var k = WEIGHT[e.type] || 1, fall = 1 - 0.4 * Math.max(0, dx) / range, v = (V_BASE + V_K * pw) * k * fall;
        e.vx = f * v; e.mode = 'tumble'; e.daze = 0; e.pend = 0; e.by = i; e.charge = 0;
        if (e.fly && !e.downed) { e.downed = true; e.pend = DAZE_DOWN; }   // копоть сдувает — она оседает и лежит
        e.vy = -(3 + 4 * pw) * Math.min(k, 1.1); e.ground = false; e.airTop = e.y;
        hits++;
      });
      // искры и капли в волне — разворачиваются (капли летят в Котёл)
      S.shots = S.shots.filter(function (s) {   // рядом с героем (в т. ч. за спиной) волна гасит искры и капли
        if (s.back || Math.abs(s.x - p.x) > 1.6 || s.y < p.y - PH - 2.0 || s.y > p.y + 0.5 || (s.x - p.x) * f > 0.3) return true;
        emit('douse', { x: s.x, y: s.y }); return false;
      });
      S.shots.forEach(function (s) {
        if (s.back) return;
        var dx = (s.x - p.x) * f;
        if (dx < -0.8 || dx > range + 0.8 || s.y < top - SHOT_TOP || s.y > bot + 0.4) return;   // капли и искры ловятся с запасом сверху
        s.back = true; s.t = 4;
        var B = S.boss;
        if (s.kind === 'drop' && B && B.alive && !B.dying) {
          var ax = B.x - s.x, ay = (B.y - B.h / 2) - s.y, l = Math.sqrt(ax * ax + ay * ay) || 1;
          s.vx = ax / l * 11; s.vy = ay / l * 11;
        } else { s.vx = f * 10; s.vy = 0; }
        emit('reflect', { x: s.x, y: s.y, kind: s.kind });
      });
      var B = S.boss;
      if (B && B.alive && !B.dying && B.spawnT <= 0) {
        var bdx = (B.x - p.x) * f;
        if (bdx > -1 && bdx < range + B.w / 2 && B.y - B.h < bot && B.y > top) { B.vx = f * Math.abs(B.vx); B.x += f * 0.6; }
      }
      if (!p.ground && !p.airUsed) { p.vy = Math.min(p.vy, -AIR_HOP); p.cut = true; p.airUsed = true; emit('hop', { player: i }); }
      S.blasts.push({ x: p.x + f * 0.9, y: p.y - PH / 2, face: f, range: range, pw: pw, t: 0.32, owner: i });
      emit('blast', { player: i, x: p.x + f, y: p.y - PH / 2, power: pw, hits: hits });
      return true;
    }

    function melt(e, vat) {
      var k = S.enemies.indexOf(e); if (k < 0) return;
      S.enemies.splice(k, 1); S.melted++; S.kills++;
      S.combo = S.comboT > 0 ? S.combo + 1 : 1; S.comboT = COMBO_T;
      if (S.combo > S.comboBest) S.comboBest = S.combo;
      var pts = MELT_PTS * Math.min(S.combo, COMBO_MAX); addScore(pts);
      emit('melt', { x: vat ? vat.x : e.x, y: ROWS - 1, type: e.type, score: pts, combo: S.combo, player: e.by });
    }
    function dazeE(e, t, why) {
      e.mode = 'daze'; e.daze = Math.max(e.daze, t); e.charge = 0;
      if (why) emit(why, { x: e.x, y: e.y - EH / 2, type: e.type });
    }

    // ---------- Игроки ----------
    function die(p, why, force) {
      if (!p.alive || (p.inv > 0 && !force) || S.phase !== 'play') return;
      p.alive = false; p.lives--; p.deadT = RESPAWN_T; p.vx = 0; p.vy = why === 'vat' ? 2 : -10; p.why = why; p.charge = 0; p.charging = false;
      emit('die', { player: p.i, x: p.x, y: p.y - PH / 2, lives: p.lives, why: why });
      if (p.lives <= 0) p.out = true;
      if (S.players.every(function (q) { return q.out; })) { S.phase = 'over'; S.over = true; S.phaseT = 0; emit('gameover', { score: S.score }); }
    }
    function respawn(p) {
      var sp = SPAWNS[p.i]; p.x = sp.x; p.y = sp.y; p.vx = 0; p.vy = 0; p.alive = true; p.inv = INV_T; p.charge = 0; p.charging = false;
    }
    function updatePlayer(p, dt) {
      if (p.out && !p.alive && p.deadT <= 0) return;
      if (!p.alive) {
        p.deadT -= dt;
        if (p.why === 'vat') p.y = Math.min(ROWS + 1.5, p.y + dt * 1.5);
        else { p.vy = Math.min(VMAX, p.vy + G * 0.5 * dt); p.y = Math.min(ROWS + 1.5, p.y + p.vy * dt * 0.5); }
        if (p.deadT <= 0 && !p.out) { respawn(p); emit('respawn', { player: p.i }); }
        return;
      }
      if (p.inv > 0) p.inv -= dt;
      if (p.cd > 0) p.cd -= dt;
      if (p.blastT > 0) p.blastT -= dt;
      // хлопок: удержание раздувает, отпускание — хлопок; передержал — лопается сам
      if (p.blowHeld && p.cd <= 0 && S.phase === 'play') { p.charging = true; p.charge += dt; if (p.charge >= CHARGE_AUTO) blast(p.i, 1); }
      else if (p.charging && !p.blowHeld) blast(p.i, power(p.charge));
      else if (!p.blowHeld) { p.charging = false; p.charge = 0; }
      if (p.jumpHeld && !p.prevJump) p.jumpBuf = 0.12;
      p.prevJump = p.jumpHeld;
      if (p.jumpBuf > 0) p.jumpBuf -= dt;
      if (p.ground) { p.coyote = 0.08; p.airUsed = false; } else if (p.coyote > 0) p.coyote -= dt;
      p.vx = p.dir * RUN * (p.charging && p.ground ? CHARGE_RUN : 1);   // раздувая пузырь на земле, стоишь на месте, но можешь повернуться
      if (p.dir) p.face = p.dir;
      if (p.jumpBuf > 0 && p.coyote > 0) { p.vy = -JUMP_V; p.jumpBuf = 0; p.coyote = 0; p.ground = false; p.cut = false; emit('jump', { player: p.i }); }
      if (!p.jumpHeld && !p.cut && p.vy < -JUMP_CUT) { p.vy = -JUMP_CUT; p.cut = true; }   // отпустил прыжок — ниже
      moveBody(S.grid, p, dt);
      p.walk = p.ground && p.dir ? p.walk + dt : 0;
      if (p.y > ROWS - 0.4) die(p, 'vat', true);
    }

    // ---------- Враги ----------
    function nearestPlayer(e) {
      var best = null, bd = 1e9;
      S.players.forEach(function (p) { if (!p.alive) return; var d = Math.abs(p.x - e.x) + Math.abs(p.y - e.y) * 1.5; if (d < bd) { bd = d; best = p; } });
      return best;
    }
    function knockOthers(e) {
      if (Math.abs(e.vx) < KNOCK_V) return;
      for (var k = 0; k < S.enemies.length; k++) {
        var o = S.enemies[k];
        if (o === e || o.spawnT > 0 || o.mode === 'tumble') continue;
        if (!overlapRect(e, o)) continue;
        o.vx = e.vx * 0.8; o.mode = 'tumble'; o.by = e.by; o.daze = 0;
        if (!o.fly || o.downed) { o.vy = -4; o.ground = false; o.airTop = o.y; }
        e.vx *= 0.45;
        addScore(KNOCK_PTS);
        emit('knock', { x: o.x, y: o.y - EH / 2, type: o.type, score: KNOCK_PTS });
      }
    }
    function tumbleE(e, dt) {
      var heavy = !e.fly || e.downed, v0 = e.vx, wasGround = e.ground, row0 = Math.round(e.y);
      if (heavy) {
        moveBody(S.grid, e, dt);
        // над ванной на полу — проваливается, даже на полном ходу (иначе быстрый кувырок перескочил бы проём)
        var vt = e.ground && Math.round(e.y) === ROWS - 1 ? inVat(S.vats, e.x) : null;
        if (vt && e.x > vt.c0 + 0.15 && e.x < vt.c1 + 0.85) { e.y = ROWS - 1 + 0.05; e.vy = 5; e.vx *= 0.3; e.ground = false; e.sink = vt; }
        if (e.sink) e.x = clamp(e.x, e.sink.c0 + 0.5, e.sink.c1 + 0.5);
        if (!e.ground) e.airTop = Math.min(e.airTop, e.y);
        if (e.ground) e.vx -= sgn(e.vx) * Math.min(Math.abs(e.vx), frict(e) * dt);
        if (wasGround && !e.ground && e.vy >= 0 && row0 < ROWS - 1) { addScore(LEDGE_PTS); emit('ledge', { x: e.x, y: e.y, score: LEDGE_PTS }); }
      } else {
        e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= Math.max(0, 1 - 2.5 * dt); e.vy *= Math.max(0, 1 - 3 * dt);
        e.wall = 0;
        if (e.x < WL + e.w / 2) { e.x = WL + e.w / 2; e.wall = -1; } else if (e.x > WR - e.w / 2) { e.x = WR - e.w / 2; e.wall = 1; }
      }
      knockOthers(e);
      // удар о стену: отскок назад (кувырок продолжается), после остановки — долгое оглушение; копоть падает
      if (e.wall && Math.abs(v0) > BONK_V) {
        e.vx = -v0 * BOUNCE; e.pend = Math.max(e.pend || 0, heavy ? DAZE_WALL : DAZE_DOWN);
        if (!heavy) { e.downed = true; e.vy = 0; e.airTop = e.y; }
        emit('bonk', { x: e.x, y: e.y - EH / 2, type: e.type });
        return;
      }
      if (heavy && e.ground && !wasGround && e.y - e.airTop >= 2.5) e.pend = Math.max(e.pend || 0, DAZE_FALL), emit('thud', { x: e.x, y: e.y - EH / 2, type: e.type });
      if (heavy && e.ground && Math.abs(e.vx) < 0.8) { e.vx = 0; dazeE(e, Math.max(DAZE_STOP, e.pend || 0)); e.pend = 0; return; }
      if (!heavy && Math.abs(e.vx) < 1) { e.mode = 'walk'; e.vx = 0; }
    }
    function updateEnemy(e, dt) {
      if (e.spawnT > 0) { e.spawnT -= dt; return; }
      if (e.mode === 'tumble') { tumbleE(e, dt); return; }
      if (e.mode === 'daze') {
        e.daze -= dt;
        if (!e.fly || e.downed) { moveBody(S.grid, e, dt); if (e.ground) e.vx -= sgn(e.vx) * Math.min(Math.abs(e.vx), frict(e) * dt); }
        if (e.daze <= 0) { e.mode = 'walk'; e.vx = 0; e.wake = WAKE_T; if (e.downed) { e.downed = false; e.vdir = -1; } }
        return;
      }
      if (e.wake > 0) e.wake -= dt;
      var sp = e.speed, tgt = nearestPlayer(e);
      e.think -= dt;
      if (e.fly) {
        e.vx = e.dir * sp; e.vy = e.vdir * sp * 0.7;
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.x < WL + e.w / 2) { e.x = WL + e.w / 2; e.dir = 1; } else if (e.x > WR - e.w / 2) { e.x = WR - e.w / 2; e.dir = -1; }
        if (e.y - e.h < 1.2) { e.y = 1.2 + e.h; e.vdir = 1; } else if (e.y > ROWS - 1.2) { e.y = ROWS - 1.2; e.vdir = -1; }
        if (e.think <= 0) { e.think = 1 + rng() * 1.2; if (tgt && rng() < 0.4) { e.dir = tgt.x < e.x ? -1 : 1; e.vdir = tgt.y - 0.8 < e.y ? -1 : 1; } }
        return;
      }
      var floor = Math.round(e.y) === ROWS - 1;
      if (e.ground) {
        if (e.think <= 0) {
          e.think = 0.7 + rng() * 0.7;
          if (tgt) {
            var dy = tgt.y - e.y, adx = Math.abs(tgt.x - e.x);
            if (Math.abs(dy) < 1 && adx < 9 && rng() < 0.45) e.dir = tgt.x < e.x ? -1 : 1;
            if (dy < -2.5 && adx > 1.2 && adx < 6 && S.levelT > 4 && S.level > 2 && rng() < 0.15 && e.type !== 'spring') { e.vy = -JUMP_V; e.ground = false; }
          }
        }
        if (e.type === 'spring') {
          e.hopT -= dt;
          if (e.hopT <= 0) { e.hopT = 1.2 + rng() * 0.8; e.vy = -JUMP_V * (0.6 + rng() * 0.25); e.ground = false; if (tgt && rng() < 0.5) e.dir = tgt.x < e.x ? -1 : 1; }
        }
        // край: на полу (у ванны) — всегда разворот; на платформе — развернуться или шагнуть вниз
        if (e.ground && !cellAt(S.grid, e.x + e.dir * (e.w / 2 + 0.05), Math.round(e.y))) {
          if (floor) e.dir = -e.dir;
          else if (e.edgeT <= 0) { e.edgeT = 0.5; if (rng() < 0.5) e.dir = -e.dir; }
        }
        if (e.edgeT > 0) e.edgeT -= dt;
      }
      // в прыжке пружина не направляет себя в ванну
      if (!e.ground && e.type === 'spring' && floor === false && e.y > ROWS - 3 && inVat(S.vats, e.x + e.dir * 1.2)) e.dir = -e.dir;
      e.vx = e.charge > 0 ? 0 : e.dir * sp * (e.ground ? 1 : 0.8);
      moveBody(S.grid, e, dt);
      if (e.wall) e.dir = -e.wall;
      if (e.type === 'spark') {
        e.shotCd -= dt;
        if (e.charge > 0) {
          e.charge -= dt;
          if (e.charge <= 0) { S.shots.push({ x: e.x + e.dir * 0.8, y: e.y - EH / 2, vx: e.dir * 5.5, vy: 0, t: 3.5, kind: 'spark', back: false }); emit('shoot', { x: e.x, y: e.y }); }
        } else if (e.shotCd <= 0 && tgt && e.ground && Math.abs(tgt.y - e.y) < 0.8 && (tgt.x - e.x) * e.dir > 0 && Math.abs(tgt.x - e.x) < 9) {
          e.shotCd = 3.4; e.charge = 0.6; emit('charge', { x: e.x, y: e.y });
        }
      }
    }

    // ---------- Котёл ----------
    function hitBoss(x, y) {
      var B = S.boss; if (!B || !B.alive || B.dying) return;
      B.hp = Math.max(0, B.hp - 1); B.flash = 0.25; addScore(BOSS.hitPts);
      emit('bossHit', { x: x, y: y, hp: B.hp });
      if (B.hp <= 0) { B.dying = true; S.dropAll = true; emit('bossFall', { x: B.x, y: B.y - B.h / 2 }); }
    }
    function updateBoss(B, dt) {
      if (B.spawnT > 0) { B.spawnT -= dt; return; }
      if (B.flash > 0) B.flash -= dt;
      if (B.dying) {
        B.x += (16 - B.x) * Math.min(1, dt * 2); B.y = Math.min(ROWS + B.h, B.y + (2 + B.sink * 4) * dt); B.sink += dt;
        if (B.y - B.h > ROWS - 1) {
          B.alive = false; addScore(BOSS.pts); S.melted++;
          emit('bossDie', { x: B.x, y: ROWS - 1, score: BOSS.pts });
        }
        return;
      }
      var k = 1 + (1 - B.hp / B.max) * 0.5;
      B.x += B.vx * k * dt; B.y += B.vy * k * dt;
      if (B.x < WL + B.w / 2) { B.x = WL + B.w / 2; B.vx = Math.abs(B.vx); } else if (B.x > WR - B.w / 2) { B.x = WR - B.w / 2; B.vx = -Math.abs(B.vx); }
      if (B.y - B.h < 1.2) { B.y = 1.2 + B.h; B.vy = Math.abs(B.vy); } else if (B.y > ROWS - 7) { B.y = ROWS - 7; B.vy = -Math.abs(B.vy); }
      B.spitT -= dt;
      if (B.spitT <= 0) {
        B.spitT = BOSS.spitT / k;
        var n = B.hp <= B.max / 2 ? 4 : 3, tgt = nearestPlayer(B), base = tgt ? Math.atan2(tgt.y - 0.8 - (B.y - B.h / 2), tgt.x - B.x) : Math.PI / 2;
        for (var i = 0; i < n; i++) {
          var a = base + (i - (n - 1) / 2) * 0.36;
          S.shots.push({ x: B.x, y: B.y - B.h / 2, vx: Math.cos(a) * BOSS.dropV, vy: Math.sin(a) * BOSS.dropV, t: 6, kind: 'drop', back: false });
        }
        emit('spit', { x: B.x, y: B.y - B.h / 2 });
      }
    }

    function updateShots(dt) {
      for (var k = S.shots.length - 1; k >= 0; k--) {
        var s = S.shots[k]; s.t -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.kind === 'drop' && !s.back) s.vy += 4 * dt;
        if (s.x < WL || s.x > WR || s.y > ROWS || s.y < 0.5 || s.t <= 0) { S.shots.splice(k, 1); continue; }
        if (s.back) {
          var B = S.boss;
          if (s.kind === 'drop' && B && B.alive && !B.dying && Math.abs(B.x - s.x) < B.w / 2 + 0.2 && s.y > B.y - B.h - 0.2 && s.y < B.y + 0.2) { hitBoss(s.x, s.y); S.shots.splice(k, 1); continue; }
          for (var j = 0; j < S.enemies.length; j++) {
            var e = S.enemies[j];
            if (e.spawnT <= 0 && Math.abs(e.x - s.x) < e.w / 2 + 0.3 && s.y > e.y - e.h - 0.2 && s.y < e.y + 0.2) {
              if (e.fly && !e.downed) e.downed = true;
              dazeE(e, DAZE_SPARK, 'zap'); addScore(KNOCK_PTS); S.shots.splice(k, 1); break;
            }
          }
          continue;
        }
        for (var i = 0; i < S.players.length; i++) {
          var p = S.players[i];
          if (p.alive && p.inv <= 0 && Math.abs(p.x - s.x) < p.w / 2 + 0.2 && s.y > p.y - p.h && s.y < p.y) { die(p, s.kind); S.shots.splice(k, 1); break; }
        }
      }
      if (S.dropAll) { S.shots = []; S.dropAll = false; }   // Котёл повержен — капли гаснут
    }

    function finishLevel() {
      if (S.level >= S.maxLevel) { S.phase = 'over'; S.over = true; S.won = true; emit('win', { score: S.score }); }
      else { S.level++; loadLevel(S.level); }
    }
    function update(dt) {
      S.time += dt;
      for (var b = S.blasts.length - 1; b >= 0; b--) { S.blasts[b].t -= dt; if (S.blasts[b].t <= 0) S.blasts.splice(b, 1); }
      if (S.over) return;
      if (S.phase === 'ready') {
        S.phaseT -= dt;
        S.players.forEach(function (p) { if (p.alive) { p.vx = 0; moveBody(S.grid, p, dt); } });
        if (S.phaseT <= 0) { S.phase = 'play'; S.phaseT = 0; }
        return;
      }
      if (S.phase === 'rest') return;
      if (S.phase === 'clear') {
        S.phaseT -= dt;
        S.players.forEach(function (p) { updatePlayer(p, dt); });
        if (S.phaseT <= 0) {
          if (S.level < S.maxLevel && waitAfter(S.level)) { S.phase = 'rest'; emit('rest', { level: S.level }); }
          else finishLevel();
        }
        return;
      }
      S.levelT += dt;
      if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) S.combo = 0; }

      S.players.forEach(function (p) { updatePlayer(p, dt); });
      S.enemies.slice().forEach(function (e) {
        updateEnemy(e, dt);
        if (e.y > ROWS - 0.4) melt(e, inVat(S.vats, e.x));
      });
      if (S.boss && S.boss.alive) updateBoss(S.boss, dt);
      updateShots(dt);

      // касания: опасен только враг «на ходу» (кувыркающийся и оглушённый — безвредны)
      S.players.forEach(function (p) {
        if (!p.alive || p.inv > 0) return;
        for (var k = 0; k < S.enemies.length; k++) {
          var e = S.enemies[k];
          if (e.spawnT <= 0 && e.mode === 'walk' && !(e.wake > 0) && Math.abs(e.x - p.x) < (e.w + p.w) / 2 - HIT_PAD && e.y - e.h + 0.5 < p.y && p.y - p.h + 0.6 < e.y) {
            // упал врагу на макушку — отскок, враг ненадолго оглушён (безопасная посадка, не победа над ним)
            if (p.vy > 0 && !p.ground && p.y - (e.y - e.h) < BOP_DEPTH) { p.vy = -BOP_V; p.cut = true; dazeE(e, DAZE_BOP, 'bop'); addScore(KNOCK_PTS); continue; }
            // снизу сквозь платформу — упёрся головой в стоящего врага: отброшен вниз, без вреда
            if (e.ground && p.y > e.y + 0.4 && e.y - (p.y - p.h) < BUMP_DEPTH) { if (p.vy < 3) { p.vy = 3; p.cut = true; emit('bump', { x: p.x, y: p.y - PH }); } continue; }
            die(p, 'enemy'); return;
          }
        }
        var B = S.boss;
        if (B && B.alive && !B.dying && B.spawnT <= 0 && Math.abs(B.x - p.x) < (B.w + p.w) / 2 - 0.5 && B.y - B.h + 0.4 < p.y && p.y - p.h + 0.4 < B.y) die(p, 'boss');
      });

      if (S.phase === 'play' && !S.enemies.length && !(S.boss && S.boss.alive)) {
        S.phase = 'clear'; S.phaseT = S.boss ? CLEAR_T + 1 : CLEAR_T; S.shots = [];
        S.timeBonus = S.boss ? 0 : Math.max(0, Math.round(PAR_T - S.levelT)) * TIME_PTS;
        if (S.timeBonus) addScore(S.timeBonus);
        emit('clear', { level: S.level, time: S.levelT, bonus: S.timeBonus });
      }
    }

    var api = {
      start: function () { loadLevel(S.level); return api; },
      update: update,
      setInput: function (i, dx, jumpHeld, blowHeld) { var p = S.players[i]; if (p) { p.dir = dx < 0 ? -1 : dx > 0 ? 1 : 0; p.jumpHeld = !!jumpHeld; p.blowHeld = !!blowHeld; } },
      blast: blast,
      proceed: function () { if (S.phase !== 'rest') return false; finishLevel(); return true; },
      join: function (i) {
        i = i || 1;
        if (S.over) return false;
        var p = S.players[i];
        if (!p) { while (S.players.length < i) S.players.push(mkPlayer(S.players.length, LIVES)); p = mkPlayer(i, LIVES); S.players[i] = p; emit('join', { player: i }); return true; }
        if (p.out) { p.out = false; p.lives = LIVES; p.deadT = 0; respawn(p); emit('join', { player: i }); return true; }
        return false;
      },
      // «ещё один шанс» (реклама за награду): все возвращаются с 3 жизнями, уровень продолжается
      revive: function () {
        if (!S.over || S.won) return false;
        S.over = false; S.phase = 'play';
        S.players.forEach(function (p) { p.out = false; p.lives = LIVES; p.deadT = 0; respawn(p); });
        emit('revive', {}); return true;
      },
      canBoost: function () { return !S.over && S.players.some(function (p) { return !p.out && p.lives < MAX_LIVES; }); },
      boost: function () { S.players.forEach(function (p) { if (!p.out) p.lives = Math.min(MAX_LIVES, p.lives + 1); }); emit('life', { score: S.score }); },
      state: function () { return S; },
      _S: S, _mkEnemy: mkEnemy, _load: loadLevel, _melt: melt
    };
    return api;
  }

  Z.logic = {
    COLS: COLS, ROWS: ROWS, WL: WL, WR: WR, G: G, VMAX: VMAX, RUN: RUN, JUMP_V: JUMP_V, JUMP_UP: JUMP_UP,
    JUMP_CUT: JUMP_CUT, HOP_HOLD: HOP_HOLD, PW: PW, PH: PH, EW: EW, EH: EH, SHOT_TOP: SHOT_TOP, CHARGE_MAX: CHARGE_MAX, CHARGE_AUTO: CHARGE_AUTO, BLAST_CD: BLAST_CD, P_MIN: P_MIN,
    FRICT: FRICT, FRICT_FLOOR: FRICT_FLOOR, BOUNCE: BOUNCE, WEIGHT: WEIGHT, MELT_PTS: MELT_PTS, COMBO_T: COMBO_T, COMBO_MAX: COMBO_MAX, KNOCK_PTS: KNOCK_PTS, PAR_T: PAR_T, TIME_PTS: TIME_PTS,
    LIVES: LIVES, EXTRA_LIFE: EXTRA_LIFE, SPAWNS: SPAWNS, ENEMY: ENEMY, BOSS: BOSS, BIND: BIND, HAND: HAND, ZONES: ZONES, VATS: VATS, LEVELS: 30,
    DAZE_WALL: DAZE_WALL, DAZE_FALL: DAZE_FALL,
    idx: idx, level: level, emptyGrid: emptyGrid, gridFromRows: gridFromRows, vatsOf: vatsOf, inVat: inVat, segments: segments,
    segAt: segAt, landing: landing, drive: drive, simEdge: simEdge, buildGraph: buildGraph, reach: reach, route: route, validate: validate, moveBody: moveBody,
    solidUnder: solidUnder, cellAt: cellAt, circleRect: circleRect, overlapRect: overlapRect, mulberry32: mulberry32, power: power, blastRange: blastRange
  };
  Z.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
