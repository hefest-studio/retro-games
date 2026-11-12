/* РАЗРЕЗ · HUD и баннеры на канве. Палитру P передаёт активный рендерер
   (modern/classic), тексты — только через g.t(). RAZREZ.ui */
(function (global) {
  'use strict';
  var R = global.RAZREZ = global.RAZREZ || {};

  var HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];

  function heart(ctx, x, y, color, P) {
    if (P.pixel) {
      ctx.fillStyle = color;
      for (var r = 0; r < HEART.length; r++) for (var c = 0; c < 7; c++) if (HEART[r][c] === '#') ctx.fillRect(x + c * 2, y + r * 2, 2, 2);
      return;
    }
    ctx.fillStyle = color; ctx.beginPath();
    var s = 14, cx = x + 7, cy = y + 4;
    ctx.moveTo(cx, cy + 9);
    ctx.bezierCurveTo(cx - 9, cy + 3, cx - 6, cy - 5, cx, cy - 1);
    ctx.bezierCurveTo(cx + 6, cy - 5, cx + 9, cy + 3, cx, cy + 9);
    ctx.fill(); void s;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function txt(g, s, x, y, o, P) { o = o || {}; if (P.font) o.font = P.font; g.text(s, x, y, o); }

  R.ui = {
    roundRect: roundRect,
    hud: function (g, ctx, st, P, L) {
      var W = L.W, H = 44;
      ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = P.hudLine; ctx.fillRect(0, H - 2, W, 2);
      var up = P.pixel ? function (s) { return String(s).toUpperCase(); } : String;
      // уровень
      txt(g, up(g.t('level')) + ' ' + st.level + '/' + st.maxLevel, 16, 28, { size: 16, color: P.ink }, P);
      // полоса захвата с меткой цели
      var bx = 150, bw = 260, by = 16, bh = 12, f = Math.min(1, st.pct / 100);
      txt(g, up(g.t('captured')), bx - 10, 27, { size: 12, align: 'right', color: P.muted, weight: 700 }, P);
      if (P.pixel) { ctx.fillStyle = P.bar; ctx.fillRect(bx, by, bw, bh); ctx.fillStyle = P.barFill; ctx.fillRect(bx, by, Math.round(bw * f / 2) * 2, bh); }
      else {
        ctx.fillStyle = P.bar; roundRect(ctx, bx, by, bw, bh, 6); ctx.fill();
        if (f > 0) { ctx.fillStyle = P.barFill; roundRect(ctx, bx, by, Math.max(bh, bw * f), bh, 6); ctx.fill(); }
      }
      var tx = bx + Math.round(bw * st.target / 100);
      ctx.fillStyle = P.target; ctx.fillRect(tx - 1, by - 4, 2, bh + 8);
      var pctCol = st.pct >= st.target ? P.good : P.ink;
      txt(g, Math.floor(st.pct) + '%', bx + bw + 12, 28, { size: 16, color: pctCol }, P);
      txt(g, '/ ' + st.target + '%', bx + bw + 58, 28, { size: 12, color: P.muted, weight: 700 }, P);
      // счёт
      txt(g, up(g.t('score')), 560, 27, { size: 12, color: P.muted, weight: 700 }, P);
      txt(g, String(st.score), 610, 28, { size: 16, color: P.accent }, P);
      // жизни
      for (var i = 0, nh = Math.max(3, st.lives); i < nh; i++) heart(ctx, W - 26 - i * 22, 15, i < st.lives ? P.heart : P.heartOff, P);
    },
    banner: function (g, ctx, st, P, L) {
      var title = null, sub = null, col = P.ink;
      if (st.phase === 'ready') { title = g.t('ready') + ' ' + st.level; sub = g.t('readySub'); col = P.accent; }
      else if (st.phase === 'clear') { title = g.t('clear'); sub = g.t('bonus') + ' +' + st.clearBonus; col = P.good; }
      else if (st.phase === 'dead') { title = g.t('lost'); sub = g.t('lives') + ': ' + st.lives; col = P.bad; }
      if (!title) return;
      var w = 440, h = 104, x = (L.W - w) / 2, y = L.OY + (L.ROWS * L.CELL - h) / 2;
      if (P.pixel) {
        ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = col; ctx.fillRect(x, y, w, 4); ctx.fillRect(x, y + h - 4, w, 4); ctx.fillRect(x, y, 4, h); ctx.fillRect(x + w - 4, y, 4, h);
        title = title.toUpperCase(); sub = sub.toUpperCase();
      } else {
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 24;
        ctx.fillStyle = P.panel; roundRect(ctx, x, y, w, h, 16); ctx.fill(); ctx.restore();
        ctx.strokeStyle = col; ctx.lineWidth = 2; roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 15); ctx.stroke();
      }
      txt(g, title, L.W / 2, y + 48, { size: 28, align: 'center', color: col }, P);
      txt(g, sub, L.W / 2, y + 78, { size: P.pixel ? 12 : 14, align: 'center', color: P.muted, weight: 600 }, P);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
