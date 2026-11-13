/* СКОК · логика уровня (без DOM, детерминирована при заданном rng). SKOK.Game(opts), SKOK.logic, SKOK.mini.
   Физика героя — L.heroStep(W, P, inp, dt, ev): одна функция и для игры, и для графа проходимости в тестах
   (W = { LV }). Координаты — пиксели мира; P.x — центр, P.y — подошвы. Клетка 16 px.
   Склоны «/» и «\» — поверхность по центру героя; на склоне ↓ — подкат (разгон вниз, сбивает врагов). */
(function (global) {
  'use strict';
  var SK = global.SKOK = global.SKOK || {};
  var T = 16;
  var K = {
    HW: 5, HH: 20, HL: 11,                               // полуширина, рост, рост в подкате/приседе
    G: 1400, FALL: 480, FALL_ARMOR: 600, GLIDE: 66, CUT: -150,
    WALK: 90, RUN: 150, ACC: 620, DEC: 800, TURN: 1700, AIR: 560, DRAG: 90, RAMP: 0.45,
    JUMP: 430, JUMP_RUN: 60, BOOTS: 1.22,                // прыжок ≈ 4 клетки, с разбега ≈ 5,3; башмаки ×1,22
    BOUNCE: 300, BOUNCE_HOLD: 440,
    SLIDE_ACC: 520, SLIDE_MAX: 240, SLIDE_DEC: 260, SLIDE_MIN: 30,
    POUND: 620, COYOTE: 0.08, BUFFER: 0.12, STEP: 7,
    RIVET_V: 230, RIVET_MAX: 2,
    LIVES: 5, INV: 1.5, NUTS_LIFE: 100, POST_H: 8
  };
  var PTS = { nut: 10, crate: 20, suit: 1000, key: 500, rivet: 100, slide: 200, pound: 200, box: 20, boss: 5000, ambush: 2000,
    combo: [100, 200, 300, 500, 800, 1000, 2000], bell: [100, 200, 400, 800, 2000, 5000] };
  var SUITS = ['apron', 'wings', 'armor', 'boots'];

  // ---------- клетки ----------
  function tileAt(LV, tx, ty) { if (tx < 0 || tx >= LV.w) return '#'; if (ty < 0 || ty >= LV.h) return '.'; return LV.t[ty].charAt(tx); }
  function setTile(LV, tx, ty, ch) { var s = LV.t[ty]; LV.t[ty] = s.slice(0, tx) + ch + s.slice(tx + 1); LV.rev = (LV.rev | 0) + 1; }
  var SOLID = { '#': 1, '=': 1, '^': 1, B: 1, M: 1, '*': 1, L: 1, u: 1, x: 1 };
  function isSolid(ch) { return SOLID[ch] === 1; }
  function isCrate(ch) { return ch === 'B' || ch === 'M' || ch === '*' || ch === 'L'; }
  function isSlope(ch) { return ch === '/' || ch === '\\'; }
  function tilePx(LV, x, y) { return tileAt(LV, Math.floor(x / T), Math.floor(y / T)); }
  function slopeS(ch, tx, ty, x) { var xl = Math.max(0, Math.min(T, x - tx * T)); return ch === '/' ? (ty + 1) * T - xl : ty * T + xl; }
  // поверхность склона под точкой x в окне [y-up, y+down] (ближайшая сверху)
  function slopeAt(LV, x, y, up, down) {
    var tx = Math.floor(x / T), best = null;
    for (var ty = Math.floor((y - up) / T); ty <= Math.floor((y + down) / T); ty++) {
      var ch = tileAt(LV, tx, ty);
      if (isSlope(ch)) { var s = slopeS(ch, tx, ty, x); if (s >= y - up - 0.001 && s <= y + down + 0.001 && (!best || s < best.s)) best = { s: s, ch: ch, ty: ty }; }
    }
    return best;
  }
  function hwOf(P) { return P.hw || K.HW; }
  function heightOf(P) { return P.h || (P.low ? K.HL : K.HH); }
  function footCh(LV, P, ty) {   // твердь/доска под подошвами в ряду ty (символ; центр важнее)
    var hw = hwOf(P), xs = [P.x, P.x - hw + 0.5, P.x + hw - 0.5], best = 0;
    for (var i = 0; i < 3; i++) { var ch = tileAt(LV, Math.floor(xs[i] / T), ty); if (isSolid(ch) || ch === 'T') { if (i === 0) return ch; if (!best) best = ch; } }
    return best;
  }
  // опора: { ch, slope: -1 ('/', вниз — влево) | 1 ('\', вниз — вправо) | 0 } или null
  function support(LV, P) {
    var ty = Math.round(P.y / T);
    if (Math.abs(P.y - ty * T) < 0.05) { var ch = footCh(LV, P, ty); if (ch) return { ch: ch, slope: 0 }; }
    var s = slopeAt(LV, P.x, P.y, 0.6, 0.6);
    if (s) return { ch: s.ch, slope: s.ch === '/' ? -1 : 1 };
    return null;
  }
  function canStand(LV, P) {
    var hw = hwOf(P), y = P.y - K.HH + 0.5;
    return !isSolid(tileAt(LV, Math.floor((P.x - hw + 0.5) / T), Math.floor(y / T))) && !isSolid(tileAt(LV, Math.floor((P.x + hw - 0.5) / T), Math.floor(y / T)));
  }
  function newHero(x, y) { return { x: x, y: y, vx: 0, vy: 0, ground: true, face: 1, low: false, slide: false, coyote: 0, buf: 0, jprev: false, cut: false, airMax: 0, ramp: 0, pound: false, suit: null, slopeDir: 0, onSlope: false, glide: false, bonk: null, wall: 0, combo: 0, inv: 0, under: null, py: y }; }

  // ---------- движение тела ----------
  function moveX(LV, P, dx) {
    if (!dx) return;
    var hw = hwOf(P), h = heightOf(P), x1 = P.x + dx, s = dx > 0 ? 1 : -1;
    var fx = x1 + s * hw, tx = Math.floor((s > 0 ? fx - 0.001 : fx) / T);
    var bottom = P.y - (P.ground || P.onSlope ? K.STEP : 0.5);
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
      for (var ty = r0; ty <= r1; ty++) for (i = 0; i < 2; i++) { tx = Math.floor(xs[i] / T); var ch = tileAt(LV, tx, ty); if (isSolid(ch) || ch === 'T') { P.y = ty * T; P.vy = 0; return true; } }
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
  // прилипание к склонам/ступенькам после шага (только при падении/на земле)
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
  // inp: { dx, dy, jump } (jump — кнопка зажата); ev(type, data) — события (или null)
  function heroStep(W, P, inp, dt, ev) {
    var LV = W.LV, dx = inp.dx | 0, dy = inp.dy | 0, jp = !!inp.jump && !P.jprev;
    P.jprev = !!inp.jump; P.wall = 0; P.bonk = null; P.landed = false; P.py = P.y;
    if (jp) P.buf = K.BUFFER; else if (P.buf > 0) P.buf -= dt;
    var sp = support(LV, P);
    P.ground = !!sp && P.vy >= 0;
    P.slopeDir = P.ground ? sp.slope : 0; P.onSlope = !!P.slopeDir; P.under = P.ground ? sp.ch : null;
    if (P.ground) { P.coyote = K.COYOTE; P.pound = false; P.combo = 0; } else if (P.coyote > 0) P.coyote -= dt;
    if (dx && !P.slide) P.face = dx;
    // разгон: шаг → бег, если долго держать направление на земле
    if (P.ground) { if (dx && P.vx * dx >= K.WALK - 1) P.ramp += dt; else if (!dx || P.vx * dx < 0) P.ramp = 0; }
    // подкат по склону / присед
    if (P.ground && dy > 0 && !P.slide) {
      if (P.slopeDir) { P.slide = true; P.low = true; P.face = P.slopeDir; if (ev) ev('slide', { x: P.x, y: P.y }); }
      else P.low = true;
    }
    if (P.slide && P.ground) {
      if (P.slopeDir) { P.vx += P.slopeDir * K.SLIDE_ACC * dt; if (Math.abs(P.vx) > K.SLIDE_MAX) P.vx = P.slopeDir * K.SLIDE_MAX; }
      else { var sg = P.vx > 0 ? 1 : -1; P.vx -= sg * K.SLIDE_DEC * dt; if (P.vx * sg <= 0) P.vx = 0; if (Math.abs(P.vx) < K.SLIDE_MIN) P.slide = false; if (dx && dx * P.vx < 0) P.slide = false; }
    }
    if (!P.slide && P.low && !(P.ground && dy > 0) && canStand(LV, P)) P.low = false;
    // прыжок (высота — от удержания)
    if (P.buf > 0 && (P.ground || P.coyote > 0) && canStand(LV, P)) {
      var v = K.JUMP + K.JUMP_RUN * Math.min(1, Math.abs(P.vx) / K.RUN); if (P.suit === 'boots') v *= K.BOOTS;
      P.vy = -v; P.ground = false; P.coyote = 0; P.buf = 0; P.cut = true; P.slide = false; P.low = false; P.onSlope = false; P.slopeDir = 0;
      P.airMax = Math.max(K.WALK, Math.abs(P.vx));
      if (ev) ev('jump', { x: P.x, y: P.y, suit: P.suit });
    }
    if (!inp.jump && P.cut && P.vy < K.CUT) P.vy = K.CUT;
    if (P.vy >= 0) P.cut = false;
    // удар медным панцирем о землю (↓ в воздухе)
    if (!P.ground && dy > 0 && P.suit === 'armor' && !P.pound) { P.pound = true; P.vy = K.POUND; P.vx = 0; P.cut = false; if (ev) ev('pound', { x: P.x, y: P.y }); }
    // горизонталь
    if (P.slide) { /* скорость задана подкатом */ }
    else if (P.ground && P.low) { var sl0 = P.vx > 0 ? 1 : -1; P.vx -= sl0 * K.DEC * dt; if (P.vx * sl0 < 0) P.vx = 0; }
    else if (P.ground) {
      var max = P.ramp >= K.RAMP ? K.RUN : K.WALK;
      if (dx) {
        if (P.vx * dx < 0) P.vx += dx * K.TURN * dt;
        else if (Math.abs(P.vx) < max) { P.vx += dx * K.ACC * dt; if (Math.abs(P.vx) > max) P.vx = dx * max; }
        else { P.vx -= dx * K.DEC * 0.5 * dt; if (Math.abs(P.vx) < max) P.vx = dx * max; }
      } else { var sv = P.vx > 0 ? 1 : -1; P.vx -= sv * K.DEC * dt; if (P.vx * sv < 0) P.vx = 0; }
    } else if (P.pound) P.vx = 0;
    else {
      var am = Math.max(K.WALK, P.airMax || 0);
      if (dx) { P.vx += dx * K.AIR * dt; if (Math.abs(P.vx) > am) P.vx = (P.vx > 0 ? 1 : -1) * am; }
      else { var sa = P.vx > 0 ? 1 : -1; P.vx -= sa * K.DRAG * dt; if (P.vx * sa < 0) P.vx = 0; }
    }
    // вертикаль (крылья-зонтик: удержание прыжка при падении — планирование)
    P.glide = false;
    if (!P.ground) {
      P.vy += K.G * dt;
      var mf = P.pound ? K.POUND : P.suit === 'armor' ? K.FALL_ARMOR : K.FALL; if (P.vy > mf) P.vy = mf;
      if (P.suit === 'wings' && inp.jump && !P.pound && P.vy > K.GLIDE) { P.vy = K.GLIDE; P.glide = true; }
    } else P.vy = 0;
    var wasGround = P.ground, vyIn = P.vy, landed = false;
    var n = Math.max(1, Math.ceil(Math.max(Math.abs(P.vx), Math.abs(P.vy)) * dt / 4));
    for (var k = 0; k < n; k++) {
      moveX(LV, P, P.vx * dt / n);
      if (moveY(LV, P, P.vy * dt / n)) landed = true;
      if (P.vy >= 0 && settle(LV, P, wasGround)) landed = true;
    }
    if (P.wall && P.slide) P.slide = false;
    if (landed && !wasGround) { P.landed = true; if (ev) ev('land', { v: vyIn, x: P.x, y: P.y, pound: P.pound }); }
    return P;
  }
  // опасности клетки для героя: 'spike' | 'tar' | 'fall' | null
  function hazard(LV, P) {
    if (P.y > LV.h * T + 24) return 'fall';
    if (tilePx(LV, P.x, P.y - 3) === '~') return 'tar';
    if (P.ground && P.under === '^' && P.suit !== 'armor') return 'spike';
    return null;
  }

  // ---------- мини-игры карты ----------
  function shuffle(a, rng) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var mini = {
    // лавка-лотерея: три короба, в каждом приз (костюм, жизнь, гайки); выбрать один
    shop: function (rng) { return shuffle([{ k: 'suit', suit: SUITS[Math.floor(rng() * 4)] }, { k: 'life' }, { k: 'nuts', n: 20 }], rng); },
    // угадай рычаг: 4 рычага, один открывает ворота с призом; 2 попытки
    lever: function (rng) { return { n: 4, good: Math.floor(rng() * 4), tries: 2, pulled: [] }; },
    pull: function (G, i) {
      if (G.tries <= 0 || G.pulled.indexOf(i) >= 0 || G.win) return null;
      G.pulled.push(i); G.tries--;
      if (i === G.good) { G.win = true; return 'win'; }
      return G.tries > 0 ? 'miss' : 'lose';
    },
    // приз → перенос между уровнями { lives, nuts, suit, suitHp, score }
    apply: function (carry, pr) {
      if (!pr) return carry;
      if (pr.k === 'suit') { carry.suit = pr.suit; carry.suitHp = pr.suit === 'apron' ? 2 : 1; }
      else if (pr.k === 'life') carry.lives++;
      else if (pr.k === 'nuts') { carry.nuts += pr.n; while (carry.nuts >= K.NUTS_LIFE) { carry.nuts -= K.NUTS_LIFE; carry.lives++; } }
      return carry;
    }
  };
  // бродяги карты: шаг бродяги края r по открытым узлам-уровням (не на узел героя)
  function wanderStep(MAP, p, r, rng, heroAt) {
    var w = p.wand && p.wand[r]; if (!w || w.dead) return null;
    var roam = MAP.roam(r);
    if (!MAP.isOpen(p, w.at)) return null;
    var opts = MAP.neighbors(p, w.at).filter(function (id) { return roam.indexOf(id) >= 0; });
    if (!opts.length) return null;
    w.at = opts[Math.floor(rng() * opts.length)];
    return w.at === heroAt ? 'meet' : 'moved';
  }

  // ---------- игра ----------
  var EDEF = { g: { hw: 6, h: 12, v: 34 }, m: { hw: 6, h: 9, v: 28 }, h: { hw: 5, h: 14, v: 0 }, n: { hw: 7, h: 10, v: 22 }, v: { hw: 7, h: 10, v: 0 }, P: { hw: 8, h: 16, v: 0 }, Z: { hw: 12, h: 28, v: 0 } };
  var BOSSDEF = { rust: { hp: 3, sp: 46, leap: 2.2, shots: 0 }, boiler: { hp: 4, sp: 52, leap: 2.6, shots: 2 }, vane: { hp: 4, sp: 60, leap: 1.8, shots: 1 }, pendulum: { hp: 5, sp: 72, leap: 1.9, shots: 3 } };
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function overlap(ax, ay, aw, ah, bx, by, bw, bh) { return Math.abs(ax - bx) < aw + bw && ay - ah < by && by - bh < ay; }

  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, emit = opts.onEvent || function () {}, god = !!opts.god;
    var S = { score: 0, lives: K.LIVES, nuts: 0, phase: 'idle', phaseT: 0, time: 0, id: null, LV: null, W: null, hero: null,
      enemies: [], items: [], got: {}, pickups: [], rivets: [], bolts: [], cp: null, keyGot: false, boss: null, kills: 0, deaths: 0,
      bell: { y: 0, x: 0, gy: 0 }, ring: null, secret: false, clearT: 0, suitStart: null, suitHpStart: 1 };
    var inp = { dx: 0, dy: 0, jump: false };
    function ev(t, d) { emit(t, d || {}); }
    function addScore(n) { S.score += n; }
    function addNuts(n, x, y) { S.nuts += n; addScore(PTS.nut * n); while (S.nuts >= K.NUTS_LIFE) { S.nuts -= K.NUTS_LIFE; S.lives++; ev('life', { x: x, y: y, from: 'nuts' }); } }

    function startLevel(id, carry, respawn) {
      if (carry) { S.lives = carry.lives; S.nuts = carry.nuts; S.score = carry.score | 0; S.suitStart = carry.suit || null; S.suitHpStart = carry.suitHp || 1; }
      var LV = SK.levels.build(id);
      S.id = id; S.LV = LV; S.W = { LV: LV };
      S.got = {}; S.pickups = []; S.rivets = []; S.bolts = []; S.keyGot = false; S.secret = false; S.ring = null; S.clearT = 0; S.boss = null;
      S.cp = { x: LV.start.tx * T + 8, y: (LV.start.ty + 1) * T };
      S.enemies = LV.enemies.map(function (e, i) {
        var D = EDEF[e.k], x = e.tx * T + 8, y = (e.ty + 1) * T;
        var o = { id: i, k: e.k, x: x, y: y, x0: x, y0: y, vx: -D.v, vy: 0, dir: -1, hw: D.hw, h: D.h, alive: true, awake: false, t: rng() * 2, st: 'walk', stT: 0, ground: false, dead: 0 };
        if (e.k === 'P') { o.top = e.ty * T; var ty = e.ty + 1; while (ty < LV.h && !isSolid(tileAt(LV, e.tx, ty))) ty++; o.bottom = ty * T; o.y = o.top + 16; o.st = 'up'; o.stT = rng() * 1.2; }
        if (e.k === 'Z') { var B = BOSSDEF[LV.boss]; o.hp = B.hp; o.hpMax = B.hp; o.B = B; o.st = 'sleep'; o.inv = 0; o.chip = 0; S.boss = o; }
        return o;
      });
      if (LV.exit) { S.bell.x = LV.exit.tx * T + 8; S.bell.gy = (LV.exit.ty + 1) * T; }
      spawnHero(S.suitStart, S.suitHpStart);
      S.phase = 'play'; S.phaseT = 0; S.time = 0;
      ev('level', { id: id, boss: LV.boss, ambush: LV.ambush, respawn: !!respawn });
    }
    function spawnHero(suit, hp) {
      var P = newHero(S.cp.x, S.cp.y); P.suit = suit || null; P.suitHp = hp || 1; P.inv = 1.0; S.hero = P;
    }
    function hurt(why, fromX) {
      var P = S.hero;
      if (god || P.inv > 0 || S.phase !== 'play') return;
      if (P.suit) {
        if (P.suit === 'apron' && P.suitHp > 1) P.suitHp--; else { ev('unsuit', { suit: P.suit, x: P.x, y: P.y }); P.suit = null; P.suitHp = 1; }
        P.inv = K.INV; P.vy = Math.min(P.vy, -220); if (fromX != null) P.vx = (P.x < fromX ? -1 : 1) * 110;
        ev('hurt', { why: why, x: P.x, y: P.y, suit: P.suit });
      } else die(why);
    }
    function die(why) {
      if (S.phase !== 'play') return;
      var P = S.hero;
      if (god && why !== 'fall' && why !== 'tar') return;
      S.phase = 'dead'; S.phaseT = 0; S.lives--; S.deaths++; P.suit = null;
      ev('die', { why: why, x: P.x, y: Math.min(P.y, S.LV.h * T) });
    }
    function kill(e, how, pts) {
      if (!e.alive) return;
      e.alive = false; e.dead = 0.7; e.how = how; S.kills++;
      addScore(pts); ev('kill', { k: e.k, how: how, pts: pts, x: e.x, y: e.y - e.h / 2 });
    }
    function fire() {
      var P = S.hero;
      if (S.phase !== 'play' || !P || P.suit !== 'apron' || S.rivets.length >= K.RIVET_MAX || P.slide) return false;
      S.rivets.push({ x: P.x + P.face * 7, y: P.y - 12, vx: P.face * K.RIVET_V + P.vx * 0.3, vy: -40, t: 0, b: 0 });
      ev('fire', { x: P.x, y: P.y }); return true;
    }

    // ---- ящики ----
    function bump(tx, ty) {
      var LV = S.LV, ch = tileAt(LV, tx, ty), idx = ty * LV.w + tx;
      S.enemies.forEach(function (e) { if (e.alive && e.k !== 'P' && e.k !== 'Z' && Math.abs(e.x - (tx * T + 8)) < 12 && Math.abs(e.y - ty * T) < 3) kill(e, 'bump', PTS.combo[0]); });
      if (!isCrate(ch)) { ev('bonk', { x: tx * T + 8, y: (ty + 1) * T }); return; }
      var c = LV.crates[idx] || { k: 'nut', n: 1 };
      addScore(PTS.crate);
      if (c.k === 'nut') { c.n = (c.n || 1) - 1; addNuts(1, tx * T + 8, ty * T); ev('crate', { k: 'nut', x: tx * T + 8, y: ty * T }); if (c.n <= 0) setTile(LV, tx, ty, 'u'); }
      else {
        setTile(LV, tx, ty, 'u');
        var face = S.hero.x < tx * T + 8 ? 1 : -1;
        S.pickups.push({ k: c.k, suit: c.suit, x: tx * T + 8, y: ty * T, vx: 46 * face, vy: -170, hw: 6, h: 10, t: 0, ground: false });
        ev('crate', { k: c.k, suit: c.suit, x: tx * T + 8, y: ty * T });
      }
      LV.bumpT = LV.bumpT || {}; LV.bumpT[idx] = 0.18;
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
        if (!(isSolid(ahead) || ahead === 'T' || isSlope(ahead) || isSlope(ahead2) || slopeAt(LV, ax, e.y, 8, 8))) e.dir = -e.dir;
      }
      if (e.y > LV.h * T + 40) e.alive = false;
    }
    function enemyStep(e, dt) {
      var P = S.hero, LV = S.LV;
      if (!e.awake) { if (Math.abs(e.x - P.x) < 300 || e.k === 'P' || e.k === 'Z') e.awake = true; else return; }
      e.t += dt;
      switch (e.k) {
        case 'g': e.vx = e.dir * EDEF.g.v; bodyStep(e, dt, false); break;
        case 'n': e.vx = e.dir * EDEF.n.v; bodyStep(e, dt, true); break;
        case 'm':
          e.stT -= dt;
          if (e.st === 'walk') {
            e.vx = e.dir * EDEF.m.v;
            if (e.ground && Math.abs(P.x - e.x) < 104 && Math.abs(P.y - e.y) < 26 && (P.x - e.x) * e.dir > 0 && e.stT <= 0) { e.st = 'tell'; e.stT = 0.45; ev('squeak', { x: e.x, y: e.y }); }
          } else if (e.st === 'tell') { e.vx = 0; if (e.stT <= 0) { e.st = 'dash'; e.stT = 0.9; } }
          else if (e.st === 'dash') { e.vx = e.dir * 110; if (e.stT <= 0) { e.st = 'wind'; e.stT = 0.9; } }
          else { e.vx = 0; if (e.stT <= 0) { e.st = 'walk'; e.stT = 0.8; } }
          bodyStep(e, dt, true); break;
        case 'h':
          e.stT -= dt;
          if (e.ground) { e.vx = 0; if (e.stT <= 0) { e.vy = -360; e.dir = P.x < e.x ? -1 : 1; e.vx = e.dir * 45; e.stT = 1.3; e.ground = false; ev('boing', { x: e.x, y: e.y, quiet: Math.abs(P.x - e.x) > 260 }); } }
          bodyStep(e, dt, false); break;
        case 'v': {
          var ox = e.x; e.x = e.x0 + Math.sin(e.t * 0.9) * 48; e.y = e.y0 + Math.sin(e.t * 2.4) * 8; e.dir = e.x >= ox ? 1 : -1; break;
        }
        case 'P': {
          e.stT -= dt;
          if (e.st === 'up') { e.y = e.top + 16; if (e.stT <= 0) { e.st = 'drop'; } }
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
        B.dir = P.x < B.x ? -1 : 1; B.vx = B.dir * D.sp * (B.hp <= B.hpMax / 2 ? 1.35 : 1);
        if (B.stT <= 0 && B.ground) { B.st = 'leap'; B.vy = -440; B.vx = Math.max(-140, Math.min(140, (P.x - B.x) * 1.1)); B.ground = false; ev('bossLeap', { x: B.x, y: B.y }); }
      } else if (B.st === 'leap') {
        if (B.ground && B.vy >= 0) {
          B.st = 'land'; B.stT = 0.5; B.vx = 0; ev('thud', { x: B.x, y: B.y, big: true });
          for (var i = 0; i < D.shots; i++) { var a = (i - (D.shots - 1) / 2) * 0.5; S.bolts.push({ x: B.x, y: B.y - 22, vx: Math.sin(a) * 120 + (P.x < B.x ? -60 : 60), vy: -300 - Math.cos(a) * 60, t: 0 }); }
        }
      } else if (B.st === 'land') { B.vx = 0; if (B.stT <= 0) { B.st = 'walk'; B.stT = D.leap * (0.8 + rng() * 0.4); } }
      bodyStep(B, dt, false);
    }
    function bossHit(B, how) {
      if (B.inv > 0 || !B.alive || B.st === 'sleep') return false;
      B.hp--; B.inv = 1.0; ev('bossHit', { hp: B.hp, x: B.x, y: B.y - 20, how: how });
      if (B.hp <= 0) { kill(B, how, PTS.boss); ev('bossDown', { x: B.x, y: B.y - 20 }); S.phase = 'clear'; S.clearT = 0; S.ring = { boss: true, pts: PTS.boss }; }
      return true;
    }
    function contacts() {
      var P = S.hero, h = heightOf(P), jumpHeld = inp.jump;
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (!e.alive || !e.awake) continue;
        if (e.k === 'P') { if (overlap(P.x, P.y, K.HW - 1, h - 2, e.x, e.y, 8, 16)) hurt('piston', e.x); continue; }
        if (!overlap(P.x, P.y, K.HW, h, e.x, e.y, e.hw, e.h)) continue;
        var fromAbove = P.vy > 0 && P.py <= e.y - e.h + 7;
        if (e.k === 'Z') {
          if (fromAbove || P.pound) { if (bossHit(e, P.pound ? 'pound' : 'stomp')) { P.vy = -(jumpHeld ? K.BOUNCE_HOLD + 40 : K.BOUNCE + 60); P.cut = true; P.pound = false; P.vx = (P.x < e.x ? -1 : 1) * 80; } }
          else if (e.inv <= 0.6) hurt('boss', e.x);
          continue;
        }
        if (P.slide) { kill(e, 'slide', PTS.slide); continue; }
        if (P.pound) { kill(e, 'pound', PTS.pound); P.vy = -K.BOUNCE * 0.7; P.pound = false; continue; }
        if (fromAbove) {
          if (e.k === 'n' && P.suit !== 'armor') { hurt('needles', e.x); P.vy = -K.BOUNCE; continue; }
          var pts = PTS.combo[Math.min(PTS.combo.length - 1, P.combo)]; P.combo++;
          kill(e, 'stomp', pts); P.y = Math.min(P.y, e.y - e.h); P.vy = -(jumpHeld ? K.BOUNCE_HOLD : K.BOUNCE); P.cut = true; P.ground = false;
          ev('stomp', { x: e.x, y: e.y - e.h, combo: P.combo });
          continue;
        }
        hurt(e.k, e.x);
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
          if (it.k === 'nut') { addNuts(1, cx, cy); ev('nut', { x: cx, y: cy }); }
          else if (it.k === 'key') { S.keyGot = true; addScore(PTS.key); ev('key', { x: cx, y: cy }); }
        }
      }
      for (var j = S.pickups.length - 1; j >= 0; j--) {
        var q = S.pickups[j]; if (q.t < 0.25) continue;
        if (overlap(P.x, P.y, K.HW, h, q.x, q.y, 6, 10)) {
          S.pickups.splice(j, 1);
          if (q.k === 'suit') { var had = P.suit; P.suit = q.suit; P.suitHp = q.suit === 'apron' ? 2 : 1; addScore(PTS.suit); ev('suit', { suit: q.suit, x: q.x, y: q.y, had: had }); }
          else if (q.k === 'life') { S.lives++; ev('life', { x: q.x, y: q.y }); }
        }
      }
      LV.camps.forEach(function (c) {
        var cx = c.tx * T + 8, cy = (c.ty + 1) * T;
        if (Math.abs(P.x - cx) < 12 && Math.abs(P.y - cy) < 20 && S.cp.x !== cx) { S.cp = { x: cx, y: cy }; c.lit = true; ev('camp', { x: cx, y: cy }); }
      });
    }
    function bellY(t) { return S.bell.gy - 22 - (0.5 - 0.5 * Math.cos(t * 2.1)) * (K.POST_H * T - 44); }
    function finishCheck() {
      var P = S.hero, LV = S.LV, h = heightOf(P);
      if (LV.exit) {
        S.bell.y = bellY(S.time);
        var bx = S.bell.x, by = S.bell.y;
        var hitBell = Math.abs(P.x - bx) < K.HW + 7 && by + 7 > P.y - h && by - 7 < P.y;
        if (hitBell || P.x + K.HW >= bx - 2) {
          var hgt = S.bell.gy - (hitBell ? by : S.bell.gy - 8), tiers = [40, 64, 88, 104, 120], ti = 0;
          if (hitBell) { ti = 1; for (var i = 0; i < tiers.length; i++) if (hgt >= tiers[i]) ti = i + 1; ti = Math.min(ti, PTS.bell.length - 1); }
          var pts = PTS.bell[ti];
          addScore(pts); S.ring = { bell: hitBell, tier: ti, pts: pts, y: hitBell ? by : S.bell.gy - 8 };
          S.phase = 'clear'; S.clearT = 0; P.vx = 0; P.vy = Math.max(P.vy, 0);
          ev('bell', { x: bx, y: S.ring.y, tier: ti, pts: pts, hit: hitBell });
        }
      }
      if (LV.door && S.keyGot && inp.dy < 0 && P.ground) {
        var dx = LV.door.tx * T + 8, dy = (LV.door.ty + 1) * T;
        if (Math.abs(P.x - dx) < 10 && Math.abs(P.y - dy) < 3) { S.secret = true; S.phase = 'clear'; S.clearT = 0; S.ring = { secret: true, pts: 1000 }; addScore(1000); ev('door', { x: dx, y: dy }); }
      }
      if (LV.ambush && S.enemies.every(function (e) { return !e.alive; })) { S.phase = 'clear'; S.clearT = 0; S.ring = { ambush: true, pts: PTS.ambush }; addScore(PTS.ambush); addNuts(15, P.x, P.y); ev('ambushWon', { x: P.x, y: P.y }); }
    }
    function stepRivets(dt) {
      var LV = S.LV;
      for (var i = S.rivets.length - 1; i >= 0; i--) {
        var r = S.rivets[i]; r.t += dt; r.vy += 900 * dt;
        var nx = r.x + r.vx * dt, ny = r.y + r.vy * dt, ch = tilePx(LV, nx, ny), gone = r.t > 2.2;
        if (isSolid(ch) || isSlope(ch)) {
          var chx = tilePx(LV, nx, r.y);
          if (isSolid(chx)) { if (chx === 'x') { setTile(LV, Math.floor(nx / T), Math.floor(r.y / T), '.'); addScore(PTS.box); ev('break', { x: nx, y: r.y }); } gone = true; ev('fizz', { x: r.x, y: r.y }); }
          else { r.vy = -150; r.b++; if (ch === 'x') { setTile(LV, Math.floor(nx / T), Math.floor(ny / T), '.'); addScore(PTS.box); ev('break', { x: nx, y: ny }); gone = true; } ny = r.y; if (r.b > 3) gone = true; }
        }
        r.x = nx; r.y = ny;
        for (var j = 0; j < S.enemies.length && !gone; j++) {
          var e = S.enemies[j]; if (!e.alive || !e.awake || e.k === 'P') continue;
          if (overlap(r.x, r.y + 4, 4, 9, e.x, e.y, e.hw, e.h)) {
            gone = true;
            if (e.k === 'Z') { e.chip = (e.chip || 0) + 1; ev('chip', { x: r.x, y: r.y }); if (e.chip >= 3) { e.chip = 0; bossHit(e, 'rivet'); } }
            else kill(e, 'rivet', PTS.rivet);
          }
        }
        if (gone || r.x < -20 || r.x > LV.w * T + 20 || r.y > LV.h * T + 20) S.rivets.splice(i, 1);
      }
      for (var b = S.bolts.length - 1; b >= 0; b--) { var o = S.bolts[b]; o.t += dt; o.vy += 900 * dt; o.x += o.vx * dt; o.y += o.vy * dt; if (o.t > 3 || isSolid(tilePx(LV, o.x, o.y))) S.bolts.splice(b, 1); }
    }
    function stepPickups(dt) {
      var LV = S.LV;
      S.pickups.forEach(function (q) {
        q.t += dt; q.vy = Math.min(q.vy + 900 * dt, 400);
        var wasG = q.ground; q.ground = false; q.wall = 0;
        var n = Math.max(1, Math.ceil(Math.max(Math.abs(q.vx), Math.abs(q.vy)) * dt / 4));
        for (var k = 0; k < n; k++) { moveX(LV, q, q.vx * dt / n); if (moveY(LV, q, q.vy * dt / n)) q.ground = true; if (q.vy >= 0 && settle(LV, q, wasG)) q.ground = true; }
        if (!q.ground && support(LV, q)) { q.ground = true; q.vy = 0; }
        if (q.wall) q.vx = -q.wall * Math.abs(q.vx || 30);
        if (q.ground) { var s = q.vx > 0 ? 1 : -1; q.vx -= s * 40 * dt; if (q.vx * s < 0) q.vx = 0; }
      });
      S.pickups = S.pickups.filter(function (q) { return q.y < LV.h * T + 30; });
    }
    function poundLand() {
      var P = S.hero, LV = S.LV, ty = Math.round(P.y / T), broke = false;
      [P.x - K.HW + 0.5, P.x + K.HW - 0.5].forEach(function (x) { var tx = Math.floor(x / T); if (tileAt(LV, tx, ty) === 'x') { setTile(LV, tx, ty, '.'); addScore(PTS.box); broke = true; ev('break', { x: tx * T + 8, y: ty * T + 8 }); } });
      S.enemies.forEach(function (e) { if (e.alive && e.awake && e.k !== 'P' && e.k !== 'Z' && e.ground && Math.abs(e.x - P.x) < 44 && Math.abs(e.y - P.y) < 10) kill(e, 'quake', PTS.pound); });
      ev('quake', { x: P.x, y: P.y, broke: broke });
    }

    function update(dt) {
      S.time += dt; S.phaseT += dt;
      var P = S.hero, LV = S.LV;
      if (!LV) return;
      if (LV.bumpT) for (var bk in LV.bumpT) { LV.bumpT[bk] -= dt; if (LV.bumpT[bk] <= 0) delete LV.bumpT[bk]; }
      S.enemies.forEach(function (e) { if (e.dead > 0) e.dead -= dt; });
      if (S.phase === 'dead') {
        if (S.phaseT > 1.6) {
          if (S.lives <= 0) { S.phase = 'over'; ev('gameover', { score: S.score }); }
          else {
            // переигровка с фонаря: враги и ящики — заново, собранное остаётся собранным
            var keep = S.got, cp = S.cp, key = S.keyGot, lit = LV.camps.map(function (c) { return !!c.lit; });
            var carry = { lives: S.lives, nuts: S.nuts, score: S.score, suit: null };
            startLevel(S.id, carry, true); S.got = keep; S.cp = cp; S.keyGot = key; S.LV.camps.forEach(function (c, i) { c.lit = lit[i]; }); spawnHero(null, 1);
            ev('respawn', {});
          }
        }
        stepRivets(dt); return;
      }
      if (S.phase === 'clear') {
        S.clearT += dt;
        if (S.ring && (S.ring.bell != null)) { P.vx = 50; P.face = 1; }
        else P.vx = 0;
        heroStep(S.W, P, { dx: S.ring && S.ring.bell != null ? 1 : 0, dy: 0, jump: false }, dt, null);
        if (S.clearT > 1.6 && !S.clearSent) {
          S.clearSent = true;
          ev('clear', { id: S.id, secret: S.secret, boss: !!LV.boss, ambush: LV.ambush, pts: S.ring ? S.ring.pts : 0, tier: S.ring && S.ring.tier, bell: S.ring && S.ring.bell, key: S.keyGot });
        }
        return;
      }
      if (S.phase !== 'play') return;
      S.clearSent = false;
      if (P.inv > 0) P.inv -= dt;
      var wasPound = P.pound;
      heroStep(S.W, P, inp, dt, function (t, d) {
        if (t === 'land' && d.pound) return;
        ev(t, d);
      });
      if (P.bonk) bump(P.bonk.tx, P.bonk.ty);
      if (P.landed && wasPound) poundLand();
      var hz = hazard(LV, P);
      if (hz === 'fall' || hz === 'tar') { die(hz); return; }
      if (hz === 'spike') { hurt('spike'); if (S.phase === 'play' && !god) { P.vy = -330; P.ground = false; } else if (god) { P.vy = -330; P.ground = false; } }
      S.enemies.forEach(function (e) { if (e.alive) enemyStep(e, dt); });
      contacts();
      if (S.phase !== 'play') return;
      collect();
      stepRivets(dt); stepPickups(dt);
      finishCheck();
    }
    function carry() { var P = S.hero; return { lives: S.lives, nuts: S.nuts, score: S.score, suit: P ? P.suit : null, suitHp: P ? P.suitHp : 1 }; }
    return {
      startLevel: startLevel, update: update, fire: fire, carry: carry,
      setInput: function (dx, dy, jump) { inp.dx = dx; inp.dy = dy; inp.jump = !!jump; },
      state: function () { return S; },
      _place: function (tx, ty) { var P = S.hero; P.x = tx * T + 8; P.y = (ty + 1) * T; P.vx = 0; P.vy = 0; },
      _hurt: function (why, x) { hurt(why || 'test', x); },
      _die: function (why) { die(why || 'test'); },
      _bump: bump
    };
  }

  SK.Game = Game;
  SK.mini = mini;
  SK.logic = { T: T, K: K, PTS: PTS, SUITS: SUITS, tileAt: tileAt, setTile: setTile, isSolid: isSolid, isCrate: isCrate, isSlope: isSlope, slopeAt: slopeAt, slopeS: slopeS,
    tilePx: tilePx, support: support, heroStep: heroStep, newHero: newHero, heightOf: heightOf, canStand: canStand, hazard: hazard, moveX: moveX, moveY: moveY, settle: settle,
    mulberry32: mulberry32, wanderStep: wanderStep, BOSSDEF: BOSSDEF, EDEF: EDEF };
})(typeof window !== 'undefined' ? window : globalThis);
