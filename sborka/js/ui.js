/* СБОРКА · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема), кадр боя (мир — retro в буфер ½ и ×2
   без сглаживания), HUD ресурсов, нижняя панель приказов, миникарта, конструктор роботов, выбор карты, итог боя.
   Каждый кадр собирает список кликабельных зон ui.hits = [{x,y,w,h,act,arg}] — main.js проверяет их по указателю.
   Тексты — только через g.t(). SBORKA.ui */
(function (global) {
  'use strict';
  var SB = global.SBORKA = global.SBORKA || {};
  var W = 640, H = 512, HUD = 32, BAR = 40, FH = H - HUD - BAR, ZOOM = 1.6, VW = W / ZOOM, VH = FH / ZOOM;
  var ui = SB.ui = { W: W, H: H, HUD: HUD, BAR: BAR, FH: FH, ZOOM: ZOOM, VW: VW, VH: VH, hits: [] };
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  ui.fit = function (g) {
    var c = g.canvas, pad = document.querySelector('.pad');
    var padH = pad && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 16 : 0;
    var vw = Math.min(innerWidth, document.documentElement.clientWidth || innerWidth);
    var availW = Math.min(vw - 16, 1000), availH = innerHeight - padH - 64;
    var w = Math.max(280, Math.floor(Math.min(availW, availH * g.W / g.H)));
    c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
  };
  var lastLang = null, lastTheme = null;
  ui.sync = function (g) {
    var lang = g.i18n.lang, theme = g.themeName;
    if (lang !== lastLang) {
      lastLang = lang; document.documentElement.lang = lang;
      var b = $('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = $('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
      document.querySelectorAll('[data-label]').forEach(function (el) { el.textContent = g.t(el.getAttribute('data-label')); });
    }
    if (theme !== lastTheme) { lastTheme = theme; document.body.setAttribute('data-theme', theme); }
  };
  ui.init = function (g) {
    var go = function () { ui.fit(g); };
    addEventListener('resize', go); go();
    setInterval(function () { ui.sync(g); }, 200); ui.sync(g);
  };

  // ---------- Примитивы ----------
  function txt(g, s, x, y, o, P) {
    o = o || {}; o.font = P.font; if (P.pixel && o.up !== false) s = String(s).toUpperCase();
    if (o.shadow) { var c = o.color; o.color = P.pixel ? '#000000' : 'rgba(0,0,0,.6)'; g.text(s, x + 1, y + 1, o); o.color = c; }
    g.text(s, x, y, o);
  }
  function panel(ctx, x, y, w, h, P, edge) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = edge || P.line; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3); ctx.fillRect(x, y, 3, h); ctx.fillRect(x + w - 3, y, 3, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 18; SB.render.rrect(ctx, x, y, w, h, 12, P.panel); ctx.restore();
      ctx.strokeStyle = edge || P.line; ctx.lineWidth = 1.5; SB.render.rrect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 12); ctx.stroke();
    }
  }
  function button(g, ctx, x, y, w, h, label, P, o) {
    o = o || {}; var on = o.on, dis = o.dis;
    if (P.pixel) { ctx.fillStyle = on ? P.accent : P.barBg; ctx.fillRect(x, y, w, h); if (!on) { ctx.fillStyle = P.line; ctx.fillRect(x, y + h - 2, w, 2); } }
    else { SB.render.rrect(ctx, x, y, w, h, 7, on ? P.accent : 'rgba(255,255,255,.07)'); ctx.strokeStyle = on ? P.accent : P.line; ctx.lineWidth = 1; SB.render.rrect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 7); ctx.stroke(); }
    var col = on ? (P.pixel ? '#000000' : '#16181d') : dis ? P.muted : P.ink;
    if (o.key) { txt(g, o.key, x + w / 2, y + 12, { size: 9, align: 'center', color: on ? col : P.muted, weight: 700 }, P); txt(g, label, x + w / 2, y + h - 7, { size: o.size || 10, align: 'center', color: col, weight: 800 }, P); }
    else txt(g, label, x + w / 2, y + h / 2 + 4, { size: o.size || 12, align: 'center', color: col, weight: 800 }, P);
    if (o.act) ui.hits.push({ x: x, y: y, w: w, h: h, act: o.act, arg: o.arg });
  }
  ui.txt = txt; ui.panel = panel; ui.button = button;
  function bar(ctx, x, y, w, h, f, col, P) { ctx.fillStyle = P.barBg; ctx.fillRect(x, y, w, h); ctx.fillStyle = col; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, f)), h); }
  function mmss(t) { t = Math.max(0, Math.floor(t)); return (t / 60 | 0) + ':' + ('0' + t % 60).slice(-2); }
  ui.mmss = mmss;
  function wrap(g, s, x, y, maxW, lh, o, P) {
    var ctx = g.ctx; ctx.font = (o.weight || 600) + ' ' + (o.size || 11) + 'px ' + P.font;
    var words = String(s).split(' '), line = '', n = 0;
    for (var i = 0; i < words.length; i++) {
      var t = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(P.pixel ? t.toUpperCase() : t).width > maxW && line) { txt(g, line, x, y + n * lh, o, P); n++; line = words[i]; } else line = t;
    }
    if (line) { txt(g, line, x, y + n * lh, o, P); n++; }
    return n;
  }
  ui.wrap = wrap;
  function tplName(g, d) { var L = SB.logic, n = L.norm(d); for (var k in L.TPL) { var t = L.norm(L.TPL[k]); if (t.chassis === n.chassis && t.brain === n.brain && t.w.join() === n.w.join()) return g.t('t_' + k); } return g.t('k_custom'); }
  ui.tplName = tplName;

  // ---------- Мир ----------
  var buf = null, bctx = null;
  ui.world = function (g, ctx, S, P, cam, o) {
    var view = { x: cam.x, y: cam.y, w: VW, h: VH };
    if (P.pixel) {
      if (!buf) { buf = document.createElement('canvas'); buf.width = W / 2; buf.height = FH / 2; bctx = buf.getContext('2d'); }
      var k = ZOOM / 2;
      bctx.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k); bctx.imageSmoothingEnabled = false;
      bctx.fillStyle = '#000'; bctx.fillRect(cam.x, cam.y, VW, VH);
      SB.render.world(bctx, S, P, view, o);
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(buf, 0, HUD, W, FH); ctx.restore();
    } else {
      ctx.save(); ctx.beginPath(); ctx.rect(0, HUD, W, FH); ctx.clip();
      ctx.translate(0, HUD); ctx.scale(ZOOM, ZOOM); ctx.translate(-cam.x, -cam.y);
      ctx.fillStyle = '#000'; ctx.fillRect(cam.x, cam.y, VW, VH);
      SB.render.world(ctx, S, P, view, o);
      ctx.restore();
    }
  };
  ui.mmRect = function (S) { var sc = Math.min(2, 150 / S.map.w), w = S.map.w * sc, h = S.map.h * sc; return { x: W - w - 8, y: HUD + 8, w: w, h: h, sc: sc }; };

  // ---------- HUD ----------
  ui.hud = function (g, ctx, S, P, o) {
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, HUD);
    ctx.fillStyle = P.line; ctx.fillRect(0, HUD - 1, W, 1);
    var R = S.res[0], x = 10;
    SB.logic.RES.forEach(function (r) {
      SB.render.icon(ctx, r, x + 6, 16, 11, P.res[r], P);
      txt(g, String(R[r] | 0), x + 15, 21, { size: 13, color: P.ink, weight: 800 }, P);
      x += 46;
    });
    var mine = S.robots.filter(function (q) { return q.side === 0; }).length, theirs = S.robots.length - mine;
    txt(g, g.t('robots') + ' ' + mine + '/' + SB.logic.ROBOT_CAP, 248, 21, { size: 12, color: P.team[0], weight: 800 }, P);
    txt(g, '· ' + theirs, 350, 21, { size: 12, color: P.team[1], weight: 800 }, P);
    txt(g, mmss(S.time), 420, 21, { size: 13, color: P.ink, weight: 800 }, P);
    txt(g, o.mapName, W - 10, 21, { size: 12, align: 'right', color: P.muted, weight: 700 }, P);
  };

  // ---------- Нижняя панель: выбор и приказы ----------
  var ORD = ['capture', 'robots', 'factories', 'guard', 'follow'];
  ui.bar = function (g, ctx, S, P, o) {
    var y = H - BAR; ctx.fillStyle = P.hudBg; ctx.fillRect(0, y, W, BAR); ctx.fillStyle = P.line; ctx.fillRect(0, y, W, 1);
    var sel = o.selList, poss = S.poss != null ? S.robots.filter(function (r) { return r.id === S.poss; })[0] : null, one = poss || (sel.length === 1 ? sel[0] : null);
    if (one) {
      SB.render.robot(ctx, { d: one.d, side: 0, ang: -Math.PI / 2, x: 20, y: y + 20, moving: false, core: one.core }, P, o.time, 1.3);
      txt(g, poss ? g.t('poss') : tplName(g, one.d), 38, y + 16, { size: 11, color: poss ? P.warn : P.ink, weight: 800 }, P);
      bar(ctx, 38, y + 23, 80, 4, one.hp / one.max, one.hp / one.max > 0.5 ? P.good : one.hp / one.max > 0.25 ? P.warn : P.bad, P);
      txt(g, poss ? (one.core ? 'X — ' + g.t('w_core') : g.t('c_' + one.d.chassis)) : g.t('o_' + one.order.kind), 38, y + 36, { size: 10, color: P.muted, weight: 700 }, P);
    } else if (sel.length > 1) {
      txt(g, sel.length + ' ' + g.t('nSel'), 12, y + 18, { size: 12, color: P.ink, weight: 800 }, P);
      txt(g, g.t('o_' + sel[0].order.kind), 12, y + 33, { size: 10, color: P.muted, weight: 700 }, P);
    } else {
      wrap(g, g.t('none'), 10, y + 16, 200, 13, { size: 10, color: P.muted, weight: 700 }, P);
    }
    var bx = 222, bw = 57, has = sel.length > 0 && !poss;
    ORD.forEach(function (k, i) {
      var on = has && sel.every(function (r) { return r.order.kind === k; }) || (k === 'guard' && o.guardPick);
      button(g, ctx, bx + i * (bw + 2), y + 3, bw, BAR - 6, g.t('ob_' + k), P, { key: String(i + 1), on: on, dis: !has, act: 'order', arg: k });
    });
    button(g, ctx, bx + 5 * (bw + 2), y + 3, bw, BAR - 6, g.t(poss ? 'bb_out' : 'bb_poss'), P, { key: 'F', on: !!poss, dis: !poss && sel.length !== 1, act: 'poss' });
    button(g, ctx, bx + 6 * (bw + 2), y + 3, bw, BAR - 6, g.t('bb_build'), P, { key: 'B', on: !!o.kOpen, act: 'build' });
  };

  // ---------- Кадр боя ----------
  ui.play = function (g, ctx, S, P, cam, o) {
    ui.hits = [];
    ui.world(g, ctx, S, P, cam, { sel: o.sel, time: o.time });
    var mm = ui.mmRect(S); SB.render.minimap(ctx, S, P, mm, { x: cam.x, y: cam.y, w: VW, h: VH }, { sel: o.sel });
    ui.hud(g, ctx, S, P, o);
    ui.bar(g, ctx, S, P, o);
    // удержание всех заводов — обратный отсчёт
    var L = SB.logic;
    for (var s = 0; s < 2; s++) if (S.allT[s] > 0 && S.phase === 'play') {
      var left = Math.ceil(L.HOLD_ALL_T - S.allT[s]);
      txt(g, g.t(s ? 'holdAllE' : 'holdAll') + ' ' + mmss(left), W / 2 - 70, HUD + 22, { size: 14, align: 'center', color: s ? P.bad : P.good, weight: 900, shadow: true }, P);
    }
    // всплывающие надписи
    (o.toasts || []).forEach(function (t, i) {
      ctx.globalAlpha = Math.min(1, t.t * 2);
      txt(g, t.text, W / 2 - 70, HUD + 52 + i * 18, { size: 13, align: 'center', color: t.color, weight: 800, shadow: true }, P);
      ctx.globalAlpha = 1;
    });
    // баннер начала боя
    if (o.banner > 0) {
      ctx.globalAlpha = Math.min(1, o.banner);
      var bw = 470, bh = 74, bx = (W - 150 - bw) / 2 + 10, by = HUD + 140;
      panel(ctx, bx, by, bw, bh, P, P.accent);
      txt(g, o.mapName, bx + bw / 2, by + 26, { size: 18, align: 'center', color: P.accent, weight: 900 }, P);
      wrap(g, g.t('goal'), bx + bw / 2, by + 46, bw - 30, 14, { size: 11, align: 'center', color: P.ink, weight: 600 }, P);
      ctx.globalAlpha = 1;
    }
    if (o.kOpen) ui.kpanel(g, ctx, S, P, o.k, o.time);
    if (S.phase !== 'play') {
      ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.45)' : 'rgba(8,10,14,.45)'; ctx.fillRect(0, HUD, W, FH);
      txt(g, g.t(S.phase === 'won' ? 'res_won' : 'res_lost'), W / 2, HUD + FH / 2, { size: 46, align: 'center', color: S.phase === 'won' ? P.good : P.bad, weight: 900, shadow: true }, P);
    }
  };

  // ---------- Конструктор ----------
  // k: { row, tpl, d:{chassis,w[],brain}, where (id завода), order, msg }
  ui.K_ROWS = 9;
  ui.kpanel = function (g, ctx, S, P, k, time) {
    var L = SB.logic, px = 36, py = HUD + 10, pw = W - 72, ph = FH - 20;
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.55)' : 'rgba(6,8,12,.55)'; ctx.fillRect(0, HUD, W, FH);
    ui.hits.push({ x: 0, y: HUD, w: W, h: FH, act: 'kOut' });
    panel(ctx, px, py, pw, ph, P, P.accent);
    ui.hits.push({ x: px, y: py, w: pw, h: ph, act: 'kIn' });
    txt(g, g.t('k_title'), px + 20, py + 28, { size: 18, color: P.accent, weight: 900 }, P);
    txt(g, g.t('k_close'), px + pw - 18, py + 27, { size: 10, align: 'right', color: P.muted, weight: 700 }, P);
    var d = k.d, f = S.factories.filter(function (q) { return q.id === k.where; })[0];
    var rows = [
      [g.t('k_tpl'), k.tpl ? g.t('t_' + k.tpl) : g.t('k_custom')],
      [g.t('k_chassis'), g.t('c_' + d.chassis)],
      [g.t('k_slot') + ' 1', g.t('w_' + (d.w[0] || 'none'))],
      [g.t('k_slot') + ' 2', g.t('w_' + (d.w[1] || 'none'))],
      [g.t('k_slot') + ' 3', g.t('w_' + (d.w[2] || 'none'))],
      [g.t('k_brain'), g.t('b_' + d.brain)],
      [g.t('k_where'), f ? g.t('f_' + f.type) + ' #' + f.id : '—'],
      [g.t('k_order'), g.t('o_' + k.order)]
    ];
    var rx = px + 16, ry = py + 48, rh = 34, vx = px + 118, vw = 190;
    rows.forEach(function (r, i) {
      var y = ry + i * rh, on = k.row === i;
      if (on) { ctx.fillStyle = P.pixel ? P.barBg : 'rgba(255,255,255,.06)'; ctx.fillRect(rx - 6, y, vx + vw - rx + 12, rh - 4); }
      txt(g, r[0], rx, y + 19, { size: 11, color: on ? P.accent : P.muted, weight: 700 }, P);
      button(g, ctx, vx, y + 3, 24, rh - 10, '‹', P, { act: 'kPrev', arg: i, size: 14 });
      txt(g, r[1], vx + vw / 2, y + 19, { size: 12, align: 'center', color: P.ink, weight: 800 }, P);
      button(g, ctx, vx + vw - 24, y + 3, 24, rh - 10, '›', P, { act: 'kNext', arg: i, size: 14 });
      ui.hits.push({ x: rx - 6, y: y, w: vx - rx, h: rh - 4, act: 'kRow', arg: i });
    });
    // правая колонка: превью, характеристики, цена
    var cx = px + 336, cw = pw - 352, top = py + 48;
    if (P.pixel) { ctx.fillStyle = P.barBg; ctx.fillRect(cx, top, cw, 96); } else SB.render.rrect(ctx, cx, top, cw, 96, 8, 'rgba(255,255,255,.05)');
    SB.render.robot(ctx, { d: d, side: 0, ang: -Math.PI / 2 + Math.sin(time * 0.8) * 0.5, x: cx + cw / 2, y: top + 50, moving: true, core: true }, P, time, 6);
    var st = L.stats(d), sy = top + 114;
    [['st_hp', st.hp], ['st_speed', Math.round(st.speed)], ['st_range', st.range || '—'], ['st_dps', st.dps ? st.dps.toFixed(1) : '—'], ['st_sight', st.sight]].forEach(function (q, i) {
      var xx = cx + (i % 2) * (cw / 2), yy = sy + (i >> 1) * 16;
      txt(g, g.t(q[0]), xx, yy, { size: 10, color: P.muted, weight: 700 }, P);
      txt(g, String(q[1]), xx + cw / 2 - 12, yy, { size: 11, align: 'right', color: P.ink, weight: 800 }, P);
    });
    // проходимость шасси
    var pass = L.CHASSIS[d.chassis].pass;
    txt(g, (pass[1] ? '▲ ' : '') + (pass[2] ? '≈ ' : '') + '= ×' + pass[4], cx + cw - 2, sy + 32, { size: 10, align: 'right', color: P.accent, weight: 800, up: false }, P);
    // цена
    var cost = L.costOf(d), cyy = sy + 58;
    txt(g, g.t('k_cost'), cx, cyy, { size: 10, color: P.muted, weight: 700 }, P);
    var xx = cx + 44;
    L.RES.forEach(function (r) {
      if (!cost[r]) return; var okR = (S.res[0][r] || 0) >= cost[r];
      SB.render.icon(ctx, r, xx + 5, cyy - 4, 10, P.res[r], P);
      txt(g, String(cost[r]), xx + 13, cyy, { size: 12, color: okR ? P.ink : P.bad, weight: 800 }, P); xx += 34;
    });
    // описание текущего выбора
    var desc = '';
    if (k.row === 1) desc = g.t('cd_' + d.chassis); else if (k.row >= 2 && k.row <= 4) desc = g.t('wd_' + (d.w[k.row - 2] || 'none')); else if (k.row === 5) desc = g.t('bd_' + d.brain);
    else if (k.row === 7) desc = g.t('o_' + k.order);
    if (desc) wrap(g, desc, cx, cyy + 22, cw, 13, { size: 10, color: P.muted, weight: 600 }, P);
    // причина, почему нельзя
    var why = k.why;
    if (why) txt(g, g.t('why_' + why), cx + cw / 2, py + ph - 62, { size: 11, align: 'center', color: P.bad, weight: 800 }, P);
    button(g, ctx, cx, py + ph - 50, cw, 36, g.t('k_build'), P, { on: k.row === 8, act: 'kBuild', size: 15, dis: !!why });
  };

  // ---------- Выбор карты ----------
  ui.maps = function (g, ctx, P, m) {
    ui.hits = [];
    var px = 40, py = 40, pw = W - 80, ph = H - 80;
    panel(ctx, px, py, pw, ph, P, P.accent);
    txt(g, g.t('maps'), px + 22, py + 34, { size: 20, color: P.accent, weight: 900 }, P);
    var list = m.list, rx = px + 18, ry = py + 56, rh = 46, lw = 300;
    list.forEach(function (e, i) {
      var y = ry + i * rh, on = m.sel === i;
      if (on) { if (P.pixel) { ctx.fillStyle = P.barBg; ctx.fillRect(rx - 4, y, lw, rh - 6); } else SB.render.rrect(ctx, rx - 4, y, lw, rh - 6, 8, 'rgba(255,255,255,.07)'); }
      var col = e.locked ? P.muted : on ? P.accent : P.ink;
      txt(g, (e.id ? e.id + '. ' : '★ ') + e.name, rx + 6, y + 18, { size: 14, color: col, weight: 800 }, P);
      txt(g, e.locked ? g.t('locked') : e.best ? g.t('bestT') + ' ' + mmss(e.best) : '—', rx + 6, y + 34, { size: 10, color: P.muted, weight: 700 }, P);
      ui.hits.push({ x: rx - 4, y: y, w: lw, h: rh - 6, act: 'map', arg: i });
    });
    // превью выбранной долины
    var e = list[m.sel], cx = px + 340, cw = pw - 360;
    if (e.preview) {
      var S = e.preview, sc = Math.min(cw / S.map.w, 150 / S.map.h), rect = { x: cx + (cw - S.map.w * sc) / 2, y: ry + 6, w: S.map.w * sc, h: S.map.h * sc, sc: sc };
      SB.render.minimap(ctx, S, P, rect, null, null);
    }
    wrap(g, e.desc, cx, ry + 186, cw, 14, { size: 11, color: P.ink, weight: 600 }, P);
    if (e.lvl != null) txt(g, '▲'.repeat(e.lvl + 1) + '△'.repeat(4 - e.lvl), cx, ry + 250, { size: 13, color: P.bad, weight: 800, up: false }, P);
    button(g, ctx, cx, py + ph - 60, cw, 38, e.locked ? g.t('locked') : '▶ ' + e.name, P, { on: !e.locked, dis: e.locked, act: 'mapGo', size: 13 });
    txt(g, g.t('mapsHint'), W / 2, py + ph - 10, { size: 10, align: 'center', color: P.muted, weight: 700 }, P);
  };

  // ---------- Итог боя ----------
  ui.result = function (g, ctx, P, R) {
    ui.hits = [];
    var pw = 420, ph = 300, px = (W - pw) / 2, py = (H - ph) / 2;
    panel(ctx, px, py, pw, ph, P, R.won ? P.good : P.bad);
    txt(g, g.t(R.won ? 'res_won' : 'res_lost'), W / 2, py + 48, { size: 34, align: 'center', color: R.won ? P.good : P.bad, weight: 900 }, P);
    txt(g, R.mapName, W / 2, py + 72, { size: 13, align: 'center', color: P.muted, weight: 700 }, P);
    txt(g, g.t(R.won ? (R.how === 'base' ? 'res_how_base' : 'res_how_all') : (R.how === 'base' ? 'res_how_lbase' : 'res_how_lall')), W / 2, py + 94, { size: 12, align: 'center', color: P.ink, weight: 700 }, P);
    var lines = [['res_time', mmss(R.time) + (R.newBest ? '  · ' + g.t('res_new') : '')], ['res_best', R.best ? mmss(R.best) : '—'], ['res_built', R.built[0]], ['res_lostR', R.lost[0]], ['res_kills', R.kills[0]], ['res_caps', R.caps[0]]];
    lines.forEach(function (l, i) {
      var y = py + 126 + i * 22;
      txt(g, g.t(l[0]), px + 40, y, { size: 12, color: P.muted, weight: 700 }, P);
      txt(g, String(l[1]), px + pw - 40, y, { size: 13, align: 'right', color: l[0] === 'res_time' && R.newBest ? P.good : P.ink, weight: 800 }, P);
    });
    if (R.campDone) txt(g, g.t('campDone'), W / 2, py + ph - 38, { size: 14, align: 'center', color: P.accent, weight: 900 }, P);
    txt(g, g.t('res_next'), W / 2, py + ph - 14, { size: 10, align: 'center', color: P.muted, weight: 700 }, P);
  };
})(typeof window !== 'undefined' ? window : globalThis);
