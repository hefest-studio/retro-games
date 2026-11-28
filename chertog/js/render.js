/* ЧЕРТОГ · рендер обеих тем (modern — бумажный театр теней, retro — 4 цвета без градиентов). Канва 512×288: полоса HUD 32 px + поле 16×8 клеток по 32 px.
   CHERTOG.render(g, ctx, V): V = { P, s, hv, gv, lampV, litA, t, retro, hint, ui, hud } — собирает main.js. */
(function (global) {
  'use strict';
  var C = global.CHERTOG = global.CHERTOG || {};
  var CS = 32, OY = 32, W = 16, H = 8, CW = 512, CH = 288;
  var LAMP = ['#ffc94a', '#5fe0f0', '#ff8ac0'];
  var PAL = {
    modern: { shade: '#1c1233', shade2: '#150d28', lit: '#f6d9a0', litA: 0.5, wall: '#0b0716', wallTop: '#4a3a78', slab: '#e8664a', slabEdge: '#ffb08a', ghost: 'rgba(255,230,190,.5)', occ: '#e8b44a', occEdge: '#7a5416', thread: 'rgba(255,230,190,.45)',
      hero: '#2b3a7a', heroEdge: '#0b1030', hood: '#ff7d5a', scarf: '#37d6c4', guard: '#7a1e34', guardEdge: '#2a0814', eye: '#ffe27a', door: '#fff0b8', doorIn: '#221a40', hud: '#0e0820', ink: '#f6ecd8', mut: '#a698c8', bad: '#ff6a6a', good: '#8cf0c0' },
    retro: { shade: '#000020', shade2: '#000020', lit: '#505090', litA: 1, wall: '#000000', wallTop: '#f8f8f8', slab: '#f87858', slabEdge: '#f8f8f8', ghost: '#3838a0', occ: '#f8d838', occEdge: '#a07800', thread: '#707070', hero: '#58a8f8', heroEdge: '#000000', hood: '#f87858', scarf: '#58f8c8', guard: '#c82838', guardEdge: '#000000', eye: '#f8f858', door: '#f8f858', doorIn: '#000000', hud: '#000000', ink: '#ffffff', mut: '#a8a8a8', bad: '#f85858', good: '#58f8a8' }
  };
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function px(x) { return x * CS; } function py(y) { return OY + y * CS; }

  function lamp(ctx, x, y, k, retro, t) {
    var cx = px(x) + CS / 2, cy = py(y) + CS / 2, col = LAMP[k] || LAMP[0];
    if (!retro) { var gr = ctx.createRadialGradient(cx, cy, 2, cx, cy, 70); gr.addColorStop(0, col + 'aa'); gr.addColorStop(1, col + '00'); ctx.fillStyle = gr; ctx.fillRect(cx - 70, cy - 70, 140, 140); }
    ctx.strokeStyle = retro ? '#a8a8a8' : 'rgba(255,230,190,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, OY); ctx.lineTo(cx, cy - 8); ctx.stroke();
    ctx.fillStyle = '#2a2236'; rr(ctx, cx - 6, cy - 9, 12, 5, 2); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy + 1, 7 + (retro ? 0 : Math.sin(t * 5 + k) * 0.6), 0, 6.3); ctx.fill();
    ctx.strokeStyle = '#2a2236'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  function hero(ctx, x, y, f, a, t, retro, P) {
    ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
    var bob = a.moving ? Math.sin(t * 18) * 1.2 : Math.sin(t * 3) * 0.6, lean = a.moving ? 0.12 : 0;
    ctx.rotate(lean * (a.dead ? 0 : 1));
    if (a.dead) { ctx.rotate(-1.4); ctx.translate(-8, 4); }
    ctx.lineWidth = 1.5; ctx.strokeStyle = P.heroEdge;
    ctx.fillStyle = P.scarf; ctx.beginPath(); ctx.moveTo(-3, -14 + bob); ctx.lineTo(-12 - (a.moving ? 3 : 0), -10 + bob + Math.sin(t * 9) * 2); ctx.lineTo(-3, -9 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.hero; rr(ctx, -6, -15 + bob, 12, 15 - bob * 0.5, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.hood; ctx.beginPath(); ctx.arc(0, -19 + bob, 6.2, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, -23 + bob); ctx.lineTo(1, -31 + bob); ctx.lineTo(5, -22 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(1.5, -20 + bob, 3, 3); ctx.fillStyle = '#000'; ctx.fillRect(3, -19.5 + bob, 1.5, 2);
    ctx.fillStyle = P.scarf; rr(ctx, -3, -1, 3, 4, 1); ctx.fill(); rr(ctx, 1, -1, 3, 4, 1); ctx.fill();
    ctx.restore();
  }
  function guard(ctx, x, y, d, dz, t, retro, P) {
    ctx.save(); ctx.translate(x, y); ctx.scale(d, 1);
    var sw = dz ? 0 : Math.sin(t * 6) * 1.5;
    ctx.lineWidth = 1.5; ctx.strokeStyle = P.guardEdge; ctx.fillStyle = P.guard;
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-4, -34 + sw * 0.3); ctx.lineTo(4, -34 + sw * 0.3); ctx.lineTo(8, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#16101e'; ctx.beginPath(); ctx.arc(0, -41, 7, 0, 6.3); ctx.fill(); ctx.stroke();
    if (dz) { ctx.strokeStyle = P.eye; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(1, -41); ctx.lineTo(6, -41); ctx.stroke(); }
    else { ctx.fillStyle = P.eye; ctx.beginPath(); ctx.arc(3.5, -41, 2.6, 0, 6.3); ctx.fill(); }
    ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(10, -40); ctx.stroke();
    ctx.restore();
    if (dz) { ctx.fillStyle = P.ink; ctx.font = '700 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('z', x + 10, y - 50 + Math.sin(t * 3) * 2); ctx.fillText('Z', x + 16, y - 56 + Math.sin(t * 3 + 1) * 2); }
  }
  function drawHud(g, ctx, V, P) {
    var retro = V.retro;
    ctx.fillStyle = P.hud; ctx.fillRect(0, 0, CW, OY);
    ctx.fillStyle = retro ? '#a07800' : '#3a2a5a'; ctx.fillRect(0, OY - 2, CW, 2);
    ctx.textBaseline = 'middle'; ctx.fillStyle = P.ink; ctx.textAlign = 'left'; ctx.font = '800 13px ' + (retro ? '"Courier New",monospace' : 'Inter,system-ui,sans-serif');
    ctx.fillText(g.t('level') + ' ' + (V.fi + 1) + '/' + V.total + ' · ' + g.t('f_' + V.id), 46, 16, 230);
    ctx.textAlign = 'right'; ctx.fillStyle = V.moves > V.par ? P.mut : P.good;
    ctx.fillText(g.t('moves') + ' ' + V.moves + ' / ' + V.par, CW - 10, 16, 150);
    ctx.fillStyle = P.mut; ctx.textAlign = 'center'; ctx.fillText(g.t('score') + ' ' + V.score, 345, 16, 90);
    ctx.textBaseline = 'alphabetic';
  }
  C.render = function (g, ctx, V) {
    var retro = V.retro, P = PAL[retro ? 'retro' : 'modern'], s = V.s, Pm = V.P, t = V.t, i, x, y;
    ctx.imageSmoothingEnabled = !retro;
    ctx.save();
    if (V.ui && V.ui.shake > 0) ctx.translate((Math.random() - 0.5) * 6 * V.ui.shake, (Math.random() - 0.5) * 6 * V.ui.shake);
    // фон-тень
    if (retro) { ctx.fillStyle = P.shade; ctx.fillRect(0, OY, CW, CH - OY); }
    else { var bg = ctx.createLinearGradient(0, OY, 0, CH); bg.addColorStop(0, P.shade); bg.addColorStop(1, P.shade2); ctx.fillStyle = bg; ctx.fillRect(0, OY, CW, CH - OY); }
    // свет по клеткам (плавно)
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) { var a = V.litA[y * W + x]; if (a > 0.02) { ctx.globalAlpha = retro ? (a > 0.5 ? 1 : 0) : a * P.litA; ctx.fillStyle = P.lit; ctx.fillRect(px(x), py(y), CS, CS); } }
    ctx.globalAlpha = 1;
    if (!retro) { ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1; ctx.beginPath(); for (x = 1; x < W; x++) { ctx.moveTo(px(x) + 0.5, OY); ctx.lineTo(px(x) + 0.5, CH); } for (y = 1; y < H; y++) { ctx.moveTo(0, py(y) + 0.5); ctx.lineTo(CW, py(y) + 0.5); } ctx.stroke(); }
    // декорации-силуэты (бумага на нитях)
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var v = Pm.t[y * W + x];
      if (v === 3) {
        if (y === 0 || Pm.t[(y - 1) * W + x] !== 3) { ctx.strokeStyle = P.thread; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px(x) + CS / 2, OY); ctx.lineTo(px(x) + CS / 2, py(y) + 4); ctx.stroke(); }
        ctx.fillStyle = P.occ; ctx.strokeStyle = P.occEdge; ctx.lineWidth = 1.5; rr(ctx, px(x) + 1.5, py(y) + 3 + Math.sin(t * 1.5 + x) * 0.8, CS - 3, CS - 6, retro ? 0 : 6); ctx.fill(); ctx.stroke();
        if (!retro) { ctx.fillStyle = 'rgba(122,84,22,.35)'; ctx.beginPath(); ctx.arc(px(x) + CS / 2, py(y) + CS / 2, 4, 0, 6.3); ctx.fill(); }
      }
    }
    // кладка и плиты
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      v = Pm.t[y * W + x];
      if (v === 1) {
        ctx.fillStyle = P.wall; ctx.fillRect(px(x), py(y), CS, CS);
        if (y === 0 || Pm.t[(y - 1) * W + x] !== 1) { ctx.fillStyle = P.wallTop; ctx.fillRect(px(x), py(y), CS, 3); }
      } else if (v === 2) {
        var solid = V.litA[y * W + x] < 0.5;
        if (solid) { ctx.fillStyle = P.slab; ctx.fillRect(px(x) + 1, py(y), CS - 2, 12); ctx.fillStyle = P.slabEdge; ctx.fillRect(px(x) + 1, py(y), CS - 2, 3); ctx.strokeStyle = P.heroEdge; ctx.lineWidth = 1; ctx.strokeRect(px(x) + 1.5, py(y) + 0.5, CS - 3, 11); }
        else { ctx.strokeStyle = P.ghost; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.strokeRect(px(x) + 2, py(y) + 1, CS - 4, 10); ctx.setLineDash([]); }
      }
    }
    // выход
    if (Pm.exit) { var ex = px(Pm.exit[0]) + CS / 2, ey = py(Pm.exit[1]) + CS;
      if (!retro) { var dg = ctx.createRadialGradient(ex, ey - 14, 2, ex, ey - 14, 34); dg.addColorStop(0, 'rgba(255,240,184,.55)'); dg.addColorStop(1, 'rgba(255,240,184,0)'); ctx.fillStyle = dg; ctx.fillRect(ex - 36, ey - 50, 72, 72); }
      ctx.fillStyle = P.door; rr(ctx, ex - 11, ey - 28, 22, 28, 11); ctx.fill(); ctx.fillStyle = P.doorIn; rr(ctx, ex - 8, ey - 25, 16, 25, 8); ctx.fill();
      ctx.fillStyle = P.door; var sp = 3 + Math.sin(t * 4) * 0.8; ctx.beginPath(); for (i = 0; i < 8; i++) { var r = i % 2 ? sp * 0.45 : sp, an = i * Math.PI / 4; ctx.lineTo(ex + Math.cos(an) * r, ey - 14 + Math.sin(an) * r); } ctx.closePath(); ctx.fill(); }
    // рычаги
    for (var key in Pm.lev) { var kk = Pm.lev[key], lx = key % W, ly = Math.floor(key / W), cur = V.s.lamps[kk], n = Pm.lamps[kk].length, ang = (cur / Math.max(1, n - 1) - 0.5) * 1.2;
      ctx.fillStyle = '#2a2236'; rr(ctx, px(lx) + 8, py(ly) + CS - 6, 16, 6, 2); ctx.fill();
      ctx.save(); ctx.translate(px(lx) + 16, py(ly) + CS - 6); ctx.rotate(ang); ctx.strokeStyle = '#d8c8a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -14); ctx.stroke(); ctx.fillStyle = LAMP[kk]; ctx.beginPath(); ctx.arc(0, -15, 4, 0, 6.3); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); }
    // лампы
    for (i = 0; i < V.lampV.length; i++) lamp(ctx, V.lampV[i].x, V.lampV[i].y, i, retro, t);
    // стражи
    for (i = 0; i < V.gv.length; i++) { var G = V.gv[i]; if (G.alive) guard(ctx, px(G.x) + CS / 2, py(G.y) + CS, G.d, G.dz, t, retro, P); }
    // герой
    hero(ctx, px(V.hv.x) + CS / 2, py(V.hv.y) + CS - 1 - (V.hv.arc || 0) * CS, V.s.hf, { moving: V.hv.moving, dead: !!V.s.dead }, t, retro, P);
    // подсказка ходов
    if (V.hint && V.hint.length) { var G2 = { L: '←', R: '→', UL: '↖', UR: '↗', U: '↑', A: '●' }, txt = V.hint.slice(0, 8).map(function (a) { return G2[a]; }).join(' ');
      ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(CW / 2 - 110, OY + 4, 220, 22); ctx.fillStyle = P.eye; ctx.font = '800 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(txt, CW / 2, OY + 20); }
    ctx.restore();
    drawHud(g, ctx, V, P);
    var u = V.ui || {};
    if (u.msg) { ctx.globalAlpha = Math.min(1, u.msg.a * 2); ctx.fillStyle = 'rgba(8,4,20,.82)'; ctx.fillRect(10, CH - 50, CW - 20, 42); ctx.globalAlpha = Math.min(1, u.msg.a * 2); ctx.fillStyle = u.msg.color || P.ink; ctx.font = '700 12px sans-serif'; ctx.textAlign = 'center';
      wrap(ctx, u.msg.text, CW / 2, CH - 30, CW - 40, 15); ctx.globalAlpha = 1; }
    if (u.banner) { ctx.globalAlpha = Math.min(1, u.banner.a); ctx.fillStyle = P.ink; ctx.font = '900 26px ' + (retro ? '"Courier New",monospace' : 'Inter,system-ui,sans-serif'); ctx.textAlign = 'center'; ctx.fillText(u.banner.title, CW / 2, CH / 2 + 4, CW - 40); ctx.globalAlpha = 1; }
    if (V.s.dead && V.deadT > 0.35) { ctx.fillStyle = 'rgba(8,4,20,.55)'; ctx.fillRect(0, CH / 2 - 34, CW, 68); ctx.fillStyle = P.bad; ctx.font = '900 20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(g.t('d_' + V.s.dead), CW / 2, CH / 2 - 6, CW - 30);
      ctx.fillStyle = P.mut; ctx.font = '600 12px sans-serif'; ctx.fillText(g.t('undo') + ' — Z / ↶', CW / 2, CH / 2 + 18, CW - 30); }
  };
  function wrap(ctx, text, cx, y, maxW, lh) {
    var words = String(text).split(' '), line = '', lines = [];
    words.forEach(function (w) { var tst = line ? line + ' ' + w : w; if (ctx.measureText(tst).width > maxW && line) { lines.push(line); line = w; } else line = tst; });
    lines.push(line); var y0 = y - (lines.length - 1) * lh / 2 + (lines.length > 1 ? 0 : 0);
    lines.forEach(function (l, i) { ctx.fillText(l, cx, y0 + i * lh + 4); });
  }
  C.R = { W: CW, H: CH, CS: CS, OY: OY, PAL: PAL, hero: hero, guard: guard, lamp: lamp, LAMP: LAMP };
})(typeof window !== 'undefined' ? window : globalThis);
