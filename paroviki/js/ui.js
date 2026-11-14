/* ПАРОВИКИ · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема) и конвейер кадра —
   мир под камерой (retro — в буфер половинного размера и ×2 без сглаживания), мини-карта разведанного,
   стрелки к шлюзу/вентилям, HUD двух героев, баннеры, лавка, «Продолжить?», всплывающие надписи. PAROVIKI.ui */
(function (global) {
  'use strict';
  var PV = global.PAROVIKI = global.PAROVIKI || {};
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, pad = document.querySelector('.pad');
    var padH = pad && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 16 : 0;
    var availW = Math.min(innerWidth - 16, 980), availH = innerHeight - padH - 70;
    var w = Math.max(280, Math.floor(Math.min(availW, availH * g.W / g.H)));
    c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
  }
  var lastLang = null, lastTheme = null;
  function sync(g) {
    var lang = g.i18n.lang, theme = g.themeName;
    if (lang !== lastLang) {
      lastLang = lang; document.documentElement.lang = lang;
      var b = $('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = $('foot'); if (f) f.innerHTML = g.t('foot');
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
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 20; PV.render.rrect(ctx, x, y, w, h, 12, P.panel); ctx.restore();
      ctx.strokeStyle = edge || P.line; ctx.lineWidth = 1.5; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5, 12); else ctx.rect(x + 0.75, y + 0.75, w - 1.5, h - 1.5); ctx.stroke();
    }
  }
  function bar(ctx, x, y, w, h, f, col, P) {
    ctx.fillStyle = P.barBg; ctx.fillRect(x, y, w, h);
    f = Math.max(0, Math.min(1, f)); ctx.fillStyle = col; ctx.fillRect(x, y, P.pixel ? Math.round(w * f / 2) * 2 : w * f, h);
  }

  // ---------- Мир под камерой ----------
  var buf = null, bctx = null;
  function world(g, ctx, S, P, shake) {
    var L = PV.logic, sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0, time = g.time;
    var cx = Math.round(S.cam.x), cy = Math.round(S.cam.y), view = { x: cx, y: cy, w: L.W, h: L.VH };
    if (P.pixel) {
      cx = cx - (cx & 1); cy = cy - (cy & 1); view.x = cx; view.y = cy;
      if (!buf) { buf = document.createElement('canvas'); buf.width = L.W / 2; buf.height = L.VH / 2; bctx = buf.getContext('2d'); }
      bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.fillStyle = '#000'; bctx.fillRect(0, 0, buf.width, buf.height);
      bctx.setTransform(0.5, 0, 0, 0.5, -cx / 2, -cy / 2); bctx.imageSmoothingEnabled = false;
      PV.render.world(bctx, S, P, time, view);
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(buf, Math.round(sx / 2) * 2, L.HUD + Math.round(sy / 2) * 2, L.W, L.VH); ctx.restore();
    } else {
      ctx.save(); ctx.beginPath(); ctx.rect(0, L.HUD, L.W, L.VH); ctx.clip();
      ctx.fillStyle = '#0b0a09'; ctx.fillRect(0, L.HUD, L.W, L.VH);
      ctx.translate(sx - cx, L.HUD + sy - cy);
      PV.render.world(ctx, S, P, time, view);
      ctx.restore();
      // мягкая виньетка
      var gr = ctx.createRadialGradient(L.W / 2, L.HUD + L.VH / 2, L.VH * 0.4, L.W / 2, L.HUD + L.VH / 2, L.VH * 0.85);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.35)'); ctx.fillStyle = gr; ctx.fillRect(0, L.HUD, L.W, L.VH);
    }
  }

  // ---------- Мини-карта, стрелки, подписи над героями ----------
  function overlayWorld(g, ctx, S, P) {
    var L = PV.logic, m = S.map, T = L.T; if (!m) return;
    // подпись «ИИ» над напарником и «И1/И2» вдвоём
    S.heroes.forEach(function (h) {
      if (!h.alive) return;
      var x = h.x - S.cam.x, y = h.y - S.cam.y + L.HUD - 24;
      var lab = h.ai ? g.t('ai') : S.players === 2 ? g.t('p' + (h.id + 1)) : null;
      if (lab) txt(g, lab, x, y, { size: 9, align: 'center', color: P.hero[h.t.hid], weight: 800 }, P);
      if (h.down) txt(g, up(P, g.t('down')), x, y - 10, { size: 9, align: 'center', color: P.warn, weight: 800 }, P);
    });
    // стрелки: к шлюзу (когда открыт) и к вентилям (при «Лоции»)
    var tg = [];
    if (S.exitOpen) tg.push({ x: m.exit.x, y: m.exit.y, c: P.exitOpen });
    if (S.chartT > 0) S.objs.forEach(function (o) { if (o.kind === 'valve' && !o.on) tg.push({ x: o.x, y: o.y, c: P.valve }); });
    var hx = S.cam.x + L.W / 2, hy = S.cam.y + L.VH / 2;
    tg.forEach(function (t) {
      var sx = t.x - S.cam.x, sy = t.y - S.cam.y; if (sx > 10 && sx < L.W - 10 && sy > 10 && sy < L.VH - 10) return;
      var a = Math.atan2(t.y - hy, t.x - hx), R = Math.min(L.W, L.VH) / 2 - 22, px = L.W / 2 + Math.cos(a) * R * 1.25, py = L.HUD + L.VH / 2 + Math.sin(a) * R;
      px = Math.max(16, Math.min(L.W - 16, px)); py = Math.max(L.HUD + 16, Math.min(L.HUD + L.VH - 16, py));
      ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.fillStyle = t.c; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -8); ctx.lineTo(-3, 0); ctx.lineTo(-7, 8); ctx.fill(); ctx.restore();
    });
    // мини-карта разведанного
    if (S.boss) return;
    var s = 3, mw = m.TW * s, mh = m.TH * s, mx = L.W - mw - 8, my = L.HUD + 8;
    ctx.globalAlpha = P.pixel ? 0.85 : 0.75; ctx.fillStyle = P.pixel ? '#000' : 'rgba(10,10,12,.8)'; ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
    var TL = L.TILE, Wd = P.worlds[S.world];
    for (var y = 0; y < m.TH; y++) for (var x = 0; x < m.TW; x++) {
      if (!S.seen[y * m.TW + x]) continue; var t = m.tiles[y * m.TW + x];
      ctx.fillStyle = t === TL.WALL ? Wd.wallTop : t === TL.DOOR ? P.door : t === TL.BAR ? P.bar : t === TL.CRACK ? (S.chartT > 0 ? P.warn : Wd.wallTop) : Wd.floor2;
      if (t === TL.FLOOR || t === TL.PIT || t === TL.CRATE || t === TL.NEST) ctx.fillStyle = P.pixel ? Wd.floor : '#4a4844';
      ctx.fillRect(mx + x * s, my + y * s, s, s);
    }
    ctx.globalAlpha = 1;
    function dot(o, c, r) { var tx = Math.floor(o.x / T), ty = Math.floor(o.y / T); if (!S.seen[ty * m.TW + tx]) return; ctx.fillStyle = c; ctx.fillRect(mx + tx * s - r + 1, my + ty * s - r + 1, r * 2 + 1, r * 2 + 1); }
    S.objs.forEach(function (o) { if (o.kind === 'valve') dot(o, o.on ? P.valveOn : P.valve, 1); else if (o.kind === 'key') dot(o, P.key, 1); else if (o.kind === 'lever' && !o.on) dot(o, P.leverOff, 1); });
    dot(m.exit, S.exitOpen ? P.exitOpen : P.exitRim, 1);
    S.heroes.forEach(function (h) { if (h.alive) { ctx.fillStyle = P.hero[h.t.hid]; ctx.fillRect(mx + h.x / T * s - 2, my + h.y / T * s - 2, 4, 4); } });
    ctx.strokeStyle = P.muted; ctx.lineWidth = 1; ctx.strokeRect(mx + S.cam.x / T * s, my + S.cam.y / T * s, L.W / T * s, L.VH / T * s);
  }

  // ---------- HUD ----------
  function heroHud(g, ctx, S, P, h, x, right) {
    var L = PV.logic, H = L.HEROES[h.t.hid], al = right ? 'right' : 'left', col = P.hero[h.t.hid];
    var name = g.t('h_' + H.key) + (h.ai ? ' · ' + g.t('ai') : S.players === 2 ? ' · ' + g.t('p' + (h.id + 1)) : '');
    txt(g, up(P, name), x, 12, { size: 11, align: al, color: col, weight: 800 }, P);
    var bw = 96, bx = right ? x - bw : x;
    bar(ctx, bx, 16, bw, 5, h.alive ? h.hp / h.maxHp : 0, h.down ? P.warn : h.hp < h.maxHp * 0.3 ? P.bad : P.good, P);
    var lives = h.ai ? '' : (h.out ? g.t('out') : '♥' + Math.max(0, h.t.lives)) + '  ';
    var info = lives + '◆' + h.t.money + '  ✸' + h.t.spec + '  ' + 'I'.repeat(h.t.gun);
    txt(g, info, x, 30, { size: 10, align: al, color: P.muted, weight: 700, shadow: false }, P);
  }
  function hud(g, ctx, S, P) {
    var L = PV.logic, W = L.W;
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, W, L.HUD);
    ctx.fillStyle = P.line; ctx.fillRect(0, L.HUD - (P.pixel ? 2 : 1), W, P.pixel ? 2 : 1);
    heroHud(g, ctx, S, P, S.heroes[0], 8, false);
    heroHud(g, ctx, S, P, S.heroes[1], W - 8, true);
    var vt = S.objs.filter(function (o) { return o.kind === 'valve'; }), on = vt.filter(function (o) { return o.on; }).length;
    var lv = S.lvl === L.LEVELS ? g.t('bossLvl') : S.world + '-' + S.lvl;
    txt(g, up(P, g.t('worldShort')) + ' ' + lv + ' · ' + up(P, g.t('score')) + ' ' + S.score, W / 2, 13, { size: 12, align: 'center', color: P.accent, weight: 800 }, P);
    var vs = up(P, g.t('valves')) + ' ' + on + '/' + vt.length + (S.keys ? '   ' + up(P, g.t('keys')) + ' ' + S.keys : '') + (S.exitOpen && !S.boss ? '   → ' + g.t('toExit') : '');
    txt(g, vs, W / 2, 28, { size: 11, align: 'center', color: S.exitOpen ? P.exitOpen : P.ink, weight: 700, shadow: false }, P);
    var B = S.boss;
    if (B && !B.dead && B.intro <= 0) {
      var bw = 300, bx = (W - bw) / 2, by = L.HUD + 6;
      if (!P.pixel) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(bx - 6, by - 2, bw + 12, 24); }
      bar(ctx, bx, by + 13, bw, 5, B.hp / B.max, B.armor > 0 ? P.bossArmor : P.markEdge, P);
      txt(g, up(P, g.t('b_' + B.key)) + (B.armor > 0 ? ' · ' + g.t('valves') + ' ' + (B.armorMax - B.armor) + '/' + B.armorMax : ''), W / 2, by + 9, { size: 10, align: 'center', color: P.ink, weight: 800 }, P);
    }
  }

  // ---------- Баннеры ----------
  function banners(g, ctx, S, P) {
    var L = PV.logic, W = L.W, cy = L.HUD + L.VH / 2;
    if (S.banner > 0 && S.phase === 'play' && !S.boss) {
      ctx.globalAlpha = Math.min(1, S.banner * 1.5);
      panel(ctx, 140, cy - 80, W - 280, 104, P, P.accent);
      txt(g, up(P, g.t('world')) + ' ' + S.world + ' · ' + up(P, g.t('level')) + ' ' + S.lvl, W / 2, cy - 52, { size: 13, align: 'center', color: P.muted, weight: 800 }, P);
      txt(g, up(P, g.t('w_' + S.world)), W / 2, cy - 22, { size: 26, align: 'center', color: P.accent, weight: 900 }, P);
      txt(g, g.t('introSub'), W / 2, cy + 4, { size: 11, align: 'center', color: P.ink, weight: 600, shadow: false }, P);
      ctx.globalAlpha = 1;
    }
    var B = S.boss;
    if (B && B.intro > 0 && S.phase === 'play') {
      panel(ctx, 110, cy - 60, W - 220, 92, P, P.markEdge);
      txt(g, up(P, g.t('b_' + B.key)), W / 2, cy - 20, { size: 24, align: 'center', color: P.markEdge, weight: 900 }, P);
      txt(g, g.t('bossSub'), W / 2, cy + 8, { size: 11, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
    }
    if (S.phase === 'clear') {
      panel(ctx, 150, cy - 56, W - 300, 100, P, P.good);
      txt(g, up(P, g.t(S.boss ? 'bossDone' : 'levelDone')), W / 2, cy - 18, { size: 22, align: 'center', color: P.good, weight: 900 }, P);
      txt(g, g.t('bonus') + ': ' + (L.SCORE.level * S.world), W / 2, cy + 12, { size: 14, align: 'center', color: P.accent, weight: 700 }, P);
    }
    if (S.phase === 'cont') {
      ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.6)' : 'rgba(8,8,10,.6)'; ctx.fillRect(0, L.HUD, W, L.VH);
      panel(ctx, 170, cy - 80, W - 340, 150, P, P.warn);
      txt(g, up(P, g.t('contAsk')), W / 2, cy - 42, { size: 24, align: 'center', color: P.warn, weight: 900 }, P);
      txt(g, String(Math.ceil(S.contT)), W / 2, cy + 10, { size: 44, align: 'center', color: P.ink, weight: 900 }, P);
      txt(g, g.t('contHint'), W / 2, cy + 38, { size: 12, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
      txt(g, g.t('contLeft') + ': ' + S.continues, W / 2, cy + 58, { size: 11, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
    }
  }

  // ---------- Лавка ----------
  function shop(g, ctx, S, P, game, flash) {
    var L = PV.logic, W = L.W, H = L.SCREEN_H;
    ctx.fillStyle = P.pixel ? '#000' : 'rgba(10,9,8,.86)'; ctx.fillRect(0, 0, W, H);
    var n = game.nextLevel();
    txt(g, up(P, g.t('shop')), W / 2, 34, { size: 24, align: 'center', color: P.accent, weight: 900 }, P);
    txt(g, g.t('next') + ': ' + g.t('worldShort') + ' ' + n.world + ' · ' + (n.lvl === L.LEVELS ? g.t('bossLvl') : g.t('level') + ' ' + n.lvl) + ' — ' + g.t('w_' + n.world) + '   ·   ' + g.t('password') + ': ' + game.password(), W / 2, 54, { size: 11, align: 'center', color: P.muted, weight: 700, shadow: false }, P);
    [0, 1].forEach(function (pi) {
      var t = S.team[pi], Hh = L.HEROES[t.hid], x = 16 + pi * (W / 2), w = W / 2 - 24, y = 70, col = P.hero[t.hid], st = S.shop[pi];
      panel(ctx, x, y, w, 360, P, col);
      var h = S.heroes[pi], isAi = pi === 1 && S.aiOn;
      txt(g, up(P, g.t('h_' + Hh.key)) + (isAi ? ' · ' + g.t('ai') : S.players === 2 ? ' · ' + g.t('p' + (pi + 1)) : ''), x + 14, y + 24, { size: 15, color: col, weight: 900 }, P);
      txt(g, '◆ ' + t.money, x + w - 14, y + 24, { size: 15, align: 'right', color: P.coin, weight: 900 }, P);
      var hpNow = t.hp != null ? Math.round(t.hp) : game.maxHp(t);
      txt(g, g.t('g_' + Hh.gun) + ' ' + t.gun + '/4 · ✸' + t.spec + ' · ' + g.t('hpShort') + ' ' + hpNow + '/' + game.maxHp(t) + (isAi ? '' : ' · ' + g.t('lives') + ' ' + t.lives), x + 14, y + 42, { size: 10, color: P.muted, weight: 700, shadow: false }, P);
      if (isAi) {
        txt(g, g.t('aiBuys'), x + 14, y + 74, { size: 12, color: P.ink, weight: 700, shadow: false }, P);
        var list = st.bought.length ? st.bought : null;
        if (!list) txt(g, '— ' + g.t('aiNothing'), x + 14, y + 96, { size: 12, color: P.muted, weight: 600, shadow: false }, P);
        else list.slice(0, 10).forEach(function (it, i) { txt(g, '+ ' + itemName(g, t, it), x + 14, y + 96 + i * 20, { size: 12, color: P.good, weight: 700, shadow: false }, P); });
        return;
      }
      var items = game.shopItems(pi);
      items.forEach(function (it, i) {
        var yy = y + 72 + i * 38, sel = st.sel === i && !st.ready, p = it === 'ready' ? null : game.price(pi, it);
        if (sel) { if (P.pixel) { ctx.fillStyle = col; ctx.fillRect(x + 8, yy - 15, 4, 28); } else { ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x + 6, yy - 16, w - 12, 30); ctx.fillStyle = col; ctx.fillRect(x + 6, yy - 16, 3, 30); } }
        var name = itemName(g, t, it), right = it === 'ready' ? '' : p == null ? g.t('max') : '◆ ' + p;
        var c = it === 'ready' ? P.accent : p == null ? P.muted : t.money >= p ? P.ink : P.bad;
        txt(g, (sel ? '▸ ' : '  ') + name, x + 14, yy, { size: 13, color: sel ? col : c, weight: sel ? 900 : 700, shadow: false }, P);
        if (right) txt(g, right, x + w - 14, yy, { size: 12, align: 'right', color: c, weight: 800, shadow: false }, P);
        var lvl = levelOf(t, it); if (lvl) txt(g, lvl, x + 30, yy + 13, { size: 9, color: P.muted, weight: 600, shadow: false }, P);
      });
      if (st.ready) { ctx.fillStyle = P.pixel ? '#000' : 'rgba(0,0,0,.6)'; ctx.fillRect(x + 4, y + 52, w - 8, 300); txt(g, g.t('waitMate'), x + w / 2, y + 200, { size: 15, align: 'center', color: P.accent, weight: 800 }, P); }
      if (flash && flash[pi] && flash[pi].t > 0) txt(g, flash[pi].text, x + w / 2, y + 352, { size: 12, align: 'center', color: flash[pi].ok ? P.good : P.bad, weight: 800 }, P);
    });
    txt(g, g.t('shopHint'), W / 2, H - 46, { size: 11, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
  }
  function itemName(g, t, it) {
    var L = PV.logic, Hh = L.HEROES[t.hid];
    if (it === 'gun') return g.t('u_gun') + ': ' + g.t('g_' + Hh.gun) + ' ' + Math.min(4, t.gun + 1);
    if (it === 'spec') return g.t('u_spec') + ' (' + g.t('s_' + Hh.spec) + ')';
    return g.t('u_' + it);
  }
  function levelOf(t, it) {
    var L = PV.logic, tr = L.HEROES[t.hid].tree;
    if (it === 'gun') return '●'.repeat(t.gun) + '○'.repeat(4 - t.gun);
    if (it === 'hp') return '●'.repeat(t.hpL) + '○'.repeat(3 - t.hpL);
    if (it === 'spec') return '✸'.repeat(t.spec) + '·'.repeat(L.SHOP.SPEC_MAX - t.spec);
    if (tr.indexOf(it) >= 0) { var lv = tr[0] === it ? t.mA : t.mB, mx = L.SHOP[it].length; return '●'.repeat(lv) + '○'.repeat(mx - lv); }
    return '';
  }

  function toasts(g, ctx, S, P, list) {
    var L = PV.logic;
    list.forEach(function (o) {
      var y = o.y - S.cam.y + L.HUD - (1.3 - o.t) * 26, x = o.x - S.cam.x;
      if (o.screen) { x = o.x; y = o.y - (1.3 - o.t) * 20; }
      ctx.globalAlpha = Math.min(1, o.t * 2);
      txt(g, up(P, o.text), x, y, { size: o.big ? 16 : 11, align: 'center', color: o.color, weight: 800 }, P);
      ctx.globalAlpha = 1;
    });
  }

  function render(g, ctx, S, P, o) {
    o = o || {};
    sync(g);
    ctx.fillStyle = P.hudBg; ctx.fillRect(0, 0, g.W, g.H);
    if (!S.map) return;
    world(g, ctx, S, P, o.shake || 0);
    if (o.bare) return;
    overlayWorld(g, ctx, S, P);
    toasts(g, ctx, S, P, o.toasts || []);
    hud(g, ctx, S, P); banners(g, ctx, S, P);
    if (S.phase === 'shop' && o.game) shop(g, ctx, S, P, o.game, o.flash);
  }

  PV.ui = {
    init: function (g) { var f = function () { fit(g); }; addEventListener('resize', f); f(); setTimeout(f, 50); sync(g); },
    fit: fit, sync: sync, txt: txt, panel: panel, up: up, bar: bar, world: world, render: render, itemName: itemName
  };
})(typeof window !== 'undefined' ? window : globalThis);
