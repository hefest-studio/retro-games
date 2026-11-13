/* ОРУЖЕЙНИК · логика (без DOM, детерминирована при заданном rng). ORUZH.Game(opts) → api; ORUZH.logic — физика,
   оружие, боссы, граф проходимости (Nav) для тестов и бота. Единицы — клетки (24 px), секунды; y вниз; тело: x — центр, y — низ. */
(function (global) {
  'use strict';
  var OZ = global.ORUZH = global.ORUZH || {};
  var LT = OZ.levelTiles, R = LT.R, E = LT.E, SOL = LT.SOL, SPK = LT.SPK, BLK = LT.BLK, GATE = LT.GATE;

  // ---------- константы ----------
  var VIEW_W = 26, HW = 0.35, HH = 1.5, SH = 0.75;
  var RUN = 5.2, JV = 16.5, G = 42, JCUT = 5, MAXF = 18, SLV = 8.5, SLT = 0.42, COY = 0.07, JBUF = 0.1, KNOCK_V = 2.4;
  var BL_P = 3.0, BL_STEP = 1.0, BL_ON = 2.0;            // мигающие блоки: такт 3 с (6 долей при 120 уд/мин)
  var MAX_HP = 28, MAX_EN = 28, LIVES = 3, MAX_TANKS = 4;
  var CH1 = 0.55, CH2 = 1.25;                              // заряд наруча: ступени, с
  var BOSSES = ['hammer', 'gear', 'magnet', 'fan', 'frost', 'spring', 'volt', 'bell'];
  // оружие: индекс 0 — наруч (искра), 1..8 — трофеи боссов в порядке BOSSES
  var WEAP = [
    { k: 'spark', cost: 0, max: 3 },        // наруч-самострел: болт-искра, заряд — до 2 ступеней
    { k: 'boomer', cost: 1, max: 1 },       // молот-бумеранг (Мастер Молотобой) — летит и возвращается
    { k: 'gear', cost: 3, max: 1 },         // щит-шестерня (Мастер Шестерник) — кольцо зубьев гасит снаряды
    { k: 'mine', cost: 2, max: 1 },         // магнитная мина (Мастер Магнитчик) — катится по полу
    { k: 'fan', cost: 2, max: 3 },          // огненный веер (Мастер Горнило) — три языка пламени
    { k: 'frost', cost: 2, max: 2 },        // ледяная окалина (Мастер Закальщик) — навес, ледяная корка на полу
    { k: 'harpoon', cost: 2, max: 1 },      // пружинный гарпун (Мастер Пружинник) — пробивает и отталкивает
    { k: 'chain', cost: 1 / 3, max: 6 },    // искровая цепь (Мастер Разрядник) — очередь разрядов
    { k: 'smoke', cost: 3, max: 1 }         // дымовой колокол (Мастер Звонарь) — дымовые кольца по полу в обе стороны
  ];
  // круг слабостей: босс → оружие (одна замкнутая цепь из 8)
  var WEAK = { hammer: 'smoke', spring: 'gear', bell: 'frost', magnet: 'chain', frost: 'mine', gear: 'fan', volt: 'harpoon', fan: 'boomer',
    ladle: 'chain', crane: 'boomer', walker: 'smoke', core: 'fan' };
  var BOSS_HP = 28, REMATCH_HP = 14;

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- мир и столкновения ----------
  // W = { W (ширина), t, grp, open (ворота считаются открытыми — для графа) }
  function tileAt(W, c, r) { if (c < 0 || c >= W.W) return SOL; if (r < 0 || r >= R) return E; return W.t[r * W.W + c]; }
  function blinkOn(gr, t) { var p = ((t - gr * BL_STEP) % BL_P + BL_P) % BL_P; return p < BL_ON; }
  function solid(W, c, r, t) {
    var v = tileAt(W, c, r);
    if (v === SOL) return true;
    if (v === GATE) return !W.open;
    if (v === BLK) return t != null && blinkOn(W.grp[r * W.W + c], t);
    return false;
  }
  function boxHit(W, x0, y0, x1, y1, t) {
    var c0 = Math.floor(x0), c1 = Math.floor(x1 - 1e-6), r0 = Math.floor(y0), r1 = Math.floor(y1 - 1e-6);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (solid(W, c, r, t)) return true;
    return false;
  }
  function spikeHit(W, x0, y0, x1, y1) {
    var c0 = Math.floor(x0 + 0.12), c1 = Math.floor(x1 - 0.12), r0 = Math.floor(y0), r1 = Math.floor(y1 - 0.08);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (tileAt(W, c, r) === SPK) return true;
    return false;
  }
  function newHero(x, y) { return { x: x, y: y, vx: 0, vy: 0, face: 1, ground: true, coy: 0, jbuf: 0, slide: false, slideT: 0, knockT: 0, knockDir: 0, push: 0, inv: 0, hp: MAX_HP, dead: null, runT: 0, shootT: 0, charge: 0 }; }
  function heroH(h) { return h.slide ? SH : HH; }
  function canStand(W, h, t) { return !boxHit(W, h.x - HW, h.y - HH, h.x + HW, h.y, t); }
  function moveX(W, h, dx, hh, t) {
    var n = Math.max(1, Math.ceil(Math.abs(dx) / 0.2)), s = dx / n, hit = false;
    for (var i = 0; i < n; i++) {
      h.x += s;
      if (boxHit(W, h.x - HW, h.y - hh, h.x + HW, h.y, t)) {
        if (s > 0) h.x = Math.floor(h.x + HW) - HW - 1e-4; else h.x = Math.floor(h.x - HW) + 1 + HW + 1e-4;
        hit = true; break;
      }
    }
    return hit;
  }
  function moveY(W, h, dy, hh, t) {
    var n = Math.max(1, Math.ceil(Math.abs(dy) / 0.2)), s = dy / n;
    for (var i = 0; i < n; i++) {
      h.y += s;
      if (boxHit(W, h.x - HW, h.y - hh, h.x + HW, h.y, t)) {
        if (s > 0) { h.y = Math.floor(h.y - 1e-6); h.vy = 0; h.ground = true; return; }
        h.y = Math.floor(h.y - hh) + 1 + hh; h.vy = 0; break;
      }
    }
    h.ground = h.vy >= 0 && boxHit(W, h.x - HW + 0.02, h.y, h.x + HW - 0.02, h.y + 0.05, t);
  }
  // Один шаг физики героя. inp = { dx, down, jump (держит), jumpPress, slidePress }. Возвращает флаги событий.
  var EV_JUMP = 1, EV_LAND = 2, EV_SLIDE = 4;
  function heroStep(W, h, inp, dt, t) {
    var ev = 0, ctl = h.knockT <= 0;
    if (h.knockT > 0) h.knockT -= dt;
    if (inp.jumpPress) h.jbuf = JBUF; else if (h.jbuf > 0) h.jbuf -= dt;
    var slideReq = inp.slidePress || (inp.down && h.jbuf > 0);
    if (ctl && h.ground && !h.slide && slideReq) {
      h.slide = true; h.slideT = SLT; h.jbuf = 0; if (inp.dx) h.face = inp.dx; ev |= EV_SLIDE;
    }
    if (h.slide) {
      h.slideT -= dt;
      var free = canStand(W, h, t);
      if (free && ((inp.dx && inp.dx !== h.face) || h.slideT <= 0 || !h.ground || (h.jbuf > 0 && !inp.down))) h.slide = false;
    }
    var vx;
    if (h.slide) vx = h.face * SLV;
    else if (!ctl) vx = h.knockDir * KNOCK_V;
    else { vx = (inp.dx || 0) * RUN; if (inp.dx) h.face = inp.dx; }
    vx += h.push || 0;
    if (ctl && !h.slide && h.jbuf > 0 && (h.ground || h.coy > 0)) { h.vy = -JV; h.ground = false; h.coy = 0; h.jbuf = 0; ev |= EV_JUMP; }
    if (!inp.jump && h.vy < -JCUT) h.vy = -JCUT;
    h.vy = Math.min(h.vy + G * dt, MAXF);
    var hh = heroH(h), wasG = h.ground;
    moveX(W, h, vx * dt, hh, t);
    h.vx = vx;
    moveY(W, h, h.vy * dt, hh, t);
    if (h.ground && !wasG) ev |= EV_LAND;
    if (!h.ground) { if (wasG && h.vy >= 0 && !(ev & EV_JUMP)) h.coy = COY; else h.coy = Math.max(0, h.coy - dt); } else h.coy = 0;
    if (!h.dead && spikeHit(W, h.x - HW, h.y - hh, h.x + HW, h.y)) h.dead = 'spike';
    if (!h.dead && h.y > R + 2) h.dead = 'pit';
    return ev;
  }

  // ---------- макросы движения и граф проходимости ----------
  // macro = { dx, hold (с, 0 — без прыжка), delay, dur, slide }. Выполняется с покоя.
  function macroInput(m, tm, first) {
    var on = tm >= (m.delay || 0) && tm < (m.delay || 0) + (m.dur == null ? 99 : m.dur);
    return { dx: on ? m.dx : 0, down: false, jump: m.hold > 0 && tm < m.hold, jumpPress: first && m.hold > 0, slidePress: first && !!m.slide };
  }
  // simulate: из (x,y) с покоя; t0 — время мира (для мигающих блоков; null — блоков нет). → { x, y, ok, tm }
  function simulate(W, x, y, m, t0, face) {
    var h = newHero(x, y), dt = 1 / 60; h.face = face || m.dx || 1;
    if (m.slide) h.face = m.dx;
    for (var f = 0; f < 200; f++) {
      var tm = f * dt, ev = heroStep(W, h, macroInput(m, tm, f === 0), dt, t0 == null ? null : t0 + tm);
      if (h.dead) return { ok: false, x: h.x, y: h.y, why: h.dead, tm: tm };
      if (m.slide) { if (f > 2 && !h.slide && h.ground) return { ok: true, x: h.x, y: h.y, tm: tm }; continue; }
      if (m.hold > 0) { if (f > 2 && h.ground) return { ok: true, x: h.x, y: h.y, tm: tm }; continue; }
      // шаг с края: идём, пока не сорвались и не приземлились
      if (ev & EV_LAND) return { ok: true, x: h.x, y: h.y, tm: tm };
      if (h.ground && f > 30) return { ok: false, x: h.x, y: h.y, why: 'noedge', tm: tm };
    }
    return { ok: false, x: h.x, y: h.y, why: 'timeout' };
  }
  var MACROS = (function () {
    var out = [];
    [-1, 0, 1].forEach(function (dx) {
      [0.1, 0.2, 0.32, 0.7].forEach(function (hold) {
        out.push({ dx: dx, hold: hold, delay: 0 });
        if (dx) { out.push({ dx: dx, hold: hold, delay: 0, dur: 0.22 }); out.push({ dx: dx, hold: hold, delay: 0.22 }); }
      });
    });
    out.push({ dx: 1, hold: 0 }, { dx: -1, hold: 0 }, { dx: 1, hold: 0, slide: true }, { dx: -1, hold: 0, slide: true });
    return out;
  })();
  function isNode(W, c, r) { return solid(W, c, r, null) && !boxHit(W, c + 0.5 - HW, r - HH, c + 0.5 + HW, r, null) && !spikeHit(W, c + 0.5 - HW, r - HH, c + 0.5 + HW, r); }
  function isLow(W, c, r) { return solid(W, c, r, null) && boxHit(W, c + 0.5 - HW, r - HH, c + 0.5 + HW, r, null) && !boxHit(W, c + 0.5 - HW, r - SH, c + 0.5 + HW, r, null); }
  // Граф: узлы — клетки пола (id = r*W+c), рёбра: шаг к соседу, макросы (проверены симуляцией с двух смещений старта),
  // цепочки мигающих блоков (проверены выдержанной по такту политикой при 6 фазах такта).
  function Nav(lv) {
    var W = { W: lv.W, t: lv.t, grp: lv.grp, open: true }, nodes = [], edges = new Map(), r, c;
    for (c = 0; c < lv.W; c++) for (r = 1; r < R; r++) if (isNode(W, c, r)) nodes.push(r * lv.W + c);
    var set = new Set(nodes);
    function add(a, b, e) { if (!edges.has(a)) edges.set(a, []); edges.get(a).push(Object.assign({ to: b }, e)); }
    function nodeAtXY(x, y) { var r0 = Math.round(y) * lv.W, id = r0 + Math.floor(x); if (set.has(id)) return id; var a2 = r0 + Math.floor(x + HW - 0.02), b2 = r0 + Math.floor(x - HW + 0.02); return set.has(a2) ? a2 : set.has(b2) ? b2 : -1; }
    nodes.forEach(function (id) {
      var c0 = id % lv.W, r0 = Math.floor(id / lv.W), seen = {};
      [-1, 1].forEach(function (d) { var nb = r0 * lv.W + c0 + d; if (set.has(nb)) { add(id, nb, { walk: d, cost: 0.2 }); seen[nb] = 1; } });
      [0.5, 0.15, 0.85].forEach(function (off) {
        var sx = c0 + off;
        if (boxHit(W, sx - HW, r0 - HH, sx + HW, r0, null) || !boxHit(W, sx - HW + 0.02, r0, sx + HW - 0.02, r0 + 0.05, null)) return;
        MACROS.forEach(function (m) {
          if (m.hold === 0 && !m.slide && ((m.dx > 0 && off < 0.8) || (m.dx < 0 && off > 0.2))) return;  // шаг с края — только от края
          var a = simulate(W, sx - 0.06, r0, m, null), b = simulate(W, sx + 0.06, r0, m, null);
          if (!a.ok || !b.ok) return;
          var na = nodeAtXY(a.x, a.y), nb = nodeAtXY(b.x, b.y);
          if (na < 0 || na !== nb || na === id || seen[na + ':' + off]) return;
          seen[na + ':' + off] = 1;
          add(id, na, { m: m, sx: sx, cost: 0.3 + Math.max(a.tm, b.tm) });
        });
      });
    });
    // мигающие блоки
    var blinkOk = [];
    lv.blinks.forEach(function (ch) {
      var from = ch.g * lv.W + ch.c0 - 1, to = ch.g * lv.W + ch.cEnd, okAll = true;
      for (var k = 0; k < 6; k++) { var res = blinkRun(W, ch, k * 0.5, 0.2); if (!res.ok) okAll = false; }
      blinkOk.push(okAll);
      if (okAll && set.has(from) && set.has(to)) add(from, to, { blink: ch, sx: ch.c0 - 0.42, cost: 5 });
    });
    function reach(start) { var seen = new Set([start]), q = [start]; while (q.length) { var u = q.shift(); (edges.get(u) || []).forEach(function (e) { if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); } }); } return seen; }
    // поле расстояний до целей (Дейкстра по обратным рёбрам)
    function field(goals) {
      var rev = new Map(); edges.forEach(function (l, u) { l.forEach(function (e) { if (!rev.has(e.to)) rev.set(e.to, []); rev.get(e.to).push({ u: u, cost: e.cost }); }); });
      var dist = new Map(), q = [];
      goals.forEach(function (gid) { dist.set(gid, 0); q.push([0, gid]); });
      while (q.length) {
        var bi = 0; for (var i = 1; i < q.length; i++) if (q[i][0] < q[bi][0]) bi = i;
        var cur = q.splice(bi, 1)[0]; if (cur[0] > dist.get(cur[1])) continue;
        (rev.get(cur[1]) || []).forEach(function (e) { var nd = cur[0] + e.cost; if (!dist.has(e.u) || nd < dist.get(e.u)) { dist.set(e.u, nd); q.push([nd, e.u]); } });
      }
      return dist;
    }
    return { W: W, nodes: nodes, set: set, edges: edges, reach: reach, field: field, nodeAt: nodeAtXY, blinkOk: blinkOk };
  }
  // Политика прохода цепочки мигающих блоков (её же исполняет бот): стоять у края; когда следующий блок
  // горит ≥ wait с и ему гореть ещё ≥ 0.9 с — дойти до края текущей опоры и прыгнуть вправо в полную силу.
  function blinkReady(ch, k, t, wait) {
    if (k >= ch.stones.length) return true;
    var gr = ch.stones[k].grp, p = ((t - gr * BL_STEP) % BL_P + BL_P) % BL_P;
    return p >= wait && p < BL_ON - 0.9;
  }
  function blinkRun(W, ch, t0, wait) {
    var h = newHero(ch.c0 - 0.42, ch.g), dt = 1 / 60, t = t0, k = 0, mode = 'wait', jt = 0;
    for (var f = 0; f < 60 * 30; f++) {
      var inp = { dx: 0, jump: false, jumpPress: false };
      var edge = k === 0 ? ch.c0 - 0.42 : ch.stones[k - 1].c1 - 0.45;
      if (mode === 'wait') {
        if (h.ground && h.x < edge - 0.05) inp.dx = 1;
        else if (h.ground && blinkReady(ch, k, t, wait)) { mode = 'jump'; jt = 0; inp.jumpPress = true; inp.jump = true; inp.dx = 1; }
      } else {
        jt += dt; inp.dx = 1; inp.jump = true;
        if (jt > 0.05 && h.ground) { inp.dx = 0; k++; mode = 'wait'; if (k > ch.stones.length) return { ok: true, t: t - t0 }; }
      }
      heroStep(W, h, inp, dt, t); t += dt;
      if (h.dead) return { ok: false, why: h.dead, k: k };
    }
    return { ok: false, why: 'timeout', k: k };
  }

  // ---------- игра ----------
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, emit = opts.onEvent || function () {}, dmgMul = opts.dmgMul == null ? 1 : opts.dmgMul;
    var store = opts.store || null;
    var S = { phase: 'select', phaseT: 0, sel: 0, score: 0, lives: LIVES, time: 0, prog: loadProg(), stage: -1, lv: null, W: null,
      hero: newHero(2, 12), shots: [], eshots: [], enemies: [], items: [], puddles: [], fx: [], boss: null, bossState: 'none', bossT: 0,
      queue: null, rush: { i: 0, walker: false }, miniState: 'none', mini: null, cam: { x: 0 }, lock: null, cp: null, wsel: 0, energy: [], banner: null, kills: 0, deaths: 0,
      shake: 0, gotW: 0, won: false, over: false, fortIdx: 0, flash: 0 };
    for (var i = 0; i < WEAP.length; i++) S.energy.push(MAX_EN);
    var inp = { dx: 0, down: false, jump: false, fire: false, slide: false }, prevJump = false, prevFire = false, prevSlide = false;

    function loadProg() { return OZ.save.parse(store ? store.get() : null); }
    function saveProg() { if (store) { try { store.set(OZ.save.serialize(S.prog)); } catch (e) {} } }
    function owned(i) { return i === 0 || !!S.prog.beaten[i - 1]; }
    function allBeaten() { return S.prog.beaten.every(Boolean); }

    // ----- запуск этапа -----
    function startStage(idx) {
      var lv = OZ.level(idx);
      S.stage = idx; S.lv = lv; S.W = { W: lv.W, t: new Uint8Array(lv.t), grp: lv.grp, open: false };
      S.cp = lv.cps[0]; S.phase = 'stage'; S.phaseT = 0; S.miniState = 'none'; S.rush = { i: 0, walker: false };
      for (var i = 0; i < S.energy.length; i++) S.energy[i] = MAX_EN;
      S.banner = { k: 'stage', t: 2.2 };
      respawnAt(S.cp, true);
      emit('stage', { idx: idx, key: lv.key });
    }
    function respawnAt(cp, fresh) {
      var h = newHero(cp.x, cp.y); S.hero = h; h.inv = fresh ? 0 : 1.2;
      S.shots = []; S.eshots = []; S.puddles = []; S.enemies = []; S.boss = null; S.bossState = 'none'; S.queue = null; S.lock = null;
      S.items = S.lv.items.filter(function (it) { return !(it.k === 'tank' && S.prog.tankGot[S.lv.key + ':' + it.x]); }).map(function (it) { return { k: it.k, x: it.x, y: it.y, got: false, vy: 0, fixed: true }; });
      S.spawns = S.lv.spawns.map(function (s) { return { type: s.type, x: s.x, y: s.y, done: false, live: null }; });
      // ворота арены открыты; ворота мини-комнаты — по состоянию
      var lv = S.lv, W = S.W, r;
      for (r = 9; r <= 11; r++) W.t[r * W.W + lv.arena.x0] = E;
      if (lv.mini) {
        var m = lv.mini;
        for (r = m.g - 3; r < m.g; r++) { W.t[r * W.W + m.x0] = E; W.t[r * W.W + m.x1] = S.miniState === 'done' ? E : GATE; }
        if (S.miniState !== 'done') S.miniState = 'none';
        S.mini = null;
      }
      S.cam.x = camTarget();
      emit('respawn', {});
    }
    function camTarget() {
      var lv = S.lv, h = S.hero, x = h.x - VIEW_W * 0.42;
      if (S.lock) return Math.max(S.lock.x0, Math.min(S.lock.x1 - VIEW_W, x));
      x = Math.max(0, Math.min(lv.W - VIEW_W, x));
      // не заглядывать в арену, пока бой не начат
      if (h.x < lv.arena.x0) x = Math.min(x, lv.arena.x0 + 1 - VIEW_W + 0);
      return x;
    }

    // ----- урон и гибель -----
    function hurt(d, why, fromX) {
      var h = S.hero;
      if (h.inv > 0 || h.dead || S.phase !== 'stage') return;
      d = d * dmgMul; if (d <= 0) { h.inv = 0.4; return; }
      h.hp -= d; emit('hurt', { x: h.x, y: h.y - 0.8, d: d, why: why });
      if (h.hp <= 0) { h.hp = 0; kill(why); return; }
      h.inv = 1.3; h.knockT = 0.3; h.slide = false; h.knockDir = fromX == null ? -h.face : (h.x < fromX ? -1 : 1); h.charge = 0;
      if (h.vy < 0) h.vy = 0;
    }
    function kill(why) {
      var h = S.hero; if (S.phase !== 'stage') return;
      h.dead = why; S.phase = 'dead'; S.phaseT = 0; S.deaths++;
      emit('die', { x: h.x, y: h.y - 0.8, why: why });
    }

    // ----- выстрелы -----
    function shotCount(k) { var n = 0; for (var i = 0; i < S.shots.length; i++) if (S.shots[i].k === k) n++; return n; }
    function fire(chargeLvl) {
      var h = S.hero, w = WEAP[S.wsel];
      if (h.slide || h.dead) return false;
      if (w.k !== 'spark' && S.energy[S.wsel] < w.cost - 1e-6) { emit('noEnergy', {}); return false; }
      if (shotCount(w.k) >= w.max && !(w.k === 'spark' && chargeLvl)) return false;
      var sx = h.x + h.face * 0.6, sy = h.y - 0.95, f = h.face, made = true;
      switch (w.k) {
        case 'spark':
          if (chargeLvl === 2) S.shots.push({ k: 'spark', x: sx, y: sy, vx: f * 15, vy: 0, r: 0.55, dmg: 3, lv: 2, pierce: true, life: 2 });
          else if (chargeLvl === 1) S.shots.push({ k: 'spark', x: sx, y: sy, vx: f * 14, vy: 0, r: 0.38, dmg: 2, lv: 1, life: 2 });
          else S.shots.push({ k: 'spark', x: sx, y: sy, vx: f * 14, vy: 0, r: 0.2, dmg: 1, lv: 0, life: 2 });
          break;
        case 'boomer': S.shots.push({ k: 'boomer', x: sx, y: sy, vx: f * 12, vy: 0, r: 0.45, dmg: 2, pierce: true, life: 2.6, age: 0, dir: f, hitIds: [] }); break;
        case 'mine': S.shots.push({ k: 'mine', x: h.x + f * 0.7, y: h.y - 0.4, vx: f * 8.5, vy: 0, r: 0.4, dmg: 3, grav: true, life: 3 }); break;
        case 'frost': S.shots.push({ k: 'frost', x: sx, y: sy - 0.2, vx: f * 7, vy: -9, r: 0.3, dmg: 2, grav: true, lob: true, life: 2.5 }); break;
        case 'harpoon': S.shots.push({ k: 'harpoon', x: sx, y: sy, vx: f * 15, vy: 0, r: 0.45, dmg: 2, pierce: true, push: true, life: 0.7, x0: sx }); break;
        case 'chain': S.shots.push({ k: 'chain', x: sx, y: sy + (rng() - 0.5) * 0.15, vx: f * 16, vy: 0, r: 0.18, dmg: 1, life: 0.9 }); break;
        case 'smoke':
          if (!h.ground) { made = false; break; }
          S.shots.push({ k: 'smoke', x: h.x + 0.5, y: h.y - 0.45, vx: 10, vy: 0, r: 0.45, dmg: 3, pierce: true, floor: true, life: 1.1 });
          S.shots.push({ k: 'smoke', x: h.x - 0.5, y: h.y - 0.45, vx: -10, vy: 0, r: 0.45, dmg: 3, pierce: true, floor: true, life: 1.1 });
          S.shake = Math.max(S.shake, 0.25);
          break;
        case 'fan':
          [-0.32, 0, 0.32].forEach(function (a) { S.shots.push({ k: 'fan', x: sx, y: sy, vx: f * 13 * Math.cos(a), vy: 13 * Math.sin(a), r: 0.22, dmg: 1, life: 1.2 }); });
          break;
        case 'gear': S.shots.push({ k: 'gear', x: h.x, y: h.y - 0.8, vx: 0, vy: 0, r: 0.3, dmg: 3, pierce: true, ring: true, life: 0.45, hitIds: [] }); break;
      }
      if (!made) return false;
      if (w.k !== 'spark') S.energy[S.wsel] = Math.max(0, S.energy[S.wsel] - w.cost);
      h.shootT = 0.22;
      emit('shot', { k: w.k, lv: chargeLvl || 0 });
      return true;
    }

    // ----- враги -----
    var FOE = {
      crawler: { hp: 2, hw: 0.45, hh: 1.0, pts: 100, dmg: 3 },   // высота 1 клетка — выстрел с земли попадает
      hopper: { hp: 3, hw: 0.45, hh: 1.0, pts: 150, dmg: 3 },
      flyer: { hp: 1, hw: 0.4, hh: 0.7, pts: 120, dmg: 2 },
      turret: { hp: 4, hw: 0.5, hh: 1.0, pts: 200, dmg: 3 },
      golem: { hp: 14, hw: 1.0, hh: 2.3, pts: 2000, dmg: 4, mini: true },
      valve: { hp: 16, hw: 1.1, hh: 2.8, pts: 2000, dmg: 4, mini: true },
      drone: { hp: 12, hw: 0.9, hh: 1.2, pts: 2000, dmg: 4, mini: true }
    };
    var eid = 1;
    function spawnFoe(type, x, y, src) {
      var d = FOE[type], e = { id: eid++, type: type, x: x, y: y, hw: d.hw, hh: d.hh, hp: d.hp, max: d.hp, vx: 0, vy: 0, dir: S.hero.x < x ? -1 : 1, t: 0, cd: 1 + rng(), flash: 0, ground: false, y0: y, src: src, dead: false, mode: 'idle', mt: 0 };
      S.enemies.push(e); return e;
    }
    function eshot(o) { o.life = o.life || 4; S.eshots.push(o); emit('eshot', { k: o.kind }); return o; }
    function aimAt(x, y, sp) { var h = S.hero, dx = h.x - x, dy = (h.y - 0.8) - y, n = Math.hypot(dx, dy) || 1; return { vx: dx / n * sp, vy: dy / n * sp }; }
    function bodyMove(o, dt, grav) {
      if (grav) o.vy = Math.min(o.vy + G * dt, MAXF);
      var hh = o.hh, hw = o.hw, W = S.W;
      o.x += o.vx * dt;
      if (boxHit(W, o.x - hw, o.y - hh, o.x + hw, o.y - 0.05, S.time)) { o.x -= o.vx * dt; o.hitWall = true; } else o.hitWall = false;
      o.y += o.vy * dt;
      o.ground = false;
      if (o.vy >= 0 && boxHit(W, o.x - hw + 0.05, o.y - 0.01, o.x + hw - 0.05, o.y, S.time)) { o.y = Math.floor(o.y); o.vy = 0; o.ground = true; }
      else if (o.vy < 0 && boxHit(W, o.x - hw + 0.05, o.y - hh, o.x + hw - 0.05, o.y - hh + 0.2, S.time)) { o.vy = 0; }
    }
    function updFoe(e, dt) {
      var h = S.hero, dxh = h.x - e.x;
      e.t += dt; if (e.flash > 0) e.flash -= dt;
      switch (e.type) {
        case 'crawler':
          e.vx = e.dir * 1.8; bodyMove(e, dt, true);
          if (e.ground) { var ahead = e.x + e.dir * (e.hw + 0.1); if (e.hitWall || !solid(S.W, Math.floor(ahead), Math.round(e.y), S.time)) e.dir = -e.dir; }
          break;
        case 'hopper':
          if (e.ground) { e.vx = 0; e.cd -= dt; if (e.cd <= 0 && Math.abs(dxh) < 12) { e.vy = -11; e.vx = Math.sign(dxh) * 2.8; e.dir = Math.sign(dxh) || 1; e.cd = 1.1 + rng() * 0.5; emit('hop', {}); } }
          bodyMove(e, dt, true);
          break;
        case 'flyer':
          e.dir = dxh < 0 ? -1 : 1;
          e.vx = Math.abs(dxh) > 0.5 ? e.dir * 2.0 : 0;
          var ty = Math.abs(dxh) < 4.5 ? h.y - 0.5 : e.y0;          // вблизи — пикирует к герою
          e.base = (e.base == null ? e.y0 : e.base) + Math.max(-3 * dt, Math.min(3 * dt, ty - (e.base == null ? e.y0 : e.base)));
          e.x += e.vx * dt; e.y = e.base + Math.sin(e.t * 2.6) * 0.5;
          break;
        case 'turret':
          e.dir = dxh < 0 ? -1 : 1; bodyMove(e, dt, true);
          e.cd -= dt; e.warn = e.cd < 0.45 && Math.abs(dxh) < 10;
          if (e.cd <= 0) {
            if (Math.abs(dxh) < 10) { for (var k = -1; k <= 1; k++) { var a = aimAt(e.x, e.y - 0.7, 6); var ang = Math.atan2(a.vy, a.vx) + k * 0.25; eshot({ kind: 'bolt', x: e.x, y: e.y - 0.7, vx: Math.cos(ang) * 6, vy: Math.sin(ang) * 6, r: 0.18, dmg: 3 }); } }
            e.cd = 2.2;
          }
          break;
        case 'golem':
          e.dir = dxh < 0 ? -1 : 1;
          if (e.ground) {
            e.vx = Math.abs(dxh) > 3 ? e.dir * 1.5 : 0; e.cd -= dt; e.mt -= dt;
            if (e.mt <= 0) { e.vy = -14; e.vx = e.dir * 4; e.mt = 2.6 + rng(); emit('hop', { big: true }); }
            else if (e.cd <= 0) { eshot({ kind: 'bolt', x: e.x + e.dir * 1.1, y: e.y - 1.4, vx: e.dir * 7, vy: 0, r: 0.25, dmg: 3 }); e.cd = 1.7; }
          }
          bodyMove(e, dt, true);
          if (e.ground && e.wasAir) { S.shake = Math.max(S.shake, 0.2); emit('stomp', {}); }
          e.wasAir = !e.ground;
          break;
        case 'valve':
          e.dir = dxh < 0 ? -1 : 1; bodyMove(e, dt, true);
          e.cd -= dt; e.warn = e.cd < 0.5;
          if (e.cd <= 0) {
            e.mt++;
            if (e.mt % 2) { for (var q = -1; q <= 1; q++) eshot({ kind: 'bolt', x: e.x + e.dir, y: e.y - 2, vx: e.dir * 6.5 * Math.cos(q * 0.3), vy: 6.5 * Math.sin(q * 0.3), r: 0.22, dmg: 3 }); }
            else { var d = Math.abs(dxh); for (var b = 0; b < 2; b++) { var tt = 1.0 + b * 0.25; eshot({ kind: 'melt', x: e.x, y: e.y - 2.6, vx: dxh / tt * (b ? 0.7 : 1), vy: -0.5 * 26 * tt, g: 26, r: 0.3, dmg: 3, puddle: true }); } void d; }
            e.cd = 1.8;
          }
          break;
        case 'drone':
          e.dir = dxh < 0 ? -1 : 1;
          if (e.mode === 'idle') {
            var tx = h.x - e.dir * 3; e.x += Math.max(-3 * dt, Math.min(3 * dt, tx - e.x)); e.y += ((e.y0 - 0.9 + Math.sin(e.t * 2) * 0.6) - e.y) * Math.min(1, dt * 3);
            e.mt += dt; e.cd -= dt;
            if (e.cd <= 0) { eshot({ kind: 'drop', x: e.x, y: e.y, vx: 0, vy: 2, g: 26, r: 0.22, dmg: 3 }); e.cd = 1.1; }
            if (e.mt > 3.2) { e.mode = 'aim'; e.mt = 0; }
          } else if (e.mode === 'aim') { e.mt += dt; if (e.mt > 0.55) { e.mode = 'dive'; var a2 = aimAt(e.x, e.y - 0.6, 9.5); e.vx = a2.vx; e.vy = Math.max(3, a2.vy); e.mt = 0; emit('dive', {}); } }
          else if (e.mode === 'dive') { e.x += e.vx * dt; e.y += e.vy * dt; e.mt += dt; if (e.y >= e.y0 - 0.2 || e.mt > 1.0) { e.mode = 'rise'; e.mt = 0; } }
          else { e.y -= 5 * dt; e.mt += dt; if (e.y <= e.y0 - 1.5 || e.mt > 0.6) { e.mode = 'idle'; e.mt = 0; } }
          var mm = S.lv.mini; if (mm) e.x = Math.max(mm.x0 + 1.5, Math.min(mm.x1 - 0.5, e.x));
          break;
      }
      if (e.y > R + 2) e.dead = true;
    }
    function foeHit(e, s) {
      if (e.dead) return;
      var dmg = s.dmg;
      e.hp -= dmg; e.flash = 0.12;
      if (s.push) { e.x += Math.sign(s.vx) * 0.6; }
      emit('hit', { x: e.x, y: e.y - e.hh / 2 });
      if (e.hp <= 0) {
        e.dead = true; S.score += FOE[e.type].pts; S.kills++;
        emit('kill', { x: e.x, y: e.y - e.hh / 2, type: e.type, pts: FOE[e.type].pts, mini: !!FOE[e.type].mini });
        if (FOE[e.type].mini) miniDone();
        else drop(e.x, e.y - e.hh / 2);
      }
    }
    function drop(x, y) {
      var r = rng(), k = null;
      if (r < 0.12) k = 'hp2'; else if (r < 0.22) k = 'en2'; else if (r < 0.26) k = 'hp8'; else if (r < 0.29) k = 'en8'; else if (r < 0.3) k = 'life';
      if (k) S.items.push({ k: k, x: x, y: y, vy: -6, got: false, fixed: false, life: 8 });
    }
    function miniDone() {
      var m = S.lv.mini; S.miniState = 'done'; S.mini = null;
      for (var r = m.g - 3; r < m.g; r++) { S.W.t[r * S.W.W + m.x1] = E; S.W.t[r * S.W.W + m.x0] = E; }
      S.cp = { x: m.x1 - 1.5, y: m.g };
      emit('gateOpen', { x: m.x1, y: m.g - 1.5 });
    }

    // ----- предметы -----
    function pickup(it) {
      var h = S.hero; it.got = true;
      switch (it.k) {
        case 'hp2': h.hp = Math.min(MAX_HP, h.hp + 3); break;
        case 'hp8': h.hp = Math.min(MAX_HP, h.hp + 10); break;
        case 'en2': case 'en8': refill(it.k === 'en2' ? 3 : 10); break;
        case 'life': S.lives = Math.min(9, S.lives + 1); break;
        case 'tank': S.prog.tanks = Math.min(MAX_TANKS, S.prog.tanks + 1); S.prog.tankGot[S.lv.key + ':' + it.x] = 1; saveProg(); break;
      }
      S.score += 50;
      emit('pickup', { k: it.k, x: it.x, y: it.y });
    }
    function refill(n) {
      var i = S.wsel;
      if (i === 0) { var lo = -1; for (var j = 1; j < WEAP.length; j++) if (owned(j) && (lo < 0 || S.energy[j] < S.energy[lo])) lo = j; if (lo < 0) return; i = lo; }
      S.energy[i] = Math.min(MAX_EN, S.energy[i] + n);
    }

    // ----- боссы -----
    var BOSS_DEF = {
      hammer: { hw: 1.0, hh: 2.0 }, gear: { hw: 1.2, hh: 1.8 }, magnet: { hw: 0.9, hh: 1.6, fly: true }, fan: { hw: 1.5, hh: 2.2 },
      frost: { hw: 1.1, hh: 2.6 }, spring: { hw: 1.3, hh: 2.4 }, volt: { hw: 0.95, hh: 1.9 }, bell: { hw: 1.1, hh: 2.2, fly: true },
      ladle: { hw: 1.6, hh: 1.8 }, crane: { hw: 0.9, hh: 1.2, fly: true }, walker: { hw: 2.0, hh: 3.2 }, core: { hw: 0.8, hh: 1.4, fly: true }
    };
    function makeBoss(key, hp) {
      var a = S.lv.arena, d = BOSS_DEF[key];
      var b = { key: key, x: a.x0 + 19, y: 12, hw: d.hw, hh: d.hh, hp: hp, max: hp, inv: 0, flash: 0, t: 0, mode: 'idle', mt: 0, dir: -1, vx: 0, vy: 0, ground: true,
        stun: 0, dead: false, cyc: 0, fly: !!d.fly, fill: 0, ax: a.x0 };
      if (key === 'magnet' || key === 'core') b.y = 10.4;
      if (key === 'bell') { b.y = 10.3; b.x = a.x0 + 13; }
      if (key === 'crane') { b.y = 10.6; b.x = a.x0 + 13; }
      if (key === 'fan') b.x = a.x0 + 21;
      return b;
    }
    function startBoss() {
      var lv = S.lv, a = lv.arena, r;
      for (r = 9; r <= 11; r++) S.W.t[r * S.W.W + a.x0] = GATE;
      S.lock = { x0: a.x0, x1: a.x1 + 1 };
      S.bossState = 'intro'; S.bossT = 0;
      // финал крепости: повторные бои (пройденные после гибели не повторяются) → Шагающая Домна → Сердце Домны
      if (lv.boss === 'rematch') {
        S.queue = BOSSES.slice(S.rush.i);
        if (S.queue.length) S.boss = makeBoss(S.queue.shift(), REMATCH_HP);
        else { S.queue = null; S.boss = makeBoss(S.rush.walker ? 'core' : 'walker', BOSS_HP); }
      }
      else S.boss = makeBoss(lv.boss, BOSS_HP);
      emit('bossIntro', { key: S.boss.key });
    }
    function inArena(b) { return Math.max(b.ax + 1 + b.hw, Math.min(b.ax + 25 - b.hw, b.x)); }
    function bossGrav(b, dt) {
      b.vy = Math.min(b.vy + G * dt, MAXF); b.y += b.vy * dt; b.x += b.vx * dt;
      var nx = inArena(b); b.hitWall = nx !== b.x; b.x = nx;
      var was = b.ground; b.ground = false;
      if (b.y >= 12) { b.y = 12; b.vy = 0; b.ground = true; if (!was) b.landed = true; }
    }
    function face(b) { b.dir = S.hero.x < b.x ? -1 : 1; }
    function shock(x, dir, sp) { eshot({ kind: 'wave', x: x, y: 12 - 0.35, vx: dir * (sp || 7), vy: 0, hw: 0.45, hh: 0.65, dmg: 3, floor: true }); }
    function updBoss(b, dt) {
      var h = S.hero, half = b.hp <= b.max / 2;
      b.t += dt; b.mt += dt; if (b.flash > 0) b.flash -= dt; if (b.inv > 0) b.inv -= dt;
      if (b.stun > 0) { b.stun -= dt; if (!b.fly) bossGrav(b, dt); return; }
      switch (b.key) {
        case 'hammer':
          if (b.mode === 'idle') { b.vx = 0; face(b); if (b.mt > (half ? 0.6 : 0.85)) { b.cyc++; b.mode = b.cyc % 3 === 0 ? 'crouch' : 'throw'; b.mt = 0; } }
          else if (b.mode === 'throw') {
            if (b.mt > 0.25 && !b.did) {
              b.did = true; eshot({ kind: 'hmr', x: b.x + b.dir * 1.2, y: 12 - 0.45, vx: b.dir * 7, vy: 0, r: 0.45, dmg: 3, floor: true, solid: true });
              if (half) eshot({ kind: 'hmr', x: b.x + b.dir * 1.2, y: 10.5, vx: b.dir * 5, vy: -9, g: 30, r: 0.45, dmg: 3, bounce: 2, solid: true });
            }
            if (b.mt > 0.6) { b.mode = 'idle'; b.mt = 0; b.did = false; }
          } else if (b.mode === 'crouch') { b.vx = 0; if (b.mt > 0.55) { b.mode = 'dash'; b.mt = 0; emit('dash', {}); } }
          else if (b.mode === 'dash') { b.vx = b.dir * 12; if (b.hitWall && b.mt > 0.1) { b.mode = 'idle'; b.mt = 0; b.vx = 0; S.shake = 0.2; } }
          bossGrav(b, dt); break;
        case 'gear':
          if (b.mode === 'idle') { b.vx = 0; face(b); if (b.mt > 0.8) { b.cyc++; b.mode = b.cyc % 2 ? 'sheets' : 'crouch'; b.mt = 0; b.n = 0; } }
          else if (b.mode === 'sheets') {
            var gap = half ? 0.55 : 0.75;
            if (b.mt > 0.3 + b.n * gap && b.n < 3) { var hi = rng() < 0.5; eshot({ kind: 'cog', x: b.x + b.dir * 1.3, y: hi ? 10.85 : 11.65, vx: b.dir * 8, vy: 0, hw: 0.6, hh: 0.3, dmg: 3, hi: hi, solid: true }); b.n++; }
            if (b.mt > 0.6 + 3 * gap) { b.mode = 'idle'; b.mt = 0; }
          } else if (b.mode === 'crouch') { if (b.mt > 0.5) { b.mode = 'roll'; b.mt = 0; emit('dash', {}); } }
          else if (b.mode === 'roll') { b.vx = b.dir * (half ? 8 : 7); if (b.hitWall && b.mt > 0.1) { b.mode = 'idle'; b.mt = 0; b.vx = 0; S.shake = 0.15; } }
          bossGrav(b, dt); break;
        case 'magnet':
          if (b.mode === 'idle') {
            face(b); var tx = h.x - b.dir * 3.2; b.x += Math.max(-3 * dt, Math.min(3 * dt, tx - b.x)); b.x = inArena(b);
            b.y = 10.9 + Math.sin(b.t * 1.6) * 0.9; b.cd = (b.cd || 0) - dt;
            if (b.cd <= 0) { eshot({ kind: 'drop', x: b.x, y: b.y, vx: 0, vy: 1, g: 28, r: 0.24, dmg: 3, puddle: true }); b.cd = half ? 0.7 : 0.95; }
            if (b.mt > 4.2) { b.mode = 'aim'; b.mt = 0; }
          } else if (b.mode === 'aim') { if (b.mt > 0.6) { var a1 = aimAt(b.x, b.y - 0.8, 11); b.vx = a1.vx; b.vy = Math.max(4, a1.vy); b.mode = 'dive'; b.mt = 0; emit('dive', {}); } }
          else if (b.mode === 'dive') { b.x += b.vx * dt; b.y += b.vy * dt; b.x = inArena(b); if (b.y >= 12) { b.y = 12; b.mode = 'rise'; b.mt = 0; S.shake = 0.2; } }
          else { b.y -= 4 * dt; if (b.y <= 10) { b.mode = 'idle'; b.mt = 0; } }
          break;
        case 'fan':
          var tow = b.x < h.x ? -1 : 1;   // направление «к мехам» для героя
          if (b.mode === 'idle') { b.vx = 0; face(b); h.push = 0; if (b.mt > 0.6) { b.cyc++; b.mode = b.cyc % 3 === 0 ? 'hop' : 'inhale'; b.mt = 0; } }
          else if (b.mode === 'inhale') { h.push = tow * (half ? 3.0 : 2.6); if (b.mt > 1.8) { b.mode = 'exhale'; b.mt = 0; b.did = false; } }
          else if (b.mode === 'exhale') {
            h.push = -tow * 3.2;
            if (!b.did) { b.did = true; [4, 6, 8].forEach(function (v) { eshot({ kind: 'ember', x: b.x + b.dir * 1.4, y: b.y - 1.6, vx: b.dir * v, vy: -9, g: 22, r: 0.25, dmg: 3 }); }); emit('gust', {}); }
            if (b.mt > 1.1) { b.mode = 'idle'; b.mt = 0; h.push = 0; }
          } else if (b.mode === 'hop') {
            if (b.ground && b.mt < 0.1) { var target = b.x < b.ax + 13 ? b.ax + 21 : b.ax + 5; b.vy = -15; b.vx = (target - b.x) / (2 * 15 / G); }
            if (b.landed && b.mt > 0.2) { b.mode = 'idle'; b.mt = 0; b.vx = 0; S.shake = 0.25; emit('stomp', {}); }
          }
          b.landed = false; bossGrav(b, dt); break;
        case 'frost':
          if (b.mode === 'idle') { b.vx = 0; face(b); if (b.mt > 0.7) { b.cyc++; b.mode = ['wave', 'bubbles', 'wave', 'hop'][b.cyc % 4]; b.mt = 0; b.n = 0; } }
          else if (b.mode === 'wave') {
            if (b.mt > 0.35 + b.n * 0.9 && b.n < (half ? 2 : 1)) { eshot({ kind: 'wave', x: b.x + b.dir * 1.2, y: 11.6, vx: b.dir * 6.5, vy: 0, hw: 0.5, hh: 1.0, dmg: 3, floor: true, water: true }); b.n++; }
            if (b.mt > 0.8 + (half ? 0.9 : 0)) { b.mode = 'idle'; b.mt = 0; }
          } else if (b.mode === 'bubbles') {
            if (b.mt > 0.3 + b.n * 0.35 && b.n < 3) { eshot({ kind: 'bubble', x: b.x + b.dir * 1.2, y: 10 - b.n * 0.6, vx: b.dir * 3.2, vy: 0, r: 0.35, dmg: 3, sine: b.n, y0: 10.2 - b.n * 0.5, life: 7 }); b.n++; }
            if (b.mt > 1.4) { b.mode = 'idle'; b.mt = 0; }
          } else if (b.mode === 'hop') {
            if (b.ground && b.mt < 0.1) { b.vy = -13; b.vx = Math.max(-6, Math.min(6, (h.x - b.x) / (2 * 13 / G))); }
            if (b.landed && b.mt > 0.2) { b.mode = 'idle'; b.mt = 0; b.vx = 0; S.shake = 0.2; }
          }
          b.landed = false; bossGrav(b, dt); break;
        case 'spring':
          if (b.mode === 'idle') { b.vx = 0; face(b); if (b.mt > (half ? 0.8 : 1.1)) { b.mode = 'crouch'; b.mt = 0; } }
          else if (b.mode === 'crouch') { if (b.mt > 0.45) { var air = 1.1; b.vy = -G * air / 2; b.vx = (Math.max(b.ax + 2.5, Math.min(b.ax + 23.5, h.x)) - b.x) / air; b.mode = 'leap'; b.mt = 0; emit('hop', { big: true }); } }
          else if (b.mode === 'leap') { if (b.landed) { b.vx = 0; shock(b.x - b.hw, -1, 7); shock(b.x + b.hw, 1, 7); S.shake = 0.35; emit('stomp', {}); b.mode = 'idle'; b.mt = 0; } }
          b.landed = false; bossGrav(b, dt); break;
        case 'volt':
          if (b.mode === 'idle') { b.vx = 0; face(b); if (b.mt > (half ? 0.6 : 0.85)) { b.cyc++; b.mode = b.cyc % 3 === 0 ? 'crouch' : 'spray'; b.mt = 0; b.n = 0; } }
          else if (b.mode === 'spray') {   // фонтан искр: дуги падают на разном расстоянии
            if (b.mt > 0.25 + b.n * 0.18 && b.n < (half ? 5 : 4)) { var dd = 2.5 + b.n * 2.2 + rng() * 0.8, tt2 = 0.9; eshot({ kind: 'spark', x: b.x + b.dir * 0.8, y: b.y - b.hh, vx: b.dir * dd / tt2, vy: -0.5 * 24 * tt2 + (b.hh - 0.3) / tt2, g: 24, r: 0.22, dmg: 3 }); b.n++; emit('clang', {}); }
            if (b.mt > 1.4) { b.mode = 'idle'; b.mt = 0; }
          } else if (b.mode === 'crouch') { b.vx = 0; if (b.mt > 0.55) { b.mode = 'roll'; b.mt = 0; emit('dash', {}); } }
          else if (b.mode === 'roll') { b.vx = b.dir * (half ? 8 : 7); if (b.hitWall && b.mt > 0.1) { b.mode = 'idle'; b.mt = 0; b.vx = 0; S.shake = 0.2; emit('clang', {}); } }
          bossGrav(b, dt); break;
        case 'bell':
          var cx = b.ax + 13;
          if (b.mode === 'idle') {
            b.ph = (b.ph || 0) + dt * 1.0; b.x = cx + 7.5 * Math.sin(b.ph); b.y = 10.3; b.cd = (b.cd || 1.2) - dt;
            if (b.cd <= 0) { (half ? [-4.5, -2, 2, 4.5] : [-3.5, 3.5]).forEach(function (v) { eshot({ kind: 'note', x: b.x, y: b.y - 0.6, vx: v, vy: -3, g: 5, r: 0.25, dmg: 3 }); }); b.cd = half ? 1.4 : 1.8; b.cyc++; emit('dong', {}); }
            if (b.cyc >= 3) { b.cyc = 0; b.mode = 'shake'; b.mt = 0; }
          } else if (b.mode === 'shake') { if (b.mt > 0.6) { b.mode = 'drop'; b.mt = 0; b.vy = 0; } }
          else if (b.mode === 'drop') { b.vy = Math.min(b.vy + G * dt, MAXF); b.y += b.vy * dt; if (b.y >= 12) { b.y = 12; shock(b.x - b.hw, -1, 7); shock(b.x + b.hw, 1, 7); S.shake = 0.35; emit('dong', { big: true }); b.mode = 'sit'; b.mt = 0; } }
          else if (b.mode === 'sit') { if (b.mt > 1.4) { b.mode = 'rise'; b.mt = 0; } }
          else { b.y -= 3.6 * dt; if (b.y <= 10.3) { b.y = 10.3; b.mode = 'idle'; b.mt = 0; b.ph = Math.asin(Math.max(-1, Math.min(1, (b.x - cx) / 7.5))); } }
          break;
        case 'ladle':
          if (b.mode === 'idle') { face(b); var want = h.x + (b.x < h.x ? -7 : 7); b.vx = Math.abs(want - b.x) > 0.5 ? Math.sign(want - b.x) * 2.5 : 0; if (b.mt > 1.2) { b.cyc++; b.mode = b.cyc % 3 === 0 ? 'charge' : 'pour'; b.mt = 0; b.vx = 0; } }
          else if (b.mode === 'pour') {
            if (!b.did && b.mt > 0.4) { b.did = true; [-2, 0, 2].forEach(function (o) { var tt = 1.1, tx2 = h.x + o; eshot({ kind: 'melt', x: b.x + b.dir, y: b.y - 2, vx: (tx2 - b.x - b.dir) / tt, vy: -0.5 * 26 * tt + (2 / tt), g: 26, r: 0.3, dmg: 3, puddle: true }); }); emit('pour', {}); }
            if (b.mt > 1.0) { b.mode = 'idle'; b.mt = 0; b.did = false; }
          } else if (b.mode === 'charge') { if (b.mt < 0.5) b.vx = 0; else b.vx = b.dir * 9; if (b.hitWall && b.mt > 0.6) { b.mode = 'idle'; b.mt = 0; b.vx = 0; S.shake = 0.2; } }
          bossGrav(b, dt); break;
        case 'crane':
          if (b.mode === 'idle') {
            b.x += Math.max(-4 * dt, Math.min(4 * dt, h.x - b.x)); b.x = inArena(b); b.y = 10.6 + Math.sin(b.t * 1.5) * 0.9;
            b.cd = (b.cd || 1.5) - dt; if (b.cd <= 0) { eshot({ kind: 'crate', x: b.x, y: b.y + 0.3, vx: 0, vy: 0, g: 30, hw: 0.45, hh: 0.45, dmg: 4, crate: true }); b.cd = half ? 1.3 : 1.8; }
            if (b.mt > 4.5) { b.mode = 'swoop'; b.mt = 0; b.from = b.x; b.to = b.x < b.ax + 13 ? b.ax + 22 : b.ax + 4; }
          } else if (b.mode === 'swoop') {
            var k2 = Math.min(1, b.mt / 1.8); b.x = b.from + (b.to - b.from) * k2; b.y = 10.6 - Math.sin(k2 * Math.PI) * 3.5;
            if (k2 >= 1) { b.mode = 'idle'; b.mt = 0; }
          }
          break;
        case 'walker':
          if (b.mode === 'idle') { face(b); b.vx = b.dir * 1.4; if (b.mt > 1.4) { b.cyc++; b.mode = b.cyc % 2 ? 'flame' : 'stomp'; b.mt = 0; b.vx = 0; b.did = false; } }
          else if (b.mode === 'flame') {
            if (!b.did && b.mt > 0.4) { b.did = true; [5, 7, 9].forEach(function (v) { eshot({ kind: 'ember', x: b.x + b.dir * 1.8, y: b.y - 2.6, vx: b.dir * v, vy: -8, g: 22, r: 0.3, dmg: 4 }); }); emit('pour', {}); }
            if (b.mt > 1.0) { b.mode = 'idle'; b.mt = 0; }
          } else if (b.mode === 'stomp') {
            if (b.mt > 0.5 && !b.did) { b.did = true; shock(b.x - b.hw, -1, 8); shock(b.x + b.hw, 1, 8); S.shake = 0.35; emit('stomp', {}); }
            if (b.mt > 1.0) { b.mode = 'idle'; b.mt = 0; }
          }
          bossGrav(b, dt); break;
        case 'core':
          if (b.mode === 'idle') {
            face(b); var tx3 = h.x - b.dir * 4; b.x += Math.max(-4 * dt, Math.min(4 * dt, tx3 - b.x)); b.x = inArena(b); b.y = 10.4 + Math.sin(b.t * 1.8) * 1.0;
            b.cd = (b.cd || 1) - dt;
            if (b.cd <= 0) { for (var q3 = -1; q3 <= 1; q3++) { var a5 = aimAt(b.x, b.y - 0.7, 7), an2 = Math.atan2(a5.vy, a5.vx) + q3 * 0.22; eshot({ kind: 'bolt', x: b.x, y: b.y - 0.7, vx: Math.cos(an2) * 7, vy: Math.sin(an2) * 7, r: 0.22, dmg: 3 }); } b.cd = half ? 1.0 : 1.4; }
            if (b.mt > 4) { b.mode = 'aim'; b.mt = 0; }
          } else if (b.mode === 'aim') { if (b.mt > 0.55) { var a6 = aimAt(b.x, b.y - 0.7, 12); b.vx = a6.vx; b.vy = Math.max(4, a6.vy); b.mode = 'dive'; b.mt = 0; emit('dive', {}); } }
          else if (b.mode === 'dive') { b.x += b.vx * dt; b.y += b.vy * dt; b.x = inArena(b); if (b.y >= 12) { b.y = 12; b.mode = 'rise'; b.mt = 0; } }
          else { b.y -= 4.5 * dt; if (b.y <= 10) { b.mode = 'idle'; b.mt = 0; } }
          break;
      }
    }
    function bossDamage(b, s) {
      var weak = WEAK[b.key] === s.k, d;
      if (weak) d = 4; else if (s.k === 'spark') d = s.lv === 2 ? 3 : s.lv === 1 ? 2 : 1; else d = 1;
      return { d: d, weak: weak };
    }
    function hitBoss(b, s) {
      if (b.inv > 0 || b.dead || S.bossState !== 'fight') return false;
      var r = bossDamage(b, s);
      b.hp -= r.d; b.inv = r.weak ? 0.5 : 0.3; b.flash = 0.2;
      if (r.weak) b.stun = 0.5;
      emit('bossHit', { x: b.x, y: b.y - b.hh / 2, weak: r.weak, d: r.d });
      if (b.hp <= 0) { b.hp = 0; bossDies(b); }
      return true;
    }
    function bossDies(b) {
      b.dead = true; S.bossState = 'dead'; S.bossT = 0; S.eshots = []; S.hero.push = 0;
      var pts = S.lv.fort ? 8000 : 5000; if (b.key === 'core') pts = 20000; if (S.queue) { pts = 2000; S.rush.i++; }
      if (b.key === 'walker') S.rush.walker = true;
      S.score += pts;
      emit('bossDie', { x: b.x, y: b.y - b.hh / 2, key: b.key, pts: pts });
    }
    function afterBoss() {
      var lv = S.lv, b = S.boss;
      if (S.queue && S.queue.length) {          // повторные бои: следующий босс
        S.items.push({ k: 'hp8', x: S.hero.x < lv.arena.x0 + 13 ? lv.arena.x0 + 20 : lv.arena.x0 + 6, y: 4, vy: 0, got: false, fixed: false, life: 30 });
        S.boss = makeBoss(S.queue.shift(), REMATCH_HP); S.bossState = 'intro'; S.bossT = 0; emit('bossIntro', { key: S.boss.key, rematch: true });
        return;
      }
      if (S.queue) {                            // повторные бои позади — Шагающая Домна
        S.queue = null;
        S.items.push({ k: 'hp8', x: S.hero.x < lv.arena.x0 + 13 ? lv.arena.x0 + 20 : lv.arena.x0 + 6, y: 4, vy: 0, got: false, fixed: false, life: 30 });
        S.boss = makeBoss('walker', BOSS_HP); S.bossState = 'intro'; S.bossT = 0; emit('bossIntro', { key: 'walker', finale: true });
        return;
      }
      if (b && b.key === 'walker') { S.boss = makeBoss('core', BOSS_HP); S.bossState = 'intro'; S.bossT = 0; emit('bossIntro', { key: 'core', phase2: true }); return; }
      if (!lv.fort) {
        var bi = BOSSES.indexOf(lv.boss), fresh = !S.prog.beaten[bi];
        S.prog.beaten[bi] = true; saveProg();
        S.phase = 'got'; S.phaseT = 0; S.gotW = bi + 1; S.gotFresh = fresh; S.wsel = 0;
        emit('got', { w: bi + 1, fresh: fresh });
      } else {
        S.prog.fort = Math.max(S.prog.fort, lv.fort); saveProg();
        if (lv.fort >= 3) { S.phase = 'won'; S.won = true; S.phaseT = 0; emit('win', { score: S.score }); }
        else { S.phase = 'clear'; S.phaseT = 0; emit('clear', { fort: lv.fort }); }
      }
    }

    // ----- обновление -----
    function overlap(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1) { return ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0; }
    function heroBox() { var h = S.hero, hh = heroH(h); return [h.x - HW + 0.05, h.y - hh + 0.05, h.x + HW - 0.05, h.y]; }
    function update(dt) {
      S.time += dt; S.phaseT += dt;
      if (S.shake > 0) S.shake -= dt;
      if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }
      if (S.phase === 'select' || S.phase === 'won' || S.phase === 'over') return;
      if (S.phase === 'got') { if (S.phaseT > 4.5) toSelect(); return; }
      if (S.phase === 'clear') { if (S.phaseT > 2.5) startStage(8 + S.prog.fort); return; }
      if (S.phase === 'dead') {
        if (S.phaseT > 1.8) {
          S.lives--;
          if (S.lives <= 0) { S.phase = 'over'; S.over = true; emit('gameover', { score: S.score }); return; }
          S.phase = 'stage'; S.phaseT = 0; respawnAt(S.cp, false);
        }
        return;
      }
      var h = S.hero, W = S.W;
      // ввод → физика героя
      var jp = inp.jump && !prevJump, fp = inp.fire && !prevFire, sp = inp.slide && !prevSlide;
      prevJump = inp.jump; prevFire = inp.fire; prevSlide = inp.slide;
      var hin = { dx: inp.dx, down: inp.down, jump: inp.jump, jumpPress: jp, slidePress: sp };
      if (S.bossState === 'dead') hin = { dx: 0, down: false, jump: false, jumpPress: false, slidePress: false };
      var ev = heroStep(W, h, hin, dt, S.time);
      if (ev & EV_JUMP) emit('jump', {}); if (ev & EV_LAND) emit('land', {}); if (ev & EV_SLIDE) emit('slide', {});
      if (h.inv > 0) h.inv -= dt; if (h.shootT > 0) h.shootT -= dt;
      if (h.ground && Math.abs(h.vx) > 0.1) h.runT += dt * Math.abs(h.vx);
      if (h.dead) { kill(h.dead); return; }
      // огонь: нажатие — выстрел; удержание — заряд наруча; отпускание — заряженный выстрел
      var w = WEAP[S.wsel];
      if (S.bossState !== 'dead') {
        if (fp) fire(0);
        if (w.k === 'spark') {
          if (inp.fire) { var was = h.charge; h.charge += dt; if (was < CH1 && h.charge >= CH1) emit('charge', { lv: 1 }); if (was < CH2 && h.charge >= CH2) emit('charge', { lv: 2 }); }
          else { if (h.charge >= CH1) fire(h.charge >= CH2 ? 2 : 1); h.charge = 0; }
        } else {
          h.charge = 0;
          if (w.k === 'chain' && inp.fire && !fp) { S.jetT = (S.jetT || 0) + dt; if (S.jetT > 0.08) { S.jetT = 0; fire(0); } }
        }
      }
      // контрольные точки
      for (var ci = 0; ci < S.lv.cps.length; ci++) { var cp = S.lv.cps[ci]; if (h.x > cp.x - 0.5 && cp.x > S.cp.x && Math.abs(h.y - cp.y) < 3 && !(S.lv.mini && cp.x > S.lv.mini.x0 && S.miniState !== 'done')) { S.cp = cp; emit('checkpoint', {}); } }
      // появление врагов
      var camC = S.cam.x + VIEW_W / 2;
      S.spawns.forEach(function (sp2) {
        if (sp2.done || (sp2.live && !sp2.live.dead)) return;
        if (sp2.live && sp2.live.dead) { sp2.done = true; return; }
        if (Math.abs(sp2.x - camC) < VIEW_W / 2 + 1 && Math.abs(sp2.x - h.x) > 3) sp2.live = spawnFoe(sp2.type, sp2.x, sp2.y, sp2);
      });
      // мини-босс
      var m = S.lv.mini;
      if (m && S.miniState === 'none' && h.x > m.x0 + 1.6 && h.x < m.x1) {
        S.miniState = 'fight'; for (var r = m.g - 3; r < m.g; r++) W.t[r * W.W + m.x0] = GATE;
        S.mini = spawnFoe(m.type, m.x1 - 3.5, m.type === 'drone' ? m.g - 3 : m.g); S.mini.y0 = m.g; if (m.type === 'drone') S.mini.y = m.g - 3;
        emit('miniIntro', { type: m.type });
      }
      // босс
      var a = S.lv.arena;
      if (S.bossState === 'none' && h.x > a.x0 + 1.6) startBoss();
      if (S.bossState === 'intro') { S.bossT += dt; S.boss.fill = Math.min(1, S.bossT / 1.4); if (S.bossT > 1.6) { S.bossState = 'fight'; S.boss.mt = 0; } }
      else if (S.bossState === 'fight') updBoss(S.boss, dt);
      else if (S.bossState === 'dead') { S.bossT += dt; if (S.bossT > 2.6) { afterBoss(); return; } }
      if (S.bossState !== 'fight' && S.bossState !== 'intro') h.push = 0;
      // враги
      var i, e, s, hb = heroBox();
      for (i = 0; i < S.enemies.length; i++) {
        e = S.enemies[i]; if (e.dead) continue;
        if (!FOE[e.type].mini && Math.abs(e.x - camC) > VIEW_W / 2 + 6) { e.dead = true; if (e.src) { e.src.live = null; } continue; }
        updFoe(e, dt);
        if (!e.dead && overlap(hb[0], hb[1], hb[2], hb[3], e.x - e.hw, e.y - e.hh, e.x + e.hw, e.y)) hurt(FOE[e.type].dmg, 'foe', e.x);
      }
      S.enemies = S.enemies.filter(function (q) { return !q.dead; });
      if (S.boss && !S.boss.dead && S.bossState === 'fight') {
        var b = S.boss;
        if (overlap(hb[0], hb[1], hb[2], hb[3], b.x - b.hw + 0.1, b.y - b.hh + 0.1, b.x + b.hw - 0.1, b.y)) hurt(4, 'boss', b.x);
      }
      // выстрелы героя
      for (i = 0; i < S.shots.length; i++) {
        s = S.shots[i];
        s.life -= dt;
        if (s.ring) { s.r = 0.3 + (0.45 - s.life) / 0.45 * 3.4; s.x = h.x; s.y = h.y - 0.8; }
        else {
          if (s.grav) s.vy = Math.min(s.vy + (s.lob ? 26 : G) * dt, MAXF);
          if (s.k === 'boomer') {          // молот-бумеранг: 0.45 с вперёд, затем — обратно в руку
            s.age += dt;
            if (s.age > 0.45) { var bdx = h.x - s.x, bdy = (h.y - 0.95) - s.y, bn = Math.hypot(bdx, bdy) || 1; s.vx = bdx / bn * 12; s.vy = bdy / bn * 12; if (bn < 0.6) s.life = 0; }
            else s.vx = s.dir * 12 * (1 - s.age / 0.6);
          }
          s.x += s.vx * dt; s.y += s.vy * dt;
          if (s.k === 'boomer') { /* сквозь стены: молот возвращается всегда */ }
          else if (s.k === 'mine') { if (solid(W, Math.floor(s.x), Math.floor(s.y + s.r), S.time)) { s.y = Math.floor(s.y + s.r) - s.r; s.vy = 0; } if (solid(W, Math.floor(s.x + Math.sign(s.vx) * s.r), Math.floor(s.y), S.time)) s.life = 0; }
          else if (s.k === 'frost') { if (solid(W, Math.floor(s.x), Math.floor(s.y + s.r), S.time)) { s.life = 0; S.puddles.push({ x: s.x, y: Math.floor(s.y + s.r), w: 1.4, life: 1.6, mine: true, tick: 0 }); emit('sizzle', {}); } }
          else if (s.floor) { if (!solid(W, Math.floor(s.x), Math.floor(s.y + 0.6), S.time) || solid(W, Math.floor(s.x), Math.floor(s.y), S.time)) s.life = 0; }
          else if (solid(W, Math.floor(s.x), Math.floor(s.y), S.time)) { s.life = 0; if (s.k === 'spark') emit('tink', {}); }
        }
        if (s.x < S.cam.x - 1 || s.x > S.cam.x + VIEW_W + 1) s.life = 0;
        if (s.life <= 0) continue;
        for (var j = 0; j < S.enemies.length; j++) {
          e = S.enemies[j]; if (e.dead) continue;
          if (s.hitIds && s.hitIds.indexOf(e.id) >= 0) continue;
          if (overlap(s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r, e.x - e.hw, e.y - e.hh, e.x + e.hw, e.y)) {
            if (s.ring || s.pierce) {
              s.hitIds = s.hitIds || []; s.hitIds.push(e.id); foeHit(e, s);
              if (s.k === 'spark' && !e.dead) { s.life = 0; break; }   // заряд пробивает только тех, кого добил
            } else { foeHit(e, s); s.life = 0; break; }
          }
        }
        if (s.life > 0 && S.boss && !S.boss.dead && S.bossState === 'fight') {
          var bb = S.boss;
          if (overlap(s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r, bb.x - bb.hw, bb.y - bb.hh, bb.x + bb.hw, bb.y)) {
            if (s.ring) { if (!s.hitBoss) { s.hitBoss = true; hitBoss(bb, s); } }
            else if (bb.inv > 0) { if (!s.pierce) { s.life = 0; emit('tink', {}); } }
            else { hitBoss(bb, s); if (!(s.pierce && s.k !== 'spark')) s.life = 0; }
          }
        }
        // вихрь и звон гасят вражеские снаряды
        if (s.life > 0 && (s.k === 'harpoon' || s.ring)) for (j = 0; j < S.eshots.length; j++) { var q = S.eshots[j]; if (!q.solid && Math.hypot(q.x - s.x, q.y - s.y) < s.r + 0.4) q.life = 0; }
      }
      S.shots = S.shots.filter(function (q) { return q.life > 0; });
      // вражеские снаряды
      for (i = 0; i < S.eshots.length; i++) {
        s = S.eshots[i]; s.life -= dt;
        if (s.g) s.vy = Math.min(s.vy + s.g * dt, MAXF);
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.kind === 'bubble') s.y = s.y0 + Math.sin(S.time * 3 + s.sine) * 0.9;
        var hwq = s.hw || s.r, hhq = s.hh || s.r;
        if (s.floor) { if (s.x < a.x0 + 0.5 && S.bossState !== 'none' || s.x > a.x0 + 25.5) s.life = 0; }
        if ((s.g || s.vy > 0) && !s.floor) {
          var fr = Math.floor(s.y + hhq);
          if (solid(W, Math.floor(s.x), fr, S.time) && s.vy > 0) {
            if (s.bounce) { s.bounce--; s.vy = -Math.abs(s.vy) * 0.75; s.y = fr - hhq; }
            else { s.life = 0; if (s.puddle) { S.puddles.push({ x: s.x, y: fr, w: 1.6, life: 2.2, mine: false }); emit('sizzle', {}); } else if (s.crate) { emit('crash', { x: s.x, y: fr }); } }
          }
        }
        if (!s.floor && !s.g && solid(W, Math.floor(s.x), Math.floor(s.y), S.time)) s.life = 0;
        if (s.x < S.cam.x - 3 || s.x > S.cam.x + VIEW_W + 3 || s.y > R + 1) s.life = 0;
        if (s.life <= 0) continue;
        if (overlap(hb[0], hb[1], hb[2], hb[3], s.x - hwq, s.y - hhq, s.x + hwq, s.y + hhq)) {
          hurt(s.dmg, s.kind || 'shot', s.x); if (!s.solid && !s.floor) s.life = 0;
        }
      }
      S.eshots = S.eshots.filter(function (q) { return q.life > 0; });
      // лужи припоя
      for (i = 0; i < S.puddles.length; i++) {
        var p = S.puddles[i]; p.life -= dt;
        if (p.mine) {
          p.tick -= dt; if (p.tick <= 0) { p.tick = 0.3; S.enemies.forEach(function (en) { if (!en.dead && Math.abs(en.x - p.x) < p.w / 2 + en.hw && Math.abs(en.y - p.y) < 0.6) foeHit(en, { dmg: 1 }); }); if (S.boss && S.bossState === 'fight' && Math.abs(S.boss.x - p.x) < p.w / 2 + S.boss.hw && Math.abs(S.boss.y - p.y) < 0.6) hitBoss(S.boss, { k: 'frost', dmg: 1 }); }
        } else if (Math.abs(h.x - p.x) < p.w / 2 + HW - 0.1 && Math.abs(h.y - p.y) < 0.3) hurt(3, 'puddle', p.x);
      }
      S.puddles = S.puddles.filter(function (q) { return q.life > 0; });
      // предметы
      for (i = 0; i < S.items.length; i++) {
        var it = S.items[i]; if (it.got) continue;
        if (!it.fixed) {
          it.vy = Math.min((it.vy || 0) + G * dt, MAXF); it.y += it.vy * dt;
          if (solid(W, Math.floor(it.x), Math.floor(it.y), S.time)) { it.y = Math.floor(it.y); it.vy = 0; }
          it.life -= dt; if (it.life <= 0 || it.y > R + 1) { it.got = true; continue; }
        }
        if (overlap(hb[0], hb[1], hb[2], hb[3], it.x - 0.4, it.y - 0.8, it.x + 0.4, it.y)) pickup(it);
      }
      S.items = S.items.filter(function (q) { return !q.got; });
      // камера
      S.cam.x += (camTarget() - S.cam.x) * Math.min(1, dt * 10);
      if (S.lock) S.cam.x = Math.max(S.lock.x0, Math.min(S.lock.x1 - VIEW_W, S.cam.x));
    }
    function toSelect() { S.phase = 'select'; S.phaseT = 0; S.stage = -1; S.lv = null; S.shots = []; S.eshots = []; S.enemies = []; S.boss = null; emit('select', {}); }

    var api = {
      start: function () { toSelect(); return api; },
      update: update,
      setInput: function (o) { o = o || {}; inp.dx = o.dx || 0; inp.down = !!o.down; inp.jump = !!o.jump; inp.fire = !!o.fire; inp.slide = !!o.slide; },
      state: function () { return S; },
      // экран выбора: 0..7 — мастерские, 8 — Чёрная Домна (когда побеждены все 8)
      canPick: function (i) { return i >= 0 && i < 8 ? true : i === 8 && allBeaten(); },
      pick: function (i) {
        if (S.phase !== 'select' || !api.canPick(i)) return false;
        S.sel = i; S.lives = Math.max(S.lives, 1);
        startStage(i === 8 ? 8 + Math.min(2, S.prog.fort) : i); return true;
      },
      owned: owned,
      selectWeapon: function (i) { if (!owned(i) || S.wsel === i) return false; S.wsel = i; S.hero.charge = 0; emit('weapon', { w: i }); return true; },
      cycleWeapon: function (d) { for (var k = 1; k <= WEAP.length; k++) { var j = (S.wsel + d * k + WEAP.length * 3) % WEAP.length; if (owned(j)) return api.selectWeapon(j); } return false; },
      useTank: function () {
        if (S.phase !== 'stage' || S.prog.tanks <= 0 || S.hero.hp >= MAX_HP) return false;
        S.prog.tanks--; S.hero.hp = MAX_HP; saveProg(); emit('tank', {}); return true;
      },
      continueAfterGot: function () { if (S.phase === 'got' && S.phaseT > 1.2) { toSelect(); return true; } return false; },
      resetProgress: function () { S.prog = OZ.save.blank(); saveProg(); },
      password: function () { return OZ.save.encode(S.prog); },
      applyPassword: function (code) { var p = OZ.save.decode(code); if (!p) return false; S.prog = p; saveProg(); return true; },
      newRun: function () { S.lives = LIVES; S.score = 0; S.over = false; S.won = false; S.prog = loadProg(); toSelect(); },
      // отладка/тесты
      _hurt: hurt, _kill: kill, _place: function (x, y) { S.hero.x = x; S.hero.y = y; S.hero.vy = 0; S.cam.x = camTarget(); },
      _startBoss: function () { var a = S.lv.arena; S.hero.x = a.x0 + 4; S.hero.y = 12; startBoss(); S.cam.x = camTarget(); },
      _hitBoss: function (k, lv) { var b = S.boss; if (!b) return false; b.inv = 0; return hitBoss(b, { k: k || 'spark', lv: lv || 0, dmg: 1 }); },
      _beatAll: function () { for (var i = 0; i < 8; i++) S.prog.beaten[i] = true; saveProg(); },
      _spawn: spawnFoe, _fire: fire, _bossDamage: function (key, k, lv) { return bossDamage({ key: key }, { k: k, lv: lv || 0 }); }
    };
    return api;
  }

  OZ.Game = Game;
  OZ.logic = {
    VIEW_W: VIEW_W, R: R, HW: HW, HH: HH, SH: SH, RUN: RUN, JV: JV, G: G, JCUT: JCUT, SLV: SLV, MAX_HP: MAX_HP, MAX_EN: MAX_EN, LIVES: LIVES, MAX_TANKS: MAX_TANKS,
    BL_P: BL_P, BL_STEP: BL_STEP, BL_ON: BL_ON, CH1: CH1, CH2: CH2, BOSSES: BOSSES, WEAP: WEAP, WEAK: WEAK, BOSS_HP: BOSS_HP, REMATCH_HP: REMATCH_HP,
    E: E, SOL: SOL, SPK: SPK, BLK: BLK, GATE: GATE,
    tileAt: tileAt, solid: solid, blinkOn: blinkOn, boxHit: boxHit, newHero: newHero, heroStep: heroStep, simulate: simulate, MACROS: MACROS, macroInput: macroInput,
    isNode: isNode, isLow: isLow, Nav: Nav, blinkRun: blinkRun, blinkReady: blinkReady, mulberry32: mulberry32
  };
})(typeof window !== 'undefined' ? window : globalThis);
