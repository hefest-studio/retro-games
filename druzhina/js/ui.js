/* ДРУЖИНА · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема) и конвейер кадра —
   мир (js/render.js; в retro — через буфер 320×180 с крупным пикселем), HUD, баннеры, полоса босса,
   «ВПЕРЁД →», экран выбора героя, «продолжить?», всплывающие подписи. Тексты — только через g.t(). DRUZHINA.ui */
(function (global) {
  'use strict';
  var D = global.DRUZHINA = global.DRUZHINA || {};
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, pad = document.querySelector('.pad');
    var padH = pad && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 16 : 0;
    var availW = Math.min(innerWidth - 16, 960), availH = innerHeight - padH - 64;
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
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function txt(g, s, x, y, o, P) {
    o = o || {}; o.font = P.font;
    if (o.shadow !== false) { var c = o.color; o.color = P.pixel ? '#000000' : 'rgba(0,0,0,.6)'; g.text(s, x + (P.pixel ? 2 : 1), y + 2, o); o.color = c; }
    g.text(s, x, y, o);
  }
  function up(P, s) { return P.pixel ? String(s).toUpperCase() : String(s); }
  function panel(ctx, x, y, w, h, P, edge) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = edge || P.line; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3); ctx.fillRect(x, y, 3, h); ctx.fillRect(x + w - 3, y, 3, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 22; ctx.fillStyle = P.panel;
      roundRect(ctx, x, y, w, h, 14); ctx.fill(); ctx.restore();
      ctx.strokeStyle = edge || P.line; ctx.lineWidth = 1.5; roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 14); ctx.stroke();
    }
  }
  function bar(ctx, x, y, w, h, f, col, P, segs) {
    f = Math.max(0, Math.min(1, f));
    ctx.fillStyle = P.barBg;
    if (P.pixel) { ctx.fillRect(x, y, w, h); ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * f / 3) * 3, h); }
    else { roundRect(ctx, x, y, w, h, h / 2); ctx.fill(); if (f > 0) { ctx.fillStyle = col; roundRect(ctx, x, y, Math.max(h, w * f), h, h / 2); ctx.fill(); } }
    if (segs) { ctx.fillStyle = P.pixel ? '#000' : 'rgba(0,0,0,.35)'; for (var i = 1; i < segs; i++) ctx.fillRect(x + Math.round(w * i / segs), y, P.pixel ? 2 : 1, h); }
  }

  // ---------- Мир (retro — через буфер) ----------
  var buf = null, bctx = null;
  function drawWorld(g, ctx, S, P, o) {
    if (P.pixel && typeof document !== 'undefined') {
      var sc = P.scale || 3, w = Math.round(g.W / sc), h = Math.round(g.H / sc);
      if (!buf) { buf = document.createElement('canvas'); buf.width = w; buf.height = h; bctx = buf.getContext('2d'); }
      bctx.setTransform(1 / sc, 0, 0, 1 / sc, 0, 0); bctx.imageSmoothingEnabled = false;
      D.render.world(bctx, S, P, o);
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(buf, 0, 0, w, h, 0, 0, g.W, g.H); ctx.restore();
    } else D.render.world(ctx, S, P, o);
  }

  // ---------- HUD ----------
  function jugIcon(ctx, x, y, on, P) {
    var c = on ? (P.pixel ? '#41a6f6' : '#4a86e8') : P.barBg;
    ctx.fillStyle = c; ctx.fillRect(x - 3, y - 9, 6, 3);
    if (P.pixel) ctx.fillRect(x - 5, y - 6, 10, 9); else { ctx.beginPath(); ctx.ellipse(x, y - 2, 5, 5.5, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  function heroBlock(g, ctx, S, h, x, P) {
    var L = D.logic, dim = h.out, col = dim ? P.muted : P.hero[h.hero];
    // значок
    ctx.fillStyle = col; if (P.pixel) ctx.fillRect(x, 8, 34, 34); else { ctx.beginPath(); ctx.arc(x + 17, 25, 17, 0, Math.PI * 2); ctx.fill(); }
    txt(g, g.t('h_' + h.hero).charAt(0), x + 17, 33, { size: 20, align: 'center', color: '#15161a', weight: 900, shadow: false }, P);
    var name = (S.players === 2 ? g.t(h.pi ? 'p2' : 'p1') + ' · ' : '') + g.t('h_' + h.hero);
    txt(g, up(P, name), x + 42, 17, { size: 12, color: col, weight: 800, shadow: false }, P);
    txt(g, '×' + Math.max(0, h.lives), x + 200, 17, { size: 12, align: 'right', color: P.ink, weight: 800, shadow: false }, P);
    var f = h.hp / h.max;
    bar(ctx, x + 42, 23, 158, 9, dim ? 0 : f, f > 0.5 ? P.good : f > 0.25 ? P.warn : P.bad, P, 8);
    // кувшины и уровень магии
    var lvl = 0, costs = h.def.magic.costs; for (var i = 0; i < costs.length; i++) if (h.jugs >= costs[i]) lvl = i + 1;
    for (var j = 0; j < L.JUG_MAX; j++) jugIcon(ctx, x + 48 + j * 13, 49, j < h.jugs, P);
    txt(g, lvl ? g.t('lvl') + lvl : '', x + 200, 50, { size: 11, align: 'right', color: lvl ? P.magic : P.muted, weight: 900, shadow: false }, P);
  }
  function hud(g, ctx, S, P) {
    var L = D.logic, W = g.W, H = L.HUD;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = P.line; ctx.fillRect(0, H - 2, W, 2);
    S.heroes.forEach(function (h, i) { heroBlock(g, ctx, S, h, 10 + i * 250, P); });
    var scx = S.players === 2 ? W - 250 : W / 2;
    txt(g, String(S.score), scx, 30, { size: 22, align: 'center', color: P.accent, shadow: false }, P);
    txt(g, up(P, g.t('score')), scx, 46, { size: 10, align: 'center', color: P.muted, weight: 700, shadow: false }, P);
    var rx = W - 12;
    txt(g, up(P, g.t('stageShort')) + ' ' + S.stage + '/' + S.maxStage, rx, 22, { size: 13, align: 'right', color: P.ink, shadow: false }, P);
    txt(g, up(P, g.t('s_' + S.key)), rx, 40, { size: 11, align: 'right', color: P.muted, weight: 700, shadow: false }, P);
  }

  // ---------- Баннеры и оверлеи ----------
  function banner(g, ctx, P, title, sub, col, y) {
    var w = 600, h = 80, x = (g.W - w) / 2; y = y || 130;
    panel(ctx, x, y, w, h, P, col);
    txt(g, up(P, title), g.W / 2, y + 38, { size: P.pixel ? 22 : 26, align: 'center', color: col }, P);
    txt(g, up(P, sub), g.W / 2, y + 62, { size: P.pixel ? 10 : 12, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
  }
  function overlays(g, ctx, S, P) {
    var L = D.logic, bosses = S.foes.filter(function (f) { return f.kind === 'boss' && f.alive; });
    if (bosses.length) {
      var hp = 0, mx = 0; bosses.forEach(function (b) { hp += Math.max(0, b.hp); mx += b.max; });
      var B = bosses[0], bw = 420, bx = (g.W - bw) / 2, by = L.HUD + 16;
      txt(g, up(P, g.t('b_' + B.type)) + (B.def.phases && B.stage ? '  ·  ' + up(P, g.t('phase')) + ' ' + B.stage : ''), g.W / 2, by + 2, { size: 12, align: 'center', color: P.boss, weight: 800 }, P);
      bar(ctx, bx, by + 8, bw, 9, hp / mx, P.boss, P);
      if (B.intro > 0) { ctx.globalAlpha = Math.min(1, B.intro / 0.4); banner(g, ctx, P, g.t('b_' + B.type), g.t('bossSub'), P.boss, 150); ctx.globalAlpha = 1; }
    }
    if (S.phase === 'play' && S.banner > 0 && !S.bonus) {
      ctx.globalAlpha = Math.min(1, S.banner / 0.4);
      banner(g, ctx, P, g.t('stage') + ' ' + S.stage + ' · ' + g.t('s_' + S.key), g.t('introSub'), P.accent);
      ctx.globalAlpha = 1;
    }
    if (S.phase === 'bonus') {
      if (S.banner > 0) { ctx.globalAlpha = Math.min(1, S.banner / 0.4); banner(g, ctx, P, g.t('camp'), g.t('campSub'), P.magic); ctx.globalAlpha = 1; }
      txt(g, String(Math.max(0, Math.ceil(S.bonusT))), g.W / 2, L.HUD + 40, { size: 28, align: 'center', color: P.magic }, P);
    }
    if (S.phase === 'clear') banner(g, ctx, P, g.t('clear'), g.t('bonus') + ' +' + (S.lastBonus || 0), P.good);
    if (S.go > 0 && S.lock == null && S.phase === 'play' && Math.floor(S.time * 3) % 2) {
      var ax = g.W - 120, ay = L.FLOOR_TOP - 120;
      txt(g, up(P, g.t('go')), ax, ay, { size: 26, align: 'center', color: P.accent, weight: 900 }, P);
      ctx.fillStyle = P.accent; ctx.beginPath(); ctx.moveTo(ax + 60, ay - 28); ctx.lineTo(ax + 90, ay - 9); ctx.lineTo(ax + 60, ay + 10); ctx.closePath(); ctx.fill();
    }
    if (S.players === 2) S.heroes.forEach(function (h) {
      if (h.out && S.phase !== 'continue') txt(g, g.t(h.pi ? 'p2' : 'p1') + ' ' + g.t('out'), h.pi ? g.W - 16 : 16, g.H - 12, { size: 12, align: h.pi ? 'right' : 'left', color: P.bad, weight: 700 }, P);
    });
    // подписи И1/И2 над головами в коопе
    if (S.players === 2) S.heroes.forEach(function (h) {
      if (h.out || h.state === 'dead') return;
      txt(g, g.t(h.pi ? 'p2' : 'p1'), h.x - S.cam, L.FLOOR_TOP + h.z - h.h - (h.mount ? 175 : 140), { size: 11, align: 'center', color: P.hero[h.hero], weight: 900 }, P);
    });
    if (S.phase === 'continue') {
      ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.7)' : 'rgba(8,8,12,.7)'; ctx.fillRect(0, 0, g.W, g.H);
      txt(g, up(P, g.t('cont')), g.W / 2, 220, { size: 44, align: 'center', color: P.accent, weight: 900 }, P);
      txt(g, String(Math.max(0, Math.floor(S.contT))), g.W / 2, 310, { size: 72, align: 'center', color: P.ink, weight: 900 }, P);
      txt(g, g.t('contSub') + ' · ' + g.t('contLeft') + ': ' + S.continues, g.W / 2, 360, { size: 14, align: 'center', color: P.muted, weight: 700 }, P);
    }
  }
  function toasts(g, ctx, list, S, P) {
    var L = D.logic;
    for (var i = 0; i < list.length; i++) {
      var t = list[i]; ctx.globalAlpha = Math.min(1, t.t / 0.4);
      txt(g, up(P, t.text), t.x - S.cam, L.FLOOR_TOP + t.z - 130 - (1.3 - t.t) * 26, { size: 13, align: 'center', color: t.color, weight: 900 }, P);
    }
    ctx.globalAlpha = 1;
  }
  function render(g, ctx, S, P, o) {
    o = o || {};
    drawWorld(g, ctx, S, P, o);
    if (o.bare) return;
    hud(g, ctx, S, P);
    overlays(g, ctx, S, P);
    if (o.toasts) toasts(g, ctx, o.toasts, S, P);
  }

  // ---------- Экран выбора героя ----------
  function select(g, ctx, sel, P, t) {
    var L = D.logic, W = g.W, keys = L.HERO_KEYS;
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.6)' : 'rgba(10,10,14,.55)'; ctx.fillRect(0, 0, W, g.H);
    txt(g, up(P, g.t('select')), W / 2, 70, { size: 34, align: 'center', color: P.accent, weight: 900 }, P);
    txt(g, g.t('selHint'), W / 2, 96, { size: 13, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
    keys.forEach(function (k, i) {
      var cw = 270, x = W / 2 + (i - 1) * (cw + 24) - cw / 2, y = 120, ch = 360;
      var who = []; for (var p = 0; p < sel.n; p++) if (sel.cur[p] === i) who.push(p);
      var col = who.length ? P.hero[k] : P.line;
      panel(ctx, x, y, cw, ch, P, col);
      if (P.pixel) { ctx.fillStyle = '#1a1c2c'; ctx.fillRect(x + 12, y + 12, cw - 24, 170); } else { ctx.fillStyle = 'rgba(255,255,255,.04)'; roundRect(ctx, x + 12, y + 12, cw - 24, 170, 10); ctx.fill(); }
      var ready = who.some(function (p) { return sel.ready[p]; });
      D.render.portrait(ctx, P, k, x + cw / 2 - 6, y + 168, 1.45, t + i, ready ? (k === 'olha' ? 'shoot' : 'over') : 'idle');
      txt(g, up(P, g.t('h_' + k)), x + cw / 2, y + 212, { size: 24, align: 'center', color: P.hero[k], weight: 900 }, P);
      txt(g, g.t('r_' + k), x + cw / 2, y + 232, { size: 12, align: 'center', color: P.muted, weight: 700, shadow: false }, P);
      var H = L.HEROES[k], st = [['st_power', { zhdan: 0.95, secha: 0.55, olha: 0.6 }[k]], ['st_speed', H.speed / 190], ['st_reach', { zhdan: 0.55, secha: 0.4, olha: 0.95 }[k]]];
      st.forEach(function (s, j) { txt(g, g.t(s[0]), x + 22, y + 262 + j * 20, { size: 11, color: P.ink, weight: 700, shadow: false }, P); bar(ctx, x + 110, y + 254 + j * 20, cw - 134, 8, s[1], P.hero[k], P); });
      txt(g, g.t('m_' + H.magic.kind), x + cw / 2, y + 330, { size: 12, align: 'center', color: P.magic, weight: 800, shadow: false }, P);
      var dsc = g.t('d_' + k), fs = 10; ctx.font = '600 ' + fs + 'px ' + P.font;
      while (fs > 7 && ctx.measureText(dsc).width > cw - 16) { fs--; ctx.font = '600 ' + fs + 'px ' + P.font; }
      txt(g, dsc, x + cw / 2, y + 348, { size: fs, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
      who.forEach(function (p, q) {
        var tag = (sel.n === 2 ? g.t(p ? 'p2' : 'p1') + ' ' : '') + (sel.ready[p] ? '✔ ' + g.t('ready') : '▲');
        txt(g, up(P, tag), x + cw / 2 + (who.length > 1 ? (q ? 60 : -60) : 0), y + ch + 26, { size: 14, align: 'center', color: sel.ready[p] ? P.good : P.hero[k], weight: 900 }, P);
      });
    });
  }

  D.ui = {
    init: function (g) { fit(g); addEventListener('resize', function () { fit(g); }); sync(g); setInterval(function () { sync(g); }, 250); },
    fit: fit, sync: sync, roundRect: roundRect, txt: txt, up: up, panel: panel, bar: bar, render: render, select: select, drawWorld: drawWorld
  };
})(typeof window !== 'undefined' ? window : globalThis);
