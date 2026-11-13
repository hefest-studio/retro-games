/* УГОЛЁК · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема, тач-кнопки карты/паузы)
   и общие для обеих тем элементы на канве — HUD, карта шахты, баннеры, всплывающие подписи.
   Палитру P передаёт активный рендерер (modern/classic), тексты — только через g.t(). UGOLYOK.ui */
(function (global) {
  'use strict';
  var U = global.UGOLYOK = global.UGOLYOK || {};
  var T = 32, OY = 36;
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, wrap = c.parentElement;
    var pad = document.querySelector('.pad'), cs = pad && getComputedStyle(pad), padH = cs && cs.display !== 'none' && cs.position !== 'fixed' ? pad.offsetHeight + 16 : 0;
    var availH = innerHeight - padH - (padH ? 70 : 40);
    var w = Math.min(1000, (wrap && wrap.clientWidth) || g.W, availH * g.W / g.H);
    w = Math.max(280, Math.floor(w));
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
    if (P.pixel) ctx.fillRect(x, y, Math.round(w * f / 2) * 2, h); else { roundRect(ctx, x, y, Math.max(h, w * f), h, h / 2); ctx.fill(); }
  }
  function clock(t) { t = Math.max(0, Math.floor(t)); var m = Math.floor(t / 60), s = t % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function panel(ctx, x, y, w, h, P, col) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = col || P.line; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3); ctx.fillRect(x, y, 3, h); ctx.fillRect(x + w - 3, y, 3, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 24;
      ctx.fillStyle = P.panelA; roundRect(ctx, x, y, w, h, 14); ctx.fill(); ctx.restore();
      ctx.strokeStyle = col || P.line; ctx.lineWidth = 1.5; roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 14); ctx.stroke();
    }
  }

  // HUD: жизни, каска | уголь N/всего + ключи + зона | время и счёт
  function hud(g, ctx, S, P, R) {
    var W = g.W, L = U.logic;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, OY);
    ctx.fillStyle = P.hudLine; ctx.fillRect(0, OY - 2, W, 2);
    var nl = Math.min(6, Math.max(3, S.lives));
    for (var i = 0; i < nl; i++) R.lifeIcon(ctx, 16 + i * 20, 17, i < S.lives);
    if (S.lives > 6) txt(g, '×' + S.lives, 16 + 6 * 20 - 4, 22, { size: 11, color: P.ink }, P);
    if (S.helmet > 0) {
      R.helmetIcon(ctx, 150, 18, S.time);
      bar(ctx, 164, 14, 50, 7, S.helmet / L.HELMET_T, S.helmet < 2.5 && Math.floor(S.time * 6) % 2 ? P.warn : P.helmet, P);
    }
    // уголь
    var cx = W / 2 - 60;
    R.coalIcon(ctx, cx, 15, 7, S.time);
    txt(g, S.coal + '/' + S.total, cx + 12, 20, { size: 13, color: S.gate ? P.good : P.ink, weight: 800 }, P);
    for (var k = 1; k <= L.KEYS; k++) R.keyIcon(ctx, W / 2 + 40 + (k - 1) * 22, 15, k, !!S.keys[k]);
    var rm = L.world().rooms[S.room];
    txt(g, up(P, g.t('z_' + L.ZONES[rm.zone])), W / 2, 32, { size: 9, align: 'center', color: P.muted, weight: 700 }, P);
    txt(g, clock(S.time), W - 10, 15, { size: 12, align: 'right', color: P.ink }, P);
    txt(g, String(S.score), W - 10, 30, { size: 12, align: 'right', color: P.accent }, P);
  }

  // Баннеры: гибель, старт
  function banner(g, ctx, S, P, opts) {
    var title = null, sub = null, col = P.ink;
    if (S.phase === 'dead') { title = g.t('lost'); sub = (S.lives > 0 ? g.t('lives') + ': ' + S.lives + ' · ' + g.t('back2') : ''); col = P.bad; if (opts && opts.why) sub = g.t('why_' + opts.why) + (sub ? ' · ' + sub : ''); }
    else if (opts && opts.intro > 0) { title = g.t('z_shop'); sub = g.t('start'); col = P.accent; }
    if (!title) return;
    var w = 460, h = 64, x = (g.W - w) / 2, y = OY + 112;
    panel(ctx, x, y, w, h, P, col);
    txt(g, up(P, title), g.W / 2, y + 28, { size: P.pixel ? 15 : 19, align: 'center', color: col }, P);
    if (sub) txt(g, up(P, sub), g.W / 2, y + 49, { size: P.pixel ? 8 : 11, align: 'center', color: P.muted, weight: 600 }, P);
  }
  function toasts(g, ctx, list, P) {
    for (var i = 0; i < list.length; i++) {
      var o = list[i], a = Math.min(1, o.t / 0.4);
      ctx.globalAlpha = a;
      txt(g, up(P, o.text), o.x, o.y - (o.life - o.t) * 18, { size: o.big ? (P.pixel ? 12 : 15) : (P.pixel ? 9 : 12), align: 'center', color: o.color, weight: 900 }, P);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Карта шахты: открытые экраны, остаток угля, двери, маяки ----------
  function mapOverlay(g, ctx, S, P, R, game) {
    var L = U.logic, Wd = L.world(), W = g.W, H = g.H;
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.88)' : 'rgba(6,5,8,.86)'; ctx.fillRect(0, 0, W, H);
    var cw = 62, ch = 44, gw = L.WX * cw, gh = L.WY * ch, x0 = (W - gw) / 2, y0 = 70;
    panel(ctx, x0 - 18, y0 - 48, gw + 36, gh + 88, P);
    var nv = 0; for (var q in S.visited) nv++;
    txt(g, up(P, g.t('map')), x0, y0 - 20, { size: P.pixel ? 13 : 16, color: P.accent }, P);
    txt(g, g.t('coal') + ' ' + S.coal + '/' + S.total + ' · ' + nv + '/' + Wd.rooms.length + ' ' + g.t('rooms'), x0 + gw, y0 - 20, { size: 11, align: 'right', color: P.muted, weight: 700 }, P);
    var known = function (rm) { return !!S.visited[rm.i]; }, seenAdj = {};
    Wd.rooms.forEach(function (rm) { if (!known(rm)) return; ['L', 'R', 'U', 'D'].forEach(function (d) { if (rm.c[d]) seenAdj[rm.c[d].to] = 1; }); });
    // связи
    Wd.rooms.forEach(function (rm) {
      if (!known(rm) && !(rm.c.R && known(Wd.rooms[rm.c.R.to])) && !(rm.c.D && known(Wd.rooms[rm.c.D.to]))) return;
      var cx = x0 + rm.x * cw + cw / 2, cy = y0 + rm.y * ch + ch / 2;
      if (rm.c.R) {
        var kd = rm.c.R.key;
        ctx.fillStyle = kd ? (S.keys[kd] ? P.good : R.KC[kd]) : P.mapLine;
        ctx.fillRect(cx + cw / 2 - 9, cy - 2, 18, kd ? 6 : 4);
        if (kd && !S.keys[kd]) { ctx.fillStyle = P.panel; ctx.fillRect(cx + cw / 2 - 2, cy - 1, 4, 4); }
      }
      if (rm.c.D) { ctx.fillStyle = P.mapLine; ctx.fillRect(cx - 2, cy + ch / 2 - 8, 4, 16); }
    });
    // экраны
    Wd.rooms.forEach(function (rm) {
      var x = x0 + rm.x * cw + 6, y = y0 + rm.y * ch + 6, w = cw - 12, h = ch - 12;
      if (known(rm)) {
        ctx.fillStyle = P.zoneMap[rm.zone];
        if (P.pixel) ctx.fillRect(x, y, w, h); else { roundRect(ctx, x, y, w, h, 5); ctx.fill(); }
        var left = game ? game.roomLeft(rm) : 0;
        if (left) { R.coalIcon(ctx, x + 12, y + h / 2, 5, S.time); txt(g, String(left), x + 21, y + h / 2 + 4, { size: 11, color: P.ink, weight: 800 }, P); }
        else txt(g, '✓', x + w / 2 - (rm.kind === 'b' || rm.kind === 'S' ? 8 : 0), y + h / 2 + 4, { size: 11, align: 'center', color: P.good, weight: 800 }, P);
        rm.items.forEach(function (it) {
          if (it.k === 'beacon') { ctx.fillStyle = S.cp.id === it.id ? P.good : P.beaconMap; ctx.beginPath(); ctx.moveTo(x + w - 7, y + 4); ctx.lineTo(x + w - 3, y + 11); ctx.lineTo(x + w - 11, y + 11); ctx.closePath(); ctx.fill(); }
          if (it.k === 'forge') { ctx.fillStyle = S.gate ? P.accent : P.dim; ctx.fillRect(x + 3, y + 3, 8, 8); }
          if (it.k === 'key' && !S.got[it.id]) R.keyIcon(ctx, x + w - 9, y + h - 6, it.key, true, 0.6);
          if (it.k === 'helmet' && !S.got[it.id]) { ctx.fillStyle = P.helmet; ctx.fillRect(x + w - 13, y + h - 8, 9, 4); }
        });
      } else if (seenAdj[rm.i]) {
        ctx.strokeStyle = P.mapDim; ctx.lineWidth = 1; ctx.setLineDash(P.pixel ? [] : [3, 3]);
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); ctx.setLineDash([]);
        txt(g, '?', x + w / 2, y + h / 2 + 4, { size: 11, align: 'center', color: P.mapDim, weight: 800 }, P);
      }
      if (rm.i === S.room && Math.floor(S.time * 3) % 2 === 0) {
        var hx = x + S.hero.x / L.COLS * w, hy = y + (S.hero.y - 0.7) / L.ROWS * h;
        ctx.fillStyle = P.ink; ctx.fillRect(hx - 2, hy - 2, 4, 4);
        ctx.strokeStyle = P.accent; ctx.lineWidth = 2; ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
      }
    });
    txt(g, g.t('mapLegend'), x0, y0 + gh + 22, { size: 10, color: P.muted, weight: 600 }, P);
    txt(g, g.t('mapHint'), x0 + gw, y0 + gh + 22, { size: 10, align: 'right', color: P.muted, weight: 600 }, P);
  }

  U.ui = {
    T: T, OY: OY,
    init: function (g, acts) {
      fit(g); addEventListener('resize', function () { fit(g); });
      sync(g); setInterval(function () { sync(g); }, 250);
      function btn(id, fn) {
        var b = $(id); if (!b) return;
        var h = function (e) { e.preventDefault(); e.stopPropagation(); fn(); };
        b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h);
      }
      btn('bPause', function () { if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });
      btn('bMap', acts.map);
    },
    fit: fit, sync: sync, roundRect: roundRect, txt: txt, up: up, bar: bar, clock: clock, panel: panel, hud: hud, banner: banner, toasts: toasts, mapOverlay: mapOverlay
  };
})(typeof window !== 'undefined' ? window : globalThis);
