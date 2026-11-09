/* ПЛАЩ · рендер НЕОН (modern). P.modern.draw(ctx, st)
   Тот же мир, но свечение/градиенты, параллакс, полное разрешение. */
(function (global) {
  'use strict';
  var P = global.PLASHCH = global.PLASHCH || {};

  var TILE = 30;
  var C = {
    cape: '#9b4dff', capeD: '#5a1fb0', body: '#30365e', bodyD: '#171a34',
    eye: '#4df0ff', emblem: '#ffd34d', mask: '#0e1022',
    walk: '#ff5c6e', shoot: '#ff9f43', fly: '#4dffc4',
    boss: '#ff5ca0', bossE: '#ffd34d',
    coin: '#ffd34d', medkit: '#4dffa0', bullet: '#eafcff', ebul: '#ff5c5c',
    door: '#b36bff', door2: '#4df0ff', rope: '#e8d9a8'
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
    g.addColorStop(0, '#0a0820'); g.addColorStop(0.6, '#140f33'); g.addColorStop(1, '#1f1240');
    ctx.fillStyle = g; ctx.fillRect(0, 0, st.viewW, st.viewH);
    // луна
    ctx.save(); ctx.shadowColor = '#e6dca0'; ctx.shadowBlur = 40;
    ctx.fillStyle = '#efe7b8'; ctx.beginPath(); ctx.arc(st.viewW - 90, 70, 26, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // силуэты зданий (параллакс)
    var off = (st.camX * 0.3) % 160;
    ctx.fillStyle = 'rgba(40,30,90,.55)';
    for (var i = -1; i < st.viewW / 160 + 1; i++) {
      var mx = i * 160 - off, bh2 = 120 + ((i * 53) % 90);
      ctx.fillRect(mx, st.viewH - bh2, 110, bh2);
    }
    // окна
    ctx.fillStyle = 'rgba(120,150,255,.18)';
    for (var w = -1; w < st.viewW / 160 + 1; w++) {
      var wx = w * 160 - off + 14;
      for (var yy = 0; yy < 5; yy++) ctx.fillRect(wx + (yy % 2) * 30, st.viewH - 40 - yy * 26, 8, 10);
    }
    // звёзды
    ctx.fillStyle = 'rgba(190,200,255,.5)';
    for (var s = 0; s < 70; s++) {
      var sx = (((s * 131) % st.pixelW) - st.camX * 0.4);
      sx = ((sx % st.viewW) + st.viewW) % st.viewW;
      ctx.fillRect(sx, (s * 47) % (st.viewH - 160), 2, 2);
    }
  }

  P.modern = {
    draw: function (ctx, st) {
      if (!st || !st.grid) return;
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
            g.addColorStop(0, '#2d2452'); g.addColorStop(1, '#16112e');
            ctx.fillStyle = g; ctx.fillRect(X, Y, TILE, TILE);
            ctx.fillStyle = 'rgba(150,90,230,.4)'; ctx.fillRect(X, Y, TILE, 2);
          } else {
            glowRect(ctx, X, Y, TILE, 6, '#4df0ff', '#4df0ff', 12);
            ctx.fillStyle = 'rgba(60,80,170,.5)'; ctx.fillRect(X, Y + 6, TILE, TILE - 6);
          }
        }
      }

      // крюки
      for (var ai = 0; ai < st.anchors.length; ai++) {
        var a = st.anchors[ai];
        glowRect(ctx, a.x - camX - 3, a.y - 3, 6, 6, C.rope, C.rope, 8);
        ctx.fillStyle = '#7a6f4a'; ctx.fillRect(a.x - camX - 1, a.y - 10, 2, 7);
      }
      // трос
      if (st.player && st.player.grapple.on) {
        var gr = st.player.grapple;
        ctx.save(); ctx.strokeStyle = C.rope; ctx.lineWidth = 2; ctx.shadowColor = C.rope; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.moveTo(gr.ax - camX, gr.ay);
        ctx.lineTo(st.player.x + st.player.w / 2 - camX, st.player.y + 3); ctx.stroke(); ctx.restore();
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
        else { glowRect(ctx, kx - 7, ky - 7, 14, 14, C.medkit, C.medkit, 16); ctx.fillStyle = '#063'; ctx.fillRect(kx - 1, ky - 4, 2, 8); ctx.fillRect(kx - 4, ky - 1, 8, 2); }
      }

      // враги
      for (i = 0; i < st.enemies.length; i++) {
        var e = st.enemies[i], ex = e.x - camX;
        if (e.type === 'walker') {
          glowRect(ctx, ex, e.y, e.w, e.h, C.walk, C.walk, 14);
          ctx.fillStyle = '#3a0010'; ctx.fillRect(ex + (e.dir > 0 ? e.w - 8 : 4), e.y + 5, 4, 4);
        } else if (e.type === 'shooter') {
          glowRect(ctx, ex, e.y, e.w, e.h, C.shoot, C.shoot, 14);
          ctx.fillStyle = '#3a2000'; ctx.fillRect(ex + (e.dir > 0 ? e.w - 7 : 3), e.y + 4, 4, 4);
          ctx.fillStyle = '#111'; ctx.fillRect(e.dir > 0 ? ex + e.w : ex - 4, e.y + e.h / 2, 4, 3);
        } else {
          glowRect(ctx, ex, e.y, e.w, e.h, C.fly, C.fly, 16);
          ctx.fillStyle = '#fff'; ctx.fillRect(ex + e.w / 2 - 2, e.y + 4, 4, 4);
        }
      }

      // босс
      if (st.boss) {
        var bo = st.boss, box = bo.x - camX;
        var flash = bo.invuln > 0 && Math.floor(bo.invuln * 20) % 2 === 0;
        glowRect(ctx, box, bo.y, bo.w, bo.h, flash ? '#ffffff' : C.boss, C.boss, 22);
        ctx.fillStyle = C.mask; ctx.fillRect(box + 4, bo.y + 4, bo.w - 8, bo.h * 0.28);
        ctx.save(); ctx.shadowColor = C.bossE; ctx.shadowBlur = 10; ctx.fillStyle = C.bossE;
        ctx.fillRect(box + 8, bo.y + 10, 8, 6); ctx.fillRect(box + bo.w - 16, bo.y + 10, 8, 6); ctx.restore();
        ctx.fillStyle = C.emblem; ctx.fillRect(box + bo.w / 2 - 4, bo.y + bo.h * 0.5, 8, 8);
      }

      // игрок
      if (st.player && st.phase !== 'gameover') {
        var p = st.player;
        if (!(p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0)) {
          var pxs = p.x - camX;
          // плащ
          var cbx = p.dir > 0 ? pxs - 5 : pxs + p.w - 1;
          glowRect(ctx, cbx, p.y + 2, 6, p.h - 2, C.cape, C.cape, 12);
          // корпус
          var pg = ctx.createLinearGradient(pxs, p.y, pxs, p.y + p.h);
          pg.addColorStop(0, C.body); pg.addColorStop(1, C.bodyD);
          glowRect(ctx, pxs, p.y, p.w, p.h, '#000', C.eye, 12);
          ctx.fillStyle = pg; ctx.fillRect(pxs, p.y, p.w, p.h);
          // маска
          ctx.fillStyle = C.mask; ctx.fillRect(pxs, p.y, p.w, Math.max(4, p.h * 0.3));
          ctx.save(); ctx.shadowColor = C.eye; ctx.shadowBlur = 8; ctx.fillStyle = C.eye;
          ctx.fillRect(p.dir > 0 ? pxs + p.w - 7 : pxs + 2, p.y + 3, 5, 3); ctx.restore();
          // эмблема
          ctx.fillStyle = C.emblem; ctx.fillRect(pxs + p.w / 2 - 2, p.y + p.h * 0.45, 4, 4);
        }
      }

      // пули игрока
      for (i = 0; i < st.bullets.length; i++) { var b = st.bullets[i]; ctx.save(); ctx.translate(b.x - camX, b.y); ctx.rotate(b.t * 18); ctx.shadowColor = C.bullet; ctx.shadowBlur = 10; ctx.fillStyle = C.bullet; ctx.fillRect(-5, -1.5, 10, 3); ctx.fillRect(-1.5, -5, 3, 10); ctx.restore(); }
      // пули врагов
      for (i = 0; i < st.ebullets.length; i++) { var eb = st.ebullets[i]; var sz = eb.big ? 7 : 5; glowRect(ctx, eb.x - camX - sz, eb.y - 2.5, sz * 2, 5, C.ebul, C.ebul, 12); }
      // частицы
      for (i = 0; i < st.particles.length; i++) { var pp = st.particles[i]; var col = pp.c ? C.emblem : C.ebul; glowRect(ctx, pp.x - camX, pp.y, 3, 3, col, col, 8); }

      // HUD
      var t = P.t;
      var hg = ctx.createLinearGradient(0, 0, 0, 38); hg.addColorStop(0, 'rgba(10,8,32,.9)'); hg.addColorStop(1, 'rgba(10,8,32,.15)');
      ctx.fillStyle = hg; ctx.fillRect(0, 0, W, 38);
      text(ctx, t('score') + ' ' + st.score, 14, 25, C.coin, 16, 'left', C.coin);
      text(ctx, t('best') + ' ' + st.hi, 200, 24, '#a7b0e0', 13);
      text(ctx, t('level') + ' ' + (st.level + 1), W / 2, 25, C.eye, 16, 'center', C.eye);
      for (var li = 0; li < st.lives; li++) glowRect(ctx, W - 150 + li * 18, 12, 11, 14, C.cape, C.cape, 8);
      var seg = 28, hxp = W - 150 - st.hpMax * seg;
      text(ctx, t('hp'), hxp - 6, 25, '#a7b0e0', 12, 'right');
      for (var h2 = 0; h2 < st.hpMax; h2++) glowRect(ctx, hxp + h2 * seg, 13, seg - 4, 12, h2 < st.hp ? '#ff5c6e' : 'rgba(80,60,110,.4)', h2 < st.hp ? '#ff5c6e' : null, 8);

      if (st.boss) {
        var bw = 300, bxp = (W - bw) / 2, ratio = Math.max(0, st.boss.hp / st.boss.hpMax);
        text(ctx, t('boss'), W / 2, 58, C.bossE, 14, 'center', C.bossE);
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(bxp, 62, bw, 9);
        glowRect(ctx, bxp + 1, 63, (bw - 2) * ratio, 7, '#ff5c6e', '#ff5c6e', 10);
      }

      // баннеры
      var msg = null, sub = null;
      if (st.phase === 'play' && st.intro > 0) { msg = (st.boss ? t('boss') : t('ready') + ' ' + (st.level + 1)); sub = t('go'); }
      else if (st.phase === 'levelclear') { msg = t('clear'); }
      if (msg) {
        ctx.fillStyle = 'rgba(8,6,26,.5)'; ctx.fillRect(0, H / 2 - 56, W, 112);
        text(ctx, msg, W / 2, H / 2, C.emblem, 44, 'center', C.emblem);
        if (sub) text(ctx, sub, W / 2, H / 2 + 36, C.eye, 22, 'center', C.eye);
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
