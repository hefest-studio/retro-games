/* ЗАСЛОН · DOM-обвязка: подгонка canvas под экран, локализация подписей страницы,
   тема страницы, тач-кнопки паузы и мега-бомбы. ZASLON.ui.init(g, onBomb),
   общие HUD/мастерская/тосты (ZASLON.ui.hud/shop/toasts) по палитре рендера. */
(function (global) {
  'use strict';
  var Z = global.ZASLON = global.ZASLON || {};
  function $(id) { return document.getElementById(id); }

  // Canvas вписывается и по ширине, и по высоте окна (портрет 3:4).
  function fit(g) {
    var c = g.canvas, wrap = c.parentElement;
    var pad = document.querySelector('.pad'), padH = pad && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 16 : 0;
    var availH = innerHeight - padH - 64;
    var w = Math.min(480, (wrap && wrap.clientWidth) || g.W, availH * g.W / g.H);
    w = Math.max(220, Math.floor(w));
    c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
  }

  var lastLang = null, lastTheme = null;
  function sync(g) {
    var lang = g.i18n.lang, theme = g.themeName;
    if (lang !== lastLang) {
      lastLang = lang;
      document.documentElement.lang = lang;
      var b = $('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = $('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
      var pb = $('bPause'); if (pb) pb.title = g.t('pause');
    }
    if (theme !== lastTheme) { lastTheme = theme; document.body.setAttribute('data-theme', theme); }
  }

  function tap(el, fn) {
    if (!el) return;
    var h = function (e) { e.preventDefault(); fn(); };
    el.addEventListener('touchstart', h, { passive: false }); el.addEventListener('mousedown', h);
  }


  // ---------- Общие примитивы HUD/мастерской (стиль — из палитры рендера P) ----------
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function txt(g, s, x, y, o, P) { o = o || {}; if (P.font) o.font = P.font; g.text(P.pixel ? String(s).toUpperCase() : s, x, y, o); }
  function panel(ctx, x, y, w, h, P, alpha) {
    if (P.pixel) {
      ctx.fillStyle = 'rgba(0,0,0,' + (alpha || 0.88) + ')'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = P.line; ctx.fillRect(x, y, w, 4); ctx.fillRect(x, y + h - 4, w, 4); ctx.fillRect(x, y, 4, h); ctx.fillRect(x + w - 4, y, 4, h);
      return;
    }
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 28; ctx.fillStyle = 'rgba(14,20,36,' + (alpha || 0.9) + ')';
    roundRect(ctx, x, y, w, h, 18); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(120,150,210,.22)'; ctx.lineWidth = 1; roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 18); ctx.stroke();
  }
  // Светящаяся полоса заслона (f — прочность 0..1)
  function barrier(ctx, x, y, w, f, t, P) {
    var col = f > 0.5 ? P.cyan : f > 0.25 ? P.warn : P.bad;
    if (P.pixel) {
      for (var i = 0; i < w; i += 8) { ctx.fillStyle = ((i / 8 + ((t * 8) | 0)) % 3) ? col : '#ffffff'; ctx.fillRect(x + i, y, 6, 4); }
      return;
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var gr = ctx.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.15, col); gr.addColorStop(0.85, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 5); ctx.fillRect(x, y - 5, w, 12);
    ctx.globalAlpha = 0.95; ctx.fillRect(x, y, w, 2);
    ctx.restore();
  }
  function pips(ctx, x, y, n, max, col, off, P, sz) {
    sz = sz || 8;
    for (var i = 0; i < max; i++) {
      ctx.fillStyle = i < n ? col : off;
      if (P.pixel) ctx.fillRect(x + i * (sz + 3), y, sz, sz);
      else { roundRect(ctx, x + i * (sz + 3), y, sz, sz, 2); ctx.fill(); }
    }
  }

  // HUD: верх — счёт/сектор/корабли, оружие/лом/бомбы, полоса босса; низ — прочность заслона.
  function hud(g, S, P) {
    var ctx = g.ctx, W = g.W, H = g.H, p = S.player;
    if (!P.pixel) { var gr = ctx.createLinearGradient(0, 0, 0, 56); gr.addColorStop(0, 'rgba(4,6,14,.85)'); gr.addColorStop(1, 'rgba(4,6,14,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, 56); }
    else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 46); ctx.fillStyle = P.line; ctx.fillRect(0, 46, W, 2); }
    txt(g, String(S.score), 12, 21, { size: 18, color: P.ink, weight: 900 }, P);
    txt(g, g.t('sector') + ' ' + S.sector + '/' + S.sectors, W / 2, 20, { size: 13, align: 'center', color: P.accent, weight: 800 }, P);
    // корабли
    for (var i = 0; i < S.lives; i++) Z.ui.lifeIcon(ctx, W - 18 - i * 18, 13, P);
    // строка 2: оружие и уровень, лом, бомбы
    var wn = p.weapon, lv = p.lv[wn];
    txt(g, g.t('w_' + wn), 12, 39, { size: 11, color: P.wpn[wn], weight: 800 }, P);
    ctx.font = (P.pixel ? '800 11px ' : '800 11px ') + (P.font || 'sans-serif');
    var ww = ctx.measureText(P.pixel ? g.t('w_' + wn).toUpperCase() : g.t('w_' + wn)).width;
    pips(ctx, 18 + ww, 31, lv, 3, P.wpn[wn], P.off, P, 7);
    txt(g, g.t('scrap') + ' ' + S.scrap, W / 2, 39, { size: 11, align: 'center', color: P.scrap, weight: 800 }, P);
    txt(g, '✹ ' + p.bombs, W - 12, 39, { size: 12, align: 'right', color: P.cyan, weight: 800 }, P);
    // босс
    var B = S.boss;
    if (B) {
      var bw = 260, bx = (W - bw) / 2, by = 52, f = Math.max(0, B.hp / B.max);
      ctx.fillStyle = P.off; if (P.pixel) ctx.fillRect(bx, by, bw, 6); else { roundRect(ctx, bx, by, bw, 6, 3); ctx.fill(); }
      if (f > 0) { ctx.fillStyle = P.bad; if (P.pixel) ctx.fillRect(bx, by, Math.round(bw * f / 4) * 4, 6); else { roundRect(ctx, bx, by, Math.max(6, bw * f), 6, 3); ctx.fill(); } }
      txt(g, g.t('b_' + B.kind), W / 2, by + 18, { size: 10, align: 'center', color: P.muted, weight: 800 }, P);
    }
    // заслон: подпись и полоса
    var bf = S.base / 100;
    txt(g, g.t('base') + ' ' + Math.round(S.base) + '%', 10, H - 16, { size: 10, color: bf > 0.5 ? P.cyan : bf > 0.25 ? P.warn : P.bad, weight: 800 }, P);
    // щит корабля
    txt(g, g.t('shield'), W - 12 - p.shMax * 11, H - 16, { size: 10, align: 'right', color: P.muted, weight: 700 }, P);
    pips(ctx, W - 8 - p.shMax * 11, H - 24, p.shield, p.shMax, P.cyan, P.off, P, 8);
    // баннер
    if (S.banner) {
      var a = Math.min(1, S.bannerT * 2), key = S.banner, s = g.t(key), sub = null;
      if (key === 'sector') { s = g.t('sector') + ' ' + S.bannerArg; sub = g.t('base') + ': ' + Math.round(S.base) + '%'; }
      if (key === 'boss') { s = g.t('b_' + C().BOSSES[S.bannerArg - 1].kind); }
      ctx.save(); ctx.globalAlpha = a;
      txt(g, s, W / 2, H / 2 - 30, { size: key === 'warn' ? 20 : 30, align: 'center', color: key === 'baseDown' || key === 'warn' || key === 'boss' ? P.bad : P.accent, weight: 900 }, P);
      if (sub) txt(g, sub, W / 2, H / 2 - 6, { size: 13, align: 'center', color: P.muted, weight: 700 }, P);
      ctx.restore();
    }
  }
  function C() { return Z.consts; }

  // Мастерская: строки товаров (y0, шаг) — общие для отрисовки и тапа.
  var SHOP_Y0 = 150, SHOP_ROW = 46;
  function shopRowAt(y) { var i = Math.floor((y - SHOP_Y0 + 8) / SHOP_ROW); return i >= 0 && i < C().SHOP.length ? i : -1; }
  function shop(g, S, items, P, r) {
    var ctx = g.ctx, W = g.W, p = S.player;
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.55)' : 'rgba(4,6,14,.55)'; ctx.fillRect(0, 0, W, g.H);
    panel(ctx, 30, 72, W - 60, 524, P);
    txt(g, g.t('shop'), W / 2, 110, { size: 26, align: 'center', color: P.accent, weight: 900 }, P);
    txt(g, g.t('scrap') + ': ' + S.scrap, W / 2, 134, { size: 14, align: 'center', color: P.scrap, weight: 800 }, P);
    for (var i = 0; i < items.length; i++) {
      var it = items[i], y = SHOP_Y0 + i * SHOP_ROW, sel = S.shop.sel === i;
      if (sel) {
        ctx.fillStyle = P.pixel ? P.selBg : 'rgba(255,122,26,.14)';
        if (P.pixel) ctx.fillRect(44, y - 6, W - 88, SHOP_ROW - 4); else { roundRect(ctx, 44, y - 6, W - 88, SHOP_ROW - 4, 10); ctx.fill(); }
        ctx.fillStyle = P.accent; ctx.fillRect(44, y - 6, 3, SHOP_ROW - 4);
      }
      var col = it.key === 'next' ? P.good : it.maxed ? P.muted : it.can ? P.ink : P.dim;
      r.shopIcon(ctx, it.key, 66, y + 14, g, S);
      txt(g, g.t('s_' + it.key) + (it.key === 'weapon' ? ' · ' + g.t('w_' + p.weapon) : ''), 88, y + 12, { size: 14, color: col, weight: 800 }, P);
      txt(g, g.t('d_' + it.key), 88, y + 29, { size: 10, color: P.muted, weight: 600 }, P);
      var pr = it.key === 'next' ? '' : it.maxed ? g.t('maxed') : String(it.price);
      txt(g, pr, W - 58, y + 20, { size: 15, align: 'right', color: it.maxed ? P.muted : it.can ? P.scrap : P.bad, weight: 900 }, P);
    }
    // текущее снаряжение
    var sy = SHOP_Y0 + items.length * SHOP_ROW + 8;
    var stat = g.t('w_' + p.weapon) + ' ' + g.t('lvl') + p.lv[p.weapon] + ' · ' + g.t('shield') + ' ' + p.shMax + ' · ✹ ' + p.bombs + ' · ' + g.t('base') + ' ' + Math.round(S.base) + '% · ♥ ' + S.lives;
    txt(g, stat, W / 2, sy + 4, { size: 11, align: 'center', color: P.ink, weight: 700 }, P);
    txt(g, g.t('shopHint'), W / 2, sy + 24, { size: 10, align: 'center', color: P.muted, weight: 600 }, P);
  }
  function toasts(g, list, P) {
    for (var i = 0; i < list.length; i++) {
      var o = list[i], a = Math.min(1, o.t * 2);
      g.ctx.save(); g.ctx.globalAlpha = a;
      txt(g, o.text, o.x, o.y - (1.3 - o.t) * 22, { size: 13, align: 'center', color: o.color, weight: 900 }, P);
      g.ctx.restore();
    }
  }

  Z.ui = {
    init: function (g, onBomb) {
      fit(g); addEventListener('resize', function () { fit(g); });
      addEventListener('load', function () { fit(g); }); setTimeout(function () { fit(g); }, 150);   // мобильный вьюпорт устаканивается не сразу
      sync(g); setInterval(function () { sync(g); }, 250);
      tap($('bPause'), function () {
        if (g._sceneName === 'play') g.pause();
        else if (g._sceneName === 'pause') g.goto('play', { resume: true });
      });
      tap($('bBomb'), function () { if (onBomb) onBomb(); });
    },
    fit: fit, sync: sync, roundRect: roundRect, txt: txt, panel: panel, barrier: barrier, pips: pips,
    hud: hud, shop: shop, shopRowAt: shopRowAt, toasts: toasts,
    lifeIcon: function (ctx, x, y, P) { (P.pixel ? Z.classic : Z.modern).life(ctx, x, y); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
