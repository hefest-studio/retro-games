/* КЛАДКА · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема, кнопка паузы)
   и общие для обеих тем элементы на канве — HUD, плашки бонусов, баннеры, всплывашки.
   Палитру P передаёт активный рендерер (modern/classic), тексты — только через g.t(). KLADKA.ui */
(function (global) {
  'use strict';
  var K = global.KLADKA = global.KLADKA || {};
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

  // Мини-мастерок — значок жизни
  function lifeIcon(ctx, x, y, P, on) {
    ctx.fillStyle = on ? P.life : P.lifeOff;
    if (P.pixel) { ctx.fillRect(x, y, 16, 4); ctx.fillRect(x + 6, y + 4, 4, 3); return; }
    roundRect(ctx, x, y, 18, 5, 2.5); ctx.fill(); ctx.fillRect(x + 7, y + 5, 4, 3);
  }

  function hud(g, ctx, S, P) {
    var W = g.W, Hh = 44;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, Hh);
    ctx.fillStyle = P.hudLine; ctx.fillRect(0, Hh - 2, W, 2);
    txt(g, up(P, g.t('level')) + ' ' + S.level + '/' + S.maxLevel, 14, 19, { size: 14, color: P.ink }, P);
    txt(g, up(P, g.t('lv_' + S.name)), 14, 36, { size: 11, color: P.muted, weight: 700 }, P);
    txt(g, String(S.score), W / 2, S.boss ? 20 : 28, { size: S.boss ? 16 : 20, align: 'center', color: P.accent }, P);
    if (S.boss) {   // полоса «сердца печи»
      var B = S.boss, bw = 150, bx = W / 2 - bw / 2, by = 27, f = Math.max(0, B.hp / B.max);
      ctx.fillStyle = P.bar; if (P.pixel) ctx.fillRect(bx, by, bw, 8); else { roundRect(ctx, bx, by, bw, 8, 4); ctx.fill(); }
      if (f > 0) { ctx.fillStyle = P.bossBar; if (P.pixel) ctx.fillRect(bx, by, Math.round(bw * f / 2) * 2, 8); else { roundRect(ctx, bx, by, Math.max(8, bw * f), 8, 4); ctx.fill(); } }
      txt(g, up(P, g.t('heart')), W / 2, 42, { size: 8, align: 'center', color: P.muted, weight: 700 }, P);
    }
    var n = Math.max(3, S.lives);
    for (var i = 0; i < n; i++) lifeIcon(ctx, W - 32 - i * 24, 18, P, i < S.lives);
  }

  // Плашки активных бонусов внизу, под мастерком
  var TIMED = ['wide', 'narrow', 'glue', 'cutter', 'chill'];
  function powers(g, ctx, S, P, glyph) {
    var act = TIMED.filter(function (k) { return S.pow[k] > 0; });
    if (!act.length) return;
    var cw = 74, gap = 6, x0 = g.W / 2 - (act.length * cw + (act.length - 1) * gap) / 2, y = 616;
    for (var i = 0; i < act.length; i++) {
      var k = act[i], x = x0 + i * (cw + gap), f = S.pow[k] / K.logic.POWERS[k].t, col = P.pw[k];
      ctx.fillStyle = P.chip; if (P.pixel) ctx.fillRect(x, y, cw, 18); else { roundRect(ctx, x, y, cw, 18, 9); ctx.fill(); }
      ctx.fillStyle = col; ctx.globalAlpha = 0.35;
      if (P.pixel) ctx.fillRect(x, y + 14, Math.round(cw * f), 4); else { ctx.fillRect(x + 6, y + 15, (cw - 12) * f, 2); }
      ctx.globalAlpha = 1;
      glyph(ctx, k, x + 12, y + 9, 0.8, col);
      txt(g, up(P, g.t('pw_' + k)), x + 23, y + 13, { size: 9, color: col, weight: 800 }, P);
    }
  }

  function banner(g, ctx, S, P) {
    var title = null, sub = null, col = P.ink;
    var serving = S.phase === 'play' && S.balls.length === 1 && S.balls[0].serve;
    if (S.phase === 'play' && (S.banner > 0 || serving)) {
      title = up(P, g.t('ready')) + ' ' + S.level + ' · ' + up(P, g.t('lv_' + S.name));
      sub = S.boss ? g.t('bossSub') : g.t('launch'); col = P.accent;
    } else if (S.phase === 'clear') { title = g.t('clear'); sub = g.t('bonus') + ' +' + S.clearBonus; col = P.good; }
    else if (S.phase === 'dead') { title = g.t('lost'); sub = g.t('lives') + ': ' + S.lives; col = P.bad; }
    if (!title) return;
    var w = 380, h = 78, x = (g.W - w) / 2, y = 400;
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = col; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3); ctx.fillRect(x, y, 3, h); ctx.fillRect(x + w - 3, y, 3, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 22;
      ctx.fillStyle = P.panel; roundRect(ctx, x, y, w, h, 14); ctx.fill(); ctx.restore();
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 14); ctx.stroke();
    }
    txt(g, up(P, title), g.W / 2, y + 34, { size: P.pixel ? 18 : 20, align: 'center', color: col }, P);
    txt(g, up(P, sub), g.W / 2, y + 58, { size: P.pixel ? 10 : 12, align: 'center', color: P.muted, weight: 600 }, P);
  }

  // Всплывающие подписи (имя бонуса, «тяга печи»)
  function toasts(g, ctx, list, P) {
    for (var i = 0; i < list.length; i++) {
      var o = list[i], a = Math.min(1, o.t / 0.4);
      ctx.globalAlpha = a;
      txt(g, up(P, o.text), o.x, o.y - (1.4 - o.t) * 30, { size: P.pixel ? 12 : 13, align: 'center', color: o.color, weight: 900 }, P);
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
    fit: fit, sync: sync, roundRect: roundRect, txt: txt, hud: hud, powers: powers, banner: banner, toasts: toasts
  };
})(typeof window !== 'undefined' ? window : globalThis);
