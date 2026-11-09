/* ЗВЕРО-ОТРЯД · рендер 8-БИТ (classic). Z.classic.draw(ctx, st)
   Внутренний буфер половинного разрешения, апскейл без сглаживания — честный пиксель. */
(function (global) {
  'use strict';
  var Z = global.ZVERO = global.ZVERO || {};

  var SCALE = 0.5;
  var buf = null, bx = null;

  // Ограниченная 8-битная палитра «тёплой мастерской».
  var PAL = {
    sky: '#241a12', sky2: '#30231a', star: '#6b4e33',
    brickA: '#7a4f2c', brickB: '#4c3119', brickE: '#9c6a3c',
    platA: '#3d7a4a', platB: '#245030', platE: '#5fb06e',
    box: '#c98a3c', boxD: '#8a5a22', boxE: '#f0c070',
    hogA: '#e07a2c', hogB: '#a8531a', hogBelly: '#f2c48a', hogSpike: '#5a3416',
    hareA: '#9fb0c0', hareB: '#6c7c8e', hareBelly: '#e7eef4',
    walk: '#8a63c8', walkD: '#4f357a', eye: '#fff3a0',
    fly: '#e8d24a', flyD: '#8f7a1a',
    boss: '#b5651d', bossD: '#6e3c10', bossEye: '#ff5c4d',
    star: '#f5d23e', door: '#56c8ff', door2: '#aef0ff'
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

  function drawBox(g, b, camX) {
    var x = px((b.x - camX) * SCALE), y = px(b.y * SCALE), w = px(b.w * SCALE), h = px(b.h * SCALE);
    g.fillStyle = PAL.boxD; g.fillRect(x, y, w, h);
    g.fillStyle = PAL.box; g.fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle = PAL.boxE; g.fillRect(x + 1, y + 1, w - 2, 1);
    g.fillStyle = PAL.boxD; g.fillRect(x + 1, y + px(h / 2), w - 2, 1); g.fillRect(x + px(w / 2), y + 1, 1, h - 2);
  }

  function drawHog(g, p, camX) {
    var x = px((p.x - camX) * SCALE), y = px(p.y * SCALE), w = px(p.w * SCALE), h = px(p.h * SCALE);
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return;
    // колючая шапка
    g.fillStyle = PAL.hogSpike;
    for (var i = 0; i < w; i += 2) g.fillRect(x + i, y - 2, 1, 3);
    // тело
    g.fillStyle = PAL.hogB; g.fillRect(x, y, w, h);
    g.fillStyle = PAL.hogA; g.fillRect(x, y, w, h - 2);
    g.fillStyle = PAL.hogBelly; g.fillRect(x + 1, y + px(h * 0.5), w - 2, px(h * 0.4));
    // мордочка/нос по направлению
    g.fillStyle = PAL.hogSpike; g.fillRect(p.dir > 0 ? x + w - 2 : x, y + 3, 2, 2);
    // глаз
    g.fillStyle = '#1a120a'; g.fillRect(p.dir > 0 ? x + w - 4 : x + 2, y + 2, 1, 2);
    // ноги
    g.fillStyle = PAL.hogB;
    var ls = Math.floor(p.walkT) % 2 === 0;
    g.fillRect(x + 1, y + h - 2, 2, 2); g.fillRect(x + w - 3, y + h - 2, 2, 2);
    if (ls && p.onGround) g.fillRect(x, y + h - 1, 1, 1);
  }
  function drawHare(g, p, camX) {
    var x = px((p.x - camX) * SCALE), y = px(p.y * SCALE), w = px(p.w * SCALE), h = px(p.h * SCALE);
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return;
    // длинные уши
    g.fillStyle = PAL.hareB; g.fillRect(x + 1, y - 4, 2, 5); g.fillRect(x + w - 3, y - 4, 2, 5);
    g.fillStyle = '#f3c6d0'; g.fillRect(x + 1, y - 3, 1, 3); g.fillRect(x + w - 3, y - 3, 1, 3);
    // тело
    g.fillStyle = PAL.hareB; g.fillRect(x, y, w, h);
    g.fillStyle = PAL.hareA; g.fillRect(x, y, w, h - 2);
    g.fillStyle = PAL.hareBelly; g.fillRect(x + 1, y + px(h * 0.5), w - 2, px(h * 0.4));
    g.fillStyle = '#1a120a'; g.fillRect(p.dir > 0 ? x + w - 4 : x + 2, y + 2, 1, 2);
    g.fillStyle = PAL.hareB;
    var ls = Math.floor(p.walkT) % 2 === 0;
    g.fillRect(x + 1, y + h - 2, 2, 2); g.fillRect(x + w - 3, y + h - 2, 2, 2);
    if (ls && p.onGround) g.fillRect(x + w - 1, y + h - 1, 1, 1);
  }

  function drawWalker(g, e, camX) {
    var x = px((e.x - camX) * SCALE), y = px(e.y * SCALE), w = px(e.w * SCALE), h = px(e.h * SCALE);
    g.fillStyle = PAL.walkD; g.fillRect(x, y, w, h);
    g.fillStyle = PAL.walk; g.fillRect(x, y, w, h - 2);
    g.fillStyle = PAL.eye; g.fillRect(e.dir > 0 ? x + w - 4 : x + 2, y + 3, 2, 2);
    g.fillStyle = PAL.walkD; g.fillRect(x + 1, y + h - 2, 2, 2); g.fillRect(x + w - 3, y + h - 2, 2, 2);
  }
  function drawFlyer(g, e, camX) {
    var x = px((e.x - camX) * SCALE), y = px(e.y * SCALE), w = px(e.w * SCALE), h = px(e.h * SCALE);
    g.fillStyle = PAL.flyD; g.fillRect(x - 2, y + 1, 2, 2); g.fillRect(x + w, y + 1, 2, 2); // крылья
    g.fillStyle = PAL.flyD; g.fillRect(x, y, w, h);
    g.fillStyle = PAL.fly; g.fillRect(x, y + 1, w, h - 2);
    g.fillStyle = '#1a120a'; g.fillRect(x + px(w / 2) - 1, y + 2, 2, 2);
  }
  function drawBoss(g, b, camX) {
    var x = px((b.x - camX) * SCALE), y = px(b.y * SCALE), w = px(b.w * SCALE), h = px(b.h * SCALE);
    var flash = b.hitFlash > 0 && Math.floor(b.hitFlash * 20) % 2 === 0;
    g.fillStyle = flash ? '#fff' : PAL.bossD; g.fillRect(x, y, w, h);
    g.fillStyle = flash ? '#ffd0d0' : PAL.boss; g.fillRect(x, y, w, h - 2);
    // уши крысы
    g.fillStyle = PAL.bossD; g.fillRect(x + 1, y - 2, 3, 3); g.fillRect(x + w - 4, y - 2, 3, 3);
    // глаза
    g.fillStyle = PAL.bossEye; g.fillRect(x + 3, y + 4, 3, 3); g.fillRect(x + w - 6, y + 4, 3, 3);
    // пояс-«бригадир»
    g.fillStyle = '#2a1a0a'; g.fillRect(x, y + px(h * 0.6), w, 2);
  }

  function drawDoor(g, d, camX) {
    var x = px((d.x - camX) * SCALE), y = px(d.y * SCALE), w = px(d.w * SCALE), h = px(d.h * SCALE);
    g.fillStyle = '#10212a'; g.fillRect(x, y, w, h);
    var open = d.open;
    g.fillStyle = open ? PAL.door : '#3a4a52'; g.fillRect(x, y, w, 2); g.fillRect(x, y, 2, h); g.fillRect(x + w - 2, y, 2, h);
    g.fillStyle = open ? PAL.door2 : '#28353c'; g.fillRect(x + 3, y + 3, w - 6, h - 6);
    g.fillStyle = open ? '#eafcff' : '#1c272d'; g.fillRect(x + px(w / 2) - 1, y + 4, 2, h - 8);
  }

  function hudText(ctx, s, x, y, col, size, align) {
    ctx.fillStyle = col; ctx.font = '700 ' + size + 'px "DejaVu Sans Mono","Courier New",monospace';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y);
  }
  function drawHUD(ctx, st) {
    var t = Z.t;
    ctx.fillStyle = 'rgba(20,12,6,.76)'; ctx.fillRect(0, 0, st.viewW, 34);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(0, 34, st.viewW, 2);
    hudText(ctx, t('score') + ' ' + st.score, 12, 23, '#f5d23e', 15);
    hudText(ctx, t('best') + ' ' + st.hi, 200, 23, '#caa070', 13);
    hudText(ctx, t('level') + ' ' + (st.level + 1), st.viewW / 2, 23, '#f2c48a', 15, 'center');
    hudText(ctx, t('lives') + ' ♥' + st.lives, st.viewW - 14, 23, '#ff8a6a', 15, 'right');
    if (st.boss) {
      var bw = 150, bxp = st.viewW / 2 - bw / 2, ratio = Math.max(0, st.boss.hp / st.boss.hpMax);
      ctx.fillStyle = '#2a1a0a'; ctx.fillRect(bxp, 38, bw, 8);
      ctx.fillStyle = '#ff5c4d'; ctx.fillRect(bxp + 1, 39, Math.round((bw - 2) * ratio), 6);
      hudText(ctx, t('boss'), st.viewW / 2, 56, '#ffd0c0', 11, 'center');
    }
  }
  function drawBanner(ctx, st) {
    var t = Z.t, msg = null, sub = null;
    if (st.phase === 'play' && st.intro > 0) { msg = t('ready') + ' ' + (st.level + 1); sub = t('go'); }
    else if (st.phase === 'levelclear') { msg = t('clear'); }
    if (!msg) return;
    ctx.fillStyle = 'rgba(20,12,6,.55)'; ctx.fillRect(0, st.viewH / 2 - 54, st.viewW, 108);
    hudText(ctx, msg, st.viewW / 2, st.viewH / 2, '#f5d23e', 40, 'center');
    if (sub) hudText(ctx, sub, st.viewW / 2, st.viewH / 2 + 34, '#56c8ff', 20, 'center');
  }

  Z.classic = {
    draw: function (ctx, st) {
      var W = st.viewW, H = st.viewH;
      ensureBuf(Math.round(W * SCALE), Math.round(H * SCALE));
      var g = bx, bw = buf.width, bh = buf.height, camX = st.camX || 0;

      g.fillStyle = PAL.sky; g.fillRect(0, 0, bw, bh);
      g.fillStyle = PAL.sky2; g.fillRect(0, bh - 40, bw, 40);
      g.fillStyle = PAL.star;
      for (var s = 0; s < 50; s++) {
        var sx = ((s * 97) % Math.max(1, st.pixelW)) - camX * 0.4;
        var mx = ((sx % bw) + bw) % bw;
        g.fillRect(px(mx), px((s * 53) % (bh - 50)), 1, 1);
      }

      if (st.grid && st.grid.length) {
        var ts = px(30 * SCALE), c0 = Math.floor(camX / 30), c1 = Math.ceil((camX + W) / 30);
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
      }

      if (st.door) drawDoor(g, st.door, camX);
      var i;
      for (i = 0; i < st.pickups.length; i++) {
        var k = st.pickups[i], kx = px((k.x - camX) * SCALE), ky = px((k.y + Math.sin(k.t * 3) * 2) * SCALE);
        g.fillStyle = PAL.star; g.fillRect(kx - 1, ky - 4, 2, 8); g.fillRect(kx - 4, ky - 1, 8, 2); g.fillRect(kx - 3, ky - 3, 6, 6);
        g.fillStyle = '#fff6bf'; g.fillRect(kx - 1, ky - 1, 2, 2);
      }
      for (i = 0; i < st.boxes.length; i++) drawBox(g, st.boxes[i], camX);
      for (i = 0; i < st.enemies.length; i++) { var e = st.enemies[i]; if (e.type === 'walker') drawWalker(g, e, camX); else drawFlyer(g, e, camX); }
      if (st.boss) drawBoss(g, st.boss, camX);
      for (i = 0; i < st.players.length; i++) { var p = st.players[i]; if (!p.alive) continue; if (p.id === 0) drawHog(g, p, camX); else drawHare(g, p, camX); }
      for (i = 0; i < st.particles.length; i++) { var pp = st.particles[i]; g.fillStyle = pp.c === 0 ? PAL.star : (pp.c === 1 ? PAL.box : '#fff'); g.fillRect(px((pp.x - camX) * SCALE), px(pp.y * SCALE), 2, 2); }

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(buf, 0, 0, bw, bh, 0, 0, W, H);
      drawHUD(ctx, st);
      drawBanner(ctx, st);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
