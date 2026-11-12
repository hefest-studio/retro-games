/* ТАЙНИК · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема, кнопка паузы)
   и общие для обеих тем элементы — порядок отрисовки кадра, HUD, баннеры, всплывашки,
   частицы в координатах мира, карта-подсказка. Палитру P даёт активный рендерер
   (modern/classic), тексты — только через g.t(). TAYNIK.ui */
(function (global) {
  'use strict';
  var K = global.TAYNIK = global.TAYNIK || {};
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, wrap = c.parentElement;
    var pad = document.querySelector('.pad'), padFixed = pad && getComputedStyle(pad).position === 'fixed';
    var padH = pad && !padFixed && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 16 : 0;
    var availH = innerHeight - padH - 64;
    var w = Math.min(960, (wrap && wrap.clientWidth) || g.W, availH * g.W / g.H);
    w = Math.max(240, Math.floor(w));
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

  // ---------- Примитивы ----------
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function txt(g, s, x, y, o, P) { o = o || {}; if (P.font) o.font = P.font; g.text(s, x, y, o); }
  function up(P, s) { return P.pixel ? String(s).toUpperCase() : String(s); }
  function box(ctx, P, x, y, w, h, col, r) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = col; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3); ctx.fillRect(x, y, 3, h); ctx.fillRect(x + w - 3, y, 3, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 22;
      ctx.fillStyle = P.panel; roundRect(ctx, x, y, w, h, r || 14); ctx.fill(); ctx.restore();
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, r || 14); ctx.stroke();
    }
  }
  function bar(ctx, P, x, y, w, h, f, col) {
    ctx.fillStyle = P.bar;
    if (P.pixel) ctx.fillRect(x, y, w, h); else { roundRect(ctx, x, y, w, h, h / 2); ctx.fill(); }
    if (f <= 0) return;
    ctx.fillStyle = col;
    if (P.pixel) ctx.fillRect(x, y, Math.max(4, Math.round(w * f / 4) * 4), h);
    else { roundRect(ctx, x, y, Math.max(h, w * f), h, h / 2); ctx.fill(); }
  }

  // ---------- HUD ----------
  function hud(g, ctx, S, P, R) {
    var L = K.logic, W = g.W, Hh = L.HUD;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, Hh);
    ctx.fillStyle = P.hudLine; ctx.fillRect(0, Hh - 2, W, 2);
    txt(g, up(P, g.t('level')) + ' ' + S.level + '/' + S.maxLevel, 10, 14, { size: 11, color: P.ink }, P);
    txt(g, up(P, g.t('lv_' + S.level, '')), 10, 26, { size: 9, color: P.muted, weight: 700 }, P);
    // сила
    var f = Math.max(0, S.energy / L.ENERGY), col = f > 0.5 ? P.good : f > 0.25 ? P.warn : P.bad;
    txt(g, up(P, g.t('energy')), 122, 13, { size: 9, color: P.muted, weight: 700 }, P);
    bar(ctx, P, 122, 18, 96, 8, f, (S.inv > 0 && Math.floor(g.time * 12) % 2) ? P.ink : col);
    // заряды
    txt(g, up(P, g.t('ammo')), 236, 13, { size: 9, color: P.muted, weight: 700 }, P);
    R.ammoIcon(ctx, 241, 22);
    txt(g, '× ' + S.ammo, 251, 27, { size: 12, color: S.ammo ? P.ink : P.bad }, P);
    // счёт
    txt(g, String(S.score), 372, 23, { size: 17, align: 'center', color: P.accent }, P);
    var n = Math.max(3, S.lives);
    for (var i = 0; i < n; i++) R.lifeIcon(ctx, W - 16 - i * 19, 17, i < S.lives);
  }

  function banner(g, ctx, S, P) {
    var L = K.logic, title = null, sub = null, col = P.ink, a = 1;
    if (S.phase === 'play' && S.banner > 0) {
      title = up(P, g.t('ready')) + ' ' + S.level + ' · ' + up(P, g.t('lv_' + S.level, '')); sub = g.t('readySub'); col = P.accent;
      a = Math.min(1, S.banner / 0.4);
    } else if (S.phase === 'clear') { title = g.t('clear'); sub = S.level < S.maxLevel ? g.t('next') + ': ' + g.t('lv_' + (S.level + 1), '') : ''; col = P.good; }
    else if (S.phase === 'dead' && S.death) { title = g.t('lost'); sub = g.t('d_' + S.death.reason, '') + ' · ' + g.t('lives') + ': ' + S.lives; col = P.bad; }
    if (!title) return;
    var w = 380, h = 70, x = (g.W - w) / 2, y = L.HUD + 120;
    ctx.globalAlpha = a;
    box(ctx, P, x, y, w, h, col);
    txt(g, up(P, title), g.W / 2, y + 30, { size: P.pixel ? 16 : 19, align: 'center', color: col }, P);
    if (sub) txt(g, up(P, sub), g.W / 2, y + 52, { size: P.pixel ? 10 : 12, align: 'center', color: P.muted, weight: 600 }, P);
    ctx.globalAlpha = 1;
  }

  // всплывашки — в координатах мира (ctx уже сдвинут камерой)
  function toasts(g, ctx, list, P) {
    for (var i = 0; i < list.length; i++) {
      var o = list[i], a = Math.min(1, o.t / 0.4);
      ctx.globalAlpha = a;
      if (!P.pixel) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 6; }
      txt(g, up(P, o.text), o.x, o.y - (1.4 - o.t) * 22, { size: P.pixel ? 11 : 12, align: 'center', color: o.color, weight: 900 }, P);
      if (!P.pixel) ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function fx(ctx, list, P) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i], a = Math.max(0, p.t / p.life);
      ctx.globalAlpha = a; ctx.fillStyle = p.color;
      if (P.pixel) ctx.fillRect(Math.round(p.x / 2) * 2 - 2, Math.round(p.y / 2) * 2 - 2, 4, 4);
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Карта-подсказка: кусок лабиринта вокруг героя и путь к люку ----------
  function hintMap(g, ctx, S, P) {
    if (!S.hint) return;
    var L = K.logic, lv = S.lv, h = S.hint, a = Math.min(1, h.t / 0.25, (L.HINT_T - h.t) / 0.15 + 0.2);
    var RX = 3, RY = 2, cw = 38, ch = 26, w = (2 * RX + 1) * cw, hh = (2 * RY + 1) * ch;
    var x0 = (g.W - w) / 2, y0 = L.HUD + 36, onPath = {};
    h.path.forEach(function (p) { onPath[p[0] + ',' + p[1]] = true; });
    ctx.globalAlpha = a;
    box(ctx, P, x0 - 12, y0 - 30, w + 24, hh + 44, P.accent, 12);
    txt(g, up(P, g.t('hintmap')), g.W / 2, y0 - 11, { size: 12, align: 'center', color: P.accent, weight: 900 }, P);
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, hh); ctx.clip();
    var hc = L.cellOf(lv, S.hero.x, S.hero.y);
    for (var dj = -RY; dj <= RY; dj++) for (var di = -RX; di <= RX; di++) {
      var i = h.i + di, j = h.j + dj, cx = x0 + (di + RX) * cw, cy = y0 + (dj + RY) * ch;
      if (i < 0 || j < 0 || i >= lv.cols || j >= lv.rows) { ctx.fillStyle = P.mapVoid; ctx.fillRect(cx, cy, cw, ch); continue; }
      var c = L.cellAt(lv, i, j);
      ctx.fillStyle = onPath[i + ',' + j] ? P.mapPath : P.mapCell; ctx.fillRect(cx + 2, cy + 2, cw - 4, ch - 4);
      ctx.fillStyle = P.mapWall;
      // стены: сплошные, где нет прохода
      if (!c.e) ctx.fillRect(cx + cw - 2, cy, 2, ch); else ctx.fillRect(cx + cw - 2, cy, 2, ch * 0.35);
      if (i === 0 || !L.cellAt(lv, i - 1, j).e) ctx.fillRect(cx, cy, 2, ch); else ctx.fillRect(cx, cy, 2, ch * 0.35);
      ctx.fillRect(cx, cy + ch - 2, cw, 2); ctx.fillRect(cx, cy, cw, 2);
      if (c.s) { ctx.fillStyle = onPath[i + ',' + j] ? P.mapPath : P.mapCell; ctx.fillRect(cx + 3 + c.hx * 2.5, cy + ch - 2, 6, 2); ctx.fillStyle = P.rope; ctx.fillRect(cx + 5 + c.hx * 2.5, cy + 3, 2, ch + 4); }
      if (c.acid) { ctx.fillStyle = P.acid; ctx.fillRect(cx + 3 + c.acid.a * 2.5, cy + ch - 5, c.acid.w * 2.5, 3); }
      if (c === lv.exitCell) {
        ctx.fillStyle = P.good; ctx.fillRect(cx + 3 + c.ux * 2.5, cy - 1, 7, 4);
        txt(g, '▲', cx + cw / 2, cy + ch / 2 + 5, { size: 13, align: 'center', color: P.good }, P);
      }
      if (i === hc.i && j === hc.j) {
        var hx = cx + 2 + (S.hero.x / L.T - i * L.CX) * (cw - 4) / L.CX, hy = cy + 2 + (S.hero.y / L.T - j * L.CY) * (ch - 4) / L.CY;
        ctx.fillStyle = P.accent;
        if (P.pixel) ctx.fillRect(Math.round(hx) - 3, Math.round(hy) - 6, 6, 6); else { ctx.beginPath(); ctx.arc(hx, hy - 3, 3.5, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    ctx.restore();
    // люк за пределами куска карты — стрелка
    var ex = lv.exitCell, dxc = ex.i - h.i, dyc = ex.j - h.j;
    if (Math.abs(dxc) > RX || Math.abs(dyc) > RY) {
      var ang = Math.atan2(dyc, dxc), ax = g.W / 2 + Math.cos(ang) * (w / 2 + 2), ay = y0 + hh / 2 + Math.sin(ang) * (hh / 2 + 2);
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang); ctx.fillStyle = P.good;
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Кадр игры ----------
  function frame(g, ctx, S, R, o) {
    var L = K.logic, P = R.P, cam = S.cam;
    o = o || {};
    var cx = Math.round(cam.x), cy = Math.round(cam.y);
    if (P.pixel) { cx = cx & ~1; cy = cy & ~1; }
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, g.W, g.H);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, L.HUD, L.VW, L.VH); ctx.clip();
    ctx.translate(-cx, L.HUD - cy);
    R.world(ctx, S, g, { x: cx, y: cy, bare: o.bare });
    if (o.fx) fx(ctx, o.fx, P);
    if (o.toasts) toasts(g, ctx, o.toasts, P);
    ctx.restore();
    if (R.light) R.light(ctx, S, g, cx, cy, o);
    if (o.bare) return;
    hud(g, ctx, S, P, R);
    hintMap(g, ctx, S, P);
    banner(g, ctx, S, P);
  }

  K.ui = {
    init: function (g) {
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
    },
    fit: fit, sync: sync, roundRect: roundRect, txt: txt, up: up, box: box, bar: bar,
    hud: hud, banner: banner, toasts: toasts, fx: fx, hintMap: hintMap, frame: frame
  };
})(typeof window !== 'undefined' ? window : globalThis);
