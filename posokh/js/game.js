/* ПОСОХ · логика экспедиции (без DOM, детерминирована при заданном rng). POSOKH.Game(opts), POSOKH.logic.
   Главная механика — ВЕХИ: Ярослава бросает полосатую геодезическую веху вперёд (с ↑ — вверх под 45°).
   Веха летит прямо; в мягкую породу (`=`) втыкается вбок и становится ступенькой-опорой (клетка `|`, опора сверху),
   от камня отскакивает и пропадает, треснувший камень ломает, по реперу (`Q`) снимает отметку, врага сбивает,
   стража и хозяина ранит. Воткнутых вех не больше трёх: четвёртая — и самая старая уходит обратно в связку.
   Физика героини — logic.heroStep(W, P, inp, dt, ev); полёт вехи — logic.stakeSub / logic.stakeRay: одни и те же
   функции и в игре, и в графе проходимости тестов. W = { LV, g: [ряды-массивы клеток] }. P.x — центр, P.y — подошвы. */
(function (global) {
  'use strict';
  var PS = global.POSOKH = global.POSOKH || {};
  var T = 16;
  var K = {
    HW: 5, HH: 24,
    G: 1400, JUMP: 440, CUT: -160, FALL: 560,          // прыжок ≈ 4,3 клетки
    RUN: 115, ACC: 1000, DEC: 1400, AIR: 800,
    COYOTE: 0.08, BUFFER: 0.12,
    HEARTS: 3, LIVES: 3, MAXLIVES: 9, INV: 1.2, HURT_V: 300,
    PEGS: 3,                 // воткнутых вех одновременно
    STAKE_COOL: 0.28,        // пауза между бросками
    STAKE_SUB: 3,            // подшагов полёта за кадр (1/60 с): по горизонтали 2 px, по диагонали 1,5 px по каждой оси
    STAKE_RANGE: 90,         // подшагов до падения (≈ 11 клеток по горизонтали)
    STAKE_DY: 22             // бросок от плеча: P.y − 22
  };
  var PTS = { gem: 50, big: 250, mark: 1000, boss: 3000, guard: 1000, enemy: 100 };
  // хозяева участков: hp, скорость, прыжок (раз в N с), рывок, полёт, выстрел
  var BOSS = {
    golem:  { hp: 5, w: 18, h: 30, walk: 38, leap: 2.6, leapV: 430 },
    toad:   { hp: 5, w: 18, h: 26, walk: 0, leap: 1.7, leapV: 400, shoot: 3.2 },
    lynx:   { hp: 5, w: 20, h: 24, walk: 52, dash: 3.0, dashV: 210 },
    petrel: { hp: 5, w: 20, h: 22, fly: 1, swoop: 2.8 },
    crab:   { hp: 6, w: 20, h: 24, walk: 44, leap: 4.2, leapV: 380, shoot: 2.4 }
  };
  var GUARD = { hp: 3, w: 14, h: 26, walk: 48, leap: 2.4, leapV: 380 };

  // ---------- клетки ----------
  function grid(LV) { return LV.t.map(function (s) { return s.split(''); }); }
  function tileAt(W, tx, ty) { if (tx < 0 || tx >= W.LV.w) return '#'; if (ty < 0) return W.LV.ceil ? '#' : '.'; if (ty >= W.LV.h) return '.'; return W.g[ty][tx]; }
  function isSolid(ch) { return ch === '#' || ch === '^' || ch === 'c' || ch === 'X' || ch === 'A' || ch === '=' || ch === 'Q' || ch === 'q'; }
  function isTop(ch) { return ch === '-' || ch === '|'; }
  function isSoft(ch) { return ch === '='; }
  function tilePx(W, x, y) { return tileAt(W, Math.floor(x / T), Math.floor(y / T)); }
  function newHero(x, y) { return { x: x, y: y, vx: 0, vy: 0, ground: true, face: 1, coy: 0, buf: 0, jprev: false, jumping: false, inv: 0, on: '#' }; }
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
  // inp = { dx: -1|0|1, jump: прыжок зажат }
  function heroStep(W, P, inp, dt, ev) {
    var dx = inp.dx || 0;
    if (dx) P.face = dx;
    var jp = !!inp.jump && !P.jprev; P.jprev = !!inp.jump;
    if (jp) P.buf = K.BUFFER; else if (P.buf > 0) P.buf -= dt;
    if (P.ground) P.coy = K.COYOTE; else if (P.coy > 0) P.coy -= dt;
    if (P.buf > 0 && (P.ground || P.coy > 0)) { P.vy = -K.JUMP; P.ground = false; P.coy = 0; P.buf = 0; P.jumping = true; if (ev) ev('jump', { x: P.x, y: P.y }); }
    if (!inp.jump && P.jumping && P.vy < K.CUT) P.vy = K.CUT;
    if (P.vy >= 0) P.jumping = false;
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
        else if (hit) { var v = P.vy; P.vy = 0; P.ground = true; P.on = hit; if (ev) ev('land', { v: v, x: P.x, y: P.y }); }
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

  // ---------- полёт вехи ----------
  // s = { x, y, ux: ±1, uy: 0|−1, n: подшагов пройдено }. Подшаг: x на ux·(uy ? 1,5 : 2), проверка; затем y на uy·1,5, проверка.
  // → null (летит дальше) или { k: 'peg'|'mark'|'crack'|'clink'|'far', tx, ty } — где и чем кончился полёт.
  function newStake(P, up) { return { x: P.x + P.face * 4, y: P.y - K.STAKE_DY, ux: P.face, uy: up ? -1 : 0, n: 0 }; }
  function stakeSub(W, s) {
    s.n++;
    var step = s.uy ? 1.5 : 2;
    var px = s.x, ptx = Math.floor(px / T), pty = Math.floor(s.y / T);
    s.x += s.ux * step;
    var tx = Math.floor(s.x / T);
    if (tx !== ptx) {
      var ch = tileAt(W, tx, pty);
      if (isSolid(ch)) {
        if (ch === '=' && tileAt(W, ptx, pty) === '.' && pty >= 0 && pty < W.LV.h) return { k: 'peg', tx: ptx, ty: pty };
        if (ch === 'c') return { k: 'crack', tx: tx, ty: pty };
        if (ch === 'Q') return { k: 'mark', tx: tx, ty: pty };
        return { k: 'clink', tx: tx, ty: pty };
      }
    }
    if (s.uy) {
      var py = s.y; s.y += s.uy * 1.5;
      var ty = Math.floor(s.y / T);
      if (ty !== Math.floor(py / T)) {
        var c2 = tileAt(W, tx, ty);
        if (isSolid(c2)) {
          if (c2 === 'c') return { k: 'crack', tx: tx, ty: ty };
          if (c2 === 'Q') return { k: 'mark', tx: tx, ty: ty };
          return { k: 'clink', tx: tx, ty: ty };
        }
      }
    }
    if (s.n >= K.STAKE_RANGE || s.x < 0 || s.x > W.LV.w * T || s.y < -T) return { k: 'far', tx: tx, ty: Math.floor(s.y / T) };
    return null;
  }
  // полёт целиком (прицел, граф проходимости): → { k, tx, ty, x, y, n }
  function stakeRay(W, P, up) {
    var s = newStake(P, up), r = null;
    while (!r) r = stakeSub(W, s);
    r.x = s.x; r.y = s.y; r.n = s.n;
    return r;
  }

  // ---------- rng ----------
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function overlap(ax, ay, aw, ah, bx, by, bw, bh) { return Math.abs(ax - bx) < aw + bw && ay - ah < by && by - bh < ay; }

  // ---------- экспедиция ----------
  // opts: { rng, onEvent(type,data), god — без урона (тесты) }
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, emit = opts.onEvent || function () {};
    var S = null, inp = { dx: 0, up: false, jump: false }, throwReq = false;
    function ev(t, d) { emit(t, d || {}); }
    // carry: { marks:[id] (уже снятые реперы участка), lives, score }
    function start(id, carry) {
      carry = carry || {};
      var LV = PS.levels.build(id), W = { LV: LV, g: grid(LV) };
      var marks = {}; (carry.marks || []).forEach(function (i) { marks[i] = 1; });
      LV.marks.forEach(function (m) { if (marks[m.id]) W.g[m.ty][m.tx] = 'q'; });
      S = {
        id: id, LV: LV, W: W, phase: 'play', phaseT: 0, time: 0,
        lives: carry.lives != null ? carry.lives : K.LIVES, hearts: K.HEARTS, score: carry.score || 0, gain: 0,
        hero: null, got: {}, cp: -1, marks: marks, newMarks: [],
        enemies: [], darts: [], pegs: [], shots: [], guard: null, boss: null, sign: null, signGot: false,
        cool: 0, kills: 0, deaths: 0, hurts: 0, throws: 0, arena: false, over: false
      };
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
      if (!S.guard || S.guard.alive) S.guard = { k: 'guard', x: gd.tx * T + 8, y: (gd.ty + 1) * T, vx: -GUARD.walk, vy: 0, ground: true, alive: true, hp: GUARD.hp, inv: 0, t: 0, w: GUARD.w, h: GUARD.h, awake: false };
      var bd = LV.bossAt, B = BOSS[LV.boss];
      if (!S.boss || S.boss.alive) S.boss = { k: LV.boss, def: B, x: bd.tx * T + 8, y: (bd.ty + 1) * T, vx: 0, vy: 0, ground: true, alive: true, hp: B.hp, inv: 0, t: 1.2, st: 'idle', w: B.w, h: B.h, awake: false, face: -1, fy: 0 };
      S.shots = []; S.darts = [];
      clearPegs();
      S.arena = false; setArena(false);
    }
    function clearPegs() { S.pegs.forEach(function (p) { if (S.W.g[p.ty][p.tx] === '|') S.W.g[p.ty][p.tx] = '.'; }); S.pegs = []; }
    function setArena(on) { var g = S.W.g; for (var y = 0; y < S.LV.h; y++) for (var x = 0; x < S.LV.w; x++) { if (on && g[y][x] === 'a') g[y][x] = 'A'; else if (!on && g[y][x] === 'A') g[y][x] = 'a'; } }
    function placeHero() {
      var LV = S.LV, at = S.cp >= 0 ? LV.flags[S.cp] : LV.start;
      S.hero = newHero(at.tx * T + 8, (at.ty + 1) * T);
      S.hero.inv = 1;
    }
    function add(v) { S.score += v; S.gain += v; }
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
      if (opts.god && why !== 'fall' && why !== 'drown' && why !== 'test') return;
      S.lives--; S.deaths++; S.phase = S.lives > 0 ? 'dead' : 'over'; S.phaseT = 0;
      ev('die', { why: why, x: S.hero.x, y: S.hero.y });
      if (S.phase === 'over') { S.over = true; ev('gameover', {}); }
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
    function collect(it) {
      if (S.got[it.id]) return;
      S.got[it.id] = 1;
      var x = it.tx * T + 8, y = it.ty * T + 8;
      switch (it.k) {
        case 'gem': add(PTS.gem); ev('gem', { x: x, y: y, v: PTS.gem }); break;
        case 'big': add(PTS.big); ev('gem', { x: x, y: y, v: PTS.big, big: true }); break;
        case 'pie': S.hearts = Math.min(K.HEARTS, S.hearts + 1); ev('pie', { x: x, y: y }); break;
        case 'life': S.lives = Math.min(K.MAXLIVES, S.lives + 1); ev('life', { x: x, y: y }); break;
      }
    }
    // ---------- вехи ----------
    function doThrow() {
      var P = S.hero;
      if (S.cool > 0 || S.phase !== 'play' || S.darts.length) return false;
      S.cool = K.STAKE_COOL; S.throws++;
      var d = newStake(P, inp.up); S.darts.push(d);
      ev('throw', { x: d.x, y: d.y, up: !!inp.up, face: P.face });
      return true;
    }
    function stick(tx, ty) {
      S.W.g[ty][tx] = '|';
      S.pegs.push({ tx: tx, ty: ty, face: tileAt(S.W, tx + 1, ty) === '=' ? 1 : -1, t: S.time });
      ev('peg', { x: tx * T + 8, y: ty * T + 2, n: S.pegs.length });
      while (S.pegs.length > K.PEGS) { var o = S.pegs.shift(); if (S.W.g[o.ty][o.tx] === '|') S.W.g[o.ty][o.tx] = '.'; ev('unpeg', { x: o.tx * T + 8, y: o.ty * T + 2 }); }
    }
    function dartEnd(d, r) {
      var x = d.x, y = d.y;
      if (r.k === 'peg') stick(r.tx, r.ty);
      else if (r.k === 'crack') {   // треснувший столбик осыпается целиком
        var y0 = r.ty, y1 = r.ty; while (tileAt(S.W, r.tx, y0 - 1) === 'c') y0--; while (tileAt(S.W, r.tx, y1 + 1) === 'c') y1++;
        for (var cy = y0; cy <= y1; cy++) S.W.g[cy][r.tx] = '.';
        ev('crack', { x: r.tx * T + 8, y: r.ty * T + 8, n: y1 - y0 + 1 });
      }
      else if (r.k === 'mark') {
        var m = S.LV.marks.filter(function (q) { return q.tx === r.tx && q.ty === r.ty; })[0];
        S.W.g[r.ty][r.tx] = 'q';
        if (m && !S.marks[m.id]) { S.marks[m.id] = 1; S.newMarks.push(m.id); add(PTS.mark); ev('mark', { x: r.tx * T + 8, y: r.ty * T + 8, v: PTS.mark, n: Object.keys(S.marks).length }); }
      } else if (r.k === 'clink') ev('clink', { x: x, y: y });
      else ev('drop', { x: x, y: y });
    }
    function dartHits(d) {
      var i, e;
      for (i = 0; i < S.enemies.length; i++) { e = S.enemies[i]; if (e.alive && overlap(d.x, d.y + 3, 3, 6, e.x, e.y, e.w, e.h)) { e.alive = false; S.kills++; add(PTS.enemy); ev('kill', { x: e.x, y: e.y - 6, v: PTS.enemy }); return true; } }
      var bs = [S.guard, S.boss];
      for (i = 0; i < 2; i++) { var b = bs[i]; if (b && b.alive && overlap(d.x, d.y + 3, 3, 6, b.x, b.y, b.w, b.h)) { if (b.inv <= 0) { b.hp--; b.inv = 0.45; if (!(b.def && b.def.fly)) { b.t = Math.max(b.t, 0.8); if (b.st2 != null) b.st2 = Math.max(b.st2, 0.8); } ev(i ? 'bossHit' : 'guardHit', { x: b.x, y: b.y - b.h, hp: b.hp }); if (b.hp <= 0) killBig(b, i === 1); } else ev('parry', { x: d.x, y: d.y }); return true; } }
      return false;
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
        b.ground = false;
        if (b.st === 'idle' || b.st === 'hover') {
          b.st = 'hover';
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
          b.vx = def.walk && b.inv <= 0.2 ? dir * def.walk : 0;   // попала веха — миг замирает
          if (b.t <= 0) {
            if (def.leap && (!def.dash || rng() < 0.5)) { b.vy = -def.leapV; b.vx = dir * 90; b.ground = false; b.t = def.leap; b.st = 'leap'; ev('leap', { x: b.x, y: b.y }); }
            else if (def.dash) { b.st = 'dash'; b.vx = dir * def.dashV; b.t = def.dash; ev('dash', { x: b.x, y: b.y }); }
            else b.t = 1;
          }
        }
        if (def.shoot && (b.st2 || 0) <= 0 && b.awake !== false) { b.st2 = def.shoot; S.shots.push({ x: b.x + b.face * b.w, y: b.y - b.h * 0.55, vx: b.face * 130, vy: 0, t: 0 }); ev('shoot', { x: b.x, y: b.y }); }
      } else b.vy = Math.min(K.FALL, b.vy + K.G * dt);
      if (def.shoot) b.st2 = (b.st2 == null ? def.shoot : b.st2) - dt;
      var nx = b.x + b.vx * dt, s = b.vx > 0 ? 1 : -1, fx = Math.floor((nx + s * b.w) / T);
      if (isSolid(tileAt(W, fx, Math.floor((b.y - 2) / T))) || isSolid(tileAt(W, fx, Math.floor((b.y - b.h + 2) / T)))) { b.vx = 0; if (b.st === 'dash') { b.st = 'walk'; b.t = 1.2; ev('thud', { x: b.x, y: b.y }); } }
      else b.x = nx;
      if (!b.ground) {
        var y1 = b.y + b.vy * dt, row = Math.floor(y1 / T);
        if (b.vy > 0 && isSolid(tileAt(W, Math.floor(b.x / T), row))) { b.y = row * T; b.vy = 0; b.ground = true; b.st = 'walk'; ev('thud', { x: b.x, y: b.y }); }
        else b.y = y1;
      }
    }
    function bigContact(b) { var P = S.hero; if (b.alive && overlap(P.x, P.y, K.HW, K.HH, b.x, b.y, b.w, b.h)) hurt(b.x); }
    function killBig(b, isBoss) {
      b.alive = false;
      if (isBoss) {
        add(PTS.boss); setArena(false); S.shots = [];
        var mid = (S.LV.arenaX + S.LV.w) / 2;
        S.sign = { x: Math.floor(mid) * T + 8, y: (S.LV.h - 3) * T - 30, vy: 0, t: 0 };
        ev('bossDown', { x: b.x, y: b.y - b.h / 2, v: PTS.boss });
      } else {
        add(PTS.guard);
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
      if (S.cool > 0) S.cool -= dt;
      if (throwReq) { throwReq = false; doThrow(); }
      heroStep(S.W, P, inp, dt, heroEv);
      if (S.phase !== 'play') return;
      // летящие вехи
      S.darts = S.darts.filter(function (d) {
        for (var k = 0; k < K.STAKE_SUB; k++) {
          var r = stakeSub(S.W, d);
          if (dartHits(d)) return false;
          if (r) { dartEnd(d, r); return false; }
        }
        return true;
      });
      for (i = 0; i < LV.items.length; i++) {
        var it = LV.items[i]; if (S.got[it.id]) continue;
        var cx = it.tx * T + 8, cy = it.ty * T + 8;
        if (Math.abs(cx - P.x) < K.HW + 6 && cy + 6 > P.y - K.HH && cy - 6 < P.y) collect(it);
      }
      for (i = 0; i < LV.flags.length; i++) { var f = LV.flags[i]; if (i > S.cp && Math.abs(f.tx * T + 8 - P.x) < 12 && Math.abs((f.ty + 1) * T - P.y) < 30) { S.cp = i; S.hearts = K.HEARTS; ev('flag', { x: f.tx * T + 8, y: (f.ty + 1) * T }); } }
      for (i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (!e.alive) continue;
        if (Math.abs(e.x - P.x) > 22 * T) continue;
        stepEnemy(e, dt);
        if (overlap(P.x, P.y, K.HW, K.HH, e.x, e.y, e.w, e.h)) hurt(e.x);
      }
      var G = S.guard;
      if (G.alive) {
        if (!G.awake && Math.abs(G.x - P.x) < 12 * T) { G.awake = true; ev('guardWake', { x: G.x, y: G.y }); }
        if (G.awake) stepBig(G, GUARD, dt);
        bigContact(G);
      }
      var B = S.boss;
      if (B.alive) {
        if (!S.arena && P.x > (LV.arenaX + 3) * T) { S.arena = true; B.awake = true; setArena(true); ev('bossWake', { x: B.x, y: B.y, k: B.k }); }
        if (B.awake) stepBig(B, B.def, dt);
        bigContact(B);
      }
      S.shots = S.shots.filter(function (s) {
        s.x += s.vx * dt; s.y += s.vy * dt; s.t += dt;
        if (isSolid(tilePx(S.W, s.x, s.y)) || s.t > 4) return false;
        if (overlap(P.x, P.y, K.HW, K.HH, s.x, s.y + 4, 4, 8)) { hurt(s.x); return false; }
        return true;
      });
      // тригопункт участка — появляется после хозяина
      if (S.sign && !S.signGot) {
        var sg = S.sign; sg.t += dt;
        var floorY = (LV.h - 3) * T - 10; if (sg.y < floorY) { sg.vy += 600 * dt; sg.y = Math.min(floorY, sg.y + sg.vy * dt); }
        if (sg.t > 0.5 && Math.abs(sg.x - P.x) < 14 && sg.y + 8 > P.y - K.HH && sg.y - 8 < P.y) { S.signGot = true; S.phase = 'clear'; S.phaseT = 0; ev('sign', { x: sg.x, y: sg.y }); ev('clear', result(true)); }
      }
    }
    function result(won) {
      var m = []; for (var k in S.marks) if (S.marks[k]) m.push(+k);
      return { id: S.id, won: won, score: S.score, gain: S.gain, marks: m.sort(), newMarks: S.newMarks.slice(), lives: S.lives };
    }
    var api = {
      start: start, update: update, result: result,
      setInput: function (dx, up, jump) { inp.dx = dx; inp.up = !!up; inp.jump = !!jump; },
      throwStake: function () { throwReq = true; },
      state: function () { return S; },
      // площадка: «ещё один шанс» за рекламу — после последней жизни встать с 1 жизнью у привала; бонус в паузе — +1 жизнь
      reviveAd: function () { if (!S || S.phase !== 'over') return false; S.over = false; S.lives = 1; S.phase = 'dead'; respawn(); ev('continue', { ad: true }); return true; },
      canBoost: function () { return !!S && !S.over && S.lives < K.MAXLIVES && (S.phase === 'play' || S.phase === 'dead'); },
      boost: function () { if (!api.canBoost()) return false; S.lives++; ev('life', { lives: S.lives, x: S.hero.x, y: S.hero.y - 30 }); return true; },
      // тестовые хуки
      _place: function (tx, ty) { S.hero = newHero(tx * T + 8, (ty + 1) * T); return api; },
      _hurt: function (x) { hurt(x == null ? S.hero.x + 10 : x); },
      _die: function (w) { die(w || 'test'); },
      _killBoss: function () { killBig(S.boss, true); },
      _killGuard: function () { killBig(S.guard, false); },
      _throw: doThrow
    };
    return api;
  }
  PS.Game = Game;
  PS.logic = { T: T, K: K, PTS: PTS, BOSS: BOSS, GUARD: GUARD, grid: grid, tileAt: tileAt, isSolid: isSolid, isTop: isTop, isSoft: isSoft, tilePx: tilePx, support: support,
    newHero: newHero, heroStep: heroStep, newStake: newStake, stakeSub: stakeSub, stakeRay: stakeRay, mulberry32: mulberry32, overlap: overlap };
})(typeof window !== 'undefined' ? window : globalThis);
