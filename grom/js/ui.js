/* ГРОМ · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема, тач-кнопки) и общий для обеих тем
   конвейер кадра — камера, мир (через рендерер R = GROM.modern | GROM.classic), частицы и подписи в координатах мира,
   HUD с мини-картой, полоса босса, баннеры. Тексты — только через g.t(). GROM.ui */
(function (global) {
  'use strict';
  var GR = global.GROM = global.GROM || {};
  var L = GR.logic, T = L.T, HUD = L.HUD, VW = L.VIEW_W, VH = L.VIEW_H;
  function $(id) { return typeof document !== 'undefined' ? document.getElementById(id) : null; }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, wrap = c.parentElement;
    var pad = document.querySelector('.pad'), cs = pad && getComputedStyle(pad), padH = cs && cs.display !== 'none' && cs.position !== 'fixed' ? pad.offsetHeight + 16 : 0;
    var availH = innerHeight - padH - (padH ? 70 : 44);
    var w = Math.min(1280, (wrap && wrap.clientWidth) || g.W, availH * g.W / g.H);
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
      GR.wLabel = { S: g.t('w_S').charAt(0), L: g.t('w_L').charAt(0), B: g.t('w_B').charAt(0) };
    }
    if (theme !== lastTheme) { lastTheme = theme; document.body.setAttribute('data-theme', theme); }
  }

  // ---------- Помощники рисования ----------
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function txt(g, s, x, y, o, P) { o = o || {}; if (P && P.font) o.font = P.font; g.text(P && P.pixel ? String(s).toUpperCase() : s, x, y, o); }
  function clock(t) { t = Math.max(0, Math.ceil(t)); var m = Math.floor(t / 60), s = t % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function panel(ctx, x, y, w, h, P, col) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = col || P.line; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 20;
      ctx.fillStyle = P.panelA; roundRect(ctx, x, y, w, h, 12); ctx.fill(); ctx.restore();
      ctx.strokeStyle = col || P.line; ctx.lineWidth = 1.5; roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 12); ctx.stroke();
    }
  }
  function bar(ctx, x, y, w, h, f, col, P) {
    ctx.fillStyle = P.barBg;
    if (P.pixel) ctx.fillRect(x, y, w, h); else { roundRect(ctx, x, y, w, h, h / 2); ctx.fill(); }
    if (f <= 0) return;
    ctx.fillStyle = col;
    if (P.pixel) ctx.fillRect(x, y, Math.round(w * f / 2) * 2, h); else { roundRect(ctx, x, y, Math.max(h, w * f), h, h / 2); ctx.fill(); }
  }

  // ---------- Частицы и всплывающие подписи (в координатах мира, клетки) ----------
  var fx = { parts: [], toasts: [] };
  function spawn(x, y, o) {
    o = o || {}; var n = o.count || 8;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, s = (o.speed || 6) * (0.3 + Math.random());
      fx.parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), life: o.life || 0.5, t: o.life || 0.5, color: o.color || '#ffd15e', size: o.size || 3, g: o.g == null ? 14 : o.g });
    }
    if (fx.parts.length > 500) fx.parts.splice(0, fx.parts.length - 500);
  }
  function toast(text, color, x, y, big) {
    for (var i = 0; i < fx.toasts.length; i++) if (Math.abs(fx.toasts[i].y - y) < 0.9 && Math.abs(fx.toasts[i].x - x) < 6) y -= 1.1;
    fx.toasts.push({ text: text, color: color, x: x, y: y, t: big ? 2 : 1.3, life: big ? 2 : 1.3, big: !!big });
    if (fx.toasts.length > 10) fx.toasts.shift();
  }
  function updFx(dt) {
    for (var i = 0; i < fx.parts.length; i++) { var p = fx.parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.t -= dt; }
    fx.parts = fx.parts.filter(function (p) { return p.t > 0; });
    for (var j = 0; j < fx.toasts.length; j++) fx.toasts[j].t -= dt;
    fx.toasts = fx.toasts.filter(function (o) { return o.t > 0; });
  }
  function clearFx() { fx.parts = []; fx.toasts = []; }

  // ---------- Кадр ----------
  // opts: { bare (без HUD/баннеров), shake, cam (своя камера) }
  function render(g, ctx, S, R, opts) {
    opts = opts || {};
    var P = R.P, cam = opts.cam || S.cam, time = S.time, W = g.W, H = g.H;
    var ox = 0, oy = 0;
    if (opts.shake) { ox = Math.round((Math.random() - 0.5) * opts.shake); oy = Math.round((Math.random() - 0.5) * opts.shake); }
    var cx = Math.round(cam.x * T) / T, cy = Math.round(cam.y * T) / T;
    function sx(x) { return Math.round((x - cx) * T) + ox; }
    function sy(y) { return HUD + Math.round((y - cy) * T) + oy; }
    var V = { sx: sx, sy: sy, cx: cx, cy: cy, t: time, S: S, g: g };
    ctx.save();
    ctx.beginPath(); ctx.rect(0, HUD, W, H - HUD); ctx.clip();
    R.bg(ctx, V, W, H);
    R.tiles(ctx, V);
    if (S.portal) R.portal(ctx, sx(S.portal.x), sy(S.portal.y), time);
    var i;
    for (i = 0; i < S.items.length; i++) { var it = S.items[i]; if (it.x > cx - 2 && it.x < cx + VW + 2 && it.y > cy - 2 && it.y < cy + VH + 2) R.item(ctx, it, sx(it.x), sy(it.y), time); }
    for (i = 0; i < S.mines.length; i++) R.mine(ctx, sx(S.mines[i].x), sy(S.mines[i].y), S.mines[i], time);
    for (i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (!e.dead && e.x > cx - 3 && e.x < cx + VW + 3 && e.y > cy - 3 && e.y < cy + VH + 3) R.enemy(ctx, e, sx(e.x), sy(e.y), time); }
    if (S.boss && (!S.boss.dead || S.boss.deadT > 0)) R.boss(ctx, S.boss, sx(S.boss.x), sy(S.boss.y), time);
    for (i = 0; i < S.waves.length; i++) R.wave(ctx, sx(S.waves[i].x), sy(S.waves[i].y), S.waves[i], time);
    for (i = 0; i < S.marks.length; i++) R.mark(ctx, sx(S.marks[i].x), sy(S.marks[i].y0), sy(S.marks[i].y1), S.marks[i], time);
    var h = S.hero;
    if (h && !opts.noHero && S.phase !== 'cont' && S.phase !== 'over') {
      if (h.beam.on) R.beam(ctx, sx(h.beam.ox), sy(h.beam.oy), sx(h.beam.ex), sy(h.beam.ey), time);
      if (S.phase !== 'dead' && !(h.inv > 0 && Math.floor(time * 16) % 2 === 0 && S.phase === 'play')) R.hero(ctx, h, sx(h.x), sy(h.y), time, S);
    }
    for (i = 0; i < S.bullets.length; i++) R.bullet(ctx, S.bullets[i], sx(S.bullets[i].x), sy(S.bullets[i].y));
    for (i = 0; i < S.eb.length; i++) R.ebullet(ctx, S.eb[i], sx(S.eb[i].x), sy(S.eb[i].y), time);
    for (i = 0; i < S.booms.length; i++) R.boom(ctx, sx(S.booms[i].x), sy(S.booms[i].y), S.booms[i]);
    // частицы
    var px = P.pixel ? 2 : 1;
    for (i = 0; i < fx.parts.length; i++) {
      var p = fx.parts[i]; ctx.globalAlpha = Math.max(0, p.t / p.life); ctx.fillStyle = p.color;
      var s = p.size; ctx.fillRect(Math.round(sx(p.x) / px) * px - s / 2, Math.round(sy(p.y) / px) * px - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    if (S.flash > 0) { ctx.fillStyle = P.flash; ctx.globalAlpha = Math.min(0.75, S.flash * 1.2); ctx.fillRect(0, HUD, W, H - HUD); ctx.globalAlpha = 1; if (S.flash > 0.35) R.storm(ctx, W, H, time); }
    if (!opts.bare) {
      for (i = 0; i < fx.toasts.length; i++) {
        var o = fx.toasts[i]; ctx.globalAlpha = Math.min(1, o.t / 0.4);
        txt(g, o.text, sx(o.x), sy(o.y - (o.life - o.t) * 1.2), { size: o.big ? (P.pixel ? 11 : 14) : (P.pixel ? 9 : 11), align: 'center', color: o.color, weight: 900 }, P);
      }
      ctx.globalAlpha = 1;
      if (S.boss && S.bossActive && !S.boss.dead) bossBar(g, ctx, S, P);
      banners(g, ctx, S, P, R);
    }
    ctx.restore();
    if (!opts.bare) hud(g, ctx, S, P, R);
  }

  // ---------- HUD: броня, жизни | оружие, молнии, колесо | зона и таймер | счёт, мини-карта ----------
  function hud(g, ctx, S, P, R) {
    var W = g.W, h = S.hero;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, HUD);
    ctx.fillStyle = P.hudLine; ctx.fillRect(0, HUD - 2, W, 2);
    // броня — сегменты
    txt(g, g.t('hp'), 8, 12, { size: 8, color: P.muted, weight: 800 }, P);
    var hp = Math.max(0, Math.ceil(h.hp));
    for (var i = 0; i < L.HPMAX; i++) {
      var on = i < hp, col = hp <= 2 ? (Math.floor(S.time * 6) % 2 ? P.bad : P.warn) : P.good;
      ctx.fillStyle = on ? col : P.barBg;
      if (P.pixel) ctx.fillRect(8 + i * 9, 16, 7, 9); else { roundRect(ctx, 8 + i * 9, 16, 7, 9, 2); ctx.fill(); }
    }
    for (var l = 0; l < Math.min(6, S.lives); l++) R.lifeIcon(ctx, 92 + l * 13, 21);
    if (S.lives > 6) txt(g, '×' + S.lives, 170, 25, { size: 9, color: P.ink }, P);
    // оружие
    R.weaponIcon(ctx, 196, 16, S.weapon.k);
    txt(g, g.t('w_' + S.weapon.k), 212, 13, { size: 9, color: P.accent, weight: 900 }, P);
    for (var k = 0; k < 3; k++) { ctx.fillStyle = k < S.weapon.lv ? P.accent : P.barBg; ctx.fillRect(212 + k * 8, 18, 6, 6); }
    // молнии
    for (var q = 0; q < L.THUNDER_MAX; q++) R.boltIcon(ctx, 264 + q * 10, 17, q < S.thunder);
    // колесо
    txt(g, g.t('wheel'), 324, 13, { size: 8, color: h.form === 'wheel' ? P.accent : P.muted, weight: 800 }, P);
    bar(ctx, 324, 18, 58, 6, h.charge / L.CHARGE, h.charge >= L.CH_MIN ? P.wheel : P.bad, P);
    // зона и таймер
    var lowT = S.ltime < 30 && !S.bossDone;
    txt(g, g.t('z_' + S.zone), 446, 13, { size: 9, align: 'center', color: P.muted, weight: 700 }, P);
    txt(g, clock(S.ltime), 446, 27, { size: 12, align: 'center', color: lowT ? (Math.floor(S.time * 4) % 2 ? P.bad : P.warn) : P.ink }, P);
    // счёт
    txt(g, String(S.score), 572, 13, { size: 11, align: 'right', color: P.accent }, P);
    txt(g, g.t('level') + ' ' + S.level, 572, 27, { size: 9, align: 'right', color: P.muted, weight: 700 }, P);
    miniMap(ctx, S, P, W - 8, 4);
  }
  function miniMap(ctx, S, P, right, top) {
    var lv = S.lv, cw = 7, ch = 5, x0 = right - lv.RX * cw, rm = Math.floor(S.hero.x / L.RW) + Math.floor((S.hero.y - 0.5) / L.RH) * lv.RX;
    ctx.fillStyle = P.mapBg; ctx.fillRect(x0 - 2, top - 1, lv.RX * cw + 3, lv.RY * ch + 2);
    for (var i = 0; i < lv.rooms.length; i++) {
      var r = lv.rooms[i]; if (!S.visited[i]) continue;
      ctx.fillStyle = r.kind === 'X' ? P.bad : r.kind === 's' ? P.warn : P.mapRoom;
      ctx.fillRect(x0 + r.rx * cw, top + r.ry * ch, cw - 1, ch - 1);
    }
    var br = lv.rooms[lv.bossRoom];
    if (!S.visited[br.i]) { ctx.strokeStyle = P.bad; ctx.lineWidth = 1; ctx.strokeRect(x0 + br.rx * cw + 0.5, top + br.ry * ch + 0.5, cw - 2, ch - 2); }
    if (Math.floor(S.time * 3) % 2 === 0) { var me = lv.rooms[Math.max(0, Math.min(lv.rooms.length - 1, rm))]; ctx.fillStyle = P.ink; ctx.fillRect(x0 + me.rx * cw + 2, top + me.ry * ch + 1, 3, 2); }
  }
  function bossBar(g, ctx, S, P) {
    var b = S.boss, w = 300, x = (g.W - w) / 2, y = HUD + 8;
    txt(g, g.t('b_' + b.key), g.W / 2, y + 6, { size: 9, align: 'center', color: P.bad, weight: 900 }, P);
    bar(ctx, x, y + 10, w, 6, b.hp / b.max, b.shift > 0 ? P.warn : P.bad, P);
    for (var k = 1; k < L.PHASES; k++) { ctx.fillStyle = P.hudBg; ctx.fillRect(x + w * k / L.PHASES - 1, y + 10, 2, 6); }
  }
  function banners(g, ctx, S, P, R) {
    var W = g.W, title = null, sub = null, col = P.ink, y = HUD + 110;
    if (S.phase === 'dead') { title = S.ltime <= 0 ? g.t('timeOut') : g.t('down'); sub = S.lives > 0 ? g.t('lives') + ': ' + S.lives : ''; col = P.bad; }
    else if (S.phase === 'cont') { title = g.t('cont') + ' ' + Math.ceil(S.phaseT); sub = g.t('contHint') + ' (' + S.conts + ')'; col = P.warn; }
    else if (S.phase === 'clear') { title = g.t('clear'); sub = g.t('bonus') + ': +' + (S.lastBonus || 0); col = P.good; }
    else if (S.boss && S.boss.intro > 0 && S.bossActive) { title = g.t('b_' + S.boss.key); sub = g.t('boss') + ' · ' + g.t('z_' + S.zone); col = P.bad; }
    else if (S.banner > 0) { title = g.t('level') + ' ' + S.level + ' · ' + g.t('z_' + S.zone); sub = g.t('find'); col = P.accent; }
    if (!title) return;
    var w = 440, h = 60, x = (W - w) / 2;
    panel(ctx, x, y, w, h, P, col);
    txt(g, title, W / 2, y + 27, { size: P.pixel ? 15 : 19, align: 'center', color: col }, P);
    if (sub) txt(g, sub, W / 2, y + 47, { size: P.pixel ? 8 : 11, align: 'center', color: P.muted, weight: 600 }, P);
  }

  GR.ui = {
    init: function (g, acts) {
      fit(g); addEventListener('resize', function () { fit(g); });
      sync(g); setInterval(function () { sync(g); }, 250);
      // тач-кнопки: удержание (прыжок, огонь, луч) и нажатия (колесо, молния, пауза)
      document.querySelectorAll('.pad [data-hold]').forEach(function (b) {
        var name = b.getAttribute('data-hold');
        var on = function (e) { e.preventDefault(); acts.hold(name, true); }, off = function (e) { e.preventDefault(); acts.hold(name, false); };
        b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off, { passive: false }); b.addEventListener('touchcancel', off, { passive: false });
        b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off);
      });
      document.querySelectorAll('.pad [data-tap]').forEach(function (b) {
        var name = b.getAttribute('data-tap'), h = function (e) { e.preventDefault(); e.stopPropagation(); acts.tap(name); };
        b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h);
      });
    },
    fit: fit, sync: sync, roundRect: roundRect, txt: txt, clock: clock, panel: panel, bar: bar,
    fx: fx, spawn: spawn, toast: toast, updFx: updFx, clearFx: clearFx, render: render, hud: hud, miniMap: miniMap
  };
})(typeof window !== 'undefined' ? window : globalThis);
