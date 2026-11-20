/* КАМЕРТОН · game.js — логика и физика (чистая, без DOM; работает и в Node для тестов).
   Фиксированный шаг 1/120 с; падение не быстрее 900 px/с = 7.5 px за шаг при самой тонкой тверди 10–14 px — туннелирования нет.
   Тела — прямоугольники (AABB), коллизии по осям X, затем Y. Подмастерье и заводные куклы — одинаковые «тела» с разным ростом,
   весом, скоростью и прыжком (KIND); друг для друга они — ступенька сверху (на куклу можно встать), но сбоку не мешают.

   Главная механика — камертон: подмастерье (действие рядом со спящей куклой) «настраивает» её — у куклы загорается сердечник,
   и управление переходит к ней. Переключение (Q) — по кругу: подмастерье → настроенные куклы в пределах звука (LINK_R) → …
   Оловянные солдатики настраиваются в один строй: все настроенные солдатики в пределах звука повторяют одни и те же шаги.
   Пока подмастерье держит камертон, его руки заняты: отпустить ворот он не может удержать (переключение снимает его хват),
   а кукла, оставленная на вороте, держит его и без звука. Ушла кукла дальше звука — управление возвращается к подмастерью.
   Гибель — «остановился завод»: всё замирает, и через миг подмастерье снова у последнего фонарика (чекпоинт = снимок S.d). */
(function (global) {
  'use strict';
  var K = global.KAMER = global.KAMER || {};
  var DT = 1 / 120;
  var C = K.C = { G: 1600, MAXF: 900, ACC_G: 1400, ACC_A: 800, COYOTE: 0.08, JBUF: 0.12, STEP_UP: 10, CLIMB: 95,
    LINK_R: 600, ATT_R: 46, LEV_R: 20, DEAD_T: 1.2, TURN_T: 1.6, PUSH_K: 0.6 };
  var KIND = K.KIND = {
    hero: { w: 18, h: 38, run: 150, jump: 520, wt: 1, push: 1, climb: true },
    porter: { w: 28, h: 48, run: 95, jump: 0, wt: 2, push: 1, opaque: true },
    dancer: { w: 14, h: 22, run: 165, jump: 610, wt: 0.5, push: 0 },
    giant: { w: 40, h: 70, run: 65, jump: 0, wt: 4, push: 2, opaque: true },
    soldier: { w: 16, h: 32, run: 115, jump: 450, wt: 1, push: 1 }
  };
  var CRATE = K.CRATE = { crate: { w: 40, h: 40, need: 1, wt: 2 }, heavy: { w: 60, h: 60, need: 2, wt: 4 } };

  function ov(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function R(x, y, w, h, k, ref) { return { x: x, y: y, w: w, h: h, k: k || 's', ref: ref }; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function sgn(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function wrapA(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
  // отрезок (x0,y0)→(x1,y1) пересекает прямоугольник? (Лян — Барски)
  function segHits(x0, y0, x1, y1, r) {
    var dx = x1 - x0, dy = y1 - y0, t0 = 0, t1 = 1, p = [-dx, dx, -dy, dy], q = [x0 - r.x, r.x + r.w - x0, y0 - r.y, r.y + r.h - y0];
    for (var i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; continue; }
      var t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return t0 < t1 && t1 > 0.001 && t0 < 0.999;
  }
  function segT(x0, y0, x1, y1, r) {   // параметр входа луча в прямоугольник (для отрисовки света), 1 — не задел
    var dx = x1 - x0, dy = y1 - y0, t0 = 0, t1 = 1, p = [-dx, dx, -dy, dy], q = [x0 - r.x, r.x + r.w - x0, y0 - r.y, r.y + r.h - y0];
    for (var i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return 1; continue; }
      var t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return 1; if (t > t0) t0 = t; } else { if (t < t0) return 1; if (t < t1) t1 = t; }
    }
    return t0 <= t1 ? t0 : 1;
  }

  K.Game = function (opts) {
    opts = opts || {};
    var emit = opts.onEvent || function () {};
    var S = { z: 0, L: null, d: null, time: 0, cp: 0, cpSnap: null, deaths: 0, played: 0, phase: 'play', turnT: 0, dead: null, stat: { deaths: 0, resets: 0 } };
    var inp = { x: 0, y: 0, up: false, jump: false, act: false, sw: false }, prev = { up: false, jump: false, act: false, sw: false };
    var edge = { jump: false, act: false, sw: false, up: false };
    var statics = [];

    // ---------- загрузка зоны ----------
    function newBody(id, kind, x, feet) { var k = KIND[kind]; return { id: id, kind: kind, x: x - k.w / 2, y: feet - k.h, w: k.w, h: k.h, vx: 0, vy: 0, gr: true, face: 1, att: kind === 'hero', hold: -1, climb: -1, coy: 0, jb: 0, push: 0, stepT: 0, lost: false }; }
    function buildDyn(L) {
      var bodies = [newBody('hero', 'hero', L.cps[0].x, L.cps[0].y || 440)];
      (L.dolls || []).forEach(function (o) { bodies.push(newBody(o.id, o.kind, o.x, o.y || 440)); });
      return {
        bodies: bodies, ctl: 'hero',
        crates: (L.crates || []).map(function (c) { var s = CRATE[c.kind]; return { id: c.id, kind: c.kind, x: c.x, y: (c.y || 440) - s.h, w: s.w, h: s.h, vy: 0, gr: true, gone: false }; }),
        doors: (L.doors || []).map(function () { return { off: 0 }; }),
        levers: (L.levers || []).map(function () { return { on: false }; }),
        plates: (L.plates || []).map(function () { return { on: false }; }),
        lifts: (L.lifts || []).map(function (l) { return { y: l.y }; }),
        crushers: (L.crushers || []).map(function () { return { t: 0, off: 0 }; }),
        lampT: (L.lamps || []).map(function () { return 0; }),
        drums: (L.drums || []).map(function (r) { return { st: 0, x: r.x, y: r.y, vy: 0, rot: 0 }; }),
        time: 0
      };
    }
    function loadZone(z, snap, cpIdx) {
      S.z = z; S.L = K.LEVELS[z]; S.phase = 'play'; S.dead = null;
      statics = S.L.solids.map(function (s) { return R(s[0], s[1], s[2], s[3], 's'); });
      S.d = buildDyn(S.L); S.time = 0; S.cp = cpIdx || 0;
      if (snap) { S.d = clone(snap.d); S.time = snap.time || 0; }
      placeHero(); S.cpSnap = snapshot();
      emit('zone', { z: z });
    }
    function placeHero() {
      var c = S.L.cps[S.cp], h = hero(), n = newBody('hero', 'hero', c.x, c.y || 440);
      for (var k in n) h[k] = n[k];
      S.d.ctl = 'hero';
    }
    function snapshot() { return { z: S.z, cp: S.cp, d: clone(S.d), time: S.time }; }
    function respawn() { S.d = clone(S.cpSnap.d); S.time = S.cpSnap.time; S.dead = null; placeHero(); emit('respawn', { cp: S.cp }); }
    function hero() { return S.d.bodies[0]; }
    function body(id) { for (var i = 0; i < S.d.bodies.length; i++) if (S.d.bodies[i].id === id) return S.d.bodies[i]; return null; }
    function die(cause, who) {
      if (S.dead) return; var b = who || hero();
      S.dead = { t: C.DEAD_T, cause: cause, x: b.x + b.w / 2, y: b.y + b.h / 2, who: b.id };
      S.deaths++; S.stat.deaths++; emit('death', { cause: cause, x: S.dead.x, y: S.dead.y, who: b.id });
    }

    // ---------- сигналы ----------
    function heldBy(i) { for (var k = 0; k < S.d.bodies.length; k++) if (S.d.bodies[k].hold === i) return S.d.bodies[k]; return null; }
    function sig(link) {
      if (!link) return false;
      if (Array.isArray(link)) { for (var a = 0; a < link.length; a++) if (!sig(link[a])) return false; return true; }
      var L = S.L, d = S.d, i;
      for (i = 0; i < (L.levers || []).length; i++) { var lv = L.levers[i]; if (lv.link !== link) continue; if (lv.mode === 'hold' ? !!heldBy(i) : d.levers[i].on) return true; }
      for (i = 0; i < (L.plates || []).length; i++) if (L.plates[i].link === link && d.plates[i].on) return true;
      return false;
    }
    function doorRect(i) { var D = S.L.doors[i]; return R(D.x, D.y - S.d.doors[i].off, D.w, D.h, 'door', i); }
    function liftRect(i) { var l = S.L.lifts[i]; return R(l.x, S.d.lifts[i].y, l.w, l.h, 'lift', i); }
    function moverX(i, t) { var m = S.L.movers[i]; return m.x + (m.x2 - m.x) * (0.5 - 0.5 * Math.cos(2 * Math.PI * ((t == null ? S.d.time : t) / m.period + m.phase))); }
    function moverRect(i) { var m = S.L.movers[i]; return R(moverX(i), m.y, m.w, m.h, 'mover', i); }
    function crushOff(i) {   // насколько молот опущен: покой вверху → удар → внизу → подъём
      var c = S.L.crushers[i], cd = S.d.crushers[i];
      if (c.stop && sig(c.stop)) return cd.off;
      var p = ((cd.t / c.period + c.phase) % 1 + 1) % 1, f;
      if (p < 0.45) f = 0; else if (p < 0.55) f = (p - 0.45) / 0.1; else if (p < 0.7) f = 1; else f = 1 - (p - 0.7) / 0.3;
      return c.drop * f;
    }
    function crushRect(i) { var c = S.L.crushers[i]; return R(c.x, c.y + S.d.crushers[i].off, c.w, c.h, 'crush', i); }
    function lampState(i) {   // положение и направление фонаря; off — погашен
      var l = S.L.lamps[i], t = S.d.lampT[i], x = l.x, a = l.ang, face = 1;
      if (l.patrol) { var p = l.patrol, len = p.x2 - p.x1, s = (t * p.speed) % (2 * len); if (s < len) { x = p.x1 + s; face = 1; } else { x = p.x2 - (s - len); face = -1; } a = face * Math.abs(l.ang); }
      if (l.sweep) a = l.ang + l.sweep.amp * Math.sin(2 * Math.PI * (t / l.sweep.period + (l.sweep.phase || 0)));
      return { x: x, y: l.y, a: a, half: l.half, range: l.range, off: !!(l.off && sig(l.off)), face: face };
    }

    // ---------- твердь ----------
    function solids(who) {
      var L = S.L, d = S.d, out = statics.slice(), i;
      for (i = 0; i < (L.doors || []).length; i++) out.push(doorRect(i));
      for (i = 0; i < (L.bridges || []).length; i++) if (sig(L.bridges[i].link)) { var b = L.bridges[i]; out.push(R(b.x, b.y, b.w, b.h, 'bridge', i)); }
      for (i = 0; i < (L.lifts || []).length; i++) out.push(liftRect(i));
      for (i = 0; i < (L.movers || []).length; i++) out.push(moverRect(i));
      for (i = 0; i < d.crates.length; i++) { var c = d.crates[i]; if (c === who || c.gone) continue; out.push(R(c.x, c.y, c.w, c.h, 'crate', c)); }
      if (who && who.kind && KIND[who.kind]) {     // для тел: верх лестниц и других тел — ступенька только сверху
        if (who.climb < 0) for (i = 0; i < (L.ladders || []).length; i++) { var ld = L.ladders[i]; out.push(R(ld.x, ld.y, ld.w, 4, 'ow', 'ladder')); }
        for (i = 0; i < d.bodies.length; i++) { var o = d.bodies[i]; if (o === who || o.lost) continue; out.push(R(o.x, o.y, o.w, o.h, 'ow', o)); }
      }
      return out;
    }
    function free(b, list) { return list.filter(function (r) { return !(b.x < r.x + r.w - 0.5 && b.x + b.w > r.x + 0.5 && b.y < r.y + r.h - 0.5 && b.y + b.h > r.y + 0.5); }); }
    function moveX(b, dx, list) {
      if (!dx) return null; var x0 = b.x; b.x += dx; var hit = null;
      for (var i = 0; i < list.length; i++) { var r = list[i]; if (r.k === 'ow' || !ov(b, r)) continue;
        if (dx > 0 && x0 + b.w <= r.x + 0.5) { b.x = r.x - b.w; hit = r; } else if (dx < 0 && x0 >= r.x + r.w - 0.5) { b.x = r.x + r.w; hit = r; } }
      return hit;
    }
    function moveY(b, dy, list) {
      if (!dy) return null; var y0 = b.y; b.y += dy; var hit = null;
      for (var i = 0; i < list.length; i++) { var r = list[i]; if (!ov(b, r)) continue;
        if (r.k === 'ow') { if (dy > 0 && y0 + b.h <= r.y + 0.5) { b.y = r.y - b.h; hit = r; } continue; }
        if (dy > 0 && y0 + b.h <= r.y + 0.5) { b.y = r.y - b.h; hit = r; } else if (dy < 0 && y0 >= r.y + r.h - 0.5) { b.y = r.y + r.h; hit = r; } }
      return hit;
    }
    function fits(rect, list) { for (var i = 0; i < list.length; i++) if (list[i].k !== 'ow' && ov(rect, list[i])) return false; return true; }
    function onTop(o, r) { return Math.abs(o.y + o.h - r.y) < 2.5 && o.x < r.x + r.w - 1 && o.x + o.w > r.x + 1; }

    // кто стоит сверху на прямоугольнике r (тела и ящики) — их везём вместе с опорой
    function riders(r, except) {
      var out = [], d = S.d, i;
      for (i = 0; i < d.bodies.length; i++) { var b = d.bodies[i]; if (b === except || b.lost || b.climb >= 0) continue; if (onTop(b, r)) out.push(b); }
      for (i = 0; i < d.crates.length; i++) { var c = d.crates[i]; if (c === except || c.gone) continue; if (onTop(c, r)) out.push(c); }
      return out;
    }
    function carry(list, dx, dy) {
      list.forEach(function (o) {
        var sl = free(o, solids(o));
        if (dx) moveX(o, dx, sl);
        if (dy) { if (dy < 0) o.y += dy; else moveY(o, dy, sl); }    // вверх — вместе с опорой (опора уже освободила место)
      });
    }
    function weightOn(r, depth) {
      if (depth > 3) return 0; var w = 0;
      riders(r).forEach(function (o) { w += (o.kind && KIND[o.kind] ? KIND[o.kind].wt : CRATE[o.kind].wt) + weightOn(R(o.x, o.y, o.w, 1), depth + 1); });
      return w;
    }

    // ---------- ящики ----------
    function moveCrate(c, dx) {
      var rd = riders(R(c.x, c.y, c.w, c.h, 'crate', c), c), x0 = c.x, sl = free(c, solids(c));
      moveX(c, dx, sl); var mx = c.x - x0; if (mx) carry(rd, mx, 0); return mx;
    }
    function stepCrates(dt) {
      var d = S.d;
      for (var i = 0; i < d.crates.length; i++) {
        var c = d.crates[i]; if (c.gone) continue;
        c.vy = Math.min(C.MAXF, c.vy + C.G * dt);
        var rd = riders(R(c.x, c.y, c.w, c.h), c), y0 = c.y, hy = moveY(c, c.vy * dt, free(c, solids(c)));
        if (c.y !== y0) carry(rd, 0, c.y - y0);
        c.gr = false;
        if (hy) { if (c.vy > 0) { if (c.vy > 300) emit('thud', { x: c.x + c.w / 2, y: c.y + c.h, kind: c.kind }); c.gr = true; } c.vy = 0; }
        if (c.gr) {   // опора меньше половины дна — сползает в пустоту
          var cover = 0, lo = 1e9, hi = -1e9;
          solids(c).forEach(function (q) { if (q.k !== 'ow' && Math.abs(q.y - (c.y + c.h)) < 1.5) { var a0 = Math.max(q.x, c.x), a1 = Math.min(q.x + q.w, c.x + c.w); if (a1 > a0) { cover += a1 - a0; lo = Math.min(lo, a0); hi = Math.max(hi, a1); } } });
          if (cover > 0 && cover < c.w * 0.5) moveCrate(c, ((lo + hi) / 2 < c.x + c.w / 2 ? 1 : -1) * 90 * dt);
        }
        if (c.y > 720) c.gone = true;
      }
    }

    // ---------- мир: плиты, двери, подъёмники, люльки, молоты, фонари, барабаны ----------
    function stepWorld(dt) {
      var L = S.L, d = S.d, i;
      d.time += dt;
      for (i = 0; i < (L.plates || []).length; i++) {
        var pl = L.plates[i], on = weightOn(R(pl.x, pl.y || 440, pl.w, 1), 0) >= pl.min - 1e-6;
        if (on !== d.plates[i].on) emit(on ? 'plateOn' : 'plateOff', { i: i });
        d.plates[i].on = on;
      }
      for (i = 0; i < (L.doors || []).length; i++) {
        var D = L.doors[i], tg = sig(D.link) ? D.dist : 0, dd = d.doors[i], st = clamp(tg - dd.off, -220 * dt, 220 * dt);
        if (st) {
          var old = dd.off; dd.off += st;
          if (st < 0) { var r = doorRect(i), blocked = false; d.bodies.forEach(function (b) { if (!b.lost && ov(r, b)) blocked = true; }); d.crates.forEach(function (c) { if (!c.gone && ov(r, c)) blocked = true; }); if (blocked) dd.off = old; }
          if (Math.abs(dd.off - tg) < 0.01 && old !== dd.off) emit('door', { i: i, open: tg > 0 });
        }
      }
      for (i = 0; i < (L.lifts || []).length; i++) {
        var lf = L.lifts[i], ld = d.lifts[i], tgt = sig(lf.link) ? lf.y2 : lf.y, s2 = clamp(tgt - ld.y, -lf.speed * dt, lf.speed * dt);
        if (s2) { var rr = riders(liftRect(i)); ld.y += s2; carry(rr, 0, s2); if (Math.abs(ld.y - tgt) < 0.01) emit('liftStop', { i: i }); }
      }
      for (i = 0; i < (L.movers || []).length; i++) {
        var m0 = moverRect(i), rm = riders(m0), x1 = moverX(i, d.time + dt) ; if (rm.length) carry(rm, x1 - m0.x, 0);
      }
      for (i = 0; i < (L.crushers || []).length; i++) {
        var cr = L.crushers[i], cd = d.crushers[i], was = cd.off;
        if (cr.stop && sig(cr.stop)) cd.off = Math.max(0, cd.off - 150 * dt); else { cd.t += dt; cd.off = crushOff(i); }
        if (was < cr.drop - 0.5 && cd.off >= cr.drop - 0.5) emit('slam', { i: i, x: cr.x + cr.w / 2, y: cr.y + cr.h + cr.drop });
      }
      for (i = 0; i < (L.lamps || []).length; i++) if (!(L.lamps[i].off && sig(L.lamps[i].off))) d.lampT[i] += dt;
      for (i = 0; i < (L.drums || []).length; i++) {
        var dr = L.drums[i], ds = d.drums[i];
        if (ds.st === 0 && hero().x > dr.trig) { ds.st = 1; emit('rumble', { i: i }); }
        else if (ds.st === 1) { ds.x += dr.speed * dt; ds.rot += dr.speed * dt / dr.r; if (ds.x >= dr.end) { ds.st = 2; emit('drumFall', { i: i }); } }
        else if (ds.st === 2) { ds.vy += C.G * dt; ds.y += ds.vy * dt; ds.rot += 0.02; if (ds.y > 760) ds.st = 3; }
      }
      // кто держит ворот — стоит на месте у рычага
    }

    // ---------- управление: кому идёт ввод ----------
    function inReach(b) { var h = hero(); return Math.abs(b.x + b.w / 2 - (h.x + h.w / 2)) <= C.LINK_R && Math.abs(b.y - h.y) < 400; }
    function ctlBodies() {
      var d = S.d;
      if (d.ctl === 'hero') return [hero()];
      if (d.ctl === 'squad') return d.bodies.filter(function (b) { return b.kind === 'soldier' && b.att && !b.lost && inReach(b); });
      var b = body(d.ctl); return b && !b.lost && inReach(b) ? [b] : [];
    }
    function options() {
      var d = S.d, out = ['hero'], sq = false;
      d.bodies.forEach(function (b) { if (b.kind === 'hero' || !b.att || b.lost || !inReach(b)) return; if (b.kind === 'soldier') { if (!sq) { sq = true; out.push('squad'); } } else out.push(b.id); });
      return out;
    }
    function setCtl(id) {
      var d = S.d; if (d.ctl === id) return;
      if (id !== 'hero') { var h = hero(); if (h.hold >= 0) { h.hold = -1; emit('release', {}); } }
      d.ctl = id; emit('switch', { to: id });
    }
    function switchNext() { var o = options(), i = o.indexOf(S.d.ctl); setCtl(o[(i + 1) % o.length]); }

    function nearLever(b) {
      var L = S.L, cx = b.x + b.w / 2, feet = b.y + b.h;
      for (var i = 0; i < (L.levers || []).length; i++) { var lv = L.levers[i]; if (Math.abs(cx - lv.x) < C.LEV_R && Math.abs(feet - (lv.y || 440)) < 12) return i; }
      return -1;
    }
    function leverDist(b) { var i = nearLever(b); return i < 0 ? 1e9 : Math.abs(b.x + b.w / 2 - S.L.levers[i].x); }
    function actPress(list) {
      var L = S.L, d = S.d;
      if (d.ctl === 'hero') {   // камертон: настроить ближайшую спящую куклу (солдатиков — всех рядом)
        var h = hero(), hc = h.x + h.w / 2, best = null;
        d.bodies.forEach(function (b) { if (b === h || b.att || b.lost) return; var dx = Math.abs(b.x + b.w / 2 - hc); if (dx < C.ATT_R && b.y < h.y + h.h && b.y + b.h > h.y && (!best || dx < best.dx)) best = { b: b, dx: dx }; });
        if (best && nearLever(h) < 0) {
          var t = best.b;
          if (t.kind === 'soldier') d.bodies.forEach(function (b) { if (b.kind === 'soldier' && !b.att && !b.lost && Math.abs(b.x + b.w / 2 - hc) < C.ATT_R && b.y < h.y + h.h && b.y + b.h > h.y) { b.att = true; emit('attune', { id: b.id, kind: b.kind }); } });
          else { t.att = true; emit('attune', { id: t.id, kind: t.kind }); }
          setCtl(t.kind === 'soldier' ? 'squad' : t.id); return;
        }
      }
      var grabbed = false, holders = [];
      // у одного рычага несколько солдатиков строя — берётся ближайший
      list = list.slice().sort(function (a, b) { return leverDist(a) - leverDist(b); });
      list.forEach(function (b) {
        if (b.climb >= 0) return;
        var i = nearLever(b); if (i < 0) { if (b.hold >= 0) holders.push(b); return; }
        var lv = L.levers[i];
        if (lv.mode === 'hold') {
          if (b.hold === i) { holders.push(b); return; }
          if (heldBy(i)) return;
          b.hold = i; grabbed = true; b.vx = 0; emit('grab', { i: i, id: b.id });
        } else if (!grabbed || list.length === 1) { d.levers[i].on = !d.levers[i].on; grabbed = true; emit('lever', { i: i, on: d.levers[i].on, id: b.id }); }
      });
      if (!grabbed) holders.forEach(function (b) { b.hold = -1; emit('release', { id: b.id }); });
    }

    // ---------- тела ----------
    function ladderAt(b) {
      var L = S.L, cx = b.x + b.w / 2;
      for (var i = 0; i < (L.ladders || []).length; i++) { var l = L.ladders[i]; if (cx >= l.x - 3 && cx <= l.x + l.w + 3 && b.y + b.h >= l.y - 1 && b.y < l.y + l.h) return i; }
      return -1;
    }
    function stepBody(b, me, dt) {
      var k = KIND[b.kind];
      if (b.lost) return;
      if (b.hold >= 0) { var lv = S.L.levers[b.hold]; if (!lv) b.hold = -1; else { me = { x: 0, y: 0 }; b.vx = 0; } }
      // лестница (только подмастерье)
      if (k.climb && b.climb < 0) {
        var li = ladderAt(b);
        if (li >= 0) { var l = S.L.ladders[li], atTop = Math.abs(b.y + b.h - l.y) < 2;
          if ((me.up && !atTop && b.y + b.h > l.y + 1) || (me.y > 0 && atTop)) { b.climb = li; b.vx = 0; b.vy = 0; b.x = l.x + l.w / 2 - b.w / 2; emit('ladder', {}); } }
      }
      if (b.climb >= 0) {
        var ld = S.L.ladders[b.climb], vy = ((me.y > 0 ? 1 : 0) - (me.up ? 1 : 0)) * C.CLIMB;
        if (me.jumpEdge || (me.x && !me.up && !me.y)) { b.climb = -1; b.gr = false; if (me.jumpEdge) { b.vy = -k.jump * 0.55; emit('jump', { id: b.id }); } b.vx = me.x * k.run * 0.5; }
        else {
          var sl = free(b, solids(b)), hit = moveY(b, vy * dt, sl);
          b.stepT -= Math.abs(vy) * dt; if (b.stepT <= 0 && vy) { b.stepT = 22; emit('rung', {}); }
          if (b.y + b.h <= ld.y) { b.y = ld.y - b.h; b.climb = -1; b.gr = true; b.vy = 0; }
          else if (hit && vy > 0) { b.climb = -1; b.gr = true; }
          return;
        }
      }
      var dir = me.x || 0, top = b.push > 0 ? k.run * C.PUSH_K : k.run, acc = b.gr ? C.ACC_G : C.ACC_A;
      b.vx += clamp(dir * top - b.vx, -acc * dt, acc * dt);
      if (dir) b.face = sgn(dir);
      if (me.jumpEdge) b.jb = C.JBUF; else b.jb = Math.max(0, b.jb - dt);
      if (b.gr) b.coy = C.COYOTE; else b.coy = Math.max(0, b.coy - dt);
      if (k.jump && b.jb > 0 && b.coy > 0) { b.vy = -k.jump; b.gr = false; b.coy = 0; b.jb = 0; emit('jump', { id: b.id }); }
      b.vy = Math.min(C.MAXF, b.vy + C.G * dt);
      // X: стена, ступенька, толкание ящика; седоков везём следом
      var rd = riders(R(b.x, b.y, b.w, b.h), b), x0 = b.x, sl2 = free(b, solids(b)), dx = b.vx * dt, hit2 = moveX(b, dx, sl2);
      b.push = Math.max(0, b.push - dt);
      if (hit2) {
        if (hit2.k === 'crate' && b.gr && k.push >= CRATE[hit2.ref.kind].need && hit2.ref.gr) {
          var want = x0 + dx - b.x, m = moveCrate(hit2.ref, want);
          if (m) { var sl3 = free(b, solids(b)); moveX(b, m, sl3); b.push = 0.12; } else b.vx = 0;
        } else if (b.gr && hit2.k !== 'crate' && hit2.y >= b.y + b.h - C.STEP_UP && hit2.y < b.y + b.h) {
          var up = { x: b.x + sgn(dx) * 2, y: hit2.y - b.h - 0.01, w: b.w, h: b.h };
          if (fits(up, sl2)) { b.x = up.x; b.y = up.y; } else b.vx = 0;
        } else b.vx = 0;
      }
      if (b.x !== x0 && rd.length) carry(rd, b.x - x0, 0);
      // Y
      var wasGr = b.gr, vy0 = b.vy, y0 = b.y, hy = moveY(b, b.vy * dt, free(b, solids(b)));
      b.gr = false;
      if (hy) { if (b.vy > 0) { b.gr = true; if (!wasGr && vy0 > 260) emit('land', { v: vy0, id: b.id, kind: b.kind }); } b.vy = 0; }
      if (b.y !== y0 && rd.length && b.y > y0) carry(rd, 0, b.y - y0);
      if (b.gr && Math.abs(b.vx) > 25) { b.stepT -= dt * Math.abs(b.vx) / k.run; if (b.stepT <= 0) { b.stepT = b.kind === 'giant' ? 0.5 : 0.28; emit('step', { id: b.id, kind: b.kind }); } }
    }

    // ---------- опасности, звук камертона, отметки ----------
    function lit(b) {
      var L = S.L; if (!(L.lamps || []).length) return false;
      var pts = [[b.x + b.w / 2, b.y + b.h / 2], [b.x + b.w / 2, b.y + 6]], occ = occluders();
      for (var i = 0; i < L.lamps.length; i++) {
        var ls = lampState(i); if (ls.off) continue;
        for (var p = 0; p < pts.length; p++) {
          var dx = pts[p][0] - ls.x, dy = pts[p][1] - ls.y, dist = Math.hypot(dx, dy);
          if (dist > ls.range || Math.abs(wrapA(Math.atan2(dx, dy) - ls.a)) > ls.half) continue;
          var hidden = false;
          for (var o = 0; o < occ.length; o++) if (segHits(ls.x, ls.y, pts[p][0], pts[p][1], occ[o])) { hidden = true; break; }
          if (!hidden) return true;
        }
      }
      return false;
    }
    function occluders() {
      var out = solids(null).filter(function (r) { return r.k !== 'ow'; });
      S.d.bodies.forEach(function (o) { if (!o.lost && KIND[o.kind].opaque) out.push(R(o.x, o.y, o.w, o.h, 'body', o)); });
      return out;
    }
    function hazards() {
      var L = S.L, d = S.d, h = hero(), i;
      for (i = 0; i < d.bodies.length; i++) {
        var b = d.bodies[i]; if (b.lost) continue;
        var isH = b === h;
        if (b.y > 580) return die(isH ? 'fall' : 'doll', b);
        for (var c = 0; c < (L.crushers || []).length; c++) if (ov(b, crushRect(c))) return die(isH ? 'crush' : 'doll', b);
        for (var r = 0; r < (L.drums || []).length; r++) { var ds = d.drums[r], dr = L.drums[r]; if (ds.st === 1 || ds.st === 2) { var nx = clamp(ds.x, b.x, b.x + b.w), ny = clamp(ds.y, b.y, b.y + b.h); if (Math.hypot(nx - ds.x, ny - ds.y) < dr.r - 3) return die(isH ? 'drum' : 'doll', b); } }
      }
      if (lit(h)) return die('light', h);
    }
    function linkCheck() {
      var d = S.d; if (d.ctl === 'hero') return;
      if (!ctlBodies().length) { d.ctl = 'hero'; emit('unlink', {}); }
    }
    function progress() {
      var h = hero(), L = S.L;
      if (S.d.ctl !== 'hero' || !h.gr || h.climb >= 0) return;
      var hc = h.x + h.w / 2;
      for (var i = L.cps.length - 1; i > S.cp; i--) if (hc >= L.cps[i].x && Math.abs(h.y + h.h - (L.cps[i].y || 440)) < 4) { S.cp = i; S.cpSnap = snapshot(); emit('checkpoint', { cp: i }); break; }
      if (hc >= L.exit && (!L.exitY || h.y + h.h <= L.exitY + 4)) {
        if (L.final) { S.phase = 'won'; emit('win', { deaths: S.deaths, time: S.played }); }
        else { S.phase = 'turn'; S.turnT = C.TURN_T; emit('zoneEnd', { z: S.z }); }
      }
    }

    function step() {
      edge.jump = inp.jump && !prev.jump; edge.up = inp.up && !prev.up; edge.act = inp.act && !prev.act; edge.sw = inp.sw && !prev.sw;
      prev.jump = inp.jump; prev.up = inp.up; prev.act = inp.act; prev.sw = inp.sw;
      if (S.phase === 'won') return;
      if (S.phase === 'turn') { S.turnT -= DT; if (S.turnT <= 0) { loadZone(S.z + 1); emit('checkpoint', { cp: 0 }); } return; }
      if (S.dead) { S.dead.t -= DT; if (S.dead.t <= 0) respawn(); return; }
      S.time += DT; S.played += DT;
      if (edge.sw) switchNext();
      stepWorld(DT); stepCrates(DT);
      var list = ctlBodies(), d = S.d;
      if (edge.act) actPress(list);
      var me = { x: inp.x, y: inp.y, up: inp.up, jumpEdge: false };
      for (var i = 0; i < d.bodies.length; i++) {
        var b = d.bodies[i], mine = list.indexOf(b) >= 0;
        var jumpEdge = mine && (edge.jump || (edge.up && (b.kind !== 'hero' || (ladderAt(b) < 0 && b.climb < 0))));
        stepBody(b, mine ? { x: me.x, y: me.y, up: me.up, jumpEdge: jumpEdge } : { x: 0, y: 0, up: false, jumpEdge: false }, DT);
      }
      hazards(); if (S.dead) return;
      linkCheck(); progress();
    }

    var api = {
      start: function () { var sv = opts.save; if (sv && K.LEVELS[sv.z]) loadZone(sv.z, sv.snap, sv.cp); else loadZone(opts.zone || 0); return api; },
      setInput: function (o) { inp.x = o.x || 0; inp.y = o.y || 0; inp.up = !!o.up; inp.jump = !!o.jump; inp.act = !!o.act; inp.sw = !!o.sw; },
      update: function (dt) { S.acc = (S.acc || 0) + Math.min(dt, 0.1); var n = 0; while (S.acc >= DT && n < 14) { S.acc -= DT; step(); n++; } },
      step: step,
      state: function () { return S; },
      saveData: function () { return { z: S.z, cp: S.cp, snap: S.cpSnap }; },
      restartCp: function () { if (!S.dead) { S.stat.resets++; emit('reset', { why: 'menu' }); respawn(); } },
      loadZone: loadZone,
      canSkip: function () { return S.phase === 'play' && !!S.L && !S.L.final && !S.dead; },
      skipZone: function () { if (!api.canSkip()) return false; S.skipped = (S.skipped || 0) + 1; S.phase = 'turn'; S.turnT = C.TURN_T; emit('zoneEnd', { z: S.z, skip: true }); return true; },
      // для рендера, бота и тестов
      hero: hero, body: body, ctlBodies: ctlBodies, options: options, setCtl: setCtl, solids: solids, sig: sig, lit: lit, lampState: lampState, occluders: occluders,
      doorRect: doorRect, liftRect: liftRect, moverRect: moverRect, crushRect: crushRect, nearLever: nearLever, ladderAt: ladderAt, segT: segT, DT: DT
    };
    return api;
  };
  K.util = { ov: ov, clamp: clamp, segHits: segHits, segT: segT };
})(typeof window !== 'undefined' ? window : globalThis);
