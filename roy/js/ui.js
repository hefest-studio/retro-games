/* РОЙ · интерфейс: DOM-обвязка (подгонка canvas под экран, подписи страницы, тема, кнопка паузы)
   и общие для обеих тем элементы на канве — HUD, подсказки обучения, баннеры, «цепь ×N».
   Палитру P передаёт рендер (modern/classic), тексты — только через g.t(). ROY.ui */
(function (global) {
  'use strict';
  var R = global.ROY = global.ROY || {};
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, wrap = c.parentElement;
    var pad = document.querySelector('.pad'), cs = pad && getComputedStyle(pad), padH = cs && cs.display !== 'none' && cs.position !== 'fixed' ? pad.offsetHeight + 16 : 0;
    var foot = $('foot'), footH = foot && getComputedStyle(foot).display !== 'none' ? foot.offsetHeight + 14 : 0;
    var availH = innerHeight - padH - footH - 40;
    var w = Math.min(480, (wrap && wrap.clientWidth) || g.W, availH * g.W / g.H);
    w = Math.max(200, Math.floor(w));
    c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
    var se = document.scrollingElement || document.documentElement, over = se.scrollHeight - innerHeight;   // страховка от прокрутки (площадки)
    if (over > 0 && w > 200) { w = Math.max(200, Math.floor(w - over * g.W / g.H) - 2); c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px'; }
  }
  var lastLang = null, lastTheme = null;
  function sync(g) {
    var lang = g.i18n.lang, theme = g.themeName;
    if (lang !== lastLang) {
      lastLang = lang; document.documentElement.lang = lang;
      var b = $('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = $('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
      var pb = $('bPause'); if (pb) pb.title = g.t('pause');
      fit(g);
    }
    if (theme !== lastTheme) { lastTheme = theme; document.body.setAttribute('data-theme', theme); }
  }

  // ---------- Рисование ----------
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function up(P, s) { return P.pixel ? String(s).toUpperCase() : String(s); }
  function txt(g, s, x, y, o, P) { o = o || {}; if (P.font) o.font = P.font; if (o.weight == null) o.weight = P.pixel ? 900 : 800; g.text(up(P, s), x, y, o); }
  function panel(ctx, x, y, w, h, P, edge) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = edge || P.accent; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3);
    } else {
      ctx.fillStyle = P.panel; rr(ctx, x, y, w, h, 12); ctx.fill();
      ctx.strokeStyle = edge || P.line; ctx.lineWidth = 1.5; rr(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 12); ctx.stroke();
    }
  }

  // HUD: счёт, рекорд, волны, полоса Матки; снизу — корабли, искры, манок
  function hud(g, ctx, S, P, draw) {
    var W = S.W, H = S.H, best = Math.max(g.state.best || 0, S.score);
    if (!P.pixel) { ctx.fillStyle = P.hudBg; rr(ctx, 8, 8, W - 16, 40, 10); ctx.fill(); }
    txt(g, g.t('score'), 20, 22, { size: 10, color: P.muted }, P);
    txt(g, String(S.score), 20, 40, { size: 17, color: P.ink }, P);
    txt(g, g.t('best'), W - 20, 22, { size: 10, color: P.muted, align: 'right' }, P);
    txt(g, String(best), W - 20, 40, { size: 17, color: P.accent, align: 'right' }, P);
    txt(g, g.t('level') + ' ' + S.wave + '/' + S.waves, W / 2, 22, { size: 10, color: P.muted, align: 'center', maxWidth: 140 }, P);
    var q = S.queen, bw = 120, bx = W / 2 - bw / 2, by = 30;
    ctx.fillStyle = P.bar; if (P.pixel) ctx.fillRect(bx, by, bw, 6); else { rr(ctx, bx, by, bw, 6, 3); ctx.fill(); }
    var f = q ? Math.max(0, q.hp / q.max) : 0;
    if (f > 0) { ctx.fillStyle = q.hurtT > 0 ? '#ffffff' : P.queenBar; if (P.pixel) ctx.fillRect(bx, by, Math.round(bw * f / 3) * 3, 6); else { rr(ctx, bx, by, Math.max(6, bw * f), 6, 3); ctx.fill(); } }
    txt(g, g.t('queenHp'), W / 2, 46, { size: 8, color: P.muted, align: 'center', maxWidth: 140 }, P);
    // корабли (запас)
    var res = Math.max(0, S.lives - (S.player.alive ? 1 : 0));
    for (var i = 0; i < Math.min(res, 5); i++) draw.lifeIcon(ctx, 20 + i * 24, H - 16);
    // искры и манок — справа снизу
    var p = S.player;
    for (var k = 0; k < 3; k++) draw.chargeIcon(ctx, W - 92 + k * 16, H - 16, k < p.charges);
    draw.lureIcon(ctx, W - 22, H - 17, p.lureCd <= 0 && !S.lure ? 1 : Math.max(0, 1 - p.lureCd / R.consts.LURE_CD));
  }

  // Подсказка обучения (1-я волна): значок кнопки + строка
  function tip(g, ctx, S, P, draw) {
    if (!S.tip) return;
    var a = Math.min(1, S.tipT * 3), W = S.W, y = 372, w = W - 40;
    ctx.save(); ctx.globalAlpha = a * (P.pixel ? 1 : 0.95);
    panel(ctx, 20, y - 22, w, 34, P, P.tipEdge);
    var key = S.tip === 'tut2' ? 'lure' : 'spark';
    if (S.tip === 'tut4') draw.queenIcon(ctx, 44, y - 5); else draw.btnIcon(ctx, 44, y - 5, key, g.time);
    txt(g, g.t(S.tip), 66, y, { size: P.pixel ? 11 : 13, color: P.ink, maxWidth: w - 56 }, P);
    ctx.restore();
  }

  function banner(g, ctx, S, P) {
    if (!S.banner) return;
    var s = S.banner === 'wave' ? g.t('wave') + ' ' + S.wave + ' / ' + S.waves : g.t(S.banner);
    var col = S.banner === 'wave' ? P.ink : S.banner === 'ready' ? P.good : P.accent;
    var y = S.H * 0.5, a = Math.min(1, S.bannerT * 3), w = S.W - 80;
    ctx.save(); ctx.globalAlpha = a;
    panel(ctx, 40, y - 32, w, 50, P);
    txt(g, s, S.W / 2, y, { size: P.pixel ? 20 : 22, color: col, align: 'center', maxWidth: w - 20 }, P);
    ctx.restore();
  }

  function chainPop(g, ctx, S, P) {
    var c = S.lastChain; if (!c) return;
    var a = Math.min(1, c.t * 2), y = 84 - (1.6 - c.t) * 8;
    ctx.save(); ctx.globalAlpha = a;
    txt(g, g.t('chain') + ' ×' + c.n + '  +' + c.pts, S.W / 2, y, { size: c.n >= 8 ? 20 : 16, color: c.n >= 8 ? P.accent : P.good, align: 'center', maxWidth: S.W - 40 }, P);
    ctx.restore();
  }

  R.ui = {
    init: function (g) {
      var f = function () { fit(g); }; f(); addEventListener('resize', f); setTimeout(f, 60);
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
    fit: fit, sync: sync, rr: rr, up: up, txt: txt, panel: panel, hud: hud, tip: tip, banner: banner, chainPop: chainPop
  };
})(typeof window !== 'undefined' ? window : globalThis);
