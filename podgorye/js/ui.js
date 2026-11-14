/* ПОДГОРЬЕ · ui.js — HUD (здоровье, искра, способности, мини-карта, шкала босса), карта мира (пауза),
   экран слотов сохранения, меню лифта, баннеры, титульная картина. Только отрисовка; данные — из S и мира. */
(function (global) {
  'use strict';
  var P = global.PODGORYE = global.PODGORYE || {};
  var R = function () { return P.R; };
  var ABIL = ['boots', 'dash', 'gloves', 'hook', 'hammer', 'bell', 'cloak', 'light'];

  function panel(g, ctx, x, y, w, h, retro, a) {
    if (retro) { ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#aa5500'; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h); return; }
    ctx.save(); ctx.fillStyle = 'rgba(14,10,8,' + (a == null ? 0.72 : a) + ')'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, 8); else ctx.rect(x, y, w, h); ctx.fill();
    ctx.strokeStyle = 'rgba(232,144,58,0.35)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  }
  function flame(ctx, x, y, on, retro, t) {
    if (retro) { ctx.fillStyle = on ? '#ff5555' : '#555555'; ctx.fillRect(x, y + 2, 8, 8); ctx.fillStyle = on ? '#ffff55' : '#000'; ctx.fillRect(x + 2, y, 4, 4); if (on) { ctx.fillStyle = '#ffff55'; ctx.fillRect(x + 3, y + 5, 2, 3); } return; }
    var fl = on ? Math.sin(t * 8 + x) * 1 : 0;
    ctx.fillStyle = on ? '#ff6a2a' : 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.moveTo(x + 4, y - 1 + fl); ctx.quadraticCurveTo(x + 9, y + 5, x + 7, y + 9); ctx.quadraticCurveTo(x + 4, y + 11, x + 1, y + 9); ctx.quadraticCurveTo(x - 1, y + 5, x + 4, y - 1 + fl); ctx.fill();
    if (on) { ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(x + 4, y + 7, 2, 0, 7); ctx.fill(); }
  }
  function clock(t) { t = Math.max(0, Math.round(t)); var h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60; return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s; }

  // ---------- HUD ----------
  function hud(g, ctx, S, ui) {
    var retro = g.themeName === 'retro', t = g.time, W = S.W, th = g.th();
    var n = S.prog.hpMax, pw = Math.max(120, 14 + n * 11);
    panel(g, ctx, 6, 6, pw, 34, retro);
    for (var i = 0; i < n; i++) flame(ctx, 12 + i * 11, 10, i < Math.ceil(S.hp - 0.01), retro, t);
    for (var j = 0; j < S.prog.tanks; j++) {
      var fillv = Math.max(0, Math.min(1, S.spark - j));
      ctx.fillStyle = retro ? '#555555' : 'rgba(255,255,255,0.12)'; ctx.fillRect(12 + j * 14, 26, 11, 8);
      ctx.fillStyle = retro ? '#55ffff' : '#9fe4ff'; ctx.fillRect(12 + j * 14, 26 + 8 * (1 - fillv), 11, 8 * fillv);
    }
    // способности
    var ax = pw + 14, have = ABIL.filter(function (a) { return S.prog.ab[a]; });
    if (have.length) { panel(g, ctx, ax - 4, 6, have.length * 18 + 6, 22, retro); have.forEach(function (a, k) { R().abilityIcon(ctx, a, ax + 6 + k * 18, 17, retro, 1); }); }
    // мини-карта
    minimap(g, ctx, S, g.W - 118, 6, 112, 64, retro, t);
    g.text(g.t('z' + S.R.src.zone), g.W - 62, 82, { size: 10, align: 'center', color: th.muted, weight: 700 });
    // шкала босса
    var B = S.boss;
    if (B && !B.dead) {
      var bw = 300, bx = (g.W - bw) / 2, by = g.H - 22;
      panel(g, ctx, bx - 8, by - 16, bw + 16, 30, retro);
      g.text(g.t('b_' + B.id), g.W / 2, by - 3, { size: 11, align: 'center', color: th.accent, weight: 800 });
      ctx.fillStyle = retro ? '#555555' : 'rgba(255,255,255,0.12)'; ctx.fillRect(bx, by + 2, bw, 6);
      ctx.fillStyle = retro ? '#ff5555' : '#ff6a3a'; ctx.fillRect(bx, by + 2, bw * B.hp / B.max, 6);
      if (B.id === 'scale') { ctx.fillStyle = retro ? '#ffff55' : '#ffd27a'; ctx.fillRect(bx + bw / 2 - 1, by, 2, 10); }
    }
    // подсказка у объекта
    if (S.near && S.phase === 'play') { var tx = g.t('near_' + S.near); g.text(tx, g.W / 2, g.H - (B && !B.dead ? 48 : 16), { size: 12, align: 'center', color: th.ink, weight: 700 }); }
  }
  function zoneColor(z, retro, dim) {
    var Z = (retro ? R().ZR : R().ZM)[z];
    return retro ? Z.rock : (dim ? Z.rock : Z.hi);
  }
  function minimap(g, ctx, S, x, y, w, h, retro, t) {
    panel(g, ctx, x, y, w, h, retro);
    var W = S.W, cw = 14, ch = 9, cur = W.rooms[S.room];
    var hcx = cur.gx + (S.hero.x / 40), hcy = cur.gy + ((S.hero.y - 1) / 22);
    var ox = x + w / 2 - hcx * cw, oy = y + h / 2 - hcy * ch;
    ctx.save(); ctx.beginPath(); ctx.rect(x + 3, y + 3, w - 6, h - 6); ctx.clip();
    drawRooms(g, ctx, S, ox, oy, cw, ch, retro, t, false);
    ctx.restore();
  }
  function drawRooms(g, ctx, S, ox, oy, cw, ch, retro, t, full, sel) {
    var W = S.W, vis = S.prog.visited;
    W.rooms.forEach(function (rm) {
      if (!vis[rm.i]) return;
      var x = ox + rm.gx * cw, y = oy + rm.gy * ch, w = rm.w * cw, h = rm.h * ch;
      ctx.fillStyle = zoneColor(rm.zone, retro, true); ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      if (!retro) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x + 1, y + 1, w - 2, 2); }
      rm.doors.forEach(function (d) {
        if (d.gate === 'secret' && !S.prog.visited[d.to]) return;
        ctx.fillStyle = zoneColor(rm.zone, retro, true);
        if (d.side === 'L') ctx.fillRect(x - 1, y + d.k * ch + ch * 0.6, 3, 2);
        if (d.side === 'R') ctx.fillRect(x + w - 2, y + d.k * ch + ch * 0.6, 3, 2);
        if (d.side === 'U') ctx.fillRect(x + d.k * cw + cw / 2 - 1, y - 1, 2, 3);
        if (d.side === 'D') ctx.fillRect(x + d.k * cw + cw / 2 - 1, y + h - 2, 2, 3);
      });
    });
    // метки
    W.rooms.forEach(function (rm) {
      if (!vis[rm.i]) return;
      var cx = ox + (rm.gx + rm.w / 2) * cw, cy = oy + (rm.gy + rm.h / 2) * ch;
      rm.objs.forEach(function (o) {
        var mx = ox + rm.gx * cw + o.x / 40 * cw, my = oy + rm.gy * ch + (o.y - 2) / 22 * ch;
        if (o.type === 'anvil') { ctx.fillStyle = retro ? '#ffff55' : '#ffd27a'; ctx.beginPath(); ctx.moveTo(mx, my - 3); ctx.lineTo(mx + 3, my + 2); ctx.lineTo(mx - 3, my + 2); ctx.fill(); }
        if (o.type === 'lift') { ctx.fillStyle = S.prog.lifts[o.id] ? (retro ? '#55ff55' : '#7bd389') : (retro ? '#aaaaaa' : '#8a8a8a'); ctx.beginPath(); ctx.moveTo(mx, my - 3); ctx.lineTo(mx + 3, my); ctx.lineTo(mx, my + 3); ctx.lineTo(mx - 3, my); ctx.fill(); }
        if (o.type === 'boss') { var dn = S.prog.bosses[o.boss]; ctx.fillStyle = dn ? (retro ? '#aaaaaa' : '#9a9a9a') : (retro ? '#ff5555' : '#ff5a3a'); ctx.fillRect(mx - 3, my - 3, 6, 5); ctx.fillStyle = retro ? '#000' : '#1a0a0a'; ctx.fillRect(mx - 2, my - 2, 1, 1); ctx.fillRect(mx + 1, my - 2, 1, 1); }
        if (o.type === 'forge') { ctx.fillStyle = S.prog.forges[o.fid] ? (retro ? '#ffff55' : '#ffb040') : (retro ? '#555555' : '#6a5a5a'); ctx.beginPath(); for (var k = 0; k < 8; k++) { var a = k * Math.PI / 4, r = k % 2 ? 1.5 : 4; ctx.lineTo(mx + Math.cos(a) * r, my + Math.sin(a) * r); } ctx.fill(); }
        if (o.type === 'heart') { ctx.fillStyle = retro ? '#ff5555' : '#ff6a5a'; ctx.beginPath(); ctx.arc(mx, my, 3, 0, 7); ctx.fill(); }
      });
      rm.items.forEach(function (it) {
        if (S.prog.items[it.id] || (it.boss && !S.prog.bosses[it.boss])) return;
        var mx = ox + rm.gx * cw + it.x / 40 * cw, my = oy + rm.gy * ch + (it.y - 1) / 22 * ch;
        ctx.fillStyle = retro ? '#ffffff' : '#fff4c0'; ctx.fillRect(mx - 1, my - 1, 3, 3);
      });
      if (sel != null && rm.objs.some(function (o) { return o.type === 'lift' && o.id === sel; })) { ctx.strokeStyle = retro ? '#55ff55' : '#7bd389'; ctx.lineWidth = 2; ctx.strokeRect(ox + rm.gx * cw - 1, oy + rm.gy * ch - 1, rm.w * cw + 2, rm.h * ch + 2); }
    });
    // где героиня
    var cur = W.rooms[S.room];
    if (Math.floor(t * 3) % 2 === 0 || !full) { ctx.strokeStyle = retro ? '#ffffff' : '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(ox + cur.gx * cw + 0.5, oy + cur.gy * ch + 0.5, cur.w * cw - 1, cur.h * ch - 1); }
    var hx = ox + cur.gx * cw + S.hero.x / 40 * cw, hy = oy + cur.gy * ch + (S.hero.y - 1) / 22 * ch;
    ctx.fillStyle = retro ? '#ffff55' : '#ffd27a'; ctx.beginPath(); ctx.arc(hx, hy, full ? 2.5 : 2, 0, 7); ctx.fill();
  }
  // карта всего мира (пауза)
  function worldMap(g, ctx, S, top, sel) {
    var retro = g.themeName === 'retro', th = g.th(), W = S.W;
    var cw = 16, ch = 10, mw = W.GW * cw, mh = W.GH * ch, ox = Math.round((g.W - mw) / 2), oy = top;
    panel(g, ctx, ox - 10, oy - 26, mw + 20, mh + 52, retro, 0.86);
    g.text(sel != null ? g.t('liftTitle') : g.t('map'), g.W / 2, oy - 9, { size: 13, align: 'center', color: th.accent, weight: 900 });
    if (!retro) { ctx.fillStyle = 'rgba(255,255,255,0.025)'; for (var x = 0; x <= W.GW; x++) ctx.fillRect(ox + x * cw, oy, 1, mh); for (var y = 0; y <= W.GH; y++) ctx.fillRect(ox, oy + y * ch, mw, 1); }
    drawRooms(g, ctx, S, ox, oy, cw, ch, retro, g.time, true, sel);
    var nv = 0; for (var i = 0; i < S.prog.visited.length; i++) if (S.prog.visited[i]) nv++;
    var fl = 0; for (var f in S.prog.forges) if (S.prog.forges[f]) fl++;
    g.text(g.t('pct') + ' ' + P.pctOf(S) + '% · ' + g.t('rooms') + ' ' + nv + '/' + W.rooms.length + ' · ' + g.t('forges') + ' ' + fl + '/5 · ' + g.t('time') + ' ' + clock(S.time), g.W / 2, oy + mh + 12, { size: 11, align: 'center', color: th.ink, weight: 700 });
    g.text(g.t('mapLegend'), g.W / 2, oy + mh + 24, { size: 10, align: 'center', color: th.muted, weight: 600 });
    return oy + mh + 26;
  }
  function liftMenu(g, ctx, S, game) {
    var retro = g.themeName === 'retro', th = g.th(), L = game.liftList(), sel = L[S.liftSel];
    ctx.fillStyle = retro ? 'rgba(0,0,0,0.8)' : 'rgba(6,4,2,0.7)'; ctx.fillRect(0, 0, g.W, g.H);
    var bottom = worldMap(g, ctx, S, 40, sel);
    var l = S.W.lifts[sel];
    if (l) g.text('◆ ' + g.t('z' + l.zone) + '  (' + (S.liftSel + 1) + '/' + L.length + ')', g.W / 2, bottom + 20, { size: 14, align: 'center', color: th.accent, weight: 800 });
    g.text(g.t('liftHint'), g.W / 2, bottom + 38, { size: 11, align: 'center', color: th.muted, weight: 600 });
  }

  // ---------- баннеры ----------
  function banners(g, ctx, list, dt) {
    var retro = g.themeName === 'retro', th = g.th();
    for (var i = 0; i < list.length; i++) {
      var b = list[i]; b.a -= dt;
      if (b.a <= 0) { list.splice(i, 1); i--; continue; }
      var al = Math.min(1, b.a / 0.4, (b.life - b.a) / 0.25 + 0.2);
      ctx.save(); ctx.globalAlpha = Math.max(0, al);
      if (b.big) {
        g.text(b.title, g.W / 2, 128, { size: retro ? 24 : 28, align: 'center', color: th.accent, weight: 900 });
        if (b.sub) g.text(b.sub, g.W / 2, 150, { size: 12, align: 'center', color: th.ink, weight: 700 });
      } else {
        var w = Math.max(240, Math.min(560, b.title.length * 9 + 40, (b.sub || '').length * 6.6 + 40)), y = 96 + i * 0;
        panel(g, ctx, (g.W - w) / 2, y - 20, w, b.sub ? 44 : 28, retro);
        if (b.icon) { if (b.icon.indexOf('ab:') === 0) R().abilityIcon(ctx, b.icon.slice(3), (g.W - w) / 2 + 20, y - 5 + (b.sub ? 6 : 0), retro, 1.2); else R().itemIcon(ctx, b.icon, (g.W - w) / 2 + 20, y - 5 + (b.sub ? 6 : 0), retro, g.time, false); }
        g.text(b.title, g.W / 2, y - 1, { size: 14, align: 'center', color: th.accent, weight: 900 });
        if (b.sub) g.text(b.sub, g.W / 2, y + 16, { size: 11, align: 'center', color: th.ink, weight: 600 });
      }
      ctx.restore();
      break;   // показываем по одному
    }
  }

  // ---------- титульная картина ----------
  function titleArt(g, ctx, t) {
    var retro = g.themeName === 'retro', W = g.W, H = g.H;
    if (retro) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    else { var gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1a0f0a'); gr.addColorStop(0.6, '#2a1a10'); gr.addColorStop(1, '#0a0604'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
    // гора и мастерская на вершине
    ctx.fillStyle = retro ? '#555555' : '#3a2a20';
    ctx.beginPath(); ctx.moveTo(0, H * 0.55); ctx.lineTo(W * 0.22, H * 0.32); ctx.lineTo(W * 0.36, H * 0.4); ctx.lineTo(W * 0.5, H * 0.16); ctx.lineTo(W * 0.66, H * 0.38); ctx.lineTo(W * 0.8, H * 0.3); ctx.lineTo(W, H * 0.5); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    ctx.fillStyle = retro ? '#aa5500' : '#5a4030'; ctx.fillRect(W * 0.5 - 18, H * 0.16 - 16, 36, 18); ctx.beginPath(); ctx.moveTo(W * 0.5 - 22, H * 0.16 - 16); ctx.lineTo(W * 0.5, H * 0.16 - 30); ctx.lineTo(W * 0.5 + 22, H * 0.16 - 16); ctx.fill();
    ctx.fillStyle = retro ? '#ffff55' : '#ffd27a'; ctx.fillRect(W * 0.5 - 5, H * 0.16 - 10, 10, 6);
    // подземные ярусы: окна-огни древнего города
    for (var i = 0; i < 40; i++) {
      var x = (i * 137) % W, y = H * 0.55 + ((i * 71) % (H * 0.42)), on = (Math.sin(t * 1.5 + i) + 1) / 2 > 0.4;
      ctx.fillStyle = retro ? (on ? '#ffff55' : '#aa5500') : 'rgba(255,' + (140 + i % 60) + ',60,' + (on ? 0.8 : 0.25) + ')'; ctx.fillRect(x, y, 4, 6);
    }
    if (!retro) { var gl = ctx.createRadialGradient(W * 0.5, H * 0.7, 10, W * 0.5, H * 0.7, 260); gl.addColorStop(0, 'rgba(255,120,40,0.25)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H); }
  }

  // ---------- слоты ----------
  function slotsScreen(g, ctx, slots, sel, confirm, t) {
    var retro = g.themeName === 'retro', th = g.th();
    titleArt(g, ctx, t); ctx.fillStyle = retro ? 'rgba(0,0,0,0.6)' : 'rgba(8,5,3,0.55)'; ctx.fillRect(0, 0, g.W, g.H);
    g.text(g.t('slots'), g.W / 2, 50, { size: 22, align: 'center', color: th.accent, weight: 900 });
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i], y = 80 + i * 76, on = i === sel;
      panel(g, ctx, 110, y, 420, 64, retro, on ? 0.9 : 0.6);
      if (on) { ctx.strokeStyle = retro ? '#ffff55' : '#e8903a'; ctx.lineWidth = 2; ctx.strokeRect(111, y + 1, 418, 62); }
      g.text(g.t('slot') + ' ' + (i + 1), 128, y + 24, { size: 15, color: on ? th.accent : th.ink, weight: 900 });
      if (s) {
        g.text(g.t('z' + (s.zone >= 0 ? s.zone : 0)), 210, y + 24, { size: 13, color: th.ink, weight: 700 });
        g.text(g.t('pct') + ' ' + (s.pct || 0) + '% · ' + g.t('time') + ' ' + clock(s.time) + ' · ' + g.t('deaths') + ' ' + (s.deaths || 0), 210, y + 44, { size: 11, color: th.muted, weight: 600 });
        ABIL.forEach(function (a, k) { if ((s.ab || []).indexOf(a) >= 0) R().abilityIcon(ctx, a, 400 + k * 15, y + 40, retro, 0.8); });
      } else g.text(g.t('empty'), 210, y + 36, { size: 13, color: th.muted, weight: 600 });
    }
    g.text(confirm ? g.t('delq') : g.t('pick') + ' · ' + g.t('del'), g.W / 2, g.H - 22, { size: 11, align: 'center', color: confirm ? th.warn : th.muted, weight: 700 });
  }

  P.UI = { hud: hud, worldMap: worldMap, liftMenu: liftMenu, banners: banners, titleArt: titleArt, slotsScreen: slotsScreen, panel: panel, clock: clock, minimap: minimap };
})(typeof window !== 'undefined' ? window : globalThis);
