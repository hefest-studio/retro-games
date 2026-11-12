/* ПЕРЕПРАВА · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема, кнопка паузы)
   и общие для обеих тем элементы на канве — HUD, полоса таймера, баннеры, всплывашки.
   Палитру P передаёт активный рендерер (modern/classic), тексты — только через g.t(). PEREPRAVA.ui */
(function (global) {
  'use strict';
  var K = global.PEREPRAVA = global.PEREPRAVA || {};
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, wrap = c.parentElement;
    var pad = document.querySelector('.pad'), padH = pad && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 20 : 0;
    var availH = innerHeight - padH - 64;
    var w = Math.min(480, (wrap && wrap.clientWidth) || g.W, availH * g.W / g.H);
    w = Math.max(220, Math.floor(w));
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
  function box(ctx, P, x, y, w, h, col, r) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = col; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3); ctx.fillRect(x, y, 3, h); ctx.fillRect(x + w - 3, y, 3, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 22;
      ctx.fillStyle = P.panel; roundRect(ctx, x, y, w, h, r || 14); ctx.fill(); ctx.restore();
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, r || 14); ctx.stroke();
    }
  }

  function hud(g, ctx, S, P, lifeIcon) {
    var W = g.W, Hh = 44;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, Hh);
    ctx.fillStyle = P.hudLine; ctx.fillRect(0, Hh - 2, W, 2);
    txt(g, up(P, g.t('level')) + ' ' + S.level + '/' + S.maxLevel, 14, 19, { size: 14, color: P.ink }, P);
    txt(g, up(P, g.t('lv_' + S.level, '')), 14, 36, { size: 11, color: P.muted, weight: 700 }, P);
    txt(g, String(S.score), W / 2, 28, { size: 20, align: 'center', color: P.accent }, P);
    var n = Math.max(3, S.lives);
    for (var i = 0; i < n; i++) lifeIcon(ctx, W - 24 - i * 24, 22, i < S.lives);
  }

  // Нижняя панель: полоса таймера переправы и ячейки-счётчик
  function footer(g, ctx, S, P) {
    var W = g.W, y0 = K.logic.TOP + K.logic.ROWS * K.logic.RH, h = g.H - y0;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, y0, W, h);
    ctx.fillStyle = P.hudLine; ctx.fillRect(0, y0, W, 2);
    var f = S.cfg ? Math.max(0, Math.min(1, S.timer / S.cfg.time)) : 1;
    var col = f > 0.5 ? P.good : f > 0.25 ? P.warn : P.bad;
    var bx = 96, bw = W - 96 - 120, by = y0 + 26, bh = 12;
    txt(g, up(P, g.t('time')), 14, by + 10, { size: 12, color: P.muted, weight: 700 }, P);
    ctx.fillStyle = P.bar;
    if (P.pixel) ctx.fillRect(bx, by, bw, bh); else { roundRect(ctx, bx, by, bw, bh, 6); ctx.fill(); }
    if (f > 0) {
      ctx.fillStyle = col;
      if (P.pixel) ctx.fillRect(bx, by, Math.round(bw * f / 4) * 4, bh);
      else { roundRect(ctx, bx, by, Math.max(bh, bw * f), bh, 6); ctx.fill(); }
    }
    txt(g, String(Math.ceil(S.timer)), bx + bw + 10, by + 11, { size: 13, color: col, weight: 800 }, P);
    // заполненные ячейки — пять точек
    for (var i = 0; i < 5; i++) {
      var on = S.bays[i] && S.bays[i].filled, cx = W - 66 + i * 12, cy = by + 6;
      ctx.fillStyle = on ? P.accent : P.bar;
      if (P.pixel) ctx.fillRect(cx - 4, cy - 4, 8, 8); else { ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.fill(); }
    }
    if (g.state.best) txt(g, up(P, g.t('best')) + ' ' + g.state.best, W / 2, g.H - 10, { size: 10, align: 'center', color: P.muted, weight: 600 }, P);
  }

  function banner(g, ctx, S, P) {
    var title = null, sub = null, col = P.ink, a = 1;
    if (S.phase === 'play' && S.banner > 0) {
      title = up(P, g.t('ready')) + ' ' + S.level + ' · ' + up(P, g.t('lv_' + S.level, '')); sub = g.t('readySub'); col = P.accent;
      a = Math.min(1, S.banner / 0.4);
    } else if (S.phase === 'clear') { title = g.t('clear'); sub = g.t('bonus') + ' +' + K.logic.PTS.clear; col = P.good; }
    else if (S.phase === 'dead' && S.death) { title = g.t('lost'); sub = g.t('d_' + S.death.reason, '') + ' · ' + g.t('lives') + ': ' + S.lives; col = P.bad; }
    if (!title) return;
    var w = 380, h = 74, x = (g.W - w) / 2, y = K.logic.rowY(K.logic.MEDIAN) + K.logic.RH / 2 - h / 2;
    ctx.globalAlpha = a;
    box(ctx, P, x, y, w, h, col);
    txt(g, up(P, title), g.W / 2, y + 32, { size: P.pixel ? 17 : 20, align: 'center', color: col }, P);
    txt(g, up(P, sub), g.W / 2, y + 55, { size: P.pixel ? 10 : 12, align: 'center', color: P.muted, weight: 600 }, P);
    ctx.globalAlpha = 1;
  }

  function toasts(g, ctx, list, P) {
    for (var i = 0; i < list.length; i++) {
      var o = list[i], a = Math.min(1, o.t / 0.4);
      ctx.globalAlpha = a;
      if (!P.pixel) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 6; }
      txt(g, up(P, o.text), o.x, o.y - (1.4 - o.t) * 26, { size: P.pixel ? 12 : 13, align: 'center', color: o.color, weight: 900 }, P);
      if (!P.pixel) ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  K.ui = {
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
    fit: fit, sync: sync, roundRect: roundRect, txt: txt, up: up, box: box, hud: hud, footer: footer, banner: banner, toasts: toasts
  };
})(typeof window !== 'undefined' ? window : globalThis);
