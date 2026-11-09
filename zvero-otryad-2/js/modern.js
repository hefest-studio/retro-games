/* ЗВЕРО-ОТРЯД · рендер НЕОН (modern) · ледяная палитра. Z.modern.draw(ctx, st)
   Тот же мир, но свечение/градиенты, параллакс, полное разрешение. */
(function (global) {
  'use strict';
  var Z = global.ZVERO2 = global.ZVERO2 || {};
  var TILE = 30;
  var C = {
    hog: '#ff9a3c', hogB: '#ff6a2c', hare: '#aee0ff', hareB: '#5aa6e0',
    box: '#8fd8f0', boxE: '#e0f6ff', walk: '#4df0ff', fly: '#eaf4ff',
    boss: '#6cff8a', bossEye: '#ffe24d', star: '#8fe8ff', door: '#ffb24d', door2: '#ffd89a'
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
    g.addColorStop(0, '#0a1428'); g.addColorStop(0.6, '#0f2038'); g.addColorStop(1, '#18384a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, st.viewW, st.viewH);
    ctx.fillStyle = 'rgba(90,160,200,.22)';
    var off = (st.camX * 0.3) % 240;
    for (var i = -1; i < st.viewW / 240 + 1; i++) {
      var mx = i * 240 - off;
      ctx.beginPath(); ctx.moveTo(mx, st.viewH); ctx.lineTo(mx + 120, st.viewH - 150); ctx.lineTo(mx + 240, st.viewH); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(200,235,255,.6)';
    for (var s = 0; s < 60; s++) {
      var sx = (((s * 131) % Math.max(1, st.pixelW)) - st.camX * 0.4);
      sx = ((sx % st.viewW) + st.viewW) % st.viewW;
      ctx.fillRect(sx, (s * 47) % (st.viewH - 120), 2, 2);
    }
  }
  function animal(ctx, p, camX, body, bodyB, ears) {
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return;
    var x = p.x - camX, y = p.y;
    var pg = ctx.createLinearGradient(x, y, x, y + p.h);
    pg.addColorStop(0, body); pg.addColorStop(1, bodyB);
    if (ears === 'spike') {
      ctx.save(); ctx.shadowColor = body; ctx.shadowBlur = 8; ctx.fillStyle = bodyB;
      for (var i = 0; i < p.w; i += 4) ctx.fillRect(x + i, y - 4, 2, 5); ctx.restore();
    } else if (ears === 'long') {
      ctx.save(); ctx.shadowColor = body; ctx.shadowBlur = 8; ctx.fillStyle = bodyB;
      ctx.fillRect(x + 2, y - 8, 3, 9); ctx.fillRect(x + p.w - 5, y - 8, 3, 9); ctx.restore();
    }
    glowRect(ctx, x, y, p.w, p.h, '#000', body, 14);
    ctx.fillStyle = pg; ctx.fillRect(x, y, p.w, p.h);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(x + 3, y + p.h * 0.55, p.w - 6, p.h * 0.32);
    ctx.fillStyle = '#10121a'; ctx.fillRect(p.dir > 0 ? x + p.w - 6 : x + 3, y + 4, 2, 3);
  }

  Z.modern = {
    draw: function (ctx, st) {
      var W = st.viewW, H = st.viewH, camX = st.camX || 0;
      ctx.imageSmoothingEnabled = true;
      bg(ctx, st);

      if (st.grid && st.grid.length) {
        var c0 = Math.floor(camX / TILE), c1 = Math.ceil((camX + W) / TILE);
        for (var r = 0; r < st.rows; r++) {
          var row = st.grid[r];
          for (var c = c0; c <= c1; c++) {
            if (c < 0 || c >= st.cols) continue;
            var ch = row[c]; if (ch !== '#' && ch !== '=') continue;
            var X = c * TILE - camX, Y = r * TILE;
            if (ch === '#') {
              var gg = ctx.createLinearGradient(X, Y, X, Y + TILE);
              gg.addColorStop(0, '#3a5570'); gg.addColorStop(1, '#1c3040');
              ctx.fillStyle = gg; ctx.fillRect(X, Y, TILE, TILE);
              ctx.fillStyle = 'rgba(150,200,240,.4)'; ctx.fillRect(X, Y, TILE, 2);
            } else {
              glowRect(ctx, X, Y, TILE, 6, '#5fe0d8', '#5fe0d8', 12);
              ctx.fillStyle = 'rgba(60,130,150,.5)'; ctx.fillRect(X, Y + 6, TILE, TILE - 6);
            }
          }
        }
      }

      if (st.door) {
        var d = st.door, dx = d.x - camX;
        var dg = ctx.createLinearGradient(dx, d.y, dx, d.y + d.h);
        dg.addColorStop(0, C.door); dg.addColorStop(1, C.door2);
        ctx.save(); ctx.shadowColor = d.open ? C.door : '#333'; ctx.shadowBlur = d.open ? 24 : 4;
        ctx.fillStyle = d.open ? dg : 'rgba(60,70,80,.6)'; ctx.fillRect(dx + 2, d.y + 2, d.w - 4, d.h - 4); ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(dx + d.w / 2 - 2, d.y + 6, 4, d.h - 12);
      }
      var i;
      for (i = 0; i < st.pickups.length; i++) {
        var k = st.pickups[i], kx = k.x - camX, ky = k.y + Math.sin(k.t * 3) * 3;
        glowRect(ctx, kx - 6, ky - 2, 12, 4, C.star, C.star, 14); glowRect(ctx, kx - 2, ky - 6, 4, 12, C.star, C.star, 14);
      }
      for (i = 0; i < st.boxes.length; i++) {
        var b = st.boxes[i], bxp = b.x - camX;
        glowRect(ctx, bxp, b.y, b.w, b.h, C.box, C.box, b.thrown ? 16 : 8);
        ctx.fillStyle = C.boxE; ctx.fillRect(bxp + 2, b.y + 2, b.w - 4, 2);
        ctx.fillStyle = 'rgba(120,70,20,.6)'; ctx.fillRect(bxp + b.w / 2 - 1, b.y + 2, 2, b.h - 4);
      }
      for (i = 0; i < st.enemies.length; i++) {
        var e = st.enemies[i], ex = e.x - camX;
        if (e.type === 'walker') { glowRect(ctx, ex, e.y, e.w, e.h, C.walk, C.walk, 14); ctx.fillStyle = '#fff3a0'; ctx.fillRect(ex + (e.dir > 0 ? e.w - 8 : 4), e.y + 5, 4, 4); }
        else { glowRect(ctx, ex, e.y, e.w, e.h, C.fly, C.fly, 16); ctx.fillStyle = '#201a00'; ctx.fillRect(ex + e.w / 2 - 2, e.y + 4, 4, 4); }
      }
      if (st.boss) {
        var bo = st.boss, box_ = bo.x - camX, flash = bo.hitFlash > 0 && Math.floor(bo.hitFlash * 20) % 2 === 0;
        glowRect(ctx, box_, bo.y, bo.w, bo.h, flash ? '#fff' : C.boss, C.boss, 22);
        ctx.fillStyle = C.bossEye; ctx.fillRect(box_ + 10, bo.y + 12, 8, 8); ctx.fillRect(box_ + bo.w - 18, bo.y + 12, 8, 8);
        ctx.fillStyle = 'rgba(40,20,10,.8)'; ctx.fillRect(box_, bo.y + bo.h * 0.6, bo.w, 4);
      }
      for (i = 0; i < st.players.length; i++) {
        var p = st.players[i]; if (!p.alive) continue;
        if (p.id === 0) animal(ctx, p, camX, C.hog, C.hogB, 'spike');
        else animal(ctx, p, camX, C.hare, C.hareB, 'long');
      }
      for (i = 0; i < st.particles.length; i++) { var pp = st.particles[i]; var col = pp.c === 0 ? C.star : (pp.c === 1 ? C.box : '#fff'); glowRect(ctx, pp.x - camX, pp.y, 3, 3, col, col, 8); }

      // HUD
      var t = Z.t;
      var hg = ctx.createLinearGradient(0, 0, 0, 38); hg.addColorStop(0, 'rgba(10,20,40,.92)'); hg.addColorStop(1, 'rgba(10,20,40,.2)');
      ctx.fillStyle = hg; ctx.fillRect(0, 0, W, 38);
      text(ctx, t('score') + ' ' + st.score, 14, 25, C.star, 16, 'left', C.star);
      text(ctx, t('best') + ' ' + st.hi, 210, 24, '#a8c8e0', 13);
      text(ctx, t('level') + ' ' + (st.level + 1), W / 2, 25, C.door, 16, 'center', C.door);
      text(ctx, t('lives') + ' ♥' + st.lives, W - 14, 25, '#ff8a6a', 16, 'right', '#ff6a4a');
      if (st.boss) {
        var bw = 170, bxp2 = W / 2 - bw / 2, ratio = Math.max(0, st.boss.hp / st.boss.hpMax);
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(bxp2, 42, bw, 8);
        glowRect(ctx, bxp2 + 1, 43, (bw - 2) * ratio, 6, '#ff5c4d', '#ff5c4d', 10);
        text(ctx, t('boss'), W / 2, 62, '#ffd0c0', 12, 'center', '#ff6a4a');
      }
      var msg = null, sub = null;
      if (st.phase === 'play' && st.intro > 0) { msg = t('ready') + ' ' + (st.level + 1); sub = t('go'); }
      else if (st.phase === 'levelclear') { msg = t('clear'); }
      if (msg) {
        ctx.fillStyle = 'rgba(8,16,30,.5)'; ctx.fillRect(0, H / 2 - 56, W, 112);
        text(ctx, msg, W / 2, H / 2, C.star, 44, 'center', C.star);
        if (sub) text(ctx, sub, W / 2, H / 2 + 36, C.door, 22, 'center', C.door);
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
