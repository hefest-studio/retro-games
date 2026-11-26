/* СПУТНИК · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема, кнопки паузы и закалки)
   и общие для обеих тем элементы на канве — HUD, полоса босса, баннеры, всплывающие подписи.
   Палитру P передаёт активный рендерер (modern/classic), тексты — только через g.t(). SPUTNIK.ui */
(function (global) {
  'use strict';
  var Sp = global.SPUTNIK = global.SPUTNIK || {};
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {   // холст — в окно; «лёжа» на телефоне — поля по бокам под стик и кнопку; страховка от прокрутки (площадки)
    var c = g.canvas, wrap = c.parentElement, pad = document.querySelector('.pad');
    var padFixed = pad && getComputedStyle(pad).position === 'fixed', padOn = pad && getComputedStyle(pad).display !== 'none';
    var padH = padOn && !padFixed ? pad.offsetHeight + 16 : 0;
    var vw = Math.min(innerWidth, document.documentElement.clientWidth || innerWidth), vh = Math.min(innerHeight, (global.visualViewport && global.visualViewport.height) || innerHeight);
    var w = Math.min(960, padFixed && padOn ? vw - 300 : ((wrap && wrap.clientWidth) || g.W), (vh - padH - (padH ? 64 : 40)) * g.W / g.H);
    w = Math.max(240, Math.floor(w)); c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
    var se = document.scrollingElement || document.documentElement, over = se.scrollHeight - vh;
    if (over > 0 && w > 240) { w = Math.max(240, Math.floor(w - over * g.W / g.H) - 2); c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px'; }
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
    if (P.pixel) ctx.fillRect(x, y, Math.round(w * f / 2) * 2, h); else { roundRect(ctx, x, y, Math.max(h, w * f), h, h / 2); ctx.fill(); }
  }

  function hud(g, ctx, S, P, lifeIcon) {
    var W = g.W, Hh = 26;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, Hh);
    ctx.fillStyle = P.hudLine; ctx.fillRect(0, Hh - 2, W, 2);
    var lv = up(P, g.t('lvl')) + ' ' + S.level + '/' + S.maxLevel;
    txt(g, lv, 10, 17, { size: 12, color: P.ink }, P);
    var lw = ctx.measureText(lv).width;
    txt(g, up(P, g.t('lv_' + S.name)), 10 + lw + 10, 17, { size: 10, color: P.muted, weight: 700, maxWidth: Math.max(40, 248 - lw - 20) }, P);
    txt(g, String(S.score), 300, 18, { size: 15, align: 'center', color: P.accent }, P);
    // жар: шкала с отметками ступеней; закалка готова — значок мигает
    var tr = S.tier, hc = P.heat[tr], f = S.heat / 100, bx = 418, bw = 118;
    txt(g, up(P, g.t('heat')), bx - 8, 17, { size: 9, align: 'right', color: tr ? hc : P.muted, weight: 800, maxWidth: 54 }, P);
    bar(ctx, bx, 10, bw, 7, f, tr === 2 && Math.floor(S.time * 10) % 2 ? '#fff6e0' : hc, P);
    ctx.fillStyle = P.hudBg; ctx.fillRect(bx + Math.round(bw * 0.35), 9, 2, 9); ctx.fillRect(bx + Math.round(bw * 0.7), 9, 2, 9);
    if (S.heat >= 25) { var on = Math.floor(S.time * 4) % 2 || S.heat >= 70; ctx.fillStyle = on ? P.steam : P.muted; var qx = bx + bw + 10, qy = 13;
      ctx.beginPath(); ctx.moveTo(qx, qy - 5); ctx.lineTo(qx + 5, qy); ctx.lineTo(qx, qy + 5); ctx.lineTo(qx - 5, qy); ctx.closePath(); ctx.fill(); }
    var n = Math.max(3, S.lives);
    for (var j = 0; j < Math.min(n, 5); j++) lifeIcon(ctx, W - 14 - j * 16, 13, j < S.lives);
  }
  function bossBar(g, ctx, S, P) {
    var B = S.boss && S.boss.alive ? S.boss : null, G = S.guard;
    var o = B ? { name: 'b_' + B.type, f: B.hp / B.max } : G ? { name: 'guard', f: G.hp / G.max } : null;
    if (!o) return;
    var w = 220, x = (g.W - w) / 2, y = 32;
    if (!P.pixel) { ctx.fillStyle = 'rgba(0,0,0,.35)'; roundRect(ctx, x - 8, y - 4, w + 16, 22, 8); ctx.fill(); }
    txt(g, up(P, g.t(o.name)), g.W / 2, y + 6, { size: 9, align: 'center', color: P.ink, weight: 800 }, P);
    bar(ctx, x, y + 10, w, 5, Math.max(0, o.f), P.bossBar, P);
  }
  function panel(g, ctx, x, y, w, h, col, P) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = col; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3); ctx.fillRect(x, y, 3, h); ctx.fillRect(x + w - 3, y, 3, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 22;
      ctx.fillStyle = P.panelA; roundRect(ctx, x, y, w, h, 14); ctx.fill(); ctx.restore();
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 14); ctx.stroke();
    }
  }
  function banner(g, ctx, S, P) {
    var title = null, sub = null, col = P.ink;
    if (S.phase === 'intro') { title = up(P, g.t('lvl')) + ' ' + S.level + ' · ' + up(P, g.t('lv_' + S.name)); sub = g.t('sub_' + S.name); col = P.accent; }
    else if (S.phase === 'clear') { title = g.t('clear'); sub = g.t('bonus') + ' +' + S.clearBonus; col = P.good; }
    else if (S.phase === 'dead' && S.lives > 0) { title = g.t('lost'); sub = g.t('lives') + ': ' + S.lives + ' · ' + g.t('cp'); col = P.bad; }
    else if (S.boss && S.boss.alive && S.boss.enter > 0) { title = g.t('b_' + S.boss.type); sub = g.t('w_' + S.boss.type); col = P.bad; }
    if (!title) return;
    var w = 420, h = 66, x = (g.W - w) / 2, y = 128;
    panel(g, ctx, x, y, w, h, col, P);
    txt(g, up(P, title), g.W / 2, y + 28, { size: P.pixel ? 15 : 18, align: 'center', color: col }, P);
    txt(g, up(P, sub), g.W / 2, y + 50, { size: P.pixel ? 8 : 11, align: 'center', color: P.muted, weight: 600 }, P);
  }
  function toasts(g, ctx, list, P) {
    for (var i = 0; i < list.length; i++) {
      var o = list[i], a = Math.min(1, o.t / 0.4);
      ctx.globalAlpha = a;
      txt(g, up(P, o.text), o.x, o.y - (1.4 - o.t) * 22, { size: P.pixel ? 10 : 12, align: 'center', color: o.color, weight: 900 }, P);
    }
    ctx.globalAlpha = 1;
  }

  Sp.ui = {
    init: function (g, onQuench) {
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
      var bq = $('bQuench');
      if (bq) {
        var onQ = function (e) { e.preventDefault(); e.stopPropagation(); onQuench(); };
        bq.addEventListener('touchstart', onQ, { passive: false }); bq.addEventListener('mousedown', onQ);
      }
    },
    fit: fit, sync: sync, roundRect: roundRect, txt: txt, up: up, hud: hud, bossBar: bossBar, panel: panel, banner: banner, toasts: toasts
  };
})(typeof window !== 'undefined' ? window : globalThis);
