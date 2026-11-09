/* КОЛОБОК · рендер 8-БИТ (classic). K.classic.draw(ctx, st)
   Внутренний буфер половинного разрешения, апскейл без сглаживания — честный пиксель.
   Экран не скроллится: рисуем поляну целиком (960x600 → буфер 480x300). */
(function (global) {
  'use strict';
  var K = global.KOLOBOK = global.KOLOBOK || {};

  var TILE = 40;
  var SCALE = 0.5;                 // мир → буфер (клетка 40 → 20 px)
  var buf = null, bx = null;

  // Ограниченная 8-битная палитра (лесная сказка).
  var PAL = {
    sky: '#8ad0f0', sky2: '#bfe7f5', hill: '#6fae55', hill2: '#5a9346',
    ground: '#8a5a32', groundD: '#5f3d20', groundE: '#a9743f', grass: '#5fb04a',
    plat: '#a9743f', platE: '#caa06a', platD: '#6b4524',
    gate: '#7a5230', gateD: '#4e3420', gateBar: '#caa06a',
    water: '#2f7de0', waterE: '#79b4ff', fire: '#ff7a2d', fireY: '#ffd23e', fireD: '#c8431a',
    body: '#f4c84a', bodyD: '#d79b2a', bodyE: '#ffe79a', face: '#3a2410',
    cheek: '#f09a6a',
    fox: '#e86a2a', foxD: '#a8441a', foxW: '#ffe2c0',
    berry: '#e23c6a', berryE: '#ff9bb6', leaf: '#3fa64a',
    key: '#ffd23e', keyE: '#fff4bf', plank: '#b07a40', plankE: '#d8a764', bucket: '#9fd4ff', bucketE: '#e8f6ff',
    home: '#b5633a', homeD: '#7a3f22', homeRoof: '#c8863f', homeWin: '#ffd23e'
  };

  function ensureBuf(w, h) {
    if (!buf) { buf = document.createElement('canvas'); bx = buf.getContext('2d'); }
    if (buf.width !== w || buf.height !== h) { buf.width = w; buf.height = h; }
  }
  function px(n) { return Math.round(n); }

  function ground(g, x, y, s) {
    g.fillStyle = PAL.groundD; g.fillRect(x, y, s, s);
    g.fillStyle = PAL.ground; g.fillRect(x, y, s, s - 2);
    g.fillStyle = PAL.grass; g.fillRect(x, y, s, 2);
    g.fillStyle = PAL.groundE; g.fillRect(x, y + 3, 1, 1); g.fillRect(x + px(s * 0.6), y + 5, 1, 1);
  }
  function platform(g, x, y, s) {
    g.fillStyle = PAL.platD; g.fillRect(x, y, s, s);
    g.fillStyle = PAL.plat; g.fillRect(x, y, s, px(s * 0.55));
    g.fillStyle = PAL.platE; g.fillRect(x, y, s, 2);
  }
  function gate(g, x, y, s) {
    g.fillStyle = PAL.gateD; g.fillRect(x, y, s, s);
    g.fillStyle = PAL.gate; g.fillRect(x + 1, y, s - 2, s);
    g.fillStyle = PAL.gateBar; g.fillRect(x + 1, y + px(s * 0.3), s - 2, 1); g.fillRect(x + 1, y + px(s * 0.7), s - 2, 1);
  }
  function water(g, x, y, s, t) {
    g.fillStyle = PAL.water; g.fillRect(x, y, s, s);
    g.fillStyle = PAL.waterE;
    var off = Math.floor(t * 6) % s;
    g.fillRect(x + ((off) % s), y + 1, 2, 1); g.fillRect(x + ((off + 7) % s), y + 3, 2, 1);
  }
  function fire(g, x, y, s, t) {
    var f = Math.floor(t * 10) % 2;
    g.fillStyle = PAL.fireD; g.fillRect(x + 2, y + 2, s - 4, s - 2);
    g.fillStyle = PAL.fire; g.fillRect(x + 3, y + 3 + f, s - 6, s - 4);
    g.fillStyle = PAL.fireY; g.fillRect(x + px(s / 2) - 1, y + 4 + f, 2, s - 7);
  }

  function berry(g, x, y) { g.fillStyle = PAL.leaf; g.fillRect(x - 1, y - 5, 2, 2); g.fillStyle = PAL.berry; g.fillRect(x - 3, y - 3, 6, 6); g.fillStyle = PAL.berryE; g.fillRect(x - 2, y - 2, 2, 2); }
  function keyIcon(g, x, y) { g.fillStyle = PAL.key; g.fillRect(x - 3, y - 3, 4, 4); g.fillRect(x + 1, y - 1, 4, 2); g.fillRect(x + 4, y, 1, 3); g.fillStyle = PAL.keyE; g.fillRect(x - 2, y - 2, 1, 1); }
  function plankIcon(g, x, y) { g.fillStyle = PAL.plank; g.fillRect(x - 5, y - 2, 10, 4); g.fillStyle = PAL.plankE; g.fillRect(x - 5, y - 2, 10, 1); }
  function bucketIcon(g, x, y) { g.fillStyle = PAL.bucketE; g.fillRect(x - 3, y - 3, 6, 1); g.fillStyle = PAL.bucket; g.fillRect(x - 3, y - 2, 6, 6); g.fillStyle = PAL.bucketE; g.fillRect(x - 2, y, 1, 3); }

  function drawHome(g, d) {
    var x = px(d.x * SCALE), y = px(d.y * SCALE), w = px(d.w * SCALE), h = px(d.h * SCALE);
    g.fillStyle = PAL.homeD; g.fillRect(x, y, w, h);
    g.fillStyle = PAL.home; g.fillRect(x + 1, y + px(h * 0.3), w - 2, h);
    g.fillStyle = PAL.homeRoof; for (var i = 0; i < w / 2; i++) g.fillRect(x + i, y + px(h * 0.3) - i / 1.6, w - i * 2, 1);
    g.fillStyle = PAL.homeWin; g.fillRect(x + px(w / 2) - 2, y + px(h * 0.55), 4, 4);
  }

  function drawFox(g, e) {
    var x = px(e.x * SCALE), y = px(e.y * SCALE), w = px(e.w * SCALE), h = px(e.h * SCALE);
    g.fillStyle = PAL.foxD; g.fillRect(x, y, w, h);
    g.fillStyle = PAL.fox; g.fillRect(x, y + 1, w, h - 2);
    g.fillStyle = PAL.foxW; g.fillRect(e.dir > 0 ? x + w - 3 : x, y + px(h / 2), 3, 2); // морда
    g.fillStyle = PAL.foxD; g.fillRect(e.dir > 0 ? x + w - 4 : x + 2, y - 1, 2, 2); // ушко
    g.fillStyle = '#2a1608'; g.fillRect(e.dir > 0 ? x + w - 5 : x + 3, y + 2, 1, 1); // глаз
  }

  function drawPlayer(g, p) {
    if (p.invuln > 0 && (Math.floor(p.invuln * 12) % 2 === 0)) return;
    var cx = px((p.x + p.w / 2) * SCALE), cy = px((p.y + p.h / 2) * SCALE), r = px((p.w / 2) * SCALE);
    // тело — круглый колобок
    g.fillStyle = PAL.bodyD; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = PAL.body; g.beginPath(); g.arc(cx, cy - 1, r - 1, 0, Math.PI * 2); g.fill();
    g.fillStyle = PAL.bodyE; g.fillRect(cx - r + 2, cy - r + 2, 2, 2); // блик
    // «крошки» вращения
    var a = p.roll;
    g.fillStyle = PAL.bodyD;
    g.fillRect(cx + px(Math.cos(a) * (r - 2)) - 1, cy + px(Math.sin(a) * (r - 2)) - 1, 2, 2);
    g.fillRect(cx + px(Math.cos(a + 2.1) * (r - 3)) - 1, cy + px(Math.sin(a + 2.1) * (r - 3)) - 1, 1, 1);
    // лицо (смотрит по направлению)
    var ex = p.dir > 0 ? 1 : -1;
    g.fillStyle = PAL.face;
    g.fillRect(cx + ex * 1 - 2, cy - 3, 2, 2);
    g.fillRect(cx + ex * 1 + 2, cy - 3, 2, 2);
    g.fillRect(cx - 2, cy + 2, 5, 1);               // улыбка
    g.fillStyle = PAL.cheek; g.fillRect(cx - 4, cy + 1, 2, 1); g.fillRect(cx + 3, cy + 1, 2, 1);
  }

  function hudText(ctx, s, x, y, col, size, align) {
    ctx.fillStyle = col; ctx.font = '700 ' + size + 'px "DejaVu Sans Mono","Courier New",monospace';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y);
  }

  function drawHUD(ctx, st) {
    var t = K.t;
    ctx.fillStyle = 'rgba(20,40,20,.74)'; ctx.fillRect(0, 0, st.viewW, 34);
    ctx.fillStyle = '#2f5a2f'; ctx.fillRect(0, 34, st.viewW, 2);
    hudText(ctx, t('berries') + ' ' + st.berries + '/' + st.totalBerries, 12, 23, '#ff8aa6', 15);
    hudText(ctx, t('score') + ' ' + st.score, 200, 23, '#ffe79a', 13);
    // сумка
    hudText(ctx, t('bag'), st.viewW / 2 - 70, 23, '#bfe7f5', 12);
    for (var i = 0; i < st.bag.length; i++) {
      var bx0 = st.viewW / 2 - 22 + i * 26, by0 = 17;
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(bx0 - 2, by0 - 11, 22, 22);
      if (st.bag[i] === 'key') { ctx.fillStyle = PAL.key; ctx.fillRect(bx0, by0 - 6, 6, 6); ctx.fillRect(bx0 + 6, by0 - 3, 7, 3); }
      else if (st.bag[i] === 'plank') { ctx.fillStyle = PAL.plank; ctx.fillRect(bx0 - 1, by0 - 3, 18, 6); }
      else { ctx.fillStyle = PAL.bucket; ctx.fillRect(bx0 + 2, by0 - 6, 10, 12); ctx.fillStyle = PAL.bucketE; ctx.fillRect(bx0 + 1, by0 - 7, 12, 2); }
    }
    // жизни — колобки
    for (var j = 0; j < st.lives; j++) {
      var lx = st.viewW - 130 + j * 18;
      ctx.fillStyle = PAL.bodyD; ctx.beginPath(); ctx.arc(lx + 6, 17, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PAL.body; ctx.beginPath(); ctx.arc(lx + 6, 16, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawBanner(ctx, st) {
    var t = K.t, msg = null, sub = null;
    if (st.phase === 'play' && st.intro > 0) { msg = t('ready') + ' ' + (st.roomId + 1); sub = t('go'); }
    if (st.flashT > 0 && st.flash === 'needberries') { msg = t('needberries'); }
    if (!msg) return;
    ctx.fillStyle = 'rgba(10,20,10,.55)'; ctx.fillRect(0, st.viewH / 2 - 44, st.viewW, 88);
    hudText(ctx, msg, st.viewW / 2, st.viewH / 2, '#ffe79a', 34, 'center');
    if (sub) hudText(ctx, sub, st.viewW / 2, st.viewH / 2 + 30, '#bfe7f5', 20, 'center');
  }

  K.classic = {
    draw: function (ctx, st) {
      var W = st.viewW, H = st.viewH;
      ensureBuf(Math.round(W * SCALE), Math.round(H * SCALE));
      var g = bx, bw = buf.width, bh = buf.height;
      var t = (st.player ? st.player.roll : 0);

      // небо + дальние холмы + трава
      var sg = g.createLinearGradient(0, 0, 0, bh);
      sg.addColorStop(0, PAL.sky2); sg.addColorStop(1, PAL.sky);
      g.fillStyle = sg; g.fillRect(0, 0, bw, bh);
      g.fillStyle = PAL.hill2;
      for (var hx = 0; hx < bw; hx += 80) { g.beginPath(); g.arc(hx + 40 + (st.roomId * 13) % 40, bh - 30, 46, Math.PI, 0); g.fill(); }
      g.fillStyle = PAL.hill;
      for (hx = -30; hx < bw; hx += 90) { g.beginPath(); g.arc(hx + 45, bh - 10, 40, Math.PI, 0); g.fill(); }

      if (!st.grid || !st.grid.length) { upscale(ctx, W, H, bw, bh); return; }

      // тайлы
      var ts = px(TILE * SCALE);
      for (var r = 0; r < st.rows; r++) {
        var row = st.grid[r];
        for (var c = 0; c < st.cols; c++) {
          var ch = row[c]; if (ch === ' ' || ch === 'P') continue;
          var X = px(c * TILE * SCALE), Y = px(r * TILE * SCALE);
          if (ch === '#') ground(g, X, Y, ts);
          else if (ch === '=') platform(g, X, Y, ts);
          else if (ch === 'D') gate(g, X, Y, ts);
          else if (ch === '~') water(g, X, Y, ts, t);
          else if (ch === '^') fire(g, X, Y, ts, t);
          else if (ch === '*') berry(g, px((c * TILE + TILE / 2) * SCALE), px((r * TILE + TILE / 2 + Math.sin(t * 2 + c) * 2) * SCALE));
          else if (ch === 'k') keyIcon(g, px((c * TILE + TILE / 2) * SCALE), px((r * TILE + TILE / 2) * SCALE));
          else if (ch === 'p') plankIcon(g, px((c * TILE + TILE / 2) * SCALE), px((r * TILE + TILE / 2) * SCALE));
          else if (ch === 'u') bucketIcon(g, px((c * TILE + TILE / 2) * SCALE), px((r * TILE + TILE / 2) * SCALE));
        }
      }

      if (st.goal) drawHome(g, st.goal);
      for (var i = 0; i < st.enemies.length; i++) drawFox(g, st.enemies[i]);
      if (st.player && st.phase !== 'gameover') drawPlayer(g, st.player);
      for (i = 0; i < st.particles.length; i++) { var pp = st.particles[i]; g.fillStyle = pp.c ? PAL.berry : PAL.fireY; g.fillRect(px(pp.x * SCALE), px(pp.y * SCALE), 2, 2); }

      upscale(ctx, W, H, bw, bh);
      drawHUD(ctx, st);
      drawBanner(ctx, st);
    }
  };

  function upscale(ctx, W, H, bw, bh) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(buf, 0, 0, bw, bh, 0, 0, W, H);
  }
})(typeof window !== 'undefined' ? window : globalThis);
