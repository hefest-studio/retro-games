/* ЖЕОДА · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема, кнопка паузы),
   общий рендер мира (камера, отсечение, порядок слоёв), HUD, карта жеод (хаб), баннеры, всплывашки.
   Внешний вид клеток/предметов/персонажей — у темы R (ZHEODA.modern / ZHEODA.classic). Тексты — только g.t(). */
(function (global) {
  'use strict';
  var Z = global.ZHEODA = global.ZHEODA || {};
  var T = 32, OY = 40;          // клетка в px, высота HUD
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, wrap = c.parentElement;
    var pad = document.querySelector('.pad'), padH = pad && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 20 : 0;
    var availH = innerHeight - padH - 70;
    var w = Math.min(960, (wrap && wrap.clientWidth) || g.W, availH * g.W / g.H);
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

  // ---------- Примитивы ----------
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function txt(g, s, x, y, o, P) { o = o || {}; if (P.font) o.font = P.font; g.text(s, x, y, o); }
  function up(P, s) { return P.pixel ? String(s).toUpperCase() : String(s); }
  function panel(ctx, x, y, w, h, P, border) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = border || P.line; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3); ctx.fillRect(x, y, 3, h); ctx.fillRect(x + w - 3, y, 3, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 24; ctx.fillStyle = P.panel; roundRect(ctx, x, y, w, h, 14); ctx.fill(); ctx.restore();
      ctx.strokeStyle = border || P.line; ctx.lineWidth = 1.5; roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 14); ctx.stroke();
    }
  }

  // ---------- Мир ----------
  // Камера: S.cam (в клетках) → экран. В retro — привязка к пикселю.
  function camera(S, P) {
    var cx = S.cam.x * T, cy = S.cam.y * T;
    if (P.pixel) { cx = Math.round(cx / 2) * 2; cy = Math.round(cy / 2) * 2; }
    return { x: cx, y: cy };
  }
  function drawWorld(ctx, S, g, R, opt) {
    opt = opt || {};
    var P = R.P, W = g.W, H = g.H, cam = camera(S, P), t = S.time;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, OY, W, H - OY); ctx.clip();
    R.bg(ctx, g, S, cam);
    ctx.translate(-cam.x, OY - cam.y);
    var x0 = Math.max(0, Math.floor(cam.x / T) - 1), x1 = Math.min(S.cols - 1, Math.ceil((cam.x + W) / T) + 1);
    var y0 = Math.max(0, Math.floor(cam.y / T) - 1), y1 = Math.min(S.rows - 1, Math.ceil((cam.y + H - OY) / T) + 1);
    var grid = S.grid, C = S.cols, x, y, ch;
    // клетки
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) {
      ch = grid[y * C + x];
      if (ch !== '.') R.tile(ctx, ch, x * T, y * T, S, x, y);
    }
    function vis(px, py) { return px > x0 - 2 && px < x1 + 2 && py > y0 - 3 && py < y1 + 3; }
    // выход, рычаги, сферы, лифты
    if (S.exit && vis(S.exit.cx, S.exit.cy)) R.exit(ctx, S.exit.cx * T, S.exit.cy * T, S.exitOpen, t);
    S.levers.forEach(function (l) { if (vis(l.cx, l.cy)) R.lever(ctx, l.cx * T, l.cy * T, l.on, t); });
    S.orbs.forEach(function (o) { if (vis(o.cx, o.cy)) R.orb(ctx, o.x * T, o.y * T, S.gs, t); });
    S.lifts.forEach(function (L) { R.lift(ctx, L.x * T, L.y * T, L.w * T, t, L); });
    // предметы
    S.items.forEach(function (it) { if (!it.taken && vis(it.cx, it.cy)) R.item(ctx, it.k, it.x * T, it.y * T, t, it); });
    S.stal.forEach(function (s) { if (s.state !== 'gone' && vis(s.cx, s.y)) R.stal(ctx, s.x * T, s.y * T, s.state, t); });
    S.dynas.forEach(function (d) { R.dynaLit(ctx, d.x * T, d.y * T, d.t, t); });
    // обитатели, Исполин
    S.enemies.forEach(function (e) { if (!e.dead && vis(e.x, e.y)) R.enemy(ctx, e, e.x * T, e.y * T, S.gs, t); });
    if (S.boss && !S.boss.dead) R.boss(ctx, S.boss, S.boss.x * T, S.boss.y * T, S.gs, t);
    // героиня
    var p = S.pl;
    if (p && S.phase !== 'hub' && !opt.noHero) {
      var blink = p.inv > 0 && S.phase === 'play' && Math.floor(t * 14) % 2 === 0;
      if (S.phase === 'dead') R.heroDown(ctx, p.x * T, p.y * T, p, S.phaseT);
      else if (!blink) R.hero(ctx, p.x * T, p.y * T, p, t, S);
    }
    // снаряды и эффекты
    S.shots.forEach(function (s) { R.shot(ctx, s.x * T, s.y * T, s.vx, t); });
    S.pebbles.forEach(function (s) { R.pebble(ctx, s.x * T, s.y * T, t); });
    S.shards.forEach(function (s) { R.shard(ctx, s.x * T, s.y * T, s.vx, s.vy, t); });
    (S.waves || []).forEach(function (w) { R.wave(ctx, w.x * T, w.y * T, w.gs, t); });
    S.blasts.forEach(function (b) { R.blast(ctx, b.x * T, b.y * T, b.t); });
    ctx.restore();
    // свет фонаря (modern) — поверх мира, под HUD
    if (R.light) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, OY, W, H - OY); ctx.clip();
      R.light(ctx, g, S, p ? (p.x + 0.35) * T - cam.x : W / 2, p ? (p.y + 0.5) * T + OY - cam.y : H / 2);
      ctx.restore();
    }
  }
  // Частицы движка рисуются в экранных координатах: перевод из клеток
  function toScreen(S, P, x, y) { var cam = camera(S, P); return { x: x * T - cam.x, y: y * T + OY - cam.y }; }

  // ---------- HUD ----------
  function hud(g, ctx, S, R) {
    var P = R.P, W = g.W;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, OY);
    ctx.fillStyle = P.hudLine; ctx.fillRect(0, OY - 2, W, 2);
    var lvName = up(P, g.t('lv_' + S.name));
    txt(g, up(P, g.t('level')) + ' ' + S.level, 12, 17, { size: 13, color: P.ink }, P);
    txt(g, lvName, 12, 33, { size: 10, color: P.muted, weight: 700 }, P);
    // кристаллы
    var x = 160;
    if (!S.bossLevel) {
      R.item(ctx, '*', x, 20, S.time, null, 0.75);
      txt(g, (S.crystals - S.crystalsLeft) + '/' + S.crystals, x + 14, 26, { size: 15, color: S.crystalsLeft ? P.ink : P.good }, P);
    } else if (S.boss) {
      var B = S.boss, bw = 150, f = Math.max(0, B.hp / B.max);
      txt(g, up(P, g.t('boss')), x - 4, 15, { size: 9, color: P.muted, weight: 700 }, P);
      ctx.fillStyle = P.bar; if (P.pixel) ctx.fillRect(x - 4, 21, bw, 9); else { roundRect(ctx, x - 4, 21, bw, 9, 4.5); ctx.fill(); }
      if (f > 0) { ctx.fillStyle = P.bossBar; if (P.pixel) ctx.fillRect(x - 4, 21, Math.round(bw * f / 3) * 3, 9); else { roundRect(ctx, x - 4, 21, Math.max(9, bw * f), 9, 4.5); ctx.fill(); } }
    }
    // заряды, взрывчатка, ключи
    x = S.bossLevel ? 330 : 250;
    R.icon(ctx, 'ammo', x, 20); txt(g, String(S.ammo), x + 13, 26, { size: 14, color: S.ammo ? P.ink : P.bad }, P);
    x += 52; R.icon(ctx, 'dyn', x, 20); txt(g, String(S.dyn), x + 12, 26, { size: 14, color: S.dyn ? P.ink : P.muted }, P);
    if (!S.bossLevel) { x += 46; ['R', 'B', 'Y'].forEach(function (k, i) { R.icon(ctx, S.keys[k] ? 'key' + k : 'keyOff', x + i * 20, 20); }); }
    // счёт
    txt(g, String(S.score), W - 166, 27, { size: 18, align: 'right', color: P.accent }, P);
    // здоровье и жизни
    for (var i = 0; i < 3; i++) R.icon(ctx, i < S.hp ? 'hp' : 'hpOff', W - 148 + i * 20, 20);
    var n = Math.max(3, S.lives);
    for (i = 0; i < n; i++) R.icon(ctx, i < S.lives ? 'life' : 'lifeOff', W - 66 + i * 20, 20);
  }

  // ---------- Карта жеод (хаб) ----------
  // Узлы: эпизод 1 — верхняя дуга, эпизод 2 — нижняя, финал — в центре внизу
  function hubNodes(g) {
    var out = [], W = g.W;
    for (var i = 0; i < 8; i++) out.push({ x: 70 + i * 71, y: 150 + Math.sin(i * 0.9) * 16, ep: 1 });
    for (i = 0; i < 8; i++) out.push({ x: W - 70 - i * 71, y: 262 + Math.sin(i * 0.9 + 1) * 16, ep: 2 });
    out.push({ x: W / 2, y: 345, ep: 3, boss: true });
    return out;
  }
  function hub(g, ctx, S, R) {
    var P = R.P, W = g.W, H = g.H, t = S.time, nodes = hubNodes(g), max = S.maxLevel;
    R.hubBg(ctx, g, t);
    txt(g, up(P, g.t('hubTitle')), W / 2, 34, { size: 22, align: 'center', color: P.accent }, P);
    txt(g, up(P, g.t('ep1')), 70, 112, { size: 12, color: P.muted, weight: 700 }, P);
    txt(g, up(P, g.t('ep2')), W - 70, 224, { size: 12, align: 'right', color: P.muted, weight: 700 }, P);
    // тропа
    for (var i = 0; i < nodes.length - 1 && i < max - 1; i++) R.hubPath(ctx, nodes[i], nodes[i + 1], i + 2 <= S.open, t);
    for (i = 0; i < nodes.length && i < max; i++) {
      var n = i + 1, st = S.cleared[n] ? 'done' : n <= S.open ? 'open' : 'locked';
      R.hubNode(ctx, nodes[i], n, st, n === S.hubSel, t);
    }
    // карточка выбранного уровня
    var sel = S.hubSel, nd = nodes[sel - 1], name = g.t('lv_' + Z.logic.LEVELS[sel - 1].name);
    var st2 = S.cleared[sel] ? g.t('hubDone') : sel <= S.open ? g.t('hubNext') : g.t('hubLocked');
    var cw = 250, chh = 50, cx = Math.max(10, Math.min(W - cw - 10, nd.x - cw / 2)), cy = nd.y > 300 ? nd.y - 92 : nd.y + 30;
    panel(ctx, cx, cy, cw, chh, P, sel <= S.open && !S.cleared[sel] ? P.accent : P.line);
    txt(g, up(P, g.t('level')) + ' ' + sel + ' · ' + up(P, name), cx + cw / 2, cy + 22, { size: 14, align: 'center', color: P.ink }, P);
    txt(g, up(P, st2), cx + cw / 2, cy + 40, { size: 11, align: 'center', color: S.cleared[sel] ? P.good : sel <= S.open ? P.accent : P.muted, weight: 700 }, P);
    txt(g, g.t('hubHint'), W / 2, H - 12, { size: 12, align: 'center', color: P.muted, weight: 600 }, P);
    // счёт/жизни внизу слева
    txt(g, g.t('score') + ': ' + S.score, 14, H - 12, { size: 12, color: P.ink, weight: 700 }, P);
    for (i = 0; i < S.lives; i++) R.icon(ctx, 'life', W - 20 - i * 20, H - 16);
  }

  // ---------- Баннеры ----------
  function banner(g, ctx, S, R) {
    var P = R.P, title = null, sub = null, col = P.ink;
    if (S.phase === 'play' && S.banner > 0) {
      title = up(P, g.t('ready')) + ' ' + S.level + ' · ' + up(P, g.t('lv_' + S.name));
      var tip = Z.logic.LEVELS[S.level - 1].tip;
      sub = S.bossLevel ? g.t('bossGoal') : tip ? g.t('tip_' + tip) : g.t('goal'); col = P.accent;
    } else if (S.phase === 'clear') { title = g.t('clear'); sub = g.t('bonus') + ' +' + (S.clearBonus || 0); col = P.good; }
    else if (S.phase === 'dead') { title = g.t('lost'); sub = g.t('lives') + ': ' + S.lives; col = P.bad; }
    if (!title) return;
    var a = S.phase === 'play' ? Math.min(1, S.banner / 0.4) : 1;
    var w = 470, h = 70, x = (g.W - w) / 2, y = 64;
    ctx.save(); ctx.globalAlpha = a;
    panel(ctx, x, y, w, h, P, col);
    txt(g, up(P, title), g.W / 2, y + 31, { size: P.pixel ? 17 : 19, align: 'center', color: col }, P);
    txt(g, up(P, sub), g.W / 2, y + 54, { size: P.pixel ? 10 : 12, align: 'center', color: P.muted, weight: 600 }, P);
    ctx.restore();
  }
  function toasts(g, ctx, list, P) {
    for (var i = 0; i < list.length; i++) {
      var o = list[i], a = Math.min(1, o.t / 0.4);
      ctx.globalAlpha = a;
      txt(g, up(P, o.text), o.x, o.y - (1.4 - o.t) * 26, { size: o.big ? 15 : 12, align: 'center', color: o.color, weight: 900 }, P);
    }
    ctx.globalAlpha = 1;
  }

  Z.ui = {
    T: T, OY: OY,
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
    fit: fit, sync: sync, roundRect: roundRect, txt: txt, up: up, panel: panel,
    drawWorld: drawWorld, toScreen: toScreen, camera: camera, hud: hud, hub: hub, hubNodes: hubNodes, banner: banner, toasts: toasts
  };
})(typeof window !== 'undefined' ? window : globalThis);
