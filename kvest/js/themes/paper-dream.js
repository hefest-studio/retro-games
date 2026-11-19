/* МАЯЧНИЦА · themes/paper-dream.js — расширение темы «бумага» для снов, живой туши и хора огней (dream.js, chorus.js, главы 5–6),
   подключается после paper.js и его расширений. Через paper._ext (тот же «станок» вырезок, кэш спрайтов и палитры) добавляет:
   — палитры сна: dream (общая) и dream_<имя> для каждой палитры «бумаги» — «негатив» листа в холодном индиго (то, что было тёмным,
     светится, свет стал тенью): место узнаётся, но оно «наоборот»; предметы сцены остаются своего цвета — их видно;
   — kind: inkdraw (ожившая тушь: перо ведёт линию, готовый рисунок заполняется тёплой бумагой — дверь, мост, лестница, лодка,
     фонарь), inkspot (пустое место: пунктир и призрачный силуэт), inkthought (мысль-эскиз мастера), upfall (вода течёт вверх),
     clang (лязг железа — ломаные красные кольца, тот же язык, что цепь в главе 4), songline (нить мелодии на карте), fogbank (пелена
     тумана); узел карты — карточка ноты и номер по счёту у огней хора;
   — хуки: drawDream (вуаль сна: холодный туман по краям, разводы туши, пылинки вверх; в яви тает), drawChorus (строка мелодии —
     гнёзда нот в LAYOUT.chorus, цвет и точки ноты, как у колокольчиков главы 1), drawFx (финал: рассвет, туман уходит, кольца
     песни тушью, вспышка-переход). */
(function (global) {
  'use strict';
  var KV = global.KVEST = global.KVEST || {}, th = KV.themes && KV.themes.paper; if (!th || !th._ext || th._dream) return; th._dream = true;
  var X = th._ext, C = X.C, K = X.K, LIVE = X.LIVE, TAU = Math.PI * 2, NOTE = X.NOTE;
  var cut = X.cut, poly = X.poly, ell = X.ell, rectP = X.rectP, rrP = X.rrP, band = X.band, strokeL = X.strokeL, addGlow = X.addGlow, drawIconRaw = X.drawIconRaw, dark = X.dark, light = X.light, mix = X.mix;
  var INK = '#2a2420', IVORY = '#f3ead6', VERM = '#c0442e', GOLD = '#e9b949';
  function hash(a, b) { var x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---------- палитры сна: «негатив» листа в индиго ----------
  function hex3(c) { var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function toHex(r, g, b) { return '#' + [r, g, b].map(function (v) { v = Math.round(clamp(v, 0, 255)); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function dreamCol(c) {
    if (typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c)) return c;
    var q = hex3(c), L = (q[0] * 0.3 + q[1] * 0.59 + q[2] * 0.11) / 255, inv = 1 - L, k = 0.28 + inv * 0.62;   // светлое ↔ тёмное
    return toHex(54 * (1 - k) + 196 * k + (q[2] - q[0]) * 0.10, 58 * (1 - k) + 204 * k, 104 * (1 - k) + 236 * k + (q[0] - q[2]) * 0.06);
  }
  function dreamPal(P0) {
    var o = {}, k;
    for (k in P0) { var v = P0[k]; o[k] = Array.isArray(v) ? v.map(function (e) { return dreamCol(e); }) : dreamCol(v); }
    o.sun = null; o.glow = '176,196,255'; o.tint = 'rgba(46,36,96,0.13)'; if (o.fog != null) o.fog = Math.max(0.45, o.fog); if (o.vign) o.vign = 'rgba(20,18,50,0.5)';
    if (o.bandY) o.stars = true; o.dream = true;
    return o;
  }
  var P = X.PALS;
  Object.keys(P).forEach(function (k) { if (k.indexOf('dream') === 0 || k === 'map') return; P['dream_' + k] = dreamPal(P[k]); if (X.INDOOR[k]) X.INDOOR['dream_' + k] = 1; });
  P.dream = P.dream_dusk;

  // ---------- рамки спрайтов ----------
  X.BOX_EXT.push(function (it) {
    var x = it.x, y = it.y, w = it.w, h = it.h;
    switch (it.kind) {
      case 'inkdraw': case 'inkspot': return [x - 24, y - 24, w + 48, h + 48];
      case 'inkthought': return [x - 30, y - 30, w + 60, h + 70];
      case 'upfall': return [x - 30, y + h - 40, w + 60, 70];
      case 'clang': return [x - 30, y - 30, w + 60, h + 60];
      case 'songline': return [x, y, 1, 1];
      case 'fogbank': return [0, 0, 1, 1];
    }
    return null;
  });

  // ---------- живая тушь: фигуры в единичной рамке (линии — перо, fill — что заполняется бумагой, когда рисунок ожил) ----------
  var SHAPES = {
    door: { lines: [[[0.1, 1], [0.1, 0.14], [0.3, 0.03], [0.5, 0], [0.7, 0.03], [0.9, 0.14], [0.9, 1]], [[0, 1], [1, 1]], [[0.24, 0.3], [0.76, 0.3]], [[0.24, 0.3], [0.24, 0.92], [0.76, 0.92], [0.76, 0.3]], [[0.66, 0.6], [0.7, 0.64], [0.66, 0.68], [0.62, 0.64], [0.66, 0.6]]],
      fill: [[0.1, 1], [0.1, 0.14], [0.3, 0.03], [0.5, 0], [0.7, 0.03], [0.9, 0.14], [0.9, 1]], col: '#b98a5c' },
    bridge: { lines: [[[0, 0.56], [1, 0.56]], [[0, 0.78], [1, 0.78]], [[0, 0.56], [0.12, 0.3], [0.3, 0.12], [0.5, 0.05], [0.7, 0.12], [0.88, 0.3], [1, 0.56]], [[0.2, 0.56], [0.2, 0.2]], [[0.4, 0.56], [0.4, 0.07]], [[0.6, 0.56], [0.6, 0.07]], [[0.8, 0.56], [0.8, 0.2]],
        [[0.1, 0.56], [0.1, 0.78]], [[0.3, 0.56], [0.3, 0.78]], [[0.5, 0.56], [0.5, 0.78]], [[0.7, 0.56], [0.7, 0.78]], [[0.9, 0.56], [0.9, 0.78]]],
      fill: [[0, 0.56], [1, 0.56], [1, 0.78], [0, 0.78]], col: '#c9a878' },
    ladder: { lines: [[[0.22, 1], [0.3, 0]], [[0.78, 1], [0.7, 0]], [[0.24, 0.86], [0.76, 0.86]], [[0.25, 0.68], [0.75, 0.68]], [[0.27, 0.5], [0.73, 0.5]], [[0.28, 0.32], [0.72, 0.32]], [[0.3, 0.14], [0.7, 0.14]]],
      fill: [[0.22, 1], [0.3, 0], [0.7, 0], [0.78, 1]], col: '#d9c8a4' },
    boat: { lines: [[[0, 0.55], [1, 0.55], [0.84, 1], [0.16, 1], [0, 0.55]], [[0.5, 0.55], [0.5, 0]], [[0.53, 0.04], [0.9, 0.46], [0.53, 0.46], [0.53, 0.04]], [[0.2, 0.75], [0.8, 0.75]]],
      fill: [[0, 0.55], [1, 0.55], [0.84, 1], [0.16, 1]], col: '#b98a5c' },
    lamp: { lines: [[[0.2, 1], [0.2, 0.3], [0.8, 0.3], [0.8, 1], [0.2, 1]], [[0.08, 0.3], [0.5, 0.02], [0.92, 0.3], [0.08, 0.3]], [[0.04, 1], [0.96, 1]], [[0.5, 0.3], [0.5, 1]], [[0.5, 0.86], [0.4, 0.68], [0.5, 0.44], [0.6, 0.68], [0.5, 0.86]]],
      fill: [[0.2, 1], [0.2, 0.3], [0.8, 0.3], [0.8, 1]], col: '#e9dcae' }
  };
  function shapeOf(st) { return SHAPES[st && st.shape] || SHAPES.door; }
  function pt(it, p) { return [it.x + p[0] * it.w, it.y + p[1] * it.h]; }
  function lineLen(l) { var s = 0; for (var i = 1; i < l.length; i++) s += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); return s; }
  // перо ведёт линии фигуры: frac 0..1 — сколько уже нарисовано; возвращает положение пера (или null, когда всё готово)
  function inkStrokes(ctx, it, sh, frac, boil, lw, col) {
    var lines = sh.lines.map(function (l) { return l.map(function (p) { return pt(it, p); }); }), total = 0, i, k, tip = null;
    for (i = 0; i < lines.length; i++) total += lineLen(lines[i]);
    var left = total * clamp(frac, 0, 1);
    ctx.save(); ctx.strokeStyle = col || INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (i = 0; i < lines.length && left > 0.01; i++) {
      var l = lines[i]; ctx.beginPath();
      var j0 = hash(i, boil) - 0.5, j1 = hash(i + 7, boil) - 0.5;
      ctx.moveTo(l[0][0] + j0, l[0][1] + j1);
      for (k = 1; k < l.length && left > 0.01; k++) {
        var d = Math.hypot(l[k][0] - l[k - 1][0], l[k][1] - l[k - 1][1]), f = d <= left ? 1 : left / d;
        var ex = l[k - 1][0] + (l[k][0] - l[k - 1][0]) * f, ey = l[k - 1][1] + (l[k][1] - l[k - 1][1]) * f;
        ctx.lineTo(ex + (hash(i * 13 + k, boil) - 0.5) * 1.4, ey + (hash(i * 17 + k, boil + 3) - 0.5) * 1.4);
        left -= d; if (f < 1) tip = [ex, ey];
      }
      ctx.lineWidth = (lw || 3) * (0.85 + 0.3 * hash(i, 5)); ctx.stroke();
    }
    ctx.restore();
    return tip;
  }
  K.inkdraw = function (g, it) {   // в спрайте — только бумажная заливка ожившего рисунка; линии туши — живые (LIVE)
    var st = it.state || {}, sh = shapeOf(st); if (!st.live) return;
    var pts = sh.fill.map(function (p) { return pt(it, p); });
    if (st.shape === 'door' && st.open) { cut(g, pts, '#3a2a22', { seed: 8100, lift: 0, raw: true }); cut(g, [pt(it, [0.1, 1]), pt(it, [0.1, 0.14]), pt(it, [0.34, 0.2]), pt(it, [0.34, 0.94])], sh.col, { seed: 8101, lift: 3 }); return; }
    cut(g, pts, sh.col, { seed: 8102, lift: st.shape === 'ladder' ? 0 : 3, sh: 0.3, raw: st.shape === 'ladder' });
    if (st.shape === 'lamp' && st.lit) cut(g, [pt(it, [0.5, 0.86]), pt(it, [0.4, 0.68]), pt(it, [0.5, 0.44]), pt(it, [0.6, 0.68])], '#f2a33a', { seed: 8103, lift: 0, raw: true });
  };
  LIVE.inkdraw = function (ctx, it, t) {
    var st = it.state || {}, d = st.drawn == null ? (st.live ? 1 : 0) : st.drawn; if (d <= 0.001) return;
    var sh = shapeOf(st), boil = Math.floor(t * 2.5), tip;
    if (st.shape === 'door' && st.open && st.live) { addGlow(ctx, it.x + it.w * 0.6, it.y + it.h * 0.6, it.w * 0.9, '255,214,150', 0.3 + 0.05 * Math.sin(t * 3)); }
    if (st.shape === 'lamp' && st.lit && st.live) addGlow(ctx, it.x + it.w / 2, it.y + it.h * 0.62, it.w * 1.5, '255,206,120', 0.5 + 0.08 * Math.sin(t * 5));
    tip = inkStrokes(ctx, it, sh, d, boil, 3);
    if (tip && d < 1) {   // перо: наконечник и капля туши
      ctx.save(); ctx.translate(tip[0], tip[1]); ctx.rotate(-0.6 + Math.sin(t * 18) * 0.06);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fill();
      ctx.fillStyle = IVORY; ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(7, -22); ctx.lineTo(20, -46); ctx.lineTo(11, -20); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (st.live && st.drawn != null && st.drawn >= 1 && !st.open) { var gl = 0.06 + 0.04 * Math.sin(t * 2.4 + it.x); addGlow(ctx, it.x + it.w / 2, it.y + it.h / 2, Math.max(it.w, it.h) * 0.7, '255,236,190', gl); }
  };
  // пустое место для рисунка: бледный лист с пунктирной рамкой и призрачным силуэтом
  K.inkspot = function (g, it) {
    var st = it.state || {}; if (st.used) return;
    var x = it.x, y = it.y, w = it.w, h = it.h;
    g.save(); g.fillStyle = 'rgba(243,234,214,0.20)'; poly(g, rrP(x - 6, y - 6, w + 12, h + 12, 10)); g.fill();
    if (g.setLineDash) g.setLineDash([7, 6]); g.strokeStyle = 'rgba(243,234,214,0.85)'; g.lineWidth = 2; poly(g, rrP(x - 6, y - 6, w + 12, h + 12, 10)); g.stroke();
    if (g.setLineDash) g.setLineDash([3, 5]); inkStrokes(g, it, shapeOf(st), 1, 0, 1.5, 'rgba(42,36,32,0.42)'); if (g.setLineDash) g.setLineDash([]);
    g.restore();
    drawIconRaw(g, 'quill', x + w - 4, y + 2, 26);
  };
  LIVE.inkspot = function (ctx, it, t) { var st = it.state || {}; if (st.used) return; addGlow(ctx, it.x + it.w / 2, it.y + it.h / 2, Math.max(it.w, it.h) * 0.6, '243,234,214', 0.08 + 0.05 * Math.sin(t * 2 + it.x * 0.01)); };
  // мысль-эскиз мастера: лист с рисунком тушью и «хвост» из трёх кружков
  K.inkthought = function (g, it) {
    var st = it.state || {}, cx = it.x + it.w / 2, cy = it.y + it.h / 2, s = Math.min(it.w, it.h);
    cut(g, rrP(cx - s * 0.62, cy - s * 0.62, s * 1.24, s * 1.24, 8), IVORY, { seed: 8200 + (it.seed || 0), lift: 4, sh: 0.3 });
    g.save(); g.strokeStyle = INK; g.lineWidth = 1.4; poly(g, rrP(cx - s * 0.62, cy - s * 0.62, s * 1.24, s * 1.24, 8)); g.stroke(); g.restore();
    drawIconRaw(g, st.icon || 'quill', cx, cy, s * 0.98);
    [[0.2, 0.86, 5], [0.05, 1.1, 3.6], [-0.06, 1.28, 2.4]].forEach(function (q, i) { cut(g, ell(cx + s * q[0], cy + s * q[1], q[2], q[2], 10), IVORY, { seed: 8210 + i, lift: 1.5, raw: true }); });
  };
  LIVE.inkthought = function (ctx, it, t) { addGlow(ctx, it.x + it.w / 2, it.y + it.h / 2, it.w * 1.1, '243,234,214', 0.14 + 0.08 * Math.sin(t * 2.2 + it.x * 0.02)); };
  // вода, которая течёт вверх
  K.upfall = function (g, it) {
    var cx = it.x + it.w / 2, by = it.y + it.h;
    cut(g, ell(cx, by - 4, it.w * 0.5, 7, 18), 'rgba(127,176,196,0.9)', { seed: 8300, lift: 0, raw: true, tex: false });
  };
  LIVE.upfall = function (ctx, it, t) {
    var st = it.state || {}; if (!st.on) return;
    var x = it.x, w = it.w, y0 = it.y + it.h - 6, H0 = it.h, i;
    ctx.save();
    var gr = ctx.createLinearGradient(0, y0, 0, it.y); gr.addColorStop(0, 'rgba(150,196,214,0.78)'); gr.addColorStop(0.75, 'rgba(170,206,226,0.5)'); gr.addColorStop(1, 'rgba(190,214,236,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x + w * 0.2, y0);
    for (i = 0; i <= 10; i++) ctx.lineTo(x + w * 0.2 - Math.sin(i * 0.9 + t * 2) * 5 - i * 1.5, y0 - H0 * i / 10);
    for (i = 10; i >= 0; i--) ctx.lineTo(x + w * 0.8 + Math.sin(i * 0.8 + t * 2.3) * 5 + i * 1.5, y0 - H0 * i / 10);
    ctx.closePath(); ctx.fill();
    ctx.lineCap = 'round';
    for (i = 0; i < 9; i++) {   // струи и капли идут вверх
      var f = ((t * (0.35 + hash(i, 1) * 0.3) + hash(i, 2)) % 1), sx = x + w * (0.25 + 0.5 * hash(i, 3)) + Math.sin(f * 6 + i) * 4, sy = y0 - f * H0;
      ctx.strokeStyle = 'rgba(236,246,250,' + (0.75 * (1 - f)).toFixed(3) + ')'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 16 - 10 * hash(i, 4)); ctx.stroke();
      ctx.fillStyle = 'rgba(236,246,250,' + (0.8 * (1 - f)).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(sx + 9 * (hash(i, 5) - 0.5), sy - 30, 2.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };
  // лязг железа: ломаные красные кольца (тот же язык, что оборванная цепь у колокола в главе 4)
  function jagRing(ctx, x, y, r, a, lw, seed) {
    if (r < 4 || a <= 0.01) return; var n = 18, k;
    ctx.save(); ctx.lineJoin = 'miter'; ctx.beginPath();
    var a0 = hash(seed, 1) * TAU;
    for (k = 0; k <= n; k++) { var an = a0 + (TAU - 0.4) * k / n, rr = r + (k % 2 ? r * 0.16 + 5 : -r * 0.1 - 3); if (k) ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr * 0.92); else ctx.moveTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr * 0.92); }
    ctx.strokeStyle = 'rgba(150,40,26,' + a.toFixed(3) + ')'; ctx.lineWidth = lw; ctx.stroke(); ctx.restore();
  }
  K.clang = function (g, it) {
    var st = it.state || {}, x = it.x, y = it.y, w = it.w, h = it.h, cx = x + w / 2, v = st.variant || 'chain';
    if (v === 'chain') { for (var i = 0; i < 4; i++) { g.save(); g.strokeStyle = C.iron || '#5a5550'; g.lineWidth = 3.4; g.beginPath(); g.ellipse(cx + (i % 2 ? 2 : -2), y + 8 + i * (h - 16) / 3, 6, 9, i % 2 ? 0.3 : -0.3, 0, TAU); g.stroke(); g.restore(); } }
    else if (v === 'hammer') { cut(g, band([[x + 4, y + h - 4], [cx + 6, y + 14]], 6), '#8a6448', { seed: 8400, lift: 2 }); cut(g, rrP(cx - 6, y, w * 0.6, h * 0.36, 3), C.iron || '#5a5550', { seed: 8401, lift: 3 }); }
    else if (v === 'shutter') { for (var k = 0; k < 3; k++) cut(g, rectP(x, y + k * h / 3 + 2, w, h / 3 - 4), k % 2 ? '#6d6862' : '#5a5550', { seed: 8410 + k, lift: 2 }); }
    if (!st.on && v !== 'winch') { cut(g, band([[x + 2, y + h * 0.5], [x + w - 2, y + h * 0.5 + 3]], 9), '#d97a63', { seed: 8420, lift: 2 }); cut(g, band([[x + 4, y + h * 0.3], [x + w - 4, y + h * 0.74]], 7), '#c96a55', { seed: 8421, lift: 1.5 }); }   // обмотано тряпицей — тихо
  };
  LIVE.clang = function (ctx, it, t) {
    var st = it.state || {}; if (!st.on) return;
    var cx = it.x + it.w / 2, cy = it.y + it.h / 2, per = 1.3, age = (t + (it.seed || 0) * 0.37) % per, a = 1 - age / per;
    for (var k = 0; k < 3; k++) jagRing(ctx, cx, cy, 12 + (age - k * 0.16) * 74, a * (0.85 - k * 0.24), 3.2 - k * 0.7, (it.seed || 1) * 7 + k + Math.floor(t / per));
    var sh = Math.sin(t * 34) * 1.6 * a; ctx.save(); ctx.translate(sh, 0); ctx.restore();
  };
  // пелена тумана (стена тумана над морем, которую уносит финал)
  function fogVeil(ctx, a, t, drift) {
    if (a <= 0.004) return; ctx.save();
    var g = ctx.createLinearGradient(0, 0, 0, 478); g.addColorStop(0, 'rgba(226,230,236,' + (0.78 * a).toFixed(3) + ')'); g.addColorStop(0.55, 'rgba(220,226,232,' + (0.62 * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(214,220,228,' + (0.22 * a).toFixed(3) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 478);
    for (var i = 0; i < 7; i++) {
      var y = 60 + i * 56 + Math.sin(t * 0.3 + i) * 7, w = 300 + hash(i, 2) * 260, x = ((hash(i, 1) * 1300 + t * (7 + i * 2) + (drift || 0) * (i % 2 ? 1 : -1)) % 1500) - 300;
      ctx.fillStyle = 'rgba(244,246,250,' + (0.34 * a).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(x, y, w * 0.5, 22 + hash(i, 3) * 16, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  K.fogbank = function () {};
  LIVE.fogbank = function (ctx, it, t) { var st = it.state || {}; if (st.clear) return; fogVeil(ctx, st.thin ? 0.5 : 1, t, 0); };
  X.ANIM_BREAK.fogbank = 1;
  // нить мелодии на карте: золотая строчка между огнями, спетыми подряд
  K.songline = function () {};
  LIVE.songline = function (ctx, it, t) {
    var st = it.state || {}, p = st.pts; if (!p || p.length < 2) return;
    var a = p[0], b = p[1], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - 26, i;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(42,36,32,0.5)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(mx, my, b[0], b[1]); ctx.stroke();
    ctx.strokeStyle = st.done ? '#ffe9a8' : GOLD; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(mx, my, b[0], b[1]); ctx.stroke();
    for (i = 0; i < 3; i++) { var f = ((t * 0.5 + i / 3) % 1), u = 1 - f, x = u * u * a[0] + 2 * u * f * mx + f * f * b[0], y = u * u * a[1] + 2 * u * f * my + f * f * b[1]; ctx.fillStyle = 'rgba(255,246,210,0.95)'; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, TAU); ctx.fill(); }
    ctx.restore();
  };
  // карточка ноты (точки, как у колокольчиков главы 1)
  function noteCard(ctx, x, y, n, a, lit) {
    n = Math.max(0, Math.min(4, n | 0)); var w = (n + 1) * 10 + 12, hh = 17;
    ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.translate(x, y); ctx.rotate(-0.04);
    ctx.fillStyle = 'rgba(40,22,10,0.25)'; ctx.fillRect(-w / 2 + 1.5, -hh / 2 + 2, w, hh);
    ctx.fillStyle = lit ? '#fff3cf' : IVORY; ctx.fillRect(-w / 2, -hh / 2, w, hh); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.strokeRect(-w / 2, -hh / 2, w, hh);
    for (var d = 0; d <= n; d++) { ctx.beginPath(); ctx.arc(-n * 5 + d * 10, 0, 3.2, 0, TAU); ctx.fillStyle = NOTE[n]; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = INK; ctx.stroke(); }
    ctx.restore();
  }
  var liveNode = LIVE.mapnode;
  LIVE.mapnode = function (ctx, it, t, sc, P0) {
    var st = it.state || {}; if (liveNode) liveNode(ctx, it, t, sc, P0);
    if (!st.voice || st.note == null) return;
    var cx = it.x + it.w / 2, by = it.y + it.h;
    if (st.ready || st.lit) noteCard(ctx, cx, by + 14, st.note, 1, st.lit);
    if (st.sung) { ctx.save(); ctx.fillStyle = GOLD; ctx.strokeStyle = INK; ctx.lineWidth = 1.4; for (var i = 0; i < st.sung; i++) { ctx.beginPath(); ctx.arc(cx - (st.sung - 1) * 4 + i * 8, it.y - 12, 2.8, 0, TAU); ctx.fill(); ctx.stroke(); } ctx.restore(); }
  };

  // ---------- хуки ----------
  // вуаль сна: холодный туман по краям листа, разводы туши, пылинки (во сне — вверх); в яви тает, просыпаясь — светлеет
  function drawDream(ctx, dv, t) {
    if (!dv) return; var mixv = dv.mix == null ? (dv.wake ? 1 : 0) : dv.mix, a = 1 - mixv, i;
    ctx.save();
    if (a > 0.01) {
      var g = ctx.createRadialGradient(480, 250, 150, 480, 250, 620); g.addColorStop(0, 'rgba(206,212,240,0)'); g.addColorStop(0.62, 'rgba(206,212,240,' + (0.26 * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(214,220,244,' + (0.74 * a).toFixed(3) + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 478);
      ctx.lineCap = 'round';
      for (i = 0; i < 6; i++) { var wy = 34 + i * 78 + Math.sin(t * 0.25 + i) * 8, wx = ((hash(i, 9) * 900 + t * (5 + i * 1.5)) % 1300) - 260;
        ctx.beginPath(); ctx.moveTo(wx, wy); ctx.bezierCurveTo(wx + 70, wy - 12, wx + 150, wy + 12, wx + 260, wy - 2); ctx.strokeStyle = 'rgba(40,36,60,' + ((0.07 + hash(i, 8) * 0.07) * a).toFixed(3) + ')'; ctx.lineWidth = 5 + hash(i, 7) * 8; ctx.stroke(); }
    }
    for (i = 0; i < 26; i++) {   // пылинки и капли: во сне плывут вверх
      var sp = 9 + hash(i, 4) * 18, px = (hash(i, 3) * 960 + Math.sin(t * 0.4 + i) * 14) % 960, py = dv.up ? (hash(i, 5) * 478 - t * sp + 47800) % 478 : (hash(i, 5) * 478 + Math.sin(t * 0.5 + i * 2) * 10);
      ctx.fillStyle = 'rgba(240,244,255,' + ((0.16 + hash(i, 6) * 0.3) * (0.35 + 0.65 * a)).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(px, py, 1 + hash(i, 2) * 1.8, 0, TAU); ctx.fill();
      if (dv.up && i % 3 === 0) { ctx.fillRect(px - 0.6, py, 1.2, 7); }
    }
    if (dv.wake && mixv < 1) { var fl = (1 - mixv) * (1 - mixv) * 0.75; ctx.fillStyle = 'rgba(255,246,224,' + fl.toFixed(3) + ')'; ctx.fillRect(0, 0, 960, 478); }   // пробуждение: лист светлеет
    ctx.restore();
  }
  // строка мелодии: гнёзда нот; спетые — цветом ноты и с её точками
  var LCH = { x: 404, y: 30, gap: 38, r: 13 };
  function drawChorus(ctx, cv, t) {
    if (!cv || !cv.n) return; var L = (KV.ThemeAPI && KV.ThemeAPI.LAYOUT && KV.ThemeAPI.LAYOUT.chorus) || LCH, n = cv.n, x0 = 480 - (n - 1) * L.gap / 2, y = L.y, i;
    var miss = cv.miss != null && cv.miss < 1.1 ? 1 - cv.miss / 1.1 : 0, pulse = cv.age != null && cv.age < 0.9 ? 1 - cv.age / 0.9 : 0;
    ctx.save();
    var bw = (n - 1) * L.gap + 48, bx = x0 - 24 + (miss ? Math.sin(t * 40) * 3 * miss : 0), by = y - 20;
    ctx.fillStyle = cv.done ? 'rgba(70,52,20,0.5)' : 'rgba(30,26,40,0.46)'; ctx.beginPath(); ctx.moveTo(bx + 20, by); ctx.arcTo(bx + bw, by, bx + bw, by + 40, 20); ctx.arcTo(bx + bw, by + 40, bx, by + 40, 20); ctx.arcTo(bx, by + 40, bx, by, 20); ctx.arcTo(bx, by, bx + bw, by, 20); ctx.closePath(); ctx.fill();
    for (i = 0; i < n; i++) {
      var cx = x0 + i * L.gap + (miss ? Math.sin(t * 40 + i) * 3 * miss : 0), on = i < cv.k, note = cv.notes[i];
      ctx.beginPath(); ctx.arc(cx, y, L.r, 0, TAU); ctx.strokeStyle = miss ? 'rgba(220,120,100,' + (0.5 + 0.5 * miss).toFixed(2) + ')' : 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.4; if (ctx.setLineDash) ctx.setLineDash(on ? [] : [4, 4]); ctx.stroke(); if (ctx.setLineDash) ctx.setLineDash([]);
      if (!on) continue;
      var last = i === cv.k - 1, r = L.r - 2 + (last ? 3 * pulse : 0);
      if (last && pulse > 0 || cv.done) addGlow(ctx, cx, y, 30, '255,226,150', cv.done ? 0.35 + 0.1 * Math.sin(t * 4 + i) : 0.6 * pulse);
      ctx.beginPath(); ctx.arc(cx, y, r, 0, TAU); ctx.fillStyle = NOTE[note] || GOLD; ctx.fill(); ctx.strokeStyle = IVORY; ctx.lineWidth = 1.6; ctx.stroke();
      for (var d = 0; d <= note; d++) { ctx.beginPath(); ctx.arc(cx - note * 2.4 + d * 4.8, y, 1.7, 0, TAU); ctx.fillStyle = IVORY; ctx.fill(); }
    }
    ctx.restore();
  }
  // эффекты финала на весь лист
  function drawFx(ctx, list, t) {
    if (!list || !list.length) return;
    list.forEach(function (f) {
      var k = clamp(f.k == null ? 1 : f.k, 0, 1), i;
      if (f.name === 'dawn') {   // ночь светлеет: тёплое зарево от горизонта
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        var g = ctx.createRadialGradient(600, 300, 20, 600, 300, 260 + 420 * k); g.addColorStop(0, 'rgba(255,206,130,' + (0.5 * k).toFixed(3) + ')'); g.addColorStop(0.5, 'rgba(255,170,110,' + (0.2 * k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,170,110,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 478); ctx.restore();
      } else if (f.name === 'fogclear') {   // туман уходит: пелена редеет и расходится в стороны
        fogVeil(ctx, 1 - k, t, k * 520);
      } else if (f.name === 'songrings') {   // кольца песни тушью — расходятся от огня
        ctx.save(); ctx.lineCap = 'round';
        for (i = 0; i < 4; i++) { var age = ((f.age || 0) * 0.6 + i * 0.25) % 1, r = 30 + age * 520, a = (1 - age) * (k < 1 ? 1 : Math.max(0, 1 - ((f.age || 0) - 6) / 2));
          if (a <= 0.01) continue; ctx.beginPath(); var a0 = hash(i, 3) * TAU; for (var q = 0; q <= 40; q++) { var an = a0 + (TAU - 0.5) * q / 40, rr = r + (hash(i * 9 + q, Math.floor(t * 2.5)) - 0.5) * 6; if (q) ctx.lineTo(480 + Math.cos(an) * rr, 250 + Math.sin(an) * rr * 0.6); else ctx.moveTo(480 + Math.cos(an) * rr, 250 + Math.sin(an) * rr * 0.6); }
          ctx.strokeStyle = 'rgba(255,236,170,' + (0.75 * a).toFixed(3) + ')'; ctx.lineWidth = 3.4 * (1 - age * 0.5); ctx.stroke();
          ctx.strokeStyle = 'rgba(42,36,32,' + (0.35 * a).toFixed(3) + ')'; ctx.lineWidth = 1.2; ctx.stroke(); }
        ctx.restore();
      } else if (f.name === 'white') {   // вспышка-переход (смена палитры под ней не видна)
        var w = Math.sin(Math.PI * k); if (w > 0.01) { ctx.save(); ctx.fillStyle = 'rgba(255,248,230,' + (0.9 * w).toFixed(3) + ')'; ctx.fillRect(0, 0, 960, 540); ctx.restore(); }
      }
    });
  }
  th.drawDream = drawDream; th.drawChorus = drawChorus; th.drawFx = drawFx;
  th._dreamLib = { SHAPES: SHAPES, dreamPal: dreamPal, fogVeil: fogVeil };
})(typeof window !== 'undefined' ? window : globalThis);
