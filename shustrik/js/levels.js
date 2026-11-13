/* ШУСТРИК · levels.js — генератор актов: 4 мира × 2 акта (во 2-м акте — арена босса) + бонус-этапы.
   Детерминированно: у каждого акта свой сид. Карта — сетка клеток 16×16 px (H = 64 ряда): твердь, склоны 45°
   и пологие (2 клетки на подъём в 1 клетку), проходимые снизу мостки, шипы, ящики (разбиваются на 3-й скорости),
   ложные стены тайников. Объекты — в пикселях (y — уровень опоры, «подошвы»).
   Акт собирается из сегментов слева направо: разбег, холмы, ямы, пружины у высоких стен, желоба-спуски,
   рельсы-скольжения над пропастью, паровые шахты, трубы-ускорители, мостки, верхний маршрут, ящики, тайники. */
(function (global) {
  'use strict';
  var SH = global.SHUSTRIK = global.SHUSTRIK || {};
  var T = 16, H = 64;
  // коды клеток: пусто, твердь, склоны, мосток, шипы, ложная стена, ящик, пустота тайника
  var C = { E: 0, S: 1, U45: 2, D45: 3, UA: 4, UB: 5, DC: 6, DD: 7, P: 8, SP: 9, F: 10, X: 11, H: 12 };   // H — пустота тайника (проходима, рисуется кладкой)

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function Builder(seed, maxW) {
    this.w = maxW; this.t = new Uint8Array(maxW * H); this.x = 0; this.gy = 44;
    this.r = mulberry32(seed); this.uid = 1;
    this.o = { gears: [], caps: [], springs: [], pipes: [], rails: [], steam: [], cps: [], enemies: [], secrets: [], goal: null, arena: null };
  }
  var B = Builder.prototype;
  B.ri = function (a, b) { return a + Math.floor(this.r() * (b - a + 1)); };
  B.pick = function (arr) { return arr[Math.floor(this.r() * arr.length)]; };
  B.set = function (c, r, v) { if (c >= 0 && c < this.w && r >= 0 && r < H) this.t[r * this.w + c] = v; };
  B.get = function (c, r) { return (c >= 0 && c < this.w && r >= 0 && r < H) ? this.t[r * this.w + c] : 0; };
  B.ground = function (c, row) { for (var r = Math.max(0, row); r < H; r++) this.set(c, r, C.S); };
  B.Y = function () { return this.gy * T; };
  B.X = function (dc) { return (this.x + (dc || 0)) * T; };
  // --- рельеф ---
  B.flat = function (n) { for (var i = 0; i < n; i++) this.ground(this.x + i, this.gy); this.x += n; };
  B.up45 = function (n) { for (var i = 0; i < n; i++) { var c = this.x + i, r = this.gy - 1 - i; this.set(c, r, C.U45); this.ground(c, r + 1); } this.gy -= n; this.x += n; };
  B.down45 = function (n) { for (var i = 0; i < n; i++) { var c = this.x + i, r = this.gy + i; this.set(c, r, C.D45); this.ground(c, r + 1); } this.gy += n; this.x += n; };
  B.upG = function (n) { for (var k = 0; k < n; k++) { var c = this.x + 2 * k, r = this.gy - 1; this.set(c, r, C.UA); this.ground(c, r + 1); this.set(c + 1, r, C.UB); this.ground(c + 1, r + 1); this.gy -= 1; } this.x += 2 * n; };
  B.downG = function (n) { for (var k = 0; k < n; k++) { var c = this.x + 2 * k, r = this.gy; this.set(c, r, C.DC); this.ground(c, r + 1); this.set(c + 1, r, C.DD); this.ground(c + 1, r + 1); this.gy += 1; } this.x += 2 * n; };
  B.pit = function (n) { this.x += n; };
  B.spikes = function (n) { for (var i = 0; i < n; i++) { this.ground(this.x + i, this.gy + 1); this.set(this.x + i, this.gy, C.SP); } this.gy += 0; this.x += n; };
  B.plat = function (c, r, n) { for (var i = 0; i < n; i++) this.set(c + i, r, C.P); };
  // --- объекты ---
  B.gear = function (x, y) { this.o.gears.push({ id: this.uid++, x: Math.round(x), y: Math.round(y) }); };
  B.gearLine = function (x0, y, n, step) { for (var i = 0; i < n; i++) this.gear(x0 + i * (step || 22), y); };
  B.gearArc = function (x0, x1, y, h, n) { for (var i = 0; i < n; i++) { var f = n === 1 ? 0.5 : i / (n - 1); this.gear(x0 + (x1 - x0) * f, y - Math.sin(f * Math.PI) * h); } };
  B.cap = function (x, y, k) { this.o.caps.push({ id: this.uid++, x: x, y: y, k: k }); };
  B.enemy = function (k, x, y, x0, x1) { this.o.enemies.push({ id: this.uid++, k: k, x: x, y: y, x0: x0 == null ? x - 64 : x0, x1: x1 == null ? x + 64 : x1 }); };
  B.secret = function (x, y, token) { this.o.secrets.push({ id: this.uid++, x: x, y: y, token: !!token }); };
  B.spring = function (x, y) { this.o.springs.push({ id: this.uid++, x: x, y: y }); };
  B.cp = function () { this.flat(2); this.o.cps.push({ id: this.uid++, x: this.X(), y: this.Y() }); this.flat(4); };

  var WEAP = ['burst', 'blast', 'bounce'], BON = ['shield', 'turbo', 'magnet'];
  // ---------- сегменты ----------
  var SEG = {
    run: function (b, d) {
      var n = b.ri(10, 16), x0 = b.X(), y = b.Y(); b.flat(n);
      b.gearLine(x0 + 40, y - 20, 5);
      if (b.r() < 0.45 + d * 0.05) b.enemy(b.r() < 0.6 ? 'beetle' : 'roller', x0 + n * T * 0.65, y, x0 + 16, x0 + n * T - 16);
    },
    hill: function (b) {
      var h = b.ri(1, 3); b.upG(h); var xm = b.X(); b.flat(b.ri(2, 4)); b.gearArc(xm - 8, b.X() + 8, b.Y() - 20, 18, 4); b.downG(h); b.flat(2);
    },
    valley: function (b) {
      var h = b.ri(3, 5); b.down45(h); var x0 = b.X(); b.flat(3); b.gearLine(x0 + 4, b.Y() - 20, 3, 16); b.up45(h); b.flat(3);
    },
    gap: function (b, d) {
      b.flat(4); var n = Math.min(6, 3 + b.ri(0, 1 + Math.floor(d / 3))), x0 = b.X(), y = b.Y();
      b.pit(n); b.gearArc(x0, b.X(), y - 30, 44, Math.max(3, n - 1));
      b.gy += b.ri(-1, 1); b.flat(5);
    },
    spikePit: function (b, d) {
      b.flat(4); var n = b.ri(3, 4 + Math.min(1, Math.floor(d / 4))), x0 = b.X(), y = b.Y(); b.spikes(n);
      b.gearArc(x0, b.X(), y - 30, 42, n); b.flat(4);
    },
    step: function (b, d) { b.flat(3); b.gy -= b.ri(1, 3); var x0 = b.X(); b.flat(6); if (d >= 2 && b.r() < 0.4) b.enemy('beetle', x0 + 60, b.Y(), x0 + 8, x0 + 88); },
    drop: function (b) { b.flat(2); b.gy += b.ri(2, 5); var x0 = b.X(); b.flat(5); b.gearLine(x0 + 8, b.Y() - 20, 3); },
    stairs: function (b) { for (var i = 0; i < 3; i++) { b.flat(3); b.gy -= b.ri(1, 2); } b.flat(4); b.gearLine(b.X(-4), b.Y() - 20, 3); },
    // пружина у высокой стены; наверху — капсула, спуск по склону
    springWall: function (b) {
      b.flat(3); var sx = b.X(2) + 8; b.spring(sx, b.Y()); b.flat(3);
      var h = b.ri(9, 11); b.gy -= h; var x0 = b.X(), y = b.Y(); b.flat(10);
      for (var i = 0; i < 4; i++) b.gear(sx, y + h * T - 70 - i * 44);
      b.cap(x0 + 80, y - 18, b.pick(WEAP.concat(BON))); b.gearLine(x0 + 110, y - 20, 3);
      b.down45(b.ri(6, 8)); b.flat(3);
    },
    // длинный спуск — разгон до 3-й скорости, внизу — стенка ящиков
    chute: function (b) {
      var n = b.ri(8, 12), x0 = b.X(), y = b.Y(); b.down45(n);
      for (var i = 1; i < n; i += 2) b.gear(x0 + i * T + 8, y + i * T - 18);
      b.flat(12); SEG.crates(b); b.flat(8); b.gearLine(b.X(-8), b.Y() - 20, 4);
    },
    // стенка ящиков 2–3 клетки: на 3-й скорости разбивается, иначе — перепрыгнуть
    crates: function (b) {
      b.flat(2); var h = b.ri(2, 3), n = b.ri(2, 3);
      for (var i = 0; i < n; i++) { b.ground(b.x + i, b.gy); for (var r = 1; r <= h; r++) b.set(b.x + i, b.gy - r, C.X); }
      b.gearLine(b.X() + 6, b.Y() - h * T - 18, n, 16); b.x += n; b.flat(4);
    },
    // рельс-скольжение над пропастью: въезд с земли, провис, вылет вверх
    rail: function (b, d) {
      b.flat(5); var X = b.X(), Y = b.Y(), n = b.ri(18, 26) + Math.min(6, d), sag = b.ri(3, 5) * T;
      var pts = [[X - 6, Y], [X + 5 * T, Y + sag], [X + (n - 6) * T, Y + sag], [X + n * T, Y - 2 * T]];
      b.o.rails.push({ id: b.uid++, pts: pts });
      for (var i = 2; i < n - 1; i += 3) { var gx = X + i * T; b.gear(gx, railY(pts, gx) - 20); }
      b.pit(n); b.flat(8);
      if (d >= 3 && b.r() < 0.5) b.enemy('wasp', X + n * T * 0.5, Y + sag - 70, X + 3 * T, X + (n - 3) * T);
    },
    // паровая шахта: провал в 3 клетки у высокой стены; поток пара выносит наверх
    shaft: function (b) {
      b.flat(4); var c0 = b.x, g = b.gy, h = b.ri(8, 12), deep = 7;
      for (var i = 0; i < 3; i++) b.ground(c0 + i, g + deep);
      b.o.steam.push({ id: b.uid++, x0: c0 * T, x1: (c0 + 3) * T, y0: (g - h - 4) * T, y1: (g + deep) * T });
      for (var k = 0; k < 4; k++) b.gear(c0 * T + 24, (g - k * 3) * T - 8);
      b.x += 3; b.gy = g - h; var x0 = b.X(); b.flat(9); b.gearLine(x0 + 30, b.Y() - 20, 4);
      if (b.r() < 0.5) b.cap(x0 + 110, b.Y() - 18, b.pick(BON)); b.down45(b.ri(4, 7)); b.flat(2);
    },
    // труба-ускоритель над широкой пропастью
    pipe: function (b) {
      b.flat(5); var mx = b.X(), y = b.Y(), gapN = b.ri(16, 22), up = b.ri(6, 8);
      b.pit(gapN); var ex = b.X(); b.gy += b.ri(-2, 2); var y2 = b.Y();
      b.o.pipes.push({ id: b.uid++, pts: [[mx, y - 10], [mx + 24, y - 34], [mx + 56, y - up * T], [ex - 56, y - up * T], [ex - 24, y2 - 20], [ex + 24, y2 - 12]] });
      b.flat(10); b.gearLine(ex + 50, y2 - 20, 4);
    },
    bridge: function (b, d) {
      b.flat(4); var x0 = b.X(), row = b.gy - 1;
      var pat = [2, 5, 3, 5, 3, 5, 2]; if (d >= 4) pat = [2, 4, 3, 4, 4, 4, 3, 4, 2];
      var c = b.x;
      for (var i = 0; i < pat.length; i++) { if (i % 2 === 1) { b.plat(c, row, pat[i]); b.gear(c * T + pat[i] * 8, row * T - 20); } c += pat[i]; }
      // под мостками — траншея (нижний путь, не пропасть): пол на 4 ниже, выход — две ступени
      var n = c - b.x;
      for (var k = 0; k < n; k++) b.ground(b.x + k, b.gy + (k >= n - 2 ? 2 : 4));
      b.gearLine(b.X(3), (b.gy + 4) * T - 18, Math.max(3, n - 6), 18);
      b.x = c;
      if (d >= 1) b.enemy('wasp', x0 + (c * T - x0) * 0.6, row * T - 60, x0, c * T);
      b.flat(5);
    },
    // верхний маршрут по мосткам (с пружины); в конце — будка с ложной стеной (тайник)
    upper: function (b, d, ctx) {
      b.flat(3); var sx = b.X(1) + 8; b.spring(sx, b.Y()); b.flat(2);
      var x0 = b.X(), y = b.Y(), row = b.gy - 10, len = 30, c = b.x;
      if (row < 10) row = 10;
      for (var i = 0; i < len; i += 6) { b.plat(c + i, row, 5); b.gearLine((c + i) * T + 10, row * T - 20, 3); }
      b.cap((c + 14) * T, row * T - 18, b.pick(['life', 'shield', 'turbo', 'magnet']));
      // будка над мостками: пол — мосток (впрыгнуть снизу), стенка слева — ложная
      var hc = c + 18, fr = row - 4;
      for (var q = 0; q < 5; q++) { b.set(hc + q, fr, C.P); b.set(hc + q, fr - 4, C.S); }
      for (var r = fr - 3; r < fr; r++) { b.set(hc, r, C.F); b.set(hc + 4, r, C.S); for (var q2 = 1; q2 < 4; q2++) b.set(hc + q2, r, C.H); }
      b.secret((hc + 2) * T + 8, fr * T - 10, ctx.token()); b.gearLine((hc + 1) * T + 6, fr * T - 30, 3, 16);
      b.flat(len + 8);
      b.enemy('beetle', x0 + 160, y, x0 + 32, x0 + 300); if (d >= 1) b.enemy('cannon', x0 + 420, y);
      b.gearLine(x0 + 220, y - 20, 4);
    },
    // уступ вниз; внутри уступа — тайная комната, вход — ложная стена со стороны нижнего уровня (надо вернуться)
    secretDrop: function (b, d, ctx) {
      b.flat(2); var c0 = b.x, g = b.gy; b.flat(9);
      var lo = g + 5;
      for (var i = 0; i < 9; i++) { for (var r = g + 2; r <= g + 4; r++) b.set(c0 + i, r, i < 2 ? C.S : C.H); }
      for (var r2 = g + 2; r2 <= g + 4; r2++) b.set(c0 + 8, r2, C.F);
      b.secret((c0 + 3) * T + 8, lo * T - 10, ctx.token());
      b.gearLine((c0 + 4) * T, lo * T - 18, 4, 18);
      b.cap((c0 + 6) * T, lo * T - 18, b.pick(['hp', 'life', 'gears']));
      b.gy = lo; b.flat(8); b.gearLine(b.X(-6), b.Y() - 20, 3);
    },
    enemyRun: function (b, d) {
      var n = 18, x0 = b.X(), y = b.Y(); b.flat(n);
      b.enemy('beetle', x0 + 120, y, x0 + 16, x0 + 200); b.enemy(d >= 3 ? 'roller' : 'beetle', x0 + 230, y, x0 + 160, x0 + n * T - 8);
      if (d >= 2) b.enemy('wasp', x0 + 180, y - 64, x0 + 80, x0 + 280);
      b.gearLine(x0 + 60, y - 20, 6);
    },
    cannonPost: function (b) { b.flat(4); b.gy -= 1; var x0 = b.X(); b.flat(3); b.enemy('cannon', x0 + 24, b.Y()); b.gy += 1; b.flat(8); },
    capRow: function (b) {
      var x0 = b.X(), y = b.Y(); b.flat(12);
      var ks = ['gears', b.pick(WEAP), b.pick(['hp', 'gears'].concat(BON))];
      for (var i = 0; i < 3; i++) b.cap(x0 + 40 + i * 56, y - 18, ks[i]);
    },
    ramp: function (b) {
      b.flat(5); b.up45(3); var x0 = b.X(), y = b.Y(); var n = b.ri(4, 6); b.pit(n); b.gy += 3;
      b.gearArc(x0, b.X(), y - 20, 40, 5); b.flat(6);
    }
  };
  var RAISE = { step: 1, stairs: 1, springWall: 1, shaft: 1 }, LOWER = { chute: 1, drop: 1, secretDrop: 1, valley: 1, rail: 1 };

  function railY(pts, x) {
    for (var i = 1; i < pts.length; i++) if (x <= pts[i][0] || i === pts.length - 1) {
      var a = pts[i - 1], c = pts[i], f = (x - a[0]) / (c[0] - a[0]); return a[1] + (c[1] - a[1]) * Math.max(0, Math.min(1, f));
    }
    return pts[0][1];
  }

  // список сегментов акта: обязательные + добор из пула; чекпойнты на 1/3 и 2/3
  function recipe(w, a, b) {
    var d = (w - 1) * 2 + (a - 1);
    var must = ['springWall', 'chute', 'rail', 'shaft', 'pipe', 'crates', 'upper', 'secretDrop', 'capRow', 'capRow', 'bridge', 'enemyRun'];
    if (w >= 2) must.push('rail', 'cannonPost');
    if (w >= 3) must.push('shaft', 'pipe');
    if (w >= 4) must.push('chute', 'rail');
    var pool = ['run', 'run', 'hill', 'hill', 'valley', 'gap', 'gap', 'spikePit', 'step', 'drop', 'stairs', 'enemyRun', 'cannonPost', 'ramp', 'crates', 'chute'];
    var n = 30 + d * 2 - (a === 2 ? 4 : 0), list = must.slice();
    while (list.length < n) list.push(b.pick(pool));
    for (var i = list.length - 1; i > 0; i--) { var j = Math.floor(b.r() * (i + 1)), t = list[i]; list[i] = list[j]; list[j] = t; }
    list.unshift('run', 'hill', 'run');
    list.splice(Math.round(list.length / 3), 0, 'cp'); list.splice(Math.round(list.length * 2 / 3), 0, 'cp');
    return list;
  }

  var BOSSES = ['fox', 'ram', 'cuckoo', 'armor'];
  var PAR = [0, 90, 120];   // «норматив» времени акта, с — от него бонус за скорость
  function build(w, a) {
    var b = new Builder(w * 1009 + a * 41 + 7, 1600), d = (w - 1) * 2 + (a - 1), tokenLeft = a === 1 ? 1 : 0, nSecret = 0;
    var ctx = { token: function () { nSecret++; if (tokenLeft && nSecret === 1) { tokenLeft = 0; return true; } return false; } };
    for (var c = 0; c < 2; c++) for (var r = 0; r < H; r++) b.set(c, r, C.S);
    b.x = 2; b.flat(14);
    var start = { x: 6 * T, y: b.Y() };
    recipe(w, a, b).forEach(function (name) {
      if (name === 'cp') { b.cp(); return; }
      if (b.gy < 26 && RAISE[name]) SEG.chute(b, d, ctx);       // слишком высоко — сначала спуск
      if (b.gy > 46 && LOWER[name]) SEG.stairs(b, d, ctx);      // слишком низко — сначала лесенка вверх
      if (b.gy > 46 && LOWER[name]) SEG.stairs(b, d, ctx);
      if (b.gy > 50 && (name === 'gap' || name === 'spikePit' || name === 'ramp')) name = 'step';
      if (b.gy < 22 && name === 'upper') name = 'drop';
      for (var q = 0; q < 3 && name === 'chute' && b.gy > 40; q++) SEG.stairs(b, d, ctx);
      SEG[name](b, d, ctx);
    });
    if (a === 2) {
      b.flat(4); b.cp(); b.flat(6);
      var ax0 = b.X(); b.flat(38); var ax1 = b.X();
      b.o.arena = { x0: ax0, x1: ax1, y: b.Y(), boss: BOSSES[w - 1] };
      b.o.goal = { x: ax1 - 64, y: b.Y(), hidden: true };
    } else {
      b.flat(10); b.o.goal = { x: b.X(), y: b.Y() }; b.flat(16);
    }
    return finish(b, { world: w, act: a, start: start, par: PAR[a] });
  }
  function finish(b, info) {
    for (var e = 0; e < 3; e++) for (var r2 = 0; r2 < H; r2++) b.set(b.x + e, r2, C.S);
    b.x += 3;
    var Wt = b.x, t = new Uint8Array(Wt * H);
    for (var rr = 0; rr < H; rr++) for (var cc = 0; cc < Wt; cc++) t[rr * Wt + cc] = b.t[rr * b.w + cc];
    var o = b.o;
    return Object.assign(info, { w: Wt, h: H, t: t, gears: o.gears, caps: o.caps, springs: o.springs, pipes: o.pipes, rails: o.rails,
      steam: o.steam, cps: o.cps, enemies: o.enemies, secrets: o.secrets, goal: o.goal, arena: o.arena });
  }

  // бонус-этап: короткая трасса туда-обратно, пружины и рельс; собрать NEED шестерней за TIME секунд
  var BONUS = { TIME: 40, NEED: 50 };
  function buildBonus(w) {
    var b = new Builder(5000 + w * 13, 400);
    for (var c = 0; c < 2; c++) for (var r = 0; r < H; r++) b.set(c, r, C.S);
    b.x = 2; b.gy = 40; b.flat(8); var start = { x: 5 * T, y: b.Y() };
    for (var k = 0; k < 5; k++) {
      var x0 = b.X(), y = b.Y(); b.flat(8); b.gearLine(x0 + 20, y - 20, 5);
      var sx = b.X(1) + 8; b.spring(sx, b.Y()); for (var q = 0; q < 4; q++) b.gear(sx, y - 70 - q * 44); b.flat(3);
      b.upG(2); var xm = b.X(); b.flat(4); b.gearArc(xm - 10, b.X() + 10, b.Y() - 20, 30, 5); b.downG(2);
      var gx = b.X(); b.flat(4); b.gearArc(gx, gx + 6 * T, b.Y() - 30, 50, 5); b.pit(4); b.flat(4);
    }
    b.flat(6);
    return finish(b, { world: w, act: 0, bonus: true, start: start, par: 0, goal: null, time: BONUS.TIME, need: BONUS.NEED });
  }

  SH.levels = { T: T, H: H, C: C, build: build, buildBonus: buildBonus, mulberry32: mulberry32, railY: railY, SEG: SEG, WORLDS: 4, ACTS: 2, PAR: PAR, BOSSES: BOSSES, BONUS: BONUS };
})(typeof window !== 'undefined' ? window : globalThis);
