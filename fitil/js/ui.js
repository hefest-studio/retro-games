/* ФИТИЛЬ · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема, кнопки паузы и РЕЛЕ)
   и общие для обеих тем элементы на канве — HUD, баннеры, всплывашки.
   Палитру P и значки бонусов передаёт активный рендерер (modern/classic), тексты — только через g.t(). FITIL.ui */
(function (global) {
  'use strict';
  var F = global.FITIL = global.FITIL || {};
  var T = 40, OY = 48;   // клетка поля и высота HUD
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, wrap = c.parentElement;
    var pad = document.querySelector('.pad'), padH = pad && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 20 : 0;
    var availH = innerHeight - padH - 70;
    var w = Math.min(g.W, (wrap && wrap.clientWidth) || g.W, availH * g.W / g.H);
    w = Math.max(240, Math.floor(w));
    c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
  }
  var lastLang = null, lastTheme = null;
  function sync(g) {
    var lang = g.i18n.lang, theme = g.themeName;
    if (lang !== lastLang) {
      lastLang = lang; document.documentElement.lang = lang;
      var b = $('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = $('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
    }
    if (theme !== lastTheme) { lastTheme = theme; document.body.setAttribute('data-theme', theme); }
  }

  // ---------- Рисование ----------
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function txt(g, s, x, y, o, P) { o = o || {}; if (P.font) o.font = P.font; g.text(s, x, y, o); }
  function up(P, s) { return P.pixel ? String(s).toUpperCase() : String(s); }
  function panel(ctx, x, y, w, h, P, edge) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = edge || P.accent; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3); ctx.fillRect(x, y, 3, h); ctx.fillRect(x + w - 3, y, 3, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 22;
      ctx.fillStyle = P.panel; roundRect(ctx, x, y, w, h, 14); ctx.fill(); ctx.restore();
      ctx.strokeStyle = edge || P.line; ctx.lineWidth = 1.5; roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 14); ctx.stroke();
    }
  }

  // Блок игрока в HUD: значок, жизни, сила (бомбы/пламя/прыть + ТОЛЧОК/РЕЛЕ)
  function playerBlock(g, ctx, p, x, right, R) {
    var P = R.P, col = P.pl[p.i], dir = right ? -1 : 1, cx = right ? x - 14 : x + 14;
    ctx.globalAlpha = p.out ? 0.35 : 1;
    R.face(ctx, cx, 17, p.i, 0.55);
    txt(g, up(P, g.t(p.i ? 'p2' : 'p1')), cx, 41, { size: 10, align: 'center', color: col, weight: 800 }, P);
    var lx = cx + dir * 24;
    txt(g, p.out ? up(P, g.t('out')) : '×' + Math.max(0, p.lives), lx, 22, { size: 15, align: right ? 'right' : 'left', color: P.ink, weight: 800 }, P);
    var stats = [['bomb', p.bombs], ['flame', p.flame], ['speed', p.speed + 1]];
    if (p.kick) stats.push(['kick', 0]); if (p.relay) stats.push(['relay', 0]);
    for (var i = 0; i < stats.length; i++) {
      var sx = lx + dir * (i * 30 + (right ? 8 : 6));
      R.glyph(ctx, stats[i][0], sx, 36, 0.45);
      if (stats[i][1]) txt(g, String(stats[i][1]), sx + 8, 41, { size: 10, color: P.muted, weight: 800 }, P);
    }
    ctx.globalAlpha = 1;
  }
  function hud(g, ctx, S, R) {
    var P = R.P, W = g.W;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, OY);
    ctx.fillStyle = P.hudLine; ctx.fillRect(0, OY - 2, W, 2);
    txt(g, String(S.score), W / 2, 22, { size: 20, align: 'center', color: P.accent, weight: 900 }, P);
    var B = S.boss;
    if (B && B.alive) {
      var bw = 140, bx = W / 2 - bw / 2, by = 30, f = Math.max(0, B.hp / B.max);
      ctx.fillStyle = P.bar; if (P.pixel) ctx.fillRect(bx, by, bw, 8); else { roundRect(ctx, bx, by, bw, 8, 4); ctx.fill(); }
      if (f > 0) { ctx.fillStyle = P.bossBar; if (P.pixel) ctx.fillRect(bx, by, Math.round(bw * f / 4) * 4, 8); else { roundRect(ctx, bx, by, Math.max(8, bw * f), 8, 4); ctx.fill(); } }
      txt(g, up(P, g.t('mill')), W / 2, by + 17, { size: 8, align: 'center', color: P.muted, weight: 700 }, P);
    } else {
      txt(g, up(P, g.t('level')) + ' ' + S.level + '/' + S.maxLevel + ' · ' + up(P, g.t('lv_' + S.name)), W / 2, 40, { size: 11, align: 'center', color: P.muted, weight: 700 }, P);
    }
    playerBlock(g, ctx, S.players[0], 6, false, R);
    if (S.players[1]) playerBlock(g, ctx, S.players[1], W - 6, true, R);
  }

  function banner(g, ctx, S, R) {
    var P = R.P, title = null, sub = null, col = P.ink;
    if (S.phase === 'ready' || (S.phase === 'play' && S.banner > 0)) {
      title = up(P, g.t('ready')) + ' ' + S.level + ' · ' + up(P, g.t('lv_' + S.name));
      sub = S.boss ? g.t('bossGoal') : g.t('goal'); col = P.accent;
    } else if (S.phase === 'clear') { title = g.t('clear'); sub = g.t('bonus') + ' +' + S.clearBonus; col = P.good; }
    if (!title) return;
    var w = 420, h = 78, x = (g.W - w) / 2, y = OY + 6 * T - 4;
    panel(ctx, x, y, w, h, P, col);
    txt(g, up(P, title), g.W / 2, y + 34, { size: P.pixel ? 18 : 20, align: 'center', color: col, weight: 900 }, P);
    txt(g, up(P, sub), g.W / 2, y + 58, { size: P.pixel ? 10 : 12, align: 'center', color: P.muted, weight: 600 }, P);
  }

  // Всплывающие подписи (бонус, «люк открыт», +жизнь)
  function toasts(g, ctx, list, P) {
    for (var i = 0; i < list.length; i++) {
      var o = list[i], a = Math.min(1, o.t / 0.4);
      ctx.globalAlpha = a;
      txt(g, up(P, o.text), o.x, o.y - (1.4 - o.t) * 26, { size: P.pixel ? 12 : 13, align: 'center', color: o.color, weight: 900 }, P);
    }
    ctx.globalAlpha = 1;
  }

  F.ui = {
    T: T, OY: OY,
    init: function (g, onDet) {
      fit(g); addEventListener('resize', function () { fit(g); });
      sync(g); setInterval(function () { sync(g); }, 250);
      var det = document.querySelector('[data-det]');
      if (det) {
        var h = function (e) { e.preventDefault(); e.stopPropagation(); onDet(); };
        det.addEventListener('touchstart', h, { passive: false }); det.addEventListener('mousedown', h);
      }
    },
    fit: fit, sync: sync, roundRect: roundRect, txt: txt, up: up, panel: panel, hud: hud, banner: banner, toasts: toasts
  };
})(typeof window !== 'undefined' ? window : globalThis);
