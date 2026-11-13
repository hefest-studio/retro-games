/* ПОСОХ · логика экспедиции (без DOM, детерминирована при заданном rng). POSOKH.Game(opts), POSOKH.logic.
   Физика героя — logic.heroStep(W, P, inp, dt, ev): одна функция и для игры, и для графа проходимости в тестах.
   W = { LV, g: [ряды-массивы клеток] }. Координаты — пиксели мира; P.x — центр, P.y — подошвы. Клетка 16 px.
   Пого: в воздухе зажат ↓ — Ярослава стоит на посохе-пружине; приземление на посохе — отскок, и каждый следующий
   отскок подряд выше прежнего (до предела). На посохе шипы не ранят, а враги и сундуки сверху получают удар. */
(function (global) {
  'use strict';
  var PS = global.POSOKH = global.POSOKH || {};
  var T = 16;
  var K = {
    HW: 5, HH: 24,
    G: 1400, JUMP: 440, CUT: -160, FALL: 560,          // прыжок ≈ 4,3 клетки
    RUN: 115, ACC: 1000, DEC: 1400, AIR: 800,
    POGO0: 430, POGO_STEP: 55, POGO_MAX: 600,           // отскоки: ≈ 4,1 → 5,2 → 6,5 → 7,9 клетки
    COYOTE: 0.08, BUFFER: 0.12,
    HEARTS: 3, LIVES: 3, INV: 1.2, HURT_V: 300,
    SWING: 0.28, ROCK_VX: 270, ROCK_VY: 260,
    RETREAT: 0.5                                        // при отступлении в лагерь из мешка сохраняется половина
  };
  var PTS = { gem: 100, big: 500, chest: 1200, relic: 20000, boss: 3000, guard: 1000, enemy: 50 };
  // хозяева экспедиций: hp, скорость, прыжок (раз в N с), рывок, полёт, выстрел
  var BOSS = {
    golem:  { hp: 5, w: 18, h: 30, walk: 38, leap: 2.6, leapV: 430 },
    toad:   { hp: 6, w: 18, h: 26, walk: 0, leap: 1.7, leapV: 400, shoot: 3.2 },
    lynx:   { hp: 6, w: 20, h: 24, walk: 52, dash: 3.0, dashV: 210 },
    petrel: { hp: 6, w: 20, h: 22, fly: 1, swoop: 2.8 },
    crab:   { hp: 7, w: 20, h: 24, walk: 44, leap: 4.2, leapV: 380, shoot: 2.4 }
  };
  var GUARD = { hp: 3, w: 14, h: 26, walk: 48, leap: 2.4, leapV: 380 };

  // ---------- клетки ----------
  function grid(LV) { return LV.t.map(function (s) { return s.split(''); }); }
  function tileAt(W, tx, ty) { if (tx < 0 || tx >= W.LV.w) return '#'; if (ty < 0) return W.LV.ceil ? '#' : '.'; if (ty >= W.LV.h) return '.'; return W.g[ty][tx]; }
  function isSolid(ch) { return ch === '#' || ch === '^' || ch === 'c' || ch === 'D' || ch === 'X' || ch === 'A'; }
  function isTop(ch) { return ch === '-'; }
  function tilePx(W, x, y) { return tileAt(W, Math.floor(x / T), Math.floor(y / T)); }
  function solidPx(W, x, y) { return isSolid(tilePx(W, x, y)); }
  function newHero(x, y) { return { x: x, y: y, vx: 0, vy: 0, ground: true, face: 1, pogo: false, chain: 0, coy: 0, buf: 0, jprev: false, jumping: false, inv: 0, on: '#', sim: false }; }
  // опора под ногами: 0 — нет, иначе символ клетки
  function support(W, P) {
    var ty = Math.round(P.y / T);
    if (Math.abs(P.y - ty * T) > 0.05) return 0;
    var xs = [P.x, P.x - K.HW + 0.5, P.x + K.HW - 0.5], best = 0;
    for (var i = 0; i < 3; i++) {
      var ch = tileAt(W, Math.floor(xs[i] / T), ty);
      if (isSolid(ch) || isTop(ch)) { if (ch !== '^') return ch; best = ch; }
    }
    return best;
  }
  function moveX(W, P, dx) {
    if (!dx) return;
    var x1 = P.x + dx, s = dx > 0 ? 1 : -1, fx = x1 + s * K.HW, tx = Math.floor((s > 0 ? fx - 0.001 : fx) / T);
    for (var y = P.y - K.HH + 0.5; ; y += T) {
      var yy = Math.min(y, P.y - 0.5);
      if (isSolid(tileAt(W, tx, Math.floor(yy / T)))) { P.x = s > 0 ? tx * T - K.HW : (tx + 1) * T + K.HW; P.vx = 0; P.wall = s; return; }
      if (yy >= P.y - 0.5) break;
    }
    P.x = x1;
  }
  // → символ опоры, если приземлились; 'head' — удар головой
  function moveY(W, P, dy) {
    if (!dy) return 0;
    var y1 = P.y + dy;
    if (dy > 0) {
      // граница клеток, которую пересекают подошвы (подшаг < клетки — не больше одной)
      var row = Math.ceil(P.y / T - 1e-6);
      if (row * T <= y1) {
        var xs = [P.x - K.HW + 0.5, P.x, P.x + K.HW - 0.5], hit = 0;
        for (var i = 0; i < 3; i++) { var ch = tileAt(W, Math.floor(xs[i] / T), row); if (isSolid(ch) || isTop(ch)) { if (!hit || hit === '^') hit = ch; } }
        if (hit) { P.y = row * T; return hit; }
      }
      P.y = y1; return 0;
    }
    var top = y1 - K.HH, tt = Math.floor(top / T);
    var xs2 = [P.x - K.HW + 0.5, P.x + K.HW - 0.5];
    for (var j = 0; j < 2; j++) if (isSolid(tileAt(W, Math.floor(xs2[j] / T), tt))) { P.y = (tt + 1) * T + K.HH; return 'head'; }
    P.y = y1; return 0;
  }
  function bounceV(P) { return Math.min(K.POGO_MAX, K.POGO0 + K.POGO_STEP * Math.max(0, P.chain - 1)); }
  function bounce(P, ev, what) { P.chain++; P.vy = -bounceV(P); P.ground = false; P.jumping = false; if (ev) ev('bounce', { x: P.x, y: P.y, chain: P.chain, on: what }); }
  // inp = { dx: -1|0|1, dn: ↓ зажата, jump: прыжок зажат }
  function heroStep(W, P, inp, dt, ev) {
    var dx = inp.dx || 0;
    if (dx) P.face = dx;
    // прыжок: буфер нажатия + «койот»
    var jp = !!inp.jump && !P.jprev; P.jprev = !!inp.jump;
    if (jp) P.buf = K.BUFFER; else if (P.buf > 0) P.buf -= dt;
    if (P.ground) P.coy = K.COYOTE; else if (P.coy > 0) P.coy -= dt;
    if (P.buf > 0 && (P.ground || P.coy > 0)) { P.vy = -K.JUMP; P.ground = false; P.coy = 0; P.buf = 0; P.jumping = true; P.chain = 0; if (ev) ev('jump', { x: P.x, y: P.y }); }
    if (!inp.jump && P.jumping && P.vy < K.CUT) P.vy = K.CUT;
    if (P.vy >= 0) P.jumping = false;
    // стойка на посохе — только в воздухе
    P.pogo = !P.ground && !!inp.dn;
    // горизонталь
    var tgt = dx * K.RUN, a = P.ground ? (dx ? K.ACC : K.DEC) : K.AIR;
    if (P.vx < tgt) P.vx = Math.min(tgt, P.vx + a * dt); else if (P.vx > tgt) P.vx = Math.max(tgt, P.vx - a * dt);
    if (!P.ground) P.vy = Math.min(K.FALL, P.vy + K.G * dt);
    var n = Math.max(1, Math.ceil(Math.max(Math.abs(P.vx), Math.abs(P.vy)) * dt / 4));
    P.wall = 0;
    for (var i = 0; i < n; i++) {
      moveX(W, P, P.vx * dt / n);
      if (!P.ground) {
        var hit = moveY(W, P, P.vy * dt / n);
        if (hit === 'head') { P.vy = Math.max(0, P.vy); }
        else if (hit) {
          if (P.pogo) { bounce(P, ev, hit); if (hit === '^' && ev) ev('spikeBounce', { x: P.x, y: P.y }); }
          else { var v = P.vy; P.vy = 0; P.ground = true; P.chain = 0; P.on = hit; if (ev) ev('land', { v: v, x: P.x, y: P.y }); }
        }
      }
    }
    if (P.ground) {
      var s = support(W, P);
      if (!s) { P.ground = false; }
      else { P.on = s; if (s === '^') { if (ev) ev('spike', { x: P.x, y: P.y }); } }
    }
    if (P.inv > 0) P.inv -= dt;
    if (P.y > W.LV.h * T + 40 && ev) ev('fall', { x: P.x, y: P.y });
    if (tilePx(W, P.x, P.y - 4) === '~' && ev) ev('drown', { x: P.x, y: P.y });
    return P;
  }

  // ---------- rng ----------
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function overlap(ax, ay, aw, ah, bx, by, bw, bh) { return Math.abs(ax - bx) < aw + bw && ay - ah < by && by - bh < ay; }

  // ---------- экспедиция ----------
  // opts: { rng, onEvent(type,data), god — без урона (тесты) }
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, emit = opts.onEvent || function () {};
    var S = null, inp = { dx: 0, dn: false, jump: false }, swingReq = false;
    function ev(t, d) { emit(t, d || {}); }
    // carry: { items:{gear:1}, taken:[id] (уже взятые предметы этой экспедиции), lives, bank }
    function start(id, carry) {
      carry = carry || {};
      var LV = PS.levels.build(id), W = { LV: LV, g: grid(LV) };
      var have = carry.items || {};
      var doorOpen = !!(LV.door && have[LV.door]);
      if (doorOpen) for (var y = 0; y < LV.h; y++) for (var x = 0; x < LV.w; x++) if (W.g[y][x] === 'D') W.g[y][x] = '.';
      var taken = {}; (carry.taken || []).forEach(function (i) { taken[i] = 1; });
      S = {
        id: id, LV: LV, W: W, phase: 'play', phaseT: 0, time: 0,
        lives: carry.lives != null ? carry.lives : K.LIVES, hearts: K.HEARTS, bank: carry.bank || 0, bag: 0,
        hero: null, got: taken, newGot: [], cp: -1, doorOpen: doorOpen, items: have,
        enemies: [], objs: [], loot: [], shots: [], guard: null, boss: null, keyDrop: null,
        swing: 0, kills: 0, deaths: 0, hurts: 0, gotItem: null, gotRelic: null, keyGot: false, arena: false
      };
      LV.objs.forEach(function (o) {
        var ty = o.ty + 1; while (ty < LV.h && !isSolid(tileAt(W, o.tx, ty)) && !isTop(tileAt(W, o.tx, ty))) ty++;   // камни и сундуки ложатся на опору
        S.objs.push({ id: o.id, k: o.k, x: o.tx * T + 8, y: ty * T, vx: 0, vy: 0, fly: false, alive: !taken['o' + o.id] });
      });
      spawnAll();
      placeHero();
      ev('start', { id: id });
      return S;
    }
    function spawnAll() {
      var LV = S.LV;
      S.enemies = LV.enemies.map(function (e, i) {
        return { i: i, k: e.k, x: e.tx * T + 8, y: (e.ty + 1) * T, x0: e.tx * T + 8, y0: (e.ty + 1) * T, vx: e.k === 'walker' ? -30 : 0, vy: 0, ground: e.k !== 'flier', alive: true, t: rng() * 3, hp: 1, w: 7, h: e.k === 'flier' ? 10 : 12 };
      });
      var gd = LV.guardAt;
      S.guard = S.guard && !S.guard.alive ? S.guard : { k: 'guard', x: gd.tx * T + 8, y: (gd.ty + 1) * T, vx: -GUARD.walk, vy: 0, ground: true, alive: true, hp: GUARD.hp, inv: 0, t: 0, w: GUARD.w, h: GUARD.h, awake: false };
      if (S.guard.alive) { S.guard.x = gd.tx * T + 8; S.guard.y = (gd.ty + 1) * T; S.guard.hp = GUARD.hp; S.guard.awake = false; }
      var bd = LV.bossAt, B = BOSS[LV.boss];
      if (!S.boss || S.boss.alive) S.boss = { k: LV.boss, def: B, x: bd.tx * T + 8, y: (bd.ty + 1) * T, vx: 0, vy: 0, ground: true, alive: true, hp: B.hp, inv: 0, t: 1.2, st: 'idle', w: B.w, h: B.h, awake: false, face: -1, fy: 0 };
      S.shots = [];
      S.arena = false; setArena(false);
    }
    function setArena(on) { var g = S.W.g; for (var y = 0; y < S.LV.h; y++) for (var x = 0; x < S.LV.w; x++) { if (on && g[y][x] === 'a') g[y][x] = 'A'; else if (!on && g[y][x] === 'A') g[y][x] = 'a'; } }
    function placeHero() {
      var LV = S.LV, at = S.cp >= 0 ? LV.flags[S.cp] : LV.start;
      S.hero = newHero(at.tx * T + 8, (at.ty + 1) * T);
      S.hero.inv = 1;
    }
    function hurt(fromX) {
      var P = S.hero;
      if (opts.god || P.inv > 0 || S.phase !== 'play') return;
      S.hearts--; S.hurts++;
      P.inv = K.INV; P.vy = -K.HURT_V * 0.8; P.ground = false; P.vx = (P.x < fromX ? -1 : 1) * 140; P.jumping = false;
      ev('hurt', { x: P.x, y: P.y });
      if (S.hearts <= 0) die('hurt');
    }
    function die(why) {
      if (S.phase !== 'play') return;
      if (opts.god && why !== 'fall' && why !== 'drown') return;
      S.lives--; S.deaths++; S.phase = S.lives > 0 ? 'dead' : 'over'; S.phaseT = 0;
      ev('die', { why: why, x: S.hero.x, y: S.hero.y });
      if (S.phase === 'over') ev('gameover', {});
    }
    function respawn() {
      S.hearts = K.HEARTS; S.phase = 'play'; S.phaseT = 0;
      spawnAll(); placeHero();
      ev('respawn', {});
    }
    function heroEv(t, d) {
      if (t === 'spike') { hurt(S.hero.x + (S.hero.face > 0 ? 8 : -8)); if (S.hero.ground) { S.hero.vy = -K.HURT_V; S.hero.ground = false; } }
      else if (t === 'fall') die('fall');
      else if (t === 'drown') die('drown');
      else ev(t, d);
    }
    // взять предмет
    function collect(it) {
      if (S.got[it.id]) return;
      S.got[it.id] = 1; S.newGot.push(it.id);
      var x = it.tx * T + 8, y = it.ty * T + 8;
      switch (it.k) {
        case 'gem': S.bag += PTS.gem; ev('gem', { x: x, y: y, v: PTS.gem }); break;
        case 'big': S.bag += PTS.big; ev('gem', { x: x, y: y, v: PTS.big, big: true }); break;
        case 'pie': S.hearts = Math.min(K.HEARTS, S.hearts + 1); ev('pie', { x: x, y: y }); break;
        case 'bigpie': S.hearts = K.HEARTS; ev('pie', { x: x, y: y, big: true }); break;
        case 'life': S.lives++; ev('life', { x: x, y: y }); break;
        case 'item': S.gotItem = it.what; ev('item', { x: x, y: y, what: it.what }); break;
        case 'relic': S.gotRelic = it.what; S.bag += PTS.relic; ev('relic', { x: x, y: y, what: it.what, v: PTS.relic }); break;
      }
    }
    function burst(o) {
      o.alive = false; S.got['o' + o.id] = 1; S.newGot.push('o' + o.id);
      for (var i = 0; i < 4; i++) S.loot.push({ x: o.x, y: o.y - 8, vx: (i - 1.5) * 50, vy: -220 - i * 25, v: i < 2 ? 500 : 100, t: 0, ground: false });
      ev('chest', { x: o.x, y: o.y - 8 });
    }
    function breakTile(tx, ty) { if (tileAt(S.W, tx, ty) !== 'c') return false; S.W.g[ty][tx] = '.'; ev('crack', { x: tx * T + 8, y: ty * T + 8 }); return true; }
    function doSwing() {
      var P = S.hero;
      if (!P.ground || S.swing > 0 || S.phase !== 'play') return false;
      S.swing = K.SWING; ev('swing', { x: P.x, y: P.y, face: P.face });
      var hitSomething = false;
      // треснувший камень прямо перед собой (вся высота роста)
      var fx = Math.floor((P.x + P.face * (K.HW + 8)) / T);
      for (var ty = Math.floor((P.y - K.HH + 1) / T); ty <= Math.floor((P.y - 1) / T); ty++) if (breakTile(fx, ty)) hitSomething = true;
      // камни и сундуки рядом спереди — в полёт
      S.objs.forEach(function (o) {
        if (!o.alive || o.fly) return;
        var d = (o.x - P.x) * P.face;
        if (d > -2 && d < 26 && Math.abs(o.y - P.y) < 10) { o.fly = true; o.vx = P.face * K.ROCK_VX; o.vy = -K.ROCK_VY; o.air = 0; hitSomething = true; ev('whack', { x: o.x, y: o.y, k: o.k }); }
      });
      return hitSomething;
    }
    // удар посохом сверху (пого) по цели — true, если отскок
    function pogoHit(P, top, x, w) {
      return P.pogo && P.vy > 0 && P.y <= top + 10 && Math.abs(P.x - x) < w + K.HW + 2;
    }
    function stepEnemy(e, dt) {
      var P = S.hero, W = S.W;
      e.t += dt;
      if (e.k === 'flier') {
        e.x = e.x0 + Math.sin(e.t * 0.9) * 40; e.y = e.y0 - 6 + Math.sin(e.t * 2.3) * 10; e.vx = Math.cos(e.t * 0.9);
        return;
      }
      if (e.k === 'hopper') {
        if (e.ground && e.t > 1.5 && Math.abs(P.x - e.x) < 9 * T) { e.t = rng() * 0.4; e.vy = -320; e.vx = (P.x > e.x ? 1 : -1) * 60; e.ground = false; }
      }
      if (!e.ground) e.vy = Math.min(K.FALL, e.vy + K.G * dt);
      // горизонталь со стенами и краями
      var nx = e.x + e.vx * dt, s = e.vx > 0 ? 1 : -1, fx = Math.floor((nx + s * e.w) / T), ty = Math.floor((e.y - 2) / T);
      if (isSolid(tileAt(W, fx, ty)) || isSolid(tileAt(W, fx, Math.floor((e.y - e.h + 1) / T)))) { if (e.k === 'walker') e.vx = -e.vx; else e.vx = 0; }
      else if (e.ground && e.k === 'walker') {
        var below = tileAt(W, fx, Math.floor(e.y / T));
        if (!(isSolid(below) || isTop(below)) || below === '^') e.vx = -e.vx; else e.x = nx;
      } else e.x = nx;
      if (!e.ground) {
        var y1 = e.y + e.vy * dt;
        if (e.vy > 0) {
          var row = Math.floor(y1 / T), ch = tileAt(W, Math.floor(e.x / T), row);
          if ((isSolid(ch) || isTop(ch)) && e.y <= row * T + 0.5) { e.y = row * T; e.vy = 0; e.ground = true; if (e.k === 'hopper') e.vx = 0; }
          else e.y = y1;
        } else {
          if (isSolid(tileAt(W, Math.floor(e.x / T), Math.floor((y1 - e.h) / T)))) e.vy = 0; else e.y = y1;
        }
        if (e.y > S.LV.h * T + 40) e.alive = false;
      } else {
        var under = tileAt(W, Math.floor(e.x / T), Math.round(e.y / T));
        if (!(isSolid(under) || isTop(under))) e.ground = false;
      }
    }
    // страж и хозяин — общий «ходок-прыгун»
    function stepBig(b, def, dt) {
      var P = S.hero, W = S.W;
      if (b.inv > 0) b.inv -= dt;
      b.t -= dt;
      var dir = P.x > b.x ? 1 : -1;
      if (def.fly) {
        // летун: кружит над ареной, раз в swoop с — пикирует к героине и взмывает
        b.ground = false;
        if (b.st === 'idle' || b.st === 'hover') {
          b.st = 'hover'; b.fy = b.fy || b.y - 6 * T;
          var hy = (S.LV.h - 3) * T - 6 * T;
          b.vx += dir * 120 * dt; b.vx = Math.max(-80, Math.min(80, b.vx));
          b.y += (hy + Math.sin(S.time * 2) * 6 - b.y) * Math.min(1, dt * 3);
          if (b.t <= 0) { b.st = 'dive'; b.t = 0; b.tx = P.x; }
        } else if (b.st === 'dive') {
          b.vx = (b.tx - b.x) * 2; b.y += 260 * dt;
          if (b.y >= (S.LV.h - 3) * T) { b.y = (S.LV.h - 3) * T; b.st = 'low'; b.t = 1.1; ev('thud', { x: b.x, y: b.y }); }
        } else if (b.st === 'low') { b.vx *= 0.9; if (b.t <= 0) { b.st = 'rise'; } }
        else if (b.st === 'rise') { b.y -= 160 * dt; if (b.y <= (S.LV.h - 3) * T - 6 * T) { b.st = 'hover'; b.t = def.swoop; } }
        b.x += b.vx * dt;
        var lo = (S.LV.arenaX + 2) * T + b.w, hi = (S.LV.w - 1) * T - b.w;
        b.x = Math.max(lo, Math.min(hi, b.x));
        b.face = b.vx >= 0 ? 1 : -1;
        return;
      }
      if (b.ground) {
        if (def.dash && b.st === 'dash') { /* рывок до стены */ }
        else {
          b.face = dir;
          b.vx = def.walk ? dir * def.walk : 0;
          if (b.t <= 0) {
            if (def.leap && (!def.dash || rng() < 0.5)) { b.vy = -def.leapV; b.vx = dir * 90; b.ground = false; b.t = def.leap; b.st = 'leap'; ev('leap', { x: b.x, y: b.y }); }
            else if (def.dash) { b.st = 'dash'; b.vx = dir * def.dashV; b.t = def.dash; ev('dash', { x: b.x, y: b.y }); }
            else b.t = 1;
          }
        }
        if (def.shoot && (b.st2 || 0) <= 0 && b.awake !== false) { b.st2 = def.shoot; S.shots.push({ x: b.x + b.face * b.w, y: b.y - b.h * 0.55, vx: b.face * 150, vy: 0, t: 0 }); ev('shoot', { x: b.x, y: b.y }); }
      } else b.vy = Math.min(K.FALL, b.vy + K.G * dt);
      if (def.shoot) b.st2 = (b.st2 == null ? def.shoot : b.st2) - dt;
      // горизонталь
      var nx = b.x + b.vx * dt, s = b.vx > 0 ? 1 : -1, fx = Math.floor((nx + s * b.w) / T);
      if (isSolid(tileAt(W, fx, Math.floor((b.y - 2) / T))) || isSolid(tileAt(W, fx, Math.floor((b.y - b.h + 2) / T)))) { b.vx = 0; if (b.st === 'dash') { b.st = 'walk'; b.t = 1.2; ev('thud', { x: b.x, y: b.y }); } }
      else if (b.ground && !b.def) {
        var below = tileAt(W, fx, Math.floor(b.y / T)); if (!(isSolid(below) || isTop(below))) b.vx = 0; else b.x = nx;
      } else b.x = nx;
      if (!b.ground) {
        var y1 = b.y + b.vy * dt, row = Math.floor(y1 / T);
        if (b.vy > 0 && isSolid(tileAt(W, Math.floor(b.x / T), row))) { b.y = row * T; b.vy = 0; b.ground = true; b.st = 'walk'; ev('thud', { x: b.x, y: b.y }); }
        else b.y = y1;
      }
    }
    function bigContact(b, isBoss) {
      var P = S.hero;
      if (!b.alive) return;
      if (!overlap(P.x, P.y, K.HW, K.HH, b.x, b.y, b.w, b.h)) return;
      if (pogoHit(P, b.y - b.h, b.x, b.w)) {
        P.y = Math.min(P.y, b.y - b.h); bounce(P, ev, 'boss');
        if (b.inv <= 0) {
          b.hp--; b.inv = 0.7; ev(isBoss ? 'bossHit' : 'guardHit', { x: b.x, y: b.y - b.h, hp: b.hp });
          if (b.hp <= 0) killBig(b, isBoss);
        }
      } else hurt(b.x);
    }
    function killBig(b, isBoss) {
      b.alive = false;
      if (isBoss) {
        S.bag += PTS.boss; setArena(false); S.shots = [];
        var mid = (S.LV.arenaX + S.LV.w) / 2;
        S.keyDrop = { x: Math.floor(mid) * T + 8, y: (S.LV.h - 3) * T - 30, vy: 0, t: 0 };
        ev('bossDown', { x: b.x, y: b.y - b.h / 2, v: PTS.boss });
      } else {
        S.bag += PTS.guard;
        for (var y = 0; y < S.LV.h; y++) for (var x = 0; x < S.LV.w; x++) if (S.W.g[y][x] === 'X') S.W.g[y][x] = '.';
        ev('guardDown', { x: b.x, y: b.y - b.h / 2, v: PTS.guard });
      }
    }
    function update(dt) {
      if (!S) return;
      S.time += dt; S.phaseT += dt;
      if (S.phase === 'dead') { if (S.phaseT > 1.4) respawn(); return; }
      if (S.phase !== 'play') return;
      var P = S.hero, LV = S.LV, i;
      if (S.swing > 0) S.swing -= dt;
      if (swingReq) { swingReq = false; doSwing(); }
      heroStep(S.W, P, { dx: S.swing > 0.12 && P.ground ? 0 : inp.dx, dn: inp.dn, jump: inp.jump }, dt, heroEv);
      if (S.phase !== 'play') return;
      // предметы
      for (i = 0; i < LV.items.length; i++) {
        var it = LV.items[i]; if (S.got[it.id]) continue;
        var cx = it.tx * T + 8, cy = it.ty * T + 8;
        if (Math.abs(cx - P.x) < K.HW + 6 && cy + 6 > P.y - K.HH && cy - 6 < P.y) collect(it);
      }
      // флажки
      for (i = 0; i < LV.flags.length; i++) { var f = LV.flags[i]; if (i > S.cp && Math.abs(f.tx * T + 8 - P.x) < 12 && Math.abs((f.ty + 1) * T - P.y) < 30) { S.cp = i; S.hearts = K.HEARTS; ev('flag', { x: f.tx * T + 8, y: (f.ty + 1) * T }); } }
      // камни/сундуки
      S.objs.forEach(function (o) {
        if (!o.alive) return;
        if (o.fly) {
          o.vy = Math.min(K.FALL, o.vy + K.G * dt); o.air += dt;
          var nx = o.x + o.vx * dt, ny = o.y + o.vy * dt, tx = Math.floor((nx + (o.vx > 0 ? 6 : -6)) / T), ty = Math.floor((ny - 6) / T);
          if (isSolid(tileAt(S.W, tx, ty))) { if (breakTile(tx, ty)) { if (o.k === 'rock') { o.alive = false; return; } } if (o.k === 'chest') { burst(o); return; } o.vx = 0; }
          else o.x = nx;
          var below = tileAt(S.W, Math.floor(o.x / T), Math.floor(ny / T));
          if (o.vy > 0 && (isSolid(below) || isTop(below)) && o.air > 0.05) { o.y = Math.floor(ny / T) * T; if (o.k === 'chest') { burst(o); return; } o.fly = false; o.vx = 0; o.vy = 0; ev('thud', { x: o.x, y: o.y }); }
          else o.y = ny;
          if (o.y > LV.h * T + 30) { o.alive = false; return; }
          // камень в полёте бьёт врагов
          if (o.k === 'rock') {
            S.enemies.forEach(function (e) { if (e.alive && overlap(o.x, o.y, 7, 12, e.x, e.y, e.w, e.h)) { e.alive = false; S.kills++; S.bag += PTS.enemy; o.alive = false; ev('kill', { x: e.x, y: e.y - 6, v: PTS.enemy }); } });
            [S.guard, S.boss].forEach(function (b, bi) { if (o.alive && b && b.alive && overlap(o.x, o.y, 7, 12, b.x, b.y, b.w, b.h)) { o.alive = false; if (b.inv <= 0) { b.hp--; b.inv = 0.7; ev(bi ? 'bossHit' : 'guardHit', { x: b.x, y: b.y - b.h, hp: b.hp }); if (b.hp <= 0) killBig(b, bi === 1); } } });
          }
        } else if (overlap(P.x, P.y, K.HW, K.HH, o.x, o.y, 7, 12) && pogoHit(P, o.y - 12, o.x, 7)) {
          P.y = Math.min(P.y, o.y - 12); bounce(P, ev, o.k);
          if (o.k === 'chest') burst(o);
        }
      });
      // выпавшие самоцветы
      S.loot = S.loot.filter(function (g) {
        g.t += dt;
        if (!g.ground) { g.vy = Math.min(K.FALL, g.vy + K.G * dt); var ny = g.y + g.vy * dt, nx = g.x + g.vx * dt;
          if (isSolid(tileAt(S.W, Math.floor(nx / T), Math.floor(g.y / T)))) g.vx = 0; else g.x = nx;
          var ch = tileAt(S.W, Math.floor(g.x / T), Math.floor((ny + 4) / T));
          if (g.vy > 0 && (isSolid(ch) || isTop(ch))) { g.y = Math.floor((ny + 4) / T) * T - 4; g.ground = true; } else g.y = ny;
          if (g.y > LV.h * T + 30) return false; }
        if (g.t > 0.25 && Math.abs(g.x - P.x) < K.HW + 6 && g.y + 5 > P.y - K.HH && g.y - 5 < P.y) { S.bag += g.v; ev('gem', { x: g.x, y: g.y, v: g.v, big: g.v >= 500 }); return false; }
        return true;
      });
      // враги
      for (i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (!e.alive) continue;
        if (Math.abs(e.x - P.x) > 22 * T) continue;   // далеко — спит
        stepEnemy(e, dt);
        if (overlap(P.x, P.y, K.HW, K.HH, e.x, e.y, e.w, e.h)) {
          if (pogoHit(P, e.y - e.h, e.x, e.w)) { P.y = Math.min(P.y, e.y - e.h); bounce(P, ev, 'enemy'); e.alive = false; S.kills++; S.bag += PTS.enemy; ev('kill', { x: e.x, y: e.y - 6, v: PTS.enemy }); }
          else hurt(e.x);
        }
      }
      // страж
      var G = S.guard;
      if (G.alive) {
        if (!G.awake && Math.abs(G.x - P.x) < 12 * T) { G.awake = true; ev('guardWake', { x: G.x, y: G.y }); }
        if (G.awake) stepBig(G, GUARD, dt);
        bigContact(G, false);
      }
      // хозяин экспедиции
      var B = S.boss;
      if (B.alive) {
        if (!S.arena && P.x > (LV.arenaX + 3) * T) { S.arena = true; B.awake = true; setArena(true); ev('bossWake', { x: B.x, y: B.y, k: B.k }); }
        if (B.awake) stepBig(B, B.def, dt);
        bigContact(B, true);
      }
      // выстрелы
      S.shots = S.shots.filter(function (s) {
        s.x += s.vx * dt; s.y += s.vy * dt; s.t += dt;
        if (isSolid(tilePx(S.W, s.x, s.y)) || s.t > 4) return false;
        if (overlap(P.x, P.y, K.HW, K.HH, s.x, s.y + 4, 4, 8)) { hurt(s.x); return false; }
        return true;
      });
      // ключ Звездочёта
      if (S.keyDrop && !S.keyGot) {
        var kd = S.keyDrop; kd.t += dt;
        var floorY = (LV.h - 3) * T - 10; if (kd.y < floorY) { kd.vy += 600 * dt; kd.y = Math.min(floorY, kd.y + kd.vy * dt); }
        if (kd.t > 0.5 && Math.abs(kd.x - P.x) < 14 && kd.y + 8 > P.y - K.HH && kd.y - 8 < P.y) { S.keyGot = true; S.phase = 'clear'; S.phaseT = 0; ev('key', { x: kd.x, y: kd.y }); ev('clear', result(true)); }
      }
    }
    function result(won) {
      var taken = []; for (var k in S.got) if (S.got[k]) taken.push(isNaN(+k) ? k : +k);
      return { id: S.id, won: won, bag: S.bag, key: S.keyGot, item: S.gotItem, relic: S.gotRelic, taken: taken, lives: S.lives };
    }
    // отступить в лагерь: из мешка остаётся доля K.RETREAT
    function retreat() {
      if (!S || S.phase === 'over' || S.phase === 'clear') return null;
      var r = result(false); r.bag = Math.floor(S.bag * K.RETREAT / 100) * 100; r.lost = S.bag - r.bag; r.retreat = true;
      S.phase = 'idle'; ev('retreat', r);
      return r;
    }
    return {
      start: start, update: update, result: result, retreat: retreat,
      setInput: function (dx, dn, jump) { inp.dx = dx; inp.dn = !!dn; inp.jump = !!jump; },
      swing: function () { swingReq = true; },
      state: function () { return S; },
      // тестовые хуки
      _place: function (tx, ty) { S.hero = newHero(tx * T + 8, (ty + 1) * T); },
      _hurt: function (x) { hurt(x == null ? S.hero.x + 10 : x); },
      _die: function (w) { die(w || 'test'); },
      _killBoss: function () { killBig(S.boss, true); },
      _killGuard: function () { killBig(S.guard, false); },
      _doSwing: doSwing
    };
  }
  PS.Game = Game;
  PS.logic = { T: T, K: K, PTS: PTS, BOSS: BOSS, GUARD: GUARD, grid: grid, tileAt: tileAt, isSolid: isSolid, isTop: isTop, tilePx: tilePx, support: support,
    newHero: newHero, heroStep: heroStep, bounceV: bounceV, mulberry32: mulberry32, overlap: overlap };
})(typeof window !== 'undefined' ? window : globalThis);
