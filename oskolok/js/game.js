/* ОСКОЛОК · логика (без DOM, детерминирована). Главная механика — ОБМЕН С ОСКОЛКОМ: бросок осколка по дуге (стрелки задают наклон),
   осколок втыкается в первое твёрдое; нажатие ещё раз — герой переносится в точку осколка. Стекло ('g') осколок пробивает насквозь,
   а герой — нет; осколок убивает врагов на лету и подбирает бусины. Пока осколок не воткнулся, обмена нет; «вернуть» — осколок в руку.
   Герой: 3 сердечка, жизни, продолжения; стекляшки и яма отнимают сердечко и возвращают на последнюю безопасную опору.
   Координаты — в клетках: x — центр героя, y — подошвы (пол клетки ряда r — на высоте y = r). */
(function (global) {
  'use strict';
  var O = global.OSKOLOK = global.OSKOLOK || {};
  var K = {
    RUN: 6.5, ACC: 70, FRIC: 90, AIRACC: 45, AIRFRIC: 10, G: 42, JUMP: 14.5, VMAX: 24, HW: 0.32, HH: 1.7, COYOTE: 0.08, JBUF: 0.1,
    SG: 24, SHARD_T: 3, THROW_CD: 0.18, HP: 3, LIVES: 3, CONTS: 3, INV: 1.4, DEAD: 1.3, CLEAR: 2.4, LIFE1: 6000, LIFE_N: 9000,
    BEAD: 100, KILL: 200, CRAWL_V: 1.5, BAT_V: 2.2, BAT_R: 3.5, TURRET_T: 2.4, SPARK_V: 7, VIEW_W: 32, VIEW_H: 16
  };
  // бросок: [скорость вперёд, скорость вверх]; вид по стрелкам: 0 — прямо, 1 — вверх по диагонали, 2 — вверх, 3 — вниз по диагонали, 4 — вниз
  var THROWS = [[14, -5], [9, -13], [0, -16], [8, 3], [0, 13]];
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function approach(v, t, d) { return v < t ? Math.min(t, v + d) : Math.max(t, v - d); }

  // ---------- карта ----------
  function parse(def) {
    var W = def.W, H = def.H, t = [], start = null, mobs = [], items = [];
    for (var r = 0; r < H; r++) for (var c = 0; c < W; c++) {
      var ch = def.map[r][c];
      if (ch === 'P') { start = { x: c + 0.5, y: r + 1 }; ch = '.'; }
      else if (ch === 'e' || ch === 'b' || ch === 't' || ch === 'T') { mobs.push({ k: ch, c: c, r: r }); ch = '.'; }
      else if (ch === 'o' || ch === 'h') { items.push({ x: c + 0.5, y: r + 0.5, k: ch === 'o' ? 'bead' : 'heart', got: false }); ch = '.'; }
      t.push(ch);
    }
    return { W: W, H: H, t: t, start: start || { x: 2.5, y: def.H - 4 }, mobs: mobs, items: items };
  }
  function tile(M, c, r) { return c < 0 || c >= M.W || r < 0 ? '#' : r >= M.H ? '.' : M.t[r * M.W + c]; }
  function solid(M, c, r) { var ch = tile(M, c, r); return ch === '#' || ch === 'g'; }       // для героя и врагов
  function shardSolid(M, c, r) { return tile(M, c, r) === '#'; }                              // осколок проходит стекло
  function bodyFree(M, x, y) {
    var r0 = Math.floor(y - K.HH + 1e-4), r1 = Math.floor(y - 1e-4), c0 = Math.floor(x - K.HW + 1e-4), c1 = Math.floor(x + K.HW - 1e-4);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (solid(M, c, r)) return false;
    return true;
  }

  // ---------- герой (общая физика для игры, графа проходимости и бота) ----------
  function newHero(x, y, face) { return { x: x, y: y, vx: 0, vy: 0, face: face || 1, ground: true, coyote: K.COYOTE, jbuf: 0, landV: 0, inv: 0, kb: 0, walkT: 0, dead: false }; }
  function stepHero(h, inp, M, dt, ev) {
    var tx = inp.x * K.RUN, a = h.ground ? (inp.x ? K.ACC : K.FRIC) : (inp.x ? K.AIRACC : K.AIRFRIC);
    h.vx = approach(h.vx, tx, a * dt);
    if (inp.x) h.face = inp.x > 0 ? 1 : -1;
    if (inp.jump) h.jbuf = K.JBUF;
    if (h.jbuf > 0 && (h.ground || h.coyote > 0)) { h.vy = -K.JUMP; h.ground = false; h.coyote = 0; h.jbuf = 0; if (ev) ev('jump', { x: h.x, y: h.y }); }
    h.jbuf = Math.max(0, h.jbuf - dt);
    h.vy = Math.min(K.VMAX, h.vy + K.G * dt);
    var r0, r1, c0, c1, c, r;
    h.x += h.vx * dt;
    r0 = Math.floor(h.y - K.HH + 1e-6); r1 = Math.floor(h.y - 1e-6);
    if (h.vx > 0) { c = Math.floor(h.x + K.HW - 1e-9); for (r = r0; r <= r1; r++) if (solid(M, c, r)) { h.x = c - K.HW - 1e-6; h.vx = 0; break; } }
    else if (h.vx < 0) { c = Math.floor(h.x - K.HW + 1e-9); for (r = r0; r <= r1; r++) if (solid(M, c, r)) { h.x = c + 1 + K.HW + 1e-6; h.vx = 0; break; } }
    var vyB = h.vy, landed = false;
    h.y += h.vy * dt;
    c0 = Math.floor(h.x - K.HW + 1e-6); c1 = Math.floor(h.x + K.HW - 1e-6);
    if (h.vy > 0) { r = Math.floor(h.y - 1e-7); for (c = c0; c <= c1; c++) if (solid(M, c, r)) { h.y = r; h.vy = 0; landed = true; break; } }
    else if (h.vy < 0) { r = Math.floor(h.y - K.HH); for (c = c0; c <= c1; c++) if (solid(M, c, r)) { h.y = r + 1 + K.HH; h.vy = 0; break; } }
    var was = h.ground; h.ground = landed;
    if (h.ground) h.coyote = K.COYOTE; else h.coyote = Math.max(0, h.coyote - dt);
    if (landed && !was) { h.landV = vyB; if (ev) ev('land', { v: vyB, x: h.x, y: h.y }); } else h.landV = 0;
    return h;
  }
  // что угрожает герою: 'spike' | 'pit' | null
  function hazard(h, M) {
    if (h.y > M.H + 1.5) return 'pit';
    var r0 = Math.floor(h.y - K.HH + 1e-6), r1 = Math.floor(h.y - 1e-6), c0 = Math.floor(h.x - K.HW + 1e-6), c1 = Math.floor(h.x + K.HW - 1e-6);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      if (tile(M, c, r) === '^' && h.y > r + 0.45 && h.x + K.HW > c + 0.12 && h.x - K.HW < c + 0.88) return 'spike';
    }
    return null;
  }
  function overlapsTile(h, M, ch) {
    var r0 = Math.floor(h.y - K.HH + 1e-6), r1 = Math.floor(h.y - 1e-6), c0 = Math.floor(h.x - K.HW + 1e-6), c1 = Math.floor(h.x + K.HW - 1e-6);
    for (var r = Math.max(0, r0); r <= Math.min(M.H - 1, r1); r++) for (var c = Math.max(0, c0); c <= Math.min(M.W - 1, c1); c++) if (M.t[r * M.W + c] === ch) return r * M.W + c;
    return -1;
  }

  // ---------- осколок ----------
  function aimKind(dx, dy) { return dy < 0 ? (dx ? 1 : 2) : dy > 0 ? (dx ? 3 : 4) : 0; }
  function newShard(h, kind) {
    var T = THROWS[kind], f = h.face;
    return { st: 'fly', x: h.x, y: h.y - 1.1, vx: (kind === 2 || kind === 4 ? 0 : f * T[0]), vy: T[1], t: 0, kind: null, dir: f, aim: kind };
  }
  // шаг полёта осколка: подшаги по 1/120 с, втыкается в первое твёрдое ('#', край карты, потолок)
  function stepShard(s, M, dt) {
    var n = Math.max(1, Math.round(dt * 120)), d = dt / n;
    for (var i = 0; i < n && s.st === 'fly'; i++) {
      s.t += d; s.vy += K.SG * d;
      var nx = s.x + s.vx * d, c = Math.floor(nx), r = Math.floor(s.y);
      if (nx < 0 || nx >= M.W || shardSolid(M, c, r)) {
        s.x = s.vx > 0 ? Math.min(M.W - 0.02, Math.floor(nx) - 0.02) : Math.max(0.02, Math.floor(nx) + 1.02); if (nx < 0) s.x = 0.02;
        s.st = 'plant'; s.kind = 'wall'; s.dir = s.vx >= 0 ? 1 : -1; s.vx = 0; s.vy = 0; return s;
      }
      s.x = nx;
      var ny = s.y + s.vy * d; c = Math.floor(s.x); r = Math.floor(ny);
      if (shardSolid(M, c, r)) {
        s.st = 'plant';
        if (s.vy > 0) { s.y = r - 0.0001; s.kind = 'floor'; } else { s.y = r + 1.0001; s.kind = 'ceil'; }
        s.vx = 0; s.vy = 0; return s;
      }
      s.y = ny;
      if (s.y > M.H + 3 || s.t > K.SHARD_T) { s.st = 'lost'; return s; }
    }
    return s;
  }
  // куда встанет герой при обмене (или null — «заклинило»)
  function landing(M, s) {
    var bx, by;
    if (s.kind === 'floor') { bx = s.x; by = s.y; }
    else if (s.kind === 'ceil') { bx = s.x; by = s.y + K.HH + 0.01; }
    else { bx = s.x - s.dir * (K.HW - 0.01); by = s.y + 1.0; }
    var dys = [0, -0.2, -0.4, 0.2, 0.4, -0.7, 0.7, -1.0], dxs = [0, -0.15, 0.15, -0.3, 0.3, -0.45, 0.45];
    for (var i = 0; i < dys.length; i++) for (var j = 0; j < dxs.length; j++) {
      var x = bx + dxs[j], y = by + dys[i];
      if (x > K.HW && x < M.W - K.HW && bodyFree(M, x, y)) return { x: x, y: y };
    }
    return null;
  }

  // ---------- Игра ----------
  O.Game = function (opts) {
    opts = opts || {};
    var emitF = opts.onEvent, rng = opts.rng || mulberry32(1), calm = !!opts.calm, S = null, api;
    function emit(t, d) { if (emitF) emitF(t, d || {}); }

    function dcopy(o) { return JSON.parse(JSON.stringify(o)); }
    function loadLevel(fi) {
      var def = O.LEVELS[fi], P = parse(def);
      S.fi = fi; S.key = def.key; S.def = def;
      S.lv = { W: P.W, H: P.H, t: P.t };
      S.items = P.items; S.start = P.start; S.cp = null; S.lit = {};
      S.hero = newHero(P.start.x, P.start.y, 1);
      S.shard = { st: 'hand' }; S.sparks = []; S.enemies = [];
      S.safe = { x: P.start.x, y: P.start.y }; S.safeT = 0;
      S.hp = K.HP; S.cont = 0;
      if (!calm) P.mobs.forEach(function (m, k) { S.enemies.push(spawnMob(m, k)); });
      S.cam = { x: 0, y: 0 }; snapCam();
      S.phase = 'play'; S.phaseT = 0; S.levelT = 0; S.deathsLv = 0;
      emit('level', { fi: fi, key: S.key });
    }
    function spawnMob(m, k) {
      var x = m.c + 0.5, y = m.r + 1, e = { id: k, k: m.k === 'e' ? 'crawler' : m.k === 'b' ? 'bat' : 'turret', x: x, y: y, face: m.k === 'T' ? 1 : -1, alive: true, t: 0, x0: x, y0: y };
      if (e.k === 'crawler') { var b = floorBounds(x, y, 7); e.minX = b.min; e.maxX = b.max; }
      if (e.k === 'bat') { e.y = m.r + 0.5; e.y0 = e.y; e.ph = (k * 1.7) % 6; }
      if (e.k === 'turret') e.t = (k * 0.9) % K.TURRET_T;
      return e;
    }
    function floorBounds(x, y, lim) {   // отрезок пола под ползуном, не дальше lim клеток, без рвов и стекляшек
      var M = S.lv, c0 = Math.floor(x), r = Math.round(y), L = c0, R = c0;
      var okc = function (c) { return c >= 1 && c < M.W - 1 && solid(M, c, r) && !solid(M, c, r - 1) && tile(M, c, r - 1) !== '^'; };
      while (L - 1 >= c0 - lim && okc(L - 1)) L--;
      while (R + 1 <= c0 + lim && okc(R + 1)) R++;
      return { min: L + 0.5, max: R + 0.5 };
    }
    function snapCam() { var c = camTarget(); S.cam.x = c.x; S.cam.y = c.y; }
    function camTarget() {
      var h = S.hero, M = S.lv;
      return { x: Math.max(0, Math.min(M.W - K.VIEW_W, h.x - K.VIEW_W / 2 + h.face * 1.5)), y: Math.max(0, Math.min(M.H - K.VIEW_H, h.y - 9.5)) };
    }
    function addScore(n) {
      S.score += n;
      while (S.score >= S.nextLife) { S.lives++; S.nextLife += K.LIFE_N; emit('life', {}); }
    }
    function initGame(st) {
      st = st || {};
      S = { phase: 'play', phaseT: 0, fi: 0, score: st.score || 0, lives: st.lives || K.LIVES, conts: K.CONTS, time: 0, kills: 0, deaths: 0, boosted: false,
        nextLife: K.LIFE1, inp: {}, prev: {}, clock: 0, over: false, won: false };
      while (S.nextLife <= S.score) S.nextLife += K.LIFE_N;
      loadLevel(Math.max(0, Math.min(O.LEVELS.length - 1, st.fi || 0)));
    }

    // ---------- урон, смерть, возврат ----------
    function toSafe(inv) {
      var h = S.hero; h.x = S.safe.x; h.y = S.safe.y; h.vx = 0; h.vy = 0; h.ground = true; h.inv = inv; h.kb = 0; snapCam();
    }
    function hurt(why, fromX, soft) {
      var h = S.hero; if (S.phase !== 'play' || h.inv > 0) return;
      S.hp--; emit('hurt', { x: h.x, y: h.y - 1, why: why, hp: S.hp });
      if (S.hp <= 0) { die(why); return; }
      if (why === 'spike' || why === 'pit') { toSafe(K.INV); S.shard = S.shard.st === 'fly' ? { st: 'hand' } : S.shard; emit('respawnSafe', { x: h.x, y: h.y }); return; }
      h.inv = K.INV; h.kb = 0.25; h.vx = (h.x >= fromX ? 1 : -1) * 6; h.vy = -8; h.ground = false;
    }
    function die(why) {
      if (S.phase !== 'play') return;
      var h = S.hero; S.phase = 'dead'; S.phaseT = 0; S.deaths++; S.deathsLv++; S.lives--; h.dead = true;
      emit('die', { why: why, x: h.x, y: h.y });
    }
    function respawn() {
      var P = S.cp || S.start;
      S.hero = newHero(P.x, P.y, 1); S.hero.inv = 1.2; S.hp = K.HP; S.shard = { st: 'hand' }; S.sparks = [];
      S.safe = { x: P.x, y: P.y }; S.safeT = 0; S.phase = 'play'; S.phaseT = 0;
      S.enemies.forEach(function (e) { if (e.k === 'crawler' && e.alive) { e.x = e.x0; } });
      snapCam(); emit('respawn', {});
    }

    // ---------- осколок: бросок, обмен, возврат ----------
    function throwShard() {
      var h = S.hero, I = S.inp, kind = aimKind(I.dx || 0, I.dy || 0);
      if (I.dx) h.face = I.dx > 0 ? 1 : -1;
      S.shard = newShard(h, kind); S.throwCd = K.THROW_CD;
      emit('throw', { x: S.shard.x, y: S.shard.y, kind: kind });
    }
    function swap() {
      var s = S.shard, h = S.hero, M = S.lv, p = landing(M, s);
      if (!p) { S.shard = { st: 'hand' }; emit('fizzle', { x: s.x, y: s.y }); return false; }
      emit('swap', { x0: h.x, y0: h.y - 0.9, x1: p.x, y1: p.y - 0.9 });
      h.x = p.x; h.y = p.y; h.vx = 0; h.vy = 0; h.ground = bodyOnFloor(M, h); h.coyote = h.ground ? K.COYOTE : 0; h.jbuf = 0;
      S.shard = { st: 'hand' }; S.throwCd = K.THROW_CD; S.safeT = 0;
      return true;
    }
    function bodyOnFloor(M, h) { return !bodyFree(M, h.x, h.y + 0.05); }
    function recall() { if (S.shard.st === 'fly' || S.shard.st === 'plant') { S.shard = { st: 'hand' }; emit('recall', {}); } }
    function shardHits() {
      var s = S.shard; if (s.st !== 'fly' && s.st !== 'plant') return;
      var M = S.lv, c = Math.floor(s.x), r = Math.floor(s.y);
      S.items.forEach(function (it) { if (!it.got && it.k === 'bead' && Math.abs(it.x - s.x) < 0.7 && Math.abs(it.y - s.y) < 0.7) { it.got = true; addScore(K.BEAD); emit('pickup', { k: 'bead', x: it.x, y: it.y, shard: true }); } });
      if (s.st !== 'fly') return;
      S.enemies.forEach(function (e) {
        if (!e.alive) return;
        var b = ebox(e);
        if (s.x > b[0] - 0.25 && s.x < b[2] + 0.25 && s.y > b[1] - 0.25 && s.y < b[3] + 0.25) killEnemy(e);
      });
    }
    function killEnemy(e) { e.alive = false; e.t = 0; S.kills++; addScore(K.KILL); emit('kill', { x: e.x, y: e.y, k: e.k, pts: K.KILL }); }
    function ebox(e) {
      if (e.k === 'bat') return [e.x - 0.45, e.y - 0.35, e.x + 0.45, e.y + 0.35];
      return [e.x - 0.42, e.y - (e.k === 'turret' ? 1.0 : 0.9), e.x + 0.42, e.y];
    }

    // ---------- враги ----------
    function stepEnemies(dt) {
      var M = S.lv, h = S.hero;
      S.enemies.forEach(function (e) {
        if (!e.alive) { e.t += dt; return; }
        e.t += dt;
        if (e.k === 'crawler') {
          e.x += e.face * K.CRAWL_V * dt;
          if (e.x > e.maxX) { e.x = e.maxX; e.face = -1; } else if (e.x < e.minX) { e.x = e.minX; e.face = 1; }
        } else if (e.k === 'bat') {
          var nx = e.x + e.face * K.BAT_V * dt;
          if (Math.abs(nx - e.x0) > K.BAT_R || solid(M, Math.floor(nx + e.face * 0.5), Math.floor(e.y))) e.face = -e.face; else e.x = nx;
          e.y = e.y0 + Math.sin((e.t + e.ph) * 2.4) * 0.8;
        } else if (e.k === 'turret') {
          e.fireT = (e.fireT == null ? e.t : e.fireT);
          if (e.t >= K.TURRET_T) { e.t -= K.TURRET_T; if (Math.abs(h.x - e.x) < 18 && Math.abs(h.y - e.y) < 12) { S.sparks.push({ x: e.x + e.face * 0.6, y: e.y - 0.55, vx: e.face * K.SPARK_V }); emit('spark', { x: e.x, y: e.y - 0.5 }); } }
        }
        if (!h.dead && h.inv <= 0) {
          var b = ebox(e);
          if (h.x + K.HW > b[0] && h.x - K.HW < b[2] && h.y > b[1] && h.y - K.HH < b[3]) hurt(e.k, e.x);
        }
      });
      for (var i = S.sparks.length - 1; i >= 0; i--) {
        var q = S.sparks[i]; q.x += q.vx * dt;
        if (solid(M, Math.floor(q.x), Math.floor(q.y))) { S.sparks.splice(i, 1); emit('sparkBreak', { x: q.x, y: q.y }); continue; }
        if (!h.dead && h.inv <= 0 && Math.abs(q.x - h.x) < K.HW + 0.2 && q.y > h.y - K.HH && q.y < h.y) { S.sparks.splice(i, 1); hurt('spark', q.x - Math.sign(q.vx)); }
      }
    }

    // ---------- шаг ----------
    function update(dt) {
      if (!S) return;
      S.clock += dt;
      if (S.phase === 'dead') {
        S.phaseT += dt;
        if (S.phaseT > K.DEAD) { if (S.lives > 0) respawn(); else if (S.conts > 0) { S.phase = 'cont'; S.phaseT = 0; emit('continueQ', { left: S.conts }); } else { S.phase = 'over'; S.over = true; emit('gameover', { score: S.score }); } }
        return;
      }
      if (S.phase === 'clear') { S.phaseT += dt; if (S.phaseT > K.CLEAR) loadLevel(S.fi + 1); return; }
      if (S.phase !== 'play') { if (S.phase === 'won') S.phaseT += dt; return; }
      S.time += dt; S.levelT += dt;
      var h = S.hero, I = S.inp, P = S.prev, M = S.lv;
      var actP = !!I.act && !P.act, recP = !!I.recall && !P.recall, jumpP = !!I.jump && !P.jump;
      S.prev = { act: !!I.act, recall: !!I.recall, jump: !!I.jump };
      S.throwCd = Math.max(0, (S.throwCd || 0) - dt);
      if (actP && S.throwCd <= 0 && !h.kb) {
        if (S.shard.st === 'hand') throwShard();
        else if (S.shard.st === 'plant') swap();
      }
      if (recP) recall();
      h.inv = Math.max(0, h.inv - dt);
      if (h.kb > 0) h.kb -= dt;
      var dx = h.kb > 0 ? 0 : (I.dx || 0);
      stepHero(h, { x: dx, jump: jumpP && h.kb <= 0 }, M, dt, emit);
      h.walkT += Math.abs(h.vx) * dt;
      // подвижное: осколок
      if (S.shard.st === 'fly') {
        stepShard(S.shard, M, dt);
        if (S.shard.st === 'plant') emit('plant', { x: S.shard.x, y: S.shard.y, kind: S.shard.kind });
        else if (S.shard.st === 'lost') { S.shard = { st: 'hand' }; emit('lost', {}); }
      }
      shardHits();
      if (!calm) stepEnemies(dt);
      // безопасная опора
      if (h.ground && !h.kb) {
        S.safeT += dt;
        if (S.safeT > 0.3) {
          var cl = Math.floor(h.x - 0.4), cr = Math.floor(h.x + 0.4), r = Math.round(h.y), okc = true, rr, cc;
          if (!(solid(M, cl, r) && solid(M, cr, r))) okc = false;
          for (cc = Math.floor(h.x) - 1; cc <= Math.floor(h.x) + 1; cc++) for (rr = r - 2; rr <= r; rr++) if (tile(M, cc, rr) === '^') okc = false;
          if (okc && !S.enemies.some(function (e) { return e.alive && Math.abs(e.x - h.x) < 3 && Math.abs(e.y - h.y) < 3; })) { S.safe.x = h.x; S.safe.y = h.y; }
        }
      } else S.safeT = 0;
      var hz = hazard(h, M); if (hz) hurt(hz, h.x);
      if (S.phase !== 'play') return;
      // предметы, лампа, дверь
      S.items.forEach(function (it) {
        if (it.got) return;
        if (Math.abs(h.x - it.x) < 0.7 && h.y - K.HH - 0.3 < it.y && h.y + 0.3 > it.y) {
          if (it.k === 'heart' && S.hp >= K.HP) return;
          it.got = true;
          if (it.k === 'bead') { addScore(K.BEAD); emit('pickup', { k: 'bead', x: it.x, y: it.y }); }
          else { S.hp = Math.min(K.HP, S.hp + 1); emit('pickup', { k: 'heart', x: it.x, y: it.y }); }
        }
      });
      var kl = overlapsTile(h, M, 'k');
      if (kl >= 0 && !S.lit[kl]) { S.lit[kl] = true; S.cp = { x: (kl % M.W) + 0.5, y: ((kl / M.W) | 0) + 1 }; emit('checkpoint', { x: S.cp.x, y: S.cp.y }); }
      if (overlapsTile(h, M, 'X') >= 0) { clearLevel(); return; }
      // камера
      var ct = camTarget(), k = Math.min(1, dt * 7);
      S.cam.x += (ct.x - S.cam.x) * k; S.cam.y += (ct.y - S.cam.y) * k;
    }
    function clearLevel() {
      var bonus = S.hp * 300 + (S.deathsLv === 0 ? 500 : 0); addScore(bonus);
      if (S.fi >= O.LEVELS.length - 1) { S.phase = 'won'; S.phaseT = 0; S.won = true; emit('win', { score: S.score }); return; }
      S.phase = 'clear'; S.phaseT = 0; emit('clear', { bonus: bonus, fi: S.fi });
    }

    api = {
      start: function () { initGame(opts.start); return api; }, update: update, state: function () { return S; },
      setInput: function (i) { if (S) S.inp = i || {}; },
      reviveAd: function () {
        if (S.phase !== 'over' && S.phase !== 'cont' && S.phase !== 'dead') return false;
        S.over = false; S.lives = 1; respawn(); S.hp = Math.round(K.HP * 0.67); S.hero.inv = 2; emit('revived'); return true;
      },
      canBoost: function () { return !S.boosted && S.phase === 'play' && S.hp < K.HP; },
      boost: function () { if (!api.canBoost()) return false; S.boosted = true; S.hp = K.HP; emit('boost'); return true; },
      continueGame: function () {
        if (S.phase !== 'cont') return;
        S.conts--; S.lives = K.LIVES; S.score = 0; S.nextLife = K.LIFE1; S.cp = null; S.phase = 'dead'; respawn(); emit('continued');
      },
      giveUp: function () { if (S.phase === 'cont') { S.phase = 'over'; S.over = true; emit('gameover', { score: S.score }); } },
      saveData: function () { return { fi: S.fi, score: S.score, lives: Math.max(1, S.lives) }; },
      // тестовые хуки
      _level: function (fi) { loadLevel(fi); }, _place: function (x, y, face) { S.hero = newHero(x, y, face || 1); S.safe = { x: x, y: y }; snapCam(); },
      _spawn: function (ch, c, r) { S.enemies.push(spawnMob({ k: ch, c: c, r: r }, S.enemies.length)); }, _hurt: function (w, x) { S.hero.inv = 0; hurt(w || 'crawler', x == null ? S.hero.x - 1 : x); },
      _die: function () { die('test'); }, _clear: clearLevel,
      _reset: function () { S.phase = 'play'; S.hp = K.HP; S.shard = { st: 'hand' }; S.sparks = []; S.prev = {}; S.inp = {}; S.throwCd = 0; S.hero.inv = 0; S.hero.kb = 0; S.hero.dead = false; }
    };
    return api;
  };

  // ---------- миграция записей (механика сменилась: прежнее сохранение и концовки стираются, прежний рекорд-время сохраняется отдельно) ----------
  O.migrate = function (io) {
    if (io.get('arcade.oskolok.v') === '2') return { migrated: false, oldBest: +io.get('arcade.oskolok.oldBest') || 0, notice: io.get('arcade.oskolok.notice') === '1' };
    var oldT = +io.get('arcade.besttime.oskolok') || 0, had = oldT > 0 || !!io.get('arcade.save.oskolok') || !!io.get('arcade.endings.oskolok');
    io.set('arcade.oskolok.v', '2');
    if (had) {
      if (oldT > 0) io.set('arcade.oskolok.oldBest', String(oldT));
      io.del('arcade.besttime.oskolok'); io.del('arcade.save.oskolok'); io.del('arcade.endings.oskolok'); io.set('arcade.oskolok.notice', '1');
    }
    return { migrated: had, oldBest: oldT, notice: had };
  };

  O.logic = { K: K, THROWS: THROWS, mulberry32: mulberry32, parse: parse, tile: tile, solid: solid, shardSolid: shardSolid, bodyFree: bodyFree, newHero: newHero,
    stepHero: stepHero, hazard: hazard, overlapsTile: overlapsTile, aimKind: aimKind, newShard: newShard, stepShard: stepShard, landing: landing };
})(typeof window !== 'undefined' ? window : globalThis);
