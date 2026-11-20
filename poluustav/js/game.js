/* ПОЛУУСТАВ · game.js — логика и физика (чистая, без DOM; работает и в Node для тестов).
   Фиксированный шаг 1/120 с: смещение за шаг ≤ 7.5 px при самой тонкой тверди 12–14 px — туннелирования нет.
   Тела — прямоугольники (AABB), разрешение коллизий по осям X, затем Y. Всё, что меняется в головоломках,
   лежит в S.d (dyn) и снимается целиком в отметку (чекпоинт) — смерть = мгновенный откат к ближайшей отметке.

   Объекты страниц (см. levels.js):
     boxes   — ящик (crate: плавает в воде, тонет в туши), песочница (sand: сушит лужу туши), лампада (lamp: носить/бросать);
     doors   — затвор/люк по ссылке; levers — рычаг (toggle или pulse: сигнал на pulse секунд); plates — плита под весом;
     water   — вода (течение flow, подъём rise по ссылке); ink — лужа туши (сохнет от песка; spread — растекается);
     ropes   — верёвка-маятник; traps — капкан (ящик его разряжает); logs — бревно падает, когда герой проходит trig;
     saws    — пила мельницы (ход по оси; link — стоп/убрать); drips — капли из чернильницы; scales — противовес;
     bridges — мост пера (появляется на время по рычагу, perm — держится плитой; delay/dur — мостки по очереди);
     sketches — карандашный набросок: твёрд только в свете лампады. */
(function (global) {
  'use strict';
  var P = global.POLU = global.POLU || {};
  var DT = 1 / 120;
  var C = P.C = {
    G: 1600, RUN: 165, PUSH: 85, PULL: 70, ACC_G: 1500, ACC_A: 900, JUMP: 580, MAXF: 900,
    HW: 18, HH: 40, COYOTE: 0.09, JBUF: 0.12, STEP_UP: 24, MANT_T: 0.3, PUMP: 3.0, ROPE_GRAB: 16,
    LAMP_R: 140, THROW_VX: 230, THROW_VY: 760, DEAD_T: 1.1, TURN_T: 1.4
  };
  var SIZE = { crate: [40, 40], sand: [40, 40], lamp: [14, 18] };
  var WEIGHT = { crate: 2, sand: 2, lamp: 0.3 };

  function ov(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function R(x, y, w, h, k, ref) { return { x: x, y: y, w: w, h: h, k: k || 's', ref: ref }; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function sgn(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function distRect(px, py, r) { var dx = Math.max(r.x - px, 0, px - (r.x + r.w)), dy = Math.max(r.y - py, 0, py - (r.y + r.h)); return Math.hypot(dx, dy); }

  P.Game = function (opts) {
    opts = opts || {};
    var emit = opts.onEvent || function () {};
    var S = { z: 0, L: null, d: null, time: 0, acc: 0, cp: 0, cpSnap: null, deaths: 0, played: 0,
      phase: 'play', turnT: 0, hero: null, stat: { deaths: 0, resets: 0 } };
    var inp = { x: 0, y: 0, jump: false, up: false, act: false }, prev = { jump: false, up: false, act: false };
    var edge = { jump: false, act: false };
    var statics = [];

    // ---------- загрузка страницы ----------
    function buildDyn(L) {
      return {
        boxes: (L.boxes || []).map(function (b) { var s = SIZE[b.kind]; return { id: b.id, kind: b.kind, x: b.x, y: b.y, w: s[0], h: s[1], vx: 0, vy: 0, gone: false, fixed: false, gr: false }; }),
        doors: (L.doors || []).map(function () { return { off: 0 }; }),
        levers: (L.levers || []).map(function () { return { on: false, p: -1 }; }),
        plates: (L.plates || []).map(function () { return { on: false }; }),
        water: (L.water || []).map(function (w) { return { y: w.y }; }),
        ink: (L.ink || []).map(function (k) { return { dried: false, w: k.w, act: false, t: 0 }; }),
        ropes: (L.ropes || []).map(function () { return { th: 0, om: 0 }; }),
        traps: (L.traps || []).map(function () { return { armed: true }; }),
        logs: (L.logs || []).map(function (g) { return { st: 0, y: g.y, vy: 0, t: 0 }; }),
        saws: (L.saws || []).map(function () { return { t: 0, ret: 0 }; }),
        scales: (L.scales || []).map(function () { return { o: 0 }; }),
        bridges: (L.bridges || []).map(function () { return { age: -1 }; }),
        carry: null, time: 0
      };
    }
    function newHero(x, y) { return { x: x, y: y, vx: 0, vy: 0, gr: true, face: 1, st: 'run', coy: 0, jb: 0, rope: -1, rl: 0, rcd: 0, mt: 0, m0: null, m1: null, deadT: 0, cause: '', push: 0, pull: false, stepT: 0, airT: 0 }; }
    function loadZone(z, snap, cpIdx) {
      S.z = z; S.L = P.LEVELS[z]; S.phase = 'play';
      statics = S.L.solids.map(function (s) { return R(s[0], s[1], s[2], s[3], 's'); });
      S.d = buildDyn(S.L); S.time = 0; S.cp = cpIdx || 0;
      if (snap) { S.d = clone(snap.d); S.time = snap.time || 0; }
      var c = S.L.cps[S.cp]; S.hero = newHero(c.x, c.y);
      S.cpSnap = snapshot();
      emit('zone', { z: z });
    }
    function snapshot() { return { z: S.z, cp: S.cp, d: clone(S.d), time: S.time }; }
    function respawn() {
      S.d = clone(S.cpSnap.d); S.time = S.cpSnap.time; var c = S.L.cps[S.cp]; S.hero = newHero(c.x, c.y);
      emit('respawn', { cp: S.cp });
    }
    function die(cause) {
      var h = S.hero; if (h.st === 'dead') return;
      h.st = 'dead'; h.deadT = C.DEAD_T; h.cause = cause; h.vx = 0; h.vy = 0;
      if (S.d.carry) { S.d.carry = null; }
      S.deaths++; S.stat.deaths++; emit('death', { cause: cause, x: h.x + C.HW / 2, y: h.y + C.HH / 2 });
    }
    function reset(why) { S.stat.resets++; emit('reset', { why: why }); respawn(); }

    // ---------- сигналы ----------
    function sig(link) {
      if (!link) return false;
      var L = S.L, d = S.d, i;
      for (i = 0; i < (L.levers || []).length; i++) { var lv = L.levers[i]; if (lv.link !== link) continue; if (lv.pulse ? (d.levers[i].p >= 0 && d.levers[i].p < lv.pulse) : d.levers[i].on) return true; }
      for (i = 0; i < (L.plates || []).length; i++) if (L.plates[i].link === link && d.plates[i].on) return true;
      return false;
    }
    function leverP(link) { var L = S.L; for (var i = 0; i < (L.levers || []).length; i++) if (L.levers[i].link === link) return S.d.levers[i].p; return -1; }
    function bridgeOn(i) {
      var b = S.L.bridges[i];
      if (b.delay != null) { var p = leverP(b.link); return p >= b.delay && p < b.delay + b.dur; }
      return sig(b.link) || (b.perm ? sig(b.perm) : false);
    }
    function lampPos() {
      var d = S.d, h = S.hero;
      if (d.carry) return { x: h.x + C.HW / 2 + h.face * 8, y: h.y + 18 };
      for (var i = 0; i < d.boxes.length; i++) { var b = d.boxes[i]; if (b.kind === 'lamp' && !b.gone) return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }
      return null;
    }
    function sketchLit(i) { var lp = lampPos(); if (!lp) return false; var k = S.L.sketches[i]; return distRect(lp.x, lp.y, k) < C.LAMP_R; }
    function doorRect(i) { var D = S.L.doors[i], o = S.d.doors[i].off; return R(D.x - (D.dir === 'left' ? o : 0), D.y - (D.dir === 'up' ? o : 0), D.w, D.h, 'door', i); }
    function scaleRects(i) { var c = S.L.scales[i], o = S.d.scales[i].o; return [R(c.a.x, c.a.y + o, c.a.w, 40, 'scale', i), R(c.b.x, c.b.y - o, c.b.w, 40, 'scale', i)]; }
    function inkRect(i) { var k = S.L.ink[i], d = S.d.ink[i], left = k.spread && k.spread.dir < 0; return R(left ? k.x - d.w : k.x, k.y, d.w, k.h, 'ink', i); }
    function flowOf(i) { var w = S.L.water[i]; return w.flowLink && sig(w.flowLink) ? w.flow2 : w.flow; }   // рычаг может развернуть течение
    function waterAt(cx, cy) { var L = S.L; for (var i = 0; i < (L.water || []).length; i++) { var w = L.water[i], lv = S.d.water[i].y; if (cx >= w.x && cx <= w.x + w.w && cy > lv && cy < w.y + w.h + 200) return { w: w, y: lv, i: i }; } return null; }
    function sawPos(i) {
      var s = S.L.saws[i], d = S.d.saws[i], ph = Math.PI * 2 * (d.t / s.period + s.phase);
      if (s.axis === 'x') return { x: s.x + s.amp * Math.sin(ph), y: s.y - d.ret, r: s.r };
      return { x: s.x, y: s.y + s.amp * (0.5 - 0.5 * Math.cos(ph)) - d.ret, r: s.r };
    }
    function dripPos(i) {
      var k = S.L.drips[i], fall = Math.sqrt(2 * (k.y1 - k.y0) / C.G), ph = ((S.time / k.period + k.phase) % 1 + 1) % 1, t = ph * k.period;
      if (t < fall) return { x: k.x, y: k.y0 + 0.5 * C.G * t * t, falling: true, grow: 1 };
      return { x: k.x, y: k.y0, falling: false, grow: (t - fall) / (k.period - fall) };
    }
    function logRect(i) { var g = S.L.logs[i], d = S.d.logs[i]; return R(g.x, d.y, g.w, g.h, 'log', i); }

    // твердь для тела who ('hero' | box): статика + двери + противовес + сухая тушь + бревно + мосты + наброски + ящики
    function solids(who) {
      var L = S.L, d = S.d, out = statics.slice(), i;
      for (i = 0; i < (L.doors || []).length; i++) out.push(doorRect(i));
      for (i = 0; i < (L.scales || []).length; i++) out.push.apply(out, scaleRects(i));
      for (i = 0; i < (L.ink || []).length; i++) if (d.ink[i].dried) out.push(inkRect(i));
      for (i = 0; i < (L.logs || []).length; i++) if (d.logs[i].st === 3) out.push(logRect(i));
      for (i = 0; i < (L.bridges || []).length; i++) if (bridgeOn(i)) { var b = L.bridges[i]; out.push(R(b.x, b.y, b.w, b.h, 'bridge', i)); }
      if (!(who && who.kind === 'lamp')) for (i = 0; i < (L.sketches || []).length; i++) if (sketchLit(i)) {   // свет проходит сквозь свои наброски
        var k = L.sketches[i]; out.push(R(k.x, k.y, k.w, k.h, 'sketch', i)); }
      for (i = 0; i < d.boxes.length; i++) { var bx = d.boxes[i]; if (bx === who || bx.gone || bx.kind === 'lamp' || (d.carry === bx.id)) continue; out.push(R(bx.x, bx.y, bx.w, bx.h, 'box', bx)); }
      return out;
    }
    // всё, что уже пересекается с телом, — не мешает ему (мост/набросок, возникший «внутри» тела, не замуровывает)
    function free(b, list) { // допуск 0.5 px: касание «впритык» после переноса на платформе — не пересечение
      return list.filter(function (r) { return !(b.x < r.x + r.w - 0.5 && b.x + b.w > r.x + 0.5 && b.y < r.y + r.h - 0.5 && b.y + b.h > r.y + 0.5); });
    }
    // упор только в то, что было впереди по ходу (до шага тело не заходило за его край) — без «прыжков» сквозь объекты
    function moveX(b, dx, list) {
      if (!dx) return null; var x0 = b.x; b.x += dx; var hit = null;
      for (var i = 0; i < list.length; i++) { var r = list[i]; if (!ov(b, r)) continue;
        if (dx > 0 && x0 + b.w <= r.x + 0.5) { b.x = r.x - b.w; hit = r; } else if (dx < 0 && x0 >= r.x + r.w - 0.5) { b.x = r.x + r.w; hit = r; } }
      return hit;
    }
    function moveY(b, dy, list) {
      if (!dy) return null; var y0 = b.y; b.y += dy; var hit = null;
      for (var i = 0; i < list.length; i++) { var r = list[i]; if (!ov(b, r)) continue;
        if (dy > 0 && y0 + b.h <= r.y + 0.5) { b.y = r.y - b.h; hit = r; } else if (dy < 0 && y0 >= r.y + r.h - 0.5) { b.y = r.y + r.h; hit = r; } }
      return hit;
    }
    function fits(rect, list) { for (var i = 0; i < list.length; i++) if (ov(rect, list[i])) return false; return true; }
    function heroBox() { var h = S.hero; return { x: h.x, y: h.y, w: C.HW, h: C.HH }; }
    function onTop(body, r) { return Math.abs(body.y + body.h - r.y) < 2.5 && body.x < r.x + r.w - 1 && body.x + body.w > r.x + 1; }

    // перенос «седоков» (герой и ящики сверху) вместе с опорой
    function riders(r, except) {
      var out = [], d = S.d, h = S.hero;
      var on = h.on, mine = h.gr && on && on.k === r.k && on.ref === r.ref && Math.abs(on.x - r.x) < 0.01 && r.k !== 's';
      if (h.st === 'run' && (mine || onTop({ x: h.x, y: h.y, w: C.HW, h: C.HH }, r))) out.push('hero');
      for (var i = 0; i < d.boxes.length; i++) { var b = d.boxes[i]; if (b.gone || b === except || b.fixed || d.carry === b.id) continue; if (onTop(b, r)) out.push(b); }
      return out;
    }
    function carryRiders(list, dx, dy) {
      list.forEach(function (who) {
        if (who === 'hero') {
          var hb = heroBox(), sl = free(hb, solids('hero'));
          if (dx) moveX(hb, dx, sl); if (dy) moveY(hb, dy, sl);
          S.hero.x = hb.x; S.hero.y = hb.y;
        } else { var sl2 = free(who, solids(who)); if (dx) moveX(who, dx, sl2); if (dy) moveY(who, dy, sl2); }
      });
    }
    function moveBox(b, dx, dy) { // ящик со своими седоками
      var rd = riders(R(b.x, b.y, b.w, b.h, 'box', b), b), x0 = b.x, y0 = b.y, sl = free(b, solids(b));
      var hx = null, hy = null;
      if (dx) hx = moveX(b, dx, sl);
      if (dy) { if (dy > 0 && S.hero.st !== 'dead') sl = sl.concat(free(b, [R(S.hero.x, S.hero.y, C.HW, C.HH, 'hero')])); hy = moveY(b, dy, sl); }
      var mx = b.x - x0, my = b.y - y0; if (mx || my) carryRiders(rd, mx, my);
      return { hx: hx, hy: hy, mx: mx, my: my };
    }

    // ---------- кинематика: двери, противовес, вода, бревна, пилы, мосты ----------
    function stepWorld(dt) {
      var L = S.L, d = S.d, i;
      d.time += dt;
      for (i = 0; i < (L.levers || []).length; i++) if (d.levers[i].p >= 0) d.levers[i].p = Math.min(999, d.levers[i].p + dt);
      // плиты
      for (i = 0; i < (L.plates || []).length; i++) {
        var pl = L.plates[i], on = false, pr = R(pl.x, pl.y, pl.w, 1);
        if (S.hero.st === 'run' && S.hero.gr && onTop(heroBox(), pr)) on = true;
        d.boxes.forEach(function (b) { if (!b.gone && b.kind !== 'lamp' && onTop(b, pr)) on = true; });
        if (on !== d.plates[i].on) emit(on ? 'plateOn' : 'plateOff', { i: i });
        d.plates[i].on = on;
      }
      // двери
      for (i = 0; i < (L.doors || []).length; i++) {
        var D = L.doors[i], tg = sig(D.link) ? D.dist : 0, dd = d.doors[i], step = clamp(tg - dd.off, -200 * dt, 200 * dt);
        if (step) {
          var old = dd.off; dd.off += step;
          if (step < 0) { var r = doorRect(i), blocked = ov(r, heroBox()) && S.hero.st !== 'dead'; d.boxes.forEach(function (b) { if (!b.gone && ov(r, b)) blocked = true; }); if (blocked) dd.off = old; }
          if (Math.abs(dd.off - tg) < 0.01 && old !== tg) emit('door', { i: i });
        }
      }
      // противовес
      for (i = 0; i < (L.scales || []).length; i++) {
        var c = L.scales[i], sc = d.scales[i], rs = scaleRects(i), ra = riders(rs[0]), rb = riders(rs[1]);
        var wa = weight(ra), wb = weight(rb), dir = sgn(wa - wb);
        if (!wa && !wb) dir = -sgn(sc.o) * (Math.abs(sc.o) > 1 ? 1 : 0) * 0.4;
        var no = clamp(sc.o + dir * c.speed * dt, -c.range, c.range), dO = no - sc.o;
        if (dO) {
          // не давим героя сверху поднимающейся платформой
          sc.o = no; var nr = scaleRects(i), hb = heroBox();
          if (S.hero.st !== 'dead' && ((ov(nr[0], hb) && ra.indexOf('hero') < 0) || (ov(nr[1], hb) && rb.indexOf('hero') < 0))) { sc.o -= dO; }
          else { carryRiders(ra, 0, dO); carryRiders(rb, 0, -dO); }
        }
      }
      // вода
      for (i = 0; i < (L.water || []).length; i++) { var w = L.water[i]; if (!w.rise) continue; var wt = sig(w.rise.link) ? w.rise.y : w.y; d.water[i].y += clamp(wt - d.water[i].y, -w.rise.speed * dt, w.rise.speed * dt); }
      // тушь растекается
      for (i = 0; i < (L.ink || []).length; i++) {
        var k = L.ink[i], ki = d.ink[i]; if (!k.spread || ki.dried) continue;
        if (!ki.act && S.hero.x > k.spread.trig) { ki.act = true; ki.t = 0; emit('spill', { i: i }); }
        if (ki.act) { ki.t += dt; if (ki.t > k.spread.delay) ki.w = Math.min(k.spread.max, ki.w + k.spread.speed * dt); }
      }
      // бревна
      for (i = 0; i < (L.logs || []).length; i++) {
        var g = L.logs[i], gd = d.logs[i];
        if (gd.st === 0 && S.hero.x + C.HW > g.trig && S.hero.st !== 'dead') { gd.st = 1; gd.t = g.delay; emit('creak', { i: i }); }
        else if (gd.st === 1) { gd.t -= dt; if (gd.t <= 0) gd.st = 2; }
        else if (gd.st === 2) { gd.vy += C.G * dt; gd.y += gd.vy * dt; if (gd.y >= g.yEnd) { gd.y = g.yEnd; gd.st = 3; emit('thump', { i: i }); } }
      }
      // пилы
      for (i = 0; i < (L.saws || []).length; i++) {
        var s = L.saws[i], sd = d.saws[i], stop = s.link && sig(s.link);
        if (stop) sd.ret = Math.min(s.retract || 0, sd.ret + 120 * dt); else { sd.ret = Math.max(0, sd.ret - 120 * dt); sd.t += dt; }
      }
      // мосты пера — возраст для рисования
      for (i = 0; i < (L.bridges || []).length; i++) { var bo = bridgeOn(i), bg = d.bridges[i]; if (bo) { if (bg.age < 0) emit('quill', { i: i }); bg.age = bg.age < 0 ? 0 : bg.age + dt; } else bg.age = -1; }
    }
    function weight(list) { var w = 0; list.forEach(function (x) { w += x === 'hero' ? 1 : (WEIGHT[x.kind] || 1); }); return w; }

    // ---------- ящики ----------
    function stepBoxes(dt) {
      var d = S.d, L = S.L;
      for (var i = 0; i < d.boxes.length; i++) {
        var b = d.boxes[i]; if (b.gone || b.fixed || d.carry === b.id) continue;
        var cx = b.x + b.w / 2, wa = waterAt(cx, b.y + b.h - 2);
        if (wa && b.kind === 'lamp') { b.gone = true; emit('splash', { x: cx, y: wa.y }); reset('lamp'); return; }
        if (wa) {
          var load = riders(R(b.x, b.y, b.w, b.h, 'box', b), b).length;
          var target = wa.y - b.h * 0.55 + load * 4;
          if (!b.wet) { b.wet = true; emit('splash', { x: cx, y: wa.y }); }
          b.vy += ((target - b.y) * 22 - b.vy * 6) * dt; b.vx += (flowOf(wa.i) - b.vx) * 1.6 * dt;
        } else {
          b.wet = false;
          b.vy = Math.min(C.MAXF, b.vy + C.G * dt);
          if (b.gr) b.vx *= Math.pow(0.0001, dt);
        }
        var r = moveBox(b, b.vx * dt, b.vy * dt);
        if (r.hx) b.vx = 0;
        b.gr = false;
        if (r.hy) { if (b.vy > 0) { if (b.vy > 300) emit('thud', { x: cx, y: b.y + b.h, kind: b.kind }); b.gr = true; } b.vy = 0; }
        // ящик опрокидывается с края: опора меньше половины дна — сползает в сторону пустоты
        if (b.gr && !wa && b.kind !== 'lamp') {
          var sup = solids(b), lo = 1e9, hi = -1e9, cover = 0;
          sup.forEach(function (q) { if (Math.abs(q.y - (b.y + b.h)) < 1.5) { var a0 = Math.max(q.x, b.x), a1 = Math.min(q.x + q.w, b.x + b.w); if (a1 > a0) { cover += a1 - a0; lo = Math.min(lo, a0); hi = Math.max(hi, a1); } } });
          if (cover > 0 && cover < b.w * 0.5) { var side = (lo + hi) / 2 < cx ? 1 : -1; moveBox(b, side * 90 * dt, 0); }
        }
        // тушь: песок сушит лужу, ящик тонет до дна, лампада гаснет
        for (var k = 0; k < (L.ink || []).length; k++) {
          if (d.ink[k].dried || d.ink[k].w <= 0) continue; var ir = inkRect(k);
          if (ov(b, ir)) {
            if (b.kind === 'sand') { d.ink[k].dried = true; b.gone = true; emit('dry', { i: k, x: cx, y: ir.y }); break; }
            if (b.kind === 'lamp') { b.gone = true; reset('lamp'); return; }
          }
        }
        // капкан: ящик на капкане — капкан сработал, ящик зажат
        for (var t = 0; t < (L.traps || []).length; t++) { if (!d.traps[t].armed || b.kind === 'lamp') continue; var tr = L.traps[t]; if (ov(b, R(tr.x, tr.y - 14, tr.w, 14))) { d.traps[t].armed = false; b.fixed = true; emit('snap', { x: tr.x + tr.w / 2, y: tr.y, box: true }); } }
        if (b.y > 720) { b.gone = true; if (b.kind === 'lamp') { reset('lamp'); return; } }
      }
    }

    // ---------- герой ----------
    function stepHero(dt) {
      var h = S.hero, d = S.d, L = S.L;
      if (h.st === 'dead') { h.deadT -= dt; if (h.deadT <= 0) respawn(); return; }
      h.rcd = Math.max(0, h.rcd - dt);
      if (edge.jump) h.jb = C.JBUF; else h.jb = Math.max(0, h.jb - dt);
      if (h.st === 'mantle') {
        h.mt += dt; var f = Math.min(1, h.mt / C.MANT_T), fy = Math.min(1, f * 1.6), fx = Math.max(0, (f - 0.45) / 0.55);
        h.x = h.m0.x + (h.m1.x - h.m0.x) * fx; h.y = h.m0.y + (h.m1.y - h.m0.y) * fy;
        if (f >= 1) { h.st = 'run'; h.gr = true; h.vx = 0; h.vy = 0; emit('land', {}); }
        return;
      }
      if (h.st === 'rope') { stepRope(dt); return; }

      // действие: рычаг / лампада
      if (edge.act) actPress();

      var dir = inp.x, hb = heroBox();
      // тянуть ящик: действие зажато, ящик вплотную сбоку, идём от него
      var pullBox = null;
      if (inp.act && h.gr && !d.carry) pullBox = adjacentBox();
      h.pull = !!(pullBox && dir && sgn(dir) === -pullBox.side);
      var top = h.pull ? C.PULL : (h.push > 0 ? C.PUSH : C.RUN);
      var target = dir * top, acc = h.gr ? C.ACC_G : C.ACC_A;
      h.vx += clamp(target - h.vx, -acc * dt, acc * dt);
      if (dir) h.face = h.pull ? pullBox.side : sgn(dir);
      if (h.gr) { h.coy = C.COYOTE; h.airT = 0; } else { h.coy = Math.max(0, h.coy - dt); h.airT += dt; }
      if (h.jb > 0 && h.coy > 0) { h.vy = -C.JUMP; h.gr = false; h.coy = 0; h.jb = 0; emit('jump', {}); }
      h.vy = Math.min(C.MAXF, h.vy + C.G * dt);

      // X
      var sl = free(hb, solids('hero')), dx = h.vx * dt, x0 = hb.x, hit = moveX(hb, dx, sl);
      h.push = Math.max(0, h.push - dt);
      if (hit) {
        if (hit.k === 'box' && h.gr && !hit.ref.fixed && hit.ref.gr !== undefined && !h.pull) {
          // толкаем ящик: двигаем его на остаток пути и доходим сами
          var want = x0 + dx - hb.x, m = moveBox(hit.ref, want, 0);
          if (m.mx) { hb.x += m.mx; h.push = 0.12; if (Math.random() < 0) emit('push', {}); }
          else h.vx = 0;
        } else if (h.gr && hit.y >= hb.y + hb.h - C.STEP_UP && hit.y < hb.y + hb.h) {
          var up = { x: hb.x + sgn(dx) * 2, y: hit.y - C.HH - 0.01, w: C.HW, h: C.HH };
          if (fits(up, sl)) { hb.y = up.y; hb.x = up.x; } else h.vx = 0;
        } else if (!h.gr && dir && sgn(dir) === sgn(dx) && !d.carry && hb.y >= hit.y - C.HH && hb.y <= hit.y + 26) {
          var tx = dir > 0 ? hit.x + 1 : hit.x + hit.w - C.HW - 1, ty = hit.y - C.HH - 0.01, tgt = { x: tx, y: ty, w: C.HW, h: C.HH };
          var col = { x: hb.x, y: ty, w: C.HW, h: hb.y - ty + 1 };
          if (fits(tgt, sl) && fits(col, sl)) { h.st = 'mantle'; h.mt = 0; h.m0 = { x: hb.x, y: hb.y }; h.m1 = { x: tx, y: ty }; h.vx = 0; h.vy = 0; h.x = hb.x; h.y = hb.y; emit('mantle', {}); return; }
          h.vx = 0;
        } else h.vx = 0;
      }
      if (h.pull && pullBox) {
        var moved = hb.x - x0; if (moved) { var mb = moveBox(pullBox.b, moved, 0); if (Math.abs(mb.mx - moved) > 0.01) { hb.x = x0 + mb.mx; } }
      }
      // Y
      var wasGr = h.gr, vy0 = h.vy; sl = free(hb, solids('hero'));
      var hy = moveY(hb, h.vy * dt, sl);
      h.gr = false;
      h.on = null;
      if (hy) { if (h.vy > 0) { h.gr = true; h.on = hy; if (!wasGr && vy0 > 250) emit('land', { v: vy0 }); } h.vy = 0; }
      h.x = hb.x; h.y = hb.y;
      // шаги пера
      if (h.gr && Math.abs(h.vx) > 30) { h.stepT -= dt * Math.abs(h.vx) / C.RUN; if (h.stepT <= 0) { h.stepT = 0.27; emit('step', { push: h.push > 0 || h.pull }); } }
      // верёвка
      if (!h.gr && h.rcd <= 0 && !d.carry) tryGrab();
    }
    function adjacentBox() {
      var h = S.hero, d = S.d;
      for (var i = 0; i < d.boxes.length; i++) {
        var b = d.boxes[i]; if (b.gone || b.fixed || b.kind === 'lamp') continue;
        if (Math.abs((b.y + b.h) - (h.y + C.HH)) > 8) continue;
        if (Math.abs(b.x + b.w - h.x) < 3) return { b: b, side: -1 };
        if (Math.abs(h.x + C.HW - b.x) < 3) return { b: b, side: 1 };
      }
      return null;
    }
    function actPress() {
      var h = S.hero, d = S.d, L = S.L, hb = heroBox(), i;
      for (i = 0; i < (L.levers || []).length; i++) {
        var lv = L.levers[i];
        if (ov(hb, R(lv.x - 16, lv.y - 60, 32, 60))) {
          if (lv.pulse) d.levers[i].p = 0; else d.levers[i].on = !d.levers[i].on;
          emit('lever', { i: i, on: lv.pulse ? true : d.levers[i].on }); return;
        }
      }
      if (d.carry) { // бросить (в движении) или поставить
        var lb = d.boxes.filter(function (b) { return b.id === d.carry; })[0];
        lb.vx = 0; lb.vy = 0; lb.gr = false;
        if (inp.x) { lb.x = h.x + C.HW / 2 - lb.w / 2 + h.face * 6; lb.y = h.y + 2; lb.vx = h.face * C.THROW_VX + h.vx * 0.2; lb.vy = -C.THROW_VY; emit('throw', {}); }
        else { lb.x = h.face > 0 ? h.x + C.HW + 2 : h.x - lb.w - 2; lb.y = h.y + C.HH - lb.h - 1; emit('drop', {}); }
        // не ставим в стену
        var sl = solids(lb); if (!fits(lb, sl)) { lb.x = h.x + C.HW / 2 - lb.w / 2; lb.y = h.y + C.HH - lb.h - 1; }
        d.carry = null; return;
      }
      for (i = 0; i < d.boxes.length; i++) { var b = d.boxes[i]; if (b.kind === 'lamp' && !b.gone && ov({ x: hb.x - 14, y: hb.y - 4, w: hb.w + 28, h: hb.h + 8 }, b)) { d.carry = b.id; emit('pick', {}); return; } }
    }
    function tryGrab() {
      var h = S.hero, L = S.L, d = S.d, hx = h.x + C.HW / 2, hy = h.y + 6;
      for (var i = 0; i < (L.ropes || []).length; i++) {
        var r = L.ropes[i], th = d.ropes[i].th, ex = r.ax + Math.sin(th) * r.len, ey = r.ay + Math.cos(th) * r.len;
        var vx = ex - r.ax, vy = ey - r.ay, t = clamp(((hx - r.ax) * vx + (hy - r.ay) * vy) / (vx * vx + vy * vy), 0, 1);
        var px = r.ax + vx * t, py = r.ay + vy * t;
        if (Math.hypot(hx - px, hy - py) < C.ROPE_GRAB && t > 0.2) {
          var len = clamp(Math.hypot(hx - r.ax, hy - r.ay), 40, r.len), a = Math.atan2(hx - r.ax, hy - r.ay);
          h.st = 'rope'; h.rope = i; h.rl = len; d.ropes[i].th = a; d.ropes[i].om = (h.vx * Math.cos(a) - h.vy * Math.sin(a)) / len;
          h.vx = 0; h.vy = 0; emit('grab', { i: i }); return;
        }
      }
    }
    function stepRope(dt) {
      var h = S.hero, r = S.L.ropes[h.rope], rd = S.d.ropes[h.rope];
      if (inp.up) h.rl = Math.max(40, h.rl - 70 * dt);
      if (inp.y > 0) h.rl = Math.min(r.len, h.rl + 90 * dt);
      var alpha = -(C.G / h.rl) * Math.sin(rd.th) + inp.x * C.PUMP;
      var th0 = rd.th; rd.om += alpha * dt; rd.om *= (1 - 0.12 * dt); rd.th = clamp(rd.th + rd.om * dt, -1.35, 1.35);
      var nx = r.ax + Math.sin(rd.th) * h.rl - C.HW / 2, ny = r.ay + Math.cos(rd.th) * h.rl - 6;
      var hb = { x: nx, y: ny, w: C.HW, h: C.HH };
      if (!fits(hb, solids('hero'))) { rd.th = th0; rd.om = -rd.om * 0.3; }
      else { h.x = nx; h.y = ny; }
      if (inp.x) h.face = sgn(inp.x); else if (Math.abs(rd.om) > 0.3) h.face = sgn(rd.om);
      if (edge.jump) {
        var v = rd.om * h.rl; h.vx = v * Math.cos(rd.th); h.vy = -v * Math.sin(rd.th) - 160;
        h.st = 'run'; h.gr = false; h.rcd = 0.35; h.coy = 0; h.jb = 0; emit('release', {});
      }
    }
    function stepFreeRopes(dt) {
      var L = S.L, d = S.d;
      for (var i = 0; i < (L.ropes || []).length; i++) {
        if (S.hero.st === 'rope' && S.hero.rope === i) continue;
        var r = L.ropes[i], rd = d.ropes[i]; rd.om += -(C.G / r.len) * Math.sin(rd.th) * dt; rd.om *= (1 - 0.6 * dt); rd.th += rd.om * dt;
      }
    }

    // ---------- опасности, отметки, выход ----------
    function hazards() {
      var h = S.hero, L = S.L, d = S.d, i; if (h.st === 'dead' || h.st === 'mantle') return;
      var hb = heroBox(), cx = h.x + C.HW / 2, cy = h.y + C.HH / 2;
      if (h.y > 560) return die('fall');
      if (waterAt(cx, cy)) return die('water');
      for (i = 0; i < (L.ink || []).length; i++) if (!d.ink[i].dried && d.ink[i].w > 0 && ov(hb, inkRect(i))) return die('ink');
      for (i = 0; i < (L.traps || []).length; i++) { var t = L.traps[i]; if (d.traps[i].armed && ov(hb, R(t.x + 4, t.y - 12, t.w - 8, 12))) { d.traps[i].armed = false; emit('snap', { x: t.x + t.w / 2, y: t.y }); return die('trap'); } }
      for (i = 0; i < (L.logs || []).length; i++) if (d.logs[i].st === 2 && ov(hb, logRect(i))) return die('log');
      for (i = 0; i < (L.saws || []).length; i++) { var s = sawPos(i), rr = s.r * 0.82; if (distRect(s.x, s.y, hb) < rr) return die('saw'); }
      for (i = 0; i < (L.drips || []).length; i++) { var dp = dripPos(i); if (dp.falling && ov(hb, R(dp.x - 5, dp.y - 8, 10, 14))) return die('drip'); }
    }
    function progress() {
      var h = S.hero, L = S.L;
      if (h.st !== 'run' || !h.gr) return;
      var hc = h.x + C.HW / 2;
      for (var i = L.cps.length - 1; i > S.cp; i--) if (hc >= L.cps[i].x) { S.cp = i; S.cpSnap = snapshot(); emit('checkpoint', { cp: i, save: api.saveData() }); break; }
      if (hc >= L.exit) {
        if (L.final) { S.phase = 'won'; emit('win', { deaths: S.deaths, time: S.played }); }
        else { S.phase = 'turn'; S.turnT = C.TURN_T; emit('page', { z: S.z }); }
      }
    }

    function step() {
      edge.jump = (inp.jump && !prev.jump) || (inp.up && !prev.up);
      edge.act = inp.act && !prev.act;
      prev.jump = inp.jump; prev.up = inp.up; prev.act = inp.act;
      if (S.phase === 'won') return;
      if (S.phase === 'turn') { S.turnT -= DT; if (S.turnT <= 0) { loadZone(S.z + 1); emit('checkpoint', { cp: 0, save: api.saveData() }); } return; }
      S.time += DT; S.played += DT;
      stepWorld(DT); stepBoxes(DT); stepHero(DT); stepFreeRopes(DT); hazards(); progress();
    }

    var api = {
      start: function () { var sv = opts.save; if (sv && P.LEVELS[sv.z]) loadZone(sv.z, sv.snap, sv.cp); else loadZone(opts.zone || 0); return api; },
      setInput: function (o) { inp.x = o.x || 0; inp.y = o.y || 0; inp.jump = !!o.jump; inp.up = !!o.up; inp.act = !!o.act; },
      update: function (dt) { S.acc += Math.min(dt, 0.1); var n = 0; while (S.acc >= DT && n < 14) { S.acc -= DT; step(); n++; } },
      step: step,
      state: function () { return S; },
      saveData: function () { return { z: S.z, cp: S.cp, snap: S.cpSnap }; },
      restartCp: function () { if (S.hero.st !== 'dead') reset('menu'); },
      loadZone: loadZone,
      // для рендера и тестов
      solids: solids, sig: sig, bridgeOn: bridgeOn, sketchLit: sketchLit, lampPos: lampPos, doorRect: doorRect, scaleRects: scaleRects,
      inkRect: inkRect, flowOf: flowOf, sawPos: sawPos, dripPos: dripPos, logRect: logRect, waterAt: waterAt, heroBox: heroBox, adjacentBox: adjacentBox, DT: DT
    };
    return api;
  };
  P.util = { ov: ov, distRect: distRect, clamp: clamp };
})(typeof window !== 'undefined' ? window : globalThis);
