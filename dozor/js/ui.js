/* ДОЗОР · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема) и конвейер кадра —
   мир через камеру (retro — в буфер половинного размера и ×2 без сглаживания), HUD, полоса крепости,
   баннеры этапа/босса/итога, окно «Продолжить?», всплывающие надписи. Тексты — только через g.t(). DOZOR.ui */
(function (global) {
  'use strict';
  var D = global.DOZOR = global.DOZOR || {};
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, pad = document.querySelector('.pad');
    var padH = pad && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 16 : 0;
    var availW = Math.min(innerWidth - 16, 640), availH = innerHeight - padH - 70;
    var w = Math.max(240, Math.floor(Math.min(availW, availH * g.W / g.H)));
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

  // ---------- Примитивы ----------
  function txt(g, s, x, y, o, P) {
    o = o || {}; o.font = P.font;
    if (o.shadow !== false) { var c = o.color; o.color = P.pixel ? '#000000' : 'rgba(0,0,0,.6)'; g.text(s, x + (P.pixel ? 2 : 1), y + 2, o); o.color = c; }
    g.text(s, x, y, o);
  }
  function up(P, s) { return P.pixel ? String(s).toUpperCase() : String(s); }
  function panel(ctx, x, y, w, h, P, edge) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = edge || P.line; ctx.fillRect(x, y, w, 4); ctx.fillRect(x, y + h - 4, w, 4); ctx.fillRect(x, y, 4, h); ctx.fillRect(x + w - 4, y, 4, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 20; D.render.rrect(ctx, x, y, w, h, 12, P.panel); ctx.restore();
      ctx.strokeStyle = edge || P.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.rect(x + 0.75, y + 0.75, w - 1.5, h - 1.5); ctx.stroke();
    }
  }
  function bar(ctx, x, y, w, h, f, col, P) {
    ctx.fillStyle = P.barBg; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col; ctx.fillRect(x, y, P.pixel ? Math.round(w * Math.max(0, f) / 4) * 4 : w * Math.max(0, Math.min(1, f)), h);
  }

  // ---------- Мир ----------
  var buf = null, bctx = null;
  function world(g, ctx, S, P, shake) {
    var L = D.logic, sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
    var time = g.time;
    if (P.pixel) {
      if (!buf) { buf = document.createElement('canvas'); buf.width = L.VIEW_W / 2; buf.height = L.VIEW_H / 2; bctx = buf.getContext('2d'); }
      bctx.setTransform(0.5, 0, 0, 0.5, 0, 0); bctx.imageSmoothingEnabled = false;
      bctx.fillStyle = '#000'; bctx.fillRect(0, 0, L.VIEW_W, L.VIEW_H);
      bctx.translate(0, -Math.round(S.camY));
      D.render.world(bctx, S, P, time);
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(buf, Math.round(sx / 2) * 2, L.HUD + Math.round(sy / 2) * 2, L.VIEW_W, L.VIEW_H); ctx.restore();
    } else {
      ctx.save(); ctx.beginPath(); ctx.rect(0, L.HUD, L.VIEW_W, L.VIEW_H); ctx.clip();
      ctx.translate(sx, L.HUD - S.camY + sy);
      D.render.world(ctx, S, P, time);
      ctx.restore();
      // лёгкая виньетка
      var gr = ctx.createLinearGradient(0, L.HUD, 0, L.HUD + 40); gr.addColorStop(0, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, L.HUD, L.VIEW_W, 40);
    }
  }

  // ---------- HUD ----------
  function hud(g, ctx, S, P) {
    var L = D.logic, W = L.VIEW_W, two = S.heroes.length === 2;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, L.HUD);
    ctx.fillStyle = P.line; ctx.fillRect(0, L.HUD - (P.pixel ? 2 : 1), W, P.pixel ? 2 : 1);
    txt(g, up(P, g.t('score')) + ' ' + S.score, 8, 17, { size: 13, color: P.ink, weight: 800 }, P);
    txt(g, up(P, g.t('stageShort')) + ' ' + S.stage + '/' + S.maxStage, W / 2, 17, { size: 12, align: 'center', color: P.muted, weight: 700 }, P);
    txt(g, up(P, g.t('rescued')) + ' ' + S.rescued, W - 8, 17, { size: 12, align: 'right', color: P.good, weight: 700 }, P);
    S.heroes.forEach(function (h, i) {
      var x = two ? (i ? W - 8 : 8) : 8, al = two && i ? 'right' : 'left', y = 34;
      var s = (two ? g.t('p' + (i + 1)) + ' ' : '') + (h.out ? g.t('out') : '♥' + h.lives) + '  ' + g.t('w_' + h.tier) + '  ' + h.carried + '/' + L.CAPACITY;
      txt(g, up(P, s), x, y, { size: 11, align: al, color: P.hero[i], weight: 700 }, P);
    });
    if (!two) txt(g, up(P, g.t('best')) + ' ' + Math.max(g.state.best || 0, S.score), W - 8, 34, { size: 11, align: 'right', color: P.muted, weight: 600 }, P);
    var B = S.boss;
    if (B && B.active && !B.dead) {
      var bw = 260, bx = (W - bw) / 2, by = L.HUD + 8;
      if (!P.pixel) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(bx - 6, by - 4, bw + 12, 24); }
      bar(ctx, bx, by + 10, bw, 6, B.hp / B.max, P.boss, P);
      txt(g, up(P, g.t('b_' + B.key)), W / 2, by + 7, { size: 10, align: 'center', color: P.ink, weight: 800 }, P);
    }
  }

  // ---------- Баннеры ----------
  function banners(g, ctx, S, P) {
    var L = D.logic, W = L.VIEW_W, H = L.SCREEN_H;
    if (S.banner > 0 && S.phase === 'play') {
      var a = Math.min(1, S.banner * 2);
      ctx.globalAlpha = a;
      panel(ctx, 40, 230, W - 80, 104, P, P.accent);
      txt(g, up(P, g.t('stage')) + ' ' + S.stage, W / 2, 262, { size: 14, align: 'center', color: P.muted, weight: 800 }, P);
      txt(g, up(P, g.t('s_' + S.name)), W / 2, 294, { size: 26, align: 'center', color: P.accent, weight: 900 }, P);
      txt(g, g.t('introSub'), W / 2, 318, { size: 11, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
      ctx.globalAlpha = 1;
    }
    var B = S.boss;
    if (B && B.active && B.intro > 0) {
      panel(ctx, 50, 250, W - 100, 80, P, P.boss);
      txt(g, up(P, g.t('b_' + B.key)), W / 2, 286, { size: 26, align: 'center', color: P.boss, weight: 900 }, P);
      txt(g, g.t('bossSub'), W / 2, 310, { size: 11, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
    }
    if (S.phase === 'clear') {
      panel(ctx, 50, 220, W - 100, 130, P, P.good);
      txt(g, up(P, g.t('clear')), W / 2, 258, { size: 24, align: 'center', color: P.good, weight: 900 }, P);
      txt(g, g.t('rescued') + ': ' + S.rescued, W / 2, 290, { size: 14, align: 'center', color: P.ink, weight: 700 }, P);
      txt(g, g.t('bonus') + ': ' + (3000 * S.stage), W / 2, 314, { size: 14, align: 'center', color: P.accent, weight: 700 }, P);
    }
    if (S.phase === 'cont') {
      ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.6)' : 'rgba(8,10,14,.6)'; ctx.fillRect(0, L.HUD, W, L.VIEW_H);
      panel(ctx, 50, 220, W - 100, 150, P, P.warn);
      txt(g, up(P, g.t('cont')), W / 2, 258, { size: 24, align: 'center', color: P.warn, weight: 900 }, P);
      txt(g, String(Math.ceil(S.contT)), W / 2, 310, { size: 44, align: 'center', color: P.ink, weight: 900 }, P);
      txt(g, g.t('contHint'), W / 2, 338, { size: 12, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
      txt(g, g.t('contLeft') + ': ' + S.continues, W / 2, 358, { size: 11, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
    }
  }
  function toasts(g, ctx, S, P, list) {
    list.forEach(function (o) {
      var y = o.y - S.camY + D.logic.HUD - (1.3 - o.t) * 26;
      ctx.globalAlpha = Math.min(1, o.t * 2);
      txt(g, up(P, o.text), o.x, y, { size: o.big ? 15 : 11, align: 'center', color: o.color, weight: 800 }, P);
      ctx.globalAlpha = 1;
    });
  }

  function render(g, ctx, S, P, o) {
    o = o || {};
    sync(g);
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, g.W, g.H);
    world(g, ctx, S, P, o.shake || 0);
    if (!o.bare) { toasts(g, ctx, S, P, o.toasts || []); hud(g, ctx, S, P); banners(g, ctx, S, P); }
  }

  D.ui = {
    init: function (g) { var f = function () { fit(g); }; addEventListener('resize', f); f(); setTimeout(f, 50); sync(g); },
    fit: fit, sync: sync, txt: txt, panel: panel, up: up, world: world, render: render
  };
})(typeof window !== 'undefined' ? window : globalThis);
