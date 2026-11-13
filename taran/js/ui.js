/* ТАРАН · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема), конвейер кадра заезда
   (мир — retro в буфер половинного размера и ×2 без сглаживания; HUD; мини-карта; отсчёт, финиш, всплывающие надписи),
   экраны «Итоги заезда» и «Гараж». Тексты — только через g.t(). TARAN.ui */
(function (global) {
  'use strict';
  var T = global.TARAN = global.TARAN || {};
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, pad = document.querySelector('.pad');
    var padH = pad && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 16 : 0;
    var availW = Math.min(innerWidth - 16, 960), availH = innerHeight - padH - 70;
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
      document.querySelectorAll('[data-act]').forEach(function (el) { el.textContent = g.t('btn_' + el.getAttribute('data-act')); });
    }
    if (theme !== lastTheme) { lastTheme = theme; document.body.setAttribute('data-theme', theme); }
  }

  // ---------- Примитивы ----------
  function txt(g, s, x, y, o, P) {
    o = o || {}; o.font = P.font;
    if (o.shadow !== false) { var c = o.color; o.color = P.pixel ? '#000000' : 'rgba(0,0,0,.6)'; g.text(s, x + (P.pixel ? 2 : 1), y + 2, o); o.color = c; }
    g.text(s, x, y, o);
  }
  function up(P, s) { return P.pixel ? String(s).toUpperCase() : String(s); }
  function panel(ctx, x, y, w, h, P, edge) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = edge || P.line; ctx.fillRect(x, y, w, 4); ctx.fillRect(x, y + h - 4, w, 4); ctx.fillRect(x, y, 4, h); ctx.fillRect(x + w - 4, y, 4, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 20; ctx.fillStyle = P.panel; T.render.rr(ctx, x, y, w, h, 12); ctx.restore();
      ctx.strokeStyle = edge || P.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.rect(x + 0.75, y + 0.75, w - 1.5, h - 1.5); ctx.stroke();
    }
  }
  function bar(ctx, x, y, w, h, f, col, P) {
    ctx.fillStyle = P.barBg; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col; ctx.fillRect(x, y, P.pixel ? Math.round(w * Math.max(0, f) / 4) * 4 : w * Math.max(0, Math.min(1, f)), h);
  }
  function fmtT(s) { if (!s || !isFinite(s)) return '—'; var m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(2); }
  function name(g, c) { return c.human >= 0 ? g.t(c.human ? 'p2' : 'p1') : g.t('r_' + c.id); }
  function keyName(g, k) { return k === 'p1' || k === 'p2' ? g.t(k) : g.t('r_' + k); }

  // ---------- Мир ----------
  var buf = null, bctx = null;
  function world(g, ctx, S, P, shake) {
    var L = T.logic, VW = L.VIEW.w, VH = L.VIEW.h, sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
    if (P.pixel) {
      if (!buf) { buf = document.createElement('canvas'); buf.width = VW / 2; buf.height = VH / 2; bctx = buf.getContext('2d'); }
      bctx.setTransform(0.5, 0, 0, 0.5, 0, 0); bctx.imageSmoothingEnabled = false;
      T.render.world(bctx, S, P, g.time, VW, VH);
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(buf, Math.round(sx / 2) * 2, L.HUD + Math.round(sy / 2) * 2, VW, VH); ctx.restore();
    } else {
      ctx.save(); ctx.beginPath(); ctx.rect(0, L.HUD, VW, VH); ctx.clip();
      ctx.translate(sx, L.HUD + sy);
      T.render.world(ctx, S, P, g.time, VW, VH);
      ctx.restore();
    }
  }

  // ---------- HUD ----------
  function carInfo(g, ctx, S, P, c, x, al) {
    var L = T.logic, n = S.cars.length, right = al === 'right';
    var head = name(g, c) + ' · ' + (c.out ? g.t('outOf') : c.finished ? g.t('finish') + ' ' + c.place : c.pos + '/' + n);
    var lap = ' · ' + up(P, g.t('lap')) + ' ' + Math.max(1, Math.min(S.laps, c.lap + 1)) + '/' + S.laps;
    txt(g, up(P, head + lap), x, 14, { size: 12, align: al, color: c.color, weight: 800 }, P);
    var bw = 70, bx = right ? x - bw : x;
    bar(ctx, bx, 20, bw, 7, c.hp / c.st.hp, c.hp < c.st.hp * 0.3 ? P.bad : P.good, P);
    var ix = right ? x - bw - 8 : x + bw + 8, items = [['rocket', c.rockets], [c.rearType, c.rear], ['nitro', c.nitro]];
    items.forEach(function (it, i) {
      var xx = right ? ix - (items.length - 1 - i) * 30 - 22 : ix + i * 30;
      icon(ctx, it[0], xx + 5, 24, P);
      txt(g, String(it[1]), xx + 12, 29, { size: 11, color: it[1] > 0 ? P.ink : P.muted, weight: 800, shadow: false }, P);
    });
  }
  // значки боезапаса: ракета, масло, гайка, нитро
  function icon(ctx, k, x, y, P) {
    if (k === 'rocket') { ctx.fillStyle = P.rocket; ctx.fillRect(x - 5, y - 2, 9, 4); ctx.fillStyle = P.rocketFin; ctx.fillRect(x - 5, y - 4, 3, 8); }
    else if (k === 'oil') { ctx.fillStyle = P.oilSheen; ctx.fillRect(x - 6, y - 4, 12, 8); ctx.fillStyle = P.oil; ctx.fillRect(x - 5, y - 3, 10, 6); }
    else if (k === 'mine') { ctx.fillStyle = P.mine; ctx.beginPath(); for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3; ctx.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); } ctx.closePath(); ctx.fill(); ctx.fillStyle = P.mineDark; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); }
    else { ctx.fillStyle = P.flame[1]; ctx.beginPath(); ctx.moveTo(x - 6, y - 4); ctx.lineTo(x + 5, y); ctx.lineTo(x - 6, y + 4); ctx.closePath(); ctx.fill(); ctx.fillStyle = P.flame[0]; ctx.fillRect(x - 6, y - 1.5, 5, 3); }
  }
  function hud(g, ctx, S, P) {
    var L = T.logic, W = L.W;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, L.HUD);
    ctx.fillStyle = P.line; ctx.fillRect(0, L.HUD - (P.pixel ? 2 : 1), W, P.pixel ? 2 : 1);
    var hum = S.cars.filter(function (c) { return c.human >= 0; });
    if (hum[0]) carInfo(g, ctx, S, P, hum[0], 8, 'left');
    if (hum[1]) carInfo(g, ctx, S, P, hum[1], W - 8, 'right');
    var tn = g.t('tr_' + S.track.id), cx = hum[1] ? W / 2 : W / 2 + 70;
    txt(g, up(P, tn), cx, 14, { size: 11, align: 'center', color: P.accent, weight: 800 }, P);
    txt(g, fmtT(S.phase === 'count' ? 0 : S.raceT), cx, 29, { size: 12, align: 'center', color: P.ink, weight: 800, shadow: false }, P);
    if (!hum[1] && hum[0]) {
      var best = T.app && T.app.lapRecord ? T.app.lapRecord(S.track.id) : 0, bl = hum[0].bestLap;
      txt(g, up(P, g.t('bestLap')) + ' ' + fmtT(bl), W - 8, 14, { size: 11, align: 'right', color: P.muted, weight: 700, shadow: false }, P);
      txt(g, up(P, g.t('lapRec')) + ' ' + fmtT(best), W - 8, 28, { size: 11, align: 'right', color: P.muted, weight: 700, shadow: false }, P);
    }
  }
  function overlays(g, ctx, S, P, toasts) {
    var L = T.logic, W = L.W, cy = L.HUD + L.VIEW.h / 2;
    T.render.minimap(ctx, S, P, W - 116, L.H - 86, 108, 78);
    if (S.phase === 'count') {
      var nC = Math.ceil(S.countT);
      panel(ctx, W / 2 - 150, cy - 90, 300, 120, P, P.accent);
      txt(g, up(P, g.t('tr_' + S.track.id)) + ' · ' + up(P, g.t('set_' + S.track.set)), W / 2, cy - 62, { size: 13, align: 'center', color: P.muted, weight: 800 }, P);
      txt(g, String(nC), W / 2, cy - 14, { size: 44, align: 'center', color: P.accent, weight: 900 }, P);
      txt(g, S.laps + ' ' + g.t('laps') + (S.mode === 'time' ? '' : ' · ' + g.t('introSub')), W / 2, cy + 14, { size: 11, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
    } else if (S.raceT < 0.8) {
      ctx.globalAlpha = 1 - S.raceT / 0.8; txt(g, up(P, g.t('go')), W / 2, cy - 10, { size: 48, align: 'center', color: P.good, weight: 900 }, P); ctx.globalAlpha = 1;
    }
    toasts.forEach(function (o) {
      ctx.globalAlpha = Math.min(1, o.t * 2);
      txt(g, up(P, o.text), o.x != null ? o.x : W / 2, (o.y != null ? o.y : cy - 40) - (o.life - o.t) * 18, { size: o.big ? 20 : 12, align: 'center', color: o.color, weight: 900 }, P);
      ctx.globalAlpha = 1;
    });
  }
  function render(g, ctx, S, P, o) {
    o = o || {};
    sync(g);
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, g.W, g.H);
    world(g, ctx, S, P, o.shake || 0);
    if (!o.bare) { hud(g, ctx, S, P); overlays(g, ctx, S, P, o.toasts || []); }
  }

  // ---------- Итоги заезда ----------
  function results(g, ctx, S, P, R) {
    var L = T.logic, W = L.W, H = L.H;
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.7)' : 'rgba(8,8,12,.72)'; ctx.fillRect(0, 0, W, H);
    var px = 40, py = 26, pw = W - 80, ph = H - 52;
    panel(ctx, px, py, pw, ph, P, P.accent);
    if (R.kind === 'time') {
      txt(g, up(P, g.t('timeRes')) + ' · ' + up(P, g.t('tr_' + S.track.id)), W / 2, py + 34, { size: 20, align: 'center', color: P.accent, weight: 900 }, P);
      var y = py + 74;
      S.cars.forEach(function (c) {
        txt(g, up(P, name(g, c)), px + 40, y, { size: 15, color: c.color, weight: 900 }, P);
        txt(g, (c.finished ? fmtT(c.finishT) : g.t('outOf')) + '   ' + g.t('bestLap') + ': ' + fmtT(c.bestLap), px + 110, y, { size: 13, color: P.ink, weight: 700, shadow: false }, P);
        y += 22;
        c.lapTimes.forEach(function (lt, i) { txt(g, g.t('lap') + ' ' + (i + 1) + ': ' + fmtT(lt), px + 110, y, { size: 12, color: P.muted, weight: 600, shadow: false }, P); y += 17; });
        y += 10;
      });
      txt(g, up(P, g.t('lapRec')) + ': ' + fmtT(R.record) + (R.newRec ? '  ★ ' + g.t('newBest') : ''), W / 2, py + ph - 52, { size: 15, align: 'center', color: R.newRec ? P.good : P.ink, weight: 800 }, P);
    } else {
      var A = R.sum;
      txt(g, up(P, g.t('results')) + ' · ' + up(P, g.t('tr_' + S.track.id)), W / 2, py + 30, { size: 19, align: 'center', color: P.accent, weight: 900 }, P);
      var cols = [px + 26, px + 70, px + 250, px + 330, px + 410];
      var y2 = py + 58;
      txt(g, '#', cols[0], y2, { size: 11, color: P.muted, weight: 700, shadow: false }, P);
      [g.t('prize'), g.t('points'), g.t('kills')].forEach(function (h, i) { txt(g, up(P, h), cols[i + 2], y2, { size: 11, color: P.muted, weight: 700, shadow: false }, P); });
      y2 += 20;
      A.prizes.forEach(function (pz) {
        var c = S.cars.filter(function (x) { return x.id === pz.key || (pz.human >= 0 && x.human === pz.human); })[0], col = c ? c.color : P.ink;
        txt(g, String(pz.place), cols[0], y2, { size: 14, color: P.ink, weight: 900 }, P);
        txt(g, up(P, keyName(g, pz.key)), cols[1], y2, { size: 14, color: col, weight: 800 }, P);
        txt(g, pz.human >= 0 ? '+' + pz.prize : '—', cols[2], y2, { size: 13, color: pz.human >= 0 ? P.good : P.muted, weight: 800, shadow: false }, P);
        txt(g, '+' + pz.points, cols[3], y2, { size: 13, color: P.ink, weight: 700, shadow: false }, P);
        txt(g, String(pz.kills), cols[4], y2, { size: 13, color: P.ink, weight: 700, shadow: false }, P);
        y2 += 21;
      });
      // таблица лиги
      y2 += 8;
      txt(g, up(P, g.t('standings')) + ' · ' + up(P, g.t('lg_' + A.league)) + ' (' + Math.min(4, A.race + 1) + '/4)', px + 26, y2, { size: 12, color: P.accent, weight: 800 }, P);
      y2 += 18;
      var st = A.standings || T.champ.standings(R.champ);
      st.forEach(function (s, i) {
        var isH = s.key === 'p1' || s.key === 'p2';
        txt(g, (i + 1) + '. ' + up(P, keyName(g, s.key)) + ' — ' + s.pts, px + 26 + (i % 3) * 180, y2 + Math.floor(i / 3) * 18, { size: 12, color: isH ? P.ink : P.muted, weight: isH ? 800 : 600, shadow: false }, P);
      });
      y2 += Math.ceil(st.length / 3) * 18 + 8;
      if (A.leagueEnd) {
        var msg = A.champion ? g.t('champion') : A.qualified ? g.t('qualified') + g.t('lg_' + Math.min(3, A.league + 1)) : A.lost ? g.t('gameover') : g.t('notQual') + ' (' + g.t('triesLeft') + ': ' + (T.logic.MAX_TRIES - R.champ.tries + 1) + ')';
        txt(g, up(P, msg), W / 2, y2 + 10, { size: 15, align: 'center', color: A.qualified ? P.good : P.bad, weight: 900 }, P);
      }
    }
    txt(g, '▸ ' + g.t('next'), W / 2, py + ph - 18, { size: 16, align: 'center', color: P.accent, weight: 900 }, P);
  }

  // ---------- Гараж ----------
  function garage(g, ctx, P, G0) {
    var L = T.logic, W = L.W, H = L.H, ch = G0.champ, pi = G0.pi, car = ch.cars[pi], money = ch.money[T.champ.purse(ch, pi)], menu = G0.menu;
    sync(g);
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, H);
    // фон: плитка мастерской
    ctx.fillStyle = P.set.shop.ground2; for (var y = 0; y < H; y += 40) for (var x = (y / 40) % 2 * 40; x < W; x += 80) ctx.fillRect(x, y, 40, 40);
    var who = ch.players === 2 ? ' · ' + g.t(pi ? 'p2' : 'p1') : '';
    txt(g, up(P, g.t('garage')) + who, 24, 34, { size: 24, color: P.accent, weight: 900 }, P);
    txt(g, up(P, g.t('lg_' + ch.league)) + ' · ' + g.t('race') + ' ' + (ch.race + 1) + '/4 · ' + g.t('tr_' + L.TRACKS[T.champ.trackOf(ch)].id) + ' (' + g.t('set_' + L.TRACKS[T.champ.trackOf(ch)].set) + ')', 24, 54, { size: 12, color: P.muted, weight: 700, shadow: false }, P);
    txt(g, up(P, ch.team === 'coop' && ch.players === 2 ? g.t('pursePair') : g.t('money')) + ': ' + money, W - 24, 34, { size: 18, align: 'right', color: P.good, weight: 900 }, P);
    // список покупок
    var lx = 24, ly = 70, lw = 350, lh = 34;
    panel(ctx, lx, ly, lw, menu.items.length * lh + 16, P, P.line);
    menu.items.forEach(function (it, i) {
      var y = ly + 12 + i * lh, on = i === menu.sel, info = it.info ? it.info() : {};
      it._y = y + lh / 2 + 6;
      if (on) { ctx.fillStyle = P.pixel ? P.line : 'rgba(239,91,63,.18)'; ctx.fillRect(lx + 6, y, lw - 12, lh - 4); }
      txt(g, (on ? '▸ ' : '  ') + info.label, lx + 14, y + 21, { size: 14, color: on ? P.ink : P.muted, weight: on ? 800 : 600, shadow: false }, P);
      if (info.tier != null) for (var k = 0; k < L.TIERS; k++) { ctx.fillStyle = k < info.tier ? P.accent : P.barBg; ctx.fillRect(lx + 150 + k * 14, y + 10, 10, 12); }
      if (info.right) txt(g, info.right, lx + lw - 14, y + 21, { size: 13, align: 'right', color: info.ok === false ? P.bad : info.ok ? P.good : P.muted, weight: 800, shadow: false }, P);
    });
    if (G0.flash > 0) txt(g, up(P, G0.flashText || ''), lx + lw / 2, ly + menu.items.length * lh + 44, { size: 13, align: 'center', color: G0.flashOk ? P.good : P.bad, weight: 800 }, P);
    // витрина машины и характеристики
    var rx = 394, ry = 70, rw = W - rx - 24;
    panel(ctx, rx, ry, rw, 200, P, P.accent);
    ctx.save(); ctx.translate(rx + rw / 2, ry + 58); ctx.scale(2.6, 2.6);
    T.render.car(ctx, { x: 0, y: 0, a: -0.35 + Math.sin(g.time * 0.8) * 0.15, color: L.HUMANS[pi].color, cfg: car, z: 0, wreckT: 0, invT: 0, nitroT: 0 }, P, g.time, { body: car.body });
    ctx.restore();
    txt(g, up(P, g.t('body')) + ': ' + g.t('b_' + L.BODIES[car.body].id), rx + rw / 2, ry + 112, { size: 13, align: 'center', color: P.ink, weight: 800 }, P);
    var st = L.stats(car), top = L.stats({ body: 2, up: { armor: 5, tires: 5, engine: 5, weapon: 5 } });
    [['st_speed', st.maxV / top.maxV], ['st_armor', st.hp / top.hp], ['st_grip', st.grip / top.grip], ['st_ram', st.ram / top.ram]].forEach(function (r, i) {
      var yy = ry + 124 + i * 14;
      txt(g, up(P, g.t(r[0])), rx + 14, yy + 8, { size: 11, color: P.muted, weight: 700, shadow: false }, P);
      bar(ctx, rx + 96, yy, rw - 112, 8, r[1], P.accent, P);
    });
    txt(g, g.t('st_ammo') + ': ' + st.rockets + ' / ' + st.rear + ' / ' + st.nitro, rx + 14, ry + 190, { size: 11, color: P.ink, weight: 700, shadow: false }, P);
    // таблица лиги: соперник — очки, под именем — характер
    var sy = ry + 212, rows = T.champ.standings(ch);
    panel(ctx, rx, sy, rw, H - 28 - sy, P, P.line);
    txt(g, up(P, g.t('leagueStand')), rx + 14, sy + 20, { size: 12, color: P.accent, weight: 800 }, P);
    rows.forEach(function (s, i) {
      var isH = s.key === 'p1' || s.key === 'p2', R = L.RIVALS.filter(function (r) { return r.id === s.key; })[0], yy = sy + 40 + i * (rows.length > 5 ? 22 : 25);
      txt(g, (i + 1) + '. ' + keyName(g, s.key), rx + 14, yy, { size: 12, color: isH ? L.HUMANS[s.key === 'p2' ? 1 : 0].color : R.color, weight: 800, shadow: false }, P);
      txt(g, String(s.pts), rx + rw - 14, yy, { size: 12, align: 'right', color: P.ink, weight: 800, shadow: false }, P);
      if (R) txt(g, g.t('rd_' + R.id), rx + 30, yy + 10, { size: 9, color: P.muted, weight: 600, shadow: false }, P);
    });
    txt(g, g.t('bodyNote'), 24, H - 18, { size: 11, color: P.muted, weight: 600, shadow: false }, P);
  }

  T.ui = {
    init: function (g) { var f = function () { fit(g); }; addEventListener('resize', f); f(); setTimeout(f, 50); sync(g); },
    fit: fit, sync: sync, txt: txt, panel: panel, up: up, bar: bar, fmtT: fmtT, world: world, render: render, results: results, garage: garage
  };
})(typeof window !== 'undefined' ? window : globalThis);
