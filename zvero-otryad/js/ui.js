/* ЗВЕРО-ОТРЯД · интерфейс: DOM-обвязка (подгонка холста, подписи страницы, тема) и конвейер кадра — мир (retro: буфер половинного размера
   и ×2 без сглаживания), HUD в верхней клетке, баннеры уровня, подсказки обучения, всплывающие надписи. Тексты — только через g.t(). ZVERO.ui */
(function (global) {
  'use strict';
  var Z = global.ZVERO = global.ZVERO || {};
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, pad = document.querySelector('.pad'), cs = pad && getComputedStyle(pad);
    var padH = cs && cs.display !== 'none' && cs.position !== 'fixed' ? pad.offsetHeight + 16 : 0;
    var vw = Math.min(innerWidth, document.documentElement.clientWidth || innerWidth), vh = Math.min(innerHeight, (global.visualViewport && global.visualViewport.height) || innerHeight);
    var availW = Math.min(vw - 12, 1180), availH = vh - padH - (padH ? 44 : 44);
    var w = Math.max(260, Math.floor(Math.min(availW, availH * g.W / g.H)));
    c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
    var se = document.scrollingElement || document.documentElement, over = se.scrollHeight - vh;
    if (over > 0 && w > 260) { w = Math.max(260, Math.floor(w - over * g.W / g.H) - 2); c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px'; }
  }
  var lastLang = null, lastTheme = null, lastPl = -1;
  function sync(g, S) {
    var lang = g.i18n.lang, theme = g.themeName;
    if (lang !== lastLang) {
      lastLang = lang; document.documentElement.lang = lang;
      var b = $('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = $('foot'); if (f) f.innerHTML = g.t('foot');
    }
    if (theme !== lastTheme) { lastTheme = theme; document.body.setAttribute('data-theme', theme); }
    var pl = g.input.playerCount; if (pl !== lastPl) { lastPl = pl; document.body.setAttribute('data-players', String(pl)); var sb = $('bSwap'); if (sb) sb.style.display = pl === 2 ? 'none' : ''; }
  }

  // ---------- Примитивы ----------
  function txt(g, s, x, y, o, P) {
    o = o || {}; o.font = P.font;
    if (o.shadow !== false) { var c = o.color; o.color = P.pixel ? '#000000' : 'rgba(0,0,0,.7)'; g.text(s, x + (P.pixel ? 2 : 1), y + 2, o); o.color = c; }
    g.text(s, x, y, o);
  }
  function up(P, s) { return P.pixel ? String(s).toUpperCase() : String(s); }
  function panel(ctx, x, y, w, h, P, edge) {
    if (P.pixel) { ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h); ctx.fillStyle = edge || P.line; ctx.fillRect(x, y, w, 4); ctx.fillRect(x, y + h - 4, w, 4); ctx.fillRect(x, y, 4, h); ctx.fillRect(x + w - 4, y, 4, h); }
    else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 20; ctx.fillStyle = P.panel; ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); ctx.restore();
      ctx.strokeStyle = edge || P.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.rect(x + 0.75, y + 0.75, w - 1.5, h - 1.5); ctx.stroke();
    }
  }
  function heart(ctx, x, y, s, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y + s * 0.35); ctx.bezierCurveTo(x - s * 0.9, y - s * 0.35, x - s * 0.35, y - s * 0.95, x, y - s * 0.4); ctx.bezierCurveTo(x + s * 0.35, y - s * 0.95, x + s * 0.9, y - s * 0.35, x, y + s * 0.35); ctx.fill(); }
  function star(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } ctx.closePath(); ctx.fill(); }
  function wrap(ctx, s, maxW) {
    var words = String(s).split(' '), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur); return lines;
  }

  // ---------- Мир ----------
  var buf = null, bctx = null;
  function world(g, ctx, S, P, shake) {
    var sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
    if (P.pixel) {
      if (!buf) { buf = document.createElement('canvas'); buf.width = Z.logic.W / 2; buf.height = Z.logic.H / 2; bctx = buf.getContext('2d'); }
      bctx.setTransform(0.5, 0, 0, 0.5, 0, 0); bctx.imageSmoothingEnabled = false; bctx.fillStyle = '#000'; bctx.fillRect(0, 0, Z.logic.W, Z.logic.H);
      Z.render.world(bctx, S, P, g.time);
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(buf, Math.round(sx / 2) * 2, Math.round(sy / 2) * 2, Z.logic.W, Z.logic.H); ctx.restore();
    } else {
      ctx.save(); ctx.translate(sx, sy); Z.render.world(ctx, S, P, g.time); ctx.restore();
    }
  }

  // ---------- HUD ----------
  function hud(g, ctx, S, P) {
    var W = Z.logic.W, i;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, 32);
    for (i = 0; i < Math.min(S.lives, 9); i++) heart(ctx, 18 + i * 17, 17, 7, P.bad);
    txt(g, up(P, g.t('score')) + ' ' + S.score, 18 + Math.min(S.lives, 9) * 17 + 14, 21, { size: 14, color: P.ink, weight: 800 }, P);
    txt(g, up(P, g.t('level')) + ' ' + (S.lv + 1) + '/' + Z.LEVELS.length + ' · ' + g.t('n' + (S.lv + 1)), W / 2, 21, { size: 14, align: 'center', color: P.accent, weight: 800, maxWidth: 380 }, P);
    star(ctx, W - 22, 17, 8, P.star);
    txt(g, S.got + '/' + S.stars.length, W - 36, 21, { size: 14, align: 'right', color: P.ink, weight: 800 }, P);
    if (S.players === 1) {
      var an = S.an[S.active];
      txt(g, up(P, g.t(S.active ? 'tyapa' : 'pyzh')), W - 92, 21, { size: 12, align: 'right', color: S.active ? P.tyapaHi : P.pyzhHi, weight: 800 }, P);
    }
    var B = S.boss;
    if (B && B.state !== 'dead') {
      var bw = 300, bx = (W - bw) / 2, by = 40;
      if (!P.pixel) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(bx - 8, by - 4, bw + 16, 26); }
      ctx.fillStyle = P.barBg; ctx.fillRect(bx, by + 12, bw, 7); ctx.fillStyle = P.bad; ctx.fillRect(bx, by + 12, bw * Math.max(0, B.hp) / B.max, 7);
      txt(g, up(P, g.t('b_boss')), W / 2, by + 8, { size: 11, align: 'center', color: P.ink, weight: 800 }, P);
    }
  }

  // ---------- Баннеры ----------
  function banners(g, ctx, S, P, hintOn) {
    var W = Z.logic.W, H = Z.logic.H;
    if (S.phase === 'intro') {
      var a = Math.min(1, S.introT * 2.4, (1.5 - S.introT) * 4 + 0.2);
      ctx.globalAlpha = Math.max(0, a);
      panel(ctx, W / 2 - 250, 200, 500, 112, P, P.accent);
      txt(g, up(P, g.t('level')) + ' ' + (S.lv + 1), W / 2, 244, { size: 32, align: 'center', color: P.accent, weight: 900 }, P);
      txt(g, g.t('n' + (S.lv + 1)), W / 2, 284, { size: 19, align: 'center', color: P.ink, weight: 700, maxWidth: 460 }, P);
      ctx.globalAlpha = 1;
    }
    if (S.phase === 'clear' && S.lv < Z.LEVELS.length - 1) {
      var lines = [['bTime', S.bonus.time], ['bNoDeath', S.bonus.noDeath], ['bBase', S.bonus.base], ['bStars', S.got * 100]];
      panel(ctx, W / 2 - 230, 120, 460, 70 + lines.length * 30 + (S.hold ? 24 : 0), P, P.good);
      txt(g, up(P, g.t('clear')), W / 2, 170, { size: 26, align: 'center', color: P.good, weight: 900, maxWidth: 420 }, P);
      lines.forEach(function (l, k) { txt(g, g.t(l[0]), W / 2 - 150, 208 + k * 30, { size: 16, color: P.ink, weight: 700 }, P); txt(g, '+' + l[1], W / 2 + 150, 208 + k * 30, { size: 16, align: 'right', color: P.accent, weight: 800 }, P); });
      if (S.hold) txt(g, g.t('cardNext'), W / 2, 208 + lines.length * 30 + 14, { size: 13, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
    }
    if (S.hint && S.phase === 'play' && S.hint.t < 7) {
      ctx.save(); ctx.font = '700 15px ' + P.font; var ls = wrap(ctx, g.t(S.hint.k), W - 220); ctx.restore();
      var hh = 18 + ls.length * 22, y0 = 40; ctx.globalAlpha = Math.min(1, S.hint.t * 2, (7 - S.hint.t) * 2);
      panel(ctx, 80, y0, W - 160, hh, P, P.line);
      ls.forEach(function (ln, k) { txt(g, ln, W / 2, y0 + 25 + k * 22, { size: 15, align: 'center', color: P.ink, weight: 700, shadow: false }, P); });
      ctx.globalAlpha = 1;
    }
  }
  function toasts(g, ctx, S, P, list) {
    list.forEach(function (o) {
      var y = o.y - (1.2 - o.t) * 26;
      ctx.globalAlpha = Math.min(1, o.t * 2);
      txt(g, up(P, o.text), o.x, y, { size: o.big ? 18 : 13, align: 'center', color: o.color, weight: 800, maxWidth: 300 }, P);
      ctx.globalAlpha = 1;
    });
  }

  function render(g, ctx, S, P, o) {
    o = o || {};
    sync(g, S);
    world(g, ctx, S, P, o.shake || 0);
    if (!o.bare) { toasts(g, ctx, S, P, o.toasts || []); hud(g, ctx, S, P); banners(g, ctx, S, P); }
  }

  Z.ui = {
    init: function (g) { var f = function () { fit(g); }; addEventListener('resize', f); f(); setTimeout(f, 50); sync(g, null); },
    fit: fit, sync: sync, txt: txt, panel: panel, up: up, world: world, render: render
  };
})(typeof window !== 'undefined' ? window : globalThis);
