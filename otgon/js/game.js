/* ОТГОН · логика игры (чистая, без DOM и канвы — тестируется в Node).
   Вид сверху-сбоку: подпасок мастерской с посохом-фонарём ведёт стадо ветроногов — круглых шерстяных
   северных существ на тонких ходульных ногах с флюгерком-хохолком — через шесть участков гор к летнему пастбищу.
   Мир участка — коридор вдоль оси X между верхней стеной и нижней кромкой (стена или обрыв), высота 540, камера едет по X.
   Стадо — флокинг: держатся вместе, идут от подпаска (он подгоняет сзади), тянутся за соседями, к траве и воде,
   пугаются (птица, молния) и убегают, отбившиеся стоят и ждут свиста.
   API: OTGON.Game({ rng, onEvent, snapshot }) → { start(), state(), update(dt), setMove(dx,dy,run), moveTo(x,y),
        whistle(), staff(), snapshot(), nextLeg(), setMark(id, mark) } */
(function (global) {
  'use strict';
  var O = global.OTGON = global.OTGON || {};

  // ---------- Константы ----------
  var WH = 540, HERD = 10;
  var HERO_WALK = 66, HERO_RUN = 130, WALK = 43, TROT = 55, RUN = 90, BOLT = 120;
  var PRESS_R = 150, WHISTLE_R = 320, WHISTLE_T = 3.6, WHISTLE_CD = 1.4, STAFF_R = 240, STAFF_T = 4.5, STAFF_CD = 0.5;
  var SEP_R = 22, STRAY_D = 270, STRAY_HERO = 190;
  var FOOD_RATE = 1 / 250, PEP_RATE = 1 / 280, GRAZE = 1 / 24, DRINK = 1 / 18, IDLE_REST = 1 / 100;
  var CAMP_R = 80, CAMP_NEAR = 300, CAMP_FAR = 560, CAMP_DWELL = 1.6;
  // нравы по номеру существа: вожак, упрямцы, пугливые, обжора, копуша, обычные
  var TEMPERS = ['lead', 'plain', 'stubborn', 'timid', 'glutton', 'plain', 'dawdler', 'timid', 'stubborn', 'plain'];
  var MARKS = ['dot', 'ring', 'tri', 'square', 'diamond', 'cross', 'bar', 'moon', 'star', 'wave'];

  // ---------- Участки пути ----------
  // top/bot — кромки коридора (точки [x,y]); drops — участки нижней кромки-обрыва [x0,x1] (карниз);
  // isl — развилка: провал посреди пути {x0,x1,yt,yb}: верхняя ветка — узкий карниз над провалом (короче по времени, опаснее),
  //       нижняя — широкая, но вязкая (глубокий снег/топь: медленнее, безопаснее);
  // grass/water — круги [x,y,r]; rivers — {x,w,f0,f1}: брод только при y∈[f0,f1]; bliz/storm/birds — зоны [x0,x1];
  // cps — x чекпоинтов-туров; camp — костёр [x,y] (конец участка); tod — время суток от начала к концу (0 рассвет … 0.7 сумерки).
  var LEGS = [
    { id: 'meadow', len: 9000, ground: 'meadow', tod: [0.05, 0.6],
      top: [[0, 120], [1500, 140], [3000, 112], [4600, 128], [6200, 112], [7600, 135], [9000, 120]],
      bot: [[0, 480], [1400, 494], [3100, 470], [4700, 496], [6100, 500], [7700, 492], [9000, 480]],
      drops: [], isl: { x0: 5000, x1: 6800, yt: 186, yb: 322 },
      grass: [[1500, 380, 95], [3700, 250, 90], [6000, 430, 62], [7800, 300, 100]], water: [[2600, 410, 46], [7300, 210, 44]],
      rivers: [], bliz: null, storm: null, birds: null, cps: [2400, 4700, 7100], camp: [8740, 300] },
    { id: 'gorge', len: 9000, ground: 'rock', tod: [0.08, 0.62],
      top: [[0, 120], [1400, 130], [2300, 150], [2700, 232], [4200, 228], [4600, 140], [6200, 118], [7800, 132], [9000, 120]],
      bot: [[0, 480], [1500, 490], [2300, 440], [2700, 306], [4200, 304], [4600, 450], [6100, 492], [7700, 480], [9000, 480]],
      drops: [[2380, 4540]], isl: null,
      grass: [[1300, 300, 95], [5200, 360, 90], [8000, 300, 95]], water: [[1900, 400, 42], [6600, 220, 44]],
      rivers: [], bliz: null, storm: null, birds: [4800, 7600], cps: [2200, 4700, 7000], camp: [8740, 300] },
    { id: 'river', len: 9000, ground: 'valley', tod: [0.08, 0.62], rain: true,
      top: [[0, 120], [1500, 132], [3000, 118], [4400, 126], [6000, 112], [7600, 130], [9000, 120]],
      bot: [[0, 480], [1500, 492], [3100, 486], [4500, 500], [6100, 500], [7700, 490], [9000, 480]],
      drops: [], isl: { x0: 4300, x1: 6100, yt: 184, yb: 320 }, birdsUpper: true,
      grass: [[1400, 330, 95], [3600, 300, 85], [5200, 430, 60], [8100, 300, 95]], water: [],
      rivers: [{ x: 2500, w: 230, f0: 250, f1: 340 }, { x: 6900, w: 200, f0: 320, f1: 420 }],
      bliz: null, storm: null, birds: [4500, 5900], cps: [2100, 4100, 6500], camp: [8740, 300] },
    { id: 'pass', len: 9000, ground: 'snow', tod: [0.1, 0.64],
      top: [[0, 120], [1500, 136], [3000, 120], [4500, 140], [6000, 112], [7600, 128], [9000, 120]],
      bot: [[0, 480], [1500, 490], [3000, 476], [4500, 492], [6000, 500], [7700, 494], [9000, 480]],
      drops: [], isl: { x0: 6000, x1: 7700, yt: 184, yb: 320 },
      grass: [[1100, 320, 90], [2150, 300, 80], [3700, 330, 64], [5550, 330, 78], [8200, 300, 95]], water: [[1800, 400, 42], [5380, 210, 38], [8000, 200, 40]],
      rivers: [], bliz: [2400, 5000], storm: null, birds: null, cps: [2000, 3700, 5500, 7800], camp: [8740, 300] },
    { id: 'ridge', len: 9000, ground: 'ridge', tod: [0.2, 0.68],
      top: [[0, 120], [1500, 130], [3000, 150], [3400, 230], [4500, 226], [4900, 140], [6200, 118], [7800, 132], [9000, 120]],
      bot: [[0, 480], [1500, 490], [3000, 440], [3400, 306], [4500, 304], [4900, 450], [6100, 492], [7700, 480], [9000, 480]],
      drops: [[3080, 4840]], isl: null,
      grass: [[1100, 300, 95], [5400, 330, 90], [8200, 300, 95]], water: [[2200, 380, 42], [6000, 220, 42]],
      rivers: [], bliz: null, storm: [1800, 5900], birds: [6300, 8000], cps: [2800, 5000, 7000], camp: [8740, 300] },
    { id: 'descent', len: 9000, ground: 'summer', tod: [0.02, 0.3], last: true,
      top: [[0, 120], [1500, 130], [3000, 118], [5000, 150], [5400, 228], [6300, 226], [6700, 136], [7800, 112], [9000, 100]],
      bot: [[0, 480], [1500, 490], [3100, 486], [5000, 440], [5400, 304], [6300, 302], [6700, 460], [7700, 500], [9000, 506]],
      drops: [[5080, 6640]], isl: null,
      grass: [[1200, 320, 90], [4300, 300, 90], [7300, 300, 80], [8600, 300, 170]], water: [[3200, 400, 42], [8250, 170, 40]],
      rivers: [{ x: 1900, w: 220, f0: 260, f1: 350 }], bliz: null, storm: null, birds: [1500, 4900], cps: [2400, 5000, 6900], camp: [8640, 300] }
  ];

  // ---------- Геометрия ----------
  function interp(pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    for (var i = 1; i < pts.length; i++) if (x <= pts[i][0]) { var a = pts[i - 1], b = pts[i], k = (x - a[0]) / (b[0] - a[0]); k = k * k * (3 - 2 * k); return a[1] + (b[1] - a[1]) * k; }
    return pts[pts.length - 1][1];
  }
  function wob(x, s) { return 4 * Math.sin(x / 61 + s) + 2.5 * Math.sin(x / 23 + s * 2.1); }
  function topY(L, x) { return interp(L.top, x) + wob(x, 1.3); }
  function botY(L, x) { return interp(L.bot, x) - wob(x, 4.1); }
  function dropAt(L, x) { for (var i = 0; i < L.drops.length; i++) if (x >= L.drops[i][0] && x <= L.drops[i][1]) return true; return false; }
  // провал развилки: {t, b} — верхний и нижний край на данном x, либо null
  function islAt(L, x) {
    var I = L.isl; if (!I || x <= I.x0 || x >= I.x1) return null;
    var k = Math.min(1, (x - I.x0) / 220, (I.x1 - x) / 220); k = k * k * (3 - 2 * k);
    var m = (I.yt + I.yb) / 2; return { t: m - (m - I.yt) * k, b: m + (I.yb - m) * k, m: m };
  }
  function slowAt(L, x, y) { var a = islAt(L, x); return !!a && a.b - a.t > 30 && y > a.b; }
  function riverAt(L, x, pad) { for (var i = 0; i < L.rivers.length; i++) { var r = L.rivers[i]; if (x > r.x - (pad || 0) && x < r.x + r.w + (pad || 0)) return r; } return null; }
  function zoneK(z, x) { if (!z || x < z[0] || x > z[1]) return 0; return Math.min(1, (x - z[0]) / 260, (z[1] - x) / 260); }
  function inZone(z, x) { return !!z && x >= z[0] && x <= z[1]; }
  function len(x, y) { return Math.sqrt(x * x + y * y); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // безопасная середина пути на данном x (branch: 'up' — верхняя ветка развилки, иначе нижняя)
  function laneY(L, x, branch) {
    var t = topY(L, x), b = botY(L, x), a = islAt(L, x), r = riverAt(L, x, 90);
    if (a && a.b - a.t > 8) return branch === 'up' ? (t + a.t) / 2 - 4 : (a.b + b) / 2;
    if (r) return (r.f0 + r.f1) / 2;
    for (var i = 0; i < L.rivers.length; i++) {   // заранее выйти на линию брода
      var rv = L.rivers[i]; if (x > rv.x - 520 && x <= rv.x - 90) { var kr = clamp((x - (rv.x - 520)) / 330, 0, 1); kr = kr * kr * (3 - 2 * kr); return (t + b) / 2 * (1 - kr) + (rv.f0 + rv.f1) / 2 * kr; }
    }
    var I = L.isl;
    if (I && x > I.x0 - 700 && x <= I.x0 + 40) {   // заранее сместиться к выбранной ветке развилки
      var k = clamp((x - (I.x0 - 700)) / 420, 0, 1); k = k * k * (3 - 2 * k);
      return (t + b) / 2 * (1 - k) + (branch === 'up' ? (t + I.yt) / 2 - 4 : (I.yb + b) / 2) * k;
    }
    return (t + b) / 2;
  }
  function todAt(L, x) { return L.tod[0] + (L.tod[1] - L.tod[0]) * clamp(x / L.len, 0, 1); }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || mulberry32(1), emit = opts.onEvent || function () {};
    var S = null, mv = { x: 0, y: 0, run: false }, target = null;

    function creature(id, mark) {
      return { id: id, temper: TEMPERS[id % TEMPERS.length], mark: mark != null ? mark : id % MARKS.length, x: 0, y: 0, vx: 0, vy: 0,
        food: 0.9, pep: 0.9, fear: 0, fx: 0, fy: 0, bolt: 0, bx: 0, by: 0, callT: 0, cmdT: 0, cx: 1, cy: 0, cmdRun: false, calmT: 0,
        balk: 0, balkIn: 18 + rng() * 26, balked: {}, need: null, deepT: 0, st: 'ok', stray: false, graze: false, drink: false,
        ph: rng() * 6.28, nz: rng() * 6.28, face: 1 };
    }
    function L() { return LEGS[S.lv]; }
    function alive() { return S.herd.filter(function (c) { return c.st === 'ok'; }); }

    function place(x) {
      var l = L(), list = alive(), n = list.length;
      S.hero.x = x; S.hero.y = laneY(l, x); S.hero.fx = 1; S.hero.fy = 0; target = null;
      list.forEach(function (c, i) {
        var a = (i / Math.max(1, n)) * 6.28 + 0.4, r = 20 + (i % 3) * 15, cx = x + 78 + Math.cos(a) * r;
        c.x = cx; c.y = clamp(laneY(l, cx) + Math.sin(a) * r * 0.8, topY(l, cx) + 14, botY(l, cx) - 14);
        c.vx = c.vy = 0; c.fear = 0; c.bolt = 0; c.callT = 0; c.cmdT = 0; c.balk = 0; c.balked = {}; c.deepT = 0; c.stray = false;
      });
    }
    function setupLeg(lv, x) {
      S.lv = lv; S.phase = 'play'; S.bird = null; S.birdT = 6 + rng() * 5; S.strikes = []; S.strikeT = 5 + rng() * 4; S.flash = 0;
      S.campT = 0; S.campNear = 0; S.cpIdx = 0; S.legT = 0;
      var l = L(); x = x || 220;
      while (S.cpIdx < l.cps.length && l.cps[S.cpIdx] <= x + 1) S.cpIdx++;
      place(x);
    }
    function snap(x) {
      return { v: 1, lv: S.lv, x: Math.round(x != null ? x : S.hero.x), T: Math.round(S.T),
        herd: alive().map(function (c) { return { id: c.id, mark: c.mark, food: +Math.max(0.5, c.food).toFixed(3), pep: +Math.max(0.5, c.pep).toFixed(3) }; }),
        gone: S.gone.map(function (g) { return { id: g.id, why: g.why, lv: g.lv, mark: g.mark }; }) };
    }
    function init(sn) {
      S = { lv: 0, T: 0, t: 0, phase: 'play', total: HERD, hero: { x: 0, y: 0, fx: 1, fy: 0, mx: 0, my: 0, moving: false, run: false, wT: 0, sT: 0, wAnim: 0, sAnim: 0 },
        herd: [], gone: [], bird: null, strikes: [], cp: null, score: 0 };
      if (sn && sn.herd && sn.herd.length) {
        S.T = sn.T || 0;
        S.herd = sn.herd.map(function (h) { var c = creature(h.id, h.mark); c.food = h.food; c.pep = h.pep; return c; });
        S.gone = (sn.gone || []).map(function (g) { return { id: g.id, why: g.why, lv: g.lv, mark: g.mark }; });
        setupLeg(clamp(sn.lv | 0, 0, LEGS.length - 1), sn.x);
      } else {
        for (var i = 0; i < HERD; i++) S.herd.push(creature(i));
        setupLeg(0, 220);
      }
      S.cp = snap();
    }

    function lose(c, why) {
      if (c.st !== 'ok') return;
      c.st = 'gone'; S.gone.push({ id: c.id, why: why, lv: S.lv, mark: c.mark, x: c.x, y: c.y, t: S.t });
      emit('lost', { id: c.id, why: why, left: alive().length });
    }
    function centroid() {
      var x = 0, y = 0, n = 0, lead = null, list = alive();
      list.forEach(function (c) { if (!c.stray) { x += c.x; y += c.y; n++; } if (c.temper === 'lead') lead = c; });
      if (!n && list.length) { list.forEach(function (c) { c.stray = false; x += c.x; y += c.y; n++; }); }
      return n ? { x: x / n, y: y / n, n: n, lead: lead } : { x: S.hero.x, y: S.hero.y, n: 0, lead: null };
    }
    function nearest(list, c, maxD) {
      var best = null, bd = maxD;
      for (var i = 0; i < list.length; i++) { var d = len(list[i][0] - c.x, list[i][1] - c.y) - list[i][2]; if (d < bd) { bd = d; best = list[i]; } }
      return best;
    }

    // ---------- Подпасок ----------
    function stepHero(dt) {
      var h = S.hero, l = L(), dx = mv.x, dy = mv.y, run = mv.run;
      if (dx || dy) target = null;
      else if (target) { var tx = target.x - h.x, ty = target.y - h.y, td = len(tx, ty); if (td < 6) target = null; else { dx = tx / td; dy = ty / td; run = td > 260; } }
      var d = len(dx, dy);
      h.moving = d > 0.01; h.run = h.moving && !!run;
      if (h.moving) {
        dx /= d; dy /= d; h.mx = dx; h.my = dy; h.fx = dx; h.fy = dy;
        var sp = (h.run ? HERO_RUN : HERO_WALK) * Math.min(1, d);
        if (slowAt(l, h.x, h.y)) sp *= 0.74;
        var r = riverAt(l, h.x); if (r) sp *= (h.y >= r.f0 && h.y <= r.f1) ? 0.78 : 0.5;
        sp *= 1 - 0.25 * zoneK(l.bliz, h.x);
        h.x += dx * sp * dt; h.y += dy * sp * dt;
      } else { h.mx = h.my = 0; }
      h.x = clamp(h.x, 30, l.len - 30);
      var a = islAt(l, h.x);
      if (a && a.b - a.t > 4 && h.y > a.t - 8 && h.y < a.b + 8) h.y = h.y < a.m ? a.t - 8 : a.b + 8;
      h.y = clamp(h.y, topY(l, h.x) + 10, botY(l, h.x) - 10);
      h.wT = Math.max(0, h.wT - dt); h.sT = Math.max(0, h.sT - dt); h.wAnim = Math.max(0, h.wAnim - dt); h.sAnim = Math.max(0, h.sAnim - dt);
    }

    // ---------- Существо ----------
    function stepCreature(c, dt, l, cen, list) {
      var h = S.hero, dxh = c.x - h.x, dyh = c.y - h.y, dH = len(dxh, dyh) || 0.001;
      var bl = zoneK(l.bliz, c.x), i, o, dx, dy, d;
      var sx = 0, sy = 0, nvx = 0, nvy = 0, nn = 0;
      for (i = 0; i < list.length; i++) {
        o = list[i]; if (o === c) continue;
        dx = c.x - o.x; dy = c.y - o.y; d = len(dx, dy) || 0.01;
        if (d < SEP_R) { var k = (SEP_R - d) / SEP_R; sx += dx / d * k; sy += dy / d * k; }
        if (d < 100 && !o.stray) { nvx += o.vx; nvy += o.vy; nn++; }
      }
      var dc = len(c.x - cen.x, c.y - cen.y);
      c.stray = cen.n > 0 && dc > STRAY_D && dH > STRAY_HERO && c.callT <= 0 && c.bolt <= 0 && c.cmdT <= 0;

      var spd = len(c.vx, c.vy), moving = spd > 8, running = spd > 72;
      c.food = Math.max(0, c.food - FOOD_RATE * dt * (running ? 1.8 : moving ? 1 : 0.45));
      c.pep = Math.max(0, c.pep - PEP_RATE * dt * (running ? 2.4 : moving ? 1 : 0) * (1 + bl * 0.5));
      c.fear = Math.max(0, c.fear - dt * (c.calmT > 0 ? 0.7 : 0.1));
      c.callT -= dt; c.cmdT -= dt; c.calmT -= dt; c.balk -= dt; c.ph += dt * (moving ? 9 : 2);
      c.graze = c.drink = false;

      var dvx = 0, dvy = 0, sp, forced = false, edgeK = 1, flock = true;
      if (c.fear >= 0.7 && c.bolt <= 0) {
        var ax = c.x - c.fx, ay = c.y - c.fy, ad = len(ax, ay) || 1, an = Math.atan2(ay, ax) + (rng() - 0.5) * 0.9;
        c.bolt = (1.0 + c.fear * 1.1) * (c.temper === 'timid' ? 1.3 : 1); c.bx = Math.cos(an); c.by = Math.sin(an) * 0.8; c.fear = 0.45; c.cmdT = 0; c.callT = 0;
        emit('bolt', { id: c.id });
      }
      if (c.bolt > 0) { c.bolt -= dt; dvx = c.bx * BOLT; dvy = c.by * BOLT; forced = true; edgeK = 0.45; flock = false; }
      else if (c.stray) { c.nz += dt * 0.5; dvx = Math.cos(c.nz) * 5; dvy = Math.sin(c.nz) * 5; c.pep = Math.min(1, c.pep + IDLE_REST * dt); flock = false; }
      else if (c.cmdT > 0) { sp = c.cmdRun ? RUN : TROT; dvx = c.cx * sp; dvy = c.cy * sp; forced = c.cmdRun; edgeK = c.cmdRun ? 0.55 : 1; }
      else if (c.balk > 0) { /* упрямец встал */ }
      else if (c.callT > 0 && dH > 56) { sp = dH > 230 ? RUN : WALK; dvx = -dxh / dH * sp; dvy = -dyh / dH * sp; }
      else {
        var pressed = false, want = null;
        // голодный (или обжора) тянется к траве, даже когда его гонят
        if (c.food < 0.2 || (c.temper === 'glutton' && c.food < 0.72 && c.need !== 'water')) want = nearest(l.grass, c, 150);
        if (!want && h.moving && dH < PRESS_R * (1 - 0.3 * bl)) {
          var dot = (h.mx * dxh + h.my * dyh) / dH;
          if (dot > 0.15) {
            var px = 0.55 * h.mx + 0.45 * dxh / dH, py = 0.55 * h.my + 0.45 * dyh / dH, pd = len(px, py) || 1;
            sp = h.run ? RUN : (dH < 54 ? TROT : WALK); dvx = px / pd * sp; dvy = py / pd * sp; pressed = true; forced = h.run; edgeK = h.run ? 0.55 : 1;
            if (c.temper === 'timid' && h.run && dH < 40) { c.fear = Math.min(1, c.fear + dt * 0.5); c.fx = h.x; c.fy = h.y; }
          }
        }
        // стоит на траве голодным или у воды усталым и его не гонят — остаётся на привале, за соседями не тянется
        var here = null;
        if (!pressed && !want) {
          if (c.food < 0.94 || c.need === 'food') { here = nearest(l.grass, c, -8); }
          if (!here && (c.pep < 0.92 || c.need === 'water')) { here = nearest(l.water, c, 16); if (here) here = 'w'; }
        }
        if (!pressed && !want && !here && nn && bl < 0.5) { nvx /= nn; nvy /= nn; if (len(nvx, nvy) > 14) { dvx = nvx * 0.9; dvy = nvy * 0.9; pressed = true; } }
        if (pressed && c.temper === 'stubborn') { c.balkIn -= dt; if (c.balkIn <= 0) { c.balkIn = 24 + rng() * 28; c.balk = 3.2; emit('balk', { id: c.id }); } }
        if (!pressed) {
          // привал: трава и вода
          if (c.need === 'food' && c.food >= 0.985) c.need = null; else if (c.need === 'water' && c.pep >= 0.97) c.need = null;
          var g = null, w = null;
          if (want) { g = want; c.need = 'food'; }
          else {
            if (c.need !== 'water' && (c.food < 0.94 || c.need === 'food')) g = nearest(l.grass, c, 280);
            if (!g && c.need !== 'food' && (c.pep < 0.92 || c.need === 'water')) w = nearest(l.water, c, 280);
            if (!g && !w && c.need) { c.need = null; }
            if (g && !c.need && c.pep < c.food - 0.12) { var w2 = nearest(l.water, c, 280); if (w2 && nearest(l.grass, c, -8) !== g) { g = null; w = w2; } }
            c.need = g ? 'food' : w ? 'water' : null;
          }
          if (g) { d = len(g[0] - c.x, g[1] - c.y); if (d < g[2] - 8) { c.graze = true; c.food = Math.min(1, c.food + GRAZE * dt); } else { dvx = (g[0] - c.x) / d * WALK * 0.85; dvy = (g[1] - c.y) / d * WALK * 0.85; } }
          else if (w) { d = len(w[0] - c.x, w[1] - c.y); if (d < w[2] + 16) { c.drink = true; c.pep = Math.min(1, c.pep + DRINK * dt); } else { dvx = (w[0] - c.x) / d * WALK * 0.85; dvy = (w[1] - c.y) / d * WALK * 0.85; } }
          if (!moving) c.pep = Math.min(1, c.pep + IDLE_REST * dt);
        }
      }
      if (flock) {
        var tx = cen.x, ty = cen.y, ck = 1;
        if (cen.lead && cen.lead !== c && !cen.lead.stray) { tx = (tx + cen.lead.x) / 2; ty = (ty + cen.lead.y) / 2; } else if (!cen.lead) ck = 0.55;
        dx = tx - c.x; dy = ty - c.y; d = len(dx, dy);
        if (d > 46) { var pull = Math.min(34, (d - 46) * 0.4) * ck * (c.temper === 'timid' ? 1.3 : 1) * (1 + bl * 0.6); dvx += dx / d * pull; dvy += dy / d * pull; }
        if (dH < 20) { dvx += dxh / dH * 40; dvy += dyh / dH * 40; }
      }
      dvx += sx * 70; dvy += sy * 70;
      if (bl > 0 && c.bolt <= 0) {   // буран: сбивает с направления и сносит по ветру
        c.nz += dt * 0.6; var ra = Math.sin(c.nz + S.t * 0.4) * 0.75 * bl, cs = Math.cos(ra), sn = Math.sin(ra), rx = dvx * cs - dvy * sn; dvy = dvx * sn + dvy * cs; dvx = rx;
        dvx -= 5 * bl; dvy += 9 * bl;
      }
      // края: обрыв и провал — спокойное существо держится подальше
      var by = botY(l, c.x), a = islAt(l, c.x);
      if (dropAt(l, c.x)) { d = by - c.y; if (d < 36) dvy -= (36 - d) / 36 * 110 * edgeK; }
      if (a && a.b - a.t > 4 && c.y < a.m) { d = a.t - c.y; if (d < 34) dvy -= (34 - d) / 34 * 110 * edgeK; }
      // река: спокойное существо в глубину не идёт и тянется к броду
      var r = riverAt(l, c.x, 80), mult = 1;
      if (r) {
        var inFord = c.y >= r.f0 && c.y <= r.f1, inW = c.x > r.x && c.x < r.x + r.w;
        if (!forced) {
          if (c.y < r.f0 + 12) dvy = (inW ? Math.max(0, dvy) : dvy) + (inW ? 46 : 24); else if (c.y > r.f1 - 12) dvy = (inW ? Math.min(0, dvy) : dvy) - (inW ? 46 : 24);
          if (!inFord && !inW && c.x <= r.x && c.x > r.x - 18 && dvx > 0) dvx = 0;
          if (c.temper === 'stubborn' && !c.balked[r.x] && c.x > r.x - 34 && c.x < r.x && dvx > 0 && c.cmdT <= 0) { c.balked[r.x] = 1; c.balk = 3.6; emit('balk', { id: c.id }); }
        }
        if (inW) mult *= inFord ? 0.72 : 0.45;
      }
      if (slowAt(l, c.x, c.y)) mult *= 0.45;
      if (c.bolt <= 0) {
        if (c.food < 0.25) mult *= c.food <= 0.02 ? 0.5 : 0.75;
        if (c.pep < 0.25) mult *= c.pep <= 0.02 ? 0.5 : 0.75;
        if (c.temper === 'dawdler') mult *= 0.9; else if (c.temper === 'lead') mult *= 1.04;
      }
      var kk = Math.min(1, dt * 5);
      c.vx += (dvx * mult - c.vx) * kk; c.vy += (dvy * mult - c.vy) * kk;
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (Math.abs(c.vx) > 6) c.face = c.vx > 0 ? 1 : -1;
      // глубокая вода: течение сносит, долго — унесёт
      var rr = riverAt(l, c.x);
      if (rr && !forced && r === rr && c.wasFord) c.y = clamp(c.y, rr.f0 + 1, rr.f1 - 1);   // спокойное с брода не сходит
      c.wasFord = !!rr && c.y >= rr.f0 && c.y <= rr.f1;
      if (rr && (c.y < rr.f0 || c.y > rr.f1)) { c.y += 30 * dt; c.deepT += dt; if (c.deepT > 2.8) return lose(c, 'river'); } else c.deepT = Math.max(0, c.deepT - dt * 2);
      // столкновения с краями
      c.x = clamp(c.x, 16, l.len - 16);
      var t = topY(l, c.x) + 9; by = botY(l, c.x);
      if (c.y < t) { c.y = t; if (c.vy < 0) c.vy = 0; }
      if (dropAt(l, c.x)) { if (c.y > by + 3) return lose(c, 'fall'); }
      else if (c.y > by - 9) { c.y = by - 9; if (c.vy > 0) c.vy = 0; }
      a = islAt(l, c.x);
      if (a && a.b - a.t > 4 && c.y > a.t && c.y < a.b + 7) {
        if (c.y < a.m) { if (c.y > a.t + 4) return lose(c, 'fall'); }
        else { c.y = a.b + 7; if (c.vy < 0) c.vy = 0; }
      }
    }

    // ---------- Опасности ----------
    function stepBird(dt, l, cen, list) {
      var h = S.hero, b = S.bird;
      if (!b) {
        var zone = inZone(l.birds, cen.x) && list.length;
        if (zone && l.birdsUpper) { var a = islAt(l, cen.x); zone = !!a && cen.y < a.m; }
        if (!zone) return;
        S.birdT -= dt; if (S.birdT > 0) return;
        var tg = null, bd = -1;
        list.forEach(function (c) { var d = len(c.x - h.x, c.y - h.y) + (c.stray ? 200 : 0); if (d > bd) { bd = d; tg = c; } });
        S.bird = { ph: 'circle', t: 3.4, id: tg.id, x: tg.x - 220, y: tg.y - 170, a: rng() * 6.28, out: 0 };
        emit('bird', { id: tg.id }); return;
      }
      var tgt = null; list.forEach(function (c) { if (c.id === b.id) tgt = c; });
      if (!tgt && b.ph !== 'away') b.ph = 'away';
      if (b.ph === 'circle') {
        b.t -= dt; b.a += dt * 2.6;
        var gx = tgt.x + Math.cos(b.a) * 74, gy = tgt.y - 30 + Math.sin(b.a) * 40;
        b.x += (gx - b.x) * Math.min(1, dt * 3); b.y += (gy - b.y) * Math.min(1, dt * 3);
        if (len(h.x - tgt.x, h.y - tgt.y) < 90) { b.ph = 'away'; emit('shoo', { by: 'near' }); }
        else if (b.t <= 0) { b.ph = 'dive'; b.t = 0.75; emit('dive', { id: tgt.id }); }
      } else if (b.ph === 'dive') {
        b.t -= dt; b.x += (tgt.x - b.x) * Math.min(1, dt * 6); b.y += (tgt.y - b.y) * Math.min(1, dt * 6);
        if (len(h.x - tgt.x, h.y - tgt.y) < 78) { b.ph = 'away'; emit('shoo', { by: 'near' }); }
        else if (b.t <= 0) {
          tgt.fear = 1; tgt.fx = b.x - 20; tgt.fy = b.y - 30;
          list.forEach(function (c) { var d = len(c.x - tgt.x, c.y - tgt.y); if (c !== tgt && d < 90) { c.fear = Math.min(1, c.fear + (c.temper === 'timid' ? 0.75 : 0.42) * (c.calmT > 0 ? 0.4 : 1)); c.fx = tgt.x; c.fy = tgt.y; } });
          b.ph = 'away'; emit('swoop', { id: tgt.id });
        }
      } else { b.out += dt; b.x += dt * 190; b.y -= dt * 230; if (b.out > 1.6) { S.bird = null; S.birdT = 13 + rng() * 9; } }
    }
    function stepStorm(dt, l, cen, list) {
      S.flash = Math.max(0, S.flash - dt);
      if (inZone(l.storm, cen.x) && list.length) {
        S.strikeT -= dt;
        if (S.strikeT <= 0) {
          S.strikeT = 8 + rng() * 7;
          var x = cen.x + (rng() - 0.5) * 320, y = clamp(cen.y + (rng() - 0.5) * 200, topY(l, x) + 20, botY(l, x) - 20);
          S.strikes.push({ x: x, y: y, t: 1.7 }); emit('charge', {});
        }
      }
      for (var i = S.strikes.length - 1; i >= 0; i--) {
        var s = S.strikes[i]; s.t -= dt; if (s.t > 0) continue;
        S.strikes.splice(i, 1); S.flash = 0.45; S.lastStrike = { x: s.x, y: s.y }; emit('thunder', {});
        list.forEach(function (c) {
          var d = len(c.x - s.x, c.y - s.y); if (d > 170) return;
          c.fear = Math.min(1, c.fear + 0.95 * (1 - d / 170) * (c.temper === 'timid' ? 1.5 : 1) * (c.calmT > 0 ? 0.3 : 1)); c.fx = s.x; c.fy = s.y;
        });
      }
    }

    // ---------- Кадр ----------
    function update(dt) {
      if (S.phase !== 'play') return;
      if (dt > 0.05) dt = 0.05;
      S.t += dt; S.T += dt; S.legT += dt;
      var l = L(); stepHero(dt);
      var list = alive(), cen = centroid();
      for (var i = 0; i < list.length; i++) stepCreature(list[i], dt, l, cen, list);
      list = alive(); cen = centroid(); S.cen = cen;
      stepBird(dt, l, cen, list); stepStorm(dt, l, cen, list);
      if (!list.length) { S.phase = 'alone'; emit('alone', {}); return; }
      var h = S.hero, near = 0;
      list.forEach(function (c) { if (len(c.x - h.x, c.y - h.y) < 320) near++; });
      if (S.cpIdx < l.cps.length && h.x > l.cps[S.cpIdx] && near > 0) { S.cpIdx++; S.cp = snap(); emit('checkpoint', { save: S.cp }); }
      // костёр: подпасок у огня, стадо рядом → ночёвка (или финал); кто остался далеко — отстал
      var cx = l.camp[0], cy = l.camp[1]; S.campNear = 0;
      list.forEach(function (c) { if (len(c.x - cx, c.y - cy) < CAMP_NEAR) S.campNear++; });
      if (len(h.x - cx, h.y - cy) < CAMP_R && S.campNear > 0) S.campT += dt; else S.campT = 0;
      if (S.campT > CAMP_DWELL) {
        list.forEach(function (c) { if (len(c.x - cx, c.y - cy) > CAMP_FAR) lose(c, 'left'); });
        list = alive(); S.score = list.length * 100;
        if (l.last) { S.phase = 'won'; emit('win', { home: list.length, total: S.total, ids: list.map(function (c) { return c.id; }), time: S.T }); }
        else { S.phase = 'camp'; emit('camp', { lv: S.lv, n: list.length }); }
      }
    }
    function nextLeg() {
      if (S.phase !== 'camp') return false;
      alive().forEach(function (c) { c.pep = 1; c.food = Math.max(c.food, 0.7); });
      setupLeg(S.lv + 1, 220); S.cp = snap(); emit('leg', { lv: S.lv }); emit('checkpoint', { save: S.cp });
      return true;
    }
    function whistle() {
      var h = S.hero; if (S.phase !== 'play' || h.wT > 0) return false;
      h.wT = WHISTLE_CD; h.wAnim = 0.6;
      var R = WHISTLE_R * (1 - 0.45 * zoneK(L().bliz, h.x)), n = 0;
      alive().forEach(function (c) {
        var d = len(c.x - h.x, c.y - h.y); if (d > R) return;
        c.calmT = 4; c.fear = Math.max(0, c.fear - 0.7); if (c.bolt > 0 && d < R * 0.75) c.bolt = 0;
        if (c.balk <= 0) { c.callT = WHISTLE_T; c.cmdT = 0; n++; }
      });
      S.lastWhistleR = R; emit('whistle', { n: n }); return true;
    }
    function staff() {
      var h = S.hero; if (S.phase !== 'play' || h.sT > 0) return false;
      h.sT = STAFF_CD; h.sAnim = 0.4; var n = 0;
      alive().forEach(function (c) {
        if (len(c.x - h.x, c.y - h.y) > STAFF_R || c.bolt > 0) return;
        var bl = zoneK(L().bliz, c.x), a = Math.atan2(h.fy, h.fx) + (rng() - 0.5) * 1.0 * bl;
        c.cmdT = STAFF_T * (1 - 0.5 * bl); c.cx = Math.cos(a); c.cy = Math.sin(a); c.cmdRun = h.run; c.callT = 0; c.balk = 0; n++;
      });
      var b = S.bird;
      if (b && b.ph !== 'away' && len(b.x - h.x, b.y - h.y) < 200) { b.ph = 'away'; emit('shoo', { by: 'staff' }); }
      emit('staff', { n: n }); return true;
    }

    var api = {
      start: function () { init(opts.snapshot); return api; },
      state: function () { return S; }, update: update,
      setMove: function (dx, dy, run) { mv.x = dx || 0; mv.y = dy || 0; mv.run = !!run; },
      moveTo: function (x, y) { target = { x: x, y: y }; },
      whistle: whistle, staff: staff, nextLeg: nextLeg, snapshot: function () { return snap(); },
      setMark: function (id, mark) { S.herd.forEach(function (c) { if (c.id === id) c.mark = ((mark % MARKS.length) + MARKS.length) % MARKS.length; }); if (S.cp) S.cp.herd.forEach(function (hh) { if (hh.id === id) hh.mark = ((mark % MARKS.length) + MARKS.length) % MARKS.length; }); },
      alive: function () { return alive(); }, leg: function () { return L(); }
    };
    return api;
  }

  O.Game = Game;
  O.logic = { WH: WH, HERD: HERD, LEGS: LEGS, TEMPERS: TEMPERS, MARKS: MARKS, topY: topY, botY: botY, dropAt: dropAt, islAt: islAt, slowAt: slowAt, riverAt: riverAt,
    zoneK: zoneK, inZone: inZone, laneY: laneY, todAt: todAt, mulberry32: mulberry32,
    K: { HERO_WALK: HERO_WALK, HERO_RUN: HERO_RUN, WALK: WALK, TROT: TROT, RUN: RUN, PRESS_R: PRESS_R, WHISTLE_R: WHISTLE_R, WHISTLE_CD: WHISTLE_CD, STAFF_R: STAFF_R, STAFF_CD: STAFF_CD,
      STRAY_D: STRAY_D, CAMP_R: CAMP_R, CAMP_NEAR: CAMP_NEAR, CAMP_FAR: CAMP_FAR } };
})(typeof window !== 'undefined' ? window : globalThis);
