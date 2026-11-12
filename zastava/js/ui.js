/* ЗАСТАВА · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема, кнопка паузы)
   и общие для обеих тем элементы на канве — HUD, баннеры волн, всплывающие очки.
   Палитру P передаёт активный рендерер (modern/classic), тексты — только через g.t(). ZASTAVA.ui */
(function (global) {
  'use strict';
  var Z = global.ZASTAVA = global.ZASTAVA || {};
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, wrap = c.parentElement;
    var pad = document.querySelector('.pad'), padH = pad && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 20 : 0;
    var availH = innerHeight - padH - 64;
    var w = Math.min(480, (wrap && wrap.clientWidth) || g.W, availH * g.W / g.H);
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
      var pb = $('bPause'); if (pb) pb.title = g.t('pause');
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

  function hud(g, ctx, S, P, lifeIcon) {
    var W = g.W, Hh = 44;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, Hh);
    ctx.fillStyle = P.hudLine; ctx.fillRect(0, Hh - 2, W, 2);
    txt(g, up(P, g.t('wave')) + ' ' + S.wave + '/' + S.maxWave, 14, 19, { size: 14, color: P.ink }, P);
    txt(g, up(P, g.t('wv_' + S.name)), 14, 36, { size: 11, color: P.muted, weight: 700 }, P);
    var B = S.boss;
    txt(g, String(S.score), W / 2, B ? 20 : 28, { size: B ? 16 : 20, align: 'center', color: P.accent }, P);
    if (B) {   // полоса ядра матки
      var bw = 150, bx = W / 2 - bw / 2, by = 25, f = Math.max(0, B.hp / B.max);
      ctx.fillStyle = P.bar; if (P.pixel) ctx.fillRect(bx, by, bw, 6); else { roundRect(ctx, bx, by, bw, 6, 3); ctx.fill(); }
      if (f > 0) { ctx.fillStyle = P.bossBar; if (P.pixel) ctx.fillRect(bx, by, Math.round(bw * f / 2) * 2, 6); else { roundRect(ctx, bx, by, Math.max(6, bw * f), 6, 3); ctx.fill(); } }
      txt(g, up(P, g.t('core')), W / 2, 39, { size: 8, align: 'center', color: P.muted, weight: 700 }, P);
    }
    var n = Math.max(3, S.lives);
    for (var i = 0; i < n; i++) lifeIcon(ctx, W - 30 - i * 28, 22, i < S.lives);
  }

  function panel(g, ctx, x, y, w, h, col, P) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = col; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3); ctx.fillRect(x, y, 3, h); ctx.fillRect(x + w - 3, y, 3, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 22;
      ctx.fillStyle = P.panel; roundRect(ctx, x, y, w, h, 14); ctx.fill(); ctx.restore();
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 14); ctx.stroke();
    }
  }

  function banner(g, ctx, S, P) {
    var title = null, sub = null, col = P.ink;
    if (S.phase === 'intro') {
      title = up(P, g.t('wave')) + ' ' + S.wave + ' · ' + up(P, g.t('wv_' + S.name));
      sub = g.t('sub_' + S.kind); col = P.accent;
    } else if (S.phase === 'clear') { title = g.t('clear'); sub = g.t('bonus') + ' +' + S.clearBonus; col = P.good; }
    else if (S.phase === 'dead' && S.lives > 0) { title = g.t('lost'); sub = g.t('lives') + ': ' + S.lives; col = P.bad; }
    if (!title) return;
    var w = 404, h = 74, x = (g.W - w) / 2, y = 330;
    panel(g, ctx, x, y, w, h, col, P);
    txt(g, up(P, title), g.W / 2, y + 32, { size: P.pixel ? 17 : 20, align: 'center', color: col }, P);
    txt(g, up(P, sub), g.W / 2, y + 55, { size: P.pixel ? 9 : 12, align: 'center', color: P.muted, weight: 600 }, P);
  }

  // Всплывающие подписи (очки зонда, +1 лафет)
  function toasts(g, ctx, list, P) {
    for (var i = 0; i < list.length; i++) {
      var o = list[i], a = Math.min(1, o.t / 0.4);
      ctx.globalAlpha = a;
      txt(g, up(P, o.text), o.x, o.y - (1.4 - o.t) * 26, { size: P.pixel ? 12 : 14, align: 'center', color: o.color, weight: 900 }, P);
    }
    ctx.globalAlpha = 1;
  }

  Z.ui = {
    init: function (g) {
      fit(g); addEventListener('resize', function () { fit(g); });
      sync(g); setInterval(function () { sync(g); }, 250);
      var pb = $('bPause');
      if (pb) {
        var onPause = function (e) {
          e.preventDefault(); e.stopPropagation();
          if (g._sceneName === 'play') g.pause();
          else if (g._sceneName === 'pause') g.goto('play', { resume: true });
        };
        pb.addEventListener('touchstart', onPause, { passive: false }); pb.addEventListener('click', onPause);
      }
    },
    fit: fit, sync: sync, roundRect: roundRect, txt: txt, up: up, hud: hud, panel: panel, banner: banner, toasts: toasts
  };
})(typeof window !== 'undefined' ? window : globalThis);
