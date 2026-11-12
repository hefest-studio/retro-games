/* КАТАКОМБЫ · логика (без DOM, детерминирована при заданном rng). KATAKOMBY.Game(opts), KATAKOMBY.logic
   Зачистка подземелий с видом сверху: 1–2 героя, генераторы-логова, ключи и двери, сундуки, еда,
   зелья-бомбы, таяние здоровья, прокачка между этажами, 8 этажей + логово Стража Глубин. */
(function (global) {
  'use strict';
  var K = global.KATAKOMBY = global.KATAKOMBY || {};

  // ---------- Константы ----------
  var T = 32;                          // клетка, px
  var VIEW_W = 960, HUD = 40, VIEW_H = 560, SCREEN_H = HUD + VIEW_H;
  // Кооп — «поводок»: пара героев всегда умещается в кадре с отступом LEASH_PAD
  var LEASH_PAD = 48;
  var DRAIN = 1;                       // таяние здоровья, ед/с
  var CONTACT_CD = 0.6;                // как часто враг кусает при касании, с
  var AGGRO = 18;
  var AIM_CONE = 0.42;                 // автоприцел искры, рад (≈24°)                      // шагов по полю потока — дальше враги не чуют героя

  var HEROES = {
    smith: { hp: 140, speed: 125, armor: 0.25, r: 11, melee: true, dmg: 2, cd: 0.36, reach: 26, arc: 28 },
    spark: { hp: 115, speed: 165, armor: 0.12, r: 10, melee: false, dmg: 1.25, cd: 0.21, bolt: 430, life: 0.95 }
  };
  var ENEMIES = {
    shade:   { hp: 2, r: 10, speed: 100, bite: 6, score: 10 },
    slime:   { hp: 5, r: 12, speed: 60, bite: 10, score: 20 },
    spitter: { hp: 3, r: 11, speed: 72, bite: 6, score: 30, spit: 8, spitCd: 2.4, spitSpeed: 175, range: 6 }
  };
  var LAIR_KIND = { G: 'shade', H: 'slime', J: 'spitter' };
  var PLACED = { s: 'shade', m: 'slime', x: 'spitter' };
  var UPG = ['str', 'spd', 'arm'], UPG_MAX = 5;
  var BOSS = { hp: 230, r: 30, speed: 50, bite: 10, ring: 9, ringCd: 3.0, ringCd2: 2.1, spawnCd: 6, spit: 6, ringSpeed: 135 };
  var SCORE = { chest: 150, key: 25, food: 10, potion: 25, lair: 100, floor: 500, boss: 5000 };
  // Раскладка кооп-клавиатуры (g.usePlayers): И1 — стрелки, И2 — WASD; без горячих клавиш движка и пересечений
  var BIND = {
    p1: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], fire: ['Slash', 'NumpadDivide', 'Period', 'Space'], bomb: ['Comma', 'ShiftRight', 'Numpad0'] },
    p2: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], fire: ['KeyF', 'ShiftLeft'], bomb: ['KeyG', 'KeyQ'] }
  };
  var FOOD_HP = 40, BOMB_DMG = 6, BOMB_LAIR = 3, BOMB_BOSS = 10, MAX_ENEMIES = 40, LAIR_CAP = 6;

  // ---------- Карты (ручной работы). # стена · . пол · S старт · E выход · D дверь (ключ открывает
  // всю связную группу) · k ключ · $ сундук · f еда · p зелье · G/H/J логово теней/слизней/плевунов ·
  // s/m/x тень/слизень/плевун · B Страж Глубин ----------
  var FLOORS = [
    { name: 'vestibule', map: [
      '########################################',
      '#S.....#.......................#.......#',
      '#......#.......f...............#...$...#',
      '#......#.......................#.......#',
      '#..........s.........G.........D...E...#',
      '#......#.......................#.......#',
      '#......#.......................#.......#',
      '####.###########..##############.......#',
      '#......#...........#...........#########',
      '#..k...#...........#...........#.......#',
      '#......#.....s.....#.....p.....#...$...#',
      '#..........................s...........#',
      '#......#...........#...........#.......#',
      '#..f...#.....H.....#.....$.....#...f...#',
      '#......#...........#...........#.......#',
      '########################################'
    ] },
    { name: 'storerooms', map: [
      '########################################',
      '#.....#.........#..........#...........#',
      '#.$...#....G....#....f.....#....$......#',
      '#.....#.........#..........D...........#',
      '#.....#.........#..........#.....E.....#',
      '#.....##.#####.###.######.##...........#',
      '#......................................#',
      '#..S.........s.........m........s......#',
      '#......................................#',
      '###.#####.######.####.#####.####.#######',
      '#.....#.........#.........#.....#......#',
      '#..k..#....m....#....H....#..f..#..k...#',
      '#.....#.........#.........#.....#......#',
      '#.....D.........#.........#.....D......#',
      '#.p...#....$....#....$....#.....#..$...#',
      '########################################'
    ] },
    { name: 'wells', map: [
      '########################################',
      '#S.....................................#',
      '#..##....##....##....##....##....##....#',
      '#..##....##....##....##....##....##....#',
      '#................f.....................#',
      '#......s......m..........s.............#',
      '#..##....##....##....##....##....##....#',
      '#..##....##....##....##....##....##....#',
      '#.........G...............H............#',
      '#......................................#',
      '#..##....##....##....##....##....##....#',
      '#..##....##....##....##....##....##....#',
      '#........p..............$..........k...#',
      '#......................................#',
      '###############DDDD#####################',
      '#..............#..#....................#',
      '#..$.....f.....#..#........J...........#',
      '#..............#..#....................#',
      '#.......E..........m.......$...........#',
      '#..............#..#....................#',
      '########################################'
    ] },
    { name: 'maze', map: [
      '########################################',
      '#S...#.........#.....f...#.............#',
      '#....#.#######.#.#######.#.#########.#.#',
      '#....#.#.....#...#.....#...#.....#...#.#',
      '#..k.#.#.$...#####..G..#####..m..#.###.#',
      '#....#.#.....#.....................#...#',
      '###.##.###.###.#######.#######.#####.###',
      '#......#.....#.#.....#.#.....#.#.......#',
      '#.####.#..s..#.#..p..#.#..s..#.#.#####.#',
      '#.#..#.#.....#.#.....#.#.....#.#.#...#.#',
      '#.#H.#.##.####.###.###.###.###.#.#.$.#.#',
      '#.#..#.....................f.....#...#.#',
      '#.##.#######.#########.#########.##D##.#',
      '#......$.....#.......#.#.......#.......#',
      '######.#######...J...#.#...k...#######.#',
      '#............#.......#.#.......#.......#',
      '#.f..........D.......#.........D...E...#',
      '#............#.......#.#.......#.......#',
      '########################################'
    ] },
    { name: 'barracks', map: [
      '########################################',
      '#......#......#......#......#......#...#',
      '#..m...#..s...#..$...#..m...#..s...#.$.#',
      '#......#......#......#......#......#...#',
      '#......#......#......#......#......#...#',
      '###.######.######.######.######.####D###',
      '#......................................#',
      '#.S....f...........G.............p.....#',
      '#......................................#',
      '###.######.######.######.######.####.###',
      '#......#......#......#......#......#...#',
      '#..k...#..H...#..f...#..x...#..J...#.k.#',
      '#......#......#......#......#......#...#',
      '#......#......#......#......#......#...#',
      '############################DD##########',
      '#......................................#',
      '#..$......m.......s.......E........$...#',
      '#......................................#',
      '########################################'
    ] },
    { name: 'bridges', map: [
      '########################################',
      '#S.....#################################',
      '#......#.......f...........#...........#',
      '#..p.......................D.....J.....#',
      '#......#...................#...........#',
      '###.####.##########.########...........#',
      '###.####.##########.########...$.......#',
      '###.####.##########.##########.#########',
      '#........#.....k...........#.......#####',
      '#..G.....#..........H......#...f...#####',
      '#........#.................#.......#####',
      '####.#######.##################.########',
      '####.#######.##################.########',
      '#......$.....#.........................#',
      '#.......s....D.....m.....G.........E...#',
      '#............#.........................#',
      '########################################'
    ] },
    { name: 'hive', map: [
      '########################################',
      '#S........#.....G.......#..............#',
      '#.........#.............#.....H........#',
      '#...f.....#.....s.......#..............#',
      '#.........#.............#.......$......#',
      '#....................................f.#',
      '#.........#.............#..............#',
      '#####..####.....J.......####..##########',
      '#.........#.............#..............#',
      '#..H......#.............#.......G......#',
      '#.........#####..########..............#',
      '#.....p...#..............k.............#',
      '#.........#.......f.....#..............#',
      '#..G......#.............#.....m........#',
      '#.........#.............#..............#',
      '#####.#######.#############.##########D#',
      '#.....................#................#',
      '#..$.....J.......k....D.......x....E...#',
      '#.....................#................#',
      '########################################'
    ] },
    { name: 'vault', map: [
      '########################################',
      '#S.......#........f......#.............#',
      '#........#...............#.....J.......#',
      '#....G...#.......H.......#.............#',
      '#........D...............D.............#',
      '#........#...............#......k......#',
      '#..k.....#.......$.......#.............#',
      '#........#...............#.............#',
      '#####D######.###.###.########D##########',
      '#......#.....#.....#.....#.............#',
      '#..k...#..p..#..G..#..f..#....$...$....#',
      '#......#.....#.....#.....#.............#',
      '#......D.....#.....#.....D.............#',
      '#......#..k..#..k..#..k..#.......E.....#',
      '#..J...#.....#.....#..x..#.............#',
      '#......#.....#.....#.....#.............#',
      '########################################'
    ] },
    { name: 'lair', map: [
      '################################',
      '#..............................#',
      '#..f.....................f.....#',
      '#..............................#',
      '#.....##..............##.......#',
      '#.....##.......B......##.......#',
      '#..............................#',
      '#..............................#',
      '#..p.......................p...#',
      '#.....##..............##.......#',
      '#.....##..............##.......#',
      '#..............................#',
      '#..f...........S...........f...#',
      '################################'
    ] }
  ];

  function parseFloor(map) {
    var H = map.length, W = map[0].length, grid = [], items = [], lairs = [], enemies = [], start = null, exit = null, boss = null;
    for (var y = 0; y < H; y++) {
      if (map[y].length !== W) throw new Error('КАТАКОМБЫ: строка ' + y + ' карты длиной ' + map[y].length + ' ≠ ' + W);
      for (var x = 0; x < W; x++) {
        var c = map[y][x], cell = '.';
        if (c === '#') cell = '#';
        else if (c === 'D') cell = 'D';
        else if (c === 'E') { cell = 'E'; exit = { tx: x, ty: y }; }
        else if (c === 'S') start = { tx: x, ty: y };
        else if (c === 'B') boss = { tx: x, ty: y };
        else if (c === 'k') items.push({ kind: 'key', tx: x, ty: y });
        else if (c === '$') items.push({ kind: 'chest', tx: x, ty: y });
        else if (c === 'f') items.push({ kind: 'food', tx: x, ty: y });
        else if (c === 'p') items.push({ kind: 'potion', tx: x, ty: y });
        else if (LAIR_KIND[c]) lairs.push({ kind: LAIR_KIND[c], tx: x, ty: y });
        else if (PLACED[c]) enemies.push({ type: PLACED[c], tx: x, ty: y });
        else if (c !== '.') throw new Error('КАТАКОМБЫ: неизвестный символ карты «' + c + '»');
        grid.push(cell);
      }
    }
    if (!start) throw new Error('КАТАКОМБЫ: на карте нет старта S');
    return { W: W, H: H, grid: grid, items: items, lairs: lairs, enemies: enemies, start: start, exit: exit, boss: boss };
  }
  // Группы дверей: связные (4-соседи) клетки D
  function doorGroups(F) {
    var id = new Array(F.W * F.H).fill(-1), n = 0;
    for (var i = 0; i < id.length; i++) {
      if (F.grid[i] !== 'D' || id[i] >= 0) continue;
      var st = [i]; id[i] = n;
      while (st.length) {
        var j = st.pop(), x = j % F.W, y = (j / F.W) | 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var nx = x + d[0], ny = y + d[1], k = ny * F.W + nx;
          if (nx >= 0 && ny >= 0 && nx < F.W && ny < F.H && F.grid[k] === 'D' && id[k] < 0) { id[k] = n; st.push(k); }
        });
      }
      n++;
    }
    return { id: id, count: n };
  }
  // Проходимость для оценки достижимости: какие клетки достижимы от старта при открытых группах opened
  function region(F, groups, opened) {
    var seen = new Uint8Array(F.W * F.H), s = F.start.ty * F.W + F.start.tx, st = [s]; seen[s] = 1;
    while (st.length) {
      var j = st.pop(), x = j % F.W, y = (j / F.W) | 0;
      for (var d = 0; d < 4; d++) {
        var nx = x + [1, -1, 0, 0][d], ny = y + [0, 0, 1, -1][d], k = ny * F.W + nx;
        if (nx < 0 || ny < 0 || nx >= F.W || ny >= F.H || seen[k]) continue;
        var c = F.grid[k]; if (c === '#') continue;
        if (c === 'D' && !opened[groups.id[k]]) continue;
        seen[k] = 1; st.push(k);
      }
    }
    return seen;
  }
  // Проходимость этажа с учётом ключей: перебор ВСЕХ порядков открывания дверей.
  // ok — из любого тупикового состояния (ключей нет или дверей рядом нет) цель (выход/босс) достижима.
  function solveFloor(map) {
    var F = parseFloor(map), G = doorGroups(F), target = F.boss || F.exit, memo = {}, fails = [], states = 0;
    var keyCells = F.items.filter(function (it) { return it.kind === 'key'; }).map(function (it) { return it.ty * F.W + it.tx; });
    function dfs(opened) {
      var sig = opened.join(''); if (memo[sig]) return; memo[sig] = 1; states++;
      var R = region(F, G, opened), used = opened.filter(Boolean).length;
      var keys = keyCells.filter(function (k) { return R[k]; }).length - used, adj = {};
      for (var i = 0; i < R.length; i++) if (R[i]) {
        var x = i % F.W, y = (i / F.W) | 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var k = (y + d[1]) * F.W + x + d[0]; if (G.id[k] >= 0 && !opened[G.id[k]]) adj[G.id[k]] = 1; });
      }
      var moves = keys > 0 ? Object.keys(adj) : [];
      if (!moves.length) { if (!R[target.ty * F.W + target.tx]) fails.push(opened.slice()); return; }
      moves.forEach(function (g) { var o = opened.slice(); o[g] = 1; dfs(o); });
    }
    dfs(new Array(G.count).fill(0));
    return { ok: fails.length === 0, fails: fails, states: states, groups: G.count, target: target };
  }

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function norm(x, y) { var l = Math.hypot(x, y); return l ? { x: x / l, y: y / l } : { x: 0, y: 0 }; }
  // Параметры этажа: сложность растёт плавно; вдвоём (players=2) логова плодят чаще и крепче, враги и Страж толще
  function params(floor, players) {
    var co = players === 2;
    return {
      speedMul: 1 + 0.05 * (floor - 1),
      lairCd: Math.max(2.0, 4.6 - 0.3 * (floor - 1)) * (co ? 0.65 : 1),
      lairHp: Math.round((8 + Math.floor((floor - 1) / 2)) * (co ? 1.5 : 1)),
      biteMul: 1 + 0.06 * (floor - 1),
      hpMul: co ? 1.5 : 1,
      bossHp: Math.round(BOSS.hp * (co ? 2.2 : 1))
    };
  }
  function heroStats(h) {
    var B = HEROES[h.cls];
    return {
      speed: B.speed * (1 + 0.1 * h.up.spd),
      cd: B.cd / (1 + 0.12 * h.up.spd),
      dmg: B.dmg * (1 + 0.35 * h.up.str),
      armor: Math.min(0.65, B.armor + 0.08 * h.up.arm),
      maxHp: B.hp + 10 * h.up.arm
    };
  }

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, emit = opts.onEvent || function () {};
    var players = opts.players === 2 ? 2 : 1, maxFloor = opts.maxFloor || FLOORS.length;
    var classes = opts.heroes || ['smith', 'spark'];
    var S = {
      floor: opts.floor || 1, maxFloor: maxFloor, players: players, score: 0, keys: 0, potions: 0,
      phase: 'play', phaseT: 0, time: 0, over: false, won: false, banner: 0, name: '',
      heroes: [], enemies: [], lairs: [], boss: null, shots: [], spits: [], items: [], grid: [], W: 0, H: 0,
      cam: { x: 0, y: 0 }, bombFlash: 0, swings: [], exit: null, flowT: 0, upCursor: [0, 0], upDone: [false, false]
    };
    var flow = null, groups = null, lairAt = [], prm = params(S.floor, players);
    var ctl = [{ dx: 0, dy: 0, fire: false, pfire: false, pdy: 0 }, { dx: 0, dy: 0, fire: false, pfire: false, pdy: 0 }];

    for (var i = 0; i < players; i++) {
      var cls = HEROES[classes[i]] ? classes[i] : (i ? 'spark' : 'smith');
      var h = { id: i, cls: cls, x: 0, y: 0, r: HEROES[cls].r, alive: true, up: { str: 0, spd: 0, arm: 0 }, face: { x: 1, y: 0 },
        cd: 0, hurtT: 0, swingT: 0, moving: false, leashed: false, deaths: 0 };
      h.hp = heroStats(h).maxHp; S.heroes.push(h);
    }

    // --- клетки ---
    function cell(tx, ty) { return (tx < 0 || ty < 0 || tx >= S.W || ty >= S.H) ? '#' : S.grid[ty * S.W + tx]; }
    function lairCell(tx, ty) { var l = lairAt[ty * S.W + tx]; return l && l.hp > 0 ? l : null; }
    function solidFor(who) {   // who: 'hero' | 'mob'
      return function (tx, ty) { var c = cell(tx, ty); return c === '#' || c === 'D' || !!lairCell(tx, ty); };
    }
    var solidHero = solidFor('hero'), solidMob = solidFor('mob');
    function hitTile(x, y, r, solid) {
      var x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r - 0.001) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r - 0.001) / T);
      for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) if (solid(tx, ty)) return { tx: tx, ty: ty };
      return null;
    }
    // Движение с подшагами и «обтеканием» углов (проход в коридор шириной в клетку без пиксель-охоты)
    function moveBody(b, dx, dy, solid, onBlock) {
      var steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4)), sx = dx / steps, sy = dy / steps, blocked = false;
      for (var s = 0; s < steps; s++) {
        if (sx) {
          var hx = hitTile(b.x + sx, b.y, b.r, solid);
          if (!hx) b.x += sx; else { blocked = true; if (onBlock) onBlock(hx); if (!sy) nudge(b, 'y', sx, solid); }
        }
        if (sy) {
          var hy = hitTile(b.x, b.y + sy, b.r, solid);
          if (!hy) b.y += sy; else { blocked = true; if (onBlock) onBlock(hy); if (!sx) nudge(b, 'x', sy, solid); }
        }
      }
      return blocked;
    }
    function nudge(b, axis, push, solid) {   // упёрлись: если рядом (≤12 px) свободный проход — подвинуть к нему
      for (var off = 1; off <= 12; off++) for (var sg = -1; sg <= 1; sg += 2) {
        var nx = axis === 'x' ? b.x + sg * off : b.x, ny = axis === 'y' ? b.y + sg * off : b.y;
        var px = axis === 'x' ? 0 : push, py = axis === 'y' ? 0 : push;
        if (!hitTile(nx, ny, b.r, solid) && !hitTile(nx + px, ny + py, b.r, solid)) {
          if (axis === 'x') b.x += sg * Math.min(1.5, off); else b.y += sg * Math.min(1.5, off);
          return;
        }
      }
    }
    function openDoor(tx, ty) {
      if (cell(tx, ty) !== 'D' || S.keys <= 0) return false;
      var g = groups.id[ty * S.W + tx]; if (g < 0) return false;
      S.keys--;
      for (var i = 0; i < S.grid.length; i++) if (groups.id[i] === g) S.grid[i] = '.';
      S.flowT = 0; emit('door', { x: tx * T + T / 2, y: ty * T + T / 2 });
      return true;
    }

    // --- этаж ---
    function loadFloor(n) {
      var F = parseFloor(FLOORS[n - 1].map);
      S.floor = n; S.name = FLOORS[n - 1].name; prm = params(n, S.players);
      S.W = F.W; S.H = F.H; S.grid = F.grid.slice(); groups = doorGroups(F);
      S.items = F.items.map(function (it) { return { kind: it.kind, tx: it.tx, ty: it.ty, x: it.tx * T + T / 2, y: it.ty * T + T / 2, taken: false }; });
      S.lairs = F.lairs.map(function (l) { return { kind: l.kind, tx: l.tx, ty: l.ty, x: l.tx * T + T / 2, y: l.ty * T + T / 2, hp: prm.lairHp, max: prm.lairHp, t: 1 + rng() * prm.lairCd, flash: 0 }; });
      lairAt = new Array(S.W * S.H); S.lairs.forEach(function (l) { lairAt[l.ty * S.W + l.tx] = l; });
      S.enemies = []; F.enemies.forEach(function (e) { spawnEnemy(e.type, e.tx * T + T / 2, e.ty * T + T / 2, null); });
      S.exit = F.exit ? { tx: F.exit.tx, ty: F.exit.ty, x: F.exit.tx * T + T / 2, y: F.exit.ty * T + T / 2 } : null;
      S.boss = F.boss ? { x: F.boss.tx * T + T / 2, y: F.boss.ty * T + T / 2, r: BOSS.r, hp: prm.bossHp, max: prm.bossHp, ringT: 2.2, spawnT: 4, aimT: 3, flash: 0, biteCd: 0, dead: false, deadT: 0, wob: 0 } : null;
      S.shots = []; S.spits = []; S.swings = []; S.keys = 0; flow = null; S.flowT = 0;
      // герои: И1 на S, И2 — на соседней свободной клетке
      var sx = F.start.tx, sy = F.start.ty, spots = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]];
      var k = 0;
      S.heroes.forEach(function (h) {
        while (k < spots.length && cell(sx + spots[k][0], sy + spots[k][1]) !== '.') k++;
        var p = spots[Math.min(k, spots.length - 1)]; k++;
        h.x = (sx + p[0]) * T + T / 2; h.y = (sy + p[1]) * T + T / 2;
        var st = heroStats(h);
        if (!h.alive) { h.alive = true; h.hp = Math.round(st.maxHp * 0.5); emit('revive', { pi: h.id }); }
        else if (F.boss) h.hp = st.maxHp;                       // перед логовом Стража — передышка: здоровье полностью
        else if (n > 1) h.hp = Math.min(st.maxHp, h.hp + 20);
        h.cd = 0.3; h.hurtT = 0; h.face = { x: 1, y: 0 };
      });
      S.phase = 'play'; S.phaseT = 0; S.banner = 2.2;
      updateCam(true);
      emit('floor', { floor: n, boss: !!S.boss });
    }

    function spawnEnemy(type, x, y, lair) {
      var E = ENEMIES[type];
      var e = { type: type, x: x, y: y, r: E.r, hp: E.hp * prm.hpMul, max: E.hp * prm.hpMul, lair: lair, biteCd: 0.4, spitT: E.spitCd ? 1 + rng() * E.spitCd : 0, flash: 0, wob: rng() * 6.28, vx: 0, vy: 0 };
      S.enemies.push(e); return e;
    }

    // --- поле потока (BFS от живых героев) — враги идут по нему ---
    function buildFlow() {
      var n = S.W * S.H; if (!flow || flow.length !== n) flow = new Int16Array(n);
      flow.fill(-1); var q = new Int32Array(n), qh = 0, qt = 0;
      S.heroes.forEach(function (h) { if (!h.alive) return; var k = Math.floor(h.y / T) * S.W + Math.floor(h.x / T); if (flow[k] < 0) { flow[k] = 0; q[qt++] = k; } });
      while (qh < qt) {
        var j = q[qh++], x = j % S.W, y = (j / S.W) | 0, d = flow[j];
        if (d >= AGGRO + 4) continue;
        for (var i = 0; i < 4; i++) {
          var nx = x + [1, -1, 0, 0][i], ny = y + [0, 0, 1, -1][i], k = ny * S.W + nx;
          if (nx < 0 || ny < 0 || nx >= S.W || ny >= S.H || flow[k] >= 0 || solidMob(nx, ny)) continue;
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
      var st = heroStats(h), d = dmg * (1 - st.armor);
      h.hp -= d; h.hurtT = 0.25; emit('hurt', { pi: h.id, dmg: d, x: h.x, y: h.y, src: src });
      if (h.hp <= 0) killHero(h);
    }
    function killHero(h) {
      h.hp = 0; h.alive = false; h.deaths++; emit('heroDie', { pi: h.id, x: h.x, y: h.y });
      if (!S.heroes.some(function (o) { return o.alive; })) { S.phase = 'dying'; S.phaseT = 0; }
      S.flowT = 0;
    }
    function hitEnemy(e, dmg, src) {
      if (e.hp <= 0) return;
      e.hp -= dmg; e.flash = 0.12;
      if (e.hp <= 0) { S.score += ENEMIES[e.type].score; emit('kill', { type: e.type, x: e.x, y: e.y, src: src }); }
      else emit('hit', { x: e.x, y: e.y });
    }
    function hitLair(l, dmg) {
      if (l.hp <= 0) return;
      l.hp -= dmg; l.flash = 0.15;
      if (l.hp <= 0) { l.hp = 0; S.score += SCORE.lair; S.flowT = 0; emit('lairDie', { kind: l.kind, x: l.x, y: l.y }); }
      else emit('lairHit', { x: l.x, y: l.y, hp: l.hp });
    }
    function hitBoss(dmg) {
      var B = S.boss; if (!B || B.dead) return;
      B.hp -= dmg; B.flash = 0.12;
      if (B.hp <= 0) { B.hp = 0; B.dead = true; B.deadT = 0; S.score += SCORE.boss; emit('bossDie', { x: B.x, y: B.y }); S.spits = []; S.enemies.forEach(function (e) { e.hp = 0; }); }
      else emit('bossHit', { x: B.x, y: B.y, hp: B.hp });
    }

    // --- атака героя ---
    function attack(h) {
      var st = heroStats(h), B = HEROES[h.cls];
      h.cd = st.cd;
      if (B.melee) {
        var cx = h.x + h.face.x * B.reach, cy = h.y + h.face.y * B.reach, R = B.arc;
        h.swingT = 0.16; S.swings.push({ x: cx, y: cy, r: R, t: 0.16, fx: h.face.x, fy: h.face.y, pi: h.id });
        emit('swing', { pi: h.id });
        S.enemies.forEach(function (e) { if (e.hp > 0 && dist(cx, cy, e.x, e.y) < R + e.r) hitEnemy(e, st.dmg, h.id); });
        S.lairs.forEach(function (l) { if (l.hp > 0 && dist(cx, cy, l.x, l.y) < R + 14) hitLair(l, st.dmg); });
        if (S.boss && !S.boss.dead && dist(cx, cy, S.boss.x, S.boss.y) < R + S.boss.r) hitBoss(st.dmg);
      } else {
        var a = aimAssist(h, B.bolt * B.life);
        S.shots.push({ x: h.x + a.x * 10, y: h.y + a.y * 10, vx: a.x * B.bolt, vy: a.y * B.bolt, dmg: st.dmg, t: B.life, pi: h.id, r: 4 });
        emit('shot', { pi: h.id });
      }
    }
    // Мягкий автоприцел искры: ближайшая цель в конусе ±AIM_CONE от направления взгляда (8 направлений
    // клавиш не дают попасть «между лучами»); без цели — строго по взгляду
    function aimAssist(h, range) {
      var best = null, bs = 1e9, fx = h.face.x, fy = h.face.y;
      function consider(x, y) {
        var dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy); if (d < 1 || d > range) return;
        var cos = (dx * fx + dy * fy) / d; if (cos < Math.cos(AIM_CONE)) return;
        var s = d * (2 - cos); if (s < bs) { bs = s; best = { x: dx / d, y: dy / d }; }
      }
      S.enemies.forEach(function (e) { if (e.hp > 0) consider(e.x, e.y); });
      S.lairs.forEach(function (l) { if (l.hp > 0) consider(l.x, l.y); });
      if (S.boss && !S.boss.dead) consider(S.boss.x, S.boss.y);
      return best || { x: fx, y: fy };
    }
    function bomb(pi) {
      var h = S.heroes[pi];
      if (S.phase !== 'play' || !h || !h.alive || S.potions <= 0) return false;
      S.potions--; S.bombFlash = 0.5;
      var x0 = S.cam.x, y0 = S.cam.y, x1 = x0 + VIEW_W, y1 = y0 + VIEW_H;
      function inView(o) { return o.x >= x0 - 8 && o.x <= x1 + 8 && o.y >= y0 - 8 && o.y <= y1 + 8; }
      S.enemies.forEach(function (e) { if (e.hp > 0 && inView(e)) hitEnemy(e, BOMB_DMG, 'bomb'); });
      S.lairs.forEach(function (l) { if (l.hp > 0 && inView(l)) hitLair(l, BOMB_LAIR); });
      if (S.boss && !S.boss.dead && inView(S.boss)) hitBoss(BOMB_BOSS);
      S.spits = S.spits.filter(function (s) { return !inView(s); });
      emit('bomb', { pi: pi, x: h.x, y: h.y });
      return true;
    }

    // --- камера и «поводок» ---
    function updateCam(snap) {
      var live = S.heroes.filter(function (h) { return h.alive; }); if (!live.length) live = S.heroes;
      var mx = 0, my = 0; live.forEach(function (h) { mx += h.x; my += h.y; }); mx /= live.length; my /= live.length;
      var pw = S.W * T, ph = S.H * T;
      var cx = pw <= VIEW_W ? (pw - VIEW_W) / 2 : Math.max(0, Math.min(pw - VIEW_W, mx - VIEW_W / 2));
      var cy = ph <= VIEW_H ? (ph - VIEW_H) / 2 : Math.max(0, Math.min(ph - VIEW_H, my - VIEW_H / 2));
      S.cam.x = cx; S.cam.y = cy;
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
        h.hp -= DRAIN * dt; if (h.hp <= 0) { killHero(h); return; }
        h.cd -= dt; h.hurtT -= dt; h.swingT -= dt; h.leashed = false;
        var n = norm(c.dx, c.dy); h.moving = !!(c.dx || c.dy);
        // Герой смотрит туда, куда идёт (8 направлений). Искорка, пока зажат «огонь», держит направление
        // выстрела — может стрелять, пятясь и стрейфя; Кузнец бьёт всегда по ходу движения.
        if (h.moving && !(c.fire && !HEROES[h.cls].melee)) h.face = n;
        var ox = h.x, oy = h.y;
        moveBody(h, n.x * st.speed * dt, n.y * st.speed * dt, solidHero, function (hit) { if (cell(hit.tx, hit.ty) === 'D') openDoor(hit.tx, hit.ty); });
        leash(h, ox, oy);
        if (c.fire && h.cd <= 0) attack(h);
        // предметы
        S.items.forEach(function (it) {
          if (it.taken || dist(h.x, h.y, it.x, it.y) > 18 + h.r) return;
          if (it.kind === 'food' && h.hp >= st.maxHp - 1) return;     // сытому еда не нужна — оставить напарнику
          it.taken = true;
          if (it.kind === 'key') { S.keys++; S.score += SCORE.key; }
          else if (it.kind === 'chest') S.score += SCORE.chest;
          else if (it.kind === 'food') { h.hp = Math.min(st.maxHp, h.hp + FOOD_HP); S.score += SCORE.food; }
          else if (it.kind === 'potion') { S.potions++; S.score += SCORE.potion; }
          emit(it.kind, { pi: h.id, x: it.x, y: it.y });
        });
        if (S.exit && S.phase === 'play' && dist(h.x, h.y, S.exit.x, S.exit.y) < 14 + h.r) floorClear();
      });
    }
    function floorClear() {
      S.phase = 'clear'; S.phaseT = 0; S.score += SCORE.floor * S.floor; S.spits = [];
      emit('clear', { floor: S.floor, bonus: SCORE.floor * S.floor });
    }
    function updateEnemies(dt) {
      S.flowT -= dt; if (!flow || S.flowT <= 0) { buildFlow(); S.flowT = 0.25; }
      var list = S.enemies;
      for (var i = 0; i < list.length; i++) {
        var e = list[i]; if (e.hp <= 0) continue;
        var E = ENEMIES[e.type], spd = E.speed * prm.speedMul;
        e.flash -= dt; e.biteCd -= dt; e.wob += dt * 4;
        var near = nearestHero(e.x, e.y); if (!near) continue;
        var tx = Math.floor(e.x / T), ty = Math.floor(e.y / T), d0 = flowAt(tx, ty), want = null;
        if (d0 >= 0 && d0 <= 1) want = { x: near.h.x, y: near.h.y };
        else if (d0 > 1 && d0 <= AGGRO) {
          var best = d0, bx = 0, by = 0;
          for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
            if (!ox && !oy) continue;
            if (ox && oy && (solidMob(tx + ox, ty) || solidMob(tx, ty + oy))) continue;
            var f = flowAt(tx + ox, ty + oy); if (f >= 0 && f < best) { best = f; bx = ox; by = oy; }
          }
          if (best < d0) want = { x: (tx + bx) * T + T / 2, y: (ty + by) * T + T / 2 };
        }
        var mvx = 0, mvy = 0;
        if (E.spit) {   // плевун держит дистанцию и плюёт прицельно
          if (near.d < E.range * T && d0 >= 0) {
            if (near.d < 3.5 * T) { var aw = norm(e.x - near.h.x, e.y - near.h.y); mvx = aw.x; mvy = aw.y; want = null; }
            else want = null;
            e.spitT -= dt;
            if (e.spitT <= 0) {
              e.spitT = E.spitCd / prm.speedMul; var a = norm(near.h.x - e.x, near.h.y - e.y);
              S.spits.push({ x: e.x, y: e.y, vx: a.x * E.spitSpeed, vy: a.y * E.spitSpeed, dmg: E.spit * prm.biteMul, t: 3, r: 5 });
              emit('spit', { x: e.x, y: e.y });
            }
          }
        }
        if (want) { var w = norm(want.x - e.x, want.y - e.y); mvx = w.x; mvy = w.y; }
        else if (!mvx && !mvy && d0 < 0) { mvx = Math.cos(e.wob * 0.3) * 0.25; mvy = Math.sin(e.wob * 0.23) * 0.25; }
        e.vx = mvx; e.vy = mvy;
        moveBody(e, mvx * spd * dt, mvy * spd * dt, solidMob);
        // укус при касании (герой — твёрдый для врага: враг выталкивается)
        S.heroes.forEach(function (h) {
          if (!h.alive) return;
          var d = dist(e.x, e.y, h.x, h.y), m = e.r + h.r;
          if (d < m) {
            if (e.biteCd <= 0) { e.biteCd = CONTACT_CD; hurtHero(h, E.bite * prm.biteMul, e.type); }
            var p = norm(e.x - h.x, e.y - h.y); if (!p.x && !p.y) p = { x: 1, y: 0 };
            moveBody(e, p.x * (m - d), p.y * (m - d), solidMob);
          }
        });
      }
      // расталкивание врагов (чтобы не сливались в одну точку)
      for (var a = 0; a < list.length; a++) for (var b = a + 1; b < list.length; b++) {
        var A = list[a], Bb = list[b]; if (A.hp <= 0 || Bb.hp <= 0) continue;
        var dx = Bb.x - A.x, dy = Bb.y - A.y, dd = Math.hypot(dx, dy), mm = A.r + Bb.r - 4;
        if (dd < mm && dd > 0.01) { var push = (mm - dd) / 2, ux = dx / dd, uy = dy / dd; moveBody(A, -ux * push, -uy * push, solidMob); moveBody(Bb, ux * push, uy * push, solidMob); }
      }
      S.enemies = list.filter(function (e) { return e.hp > 0; });
    }
    function updateLairs(dt) {
      var alive = S.enemies.length;
      S.lairs.forEach(function (l) {
        if (l.hp <= 0) return;
        l.flash -= dt;
        var near = nearestHero(l.x, l.y); if (!near || near.d > 11 * T) return;
        l.t -= dt; if (l.t > 0) return;
        l.t = prm.lairCd * (0.85 + rng() * 0.3);
        var own = S.enemies.filter(function (e) { return e.lair === l; }).length;
        if (own >= LAIR_CAP || alive >= MAX_ENEMIES) return;
        var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]], k0 = (rng() * 8) | 0;
        for (var i = 0; i < 8; i++) {
          var d = dirs[(k0 + i) % 8], tx = l.tx + d[0], ty = l.ty + d[1];
          if (cell(tx, ty) !== '.' && cell(tx, ty) !== 'E') continue; if (lairCell(tx, ty)) continue;
          var x = tx * T + T / 2, y = ty * T + T / 2;
          if (S.heroes.some(function (h) { return h.alive && dist(h.x, h.y, x, y) < 26; })) continue;
          spawnEnemy(l.kind, x, y, l); alive++; emit('spawn', { kind: l.kind, x: x, y: y }); return;
        }
      });
    }
    function updateBoss(dt) {
      var B = S.boss; if (!B) return;
      if (B.dead) { B.deadT += dt; if (B.deadT > 2.2 && S.phase === 'play') { S.phase = 'won'; S.phaseT = 0; } return; }
      B.flash -= dt; B.biteCd -= dt; B.wob += dt;
      var near = nearestHero(B.x, B.y); if (!near) return;
      var rage = B.hp < B.max / 2, w = norm(near.h.x - B.x, near.h.y - B.y), sp = BOSS.speed * (rage ? 1.35 : 1);
      if (near.d > B.r + near.h.r + 4) moveBody(B, w.x * sp * dt, w.y * sp * dt, solidMob);
      B.ringT -= dt;
      if (B.ringT <= 0) {
        B.ringT = rage ? BOSS.ringCd2 : BOSS.ringCd;
        var n = BOSS.ring + (rage ? 4 : 0), off = B.wob;
        for (var i = 0; i < n; i++) { var a = off + i * Math.PI * 2 / n; S.spits.push({ x: B.x, y: B.y, vx: Math.cos(a) * BOSS.ringSpeed, vy: Math.sin(a) * BOSS.ringSpeed, dmg: BOSS.spit, t: 4, r: 6 }); }
        emit('ring', { x: B.x, y: B.y });
      }
      if (rage) {
        B.aimT -= dt;
        if (B.aimT <= 0) {
          B.aimT = 2.4;
          [-0.22, 0, 0.22].forEach(function (da) { var a = Math.atan2(w.y, w.x) + da; S.spits.push({ x: B.x, y: B.y, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, dmg: BOSS.spit, t: 3, r: 6 }); });
          emit('spit', { x: B.x, y: B.y });
        }
      }
      B.spawnT -= dt;
      if (B.spawnT <= 0) {
        B.spawnT = BOSS.spawnCd;
        if (S.enemies.length < 10) for (var k = 0; k < 2; k++) {
          var a2 = rng() * Math.PI * 2, x = B.x + Math.cos(a2) * (B.r + 16), y = B.y + Math.sin(a2) * (B.r + 16);
          if (!hitTile(x, y, 10, solidMob)) { spawnEnemy('shade', x, y, null); emit('spawn', { kind: 'shade', x: x, y: y }); }
        }
      }
      S.heroes.forEach(function (h) {
        if (!h.alive) return; var d = dist(B.x, B.y, h.x, h.y), m = B.r + h.r;
        if (d < m) {
          if (B.biteCd <= 0) { B.biteCd = 0.7; hurtHero(h, BOSS.bite, 'boss'); }
          var p = norm(h.x - B.x, h.y - B.y); if (!p.x && !p.y) p = { x: 0, y: 1 };
          moveBody(h, p.x * (m - d), p.y * (m - d), solidHero);   // Страж твёрдый — отталкивает героя
        }
      });
    }
    function updateShots(dt) {
      S.shots.forEach(function (s) {
        if (s.t <= 0) return;
        var steps = 3;
        for (var k = 0; k < steps && s.t > 0; k++) {
          s.x += s.vx * dt / steps; s.y += s.vy * dt / steps;
          var tx = Math.floor(s.x / T), ty = Math.floor(s.y / T), l = lairCell(tx, ty);
          if (l) { hitLair(l, s.dmg); s.t = 0; break; }
          var c = cell(tx, ty); if (c === '#' || c === 'D') { s.t = 0; emit('wall', { x: s.x, y: s.y }); break; }
          for (var i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (e.hp > 0 && dist(s.x, s.y, e.x, e.y) < e.r + s.r) { hitEnemy(e, s.dmg, s.pi); s.t = 0; break; } }
          if (s.t > 0 && S.boss && !S.boss.dead && dist(s.x, s.y, S.boss.x, S.boss.y) < S.boss.r + s.r) { hitBoss(s.dmg); s.t = 0; }
        }
        s.t -= dt;
      });
      S.shots = S.shots.filter(function (s) { return s.t > 0; });
      S.spits.forEach(function (s) {
        s.x += s.vx * dt; s.y += s.vy * dt; s.t -= dt;
        var c = cell(Math.floor(s.x / T), Math.floor(s.y / T)); if (c === '#' || c === 'D') s.t = 0;
        S.heroes.forEach(function (h) { if (s.t > 0 && h.alive && dist(s.x, s.y, h.x, h.y) < h.r + s.r) { hurtHero(h, s.dmg, 'spit'); s.t = 0; } });
      });
      S.spits = S.spits.filter(function (s) { return s.t > 0; });
      S.swings.forEach(function (w) { w.t -= dt; }); S.swings = S.swings.filter(function (w) { return w.t > 0; });
    }
    // --- прокачка между этажами ---
    function updateUpgrade() {
      S.heroes.forEach(function (h) {
        var c = ctl[h.id], i = h.id; if (S.upDone[i]) return;
        var dy = c.dy || c.dx; if (dy && dy !== c.pdy) S.upCursor[i] = (S.upCursor[i] + (dy > 0 ? 1 : 2)) % 3;
        c.pdy = dy;
        if (c.fire && !c.pfire) choose(i, S.upCursor[i]);
      });
    }
    function choose(pi, k) {
      var h = S.heroes[pi]; if (S.phase !== 'upgrade' || !h || S.upDone[pi]) return false;
      var key = UPG[k]; if (!key) return false;
      if (h.up[key] < UPG_MAX) {
        var before = heroStats(h).maxHp; h.up[key]++;
        if (h.alive) h.hp += heroStats(h).maxHp - before;
      }
      S.upDone[pi] = true; emit('upgrade', { pi: pi, kind: key, level: h.up[key] });
      if (S.heroes.every(function (o) { return S.upDone[o.id]; })) loadFloor(S.floor + 1);
      return true;
    }

    var api = {
      start: function () { loadFloor(S.floor); return api; },
      setDir: function (pi, dx, dy) { if (ctl[pi]) { ctl[pi].dx = dx; ctl[pi].dy = dy; } },
      setFire: function (pi, on) { if (ctl[pi]) ctl[pi].fire = !!on; },
      bomb: bomb, choose: choose,
      update: function (dt) {
        if (S.over) return;
        S.time += dt; S.phaseT += dt; S.banner = Math.max(0, S.banner - dt); S.bombFlash = Math.max(0, S.bombFlash - dt);
        if (S.phase === 'play' || S.phase === 'dying') {
          updateHeroes(dt);
          if (S.phase === 'play' || S.phase === 'dying') { updateEnemies(dt); updateLairs(dt); updateBoss(dt); updateShots(dt); }
          S.lairs.forEach(function (l) { l.flash -= dt; });
          updateCam();
          if (S.phase === 'dying' && S.phaseT > 1.6) { S.phase = 'over'; S.over = true; emit('gameover', { score: S.score }); }
          else if (S.phase === 'won' && S.phaseT >= 0) { S.over = true; S.won = true; emit('win', { score: S.score }); }
        } else if (S.phase === 'won') { S.over = true; S.won = true; emit('win', { score: S.score }); }
        else if (S.phase === 'clear') {
          updateShots(dt);
          if (S.phaseT > 1.8) {
            if (S.floor >= S.maxFloor) { S.phase = 'won'; S.over = true; S.won = true; emit('win', { score: S.score }); }
            else { S.phase = 'upgrade'; S.phaseT = 0; S.upDone = [false, false]; S.upCursor = [0, 0]; ctl.forEach(function (c) { c.pfire = true; c.pdy = 0; }); emit('upgradeOpen', {}); }
          }
        } else if (S.phase === 'upgrade') updateUpgrade();
        ctl.forEach(function (c) { c.pfire = c.fire; });
      },
      state: function () { return S; },
      // для тестов
      _S: S, _ctl: ctl, _flow: function () { if (!flow) buildFlow(); return flow; }, _load: loadFloor, _openDoor: openDoor,
      _clear: floorClear, _spawn: spawnEnemy, _cam: updateCam
    };
    return api;
  }

  K.logic = {
    AIM_CONE: AIM_CONE, BIND: BIND, T: T, VIEW_W: VIEW_W, VIEW_H: VIEW_H, HUD: HUD, SCREEN_H: SCREEN_H, LEASH_PAD: LEASH_PAD, DRAIN: DRAIN, AGGRO: AGGRO,
    HEROES: HEROES, ENEMIES: ENEMIES, BOSS: BOSS, UPG: UPG, UPG_MAX: UPG_MAX, SCORE: SCORE, FOOD_HP: FOOD_HP,
    BOMB_DMG: BOMB_DMG, FLOORS: FLOORS, parseFloor: parseFloor, doorGroups: doorGroups, solveFloor: solveFloor,
    params: params, heroStats: heroStats, mulberry32: mulberry32
  };
  K.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
