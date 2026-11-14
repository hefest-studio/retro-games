/* ОПЕРАЦИЯ · интерфейс вне боя: DOM-обвязка (подгонка канвы, подписи, тема страницы), экран снаряжения
   (миссия, отряд, инструменты, вес → ОД), разбор миссии, экран передачи хода («горячий стул»), фон заставки.
   Кликабельные области экранов — в E.regions (main.js проверяет попадание). OPERATSIYA.ui */
(function (global) {
  'use strict';
  var O = global.OPERATSIYA = global.OPERATSIYA || {};
  var R = O.render, LG = O.logic, Camp = O.Camp, fmt = R.fmt, txt = R.txt, box = R.box, bar = R.bar;
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, pad = document.querySelector('.pad');
    var padH = pad && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 16 : 0;
    var vw = Math.min(innerWidth, document.documentElement.clientWidth || innerWidth);
    var availW = Math.min(vw - 16, 1180), availH = innerHeight - padH - 64;
    var w = Math.max(300, Math.floor(Math.min(availW, availH * g.W / g.H)));
    c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
  }
  var lastLang = null, lastTheme = null;
  function sync(g) {
    var lang = g.i18n.lang, theme = g.themeName;
    if (lang !== lastLang) {
      lastLang = lang; document.documentElement.lang = lang;
      var b = $('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = $('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
      document.querySelectorAll('[data-label]').forEach(function (el) { el.textContent = g.t(el.getAttribute('data-label')); });
    }
    if (theme !== lastTheme) { lastTheme = theme; document.body.setAttribute('data-theme', theme); }
  }
  function init(g) {
    fit(g); addEventListener('resize', function () { fit(g); });
    (function loop() { sync(g); requestAnimationFrame(loop); })();
  }

  function wrap(g, s, x, y, maxW, lh, o, P) {
    var ctx = g.ctx; ctx.font = (o.weight || 700) + ' ' + (o.size || 12) + 'px ' + P.font;
    var words = String(s).split(' '), line = '', n = 0;
    for (var i = 0; i < words.length; i++) {
      var t = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(P.pixel ? t.toUpperCase() : t).width > maxW && line) { txt(g, line, x, y + n * lh, Object.assign({}, o), P); n++; line = words[i]; } else line = t;
    }
    if (line) { txt(g, line, x, y + n * lh, Object.assign({}, o), P); n++; }
    return n;
  }
  function objLine(g, spec) {
    var k = spec.obj;
    if (k === 'hack' || k === 'hold' || k === 'evac') return fmt(g.t('o_' + k), { n: 0, m: spec.need });
    if (k === 'clear') return g.t('o_clear').replace(/: .*/, '');
    return g.t('o_' + k);
  }
  // мини-карта миссии
  function preview(ctx, spec, P, x, y, s) {
    var CH = { '#': P.wall, 'w': P.brick, 'c': P.crate, 'D': P.door, 'B': P.balc, 'H': P.ladder, 'E': P.exit, 'Z': P.zone, 'K': P.core, '~': P.pit, 'q': P.balc, 'j': P.balc };
    spec.map.forEach(function (row, ry) { for (var rx = 0; rx < row.length; rx++) { var ch = row[rx]; ctx.fillStyle = CH[ch] || P.floor; ctx.fillRect(x + rx * s, y + ry * s, s, s);
      if (ch === 'S') { ctx.fillStyle = P.t0; ctx.fillRect(x + rx * s + s * 0.25, y + ry * s + s * 0.25, s * 0.5, s * 0.5); }
      if (ch === 'M') { ctx.fillStyle = P.masterC; ctx.fillRect(x + rx * s + s * 0.25, y + ry * s + s * 0.25, s * 0.5, s * 0.5); } } });
  }

  // ---------- Снаряжение ----------
  function equip(g, ctx, camp, P, E) {
    var W = g.W, H = g.H, spec = Camp.spec(camp), regs = E.regions = [];
    ctx.fillStyle = P.hud; ctx.fillRect(0, 0, W, H);
    txt(g, g.t('eq_title'), 24, 40, { size: 26, color: P.accent, weight: 900 }, P);
    txt(g, fmt(g.t('missionOf'), { n: spec.id, m: O.MISSIONS.length }) + ' · ' + g.t('m_' + spec.id), W - 24, 40, { size: 15, align: 'right', color: P.ink, weight: 800 }, P);
    // карточка миссии
    box(ctx, 20, 60, 300, 470, P, P.panel, P.line, 12);
    txt(g, g.t('m_' + spec.id), 36, 90, { size: 18, color: P.warn, weight: 900 }, P);
    var n = wrap(g, g.t('mb_' + spec.id), 36, 114, 268, 17, { size: 12, color: P.ink, weight: 600, shadow: false }, P);
    var yy = 114 + n * 17 + 12;
    txt(g, '◆ ' + objLine(g, spec), 36, yy, { size: 12, color: P.accent, weight: 800, shadow: false }, P);
    txt(g, fmt(g.t('eq_squad'), { n: Camp.selected(camp).length, m: spec.squad }) + ' · ' + fmt(g.t('eq_turns'), { n: spec.turns }), 36, yy + 20, { size: 12, color: P.muted, weight: 700, shadow: false }, P);
    txt(g, g.t('diff') + ': ' + g.t('d_' + E.diff), 36, yy + 38, { size: 12, color: P.muted, weight: 700, shadow: false }, P);
    preview(ctx, spec, P, 36, 350, 12);
    // таблица отряда
    var tx = 336, cols = { name: tx + 40, wpn: tx + 230, gear: tx + 400, kit: tx + 456, clips: tx + 512, w: tx + 552, ap: tx + 588 };
    var hy = 78;
    [['name', g.t('k_mech')], ['wpn', ''], ['gear', g.t('h_gear')], ['kit', g.t('h_kit')], ['clips', g.t('h_clip')], ['w', g.t('weight')], ['ap', g.t('ap')]].forEach(function (c) {
      txt(g, c[1], cols[c[0]], hy, { size: 10, color: P.muted, weight: 800, shadow: false, align: c[0] === 'name' || c[0] === 'wpn' ? 'left' : 'center' }, P);
    });
    camp.roster.forEach(function (r, i) {
      var y = 90 + i * 66, st = Camp.statsOf(r), on = E.row === i, wgt = Camp.weightOf(r), lim = Camp.limitOf(r), ap = Camp.apOf(r);
      box(ctx, tx, y, 604, 58, P, on ? P.btnOn : P.panel2, on ? P.accent : P.line, 10);
      // отметка «в отряде»
      box(ctx, tx + 10, y + 17, 22, 22, P, r.sel ? P.accent : P.btn, P.muted, 5);
      if (r.sel) txt(g, '✓', tx + 21, y + 34, { size: 15, align: 'center', color: P.hud, weight: 900, shadow: false }, P);
      regs.push({ x: tx, y: y, w: 190, h: 58, act: 'sel', i: i });
      txt(g, g.t('f_' + st.ni), cols.name, y + 22, { size: 13, color: r.sel ? P.ink : P.muted, weight: 900, shadow: false }, P);
      txt(g, g.t('lvl') + ' ' + (r.lvl + 1) + ' · ' + g.t('acc_s') + ' ' + st.acc + ' · ' + g.t('stam_s') + ' ' + st.stam + ' · ' + g.t('hp_s') + ' ' + st.hp, cols.name, y + 38, { size: 10, color: P.muted, weight: 700, shadow: false }, P);
      var nx = Camp.LV_XP[r.lvl + 1]; if (nx) bar(ctx, cols.name, y + 46, 140, 4, r.xp - Camp.LV_XP[r.lvl], nx - Camp.LV_XP[r.lvl], P.warn, P);
      box(ctx, cols.wpn - 6, y + 9, 162, 40, P, P.btn, P.line, 7);
      txt(g, '◂ ' + g.t('w_' + r.load.weapon) + ' ▸', cols.wpn + 75, y + 26, { size: 12, align: 'center', color: P.ink, weight: 800, shadow: false }, P);
      txt(g, g.t('wd_' + r.load.weapon), cols.wpn + 75, y + 41, { size: 9, align: 'center', color: P.muted, weight: 700, shadow: false }, P);
      regs.push({ x: cols.wpn - 6, y: y + 9, w: 162, h: 40, act: 'weapon', i: i });
      ['gear', 'kit', 'clips'].forEach(function (k) {
        box(ctx, cols[k] - 22, y + 13, 44, 32, P, P.btn, P.line, 7);
        txt(g, String(r.load[k]), cols[k], y + 35, { size: 16, align: 'center', color: P.ink, weight: 900, shadow: false }, P);
        regs.push({ x: cols[k] - 22, y: y + 13, w: 44, h: 32, act: k, i: i });
      });
      txt(g, wgt + '/' + lim, cols.w, y + 34, { size: 13, align: 'center', color: wgt > lim ? P.bad : P.ink, weight: 800, shadow: false }, P);
      txt(g, String(ap), cols.ap, y + 34, { size: 15, align: 'center', color: wgt > lim ? P.warn : P.accent, weight: 900, shadow: false }, P);
      if (wgt > lim) txt(g, fmt(g.t('eq_over'), { n: 2 * (wgt - lim) }), cols.w + 20, y + 52, { size: 9, align: 'center', color: P.bad, weight: 700, shadow: false }, P);
    });
    // кнопка «в бой»
    var bx = W - 220, by = 492;
    box(ctx, bx, by, 196, 46, P, P.accent, null, 12);
    txt(g, g.t('eq_go'), bx + 98, by + 30, { size: 18, align: 'center', color: P.hud, weight: 900, shadow: false }, P);
    regs.push({ x: bx, y: by, w: 196, h: 46, act: 'go' });
    wrap(g, g.t('eq_hint'), 336, 506, 400, 15, { size: 10, color: P.muted, weight: 700, shadow: false }, P);
    txt(g, g.t('score') + ' ' + camp.score + (g.state.best ? ' · ' + g.t('best') + ' ' + g.state.best : ''), 336, 560, { size: 12, color: P.muted, weight: 700, shadow: false }, P);
  }

  // ---------- Разбор ----------
  function debrief(g, ctx, P, D) {
    var W = g.W, H = g.H; ctx.fillStyle = P.hud; ctx.fillRect(0, 0, W, H);
    var ok = D.won, col = ok ? P.good : P.bad;
    box(ctx, 140, 50, 680, 500, P, P.panel, col, 14);
    if (D.hot) {
      txt(g, fmt(g.t('hs_win'), { name: g.t('hs_t' + D.winner) }), W / 2, 130, { size: 30, align: 'center', color: D.winner === 0 ? P.good : P.bad, weight: 900 }, P);
      txt(g, g.t('m_0') + ' · ' + g.t('turn') + ' ' + D.turn, W / 2, 166, { size: 14, align: 'center', color: P.muted, weight: 700 }, P);
      txt(g, g.t('db_next'), W / 2, 520, { size: 13, align: 'center', color: P.muted, weight: 700 }, P);
      return;
    }
    txt(g, g.t(ok ? 'db_win' : 'db_fail'), W / 2, 104, { size: 30, align: 'center', color: col, weight: 900 }, P);
    txt(g, g.t('m_' + D.spec.id) + ' · ' + g.t('r_' + D.reason), W / 2, 134, { size: 15, align: 'center', color: P.ink, weight: 700 }, P);
    txt(g, g.t('db_turns') + ': ' + D.turn + ' · ' + g.t('db_kills') + ': ' + D.kills + ' · ' + g.t('score') + ': +' + D.score, W / 2, 160, { size: 13, align: 'center', color: P.muted, weight: 700 }, P);
    (D.units || []).forEach(function (u, i) {
      var y = 200 + i * 44, r = D.camp.roster.filter(function (q) { return q.id === u.rkey; })[0], st = r ? Camp.statsOf(r) : { ni: 0 };
      box(ctx, 190, y, 580, 36, P, P.panel2, P.line, 8);
      txt(g, g.t('f_' + st.ni), 206, y + 23, { size: 14, color: P.ink, weight: 800, shadow: false }, P);
      txt(g, u.evac ? '⇪' : u.alive ? '✓' : '✕', 430, y + 23, { size: 15, align: 'center', color: u.alive ? P.good : P.bad, weight: 900, shadow: false }, P);
      txt(g, fmt(g.t('db_xp'), { n: D.rep.xp[u.rkey] || 0 }) + ' · ' + g.t('db_kills') + ' ' + (u.kills | 0), 470, y + 23, { size: 12, color: P.muted, weight: 700, shadow: false }, P);
      if (D.rep.promos.indexOf(u.rkey) >= 0) txt(g, g.t('db_up') + ' ' + g.t('lvl') + ' ' + (r.lvl + 1), 754, y + 23, { size: 12, align: 'right', color: P.warn, weight: 900, shadow: false }, P);
    });
    txt(g, g.t('db_total') + ': ' + D.total + (g.state.best ? ' · ' + g.t('best') + ': ' + g.state.best : ''), W / 2, 490, { size: 15, align: 'center', color: P.accent, weight: 800 }, P);
    txt(g, g.t(ok ? 'db_next' : 'db_retry'), W / 2, 524, { size: 13, align: 'center', color: P.muted, weight: 700 }, P);
  }
  function handoff(g, ctx, P, side) {
    var W = g.W, H = g.H; ctx.fillStyle = P.hud; ctx.fillRect(0, 0, W, H);
    var col = side === 0 ? P.t0 : P.t1;
    box(ctx, W / 2 - 280, H / 2 - 110, 560, 220, P, P.panel, col, 16);
    txt(g, g.t('hs_pass'), W / 2, H / 2 - 50, { size: 18, align: 'center', color: P.muted, weight: 800 }, P);
    txt(g, g.t('hs_t' + side), W / 2, H / 2 + 4, { size: 34, align: 'center', color: col, weight: 900 }, P);
    txt(g, g.t('hs_tap'), W / 2, H / 2 + 60, { size: 13, align: 'center', color: P.ink, weight: 700 }, P);
  }

  O.ui = { init: init, fit: fit, sync: sync, equip: equip, debrief: debrief, handoff: handoff, wrap: wrap, preview: preview, objLine: objLine };
})(typeof window !== 'undefined' ? window : globalThis);
