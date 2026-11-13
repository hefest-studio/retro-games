/* ДОСПЕХ · логика игры (без DOM, детерминирована при заданном rng): физика витязя с жёстким прыжком, лестницы, плоты и
   подъёмники, броня-здоровье, метательное оружие, враги и стражи, таймер, жизни, продолжения, два круга.
   Граф проходимости (Nav) — по той же физике, для тестов и бота. Единицы — клетки (16 px) и секунды; y вниз;
   тело: x — центр, y — подошвы. */
(function (global) {
  'use strict';
  var D = global.DOSPEH = global.DOSPEH || {};
  var T = D.TILES, R = T.R, E = T.E, SOL = T.SOL, ONE = T.ONE, LAD = T.LAD;

  // ---------- константы ----------
  var WALK = 4.2, JV = 14, G = 38, FALLMAX = 16, CLIMB = 3.2;
  var HW = 0.32, HH = 1.7, CH = 1.1;               // полуширина, рост, рост в приседе
  var VIEW_W = 32, VIEW_H = R;
  var TIME = 270, LIVES = 3, CONTS = 3, INV = 1.6, CHARGE = 0.9;
  var WEAP = {
    spear:  { max: 2, cd: 0.22 },
    axe:    { max: 1, cd: 0.3 },
    torch:  { max: 1, cd: 0.34 },
    blades: { max: 1, cd: 0.3 },
    shield: { max: 1, cd: 0.3 },
    hammer: { max: 1, cd: 0.34 }
  };
  var WLIST = ['spear', 'axe', 'torch', 'blades', 'shield', 'hammer'];
  var PTS = { riser: 100, blub: 100, kite: 300, vent: 200, brute: 400, chest: 200 };
  var FOE = {   // полуширина, рост, здоровье
    riser: { hw: 0.4, hh: 1.2, hp: 1 }, blub: { hw: 0.35, hh: 0.7, hp: 1, fly: true }, kite: { hw: 0.55, hh: 0.6, hp: 2, fly: true },
    vent: { hw: 0.45, hh: 1.3, hp: 2 }, brute: { hw: 0.55, hh: 1.9, hp: 4 }
  };
  var BOSS = {
    golem: { hw: 1.0, hh: 2.6 }, crab: { hw: 1.3, hh: 1.6 }, serpent: { hw: 1.2, hh: 1.0, fly: true }, koshey: { hw: 0.9, hh: 3.0 }
  };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- карта ----------
  function tileAt(lv, c, r) { if (c < 0 || c >= lv.W) return SOL; if (r < 0 || r >= R) return E; return lv.t[r * lv.W + c]; }
  function isSolid(lv, c, r) { return tileAt(lv, c, r) === SOL; }
  function isTop(lv, c, r) { var k = tileAt(lv, c, r); if (k === SOL || k === ONE) return r >= 0 && r < R && (c >= 0 && c < lv.W); if (k === LAD) return tileAt(lv, c, r - 1) !== LAD; return false; }
  function boxSolid(lv, x0, y0, x1, y1) {
    for (var c = Math.floor(x0); c <= Math.floor(x1 - 1e-6); c++) for (var r = Math.floor(y0); r <= Math.floor(y1 - 1e-6); r++) if (isSolid(lv, c, r)) return true;
    return false;
  }

  // ---------- плоты и подъёмники: положение — функция времени ----------
  function platPhase(p, t) {
    var len = Math.abs(p.kind === 'h' ? p.x1 - p.x0 : p.y1 - p.y0), mv = len / p.sp, cyc = 2 * mv + 2 * p.dwell, ph = ((t % cyc) + cyc) % cyc, f, st, rem;
    if (ph < p.dwell) { f = 0; st = 'd0'; rem = p.dwell - ph; }
    else if (ph < p.dwell + mv) { f = (ph - p.dwell) / mv; st = 'go'; rem = p.dwell + mv - ph; }
    else if (ph < 2 * p.dwell + mv) { f = 1; st = 'd1'; rem = 2 * p.dwell + mv - ph; }
    else { f = 1 - (ph - 2 * p.dwell - mv) / mv; st = 'back'; rem = cyc - ph; }
    return { f: f, st: st, rem: rem, x: p.x0 + (p.x1 - p.x0) * f, y: p.y0 + (p.y1 - p.y0) * f, cyc: cyc };
  }
  function world(lv, t, dt) {
    var pp = (lv.plats || []).map(function (p) { var a = platPhase(p, t), b = platPhase(p, t - (dt || 0)); return { x: a.x, y: a.y, w: p.w, dx: a.x - b.x, dy: a.y - b.y }; });
    return { lv: lv, pp: pp, t: t };
  }
  var STATIC = function (lv) { return { lv: lv, pp: [], t: 0 }; };

  // ---------- герой ----------
  function newHero(x, y) { return { x: x, y: y, vx: 0, vy: 0, face: 1, ground: true, on: -1, climb: false, crouch: false, hurtT: 0, inv: 0, jprev: false, armor: 1, dead: null, runT: 0, throwT: 0, charge: 0, fprev: false }; }
  function heroH(h) { return h.crouch ? CH : HH; }
  function moveX(lv, h, dx) {
    if (!dx) return false;
    var hh = heroH(h), nx = h.x + dx;
    if (boxSolid(lv, nx - HW, h.y - hh + 0.02, nx + HW, h.y - 0.02)) {
      if (dx > 0) nx = Math.floor(nx + HW) - HW - 1e-4; else nx = Math.floor(nx - HW) + 1 + HW + 1e-4;
      if (boxSolid(lv, nx - HW, h.y - hh + 0.02, nx + HW, h.y - 0.02)) nx = h.x;
      h.x = nx; return true;
    }
    h.x = nx; return false;
  }
  // опора под ногами: -2 — нет, -1 — клетки, i — плот i
  function support(Wd, h) {
    var lv = Wd.lv, ry = Math.round(h.y);
    if (Math.abs(h.y - ry) < 1e-4) for (var c = Math.floor(h.x - HW + 0.02); c <= Math.floor(h.x + HW - 0.02); c++) if (isTop(lv, c, ry)) return -1;
    for (var i = 0; i < Wd.pp.length; i++) { var P = Wd.pp[i]; if (Math.abs(h.y - P.y) < 0.02 && h.x + HW - 0.02 > P.x && h.x - HW + 0.02 < P.x + P.w) return i; }
    return -2;
  }
  function ladderCol(lv, h) { var c = Math.floor(h.x); return Math.abs(h.x - (c + 0.5)) < 0.42 ? c : -1; }
  // inp: { dx, up, down, jump } (держимые); возвращает событие ('jump'|'land'|null)
  function heroStep(Wd, h, inp, dt) {
    var lv = Wd.lv, ev = null;
    var jEdge = !!inp.jump && !h.jprev; h.jprev = !!inp.jump;
    if (h.hurtT > 0) h.hurtT -= dt;
    if (h.inv > 0) h.inv -= dt;
    var ctl = h.hurtT <= 0;
    if (h.climb) {
      var cl = Math.floor(h.x);
      if (!ctl) { h.climb = false; h.ground = false; }
      else {
        h.crouch = false;
        if (inp.up) {
          h.y -= CLIMB * dt; h.runT += dt;
          if (tileAt(lv, cl, Math.floor(h.y)) !== LAD) { h.y = Math.floor(h.y) + 1; h.climb = false; h.ground = true; h.on = -1; }
        } else if (inp.down) {
          h.y += CLIMB * dt; h.runT += dt;
          var below = Math.floor(h.y);
          if (tileAt(lv, cl, below) !== LAD && isTop(lv, cl, below)) { h.y = below; h.climb = false; h.ground = true; h.on = -1; }
          else if (h.y > R + 2) { h.climb = false; h.ground = false; }
        }
        return null;
      }
    }
    if (h.ground) {
      if (h.on >= 0 && Wd.pp[h.on]) { var P = Wd.pp[h.on]; moveX(lv, h, P.dx); h.y = P.y; }
      var lc = ladderCol(lv, h);
      if (ctl && jEdge) {
        h.crouch = false;
        if (boxSolid(lv, h.x - HW, h.y - HH + 0.02, h.x + HW, h.y - 0.02)) { h.crouch = true; }
        else { h.vx = (inp.dx || 0) * WALK; h.vy = -JV; h.ground = false; h.on = -1; if (inp.dx) h.face = inp.dx; ev = 'jump'; }
      } else if (ctl && inp.up && lc >= 0 && tileAt(lv, lc, Math.round(h.y) - 1) === LAD && h.on < 0) {
        h.climb = true; h.x = lc + 0.5; h.crouch = false; h.vx = 0; return null;
      } else if (ctl && inp.down && lc >= 0 && h.on < 0 && tileAt(lv, lc, Math.round(h.y)) === LAD && tileAt(lv, lc, Math.round(h.y) - 1) !== LAD) {
        h.climb = true; h.x = lc + 0.5; h.y += 0.06; h.crouch = false; h.vx = 0; return null;
      } else {
        var wantCrouch = ctl && !!inp.down;
        if (!wantCrouch && h.crouch && boxSolid(lv, h.x - HW, h.y - HH + 0.02, h.x + HW, h.y - 0.02)) wantCrouch = true;
        h.crouch = wantCrouch;
        var vx = (!ctl || h.crouch) ? 0 : (inp.dx || 0) * WALK;
        if (ctl && inp.dx) h.face = inp.dx;
        h.vx = vx; if (vx) h.runT += dt; else h.runT = 0;
        moveX(lv, h, vx * dt);
      }
      if (h.ground) {
        var s = support(Wd, h);
        if (s === -2) { h.ground = false; h.on = -1; h.vx = 0; h.vy = 0; h.crouch = false; }   // сошёл с края — падает отвесно
        else { h.on = s; if (s >= 0) h.y = Wd.pp[s].y; }
      }
    }
    if (!h.ground && !h.climb) {
      var py = h.y, hh = heroH(h);
      h.vy = Math.min(FALLMAX, h.vy + G * dt);
      if (moveX(lv, h, h.vx * dt)) h.vx = 0;
      h.y += h.vy * dt;
      if (h.vy < 0) {
        if (boxSolid(lv, h.x - HW, h.y - hh, h.x + HW, h.y - hh + 0.1)) { h.y = Math.floor(h.y - hh) + 1 + hh; h.vy = 0; }
      } else {
        var landed = false;
        for (var r = Math.ceil(py - 1e-4); r <= Math.floor(h.y) && !landed; r++) {
          for (var c = Math.floor(h.x - HW + 0.02); c <= Math.floor(h.x + HW - 0.02); c++) if (isTop(lv, c, r)) { h.y = r; landed = true; h.on = -1; break; }
        }
        if (!landed) for (var i = 0; i < Wd.pp.length; i++) {
          var Q = Wd.pp[i];
          if (h.x + HW - 0.02 > Q.x && h.x - HW + 0.02 < Q.x + Q.w && py <= Q.y - Q.dy + 0.05 && h.y >= Q.y) { h.y = Q.y; landed = true; h.on = i; break; }
        }
        if (landed) { h.ground = true; h.vy = 0; h.vx = 0; ev = 'land'; }
      }
    }
    return ev;
  }

  // ---------- граф проходимости ----------
  function isNode(lv, c, r) { return isTop(lv, c, r) && !boxSolid(lv, c + 0.5 - HW, r - HH, c + 0.5 + HW, r - 0.01); }
  // макрос: подойти к sx, затем прыжок с направлением d (jump) или шаг с края в сторону d (walk-off); дальше руки прочь
  function simulate(lv, x, y, m) {
    var Wd = STATIC(lv), h = newHero(x, y), dt = 1 / 60, left = false, out = { node: -1, t: 0 };
    for (var k = 0; k < 240; k++) {
      var inp = m.jump ? { dx: m.d, jump: k === 0 } : { dx: left ? 0 : m.d };
      heroStep(Wd, h, inp, dt);
      if (!h.ground) left = true;
      if (left && h.ground) { out.node = Math.round(h.y) * lv.W + Math.floor(h.x); out.x = h.x; out.t = k * dt; return out; }
      if (h.y > R + 1) return out;
      if (!m.jump && !left && k > 30) return out;
    }
    return out;
  }
  function Nav(lv) {
    var set = new Set(), edges = new Map();
    for (var r = 0; r < R; r++) for (var c = 0; c < lv.W; c++) if (isNode(lv, c, r)) set.add(r * lv.W + c);
    function add(a, b, e) { if (a === b) return; if (!edges.has(a)) edges.set(a, []); edges.get(a).push(Object.assign({ to: b }, e)); }
    function nodeAtXY(x, y) { var ry = Math.round(y); if (Math.abs(y - ry) > 0.05) return -1; var id = ry * lv.W + Math.floor(x); if (set.has(id)) return id; var a = ry * lv.W + Math.floor(x + HW - 0.03), b = ry * lv.W + Math.floor(x - HW + 0.03); return set.has(a) ? a : set.has(b) ? b : -1; }
    function landNode(o) { if (o.node < 0) return -1; return nodeAtXY(o.x, Math.floor(o.node / lv.W)); }
    set.forEach(function (id) {
      var c = id % lv.W, r = Math.floor(id / lv.W);
      [-1, 1].forEach(function (d) { var nb = id + d; if (set.has(nb)) add(id, nb, { walk: d, cost: 1 / WALK }); });
      // прыжки с разных точек клетки: ребро есть, только если промах ±0.08 по месту толчка ведёт туда же
      [0.15, 0.5, 0.85].forEach(function (off) {
        var sx = c + off;
        [-1, 0, 1].forEach(function (d) {
          var to = null, okAll = true, tt = 0;
          [-0.08, 0, 0.08].forEach(function (j) {
            var x = sx + j, h0 = newHero(x, r);
            if (support(STATIC(lv), h0) === -2 || boxSolid(lv, x - HW, r - HH, x + HW, r - 0.01)) return;   // там не стоять
            var o = simulate(lv, x, r, { jump: true, d: d }), n = landNode(o);
            if (n < 0) { okAll = false; return; }
            if (to === null) { to = n; tt = o.t; } else if (to !== n) okAll = false;
          });
          if (okAll && to !== null && to !== id) add(id, to, { jump: true, d: d, sx: sx, cost: tt + 0.3 });
        });
      });
      // сойти с края (отвесное падение)
      [-1, 1].forEach(function (d) {
        if (set.has(id + d) || isTop(lv, c + d, r)) return;
        if (boxSolid(lv, c + d + 0.5 - HW, r - HH, c + d + 0.5 + HW, r - 0.01)) return;
        var o = simulate(lv, c + 0.5, r, { jump: false, d: d }), n = landNode(o);
        if (n >= 0) add(id, n, { drop: d, cost: o.t + 0.3 });
      });
      // лестницы
      if (tileAt(lv, c, r - 1) === LAD) { var rt = r - 1; while (tileAt(lv, c, rt - 1) === LAD) rt--; if (set.has(rt * lv.W + c)) add(id, rt * lv.W + c, { climb: -1, cost: (r - rt) / CLIMB + 0.2 }); }
      if (tileAt(lv, c, r) === LAD && tileAt(lv, c, r - 1) !== LAD) { var rb = r; while (tileAt(lv, c, rb + 1) === LAD) rb++; if (set.has((rb + 1) * lv.W + c)) add(id, (rb + 1) * lv.W + c, { climb: 1, cost: (rb + 1 - r) / CLIMB + 0.2 }); }
    });
    // плоты и подъёмники
    (lv.plats || []).forEach(function (p, i) {
      var a, b;
      if (p.kind === 'h') { a = p.y0 * lv.W + (p.x0 - 2); b = p.y0 * lv.W + (p.x1 + 4); }
      else { a = p.y0 * lv.W + (p.x0 - 1); b = p.y1 * lv.W + (p.x0 + 3); }
      if (set.has(a) && set.has(b)) add(a, b, { ride: i, cost: platPhase(p, 0).cyc });
    });
    function reach(start) { var seen = new Set([start]), q = [start]; while (q.length) { var u = q.shift(); (edges.get(u) || []).forEach(function (e) { if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); } }); } return seen; }
    function field(goals) {
      var rev = new Map(); edges.forEach(function (l, u) { l.forEach(function (e) { if (!rev.has(e.to)) rev.set(e.to, []); rev.get(e.to).push({ u: u, cost: e.cost }); }); });
      var dist = new Map(), q = [];
      goals.forEach(function (g) { dist.set(g, 0); q.push([0, g]); });
      while (q.length) {
        q.sort(function (x, y) { return x[0] - y[0]; }); var cur = q.shift();
        if (cur[0] > dist.get(cur[1])) continue;
        (rev.get(cur[1]) || []).forEach(function (e) { var nd = cur[0] + e.cost; if (!dist.has(e.u) || nd < dist.get(e.u)) { dist.set(e.u, nd); q.push([nd, e.u]); } });
      }
      return dist;
    }
    return { set: set, edges: edges, nodeAt: nodeAtXY, reach: reach, field: field };
  }

  // ---------- переправа на плоту/подъёмнике: общий «заученный» приём для бота и тестов ----------
  // st — объект состояния (создаётся пустым), react — задержка реакции, с. Возвращает {dx, jump} либо {done:true}/{fail:true}.
  function rideCtl(lv, i, st, h, t, react) {
    var p = lv.plats[i], ph = platPhase(p, t), o = { dx: 0, jump: false };
    st.k = st.k || 'go'; st.w = st.w || 0;
    if (p.kind === 'h') {
      var sx = p.x0 - 1 + 0.1;
      if (st.k === 'go') { if (Math.abs(h.x - sx) > 0.035) { o.dx = h.x < sx ? 1 : -1; return o; } if (!h.ground) return o; st.k = 'wait'; st.w = 0; }
      if (st.k === 'wait') { if (ph.st === 'd0' && ph.rem > 0.85) { st.w += 1 / 60; if (st.w >= react) { st.k = 'jump1'; o.dx = 1; o.jump = true; } } else st.w = 0; return o; }
      if (st.k === 'jump1') { if (h.ground) { if (h.on === i) st.k = 'ride'; else return { fail: true }; } return o; }
      if (st.k === 'ride') {
        if (!h.ground || h.on !== i) return { fail: true };
        var cx = ph.x + 1.5;
        if (Math.abs(h.x - cx) > 0.2) o.dx = h.x < cx ? 1 : -1;
        if (ph.st === 'd1' && Math.abs(h.x - cx) <= 0.2) { st.w += 1 / 60; if (st.w >= react && ph.rem > 0.1) { st.k = 'jump2'; o.dx = 1; o.jump = true; } } else if (ph.st !== 'd1') st.w = 0;
        return o;
      }
      if (st.k === 'jump2') { if (h.ground) return h.on < 0 && h.x > p.x1 + 4 ? { done: true } : { fail: true }; return o; }
    } else {
      var wx = p.x0 - 1 + 0.25, cx2 = p.x0 + 1.5;
      if (st.k === 'go') { if (Math.abs(h.x - wx) > 0.035) { o.dx = h.x < wx ? 1 : -1; return o; } st.k = 'wait'; st.w = 0; }
      if (st.k === 'wait') { if (ph.st === 'd0' && ph.rem > 0.6) { st.w += 1 / 60; if (st.w >= react) st.k = 'board'; } else st.w = 0; return o; }
      if (st.k === 'board') { if (h.x < cx2 - 0.1) { o.dx = 1; return o; } if (h.ground && h.on === i) st.k = 'ride'; else if (!h.ground) return { fail: true }; return o; }
      if (st.k === 'ride') {
        if (h.on !== i) { if (!h.ground) return { fail: true }; }
        if (ph.st === 'd1') { st.w += 1 / 60; if (st.w >= react * 0.5) st.k = 'off'; } else st.w = 0;
        return o;
      }
      if (st.k === 'off') { o.dx = 1; if (h.ground && h.on < 0 && h.x > p.x0 + 3.5) return { done: true }; if (!h.ground) return { fail: true }; return o; }
    }
    return o;
  }

  // ---------- игра ----------
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, emit = opts.onEvent || function () {}, dmgMul = opts.dmgMul == null ? 1 : opts.dmgMul;
    var S = { phase: 'idle', phaseT: 0, loop: 1, li: 0, lv: null, t: 0, time: 0, timer: TIME, lives: LIVES, conts: CONTS, score: 0, nextLife: 20000,
      hero: null, weapon: 'spear', shots: [], eshots: [], enemies: [], items: [], chests: [], flames: [], ring: null, boss: null, bossState: 'none',
      cam: { x: 0 }, cp: -1, spawnsDone: [], riseT: 2, blubT: 2, warn: [], inp: {}, keyGot: false };
    var inp = { dx: 0, up: false, down: false, jump: false, fire: false };

    function score(n) { S.score += n; while (S.score >= S.nextLife) { S.nextLife += 30000; S.lives++; emit('life', {}); } }
    function loadLevel(i, keepCp) {
      S.li = i; S.lv = D.build(i); S.phase = 'play'; S.phaseT = 0;
      if (!keepCp) S.cp = -1;
      S.chestsBase = S.lv.chests.map(function (c, k) { return Object.assign({}, c, { c: (S.loop === 2 && k === 0) ? 'hammer' : c.c }); });
      respawn(true);
      emit('level', { idx: i, key: S.lv.key, loop: S.loop });
    }
    function respawn(fresh) {
      var lv = S.lv, at = S.cp >= 0 ? lv.cps[S.cp] : lv.start;
      var keepArmor = S.hero && fresh && S.hero.armor > 0 ? S.hero.armor : 1;
      S.hero = newHero(at.x, at.y); S.hero.armor = keepArmor; S.hero.inv = 1.0;
      S.timer = TIME; S.shots = []; S.eshots = []; S.enemies = []; S.items = []; S.flames = []; S.ring = null; S.warn = [];
      S.chests = S.chestsBase.filter(function (c) { return S.cp < 0 || c.x > lv.cps[S.cp].x; }).map(function (c) { return { x: c.x, y: c.y, c: c.c, hp: 2, open: false, t: 0 }; });
      S.spawnsDone = lv.spawns.map(function (s) { return S.cp >= 0 && s.x < lv.cps[S.cp].x; });
      S.boss = null; S.bossState = 'none'; S.riseT = 2.5; S.blubT = 2; S.keyGot = false;
      S.cam.x = Math.max(0, Math.min(lv.W - VIEW_W, S.hero.x - 12));
      if (!fresh) emit('respawn', {});
    }
    function startGame() { S.loop = 1; S.lives = LIVES; S.conts = CONTS; S.score = 0; S.nextLife = 20000; S.weapon = 'spear'; S.hero = null; loadLevel(0); return api; }

    // ---------- урон герою ----------
    function hurt(why, fromX) {
      var h = S.hero;
      if (S.phase !== 'play' || h.inv > 0 || h.dead || dmgMul === 0) return;
      if (h.armor > 0) {
        h.armor = 0; h.charge = 0; h.inv = INV; h.hurtT = 0.45; h.climb = false; h.ground = false; h.on = -1; h.crouch = false;
        var dir = fromX == null ? -h.face : (h.x < fromX ? -1 : 1);
        h.vx = dir * 2.6; h.vy = -7;
        emit('armorOff', { x: h.x, y: h.y - 1, why: why });
      } else die(why);
    }
    function die(why) {
      var h = S.hero; if (h.dead || S.phase !== 'play') return;
      h.dead = why; S.phase = 'dead'; S.phaseT = 0; emit('die', { x: h.x, y: h.y - 1, why: why });
    }

    // ---------- оружие ----------
    function count(k) { var n = 0; S.shots.forEach(function (s) { if (s.k === k || (k === 'torch' && s.k === 'flameT')) n++; }); if (k === 'torch') n += S.flames.length; return n; }
    function throwWeapon(special) {
      var h = S.hero, w = S.weapon, f = h.face, sx = h.x + f * 0.5, sy = h.y - (h.crouch ? 0.6 : 1.15);
      if (!special && count(w) >= WEAP[w].max) return false;
      h.throwT = 0.18;
      if (special) {
        var n, a;
        if (w === 'spear') for (a = -2; a <= 2; a++) S.shots.push({ k: 'spear', x: sx, y: sy, vx: f * 12 * Math.cos(a * 0.22), vy: 12 * Math.sin(a * 0.22), r: 0.3, dmg: 2, life: 1.2, sp: true });
        else if (w === 'axe') [-14, -11, -8].forEach(function (vy, k2) { S.shots.push({ k: 'axe', x: sx, y: sy, vx: f * (5 + k2 * 1.5), vy: vy, g: 26, r: 0.5, dmg: 3, pierce: true, life: 2, sp: true }); });
        else if (w === 'torch') { for (n = -4; n <= 4; n++) if (n) S.flames.push({ x: h.x + n * 0.9, y: h.y, life: 1.4, tick: 0, sp: true }); }
        else if (w === 'blades') for (n = 0; n < 8; n++) { a = n * Math.PI / 4; S.shots.push({ k: 'blades', x: h.x, y: h.y - 1, vx: Math.cos(a) * 11, vy: Math.sin(a) * 11, r: 0.25, dmg: 2, life: 0.55, sp: true }); }
        else if (w === 'shield') S.ring = { t: 3, a: 0 };
        else if (w === 'hammer') {
          S.enemies.forEach(function (e) { if (!e.dead && onScreen(e.x) && !FOE[e.type].fly) foeDamage(e, 3); });
          if (S.boss && !S.boss.dead && onScreen(S.boss.x)) bossDamage(4, 'hammer');
        }
        emit('special', { w: w, x: h.x, y: h.y - 1 });
        return true;
      }
      if (w === 'spear') S.shots.push({ k: 'spear', x: sx, y: sy, vx: f * 12, vy: 0, r: 0.3, dmg: 1, life: 1.4 });
      else if (w === 'axe') S.shots.push({ k: 'axe', x: sx, y: sy, vx: f * 7.5, vy: -8, g: 26, r: 0.45, dmg: 2, pierce: true, life: 2 });
      else if (w === 'torch') S.shots.push({ k: 'torch', x: sx, y: sy, vx: f * 6, vy: -4, g: 30, r: 0.3, dmg: 1, life: 2 });
      else if (w === 'blades') [-1.8, 0, 1.8].forEach(function (vy) { S.shots.push({ k: 'blades', x: sx, y: sy, vx: f * 13, vy: vy, r: 0.22, dmg: 1, life: 0.34 }); });
      else if (w === 'shield') S.shots.push({ k: 'shield', x: sx, y: sy, vx: f * 9, vy: 0, r: 0.5, dmg: 1, life: 1.6, back: false, t: 0 });
      else if (w === 'hammer') S.shots.push({ k: 'hammer', x: sx, y: sy, vx: f * 8, vy: -3, g: 30, r: 0.45, dmg: 3, pierce: true, life: 1.5 });
      emit('throw', { w: w });
      return true;
    }
    function onScreen(x) { return x > S.cam.x - 0.5 && x < S.cam.x + VIEW_W + 0.5; }

    // ---------- враги ----------
    function spawnFoe(type, x, y, extra) {
      var d = FOE[type], e = Object.assign({ type: type, x: x, y: y, vx: 0, vy: 0, hw: d.hw, hh: d.hh, hp: d.hp, t: 0, st: 'live', dead: false, face: -1 }, extra || {});
      S.enemies.push(e); return e;
    }
    function surfaceNear(c, y0) {
      var lv = S.lv;
      for (var dy = 0; dy <= 3; dy++) for (var s = -1; s <= 1; s += 2) {
        var r = Math.round(y0) + dy * s; if (isSolid(lv, c, r) && !isSolid(lv, c, r - 1) && !isSolid(lv, c, r - 2) && tileAt(lv, c, r - 1) === E && tileAt(lv, c, r - 2) === E) return r;
        if (!dy) break;
      }
      return -1;
    }
    function trySpawnRiser() {
      var h = S.hero, lv = S.lv, lim = S.loop === 2 ? 4 : 3, n = 0;
      S.enemies.forEach(function (e) { if (e.type === 'riser' && !e.dead) n++; });
      if (n >= lim) return;
      for (var k = 0; k < 6; k++) {
        var side = rng() < 0.6 ? h.face : -h.face, dist = 3 + Math.floor(rng() * 5), c = Math.floor(h.x + side * dist);
        if (c < 10 || c > lv.arena.x0 - 2 || !onScreen(c + 0.5)) continue;
        if (S.cp >= 0 && Math.abs(c + 0.5 - lv.cps[S.cp].x) < 3 && S.time - S.cpAt < 2) continue;
        var r = surfaceNear(c, h.y); if (r < 0) continue;
        spawnFoe('riser', c + 0.5, r, { st: 'rise', face: h.x < c + 0.5 ? -1 : 1 });
        emit('rise', { x: c + 0.5, y: r });
        return;
      }
    }
    function tryBlub() {
      var h = S.hero, lv = S.lv, best = -1, bd = 99;
      lv.pits.forEach(function (c) { var d = Math.abs(c + 0.5 - h.x); if (d >= 1.5 && d < 5.5 && d < bd && onScreen(c + 0.5)) { bd = d; best = c; } });
      if (best < 0) return;
      S.warn.push({ x: best + 0.5, t: 0.8 });
      emit('bubble', { x: best + 0.5 });
    }
    function foeDamage(e, dmg) {
      if (e.dead) return;
      if (e.st === 'rise' && e.t < 0.4) return;
      e.hp -= dmg; e.flash = 0.12;
      if (e.hp <= 0) { e.dead = true; score(PTS[e.type] || 100); emit('kill', { x: e.x, y: e.y - e.hh / 2, type: e.type }); if (e.type === 'kite' && rng() < 0.35) dropItem(e.x, e.y, randomWeapon()); }
      else emit('hit', { x: e.x, y: e.y - e.hh / 2 });
    }
    function randomWeapon() { var ws = ['spear', 'axe', 'torch', 'blades', 'shield']; return 'w:' + ws[Math.floor(rng() * ws.length)]; }
    function dropItem(x, y, k) { S.items.push({ k: k, x: x, y: y - 0.5, vy: -6, ground: false, t: 0 }); }
    function bodyFall(e, dt, g) {
      e.vy = Math.min(FALLMAX, e.vy + (g || G) * dt); var py = e.y; e.y += e.vy * dt;
      if (e.vy > 0) for (var r = Math.ceil(py - 1e-4); r <= Math.floor(e.y); r++) if (isTop(S.lv, Math.floor(e.x), r)) { e.y = r; e.vy = 0; return true; }
      return false;
    }
    function walkFoe(e, sp, dt) {
      var lv = S.lv, nx = e.x + e.face * sp * dt, ahead = Math.floor(nx + e.face * e.hw);
      if (isSolid(lv, ahead, Math.round(e.y) - 1) || !isTop(lv, ahead, Math.round(e.y))) { e.face = -e.face; return; }
      e.x = nx;
    }
    function updFoe(e, dt) {
      var h = S.hero, sp = S.loop === 2 ? 1.15 : 1;
      e.t += dt; if (e.flash > 0) e.flash -= dt;
      switch (e.type) {
        case 'riser':
          if (e.st === 'rise') { if (e.t > 0.9) { e.st = 'live'; e.t = 0; } return; }
          if (e.st === 'sink') { if (e.t > 0.8) e.dead = true; return; }
          if (e.t > 9 && !onScreen(e.x)) { e.dead = true; return; }
          if (e.t > 7) { e.st = 'sink'; e.t = 0; return; }
          walkFoe(e, 1.3 * sp, dt);
          if (Math.abs(h.x - e.x) > 4 && e.t % 2 < dt) e.face = h.x < e.x ? -1 : 1;
          return;
        case 'blub':
          e.vy += 22 * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.face = e.vx < 0 ? -1 : 1;
          if (e.y > R + 0.5 && e.vy > 0) e.dead = true;
          return;
        case 'kite': {
          var side = e.side || 1;
          if (e.st === 'enter' || e.st === 'hover') {
            var tx = h.x + side * 5, ty = Math.max(1.5, h.y - 5.5);
            e.x += (tx - e.x) * Math.min(1, dt * 2.2); e.y += (ty - e.y) * Math.min(1, dt * 2.2); e.face = h.x < e.x ? -1 : 1;
            if (e.st === 'enter' && e.t > 1.0) { e.st = 'hover'; e.t = 0; }
            if (e.st === 'hover' && e.t > 1.4 && h.ground && h.on < 0 && !h.climb) { e.st = 'warn'; e.t = 0; e.tx = h.x; e.ty = h.y - 0.8; emit('kiteWarn', { x: e.x, y: e.y }); }
          } else if (e.st === 'warn') { if (e.t > 0.6) { e.st = 'dive'; e.t = 0; var dx = e.tx - e.x, dy = e.ty - e.y, n = Math.hypot(dx, dy) || 1; e.vx = dx / n * 8 * sp; e.vy = dy / n * 8 * sp; emit('dive', {}); } }
          else if (e.st === 'dive') { e.x += e.vx * dt; e.y += e.vy * dt; if (e.y >= e.ty || e.t > 1.2) { e.st = 'up'; e.t = 0; e.dives = (e.dives || 0) + 1; e.side = -side; } }
          else if (e.st === 'up') { e.y -= 7 * dt; e.x += e.vx * 0.5 * dt; if (e.t > 0.7) { if (e.dives >= 2) { e.st = 'leave'; } else { e.st = 'hover'; e.t = 0; } } }
          else if (e.st === 'leave') { e.y -= 8 * dt; if (e.y < -3) e.dead = true; }
          return;
        }
        case 'vent':
          if (e.st === 'hidden') { if (Math.abs(h.x - e.x) < 11) { e.st = 'up'; e.t = 0; } return; }
          if (e.st === 'up') { if (e.t > 0.6) { e.st = 'live'; e.t = 0; e.cd = 1.5; } return; }
          e.face = h.x < e.x ? -1 : 1;
          e.cd -= dt * sp;
          if (e.cd <= 0 && Math.abs(h.x - e.x) < 10) {
            e.cd = 3.0; var tt = 1.25, gg = 18, ddx = h.x - e.x, ddy = (h.y - 0.4) - (e.y - 1.3);
            S.eshots.push({ kind: 'slag', x: e.x, y: e.y - 1.3, vx: ddx / tt, vy: (ddy - 0.5 * gg * tt * tt) / tt, g: gg, r: 0.3, life: 3 });
            emit('spit', {});
          }
          return;
        case 'brute':
          e.face = h.x < e.x ? -1 : 1;
          if (e.vy !== 0 || !isTop(S.lv, Math.floor(e.x), Math.round(e.y)) || Math.abs(e.y - Math.round(e.y)) > 1e-3) { e.x += e.vx * dt; if (bodyFall(e, dt, 30)) e.vx = 0; if (e.y > R + 2) e.dead = true; return; }
          if (Math.abs(h.x - e.x) > 14) return;
          walkFoe(e, 1.1 * sp, dt);
          e.hop = (e.hop || 2.5) - dt;
          if (e.hop <= 0) { e.hop = 2.5 + rng(); e.vy = -9; e.vx = e.face * 2; e.y -= 0.01; emit('hop', {}); }
          return;
      }
    }

    // ---------- стражи ----------
    function bossHp() { var d = S.lv.def; return Math.round(d.bhp * (S.loop === 2 ? 1.25 : 1)); }
    function startBoss() {
      var a = S.lv.arena, k = a.boss, d = BOSS[k];
      S.boss = { key: k, x: a.x0 + 20, y: d.fly ? a.y - 6 : a.y, hw: d.hw, hh: d.hh, fly: !!d.fly, hp: bossHp(), max: bossHp(), mode: 'intro', mt: 0, vx: 0, vy: 0, face: -1, dead: false, flash: 0, cyc: 0 };
      S.bossState = 'intro'; S.phaseT = 0;
      if (S.lv.final && S.loop === 2 && S.weapon !== 'hammer') S.items.push({ k: 'hammer', x: a.x0 + 2.5, y: a.y, vy: 0, ground: true, t: 0, pedestal: true });
      emit('bossIntro', { key: k, final: S.lv.final, loop: S.loop });
    }
    function bmode(b, m) { b.mode = m; b.mt = 0; b.did = false; }
    function eshot(o) { o.life = o.life || 4; S.eshots.push(o); return o; }
    function updBoss(b, dt) {
      var h = S.hero, a = S.lv.arena, side = h.x < b.x ? -1 : 1, sp = S.loop === 2 ? 1.15 : 1;
      b.mt += dt; if (b.flash > 0) b.flash -= dt;
      var lo = a.x0 + 1 + b.hw, hi = a.x1 + 1 - b.hw;
      switch (b.key) {
        case 'golem':
          if (b.mode === 'intro') { if (b.mt > 1.2) bmode(b, 'walk'); break; }
          if (b.mode === 'walk') { b.face = side; b.x += side * 1.4 * sp * dt; if (b.mt > 1.5) { b.cyc++; bmode(b, b.cyc % 3 === 2 ? 'hop' : 'wind'); } }
          else if (b.mode === 'wind') { b.face = side; if (b.mt > 0.6) bmode(b, 'throw'); }
          else if (b.mode === 'throw') { if (!b.did) { b.did = true; (b.cyc % 2 ? [3.5, 8] : [5.5]).forEach(function (v) { eshot({ kind: 'slag', x: b.x + b.face, y: b.y - 2.4, vx: b.face * v * sp, vy: -9, g: 20, r: 0.35 }); }); emit('spit', { big: true }); } if (b.mt > 0.7) bmode(b, 'walk'); }
          else if (b.mode === 'hop') {
            if (!b.did) { b.did = true; b.vy = -13; b.vx = Math.max(-7, Math.min(7, (h.x - b.x) / 1.3)); emit('hop', { big: true }); }
            b.vy += 22 * dt; b.y += b.vy * dt; b.x += b.vx * dt;
            if (b.y >= a.y && b.vy > 0) { b.y = a.y; b.vy = 0; emit('stomp', {}); bmode(b, 'walk'); }
          }
          break;
        case 'crab':
          if (b.mode === 'intro') { if (b.mt > 1.2) bmode(b, 'scuttle'); break; }
          if (b.mode === 'scuttle') { if (!b.vx) b.vx = 3.2 * sp; b.x += b.vx * dt; if (b.x < lo + 2 || b.x > hi - 2) b.vx = -b.vx; b.face = side; if (b.mt > 2.2) { b.cyc++; bmode(b, b.cyc % 2 ? 'aim' : 'spit'); } }
          else if (b.mode === 'aim') { b.face = side; b.vx = 0; if (b.mt > 0.75) { bmode(b, 'dash'); b.vx = side * 9 * sp; emit('dash', {}); } }
          else if (b.mode === 'dash') { b.x += b.vx * dt; if (b.x <= lo || b.x >= hi || b.mt > 2.5) { b.vx = 0; bmode(b, 'scuttle'); } }
          else if (b.mode === 'spit') { b.face = side; if (!b.did && b.mt > 0.5) { b.did = true; var hy = (b.cyc % 4 === 0) ? 1.5 : 0.5; eshot({ kind: 'bubble', x: b.x + side * 1.4, y: b.y - hy, vx: side * 4 * sp, vy: 0, r: 0.35 }); emit('spit', {}); } if (b.mt > 1.1) bmode(b, 'scuttle'); }
          break;
        case 'serpent':
          if (b.mode === 'intro') { b.y = a.y - 3.8; if (b.mt > 1.2) { bmode(b, 'glide'); b.vx = 3.2 * sp; } break; }
          if (b.mode === 'glide') {
            b.x += b.vx * dt; if (b.x < lo + 1 || b.x > hi - 1) b.vx = -b.vx; b.face = b.vx < 0 ? -1 : 1;
            b.y = a.y - 3.8 + Math.sin(b.mt * 2.4) * 0.5;
            b.cd = (b.cd || 1.1) - dt; if (b.cd <= 0) { b.cd = 1.1; eshot({ kind: 'bolt', x: b.x, y: b.y + 0.3, vx: 0, vy: 2, g: 14, r: 0.25 }); emit('spit', {}); }
            if (b.mt > 3.2) bmode(b, 'warn');
          } else if (b.mode === 'warn') { if (b.mt > 0.6) { bmode(b, 'dive'); var dy = (a.y - 1.0) - b.y, dx = b.tx - b.x, n = Math.hypot(dx, dy) || 1; b.dvx = dx / n * 9 * sp; b.dvy = dy / n * 9 * sp; emit('dive', {}); } else if (!b.did) { b.did = true; b.tx = h.x; } }
          else if (b.mode === 'dive') { b.x += b.dvx * dt; b.y += b.dvy * dt; if (b.y >= a.y - 1.0 || b.mt > 1.5) { b.y = Math.min(b.y, a.y - 1.0); bmode(b, 'low'); } }
          else if (b.mode === 'low') { b.face = side; if (b.mt > 0.8) bmode(b, 'rise'); }
          else if (b.mode === 'rise') { b.y -= 5 * dt; if (b.y <= a.y - 3.8) { bmode(b, 'glide'); b.vx = (h.x < b.x ? -3.2 : 3.2) * sp; } }
          b.x = Math.max(lo, Math.min(hi, b.x));
          break;
        case 'koshey':
          if (b.mode === 'intro') { if (b.mt > 1.6) bmode(b, 'stand'); break; }
          b.face = side;
          if (b.mode === 'stand') { if (b.mt > 0.9) { b.cyc++; bmode(b, b.cyc % 4 === 3 ? 'summon' : 'cast'); } }
          else if (b.mode === 'cast') {
            if (b.mt < 0.05 && !b.pat) b.pat = rng() < 0.5 ? 'hi' : 'lo';
            if (!b.did && b.mt > 0.7) { b.did = true; (b.pat === 'hi' ? [1.5, 2.6] : [0.4]).forEach(function (hy) { eshot({ kind: 'rust', x: b.x + side, y: a.y - hy, vx: side * 7 * sp, vy: 0, r: 0.3 }); }); emit('cast', {}); }
            if (b.mt > 1.0) b.pat = null;
            if (b.mt > 1.1) { b.pat = null; bmode(b, 'fade'); }
          } else if (b.mode === 'summon') {
            if (!b.did && b.mt > 0.6) { b.did = true; [-4, 4].forEach(function (o) { var c = Math.floor(h.x + o); if (c > a.x0 && c < a.x1) { spawnFoe('riser', c + 0.5, a.y, { st: 'rise', face: o < 0 ? 1 : -1 }); emit('rise', { x: c + 0.5, y: a.y }); } }); }
            if (b.mt > 1.2) bmode(b, 'fade');
          } else if (b.mode === 'fade') {
            if (b.mt > 0.5 && !b.did) { b.did = true; var nx = h.x + (h.x < (a.x0 + a.x1) / 2 ? 1 : -1) * (7 + rng() * 2); b.x = Math.max(lo + 1, Math.min(hi - 1, nx)); }
            if (b.mt > 0.9) bmode(b, 'stand');
          }
          break;
      }
      b.x = Math.max(lo, Math.min(hi, b.x));
    }
    function bossVulnerable(b, k) {
      if (b.mode === 'intro') return false;
      if (b.key === 'koshey' && b.mode === 'fade' && b.mt > 0.3) return false;
      if (b.key === 'koshey' && S.loop === 2 && k !== 'hammer') return false;
      return true;
    }
    function bossDamage(dmg, k) {
      var b = S.boss; if (!b || b.dead) return;
      if (!bossVulnerable(b, k)) { emit('clink', { x: b.x, y: b.y - b.hh / 2 }); return; }
      b.hp -= dmg; b.flash = 0.12; emit('bossHit', { x: b.x, y: b.y - b.hh / 2 });
      if (b.hp <= 0) {
        b.dead = true; S.bossState = 'dead'; S.eshots = [];
        S.enemies.forEach(function (e) { e.dead = true; });
        var pts = b.key === 'koshey' ? 10000 : 3000; score(pts);
        emit('bossDie', { x: b.x, y: b.y - b.hh / 2, key: b.key, pts: pts });
        if (S.lv.final) { S.phase = 'clear'; S.phaseT = 0; S.keyGot = true; emit('clear', { final: true, loop: S.loop }); }
        else S.items.push({ k: 'key', x: b.x, y: Math.min(S.lv.arena.y - 0.5, b.y - 1), vy: -6, ground: false, t: 0 });
      }
    }

    // ---------- сундуки и предметы ----------
    function openChest(ch) {
      ch.open = true; ch.t = 0; score(PTS.chest); emit('chest', { x: ch.x, y: ch.y, c: ch.c });
      if (ch.c === 'trap') { spawnFoe('brute', ch.x, ch.y); emit('trap', { x: ch.x, y: ch.y }); return; }
      dropItem(ch.x, ch.y - 0.6, ch.c === 'arm' || ch.c === 'gold' || ch.c === 'hammer' ? ch.c : 'w:' + ch.c);
    }
    function pickup(it) {
      var h = S.hero; it.got = true;
      if (it.k === 'arm') { if (h.armor === 0) h.armor = 1; else score(500); emit('pickup', { k: 'arm', x: it.x, y: it.y }); }
      else if (it.k === 'gold') { h.armor = h.armor >= 1 ? 2 : 1; emit('pickup', { k: h.armor === 2 ? 'gold' : 'arm', x: it.x, y: it.y }); }
      else if (it.k === 'hammer') { S.weapon = 'hammer'; emit('pickup', { k: 'hammer', x: it.x, y: it.y }); emit('weapon', { w: 'hammer' }); }
      else if (it.k === 'key') { S.keyGot = true; S.phase = 'clear'; S.phaseT = 0; var bonus = Math.floor(S.timer) * 10; score(bonus); emit('clear', { bonus: bonus, loop: S.loop }); }
      else if (it.k.indexOf('w:') === 0) { var w = it.k.slice(2); if (w === 'hammer' || WLIST.indexOf(w) < 0) return; S.weapon = w; emit('weapon', { w: w }); emit('pickup', { k: it.k, x: it.x, y: it.y }); }
    }

    // ---------- шаг ----------
    function overlap(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1) { return ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0; }
    function heroBox() { var h = S.hero, hh = heroH(h); return [h.x - HW + 0.06, h.y - hh + 0.08, h.x + HW - 0.06, h.y]; }
    function update(dt) {
      S.time += dt;
      if (S.phase === 'dead') {
        S.phaseT += dt;
        if (S.phaseT > 1.8) {
          S.lives--;
          if (S.lives > 0) { S.phase = 'play'; respawn(false); }
          else if (S.conts > 0) { S.phase = 'cont'; S.phaseT = 0; emit('continueQ', { left: S.conts }); }
          else { S.phase = 'over'; emit('gameover', { score: S.score }); }
        }
        return;
      }
      if (S.phase === 'clear') {
        S.phaseT += dt;
        if (S.phaseT > 3.2) {
          if (S.lv.final) {
            if (S.loop === 1) { S.phase = 'loopEnd'; S.phaseT = 0; emit('loopEnd', {}); }
            else { S.phase = 'won'; emit('win', { score: S.score }); }
          } else { var keep = S.hero.armor; loadLevel(S.li + 1); S.hero.armor = Math.max(1, keep); }
        }
        return;
      }
      if (S.phase === 'loopEnd') { S.phaseT += dt; if (S.phaseT > 7) beginLoop2(); return; }
      if (S.phase !== 'play') return;
      var lv = S.lv, h = S.hero, i;
      S.t += dt;
      S.timer -= dt; if (S.timer <= 0) { S.timer = 0; die('time'); return; }
      var Wd = world(lv, S.t, dt);
      var fighting = S.bossState === 'fight' || S.bossState === 'intro';
      // ввод и герой
      var ev = heroStep(Wd, h, { dx: inp.dx, up: inp.up, down: inp.down, jump: inp.jump }, dt);
      if (ev) emit(ev, { x: h.x, y: h.y });
      // граница камеры слева на арене
      if (S.bossState !== 'none') { var lx = lv.arena.x0 - 2.5 + HW; if (h.x < lx) h.x = lx; }
      // бросок: по нажатию; в золотом доспехе — удержание заряжает особый удар
      var fEdge = inp.fire && !h.fprev;
      if (h.throwT > 0) h.throwT -= dt;
      h.cd = (h.cd || 0) - dt;
      if (!h.climb && h.hurtT <= 0) {
        if (fEdge && h.cd <= 0) { if (throwWeapon(false)) h.cd = WEAP[S.weapon].cd; }
        if (inp.fire && h.armor === 2) { var pc = h.charge; h.charge += dt; if (pc < CHARGE && h.charge >= CHARGE) emit('charged', {}); }
        if (!inp.fire && h.fprev && h.charge >= CHARGE && h.armor === 2) { throwWeapon(true); h.cd = 0.3; }
        if (!inp.fire) h.charge = 0;
      } else h.charge = 0;
      h.fprev = !!inp.fire;
      // гибель от пропасти/жидкости
      if (lv.liquid && h.y > R - 0.55) { die('liquid'); return; }
      if (h.y > R + 1) { die('pit'); return; }
      // отметка
      lv.cps.forEach(function (cp, k) { if (k > S.cp && h.x >= cp.x && h.ground) { S.cp = k; S.cpAt = S.time; emit('checkpoint', { x: cp.x, y: cp.y }); } });
      // камера
      if (S.bossState !== 'none') S.cam.x += ((lv.arena.x0 - 3) - S.cam.x) * Math.min(1, dt * 4);
      else S.cam.x = Math.max(0, Math.min(lv.W - VIEW_W, h.x - 12));
      // засады
      lv.spawns.forEach(function (s, k) {
        if (S.spawnsDone[k] || s.x > S.cam.x + VIEW_W + 1) return;
        S.spawnsDone[k] = true;
        if (s.type === 'kite') spawnFoe('kite', S.cam.x + VIEW_W + 1, 1, { st: 'enter', side: 1 });
        else if (s.type === 'vent') spawnFoe('vent', s.x, s.y, { st: 'hidden' });
        else spawnFoe(s.type, s.x, s.y);
      });
      // окалыши из земли и бульки из жижи
      if (!fighting && S.bossState === 'none') {
        S.riseT -= dt * (S.loop === 2 ? 1.3 : 1);
        if (S.riseT <= 0) { S.riseT = lv.rise * (0.7 + 0.6 * rng()); if (h.ground) trySpawnRiser(); }
        if (lv.liquid) { S.blubT -= dt; if (S.blubT <= 0) { S.blubT = 3.4 + rng() * 1.6; tryBlub(); } }
      }
      for (i = S.warn.length - 1; i >= 0; i--) { var wv = S.warn[i]; wv.t -= dt; if (wv.t <= 0) { S.warn.splice(i, 1); spawnFoe('blub', wv.x, R - 0.3, { vx: (h.x < wv.x ? -1 : 1) * 1.0, vy: -15.2 }); emit('splash', { x: wv.x }); } }
      // арена
      if (S.bossState === 'none' && h.x > lv.arena.x0 + 3) { S.enemies.forEach(function (e) { if (e.type === 'riser' || e.type === 'blub') e.dead = true; }); startBoss(); }
      if (S.bossState === 'intro' && S.boss.mode !== 'intro') S.bossState = 'fight';
      if (S.boss && !S.boss.dead) updBoss(S.boss, dt);
      // враги
      S.enemies.forEach(function (e) { if (!e.dead) updFoe(e, dt); });
      // броски героя
      for (i = S.shots.length - 1; i >= 0; i--) {
        var s = S.shots[i]; s.life -= dt;
        if (s.g) s.vy += s.g * dt;
        if (s.k === 'shield') { s.t += dt; if (!s.back && s.t > 0.45) s.back = true; if (s.back) { var dxs = h.x - s.x, dys = (h.y - 1) - s.y, ns = Math.hypot(dxs, dys) || 1; s.vx = dxs / ns * 10; s.vy = dys / ns * 10; if (ns < 0.6) { S.shots.splice(i, 1); continue; } } }
        s.x += s.vx * dt; s.y += s.vy * dt;
        var gone = s.life <= 0 || !onScreen(s.x) || s.y > R + 1;
        if (!gone && isSolid(lv, Math.floor(s.x), Math.floor(s.y))) {
          if (s.k === 'torch') { S.flames.push({ x: s.x, y: Math.floor(s.y), life: 1.1, tick: 0 }); gone = true; emit('flame', {}); }
          else if (s.k === 'hammer' && s.vy > 0) { s.y = Math.floor(s.y) - 0.01; s.vy = -6; emit('clank', {}); }
          else if (s.k === 'shield') s.back = true;
          else gone = true;
        }
        if (gone) { S.shots.splice(i, 1); continue; }
        // по врагам
        s.hit = s.hit || [];
        for (var k = 0; k < S.enemies.length; k++) {
          var e = S.enemies[k]; if (e.dead || s.hit.indexOf(e) >= 0) continue;
          if (e.type === 'vent' && e.st === 'hidden') continue;
          if (overlap(s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r, e.x - e.hw, e.y - e.hh, e.x + e.hw, e.y)) {
            foeDamage(e, s.dmg); s.hit.push(e);
            if (!s.pierce) { if (s.k === 'shield') s.back = true; else if (s.k === 'torch') { S.flames.push({ x: s.x, y: e.y, life: 0.8, tick: 0 }); s.life = 0; } else { s.life = 0; } break; }
          }
        }
        // по сундукам
        S.chests.forEach(function (ch) {
          if (ch.open || s.life <= 0 || s.hit.indexOf(ch) >= 0) return;
          if (overlap(s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r, ch.x - 0.55, ch.y - 0.9, ch.x + 0.55, ch.y)) { s.hit.push(ch); ch.hp--; ch.flash = 0.1; emit('knock', {}); if (ch.hp <= 0) openChest(ch); if (!s.pierce) s.life = 0; }
        });
        // по стражу
        var b = S.boss;
        if (b && !b.dead && s.life > 0 && s.hit.indexOf(b) < 0 && overlap(s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r, b.x - b.hw, b.y - b.hh, b.x + b.hw, b.y)) {
          s.hit.push(b); bossDamage(s.dmg, s.k); if (!s.pierce) { if (s.k === 'shield') s.back = true; else s.life = 0; }
        }
        // щит гасит вражеские снаряды
        if (s.k === 'shield') for (var q = S.eshots.length - 1; q >= 0; q--) { var es = S.eshots[q]; if (Math.hypot(es.x - s.x, es.y - s.y) < s.r + es.r + 0.1) { S.eshots.splice(q, 1); emit('block', {}); } }
        if (s.life <= 0) S.shots.splice(i, 1);
      }
      // огонь факела по земле
      for (i = S.flames.length - 1; i >= 0; i--) {
        var fl = S.flames[i]; fl.life -= dt; fl.tick -= dt;
        if (fl.tick <= 0) {
          fl.tick = 0.25;
          S.enemies.forEach(function (e) { if (!e.dead && overlap(fl.x - 0.6, fl.y - 1.1, fl.x + 0.6, fl.y, e.x - e.hw, e.y - e.hh, e.x + e.hw, e.y)) foeDamage(e, 1); });
          var bb = S.boss; if (bb && !bb.dead && overlap(fl.x - 0.6, fl.y - 1.1, fl.x + 0.6, fl.y, bb.x - bb.hw, bb.y - bb.hh, bb.x + bb.hw, bb.y)) bossDamage(1, 'torch');
          S.chests.forEach(function (ch) { if (!ch.open && Math.abs(ch.x - fl.x) < 1 && Math.abs(ch.y - fl.y) < 0.6 && !fl.burnt) { fl.burnt = true; ch.hp--; if (ch.hp <= 0) openChest(ch); } });
        }
        if (fl.life <= 0) S.flames.splice(i, 1);
      }
      // кольцо щитов (особый удар)
      if (S.ring) {
        S.ring.t -= dt; S.ring.a += dt * 7;
        for (var rq = 0; rq < 4; rq++) {
          var ra = S.ring.a + rq * Math.PI / 2, rx = h.x + Math.cos(ra) * 1.6, ry = h.y - 1 + Math.sin(ra) * 1.6;
          for (var q2 = S.eshots.length - 1; q2 >= 0; q2--) if (Math.hypot(S.eshots[q2].x - rx, S.eshots[q2].y - ry) < 0.8) S.eshots.splice(q2, 1);
          S.enemies.forEach(function (e) { if (!e.dead && overlap(rx - 0.4, ry - 0.4, rx + 0.4, ry + 0.4, e.x - e.hw, e.y - e.hh, e.x + e.hw, e.y) && !(e.ringT > 0)) { e.ringT = 0.3; foeDamage(e, 1); } if (e.ringT > 0) e.ringT -= dt / 4; });
        }
        if (S.ring.t <= 0) S.ring = null;
      }
      // вражеские снаряды
      var hb = heroBox();
      for (i = S.eshots.length - 1; i >= 0; i--) {
        var es2 = S.eshots[i]; es2.life -= dt;
        if (es2.g) es2.vy += es2.g * dt;
        es2.x += es2.vx * dt; es2.y += es2.vy * dt;
        if (es2.life <= 0 || es2.y > R + 1 || isSolid(lv, Math.floor(es2.x), Math.floor(es2.y)) || es2.x < S.cam.x - 2 || es2.x > S.cam.x + VIEW_W + 2) { S.eshots.splice(i, 1); continue; }
        if (overlap(es2.x - es2.r, es2.y - es2.r, es2.x + es2.r, es2.y + es2.r, hb[0], hb[1], hb[2], hb[3])) { S.eshots.splice(i, 1); hurt(es2.kind, es2.x); if (S.phase !== 'play') return; }
      }
      // касания
      S.enemies.forEach(function (e) {
        if (e.dead || S.phase !== 'play') return;
        if (e.type === 'riser' && (e.st === 'rise' || e.st === 'sink')) return;
        if (e.type === 'vent' && e.st === 'hidden') return;
        if (overlap(e.x - e.hw + 0.1, e.y - e.hh + 0.1, e.x + e.hw - 0.1, e.y, hb[0], hb[1], hb[2], hb[3])) hurt(e.type, e.x);
      });
      var B = S.boss;
      if (B && !B.dead && S.phase === 'play' && !(B.key === 'koshey' && B.mode === 'fade' && B.mt > 0.3) && overlap(B.x - B.hw + 0.15, B.y - B.hh + 0.15, B.x + B.hw - 0.15, B.y, hb[0], hb[1], hb[2], hb[3])) hurt('boss', B.x);
      if (S.phase !== 'play') return;
      S.enemies = S.enemies.filter(function (e) { return !e.dead; });
      // предметы
      for (i = S.items.length - 1; i >= 0; i--) {
        var it = S.items[i]; it.t += dt;
        if (!it.ground) { if (bodyFall(it, dt, 26)) it.ground = true; if (it.y > R + 1) { S.items.splice(i, 1); continue; } }
        if (it.t > 0.3 && Math.abs(it.x - h.x) < 0.7 && it.y > h.y - HH - 0.3 && it.y - 0.8 < h.y) { pickup(it); S.items.splice(i, 1); if (S.phase !== 'play') return; continue; }
        if (it.k !== 'key' && !it.pedestal && it.t > 14) S.items.splice(i, 1);
      }
      S.chests.forEach(function (ch) { if (ch.flash > 0) ch.flash -= dt; if (ch.open) ch.t += dt; });
    }
    function beginLoop2() { S.loop = 2; var arm = S.hero ? Math.max(1, S.hero.armor) : 1; loadLevel(0); S.hero.armor = arm; emit('loop2', {}); }
    function continueGame() {
      if (S.phase !== 'cont' || S.conts <= 0) return false;
      S.conts--; S.lives = LIVES; S.score = 0; S.nextLife = 20000; S.cp = -1; S.hero = null; loadLevel(S.li); emit('continued', { left: S.conts }); return true;
    }
    function giveUp() { if (S.phase === 'cont') { S.phase = 'over'; emit('gameover', { score: S.score }); } }

    var api = {
      start: startGame, update: update, state: function () { return S; },
      setInput: function (o) { inp.dx = o.dx || 0; inp.up = !!o.up; inp.down = !!o.down; inp.jump = !!o.jump; inp.fire = !!o.fire; },
      continueGame: continueGame, giveUp: giveUp, skipLoopEnd: function () { if (S.phase === 'loopEnd' && S.phaseT > 1) beginLoop2(); },
      // тестовые хуки
      _level: function (i, loop) { if (loop) S.loop = loop; S.hero = null; loadLevel(i); return S; },
      _place: function (x, y) { S.hero.x = x; S.hero.y = y; S.hero.ground = true; S.hero.on = -1; },
      _hurt: hurt, _die: die, _weapon: function (w) { S.weapon = w; }, _throw: throwWeapon, _spawn: spawnFoe, _startBoss: startBoss,
      _bossDamage: bossDamage, _openChest: openChest, _pickup: pickup, _beginLoop2: beginLoop2, _score: score
    };
    return api;
  }

  D.logic = {
    WALK: WALK, JV: JV, G: G, CLIMB: CLIMB, HW: HW, HH: HH, CH: CH, VIEW_W: VIEW_W, VIEW_H: VIEW_H, TIME: TIME, LIVES: LIVES, CONTS: CONTS, CHARGE: CHARGE, INV: INV,
    WEAP: WEAP, WLIST: WLIST, FOE: FOE, BOSS: BOSS, PTS: PTS, R: R, E: E, SOL: SOL, ONE: ONE, LAD: LAD,
    mulberry32: mulberry32, tileAt: tileAt, isSolid: isSolid, isTop: isTop, boxSolid: boxSolid, platPhase: platPhase, world: world,
    newHero: newHero, heroStep: heroStep, support: support, simulate: simulate, Nav: Nav, rideCtl: rideCtl, isNode: isNode
  };
  D.Game = function (o) { return Game(o); };
})(typeof window !== 'undefined' ? window : globalThis);
