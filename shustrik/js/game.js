/* ШУСТРИК · game.js — логика без DOM (детерминирована при заданном rng).
   Физика бега по склонам с тремя ступенями скорости (чем дольше бежишь — тем быстрее; на 3-й разбиваются ящики),
   пружины, трубы-ускорители, рельсы-скольжения, паровые шахты; стрельба на бегу вперёд и по диагонали вверх
   (дробь, «очередь», «разрывной», «прыгучий»), временные бонусы (щит, ускорение, магнит), враги, боссы, шестерни,
   тайники, жетон бонус-этапа, чекпойнты. Единицы — пиксели и секунды; hero.y — уровень подошв.
   Шаг — 1/60 с, внутри — подшаги не длиннее K.STEP = 4 px: на любой скорости герой не проскакивает сквозь тайлы. */
(function (global) {
  'use strict';
  var SH = global.SHUSTRIK = global.SHUSTRIK || {};
  var LVL = SH.levels, T = LVL.T, C = LVL.C;
  var K = { G: 1400, JUMP: 500, CUT: 260, ACC: 420, AIRACC: 380, DEC: 1600, FRIC: 420, DRAG: 260, MAXG: 760, SLOPE: 560, MAXFALL: 900,
    HW: 6, HH: 24, SPRING: 950, PIPE: 700, STEAM: 430, STEAMACC: 2600, RAILMIN: 250, RAILACC: 220, STEP: 4,
    TIER_T: 1.0, SMASH: 400, TURBO: 560, HP: 3, LIVES: 3, MAXLIVES: 9, INV: 1.5,
    SHIELD_T: 20, TURBO_T: 10, MAGNET_T: 15, MAGNET_R: 130 };
  var TOPS = [230, 340, 470];      // предел скорости на ступенях 1/2/3
  // оружие: 0 — паровая дробь, 1 — очередь, 2 — разрывной, 3 — прыгучий
  var WPN = [
    { key: 'base', sp: 640, cd: 0.24, dmg: 1, life: 0.7 },
    { key: 'burst', sp: 720, cd: 0.085, dmg: 1, life: 0.55 },
    { key: 'blast', sp: 520, cd: 0.42, dmg: 2, life: 0.9, boom: 46 },
    { key: 'bounce', sp: 560, cd: 0.2, dmg: 1, life: 1.7, g: 1000, hops: 4 }
  ];
  var WIDX = { burst: 1, blast: 2, bounce: 3 };
  var EN = { beetle: { hp: 1, w: 24, h: 14, pts: 100 }, roller: { hp: 2, w: 22, h: 22, pts: 150 }, wasp: { hp: 1, w: 22, h: 18, pts: 120 }, cannon: { hp: 3, w: 26, h: 26, pts: 250 } };
  var BOSS = { fox: { hp: 16, w: 30, h: 40 }, ram: { hp: 22, w: 72, h: 46 }, cuckoo: { hp: 24, w: 56, h: 52 }, armor: { hp: 32, w: 36, h: 46 } };

  // ---------- рельеф ----------
  function hAt(c, lx) {
    switch (c) {
      case C.S: case C.SP: case C.X: return 16;
      case C.U45: return lx; case C.D45: return 16 - lx;
      case C.UA: return lx / 2; case C.UB: return 8 + lx / 2;
      case C.DC: return 16 - lx / 2; case C.DD: return 8 - lx / 2;
      default: return 0;
    }
  }
  function tile(LV, cx, cy) { if (cx < 0 || cx >= LV.w) return C.S; if (cy < 0 || cy >= LV.h) return C.E; return LV.t[cy * LV.w + cx]; }
  function solidCode(c) { return c !== C.E && c !== C.P && c !== C.F && c !== C.H; }
  function solidAt(LV, x, y) {
    var cx = Math.floor(x / T), cy = Math.floor(y / T), c = tile(LV, cx, cy);
    if (!solidCode(c)) return false;
    return y >= (cy + 1) * T - hAt(c, x - cx * T);
  }
  // верхняя поверхность опоры в столбце x в диапазоне [y0, y1]; plat — с какой высоты принимать мостки (null — не принимать)
  function floorY(LV, x, y0, y1, plat) {
    var cx = Math.floor(x / T), lx = x - cx * T, r0 = Math.floor(y0 / T), r1 = Math.floor(y1 / T);
    for (var r = r0; r <= r1; r++) {
      var c = tile(LV, cx, r);
      if (c === C.P) { if (plat != null) { var sp = r * T; if (sp >= y0 && sp <= y1 && sp >= plat) return sp; } continue; }
      if (!solidCode(c)) continue;
      var h = hAt(c, lx); if (h <= 0) continue;
      if (h >= 16) { var ca = tile(LV, cx, r - 1); if (solidCode(ca) && hAt(ca, lx) > 0) continue; }
      var s = (r + 1) * T - h;
      if (s >= y0 - 0.001 && s <= y1) return s;
    }
    return null;
  }
  function angleAt(LV, x, y) {
    var a = floorY(LV, x - 4, y - 10, y + 10, y - 10), b = floorY(LV, x + 4, y - 10, y + 10, y - 10);
    if (a == null || b == null) return 0;
    return Math.atan2(a - b, 8);
  }
  function hazardAt(LV, x, y) { return tile(LV, Math.floor(x / T), Math.floor(y / T)) === C.SP; }
  function inSteam(LV, x, y) { for (var i = 0; i < LV.steam.length; i++) { var s = LV.steam[i]; if (x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1) return s; } return null; }
  // ящик на пути: разбить весь столбик ящиков (только на 3-й скорости)
  function smash(LV, x, y, ev) {
    var cx = Math.floor(x / T), cy = Math.floor(y / T);
    if (tile(LV, cx, cy) !== C.X) return false;
    var r = cy; while (tile(LV, cx, r - 1) === C.X) r--;
    var n = 0; while (tile(LV, cx, r) === C.X) { LV.t[r * LV.w + cx] = C.E; r++; n++; }
    ev('crate', { x: cx * T + 8, y: r * T - n * 8, n: n });
    return true;
  }

  // ---------- рельсы и трубы ----------
  function railSeg(rl, x) { var p = rl.pts; for (var i = 1; i < p.length; i++) if (x <= p[i][0] || i === p.length - 1) return i; return 1; }
  function pipeLen(pp) { if (pp.len) return pp.len; var l = 0, a = pp.pts; pp.seg = []; for (var i = 1; i < a.length; i++) { var d = Math.hypot(a[i][0] - a[i - 1][0], a[i][1] - a[i - 1][1]); pp.seg.push(d); l += d; } pp.len = l; return l; }
  function pipeAt(pp, s) {
    pipeLen(pp); var a = pp.pts;
    for (var i = 0; i < pp.seg.length; i++) { if (s <= pp.seg[i] || i === pp.seg.length - 1) { var f = Math.min(1, s / pp.seg[i]); return { x: a[i][0] + (a[i + 1][0] - a[i][0]) * f, y: a[i][1] + (a[i + 1][1] - a[i][1]) * f, dx: (a[i + 1][0] - a[i][0]) / pp.seg[i], dy: (a[i + 1][1] - a[i][1]) / pp.seg[i] }; } s -= pp.seg[i]; }
  }

  // ---------- герой ----------
  function newHero(x, y) {
    return { x: x, y: y, vx: 0, vy: 0, gsp: 0, ang: 0, ground: true, face: 1, jumped: false, coy: 0, jbuf: 0,
      mode: 'run', pipe: null, ps: 0, pv: 0, rail: null, rv: 0, railCd: 0, rot: 0, runT: 0, tier: 0, tierT: 0, turbo: 0, steam: false, sim: false };
  }
  function speedOf(P) { return P.mode === 'rail' ? P.rv : P.ground ? P.gsp * Math.cos(P.ang) : P.vx; }
  function tierFor(v) { v = Math.abs(v); return v > TOPS[1] + 20 ? 2 : v > TOPS[0] + 20 ? 1 : 0; }
  function land(LV, P, ev) {
    P.ground = true; P.ang = angleAt(LV, P.x, P.y);
    P.gsp = P.vx * Math.cos(P.ang) - P.vy * Math.sin(P.ang);
    if (Math.abs(P.gsp) > K.MAXG) P.gsp = Math.sign(P.gsp) * K.MAXG;
    var v = P.vy; P.vy = 0; P.jumped = false;
    ev('land', { v: v });
  }
  function canSmash(P, v) { return !P.sim && P.tier === 2 && Math.abs(v) >= K.SMASH; }
  function groundSub(LV, P, dt, ev) {
    var ca = Math.cos(P.ang), vx = P.gsp * ca, nx = P.x + vx * dt;
    if (vx !== 0) {
      var sx = nx + Math.sign(vx) * K.HW, yA = P.y - 12, yB = P.y - K.HH + 2;
      if (solidAt(LV, sx, yA) || solidAt(LV, sx, yB)) {
        var br = false;
        if (canSmash(P, P.gsp)) { br = smash(LV, sx, yA, ev); br = smash(LV, sx, yB, ev) || br; }
        if (!br || solidAt(LV, sx, yA) || solidAt(LV, sx, yB)) { P.gsp = 0; ev('bump', {}); return; }
      }
    }
    P.x = nx;
    var s = floorY(LV, P.x, P.y - 12, P.y + 10 + Math.abs(vx * dt), P.y - 2);
    if (s == null) { P.ground = false; P.vx = P.gsp * ca; P.vy = -P.gsp * Math.sin(P.ang); P.coy = 0.08; P.jumped = false; return; }
    P.y = s; P.ang = angleAt(LV, P.x, s);
  }
  function airSub(LV, P, dt, ev) {
    P.x += P.vx * dt;
    var dir = P.vx > 0 ? 1 : P.vx < 0 ? -1 : 0;
    if (dir) {
      var sx = P.x + dir * K.HW;
      if (solidAt(LV, sx, P.y - 10) || solidAt(LV, sx, P.y - 18) || solidAt(LV, sx, P.y - K.HH + 2)) {
        var br = false;
        if (canSmash(P, P.vx)) { br = smash(LV, sx, P.y - 10, ev); br = smash(LV, sx, P.y - 18, ev) || br; br = smash(LV, sx, P.y - K.HH + 2, ev) || br; }
        if (!br || solidAt(LV, sx, P.y - 10) || solidAt(LV, sx, P.y - 18) || solidAt(LV, sx, P.y - K.HH + 2)) {
          var st = P.vy >= 0 ? floorY(LV, P.x, P.y - 16, P.y + 2, null) : null;   // невысокий склон/ступень — встаём на него
          if (st != null && !solidAt(LV, sx, st - 10) && !solidAt(LV, sx, st - K.HH + 2)) { P.y = st; land(LV, P, ev); return; }
          var cx = Math.floor(sx / T); P.x = dir > 0 ? cx * T - K.HW - 0.01 : (cx + 1) * T + K.HW + 0.01; P.vx = 0;
        }
      }
    }
    var oy = P.y; P.y += P.vy * dt;
    if (P.vy >= 0) {
      var s = floorY(LV, P.x, oy - 10, P.y, oy - 0.5);
      if (s != null) { P.y = s; land(LV, P, ev); return; }
      if (P.railCd <= 0) for (var i = 0; i < LV.rails.length; i++) {
        var rl = LV.rails[i], p = rl.pts;
        if (P.x < p[0][0] || P.x > p[p.length - 1][0]) continue;
        var ry = LVL.railY(p, P.x);
        if (oy <= ry + 1.5 && P.y >= ry) {
          var k = railSeg(rl, P.x), a = Math.atan2(p[k][1] - p[k - 1][1], p[k][0] - p[k - 1][0]);
          var v = P.vx * Math.cos(a) + P.vy * Math.sin(a), d = v < 0 ? -1 : 1;
          P.mode = 'rail'; P.rail = rl; P.y = ry; P.ground = false; P.vy = 0; P.rv = d * Math.max(K.RAILMIN, Math.abs(v)); P.jumped = false;
          ev('rail', { x: P.x, y: P.y }); return;
        }
      }
    } else if (solidAt(LV, P.x, P.y - K.HH) || solidAt(LV, P.x - K.HW + 1, P.y - K.HH) || solidAt(LV, P.x + K.HW - 1, P.y - K.HH)) {
      var cy = Math.floor((P.y - K.HH) / T); P.y = (cy + 1) * T + K.HH + 0.01; P.vy = 0;
    }
  }
  function railStep(LV, P, inp, dt, ev, dx) {
    var rl = P.rail, p = rl.pts, k = railSeg(rl, P.x), a = Math.atan2(p[k][1] - p[k - 1][1], p[k][0] - p[k - 1][0]), d = P.rv < 0 ? -1 : 1;
    P.rv += K.G * 0.45 * Math.sin(a) * dt * (Math.cos(a) >= 0 ? 1 : -1);
    if (dx === d) P.rv += d * K.RAILACC * dt;
    if (Math.abs(P.rv) < K.RAILMIN) P.rv = d * K.RAILMIN;
    if (Math.abs(P.rv) > K.MAXG) P.rv = d * K.MAXG;
    P.face = d; P.rot = -a; P.runT += Math.abs(P.rv) * dt / 30;
    var leave = function (jump) {
      P.mode = 'run'; P.rail = null; P.ground = false; P.railCd = 0.3; P.vx = P.rv * Math.cos(a); P.vy = P.rv * Math.sin(a) * d;
      if (jump) { P.vy = Math.min(P.vy, 0) - K.JUMP; P.jumped = true; ev('jump', {}); } else P.jumped = false;
      ev('railOff', { x: P.x, y: P.y });
    };
    if (P.jbuf > 0) { P.jbuf = 0; leave(true); return; }
    var n = Math.max(1, Math.ceil(Math.abs(P.rv) * dt / K.STEP)), sdt = dt / n;
    for (var i = 0; i < n; i++) {
      P.x += P.rv * Math.cos(a) * sdt;
      if (P.x > p[p.length - 1][0] || P.x < p[0][0]) { P.y = LVL.railY(p, P.x); leave(false); return; }
      P.y = LVL.railY(p, P.x);
    }
  }
  // inp: { dx, dy, jump (зажат), jp (нажат в этом кадре) }
  function heroStep(LV, P, inp, dt, ev) {
    ev = ev || function () {};
    var dx = inp.dx > 0.3 ? 1 : inp.dx < -0.3 ? -1 : 0;
    if (inp.jp) P.jbuf = 0.12; else P.jbuf = Math.max(0, P.jbuf - dt);
    if (P.railCd > 0) P.railCd -= dt;
    if (P.mode === 'pipe') {
      var pp = P.pipe; P.ps += P.pv * dt; var pt = pipeAt(pp, Math.min(P.ps, pipeLen(pp)));
      P.x = pt.x; P.y = pt.y; P.rot = Math.atan2(pt.dy, pt.dx);
      if (P.ps >= pp.len) { P.mode = 'run'; P.pipe = null; P.ground = false; P.vx = pt.dx * P.pv; P.vy = pt.dy * P.pv; P.jumped = false; P.tier = 2; P.tierT = 0; P.face = pt.dx >= 0 ? 1 : -1; ev('pipeOut', {}); ev('tier', { tier: 2 }); }
      return;
    }
    if (P.mode === 'rail') { railStep(LV, P, inp, dt, ev, dx); tierStep(P, dx, dt, ev); return; }
    if (P.turbo > 0) { P.turbo -= dt; if (P.tier < 2) { P.tier = 2; ev('tier', { tier: 2 }); } }
    var top = P.turbo > 0 ? K.TURBO : TOPS[P.tier];
    var st = inSteam(LV, P.x, P.y - 12);
    if (st && !P.steam) ev('steam', { x: P.x, y: P.y });
    P.steam = !!st;
    if (st && P.ground) { P.ground = false; P.vx = P.gsp * Math.cos(P.ang); P.vy = -120; P.jumped = false; }
    if (P.ground) {
      var sa = Math.sin(P.ang), acc = K.ACC * (P.turbo > 0 ? 1.7 : 1);
      if (dx) {
        if (P.gsp * dx >= 0) {
          if (Math.abs(P.gsp) < top) { P.gsp += dx * acc * dt; if (Math.abs(P.gsp) > top) P.gsp = dx * top; }
          else if (Math.abs(sa) < 0.2 || P.gsp * sa < 0) { var dr = K.DRAG * dt; P.gsp = Math.abs(P.gsp) - dr < top ? dx * top : P.gsp - dx * dr; }
        } else P.gsp += dx * K.DEC * dt;
        P.face = dx;
      } else {
        var f = K.FRIC * (1 - Math.abs(sa)) * dt; if (Math.abs(P.gsp) <= f) P.gsp = 0; else P.gsp -= f * Math.sign(P.gsp);
      }
      if (Math.abs(sa) > 0.05) P.gsp -= K.SLOPE * sa * dt;
      if (Math.abs(P.gsp) > K.MAXG) P.gsp = Math.sign(P.gsp) * K.MAXG;
      if (!dx && Math.abs(P.gsp) > 30) P.face = P.gsp > 0 ? 1 : -1;
      if (P.jbuf > 0) {
        P.vx = P.gsp * Math.cos(P.ang); P.vy = -P.gsp * Math.sin(P.ang) - K.JUMP; if (P.vy > -K.JUMP * 0.8) P.vy = -K.JUMP * 0.8;
        P.ground = false; P.jbuf = 0; P.jumped = true; ev('jump', {});
      }
    } else {
      P.coy -= dt;
      if (P.jbuf > 0 && P.coy > 0 && !P.jumped) { P.vy = -K.JUMP; P.jumped = true; P.jbuf = 0; P.coy = 0; ev('jump', {}); }
      var atop = Math.max(top, Math.abs(P.vx));
      if (dx > 0 && P.vx < top) P.vx = Math.min(top, P.vx + K.AIRACC * dt);
      if (dx < 0 && P.vx > -top) P.vx = Math.max(-top, P.vx - K.AIRACC * dt);
      if (dx && P.vx * dx < 0) P.vx += dx * K.AIRACC * 0.6 * dt;   // разворот в воздухе — чуть резче
      if (Math.abs(P.vx) > atop) P.vx = Math.sign(P.vx) * atop;
      if (dx) P.face = dx;
      if (st) { P.vy = Math.max(-K.STEAM, P.vy - K.STEAMACC * dt); P.jumped = false; }
      else {
        if (!inp.jump && P.jumped && P.vy < -K.CUT) P.vy = -K.CUT;
        P.vy = Math.min(K.MAXFALL, P.vy + K.G * dt);
      }
    }
    var sp = P.ground ? Math.abs(P.gsp) : Math.max(Math.abs(P.vx), Math.abs(P.vy));
    var n = Math.max(1, Math.ceil(sp * dt / K.STEP)), sdt = dt / n;
    for (var i = 0; i < n; i++) {
      if (P.ground) groundSub(LV, P, sdt, ev); else airSub(LV, P, sdt, ev);
      if (P.mode !== 'run') return;
    }
    // страховка: подошвы не должны оказаться внутри тверди
    if (solidAt(LV, P.x, P.y - 3)) { var up = floorY(LV, P.x, P.y - 24, P.y, null); if (up != null) { P.y = up; if (!P.ground) land(LV, P, ev); } }
    P.rot = P.ground ? -P.ang : P.rot * 0.85;
    P.runT += (P.ground ? Math.abs(P.gsp) : 0) * dt / 30;
    tierStep(P, dx, dt, ev);
    // пружины, трубы
    var k, o;
    for (k = 0; k < LV.springs.length; k++) {
      o = LV.springs[k];
      if (Math.abs(P.x - o.x) < 14 && P.y >= o.y - 14 && P.y <= o.y + 2 && (P.ground || P.vy >= 0)) {
        var wg = P.ground; P.ground = false; P.jumped = false; P.vy = -K.SPRING;
        if (wg) P.vx = P.gsp * Math.cos(P.ang);
        o.anim = 0.35; ev('spring', { x: o.x, y: o.y }); break;
      }
    }
    for (k = 0; k < LV.pipes.length; k++) {
      o = LV.pipes[k]; var m = o.pts[0];
      if (P.x >= m[0] - 6 && P.x <= m[0] + 12 && P.y >= m[1] - 30 && P.y <= m[1] + 12 && speedOf(P) > 10) {
        P.mode = 'pipe'; P.pipe = o; P.ps = 0; P.pv = Math.max(Math.abs(speedOf(P)), K.PIPE); P.ground = false; ev('pipe', { x: P.x, y: P.y }); return;
      }
    }
  }
  // ступени скорости: держишь направление на пределе ступени K.TIER_T секунд — следующая; сбросил скорость — ниже
  function tierStep(P, dx, dt, ev) {
    if (P.turbo > 0) return;
    var v = speedOf(P), a = Math.abs(v), onFloor = P.ground || P.mode === 'rail';
    if (onFloor && dx && dx * v > 0 && P.tier < 2 && a >= TOPS[P.tier] - 12) {
      P.tierT += dt; if (P.tierT >= K.TIER_T) { P.tier++; P.tierT = 0; ev('tier', { tier: P.tier }); }
    } else if (onFloor && a < TOPS[P.tier] - 12) P.tierT = 0;
    if (P.tier > 0 && onFloor && a < TOPS[P.tier - 1] * 0.8) { P.tier--; P.tierT = 0; if (P.tier > 0 && a < TOPS[P.tier - 1] * 0.8) P.tier--; ev('tier', { tier: P.tier }); }
  }

  // ---------- карты (шаблон — в кэше, в игру — копия: ящики/шестерни меняются) ----------
  var cache = {};
  function template(w, a) { var key = w + '-' + a; if (!cache[key]) cache[key] = a === 0 ? LVL.buildBonus(w) : LVL.build(w, a); return cache[key]; }
  function getLV(w, a) {
    var src = template(w, a), LV = Object.assign({}, src);
    LV.t = src.t.slice();
    ['gears', 'caps', 'springs', 'pipes', 'rails', 'steam', 'cps', 'enemies', 'secrets'].forEach(function (k) { LV[k] = src[k].map(function (o) { return Object.assign({}, o); }); });
    LV.springs.forEach(function (o) { o.anim = 0; });
    if (src.goal) LV.goal = Object.assign({}, src.goal);
    return LV;
  }

  SH.Game = function (opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, emit = opts.onEvent || function () {}, god = !!opts.god;
    var S = null, inp = { dx: 0, dy: 0, jump: false, jp: false }, fireHeld = false;
    function ev(t, d) { if (t === 'crate' && S) { S.score += 30 * (d.n || 1); S.crates = (S.crates || 0) + 1; } emit(t, d || {}); }

    function loadAct(w, a) {
      var LV = getLV(w, a);
      S.world = w; S.act = a; S.LV = LV; S.got = {}; S.gearsAct = 0; S.secretsAct = 0; S.actTime = 0; S.inBonus = a === 0;
      S.enemies = LV.enemies.map(function (e) { var d = EN[e.k]; return { id: e.id, k: e.k, x: e.x, y: e.y, hx: e.x, hy: e.y, x0: e.x0, x1: e.x1, dir: -1, hp: d.hp, t: rng() * 6, cd: 1 + rng(), alive: true, flash: 0 }; });
      S.cp = { x: LV.start.x, y: LV.start.y, id: 0 };
      S.boss = null; S.arenaOn = false; S.bossDown = false; S.vents = []; S.booms = [];
      if (S.inBonus) { S.bonusT = LV.time; S.bonusGot = 0; }
      spawnHero(true); S.phase = 'play'; S.phaseT = 0;
      ev(S.inBonus ? 'bonus' : 'act', { world: w, act: a });
    }
    function spawnHero(keepWeapon) {
      var P = newHero(S.cp.x, S.cp.y); S.hero = P;
      P.hp = K.HP; P.shield = 0; P.magnet = 0; P.inv = 1.0; P.fireCd = 0; P.fireT = 0;
      if (!keepWeapon) S.weapon = 0;
      S.shots = []; S.eshots = [];
    }
    function heroBox() { var P = S.hero; return { x0: P.x - 7, x1: P.x + 7, y0: P.y - K.HH, y1: P.y }; }
    function ov(a, b) { return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0; }
    function enBox(e) { var d = EN[e.k]; return { x0: e.x - d.w / 2, x1: e.x + d.w / 2, y0: e.y - d.h, y1: e.y }; }
    function bossBox(b) { return { x0: b.x - b.w / 2, x1: b.x + b.w / 2, y0: b.y - b.h / 2, y1: b.y + b.h / 2 }; }

    function hurt(srcX, why) {
      var P = S.hero;
      if (god || P.inv > 0 || P.mode !== 'run' || S.phase !== 'play') return false;
      if (P.shield > 0) { P.shield = 0; P.inv = 1.0; ev('shieldHit', { x: P.x, y: P.y }); }
      else { P.hp--; if (P.hp <= 0) { die(why || 'hit'); return true; } P.inv = K.INV; ev('hurt', { x: P.x, y: P.y, hp: P.hp, why: why }); }
      var d = P.x < srcX ? -1 : 1; P.ground = false; P.vy = -340; P.vx = d * 200; P.jumped = false; if (P.tier > 0) { P.tier--; P.tierT = 0; }
      return true;
    }
    function die(why) {
      if (S.phase !== 'play') return;
      var P = S.hero; S.lives--; S.deaths++; S.phase = 'dead'; S.phaseT = 1.4; S.lastDeath = why; P.vy = -420;
      ev('die', { why: why, x: P.x, y: P.y, lives: S.lives, world: S.world, act: S.act });
    }
    function respawn() {
      if (S.boss && !S.bossDown) { S.boss = null; S.arenaOn = false; S.vents = []; }
      spawnHero(false); S.phase = 'play'; ev('respawn', {});
    }
    function addGears(n) {
      S.gears += n; S.gearsAct += n; S.score += 10 * n; if (S.inBonus) S.bonusGot += n;
      while (S.gears >= 100) { S.gears -= 100; if (S.lives < K.MAXLIVES) { S.lives++; ev('life', { lives: S.lives }); } }
    }
    function killEnemy(e, how) {
      e.alive = false; S.kills++; var pts = EN[e.k].pts; S.score += pts;
      ev('kill', { k: e.k, x: e.x, y: e.y - EN[e.k].h / 2, pts: pts, how: how });
    }
    function openCap(c) {
      S.got[c.id] = 1; S.score += 50; var P = S.hero;
      switch (c.k) {
        case 'gears': addGears(10); break;
        case 'burst': case 'blast': case 'bounce': S.weapon = WIDX[c.k]; break;
        case 'shield': P.shield = K.SHIELD_T; break;
        case 'turbo': P.turbo = K.TURBO_T; break;
        case 'magnet': P.magnet = K.MAGNET_T; break;
        case 'hp': P.hp = Math.min(K.HP, P.hp + 1); break;
        case 'life': if (S.lives < K.MAXLIVES) S.lives++; break;
      }
      ev('cap', { k: c.k, x: c.x, y: c.y });
    }

    // ----- враги -----
    function groundFollow(e, nx) {
      var LV = S.LV, s = floorY(LV, nx, e.y - 18, e.y + 18, e.y - 18);
      if (s == null || solidAt(LV, nx + e.dir * 12, s - 8) || hazardAt(LV, nx, s + 2)) return false;
      e.x = nx; e.y = s; return true;
    }
    function enemyStep(e, dt) {
      var P = S.hero;
      e.t += dt; if (e.flash > 0) e.flash -= dt;
      switch (e.k) {
        case 'beetle':
          var nx = e.x + e.dir * 56 * dt;
          if (nx < e.x0 || nx > e.x1 || !groundFollow(e, nx)) e.dir = -e.dir;
          break;
        case 'roller':
          if (Math.abs(P.x - e.x) < 400 && Math.abs(P.y - e.y) < 120) e.dir = P.x < e.x ? -1 : 1;
          var rx = e.x + e.dir * 130 * dt;
          if (rx < e.x0 || rx > e.x1 || !groundFollow(e, rx)) e.dir = -e.dir;
          break;
        case 'wasp':
          if (Math.abs(P.x - e.hx) < 360) e.hx += Math.max(-40, Math.min(40, P.x - e.hx)) * dt;
          e.hx = Math.max(e.x0, Math.min(e.x1, e.hx));
          e.x = e.hx + Math.sin(e.t * 1.1) * 40; e.y = e.hy + Math.sin(e.t * 2.6) * 14; e.dir = P.x < e.x ? -1 : 1;
          break;
        case 'cannon':
          e.dir = P.x < e.x ? -1 : 1; e.cd -= dt;
          if (e.cd <= 0 && Math.abs(P.x - e.x) < 360 && Math.abs(P.y - e.y) < 140) {
            e.cd = 2.4; e.fireT = 0.25;
            S.eshots.push({ x: e.x + e.dir * 16, y: e.y - 16, vx: e.dir * 220, vy: 0, g: 0, r: 7, t: 3, k: 'ball' });
            ev('eshoot', { x: e.x, y: e.y });
          }
          if (e.fireT > 0) e.fireT -= dt;
          break;
      }
    }

    // ----- босс -----
    function spawnBoss() {
      var A = S.LV.arena, d = BOSS[A.boss];
      var b = { k: A.boss, hp: d.hp, max: d.hp, w: d.w, h: d.h, t: 0, flash: 0, cd: 1.6, cd2: 4, x: A.x1 - 90, y: A.y - d.h / 2, vx: 0, vy: 0, dir: -1,
        state: 'wait', st: 1.4, n: 0, air: false, thrown: 0, step: 0 };
      if (b.k === 'cuckoo') { b.y = A.y - 160; b.x = (A.x0 + A.x1) / 2 + 100; b.state = 'hover'; }
      S.boss = b; S.arenaOn = true; ev('boss', { k: b.k });
    }
    function bossHit(dmg) {
      var b = S.boss; if (!b || b.dead || b.flash > 0.04) return false;
      b.hp -= dmg; b.flash = 0.1; ev('bossHit', { x: b.x, y: b.y });
      if (b.hp <= 0) { b.dead = true; b.deadT = 0; S.bossDown = true; S.arenaOn = false; S.score += 5000; S.eshots = []; S.vents = []; S.LV.goal.hidden = false; ev('bossDown', { x: b.x, y: b.y, k: b.k }); }
      return true;
    }
    function aimShot(b, sp, spread, k) {
      var P = S.hero, a = Math.atan2(P.y - 12 - b.y, P.x - b.x) + (spread || 0);
      S.eshots.push({ x: b.x + Math.cos(a) * b.w * 0.4, y: b.y + Math.sin(a) * b.h * 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, r: 7, t: 4, k: k || 'bolt' });
    }
    function lob(b, tFlight, k, dxOff) {
      var P = S.hero, tx = P.x + (dxOff || 0), vx = Math.max(-340, Math.min(340, (tx - b.x) / tFlight));
      S.eshots.push({ x: b.x, y: b.y - b.h / 2, vx: vx, vy: -0.5 * 1000 * tFlight, g: 1000, r: 8, t: 3, k: k });
    }
    function dashStep(b, dt, A, spd, canJump) {
      var gy = A.y - b.h / 2, P = S.hero;
      b.x += b.dir * spd * dt;
      if (canJump && !b.air && Math.abs(P.y - A.y) < 30 && (P.x - b.x) * b.dir > 0 && Math.abs(P.x - b.x) < 100 && rng() < 0.08) { b.air = true; b.vy = -620; ev('bossLeap', {}); }
      if (b.air) { b.vy += 1500 * dt; b.y += b.vy * dt; if (b.y >= gy) { b.y = gy; b.air = false; } } else b.y = gy;
      if ((b.dir < 0 && b.x <= A.x0 + 50) || (b.dir > 0 && b.x >= A.x1 - 50)) { b.x = Math.max(A.x0 + 50, Math.min(A.x1 - 50, b.x)); return true; }
      return false;
    }
    function bossStep(dt) {
      var b = S.boss, A = S.LV.arena, P = S.hero; if (!b) return;
      b.t += dt; if (b.flash > 0) b.flash -= dt;
      if (b.dead) { b.deadT += dt; b.y += 30 * dt; return; }
      var ph2 = b.hp <= b.max / 2, mid = (A.x0 + A.x1) / 2, gy = A.y - b.h / 2;
      if (b.k === 'fox') {
        if (b.state === 'wait') {
          b.dir = P.x < b.x ? -1 : 1; b.st -= dt; b.y = gy;
          var need = ph2 ? 2 : 1;
          if (b.thrown < need && b.st < 0.9 - b.thrown * 0.35) { lob(b, 0.9 + b.thrown * 0.25, 'wrench'); b.thrown++; ev('eshoot', { x: b.x, y: b.y }); }
          if (b.st <= 0) { b.state = 'dash'; b.dir = b.x > mid ? -1 : 1; }
        } else if (dashStep(b, dt, A, ph2 ? 380 : 300, true) && !b.air) { b.state = 'wait'; b.st = ph2 ? 1.0 : 1.4; b.thrown = 0; }
      } else if (b.k === 'ram') {
        b.y = gy;
        if (b.state === 'wait') {
          b.dir = b.x > mid ? -1 : 1; b.st -= dt;
          if (b.thrown < 3 && b.st < 1.3 - b.thrown * 0.35) { for (var i = 0; i < (ph2 ? 3 : 2); i++) lob(b, 0.8 + i * 0.22, 'puff', (i - 0.5) * 50); b.thrown++; ev('eshoot', { x: b.x, y: b.y }); }
          if (b.st <= 0) { b.state = 'rev'; b.st = 0.5; ev('bossRev', {}); }
        } else if (b.state === 'rev') { b.st -= dt; if (b.st <= 0) b.state = 'dash'; }
        else if (dashStep(b, dt, A, ph2 ? 430 : 350, false)) { b.state = 'wait'; b.st = ph2 ? 1.5 : 2.0; b.thrown = 0; ev('bossBump', { x: b.x, y: A.y }); }
      } else if (b.k === 'cuckoo') {
        var span = (A.x1 - A.x0) / 2 - 90;
        b.x = mid + span * Math.sin(b.t * (ph2 ? 0.75 : 0.55));
        if (b.state === 'hover') {
          b.y = A.y - 160 + Math.sin(b.t * 1.7) * 16; b.cd -= dt; b.cd2 -= dt;
          if (b.cd <= 0) { b.cd = ph2 ? 1.3 : 1.8; S.eshots.push({ x: b.x, y: b.y + 26, vx: 0, vy: 0, g: 900, r: 9, t: 5, k: 'cog', roll: ph2 ? 180 : 150 }); ev('eshoot', { x: b.x, y: b.y }); }
          if (b.cd2 <= 0) { b.state = 'swoop'; b.st = 0; }
        } else {
          b.st += dt; var f = b.st / 1.8; b.y = A.y - 160 + Math.sin(Math.min(1, f) * Math.PI) * 110;
          if (f >= 1) { b.state = 'hover'; b.cd2 = ph2 ? 5 : 7; }
        }
      } else if (b.k === 'armor') {
        var seq = ['dash', 'volley', 'dash', 'vents'];
        if (b.state === 'wait') { b.st -= dt; b.y = gy; b.dir = P.x < b.x ? -1 : 1; if (b.st <= 0) { b.state = seq[b.step++ % 4]; b.st = 0; b.n = 0; if (b.state === 'dash') b.dir = b.x > mid ? -1 : 1; } }
        else if (b.state === 'dash') { if (dashStep(b, dt, A, ph2 ? 420 : 340, true) && !b.air) { b.state = 'wait'; b.st = ph2 ? 0.6 : 0.9; } }
        else if (b.state === 'volley') {
          b.y = gy; b.st += dt;
          if (b.n < (ph2 ? 4 : 3) && b.st > 0.3 + b.n * 0.28) { aimShot(b, 240, 0, 'bolt'); b.n++; ev('eshoot', { x: b.x, y: b.y }); }
          if (b.st > 1.6) { b.state = 'wait'; b.st = 0.7; }
        } else if (b.state === 'vents') {
          b.y = gy; b.st += dt;
          if (b.n < (ph2 ? 3 : 2) && b.st > b.n * 0.7) { var vx = Math.max(A.x0 + 40, Math.min(A.x1 - 40, P.x + (rng() - 0.5) * 40)); S.vents.push({ x: vx, warn: 0.9, on: 0.7 }); b.n++; ev('vent', { x: vx }); }
          if (b.st > 2.6) { b.state = 'wait'; b.st = 0.6; }
        }
      }
    }

    // ----- выстрелы -----
    function fire() {
      if (!S || S.phase !== 'play') return false;
      var P = S.hero;
      if (P.mode === 'pipe' || P.fireCd > 0) return false;
      var w = S.weapon, W = WPN[w]; P.fireCd = W.cd; P.fireT = 0.12;
      var up = inp.dy < -0.3, dxs = up ? P.face * 0.7071 : P.face, dys = up ? -0.7071 : 0;
      if (w === 1) { S.burstN = (S.burstN || 0) + 1; dys += (S.burstN % 3 - 1) * 0.04; }
      var hv = speedOf(P), base = (hv * P.face > 0 ? hv : 0) * 0.9;
      var ox = P.x + P.face * 12, oy = P.y - (up ? 18 : 13);
      var s = { x: ox, y: oy, vx: dxs * W.sp + base, vy: dys * W.sp, w: w, dmg: W.dmg, t: W.life, hit: {}, hops: W.hops || 0 };
      if (w === 3) s.vy -= 140;
      S.shots.push(s);
      ev('fire', { w: w, x: ox, y: oy });
      return true;
    }
    function boom(x, y) {
      var r = WPN[2].boom; S.booms.push({ x: x, y: y, r: r, t: 0.3 }); ev('boom', { x: x, y: y });
      var bb = { x0: x - r, x1: x + r, y0: y - r, y1: y + r }, LV = S.LV;
      S.enemies.forEach(function (e) { if (e.alive && ov(bb, enBox(e))) { e.hp -= 2; e.flash = 0.1; if (e.hp <= 0) killEnemy(e, 'boom'); } });
      LV.caps.forEach(function (c) { if (!S.got[c.id] && Math.abs(c.x - x) < r && Math.abs(c.y - y) < r) openCap(c); });
      if (S.boss && !S.boss.dead && ov(bb, bossBox(S.boss))) bossHit(1);
      // взрыв разбивает и ящики рядом
      for (var cx = Math.floor((x - r / 2) / T); cx <= Math.floor((x + r / 2) / T); cx++) for (var cy = Math.floor((y - r / 2) / T); cy <= Math.floor((y + r / 2) / T); cy++) smash(LV, cx * T + 8, cy * T + 8, ev);
    }
    function shotStep(dt) {
      var LV = S.LV, i, s;
      for (i = 0; i < S.shots.length; i++) {
        s = S.shots[i]; s.t -= dt;
        var g = WPN[s.w].g || 0; s.vy += g * dt;
        var ns = Math.max(1, Math.ceil(Math.hypot(s.vx, s.vy) * dt / 6));
        for (var u = 0; u < ns && s.t > 0; u++) shotSub(s, dt / ns);
        if (s.t <= 0 && s.w === 2 && !s.boomed) { s.boomed = true; boom(s.x, s.y); }
      }
      S.shots = S.shots.filter(function (q) { return q.t > 0; });
      for (i = 0; i < S.eshots.length; i++) {
        s = S.eshots[i]; s.t -= dt;
        s.vy += (s.g || 0) * dt; s.x += s.vx * dt;
        var ny = s.y + s.vy * dt;
        if (s.roll != null) {
          var fl = floorY(LV, s.x, s.y - 8, ny + s.r, s.y - 8);
          if (fl != null && s.vy > 0) { ny = fl - s.r; s.vy = 0; if (!s.rolling) { s.rolling = true; s.vx = (S.hero.x < s.x ? -1 : 1) * s.roll; } }
          if (LV.arena && (s.x < LV.arena.x0 + 4 || s.x > LV.arena.x1 - 4)) s.t = 0;
        } else if (solidAt(LV, s.x, ny)) { s.t = 0; ev('pop', { x: s.x, y: s.y }); }
        s.y = ny;
        if (s.y > LV.h * T + 40) s.t = 0;
      }
      S.eshots = S.eshots.filter(function (q) { return q.t > 0; });
      for (i = 0; i < S.booms.length; i++) S.booms[i].t -= dt;
      S.booms = S.booms.filter(function (q) { return q.t > 0; });
    }
    function shotSub(s, dt) {
      var LV = S.LV, j, W = WPN[s.w];
      var ox = s.x, oy = s.y;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (solidAt(LV, s.x, s.y)) {
        if (s.w === 3 && s.hops > 0) {
          s.hops--; ev('hop', { x: s.x, y: s.y });
          if (!solidAt(LV, ox, s.y)) { s.vx = -s.vx * 0.9; s.x = ox; } else { s.vy = -Math.max(260, Math.abs(s.vy) * 0.7); s.y = oy; }
          return;
        }
        s.t = 0; if (s.w === 2) { s.boomed = true; boom(ox, oy); } else ev('spark', { x: s.x, y: s.y });
        return;
      }
      var sb = { x0: s.x - 4, x1: s.x + 4, y0: s.y - 4, y1: s.y + 4 };
      for (j = 0; j < S.enemies.length && s.t > 0; j++) {
        var e = S.enemies[j]; if (!e.alive || s.hit[e.id]) continue;
        if (ov(sb, enBox(e))) { s.hit[e.id] = 1; e.hp -= s.dmg; e.flash = 0.1; if (e.hp <= 0) killEnemy(e, 'shot'); else ev('enemyHit', { x: e.x, y: e.y }); s.t = 0; if (s.w === 2) { s.boomed = true; boom(s.x, s.y); } }
      }
      for (j = 0; j < LV.caps.length && s.t > 0; j++) {
        var c = LV.caps[j]; if (S.got[c.id]) continue;
        if (Math.abs(c.x - s.x) < 12 && Math.abs(c.y - s.y) < 12) { openCap(c); s.t = 0; }
      }
      for (j = 0; j < S.eshots.length && s.t > 0; j++) {
        var q = S.eshots[j]; if (q.t <= 0) continue;
        if (Math.abs(q.x - s.x) < q.r + 4 && Math.abs(q.y - s.y) < q.r + 4) { q.t = 0; S.score += 10; ev('pop', { x: q.x, y: q.y }); s.t = 0; }
      }
      if (s.t > 0 && S.boss && !S.boss.dead && ov(sb, bossBox(S.boss))) { bossHit(s.dmg); s.t = 0; if (s.w === 2) { s.boomed = true; boom(s.x, s.y); } }
    }

    // ----- кадр -----
    function update(dt) {
      if (!S) return;
      S.time += dt;
      var LV = S.LV, P = S.hero, i;
      LV.springs.forEach(function (o) { if (o.anim > 0) o.anim -= dt; });
      if (S.phase === 'dead') { S.phaseT -= dt; P.vy += 1200 * dt; P.y += P.vy * dt * 0.5; if (S.phaseT <= 0) { if (S.lives <= 0) { S.phase = 'over'; S.over = true; ev('gameover', { score: S.score }); } else respawn(); } inp.jp = false; return; }
      if (S.phase === 'clear') { S.phaseT -= dt; if (S.phaseT <= 0) nextAct(); inp.jp = false; return; }
      if (S.phase !== 'play') { inp.jp = false; return; }
      S.actTime += dt;
      if (S.inBonus) { S.bonusT -= dt; if (S.bonusT <= 0 || S.bonusGot >= LV.need) { endBonus(); inp.jp = false; return; } }
      if (P.inv > 0) P.inv -= dt; if (P.fireCd > 0) P.fireCd -= dt; if (P.fireT > 0) P.fireT -= dt;
      if (P.shield > 0) P.shield -= dt; if (P.magnet > 0) P.magnet -= dt;
      var mode0 = P.mode;
      heroStep(LV, P, inp, dt, ev);
      inp.jp = false;
      if (fireHeld) fire();
      if (S.arenaOn) { var A = LV.arena; if (P.x < A.x0 + 10) { P.x = A.x0 + 10; P.gsp = Math.max(0, P.gsp); P.vx = Math.max(0, P.vx); } if (P.x > A.x1 - 10) { P.x = A.x1 - 10; P.gsp = Math.min(0, P.gsp); P.vx = Math.min(0, P.vx); } }
      if (P.y > LV.h * T + 60) { if (S.inBonus) { S.hero = Object.assign(P, newHero(LV.start.x, LV.start.y), { hp: P.hp, shield: P.shield, magnet: P.magnet, inv: 1, fireCd: 0, fireT: 0 }); } else { die('pit'); return; } }
      // шипы
      if (P.mode === 'run' && P.ground && hazardAt(LV, P.x, P.y + 2)) { if (!hurt(P.x - P.face * 10, 'spike') && S.phase === 'play') { P.ground = false; P.vy = -420; P.jumped = false; } }
      if (S.phase !== 'play') return;
      var hb = heroBox(), mg = P.magnet > 0;
      // шестерни (магнит тянет их к герою)
      for (i = 0; i < LV.gears.length; i++) {
        var gr = LV.gears[i]; if (S.got[gr.id]) continue;
        if (mg || gr.pull) { var ddx = P.x - gr.x, ddy = P.y - 12 - gr.y, dd = Math.hypot(ddx, ddy); if (dd < K.MAGNET_R || gr.pull) { gr.pull = true; var sp = Math.max(420, Math.abs(speedOf(P)) + 200) * dt; gr.x += ddx / (dd || 1) * Math.min(dd, sp); gr.y += ddy / (dd || 1) * Math.min(dd, sp); } }
        if (Math.abs(gr.x - P.x) < 14 && gr.y > P.y - K.HH - 10 && gr.y < P.y + 8) { S.got[gr.id] = 1; addGears(1); ev('gear', { x: gr.x, y: gr.y }); }
      }
      for (i = 0; i < LV.secrets.length; i++) {
        var sc = LV.secrets[i]; if (S.got[sc.id]) continue;
        if (Math.abs(sc.x - P.x) < 16 && sc.y > P.y - K.HH - 12 && sc.y < P.y + 12) { S.got[sc.id] = 1; S.secrets++; S.secretsAct++; S.score += 1000; ev('secret', { x: sc.x, y: sc.y }); if (sc.token) { S.token = true; ev('token', { x: sc.x, y: sc.y }); } }
      }
      for (i = 0; i < LV.caps.length; i++) { var cp0 = LV.caps[i]; if (!S.got[cp0.id] && ov(hb, { x0: cp0.x - 11, x1: cp0.x + 11, y0: cp0.y - 11, y1: cp0.y + 11 })) openCap(cp0); }
      for (i = 0; i < LV.cps.length; i++) { var cp = LV.cps[i]; if (P.x >= cp.x && cp.x > S.cp.x && Math.abs(P.y - cp.y) < 240) { S.cp = { x: cp.x, y: cp.y, id: cp.id }; S.score += 100; ev('cp', { x: cp.x, y: cp.y }); } }
      // враги
      var ram = P.tier === 2 && Math.abs(speedOf(P)) >= K.SMASH;
      for (i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (!e.alive || Math.abs(e.x - P.x) > 720) continue;
        enemyStep(e, dt);
        var eb = enBox(e);
        if (ov(hb, eb)) {
          if (P.mode !== 'run' || (ram && e.k !== 'cannon')) killEnemy(e, 'ram');
          else if (!P.ground && P.vy > 40 && P.y - P.vy * dt * 2 <= eb.y0 + 8) { killEnemy(e, 'stomp'); P.vy = inp.jump ? -500 : -360; P.jumped = false; }
          else if (e.k !== 'cannon' || P.y > eb.y0 + 6) hurt(e.x, 'enemy');
          else if (P.vy >= 0) { P.y = eb.y0; P.vy = 0; land(LV, P, ev); }
        }
      }
      // босс
      if (LV.arena && !S.boss && !S.bossDown && P.x > LV.arena.x0 + 80) spawnBoss();
      if (S.boss) {
        bossStep(dt); var b = S.boss;
        if (!b.dead && P.mode === 'run' && ov(hb, bossBox(b))) {
          var bb = bossBox(b);
          if (!P.ground && P.vy > 40 && P.y - P.vy * dt * 2 <= bb.y0 + 10) { bossHit(2); P.vy = -520; P.jumped = false; }
          else hurt(b.x, 'boss');
        }
      }
      for (i = 0; i < S.vents.length; i++) {
        var v = S.vents[i];
        if (v.warn > 0) v.warn -= dt; else { v.on -= dt; if (Math.abs(P.x - v.x) < 20 && P.y > LV.arena.y - 150) hurt(v.x, 'steam'); }
      }
      S.vents = S.vents.filter(function (q) { return q.on > 0; });
      shotStep(dt);
      if (S.phase !== 'play') return;
      for (i = 0; i < S.eshots.length; i++) { var q = S.eshots[i]; if (ov(hb, { x0: q.x - q.r, x1: q.x + q.r, y0: q.y - q.r, y1: q.y + q.r })) { if (hurt(q.x, 'shot') || P.mode !== 'run') { if (!god) q.t = 0; } } }
      // финиш акта
      var G = LV.goal;
      if (G && !G.hidden && P.x >= G.x && Math.abs(P.y - G.y) < 120) clearAct();
      if (mode0 !== P.mode && P.mode === 'run') P.inv = Math.max(P.inv, 0.2);
    }
    function clearAct() {
      var par = S.LV.par, tb = Math.max(0, Math.round((par - S.actTime) * 30)), gb = S.gearsAct * 5, sb = S.secretsAct * 500, bonus = tb + gb + sb;
      S.score += bonus; S.phase = 'clear'; S.phaseT = 3.2; S.cleared++;
      S.lastClear = { tb: tb, gb: gb, sb: sb, bonus: bonus, time: S.actTime, world: S.world, act: S.act, token: !!S.token };
      ev('clear', S.lastClear);
    }
    function endBonus() {
      var done = S.bonusGot >= S.LV.need;
      if (done) { S.score += 3000; if (S.lives < K.MAXLIVES) { S.lives++; ev('life', { lives: S.lives }); } }
      S.phase = 'clear'; S.phaseT = 2.4; S.lastClear = { bonusStage: true, done: done, got: S.bonusGot };
      ev('bonusEnd', { done: done, got: S.bonusGot });
    }
    function nextAct() {
      var w = S.world, a = S.act;
      if (a === 1 && S.token) { S.token = false; S.bonusFrom = w; loadAct(w, 0); return; }
      if (a === 0) { loadAct(S.bonusFrom, 2); return; }
      a++; if (a > 2) { a = 1; w++; }
      if (w > LVL.WORLDS) { S.phase = 'won'; S.won = true; ev('win', { score: S.score }); return; }
      loadAct(w, a);
    }

    var api = {
      start: function () {
        S = { phase: 'play', phaseT: 0, world: 1, act: 1, score: 0, lives: opts.lives || K.LIVES, gears: 0, gearsAct: 0, secrets: 0, secretsAct: 0,
          weapon: 0, kills: 0, deaths: 0, time: 0, actTime: 0, cleared: 0, token: false, over: false, won: false, inBonus: false };
        loadAct(opts.world || 1, opts.act || 1);
        return api;
      },
      update: update,
      setInput: function (dx, dy, jump) { if (jump && !inp.jump) inp.jp = true; inp.dx = dx; inp.dy = dy; inp.jump = !!jump; },
      setFire: function (on) { fireHeld = !!on; },
      fire: fire,
      state: function () { return S; },
      restartAct: function () { if (S.phase !== 'play') return; die('restart'); },
      _goAct: function (w, a) { loadAct(w, a); return api; },
      _place: function (x, y) { var P = S.hero; P.x = x; P.y = y; P.vx = P.vy = P.gsp = 0; P.ground = false; P.mode = 'run'; return api; },
      _die: die, _hurt: hurt, _spawnBoss: spawnBoss, _cap: function (k) { openCap({ id: -Math.floor(rng() * 1e9) - 1, k: k, x: S.hero.x, y: S.hero.y }); }
    };
    return api;
  };

  SH.logic = { K: K, TOPS: TOPS, WPN: WPN, EN: EN, BOSS: BOSS, hAt: hAt, tile: tile, solidAt: solidAt, floorY: floorY, angleAt: angleAt,
    hazardAt: hazardAt, inSteam: inSteam, newHero: newHero, heroStep: heroStep, speedOf: speedOf, tierFor: tierFor, getLV: getLV, template: template,
    pipeAt: pipeAt, pipeLen: pipeLen, T: T, C: C, STEP: 1 / 60 };
})(typeof window !== 'undefined' ? window : globalThis);
