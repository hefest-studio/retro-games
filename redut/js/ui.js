/* РЕДУТ · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема, кольцо заряда на кнопке вспышки) и конвейер кадра —
   мир (retro — в буфер половинного размера и ×2 без сглаживания), HUD, баннеры волны/итога, подсказки обучения, всплывающие надписи.
   Тексты — только через g.t(). REDUT.ui */
(function (global) {
  'use strict';
  var R = global.REDUT = global.REDUT || {};
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, pad = document.querySelector('.pad'), cs = pad && getComputedStyle(pad);
    var padH = cs && cs.display !== 'none' && cs.position !== 'fixed' ? pad.offsetHeight + 16 : 0;   // телефон «лёжа»: пульт поверх полей (fixed)
    var vw = Math.min(innerWidth, document.documentElement.clientWidth || innerWidth), vh = Math.min(innerHeight, (global.visualViewport && global.visualViewport.height) || innerHeight);
    var availW = Math.min(vw - 16, 640), availH = vh - padH - (padH ? 70 : 40);
    var w = Math.max(240, Math.floor(Math.min(availW, availH * g.W / g.H)));
    c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
    var se = document.scrollingElement || document.documentElement, over = se.scrollHeight - vh;   // страховка от прокрутки (площадки)
    if (over > 0 && w > 240) { w = Math.max(240, Math.floor(w - over * g.W / g.H) - 2); c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px'; }
  }
  var lastLang = null, lastTheme = null, lastCh = -1;
  function sync(g, S) {
    var lang = g.i18n.lang, theme = g.themeName;
    if (lang !== lastLang) {
      lastLang = lang; document.documentElement.lang = lang;
      var b = $('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = $('foot'); if (f) f.innerHTML = g.t('foot');
      var bf = $('bFlare'); if (bf) bf.setAttribute('aria-label', g.t('ready'));
    }
    if (theme !== lastTheme) { lastTheme = theme; document.body.setAttribute('data-theme', theme); }
    var bf2 = $('bFlare'), ch = S ? Math.round(S.charge) : 0;
    if (bf2 && ch !== lastCh) { lastCh = ch; bf2.style.setProperty('--ch', ch); bf2.classList.toggle('rdy', ch >= 100); }
  }

  // ---------- Примитивы ----------
  function txt(g, s, x, y, o, P) {
    o = o || {}; o.font = P.font;
    if (o.shadow !== false) { var c = o.color; o.color = P.pixel ? '#000000' : 'rgba(0,0,0,.65)'; g.text(s, x + (P.pixel ? 2 : 1), y + 2, o); o.color = c; }
    g.text(s, x, y, o);
  }
  function up(P, s) { return P.pixel ? String(s).toUpperCase() : String(s); }
  function panel(ctx, x, y, w, h, P, edge) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = edge || P.line; ctx.fillRect(x, y, w, 4); ctx.fillRect(x, y + h - 4, w, 4); ctx.fillRect(x, y, 4, h); ctx.fillRect(x + w - 4, y, 4, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 20; ctx.fillStyle = P.panel; ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); ctx.restore();
      ctx.strokeStyle = edge || P.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.rect(x + 0.75, y + 0.75, w - 1.5, h - 1.5); ctx.stroke();
    }
  }
  function bar(ctx, x, y, w, h, f, col, P) {
    ctx.fillStyle = P.barBg; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col; ctx.fillRect(x, y, P.pixel ? Math.round(w * Math.max(0, f) / 4) * 4 : w * Math.max(0, Math.min(1, f)), h);
  }
  function wrap(ctx, s, maxW) {   // разбить на строки по ширине (для подсказок)
    var words = String(s).split(' '), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur); return lines;
  }

  // ---------- Мир ----------
  var buf = null, bctx = null;
  function world(g, ctx, S, P, shake) {
    var L = R.logic, sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
    if (P.pixel) {
      if (!buf) { buf = document.createElement('canvas'); buf.width = L.W / 2; buf.height = L.AH / 2; bctx = buf.getContext('2d'); }
      bctx.setTransform(0.5, 0, 0, 0.5, 0, 0); bctx.imageSmoothingEnabled = false;
      bctx.fillStyle = '#000'; bctx.fillRect(0, 0, L.W, L.AH);
      R.render.world(bctx, S, P, g.time);
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(buf, Math.round(sx / 2) * 2, L.HUD + Math.round(sy / 2) * 2, L.W, L.AH); ctx.restore();
    } else {
      ctx.save(); ctx.beginPath(); ctx.rect(0, L.HUD, L.W, L.AH); ctx.clip();
      ctx.translate(sx, L.HUD + sy);
      R.render.world(ctx, S, P, g.time);
      ctx.restore();
    }
  }

  // ---------- HUD ----------
  function hud(g, ctx, S, P) {
    var L = R.logic, W = L.W, K = L.K, i;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, L.HUD);
    ctx.fillStyle = P.line; ctx.fillRect(0, L.HUD - (P.pixel ? 2 : 1), W, P.pixel ? 2 : 1);
    txt(g, up(P, g.t('score')) + ' ' + S.score, 8, 17, { size: 13, color: P.ink, weight: 800 }, P);
    txt(g, up(P, g.t('level')) + ' ' + S.wave + '/' + S.maxWave, W / 2, 17, { size: 13, align: 'center', color: P.accent, weight: 800 }, P);
    txt(g, up(P, g.t('best')) + ' ' + Math.max(g.state.best || 0, S.score), W - 8, 17, { size: 11, align: 'right', color: P.muted, weight: 600 }, P);
    // жизни — огоньки фонаря
    var hearts = ''; for (i = 0; i < Math.max(0, S.lives); i++) hearts += '♥';
    txt(g, hearts, 8, 35, { size: 13, color: P.bad, weight: 800 }, P);
    // прочность маяка — ячейки
    var cw = 16, cx0 = W / 2 - (S.coreMax * (cw + 3)) / 2 + 24;
    txt(g, up(P, '☼'), cx0 - 14, 35, { size: 13, align: 'center', color: P.lamp, weight: 800 }, P);
    for (i = 0; i < S.coreMax; i++) { ctx.fillStyle = i < S.coreHp ? (S.coreHp <= 2 ? P.bad : P.lamp) : P.barBg; ctx.fillRect(cx0 + i * (cw + 3), 28, cw, 8); }
    // заряд вспышки и опоры
    var ready = S.charge >= K.CHARGE_MAX;
    bar(ctx, W - 74, 29, 60, 7, S.charge / K.CHARGE_MAX, ready ? P.flare : P.accent, P);
    txt(g, '✦', W - 84, 35, { size: 12, align: 'right', color: ready ? P.flare : P.muted, weight: 800 }, P);
    var pp = ''; for (i = 0; i < S.maxP; i++) pp += i < S.pylons.length ? '◆' : '◇';
    txt(g, pp, W - 100, 35, { size: 11, align: 'right', color: P.pylon, weight: 700 }, P);
    var B = S.boss;
    if (B && B.hp > 0) {
      var bw = 280, bx = (W - bw) / 2, by = L.HUD + 8;
      if (!P.pixel) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(bx - 6, by - 4, bw + 12, 24); }
      bar(ctx, bx, by + 10, bw, 6, B.hp / B.max, P.boss, P);
      txt(g, up(P, g.t('b_eater')), W / 2, by + 7, { size: 10, align: 'center', color: P.ink, weight: 800 }, P);
    }
    if (S.mult > 1) txt(g, '×' + S.mult, W - 10, L.HUD + (B && B.hp > 0 ? 44 : 22), { size: 15, align: 'right', color: P.accent, weight: 900 }, P);
  }

  // ---------- Баннеры ----------
  function banners(g, ctx, S, P) {
    var L = R.logic, W = L.W, H = L.SCREEN_H, i;
    if (S.phase === 'intro') {
      var a = Math.min(1, S.introT * 1.6, (2.4 - S.introT) * 3 + 0.2);
      ctx.globalAlpha = Math.max(0, a);
      panel(ctx, 50, 230, W - 100, 100, P, P.accent);
      txt(g, up(P, g.t('wave')) + ' ' + S.wave, W / 2, 272, { size: 30, align: 'center', color: P.accent, weight: 900 }, P);
      txt(g, S.wave === S.maxWave ? up(P, g.t('b_eater')) : g.t('introSub'), W / 2, 304, { size: S.wave === S.maxWave ? 15 : 11, align: 'center', color: S.wave === S.maxWave ? P.boss : P.muted, weight: 700, shadow: false, maxWidth: W - 130 }, P);
      ctx.globalAlpha = 1;
    }
    if (S.phase === 'clear' && S.wave < S.maxWave) {
      var n = 3 + S.upg.length;
      panel(ctx, 50, 210, W - 100, 60 + n * 26, P, P.good);
      txt(g, up(P, g.t('clear')), W / 2, 246, { size: 22, align: 'center', color: P.good, weight: 900, maxWidth: W - 120 }, P);
      txt(g, g.t('bonus') + ': +' + S.bonus, W / 2, 276, { size: 14, align: 'center', color: P.ink, weight: 700 }, P);
      txt(g, g.t('repair'), W / 2, 302, { size: 13, align: 'center', color: P.lamp, weight: 700 }, P);
      S.upg.forEach(function (u, k) { txt(g, '▲ ' + g.t('u_' + u), W / 2, 328 + k * 26, { size: 14, align: 'center', color: P.accent, weight: 800 }, P); });
      if (S.hold) txt(g, g.t('cardNext'), W / 2, 330 + S.upg.length * 26, { size: 12, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
    }
    if (S.hint && S.phase !== 'clear') {
      ctx.save(); ctx.font = '700 12px ' + P.font; var lines = wrap(ctx, g.t('h_' + S.hint.k), W - 70); ctx.restore();
      var hh = 14 + lines.length * 17, y0 = H - hh - 12; ctx.globalAlpha = Math.min(1, S.hint.t * 2);
      panel(ctx, 24, y0, W - 48, hh, P, P.line);
      lines.forEach(function (ln, k) { txt(g, ln, W / 2, y0 + 20 + k * 17, { size: 12, align: 'center', color: P.ink, weight: 700, shadow: false }, P); });
      ctx.globalAlpha = 1;
    }
  }
  function toasts(g, ctx, S, P, list) {
    list.forEach(function (o) {
      var y = o.y + R.logic.HUD - (1.3 - o.t) * 26;
      ctx.globalAlpha = Math.min(1, o.t * 2);
      txt(g, up(P, o.text), o.x, y, { size: o.big ? 15 : 11, align: 'center', color: o.color, weight: 800, maxWidth: 300 }, P);
      ctx.globalAlpha = 1;
    });
  }

  function render(g, ctx, S, P, o) {
    o = o || {};
    sync(g, S);
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, g.W, g.H);
    world(g, ctx, S, P, o.shake || 0);
    if (!o.bare) { toasts(g, ctx, S, P, o.toasts || []); hud(g, ctx, S, P); banners(g, ctx, S, P); }
  }

  R.ui = {
    init: function (g) { var f = function () { fit(g); }; addEventListener('resize', f); f(); setTimeout(f, 50); sync(g, null); },
    fit: fit, sync: sync, txt: txt, panel: panel, up: up, world: world, render: render
  };
})(typeof window !== 'undefined' ? window : globalThis);
