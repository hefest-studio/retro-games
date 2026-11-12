/* НАЛЁТ · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема) и общий конвейер кадра —
   фон, клетки, объекты через камеру, HUD, баннеры, тосты. Как рисовать отдельные вещи решает активный
   рендерер R = NALYOT.modern | NALYOT.classic. Тексты — только через g.t(). NALYOT.ui */
(function (global) {
  'use strict';
  var N = global.NALYOT = global.NALYOT || {};
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
    o = o || {}; if (P.font) o.font = P.font;
    if (o.shadow !== false && !P.pixel) { var c = o.color; o.color = 'rgba(0,0,0,.55)'; g.text(s, x + 1, y + 2, o); o.color = c; }
    else if (P.pixel && o.shadow !== false) { var c2 = o.color; o.color = '#000000'; g.text(s, x + 2, y + 2, o); o.color = c2; }
    g.text(s, x, y, o);
  }
  function up(P, s) { return P.pixel ? String(s).toUpperCase() : String(s); }
  function panel(ctx, x, y, w, h, P, edge) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = edge || P.line; ctx.fillRect(x, y, w, 4); ctx.fillRect(x, y + h - 4, w, 4); ctx.fillRect(x, y, 4, h); ctx.fillRect(x + w - 4, y, 4, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 24; ctx.fillStyle = P.panel;
      roundRect(ctx, x, y, w, h, 14); ctx.fill(); ctx.restore();
      ctx.strokeStyle = edge || P.line; ctx.lineWidth = 1.5; roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 14); ctx.stroke();
    }
  }
  function bar(ctx, x, y, w, h, f, col, P) {
    ctx.fillStyle = P.barBg;
    if (P.pixel) { ctx.fillRect(x, y, w, h); ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * Math.max(0, f) / 4) * 4, h); return; }
    roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
    if (f > 0) { ctx.fillStyle = col; roundRect(ctx, x, y, Math.max(h, w * Math.min(1, f)), h, h / 2); ctx.fill(); }
  }

  // ---------- Мир ----------
  function world(g, ctx, S, R, o) {
    var L = N.logic, T = L.T, P = R.P, cx = Math.round(S.cam.x), shake = o && o.shake || 0;
    var sx = shake ? Math.round((Math.random() - 0.5) * shake) : 0, sy = shake ? Math.round((Math.random() - 0.5) * shake) : 0;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, L.HUD, L.VIEW_W, L.VIEW_H); ctx.clip();
    R.bg(ctx, S, cx, L.HUD, L.VIEW_W, L.VIEW_H);
    ctx.translate(-cx + sx, L.HUD + sy);
    var tx0 = Math.max(0, Math.floor(cx / T) - 1), tx1 = Math.min(S.W - 1, Math.floor((cx + L.VIEW_W) / T) + 1);
    var cell = function (x, y) { return (x < 0 || x >= S.W) ? 1 : (y < 0 || y >= L.ROWS) ? 0 : S.grid[y * S.W + x]; };
    for (var tx = tx0; tx <= tx1; tx++) for (var ty = 0; ty < L.ROWS; ty++) {
      var c = S.grid[ty * S.W + tx]; if (!c) continue;
      if (c === 1) R.ground(ctx, tx * T, ty * T, tx, ty, cell(tx, ty - 1) !== 1, S);
      else R.plat(ctx, tx * T, ty * T, tx, ty, S);
    }
    var vis = function (x, m) { m = m || 60; return x > cx - m && x < cx + L.VIEW_W + m; };
    S.blocks.forEach(function (b) { if (!b.dead && vis(b.x, b.tw * T)) R.block(ctx, b, S.time); });
    S.marks.forEach(function (m) { R.mark(ctx, m, S); });
    S.hostages.forEach(function (hs) { if (vis(hs.x) && hs.t < 3) R.hostage(ctx, hs, S.time); });
    S.pickups.forEach(function (p) { if (vis(p.x)) R.pickup(ctx, p, S.time); });
    S.vehicles.forEach(function (v) { if (v.rider < 0 && vis(v.x)) R.vehicle(ctx, v, S.time, null); });
    S.enemies.forEach(function (e) { if (vis(e.x)) R.enemy(ctx, e, S.time); });
    if (S.boss) R.boss(ctx, S.boss, S.time);
    S.heroes.forEach(function (h) {
      if (h.ride) { R.vehicle(ctx, h.ride, S.time, R.P.hero[h.id], h); return; }
      if (!h.alive && (h.out && h.deadT <= 0 || h.deadT <= 0)) return;
      if (h.alive && h.inv > 0 && Math.floor(S.time * 14) % 2) return;
      R.hero(ctx, h, S.time, S.players);
    });
    S.bullets.forEach(function (b) { R.bullet(ctx, b); });
    S.ebullets.forEach(function (b) { R.ebullet(ctx, b, S.time); });
    S.grenades.forEach(function (gr) { R.grenade(ctx, gr); });
    S.bombs.forEach(function (bm) { R.bomb(ctx, bm, S.time); });
    S.waves.forEach(function (w) { R.wave(ctx, w, S.time); });
    S.lasers.forEach(function (l) { R.laser(ctx, l, S.time); });
    S.booms.forEach(function (bo) { R.boom(ctx, bo); });
    ctx.restore();
    // подписи И1/И2 над головами в коопе
    if (S.players === 2) S.heroes.forEach(function (h) {
      if (!h.alive) return;
      var hy = h.ride ? h.ride.y - h.ride.hh : h.y - h.hh;
      txt(g, g.t(h.id ? 'p2' : 'p1'), h.x - cx, hy + L.HUD - 8, { size: 10, align: 'center', color: P.hero[h.id], weight: 900 }, P);
    });
  }

  // ---------- HUD ----------
  function heroBlock(g, ctx, S, h, x, P, R) {
    var dim = h.out;
    R.badge(ctx, h.id, x + 14, 20, dim);
    var name = (S.players === 2 ? g.t(h.id ? 'p2' : 'p1') + ' · ' : '') + g.t('hero_' + h.id);
    txt(g, up(P, name), x + 32, 15, { size: 11, color: dim ? P.muted : P.hero[h.id], weight: 800, shadow: false }, P);
    // жизни и фартук
    var n = h.lives > 4 ? 1 : h.lives, ax = x + 36 + n * 13;
    for (var i = 0; i < n; i++) R.icon(ctx, 'life', x + 36 + i * 13, 26, h.id);
    if (h.lives > 4) { txt(g, '×' + h.lives, x + 46, 31, { size: 11, color: P.ink, weight: 800, shadow: false }, P); ax = x + 74; }
    if (h.armor > 0 && !h.out) R.icon(ctx, 'armor', ax + 4, 26, h.id);
    // оружие и гранаты
    var wx = x + 128;
    var wname = h.ride ? g.t('w_kotel') : g.t('w_' + h.weapon);
    txt(g, up(P, wname), wx, 15, { size: 10, color: h.weapon !== 'rivet' || h.ride ? P.accent : P.muted, weight: 800, shadow: false }, P);
    txt(g, h.ride ? '∞' : h.weapon === 'rivet' ? '∞' : String(h.ammo), wx, 31, { size: 12, color: P.ink, weight: 800, shadow: false }, P);
    R.icon(ctx, 'grenade', wx + 50, 26, h.id);
    txt(g, '×' + h.grenades, wx + 58, 31, { size: 12, color: P.ink, weight: 800, shadow: false }, P);
    if (h.ride) { var v = h.ride; bar(ctx, wx + 84, 24, 40, 6, v.hp / v.max, v.boom > 0 ? P.bad : P.good, P); }
  }
  function hud(g, ctx, S, R) {
    var P = R.P, W = g.W, H = N.logic.HUD;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = P.line; ctx.fillRect(0, H - 2, W, 2);
    S.heroes.forEach(function (h, i) { heroBlock(g, ctx, S, h, 6 + i * 262, P, R); });
    var scx = S.players === 2 ? W - 250 : W / 2;
    txt(g, String(S.score), scx, 28, { size: 20, align: 'center', color: P.accent, shadow: false }, P);
    var rx = W - 12;
    txt(g, up(P, g.t('missionShort')) + ' ' + S.mission + '/' + S.maxMission, rx, 17, { size: 13, align: 'right', color: P.ink, shadow: false }, P);
    txt(g, up(P, g.t('m_' + S.name)), rx, 33, { size: 10, align: 'right', color: P.muted, weight: 700, shadow: false }, P);
  }

  // ---------- Баннеры ----------
  function banner(g, ctx, S, R, title, sub, col, y) {
    var P = R.P, w = 560, h = 78, x = (g.W - w) / 2; y = y || 120;
    panel(ctx, x, y, w, h, P, col);
    txt(g, up(P, title), g.W / 2, y + 36, { size: P.pixel ? 20 : 24, align: 'center', color: col }, P);
    txt(g, up(P, sub), g.W / 2, y + 60, { size: P.pixel ? 10 : 12, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
  }
  function overlays(g, ctx, S, R) {
    var P = R.P, B = S.boss;
    if (B && !B.dead) {
      var bw = 380, bx = (g.W - bw) / 2, by = N.logic.HUD + 12;
      txt(g, up(P, g.t('b_' + B.key)) + (B.phases.length > 1 ? '  ·  ' + up(P, g.t('phase')) + ' ' + (B.phase + 1) + '/' + B.phases.length : ''), g.W / 2, by + 2, { size: 11, align: 'center', color: P.boss, weight: 800 }, P);
      bar(ctx, bx, by + 8, bw, 8, B.hp / B.max, P.boss, P);
      if (B.intro > 0) { ctx.globalAlpha = Math.min(1, B.intro / 0.4); banner(g, ctx, S, R, g.t('b_' + B.key), g.t('bossSub'), P.boss, 140); ctx.globalAlpha = 1; }
    }
    if (S.phase === 'play' && S.banner > 0) {
      ctx.globalAlpha = Math.min(1, S.banner / 0.4);
      banner(g, ctx, S, R, g.t('mission') + ' ' + S.mission + ' · ' + g.t('m_' + S.name), g.t('introSub'), P.accent);
      ctx.globalAlpha = 1;
    }
    if (S.phase === 'clear') banner(g, ctx, S, R, g.t('clear'), g.t('rescued') + ': ' + S.rescued + ' · ' + g.t('bonus') + ' +' + (S.lastBonus || 0), P.good);
    // горящий «Котёл»
    S.heroes.forEach(function (h) {
      if (h.ride && h.ride.boom > 0 && Math.floor(S.time * 6) % 2) txt(g, up(P, g.t('kotelCrit')), g.W / 2, g.H - 18, { size: 14, align: 'center', color: P.bad, weight: 900 }, P);
    });
    if (S.players === 2) S.heroes.forEach(function (h) {
      if (h.out) txt(g, g.t(h.id ? 'p2' : 'p1') + ' ' + g.t('out'), h.id ? g.W - 16 : 16, g.H - 12, { size: 12, align: h.id ? 'right' : 'left', color: P.bad, weight: 700 }, P);
    });
  }
  function toasts(g, ctx, list, S, P) {
    for (var i = 0; i < list.length; i++) {
      var t = list[i]; ctx.globalAlpha = Math.min(1, t.t / 0.4);
      txt(g, up(P, t.text), t.x - S.cam.x, t.y + N.logic.HUD - (1.3 - t.t) * 26, { size: 12, align: 'center', color: t.color, weight: 900 }, P);
    }
    ctx.globalAlpha = 1;
  }
  function render(g, ctx, S, R, o) {
    o = o || {};
    world(g, ctx, S, R, o);
    if (o.bare) return;
    hud(g, ctx, S, R);
    overlays(g, ctx, S, R);
    if (o.toasts) toasts(g, ctx, o.toasts, S, R.P);
  }

  N.ui = {
    init: function (g) {
      fit(g); addEventListener('resize', function () { fit(g); });
      sync(g); setInterval(function () { sync(g); }, 250);
    },
    fit: fit, sync: sync, roundRect: roundRect, txt: txt, up: up, panel: panel, bar: bar, render: render, world: world
  };
})(typeof window !== 'undefined' ? window : globalThis);
