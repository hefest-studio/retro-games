/* КАТАКОМБЫ · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема) и общий конвейер
   отрисовки кадра — мир через камеру, HUD, баннеры, прокачка. Как рисовать отдельные вещи
   (клетки, героев, врагов, логова, Стража) решает активный рендерер R = KATAKOMBY.modern | classic.
   Тексты — только через g.t(). KATAKOMBY.ui */
(function (global) {
  'use strict';
  var K = global.KATAKOMBY = global.KATAKOMBY || {};
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
  function txt(g, s, x, y, o, P) { o = o || {}; if (P.font) o.font = P.font; g.text(s, x, y, o); }
  function up(P, s) { return P.pixel ? String(s).toUpperCase() : String(s); }
  function panel(ctx, x, y, w, h, P, edge) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = edge || P.line; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3); ctx.fillRect(x, y, 3, h); ctx.fillRect(x + w - 3, y, 3, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 24; ctx.fillStyle = P.panel;
      roundRect(ctx, x, y, w, h, 14); ctx.fill(); ctx.restore();
      ctx.strokeStyle = edge || P.line; ctx.lineWidth = 1.5; roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 14); ctx.stroke();
    }
  }
  function bar(ctx, x, y, w, h, f, col, P) {
    ctx.fillStyle = P.barBg;
    if (P.pixel) { ctx.fillRect(x, y, w, h); ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * Math.max(0, f) / 2) * 2, h); return; }
    roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
    if (f > 0) { ctx.fillStyle = col; roundRect(ctx, x, y, Math.max(h, w * Math.min(1, f)), h, h / 2); ctx.fill(); }
  }

  // ---------- Мир ----------
  function world(g, ctx, S, R, o) {
    var L = K.logic, T = L.T, P = R.P, cx = Math.round(S.cam.x), cy = Math.round(S.cam.y);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, L.HUD, L.VIEW_W, L.VIEW_H); ctx.clip();
    ctx.fillStyle = P.void; ctx.fillRect(0, L.HUD, L.VIEW_W, L.VIEW_H);
    ctx.translate(-cx, L.HUD - cy);
    var tx0 = Math.max(0, Math.floor(cx / T)), ty0 = Math.max(0, Math.floor(cy / T));
    var tx1 = Math.min(S.W - 1, Math.floor((cx + L.VIEW_W) / T)), ty1 = Math.min(S.H - 1, Math.floor((cy + L.VIEW_H) / T));
    var cell = function (x, y) { return (x < 0 || y < 0 || x >= S.W || y >= S.H) ? '#' : S.grid[y * S.W + x]; };
    for (var ty = ty0; ty <= ty1; ty++) for (var tx = tx0; tx <= tx1; tx++) {
      var c = cell(tx, ty), x = tx * T, y = ty * T;
      if (c === '#') R.wall(ctx, x, y, tx, ty, cell);
      else { R.floor(ctx, x, y, tx, ty); if (c === 'D') R.door(ctx, x, y, cell(tx - 1, ty) === 'D' || cell(tx + 1, ty) === 'D' || cell(tx - 1, ty) === '#'); if (c === 'E') R.exit(ctx, x, y, S.time); }
    }
    var vis = function (o2, m) { m = m || 40; return o2.x > cx - m && o2.x < cx + L.VIEW_W + m && o2.y > cy - m && o2.y < cy + L.VIEW_H + m; };
    S.items.forEach(function (it) { if (!it.taken && vis(it)) R.item(ctx, it.kind, it.x, it.y, S.time); });
    S.lairs.forEach(function (l) { if (vis(l)) R.lair(ctx, l, S.time); });
    S.swings.forEach(function (w) { R.swing(ctx, w); });
    S.enemies.forEach(function (e) { if (vis(e)) R.enemy(ctx, e, S.time); });
    if (S.boss) R.boss(ctx, S.boss, S.time);
    S.heroes.forEach(function (h) { if (h.ghost) return; if (h.alive) R.hero(ctx, h, S.time, S.players); else R.grave(ctx, h); });
    S.shots.forEach(function (s) { R.shot(ctx, s); });
    S.spits.forEach(function (s) { if (vis(s)) R.spit(ctx, s, S.time); });
    ctx.restore();
    if (R.light) R.light(ctx, S, g);
    if (S.bombFlash > 0) { ctx.fillStyle = P.bombFlash; ctx.globalAlpha = Math.min(1, S.bombFlash * 1.6); ctx.fillRect(0, L.HUD, L.VIEW_W, L.VIEW_H); ctx.globalAlpha = 1; }
    // подписи И1/И2 над головами в коопе
    if (S.players === 2) S.heroes.forEach(function (h) {
      if (!h.alive || h.ghost) return;
      txt(g, g.t(h.id ? 'p2' : 'p1'), h.x - cx, h.y - cy + L.HUD - 20, { size: 10, align: 'center', color: P.hero[h.id], weight: 900 }, P);
    });
  }

  // ---------- HUD ----------
  function heroBlock(g, ctx, S, h, x, P, R) {
    var st = K.logic.heroStats(h), f = h.alive ? h.hp / st.maxHp : 0, low = h.alive && f < 0.25;
    R.badge(ctx, h.cls, x + 12, 20, h.id);
    var name = (S.players === 2 ? g.t(h.id ? 'p2' : 'p1') + ' · ' : '') + g.t('cls_' + h.cls);
    txt(g, up(P, name), x + 28, 15, { size: 11, color: P.hero[h.id], weight: 800 }, P);
    var col = !h.alive ? P.muted : low ? (Math.floor(S.time * 4) % 2 ? P.bad : P.warn) : f < 0.5 ? P.warn : P.good;
    bar(ctx, x + 28, 21, 128, 8, f, col, P);
    txt(g, h.alive ? String(Math.ceil(h.hp)) : '—', x + 162, 29, { size: 10, color: P.muted, weight: 700 }, P);
    // уровни прокачки: С/Б/Р точками
    ['str', 'spd', 'arm'].forEach(function (k, i) {
      for (var j = 0; j < h.up[k]; j++) { ctx.fillStyle = P.up[k]; ctx.fillRect(x + 28 + i * 44 + j * 7, 33, 5, 3); }
    });
  }
  function hud(g, ctx, S, R) {
    var P = R.P, W = g.W, H = K.logic.HUD;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = P.line; ctx.fillRect(0, H - 2, W, 2);
    S.heroes.forEach(function (h, i) { heroBlock(g, ctx, S, h, 8 + i * 200, P, R); });
    txt(g, String(S.score), W / 2 + (S.players === 2 ? 60 : 0), 27, { size: 20, align: 'center', color: P.accent }, P);
    // справа: этаж, ключи, зелья
    var rx = W - 12;
    txt(g, up(P, g.t('floorShort')) + ' ' + S.floor + '/' + S.maxFloor, rx, 17, { size: 13, align: 'right', color: P.ink }, P);
    txt(g, up(P, g.t('f_' + S.name)), rx, 33, { size: 10, align: 'right', color: P.muted, weight: 700 }, P);
    var ix = W - 190;
    R.item(ctx, 'key', ix, 20, 0, 0.75); txt(g, '×' + S.keys, ix + 12, 25, { size: 13, color: P.ink }, P);
    R.item(ctx, 'potion', ix + 50, 20, 0, 0.75); txt(g, '×' + S.potions, ix + 62, 25, { size: 13, color: P.ink }, P);
  }

  // ---------- Баннеры, прокачка ----------
  function banner(g, ctx, S, R, title, sub, col) {
    var P = R.P, w = 520, h = 76, x = (g.W - w) / 2, y = 120;
    panel(ctx, x, y, w, h, P, col);
    txt(g, up(P, title), g.W / 2, y + 34, { size: P.pixel ? 20 : 22, align: 'center', color: col }, P);
    txt(g, up(P, sub), g.W / 2, y + 58, { size: P.pixel ? 10 : 12, align: 'center', color: P.muted, weight: 600 }, P);
  }
  function upgrade(g, ctx, S, R) {
    var P = R.P, n = S.heroes.length, cw = 300, gap = 24, w = n * cw + (n - 1) * gap + 40, h = 300, x = (g.W - w) / 2, y = 150;
    ctx.fillStyle = P.dim; ctx.fillRect(0, K.logic.HUD, g.W, g.H - K.logic.HUD);
    panel(ctx, x, y, w, h, P, P.accent);
    txt(g, up(P, g.t('upTitle')), g.W / 2, y + 36, { size: 24, align: 'center', color: P.accent }, P);
    txt(g, g.t('upSub'), g.W / 2, y + 58, { size: 12, align: 'center', color: P.muted, weight: 600 }, P);
    S.heroes.forEach(function (hh, i) {
      var cx = x + 20 + i * (cw + gap), cy = y + 76;
      R.badge(ctx, hh.cls, cx + 12, cy + 4, hh.id);
      txt(g, up(P, (n === 2 ? g.t(i ? 'p2' : 'p1') + ' · ' : '') + g.t('cls_' + hh.cls)), cx + 28, cy + 9, { size: 13, color: P.hero[i], weight: 800 }, P);
      K.logic.UPG.forEach(function (k, j) {
        var ry = cy + 24 + j * 56, sel = S.upCursor[i] === j, done = S.upDone[i];
        ctx.fillStyle = sel ? P.selBg : P.rowBg;
        if (P.pixel) ctx.fillRect(cx, ry, cw, 48); else { roundRect(ctx, cx, ry, cw, 48, 10); ctx.fill(); }
        if (sel) { ctx.strokeStyle = done ? P.good : P.hero[i]; ctx.lineWidth = 2; if (P.pixel) ctx.strokeRect(cx + 1, ry + 1, cw - 2, 46); else { roundRect(ctx, cx + 1, ry + 1, cw - 2, 46, 10); ctx.stroke(); } }
        txt(g, up(P, g.t('up_' + k)), cx + 14, ry + 21, { size: 15, color: P.up[k] }, P);
        txt(g, g.t('upd_' + k), cx + 14, ry + 39, { size: 11, color: P.muted, weight: 600 }, P);
        for (var q = 0; q < K.logic.UPG_MAX; q++) { ctx.fillStyle = q < hh.up[k] ? P.up[k] : P.barBg; ctx.fillRect(cx + cw - 16 - (K.logic.UPG_MAX - q) * 12, ry + 14, 9, 9); }
      });
      if (S.upDone[i]) txt(g, '✓ ' + g.t('upDone') + (n === 2 && !S.upDone[1 - i] ? ' · ' + g.t('upWait') : ''), cx + cw / 2, cy + 200, { size: 12, align: 'center', color: P.good, weight: 700 }, P);
    });
  }
  function overlays(g, ctx, S, R) {
    var P = R.P;
    if (S.boss && !S.boss.dead) {   // полоса Стража
      var B = S.boss, bw = 360, bx = (g.W - bw) / 2, by = K.logic.HUD + 12;
      txt(g, up(P, g.t('bossName')), g.W / 2, by + 2, { size: 11, align: 'center', color: P.boss, weight: 800 }, P);
      bar(ctx, bx, by + 8, bw, 8, B.hp / B.max, P.boss, P);
    }
    if (S.phase === 'play' && S.banner > 0) {
      var a = Math.min(1, S.banner / 0.4); ctx.globalAlpha = a;
      banner(g, ctx, S, R, g.t('floor') + ' ' + S.floor + ' · ' + g.t('f_' + S.name), S.boss ? g.t('bossSub') : g.t('introSub'), S.boss ? P.boss : P.accent);
      ctx.globalAlpha = 1;
    }
    if (S.phase === 'clear') banner(g, ctx, S, R, g.t('clear'), g.t('bonus') + ' +' + (K.logic.SCORE.floor * S.floor), P.good);
    if (S.phase === 'upgrade') upgrade(g, ctx, S, R);
    if (S.phase === 'play' && S.players === 2) S.heroes.forEach(function (h) {
      if (!h.alive) txt(g, g.t(h.id ? 'p2' : 'p1') + ' ' + g.t('fallen'), g.W / 2, g.H - 16, { size: 12, align: 'center', color: P.bad, weight: 700 }, P);
    });
    if (S.phase === 'play') S.heroes.forEach(function (h) {
      if (h.alive && h.hp < K.logic.heroStats(h).maxHp * 0.25 && Math.floor(S.time * 3) % 2) {
        txt(g, g.t('hungry'), h.x - S.cam.x, h.y - S.cam.y + K.logic.HUD + 30, { size: 11, align: 'center', color: P.warn, weight: 900 }, P);
      }
    });
  }

  function render(g, ctx, S, R, o) {
    o = o || {};
    world(g, ctx, S, R, o);
    if (o.bare) return;
    hud(g, ctx, S, R);
    overlays(g, ctx, S, R);
    if (o.toasts) toasts(g, ctx, o.toasts, S, R.P);
  }
  function toasts(g, ctx, list, S, P) {
    for (var i = 0; i < list.length; i++) {
      var t = list[i]; ctx.globalAlpha = Math.min(1, t.t / 0.4);
      txt(g, up(P, t.text), t.x - S.cam.x, t.y - S.cam.y + K.logic.HUD - (1.2 - t.t) * 26, { size: 12, align: 'center', color: t.color, weight: 900 }, P);
    }
    ctx.globalAlpha = 1;
  }

  K.ui = {
    init: function (g) {
      fit(g); addEventListener('resize', function () { fit(g); });
      sync(g); setInterval(function () { sync(g); }, 250);
    },
    fit: fit, sync: sync, roundRect: roundRect, txt: txt, up: up, panel: panel, bar: bar, render: render, world: world
  };
})(typeof window !== 'undefined' ? window : globalThis);
