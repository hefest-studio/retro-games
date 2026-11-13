/* ВЗВОД · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема), кадр боя — мир (retro — в буфер ½ и ×2
   без сглаживания), HUD, миникарта, баннер миссии, всплывающие надписи, итог миссии; экраны брифинга и разбора.
   Тексты — только через g.t(). VZVOD.ui */
(function (global) {
  'use strict';
  var V = global.VZVOD = global.VZVOD || {};
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, pad = document.querySelector('.pad');
    var padH = pad && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 16 : 0;
    var vw = Math.min(innerWidth, document.documentElement.clientWidth || innerWidth);
    var availW = Math.min(vw - 16, 980), availH = innerHeight - padH - 64;
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
      document.querySelectorAll('[data-label]').forEach(function (el) { el.textContent = g.t(el.getAttribute('data-label')); });
    }
    if (theme !== lastTheme) { lastTheme = theme; document.body.setAttribute('data-theme', theme); }
  }

  // ---------- Примитивы ----------
  function txt(g, s, x, y, o, P) {
    o = o || {}; o.font = P.font;
    if (o.shadow !== false) { var c = o.color; o.color = P.pixel ? '#000000' : 'rgba(0,0,0,.6)'; g.text(s, x + (P.pixel ? 2 : 1), y + (P.pixel ? 2 : 1), o); o.color = c; }
    g.text(s, x, y, o);
  }
  function up(P, s) { return P.pixel ? String(s).toUpperCase() : String(s); }
  function panel(ctx, x, y, w, h, P, edge) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = edge || P.line; ctx.fillRect(x, y, w, 4); ctx.fillRect(x, y + h - 4, w, 4); ctx.fillRect(x, y, 4, h); ctx.fillRect(x + w - 4, y, 4, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 18; V.render.rrect(ctx, x, y, w, h, 12, P.panel); ctx.restore();
      ctx.strokeStyle = edge || P.line; ctx.lineWidth = 1.5; V.render.rrect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 12); ctx.stroke();
    }
  }
  function bar(ctx, x, y, w, h, f, col, P) {
    ctx.fillStyle = P.barBg; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, f)), h);
  }
  function botName(g, b) { return g.t('n_' + b.ni) + (b.gen > 1 ? '-' + b.gen : ''); }
  function missionTitle(g, spec) { return g.t('m_' + (spec.op + 1) + '_' + (spec.mi + 1)); }

  // ---------- Мир ----------
  var buf = null, bctx = null;
  function world(g, ctx, S, P, cam, o) {
    var L = V.logic, W = L.W, H = L.VH, Z = L.ZOOM, view = { x: cam.x, y: cam.y, w: L.VIEW_W, h: L.VIEW_H };
    if (P.pixel) {
      if (!buf) { buf = document.createElement('canvas'); buf.width = W / 2; buf.height = H / 2; bctx = buf.getContext('2d'); }
      var k = Z / 2;
      bctx.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k); bctx.imageSmoothingEnabled = false;
      bctx.fillStyle = '#000'; bctx.fillRect(cam.x, cam.y, view.w, view.h);
      V.render.world(bctx, S, P, view, o);
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(buf, 0, L.HUD, W, H); ctx.restore();
    } else {
      ctx.save(); ctx.beginPath(); ctx.rect(0, L.HUD, W, H); ctx.clip();
      ctx.translate(0, L.HUD); ctx.scale(Z, Z); ctx.translate(-cam.x, -cam.y);
      ctx.fillStyle = '#000'; ctx.fillRect(cam.x, cam.y, view.w, view.h);
      V.render.world(ctx, S, P, view, o);
      ctx.restore();
    }
  }
  // Миникарта в правом верхнем углу поля → прямоугольник для кликов
  function mmRect(S) { var L = V.logic, sc = 2, w = S.map.w * sc, h = S.map.h * sc; return { x: L.W - w - 8, y: L.HUD + 8, w: w, h: h, sc: sc }; }

  // ---------- HUD ----------
  function objText(g, S) {
    var o = S.obj;
    if (o.kind === 'hives') return g.t('os_hives') + ' ' + (S.hives.length - (o.hivesLeft != null ? o.hivesLeft : S.hives.length)) + '/' + S.hives.length;
    if (o.kind === 'clear') return g.t('os_clear') + ': ' + (o.prog | 0);
    if (o.kind === 'escort') return g.t('os_escort') + ' ' + Math.round(o.prog * 100) + '%' + (S.vip ? ' ♥' + Math.max(0, S.vip.hp) : '');
    return g.t('os_hold') + ' ' + Math.floor(o.prog) + '/' + o.need + (g.i18n.lang === 'ru' ? ' с' : ' s');
  }
  function hud(g, ctx, S, P, info) {
    var L = V.logic, W = L.W, spec = S.spec;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, L.HUD);
    ctx.fillStyle = P.line; ctx.fillRect(0, L.HUD - (P.pixel ? 2 : 1), W, P.pixel ? 2 : 1);
    txt(g, up(P, g.t('opShort')) + ' ' + spec.id, 10, 14, { size: 12, color: P.accent, weight: 900 }, P);
    txt(g, up(P, missionTitle(g, spec)), 10, 27, { size: 10, color: P.muted, weight: 700, shadow: false }, P);
    txt(g, up(P, objText(g, S)), 230, 21, { size: 13, align: 'center', color: P.ink, weight: 800 }, P);
    // запасы
    V.render.gearIcon(ctx, 336, 16, 4, P.pickGear, 0);
    txt(g, '×' + S.ammo.gear, 344, 21, { size: 13, color: S.ammo.gear ? P.ink : P.bad, weight: 800 }, P);
    ctx.fillStyle = P.pickRocket; ctx.fillRect(378, 15, 8, 3); ctx.beginPath(); ctx.moveTo(390, 16.5); ctx.lineTo(385, 12); ctx.lineTo(385, 21); ctx.closePath(); ctx.fill();
    txt(g, '×' + S.ammo.rocket, 392, 21, { size: 13, color: S.ammo.rocket ? P.ink : P.bad, weight: 800 }, P);
    // группы
    var gx = 432;
    [0, 1].forEach(function (gi) {
      var G = S.groups[gi]; if (!G.order.length && gi === 1) return;
      var act = gi === S.active, lbl = (gi ? 'Б' : 'А'); if (g.i18n.lang !== 'ru') lbl = gi ? 'B' : 'A';
      ctx.fillStyle = act ? P.unit[gi] : P.barBg; ctx.fillRect(gx, 8, 4, 16);
      txt(g, lbl + ':' + G.order.length + (G.vehicle ? ' ▣' : ''), gx + 8, 21, { size: 12, color: act ? P.unit[gi] : P.muted, weight: 800, shadow: false }, P);
      gx += 52;
    });
    txt(g, up(P, g.t('score')) + ' ' + (info.campScore + S.score), W - 10, 14, { size: 11, align: 'right', color: P.ink, weight: 800 }, P);
    txt(g, up(P, g.t('best')) + ' ' + Math.max(g.state.best || 0, info.campScore + S.score), W - 10, 27, { size: 10, align: 'right', color: P.muted, weight: 700, shadow: false }, P);
  }
  function bottomInfo(g, ctx, S, P, info) {
    var L = V.logic, y = L.HUD + L.VH - 10, G = S.groups[S.active];
    var s = '▸ ' + g.t(S.active ? 'grpB' : 'grpA') + ' · ' + G.order.length;
    if (G.vehicle) { var v = S.vehicles.filter(function (q) { return q.id === G.vehicle; })[0]; if (v) s += ' · ' + g.t(v.type === 'cart' ? 'inCart' : 'inSkimmer') + ' ♥' + v.hp + ' · F'; }
    if (S.groups[1 - S.active].order.length) s += '   ' + g.t(S.active ? 'grpA' : 'grpB') + ' · ' + S.groups[1 - S.active].order.length + ' (Tab)';
    if (info.mode && info.mode !== 'move') s += '   [' + g.t('mode_' + info.mode) + ']';
    if (!P.pixel) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, y - 15, Math.min(L.W, 14 + s.length * 6.6), 22); }
    txt(g, up(P, s), 8, y, { size: 11, color: P.unit[S.active], weight: 800 }, P);
  }
  function toasts(g, ctx, S, P, list, cam) {
    var L = V.logic;
    list.forEach(function (o) {
      var x = o.world ? (o.x - cam.x) * L.ZOOM : o.x, y = (o.world ? (o.y - cam.y) * L.ZOOM + L.HUD : o.y) - (1.6 - o.t) * 18;
      if (o.world) x = Math.max(60, Math.min(L.W - 60, x));
      ctx.globalAlpha = Math.min(1, o.t * 2);
      txt(g, up(P, o.text), x, y, { size: o.big ? 15 : 11, align: 'center', color: o.color, weight: 800 }, P);
      ctx.globalAlpha = 1;
    });
  }
  function banner(g, ctx, S, P, t) {
    var L = V.logic, W = L.W, cy = L.HUD + 120;
    if (t <= 0) return;
    ctx.globalAlpha = Math.min(1, t * 1.5);
    panel(ctx, 110, cy - 52, W - 220, 108, P, P.accent);
    txt(g, up(P, g.t('op')) + ' ' + (S.spec.op + 1) + ' · ' + up(P, g.t('missionW')) + ' ' + (S.spec.mi + 1), W / 2, cy - 28, { size: 12, align: 'center', color: P.muted, weight: 800 }, P);
    txt(g, up(P, missionTitle(g, S.spec)), W / 2, cy - 2, { size: 24, align: 'center', color: P.accent, weight: 900 }, P);
    wrap(g, g.t('o_' + S.spec.obj), W / 2, cy + 22, W - 260, 15, { size: 11, align: 'center', color: P.ink, weight: 600, shadow: false }, P);
    ctx.globalAlpha = 1;
  }
  function endOverlay(g, ctx, S, P) {
    if (S.phase === 'play') return;
    var L = V.logic, W = L.W, cy = L.HUD + L.VH / 2, won = S.phase === 'won', f = Math.min(1, S.phaseT * 2);
    ctx.globalAlpha = f * 0.5; ctx.fillStyle = '#000'; ctx.fillRect(0, L.HUD, W, L.VH); ctx.globalAlpha = f;
    panel(ctx, 150, cy - 46, W - 300, 84, P, won ? P.good : P.bad);
    txt(g, up(P, g.t(won ? 'won' : (S.reason === 'vip' ? 'lostVip' : 'lost'))), W / 2, cy - 6, { size: 24, align: 'center', color: won ? P.good : P.bad, weight: 900 }, P);
    txt(g, won ? '+' + S.score : g.t('retry'), W / 2, cy + 20, { size: 12, align: 'center', color: P.muted, weight: 700, shadow: false }, P);
    ctx.globalAlpha = 1;
  }
  function render(g, ctx, S, P, cam, o) {
    o = o || {}; sync(g);
    var L = V.logic;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, g.W, g.H);
    world(g, ctx, S, P, cam, o);
    if (o.bare) return;
    toasts(g, ctx, S, P, o.toasts || [], cam);
    var mm = mmRect(S); V.render.minimap(ctx, S, P, mm.x, mm.y, mm.sc, { x: cam.x, y: cam.y, w: L.VIEW_W, h: L.VIEW_H }, g.time);
    bottomInfo(g, ctx, S, P, o);
    hud(g, ctx, S, P, o);
    banner(g, ctx, S, P, o.banner || 0);
    endOverlay(g, ctx, S, P);
  }

  // ---------- Брифинг ----------
  function bgGrid(g, ctx, P) {
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = P.line; ctx.globalAlpha = 0.35;
    for (var x = 0; x < g.W; x += 32) ctx.fillRect(x, 0, 1, g.H);
    for (var y = 0; y < g.H; y += 32) ctx.fillRect(0, y, g.W, 1);
    ctx.globalAlpha = 1;
  }
  function rosterLine(g, ctx, P, b, x, y, extra, col) {
    var r = V.render, L = V.logic;
    // мини-болванчик
    var fake = { x: x + 8, y: y - 2, alive: true, inV: null, ang: 0, walk: 0, moving: false, rank: 0, id: b.id, flash: 0 };
    r.drawUnit(ctx, fake, P, 0, false, false, g.time);
    txt(g, botName(g, b), x + 22, y + 2, { size: 13, color: col || P.ink, weight: 800, shadow: false }, P);
    txt(g, g.t('r_' + b.rank), x + 130, y + 2, { size: 11, color: P.muted, weight: 700, shadow: false }, P);
    for (var i = 0; i < b.rank; i++) { ctx.fillStyle = P.warn; ctx.fillRect(x + 216 + i * 5, y - 5, 3, 3); }
    var nx = L.RANK_XP[Math.min(5, b.rank + 1)], cx = L.RANK_XP[b.rank];
    bar(ctx, x + 216, y, 40, 3, b.rank >= 5 ? 1 : (b.xp - cx) / (nx - cx), P.accent, P);
    if (extra) txt(g, extra, x + 266, y + 2, { size: 11, color: extra.charAt(0) === '+' ? P.good : P.warn, weight: 700, shadow: false }, P);
  }
  function brief(g, ctx, C, P, prep, preview) {
    sync(g); bgGrid(g, ctx, P);
    var Camp = V.Camp, spec = Camp.spec(C), W = g.W;
    panel(ctx, 20, 20, W - 40, g.H - 40, P, P.accent);
    txt(g, up(P, g.t('op')) + ' ' + (spec.op + 1) + ' · ' + up(P, g.t('op_' + (spec.op + 1))), 44, 56, { size: 14, color: P.muted, weight: 800 }, P);
    txt(g, up(P, missionTitle(g, spec)), 44, 88, { size: 28, color: P.accent, weight: 900 }, P);
    txt(g, g.t('missionW') + ' ' + (spec.mi + 1) + '/' + V.logic.OPS[spec.op].missions.length + ' · ' + g.t('b_' + spec.biome), 44, 110, { size: 12, color: P.ink, weight: 700, shadow: false }, P);
    wrap(g, g.t('o_' + spec.obj), 44, 134, 330, 16, { size: 12, color: P.ink, weight: 600, shadow: false }, P);
    // превью карты
    if (preview) {
      var sc = Math.min(220 / preview.map.w, 160 / preview.map.h), mw = preview.map.w * sc, mh = preview.map.h * sc, px = W - 44 - mw, py = 46;
      V.render.minimap(ctx, preview, P, px, py, sc, { x: 0, y: 0, w: 0, h: 0 }, g.time);
    }
    var squad = Camp.squadFor(C), y = 226;
    txt(g, up(P, g.t('squad')) + ' (' + squad.length + ')', 44, y - 18, { size: 13, color: P.accent, weight: 900 }, P);
    squad.forEach(function (b, i) {
      var tag = prep && prep.repaired.indexOf(b.id) >= 0 ? '+ ' + g.t('repaired').toLowerCase() : (prep && prep.emergency.indexOf(b.id) >= 0 ? '+ ' + g.t('emergency').toLowerCase() : (b.missions === 0 ? '+ ' + g.t('recruits').toLowerCase() : ''));
      rosterLine(g, ctx, P, b, 44, y + i * 24, tag);
    });
    var rep = C.roster.filter(function (b) { return b.state === 'repair'; });
    var ry = 254;
    txt(g, up(P, g.t('inRepair')) + ' (' + rep.length + ')', 400, ry - 18, { size: 12, color: P.warn, weight: 800 }, P);
    rep.slice(0, 6).forEach(function (b, i) {
      txt(g, botName(g, b) + ' · ' + (b.wait > 0 ? g.t('soon') : g.t('waitFund')), 400, ry + 2 + i * 18, { size: 11, color: P.muted, weight: 700, shadow: false }, P);
    });
    if (rep.length > 6) txt(g, '…+' + (rep.length - 6), 400, ry + 2 + 6 * 18, { size: 11, color: P.muted, weight: 700, shadow: false }, P);
    var by = g.H - 104;
    txt(g, g.t('fund') + ': ' + C.fund + ' (' + g.t('repairCost') + ' ' + Camp.REPAIR_COST + ')', 400, by, { size: 12, color: P.ink, weight: 700, shadow: false }, P);
    txt(g, g.t('ammo') + ': ' + g.t('gear') + ' ' + spec.gears + ', ' + g.t('rocket') + ' ' + spec.rockets, 400, by + 18, { size: 12, color: P.ink, weight: 700, shadow: false }, P);
    txt(g, g.t('score') + ': ' + C.score, 400, by + 36, { size: 12, color: P.muted, weight: 700, shadow: false }, P);
    var blink = (g.time * 2 | 0) % 2;
    txt(g, up(P, g.t('goFight')), W / 2, g.H - 42, { size: 15, align: 'center', color: blink ? P.accent : P.ink, weight: 900 }, P);
    txt(g, g.t('toMenu'), W / 2, g.H - 26, { size: 10, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
  }
  function wrap(g, s, x, y, w, lh, o, P) {
    var ctx = g.ctx; ctx.font = (o.weight || 600) + ' ' + o.size + 'px ' + P.font; if (P.pixel) s = String(s);
    var words = String(s).split(' '), line = '', yy = y;
    words.forEach(function (wd) { var test = line ? line + ' ' + wd : wd; if (ctx.measureText(test).width > w && line) { txt(g, line, x, yy, Object.assign({}, o), P); line = wd; yy += lh; } else line = test; });
    if (line) txt(g, line, x, yy, Object.assign({}, o), P);
  }
  // ---------- Разбор миссии ----------
  function debrief(g, ctx, C, P, R) {
    sync(g); bgGrid(g, ctx, P);
    var W = g.W, won = R.rep.won;
    panel(ctx, 20, 20, W - 40, g.H - 40, P, won ? P.good : P.bad);
    txt(g, up(P, g.t('opShort')) + ' ' + R.spec.id + ' · ' + up(P, missionTitle(g, R.spec)), 44, 56, { size: 13, color: P.muted, weight: 800 }, P);
    txt(g, up(P, g.t(won ? 'won' : (R.res.reason === 'vip' ? 'lostVip' : 'lost'))), 44, 90, { size: 28, color: won ? P.good : P.bad, weight: 900 }, P);
    txt(g, g.t('kills') + ': ' + R.res.kills + ' · ' + g.t('hivesW') + ': ' + R.res.hives + ' · ' + g.t('score') + ': +' + R.res.score + (won ? '' : ' · ' + g.t('retry')), 44, 114, { size: 12, color: P.ink, weight: 700, shadow: false }, P);
    if (R.rep.opDone) txt(g, up(P, g.t('opDone')), W - 44, 90, { size: 16, align: 'right', color: P.accent, weight: 900 }, P);
    var y = 156;
    R.squad.forEach(function (id, i) {
      var b = C.roster.filter(function (q) { return q.id === id; })[0]; if (!b) return;
      var bits = [];
      if (R.rep.broken.indexOf(id) >= 0) bits.push(g.t('broken'));
      if (R.rep.xp[id]) bits.push('+' + R.rep.xp[id] + ' ' + g.t('xp'));
      if (R.rep.promos.indexOf(id) >= 0) bits.push('↑ ' + g.t('promo'));
      rosterLine(g, ctx, P, b, 44, y + i * 24, null, R.rep.broken.indexOf(id) >= 0 ? P.muted : P.ink);
      txt(g, bits.join(' · '), 310, y + 2 + i * 24, { size: 11, color: R.rep.broken.indexOf(id) >= 0 ? P.warn : (R.rep.promos.indexOf(id) >= 0 ? P.accent : P.good), weight: 700, shadow: false }, P);
    });
    var by = g.H - 116;
    txt(g, g.t('fundGain') + ': +' + R.rep.fund + ' → ' + C.fund, 44, by, { size: 12, color: P.ink, weight: 700, shadow: false }, P);
    if (R.rep.recruits.length) txt(g, g.t('recruits') + ': ' + R.rep.recruits.map(function (id) { return botName(g, C.roster.filter(function (q) { return q.id === id; })[0]); }).join(', '), 44, by + 18, { size: 12, color: P.good, weight: 700, shadow: false }, P);
    txt(g, g.t('score') + ': ' + C.score, 44, by + 36, { size: 12, color: P.muted, weight: 700, shadow: false }, P);
    var blink = (g.time * 2 | 0) % 2;
    txt(g, up(P, g.t('next')), W / 2, g.H - 38, { size: 15, align: 'center', color: blink ? P.accent : P.ink, weight: 900 }, P);
  }

  V.ui = {
    init: function (g) { var f = function () { fit(g); }; addEventListener('resize', f); addEventListener('load', f); f(); setTimeout(f, 50); setTimeout(f, 400); sync(g); },
    fit: fit, sync: sync, txt: txt, panel: panel, up: up, render: render, world: world, mmRect: mmRect, brief: brief, debrief: debrief,
    botName: botName, missionTitle: missionTitle, wrap: wrap
  };
})(typeof window !== 'undefined' ? window : globalThis);
