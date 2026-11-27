/* ДРУЖИНА · тема HD v2 («чиби HD-пиксель» на конвейере матриц палитры; v1 — фигуры из линий, «запечённые» в пиксели, — заменена).
   Весь мир рисуется в буфер 480×270 и растягивается ×2 без сглаживания (холст игры 960×540): фон этапа (js/hd-world.js),
   тени, бойцы, звери, бесы, предметы — блиттинг готовых кадров-матриц (js/hd-sprites.js + js/hd-poses.js), эффекты — пикселями палитры.
   Палитра — 16 цветов на всю тему (персонажи, фон, эффекты, HUD, шрифт); без полупрозрачности: затемнение — шахматкой или ступенью рампы.
   Тексты в теме — битмап-шрифтом 5×7 (js/hd-font.js) через g.text/g.overlay (только при теме hd; modern/retro не тронуты).
   Логика игры не меняется: позы выбираются по состоянию (как heroPose/foePose/bossPose в render.js), хит-стоп и тряска — в оболочке (main.js). DRUZHINA.hd */
(function (global) {
  'use strict';
  var D = global.DRUZHINA = global.DRUZHINA || {};
  var SP = D.hdSprites, WD = D.hdWorld, F = D.hdFont, PAL = SP.PAL, KEY = SP.KEY;
  var VW = 480, VH = 270, A = 2, TAU = Math.PI * 2;
  function C(ch) { return PAL[KEY[ch]]; }

  // ---------- Палитра интерфейса (только цвета палитры темы) ----------
  var P = {
    name: 'hd', hd: true, pixel: false,
    ink: C('W'), muted: C('m'), accent: C('o'), good: C('v'), bad: C('c'), warn: C('g'), boss: C('c'), magic: C('m'),
    panel: C('p'), panelHi: C('w'), rivet: C('c'), line: C('r'), hudBg: C('n'), barBg: C('k'), shadow: C('k'), outline: C('k'), hi: C('W'),
    hero: { zhdan: C('o'), secha: C('g'), olha: C('v') },
    font: '"Trebuchet MS", Verdana, system-ui, sans-serif'
  };

  // ---------- Кадр-матрица → холст (кэш: персонаж|кадр|вспышка|поворот) ----------
  var cache = {}, made = 0;
  function canvasOf(f, flash) {
    var c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
    var x = c.getContext('2d'), im = x.createImageData(f.w, f.h), d = im.data;
    for (var i = 0; i < f.a.length; i++) { var v = f.a[i]; if (!v) continue; if (flash && v !== 1) v = KEY.W; var h = PAL[v]; d[i * 4] = parseInt(h.slice(1, 3), 16); d[i * 4 + 1] = parseInt(h.slice(3, 5), 16); d[i * 4 + 2] = parseInt(h.slice(5, 7), 16); d[i * 4 + 3] = 255; }
    x.putImageData(im, 0, 0); made++; return c;
  }
  function flipC(c) { var o = document.createElement('canvas'); o.width = c.width; o.height = c.height; var x = o.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); return o; }
  function sprite(key, name, flash, rot, face) {
    var id = key + '|' + name + '|' + (flash ? 1 : 0) + '|' + (rot || 0) + '|' + (face < 0 ? 'L' : 'R'), c = cache[id];
    if (c) return c;
    if (face < 0) return (cache[id] = flipC(sprite(key, name, flash, rot, 1)));
    var set = SP.frames(key), f = set.f[name] || set.f.idle0;
    if (rot) f = SP.rotN(f, rot);
    return (cache[id] = canvasOf(f, flash));
  }
  function mcanvas(id, f, flash, face) {   // звери/бесы/предметы
    var k = id + '|' + (flash ? 1 : 0) + '|' + (face < 0 ? 'L' : 'R');
    if (cache[k]) return cache[k];
    return (cache[k] = face < 0 ? flipC(mcanvas(id, f, flash, 1)) : canvasOf(f, flash));
  }

  // ---------- Позы по состоянию ----------
  var SUF = { w: '_w', a: '_a', r: '_r' };
  function cyc(t, per, n, off) { return Math.floor(((t + (off || 0)) / per) % n + n) % n; }
  function downPose(e) { return !e.landed && e.h > 0 ? (e.vh > 0 ? 'fall0' : 'fall1') : 'down'; }
  function heroPose(h, t) {
    var st = h.state, mv = h.move;
    if (h.mount) return st === 'mountAtk' ? (h.phase === 'w' ? 'ride_w' : 'ride_a') : 'ride';
    if (st === 'atk' && mv) {
      var ph = h.phase || 'w', nm = mv.name;
      if (nm === 'dash') return ph === 'w' ? 'dash_w' : 'dash_a';
      if (nm === 'back') return ph === 'a' ? 'back_a' : 'back_w';
      if (nm === 'shot') return 'shoot' + SUF[ph];
      var s = mv.step || 0, base = h.hero === 'secha' ? ['swing', 'swing2', 'swing', 'over'][s] : ['swing', 'swing2', 'over'][s];
      return (base || 'swing') + SUF[ph];
    }
    if (st === 'jump') return h.airAtk > 0 ? 'air' : h.vh > 0 ? 'jump0' : 'jump1';
    if (st === 'walk') return h.running ? 'run' + cyc(t, 1 / 14, 6) : 'walk' + cyc(t, 1 / 9, 6);
    if (st === 'grab') return h.kneeT > 0 ? 'grabk' : 'grab';
    if (st === 'toss') return 'toss';
    if (st === 'hurt') return 'hurt';
    if (st === 'cast') return 'cast';
    if (st === 'rise') return h.st < 0.16 ? 'rise0' : 'rise1';
    if (st === 'down' || st === 'dead') return downPose(h);
    return 'idle' + cyc(t, 0.45, 2, h.id * 0.13);
  }
  function foePose(f, t, lk) {
    var st = f.state, c = SP.CH[lk];
    if (f.mount) return st === 'mountAtk' ? (f.phase === 'w' ? 'ride_w' : 'ride_a') : 'ride';
    if (st === 'atk') return c.atk + SUF[f.phase || 'w'];
    if (st === 'walk') return f.moving === false ? 'idle' + cyc(t, 0.45, 2, f.id * 0.13) : 'walk' + cyc(t, 1 / 8, 6, f.id * 0.07);
    if (st === 'leapWind') return 'crouch';
    if (st === 'leap') return 'air';
    if (st === 'guard') return 'guard';
    if (st === 'hurt' || st === 'thrown') return 'hurt';
    if (st === 'grabbed') return 'grabbed';
    if (st === 'rise') return f.st < 0.2 ? 'rise0' : 'rise1';
    if (st === 'down') return downPose(f);
    return 'idle' + cyc(t, 0.45, 2, f.id * 0.13);
  }
  function bossPose(b, t, lk) {
    var st = b.state, c = SP.CH[lk], ph = b.phase || 'w';
    if (c.rider) return st === 'atk' ? (ph === 'w' ? 'ride_w' : 'ride_a') : 'ride';
    if (st === 'atk') {
      var mv = b.move;
      if (mv === 'combo') return c.atk + SUF[ph];
      if (mv === 'charge') return ph === 'w' ? 'crouch' : 'dash_a';
      if (mv === 'slam') return ph === 'w' ? 'slam_w' : 'slam_a';
      if (mv === 'sweep') return ph === 'w' ? 'back_w' : 'back_a';
      if (mv === 'pour' || mv === 'summon') return 'cast';
      return c.atk + SUF[ph];
    }
    if (st === 'walk') return b.moving === false ? 'idle' + cyc(t, 0.5, 2) : 'walk' + cyc(t, 1 / 7, 6);
    if (st === 'hurt') return 'hurt';
    if (st === 'rise') return b.st < 0.25 ? 'rise0' : 'rise1';
    if (st === 'down') return downPose(b);
    return 'idle' + cyc(t, 0.5, 2);
  }

  // ---------- Пиксельные примитивы буфера ----------
  var b = null, bc = null;
  function px(c, x, y, w, h) { bc.fillStyle = c; bc.fillRect(Math.round(x), Math.round(y), w || 1, h || 1); }
  var shadows = {};
  function shadow(w) {
    if (shadows[w]) return shadows[w];
    var h = Math.max(3, Math.round(w / 4)), c = document.createElement('canvas'); c.width = w; c.height = h; var x = c.getContext('2d'); x.fillStyle = C('k');
    for (var y = 0; y < h; y++) { var t = (y + 0.5) / h * 2 - 1, half = Math.round(w / 2 * Math.sqrt(1 - t * t)); for (var xx = w / 2 - half; xx < w / 2 + half; xx++) if ((xx + y) % 2 === 0 || (y > 0 && y < h - 1 && Math.abs(xx - w / 2) < half - 2)) x.fillRect(xx, y, 1, 1); }
    return (shadows[w] = c);
  }
  function ellPx(cx, cy, rx, ry, col) { for (var y = -ry; y <= ry; y++) { var hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); if (hw > 0) px(col, cx - hw, cy + y, hw * 2, 1); } }
  // серп удара: пиксели по дуге, толщина ~ sin
  function arc(cx, cy, r, a0, a1, w, col, core) {
    var n = Math.max(8, Math.round(Math.abs(a1 - a0) * r));
    for (var i = 0; i <= n; i++) {
      var a = a0 + (a1 - a0) * i / n, ww = Math.max(1, Math.round(w * Math.sin(Math.PI * i / n)));
      var x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r), dx = -Math.cos(a), dy = -Math.sin(a);
      for (var k = 0; k < ww; k++) px(k === 0 || k === ww - 1 ? col : core || col, x + Math.round(dx * k), y + Math.round(dy * k), 1, 1);
    }
  }

  // ---------- Искры и частицы (в координатах мира) ----------
  var sparks = [], bits = [];
  function fx(type, d, S) {
    if (!S || !d || d.x == null) return;
    var y = D.logic.FLOOR_TOP + (d.z || 0) - (d.h || 0), t = S.time;
    function burst(col, n, sp, life, dy) { for (var i = 0; i < n; i++) { var a = (i / n) * TAU + Math.random(); bits.push({ x: d.x, y: y - (dy || 0), vx: Math.cos(a) * sp * (0.5 + Math.random()), vy: Math.sin(a) * sp * (0.5 + Math.random()) - sp * 0.4, t0: t, life: life, col: col }); } }
    if (type === 'hit') { sparks.push({ x: d.x, y: y - 6, t0: t, life: 0.18, big: d.knee ? 2 : 3, col: C('g') }); burst(C('g'), 5, 160, 0.25); }
    else if (type === 'block') { sparks.push({ x: d.x, y: y - 6, t0: t, life: 0.15, big: 2, col: C('m') }); burst(C('m'), 4, 120, 0.2); }
    else if (type === 'kill') { sparks.push({ x: d.x, y: y - 40, t0: t, life: d.boss ? 0.5 : 0.3, big: d.boss ? 6 : 4, col: d.boss ? C('c') : C('o') }); burst(d.boss ? C('o') : C('m'), d.boss ? 30 : 10, d.boss ? 260 : 140, d.boss ? 1 : 0.5, 40); }
    else if (type === 'thud') { sparks.push({ x: d.x, y: y + 2, t0: t, life: 0.3, big: d.big ? 3 : 2, col: C('m'), dust: true }); }
    else if (type === 'pickup') burst(d.kind === 'jug' ? C('m') : C('g'), 10, 90, 0.5, 10);
    else if (type === 'drop') burst(C('g'), 6, 80, 0.3, 30);
    else if (type === 'respawn') burst(C('W'), 18, 160, 0.5, 40);
    if (sparks.length > 24) sparks.shift(); if (bits.length > 140) bits.splice(0, bits.length - 140);
  }
  var STAR = {};
  function star(big, col) {
    var k = big + col; if (STAR[k]) return STAR[k];
    var L = 2 + big * 2, s = L * 2 + 5, c = document.createElement('canvas'); c.width = s; c.height = s; var x = c.getContext('2d'), m = (s >> 1);
    function plus(r, col2, th) { x.fillStyle = col2; x.fillRect(m - r, m - th, r * 2 + 1, th * 2 + 1); x.fillRect(m - th, m - r, th * 2 + 1, r * 2 + 1); }
    plus(L + 1, C('k'), 1); plus(L, col, 0); plus(Math.max(1, L >> 1), col, 1); x.fillStyle = C('W'); x.fillRect(m - 1, m - 1, 3, 3);
    x.fillStyle = col; for (var d = 1; d <= (L >> 1); d++) { x.fillRect(m - d - 1, m - d - 1, 1, 1); x.fillRect(m + d + 1, m - d - 1, 1, 1); x.fillRect(m - d - 1, m + d + 1, 1, 1); x.fillRect(m + d + 1, m + d + 1, 1, 1); }
    return (STAR[k] = c);
  }
  function drawSparks(S, cam) {
    var t = S.time, i;
    for (i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i], a = (t - s.t0) / s.life;
      if (a < 0 || a > 1) { if (a > 1 || a < -1) sparks.splice(i, 1); continue; }
      var x = (s.x - cam) / A, y = s.y / A;
      if (s.dust) { for (var j = 0; j < 6; j++) px(j % 2 ? C('m') : C('b'), x + (j - 2.5) * 4 * (0.5 + a) * s.big / 2, y - 2 - a * 6 - (j % 2) * 2, 2, 2); continue; }
      var img = star(Math.max(1, Math.round(s.big * (a < 0.35 ? 1 : 1 - (a - 0.35)))), s.col); bc.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));
    }
    for (i = bits.length - 1; i >= 0; i--) {
      var p = bits[i], q = t - p.t0; if (q < 0 || q > p.life) { bits.splice(i, 1); continue; }
      px(p.col, (p.x + p.vx * q - cam) / A, (p.y + p.vy * q + 300 * q * q) / A, 2, 2);
    }
  }

  // ---------- Магия (пикселями палитры) ----------
  function spell(sp, S, cam, FT) {
    var k = Math.min(1, sp.t / 0.5), lv = sp.level || 1, t = S.time; if (sp.t > 1.35) return;
    var targets = S.foes.filter(function (f) { return f.alive && f.kind !== 'imp' && f.x > cam - 20 && f.x < cam + 980; });
    var fire = [C('r'), C('c'), C('o'), C('g'), C('W')];
    if (sp.kind === 'forge') {
      var n = 3 + lv * 2;
      for (var i = 0; i < n; i++) {
        var x = (40 + (i + 0.5) * (880 / n)) / A, h = Math.round((30 + lv * 22) * k * (0.8 + 0.2 * Math.sin(t * 20 + i))), base = (FT + 90) / A;
        for (var y = 0; y < h; y += 2) { var w = Math.max(2, Math.round((1 - y / h) * 10 + Math.sin(t * 30 + y + i) * 2)), ci = Math.min(4, Math.floor(y / h * 5 + (y % 4 ? 0 : 1))); px(fire[ci], x - w / 2 + Math.round(Math.sin(t * 15 + y * 0.3 + i) * 2), base - y, w, 2); }
      }
      targets.forEach(function (f) { var sx = (f.x - cam) / A, sy = (FT + f.z) / A; for (var j = 0; j < 12; j += 2) px(fire[(j / 2 + Math.floor(t * 20)) % 5], sx - 5 + (j * 3) % 10, sy - 8 - j * 2 * k, 3, 3); });
    } else if (sp.kind === 'whirl') {
      for (var a = 0; a < 6 + lv * 3; a++) { var cx = (((a * 157 + t * 900) % 1100) - 70) / A, cy = (FT + 20 + (a * 53) % 160) / A - 15, r = 14 + lv * 3; arc(cx, cy, r, t * 12 + a, t * 12 + a + 2.2, 3, C('m'), C('W')); }
      targets.forEach(function (f) { var sx = (f.x - cam) / A, sy = (FT + f.z) / A; for (var q = 0; q < 3; q++) arc(sx, sy - 10 - q * 11, 13 - q * 2, t * 20 + q, t * 20 + q + 4, 2, C('W'), C('m')); });
    } else {
      for (var qq = 0; qq < 10 + lv * 4; qq++) { var rx = ((qq * 97) % 960) / A, ry = (FT + 10 + (qq * 41) % 170) / A, rh = Math.round((10 + lv * 5) * k); px(C('t'), rx, ry - rh, 2, rh); px(C('v'), rx - 1, ry - rh, 4, 2); }
      targets.forEach(function (f) {
        var sx = (f.x - cam) / A, sy = (FT + f.z) / A;
        for (var r2 = -2; r2 <= 2; r2++) { var hh = Math.round((20 + lv * 6) * k * (1 - Math.abs(r2) * 0.18)); for (var y2 = 0; y2 < hh; y2++) px(y2 > hh - 3 ? C('v') : r2 % 2 ? C('t') : C('n'), sx + r2 * 5 + Math.round(Math.sin(y2 * 0.4 + r2) * 1.5), sy - y2, 2, 1); px(C('v'), sx + r2 * 5 + 2, sy - hh * 0.6, 3, 1); }
      });
    }
  }
  function flames(sx, sy, face, reach, t, big) {
    var hx = sx + face * (big ? 52 : 40), hy = sy - (big ? 38 : 30), col = [C('c'), C('o'), C('g')];
    for (var j = 0; j < 8; j++) { var q = (j + (t * 8) % 1) / 8, x = hx + face * q * reach / A, r = Math.round(2 + q * 9), y = hy + Math.round(Math.sin(t * 20 + j) * 2 + q * 6);
      px(C('k'), x - r - 1, y - r - 1, r * 2 + 2, r * 2 + 2); px(col[j % 2], x - r, y - r, r * 2, r * 2); px(col[2], x - (r >> 1), y - (r >> 1), r, r); }
  }

  // ---------- Кадр мира ----------
  var stats = { frames: 0, ms: 0 };
  function bodyW(lk) { return SP.BODY[SP.CH[lk].body].big ? 34 : 26; }
  function blitFrame(key, name, flash, rot, face, X, Y) {
    var set = SP.frames(key), B = set.B, c = sprite(key, name, flash, rot, face);
    var fx0 = face < 0 ? B.FW - 1 - B.FX : B.FX;
    if (rot) { bc.drawImage(c, Math.round(X - c.width / 2), Math.round(Y - c.height + 6)); return; }
    bc.drawImage(c, Math.round(X - fx0), Math.round(Y - B.GR));
  }
  function world(g, ctx, S, Pz, o) {
    var t0 = global.performance ? performance.now() : 0;
    o = o || {};
    if (!b) { b = document.createElement('canvas'); b.width = VW; b.height = VH; bc = b.getContext('2d'); }
    bc.imageSmoothingEnabled = false;
    var L = D.logic, FT = L.FLOOR_TOP, cam = Math.round(S.cam), t = S.time, camV = Math.round(cam / A);
    WD.draw(bc, S.key || 'trakt', camV, t, !!o.dark);
    if (o.dark) { ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(b, 0, 0, VW, VH, 0, 0, g.W, g.H); ctx.restore(); return; }
    // пол: лужи расплава, волны
    S.puddles.forEach(function (p) {
      var sx = (p.x - cam) / A, sy = (FT + p.z) / A, r = p.r / A;
      if (p.warn > 0) { if (Math.floor(t * 10) % 2) for (var a = 0; a < 24; a++) px(C('o'), sx + Math.cos(a / 24 * TAU) * r, sy + Math.sin(a / 24 * TAU) * r * 0.4, 2, 1); }
      else { ellPx(Math.round(sx), Math.round(sy), Math.round(r + 1), Math.round(r * 0.4 + 1), C('k')); ellPx(Math.round(sx), Math.round(sy), Math.round(r), Math.round(r * 0.4), C('r')); ellPx(Math.round(sx), Math.round(sy), Math.round(r * 0.72), Math.round(r * 0.26), C('c')); ellPx(Math.round(sx), Math.round(sy - 1), Math.round(r * 0.4), 1, C('o')); px(C('g'), sx + Math.sin(t * 6) * r * 0.3 - 2, sy - 1, 4, 1); }
    });
    S.waves.forEach(function (w) { var sx = (w.x - cam) / A, sy = (FT + w.z) / A; for (var i = 0; i < 4; i++) { var h = 14 - i * 3; for (var y = 0; y < h; y++) px(i % 2 ? C('g') : C('c'), sx - w.dir * i * 4 - (h - y) / 3, sy - y, Math.max(1, Math.round((h - y) / 2)), 1); } });
    var bodies = [];
    S.heroes.forEach(function (h) { if (h.out || h.state === 'dead') return; bodies.push({ z: h.z, e: h, k: 'hero' }); });
    S.foes.forEach(function (f) { bodies.push({ z: f.z + (f.state === 'grabbed' ? 0.5 : 0), e: f, k: f.kind }); });
    S.mounts.forEach(function (m) { if (!m.rider) bodies.push({ z: m.z, e: m, k: 'mount' }); });
    S.items.forEach(function (it) { bodies.push({ z: it.z - 2, e: it, k: 'item' }); });
    // тени — пиксельные эллипсы шахматкой чернил
    bodies.forEach(function (bd) {
      var e = bd.e, sx = (e.x - cam) / A, sy = (FT + e.z) / A, w = 26;
      if (sx < -60 || sx > VW + 60) return;
      if (bd.k === 'item') w = 10; else if (bd.k === 'imp') w = 16; else if (bd.k === 'mount' || e.mount || (bd.k === 'boss' && e.def.rider)) w = 56;
      else if (bd.k === 'boss') w = 36; else if (bd.k === 'foe' && e.type === 'brute') w = 34; else if (bd.k === 'hero' && e.hero === 'zhdan') w = 28;
      var sh = shadow(w); bc.drawImage(sh, Math.round(sx - w / 2), Math.round(sy - sh.height / 2));
    });
    bodies.sort(function (p, q) { return p.z - q.z; });
    var smears = [];
    bodies.forEach(function (bd) {
      var e = bd.e, sx = (e.x - cam) / A, sy = (FT + e.z - e.h) / A, face = e.face || 1;
      if (sx < -80 || sx > VW + 80) return;
      if (bd.k === 'item') { var it = SP.ITEMS[e.kind] || SP.ITEMS.jug, bob = e.h > 0 ? 0 : Math.round(Math.sin(t * 4 + e.x) * 1); bc.drawImage(mcanvas('T' + e.kind, it, false, 1), Math.round(sx - it.w / 2), Math.round(sy - it.h - bob)); return; }
      if (bd.k === 'mount') { var bs = SP.beast(e.type === 'fire' ? 'fire' : 'tail', false), moving = e.state === 'spook' || e.st % 1.5 < 0.7, fr = moving ? bs.walk[cyc(t, 1 / 10, 6)] : bs.idle; drawBeast(fr, (moving ? 'W' + bs.walk.indexOf(fr) : 'I') + e.type, sx, sy, face, false); return; }
      if (bd.k === 'imp') { if (e.inv > 0 && Math.floor(t * 20) % 2) return; var fi = cyc(t, 1 / 14, 6), im = SP.imp(fi, e.bags); bc.drawImage(mcanvas('I' + fi + (e.bags > 1 ? 'b' : ''), im, e.flash > 0 || e.state === 'hurt', face), Math.round(sx - 22), Math.round(sy - 38)); return; }
      var blink = (bd.k === 'hero' && e.inv > 0 && e.state !== 'cast' && e.state !== 'down' && e.state !== 'rise' && Math.floor(t * 16) % 2) || (e.dying && e.landed && e.st > 0.4 && Math.floor(t * 14) % 2);
      if (blink) return;
      var lk, name, flash = e.flash > 0, rot = 0;
      if (bd.k === 'hero') { lk = e.hero; name = heroPose(e, t); }
      else if (bd.k === 'foe') { lk = SP.CH[e.type] ? e.type : 'shield'; name = foePose(e, t, lk); if (e.state === 'thrown') rot = ((Math.round(e.st * 12 / (Math.PI / 2)) % 4) + 4) % 4; }
      else { lk = e.type === 'twins' ? 'twins' + (e.twin || 0) : (SP.CH[e.type] ? e.type : 'voevoda'); name = bossPose(e, t, lk); }
      var mt = e.mount || (bd.k === 'boss' && e.def.rider ? { type: 'fire', boss: 1 } : null);
      if (mt) {
        var big = !!mt.boss, bst = SP.beast(mt.type === 'fire' ? 'fire' : 'tail', big), att = e.state === 'mountAtk' ? e.phase : (bd.k === 'boss' && e.move === 'breath' ? e.phase : '');
        var bf = att === 'w' ? bst.w : att === 'a' ? bst.a : e.state === 'walk' ? bst.walk[cyc(t, 1 / 10, 6)] : bst.idle;
        var bid = (att ? att : e.state === 'walk' ? 'W' + bst.walk.indexOf(bf) : 'I') + mt.type + (big ? 'B' : '');
        drawBeast(bf, bid, sx, sy, face, flash, function (sx0, sy0) {
          var set = SP.frames(lk), B = set.B, rx = face > 0 ? sx0 + bf.saddle[0] : sx0 + bf.W - 1 - bf.saddle[0];
          var c = sprite(lk, name, flash, 0, face), hx = face > 0 ? B.hip[0] : B.FW - 1 - B.hip[0];
          bc.drawImage(c, Math.round(rx - hx), Math.round(sy0 + bf.saddle[1] - B.hip[1] + 3));
        });
        if (mt.type === 'fire' && att === 'a') flames(sx, sy, face, bd.k === 'boss' ? 200 : 170, t, big);
      } else blitFrame(lk, name, flash, rot, face, sx, sy);
      // замах врага — «!» над головой
      if ((bd.k === 'foe' || bd.k === 'boss') && ((e.state === 'atk' || e.state === 'mountAtk') && e.phase === 'w' || e.state === 'leapWind') && Math.floor(t * 12) % 2) {
        var hy = sy - (bd.k === 'boss' ? 84 : mt ? 84 : 70) - (lk === 'brute' ? 10 : 0);
        px(C('k'), sx - 3, hy - 9, 6, 15); px(C('o'), sx - 1, hy - 7, 2, 7); px(C('o'), sx - 1, hy + 2, 2, 2);
      }
      if (bd.k === 'hero' && e.state === 'atk' && e.phase === 'a' && e.move) smears.push(e);
      if ((bd.k === 'foe' || bd.k === 'boss') && e.state === 'atk' && e.phase === 'a' && !mt) { var rr = (bd.k === 'boss' ? 34 : 26); arc(sx + face * 4, sy - 30, rr, face > 0 ? -0.9 : Math.PI - 0.5, face > 0 ? 0.5 : Math.PI + 0.9, 3, bd.k === 'boss' ? C('c') : C('r'), null); }
    });
    // смазы ударов героев — серп цвета героя
    smears.forEach(function (e) {
      var sx = (e.x - cam) / A, sy = (FT + e.z - e.h) / A, col = P.hero[e.hero], nm = e.move.name;
      if (nm === 'shot') return;
      if (nm === 'back') { arc(sx, sy - 34, 44, -Math.PI * 0.95, -Math.PI * 0.05, 5, col, C('W')); arc(sx, sy - 22, 44, Math.PI * 0.05, Math.PI * 0.95, 4, col, null); return; }
      var r = Math.max(22, (e.move.reach || 50) * 0.5), ov = e.move.step === 2 || (e.hero === 'secha' && e.move.step === 3);
      var a0 = ov ? -1.9 : -1.1, a1 = ov ? 0.9 : 0.7;
      if (e.face < 0) { var q0 = Math.PI - a1, q1 = Math.PI - a0; a0 = q0; a1 = q1; }
      arc(sx + e.face * 4, sy - 32, r, a0, a1, ov ? 7 : 5, col, C('W'));
    });
    // стрелы
    S.projs.forEach(function (p) {
      var sx = Math.round((p.x - cam) / A), sy = Math.round((FT + p.z - p.h) / A), d = p.vx > 0 ? 1 : -1;
      px(C('k'), Math.min(sx, sx - d * 16) - 1, sy - 2, 18, 4); px(C('o'), Math.min(sx, sx - d * 14), sy - 1, 14, 2); px(C('W'), d > 0 ? sx - 1 : sx - 2, sy - 2, 3, 4);
      px(C('v'), sx - d * 16 - 1, sy - 3, 3, 2); px(C('v'), sx - d * 16 - 1, sy + 1, 3, 2);
    });
    S.spells.forEach(function (sp) { spell(sp, S, cam, FT); });
    drawSparks(S, cam);
    var shake = o.shake || 0, shx = shake ? Math.round((Math.random() - 0.5) * shake / A) * A : 0, shy = shake ? Math.round((Math.random() - 0.5) * shake / A) * A : 0;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (shx || shy) { ctx.fillStyle = C('k'); ctx.fillRect(0, 0, g.W, g.H); }
    ctx.drawImage(b, 0, 0, VW, VH, shx, shy, g.W, g.H); ctx.restore();
    stats.frames++; if (global.performance) stats.ms += performance.now() - t0;
  }
  function drawBeast(bf, id, sx, sy, face, flash, rider) {
    var c = mcanvas('B' + id, bf.f, flash, face), x0 = Math.round(sx - (face > 0 ? bf.X : bf.W - 1 - bf.X)), y0 = Math.round(sy - bf.GR);
    bc.drawImage(c, x0, y0); if (rider) rider(x0, y0);
  }
  // портрет героя (заставка, выбор): кадр из того же набора, целый масштаб
  function portrait(ctx, Pz, key, x, y, s, t, ps) {
    var name = ps === 'over' ? 'over_a' : ps === 'shoot' ? 'shoot_w' : 'idle' + cyc(t || 0, 0.45, 2), set = SP.frames(key), B = set.B, c = sprite(key, name, false, 0, 1);
    var k = s >= 1.3 ? 3 : 2; ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, Math.round((x - B.FX * k) / 2) * 2, Math.round((y - B.GR * k) / 2) * 2, c.width * k, c.height * k); ctx.restore();
  }

  // ---------- Тексты и оверлеи движка — пиксельным шрифтом (только в теме hd) ----------
  var dith = null;
  function dim(g, ctx) {
    if (!dith) { var c = document.createElement('canvas'); c.width = 4; c.height = 4; var x = c.getContext('2d'); x.fillStyle = C('k'); x.fillRect(0, 0, 2, 2); x.fillRect(2, 2, 2, 2); dith = ctx.createPattern(c, 'repeat'); }
    ctx.fillStyle = dith; ctx.fillRect(0, 0, g.W, g.H);
  }
  function install(g) {
    var baseText = g.text, baseOverlay = g.overlay;
    g.text = function (s, x, y, o) {
      if (this.themeName !== 'hd') return baseText.apply(this, arguments);
      o = o || {}; F.draw(this.ctx, s, x, y, { size: o.size, color: o.color || this.th().ink, align: o.align, baseline: o.baseline, maxWidth: o.maxWidth, wrap: o.wrap, ink: P.outline, shadow: o.shadow });
    };
    g.overlay = function (title, sub, color) {
      if (this.themeName !== 'hd') return baseOverlay.apply(this, arguments);
      var th = this.th(); dim(this, this.ctx);
      this.text(title, this.W / 2, this.H / 2 - 30, { size: 60, align: 'center', color: color || th.accent, maxWidth: this.W - 48 });
      if (sub) this.text(sub, this.W / 2, this.H / 2 + 24, { size: 16, align: 'center', color: th.muted, maxWidth: this.W - 48 });
    };
  }

  // ---------- Прогрев (кадры персонажей → холсты), порциями ----------
  var warmQ = [], warmOn = false;
  function warm() {
    if (warmOn || warmQ.length || typeof setTimeout === 'undefined') return;
    Object.keys(SP.CH).forEach(function (k) { warmQ.push(k); });
    warmOn = true;
    (function step() {
      var t0 = Date.now();
      while (warmQ.length && Date.now() - t0 < 8) {
        var k = warmQ.shift(), set = SP.frames(k);
        Object.keys(set.f).forEach(function (n) { sprite(k, n, false, 0, 1); sprite(k, n, false, 0, -1); });
      }
      if (warmQ.length) setTimeout(step, 30); else warmOn = false;
    })();
  }

  D.hd = { P: P, world: world, portrait: portrait, fx: fx, warm: warm, install: install, dim: dim, heroPose: heroPose, foePose: foePose, bossPose: bossPose,
    stats: function () { return { canvases: made, worldMs: stats.frames ? +(stats.ms / stats.frames).toFixed(2) : 0, frames: stats.frames, warmLeft: warmQ.length }; },
    resetStats: function () { stats.frames = 0; stats.ms = 0; } };
})(typeof window !== 'undefined' ? window : globalThis);
