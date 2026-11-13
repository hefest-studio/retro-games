/* РИКОШЕТ · логика без DOM (детерминирована при заданном rng). RIK.Game(opts), RIK.logic.
   Поле 640×480 px: HUD 32, рамка 16 px (стены слева/справа/сверху), стена блоков 16×16 клеток по 38×16 px с y=64,
   ракетка-наковальня на y=440. Физика шара — непрерывная (CCD): за шаг ищется самое раннее касание движущегося круга
   с отрезками стен, гранями и скруглёнными углами прямоугольников (блоки, ракетка, босс), шар доходит до него,
   отражается и тратит остаток шага. Поэтому шар не «проскакивает» блок ни на какой скорости.
   Анти-петли: минимальный угол к горизонтали 15°; если шар долго отскакивает без прогресса (без ракетки и без урона
   разрушимым блокам) — его направление «подталкивается» на 10–25°. */
(function (global) {
  'use strict';
  var R = global.RIK = global.RIK || {};

  var K = {
    W: 640, H: 480, HUD: 32, FX0: 16, FX1: 624, FY0: 48, BX0: 16, BY0: 64, BW: 38, BH: 16, COLS: 16, ROWS: 16,
    PY: 440, PH: 12, PADW: [60, 84, 112, 140], BR: 5, LOSE_Y: 492, BAR_Y: 466, LIVES: 3, MAXLIVES: 6, MAXBALLS: 8, STEP: 1 / 120,
    ACC: 6, MIN_SIN: 0.26, MAX_PAD_ANG: 60 * Math.PI / 180, MAX_ANG_COS: 0.34, NUDGE_BOUNCES: 18, NUDGE_TIME: 14,
    PAD_KEY_V: 620, PAD_PTR_V: 2600, REGEN_T: 7, CAP_W: 30, CAP_H: 12, CAP_V: 105, LASER_V: 760, LASER_CD: 0.28
  };
  var NORMAL = 'abcdef';
  var PTS = { normal: 50, strong: 60, boom: 80, mover: 120, regen: 70, key: 200, prize: 50, bossHit: 100, boss: 5000, clear: 1000 };
  // Призы: k — код, w — вес, bad — негативный
  var PRIZES = [
    { k: 'E', w: 14 }, { k: 'B', w: 12 }, { k: 'W', w: 11 }, { k: 'L', w: 10 }, { k: 'C', w: 9 }, { k: 'H', w: 8 },
    { k: 'F', w: 7 }, { k: '+', w: 3 }, { k: 'S', w: 7, bad: true }, { k: 'Q', w: 7, bad: true }
  ];
  var DUR = { L: 12, C: 15, F: 8, W: 10, Q: 8, H: 12 };
  var BOSSES = {
    1: { hp: 14, w: 150, h: 44, y: 78, v: 95, fire: 1.8 },
    2: { hp: 22, w: 170, h: 46, y: 76, v: 130, fire: 2.1 },
    3: { hp: 30, w: 190, h: 50, y: 74, v: 110, fire: 1.6 }
  };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---------- Геометрия: движущийся круг (центр p, смещение d, радиус r) против прямоугольника ----------
  // → { t ∈ [0,1], nx, ny } самого раннего касания или null. Грани сдвинуты на r, углы — окружности радиуса r.
  function rayCircle(px, py, dx, dy, cx, cy, r) {
    var fx = px - cx, fy = py - cy, a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - r * r;
    if (a < 1e-12 || c < 0) return -1;
    var disc = b * b - 4 * a * c; if (disc < 0) return -1;
    var t = (-b - Math.sqrt(disc)) / (2 * a);
    return t >= 0 && t <= 1 ? t : -1;
  }
  function sweepRect(px, py, dx, dy, x0, y0, x1, y1, r) {
    var best = null, t, h;
    function take(tt, nx, ny) { if (tt >= 0 && tt <= 1 && (!best || tt < best.t)) best = { t: tt, nx: nx, ny: ny }; }
    if (dx > 0) { t = (x0 - r - px) / dx; h = py + dy * t; if (t >= 0 && h >= y0 && h <= y1) take(t, -1, 0); }
    if (dx < 0) { t = (x1 + r - px) / dx; h = py + dy * t; if (t >= 0 && h >= y0 && h <= y1) take(t, 1, 0); }
    if (dy > 0) { t = (y0 - r - py) / dy; h = px + dx * t; if (t >= 0 && h >= x0 && h <= x1) take(t, 0, -1); }
    if (dy < 0) { t = (y1 + r - py) / dy; h = px + dx * t; if (t >= 0 && h >= x0 && h <= x1) take(t, 0, 1); }
    var cs = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
    for (var i = 0; i < 4; i++) {
      t = rayCircle(px, py, dx, dy, cs[i][0], cs[i][1], r);
      if (t >= 0) { var hx = px + dx * t - cs[i][0], hy = py + dy * t - cs[i][1], l = Math.hypot(hx, hy) || 1; if (hx * dx + hy * dy < 0) take(t, hx / l, hy / l); }
    }
    return best;
  }
  // круг пересекается с прямоугольником? → вектор выталкивания {x,y,d} или null
  function overlap(cx, cy, r, x0, y0, x1, y1) {
    var qx = clamp(cx, x0, x1), qy = clamp(cy, y0, y1), dx = cx - qx, dy = cy - qy, d2 = dx * dx + dy * dy;
    if (d2 >= r * r - 1e-6) return null;
    if (d2 > 1e-9) { var d = Math.sqrt(d2); return { x: dx / d, y: dy / d, d: r - d }; }
    // центр внутри — по наименьшей глубине
    var L = cx - x0, Rr = x1 - cx, T = cy - y0, B = y1 - cy, m = Math.min(L, Rr, T, B);
    if (m === L) return { x: -1, y: 0, d: L + r }; if (m === Rr) return { x: 1, y: 0, d: Rr + r };
    if (m === T) return { x: 0, y: -1, d: T + r }; return { x: 0, y: 1, d: B + r };
  }

  // ---------- Разбор уровня ----------
  function cellType(ch) {
    if (NORMAL.indexOf(ch) >= 0) return { type: 'n', hp: 1, color: ch };
    switch (ch) {
      case '2': return { type: 's', hp: 2 }; case '3': return { type: 's', hp: 3 };
      case '#': return { type: 'u', hp: 1 }; case 'X': return { type: 'x', hp: 1 };
      case 'M': return { type: 'm', hp: 1 }; case 'R': return { type: 'r', hp: 1 };
      case 'K': return { type: 'k', hp: 1 }; case 'G': return { type: 'g', hp: 1 };
    }
    return null;
  }
  // Достижимость на сетке: шар (Ø10) проходит через любую свободную клетку (38×16) и через полосу над стеной.
  // Разрушимые и движущиеся блоки — проходимы (их можно разбить), неразрушимые — нет, решётки — пока живы ключи.
  function reach(rows) {
    var nr = rows.length, C = K.COLS, H = nr + 2;            // ряд 0 — полоса над стеной, ряд nr+1 — поле под стеной
    function ch(r, c) { return r === 0 || r === H - 1 ? '.' : rows[r - 1][c]; }
    var gatesOpen = false, seen;
    function pass(r, c) { var x = ch(r, c); return x !== '#' && (x !== 'G' || gatesOpen); }
    function flood() {
      seen = {}; var q = [];
      for (var c = 0; c < C; c++) { seen[(H - 1) * C + c] = 1; q.push([H - 1, c]); }
      while (q.length) {
        var p = q.pop(), d = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (var i = 0; i < 4; i++) {
          var rr = p[0] + d[i][0], cc = p[1] + d[i][1];
          if (rr < 0 || rr >= H || cc < 0 || cc >= C || seen[rr * C + cc] || !pass(rr, cc)) continue;
          seen[rr * C + cc] = 1; q.push([rr, cc]);
        }
      }
    }
    flood();
    var keys = 0, keysSeen = 0, r, c;
    for (r = 1; r <= nr; r++) for (c = 0; c < C; c++) if (ch(r, c) === 'K') { keys++; if (seen[r * C + c]) keysSeen++; }
    if (keys && keysSeen === keys) { gatesOpen = true; flood(); }
    var bad = [];
    for (r = 1; r <= nr; r++) for (c = 0; c < C; c++) { var x = ch(r, c); if (x !== '.' && x !== '#' && x !== 'G' && !seen[r * C + c]) bad.push([r - 1, c]); }
    return { ok: bad.length === 0, bad: bad, keys: keys };
  }

  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, emit = opts.onEvent || function () {};
    var S = {
      mode: opts.mode === 'endless' ? 'endless' : 'campaign', level: opts.level || 1, score: 0, lives: opts.lives || K.LIVES,
      phase: 'play', phaseT: 0, time: 0, levelTime: 0, over: false, won: false,
      bricks: [], grid: [], movers: [], balls: [], prizes: [], bolts: [], shots: [], beams: [], blasts: [], boss: null,
      paddle: { x: K.W / 2, size: 1, w: K.PADW[1], vx: 0, stun: 0, cool: 0, tx: null },
      fx: { L: 0, C: 0, F: 0, W: 0, Q: 0, H: 0 }, keysLeft: 0, reqLeft: 0, rows: null, base: 300, cap: 540,
      stats: { broken: 0, paddleHits: 0, nudges: 0, lost: 0, prizes: 0, zaps: 0, maxSpeed: 0 }
    };
    var inp = { ptr: null, dir: 0, fire: false };
    var noPrizes = !!opts.noPrizes, prizeMul = opts.prizeMul == null ? 1 : opts.prizeMul;

    // ----- уровни -----
    function levelRows(n) {
      if (opts.rowsFor) return opts.rowsFor(n);
      if (S.mode === 'endless') return R.genLevel(n, rng);
      var L = R.LEVELS[n - 1]; return L ? L.rows : R.LEVELS[0].rows;
    }
    function loadLevel(n) {
      S.level = n; S.levelTime = 0;
      var rows = levelRows(n), def = S.mode === 'campaign' && !opts.rowsFor ? R.LEVELS[n - 1] : null;
      S.rows = rows; S.bricks = []; S.grid = new Array(K.COLS * K.ROWS).fill(null); S.movers = [];
      S.prizes = []; S.bolts = []; S.shots = []; S.beams = []; S.blasts = []; S.boss = null;
      S.keysLeft = 0;
      for (var r = 0; r < rows.length && r < K.ROWS; r++) for (var c = 0; c < K.COLS; c++) {
        var t = cellType(rows[r][c]); if (!t) continue;
        var b = { c: c, r: r, x: K.BX0 + c * K.BW, y: K.BY0 + r * K.BH, w: K.BW, h: K.BH, type: t.type, hp: t.hp, maxHp: t.hp, color: t.color || null,
          alive: true, req: t.type !== 'u' && t.type !== 'g', regenT: 0, flash: 0, vx: 0 };
        if (t.type === 'k') S.keysLeft++;
        S.bricks.push(b);
        if (t.type === 'm') { b.vx = (c % 2 ? -1 : 1) * (70 + Math.min(60, n * 2)); S.movers.push(b); }
        else S.grid[r * K.COLS + c] = b;
      }
      var bk = def && def.boss ? def.boss : (S.mode === 'endless' && opts.endlessBoss && n % 10 === 0 ? 1 + (n / 10 - 1) % 3 : 0);
      if (bk) {
        var B = BOSSES[bk];
        S.boss = { kind: bk, x: K.W / 2 - B.w / 2, y: B.y, w: B.w, h: B.h, hp: B.hp, maxHp: B.hp, vx: B.v, fireT: 2.2, inv: 0, t: 0, beamT: 5, dead: false, deadT: 0 };
      }
      var lv = S.mode === 'endless' ? n * 1.4 : n;
      S.base = 290 + Math.min(70, lv * 2.4); S.cap = 520 + Math.min(110, lv * 4);
      countReq();
      resetBall();
      emit('level', { level: n, boss: S.boss ? S.boss.kind : 0 });
    }
    function countReq() { var n = 0; for (var i = 0; i < S.bricks.length; i++) { var b = S.bricks[i]; if (b.req && b.alive) n++; } S.reqLeft = n; return n; }
    function resetBall() {
      var P = S.paddle; P.size = 1; P.w = K.PADW[1]; P.stun = 0;
      for (var k in S.fx) S.fx[k] = 0;
      S.balls = [newBall(P.x, K.PY - K.BR - 0.5, 0, 0)];
      S.balls[0].stuck = (rng() - 0.5) * 16; S.balls[0].stuckT = 0; S.balls[0].first = true;
      S.prizes = []; S.bolts = []; S.shots = []; S.beams = [];
    }
    function newBall(x, y, vx, vy) { return { x: x, y: y, vx: vx, vy: vy, t: 0, stuck: null, stuckT: 0, bounces: 0, prog: S.time, trail: [] }; }

    // ----- скорость -----
    function factor() { return S.fx.W > 0 ? 0.7 : S.fx.Q > 0 ? 1.3 : 1; }
    function speedOf(b) { return Math.min(S.cap, S.base + K.ACC * b.t) * factor(); }
    function setSpeed(b, s) { var l = Math.hypot(b.vx, b.vy); if (l < 1e-9) { b.vx = 0; b.vy = -s; return; } b.vx *= s / l; b.vy *= s / l; }
    function antiFlat(b) {   // не даём шару лететь почти горизонтально (горизонтальные петли)
      var s = Math.hypot(b.vx, b.vy); if (s < 1e-9) return;
      if (Math.abs(b.vy) < K.MIN_SIN * s) { var sy = b.vy < 0 ? -1 : b.vy > 0 ? 1 : -1; b.vy = sy * K.MIN_SIN * s; b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(s * s - b.vy * b.vy); }
    }
    function rotate(b, a) { var c = Math.cos(a), s = Math.sin(a), x = b.vx * c - b.vy * s, y = b.vx * s + b.vy * c; b.vx = x; b.vy = y; }
    function progress(b) { b.bounces = 0; b.prog = S.time; }
    function noProgressBounce(b) {
      b.bounces++;
      if (b.bounces >= K.NUDGE_BOUNCES || S.time - b.prog > K.NUDGE_TIME) {
        var a = (10 + rng() * 15) * Math.PI / 180 * (rng() < 0.5 ? -1 : 1);
        rotate(b, a); antiFlat(b); b.bounces = 0; b.prog = S.time; S.stats.nudges++; emit('nudge', {});
      }
    }

    // ----- блоки -----
    function award(p) { S.score += p; }
    function rollPrize(b) {
      if (noPrizes) return;
      var p = (S.boss ? 0.2 : 0.13) * prizeMul; if (rng() >= p) return;
      var tot = 0, i; for (i = 0; i < PRIZES.length; i++) tot += PRIZES[i].w;
      var q = rng() * tot;
      for (i = 0; i < PRIZES.length; i++) { q -= PRIZES[i].w; if (q < 0) break; }
      var pr = PRIZES[Math.min(i, PRIZES.length - 1)];
      S.prizes.push({ k: pr.k, bad: !!pr.bad, x: b.x + b.w / 2, y: b.y + b.h / 2, t: 0 });
    }
    function damage(b, amt, src) {
      if (!b.alive) return false;
      if (b.type === 'u' || b.type === 'g') { b.flash = 0.15; emit('clank', { x: b.x + b.w / 2, y: b.y + b.h / 2 }); return false; }
      b.hp -= amt; b.flash = 0.12;
      if (b.hp > 0) { emit('hit', { x: b.x + b.w / 2, y: b.y + b.h / 2, hp: b.hp, type: b.type }); return false; }
      destroy(b, src); return true;
    }
    function destroy(b, src) {
      b.alive = false; b.hp = 0; S.stats.broken++;
      var pts = b.type === 'n' ? PTS.normal : b.type === 's' ? PTS.strong * b.maxHp : b.type === 'x' ? PTS.boom : b.type === 'm' ? PTS.mover : b.type === 'r' ? PTS.regen : PTS.key;
      award(pts);
      var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      emit('break', { x: cx, y: cy, type: b.type, color: b.color, pts: pts, src: src });
      if (b.type === 'r') b.regenT = K.REGEN_T;
      if (b.type === 'x') S.blasts.push({ c: b.c, r: b.r, x: cx, y: cy, t: 0.07 });
      if (b.type === 'k') { S.keysLeft--; if (S.keysLeft <= 0) openGates(); }
      if (src !== 'blast' || rng() < 0.5) rollPrize(b);
      countReq();
    }
    function openGates() {
      for (var i = 0; i < S.bricks.length; i++) { var b = S.bricks[i]; if (b.type === 'g' && b.alive) { b.alive = false; S.grid[b.r * K.COLS + b.c] = S.grid[b.r * K.COLS + b.c] === b ? null : S.grid[b.r * K.COLS + b.c]; } }
      emit('gates', {});
    }
    function blast(bl) {
      emit('boom', { x: bl.x, y: bl.y });
      for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        var r = bl.r + dr, c = bl.c + dc; if (r < 0 || c < 0 || r >= K.ROWS || c >= K.COLS) continue;
        var b = S.grid[r * K.COLS + c]; if (b && b.alive && b.type !== 'u' && b.type !== 'g') destroy(b, 'blast');
      }
      // движущиеся блоки рядом со взрывом
      for (var i = 0; i < S.movers.length; i++) { var m = S.movers[i]; if (m.alive && Math.abs(m.x + m.w / 2 - bl.x) < K.BW * 1.6 && Math.abs(m.y + m.h / 2 - bl.y) < K.BH * 1.6) destroy(m, 'blast'); }
      if (S.boss && !S.boss.dead && Math.abs(S.boss.x + S.boss.w / 2 - bl.x) < S.boss.w / 2 + K.BW && Math.abs(S.boss.y + S.boss.h / 2 - bl.y) < S.boss.h / 2 + K.BH) hitBoss(2);
    }
    function nonRegenReqAlive() { for (var i = 0; i < S.bricks.length; i++) { var b = S.bricks[i]; if (b.alive && b.req && b.type !== 'r') return true; } return false; }
    function regen(dt) {
      var other = nonRegenReqAlive();
      for (var i = 0; i < S.bricks.length; i++) {
        var b = S.bricks[i]; if (b.type !== 'r' || b.alive) continue;
        if (!other) { b.regenT = 0; continue; }
        if (b.regenT > 0) { b.regenT -= dt; if (b.regenT > 0) continue; }
        var blocked = S.balls.some(function (q) { return overlap(q.x, q.y, K.BR + 2, b.x, b.y, b.x + b.w, b.y + b.h); });
        if (blocked) { b.regenT = 0.3; continue; }
        b.alive = true; b.hp = b.maxHp; b.flash = 0.3; emit('regrow', { x: b.x + b.w / 2, y: b.y + b.h / 2 }); countReq();
      }
    }
    function moveMovers(dt) {
      for (var i = 0; i < S.movers.length; i++) {
        var m = S.movers[i]; if (!m.alive) continue;
        var nx = m.x + m.vx * dt, hit = nx < K.FX0 || nx + m.w > K.FX1;
        if (!hit) {
          var c0 = Math.floor((nx - K.BX0) / K.BW), c1 = Math.floor((nx + m.w - 0.01 - K.BX0) / K.BW);
          for (var c = c0; c <= c1 && !hit; c++) { var g = c >= 0 && c < K.COLS ? S.grid[m.r * K.COLS + c] : null; if (g && g.alive) hit = true; }
          for (var j = 0; j < S.movers.length && !hit; j++) { var o = S.movers[j]; if (o !== m && o.alive && o.r === m.r && nx < o.x + o.w && nx + m.w > o.x) hit = true; }
        }
        if (hit) m.vx = -m.vx; else m.x = nx;
      }
    }

    // ----- босс -----
    function hitBoss(dmg) {
      var B = S.boss; if (!B || B.dead || B.inv > 0) return;
      B.hp -= dmg; B.inv = 0.18; award(PTS.bossHit); emit('bossHit', { hp: B.hp, x: B.x + B.w / 2, y: B.y + B.h / 2 });
      if (B.hp <= 0) { B.hp = 0; B.dead = true; B.deadT = 0; award(PTS.boss); S.shots = []; S.beams = []; emit('bossDie', { x: B.x + B.w / 2, y: B.y + B.h / 2 }); }
    }
    function bossUpdate(dt) {
      var B = S.boss; if (!B) return;
      if (B.dead) { B.deadT += dt; return; }
      B.t += dt; if (B.inv > 0) B.inv -= dt;
      var rage = B.hp <= B.maxHp / 2 ? 1.35 : 1;
      B.x += B.vx * rage * dt;
      if (B.x < K.FX0 + 4) { B.x = K.FX0 + 4; B.vx = Math.abs(B.vx); } if (B.x + B.w > K.FX1 - 4) { B.x = K.FX1 - 4 - B.w; B.vx = -Math.abs(B.vx); }
      if (B.kind === 2) B.y = BOSSES[2].y + Math.sin(B.t * 1.3) * 10;
      var P = S.paddle, cx = B.x + B.w / 2, cy = B.y + B.h;
      B.fireT -= dt * rage;
      if (B.fireT <= 0) {
        B.fireT = BOSSES[B.kind].fire * (0.85 + rng() * 0.3);
        var ax = P.x - cx, ay = K.PY - cy, al = Math.hypot(ax, ay) || 1;
        if (B.kind === 1) shoot(cx, cy, ax / al * 210, ay / al * 210);
        else if (B.kind === 2) { var a0 = Math.atan2(ay, ax); for (var k = -1; k <= 1; k++) shoot(cx, cy, Math.cos(a0 + k * 0.32) * 190, Math.sin(a0 + k * 0.32) * 190); }
        else { shoot(B.x + 24, cy, (P.x - B.x - 24) / al * 230, ay / al * 230); shoot(B.x + B.w - 24, cy, (P.x - B.x - B.w + 24) / al * 230, ay / al * 230); }
        emit('shot', { kind: B.kind });
      }
      if (B.kind === 3) {
        B.beamT -= dt * rage;
        if (B.beamT <= 0) { B.beamT = 6 + rng() * 2; S.beams.push({ x: clamp(P.x, K.FX0 + 12, K.FX1 - 12), warn: 0.95, on: 0.55, w: 20, hit: false }); emit('beamWarn', {}); }
      }
    }
    function shoot(x, y, vx, vy) { S.shots.push({ x: x, y: y, vx: vx, vy: vy, r: 5 }); }
    function zap() {
      var P = S.paddle; if (P.stun > 0) return;
      P.stun = 0.7; P.size = Math.max(0, P.size - 1); P.w = K.PADW[P.size]; S.stats.zaps++; emit('zap', { x: P.x });
    }
    function shotsUpdate(dt) {
      var P = S.paddle, x0 = P.x - P.w / 2, x1 = P.x + P.w / 2;
      S.shots = S.shots.filter(function (s) {
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.x < K.FX0 + s.r) { s.x = K.FX0 + s.r; s.vx = Math.abs(s.vx); } if (s.x > K.FX1 - s.r) { s.x = K.FX1 - s.r; s.vx = -Math.abs(s.vx); }
        if (overlap(s.x, s.y, s.r, x0, K.PY, x1, K.PY + K.PH)) { zap(); return false; }
        return s.y < K.H + 10;
      });
      S.beams = S.beams.filter(function (bm) {
        if (bm.warn > 0) { bm.warn -= dt; if (bm.warn <= 0) emit('beam', {}); return true; }
        bm.on -= dt;
        if (!bm.hit && Math.abs(P.x - bm.x) < P.w / 2 + bm.w / 2) { bm.hit = true; zap(); }
        return bm.on > 0;
      });
    }

    // ----- ракетка -----
    function paddleUpdate(dt) {
      var P = S.paddle, x0 = P.x;
      if (P.stun > 0) P.stun -= dt;
      else if (inp.ptr != null) {
        var d = inp.ptr - P.x, m = K.PAD_PTR_V * dt;
        P.x += clamp(d, -m, m);
      } else if (inp.dir) P.x += inp.dir * K.PAD_KEY_V * dt;
      P.x = clamp(P.x, K.FX0 + P.w / 2, K.FX1 - P.w / 2);
      var v = (P.x - x0) / dt; P.vx = P.vx * 0.6 + v * 0.4;
      // шар/шары, в которые ракетка въехала боком — вытолкнуть
      for (var i = 0; i < S.balls.length; i++) {
        var b = S.balls[i]; if (b.stuck != null) continue;
        var o = overlap(b.x, b.y, K.BR, P.x - P.w / 2, K.PY, P.x + P.w / 2, K.PY + K.PH);
        if (!o) continue;
        if (b.y <= K.PY + 2 && b.vy > 0) { b.y = K.PY - K.BR - 0.01; paddleBounce(b); }
        else { b.x += o.x * (o.d + 0.01); b.y += o.y * (o.d + 0.01); if (o.x * b.vx < 0) b.vx = -b.vx; }
      }
      if (P.cool > 0) P.cool -= dt;
      if (S.fx.L > 0 && inp.fire && P.cool <= 0 && S.phase === 'play') fireLaser();
    }
    function paddleBounce(b) {
      var P = S.paddle, s = speedOf(b);
      var off = clamp((b.x - P.x) / (P.w / 2), -1, 1), ang = off * K.MAX_PAD_ANG;
      var spin = clamp(P.vx * 0.12, -0.3 * s, 0.3 * s);
      b.vx = s * Math.sin(ang) + spin; b.vy = -s * Math.cos(ang);
      setSpeed(b, s);
      if (-b.vy < K.MAX_ANG_COS * s) { b.vy = -K.MAX_ANG_COS * s; b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(s * s - b.vy * b.vy); }
      progress(b); S.stats.paddleHits++;
      if (S.fx.C > 0) { b.stuck = b.x - P.x; b.stuckT = 0; b.y = K.PY - K.BR - 0.5; emit('stick', {}); }
      emit('paddle', { off: off, x: b.x });
    }
    function launch(b) {
      var P = S.paddle, s = speedOf(b), off = clamp(b.stuck / (P.w / 2), -1, 1);
      if (Math.abs(off) < 0.15) off = (P.vx > 20 ? 1 : P.vx < -20 ? -1 : (rng() < 0.5 ? -1 : 1)) * (0.2 + rng() * 0.15);
      var ang = off * K.MAX_PAD_ANG * 0.8;
      b.vx = s * Math.sin(ang); b.vy = -s * Math.cos(ang); b.stuck = null; b.first = false; progress(b);
      emit('launch', {});
    }
    function fireLaser() {
      var P = S.paddle; P.cool = K.LASER_CD;
      S.bolts.push({ x: P.x - P.w / 2 + 7, y: K.PY - 2 }); S.bolts.push({ x: P.x + P.w / 2 - 7, y: K.PY - 2 });
      emit('laser', {});
    }
    function boltsUpdate(dt) {
      S.bolts = S.bolts.filter(function (z) {
        var dist = K.LASER_V * dt, steps = Math.ceil(dist / 6);
        for (var i = 0; i < steps; i++) {
          z.y -= dist / steps;
          if (z.y < K.FY0) return false;
          var c = Math.floor((z.x - K.BX0) / K.BW), r = Math.floor((z.y - K.BY0) / K.BH);
          if (c >= 0 && c < K.COLS && r >= 0 && r < K.ROWS) { var b = S.grid[r * K.COLS + c]; if (b && b.alive) { damage(b, 1, 'laser'); return false; } }
          for (var j = 0; j < S.movers.length; j++) { var m = S.movers[j]; if (m.alive && z.x >= m.x && z.x <= m.x + m.w && z.y >= m.y && z.y <= m.y + m.h) { damage(m, 1, 'laser'); return false; } }
          var B = S.boss; if (B && !B.dead && z.x >= B.x && z.x <= B.x + B.w && z.y >= B.y && z.y <= B.y + B.h) { if (B.inv <= 0) hitBoss(1); return false; }
        }
        return true;
      });
    }

    // ----- шар (CCD) -----
    function moveBall(b, dt) {
      var rem = dt, guard = 0, r = K.BR, P = S.paddle, skip = null;
      // въехавшие в шар движущиеся блоки/босс — вытолкнуть
      var pushers = S.movers.filter(function (m) { return m.alive; });
      if (S.boss && !S.boss.dead) pushers.push(S.boss);
      for (var pi = 0; pi < pushers.length; pi++) {
        var q = pushers[pi], o = overlap(b.x, b.y, r, q.x, q.y, q.x + q.w, q.y + q.h);
        if (o) { b.x += o.x * (o.d + 0.01); b.y += o.y * (o.d + 0.01); var vn = b.vx * o.x + b.vy * o.y; if (vn < 0) { b.vx -= 2 * vn * o.x; b.vy -= 2 * vn * o.y; } hitObj(b, q === S.boss ? { kind: 'boss' } : { kind: 'brick', b: q }, true); }
      }
      while (rem > 1e-9 && guard++ < 10) {
        var dx = b.vx * rem, dy = b.vy * rem, best = null, t;
        function cand(h, info) { if (h && (!best || h.t < best.t)) { best = h; best.info = info; } }
        if (dx < 0) { t = (K.FX0 + r - b.x) / dx; if (t >= 0 && t <= 1) cand({ t: t, nx: 1, ny: 0 }, { kind: 'wall' }); }
        if (dx > 0) { t = (K.FX1 - r - b.x) / dx; if (t >= 0 && t <= 1) cand({ t: t, nx: -1, ny: 0 }, { kind: 'wall' }); }
        if (dy < 0) { t = (K.FY0 + r - b.y) / dy; if (t >= 0 && t <= 1) cand({ t: t, nx: 0, ny: 1 }, { kind: 'wall' }); }
        if (dy > 0 && S.fx.H > 0) { t = (K.BAR_Y - r - b.y) / dy; if (t >= 0 && t <= 1) cand({ t: t, nx: 0, ny: -1 }, { kind: 'barrier' }); }
        if (dy > 0) cand(sweepRect(b.x, b.y, dx, dy, P.x - P.w / 2, K.PY, P.x + P.w / 2, K.PY + K.PH, r), { kind: 'paddle' });
        // блоки сетки: только клетки в рамке пути
        var xa = Math.min(b.x, b.x + dx) - r, xb = Math.max(b.x, b.x + dx) + r, ya = Math.min(b.y, b.y + dy) - r, yb = Math.max(b.y, b.y + dy) + r;
        var c0 = Math.max(0, Math.floor((xa - K.BX0) / K.BW)), c1 = Math.min(K.COLS - 1, Math.floor((xb - K.BX0) / K.BW));
        var r0 = Math.max(0, Math.floor((ya - K.BY0) / K.BH)), r1 = Math.min(K.ROWS - 1, Math.floor((yb - K.BY0) / K.BH));
        for (var rr = r0; rr <= r1; rr++) for (var cc = c0; cc <= c1; cc++) {
          var bk = S.grid[rr * K.COLS + cc]; if (!bk || !bk.alive || bk === skip) continue;
          cand(sweepRect(b.x, b.y, dx, dy, bk.x, bk.y, bk.x + bk.w, bk.y + bk.h, r), { kind: 'brick', b: bk });
        }
        for (var mi = 0; mi < S.movers.length; mi++) { var m = S.movers[mi]; if (m.alive && m !== skip) cand(sweepRect(b.x, b.y, dx, dy, m.x, m.y, m.x + m.w, m.y + m.h, r), { kind: 'brick', b: m }); }
        if (S.boss && !S.boss.dead) { var B = S.boss; cand(sweepRect(b.x, b.y, dx, dy, B.x, B.y, B.x + B.w, B.y + B.h, r), { kind: 'boss' }); }
        if (!best) { b.x += dx; b.y += dy; break; }
        b.x += dx * best.t; b.y += dy * best.t;
        rem *= (1 - best.t);
        var info = best.info, through = info.kind === 'brick' && S.fx.F > 0 && info.b.type !== 'u' && info.b.type !== 'g';
        if (through) { damage(info.b, 99, 'fire'); progress(b); skip = info.b; continue; }
        b.x += best.nx * 0.01; b.y += best.ny * 0.01;
        if (info.kind === 'paddle' && best.ny < -0.3) { paddleBounce(b); if (b.stuck != null) return; continue; }
        var vn = b.vx * best.nx + b.vy * best.ny;
        if (vn < 0) { b.vx -= 2 * vn * best.nx; b.vy -= 2 * vn * best.ny; }
        hitObj(b, info, false);
        antiFlat(b);
      }
      // страховка: шар не должен оставаться внутри живого блока (например, после регенерации)
      var cb = Math.floor((b.x - K.BX0) / K.BW), rb = Math.floor((b.y - K.BY0) / K.BH);
      if (cb >= 0 && cb < K.COLS && rb >= 0 && rb < K.ROWS) { var g = S.grid[rb * K.COLS + cb]; if (g && g.alive && b.x > g.x && b.x < g.x + g.w && b.y > g.y && b.y < g.y + g.h) { var o2 = overlap(b.x, b.y, r, g.x, g.y, g.x + g.w, g.y + g.h); if (o2) { b.x += o2.x * (o2.d + 0.01); b.y += o2.y * (o2.d + 0.01); } } }
      b.x = clamp(b.x, K.FX0 + r, K.FX1 - r); if (b.y < K.FY0 + r) b.y = K.FY0 + r;
    }
    function hitObj(b, info, pushed) {
      if (info.kind === 'wall' || info.kind === 'barrier') { emit(info.kind, { x: b.x, y: b.y }); noProgressBounce(b); return; }
      if (info.kind === 'paddle') { emit('wall', {}); noProgressBounce(b); return; }   // удар в бок ракетки
      if (info.kind === 'boss') { hitBoss(1); progress(b); return; }
      var bk = info.b, wasBreakable = bk.type !== 'u' && bk.type !== 'g';
      damage(bk, 1, pushed ? 'push' : 'ball');
      if (wasBreakable) progress(b); else noProgressBounce(b);
    }

    // ----- призы -----
    function prizesUpdate(dt) {
      var P = S.paddle, x0 = P.x - P.w / 2, x1 = P.x + P.w / 2;
      S.prizes = S.prizes.filter(function (p) {
        p.y += K.CAP_V * dt; p.t += dt;
        if (p.y + K.CAP_H / 2 >= K.PY && p.y - K.CAP_H / 2 <= K.PY + K.PH && p.x + K.CAP_W / 2 >= x0 && p.x - K.CAP_W / 2 <= x1) { apply(p.k); return false; }
        return p.y < K.H + 10;
      });
    }
    function apply(k) {
      var P = S.paddle; S.stats.prizes++; award(PTS.prize);
      switch (k) {
        case 'E': P.size = Math.min(3, P.size + 1); P.w = K.PADW[P.size]; break;
        case 'S': P.size = Math.max(0, P.size - 1); P.w = K.PADW[P.size]; break;
        case 'B': {
          var add = [];
          S.balls.forEach(function (b) {
            if (S.balls.length + add.length >= K.MAXBALLS) return;
            if (b.stuck != null) launch(b);
            [-0.42, 0.42].forEach(function (a) { if (S.balls.length + add.length >= K.MAXBALLS) return; var n = newBall(b.x, b.y, b.vx, b.vy); n.t = b.t; rotate(n, a); antiFlat(n); add.push(n); });
          });
          S.balls = S.balls.concat(add); break;
        }
        case '+': S.lives = Math.min(K.MAXLIVES, S.lives + 1); break;
        case 'W': S.fx.Q = 0; S.fx.W = DUR.W; break;
        case 'Q': S.fx.W = 0; S.fx.Q = DUR.Q; break;
        default: S.fx[k] = DUR[k];
      }
      if (k === 'C') { /* липкая — шары ловятся при следующем касании */ }
      emit('catch', { k: k, bad: k === 'S' || k === 'Q' });
    }

    // ----- шаг -----
    function step(dt) {
      S.time += dt;
      if (S.phase === 'lost') { S.phaseT -= dt; paddleUpdate(dt); if (S.phaseT <= 0) { S.phase = 'play'; resetBall(); emit('respawn', {}); } return; }
      if (S.phase === 'clear') { S.phaseT -= dt; if (S.phaseT <= 0) nextLevel(); return; }
      if (S.phase !== 'play') return;
      S.levelTime += dt;
      paddleUpdate(dt); moveMovers(dt); bossUpdate(dt); shotsUpdate(dt);
      var P = S.paddle;
      for (var i = 0; i < S.balls.length; i++) {
        var b = S.balls[i];
        if (b.stuck != null) {
          b.stuck = clamp(b.stuck, -P.w / 2 + 2, P.w / 2 - 2); b.x = P.x + b.stuck; b.y = K.PY - K.BR - 0.5; b.stuckT += dt;
          if (opts.autoLaunch !== false && b.stuckT > (b.first ? 4 : 2.5)) launch(b);
          continue;
        }
        b.t += dt; setSpeed(b, speedOf(b)); S.stats.maxSpeed = Math.max(S.stats.maxSpeed, speedOf(b));
        moveBall(b, dt);
      }
      S.balls = S.balls.filter(function (b) { return b.y < K.LOSE_Y; });
      boltsUpdate(dt); prizesUpdate(dt);
      for (var j = 0; j < S.blasts.length; j++) S.blasts[j].t -= dt;
      var due = S.blasts.filter(function (q) { return q.t <= 0; }); S.blasts = S.blasts.filter(function (q) { return q.t > 0; });
      due.forEach(blast);
      regen(dt);
      for (var k in S.fx) if (S.fx[k] > 0) S.fx[k] = Math.max(0, S.fx[k] - dt);
      for (var q = 0; q < S.bricks.length; q++) if (S.bricks[q].flash > 0) S.bricks[q].flash -= dt;
      if (!S.balls.length) { loseLife(); return; }
      var done = S.boss ? (S.boss.dead && S.boss.deadT > 1.2) : (S.reqLeft === 0 && !S.blasts.length);
      if (done) clearLevel();
    }
    function loseLife() {
      S.lives--; S.stats.lost++;
      if (S.lives <= 0) { S.lives = 0; S.phase = 'over'; S.over = true; emit('gameover', { score: S.score }); return; }
      S.phase = 'lost'; S.phaseT = 1.1; emit('lose', { lives: S.lives });
    }
    function clearLevel() {
      var bonus = PTS.clear + 100 * S.level; award(bonus);
      S.phase = 'clear'; S.phaseT = 1.8; S.balls = []; S.prizes = []; S.shots = []; S.beams = []; S.bolts = [];
      emit('clear', { level: S.level, bonus: bonus });
      if (S.mode === 'campaign' && S.level >= R.LEVELS.length && !opts.rowsFor) { S.phase = 'won'; S.won = true; award(2000 * S.lives); emit('win', { score: S.score }); }
    }
    function nextLevel() { S.phase = 'play'; loadLevel(S.level + 1); }

    var api = {
      start: function () { loadLevel(S.level); return api; },
      update: function (dt) {   // фиксированный внутренний шаг 1/120 с
        S._acc = (S._acc || 0) + Math.min(dt, 0.1);
        while (S._acc >= K.STEP - 1e-9) { S._acc -= K.STEP; step(K.STEP); }
      },
      tick: step,
      setPointer: function (x) { inp.ptr = x == null ? null : clamp(x, 0, K.W); },
      setDir: function (d) { inp.dir = d; if (d) inp.ptr = null; },
      setFire: function (f) { inp.fire = !!f; },
      action: function () {
        if (S.phase !== 'play') return false;
        var any = false;
        S.balls.forEach(function (b) { if (b.stuck != null) { launch(b); any = true; } });
        if (!any && S.fx.L > 0 && S.paddle.cool <= 0) { fireLaser(); any = true; }
        return any;
      },
      state: function () { return S; },
      // тестовые хуки
      _apply: apply, _damage: damage, _ball: function (x, y, vx, vy) { var b = newBall(x, y, vx, vy); S.balls.push(b); return b; },
      _moveBall: moveBall, _paddleBounce: paddleBounce, _load: loadLevel, _hitBoss: hitBoss, _zap: zap
    };
    return api;
  }

  R.logic = { K: K, PTS: PTS, PRIZES: PRIZES, DUR: DUR, BOSSES: BOSSES, NORMAL: NORMAL, mulberry32: mulberry32, sweepRect: sweepRect, overlap: overlap, reach: reach, cellType: cellType };
  R.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
