/* КОРОМЫСЛО · рендер обеих тем: modern (основная — сумерки мастерской, латунь и медь, мягкие тени) и retro (16 цветов EGA,
   пиксельные гирьки, клетчатые блики, сканлайны). Тема меняет только отрисовку. KOROMYSLO.render
   draw(ctx, S, g, o) — o: { bare (без HUD/крана — фон заставки), fx, toasts, preview (индекс чаши под пальцем), daily }.
   Тексты — только через g.t(). Геометрия — KOROMYSLO.logic.GEO. */
(function (global) {
  'use strict';
  var K = global.KOROMYSLO = global.KOROMYSLO || {};
  var L = K.logic, G = L.GEO;

  var PAL = {
    modern: { pixel: false, bg0: '#11202a', bg1: '#2a1f2e', glow: 'rgba(240,180,76,.10)', plank: 'rgba(255,255,255,.025)',
      ink: '#f3efe6', muted: '#9aa3ad', accent: '#f0b44c', beam: '#d9a441', beamDk: '#8a6224', chain: '#b9a27a', pan: '#c2773e', panDk: '#7e4626',
      post: '#4a3b36', postDk: '#2c2322', hudBg: 'rgba(10,14,20,.55)', line: '#33404c', good: '#6fd39a', bad: '#ef5b5b', warn: '#f2c14e',
      W: [null, '#5ad1c4', '#8fd16a', '#f08a5d', '#a78bfa', '#e5484d', '#5b8cff'], rust: '#7d5c4a', rustDk: '#4f382c', pip: 'rgba(255,255,255,.92)' },
    retro: { pixel: true, bg0: '#000000', bg1: '#000000', glow: null, plank: null,
      ink: '#ffffff', muted: '#aaaaaa', accent: '#ffff55', beam: '#ffff55', beamDk: '#aa5500', chain: '#aaaaaa', pan: '#aa5500', panDk: '#555555',
      post: '#555555', postDk: '#000000', hudBg: '#0000aa', line: '#5555ff', good: '#55ff55', bad: '#ff5555', warn: '#ffff55',
      W: [null, '#55ffff', '#55ff55', '#ff55ff', '#ff5555', '#ffffff', '#5555ff'], rust: '#aa5500', rustDk: '#555555', pip: '#000000' }
  };
  function pal(g) { return g.themeName === 'retro' ? PAL.retro : PAL.modern; }

  // ---------- примитивы ----------
  function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function px(v) { return Math.round(v / 2) * 2; }
  function wSize(v) { return { w: 24 + v * 3.5, h: 18 + v * 3 }; }
  var PIPS = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };

  // гирька: x — центр, yb — низ; v — точки; rust — окалина; a — прозрачность
  function weight(ctx, x, yb, v, rust, P, a) {
    var s = wSize(v), w = s.w, h = s.h, y = yb - h, col = rust ? P.rust : P.W[v] || P.W[1];
    ctx.save(); if (a != null) ctx.globalAlpha = a;
    if (P.pixel) {
      x = px(x); y = px(y); w = px(w); h = px(h);
      ctx.fillStyle = P.panDk; ctx.fillRect(x - 6, y - 6, 12, 2); ctx.fillRect(x - 6, y - 6, 2, 6); ctx.fillRect(x + 4, y - 6, 2, 6);   // ушко
      ctx.fillStyle = col; ctx.fillRect(x - w / 2, y, w, h);
      ctx.fillStyle = '#000'; ctx.fillRect(x - w / 2, y + h - 2, w, 2); ctx.fillRect(x + w / 2 - 2, y, 2, h);
      if (rust) { ctx.fillStyle = P.rustDk; for (var k = 0; k < 6; k++) ctx.fillRect(x - w / 2 + ((k * 7) % (w - 4)), y + 2 + ((k * 5) % (h - 6)), 2, 2); }
      else { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x - w / 2 + 2, y + 2, 4, 2); }
    } else {
      ctx.strokeStyle = rust ? P.rustDk : 'rgba(30,30,40,.75)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y - 1, 6, Math.PI, 0); ctx.stroke();                                              // ушко
      var g2 = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g2.addColorStop(0, col); g2.addColorStop(1, shade(col, -0.28));
      ctx.fillStyle = g2; ctx.beginPath();
      ctx.moveTo(x - w / 2 + 5, y); ctx.lineTo(x + w / 2 - 5, y); ctx.quadraticCurveTo(x + w / 2, y + 2, x + w / 2, y + 7);
      ctx.lineTo(x + w / 2, y + h - 4); ctx.quadraticCurveTo(x + w / 2, y + h, x + w / 2 - 4, y + h); ctx.lineTo(x - w / 2 + 4, y + h);
      ctx.quadraticCurveTo(x - w / 2, y + h, x - w / 2, y + h - 4); ctx.lineTo(x - w / 2, y + 7); ctx.quadraticCurveTo(x - w / 2, y + 2, x - w / 2 + 5, y); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x - w / 2 + 4, y + 2, w - 8, 3);
      if (rust) { ctx.fillStyle = P.rustDk; for (var q = 0; q < 5; q++) { ctx.beginPath(); ctx.arc(x - w / 2 + 5 + ((q * 11) % (w - 10)), y + 5 + ((q * 7) % (h - 9)), 2.2, 0, 7); ctx.fill(); } }
    }
    // точки (как на кости): 3×3 сетка внутри тела
    var pw = w - 12, ph = h - 10, pr = P.pixel ? 2 : Math.max(2, Math.min(3, w / 13));
    ctx.fillStyle = rust ? (P.pixel ? '#ffffff' : 'rgba(255,230,210,.75)') : P.pip;
    (PIPS[v] || []).forEach(function (p) {
      var cx = x - pw / 2 + p[0] * pw / 2, cy = y + 5 + p[1] * ph / 2;
      if (P.pixel) ctx.fillRect(px(cx) - 2, px(cy) - 2, 4, 4); else { ctx.beginPath(); ctx.arc(cx, cy, pr, 0, 7); ctx.fill(); }
    });
    ctx.restore();
    return h;
  }
  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, gg = n >> 8 & 255, b = n & 255;
    function f(c) { return Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k))); }
    return 'rgb(' + f(r) + ',' + f(gg) + ',' + f(b) + ')';
  }

  // точка подвеса чаши i при угле a
  function hook(i, a) { var r = L.SIDE[i] * L.DIST[i] * G.STEP; return { x: G.CX + r * Math.cos(a), y: G.BEAM_Y + r * Math.sin(a) }; }
  function panX(i) { return G.CX + L.SIDE[i] * L.DIST[i] * G.STEP; }
  function stackTop(S, i, a) { var h = hook(i, a), y = h.y + G.HANG - 4; S.pans[i].forEach(function (w) { y -= wSize(w.v).h + 2; }); return y; }

  // ---------- фон ----------
  function bg(ctx, g) {
    var P = pal(g), W = G.W, H = G.H;
    if (P.pixel) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#0000aa'; for (var y = 70; y < 560; y += 8) ctx.fillRect(0, y, W, 1);
      ctx.fillStyle = '#555555'; for (var x = 0; x < W; x += 4) for (var yy = 560; yy < 580; yy += 4) if (((x + yy) / 4) % 2) ctx.fillRect(x, yy, 2, 2);
      return;
    }
    var gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, P.bg0); gr.addColorStop(1, P.bg1); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = P.plank; for (var i = 0; i < 9; i++) if (i % 2) ctx.fillRect(i * 50, 60, 50, 500);
    var rg = ctx.createRadialGradient(G.CX, G.BEAM_Y, 10, G.CX, G.BEAM_Y, 260); rg.addColorStop(0, P.glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 556, W, H - 556);
  }

  // ---------- коромысло, опора, чаши ----------
  function scale(ctx, S, g, o) {
    var P = pal(g), a = S.angle, cx = G.CX, by = G.BEAM_Y;
    // опора
    if (P.pixel) {
      ctx.fillStyle = P.post; ctx.fillRect(cx - 8, by + 10, 16, 540 - by); ctx.fillStyle = P.beamDk; ctx.fillRect(cx - 70, 548, 140, 12); ctx.fillStyle = P.post; ctx.fillRect(cx - 50, 540, 100, 8);
      ctx.fillStyle = P.beam; ctx.fillRect(cx - 10, by + 2, 20, 10); ctx.fillRect(cx - 4, by - 2, 8, 4);
    } else {
      var pg = ctx.createLinearGradient(cx - 9, 0, cx + 9, 0); pg.addColorStop(0, P.post); pg.addColorStop(1, P.postDk);
      ctx.fillStyle = pg; ctx.fillRect(cx - 8, by + 8, 16, 540 - by);
      ctx.fillStyle = P.postDk; rr(ctx, cx - 74, 546, 148, 14, 6); ctx.fill(); ctx.fillStyle = P.post; rr(ctx, cx - 52, 536, 104, 14, 6); ctx.fill();
      ctx.fillStyle = P.beamDk; ctx.beginPath(); ctx.moveTo(cx, by - 2); ctx.lineTo(cx + 14, by + 20); ctx.lineTo(cx - 14, by + 20); ctx.closePath(); ctx.fill();
    }
    // чаши и цепи
    for (var i = 0; i < L.PANS; i++) {
      var h = hook(i, a), pyb = h.y + G.HANG, hw = G.PAN_W / 2, hot = o && o.preview === i;
      ctx.strokeStyle = hot ? P.accent : P.chain; ctx.lineWidth = P.pixel ? 2 : 1.4;
      if (P.pixel) { ctx.fillStyle = hot ? P.accent : P.chain; for (var yy = h.y; yy < pyb - 4; yy += 6) { var t = (yy - h.y) / (G.HANG - 4); ctx.fillRect(px(h.x - t * (hw - 2)) - 1, px(yy), 2, 2); ctx.fillRect(px(h.x + t * (hw - 2)) - 1, px(yy), 2, 2); } }
      else { ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x - hw + 2, pyb - 4); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + hw - 2, pyb - 4); ctx.stroke(); }
      if (P.pixel) { ctx.fillStyle = P.pan; ctx.fillRect(px(h.x - hw), px(pyb - 4), G.PAN_W, 6); ctx.fillStyle = P.panDk; ctx.fillRect(px(h.x - hw + 6), px(pyb + 2), G.PAN_W - 12, 4); }
      else {
        ctx.fillStyle = P.panDk; ctx.beginPath(); ctx.ellipse(h.x, pyb - 3, hw, 4, 0, 0, 7); ctx.fill();
        ctx.fillStyle = P.pan; ctx.beginPath(); ctx.moveTo(h.x - hw, pyb - 3); ctx.quadraticCurveTo(h.x, pyb + 14, h.x + hw, pyb - 3); ctx.closePath(); ctx.fill();
      }
      var yb = pyb - 4; S.pans[i].forEach(function (w) { yb -= weight(ctx, h.x, yb, w.v, w.rust, P) + 2; });
    }
    // балка
    ctx.save(); ctx.translate(cx, by); ctx.rotate(a);
    var Lb = 4 * G.STEP + 14;
    if (P.pixel) { ctx.fillStyle = P.beam; ctx.fillRect(-Lb, -4, Lb * 2, 8); ctx.fillStyle = P.beamDk; ctx.fillRect(-Lb, 2, Lb * 2, 2); for (var d = 1; d <= 4; d++) { ctx.fillStyle = '#000'; ctx.fillRect(d * G.STEP - 2, -2, 4, 4); ctx.fillRect(-d * G.STEP - 2, -2, 4, 4); } }
    else {
      var bgr = ctx.createLinearGradient(0, -6, 0, 6); bgr.addColorStop(0, shade(P.beam, 0.25)); bgr.addColorStop(1, P.beamDk);
      ctx.fillStyle = bgr; rr(ctx, -Lb, -6, Lb * 2, 12, 6); ctx.fill();
      ctx.fillStyle = P.beamDk; for (var dd = 1; dd <= 4; dd++) { ctx.beginPath(); ctx.arc(dd * G.STEP, 0, 3, 0, 7); ctx.arc(-dd * G.STEP, 0, 3, 0, 7); ctx.fill(); }
      ctx.fillStyle = shade(P.beam, 0.3); ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill();
    }
    // указатель-язычок над опорой
    ctx.fillStyle = P.pixel ? P.ink : P.ink; if (P.pixel) ctx.fillRect(-2, -26, 4, 20); else { ctx.beginPath(); ctx.moveTo(-3, -6); ctx.lineTo(0, -30); ctx.lineTo(3, -6); ctx.fill(); }
    ctx.restore();
  }

  // ---------- кран с текущей гирькой, фитиль, призрак ----------
  function crane(ctx, S, g, o) {
    var P = pal(g), i = o.preview != null && o.preview >= 0 ? o.preview : S.cursor, x = panX(i), ry = 98;
    if (P.pixel) { ctx.fillStyle = P.post; ctx.fillRect(10, ry - 2, G.W - 20, 4); } else { ctx.fillStyle = 'rgba(255,255,255,.08)'; rr(ctx, 12, ry - 2, G.W - 24, 4, 2); ctx.fill(); }
    if (S.phase !== 'aim' || !S.cur) return;
    // каретка + тросик
    ctx.fillStyle = P.chain; if (P.pixel) { ctx.fillRect(px(x) - 8, ry - 4, 16, 8); ctx.fillRect(px(x) - 1, ry, 2, 22); } else { rr(ctx, x - 9, ry - 5, 18, 10, 3); ctx.fill(); ctx.fillRect(x - 0.75, ry, 1.5, 24); }
    var v = S.cur.v, sz = wSize(v), yb = G.CUR_Y + sz.h / 2 + 6, ok = S.pans[i].length < L.CAP;
    // направляющая к чаше и призрак
    var top = stackTop(S, i, S.angle);
    ctx.save();
    if (P.pixel) { ctx.fillStyle = ok ? P.muted : P.bad; for (var y = yb + 6; y < top - sz.h; y += 8) ctx.fillRect(px(x) - 1, px(y), 2, 4); }
    else { ctx.strokeStyle = ok ? 'rgba(255,255,255,.22)' : P.bad; ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, yb + 6); ctx.lineTo(x, top - sz.h - 4); ctx.stroke(); }
    ctx.restore();
    if (ok) weight(ctx, x, top, v, false, P, P.pixel ? 0.35 : 0.3);
    else { ctx.strokeStyle = P.bad; ctx.lineWidth = 3; var hx = hook(i, S.angle); ctx.beginPath(); ctx.moveTo(hx.x - 9, hx.y + 40); ctx.lineTo(hx.x + 9, hx.y + 58); ctx.moveTo(hx.x + 9, hx.y + 40); ctx.lineTo(hx.x - 9, hx.y + 58); ctx.stroke(); }
    weight(ctx, x, yb, v, false, P);
    // фитиль: кольцо вокруг гирьки
    if (S.fuseMax > 0) {
      var f = Math.max(0, S.fuse / S.fuseMax), late = S.fuse < 2, rad = Math.max(sz.w, sz.h) / 2 + 10, cy = yb - sz.h / 2;
      ctx.strokeStyle = P.pixel ? '#555555' : 'rgba(255,255,255,.12)'; ctx.lineWidth = P.pixel ? 4 : 3;
      ctx.beginPath(); ctx.arc(x, cy, rad, 0, 7); ctx.stroke();
      ctx.strokeStyle = late ? P.bad : P.accent; if (late && Math.floor(S.time * 8) % 2 && !P.pixel) ctx.strokeStyle = P.warn;
      ctx.beginPath(); ctx.arc(x, cy, rad, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
    }
  }
  function falls(ctx, S, g) {
    var P = pal(g);
    S.falls.forEach(function (f) {
      if (f.t < 0) return;
      var k = Math.min(1, f.t / f.dur), x = panX(f.pan), top = stackTop(S, f.pan, S.angle), y0 = f.player ? G.CUR_Y + wSize(f.w.v).h / 2 + 6 : f.from;
      weight(ctx, x, y0 + (top - y0) * k * k, f.w.v, f.w.rust, P);
    });
  }

  // ---------- стрелка-манометр ----------
  function gauge(ctx, S, g, o) {
    var P = pal(g), cx = G.CX, cy = 708, R = 78, lim = (o && o.limit) || L.LIMIT, MAXT = 16;
    function ang(T) { return -Math.PI / 2 + Math.max(-1, Math.min(1, T / MAXT)) * (Math.PI / 2 - 0.08); }
    function arc(t0, t1, col) { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, R, ang(t0), ang(t1)); ctx.stroke(); }
    ctx.save(); ctx.lineWidth = P.pixel ? 10 : 12; ctx.lineCap = P.pixel ? 'butt' : 'round';
    arc(-MAXT, -lim, P.bad); arc(lim, MAXT, P.bad); arc(-lim, -lim / 2, P.warn); arc(lim / 2, lim, P.warn); arc(-lim / 2, lim / 2, P.good);
    ctx.restore();
    // предпросмотр: куда уйдёт стрелка, если бросить сюда
    if (o && o.preview != null && o.preview >= 0 && S.cur && S.phase === 'aim' && S.pans[o.preview].length < L.CAP) {
      var Tp = S.torque + L.SIDE[o.preview] * L.DIST[o.preview] * S.cur.v, ap = ang(Tp);
      ctx.save(); ctx.strokeStyle = Math.abs(Tp) > lim ? P.bad : P.ink; ctx.globalAlpha = 0.45; ctx.lineWidth = 3; if (!P.pixel) ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ap) * (R - 14), cy + Math.sin(ap) * (R - 14)); ctx.stroke(); ctx.restore();
    }
    var T = S.angle / G.MAXANG * L.LIMIT, a = ang(T), over = Math.abs(S.torque) > lim * 0.7;
    ctx.strokeStyle = over && Math.floor(S.time * 6) % 2 ? P.bad : P.ink; ctx.lineWidth = P.pixel ? 4 : 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8)); ctx.stroke();
    ctx.fillStyle = P.accent; if (P.pixel) ctx.fillRect(cx - 6, cy - 6, 12, 12); else { ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 7); ctx.fill(); }
    // маленькие чаши по краям шкалы — «левая / правая сторона»
    [-1, 1].forEach(function (sd) { var x = cx + sd * (R + 24), y = cy - 4;
      if (P.pixel) { ctx.fillStyle = P.pan; ctx.fillRect(x - 12, y, 24, 4); ctx.fillStyle = P.chain; ctx.fillRect(x - 1, y - 14, 2, 14); }
      else { ctx.strokeStyle = P.chain; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y - 16); ctx.lineTo(x - 11, y); ctx.moveTo(x, y - 16); ctx.lineTo(x + 11, y); ctx.stroke();
        ctx.fillStyle = P.pan; ctx.beginPath(); ctx.moveTo(x - 13, y); ctx.quadraticCurveTo(x, y + 12, x + 13, y); ctx.closePath(); ctx.fill(); } });
  }

  // ---------- HUD ----------
  function hud(ctx, S, g, o) {
    var P = pal(g), W = G.W;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, 56); ctx.fillStyle = P.line; ctx.fillRect(0, 55, W, P.pixel ? 2 : 1);
    var up = function (s) { return P.pixel ? String(s).toUpperCase() : s; };
    g.text(up(g.t('level')) + ' ' + S.level, 14, 24, { size: 14, color: P.ink, weight: 800, maxWidth: 130 });
    for (var k = 0; k < L.PER_LEVEL; k++) { ctx.fillStyle = k < S.lvlClears ? P.accent : (P.pixel ? '#555555' : 'rgba(255,255,255,.14)'); if (P.pixel) ctx.fillRect(14 + k * 18, 34, 14, 8); else { rr(ctx, 14 + k * 18, 34, 14, 7, 3.5); ctx.fill(); } }
    if (o.daily) g.text(up(g.t('dayTag')), 14 + L.PER_LEVEL * 18 + 6, 42, { size: 10, color: P.warn, weight: 800, maxWidth: 70 });
    g.text(String(S.score), W / 2, 36, { size: 24, align: 'center', color: P.accent, weight: 900 });
    for (var i = 0; i < L.MAX_LIVES; i++) {
      var x = W - 24 - i * 26, on = i < S.lives;
      if (P.pixel) { ctx.fillStyle = on ? P.bad : '#555555'; ctx.fillRect(x - 8, 20, 16, 14); ctx.fillRect(x - 4, 16, 8, 4); }
      else { ctx.fillStyle = on ? P.bad : 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.arc(x, 28, 8, 0, 7); ctx.fill(); ctx.strokeStyle = on ? P.bad : 'rgba(255,255,255,.14)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, 19, 4, Math.PI, 0); ctx.stroke(); }
    }
    // следующая гирька — в HUD между счётом и жизнями (под кареткой крана справа её не перекрыть)
    if (S.next) { weight(ctx, 312, 50, S.next.v, false, P);
      ctx.fillStyle = P.muted; if (P.pixel) { ctx.fillRect(278, 30, 8, 2); ctx.fillRect(282, 28, 2, 6); } else { ctx.beginPath(); ctx.moveTo(278, 25); ctx.lineTo(286, 31); ctx.lineTo(278, 37); ctx.fill(); } }
  }

  // ---------- рука-подсказка (обучение) ----------
  function hand(ctx, S, g, i, tutText) {
    var P = pal(g), h = hook(i, S.angle), x = h.x, y = h.y + G.HANG - 40 + Math.sin(S.time * 6) * 6;
    ctx.save(); ctx.translate(x + 10, y);
    if (P.pixel) { ctx.fillStyle = '#ffffff'; ctx.fillRect(-4, -16, 8, 20); ctx.fillRect(-4, 4, 20, 16); ctx.fillStyle = '#000'; ctx.fillRect(-2, -14, 4, 4); }
    else { ctx.fillStyle = '#fff5e8'; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2; rr(ctx, -5, -18, 10, 24, 5); ctx.fill(); ctx.stroke(); rr(ctx, -6, 2, 24, 20, 7); ctx.fill(); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(S.time * 6); ctx.strokeStyle = P.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, h.y + G.HANG - 10, 26, 0, 7); ctx.stroke(); ctx.restore();
    if (tutText) g.text(tutText, G.W / 2, 590, { size: 14, align: 'center', color: P.ink, weight: 700, maxWidth: G.W - 30, minSize: 10 });
  }

  function effects(ctx, g, o) {
    var P = pal(g);
    (o.fx || []).forEach(function (f) {   // падающие при перевесе гирьки
      if (f.kind === 'fallw') { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); weight(ctx, 0, 0, f.v, f.rust, P, Math.min(1, f.t)); ctx.restore(); }
      else if (f.kind === 'ring') { ctx.save(); ctx.globalAlpha = Math.max(0, f.t / f.life); ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.6 - f.t / f.life), 0, 7); ctx.stroke(); ctx.restore(); }
      else if (f.kind === 'flash') { ctx.save(); ctx.globalAlpha = Math.max(0, f.t / f.life) * 0.35; ctx.fillStyle = f.color; ctx.fillRect(0, 0, G.W, G.H); ctx.restore(); }
    });
    (o.toasts || []).forEach(function (t) {
      ctx.save(); ctx.globalAlpha = Math.min(1, t.t * 2);
      g.text(t.text, t.x, t.y - (1.4 - t.t) * 30, { size: t.size || 18, align: 'center', color: t.color || P.accent, weight: 900, maxWidth: G.W - 20, minSize: 10 });
      ctx.restore();
    });
  }

  function draw(ctx, S, g, o) {
    o = o || {};
    bg(ctx, g);
    scale(ctx, S, g, o);
    falls(ctx, S, g);
    if (!o.bare) { crane(ctx, S, g, o); gauge(ctx, S, g, o); hud(ctx, S, g, o); }
    if (!o.bare && S.tut >= 0 && S.hint >= 0 && S.phase === 'aim') hand(ctx, S, g, S.hint, o.tutText);
    effects(ctx, g, o);
  }

  K.render = { draw: draw, bg: bg, weight: weight, hook: hook, panX: panX, stackTop: stackTop, wSize: wSize, pal: pal, PAL: PAL, rr: rr };
})(typeof window !== 'undefined' ? window : globalThis);
