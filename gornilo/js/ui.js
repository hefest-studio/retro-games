/* ГОРНИЛО · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема) и конвейер кадра —
   арена (retro — в буфер половинного размера и ×2 без сглаживания), HUD, баннеры круга/волны/босса, карта горнила
   при переходе между комнатами, окно «Продолжить?», всплывающие надписи. Тексты — только через g.t(). GORNILO.ui */
(function (global) {
  'use strict';
  var G = global.GORNILO = global.GORNILO || {};
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, pad = document.querySelector('.pad');
    var padH = pad && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 16 : 0;
    var availW = Math.min(innerWidth - 16, 960), availH = innerHeight - padH - 70;
    var w = Math.max(280, Math.floor(Math.min(availW, availH * g.W / g.H)));
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
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 20; G.render.rrect(ctx, x, y, w, h, 12, P.panel); ctx.restore();
      ctx.strokeStyle = edge || P.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.rect(x + 0.75, y + 0.75, w - 1.5, h - 1.5); ctx.stroke();
    }
  }
  function bar(ctx, x, y, w, h, f, col, P) {
    ctx.fillStyle = P.barBg; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col; ctx.fillRect(x, y, P.pixel ? Math.round(w * Math.max(0, f) / 4) * 4 : w * Math.max(0, Math.min(1, f)), h);
  }

  // ---------- Арена ----------
  var buf = null, bctx = null;
  function world(g, ctx, S, P, shake) {
    var L = G.logic, sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0, time = g.time;
    if (P.pixel) {
      if (!buf) { buf = document.createElement('canvas'); buf.width = L.W / 2; buf.height = L.H / 2; bctx = buf.getContext('2d'); }
      bctx.setTransform(0.5, 0, 0, 0.5, 0, 0); bctx.imageSmoothingEnabled = false;
      bctx.fillStyle = '#000'; bctx.fillRect(0, 0, L.W, L.H);
      G.render.world(bctx, S, P, time);
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(buf, Math.round(sx / 2) * 2, L.HUD + Math.round(sy / 2) * 2, L.W, L.H); ctx.restore();
    } else {
      ctx.save(); ctx.beginPath(); ctx.rect(0, L.HUD, L.W, L.H); ctx.clip();
      ctx.translate(sx, L.HUD + sy);
      G.render.world(ctx, S, P, time);
      ctx.restore();
    }
  }

  // ---------- HUD ----------
  function heroInfo(g, ctx, S, P, h, x, al) {
    var two = S.heroes.length === 2, s = (two ? g.t('p' + (h.id + 1)) + ' ' : '') + (h.out ? g.t('out') : '♥' + Math.max(0, h.lives));
    var wn = h.weapon !== 'base' ? g.t('w_' + h.weapon) : (h.hammers > 0 ? g.t('w_hammers') : h.ring > 0 ? g.t('w_ring') : g.t('w_base'));
    txt(g, up(P, s), x, 14, { size: 12, align: al, color: P.hero[h.id], weight: 800 }, P);
    txt(g, up(P, wn), x, 27, { size: 10, align: al, color: P.muted, weight: 700, shadow: false }, P);
    var f = h.weapon !== 'base' ? h.wT / G.logic.POWER_T : h.hammers > 0 ? h.hammers / G.logic.AUX.hammers.t : h.ring > 0 ? h.ring / G.logic.AUX.ring.t : 0;
    if (f > 0) bar(ctx, al === 'right' ? x - 50 : x + 74, 21, 50, 5, f, P.hero[h.id], P);
  }
  function hud(g, ctx, S, P) {
    var L = G.logic, W = L.W;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, L.HUD);
    ctx.fillStyle = P.line; ctx.fillRect(0, L.HUD - (P.pixel ? 2 : 1), W, P.pixel ? 2 : 1);
    txt(g, up(P, g.t('score')) + ' ' + S.score, 10, 21, { size: 14, color: P.ink, weight: 800 }, P);
    heroInfo(g, ctx, S, P, S.heroes[0], 160, 'left');
    var rn = S.room && S.room.kind === 'boss' ? g.t('k_boss') : g.t('roomShort') + ' ' + S.roomNo + '/' + L.LAYERS;
    txt(g, up(P, g.t('stageShort')) + ' ' + S.stage + '/' + S.maxStage + ' · ' + up(P, rn), W / 2 + 40, 21, { size: 12, align: 'center', color: P.accent, weight: 800 }, P);
    if (S.heroes[1]) heroInfo(g, ctx, S, P, S.heroes[1], W - 120, 'right');
    txt(g, up(P, g.t('best')) + ' ' + Math.max(g.state.best || 0, S.score), W - 10, 21, { size: 11, align: 'right', color: P.muted, weight: 700 }, P);
    var B = S.boss;
    if (B && !B.dead && B.intro <= 0) {
      var bw = 300, bx = (W - bw) / 2, by = L.HUD + 6, tot = 0, cur = 0;
      B.parts.forEach(function (p) { tot += p.max; cur += Math.max(0, p.hp); }); tot += B.max; cur += Math.max(0, B.hp);
      if (!P.pixel) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(bx - 6, by - 2, bw + 12, 22); }
      bar(ctx, bx, by + 12, bw, 5, cur / tot, P.markEdge, P);
      txt(g, up(P, g.t('b_' + B.key)), W / 2, by + 9, { size: 10, align: 'center', color: P.ink, weight: 800 }, P);
    }
  }

  // ---------- Баннеры и карта ----------
  function banners(g, ctx, S, P) {
    var L = G.logic, W = L.W, cy = L.HUD + L.H / 2;
    if (S.banner > 0 && S.phase === 'play') {
      ctx.globalAlpha = Math.min(1, S.banner * 2);
      panel(ctx, 150, cy - 70, W - 300, 110, P, P.accent);
      txt(g, up(P, g.t('stage')) + ' ' + S.stage, W / 2, cy - 40, { size: 14, align: 'center', color: P.muted, weight: 800 }, P);
      txt(g, up(P, g.t('s_' + S.stage)), W / 2, cy - 8, { size: 28, align: 'center', color: P.accent, weight: 900 }, P);
      txt(g, g.t('introSub'), W / 2, cy + 18, { size: 11, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
      ctx.globalAlpha = 1;
    }
    var B = S.boss;
    if (B && B.intro > 0 && S.phase === 'play') {
      panel(ctx, 160, cy - 50, W - 320, 84, P, P.markEdge);
      txt(g, up(P, g.t('b_' + B.key)), W / 2, cy - 12, { size: 26, align: 'center', color: P.markEdge, weight: 900 }, P);
      txt(g, g.t('bossSub'), W / 2, cy + 14, { size: 11, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
    }
    if (S.phase === 'play' && S.roomState === 'cleared' && S.roomT < 99) {
      var k = S.room.exits ? Object.keys(S.room.exits).length : 0;
      txt(g, up(P, g.t('cleared')), W / 2, L.HUD + 118, { size: 18, align: 'center', color: P.good, weight: 900 }, P);
      if (k) txt(g, g.t('choose') + ' (' + k + ')', W / 2, L.HUD + 138, { size: 12, align: 'center', color: P.muted, weight: 700 }, P);
    }
    if (S.phase === 'trans') {
      ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.75)' : 'rgba(8,8,12,.72)'; ctx.fillRect(0, L.HUD, W, L.H);
      var pw = 300, ph = 400, px = (W - pw) / 2, py = L.HUD + 40;
      panel(ctx, px, py, pw, ph, P, P.accent);
      txt(g, up(P, g.t('mapTitle')), W / 2, py + 26, { size: 15, align: 'center', color: P.accent, weight: 900 }, P);
      G.render.map(ctx, S, P, px + 30, py + 38, pw - 60, ph - 70, g.time, g);
      var nr = S.next && L.roomAt(S.map, S.next.l, S.next.c);
      if (nr) txt(g, g.t('k_' + nr.kind) + (nr.reward ? ' · ' + g.t('r_' + nr.reward) : ''), W / 2, py + ph - 14, { size: 12, align: 'center', color: P.ink, weight: 700, shadow: false }, P);
    }
    if (S.phase === 'clear') {
      panel(ctx, 160, cy - 60, W - 320, 110, P, P.good);
      txt(g, up(P, g.t('clear')), W / 2, cy - 22, { size: 24, align: 'center', color: P.good, weight: 900 }, P);
      txt(g, g.t('bonus') + ': ' + (G.logic.SCORE.stage * S.stage), W / 2, cy + 10, { size: 14, align: 'center', color: P.accent, weight: 700 }, P);
    }
    if (S.phase === 'cont') {
      ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.6)' : 'rgba(8,10,14,.6)'; ctx.fillRect(0, L.HUD, W, L.H);
      panel(ctx, 170, cy - 80, W - 340, 150, P, P.warn);
      txt(g, up(P, g.t('cont')), W / 2, cy - 42, { size: 24, align: 'center', color: P.warn, weight: 900 }, P);
      txt(g, String(Math.ceil(S.contT)), W / 2, cy + 10, { size: 44, align: 'center', color: P.ink, weight: 900 }, P);
      txt(g, g.t('contHint'), W / 2, cy + 38, { size: 12, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
      txt(g, g.t('contLeft') + ': ' + S.continues, W / 2, cy + 58, { size: 11, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
    }
  }
  function toasts(g, ctx, S, P, list) {
    list.forEach(function (o) {
      var y = o.y + G.logic.HUD - (1.3 - o.t) * 26;
      ctx.globalAlpha = Math.min(1, o.t * 2);
      txt(g, up(P, o.text), o.x, y, { size: o.big ? 16 : 11, align: 'center', color: o.color, weight: 800 }, P);
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

  G.ui = {
    init: function (g) { var f = function () { fit(g); }; addEventListener('resize', f); f(); setTimeout(f, 50); sync(g); },
    fit: fit, sync: sync, txt: txt, panel: panel, up: up, world: world, render: render
  };
})(typeof window !== 'undefined' ? window : globalThis);
