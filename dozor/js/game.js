/* ДОЗОР · логика (без DOM, детерминирована при заданном rng). DOZOR.Game(opts), DOZOR.logic
   Вертикально скроллящийся экшен с видом сверху на 1–2 игроков: дозорные броневики мастерской «Гефест»
   освобождают пленных мастеровых с заводов механической Ржавой артели. Машина едет в 8 сторон, пулемёт
   бьёт всегда вверх (по курсу экрана), второе оружие — по направлению машины и перелетает стены:
   гранаты → ракеты → самонаводящиеся ракеты (ступень растёт, когда подобран мастер из меченого барака).
   Пленные: взорви барак, подбери (до 8 на борту), отвези на вертолётную площадку. Гибель — пленные разбегаются.
   Координаты мира: x, y — центр объекта; y растёт вниз; карта — ASCII-строки по COLS символов (parseMap).
   Камера — только вверх (camY уменьшается). */
(function (global) {
  'use strict';
  var D = global.DOZOR = global.DOZOR || {};

  // ---------- Константы ----------
  var T = 24, COLS = 20, VIEW_W = COLS * T, HUD = 40, VIEW_H = 600, SCREEN_H = HUD + VIEW_H;
  var SPEED = 108, HB = 10, HIT_R = 8, CAPACITY = 8, LIVES = 3, CONTINUES = 2, CONT_T = 10;
  var INV_SPAWN = 2.6, RESPAWN_T = 1.6, EXTRA_LIFE = 27000, MAX_TIER = 3;
  var MG = { cd: 0.11, speed: 430, dmg: 1 };
  var SEC = {   // второе оружие по ступеням: летит по направлению машины, над стенами
    1: { name: 'grenade', cd: 0.34, speed: 230, range: 132, r: 30, dmg: 3, max: 2, air: false },
    2: { name: 'rocket', cd: 0.28, speed: 340, range: 230, r: 34, dmg: 4, max: 3, air: true },
    3: { name: 'homing', cd: 0.26, speed: 310, range: 300, r: 38, dmg: 5, max: 3, air: true, turn: 5 }
  };
  var ENEMIES = {
    infantry: { r: 7, hp: 1, speed: 30, cd: 3.8, bullet: 100, score: 100, near: 64 },
    turret:   { r: 11, hp: 5, cd: 2.4, bullet: 128, score: 300, solid: true, burst: 2 },
    tank:     { r: 14, hp: 9, speed: 22, cd: 3.0, bullet: 104, score: 800, solid: true, shell: true },
    boat:     { r: 13, hp: 5, speed: 42, cd: 2.6, bullet: 118, score: 500 },
    heli:     { r: 14, hp: 7, cd: 2.2, bullet: 132, score: 1000, air: true, burst: 3 },
    cannon:   { r: 11, hp: 8, cd: 2.6, bullet: 124, score: 1500, solid: true }
  };
  var CAR = { w: 70, h: 22, gap: 8, hp: 8, speed: 118, cd: 2.6, bullet: 120, score: 600 };
  var BARRACKS_HP = 6, CORE_W = 6, CORE_H = 3;
  var SCORE = { pickup: 100, deliver: 1000, barracks: 500, block: 20, stage: 3000 };
  var BOSS_HP = 46, BOSS_HP_STEP = 12;
  var PATTERN_CD = { spread: 1.9, ring: 2.6, mortar: 2.8, spawn: 4.6, sweep: 3.0 };

  // Клетки поля
  var G = 0, WALL = 1, WATER = 2, BRIDGE = 3, BLD = 4, TREE = 5, ROCK = 6, RAIL = 7, SAND = 8, RUBBLE = 9, BARR = 10, CORE = 11, ROAD = 12, PADC = 13;
  var CH = { '.': G, '#': WALL, '~': WATER, '=': BRIDGE, 'X': BLD, 't': TREE, 'o': ROCK, 'r': RAIL, 's': SAND, ':': ROAD };
  var TILE_HP = {}; TILE_HP[BLD] = 5; TILE_HP[TREE] = 2; TILE_HP[SAND] = 3;
  function solidV(t) { return t === WALL || t === WATER || t === BLD || t === TREE || t === ROCK || t === SAND || t === BARR || t === CORE; }
  function blockB(t) { return t === WALL || t === BLD || t === TREE || t === ROCK || t === SAND || t === BARR || t === CORE; }
  function breakable(t) { return t === BLD || t === TREE || t === SAND; }

  // Раскладка кооп-клавиатуры (И1 — стрелки, И2 — WASD); в одиночку работают обе
  var BIND = {
    p1: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
      fire: ['Space', 'Slash', 'ControlRight', 'Numpad0'], sec: ['Period', 'Comma', 'ShiftRight', 'NumpadDecimal'] },
    p2: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
      fire: ['KeyF', 'KeyX'], sec: ['KeyG', 'KeyC'] }
  };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function circRect(cx, cy, r, x0, y0, x1, y1) { var nx = clamp(cx, x0, x1), ny = clamp(cy, y0, y1); return dist(cx, cy, nx, ny) <= r; }

  // ---------- Этапы: генератор из кусков ----------
  var STAGES = [
    { name: 'sand', boss: 'bolt', pats: ['spread', 'spawn'], cannons: [5, 14], segs: ['field', 'barracksF', 'pad', 'field', 'fence', 'barracks', 'field', 'pad', 'tanks1'] },
    { name: 'wharf', boss: 'smelter', pats: ['spread', 'mortar'], cannons: [4, 15], segs: ['field', 'river', 'barracksF', 'pad', 'fence', 'field', 'river', 'barracks', 'tanks', 'pad'] },
    { name: 'rail', boss: 'boiler', pats: ['ring', 'spawn', 'spread'], cannons: [3, 9, 16], segs: ['field', 'rail', 'barracksF', 'pad', 'tanks', 'field', 'rail', 'town', 'barracks', 'pad'] },
    { name: 'slag', boss: 'lock', pats: ['sweep', 'mortar', 'spread'], cannons: [3, 9, 16], segs: ['fieldH', 'river', 'barracksF', 'pad', 'tanks', 'fence', 'rail', 'barracks', 'fieldH', 'pad'] },
    { name: 'quarter', boss: 'forge', pats: ['ring', 'mortar', 'spawn', 'spread'], cannons: [2, 6, 13, 17], segs: ['town', 'barracksF', 'pad', 'rail', 'river', 'tanks', 'townH', 'barracks', 'pad', 'fence'] },
    { name: 'hold', boss: 'works', pats: ['sweep', 'ring', 'mortar', 'spawn'], cannons: [2, 6, 13, 17], segs: ['fieldH', 'fence', 'barracksF', 'pad', 'rail', 'river', 'tanks', 'townH', 'rail', 'barracks', 'pad', 'tanks'] }
  ];

  function blank(h, edge) { var a = []; for (var i = 0; i < h; i++) { var r = []; for (var c = 0; c < COLS; c++) r.push(c === 0 || c === COLS - 1 ? (edge || 'o') : '.'); a.push(r); } return a; }
  function put(a, c, r, ch) { if (r >= 0 && r < a.length && c >= 0 && c < COLS) a[r][c] = ch; }
  function at(a, c, r) { return r >= 0 && r < a.length && c >= 0 && c < COLS ? a[r][c] : 'o'; }
  function free(a, c, r) { return at(a, c, r) === '.' || at(a, c, r) === ':'; }
  function ri(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
  function scatter(a, rng, ch, n, r0, r1, c0, c1) {
    for (var k = 0, tries = 0; k < n && tries < 200; tries++) {
      var c = ri(rng, c0 == null ? 2 : c0, c1 == null ? COLS - 3 : c1), r = ri(rng, r0, r1);
      if (free(a, c, r)) { put(a, c, r, ch); k++; }
    }
  }
  function clump(a, rng, ch, r0, r1, maxW) {   // группа препятствий ≤ maxW клеток в ширину
    var w = ri(rng, 1, maxW || 3), h = ri(rng, 1, 2), c = ri(rng, 2, COLS - 2 - w), r = ri(rng, r0, Math.max(r0, r1 - h + 1));
    for (var y = r; y < r + h; y++) for (var x = c; x < c + w; x++) if (free(a, x, y)) put(a, x, y, ch);
  }
  function box(a, c, r, w, h, tl, rest) { for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) put(a, c + x, r + y, x === 0 && y === 0 ? tl : rest); }
  var SEG = {
    start: function () { var a = blank(6); for (var r = 0; r < 6; r++) { put(a, 9, r, ':'); put(a, 10, r, ':'); } put(a, 9, 3, 'S'); return a; },
    field: function (rng, n, heli) {
      var a = blank(13, rng() < 0.5 ? 't' : 'o');
      for (var k = 0; k < 4; k++) clump(a, rng, rng() < 0.6 ? 't' : 'o', 1 + k * 3, 2 + k * 3, 3);
      scatter(a, rng, 'i', 2 + Math.min(4, n), 1, 10);
      if (n >= 2) scatter(a, rng, 'u', 1, 1, 4);
      if (heli) put(a, 10, 6, 'g');
      return a;
    },
    fence: function (rng, n) {
      var a = blank(9);
      for (var c = 1; c < COLS - 1; c++) put(a, c, 4, '#');
      var g1 = ri(rng, 2, 6), g2 = ri(rng, 11, 15);
      for (var k = 0; k < 3; k++) { put(a, g1 + k, 4, '.'); put(a, g2 + k, 4, rng() < 0.5 ? 's' : '.'); }
      put(a, g1 - 1, 2, 'u'); put(a, g2 + 3, 2, 'u');
      if (n >= 3) put(a, g1 + 1, 1, 'u');
      scatter(a, rng, 'i', 2 + (n >> 1), 0, 3); scatter(a, rng, 's', 3, 6, 7);
      return a;
    },
    river: function (rng, n) {
      var a = blank(10);
      for (var r = 3; r <= 6; r++) for (var c = 0; c < COLS; c++) put(a, c, r, '~');
      var b1 = ri(rng, 2, 7), b2 = ri(rng, 11, 15), two = n <= 4 || rng() < 0.5;
      for (var r2 = 3; r2 <= 6; r2++) for (var k = 0; k < 3; k++) { put(a, b1 + k, r2, '='); if (two) put(a, b2 + k, r2, '='); }
      put(a, ri(rng, 3, 16), 4, 'b'); if (n >= 3) put(a, ri(rng, 3, 16), 6, 'b');
      if (at(a, b1 + 1, 1) === '.') put(a, b1 + 4, 1, 'u');
      scatter(a, rng, 'i', 2, 0, 1); scatter(a, rng, 't', 3, 8, 9);
      return a;
    },
    barracks: function (rng, n, flag) {
      var a = blank(11, 't'), c1 = ri(rng, 2, 7), c2 = ri(rng, 11, 15);
      box(a, c1, 3, 2, 2, flag ? 'F' : 'H', 'h');
      if (!flag || n >= 2) box(a, c2, 4, 2, 2, 'H', 'h');
      for (var k = -1; k <= 2; k++) if (rng() < 0.6) put(a, c1 + k, 6, 's');
      scatter(a, rng, 'i', 2 + Math.min(3, n), 0, 9);
      if (n >= 2) scatter(a, rng, 'u', 1, 0, 2);
      scatter(a, rng, 't', 2, 8, 10);
      return a;
    },
    pad: function (rng) { var a = blank(8, 't'); box(a, 8, 2, 3, 3, 'P', 'p'); scatter(a, rng, 't', 4, 1, 6, 2, 6); scatter(a, rng, 't', 3, 1, 6, 13, 17); return a; },
    rail: function (rng, n) {
      var a = blank(8);
      for (var c = 0; c < COLS; c++) put(a, c, 3, 'r');
      scatter(a, rng, 's', 4, 1, 1); scatter(a, rng, 's', 3, 5, 6);
      scatter(a, rng, 'i', 1 + (n >> 1), 0, 1);
      return a;
    },
    tanks: function (rng, n, one) {
      var a = blank(13, 'o');
      clump(a, rng, 'o', 5, 6, 2); clump(a, rng, 'o', 9, 10, 2);
      scatter(a, rng, 'k', one ? 1 : 1 + (n >= 4 ? 1 : 0), 1, 3, 4, 15);
      scatter(a, rng, 'i', 2 + (n >> 1), 2, 11);
      if (n >= 3) scatter(a, rng, 'u', 1, 0, 2);
      return a;
    },
    town: function (rng, n, heli) {
      var a = blank(13, 'X');
      var cols = [[2, 2], [6, 3], [11, 2], [15, 3]], shift = rng() < 0.5 ? 0 : 1;
      for (var row = 0; row < 2; row++) cols.forEach(function (cw, i) {
        if ((i + row + shift) % 2 === 0 || rng() < 0.3) { var r0 = 2 + row * 5; box(a, cw[0], r0, cw[1], 2, 'X', 'X'); }
      });
      for (var c = 1; c < COLS - 1; c++) { if (free(a, c, 5)) put(a, c, 5, ':'); if (free(a, c, 10)) put(a, c, 10, ':'); }
      scatter(a, rng, 'i', 3 + (n >> 1), 0, 11); scatter(a, rng, 'u', 1, 4, 6);
      if (heli) put(a, 10, 7, 'g');
      return a;
    },
    boss: function (rng, n, M) {
      var a = blank(15, 'o'), c, r;
      for (c = 0; c < COLS; c++) { put(a, c, 0, 'o'); put(a, c, 1, '#'); put(a, c, 5, '#'); }
      for (r = 2; r <= 4; r++) for (c = 1; c < COLS - 1; c++) put(a, c, r, '#');
      box(a, 7, 2, CORE_W, CORE_H, 'C', 'c');
      M.cannons.forEach(function (cc) { put(a, cc, 5, 'n'); });
      for (c = 1; c < COLS - 1; c++) if (c < 7 || c > 12) put(a, c, 13, '#');
      put(a, 3, 13, '.'); put(a, 4, 13, '.'); put(a, 15, 13, '.'); put(a, 16, 13, '.');
      scatter(a, rng, 's', 3 + (n >> 1), 9, 11, 2, 17);
      return a;
    }
  };
  function genStage(n) {
    var M = STAGES[n - 1], rng = mulberry32(n * 977 + 13), parts = [SEG.start(rng, n)];
    M.segs.forEach(function (s) {
      var heli = /H$/.test(s), k = s.replace(/H$/, '');
      if (k === 'barracksF') parts.push(SEG.barracks(rng, n, true));
      else if (k === 'tanks1') parts.push(SEG.tanks(rng, n, true));
      else parts.push(SEG[k](rng, n, heli));
    });
    parts.push(SEG.boss(rng, n, M));
    var rows = [];
    for (var i = parts.length - 1; i >= 0; i--) parts[i].forEach(function (r) { rows.push(r.join('')); });
    return { rows: rows, name: M.name, boss: M.boss, pats: M.pats };
  }

  // ---------- Разбор карты ----------
  function parseMap(rows) {
    var H = rows.length, W = COLS, grid = new Uint8Array(W * H), hp = new Float32Array(W * H);
    var L = { W: W, H: H, grid: grid, hp: hp, start: null, barracks: [], pads: [], enemies: [], helis: [], rails: [], core: null, cannons: [] };
    for (var r = 0; r < H; r++) {
      if (rows[r].length !== W) throw new Error('ДОЗОР: строка ' + r + ' длиной ' + rows[r].length + ' вместо ' + W);
      for (var c = 0; c < W; c++) {
        var ch = rows[r][c], i = r * W + c, x = c * T + T / 2, y = r * T + T / 2;
        if (CH[ch] != null) { grid[i] = CH[ch]; if (TILE_HP[grid[i]]) hp[i] = TILE_HP[grid[i]]; continue; }
        switch (ch) {
          case 'S': grid[i] = ROAD; L.start = { x: x + T / 2, y: y }; break;
          case 'H': case 'F': grid[i] = BARR; L.barracks.push({ tx: c, ty: r, flag: ch === 'F' }); break;
          case 'h': grid[i] = BARR; break;
          case 'P': grid[i] = PADC; L.pads.push({ tx: c, ty: r }); break;
          case 'p': grid[i] = PADC; break;
          case 'C': grid[i] = CORE; L.core = { tx: c, ty: r }; break;
          case 'c': grid[i] = CORE; break;
          case 'n': grid[i] = WALL; L.cannons.push({ x: x, y: y }); break;
          case 'i': L.enemies.push({ type: 'infantry', x: x, y: y }); break;
          case 'u': L.enemies.push({ type: 'turret', x: x, y: y }); break;
          case 'k': L.enemies.push({ type: 'tank', x: x, y: y }); break;
          case 'b': grid[i] = WATER; L.enemies.push({ type: 'boat', x: x, y: y }); break;
          case 'g': L.helis.push(y); break;
          default: throw new Error('ДОЗОР: неизвестный символ «' + ch + '» в строке ' + r);
        }
      }
      var rails = 0; for (var c2 = 0; c2 < W; c2++) if (grid[r * W + c2] === RAIL) rails++;
      if (rails >= W - 2) L.rails.push(r);
    }
    return L;
  }

  // Достижимость: от старта до арены босса (строка над воротами) по клеткам, проходимым машиной;
  // разрушаемые (дома, деревья, мешки) считаются проходимыми — их сносит второе оружие.
  function solveMap(rows) {
    var Lv = parseMap(rows), W = Lv.W, H = Lv.H, seen = new Uint8Array(W * H), q = [];
    var pass = function (c, r) { if (c < 0 || r < 0 || c >= W || r >= H) return false; var t = Lv.grid[r * W + c]; return !solidV(t) || breakable(t); };
    if (!Lv.start) return { ok: false, top: H };
    var sc = Math.floor(Lv.start.x / T), sr = Math.floor(Lv.start.y / T);
    seen[sr * W + sc] = 1; q.push(sc, sr);
    var top = sr;
    while (q.length) {
      var r = q.pop(), c = q.pop(); if (r < top) top = r;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nc = c + d[0], nr = r + d[1]; if (pass(nc, nr) && !seen[nr * W + nc]) { seen[nr * W + nc] = 1; q.push(nc, nr); } });
    }
    var arenaRow = 12, near = function (tx, ty, tw, th) { for (var y = ty - 1; y <= ty + th; y++) for (var x = tx - 1; x <= tx + tw; x++) if (x >= 0 && y >= 0 && x < W && y < H && seen[y * W + x]) return true; return false; };
    return { ok: top <= arenaRow, top: top, pads: Lv.pads.every(function (p) { return near(p.tx, p.ty, 3, 3); }), barracks: Lv.barracks.every(function (b) { return near(b.tx, b.ty, 2, 2); }) };
  }

  function params(stage, players) {
    return { fire: (1 + 0.08 * (stage - 1)) * (players === 2 ? 1.25 : 1), bspeed: (1 + 0.04 * (stage - 1)) * (players === 2 ? 1.06 : 1), hp: players === 2 ? 1.5 : 1 };
  }

  // ---------- Игра ----------
  D.Game = function (opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, emit = opts.onEvent || function () {};
    var NP = opts.players === 2 ? 2 : 1;
    var S = {
      stage: opts.stage || 1, maxStage: opts.maxStage || STAGES.length, players: NP, score: 0, phase: 'play', phaseT: 0, time: 0, banner: 0,
      continues: opts.continues != null ? opts.continues : CONTINUES, contT: 0, nextLife: EXTRA_LIFE * (NP === 2 ? 1.5 : 1),
      heroes: [], enemies: [], bullets: [], shots: [], ebullets: [], booms: [], marks: [], pows: [], barracks: [], pads: [], trains: [], helis: [],
      grid: null, hp: null, W: COLS, H: 0, camY: 0, boss: null, rescued: 0, totalRescued: 0, lost: 0, kills: 0, name: '', bossKey: '', over: false, won: false
    };
    var P = params(S.stage, NP);
    for (var i = 0; i < NP; i++) S.heroes.push({ id: i, x: 0, y: 0, alive: true, out: false, lives: LIVES, deadT: 0, inv: 0, face: { x: 0, y: -1 }, ang: 0,
      dx: 0, dy: 0, fire: false, cd: 0, scd: 0, tier: 1, carried: 0, unT: 0, moving: false, trail: 0 });

    function ev(t, d) { emit(t, d || {}); }
    function addScore(n) {
      S.score += n;
      while (S.score >= S.nextLife) { S.nextLife += EXTRA_LIFE * (NP === 2 ? 1.5 : 1); S.heroes.forEach(function (h) { if (!h.out) { h.lives++; ev('extraLife', { pi: h.id }); } }); }
    }
    function cell(x, y) { var c = Math.floor(x / T), r = Math.floor(y / T); if (c < 0 || c >= COLS || r < 0 || r >= S.H) return ROCK; return S.grid[r * COLS + c]; }
    function cellSolid(c, r) { if (c < 0 || c >= COLS || r < 0 || r >= S.H) return true; return solidV(S.grid[r * COLS + c]); }
    function boxFree(x, y, h) {
      var c0 = Math.floor((x - h) / T), c1 = Math.floor((x + h - 0.01) / T), r0 = Math.floor((y - h) / T), r1 = Math.floor((y + h - 0.01) / T);
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (cellSolid(c, r)) return false;
      return true;
    }

    function loadStage(n) {
      var m = opts.levels ? opts.levels(n) : (opts.map ? { rows: opts.map, name: 'test', boss: opts.boss || 'bolt', pats: opts.pats || ['spread'] } : genStage(n));
      var Lv = parseMap(m.rows);
      P = params(n, NP);
      S.stage = n; S.name = m.name; S.bossKey = m.boss; S.grid = Lv.grid; S.hp = Lv.hp; S.H = Lv.H; S.W = Lv.W;
      S.enemies = []; S.bullets = []; S.shots = []; S.ebullets = []; S.booms = []; S.marks = []; S.pows = [];
      S.barracks = Lv.barracks.map(function (b) { return { tx: b.tx, ty: b.ty, x: b.tx * T + T, y: b.ty * T + T, hp: BARRACKS_HP * P.hp, max: BARRACKS_HP * P.hp, flag: b.flag, dead: false, flash: 0, pows: b.flag ? 4 : 3 }; });
      S.pads = Lv.pads.map(function (p) { return { tx: p.tx, ty: p.ty, x: p.tx * T + 1.5 * T, y: p.ty * T + 1.5 * T, heliT: 0 }; });
      S.helis = Lv.helis.slice();
      S.trains = Lv.rails.map(function (r) { return { row: r, y: r * T + T / 2, state: 'wait', t: 0, dir: 1, x: 0, cars: null, done: false, runs: 0 }; });
      Lv.enemies.forEach(function (e) { spawn(e.type, e.x, e.y); });
      Lv.cannons.forEach(function (c) { var e = spawn('cannon', c.x, c.y); e.boss = true; });
      S.boss = null;
      if (Lv.core) {
        var bx = Lv.core.tx * T, by = Lv.core.ty * T, hpB = (BOSS_HP + BOSS_HP_STEP * (n - 1)) * (NP === 2 ? 1.5 : 1);
        S.boss = { key: m.boss, pats: m.pats.slice(), x0: bx, y0: by, x1: bx + CORE_W * T, y1: by + CORE_H * T, x: bx + CORE_W * T / 2, y: by + CORE_H * T / 2,
          hp: hpB, max: hpB, phase: 0, shift: 0, intro: 0, active: false, dead: false, deadT: 0, cd: 1.5, pi: 0, flash: 0, sweep: null };
      }
      S.camY = Math.max(0, S.H * T - VIEW_H);
      var st = Lv.start || { x: VIEW_W / 2, y: S.H * T - 3 * T };
      S.heroes.forEach(function (h, k) {
        h.x = NP === 2 ? st.x + (k ? 36 : -36) : st.x; h.y = st.y; h.face = { x: 0, y: -1 }; h.ang = 0; h.carried = 0; h.cd = 0; h.scd = 0; h.inv = 1.2;
        if (!h.out) { h.alive = true; h.deadT = 0; }
      });
      S.rescued = 0; S.lost = 0; S.phase = 'play'; S.phaseT = 0; S.banner = 2.4;
      ev('stage', { stage: n });
    }
    function spawn(type, x, y) {
      var d = ENEMIES[type];
      var e = { type: type, x: x, y: y, r: d.r, hp: d.hp * P.hp, max: d.hp * P.hp, cd: 0.8 + rng() * d.cd, warn: 0, burst: 0, active: false, dead: false,
        air: !!d.air, solid: !!d.solid, ang: Math.PI / 2, vx: 0, vy: 0, t: 0, flash: 0, boss: false, dirT: 0, aimX: 0, aimY: 1 };
      if (type === 'boat') e.vx = (rng() < 0.5 ? -1 : 1) * d.speed;
      S.enemies.push(e); return e;
    }
    function heroTarget(x, y) {
      var best = null, bd = 1e9;
      S.heroes.forEach(function (h) { if (h.alive) { var dd = dist(x, y, h.x, h.y); if (dd < bd) { bd = dd; best = h; } } });
      return best;
    }
    function eshot(x, y, tx, ty, spd, o) {
      var a = Math.atan2(ty - y, tx - x); o = o || {};
      spd *= P.bspeed;
      S.ebullets.push({ x: x, y: y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: o.r || 3, air: !!o.air, kind: o.kind || 'b', from: o.from || 'boss', life: 4 });
    }

    // ---------- Герои ----------
    function moveHero(h, mx, my) {
      var steps = Math.ceil(Math.max(Math.abs(mx), Math.abs(my)) / 6) || 1, sx = mx / steps, sy = my / steps;
      for (var k = 0; k < steps; k++) {
        if (sx && boxFree(h.x + sx, h.y, HB)) h.x += sx;
        else if (sx && !sy) { // скольжение у угла: подтолкнуть по вертикали
          if (boxFree(h.x + sx, h.y - 4, HB) && boxFree(h.x, h.y - 4, HB)) h.y -= 1; else if (boxFree(h.x + sx, h.y + 4, HB) && boxFree(h.x, h.y + 4, HB)) h.y += 1;
        }
        if (sy && boxFree(h.x, h.y + sy, HB)) h.y += sy;
        else if (sy && !sx) {
          if (boxFree(h.x - 4, h.y + sy, HB) && boxFree(h.x - 4, h.y, HB)) h.x -= 1; else if (boxFree(h.x + 4, h.y + sy, HB) && boxFree(h.x + 4, h.y, HB)) h.x += 1;
        }
      }
    }
    function updateHero(h, dt) {
      if (h.out) return;
      if (!h.alive) {
        h.deadT -= dt;
        if (h.deadT <= 0 && h.lives > 0) respawn(h);
        return;
      }
      if (h.inv > 0) h.inv -= dt;
      var dx = h.dx, dy = h.dy, len = Math.sqrt(dx * dx + dy * dy);
      h.moving = len > 0;
      if (len > 0) {
        h.face = { x: dx / len, y: dy / len };
        var ta = Math.atan2(h.face.x, -h.face.y), da = ta - h.ang;
        while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        h.ang += clamp(da, -12 * dt, 12 * dt);
        moveHero(h, dx / len * SPEED * dt, dy / len * SPEED * dt);
        h.trail += dt;
      }
      // рамки кадра
      h.x = clamp(h.x, HB + 2, VIEW_W - HB - 2);
      var top = S.camY + 16, bot = S.camY + VIEW_H - 16;
      if (h.y < top) moveHero(h, 0, top - h.y);
      if (h.y > bot) moveHero(h, 0, bot - h.y);
      if (h.y > bot + 2) h.y = bot;   // зажало стеной и краем — краем
      // твёрдые враги — выталкивают
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (e.dead || !e.solid) continue;
        var dd = dist(h.x, h.y, e.x, e.y), need = e.r + HB;
        if (dd < need && dd > 0.01) moveHero(h, (h.x - e.x) / dd * (need - dd), (h.y - e.y) / dd * (need - dd));
      }
      // пулемёт — всегда вверх
      h.cd -= dt; h.scd -= dt;
      if (h.fire && h.cd <= 0) {
        h.cd = MG.cd; var side = (Math.floor(S.time / MG.cd) % 2) ? 4 : -4;
        S.bullets.push({ x: h.x + side, y: h.y - 12, vy: -MG.speed, pi: h.id });
        ev('mg', { pi: h.id });
      }
      // пехота под колёсами
      for (var j = 0; j < S.enemies.length; j++) {
        var f = S.enemies[j];
        if (!f.dead && f.type === 'infantry' && dist(h.x, h.y, f.x, f.y) < f.r + HB) killEnemy(f, h.id, 'squash');
      }
      // пленные: подобрать
      S.pows.forEach(function (p) {
        if (p.gone || h.carried >= CAPACITY || p.t > 0) return;
        if (dist(h.x, h.y, p.x, p.y) < 17) {
          p.gone = true; h.carried++; addScore(SCORE.pickup); ev('pow', { pi: h.id, x: p.x, y: p.y, master: p.master });
          if (p.master && h.tier < MAX_TIER) { h.tier++; ev('upgrade', { pi: h.id, tier: h.tier, x: h.x, y: h.y }); }
        }
      });
      // площадка: высадка по одному
      var onPad = false;
      S.pads.forEach(function (pd) { if (Math.abs(h.x - pd.x) < 1.5 * T + 2 && Math.abs(h.y - pd.y) < 1.5 * T + 2) { onPad = true; if (h.carried > 0) pd.heliT = 2.5; } });
      if (onPad && h.carried > 0) {
        h.unT -= dt;
        if (h.unT <= 0) { h.unT = 0.2; h.carried--; S.rescued++; S.totalRescued++; addScore(SCORE.deliver); ev('deliver', { pi: h.id, x: h.x, y: h.y, left: h.carried }); }
      } else h.unT = 0.3;
    }
    function secondary(pi) {
      var h = S.heroes[pi]; if (!h || !h.alive || S.phase !== 'play') return false;
      var W = SEC[h.tier], mine = 0;
      S.shots.forEach(function (s) { if (s.pi === pi) mine++; });
      if (h.scd > 0 || mine >= W.max) return false;
      h.scd = W.cd;
      S.shots.push({ pi: pi, tier: h.tier, x: h.x + h.face.x * 12, y: h.y + h.face.y * 12, vx: h.face.x * W.speed, vy: h.face.y * W.speed, d: 0, range: W.range, t: 0 });
      ev('sec', { pi: pi, tier: h.tier });
      return true;
    }
    function respawn(h) {
      var mate = S.heroes.filter(function (o) { return o !== h && o.alive; })[0];
      var x = mate ? mate.x : VIEW_W / 2, y = S.camY + VIEW_H - 60;
      if (mate) y = clamp(mate.y + 40, S.camY + 60, S.camY + VIEW_H - 40);
      var best = null;
      for (var rr = 0; rr < 18 && !best; rr++) for (var k = 0; k <= 10 && !best; k++) for (var sgn = -1; sgn <= 1; sgn += 2) {
        var tx = clamp(x + sgn * k * T, 16, VIEW_W - 16), ty = y - rr * T * 0.5;
        if (boxFree(tx, ty, HB + 1) && !S.enemies.some(function (e) { return !e.dead && e.solid && dist(e.x, e.y, tx, ty) < e.r + HB + 4; })) { best = { x: tx, y: ty }; break; }
      }
      if (!best) best = { x: x, y: y };
      h.x = best.x; h.y = best.y; h.alive = true; h.inv = INV_SPAWN; h.cd = 0; h.scd = 0; h.face = { x: 0, y: -1 }; h.ang = 0;
      S.ebullets = S.ebullets.filter(function (b) { return dist(b.x, b.y, h.x, h.y) > 90; });
      ev('respawn', { pi: h.id });
    }
    function killHero(h, src) {
      if (!h.alive || h.inv > 0 || S.phase !== 'play') return;
      h.alive = false; h.lives--; h.deadT = RESPAWN_T;
      ev('heroDie', { pi: h.id, x: h.x, y: h.y, src: src, carried: h.carried });
      for (var k = 0; k < h.carried; k++) {
        var a = rng() * Math.PI * 2;
        S.pows.push({ x: h.x, y: h.y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, gone: false, master: false, t: 0.9, wander: rng() * 6 });
      }
      if (h.carried) ev('scatter', { pi: h.id, n: h.carried, x: h.x, y: h.y });
      h.carried = 0;
      if (h.tier > 1) h.tier--;
      if (h.lives <= 0) { h.out = true; ev('out', { pi: h.id }); }
      if (S.heroes.every(function (o) { return o.out; })) {
        if (S.continues > 0) { S.phase = 'cont'; S.contT = CONT_T; ev('contAsk', { left: S.continues }); }
        else { S.phase = 'over'; S.phaseT = 1.6; }
      }
    }
    function continueGame() {
      if (S.phase !== 'cont') return false;
      S.continues--; S.phase = 'play';
      S.heroes.forEach(function (h) { h.out = false; h.lives = LIVES; h.alive = false; h.deadT = 0; respawn(h); });
      ev('continue', { left: S.continues });
      return true;
    }

    // ---------- Взрывы ----------
    function blast(x, y, r, dmg, o) {
      o = o || {};
      S.booms.push({ x: x, y: y, r: r, t: 0.45, max: 0.45, enemy: !!o.enemy });
      ev('boom', { x: x, y: y, r: r, enemy: !!o.enemy });
      if (o.enemy) { S.heroes.forEach(function (h) { if (h.alive && dist(h.x, h.y, x, y) < r + HIT_R - 2) killHero(h, o.src || 'blast'); }); return; }
      S.enemies.forEach(function (e) { if (!e.dead && e.active && (!e.air || o.air) && dist(e.x, e.y, x, y) < r + e.r) hurtEnemy(e, dmg, o.pi); });
      S.barracks.forEach(function (b) { if (!b.dead && circRect(x, y, r, b.x - T, b.y - T, b.x + T, b.y + T)) hurtBarracks(b, dmg); });
      var c0 = Math.floor((x - r) / T), c1 = Math.floor((x + r) / T), r0 = Math.floor((y - r) / T), r1 = Math.floor((y + r) / T);
      for (var rr = r0; rr <= r1; rr++) for (var c = c0; c <= c1; c++) {
        if (c < 0 || c >= COLS || rr < 0 || rr >= S.H) continue;
        var i = rr * COLS + c; if (!breakable(S.grid[i])) continue;
        if (dist(x, y, c * T + T / 2, rr * T + T / 2) < r + 8) { S.hp[i] -= dmg; if (S.hp[i] <= 0) { var kind = S.grid[i]; S.grid[i] = RUBBLE; addScore(SCORE.block); ev('block', { x: c * T + T / 2, y: rr * T + T / 2, kind: kind }); } }
      }
      if (S.boss && S.boss.active && !S.boss.dead && circRect(x, y, r, S.boss.x0, S.boss.y0, S.boss.x1, S.boss.y1)) hurtBoss(dmg);
      S.trains.forEach(function (tr) { if (tr.cars) tr.cars.forEach(function (cr) { if (!cr.dead && circRect(x, y, r, cr.x - CAR.w / 2, tr.y - CAR.h / 2, cr.x + CAR.w / 2, tr.y + CAR.h / 2)) hurtCar(tr, cr, dmg); }); });
    }
    function hurtEnemy(e, dmg, pi) {
      if (e.dead) return;
      e.hp -= dmg; e.flash = 0.1; ev('hit', { x: e.x, y: e.y, type: e.type });
      if (e.hp <= 0) killEnemy(e, pi, 'shot');
    }
    function killEnemy(e, pi, how) {
      if (e.dead) return;
      e.dead = true; S.kills++; addScore(ENEMIES[e.type].score);
      ev('kill', { type: e.type, x: e.x, y: e.y, how: how, pi: pi });
    }
    function hurtBarracks(b, dmg) {
      b.hp -= dmg; b.flash = 0.12; ev('barracksHit', { x: b.x, y: b.y });
      if (b.hp > 0) return;
      b.dead = true; addScore(SCORE.barracks);
      for (var dy = 0; dy < 2; dy++) for (var dx = 0; dx < 2; dx++) S.grid[(b.ty + dy) * COLS + b.tx + dx] = RUBBLE;
      for (var k = 0; k < b.pows; k++) {
        var a = Math.PI / 2 + (k - (b.pows - 1) / 2) * 0.7;
        S.pows.push({ x: b.x + (k - 1.5) * 6, y: b.y + 8, vx: Math.cos(a) * 50, vy: Math.sin(a) * 60, gone: false, master: b.flag && k === 0, t: 0.5, wander: rng() * 6 });
      }
      ev('barracks', { x: b.x, y: b.y, flag: b.flag, n: b.pows });
    }
    function hurtCar(tr, cr, dmg) {
      cr.hp -= dmg; cr.flash = 0.1; ev('hit', { x: cr.x, y: tr.y, type: 'car' });
      if (cr.hp <= 0) { cr.dead = true; S.kills++; addScore(CAR.score); ev('kill', { type: 'car', x: cr.x, y: tr.y }); }
    }
    function hurtBoss(dmg) {
      var B = S.boss; if (!B || B.dead || B.shift > 0 || B.intro > 0) return;
      B.hp -= dmg; B.flash = 0.1; ev('bossHit', { x: B.x, y: B.y1, hp: B.hp });
      if (B.hp <= 0) { B.hp = 0; B.dead = true; B.deadT = 2.2; addScore(10000 * S.stage); ev('bossDie', { x: B.x, y: B.y, key: B.key }); return; }
      var ph = Math.min(2, Math.floor((1 - B.hp / B.max) * 3));
      if (ph > B.phase) { B.phase = ph; B.shift = 0.8; ev('phase', { phase: ph, x: B.x, y: B.y }); }
    }

    // ---------- Снаряды ----------
    function updateBullets(dt) {
      var top = S.camY - 10;
      S.bullets = S.bullets.filter(function (b) {
        b.y += b.vy * dt;
        if (b.y < top) return false;
        for (var i = 0; i < S.enemies.length; i++) {
          var e = S.enemies[i];
          if (!e.dead && e.active && Math.abs(e.x - b.x) < e.r + 2 && Math.abs(e.y - b.y) < e.r + 4) { hurtEnemy(e, MG.dmg, b.pi); return false; }
        }
        for (var t = 0; t < S.trains.length; t++) {
          var tr = S.trains[t]; if (!tr.cars || Math.abs(b.y - tr.y) > CAR.h / 2) continue;
          for (var k = 0; k < tr.cars.length; k++) { var cr = tr.cars[k]; if (!cr.dead && Math.abs(b.x - cr.x) < CAR.w / 2) { hurtCar(tr, cr, MG.dmg); return false; } }
        }
        var c = cell(b.x, b.y);
        if (blockB(c)) { ev('wall', { x: b.x, y: b.y }); return false; }
        return true;
      });
      S.shots = S.shots.filter(function (s) {
        var W = SEC[s.tier];
        s.t += dt;
        if (W.turn) {   // самонаведение
          var tg = homingTarget(s);
          if (tg) {
            var want = Math.atan2(tg.y - s.y, tg.x - s.x), cur = Math.atan2(s.vy, s.vx), da = want - cur;
            while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
            cur += clamp(da, -W.turn * dt, W.turn * dt); s.vx = Math.cos(cur) * W.speed; s.vy = Math.sin(cur) * W.speed;
          }
        }
        s.x += s.vx * dt; s.y += s.vy * dt; s.d += W.speed * dt;
        if (s.x < -20 || s.x > VIEW_W + 20 || s.y < S.camY - 30 || s.y > S.camY + VIEW_H + 30) return false;
        if (W.name !== 'grenade' && shotHits(s)) { blast(s.x, s.y, W.r, W.dmg, { air: W.air, pi: s.pi }); return false; }
        if (s.d >= s.range) { blast(s.x, s.y, W.r, W.dmg, { air: W.air, pi: s.pi }); return false; }
        return true;
      });
      S.ebullets = S.ebullets.filter(function (b) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (b.life <= 0 || b.y > S.camY + VIEW_H + 20 || b.y < S.camY - 40 || b.x < -10 || b.x > VIEW_W + 10) return false;
        if (!b.air && blockB(cell(b.x, b.y))) return false;
        for (var i = 0; i < S.heroes.length; i++) { var h = S.heroes[i]; if (h.alive && h.inv <= 0 && dist(h.x, h.y, b.x, b.y) < b.r + HIT_R) { killHero(h, b.from); return false; } }
        return true;
      });
    }
    function shotHits(s) {
      for (var i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (!e.dead && e.active && dist(e.x, e.y, s.x, s.y) < e.r + 4) return true; }
      for (var j = 0; j < S.barracks.length; j++) { var b = S.barracks[j]; if (!b.dead && Math.abs(b.x - s.x) < T && Math.abs(b.y - s.y) < T) return true; }
      var c = cell(s.x, s.y); if (breakable(c)) return true;
      var B = S.boss; if (B && B.active && !B.dead && s.x > B.x0 && s.x < B.x1 && s.y > B.y0 && s.y < B.y1) return true;
      for (var t = 0; t < S.trains.length; t++) { var tr = S.trains[t]; if (tr.cars && Math.abs(s.y - tr.y) < CAR.h / 2) for (var k = 0; k < tr.cars.length; k++) if (!tr.cars[k].dead && Math.abs(s.x - tr.cars[k].x) < CAR.w / 2) return true; }
      return false;
    }
    function homingTarget(s) {
      var best = null, bd = 260, vl = Math.sqrt(s.vx * s.vx + s.vy * s.vy) || 1;
      var consider = function (x, y) {
        var dx = x - s.x, dy = y - s.y, dd = Math.sqrt(dx * dx + dy * dy);
        if (dd < bd && (dx * s.vx + dy * s.vy) / (dd * vl + 0.01) > 0.15) { bd = dd; best = { x: x, y: y }; }
      };
      S.enemies.forEach(function (e) { if (!e.dead && e.active) consider(e.x, e.y); });
      S.barracks.forEach(function (b) { if (!b.dead) consider(b.x, b.y); });
      var B = S.boss; if (B && B.active && !B.dead) consider(B.x, B.y1 - 10);
      S.trains.forEach(function (tr) { if (tr.cars) tr.cars.forEach(function (cr) { if (!cr.dead) consider(cr.x, tr.y); }); });
      return best;
    }

    // ---------- Враги ----------
    function updateEnemies(dt) {
      var vTop = S.camY - 30, vBot = S.camY + VIEW_H + 30;
      S.enemies.forEach(function (e) {
        if (e.dead) return;
        if (!e.active) { if (e.y > vTop + 10 && e.y < vBot) e.active = true; else return; }
        if (e.flash > 0) e.flash -= dt;
        e.t += dt;
        if (!e.air && e.y > S.camY + VIEW_H + 80) { e.dead = true; e.gone = true; return; }
        var d = ENEMIES[e.type], h = heroTarget(e.x, e.y);
        // движение
        if (e.type === 'infantry') {
          e.dirT -= dt;
          if (e.dirT <= 0) {
            e.dirT = 1 + rng() * 1.5;
            var tx = h ? h.x : e.x, ty = h ? h.y : e.y + 50, a = Math.atan2(ty - e.y, tx - e.x) + (rng() - 0.5) * 2.2;
            if (h && dist(e.x, e.y, h.x, h.y) < 70) a += Math.PI;   // не лезет под колёса — пятится
            e.vx = Math.cos(a) * d.speed; e.vy = Math.sin(a) * d.speed;
            if (rng() < 0.3) { e.vx = 0; e.vy = 0; }
          }
          stepEnemy(e, e.vx * dt, e.vy * dt);
        } else if (e.type === 'tank') {
          if (h) { var ddx = h.x - e.x, ddy = h.y - e.y; if (Math.abs(ddy) > 90) stepEnemy(e, 0, Math.sign(ddy) * d.speed * dt); if (Math.abs(ddx) > 30) stepEnemy(e, Math.sign(ddx) * d.speed * 0.6 * dt, 0); }
        } else if (e.type === 'boat') {
          var nx = e.x + e.vx * dt, cc = cell(nx + Math.sign(e.vx) * e.r, e.y);
          if (nx < e.r || nx > VIEW_W - e.r || (cc !== WATER && cc !== BRIDGE)) e.vx = -e.vx; else e.x = nx;
        } else if (e.type === 'heli') {
          var hy = S.camY + e.hover;
          if (e.t > 13) e.y -= 90 * dt;
          else e.y += (hy - e.y) * Math.min(1, dt * 1.6);
          var hx = h ? h.x + Math.sin(e.t * 0.9) * 90 : VIEW_W / 2;
          e.x += clamp(hx - e.x, -70 * dt, 70 * dt);
          if (e.y < S.camY - 60 && e.t > 13) { e.dead = true; e.gone = true; return; }
        }
        // огонь: вспышка-предупреждение, затем выстрел по ближайшему
        if (!h) return;
        var seen = e.y > S.camY + 4 && e.y < S.camY + VIEW_H - 10;
        if (e.warn > 0) {
          e.warn -= dt;
          if (e.warn <= 0) {
            var ang = Math.atan2(e.aimY, e.aimX);
            eshot(e.x, e.y, e.x + Math.cos(ang) * 100, e.y + Math.sin(ang) * 100, d.bullet, { air: e.air, kind: d.shell ? 'shell' : 'b', r: d.shell ? 5 : 3, from: e.type });
            e.burst--; if (e.burst > 0) e.warn = 0.17;   // очередь — по тому же прицелу: уходи вбок
            ev('eshot', { x: e.x, y: e.y, kind: d.shell ? 'shell' : e.type });
          }
          return;
        }
        e.cd -= dt * P.fire;
        if (e.cd <= 0 && seen && dist(e.x, e.y, h.x, h.y) < (e.type === 'infantry' ? 300 : 420) && !(d.near && dist(e.x, e.y, h.x, h.y) < d.near)) {
          e.cd = d.cd * (0.85 + rng() * 0.3); e.warn = 0.42;
          e.burst = d.burst ? (e.type === 'turret' && S.stage >= 3 ? 3 : d.burst) : 1;
          e.aimX = h.x - e.x; e.aimY = h.y - e.y; e.ang = Math.atan2(e.aimY, e.aimX);
        }
        if (e.type !== 'infantry') {   // ствол плавно доворачивает на цель
          var want = Math.atan2(h.y - e.y, h.x - e.x), da = want - e.ang;
          while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
          e.ang += clamp(da, -3 * dt, 3 * dt);
        } else { e.aimX = h.x - e.x; e.aimY = h.y - e.y; }
      });
      S.enemies = S.enemies.filter(function (e) { return !(e.dead && e.gone) && !(e.dead && e.t > 99); });
      // вертолёты по меткам
      S.helis = S.helis.filter(function (y) {
        if (S.camY < y - VIEW_H * 0.35) {
          var e = spawn('heli', 60 + rng() * (VIEW_W - 120), S.camY - 40); e.active = true; e.hover = 110 + rng() * 60; e.cd = 1.6;
          ev('heli', { x: e.x }); return false;
        }
        return true;
      });
    }
    function stepEnemy(e, mx, my) {
      var h = Math.max(5, e.r - 3);
      if (mx && boxFree(e.x + mx, e.y, h) && cell(e.x + mx, e.y) !== PADC) e.x += mx; else if (e.type === 'infantry') e.vx = -e.vx;
      if (my && boxFree(e.x, e.y + my, h) && e.y + my < S.camY + VIEW_H + 40) e.y += my; else if (e.type === 'infantry') e.vy = -e.vy;
      e.x = clamp(e.x, 12, VIEW_W - 12);
    }

    // ---------- Бронепоезд ----------
    function updateTrains(dt) {
      S.trains.forEach(function (tr) {
        if (tr.done) return;
        if (tr.y > S.camY + VIEW_H + 20) { tr.done = true; tr.cars = null; return; }
        var inView = tr.y > S.camY + 40 && tr.y < S.camY + VIEW_H - 100;
        if (tr.state === 'wait') {
          tr.t -= dt;
          if (inView && tr.t <= 0) { tr.state = 'warn'; tr.t = 1.5; tr.dir = tr.runs % 2 ? -1 : (rng() < 0.5 ? 1 : -1); if (tr.runs) tr.dir = -tr.lastDir; ev('trainWarn', { y: tr.y }); }
          return;
        }
        if (tr.state === 'warn') {
          tr.t -= dt;
          if (tr.t <= 0) {
            tr.state = 'run'; tr.lastDir = tr.dir;
            if (!tr.cars) { var nc = Math.min(5, 2 + Math.ceil(S.stage / 2)); tr.cars = []; for (var k = 0; k < nc; k++) tr.cars.push({ off: k, hp: CAR.hp * P.hp, max: CAR.hp * P.hp, dead: false, cd: 1 + rng() * CAR.cd, warn: 0, flash: 0, x: 0 }); }
            tr.x = tr.dir > 0 ? -CAR.w / 2 : VIEW_W + CAR.w / 2; ev('train', { y: tr.y });
          }
          return;
        }
        tr.x += tr.dir * CAR.speed * dt;
        var alive = 0, onScreen = false;
        tr.cars.forEach(function (cr) {
          cr.x = tr.x - tr.dir * cr.off * (CAR.w + CAR.gap);
          if (cr.flash > 0) cr.flash -= dt;
          if (cr.dead) return; alive++;
          if (cr.x > -CAR.w / 2 && cr.x < VIEW_W + CAR.w / 2) onScreen = true;
          S.heroes.forEach(function (h) { if (h.alive && Math.abs(h.x - cr.x) < CAR.w / 2 + HB - 2 && Math.abs(h.y - tr.y) < CAR.h / 2 + HB - 2) killHero(h, 'train'); });
          if (cr.x < 10 || cr.x > VIEW_W - 10) return;
          var h = heroTarget(cr.x, tr.y); if (!h) return;
          if (cr.warn > 0) { cr.warn -= dt; if (cr.warn <= 0) { eshot(cr.x, tr.y, h.x, h.y, CAR.bullet, { from: 'car' }); ev('eshot', { x: cr.x, y: tr.y, kind: 'car' }); } return; }
          cr.cd -= dt * P.fire; if (cr.cd <= 0) { cr.cd = CAR.cd * (0.8 + rng() * 0.4); cr.warn = 0.42; }
        });
        if (!alive) { tr.done = true; return; }
        var last = tr.x - tr.dir * (tr.cars.length - 1) * (CAR.w + CAR.gap);
        if (!onScreen && (tr.dir > 0 ? last > VIEW_W + CAR.w : last < -CAR.w)) { tr.state = 'wait'; tr.t = 3; tr.runs++; tr.cars.forEach(function (cr) { cr.x = -999; }); }
      });
    }

    // ---------- Пленные и площадки ----------
    function updatePows(dt) {
      S.pows.forEach(function (p) {
        if (p.gone) return;
        if (p.t > 0) p.t -= dt;
        var h = null, bd = 150;
        S.heroes.forEach(function (o) { if (o.alive && o.carried < CAPACITY) { var dd = dist(o.x, o.y, p.x, p.y); if (dd < bd) { bd = dd; h = o; } } });
        var vx, vy;
        if (p.t > 0) { vx = p.vx; vy = p.vy; }
        else if (h) { var dd2 = Math.max(1, bd); vx = (h.x - p.x) / dd2 * 46; vy = (h.y - p.y) / dd2 * 46; }
        else { p.wander += dt; vx = Math.cos(p.wander * 0.9) * 14; vy = Math.sin(p.wander * 1.3) * 10; }
        var nx = p.x + vx * dt, ny = p.y + vy * dt;
        if (!solidV(cell(nx, p.y))) p.x = clamp(nx, 8, VIEW_W - 8);
        if (!solidV(cell(p.x, ny))) p.y = ny;
        if (p.y > S.camY + VIEW_H + 16) { p.gone = true; S.lost++; ev('powLost', { x: p.x, y: p.y }); }
      });
      S.pows = S.pows.filter(function (p) { return !p.gone; });
      S.pads.forEach(function (pd) { if (pd.heliT > 0) pd.heliT -= dt; });
      S.barracks.forEach(function (b) { if (b.flash > 0) b.flash -= dt; });
    }

    // ---------- Крепость ----------
    function updateBoss(dt) {
      var B = S.boss; if (!B) return;
      if (!B.active) {
        if (S.camY <= B.y1 + T) { B.active = true; B.intro = 1.6; ev('bossIntro', { key: B.key }); }
        return;
      }
      if (B.dead) {
        B.deadT -= dt;
        if (Math.random() < 0.3) ev('bossBoom', {});
        if (B.deadT <= 0 && S.phase === 'play') stageClear();
        return;
      }
      if (B.flash > 0) B.flash -= dt;
      if (B.intro > 0) { B.intro -= dt; return; }
      if (B.shift > 0) { B.shift -= dt; return; }
      if (B.sweep) {
        B.sweep.t -= dt;
        if (B.sweep.t <= 0) {
          B.sweep.t = 0.09; var a = B.sweep.a0 + (B.sweep.a1 - B.sweep.a0) * (B.sweep.k / 9);
          eshot(B.x, B.y1, B.x + Math.cos(a) * 100, B.y1 + Math.sin(a) * 100, 135, { r: 4 }); B.sweep.k++;
          if (B.sweep.k > 9) B.sweep = null;
        }
      }
      B.cd -= dt * (1 + 0.22 * B.phase) * P.fire;
      if (B.cd > 0) return;
      var h = heroTarget(B.x, B.y1); if (!h) return;
      var pat = B.pats[B.pi % B.pats.length]; B.pi++;
      B.cd = PATTERN_CD[pat];
      var bx = B.x, by = B.y1 - 4, base = Math.atan2(h.y - by, h.x - bx), k;
      if (pat === 'spread') {
        var n = 3 + B.phase * 2;
        for (k = 0; k < n; k++) { var a = base + (k - (n - 1) / 2) * 0.22; eshot(bx, by, bx + Math.cos(a) * 100, by + Math.sin(a) * 100, 125, { r: 4 }); }
      } else if (pat === 'ring') {
        var m = 10 + B.phase * 2, rot = rng() * 0.5;
        for (k = 0; k < m; k++) { var a2 = Math.PI * (k / (m - 1)) + rot * 0.2; eshot(bx, by, bx + Math.cos(a2) * 100, by + Math.sin(a2) * 100, 105, { r: 4 }); }
      } else if (pat === 'mortar') {
        S.heroes.forEach(function (o) { if (o.alive) for (var j = 0; j < (B.phase >= 2 ? 2 : 1); j++) S.marks.push({ x: clamp(o.x + (j ? (rng() - 0.5) * 120 : 0), 14, VIEW_W - 14), y: o.y + (j ? (rng() - 0.5) * 80 : 0), t: 1.35, max: 1.35 }); });
        ev('mortar', {});
      } else if (pat === 'spawn') {
        var live = S.enemies.filter(function (e) { return !e.dead && e.type === 'infantry'; }).length;
        if (live < 6) { [2.5, 17.5].forEach(function (c) { var e = spawn('infantry', c * T, 7 * T + T / 2); e.active = true; e.cd = 1.2; }); ev('spawn', {}); }
      } else if (pat === 'sweep') {
        var left = rng() < 0.5; B.sweep = { a0: left ? Math.PI * 0.15 : Math.PI * 0.85, a1: left ? Math.PI * 0.85 : Math.PI * 0.15, k: 0, t: 0 };
        ev('sweep', {});
      }
      ev('bossShot', { pat: pat });
    }
    function updateMarks(dt) {
      S.marks = S.marks.filter(function (m) { m.t -= dt; if (m.t <= 0) { blast(m.x, m.y, 26, 0, { enemy: true, src: 'mortar' }); return false; } return true; });
      S.booms = S.booms.filter(function (b) { b.t -= dt; return b.t > 0; });
    }
    function stageClear() {
      var bonus = SCORE.stage * S.stage, left = 0;
      S.heroes.forEach(function (h) { left += h.carried; S.rescued += h.carried; S.totalRescued += h.carried; h.carried = 0; });
      addScore(bonus + left * SCORE.deliver);
      S.enemies.forEach(function (e) { if (!e.dead) { e.dead = true; ev('kill', { type: e.type, x: e.x, y: e.y, how: 'clear' }); } });
      S.ebullets = []; S.marks = [];
      S.phase = 'clear'; S.phaseT = 3.6; ev('clear', { stage: S.stage, bonus: bonus, rescued: S.rescued });
    }

    // ---------- Камера ----------
    function updateCamera() {
      var live = S.heroes.filter(function (h) { return h.alive; });
      if (!live.length) return;
      var topY = Math.min.apply(null, live.map(function (h) { return h.y; })), botY = Math.max.apply(null, live.map(function (h) { return h.y; }));
      var want = topY - VIEW_H * 0.55, floor = botY + 30 - VIEW_H;
      var c = Math.max(want, floor);
      if (c < S.camY) S.camY = Math.max(0, c);
    }

    // ---------- Шаг ----------
    function step(dt) {
      S.time += dt; if (S.banner > 0) S.banner -= dt;
      if (S.phase === 'cont') {
        S.contT -= dt; if (S.contT <= 0) { S.phase = 'over'; S.phaseT = 1.2; }
        updateBullets(dt); updateMarks(dt); return;
      }
      if (S.phase === 'over') { S.phaseT -= dt; if (S.phaseT <= 0 && !S.over) { S.over = true; ev('gameover', { score: S.score }); } updateMarks(dt); return; }
      if (S.phase === 'clear') {
        S.phaseT -= dt; updateMarks(dt);
        S.heroes.forEach(function (h) { if (h.alive) { h.y -= 30 * dt; } });
        if (S.phaseT <= 0) {
          if (S.stage >= S.maxStage) { if (!S.won) { S.won = true; S.phase = 'won'; ev('win', { score: S.score }); } }
          else { S.heroes.forEach(function (h) { if (h.out) { h.out = false; h.lives = 1; } }); loadStage(S.stage + 1); }
        }
        return;
      }
      if (S.phase === 'won') return;
      S.heroes.forEach(function (h) { updateHero(h, dt); });
      updateCamera();
      updateEnemies(dt); updateTrains(dt); updateBullets(dt); updatePows(dt); updateBoss(dt); updateMarks(dt);
    }

    var api = {
      start: function () { loadStage(S.stage); return api; },
      update: function (dt) { var n = Math.max(1, Math.ceil(dt / (1 / 60) - 1e-6)), h = dt / n; for (var i = 0; i < n; i++) step(h); },
      setDir: function (pi, dx, dy) { var h = S.heroes[pi]; if (h) { h.dx = dx; h.dy = dy; } },
      setFire: function (pi, on) { var h = S.heroes[pi]; if (h) h.fire = !!on; },
      sec: secondary,
      cont: continueGame,
      state: function () { return S; },
      _S: S, _spawn: function (t, x, y) { return spawn(t, x, y); }, _blast: blast, _kill: killHero, _boxFree: boxFree, _cell: cell, _cellSolid: cellSolid,
      _hurtBoss: hurtBoss, _clear: stageClear, _P: function () { return P; }
    };
    return api;
  };

  D.logic = {
    T: T, COLS: COLS, VIEW_W: VIEW_W, VIEW_H: VIEW_H, HUD: HUD, SCREEN_H: SCREEN_H, SPEED: SPEED, HB: HB, HIT_R: HIT_R, CAPACITY: CAPACITY,
    LIVES: LIVES, CONTINUES: CONTINUES, CONT_T: CONT_T, EXTRA_LIFE: EXTRA_LIFE, MAX_TIER: MAX_TIER, MG: MG, SEC: SEC, ENEMIES: ENEMIES, CAR: CAR,
    BARRACKS_HP: BARRACKS_HP, CORE_W: CORE_W, CORE_H: CORE_H, SCORE: SCORE, PATTERN_CD: PATTERN_CD, STAGES: STAGES, BIND: BIND,
    CELL: { G: G, WALL: WALL, WATER: WATER, BRIDGE: BRIDGE, BLD: BLD, TREE: TREE, ROCK: ROCK, RAIL: RAIL, SAND: SAND, RUBBLE: RUBBLE, BARR: BARR, CORE: CORE, ROAD: ROAD, PAD: PADC },
    solidV: solidV, blockB: blockB, breakable: breakable, parseMap: parseMap, genStage: genStage, solveMap: solveMap, params: params, mulberry32: mulberry32
  };
})(typeof window !== 'undefined' ? window : globalThis);
