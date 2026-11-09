/* КОЛОБОК · рендер НЕОН (modern). K.modern.draw(ctx, st)
   Тот же мир, но свечение, градиенты и мягкий параллакс. Полное разрешение. */
(function (global) {
  'use strict';
  var K = global.KOLOBOK = global.KOLOBOK || {};

  var TILE = 40;
  var C = {
    body: '#ffe27a', bodyD: '#e0962a', face: '#2a1808',
    ground: '#1f6f3a', groundE: '#4df09a', plat: '#2a7f8f', platE: '#4df0ff',
    gate: '#b06b2a', gateE: '#ffc766', water: '#2f7de0', waterE: '#79e0ff',
    fire: '#ff6a2d', fireE: '#ffd23e', berry: '#ff3b6b', leaf: '#49f08a',
    key: '#ffd23e', plank: '#c79a5a', bucket: '#7ad4ff', fox: '#ff7a3d',
    home: '#ff9b5c', homeE: '#ffe0a0'
  };

  function glowRect(ctx, x, y, w, h, fill, glow, blur) {
    ctx.save(); if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = blur || 10; }
    ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.restore();
  }
  function glowCircle(ctx, x, y, r, fill, glow, blur) {
    ctx.save(); if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = blur || 12; }
    ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function text(ctx, s, x, y, col, size, align, glow) {
    ctx.save(); if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 10; }
    ctx.fillStyle = col; ctx.font = '800 ' + size + 'px "Segoe UI",system-ui,Arial,sans-serif';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y); ctx.restore();
  }

  function bg(ctx, st) {
    var g = ctx.createLinearGradient(0, 0, 0, st.viewH);
    g.addColorStop(0, '#0a1430'); g.addColorStop(0.6, '#102a3a'); g.addColorStop(1, '#0c2a1e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, st.viewW, st.viewH);
    // параллакс-деревья/холмы
    ctx.fillStyle = 'rgba(40,120,80,.22)';
    var off = (st.roomId * 70) % 200;
    for (var i = -1; i < st.viewW / 200 + 1; i++) {
      var mx = i * 200 - off + 100;
      ctx.beginPath(); ctx.moveTo(mx, st.viewH); ctx.lineTo(mx + 90, st.viewH - 150); ctx.lineTo(mx + 180, st.viewH); ctx.closePath(); ctx.fill();
    }
    // светлячки
    ctx.fillStyle = 'rgba(180,255,210,.5)';
    for (var s = 0; s < 40; s++) {
      var sx = (s * 137 + st.roomId * 53) % st.viewW;
      var sy = (s * 71) % (st.viewH - 140);
      ctx.fillRect(sx, sy + Math.sin((st.player ? st.player.roll : 0) + s) * 3, 2, 2);
    }
  }

  K.modern = {
    draw: function (ctx, st) {
      var W = st.viewW, H = st.viewH;
      ctx.imageSmoothingEnabled = true;
      bg(ctx, st);
      if (!st.grid || !st.grid.length) return;
      var tt = (st.player ? st.player.roll : 0);

      for (var r = 0; r < st.rows; r++) {
        var row = st.grid[r];
        for (var c = 0; c < st.cols; c++) {
          var ch = row[c]; if (ch === ' ' || ch === 'P') continue;
          var X = c * TILE, Y = r * TILE, cxp = X + TILE / 2, cyp = Y + TILE / 2;
          if (ch === '#') {
            var g = ctx.createLinearGradient(X, Y, X, Y + TILE);
            g.addColorStop(0, '#2a8f4a'); g.addColorStop(1, '#134a28');
            ctx.fillStyle = g; ctx.fillRect(X, Y, TILE, TILE);
            glowRect(ctx, X, Y, TILE, 3, C.groundE, C.groundE, 10);
          } else if (ch === '=') {
            glowRect(ctx, X, Y, TILE, 5, C.platE, C.platE, 12);
            ctx.fillStyle = 'rgba(40,120,150,.5)'; ctx.fillRect(X, Y + 5, TILE, TILE - 5);
          } else if (ch === 'D') {
            glowRect(ctx, X + 2, Y, TILE - 4, TILE, C.gate, C.gateE, 14);
            ctx.fillStyle = C.gateE; ctx.fillRect(X + 3, Y + TILE * 0.3, TILE - 6, 2); ctx.fillRect(X + 3, Y + TILE * 0.7, TILE - 6, 2);
          } else if (ch === '~') {
            var wg = ctx.createLinearGradient(X, Y, X, Y + TILE);
            wg.addColorStop(0, C.waterE); wg.addColorStop(1, C.water);
            ctx.save(); ctx.shadowColor = C.water; ctx.shadowBlur = 12; ctx.fillStyle = wg; ctx.fillRect(X, Y, TILE, TILE); ctx.restore();
          } else if (ch === '^') {
            var f = Math.sin(tt * 8 + c) * 3;
            glowCircle(ctx, cxp, cyp + f, TILE * 0.42, C.fire, C.fire, 20);
            glowCircle(ctx, cxp, cyp + 4 + f, TILE * 0.26, C.fireE, C.fireE, 14);
          } else if (ch === '*') {
            glowCircle(ctx, cxp, cyp + Math.sin(tt * 2 + c) * 3, 7, C.berry, C.berry, 16);
            ctx.fillStyle = C.leaf; ctx.fillRect(cxp - 1, cyp - 10, 2, 3);
          } else if (ch === 'k') { glowRect(ctx, cxp - 6, cyp - 5, 8, 8, C.key, C.key, 14); ctx.fillStyle = C.key; ctx.fillRect(cxp + 2, cyp - 2, 8, 4); }
          else if (ch === 'p') { glowRect(ctx, cxp - 12, cyp - 4, 24, 8, C.plank, C.plank, 12); }
          else if (ch === 'u') { glowRect(ctx, cxp - 7, cyp - 7, 14, 15, C.bucket, C.bucket, 16); }
        }
      }

      // дом
      if (st.goal) {
        var d = st.goal;
        glowRect(ctx, d.x + 3, d.y + d.h * 0.3, d.w - 6, d.h, C.home, C.home, 18);
        ctx.fillStyle = C.homeE; ctx.beginPath(); ctx.moveTo(d.x, d.y + d.h * 0.35); ctx.lineTo(d.x + d.w / 2, d.y); ctx.lineTo(d.x + d.w, d.y + d.h * 0.35); ctx.closePath(); ctx.fill();
        glowRect(ctx, d.x + d.w / 2 - 4, d.y + d.h * 0.55, 8, 8, C.key, C.key, 12);
      }

      // лисы
      for (var i = 0; i < st.enemies.length; i++) {
        var e = st.enemies[i];
        glowRect(ctx, e.x, e.y, e.w, e.h, C.fox, C.fox, 14);
        ctx.fillStyle = '#2a1206'; ctx.fillRect(e.dir > 0 ? e.x + e.w - 7 : e.x + 3, e.y + 5, 3, 3);
        ctx.fillStyle = '#fff'; ctx.fillRect(e.dir > 0 ? e.x + e.w - 4 : e.x, e.y + e.h / 2, 4, 3);
      }

      // колобок
      if (st.player && st.phase !== 'gameover') {
        var p = st.player;
        if (!(p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0)) {
          var pcx = p.x + p.w / 2, pcy = p.y + p.h / 2, pr = p.w / 2;
          var pg = ctx.createRadialGradient(pcx - 3, pcy - 3, 2, pcx, pcy, pr);
          pg.addColorStop(0, '#fff6c8'); pg.addColorStop(1, C.bodyD);
          ctx.save(); ctx.shadowColor = C.body; ctx.shadowBlur = 18;
          ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, Math.PI * 2); ctx.fill(); ctx.restore();
          // крошки вращения
          ctx.fillStyle = 'rgba(224,150,42,.9)';
          ctx.fillRect(pcx + Math.cos(p.roll) * (pr - 3) - 1.5, pcy + Math.sin(p.roll) * (pr - 3) - 1.5, 3, 3);
          // лицо
          var ex = p.dir > 0 ? 1 : -1;
          ctx.fillStyle = C.face;
          ctx.beginPath(); ctx.arc(pcx + ex * 2 - 3, pcy - 3, 1.6, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(pcx + ex * 2 + 3, pcy - 3, 1.6, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = C.face; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(pcx + ex, pcy + 3, 3, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
        }
      }

      // частицы
      for (i = 0; i < st.particles.length; i++) { var pp = st.particles[i]; glowRect(ctx, pp.x, pp.y, 3, 3, pp.c ? C.berry : C.fireE, pp.c ? C.berry : C.fireE, 8); }

      // HUD
      var t = K.t;
      var hg = ctx.createLinearGradient(0, 0, 0, 40); hg.addColorStop(0, 'rgba(8,20,16,.9)'); hg.addColorStop(1, 'rgba(8,20,16,.15)');
      ctx.fillStyle = hg; ctx.fillRect(0, 0, W, 40);
      text(ctx, t('berries') + ' ' + st.berries + '/' + st.totalBerries, 14, 26, C.berry, 16, 'left', C.berry);
      text(ctx, t('score') + ' ' + st.score, 210, 25, '#cfe7ff', 13);
      text(ctx, t('bag'), W / 2 - 74, 25, C.platE, 12, 'left', C.platE);
      for (i = 0; i < st.bag.length; i++) {
        var bx0 = W / 2 - 24 + i * 28;
        var col = st.bag[i] === 'key' ? C.key : st.bag[i] === 'plank' ? C.plank : C.bucket;
        glowRect(ctx, bx0, 11, 20, 18, col, col, 10);
      }
      for (var j = 0; j < st.lives; j++) glowCircle(ctx, W - 120 + j * 20, 20, 7, C.body, C.body, 10);

      // баннеры
      var msg = null, sub = null;
      if (st.phase === 'play' && st.intro > 0) { msg = t('ready') + ' ' + (st.roomId + 1); sub = t('go'); }
      if (st.flashT > 0 && st.flash === 'needberries') { msg = t('needberries'); }
      if (msg) {
        ctx.fillStyle = 'rgba(8,16,12,.5)'; ctx.fillRect(0, H / 2 - 46, W, 92);
        text(ctx, msg, W / 2, H / 2, C.fireE, 38, 'center', C.fireE);
        if (sub) text(ctx, sub, W / 2, H / 2 + 32, C.platE, 20, 'center', C.platE);
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
