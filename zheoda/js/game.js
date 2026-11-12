/* ЖЕОДА · логика игры (без DOM, детерминирована при заданном rng).
   Платформер по пещерам-жеодам: геолог-рудознатка мастерской «Гефест» Друза собирает ВСЕ
   кристаллы уровня — тогда открывается выход. Рычаги (ворота/мосты), сферы гравитации,
   лифты, цветные ключи и двери, взрывчатка для трещиноватых стен, заводной бластер
   с ограниченными зарядами, обитатели пещер, сталактиты, шипы, кислота, секреты.
   Хаб-карта: 16 уровней в 2 эпизодах + Исполин в финале. Единицы — клетки и секунды.
   ZHEODA.Game(opts) → api; ZHEODA.logic — константы, уровни, физика (общая с ботом). */
(function (global) {
  'use strict';
  var Z = global.ZHEODA = global.ZHEODA || {};

  // ---------- Константы ----------
  var STEP = 1 / 60;
  var G = 55, JUMP_V = 19, VMAX = 18, RUN = 6, CUT = 0.4;   // прыжок ≈ 3,3 клетки вверх, ≈ 4 клетки вдаль
  var PW = 0.7, PH = 1.4;                                   // размер героини
  var COYOTE = 0.08, JBUF = 0.1;
  var HP = 3, LIVES = 3, AMMO0 = 6, AMMO_MAX = 12, CRATE = 4, DYN_MAX = 5;
  var SHOT_V = 16, SHOT_RANGE = 9, FIRE_CD = 0.26;
  var FUSE = 2.0, BLAST_R = 1.7, BLAST_HURT = 1.5, BLAST_KILL = 2.0;
  var INV_T = 1.4, DEAD_T = 1.8, CLEAR_T = 2.2, BANNER_T = 2.0;
  var LIFT_V = 3, LIFT_WAIT = 1.4, LIFT_H = 0.35;
  var VIEW_W = 20, VIEW_H = 11.25;                          // окно камеры в клетках (640×360 px при 32 px)
  var SCORE = { crystal: 100, gem: 500, secret: 1000, kill: 200, clear: 1000, boss: 10000, heart: 50, pick: 50 };
  // Обитатели (имена — в i18n): хрупень ползает, светляк летает, скакун прыгает, плевун плюётся
  var ENEMY = {
    c: { w: 0.8, h: 0.6, hp: 1, speed: 2.0 },
    f: { w: 0.7, h: 0.5, hp: 1, speed: 2.6 },
    j: { w: 0.8, h: 0.8, hp: 2, speed: 3.5 },
    s: { w: 0.8, h: 0.8, hp: 2, speed: 0 }
  };
  var BOSS = { w: 2.2, h: 2.0, hp: 24, fire0: 3.4, fire1: 2.4, shardV: 4.6 };
  var EPS = 1e-6;

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sgn(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  // ---------- Уровни ----------
  // Легенда:  # скала  % трещиноватая стена (взрывчатка)  + ложная стена (секрет)  - карниз (стоишь со стороны гравитации)
  //  | решётка (открыта, пока рычаг вкл)  : мост (есть, пока рычаг вкл)  R B Y двери  r b y ключи
  //  * кристалл  $ самоцвет  h аптечка  a ящик зарядов  d взрывчатка  \ рычаг  G сфера гравитации
  //  H лифт (подряд — ширина), = верхняя остановка лифта (в колонке его левого края)  E выход  P старт
  //  ^ шипы  ~ кислота  V сталактит  c f j s обитатели  X Исполин
  var LEVELS = [
    { name: 'mouth', ep: 1, tip: "mouth", map: [
      '################################',
      '#..............................#',
      '#..............................#',
      '#..............*...............#',
      '#.............###.......*......#',
      '#...*...................###....#',
      '#..###......*..................#',
      '#..........###...............*.#',
      '#......*............###......###',
      '#.....###......................#',
      '#P.........*.........c..*....E.#',
      '################################'] },
    { name: 'ledges', ep: 1, map: [
      '####################################',
      '#..................................#',
      '#..................................#',
      '#..*.............*............*....#',
      '#-----.........-----.........-----.#',
      '#..................................#',
      '#.........*..................*.....#',
      '#.......-----.......f.......-----..#',
      '#..................................#',
      '#...*...........*.........*........#',
      '#..-----......-----.....-----......#',
      '#..........f.......................#',
      '#P.......^^^.........^^^.........E.#',
      '####################################'] },
    { name: 'lever', ep: 1, tip: "lever", map: [
      '##################################',
      '#..............#.................#',
      '#..............#.................#',
      '#.......*......#.........*.......#',
      '#......###.....#........###......#',
      '#..............#.................#',
      '#...*..........#..............*..#',
      '#..###.........#.............###.#',
      '#..............|.................#',
      '#P...\\.........|.............c.E.#',
      '#######.....######~~~:::~~~#######',
      '#######..*..######~~~~~~~~~#######',
      '##################################'] },
    { name: 'key', ep: 1, tip: "key", map: [
      '####################################',
      '#..........#...........#...........#',
      '#..........#...........R....*......#',
      '#...r......#.....*.....R..........E#',
      '#..###.....#.---------##############',
      '#..........#.......................#',
      '#..........#..................*....#',
      '#------##.##----------.....-----...#',
      '#..................................#',
      '#.......*..........................#',
      '#.....###...----..............###..#',
      '#.........................c........#',
      '#P.......a..........*..........*..s#',
      '####################################'] },
    { name: 'drips', ep: 1, tip: "drips", map: [
      '########################################',
      '#....V......V.........V.......V....V...#',
      '#......................................#',
      '#......................................#',
      '#..*........*..........*.........*.....#',
      '#.-----...-----.......-----...-----....#',
      '#.........................f............#',
      '#......*.........*............*........#',
      '#....-----.....-----.......-----....--.#',
      '#...............j......................#',
      '#P.........a.......^^^........*......E.#',
      '########################################'] },
    { name: 'blast', ep: 1, tip: "blast", map: [
      '####################################',
      '#...........#.............#........#',
      '#..*........%.....*.......%.....*..#',
      '#...........%.............%........#',
      '#####----#######################..##',
      '####.....d.......*..........*....d.#',
      '#$.+........................s......#',
      '#..+##########################----.#',
      '####..........%....................#',
      '#..........*..%....................#',
      '#.....d.......%.....j...c......##..#',
      '#P............%.........d......##.E#',
      '####################################'] },
    { name: 'lift', ep: 1, tip: "lift", map: [
      '########################################',
      '#......................................#',
      '#......................................#',
      '#..*.......*.........*.........*....*..#',
      '#.............a.....~~.................#',
      '#########=.#################=.##########',
      '#...+..............#...................#',
      '#a$.+.f.......*....#.............*.....#',
      '#######......###...#............###....#',
      '#..................#...................#',
      '#P...*.............#...*......c......E.#',
      '#########HH############~~###HH##########',
      '########################################'] },
    { name: 'flip', ep: 1, tip: "flip", map: [
      '####################################',
      '#.........................^^^......#',
      '#.......*......*........*..........#',
      '#..................................#',
      '#..................................#',
      '#....G................G........G...#',
      '#..................................#',
      '#..................................#',
      '#......*............*........*.....#',
      '#P..........^^^^^^^........c......E#',
      '####################################'] },
    { name: 'twokeys', ep: 2, map: [
      '########################################',
      '#.........#...............#....:.......#',
      '#.........#.......*.......#....:..*....#',
      '#..b......#......###f.....#....:.###...#',
      '#.###.....R...............B....:.......#',
      '#......*..R...............B.\\..:.....E.#',
      '###############-----##########.#########',
      '#............#.........................#',
      '#........*...#.........................#',
      '#.......###..|.###.....................#',
      '#............|.........................#',
      '#P...\\.......|.....a.jr.......c..*....s#',
      '#########################~~#############',
      '########################################'] },
    { name: 'ceiling', ep: 2, map: [
      '########################################',
      '#.............^^^^^..........^^^^^.....#',
      '#.......*.......f.......*............*.#',
      '#......................................#',
      '#......................................#',
      '#...G.......G.......G......G.......G...#',
      '#......................................#',
      '#......................................#',
      '#.*.......a.....*.j............f.......#',
      '#P....^^^^^...........^^^^^...........E#',
      '########################################'] },
    { name: 'shaft', ep: 2, tip: "secret", map: [
      '########################',
      '#.................+....#',
      '#.........*.......+.$h.#',
      '#........###.....#######',
      '#......................#',
      '#.E.*..........*......s#',
      '##################=.####',
      '#......................#',
      '#......................#',
      '#.....f.......*........#',
      '#............###.......#',
      '#......................#',
      '#..*.................*.#',
      '##########=.######HH####',
      '#......................#',
      '#......................#',
      '#..............*.......#',
      '#.............###......#',
      '#......................#',
      '#P...*...........c...a.#',
      '##########HH############',
      '########################'] },
    { name: 'acid', ep: 2, map: [
      '##########################################',
      '#........................................#',
      '#....................*..f*..*............#',
      '#........................................#',
      '#........................................#',
      '#................G............G..........#',
      '#..*...*.....*....................*f.....#',
      '#.###....................................#',
      '#.......................................s#',
      '#P........a.....j.....................*.E#',
      '######~~~###~~~###~~~~~~~~~~~~###~~~######',
      '##########################################'] },
    { name: 'rockfall', ep: 2, map: [
      '########################################',
      '#...V....V...%........V....%......V....#',
      '#............%.............%...........#',
      '#..*......f..%.....*.......%.....*.....#',
      '#-----.......%..-----......%...-----...#',
      '#............%.............%...........#',
      '#P...d...*...%...d.....*d..%........*.s#',
      '####################%###################',
      '#.........V.....V........V......V......#',
      '#......................................#',
      '#....*..a...j..*....#...c...^..d.*...E.#',
      '########################################'] },
    { name: 'gears', ep: 2, map: [
      '########################################',
      '#...+...............#.................s#',
      '#.$.+.......*.......#.......*..*.......#',
      '######.....###......|..............G...#',
      '#.....j.*......\\....|.....G............#',
      '#########=.##############..............#',
      '#...................#..................#',
      '#...................#..............*.E.#',
      '#......f............#.............######',
      '#...................#..................#',
      '#P.a.*......c..*....#^^^^^^^^^^^^^^^^^^#',
      '#########HH#############################'] },
    { name: 'locks', ep: 2, map: [
      '##########################################',
      '#.........#.........#..........#.........#',
      '#.........#.........#..........#.........#',
      '#.........R.........B..........Y.........#',
      '#..r...*..R....*.s..B....*.....Y.......E.#',
      '##-----#.####.###############.############',
      '#........................................#',
      '#.....*.........b...f.....y.......*......#',
      '#....###.......###.......###.....###.....#',
      '#........................................#',
      '#P..a....*.c........*......j...*.c..a...s#',
      '##########################################',
      '##########################################'] },
    { name: 'core', ep: 2, map: [
      '############################################',
      '#.........%.........#.........#.....*......#',
      '#.........%.........#.........#............#',
      '#.........%.........R.........|.G.......G..#',
      '#..*....d.%....*....R....*....|..^^^^^^..E.#',
      '##-----.#####.##############.###############',
      '#..........................................#',
      '#.....*.............f...*.........r........#',
      '#....###..f............###.......###.......#',
      '#..........................................#',
      '#P.a.*..d...j.\\....*........c.a....j..*...s#',
      '############################################',
      '############################################'] },
    { name: 'colossus', ep: 3, respawn: true, map: [
      '##################################',
      '#................................#',
      '#................................#',
      '#..a..........................a..#',
      '#.---........................---.#',
      '#................................#',
      '#................X...............#',
      '#................................#',
      '#..G..........................G..#',
      '#................................#',
      '#..........--h--....-----........#',
      '#................................#',
      '#P..............a................#',
      '##################################'] }
  ];

  function parseLevel(lv) {
    var rows = lv.map, R = rows.length, C = 0, i;
    for (i = 0; i < R; i++) C = Math.max(C, rows[i].length);
    var out = { cols: C, rows: R, grid: new Array(C * R), items: [], enemies: [], levers: [], orbs: [], lifts: [], stal: [], start: null, exit: null, boss: null, liftTop: {} };
    var x, y, ch;
    for (y = 0; y < R; y++) for (x = 0; x < C; x++) {
      ch = rows[y][x] || '#';
      var keep = '.';
      if ('#%+-|:RBY^~'.indexOf(ch) >= 0) keep = ch;
      else if ('*$hadrby'.indexOf(ch) >= 0) out.items.push({ k: ch, cx: x, cy: y, x: x + 0.5, y: y + 0.5, taken: false });
      else if (ENEMY[ch]) out.enemies.push({ type: ch, cx: x, cy: y });
      else if (ch === '\\') out.levers.push({ cx: x, cy: y });
      else if (ch === 'G') out.orbs.push({ cx: x, cy: y, x: x + 0.5, y: y + 0.5 });
      else if (ch === 'V') out.stal.push({ cx: x, cy: y });
      else if (ch === 'P') out.start = { cx: x, cy: y };
      else if (ch === 'E') out.exit = { cx: x, cy: y };
      else if (ch === 'X') out.boss = { cx: x, cy: y };
      else if (ch === '=') out.liftTop[x] = y;
      else if (ch === 'H') { if (rows[y][x - 1] !== 'H') out.lifts.push({ cx: x, cy: y, w: 1 }); else out.lifts[out.lifts.length - 1].w++; }
      out.grid[y * C + x] = keep;
    }
    out.lifts.forEach(function (L) { L.top = out.liftTop[L.cx] != null ? out.liftTop[L.cx] : L.cy; });
    return out;
  }

  // ---------- Физика (общая для игры и планировщика бота) ----------
  // Мир: { cols, rows, solid(cx,cy), oneway(cx,cy), haz(cx,cy) → null|{kind,x,y,w,h}, lifts:[{x,y,w,h,dy}], orbs:[{x,y}] }
  function cellSolid(Wd, cx, cy) { if (cx < 0 || cy < 0 || cx >= Wd.cols || cy >= Wd.rows) return true; return Wd.solid(cx, cy); }
  function boxHits(Wd, x, y, w, h) {
    var x0 = Math.floor(x + EPS), x1 = Math.floor(x + w - EPS), y0 = Math.floor(y + EPS), y1 = Math.floor(y + h - EPS);
    for (var cy = y0; cy <= y1; cy++) for (var cx = x0; cx <= x1; cx++) if (cellSolid(Wd, cx, cy)) return true;
    return false;
  }
  function moveX(b, dx, Wd) {
    if (!dx) return false;
    var nx = b.x + dx;
    if (!boxHits(Wd, nx, b.y, b.w, b.h)) { b.x = nx; return false; }
    if (dx > 0) b.x = Math.max(b.x, Math.floor(nx + b.w - EPS) - b.w); else b.x = Math.min(b.x, Math.floor(nx + EPS) + 1);
    return true;
  }
  // → 0 (свободно) или {dir, lift}: упёрлись при движении вниз (dir=1) / вверх (dir=−1); lift — индекс лифта или −1
  var HIT = { dir: 0, lift: -1 };
  function moveY(b, dy, Wd, gs) {
    if (!dy) return 0;
    var ny = b.y + dy, stop = null, lift = -1, r, cx, x0, x1;
    if (boxHits(Wd, b.x, ny, b.w, b.h)) stop = dy > 0 ? Math.floor(ny + b.h - EPS) - b.h : Math.floor(ny + EPS) + 1;
    x0 = Math.floor(b.x + EPS); x1 = Math.floor(b.x + b.w - EPS);
    if (Wd.oneway) {
      if (gs > 0 && dy > 0) {
        r = Math.floor(ny + b.h - EPS);
        if (b.y + b.h <= r + EPS) for (cx = x0; cx <= x1; cx++) if (Wd.oneway(cx, r)) { if (stop == null || r - b.h < stop) stop = r - b.h; break; }
      } else if (gs < 0 && dy < 0) {
        r = Math.floor(ny + EPS);
        if (b.y >= r + 1 - EPS) for (cx = x0; cx <= x1; cx++) if (Wd.oneway(cx, r)) { if (stop == null || r + 1 > stop) stop = r + 1; break; }
      }
    }
    var Ls = Wd.lifts;
    if (Ls) for (var i = 0; i < Ls.length; i++) {
      var L = Ls[i]; if (!L || L.off) continue;
      if (!(b.x < L.x + L.w && b.x + b.w > L.x)) continue;
      if (dy > 0 && b.y + b.h <= L.y + 0.05 && ny + b.h > L.y) { if (stop == null || L.y - b.h <= stop) { stop = L.y - b.h; lift = i; } }
      else if (dy < 0 && b.y >= L.y + L.h - 0.05 && ny < L.y + L.h) { if (stop == null || L.y + L.h >= stop) { stop = L.y + L.h; lift = i; } }
    }
    if (stop == null) { b.y = ny; return 0; }
    b.y = dy > 0 ? Math.max(b.y, Math.min(ny, stop)) : Math.min(b.y, Math.max(ny, stop));
    HIT.dir = dy > 0 ? 1 : -1; HIT.lift = lift;
    return HIT;
  }
  function hazardAt(b, Wd) {
    if (!Wd.haz) return null;
    var x0 = Math.floor(b.x + EPS), x1 = Math.floor(b.x + b.w - EPS), y0 = Math.floor(b.y + EPS), y1 = Math.floor(b.y + b.h - EPS);
    for (var cy = y0; cy <= y1; cy++) for (var cx = x0; cx <= x1; cx++) {
      var h = Wd.haz(cx, cy);
      if (h && b.x + 0.08 < h.x + h.w && b.x + b.w - 0.08 > h.x && b.y + 0.08 < h.y + h.h && b.y + b.h - 0.08 > h.y) return h;
    }
    return null;
  }
  // высота выстрела: у колена — достаёт и низких ползунов
  function shotY(p) { return p.gs > 0 ? p.y + 0.85 : p.y + PH - 0.85; }
  function makeBody(x, y, gs) {
    return { x: x, y: y, w: PW, h: PH, vx: 0, vy: 0, gs: gs || 1, ground: false, lift: -1, face: 1, coyote: 0, jbuf: 0, jumping: false, prevJump: false, orbLock: false };
  }
  // Один шаг героини: inp = { dx∈[−1,1], jump(зажат) } → флаги шага (переиспользуемый объект)
  var FL = { jump: false, flip: false, land: false, hazard: null, bump: false };
  function stepPlayer(b, inp, Wd, dt) {
    FL.jump = false; FL.flip = false; FL.land = false; FL.hazard = null; FL.bump = false;
    // лифт несёт стоящего на нём
    if (b.ground && b.lift >= 0 && Wd.lifts && Wd.lifts[b.lift] && Wd.lifts[b.lift].dy) {
      var Lf = Wd.lifts[b.lift], keep = Lf.off; Lf.off = true; moveY(b, Lf.dy, Wd, b.gs); Lf.off = keep;
      if (b.gs > 0) b.y = Math.min(b.y, Lf.y - b.h); else b.y = Math.max(b.y, Lf.y + Lf.h);
    }
    var dx = clamp(inp.dx || 0, -1, 1);
    if (dx) b.face = dx > 0 ? 1 : -1;
    b.vx = dx * RUN;
    moveX(b, b.vx * dt, Wd);
    if (inp.jump && !b.prevJump) b.jbuf = JBUF;
    b.prevJump = !!inp.jump;
    if (b.ground) b.coyote = COYOTE; else b.coyote -= dt;
    if (b.jbuf > 0 && b.coyote > 0) { b.vy = -JUMP_V * b.gs; b.jumping = true; b.coyote = 0; b.jbuf = 0; b.ground = false; b.lift = -1; FL.jump = true; }
    b.jbuf -= dt;
    if (b.jumping && !inp.jump && b.vy * b.gs < 0) { b.vy *= CUT; b.jumping = false; }
    if (b.vy * b.gs >= 0) b.jumping = false;
    b.vy = clamp(b.vy + G * b.gs * dt, -VMAX, VMAX);
    var was = b.ground, h = moveY(b, b.vy * dt, Wd, b.gs);
    b.ground = false; b.lift = -1;
    if (h) {
      if (h.dir === b.gs) { b.ground = true; b.lift = h.lift; if (!was) FL.land = true; }
      else FL.bump = true;
      b.vy = 0;
    }
    // сферы гравитации: вход в сферу переворачивает тяготение
    var inOrb = false, O = Wd.orbs;
    if (O) for (var i = 0; i < O.length; i++) { var o = O[i]; if (o.x > b.x - 0.25 && o.x < b.x + b.w + 0.25 && o.y > b.y - 0.25 && o.y < b.y + b.h + 0.25) { inOrb = true; break; } }
    if (inOrb && !b.orbLock) { b.gs = -b.gs; b.vy *= 0.3; b.ground = false; b.lift = -1; b.jumping = false; FL.flip = true; }
    b.orbLock = inOrb;
    FL.hazard = hazardAt(b, Wd);
    return FL;
  }

  // Свойства клеток
  function solidCh(ch, keys, chan) {
    switch (ch) {
      case '#': case '%': return true;
      case 'R': case 'B': case 'Y': return !keys[ch];
      case '|': return !chan;
      case ':': return !!chan;
      default: return false;
    }
  }
  function hazCh(ch, cx, cy, solidAbove, solidBelow) {
    if (ch === '^') {
      if (solidAbove && !solidBelow) return { kind: 'spike', x: cx + 0.15, y: cy, w: 0.7, h: 0.5 };
      return { kind: 'spike', x: cx + 0.15, y: cy + 0.5, w: 0.7, h: 0.5 };
    }
    if (ch === '~') return { kind: 'acid', x: cx, y: cy + 0.3, w: 1, h: 0.7 };
    return null;
  }
  // Мир из «снимка» уровня: grid (символы), keys, chan, висящие сталактиты, лифты (rects), сферы
  function makeWorld(o) {
    var C = o.cols, grid = o.grid, keys = o.keys, hz = new Array(C * o.rows);
    for (var y = 0; y < o.rows; y++) for (var x = 0; x < C; x++) {
      var ch = grid[y * C + x];
      if (ch === '^' || ch === '~') hz[y * C + x] = hazCh(ch, x, y, y > 0 && grid[(y - 1) * C + x] === '#', y < o.rows - 1 && grid[(y + 1) * C + x] === '#');
    }
    (o.stal || []).forEach(function (s) { if (s.state === 'hang' || s.state === 'shake' || s.state == null) hz[s.cy * C + s.cx] = { kind: 'stal', x: s.cx + 0.25, y: s.cy, w: 0.5, h: 0.6 }; });
    var W = {
      cols: C, rows: o.rows, grid: grid, keys: keys, chan: o.chan, hz: hz,
      solid: function (cx, cy) { return solidCh(grid[cy * C + cx], keys, W.chan); },
      oneway: function (cx, cy) { return cx >= 0 && cy >= 0 && cx < C && cy < o.rows && grid[cy * C + cx] === '-'; },
      haz: function (cx, cy) { return cx >= 0 && cy >= 0 && cx < C && cy < o.rows ? hz[cy * C + cx] : null; },
      lifts: o.lifts || [], orbs: o.orbs || []
    };
    return W;
  }

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var onEvent = opts.onEvent || function () {};
    var maxLevel = opts.maxLevel || LEVELS.length;
    // сложность по номеру уровня: база + шаг, с потолком (в игре — g.difficulty движка)
    var difficulty = opts.difficulty || function (level, base, step, max) { var v = base + (level - 1) * step; return step >= 0 ? Math.min(v, max) : Math.max(v, max); };
    var K = {};   // параметры обитателей текущего уровня
    var S = {
      phase: 'hub', phaseT: 0, time: 0, level: opts.level || 1, maxLevel: maxLevel, lives: opts.lives || LIVES,
      hp: HP, score: 0, ammo: AMMO0, dyn: 0, keys: { R: false, B: false, Y: false }, chan: false, gs: 1,
      open: opts.level || 1, cleared: {}, hubSel: opts.level || 1, banner: 0,
      cols: 0, rows: 0, grid: [], items: [], enemies: [], levers: [], orbs: [], lifts: [], stal: [], shots: [], pebbles: [], dynas: [], blasts: [], shards: [], waves: [],
      secrets: [], secretsFound: 0, crystals: 0, crystalsLeft: 0, exitOpen: false, exit: null, boss: null, pl: null, cam: { x: 0, y: 0 },
      fireCd: 0, entry: null, name: '', ep: 1, over: false, won: false, stats: { kills: 0, secrets: 0, gems: 0 }, noEnemies: !!opts.noEnemies
    };
    for (var l0 = 1; l0 < S.open; l0++) S.cleared[l0] = true;
    var W = null, inp = { dx: 0, jump: false };

    function ev(t, d) { onEvent(t, d || {}); }
    function idx(x, y) { return y * S.cols + x; }

    function loadLevel(n) {
      var lv = LEVELS[n - 1], P = parseLevel(lv);
      S.level = n; S.name = lv.name; S.ep = lv.ep; S.bossLevel = !!P.boss; S.respawn = !!lv.respawn;
      S.cols = P.cols; S.rows = P.rows; S.grid = P.grid; S.items = P.items;
      S.crystals = P.items.filter(function (i) { return i.k === '*'; }).length; S.crystalsLeft = S.crystals;
      S.exitOpen = S.crystals === 0 && !P.boss; S.exit = P.exit;
      S.levers = P.levers.map(function (l) { return { cx: l.cx, cy: l.cy, on: false, cd: 0 }; });
      S.orbs = P.orbs; S.chan = false; S.gs = 1; S.keys = { R: false, B: false, Y: false };
      S.lifts = P.lifts.map(function (L) { return { cx: L.cx, x: L.cx, w: L.w, h: LIFT_H, yB: L.cy, yT: L.top, y: L.cy, dy: 0, dir: L.top < L.cy ? -1 : 1, wait: LIFT_WAIT, at: 0 }; });
      S.stal = P.stal.map(function (s) { return { cx: s.cx, cy: s.cy, x: s.cx + 0.25, y: s.cy, vy: 0, state: 'hang', t: 0 }; });
      K.crawl = difficulty(n, 2.0, 0.1, 3.4); K.fly = difficulty(n, 2.4, 0.1, 3.8); K.hopT = difficulty(n, 2.4, -0.06, 1.5);
      K.spitT = difficulty(n, 2.6, -0.05, 1.9); K.peb = difficulty(n, 6, 0.1, 7.5);
      S.enemies = S.noEnemies ? [] : P.enemies.map(mkEnemy);
      S.shots = []; S.pebbles = []; S.dynas = []; S.blasts = []; S.shards = []; S.waves = [];
      // секреты — связные группы ложных стен
      S.secrets = []; var seen = {};
      for (var i = 0; i < S.grid.length; i++) if (S.grid[i] === '+' && !seen[i]) {
        var grp = [], st = [i]; seen[i] = true;
        while (st.length) { var c = st.pop(); grp.push(c); var cx = c % S.cols, cy = (c / S.cols) | 0;
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nx = cx + d[0], ny = cy + d[1], k = ny * S.cols + nx; if (nx >= 0 && ny >= 0 && nx < S.cols && ny < S.rows && !seen[k] && S.grid[k] === '+') { seen[k] = true; st.push(k); } }); }
        S.secrets.push({ cells: grp, found: false });
      }
      S.secretsFound = 0;
      S.pl = makeBody(P.start.cx + 0.5 - PW / 2, P.start.cy + 1 - PH, 1);
      S.pl.ground = true; S.pl.inv = 0; S.pl.hurt = 0;
      S.hp = HP; S.boss = null;
      if (P.boss) S.boss = { x: P.boss.cx + 0.5 - BOSS.w / 2, y: P.boss.cy + 1 - BOSS.h, w: BOSS.w, h: BOSS.h, hp: S.bossKeep && S.bossKeep.level === n ? S.bossKeep.hp : BOSS.hp, max: BOSS.hp, t: 0, fireT: 3, flash: 0, vx: 0, vy: 0, ground: false, stun: 0, face: -1, dead: false };
      S.entry = { ammo: S.ammo, dyn: S.dyn, score: S.score };
      W = makeWorld(S);
      S.phase = 'play'; S.phaseT = 0; S.banner = BANNER_T; S.levelT = 0; S.fireCd = 0;
      S.cam.x = clamp(S.pl.x + PW / 2 - VIEW_W / 2, 0, Math.max(0, S.cols - VIEW_W));
      S.cam.y = clamp(S.pl.y + PH / 2 - VIEW_H / 2, 0, Math.max(0, S.rows - VIEW_H));
      ev('level', { level: n, name: S.name });
    }
    function mkEnemy(e) {
      var D = ENEMY[e.type], o = { type: e.type, w: D.w, h: D.h, hp: D.hp, x: e.cx + 0.5 - D.w / 2, y: e.cy + 1 - D.h, vx: 0, vy: 0, t: rng() * 2, dead: false, face: -1, flash: 0, ground: false };
      if (e.type === 'c') o.vx = (rng() < 0.5 ? -1 : 1) * K.crawl;
      if (e.type === 'f') { o.y = e.cy + 0.5 - D.h / 2; o.y0 = o.y; o.vx = (rng() < 0.5 ? -1 : 1) * K.fly; }
      if (e.type === 'j') o.t = 0.8 + rng();
      if (e.type === 's') o.t = 1 + rng();
      return o;
    }
    function rebuildWorld() { W.chan = S.chan; }

    // ---------- Урон / смерть ----------
    function hurt(src) {
      var p = S.pl; if (p.inv > 0 || S.phase !== 'play') return;
      S.hp--; p.inv = INV_T; p.hurt = 0.3; ev('hurt', { hp: S.hp, src: src, x: p.x + PW / 2, y: p.y + PH / 2 });
      if (S.hp <= 0) die(src); else { p.vy = -8 * p.gs; p.ground = false; }
    }
    function die(src) {
      if (S.phase !== 'play') return;
      S.lives--; S.hp = 0; S.phase = 'dead'; S.phaseT = 0;
      if (S.boss && !S.boss.dead) S.bossKeep = { level: S.level, hp: S.boss.hp };   // Исполин не заживает между попытками
      ev('die', { lives: S.lives, src: src, x: S.pl.x + PW / 2, y: S.pl.y + PH / 2 });
      if (S.lives <= 0) { S.phase = 'over'; S.over = true; ev('gameover', { score: S.score }); }
    }

    // ---------- Взаимодействие ----------
    function leverAt() {
      var p = S.pl;
      for (var i = 0; i < S.levers.length; i++) { var l = S.levers[i]; if (overlap(p, { x: l.cx + 0.1, y: l.cy, w: 0.8, h: 1 })) return l; }
      return null;
    }
    function toggleLever(l) {
      l.on = !l.on; S.chan = !S.chan; S.levers.forEach(function (o) { o.on = S.chan; }); rebuildWorld();
      ev('lever', { on: S.chan, x: l.cx + 0.5, y: l.cy + 0.5 });
    }
    function down() {
      if (S.phase !== 'play') return false;
      var l = leverAt();
      if (l) { toggleLever(l); return true; }
      var p = S.pl;
      if (S.dyn > 0 && p.ground) {
        S.dyn--; var x = p.x + PW / 2, y = p.gs > 0 ? p.y + PH - 0.3 : p.y + 0.3;
        S.dynas.push({ x: x, y: y, t: FUSE }); ev('place', { x: x, y: y }); return true;
      }
      return false;
    }
    function fire() {
      if (S.phase !== 'play' || S.fireCd > 0) return false;
      if (S.ammo <= 0) { S.fireCd = FIRE_CD; ev('empty'); return false; }
      var p = S.pl; S.ammo--; S.fireCd = FIRE_CD;
      S.shots.push({ x: p.x + PW / 2 + p.face * 0.4, y: shotY(p), vx: p.face * SHOT_V, d: 0 });
      ev('shot', { x: p.x + PW / 2, y: p.y + 0.7 });
      return true;
    }
    function explode(d) {
      var x = d.x, y = d.y, broke = 0;
      for (var cy = Math.floor(y - 2); cy <= Math.floor(y + 2); cy++) for (var cx = Math.floor(x - 2); cx <= Math.floor(x + 2); cx++) {
        if (cx < 0 || cy < 0 || cx >= S.cols || cy >= S.rows) continue;
        if (S.grid[idx(cx, cy)] === '%' && Math.hypot(cx + 0.5 - x, cy + 0.5 - y) <= BLAST_R) { S.grid[idx(cx, cy)] = '.'; broke++; ev('wall', { x: cx + 0.5, y: cy + 0.5 }); }
      }
      S.enemies.forEach(function (e) { if (!e.dead && Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y) <= BLAST_KILL) kill(e); });
      S.stal.forEach(function (s) { if (s.state === 'hang' && Math.hypot(s.cx + 0.5 - x, s.cy + 0.5 - y) <= BLAST_KILL) { s.state = 'fall'; s.vy = 0; } });
      if (S.boss && !S.boss.dead && Math.hypot(S.boss.x + S.boss.w / 2 - x, S.boss.y + S.boss.h / 2 - y) <= BLAST_KILL + 1) hitBoss(4);
      var p = S.pl; if (Math.hypot(p.x + PW / 2 - x, p.y + PH / 2 - y) <= BLAST_HURT) hurt('blast');
      S.blasts.push({ x: x, y: y, t: 0.5 });
      ev('blast', { x: x, y: y, broke: broke });
      W = makeWorld(S);
    }
    function kill(e) {
      e.dead = true; if (S.cleared[S.level] !== 'replay') S.score += SCORE.kill; S.stats.kills++;
      ev('kill', { type: e.type, x: e.x + e.w / 2, y: e.y + e.h / 2 });
    }
    function hitBoss(n) {
      var B = S.boss; if (!B || B.dead) return;
      B.hp = Math.max(0, B.hp - n); B.flash = 0.15; ev('bossHit', { hp: B.hp, x: B.x + B.w / 2, y: B.y + B.h / 2 });
      if (B.hp <= 0) {
        B.dead = true; S.score += SCORE.boss; ev('bossDie', { x: B.x + B.w / 2, y: B.y + B.h / 2 });
        S.shards = []; S.waves = []; S.exitOpen = true; clearLevel();
      }
    }
    function clearLevel() {
      if (S.phase !== 'play') return;
      var bonus = SCORE.clear + Math.max(0, Math.round(120 - S.levelT)) * 10 + (S.secrets.length && S.secretsFound === S.secrets.length ? 2000 : 0);
      S.score += bonus; S.clearBonus = bonus; S.phase = 'clear'; S.phaseT = 0; S.cleared[S.level] = true;
      ev('clear', { level: S.level, bonus: bonus });
    }

    // ---------- Обновление объектов ----------
    function pickups() {
      var p = S.pl;
      for (var i = 0; i < S.items.length; i++) {
        var it = S.items[i]; if (it.taken) continue;
        if (!(it.x > p.x - 0.35 && it.x < p.x + PW + 0.35 && it.y > p.y - 0.35 && it.y < p.y + PH + 0.35)) continue;
        var k = it.k;
        if (k === 'a' && S.ammo >= AMMO_MAX) continue;
        if (k === 'h' && S.hp >= HP) continue;
        if (k === 'd' && S.dyn >= DYN_MAX) continue;
        it.taken = true; it.t = 0;
        if (k === '*') { S.crystalsLeft--; S.score += SCORE.crystal; ev('crystal', { x: it.x, y: it.y, left: S.crystalsLeft }); if (S.crystalsLeft === 0) { S.exitOpen = true; ev('exitOpen', { x: S.exit.cx + 0.5, y: S.exit.cy }); } }
        else if (k === '$') { S.score += SCORE.gem; S.stats.gems++; ev('gem', { x: it.x, y: it.y }); }
        else if (k === 'h') { S.hp++; S.score += SCORE.heart; ev('heal', { x: it.x, y: it.y }); }
        else if (k === 'a') { S.ammo = Math.min(AMMO_MAX, S.ammo + CRATE); S.score += SCORE.pick; ev('ammo', { x: it.x, y: it.y, ammo: S.ammo }); }
        else if (k === 'd') { S.dyn++; S.score += SCORE.pick; ev('dyn', { x: it.x, y: it.y }); }
        else { var door = k.toUpperCase(); S.keys[door] = true; S.score += SCORE.pick; ev('key', { k: door, x: it.x, y: it.y }); }
      }
      // двери, в которые входит героиня с ключом, открываются
      var x0 = Math.floor(p.x - 0.05), x1 = Math.floor(p.x + PW + 0.05), y0 = Math.floor(p.y + EPS), y1 = Math.floor(p.y + PH - EPS);
      for (var cy = y0; cy <= y1; cy++) for (var cx = x0; cx <= x1; cx++) {
        if (cx < 0 || cy < 0 || cx >= S.cols || cy >= S.rows) continue;
        var ch = S.grid[idx(cx, cy)];
        if ((ch === 'R' || ch === 'B' || ch === 'Y') && S.keys[ch]) openDoor(cx, cy, ch);
        if (ch === '+') findSecret(idx(cx, cy));
      }
      if (S.exitOpen && S.exit && S.phase === 'play' && overlap(p, { x: S.exit.cx + 0.2, y: S.exit.cy - 0.8, w: 0.6, h: 1.8 })) clearLevel();
    }
    function openDoor(cx, cy, ch) {
      var st = [[cx, cy]], n = 0;   // дверь — вертикальная/горизонтальная связная группа одного цвета
      while (st.length) { var c = st.pop(), k = idx(c[0], c[1]); if (S.grid[k] !== ch) continue; S.grid[k] = '.'; n++;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nx = c[0] + d[0], ny = c[1] + d[1]; if (nx >= 0 && ny >= 0 && nx < S.cols && ny < S.rows && S.grid[idx(nx, ny)] === ch) st.push([nx, ny]); }); }
      ev('door', { k: ch, x: cx + 0.5, y: cy + 0.5 });
    }
    function findSecret(k) {
      for (var i = 0; i < S.secrets.length; i++) { var s = S.secrets[i]; if (!s.found && s.cells.indexOf(k) >= 0) { s.found = true; S.secretsFound++; S.score += SCORE.secret; S.stats.secrets++; ev('secret', { x: (k % S.cols) + 0.5, y: ((k / S.cols) | 0) + 0.5 }); } }
    }

    function updateLifts(dt) {
      for (var i = 0; i < S.lifts.length; i++) {
        var L = S.lifts[i], y0 = L.y; L.dy = 0;
        if (L.yT === L.yB) continue;
        if (L.wait > 0) { L.wait -= dt; continue; }
        var target = L.dir < 0 ? L.yT : L.yB;
        L.y += L.dir * LIFT_V * dt;
        if ((L.dir < 0 && L.y <= target) || (L.dir > 0 && L.y >= target)) { L.y = target; L.dir = -L.dir; L.wait = LIFT_WAIT; L.at = L.y === L.yT ? 1 : 0; ev('lift', { i: i }); }
        L.dy = L.y - y0;
      }
    }
    // Предмет/обитатель под тяготением (простое тело)
    function fallBody(e, dt, gs) {
      e.vy = clamp(e.vy + G * gs * dt, -VMAX, VMAX);
      var h = moveY(e, e.vy * dt, W, gs);
      e.ground = false;
      if (h) { if (h.dir === gs) e.ground = true; e.vy = 0; }
    }
    function updateEnemies(dt) {
      var p = S.pl, pcx = p.x + PW / 2, pcy = p.y + PH / 2;
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (e.dead) continue;
        e.t += dt; if (e.flash > 0) e.flash -= dt;
        var D = ENEMY[e.type], gs = S.gs;
        if (e.type === 'c') {
          fallBody(e, dt, gs);
          if (e.ground) {
            if (!e.vx) e.vx = K.crawl;
            var blocked = moveX(e, e.vx * dt, W);
            var fx = e.vx > 0 ? e.x + e.w + 0.05 : e.x - 0.05, fy = gs > 0 ? e.y + e.h + 0.1 : e.y - 0.1;
            var cx = Math.floor(fx), cy = Math.floor(fy), floor = cellSolid(W, cx, cy) || W.oneway(cx, cy);
            var hz = W.haz(cx, Math.floor(e.y + e.h / 2));
            if (blocked || !floor || hz) e.vx = -e.vx;
            e.face = sgn(e.vx);
          }
        } else if (e.type === 'f') {
          if (moveX(e, e.vx * dt, W)) e.vx = -e.vx;
          var ny = e.y0 + Math.sin(e.t * 2.4) * 0.45;
          if (!boxHits(W, e.x, ny, e.w, e.h)) e.y = ny;
          e.face = sgn(e.vx);
        } else if (e.type === 'j') {
          fallBody(e, dt, gs);
          if (e.ground) {
            e.vx = 0;
            e.jt = (e.jt == null ? 1 : e.jt) - dt;
            if (e.jt <= 0 && Math.abs(pcx - e.x) < 7 && Math.abs(pcy - e.y) < 4) { e.vy = -12 * gs; e.vx = sgn(pcx - (e.x + e.w / 2)) * D.speed; e.jt = K.hopT; e.ground = false; ev('hop', { x: e.x, y: e.y }); }
          } else if (moveX(e, e.vx * dt, W)) e.vx = 0;
          e.face = sgn(pcx - e.x) || 1;
        } else if (e.type === 's') {
          e.face = pcx < e.x + e.w / 2 ? -1 : 1;
          e.st = (e.st == null ? 1.2 : e.st) - dt;
          var ey = e.y + e.h / 2;
          if (e.st <= 0 && Math.abs(pcy - ey) < 1.0 && Math.abs(pcx - (e.x + e.w / 2)) < 9 && clearLine(e.x + e.w / 2, ey, pcx)) {
            S.pebbles.push({ x: e.x + e.w / 2 + e.face * 0.4, y: ey, vx: e.face * K.peb }); e.st = K.spitT; ev('spit', { x: e.x, y: ey });
          }
        }
        // кислота растворяет обитателей
        var ah = W.haz(Math.floor(e.x + e.w / 2), Math.floor(e.y + e.h / 2));
        if (ah && ah.kind === 'acid' && e.type !== 'f') { e.dead = true; ev('dissolve', { x: e.x + e.w / 2, y: e.y + e.h / 2 }); continue; }
        if (!e.dead && p.inv <= 0 && overlap({ x: p.x + 0.1, y: p.y + 0.1, w: PW - 0.2, h: PH - 0.2 }, e)) hurt(e.type);
      }
    }
    function clearLine(x0, y, x1) {
      var cy = Math.floor(y), a = Math.floor(Math.min(x0, x1)), b = Math.floor(Math.max(x0, x1));
      for (var cx = a; cx <= b; cx++) if (cellSolid(W, cx, cy)) return false;
      return true;
    }
    function updateShots(dt) {
      var i, s;
      for (i = S.shots.length - 1; i >= 0; i--) {
        s = S.shots[i]; var dead = false;
        for (var k = 0; k < 2 && !dead; k++) {
          s.x += s.vx * dt / 2; s.d += Math.abs(s.vx) * dt / 2;
          if (cellSolid(W, Math.floor(s.x), Math.floor(s.y)) || s.d > SHOT_RANGE) { dead = true; ev('spark', { x: s.x, y: s.y }); break; }
          for (var j = 0; j < S.enemies.length; j++) {
            var e = S.enemies[j]; if (e.dead) continue;
            if (s.x > e.x - 0.1 && s.x < e.x + e.w + 0.1 && s.y > e.y - 0.15 && s.y < e.y + e.h + 0.15) {
              e.hp--; e.flash = 0.15; dead = true; if (e.type === 'j') e.jt = Math.max(e.jt || 0, 0.8); if (e.hp <= 0) kill(e); else ev('hit', { x: s.x, y: s.y }); break;
            }
          }
          var B = S.boss;
          if (!dead && B && !B.dead && s.x > B.x && s.x < B.x + B.w && s.y > B.y && s.y < B.y + B.h) { dead = true; hitBoss(1); }
        }
        if (dead) S.shots.splice(i, 1);
      }
      var p = S.pl;
      for (i = S.pebbles.length - 1; i >= 0; i--) {
        s = S.pebbles[i]; s.x += s.vx * dt;
        if (cellSolid(W, Math.floor(s.x), Math.floor(s.y))) { S.pebbles.splice(i, 1); continue; }
        if (s.x > p.x && s.x < p.x + PW && s.y > p.y && s.y < p.y + PH) { S.pebbles.splice(i, 1); hurt('pebble'); }
      }
      for (i = S.shards.length - 1; i >= 0; i--) {
        s = S.shards[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.t += dt;
        if (s.t > 6 || cellSolid(W, Math.floor(s.x), Math.floor(s.y))) { S.shards.splice(i, 1); continue; }
        if (s.x > p.x && s.x < p.x + PW && s.y > p.y && s.y < p.y + PH) { S.shards.splice(i, 1); hurt('shard'); }
      }
    }
    function updateStal(dt) {
      var p = S.pl, pcx = p.x + PW / 2, changed = false;
      for (var i = 0; i < S.stal.length; i++) {
        var s = S.stal[i];
        if (s.state === 'hang') {
          if (Math.abs(pcx - (s.cx + 0.5)) < 0.95 && p.y > s.cy && p.y - s.cy < 9 && colClear(s.cx, s.cy + 1, Math.floor(p.y))) { s.state = 'shake'; s.t = 0.3; ev('crack', { x: s.cx + 0.5, y: s.cy }); }
        } else if (s.state === 'shake') {
          s.t -= dt; if (s.t <= 0) { s.state = 'fall'; s.vy = 0; changed = true; }
        } else if (s.state === 'fall') {
          s.vy = Math.min(VMAX, s.vy + G * dt); s.y += s.vy * dt;
          if (s.x < p.x + PW && s.x + 0.5 > p.x && s.y < p.y + PH && s.y + 0.6 > p.y) { s.state = 'gone'; hurt('stal'); ev('shatter', { x: s.x + 0.25, y: s.y + 0.6 }); continue; }
          if (cellSolid(W, s.cx, Math.floor(s.y + 0.6)) || W.oneway(s.cx, Math.floor(s.y + 0.6)) || s.y > S.rows) { s.state = 'gone'; ev('shatter', { x: s.x + 0.25, y: s.y + 0.6 }); }
          for (var j = 0; j < S.enemies.length; j++) { var e = S.enemies[j]; if (!e.dead && overlap({ x: s.x, y: s.y, w: 0.5, h: 0.6 }, e)) { kill(e); s.state = 'gone'; ev('shatter', { x: s.x + 0.25, y: s.y + 0.6 }); break; } }
        }
      }
      if (changed) W = makeWorld(S);
    }
    function colClear(cx, y0, y1) { for (var y = y0; y <= y1; y++) if (cellSolid(W, cx, y)) return false; return true; }
    function updateDynas(dt) {
      for (var i = S.dynas.length - 1; i >= 0; i--) { var d = S.dynas[i]; d.t -= dt; if (d.t <= 0) { S.dynas.splice(i, 1); explode(d); } }
      for (i = S.blasts.length - 1; i >= 0; i--) { S.blasts[i].t -= dt; if (S.blasts[i].t <= 0) S.blasts.splice(i, 1); }
    }
    // Исполин: тяжёлый ходок, подчиняется гравитации (перевернёшь — рухнет на потолок и оглохнет),
    // звёздные залпы осколков с предупреждением, в ярости — прыжок с ударной волной по полу.
    function updateBoss(dt) {
      var B = S.boss; if (!B || B.dead) return;
      B.t += dt; if (B.flash > 0) B.flash -= dt;
      var p = S.pl, f = B.hp / B.max, gs = S.gs, pcx = p.x + PW / 2, bcx = B.x + B.w / 2;
      var wasGround = B.ground;
      B.vy = clamp((B.vy || 0) + G * gs * dt, -VMAX, VMAX);
      var h = moveY(B, B.vy * dt, W, gs); B.ground = false;
      if (h) { if (h.dir === gs) B.ground = true; B.vy = 0; }
      if (B.ground && !wasGround && B.airT > 0.25) {
        if (B.slam) { B.slam = false; var sy = gs > 0 ? B.y + B.h : B.y; S.waves.push({ x: bcx, dir: -1, y: sy, gs: gs, t: 0 }, { x: bcx, dir: 1, y: sy, gs: gs, t: 0 }); ev('slam', { x: bcx, y: sy }); }
        else { B.stun = 1.4; ev('thud', { x: bcx, y: B.y + B.h / 2 }); }
      }
      B.airT = B.ground ? 0 : (B.airT || 0) + dt;
      if (B.stun > 0) { B.stun -= dt; }
      else if (B.ground) {
        B.vx = sgn(pcx - bcx) * (1.4 + (1 - f) * 1.4);
        if (Math.abs(pcx - bcx) < 0.3) B.vx = 0;
        moveX(B, B.vx * dt, W); B.face = sgn(B.vx) || B.face || -1;
        if (f < 0.5) { B.slamT = (B.slamT == null ? 4 : B.slamT) - dt; if (B.slamT <= 0) { B.slamT = 5; B.vy = -15 * gs; B.ground = false; B.slam = true; ev('hop', { x: bcx, y: B.y }); } }
      }
      if (!(B.stun > 0)) {
        B.fireT -= dt;
        if (B.fireT <= 0.6 && !B.tele) { B.tele = true; ev('tele', { x: bcx, y: B.y + B.h / 2 }); }   // предупреждение: ядро вспыхивает
        if (B.fireT <= 0) {
          B.fireT = BOSS.fire1 + (BOSS.fire0 - BOSS.fire1) * f; B.tele = false;
          var cx = B.x + B.w / 2, cy = B.y + B.h / 2, n = f < 0.5 ? 6 : 5, rot = rng() * Math.PI * 2;
          for (var k2 = 0; k2 < n; k2++) { var aa = rot + k2 * Math.PI * 2 / n; S.shards.push({ x: cx, y: cy, vx: Math.cos(aa) * BOSS.shardV, vy: Math.sin(aa) * BOSS.shardV, t: 0 }); }
          ev('shard', { x: cx, y: cy });
        }
      }
      for (var i = S.waves.length - 1; i >= 0; i--) {
        var wv = S.waves[i]; wv.x += wv.dir * 7 * dt; wv.t += dt;
        var wy = wv.gs > 0 ? wv.y - 0.5 : wv.y + 0.5;
        if (wv.t > 4 || cellSolid(W, Math.floor(wv.x + wv.dir * 0.3), Math.floor(wy))) { S.waves.splice(i, 1); continue; }
        var wr = { x: wv.x - 0.35, y: wv.gs > 0 ? wv.y - 0.7 : wv.y, w: 0.7, h: 0.7 };
        if (p.inv <= 0 && overlap(p, wr)) hurt('wave');
      }
      if (p.inv <= 0 && overlap({ x: p.x + 0.1, y: p.y + 0.1, w: PW - 0.2, h: PH - 0.2 }, { x: B.x + 0.3, y: B.y + 0.3, w: B.w - 0.6, h: B.h - 0.6 })) hurt('boss');
    }
    function updateItems(dt) {
      if (!S.respawn) return;
      S.items.forEach(function (it) { if (it.taken && (it.k === 'a' || it.k === 'h')) { it.t += dt; if (it.t > (it.k === 'a' ? 6 : 14)) it.taken = false; } });
    }
    function updateCam(dt) {
      var p = S.pl, tx = p.x + PW / 2 - VIEW_W / 2 + p.face * 1.5, ty = p.y + PH / 2 - VIEW_H / 2;
      tx = clamp(tx, 0, Math.max(0, S.cols - VIEW_W)); ty = clamp(ty, 0, Math.max(0, S.rows - VIEW_H));
      var k = 1 - Math.exp(-6 * dt);
      S.cam.x += (tx - S.cam.x) * k; S.cam.y += (ty - S.cam.y) * k;
    }

    function update(dt) {
      S.time += dt; S.phaseT += dt;
      if (S.phase === 'hub' || S.phase === 'over' || S.phase === 'won') return;
      if (S.phase === 'dead') {
        updateCam(dt);
        if (S.phaseT >= DEAD_T) { S.ammo = S.entry.ammo; S.dyn = S.entry.dyn; loadLevel(S.level); ev('respawn'); }
        return;
      }
      if (S.phase === 'clear') {
        if (S.phaseT >= CLEAR_T) {
          if (S.level >= S.maxLevel) { S.phase = 'won'; S.won = true; ev('win', { score: S.score }); }
          else { S.open = Math.max(S.open, S.level + 1); S.hubSel = S.level + 1; S.phase = 'hub'; S.phaseT = 0; ev('hub', { open: S.open }); }
        }
        return;
      }
      // play
      S.levelT += dt; if (S.banner > 0) S.banner -= dt; if (S.fireCd > 0) S.fireCd -= dt;
      var p = S.pl;
      if (p.inv > 0) p.inv -= dt; if (p.hurt > 0) p.hurt -= dt;
      S.levers.forEach(function (l) { if (l.cd > 0) l.cd -= dt; });
      updateLifts(dt);
      var fl = stepPlayer(p, inp, W, dt);
      if (fl.jump) ev('jump');
      if (fl.land) ev('land');
      if (fl.flip) { S.gs = p.gs; ev('flip', { gs: S.gs, x: p.x + PW / 2, y: p.y + PH / 2 }); }
      if (fl.hazard) { if (fl.hazard.kind === 'acid') { hurtAcid(); return; } hurt(fl.hazard.kind); if (S.phase !== 'play') return; }
      pickups(); if (S.phase !== 'play') return;
      updateEnemies(dt); if (S.phase !== 'play') return;
      updateShots(dt); if (S.phase !== 'play') return;
      updateStal(dt); if (S.phase !== 'play') return;
      updateDynas(dt); if (S.phase !== 'play') return;
      updateBoss(dt); updateItems(dt);
      updateCam(dt);
    }
    function hurtAcid() { S.hp = 0; die('acid'); }

    var api = {
      _S: S,
      start: function () { S.phase = 'hub'; S.phaseT = 0; S.hubSel = S.open; ev('hub', { open: S.open }); return api; },
      state: function () { return S; },
      world: function () { return W; },
      update: function (dt) { update(dt); },
      setInput: function (dx, jump) { inp.dx = dx; inp.jump = !!jump; },
      fire: fire, down: down,
      hubMove: function (d) { if (S.phase !== 'hub') return; var n = clamp(S.hubSel + d, 1, S.open); if (n !== S.hubSel) { S.hubSel = n; ev('hubMove', { sel: n }); } },
      // вход в уровень с хаба: только открытый и ещё не пройденный (уровни открываются по очереди)
      enter: function (n) { if (S.phase !== 'hub') return false; n = n || S.hubSel; if (n > S.open || S.cleared[n]) { ev('locked', { n: n }); return false; } loadLevel(n); return true; },
      canEnter: function (n) { return n <= S.open && !S.cleared[n]; },
      loadLevel: function (n) { loadLevel(n); return api; },
      _hurt: hurt, _explode: explode, _clear: clearLevel, _rebuild: function () { W = makeWorld(S); }
    };
    return api;
  }

  Z.Game = Game;
  Z.logic = {
    STEP: STEP, G: G, JUMP_V: JUMP_V, VMAX: VMAX, RUN: RUN, PW: PW, PH: PH, HP: HP, LIVES: LIVES, AMMO0: AMMO0, AMMO_MAX: AMMO_MAX, CRATE: CRATE,
    SHOT_V: SHOT_V, SHOT_RANGE: SHOT_RANGE, FUSE: FUSE, BLAST_R: BLAST_R, BLAST_HURT: BLAST_HURT, LIFT_V: LIFT_V, LIFT_WAIT: LIFT_WAIT, LIFT_H: LIFT_H,
    VIEW_W: VIEW_W, VIEW_H: VIEW_H, SCORE: SCORE, ENEMY: ENEMY, BOSS: BOSS, LEVELS: LEVELS, INV_T: INV_T,
    shotY: shotY, parseLevel: parseLevel, makeWorld: makeWorld, makeBody: makeBody, stepPlayer: stepPlayer, moveX: moveX, moveY: moveY,
    boxHits: boxHits, cellSolid: cellSolid, solidCh: solidCh, mulberry32: mulberry32
  };
})(typeof window !== 'undefined' ? window : globalThis);
