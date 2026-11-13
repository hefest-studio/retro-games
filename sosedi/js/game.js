/* СОСЕДИ · логика (без DOM, детерминирована при заданном rng/seed). SOSEDI.Game(opts) → api.
   Посёлок при мастерской «Гефест»: сбежал Заводной Цирк — ожившие игрушки-автоматы гоняются за соседями.
   Двое ребят из мастерской (Ася — И1, Тимоша — И2) спасают соседей бытовым «оружием».
   Соседи — общий ресурс на всю игру (запас S.pool): дошла игрушка до соседа — его утащили в балаган, запас −1;
   запас 0 — конец игры. Выход открывается, когда на уровне не осталось ждущих соседей (и повержен босс).
   Подробности — CONTRACT.md. */
(function (global) {
  'use strict';
  var SO = global.SOSEDI = global.SOSEDI || {};
  var LV = SO.levels, T = LV.T, TS = LV.TS, MW = LV.MW, MH = LV.MH;
  var K = {
    VIEW_W: 456, VIEW_H: 265, HERO_R: 6, SPEED: 92, SHOE_SPEED: 140, HP: 3, LIVES: 3, INV: 1.6, RESPAWN_INV: 2.5,
    POOL: 10, RESCUE_R: 13, CATCH_R: 4, INTRO: 1.6, CLEAR: 2.4, BONUS_T: 25, EXTRA_LIFE: 20000,
    SHOES_T: 12, UMBRELLA_T: 9, PIE_T: 6, PIE_R: 140, FIELD_DT: 0.25, SMELL: 11, GRAB: 1.2
  };
  var WEAP = ['water', 'paint', 'pie', 'bubble', 'fire'];
  var CD = { water: 0.16, paint: 0.45, pie: 0.6, bubble: 0.35, fire: 0.8 };
  var AMMO0 = { water: -1, paint: 8, pie: 3, bubble: 8, fire: 2 }, AMMO_ADD = { paint: 6, pie: 2, bubble: 6, fire: 2 }, AMMO_MAX = { paint: 30, pie: 9, bubble: 30, fire: 9 };
  var TY = {
    clown: { hp: 3, sp: 40, r: 7, pts: 100 },
    goose: { hp: 1, sp: 64, r: 5, pts: 60, small: true },
    mouse: { hp: 1, sp: 80, r: 4, pts: 60, small: true },
    bear: { hp: 8, sp: 26, r: 9, pts: 300, drum: true },
    top: { hp: 4, sp: 72, r: 6, pts: 150, small: true, bounce: true },
    puppet: { hp: 4, sp: 44, r: 7, pts: 200, fly: true }
  };
  var BOSS = {
    bear: { hp: 44, r: 18, sp: 22 }, stilts: { hp: 52, r: 14, sp: 50, fly: true }, organ: { hp: 60, r: 18, sp: 28 },
    strong: { hp: 66, r: 16, sp: 34 }, puppeteer: { hp: 80, r: 16, sp: 30, fly: true }
  };
  var PTS = { saved: 250, bonusNb: 500, spawner: 500, boss: 5000, clearNb: 100, key: 50, pickup: 25 };

  function walkable(c, fly) { return LV.WALK[c] || (fly && (c === T.H || c === T.P)); }
  function shotBlock(c) { return c === T.W || c === T.H || c === T.D || c === T.C; }

  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || LV.mulberry32(opts.seed || 1);
    var emit = opts.onEvent || function () {};
    var S, M, fieldN, fieldP, fieldT = 0, ids = 1;

    function ev(type, d) { emit(type, d || {}); }
    function tile(x, y) { var tx = Math.floor(x / TS), ty = Math.floor(y / TS); if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return T.W; return M.t[ty * MW + tx]; }
    function solidAt(x, y, fly) { return !walkable(tile(x, y), fly); }
    function blocked(x, y, r, fly) { return solidAt(x - r, y - r, fly) || solidAt(x + r, y - r, fly) || solidAt(x - r, y + r, fly) || solidAt(x + r, y + r, fly); }
    // перемещение с отдельными осями (скольжение вдоль стен); → была ли стена
    function moveBody(o, dx, dy, r, fly) {
      var hit = false;
      if (dx) { if (!blocked(o.x + dx, o.y, r, fly)) o.x += dx; else hit = true; }
      if (dy) { if (!blocked(o.x, o.y + dy, r, fly)) o.y += dy; else hit = true; }
      return hit;
    }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function cell(o) { return Math.floor(o.y / TS) * MW + Math.floor(o.x / TS); }
    function cx(tx) { return tx * TS + TS / 2; }

    function newHero(i) {
      var a = {}; for (var k in AMMO0) a[k] = AMMO0[k];
      return { id: i, x: 0, y: 0, fx: 0, fy: 1, alive: true, out: false, lives: K.LIVES, hp: K.HP, inv: 0, w: 0, ammo: a, cd: 0,
        shoesT: 0, shieldT: 0, moving: false, ix: 0, iy: 0, fire: false, deadT: 0, saved: 0, walkT: 0 };
    }

    function reset() {
      var np = opts.players === 2 ? 2 : 1;
      S = { level: Math.max(1, Math.min(LV.COUNT, opts.level || 1)), players: np, score: 0, nextLife: K.EXTRA_LIFE, pool: opts.pool || K.POOL,
        savedTotal: 0, lostTotal: 0, phase: 'intro', phaseT: 0, time: 0, keys: 0, ticket: false, inBonus: false, bonusT: 0,
        heroes: [], neighbors: [], toys: [], spawners: [], shots: [], eshots: [], pies: [], pickups: [], booms: [], rings: [], lines: [],
        boss: null, exitOpen: false, map: null, why: null, levelSaved: 0, levelLost: 0, banner: null };
      for (var i = 0; i < np; i++) S.heroes.push(newHero(i));
    }

    // ---------- загрузка уровня ----------
    function load(n, bonus) {
      M = bonus ? LV.buildBonus(Math.ceil(n / 4)) : LV.build(n);
      S.map = M; S.inBonus = !!bonus; S.keys = 0; S.exitOpen = false; S.boss = null; S.ticket = bonus ? false : S.ticket;
      S.shots = []; S.eshots = []; S.pies = []; S.booms = []; S.rings = []; S.lines = []; S.toys = []; S.spawners = []; S.pickups = [];
      S.levelSaved = 0; S.levelLost = 0; S.bonusT = bonus ? K.BONUS_T : 0;
      S.heroes.forEach(function (h, i) {
        h.x = cx(M.start.x) + (S.players === 2 ? (i ? 12 : -12) : 0); h.y = cx(M.start.y);
        h.fx = 0; h.fy = 1; h.cd = 0; h.shoesT = 0; h.shieldT = 0; h.inv = 1; h.deadT = 0;
        if (!h.out) { h.alive = true; h.hp = K.HP; }
      });
      // соседи: из запаса — сколько есть (бонусные — сверх запаса)
      var regular = M.neighbors.filter(function (q) { return !q.bonus; }), extra = M.neighbors.filter(function (q) { return q.bonus; });
      var k = Math.min(S.pool, regular.length);
      S.neighbors = regular.slice(0, k).concat(extra).map(function (q) {
        return { id: ids++, type: q.type, x: cx(q.x), y: cx(q.y), state: 'wait', t: rng() * 6, bonus: !!q.bonus, secret: !!q.secret, inside: q.inside, panic: 0 };
      });
      M.keys.forEach(function (q) { S.pickups.push({ x: cx(q.x), y: cx(q.y), kind: 'key', t: 0 }); });
      M.pickups.forEach(function (q) { S.pickups.push({ x: cx(q.x), y: cx(q.y), kind: q.kind, t: 0 }); });
      M.spawners.forEach(function (q) { S.spawners.push({ x: cx(q.x), y: cx(q.y), hp: 10, max: 10, t: 2 + rng() * 3, flash: 0, open: 0 }); });
      M.toys.forEach(function (q) { spawnToy(q.type, cx(q.x), cx(q.y), true).stun = 2 + rng() * 4; });   // стартовые ещё «заводятся»
      if (M.boss) {
        var B = BOSS[M.boss], ex = M.exit;
        var hp = Math.round(B.hp * (S.players === 2 ? 1.4 : 1));
        S.boss = { kind: M.boss, x: cx(ex.x < MW / 2 ? MW - 8 : 8), y: cx(ex.y < MH / 2 ? MH - 7 : 6), hp: hp, max: hp, r: B.r, sp: B.sp, fly: !!B.fly,
          t: 0, cd: 3, cd2: 6, st: 'walk', stT: 0, vx: 0, vy: 0, flash: 0, dead: false, ax: 0, ay: 0 };
        S.boss.x = Math.max(40, Math.min(MW * TS - 40, S.boss.x)); S.boss.y = Math.max(40, Math.min(MH * TS - 40, S.boss.y));
        // босс стоит на свободном месте
        for (var a = 0; a < 60 && blocked(S.boss.x, S.boss.y, S.boss.r * 0.6, S.boss.fly); a++) { S.boss.x += (MW * TS / 2 - S.boss.x) * 0.1; S.boss.y += (MH * TS / 2 - S.boss.y) * 0.1; }
      }
      fieldT = 0; computeFields();
      S.phase = 'intro'; S.phaseT = 0;
      ev('level', { n: S.level, kind: M.kind, d: M.d, style: M.style, bonus: !!bonus, boss: M.boss });
      if (M.boss) ev('bossIntro', { kind: M.boss });
    }

    function spawnToy(type, x, y, quiet) {
      var D = TY[type], mul = 1 + 0.012 * (S.level - 1);
      var o = { id: ids++, type: type, x: x, y: y, hp: D.hp, max: D.hp, r: D.r, sp: D.sp * mul * (S.inBonus ? 0.8 : 1), stun: 0, rise: quiet ? 0 : 0.6,
        t: rng() * 5, cd: 2 + rng() * 2, flash: 0, vx: 0, vy: 0, eat: 0, tele: 0, carry: 0, dir: rng() * Math.PI * 2 };
      if (D.bounce) { o.vx = Math.cos(o.dir); o.vy = Math.sin(o.dir); }
      S.toys.push(o); if (!quiet) ev('spawn', { type: type, x: x, y: y });
      return o;
    }

    // ---------- поля расстояний (BFS) для погони ----------
    function field(srcs) {
      var f = new Int16Array(MW * MH).fill(9999), q = [];
      srcs.forEach(function (o) { var k = cell(o); if (k >= 0 && k < f.length && f[k] !== 0) { f[k] = 0; q.push(k); } });
      for (var h = 0; h < q.length; h++) {
        var k = q[h], x = k % MW, y = (k / MW) | 0;
        for (var i = 0; i < 4; i++) {
          var nx = x + (i === 0 ? 1 : i === 1 ? -1 : 0), ny = y + (i === 2 ? 1 : i === 3 ? -1 : 0);
          if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
          var nk = ny * MW + nx; if (f[nk] !== 9999 || !LV.WALK[M.t[nk]]) continue;
          f[nk] = f[k] + 1; q.push(nk);
        }
      }
      return f;
    }
    function computeFields() {
      fieldN = field(S.neighbors.filter(function (q) { return q.state === 'wait'; }));
      fieldP = field(S.heroes.filter(function (h) { return h.alive; }));
    }
    // шаг по полю: направление к соседней клетке с меньшим расстоянием
    function follow(o, f, target) {
      var k = cell(o), x = k % MW, y = (k / MW) | 0, best = f[k], bx = 0, by = 0;
      if (best === 0 || best === 9999) { if (target) { var d = Math.hypot(target.x - o.x, target.y - o.y) || 1; return { x: (target.x - o.x) / d, y: (target.y - o.y) / d }; } return null; }
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; var nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
        if (dx && dy && (!LV.WALK[M.t[y * MW + nx]] || !LV.WALK[M.t[ny * MW + x]])) continue;
        var v = f[ny * MW + nx]; if (v < best) { best = v; bx = dx; by = dy; }
      }
      if (!bx && !by) return null;
      var tx = cx(x + bx), ty = cx(y + by), dd = Math.hypot(tx - o.x, ty - o.y) || 1;
      return { x: (tx - o.x) / dd, y: (ty - o.y) / dd };
    }
    function nearest(list, o, pred) { var b = null, bd = 1e9; for (var i = 0; i < list.length; i++) { var q = list[i]; if (pred && !pred(q)) continue; var d = dist(q, o); if (d < bd) { bd = d; b = q; } } return b ? { o: b, d: bd } : null; }
    function waiting(q) { return q.state === 'wait'; }
    function aliveH(h) { return h.alive; }

    // ---------- герои ----------
    function setInput(pi, inp) { var h = S && S.heroes[pi]; if (!h) return; h.ix = inp.x || 0; h.iy = inp.y || 0; h.fire = !!inp.fire; }
    function swap(pi, dir) {
      var h = S.heroes[pi]; if (!h || !h.alive) return;
      for (var i = 1; i <= WEAP.length; i++) { var w = (h.w + (dir < 0 ? -i : i) + WEAP.length * 2) % WEAP.length; if (WEAP[w] === 'water' || h.ammo[WEAP[w]] > 0) { h.w = w; break; } }
      ev('swap', { pi: pi, w: WEAP[h.w] });
    }
    function select(pi, w) { var h = S.heroes[pi]; if (!h || !h.alive || w === h.w) return; if (WEAP[w] === 'water' || h.ammo[WEAP[w]] > 0) { h.w = w; ev('swap', { pi: pi, w: WEAP[w] }); } }
    function hurtHero(h, src) {
      if (!h.alive || h.inv > 0 || S.phase !== 'play') return false;
      if (h.shieldT > 0) { ev('block', { pi: h.id, x: h.x, y: h.y }); return false; }
      h.hp--; h.inv = K.INV; ev('hurt', { pi: h.id, x: h.x, y: h.y, src: src });
      if (h.hp <= 0) {
        h.lives--; h.alive = false; h.deadT = 1.4; ev('die', { pi: h.id, x: h.x, y: h.y, lives: h.lives });
        if (h.lives <= 0) { h.out = true; ev('out', { pi: h.id }); if (S.heroes.every(function (q) { return q.out; })) gameOver('lives'); }
      }
      return true;
    }
    function addScore(p) { S.score += p; while (S.score >= S.nextLife) { S.nextLife += K.EXTRA_LIFE; S.heroes.forEach(function (h) { if (!h.out) { h.lives++; ev('life', { pi: h.id, x: h.x, y: h.y }); } }); } }

    function updHero(h, dt) {
      if (h.out) return;
      if (!h.alive) { h.deadT -= dt; if (h.deadT <= 0 && S.phase === 'play') { h.alive = true; h.hp = K.HP; h.inv = K.RESPAWN_INV; ev('respawn', { pi: h.id, x: h.x, y: h.y }); } return; }
      if (h.inv > 0) h.inv -= dt; if (h.shoesT > 0) h.shoesT -= dt; if (h.shieldT > 0) h.shieldT -= dt; if (h.cd > 0) h.cd -= dt;
      var mx = h.ix, my = h.iy, l = Math.hypot(mx, my);
      h.moving = l > 0;
      if (l > 0) {
        mx /= l; my /= l; h.fx = Math.round(mx * 10) / 10; h.fy = Math.round(my * 10) / 10; h.walkT += dt;
        var sp = (h.shoesT > 0 ? K.SHOE_SPEED : K.SPEED) * dt, ox = h.x, oy = h.y;
        moveBody(h, mx * sp, my * sp, K.HERO_R, false);
        // двое на одном экране: не разойтись дальше кадра
        var o = S.heroes[1 - h.id];
        if (o && o.alive && !o.out && (Math.abs(h.x - o.x) > K.VIEW_W - 60 || Math.abs(h.y - o.y) > K.VIEW_H - 60)) {
          if (Math.abs(h.x - o.x) > K.VIEW_W - 60 && Math.abs(h.x - o.x) > Math.abs(ox - o.x)) h.x = ox;
          if (Math.abs(h.y - o.y) > K.VIEW_H - 60 && Math.abs(h.y - o.y) > Math.abs(oy - o.y)) h.y = oy;
        }
        // запертая дверь впереди: ключ открывает
        var fx = h.x + mx * (K.HERO_R + 3), fy = h.y + my * (K.HERO_R + 3);
        if (tile(fx, fy) === T.D) openDoor(Math.floor(fx / TS), Math.floor(fy / TS));
      }
      if (h.fire && h.cd <= 0 && S.phase === 'play') fire(h);
    }
    function openDoor(tx, ty) {
      if (S.keys <= 0) { if (!S._nokeyT || S.time - S._nokeyT > 1.5) { S._nokeyT = S.time; ev('nokey', { x: cx(tx), y: cx(ty) }); } return; }
      S.keys--; M.t[ty * MW + tx] = T.O; ev('door', { x: cx(tx), y: cx(ty) }); computeFields();
    }

    function fire(h) {
      var w = WEAP[h.w], fx = h.fx, fy = h.fy, l = Math.hypot(fx, fy) || 1; fx /= l; fy /= l;
      if (w !== 'water' && h.ammo[w] <= 0) { ev('noAmmo', { pi: h.id }); h.w = 0; h.cd = 0.25; return; }
      if (w !== 'water') h.ammo[w]--;
      h.cd = CD[w];
      var sx = h.x + fx * 8, sy = h.y + fy * 8;
      if (w === 'water') S.shots.push({ k: 'water', pi: h.id, x: sx, y: sy, vx: fx * 300, vy: fy * 300, life: 0.45, r: 3 });
      else if (w === 'bubble') S.shots.push({ k: 'bubble', pi: h.id, x: sx, y: sy, vx: fx * 125, vy: fy * 125, life: 1.6, r: 6 });
      else {   // по дуге: краска, пирожок, фейерверк — перелетают препятствия
        var range = w === 'paint' ? 104 : w === 'pie' ? 56 : 72, tx = Math.max(20, Math.min(MW * TS - 20, h.x + fx * range)), ty = Math.max(20, Math.min(MH * TS - 20, h.y + fy * range));
        S.shots.push({ k: w, pi: h.id, x: sx, y: sy, sx: sx, sy: sy, tx: tx, ty: ty, t: 0, T: w === 'paint' ? 0.5 : 0.45, arc: true, r: 4, z: 0 });
      }
      if (w !== 'water' && h.ammo[w] <= 0) h.w = 0;
      ev('shot', { pi: h.id, w: w, x: h.x, y: h.y });
    }

    // ---------- попадания ----------
    function damageToy(o, dmg, how, pi) {
      if (o.dead) return;
      o.hp -= dmg; o.flash = 0.12; ev('hit', { x: o.x, y: o.y, how: how });
      if (o.hp <= 0) killToy(o, how, pi);
    }
    function killToy(o, how, pi) {
      if (o.dead) return; o.dead = true; var p = TY[o.type].pts; addScore(p);
      ev('kill', { type: o.type, x: o.x, y: o.y, how: how, pts: p, pi: pi });
      if (rng() < 0.1) S.pickups.push({ x: o.x, y: o.y, kind: ['paint', 'bubble', 'pie', 'fire', 'soda'][Math.floor(rng() * 5)], t: 0, drop: 8 });
    }
    function damageBoss(dmg, how) {
      var B = S.boss; if (!B || B.dead || S.phase !== 'play') return;
      if (B.st === 'stun') dmg *= 2;
      B.hp -= dmg; B.flash = 0.1; ev('bossHit', { x: B.x, y: B.y, how: how });
      if (B.hp <= 0) { B.hp = 0; B.dead = true; addScore(PTS.boss); ev('bossDie', { kind: B.kind, x: B.x, y: B.y }); S.lines = []; S.rings = []; S.eshots = [];
        S.toys.forEach(function (o) { if (!o.dead) killToy(o, 'boss', -1); }); }
    }
    function splash(x, y, r, dmg, how, pi) {
      S.toys.forEach(function (o) {
        var d = Math.hypot(o.x - x, o.y - y); if (o.dead || d > r + o.r) return;
        if (how === 'fire') { var k = (r + o.r - d) / (r + o.r) * 40, a = Math.atan2(o.y - y, o.x - x); moveBody(o, Math.cos(a) * k, Math.sin(a) * k, o.r * 0.7, TY[o.type].fly); o.stun = Math.max(o.stun, 1); }
        else o.stun = Math.max(o.stun, 0.6);
        damageToy(o, dmg, how, pi);
      });
      S.spawners.forEach(function (s) { if (!s.dead && Math.hypot(s.x - x, s.y - y) < r + 10) hitSpawner(s, how === 'fire' ? 4 : dmg); });
      if (S.boss && !S.boss.dead && Math.hypot(S.boss.x - x, S.boss.y - y) < r + S.boss.r) damageBoss(how === 'fire' ? 4 : dmg, how);
    }
    function hitSpawner(s, dmg) {
      s.hp -= dmg; s.flash = 0.12; ev('hit', { x: s.x, y: s.y, how: 'box' });
      if (s.hp <= 0 && !s.dead) { s.dead = true; addScore(PTS.spawner); ev('spawnerDie', { x: s.x, y: s.y }); }
    }
    function landArc(o) {
      if (o.k === 'paint') { splash(o.tx, o.ty, 26, 3, 'paint', o.pi); ev('splash', { x: o.tx, y: o.ty }); S.booms.push({ x: o.tx, y: o.ty, t: 0, max: 0.6, k: 'paint', r: 26 }); }
      else if (o.k === 'pie') { S.pies.push({ x: o.tx, y: o.ty, t: K.PIE_T }); ev('bait', { x: o.tx, y: o.ty }); }
      else if (o.k === 'fire') {
        splash(o.tx, o.ty, 56, 3, 'fire', o.pi); ev('boom', { x: o.tx, y: o.ty });
        S.booms.push({ x: o.tx, y: o.ty, t: 0, max: 0.7, k: 'fire', r: 56 });
        // фейерверк ломает трещины → тайная комната
        var r0 = Math.floor(o.tx / TS), c0 = Math.floor(o.ty / TS);
        for (var y = c0 - 4; y <= c0 + 4; y++) for (var x = r0 - 4; x <= r0 + 4; x++) {
          if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
          if (M.t[y * MW + x] === T.C && Math.hypot(cx(x) - o.tx, cx(y) - o.ty) < 64) { M.t[y * MW + x] = T.O; ev('crack', { x: cx(x), y: cx(y) }); computeFields(); }
        }
      }
    }
    function updShots(dt) {
      for (var i = 0; i < S.shots.length; i++) {
        var o = S.shots[i]; if (o.dead) continue;
        if (o.arc) {
          o.t += dt; var u = Math.min(1, o.t / o.T); o.x = o.sx + (o.tx - o.sx) * u; o.y = o.sy + (o.ty - o.sy) * u; o.z = Math.sin(u * Math.PI) * 22;
          if (u >= 1) { o.dead = true; landArc(o); }
          continue;
        }
        o.life -= dt; o.x += o.vx * dt; o.y += o.vy * dt;
        if (o.life <= 0) { o.dead = true; if (o.k === 'bubble') ev('pop', { x: o.x, y: o.y }); continue; }
        if (shotBlock(tile(o.x, o.y))) { o.dead = true; ev('wall', { x: o.x, y: o.y, k: o.k }); continue; }
        for (var j = 0; j < S.toys.length; j++) {
          var e = S.toys[j]; if (e.dead || e.rise > 0) continue;
          if (Math.hypot(e.x - o.x, e.y - o.y) < e.r + o.r) {
            o.dead = true;
            if (o.k === 'bubble') { if (TY[e.type].small) { e.caught = true; killToy(e, 'bubble', o.pi); } else { e.stun = 2.5; ev('stun', { x: e.x, y: e.y }); damageToy(e, 1, 'bubble', o.pi); } }
            else { damageToy(e, 1, 'water', o.pi); var l = Math.hypot(o.vx, o.vy) || 1; moveBody(e, o.vx / l * 3, o.vy / l * 3, e.r * 0.7, TY[e.type].fly); }
            break;
          }
        }
        if (o.dead) continue;
        for (j = 0; j < S.spawners.length; j++) { var s = S.spawners[j]; if (!s.dead && Math.abs(s.x - o.x) < 10 && Math.abs(s.y - o.y) < 10) { o.dead = true; hitSpawner(s, 1); break; } }
        if (o.dead) continue;
        var B = S.boss; if (B && !B.dead && Math.hypot(B.x - o.x, B.y - o.y) < B.r + o.r) { o.dead = true; damageBoss(1, o.k); }
      }
      S.shots = S.shots.filter(function (o) { return !o.dead; });
    }

    // ---------- игрушки ----------
    function updToys(dt) {
      var heroes = S.heroes.filter(aliveH), anyWait = S.neighbors.some(waiting);
      for (var i = 0; i < S.toys.length; i++) {
        var o = S.toys[i], D = TY[o.type]; if (o.dead) continue;
        o.t += dt; if (o.flash > 0) o.flash -= dt;
        if (o.rise > 0) { o.rise -= dt; continue; }
        if (o.carry > 0) { o.carry -= dt; continue; }
        if (o.stun > 0) { o.stun -= dt; continue; }
        // держит соседа — тащит его (K.GRAB с): успеешь подстрелить — сосед спасён от балагана
        var holding = false;
        for (var j = 0; j < S.neighbors.length; j++) {
          var nb = S.neighbors[j]; if (nb.state !== 'wait') continue;
          if (Math.hypot(nb.x - o.x, nb.y - o.y) < o.r + K.CATCH_R) {
            if (!nb.grab) ev('grab', { x: nb.x, y: nb.y, type: nb.type });
            nb.grab = (nb.grab || 0) + dt; nb.held = 0.1; holding = true;
            if (nb.grab >= K.GRAB) { loseNeighbor(nb); o.carry = 0.8; }
            break;
          }
        }
        if (holding) continue;
        var mv = null, sp = o.sp;
        // медведь-барабанщик: рядом с героем — замах и удар в барабан (волна)
        if (D.drum) {
          o.cd -= dt;
          if (o.tele > 0) { o.tele -= dt; if (o.tele <= 0) { ev('drum', { x: o.x, y: o.y }); S.rings.push({ x: o.x, y: o.y, r: 8, max: 54, sp: 140, hit: {}, toy: true }); o.cd = 3.5; } continue; }
          var nh = nearest(heroes, o); if (nh && nh.d < 64 && o.cd <= 0) { o.tele = 0.6; ev('drumWarn', { x: o.x, y: o.y }); continue; }
        }
        // приманка-пирожок рядом — бежит есть
        var pie = nearest(S.pies, o);
        if (pie && pie.d < K.PIE_R) {
          if (pie.d < 10) { o.eat += dt; continue; }
          mv = { x: (pie.o.x - o.x) / pie.d, y: (pie.o.y - o.y) / pie.d };
        }
        if (!mv && D.bounce) {   // юла: прямо, отскок от стен, изредка доворачивает к соседу
          o.cd -= dt;
          if (o.cd <= 0) { o.cd = 2.5 + rng() * 2; var tn = nearest(S.neighbors, o, waiting) || nearest(heroes, o); if (tn) { var a = Math.atan2(tn.o.y - o.y, tn.o.x - o.x) + (rng() - 0.5) * 0.8; o.vx = Math.cos(a); o.vy = Math.sin(a); } }
          var hx = moveBody(o, o.vx * sp * dt, 0, o.r * 0.8, false), hy = moveBody(o, 0, o.vy * sp * dt, o.r * 0.8, false);
          if (hx) o.vx = -o.vx; if (hy) o.vy = -o.vy;
        } else if (!mv && D.fly) {  // марионетка: по прямой над кустами и прудами
          var tg = nearest(S.neighbors, o, function (q) { return q.state === 'wait' && fieldN[cell(q)] === 0 && !q.secret && !(q.inside && fieldP[cell(q)] === 9999); }); var th = nearest(heroes, o);
          if (th && (!tg || th.d < 70)) tg = th;
          if (tg) mv = { x: (tg.o.x - o.x) / (tg.d || 1), y: (tg.o.y - o.y) / (tg.d || 1) };
        } else if (!mv) {
          var hh = nearest(heroes, o), chaseHero = hh && hh.d < (o.type === 'clown' ? 72 : o.type === 'bear' ? 120 : 40), fn = fieldN[cell(o)];
          if (chaseHero) mv = follow(o, fieldP, hh.o);
          else if (fn <= K.SMELL) { var nn = nearest(S.neighbors, o, waiting); mv = follow(o, fieldN, nn && nn.d < 24 ? nn.o : null); }
          if (!mv) {   // никого не чует — бродит не спеша
            o.cd -= dt; if (o.cd <= 0) { o.cd = 1 + rng() * 1.5; o.dir = rng() * Math.PI * 2; if (hh && rng() < 0.35) o.dir = Math.atan2(hh.o.y - o.y, hh.o.x - o.x); }
            mv = { x: Math.cos(o.dir), y: Math.sin(o.dir) }; sp *= 0.55;
          }
        }
        if (mv) {
          // гусь — прыжками
          if (o.type === 'goose') sp *= 0.5 + Math.abs(Math.sin(o.t * 6));
          if (moveBody(o, mv.x * sp * dt, mv.y * sp * dt, o.r * 0.7, D.fly)) o.dir += 1.6 + rng();
          o.vx = mv.x; o.vy = mv.y;
        }
        // расталкивание
        for (j = i + 1; j < S.toys.length; j++) {
          var q = S.toys[j]; if (q.dead) continue; var dx = q.x - o.x, dy = q.y - o.y, d = Math.hypot(dx, dy), m = (o.r + q.r) * 0.8;
          if (d > 0 && d < m) { var push = (m - d) / 2 / d; moveBody(o, -dx * push, -dy * push, o.r * 0.7, D.fly); moveBody(q, dx * push, dy * push, q.r * 0.7, TY[q.type].fly); }
        }
        // касание героя
        for (j = 0; j < heroes.length; j++) {
          var h = heroes[j];
          if (Math.hypot(h.x - o.x, h.y - o.y) < o.r + K.HERO_R - 1) {
            if (h.shieldT > 0) { var ang = Math.atan2(o.y - h.y, o.x - h.x); moveBody(o, Math.cos(ang) * 10, Math.sin(ang) * 10, o.r * 0.7, D.fly); o.stun = 0.4; }
            else if (!S.inBonus) hurtHero(h, o.type);
          }
        }
      }
      S.toys = S.toys.filter(function (o) { return !o.dead; });
    }
    function loseNeighbor(nb) {
      nb.state = 'lost'; nb.t = 0; S.levelLost++;
      if (!nb.bonus) { S.pool--; S.lostTotal++; }
      ev('lost', { x: nb.x, y: nb.y, type: nb.type, pool: S.pool, bonus: nb.bonus });
      computeFields();
      if (S.pool <= 0) gameOver('pool');
    }
    function saveNeighbor(nb, h) {
      nb.state = 'saved'; nb.t = 0; S.levelSaved++; S.savedTotal++; h.saved++;
      var p = nb.bonus ? PTS.bonusNb : PTS.saved + 25 * S.level; addScore(p);
      if (nb.bonus) S.pool++;
      ev('saved', { x: nb.x, y: nb.y, type: nb.type, pts: p, pi: h.id, bonus: nb.bonus, pool: S.pool });
      computeFields();
    }

    function updSpawners(dt) {
      if (S.inBonus || S.phase !== 'play') return;
      var cap = Math.min(14, 5 + Math.floor(S.level / 3) + (S.players === 2 ? 2 : 0)), live = S.toys.length, mix = LV.MIXES[M.d - 1];
      var every = Math.max(3.4, 6.5 - S.level * 0.14);
      S.spawners.forEach(function (s) {
        if (s.dead) return; if (s.flash > 0) s.flash -= dt; if (s.open > 0) s.open -= dt;
        s.t -= dt;
        if (s.t <= 0) { s.t = every * (0.8 + rng() * 0.4); if (live < cap) { live++; s.open = 0.5; spawnToy(LV.mixPick(mix, rng()), s.x + (rng() - 0.5) * 6, s.y + 10); } }
      });
    }

    // ---------- босс ----------
    function updBoss(dt) {
      var B = S.boss; if (!B || B.dead) return;
      var heroes = S.heroes.filter(aliveH), nh = nearest(heroes, B), tgt = nh ? nh.o : null;
      B.t += dt; if (B.flash > 0) B.flash -= dt;
      if (B.st === 'stun') { B.stT -= dt; if (B.stT <= 0) B.st = 'walk'; return; }
      B.cd -= dt; B.cd2 -= dt;
      var k = B.kind;
      if (B.st === 'tele') {
        B.stT -= dt;
        if (B.stT <= 0) {
          if (k === 'bear') { S.rings.push({ x: B.x, y: B.y, r: B.r, max: 150, sp: 170, hit: {} }); ev('drum', { x: B.x, y: B.y, big: true }); B.st = 'walk'; B.cd = 3.4; }
          else if (k === 'strong') { B.st = 'charge'; B.stT = 2.2; ev('charge', { x: B.x, y: B.y }); }
          else if (k === 'puppeteer') {
            if (B.tp) { B.x = B.tp.x; B.y = B.tp.y; B.tp = null; ev('teleport', { x: B.x, y: B.y }); }
            S.lines.forEach(function (l) { l.on = 0.45; }); ev('strings', { x: B.x, y: B.y }); B.st = 'walk'; B.cd = 3.6;
          }
        }
        return;
      }
      if (B.st === 'charge') {
        B.stT -= dt; var hit = moveBody(B, B.ax * 230 * dt, B.ay * 230 * dt, B.r * 0.7, false);
        if (hit || B.stT <= 0) { B.st = hit ? 'stun' : 'walk'; B.stT = hit ? 2.2 : 0; B.cd = 3.2; if (hit) ev('thud', { x: B.x, y: B.y }); }
        bossTouch(B); return;
      }
      // ходьба к ближайшему герою
      if (tgt) {
        var d = dist(B, tgt) || 1, mv = B.fly ? { x: (tgt.x - B.x) / d, y: (tgt.y - B.y) / d } : (follow(B, fieldP, tgt) || { x: (tgt.x - B.x) / d, y: (tgt.y - B.y) / d });
        if (d > B.r + 4) moveBody(B, mv.x * B.sp * dt, mv.y * B.sp * dt, B.r * (B.fly ? 0.3 : 0.6), B.fly);
        B.vx = mv.x; B.vy = mv.y;
      }
      if (B.cd <= 0 && tgt) {
        var a = Math.atan2(tgt.y - B.y, tgt.x - B.x);
        if (k === 'bear') { B.st = 'tele'; B.stT = 0.8; ev('drumWarn', { x: B.x, y: B.y, big: true }); }
        else if (k === 'stilts') { for (var i = -1; i <= 1; i++) S.eshots.push({ k: 'pin', x: B.x, y: B.y - 10, vx: Math.cos(a + i * 0.28) * 150, vy: Math.sin(a + i * 0.28) * 150, life: 2.2, r: 4 }); ev('throw', { x: B.x, y: B.y }); B.cd = 2.3; }
        else if (k === 'organ') { for (i = 0; i < 6; i++) { var b = a + i * Math.PI / 3; S.eshots.push({ k: 'note', x: B.x, y: B.y, vx: Math.cos(b) * 95, vy: Math.sin(b) * 95, life: 3, r: 5 }); } ev('organ', { x: B.x, y: B.y }); B.cd = 2.8; }
        else if (k === 'strong') { B.st = 'tele'; B.stT = 0.75; B.ax = Math.cos(a); B.ay = Math.sin(a); ev('chargeWarn', { x: B.x, y: B.y }); }
        else if (k === 'puppeteer') {
          B.st = 'tele'; B.stT = 0.9; S.lines = [];
          for (i = 0; i < 2; i++) { var c = a + i * Math.PI / 2; S.lines.push({ x: B.x, y: B.y, a: c, len: 300, on: 0, warn: 0.9 }); }
          if (rng() < 0.45) { var f = farCell(tgt); if (f) B.tp = f; }
          ev('stringsWarn', { x: B.x, y: B.y });
        }
      }
      if (B.cd2 <= 0) {
        B.cd2 = k === 'puppeteer' ? 8 : 7.5;
        var minion = k === 'bear' ? 'goose' : k === 'organ' ? 'mouse' : k === 'puppeteer' ? 'puppet' : k === 'stilts' ? 'clown' : 'clown';
        if (S.toys.length < 8) { spawnToy(minion, B.x + 20, B.y); spawnToy(minion, B.x - 20, B.y); }
      }
      bossTouch(B);
    }
    function farCell(from) {
      for (var a = 0; a < 40; a++) { var x = 3 + Math.floor(rng() * (MW - 6)), y = 3 + Math.floor(rng() * (MH - 6)); if (LV.WALK[M.t[y * MW + x]] && M.t[y * MW + x] !== T.F && Math.hypot(cx(x) - from.x, cx(y) - from.y) > 120) return { x: cx(x), y: cx(y) }; }
      return null;
    }
    function bossTouch(B) {
      S.heroes.forEach(function (h) { if (h.alive && dist(h, B) < B.r + K.HERO_R - 2) hurtHero(h, 'boss'); });
      S.neighbors.forEach(function (nb) { if (nb.state === 'wait' && dist(nb, B) < B.r + K.CATCH_R) loseNeighbor(nb); });
    }
    function updHazards(dt) {
      S.eshots.forEach(function (o) {
        o.life -= dt; o.x += o.vx * dt; o.y += o.vy * dt;
        if (o.life <= 0 || tile(o.x, o.y) === T.W) { o.dead = true; return; }
        S.heroes.forEach(function (h) { if (!o.dead && h.alive && Math.hypot(h.x - o.x, h.y - o.y) < o.r + K.HERO_R - 1) { if (hurtHero(h, o.k) || h.shieldT > 0) o.dead = true; } });
      });
      S.eshots = S.eshots.filter(function (o) { return !o.dead; });
      S.rings.forEach(function (g) {
        g.r += g.sp * dt; if (g.r >= g.max) g.dead = true;
        S.heroes.forEach(function (h) { if (!g.hit[h.id] && h.alive && Math.abs(dist(h, g) - g.r) < 7) { g.hit[h.id] = 1; hurtHero(h, 'drum'); } });
      });
      S.rings = S.rings.filter(function (g) { return !g.dead; });
      S.lines.forEach(function (l) {
        if (l.warn > 0) { l.warn -= dt; return; }
        if (l.on > 0) {
          l.on -= dt; if (l.on <= 0) { l.dead = true; return; }
          S.heroes.forEach(function (h) {
            if (!h.alive) return;
            for (var s = -1; s <= 1; s += 2) { var ux = Math.cos(l.a) * s, uy = Math.sin(l.a) * s, px = h.x - l.x, py = h.y - l.y, u = px * ux + py * uy;
              if (u > 0 && u < l.len && Math.abs(px * uy - py * ux) < 8) hurtHero(h, 'string'); }
          });
        }
      });
      S.lines = S.lines.filter(function (l) { return !l.dead; });
      S.pies.forEach(function (p) { p.t -= dt; }); S.pies = S.pies.filter(function (p) { return p.t > 0; });
      S.booms.forEach(function (b) { b.t += dt; }); S.booms = S.booms.filter(function (b) { return b.t < b.max; });
    }

    // ---------- подбор, спасение, выход ----------
    function updPickups(dt) {
      S.heroes.forEach(function (h) {
        if (!h.alive) return;
        S.pickups.forEach(function (p) {
          if (p.taken) return; p.t += dt;
          if (Math.hypot(p.x - h.x, p.y - h.y) > 12) return;
          var k = p.kind;
          if (AMMO_ADD[k]) { if (h.ammo[k] >= AMMO_MAX[k]) return; h.ammo[k] = Math.min(AMMO_MAX[k], h.ammo[k] + AMMO_ADD[k]); }
          else if (k === 'key') { S.keys++; addScore(PTS.key); }
          else if (k === 'soda') { if (h.hp >= K.HP) return; h.hp = K.HP; }
          else if (k === 'shoes') h.shoesT = K.SHOES_T;
          else if (k === 'umbrella') h.shieldT = K.UMBRELLA_T;
          else if (k === 'ticket') S.ticket = true;
          else if (k === 'bag') { var at = portal(h); if (!at) return; }
          p.taken = true; addScore(PTS.pickup); ev('pickup', { kind: k, x: p.x, y: p.y, pi: h.id });
        });
        S.neighbors.forEach(function (nb) { if (nb.state === 'wait' && Math.hypot(nb.x - h.x, nb.y - h.y) < K.RESCUE_R) saveNeighbor(nb, h); });
      });
      S.pickups = S.pickups.filter(function (p) { return !p.taken; });
    }
    // мешок-портал: герой ныряет в мешок и выныривает у соседа, к которому ближе всех игрушка
    function portal(h) {
      var best = null, bd = 1e9;
      S.neighbors.forEach(function (nb) { if (nb.state !== 'wait') return; if (nb.inside && fieldP[cell(nb)] === 9999) return; var t = nearest(S.toys, nb); var d = t ? t.d : 900; if (d < bd) { bd = d; best = nb; } });
      if (!best) return false;
      var from = { x: h.x, y: h.y };
      var spots = [[14, 0], [-14, 0], [0, 14], [0, -14]];
      for (var i = 0; i < spots.length; i++) { var x = best.x + spots[i][0], y = best.y + spots[i][1]; if (!blocked(x, y, K.HERO_R, false)) { h.x = x; h.y = y; break; } }
      var o = S.heroes[1 - h.id]; if (o && o.alive && !o.out) { o.x = h.x + (o.x > h.x ? 8 : -8); o.y = h.y; if (blocked(o.x, o.y, K.HERO_R, false)) { o.x = h.x; o.y = h.y; } }
      h.inv = Math.max(h.inv, 1); ev('portal', { pi: h.id, x: h.x, y: h.y, fx: from.x, fy: from.y });
      return true;
    }
    function checkExit() {
      var anyWait = S.neighbors.some(function (q) { return q.state === 'wait' && !q.secret; }), bossOk = !S.boss || S.boss.dead;
      if (!S.exitOpen && !anyWait && bossOk && !S.inBonus && M.exit) { S.exitOpen = true; ev('exitOpen', { x: cx(M.exit.x), y: cx(M.exit.y) }); }
      if (S.exitOpen) {
        var ex = { x: cx(M.exit.x), y: cx(M.exit.y) };
        if (S.heroes.some(function (h) { return h.alive && dist(h, ex) < 14; })) clearLevel();
      }
      if (S.inBonus && (S.bonusT <= 0 || !anyWait)) clearLevel();
    }
    function clearLevel() {
      var b = S.inBonus ? 0 : S.levelSaved * PTS.clearNb + (S.levelLost === 0 ? 1000 : 0);
      addScore(b);
      // ни одного не утащили — в посёлок въезжает новый сосед (+1 к запасу)
      var moved = !S.inBonus && S.levelLost === 0 && S.levelSaved > 0;
      if (moved) S.pool++;
      S.phase = 'clear'; S.phaseT = 0;
      ev(S.inBonus ? 'bonusEnd' : 'clear', { n: S.level, saved: S.levelSaved, lost: S.levelLost, bonus: b, perfect: S.levelLost === 0, ticket: S.ticket, moved: moved, pool: S.pool });
    }
    function nextAfterClear() {
      if (!S.inBonus && S.ticket) { S.ticket = false; load(S.level, true); ev('bonusStart', { d: M.d }); return; }
      if (S.level >= LV.COUNT) { S.phase = 'won'; ev('win', { score: S.score }); return; }
      S.level++; load(S.level, false);
    }
    function gameOver(why) { if (S.phase === 'over') return; S.phase = 'over'; S.why = why; S.phaseT = 0; ev('gameover', { why: why }); }

    function update(dt) {
      if (!S || S.phase === 'over' || S.phase === 'won') return;
      while (dt > 0) { var h = Math.min(dt, 1 / 60); step(h); dt -= h; if (S.phase === 'over' || S.phase === 'won') break; }
    }
    function step(dt) {
      S.time += dt; S.phaseT += dt;
      S.neighbors.forEach(function (nb) { nb.t += dt; });
      if (S.phase === 'intro') { if (S.phaseT >= K.INTRO) { S.phase = 'play'; S.phaseT = 0; } S.heroes.forEach(function (h) { if (h.inv > 0) h.inv -= dt; }); return; }
      if (S.phase === 'clear') { if (S.phaseT >= K.CLEAR) nextAfterClear(); return; }
      fieldT -= dt; if (fieldT <= 0) { fieldT = K.FIELD_DT; computeFields(); }
      if (S.inBonus) S.bonusT -= dt;
      S.heroes.forEach(function (h) { updHero(h, dt); });
      updShots(dt);
      updToys(dt); if (S.phase !== 'play') return;
      updBoss(dt); if (S.phase !== 'play') return;
      updHazards(dt); if (S.phase !== 'play') return;
      updSpawners(dt);
      updPickups(dt);
      // паника соседей: игрушка близко — машет руками (рисуется), не двигается
      S.neighbors.forEach(function (nb) {
        if (nb.state !== 'wait') return; var t = nearest(S.toys, nb); nb.panic = t && t.d < 70 ? 1 : 0;
        if (nb.held > 0) nb.held -= dt; else if (nb.grab > 0) { nb.grab = Math.max(0, nb.grab - dt * 2); }
      });
      checkExit();
    }

    reset();
    var api = {
      start: function () { reset(); load(S.level, false); return api; },
      update: update, setInput: setInput, swap: swap, select: select,
      state: function () { return S; }, level: function () { return M; },
      fields: function () { return { n: fieldN, p: fieldP }; },
      // для тестов/отладки
      _load: function (n, bonus) { if (n) S.level = n; load(S.level, !!bonus); S.phase = 'play'; S.phaseT = 0; return api; },
      _spawnToy: function (type, x, y) { var o = spawnToy(type, x, y, true); return o; },
      _killToy: killToy, _damageBoss: damageBoss, _hurtHero: hurtHero, _computeFields: computeFields, _clear: clearLevel, _next: nextAfterClear,
      _portal: portal, _landArc: landArc
    };
    return api;
  }

  SO.logic = { K: K, WEAP: WEAP, CD: CD, AMMO0: AMMO0, AMMO_ADD: AMMO_ADD, TY: TY, BOSS: BOSS, PTS: PTS, walkable: walkable, shotBlock: shotBlock, mulberry32: LV.mulberry32 };
  SO.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
