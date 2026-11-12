/* ГЛУБЬ · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема, тач-кнопки крота/карты/паузы)
   и общие для обеих тем элементы на канве — HUD, мини-карта, баннеры, всплывающие подписи.
   Палитру P передаёт активный рендерер (modern/classic), тексты — только через g.t(). GLUB.ui */
(function (global) {
  'use strict';
  var Gb = global.GLUB = global.GLUB || {};
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

  // HUD: энергия, жизни | 8 гнёзд кристаллов + зона | время и счёт
  function hud(g, ctx, S, P, R) {
    var W = g.W;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, OY);
    ctx.fillStyle = P.hudLine; ctx.fillRect(0, OY - 2, W, 2);
    var low = S.energy < 30, ec = low ? (Math.floor(S.time * 6) % 2 ? P.bad : P.warn) : P.good;
    txt(g, up(P, g.t('energy')), 10, 15, { size: 9, color: low ? P.bad : P.muted, weight: 800 }, P);
    bar(ctx, 10, 20, 116, 8, Math.max(0, S.energy) / Gb.logic.EMAX, ec, P);
    for (var i = 0; i < Math.max(3, S.lives); i++) R.lifeIcon(ctx, 146 + i * 20, 17, i < S.lives);
    // кристаллы
    var cx0 = W / 2 - 4 * 22 + 11;
    for (var k = 1; k <= 8; k++) R.crystalIcon(ctx, cx0 + (k - 1) * 22, 13, k, 7, S.crystals.indexOf(k) >= 0, S.time);
    var rm = Gb.logic.world().rooms[S.room];
    txt(g, up(P, g.t('z_' + Gb.logic.ZONES[rm.zone])), W / 2, 31, { size: 9, align: 'center', color: P.muted, weight: 700 }, P);
    // крот
    var mh = S.mole.state === 'home';
    txt(g, up(P, g.t('mole')), 448, 15, { size: 9, color: mh ? P.ink : P.accent, weight: 800 }, P);
    txt(g, up(P, g.t(mh ? 'moleHome' : 'moleOut')), 448, 28, { size: 9, color: P.muted, weight: 600 }, P);
    txt(g, clock(S.time), W - 10, 15, { size: 12, align: 'right', color: P.ink }, P);
    txt(g, String(S.score), W - 10, 30, { size: 12, align: 'right', color: P.accent }, P);
  }

  // Баннеры: гибель, оглушение
  function banner(g, ctx, S, P, opts) {
    var title = null, sub = null, col = P.ink;
    if (S.phase === 'dead') { title = g.t('lost'); sub = S.lives > 0 ? g.t('lives') + ': ' + S.lives + ' · ' + g.t('back2') : ''; col = P.bad; }
    else if (opts && opts.intro > 0) { title = g.t('z_adit'); sub = g.t('start'); col = P.accent; }
    if (!title) return;
    var w = 440, h = 64, x = (g.W - w) / 2, y = OY + 120;
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

  // ---------- Мини-карта: открытые экраны, связи, отметки ----------
  function mapOverlay(g, ctx, S, P, R) {
    var L = Gb.logic, Wd = L.world(), W = g.W, H = g.H;
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.86)' : 'rgba(6,5,10,.84)'; ctx.fillRect(0, 0, W, H);
    var cw = 52, ch = 34, gw = L.WX * cw, gh = L.WY * ch, x0 = (W - gw) / 2, y0 = 66;
    panel(ctx, x0 - 18, y0 - 46, gw + 36, gh + 86, P);
    var nv = 0; for (var q in S.visited) nv++;
    txt(g, up(P, g.t('map')), x0, y0 - 18, { size: P.pixel ? 13 : 16, color: P.accent }, P);
    txt(g, S.crystals.length + '/8 · ' + nv + '/' + Wd.rooms.length + ' ' + g.t('rooms'), x0 + gw, y0 - 18, { size: 11, align: 'right', color: P.muted, weight: 700 }, P);
    var known = function (rm) { return !!S.visited[rm.i]; };
    var seenAdj = {};
    Wd.rooms.forEach(function (rm) { if (!known(rm)) return; ['L', 'R', 'U', 'D'].forEach(function (d) { if (rm.c[d]) seenAdj[rm.c[d].to] = 1; }); });
    // связи
    Wd.rooms.forEach(function (rm) {
      if (!known(rm)) return;
      var cx = x0 + rm.x * cw + cw / 2, cy = y0 + rm.y * ch + ch / 2;
      if (rm.c.R) {
        var k = rm.c.R.k, gid = Wd.groups['h' + rm.x + ',' + rm.y];
        var col = k === 'gate' ? (S.gate ? P.good : P.bad) : k === 'soft' && !S.dug[gid] ? P.soft : P.mapLine;
        ctx.fillStyle = col;
        if (k === 'soft' && !S.dug[gid]) { for (var d = 0; d < 3; d++) ctx.fillRect(cx + cw / 2 - 7 + d * 5, cy - 1, 3, 3); }
        else ctx.fillRect(cx + cw / 2 - 8, cy - 2, 16, k === 'gate' ? 5 : 4);
      }
      if (rm.c.D) {
        var kd = rm.c.D.k, gv = Wd.groups['v' + rm.x + ',' + rm.y];
        ctx.fillStyle = kd === 'softladder' && !S.dug[gv] ? P.soft : P.mapLine;
        if (kd === 'drop') { ctx.beginPath(); ctx.moveTo(cx - 5, cy + ch / 2 - 5); ctx.lineTo(cx + 5, cy + ch / 2 - 5); ctx.lineTo(cx, cy + ch / 2 + 4); ctx.closePath(); ctx.fill(); }
        else if (kd === 'softladder' && !S.dug[gv]) { for (var e = 0; e < 3; e++) ctx.fillRect(cx - 1, cy + ch / 2 - 7 + e * 5, 3, 3); }
        else ctx.fillRect(cx - 2, cy + ch / 2 - 6, 4, 12);
      }
      if (rm.c.L && !known(Wd.rooms[rm.c.L.to])) { ctx.fillStyle = P.mapLine; ctx.fillRect(cx - cw / 2 - 8, cy - 2, 8, 4); }
      if (rm.c.U && !known(Wd.rooms[rm.c.U.to])) { ctx.fillStyle = P.mapLine; ctx.fillRect(cx - 2, cy - ch / 2 - 6, 4, 6); }
    });
    // экраны
    Wd.rooms.forEach(function (rm) {
      var x = x0 + rm.x * cw + 6, y = y0 + rm.y * ch + 5, w = cw - 12, h = ch - 10;
      if (known(rm)) {
        ctx.fillStyle = P.zoneMap[rm.zone];
        if (P.pixel) ctx.fillRect(x, y, w, h); else { roundRect(ctx, x, y, w, h, 4); ctx.fill(); }
        rm.items.forEach(function (it) {
          var ix = x + (it.c + 0.5) / L.COLS * w, iy = y + (it.r - 0.5) / L.ROWS * h;
          if (it.k === 'crystal' && !S.got[it.id]) R.crystalIcon(ctx, ix, iy, it.cid, 4, true, S.time);
          if (it.k === 'beacon') { ctx.fillStyle = S.cp.id === it.id ? P.good : P.beaconMap; ctx.beginPath(); ctx.moveTo(ix, iy - 4); ctx.lineTo(ix + 4, iy + 3); ctx.lineTo(ix - 4, iy + 3); ctx.closePath(); ctx.fill(); }
          if (it.k === 'heart') { ctx.fillStyle = P.heart; ctx.beginPath(); ctx.arc(ix, iy, 4, 0, Math.PI * 2); ctx.fill(); }
        });
      } else if (seenAdj[rm.i]) {
        ctx.strokeStyle = P.mapDim; ctx.lineWidth = 1; ctx.setLineDash(P.pixel ? [] : [3, 3]);
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); ctx.setLineDash([]);
        txt(g, '?', x + w / 2, y + h / 2 + 4, { size: 11, align: 'center', color: P.mapDim, weight: 800 }, P);
      }
      if (rm.i === S.room && Math.floor(S.time * 3) % 2 === 0) {
        var hx = x + S.hero.x / L.COLS * w, hy = y + (S.hero.y - 0.8) / L.ROWS * h;
        ctx.fillStyle = P.ink; ctx.fillRect(hx - 2, hy - 2, 4, 4);
        ctx.strokeStyle = P.accent; ctx.lineWidth = 2; ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
      }
    });
    txt(g, g.t('mapLegend'), x0, y0 + gh + 18, { size: 10, color: P.muted, weight: 600 }, P);
    txt(g, g.t('mapHint'), x0 + gw, y0 + gh + 18, { size: 10, align: 'right', color: P.muted, weight: 600 }, P);
  }

  Gb.ui = {
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
      btn('bMole', acts.mole); btn('bMap', acts.map);
    },
    fit: fit, sync: sync, roundRect: roundRect, txt: txt, up: up, bar: bar, clock: clock, panel: panel, hud: hud, banner: banner, toasts: toasts, mapOverlay: mapOverlay
  };
})(typeof window !== 'undefined' ? window : globalThis);
