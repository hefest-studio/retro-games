/* ЩЁЛК · логика (без DOM, детерминирована при заданном сиде). TSEP.Game(opts), TSEP.logic.
   Единицы — клетки (16 px) и секунды, y вниз; тело: x — центр, y — подошвы. Шаг — 1/60.
   Физика героя: ход, прыжок с фиксированной дугой, отвесный сход с края, лестницы наискось (вход ↑ у низа / ↓ у верха),
   отбрасывание при ударе (на лестнице — без отброса), площадки-маятники и шестерни-подъёмники (опора сверху, везут героя).
   ГЛАВНАЯ МЕХАНИКА — «щелчок фаз»: у мира две фазы, ТИК (0) и ТАК (1). Блоки ТИК твёрдые только в фазе ТИК, блоки ТАК — только в ТАК
   (в чужой фазе — призрак, проходимый). Одна кнопка — щелчок: переключает фазу мира и расходящейся волной (радиус по ступени катушки)
   бьёт всё вокруг героя: врагов, стража, снаряды. Блок, выросший на враге, давит его; опора, ушедшая из-под врага, роняет его.
   Щелчок «заклинивает» (ничего не происходит), если новая фаза замуровала бы героя или убрала опору у стоящего на фазовом блоке.
   Перезарядка — K.FLICK_CD. Граф проходимости строится прогоном той же физики (Nav): узел = клетка × фаза, рёбра ходьбы/прыжка
   (в т. ч. прыжок со щелчком в воздухе), щелчок на месте, лестницы; маятники и подъёмники — контроллером rideCtl. */
(function (global) {
  'use strict';
  var T = global.TSEP = global.TSEP || {};
  var TL = T.TILES, E = TL.E, SOL = TL.SOL, ONE = TL.ONE, SAW = TL.SAW, PA = TL.PA, PB = TL.PB;
  var K = {
    WALK: 3.4, G: 36, JV: 13.4, MAXF: 17, HW: 0.3, HH: 1.8, HC: 1.15, STAIR: 2.3,
    KBX: 3.2, KBV: 7.5, INV: 1.6, HP: 16, LIVES: 3, CONTS: 3,
    FLICK_CD: 0.7, R: [0, 2.3, 2.9, 3.5], DMG: [0, 1, 1, 2], SPARKPTS: 10,
    SPARK0: 0, SPARKMAX: 99, DEAD: 1.8, CLEAR: 3.2,
    LIFE1: 20000, LIFESTEP: 40000, SAWDMG: 3
  };
  var FOE = {
    tick: { hp: 1, w: 0.8, h: 0.7, dmg: 2, pts: 100, sp: 1.3 },
    moth: { hp: 1, w: 0.9, h: 0.7, dmg: 2, pts: 200, sp: 2.6, fly: true },
    oiler: { hp: 2, w: 0.9, h: 1.4, dmg: 2, pts: 300, sp: 0.7 },
    springer: { hp: 2, w: 0.8, h: 0.9, dmg: 2, pts: 300, sp: 2.6 },
    guard: { hp: 4, w: 0.9, h: 1.9, dmg: 3, pts: 500, sp: 1.0 }
  };
  var BOSS = {
    cuckoo: { w: 1.2, h: 1.2, dmg: 3 }, pendulum: { w: 1.7, h: 1.7, dmg: 4 }, drake: { w: 2.6, h: 2.0, dmg: 4 },
    spider: { w: 2.0, h: 1.4, dmg: 4 }, flywheel: { w: 1.8, h: 1.8, dmg: 4 }, heart: { w: 2.4, h: 2.4, dmg: 4 }
  };
  var NOP = function () {};
  function sgn(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // ГСЧ с состоянием в S (для клонирования партии)
  function rnd(S) { var a = S.rs = (S.rs + 0x6D2B79F5) | 0, t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }

  // ---------- мир ----------
  function tileAt(lv, c, r) { if (c < 0 || c >= lv.W) return SOL; if (r < 0) return lv.open ? E : SOL; if (r >= lv.H) return E; var v = lv.t[r * lv.W + c]; if (v >= PA) return v === PA ? (lv.ph === 0 ? SOL : E) : (lv.ph === 1 ? SOL : E); return v; }
  function solid(Wd, c, r) {
    var lv = Wd.lv, v = tileAt(lv, c, r);
    if (v === SOL) return true;
    if (Wd.gate && c === lv.gate.x && r < lv.gate.y && r >= lv.arena.y0) return true;
    return false;
  }
  function floorAt(Wd, c, r, prevY) { var v = tileAt(Wd.lv, c, r); if (v === SOL || solid(Wd, c, r)) return true; return v === ONE && prevY <= r + 0.02; }
  function platAt(m, t) {
    if (m.kind === 'pend') { var th = m.amp * Math.sin(2 * Math.PI * t / m.per + m.ph); return { cx: m.px + m.len * Math.sin(th), top: m.py + m.len * Math.cos(th), w: m.w, th: th }; }
    return { cx: m.x + m.w / 2, top: m.y - m.h * (0.5 - 0.5 * Math.cos(2 * Math.PI * t / m.per + m.ph)), w: m.w };
  }
  function sawHit(lv, x0, y0, x1, y1) {
    var c0 = Math.floor(x0), c1 = Math.floor(x1), r0 = Math.floor(y0), r1 = Math.floor(y1);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (tileAt(lv, c, r) === SAW) {
      var cx = clamp(c + 0.5, x0, x1), cy = clamp(r + 0.5, y0, y1), dx = cx - c - 0.5, dy = cy - r - 0.5;
      if (dx * dx + dy * dy < 0.42 * 0.42) return { x: c + 0.5, y: r + 0.5 };
    }
    return null;
  }

  // ---------- герой ----------
  function newHero(x, y) { return { x: x, y: y, vx: 0, vy: 0, face: 1, ground: true, on: -1, stair: null, crouch: false, kb: false, inv: 0, walkT: 0, airT: 0, land: 0, fl: 0 }; }
  function hh(h) { return h.crouch ? K.HC : K.HH; }
  // Wd: { lv, t (время уровня в начале шага), gate (ворота закрыты), chain, noPlat, ev }
  function heroStep(Wd, h, inp, dt) {
    var lv = Wd.lv, ev = Wd.ev || NOP, i, s;
    h.land = 0;
    if (h.inv > 0) h.inv -= dt;
    if (h.fl > 0) h.fl -= dt;
    // --- на лестнице ---
    if (h.stair) {
      s = lv.stairs[h.stair.i];
      var d = s.dir, mv = 0;
      if (inp.up || inp.dx === d) mv = 1; else if (inp.down || inp.dx === -d) mv = -1;
      h.stair.p += mv * K.STAIR * dt; if (mv) { h.face = mv > 0 ? d : -d; h.walkT += dt; }
      h.vx = h.vy = 0; h.crouch = false;
      if (h.stair.p >= s.n) { h.x = s.tx; h.y = s.ty; h.stair = null; h.ground = true; h.on = -1; }
      else if (h.stair.p <= 0) { h.x = s.bx; h.y = s.by; h.stair = null; h.ground = true; h.on = -1; }
      else { h.x = s.bx + d * h.stair.p; h.y = s.by - h.stair.p; }
      return;
    }
    var pl = null;   // опоры: [{m, a, b}]
    if (!Wd.noPlat && lv.mov.length) { pl = []; for (i = 0; i < lv.mov.length; i++) pl.push({ m: lv.mov[i], a: platAt(lv.mov[i], Wd.t), b: platAt(lv.mov[i], Wd.t + dt) }); }
    var carry = 0;
    if (h.ground) {
      h.airT = 0;
      // вход на лестницу
      var mount = -1, mx = 0, mp = 0;
      if ((inp.up || inp.down) && !h.kb && h.on < 0) {
        for (i = 0; i < lv.stairs.length; i++) {
          s = lv.stairs[i];
          if (inp.up && Math.abs(h.y - s.by) < 0.01 && Math.abs(h.x - s.bx) < 0.9) { mount = i; mx = s.bx; mp = 0; break; }
          if (inp.down && Math.abs(h.y - s.ty) < 0.01 && Math.abs(h.x - s.tx) < 0.9) { mount = i; mx = s.tx; mp = s.n; break; }
        }
      }
      if (mount >= 0) {
        var gap = mx - h.x;
        if (Math.abs(gap) <= K.WALK * dt + 1e-9) { h.x = mx; h.stair = { i: mount, p: mp }; h.crouch = false; h.vx = 0; ev('stair'); return; }
        h.vx = sgn(gap) * K.WALK; h.face = sgn(gap); h.crouch = false; h.walkT += dt;
      } else if (inp.jump && !h.kb) {
        h.vy = -K.JV; h.vx = (inp.dx || 0) * K.WALK; if (inp.dx) h.face = inp.dx;
        h.ground = false; h.on = -1; h.crouch = false; h.jumped = true; ev('jump');
      } else {
        h.crouch = !!inp.down && !h.kb;
        h.vx = h.crouch ? 0 : (inp.dx || 0) * K.WALK;
        if (inp.dx) h.face = inp.dx;
        if (h.vx) h.walkT += dt; else h.walkT = 0;
      }
      if (h.on >= 0 && pl) { var P = pl[h.on]; carry = P.b.cx - P.a.cx; }
    } else {
      h.airT += dt;
      h.vy = Math.min(K.MAXF, h.vy + K.G * dt);
      h.crouch = false;
    }
    // --- по X ---
    var top = h.y - hh(h), r0 = Math.floor(top + 1e-6), r1 = Math.floor(h.y - 1e-6), r;
    h.x += h.vx * dt + carry;
    if (h.vx + carry > 0) { var cr = Math.floor(h.x + K.HW - 1e-6); for (r = r0; r <= r1; r++) if (solid(Wd, cr, r)) { h.x = cr - K.HW; if (!h.ground) h.vx = 0; break; } }
    else if (h.vx + carry < 0) { var cl = Math.floor(h.x - K.HW + 1e-6); for (r = r0; r <= r1; r++) if (solid(Wd, cl, r)) { h.x = cl + 1 + K.HW; if (!h.ground) h.vx = 0; break; } }
    var c0 = Math.floor(h.x - K.HW + 1e-6), c1 = Math.floor(h.x + K.HW - 1e-6), c;
    // --- по Y ---
    if (h.ground) {
      if (h.on >= 0 && pl) {
        var Q = pl[h.on];
        if (Math.abs(h.x - Q.b.cx) <= Q.b.w / 2 + K.HW * 0.6) { h.y = Q.b.top; return; }
        h.ground = false; h.on = -1; h.vy = Math.max(0, (Q.b.top - Q.a.top) / dt); h.vx = 0; return;
      }
      var sup = false; for (c = c0; c <= c1; c++) if (floorAt(Wd, c, Math.round(h.y), h.y)) { sup = true; break; }
      if (!sup) { h.ground = false; h.vy = 0; h.vx = 0; h.on = -1; }
      return;
    }
    var py = h.y; h.y += h.vy * dt;
    if (h.vy > 0) {
      var land = null, on = -1;
      for (r = Math.ceil(py - 1e-6); r <= Math.floor(h.y); r++) { for (c = c0; c <= c1; c++) if (floorAt(Wd, c, r, py)) { land = r; break; } if (land != null) break; }
      if (pl) for (i = 0; i < pl.length; i++) {
        var A = pl[i].a, B = pl[i].b;
        if (py <= A.top + 0.06 && h.y >= B.top && Math.abs(h.x - B.cx) <= B.w / 2 + K.HW * 0.6 && (land == null || B.top < land)) { land = B.top; on = i; }
      }
      if (land != null) { h.land = h.vy; h.y = land; h.vy = 0; h.ground = true; h.on = on; h.vx = 0; if (h.kb) h.kb = false; h.jumped = false; ev('land'); }
    } else if (h.vy < 0) {
      var rt = Math.floor(h.y - hh(h));
      for (c = c0; c <= c1; c++) if (solid(Wd, c, rt)) { h.y = rt + 1 + hh(h); h.vy = 0; break; }
    }
  }
  // ---------- граф проходимости ----------
  function staticWorld(lv) { return { lv: lv, t: 0, gate: false, noPlat: true }; }
  function standable(lv, c, r) {
    if (c < 1 || c > lv.W - 2 || r < 1) return false;
    var v = tileAt(lv, c, r); if (v !== SOL && v !== ONE) return false;
    var a = tileAt(lv, c, r - 1), b = tileAt(lv, c, r - 2);
    return a !== SOL && b !== SOL && a !== SAW && b !== SAW;
  }
  // тело героя замуровано твёрдой клеткой (после смены фазы)
  function bodyBlocked(lv, h) {
    var Wd = { lv: lv, gate: false }, top = h.y - hh(h), c0 = Math.floor(h.x - K.HW + 1e-6), c1 = Math.floor(h.x + K.HW - 1e-6), r0 = Math.floor(top + 1e-6), r1 = Math.floor(h.y - 1e-6);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (solid(Wd, c, r)) return true;
    return false;
  }
  function supported(lv, h) {
    var Wd = { lv: lv, gate: false }, c0 = Math.floor(h.x - K.HW + 1e-6), c1 = Math.floor(h.x + K.HW - 1e-6);
    for (var c = c0; c <= c1; c++) if (floorAt(Wd, c, Math.round(h.y), h.y)) return true;
    return false;
  }
  // можно ли щёлкнуть: вызывается ПОСЛЕ переключения lv.ph на новую фазу
  function flickOk(lv, h) { return !bodyBlocked(lv, h) && (!h.ground || h.on >= 0 || !!h.stair || supported(lv, h)); }
  // прогон героя: inputs(h, k) → ввод ({dx, jump, up, down, flick}); до приземления (после взлёта) или maxT. Возвращает героя, признаки и фазу посадки.
  function simulate(lv, h0, inputs, maxT, Wd) {
    var W = Wd || staticWorld(lv), h = JSON.parse(JSON.stringify(h0)), dt = 1 / 60, left = false, hz = false, t0 = W.t, ph0 = lv.ph;
    function fin(o) { o.ph = lv.ph; o.hz = o.hz || bad; W.t = t0; lv.ph = ph0; return o; }
    var bad = false;
    for (var k = 0; k < Math.round(maxT * 60); k++) {
      W.t = t0 + k * dt;
      var ip = inputs(h, k);
      if (ip.flick) { lv.ph ^= 1; if (!flickOk(lv, h)) bad = true; }
      heroStep(W, h, ip, dt);
      if (!h.ground) left = true;
      if (sawHit(lv, h.x - K.HW, h.y - hh(h), h.x + K.HW, h.y)) hz = true;
      if (W.noPlat && sweptHit(lv, h)) hz = true;
      if (h.y > lv.H + 1) return fin({ h: h, dead: true, hz: hz, k: k });
      if (left && h.ground) return fin({ h: h, dead: false, hz: hz, k: k, landed: true });
    }
    return fin({ h: h, dead: false, hz: hz, k: k, landed: false });
  }
  // область, которую заметает подвижная опора: статический граф не прыгает сквозь неё (там — только переправа)
  function sweeps(lv) {
    if (lv._sw) return lv._sw;
    lv._sw = lv.mov.map(function (m) {
      if (m.kind === 'lift') return { x0: m.x, x1: m.x + m.w, y0: m.y - m.h - 0.4, y1: m.y + 0.4 };
      var o = m.len * Math.sin(m.amp), lo = m.py + m.len * Math.cos(m.amp);
      return { x0: m.px - o - m.w / 2, x1: m.px + o + m.w / 2, y0: lo - 0.4, y1: m.py + m.len + 0.4 };
    });
    return lv._sw;
  }
  function sweptHit(lv, h) {
    var sw = sweeps(lv), top = h.y - hh(h);
    for (var i = 0; i < sw.length; i++) { var b = sw[i]; if (h.x + K.HW > b.x0 && h.x - K.HW < b.x1 && h.y > b.y0 && top < b.y1) return true; }
    return false;
  }
  // узел графа = клетка опоры × фаза: id = фаза·(W·H) + ряд·W + колонка (колонка — id % W)
  function nodeOf(lv, h, ph) {
    if (!h.ground || h.on >= 0) return -1;
    var p = ph == null ? lv.ph : ph, save = lv.ph, res = -1; lv.ph = p;
    var r = Math.round(h.y), c = Math.floor(h.x);
    if (standable(lv, c, r)) res = r * lv.W + c;
    else {
      var c0 = Math.floor(h.x - K.HW + 1e-6), c1 = Math.floor(h.x + K.HW - 1e-6);
      for (var cc = c0; cc <= c1; cc++) if (standable(lv, cc, r)) { res = r * lv.W + cc; break; }
    }
    lv.ph = save;
    return res < 0 ? -1 : res + p * lv.W * lv.H;
  }
  function pointNode(lv, x, y, ph) {
    var p = ph == null ? lv.ph : ph, save = lv.ph, res = -1; lv.ph = p;
    var c = Math.floor(x), r = Math.round(y);
    if (standable(lv, c, r)) res = r * lv.W + c; else if (standable(lv, c - 1, r)) res = r * lv.W + c - 1;
    lv.ph = save;
    return res < 0 ? -1 : res + p * lv.W * lv.H;
  }
  var FKS = [-1, 20, 16, 24, 12, 28, 8, 32, 4, 36, 40];
  function Nav(lv) {
    var W = lv.W, NN = lv.W * lv.H, nodes = [], set = {}, edges = {}, c, r, i, p, ph0 = lv.ph;
    var near = null;
    if (lv.hasPh) { near = new Uint8Array(W); for (r = 0; r < lv.H; r++) for (c = 0; c < W; c++) if (lv.t[r * W + c] >= PA) for (i = Math.max(0, c - 9); i <= Math.min(W - 1, c + 9); i++) near[i] = 1; }
    for (p = 0; p < 2; p++) { lv.ph = p; for (r = 1; r < lv.H; r++) for (c = 1; c < W - 1; c++) if (standable(lv, c, r)) { var id = p * NN + r * W + c; nodes.push(id); set[id] = 1; edges[id] = []; } }
    function add(u, e) { if (set[e.to] && e.to !== u) edges[u].push(e); }
    nodes.forEach(function (u) {
      var pu = Math.floor(u / NN), base = pu * NN, idx = u - base, c0 = idx % W, r0 = (idx - c0) / W, x = c0 + 0.5;
      lv.ph = pu;
      [-1, 1].forEach(function (d) {
        if (set[base + r0 * W + c0 + d]) add(u, { type: 'walk', to: base + r0 * W + c0 + d, w: 1 });
        else if (!standable(lv, c0 + d, r0) && !solid({ lv: lv }, c0 + d, r0 - 1)) {
          var s = simulate(lv, newHero(x, r0), function () { return { dx: d }; }, 3);
          if (s.landed && !s.dead && !s.hz) { var v = nodeOf(lv, s.h, pu); if (v >= 0) add(u, { type: 'drop', d: d, to: v, w: 2 }); }
        }
      });
      [-1, 0, 1].forEach(function (d) {
        var offs = d === 0 ? [0] : [-0.3, 0, 0.3, 0.62], seenTo = {}, fks = near && near[c0] ? FKS : [-1];
        offs.forEach(function (o) {
          var sx = x + o * (d || 1);
          var hs = newHero(sx, r0), s0 = simulate(lv, hs, function () { return {}; }, 0.05);
          if (!s0.h.ground || Math.abs(s0.h.x - sx) > 1e-6) return;   // точка толчка не держит
          fks.forEach(function (fk) {
            var go = function (xx, f2) { return simulate(lv, newHero(xx, r0), function (h, k) { return { dx: d, jump: k === 0, flick: f2 > 0 && k === f2 }; }, 3); };
            var s = go(sx, fk); if (!s.landed || s.dead || s.hz) return;
            var v = nodeOf(lv, s.h, s.ph); if (v < 0 || v === u || seenTo[v]) return;
            var tests = [go(sx - 0.08, fk), go(sx + 0.08, fk)]; if (fk > 0) tests.push(go(sx, fk - 2), go(sx, fk + 2));
            for (var q = 0; q < tests.length; q++) { var a = tests[q]; if (!a.landed || a.dead || a.hz || nodeOf(lv, a.h, a.ph) !== v) return; }
            seenTo[v] = 1; add(u, { type: 'jump', d: d, sx: sx, fk: fk > 0 ? fk : -1, to: v, w: fk > 0 ? 4 : 3 });
          });
        });
      });
      if (lv.hasPh) add(u, { type: 'flip', to: (1 - pu) * NN + idx, w: 2 });
    });
    for (p = 0; p < 2; p++) {
      lv.ph = p;
      lv.stairs.forEach(function (s, si) {
        var b = pointNode(lv, s.bx, s.by, p), t = pointNode(lv, s.tx, s.ty, p);
        if (b >= 0 && t >= 0) { add(b, { type: 'stair', s: si, up: true, to: t, w: s.n }); add(t, { type: 'stair', s: si, up: false, to: b, w: s.n }); }
      });
      lv.mov.forEach(function (m) {
        var f = p * NN + m.from[1] * W + m.from[0], t = p * NN + m.to[1] * W + m.to[0];
        if (set[f] && set[t]) add(f, { type: 'ride', m: m.id, to: t, w: 8 });
      });
    }
    lv.ph = ph0;
    function reach(from) { var seen = {}, q = [from]; seen[from] = 1; while (q.length) { var u = q.shift(); (edges[u] || []).forEach(function (e) { if (!seen[e.to]) { seen[e.to] = 1; q.push(e.to); } }); } return seen; }
    function path(from, goalFn) {
      var dist = {}, prev = {}, open = [from]; dist[from] = 0;
      while (open.length) {
        var bi = 0; for (var k = 1; k < open.length; k++) if (dist[open[k]] < dist[open[bi]]) bi = k;
        var u = open.splice(bi, 1)[0];
        if (goalFn(u)) { var out = []; while (u !== from) { out.unshift(prev[u]); u = prev[u].from; } return out; }
        edges[u].forEach(function (e) { var nd = dist[u] + e.w; if (dist[e.to] == null || nd < dist[e.to]) { if (dist[e.to] == null) open.push(e.to); dist[e.to] = nd; prev[e.to] = Object.assign({ from: u }, e); } });
      }
      return null;
    }
    return { W: W, NN: NN, nodes: nodes, set: set, edges: edges, reach: reach, path: path, startNode: pointNode(lv, lv.start.x, lv.start.y, 0), col: function (u) { return u % W; }, row: function (u) { return Math.floor(u / W) % lv.H; }, phase: function (u) { return Math.floor(u / NN); } };
  }

  // ---------- контроллер переправы (маятник/подъёмник) — общий для тестов и бота ----------
  // st: { m, from, to, ph:'go'|'wait'|'ride'|'off'|'done', hold }; world(S) → Wd; возвращает ввод
  function rideCtl(lv, st, S, Wd) {
    var h = S.hero, m = lv.mov[st.m], d = sgn(m.to[0] - m.from[0]) || 1;
    var tx = m.to[0] + 0.5, ty = m.to[1];
    function onTarget(hh2) { return hh2.ground && hh2.on < 0 && Math.abs(hh2.y - ty) < 0.01 && Math.abs(hh2.x - tx) < 2.6; }
    if (st.ph === 'done') return {};
    if (st.ph === 'go') {
      var sx = m.from[0] + 0.5 + 0.55 * d;
      if (h.ground && h.on < 0 && Math.abs(h.y - m.from[1]) < 0.01 && Math.abs(h.x - sx) < 0.08) st.ph = 'wait';
      else return { dx: sgn(sx - h.x) };
    }
    if (st.ph === 'air' || st.ph === 'step') {
      if (h.ground) { if (h.on === m.id) st.ph = 'ride'; else if (onTarget(h)) { st.ph = 'done'; return {}; } else { st.ph = 'fail'; return {}; } }
      else return st.hold || {};
    }
    if (st.ph === 'walk') {
      if (h.on === m.id && h.ground) { st.ph = 'ride'; }
      else if (onTarget(h)) { st.ph = 'done'; return {}; }
      else if (h.ground) return st.hold;
      else return {};
    }
    var opts = [{ jump: true, dx: d }, { dx: d }], k;
    if (st.ph === 'wait') {
      if (st.react && (st.react -= 1 / 60) > 0) return {};
      for (k = 0; k < opts.length; k++) {
        var o = opts[k], s = simulate(lv, h, (function (o) { return function (hh2, j) { return { dx: o.dx, jump: o.jump && j === 0 }; }; })(o), 1.4, Wd);
        if (s.landed && !s.dead && s.h.on === m.id && Math.abs(s.h.x - platAt(m, Wd.t + s.k / 60).cx) < m.w / 2 - 0.1) {
          st.hold = { dx: o.jump ? 0 : o.dx }; st.ph = o.jump ? 'air' : 'walk'; st.react = 0; return { dx: o.dx, jump: !!o.jump };
        }
      }
      return {};
    }
    if (st.ph === 'ride') {
      if (!h.ground) { st.ph = 'fail'; return {}; }
      if (st.react && (st.react -= 1 / 60) > 0) return {};
      for (k = 0; k < opts.length; k++) {
        var o2 = opts[k], s2 = simulate(lv, h, (function (o) { return function (hh2, j) { return { dx: o.dx, jump: o.jump && j === 0 }; }; })(o2), o2.jump ? 1.6 : 0.8, Wd);
        if (!s2.dead && !s2.hz && onTarget(s2.h)) { st.hold = { dx: o2.jump ? 0 : o2.dx }; st.ph = o2.jump ? 'air' : 'walk'; return { dx: o2.dx, jump: !!o2.jump }; }
        if (!o2.jump && !s2.dead && s2.h.ground && s2.h.on < 0 && Math.abs(s2.h.y - ty) < 0.01 && Math.abs(s2.h.x - tx) < 4) { st.hold = { dx: o2.dx }; st.ph = 'walk'; return { dx: o2.dx }; }
      }
      // держаться середины площадки
      var P = platAt(m, Wd.t); if (Math.abs(h.x - P.cx) > 0.5) return { dx: sgn(P.cx - h.x) };
      return {};
    }
    return {};
  }

  // ---------- пароль: 5 знаков (этаж, ступень катушки, винтики/3) + контрольная сумма ----------
  var ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', MAGIC = 22;
  function encode(o) {
    var fi = clamp(o.fi | 0, 0, 5), ch = clamp(o.coil | 0, 1, 3) - 1, sp = clamp(Math.round((o.sparks || 0) / 3), 0, 31);
    var v = fi | ch << 3 | sp << 5;   // 10 бит
    var cs = ((v * 37 + 11) ^ (v >> 5) * 13) & 1023;
    var all = (v | cs << 10 | MAGIC << 20) ^ 0x1A5F3C7;
    var s = ''; for (var i = 0; i < 5; i++) { s += ALPH[all & 31]; all >>>= 5; }
    return s;
  }
  function decode(str) {
    str = String(str || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (str.length !== 5) return null;
    var all = 0; for (var i = 4; i >= 0; i--) { var k = ALPH.indexOf(str[i]); if (k < 0) return null; all = all * 32 + k; }
    all = (all ^ 0x1A5F3C7) & 0x1FFFFFF;
    var v = all & 1023, cs = all >>> 10 & 1023, mg = all >>> 20;
    if (mg !== MAGIC || (((v * 37 + 11) ^ (v >> 5) * 13) & 1023) !== cs) return null;
    var fi = v & 7, ch = (v >> 3 & 3) + 1, sp = (v >> 5 & 31) * 3;
    if (fi > 5 || ch > 3) return null;
    return { fi: fi, coil: ch, sparks: sp };
  }

  // ---------- игра ----------
  function dcopy(o) {
    if (o === null || typeof o !== 'object') return o;
    if (Array.isArray(o)) return o.map(dcopy);
    var r = {}; for (var k in o) r[k] = k === 'lv' ? o[k] : dcopy(o[k]); return r;
  }
  T.Game = function (opts) {
    opts = opts || {};
    var ev = opts.onEvent || NOP, dmgMul = opts.dmgMul == null ? 1 : opts.dmgMul;
    var S = opts.state || null, api;
    function emit(t, d) { if (!api.mute) ev(t, d || {}); }
    function W() { return { lv: S.lv, t: S.t, gate: S.gateClosed, ev: emit }; }

    function initFloor(fi) {
      S.fi = fi; S.key = T.floorKey(fi); S.taken = {};
      S.lv = T.build(S.key); S.cp = null;
      resetFloorState(); S.phase = 'play'; S.phaseT = 0;
      emit('level', { key: S.key, fi: fi });
    }
    function resetFloorState() {
      var lv = S.lv, p = S.cp || lv.start;
      lv.ph = 0; S.ph = 0; S.flickT = 0; S.pulse = null;
      S.hero = newHero(p.x, p.y); S.hp = K.HP; S.t = 0;
      S.enemies = lv.foes.filter(function (f) { return f.type !== 'moth'; }).map(function (f, i) { return mkFoe(f.type, f.x, f.y, i); });
      S.nests = lv.foes.filter(function (f) { return f.type === 'moth'; }).map(function (f) { return { x: f.x, y: f.y - 0.5, t: 1.5, n: 0 }; });
      S.items = lv.items.map(function (it, i) { return { k: it.k, x: it.x, y: it.y, vy: 0, t: 0, ground: true, keep: true, idx: i }; }).filter(function (it) { return !S.taken[it.idx]; });
      S.eshots = [];
      S.boss = null; S.bossState = 'none'; S.gateClosed = false;
      S.cam = camTarget(); S.uid = S.uid || 1000;
    }
    function mkFoe(type, x, y, i) {
      var F = FOE[type];
      return { id: S.uid = (S.uid || 0) + 1, type: type, x: x, y: y, x0: x, y0: y, vx: 0, vy: 0, face: -1, hp: F.hp, w: F.w, h: F.h, st: 'idle', t: 0, ground: true, act: false, hitT: 0, slow: 1, fly: !!F.fly };
    }
    function camTarget() {
      var lv = S.lv, h = S.hero;
      if (S.bossState === 'fight' || S.bossState === 'intro' || S.bossState === 'dead') return { x: lv.arena.x0, y: lv.arena.y0 };
      return { x: clamp(h.x - 15, 0, lv.W - 32), y: clamp(h.y - 10, 0, lv.H - 16) };
    }

    function start() {
      var st = opts.start || {};
      S = {
        phase: 'play', phaseT: 0, fi: 0, key: '', lv: null, t: 0, time: 0, hero: null, hp: K.HP,
        lives: K.LIVES, conts: K.CONTS, score: st.score || 0, sparks: st.sparks != null ? st.sparks : K.SPARK0, coil: st.coil || 1, taken: null, ph: 0, flickT: 0, pulse: null,
        nextLife: K.LIFE1, rs: (opts.seed || 12345) | 0, inp: {}, prev: {}, kills: 0, deaths: 0, won: false, over: false, uid: 1, bossT: 0
      };
      if (opts.rng) S.rs = Math.floor(opts.rng() * 2147483647);
      initFloor(st.fi || 0);
      return api;
    }

    // ---------- урон герою ----------
    function hurt(dmg, fromX, why) {
      var h = S.hero;
      if (S.phase !== 'play' || h.inv > 0) return false;
      dmg = Math.round(dmg * dmgMul); if (dmgMul === 0) return false;
      S.hp -= dmg; h.inv = K.INV;
      emit('hurt', { hp: S.hp, x: h.x, y: h.y - 1, why: why });
      if (S.hp <= 0) { S.hp = 0; die(why || 'hit'); return true; }
      if (!h.stair) { var d = h.x < fromX ? -1 : 1; h.kb = true; h.ground = false; h.on = -1; h.vx = d * K.KBX; h.vy = -K.KBV; h.face = -d; h.crouch = false; }
      return true;
    }
    function die(why) {
      if (S.phase !== 'play') return;
      var h = S.hero; S.phase = 'dead'; S.phaseT = 0; S.deaths++; S.lives--; h.dead = true;
      emit('die', { why: why, x: h.x, y: h.y });
    }
    function respawn() {
      S.coil = Math.max(1, S.coil - 1);
      resetFloorState(); S.phase = 'play'; emit('respawn');
    }
    function addScore(n) {
      S.score += n;
      while (S.score >= S.nextLife) { S.lives++; S.nextLife += K.LIFESTEP; emit('life'); }
    }

    // ---------- щелчок фаз ----------
    function boxHit(px, py, r, x, y, w, hh2) { return px + r > x - w / 2 && px - r < x + w / 2 && py + r > y - hh2 && py - r < y; }
    function damageFoe(e, dmg, fromX) {
      e.hp -= dmg; e.hitT = 0.2;
      emit('hit', { x: e.x, y: e.y - e.h / 2 });
      if (e.type === 'guard' && e.hp > 0) { e.x += sgn(e.x - fromX) * 0.25; e.st = 'stun'; e.t = 0; }
      if (e.hp <= 0) {
        e.dead = true; S.kills++; addScore(FOE[e.type].pts);
        emit('kill', { type: e.type, x: e.x, y: e.y - e.h / 2, pts: FOE[e.type].pts });
        if (rnd(S) < 0.25) dropItem('spark', e.x, e.y - e.h / 2);
      }
    }
    function damageBoss(dmg) {
      var b = S.boss; if (!b || S.bossState !== 'fight' || b.iv > 0) return false;
      b.hp -= dmg; b.iv = 0.22; b.flash = 0.22;
      emit('bossHit', { x: b.x, y: b.y - b.h / 2 });
      if (b.hp <= 0) bossDie();
      return true;
    }
    function dropItem(k, x, y) { S.items.push({ k: k, x: x, y: y, vy: -4, t: 0, ground: false }); }
    // расстояние от точки до прямоугольника (x — центр, y — низ)
    function distBox(px, py, x, y, w, hh2) { var dx = Math.max(Math.abs(px - x) - w / 2, 0), dy = Math.max(y - hh2 - py, py - y, 0); return Math.sqrt(dx * dx + dy * dy); }
    function inSolid(e) {
      var Wd = W(), c0 = Math.floor(e.x - e.w / 2 + 1e-6), c1 = Math.floor(e.x + e.w / 2 - 1e-6), r0 = Math.floor(e.y - e.h + 1e-6), r1 = Math.floor(e.y - 1e-6);
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (r >= 0 && r < S.lv.H && c >= 0 && c < S.lv.W && S.lv.t[r * S.lv.W + c] >= PA && solid(Wd, c, r)) return true;
      return false;
    }
    // Щелчок: переключает фазу мира и бьёт волной вокруг героя. Возвращает true, если щелчок состоялся.
    function flick() {
      var h = S.hero, lv = S.lv;
      if (S.flickT > 0 || h.kb || S.phase !== 'play') return false;
      lv.ph = S.ph ^ 1;
      if (!flickOk(lv, h)) { lv.ph = S.ph; S.flickT = 0.25; emit('jam', { x: h.x, y: h.y - 1 }); return false; }
      S.ph = lv.ph; S.flickT = K.FLICK_CD; h.fl = 0.28;
      var R = K.R[S.coil], dmg = K.DMG[S.coil], cx = h.x, cy = h.y - 0.9, i, e;
      S.pulse = { x: cx, y: cy, r: R, t: 0, ph: S.ph };
      emit('flick', { x: cx, y: cy, r: R, ph: S.ph });
      // блок вырос на враге — давит; враг в радиусе волны получает урон (раздавленные не считаются дважды)
      for (i = 0; i < S.enemies.length; i++) {
        e = S.enemies[i]; if (e.dead) continue;
        if (inSolid(e)) { emit('crush', { x: e.x, y: e.y - e.h / 2 }); damageFoe(e, 99, cx); continue; }
        if (e.act && distBox(cx, cy, e.x, e.y, e.w, e.h) <= R) damageFoe(e, dmg, cx);
      }
      var b = S.boss;
      if (b && S.bossState === 'fight' && bossReach(b, cx, cy, R)) damageBoss(dmg);
      for (i = 0; i < S.eshots.length; i++) {
        var q = S.eshots[i]; if (!q.hp || q.dead) continue;
        var dx = q.x - cx, dy = q.y - cy; if (dx * dx + dy * dy < (R + q.r) * (R + q.r)) { q.dead = true; addScore(50); emit('clank', { x: q.x, y: q.y }); }
      }
      return true;
    }
    function bossReach(b, px, py, r) {
      if (b.k === 'cuckoo' || b.k === 'pendulum' || b.k === 'flywheel' || b.k === 'heart') { var cx = b.x, cy = b.y - b.h / 2, rr = b.w / 2 + r; return (px - cx) * (px - cx) + (py - cy) * (py - cy) < rr * rr; }
      return distBox(px, py, b.x, b.y, b.w, b.h) <= r;
    }
    function bossHitTest(b, px, py, r) {
      if (b.k === 'cuckoo' || b.k === 'pendulum' || b.k === 'flywheel' || b.k === 'heart') { var cx = b.x, cy = b.y - b.h / 2, rr = b.w / 2 + r; return (px - cx) * (px - cx) + (py - cy) * (py - cy) < rr * rr; }
      return boxHit(px, py, r, b.x, b.y, b.w, b.h);
    }

    // ---------- враги ----------
    function bodyStep(e, dt) {
      var lv = S.lv, Wd = W(), hw = e.w / 2;
      e.vy = Math.min(K.MAXF, e.vy + K.G * 0.8 * dt);
      e.x += e.vx * dt;
      var r0 = Math.floor(e.y - e.h + 1e-6), r1 = Math.floor(e.y - 1e-6), r, c;
      if (e.vx > 0) { c = Math.floor(e.x + hw - 1e-6); for (r = r0; r <= r1; r++) if (solid(Wd, c, r)) { e.x = c - hw; e.vx = 0; e.bump = true; break; } }
      else if (e.vx < 0) { c = Math.floor(e.x - hw + 1e-6); for (r = r0; r <= r1; r++) if (solid(Wd, c, r)) { e.x = c + 1 + hw; e.vx = 0; e.bump = true; break; } }
      var py = e.y; e.y += e.vy * dt; e.ground = false;
      var c0 = Math.floor(e.x - hw + 1e-6), c1 = Math.floor(e.x + hw - 1e-6);
      if (e.vy >= 0) for (r = Math.ceil(py - 1e-6); r <= Math.floor(e.y); r++) { var hit = false; for (c = c0; c <= c1; c++) if (floorAt(Wd, c, r, py)) { hit = true; break; } if (hit) { e.y = r; e.vy = 0; e.ground = true; break; } }
      if (e.y > lv.H + 2) e.dead = true;
    }
    function edgeAhead(e, d) { var Wd = W(), c = Math.floor(e.x + d * (e.w / 2 + 0.1)), r = Math.round(e.y); return !floorAt(Wd, c, r, e.y) || solid(Wd, c, r - 1); }
    function updFoe(e, dt) {
      var h = S.hero, dx = h.x - e.x, adx = Math.abs(dx), F = FOE[e.type];
      if (!e.act) { if (Math.abs(dx) < 17 && Math.abs(h.y - e.y) < 11) e.act = true; else return; }
      if (e.hitT > 0) e.hitT -= dt;
      e.t += dt;
      switch (e.type) {
        case 'tick':
          if (e.st === 'idle') { e.face = sgn(dx) || -1; e.st = 'walk'; }
          if (e.ground && (e.bump || edgeAhead(e, e.face))) { e.face = -e.face; e.bump = false; }
          e.vx = e.face * F.sp; bodyStep(e, dt); break;
        case 'springer':
          if (e.ground) { e.vx = 0; if (e.t > 0.9) { e.t = 0; e.face = sgn(dx) || e.face; e.vx = e.face * F.sp; e.vy = -9.5; emit('boing', { x: e.x, y: e.y }); } }
          bodyStep(e, dt); break;
        case 'oiler':
          e.face = sgn(dx) || e.face;
          if (e.st === 'idle' || e.st === 'walk') {
            e.st = 'walk'; var tx = e.x0 + Math.sin(e.t * 0.8) * 1.5; e.vx = clamp(tx - e.x, -1, 1) * F.sp;
            if (e.ground && edgeAhead(e, sgn(e.vx))) e.vx = 0;
            if (e.t > 2.6 && adx < 10) { e.st = 'wind'; e.t = 0; e.vx = 0; }
          } else if (e.st === 'wind' && e.t > 0.45) {
            var tt = 0.9; S.eshots.push({ k: 'oil', x: e.x + e.face * 0.4, y: e.y - 1.3, vx: clamp(dx / tt, -6, 6), vy: -9, g: 20, r: 0.25, dmg: 2, life: 4, hp: 1 });
            emit('lob', { x: e.x, y: e.y }); e.st = 'walk'; e.t = 0;
          }
          bodyStep(e, dt); break;
        case 'guard':
          if (e.st === 'idle' || e.st === 'walk') {
            e.st = 'walk'; e.face = sgn(dx) || e.face;
            e.vx = adx > 1.4 ? e.face * F.sp : 0; if (e.ground && edgeAhead(e, e.face)) e.vx = 0;
            if (adx < 2.3 && Math.abs(h.y - e.y) < 1.2 && e.t > 0.8) { e.st = 'wind'; e.t = 0; e.vx = 0; emit('ready', { x: e.x, y: e.y }); }
          } else if (e.st === 'wind') { e.vx = 0; if (e.t > 0.55) { e.st = 'jab'; e.t = 0; emit('jab', { x: e.x, y: e.y }); } }
          else if (e.st === 'jab') { var jx = e.x + e.face * 1.0, jy = e.y - 1.15; if (hitsHero(jx, jy, 0.9, 0.35)) hurt(F.dmg, e.x, 'guard'); if (e.t > 0.2) { e.st = 'rec'; e.t = 0; } }
          else if (e.st === 'rec') { if (e.t > 0.6) { e.st = 'walk'; e.t = 0; } }
          else if (e.st === 'stun') { e.vx = 0; if (e.t > 0.25) { e.st = 'walk'; e.t = 0.3; } }
          bodyStep(e, dt); break;
        case 'moth':
          if (e.st === 'idle') { e.st = 'fly'; e.face = sgn(dx) || -1; }
          if (e.st === 'fly') {
            e.x += e.face * F.sp * dt; e.y = e.y0 + Math.sin(e.t * 5) * 0.35;
            if (adx < 4.5 && sgn(dx) === e.face) { e.st = 'aim'; e.t = 0; }
            if (adx > 20) e.dead = true;
          } else if (e.st === 'aim') {
            if (e.t > 0.4) { var ty = h.y - 1.0, ddx = h.x - e.x, ddy = ty - e.y, n = Math.sqrt(ddx * ddx + ddy * ddy) || 1; e.vx = ddx / n * 6; e.vy = ddy / n * 6; e.st = 'dive'; e.t = 0; emit('dive', { x: e.x, y: e.y }); }
          } else if (e.st === 'dive') {
            e.x += e.vx * dt; e.y += e.vy * dt;
            if (e.t > 2.2 || e.y > S.lv.H + 1) e.dead = true;
          }
          break;
      }
      if (!e.dead && e.act && hitsHero(e.x, e.y - e.h / 2, e.w / 2, e.h / 2)) hurt(F.dmg, e.x, e.type);
    }
    function hitsHero(cx, cy, rx, ry) {
      var h = S.hero, top = h.y - hh(h);
      return cx + rx > h.x - K.HW && cx - rx < h.x + K.HW && cy + ry > top && cy - ry < h.y;
    }
    function circleHitsHero(cx, cy, r) { var h = S.hero, nx = clamp(cx, h.x - K.HW, h.x + K.HW), ny = clamp(cy, h.y - hh(h), h.y); return (nx - cx) * (nx - cx) + (ny - cy) * (ny - cy) < r * r; }

    // ---------- стражи ----------
    function floorY(x) { var lv = S.lv, c = Math.floor(x), r = lv.arena.y0; while (r < lv.H && tileAt(lv, c, r) === SOL) r++; for (; r < lv.H; r++) if (tileAt(lv, c, r) === SOL) return r; return lv.H; }
    function startBoss() {
      var lv = S.lv, k = lv.bossKind, B = BOSS[k], b = { k: k, x: lv.boss.x, y: lv.boss.y, w: B.w, h: B.h, hp: lv.bhp, max: lv.bhp, st: 'intro', t: 0, face: -1, iv: 0, flash: 0, vx: 0, vy: 0, n: 0, harm: true };
      b.fy = floorY(lv.boss.x); b.cx = (lv.arena.x0 + 1 + lv.arena.x1) / 2; b.ax0 = lv.arena.x0 + 1; b.ax1 = lv.arena.x1;
      if (k === 'cuckoo') { b.hx = b.cx; b.hy = b.fy - 4.4; b.x = b.hx; b.y = b.hy; }
      if (k === 'pendulum') { b.L = 8.6; b.ang = 0; b.sw = 0; b.py = 1.5; }
      if (k === 'spider') { b.y = 3.4; }
      if (k === 'heart') { b.cy = 5; b.orb = 0; b.x = b.cx; }
      S.boss = b; S.bossState = 'intro'; S.gateClosed = true; S.bossT = 0;
      S.cp = { x: lv.gate.x - 1.5, y: surfaceLeftOfGate() };
      S.enemies.forEach(function (e) { if (e.x < lv.arena.x0) e.dead = true; });
      S.eshots = [];
      emit('bossIntro', { k: k, final: lv.final });
    }
    function surfaceLeftOfGate() { var lv = S.lv, c = lv.gate.x - 2; for (var r = lv.arena.y0 + 1; r < lv.H; r++) if (standable(lv, c, r)) return r; return lv.start.y; }
    function shot(o) { S.eshots.push(Object.assign({ g: 0, r: 0.3, dmg: 2, life: 5 }, o)); }
    function updBoss(dt) {
      var b = S.boss, h = S.hero, lv = S.lv;
      if (!b) return;
      if (b.iv > 0) b.iv -= dt; if (b.flash > 0) b.flash -= dt;
      S.bossT += dt;
      if (S.bossState === 'intro') { b.t += dt; if (b.t > 1.2) { S.bossState = 'fight'; b.st = 'start'; b.t = 0; } if (b.k === 'heart') heartPos(b, dt * 0); return; }
      b.t += dt; var dx = h.x - b.x, hard = b.hp <= b.max / 2;
      switch (b.k) {
        case 'cuckoo': {
          if (b.st === 'start' || b.st === 'perch') { b.x = b.hx; b.y = b.hy + Math.sin(b.t * 4) * 0.15; if (b.t > (hard ? 0.8 : 1.1)) { b.n++; b.t = 0; if (b.n % 3 === 0) { b.st = 'eggs'; b.ex = clamp(h.x, b.ax0 + 2, b.ax1 - 2); b.x0 = b.x; b.y0 = b.y; } else { b.st = 'swoop'; b.x0 = b.x; b.y0 = b.y; var d = sgn(h.x - b.x) || 1; b.x2 = clamp(h.x + d * 6, b.ax0 + 1.5, b.ax1 - 1.5); b.x1 = h.x; emit('swoop'); } } }
          else if (b.st === 'swoop') {
            var D = hard ? 1.25 : 1.5, s = Math.min(1, b.t / D);
            b.x = b.x0 + (b.x2 - b.x0) * s; var low = b.fy - 1.25; b.y = b.y0 + (low - b.y0) * Math.sin(Math.PI * s); b.face = sgn(b.x2 - b.x0) || b.face;
            if (s >= 1) { b.st = 'rest'; b.t = 0; }
          } else if (b.st === 'rest') { if (b.t > 0.8) { b.st = 'back'; b.t = 0; b.x0 = b.x; b.y0 = b.y; } }
          else if (b.st === 'back') { var s2 = Math.min(1, b.t / 1.0); b.x = b.x0 + (b.hx - b.x0) * s2; b.y = b.y0 + (b.hy - b.y0) * s2; if (s2 >= 1) { b.st = 'perch'; b.t = 0; } }
          else if (b.st === 'eggs') {
            var s3 = Math.min(1, b.t / 0.8); b.x = b.x0 + (b.ex - b.x0) * s3; b.y = b.y0 + (b.fy - 4.4 - b.y0) * s3;
            if (b.t > 0.8 && b.t - dt <= 0.8 || b.t > 1.3 && b.t - dt <= 1.3 || b.t > 1.8 && b.t - dt <= 1.8) { shot({ k: 'egg', x: b.x, y: b.y, vx: (h.x - b.x) * 0.4, vy: 0, g: 18, r: 0.3, dmg: 2, hp: 1, egg: true }); emit('egg'); }
            if (b.t > 2.3) { b.st = 'back'; b.t = 0; b.x0 = b.x; b.y0 = b.y; }
          }
          break;
        }
        case 'pendulum': {
          var per = hard ? 2.8 : 3.2, w = 2 * Math.PI / per;
          b.ang += dt * w; var amp = 1.1, th = amp * Math.sin(b.ang);
          var half = Math.floor((b.ang + Math.PI / 2) / Math.PI);
          if (half !== b.half) { b.half = half; b.n++; if (b.n > 1 && b.n % 2 === 0) { shot({ k: 'gear', x: b.x, y: b.y - b.h / 2, vx: 0, vy: 0, g: 22, r: 0.35, dmg: 2, hp: 1, roll: -sgn(th) * 2.8, life: 6 }); emit('gearDrop'); } b.sweep = b.n % 3 === 0 && b.n > 2; if (b.sweep) emit('sweep'); }
          var Lt = b.sweep ? 10.55 : 8.6; b.L += (Lt - b.L) * Math.min(1, dt * 3);
          b.x = b.cx + b.L * Math.sin(th); b.y = b.py + b.L * Math.cos(th) + b.h / 2; b.th = th;
          break;
        }
        case 'drake': {
          b.face = b.st === 'hop' ? b.face : sgn(dx) || b.face;
          if (b.st === 'start' || b.st === 'idle') { if (b.t > (hard ? 0.35 : 0.6)) { b.t = 0; b.n++; if (b.n % 2) { b.st = 'hop'; var tx = clamp(h.x + (h.x > b.cx ? -4 : 4), b.ax0 + 1.6, b.ax1 - 1.6); b.vx = (tx - b.x) / 1.0; b.vy = -0.5 * K.G * 0.8 * 1.0; b.face = sgn(b.vx) || b.face; emit('hop'); } else { b.st = 'wind'; } } }
          else if (b.st === 'hop') { b.vy += K.G * 0.8 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.y >= b.fy && b.vy > 0) { b.y = b.fy; b.st = 'land'; b.t = 0; emit('stomp'); } b.x = clamp(b.x, b.ax0 + 1.3, b.ax1 - 1.3); }
          else if (b.st === 'land') { if (b.t > 0.4) { b.st = 'idle'; b.t = 0; } }
          else if (b.st === 'wind') { if (b.t > 0.5) { b.st = 'breath'; b.t = 0; b.k2 = 0; b.hi = !b.hi; } }
          else if (b.st === 'breath') {
            var cnt = hard ? 4 : 3;
            if (b.t > b.k2 * 0.28 && b.k2 < cnt) { b.k2++; var hy = (b.hi ? b.fy - 1.65 : b.fy - 0.5); shot({ k: 'steam', x: b.x + b.face * 1.2, y: hy, vx: b.face * 6, vy: 0, r: 0.35, dmg: 3, life: 5 }); emit('breath'); }
            if (b.t > cnt * 0.28 + 0.3) { b.st = 'idle'; b.t = 0; }
          }
          break;
        }
        case 'spider': {
          var top = 3.4;
          if (b.st === 'start' || b.st === 'walk') {
            b.st = 'walk'; b.y = top; b.vx = clamp(dx * 2, -3, 3); b.x = clamp(b.x + b.vx * dt, b.ax0 + 2.2, b.ax1 - 2.2); b.face = sgn(dx) || b.face;
            b.nt = (b.nt || 0) + dt; if (b.nt > (hard ? 0.7 : 1.0)) { b.nt = 0; shot({ k: 'nut', x: b.x, y: b.y, vx: 0, vy: 1, g: 20, r: 0.3, dmg: 2, hp: 1 }); emit('nut'); }
            if ((Math.abs(dx) < 1.0 && b.t > 1.2) || b.t > 4) { b.st = 'aim'; b.t = 0; emit('ready'); }
          } else if (b.st === 'aim') { if (b.t > 0.55) { b.st = 'drop'; b.t = 0; b.vy = 0; } }
          else if (b.st === 'drop') { b.vy += 50 * dt; b.y += b.vy * dt; if (b.y >= b.fy) { b.y = b.fy; b.st = 'floor'; b.t = 0; emit('stomp'); } }
          else if (b.st === 'floor') { b.harm = b.t < 0.2; if (b.t > 1.7) { b.st = 'climb'; b.t = 0; b.harm = true; } }
          else if (b.st === 'climb') { b.y -= 6 * dt; if (b.y <= top) { b.y = top; b.st = 'walk'; b.t = 0; } }
          break;
        }
        case 'flywheel': {
          var sp = hard ? 7 : 5.2;
          if (b.st === 'start') { b.face = sgn(dx) || -1; b.st = 'roll'; b.t = 0; b.hopped = false; }
          if (b.st === 'roll') {
            b.x += b.face * sp * dt; b.rot = (b.rot || 0) + b.face * sp * dt / 0.9;
            if (b.vy || b.y < b.fy) { b.vy += K.G * 0.8 * dt; b.y += b.vy * dt; if (b.y >= b.fy) { b.y = b.fy; b.vy = 0; } }
            if (!b.hopped && b.n % 2 === 1 && Math.abs(b.x - b.cx) < 1) { b.hopped = true; b.vy = -9; emit('hop'); }
            if (b.x < b.ax0 + 0.9 || b.x > b.ax1 - 0.9) { b.x = clamp(b.x, b.ax0 + 0.9, b.ax1 - 0.9); b.st = 'stun'; b.t = 0; b.n++; b.y = b.fy; b.vy = 0; emit('stomp'); }
          } else if (b.st === 'stun') { if (b.t > (hard ? 1.3 : 1.7)) { b.st = 'roll'; b.face = -b.face; b.t = 0; b.hopped = false; } }
          break;
        }
        case 'heart': heartPos(b, dt); break;
      }
      b.x = clamp(b.x, b.ax0 - 0.5, b.ax1 + 0.5);
      // касание
      if (b.harm && S.bossState === 'fight') {
        if (bossHitTest(b, clamp(b.x, h.x - K.HW, h.x + K.HW), clamp(b.y - b.h / 2, h.y - hh(h), h.y), 0.02)) hurt(BOSS[b.k].dmg, b.x, 'boss');
        if (b.k === 'pendulum') { /* стержень безвреден */ }
        if (b.k === 'heart') b.orbs.forEach(function (o) { if (circleHitsHero(o.x, o.y, 0.6)) hurt(4, o.x, 'boss'); });
      }
    }
    function heartPos(b, dt) {
      var hard = b.hp <= b.max / 2, h = S.hero;
      b.orb += dt * (hard ? 2.3 : 1.6);
      if (b.st === 'start' || b.st === 'high') {
        b.st = 'high'; b.cy += (5 - b.cy) * Math.min(1, dt * 3);
        var n = hard ? 3 : 2; b.k2 = b.k2 || 0;
        if (b.t > 0.6 + b.k2 * 0.55 && b.k2 < n) { b.k2++; var ddx = h.x - b.x, ddy = h.y - 1 - b.cy, l = Math.sqrt(ddx * ddx + ddy * ddy) || 1; shot({ k: 'dart', x: b.x, y: b.cy, vx: ddx / l * 5.5, vy: ddy / l * 5.5, r: 0.28, dmg: 2, life: 5, hp: 1 }); emit('dart'); }
        if (b.t > 2.4) { b.st = 'down'; b.t = 0; b.k2 = 0; }
      } else if (b.st === 'down') { b.cy += (9.6 - b.cy) * Math.min(1, dt * 4); if (b.t > 0.8) { b.st = 'low'; b.t = 0; } }
      else if (b.st === 'low') { b.cy = 9.6; if (b.t > 2.6) { b.st = 'up'; b.t = 0; } if (hard && b.t > 1.2 && b.t - dt <= 1.2) { S.enemies.push(Object.assign(mkFoe('moth', b.x, b.cy - 3, 0), { act: true, face: sgn(h.x - b.x) || 1 })); } }
      else if (b.st === 'up') { b.cy += (5 - b.cy) * Math.min(1, dt * 4); if (b.t > 0.8) { b.st = 'high'; b.t = 0; } }
      b.y = b.cy + b.h / 2;
      var R = 3.3; b.orbs = [0, Math.PI].map(function (a) { return { x: b.x + Math.cos(b.orb + a) * R, y: b.cy + Math.sin(b.orb + a) * R }; });
    }
    function bossDie() {
      var b = S.boss, lv = S.lv, pts = 3000 + 1000 * S.fi;
      S.bossState = 'dead'; addScore(pts); S.eshots = [];
      S.enemies.forEach(function (e) { e.dead = true; });
      emit('bossDie', { k: b.k, x: b.x, y: b.y - b.h / 2, pts: pts });
      if (lv.final) { S.phase = 'won'; S.phaseT = 0; S.won = true; addScore(S.hp * 200 + S.sparks * 50); emit('win', { score: S.score }); return; }
      S.items.push({ k: 'core', x: b.cx, y: 4, vy: 0, t: 0, ground: false, keep: true });
    }
    function clearFloor() {
      var bonus = S.hp * 100 + S.sparks * 20; addScore(bonus);
      S.phase = 'clear'; S.phaseT = 0; emit('clear', { bonus: bonus, fi: S.fi });
    }

    // ---------- шаг ----------
    function update(dt) {
      if (!S) return;
      S.lv.ph = S.ph;   // lv общий у клонов партии — фаза живёт в состоянии
      S.time += dt;
      var i;
      if (S.phase === 'dead') {
        S.phaseT += dt;
        if (S.phaseT > K.DEAD) { if (S.lives > 0) respawn(); else if (S.conts > 0) { S.phase = 'cont'; S.phaseT = 0; emit('continueQ', { left: S.conts }); } else { S.phase = 'over'; S.over = true; emit('gameover', { score: S.score }); } }
        return;
      }
      if (S.phase === 'clear') { S.phaseT += dt; if (S.phaseT > K.CLEAR) initFloor(S.fi + 1); return; }
      if (S.phase !== 'play') { if (S.phase === 'won') S.phaseT += dt; return; }
      var h = S.hero, I = S.inp, P = S.prev;
      var inp = { dx: I.dx || 0, up: !!I.up, down: !!I.down, jump: !!I.jump && !P.jump };
      var flickP = !!I.flick && !P.flick;
      S.prev = { jump: !!I.jump, flick: !!I.flick };
      if (h.kb) inp = { dx: 0 };
      if (S.flickT > 0) S.flickT -= dt;
      if (S.pulse) { S.pulse.t += dt; if (S.pulse.t > 0.35) S.pulse = null; }
      if (flickP) flick();
      var Wd = W(), wasG = h.ground;
      heroStep(Wd, h, inp, dt);
      S.t += dt;
      if (h.land > 9) emit('thud');
      // гибель в пропасти / зубчатка
      if (h.y > S.lv.H + 0.5) { S.hp = 0; die('pit'); return; }
      var sw = sawHit(S.lv, h.x - K.HW, h.y - hh(h), h.x + K.HW, h.y); if (sw) hurt(K.SAWDMG, sw.x, 'saw');
      // отметки
      S.lv.cps.forEach(function (c) { if (Math.abs(h.x - c.x) < 0.8 && Math.abs(h.y - c.y) < 0.5 && (!S.cp || S.cp.x < c.x)) { S.cp = { x: c.x, y: c.y }; emit('checkpoint', { x: c.x, y: c.y }); } });
      // ворота арены
      if (S.bossState === 'none' && h.x > S.lv.gate.x + 1.6 && h.ground) startBoss();
      // враги
      {
        for (i = 0; i < S.enemies.length; i++) if (!S.enemies[i].dead) updFoe(S.enemies[i], dt);
        S.nests.forEach(function (n) {
          if (S.bossState !== 'none') return;
          if (Math.abs(h.x - n.x) < 15 && Math.abs(h.y - n.y) < 10) { n.t -= dt; if (n.t <= 0 && S.enemies.filter(function (e) { return e.type === 'moth' && !e.dead && e.nest === n.x; }).length < 1) { n.t = 3.6; var e = mkFoe('moth', n.x, n.y, 0); e.nest = n.x; e.act = true; e.face = sgn(h.x - n.x) || -1; S.enemies.push(e); emit('flutter'); } }
        });
        updBoss(dt);
      }
      if (S.phase !== 'play') return;
      S.enemies = S.enemies.filter(function (e) { return !e.dead; });
      // снаряды врагов
      for (i = 0; i < S.eshots.length; i++) {
        var q = S.eshots[i]; if (q.dead) continue; q.life -= dt;
        var qd = dt;
        if (q.roll != null) {
          if (q.rolling) { q.x += q.roll * qd; if (solid(Wd, Math.floor(q.x + sgn(q.roll) * q.r), Math.floor(q.y))) q.dead = true; }
          else { q.vy += q.g * qd; q.y += q.vy * qd; var fy = floorY(q.x); if (q.y + q.r >= fy) { q.y = fy - q.r; q.rolling = true; } }
        } else {
          q.vy += q.g * qd; q.x += q.vx * qd; q.y += q.vy * qd;
          if (q.egg) { var fy2 = floorY(q.x); if (q.y + q.r >= fy2) { q.dead = true; [-1, 1].forEach(function (d) { shot({ k: 'shard', x: q.x, y: fy2 - 0.25, vx: d * 4.2, r: 0.22, dmg: 2, life: 0.9 }); }); emit('crack'); continue; } }
          if (q.k === 'oil' || q.k === 'nut' || q.k === 'ember' || q.k === 'dart') { if (solid(Wd, Math.floor(q.x), Math.floor(q.y))) { q.dead = true; continue; } }
          if (q.wave && solid(Wd, Math.floor(q.x + sgn(q.vx) * q.r), Math.floor(q.y))) { q.dead = true; continue; }
        }
        q.spin = (q.spin || 0) + qd * 10;
        if (circleHitsHero(q.x, q.y, q.r)) { if (hurt(q.dmg, q.x, q.k)) q.dead = q.k !== 'wave'; }
        if (q.life <= 0 || q.y > S.lv.H + 1) q.dead = true;
      }
      if (S.phase !== 'play') return;
      S.eshots = S.eshots.filter(function (q) { return !q.dead; });
      // предметы
      for (i = 0; i < S.items.length; i++) {
        var it = S.items[i]; it.t += dt;
        if (!it.ground) { it.vy = Math.min(10, it.vy + 22 * dt); var py = it.y; it.y += it.vy * dt; for (var r3 = Math.ceil(py - 1e-6); r3 <= Math.floor(it.y); r3++) if (floorAt(Wd, Math.floor(it.x), r3, py)) { it.y = r3; it.ground = true; it.vy = 0; break; } if (it.y > S.lv.H + 1) it.dead = true; }
        if (!it.keep && it.k.indexOf('spark') === 0 && it.t > 9) it.dead = true;
        if (Math.abs(it.x - h.x) < 0.6 + K.HW && it.y > h.y - hh(h) - 0.3 && it.y - 0.6 < h.y + 0.1) { pick(it); it.dead = true; if (it.idx != null) S.taken[it.idx] = 1; }
      }
      S.items = S.items.filter(function (it) { return !it.dead; });
      if (S.phase !== 'play') return;
      // камера
      var ct = camTarget(); S.cam.x += (ct.x - S.cam.x) * Math.min(1, dt * 8); S.cam.y += (ct.y - S.cam.y) * Math.min(1, dt * 6);
      if (Math.abs(ct.x - S.cam.x) > 12) S.cam.x = ct.x;
    }
    function pick(it) {
      var k = it.k;
      if (k === 'spark') { S.sparks = Math.min(K.SPARKMAX, S.sparks + 1); addScore(K.SPARKPTS); }
      else if (k === 'spark5') { S.sparks = Math.min(K.SPARKMAX, S.sparks + 5); addScore(K.SPARKPTS * 5); }
      else if (k === 'coil') { if (S.coil < 3) { S.coil++; emit('coil', { lvl: S.coil }); } else addScore(1000); }
      else if (k === 'oil') S.hp = Math.min(K.HP, S.hp + 6);
      else if (k === 'token') addScore(500);
      else if (k === 'core') { emit('pickup', { k: k, x: it.x, y: it.y }); clearFloor(); return; }
      emit('pickup', { k: k, x: it.x, y: it.y });
    }

    api = {
      start: start, update: update, state: function () { return S; }, mute: false,
      setInput: function (i) { if (S) S.inp = i || {}; },
      // площадка: «Ещё один шанс» — с отметки, жизнь одна, здоровье 60%; бонус в паузе — полное здоровье и +1 ступень катушки (раз за партию)
      reviveAd: function () {
        if (S.phase !== 'over' && S.phase !== 'cont' && S.phase !== 'dead') return false;
        S.over = false; S.lives = 1; respawn(); S.hp = Math.ceil(K.HP * 0.6); S.hero.inv = 2; emit('revived'); return true;
      },
      canBoost: function () { return !S.boosted && S.phase === 'play' && (S.hp < K.HP || S.coil < 3); },
      boost: function () { if (!api.canBoost()) return false; S.boosted = true; S.hp = K.HP; S.coil = Math.min(3, S.coil + 1); emit('boost'); return true; },
      continueGame: function () {
        if (S.phase !== 'cont') return;
        S.conts--; S.lives = K.LIVES; S.score = 0; S.nextLife = K.LIFE1; S.coil = 1; S.sparks = K.SPARK0; S.cp = null; S.taken = {};
        resetFloorState(); S.phase = 'play'; emit('continued');
      },
      giveUp: function () { if (S.phase === 'cont') { S.phase = 'over'; S.over = true; emit('gameover', { score: S.score }); } },
      clone: function () { var g2 = T.Game({ state: dcopy(S), dmgMul: dmgMul }); g2.mute = true; return g2; },
      saveData: function () { return { fi: S.fi, coil: S.coil, sparks: S.sparks, score: S.score }; },
      // тестовые хуки
      _floor: function (fi) { initFloor(fi); return api; },
      _place: function (x, y) { var h = S.hero; h.x = x; h.y = y; h.vx = h.vy = 0; h.ground = true; h.stair = null; h.on = -1; S.cam = camTarget(); return api; },
      _hurt: function (d, fx) { return hurt(d, fx == null ? S.hero.x + 1 : fx, 'test'); },
      _die: function (w) { S.hp = 0; die(w || 'test'); },
      _coil: function (n) { S.coil = n; },
      _startBoss: function () { startBoss(); S.bossState = 'fight'; S.boss.st = 'start'; S.boss.t = 0; return S.boss; },
      _bossDamage: function (n) { if (S.boss) { S.boss.iv = 0; return damageBoss(n); } },
      _spawn: function (type, x, y) { var e = mkFoe(type, x, y, 0); e.act = true; S.enemies.push(e); return e; },
      _flick: flick
    };
    return api;
  };

  // миграция записей игроков сайта (механика сменилась): прежний рекорд — в «прежний рекорд», сохранение стирается; один раз
  // io = { get(key), set(key, value), del(key) }
  T.migrate = function (io) {
    if (io.get('arcade.tsep.v') === '2') return { migrated: false, oldBest: +io.get('arcade.tsep.oldBest') || 0, notice: io.get('arcade.tsep.notice') === '1' };
    var oldBest = +io.get('arcade.best.tsep') || 0, had = oldBest > 0 || !!io.get('arcade.save.tsep');
    io.set('arcade.tsep.v', '2');
    if (had) {
      if (oldBest > 0) io.set('arcade.tsep.oldBest', String(oldBest));
      io.del('arcade.best.tsep'); io.del('arcade.save.tsep'); io.set('arcade.tsep.notice', '1');
    }
    return { migrated: had, oldBest: oldBest, notice: had };
  };

  T.logic = {
    K: K, FOE: FOE, BOSS: BOSS, mulberry32: mulberry32, tileAt: tileAt, solid: solid, platAt: platAt, sawHit: sawHit,
    newHero: newHero, heroStep: heroStep, hh: hh, simulate: simulate, bodyBlocked: bodyBlocked, flickOk: flickOk,
    standable: standable, nodeOf: nodeOf, pointNode: pointNode, Nav: Nav, rideCtl: rideCtl, staticWorld: staticWorld,
    encode: encode, decode: decode, ALPH: ALPH
  };
})(typeof window !== 'undefined' ? window : globalThis);
