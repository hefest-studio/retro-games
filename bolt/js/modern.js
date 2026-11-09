/* БОЛТ · рендер НЕОН (modern). B.modern.draw(ctx, st)
   Тот же мир, но свечение/градиенты, полное разрешение. */
(function (global) {
  'use strict';
  var B = global.BOLT = global.BOLT || {};

  var TILE = 30;
  var C = {
    body: '#e9f2ff', bodyD: '#6a7bd0', accent: '#ff7a3d', visor: '#4df0ff',
    walk: '#49f08a', fly: '#ff5c9c', coin: '#ffdf5c', batt: '#4dffa0',
    bullet: '#fff07a', door: '#b36bff', door2: '#4df0ff'
  };

  function glowRect(ctx, x, y, w, h, fill, glow, blur) {
    ctx.save(); if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = blur || 10; }
    ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.restore();
  }
  function text(ctx, s, x, y, col, size, align, glow) {
    ctx.save(); if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 10; }
    ctx.fillStyle = col; ctx.font = '800 ' + size + 'px "Segoe UI",system-ui,Arial,sans-serif';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y); ctx.restore();
  }

  function bg(ctx, st) {
    var g = ctx.createLinearGradient(0, 0, 0, st.viewH);
    g.addColorStop(0, '#0a0f24'); g.addColorStop(0.6, '#10183a'); g.addColorStop(1, '#1a1140');
    ctx.fillStyle = g; ctx.fillRect(0, 0, st.viewW, st.viewH);
    // параллакс-«горы»
    ctx.fillStyle = 'rgba(80,60,160,.25)';
    var off = (st.camX * 0.3) % 240;
    for (var i = -1; i < st.viewW / 240 + 1; i++) {
      var mx = i * 240 - off;
      ctx.beginPath(); ctx.moveTo(mx, st.viewH); ctx.lineTo(mx + 120, st.viewH - 160); ctx.lineTo(mx + 240, st.viewH); ctx.closePath(); ctx.fill();
    }
    // звёзды
    ctx.fillStyle = 'rgba(180,200,255,.5)';
    for (var s = 0; s < 70; s++) {
      var sx = (((s * 131) % st.pixelW) - st.camX * 0.4);
      sx = ((sx % st.viewW) + st.viewW) % st.viewW;
      ctx.fillRect(sx, (s * 47) % (st.viewH - 120), 2, 2);
    }
  }

  B.modern = {
    draw: function (ctx, st) {
      var W = st.viewW, H = st.viewH, camX = st.camX;
      ctx.imageSmoothingEnabled = true;
      bg(ctx, st);

      // тайлы
      var c0 = Math.floor(camX / TILE), c1 = Math.ceil((camX + W) / TILE);
      for (var r = 0; r < st.rows; r++) {
        var row = st.grid[r];
        for (var c = c0; c <= c1; c++) {
          if (c < 0 || c >= st.cols) continue;
          var ch = row[c]; if (ch !== '#' && ch !== '=') continue;
          var X = c * TILE - camX, Y = r * TILE;
          if (ch === '#') {
            var g = ctx.createLinearGradient(X, Y, X, Y + TILE);
            g.addColorStop(0, '#3a2f5a'); g.addColorStop(1, '#1d1636');
            ctx.fillStyle = g; ctx.fillRect(X, Y, TILE, TILE);
            ctx.fillStyle = 'rgba(120,90,220,.4)'; ctx.fillRect(X, Y, TILE, 2);
          } else {
            glowRect(ctx, X, Y, TILE, 6, '#4df0ff', '#4df0ff', 12);
            ctx.fillStyle = 'rgba(60,90,160,.5)'; ctx.fillRect(X, Y + 6, TILE, TILE - 6);
          }
        }
      }

      // дверь
      if (st.door) {
      var d = st.door, dx = d.x - camX;
      var dg = ctx.createLinearGradient(dx, d.y, dx, d.y + d.h);
      dg.addColorStop(0, C.door); dg.addColorStop(1, C.door2);
      ctx.save(); ctx.shadowColor = C.door; ctx.shadowBlur = 24; ctx.fillStyle = dg;
      ctx.fillRect(dx + 2, d.y + 2, d.w - 4, d.h - 4); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(dx + d.w / 2 - 2, d.y + 6, 4, d.h - 12);
      }

      // пикапы
      for (var i = 0; i < st.pickups.length; i++) {
        var k = st.pickups[i], kx = k.x - camX, ky = k.y + Math.sin(k.t * 3) * 3;
        if (k.kind === 'coin') { glowRect(ctx, kx - 5, ky - 5, 10, 10, C.coin, C.coin, 14); }
        else { glowRect(ctx, kx - 6, ky - 8, 12, 16, C.batt, C.batt, 16); ctx.fillStyle = '#063'; ctx.fillRect(kx - 1, ky - 3, 2, 6); ctx.fillRect(kx - 3, ky, 6, 2); }
      }

      // враги
      for (i = 0; i < st.enemies.length; i++) {
        var e = st.enemies[i], ex = e.x - camX;
        if (e.type === 'walker') {
          glowRect(ctx, ex, e.y, e.w, e.h, C.walk, C.walk, 14);
          ctx.fillStyle = '#063018'; ctx.fillRect(ex + (e.dir > 0 ? e.w - 8 : 4), e.y + 5, 4, 4);
        } else {
          glowRect(ctx, ex, e.y, e.w, e.h, C.fly, C.fly, 16);
          ctx.fillStyle = '#fff'; ctx.fillRect(ex + e.w / 2 - 2, e.y + 4, 4, 4);
        }
      }

      // игрок
      if (st.player && st.phase !== 'gameover') {
        var p = st.player;
        if (!(p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0)) {
          var pg = ctx.createLinearGradient(p.x - camX, p.y, p.x - camX, p.y + p.h);
          pg.addColorStop(0, C.body); pg.addColorStop(1, C.bodyD);
          glowRect(ctx, p.x - camX, p.y, p.w, p.h, '#000', '#4df0ff', 14);
          ctx.fillStyle = pg; ctx.fillRect(p.x - camX, p.y, p.w, p.h);
          ctx.fillStyle = C.accent; ctx.fillRect(p.x - camX + 2, p.y + p.h * 0.45, p.w - 4, 3);
          ctx.save(); ctx.shadowColor = C.visor; ctx.shadowBlur = 8; ctx.fillStyle = C.visor;
          var vw = p.w * 0.55; ctx.fillRect(p.dir > 0 ? p.x - camX + p.w - vw - 2 : p.x - camX + 2, p.y + 4, vw, 4); ctx.restore();
        }
      }

      // пули
      for (i = 0; i < st.bullets.length; i++) { var b = st.bullets[i]; glowRect(ctx, b.x - camX - 5, b.y - 2, 10, 4, C.bullet, C.bullet, 12); }
      // частицы
      for (i = 0; i < st.particles.length; i++) { var pp = st.particles[i]; glowRect(ctx, pp.x - camX, pp.y, 3, 3, pp.c ? C.accent : C.bullet, pp.c ? C.accent : C.bullet, 8); }

      // HUD
      var t = B.t;
      var hg = ctx.createLinearGradient(0, 0, 0, 38); hg.addColorStop(0, 'rgba(10,14,36,.9)'); hg.addColorStop(1, 'rgba(10,14,36,.2)');
      ctx.fillStyle = hg; ctx.fillRect(0, 0, W, 38);
      text(ctx, t('score') + ' ' + st.score, 14, 25, C.coin, 16, 'left', C.coin);
      text(ctx, t('best') + ' ' + st.hi, 200, 24, '#9fb0d8', 13);
      text(ctx, t('level') + ' ' + (st.level + 1), W / 2, 25, C.visor, 16, 'center', C.visor);
      for (var li = 0; li < st.lives; li++) glowRect(ctx, W - 150 + li * 18, 12, 11, 14, C.visor, C.visor, 8);
      var bw = 120, bxp = W - 14 - bw, ratio = Math.max(0, st.charge / st.chargeMax);
      text(ctx, t('charge'), bxp - 6, 25, '#9fb0d8', 12, 'right');
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(bxp, 13, bw, 12);
      glowRect(ctx, bxp + 1, 14, (bw - 2) * ratio, 10, ratio > 0.3 ? C.batt : '#ff5c5c', ratio > 0.3 ? C.batt : '#ff5c5c', 10);

      // баннеры
      var msg = null, sub = null;
      if (st.phase === 'play' && st.intro > 0) { msg = t('ready') + ' ' + (st.level + 1); sub = t('go'); }
      else if (st.phase === 'levelclear') { msg = t('clear'); }
      if (msg) {
        ctx.fillStyle = 'rgba(8,10,26,.5)'; ctx.fillRect(0, H / 2 - 56, W, 112);
        text(ctx, msg, W / 2, H / 2, C.bullet, 44, 'center', C.bullet);
        if (sub) text(ctx, sub, W / 2, H / 2 + 36, C.visor, 22, 'center', C.visor);
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
