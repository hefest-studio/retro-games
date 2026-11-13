/* ЛИСТ · рендер. Мир — страница книги в координатах страницы; камера показывает текущую панель крупно,
   а соседние панели видны по краям. modern — «бумага»: кремовый лист, тушь, растровая (точечная) заливка, лубочные
   цвета; retro — 16-цветный пиксель: мир рисуется в буфер 320×180 и растягивается ×2 без сглаживания.
   LIST.R.draw(g, ctx, S, game, view) — кадр; FX — частицы и надписи-ономатопеи. */
(function (global) {
  'use strict';
  var LIST = global.LIST = global.LIST || {};
  var LV = LIST.levels, LG = LIST.logic;
  var VW = 640, VH = 360, Z = 1.6, VIS = 1.3;   // VIS — визуальный масштаб фигур (хитбоксы — в логике)
  var E = { k: '#000000', b: '#0000aa', g: '#00aa00', c: '#00aaaa', r: '#aa0000', m: '#aa00aa', n: '#aa5500', l: '#aaaaaa', d: '#555555', B: '#5555ff', G: '#55ff55', C: '#55ffff', R: '#ff5555', M: '#ff55ff', y: '#ffff55', w: '#ffffff' };
  var retro = false, TR = function (k) { return k; };
  function C(m, r) { return retro ? r : m; }
  var PAL = {
    desk: function () { return C('#2b2420', E.k); },
    paper: function () { return C('#efe4c8', E.l); },
    ink: function () { return C('#1d1915', E.k); },
    bg: [null, { m: '#ecd29a', dot: '#c98b3a', r: E.c, r2: E.b }, { m: '#c9dccb', dot: '#4f7a6a', r: E.y, r2: E.n }, { m: '#f2d6cf', dot: '#c25a4a', r: E.M, r2: E.m }],
    floor: function (ch) { return retro ? [null, E.n, E.g, E.r][ch] : [null, '#8a5a2e', '#3f6b52', '#8e3b30'][ch]; }
  };

  // ---------- растровые узоры (modern) ----------
  var pats = {};
  function pattern(ctx, key, color, step, r) {
    if (pats[key] !== undefined) return pats[key];
    var doc = global.document; if (!doc || !doc.createElement) return (pats[key] = null);
    var c = doc.createElement('canvas'); c.width = step; c.height = step;
    var x = c.getContext && c.getContext('2d'); if (!x) return (pats[key] = null);
    x.fillStyle = color; x.beginPath(); x.arc(step / 4, step / 4, r, 0, 7); x.arc(step * 3 / 4, step * 3 / 4, r, 0, 7); x.fill();
    var p = null; try { p = ctx.createPattern(c, 'repeat'); } catch (e) { p = null; }
    return (pats[key] = p || null);
  }
  var ditherP = {};
  function dither(ctx, a, b) {
    var key = a + b; if (ditherP[key] !== undefined) return ditherP[key];
    var doc = global.document; if (!doc || !doc.createElement) return (ditherP[key] = a);
    var c = doc.createElement('canvas'); c.width = 2; c.height = 2; var x = c.getContext && c.getContext('2d'); if (!x) return (ditherP[key] = a);
    x.fillStyle = a; x.fillRect(0, 0, 2, 2); x.fillStyle = b; x.fillRect(0, 0, 1, 1); x.fillRect(1, 1, 1, 1);
    var p = null; try { p = ctx.createPattern(c, 'repeat'); } catch (e) { p = null; }
    return (ditherP[key] = p || a);
  }

  // ---------- примитивы ----------
  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function srect(ctx, x, y, w, h, c, lw) { ctx.strokeStyle = c; ctx.lineWidth = lw || 1; ctx.strokeRect(x, y, w, h); }
  function circ(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function ell(ctx, x, y, rx, ry, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); ctx.fill(); }
  function line(ctx, x0, y0, x1, y1, c, lw) { ctx.strokeStyle = c; ctx.lineWidth = lw || 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
  function poly(ctx, pts, c, stroke, lw) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); if (c) { ctx.fillStyle = c; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); } }
  function txt(ctx, s, x, y, size, c, align, weight, stroke) {
    ctx.font = (weight || 800) + ' ' + size + 'px ' + (retro ? '"Courier New", monospace' : 'Georgia, "Times New Roman", serif');
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1.5, size / 5); ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
    ctx.fillStyle = c; ctx.fillText(s, x, y);
  }
  function uiTxt(ctx, s, x, y, size, c, align, weight) {
    ctx.font = (weight || 800) + ' ' + size + 'px ' + (retro ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif');
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = c; ctx.fillText(s, x, y);
  }

  // ---------- кэш статической геометрии панелей ----------
  var specCache = {};
  function panelSpec(ch, pg, id) {
    var k = ch + ':' + pg + ':' + id; if (specCache[k]) return specCache[k];
    var sp = LV.buildPanel(ch, pg, id), rt = LG.makeRuntime(sp); LG.rebuildSolids(rt);
    return (specCache[k] = { spec: sp, rt: rt });
  }

  // ---------- FX ----------
  var FX = { parts: [], ono: [] };
  FX.clear = function () { FX.parts = []; FX.ono = []; };
  FX.add = function (x, y, o) {
    o = o || {}; var n = o.n || 6;
    for (var i = 0; i < n; i++) { var a = (o.a != null ? o.a : 0) + (Math.random() - 0.5) * (o.spread != null ? o.spread : 6.3), sp = (o.sp || 60) * (0.4 + Math.random() * 0.8);
      FX.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: o.life || 0.5, max: o.life || 0.5, c: o.c || '#000', r: o.r || 1.5, g: o.g != null ? o.g : 200, sq: o.sq }); }
  };
  FX.ono = [];
  FX.word = function (x, y, word, o) { o = o || {}; FX.ono.push({ x: x, y: y, s: word, t: 0, life: o.life || 0.75, big: !!o.big, rot: (Math.random() - 0.5) * 0.4, col: o.col }); if (FX.ono.length > 8) FX.ono.shift(); };
  FX.step = function (dt) {
    for (var i = FX.parts.length - 1; i >= 0; i--) { var p = FX.parts[i]; p.life -= dt; if (p.life <= 0) { FX.parts.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    for (var j = FX.ono.length - 1; j >= 0; j--) { var w = FX.ono[j]; w.t += dt; if (w.t >= w.life) FX.ono.splice(j, 1); }
  };
  function drawFX(ctx) {
    FX.parts.forEach(function (p) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max * 1.5)); rect(ctx, p.x - p.r / 2, p.y - p.r / 2, p.r, p.sq ? p.r * 0.6 : p.r, p.c); });
    ctx.globalAlpha = 1;
  }
  // надписи-ономатопеи — на экранном слое (крупно и чётко в обеих темах)
  function drawOno(ctx, sp, cam) {
    FX.ono.forEach(function (w) {
      var k = w.t / w.life, sc = (k < 0.15 ? 0.4 + k / 0.15 * 0.8 : 1.2 - Math.min(0.2, (k - 0.15))) * Z * 0.85, R = w.big ? 22 : 17;
      var sx = VW / 2 + (sp.x + w.x - cam.x) * Z, sy = VH / 2 + (sp.y + Math.max(18, w.y - 24) - k * 8 - cam.y) * Z;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(w.rot); ctx.scale(sc, sc);
      ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
      var pts = [], n = 12; for (var i = 0; i < n * 2; i++) { var rr = i % 2 ? R * 0.62 : R * (1 + (i % 4 === 0 ? 0.12 : 0)); var a = i / (n * 2) * Math.PI * 2; pts.push(Math.cos(a) * rr * 1.35, Math.sin(a) * rr * 0.85); }
      poly(ctx, pts, retro ? E.w : (w.col || '#ffd23a'), C('#1d1915', E.k), 1.4);
      txt(ctx, w.s, 0, 4, w.big ? 11 : 9, C('#d0281c', E.r), 'center', 900, C('#1d1915', E.k));
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  // ---------- герой: Литер ----------
  function hero(ctx, h, t, opts) {
    opts = opts || {};
    var x = h.x, y = h.y, f = h.face, ink = C('#1d1915', E.k);
    if (h.inv > 0 && !opts.still && Math.floor(t * 20) % 2 === 0) ctx.globalAlpha = 0.45;
    var skin = C('#e9b98f', E.y), shirt = C('#2e7d78', E.c), apron = C('#8a5a2b', E.n), pants = C('#3b3b4a', E.d), boot = ink, hat = C('#fbf7ee', E.w), hair = C('#3a2618', E.n), glove = C('#5a3a1a', E.n);
    var walk = h.ground && Math.abs(h.vx) > 1 ? Math.sin(h.walkT * 14) : 0;
    var pose = opts.pose || (h.drawT > 0 ? 'draw' : h.hurt > 0 ? 'hurt' : h.jk > 0 ? 'jk' : h.block ? 'block' : h.hold ? 'hold' : h.throwT > 0 ? 'throw' : h.atk > 0 ? 'atk' + h.combo : !h.ground ? 'air' : 'stand');
    ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
    if (pose === 'hurt') ctx.rotate(-0.25);
    // ноги
    var l1 = walk * 3, l2 = -walk * 3;
    if (pose === 'jk') { line(ctx, -1, -10, 10, -6, pants, 3.4); rect(ctx, 9, -8, 4, 4, boot); line(ctx, -1, -10, -4, -3, pants, 3.4); rect(ctx, -6, -4, 4, 3, boot); }
    else if (pose === 'atk2') { line(ctx, 0, -10, 11, -12, pants, 3.4); rect(ctx, 10, -14, 4, 4, boot); line(ctx, -1, -10, -3, 0, pants, 3.4); rect(ctx, -5, -3, 5, 3, boot); }
    else if (pose === 'air') { line(ctx, 1, -10, 4, -3, pants, 3.4); line(ctx, -2, -10, -4, -2, pants, 3.4); rect(ctx, 2, -4, 4, 3, boot); rect(ctx, -6, -3, 4, 3, boot); }
    else { line(ctx, 1, -10, 1 + l1, -2, pants, 3.4); line(ctx, -2, -10, -2 + l2, -2, pants, 3.4); rect(ctx, -1 + l1, -3, 5, 3, boot); rect(ctx, -4 + l2, -3, 5, 3, boot); }
    // корпус: рубаха и фартук
    rect(ctx, -4.5, -20, 9, 11, shirt);
    poly(ctx, [-3.5, -19, 4.5, -19, 5, -7, -2.5, -7], apron);
    line(ctx, -3.5, -19, -4.5, -21.5, apron, 1); // лямка
    if (!retro) { line(ctx, 0.5, -15, 3.5, -15, 'rgba(0,0,0,.25)', 0.8); }
    // руки
    var shY = -18;
    function arm(ax, ay, bx, by, back) { line(ctx, ax, ay, (ax + bx) / 2, (ay + by) / 2, back ? C('#256a65', E.b) : shirt, 2.8); line(ctx, (ax + bx) / 2, (ay + by) / 2, bx, by, skin, 2.4); rect(ctx, bx - 1.8, by - 1.8, 3.6, 3.6, glove); }
    if (pose === 'atk0') { arm(0, shY, 4, -12, true); arm(1, shY, 14, -18); }
    else if (pose === 'atk1') { arm(1, shY, 5, -13); arm(0, shY, 14, -17, true); }
    else if (pose === 'atk2') { arm(0, shY, -5, -13, true); arm(1, shY, 6, -22); }
    else if (pose === 'jk') { arm(0, shY, -6, -22, true); arm(1, shY, 5, -12); }
    else if (pose === 'block') { arm(0, shY, 6, -21, true); arm(1, shY, 6, -15); line(ctx, 6, -24, 6, -12, C('rgba(255,255,255,.6)', E.w), 1); }
    else if (pose === 'hold' || pose === 'throw') { arm(0, shY, 10, -22, true); arm(1, shY, 11, -20); }
    else if (pose === 'draw') { arm(0, shY, 4, -12, true); arm(1, shY, 11, -14 + Math.sin(t * 30) * 2); line(ctx, 11, -14, 14, -9, C('#d8a23a', E.y), 1.6); }
    else if (pose === 'hurt') { arm(0, shY, -8, -24, true); arm(1, shY, 6, -25); }
    else if (pose === 'air') { arm(0, shY, -6, -22, true); arm(1, shY, 7, -23); }
    else { arm(0, shY, -3 - walk * 2, -11, true); arm(1, shY, 3 + walk * 2, -11); }
    // голова
    circ(ctx, 0.5, -23.5, 4.3, skin);
    poly(ctx, [-4, -25, -3.5, -21, -1.5, -22, -1, -25.5], hair);
    rect(ctx, 2.2, -24.5, 1.3, 1.6, ink);                                    // глаз
    line(ctx, 2, -21.4, 3.8, -21.4, C('#8a4a2a', E.r), 0.8);                 // рот
    // бумажная шапка печатника (сложенная газетная «лодочка»)
    poly(ctx, [-5.2, -26, 5.8, -26, 4, -28.6, 0.6, -31.8, -3.2, -28.6], hat, ink, 0.8);
    line(ctx, -4.4, -26.8, 5, -26.8, C('#c3b8a0', E.l), 0.8);
    if (!retro) { line(ctx, -1.5, -29, 2.2, -29.4, '#9b9282', 0.5); }
    ctx.restore(); ctx.globalAlpha = 1;
    if (h.shield > 0) { ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 10); ell(ctx, x, y - 13, 12, 17, C('#9fd0ff', E.C)); ctx.globalAlpha = 1; srect(ctx, x - 12, y - 30, 24, 34, C('#d6a640', E.y), 0.7); }
  }

  // ---------- враги ----------
  function eyes(ctx, x, y, dx, s, pupilC) { s = s || 1; ell(ctx, x - 2.4 * s, y, 1.8 * s, 2.2 * s, C('#ffffff', E.w)); ell(ctx, x + 2.4 * s, y, 1.8 * s, 2.2 * s, C('#ffffff', E.w)); circ(ctx, x - 2.4 * s + dx * 0.8, y + 0.4, 0.9 * s, pupilC || C('#1d1915', E.k)); circ(ctx, x + 2.4 * s + dx * 0.8, y + 0.4, 0.9 * s, pupilC || C('#1d1915', E.k)); }
  function inkShape(ctx, x, y, w, h, c, t, seed) {
    ctx.fillStyle = c; ctx.beginPath();
    var n = 10; for (var i = 0; i <= n; i++) { var a = Math.PI + i / n * Math.PI, r = 1 + 0.12 * Math.sin(t * 6 + i * 2.1 + seed); var px = x + Math.cos(a) * w / 2 * r, py = y - h / 2 + Math.sin(a) * h / 2 * r; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.lineTo(x + w / 2 + 2, y); ctx.lineTo(x - w / 2 - 2, y); ctx.closePath(); ctx.fill();
  }
  function enemy(ctx, e, t, hx) {
    var x = e.x, y = e.y, ink = C('#14101a', E.k), dx = Math.sign(hx - x) || e.face;
    if (e.state === 'spawn') { // капля стекает сверху и растекается в фигуру
      var k = e.dripY, top = 0;
      if (e.st < 0.5) { var dy = top + (y - top) * k * k; ell(ctx, x, dy - 3, 2.5, 4, ink); line(ctx, x, top, x, dy - 6, ink, 0.8); }
      else { var q = (e.st - 0.5) / 0.35; ell(ctx, x, y - 1, 8 * q + 2, 2 + q * (e.type === 'guard' ? 8 : 4), ink); }
      return;
    }
    if (e.state === 'dead') { var d = Math.min(1, e.st / 0.5); ctx.globalAlpha = 1 - d; ell(ctx, x, y - 1, 9 + d * 8, 2.5 - d, ink); ctx.globalAlpha = 1; return; }
    var flash = e.hurt > 0 && Math.floor(t * 30) % 2 === 0;
    if (e.type === 'blot') {
      var sq = e.wind > 0 ? 1 + (0.42 - e.wind) * 1.2 : 1, w = 14 * sq, h = 12 / sq;
      inkShape(ctx, x, y, w, h, flash ? C('#5a4a6a', E.d) : ink, t, e.id);
      circ(ctx, x - 7, y - 1, 1.6, ink); circ(ctx, x + 6, y - 0.5, 1.3, ink);
      if (!retro) { ell(ctx, x - 3, y - h + 3, 2, 1.2, 'rgba(255,255,255,.25)'); }
      eyes(ctx, x + dx * 1.5, y - h * 0.62, dx, 0.9);
      if (e.wind > 0) { line(ctx, x - 4, y - h * 0.62 - 3, x - 1, y - h * 0.62 - 2, C('#ffffff', E.w), 0.8); line(ctx, x + 4, y - h * 0.62 - 3, x + 1, y - h * 0.62 - 2, C('#ffffff', E.w), 0.8); }
    } else if (e.type === 'guard') {
      var f = e.face, body = flash ? C('#4a4a6a', E.d) : C('#1a1e33', E.b);
      ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
      line(ctx, -2, -9, -3, 0, ink, 2.6); line(ctx, 2, -9, 3, 0, ink, 2.6);
      inkShape(ctx, 0, -8, 13, 18, body, t, e.id);
      // шлем-чернильница
      rect(ctx, -5, -32, 10, 9, C('#24304e', E.B)); if (!retro) rect(ctx, -3.5, -31, 2, 7, 'rgba(255,255,255,.35)');
      rect(ctx, -2.5, -35, 5, 3, C('#a0703a', E.n));
      rect(ctx, -3, -27, 7, 1.6, C('#ffffff', E.w)); rect(ctx, 1, -27, 2, 1.6, C('#d0281c', E.R));
      // линейка-копьё
      var ang = e.wind > 0 ? -2.2 : e.atkT > 0 ? -0.1 : -1.1;
      ctx.save(); ctx.translate(4, -17); ctx.rotate(ang);
      rect(ctx, 0, -1.6, 30, 3.2, C('#d9a441', E.y)); for (var i = 3; i < 30; i += 3) line(ctx, i, -1.6, i, i % 6 ? -0.4 : 0.6, C('#6a4a1a', E.n), 0.5);
      ctx.restore();
      circ(ctx, 5, -17, 2, ink);
      ctx.restore();
      if (e.stun > 0) for (var s = 0; s < 3; s++) circ(ctx, x + Math.cos(t * 6 + s * 2.1) * 7, y - 38 + Math.sin(t * 6 + s * 2.1) * 2, 1.2, C('#ffd23a', E.y));
    } else if (e.type === 'nib') {
      var ang2 = e.atkT > 0 && e.dive ? Math.atan2(e.dive.vy, e.dive.vx) - Math.PI / 2 : e.state === 'stuck' ? 0 : Math.sin(t * 3 + e.id) * 0.2 + (e.wind > 0 ? Math.sin(t * 60) * 0.25 : 0);
      ctx.save(); ctx.translate(x, y - 7); ctx.rotate(e.state === 'stuck' ? 0 : ang2 + (e.atkT > 0 ? 0 : Math.PI));
      if (e.state === 'stuck') ctx.rotate(Math.PI);
      poly(ctx, [-5, -6, 5, -6, 5, 1, 0, 8, -5, 1], flash ? C('#ffffff', E.w) : C('#9aa3ad', E.l), ink, 0.8);
      line(ctx, 0, 0, 0, 8, ink, 0.8); circ(ctx, 0, 0, 1.2, ink);
      if (!retro) rect(ctx, -4, -5, 2, 5, 'rgba(255,255,255,.5)');
      circ(ctx, 0, 8.5, 1.4, C('#1d1915', E.b));
      ctx.restore();
      eyes(ctx, x, y - 11, dx, 0.6);
    }
  }
  function boss(ctx, B, t, hx) {
    var x = B.x, y = B.y, ink = C('#14101a', E.k), dx = Math.sign(hx - x) || B.face, flash = B.hurt > 0 && Math.floor(t * 30) % 2 === 0;
    var a = B.state === 'enter' ? Math.min(1, B.t / 1.3) : B.state === 'down' ? Math.max(0, 1 - B.t / 1.5) : 1;
    ctx.globalAlpha = a;
    if (B.type === 'queen') {
      var sq = B.state === 'wind' ? 1.15 : B.state === 'recover' ? 1.25 : 1;
      inkShape(ctx, x, y, 40 * sq, 34 / sq, flash ? C('#6a4a7a', E.d) : C('#22142e', E.m), t, 3);
      // корона из капель
      for (var i = -1; i <= 1; i++) { var cx = x + i * 9, cy = y - 34 / sq - 2; poly(ctx, [cx - 3.5, cy + 3, cx, cy - 7 - (i === 0 ? 3 : 0), cx + 3.5, cy + 3], C('#d6a640', E.y), ink, 0.7); circ(ctx, cx, cy - 7 - (i === 0 ? 3 : 0), 1.4, C('#d0281c', E.R)); }
      eyes(ctx, x - 6 + dx * 2, y - 20, dx, 1.3); eyes(ctx, x + 7 + dx * 2, y - 22, dx, 1.1);
      ell(ctx, x + dx * 3, y - 10, 6, B.state === 'wind' ? 3.5 : 1.5, C('#d0281c', E.r));
    } else if (B.type === 'binder') {
      var f = B.face; ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
      var lean = B.state === 'wind' || B.state === 'charge' ? 0.35 : 0; ctx.rotate(lean);
      line(ctx, -5, -12, -6, 0, ink, 4); line(ctx, 5, -12, 6, 0, ink, 4);
      rect(ctx, -11, -32, 22, 22, flash ? C('#8a6a5a', E.d) : C('#4a2a1a', E.n));
      // голова-катушка ниток
      rect(ctx, -6, -42, 12, 10, C('#e8dcc0', E.w)); for (var j = 0; j < 4; j++) line(ctx, -6, -41 + j * 2.5, 6, -40 + j * 2.5, C('#c0392b', E.r), 1);
      rect(ctx, -7, -43, 14, 2, C('#7a5030', E.n)); rect(ctx, -7, -33, 14, 2, C('#7a5030', E.n));
      rect(ctx, 0, -39, 4, 2, ink);
      // щит-обложка
      rect(ctx, 8, -36, 7, 30, C('#9a2a22', E.r)); srect(ctx, 8, -36, 7, 30, ink, 0.8);
      rect(ctx, 8, -36, 3, 3, C('#d6a640', E.y)); rect(ctx, 12, -36, 3, 3, C('#d6a640', E.y)); rect(ctx, 8, -9, 3, 3, C('#d6a640', E.y)); rect(ctx, 12, -9, 3, 3, C('#d6a640', E.y));
      ctx.restore();
      if (B.state === 'stun') for (var s = 0; s < 4; s++) circ(ctx, x + Math.cos(t * 5 + s * 1.6) * 12, y - 48 + Math.sin(t * 5 + s * 1.6) * 3, 1.6, C('#ffd23a', E.y));
    } else {
      var bob = B.state === 'ground' ? 0 : Math.sin(t * 3) * 1;
      ctx.save(); ctx.translate(x, y + bob);
      // мантия
      poly(ctx, [-10, -30, 10, -30, 13, -2, 6, 0, 0, -4, -6, 0, -13, -2], flash ? C('#c8c8c8', E.l) : C('#f7f6f0', E.w), ink, 1);
      if (B.state !== 'ground') for (var d = 0; d < 3; d++) { var dy2 = (t * 30 + d * 9) % 18; ell(ctx, -6 + d * 6, 2 + dy2, 1.3, 2, C('#f7f6f0', E.w)); }
      // голова — флакон корректора
      rect(ctx, -6, -44, 12, 14, C('#f7f6f0', E.w)); srect(ctx, -6, -44, 12, 14, ink, 0.9);
      rect(ctx, -6, -39, 12, 4, C('#c0392b', E.r));
      rect(ctx, -3, -49, 6, 5, C('#2a2a2a', E.d));
      ell(ctx, -2.5 + dx, -41.5, 2.2, 1.6, ink); ell(ctx, 2.5 + dx, -41.5, 2.2, 1.6, ink); line(ctx, -0.4, -41.5, 0.4, -41.5, ink, 0.6);
      // ластик-посох
      line(ctx, 12, -32, 12, 2, C('#7a5030', E.n), 1.6); rect(ctx, 9, -38, 7, 7, C('#e88aa0', E.M)); srect(ctx, 9, -38, 7, 7, ink, 0.6);
      if (B.state === 'cast') { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 20); circ(ctx, 12, -35, 6, C('#ffffff', E.w)); ctx.globalAlpha = a; }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- предметы ----------
  function itemIcon(ctx, k, x, y, t, s) {
    s = s || 1; var ink = C('#1d1915', E.k);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (k === 'ink' || k === 'drop') {
      if (k === 'drop') { ell(ctx, 0, -3, 2.6, 3.2, C('#2b3a8a', E.B)); poly(ctx, [-1.6, -5, 0, -9, 1.6, -5], C('#2b3a8a', E.B)); }
      else { rect(ctx, -5, -8, 10, 8, C('#2b3a8a', E.b)); srect(ctx, -5, -8, 10, 8, ink, 0.8); rect(ctx, -2.5, -11, 5, 3, C('#a0703a', E.n)); if (!retro) rect(ctx, -3.5, -7, 2, 5, 'rgba(255,255,255,.4)'); }
    } else if (k === 'letter') {
      rect(ctx, -5, -11, 10, 11, C('#f6e7b8', E.y)); srect(ctx, -5, -11, 10, 11, C('#d0281c', E.r), 1);
      txt(ctx, 'Б', 0, -2.5, 8, C('#d0281c', E.r), 'center', 900);
    } else if (k === 'sheet') {
      poly(ctx, [-5, -12, 3, -12, 6, -9, 6, 0, -5, 0], C('#ffffff', E.w), ink, 0.8); line(ctx, -3, -8, 3, -8, C('#8fa8c8', E.B), 0.6); line(ctx, -3, -5, 4, -5, C('#8fa8c8', E.B), 0.6);
    } else if (k === 'scis') {
      ctx.rotate(Math.sin(t * 4) * 0.2);
      line(ctx, -5, -9, 5, -1, C('#9aa3ad', E.l), 1.6); line(ctx, -5, -1, 5, -9, C('#9aa3ad', E.l), 1.6);
      ctx.strokeStyle = C('#d0281c', E.r); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(-5, -10, 2, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(-5, 0, 2, 0, 7); ctx.stroke();
    } else if (k === 'flask') {
      ell(ctx, 0, -4, 4.5, 4.5, C('#3a2a6a', E.m)); rect(ctx, -1.5, -11, 3, 4, C('#9aa3ad', E.l)); srect(ctx, -1.5, -11, 3, 4, ink, 0.5);
      if (!retro) ell(ctx, -1.5, -5.5, 1.2, 1.6, 'rgba(255,255,255,.5)');
    } else if (k === 'mark') {
      poly(ctx, [-3, -12, 3, -12, 3, 0, 0, -3, -3, 0], C('#c0392b', E.r), ink, 0.7); line(ctx, -2, -10, 2, -10, C('#d6a640', E.y), 0.8);
    } else if (k === 'pencil') {
      ctx.rotate(-0.6); rect(ctx, -1.6, -11, 3.2, 9, C('#d9a441', E.y)); poly(ctx, [-1.6, -2, 1.6, -2, 0, 2], C('#e9c9a0', E.w)); circ(ctx, 0, 1.5, 0.6, ink); rect(ctx, -1.6, -12.5, 3.2, 1.6, C('#e88aa0', E.M));
    }
    ctx.restore();
  }

  // ---------- панель ----------
  function panelBg(ctx, sp, state, lit) {
    var ch = sp.ch, P = PAL.bg[ch];
    if (sp.blank && state !== 'unseen') { rect(ctx, 0, 0, sp.w, sp.h, C('#fbf8f0', E.w)); return; }
    if (state === 'unseen') {
      rect(ctx, 0, 0, sp.w, sp.h, C('#f4ecd8', E.d));
      ctx.globalAlpha = retro ? 1 : 0.35;
      for (var gx = 10; gx < sp.w; gx += 20) line(ctx, gx, 0, gx - 30, sp.h, C('#8fa8c8', E.l), 0.5);
      ctx.globalAlpha = 1; return;
    }
    if (retro) { rect(ctx, 0, 0, sp.w, sp.h, P.r); ctx.fillStyle = dither(ctx, P.r, P.r2); ctx.fillRect(0, 0, sp.w, 10); return; }
    rect(ctx, 0, 0, sp.w, sp.h, P.m);
    var pt = pattern(ctx, 'dot' + ch, P.dot, 6, 1.1);
    if (pt) { ctx.globalAlpha = 0.45; ctx.fillStyle = pt; ctx.fillRect(0, 0, sp.w, sp.h * 0.7); ctx.globalAlpha = 1; }
    var g = ctx.createLinearGradient(0, 0, 0, sp.h); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(0,0,0,.08)'); ctx.fillStyle = g; ctx.fillRect(0, 0, sp.w, sp.h);
    if (!lit) { ctx.fillStyle = 'rgba(239,228,200,.35)'; ctx.fillRect(0, 0, sp.w, sp.h); }
  }
  // фоновый декор главы: наборные кассы, стопки книг, белые полосы стёртого
  function decor(ctx, sp, state) {
    if (state === 'unseen' || sp.blank) return;
    var ch = sp.ch, F = sp.F, ink = retro ? PAL.bg[ch].r2 : 'rgba(29,25,21,.28)', seed = sp.id.charCodeAt(0) * 7 + sp.pg * 13;
    ctx.save();
    if (ch === 1) {
      for (var i = 0; i < 3; i++) { var x = 30 + ((seed * (i + 3)) % Math.max(40, sp.w - 90)), y = 34 + (i % 2) * 22, w = 44, h = 26;
        srect(ctx, x, y, w, h, ink, 1); for (var c = 1; c < 4; c++) line(ctx, x + c * w / 4, y, x + c * w / 4, y + h, ink, 0.6); line(ctx, x, y + h / 2, x + w, y + h / 2, ink, 0.6); }
    } else if (ch === 2) { // полки с корешками книг — высоко на заднем плане
      for (var j = 0; j < 2; j++) { var bx = 20 + ((seed * (j + 5)) % Math.max(40, sp.w - 110)), sy = 40 + j * 30;
        line(ctx, bx, sy, bx + 80, sy, ink, 1.2);
        for (var b = 0; b < 9; b++) { var bh = 14 + ((b * 5 + j) % 4) * 3; srect(ctx, bx + 2 + b * 8.5, sy - bh, 7, bh, ink, 0.8); } }
    } else {
      ctx.globalAlpha = retro ? 1 : 0.55;
      for (var k = 0; k < 3; k++) { var sx = 20 + ((seed * (k + 2)) % Math.max(40, sp.w - 100)); rect(ctx, sx, 26 + k * 24, 70, 9, C('#ffffff', E.w)); }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function hatch(ctx, x, y, w, h, c, step) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.strokeStyle = c; ctx.lineWidth = 0.7; ctx.beginPath();
    for (var i = -h; i < w; i += step) { ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); } ctx.stroke(); ctx.restore();
  }
  function solidsDraw(ctx, sp, sol, state, P) {
    var ink = C('#1d1915', E.k), fl = PAL.floor(sp.ch), unseen = state === 'unseen';
    sol.forEach(function (s) {
      if (s.k === 'floor') {
        if (unseen) { srect(ctx, s.x, s.y, s.w, s.h, C('#8fa8c8', E.l), 0.8); return; }
        rect(ctx, s.x, s.y, s.w, s.h, fl); if (!retro) hatch(ctx, s.x, s.y + 3, s.w, s.h - 3, 'rgba(0,0,0,.25)', 4);
        line(ctx, s.x, s.y + 0.5, s.x + s.w, s.y + 0.5, ink, 1.6);
        if (s.chunk != null && P && P.eraseWarn && P.eraseWarn[s.chunk] != null) { ctx.setLineDash && ctx.setLineDash([3, 2]); srect(ctx, s.x + 1, s.y - 2, s.w - 2, s.h, C('#ffffff', E.w), 1.5); ctx.setLineDash && ctx.setLineDash([]); ctx.globalAlpha = 0.5; rect(ctx, s.x, s.y, s.w, s.h, C('#ffffff', E.w)); ctx.globalAlpha = 1; }
      } else if (s.k === 'block') {
        if (unseen) { srect(ctx, s.x, s.y, s.w, s.h, C('#8fa8c8', E.l), 0.8); return; }
        rect(ctx, s.x, s.y, s.w, s.h, C('#d9c69a', E.n)); hatch(ctx, s.x, s.y, s.w, s.h, C('rgba(29,25,21,.5)', E.k), 3); srect(ctx, s.x, s.y, s.w, s.h, ink, 1.4);
      } else if (s.k === 'ledge') {
        rect(ctx, s.x, s.y, s.w, s.h, C('#d9a441', E.y)); srect(ctx, s.x, s.y, s.w, s.h, ink, 1);
      } else if (s.k === 'cover') {
        rect(ctx, s.x, s.y, s.w, 4, C('#f6eedb', E.w)); line(ctx, s.x, s.y + 4, s.x + s.w, s.y + 4, ink, 0.8);
        ctx.setLineDash && ctx.setLineDash([2, 2]); line(ctx, s.x + 2, s.y + 2, s.x + s.w - 2, s.y + 2, C('#c0392b', E.r), 0.8); ctx.setLineDash && ctx.setLineDash([]);
      } else if (s.k === 'gate') {
        for (var gy = 4; gy < s.h; gy += 2) { }
        for (var gx = 0; gx < s.w; gx += 3) line(ctx, s.x + gx + 1, 0, s.x + gx + 1, s.h, C('#5a5f66', E.d), 1.6);
        rect(ctx, s.x - 1, s.h - 30, s.w + 2, 3, C('#5a5f66', E.d)); rect(ctx, s.x - 1, 20, s.w + 2, 3, C('#5a5f66', E.d));
      } else if (s.k === 'frame') {
        rect(ctx, s.x, s.y, s.w, 6, C('#b07a3a', E.n)); srect(ctx, s.x, s.y, s.w, 6, ink, 1); for (var fx = 6; fx < s.w; fx += 10) circ(ctx, s.x + fx, s.y + 3, 1, C('#d6a640', E.y));
      } else if (s.k === 'sketch') {
        rect(ctx, s.x, s.y, s.w, Math.min(s.h, 8), C('#f3efe6', E.w)); srect(ctx, s.x, s.y, s.w, Math.min(s.h, 8) + (s.h > 8 ? s.h - 8 : 0), ink, 1.3);
        if (s.h > 8) { rect(ctx, s.x, s.y, s.w, s.h, C('#f3efe6', E.w)); srect(ctx, s.x, s.y, s.w, s.h, ink, 1.3); hatch(ctx, s.x, s.y, s.w, s.h, C('rgba(29,25,21,.35)', E.d), 5); }
        else hatch(ctx, s.x, s.y, s.w, 8, C('rgba(29,25,21,.35)', E.d), 5);
      }
    });
  }
  function drawPanel(ctx, sp, rt, state, S, t, lit) {
    var ink = C('#1d1915', E.k);
    ctx.save(); ctx.translate(sp.x, sp.y);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, sp.w, sp.h); ctx.clip();
    panelBg(ctx, sp, state, lit); decor(ctx, sp, state);
    // ямы: тёмный провал под полом
    sp.pits.forEach(function (p) {
      if (state === 'unseen') return;
      if (sp.blank && p.k === 'pit') { ctx.setLineDash && ctx.setLineDash([2, 3]); srect(ctx, p.x0, sp.F, p.x1 - p.x0, sp.h - sp.F - 1, C('#9aa3ad', E.l), 1); ctx.setLineDash && ctx.setLineDash([]); return; }
      rect(ctx, p.x0, sp.F, p.x1 - p.x0, sp.h - sp.F, C(p.k === 'hole' ? '#3a2a20' : '#1d1915', E.k));
    });
    if (rt && rt.chunks) Object.keys(rt.erased).forEach(function (i) { var cw = sp.w / rt.chunks; rect(ctx, i * cw, sp.F, cw, sp.h - sp.F, C('#ffffff', E.w)); ctx.setLineDash && ctx.setLineDash([3, 3]); srect(ctx, i * cw + 1, sp.F, cw - 2, sp.h - sp.F - 1, C('#9aa3ad', E.l), 1); ctx.setLineDash && ctx.setLineDash([]); });
    // контур эскиза (что можно дорисовать)
    if (sp.sketch && !(rt && rt.drawn) && state !== 'unseen') {
      ctx.setLineDash && ctx.setLineDash([3, 3]);
      sp.sketch.parts.forEach(function (p) { srect(ctx, p.x, p.y, p.w, p.h, C('#5f86c0', E.B), 1.2); });
      ctx.setLineDash && ctx.setLineDash([]);
      if (rt && rt.drawT > 0 && rt.drawT < 1) { ctx.save(); var pr = sp.sketch.parts; ctx.beginPath(); pr.forEach(function (p) { ctx.rect(p.x, p.y, p.w * rt.drawT, p.h); }); ctx.clip(); solidsDraw(ctx, sp, pr, state); ctx.restore(); }
      var z = sp.sketch.zone; if (rt && state === 'cur') { ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 5); rect(ctx, z[0], sp.F - 2, z[1] - z[0], 2, C('#5f86c0', E.B)); ctx.globalAlpha = 1; }
    }
    var sol = rt ? rt.sol : panelSpec(sp.ch, sp.pg, sp.id).rt.sol;
    solidsDraw(ctx, sp, sol, state, rt);
    if (state !== 'unseen') {
      // рычаг
      if (sp.lever) { var L = sp.lever, on = rt ? rt.leverOn : false; rect(ctx, L.x - 2, L.y - 8, 4, 8, C('#5a5f66', E.d)); ctx.save(); ctx.translate(L.x, L.y - 7); ctx.rotate(on ? 0.8 : -0.8); line(ctx, 0, 0, 0, -12, ink, 1.6); circ(ctx, 0, -12, 2.4, C('#d0281c', E.R)); ctx.restore(); }
      // висящая рамка
      if (sp.frame && (!rt || rt.frame !== 'down')) {
        var fr = sp.frame, fy = rt ? rt.frameY : fr.hangY, r = fr.rect;
        if (!rt || rt.frame === 'hang') { line(ctx, fr.pin.x, fr.pin.y, r.x + 4, fy, C('#6a5a4a', E.l), 0.8); line(ctx, r.x + r.w - 4, 0, r.x + r.w - 4, fy, C('#6a5a4a', E.l), 0.8); circ(ctx, fr.pin.x, fr.pin.y, 2.2, C('#9aa3ad', E.l)); circ(ctx, fr.pin.x, fr.pin.y, 0.9, ink); }
        rect(ctx, r.x, fy, r.w, 6, C('#b07a3a', E.n)); srect(ctx, r.x, fy, r.w, 6, ink, 1);
        for (var q = 6; q < r.w; q += 10) circ(ctx, r.x + q, fy + 3, 1, C('#d6a640', E.y));
      }
      // подставка с карандашами
      if (sp.stand && !(rt && rt.drawn)) { var sx = sp.stand.x; rect(ctx, sx - 4, sp.F - 9, 8, 9, C('#7a5030', E.n)); srect(ctx, sx - 4, sp.F - 9, 8, 9, ink, 0.8); line(ctx, sx - 2, sp.F - 9, sx - 3, sp.F - 17, C('#d9a441', E.y), 1.6); line(ctx, sx + 1, sp.F - 9, sx + 2, sp.F - 18, C('#5f86c0', E.B), 1.6); line(ctx, sx + 3, sp.F - 9, sx + 5, sp.F - 15, C('#c0392b', E.r), 1.6); }
      // разрывы бумаги
      if (rt) rt.tears.forEach(function (tr) { var X = tr.side === 'L' ? 0 : sp.w, d = tr.side === 'L' ? 1 : -1; poly(ctx, [X, tr.y - 12, X + d * 8, tr.y - 8, X + d * 4, tr.y - 3, X + d * 10, tr.y + 2, X + d * 5, tr.y + 7, X, tr.y + 11], C('#1d1915', E.k)); });
      // предметы панели (для текущей — из состояния)
      var items = rt && S ? S.items : sp.items.map(function (it) { return { k: it.k, x: it.x, y: sp.F }; });
      items.forEach(function (it) { itemIcon(ctx, it.k, it.x, it.y - 1 + (rt ? Math.sin(t * 3 + it.x) * 1 : 0), t); });
      // подпись-плашка
      if (sp.cap && S && state !== 'unseen' && !retro && state !== 'cur') {
        var s = TR(sp.cap), cw = Math.min(sp.w - 16, 200);
        var lines = wrap(ctx, s, cw - 8, 7.2); var ch = lines.length * 9 + 6;
        rect(ctx, 6, 6, cw, ch, C('#f6e7b8', E.y)); srect(ctx, 6, 6, cw, ch, ink, 1);
        lines.forEach(function (l, i) { txt(ctx, l, 10, 14 + i * 9, 7.2, C('#3a2a1a', E.k), 'left', 700); });
      }
    }
    ctx.restore();
    // рамка панели (+ печать «запечатано» на дальней стороне)
    var lw = retro ? 2 : 2.4;
    srect(ctx, 0, 0, sp.w, sp.h, state === 'unseen' ? C('#7d8ea8', E.d) : ink, lw);
    if (sp.seal && state !== 'unseen' && !(rt && rt.sealOpen)) {
      var X = sp.dir > 0 ? sp.w - 2 : 2;
      line(ctx, X, 4, X, sp.F - 2, C('#c0392b', E.r), 3);
      for (var yy = 12; yy < sp.F - 6; yy += 12) { line(ctx, X - 3, yy - 3, X + 3, yy + 3, ink, 1); line(ctx, X - 3, yy + 3, X + 3, yy - 3, ink, 1); }
    }
    if (rt && rt.sealOpen && sp.seal) { var X2 = sp.dir > 0 ? sp.w : 0, d2 = sp.dir > 0 ? -1 : 1; poly(ctx, [X2, 30, X2 + d2 * 6, 46, X2 + d2 * 2, 70, X2 + d2 * 7, 96, X2 + d2 * 3, 120, X2, sp.F], C('#1d1915', E.k)); }
    if (!retro && state !== 'unseen') { // лубочные уголки
      [[0, 0], [sp.w, 0], [0, sp.h], [sp.w, sp.h]].forEach(function (c) { circ(ctx, c[0], c[1], 3, C('#c0392b', E.r)); circ(ctx, c[0], c[1], 1.2, C('#d6a640', E.y)); });
    }
    ctx.restore();
  }
  function wrap(ctx, s, maxW, size) {
    ctx.font = '700 ' + size + 'px ' + (retro ? '"Courier New", monospace' : 'Georgia, serif');
    var words = String(s).split(' '), out = [], cur = '';
    words.forEach(function (w) { var tryS = cur ? cur + ' ' + w : w; if (ctx.measureText(tryS).width > maxW && cur) { out.push(cur); cur = w; } else cur = tryS; });
    if (cur) out.push(cur); return out;
  }

  // ---------- страница ----------
  function drawPage(ctx, S, game, t, opts) {
    var ch = S.ch, pg = S.pg, ids = LV.pageIds(pg), curId = S.pid, P = game.panel();
    rect(ctx, -2000, -2000, 5000, 5000, PAL.desk());
    // тень и лист
    rect(ctx, 8, 10, LV.PAGE_W, LV.PAGE_H, C('rgba(0,0,0,.35)', E.k));
    rect(ctx, 0, 0, LV.PAGE_W, LV.PAGE_H, PAL.paper());
    if (!retro) { var pt = pattern(ctx, 'paper', 'rgba(120,90,40,.10)', 5, 0.7); if (pt) { ctx.fillStyle = pt; ctx.fillRect(0, 0, LV.PAGE_W, LV.PAGE_H); } }
    // номер страницы и колонтитул
    txt(ctx, '— ' + ((ch - 1) * 2 + pg) + ' —', LV.PAGE_W / 2, LV.PAGE_H - 2, 8, C('#6a5a4a', E.d), 'center', 700);
    var view = opts.view;
    ids.forEach(function (id) {
      var sp = panelSpec(ch, pg, id).spec;
      if (view && (sp.x > view.x1 || sp.x + sp.w < view.x0 || sp.y > view.y1 || sp.y + sp.h < view.y0)) return;
      var state = id === curId ? 'cur' : S.visited[pg + ':' + id] ? 'seen' : 'unseen';
      drawPanel(ctx, id === curId ? game.spec() : sp, id === curId ? P : null, state, S, t, id === curId);
    });
  }

  // ---------- кадр ----------
  var off = null, offCtx = null;
  function draw(g, ctx, S, game, view) {
    retro = g.themeName === 'retro'; var t = S.t; TR = function (k) { return g.t(k); };
    var target = ctx, scale = Z;
    if (retro) {
      if (!off && global.document) { off = global.document.createElement('canvas'); off.width = VW / 2; off.height = VH / 2; offCtx = off.getContext('2d', { willReadFrequently: true }); }
      if (offCtx) { target = offCtx; scale = Z / 2; }
    }
    var W = retro && offCtx ? VW / 2 : VW, Hh = retro && offCtx ? VH / 2 : VH;
    target.save();
    if (target.imageSmoothingEnabled !== undefined) target.imageSmoothingEnabled = !retro;
    target.translate(Math.round(W / 2 - view.cam.x * scale), Math.round(Hh / 2 - view.cam.y * scale)); target.scale(scale, scale);
    var vx0 = view.cam.x - VW / 2 / Z, vy0 = view.cam.y - VH / 2 / Z;
    drawPage(target, S, game, t, { view: { x0: vx0 - 10, x1: vx0 + VW / Z + 10, y0: vy0 - 10, y1: vy0 + VH / Z + 10 } });
    // сущности текущей панели
    var sp = game.spec(), P = game.panel(), h = S.hero;
    if (sp && S.phase !== 'turn') {
      target.save(); target.translate(sp.x, sp.y);
      target.save(); target.beginPath(); target.rect(0, 0, sp.w, sp.h); target.clip();
      var big = function (x, y, fn) { target.save(); target.translate(x, y); target.scale(VIS, VIS); target.translate(-x, -y); fn(); target.restore(); };
      S.en.forEach(function (e) { big(e.x, e.y, function () { enemy(target, e, t, h.x); }); });
      if (S.boss) big(S.boss.x, S.boss.y, function () { boss(target, S.boss, t, h.x); });
      S.proj.forEach(function (p) {
        if (p.k === 'scis') { target.save(); target.translate(p.x, p.y + 6); target.rotate(t * 20); itemIcon(target, 'scis', 0, 5, 0); target.restore(); }
        else if (p.k === 'flask') itemIcon(target, 'flask', p.x, p.y + 5, t);
        else if (p.k === 'staple') { line(target, p.x - 5, p.y, p.x + 5, p.y, C('#9aa3ad', E.l), 2); line(target, p.x - 5, p.y - 2, p.x - 5, p.y + 2, C('#9aa3ad', E.l), 1.4); line(target, p.x + 5, p.y - 2, p.x + 5, p.y + 2, C('#9aa3ad', E.l), 1.4); }
        else if (p.k === 'putty') { circ(target, p.x, p.y, 3.4, C('#ffffff', E.w)); target.strokeStyle = C('#1d1915', E.k); target.lineWidth = 0.6; target.beginPath(); target.arc(p.x, p.y, 3.4, 0, 7); target.stroke(); }
      });
      if (S.phase !== 'dead' || Math.floor(S.phaseT * 8) % 2 === 0) { if (S.phase === 'trans') target.globalAlpha = Math.min(1, S.phaseT / 0.3); big(h.x, h.y, function () { hero(target, h, t); }); target.globalAlpha = 1; }
      target.restore();
      // стрелка выхода
      if (P && P.cleared && S.phase === 'play' && !S.boss) {
        var bl = 0.5 + 0.5 * Math.sin(t * 6);
        target.globalAlpha = bl;
        sp.exits.forEach(function (ex) {
          if (ex.need === 'tear' && !P.sealOpen) return;
          var ac = C('#d0281c', E.R);
          if (ex.s === 'R') poly(target, [sp.w - 16, sp.F - 30, sp.w - 6, sp.F - 22, sp.w - 16, sp.F - 14], ac, C('#1d1915', E.k), 0.8);
          else if (ex.s === 'L') poly(target, [16, sp.F - 30, 6, sp.F - 22, 16, sp.F - 14], ac, C('#1d1915', E.k), 0.8);
          else { var cx = (ex.hole.x0 + ex.hole.x1) / 2; poly(target, [cx - 7, sp.F - 22, cx + 7, sp.F - 22, cx, sp.F - 10], ac, C('#1d1915', E.k), 0.8); }
        });
        target.globalAlpha = 1;
      }
      target.restore();
      target.save(); target.translate(sp.x, sp.y); drawFX(target); target.restore();
    }
    if (S.phase === 'turn') pageTurn(target, S.phaseT / 1.3);
    target.restore();
    if (retro && offCtx) { quantize(offCtx); ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, VW, VH); ctx.restore(); }
    if (sp && S.phase !== 'turn') drawOno(ctx, sp, view.cam);
    if (sp && sp.cap && S.phase !== 'turn') caption(ctx, sp, view.cam);
    hud(g, ctx, S, game);
    if (view.banner) banner(g, ctx, view.banner);
  }
  // подпись-плашка текущей панели — на экранном слое (чёткий текст в обеих темах)
  function caption(ctx, sp, cam) {
    var sx = VW / 2 + (sp.x + 6 - cam.x) * Z, sy = VH / 2 + (sp.y + 6 - cam.y) * Z, cw = Math.min(sp.w - 16, 200) * Z;
    var s = TR(sp.cap), lines = wrap(ctx, s, cw - 12, 11), h = lines.length * 14 + 8;
    ctx.save(); rect(ctx, sx, sy, cw, h, C('#f6e7b8', E.y)); srect(ctx, sx, sy, cw, h, C('#1d1915', E.k), retro ? 2 : 1.5);
    lines.forEach(function (l, i) { txt(ctx, l, sx + 6, sy + 15 + i * 14, 11, C('#3a2a1a', E.k), 'left', 700); });
    ctx.restore();
  }
  // retro: приведение буфера 320×180 к 16 цветам EGA (ближайший цвет, кэш по 15-битному ключу)
  var EGA = [], qCache = null;
  Object.keys(E).forEach(function (k) { var v = parseInt(E[k].slice(1), 16); EGA.push([v >> 16 & 255, v >> 8 & 255, v & 255]); });
  function quantize(c) {
    var img; try { img = c.getImageData(0, 0, VW / 2, VH / 2); } catch (e) { return; }
    if (!img || !img.data) return;
    if (!qCache) qCache = new Int16Array(32768).fill(-1);
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var key = (d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3), q = qCache[key];
      if (q < 0) { var best = 0, bd = 1e9; for (var j = 0; j < EGA.length; j++) { var e = EGA[j], dr = d[i] - e[0], dg = d[i + 1] - e[1], db = d[i + 2] - e[2], dd = dr * dr * 3 + dg * dg * 4 + db * db * 2; if (dd < bd) { bd = dd; best = j; } } qCache[key] = q = best; }
      var c2 = EGA[q]; d[i] = c2[0]; d[i + 1] = c2[1]; d[i + 2] = c2[2]; d[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }
  function pageTurn(ctx, k) {
    // лист загибается справа налево
    var W = LV.PAGE_W, H = LV.PAGE_H, x = W * (1 - k * 1.1);
    ctx.save();
    poly(ctx, [x, 0, W, 0, W, H, x - 60, H], C('rgba(239,228,200,.98)', E.l), C('#1d1915', E.k), 2);
    if (!retro) { var g = ctx.createLinearGradient(x - 60, 0, x + 80, 0); g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 60, 0, 140, H); }
    ctx.restore();
  }

  // ---------- HUD ----------
  function hud(g, ctx, S, game) {
    var th = g.th(), ink = C('#1d1915', E.k), h = S.hero, K = LIST.logic.K;
    ctx.save();
    rect(ctx, 0, 0, VW, 26, C('rgba(29,25,21,.82)', E.k));
    uiTxt(ctx, g.t('ch') + ' ' + S.ch + ' · ' + g.t('ch' + S.ch) + ' · ' + g.t('pg') + ' ' + S.pg, 8, 17, retro ? 11 : 11, C('#f3e6c4', E.w), 'left', 700);
    // чернила
    var bx = 250, bw = 150;
    itemIcon(ctx, 'ink', bx - 12, 21, 0, 1.1);
    rect(ctx, bx, 8, bw, 11, C('#4a3f34', E.d)); var hp = Math.max(0, h.hp) / K.INK;
    rect(ctx, bx, 8, bw * hp, 11, hp < 0.25 ? C('#d0281c', E.R) : C('#3b5bd6', E.B));
    if (!retro) rect(ctx, bx, 8, bw * hp, 3, 'rgba(255,255,255,.25)');
    srect(ctx, bx, 8, bw, 11, C('#f3e6c4', E.w), 1);
    uiTxt(ctx, g.t('ink') + ' ' + Math.max(0, Math.ceil(h.hp)), bx + bw / 2, 17.5, 9, C('#ffffff', E.w), 'center', 800);
    // листы (жизни)
    for (var i = 0; i < K.LIVES; i++) { var lx = 418 + i * 15; poly(ctx, [lx, 6, lx + 8, 6, lx + 11, 9, lx + 11, 21, lx, 21], i < S.lives ? C('#fbf7ee', E.w) : 'rgba(0,0,0,0)', C('#f3e6c4', E.l), 1); }
    uiTxt(ctx, g.t('score') + ' ' + S.score, VW - 8, 17, 11, C('#f3e6c4', E.w), 'right', 800);
    // инвентарь
    for (var s = 0; s < 3; s++) {
      var x = 8 + s * 34, y = VH - 38, sel = s === S.sel;
      rect(ctx, x, y, 30, 30, C('rgba(29,25,21,.78)', E.k)); srect(ctx, x, y, 30, 30, sel ? C('#ffd23a', E.y) : C('#8a7a64', E.d), sel ? 2 : 1);
      uiTxt(ctx, String(s + 1), x + 3, y + 9, 8, C('#bfb39a', E.l), 'left', 700);
      if (S.inv[s]) itemIcon(ctx, S.inv[s], x + 15, y + 24, S.t, 1.5);
    }
    var cur = S.inv[S.sel];
    if (cur) uiTxt(ctx, g.t('it_' + cur) + ' · E', 112, VH - 14, 10, C('#f3e6c4', E.w), 'left', 700);
    // босс
    if (S.boss && S.boss.state !== 'down') {
      var B = S.boss, w = 220, x0 = VW / 2 - w / 2, y0 = VH - 22;
      rect(ctx, x0 - 4, y0 - 16, w + 8, 24, C('rgba(29,25,21,.8)', E.k));
      uiTxt(ctx, g.t('b_' + B.type), VW / 2, y0 - 4, 10, C('#f3e6c4', E.w), 'center', 900);
      rect(ctx, x0, y0, w, 5, C('#4a3f34', E.d)); rect(ctx, x0, y0, w * B.hp / B.max, 5, C('#d0281c', E.R));
    }
    if (S.msg && S.msg.t > 0) { ctx.globalAlpha = Math.min(1, S.msg.t * 2); uiTxt(ctx, S.msg.s, VW / 2, 44, 12, C('#ffd23a', E.y), 'center', 800); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  function banner(g, ctx, b) {
    var a = Math.min(1, b.a * 3, (b.dur - b.a) * 4 + 0.2);
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, a));
    var w = 460, lines = b.lines || [], h = 70 + lines.length * 16, x = VW / 2 - w / 2, y = VH / 2 - h / 2 - 10;
    rect(ctx, x, y, w, h, C('#f6e7b8', E.y)); srect(ctx, x, y, w, h, C('#1d1915', E.k), 2.5);
    if (!retro) { srect(ctx, x + 4, y + 4, w - 8, h - 8, '#c0392b', 1); }
    uiTxt(ctx, b.title, VW / 2, y + 32, 22, C('#c0392b', E.r), 'center', 900);
    if (b.sub) uiTxt(ctx, b.sub, VW / 2, y + 52, 12, C('#3a2a1a', E.k), 'center', 700);
    lines.forEach(function (l, i) { uiTxt(ctx, l, VW / 2, y + 70 + i * 16, 11, C('#3a2a1a', E.k), 'center', 600); });
    ctx.restore();
  }

  LIST.R = { draw: draw, hero: hero, enemy: enemy, boss: boss, itemIcon: itemIcon, drawPage: drawPage, FX: FX, VW: VW, VH: VH, Z: Z, E: E,
    setRetro: function (r) { retro = r; }, isRetro: function () { return retro; }, panelSpec: panelSpec, wrap: wrap, banner: banner, txt: txt };
})(typeof window !== 'undefined' ? window : globalThis);
