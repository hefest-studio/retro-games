/* ЛИВЕНЬ · логика игры (без DOM, детерминирована при заданном rng).
   Вертикальный «пулевой ад»: искра-челнок мастерской «Гефест» летит сквозь ливень раскалённых заклёпок,
   которые сыплют механические Звонари-колокола. Фазы боссов — «перезвоны» (в коде — card).
   Поле 400×600 (x вправо, y вниз), фикс-шаг 1/60 с. Пули, выстрелы и предметы — в пулах на типизированных массивах
   (плотное хранение, удаление перестановкой последнего): в тике нет аллокаций, 1000+ пуль укладываются в кадр.
   LIVEN.Game(opts) → api; LIVEN.logic — константы и помощники для тестов/бота. Узоры — js/patterns.js, этапы — js/stages.js. */
(function (global) {
  'use strict';
  var LV = global.LIVEN = global.LIVEN || {};
  var TAU = Math.PI * 2;
  var K = {
    FW: 400, FH: 600, STEP: 1 / 60,
    HB: 2.5,            // радиус хитбокса челнока (видимая точка в фокусе)
    GRAZE: 18,          // зона грейза: пуля пролетела ближе r+GRAZE и не задела
    SPD: 255, SPD_F: 112, PX0: 200, PY0: 530,
    MAXB: 3200, MAXS: 360, MAXI: 1400, MAXE: 80,
    LIVES: 3, BOMBS: 3, CONTS: 3,
    INV: 3.0, BOMB_T: 3.0, BOMB_CLEAR: 0.8, DEATHBOMB: 0.13, DEAD_T: 1.0, CONT_T: 10,
    MULT_STEP: 0.01, MULT_MAX: 5, MAGNET_R: 46, MAGNET_RF: 70, FIRE_IV: 1 / 15
  };
  // хит-радиусы пуль по виду: 0 окалина-точка, 1 капля, 2 заклёпка (крупная шляпка), 3 гвоздь, 4 шестерёнка
  var BR = [3, 3.2, 7.5, 2.2, 3.6];
  var DIFF = {
    easy: { dens: 0.55, spd: 0.8, rate: 0.62, bonus: 0.5, ext: [300000, 900000] },
    normal: { dens: 1.15, spd: 1.02, rate: 1.0, bonus: 1, ext: [400000, 1200000, 2400000] },
    hard: { dens: 1.55, spd: 1.14, rate: 1.25, bonus: 1.6, ext: [500000, 1500000, 3000000] }
  };
  var DIFFS = ['easy', 'normal', 'hard'];
  var FORMS = ['fan', 'blade'];
  // формы челнока: веер (широкий огонь) и клинок (узкий, мощный)
  var SHOT = {
    fan: { wide: [-0.3, -0.15, 0, 0.15, 0.3], narrow: [-0.07, -0.035, 0, 0.035, 0.07], dmg: 1.0, dx: [0, 0, 0, 0, 0] },
    blade: { wide: [-0.06, 0, 0.06], narrow: [0, 0, 0], dmg: 1.75, dx: [-7, 0, 7] }
  };
  // враги этапов: прочность, радиус, очки, искры при уничтожении
  // mote — клёпка-дрон, chime — фонарь-подзвонок, bell — бубенец, rotor — молоток-вертушка, gong — гонг-носильщик
  var ET = {
    mote: { hp: 3, r: 10, sc: 100, sp: 3 },
    chime: { hp: 8, r: 12, sc: 250, sp: 4 },
    bell: { hp: 16, r: 14, sc: 400, sp: 7 },
    rotor: { hp: 34, r: 18, sc: 900, sp: 10 },
    gong: { hp: 70, r: 22, sc: 1800, sp: 16 }
  };
  var PATHS = { fall: 0, swoop: 1, hover: 2, side: 3 };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---------- пул пуль ----------
  function Bullets(max) {
    var F = Float32Array, U = Uint8Array;
    this.max = max; this.n = 0;
    this.x = new F(max); this.y = new F(max); this.vx = new F(max); this.vy = new F(max);
    this.a = new F(max); this.s = new F(max); this.w = new F(max); this.ac = new F(max); this.st = new F(max);
    this.t = new F(max); this.rt = new F(max); this.ra = new F(max); this.rs = new F(max); this.r = new F(max);
    this.k = new U(max); this.c = new U(max); this.g = new U(max); this.f = new U(max); this.bn = new U(max);
  }
  Bullets.prototype.kill = function (i) {
    var j = --this.n; if (i === j) return;
    this.x[i] = this.x[j]; this.y[i] = this.y[j]; this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j];
    this.a[i] = this.a[j]; this.s[i] = this.s[j]; this.w[i] = this.w[j]; this.ac[i] = this.ac[j]; this.st[i] = this.st[j];
    this.t[i] = this.t[j]; this.rt[i] = this.rt[j]; this.ra[i] = this.ra[j]; this.rs[i] = this.rs[j]; this.r[i] = this.r[j];
    this.k[i] = this.k[j]; this.c[i] = this.c[j]; this.g[i] = this.g[j]; this.f[i] = this.f[j]; this.bn[i] = this.bn[j];
  };
  // ---------- пул простых тел (выстрелы челнока, предметы) ----------
  function Bodies(max) {
    var F = Float32Array;
    this.max = max; this.n = 0;
    this.x = new F(max); this.y = new F(max); this.vx = new F(max); this.vy = new F(max); this.v = new F(max); this.t = new F(max);
    this.k = new Uint8Array(max); this.m = new Uint8Array(max);
  }
  Bodies.prototype.add = function (x, y, vx, vy, v, k) {
    if (this.n >= this.max) return -1;
    var i = this.n++; this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy; this.v[i] = v; this.t[i] = 0; this.k[i] = k; this.m[i] = 0; return i;
  };
  Bodies.prototype.kill = function (i) {
    var j = --this.n; if (i === j) return;
    this.x[i] = this.x[j]; this.y[i] = this.y[j]; this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j]; this.v[i] = this.v[j]; this.t[i] = this.t[j]; this.k[i] = this.k[j]; this.m[i] = this.m[j];
  };

  function newEnemy() { return { on: false, type: 'mote', x: 0, y: 0, x0: 0, vx: 0, vy: 0, ty: 0, hold: 0, amp: 0, fq: 0, dir: 1, t: 0, hp: 0, mhp: 0, r: 10, sc: 0, sp: 0, path: 0, pat: null, fk: 0.6, fa: 0, fn: 0, flash: 0, look: 0 }; }
  function newBoss() { return { on: false, mid: false, def: null, ci: -1, x: 200, y: -60, tx: 200, ty: 130, hp: 0, mhp: 0, t: 0, enter: 0, gap: 0, inv: 0, capture: true, k0: 0, k1: 0, k2: 0, k3: 0, a0: 0, a1: 0, a2: 0, a3: 0, n0: 0, mvT: 0, flash: 0, dead: false, leave: 0, timeout: false }; }

  LV.Game = function (opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var diffName = DIFF[opts.diff] ? opts.diff : 'normal', D = DIFF[diffName];
    var emit = opts.onEvent || function () {};
    var B = new Bullets(K.MAXB), PS = new Bodies(K.MAXS), IT = new Bodies(K.MAXI);
    var E = []; for (var q = 0; q < K.MAXE; q++) E.push(newEnemy());
    var boss = newBoss();
    var P = { x: K.PX0, y: K.PY0, focus: false, form: FORMS.indexOf(opts.form) >= 0 ? opts.form : 'fan', inv: 2, dead: 0, hitT: -1, bombT: 0, fireT: 0, dx: 0, dy: 0, px: 0, py: 0, moving: 0 };
    var S = {
      phase: 'idle', diff: diffName, D: D, stage: opts.stage || 1, stages: (LV.STAGES || []).length, time: 0, stageT: 0, score: 0,
      lives: opts.lives || K.LIVES, bombs: K.BOMBS, conts: 0, contT: 0, graze: 0, sparks: 0, mult: 1, maxMult: 1,
      P: P, B: B, PS: PS, IT: IT, E: E, boss: boss, ext: 0, clearT: 0, clearBonus: 0, magnetT: 0, over: false, won: false,
      noHit: !!opts.noHit, frozen: !!opts.frozen, bombHeld: false,
      stats: { deaths: 0, bombs: 0, captures: 0, cards: 0, kills: 0, grazes: 0, timeouts: 0, deathbombs: 0, stageDeaths: [0, 0, 0, 0, 0, 0] }
    };
    var script = [], si = 0;

    // ---------- API для узоров (js/patterns.js) ----------
    var SP = { k: 0, c: 0, w: 0, ac: 0, st: 0, rt: 0, ra: 0, rs: 0, f: 0, bn: 0 };
    function sp0() { SP.k = 0; SP.c = 0; SP.w = 0; SP.ac = 0; SP.st = 0; SP.rt = 0; SP.ra = 0; SP.rs = 0; SP.f = 0; SP.bn = 0; return SP; }
    function fire(x, y, a, s) {
      if (B.n >= B.max) return -1;
      var i = B.n++, m = D.spd; s *= m;
      B.x[i] = x; B.y[i] = y; B.a[i] = a; B.s[i] = s; B.vx[i] = Math.cos(a) * s; B.vy[i] = Math.sin(a) * s;
      B.w[i] = SP.w; B.ac[i] = SP.ac * m; B.st[i] = SP.st * m; B.t[i] = 0; B.rt[i] = SP.rt; B.ra[i] = SP.ra; B.rs[i] = SP.rs * m;
      B.r[i] = BR[SP.k]; B.k[i] = SP.k; B.c[i] = SP.c; B.g[i] = 0; B.f[i] = SP.f; B.bn[i] = SP.bn;
      return i;
    }
    function ring(x, y, n, a0, s) { var d = TAU / n; for (var i = 0; i < n; i++) fire(x, y, a0 + i * d, s); }
    function fan(x, y, n, a, spread, s) { if (n === 1) { fire(x, y, a, s); return; } var d = spread / (n - 1); for (var i = 0; i < n; i++) fire(x, y, a - spread / 2 + i * d, s); }
    function aim(x, y) { if (P.dead > 0) return Math.atan2(K.PY0 - y, K.PX0 - x); return Math.atan2(P.y - y, P.x - x); }
    function N(n) { return Math.max(1, Math.round(n * D.dens)); }
    function R(iv) { return iv / D.rate; }
    function every(o, key, iv, dt) { o[key] -= dt; if (o[key] <= 0) { o[key] += iv; if (o[key] <= 0) o[key] = iv; return true; } return false; }
    var G = { fire: fire, ring: ring, fan: fan, aim: aim, N: N, R: R, every: every, sp0: sp0, SP: SP, rnd: function () { return rng(); }, P: P, S: S, K: K, D: D, TAU: TAU };

    // ---------- очки ----------
    // n — база; множитель искр применяется ко всему, кроме финального бонуса (raw)
    function add(n, raw) {
      S.score += Math.round(raw ? n : n * S.mult);
      var ext = D.ext;
      while (S.ext < ext.length && S.score >= ext[S.ext]) { S.ext++; S.lives++; emit('extend', P.x, P.y, S.lives); }
    }
    function setSparks(n) { S.sparks = n; S.mult = Math.min(K.MULT_MAX, 1 + n * K.MULT_STEP); if (S.mult > S.maxMult) S.maxMult = S.mult; }

    // ---------- этапы ----------
    function startStage(n) {
      S.stage = n; S.stageT = 0; si = 0; S.phase = 'play'; S.clearT = 0;
      var st = LV.STAGES[n - 1]; script = st ? LV.expandScript(st) : [];
      for (var i = 0; i < E.length; i++) E[i].on = false;
      boss.on = false; B.n = 0; PS.n = 0;
      emit('stage', n, 0, 0);
    }
    function spawnEnemy(ev) {
      var e = null; for (var i = 0; i < E.length; i++) if (!E[i].on) { e = E[i]; break; }
      if (!e) return;
      var T = ET[ev.type] || ET.mote;
      e.on = true; e.type = ev.type; e.hp = e.mhp = T.hp * (ev.hpMul || 1); e.r = T.r; e.sc = T.sc; e.sp = T.sp;
      e.path = PATHS[ev.path] || 0; e.pat = ev.pat ? LV.PAT[ev.pat] : null; e.t = 0; e.flash = 0; e.fn = 0; e.fa = rng() * TAU;
      e.fk = ev.delay != null ? ev.delay : 0.5 + rng() * 0.4;
      e.x = e.x0 = ev.x; e.y = ev.y != null ? ev.y : -24; e.vx = ev.vx || 0; e.vy = ev.vy != null ? ev.vy : 120;
      e.ty = ev.ty || 140; e.hold = ev.hold || 3; e.amp = ev.amp || 0; e.fq = ev.fq || 2; e.dir = ev.dir || (ev.x < K.FW / 2 ? 1 : -1);
      e.look = ev.look || 0;
    }
    function spawnBoss(id, mid) {
      var def = LV.BOSSES[id]; if (!def) return;
      boss.on = true; boss.mid = !!mid; boss.def = def; boss.id = id; boss.ci = -1; boss.x = K.FW / 2; boss.y = -70; boss.tx = K.FW / 2; boss.ty = def.home || 130;
      boss.enter = 1.6; boss.gap = 0; boss.inv = 0; boss.dead = false; boss.leave = 0; boss.flash = 0; boss.mvT = 0;
      emit(mid ? 'midboss' : 'boss', boss.x, boss.y, 0);
    }
    function resetCardVars() { boss.k0 = boss.k1 = boss.k2 = boss.k3 = 0; boss.a0 = boss.a1 = boss.a2 = boss.a3 = 0; boss.n0 = 0; }
    function startCard(i) {
      var c = boss.def.cards[i];
      boss.ci = i; boss.hp = boss.mhp = c.hp; boss.t = 0; boss.inv = 1.0; boss.capture = true; boss.timeout = false; resetCardVars();
      boss.tx = K.FW / 2; boss.ty = boss.def.home || 130;
      S.stats.cards++;
      emit('card', i, boss.def.cards.length, boss.mid ? 1 : 0);
    }
    function endCard(timeout) {
      var c = boss.def.cards[boss.ci], bonus = 0;
      if (!timeout && boss.capture) { bonus = Math.round(c.bonus * D.bonus * (0.5 + 0.5 * (1 - boss.t / c.time)) / 10) * 10; bonus = Math.round(bonus * S.mult); add(bonus, true); S.stats.captures++; }
      if (timeout) S.stats.timeouts++;
      emit('cardEnd', bonus, timeout ? 1 : 0, boss.capture ? 1 : 0);
      cancelBullets(true);
      // искры за перезвон
      for (var s2 = 0; s2 < (boss.mid ? 16 : 24); s2++) IT.add(boss.x + (rng() - 0.5) * 60, boss.y + (rng() - 0.5) * 40, (rng() - 0.5) * 160, -100 - rng() * 120, 0, 0);
      S.magnetT = 1.2;
      if (boss.ci + 1 < boss.def.cards.length) { boss.gap = 1.3; boss.ci++; boss.hp = boss.mhp; }
      else defeatBoss();
    }
    function defeatBoss() {
      boss.dead = true;
      emit(boss.mid ? 'midDown' : 'bossDown', boss.x, boss.y, 0);
      add(boss.mid ? 20000 * S.stage : 60000 * S.stage);
      if (boss.mid) { boss.leave = 1.0; }
      else { boss.on = false; S.phase = 'clear'; S.clearT = 4.2; S.clearBonus = Math.round((50000 * S.stage + S.graze * 10) * D.bonus * S.mult / 10) * 10; add(S.clearBonus, true); emit('clear', S.stage, S.clearBonus, 0); }
    }

    // ---------- пули ----------
    function cancelBullets(toItems) {
      var n = B.n;
      if (toItems) for (var i = 0; i < n; i++) { if (IT.n < K.MAXI - 64) { var j = IT.add(B.x[i], B.y[i], 0, 0, 0, 2); if (j >= 0) IT.m[j] = 1; } }
      B.n = 0;
      if (n) emit('cancel', n, 0, 0);
    }
    function burst(x, y, n, c, s) {
      var a0 = rng() * TAU, d = TAU / n;
      for (var i = 0; i < n; i++) {
        if (B.n >= B.max) return;
        var j = B.n++, a = a0 + i * d;
        B.x[j] = x; B.y[j] = y; B.a[j] = a; B.s[j] = s; B.vx[j] = Math.cos(a) * s; B.vy[j] = Math.sin(a) * s;
        B.w[j] = 0; B.ac[j] = 0; B.st[j] = 0; B.t[j] = 0; B.rt[j] = 0; B.ra[j] = 0; B.rs[j] = 0; B.r[j] = BR[0]; B.k[j] = 0; B.c[j] = c; B.g[j] = 0; B.f[j] = 0; B.bn[j] = 0;
      }
    }
    function updBullets(dt) {
      var alive = P.dead <= 0 && S.phase === 'play', px = P.x, py = P.y, hb = K.HB, gz = K.GRAZE, vul = alive && P.inv <= 0 && P.hitT < 0 && !S.noHit;
      for (var i = B.n - 1; i >= 0; i--) {
        var t = B.t[i] += dt;
        var rt = B.rt[i];
        if (rt > 0 && t >= rt) {
          B.rt[i] = 0;
          var f = B.f[i];
          if (f & 2) { burst(B.x[i], B.y[i], B.bn[i] || 8, B.c[i], B.rs[i] || 100); B.kill(i); continue; }
          var na = (f & 1) ? aim(B.x[i], B.y[i]) + B.ra[i] : B.a[i] + B.ra[i];
          B.a[i] = na; B.s[i] = B.rs[i]; B.ac[i] = 0;
          B.vx[i] = Math.cos(na) * B.s[i]; B.vy[i] = Math.sin(na) * B.s[i];
        }
        var w = B.w[i], ac = B.ac[i];
        if (w !== 0 || ac !== 0) {
          var s = B.s[i], a = B.a[i] + w * dt;
          if (ac !== 0) { s += ac * dt; var st = B.st[i]; if (ac > 0 ? s > st : s < st) { s = st; B.ac[i] = 0; } }
          B.a[i] = a; B.s[i] = s; B.vx[i] = Math.cos(a) * s; B.vy[i] = Math.sin(a) * s;
        }
        var x = B.x[i] += B.vx[i] * dt, y = B.y[i] += B.vy[i] * dt;
        if (x < -32 || x > K.FW + 32 || y < -48 || y > K.FH + 32) { if (t > 0.5 || y > K.FH) { B.kill(i); continue; } }
        if (!alive) continue;
        var dx = x - px, dy = y - py, r = B.r[i];
        if (dx > r + gz || dx < -r - gz || dy > r + gz || dy < -r - gz) continue;
        var d2 = dx * dx + dy * dy, rr = r + hb;
        if (d2 < rr * rr) { if (vul) { onHit(); vul = false; } else if (S.noHit && P.inv <= 0 && P.bombT <= 0) S.stats.ghostHits = (S.stats.ghostHits || 0) + 1; continue; }
        if (!B.g[i]) { var rg = r + gz; if (d2 < rg * rg) { B.g[i] = 1; S.graze++; S.stats.grazes++; add(20 + Math.min(S.graze, 1000) * 0.2); emit('graze', x, y, S.graze); } }
      }
    }

    // ---------- челнок ----------
    function onHit() { P.hitT = K.DEATHBOMB; emit('hit', P.x, P.y, 0); }
    function die() {
      P.hitT = -1; S.lives--; S.stats.deaths++; S.stats.stageDeaths[S.stage] = (S.stats.stageDeaths[S.stage] || 0) + 1;
      emit('die', P.x, P.y, S.lives);
      cancelBullets(false);
      setSparks(Math.floor(S.sparks / 2)); S.bombs = K.BOMBS;   // смерть — половина множителя
      if (boss.on) boss.capture = false;
      // часть искр выпадает на месте — можно подобрать после возрождения
      for (var i = 0; i < 6; i++) IT.add(P.x, P.y, (rng() - 0.5) * 200, -140 - rng() * 100, 0, 0);
      P.dead = K.DEAD_T; P.bombT = 0;
    }
    function respawn() {
      if (S.lives <= 0) {
        if (S.conts >= K.CONTS) { S.phase = 'over'; S.over = true; emit('gameover', S.score, 0, 0); }
        else { S.phase = 'cont'; S.contT = K.CONT_T; emit('contAsk', K.CONTS - S.conts, 0, 0); }
        return;
      }
      P.x = K.PX0; P.y = K.PY0; P.inv = K.INV; P.dead = 0;
      emit('respawn', P.x, P.y, 0);
    }
    function bomb() {
      if (S.phase !== 'play' || P.dead > 0 || S.bombs <= 0 || P.bombT > 0) return false;
      S.bombs--; S.stats.bombs++;
      if (P.hitT >= 0) { P.hitT = -1; S.stats.deathbombs++; }
      P.bombT = K.BOMB_T; P.inv = Math.max(P.inv, K.BOMB_T);
      if (boss.on) boss.capture = false;
      emit('bomb', P.x, P.y, S.bombs);
      return true;
    }
    function shoot() {
      var sh = SHOT[P.form], arr = P.focus ? sh.narrow : sh.wide, v = 860;
      for (var i = 0; i < arr.length; i++) {
        var a = -Math.PI / 2 + arr[i], ox = sh.dx[i] * (P.focus ? 0.6 : 1);
        var j = PS.add(P.x + ox, P.y - 10, Math.cos(a) * v, Math.sin(a) * v, sh.dmg * (P.focus && P.form === 'blade' ? 1.15 : 1), P.form === 'fan' ? 0 : 1);
        if (j < 0) break;
      }
      emit('shot', 0, 0, 0);
    }
    function updPlayer(dt) {
      if (P.hitT >= 0) { P.hitT -= dt; if (P.hitT < 0) die(); }
      if (P.dead > 0) { P.dead -= dt; if (P.dead <= 0) respawn(); return; }
      if (P.inv > 0) P.inv -= dt;
      var sp = P.focus ? K.SPD_F : K.SPD, mx = 0, my = 0;
      if (P.dx || P.dy) { var l = Math.sqrt(P.dx * P.dx + P.dy * P.dy); mx = P.dx / l * sp * dt; my = P.dy / l * sp * dt; }
      if (P.px || P.py) { // палец: относительное перемещение, ограничено 2.4× скорости
        var lim = sp * 2.4 * dt, k = P.focus ? 0.6 : 1, px = P.px * k, py = P.py * k, pl = Math.sqrt(px * px + py * py);
        if (pl > lim) { px *= lim / pl; py *= lim / pl; P.px -= px / k; P.py -= py / k; } else { P.px = 0; P.py = 0; }
        mx += px; my += py;
      }
      if (S.frozen) { mx = 0; my = 0; }
      P.moving = mx || my ? 1 : 0;
      P.x = clamp(P.x + mx, 8, K.FW - 8); P.y = clamp(P.y + my, 14, K.FH - 10);
      if (P.bombT > 0) {
        P.bombT -= dt;
        if (P.bombT > K.BOMB_T - K.BOMB_CLEAR) {
          cancelBullets(true);
          for (var i = 0; i < E.length; i++) { var e = E[i]; if (e.on && e.y > -10) hurtEnemy(e, 60 * dt); }
          if (boss.on && boss.enter <= 0 && boss.gap <= 0 && boss.inv <= 0 && !boss.dead) boss.hp -= 18 * dt;
        }
      }
      if (S.phase === 'play' && !S.frozen) { P.fireT -= dt; if (P.fireT <= 0) { P.fireT += K.FIRE_IV; if (P.fireT <= 0) P.fireT = K.FIRE_IV; shoot(); } }
    }

    // ---------- враги ----------
    function hurtEnemy(e, d) {
      e.hp -= d; e.flash = 0.06;
      if (e.hp <= 0) killEnemy(e);
    }
    function killEnemy(e) {
      e.on = false; S.stats.kills++;
      var pts = e.sc * S.mult; add(e.sc);
      emit('kill', e.x, e.y, Math.round(pts));
      for (var i = 0; i < e.sp; i++) IT.add(e.x + (rng() - 0.5) * e.r, e.y + (rng() - 0.5) * e.r, (rng() - 0.5) * 120, -90 - rng() * 110, 0, 0);
    }
    function updEnemies(dt) {
      var alive = P.dead <= 0 && S.phase === 'play', vul = alive && P.inv <= 0 && P.hitT < 0 && !S.noHit;
      for (var i = 0; i < E.length; i++) {
        var e = E[i]; if (!e.on) continue;
        e.t += dt; if (e.flash > 0) e.flash -= dt;
        switch (e.path) {
          case 0: e.x += e.vx * dt; e.y += e.vy * dt; if (e.amp) e.x = e.x0 + e.vx * e.t + e.amp * Math.sin(e.t * e.fq); break;
          case 1: // спуск и уход дугой в сторону
            if (e.y < e.ty) e.y += e.vy * dt; else { e.vx += e.dir * 160 * dt; e.vy = Math.max(-40, e.vy - 90 * dt); e.y += e.vy * dt * 0.5; }
            e.x += e.vx * dt; break;
          case 2: // зависнуть: въезд, ожидание, уход вверх
            if (e.t < 1.1) { var u = e.t / 1.1; e.y = -24 + (e.ty + 24) * (1 - (1 - u) * (1 - u)); }
            else if (e.t > 1.1 + e.hold) { e.vy = Math.max(-160, (e.vy > 0 ? 0 : e.vy) - 220 * dt); e.y += e.vy * dt; }
            else e.x = e.x0 + Math.sin((e.t - 1.1) * 0.9) * e.amp;
            break;
          case 3: e.x += e.vx * dt; e.y += e.vy * dt; break;
        }
        if (e.t > 1.0 && (e.x < -50 || e.x > K.FW + 50 || e.y < -60 || e.y > K.FH + 40)) { e.on = false; continue; }
        // огонь: только на экране, не у самого низа и не в упор
        if (e.pat && alive && e.y > 8 && e.y < K.FH * 0.66 && e.x > 4 && e.x < K.FW - 4) {
          var ddx = e.x - P.x, ddy = e.y - P.y;
          if (ddx * ddx + ddy * ddy > 90 * 90) e.pat(G, e, dt);
        }
        // таран
        if (vul) { var cx = e.x - P.x, cy = e.y - P.y, rr = e.r * 0.7 + K.HB; if (cx * cx + cy * cy < rr * rr) { onHit(); vul = false; } }
      }
    }
    function updBoss(dt) {
      if (!boss.on) return;
      var b = boss;
      if (b.flash > 0) b.flash -= dt;
      if (b.leave > 0) { b.leave -= dt; b.y -= 260 * dt; if (b.leave <= 0 || b.y < -80) b.on = false; return; }
      if (b.enter > 0) {
        b.enter -= dt; b.y += (b.ty - b.y) * Math.min(1, dt * 3);
        if (b.enter <= 0) startCard(0);
        return;
      }
      var card = b.def.cards[b.ci];
      if (b.gap > 0) {
        b.gap -= dt; b.x += (K.FW / 2 - b.x) * Math.min(1, dt * 2.5); b.y += ((b.def.home || 130) - b.y) * Math.min(1, dt * 2.5);
        if (b.gap <= 0) startCard(b.ci);
        return;
      }
      if (b.inv > 0) b.inv -= dt;
      b.t += dt;
      // движение по карте
      var mv = card.mv || 'c', home = b.def.home || 130;
      if (mv === 's') { b.tx = K.FW / 2 + Math.sin(b.t * 0.55) * 90; b.ty = home + Math.sin(b.t * 1.1) * 12; }
      else if (mv === 'd') { b.mvT -= dt; if (b.mvT <= 0) { b.mvT = 3.2; b.tx = 90 + rng() * (K.FW - 180); b.ty = home - 20 + rng() * 50; } }
      else { b.tx = K.FW / 2; b.ty = home + Math.sin(b.t * 1.4) * 6; }
      b.x += (b.tx - b.x) * Math.min(1, dt * 1.6); b.y += (b.ty - b.y) * Math.min(1, dt * 1.6);
      if (b.inv <= 0 && S.phase === 'play') card.f(G, b, dt);
      if (P.dead <= 0 && P.inv <= 0 && P.hitT < 0 && !S.noHit) { var cx = b.x - P.x, cy = b.y - P.y, rr = 20 + K.HB; if (cx * cx + cy * cy < rr * rr) onHit(); }
      if (b.hp <= 0) endCard(false);
      else if (b.t >= card.time) { b.timeout = true; endCard(true); }
    }

    // ---------- выстрелы и предметы ----------
    function updShots(dt) {
      for (var i = PS.n - 1; i >= 0; i--) {
        var x = PS.x[i] += PS.vx[i] * dt, y = PS.y[i] += PS.vy[i] * dt;
        if (y < -20 || x < -20 || x > K.FW + 20) { PS.kill(i); continue; }
        var hit = false;
        if (boss.on && !boss.dead && boss.leave <= 0 && boss.enter <= 0) {
          var bx = boss.x - x, by = boss.y - y;
          if (bx * bx + by * by < 30 * 30) {
            hit = true;
            if (boss.gap <= 0 && boss.inv <= 0) { boss.hp -= PS.v[i] * (P.bombT > 0 ? 0.25 : 1); boss.flash = 0.05; emit('bossHit', x, y, 0); }
          }
        }
        if (!hit) for (var k = 0; k < E.length; k++) {
          var e = E[k]; if (!e.on || e.y < -6) continue;
          var ex = e.x - x, ey = e.y - y, rr = e.r + 4;
          if (ex * ex + ey * ey < rr * rr) { hurtEnemy(e, PS.v[i]); hit = true; emit('enemyHit', x, y, 0); break; }
        }
        if (hit) PS.kill(i);
      }
    }
    // предметы: 0 — искра (+1 к счётчику искр → множитель ×(1 + 0,01·n), не выше ×5), 2 — окалина от погашенных пуль (очки)
    function collect(i) {
      var k = IT.k[i];
      if (k === 0) { setSparks(S.sparks + 1); add(50); emit('spark', IT.x[i], IT.y[i], S.sparks); }
      else add(20);
      IT.kill(i);
    }
    function updItems(dt) {
      var alive = P.dead <= 0 && (S.phase === 'play' || S.phase === 'clear'), all = alive && (S.magnetT > 0 || P.bombT > 0 || S.phase === 'clear');
      var mr = P.focus ? K.MAGNET_RF : K.MAGNET_R;   // в фокусе искры притягиваются издалека
      for (var i = IT.n - 1; i >= 0; i--) {
        IT.t[i] += dt;
        var mag = IT.m[i] || all;
        if (alive && !mag) { var ax = IT.x[i] - P.x, ay = IT.y[i] - P.y; if (ax * ax + ay * ay < mr * mr) mag = true; }
        if (mag && alive) {
          IT.m[i] = 1;
          var dx = P.x - IT.x[i], dy = P.y - IT.y[i], d = Math.sqrt(dx * dx + dy * dy) || 1, v = 520 + IT.t[i] * 200;
          if (d < 14) { collect(i); continue; }
          IT.x[i] += dx / d * v * dt; IT.y[i] += dy / d * v * dt;
          continue;
        }
        IT.vy[i] = Math.min(110, IT.vy[i] + 260 * dt); IT.vx[i] *= 0.96;
        IT.x[i] += IT.vx[i] * dt; IT.y[i] += IT.vy[i] * dt;
        if (IT.y[i] > K.FH + 12) IT.kill(i);
      }
    }

    // ---------- главный тик ----------
    function tick(dt) {
      S.time += dt;
      if (S.phase === 'cont') { S.contT -= dt; if (S.contT <= 0) { S.phase = 'over'; S.over = true; emit('gameover', S.score, 0, 0); } return; }
      if (S.phase === 'over' || S.phase === 'won' || S.phase === 'idle') return;
      if (S.magnetT > 0) S.magnetT -= dt;
      if (S.phase === 'clear') {
        S.clearT -= dt; updPlayer(dt); updShots(dt); updItems(dt);
        if (S.clearT <= 0) {
          if (S.stage >= S.stages || opts.maxStage === S.stage) {
            var fin = S.stage >= S.stages ? Math.round((S.lives * 200000 + S.bombs * 50000) * D.bonus) : 0;
            add(fin, true); S.phase = 'won'; S.won = true; emit('win', S.score, fin, 0);
          } else startStage(S.stage + 1);
        }
        return;
      }
      // сценарий этапа идёт, пока нет босса
      if (!boss.on) {
        S.stageT += dt;
        while (si < script.length && script[si].t <= S.stageT) {
          var ev = script[si++];
          if (ev.boss) { spawnBoss(ev.boss, ev.mid); break; }
          spawnEnemy(ev);
        }
      }
      updPlayer(dt);
      updEnemies(dt);
      updBoss(dt);
      updShots(dt);
      updBullets(dt);
      updItems(dt);
    }

    var acc = 0;
    var api = {
      start: function () { S.phase = 'play'; P.inv = 2; startStage(S.stage); return api; },
      tick: tick,
      update: function (dt) { acc += Math.min(dt, 0.1); var n = 0; while (acc >= K.STEP && n < 6) { acc -= K.STEP; tick(K.STEP); n++; } if (n >= 6) acc = 0; },
      state: function () { return S; },
      setInput: function (dx, dy, focus) { P.dx = dx || 0; P.dy = dy || 0; P.focus = !!focus; },
      setFocus: function (f) { P.focus = !!f; },
      drag: function (dx, dy) { P.px += dx; P.py += dy; },
      setForm: function (f) { if (FORMS.indexOf(f) >= 0) P.form = f; },
      bomb: bomb,
      cont: function () {
        if (S.phase !== 'cont') return false;
        S.conts++; S.lives = K.LIVES; S.bombs = K.BOMBS; S.phase = 'play'; S.score = S.score - (S.score % 10) + S.conts; setSparks(0);
        P.x = K.PX0; P.y = K.PY0; P.inv = K.INV; P.dead = 0; emit('continue', S.conts, 0, 0); return true;
      },
      giveUp: function () { if (S.phase === 'cont') { S.phase = 'over'; S.over = true; emit('gameover', S.score, 0, 0); } },
      // ---- тестовые хуки ----
      _G: G,
      _card: function (id, ci, mid) { // сразу карта босса id с номером ci (в тестах — бессмертный челнок стоит на месте)
        S.phase = 'play'; script = []; si = 0; B.n = 0; spawnBoss(id, mid); boss.enter = 0; boss.y = boss.ty; startCard(ci || 0); boss.inv = 0;
      },
      _stageOnly: function (n) { startStage(n); },
      _fill: function (n) { sp0(); for (var i = 0; i < n; i++) { SP.k = i % 5; SP.c = i % 8; SP.w = (i % 3) * 0.2; fire(rng() * K.FW, rng() * K.FH * 0.9, rng() * TAU, 20 + rng() * 40); } sp0(); },
      _hit: onHit, _die: die, _sparks: setSparks, _collect: collect, _kill: killEnemy, _spawn: spawnEnemy, _boss: spawnBoss, _add: add
    };
    return api;
  };

  LV.logic = { K: K, BR: BR, DIFF: DIFF, DIFFS: DIFFS, FORMS: FORMS, SHOT: SHOT, ET: ET, PATHS: PATHS, mulberry32: mulberry32, Bullets: Bullets, Bodies: Bodies };
})(typeof window !== 'undefined' ? window : globalThis);
