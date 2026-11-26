/* ДРУЖИНА · тема HD («HD-пиксель», пилот): крупный пиксель высокой детализации поверх тех же поз и логики.
   Спрайты не рисуются каждый кадр: фигура (js/render.js → figure/beast/imp/item) один раз «запекается» в offscreen-canvas
   в разрешении арта (1 пиксель арта = 2 пикселя поля 960×540), затем обрабатывается попиксельно: порог альфы (без сглаживания),
   привязка к палитре темы, свет сверху / тень снизу со сдвигом оттенка, неоновый контровой свет со спины и толстый тёмный контур.
   Кадры кешируются (атлас: idle, шаг, бег, удары 1–3, прыжок, удар в прыжке, урон, падение, захват, бросок, «спина», магия,
   езда; враги и боссы — их позы), прогреваются в фоне при включении темы, недостающие — лениво (не больше BAKE_MAX за кадр).
   Кадр мира: фон этапа рисуется в буфер 480×270 и растягивается ×2 без сглаживания (+ детали HD: пар, неоновая кромка, пыль), фигуры — блиттинг атласа, эффекты (смазы ударов, искры, стрелы, магия, пламя) — во второй буфер ×2.
   Логика игры не меняется: хит-стоп и тряска — только в оболочке (js/main.js) и только в этой теме. DRUZHINA.hd */
(function (global) {
  'use strict';
  var D = global.DRUZHINA = global.DRUZHINA || {};
  var R = D.render, PI = Math.PI, sin = Math.sin, cos = Math.cos, TAU = PI * 2;
  var A = 2;            // размер пикселя арта в пикселях поля
  var HK = 1.25;        // HD-фигуры крупнее modern: герой ≈ 1/4 высоты экрана, боссы — до ~0.4
  var BAKE_MAX = 2;     // ленивых «запеканий» за кадр (остальное — ближайший готовый кадр), чтобы не было рывков на телефоне

  // ---------- Палитра интерфейса и мира ----------
  var P = {
    name: 'hd', hd: true, pixel: false, bands: 7,
    ink: '#fff3dc', muted: '#c0a8b4', accent: '#ffb53a', good: '#6dff8e', bad: '#ff4a5e', warn: '#ffd83a', boss: '#ff5a2a', magic: '#4ae8ff',
    panel: '#22142a', panelHi: '#3a2440', rivet: '#c8783a', line: '#e07a2e', hudBg: '#160c1a', barBg: '#3a2236', shadow: 'rgba(16,4,24,.5)', outline: '#140a12',
    hero: { zhdan: '#ff8a2a', secha: '#3ae4ff', olha: '#9cff4a' },
    font: '"Trebuchet MS", Verdana, system-ui, sans-serif'
  };
  // неоновая кромка горизонта и цвет пара — по этапам (мир Гефеста: медь, горн, пар)
  var STAGE = {
    trakt: { neon: '#ffb53a', steam: '#fff0d8', dust: '#e8c890' }, village: { neon: '#ff7a3a', steam: '#ffe8d0', dust: '#d8b080' },
    forest: { neon: '#8cff6a', steam: '#d8ffe8', dust: '#a8d890' }, crossing: { neon: '#4ae8ff', steam: '#e0f8ff', dust: '#a8d8e8' },
    walls: { neon: '#ff5a9a', steam: '#f0e0ff', dust: '#c8b0d8' }, foundry: { neon: '#ff6a1a', steam: '#ffd8b0', dust: '#ff9a4a' },
    camp: { neon: '#ffb53a', steam: '#ffe8c8', dust: '#ffcf7a' }
  };

  // ---------- Цвет ----------
  function hex2(c) { if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
  function hexOf(r, g, b) { return '#' + [r, g, b].map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  // «сочнее»: насыщенность ×1.4, контраст ×1.12 (кожа — мягче)
  function vivid(c, soft) {
    var a = hex2(c), r = a[0] / 255, g = a[1] / 255, b = a[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, s = 0, h = 0, d = mx - mn;
    if (d) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
    s = Math.min(1, s * (soft ? 1.12 : 1.4) + (soft ? 0 : 0.04)); l = Math.max(0.04, Math.min(0.94, 0.5 + (l - 0.5) * 1.12));
    function f(n) { var k = (n + h * 12) % 12, q = s * Math.min(l, 1 - l); return l - q * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }
    return hexOf(f(0) * 255, f(8) * 255, f(4) * 255);
  }
  var LOOK = {};
  Object.keys(R.LOOK).forEach(function (k) {
    var o = {}, src = R.LOOK[k];
    Object.keys(src).forEach(function (f) { var v = src[f]; o[f] = typeof v === 'string' && v[0] === '#' ? vivid(v, f === 'skin') : v; });
    LOOK[k] = o;
  });
  // палитра привязки пикселей: цвета обликов, их тени (дальние руки/ноги) и постоянные цвета оружия/зверей/предметов
  var palList = [], seen = {};
  function addPal(c) { if (typeof c !== 'string' || c[0] !== '#' || seen[c]) return; seen[c] = 1; palList.push(hex2(c)); }
  Object.keys(LOOK).forEach(function (k) { var o = LOOK[k]; Object.keys(o).forEach(function (f) { var v = o[f]; if (typeof v === 'string' && v[0] === '#') { addPal(v); addPal(R.shade(v, 0.72)); addPal(R.shade(v, 0.8)); } }); });
  ['#c8ccd4', '#7a5232', '#8a8f9a', '#d8dde4', '#2c282e', '#ff6a1a', '#ff9a3a', '#dfe6ee', '#e0c8a0', '#d6b050', '#6a5a40', '#8a5a2a', '#e8e0c8', '#4a3a2a', '#6a6f7a',
    '#9aa0aa', '#b8bec8', '#5a606a', '#6a4a2a', '#4e535e', '#3a3a3a', '#111111', '#1a1414', '#ffffff', '#2a1a20', '#d8322a', '#e8dcc0', '#8a6a4a', '#2a262c', '#3a3236', '#e6eef4', '#94b0c2',
    '#b8402a', '#5f8a3a', '#f0a050', '#c8d070', '#ffcf5a', '#3a5a24', '#5a3420', '#d8a24a', '#ffe060', '#c8b070', '#ffb030', '#ff6020', '#fff0a0',
    '#a07a48', '#5a8ad8', '#2a2050', '#4a3a8a', '#3a6ad0', '#2a4a9a', '#9ad0ff', '#d8b860', '#c8823a', '#f0c070', '#b8702a', '#e0a050', '#8a4a1a'].forEach(function (c) { addPal(vivid(c)); addPal(R.shade(vivid(c), 0.72)); });
  addPal(P.outline);
  var snapMemo = new Map();
  function snap(r, g, b) {
    var key = (r << 16) | (g << 8) | b, v = snapMemo.get(key); if (v !== undefined) return v;
    var best = 0, bd = 1e9;
    for (var i = 0; i < palList.length; i++) { var p = palList[i], dr = r - p[0], dg = g - p[1], db = b - p[2], d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11; if (d < bd) { bd = d; best = i; } }
    v = palList[best]; snapMemo.set(key, v); return v;
  }
  var PB = Object.assign({}, P, { recolor: function (c) { return vivid(c, true); }, _rc: {} });   // палитра фонов: та же, но цвета фона — «сочнее»
  var OL = hex2(P.outline), RIM = hex2('#5ae0ff'), SH = hex2('#3a0a4a'), HI = hex2('#fff2c8');

  // ---------- Запекание кадра ----------
  // кадр рисуется лицом вправо в canvas арта, якорь (ax, ay) — точка у ног; отражение — при блиттинге
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function process(cv) {
    var w = cv.width, h = cv.height, cx = cv.getContext('2d'), id = cx.getImageData(0, 0, w, h), d = id.data, n = w * h;
    var m = new Uint8Array(n), dark = new Uint8Array(n), i, j, x, y, o;
    for (i = 0; i < n; i++) {
      o = i * 4; if (d[o + 3] < 110) { d[o + 3] = 0; continue; }
      d[o + 3] = 255; var p = snap(d[o], d[o + 1], d[o + 2]); d[o] = p[0]; d[o + 1] = p[1]; d[o + 2] = p[2]; m[i] = 1;
      if (p[0] * 0.3 + p[1] * 0.59 + p[2] * 0.11 < 46) dark[i] = 1;
    }
    var src = new Uint8ClampedArray(d);   // свет/тень считаем по исходнику, пишем в d
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
      i = y * w + x; if (!m[i] || dark[i]) continue; o = i * 4;
      var up = !m[i - w] || dark[i - w], dn = !m[i + w] || dark[i + w], bk = !m[i - 1] || dark[i - 1], up2 = y > 1 && (!m[i - 2 * w] || dark[i - 2 * w]);
      var r = src[o], gg = src[o + 1], b = src[o + 2];
      if (up) { r += (HI[0] - r) * 0.42; gg += (HI[1] - gg) * 0.42; b += (HI[2] - b) * 0.42; }
      else if (up2) { r += (HI[0] - r) * 0.16; gg += (HI[1] - gg) * 0.16; b += (HI[2] - b) * 0.16; }
      else if (bk) { r += (RIM[0] - r) * 0.5; gg += (RIM[1] - gg) * 0.5; b += (RIM[2] - b) * 0.5; }   // неоновый контровой свет со спины
      else if (dn) { r = r * 0.62 + SH[0] * 0.2; gg = gg * 0.62 + SH[1] * 0.2; b = b * 0.62 + SH[2] * 0.2; }
      d[o] = r; d[o + 1] = gg; d[o + 2] = b;
    }
    for (j = 0; j < 2; j++) {   // контур: 1 px арта снаружи (= 2 px поля), второй проход — только по диагоналям для «жирного» угла
      var mm = m.slice();
      for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
        i = y * w + x; if (mm[i]) continue;
        var hit = j === 0 ? (mm[i - 1] || mm[i + 1] || mm[i - w] || mm[i + w]) : (mm[i - w - 1] && mm[i + w + 1] || mm[i - w + 1] && mm[i + w - 1]);
        if (!hit) continue; o = i * 4; d[o] = OL[0]; d[o + 1] = OL[1]; d[o + 2] = OL[2]; d[o + 3] = 255; m[i] = 1;
      }
    }
    // обрезка по содержимому
    var x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (m[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    cx.putImageData(id, 0, 0);
    if (x1 < 0) return { c: mk(1, 1), x0: 0, y0: 0 };
    var out = mk(x1 - x0 + 1, y1 - y0 + 1); out.getContext('2d').drawImage(cv, -x0, -y0);
    return { c: out, x0: x0, y0: y0 };
  }
  var cache = new Map(), bakedThisFrame = 0, bakeMs = 0, bakeN = 0, scratch = {};
  function scratchCanvas(w, h) { var k = w + 'x' + h; var c = scratch[k]; if (!c) { c = scratch[k] = mk(w, h); } var cx = c.getContext('2d'); cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, w, h); return c; }
  // box — [xmin, xmax, ymin, ymax] в единицах рисовальщика (до масштаба), sc — масштаб рисовальщика → арт
  function bake(key, box, sc, draw, force) {
    var e = cache.get(key); if (e) return e;
    if (!force && bakedThisFrame >= BAKE_MAX) return null;
    var t0 = global.performance ? performance.now() : 0;
    var w = Math.ceil((box[1] - box[0]) * sc) + 6, h = Math.ceil((box[3] - box[2]) * sc) + 6, ax = Math.round(-box[0] * sc) + 3, ay = Math.round(-box[2] * sc) + 3;
    var cv = scratchCanvas(w, h), cx = cv.getContext('2d');
    draw(cx, ax, ay);
    var r = process(cv);
    e = { c: r.c, ox: ax - r.x0, oy: ay - r.y0, w: r.c.width, h: r.c.height, white: null };
    cache.set(key, e); bakedThisFrame++; bakeN++; if (global.performance) bakeMs += performance.now() - t0;
    return e;
  }
  function whiteOf(e) {
    if (e.white) return e.white;
    var c = mk(e.w, e.h), cx = c.getContext('2d'); cx.drawImage(e.c, 0, 0); cx.globalCompositeOperation = 'source-atop'; cx.fillStyle = 'rgba(255,250,235,.78)'; cx.fillRect(0, 0, e.w, e.h);
    return (e.white = c);
  }
  // блиттинг: (x, y) — точка якоря на поле; kx/ky — растяжка кадра удара
  function blit(ctx, e, x, y, face, flash, kx, ky, k) {
    if (!e) return false;
    k = k || A; kx = kx || 1; ky = ky || 1;
    var img = flash ? whiteOf(e) : e.c;
    ctx.save(); ctx.translate(Math.round(x / A) * A, Math.round(y / A) * A); if (face < 0) ctx.scale(-1, 1);
    if (kx !== 1 || ky !== 1) ctx.scale(kx, ky);
    ctx.drawImage(img, -e.ox * k, -e.oy * k, e.w * k, e.h * k);
    ctx.restore(); return true;
  }

  // ---------- Кадры фигур ----------
  var FBOX = [-130, 170, -185, 62];
  var CYC = { idle: [TAU / 3, 4], walk: [TAU / 10, 8], run: [TAU / 17, 8] };
  function frameT(pose, mp, t) {   // время → номер кадра
    var c = CYC[pose];   // циклы — только idle/шаг/бег; позы ударов, прыжка, урона — статичные кадры
    if (!c) return [0, 0];
    var q = Math.floor(((t % c[0]) + c[0]) % c[0] / c[0] * c[1]) % c[1];
    return [q, q * c[0] / c[1]];
  }
  function figKey(lk, o, sc) {
    var ft = frameT(o.pose, o.mp, o.t || 0), phq = o.mp === 'r' ? Math.min(2, Math.floor((o.ph || 0) * 3)) : 0;
    var spq = o.spin ? ((Math.round(o.spin / (PI / 4)) % 8) + 8) % 8 : -1;
    return { key: 'F|' + lk + '|' + sc + '|' + o.pose + '|' + (o.mp || '') + '|' + phq + '|' + ft[0] + '|' + (o.lying ? 1 : 0) + '|' + spq + '|' + (o.knee ? 1 : 0),
      t: ft[1], ph: phq / 3 + 0.17, spin: spq < 0 ? 0 : spq * PI / 4 };
  }
  function figSprite(lk, o, scaleK, force) {
    var look = LOOK[lk], sc = scaleK || (R.GS * HK / A), q = figKey(lk, o, sc);
    var ls = sc * (look.s || 1);
    return bake(q.key, FBOX, ls, function (cx, ax, ay) {
      R.figure(cx, P, { x: ax, y: ay, face: 1, look: look, pose: o.pose, mp: o.mp, ph: q.ph, t: q.t, lying: o.lying, spin: q.spin, knee: o.knee, flash: 0, s: sc });
    }, force);
  }
  var BBOX = [-115, 92, -100, 34];
  function beastSprite(type, moving, att, t, s, force) {
    var wq = moving ? Math.floor(((t * 12 / TAU) % 1 + 1) % 1 * 6) : 0, tq = att === 'a' && type !== 'fire' ? Math.floor(((t * 30 / TAU) % 1 + 1) % 1 * 4) : 0;
    var tt = moving ? wq / 6 * TAU / 12 : tq / 4 * TAU / 30, sc = s / A, key = 'B|' + type + '|' + sc + '|' + wq + '|' + tq + '|' + att + '|' + (moving ? 1 : 0);
    return bake(key, BBOX, sc, function (cx, ax, ay) { R.beast(cx, P, { type: type, face: 1 }, ax, ay, tt, { s: sc, moving: moving, att: att, noFlame: true, saddle: true }); }, true);
  }
  function impSprite(f, t, force) {
    var rq = Math.floor(((t * 18 / TAU) % 1 + 1) % 1 * 6), sc = R.GS * HK / A, bags = f.bags > 1 ? 1 : 0, key = 'I|' + rq + '|' + bags;
    return bake(key, [-34, 26, -50, 6], sc, function (cx, ax, ay) { R.imp(cx, P, { face: 1, bags: f.bags, state: 'walk', flash: 0 }, ax, ay, rq / 6 * TAU / 18, sc); }, true);
  }
  function itemSprite(kind, force) {
    var sc = R.GS * HK / A;
    return bake('T|' + kind, [-20, 20, -30, 4], sc, function (cx, ax, ay) { R.item(cx, P, { kind: kind, h: 1, x: 0 }, ax, ay, 0, sc); }, force);
  }

  // ---------- Прогрев атласа (в фоне, порциями) ----------
  var warmQ = [], warmOn = false;
  function queueWarm() {
    if (warmQ.length || warmOn) return;
    var heroes = ['zhdan', 'secha', 'olha'], foes = ['shield', 'spear', 'raider', 'brute'], bosses = ['voevoda', 'twins0', 'twins1', 'lovchiy', 'cepnik', 'stenoboy', 'liteyshchik'];
    var atk = ['swing', 'swing2', 'over', 'thrust', 'back', 'slam'];
    function add(lk, pose, extra) { warmQ.push([lk, Object.assign({ pose: pose }, extra || {})]); }
    function cyc(lk, pose) { var c = CYC[pose]; for (var i = 0; i < c[1]; i++) add(lk, pose, { t: (i + 0.5) * c[0] / c[1] }); }
    heroes.concat(foes, bosses).forEach(function (lk, n) {
      var hero = n < 3;
      cyc(lk, 'idle'); cyc(lk, 'walk'); if (hero) cyc(lk, 'run');
      (hero ? ['swing', 'swing2', 'over', 'back', 'shoot', 'dash'] : n < 7 ? ['swing', 'thrust', 'over'] : atk).forEach(function (ps) {
        add(lk, ps, { mp: 'w' }); add(lk, ps, { mp: 'a' }); for (var r = 0; r < 3; r++) add(lk, ps, { mp: 'r', ph: r / 3 + 0.1 });
      });
      ['hurt', 'jump', 'air', 'rise', 'cast', 'crouch', 'guard', 'grab', 'toss', 'grabbed'].forEach(function (ps) { add(lk, ps, { mp: 'a' }); });
      add(lk, 'idle', { lying: 1 }); add(lk, 'ride', {}); add(lk, 'ride', { mp: 'w' }); add(lk, 'ride', { mp: 'a' });
    });
    warmOn = true; step();
    function step() {
      if (!warmOn) return;
      var t0 = performance.now();
      while (warmQ.length && performance.now() - t0 < 6) { var q = warmQ.shift(); figSprite(q[0], q[1], null, true); }
      if (warmQ.length) setTimeout(step, 16); else warmOn = false;
    }
  }

  // ---------- Буферы ----------
  var bufA = null, bufB = null, vign = null, dith = null;
  function buffers(W, H) {
    if (!bufA) { bufA = mk(W / A, H / A); bufB = mk(W / A, H / A); }
    if (!vign) {
      vign = mk(W / A, H / A); var v = vign.getContext('2d'), gr = v.createRadialGradient(W / A / 2, H / A / 2, H / A * 0.35, W / A / 2, H / A / 2, W / A * 0.62);
      gr.addColorStop(0, 'rgba(20,6,26,0)'); gr.addColorStop(1, 'rgba(20,6,26,.55)'); v.fillStyle = gr; v.fillRect(0, 0, W / A, H / A);
      dith = mk(4, 4); var dc = dith.getContext('2d'); dc.fillStyle = 'rgba(0,0,0,.16)'; dc.fillRect(0, 0, 1, 1); dc.fillRect(2, 2, 1, 1); dc.fillStyle = 'rgba(255,255,255,.05)'; dc.fillRect(2, 0, 1, 1);
    }
  }

  // ---------- Искры, смазы ----------
  var sparks = [];
  function fx(type, d, S) {
    if (!S || !d || d.x == null) return;
    var y = D.logic.FLOOR_TOP + (d.z || 0) - (d.h || 0);
    if (type === 'hit') sparks.push({ x: d.x, y: y - 6, t0: S.time, life: 0.2, big: d.knee ? 0.8 : 1, col: '#ffcf3a', rot: (S.time * 7) % 1 });
    else if (type === 'block') sparks.push({ x: d.x, y: y - 6, t0: S.time, life: 0.16, big: 0.7, col: '#8ad8ff', rot: 0.5 });
    else if (type === 'kill') sparks.push({ x: d.x, y: y - 40, t0: S.time, life: d.boss ? 0.5 : 0.3, big: d.boss ? 2.4 : 1.5, col: d.boss ? '#ff6a1a' : '#ffb53a', rot: 0.25 });
    else if (type === 'thud') sparks.push({ x: d.x, y: y + 4, t0: S.time, life: 0.25, big: d.big ? 1.4 : 0.8, col: '#e8c890', dust: true });
    if (sparks.length > 24) sparks.shift();
  }
  function drawSparks(c, S, cam) {
    for (var i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i], a = (S.time - s.t0) / s.life;
      if (a < 0 || a > 1) { if (a > 1 || a < -1) sparks.splice(i, 1); continue; }
      var x = s.x - cam, y = s.y, k = s.big * (a < 0.3 ? a / 0.3 : 1 - (a - 0.3) / 0.7);
      if (s.dust) { c.fillStyle = s.col; for (var j = 0; j < 6; j++) { var dx = (j - 2.5) * 12 * (0.5 + a) * s.big; c.globalAlpha = 1 - a; c.fillRect(x + dx - 4, y - 6 - a * 14 - (j % 2) * 6, 8, 6); } c.globalAlpha = 1; continue; }
      var L = 34 * k + 6, th = Math.max(2, 8 * k);
      c.save(); c.translate(x, y); c.rotate(s.rot * PI / 2);
      c.fillStyle = P.outline; c.fillRect(-L - 2, -th / 2 - 2, 2 * L + 4, th + 4); c.fillRect(-th / 2 - 2, -L - 2, th + 4, 2 * L + 4);
      c.fillStyle = s.col; c.fillRect(-L, -th / 2, 2 * L, th); c.fillRect(-th / 2, -L, th, 2 * L);
      c.fillStyle = '#fffbe8'; c.fillRect(-L * 0.5, -th / 4, L, th / 2); c.fillRect(-th / 4, -L * 0.5, th / 2, L); c.fillRect(-th, -th, 2 * th, 2 * th);
      c.rotate(PI / 4); c.fillStyle = s.col; var l2 = L * 0.55; c.fillRect(-l2, -th / 4, 2 * l2, th / 2); c.fillRect(-th / 4, -l2, th / 2, 2 * l2);
      c.restore();
      // разлёт «пикселей»
      c.fillStyle = s.col; for (var q = 0; q < 6; q++) { var an = q * 1.05 + s.rot * 3, r = 20 + a * 60 * s.big; c.fillRect(x + cos(an) * r - 3, y + sin(an) * r * 0.7 - 3, 6, 6); }
    }
  }
  function crescent(c, cx, cy, r, a0, a1, w, col, core) {
    var n = 12, i, a;
    c.beginPath();
    for (i = 0; i <= n; i++) { a = a0 + (a1 - a0) * i / n; c.lineTo(cx + cos(a) * r, cy + sin(a) * r); }
    for (i = n; i >= 0; i--) { a = a0 + (a1 - a0) * i / n; var ww = w * sin(PI * i / n); c.lineTo(cx + cos(a) * (r - ww), cy + sin(a) * (r - ww)); }
    c.closePath(); c.fillStyle = P.outline; c.lineWidth = 4; c.strokeStyle = P.outline; c.stroke(); c.fillStyle = col; c.fill();
    if (core) { c.beginPath(); for (i = 0; i <= n; i++) { a = a0 + (a1 - a0) * i / n; c.lineTo(cx + cos(a) * (r - 2), cy + sin(a) * (r - 2)); } for (i = n; i >= 0; i--) { a = a0 + (a1 - a0) * i / n; c.lineTo(cx + cos(a) * (r - 2 - w * 0.4 * sin(PI * i / n)), cy + sin(a) * (r - 2 - w * 0.4 * sin(PI * i / n))); } c.closePath(); c.fillStyle = core; c.fill(); }
  }

  // ---------- Фон: детали HD поверх фона этапа ----------
  function extras(c, S, cam, t) {
    var FT = D.logic.FLOOR_TOP, st = STAGE[S.key] || STAGE.trakt;
    // пыль пола: дизеринг (в пикселях буфера)
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = c.createPattern(dith, 'repeat');
    var ox = -Math.round(cam / A) % 4; c.translate(ox, 0); c.fillRect(-ox, Math.round((FT - 8) / A), bufA.width, bufA.height); c.restore();
    // неоновая кромка горизонта
    c.globalAlpha = 0.85; c.fillStyle = st.neon; c.fillRect(0, FT - 10, 960, 2); c.globalAlpha = 0.35; c.fillRect(0, FT - 14, 960, 4); c.globalAlpha = 1;
    // пар: клубы поднимаются от земли (параллакс 0.6)
    c.fillStyle = st.steam;
    R.layer(c, cam, 0.6, 260, function (x, i) {
      var h = R.hash(i * 17 + 3); if (h < 0.7) return;
      for (var k = 0; k < 3; k++) {   // клубы пара: координаты с шагом 4 px, прозрачность ступенями (в буфере ×2 — пиксельные края)
        var ph = ((t * 0.3 + h * 3 + k / 3) % 1), px = x + 40 + Math.round(sin(ph * 5 + i) * 3) * 4, py = FT - 20 - Math.round(ph * 30) * 4, r = Math.round(3 + ph * 4) * 4;
        c.globalAlpha = ph < 0.5 ? 0.22 : ph < 0.8 ? 0.14 : 0.07; c.beginPath(); c.arc(px, py, r, 0, TAU); c.arc(px + r * 0.8, py + r * 0.3, r * 0.7, 0, TAU); c.fill();
      }
    });
    c.globalAlpha = 1;
    // пылинки/искорки в воздухе
    c.fillStyle = st.dust;
    for (var i = 0; i < 22; i++) { var hx = R.hash(i * 31 + 7), hy = R.hash(i * 13 + 1), px2 = ((hx * 1400 - cam * 0.9 + t * 14 * (0.5 + hy)) % 1000 + 1000) % 1000 - 20, py2 = 70 + hy * (FT + 120) - ((t * 20 * hx) % 60);
      c.globalAlpha = 0.35 + 0.4 * sin(t * 3 + i); c.fillRect(px2, py2, 4, 4); }
    c.globalAlpha = 1;
  }
  // ---------- Кадр мира ----------
  var stats = { frames: 0, ms: 0 };
  function world(g, ctx, S, Pz, o) {
    var t0 = performance.now(); bakedThisFrame = 0; queueWarm();
    var L = D.logic, FT = L.FLOOR_TOP, W = g.W, H = g.H, cam = Math.round(S.cam), t = S.time, GS = R.GS, FS = GS * HK;
    R.prep(); buffers(W, H);
    var shake = o.shake || 0, shx = shake ? Math.round((Math.random() - 0.5) * shake / A) * A : 0, shy = shake ? Math.round((Math.random() - 0.5) * shake / A) * A : 0;
    // 1) фон → буфер A
    var a = bufA.getContext('2d'); a.setTransform(1 / A, 0, 0, 1 / A, 0, 0); a.imageSmoothingEnabled = false;
    (R.BG[S.key] || R.BG.trakt)(a, PB, cam, t);
    extras(a, S, cam, t);
    S.puddles.forEach(function (p) {
      var sx = p.x - cam, sy = FT + p.z;
      if (p.warn > 0) { if (Math.floor(t * 10) % 2) { a.strokeStyle = '#ffb040'; a.lineWidth = 4; a.beginPath(); a.ellipse(sx, sy, p.r, p.r * 0.38, 0, 0, TAU); a.stroke(); } }
      else { a.fillStyle = P.outline; a.beginPath(); a.ellipse(sx, sy, p.r + 3, p.r * 0.4 + 2, 0, 0, TAU); a.fill(); a.fillStyle = '#e0401a'; a.beginPath(); a.ellipse(sx, sy, p.r, p.r * 0.4, 0, 0, TAU); a.fill();
        a.fillStyle = '#ffa02a'; a.beginPath(); a.ellipse(sx, sy - 1, p.r * 0.72, p.r * 0.26, 0, 0, TAU); a.fill(); a.fillStyle = '#fff0a0'; a.fillRect(sx + sin(t * 6) * p.r * 0.3 - 6, sy - 4, 12, 4); }
    });
    S.waves.forEach(function (w) {
      var sx = w.x - cam, sy = FT + w.z;
      for (var i = 0; i < 4; i++) { a.fillStyle = i % 2 ? '#ffd83a' : '#e0702a'; a.beginPath(); a.moveTo(sx - 14 + i * 2 * -w.dir, sy); a.lineTo(sx - w.dir * i * 7, sy - 30 + i * 5); a.lineTo(sx + 14, sy); a.closePath(); a.fill(); }
    });
    var bodies = [];
    S.heroes.forEach(function (h) { if (h.out || h.state === 'dead') return; bodies.push({ z: h.z, e: h, k: 'hero' }); });
    S.foes.forEach(function (f) { bodies.push({ z: f.z + (f.state === 'grabbed' ? 0.5 : 0), e: f, k: f.kind }); });
    S.mounts.forEach(function (m) { if (!m.rider) bodies.push({ z: m.z, e: m, k: 'mount' }); });
    S.items.forEach(function (it) { bodies.push({ z: it.z - 2, e: it, k: 'item' }); });
    a.fillStyle = P.shadow;
    bodies.forEach(function (b) {   // тени — плоские пиксельные эллипсы
      var e = b.e, sx = e.x - cam, sy = FT + e.z, big = e.mount || b.k === 'mount' ? 2 : (e.def && e.def.big) || (e.look && e.look.s) || 1;
      if (b.k === 'item') big = 0.6; if (b.k === 'imp') big = 0.7; if (b.k === 'boss' && e.def.rider) big = 2.4;
      if (sx < -120 || sx > 1080) return;
      a.beginPath(); a.ellipse(sx, sy, 24 * big * FS / GS, 7 * Math.min(1.6, big) * FS / GS, 0, 0, TAU); a.fill();
    });
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(shx, shy);
    ctx.drawImage(bufA, 0, 0, bufA.width, bufA.height, 0, 0, W, H);
    // 2) фигуры — атлас
    var f = bufB.getContext('2d'); f.setTransform(1, 0, 0, 1, 0, 0); f.clearRect(0, 0, bufB.width, bufB.height); f.setTransform(1 / A, 0, 0, 1 / A, 0, 0); f.imageSmoothingEnabled = false;
    bodies.sort(function (p, q) { return p.z - q.z; });
    bodies.forEach(function (b) {
      var e = b.e, sx = e.x - cam, sy = FT + e.z - e.h;
      if (sx < -170 || sx > 1130) return;
      if (b.k === 'item') { var bob = e.h > 0 ? 0 : Math.round(sin(t * 4 + e.x) * 2); blit(ctx, itemSprite(e.kind, true), sx, sy - bob, 1); return; }
      if (b.k === 'mount') { blit(ctx, beastSprite('fire' === e.type ? 'fire' : e.type, e.state === 'spook' || e.st % 1.5 < 0.7, '', t, FS), sx, sy, e.face || 1); return; }
      if (b.k === 'imp') { if (e.inv > 0 && Math.floor(t * 20) % 2) return; blit(ctx, impSprite(e, t), sx, sy, e.face || 1, e.flash > 0 || e.state === 'hurt'); return; }
      var blink = (b.k === 'hero' && e.inv > 0 && e.state !== 'cast' && e.state !== 'down' && e.state !== 'rise' && Math.floor(t * 16) % 2) || (e.dying && e.landed && e.st > 0.4 && Math.floor(t * 14) % 2);
      if (blink) return;
      var lk, ps;
      if (b.k === 'hero') { lk = e.hero; ps = R.heroPose(e); }
      else if (b.k === 'foe') { lk = e.type; ps = R.foePose(e); }
      else { lk = e.type === 'twins' ? 'twins' + (e.twin || 0) : e.type; ps = R.bossPose(e); }
      var look = LOOK[lk] || LOOK.shield, flash = e.flash > 0;
      var mt = e.mount || (b.k === 'boss' && e.def.rider ? { type: 'fire' } : null);
      if (mt) {
        var bs = (b.k === 'boss' ? 1.3 : 1) * FS, att = e.state === 'mountAtk' ? e.phase : (b.k === 'boss' && e.move === 'breath' ? e.phase : '');
        blit(ctx, beastSprite(mt.type, e.state === 'walk', att, t, bs), sx, sy, e.face, flash);
        if (mt.type === 'fire' && att === 'a') flames(f, sx, sy, e.face, bs, (mt.def ? mt.def.reach : b.k === 'boss' ? 200 : 170), t);
        var rs = (b.k === 'boss' ? 0.9 : 1) * FS;
        var spr = figSprite(lk, { pose: 'ride', mp: ps.mp, t: t }, rs / A) || figSprite(lk, { pose: 'ride' }, rs / A, true);
        blit(ctx, spr, sx - 4 * e.face * bs, sy - 50 * bs + 30 * rs * (look.s || 1), e.face, flash);
      } else {
        var fo = { pose: ps.pose, mp: ps.mp, ph: ps.ph, t: t + e.id, lying: ps.lying, spin: ps.spin, knee: ps.knee };
        var sp = figSprite(lk, fo) || figSprite(lk, { pose: ps.lying ? 'idle' : ps.pose, mp: ps.mp === 'r' ? 'a' : ps.mp, lying: ps.lying }) || figSprite(lk, { pose: 'idle', lying: ps.lying }, null, true);
        // растяжка на ударе (первая треть фазы «a»), сжатие на приземлении из прыжка
        var kx = 1, ky = 1;
        if (e.state === 'atk' && e.phase === 'a') { kx = 1.12; ky = 0.94; }
        else if (e.state === 'hurt') { kx = 0.94; ky = 1.04; }
        blit(ctx, sp, sx, sy, e.face, flash, kx, ky);
      }
      // «спина» — двойной пиксельный смаз
      if (b.k === 'hero' && e.state === 'atk' && e.move && e.move.name === 'back' && e.phase === 'a') {
        crescent(f, sx, sy - 70, 100, -PI * 0.95, -PI * 0.05, 18, P.hero[e.hero], '#ffffff'); crescent(f, sx, sy - 40, 100, PI * 0.05, PI * 0.95, 14, P.hero[e.hero], null);
      }
      // замах врага — «!» над головой
      if ((b.k === 'foe' || b.k === 'boss') && ((e.state === 'atk' || e.state === 'mountAtk') && e.phase === 'w' || e.state === 'leapWind') && Math.floor(t * 12) % 2) {
        var hy = sy - (b.k === 'boss' ? 150 : 110) * (look.s || 1) * FS;
        f.fillStyle = P.outline; f.fillRect(sx - 9, hy - 22, 18, 36); f.fillStyle = '#ff3a3a'; f.fillRect(sx - 5, hy - 18, 10, 18); f.fillRect(sx - 5, hy + 4, 10, 6);
      }
      // смаз удара героя — толстый серп его цвета
      if (b.k === 'hero' && e.state === 'atk' && e.phase === 'a' && e.move && e.move.name !== 'shot' && e.move.name !== 'back') {
        var r = (e.move.reach || 50) * 0.95 * FS, ov = ps.pose === 'over';
        var a0 = e.face > 0 ? (ov ? -1.9 : -1.1) : PI - (ov ? -1.9 : -1.1), a1 = e.face > 0 ? (ov ? 0.9 : 0.7) : PI - (ov ? 0.9 : 0.7);
        if (e.face < 0) { var tmp = a0; a0 = a1; a1 = tmp; }
        crescent(f, sx + e.face * 10, sy - 70, r, a0, a1, ov ? 26 : 20, P.hero[e.hero], '#fffbe8');
      }
      // выпад врага — короткий красноватый смаз
      if ((b.k === 'foe' || b.k === 'boss') && e.state === 'atk' && e.phase === 'a') {
        var rr = 60 * (look.s || 1) * FS * 0.8, b0 = e.face > 0 ? -0.9 : PI - 0.5, b1 = e.face > 0 ? 0.5 : PI + 0.9;
        crescent(f, sx + e.face * 8, sy - 66 * (look.s || 1), rr, b0, b1, 14, b.k === 'boss' ? '#ff6a2a' : '#ff9a7a', null);
      }
    });
   
    // 3) эффекты → буфер B
    S.projs.forEach(function (p) {
      var sx = p.x - cam, sy = FT + p.z - p.h, d = p.vx > 0 ? 1 : -1;
      f.fillStyle = P.outline; f.fillRect(Math.min(sx, sx - d * 34) - 2, sy - 4, 38, 8);
      f.fillStyle = '#ffe8a0'; f.fillRect(Math.min(sx, sx - d * 30), sy - 2, 30, 4); f.fillStyle = '#ffffff'; f.fillRect(d > 0 ? sx - 2 : sx - 6, sy - 4, 8, 8);
      f.fillStyle = '#ff4a5e'; f.fillRect(sx - d * 34 - 4, sy - 6, 8, 4); f.fillRect(sx - d * 34 - 4, sy + 2, 8, 4);
      f.globalAlpha = 0.45; f.fillStyle = P.hero.olha; f.fillRect(Math.min(sx - d * 34, sx - d * 90), sy - 2, 56, 4); f.globalAlpha = 1;
    });
    S.spells.forEach(function (sp) { R.spellFx(f, P, sp, S, L); });
    drawSparks(f, S, cam);
    f.setTransform(1, 0, 0, 1, 0, 0); f.globalAlpha = 1; f.drawImage(vign, 0, 0);
    ctx.drawImage(bufB, 0, 0, bufB.width, bufB.height, 0, 0, W, H);
    ctx.restore();
    stats.frames++; stats.ms += performance.now() - t0;
  }
  function flames(c, sx, sy, face, s, reach, t) {   // пламя огнеящера — пиксельные клубы (без отсечения рамкой кадра)
    var L = reach, hx = sx + face * 60 * s, hy = sy - 48 * s;
    for (var j = 0; j < 8; j++) {
      var k = (j + (t * 8) % 1) / 8, fx2 = hx + face * k * L, fr = (6 + k * 22) * s * 0.8, fy = hy + sin(t * 20 + j) * 4 + k * 12 * s;
      c.fillStyle = P.outline; c.fillRect(fx2 - fr - 2, fy - fr * 0.7 - 2, fr * 2 + 4, fr * 1.4 + 4);
      c.fillStyle = j % 2 ? '#ffb530' : '#ff4a1a'; c.fillRect(fx2 - fr, fy - fr * 0.7, fr * 2, fr * 1.4);
      c.fillStyle = '#fff3a0'; c.fillRect(fx2 - fr * 0.4, fy - fr * 0.3, fr * 0.8, fr * 0.6);
    }
  }
  function portrait(ctx, Pz, key, x, y, s, t, ps) {
    var sc = Math.round((s || 1) / A * 100) / 100, sp = figSprite(key, { pose: ps || 'idle', mp: 'a', t: t || 0 }, sc, true);
    blit(ctx, sp, x, y, 1, false);
  }

  D.hd = { P: P, LOOK: LOOK, world: world, portrait: portrait, fx: fx, warm: queueWarm, scale: HK,
    stats: function () { return { cached: cache.size, bakeN: bakeN, bakeMs: Math.round(bakeMs), worldMs: stats.frames ? +(stats.ms / stats.frames).toFixed(2) : 0, frames: stats.frames, warmLeft: warmQ.length }; },
    resetStats: function () { stats.frames = 0; stats.ms = 0; bakeN = 0; } };
})(typeof window !== 'undefined' ? window : globalThis);
