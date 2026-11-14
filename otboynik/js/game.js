/* ОТБОЙНИК · логика без DOM: поле-пинбол, физика шара с подшагами, флипперы, заводные механизмы-враги волнами,
   здания-бамперы из карт, тилт, босс. Работает и в браузере, и в Node (тесты/бот).
   OB.Game(opts) → объект игры; opts: { seed, rng, onEvent(type,data), maxV, startWave, hp }.
   Координаты — логические пиксели поля 480×760, ось Y вниз. */
(function (global) {
  'use strict';
  var OB = global.OTBOYNIK = global.OTBOYNIK || {};

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- Константы поля ----------
  var W = 480, H = 760;
  var BR = 8;                 // радиус шара
  var GRAV = 720;             // уклон стола, px/с²
  var MAXV = 2100;            // потолок скорости шара
  var STEP_MAX = BR * 0.35;   // максимум смещения за подшаг (шар и конец флиппера) — шар не проскакивает стенки
  var FL_LEN = 70, FL_R = 7, FL_W_UP = 24, FL_W_DOWN = 15;
  var FLIP = {
    L: { x: 156, y: 654, rest: 0.55, up: -0.5 },
    R: { x: 324, y: 654, rest: Math.PI - 0.55, up: Math.PI + 0.5 }
  };
  var LANE_X = 440, OUT_X = 470, LANE_FLOOR = 742;
  var LAUNCH_POS = { x: 455, y: LANE_FLOOR - BR - 1 };
  var GATE = { x: 240, y: 728, w: 96 };          // ворота мастерской под флипперами
  var DRAIN_Y = 748;
  var ARC = { cx: 245, cy: 190, rx: 225, ry: 140 };
  var SLOTS = [{ x: 118, y: 268 }, { x: 240, y: 226 }, { x: 362, y: 268 }, { x: 128, y: 430 }, { x: 240, y: 392 }, { x: 352, y: 430 }];
  var WAVES = 10;             // обычных волн; затем — босс
  var HP0 = 20, HP_MAX = 30;

  var ENEMY = {
    beetle: { hp: 1, r: 11, speed: 34, dmg: 1, pts: 50 },
    cart: { hp: 2, r: 14, speed: 24, dmg: 2, pts: 100 },
    fly: { hp: 1, r: 10, speed: 40, dmg: 1, pts: 80, fly: true },
    ram: { hp: 4, r: 18, speed: 16, dmg: 4, pts: 250, heavy: true }
  };
  var BUILD = {
    forge: { r: 20, kick: 470 },     // горн: поджигает шар
    bell: { r: 20, kick: 430 },      // колокольня: звон оглушает механизмы рядом
    spring: { seg: true, kick: 380 },// пружинная стенка: отбивает шар с силой, перекрывает путь
    magnet: { r: 12, kick: 0 },      // магнит: тянет шар, вязнут механизмы
    splitter: { r: 18, kick: 420 }   // делитель: выпускает ещё шар (мульти-шар)
  };
  var BUILD_IDS = ['forge', 'bell', 'spring', 'magnet', 'splitter'];
  var MAX_LVL = 3;

  // ---------- Стены поля (отрезки) ----------
  function buildWalls() {
    var segs = [], pts = [], N = 28, i;
    for (i = 0; i <= N; i++) { var a = Math.PI + Math.PI * i / N; pts.push([ARC.cx + ARC.rx * Math.cos(a), ARC.cy + ARC.ry * Math.sin(a)]); }
    for (i = 0; i < N; i++) segs.push({ a: pts[i], b: pts[i + 1], e: 0.45, k: 'arc' });
    segs.push({ a: [20, 190], b: [20, 560], e: 0.45, k: 'wall' });
    segs.push({ a: [20, 560], b: [FLIP.L.x, FLIP.L.y - FL_R], e: 0.35, k: 'slope' });   // скат вливается в верх флиппера без ступеньки
    segs.push({ a: [OUT_X, 190], b: [OUT_X, LANE_FLOOR], e: 0.4, k: 'wall' });
    segs.push({ a: [LANE_X, 234], b: [LANE_X, LANE_FLOOR], e: 0.4, k: 'lane' });
    segs.push({ a: [LANE_X, 560], b: [FLIP.R.x, FLIP.R.y - FL_R], e: 0.35, k: 'slope' });
    segs.push({ a: [LANE_X, LANE_FLOOR], b: [OUT_X, LANE_FLOOR], e: 0.1, k: 'floor' });
    // односторонняя заслонка над дорожкой пуска: шар выходит вверх, а сверху скатывается в поле
    segs.push({ a: [LANE_X, 234], b: [OUT_X, 214], e: 0.3, k: 'gate', oneway: true });
    return segs;
  }
  var WALLS = buildWalls();

  // ---------- Состав волн ----------
  function waveList(n, rng) {
    var list = [], count = 4 + Math.round(n * 1.8), i;
    for (i = 0; i < count; i++) {
      var w = { beetle: 5, cart: n >= 2 ? 2 + n * 0.3 : 0, fly: n >= 3 ? 2 : 0, ram: n >= 4 ? 0.6 + n * 0.15 : 0 }, tot = 0, k;
      for (k in w) tot += w[k];
      var r = rng() * tot, type = 'beetle';
      for (k in w) { r -= w[k]; if (r <= 0) { type = k; break; } }
      list.push(type);
    }
    return { list: list, gap: Math.max(1.1, 2.6 - 0.13 * n), mul: 1 + 0.035 * (n - 1) };
  }

  // ---------- Геометрия ----------
  function closest(ax, ay, bx, by, px, py) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t; return [ax + dx * t, ay + dy * t, t];
  }
  function flipTip(f) { return [f.x + Math.cos(f.ang) * FL_LEN, f.y + Math.sin(f.ang) * FL_LEN]; }
  function springSeg(b) {
    var len = 54 + 10 * b.lvl, a = b.x < 200 ? 0.42 : b.x > 280 ? -0.42 : 0, c = Math.cos(a) * len / 2, s = Math.sin(a) * len / 2;
    return { seg: true, a: [b.x - c, b.y - s], b: [b.x + c, b.y + s] };
  }

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || mulberry32(opts.seed == null ? 1 : opts.seed);
    var emit = opts.onEvent || function () {};
    var S = {
      phase: 'cards', wave: opts.startWave || 1, hp: opts.hp || HP0, hpMax: HP_MAX, score: 0, t: 0,
      balls: [], enemies: [], buildings: [], boss: null,
      flip: { L: { x: FLIP.L.x, y: FLIP.L.y, rest: FLIP.L.rest, up: FLIP.L.up, ang: FLIP.L.rest, w: 0, on: false, swatCd: 0 },
              R: { x: FLIP.R.x, y: FLIP.R.y, rest: FLIP.R.rest, up: FLIP.R.up, ang: FLIP.R.rest, w: 0, on: false, swatCd: 0 } },
      flipLvl: 0, tiltMeter: 0, tiltLock: 0, offer: [], sel: 0, slotSel: 0, pending: null,
      queue: [], spawnT: 0, waveMul: 1, banner: 0, kills: 0, maxV: opts.maxV || MAXV, nextId: 1, waveReached: opts.startWave || 1, drains: 0
    };

    function serveBall() { S.balls.push({ x: LAUNCH_POS.x, y: LAUNCH_POS.y, vx: 0, vy: 0, fire: 0, still: 0, id: S.nextId++, trail: [] }); }
    function inLane(b) { return b.x > LANE_X && b.y > 600; }
    function waiting() { return S.balls.some(function (b) { return inLane(b) && Math.abs(b.vy) < 60 && b.y > LANE_FLOOR - 30; }); }
    function slotFree(i) { return !S.buildings.some(function (b) { return b.slot === i; }); }
    function freeSlots() { var r = []; for (var i = 0; i < SLOTS.length; i++) if (slotFree(i)) r.push(i); return r; }
    function owned(id) { for (var i = 0; i < S.buildings.length; i++) if (S.buildings[i].type === id) return S.buildings[i]; return null; }

    // ----- карты -----
    function offerCards() {
      var pool = [];
      BUILD_IDS.forEach(function (id) {
        var o = owned(id);
        if (!o && freeSlots().length) pool.push({ id: id, kind: 'build', lvl: 1, w: 3 });
        else if (o && o.lvl < MAX_LVL) pool.push({ id: id, kind: 'up', lvl: o.lvl + 1, w: 2 });
      });
      pool.push({ id: 'repair', kind: 'now', lvl: 1, w: S.hp < 12 ? 3 : 1 });
      if (S.flipLvl < 2) pool.push({ id: 'flip', kind: 'up', lvl: S.flipLvl + 1, w: 1 });
      var out = [];
      while (out.length < 3 && pool.length) {
        var tot = pool.reduce(function (a, c) { return a + c.w; }, 0), r = rng() * tot, i = 0;
        for (; i < pool.length - 1; i++) { r -= pool[i].w; if (r <= 0) break; }
        out.push(pool.splice(i, 1)[0]);
      }
      S.offer = out; S.sel = Math.min(1, out.length - 1); S.phase = 'cards';
    }
    function chooseCard(i) {
      if (S.phase !== 'cards') return false;
      var c = S.offer[i == null ? S.sel : i]; if (!c) return false;
      emit('card', { id: c.id, kind: c.kind, lvl: c.lvl });
      if (c.kind === 'build') { S.pending = c; S.phase = 'slot'; var fs = freeSlots(); S.slotSel = fs[0]; return true; }
      if (c.id === 'repair') S.hp = Math.min(S.hpMax, S.hp + 6);
      else if (c.id === 'flip') S.flipLvl++;
      else { var o = owned(c.id); if (o) { o.lvl++; if (BUILD[o.type].seg) Object.assign(o, springSeg(o)); } }
      beginWave(); return true;
    }
    function placeSlot(i) {
      if (S.phase !== 'slot') return false;
      if (i == null) i = S.slotSel;
      if (!slotFree(i)) return false;
      var c = S.pending, sp = SLOTS[i], b = { type: c.id, lvl: 1, slot: i, x: sp.x, y: sp.y, r: BUILD[c.id].r || 0, flash: 0, cd: 0, id: S.nextId++ };
      if (BUILD[c.id].seg) Object.assign(b, springSeg(b));
      S.buildings.push(b); S.pending = null; emit('place', { id: c.id, x: b.x, y: b.y });
      beginWave(); return true;
    }
    function moveSel(d) {
      if (S.phase === 'cards') { S.sel = (S.sel + d + S.offer.length) % S.offer.length; emit('sel', {}); }
      else if (S.phase === 'slot') { var fs = freeSlots(), k = fs.indexOf(S.slotSel); S.slotSel = fs[(k + d + fs.length) % fs.length]; emit('sel', {}); }
    }
    function confirm() { if (S.phase === 'cards') return chooseCard(); if (S.phase === 'slot') return placeSlot(); return false; }

    // ----- волны -----
    function beginWave() {
      S.phase = 'wave'; S.banner = 1.6; S.balls = []; serveBall(); S.tiltMeter = 0; S.tiltLock = 0;
      S.waveReached = Math.max(S.waveReached, S.wave);
      if (S.wave > WAVES) {
        S.queue = []; S.boss = { x: 240, y: 110, hp: 26, hpMax: 26, r: 36, t: 0, stun: 0, spawnT: 4, flash: 0, hitCd: 0, dead: false };
        emit('waveStart', { wave: S.wave, boss: true });
      } else {
        var spec = waveList(S.wave, rng); S.queue = spec.list; S.spawnT = 0.4; S.waveGap = spec.gap; S.waveMul = spec.mul;
        emit('waveStart', { wave: S.wave, n: spec.list.length });
      }
    }
    function spawn(type, x, y) {
      var T = ENEMY[type], e = { id: S.nextId++, type: type, x: x, y: y, hp: T.hp, hpMax: T.hp, r: T.r, t: rng() * 6, bx: x,
        tx: 60 + rng() * 300, stun: 0, burn: 0, burnT: 0, hitCd: 0, flash: 0, slow: 0, dead: false, mul: S.waveMul || 1 };
      S.enemies.push(e); return e;
    }
    function waveCleared() {
      var bonus = 200 * S.wave + S.hp * 20; S.score += bonus;
      emit('waveClear', { wave: S.wave, bonus: bonus });
      S.wave++; S.balls = []; S.enemies = [];
      offerCards();
    }

    // ----- урон -----
    function hurtEnemy(e, dmg, src) {
      if (e.dead) return;
      e.hp -= dmg; e.flash = 0.15;
      if (e.hp <= 0) {
        e.dead = true; S.kills++; S.score += ENEMY[e.type].pts; emit('kill', { x: e.x, y: e.y, type: e.type, src: src });
      } else emit('hit', { x: e.x, y: e.y, type: e.type });
    }
    function hurtGate(d, x) {
      S.hp -= d; emit('gate', { dmg: d, x: x == null ? GATE.x : x, y: GATE.y });
      if (S.hp <= 0 && S.phase === 'wave') { S.hp = 0; S.phase = 'over'; emit('gameover', { wave: S.wave, score: S.score }); }
    }
    function hurtBoss(dmg) {
      var B = S.boss; if (!B || B.dead) return;
      B.hp -= dmg; B.flash = 0.2; S.score += 30 * dmg; emit('bossHit', { x: B.x, y: B.y, hp: B.hp });
      if (B.hp <= 0) { B.dead = true; S.score += 5000 + S.hp * 50; emit('bossDie', { x: B.x, y: B.y }); S.phase = 'won'; emit('win', { score: S.score }); }
    }

    // ----- столкновения шара -----
    // отрезок с «толщиной» rad; e — упругость; kick — минимальная скорость отскока по нормали. → скорость удара или 0
    function hitSeg(b, ax, ay, bx, by, rad, e, kick, oneway) {
      var q = closest(ax, ay, bx, by, b.x, b.y), px = b.x - q[0], py = b.y - q[1], d2 = px * px + py * py, R = BR + rad;
      if (d2 >= R * R) return 0;
      var dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy), snx = -dy / L, sny = dx / L, nx, ny, d = Math.sqrt(d2);
      if (oneway) { // заслонка: нормаль «вверх»; работает только для шара над ней
        if (sny > 0) { snx = -snx; sny = -sny; }
        if ((b.x - ax) * snx + (b.y - ay) * sny <= 0) return 0;
      }
      if (d < 1e-6) { nx = snx; ny = sny; } else { nx = px / d; ny = py / d; }
      b.x = q[0] + nx * R; b.y = q[1] + ny * R;
      var vn = b.vx * nx + b.vy * ny, imp = 0;
      if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; imp = -vn; }
      if (kick) { var v2 = b.vx * nx + b.vy * ny; if (v2 < kick) { b.vx += (kick - v2) * nx; b.vy += (kick - v2) * ny; } imp = Math.max(imp, 1); }
      return imp;
    }
    function hitCircle(b, cx, cy, r, e, kick) {
      var px = b.x - cx, py = b.y - cy, d2 = px * px + py * py, R = BR + r;
      if (d2 >= R * R) return 0;
      var d = Math.sqrt(d2) || 1e-6, nx = px / d, ny = py / d;
      if (d2 < 1e-9) { nx = 0; ny = -1; }
      b.x = cx + nx * R; b.y = cy + ny * R;
      var vn = b.vx * nx + b.vy * ny, imp = Math.max(1, -vn);
      if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
      if (kick) { var v2 = b.vx * nx + b.vy * ny; if (v2 < kick) { b.vx += (kick - v2) * nx; b.vy += (kick - v2) * ny; } }
      return imp;
    }
    function hitFlip(b, f) {
      var c = Math.cos(f.ang), s = Math.sin(f.ang), ex = f.x + c * FL_LEN, ey = f.y + s * FL_LEN;
      var q = closest(f.x, f.y, ex, ey, b.x, b.y), px = b.x - q[0], py = b.y - q[1], d2 = px * px + py * py, R = BR + FL_R;
      if (d2 >= R * R) return 0;
      var d = Math.sqrt(d2), nx, ny;
      if (d < 1e-6) { nx = s; ny = -c; if (ny > 0) { nx = -nx; ny = -ny; } } else { nx = px / d; ny = py / d; }
      b.x = q[0] + nx * R; b.y = q[1] + ny * R;
      var rx = q[0] - f.x, ry = q[1] - f.y, vcx = -f.w * ry, vcy = f.w * rx;   // скорость точки контакта флиппера
      var rvx = b.vx - vcx, rvy = b.vy - vcy, vn = rvx * nx + rvy * ny;
      if (vn < 0) { var e = 0.32; rvx -= (1 + e) * vn * nx; rvy -= (1 + e) * vn * ny; b.vx = rvx + vcx; b.vy = rvy + vcy; return -vn; }
      return 0;
    }

    function onBuildingHit(B, b, imp) {
      if (B.cd > 0) return;
      B.flash = 0.25; B.cd = 0.08; S.score += 10;
      emit('bump', { type: B.type, x: B.x, y: B.y, lvl: B.lvl });
      if (B.type === 'forge') { b.fire = Math.max(b.fire, 3 + 1.5 * B.lvl); emit('ignite', { x: b.x, y: b.y }); }
      else if (B.type === 'bell') {
        if (B.ring > 0) return; B.ring = 0.9;
        var R = 80 + 30 * B.lvl, st = 1.2 + 0.5 * B.lvl;
        S.enemies.forEach(function (e) { if (!e.dead && Math.hypot(e.x - B.x, e.y - B.y) < R) { e.stun = Math.max(e.stun, st); if (B.lvl >= 3) hurtEnemy(e, 1, 'bell'); } });
        if (S.boss && !S.boss.dead && Math.hypot(S.boss.x - B.x, S.boss.y - B.y) < R + 30) S.boss.stun = Math.max(S.boss.stun, st * 0.6);
        emit('bell', { x: B.x, y: B.y, r: R });
      } else if (B.type === 'splitter') {
        var maxB = 1 + B.lvl;
        if (B.split > 0 || S.balls.length >= maxB) return;
        B.split = Math.max(2.5, 7 - 1.5 * B.lvl);
        var a = Math.atan2(b.vy, b.vx) + 0.7, sp = Math.max(420, Math.hypot(b.vx, b.vy)), nx = Math.cos(a), ny = Math.sin(a);
        S.balls.push({ x: B.x + nx * (B.r + BR + 2), y: B.y + ny * (B.r + BR + 2), vx: nx * sp, vy: ny * sp, fire: b.fire, still: 0, id: S.nextId++, trail: [] });
        emit('split', { x: B.x, y: B.y });
      }
    }

    function stepBall(b, h) {
      // магниты
      for (var m = 0; m < S.buildings.length; m++) {
        var M = S.buildings[m]; if (M.type !== 'magnet') continue;
        var dx = M.x - b.x, dy = M.y - b.y, d = Math.sqrt(dx * dx + dy * dy), R = 100 + 15 * M.lvl;
        if (d < R && d > 1) { var a = (520 + 140 * M.lvl) * (1 - d / R); b.vx += dx / d * a * h; b.vy += dy / d * a * h; }
      }
      b.vy += GRAV * h;
      b.x += b.vx * h; b.y += b.vy * h;
      var i, imp;
      for (i = 0; i < WALLS.length; i++) { var s = WALLS[i]; imp = hitSeg(b, s.a[0], s.a[1], s.b[0], s.b[1], 0, s.e, 0, s.oneway); if (imp > 160) b._wall = imp; }
      hitFlip(b, S.flip.L); hitFlip(b, S.flip.R);
      for (i = 0; i < S.buildings.length; i++) {
        var B = S.buildings[i], kick = BUILD[B.type].kick ? BUILD[B.type].kick + (B.type === 'spring' ? 120 * (B.lvl - 1) : 30 * (B.lvl - 1)) : 0;
        imp = B.seg ? hitSeg(b, B.a[0], B.a[1], B.b[0], B.b[1], 5, 0.5, kick) : hitCircle(b, B.x, B.y, B.r, 0.5, kick);
        if (imp) onBuildingHit(B, b, imp);
      }
      for (i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (e.dead) continue;
        var px = b.x - e.x, py = b.y - e.y, rr = BR + e.r;
        if (px * px + py * py >= rr * rr) continue;
        var rel = Math.hypot(b.vx, b.vy);
        hitCircle(b, e.x, e.y, e.r, 0.6, ENEMY[e.type].heavy ? 160 : 240);
        if (e.hitCd <= 0 && rel > 90) {
          e.hitCd = 0.15;
          var dmg = 1 + (b.fire > 0 ? 1 : 0);
          if (b.fire > 0) { e.burn = 2; e.burnT = 1; }
          if (!ENEMY[e.type].heavy) e.y -= 10;
          hurtEnemy(e, dmg, 'ball');
        }
      }
      var BS = S.boss;
      if (BS && !BS.dead && hitCircle(b, BS.x, BS.y, BS.r, 0.55, 300) && BS.hitCd <= 0) { BS.hitCd = 0.15; hurtBoss(1 + (b.fire > 0 ? 1 : 0)); }
      var v = Math.hypot(b.vx, b.vy); if (v > S.maxV) { b.vx *= S.maxV / v; b.vy *= S.maxV / v; }
    }

    function stepFlips(h) {
      var pw = 1 + 0.12 * S.flipLvl;
      ['L', 'R'].forEach(function (k) {
        var f = S.flip[k], on = f.on && S.tiltLock <= 0, target = on ? f.up : f.rest, sp = (on ? FL_W_UP * pw : FL_W_DOWN) * h;
        var d = target - f.ang, st = d > sp ? sp : d < -sp ? -sp : d;
        f.ang += st; f.w = st / h;
      });
    }

    // ----- физика кадра -----
    function physics(dt) {
      var vmax = 0, i;
      for (i = 0; i < S.balls.length; i++) vmax = Math.max(vmax, Math.hypot(S.balls[i].vx, S.balls[i].vy) + GRAV * dt);
      var pw = 1 + 0.12 * S.flipLvl, tip = Math.max(FL_W_UP * pw, FL_W_DOWN) * FL_LEN;   // флиппер может начать движение в любой подшаг
      var n = Math.ceil(Math.max(vmax, tip) * dt / STEP_MAX); if (n < 2) n = 2; if (n > 1200) n = 1200;
      var h = dt / n;
      for (var k = 0; k < n; k++) { stepFlips(h); for (i = 0; i < S.balls.length; i++) stepBall(S.balls[i], h); }
      S.substeps = n;
    }

    function updateEnemies(dt) {
      var arr = S.enemies, i;
      for (i = 0; i < arr.length; i++) {
        var e = arr[i]; if (e.dead) continue;
        var T = ENEMY[e.type];
        e.t += dt; e.hitCd -= dt; e.flash -= dt; e.slow = 0;
        if (e.burn > 0) { e.burn -= dt; e.burnT -= dt; if (e.burnT <= 0) { e.burnT = 1; hurtEnemy(e, 1, 'burn'); if (e.dead) continue; } }
        S.buildings.forEach(function (M) { if (M.type === 'magnet' && Math.hypot(M.x - e.x, M.y - e.y) < 100 + 15 * M.lvl) e.slow = 0.3 + 0.1 * M.lvl; });
        if (e.stun > 0) { e.stun -= dt; continue; }
        var sp = T.speed * e.mul * (1 - e.slow);
        if (T.fly) {
          e.y += sp * dt; var tx = (e.y > 520 ? GATE.x : e.bx) + Math.sin(e.t * 1.6) * (e.y > 520 ? 30 : 90);
          e.x += Math.max(-sp * 2, Math.min(sp * 2, (tx - e.x) * 2)) * dt;
        } else {
          e.y += sp * dt;
          if (e.det && e.det.t > 0) e.det.t -= dt;
          var detour = e.det && e.det.t > 0;
          var gx = detour ? e.det.x : e.y > 470 ? GATE.x : e.tx + Math.sin(e.t * 0.9) * 22;
          var mx = sp * (detour ? 1.2 : e.y > 470 ? 1.1 : 0.6);
          e.x += Math.max(-mx, Math.min(mx, (gx - e.x) * 1.5)) * dt;
          // обходят здания: упёрся — выбирает край постройки и идёт в обход (1.2 с)
          S.buildings.forEach(function (B) {
            if (B.seg) {
              var q = closest(B.a[0], B.a[1], B.b[0], B.b[1], e.x, e.y), dx = e.x - q[0], dy = e.y - q[1], d = Math.hypot(dx, dy), R = e.r + 6;
              if (d < R) {
                if (d < 1e-3) { dx = e.x < B.x ? -1 : 1; dy = 0; d = 1; }
                e.x = q[0] + dx / d * R; e.y = q[1] + dy / d * R;
                if (!detour) { var end = q[2] < 0.5 ? B.a : B.b, sg = end[0] < B.x ? -1 : 1; e.det = { x: end[0] + sg * (e.r + 12), t: 1.2 }; }
              }
            } else {
              var dx2 = e.x - B.x, dy2 = e.y - B.y, d2 = Math.hypot(dx2, dy2), R2 = e.r + B.r + 3;
              if (d2 < R2) {
                if (d2 < 1e-3) { dx2 = 1; dy2 = 0; d2 = 1; }
                e.x = B.x + dx2 / d2 * R2; e.y = B.y + dy2 / d2 * R2;
                if (!detour) e.det = { x: B.x + (dx2 < 0 ? -1 : 1) * (B.r + e.r + 8), t: 1.2 };
              }
            }
          });
        }
        e.x = Math.max(28 + e.r * 0.5, Math.min(LANE_X - 8 - e.r * 0.5, e.x));
        if (e.y >= GATE.y) { e.dead = true; e.gated = true; hurtGate(T.dmg, e.x); if (S.phase !== 'wave') return; }
      }
      S.enemies = arr.filter(function (q) { return !q.dead; });
      // удар флиппером по механизмам рядом
      ['L', 'R'].forEach(function (k) {
        var f = S.flip[k]; f.swatCd -= dt;
        if (Math.abs(f.w) < 6 || f.swatCd > 0 || (k === 'L' ? f.w > 0 : f.w < 0)) return;
        var t = flipTip(f);
        S.enemies.forEach(function (e) {
          var q = closest(f.x, f.y, t[0], t[1], e.x, e.y);
          if (Math.hypot(e.x - q[0], e.y - q[1]) < e.r + FL_R + 4) { hurtEnemy(e, 1, 'flip'); if (!ENEMY[e.type].heavy) e.y -= 40; f.swatCd = 0.25; }
        });
      });
      S.enemies = S.enemies.filter(function (q) { return !q.dead; });
    }

    function updateBoss(dt) {
      var B = S.boss; if (!B || B.dead) return;
      B.t += dt; B.flash -= dt; B.hitCd -= dt;
      var sl = B.stun > 0 ? 0.4 : 1; if (B.stun > 0) B.stun -= dt;
      B.x = 240 + Math.sin(B.t * 0.45) * 140;
      B.y += (B.y < 540 ? 5.5 : 11) * sl * dt;
      B.spawnT -= dt;
      if (B.spawnT <= 0) { B.spawnT = 5.5; spawn(rng() < 0.3 ? 'cart' : 'beetle', B.x + (rng() - 0.5) * 50, B.y + B.r); S.enemies[S.enemies.length - 1].mul = 1.25; emit('bossSpawn', { x: B.x, y: B.y }); }
      if (B.y >= GATE.y - 40) { B.y = GATE.y - 40; hurtGate(99, B.x); }
    }

    function update(dt) {
      if (S.phase !== 'wave') { S.t += dt; return; }
      S.t += dt;
      if (S.banner > 0) S.banner -= dt;
      if (S.tiltLock > 0) S.tiltLock -= dt;
      S.tiltMeter = Math.max(0, S.tiltMeter - dt / 2.5);
      S.buildings.forEach(function (B) { B.flash -= dt; B.cd -= dt; if (B.ring > 0) B.ring -= dt; if (B.split > 0) B.split -= dt; });
      physics(dt);
      if (S.phase !== 'wave') return;
      // шары: огонь, след, слив, застревание
      for (var i = S.balls.length - 1; i >= 0; i--) {
        var b = S.balls[i];
        if (b.fire > 0) b.fire -= dt;
        b.trail.push([b.x, b.y]); if (b.trail.length > 8) b.trail.shift();
        if (b._wall) { emit('wall', { v: b._wall }); b._wall = 0; }
        var lost = b.y > DRAIN_Y || b.y < -40 || b.x < -20 || b.x > W + 20;
        if (lost) {
          S.balls.splice(i, 1);
          if (!S.balls.length) { S.drains++; emit('drain', { x: b.x }); hurtGate(1, b.x); if (S.phase !== 'wave') return; serveBall(); }
          continue;
        }
        var spd = Math.hypot(b.vx, b.vy), cradle = Math.hypot(b.x - 240, b.y - 660) < 120 && (S.flip.L.on || S.flip.R.on);
        if (spd < 30 && !inLane(b)) { if (!cradle) b.still += dt; if (b.still > 3.5) { b.vx = (rng() - 0.5) * 300; b.vy = -380; b.still = 0; emit('nudge', {}); } }
        else b.still = 0;
      }
      // спавн
      if (S.banner <= 0 && S.queue.length) {
        S.spawnT -= dt;
        if (S.spawnT <= 0) { S.spawnT = S.waveGap; var type = S.queue.shift(), x = 70 + rng() * 330; spawn(type, x, 112); }
      }
      if (S.banner <= 0 || S.boss) updateEnemies(dt);
      if (S.phase !== 'wave') return;
      updateBoss(dt);
      if (S.phase !== 'wave') return;
      if (!S.boss && !S.queue.length && !S.enemies.length && S.banner <= 0) waveCleared();
    }

    // ----- управление -----
    function setFlip(side, on) { var f = S.flip[side]; if (!f) return; if (on && !f.on && S.phase === 'wave' && S.tiltLock <= 0) emit('flip', { side: side }); f.on = !!on; }
    function launch() {
      if (S.phase !== 'wave') return false;
      for (var i = 0; i < S.balls.length; i++) {
        var b = S.balls[i];
        if (inLane(b) && b.y > LANE_FLOOR - 30 && Math.abs(b.vy) < 60) { b.vy = -1180 - rng() * 80; b.vx = 0; emit('launch', {}); return true; }
      }
      return false;
    }
    function tilt() {
      if (S.phase !== 'wave' || S.tiltLock > 0) return false;
      S.tiltMeter += 1;
      S.balls.forEach(function (b) { if (!inLane(b)) { b.vx += (rng() - 0.5) * 240; b.vy -= 260; } });
      if (S.tiltMeter >= 3) { S.tiltLock = 3; S.tiltMeter = 0; emit('tiltLock', {}); }
      else emit('tilt', { n: Math.ceil(S.tiltMeter) });
      return true;
    }
    function start() { offerCards(); return api; }

    var api = {
      state: function () { return S; }, _S: S, start: start, update: update,
      setFlip: setFlip, launch: launch, tilt: tilt, chooseCard: chooseCard, placeSlot: placeSlot, moveSel: moveSel, confirm: confirm,
      waiting: waiting, freeSlots: freeSlots, owned: owned,
      _spawn: spawn, _serve: serveBall, _physics: physics, _hurtGate: hurtGate, _beginWave: beginWave, _offer: offerCards
    };
    return api;
  }

  OB.logic = {
    W: W, H: H, BR: BR, GRAV: GRAV, MAXV: MAXV, FL_LEN: FL_LEN, FL_R: FL_R, FLIP: FLIP, LANE_X: LANE_X, OUT_X: OUT_X, LANE_FLOOR: LANE_FLOOR,
    LAUNCH_POS: LAUNCH_POS, GATE: GATE, DRAIN_Y: DRAIN_Y, ARC: ARC, SLOTS: SLOTS, WAVES: WAVES, HP0: HP0, HP_MAX: HP_MAX, ENEMY: ENEMY,
    BUILD: BUILD, BUILD_IDS: BUILD_IDS, MAX_LVL: MAX_LVL, WALLS: WALLS, waveList: waveList, closest: closest, flipTip: flipTip,
    springSeg: springSeg, mulberry32: mulberry32, STEP_MAX: STEP_MAX
  };
  OB.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
