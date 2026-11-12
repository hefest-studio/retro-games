/* ПУЗЫРЬ · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема) и общие для обеих тем
   элементы на канве — HUD (жизни, счёт, слово «ГЕФЕСТ», уровень), баннеры, всплывашки.
   Палитру P и значки передаёт активный рендерер (modern/classic), тексты — только через g.t(). PUZYR.ui */
(function (global) {
  'use strict';
  var Z = global.PUZYR = global.PUZYR || {};
  var T = 20, OY = 40;   // клетка поля и высота HUD
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, wrap = c.parentElement;
    var pad = document.querySelector('.pad'), padH = pad && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 20 : 0;
    var availH = innerHeight - padH - 70;
    var w = Math.min(g.W * 1.5, (wrap && wrap.clientWidth) || g.W, availH * g.W / g.H);
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
  function panel(ctx, x, y, w, h, P, edge) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = edge || P.accent; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3); ctx.fillRect(x, y, 3, h); ctx.fillRect(x + w - 3, y, 3, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 24;
      ctx.fillStyle = P.panel; roundRect(ctx, x, y, w, h, 16); ctx.fill(); ctx.restore();
      ctx.strokeStyle = edge || P.line; ctx.lineWidth = 1.5; roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 16); ctx.stroke();
    }
  }

  // Блок игрока: лицо, имя, жизни; у отсутствующего И2 — приглашение «жми 2»
  function playerBlock(g, ctx, S, i, R) {
    var P = R.P, W = g.W, right = i === 1, p = S.players[i], cx = right ? W - 22 : 22;
    if (!p) {
      if (Math.floor(S.time * 2) % 2 === 0) txt(g, up(P, g.t('press2')), W - 10, 25, { size: 11, align: 'right', color: P.muted, weight: 700 }, P);
      return;
    }
    ctx.globalAlpha = p.out ? 0.35 : 1;
    R.face(ctx, cx, 20, i, 0.8);
    var lx = right ? cx - 20 : cx + 20, al = right ? 'right' : 'left';
    txt(g, up(P, g.t(i ? 'p2' : 'p1')), lx, 16, { size: 11, align: al, color: P.pl[i], weight: 800 }, P);
    txt(g, p.out ? up(P, g.t('out')) : '×' + Math.max(0, p.lives), lx, 33, { size: 14, align: al, color: P.ink, weight: 900 }, P);
    ctx.globalAlpha = 1;
  }
  function hud(g, ctx, S, R) {
    var P = R.P, W = g.W;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, OY);
    ctx.fillStyle = P.hudLine; ctx.fillRect(0, OY - 2, W, 2);
    txt(g, String(S.score), W / 2, 19, { size: 18, align: 'center', color: P.accent, weight: 900 }, P);
    // слово «ГЕФЕСТ»: собранные буквы — яркие
    var word = g.t('word'), n = word.length, sp = 15, x0 = W / 2 - (n - 1) * sp / 2;
    for (var i = 0; i < n; i++) {
      var on = S.letters[i];
      txt(g, word[i], x0 + i * sp, 34, { size: 11, align: 'center', color: on ? P.letter : P.dim, weight: 900 }, P);
    }
    var B = S.boss;
    if (B && B.alive && !B.trapped) {
      var bw = 120, bx = W / 2 + 70, by = 15, f = Math.max(0, B.hp / B.max);
      ctx.fillStyle = P.bar; if (P.pixel) ctx.fillRect(bx, by, bw, 8); else { roundRect(ctx, bx, by, bw, 8, 4); ctx.fill(); }
      if (f > 0) { ctx.fillStyle = P.bossBar; if (P.pixel) ctx.fillRect(bx, by, Math.round(bw * f / 4) * 4, 8); else { roundRect(ctx, bx, by, Math.max(8, bw * f), 8, 4); ctx.fill(); } }
      txt(g, up(P, g.t('boss')), bx + bw / 2, by + 20, { size: 9, align: 'center', color: P.muted, weight: 700 }, P);
    } else {
      txt(g, up(P, g.t('level')) + ' ' + S.level, W / 2 - 110, 19, { size: 12, align: 'center', color: P.ink, weight: 800 }, P);
      txt(g, up(P, g.t('z_' + S.zone)), W / 2 - 110, 33, { size: 9, align: 'center', color: P.muted, weight: 700 }, P);
      if (S.hurry && Math.floor(S.time * 3) % 2 === 0) txt(g, up(P, g.t(S.angryAll ? 'angry' : 'hurry')), W / 2 + 110, 25, { size: 11, align: 'center', color: P.bad, weight: 900 }, P);
    }
    playerBlock(g, ctx, S, 0, R);
    playerBlock(g, ctx, S, 1, R);
  }

  function banner(g, ctx, S, R) {
    var P = R.P, title = null, sub = null, col = P.ink;
    if (S.phase === 'ready') {
      title = S.boss ? g.t('z_boss') : g.t('ready') + ' ' + S.level + ' · ' + g.t('z_' + S.zone);
      sub = S.boss ? g.t('bossGoal') : g.t('goal'); col = P.accent;
    } else if (S.phase === 'clear' && S.phaseT > 1.2) { title = g.t('clear'); col = P.good; }
    if (!title) return;
    var w = 440, h = sub ? 74 : 54, x = (g.W - w) / 2, y = OY + 8 * T;
    panel(ctx, x, y, w, h, P, col);
    txt(g, up(P, title), g.W / 2, y + (sub ? 32 : 35), { size: P.pixel ? 18 : 21, align: 'center', color: col, weight: 900 }, P);
    if (sub) txt(g, up(P, sub), g.W / 2, y + 56, { size: P.pixel ? 10 : 12, align: 'center', color: P.muted, weight: 600 }, P);
  }

  // Всплывающие подписи (очки, бонусы, буквы)
  function toasts(g, ctx, list, P) {
    for (var i = 0; i < list.length; i++) {
      var o = list[i], a = Math.min(1, o.t / 0.4);
      ctx.globalAlpha = a;
      if (!P.pixel) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4; }
      txt(g, up(P, o.text), o.x, o.y - (1.4 - o.t) * 22, { size: o.big ? (P.pixel ? 14 : 16) : (P.pixel ? 10 : 12), align: 'center', color: o.color, weight: 900 }, P);
      if (!P.pixel) ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  Z.ui = {
    T: T, OY: OY,
    init: function (g) { fit(g); addEventListener('resize', function () { fit(g); }); sync(g); setInterval(function () { sync(g); }, 250); },
    fit: fit, sync: sync, roundRect: roundRect, txt: txt, up: up, panel: panel, hud: hud, banner: banner, toasts: toasts
  };
})(typeof window !== 'undefined' ? window : globalThis);
