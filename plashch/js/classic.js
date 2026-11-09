/* ПЛАЩ · рендер 8-БИТ (classic). P.classic.draw(ctx, st)
   Внутренний буфер половинного разрешения, апскейл без сглаживания — честный пиксель. */
(function (global) {
  'use strict';
  var P = global.PLASHCH = global.PLASHCH || {};

  var SCALE = 0.5;                 // мир → буфер (клетка 30 → 15 px)
  var buf = null, bx = null;

  // Ограниченная «ночная» палитра.
  var PAL = {
    sky: '#0b0a1e', sky2: '#161033', star: '#2d2a55', moon: '#d9d2a6',
    brickA: '#2c2740', brickB: '#191427', brickE: '#443c63',
    platA: '#394a6b', platB: '#232f49', platE: '#5c7098',
    cape: '#7a3bd4', capeD: '#4d2088', body: '#2a2f52', bodyD: '#1a1d38',
    mask: '#15182c', eye: '#49e0ff', emblem: '#f5c84a',
    walk: '#c24a4a', walkD: '#7a2626', eyeR: '#ffd27a',
    shoot: '#d08a3a', shootD: '#8a5520',
    fly: '#4ac2a0', flyD: '#256b58',
    boss: '#b03a6a', bossD: '#6b2040', bossE: '#ffd27a',
    coin: '#f5c84a', medkit: '#49e07a', bullet: '#eafcff', ebul: '#ff5c4d',
    doorA: '#8a63ff', doorB: '#49e0ff', rope: '#c9b88a'
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

  function drawHook(g, a, camX) {
    var x = px((a.x - camX) * SCALE), y = px(a.y * SCALE);
    g.fillStyle = '#5a5240'; g.fillRect(x - 1, y - 7, 2, 5);
    g.fillStyle = PAL.rope; g.fillRect(x - 2, y - 2, 4, 2);
    g.fillRect(x - 2, y, 1, 3); g.fillRect(x + 1, y, 1, 2);
  }

  function drawPlayer(g, p, camX) {
    if (p.invuln > 0 && (Math.floor(p.invuln * 12) % 2 === 0)) return; // мигание неуязвимости
    var x = px((p.x - camX) * SCALE), y = px(p.y * SCALE), w = px(p.w * SCALE), h = px(p.h * SCALE);
    // плащ за спиной (развевается против направления движения)
    g.fillStyle = PAL.capeD;
    var cb = p.dir > 0 ? x - 2 : x + w - 1;
    g.fillRect(cb, y + 1, 3, h - 1);
    g.fillStyle = PAL.cape; g.fillRect(cb, y + 1, 2, h - 2);
    // корпус
    g.fillStyle = PAL.bodyD; g.fillRect(x, y, w, h);
    g.fillStyle = PAL.body; g.fillRect(x, y, w, h - 2);
    // эмблема
    g.fillStyle = PAL.emblem; g.fillRect(x + px(w / 2) - 1, y + px(h * 0.4), 2, 2);
    // маска/глаза (верх)
    g.fillStyle = PAL.mask; g.fillRect(x, y, w, Math.max(2, px(h * 0.28)));
    g.fillStyle = PAL.eye;
    g.fillRect(p.dir > 0 ? x + w - 3 : x + 1, y + 1, 2, 2);
  }

  function drawWalker(g, e, camX) {
    var x = px((e.x - camX) * SCALE), y = px(e.y * SCALE), w = px(e.w * SCALE), h = px(e.h * SCALE);
    g.fillStyle = PAL.walkD; g.fillRect(x, y, w, h);
    g.fillStyle = PAL.walk; g.fillRect(x, y, w, h - 2);
    g.fillStyle = PAL.eyeR; g.fillRect(e.dir > 0 ? x + w - 4 : x + 2, y + 3, 2, 2);
    g.fillStyle = PAL.walkD; g.fillRect(x + 2, y + h - 2, 2, 2); g.fillRect(x + w - 4, y + h - 2, 2, 2);
  }
  function drawShooter(g, e, camX) {
    var x = px((e.x - camX) * SCALE), y = px(e.y * SCALE), w = px(e.w * SCALE), h = px(e.h * SCALE);
    g.fillStyle = PAL.shootD; g.fillRect(x, y, w, h);
    g.fillStyle = PAL.shoot; g.fillRect(x, y, w, h - 2);
    g.fillStyle = PAL.mask; g.fillRect(x, y, w, 3);
    g.fillStyle = PAL.eyeR; g.fillRect(e.dir > 0 ? x + w - 3 : x + 1, y + 1, 2, 2);
    // ствол
    g.fillStyle = '#20242e'; g.fillRect(e.dir > 0 ? x + w : x - 3, y + px(h / 2), 3, 2);
  }
  function drawFlyer(g, e, camX) {
    var x = px((e.x - camX) * SCALE), y = px(e.y * SCALE), w = px(e.w * SCALE), h = px(e.h * SCALE);
    g.fillStyle = PAL.flyD; g.fillRect(x, y, w, h);
    g.fillStyle = PAL.fly; g.fillRect(x, y + 1, w, h - 2);
    g.fillStyle = PAL.eyeR; g.fillRect(x + px(w / 2) - 1, y + 2, 2, 2);
    g.fillStyle = PAL.flyD; g.fillRect(x - 2, y + 2, 2, 2); g.fillRect(x + w, y + 2, 2, 2);
  }
  function drawBoss(g, b, camX) {
    if (b.invuln > 0 && (Math.floor(b.invuln * 20) % 2 === 0)) { /* вспышка — светлее */ }
    var x = px((b.x - camX) * SCALE), y = px(b.y * SCALE), w = px(b.w * SCALE), h = px(b.h * SCALE);
    g.fillStyle = PAL.bossD; g.fillRect(x, y, w, h);
    g.fillStyle = PAL.boss; g.fillRect(x, y, w, h - 2);
    g.fillStyle = PAL.mask; g.fillRect(x, y, w, px(h * 0.3));
    g.fillStyle = PAL.bossE;
    g.fillRect(b.dir > 0 ? x + w - 6 : x + 2, y + 3, 3, 3);
    g.fillRect(b.dir > 0 ? x + 2 : x + w - 5, y + 3, 3, 3);
    g.fillStyle = PAL.emblem; g.fillRect(x + px(w / 2) - 2, y + px(h * 0.5), 4, 4);
  }

  function drawDoor(g, d, camX) {
    var x = px((d.x - camX) * SCALE), y = px(d.y * SCALE), w = px(d.w * SCALE), h = px(d.h * SCALE);
    g.fillStyle = '#120a26'; g.fillRect(x, y, w, h);
    g.fillStyle = PAL.doorA; g.fillRect(x, y, w, 2); g.fillRect(x, y, 2, h); g.fillRect(x + w - 2, y, 2, h);
    g.fillStyle = PAL.doorB; g.fillRect(x + 3, y + 3, w - 6, h - 6);
    g.fillStyle = '#eafcff'; g.fillRect(x + px(w / 2) - 1, y + 4, 2, h - 8);
  }

  function hudText(ctx, s, x, y, col, size, align) {
    ctx.fillStyle = col; ctx.font = '700 ' + size + 'px "DejaVu Sans Mono","Courier New",monospace';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y);
  }

  function drawHUD(ctx, st) {
    var t = P.t;
    ctx.fillStyle = 'rgba(6,5,18,.74)'; ctx.fillRect(0, 0, st.viewW, 34);
    ctx.fillStyle = '#2d2a55'; ctx.fillRect(0, 34, st.viewW, 2);
    hudText(ctx, t('score') + ' ' + st.score, 12, 23, PAL.emblem, 15);
    hudText(ctx, t('best') + ' ' + st.hi, 200, 23, '#9a93c8', 13);
    hudText(ctx, t('level') + ' ' + (st.level + 1), st.viewW / 2, 23, '#cfd0e6', 15, 'center');
    // жизни — мини-плащи
    for (var i = 0; i < st.lives; i++) {
      var lx = st.viewW - 150 + i * 16;
      ctx.fillStyle = PAL.cape; ctx.fillRect(lx, 11, 9, 12);
      ctx.fillStyle = PAL.eye; ctx.fillRect(lx + 2, 13, 5, 2);
    }
    // здоровье
    var hw = 90, hxp = st.viewW - 12 - hw, hyp = 25, seg = hw / st.hpMax;
    hudText(ctx, t('hp'), hxp - 6, 23, '#9a93c8', 11, 'right');
    for (var k = 0; k < st.hpMax; k++) {
      ctx.fillStyle = k < st.hp ? '#ff5c6e' : '#241f3a';
      ctx.fillRect(hxp + k * seg + 1, hyp, seg - 2, 6);
    }
    // шкала босса
    if (st.boss) {
      var bw = 260, bxp = (st.viewW - bw) / 2, ratio = Math.max(0, st.boss.hp / st.boss.hpMax);
      hudText(ctx, t('boss'), st.viewW / 2, 52, '#ffd27a', 13, 'center');
      ctx.fillStyle = '#241f3a'; ctx.fillRect(bxp, 56, bw, 8);
      ctx.fillStyle = '#ff5c6e'; ctx.fillRect(bxp + 1, 57, (bw - 2) * ratio, 6);
      ctx.strokeStyle = '#6b2040'; ctx.lineWidth = 1; ctx.strokeRect(bxp + 0.5, 56.5, bw - 1, 7);
    }
  }

  function drawBanner(ctx, st) {
    var t = P.t, msg = null, sub = null;
    if (st.phase === 'play' && st.intro > 0) { msg = (st.boss ? t('boss') : t('ready') + ' ' + (st.level + 1)); sub = t('go'); }
    else if (st.phase === 'levelclear') { msg = t('clear'); }
    if (!msg) return;
    ctx.fillStyle = 'rgba(6,5,18,.55)'; ctx.fillRect(0, st.viewH / 2 - 54, st.viewW, 108);
    hudText(ctx, msg, st.viewW / 2, st.viewH / 2, '#f5c84a', 40, 'center');
    if (sub) hudText(ctx, sub, st.viewW / 2, st.viewH / 2 + 34, PAL.eye, 20, 'center');
  }

  P.classic = {
    draw: function (ctx, st) {
      if (!st || !st.grid) return;
      var W = st.viewW, H = st.viewH;
      ensureBuf(Math.round(W * SCALE), Math.round(H * SCALE));
      var g = bx, bw = buf.width, bh = buf.height, camX = st.camX;

      // ночное небо
      g.fillStyle = PAL.sky; g.fillRect(0, 0, bw, bh);
      g.fillStyle = PAL.sky2; g.fillRect(0, bh - 40, bw, 40);
      // луна
      g.fillStyle = PAL.moon; g.fillRect(bw - 48, 12, 14, 14); g.fillStyle = PAL.sky; g.fillRect(bw - 44, 10, 10, 10);
      // звёзды
      g.fillStyle = PAL.star;
      for (var s = 0; s < 64; s++) {
        var sx = ((s * 97) % st.pixelW) - camX * 0.4;
        var sy = (s * 53) % (bh - 55);
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

      // крюки
      for (var ai = 0; ai < st.anchors.length; ai++) drawHook(g, st.anchors[ai], camX);
      // трос
      if (st.player && st.player.grapple.on) {
        var gr = st.player.grapple;
        g.strokeStyle = PAL.rope; g.lineWidth = 1;
        g.beginPath();
        g.moveTo(px((gr.ax - camX) * SCALE), px(gr.ay * SCALE));
        g.lineTo(px((st.player.x + st.player.w / 2 - camX) * SCALE), px((st.player.y + 2) * SCALE));
        g.stroke();
      }
      // дверь
      if (st.door) drawDoor(g, st.door, camX);
      // пикапы
      for (var i = 0; i < st.pickups.length; i++) {
        var k = st.pickups[i], kx = px((k.x - camX) * SCALE), ky = px((k.y + Math.sin(k.t * 3) * 2) * SCALE);
        if (k.kind === 'coin') { g.fillStyle = PAL.coin; g.fillRect(kx - 3, ky - 3, 6, 6); g.fillStyle = '#fff2c4'; g.fillRect(kx - 1, ky - 3, 2, 6); }
        else { g.fillStyle = '#0e3a22'; g.fillRect(kx - 4, ky - 4, 8, 8); g.fillStyle = PAL.medkit; g.fillRect(kx - 3, ky - 3, 6, 6); g.fillStyle = '#eafff0'; g.fillRect(kx - 1, ky - 2, 2, 4); g.fillRect(kx - 2, ky - 1, 4, 2); }
      }
      // враги
      for (i = 0; i < st.enemies.length; i++) {
        var e = st.enemies[i];
        if (e.type === 'walker') drawWalker(g, e, camX);
        else if (e.type === 'shooter') drawShooter(g, e, camX);
        else drawFlyer(g, e, camX);
      }
      // босс
      if (st.boss) drawBoss(g, st.boss, camX);
      // игрок
      if (st.player && st.phase !== 'gameover') drawPlayer(g, st.player, camX);
      // пули игрока (сюрикены)
      g.fillStyle = PAL.bullet;
      for (i = 0; i < st.bullets.length; i++) { var b = st.bullets[i]; g.fillRect(px((b.x - camX) * SCALE) - 2, px(b.y * SCALE) - 1, 4, 2); g.fillRect(px((b.x - camX) * SCALE) - 1, px(b.y * SCALE) - 2, 2, 4); }
      // пули врагов
      for (i = 0; i < st.ebullets.length; i++) { var eb = st.ebullets[i]; g.fillStyle = PAL.ebul; var sz = eb.big ? 3 : 2; g.fillRect(px((eb.x - camX) * SCALE) - sz, px(eb.y * SCALE) - 1, sz * 2, 2); }
      // частицы
      for (i = 0; i < st.particles.length; i++) { var pp = st.particles[i]; g.fillStyle = pp.c ? PAL.emblem : PAL.ebul; g.fillRect(px((pp.x - camX) * SCALE), px(pp.y * SCALE), 2, 2); }

      // апскейл без сглаживания
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(buf, 0, 0, bw, bh, 0, 0, W, H);

      drawHUD(ctx, st);
      drawBanner(ctx, st);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
