/* КАТАКОМБЫ · логика (без DOM, детерминирована при заданном rng). KATAKOMBY.Game(opts), KATAKOMBY.logic
   Переделка 2026-11 — «Огненный обруч»: у обходчицы один бронзовый обруч. Брошенный, он рикошетит от стен,
   режет всех на пути и возвращается в руку. Обруч, окунутый в огонь (очаг или горящая чаша), горит 8 с:
   бьёт вдвое сильнее и зажигает холодные чаши. Свет чаш жжёт и замедляет тварей тьмы, лечит обходчицу и
   поднимает решётки рядом; когда горят все чаши этажа — печать спуска открыта. Твари поднимаются из темноты
   (не из логов); плевки гасят чаши. 8 этажей + Дымный Страж, который задувает чаши. Без DOM. */
(function (global) {
  'use strict';
  var K = global.KATAKOMBY = global.KATAKOMBY || {};

  // ---------- Константы ----------
  var T = 32;                          // клетка, px
  var VIEW_W = 960, HUD = 40, VIEW_H = 560, SCREEN_H = HUD + VIEW_H;
  var LEASH_PAD = 48;                  // кооп: пара всегда в кадре с этим отступом
  var CONTACT_CD = 0.6, AGGRO = 18;
  var AIM_CONE = 0.36, AIM_WIDE = 0.8;  // автоприцел броска, рад (≈20°; на тач-экране — шире, ≈46°)
  var HERO = { hp: 100, speed: 150, armor: 0, r: 10 };
  var HOOP = { speed: 440, back: 560, r: 7, bounces: 2, flight: 1.55, dmg: 1, hotMul: 2, catchR: 18 };
  var FLAME = 8;                       // сколько горит обруч, с
  var DIP_R = 52;                      // окунуть обруч в огонь, стоя рядом с горящей чашей, px
  var LIGHT_R = 3.5 * T;               // радиус света чаши
  var HEAL = 4, BURN = 1.2, LIGHT_SLOW = 0.45;
  var ENEMIES = {
    shade:   { hp: 1, r: 10, speed: 115, bite: 7, score: 10 },
    slime:   { hp: 3, r: 12, speed: 62, bite: 12, score: 20 },
    spitter: { hp: 2, r: 11, speed: 72, bite: 6, score: 30, spit: 8, spitCd: 2.2, spitSpeed: 175, range: 6 }
  };
  var PLACED = { s: 'shade', m: 'slime', x: 'spitter' };
  var UPG = ['bnc', 'spd', 'arm'], UPG_MAX = 4;
  var BOSS = { hp: 56, guard: 1.5, r: 30, speed: 48, bite: 10, ring: 9, ringCd: 3.4, ringCd2: 2.4, spawnCd: 7, spit: 6, ringSpeed: 135,
    hotDmg: 3, gustCd: 9, gustCd2: 6.5, gustWarn: 1.4, gustR: 7 * T };
  var SCORE = { chest: 150, lamp: 50, floor: 500, boss: 5000 };
  var MULT_MAX = 4;
  // Раскладка кооп-клавиатуры (g.usePlayers): И1 — стрелки, И2 — WASD
  var BIND = {
    p1: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], fire: ['Slash', 'NumpadDivide', 'Period', 'Space'] },
    p2: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], fire: ['KeyF', 'ShiftLeft'] }
  };
  var MIX = [   // кто поднимается из тьмы на этаже (веса)
    { shade: 1 }, { shade: 3, slime: 1 }, { shade: 3, slime: 2, spitter: 1 }, { shade: 3, slime: 2, spitter: 1 },
    { shade: 3, slime: 2, spitter: 2 }, { shade: 3, slime: 2, spitter: 2 }, { shade: 3, slime: 2, spitter: 1 }, { shade: 2, slime: 2, spitter: 2 },
    { shade: 1 }
  ];

  // ---------- Карты (ручной работы). # стена · . пол · S старт · F очаг (горит всегда) · L чаша (холодная) ·
  // E печать спуска (откроется, когда горят все чаши) · D решётка (обруч пролетает; поднимается, когда горят
  // все чаши в 2 клетках от неё) · $ ларец (разбить обручем) · s/m/x тень/слизень/плевун · B Дымный Страж ----------
  var FLOORS = [
    { name: 'vestibule', map: [
      '########################################',
      '#S.....#.......................#.......#',
      '#..F...#.......................#...$...#',
      '#......#.......................#.......#',
      '#..........s.........L.........D.L.E...#',
      '#......#.......................#.......#',
      '#......#.......................#.......#',
      '####.###########..##############.......#',
      '#......#...........#...........#########',
      '#......#...........#.......L...#.......#',
      '#......#.....s.....#...........#...$...#',
      '#..........................s...........#',
      '#......#...........#...........#.......#',
      '#......#.....L.....#.....$.....#.......#',
      '#......#...........#...........#.......#',
      '########################################'
    ] },
    { name: 'storerooms', map: [
      '########################################',
      '#.....#.........#..........#...........#',
      '#.$...#....L....#..........#....$......#',
      '#.....#.........#..........D.L.........#',
      '#.....#.........#..........#.....E.....#',
      '#.....##.#####.###.######.##...........#',
      '#...F..................................#',
      '#..S.........s.........m........s......#',
      '#......................................#',
      '###.#####.######.####.#####.####.#######',
      '#.....#.........#.........#.....#......#',
      '#.....#....m....#....L....#.....#......#',
      '#.....#.........#.........#.....#......#',
      '#.....D.L.......#.........#.....D.L....#',
      '#.....#....$....#....$....#.....#..$...#',
      '########################################'
    ] },
    { name: 'wells', map: [
      '########################################',
      '#S..F..................................#',
      '#..##....##....##....##....##....##....#',
      '#..##....##....##....##....##....##....#',
      '#......................................#',
      '#......s......m..........s.............#',
      '#..##....##....##....##....##....##....#',
      '#..##....##....##....##....##....##....#',
      '#.........L...............L............#',
      '#......................................#',
      '#..##....##....##....##....##....##....#',
      '#..##....##....##....##....##....##....#',
      '#................L......$..............#',
      '#......................................#',
      '###############DDDD#####################',
      '#..............#..#....................#',
      '#..$...........#..#........L...........#',
      '#..............#..#....................#',
      '#.......E..........m.......$...........#',
      '#..............#..#....................#',
      '########################################'
    ] },
    { name: 'maze', map: [
      '########################################',
      '#S...#.........#.........#.............#',
      '#..F.#.#######.#.#######.#.#########.#.#',
      '#....#.#.....#...#.....#...#.....#...#.#',
      '#....#.#.$...#####..L..#####..m..#.###.#',
      '#....#.#.....#.....................#...#',
      '###.##.###.###.#######.#######.#####.###',
      '#......#.....#.#.....#.#.....#.#.......#',
      '#.####.#..s..#.#.....#.#..s..#.#.#####.#',
      '#.#..#.#.....#.#.....#.#.....#.#.#...#.#',
      '#.#L.#.##.####.###.###.###.###.#.#.L$#.#',
      '#.#..#...........................#...#.#',
      '#.##.#######.#########.#########.##D##.#',
      '#......$.....#.......#.#.......#.......#',
      '######.#######.......#.#.......#######.#',
      '#............#.......#.#.......#.......#',
      '#............D.L.....#.........D.L.E...#',
      '#............#.......#.#.......#.......#',
      '########################################'
    ] },
    { name: 'barracks', map: [
      '########################################',
      '#......#......#......#......#......#...#',
      '#..m...#..s...#..$...#..m...#..s...#.$.#',
      '#......#......#......#......#......#L..#',
      '#......#......#......#......#......#...#',
      '###.######.######.######.######.####D###',
      '#......................................#',
      '#.S.F..............L...................#',
      '#......................................#',
      '###.######.######.######.######.####.###',
      '#......#......#......#......#......#...#',
      '#......#..L...#......#..x...#......#...#',
      '#......#......#......#......#.L....#...#',
      '#......#......#......#......#......#...#',
      '############################DD##########',
      '#......................................#',
      '#..$......m.L.....s.......E........$...#',
      '#......................................#',
      '########################################'
    ] },
    { name: 'bridges', map: [
      '########################################',
      '#S.....#################################',
      '#..F...#...................#...........#',
      '#..........................D.....L.....#',
      '#......#...................#.L.........#',
      '###.####.##########.########...........#',
      '###.####.##########.########...$.......#',
      '###.####.##########.##########.#########',
      '#........#.................#.......#####',
      '#..L.....#..........L......#.......#####',
      '#........#.................#.......#####',
      '####.#######.##################.########',
      '####.#######.##################.########',
      '#......$.....#.........................#',
      '#.......s..L.D.....m.....L.........E...#',
      '#............#.........................#',
      '########################################'
    ] },
    { name: 'hive', map: [
      '########################################',
      '#S........#.............#..............#',
      '#..F......#.............#.....L........#',
      '#.........#.....s.......#..............#',
      '#.........#.............#.......$......#',
      '#......................................#',
      '#.........#.............#..............#',
      '#####..####.....L.......####..##########',
      '#.........#.............#..............#',
      '#..L......#.............#.......L......#',
      '#.........#####..########..............#',
      '#.........#............................#',
      '#.........#.............#..............#',
      '#.........#.............#.....m.....L..#',
      '#.........#.............#..............#',
      '#####.#######.#############.##########D#',
      '#...................L.#................#',
      '#..$.....L............D.......x....E...#',
      '#.....................#................#',
      '########################################'
    ] },
    { name: 'vault', map: [
      '########################################',
      '#S.......#...............#.............#',
      '#..F.....#...............#.............#',
      '#........#...............#.............#',
      '#........D.L.............D.L...........#',
      '#........#...............#.............#',
      '#........#.......$.......#.............#',
      '#........#...............#.............#',
      '#####D######.###.###.########D##########',
      '#......#.....#.....#.....#.............#',
      '#....L.#.....#..L..#.....#...L$...$....#',
      '#......#.....#.....#.....#.............#',
      '#......D.L...#.....#...L.D.............#',
      '#......#.....#.....#.....#.......E.....#',
      '#......#.....#.....#..x..#.............#',
      '#......#.....#.....#.....#.............#',
      '########################################'
    ] },
    { name: 'lair', map: [
      '################################',
      '#..............................#',
      '#..L........................L..#',
      '#..............................#',
      '#.....##..............##.......#',
      '#.....##.......B......##.......#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#.....##..............##.......#',
      '#.....##..............##.......#',
      '#..L........................L..#',
      '#...........F..S...............#',
      '################################'
    ] }
  ];

  function parseFloor(map) {
    var H = map.length, W = map[0].length, grid = [], items = [], lamps = [], enemies = [], start = null, exit = null, boss = null;
    for (var y = 0; y < H; y++) {
      if (map[y].length !== W) throw new Error('КАТАКОМБЫ: строка ' + y + ' карты длиной ' + map[y].length + ' ≠ ' + W);
      for (var x = 0; x < W; x++) {
        var c = map[y][x], cell = '.';
        if (c === '#') cell = '#';
        else if (c === 'D') cell = 'D';
        else if (c === 'E') { cell = 'E'; exit = { tx: x, ty: y }; }
        else if (c === 'L' || c === 'F') { cell = 'L'; lamps.push({ tx: x, ty: y, hearth: c === 'F' }); }
        else if (c === 'S') start = { tx: x, ty: y };
        else if (c === 'B') boss = { tx: x, ty: y };
        else if (c === '$') items.push({ kind: 'chest', tx: x, ty: y });
        else if (PLACED[c]) enemies.push({ type: PLACED[c], tx: x, ty: y });
        else if (c !== '.') throw new Error('КАТАКОМБЫ: неизвестный символ карты «' + c + '»');
        grid.push(cell);
      }
    }
    if (!start) throw new Error('КАТАКОМБЫ: на карте нет старта S');
    return { W: W, H: H, grid: grid, items: items, lamps: lamps, enemies: enemies, start: start, exit: exit, boss: boss };
  }
  // Группы решёток: связные (4-соседи) клетки D; у группы — чаши в 2 клетках (Чебышёв) от любой её клетки
  function gateGroups(F) {
    var id = new Array(F.W * F.H).fill(-1), n = 0, lampsOf = [];
    for (var i = 0; i < id.length; i++) {
      if (F.grid[i] !== 'D' || id[i] >= 0) continue;
      var st = [i], cells = []; id[i] = n;
      while (st.length) {
        var j = st.pop(), x = j % F.W, y = (j / F.W) | 0; cells.push([x, y]);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var nx = x + d[0], ny = y + d[1], k = ny * F.W + nx;
          if (nx >= 0 && ny >= 0 && nx < F.W && ny < F.H && F.grid[k] === 'D' && id[k] < 0) { id[k] = n; st.push(k); }
        });
      }
      var ls = [];
      F.lamps.forEach(function (l, li) { if (cells.some(function (c) { return Math.max(Math.abs(c[0] - l.tx), Math.abs(c[1] - l.ty)) <= 2; })) ls.push(li); });
      lampsOf.push(ls); n++;
    }
    return { id: id, count: n, lamps: lampsOf };
  }
  // Прямая видимость по клеткам (для решателя и бота): обруч пролетает пол, решётки, печать; стены и чужие чаши — нет
  function losCells(F, x0, y0, x1, y1, grid) {
    grid = grid || F.grid;
    var ax = x0 + 0.5, ay = y0 + 0.5, bx = x1 + 0.5, by = y1 + 0.5, len = Math.hypot(bx - ax, by - ay), n = Math.ceil(len * 8);
    if (len < 0.01) return true;
    var px = -(by - ay) / len * 0.25, py = (bx - ax) / len * 0.25;   // три параллельных луча: обруч не точка
    for (var w = -1; w <= 1; w++) for (var i = 1; i < n; i++) {
      var tx = Math.floor(ax + (bx - ax) * i / n + px * w), ty = Math.floor(ay + (by - ay) * i / n + py * w);
      if (tx === x1 && ty === y1) break;
      var c = grid[ty * F.W + tx]; if (c === '#' || c === 'L') return false;
    }
    return true;
  }
  var SOLVE = { reach: 9, budget: 24 };   // бросок — до 9 клеток по прямой; огонь донести — до 24 клеток пути
  // Проходимость этажа: можно ли зажечь все чаши (огонь несут от горящей чаши к месту броска, решётки
  // поднимаются по мере зажигания) и дойти до печати (на этаже Стража — зажечь все чаши).
  function solveFloor(map) {
    var F = parseFloor(map), G = gateGroups(F), lit = F.lamps.map(function (l) { return l.hearth; }), N = F.W * F.H, rounds = 0;
    var badGate = G.lamps.findIndex(function (ls) { return !ls.length; });
    function open(g) { return G.lamps[g].every(function (li) { return lit[li]; }); }
    function region() {
      var seen = new Int16Array(N).fill(-1), s = F.start.ty * F.W + F.start.tx, st = [s]; seen[s] = 0;
      for (var qi = 0; qi < st.length; qi++) {
        var j = st[qi], x = j % F.W, y = (j / F.W) | 0;
        for (var d = 0; d < 4; d++) {
          var nx = x + [1, -1, 0, 0][d], ny = y + [0, 0, 1, -1][d], k = ny * F.W + nx;
          if (nx < 0 || ny < 0 || nx >= F.W || ny >= F.H || seen[k] >= 0) continue;
          var c = F.grid[k]; if (c === '#' || c === 'L') continue;
          if (c === 'D' && !open(G.id[k])) continue;
          seen[k] = 0; st.push(k);
        }
      }
      return seen;
    }
    var changed = true;
    while (changed) {
      changed = false; rounds++;
      var R = region(), D = new Int16Array(N).fill(-1), q = [];
      for (var i = 0; i < N; i++) if (R[i] >= 0) {
        var x = i % F.W, y = (i / F.W) | 0;
        if (F.lamps.some(function (l, li) { return lit[li] && Math.max(Math.abs(l.tx - x), Math.abs(l.ty - y)) <= 1; })) { D[i] = 0; q.push(i); }
      }
      for (var qi = 0; qi < q.length; qi++) {
        var j = q[qi], jx = j % F.W, jy = (j / F.W) | 0;
        for (var d = 0; d < 4; d++) { var k = (jy + [0, 0, 1, -1][d]) * F.W + jx + [1, -1, 0, 0][d]; if (R[k] >= 0 && D[k] < 0) { D[k] = D[j] + 1; q.push(k); } }
      }
      F.lamps.forEach(function (l, li) {
        if (lit[li]) return;
        for (var c = 0; c < N; c++) {
          if (D[c] < 0 || D[c] > SOLVE.budget) continue;
          var cx = c % F.W, cy = (c / F.W) | 0;
          if (Math.hypot(cx - l.tx, cy - l.ty) <= SOLVE.reach && losCells(F, cx, cy, l.tx, l.ty)) { lit[li] = true; changed = true; return; }
        }
      });
    }
    var Rf = region(), allLit = lit.every(Boolean);
    var target = F.boss || F.exit, reach = target ? Rf[target.ty * F.W + target.tx] >= 0 : false;
    return { ok: allLit && reach && badGate < 0, lit: lit, unlit: F.lamps.filter(function (l, li) { return !lit[li]; }), reach: reach, badGate: badGate, rounds: rounds, gates: G.count };
  }

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function norm(x, y) { var l = Math.hypot(x, y); return l ? { x: x / l, y: y / l } : { x: 0, y: 0 }; }
  // Параметры этажа: тьма рождает тварей чаще к глубине; вдвоём — чаще и толще
  function params(floor, players) {
    var co = players === 2;
    return {
      speedMul: 1 + 0.04 * (floor - 1),
      spawnCd: Math.max(1.1, 3.4 - 0.3 * (floor - 1)) * (co ? 0.7 : 1),
      cap: Math.round(Math.min(15, 5 + floor) * (co ? 1.4 : 1)),
      biteMul: 1 + 0.09 * (floor - 1),
      hpMul: co ? 1.5 : 1,
      bossHp: Math.round(BOSS.hp * (co ? 2.2 : 1))
    };
  }
  function heroStats(h) {
    return {
      speed: HERO.speed * (1 + 0.1 * h.up.spd),
      bounces: HOOP.bounces + h.up.bnc,
      armor: Math.min(0.5, HERO.armor + 0.08 * h.up.arm),
      maxHp: HERO.hp + 10 * h.up.arm
    };
  }

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, emit = opts.onEvent || function () {};
    var players = opts.players === 2 ? 2 : 1, maxFloor = opts.maxFloor || FLOORS.length;
    var S = {
      floor: opts.floor || 1, maxFloor: maxFloor, players: players, score: 0,
      phase: 'play', phaseT: 0, time: 0, over: false, won: false, banner: 0, name: '', tip: null, tut: false,
      heroes: [], enemies: [], lamps: [], boss: null, spits: [], items: [], rises: [], grid: [], W: 0, H: 0,
      cam: { x: 0, y: 0 }, exit: null, sealOpen: false, flowT: 0, spawnT: 0, upCursor: [0, 0], upDone: [false, false],
      litCount: 0, lampCount: 0, best: 0, done: { thrown: false, dipped: false, lit: false }
    };
    var flow = null, groups = null, lampAt = [], prm = params(S.floor, players), wide = !!opts.wideAim;
    var ctl = [{ dx: 0, dy: 0, fire: false, pfire: false, pdy: 0 }, { dx: 0, dy: 0, fire: false, pfire: false, pdy: 0 }];

    for (var i = 0; i < players; i++) {
      var h = { id: i, x: 0, y: 0, r: HERO.r, alive: true, up: { bnc: 0, spd: 0, arm: 0 }, face: { x: 1, y: 0 },
        hurtT: 0, moving: false, leashed: false, deaths: 0,
        hoop: { state: 'held', x: 0, y: 0, vx: 0, vy: 0, t: 0, bounces: 0, hot: 0, hits: [], spin: 0 } };
      h.hp = heroStats(h).maxHp; S.heroes.push(h);
    }

    // --- клетки ---
    function cell(tx, ty) { return (tx < 0 || ty < 0 || tx >= S.W || ty >= S.H) ? '#' : S.grid[ty * S.W + tx]; }
    function solidBody(tx, ty) { var c = cell(tx, ty); return c === '#' || c === 'D' || c === 'L'; }
    function solidHoop(tx, ty) { var c = cell(tx, ty); return c === '#' || c === 'L'; }
    function hitTile(x, y, r, solid) {
      var x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r - 0.001) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r - 0.001) / T);
      for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) if (solid(tx, ty)) return { tx: tx, ty: ty };
      return null;
    }
    function moveBody(b, dx, dy, solid) {
      var steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4)), sx = dx / steps, sy = dy / steps, blocked = false;
      for (var s = 0; s < steps; s++) {
        if (sx) { if (!hitTile(b.x + sx, b.y, b.r, solid)) b.x += sx; else { blocked = true; if (!sy) nudge(b, 'y', sx, solid); } }
        if (sy) { if (!hitTile(b.x, b.y + sy, b.r, solid)) b.y += sy; else { blocked = true; if (!sx) nudge(b, 'x', sy, solid); } }
      }
      return blocked;
    }
    function nudge(b, axis, push, solid) {   // «обтекание» углов: рядом (≤12 px) свободный проход — подвинуть к нему
      for (var off = 1; off <= 12; off++) for (var sg = -1; sg <= 1; sg += 2) {
        var nx = axis === 'x' ? b.x + sg * off : b.x, ny = axis === 'y' ? b.y + sg * off : b.y;
        var px = axis === 'x' ? 0 : push, py = axis === 'y' ? 0 : push;
        if (!hitTile(nx, ny, b.r, solid) && !hitTile(nx + px, ny + py, b.r, solid)) {
          if (axis === 'x') b.x += sg * Math.min(1.5, off); else b.y += sg * Math.min(1.5, off);
          return;
        }
      }
    }
    function lampOf(tx, ty) { return lampAt[ty * S.W + tx] || null; }
    function inLight(x, y) { for (var i = 0; i < S.lamps.length; i++) { var l = S.lamps[i]; if (l.lit && dist(x, y, l.x, l.y) <= LIGHT_R) return true; } return false; }

    // --- чаши, решётки, печать ---
    function lightLamp(l, pi) {
      if (l.lit) return;
      l.lit = true; l.flash = 0.6; S.score += SCORE.lamp; S.done.lit = true;
      emit('light', { x: l.x, y: l.y, pi: pi });
      checkGates(); countLit();
    }
    function snuffLamp(l, src) {
      if (!l.lit || l.hearth) return false;
      l.lit = false; l.flash = 0.5; countLit(); emit('snuff', { x: l.x, y: l.y, src: src });
      return true;
    }
    function countLit() {
      S.litCount = S.lamps.filter(function (l) { return l.lit; }).length;
      if (!S.sealOpen && S.exit && S.litCount === S.lampCount) { S.sealOpen = true; emit('seal', { x: S.exit.x, y: S.exit.y }); }
    }
    function checkGates() {
      for (var g = 0; g < groups.count; g++) {
        if (groups.open[g]) continue;
        if (!groups.lamps[g].length || !groups.lamps[g].every(function (li) { return S.lamps[li].lit; })) continue;
        groups.open[g] = true;
        var cx = 0, cy = 0, n = 0;
        for (var i = 0; i < S.grid.length; i++) if (groups.id[i] === g) { S.grid[i] = '.'; cx += i % S.W; cy += (i / S.W) | 0; n++; }
        S.flowT = 0; emit('gate', { x: (cx / n) * T + T / 2, y: (cy / n) * T + T / 2 });
      }
    }

    // --- этаж ---
    function loadFloor(n) {
      var F = parseFloor(FLOORS[n - 1].map);
      S.floor = n; S.name = FLOORS[n - 1].name; prm = params(n, S.players);
      S.W = F.W; S.H = F.H; S.grid = F.grid.slice(); groups = gateGroups(F); groups.open = new Array(groups.count).fill(false);
      S.lamps = F.lamps.map(function (l) { return { tx: l.tx, ty: l.ty, x: l.tx * T + T / 2, y: l.ty * T + T / 2, hearth: l.hearth, lit: l.hearth, flash: 0 }; });
      lampAt = new Array(S.W * S.H); S.lamps.forEach(function (l) { lampAt[l.ty * S.W + l.tx] = l; });
      S.lampCount = S.lamps.length; S.sealOpen = false;
      S.items = F.items.map(function (it) { return { kind: it.kind, tx: it.tx, ty: it.ty, x: it.tx * T + T / 2, y: it.ty * T + T / 2, taken: false }; });
      S.enemies = []; S.rises = []; F.enemies.forEach(function (e) { spawnEnemy(e.type, e.tx * T + T / 2, e.ty * T + T / 2); });
      S.exit = F.exit ? { tx: F.exit.tx, ty: F.exit.ty, x: F.exit.tx * T + T / 2, y: F.exit.ty * T + T / 2 } : null;
      S.boss = F.boss ? { x: F.boss.tx * T + T / 2, y: F.boss.ty * T + T / 2, r: BOSS.r, hp: prm.bossHp, max: prm.bossHp, ringT: 2.6, spawnT: 5, gustT: BOSS.gustCd, flash: 0, biteCd: 0, dead: false, deadT: 0, wob: 0 } : null;
      S.spits = []; flow = null; S.flowT = 0; S.spawnT = 3 + prm.spawnCd;
      S.tut = n === 1 && !opts.noTutorial; S.tip = S.tut ? 'tip_throw' : null;
      countLit();
      var sx = F.start.tx, sy = F.start.ty, spots = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]], k = 0;
      S.heroes.forEach(function (h) {
        while (k < spots.length && cell(sx + spots[k][0], sy + spots[k][1]) !== '.') k++;
        var p = spots[Math.min(k, spots.length - 1)]; k++;
        h.x = (sx + p[0]) * T + T / 2; h.y = (sy + p[1]) * T + T / 2;
        var st = heroStats(h);
        if (!h.alive) { h.alive = true; h.hp = Math.round(st.maxHp * 0.5); emit('revive', { pi: h.id }); }
        else if (F.boss) h.hp = st.maxHp;
        else if (n > 1) h.hp = Math.min(st.maxHp, h.hp + 25);
        h.hurtT = 0; h.face = { x: 1, y: 0 };
        var o = h.hoop; o.state = 'held'; o.hot = 0; o.hits = []; o.bounces = 0;
      });
      S.phase = 'play'; S.phaseT = 0; S.banner = 2.2;
      updateCam(true);
      emit('floor', { floor: n, boss: !!S.boss });
    }

    function spawnEnemy(type, x, y) {
      var E = ENEMIES[type];
      var e = { id: ++uid, type: type, x: x, y: y, r: E.r, hp: E.hp * prm.hpMul, max: E.hp * prm.hpMul, biteCd: 0.4, spitT: E.spitCd ? 1 + rng() * E.spitCd : 0, flash: 0, wob: rng() * 6.28, vx: 0, vy: 0, lit: false };
      S.enemies.push(e); return e;
    }
    var uid = 0;

    // --- поле потока (BFS от живых героев) ---
    function buildFlow() {
      var n = S.W * S.H; if (!flow || flow.length !== n) flow = new Int16Array(n);
      flow.fill(-1); var q = new Int32Array(n), qh = 0, qt = 0;
      S.heroes.forEach(function (h) { if (!h.alive) return; var k = Math.floor(h.y / T) * S.W + Math.floor(h.x / T); if (flow[k] < 0) { flow[k] = 0; q[qt++] = k; } });
      while (qh < qt) {
        var j = q[qh++], x = j % S.W, y = (j / S.W) | 0, d = flow[j];
        if (d >= AGGRO + 4) continue;
        for (var i = 0; i < 4; i++) {
          var nx = x + [1, -1, 0, 0][i], ny = y + [0, 0, 1, -1][i], k = ny * S.W + nx;
          if (nx < 0 || ny < 0 || nx >= S.W || ny >= S.H || flow[k] >= 0 || solidBody(nx, ny)) continue;
          flow[k] = d + 1; q[qt++] = k;
        }
      }
    }
    function flowAt(tx, ty) { return (tx < 0 || ty < 0 || tx >= S.W || ty >= S.H) ? -1 : flow[ty * S.W + tx]; }
    function nearestHero(x, y) {
      var best = null, bd = 1e9;
      S.heroes.forEach(function (h) { if (!h.alive) return; var d = dist(x, y, h.x, h.y); if (d < bd) { bd = d; best = h; } });
      return best ? { h: best, d: bd } : null;
    }

    // --- урон ---
    function hurtHero(h, dmg, src) {
      if (!h.alive) return;
      var d = dmg * (1 - heroStats(h).armor);
      h.hp -= d; h.hurtT = 0.25; emit('hurt', { pi: h.id, dmg: d, x: h.x, y: h.y, src: src });
      if (h.hp <= 0) killHero(h);
    }
    function killHero(h) {
      h.hp = 0; h.alive = false; h.deaths++; h.hoop.state = 'held'; h.hoop.hot = 0;
      emit('heroDie', { pi: h.id, x: h.x, y: h.y });
      if (!S.heroes.some(function (o) { return o.alive; })) { S.phase = 'dying'; S.phaseT = 0; }
      S.flowT = 0;
    }
    function hitEnemy(e, dmg, src, mult) {
      if (e.hp <= 0) return;
      e.hp -= dmg; e.flash = 0.12;
      if (e.hp <= 0) {
        var m = Math.max(1, Math.min(MULT_MAX, mult || 1)), pts = ENEMIES[e.type].score * m;
        S.score += pts; emit('kill', { type: e.type, x: e.x, y: e.y, src: src, mult: m, pts: pts });
      } else emit('hit', { x: e.x, y: e.y });
    }
    function hitBoss(o, pi) {
      var B = S.boss; if (!B || B.dead) return false;
      if (o.hot <= 0 || B.guardT > 0) { emit('clang', { x: o.x, y: o.y }); return true; }
      o.hot = 0; B.hp -= BOSS.hotDmg; B.flash = 0.15; B.guardT = BOSS.guard;
      if (B.hp <= 0) { B.hp = 0; B.dead = true; B.deadT = 0; S.score += SCORE.boss; emit('bossDie', { x: B.x, y: B.y }); S.spits = []; S.rises = []; S.enemies.forEach(function (e) { e.hp = 0; }); }
      else emit('bossHit', { x: B.x, y: B.y, hp: B.hp, pi: pi });
      return true;
    }

    // --- обруч ---
    // Мягкий автоприцел: ближайшая цель в конусе ±AIM_CONE от взгляда — тварь, Страж, ларец, а горящим обручем и холодная чаша
    function aimAssist(h) {
      var best = null, bs = 1e9, fx = h.face.x, fy = h.face.y, hot = h.hoop.hot > 0, range = 9 * T, cone = Math.cos(wide ? AIM_WIDE : AIM_CONE);
      function consider(x, y, w) {
        var dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy); if (d < 1 || d > range) return;
        var cos = (dx * fx + dy * fy) / d; if (cos < cone) return;
        if (!clearLine(h.x, h.y, x, y)) return;
        var s = d * (2 - cos) * w; if (s < bs) { bs = s; best = { x: dx / d, y: dy / d }; }
      }
      S.enemies.forEach(function (e) { if (e.hp > 0) consider(e.x, e.y, 1); });
      if (hot) S.lamps.forEach(function (l) { if (!l.lit) consider(l.x, l.y, 0.8); });
      if (S.boss && !S.boss.dead) consider(S.boss.x, S.boss.y, hot ? 0.7 : 1.4);
      S.items.forEach(function (it) { if (!it.taken) consider(it.x, it.y, 1.3); });
      return best || { x: fx, y: fy };
    }
    function clearLine(x0, y0, x1, y1) {
      var n = Math.ceil(dist(x0, y0, x1, y1) / 8), tx1 = Math.floor(x1 / T), ty1 = Math.floor(y1 / T);
      for (var i = 1; i < n; i++) {
        var tx = Math.floor((x0 + (x1 - x0) * i / n) / T), ty = Math.floor((y0 + (y1 - y0) * i / n) / T);
        if (tx === tx1 && ty === ty1) return true;
        if (solidHoop(tx, ty)) return false;
      }
      return true;
    }
    function throwHoop(pi) {
      var h = S.heroes[pi]; if (S.phase !== 'play' || !h || !h.alive) return false;
      var o = h.hoop;
      if (o.state === 'fly') { o.state = 'back'; emit('recall', { pi: pi }); return true; }
      if (o.state !== 'held') return false;
      var a = aimAssist(h);
      o.state = 'fly'; o.x = h.x + a.x * 8; o.y = h.y + a.y * 8; o.vx = a.x * HOOP.speed; o.vy = a.y * HOOP.speed; o.t = 0; o.bounces = 0; o.hits = [];
      S.done.thrown = true;
      emit('throw', { pi: pi, hot: o.hot > 0 });
      return true;
    }
    function hoopTouch(h, o) {
      // твари: каждая — раз за отрезок полёта (после рикошета — снова)
      var dmg = HOOP.dmg * (o.hot > 0 ? HOOP.hotMul : 1);
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (e.hp <= 0 || o.hits.indexOf(e.id) >= 0) continue;
        if (dist(o.x, o.y, e.x, e.y) < e.r + HOOP.r) { o.hits.push(e.id); hitEnemy(e, dmg, h.id, 1 + o.bounces); }
      }
      for (var j = 0; j < S.items.length; j++) {
        var it = S.items[j]; if (it.taken || dist(o.x, o.y, it.x, it.y) > 15 + HOOP.r) continue;
        it.taken = true; S.score += SCORE.chest; emit('chest', { pi: h.id, x: it.x, y: it.y });
      }
      if (S.boss && !S.boss.dead && o.state === 'fly' && dist(o.x, o.y, S.boss.x, S.boss.y) < S.boss.r + HOOP.r) {
        hitBoss(o, h.id);
        var n = norm(o.x - S.boss.x, o.y - S.boss.y); o.vx = n.x * HOOP.speed; o.vy = n.y * HOOP.speed; o.x = S.boss.x + n.x * (S.boss.r + HOOP.r + 1); o.y = S.boss.y + n.y * (S.boss.r + HOOP.r + 1);
        bounce(h, o);
      }
    }
    function bounce(h, o) {
      o.bounces++; o.hits = [];
      if (o.bounces > heroStats(h).bounces) { o.state = 'back'; emit('spent', { pi: h.id }); }
      else emit('bounce', { x: o.x, y: o.y, n: o.bounces });
    }
    function touchLamp(h, o, tx, ty) {
      var l = lampOf(tx, ty); if (!l) return;
      if (l.lit) { if (o.hot <= 0) emit('ignite', { pi: h.id, x: l.x, y: l.y }); o.hot = FLAME; S.done.dipped = true; }
      else if (o.hot > 0) lightLamp(l, h.id);
      else emit('clink', { x: l.x, y: l.y });
    }
    function updateHoop(h, dt) {
      var o = h.hoop, st = heroStats(h);
      o.spin += dt * (o.state === 'held' ? 3 : 18);
      if (o.hot > 0) { o.hot -= dt; if (o.hot <= 0) { o.hot = 0; emit('cool', { pi: h.id }); } }
      if (o.state === 'held') {
        o.x = h.x + h.face.x * 12; o.y = h.y + h.face.y * 12;
        for (var i = 0; i < S.lamps.length; i++) { var l = S.lamps[i]; if (l.lit && dist(h.x, h.y, l.x, l.y) < DIP_R) { if (o.hot <= 0) emit('ignite', { pi: h.id, x: l.x, y: l.y }); o.hot = FLAME; S.done.dipped = true; break; } }
        return;
      }
      var steps = Math.max(1, Math.ceil(HOOP.speed * dt / 4));
      for (var s = 0; s < steps && o.state !== 'held'; s++) {
        var sdt = dt / steps;
        if (o.state === 'fly') {
          o.t += sdt;
          var nx = o.x + o.vx * sdt, ny = o.y + o.vy * sdt, bx = false, by = false;
          var tx0 = Math.floor(o.x / T), ty0 = Math.floor(o.y / T), tx1 = Math.floor(nx / T), ty1 = Math.floor(ny / T);
          if (tx1 !== tx0 && solidHoop(tx1, ty0)) { bx = true; touchLamp(h, o, tx1, ty0); }
          if (ty1 !== ty0 && solidHoop(tx0, ty1)) { by = true; touchLamp(h, o, tx0, ty1); }
          if (!bx && !by && tx1 !== tx0 && ty1 !== ty0 && solidHoop(tx1, ty1)) { bx = by = true; touchLamp(h, o, tx1, ty1); }
          if (bx) o.vx = -o.vx; else o.x = nx;
          if (by) o.vy = -o.vy; else o.y = ny;
          if (bx || by) { bounce(h, o); if (o.state === 'fly') emit('rico', { x: o.x, y: o.y }); }
          if (o.state === 'fly' && o.t > HOOP.flight) { o.state = 'back'; }
        } else {   // возврат: прямо к руке, сквозь стены (как бросок «на себя»)
          var d = dist(o.x, o.y, h.x, h.y), sp = HOOP.back * (1 + 0.1 * h.up.spd) * sdt;
          if (d < HOOP.catchR || d <= sp) { o.state = 'held'; o.hits = []; emit('catch', { pi: h.id, hot: o.hot > 0 }); break; }
          o.x += (h.x - o.x) / d * sp; o.y += (h.y - o.y) / d * sp;
          var ltx = Math.floor(o.x / T), lty = Math.floor(o.y / T), lp = lampOf(ltx, lty);
          if (lp && lp.lit && o.hot <= 0) touchLamp(h, o, ltx, lty);
        }
        if (o.state !== 'held') hoopTouch(h, o);
      }
    }

    // --- камера и «поводок» ---
    function updateCam() {
      var live = S.heroes.filter(function (h) { return h.alive; }); if (!live.length) live = S.heroes;
      var mx = 0, my = 0; live.forEach(function (h) { mx += h.x; my += h.y; }); mx /= live.length; my /= live.length;
      var pw = S.W * T, ph = S.H * T;
      S.cam.x = pw <= VIEW_W ? (pw - VIEW_W) / 2 : Math.max(0, Math.min(pw - VIEW_W, mx - VIEW_W / 2));
      S.cam.y = ph <= VIEW_H ? (ph - VIEW_H) / 2 : Math.max(0, Math.min(ph - VIEW_H, my - VIEW_H / 2));
    }
    function leashSpan(h) { return { w: VIEW_W - 2 * LEASH_PAD - 2 * h.r, h: VIEW_H - 2 * LEASH_PAD - 2 * h.r }; }
    function leash(h, ox, oy) {
      if (S.players < 2) return;
      var o = S.heroes[1 - h.id]; if (!o || !o.alive || !h.alive) return;
      var L = leashSpan(h);
      if (Math.abs(h.x - o.x) > L.w && Math.abs(h.x - o.x) > Math.abs(ox - o.x)) { h.x = ox; h.leashed = true; }
      if (Math.abs(h.y - o.y) > L.h && Math.abs(h.y - o.y) > Math.abs(oy - o.y)) { h.y = oy; h.leashed = true; }
    }

    // --- обновление ---
    function updateHeroes(dt) {
      S.heroes.forEach(function (h) {
        if (!h.alive) return;
        var c = ctl[h.id], st = heroStats(h);
        h.hurtT -= dt; h.leashed = false;
        var m = Math.min(1, Math.hypot(c.dx, c.dy)), n = norm(c.dx, c.dy); h.moving = m > 0.05;
        if (h.moving) h.face = n;
        var ox = h.x, oy = h.y;
        moveBody(h, n.x * m * st.speed * dt, n.y * m * st.speed * dt, solidBody);
        leash(h, ox, oy);
        if (c.fire && !c.pfire) throwHoop(h.id);
        if (inLight(h.x, h.y) && h.hp < st.maxHp) h.hp = Math.min(st.maxHp, h.hp + HEAL * dt);
        updateHoop(h, dt);
        if (S.exit && S.sealOpen && S.phase === 'play' && dist(h.x, h.y, S.exit.x, S.exit.y) < 14 + h.r) floorClear();
      });
    }
    function floorClear() {
      S.phase = 'clear'; S.phaseT = 0; S.score += SCORE.floor * S.floor; S.spits = []; S.rises = [];
      S.heroes.forEach(function (h) { h.hoop.state = 'held'; });
      emit('clear', { floor: S.floor, bonus: SCORE.floor * S.floor });
    }
    function updateEnemies(dt) {
      S.flowT -= dt; if (!flow || S.flowT <= 0) { buildFlow(); S.flowT = 0.25; }
      var list = S.enemies;
      for (var i = 0; i < list.length; i++) {
        var e = list[i]; if (e.hp <= 0) continue;
        var E = ENEMIES[e.type], spd = E.speed * prm.speedMul;
        e.flash -= dt; e.biteCd -= dt; e.wob += dt * 4;
        e.lit = inLight(e.x, e.y);
        if (e.lit) { spd *= LIGHT_SLOW; e.hp -= BURN * dt; if (e.hp <= 0) { S.score += ENEMIES[e.type].score; emit('kill', { type: e.type, x: e.x, y: e.y, src: 'light', mult: 1, pts: ENEMIES[e.type].score }); continue; } }
        var near = nearestHero(e.x, e.y); if (!near) continue;
        var tx = Math.floor(e.x / T), ty = Math.floor(e.y / T), d0 = flowAt(tx, ty), want = null;
        if (d0 >= 0 && d0 <= 1) want = { x: near.h.x, y: near.h.y };
        else if (d0 > 1 && d0 <= AGGRO) {
          var best = d0, bx = 0, by = 0;
          for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
            if (!ox && !oy) continue;
            if (ox && oy && (solidBody(tx + ox, ty) || solidBody(tx, ty + oy))) continue;
            var f = flowAt(tx + ox, ty + oy); if (f >= 0 && f < best) { best = f; bx = ox; by = oy; }
          }
          if (best < d0) want = { x: (tx + bx) * T + T / 2, y: (ty + by) * T + T / 2 };
        }
        var mvx = 0, mvy = 0;
        if (E.spit && near.d < E.range * T && d0 >= 0) {   // плевун держит дистанцию и плюёт прицельно
          if (near.d < 3.5 * T) { var aw = norm(e.x - near.h.x, e.y - near.h.y); mvx = aw.x; mvy = aw.y; }
          want = null;
          e.spitT -= dt;
          if (e.spitT <= 0) {
            e.spitT = E.spitCd / prm.speedMul; var a = norm(near.h.x - e.x, near.h.y - e.y);
            S.spits.push({ x: e.x, y: e.y, vx: a.x * E.spitSpeed, vy: a.y * E.spitSpeed, dmg: E.spit * prm.biteMul, t: 3, r: 5 });
            emit('spit', { x: e.x, y: e.y });
          }
        }
        if (want) { var w = norm(want.x - e.x, want.y - e.y); mvx = w.x; mvy = w.y; }
        else if (!mvx && !mvy && d0 < 0) { mvx = Math.cos(e.wob * 0.3) * 0.25; mvy = Math.sin(e.wob * 0.23) * 0.25; }
        e.vx = mvx; e.vy = mvy;
        moveBody(e, mvx * spd * dt, mvy * spd * dt, solidBody);
        S.heroes.forEach(function (h) {
          if (!h.alive) return;
          var d = dist(e.x, e.y, h.x, h.y), m = e.r + h.r;
          if (d < m) {
            if (e.biteCd <= 0) { e.biteCd = CONTACT_CD; hurtHero(h, E.bite * prm.biteMul, e.type); }
            var p = norm(e.x - h.x, e.y - h.y); if (!p.x && !p.y) p = { x: 1, y: 0 };
            moveBody(e, p.x * (m - d), p.y * (m - d), solidBody);
          }
        });
      }
      for (var a2 = 0; a2 < list.length; a2++) for (var b = a2 + 1; b < list.length; b++) {
        var A = list[a2], Bb = list[b]; if (A.hp <= 0 || Bb.hp <= 0) continue;
        var dx = Bb.x - A.x, dy = Bb.y - A.y, dd = Math.hypot(dx, dy), mm = A.r + Bb.r - 4;
        if (dd < mm && dd > 0.01) { var push = (mm - dd) / 2, ux = dx / dd, uy = dy / dd; moveBody(A, -ux * push, -uy * push, solidBody); moveBody(Bb, ux * push, uy * push, solidBody); }
      }
      S.enemies = list.filter(function (e) { return e.hp > 0; });
    }
    // Твари поднимаются из темноты: клетка пола вне света, в 5–11 клетках от героя, достижимая; 0,8 с «вздымается» (видно заранее)
    function pickKind() {
      var mix = MIX[Math.min(MIX.length - 1, S.floor - 1)], sum = 0, k; for (k in mix) sum += mix[k];
      var r = rng() * sum; for (k in mix) { r -= mix[k]; if (r <= 0) return k; } return 'shade';
    }
    function updateSpawns(dt) {
      for (var i = 0; i < S.rises.length; i++) {
        var R = S.rises[i]; R.t -= dt;
        if (R.t <= 0) { if (!inLight(R.x, R.y)) { spawnEnemy(R.kind, R.x, R.y); emit('spawn', { kind: R.kind, x: R.x, y: R.y }); } else emit('fizzle', { x: R.x, y: R.y }); }
      }
      S.rises = S.rises.filter(function (R) { return R.t > 0; });
      if (S.tut && !S.done.lit) return;            // обучение: пока не зажжена первая чаша — тьма молчит
      if (S.boss) return;                          // у Стража — свои тени
      S.spawnT -= dt; if (S.spawnT > 0) return;
      S.spawnT = prm.spawnCd * (0.8 + rng() * 0.4);
      if (S.enemies.length + S.rises.length >= prm.cap) return;
      if (!flow) buildFlow();
      var live = S.heroes.filter(function (h) { return h.alive; }); if (!live.length) return;
      var h = live[(rng() * live.length) | 0];
      for (var tries = 0; tries < 30; tries++) {
        var a = rng() * Math.PI * 2, r = (5 + rng() * 6) * T, x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r;
        var tx = Math.floor(x / T), ty = Math.floor(y / T);
        if (cell(tx, ty) !== '.' || flowAt(tx, ty) < 0) continue;
        x = tx * T + T / 2; y = ty * T + T / 2;
        if (inLight(x, y) || live.some(function (o) { return dist(o.x, o.y, x, y) < 5 * T; })) continue;
        var kind = pickKind(); S.rises.push({ x: x, y: y, kind: kind, t: 0.8 }); emit('rise', { kind: kind, x: x, y: y });
        return;
      }
    }
    function updateBoss(dt) {
      var B = S.boss; if (!B) return;
      if (B.dead) { B.deadT += dt; if (B.deadT > 2.2 && S.phase === 'play') { S.phase = 'won'; S.phaseT = 0; } return; }
      B.flash -= dt; B.biteCd -= dt; B.wob += dt; B.guardT = Math.max(0, (B.guardT || 0) - dt);
      var near = nearestHero(B.x, B.y); if (!near) return;
      var rage = B.hp < B.max / 2, w = norm(near.h.x - B.x, near.h.y - B.y), sp = BOSS.speed * (rage ? 1.3 : 1);
      if (B.gustT > BOSS.gustWarn && near.d > B.r + near.h.r + 4) moveBody(B, w.x * sp * dt, w.y * sp * dt, solidBody);
      B.ringT -= dt;
      if (B.ringT <= 0) {
        B.ringT = rage ? BOSS.ringCd2 : BOSS.ringCd;
        var n = BOSS.ring + (rage ? 4 : 0), off = B.wob;
        for (var i = 0; i < n; i++) { var a = off + i * Math.PI * 2 / n; S.spits.push({ x: B.x, y: B.y, vx: Math.cos(a) * BOSS.ringSpeed, vy: Math.sin(a) * BOSS.ringSpeed, dmg: BOSS.spit, t: 4, r: 6 }); }
        emit('ring', { x: B.x, y: B.y });
      }
      // «выдох»: набухает (BOSS.gustWarn с) — и задувает горящие чаши вокруг, отталкивает героев
      B.gustT -= dt;
      if (B.gustT <= 0) {
        B.gustT = rage ? BOSS.gustCd2 : BOSS.gustCd;
        S.lamps.forEach(function (l) { if (dist(l.x, l.y, B.x, B.y) <= BOSS.gustR) snuffLamp(l, 'gust'); });
        S.heroes.forEach(function (h) { if (!h.alive) return; var d = dist(h.x, h.y, B.x, B.y); if (d < BOSS.gustR) { var p = norm(h.x - B.x, h.y - B.y); moveBody(h, p.x * 60, p.y * 60, solidBody); } h.hoop.hot = 0; });
        emit('gust', { x: B.x, y: B.y });
      }
      B.spawnT -= dt;
      if (B.spawnT <= 0) {
        B.spawnT = BOSS.spawnCd;
        if (S.enemies.length < 8) for (var k = 0; k < 2; k++) {
          var a2 = rng() * Math.PI * 2, x = B.x + Math.cos(a2) * (B.r + 16), y = B.y + Math.sin(a2) * (B.r + 16);
          if (!hitTile(x, y, 10, solidBody)) { spawnEnemy('shade', x, y); emit('spawn', { kind: 'shade', x: x, y: y }); }
        }
      }
      S.heroes.forEach(function (h) {
        if (!h.alive) return; var d = dist(B.x, B.y, h.x, h.y), m = B.r + h.r;
        if (d < m) {
          if (B.biteCd <= 0) { B.biteCd = 0.7; hurtHero(h, BOSS.bite, 'boss'); }
          var p = norm(h.x - B.x, h.y - B.y); if (!p.x && !p.y) p = { x: 0, y: 1 };
          moveBody(h, p.x * (m - d), p.y * (m - d), solidBody);
        }
      });
    }
    function updateSpits(dt) {
      S.spits.forEach(function (s) {
        s.x += s.vx * dt; s.y += s.vy * dt; s.t -= dt;
        var tx = Math.floor(s.x / T), ty = Math.floor(s.y / T), c = cell(tx, ty);
        if (c === 'L') { snuffLamp(lampOf(tx, ty), 'spit'); s.t = 0; }       // плевок гасит чашу (очаг не гаснет)
        else if (c === '#' || c === 'D') s.t = 0;
        S.heroes.forEach(function (h) { if (s.t > 0 && h.alive && dist(s.x, s.y, h.x, h.y) < h.r + s.r) { hurtHero(h, s.dmg, 'spit'); s.t = 0; } });
      });
      S.spits = S.spits.filter(function (s) { return s.t > 0; });
    }
    function updateTip() {
      if (!S.tut) { S.tip = null; return; }
      var hot = S.heroes.some(function (h) { return h.hoop.hot > 0; });
      S.tip = !S.done.thrown ? 'tip_throw' : !S.done.lit ? (hot ? 'tip_lamp' : 'tip_dip') : !S.sealOpen ? 'tip_all' : 'tip_exit';
    }
    // --- прокачка между этажами ---
    function updateUpgrade() {
      S.heroes.forEach(function (h) {
        var c = ctl[h.id], i = h.id; if (S.upDone[i]) return;
        var v = Math.abs(c.dy) > 0.5 ? Math.sign(c.dy) : Math.abs(c.dx) > 0.5 ? Math.sign(c.dx) : 0;
        if (v && v !== c.pdy) S.upCursor[i] = (S.upCursor[i] + (v > 0 ? 1 : 2)) % 3;
        c.pdy = v;
        if (c.fire && !c.pfire) choose(i, S.upCursor[i]);
      });
    }
    function choose(pi, k) {
      var h = S.heroes[pi]; if (S.phase !== 'upgrade' || !h || S.upDone[pi]) return false;
      var key = UPG[k]; if (!key) return false;
      if (h.up[key] < UPG_MAX) { var before = heroStats(h).maxHp; h.up[key]++; if (h.alive) h.hp += heroStats(h).maxHp - before; }
      S.upDone[pi] = true; emit('upgrade', { pi: pi, kind: key, level: h.up[key] });
      if (S.heroes.every(function (o) { return S.upDone[o.id]; })) loadFloor(S.floor + 1);
      return true;
    }
    // --- реклама за награду ---
    var boosted = false;
    function reviveAd() {   // «ещё один шанс»: на том же месте, 60% здоровья, твари рядом рассеяны
      S.heroes.forEach(function (h) { h.alive = true; h.hp = Math.round(heroStats(h).maxHp * 0.6); h.hurtT = 0; h.hoop.state = 'held'; });
      S.enemies = S.enemies.filter(function (e) { return !S.heroes.some(function (h) { return dist(e.x, e.y, h.x, h.y) < 7 * T; }); });
      S.spits = []; S.rises = []; S.phase = 'play'; S.phaseT = 0; S.over = false; S.spawnT = 4; S.flowT = 0;
      if (S.boss) { S.boss.gustT = Math.max(S.boss.gustT, 4); S.boss.ringT = Math.max(S.boss.ringT, 2); }
      emit('revive', { pi: 0, ad: true });
    }
    function canBoost() { return !boosted && S.phase === 'play' && S.heroes.some(function (h) { return h.alive && h.hp < heroStats(h).maxHp; }); }
    function boost() {   // бонус в паузе: полное здоровье и горящий обруч
      if (boosted) return false; boosted = true;
      S.heroes.forEach(function (h) { if (h.alive) { h.hp = heroStats(h).maxHp; h.hoop.hot = FLAME; } });
      emit('boost', {}); return true;
    }

    var api = {
      start: function () { loadFloor(S.floor); return api; },
      setDir: function (pi, dx, dy) { if (ctl[pi]) { ctl[pi].dx = dx; ctl[pi].dy = dy; } },
      setFire: function (pi, on) { if (ctl[pi]) ctl[pi].fire = !!on; },
      setWideAim: function (on) { wide = !!on; },
      throwHoop: throwHoop, choose: choose, reviveAd: reviveAd, canBoost: canBoost, boost: boost,
      update: function (dt) {
        if (S.over) return;
        S.time += dt; S.phaseT += dt; S.banner = Math.max(0, S.banner - dt);
        S.lamps.forEach(function (l) { l.flash = Math.max(0, l.flash - dt); });
        if (S.phase === 'play' || S.phase === 'dying') {
          updateHeroes(dt);
          if (S.phase === 'play' || S.phase === 'dying') { updateEnemies(dt); updateSpawns(dt); updateBoss(dt); updateSpits(dt); }
          updateCam(); updateTip();
          if (S.phase === 'dying' && S.phaseT > 1.6) { S.phase = 'over'; S.over = true; emit('gameover', { score: S.score }); }
          else if (S.phase === 'won') { S.over = true; S.won = true; emit('win', { score: S.score }); }
        } else if (S.phase === 'won') { S.over = true; S.won = true; emit('win', { score: S.score }); }
        else if (S.phase === 'clear') {
          if (S.phaseT > 1.8) {
            if (S.floor >= S.maxFloor) { S.phase = 'won'; S.over = true; S.won = true; emit('win', { score: S.score }); }
            else { S.phase = 'upgrade'; S.phaseT = 0; S.upDone = [false, false]; S.upCursor = [0, 0]; ctl.forEach(function (c) { c.pfire = true; c.pdy = 0; }); emit('upgradeOpen', {}); }
          }
        } else if (S.phase === 'upgrade') updateUpgrade();
        ctl.forEach(function (c) { c.pfire = c.fire; });
      },
      state: function () { return S; },
      // для тестов и промо
      _S: S, _ctl: ctl, _flow: function () { if (!flow) buildFlow(); return flow; }, _load: loadFloor, _light: lightLamp, _snuff: snuffLamp,
      _clear: floorClear, _spawn: spawnEnemy, _cam: updateCam, _gates: function () { return groups; }
    };
    return api;
  }

  // Ключи хранилища: прежние правила (логова, ключи, еда, классы героев) — другие очки; прежний рекорд уходит в «прежний рекорд»
  var VKEY = 'arcade.katakomby.v', BEST = 'arcade.best.katakomby', OLD = 'arcade.katakomby.oldBest';
  function migrate(LS) {
    if (!LS) return 0;
    try {
      if (LS.getItem(VKEY) === '2') return 0;
      var old = parseInt(LS.getItem(BEST) || '0', 10) || 0;
      if (old > 0) { LS.setItem(OLD, String(old)); LS.removeItem(BEST); }
      LS.removeItem('arcade.katakomby.hero1'); LS.removeItem('arcade.katakomby.hero2');
      LS.setItem(VKEY, '2');
      return old;
    } catch (e) { return 0; }
  }

  K.logic = {
    AIM_CONE: AIM_CONE, AIM_WIDE: AIM_WIDE, BIND: BIND, T: T, VIEW_W: VIEW_W, VIEW_H: VIEW_H, HUD: HUD, SCREEN_H: SCREEN_H, LEASH_PAD: LEASH_PAD, AGGRO: AGGRO,
    HERO: HERO, HOOP: HOOP, FLAME: FLAME, DIP_R: DIP_R, LIGHT_R: LIGHT_R, HEAL: HEAL, BURN: BURN, ENEMIES: ENEMIES, BOSS: BOSS, UPG: UPG, UPG_MAX: UPG_MAX,
    SCORE: SCORE, MULT_MAX: MULT_MAX, MIX: MIX, FLOORS: FLOORS, SOLVE: SOLVE, parseFloor: parseFloor, gateGroups: gateGroups, losCells: losCells,
    solveFloor: solveFloor, params: params, heroStats: heroStats, mulberry32: mulberry32
  };
  K.migrate = migrate;
  K.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
