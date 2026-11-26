/* ЭСКАДРИЛЬЯ · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема, кнопки паузы и дыма)
   и общие для обеих тем элементы на канве — HUD (верх: перелёт/счёт/самолёты; низ: обшивка, запас дыма; подсказки обучения),
   баннеры перелётов, всплывающие подписи. Палитру P передаёт активный рендерер, тексты — только через g.t(). */
(function (global) {
  'use strict';
  var E = global.ESKADRILYA = global.ESKADRILYA || {};
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, wrap = c.parentElement;
    var pad = document.querySelector('.pad'), cs = pad && getComputedStyle(pad), padH = cs && cs.display !== 'none' && cs.position !== 'fixed' ? pad.offsetHeight + 20 : 0;   // «лёжа» пульт поверх полей — места не занимает
    var availH = innerHeight - padH - (padH ? 64 : 40);
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
  function bar(ctx, x, y, w, h, f, col, P) {
    ctx.fillStyle = P.bar;
    if (P.pixel) ctx.fillRect(x, y, w, h); else { roundRect(ctx, x, y, w, h, h / 2); ctx.fill(); }
    if (f <= 0) return;
    ctx.fillStyle = col;
    if (P.pixel) ctx.fillRect(x, y, Math.max(2, Math.round(w * f / 4) * 4), h);
    else { roundRect(ctx, x, y, Math.max(h, w * f), h, h / 2); ctx.fill(); }
  }

  function hud(g, ctx, S, P, R) {
    var W = g.W, H = g.H, Hh = 44, Pl = S.player, i;
    // верх
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, Hh);
    ctx.fillStyle = P.hudLine; ctx.fillRect(0, Hh - 2, W, 2);
    txt(g, up(P, g.t('stage')) + ' ' + S.level + '/' + S.maxLevel, 12, 19, { size: 13, color: P.ink, maxWidth: 150 }, P);
    var nm = S.stage === 'boss' ? g.t('boss_' + S.level) : g.t('lv_' + S.name);
    txt(g, up(P, nm), 12, 36, { size: 11, color: S.stage === 'boss' ? P.accent : P.muted, weight: 700, maxWidth: 150 }, P);
    txt(g, String(S.score), W / 2, 28, { size: 20, align: 'center', color: P.accent }, P);
    var n = Math.max(3, S.lives);
    for (i = 0; i < n; i++) R.lifeIcon(ctx, W - 22 - i * 26, 22, i < S.lives);
    // низ: обшивка, запас дыма, гондолы кузни
    var by = H - 26;
    ctx.fillStyle = P.hudBg2; ctx.fillRect(0, by - 6, W, 32);
    txt(g, up(P, g.t('hull')), 12, by + 13, { size: 10, color: Pl.hull <= 1 ? P.bad : P.muted, weight: 800, maxWidth: 64 }, P);
    for (i = 0; i < 3; i++) R.hullIcon(ctx, 86 + i * 18, by + 9, !Pl.dead && i < Pl.hull);
    var f = Math.max(0, Pl.smoke / 100);
    txt(g, up(P, g.t('smoke')), 156, by + 13, { size: 10, color: P.muted, weight: 800, maxWidth: 58 }, P);
    bar(ctx, 218, by + 4, 150, 10, Pl.dead ? 0 : f, Pl.smoking ? P.ink : f < 0.25 ? P.warn : P.smokeBar, P);
    var B = S.boss;
    if (B && B.alive && !B.falling) {
      var left = B.pods.filter(function (t) { return t.alive; }).length;
      var bw = 160, bx = W / 2 - bw / 2, yy = Hh + 6;
      bar(ctx, bx, yy, bw, 6, B.core.open ? B.core.hp / B.core.max : left / B.total, P.bossBar, P);
      txt(g, up(P, g.t('ship') + ' ' + g.t('boss_' + S.level) + ' · ' + (B.core.open ? g.t('coreOpen') : g.t('pods') + ' ' + left + '/' + B.total)), W / 2, yy + 20, { size: 10, align: 'center', color: P.ink, weight: 800, maxWidth: W - 30 }, P);
    }
    // подсказка обучения (над нижней панелью)
    if (S.tip && S.phase === 'play') {
      var tw = W - 36, th = 30, tx = 18, ty = by - 48;
      ctx.save(); ctx.globalAlpha = 0.92;
      if (P.pixel) { ctx.fillStyle = '#000'; ctx.fillRect(tx, ty, tw, th); ctx.fillStyle = P.accent; ctx.fillRect(tx, ty, tw, 2); ctx.fillRect(tx, ty + th - 2, tw, 2); }
      else { ctx.fillStyle = 'rgba(12,18,30,.86)'; roundRect(ctx, tx, ty, tw, th, 10); ctx.fill(); ctx.strokeStyle = P.accent; ctx.lineWidth = 1.2; roundRect(ctx, tx, ty, tw, th, 10); ctx.stroke(); }
      ctx.restore();
      txt(g, up(P, g.t(S.tip)), W / 2, ty + 20, { size: P.pixel ? 10 : 12, align: 'center', color: P.ink, weight: 700, maxWidth: tw - 16 }, P);
    }
  }

  function panel(g, ctx, x, y, w, h, col, P) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = col; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3); ctx.fillRect(x, y, 3, h); ctx.fillRect(x + w - 3, y, 3, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 22;
      ctx.fillStyle = P.panel; roundRect(ctx, x, y, w, h, 14); ctx.fill(); ctx.restore();
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; roundRect(ctx, x, y, w, h, 14); ctx.stroke();
    }
  }

  function banner(g, ctx, S, P) {
    var title = null, sub = null, col = P.ink;
    if (S.phase === 'clear') { title = g.t('clear'); sub = g.t('bonus') + ' +' + S.clearBonus; col = P.good; }
    else if (S.phase === 'dead' && S.lives > 0) { title = g.t('lost'); sub = g.t('lives') + ': ' + S.lives; col = P.bad; }
    else if (S.banner > 0 && S.stage === 'route' && !S.tut) { title = up(P, g.t('stage')) + ' ' + S.level + ' · ' + up(P, g.t('lv_' + S.name)); sub = g.t('sub_route'); col = P.accent; }
    else if (S.boss && !S.boss.anchored && S.stage === 'boss') { title = g.t('ship') + ' ' + g.t('boss_' + S.level); sub = g.t('sub_boss'); col = P.bad; }
    if (!title) return;
    var w = 430, h = 74, x = (g.W - w) / 2, y = S.stage === 'boss' && S.phase === 'play' ? 470 : 250;   // у кузни — внизу, чтобы не закрывать её
    var a = S.phase === 'play' && S.banner > 0 && S.banner < 0.4 ? S.banner / 0.4 : 1;
    ctx.save(); ctx.globalAlpha = a;
    panel(g, ctx, x, y, w, h, col, P);
    txt(g, up(P, title), g.W / 2, y + 32, { size: P.pixel ? 15 : 19, align: 'center', color: col, maxWidth: w - 20 }, P);
    txt(g, up(P, sub), g.W / 2, y + 55, { size: P.pixel ? 8 : 11, align: 'center', color: P.muted, weight: 600, maxWidth: w - 20 }, P);
    ctx.restore();
  }

  function toasts(g, ctx, list, P) {
    for (var i = 0; i < list.length; i++) {
      var o = list[i], a = Math.min(1, o.t / 0.4);
      ctx.globalAlpha = a;
      txt(g, up(P, o.text), o.x, o.y - (1.4 - o.t) * 26, { size: P.pixel ? 11 : 13, align: 'center', color: o.color, weight: 900 }, P);
    }
    ctx.globalAlpha = 1;
  }

  // кнопка дыма (☁, удержание) и пауза — через Arcade.touchOk (v2.10): без предупреждений Chrome и двойных нажатий
  var smokeHeld = false;
  E.ui = {
    init: function (g) {
      fit(g); addEventListener('resize', function () { fit(g); });
      sync(g); setInterval(function () { sync(g); }, 250);
      var pb = $('bPause');
      if (pb) {
        var onPause = function (e) {
          if (!Arcade.touchOk(e)) return; e.stopPropagation();
          if (g._sceneName === 'play') g.pause();
          else if (g._sceneName === 'pause') g.goto('play', { resume: true });
        };
        pb.addEventListener('touchstart', onPause, { passive: false }); pb.addEventListener('mousedown', onPause);
      }
      var bs = document.querySelector('[data-act="smoke"]');
      if (bs) {
        var on = function (e) { if (!Arcade.touchOk(e)) return; smokeHeld = true; bs.classList.add('on'); };
        var off = function (e) { if (!Arcade.touchOk(e)) return; smokeHeld = false; bs.classList.remove('on'); };
        bs.addEventListener('touchstart', on, { passive: false }); bs.addEventListener('mousedown', on);
        bs.addEventListener('touchend', off, { passive: false }); bs.addEventListener('touchcancel', off, { passive: false });
        bs.addEventListener('mouseup', off); bs.addEventListener('mouseleave', function () { smokeHeld = false; bs.classList.remove('on'); });
        addEventListener('blur', function () { smokeHeld = false; bs.classList.remove('on'); });
      }
    },
    smokeHeld: function () { return smokeHeld; },
    fit: fit, sync: sync, roundRect: roundRect, txt: txt, up: up, bar: bar, hud: hud, panel: panel, banner: banner, toasts: toasts
  };
})(typeof window !== 'undefined' ? window : globalThis);
