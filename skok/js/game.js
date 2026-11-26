/* СКОК · логика уровня (без DOM, детерминирована при заданном rng). SKOK.Game(opts), SKOK.logic.
   Главная механика (переделка 2026-11) — заводной ключ: удар ключом перед собой (X / J, тач ⚙, геймпад B)
     · заведённый враг → остановлен на 5 с: не ранит и служит опорой (остановленный пружинник — батут); второй удар — разобран (3 гайки);
     · лебёдка «W» → механизмы её куска работают 8 с: мост «b» выдвигается звено за звеном, пружинная плита «S» подбрасывает;
     · короб «x» → вскрыт (3 гайки); хозяин крепости уязвим только пока сам подзаводится (ключ крутится на спине).
   Касание заведённого врага ранит с любой стороны (прыжком врагов не сбить). 3 сердца на попытку, 5 запасных пружин (жизней).
   Физика героя — L.heroStep(W, P, inp, dt, ev): одна функция и для игры, и для графа проходимости в тестах
   (W = { LV, plats }). Координаты — пиксели мира; P.x — центр, P.y — подошвы. Клетка 16 px. */
(function (global) {
  'use strict';
  var SK = global.SKOK = global.SKOK || {};
  var T = 16;
  var K = {
    HW: 5, HH: 20,
    G: 1400, FALL: 480, CUT: -150,
    RUN: 135, ACC: 950, DEC: 1100, TURN: 1900, AIR: 700, DRAG: 140,
    JUMP: 430, SPRING: 640, COYOTE: 0.08, BUFFER: 0.12, STEP: 7,
    REACH: 24, KEY_T: 0.18, KEY_CD: 0.3, STOP: 5, WIND: 8, EXT: 0.05,
    LIVES: 5, HEARTS: 3, INV: 1.5
  };
  var PTS = { nut: 10, crate: 20, stop: 50, dismantle: 100, finish: 1000, allNuts: 1000, noHit: 500, boss: 3000, time: 10, heartFull: 200 };

  // ---------- клетки ----------
  function tileAt(LV, tx, ty) { if (tx < 0 || tx >= LV.w) return '#'; if (ty < 0 || ty >= LV.h) return '.'; return LV.t[ty].charAt(tx); }
  function setTile(LV, tx, ty, ch, quiet) { var s = LV.t[ty]; LV.t[ty] = s.slice(0, tx) + ch + s.slice(tx + 1); if (!quiet) LV.rev = (LV.rev | 0) + 1; }
  var SOLID = { '#': 1, '=': 1, '^': 1, x: 1, S: 1, Q: 1 };
  function isSolid(ch) { return SOLID[ch] === 1; }
  function isBoard(ch) { return ch === 'T' || ch === 'Y'; }
  function isSlope(ch) { return ch === '/' || ch === '\\'; }
  function tilePx(LV, x, y) { return tileAt(LV, Math.floor(x / T), Math.floor(y / T)); }
  function slopeS(ch, tx, ty, x) { var xl = Math.max(0, Math.min(T, x - tx * T)); return ch === '/' ? (ty + 1) * T - xl : ty * T + xl; }
  function slopeAt(LV, x, y, up, down) {
    var tx = Math.floor(x / T), best = null;
    for (var ty = Math.floor((y - up) / T); ty <= Math.floor((y + down) / T); ty++) {
      var ch = tileAt(LV, tx, ty);
      if (isSlope(ch)) { var s = slopeS(ch, tx, ty, x); if (s >= y - up - 0.001 && s <= y + down + 0.001 && (!best || s < best.s)) best = { s: s, ch: ch, ty: ty }; }
    }
    return best;
  }
  function hwOf(P) { return P.hw || K.HW; }
  function heightOf(P) { return P.h || K.HH; }
  function footCh(LV, P, ty) {
    var hw = hwOf(P), xs = [P.x, P.x - hw + 0.5, P.x + hw - 0.5], best = 0;
    for (var i = 0; i < 3; i++) { var ch = tileAt(LV, Math.floor(xs[i] / T), ty); if (isSolid(ch) || isBoard(ch)) { if (i === 0) return ch; if (!best) best = ch; } }
    return best;
  }
  function support(LV, P) {
    var ty = Math.round(P.y / T);
    if (Math.abs(P.y - ty * T) < 0.05) { var ch = footCh(LV, P, ty); if (ch) return { ch: ch, slope: 0 }; }
    var s = slopeAt(LV, P.x, P.y, 0.6, 0.6);
    if (s) return { ch: s.ch, slope: s.ch === '/' ? -1 : 1 };
    return null;
  }
  // опоры-остановленные враги: { x, top, hw, spring }
  function platAt(W, P, tol) {
    var pl = W.plats; if (!pl) return null;
    for (var i = 0; i < pl.length; i++) { var q = pl[i]; if (Math.abs(P.y - q.top) < (tol || 0.6) && Math.abs(P.x - q.x) < q.hw + hwOf(P) - 1) return q; }
    return null;
  }
  function canStand(LV, P) {
    var hw = hwOf(P), y = P.y - K.HH + 0.5;
    return !isSolid(tileAt(LV, Math.floor((P.x - hw + 0.5) / T), Math.floor(y / T))) && !isSolid(tileAt(LV, Math.floor((P.x + hw - 0.5) / T), Math.floor(y / T)));
  }
  function newHero(x, y) { return { x: x, y: y, vx: 0, vy: 0, ground: true, face: 1, coyote: 0, buf: 0, jprev: false, cut: false, inv: 0, under: null, plat: null, py: y, wall: 0, bonk: null }; }

  // ---------- движение тела ----------
  function moveX(LV, P, dx) {
    if (!dx) return;
    var hw = hwOf(P), h = heightOf(P), x1 = P.x + dx, s = dx > 0 ? 1 : -1;
    var fx = x1 + s * hw, tx = Math.floor((s > 0 ? fx - 0.001 : fx) / T);
    var bottom = P.y - (P.ground ? K.STEP : 0.5);
    for (var y = P.y - h + 0.5; ; y += T) {
      var yy = Math.min(y, bottom);
      if (isSolid(tileAt(LV, tx, Math.floor(yy / T)))) { P.x = s > 0 ? tx * T - hw : (tx + 1) * T + hw; P.vx = 0; P.wall = s; return; }
      if (yy >= bottom) break;
    }
    P.x = x1;
  }
  function moveY(LV, P, dy) {
    if (!dy) return false;
    var h = heightOf(P), hw = hwOf(P), y0 = P.y, y1 = y0 + dy, xs = [P.x - hw + 0.5, P.x + hw - 0.5], i, tx;
    if (dy > 0) {
      var r0 = Math.ceil(y0 / T - 0.001), r1 = Math.floor(y1 / T);
      for (var ty = r0; ty <= r1; ty++) for (i = 0; i < 2; i++) { tx = Math.floor(xs[i] / T); var ch = tileAt(LV, tx, ty); if (isSolid(ch) || isBoard(ch)) { P.y = ty * T; P.vy = 0; return true; } }
      P.y = y1; return false;
    }
    var hr = Math.floor((y1 - h) / T);
    if (hr <= Math.floor((y0 - h) / T)) {
      var hit = null, cx = Math.floor(P.x / T);
      for (i = 0; i < 2; i++) { tx = Math.floor(xs[i] / T); if (isSolid(tileAt(LV, tx, hr)) && (y1 - h) < (hr + 1) * T) { if (!hit || tx === cx) hit = { tx: tx, ty: hr }; } }
      if (hit) { P.y = (hr + 1) * T + h; P.vy = 0; P.bonk = hit; return false; }
    }
    P.y = y1; return false;
  }
  function settle(LV, P, wasGround) {
    if (P.vy < 0) return false;
    var sl = slopeAt(LV, P.x, P.y, wasGround ? K.STEP + 1 : 6, wasGround ? 8 : 0);
    if (sl) { P.y = sl.s; P.vy = 0; return true; }
    if (!wasGround) return false;
    var ty = Math.floor((P.y - 0.01) / T), d = P.y - ty * T;
    if (d > 0.01 && d <= K.STEP && footCh(LV, P, ty)) { P.y = ty * T; P.vy = 0; return true; }
    var ty2 = Math.ceil(P.y / T - 0.001), d2 = ty2 * T - P.y;
    if (d2 > 0.01 && d2 <= 4 && footCh(LV, P, ty2)) { P.y = ty2 * T; P.vy = 0; return true; }
    return false;
  }

  // ---------- физика героя ----------
  // inp: { dx, jump } (jump — кнопка зажата); ev(type, data) — события (или null)
  function heroStep(W, P, inp, dt, ev) {
    var LV = W.LV, dx = inp.dx | 0, jp = !!inp.jump && !P.jprev;
    P.jprev = !!inp.jump; P.wall = 0; P.bonk = null; P.landed = false; P.py = P.y;
    if (jp) P.buf = K.BUFFER; else if (P.buf > 0) P.buf -= dt;
    var sp = support(LV, P), pl = null;
    if (!sp && P.vy >= 0) { pl = platAt(W, P); if (pl) { P.y = pl.top; sp = { ch: '_', slope: 0, plat: pl }; } }
    P.ground = !!sp && P.vy >= 0;
    P.under = P.ground ? sp.ch : null; P.plat = P.ground ? (sp.plat || null) : null;
    if (P.ground) P.coyote = K.COYOTE; else if (P.coyote > 0) P.coyote -= dt;
    if (dx) P.face = dx;
    // заведённая пружинная плита / остановленный пружинник — подбрасывают
    if (P.ground && (P.under === 'Q' || (P.plat && P.plat.spring))) {
      P.vy = -K.SPRING; P.ground = false; P.coyote = 0; P.cut = false; P.buf = 0;
      if (ev) ev('boing', { x: P.x, y: P.y, big: true });
    }
    // прыжок (высота — от удержания)
    if (P.buf > 0 && (P.ground || P.coyote > 0) && canStand(LV, P)) {
      P.vy = -K.JUMP; P.ground = false; P.coyote = 0; P.buf = 0; P.cut = true;
      if (ev) ev('jump', { x: P.x, y: P.y });
    }
    if (!inp.jump && P.cut && P.vy < K.CUT) P.vy = K.CUT;
    if (P.vy >= 0) P.cut = false;
    // горизонталь
    if (P.ground) {
      if (dx) { if (P.vx * dx < 0) P.vx += dx * K.TURN * dt; else { P.vx += dx * K.ACC * dt; if (Math.abs(P.vx) > K.RUN) P.vx = dx * K.RUN; } }
      else { var sv = P.vx > 0 ? 1 : -1; P.vx -= sv * K.DEC * dt; if (P.vx * sv < 0) P.vx = 0; }
    } else {
      if (dx) { P.vx += dx * K.AIR * dt; if (Math.abs(P.vx) > K.RUN) P.vx = (P.vx > 0 ? 1 : -1) * K.RUN; }
      else { var sa = P.vx > 0 ? 1 : -1; P.vx -= sa * K.DRAG * dt; if (P.vx * sa < 0) P.vx = 0; }
    }
    // вертикаль
    if (!P.ground) { P.vy += K.G * dt; if (P.vy > K.FALL) P.vy = K.FALL; } else P.vy = 0;
    var wasGround = P.ground, vyIn = P.vy, landed = false;
    var n = Math.max(1, Math.ceil(Math.max(Math.abs(P.vx), Math.abs(P.vy)) * dt / 4));
    for (var k = 0; k < n; k++) {
      var y0 = P.y;
      moveX(LV, P, P.vx * dt / n);
      if (moveY(LV, P, P.vy * dt / n)) landed = true;
      if (P.vy >= 0 && settle(LV, P, wasGround)) landed = true;
      if (P.vy >= 0 && W.plats && !landed) {
        for (var i = 0; i < W.plats.length; i++) { var q = W.plats[i]; if (y0 <= q.top + 0.01 && P.y >= q.top && Math.abs(P.x - q.x) < q.hw + hwOf(P) - 1) { P.y = q.top; P.vy = 0; landed = true; break; } }
      }
    }
    if (landed && !wasGround) { P.landed = true; if (ev) ev('land', { v: vyIn, x: P.x, y: P.y }); }
    return P;
  }
  function hazard(LV, P) {
    if (P.y > LV.h * T + 24) return 'fall';
    if (tilePx(LV, P.x, P.y - 3) === '~') return 'tar';
    if (P.ground && P.under === '^') return 'spike';
    return null;
  }
  // клетки механизмов уровня в заведённом виде (для графа проходимости: мосты выдвинуты, плиты подбрасывают)
  function woundCopy(LV) {
    var c = Object.assign({}, LV, { t: LV.t.slice() });
    LV.groups.forEach(function (gr) { gr.tiles.forEach(function (q) { setTile(c, q.tx, q.ty, q.k === 'b' ? 'Y' : 'Q', true); }); });
    return c;
  }

  // ---------- игра ----------
  var EDEF = { g: { hw: 6, h: 12, v: 34 }, m: { hw: 6, h: 9, v: 28 }, h: { hw: 5, h: 14, v: 0 }, n: { hw: 7, h: 10, v: 22 }, v: { hw: 7, h: 10, v: 0 }, P: { hw: 8, h: 16, v: 0 }, Z: { hw: 12, h: 28, v: 0 } };
  var BOSSDEF = { rust: { hp: 3, sp: 46, leap: 2.2, shots: 0, wind: 2.0 }, boiler: { hp: 3, sp: 52, leap: 2.4, shots: 2, wind: 1.9 }, vane: { hp: 4, sp: 58, leap: 2.0, shots: 1, wind: 1.8 }, pendulum: { hp: 4, sp: 62, leap: 2.0, shots: 2, wind: 1.8 } };
  var STOPPABLE = { g: 1, m: 1, h: 1, n: 1, v: 1 };
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function overlap(ax, ay, aw, ah, bx, by, bw, bh) { return Math.abs(ax - bx) < aw + bw && ay - ah < by && by - bh < ay; }

  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, emit = opts.onEvent || function () {}, god = !!opts.god;
    var S = { score: 0, lives: K.LIVES, hearts: K.HEARTS, nuts: 0, nutsGot: 0, opened: 0, hits: 0, phase: 'idle', phaseT: 0, time: 0, id: null, LV: null, W: null, hero: null,
      enemies: [], got: {}, bolts: [], cp: null, boss: null, kills: 0, stops: 0, deaths: 0, key: { t: 0, cd: 0 }, ring: null, clearT: 0, clearSent: false };
    var inp = { dx: 0, jump: false };
    function ev(t, d) { emit(t, d || {}); }
    function addScore(n) { S.score += n; }
    function addNuts(n) { S.nuts += n; addScore(PTS.nut * n); }

    function makeEnemies() {
      var LV = S.LV; S.boss = null;
      S.enemies = LV.enemies.map(function (e, i) {
        var D = EDEF[e.k], x = e.tx * T + 8, y = (e.ty + 1) * T;
        var o = { id: i, k: e.k, x: x, y: y, x0: x, y0: y, vx: -D.v, vy: 0, dir: -1, hw: D.hw, h: D.h, alive: true, awake: false, t: rng() * 2, st: 'walk', stT: 0, ground: false, dead: 0, stop: 0 };
        if (e.k === 'P') { o.top = e.ty * T; var ty = e.ty + 1; while (ty < LV.h && !isSolid(tileAt(LV, e.tx, ty))) ty++; o.bottom = ty * T; o.y = o.top + 16; o.st = 'up'; o.stT = rng() * 1.2; }
        if (e.k === 'Z') { var B = BOSSDEF[LV.boss]; o.hp = B.hp; o.hpMax = B.hp; o.B = B; o.st = 'sleep'; o.inv = 0; S.boss = o; }
        return o;
      });
    }
    function retractAll() {
      var LV = S.LV;
      LV.groups.forEach(function (gr) { gr.t = 0; gr.ext = 0; gr.acc = 0; gr.tiles.forEach(function (q) { setTile(LV, q.tx, q.ty, q.k, true); }); });
    }
    function startLevel(id, carry) {
      carry = carry || {};
      S.lives = carry.lives != null ? carry.lives : K.LIVES;
      var LV = SK.levels.build(id);
      S.id = id; S.LV = LV; S.W = { LV: LV, plats: [] };
      S.got = {}; S.bolts = []; S.ring = null; S.clearT = 0; S.clearSent = false; S.score = 0; S.nuts = 0; S.nutsGot = 0; S.opened = 0; S.hits = 0;
      S.kills = 0; S.stops = 0; S.deaths = 0; S.time = 0;
      S.cp = { x: LV.start.tx * T + 8, y: (LV.start.ty + 1) * T };
      makeEnemies();
      spawnHero();
      S.phase = 'play'; S.phaseT = 0;
      ev('level', { id: id, boss: LV.boss });
    }
    function spawnHero() { var P = newHero(S.cp.x, S.cp.y); P.inv = 1.0; S.hero = P; S.hearts = K.HEARTS; S.key = { t: 0, cd: 0 }; }
    function respawn() { retractAll(); S.bolts = []; makeEnemies(); spawnHero(); S.phase = 'play'; S.phaseT = 0; ev('respawn', {}); }
    function hurt(why, fromX) {
      var P = S.hero;
      if (god || P.inv > 0 || S.phase !== 'play') return;
      S.hearts--; S.hits++;
      if (S.hearts <= 0) { die(why); return; }
      P.inv = K.INV; P.vy = Math.min(P.vy, -220); P.ground = false; if (fromX != null) P.vx = (P.x < fromX ? -1 : 1) * 110;
      ev('hurt', { why: why, x: P.x, y: P.y, hearts: S.hearts });
    }
    function die(why) {
      if (S.phase !== 'play') return;
      var P = S.hero;
      if (god && why !== 'fall' && why !== 'tar') return;
      S.phase = 'dead'; S.phaseT = 0; S.lives--; S.deaths++; S.hearts = 0; S.hits++;
      ev('die', { why: why, x: P.x, y: Math.min(P.y, S.LV.h * T) });
    }
    function kill(e, how, pts) {
      if (!e.alive) return;
      e.alive = false; e.dead = 0.7; e.how = how; S.kills++;
      addScore(pts); ev('kill', { k: e.k, how: how, pts: pts, x: e.x, y: e.y - e.h / 2 });
    }

    // ---- ключ ----
    function wind(gr) {
      var fresh = !(gr.t > 0);
      gr.t = K.WIND; if (fresh) { gr.ext = 0; gr.acc = 0; }
      gr.tiles.forEach(function (q) { if (q.k === 'S') setTile(S.LV, q.tx, q.ty, 'Q', true); });
      ev('wind', { x: gr.winch.tx * T + 8, y: (gr.winch.ty + 1) * T, fresh: fresh });
    }
    function keyBox() { var P = S.hero, f = P.face || 1; return { x0: f > 0 ? P.x + 1 : P.x - K.REACH, x1: f > 0 ? P.x + K.REACH : P.x - 1, y0: P.y - K.HH - 6, y1: P.y + 2 }; }
    function strike() {
      var P = S.hero;
      if (S.phase !== 'play' || !P || S.key.cd > 0) return false;
      S.key.cd = K.KEY_CD; S.key.t = K.KEY_T;
      var b = keyBox(), hit = false, LV = S.LV;
      S.enemies.forEach(function (e) {
        if (!e.alive || e.x + e.hw < b.x0 || e.x - e.hw > b.x1 || e.y < b.y0 || e.y - e.h > b.y1) return;
        e.awake = true; hit = true;
        if (e.k === 'P') { ev('clank', { x: e.x, y: e.y - 8 }); return; }
        if (e.k === 'Z') { if (!bossHit(e)) ev('clank', { x: e.x, y: e.y - 14 }); return; }
        if (!e.stop) { e.stop = K.STOP; e.vx = 0; S.stops++; addScore(PTS.stop); ev('stopE', { k: e.k, x: e.x, y: e.y - e.h / 2 }); }
        else { kill(e, 'key', PTS.dismantle); addNuts(3); ev('dismantle', { k: e.k, x: e.x, y: e.y - e.h / 2 }); }
      });
      LV.groups.forEach(function (gr) {
        var wx = gr.winch.tx * T + 8, wy = (gr.winch.ty + 1) * T;
        if (wx + 6 >= b.x0 && wx - 6 <= b.x1 && wy >= b.y0 && wy - 18 <= b.y1) { wind(gr); hit = true; }
      });
      for (var ty = Math.floor(b.y0 / T); ty <= Math.floor((b.y1 - 3) / T); ty++) for (var tx = Math.floor(b.x0 / T); tx <= Math.floor(b.x1 / T); tx++) {
        if (tileAt(LV, tx, ty) !== 'x') continue;
        setTile(LV, tx, ty, '.'); S.opened++; addScore(PTS.crate); addNuts(3); hit = true;
        ev('crate', { x: tx * T + 8, y: ty * T + 8 });
      }
      ev('swing', { x: P.x + P.face * 14, y: P.y - 12, hit: hit });
      return true;
    }
    function stepGroups(dt) {
      var LV = S.LV;
      LV.groups.forEach(function (gr) {
        if (!(gr.t > 0)) return;
        gr.t -= dt; gr.acc = (gr.acc || 0) + dt;
        var bs = gr.tiles.filter(function (q) { return q.k === 'b'; });
        while (gr.acc >= K.EXT && gr.ext < bs.length) { gr.acc -= K.EXT; setTile(LV, bs[gr.ext].tx, bs[gr.ext].ty, 'Y', true); gr.ext++; }
        if (gr.t <= 0) { gr.t = 0; gr.ext = 0; gr.acc = 0; gr.tiles.forEach(function (q) { setTile(LV, q.tx, q.ty, q.k, true); }); ev('unwind', { x: gr.winch.tx * T + 8, y: (gr.winch.ty + 1) * T }); }
      });
    }

    // ---- враги ----
    function bodyStep(e, dt, turnEdge) {
      e.vy = Math.min(e.vy + K.G * dt, K.FALL);
      var wasG = e.ground, LV = S.LV, landed = false;
      if (wasG) e.vy = 0;
      var n = Math.max(1, Math.ceil(Math.max(Math.abs(e.vx), Math.abs(e.vy)) * dt / 4));
      e.wall = 0;
      for (var k = 0; k < n; k++) {
        moveX(LV, e, e.vx * dt / n);
        if (moveY(LV, e, e.vy * dt / n)) landed = true;
        if (e.vy >= 0 && settle(LV, e, wasG)) landed = true;
      }
      e.ground = landed || !!support(LV, e);
      if (e.ground) e.vy = 0;
      if (e.wall) { e.dir = -e.wall; }
      if (turnEdge && e.ground) {
        var ax = e.x + e.dir * (e.hw + 2), ty = Math.round(e.y / T);
        var ahead = tileAt(LV, Math.floor(ax / T), ty), ahead2 = tileAt(LV, Math.floor(ax / T), ty - 1);
        if (!(isSolid(ahead) || isBoard(ahead) || isSlope(ahead) || isSlope(ahead2) || slopeAt(LV, ax, e.y, 8, 8))) e.dir = -e.dir;
      }
      if (e.y > LV.h * T + 40) e.alive = false;
    }
    function enemyStep(e, dt) {
      var P = S.hero;
      if (!e.awake) { if (Math.abs(e.x - P.x) < 300 || e.k === 'P' || e.k === 'Z') e.awake = true; else return; }
      if (e.stop > 0) { e.stop -= dt; if (e.stop <= 0) { e.stop = 0; ev('rewind', { x: e.x, y: e.y - e.h / 2 }); } return; }
      e.t += dt;
      switch (e.k) {
        case 'g': e.vx = e.dir * EDEF.g.v; bodyStep(e, dt, false); break;
        case 'n': e.vx = e.dir * EDEF.n.v; bodyStep(e, dt, true); break;
        case 'm':
          e.stT -= dt;
          if (e.st === 'walk') {
            e.vx = e.dir * EDEF.m.v;
            if (e.ground && Math.abs(P.x - e.x) < 104 && Math.abs(P.y - e.y) < 26 && (P.x - e.x) * e.dir > 0 && e.stT <= 0) { e.st = 'tell'; e.stT = 0.5; ev('squeak', { x: e.x, y: e.y }); }
          } else if (e.st === 'tell') { e.vx = 0; if (e.stT <= 0) { e.st = 'dash'; e.stT = 0.8; } }
          else if (e.st === 'dash') { e.vx = e.dir * 100; if (e.stT <= 0) { e.st = 'wind'; e.stT = 0.9; } }
          else { e.vx = 0; if (e.stT <= 0) { e.st = 'walk'; e.stT = 0.8; } }
          bodyStep(e, dt, true); break;
        case 'h':
          e.stT -= dt;
          if (e.ground) { e.vx = 0; if (e.stT <= 0) { e.vy = -340; e.dir = P.x < e.x ? -1 : 1; e.vx = e.dir * 40; e.stT = 1.4; e.ground = false; ev('hop', { x: e.x, y: e.y, quiet: Math.abs(P.x - e.x) > 260 }); } }
          bodyStep(e, dt, false); break;
        case 'v': { var ox = e.x; e.x = e.x0 + Math.sin(e.t * 0.9) * 48; e.y = e.y0 + Math.sin(e.t * 2.4) * 8; e.dir = e.x >= ox ? 1 : -1; break; }
        case 'P': {
          e.stT -= dt;
          if (e.st === 'up') { e.y = e.top + 16; if (e.stT <= 0) e.st = 'drop'; }
          else if (e.st === 'drop') { e.y += 540 * dt; if (e.y >= e.bottom) { e.y = e.bottom; e.st = 'down'; e.stT = 0.5; if (Math.abs(P.x - e.x) < 320) ev('thud', { x: e.x, y: e.y }); } }
          else if (e.st === 'down') { if (e.stT <= 0) e.st = 'rise'; }
          else { e.y -= 90 * dt; if (e.y <= e.top + 16) { e.y = e.top + 16; e.st = 'up'; e.stT = 1.3; } }
          break;
        }
        case 'Z': bossStep(e, dt); break;
      }
    }
    function bossStep(B, dt) {
      var P = S.hero, D = B.B;
      if (B.inv > 0) B.inv -= dt;
      if (B.st === 'sleep') { B.vx = 0; bodyStep(B, dt, false); if (P.x > S.LV.arenaX + 40) { B.st = 'walk'; B.stT = D.leap; ev('bossIntro', { k: S.LV.boss, x: B.x, y: B.y }); } return; }
      B.stT -= dt;
      if (B.st === 'walk') {
        B.dir = P.x < B.x ? -1 : 1; B.vx = B.dir * D.sp * (B.hp <= B.hpMax / 2 ? 1.3 : 1);
        if (B.stT <= 0 && B.ground) { B.st = 'leap'; B.vy = -440; B.vx = Math.max(-140, Math.min(140, (P.x - B.x) * 1.1)); B.ground = false; ev('bossLeap', { x: B.x, y: B.y }); }
      } else if (B.st === 'leap') {
        if (B.ground && B.vy >= 0) {
          B.st = 'wind'; B.stT = D.wind; B.vx = 0; ev('thud', { x: B.x, y: B.y, big: true }); ev('bossWind', { x: B.x, y: B.y });
          for (var i = 0; i < D.shots; i++) { var a = (i - (D.shots - 1) / 2) * 0.5; S.bolts.push({ x: B.x, y: B.y - 22, vx: Math.sin(a) * 150 + (P.x < B.x ? -30 : 30), vy: -300 - Math.cos(a) * 60, t: 0 }); }
        }
      } else if (B.st === 'recoil') { if (B.ground) B.vx = 0; if (B.stT <= 0) { B.st = 'walk'; B.stT = B.B.leap * 0.7; } } else if (B.st === 'wind') { B.vx = 0; if (B.stT <= 0) { B.st = 'walk'; B.stT = D.leap * (0.8 + rng() * 0.4); } }
      bodyStep(B, dt, false);
    }
    function bossHit(B) {
      if (B.inv > 0 || !B.alive || B.st !== 'wind') return false;
      B.hp--; B.inv = 0.8; B.st = 'recoil'; B.stT = 0.8; B.dir = S.hero.x < B.x ? 1 : -1; B.vx = B.dir * 130; B.vy = -260; B.ground = false; S.hero.inv = Math.max(S.hero.inv, 0.6); ev('bossHit', { hp: B.hp, x: B.x, y: B.y - 20 });
      if (B.hp <= 0) { kill(B, 'key', PTS.boss); ev('bossDown', { x: B.x, y: B.y - 20 }); finish(true); }
      return true;
    }
    function platsUpdate() {
      var pl = S.W.plats; pl.length = 0;
      S.enemies.forEach(function (e) { if (e.alive && e.stop > 0 && STOPPABLE[e.k] && e.k !== 'n') pl.push({ x: e.x, top: e.y - e.h, hw: e.hw, spring: e.k === 'h', e: e }); });
    }
    function contacts() {
      var P = S.hero, h = heightOf(P);
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (!e.alive || !e.awake || e.stop > 0) continue;
        if (e.k === 'P') { if (overlap(P.x, P.y, K.HW - 1, h - 2, e.x, e.y, 8, 16)) hurt('piston', e.x); continue; }
        if (e.k === 'Z' && (e.st === 'sleep' || e.st === 'wind' || e.st === 'recoil')) continue;
        if (overlap(P.x, P.y, K.HW - 1, h - 1, e.x, e.y, e.hw - 1, e.h - 1)) hurt(e.k === 'Z' ? 'boss' : e.k, e.x);
      }
      S.bolts.forEach(function (b) { if (overlap(P.x, P.y, K.HW, h, b.x, b.y + 4, 4, 8)) { b.t = 99; hurt('bolt', b.x); } });
    }
    function collect() {
      var P = S.hero, LV = S.LV, h = heightOf(P);
      for (var i = 0; i < LV.items.length; i++) {
        var it = LV.items[i]; if (S.got[it.id]) continue;
        var cx = it.tx * T + 8, cy = it.ty * T + 8;
        if (Math.abs(cx - P.x) < K.HW + 6 && cy + 6 > P.y - h && cy - 6 < P.y) {
          S.got[it.id] = 1;
          if (it.k === 'nut') { S.nutsGot++; addNuts(1); ev('nut', { x: cx, y: cy }); }
          else { if (S.hearts < K.HEARTS) S.hearts++; else addScore(PTS.heartFull); ev('heart', { x: cx, y: cy }); }
        }
      }
      LV.camps.forEach(function (c) {
        var cx = c.tx * T + 8, cy = (c.ty + 1) * T;
        if (Math.abs(P.x - cx) < 12 && Math.abs(P.y - cy) < 20 && S.cp.x !== cx) { S.cp = { x: cx, y: cy }; c.lit = true; ev('camp', { x: cx, y: cy }); }
      });
    }
    // итог уровня: деталь механизма / хозяин крепости
    function finish(boss) {
      var LV = S.LV, all = S.nutsGot >= LV.nuts && S.opened >= LV.crates, noHit = S.hits === 0;
      var tb = Math.max(0, Math.round(LV.par - S.time)) * PTS.time;
      var pts = (boss ? 0 : PTS.finish) + tb + (all ? PTS.allNuts : 0) + (noHit ? PTS.noHit : 0);
      addScore(pts);
      S.ring = { boss: !!boss, pts: pts, time: tb, all: all, noHit: noHit, stars: 1 + (all ? 1 : 0) + (noHit ? 1 : 0) };
      S.phase = 'clear'; S.clearT = 0; S.hero.vx = 0;
      ev('finish', { x: S.hero.x, y: S.hero.y, stars: S.ring.stars, boss: !!boss });
    }
    function finishCheck() {
      var P = S.hero, LV = S.LV;
      if (LV.exit) { var ex = LV.exit.tx * T + 8, ey = (LV.exit.ty + 1) * T; if (Math.abs(P.x - ex) < 14 && P.y > ey - 30 && P.y <= ey + 1) finish(false); }
    }
    function stepBolts(dt) {
      var LV = S.LV;
      for (var b = S.bolts.length - 1; b >= 0; b--) { var o = S.bolts[b]; o.t += dt; o.vy += 900 * dt; o.x += o.vx * dt; o.y += o.vy * dt; if (o.t > 3 || isSolid(tilePx(LV, o.x, o.y))) S.bolts.splice(b, 1); }
    }

    function update(dt) {
      S.phaseT += dt;
      var P = S.hero, LV = S.LV;
      if (!LV) return;
      S.enemies.forEach(function (e) { if (e.dead > 0) e.dead -= dt; });
      if (S.key.t > 0) S.key.t -= dt;
      if (S.key.cd > 0) S.key.cd -= dt;
      if (S.phase === 'dead') {
        if (S.phaseT > 1.6) { if (S.lives <= 0) { S.phase = 'over'; ev('gameover', { score: S.score }); } else respawn(); }
        stepBolts(dt); return;
      }
      if (S.phase === 'clear') {
        S.clearT += dt;
        heroStep(S.W, P, { dx: 0, jump: false }, dt, null);
        if (S.clearT > 1.6 && !S.clearSent) { S.clearSent = true; ev('clear', { id: S.id, boss: !!LV.boss, score: S.score, stars: S.ring.stars, ring: S.ring }); }
        return;
      }
      if (S.phase !== 'play') return;
      S.time += dt;
      if (P.inv > 0) P.inv -= dt;
      stepGroups(dt);
      platsUpdate();
      heroStep(S.W, P, inp, dt, ev);
      var hz = hazard(LV, P);
      if (hz === 'fall' || hz === 'tar') { die(hz); return; }
      if (hz === 'spike') { hurt('spike'); P.vy = -330; P.ground = false; if (S.phase !== 'play') return; }
      S.enemies.forEach(function (e) { if (e.alive) enemyStep(e, dt); });
      contacts();
      if (S.phase !== 'play') return;
      collect();
      stepBolts(dt);
      finishCheck();
    }
    // реклама за награду: «ещё один шанс» после конца пружин — 3 пружины, с фонаря; бонус в паузе — все сердца
    function revive() { if (S.phase !== 'over') return false; S.lives = 3; respawn(); return true; }
    function canBoost() { return S.phase === 'play' && S.hearts < K.HEARTS; }
    function boost() { if (!canBoost()) return false; S.hearts = K.HEARTS; ev('heart', { x: S.hero.x, y: S.hero.y - 20, boost: true }); return true; }
    return {
      startLevel: startLevel, update: update, strike: strike, revive: revive, canBoost: canBoost, boost: boost,
      setInput: function (dx, jump) { inp.dx = dx | 0; inp.jump = !!jump; },
      state: function () { return S; },
      _place: function (tx, ty) { var P = S.hero; P.x = tx * T + 8; P.y = (ty + 1) * T; P.vx = 0; P.vy = 0; },
      _hurt: function (why, x) { hurt(why || 'test', x); },
      _die: function (why) { die(why || 'test'); },
      _wind: function (i) { wind(S.LV.groups[i]); }
    };
  }

  SK.Game = Game;
  SK.logic = { T: T, K: K, PTS: PTS, tileAt: tileAt, setTile: setTile, isSolid: isSolid, isBoard: isBoard, isSlope: isSlope, slopeAt: slopeAt, slopeS: slopeS,
    tilePx: tilePx, support: support, platAt: platAt, heroStep: heroStep, newHero: newHero, heightOf: heightOf, canStand: canStand, hazard: hazard, moveX: moveX, moveY: moveY, settle: settle,
    woundCopy: woundCopy, mulberry32: mulberry32, BOSSDEF: BOSSDEF, EDEF: EDEF, STOPPABLE: STOPPABLE };
})(typeof window !== 'undefined' ? window : globalThis);
