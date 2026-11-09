/* БОЛТ · рендер 8-БИТ (classic). B.classic.draw(ctx, st)
   Внутренний буфер половинного разрешения, апскейл без сглаживания — честный пиксель. */
(function (global) {
  'use strict';
  var B = global.BOLT = global.BOLT || {};

  var SCALE = 0.5;                 // мир → буфер (клетка 30 → 15 px)
  var buf = null, bx = null;       // offscreen-буфер

  // Ограниченная 8-битная палитра.
  var PAL = {
    sky: '#0d1326', sky2: '#14203b', star: '#2b3a63',
    brickA: '#6b4a2e', brickB: '#422c1a', brickE: '#8a6338',
    platA: '#49597a', platB: '#2e3c58', platE: '#6b7ea8',
    body: '#cfd8e6', bodyD: '#8f9bb0', accent: '#ff8a3d', visor: '#33e0ff',
    walk: '#63c85a', walkD: '#2f7a2c', eye: '#ffef7a',
    fly: '#e85c8a', flyD: '#8f2f56',
    coin: '#f5d23e', batt: '#49e07a', bullet: '#ffef7a', doorA: '#8a63ff', doorB: '#33e0ff'
  };

  function ensureBuf(w, h) {
    if (!buf) { buf = document.createElement('canvas'); bx = buf.getContext('2d'); }
    if (buf.width !== w || buf.height !== h) { buf.width = w; buf.height = h; }
  }
  function px(n) { return Math.round(n); }

  function brick(g, x, y, s, a, b, e) {
    g.fillStyle = b; g.fillRect(x, y, s, s);
    g.fillStyle = a; g.fillRect(x, y, s, s - 2);
    g.fillStyle = e; g.fillRect(x, y, s, 1); g.fillRect(x, y, 1, s - 2);
  }

  function drawPlayer(g, p, camX) {
    var x = px((p.x - camX) * SCALE), y = px(p.y * SCALE), w = px(p.w * SCALE), h = px(p.h * SCALE);
    if (p.invuln > 0 && (Math.floor(p.invuln * 12) % 2 === 0)) return; // мигание неуязвимости
    // корпус
    g.fillStyle = PAL.bodyD; g.fillRect(x, y, w, h);
    g.fillStyle = PAL.body; g.fillRect(x, y, w, h - 2);
    // «реактивная» грудь-акцент
    g.fillStyle = PAL.accent; g.fillRect(x + 1, y + px(h * 0.45), w - 2, 2);
    // визор (смотрит по направлению)
    g.fillStyle = PAL.visor;
    var vw = Math.max(3, px(w * 0.5));
    g.fillRect(p.dir > 0 ? x + w - vw - 1 : x + 1, y + 2, vw, 3);
    // ноги (анимация шага)
    g.fillStyle = PAL.bodyD;
    var legSplit = (Math.floor(p.walkT) % 2 === 0);
    g.fillRect(x + 1, y + h - 3, 3, 3);
    g.fillRect(x + w - 4, y + h - 3, 3, 3);
    if (legSplit && p.onGround) { g.fillRect(x, y + h - 2, 2, 2); }
  }

  function drawWalker(g, e, camX) {
    var x = px((e.x - camX) * SCALE), y = px(e.y * SCALE), w = px(e.w * SCALE), h = px(e.h * SCALE);
    g.fillStyle = PAL.walkD; g.fillRect(x, y, w, h);
    g.fillStyle = PAL.walk; g.fillRect(x, y, w, h - 2);
    g.fillStyle = PAL.eye; g.fillRect(e.dir > 0 ? x + w - 4 : x + 2, y + 3, 2, 2);
    g.fillStyle = PAL.walkD; g.fillRect(x + 2, y + h - 2, 2, 2); g.fillRect(x + w - 4, y + h - 2, 2, 2);
  }
  function drawFlyer(g, e, camX) {
    var x = px((e.x - camX) * SCALE), y = px(e.y * SCALE), w = px(e.w * SCALE), h = px(e.h * SCALE);
    g.fillStyle = PAL.flyD; g.fillRect(x, y, w, h);
    g.fillStyle = PAL.fly; g.fillRect(x, y + 1, w, h - 2);
    g.fillStyle = PAL.eye; g.fillRect(x + px(w / 2) - 1, y + 2, 2, 2);
    // крылья
    g.fillStyle = PAL.flyD; g.fillRect(x - 2, y + 2, 2, 2); g.fillRect(x + w, y + 2, 2, 2);
  }

  function drawDoor(g, d, camX) {
    var x = px((d.x - camX) * SCALE), y = px(d.y * SCALE), w = px(d.w * SCALE), h = px(d.h * SCALE);
    g.fillStyle = '#1a1030'; g.fillRect(x, y, w, h);
    g.fillStyle = PAL.doorA; g.fillRect(x, y, w, 2); g.fillRect(x, y, 2, h); g.fillRect(x + w - 2, y, 2, h);
    g.fillStyle = PAL.doorB; g.fillRect(x + 3, y + 3, w - 6, h - 6);
    g.fillStyle = '#eafcff'; g.fillRect(x + px(w / 2) - 1, y + 4, 2, h - 8);
  }

  function hudText(ctx, s, x, y, col, size, align) {
    ctx.fillStyle = col; ctx.font = '700 ' + size + 'px "DejaVu Sans Mono","Courier New",monospace';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y);
  }

  function drawHUD(ctx, st) {
    var t = B.t;
    ctx.fillStyle = 'rgba(5,8,18,.72)'; ctx.fillRect(0, 0, st.viewW, 34);
    ctx.fillStyle = '#2a3658'; ctx.fillRect(0, 34, st.viewW, 2);
    hudText(ctx, t('score') + ' ' + st.score, 12, 23, '#f5d23e', 15);
    hudText(ctx, t('best') + ' ' + st.hi, 190, 23, '#8fa0c8', 13);
    hudText(ctx, t('level') + ' ' + (st.level + 1), st.viewW / 2, 23, '#cfd8e6', 15, 'center');
    // жизни — иконки роботов
    for (var i = 0; i < st.lives; i++) {
      var lx = st.viewW - 150 + i * 16;
      ctx.fillStyle = '#cfd8e6'; ctx.fillRect(lx, 11, 9, 12);
      ctx.fillStyle = '#33e0ff'; ctx.fillRect(lx + 5, 13, 3, 2);
    }
    // полоса заряда
    var bw = 120, bxp = st.viewW - 12 - bw, byp = 11, ratio = Math.max(0, st.charge / st.chargeMax);
    hudText(ctx, t('charge'), bxp - 6, 23, '#8fa0c8', 12, 'right');
    ctx.fillStyle = '#10182c'; ctx.fillRect(bxp, byp, bw, 12);
    ctx.fillStyle = ratio > 0.3 ? '#49e07a' : '#ff5c4d'; ctx.fillRect(bxp + 1, byp + 1, Math.round((bw - 2) * ratio), 10);
    ctx.strokeStyle = '#3a4a70'; ctx.lineWidth = 1; ctx.strokeRect(bxp + 0.5, byp + 0.5, bw - 1, 11);
  }

  function drawBanner(ctx, st) {
    var t = B.t, msg = null, sub = null;
    if (st.phase === 'play' && st.intro > 0) { msg = t('ready') + ' ' + (st.level + 1); sub = t('go'); }
    else if (st.phase === 'levelclear') { msg = t('clear'); }
    else if (st.phase === 'dying') { msg = '—'; }
    if (!msg) return;
    ctx.fillStyle = 'rgba(5,8,18,.55)'; ctx.fillRect(0, st.viewH / 2 - 54, st.viewW, 108);
    hudText(ctx, msg, st.viewW / 2, st.viewH / 2, '#ffef7a', 40, 'center');
    if (sub) hudText(ctx, sub, st.viewW / 2, st.viewH / 2 + 34, '#33e0ff', 20, 'center');
  }

  B.classic = {
    draw: function (ctx, st) {
      var W = st.viewW, H = st.viewH;
      ensureBuf(Math.round(W * SCALE), Math.round(H * SCALE));
      var g = bx, bw = buf.width, bh = buf.height, camX = st.camX;

      // небо
      g.fillStyle = PAL.sky; g.fillRect(0, 0, bw, bh);
      g.fillStyle = PAL.sky2; g.fillRect(0, bh - 40, bw, 40);
      // звёзды (детерминированные по миру)
      g.fillStyle = PAL.star;
      for (var s = 0; s < 60; s++) {
        var sx = ((s * 97) % (st.pixelW)) - camX * 0.4;
        var sy = (s * 53) % (bh - 50);
        var mx = ((sx % bw) + bw) % bw;
        g.fillRect(px(mx), px(sy), 1, 1);
      }

      // тайлы (только видимые)
      var ts = px(30 * SCALE);
      var c0 = Math.floor(camX / 30), c1 = Math.ceil((camX + W) / 30);
      for (var r = 0; r < st.rows; r++) {
        var row = st.grid[r];
        for (var c = c0; c <= c1; c++) {
          if (c < 0 || c >= st.cols) continue;
          var ch = row[c]; if (ch !== '#' && ch !== '=') continue;
          var X = px((c * 30 - camX) * SCALE), Y = px(r * 30 * SCALE);
          if (ch === '#') brick(g, X, Y, ts, PAL.brickA, PAL.brickB, PAL.brickE);
          else brick(g, X, Y, ts, PAL.platA, PAL.platB, PAL.platE);
        }
      }

      // дверь
      if (st.door) drawDoor(g, st.door, camX);
      // пикапы
      for (var i = 0; i < st.pickups.length; i++) {
        var k = st.pickups[i], kx = px((k.x - camX) * SCALE), ky = px((k.y + Math.sin(k.t * 3) * 2) * SCALE);
        if (k.kind === 'coin') { g.fillStyle = PAL.coin; g.fillRect(kx - 3, ky - 3, 6, 6); g.fillStyle = '#fff6bf'; g.fillRect(kx - 1, ky - 3, 2, 6); }
        else { g.fillStyle = '#145a30'; g.fillRect(kx - 4, ky - 5, 8, 10); g.fillStyle = PAL.batt; g.fillRect(kx - 3, ky - 4, 6, 8); g.fillStyle = '#eafff0'; g.fillRect(kx - 1, ky - 2, 2, 4); g.fillRect(kx - 2, ky, 4, 1); }
      }
      // враги
      for (i = 0; i < st.enemies.length; i++) { var e = st.enemies[i]; if (e.type === 'walker') drawWalker(g, e, camX); else drawFlyer(g, e, camX); }
      // игрок
      if (st.player && st.phase !== 'gameover') drawPlayer(g, st.player, camX);
      // пули
      g.fillStyle = PAL.bullet;
      for (i = 0; i < st.bullets.length; i++) { var b = st.bullets[i]; g.fillRect(px((b.x - camX) * SCALE) - 2, px(b.y * SCALE) - 1, 4, 2); }
      // частицы
      for (i = 0; i < st.particles.length; i++) { var pp = st.particles[i]; g.fillStyle = pp.c ? PAL.accent : PAL.bullet; g.fillRect(px((pp.x - camX) * SCALE), px(pp.y * SCALE), 2, 2); }

      // апскейл буфера без сглаживания
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(buf, 0, 0, bw, bh, 0, 0, W, H);

      // HUD и баннеры — крупным текстом поверх
      drawHUD(ctx, st);
      drawBanner(ctx, st);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
