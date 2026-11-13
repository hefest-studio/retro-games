/* ОТСЕК · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема) и конвейер кадра — камера за бригадой,
   мир с темнотой (retro — в буфер половинного размера и ×2 без сглаживания), HUD, подсказки «действия» над героями,
   отсчёт эвакуации со стрелкой к шлюзу, баннеры палубы/босса/итога, окно терминала (склад, карта, сводка),
   всплывающие надписи. Тексты — только через g.t(). OTSEK.ui */
(function (global) {
  'use strict';
  var G = global.OTSEK = global.OTSEK || {};
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
    }
    if (theme !== lastTheme) { lastTheme = theme; document.body.setAttribute('data-theme', theme); }
  }

  // ---------- Примитивы ----------
  function txt(g, s, x, y, o, P) {
    o = o || {}; o.font = P.font;
    if (o.shadow !== false) { var c = o.color; o.color = P.pixel ? '#000000' : 'rgba(0,0,0,.65)'; g.text(s, x + (P.pixel ? 2 : 1), y + 2, o); o.color = c; }
    g.text(s, x, y, o);
  }
  function up(P, s) { return P.pixel ? String(s).toUpperCase() : String(s); }
  function panel(ctx, x, y, w, h, P, edge) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = edge || P.line; ctx.fillRect(x, y, w, 4); ctx.fillRect(x, y + h - 4, w, 4); ctx.fillRect(x, y, 4, h); ctx.fillRect(x + w - 4, y, 4, h);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 22; G.render.rrect(ctx, x, y, w, h, 12, P.panel); ctx.restore();
      ctx.strokeStyle = edge || P.line; ctx.lineWidth = 1.5; G.render.rrect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 12); ctx.stroke();
    }
  }
  function bar(ctx, x, y, w, h, f, col, P) {
    ctx.fillStyle = P.barBg; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col; ctx.fillRect(x, y, P.pixel ? Math.round(w * Math.max(0, f) / 4) * 4 : w * Math.max(0, Math.min(1, f)), h);
  }

  // ---------- Камера ----------
  var cam = { x: 0, y: 0, D: null };
  function camera(S, snap) {
    var L = G.logic, hs = S.heroes.filter(function (h) { return !h.out; }); if (!hs.length) hs = S.heroes;
    var mx = 0, my = 0; hs.forEach(function (h) { mx += h.x; my += h.y; }); mx /= hs.length; my /= hs.length;
    var tx = Math.max(0, Math.min(S.D.pw - L.VIEW_W, mx - L.VIEW_W / 2)), ty = Math.max(0, Math.min(S.D.ph - L.VIEW_H, my - L.VIEW_H / 2));
    if (snap || cam.D !== S.D) { cam.x = tx; cam.y = ty; cam.D = S.D; }
    else { cam.x += (tx - cam.x) * 0.18; cam.y += (ty - cam.y) * 0.18; }
    return cam;
  }

  // ---------- Мир ----------
  var buf = null, bctx = null, dark = null, darkR = null;
  function world(g, ctx, S, P, shake) {
    var L = G.logic, c = camera(S), sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
    var cc = { x: Math.round(c.x + sx), y: Math.round(c.y + sy) };
    if (P.pixel) {
      if (!buf) { buf = document.createElement('canvas'); buf.width = L.VIEW_W / 2; buf.height = L.VIEW_H / 2; bctx = buf.getContext('2d'); darkR = document.createElement('canvas'); darkR.width = buf.width; darkR.height = buf.height; }
      bctx.setTransform(0.5, 0, 0, 0.5, 0, 0); bctx.imageSmoothingEnabled = false;
      cc.x = Math.round(cc.x / 2) * 2; cc.y = Math.round(cc.y / 2) * 2;
      G.render.world(bctx, S, P, g.time, cc, L.VIEW_W, L.VIEW_H, darkR, 0.5);
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(buf, 0, L.HUD, L.VIEW_W, L.VIEW_H); ctx.restore();
    } else {
      if (!dark) { dark = document.createElement('canvas'); dark.width = L.VIEW_W; dark.height = L.VIEW_H; }
      ctx.save(); ctx.beginPath(); ctx.rect(0, L.HUD, L.VIEW_W, L.VIEW_H); ctx.clip(); ctx.translate(0, L.HUD);
      G.render.world(ctx, S, P, g.time, cc, L.VIEW_W, L.VIEW_H, dark, 1);
      ctx.restore();
    }
    if (S.alarm && !S.alarm.done) {   // тревожная пульсация
      var k = 0.5 + 0.5 * Math.sin(g.time * 6);
      ctx.fillStyle = P.pixel ? (k > 0.5 ? 'rgba(248,56,32,.12)' : 'rgba(0,0,0,0)') : 'rgba(255,40,30,' + (0.05 + 0.07 * k) + ')';
      ctx.fillRect(0, L.HUD, L.VIEW_W, L.VIEW_H);
    }
    return cc;
  }
  function sxy(c, x, y) { return [x - c.x, y - c.y + G.logic.HUD]; }

  // ---------- HUD ----------
  function heroInfo(g, ctx, S, P, h, x, al) {
    var L = G.logic, two = S.heroes.length === 2, w0 = al === 'right' ? -1 : 1;
    var name = (two ? g.t('p' + (h.id + 1)) : g.t('hero_' + h.id)) + ' ' + (h.out ? g.t('out') : '♥' + Math.max(0, h.lives));
    txt(g, up(P, name), x, 13, { size: 12, align: al, color: P.hero[h.id], weight: 800 }, P);
    var bx = al === 'right' ? x - 150 : x + 72;
    if (!h.out) bar(ctx, bx, 5, 78, 7, h.hp / L.HP, h.hp < 35 ? P.bad : P.good, P);
    var wn = h.ammo <= 0 ? g.t('w_wrench') : g.t('w_' + h.weapon);
    txt(g, up(P, wn) + ' · ' + h.ammo, x, 27, { size: 10, align: al, color: h.ammo < 20 ? P.bad : P.muted, weight: 700, shadow: false }, P);
    void w0;
  }
  function hud(g, ctx, S, P) {
    var L = G.logic, W = L.VIEW_W;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, L.HUD);
    ctx.fillStyle = P.line; ctx.fillRect(0, L.HUD - (P.pixel ? 2 : 1), W, P.pixel ? 2 : 1);
    txt(g, String(S.score), 10, 15, { size: 14, color: P.ink, weight: 800 }, P);
    txt(g, up(P, g.t('best')) + ' ' + Math.max(g.state.best || 0, S.score), 10, 28, { size: 9, color: P.muted, weight: 700, shadow: false }, P);
    heroInfo(g, ctx, S, P, S.heroes[0], 104, 'left');
    var cx = S.heroes[1] ? W / 2 + 4 : W / 2 + 70;
    txt(g, up(P, g.t('deckShort')) + ' ' + S.deck + '/' + S.maxDeck, cx, 13, { size: 12, align: 'center', color: P.accent, weight: 800 }, P);
    // карты и жетоны
    ctx.fillStyle = P.card; ctx.fillRect(cx - 52, 18, 12, 9); ctx.fillStyle = P.cardStripe; ctx.fillRect(cx - 52, 21, 12, 2);
    txt(g, '×' + S.cards, cx - 37, 27, { size: 12, color: P.card, weight: 800 }, P);
    G.render.circ(ctx, cx + 12, 22, 5, P.token);
    txt(g, String(S.tokens), cx + 20, 27, { size: 12, color: P.token, weight: 800 }, P);
    if (S.heroes[1]) heroInfo(g, ctx, S, P, S.heroes[1], W - 10, 'right');
    else txt(g, up(P, g.t('d_' + S.deck)), W - 10, 20, { size: 11, align: 'right', color: P.muted, weight: 700, shadow: false }, P);
  }

  // ---------- Над миром ----------
  function overlays(g, ctx, S, P, c, game) {
    var L = G.logic, W = L.VIEW_W, VH = L.VIEW_H, HUD = L.HUD;
    // подсказки «действия»
    if (S.phase === 'play') S.heroes.forEach(function (h) {
      var k = game && game.hint(h.id); if (!k) return;
      var p = sxy(c, h.x, h.y), s = (k === 'locked' ? '' : g.t('u_key') + ' ') + g.t('u_' + k);
      var col = k === 'locked' ? P.bad : k === 'door' ? P.accent : k === 'console' ? P.consoleLamp : P.termScreen;
      ctx.font = '700 11px ' + P.font; var tw = ctx.measureText(s).width + 12;
      ctx.fillStyle = P.pixel ? '#000' : 'rgba(0,0,0,.7)'; ctx.fillRect(p[0] - tw / 2, p[1] - 38, tw, 16);
      txt(g, up(P, s), p[0], p[1] - 26, { size: 11, align: 'center', color: col, weight: 700, shadow: false }, P);
    });
    // мёртвые герои — отметка «возрождение»
    S.heroes.forEach(function (h) { if (!h.alive && !h.out && S.phase === 'play') { var p = sxy(c, h.x, h.y); txt(g, '♥ ' + Math.ceil(h.deadT), p[0], p[1], { size: 14, align: 'center', color: P.hero[h.id], weight: 900 }, P); } });
    // босс
    var B = S.boss;
    if (B && !B.dead && B.active && B.intro <= 0) {
      var bw = 300, bx = (W - bw) / 2, by = HUD + 6;
      if (!P.pixel) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(bx - 6, by - 2, bw + 12, 22); }
      var tot = B.max, cur = Math.max(0, B.hp); B.nodes.forEach(function (e) { tot += e.max; cur += Math.max(0, e.hp); });
      bar(ctx, bx, by + 12, bw, 5, cur / tot, P.core, P);
      txt(g, up(P, g.t('b_' + B.key)), W / 2, by + 9, { size: 10, align: 'center', color: P.ink, weight: 800 }, P);
    }
    // отсчёт эвакуации и стрелка к шлюзу
    if (S.alarm && !S.alarm.done) {
      var t = Math.max(0, S.alarm.t), mm = Math.floor(t / 60), ss = Math.floor(t % 60), str = mm + ':' + (ss < 10 ? '0' : '') + ss;
      var blink = t < 10 && Math.floor(g.time * 4) % 2;
      var ay = B && !B.dead ? HUD + 34 : HUD + 8;
      if (!P.pixel) { ctx.fillStyle = 'rgba(30,0,0,.7)'; G.render.rrect(ctx, W / 2 - 110, ay, 220, 46, 10, 'rgba(30,0,0,.7)'); }
      else { ctx.fillStyle = '#000'; ctx.fillRect(W / 2 - 110, ay, 220, 46); }
      txt(g, up(P, g.t('alarm')), W / 2, ay + 15, { size: 11, align: 'center', color: P.bad, weight: 900 }, P);
      txt(g, str, W / 2, ay + 40, { size: 24, align: 'center', color: blink ? P.ink : P.bad, weight: 900 }, P);
      var A = S.D.airlock, axx = (A.x0 + A.x1) / 2, ayy = (A.y0 + A.y1) / 2, p2 = sxy(c, axx, ayy);
      var onScr = p2[0] > 0 && p2[0] < W && p2[1] > HUD && p2[1] < HUD + VH;
      if (onScr) txt(g, up(P, g.t('airlock')), p2[0], p2[1] - 50, { size: 12, align: 'center', color: P.good, weight: 900 }, P);
      else {
        var cx0 = W / 2, cy0 = HUD + VH / 2, an = Math.atan2(p2[1] - cy0, p2[0] - cx0), rx = Math.cos(an), ry = Math.sin(an);
        var k = Math.min((W / 2 - 26) / Math.abs(rx || 1e-6), (VH / 2 - 26) / Math.abs(ry || 1e-6)), px = cx0 + rx * k, py = cy0 + ry * k;
        ctx.save(); ctx.translate(px, py); ctx.rotate(an); ctx.fillStyle = Math.floor(g.time * 4) % 2 ? P.good : P.goodDim;
        ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
  }
  function banners(g, ctx, S, P) {
    var L = G.logic, W = L.VIEW_W, cy = L.HUD + L.VIEW_H / 2;
    if (S.banner > 0 && S.phase === 'play') {
      ctx.globalAlpha = Math.min(1, S.banner * 2);
      panel(ctx, 120, cy - 120, W - 240, 100, P, P.accent);
      txt(g, up(P, g.t('deck')) + ' ' + S.deck + ' / ' + S.maxDeck, W / 2, cy - 92, { size: 13, align: 'center', color: P.muted, weight: 800 }, P);
      txt(g, up(P, g.t('d_' + S.deck)), W / 2, cy - 62, { size: 26, align: 'center', color: P.accent, weight: 900 }, P);
      txt(g, g.t(S.D.objective.kind === 'boss' ? 'goal_boss' : 'goal_console'), W / 2, cy - 38, { size: 11, align: 'center', color: P.ink, weight: 600, shadow: false }, P);
      ctx.globalAlpha = 1;
    }
    var B = S.boss;
    if (B && B.intro > 0 && S.phase === 'play') {
      panel(ctx, 150, cy - 110, W - 300, 80, P, P.core);
      txt(g, up(P, g.t('b_' + B.key)), W / 2, cy - 74, { size: 24, align: 'center', color: P.core, weight: 900 }, P);
      txt(g, g.t('bossSub_' + B.key), W / 2, cy - 50, { size: 11, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
    }
    if (S.alarm && !S.alarm.done && S.alarm.max - S.alarm.t < 2.5 && S.phase === 'play') {
      txt(g, up(P, g.t('alarmSub')), W / 2, cy - 60, { size: 18, align: 'center', color: P.bad, weight: 900 }, P);
    }
    if (S.phase === 'clear') {
      panel(ctx, 150, cy - 70, W - 300, 120, P, S.lastBonus ? P.good : P.bad);
      txt(g, up(P, g.t(S.lastBonus ? 'clear' : 'clearBlast')), W / 2, cy - 34, { size: 24, align: 'center', color: S.lastBonus ? P.good : P.bad, weight: 900 }, P);
      if (S.lastBonus) {
        txt(g, g.t('bonus') + ': ' + S.lastBonus, W / 2, cy - 4, { size: 14, align: 'center', color: P.accent, weight: 700 }, P);
        txt(g, g.t('left') + ': ' + S.lastLeft + ' s', W / 2, cy + 18, { size: 12, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
      }
    }
  }
  // ---------- Терминал ----------
  function terminal(g, ctx, S, P, game) {
    var L = G.logic, W = L.VIEW_W, T = S.term; if (!T) return;
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.7)' : 'rgba(4,8,10,.6)'; ctx.fillRect(0, L.HUD, W, L.VIEW_H);
    var pw = 500, ph = 420, px = (W - pw) / 2, py = L.HUD + 30;
    panel(ctx, px, py, pw, ph, P, P.termScreen);
    txt(g, up(P, g.t('termTitle')) + (S.heroes.length > 1 ? ' · ' + g.t('p' + (T.pi + 1)) : ''), px + 18, py + 26, { size: 13, color: P.termScreen, weight: 900 }, P);
    ['t_shop', 't_map', 't_brief'].forEach(function (k, i) {
      var tx = px + pw - 270 + i * 88, on = T.tab === i;
      ctx.fillStyle = on ? P.termScreen : P.barBg; ctx.fillRect(tx, py + 12, 82, 20);
      txt(g, up(P, g.t(k)), tx + 41, py + 26, { size: 11, align: 'center', color: on ? P.termText : P.muted, weight: 800, shadow: false }, P);
    });
    var top = py + 46, h = S.heroes[T.pi];
    if (T.tab === 0) {
      L.SHOP.forEach(function (it, i) {
        var y = top + i * 25, sel = i === T.sel, st = game ? game.canBuy(T.pi, it.id) : 'ok';
        if (sel) { ctx.fillStyle = P.pixel ? P.termText : 'rgba(88,224,208,.14)'; ctx.fillRect(px + 12, y, pw - 24, 23); }
        var col = st === 'ok' ? P.ink : P.muted;
        txt(g, (sel ? '▸ ' : '  ') + up(P, g.t('s_' + it.id)), px + 18, y + 16, { size: 12, color: sel ? P.termScreen : col, weight: 700, shadow: false }, P);
        var stTxt = st === 'owned' ? g.t('st_owned') : st === 'full' ? g.t('st_full') : '';
        if (stTxt) txt(g, up(P, stTxt), px + pw - 110, y + 16, { size: 10, align: 'right', color: P.muted, weight: 600, shadow: false }, P);
        G.render.circ(ctx, px + pw - 86, y + 12, 4, st === 'money' ? P.badDim : P.token);
        txt(g, String(it.price), px + pw - 20, y + 16, { size: 12, align: 'right', color: st === 'money' ? P.bad : P.token, weight: 800, shadow: false }, P);
      });
      var it2 = L.SHOP[T.sel];
      txt(g, g.t('sd_' + it2.id), px + 18, py + ph - 64, { size: 11, color: P.muted, weight: 600, shadow: false }, P);
    } else if (T.tab === 1) {
      G.render.map(ctx, S, P, px + 20, top + 4, pw - 40, ph - 130, g.time);
      if (!S.mapOwned) txt(g, g.t('noMap'), W / 2, py + ph - 64, { size: 11, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
    } else {
      var found = S.deckStats.length ? S.deckStats[S.deckStats.length - 1].cards : 0, lines = [
        [g.t('br_goal'), g.t(S.D.objective.kind === 'boss' ? 'br_boss' : 'br_console')],
        [g.t('br_doors'), String(S.D.pathDoors)],
        [g.t('br_cards'), found + ' / ' + (S.mapOwned ? S.cardsOnFloor.length : '?')],
        [g.t('br_inv'), String(S.cards)]
      ];
      lines.forEach(function (l, i) {
        txt(g, up(P, l[0]), px + 24, top + 30 + i * 30, { size: 12, color: P.muted, weight: 700, shadow: false }, P);
        txt(g, up(P, l[1]), px + pw - 24, top + 30 + i * 30, { size: 13, align: 'right', color: P.ink, weight: 800, shadow: false }, P);
      });
      wrap(g, g.t('br_tip'), px + 24, top + 170, pw - 48, P);
      wrap(g, g.t('br_alarm'), px + 24, top + 230, pw - 48, P);
    }
    // низ: кошелёк и подсказка
    ctx.fillStyle = P.line; ctx.fillRect(px + 12, py + ph - 52, pw - 24, 1);
    G.render.circ(ctx, px + 24, py + ph - 34, 5, P.token);
    txt(g, String(S.tokens), px + 34, py + ph - 29, { size: 13, color: P.token, weight: 800, shadow: false }, P);
    ctx.fillStyle = P.card; ctx.fillRect(px + 100, py + ph - 39, 12, 9);
    txt(g, '×' + S.cards, px + 116, py + ph - 29, { size: 13, color: P.card, weight: 800, shadow: false }, P);
    if (h) txt(g, g.t('ammo') + ' ' + h.ammo + ' · ♥' + Math.round(h.hp) + ' · ' + g.t('w_' + h.weapon), px + pw - 18, py + ph - 29, { size: 11, align: 'right', color: P.muted, weight: 700, shadow: false }, P);
    txt(g, g.t('termHint'), W / 2, py + ph - 10, { size: 10, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
  }
  function wrap(g, s, x, y, w, P) {
    var ctx = g.ctx, words = s.split(' '), line = ''; ctx.font = '600 12px ' + P.font;
    words.forEach(function (wd) { var t = line ? line + ' ' + wd : wd; if (ctx.measureText(t).width > w) { txt(g, line, x, y, { size: 12, color: P.ink, weight: 600, shadow: false }, P); y += 17; line = wd; } else line = t; });
    if (line) txt(g, line, x, y, { size: 12, color: P.ink, weight: 600, shadow: false }, P);
  }
  function toasts(g, ctx, S, P, list, c) {
    list.forEach(function (o) {
      var p = o.screen ? [o.x, o.y] : sxy(c, o.x, o.y), y = p[1] - (1.4 - o.t) * 24;
      ctx.globalAlpha = Math.min(1, o.t * 2);
      txt(g, up(P, o.text), p[0], y, { size: o.big ? 15 : 11, align: 'center', color: o.color, weight: 800 }, P);
      ctx.globalAlpha = 1;
    });
  }

  function render(g, ctx, S, P, o) {
    o = o || {};
    sync(g);
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, g.W, g.H);
    var c = world(g, ctx, S, P, o.shake || 0);
    if (!o.bare) { overlays(g, ctx, S, P, c, o.game); toasts(g, ctx, S, P, o.toasts || [], c); hud(g, ctx, S, P); banners(g, ctx, S, P); terminal(g, ctx, S, P, o.game); }
  }

  G.ui = {
    init: function (g) { var f = function () { fit(g); }; addEventListener('resize', f); f(); setTimeout(f, 50); sync(g); },
    fit: fit, sync: sync, txt: txt, panel: panel, up: up, world: world, render: render, camera: camera, cam: cam
  };
})(typeof window !== 'undefined' ? window : globalThis);
