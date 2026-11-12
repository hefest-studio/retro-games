/* ПУЗЫРЬ · логика игры (без DOM, детерминирована при заданном rng).
   Односкринный платформер на 1–2 игроков: стеклодувы-подмастерья Колба и Реторта
   выдувают стеклянные шары, ловят в них врагов и лопают; враги превращаются в бонусы.
   Поле 32×24 клетки: стены по бокам (по 2 колонки), потолок и пол с проёмом посередине —
   упал в проём внизу → появился сверху. Платформы односторонние: снизу проходишь, сверху стоишь.
   30 уровней (6 ручных карт + процедурные с проверкой проходимости) + финал — Котёл.
   PUZYR.Game(opts) → api; PUZYR.logic — константы, уровни, генератор/граф проходимости, помощники. */
(function (global) {
  'use strict';
  var Z = global.PUZYR = global.PUZYR || {};

  // ---------- Константы (единицы — клетки и секунды) ----------
  var COLS = 32, ROWS = 24, WL = 2, WR = 30;     // внутренняя ширина — колонки 2..29
  var GAP0 = 14, GAP1 = 17;                      // проём в полу/потолке — колонки 14..17
  var G = 70, VMAX = 13, RUN = 6.5, JUMP_V = 26; // высота прыжка ≈ 4,8 клетки
  var JUMP_UP = 4;                               // на сколько рядов вверх можно запрыгнуть
  var PW = 1.4, PH = 1.7, EW = 1.4, EH = 1.5;    // размеры героя и врага
  var BR = 0.9;                                  // радиус шара
  var SHOOT_V = 15, RANGE = 5.5, BLOW_CD = 0.32; // выдув: скорость, дальность, перезарядка
  var RISE = 2.4, DRIFT = 1.8, CEIL_Y = 1 + BR;  // всплытие и дрейф под потолком
  var EMPTY_LIFE = 11, SPECIAL_LIFE = 18, LETTER_LIFE = 16;
  var TRAP_T = 9, TRAP_MIN = 5.5;                // сколько враг сидит в шаре (падает с уровнем)
  var ANGRY_K = 1.6;                             // множитель скорости разозлённого врага
  var HURRY_T = 45, ANGRY_T = 52;                // «Сквозняк!» и общее озлобление по таймеру уровня
  var RESPAWN_T = 1.6, INV_T = 2.5, START_INV = 2.0;
  var LIVES = 3, MAX_LIVES = 9, EXTRA_LIFE = 20000;
  var CLEAR_T = 3.5, ITEM_LIFE = 9;
  var WORD_LEN = 6, WORD_BONUS = 5000;           // «ГЕФЕСТ» / «HEFEST»
  var SPAWNS = [{ x: 4.5, y: 23 }, { x: 27.5, y: 23 }];
  var ROWS_STD = [19, 15, 11, 7, 4];
  // Бонусы-детали из лопнувших врагов: чем длиннее цепочка — тем дороже
  var ITEMS = [
    { kind: 'apple', score: 500 }, { kind: 'pear', score: 1000 }, { kind: 'plum', score: 2000 },
    { kind: 'nut', score: 3000 }, { kind: 'gem', score: 5000 }, { kind: 'crown', score: 10000 }
  ];
  // Враги (свои имена — в i18n): зубец ходит, пружина скачет, копоть летает, искрун ходит и мечет искры
  var ENEMY = {
    cog:    { speed: 3.0, fly: false },
    spring: { speed: 2.6, fly: false },
    soot:   { speed: 2.8, fly: true },
    spark:  { speed: 2.4, fly: false }
  };
  var SPECIALS = ['fire', 'water', 'bolt'];      // Жар, Ливень, Гроза
  var BOSS = { w: 4.4, h: 4, hp: 40, speed: 3.2, spitT: 2.8, bubbleDmg: 1, boltDmg: 5 };

  // Раскладки кооп-управления (g.usePlayers): И1 — стрелки, И2 — WASD; jump — прыжок, blow — выдуть шар
  var BIND = {
    p1: { left: ['ArrowLeft'], right: ['ArrowRight'], down: ['ArrowDown'], jump: ['ArrowUp', 'Slash'], blow: ['Space', 'Period', 'Numpad0'] },
    p2: { left: ['KeyA'], right: ['KeyD'], down: ['KeyS'], jump: ['KeyW', 'KeyG'], blow: ['KeyF', 'KeyE'] }
  };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function idx(x, y) { return y * COLS + x; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function inGap(x) { return x >= GAP0 && x < GAP1 + 1; }

  // ---------- Карты ----------
  // Ручная карта: ряды → пролёты [c0,c1] (включительно) в левой половине (2..15), зеркалятся вправо (c → 31−c).
  // Пролёт, заходящий за середину (c1 ≥ 15), при зеркалировании сливается в общий центральный.
  var HAND = {
    1:  { wind: 'center', rows: { 19: [[2, 9], [13, 15]], 15: [[6, 11]], 11: [[2, 7], [12, 15]], 7: [[6, 11]], 4: [[11, 15]] } },
    6:  { wind: 'split',  rows: { 20: [[5, 9], [13, 15]], 16: [[2, 5], [9, 12]], 12: [[5, 9], [13, 15]], 8: [[2, 6], [10, 13]], 4: [[6, 10], [14, 15]] } },
    12: { wind: 'left',   rows: { 19: [[2, 4], [8, 15]], 15: [[4, 9]], 11: [[2, 4], [9, 15]], 7: [[4, 8]], 4: [[5, 12]] } },
    18: { wind: 'swirl',  rows: { 20: [[2, 3], [7, 10], [14, 15]], 16: [[4, 6], [11, 13]], 12: [[2, 3], [7, 9], [14, 15]], 8: [[4, 6], [10, 13]], 4: [[6, 9], [13, 15]] } },
    24: { wind: 'right',  rows: { 19: [[4, 15]], 15: [[2, 5], [9, 12]], 11: [[6, 10]], 7: [[2, 4], [9, 15]], 4: [[5, 9]] } },
    30: { wind: 'center', rows: { 20: [[2, 6], [12, 15]], 17: [[8, 10]], 14: [[2, 5], [12, 15]], 11: [[7, 9]], 8: [[3, 5], [12, 15]], 4: [[7, 10], [13, 15]] } }
  };
  var BOSS_MAP = { wind: 'center', rows: { 20: [[4, 8], [13, 15]], 16: [[2, 4], [9, 11]], 12: [[5, 8], [13, 15]], 8: [[3, 5], [9, 12]], 4: [[12, 15]] } };
  var ZONES = ['workshop', 'kiln', 'glass', 'pipes', 'dome'];
  var WINDS = ['center', 'left', 'right', 'swirl', 'split'];
  var MOTIFS = ['rows', 'islands', 'steps', 'ledges', 'zig'];

  function emptyGrid() {
    var g = new Uint8Array(COLS * ROWS);
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
      if (x < WL || x >= WR) g[idx(x, y)] = 1;
      else if ((y === 0 || y === ROWS - 1) && !(x >= GAP0 && x <= GAP1)) g[idx(x, y)] = 1;
    }
    return g;
  }
  function gridFromRows(rows) {
    var g = emptyGrid();
    Object.keys(rows).forEach(function (r) {
      rows[r].forEach(function (s) {
        for (var c = s[0]; c <= s[1]; c++) { g[idx(c, +r)] = 1; g[idx(COLS - 1 - c, +r)] = 1; }
      });
    });
    return g;
  }

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
  // Куда приземлится падающий по вертикали x из ряда row (с учётом проёма: снизу → сверху)
  function landing(segs, x, row) {
    var best = null;
    for (var i = 0; i < segs.length; i++) { var s = segs[i]; if (s.row > row && x > s.lo && x < s.hi && (!best || s.row < best.row)) best = s; }
    if (best) return best;
    for (i = 0; i < segs.length; i++) { s = segs[i]; if (x > s.lo && x < s.hi && (!best || s.row < best.row)) best = s; }
    return best;
  }
  function buildGraph(grid) {
    var segs = segments(grid);
    segs.forEach(function (A) {
      // спрыгнуть с края
      [-1, 1].forEach(function (side) {
        var x = side < 0 ? A.c0 - PW / 2 - 0.05 : A.c1 + 1 + PW / 2 + 0.05;
        if (x < WL + PW / 2 || x > WR - PW / 2) return;
        if (segAt(segs, x, A.row)) return;
        var B = landing(segs, x, A.row);
        if (B && B !== A) A.edges.push({ to: B.id, type: 'fall', x: side < 0 ? A.slo : A.shi, side: side, land: x });
      });
      // прыжок вверх (вертикально или с разбега на соседний)
      segs.forEach(function (B) {
        if (B === A || B.row >= A.row || A.row - B.row > JUMP_UP) return;
        var lo = Math.max(A.slo, B.slo), hi = Math.min(A.shi, B.shi);
        if (hi - lo >= 0.5) { A.edges.push({ to: B.id, type: 'jump', x: (lo + hi) / 2, tx: (lo + hi) / 2 }); return; }
        var gapMax = A.row - B.row <= 3 ? 2.5 : 1.8;   // с разбега: на 4 ряда — ближе
        if (B.slo > A.shi && B.slo - A.shi <= gapMax) A.edges.push({ to: B.id, type: 'leap', x: A.shi - 0.3, tx: B.slo + 0.6, side: 1 });
        else if (B.shi < A.slo && A.slo - B.shi <= gapMax) A.edges.push({ to: B.id, type: 'leap', x: A.slo + 0.3, tx: B.shi - 0.6, side: -1 });
      });
      // в одном ряду через разрыв ≤ 2,5 — прыжок с разбега
      segs.forEach(function (B) {
        if (B === A || B.row !== A.row) return;
        if (B.slo > A.shi && B.slo - A.shi <= 3) A.edges.push({ to: B.id, type: 'leap', x: A.shi - 0.3, tx: B.slo + 0.6, side: 1 });
        else if (B.shi < A.slo && A.slo - B.shi <= 3) A.edges.push({ to: B.id, type: 'leap', x: A.slo + 0.3, tx: B.shi - 0.6, side: -1 });
      });
    });
    // каждое ребро проверяется прогоном физики: оставляем только реальные переходы (цель — где герой приземлился)
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
  // Управление героем на ребре графа: → { dir, jump }. Общее для проверки рёбер и бота.
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
    if (e.type === 'leap') return { dir: d * e.side > 0.1 ? e.side : 0, jump: false };
    return { dir: Math.abs(d) > 0.2 ? (d < 0 ? -1 : 1) : 0, jump: false };
  }
  // Прогон ребра на настоящей физике: → id сегмента, куда герой приземлился (или −1)
  function simEdge(grid, segs, A, e) {
    var p = { x: e.type === 'leap' ? clamp(e.x - e.side * 1.5, A.slo, A.shi) : e.x, y: A.row, vx: 0, vy: 0, w: PW, h: PH, ground: true }, jumped = false;
    for (var i = 0; i < 300; i++) {
      var c = drive(p, e);
      if (c.jump && p.ground && !jumped) { p.vy = -JUMP_V; jumped = true; p.ground = false; }
      p.vx = c.dir * RUN; moveBody(grid, p, 1 / 60);
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
  // BFS: первый шаг пути из a в b (ребро) или null
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
  // Проверка карты: граф сильно связен, проём закрыт снизу платформой (не провалиться бесконечно),
  // под точкой сбора шаров есть верхняя платформа, есть место для врагов.
  function validate(grid, gatherX) {
    var segs = buildGraph(grid), spawn = segAt(segs, SPAWNS[0].x, ROWS - 1);
    if (!spawn) return { ok: false, why: 'нет пола под И1' };
    var r1 = reach(segs, spawn.id);
    for (var i = 0; i < segs.length; i++) {
      if (!r1[i]) return { ok: false, why: 'сегмент ' + i + ' (ряд ' + segs[i].row + ') недостижим' };
      if (!reach(segs, i)[spawn.id]) return { ok: false, why: 'из сегмента ' + i + ' (ряд ' + segs[i].row + ') не вернуться' };
    }
    if (!segAt(segs, SPAWNS[1].x, ROWS - 1)) return { ok: false, why: 'нет пола под И2' };
    for (var x = GAP0 - PW / 2 + 0.3; x < GAP1 + 1 + PW / 2 - 0.3; x += 0.1) {
      var any = segs.some(function (s) { return s.row < ROWS - 1 && x > s.lo && x < s.hi; });
      if (!any) return { ok: false, why: 'проём без платформы над x=' + x.toFixed(1) };
    }
    if (!segs.some(function (s) { return s.row <= 6 && gatherX > s.slo - 0.5 && gatherX < s.shi + 0.5; })) return { ok: false, why: 'под точкой сбора нет верхней платформы' };
    if (segs.filter(function (s) { return s.row < ROWS - 1 && s.c1 - s.c0 >= 2; }).length < 4) return { ok: false, why: 'мало мест для врагов' };
    return { ok: true, segs: segs };
  }

  // Ветер: точка сбора под потолком и зоны потоков (прямоугольники с вектором скорости)
  function windOf(type) {
    switch (type) {
      case 'left': return { gather: 8, zones: [{ x0: 2, x1: 30, y0: 1, y1: 6, vx: -1.6, vy: 0 }] };
      case 'right': return { gather: 24, zones: [{ x0: 2, x1: 30, y0: 1, y1: 6, vx: 1.6, vy: 0 }] };
      case 'swirl': return { gather: 16, zones: [{ x0: 2, x1: 9, y0: 8, y1: 22, vx: 1.2, vy: -2.2 }, { x0: 23, x1: 30, y0: 8, y1: 22, vx: -1.2, vy: -2.2 }] };
      case 'split': return { gather: 16, zones: [{ x0: 2, x1: 12, y0: 2, y1: 14, vx: 1.4, vy: -1.6 }, { x0: 20, x1: 30, y0: 2, y1: 14, vx: -1.4, vy: -1.6 }] };
      default: return { gather: 16, zones: [] };
    }
  }

  // Состав уровня n (1..30): зона, враги, спецшары, ветер, карта
  function levelSpec(n) {
    var zone = Math.floor((n - 1) / 6), rng = mulberry32(n * 7919 + 17);
    var count = Math.min(7, 3 + Math.floor(n / 5));
    var pool = [['cog', 'cog', 'cog', 'spring'], ['cog', 'spring', 'soot', 'cog'], ['cog', 'spring', 'soot', 'spark'],
      ['spring', 'soot', 'spark', 'cog'], ['soot', 'spark', 'spring', 'cog']][zone];
    var enemies = [];
    for (var i = 0; i < count; i++) enemies.push(n <= 2 ? 'cog' : pool[Math.floor(rng() * pool.length)]);
    var specials = n < 3 ? [] : n < 5 ? ['fire'] : n < 8 ? ['fire', 'water'] : SPECIALS.slice();
    var hand = HAND[n], wind, grid, tries = 0;
    if (hand) { wind = hand.wind; grid = gridFromRows(hand.rows); }
    else {
      wind = WINDS[n % WINDS.length];
      var motif = MOTIFS[n % MOTIFS.length];
      for (tries = 0; tries < 400; tries++) {
        grid = gridFromRows(genRows(motif, mulberry32(n * 104729 + tries * 31 + 1)));
        if (validate(grid, windOf(wind).gather).ok) break;
      }
    }
    return { n: n, zone: ZONES[zone], enemies: enemies, specials: specials, wind: wind, grid: grid, hand: !!hand, tries: tries };
  }
  var LEVEL_CACHE = {};
  function level(n) {
    if (n > 30) return { n: n, zone: 'boss', boss: true, enemies: [], specials: ['bolt'], wind: BOSS_MAP.wind, grid: gridFromRows(BOSS_MAP.rows) };
    return LEVEL_CACHE[n] || (LEVEL_CACHE[n] = levelSpec(n));
  }

  // ---------- Физика тела ----------
  // b: {x (центр), y (ступни), vx, vy, w, h, ground}. Платформы односторонние, стены — боковые, потолок — ряд 0.
  function solidUnder(grid, x, w, r) {
    if (r < 1 || r >= ROWS) return false;
    var a = Math.floor(x - w / 2 + 0.2), b = Math.floor(x + w / 2 - 0.2);
    for (var c = Math.max(WL, a); c <= Math.min(WR - 1, b); c++) if (grid[idx(c, r)]) return true;
    return false;
  }
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
    if (b.y - b.h > ROWS) { b.y -= ROWS + b.h; b.wrapped = (b.wrapped || 0) + 1; }
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
    var diffFn = opts.difficulty || function (lv, base, step, max) { return Math.min(max, base + (lv - 1) * step); };
    var S = {
      level: opts.level || 1, maxLevel: maxLevel, score: 0, phase: 'ready', phaseT: 0, time: 0, levelT: 0,
      over: false, won: false, nextLife: EXTRA_LIFE, letters: [false, false, false, false, false, false],
      players: [], enemies: [], bubbles: [], items: [], shots: [], effects: [], boss: null, grid: null, segs: null,
      wind: null, zone: 'workshop', hurry: false, angryAll: false, specialT: 0, letterT: 0, clearT: 0, chainBest: 0, kills: 0
    };
    var nextId = 1;

    function mkPlayer(i, lives) {
      var sp = SPAWNS[i];
      return { i: i, x: sp.x, y: sp.y, vx: 0, vy: 0, w: PW, h: PH, ground: true, face: i ? -1 : 1, alive: true, lives: lives,
        out: false, inv: START_INV, deadT: 0, blowCd: 0, dir: 0, jumpHeld: false, prevJump: false, jumpBuf: 0, coyote: 0,
        bounceId: 0, bounceT: 0, walk: 0, blowT: 0, joined: S.time };
    }
    for (var pi = 0; pi < (opts.players || 1); pi++) S.players.push(mkPlayer(pi, opts.lives || LIVES));

    function diff(base, step, max) { return diffFn(S.level, base, step, max); }
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
        angry: false, spawnT: 1.4, think: 0.3 + rng() * 0.5, hopT: 0.6 + rng(), shotCd: 1.5 + rng() * 1.5, charge: 0, edgeT: 0,
        speed: d.speed * diff(1, 0.012, 1.35), fly: d.fly };
    }
    function loadLevel(n) {
      var L = level(n);
      S.grid = L.grid; S.segs = buildGraph(L.grid); S.wind = windOf(L.wind); S.zone = L.zone; S.specials = L.specials;
      S.enemies = []; S.bubbles = []; S.items = []; S.shots = []; S.effects = []; S.boss = null;
      S.levelT = 0; S.hurry = false; S.angryAll = false; S.phase = 'ready'; S.phaseT = 1.6; S.chainBest = 0;
      S.specialT = L.boss ? 2.5 : 7 + rng() * 5; S.letterT = 8 + rng() * 8;
      // враги — по разным подходящим платформам, сверху вниз, подальше от пола
      var spots = S.segs.filter(function (s) { return s.row < ROWS - 1 && s.c1 - s.c0 >= 2; });
      var order = spots.slice().sort(function (a, b) { return a.row - b.row || a.c0 - b.c0; });
      var used = {};
      L.enemies.forEach(function (t, k) {
        var s = order[(k * 3 + Math.floor(rng() * 2)) % order.length];
        var key = s.id, slot = used[key] = (used[key] || 0) + 1;
        var span = s.shi - s.slo, x = s.slo + span * (slot === 1 ? 0.5 : slot === 2 ? 0.2 : 0.8);
        var e = mkEnemy(t, x, s.row);
        if (e.fly) e.y = s.row - 1.2;
        S.enemies.push(e);
      });
      if (L.boss) {
        S.boss = { x: 16, y: 9, w: BOSS.w, h: BOSS.h, vx: BOSS.speed, vy: BOSS.speed * 0.7, hp: BOSS.hp, max: BOSS.hp, alive: true, trapped: false,
          spitT: BOSS.spitT, flash: 0, inv: 0, spawnT: 1.6, bubbleY: 0 };
      }
      S.players.forEach(function (p) {
        var sp = SPAWNS[p.i];
        p.x = sp.x; p.y = sp.y; p.vx = 0; p.vy = 0; p.face = p.i ? -1 : 1; p.blowCd = 0; p.bounceT = 0;
        if (!p.out) { p.alive = true; p.deadT = 0; p.inv = START_INV; }
      });
      emit('level', { level: n, boss: !!L.boss });
    }

    // ---------- Шары ----------
    function mkBubble(o) {
      var b = { id: nextId++, x: o.x, y: o.y, r: BR, vx: o.vx || 0, vy: o.vy || 0, phase: o.phase || 'float', travel: 0, t: 0,
        kind: o.kind || 'plain', enemy: null, trapT: 0, owner: o.owner == null ? -1 : o.owner, letter: o.letter == null ? -1 : o.letter,
        life: o.kind === 'letter' ? LETTER_LIFE : o.kind && o.kind !== 'plain' ? SPECIAL_LIFE : EMPTY_LIFE };
      S.bubbles.push(b); return b;
    }
    function blow(i) {
      var p = S.players[i];
      if (!p || !p.alive || p.blowCd > 0 || S.phase === 'over') return false;
      p.blowCd = BLOW_CD; p.blowT = 0.18;
      var x = clamp(p.x + p.face * 0.9, WL + BR, WR - BR), y = p.y - PH / 2;
      var b = mkBubble({ x: x, y: y, vx: p.face * SHOOT_V, phase: 'shoot', owner: i });
      emit('blow', { player: i, x: x, y: y });
      capture(b);
      return true;
    }
    function trapTime() { return Math.max(TRAP_MIN, TRAP_T - (S.level - 1) * 0.12); }
    function capture(b) {
      if (b.phase !== 'shoot' || b.kind !== 'plain' || b.enemy) return;
      for (var k = 0; k < S.enemies.length; k++) {
        var e = S.enemies[k];
        if (e.spawnT > 0) continue;
        if (circleRect(b.x, b.y, b.r + 0.15, e)) {
          b.enemy = { type: e.type, angry: e.angry }; b.trapT = trapTime(); b.phase = 'float'; b.vx *= 0.2; b.life = 1e9;
          S.enemies.splice(k, 1);
          emit('trap', { x: b.x, y: b.y, type: e.type, owner: b.owner });
          return;
        }
      }
      for (k = S.shots.length - 1; k >= 0; k--) {
        var sh = S.shots[k];
        if (sh.kind === 'drop' && Math.abs(sh.x - b.x) < b.r + 0.3 && Math.abs(sh.y - b.y) < b.r + 0.3) { S.shots.splice(k, 1); emit('douse', { x: sh.x, y: sh.y }); }
      }
      var B = S.boss;
      if (B && B.alive && !B.trapped && B.spawnT <= 0 && circleRect(b.x, b.y, b.r, B)) { hitBoss(BOSS.bubbleDmg, b.x, b.y); removeBubble(b, true); }
    }
    function removeBubble(b, silent) { var k = S.bubbles.indexOf(b); if (k >= 0) S.bubbles.splice(k, 1); if (!silent) emit('fizz', { x: b.x, y: b.y }); }
    function itemFrom(x, y, rank, i) {
      var it = ITEMS[Math.min(ITEMS.length - 1, rank)];
      S.items.push({ id: nextId++, kind: it.kind, score: it.score, x: x, y: y, vx: (i % 2 ? 1 : -1) * (1.5 + (i * 0.7) % 3), vy: -14, w: 1, h: 1, ground: false, t: ITEM_LIFE, age: 0 });
    }
    // Лопнуть шар игроком: цепочка — все касающиеся шары (в фазе всплытия) лопаются следом
    function pop(b0, by) {
      var chain = [b0], seen = {}; seen[b0.id] = true;
      for (var h = 0; h < chain.length; h++) {
        var a = chain[h];
        for (var k = 0; k < S.bubbles.length; k++) {
          var c = S.bubbles[k];
          if (seen[c.id] || c.phase !== 'float') continue;
          var dx = c.x - a.x, dy = c.y - a.y;
          if (dx * dx + dy * dy < Math.pow((a.r + c.r) * 1.2, 2)) { seen[c.id] = true; chain.push(c); }
        }
      }
      var trapped = chain.filter(function (c) { return c.enemy; }).length, j = 0;
      chain.forEach(function (c, n) {
        var k = S.bubbles.indexOf(c); if (k >= 0) S.bubbles.splice(k, 1);
        if (c.enemy) {
          var pts = 1000 * Math.pow(2, Math.min(j, 5)); addScore(pts);
          itemFrom(c.x, c.y, Math.max(0, trapped - 1) + (c.enemy.angry ? 1 : 0), j);
          emit('pop', { x: c.x, y: c.y, type: c.enemy.type, score: pts, chain: trapped, n: j, player: by });
          j++; S.kills++;
        } else if (c.kind === 'letter') {
          S.letters[c.letter] = true; addScore(500);
          emit('letter', { x: c.x, y: c.y, letter: c.letter, player: by });
          if (S.letters.every(Boolean)) {
            S.letters = S.letters.map(function () { return false; }); addScore(WORD_BONUS);
            var p = S.players[by] || S.players[0];
            p.lives = Math.min(MAX_LIVES, p.lives + 1);
            emit('word', { player: p.i, x: c.x, y: c.y });
          }
        } else if (c.kind !== 'plain') {
          special(c, by); addScore(100);
        } else { addScore(10); emit('burst', { x: c.x, y: c.y, chain: n > 0 }); }
      });
      if (trapped > S.chainBest) S.chainBest = trapped;
      if (trapped >= 3) spawnLetter(b0.x);
      return chain.length;
    }
    function special(c, by) {
      var p = S.players[by] || S.players[0], face = p ? p.face : 1;
      if (c.kind === 'fire') S.effects.push({ id: nextId++, kind: 'fire', x: c.x, y: c.y, vx: 0, vy: 0, w: 0.8, h: 0.8, ground: false, t: 3.2, c0: 0, c1: 0, row: 0, kills: 0 });
      else if (c.kind === 'water') S.effects.push({ id: nextId++, kind: 'water', x: c.x, y: c.y, vx: face * 8, vy: 0, w: 0.9, h: 0.9, ground: false, t: 7, trail: [], trailT: 0, kills: 0 });
      else {
        // Гроза: молния по горизонтали в сторону взгляда; в логове Котла — прямо в Котёл
        var B = S.boss, vx = face * 24, vy = 0;
        if (B && B.alive && !B.trapped) { var ax = B.x - c.x, ay = (B.y - B.h / 2) - c.y, l = Math.sqrt(ax * ax + ay * ay) || 1; vx = ax / l * 24; vy = ay / l * 24; }
        S.effects.push({ id: nextId++, kind: 'bolt', x: c.x, y: c.y, x0: c.x, y0: c.y, vx: vx, vy: vy, t: 2, kills: 0, hitBoss: false });
      }
      emit('special', { kind: c.kind, x: c.x, y: c.y, player: by });
    }
    function killEnemy(e, fx) {
      var k = S.enemies.indexOf(e); if (k < 0) return;
      S.enemies.splice(k, 1); S.kills++;
      addScore(1000 * Math.pow(2, Math.min(fx.kills, 4)));
      itemFrom(e.x, e.y - 1, fx.kills + 1, fx.kills);
      fx.kills++;
      emit('zap', { x: e.x, y: e.y - EH / 2, type: e.type, kind: fx.kind });
    }
    function spawnLetter(x) {
      if (S.boss || S.bubbles.some(function (b) { return b.kind === 'letter'; })) return;
      var free = []; S.letters.forEach(function (v, i) { if (!v) free.push(i); });
      if (!free.length) return;
      var gx = clamp(x == null ? GAP0 + 2 : x, WL + 1, WR - 1);
      mkBubble({ x: gx, y: ROWS - 0.5, kind: 'letter', letter: free[Math.floor(rng() * free.length)], vy: -RISE });
      emit('spawnLetter', {});
    }
    function spawnSpecial() {
      var list = S.specials || []; if (!list.length) return;
      var k = S.boss ? 'bolt' : list[Math.floor(rng() * list.length)];
      mkBubble({ x: GAP0 + 0.5 + rng() * 3, y: ROWS + 0.3, kind: k, vy: -RISE });
    }
    function hitBoss(dmg, x, y) {
      var B = S.boss; if (!B || !B.alive || B.trapped || B.inv > 0) return;
      B.hp = Math.max(0, B.hp - dmg); B.flash = 0.25; B.inv = dmg > 1 ? 0.5 : 0.08;
      addScore(dmg * 100);
      emit('bossHit', { x: x, y: y, hp: B.hp });
      if (B.hp <= 0) { B.trapped = true; B.vx = 0; B.vy = -1.2; S.shots = []; emit('bossTrap', { x: B.x, y: B.y - B.h / 2 }); }
    }

    // ---------- Игроки ----------
    function die(p, why) {
      if (!p.alive || p.inv > 0 || S.phase !== 'play') return;
      p.alive = false; p.lives--; p.deadT = RESPAWN_T; p.vx = 0; p.vy = -10;
      emit('die', { player: p.i, x: p.x, y: p.y - PH / 2, lives: p.lives, why: why });
      if (p.lives <= 0) p.out = true;
      if (S.players.every(function (q) { return q.out; })) { S.phase = 'over'; S.over = true; S.phaseT = 0; emit('gameover', { score: S.score }); }
    }
    function updatePlayer(p, dt) {
      if (p.out && !p.alive && p.deadT <= 0) return;
      if (!p.alive) {
        p.deadT -= dt; p.vy = Math.min(VMAX, p.vy + G * 0.5 * dt); p.y += p.vy * dt * 0.5;
        if (p.deadT <= 0 && !p.out) {
          var sp = SPAWNS[p.i]; p.x = sp.x; p.y = sp.y; p.vx = 0; p.vy = 0; p.alive = true; p.inv = INV_T;
          emit('respawn', { player: p.i });
        }
        return;
      }
      if (p.inv > 0) p.inv -= dt;
      if (p.blowCd > 0) p.blowCd -= dt;
      if (p.blowT > 0) p.blowT -= dt;
      if (p.bounceT > 0) p.bounceT -= dt;
      if (p.jumpHeld && !p.prevJump) p.jumpBuf = 0.12;
      p.prevJump = p.jumpHeld;
      if (p.jumpBuf > 0) p.jumpBuf -= dt;
      if (p.ground) p.coyote = 0.08; else if (p.coyote > 0) p.coyote -= dt;
      p.vx = p.dir * RUN;
      if (p.dir) p.face = p.dir;
      if (p.jumpBuf > 0 && p.coyote > 0) { p.vy = -JUMP_V; p.jumpBuf = 0; p.coyote = 0; p.ground = false; emit('jump', { player: p.i }); }
      moveBody(S.grid, p, dt);
      p.walk = p.ground && p.dir ? p.walk + dt : 0;
    }
    function playerBubbles(p) {
      for (var k = S.bubbles.length - 1; k >= 0; k--) {
        var b = S.bubbles[k]; if (!b || b.phase !== 'float' || (b.owner === p.i && b.t < 0.3)) continue;   // свой свежий шар не лопается сразу
        if (!circleRect(b.x, b.y, b.r * 0.95, p)) continue;
        if (p.bounceT > 0 && p.bounceId === b.id) continue;
        var fromAbove = p.vy >= 0 && p.y <= b.y - b.r * 0.3;
        if (fromAbove && p.jumpHeld) {
          p.vy = -JUMP_V * 0.92; p.ground = false; p.bounceId = b.id; p.bounceT = 0.25; b.vy += 1.5;
          emit('bounce', { player: p.i, x: b.x, y: b.y });
          continue;
        }
        pop(b, p.i);
      }
    }

    // ---------- Враги ----------
    function nearestPlayer(e) {
      var best = null, bd = 1e9;
      S.players.forEach(function (p) { if (!p.alive) return; var d = Math.abs(p.x - e.x) + Math.abs(p.y - e.y) * 1.5; if (d < bd) { bd = d; best = p; } });
      return best;
    }
    function updateEnemy(e, dt) {
      if (e.spawnT > 0) { e.spawnT -= dt; return; }
      var sp = e.speed * (e.angry ? ANGRY_K : 1), tgt = nearestPlayer(e);
      e.think -= dt;
      if (e.fly) {
        e.vx = e.dir * sp; e.vy = e.vdir * sp * 0.7;
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.x < WL + e.w / 2) { e.x = WL + e.w / 2; e.dir = 1; } else if (e.x > WR - e.w / 2) { e.x = WR - e.w / 2; e.dir = -1; }
        if (e.y - e.h < 1.2) { e.y = 1.2 + e.h; e.vdir = 1; } else if (e.y > ROWS - 1) { e.y = ROWS - 1; e.vdir = -1; }
        if (e.think <= 0) { e.think = 1 + rng() * 1.2; if (tgt && rng() < (e.angry ? 0.6 : 0.35)) { e.dir = tgt.x < e.x ? -1 : 1; e.vdir = tgt.y - 0.8 < e.y ? -1 : 1; } }
        return;
      }
      if (e.ground) {
        if (e.think <= 0) {
          e.think = 0.7 + rng() * 0.7;
          if (tgt) {
            var dy = tgt.y - e.y, adx = Math.abs(tgt.x - e.x);
            if (Math.abs(dy) < 1 && adx < 9 && rng() < (e.angry ? 0.8 : 0.45)) e.dir = tgt.x < e.x ? -1 : 1;
            // запрыгнуть на уровень героя — не прямо под ним (сбоку виднее)
            if (dy < -2.5 && adx > 1.2 && adx < 6 && S.levelT > 4 && rng() < (e.angry ? 0.5 : 0.22) && e.type !== 'spring') { e.vy = -JUMP_V; e.ground = false; }
          }
        }
        if (e.type === 'spring') {
          e.hopT -= dt;
          if (e.hopT <= 0) { e.hopT = 0.9 + rng() * 0.6; e.vy = -JUMP_V * (0.75 + rng() * 0.25); e.ground = false; if (tgt && rng() < 0.5) e.dir = tgt.x < e.x ? -1 : 1; }
        }
        // край платформы: развернуться или шагнуть вниз (решение раз на край)
        if (e.ground && !solidUnder(S.grid, e.x + e.dir * (e.w / 2 + 0.05), 0.2, Math.round(e.y))) {
          if (e.edgeT <= 0) { e.edgeT = 0.5; if (rng() < 0.5) e.dir = -e.dir; }
        }
        if (e.edgeT > 0) e.edgeT -= dt;
      }
      e.vx = e.charge > 0 ? 0 : e.dir * sp * (e.ground ? 1 : 0.8);
      moveBody(S.grid, e, dt);
      if (e.wall) e.dir = -e.wall;
      // искрун мечет искры по горизонтали
      // искрун мечет искры по горизонтали — с замахом 0,45 с (видно и слышно заранее)
      if (e.type === 'spark') {
        e.shotCd -= dt;
        if (e.charge > 0) {
          e.charge -= dt;
          if (e.charge <= 0) { S.shots.push({ x: e.x + e.dir * 0.8, y: e.y - EH / 2, vx: e.dir * 6.5, vy: 0, t: 3, kind: 'spark' }); emit('shoot', { x: e.x, y: e.y }); }
        } else if (e.shotCd <= 0 && tgt && e.ground && Math.abs(tgt.y - e.y) < 0.8 && (tgt.x - e.x) * e.dir > 0 && Math.abs(tgt.x - e.x) < 9) {
          e.shotCd = e.angry ? 2.2 : 3.2; e.charge = 0.45; emit('charge', { x: e.x, y: e.y });
        }
      }
    }

    // ---------- Боссы: Котёл ----------
    function updateBoss(B, dt) {
      if (B.spawnT > 0) { B.spawnT -= dt; return; }
      if (B.flash > 0) B.flash -= dt;
      if (B.inv > 0) B.inv -= dt;
      if (B.trapped) {
        B.y = Math.max(B.h + 1.5, B.y + B.vy * dt); B.bubbleY += dt;
        return;
      }
      var k = 1 + (1 - B.hp / B.max) * 0.6;
      B.x += B.vx * k * dt; B.y += B.vy * k * dt;
      if (B.x < WL + B.w / 2) { B.x = WL + B.w / 2; B.vx = Math.abs(B.vx); } else if (B.x > WR - B.w / 2) { B.x = WR - B.w / 2; B.vx = -Math.abs(B.vx); }
      if (B.y - B.h < 1.2) { B.y = 1.2 + B.h; B.vy = Math.abs(B.vy); } else if (B.y > ROWS - 1.5) { B.y = ROWS - 1.5; B.vy = -Math.abs(B.vy); }
      B.spitT -= dt;
      if (B.spitT <= 0) {
        B.spitT = BOSS.spitT / k;
        var n = B.hp < B.max / 2 ? 5 : 3, tgt = nearestPlayer(B), base = tgt ? Math.atan2(tgt.y - 0.8 - (B.y - B.h / 2), tgt.x - B.x) : Math.PI / 2;
        for (var i = 0; i < n; i++) {
          var a = base + (i - (n - 1) / 2) * 0.38;
          S.shots.push({ x: B.x, y: B.y - B.h / 2, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, t: 5, kind: 'drop' });
        }
        emit('spit', { x: B.x, y: B.y - B.h / 2 });
      }
    }

    // ---------- Эффекты спецшаров ----------
    function updateEffects(dt) {
      for (var k = S.effects.length - 1; k >= 0; k--) {
        var f = S.effects[k]; f.t -= dt;
        if (f.kind === 'fire') {
          if (!f.landed) {
            moveBody(S.grid, f, dt);
            if (f.ground) { f.landed = true; f.row = Math.round(f.y); f.c0 = f.c1 = Math.floor(f.x); f.spread = 0; emit('burn', { x: f.x, y: f.y }); }
          } else {
            f.spread += dt;
            var w = Math.min(4, Math.floor(f.spread * 8)), cx = Math.floor(f.x);
            var a = cx, b = cx;
            while (a > cx - w && S.grid[idx(a - 1, f.row)] && a - 1 >= WL) a--;
            while (b < cx + w && S.grid[idx(b + 1, f.row)] && b + 1 < WR) b++;
            f.c0 = a; f.c1 = b;
            var zone = { x: (a + b + 1) / 2, y: f.row, w: b - a + 1, h: 1.6 };
            S.enemies.slice().forEach(function (e) { if (e.spawnT <= 0 && overlapRect(zone, e)) killEnemy(e, f); });
          }
        } else if (f.kind === 'water') {
          var vx = f.vx; moveBody(S.grid, f, dt);
          if (f.wall) f.vx = -vx;
          f.trailT -= dt;
          if (f.trailT <= 0) { f.trailT = 0.04; f.trail.unshift({ x: f.x, y: f.y }); if (f.trail.length > 12) f.trail.pop(); }
          if (f.wrapped) f.t = 0;   // утекает в проём
          var pts = [{ x: f.x, y: f.y }].concat(f.trail);
          S.enemies.slice().forEach(function (e) {
            if (e.spawnT > 0) return;
            for (var i = 0; i < pts.length; i += 2) if (Math.abs(pts[i].x - e.x) < 1.1 && Math.abs(pts[i].y - e.y) < 1.4) { killEnemy(e, f); break; }
          });
        } else if (f.kind === 'bolt') {
          f.x += f.vx * dt; f.y += (f.vy || 0) * dt;
          if (f.y < 0.5 || f.y > ROWS) f.t = 0;
          S.enemies.slice().forEach(function (e) { if (e.spawnT <= 0 && Math.abs(e.x - f.x) < 1 && Math.abs(e.y - EH / 2 - f.y) < 1.3) killEnemy(e, f); });
          var B = S.boss;
          if (B && B.alive && !B.trapped && !f.hitBoss && Math.abs(B.x - f.x) < B.w / 2 + 0.3 && f.y > B.y - B.h - 0.5 && f.y < B.y + 0.5) { f.hitBoss = true; f.t = Math.min(f.t, 0.15); f.vx = f.vy = 0; B.inv = 0; hitBoss(BOSS.boltDmg, f.x, f.y); }
          if (f.x < WL || f.x > WR) f.t = 0;
        }
        if (f.t <= 0) S.effects.splice(k, 1);
      }
    }

    // ---------- Шаг ----------
    function updateBubbles(dt) {
      var W = S.wind;
      for (var k = S.bubbles.length - 1; k >= 0; k--) {
        var b = S.bubbles[k]; b.t += dt;
        if (b.phase === 'shoot') {
          var d = b.vx * dt; b.x += d; b.travel += Math.abs(d);
          if (b.x < WL + b.r) { b.x = WL + b.r; b.phase = 'float'; }
          else if (b.x > WR - b.r) { b.x = WR - b.r; b.phase = 'float'; }
          else if (b.travel >= RANGE) b.phase = 'float';
          capture(b);
          if (S.bubbles.indexOf(b) < 0) continue;
          if (b.phase === 'float') b.vx *= 0.3;
          continue;
        }
        // всплытие по потокам
        var tx = 0, ty = -RISE;
        if (b.y <= CEIL_Y + 0.15) { ty = 0; tx = clamp((W.gather - b.x) * 0.9, -DRIFT, DRIFT); }
        for (var z = 0; z < W.zones.length; z++) {
          var Q = W.zones[z];
          if (b.x >= Q.x0 && b.x < Q.x1 && b.y >= Q.y0 && b.y < Q.y1) { tx = Q.vx; ty = b.y <= CEIL_Y + 0.15 ? 0 : Q.vy; }
        }
        var a = Math.min(1, dt * 3);
        b.vx += (tx - b.vx) * a; b.vy += (ty - b.vy) * a;
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.x = clamp(b.x, WL + b.r, WR - b.r);
        if (b.y < CEIL_Y) { b.y = CEIL_Y; if (b.vy < 0) b.vy = 0; }
        if (b.y > ROWS - b.r && b.kind === 'plain') b.y = ROWS - b.r;
        // расталкивание
        for (var j = 0; j < k; j++) {
          var c = S.bubbles[j]; if (c.phase !== 'float') continue;
          var dx = c.x - b.x, dy = c.y - b.y, dd = Math.sqrt(dx * dx + dy * dy) || 0.01, m = b.r + c.r;
          if (dd < m * 0.98) { var push = (m * 0.98 - dd) * 0.5, ux = dx / dd, uy = dy / dd; b.x -= ux * push; b.y -= uy * push; c.x += ux * push; c.y += uy * push; }
        }
        if (b.enemy) {
          b.trapT -= dt * (S.angryAll ? 1.5 : 1);
          if (b.trapT <= 0) {
            S.bubbles.splice(k, 1);
            var e = mkEnemy(b.enemy.type, b.x, b.y + EH / 2); e.spawnT = 0; e.angry = true; e.vy = -6;
            S.enemies.push(e);
            emit('escape', { x: b.x, y: b.y, type: e.type });
          }
        } else {
          b.life -= dt;
          if (b.life <= 0) removeBubble(b);
        }
      }
    }
    function updateItems(dt) {
      for (var k = S.items.length - 1; k >= 0; k--) {
        var it = S.items[k]; it.t -= dt; it.age += dt;
        if (!it.ground) it.vx *= 0.995; else it.vx = 0;
        moveBody(S.grid, it, dt);
        if (it.wall) it.vx = -it.vx * 0.5;
        var got = null;
        for (var i = 0; i < S.players.length && it.age > 0.35; i++) { var p = S.players[i]; if (p.alive && overlapRect(p, it)) { got = p; break; } }
        if (got) { S.items.splice(k, 1); addScore(it.score); emit('item', { x: it.x, y: it.y - 0.5, kind: it.kind, score: it.score, player: got.i }); continue; }
        if (it.t <= 0) S.items.splice(k, 1);
      }
    }
    function updateShots(dt) {
      for (var k = S.shots.length - 1; k >= 0; k--) {
        var s = S.shots[k]; s.t -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.kind === 'drop') s.vy += 4 * dt;
        if (s.x < WL || s.x > WR || s.y > ROWS || s.y < 0.5 || s.t <= 0) { S.shots.splice(k, 1); continue; }
        for (var i = 0; i < S.players.length; i++) {
          var p = S.players[i];
          if (p.alive && p.inv <= 0 && Math.abs(p.x - s.x) < p.w / 2 + 0.2 && s.y > p.y - p.h && s.y < p.y) { die(p, s.kind); S.shots.splice(k, 1); break; }
        }
      }
    }

    function update(dt) {
      S.time += dt;
      if (S.over) return;
      if (S.phase === 'ready') {
        S.phaseT -= dt;
        S.players.forEach(function (p) { if (p.alive) { p.vx = 0; moveBody(S.grid, p, dt); } });
        if (S.phaseT <= 0) { S.phase = 'play'; S.phaseT = 0; }
        return;
      }
      if (S.phase === 'clear') {
        S.phaseT -= dt;
        S.players.forEach(function (p) { updatePlayer(p, dt); });
        updateItems(dt); updateEffects(dt);
        if (S.phaseT <= 0) {
          if (S.level >= S.maxLevel) { S.phase = 'over'; S.over = true; S.won = true; emit('win', { score: S.score }); }
          else { S.level++; loadLevel(S.level); }
        }
        return;
      }
      S.levelT += dt;
      if (!S.boss && !S.hurry && S.levelT >= HURRY_T) { S.hurry = true; emit('hurry', {}); }
      if (!S.boss && !S.angryAll && S.levelT >= ANGRY_T) { S.angryAll = true; S.enemies.forEach(function (e) { e.angry = true; }); emit('angry', {}); }
      if (S.angryAll) S.enemies.forEach(function (e) { e.angry = true; });

      S.players.forEach(function (p) { updatePlayer(p, dt); });
      S.enemies.forEach(function (e) { updateEnemy(e, dt); });
      if (S.boss) updateBoss(S.boss, dt);
      updateBubbles(dt);
      S.players.forEach(function (p) { if (p.alive) playerBubbles(p); });
      updateEffects(dt); updateItems(dt); updateShots(dt);

      // спецшары и буквы приходят из проёма
      S.specialT -= dt;
      if (S.specialT <= 0) { S.specialT = S.boss ? 3.2 : 9 + rng() * 6; if (S.bubbles.filter(function (b) { return b.kind !== 'plain' && b.kind !== 'letter'; }).length < (S.boss ? 3 : 2)) spawnSpecial(); }
      S.letterT -= dt;
      if (S.letterT <= 0) { S.letterT = 12 + rng() * 8; spawnLetter(); }

      // касания
      S.players.forEach(function (p) {
        if (!p.alive || p.inv > 0) return;
        for (var k = 0; k < S.enemies.length; k++) {
          var e = S.enemies[k];
          if (e.spawnT <= 0 && Math.abs(e.x - p.x) < (e.w + p.w) / 2 - 0.45 && e.y - e.h + 0.35 < p.y && p.y - p.h + 0.35 < e.y) { die(p, 'enemy'); return; }
        }
        var B = S.boss;
        if (B && B.alive && B.spawnT <= 0) {
          if (B.trapped) {
            if (circleRect(B.x, B.y - B.h / 2, B.w * 0.75, p)) {
              B.alive = false; addScore(50000);
              for (var i = 0; i < 6; i++) itemFrom(B.x, B.y - B.h / 2, 5, i);
              emit('bossDie', { x: B.x, y: B.y - B.h / 2, player: p.i });
            }
          } else if (Math.abs(B.x - p.x) < (B.w + p.w) / 2 - 0.5 && B.y - B.h + 0.4 < p.y && p.y - p.h + 0.4 < B.y) die(p, 'boss');
        }
      });

      // уровень пройден: врагов нет ни снаружи, ни в шарах; босс (если есть) лопнут
      if (S.phase === 'play' && !S.enemies.length && !S.bubbles.some(function (b) { return b.enemy; }) && !(S.boss && S.boss.alive)) {
        S.phase = 'clear'; S.phaseT = S.boss ? CLEAR_T + 1 : CLEAR_T; S.shots = [];
        S.bubbles = S.bubbles.filter(function (b) { return b.kind === 'letter'; });
        emit('clear', { level: S.level });
      }
    }

    var api = {
      start: function () { loadLevel(S.level); return api; },
      update: update,
      setInput: function (i, dx, jumpHeld) { var p = S.players[i]; if (p) { p.dir = dx < 0 ? -1 : dx > 0 ? 1 : 0; p.jumpHeld = !!jumpHeld; } },
      blow: blow,
      // второй игрок входит «на лету»: если его нет — появляется; если выбыл — возвращается с полным запасом жизней
      join: function (i) {
        i = i || 1;
        if (S.over) return false;
        var p = S.players[i];
        if (!p) { while (S.players.length < i) S.players.push(mkPlayer(S.players.length, LIVES)); p = mkPlayer(i, LIVES); S.players[i] = p; emit('join', { player: i }); return true; }
        if (p.out) { p.out = false; p.lives = LIVES; p.alive = true; p.deadT = 0; var sp = SPAWNS[i]; p.x = sp.x; p.y = sp.y; p.vx = p.vy = 0; p.inv = INV_T; emit('join', { player: i }); return true; }
        return false;
      },
      state: function () { return S; },
      _S: S, _mkEnemy: mkEnemy, _mkBubble: mkBubble, _pop: pop, _load: loadLevel, _spawnSpecial: spawnSpecial, _spawnLetter: spawnLetter
    };
    return api;
  }

  Z.logic = {
    COLS: COLS, ROWS: ROWS, WL: WL, WR: WR, GAP0: GAP0, GAP1: GAP1, G: G, VMAX: VMAX, RUN: RUN, JUMP_V: JUMP_V, JUMP_UP: JUMP_UP,
    PW: PW, PH: PH, EW: EW, EH: EH, BR: BR, SHOOT_V: SHOOT_V, RANGE: RANGE, BLOW_CD: BLOW_CD, RISE: RISE, CEIL_Y: CEIL_Y,
    EMPTY_LIFE: EMPTY_LIFE, TRAP_T: TRAP_T, TRAP_MIN: TRAP_MIN, ANGRY_K: ANGRY_K, HURRY_T: HURRY_T, ANGRY_T: ANGRY_T,
    LIVES: LIVES, EXTRA_LIFE: EXTRA_LIFE, WORD_LEN: WORD_LEN, WORD_BONUS: WORD_BONUS, SPAWNS: SPAWNS, ITEMS: ITEMS, ENEMY: ENEMY,
    SPECIALS: SPECIALS, BOSS: BOSS, BIND: BIND, HAND: HAND, ZONES: ZONES, LEVELS: 30,
    idx: idx, inGap: inGap, level: level, windOf: windOf, emptyGrid: emptyGrid, gridFromRows: gridFromRows, segments: segments,
    segAt: segAt, landing: landing, drive: drive, simEdge: simEdge, buildGraph: buildGraph, reach: reach, route: route, validate: validate, moveBody: moveBody,
    solidUnder: solidUnder, circleRect: circleRect, overlapRect: overlapRect, mulberry32: mulberry32
  };
  Z.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
