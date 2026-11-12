/* НАЛЁТ · логика (без DOM, детерминирована при заданном rng). NALYOT.Game(opts), NALYOT.logic
   Run-and-gun с видом сбоку на 1–2 игроков: отряд ремонтников мастерской «Гефест» против банды
   механических мародёров «Окалина». Бег, прыжок, стрельба в 8 направлениях, гранаты, ближний удар
   ключом, оружие-подборы с патронами, пленники-подмастерья, шагающий «Котёл», разрушаемые укрытия
   и постройки, 6 миссий с боссом-машиной в конце каждой.
   Координаты: x — центр тела, y — низ (ступни). Мир — ASCII-карта ROWS строк (см. parseMap). */
(function (global) {
  'use strict';
  var N = global.NALYOT = global.NALYOT || {};

  // ---------- Константы ----------
  var T = 24, ROWS = 20;
  var VIEW_W = 960, HUD = 40, VIEW_H = ROWS * T, SCREEN_H = HUD + VIEW_H;
  // Кооп — «поводок»: оба героя всегда в кадре с отступом LEASH_PAD (камера — середина пары, только вперёд)
  var LEASH_PAD = 40, LEASH_SPAN = VIEW_W - 2 * LEASH_PAD;
  var GRAV = 1500, RUN = 150, JUMP = 580, MAX_FALL = 900;
  var HW = 14, HH = 32, CROUCH_H = 20;
  var LIVES = 3, ARMOR_INV = 1.2, GREN0 = 8, GREN_MAX = 20, INV_SPAWN = 2.5, RESPAWN_T = 1.2;
  var WEAPONS = {
    rivet: { cd: 0.19, speed: 560, dmg: 1, life: 1.1, ammo: 0 },
    nail:  { cd: 0.075, speed: 640, dmg: 1, life: 1.0, ammo: 160, jitter: 0.06 },
    spark: { cd: 0.26, speed: 780, dmg: 3, life: 1.0, ammo: 40, pierce: true },
    torch: { cd: 0.045, speed: 340, dmg: 0.6, life: 0.32, ammo: 220, pierce: true, flame: true },
    scoop: { cd: 0.5, speed: 580, dmg: 1.5, life: 0.36, ammo: 24, pellets: 5, spread: 0.3 }
  };
  var WEAPON_KEYS = ['nail', 'spark', 'torch', 'scoop'];
  var MELEE = { reach: 28, dmg: 4, cd: 0.28 };
  var GRENADE = { vx: 250, vy: -420, fuse: 1.6, r: 60, dmg: 8 };
  var ENEMIES = {
    raider: { w: 14, h: 30, hp: 2, speed: 62, score: 100, cd: 3.0, bullet: 190, range: 420 },
    bomber: { w: 16, h: 30, hp: 2, speed: 55, score: 150, cd: 3.0, blast: 30 },
    turret: { w: 24, h: 22, hp: 7, score: 300, cd: 3.4, bullet: 210, burst: 3 },
    wagon:  { w: 68, h: 38, hp: 22, speed: 46, score: 800, cd: 2.6, bullet: 250, boomR: 70 },
    drone:  { w: 24, h: 14, hp: 2, speed: 110, score: 150, cd: 2.8, blast: 22 }
  };
  var BLOCKS = { crate: { hp: 4, score: 20 }, bldg: { hp: 14, score: 200 } };
  var KOTEL = { w: 40, h: 46, hp: 30, speed: 140, jump: 540, cd: 0.12, dmg: 1.5, bullet: 640,
    shellCd: 0.9, shellDmg: 10, shellR: 62, boom: 1.6, boomR: 84, boomDmg: 12 };
  // Боссы-машины. phases — какие приёмы включены в каждой фазе (фаза — доля потерянного здоровья).
  var BOSSES = {
    pincer:     { w: 112, h: 92,  hp: 45,  fly: false, phases: [['spread'], ['spread', 'stomp']] },
    auger:      { w: 132, h: 80,  hp: 60,  fly: false, phases: [['mortar'], ['mortar', 'stomp']] },
    smokestack: { w: 150, h: 112, hp: 75,  fly: false, phases: [['spread', 'drones'], ['rain', 'spread']] },
    cogwalker:  { w: 112, h: 124, hp: 90,  fly: false, phases: [['stomp', 'spread'], ['laser', 'mortar'], ['laser', 'drones', 'stomp']] },
    bellship:   { w: 140, h: 70,  hp: 100, fly: true,  phases: [['rain', 'spread'], ['drones', 'spread'], ['laser', 'rain']] },
    furnace:    { w: 160, h: 150, hp: 130, fly: false, phases: [['spread', 'mortar'], ['drones', 'stomp', 'spread'], ['laser', 'rain', 'mortar']] }
  };
  var PATTERN_CD = { spread: 3.0, mortar: 3.3, drones: 7.5, stomp: 3.8, laser: 4.4, rain: 5.0 };
  var MISSIONS = [
    { name: 'yard',    boss: 'pincer' },
    { name: 'quarry',  boss: 'auger' },
    { name: 'depot',   boss: 'smokestack' },
    { name: 'bridges', boss: 'cogwalker' },
    { name: 'mast',    boss: 'bellship' },
    { name: 'den',     boss: 'furnace' }
  ];
  var EXTRA_LIFE = 20000;   // каждые 20000 очков — +1 жизнь всем, кто ещё в игре
  var SCORE = { hostage: 300, mission: 1000, boss: 2000, medal: 1000, rescueBonus: 500 };
  // Раскладка кооп-клавиатуры (g.usePlayers): И1 — стрелки, И2 — WASD; в одиночке обе ведут И1
  var BIND = {
    p1: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
      jump: ['Space', 'Period', 'Numpad0'], fire: ['Slash', 'NumpadDivide', 'ControlRight'], grenade: ['Comma', 'ShiftRight', 'NumpadAdd'] },
    p2: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
      jump: ['KeyZ', 'KeyG'], fire: ['KeyX', 'KeyF'], grenade: ['KeyC', 'KeyQ'] }
  };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sgn(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
  // 8 направлений: вектор → ближайшее из 8, нормированное
  function q8(vx, vy) { var a = Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) * (Math.PI / 4); return { x: Math.round(Math.cos(a) * 1e6) / 1e6, y: Math.round(Math.sin(a) * 1e6) / 1e6 }; }
  // Сложность миссии: темп огня, скорость пуль; кооп — враги толще
  function params(m, players) {
    return { rate: 1 + 0.06 * (m - 1), bspeed: 1 + 0.03 * (m - 1), hpMul: players === 2 ? 1.5 : 1, bossMul: players === 2 ? 1.6 : 1 };
  }

  // ---------- Карта ----------
  // # земля · = платформа (снизу проходима, вниз+прыжок — спрыгнуть) · S старт · C ящик · X постройка (смежные
  // клетки — один объект) · r мародёр · o метатель · t турель · w броневагон · d дрон · h пленник · k «Котёл» ·
  // N «Гвоздомёт» · I «Искровик» · P «Паяльник» · Q «Дробовой ковш» · g гранаты · . воздух
  var ENEMY_CH = { r: 'raider', o: 'bomber', t: 'turret', w: 'wagon', d: 'drone' };
  var PICK_CH = { N: 'nail', I: 'spark', P: 'torch', Q: 'scoop', g: 'gren' };
  function parseMap(rows) {
    if (rows.length !== ROWS) throw new Error('карта: нужно ' + ROWS + ' строк, а не ' + rows.length);
    var W = rows[0].length, grid = new Uint8Array(W * ROWS), L = { W: W, grid: grid, start: null, blocks: [], enemies: [], hostages: [], vehicles: [], pickups: [] };
    var mark = new Uint8Array(W * ROWS);
    for (var r = 0; r < ROWS; r++) {
      if (rows[r].length !== W) throw new Error('карта: строка ' + r + ' другой длины');
      for (var c = 0; c < W; c++) {
        var ch = rows[r][c], x = c * T + T / 2, y = (r + 1) * T;
        if (ch === '#') grid[r * W + c] = 1;
        else if (ch === '=') grid[r * W + c] = 2;
        else if (ch === 'S') L.start = { x: x, y: y };
        else if (ENEMY_CH[ch]) L.enemies.push({ type: ENEMY_CH[ch], x: x, y: y });
        else if (ch === 'h') L.hostages.push({ x: x, y: y });
        else if (ch === 'k') L.vehicles.push({ x: x, y: y });
        else if (PICK_CH[ch]) L.pickups.push({ kind: PICK_CH[ch] === 'gren' ? 'gren' : 'w', w: PICK_CH[ch], x: x, y: y });
        else if (ch !== '.' && ch !== 'C' && ch !== 'X') throw new Error('карта: неизвестный символ «' + ch + '»');
      }
    }
    // объекты: связные области C (ящики) и X (постройки)
    for (r = 0; r < ROWS; r++) for (c = 0; c < W; c++) {
      ch = rows[r][c]; if ((ch !== 'C' && ch !== 'X') || mark[r * W + c]) continue;
      var st = [[c, r]], x0 = c, x1 = c, y0 = r, y1 = r; mark[r * W + c] = 1;
      while (st.length) {
        var p = st.pop(); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var nx = p[0] + d[0], ny = p[1] + d[1];
          if (nx < 0 || ny < 0 || nx >= W || ny >= ROWS || mark[ny * W + nx] || rows[ny][nx] !== ch) return;
          mark[ny * W + nx] = 1; st.push([nx, ny]);
        });
      }
      var kind = ch === 'C' ? 'crate' : 'bldg';
      L.blocks.push({ kind: kind, tx: x0, ty: y0, tw: x1 - x0 + 1, th: y1 - y0 + 1 });
    }
    if (!L.start) throw new Error('карта: нет старта S');
    return L;
  }

  // ---------- Генератор миссии (детерминирован: зерно — номер миссии) ----------
  function genMission(n) {
    var rng = mulberry32(9001 + n * 131), R = function (a, b) { return a + Math.floor(rng() * (b - a + 1)); };
    var minLen = 150 + 14 * (n - 1), ARENA = 40, len = 1e9;
    var hgt = [], objs = [], plats = [], c = 0, h = 3, diff = (n - 1) / 5;
    function lay(k) { for (var i = 0; i < k; i++) hgt[c++] = h; }
    function obj(col, off, ch) { objs.push([col, off, ch]); }
    var weaponCh = ['N', 'I', 'P', 'Q'];
    var chunks = {
      flat: function () { var s = c, L = R(9, 13); lay(L); obj(s + R(5, L - 2), 0, 'r'); if (rng() < 0.35 + diff * 0.45) obj(s + R(2, 4), 0, rng() < 0.35 + diff * 0.3 ? 'o' : 'r'); },
      up: function () { h = Math.min(8, h + R(1, 2)); var s = c; lay(R(8, 11)); obj(s + R(4, 6), 0, rng() < 0.45 ? 't' : 'r'); },
      down: function () { h = Math.max(2, h - R(1, 2)); var s = c; lay(R(8, 11)); obj(s + R(4, 7), 0, 'r'); },
      pit: function () { var gw = R(2, 3); for (var i = 0; i < gw; i++) hgt[c++] = 0; h = clamp(h + R(-1, 1), 2, 7); var s = c; lay(R(7, 10)); if (rng() < 0.5) obj(s + R(4, 6), 0, 'r'); },
      bridge: function () {
        var gw = R(5, 6), s = c; for (var i = 0; i < gw; i++) hgt[c++] = 0;
        for (i = 1; i < gw - 1; i++) plats.push([s + i, ROWS - h - 2]);
        lay(R(7, 9)); obj(s + 2, 7, 'd');
      },
      cover: function () {
        var s = c, L = R(12, 15); lay(L); var cc = s + R(3, 5);
        obj(cc, 0, 'C'); obj(cc + 1, 0, 'C'); if (rng() < 0.5) obj(cc, 1, 'C');
        obj(cc + R(3, 5), 0, 'r'); obj(Math.min(s + L - 1, cc + R(6, 8)), 0, rng() < 0.5 + diff * 0.3 ? 'o' : 'r');
      },
      bldg: function () {
        var s = c, L = R(14, 16); lay(L); var b = s + R(4, 6), bw = R(3, 4), bh = R(3, 4);
        for (var x = 0; x < bw; x++) for (var y = 0; y < bh; y++) obj(b + x, y, 'X');
        obj(b + 1, bh, 'r'); if (rng() < 0.3 + diff * 0.5) obj(b + bw - 1, bh, rng() < 0.5 ? 'o' : 'r');
      },
      turret: function () { h = Math.min(8, h + 2); var s = c; lay(10); obj(s + 3, 0, 't'); obj(s + 7, 0, 'r'); },
      hostage: function () { var s = c; lay(R(9, 11)); obj(s + R(6, 8), 0, 'h'); obj(s + R(2, 3), 0, 'r'); },
      weapon: function () { var s = c; lay(8); obj(s + 4, 1, weaponCh[R(0, 3)]); if (rng() < 0.4) obj(s + 6, 1, 'g'); },
      wagon: function () { var s = c; lay(R(22, 26)); obj(s + R(15, 19), 0, 'w'); },
      drones: function () { var s = c; lay(R(12, 14)); obj(s + 6, 7, 'd'); obj(s + 10, 8, 'd'); if (n >= 4) obj(s + 12, 6, 'd'); },
      kotel: function () { var s = c; lay(14); obj(s + 6, 0, 'k'); obj(s + 12, 0, 'r'); }
    };
    // старт
    lay(14); obj(3, 0, 'S');
    // особые куски — гарантированы; между ними — обычные
    var spec = ['hostage', 'weapon', 'hostage', 'cover', 'weapon', 'hostage', 'cover'];
    for (var i = 0; i < 1 + Math.floor(n / 2); i++) spec.push('bldg');
    for (i = 0; i < Math.min(3, n - 1); i++) spec.push('wagon');
    for (i = 0; i < (n >= 2 ? 1 + Math.floor(n / 3) : 0); i++) spec.push('drones');
    for (i = spec.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), tmp = spec[i]; spec[i] = spec[j]; spec[j] = tmp; }
    if (n >= 2) spec.splice(1, 0, 'kotel');
    var generic = n >= 2 ? ['flat', 'up', 'down', 'pit', 'turret', 'bridge', 'flat', 'pit'] : ['flat', 'up', 'down', 'pit', 'flat', 'turret'];
    var k = 0;
    while (spec.length || c < minLen) {
      if (k % 2 === 1 && spec.length) chunks[spec.shift()]();
      else chunks[generic[Math.floor(rng() * generic.length)]]();
      k++;
    }
    h = 3; lay(8); len = c;
    var W = len + ARENA;
    for (c = len; c < W; c++) hgt[c] = 3;
    // в ASCII
    var g = []; for (var r = 0; r < ROWS; r++) g.push(new Array(W).fill('.'));
    for (c = 0; c < W; c++) for (r = ROWS - hgt[c]; r < ROWS; r++) g[r][c] = '#';
    plats.forEach(function (p) { g[p[1]][p[0]] = '='; });
    objs.forEach(function (o) {
      if (o[0] < 0 || o[0] >= len || !hgt[o[0]]) return;
      var rr = ROWS - hgt[o[0]] - 1 - o[1]; if (rr < 1) return;
      if (g[rr][o[0]] === '.') g[rr][o[0]] = o[2];
    });
    return { rows: g.map(function (row) { return row.join(''); }), arena: len, boss: MISSIONS[n - 1].boss, name: MISSIONS[n - 1].name };
  }

  // Проходимость карты: прыжками по поверхностям (без учёта врагов; ящики/постройки — твёрдые, на них можно встать)
  function solveMap(rows, arena) {
    var Lv = parseMap(rows), W = Lv.W, solid = new Uint8Array(W * ROWS);
    for (var i = 0; i < W * ROWS; i++) solid[i] = Lv.grid[i];
    Lv.blocks.forEach(function (b) { for (var y = b.ty; y < b.ty + b.th; y++) for (var x = b.tx; x < b.tx + b.tw; x++) solid[y * W + x] = 1; });
    var S = function (c, r) { return c >= 0 && c < W && r >= 0 && r < ROWS && solid[r * W + c] > 0; };
    var free = function (c, r) { return r < 0 || (c >= 0 && c < W && r < ROWS && solid[r * W + c] !== 1); };
    // поверхности: (c, r) — клетка r занята (земля/платформа/объект), над ней 2 свободные
    var surf = []; for (var c = 0; c < W; c++) for (var r = 1; r < ROWS; r++) if (S(c, r) && free(c, r - 1) && free(c, r - 2)) surf.push([c, r]);
    var key = function (c, r) { return r * W + c; }, has = {}; surf.forEach(function (s) { has[key(s[0], s[1])] = 1; });
    var sc = Math.floor(Lv.start.x / T), sr = Math.floor(Lv.start.y / T);
    var startS = null; for (r = sr; r < ROWS; r++) if (has[key(sc, r)]) { startS = [sc, r]; break; }
    if (!startS) return { ok: false, why: 'старт висит' };
    var seen = {}, q = [startS]; seen[key(startS[0], startS[1])] = 1; var far = 0;
    while (q.length) {
      var p = q.pop(); far = Math.max(far, p[0]);
      for (var dc = -4; dc <= 4; dc++) for (var dr = -4; dr <= 6; dr++) {
        var nc = p[0] + dc, nr = p[1] + dr; if (!has[key(nc, nr)] || seen[key(nc, nr)]) continue;
        if (Math.abs(dc) > 1 && dr < -3) continue;          // дальний прыжок — не выше 3 клеток
        if (Math.abs(dc) === 4 && dr < 0) continue;
        // над промежуточными колонками — не выше вершины прыжка (4 клетки над нижней из опор)
        var top = Math.min(p[1], nr) - 4, blocked = false;
        for (var ci = Math.min(p[0], nc) + 1; ci < Math.max(p[0], nc) && !blocked; ci++) for (var rr = Math.max(0, top); rr < Math.min(p[1], nr); rr++) if (S(ci, rr)) { blocked = true; break; }
        if (blocked) continue;
        seen[key(nc, nr)] = 1; q.push([nc, nr]);
      }
    }
    return { ok: far >= (arena || W - 2), far: far };
  }

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, onEvent = opts.onEvent || function () {};
    var players = opts.players === 2 ? 2 : 1;
    var S = {
      mission: opts.mission || 1, maxMission: opts.maxMission || MISSIONS.length, players: players, score: 0,
      phase: 'play', phaseT: 0, time: 0, banner: 0, over: false, won: false, name: '', bossKey: '',
      W: 0, grid: null, objMap: null, blocks: [], cam: { x: 0 }, arenaX: 0, locked: false,
      heroes: [], enemies: [], bullets: [], ebullets: [], grenades: [], bombs: [], pickups: [], hostages: [],
      vehicles: [], booms: [], waves: [], lasers: [], marks: [], boss: null, rescued: 0, kills: 0, nextLife: EXTRA_LIFE
    };
    var P = params(S.mission, players);
    function ev(t, d) { onEvent(t, d || {}); }

    function mkHero(i) {
      return { id: i, x: 0, y: 0, w: HW, hh: HH, vx: 0, vy: 0, onGround: false, onPlat: false, dropT: 0, coyote: 0, jumpQ: 0,
        face: 1, aim: { x: 1, y: 0 }, crouch: false, dx: 0, dy: 0, fire: false, cd: 0, meleeT: 0, gunT: 0,
        lives: LIVES, armor: 1, alive: true, out: false, deadT: 0, inv: 0, weapon: 'rivet', ammo: 0, grenades: GREN0, ride: null, leashed: false, runT: 0 };
    }
    for (var i = 0; i < players; i++) S.heroes.push(mkHero(i));

    // ---------- Загрузка уровня ----------
    function loadLevel(def) {
      var Lv = parseMap(def.rows);
      S.W = Lv.W; S.grid = Lv.grid; S.objMap = new Int16Array(Lv.W * ROWS);
      S.blocks = Lv.blocks.map(function (b, k) {
        var B = BLOCKS[b.kind], o = { id: k, kind: b.kind, tx: b.tx, ty: b.ty, tw: b.tw, th: b.th, hp: B.hp * (b.kind === 'bldg' ? b.tw * b.th / 12 : 1), dead: false, flash: 0,
          x: (b.tx + b.tw / 2) * T, y: (b.ty + b.th) * T };
        o.max = o.hp; return o;
      });
      S.blocks.forEach(function (b) { for (var y = b.ty; y < b.ty + b.th; y++) for (var x = b.tx; x < b.tx + b.tw; x++) S.objMap[y * S.W + x] = b.id + 1; });
      S.enemies = []; Lv.enemies.forEach(function (e) { spawn(e.type, e.x, e.y); });
      S.hostages = Lv.hostages.map(function (hst, k) { return { x: hst.x, y: hst.y, freed: false, t: 0, bonus: hostageBonus(k) }; });
      S.vehicles = Lv.vehicles.map(function (v) { return mkVehicle(v.x, v.y); });
      S.pickups = Lv.pickups.map(function (p) { return { kind: p.kind, w: p.w, x: p.x, y: p.y, vy: 0, t: 0 }; });
      S.bullets = []; S.ebullets = []; S.grenades = []; S.bombs = []; S.booms = []; S.waves = []; S.lasers = []; S.marks = [];
      S.arenaX = (def.arena != null ? def.arena : S.W - VIEW_W / T) * T; S.locked = false;
      S.bossKey = def.boss || ''; S.boss = null; S.name = def.name || 'test'; S.rescued = 0;
      S.cam.x = clamp(Lv.start.x - VIEW_W * 0.4, 0, Math.max(0, Math.min(S.arenaX, S.W * T - VIEW_W)));
      S.heroes.forEach(function (h, k) {
        h.ride = null; h.vx = h.vy = 0; h.x = Lv.start.x + k * 34; h.y = Lv.start.y; h.face = 1; h.aim = { x: 1, y: 0 }; h.inv = 0;
        if (!h.out) { h.alive = true; h.deadT = 0; }
      });
      S.banner = 2.6; S.phase = 'play'; S.phaseT = 0;
    }
    function hostageBonus(k) {
      var m = S.mission, seq = m === 1 ? ['w:nail', 'gren', 'w:scoop', 'medal'] : ['w:' + WEAPON_KEYS[(m + k) % 4], 'gren', (m % 2 === 0 ? 'life' : 'w:' + WEAPON_KEYS[(m + k + 2) % 4]), 'medal'];
      return seq[k % seq.length];
    }
    function mkVehicle(x, y) { return { x: x, y: y, w: KOTEL.w, hh: KOTEL.h, vx: 0, vy: 0, onGround: false, onPlat: false, dropT: 0, face: 1, aim: { x: 1, y: 0 }, hp: KOTEL.hp, max: KOTEL.hp, rider: -1, cd: 0, shellCd: 0, boom: 0, dead: false, flash: 0, walkT: 0 }; }
    function spawn(type, x, y) {
      var D = ENEMIES[type], e = { type: type, x: x, y: y, w: D.w, hh: D.h, vx: 0, vy: 0, onGround: false, onPlat: false, dropT: 0,
        hp: D.hp * P.hpMul, max: D.hp * P.hpMul, face: -1, cd: D.cd * (0.6 + rng() * 0.6), active: false, flash: 0, warn: 0, burst: 0, burstT: 0,
        keep: 170 + rng() * 120, t: rng() * 6, aim: { x: -1, y: 0 }, homeY: y, walkT: 0, dead: false };
      S.enemies.push(e); return e;
    }

    // ---------- Тайлы и столкновения ----------
    function cellSolid(tx, ty) {
      if (tx < 0 || tx >= S.W) return true;
      if (ty < 0 || ty >= ROWS) return false;
      var k = ty * S.W + tx; return S.grid[k] === 1 || S.objMap[k] > 0;
    }
    function cellPlat(tx, ty) { return tx >= 0 && tx < S.W && ty >= 0 && ty < ROWS && S.grid[ty * S.W + tx] === 2; }
    function blockAt(tx, ty) { if (tx < 0 || tx >= S.W || ty < 0 || ty >= ROWS) return null; var id = S.objMap[ty * S.W + tx]; return id ? S.blocks[id - 1] : null; }
    function moveX(b, dx) {
      b.x += dx; var top = b.y - b.hh + 1, bot = b.y - 1, r0 = Math.floor(top / T), r1 = Math.floor(bot / T), col, ty;
      if (dx > 0) { col = Math.floor((b.x + b.w / 2) / T); for (ty = r0; ty <= r1; ty++) if (cellSolid(col, ty)) { b.x = col * T - b.w / 2 - 0.01; b.hitWall = 1; return; } }
      else if (dx < 0) { col = Math.floor((b.x - b.w / 2) / T); for (ty = r0; ty <= r1; ty++) if (cellSolid(col, ty)) { b.x = (col + 1) * T + b.w / 2 + 0.01; b.hitWall = -1; return; } }
    }
    function moveY(b, dy) {
      var prevBot = b.y; b.y += dy;
      var c0 = Math.floor((b.x - b.w / 2 + 0.5) / T), c1 = Math.floor((b.x + b.w / 2 - 0.5) / T), tx, row;
      if (dy > 0) {
        row = Math.floor(b.y / T);
        for (tx = c0; tx <= c1; tx++) {
          var sol = cellSolid(tx, row), pl = !sol && b.dropT <= 0 && cellPlat(tx, row) && prevBot <= row * T + 0.5;
          if ((sol && prevBot <= row * T + 0.5) || pl) { b.y = row * T; b.vy = 0; b.onGround = true; b.onPlat = pl && !sol; return; }
        }
      } else if (dy < 0) {
        row = Math.floor((b.y - b.hh) / T);
        for (tx = c0; tx <= c1; tx++) if (cellSolid(tx, row)) { b.y = (row + 1) * T + b.hh; b.vy = 0; return; }
      }
    }
    function move(b, dx, dy) {
      var n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8));
      b.hitWall = 0; b.onGround = false;
      for (var k = 0; k < n; k++) { moveX(b, dx / n); moveY(b, dy / n); }
      if (!b.onGround && b.vy >= 0) {   // стоим ли (без движения по y)
        var row = Math.floor((b.y + 0.5) / T), c0 = Math.floor((b.x - b.w / 2 + 0.5) / T), c1 = Math.floor((b.x + b.w / 2 - 0.5) / T);
        if (Math.abs(b.y - row * T) < 0.6) for (var tx = c0; tx <= c1; tx++) if (cellSolid(tx, row) || (b.dropT <= 0 && cellPlat(tx, row))) { b.onGround = true; b.onPlat = !cellSolid(tx, row); b.y = row * T; break; }
      }
    }
    function overlap(a, b) { return Math.abs(a.x - b.x) * 2 < a.w + b.w && a.y - a.hh < b.y && b.y - b.hh < a.y; }
    function pointIn(px, py, b, pad) { pad = pad || 0; return Math.abs(px - b.x) <= b.w / 2 + pad && py >= b.y - b.hh - pad && py <= b.y + pad; }
    function groundTop(col) { for (var r = 0; r < ROWS; r++) if (cellSolid(col, r) || cellPlat(col, r)) return r; return -1; }

    // ---------- Взрывы ----------
    function blast(x, y, r, dmg, src) {
      S.booms.push({ x: x, y: y, r: r, t: 0, max: 0.45 }); ev('boom', { x: x, y: y, r: r, src: src });
      if (src === 'p') {
        S.enemies.forEach(function (e) { if (!e.dead && Math.hypot(e.x - x, e.y - e.hh / 2 - y) < r + e.w / 2) damageEnemy(e, dmg, 'blast'); });
        S.blocks.forEach(function (b) { if (!b.dead && Math.abs(b.x - x) < r + b.tw * T / 2 && y > b.ty * T - r && y < b.y + r) damageBlock(b, dmg * (b.kind === 'bldg' ? 1.2 : 1)); });
        var B = S.boss; if (B && B.active && !B.dead && Math.abs(B.x - x) < r + B.w / 2 && y > B.y - B.hh - r && y < B.y + r) damageBoss(dmg * 0.8);
        S.hostages.forEach(function (hs) { if (!hs.freed && Math.hypot(hs.x - x, hs.y - 12 - y) < r) freeHostage(hs, null); });
      } else {
        S.heroes.forEach(function (h) {
          if (!h.alive) return;
          if (h.ride) { var v = h.ride; if (Math.hypot(v.x - x, v.y - v.hh / 2 - y) < r + v.w / 2) hurtVehicle(v, dmg); return; }
          if (Math.hypot(h.x - x, h.y - h.hh / 2 - y) < r + 4) killHero(h, src || 'blast');
        });
      }
    }

    // ---------- Урон ----------
    function damageEnemy(e, d, how) {
      if (e.dead) return; e.hp -= d; e.flash = 0.12; e.active = true;
      ev('hit', { x: e.x, y: e.y - e.hh / 2, type: e.type });
      if (e.hp <= 0) {
        e.dead = true; S.kills++; S.score += ENEMIES[e.type].score;
        ev('kill', { type: e.type, x: e.x, y: e.y - e.hh / 2, how: how });
        if (e.type === 'wagon') blast(e.x, e.y - 18, ENEMIES.wagon.boomR, 6, 'p');
      }
    }
    function damageBlock(b, d) {
      if (b.dead) return; b.hp -= d; b.flash = 0.1;
      if (b.hp <= 0) {
        b.dead = true; S.score += BLOCKS[b.kind].score;
        for (var y = b.ty; y < b.ty + b.th; y++) for (var x = b.tx; x < b.tx + b.tw; x++) S.objMap[y * S.W + x] = 0;
        ev('block', { kind: b.kind, x: b.x, y: b.y - b.th * T / 2, w: b.tw * T, h: b.th * T });
        // стоящие на крыше падают сами (гравитация); грузы на ящике — тоже
      } else ev('blockHit', { x: b.x, y: b.y - b.th * T / 2 });
    }
    function damageBoss(d) {
      var B = S.boss; if (!B || B.dead || !B.active || B.shift > 0 || B.intro > 0) return false;
      B.hp -= d; B.flash = 0.1; ev('bossHit', { x: B.x, y: B.y - B.hh / 2, hp: B.hp });
      if (B.hp <= 0) {
        B.hp = 0; B.dead = true; B.deadT = 0; S.score += SCORE.boss + 1000 * S.mission;
        S.ebullets = []; S.bombs = []; S.waves = []; S.lasers = []; S.marks = [];
        S.enemies.forEach(function (e) { if (!e.dead && e.type === 'drone') { e.dead = true; ev('kill', { type: 'drone', x: e.x, y: e.y }); } });
        ev('bossDie', { x: B.x, y: B.y - B.hh / 2, key: B.key });
      } else {
        var ph = Math.min(B.phases.length - 1, Math.floor((1 - B.hp / B.max) * B.phases.length));
        if (ph !== B.phase) { B.phase = ph; B.shift = 1.0; resetBossCds(B); ev('phase', { phase: ph, x: B.x, y: B.y - B.hh / 2 }); }
      }
      return true;
    }
    function hurtVehicle(v, d) {
      if (v.dead || v.boom > 0) return; v.hp -= d; v.flash = 0.12; ev('kotelHit', { x: v.x, y: v.y - v.hh / 2, hp: v.hp });
      if (v.hp <= 0) { v.hp = 0; v.boom = KOTEL.boom; ev('kotelCrit', { x: v.x, y: v.y - v.hh / 2 }); }
    }
    function killHero(h, src, hard) {
      if (!h.alive || (h.inv > 0 && !hard)) return false;
      if (h.ride && !hard) { hurtVehicle(h.ride, 4); return false; }
      // «фартук» — сварщицкая броня: первое попадание снимает её (короткая неуязвимость), второе — жизнь
      if (h.armor > 0 && !hard) { h.armor--; h.inv = ARMOR_INV; ev('armor', { pi: h.id, x: h.x, y: h.y - h.hh / 2, src: src }); return false; }
      h.alive = false; h.lives--; h.deadT = RESPAWN_T; h.vx = 0; h.vy = -260; h.crouch = false;
      ev('heroDie', { pi: h.id, x: h.x, y: h.y - h.hh / 2, src: src });
      if (h.lives <= 0) { h.out = true; ev('out', { pi: h.id }); }
      if (S.heroes.every(function (q) { return q.out; })) { S.phase = 'over'; S.phaseT = 0; }
      return true;
    }
    function respawn(h) {
      var x = h.id && S.heroes[0].alive ? S.heroes[0].x : S.heroes[1 - h.id] && S.heroes[1 - h.id].alive ? S.heroes[1 - h.id].x : S.cam.x + 160;
      x = clamp(x, S.cam.x + LEASH_PAD + 20, S.cam.x + VIEW_W - LEASH_PAD - 20);
      var col = Math.floor(x / T);
      for (var k = 0; k < 30 && groundTop(col) < 0; k++) col++;
      var gt = groundTop(col);
      h.x = clamp(col * T + T / 2, S.cam.x + LEASH_PAD, S.cam.x + VIEW_W - LEASH_PAD); h.y = Math.max(HH + 4, gt * T - 150); h.vx = 0; h.vy = 0;
      h.alive = true; h.inv = INV_SPAWN; h.armor = 1; h.weapon = 'rivet'; h.ammo = 0; h.grenades = Math.max(h.grenades, 5); h.ride = null;
      ev('respawn', { pi: h.id });
    }

    // ---------- Герои ----------
    function aimFor(h, dx, dy, onGround) {
      if (dy < 0) return dx ? q8(dx, -1) : { x: 0, y: -1 };
      if (dy > 0) { if (!onGround) return dx ? q8(dx, 1) : { x: 0, y: 1 }; return dx ? q8(dx, 1) : { x: h.face, y: 0 }; }
      return { x: dx || h.face, y: 0 };
    }
    function muzzle(h) {
      var cy = h.crouch ? 11 : 20;
      return { x: h.x + h.aim.x * 13 + (h.aim.x === 0 ? h.face * 3 : 0), y: h.y - cy + h.aim.y * 14 };
    }
    function meleeTarget(h) {
      var best = null, bd = 1e9;
      S.enemies.forEach(function (e) {
        if (e.dead || !e.active) return;
        var ddx = (e.x - h.x) * h.face, gap = Math.abs(e.x - h.x) - e.w / 2 - h.w / 2;
        if (ddx > -6 && gap < MELEE.reach - h.w / 2 && e.y - e.hh < h.y && h.y - h.hh < e.y && gap < bd) { bd = gap; best = e; }
      });
      return best;
    }
    function shoot(h) {
      var wname = h.weapon, W = WEAPONS[wname], m = muzzle(h), tgt = meleeTarget(h);
      if (tgt) {   // ближний удар ключом вплотную
        h.cd = MELEE.cd; h.meleeT = 0.18; damageEnemy(tgt, MELEE.dmg, 'melee');
        ev('melee', { pi: h.id, x: tgt.x, y: tgt.y - tgt.hh / 2 }); return;
      }
      h.cd = W.cd; h.gunT = 0.08;
      var n = W.pellets || 1;
      for (var k = 0; k < n; k++) {
        var a = Math.atan2(h.aim.y, h.aim.x);
        if (n > 1) a += (k - (n - 1) / 2) * (W.spread / (n - 1) * 2) / 2;
        if (W.jitter) a += (rng() - 0.5) * 2 * W.jitter;
        if (W.flame) a += (rng() - 0.5) * 0.18;
        S.bullets.push({ x: m.x, y: m.y, vx: Math.cos(a) * W.speed, vy: Math.sin(a) * W.speed, dmg: W.dmg, t: 0, life: W.life * (W.flame ? 0.8 + rng() * 0.4 : 1),
          pi: h.id, kind: h.weapon, pierce: !!W.pierce, hit: [] });
      }
      if (h.weapon !== 'rivet') {
        h.ammo -= 1;
        if (h.ammo <= 0) { h.weapon = 'rivet'; h.ammo = 0; ev('weaponOut', { pi: h.id }); }
      }
      ev('shot', { pi: h.id, w: wname });
    }
    function throwGrenade(h) {
      if (!h.alive || S.phase !== 'play') return false;
      if (h.ride) return vehicleShell(h, h.ride);
      if (h.grenades <= 0) return false;
      h.grenades--;
      var vx = h.face * GRENADE.vx + h.vx * 0.3, vy = GRENADE.vy;
      if (h.aim.y < 0 && h.aim.x === 0) { vx = h.face * 70; vy = -560; }
      S.grenades.push({ x: h.x + h.face * 8, y: h.y - 24, vx: vx, vy: vy, t: 0, pi: h.id, spin: 0 });
      ev('grenade', { pi: h.id }); return true;
    }
    function vehicleShell(h, v) {
      if (v.shellCd > 0 || v.boom > 0) return false;
      v.shellCd = KOTEL.shellCd;
      var a = v.aim, mx = v.x + a.x * 26, my = v.y - 30 + a.y * 18;
      S.grenades.push({ x: mx, y: my, vx: a.x * 520 + v.vx * 0.3, vy: a.y * 520 - 120, t: 0, pi: h.id, shell: true, spin: 0 });
      ev('shell', { pi: h.id, x: mx, y: my }); return true;
    }
    function jumpPress(h) { if (h.alive) h.jumpQ = 0.2; }   // буфер: нажал чуть раньше приземления — прыжок сработает

    function heroStep(h, dt) {
      if (!h.alive) {
        if (h.out && h.deadT <= 0) return;
        h.deadT -= dt; h.vy += GRAV * dt; h.y += h.vy * dt * 0.4;
        if (h.deadT <= 0 && !h.out && S.phase === 'play') respawn(h);
        return;
      }
      if (h.inv > 0) h.inv -= dt;
      if (h.meleeT > 0) h.meleeT -= dt;
      if (h.gunT > 0) h.gunT -= dt;
      h.cd -= dt;
      if (h.ride) { rideStep(h, h.ride, dt); return; }
      var dx = h.dx, dy = h.dy;
      h.crouch = h.onGround && dy > 0 && dx === 0;
      h.hh = h.crouch ? CROUCH_H : HH;
      if (dx) h.face = dx;
      h.aim = aimFor(h, dx, dy, h.onGround);
      h.vx = h.crouch ? 0 : dx * RUN;
      if (h.onGround) h.coyote = 0.1; else h.coyote -= dt;
      if (h.dropT > 0) h.dropT -= dt;
      if (h.jumpQ > 0) {
        h.jumpQ -= dt;
        if (h.coyote > 0) {
          if (dy > 0 && h.onPlat) { h.dropT = 0.25; h.onGround = false; h.jumpQ = 0; h.coyote = 0; h.y += 2; }
          else { h.vy = -JUMP; h.onGround = false; h.coyote = 0; h.jumpQ = 0; h.crouch = false; h.hh = HH; ev('jump', { pi: h.id }); }
        }
      }
      h.vy = Math.min(MAX_FALL, h.vy + GRAV * dt);
      move(h, h.vx * dt, h.vy * dt);
      if (h.onGround && h.vx) h.runT += dt;
      leash(h);
      if (h.y > ROWS * T + 60) { killHero(h, 'pit', true); return; }
      // посадка в «Котёл»: стоим в нём и жмём вниз
      if (dy > 0) S.vehicles.forEach(function (v) {
        if (h.ride || v.dead || v.rider >= 0 || v.boom > 0) return;
        if (Math.abs(v.x - h.x) < v.w / 2 + 4 && h.y > v.y - v.hh && h.y <= v.y + 2) { h.ride = v; v.rider = h.id; v.face = h.face; ev('board', { pi: h.id, x: v.x, y: v.y }); }
      });
      if (h.fire && h.cd <= 0) shoot(h);
    }
    function rideStep(h, v, dt) {
      var dx = h.dx, dy = h.dy;
      if (dx) v.face = dx; h.face = v.face;
      v.aim = aimFor(v, dx, dy, false); if (dy > 0 && v.onGround && !dx) v.aim = { x: v.face, y: 0 };
      if (dy > 0 && v.onGround && dx) v.aim = q8(dx, 1);
      h.aim = v.aim;
      v.vx = v.boom > 0 ? 0 : dx * KOTEL.speed;
      if (v.dropT > 0) v.dropT -= dt;
      if (h.jumpQ > 0) {
        h.jumpQ -= dt;
        if (dy > 0 || v.boom > 0) { h.jumpQ = 0; eject(h, v); return; }
        if (v.onGround) { h.jumpQ = 0; v.vy = -KOTEL.jump; ev('jump', { pi: h.id, kotel: true }); }
      }
      v.vy = Math.min(MAX_FALL, v.vy + GRAV * dt);
      move(v, v.vx * dt, v.vy * dt);
      if (v.onGround && v.vx) v.walkT += dt;
      leash(v);
      h.x = v.x; h.y = v.y - 10; h.vx = v.vx; h.vy = v.vy; h.onGround = v.onGround;
      if (v.y > ROWS * T + 40) { v.dead = true; v.rider = -1; h.ride = null; killHero(h, 'pit', true); return; }
      // давит мародёров
      S.enemies.forEach(function (e) { if (!e.dead && e.active && (e.type === 'raider' || e.type === 'bomber') && overlap(v, e)) damageEnemy(e, 99, 'crush'); });
      v.cd -= dt;
      if (h.fire && v.cd <= 0 && v.boom <= 0) {
        v.cd = KOTEL.cd; var a = v.aim, mx = v.x + a.x * 26, my = v.y - 30 + a.y * 18;
        // в упор: враг вплотную к корпусу (между корпусом и дулом) получает выстрел сразу
        var pb = null; S.enemies.forEach(function (e) { if (!pb && !e.dead && e.active && Math.abs(e.x - v.x) < v.w / 2 + e.w / 2 + 6 && e.y - e.hh < v.y && v.y - v.hh < e.y && (e.x - v.x) * v.face >= -4) pb = e; });
        if (pb) damageEnemy(pb, KOTEL.dmg, 'kotel');
        else S.bullets.push({ x: mx, y: my, vx: a.x * KOTEL.bullet, vy: a.y * KOTEL.bullet, dmg: KOTEL.dmg, t: 0, life: 1.0, pi: h.id, kind: 'kotel', pierce: false, hit: [] });
        ev('shot', { pi: h.id, w: 'kotel' });
      }
    }
    function eject(h, v) {
      h.ride = null; v.rider = -1; h.x = v.x; h.y = v.y - v.hh + 4; h.vy = -560; h.vx = 0; h.onGround = false; h.hh = HH;
      h.inv = Math.max(h.inv, 0.8); ev('eject', { pi: h.id, x: v.x, y: v.y - v.hh });
    }
    function vehicleStep(v, dt) {
      if (v.dead) return;
      if (v.flash > 0) v.flash -= dt;
      if (v.shellCd > 0) v.shellCd -= dt;
      if (v.rider < 0) { v.vx = 0; v.vy = Math.min(MAX_FALL, v.vy + GRAV * dt); move(v, 0, v.vy * dt); if (v.y > ROWS * T + 40) v.dead = true; }
      if (v.boom > 0) {
        v.boom -= dt;
        if (v.boom <= 0) {
          v.dead = true; blast(v.x, v.y - v.hh / 2, KOTEL.boomR, KOTEL.boomDmg, 'p');
          ev('kotelBoom', { x: v.x, y: v.y - v.hh / 2 });
          if (v.rider >= 0) { var h = S.heroes[v.rider]; h.ride = null; v.rider = -1; killHero(h, 'kotel', true); }
        }
      }
    }
    // «Поводок» и рамка камеры: центр тела не выходит за [cam.x+PAD, cam.x+VIEW_W−PAD]
    function leash(b) {
      var lo = S.cam.x + LEASH_PAD, hi = S.cam.x + VIEW_W - LEASH_PAD;
      b.leashed = false;
      if (b.x < lo) { b.x = lo; if (b.vx < 0) b.vx = 0; }
      if (b.x > hi) { b.x = hi; if (b.vx > 0) b.vx = 0; b.leashed = S.players === 2; }
      // не вдавливать в стену
      var top = b.y - b.hh + 1, r0 = Math.floor(top / T), r1 = Math.floor((b.y - 1) / T), cl = Math.floor((b.x - b.w / 2) / T), cr = Math.floor((b.x + b.w / 2) / T);
      for (var ty = r0; ty <= r1; ty++) { if (cellSolid(cr, ty) && !cellSolid(cl, ty)) b.x = cr * T - b.w / 2 - 0.01; else if (cellSolid(cl, ty) && !cellSolid(cr, ty)) b.x = (cl + 1) * T + b.w / 2 + 0.01; }
    }
    function updateCamera() {
      var alive = S.heroes.filter(function (h) { return h.alive; });
      if (!alive.length) return;
      var mid = alive.reduce(function (s, h) { return s + h.x; }, 0) / alive.length;
      var target = S.players === 2 && alive.length === 2 ? mid - VIEW_W / 2 : mid - VIEW_W * 0.4;
      var maxX = Math.min(S.arenaX, S.W * T - VIEW_W);
      S.cam.x = clamp(Math.max(S.cam.x, target), 0, Math.max(0, maxX));
      if (!S.locked && S.cam.x >= S.arenaX - 0.5 && S.bossKey) { S.locked = true; S.cam.x = S.arenaX; startBoss(); }
    }

    // ---------- Враги ----------
    function nearestHero(x, y) {
      var best = null, bd = 1e9;
      S.heroes.forEach(function (h) { if (!h.alive) return; var d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h; } });
      return best;
    }
    function heroPos(h) { return h.ride ? { x: h.ride.x, y: h.ride.y - 24 } : { x: h.x, y: h.y - h.hh / 2 }; }
    function eShot(x, y, vx, vy, dmg, kind, from) { S.ebullets.push({ x: x, y: y, vx: vx * P.bspeed, vy: vy * P.bspeed, t: 0, dmg: dmg || 3, kind: kind || 'bolt', r: kind === 'shell' ? 5 : 3.5, from: from || '' }); ev('eshot', { x: x, y: y, kind: kind }); }
    function lob(x, y, tx, ty, blastR, kind, tmin) {
      var dx = tx - x, t = clamp(Math.abs(dx) / 260, tmin || 0.6, 1.2), vy = (ty - y - 0.5 * GRAV * t * t) / t;
      S.bombs.push({ x: x, y: y, vx: dx / t, vy: vy, t: 0, r: blastR, kind: kind || 'bolt', dmg: 6 });
    }
    function edgeAhead(e, dir) {
      var fx = e.x + dir * (e.w / 2 + 4), col = Math.floor(fx / T), row = Math.floor((e.y + 2) / T);
      if (cellSolid(col, Math.floor((e.y - 4) / T))) return true;
      return !(cellSolid(col, row) || cellPlat(col, row));
    }
    function enemyStep(e, dt) {
      var D = ENEMIES[e.type];
      if (!e.active) {
        if (e.x < S.cam.x + VIEW_W + 30 && e.x > S.cam.x - 60) e.active = true; else return;
      }
      if (e.x < S.cam.x - 260 || e.y > ROWS * T + 80) { e.dead = true; return; }
      e.t += dt; if (e.flash > 0) e.flash -= dt;
      var h = nearestHero(e.x, e.y), hp = h ? heroPos(h) : null, onScreen = e.x > S.cam.x - 10 && e.x < S.cam.x + VIEW_W + 10;
      var rate = P.rate;
      if (e.type === 'raider' || e.type === 'bomber') {
        e.vx = 0;
        if (hp) {
          var dist = hp.x - e.x; e.face = sgn(dist) || e.face;
          var want = Math.abs(dist) > e.keep ? e.face : Math.abs(dist) < e.keep - 70 ? -e.face : 0;
          if (want && e.onGround && !edgeAhead(e, want)) e.vx = want * D.speed;
        }
        e.vy = Math.min(MAX_FALL, e.vy + GRAV * dt); move(e, e.vx * dt, e.vy * dt);
        if (e.vx) e.walkT += dt;
        if (h && onScreen && Math.abs(hp.x - e.x) < (D.range || 460)) {
          e.cd -= dt * rate; e.warn = e.cd < 0.4 ? 1 : 0;
          if (e.cd <= 0) {
            e.cd = D.cd * (0.8 + rng() * 0.45);
            if (e.type === 'raider') {
              var ddy = hp.y - (e.y - 24), a = Math.abs(ddy) > 70 ? q8(hp.x - e.x, ddy) : { x: e.face, y: 0 };
              e.aim = a; eShot(e.x + a.x * 10, e.y - 24 + a.y * 10, a.x * D.bullet, a.y * D.bullet, 3, 'bolt', 'raider');
            } else { lob(e.x, e.y - 26, hp.x + (rng() - 0.5) * 30, h.ride ? h.ride.y : h.y, D.blast, 'bolt'); ev('throw', { x: e.x, y: e.y }); }
          }
        }
      } else if (e.type === 'turret') {
        if (h && onScreen && Math.abs(hp.x - e.x) < 560) {
          e.aim = q8(hp.x - e.x, hp.y - (e.y - 14)); if (e.aim.y > 0.1) e.aim = { x: sgn(hp.x - e.x) || 1, y: 0 };
          e.face = sgn(e.aim.x) || e.face;
          if (e.burst > 0) {
            e.burstT -= dt;
            if (e.burstT <= 0) { e.burst--; e.burstT = 0.16; eShot(e.x + e.aim.x * 14, e.y - 14 + e.aim.y * 14, e.aim.x * D.bullet, e.aim.y * D.bullet, 3, 'bolt', 'turret'); }
          } else {
            e.cd -= dt * rate; e.warn = e.cd < 0.45 ? 1 : 0;
            if (e.cd <= 0) { e.cd = D.cd * (0.85 + rng() * 0.3); e.burst = D.burst; e.burstT = 0; }
          }
        }
        e.vy = Math.min(MAX_FALL, e.vy + GRAV * dt); move(e, 0, e.vy * dt);
      } else if (e.type === 'wagon') {
        e.vx = 0;
        if (hp) { var dw = hp.x - e.x; e.face = sgn(dw) || e.face; if (Math.abs(dw) > 280 && !edgeAhead(e, e.face)) e.vx = e.face * D.speed; }
        e.vy = Math.min(MAX_FALL, e.vy + GRAV * dt); move(e, e.vx * dt, e.vy * dt);
        if (e.vx) e.walkT += dt;
        if (h && onScreen) {
          e.cd -= dt * rate; e.warn = e.cd < 0.5 ? 1 : 0;
          if (e.cd <= 0) { e.cd = D.cd * (0.85 + rng() * 0.3); eShot(e.x + e.face * 36, e.y - 26, e.face * D.bullet, 0, 5, 'shell', 'wagon'); }
        }
        S.heroes.forEach(function (q) { if (q.alive && !q.ride && overlap(e, q)) killHero(q, 'wagon'); else if (q.alive && q.ride && overlap(e, q.ride)) hurtVehicle(q.ride, 12 * dt); });
      } else if (e.type === 'drone') {
        if (hp) {
          var gt = groundTop(Math.floor(hp.x / T)), floorY = gt >= 0 ? gt * T : ROWS * T;
          var tx = hp.x + Math.sin(e.t * 1.3) * 70, ty = clamp(floorY - 150 + Math.sin(e.t * 2.1) * 14, 50, ROWS * T - 120);
          var vx = tx - e.x, vy = ty - e.y, l = Math.hypot(vx, vy) || 1, sp = Math.min(D.speed, l * 3);
          e.x += vx / l * sp * dt; e.y += vy / l * sp * dt; e.face = sgn(vx) || e.face;
          if (onScreen) {
            e.cd -= dt * rate; e.warn = e.cd < 0.6 ? 1 : 0;
            if (e.cd <= 0 && Math.abs(hp.x - e.x) < 40) { e.cd = D.cd * (0.85 + rng() * 0.3); S.bombs.push({ x: e.x, y: e.y + 4, vx: 0, vy: 0, t: 0, r: D.blast, kind: 'drop', dmg: 6 }); ev('drop', { x: e.x, y: e.y }); }
          }
        }
      }
    }

    // ---------- Босс ----------
    function startBoss() {
      var D = BOSSES[S.bossKey]; if (!D) return;
      var gx = S.arenaX + VIEW_W - 60 - D.w / 2, col = Math.floor(gx / T), gt = groundTop(col), gy = (gt >= 0 ? gt : ROWS - 3) * T;
      var hp = Math.round(D.hp * (1 + 0.0 * (S.mission - 1)) * P.bossMul);
      S.boss = { key: S.bossKey, x: gx + 260, homeX: gx, y: D.fly ? gy - 170 : gy, homeY: D.fly ? gy - 170 : gy, groundY: gy, w: D.w, hh: D.h, fly: D.fly,
        hp: hp, max: hp, phase: 0, phases: D.phases, cds: {}, t: 0, flash: 0, shift: 0, intro: 1.6, active: true, dead: false, deadT: 0, warn: 0, boomT: 0, lastPat: '' };
      resetBossCds(S.boss);
      S.enemies.forEach(function (e) { if (e.x > S.arenaX + VIEW_W) e.dead = true; });
      ev('bossIntro', { key: S.bossKey });
    }
    function resetBossCds(B) {
      B.phases[B.phase].forEach(function (p, k) { B.cds[p] = PATTERN_CD[p] * (0.45 + k * 0.4); });
    }
    function bossAttack(B, p) {
      var h = nearestHero(B.x, B.y), hp = h ? heroPos(h) : { x: S.arenaX + 200, y: B.groundY - 16 };
      var mx = B.x - B.w / 2 + 10, my = B.y - B.hh * 0.55, ph = B.phase;
      B.lastPat = p; B.warn = 0.25;
      if (p === 'spread') {
        if (B.fly) { mx = B.x; my = B.y + 4; }
        var a0 = Math.atan2(hp.y - my, hp.x - mx), n = 3 + ph + (S.mission >= 4 ? 1 : 0), sp = 0.26;
        for (var k = 0; k < n; k++) { var a = a0 + (k - (n - 1) / 2) * sp; eShot(mx, my, Math.cos(a) * 160, Math.sin(a) * 160, 3, 'bolt', 'boss'); }
      } else if (p === 'mortar') {
        for (var m = 0; m < 2 + ph; m++) {
          var tx = clamp(hp.x + (m - (1 + ph) / 2) * 96 + (rng() - 0.5) * 24, S.arenaX + 30, S.arenaX + VIEW_W - 40);
          lob(B.x, B.y - B.hh, tx, B.groundY, 30, 'shell', 1.15);
          S.marks.push({ x: tx, t: 1.2, kind: 'mortar' });
        }
        ev('mortar', { x: B.x, y: B.y - B.hh });
      } else if (p === 'drones') {
        var alive = S.enemies.filter(function (e) { return !e.dead && e.type === 'drone'; }).length;
        for (var d = 0; d < (ph ? 2 : 1) && alive + d < 3; d++) { var e = spawn('drone', B.x - 20 + d * 30, B.y - B.hh - 20 - d * 20); e.active = true; e.hp = e.max = 2; }
        ev('drones', { x: B.x, y: B.y - B.hh });
      } else if (p === 'stomp') {
        S.waves.push({ x: B.fly ? hp.x + 300 : B.x - B.w / 2, y: B.groundY, vx: -(225 + 10 * S.mission), h: 18, t: 0 });
        ev('stomp', { x: B.x, y: B.groundY });
      } else if (p === 'laser') {
        var low = rng() < 0.5;
        S.lasers.push({ y: B.groundY - (low ? 11 : 27), low: low, warn: 0.9, fire: 0.45, x0: S.arenaX, x1: B.x - B.w / 2 });
        ev('laserWarn', { low: low });
      } else if (p === 'rain') {
        var cnt = 5 + ph;
        for (var r = 0; r < cnt; r++) {
          var rx = S.arenaX + 40 + (r + rng() * 0.8) * (VIEW_W - 260) / cnt;
          S.marks.push({ x: rx, t: 1.0 + r * 0.12, kind: 'rain', drop: true });
        }
        ev('rain', {});
      }
    }
    function bossStep(B, dt) {
      B.t += dt; if (B.flash > 0) B.flash -= dt; if (B.warn > 0) B.warn -= dt;
      if (B.dead) {
        B.deadT += dt; B.boomT -= dt;
        if (B.boomT <= 0 && B.deadT < 2.2) { B.boomT = 0.22; S.booms.push({ x: B.x + (rng() - 0.5) * B.w, y: B.y - rng() * B.hh, r: 34, t: 0, max: 0.45 }); ev('bossBoom', {}); }
        if (B.deadT > 2.6 && S.phase === 'play') { S.phase = 'clear'; S.phaseT = 0; var bonus = SCORE.mission * S.mission + S.rescued * SCORE.rescueBonus; S.score += bonus; S.lastBonus = bonus; ev('clear', { mission: S.mission, bonus: bonus }); }
        return;
      }
      // въезд
      if (B.intro > 0) { B.intro -= dt; B.x += (B.homeX - B.x) * Math.min(1, dt * 3); return; }
      if (B.shift > 0) { B.shift -= dt; return; }
      if (B.fly) { B.x = S.arenaX + VIEW_W * 0.62 + Math.sin(B.t * 0.45) * 230; B.y = B.homeY + Math.sin(B.t * 1.3) * 14; }
      else B.x = B.homeX - Math.abs(Math.sin(B.t * 0.5)) * (40 + 40 * B.phase);
      var pats = B.phases[B.phase], rate = 1 + 0.1 * B.phase;
      pats.forEach(function (p) { B.cds[p] -= dt * rate; if (B.cds[p] <= 0) { B.cds[p] = PATTERN_CD[p] * (0.85 + rng() * 0.3); bossAttack(B, p); } });
      S.heroes.forEach(function (h) {
        if (!h.alive) return;
        if (h.ride) { if (overlap(B, h.ride)) { hurtVehicle(h.ride, 20 * dt); h.ride.x -= 120 * dt; } }
        else if (overlap(B, h)) killHero(h, 'boss');
      });
    }

    // ---------- Пули, гранаты, бомбы ----------
    function bulletsStep(dt) {
      var out = [];
      S.bullets.forEach(function (b) {
        b.t += dt; if (b.t > b.life) return;
        var steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 6)), dead = false;
        for (var k = 0; k < steps && !dead; k++) {
          b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
          var tx = Math.floor(b.x / T), ty = Math.floor(b.y / T);
          if (b.x < S.cam.x - 20 || b.x > S.cam.x + VIEW_W + 20 || b.y < -30 || b.y > ROWS * T + 10) { dead = true; break; }
          var bl = blockAt(tx, ty);
          if (bl && !bl.dead) { damageBlock(bl, b.kind === 'torch' ? b.dmg * 0.5 : b.dmg); dead = true; break; }
          if (cellSolid(tx, ty)) { ev('wall', { x: b.x, y: b.y }); dead = true; break; }
          for (var j = 0; j < S.enemies.length; j++) {
            var e = S.enemies[j];
            if (e.dead || !e.active || b.hit.indexOf(e) >= 0 || !pointIn(b.x, b.y, e, 3)) continue;
            damageEnemy(e, b.dmg, b.kind); if (b.pierce) b.hit.push(e); else { dead = true; break; }
          }
          if (dead) break;
          var B = S.boss;
          if (B && !B.dead && b.hit.indexOf(B) < 0 && pointIn(b.x, b.y, B, 2)) {
            damageBoss(b.kind === 'torch' ? b.dmg * 0.7 : b.dmg);
            if (b.pierce) b.hit.push(B); else { dead = true; break; }
          }
          S.hostages.forEach(function (hs) { if (!hs.freed && Math.abs(hs.x - b.x) < 10 && b.y > hs.y - 26 && b.y < hs.y) freeHostage(hs, null); });
        }
        if (!dead) out.push(b);
      });
      S.bullets = out;
      var eo = [];
      S.ebullets.forEach(function (b) {
        b.t += dt; if (b.t > 4) return;
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < S.cam.x - 40 || b.x > S.cam.x + VIEW_W + 40 || b.y < -40 || b.y > ROWS * T + 20) return;
        if (cellSolid(Math.floor(b.x / T), Math.floor(b.y / T))) { ev('wall', { x: b.x, y: b.y }); return; }
        for (var k = 0; k < S.heroes.length; k++) {
          var h = S.heroes[k]; if (!h.alive) continue;
          if (h.ride) { if (pointIn(b.x, b.y, h.ride, b.r)) { hurtVehicle(h.ride, b.dmg); return; } continue; }
          if (Math.abs(b.x - h.x) < h.w / 2 - 2 + b.r && b.y > h.y - h.hh + 3 - b.r && b.y < h.y + b.r - 1) { if (h.inv > 0) continue; killHero(h, 'shot:' + b.from); return; }
        }
        eo.push(b);
      });
      S.ebullets = eo;
      // гранаты и снаряды «Котла» (свои)
      var go = [];
      S.grenades.forEach(function (gr) {
        gr.t += dt; gr.spin += dt * 12; gr.vy = Math.min(MAX_FALL, gr.vy + GRAV * (gr.shell ? 0.35 : 1) * dt);
        var nx = gr.x + gr.vx * dt, ny = gr.y + gr.vy * dt, boom = gr.t > GRENADE.fuse;
        if (cellSolid(Math.floor(nx / T), Math.floor(ny / T)) || cellPlat(Math.floor(nx / T), Math.floor(ny / T)) && gr.vy > 0) boom = true;
        gr.x = nx; gr.y = ny;
        if (!boom) S.enemies.forEach(function (e) { if (!e.dead && e.active && pointIn(gr.x, gr.y, e, 4)) boom = true; });
        var B = S.boss; if (!boom && B && !B.dead && pointIn(gr.x, gr.y, B, 4)) boom = true;
        if (gr.y > ROWS * T + 20) return;
        if (boom) blast(gr.x, gr.y, gr.shell ? KOTEL.shellR : GRENADE.r, gr.shell ? KOTEL.shellDmg : GRENADE.dmg, 'p'); else go.push(gr);
      });
      S.grenades = go;
      // бомбы врагов
      var bo = [];
      S.bombs.forEach(function (bm) {
        bm.t += dt; bm.vy = Math.min(bm.kind === 'drop' ? 420 : MAX_FALL, bm.vy + GRAV * (bm.kind === 'drop' ? 0.55 : 1) * dt);
        bm.x += bm.vx * dt; bm.y += bm.vy * dt;
        var hit = cellSolid(Math.floor(bm.x / T), Math.floor(bm.y / T)) || bm.y > ROWS * T + 10;
        if (!hit) S.heroes.forEach(function (h) { if (h.alive && (h.ride ? pointIn(bm.x, bm.y, h.ride, 3) : pointIn(bm.x, bm.y, h, 3))) hit = true; });
        if (hit) blast(bm.x, bm.y - 4, bm.r, bm.dmg, 'bomb:' + bm.kind); else bo.push(bm);
      });
      S.bombs = bo;
      // ударные волны босса — по земле
      S.waves = S.waves.filter(function (w) {
        w.t += dt; w.x += w.vx * dt; if (w.x < S.arenaX - 40) return false;
        S.heroes.forEach(function (h) {
          if (!h.alive) return; var bdy = h.ride || h;
          if (Math.abs(bdy.x - w.x) < bdy.w / 2 + 10 && bdy.y > w.y - w.h) { if (h.ride) hurtVehicle(h.ride, 8); else killHero(h, 'wave'); }
        });
        return true;
      });
      // лазеры: предупреждение → луч
      S.lasers = S.lasers.filter(function (l) {
        if (l.warn > 0) { l.warn -= dt; if (l.warn <= 0) ev('laser', { low: l.low }); return true; }
        l.fire -= dt; if (l.fire <= 0) return false;
        S.heroes.forEach(function (h) {
          if (!h.alive) return; var bdy = h.ride || h;
          if (bdy.x > l.x0 && bdy.x < l.x1 && l.y > bdy.y - bdy.hh - 3 && l.y < bdy.y + 1) { if (h.ride) hurtVehicle(h.ride, 30 * dt); else killHero(h, 'laser'); }
        });
        return true;
      });
      // метки: миномёт — только подсветка; «дождь» — бомба сверху в конце отсчёта
      S.marks = S.marks.filter(function (m) {
        m.t -= dt; if (m.t > 0) return true;
        if (m.drop) S.bombs.push({ x: m.x, y: -10, vx: 0, vy: 520, t: 0, r: 30, kind: 'rain', dmg: 6 });
        return false;
      });
      S.booms = S.booms.filter(function (b) { b.t += dt; return b.t < b.max; });
    }

    // ---------- Пленники и подборы ----------
    function freeHostage(hs, h) {
      if (hs.freed) return; hs.freed = true; hs.t = 0; S.rescued++; S.score += SCORE.hostage;
      var b = hs.bonus, pk = b.indexOf('w:') === 0 ? { kind: 'w', w: b.slice(2) } : { kind: b };
      S.pickups.push({ kind: pk.kind, w: pk.w, x: hs.x, y: hs.y - 30, vy: -260, t: 0 });
      ev('rescue', { x: hs.x, y: hs.y - 20, bonus: b, pi: h ? h.id : -1 });
    }
    function collect(h, p) {
      p.taken = true;
      if (p.kind === 'w') { if (h.weapon === p.w) h.ammo += WEAPONS[p.w].ammo; else { h.weapon = p.w; h.ammo = WEAPONS[p.w].ammo; } }
      else if (p.kind === 'gren') h.grenades = Math.min(GREN_MAX, h.grenades + 5);
      else if (p.kind === 'life') h.lives++;
      else if (p.kind === 'armor') h.armor = 1;
      else if (p.kind === 'medal') S.score += SCORE.medal;
      ev('pickup', { pi: h.id, kind: p.kind, w: p.w, x: p.x, y: p.y - 10 });
    }
    function itemsStep(dt) {
      S.hostages.forEach(function (hs) {
        if (hs.freed) { hs.t += dt; if (hs.t > 0.6) hs.x -= 70 * dt; return; }
        S.heroes.forEach(function (h) { if (h.alive && Math.abs(h.x - hs.x) < 16 && Math.abs(h.y - hs.y) < 30) freeHostage(hs, h); });
      });
      S.pickups.forEach(function (p) {
        if (p.taken) return; p.t += dt;
        if (p.vy !== null) {
          p.vy = Math.min(500, p.vy + GRAV * 0.6 * dt); var ny = p.y + p.vy * dt, row = Math.floor(ny / T), col = Math.floor(p.x / T);
          if (p.vy > 0 && (cellSolid(col, row) || cellPlat(col, row))) { p.y = row * T; p.vy = null; } else p.y = ny;
          if (p.y > ROWS * T + 30) p.taken = true;
        }
        S.heroes.forEach(function (h) { if (!p.taken && h.alive && Math.abs(h.x - p.x) < 18 && p.y > h.y - (h.ride ? 56 : h.hh) - 10 && p.y - 16 < h.y + 4) collect(h, p); });
      });
      S.pickups = S.pickups.filter(function (p) { return !p.taken; });
      S.blocks.forEach(function (b) { if (b.flash > 0) b.flash -= dt; });
    }

    // ---------- Шаг ----------
    function step(dt) {
      S.time += dt;
      if (S.banner > 0) S.banner -= dt;
      if (S.phase === 'won') return;
      if (S.phase === 'over') {
        S.phaseT += dt; bulletsStep(dt);
        if (!S.over && S.phaseT > 1.6) { S.over = true; ev('gameover', { score: S.score }); }
        return;
      }
      if (S.phase === 'clear') {
        S.phaseT += dt;
        S.heroes.forEach(function (h) { if (h.alive) { h.inv = 1; h.cd -= dt; } });
        if (S.phaseT > 3) {
          if (S.mission >= S.maxMission) { S.phase = 'won'; S.won = true; ev('win', { score: S.score }); return; }
          S.mission++; P = params(S.mission, players); loadLevel(opts.levels ? opts.levels[S.mission - 1] : genMission(S.mission));
          ev('mission', { mission: S.mission });
        }
        return;
      }
      S.heroes.forEach(function (h) { heroStep(h, dt); });
      if (S.score >= S.nextLife) { S.nextLife += EXTRA_LIFE; S.heroes.forEach(function (h) { if (!h.out) { h.lives++; ev('extraLife', { pi: h.id }); } }); }
      updateCamera();
      S.vehicles.forEach(function (v) { vehicleStep(v, dt); });
      S.enemies.forEach(function (e) { if (!e.dead) enemyStep(e, dt); });
      S.enemies = S.enemies.filter(function (e) { return !e.dead; });
      if (S.boss) bossStep(S.boss, dt);
      bulletsStep(dt);
      itemsStep(dt);
      S.vehicles = S.vehicles.filter(function (v) { return !v.dead; });
      S.heroes.forEach(function (h) { h.leashed = h.leashed && S.players === 2; });
    }

    var api = {
      start: function () {
        var def = opts.map ? { rows: opts.map, arena: opts.arena, boss: opts.boss, name: 'test' } : opts.levels ? opts.levels[S.mission - 1] : genMission(S.mission);
        loadLevel(def); ev('mission', { mission: S.mission }); return api;
      },
      update: function (dt) { dt = Math.min(dt, 0.05); var n = Math.max(1, Math.ceil(dt / (1 / 60) - 1e-6)); for (var k = 0; k < n; k++) step(dt / n); },
      setDir: function (pi, dx, dy) { var h = S.heroes[pi]; if (h) { h.dx = sgn(dx); h.dy = sgn(dy); } },
      setFire: function (pi, held) { var h = S.heroes[pi]; if (h) h.fire = !!held; },
      jump: function (pi) { var h = S.heroes[pi]; if (h && S.phase === 'play') jumpPress(h); },
      grenade: function (pi) { var h = S.heroes[pi]; return !!(h && throwGrenade(h)); },
      state: function () { return S; },
      _S: S, _spawn: spawn, _vehicle: function (x, y) { var v = mkVehicle(x, y); S.vehicles.push(v); return v; },
      _pickup: function (kind, w, x, y) { var p = { kind: kind, w: w, x: x, y: y, vy: 0, t: 0 }; S.pickups.push(p); return p; },
      _startBoss: startBoss, _damageBoss: damageBoss, _blast: blast, _cellSolid: cellSolid
    };
    return api;
  }

  N.Game = Game;
  N.logic = {
    T: T, ROWS: ROWS, VIEW_W: VIEW_W, VIEW_H: VIEW_H, HUD: HUD, SCREEN_H: SCREEN_H, LEASH_PAD: LEASH_PAD, LEASH_SPAN: LEASH_SPAN,
    GRAV: GRAV, RUN: RUN, JUMP: JUMP, HW: HW, HH: HH, CROUCH_H: CROUCH_H, LIVES: LIVES, ARMOR_INV: ARMOR_INV, GREN0: GREN0, GREN_MAX: GREN_MAX,
    WEAPONS: WEAPONS, WEAPON_KEYS: WEAPON_KEYS, MELEE: MELEE, GRENADE: GRENADE, ENEMIES: ENEMIES, BLOCKS: BLOCKS, KOTEL: KOTEL,
    EXTRA_LIFE: EXTRA_LIFE, BOSSES: BOSSES, PATTERN_CD: PATTERN_CD, MISSIONS: MISSIONS, SCORE: SCORE, BIND: BIND,
    parseMap: parseMap, genMission: genMission, solveMap: solveMap, params: params, mulberry32: mulberry32, q8: q8
  };
})(typeof window !== 'undefined' ? window : globalThis);
