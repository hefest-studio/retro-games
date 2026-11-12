/* РОЙ · рендер 8-БИТ (retro). ROY.classic = { bg, draw, icon }
   Свой пиксель-арт: спрайты — массивы строк (символ = цвет из палитры спрайта),
   пререндер в offscreen-canvas ×3, повороты в пике — шагами по 22.5° (как в старых играх),
   ограниченная палитра, сканлайны. Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var R = global.ROY = global.ROY || {};
  var PX = 3; // размер «пикселя»

  // ---------- Спрайты (оригинальные) ----------
  var SPR = {
    ship: [[
      '.....a.....',
      '....aca....',
      '....aca....',
      '...aacaa...',
      '...aaaaa...',
      'b..aaaaa..b',
      'b.aaadaaa.b',
      'bbaaadaaabb',
      'baaaadaaaab',
      'b.aa.d.aa.b',
      '...o...o...'
    ], [
      '.....a.....',
      '....aca....',
      '....aca....',
      '...aacaa...',
      '...aaaaa...',
      'b..aaaaa..b',
      'b.aaadaaa.b',
      'bbaaadaaabb',
      'baaaadaaaab',
      'b.aa.d.aa.b',
      '...y...y...'
    ]],
    spore: [[
      'x....x....x',
      '.x.ggggg.x.',
      '..ggggggg..',
      '.gggwwwggg.',
      'xggwwewwggx',
      '.gggwwwggg.',
      '..ggggggg..',
      '.x.ggggg.x.',
      'x....x....x'
    ], [
      '.....x.....',
      '...ggggg...',
      'x.ggggggg.x',
      '.gggwwwggg.',
      'xggwwewwggx',
      '.gggwwwggg.',
      'x.ggggggg.x',
      '...ggggg...',
      '.....x.....'
    ]],
    wedge: [[
      'r.........r',
      'rr...k...rr',
      '.rr.kkk.rr.',
      '.rrrkykrrr.',
      '..rrkkkrr..',
      '...rrkrr...',
      '....rkr....',
      '.....r.....',
      '.....r.....'
    ], [
      '...........',
      'r....k....r',
      'rr..kkk..rr',
      '.rrrkykrrr.',
      '..rrkkkrr..',
      '...rrkrr...',
      '....rkr....',
      '.....r.....',
      '.....r.....'
    ]],
    medusa: [[
      '....mmmmm....',
      '..mmmmmmmmm..',
      '.mmmmmmmmmmm.',
      '.mmwwmmmwwmm.',
      'mmmwkmmmkwmmm',
      'mmmmmmmmmmmmm',
      'nmnmnmnmnmnmn',
      '.t.t..t..t.t.',
      't..t..t..t..t',
      't...t.t.t...t',
      '....t...t....'
    ], [
      '....mmmmm....',
      '..mmmmmmmmm..',
      '.mmmmmmmmmmm.',
      '.mmwwmmmwwmm.',
      'mmmwkmmmkwmmm',
      'mmmmmmmmmmmmm',
      'nmnmnmnmnmnmn',
      '.t.t..t..t.t.',
      '.t..t.t.t..t.',
      '..t.t...t.t..',
      '..t.......t..'
    ]]
  };
  // Ограниченная палитра (NES-подобные тона, свои сочетания)
  var PAL = {
    ship:    { a: '#fcfcfc', b: '#ea6a12', c: '#3cbcfc', d: '#7c7c9c', o: '#fca044', y: '#f8d878' },
    captive: { a: '#f87898', b: '#a80020', c: '#fcfcfc', d: '#7c2040', o: '#a80020', y: '#a80020' },
    spore:   { g: '#58d854', x: '#b8f818', w: '#fcfcfc', e: '#0c2c0c' },
    wedge:   { r: '#e40058', k: '#fca044', y: '#fcfcfc' },
    medusa:  { m: '#9878f8', n: '#6844fc', w: '#fcfcfc', k: '#000000', t: '#3cbcfc' },
    medusaH: { m: '#f878f8', n: '#d800cc', w: '#fcfcfc', k: '#000000', t: '#fca044' }
  };
  var STAR_COL = ['#fcfcfc', '#3cbcfc', '#f8d878', '#f87898', '#7c7c9c'];

  var cache = {};
  function sprite(name, frame, palName, scale) {
    scale = scale || PX;
    var key = name + frame + palName + scale;
    if (cache[key]) return cache[key];
    var rows = SPR[name][frame], pal = PAL[palName];
    var c = document.createElement('canvas'); c.width = rows[0].length * scale; c.height = rows.length * scale;
    var x = c.getContext('2d');
    for (var y = 0; y < rows.length; y++) for (var i = 0; i < rows[y].length; i++) {
      var ch = rows[y][i]; if (ch === '.' || !pal[ch]) continue;
      x.fillStyle = pal[ch]; x.fillRect(i * scale, y * scale, scale, scale);
    }
    cache[key] = c; return c;
  }
  function blit(ctx, img, x, y, ang) {
    ctx.save(); ctx.translate(Math.round(x), Math.round(y));
    if (ang) ctx.rotate(Math.round(ang / (Math.PI / 8)) * (Math.PI / 8)); // повороты шагами
    ctx.drawImage(img, -img.width / 2, -img.height / 2); ctx.restore();
  }

  // ---------- Фон: «пиксельные» звёзды ----------
  var stars = null, lastT = 0;
  function initStars(W, H) {
    stars = [];
    for (var i = 0; i < 70; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, v: 20 + Math.random() * 60, c: STAR_COL[i % STAR_COL.length], ph: Math.random() * 6 });
  }
  function bg(ctx, g) {
    var W = g.W, H = g.H; if (!stars) initStars(W, H);
    var dt = Math.min(0.1, Math.max(0, g.time - lastT)); lastT = g.time;
    ctx.fillStyle = '#000008'; ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i]; s.y += s.v * dt; if (s.y > H) { s.y = -4; s.x = Math.random() * W; }
      if (Math.sin(g.time * 3 + s.ph) < -0.6) continue; // мерцание
      ctx.fillStyle = s.c; var z = s.v > 55 ? 3 : 2;
      ctx.fillRect((s.x / 3 | 0) * 3, (s.y / 3 | 0) * 3, z, z);
    }
  }

  function txt(g, s, x, y, size, color, align) { g.text(s, x, y, { size: size, color: color, align: align || 'left', weight: 900 }); }

  // ---------- Кадр ----------
  function draw(ctx, st, g) {
    var W = st.W, i, e, fr = ((g.time * 3) | 0) % 2;
    bg(ctx, g);

    // луч Медузы — под ней
    for (i = 0; i < st.enemies.length; i++) {
      e = st.enemies[i];
      if (e.state === 'dive' && (e.sub === 'beam' || e.sub === 'hold')) beam(ctx, e, st, g);
    }
    // враги
    for (i = 0; i < st.enemies.length; i++) {
      e = st.enemies[i];
      if (e.state === 'dead' || e.state === 'wait') continue;
      var pal = e.kind === 'medusa' && e.hurt ? 'medusaH' : e.kind;
      var f = e.state === 'form' ? fr : ((g.time * 8) | 0) % 2;
      blit(ctx, sprite(e.kind, f, pal), e.x, e.y, e.ang);
      if (e.carry) {
        var ox = 26 * Math.sin(e.ang), oy = -26 * Math.cos(e.ang);
        blit(ctx, sprite('ship', 0, 'captive'), e.x + ox, e.y + oy, e.ang + Math.PI);
      }
    }
    if (st.captive) blit(ctx, sprite('ship', 0, 'captive'), st.captive.x, st.captive.y, st.captive.t * 9);
    if (st.rescue && ((g.time * 10) | 0) % 2) blit(ctx, sprite('ship', 0, 'ship'), st.rescue.x, st.rescue.y, 0);

    // пули
    ctx.fillStyle = '#fcfcfc';
    for (i = 0; i < st.pb.length; i++) { var b = st.pb[i]; ctx.fillStyle = '#fcfcfc'; ctx.fillRect(b.x - 1.5, b.y - 6, 3, 9); ctx.fillStyle = '#f8d878'; ctx.fillRect(b.x - 1.5, b.y - 6, 3, 3); }
    for (i = 0; i < st.eb.length; i++) { var q = st.eb[i]; ctx.fillStyle = fr ? '#fc7460' : '#fcfcfc'; ctx.fillRect(q.x - 1.5, q.y - 4, 3, 9); ctx.fillStyle = '#e40058'; ctx.fillRect(q.x - 1.5, q.y + 2, 3, 3); }

    // игрок
    var p = st.player;
    if (p.alive && !(p.inv > 0 && ((g.time * 12) | 0) % 2)) {
      var sf = ((g.time * 14) | 0) % 2;
      blit(ctx, sprite('ship', sf, 'ship'), p.x, st.PLAYER_Y, 0);
      if (p.dual) blit(ctx, sprite('ship', sf, 'ship'), p.x + st.HULL_GAP, st.PLAYER_Y, 0);
    }

    hud(ctx, st, g);
    banner(ctx, st, g);
    // сканлайны
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    for (var y = 0; y < st.H; y += 3) ctx.fillRect(0, y, W, 1);
  }

  function beam(ctx, e, st, g) {
    var top = e.y + 16, bottom = st.PLAYER_Y + 16;
    var k = e.sub === 'hold' ? 1 : Math.min(1, e.beamT / 0.8);
    var fade = e.sub === 'beam' && e.beamT > 2.7 ? Math.max(0, (3.2 - e.beamT) / 0.5) : 1;
    var len = (bottom - top) * k, band = 6, ph = ((g.time * 12) | 0);
    for (var y = 0, n = 0; y < len; y += band, n++) {
      var w = 10 + (st.BEAM_HALF * 2 - 10) * (y / (bottom - top));
      ctx.fillStyle = (n + ph) % 3 === 0 ? '#a4e4fc' : (n + ph) % 3 === 1 ? '#3cbcfc' : '#0058f8';
      ctx.globalAlpha = 0.75 * fade;
      ctx.fillRect(Math.round(e.x - w / 2), Math.round(top + y), Math.round(w), band - 2);
    }
    ctx.globalAlpha = 1;
  }

  function hud(ctx, st, g) {
    var W = st.W, best = Math.max(g.state.best || 0, st.score);
    txt(g, g.t('score').toUpperCase(), 12, 18, 12, '#f83800');
    txt(g, String(st.score), 12, 36, 18, '#fcfcfc');
    txt(g, g.t('best').toUpperCase(), W - 12, 18, 12, '#f83800', 'right');
    txt(g, String(best), W - 12, 36, 18, '#fcfcfc', 'right');
    txt(g, g.t('level').toUpperCase() + ' ' + st.wave + '/' + st.waves, W / 2, 26, 15, '#f8d878', 'center');
    // запасные корабли (без текущего)
    var res = Math.max(0, st.lives - (st.player.alive ? 1 : 0)), icon = sprite('ship', 0, 'ship', 2);
    for (var i = 0; i < Math.min(res, 6); i++) ctx.drawImage(icon, 10 + i * 26, st.H - 26);
    // флажки пройденных волн
    for (var w = 0; w < st.wave; w++) {
      var fx = W - 16 - w * 14, fy = st.H - 24;
      ctx.fillStyle = '#fcfcfc'; ctx.fillRect(fx, fy, 2, 16);
      ctx.fillStyle = w < st.wave - 1 || st.phase === 'clear' ? '#ea6a12' : '#7c7c9c'; ctx.fillRect(fx + 2, fy, 8, 6);
    }
  }

  function banner(ctx, st, g) {
    if (!st.banner) return;
    if (st.banner !== 'wave' && ((g.time * 4) | 0) % 2 === 0 && st.banner === 'captured') return; // мигает
    var s = st.banner === 'wave' ? g.t('wave') + ' ' + st.wave : g.t(st.banner);
    var col = st.banner === 'captured' ? '#e40058' : st.banner === 'twin' ? '#58d854' : '#f8d878';
    var y = st.H * 0.56;
    ctx.fillStyle = '#000008'; ctx.fillRect(0, y - 30, st.W, 44);
    ctx.fillStyle = '#ea6a12'; ctx.fillRect(0, y - 30, st.W, 3); ctx.fillRect(0, y + 11, st.W, 3);
    txt(g, s, st.W / 2, y, 24, col, 'center');
    if (st.banner === 'wave' && st.wave === 1) txt(g, g.t('controls'), st.W / 2, y + 36, 12, '#a4a4bc', 'center');
  }

  // Иконка для титульного экрана
  function icon(ctx, kind, x, y, g, frame) {
    var pal = kind === 'ship' ? 'ship' : kind;
    blit(ctx, sprite(kind, frame || 0, pal), x, y, 0);
  }

  R.classic = { bg: bg, draw: draw, icon: icon, _SPR: SPR };
})(typeof window !== 'undefined' ? window : globalThis);
