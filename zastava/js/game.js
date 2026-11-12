/* ЗАСТАВА · логика без DOM (детерминирована при заданном rng). ZASTAVA.Game(opts), ZASTAVA.logic
   Ржавые механизмы-паразиты штурмуют заставу мастерской «Гефест». Внизу — лафет-пушка.
   Три вида волн:
   - grid  — сеточный строй 10×5 ходит влево-вправо шагами, у края опускается ступенькой,
             ускоряется по мере убыли; стреляют только нижние в каждой колонне; над строем — зонд-бонус;
   - birds — механические коршуны-штурмовики: висят стаей, закрываются щитом-крыльями, ныряют на лафет;
   - boss  — матка: ядро-горн внутри вращающегося конвейерного пояса из пластин (5-я — один пояс, 10-я — два).
   Укрытия-наковальни из клеток 3×3 px разрушаются пулями с обеих сторон и строем. */
(function (global) {
  'use strict';
  var Z = global.ZASTAVA = global.ZASTAVA || {};

  // ---------- Поле ----------
  var W = 480, H = 640, FX0 = 12, FX1 = 468, FY0 = 52;
  var PROBE_Y = 76, PLAYER_Y = 594, PW = 34, PH = 16, GROUND_Y = 616, INVADE_Y = 574;
  var COLS = 10, ROWS = 5, CW = 36, CH = 30, AW = 26, AH = 18, STEP = 4, DROP = 12;
  var ROW_TYPE = ['drill', 'gear', 'gear', 'tick', 'tick'];
  var PTS = { tick: 10, gear: 20, drill: 30 };
  var BK_N = 4, BK_C = 22, BK_R = 15, BK_S = 3, BK_Y = 494;   // наковальня 66×45 px
  var BIRD_W = 46, BIRD_H = 28;
  var SHOT_V = 700, PLAYER_V = 215, EXTRA_LIFE = [5000, 10000];   // пороги очков за +1 лафет
  var TAU = Math.PI * 2;

  // 10 волн: 5 сеточных, 3 стаи коршунов, 2 матки
  var WAVES = [
    { kind: 'grid', name: 'dawn' },
    { kind: 'grid', name: 'cogs' },
    { kind: 'birds', name: 'kites', n: 8, hp: 1 },
    { kind: 'grid', name: 'drills' },
    { kind: 'boss', name: 'mother', rings: 1 },
    { kind: 'birds', name: 'flock', n: 10, hp: 2 },
    { kind: 'grid', name: 'scale' },
    { kind: 'grid', name: 'onslaught' },
    { kind: 'birds', name: 'storm', n: 12, hp: 2 },
    { kind: 'boss', name: 'heart', rings: 2 }
  ];
  var PROBE_PTS = [50, 100, 100, 150, 150, 300];

  // Маска укрытия-наковальни: рог слева, плоская «наличь», узкая шейка, лапы с выемкой
  function inAnvil(c, r) {
    if (r === 0) return c >= 5 && c <= 20;
    if (r === 1) return c >= 1 && c <= 21;
    if (r === 2) return c >= 0 && c <= 21;
    if (r === 3) return c >= 3 && c <= 20;
    if (r === 4) return c >= 5 && c <= 18;
    if (r <= 8) return c >= 7 && c <= 15;
    if (r === 9) return c >= 5 && c <= 17;
    if (r === 10) return c >= 3 && c <= 19;
    return c >= 2 && c <= 20 && !(r >= 12 && c >= 8 && c <= 14);
  }
  function makeBunkers() {
    var out = [];
    for (var i = 0; i < BK_N; i++) {
      var cx = FX0 + (FX1 - FX0) * (i + 0.5) / BK_N, cells = [];
      for (var r = 0; r < BK_R; r++) for (var c = 0; c < BK_C; c++) cells.push(inAnvil(c, r) ? 1 : 0);
      out.push({ x: Math.round(cx - BK_C * BK_S / 2), y: BK_Y, cells: cells });
    }
    return out;
  }
  function cellAt(bunkers, x, y) {
    if (y < BK_Y || y >= BK_Y + BK_R * BK_S) return null;
    for (var i = 0; i < bunkers.length; i++) {
      var b = bunkers[i], c = Math.floor((x - b.x) / BK_S), r = Math.floor((y - b.y) / BK_S);
      if (c >= 0 && c < BK_C && r >= 0 && r < BK_R && b.cells[r * BK_C + c]) return { b: b, c: c, r: r };
    }
    return null;
  }

  // Параметры волны (сложность) — через хук difficulty(level, base, step, max) движка
  function params(wave, diff) {
    var d = diff || function (lv, base, step, max) { var v = base + (lv - 1) * step; return max == null ? v : (step >= 0 ? Math.min(v, max) : Math.max(v, max)); };
    var gi = 0; for (var i = 0; i < wave - 1 && i < WAVES.length; i++) if (WAVES[i].kind === 'grid') gi++;
    return {
      // строй
      iMax: d(wave, 0.56, -0.015, 0.42),        // интервал шага при полном строе, с
      iMin: d(wave, 0.034, -0.0015, 0.022),     // интервал шага у последнего
      startY: 104 + Math.min(gi, 2) * 10,       // каждая следующая сеточная волна начинается ниже
      fireMin: d(wave, 0.8, -0.03, 0.5), fireMax: d(wave, 1.6, -0.06, 1.05),
      maxShots: Math.min(3, 1 + Math.ceil(wave / 3)),
      bulletV: d(wave, 185, 7, 255), aimProb: d(wave, 0.3, 0.03, 0.5), drillP: d(wave, 0.15, 0.035, 0.4),
      probeEvery: 19,
      // коршуны
      shOn: d(wave, 1.5, 0.08, 2.2), shOff: d(wave, 1.9, -0.08, 1.2),
      diveEvery: d(wave, 3.0, -0.12, 1.9), diveT: d(wave, 2.6, -0.06, 2.1), maxDivers: wave >= 6 ? 2 : 1,
      bombV: d(wave, 200, 9, 280),
      // матка
      bossFire: wave >= 10 ? 1.05 : 1.45, bossV: wave >= 10 ? 58 : 42, repair: wave >= 10 ? 5.2 : 7
    };
  }

  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, onEvent = opts.onEvent || function () {};
    var maxWave = opts.maxWave || WAVES.length;
    var S = {
      wave: opts.wave || 1, maxWave: maxWave, lives: opts.lives == null ? 3 : opts.lives, score: 0,
      phase: 'intro', phaseT: 0, time: 0, over: false, won: false, invaded: false,
      kind: 'grid', name: '', prm: null, extra: 0, clearBonus: 0, banner: 0,
      player: { x: W / 2, dead: false, grace: 0, cool: 0, recoil: 0 },
      shot: null, bullets: [], bunkers: [], fleet: null, probe: null, probeT: 0,
      birds: [], diveT: 0, boss: null, fireT: 0, kills: 0, shots: 0, hitFx: []
    };
    var dir = 0, fire = false;
    function emit(t, d) { onEvent(t, d || {}); }
    function rr(a, b) { return a + (b - a) * rng(); }
    function addScore(n) {
      S.score += n;
      while (S.extra < EXTRA_LIFE.length && S.score >= EXTRA_LIFE[S.extra]) { S.extra++; S.lives++; emit('life', { lives: S.lives }); }
    }

    // ---------- Волны ----------
    function setupWave() {
      var wv = WAVES[(S.wave - 1) % WAVES.length];
      S.kind = wv.kind; S.name = wv.name; S.prm = params(S.wave, opts.difficulty);
      S.bunkers = makeBunkers(); S.bullets = []; S.shot = null; S.probe = null; S.birds = []; S.boss = null; S.fleet = null;
      S.probeT = S.prm.probeEvery * 0.8; S.fireT = 1.2; S.phase = 'intro'; S.phaseT = 1.6; S.banner = 1.6;
      S.player.dead = false; S.player.grace = 0;
      if (wv.kind === 'grid') {
        var al = [];
        for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) al.push({ c: c, r: r, type: ROW_TYPE[r], alive: true, hit: 0 });
        var fw = COLS * CW;
        S.fleet = { x: Math.round((FX0 + FX1 - fw) / 2), y: S.prm.startY, dir: 1, timer: S.prm.iMax, frame: 0, aliens: al, alive: al.length, total: al.length, drops: 0 };
      } else if (wv.kind === 'birds') {
        var n = wv.n, perRow = Math.ceil(n / 2);
        for (var i = 0; i < n; i++) {
          var row = i < perRow ? 0 : 1, k = row ? i - perRow : i, cnt = row ? n - perRow : perRow;
          S.birds.push({ hx: W / 2 + (k - (cnt - 1) / 2) * 64 + (row ? 16 : -16), hy: 132 + row * 62, x: 0, y: 0, hp: wv.hp, max: wv.hp,
            state: 'form', shield: rng() < 0.5, shT: rr(0.3, 1.6), s: 0, ph: rng() * TAU, flash: 0, alive: true, bombs: 0 });
        }
        S.birds.forEach(function (b) { b.x = b.hx; b.y = b.hy; });
        S.diveT = S.prm.diveEvery;
      } else {
        var two = wv.rings === 2, rings = [];
        if (two) {
          rings.push({ r1: 25, r2: 35, n: 14, max: 1, rot: 0, spin: 0.9, hp: [] });
          rings.push({ r1: 39, r2: 51, n: 22, max: 2, rot: 0.3, spin: -0.62, hp: [] });
        } else rings.push({ r1: 26, r2: 42, n: 18, max: 2, rot: 0, spin: 0.72, hp: [] });
        rings.forEach(function (g) { for (var j = 0; j < g.n; j++) g.hp.push(g.max); });
        S.boss = { x: W / 2, y: 178, vx: S.prm.bossV, rc: 19, rings: rings, hp: two ? 16 : 10, max: two ? 16 : 10,
          fireT: 2, flash: 0, repairT: S.prm.repair, spreadT: 0, alive: true };
      }
      emit('wave', { wave: S.wave, kind: S.kind });
    }

    // ---------- Строй ----------
    function alienPos(a) { var F = S.fleet; return { x: F.x + a.c * CW + CW / 2, y: F.y + a.r * CH + CH / 2 }; }
    function fleetBounds() {
      var F = S.fleet, minC = 99, maxC = -1, maxR = -1;
      for (var i = 0; i < F.aliens.length; i++) { var a = F.aliens[i]; if (!a.alive) continue; if (a.c < minC) minC = a.c; if (a.c > maxC) maxC = a.c; if (a.r > maxR) maxR = a.r; }
      return { x0: F.x + minC * CW + (CW - AW) / 2, x1: F.x + maxC * CW + (CW + AW) / 2, bottom: F.y + maxR * CH + (CH + AH) / 2 };
    }
    function interval() {
      var F = S.fleet, p = S.prm, f = F.total > 1 ? (F.alive - 1) / (F.total - 1) : 0;
      return p.iMin + (p.iMax - p.iMin) * Math.pow(Math.max(0, f), 1.5);
    }
    function marchTick() {
      var F = S.fleet, B = fleetBounds();
      if ((F.dir > 0 && B.x1 + STEP > FX1) || (F.dir < 0 && B.x0 - STEP < FX0)) { F.y += DROP; F.dir = -F.dir; F.drops++; emit('drop', { y: F.y }); }
      else F.x += F.dir * STEP;
      F.frame ^= 1; emit('march', { frame: F.frame, beat: F.drops + F.frame });
      // строй стирает укрытия, через которые проходит
      for (var i = 0; i < F.aliens.length; i++) {
        var a = F.aliens[i]; if (!a.alive) continue;
        var q = alienPos(a); if (q.y + AH / 2 >= BK_Y) eraseRect(q.x - AW / 2, q.y - AH / 2, AW, AH);
      }
      if (fleetBounds().bottom >= INVADE_Y) invade();
    }
    function invade() {
      if (S.over) return;
      S.invaded = true; S.over = true; S.phase = 'over'; S.lives = 0;
      emit('invade', {}); emit('gameover', { score: S.score });
    }
    function lowestInColumn(c) {
      var F = S.fleet, best = null;
      for (var i = 0; i < F.aliens.length; i++) { var a = F.aliens[i]; if (a.alive && a.c === c && (!best || a.r > best.r)) best = a; }
      return best;
    }
    function shooters() {   // нижние живые в каждой колонне
      var out = []; for (var c = 0; c < COLS; c++) { var a = lowestInColumn(c); if (a) out.push(a); } return out;
    }
    function gridFire() {
      var list = shooters(); if (!list.length) return;
      var a;
      if (rng() < S.prm.aimProb) {
        a = list[0]; var bd = 1e9;
        for (var i = 0; i < list.length; i++) { var d = Math.abs(alienPos(list[i]).x - S.player.x); if (d < bd) { bd = d; a = list[i]; } }
      } else a = list[Math.floor(rng() * list.length)];
      var q = alienPos(a), drill = rng() < S.prm.drillP;
      S.bullets.push({ x: q.x, y: q.y + AH / 2 + 2, vx: 0, vy: S.prm.bulletV * (drill ? 1.18 : 1), kind: drill ? 'drill' : 'spark', t: 0 });
      emit('alienShot', { x: q.x, kind: drill ? 'drill' : 'spark' });
    }

    // ---------- Укрытия ----------
    function blast(x, y, rad) {
      for (var i = 0; i < S.bunkers.length; i++) {
        var b = S.bunkers[i], c0 = Math.floor((x - b.x) / BK_S), r0 = Math.floor((y - b.y) / BK_S);
        if (c0 < -4 || c0 > BK_C + 4) continue;
        for (var r = r0 - 3; r <= r0 + 3; r++) for (var c = c0 - 3; c <= c0 + 3; c++) {
          if (c < 0 || c >= BK_C || r < 0 || r >= BK_R) continue;
          var d = Math.hypot(c - c0, r - r0);
          if (d <= rad - 0.6 || (d <= rad + 0.6 && rng() < 0.55)) b.cells[r * BK_C + c] = 0;
        }
      }
      emit('bunker', { x: x, y: y });
    }
    function eraseRect(x, y, w, h) {
      for (var i = 0; i < S.bunkers.length; i++) {
        var b = S.bunkers[i];
        for (var r = 0; r < BK_R; r++) for (var c = 0; c < BK_C; c++) {
          var cx = b.x + c * BK_S + 1.5, cy = b.y + r * BK_S + 1.5;
          if (cx >= x && cx <= x + w && cy >= y && cy <= y + h) b.cells[r * BK_C + c] = 0;
        }
      }
    }

    // ---------- Игрок ----------
    function playerFire() {
      var P = S.player;
      if (S.shot || P.dead || P.cool > 0 || S.over || (S.phase !== 'play' && S.phase !== 'intro')) return false;
      S.shot = { x: P.x, y: PLAYER_Y - PH / 2 - 4 }; P.recoil = 0.12; S.shots++;
      emit('shoot', { x: P.x }); return true;
    }
    function playerHit(x, y) {
      var P = S.player; if (P.dead || P.grace > 0 || S.over) return;
      P.dead = true; S.lives--; S.phase = 'dead'; S.phaseT = 1.7; S.bullets = []; S.shot = null;
      emit('playerHit', { x: P.x, y: PLAYER_Y, lives: S.lives });
      if (S.lives <= 0) { S.over = true; S.phase = 'over'; emit('gameover', { score: S.score }); }
    }

    // Попадание выстрела в точке (x,y): true — выстрел поглощён
    function shotHits(x, y) {
      var i, sh = S.shot;
      // пули противника: искру сбивает, сверло проходит дальше
      for (i = 0; i < S.bullets.length; i++) {
        var b = S.bullets[i];
        if (Math.abs(b.x - x) < 4 && Math.abs(b.y - y) < 9) {
          if (b.kind !== 'drill') { S.bullets.splice(i, 1); addScore(5); emit('clash', { x: x, y: y, kill: true }); }
          else emit('clash', { x: x, y: y, kill: false });
          return true;
        }
      }
      var cell = cellAt(S.bunkers, x, y);
      if (cell) { blast(x, y - 2, 1.9); return true; }
      if (S.fleet) {
        var F = S.fleet;
        for (i = 0; i < F.aliens.length; i++) {
          var a = F.aliens[i]; if (!a.alive) continue;
          var q = alienPos(a);
          if (Math.abs(x - q.x) <= AW / 2 && Math.abs(y - q.y) <= AH / 2) {
            a.alive = false; F.alive--; S.kills++; addScore(PTS[a.type]);
            emit('kill', { x: q.x, y: q.y, type: a.type, pts: PTS[a.type] });
            return true;
          }
        }
      }
      if (S.probe && Math.abs(x - S.probe.x) <= 22 && Math.abs(y - S.probe.y) <= 11) {
        var pts = S.probe.pts; addScore(pts); emit('probeKill', { x: S.probe.x, y: S.probe.y, pts: pts }); S.probe = null; return true;
      }
      for (i = 0; i < S.birds.length; i++) {
        var bd = S.birds[i]; if (!bd.alive) continue;
        if (Math.abs(x - bd.x) <= BIRD_W / 2 - 2 && Math.abs(y - bd.y) <= BIRD_H / 2) {
          if (bd.shield && bd.state === 'form') { bd.flash = 0.15; emit('deflect', { x: x, y: bd.y + BIRD_H / 2 }); return true; }
          bd.hp--; bd.flash = 0.2;
          if (bd.hp <= 0) {
            bd.alive = false; S.kills++; var p2 = bd.state === 'form' ? 60 : 150; addScore(p2);
            emit('birdKill', { x: bd.x, y: bd.y, pts: p2 });
          } else emit('birdHit', { x: bd.x, y: bd.y });
          return true;
        }
      }
      if (S.boss && S.boss.alive) return bossHit(x, y);
      return false;
    }

    // ---------- Матка ----------
    function ringAt(B, x, y) {   // → {ring, idx} пластина пояса в точке или null
      var dx = x - B.x, dy = y - B.y, d = Math.hypot(dx, dy);
      for (var k = 0; k < B.rings.length; k++) {
        var g = B.rings[k];
        if (d >= g.r1 && d <= g.r2) {
          var a = Math.atan2(dy, dx) - g.rot; a = ((a % TAU) + TAU) % TAU;
          return { ring: g, idx: Math.floor(a / (TAU / g.n)) % g.n, k: k };
        }
      }
      return null;
    }
    function hullHit(B, x, y) {   // корпус над поясом и боковые гондолы — броня
      var dx = x - B.x, dy = y - B.y, R = B.rings[B.rings.length - 1].r2;
      if (Math.abs(dx) < 104 && dy < -R + 6 && dy > -R - 26) return true;
      if (Math.abs(dx) > R + 2 && Math.abs(dx) < 104 && Math.abs(dy) < 11) return true;
      return false;
    }
    function bossHit(x, y) {
      var B = S.boss, dx = x - B.x, dy = y - B.y;
      if (Math.hypot(dx, dy) < B.rc) {
        B.hp--; B.flash = 0.18; addScore(50); emit('bossCore', { x: x, y: y, hp: B.hp });
        if (B.hp <= 0) {
          B.alive = false; S.kills++; var pts = S.wave >= 10 ? 5000 : 2500; addScore(pts);
          emit('bossDie', { x: B.x, y: B.y, pts: pts });
        }
        return true;
      }
      var hit = ringAt(B, x, y);
      if (hit && hit.ring.hp[hit.idx] > 0) {
        hit.ring.hp[hit.idx]--; addScore(10);
        emit('bossSeg', { x: x, y: y, broken: hit.ring.hp[hit.idx] === 0, ring: hit.k });
        return true;
      }
      if (hullHit(B, x, y)) { emit('clang', { x: x, y: y }); return true; }
      return false;
    }
    function bossUpdate(dt) {
      var B = S.boss, P = S.prm;
      B.x += B.vx * dt;
      if (B.x < 112) { B.x = 112; B.vx = Math.abs(B.vx); } else if (B.x > W - 112) { B.x = W - 112; B.vx = -Math.abs(B.vx); }
      B.rings.forEach(function (g) { g.rot = (g.rot + g.spin * dt) % TAU; });
      if (B.flash > 0) B.flash -= dt;
      // конвейер подаёт новую пластину
      B.repairT -= dt;
      if (B.repairT <= 0) {
        B.repairT = P.repair;
        for (var k = 0; k < B.rings.length; k++) {
          var g = B.rings[k], dead = []; for (var j = 0; j < g.n; j++) if (g.hp[j] === 0) dead.push(j);
          if (dead.length) { var id = dead[Math.floor(rng() * dead.length)]; g.hp[id] = 1; emit('repair', { ring: k, idx: id }); }
        }
      }
      // огонь: прицельные болты, с половины — веер
      B.fireT -= dt;
      if (B.fireT <= 0) {
        var half = B.hp <= B.max / 2;
        B.fireT = P.bossFire * (half ? 0.85 : 1) * rr(0.8, 1.2);
        var R = B.rings[B.rings.length - 1].r2, sx = B.x, sy = B.y + R + 4;
        var ang = Math.atan2(PLAYER_Y - sy, S.player.x - sx), sp = P.bulletV * 1.05;
        var list = half ? [-0.22, 0, 0.22] : [0];
        list.forEach(function (o) { S.bullets.push({ x: sx, y: sy, vx: Math.cos(ang + o) * sp, vy: Math.sin(ang + o) * sp, kind: 'bolt', t: 0 }); });
        // гондолы сбрасывают по капле
        if (rng() < 0.5) { var side = rng() < 0.5 ? -1 : 1; S.bullets.push({ x: B.x + side * 86, y: B.y + 12, vx: 0, vy: P.bulletV, kind: 'spark', t: 0 }); }
        emit('bossFire', { x: sx, y: sy, n: list.length });
      }
    }

    // ---------- Коршуны ----------
    function birdHome(b) { return { x: b.hx + Math.sin(S.time * 0.55) * 34, y: b.hy + Math.sin(S.time * 2.1 + b.ph) * 4 }; }
    function birdsUpdate(dt) {
      var P = S.prm, divers = 0, i, b;
      for (i = 0; i < S.birds.length; i++) if (S.birds[i].alive && S.birds[i].state === 'dive') divers++;
      S.diveT -= dt;
      if (S.diveT <= 0 && divers < P.maxDivers && !S.player.dead) {
        var pool = S.birds.filter(function (x) { return x.alive && x.state === 'form'; });
        if (pool.length) {
          b = pool[Math.floor(rng() * pool.length)];
          b.state = 'dive'; b.s = 0; b.shield = false; b.x0 = b.x; b.y0 = b.y; b.bombs = 0;
          b.tx = Math.max(FX0 + 30, Math.min(FX1 - 30, S.player.x + rr(-40, 40)));
          b.yLow = rr(430, 566); b.dur = P.diveT * rr(0.9, 1.15);
          emit('birdDive', { x: b.x, y: b.y });
        }
        S.diveT = P.diveEvery * rr(0.75, 1.25);
      }
      for (i = 0; i < S.birds.length; i++) {
        b = S.birds[i]; if (!b.alive) continue;
        if (b.flash > 0) b.flash -= dt;
        var h = birdHome(b);
        if (b.state === 'form') {
          b.x = h.x; b.y = h.y;
          b.shT -= dt;
          if (b.shT <= 0) { b.shield = !b.shield; b.shT = (b.shield ? P.shOn : P.shOff) * rr(0.8, 1.2); emit(b.shield ? 'shieldOn' : 'shieldOff', { x: b.x, y: b.y }); }
        } else {
          b.s += dt / b.dur;
          var s = Math.min(1, b.s), e;
          if (s < 0.5) { e = s * 2; e = e * e * (3 - 2 * e); b.x = b.x0 + (b.tx - b.x0) * e; }
          else { e = (s - 0.5) * 2; e = e * e * (3 - 2 * e); b.x = b.tx + (h.x - b.tx) * e; }
          b.x += Math.sin(s * TAU * 1.5) * 14;
          b.y = b.y0 + (b.yLow - b.y0) * Math.sin(Math.PI * s) + (h.y - b.y0) * s;
          // бомбы на снижении
          if (b.bombs === 0 && s > 0.22 || b.bombs === 1 && s > 0.38) {
            b.bombs++; S.bullets.push({ x: b.x, y: b.y + BIRD_H / 2, vx: 0, vy: P.bombV, kind: 'bomb', t: 0 }); emit('bomb', { x: b.x });
          }
          if (b.y + BIRD_H / 2 >= BK_Y) eraseRect(b.x - BIRD_W / 2 + 4, b.y - BIRD_H / 2, BIRD_W - 8, BIRD_H);
          if (!S.player.dead && Math.abs(b.x - S.player.x) < (BIRD_W + PW) / 2 - 8 && Math.abs(b.y - PLAYER_Y) < (BIRD_H + PH) / 2 - 4) {
            b.alive = false; emit('birdKill', { x: b.x, y: b.y, pts: 0 }); playerHit(b.x, b.y);
          }
          if (s >= 1) { b.state = 'form'; b.shield = true; b.shT = P.shOn * rr(0.5, 1); }
        }
      }
      // стая в строю тоже роняет бомбы — только раскрытые коршуны
      S.fireT -= dt;
      if (S.fireT <= 0) {
        S.fireT = rr(P.fireMin, P.fireMax) * 1.25;
        var open = S.birds.filter(function (x) { return x.alive && x.state === 'form' && !x.shield; });
        var nB = S.bullets.length;
        if (open.length && nB < P.maxShots) {
          var sh = open[Math.floor(rng() * open.length)];
          S.bullets.push({ x: sh.x, y: sh.y + BIRD_H / 2, vx: 0, vy: P.bombV * 0.9, kind: 'bomb', t: 0 }); emit('bomb', { x: sh.x });
        }
      }
    }

    // ---------- Основной шаг ----------
    function enemiesLeft() {
      if (S.kind === 'grid') return S.fleet ? S.fleet.alive : 0;
      if (S.kind === 'birds') return S.birds.filter(function (b) { return b.alive; }).length;
      return S.boss && S.boss.alive ? 1 : 0;
    }
    function movePlayer(dt) {
      var P = S.player; if (P.dead) return;
      P.x += dir * PLAYER_V * dt;
      P.x = Math.max(FX0 + PW / 2, Math.min(FX1 - PW / 2, P.x));
      if (P.cool > 0) P.cool -= dt; if (P.recoil > 0) P.recoil -= dt; if (P.grace > 0) P.grace -= dt;
      if (fire) playerFire();
    }
    function moveShot(dt) {
      var sh = S.shot; if (!sh) return;
      var dist = SHOT_V * dt, n = Math.max(1, Math.ceil(dist / 3)), st = dist / n;
      for (var k = 0; k < n; k++) {
        sh.y -= st;
        if (sh.y < FY0) { S.shot = null; S.player.cool = 0.08; emit('miss', { x: sh.x }); return; }
        if (shotHits(sh.x, sh.y)) { S.shot = null; S.player.cool = 0.08; return; }
      }
    }
    function moveBullets(dt) {
      for (var i = S.bullets.length - 1; i >= 0; i--) {
        var b = S.bullets[i], dist = Math.hypot(b.vx, b.vy) * dt, n = Math.max(1, Math.ceil(dist / 3)), gone = false;
        b.t += dt;
        for (var k = 0; k < n && !gone; k++) {
          b.x += b.vx * dt / n; b.y += b.vy * dt / n;
          if (b.y > GROUND_Y || b.x < FX0 - 10 || b.x > FX1 + 10) { gone = true; emit('ground', { x: b.x }); break; }
          var cell = cellAt(S.bunkers, b.x, b.y + 3);
          if (cell) { blast(b.x, b.y + 4, b.kind === 'drill' || b.kind === 'bomb' ? 2.4 : 1.8); gone = true; break; }
          var P = S.player;
          if (!P.dead && Math.abs(b.x - P.x) < PW / 2 - 2 && b.y + 4 >= PLAYER_Y - PH / 2 + 2 && b.y - 4 <= PLAYER_Y + PH / 2) { gone = true; S.bullets.splice(i, 1); playerHit(b.x, b.y); return; }
        }
        if (gone) S.bullets.splice(i, 1);
      }
    }
    function probeUpdate(dt) {
      if (S.probe) {
        S.probe.x += S.probe.vx * dt; S.probe.t += dt;
        if (S.probe.x < FX0 - 30 || S.probe.x > FX1 + 30) { S.probe = null; emit('probeGone', {}); }
        return;
      }
      if (S.kind !== 'grid' || !S.fleet || S.fleet.alive < 6) return;
      S.probeT -= dt;
      if (S.probeT <= 0) {
        S.probeT = S.prm.probeEvery * rr(0.85, 1.2);
        var left = rng() < 0.5;
        S.probe = { x: left ? FX0 - 24 : FX1 + 24, y: PROBE_Y, vx: (left ? 1 : -1) * 92, pts: PROBE_PTS[Math.floor(rng() * PROBE_PTS.length)], t: 0 };
        emit('probe', { dir: left ? 1 : -1 });
      }
    }

    function update(dt) {
      if (S.over) return;
      S.time += dt;
      if (S.banner > 0) S.banner -= dt;
      if (S.phase === 'intro') {
        movePlayer(dt); moveShot(dt);
        if (S.boss) { S.boss.rings.forEach(function (g) { g.rot = (g.rot + g.spin * dt) % TAU; }); }
        S.phaseT -= dt; if (S.phaseT <= 0) S.phase = 'play';
        return;
      }
      if (S.phase === 'dead') {
        S.phaseT -= dt;
        if (S.boss) S.boss.rings.forEach(function (g) { g.rot = (g.rot + g.spin * dt) % TAU; });
        if (S.phaseT <= 0) { S.player.dead = false; S.player.grace = 1.0; S.player.x = W / 2; S.phase = 'play'; S.fireT = 1.0; emit('respawn', {}); }
        return;
      }
      if (S.phase === 'clear') {
        S.phaseT -= dt; movePlayer(dt);
        if (S.phaseT <= 0) {
          if (S.wave >= S.maxWave) { S.over = true; S.won = true; S.phase = 'over'; emit('win', { score: S.score }); }
          else { S.wave++; setupWave(); }
        }
        return;
      }
      // play
      movePlayer(dt);
      moveShot(dt);
      if (S.over) return;
      if (S.kind === 'grid' && S.fleet && S.fleet.alive > 0) {
        var F = S.fleet;
        F.timer -= dt;
        var guard = 0;
        while (F.timer <= 0 && guard++ < 8 && !S.over) { marchTick(); F.timer += interval(); }
        if (S.over) return;
        S.fireT -= dt;
        if (S.fireT <= 0 && S.player.grace <= 0) {
          var sp = S.prm, fewer = 1 - F.alive / F.total;
          S.fireT = rr(sp.fireMin, sp.fireMax) * (1 - 0.3 * fewer);
          if (S.bullets.length < sp.maxShots) gridFire();
        }
      }
      probeUpdate(dt);
      if (S.kind === 'birds') birdsUpdate(dt);
      if (S.kind === 'boss' && S.boss && S.boss.alive) bossUpdate(dt);
      if (S.over || S.phase !== 'play') return;
      moveBullets(dt);
      if (S.over || S.phase !== 'play') return;
      if (enemiesLeft() === 0) {
        S.clearBonus = 100 * S.wave; addScore(S.clearBonus);
        S.phase = 'clear'; S.phaseT = 2.0; S.bullets = []; S.shot = null; S.probe = null;
        emit('clear', { wave: S.wave, bonus: S.clearBonus });
      }
    }

    var api = {
      start: function () { setupWave(); return api; },
      update: update,
      setDir: function (d) { dir = d > 0 ? 1 : d < 0 ? -1 : 0; },
      setFire: function (v) { fire = !!v; },
      action: function () { return playerFire(); },
      state: function () { return S; },
      _S: S,
      // для тестов
      _setupWave: function (n) { S.wave = n; setupWave(); return S; },
      _march: marchTick, _interval: interval, _alienPos: alienPos, _shooters: shooters, _gridFire: gridFire,
      _blast: blast, _cellAt: function (x, y) { return cellAt(S.bunkers, x, y); }, _ringAt: function (x, y) { return ringAt(S.boss, x, y); },
      _playerHit: playerHit, _fleetBounds: fleetBounds
    };
    return api;
  }

  Z.Game = Game;
  Z.logic = {
    W: W, H: H, FX0: FX0, FX1: FX1, FY0: FY0, PROBE_Y: PROBE_Y, PLAYER_Y: PLAYER_Y, PW: PW, PH: PH, GROUND_Y: GROUND_Y, INVADE_Y: INVADE_Y,
    COLS: COLS, ROWS: ROWS, CW: CW, CH: CH, AW: AW, AH: AH, STEP: STEP, DROP: DROP, ROW_TYPE: ROW_TYPE, PTS: PTS,
    BK_N: BK_N, BK_C: BK_C, BK_R: BK_R, BK_S: BK_S, BK_Y: BK_Y, BIRD_W: BIRD_W, BIRD_H: BIRD_H,
    SHOT_V: SHOT_V, PLAYER_V: PLAYER_V, EXTRA_LIFE: EXTRA_LIFE, WAVES: WAVES, PROBE_PTS: PROBE_PTS,
    params: params, inAnvil: inAnvil, makeBunkers: makeBunkers
  };
})(typeof window !== 'undefined' ? window : globalThis);
