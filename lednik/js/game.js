/* ЛЕДНИК · логика уровня (без DOM, детерминирована при заданном rng). LEDNIK.Game(opts), LEDNIK.logic.
   Физика героя — L.heroStep(W, P, inp, dt, ev): одна функция и для игры, и для графа проходимости в тестах
   (W = { LV, br — состояние ледяных мостов или null, time, wind — учитывать ли ветер }).
   Координаты — пиксели мира; P.x — центр, P.y — подошвы. Клетка 16 px. */
(function (global) {
  'use strict';
  var LD = global.LEDNIK = global.LEDNIK || {};
  var T = 16;
  var K = {
    HW: 5, HH: 22, HL: 12,                         // полуширина, рост, рост в подкате
    G: 1500, JUMP: 480, CUT: -170, FALL: 520,       // прыжок ≈ 4,8 клетки
    RUN: 125, ACC: 1100, DEC: 1500, TURN: 2200, AIR: 700, DRAG: 120,
    ICE_MAX: 185, ICE_ACC: 260, ICE_DEC: 130, ICE_TURN: 420,
    SLIDE: 230, SLIDE_DEC: 420, SLIDE_DEC_ICE: 50, SLIDE_MIN: 55, CRAWL: 55,
    DRIFT_MAX: 48, DRIFT_FALL: 45, DRIFT_JUMP: 330,
    CLIMB: 85, COYOTE: 0.08, BUFFER: 0.12,
    BOUNCE: 330, MAM_BOUNCE: 640, WIND_G: 55, WIND_ICE: 100, WIND_AIR: 80,
    BRIDGE_T: 1.6, BRIDGE_BACK: 4,
    BOOM_V: 300, BOOM_DEC: 470, BOOM_BACK: 330,
    FOX_V: 170, FOX_BACK: 230, FOX_RANGE: 12,
    HEARTS: 3, LIVES: 3, INV: 1.3, STUN: 3
  };
  var PTS = { sup: 50, key: 500, heart: 100, flee: 100, camp: 100, clear: 500, full: 2000, boss: 3000 };

  // ---------- клетки ----------
  function tileAt(LV, tx, ty) { if (tx < 0 || tx >= LV.w) return '#'; if (ty < 0 || ty >= LV.h) return '.'; return LV.t[ty].charAt(tx); }
  function isSolid(ch) { return ch === '#' || ch === '=' || ch === '%'; }
  function bridgeBroken(W, tx, ty) { var b = W.br && W.br[ty * W.LV.w + tx]; return !!(b && b.b > 0); }
  function isTop(W, tx, ty) {
    var ch = tileAt(W.LV, tx, ty);
    if (ch === 'T') return true;
    if (ch === '-') return !bridgeBroken(W, tx, ty);
    if (ch === '|') return tileAt(W.LV, tx, ty - 1) !== '|';
    return false;
  }
  function solidPx(LV, x, y) { return isSolid(tileAt(LV, Math.floor(x / T), Math.floor(y / T))); }
  function tilePx(LV, x, y) { return tileAt(LV, Math.floor(x / T), Math.floor(y / T)); }
  function heightOf(P) { return P.low ? K.HL : K.HH; }
  function newHero(x, y) { return { x: x, y: y, vx: 0, vy: 0, ground: true, ice: false, drift: false, face: 1, low: false, slide: false, climb: false, coyote: 0, buf: 0, jprev: false, cut: false, airMax: 0, inv: 0, wall: 0, sim: false }; }
  // есть ли место встать в полный рост
  function canStand(LV, P) {
    for (var x = P.x - K.HW + 0.5; x <= P.x + K.HW - 0.5; x += K.HW * 2 - 1) if (solidPx(LV, x, P.y - K.HH + 0.5)) return false;
    return !solidPx(LV, P.x, P.y - K.HH + 0.5);
  }
  // опора под ногами: 0 — нет, иначе символ клетки опоры (для льда)
  function support(W, P) {
    var LV = W.LV, ty = Math.round(P.y / T);
    if (Math.abs(P.y - ty * T) > 0.05) return 0;
    var best = 0, xs = [P.x, P.x - K.HW + 0.5, P.x + K.HW - 0.5];
    for (var i = 0; i < 3; i++) {
      var tx = Math.floor(xs[i] / T), ch = tileAt(LV, tx, ty);
      if (isSolid(ch) || (!P.climb && isTop(W, tx, ty))) { if (i === 0) return ch; if (!best) best = ch; }
    }
    return best;
  }
  function windAt(W, x, y) {
    if (W.gust) return W.gust;
    if (!W.wind || !W.LV.wind.length) return 0;
    for (var i = 0; i < W.LV.wind.length; i++) {
      var z = W.LV.wind[i];
      if (x >= z.x0 && x < z.x1 && gustOn(z, W.time)) return z.dir;
    }
    return 0;
  }
  function gustOn(z, t) { var ph = ((t + z.phase) % z.period) / z.period; return ph < z.on; }

  // ---------- физика героя ----------
  function moveX(LV, P, dx) {
    if (!dx) return;
    var h = heightOf(P), x1 = P.x + dx, s = dx > 0 ? 1 : -1;
    var fx = x1 + s * K.HW, tx = Math.floor((s > 0 ? fx - 0.001 : fx) / T);
    for (var y = P.y - h + 0.5; ; y += T) {
      var yy = Math.min(y, P.y - 0.5);
      if (isSolid(tileAt(LV, tx, Math.floor(yy / T)))) { P.x = s > 0 ? tx * T - K.HW : (tx + 1) * T + K.HW; P.vx = 0; P.wall = s; return; }
      if (yy >= P.y - 0.5) break;
    }
    P.x = x1;
  }
  function moveY(W, P, dy) {
    if (!dy) return false;
    var LV = W.LV, h = heightOf(P), y0 = P.y, y1 = y0 + dy, xs = [P.x - K.HW + 0.5, P.x + K.HW - 0.5], i, tx;
    if (dy > 0) {
      var r0 = Math.ceil(y0 / T - 0.001), r1 = Math.floor(y1 / T);
      for (var ty = r0; ty <= r1; ty++) {
        for (i = 0; i < 2; i++) {
          tx = Math.floor(xs[i] / T);
          var ch = tileAt(LV, tx, ty);
          if (isSolid(ch) || (!P.climb && !P.drop && isTop(W, tx, ty))) { P.y = ty * T; P.vy = 0; return true; }
        }
      }
      P.y = y1; return false;
    }
    var hr = Math.floor((y1 - h) / T);
    if (hr < Math.floor((y0 - h) / T) || hr === Math.floor((y0 - h) / T)) {
      for (i = 0; i < 2; i++) { tx = Math.floor(xs[i] / T); if (isSolid(tileAt(LV, tx, hr)) && (y1 - h) < (hr + 1) * T) { P.y = (hr + 1) * T + h; P.vy = 0; P.bonk = true; return false; } }
    }
    P.y = y1; return false;
  }
  function columnAt(LV, P) {   // столбик-сосулька на уровне тела героя → x центра столбика или null
    var tx = Math.floor(P.x / T);
    for (var y = P.y - 2; y >= P.y - 14; y -= 6) if (tileAt(LV, tx, Math.floor(y / T)) === '|') return tx * T + 8;
    return null;
  }
  function columnBelow(W, P) { var tx = Math.floor(P.x / T), ty = Math.round(P.y / T); return Math.abs(P.y - ty * T) < 0.05 && tileAt(W.LV, tx, ty) === '|' && tileAt(W.LV, tx, ty - 1) !== '|' ? tx * T + 8 : null; }

  // inp: { dx, dy, jump } (jump — кнопка зажата); ev(type, data) — события (или null)
  function heroStep(W, P, inp, dt, ev) {
    var LV = W.LV, dx = inp.dx | 0, dy = inp.dy | 0, jp = !!inp.jump && !P.jprev;
    P.jprev = !!inp.jump; P.wall = 0; P.bonk = false;
    if (jp) P.buf = K.BUFFER; else if (P.buf > 0) P.buf -= dt;
    if (dx) P.face = dx;
    var sup = support(W, P);
    P.ground = !!sup && P.vy >= 0;
    P.ice = sup === '=';
    var ft = tilePx(LV, P.x, P.y - 2), bt = tilePx(LV, P.x, P.y - 12);
    P.drift = ft === 's' || bt === 's';
    if (P.ground) P.coyote = K.COYOTE; else if (P.coyote > 0) P.coyote -= dt;

    // --- лазанье по сосулькам ---
    if (!P.climb && !P.low) {
      var cx = columnAt(LV, P);
      if (dy < 0 && cx != null) { P.climb = true; P.x = cx; P.vx = 0; P.vy = 0; if (ev) ev('climb'); }
      else if (dy > 0 && P.ground) { var cb = columnBelow(W, P); if (cb != null) { P.climb = true; P.x = cb; P.vx = 0; P.y += 2; P.ground = false; } }
    }
    if (P.climb) {
      P.vx = 0;
      if (P.buf > 0) {   // прыжок со столбика
        P.climb = false; P.buf = 0; P.vy = -K.JUMP * 0.78; P.vx = dx * K.RUN; P.cut = true; P.airMax = K.RUN; if (ev) ev('jump');
      } else {
        var col = columnAt(LV, P);
        P.vy = dy * K.CLIMB;
        if (col == null) { P.climb = false; }
        else {
          var steps = Math.max(1, Math.ceil(Math.abs(P.vy * dt) / 4));
          for (var s = 0; s < steps; s++) moveY(W, P, P.vy * dt / steps);
          // поднялся выше верха столбика — встал на него
          var tx = Math.floor(P.x / T), ty = Math.floor((P.y - 1) / T);
          if (dy < 0 && tileAt(LV, tx, ty) !== '|' && tileAt(LV, tx, ty + 1) === '|') { P.y = (ty + 1) * T; P.climb = false; P.vy = 0; P.ground = true; }
          if (dy > 0 && support(W, { x: P.x, y: P.y, climb: true }) && !isTop(W, tx, Math.round(P.y / T))) { P.climb = false; P.ground = true; }
          if (columnAt(LV, P) == null && P.climb) P.climb = false;
          return finish(W, P, ev);
        }
      }
    }

    // --- подкат ---
    if (P.ground && dy > 0 && !P.slide && !P.low && !P.drift && (Math.abs(P.vx) > 40 || dx)) {
      var sd = dx || (P.vx > 0 ? 1 : P.vx < 0 ? -1 : P.face);
      P.slide = true; P.low = true; P.vx = sd * Math.max(Math.abs(P.vx), K.SLIDE); P.face = sd; if (ev) ev('slide');
    } else if (P.ground && dy > 0 && !P.slide && !dx) P.low = true;
    if (P.slide) {
      if (P.ground) { var dec = P.ice ? K.SLIDE_DEC_ICE : K.SLIDE_DEC, sg = P.vx > 0 ? 1 : -1; P.vx -= sg * dec * dt; if (P.vx * sg < 0) P.vx = 0; }
      if (Math.abs(P.vx) < K.SLIDE_MIN) { P.slide = false; }
    }
    if (!P.slide && P.low && !(P.ground && dy > 0) && canStand(LV, P)) P.low = false;
    var crawl = P.low && !P.slide;

    // --- прыжок ---
    if (P.buf > 0 && (P.ground || P.coyote > 0) && (!P.low || P.slide || crawl) && (!P.low || canStand(LV, P))) {
      P.vy = -(P.drift ? K.DRIFT_JUMP : K.JUMP); P.ground = false; P.coyote = 0; P.buf = 0; P.cut = true;
      P.slide = false; P.low = false; P.airMax = Math.abs(P.vx); if (ev) ev('jump', { x: P.x, y: P.y });
    }
    if (!inp.jump && P.cut && P.vy < K.CUT) P.vy = K.CUT;

    // --- горизонталь ---
    if (P.slide) { /* скорость задана подкатом */ }
    else if (crawl) { P.vx = dx * K.CRAWL; }
    else if (P.ground) {
      var max = P.drift ? K.DRIFT_MAX : P.ice ? K.ICE_MAX : K.RUN, acc = P.ice ? K.ICE_ACC : K.ACC, de = P.ice ? K.ICE_DEC : K.DEC;
      if (dx) {
        if (P.vx * dx < 0) P.vx += dx * (P.ice ? K.ICE_TURN : K.TURN) * dt;
        else if (Math.abs(P.vx) < max) { P.vx += dx * acc * dt; if (Math.abs(P.vx) > max) P.vx = dx * max; }
        else { P.vx -= dx * de * dt; if (Math.abs(P.vx) < max) P.vx = dx * max; }
      } else { var sv = P.vx > 0 ? 1 : -1; P.vx -= sv * de * dt; if (P.vx * sv < 0) P.vx = 0; }
      if (P.drift && Math.abs(P.vx) > K.DRIFT_MAX) P.vx = (P.vx > 0 ? 1 : -1) * K.DRIFT_MAX;
    } else {
      var am = Math.max(K.RUN, P.airMax || 0);
      if (dx) { P.vx += dx * K.AIR * dt; if (Math.abs(P.vx) > am) P.vx = (P.vx > 0 ? 1 : -1) * am; }
      else { var sa = P.vx > 0 ? 1 : -1; P.vx -= sa * K.DRAG * dt; if (P.vx * sa < 0) P.vx = 0; }
      if (P.drift && Math.abs(P.vx) > K.DRIFT_MAX) P.vx = (P.vx > 0 ? 1 : -1) * K.DRIFT_MAX;
    }
    var wd = windAt(W, P.x, P.y), wv = wd ? wd * (P.ground ? (P.ice ? K.WIND_ICE : K.WIND_G) : K.WIND_AIR) : 0;
    if (P.ground && P.low && !P.slide) wv = 0;   // пригнулась — ветер не сдвинет
    P.windV = wv;

    // --- вертикаль ---
    if (!P.ground) { P.vy += K.G * dt; var mf = P.drift ? K.DRIFT_FALL : K.FALL; if (P.vy > mf) P.vy = mf; }
    else if (P.vy > 0) P.vy = 0;
    if (P.ground && P.vy === 0) P.vy = 1;   // прижим к опоре (сход с края — сразу падение)

    var n = Math.max(1, Math.ceil(Math.max(Math.abs(P.vx), Math.abs(P.vy)) * dt / 4));
    var wasAir = !P.ground, vyIn = P.vy, landed = false;
    for (var k = 0; k < n; k++) {
      moveX(LV, P, (P.vx + wv) * dt / n);
      if (moveY(W, P, P.vy * dt / n)) landed = true;
    }
    if (P.wall && P.slide) P.slide = false;
    if (landed && wasAir && ev) ev('land', { v: vyIn, x: P.x, y: P.y });
    P.drop = false;
    return finish(W, P, ev);
  }
  function finish(W, P, ev) {
    var sup = support(W, P);
    P.ground = !!sup && P.vy >= 0 && !P.climb;
    if (P.ground) { P.vy = 0; P.ice = sup === '='; P.airMax = Math.abs(P.vx); }
    // мост: трескается под ногами
    if (W.br && P.ground) {
      var ty = Math.round(P.y / T);
      for (var x = P.x - K.HW + 0.5; x <= P.x + K.HW; x += K.HW * 2 - 1) {
        var tx = Math.floor(x / T);
        if (tileAt(W.LV, tx, ty) === '-') {
          var id = ty * W.LV.w + tx, b = W.br[id] || (W.br[id] = { c: 0, b: 0, touched: false });
          if (b.b <= 0) { b.touched = true; }
        }
      }
    }
    return P;
  }

  // ---------- игра ----------
  function Game(opts) {
    opts = opts || {};
    var onEvent = opts.onEvent || function () {};
    var rng = opts.rng || Math.random;
    var S = null;

    function ev(t, d) { onEvent(t, d || {}); }
    function newRun() { S = { score: 0, lives: K.LIVES, hearts: K.HEARTS, phase: 'idle', time: 0, LV: null }; return S; }
    function W() { return S.W; }

    function startLevel(id, carry) {
      if (!S) newRun();
      if (carry) { if (carry.score != null) S.score = carry.score; if (carry.lives != null) S.lives = carry.lives; }
      var LV = LD.levels.build(id);
      S.LV = LV; S.id = id; S.time = 0; S.phase = 'play'; S.phaseT = 0; S.hearts = K.HEARTS;
      S.got = {}; S.sup = 0; S.keyGot = false; S.revealed = {}; S.cp = null; S.lit = {};
      S.br = {}; S.W = { LV: LV, br: S.br, time: 0, wind: true };
      S.boom = null; S.fox = null; S.foxCd = 0; S.shots = []; S.needCd = 0; S.kills = 0; S.deaths = 0; S.full = false;
      S.enemies = LV.enemies.map(function (e, i) { return mkEnemy(e, i); });
      S.boss = LV.boss ? mkBoss(LV.boss, LV) : null;
      spawn(LV.start.tx * T + 8, (LV.start.ty + 1) * T);
      ev('level', { id: id, boss: LV.boss });
      return S;
    }
    function spawn(x, y) {
      S.hero = newHero(x, y); S.hero.inv = 1.0; S.boom = null; S.fox = null; S.shots = [];
    }
    function mkEnemy(e, i) {
      var o = { i: i, k: e.k, x: e.tx * T + 8, y: (e.ty + 1) * T, vx: 0, vy: 0, face: -1, st: 'walk', t: 0, alive: true, cd: 0, ground: true };
      if (e.k === 'kitten') { o.w = 12; o.h = 12; o.sp = 40; }
      else if (e.k === 'beetle') { o.w = 14; o.h = 10; o.sp = 26; }
      else { o.w = 26; o.h = 20; o.sp = 30; }
      return o;
    }
    function mkBoss(k, LV) {
      var b = { k: k, x: (LV.w - 6) * T, y: 15 * T, vx: 0, vy: 0, face: -1, st: 'intro', t: 1.2, flash: 0, alive: true, n: 0 };
      if (k === 'fang') { b.w = 40; b.h = 28; b.hp = b.max = 6; }
      else if (k === 'shell') { b.w = 44; b.h = 24; b.hp = b.max = 7; }
      else { b.w = 36; b.h = 28; b.hp = b.max = 8; b.y = 5 * T; }
      return b;
    }

    // ---------- ввод ----------
    var inp = { dx: 0, dy: 0, jump: false };
    function setInput(dx, dy, jump) { inp.dx = dx | 0; inp.dy = dy | 0; inp.jump = !!jump; }
    function throwBoom() {
      if (!S || S.phase !== 'play' || S.boom || S.hero.climb) return false;
      var P = S.hero;
      S.boom = { x: P.x + P.face * 6, y: P.y - (P.low ? 8 : 14), vx: P.face * K.BOOM_V, vy: 0, st: 'out', t: 0, hit: {}, dir: P.face, spin: 0 };
      ev('throw'); return true;
    }
    function callFox() {
      if (!S || S.phase !== 'play' || S.fox || S.foxCd > 0) return false;
      var P = S.hero;
      if (!P.ground || P.climb || P.low) { ev('foxNo'); return false; }
      S.fox = { x: P.x, y: P.y, dir: P.face, st: 'out', d: 0, carry: null, x0: P.x };
      ev('fox'); return true;
    }

    // ---------- шаг ----------
    function update(dt) {
      if (!S || !S.LV) return;
      S.time += dt; S.W.time = S.time; S.phaseT += dt;
      if (S.needCd > 0) S.needCd -= dt;
      bridges(dt);
      if (S.phase === 'dead') { if (S.phaseT > 1.6) respawn(); enemiesStep(dt); return; }
      if (S.phase === 'clear' || S.phase === 'over' || S.phase === 'idle') { return; }
      var P = S.hero;
      if (P.inv > 0) P.inv -= dt;
      heroStep(S.W, P, inp, dt, heroEv);
      hazards(P);
      if (S.phase !== 'play') return;
      if (S.foxCd > 0) S.foxCd -= dt;
      boomStep(dt); foxStep(dt); enemiesStep(dt); shotsStep(dt);
      if (S.boss) bossStep(dt);
      if (S.phase !== 'play') return;
      pickups(P);
      exitCheck(P);
    }
    function heroEv(t, d) { ev(t, d); }
    function bridges(dt) {
      for (var id in S.br) {
        var b = S.br[id];
        if (b.b > 0) { b.b -= dt; if (b.b <= 0) { b.b = 0; b.c = 0; ev('bridgeBack'); } continue; }
        if (b.touched) { b.c += dt; b.touched = false; if (b.c >= K.BRIDGE_T) { b.b = K.BRIDGE_BACK; b.c = 0; var w = S.LV.w; ev('crack', { x: (id % w) * T + 8, y: Math.floor(id / w) * T }); } }
        else if (b.c > 0) b.c = Math.max(0, b.c - dt);
      }
    }
    function hazards(P) {
      if (P.y > S.LV.h * T + 24) return die('fall');
      if (tilePx(S.LV, P.x, P.y - 4) === '~') return die('water');
      var h = heightOf(P);
      for (var x = P.x - K.HW + 1; x <= P.x + K.HW; x += K.HW * 2 - 2) {
        for (var y = P.y - 1; y >= P.y - h + 1; y -= 6) {
          var tx = Math.floor(x / T), ty = Math.floor(y / T);
          if (tileAt(S.LV, tx, ty) === '^' && y > ty * T + 6) { hurt(P.x - P.face, 'spike'); if (S.phase === 'play' && P.vy > -250) P.vy = -300; return; }
        }
      }
    }
    function hurt(fromX, why) {
      var P = S.hero;
      if (P.inv > 0 || S.phase !== 'play' || opts.god) return false;
      S.hearts--; P.inv = K.INV;
      if (S.hearts <= 0) { die(why || 'hurt'); return true; }
      var d = P.x >= fromX ? 1 : -1; P.vx = d * 140; P.vy = -230; P.slide = false; P.climb = false; P.cut = false;
      ev('hurt', { x: P.x, y: P.y, hearts: S.hearts, why: why });
      return true;
    }
    function die(why) {
      if (S.phase !== 'play') return;
      if (opts.god && why !== 'fall' && why !== 'water') return;
      S.lives--; S.deaths++; S.phase = 'dead'; S.phaseT = 0; S.boom = null; S.fox = null;
      ev('die', { x: S.hero.x, y: S.hero.y, why: why });
      if (S.lives <= 0) { S.phase = 'over'; ev('gameover', { score: S.score }); }
    }
    function respawn() {
      var c = S.cp, x, y;
      if (c) { x = c.tx * T + 8; y = (c.ty + 1) * T; } else { x = S.LV.start.tx * T + 8; y = (S.LV.start.ty + 1) * T; }
      S.phase = 'play'; S.phaseT = 0; S.hearts = K.HEARTS; spawn(x, y);
      // мосты восстанавливаются, оглушённые очнулись
      for (var id in S.br) { S.br[id].b = 0; S.br[id].c = 0; }
      if (S.boss && S.boss.alive) { var nb = mkBoss(S.boss.k, S.LV); nb.hp = S.boss.hp; S.boss = nb; }
      ev('respawn');
    }

    // ---------- бумеранг ----------
    function boomStep(dt) {
      var B = S.boom; if (!B) return;
      var P = S.hero; B.t += dt; B.spin += dt * 22;
      if (B.st === 'out') {
        B.vx -= B.dir * K.BOOM_DEC * dt;
        if (B.vx * B.dir <= 40) B.st = 'back';
        var nx = B.x + B.vx * dt;
        if (solidPx(S.LV, nx, B.y)) { B.st = 'back'; ev('clink', { x: B.x, y: B.y }); } else B.x = nx;
      } else {
        var tx = P.x, ty = P.y - (P.low ? 8 : 14), ddx = tx - B.x, ddy = ty - B.y, d = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d < 10 || B.t > 3) { S.boom = null; ev('catch'); return; }
        B.x += ddx / d * K.BOOM_BACK * dt; B.y += ddy / d * K.BOOM_BACK * dt;
      }
      // по врагам
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i];
        if (!e.alive || B.hit[e.i] || e.st === 'flee') continue;
        if (Math.abs(B.x - e.x) < e.w / 2 + 5 && Math.abs(B.y - (e.y - e.h / 2)) < e.h / 2 + 5) {
          B.hit[e.i] = 1; stun(e, e.k === 'mammoth' ? 2.2 : K.STUN); ev('stun', { x: e.x, y: e.y - e.h / 2, k: e.k });
        }
      }
      var b = S.boss;
      if (b && b.alive && !B.hit.boss && Math.abs(B.x - b.x) < b.w / 2 + 5 && Math.abs(B.y - (b.y - b.h / 2)) < b.h / 2 + 5) {
        B.hit.boss = 1;
        if (bossVulnerable(b)) bossHit(b); else { ev('clink', { x: B.x, y: B.y }); if (B.st === 'out') B.st = 'back'; }
      }
    }
    function stun(e, t) { e.st = 'stun'; e.t = t; e.vx = 0; }

    // ---------- песец Бураш ----------
    function foxStep(dt) {
      var F = S.fox; if (!F) return;
      var P = S.hero, LV = S.LV;
      if (F.st === 'out') {
        var ty = Math.floor((F.y - 1) / T), nx = F.x + F.dir * K.FOX_V * dt, front = nx + F.dir * 5;
        var ch = tileAt(LV, Math.floor(front / T), ty), below = Math.floor(front / T);
        var fl = tileAt(LV, below, ty + 1), floorOk = isSolid(fl) || fl === 's' || isTop(S.W, below, ty + 1);   // по насту сугроба песец бежит поверху
        var pass = ch === '.' || ch === '%' || ch === 's' || ch === 'T' || ch === '-' || ch === '|';
        if (!pass || !floorOk || Math.abs(nx - F.x0) > K.FOX_RANGE * T) { F.st = 'back'; ev('foxTurn'); }
        else {
          F.x = nx;
          // разведка: припасы в сугробах рядом становятся видны
          for (var i = 0; i < LV.items.length; i++) {
            var it = LV.items[i];
            if (it.hidden && !S.revealed[it.id] && Math.abs(it.tx * T + 8 - F.x) < 26 && Math.abs(it.ty * T + 8 - (F.y - 8)) < 44) { S.revealed[it.id] = 1; ev('reveal', { x: it.tx * T + 8, y: it.ty * T + 8 }); }
            if (!S.got[it.id] && !F.carry && it.tx === Math.floor(F.x / T) && it.ty === ty) { F.carry = it; F.st = 'back'; ev('foxGrab', { k: it.k }); }
          }
        }
      } else {
        var tx = P.x, tyy = P.y, ddx = tx - F.x, ddy = tyy - F.y, d = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d < 8) {
          if (F.carry && !S.got[F.carry.id]) collect(F.carry, true);
          S.fox = null; S.foxCd = 0.35; ev('foxHome'); return;
        }
        var sp = K.FOX_BACK * dt; if (sp > d) sp = d;
        F.x += ddx / d * sp; F.y += ddy / d * sp; F.dir = ddx > 0 ? 1 : -1;
      }
    }

    // ---------- предметы ----------
    function collect(it, byFox) {
      S.got[it.id] = 1; S.revealed[it.id] = 1;
      var x = it.tx * T + 8, y = it.ty * T + 8;
      if (it.k === 'key') { S.keyGot = true; S.score += PTS.key; ev('key', { x: x, y: y, fox: byFox }); }
      else if (it.k === 'heart') { if (S.hearts < K.HEARTS) S.hearts++; else S.score += PTS.heart; ev('heart', { x: x, y: y, fox: byFox }); }
      else { S.sup++; S.score += PTS.sup; ev('sup', { x: x, y: y, k: it.k, fox: byFox, n: S.sup, need: S.LV.need, total: S.LV.total }); if (S.sup === S.LV.need) ev('enough'); }
    }
    function pickups(P) {
      var LV = S.LV, h = heightOf(P);
      for (var i = 0; i < LV.items.length; i++) {
        var it = LV.items[i]; if (S.got[it.id]) continue;
        var cx = it.tx * T + 8, cy = it.ty * T + 8;
        if (it.hidden && !S.revealed[it.id] && Math.abs(cx - P.x) < 30 && Math.abs(cy - (P.y - h / 2)) < 30) { S.revealed[it.id] = 1; ev('reveal', { x: cx, y: cy }); }
        if (Math.abs(cx - P.x) < K.HW + 6 && cy + 6 > P.y - h && cy - 6 < P.y) collect(it, false);
      }
      for (var c = 0; c < LV.camps.length; c++) {
        var cp = LV.camps[c], x = cp.tx * T + 8, y = (cp.ty + 1) * T;
        if (Math.abs(x - P.x) < 14 && Math.abs(y - P.y) < 20 && S.cp !== cp) {
          S.cp = cp; if (!S.lit[cp.id]) { S.lit[cp.id] = 1; S.score += PTS.camp; } ev('camp', { x: x, y: y });
        }
      }
    }
    function exitCheck(P) {
      var E = S.LV.exit; if (!E || S.boss) return;
      var x = E.tx * T + 8, y = (E.ty + 1) * T;
      if (Math.abs(x - P.x) < 14 && Math.abs(y - P.y) < 24) {
        if (S.sup >= S.LV.need) clear();
        else if (S.needCd <= 0) { S.needCd = 2; ev('need', { left: S.LV.need - S.sup }); }
      }
    }
    function clear() {
      var full = !S.boss && S.sup >= S.LV.total, bonus = PTS.clear + (full ? PTS.full : 0);
      S.full = full; S.score += bonus; if (full) S.lives = Math.min(9, S.lives + 1);
      S.phase = 'clear'; S.phaseT = 0;
      ev('clear', { id: S.id, bonus: bonus, full: full, key: S.keyGot ? S.LV.keyId : null, sup: S.sup, total: S.LV.total });
    }

    // ---------- враги ----------
    function eSolid(x, y) { return solidPx(S.LV, x, y); }
    function eFloor(e, x) { var ty = Math.round(e.y / T), tx = Math.floor(x / T), ch = tileAt(S.LV, tx, ty); return isSolid(ch) || isTop(S.W, tx, ty); }
    function eHazard(x, y) { var ch = tilePx(S.LV, x, y); return ch === '^' || ch === '~'; }
    function enemyMove(e, dt) {
      // гравитация + опора
      if (!e.ground) {
        e.vy = Math.min(e.vy + K.G * dt, K.FALL);
        var ny = e.y + e.vy * dt;
        if (e.vy > 0) {
          var r = Math.floor(ny / T);
          if (r * T >= e.y - 0.01 && (isSolid(tileAt(S.LV, Math.floor(e.x / T), r)) || isTop(S.W, Math.floor(e.x / T), r))) { e.y = r * T; e.vy = 0; e.ground = true; }
          else e.y = ny;
        } else { if (eSolid(e.x, ny - e.h)) e.vy = 0; else e.y = ny; }
        if (e.y > S.LV.h * T + 40) e.alive = false;
      }
      if (e.vx) {
        var nx = e.x + e.vx * dt, s = e.vx > 0 ? 1 : -1, fx = nx + s * e.w / 2;
        if (eSolid(fx, e.y - 2) || eSolid(fx, e.y - e.h + 2)) { e.vx = 0; e.wall = true; return; }
        e.x = nx;
        if (e.ground && !eFloor(e, e.x)) { e.ground = false; e.vy = 0; }
      }
    }
    function enemiesStep(dt) {
      var P = S.hero, i;
      for (i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (!e.alive) continue;
        e.t -= dt; e.wall = false; if (e.cd > 0) e.cd -= dt;
        var dxh = P.x - e.x, near = Math.abs(dxh), sameRow = Math.abs(P.y - e.y) < 20;
        if (e.st === 'flee') { e.vx = e.face * 150; e.vy += K.G * dt * 0.5; e.x += e.vx * dt; e.y += e.vy * dt; if (e.t <= 0) e.alive = false; continue; }
        if (e.st === 'stun') { e.vx = 0; enemyMove(e, dt); if (e.t <= 0) { e.st = 'walk'; ev('wake', { x: e.x, y: e.y }); } }
        else if (e.k === 'kitten') kittenAI(e, dt, dxh, near, sameRow);
        else if (e.k === 'beetle') walkAI(e, dt, e.sp);
        else mammothAI(e, dt, dxh, near, sameRow);
        if (S.phase === 'play') touchEnemy(e, P);
      }
    }
    function walkAI(e, dt, sp) {
      if (!e.ground) { enemyMove(e, dt); return; }
      var drift = tilePx(S.LV, e.x, e.y - 2) === 's';
      e.vx = e.face * sp * (drift ? 0.5 : 1);
      var ax = e.x + e.face * (e.w / 2 + 2);
      if (!eFloor(e, ax) || eHazard(ax, e.y - 2) || eHazard(ax, e.y + 4) || eSolid(ax, e.y - 4)) { e.face = -e.face; e.vx = 0; }
      enemyMove(e, dt);
      if (e.wall) e.face = -e.face;
    }
    function kittenAI(e, dt, dxh, near, sameRow) {
      if (e.st === 'walk') {
        walkAI(e, dt, e.sp);
        if (e.cd <= 0 && near < 5 * T && sameRow && S.phase === 'play') { e.st = 'crouch'; e.t = 0.45; e.face = dxh > 0 ? 1 : -1; e.vx = 0; ev('growl', { x: e.x, y: e.y }); }
      } else if (e.st === 'crouch') {
        e.vx = 0; if (e.t <= 0) { e.st = 'pounce'; e.vy = -330; e.vx = e.face * 165; e.ground = false; }
      } else if (e.st === 'pounce') {
        enemyMove(e, dt); if (e.ground) { e.st = 'walk'; e.cd = 1.6; e.vx = 0; }
      }
    }
    function mammothAI(e, dt, dxh, near, sameRow) {
      if (e.st === 'walk') {
        walkAI(e, dt, e.sp);
        var facing = (dxh > 0 ? 1 : -1) === e.face;
        if (e.cd <= 0 && near < 8 * T && sameRow && facing && S.phase === 'play') { e.st = 'rev'; e.t = 0.5; e.vx = 0; ev('trumpet', { x: e.x, y: e.y }); }
      } else if (e.st === 'rev') { e.vx = 0; if (e.t <= 0) { e.st = 'charge'; e.t = 3; } }
      else if (e.st === 'charge') {
        e.vx = e.face * 210;
        var ax = e.x + e.face * (e.w / 2 + 2);
        if (!eFloor(e, ax) || eHazard(ax, e.y + 4)) { e.st = 'reel'; e.t = 1.0; e.vx = 0; }
        else { enemyMove(e, dt); if (e.wall || e.t <= 0) { e.st = 'reel'; e.t = 1.5; ev('thud', { x: e.x, y: e.y }); } }
      } else if (e.st === 'reel') { e.vx = 0; if (e.t <= 0) { e.st = 'walk'; e.face = -e.face; e.cd = 1.2; } }
    }
    function touchEnemy(e, P) {
      var h = heightOf(P);
      if (Math.abs(P.x - e.x) > K.HW + e.w / 2 - 1 || P.y - h > e.y - 1 || P.y < e.y - e.h + 1) return;
      if (e.st === 'stun' || e.st === 'reel' && e.k !== 'mammoth') { flee(e); return; }
      var stomp = P.vy > 40 && P.y - e.y < -e.h + 10;
      if (stomp) {
        if (e.k === 'beetle') { hurt(e.x, 'beetle'); P.vy = -K.BOUNCE * 0.8; return; }
        P.y = e.y - e.h; P.cut = false;
        if (e.k === 'mammoth') { P.vy = -K.MAM_BOUNCE; ev('boing', { x: e.x, y: e.y - e.h }); }
        else { P.vy = -K.BOUNCE; stun(e, K.STUN); ev('stomp', { x: e.x, y: e.y - e.h }); }
        return;
      }
      if (e.k === 'mammoth' && e.st === 'reel') return;
      hurt(e.x, e.k);
    }
    function flee(e) { e.st = 'flee'; e.t = 1.2; e.vy = -260; e.face = e.x < S.hero.x ? -1 : 1; S.kills++; S.score += PTS.flee; ev('flee', { x: e.x, y: e.y - e.h / 2, pts: PTS.flee, k: e.k }); }

    // ---------- снаряды босса ----------
    function shotsStep(dt) {
      var P = S.hero, h = heightOf(P);
      for (var i = S.shots.length - 1; i >= 0; i--) {
        var s = S.shots[i]; s.vy += (s.g || 0) * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.t = (s.t || 0) + dt;
        if (solidPx(S.LV, s.x, s.y) || s.y > S.LV.h * T || s.t > 5) { S.shots.splice(i, 1); ev('shatter', { x: s.x, y: s.y }); continue; }
        if (Math.abs(s.x - P.x) < K.HW + 4 && s.y > P.y - h - 3 && s.y < P.y + 2) { S.shots.splice(i, 1); hurt(s.x, 'shard'); }
      }
    }

    // ---------- боссы ----------
    function bossVulnerable(b) { return b.st === 'dazed' || b.st === 'flipped' || b.st === 'rest'; }
    function bossHit(b) {
      b.hp--; b.flash = 0.4; ev('bossHit', { x: b.x, y: b.y - b.h / 2, hp: b.hp });
      if (b.hp <= 0) { b.alive = false; b.st = 'down'; S.score += PTS.boss; ev('bossDown', { x: b.x, y: b.y - b.h / 2 }); S.bossT = 2.2; return; }
      if (b.k === 'fang') { b.st = 'walk'; b.t = 1.0; }
      else if (b.k === 'shell') { b.st = 'crawl'; b.t = 1.2; }
      else { b.st = 'rise'; b.t = 0.8; }
    }
    function bossStep(dt) {
      var b = S.boss, P = S.hero;
      S.W.gust = 0;
      if (!b.alive) { S.bossT -= dt; if (S.bossT <= 0 && S.phase === 'play') clear(); return; }
      b.t -= dt; if (b.flash > 0) b.flash -= dt;
      var dxh = P.x - b.x, dir = dxh > 0 ? 1 : -1, p2 = b.hp <= b.max / 2;
      var minX = T + b.w / 2, maxX = (S.LV.w - 1) * T - b.w / 2, floorY = 15 * T;
      if (b.st === 'intro') { if (b.t <= 0) { b.st = b.k === 'fang' ? 'walk' : b.k === 'shell' ? 'crawl' : 'hover'; b.t = 1.5; ev('bossIntro', { k: b.k }); } }
      else if (b.k === 'fang') {
        if (b.st === 'walk') { b.face = dir; b.x += dir * (p2 ? 85 : 60) * dt; if (b.t <= 0) { b.st = 'crouch'; b.t = 0.6; ev('growl', { x: b.x, y: b.y }); } }
        else if (b.st === 'crouch') { if (b.t <= 0) { b.st = 'leap'; b.vy = -520; var tt = 2 * 520 / K.G; b.vx = Math.max(-280, Math.min(280, dxh / tt)); b.face = dir; b.n = (b.n || 0) + 1; } }
        else if (b.st === 'leap') {
          b.vy += K.G * dt; b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.y >= floorY) { b.y = floorY; b.vy = 0; ev('thud', { x: b.x, y: b.y }); if (p2 && b.n % 2 === 1) { b.st = 'crouch'; b.t = 0.35; } else { b.st = 'dazed'; b.t = p2 ? 1.1 : 1.5; } }
        } else if (b.st === 'dazed') { if (b.t <= 0) { b.st = 'walk'; b.t = 1.4 + rng() * 0.8; } }
      } else if (b.k === 'shell') {
        if (b.st === 'crawl') { b.face = dir; b.x += dir * 40 * dt; if (b.t <= 0) { b.st = 'curl'; b.t = 0.5; } }
        else if (b.st === 'curl') { if (b.t <= 0) { b.st = 'roll'; b.vx = b.face * (p2 ? 280 : 240); b.n = p2 ? 3 : 2; ev('roll'); } }
        else if (b.st === 'roll') {
          b.x += b.vx * dt;
          if (b.x < minX || b.x > maxX) { b.x = Math.max(minX, Math.min(maxX, b.x)); b.vx = -b.vx; b.n--; ev('thud', { x: b.x, y: b.y }); if (b.n <= 0) { b.st = 'flipped'; b.t = 1.6; b.vx = 0; } }
        } else if (b.st === 'flipped') { if (b.t <= 0) { b.st = p2 ? 'spit' : 'crawl'; b.t = p2 ? 0.9 : 1.6; if (p2) spitShards(b, 3); } }
        else if (b.st === 'spit') { if (b.t <= 0) { b.st = 'crawl'; b.t = 1.4; } }
      } else {   // owl
        if (b.st === 'hover') {
          b.x += Math.sin(S.time * 1.3) * 90 * dt; b.y += (5 * T - b.y) * 2 * dt; b.face = dir;
          b.drop = (b.drop || 0) - dt;
          if (b.drop <= 0) { b.drop = p2 ? 0.55 : 0.85; S.shots.push({ x: b.x + (rng() - 0.5) * 30, y: b.y + 4, vx: 0, vy: 40, g: 600, k: 'icicle' }); }
          if (b.t <= 0) { b.n = (b.n || 0) + 1; if (b.n % 2 === 0) { b.st = 'gust'; b.t = 1.6; ev('gust'); } else { b.st = 'swoop'; b.tx = P.x; b.vy = 0; ev('screech'); } }
        } else if (b.st === 'gust') {
          b.x += Math.sin(S.time) * 30 * dt;
          if (S.phase === 'play' && !opts.god) S.W.gust = P.x > b.x ? 1 : -1;
          if (b.t <= 0) { b.st = 'hover'; b.t = 2 + rng(); }
        } else if (b.st === 'swoop') {
          var sx = b.tx - b.x; b.x += Math.max(-220, Math.min(220, sx * 3)) * dt; b.y += 260 * dt;
          if (b.y >= floorY) { b.y = floorY; b.st = 'rest'; b.t = p2 ? 1.2 : 1.6; ev('thud', { x: b.x, y: b.y }); }
        } else if (b.st === 'rest') { if (b.t <= 0) { b.st = 'rise'; b.t = 0.8; } }
        else if (b.st === 'rise') { b.y += (5 * T - b.y) * 3 * dt; if (b.t <= 0) { b.st = 'hover'; b.t = 2 + rng(); } }
        b.x = Math.max(minX, Math.min(maxX, b.x));
      }
      b.x = Math.max(minX, Math.min(maxX, b.x));
      // касание
      if (S.phase === 'play') {
        var h = heightOf(P);
        if (Math.abs(P.x - b.x) < K.HW + b.w / 2 - 3 && P.y - h < b.y - 2 && P.y > b.y - b.h + 2) {
          var stomp = P.vy > 40 && P.y - b.y < -b.h + 10;
          if (stomp && bossVulnerable(b)) { P.vy = -K.BOUNCE; P.cut = false; bossHit(b); }
          else if (stomp && b.k !== 'shell') { P.vy = -K.BOUNCE; P.cut = false; ev('boing', { x: b.x, y: b.y - b.h }); }
          else if (!bossVulnerable(b)) hurt(b.x, 'boss');
        }
      }
    }
    function spitShards(b, n) { for (var i = 0; i < n; i++) S.shots.push({ x: b.x, y: b.y - b.h, vx: (i - (n - 1) / 2) * 90 + b.face * 40, vy: -340, g: 900, k: 'shard' }); ev('spit'); }

    // ---------- API ----------
    newRun();
    return {
      state: function () { return S; },
      newRun: newRun,
      startLevel: startLevel,
      update: update,
      setInput: setInput,
      throwBoom: throwBoom,
      callFox: callFox,
      _place: function (tx, ty) { spawn(tx * T + 8, (ty + 1) * T); S.hero.inv = 0; },
      _hurt: hurt, _die: die, _clear: clear, _collect: collect
    };
  }

  LD.logic = { T: T, K: K, PTS: PTS, tileAt: tileAt, isSolid: isSolid, isTop: isTop, solidPx: solidPx, tilePx: tilePx, support: support,
    heroStep: heroStep, newHero: newHero, heightOf: heightOf, canStand: canStand, windAt: windAt, gustOn: gustOn, columnAt: columnAt,
    mulberry32: function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; } };
  LD.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
