/* ГОРНИЛО · логика (без DOM, детерминирована при заданном rng). GORNILO.Game(opts), GORNILO.logic
   Аренный шутер с видом сверху на 1–2 игроков, «два стика»: движение и стрельба в 8 направлениях раздельно.
   Испытание Горнила — турнир подмастерьев мастерской «Гефест» на арене-кузне: из четырёх ворот валят толпы
   механических заготовок; зачищенная комната открывает 2–3 выхода, по карте из комнат — к механизму-боссу этапа.
   Координаты: x, y — центр объекта в пикселях арены 640×480 (стены по 32 px, ворота посередине сторон). */
(function (global) {
  'use strict';
  var G = global.GORNILO = global.GORNILO || {};

  // ---------- Константы ----------
  var W = 640, H = 480, HUD = 32, SCREEN_H = HUD + H, WALL = 32;
  var IX0 = WALL, IY0 = WALL, IX1 = W - WALL, IY1 = H - WALL, GATE_HALF = 34;
  var GATES = {
    N: { x: 320, y: 16, nx: 0, ny: 1 }, S: { x: 320, y: 464, nx: 0, ny: -1 },
    W: { x: 16, y: 240, nx: 1, ny: 0 }, E: { x: 624, y: 240, nx: -1, ny: 0 }
  };
  var OPP = { N: 'S', S: 'N', W: 'E', E: 'W' };
  var SPEED = 150, HERO_R = 9, HIT_R = 6, LIVES = 3, CONTINUES = 2, CONT_T = 10;
  var RESPAWN_T = 1.4, INV_SPAWN = 2.5, EXTRA_LIFE = 35000, POWER_T = 14, LAYERS = 8;
  var GUN = {
    base:    { cd: 0.11, speed: 560, dmg: 1 },
    fan:     { cd: 0.16, speed: 540, dmg: 1, n: 5, spread: 0.17 },
    flame:   { cd: 0.035, speed: 330, dmg: 0.45, life: 0.30, pierce: 4 },
    grenade: { cd: 0.40, speed: 320, dmg: 5, range: 180, r: 54 },
    disc:    { cd: 0.20, speed: 430, dmg: 2, bounces: 3, life: 2.2, r: 7 }
  };
  var AUX = { ring: { t: 9, r: 30 }, hammers: { t: 12, r: 46, spin: 4.4, dmg: 2, hr: 11 } };
  var WEAPONS = ['fan', 'flame', 'grenade', 'disc'], POWERS = ['fan', 'flame', 'grenade', 'disc', 'ring', 'hammers'];
  var ENEMIES = {
    blank:  { r: 9, hp: 1, speed: 64, score: 50 },
    runner: { r: 8, hp: 1, speed: 112, score: 150, fuse: 0.45, trig: 42, blast: 40 },
    turret: { r: 14, hp: 7, score: 300, cd: 2.3, warn: 0.45, bullet: 175, rise: 0.9 },
    shield: { r: 13, hp: 5, speed: 36, score: 250, turn: 1.15, arc: 1.05 },
    roller: { r: 21, hp: 26, speed: 32, score: 1000, wind: 0.9, charge: 310, every: 3.4 }
  };
  var SCORE = { room: 500, gold: 500, part: 1500, core: 5000, stage: 5000 };
  var EB_R = 4, DROP = 0.022, PICK_LIFE = 9;
  // Раскладка: И1 — WASD ходьба, стрелки огонь; И2 — Home/Delete/End/PageDown ходьба, цифровой блок 8/4/5/6 огонь
  // (IJKL не годится: L — горячая клавиша языка). В одиночку обе раскладки ведут И1.
  var BIND = {
    p1: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
      aimL: ['ArrowLeft'], aimR: ['ArrowRight'], aimU: ['ArrowUp'], aimD: ['ArrowDown'] },
    p2: { left: ['Delete'], right: ['PageDown'], up: ['Home'], down: ['End'],
      aimL: ['Numpad4'], aimR: ['Numpad6'], aimU: ['Numpad8'], aimD: ['Numpad5'] }
  };
  // Планировки арен: препятствия-наковальни [x, y, w, h] и люки турелей [x, y]
  var LAYOUTS = [
    { blocks: [], hatches: [[160, 128], [480, 128], [160, 352], [480, 352]] },
    { blocks: [[150, 120, 72, 40], [418, 120, 72, 40], [150, 320, 72, 40], [418, 320, 72, 40]], hatches: [[320, 128], [320, 352], [128, 240], [512, 240]] },
    { blocks: [[184, 168, 32, 32], [424, 168, 32, 32], [184, 280, 32, 32], [424, 280, 32, 32]], hatches: [[320, 112], [320, 368], [200, 240], [440, 240]] },
    { blocks: [[272, 204, 96, 72]], hatches: [[144, 120], [496, 120], [144, 360], [496, 360]] },
    { blocks: [[120, 200, 120, 24], [400, 256, 120, 24]], hatches: [[180, 120], [460, 360], [460, 120], [180, 360]] }
  ];
  var KINDS = ['crowd', 'blast', 'turret', 'shield', 'roller', 'mixed', 'vault'];
  var BOSSES = [
    { key: 'press', hp: 60, part: 22 },
    { key: 'wheel', hp: 75, part: 26 },
    { key: 'colossus', hp: 95, part: 30 }
  ];
  var MAX_STAGE = 3;

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function angDiff(a, b) { var d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
  function ri(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  // ---------- Карта этапа: слои 0..7 по 3 колонки + босс ----------
  // Выходы: W → колонка c−1, N → c, E → c+1 (следующий слой). Вход в новую комнату — с противоположных ворот.
  function genStage(n, seed) {
    var rng = mulberry32((seed || 0) * 977 + n * 131 + 7), layers = [], l, c;
    for (l = 0; l < LAYERS; l++) {
      var row = [null, null, null];
      if (l === 0) row[1] = { l: 0, c: 1, kind: 'crowd', reward: null, danger: 1, layout: 0 };
      else {
        var hole = l >= 2 && l <= 6 && rng() < 0.35 ? ri(rng, 0, 2) : -1;
        for (c = 0; c < 3; c++) {
          if (c === hole) continue;
          var pool = ['crowd', 'blast', 'crowd'];
          if (n >= 2 || l >= 2) pool.push('turret');
          if (n >= 2 || l >= 3) pool.push('shield');
          if (n >= 2 || l >= 5) pool.push('roller');
          if (l >= 3) pool.push('mixed');
          if (l >= 2 && l <= 6) pool.push('vault');
          var kind = pick(rng, pool), rw = rng();
          var reward = kind === 'vault' ? 'weapon' : rw < 0.42 ? 'weapon' : rw < 0.7 ? 'gold' : rw < 0.8 ? 'life' : null;
          var danger = kind === 'vault' ? 1 : clamp(1 + Math.floor((l + n * 1.5 + rng() * 3) / 4), 1, 3);
          row[c] = { l: l, c: c, kind: kind, reward: reward, danger: danger, layout: kind === 'vault' ? 3 : ri(rng, 0, LAYOUTS.length - 1) };
        }
      }
      layers.push(row);
    }
    var boss = { l: LAYERS, c: 1, kind: 'boss', reward: null, danger: 3, layout: 0, exits: {} };
    for (l = 0; l < LAYERS; l++) for (c = 0; c < 3; c++) {
      var r = layers[l][c]; if (!r) continue; r.exits = {};
      if (l === LAYERS - 1) { r.exits.N = { l: LAYERS, c: 1 }; continue; }
      var nx = layers[l + 1];
      if (c > 0 && nx[c - 1]) r.exits.W = { l: l + 1, c: c - 1 };
      if (nx[c]) r.exits.N = { l: l + 1, c: c };
      if (c < 2 && nx[c + 1]) r.exits.E = { l: l + 1, c: c + 1 };
      // изредка закрываем одну из трёх дверей (остаётся ≥ 2 ветки)
      var ks = Object.keys(r.exits);
      if (ks.length === 3 && rng() < 0.3) delete r.exits[pick(rng, ['W', 'E'])];
    }
    // у каждой комнаты слоя ≥ 1 должен быть вход: иначе пробиваем дверь из соседа выше по связности
    for (l = 1; l < LAYERS; l++) for (c = 0; c < 3; c++) {
      if (!layers[l][c]) continue;
      var has = false, pc;
      for (pc = 0; pc < 3; pc++) { var p = layers[l - 1][pc]; if (p) for (var k in p.exits) if (p.exits[k].l === l && p.exits[k].c === c) has = true; }
      if (!has) for (pc = 0; pc < 3; pc++) { var q = layers[l - 1][pc]; if (!q || Math.abs(pc - c) > 1) continue; q.exits[c < pc ? 'W' : c > pc ? 'E' : 'N'] = { l: l, c: c }; break; }
    }
    return { n: n, layers: layers, boss: boss };
  }
  function roomAt(map, l, c) { return l === LAYERS ? map.boss : (map.layers[l] && map.layers[l][c]) || null; }
  // Связность: из старта достижима каждая комната и босс; из каждой комнаты достижим босс. → {ok, reach, rooms, minLen, maxLen}
  function solveMap(map) {
    var seen = {}, q = [[0, 1]], rooms = 0, reach = 0, k;
    seen['0,1'] = 1;
    while (q.length) {
      var p = q.shift(), r = roomAt(map, p[0], p[1]); if (!r || !r.exits) continue;
      for (k in r.exits) { var e = r.exits[k], id = e.l + ',' + e.c; if (!seen[id]) { seen[id] = 1; q.push([e.l, e.c]); } }
    }
    map.layers.forEach(function (row) { row.forEach(function (r) { if (r) { rooms++; if (seen[r.l + ',' + r.c]) reach++; } }); });
    function toBoss(l, c, memo) {
      var id = l + ',' + c; if (memo[id] != null) return memo[id];
      if (l === LAYERS) return (memo[id] = [0, 0]);
      var r = roomAt(map, l, c), best = null; if (!r) return (memo[id] = null);
      for (var kk in r.exits) { var s = toBoss(r.exits[kk].l, r.exits[kk].c, memo); if (s) best = best ? [Math.min(best[0], s[0] + 1), Math.max(best[1], s[1] + 1)] : [s[0] + 1, s[1] + 1]; }
      return (memo[id] = best);
    }
    var memo = {}, allToBoss = true;
    map.layers.forEach(function (row) { row.forEach(function (r) { if (r && !toBoss(r.l, r.c, memo)) allToBoss = false; }); });
    var len = toBoss(0, 1, memo) || [0, 0];
    return { ok: reach === rooms && !!seen[LAYERS + ',1'] && allToBoss, reach: reach, rooms: rooms, minLen: len[0], maxLen: len[1], boss: !!seen[LAYERS + ',1'] };
  }

  // ---------- Волны комнаты ----------
  function makeWaves(stage, room, players, rng) {
    var l = room.l, k = room.kind, co = players === 2 ? 1.6 : 1;
    var nb = Math.round((14 + 2.4 * l + 6 * (stage - 1)) * co);
    var nw = k === 'vault' ? 2 : 3 + (l >= 4 ? 1 : 0) + (stage >= 2 ? 1 : 0);
    var waves = [], gates = ['N', 'E', 'S', 'W'];
    for (var i = 0; i < nw; i++) {
      var g = [], last = i === nw - 1;
      var add = function (type, n, gate) { if (n > 0) g.push({ type: type, n: n, gate: gate || 'all' }); };
      var b = Math.round(nb * (0.75 + 0.15 * i));
      if (k === 'vault') { add('blank', Math.round(b * 0.7)); if (i) add('runner', 2 + stage); }
      else if (k === 'crowd') { add('blank', Math.round(b * 1.25)); if (i >= 1) add('runner', Math.round((1 + l / 3 + stage) * co)); }
      else if (k === 'blast') { add('blank', Math.round(b * 0.6)); add('runner', Math.round((4 + l / 2 + stage * 2) * co)); }
      else if (k === 'turret') { add('blank', Math.round(b * 0.8)); if (i === 0 || last) add('turret', Math.min(4, 1 + stage + (l >= 4 ? 1 : 0))); }
      else if (k === 'shield') { add('blank', Math.round(b * 0.7)); add('shield', Math.round((2 + l / 3 + stage) * co)); }
      else if (k === 'roller') { add('blank', Math.round(b * 0.8)); if (i === 1 || last) add('roller', stage >= 3 && last ? 2 : 1); }
      else { add('blank', Math.round(b * 0.8)); add(pick(rng, ['runner', 'shield', 'runner']), Math.round((2 + stage) * co)); if (last && l >= 5) add(stage >= 2 ? 'roller' : 'turret', 1 + (stage >= 3 ? 1 : 0)); }
      g.forEach(function (gr) { if (gr.gate === 'all' && gr.type !== 'turret') gr.gate = rng() < 0.65 ? 'all' : pick(rng, gates); });
      waves.push(g);
    }
    return waves;
  }

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, emit = opts.onEvent || function () {};
    var NP = opts.players === 2 ? 2 : 1, maxStage = opts.maxStage || MAX_STAGE, seed = opts.seed || 0;
    var S = {
      stage: opts.stage || 1, maxStage: maxStage, players: NP, score: 0, phase: 'play', phaseT: 0, contT: 0,
      continues: opts.continues != null ? opts.continues : CONTINUES, time: 0, banner: 0, nextLife: EXTRA_LIFE * (NP === 2 ? 1.5 : 1),
      map: null, room: null, roomNo: 1, path: [], roomState: 'enter', roomT: 0, waves: [], wave: 0, waveT: 0, queue: [],
      layout: LAYOUTS[0], blocks: [], hatches: [], entry: 'S', heroes: [], enemies: [], bullets: [], ebullets: [], booms: [],
      slams: [], pickups: [], boss: null, kills: 0, peak: 0, rooms: 0, next: null, transT: 0, bossKey: BOSSES[0].key
    };
    for (var i = 0; i < NP; i++) S.heroes.push({ id: i, x: 320, y: 400, alive: true, out: false, lives: LIVES, deadT: 0, inv: INV_SPAWN,
      mx: 0, my: 0, ax: 0, ay: 0, ang: -Math.PI / 2, cd: 0, weapon: 'base', wT: 0, ring: 0, hammers: 0, hamA: 0, moving: false, kills: 0 });
    var eid = 1;

    // ----- геометрия -----
    function inBlock(x, y, r) { for (var i = 0; i < S.blocks.length; i++) { var b = S.blocks[i]; if (x + r > b[0] && x - r < b[0] + b[2] && y + r > b[1] && y - r < b[1] + b[3]) return b; } return null; }
    function pushOut(o, r) {   // круг из прямоугольников-наковален
      for (var i = 0; i < S.blocks.length; i++) {
        var b = S.blocks[i], nx = clamp(o.x, b[0], b[0] + b[2]), ny = clamp(o.y, b[1], b[1] + b[3]), dx = o.x - nx, dy = o.y - ny, d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        if (d2 > 0.0001) { var d = Math.sqrt(d2); o.x = nx + dx / d * r; o.y = ny + dy / d * r; }
        else { var l = o.x - b[0], rr = b[0] + b[2] - o.x, t = o.y - b[1], bb = b[1] + b[3] - o.y, m = Math.min(l, rr, t, bb);
          if (m === l) o.x = b[0] - r; else if (m === rr) o.x = b[0] + b[2] + r; else if (m === t) o.y = b[1] - r; else o.y = b[1] + b[3] + r; }
      }
    }
    function gateOpen(g) { return S.roomState === 'cleared' && S.room && S.room.exits && !!S.room.exits[g]; }
    function inGateSpan(g, x, y, r) { var G0 = GATES[g]; return G0.nx ? Math.abs(y - G0.y) < GATE_HALF - r : Math.abs(x - G0.x) < GATE_HALF - r; }
    function clampHero(h) {
      var r = HERO_R, x0 = IX0 + r, x1 = IX1 - r, y0 = IY0 + r, y1 = IY1 - r;
      if (gateOpen('W') && inGateSpan('W', h.x, h.y, r)) x0 = 0;
      if (gateOpen('E') && inGateSpan('E', h.x, h.y, r)) x1 = W;
      if (gateOpen('N') && inGateSpan('N', h.x, h.y, r)) y0 = 0;
      h.x = clamp(h.x, x0, x1); h.y = clamp(h.y, y0, y1);
      pushOut(h, r);
    }
    function segRect(x1, y1, x2, y2, b, pad) {   // отрезок пересекает прямоугольник (Лян — Барски)
      var x0 = b[0] - pad, y0 = b[1] - pad, xa = b[0] + b[2] + pad, ya = b[1] + b[3] + pad, dx = x2 - x1, dy = y2 - y1, t0 = 0, t1 = 1;
      var P = [-dx, dx, -dy, dy], Q = [x1 - x0, xa - x1, y1 - y0, ya - y1];
      for (var i = 0; i < 4; i++) { if (P[i] === 0) { if (Q[i] < 0) return false; } else { var t = Q[i] / P[i]; if (P[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } } }
      return true;
    }
    function los(x1, y1, x2, y2, pad) { for (var i = 0; i < S.blocks.length; i++) if (segRect(x1, y1, x2, y2, S.blocks[i], pad || 0)) return false; return true; }
    // Поле потока (BFS по клеткам 16 px от каждого героя) — толпа обходит наковальни
    var FC = 16, FW = W / FC, FH = H / FC, flow = [null, null], flowT = 0;
    function buildFlow() {
      for (var pi = 0; pi < S.heroes.length; pi++) {
        var h = S.heroes[pi]; if (!h.alive) { flow[pi] = null; continue; }
        var f = flow[pi] || (flow[pi] = new Int16Array(FW * FH)); f.fill(-1);
        var s0 = clamp(Math.floor(h.x / FC), 0, FW - 1) + clamp(Math.floor(h.y / FC), 0, FH - 1) * FW, q = [s0], qi = 0; f[s0] = 0;
        while (qi < q.length) {
          var k = q[qi++], c = k % FW, r = (k - c) / FW;
          for (var d = 0; d < 4; d++) {
            var nc = c + (d === 0 ? 1 : d === 1 ? -1 : 0), nr = r + (d === 2 ? 1 : d === 3 ? -1 : 0);
            if (nc < 0 || nr < 0 || nc >= FW || nr >= FH) continue;
            var nk = nc + nr * FW; if (f[nk] >= 0) continue;
            if (inBlock(nc * FC + FC / 2, nr * FC + FC / 2, 7)) { f[nk] = 32000; continue; }
            f[nk] = f[k] + 1; q.push(nk);
          }
        }
      }
    }
    function flowDir(e, h) {   // → угол к соседней клетке с меньшей дистанцией или null (прямо видно)
      if (!S.blocks.length || los(e.x, e.y, h.x, h.y, e.r)) return null;
      var f = flow[h.id]; if (!f) return null;
      var c = clamp(Math.floor(e.x / FC), 0, FW - 1), r = clamp(Math.floor(e.y / FC), 0, FH - 1), best = 32000, bx = 0, by = 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; var nc = c + dx, nr = r + dy; if (nc < 0 || nr < 0 || nc >= FW || nr >= FH) continue;
        var v = f[nc + nr * FW]; if (v >= 0 && v < best) { best = v; bx = nc * FC + FC / 2; by = nr * FC + FC / 2; }
      }
      return best < 32000 ? Math.atan2(by - e.y, bx - e.x) : null;
    }
    function wallHit(x, y, r) { return x - r < IX0 || x + r > IX1 || y - r < IY0 || y + r > IY1 || !!inBlock(x, y, r); }

    // ----- комнаты -----
    function startStage(n) {
      S.stage = n; S.map = opts.map || genStage(n, seed); S.path = [[0, 1]]; S.roomNo = 1; S.bossKey = BOSSES[(n - 1) % BOSSES.length].key;
      S.banner = 2.4; emit('stage', { stage: n });
      loadRoom(roomAt(S.map, 0, 1), 'S');
    }
    function loadRoom(room, entry) {
      S.room = room; S.entry = entry; S.layout = LAYOUTS[room.layout || 0]; S.blocks = S.layout.blocks; S.hatches = S.layout.hatches;
      S.enemies = []; S.bullets = []; S.ebullets = []; S.booms = []; S.slams = []; S.pickups = []; S.queue = []; S.boss = null;
      S.roomState = 'enter'; S.roomT = 0; S.wave = 0; S.waveT = 0; S.phase = 'play';
      S.waves = room.kind === 'boss' ? [] : (opts.waves ? opts.waves(S.stage, room) : makeWaves(S.stage, room, NP, rng));
      var G0 = GATES[entry];
      S.heroes.forEach(function (h, i) {
        var off = NP === 2 ? (i ? 22 : -22) : 0;
        h.x = G0.x + G0.nx * 56 + (G0.nx ? 0 : off); h.y = G0.y + G0.ny * 56 + (G0.ny ? 0 : off);
        if (G0.nx) h.y += off;
        h.cd = 0.2;
        if (h.alive) h.inv = Math.max(h.inv, 1.0);
      });
      if (room.kind === 'boss') makeBoss();
      emit('room', { l: room.l, c: room.c, kind: room.kind, no: S.roomNo });
    }
    function respawnPoint(i) { var G0 = GATES[S.entry]; return { x: G0.x + G0.nx * 60 + (i ? 20 : 0), y: G0.y + G0.ny * 60 }; }

    // ----- враги -----
    function spawn(type, x, y, o) {
      var D = ENEMIES[type], sm = 1 + 0.08 * (S.stage - 1);
      var e = { id: eid++, type: type, x: x, y: y, r: D.r, hp: D.hp, max: D.hp, speed: (D.speed || 0) * sm * (0.9 + rng() * 0.2), ang: 0,
        dead: false, flash: 0, t: 0, cd: 0, warn: 0, fuse: 0, enter: null, rise: 0, state: 'walk', vx: 0, vy: 0, wob: rng() * 6.28, hitBy: 0 };
      if (type === 'turret') { e.rise = D.rise; e.cd = 1.2 + rng() * D.cd; e.hp = e.max = D.hp + (S.stage - 1) * 2; }
      if (type === 'roller') { e.hp = e.max = D.hp + (S.stage - 1) * 8; e.cd = 1.5 + rng() * 1.5; }
      if (type === 'shield') { e.hp = e.max = D.hp + (S.stage - 1); }
      if (NP === 2 && (type === 'roller' || type === 'turret')) { e.hp = Math.round(e.hp * 1.4); e.max = e.hp; }
      if (o) for (var k in o) e[k] = o[k];
      S.enemies.push(e); emit('spawn', { type: type, x: x, y: y });
      return e;
    }
    function spawnFromGate(type, g) {
      var G0 = GATES[g], j = (rng() - 0.5) * (GATE_HALF * 1.4);
      var x = G0.x + (G0.nx ? -G0.nx * 6 : j), y = G0.y + (G0.ny ? -G0.ny * 6 : j);
      var e = spawn(type, x, y); e.enter = g; e.ang = Math.atan2(G0.ny, G0.nx); return e;
    }
    function startWave() {
      var wv = S.waves[S.wave], t = 0, gates = ['N', 'E', 'S', 'W'].filter(function (g) { return !(S.roomT < 5 && g === S.entry); });
      wv.forEach(function (gr) {
        if (gr.type === 'turret') {
          var hs = S.hatches.slice(), busy = S.enemies.filter(function (e) { return e.type === 'turret' && !e.dead; });
          for (var k = 0; k < gr.n && hs.length; k++) {
            var hi = Math.floor(rng() * hs.length), hp = hs.splice(hi, 1)[0];
            if (busy.some(function (e) { return dist(e.x, e.y, hp[0], hp[1]) < 10; })) { k--; continue; }
            S.queue.push({ t: t + k * 0.3, type: 'turret', x: hp[0], y: hp[1] });
          }
          return;
        }
        for (var n = 0; n < gr.n; n++) {
          var g = gr.gate === 'all' ? gates[(n + S.wave) % gates.length] : (gr.gate === S.entry && S.roomT < 5 ? gates[n % gates.length] : gr.gate);
          var step = gr.type === 'blank' ? 0.13 : 0.4, slot = gr.gate === 'all' ? Math.floor(n / gates.length) * 1.5 : n;   // «все ворота» — пачками
          S.queue.push({ t: t + slot * step + rng() * 0.1, type: gr.type, gate: g });
        }
      });
      S.queue.sort(function (a, b) { return a.t - b.t; });
      S.waveT = 0; S.wave++;
      emit('wave', { n: S.wave, of: S.waves.length });
    }
    function aliveEnemies() { var n = 0; for (var i = 0; i < S.enemies.length; i++) if (!S.enemies[i].dead) n++; return n; }
    function nearestHero(x, y) {
      var best = null, bd = 1e9;
      for (var i = 0; i < S.heroes.length; i++) { var h = S.heroes[i]; if (!h.alive) continue; var d = dist(x, y, h.x, h.y); if (d < bd) { bd = d; best = h; } }
      return best;
    }
    function award(pi, pts) {
      S.score += pts;
      while (S.score >= S.nextLife) {
        S.nextLife += EXTRA_LIFE * (NP === 2 ? 1.5 : 1);
        S.heroes.forEach(function (h) { if (!h.out) { h.lives++; emit('extraLife', { pi: h.id }); } });
      }
    }
    function killEnemy(e, pi, how) {
      if (e.dead) return; e.dead = true; S.kills++;
      var D = ENEMIES[e.type];
      if (pi != null && pi >= 0) { award(pi, D.score); if (S.heroes[pi]) S.heroes[pi].kills++; }
      emit('kill', { type: e.type, x: e.x, y: e.y, pi: pi, how: how });
      if (e.type === 'runner') blast(e.x, e.y, D.blast, 3, pi, true);
      if (pi != null && pi >= 0 && how !== 'boss') {
        var ch = e.type === 'roller' ? 0.7 : e.type === 'blank' ? DROP : DROP * 3;
        if (rng() < ch) dropPickup(e.x, e.y, rng() < 0.25 ? 'gold' : pick(rng, POWERS));
      }
    }
    function dropPickup(x, y, kind) {
      x = clamp(x, IX0 + 22, IX1 - 22); y = clamp(y, IY0 + 22, IY1 - 22);
      var tries = [[0, 0], [0, 70], [0, -70], [0, 100], [0, -100], [-130, 0], [130, 0]], o = { x: x, y: y };
      for (var i = 0; i < tries.length; i++) { var tx = clamp(x + tries[i][0], IX0 + 22, IX1 - 22), ty = clamp(y + tries[i][1], IY0 + 22, IY1 - 22); if (!inBlock(tx, ty, 16)) { o.x = tx; o.y = ty; break; } }
      pushOut(o, 14);
      S.pickups.push({ x: o.x, y: o.y, kind: kind, t: PICK_LIFE });
    }
    function hurtEnemy(e, d, pi, how) {
      if (e.dead || (e.type === 'turret' && e.rise > 0.3)) return false;
      e.hp -= d; e.flash = 0.08;
      if (e.hp <= 0) killEnemy(e, pi, how); else emit('hit', { x: e.x, y: e.y, type: e.type });
      return true;
    }
    function blast(x, y, r, dmg, pi, enemyMade) {
      S.booms.push({ x: x, y: y, r: r, t: 0.4, max: 0.4, enemy: !!enemyMade });
      emit('boom', { x: x, y: y, r: r });
      for (var i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (!e.dead && dist(x, y, e.x, e.y) < r + e.r) hurtEnemy(e, dmg, pi, 'blast'); }
      if (enemyMade) S.heroes.forEach(function (h) { if (h.alive && dist(x, y, h.x, h.y) < r * 0.7 + HIT_R) killHero(h, 'blast'); });
      else if (S.boss) hurtBossAt(x, y, r, dmg * 0.6, pi);
    }

    // ----- герои -----
    function killHero(h, src) {
      if (!h.alive || h.inv > 0 || h.ring > 0) return false;
      h.alive = false; h.lives--; h.deadT = RESPAWN_T; h.weapon = 'base'; h.wT = 0; h.hammers = 0;
      emit('heroDie', { pi: h.id, x: h.x, y: h.y, src: src });
      if (h.lives <= 0) { h.out = true; emit('out', { pi: h.id }); }
      return true;
    }
    function respawn(h) {
      var p = respawnPoint(h.id); h.x = p.x; h.y = p.y; clampHero(h);
      h.alive = true; h.inv = INV_SPAWN; h.cd = 0.3;
      // «искра возрождения» — разметает мелочь вокруг
      S.enemies.forEach(function (e) { if (!e.dead && (e.type === 'blank' || e.type === 'runner') && dist(e.x, e.y, h.x, h.y) < 90) { e.dead = true; emit('kill', { type: e.type, x: e.x, y: e.y, pi: -1, how: 'spark' }); } });
      S.ebullets = S.ebullets.filter(function (b) { return dist(b.x, b.y, h.x, h.y) > 120; });
      emit('respawn', { pi: h.id });
    }
    function fire(h) {
      var a = Math.atan2(h.ay, h.ax), wpn = h.weapon, gx = h.x + Math.cos(a) * 12, gy = h.y + Math.sin(a) * 12, G1 = GUN[wpn];
      if (wpn === 'base') S.bullets.push({ k: 'b', pi: h.id, x: gx, y: gy, vx: Math.cos(a) * G1.speed, vy: Math.sin(a) * G1.speed, dmg: G1.dmg, r: 3, life: 2 });
      else if (wpn === 'fan') for (var i = 0; i < G1.n; i++) { var aa = a + (i - (G1.n - 1) / 2) * G1.spread; S.bullets.push({ k: 'b', pi: h.id, x: gx, y: gy, vx: Math.cos(aa) * G1.speed, vy: Math.sin(aa) * G1.speed, dmg: G1.dmg, r: 3, life: 2 }); }
      else if (wpn === 'flame') { var fa = a + (rng() - 0.5) * 0.3, sp = G1.speed * (0.85 + rng() * 0.3); S.bullets.push({ k: 'f', pi: h.id, x: gx, y: gy, vx: Math.cos(fa) * sp, vy: Math.sin(fa) * sp, dmg: G1.dmg, r: 7, life: G1.life, max: G1.life, left: G1.pierce, hit: [] }); }
      else if (wpn === 'grenade') S.bullets.push({ k: 'g', pi: h.id, x: gx, y: gy, vx: Math.cos(a) * G1.speed, vy: Math.sin(a) * G1.speed, dmg: G1.dmg, r: 5, life: G1.range / G1.speed });
      else if (wpn === 'disc') S.bullets.push({ k: 'd', pi: h.id, x: gx, y: gy, vx: Math.cos(a) * G1.speed, vy: Math.sin(a) * G1.speed, dmg: G1.dmg, r: G1.r, life: G1.life, bounces: G1.bounces, hit: [] });
      h.cd = G1.cd;
      emit('shot', { pi: h.id, w: wpn });
    }
    function collect(h, p) {
      if (p.kind === 'gold') { award(h.id, SCORE.gold * S.stage); emit('gold', { pi: h.id, x: p.x, y: p.y }); }
      else if (p.kind === 'life') { h.lives++; emit('extraLife', { pi: h.id }); }
      else if (p.kind === 'ring') { h.ring = AUX.ring.t; emit('power', { pi: h.id, kind: p.kind, x: p.x, y: p.y }); }
      else if (p.kind === 'hammers') { h.hammers = AUX.hammers.t; emit('power', { pi: h.id, kind: p.kind, x: p.x, y: p.y }); }
      else { h.weapon = p.kind; h.wT = POWER_T; emit('power', { pi: h.id, kind: p.kind, x: p.x, y: p.y }); }
    }

    // ----- босс -----
    function makeBoss() {
      var B = BOSSES[(S.stage - 1) % BOSSES.length], hm = NP === 2 ? 1.8 : 1, parts = [];
      var ph = Math.round((B.part + 4 * (S.stage - 1)) * hm);
      function part(kind, ox, oy, r) { parts.push({ kind: kind, ox: ox, oy: oy, r: r, hp: ph, max: ph, dead: false, cd: 1 + parts.length * 0.6, warn: 0, flash: 0, x: 0, y: 0, on: 0 }); }
      var b = { key: B.key, x: 320, y: 120, r: 40, hp: Math.round(B.hp * hm), max: Math.round(B.hp * hm), parts: parts, armored: true, t: 0, intro: 1.6, dead: false, deadT: 0, flash: 0, rot: 0, cd: 2, spawnCd: 3, vx: 0 };
      if (B.key === 'press') { b.r = 44; b.y = 110; part('hammer', -96, 18, 20); part('hammer', 96, 18, 20); part('cannon', -46, 50, 15); part('cannon', 46, 50, 15); }
      else if (B.key === 'wheel') { b.r = 44; b.y = 200; part('nozzle', 62, 0, 14); part('nozzle', 0, 62, 14); part('nozzle', -62, 0, 14); part('nozzle', 0, -62, 14); part('hatch', 44, 44, 13); part('hatch', -44, -44, 13); }
      else { b.r = 40; b.y = 120; part('bellows', -58, 34, 16); part('bellows', 58, 34, 16); part('hammer', -84, -10, 18); part('hammer', 84, -10, 18); part('hatch', -34, -44, 13); part('hatch', 34, -44, 13); }
      S.boss = b; placeParts(b);
      emit('bossIntro', { key: b.key });
    }
    function placeParts(b) {
      b.parts.forEach(function (p) {
        if (b.key === 'wheel') { var c = Math.cos(b.rot), s = Math.sin(b.rot); p.x = b.x + p.ox * c - p.oy * s; p.y = b.y + p.ox * s + p.oy * c; }
        else { p.x = b.x + p.ox; p.y = b.y + p.oy; }
      });
    }
    function eshot(x, y, a, sp, kind) { S.ebullets.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: EB_R, kind: kind || 'shot', life: 5 }); }
    function hurtBossAt(x, y, r, d, pi) {
      var b = S.boss; if (!b || b.dead || b.intro > 0) return false;
      var hit = false;
      b.parts.forEach(function (p) { if (!p.dead && dist(x, y, p.x, p.y) < r + p.r) { hurtPart(b, p, d, pi); hit = true; } });
      if (dist(x, y, b.x, b.y) < r + b.r) { hit = true; if (!b.armored) hurtCore(b, d, pi); else emit('armor', { x: x, y: y }); }
      return hit;
    }
    function hurtPart(b, p, d, pi) {
      p.hp -= d; p.flash = 0.08; emit('bossHit', { x: p.x, y: p.y });
      if (p.hp <= 0) {
        p.dead = true; award(pi, SCORE.part); S.booms.push({ x: p.x, y: p.y, r: 40, t: 0.6, max: 0.6 });
        emit('partDie', { x: p.x, y: p.y, kind: p.kind });
        if (b.parts.every(function (q) { return q.dead; })) { b.armored = false; b.cd = 1.2; emit('coreOpen', { x: b.x, y: b.y }); }
      }
    }
    function hurtCore(b, d, pi) {
      b.hp -= d; b.flash = 0.08; emit('bossHit', { x: b.x, y: b.y, core: true });
      if (b.hp <= 0 && !b.dead) {
        b.dead = true; b.deadT = 2.2; award(pi == null || pi < 0 ? 0 : pi, SCORE.core * S.stage);
        S.ebullets = []; S.slams = [];
        S.enemies.forEach(function (e) { if (!e.dead) killEnemy(e, -1, 'boss'); });
        emit('bossDie', { x: b.x, y: b.y, key: b.key });
      }
    }
    function bossUpdate(dt) {
      var b = S.boss; if (!b) return;
      if (b.dead) { b.deadT -= dt; if (b.deadT <= 0 && S.phase === 'play') stageClear(); return; }
      if (b.intro > 0) { b.intro -= dt; return; }
      b.t += dt; if (b.flash > 0) b.flash -= dt;
      var tg = nearestHero(b.x, b.y), rate = 1 + 0.12 * (S.stage - 1) + (b.armored ? 0 : 0.35), mob = NP === 2 ? 1.15 : 1;
      if (b.key === 'press') { b.x = 320 + Math.sin(b.t * 0.45) * 170; if (!b.armored) b.y = Math.min(200, b.y + dt * 8); }
      else if (b.key === 'wheel') { b.rot += dt * (0.55 + (b.armored ? 0 : 0.4)); if (tg) { var a0 = Math.atan2(tg.y - b.y, tg.x - b.x); b.x = clamp(b.x + Math.cos(a0) * 16 * dt, 120, 520); b.y = clamp(b.y + Math.sin(a0) * 16 * dt, 110, 370); } }
      else if (tg) { var a1 = Math.atan2(tg.y - b.y, tg.x - b.x), sp = b.armored ? 22 : 34; b.x = clamp(b.x + Math.cos(a1) * sp * dt, 130, 510); b.y = clamp(b.y + Math.sin(a1) * sp * dt, 100, 380); }
      placeParts(b);
      b.parts.forEach(function (p) {
        if (p.dead) return; if (p.flash > 0) p.flash -= dt;
        p.cd -= dt * rate * mob;
        if (p.kind === 'hammer') { if (p.cd <= 0 && tg) { p.cd = 3.4; S.slams.push({ x: tg.x, y: tg.y, r: 48, t: 1.1, max: 1.1, from: p }); emit('slamWarn', {}); } }
        else if (p.kind === 'cannon') {
          if (p.warn > 0) { p.warn -= dt; if (p.warn <= 0 && tg) { var a = Math.atan2(tg.y - p.y, tg.x - p.x); for (var k = -1; k <= 1; k++) eshot(p.x, p.y, a + k * 0.22, 165 + S.stage * 10); emit('eshot', {}); } }
          else if (p.cd <= 0) { p.cd = 2.1; p.warn = 0.45; }
        } else if (p.kind === 'nozzle') {
          p.on += dt; var cyc = p.on % 2.6;
          if (cyc < 1.2 && p.cd <= 0) { p.cd = 0.3; var an = Math.atan2(p.y - b.y, p.x - b.x); eshot(p.x, p.y, an, 150 + S.stage * 8); }
        } else if (p.kind === 'hatch') {
          if (p.cd <= 0) { p.cd = 4.6; var nE = aliveEnemies(); if (nE < 18 + NP * 4) for (var q = 0; q < (b.key === 'wheel' ? 2 : 3); q++) spawn(b.key === 'wheel' ? 'runner' : 'blank', p.x + (rng() - 0.5) * 20, p.y + 16 + q * 6); }
        } else if (p.kind === 'bellows') {
          if (p.warn > 0) { p.warn -= dt; if (tg && Math.floor(p.warn * 20) % 2 === 0) { var ab = Math.atan2(tg.y - p.y, tg.x - p.x) + (rng() - 0.5) * 0.5; if (p.warn < 0.9) eshot(p.x, p.y, ab, 190, 'flame'); } }
          else if (p.cd <= 0) { p.cd = 3.0; p.warn = 1.2; emit('bellows', {}); }
        }
      });
      if (!b.armored) {
        b.cd -= dt * rate * mob;
        if (b.cd <= 0) {
          b.cd = 1.7; var n = 12 + S.stage * 2, off = rng() * 6.28;
          for (var k2 = 0; k2 < n; k2++) eshot(b.x, b.y, off + k2 / n * 6.283, 130 + S.stage * 10);
          if (tg) { var at = Math.atan2(tg.y - b.y, tg.x - b.x); eshot(b.x, b.y, at, 200); }
          emit('ring', {});
        }
      }
      // подкрепление из ворот — мелочь, чтобы не стоять на месте
      b.spawnCd -= dt;
      if (b.spawnCd <= 0) { b.spawnCd = 4.2; if (aliveEnemies() < 16 + NP * 4) { var gs = ['W', 'E', 'S']; for (var j = 0; j < 2 + NP; j++) spawnFromGate('blank', gs[j % 3]); } }
      S.heroes.forEach(function (h) { if (h.alive && dist(h.x, h.y, b.x, b.y) < b.r + HIT_R) killHero(h, 'boss'); });
    }

    // ----- фазы -----
    function stageClear() {
      var bonus = SCORE.stage * S.stage; award(0, bonus);
      S.phase = 'clear'; S.phaseT = 3.6; emit('clear', { stage: S.stage, bonus: bonus });
    }
    function roomCleared() {
      S.roomState = 'cleared'; S.rooms++;
      var pts = SCORE.room * S.stage * (S.room.danger || 1); award(0, pts);
      var rw = S.room.reward;
      if (rw === 'weapon') { dropPickup(300, 240, pick(rng, WEAPONS)); if (S.room.kind === 'vault') { dropPickup(340, 240, pick(rng, ['ring', 'hammers'])); for (var g = 0; g < 3; g++) dropPickup(280 + g * 40, 280, 'gold'); } }
      else if (rw === 'gold') for (var k = 0; k < 4; k++) dropPickup(260 + k * 40, 240, 'gold');
      else if (rw === 'life') dropPickup(320, 240, 'life');
      S.heroes.forEach(function (h) { if (!h.alive && !h.out) h.deadT = Math.min(h.deadT, 0.3); });
      emit('roomClear', { bonus: pts, reward: rw });
    }
    function takeExit(g) {
      var ex = S.room.exits[g]; if (!ex) return false;
      S.next = { l: ex.l, c: ex.c, entry: OPP[g] }; S.phase = 'trans'; S.transT = 1.5;
      S.path.push([ex.l, ex.c]);
      emit('exit', { gate: g, l: ex.l, c: ex.c });
      return true;
    }

    // ----- шаг -----
    var hash = null, HC = 40, HCW = Math.ceil(W / HC) + 1, HCH = Math.ceil(H / HC) + 1;
    function buildHash() {
      hash = new Array(HCW * HCH);
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (e.dead) continue;
        var k = clamp(Math.floor(e.x / HC), 0, HCW - 1) + clamp(Math.floor(e.y / HC), 0, HCH - 1) * HCW;
        (hash[k] || (hash[k] = [])).push(e);
      }
    }
    function near(x, y, fn) {
      var cx = clamp(Math.floor(x / HC), 0, HCW - 1), cy = clamp(Math.floor(y / HC), 0, HCH - 1);
      for (var yy = Math.max(0, cy - 1); yy <= Math.min(HCH - 1, cy + 1); yy++) for (var xx = Math.max(0, cx - 1); xx <= Math.min(HCW - 1, cx + 1); xx++) {
        var l = hash[xx + yy * HCW]; if (!l) continue;
        for (var i = 0; i < l.length; i++) if (fn(l[i]) === true) return true;
      }
      return false;
    }

    function stepHeroes(dt) {
      S.heroes.forEach(function (h) {
        if (!h.alive) {
          if (!h.out && S.phase === 'play') { h.deadT -= dt; if (h.deadT <= 0) respawn(h); }
          return;
        }
        if (h.inv > 0) h.inv -= dt;
        if (h.ring > 0) h.ring -= dt;
        if (h.hammers > 0) { h.hammers -= dt; h.hamA += AUX.hammers.spin * dt; }
        if (h.wT > 0) { h.wT -= dt; if (h.wT <= 0) { h.weapon = 'base'; emit('powerEnd', { pi: h.id }); } }
        var l = Math.sqrt(h.mx * h.mx + h.my * h.my);
        h.moving = l > 0;
        if (l > 0) { h.x += h.mx / l * SPEED * dt; h.y += h.my / l * SPEED * dt; }
        clampHero(h);
        // твёрдые: турели, босс-каток не твёрдый (касание — гибель)
        for (var i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (e.dead || e.type !== 'turret') continue; var d = dist(h.x, h.y, e.x, e.y), m = e.r + HERO_R; if (d < m && d > 0.01) { h.x = e.x + (h.x - e.x) / d * m; h.y = e.y + (h.y - e.y) / d * m; } }
        if (h.ax || h.ay) h.ang = Math.atan2(h.ay, h.ax); else if (l > 0) h.ang = Math.atan2(h.my, h.mx);
        h.cd -= dt;
        if ((h.ax || h.ay) && h.cd <= 0) fire(h);
        // подбор
        for (var p = S.pickups.length - 1; p >= 0; p--) { var pk = S.pickups[p]; if (dist(h.x, h.y, pk.x, pk.y) < 20) { S.pickups.splice(p, 1); collect(h, pk); } }
        // выход
        if (S.roomState === 'cleared' && S.phase === 'play') {
          if (h.x < IX0 - 4 && S.room.exits.W) takeExit('W');
          else if (h.x > IX1 + 4 && S.room.exits.E) takeExit('E');
          else if (h.y < IY0 - 4 && S.room.exits.N) takeExit('N');
        }
      });
    }
    function stepEnemies(dt) {
      var stg = S.stage, rate = 1 + 0.1 * (stg - 1);
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (e.dead) continue;
        e.t += dt; if (e.flash > 0) e.flash -= dt;
        var D = ENEMIES[e.type], tg = nearestHero(e.x, e.y);
        if (e.enter) {   // выход из ворот внутрь арены
          var G0 = GATES[e.enter]; e.x += G0.nx * 70 * dt; e.y += G0.ny * 70 * dt;
          if (e.x > IX0 + e.r && e.x < IX1 - e.r && e.y > IY0 + e.r && e.y < IY1 - e.r) e.enter = null;
          continue;
        }
        if (e.type === 'turret') {
          if (e.rise > 0) { e.rise -= dt; continue; }
          if (tg) e.ang = Math.atan2(tg.y - e.y, tg.x - e.x);
          if (e.warn > 0) { e.warn -= dt; if (e.warn <= 0 && tg) { var n = stg >= 3 ? 3 : stg >= 2 ? 2 : 1; for (var k = 0; k < n; k++) eshot(e.x + Math.cos(e.ang) * 14, e.y + Math.sin(e.ang) * 14, e.ang + (k - (n - 1) / 2) * 0.2, D.bullet * (1 + 0.05 * (stg - 1))); emit('eshot', { x: e.x, y: e.y }); } }
          else { e.cd -= dt * rate * (NP === 2 ? 1.2 : 1); if (e.cd <= 0 && tg && dist(e.x, e.y, tg.x, tg.y) > 60) { e.cd = D.cd; e.warn = D.warn; } }
          continue;
        }
        if (e.type === 'roller') {
          if (e.state === 'charge') {
            e.x += e.vx * dt; e.y += e.vy * dt;
            if (wallHit(e.x, e.y, e.r)) { e.x -= e.vx * dt; e.y -= e.vy * dt; e.state = 'stun'; e.cd = 0.8; emit('thud', { x: e.x, y: e.y }); }
            // каток давит своих
            near(e.x, e.y, function (o) { if (o !== e && !o.dead && (o.type === 'blank' || o.type === 'runner') && dist(o.x, o.y, e.x, e.y) < e.r + o.r) killEnemy(o, -1, 'crush'); });
          } else if (e.state === 'wind') { e.cd -= dt; if (e.cd <= 0) { e.state = 'charge'; e.vx = Math.cos(e.ang) * D.charge; e.vy = Math.sin(e.ang) * D.charge; emit('charge', {}); } }
          else if (e.state === 'stun') { e.cd -= dt; if (e.cd <= 0) { e.state = 'walk'; e.cd = D.every * (0.8 + rng() * 0.4) / rate; } }
          else {
            if (tg) { var fr = flowDir(e, tg), ta = fr != null ? fr : Math.atan2(tg.y - e.y, tg.x - e.x); e.ang += clamp(angDiff(ta, e.ang), -1.5 * dt, 1.5 * dt); e.x += Math.cos(e.ang) * e.speed * dt; e.y += Math.sin(e.ang) * e.speed * dt; }
            e.cd -= dt; if (e.cd <= 0 && tg) { e.state = 'wind'; e.cd = D.wind; e.ang = Math.atan2(tg.y - e.y, tg.x - e.x); emit('windup', {}); }
          }
        } else if (tg) {
          var dx = tg.x - e.x, dy = tg.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
          if (e.type === 'runner') {
            if (e.fuse > 0) { e.fuse -= dt; if (e.fuse <= 0) { killEnemy(e, -1, 'fuse'); continue; } }
            else if (d < D.trig) { e.fuse = D.fuse; emit('fuse', { x: e.x, y: e.y }); }
          }
          var fd = flowDir(e, tg), ta2 = fd != null ? fd : Math.atan2(dy, dx);
          if (e.type === 'shield') { if (!(e.stun > 0)) e.ang += clamp(angDiff(ta2, e.ang), -D.turn * dt, D.turn * dt); }
          else { e.ang = ta2 + (fd != null ? 0 : Math.sin(e.t * 2 + e.wob) * (e.type === 'blank' ? 0.5 : 0.25)); }
          var spd = e.speed * (e.fuse > 0 ? 0.5 : 1);
          if (e.stun > 0) { e.stun -= dt; spd = 0; }
          e.x += Math.cos(e.ang) * spd * dt; e.y += Math.sin(e.ang) * spd * dt;
        }
        // разведение толпы
        if (e.type !== 'roller' || e.state !== 'charge') near(e.x, e.y, function (o) {
          if (o === e || o.dead || o.enter || o.id < e.id) return;
          var ddx = e.x - o.x, ddy = e.y - o.y, dd = ddx * ddx + ddy * ddy, m = (e.r + o.r) * 0.9;
          if (dd < m * m && dd > 0.0001) {
            var q = Math.sqrt(dd), push = (m - q) * 0.5, ux = ddx / q, uy = ddy / q;
            var we = o.type === 'turret' ? 1 : e.type === 'turret' ? 0 : 0.5, wo = 1 - we;
            if (e.type === 'roller') { we = 0; wo = 1; } else if (o.type === 'roller') { we = 1; wo = 0; }
            e.x += ux * push * 2 * we; e.y += uy * push * 2 * we; o.x -= ux * push * 2 * wo; o.y -= uy * push * 2 * wo;
          }
        });
        e.x = clamp(e.x, IX0 + e.r, IX1 - e.r); e.y = clamp(e.y, IY0 + e.r, IY1 - e.r);
        pushOut(e, e.r);
        // касание героя
        for (var hh = 0; hh < S.heroes.length; hh++) {
          var h = S.heroes[hh]; if (!h.alive) continue;
          var dh = dist(h.x, h.y, e.x, e.y);
          if (h.ring > 0 && dh < AUX.ring.r + e.r && (e.type === 'blank' || e.type === 'runner')) { killEnemy(e, h.id, 'ring'); break; }
          if (dh < e.r + HIT_R) {
            if (e.type === 'runner') { killEnemy(e, -1, 'fuse'); break; }
            if (e.type === 'shield') {   // щитовик не убивает — отталкивает щитом (загоняет в толпу)
              var sa = Math.atan2(h.y - e.y, h.x - e.x), push = e.r + HERO_R + 14 - dh;
              h.x += Math.cos(sa) * push; h.y += Math.sin(sa) * push; clampHero(h);
              e.stun = 0.8; e.x -= Math.cos(sa) * 6; e.y -= Math.sin(sa) * 6;   // после толчка щит «раскрыт» и стоит
              if ((h.shoveT || 0) <= S.time) { h.shoveT = S.time + 0.3; emit('shove', { pi: h.id, x: h.x, y: h.y }); }
              continue;
            }
            killHero(h, e.type);
          }
        }
      }
    }
    function blocked(e, b) {   // щитовик: пули спереди гасит
      if (e.type !== 'shield' || e.stun > 0) return false;
      var a = Math.atan2(b.y - e.y, b.x - e.x); return Math.abs(angDiff(a, e.ang)) < ENEMIES.shield.arc;
    }
    function stepBullets(dt) {
      var out = [];
      for (var i = 0; i < S.bullets.length; i++) {
        var b = S.bullets[i], gone = false;
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (b.k === 'd') {
          if (b.x - b.r < IX0 || b.x + b.r > IX1) { b.vx = -b.vx; b.x += b.vx * dt * 2; b.bounces--; b.hit = []; emit('bounce', {}); }
          if (b.y - b.r < IY0 || b.y + b.r > IY1) { b.vy = -b.vy; b.y += b.vy * dt * 2; b.bounces--; b.hit = []; emit('bounce', {}); }
          var bl = inBlock(b.x, b.y, b.r);
          if (bl) { var px = b.x - b.vx * dt, py = b.y - b.vy * dt; if (px + b.r <= bl[0] || px - b.r >= bl[0] + bl[2]) b.vx = -b.vx; else b.vy = -b.vy; b.x = px; b.y = py; b.bounces--; b.hit = []; }
          if (b.bounces < 0) gone = true;
        } else if (wallHit(b.x, b.y, b.k === 'f' ? 2 : b.r)) {
          if (b.k === 'g') blast(b.x - b.vx * dt, b.y - b.vy * dt, GUN.grenade.r, b.dmg, b.pi, false);
          gone = true;
        }
        if (!gone && b.life <= 0) { if (b.k === 'g') blast(b.x, b.y, GUN.grenade.r, b.dmg, b.pi, false); gone = true; }
        if (!gone) {
          near(b.x, b.y, function (e) {
            if (e.dead || (e.type === 'turret' && e.rise > 0.3) || dist(b.x, b.y, e.x, e.y) > e.r + b.r) return;
            if (b.k === 'f') { if (b.hit.indexOf(e.id) >= 0) return; b.hit.push(e.id); hurtEnemy(e, b.dmg, b.pi, 'flame'); if (--b.left <= 0) { gone = true; return true; } return; }
            if (b.k === 'g') { blast(b.x, b.y, GUN.grenade.r, b.dmg, b.pi, false); gone = true; return true; }
            if (blocked(e, b)) {
              emit('block', { x: b.x, y: b.y });
              if (b.k === 'd') { var a = Math.atan2(b.y - e.y, b.x - e.x), sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy); b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.bounces--; return true; }
              gone = true; return true;
            }
            if (b.k === 'd') { if (b.hit.indexOf(e.id) >= 0) return; b.hit.push(e.id); hurtEnemy(e, b.dmg, b.pi, 'disc'); return; }
            hurtEnemy(e, b.dmg, b.pi, 'gun'); gone = true; return true;
          });
        }
        if (!gone && S.boss && !S.boss.dead) {
          var B = S.boss, hitB = false;
          for (var p = 0; p < B.parts.length; p++) { var pt = B.parts[p]; if (!pt.dead && dist(b.x, b.y, pt.x, pt.y) < pt.r + b.r) { if (B.intro <= 0) hurtPart(B, pt, b.k === 'g' ? 0 : b.dmg, b.pi); hitB = true; break; } }
          if (!hitB && dist(b.x, b.y, B.x, B.y) < B.r + b.r) { hitB = true; if (B.intro <= 0 && b.k !== 'g') { if (B.armored) emit('armor', { x: b.x, y: b.y }); else hurtCore(B, b.dmg, b.pi); } }
          if (hitB) { if (b.k === 'g') blast(b.x, b.y, GUN.grenade.r, b.dmg, b.pi, false); if (b.k !== 'f' || --b.left <= 0) gone = true; if (b.k === 'd') { gone = false; b.vx = -b.vx; b.vy = -b.vy; b.bounces--; if (b.bounces < 0) gone = true; } }
        }
        if (!gone) out.push(b);
      }
      S.bullets = out;
      // пули врагов
      var eo = [];
      for (var j = 0; j < S.ebullets.length; j++) {
        var q = S.ebullets[j]; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
        if (q.life <= 0 || wallHit(q.x, q.y, 1)) continue;
        if (q.kind === 'flame' && q.life < 4.4) continue;   // струя мехов — короткая
        var hitH = false;
        for (var k = 0; k < S.heroes.length; k++) {
          var h = S.heroes[k]; if (!h.alive) continue;
          var dd = dist(q.x, q.y, h.x, h.y);
          if (h.ring > 0 && dd < AUX.ring.r) { hitH = true; emit('absorb', { x: q.x, y: q.y }); break; }
          if (dd < q.r + HIT_R) { hitH = killHero(h, 'bullet') || h.inv > 0; break; }
        }
        if (!hitH) eo.push(q);
      }
      S.ebullets = eo;
    }
    function stepAux(dt) {
      S.heroes.forEach(function (h) {
        if (!h.alive || h.hammers <= 0) return;
        for (var k = 0; k < 2; k++) {
          var a = h.hamA + k * Math.PI, x = h.x + Math.cos(a) * AUX.hammers.r, y = h.y + Math.sin(a) * AUX.hammers.r;
          near(x, y, function (e) { if (!e.dead && dist(x, y, e.x, e.y) < e.r + AUX.hammers.hr && (e.hitBy || 0) <= S.time) { e.hitBy = S.time + 0.25; hurtEnemy(e, AUX.hammers.dmg, h.id, 'hammer'); } });
          if (S.boss && !S.boss.dead && (S.boss.hamT || 0) <= S.time) { if (hurtBossAt(x, y, AUX.hammers.hr, AUX.hammers.dmg, h.id)) S.boss.hamT = S.time + 0.25; }
          for (var j = S.ebullets.length - 1; j >= 0; j--) if (dist(S.ebullets[j].x, S.ebullets[j].y, x, y) < AUX.hammers.hr + 3) S.ebullets.splice(j, 1);
        }
      });
    }
    function stepRoom(dt) {
      S.roomT += dt;
      if (S.roomState === 'enter') { if (S.roomT > 0.9) { S.roomState = 'fight'; if (S.room.kind !== 'boss' && S.waves.length) startWave(); } return; }
      if (S.roomState !== 'fight') return;
      if (S.room.kind === 'boss') return;
      S.waveT += dt;
      while (S.queue.length && S.queue[0].t <= S.waveT) {
        var q = S.queue.shift();
        if (q.type === 'turret') spawn('turret', q.x, q.y); else spawnFromGate(q.type, q.gate);
      }
      var alive = aliveEnemies();
      if (alive > S.peak) S.peak = alive;
      if (!S.queue.length) {
        if (S.wave < S.waves.length) { if (alive <= 10 || S.waveT > 11) startWave(); }
        else if (alive === 0) roomCleared();
      }
    }
    function stepMisc(dt) {
      for (var i = S.booms.length - 1; i >= 0; i--) { S.booms[i].t -= dt; if (S.booms[i].t <= 0) S.booms.splice(i, 1); }
      for (var j = S.slams.length - 1; j >= 0; j--) {
        var s = S.slams[j]; s.t -= dt;
        if (s.t <= 0) {
          S.slams.splice(j, 1); S.booms.push({ x: s.x, y: s.y, r: s.r, t: 0.35, max: 0.35, slam: true }); emit('slam', { x: s.x, y: s.y });
          S.heroes.forEach(function (h) { if (h.alive && dist(h.x, h.y, s.x, s.y) < s.r) killHero(h, 'slam'); });
          S.enemies.forEach(function (e) { if (!e.dead && e.type === 'blank' && dist(e.x, e.y, s.x, s.y) < s.r) killEnemy(e, -1, 'crush'); });
        }
      }
      for (var k = S.pickups.length - 1; k >= 0; k--) { if (S.roomState === 'cleared' && S.room.reward) continue; S.pickups[k].t -= dt; if (S.pickups[k].t <= 0) S.pickups.splice(k, 1); }
      if (S.enemies.length > 60) S.enemies = S.enemies.filter(function (e) { return !e.dead; });
    }
    function checkAllOut() {
      if (S.heroes.every(function (h) { return h.out; })) {
        if (S.continues > 0) { S.phase = 'cont'; S.contT = CONT_T; emit('contAsk', { left: S.continues }); }
        else { S.phase = 'over'; emit('gameover', { score: S.score }); }
      }
    }
    function step(dt) {
      S.time += dt;
      if (S.banner > 0) S.banner -= dt;
      if (S.phase === 'trans') {
        S.transT -= dt;
        if (S.transT <= 0) { S.roomNo++; loadRoom(roomAt(S.map, S.next.l, S.next.c), S.next.entry); }
        return;
      }
      if (S.phase === 'clear') {
        S.phaseT -= dt;
        if (S.phaseT <= 0) {
          if (S.stage >= S.maxStage) { S.phase = 'won'; emit('win', { score: S.score }); return; }
          S.heroes.forEach(function (h) { if (h.out) { h.out = false; h.lives = 1; } if (!h.alive) { h.alive = true; } h.inv = INV_SPAWN; h.weapon = 'base'; h.wT = 0; h.ring = 0; h.hammers = 0; });
          startStage(S.stage + 1);
        }
        return;
      }
      if (S.phase === 'cont') { S.contT -= dt; if (S.contT <= 0) { S.phase = 'over'; emit('gameover', { score: S.score }); } return; }
      if (S.phase !== 'play') return;
      buildHash();
      flowT -= dt; if (flowT <= 0 && S.blocks.length) { flowT = 0.2; buildFlow(); }
      stepHeroes(dt);
      if (S.phase !== 'play') return;
      stepRoom(dt);
      stepEnemies(dt);
      buildHash();
      stepBullets(dt);
      stepAux(dt);
      bossUpdate(dt);
      stepMisc(dt);
      if (S.phase === 'play') checkAllOut();
    }

    var api = {
      _S: S,
      start: function () { startStage(S.stage); return api; },
      update: function (dt) { dt = Math.min(dt, 0.1); var n = Math.max(1, Math.ceil(dt / (1 / 60) - 1e-6)); for (var i = 0; i < n; i++) step(dt / n); },
      setMove: function (pi, dx, dy) { var h = S.heroes[pi]; if (h) { h.mx = dx; h.my = dy; } },
      setAim: function (pi, dx, dy) { var h = S.heroes[pi]; if (h) { h.ax = dx; h.ay = dy; } },
      cont: function () {
        if (S.phase !== 'cont' || S.continues <= 0) return false;
        S.continues--; S.phase = 'play';
        S.heroes.forEach(function (h) { h.out = false; h.lives = LIVES; h.alive = false; h.deadT = 0; respawn(h); });
        emit('continue', { left: S.continues }); return true;
      },
      state: function () { return S; },
      _spawn: function (type, x, y, o) { return spawn(type, x, y, o); },
      _kill: function (h, src) { return killHero(h, src); },
      _blast: blast, _drop: dropPickup, _takeExit: takeExit, _roomCleared: roomCleared, _loadRoom: loadRoom,
      _hurtBoss: function (d) { var b = S.boss; b.parts.forEach(function (p) { if (!p.dead) hurtPart(b, p, d, 0); }); if (!b.armored) hurtCore(b, d, 0); },
      _wallHit: wallHit, _inBlock: inBlock, _los: los
    };
    return api;
  }

  G.logic = {
    W: W, H: H, HUD: HUD, SCREEN_H: SCREEN_H, WALL: WALL, IX0: IX0, IY0: IY0, IX1: IX1, IY1: IY1, GATES: GATES, GATE_HALF: GATE_HALF, OPP: OPP,
    SPEED: SPEED, HERO_R: HERO_R, HIT_R: HIT_R, LIVES: LIVES, CONTINUES: CONTINUES, CONT_T: CONT_T, EXTRA_LIFE: EXTRA_LIFE, POWER_T: POWER_T, LAYERS: LAYERS,
    GUN: GUN, AUX: AUX, WEAPONS: WEAPONS, POWERS: POWERS, ENEMIES: ENEMIES, SCORE: SCORE, BIND: BIND, LAYOUTS: LAYOUTS, KINDS: KINDS, BOSSES: BOSSES,
    MAX_STAGE: MAX_STAGE, genStage: genStage, solveMap: solveMap, roomAt: roomAt, makeWaves: makeWaves, mulberry32: mulberry32, angDiff: angDiff
  };
  G.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
