/* ПОРУБЕЖЬЕ · js/render.js — отрисовка мира, мини-карты и сущностей в двух темах.
   modern — мягкие формы, градиенты, тени, плавный туман; retro — «пиксельные» ступенчатые формы, ограниченная палитра, блочный туман.
   Мир: северный порубежный край — бор, вереск, озёра, медь и дерево у Мастеровых, мох, кора и янтарные глаза у Чащи, камень, войлок и бирюзовые руны у Курганного рода. */
(function (global) {
  'use strict';
  var P = global.PORUB = global.PORUB || {};
  var T = P.T, MW = P.MW, MH = P.MH, TR = P.TERR;
  var R = P.render = {};

  var PAL = {
    modern: { grass: ['#3e5b3a', '#425f3c', '#3a5637', '#455f3b'], heath: ['#4f5838', '#545a3a'], wood: '#1d3527', pine: ['#24432f', '#2d523a', '#36603f'], birch: '#d9d6c8', trunk: '#4a3626',
      water: '#1e4656', waterHi: '#3b7286', shore: '#56603f', rock: '#6f6b62', rockHi: '#9a958a', fog: '#06080b', ally: '#6cc4ff', neutral: '#e8d890',
      copper: '#cf7a36', copperHi: '#f0a560', wood2: '#8a5a33', woodHi: '#b07a48', cloth: '#3f6f93', clothHi: '#6b9cc0', skin: '#e2b48a', fur: '#6b4a2e', iron: '#5b5f66',
      moss: '#6f9a3a', mossHi: '#9cc25a', bark: '#5a3d24', barkHi: '#7c5636', lichen: '#c3c98e', eye: '#ffb43c', cap: '#b8432f', capDot: '#f2e6cf',
      amber: '#f0a020', amberHi: '#ffd36b', resin: '#7a4a10', resinHi: '#d8a040', myc: 'rgba(36,52,28,0.42)', mycLine: 'rgba(232,226,196,0.30)',
      sel: '#5fd38a', enemy: '#ff5d5d', hpGood: '#5fd38a', hpMid: '#ffc04a', hpBad: '#ff5d5d', panel: 'rgba(20,24,30,0.92)', line: '#2c3442', ink: '#eef2f8', muted: '#9aa4b5', accent: '#e8913a',
      snow: ['#dfe7ec', '#d6e0e7', '#e6edf1'], snowLo: '#b9c8d3', ice: '#a9cfe0', iceHi: '#e2f3fa', plank: '#8a6238', plankHi: '#b4864f', cranberry: '#a8323a', brass: '#c9a24a', frost: 'rgba(200,225,245,',
      stone: '#8b8894', stoneHi: '#b9b5c2', stoneLo: '#5c5966', felt: '#6c4a86', feltHi: '#9b74b2', rune: '#5fe0cf', ochre: '#c99a3a', ore: '#b05a3c', oreHi: '#e08a5a', ember: '#ffb04a' },
    retro: { grass: ['#2e5a2a', '#2e5a2a', '#346430', '#2e5a2a'], heath: ['#5c5428', '#5c5428'], wood: '#123218', pine: ['#1a4a22', '#226a2a', '#1a4a22'], birch: '#e8e8d0', trunk: '#5a3818',
      water: '#183a68', waterHi: '#4a78b8', shore: '#4a5a28', rock: '#787070', rockHi: '#b0a898', fog: '#000000', ally: '#58c8f8', neutral: '#f8e070',
      copper: '#e07828', copperHi: '#ffb060', wood2: '#8c5420', woodHi: '#b87838', cloth: '#3870b0', clothHi: '#70a8e0', skin: '#f0b888', fur: '#704818', iron: '#606068',
      moss: '#68a830', mossHi: '#a8d850', bark: '#603818', barkHi: '#905828', lichen: '#d0d090', eye: '#ffc030', cap: '#c83020', capDot: '#f8f0d8',
      amber: '#f8a000', amberHi: '#ffe070', resin: '#784808', resinHi: '#e0a030', myc: 'rgba(24,40,16,0.5)', mycLine: 'rgba(240,232,200,0.35)',
      sel: '#58f858', enemy: '#f83838', hpGood: '#58f858', hpMid: '#f8d838', hpBad: '#f83838', panel: 'rgba(16,12,20,0.95)', line: '#3a2e40', ink: '#f3e9da', muted: '#8a7f6e', accent: '#ea6a12',
      snow: ['#e8e8f0', '#d8d8e8', '#e8e8f0'], snowLo: '#a8b0c8', ice: '#88c0e8', iceHi: '#e0f8ff', plank: '#905828', plankHi: '#c08848', cranberry: '#b82838', brass: '#d8b040', frost: 'rgba(208,232,255,',
      stone: '#888098', stoneHi: '#c0b8c8', stoneLo: '#585068', felt: '#704890', feltHi: '#a878c8', rune: '#58f0d8', ochre: '#d8a038', ore: '#b85838', oreHi: '#f09058', ember: '#ffb838' }
  };
  R.PAL = PAL;
  R.pal = function (theme) { return PAL[theme] || PAL.modern; };

  // ---------- примитивы: modern — гладкие, retro — ступенчатые «пиксели» ----------
  var PX = 3;
  function oval(c, x, y, rx, ry, col, ret) {
    c.fillStyle = col;
    if (!ret) { c.beginPath(); c.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); c.fill(); return; }
    for (var yy = -ry; yy < ry; yy += PX) { var k = (yy + PX / 2) / ry, w = rx * Math.sqrt(Math.max(0, 1 - k * k)); w = Math.round(w / PX) * PX; if (w > 0) c.fillRect(Math.round((x - w) / PX) * PX, Math.round((y + yy) / PX) * PX, w * 2, PX); }
  }
  function box(c, x, y, w, h, col, ret, rad) {
    c.fillStyle = col;
    if (ret || !rad) { c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); return; }
    c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, rad); else c.rect(x, y, w, h); c.fill();
  }
  function tri(c, x0, y0, x1, y1, x2, y2, col, ret) {
    c.fillStyle = col;
    if (!ret) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.closePath(); c.fill(); return; }
    // ступенчатый треугольник «вершина + основание» (y0 — вершина, y1==y2 — основание)
    var h = y1 - y0; for (var yy = 0; yy < h; yy += PX) { var k = (yy + PX) / h, l = x0 + (x1 - x0) * k, r = x0 + (x2 - x0) * k; c.fillRect(Math.round(l / PX) * PX, Math.round((y0 + yy) / PX) * PX, Math.max(PX, Math.round((r - l) / PX) * PX), PX); }
  }
  function line(c, x0, y0, x1, y1, col, w) { c.strokeStyle = col; c.lineWidth = w || 2; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  function shadow(c, x, y, rx, ry, ret) { oval(c, x, y, rx, ry, 'rgba(0,0,0,' + (ret ? 0.35 : 0.28) + ')', ret); }
  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  R.prims = { oval: oval, box: box, tri: tri };
  // цвет стороны для обводки/мини-карты: своя, враг, союзник, нейтрал (третья сторона кампании — owner 2)
  function sideCol(game, e, p) { if (e.owner === 0) return p.sel; if (e.owner < 0) return p.neutral; if (!game.relOf) return p.enemy; var r = game.relOf(0, e.owner); return r === 'ally' ? p.ally : r === 'neutral' ? p.neutral : p.enemy; }
  R.sideCol = sideCol;

  // ---------- Земля (пререндер на всю карту, кэш по теме) ----------
  R.terrain = function (game, theme) {
    var key = theme + ':' + game.seedKey + ':' + (game.terrRev || 0), MW = game.MW, MH = game.MH; game._terrCache = game._terrCache || {};
    if (game._terrCache[key]) return game._terrCache[key];
    for (var ok in game._terrCache) if (ok.indexOf(theme + ':') === 0) delete game._terrCache[ok]; // старая версия карты (разлив, мост)
    var cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(MW * T, MH * T) : Object.assign(document.createElement('canvas'), { width: MW * T, height: MH * T });
    var c = cv.getContext('2d'), p = R.pal(theme), ret = theme === 'retro';
    for (var y = 0; y < MH; y++) for (var x = 0; x < MW; x++) {
      var t = game.terr[y * MW + x], h = hash(x, y), X = x * T, Y = y * T;
      var base = t === TR.HEATH ? p.heath[(h * 2) | 0] : t === TR.SNOW ? p.snow[(h * 3) | 0] : t === TR.ICE ? p.ice : p.grass[(h * 4) | 0];
      c.fillStyle = t === TR.WATER || t === TR.BRIDGE ? p.water : base; c.fillRect(X, Y, T, T);
      if (t === TR.SNOW) { c.fillStyle = p.snowLo; for (var sk = 0; sk < 3; sk++) { var sx0 = hash(x * 5 + sk, y * 7), sy0 = hash(x * 3, y * 9 + sk); c.fillRect(X + ((sx0 * (T - 6)) | 0), Y + ((sy0 * (T - 4)) | 0), ret ? 6 : 5, ret ? 3 : 2); } }
      if (t === TR.ICE) { c.fillStyle = p.iceHi; if (h > 0.3) c.fillRect(X + ((h * 14) | 0), Y + 6 + ((h * 13) | 0), ret ? 12 : 11, 2);
        c.strokeStyle = ret ? '#5890c0' : 'rgba(70,120,150,0.45)'; c.lineWidth = 1; if (h > 0.6) { c.beginPath(); c.moveTo(X + 3, Y + h * T); c.lineTo(X + T / 2, Y + T / 2); c.lineTo(X + T - 4, Y + (1 - h) * T); c.stroke(); } }
      if (game.felled && game.felled[y * MW + x] && (t === TR.HEATH || t === TR.GRASS)) { // вырубка: пни и щепа (кампания Чащи)
        oval(c, X + 10 + h * 8, Y + 20, 6, 3, ret ? '#3a2410' : 'rgba(40,26,14,0.45)', ret); box(c, X + 5 + h * 8, Y + 11, 10, 9, p.trunk, ret, 2); oval(c, X + 10 + h * 8, Y + 11, 5, 2, ret ? '#b08850' : '#b8925c', ret);
        c.fillStyle = ret ? '#c09050' : 'rgba(200,160,100,0.6)'; c.fillRect(X + 20 - h * 6, Y + 24, 5, 2); c.fillRect(X + 6, Y + 26 - h * 4, 4, 2); }
      if (game.young && game.young[y * MW + x] && t !== TR.WOOD) { // подрост на бывшей вырубке: две-три молодые ёлочки (кампания Чащи)
        for (var yg = 0; yg < 3; yg++) { var ygx = X + 6 + ((hash(x * 3 + yg, y) * 20) | 0), ygy = Y + 12 + ((hash(x, y * 5 + yg) * 16) | 0); tri(c, ygx, ygy - 12, ygx - 5, ygy, ygx + 5, ygy, p.pine[(yg + 1) % 3], ret); box(c, ygx - 1, ygy, 2, 3, p.trunk, ret); } }
      if (t === TR.GRASS || t === TR.HEATH || t === TR.WOOD) { // травинки/вереск
        for (var k = 0; k < 4; k++) { var hx = hash(x * 7 + k, y * 3), hy = hash(x * 5, y * 11 + k);
          c.fillStyle = t === TR.HEATH ? (ret ? '#a07858' : 'rgba(176,128,96,0.45)') : (ret ? '#3c7034' : 'rgba(110,150,90,0.35)');
          c.fillRect(X + ((hx * (T - 4)) | 0), Y + ((hy * (T - 4)) | 0), ret ? 3 : 2, ret ? 3 : 2); }
      }
      if (t === TR.WATER || t === TR.BRIDGE) {
        // берег там, где рядом суша
        var land = function (dx, dy) { var xx = x + dx, yy = y + dy; if (!(xx >= 0 && yy >= 0 && xx < MW && yy < MH)) return false; var q = game.terr[yy * MW + xx]; return q !== TR.WATER && q !== TR.BRIDGE && q !== TR.ICE; };
        c.fillStyle = p.shore; if (land(0, -1)) c.fillRect(X, Y, T, 4); if (land(0, 1)) c.fillRect(X, Y + T - 4, T, 4); if (land(-1, 0)) c.fillRect(X, Y, 4, T); if (land(1, 0)) c.fillRect(X + T - 4, Y, 4, T);
        c.fillStyle = p.waterHi; if (h > 0.55) c.fillRect(X + 6 + ((h * 10) | 0), Y + 10 + ((h * 9) | 0), ret ? 9 : 10, 2);
      }
    }
    // камни и лес — поверх (деревья чуть выступают за клетку)
    for (var y2 = 0; y2 < MH; y2++) for (var x2 = 0; x2 < MW; x2++) {
      var t2 = game.terr[y2 * MW + x2], h2 = hash(x2, y2), cx = x2 * T + T / 2, cy = y2 * T + T / 2;
      if (t2 === TR.ROCK) { shadow(c, cx + 2, cy + 8, 13, 5, ret); oval(c, cx, cy + 2, 13, 10, p.rock, ret); oval(c, cx - 3, cy - 2, 7, 5, p.rockHi, ret); oval(c, cx + 6, cy + 4, 4, 3, p.rockHi, ret); }
      if (t2 === TR.WOOD) {
        c.fillStyle = p.wood; c.fillRect(x2 * T, y2 * T, T, T);
        var snowy = game.snowyWood;
        var n = 2 + ((h2 * 2) | 0);
        for (var i = 0; i < n; i++) { var ox = (hash(x2 * 3 + i, y2) - 0.5) * 18, oy = (hash(x2, y2 * 3 + i) - 0.5) * 16, s = 0.8 + hash(x2 + i, y2 + i) * 0.5;
          if (hash(x2 * 13 + i, y2 * 7) > 0.86) { // берёза
            c.fillStyle = p.birch; c.fillRect(cx + ox - 2, cy + oy - 6, 4, 18); c.fillStyle = '#222'; c.fillRect(cx + ox - 2, cy + oy, 3, 1); c.fillRect(cx + ox, cy + oy + 6, 2, 1);
            oval(c, cx + ox, cy + oy - 10, 9 * s, 8 * s, ret ? '#78a830' : '#7aa64a', ret);
          } else pine(c, cx + ox, cy + oy + 10, s, p, ret, h2, snowy);
        }
      }
    }
    game._terrCache[key] = cv; return cv;
  };
  function pine(c, x, y, s, p, ret, h, snowy) {
    shadow(c, x + 4, y + 2, 9 * s, 3 * s, ret);
    c.fillStyle = p.trunk; c.fillRect(x - 2, y - 6 * s, 4, 6 * s);
    var cols = p.pine; for (var i = 0; i < 3; i++) { var w = (12 - i * 3) * s, yy = y - 6 * s - i * 7 * s; tri(c, x, yy - 12 * s, x - w, yy, x + w, yy, cols[i], ret);
      if (snowy) tri(c, x, yy - 12 * s, x - w * 0.55, yy - 5 * s, x + w * 0.55, yy - 5 * s, p.snow[0], ret); }
    if (!ret) { c.fillStyle = 'rgba(255,255,255,0.06)'; c.beginPath(); c.moveTo(x, y - 32 * s); c.lineTo(x + 6 * s, y - 14 * s); c.lineTo(x, y - 16 * s); c.fill(); }
  }

  // ---------- Мини-карта: фон (пререндер) ----------
  R.miniBase = function (game, theme, w, h) {
    var MW = game.MW, MH = game.MH, key = 'mini:' + theme + ':' + w + ':' + (game.terrRev || 0); game._terrCache = game._terrCache || {};
    if (game._terrCache[key]) return game._terrCache[key];
    var cv = Object.assign(document.createElement('canvas'), { width: MW, height: MH }), c = cv.getContext('2d'), p = R.pal(theme), img = c.createImageData(MW, MH);
    var hex = function (s) { var n = parseInt(s.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    var cols = [hex(p.grass[0]), hex(p.wood), hex(p.water), hex(p.rock), hex(p.heath[0]), hex(p.snow[0]), hex(p.ice), hex(p.plank)];
    for (var i = 0; i < MW * MH; i++) { var cc = cols[game.terr[i]]; img.data[i * 4] = cc[0]; img.data[i * 4 + 1] = cc[1]; img.data[i * 4 + 2] = cc[2]; img.data[i * 4 + 3] = 255; }
    c.putImageData(img, 0, 0); game._terrCache[key] = cv; return cv;
  };

  // ---------- Сущности ----------
  R.unit = function (c, u, p, ret, t, race) {
    var x = u.x, y = u.y, f = u.fx < 0 ? -1 : 1, bob = u.moving || u.work ? Math.sin(u.anim * 12) * 1.5 : 0, D = u.type;
    c.save(); c.translate(x, y);
    shadow(c, 0, u.r * 0.7, u.r * 0.9, u.r * 0.35, ret);
    c.scale(f, 1);
    if (D === 'worker' || D === 'shooter') {
      var coat = D === 'shooter' ? (ret ? '#2c7470' : '#2f6f73') : p.cloth;
      box(c, -5, 2 + bob * 0.3, 4, 6, p.fur, ret); box(c, 1, 2 - bob * 0.3, 4, 6, p.fur, ret);             // ноги-валенки
      oval(c, 0, -1, 7, 8, coat, ret);                                                                   // кафтан
      if (D === 'worker') box(c, -4, -2, 8, 8, p.wood2, ret, 2);                                         // фартук
      else { box(c, -7, -3, 14, 3, p.copper, ret); }                                                     // медный пояс
      oval(c, 1, -10, 5, 5, p.skin, ret);                                                                // голова
      box(c, -4, -16, 10, 5, p.fur, ret, 2); box(c, -4, -12, 10, 2, p.woodHi, ret);                      // меховая шапка с отворотом
      if (D === 'shooter') { line(c, -2, 0, 14, -6, p.wood2, 3); line(c, 6, -3, 16, -7, p.iron, 2); }    // пищаль
      else if (u.work) { c.save(); c.translate(5, -2); c.rotate(Math.sin(u.anim * 10) * 0.9 - 0.5); line(c, 0, 0, 0, -11, p.wood2, 2); box(c, -3, -13, 7, 4, p.iron, ret); c.restore(); }
      if (u.carry) { if (u.carry.type === 'timber') { box(c, -12, -6, 10, 4, p.plankHi, ret, 2); box(c, -12, -2, 10, 3, p.trunk, ret, 1); } else oval(c, -7, -4, 4, 4, u.carry.type === 'amber' ? p.amber : p.resinHi, ret); }
    } else if (D === 'yarina') { // воевода: клюквенный плащ, кольчужная шапка-шишак с бармицей, древко со знаменем
      box(c, -5, 2 + bob * 0.3, 4, 7, p.fur, ret); box(c, 1, 2 - bob * 0.3, 4, 7, p.fur, ret);
      tri(c, -2, -10, -11, 8, 7, 8, p.cranberry, ret);                                                  // плащ
      oval(c, 0, -1, 7, 8, p.iron, ret); box(c, -6, -2, 12, 2, p.brass, ret);                            // кольчуга, пояс
      oval(c, 1, -10, 5, 5, p.skin, ret);
      tri(c, 1, -21, -5, -12, 7, -12, p.iron, ret); box(c, -5, -12, 12, 2, p.brass, ret);              // шишак
      line(c, 9, 6, 9, -26, p.wood2, 2); box(c, 9, -26, 11, 8, p.copper, ret); tri(c, 20, -26, 20, -18, 24, -22, p.copper, ret); // знамя
    } else if (D === 'tikhon') { // изобретатель: кожаный фартук, латунные очки на шапке, заплечный котелок с трубкой
      box(c, -5, 2 + bob * 0.3, 4, 6, p.fur, ret); box(c, 1, 2 - bob * 0.3, 4, 6, p.fur, ret);
      box(c, -11, -9, 6, 12, p.brass, ret, 2); box(c, -10, -14, 2, 5, p.iron, ret);                       // котелок за спиной
      oval(c, 0, -1, 7, 8, ret ? '#706040' : '#6d6046', ret); box(c, -4, -3, 8, 9, p.wood2, ret, 2);       // кафтан, фартук
      oval(c, 1, -10, 5, 5, p.skin, ret); box(c, -4, -16, 10, 4, p.fur, ret, 2);
      oval(c, -1, -14, 2, 2, p.iceHi, ret); oval(c, 3, -14, 2, 2, p.iceHi, ret); box(c, -3, -15, 8, 1, p.brass, ret);  // очки
      if (u.work) { c.save(); c.translate(5, -2); c.rotate(Math.sin(u.anim * 12) * 0.8 - 0.4); line(c, 0, 0, 0, -10, p.iron, 2); box(c, -2, -12, 5, 3, p.brass, ret); c.restore(); }
      if (u.carry) oval(c, 7, -4, 4, 4, u.carry.type === 'amber' ? p.amber : u.carry.type === 'timber' ? p.plankHi : p.resinHi, ret);
    } else if (D === 'walker') {
      var st = u.moving ? Math.sin(u.anim * 7) * 4 : 0;
      line(c, -6, 4, -8 + st, 15, p.iron, 4); line(c, 6, 4, 8 - st, 15, p.iron, 4);                    // ноги
      box(c, -11 + st, 13, 7, 3, p.iron, ret); box(c, 4 - st, 13, 7, 3, p.iron, ret);
      box(c, -13, -11, 24, 17, p.copper, ret, 6);                                                        // котёл
      box(c, -13, -4, 24, 3, p.wood2, ret); box(c, -9, -9, 4, 12, p.copperHi, ret, 2);
      oval(c, 4, -3, 4, 4, ret ? '#ffd060' : '#ffd88a', ret);                                            // топка
      box(c, 9, -7, 11, 5, p.iron, ret, 2);                                                              // пушка
      box(c, -10, -20, 5, 10, p.iron, ret);                                                              // труба
      for (var i = 0; i < 3; i++) { var ph = (t * 0.8 + i / 3 + u.id * 0.13) % 1; oval(c, -8 - ph * 6, -22 - ph * 16, 2 + ph * 4, 2 + ph * 4, 'rgba(210,210,210,' + (0.5 - ph * 0.45) + ')', ret); }
    } else if (D === 'stomper') { // Топотун Тихона: латунный котёл на трёх «шагах», две трубы, заклёпки, фонарь-глаз, пушка-«ступа»
      var st2 = u.moving ? Math.sin(u.anim * 6) * 5 : 0;
      line(c, -9, 6, -12 + st2, 19, p.iron, 5); line(c, 9, 6, 12 - st2, 19, p.iron, 5); line(c, 0, 7, 0, 19, p.iron, 4);
      box(c, -16 + st2, 17, 9, 4, p.iron, ret); box(c, 7 - st2, 17, 9, 4, p.iron, ret); box(c, -4, 17, 8, 3, p.iron, ret);
      box(c, -17, -14, 32, 22, p.brass, ret, 8); box(c, -17, -5, 32, 4, p.wood2, ret);
      for (var rv = 0; rv < 5; rv++) oval(c, -13 + rv * 6, -10, 1.5, 1.5, p.copperHi, ret);
      oval(c, 6, -2, 5, 5, ret ? '#ffd060' : '#ffd88a', ret); oval(c, 6, -2, 2.5, 2.5, '#fff4c8', ret);    // фонарь-глаз
      box(c, 13, -9, 13, 7, p.iron, ret, 2); box(c, 24, -10, 4, 9, p.iron, ret);                          // пушка
      box(c, -14, -26, 5, 13, p.iron, ret); box(c, -6, -23, 4, 10, p.copper, ret);                          // трубы
      for (var j2 = 0; j2 < 4; j2++) { var ph2 = (t * 0.9 + j2 / 4 + u.id * 0.17) % 1; oval(c, -12 - ph2 * 7, -28 - ph2 * 18, 2.5 + ph2 * 5, 2.5 + ph2 * 5, 'rgba(225,225,225,' + (0.55 - ph2 * 0.5) + ')', ret); }
    } else if (D === 'sled') { // сани с беженцами: полозья, короб, узлы, возница в тулупе
      box(c, -16, 7, 32, 2, p.iron, ret); line(c, 16, 8, 20, 2, p.iron, 2);
      box(c, -14, -3, 26, 10, p.wood2, ret, 2); box(c, -14, -3, 26, 2, p.woodHi, ret);
      oval(c, -8, -6, 6, 5, p.cranberry, ret); oval(c, 0, -7, 5, 4, ret ? '#d8c890' : '#cdbb8a', ret); oval(c, -3, -11, 4, 3, p.cloth, ret); // узлы
      oval(c, 9, -7, 5, 6, p.fur, ret); oval(c, 9, -15, 4, 4, p.skin, ret); box(c, 5, -20, 8, 4, p.fur, ret, 2); // возница
      line(c, 13, -6, 24, -2, p.wood2, 2);
    } else if (D === 'envoy') { // жук-посол: короед с веточкой-знаком мира и лишайниковой накидкой
      var lg2 = u.moving ? Math.sin(u.anim * 16) * 2 : 0;
      for (var l2 = -1; l2 <= 1; l2++) { line(c, l2 * 4, 0, l2 * 5 - 2, 8 + (l2 % 2 ? lg2 : -lg2), p.bark, 2); line(c, l2 * 4, 0, l2 * 5 + 2, -8 - (l2 % 2 ? lg2 : -lg2), p.bark, 2); }
      oval(c, -1, 0, 9, 7, p.bark, ret); oval(c, -2, -1, 8, 6, p.lichen, ret); oval(c, -3, -2, 5, 3, p.mossHi, ret);
      oval(c, 8, 0, 4, 4, p.bark, ret); box(c, 9, -3, 2, 2, p.eye, ret); box(c, 9, 1, 2, 2, p.eye, ret);
      line(c, 10, -3, 16, -14, p.trunk, 2); oval(c, 14, -14, 3, 2, p.mossHi, ret); oval(c, 18, -12, 3, 2, p.moss, ret); oval(c, 15, -10, 2, 2, p.mossHi, ret); // веточка
    } else if (D === 'beetle') {
      var lg = u.moving ? Math.sin(u.anim * 16) * 2 : 0;
      for (var l = -1; l <= 1; l++) { line(c, l * 4, 0, l * 5 - 2, 8 + (l % 2 ? lg : -lg), p.bark, 2); line(c, l * 4, 0, l * 5 + 2, -8 - (l % 2 ? lg : -lg), p.bark, 2); }
      oval(c, -1, 0, 9, 7, p.bark, ret); oval(c, -2, -1, 7, 5, p.barkHi, ret);
      line(c, -8, 0, 6, 0, ret ? '#402008' : 'rgba(40,24,10,0.7)', 1);
      oval(c, 8, 0, 4, 4, p.bark, ret); box(c, 9, -3, 2, 2, p.eye, ret); box(c, 9, 1, 2, 2, p.eye, ret);  // голова, янтарные глаза
      if (u.work) { line(c, 11, -2, 14, -4 + Math.sin(u.anim * 14) * 2, p.bark, 2); line(c, 11, 2, 14, 4 - Math.sin(u.anim * 14) * 2, p.bark, 2); }
      if (u.carry) oval(c, -3, -7, 4, 4, u.carry.type === 'amber' ? p.amber : u.carry.type === 'timber' ? p.plankHi : p.resinHi, ret);
    } else if (D === 'stinger') {
      var hop = u.moving ? Math.abs(Math.sin(u.anim * 9)) * -4 : 0;
      c.translate(0, hop);
      line(c, -6, 0, -14, -6, p.moss, 3); tri(c, -14, -12, -17, -5, -11, -5, p.lichen, ret);           // хвост-жало
      for (var s = 0; s < 8; s++) { var a = s / 8 * Math.PI * 2 + 0.2; tri(c, Math.cos(a) * 13, Math.sin(a) * 10 - 1, Math.cos(a) * 7 - 2, Math.sin(a) * 6 + 1, Math.cos(a) * 7 + 2, Math.sin(a) * 6 + 1, p.mossHi, ret); }
      oval(c, 0, 0, 9, 8, p.moss, ret);                                                                  // мшистое тело-клубок
      oval(c, -2, -2, 5, 4, p.mossHi, ret);
      box(c, 4, -3, 3, 3, p.eye, ret); box(c, 4, 2, 3, 2, p.eye, ret);
    } else if (D === 'shell') {
      var sw = u.moving ? Math.sin(u.anim * 6) * 2 : 0;
      box(c, -11, 6 + sw * 0.5, 6, 6, p.bark, ret); box(c, 5, 6 - sw * 0.5, 6, 6, p.bark, ret);
      oval(c, 13, 2, 5, 4, p.bark, ret); box(c, 15, 0, 2, 2, p.eye, ret);                               // голова
      oval(c, 0, 0, 15, 11, ret ? '#4a6a28' : '#566c3a', ret);                                           // панцирь
      oval(c, -1, -2, 12, 8, p.moss, ret);
      for (var d = 0; d < 5; d++) oval(c, -8 + d * 4, -5 + (d % 2) * 5, 2, 2, p.lichen, ret);           // лишайник
      oval(c, -5, -10, 4, 3, p.cap, ret); box(c, -6, -8, 2, 4, p.capDot, ret);                            // грибы на спине
      oval(c, 4, -9, 3, 2, p.cap, ret); oval(c, -6, -11, 1, 1, p.capDot, ret);
    } else if (D === 'matushka') { // Матушка-Пень: старый пень на корнях-ножках, моховой платок, янтарные глаза, росток на макушке
      var wk = u.moving ? Math.sin(u.anim * 5) * 3 : 0;
      for (var rl = -2; rl <= 2; rl++) line(c, rl * 4, 6, rl * 6 + (rl % 2 ? wk : -wk), 15, p.bark, 3);
      box(c, -12, -14, 24, 22, p.bark, ret, 6); box(c, -9, -12, 6, 18, p.barkHi, ret, 3);
      oval(c, 0, -15, 12, 5, p.barkHi, ret); for (var rg = 2; rg > 0; rg--) oval(c, 0, -15, rg * 4, rg * 1.6, rg % 2 ? (ret ? '#b08850' : '#b8925c') : (ret ? '#906838' : '#9a764a'), ret);
      tri(c, 0, -8, -14, 2, 14, 2, p.moss, ret); oval(c, -8, -2, 5, 4, p.mossHi, ret);                   // моховой платок
      box(c, 2, -8, 3, 3, p.eye, ret); box(c, 7, -8, 3, 3, p.eye, ret);                                   // глаза
      line(c, 0, -17, 0, -26, p.moss, 2); oval(c, -4, -26, 4, 2, p.mossHi, ret); oval(c, 4, -28, 4, 2, p.mossHi, ret);   // росток
      oval(c, -12, 4, 4, 3, p.cap, ret); oval(c, -13, 3, 1, 1, p.capDot, ret);
    } else if (D === 'shmel') { // Шмель: крупный мшистый клубок в янтарную полоску, листья-крылышки, жало
      var hop2 = u.moving ? Math.abs(Math.sin(u.anim * 10)) * -4 : 0, fl = Math.sin(u.anim * 30) * 3;
      c.translate(0, hop2);
      oval(c, -4, -12 - fl * 0.3, 7, 4, ret ? '#c8e8a0' : 'rgba(210,240,180,0.75)', ret); oval(c, 4, -12 + fl * 0.3, 7, 4, ret ? '#c8e8a0' : 'rgba(210,240,180,0.75)', ret);   // крылышки
      line(c, -8, 0, -16, -4, p.moss, 3); tri(c, -16, -10, -19, -3, -13, -3, p.amberHi, ret);
      oval(c, 0, 0, 11, 9, p.moss, ret); box(c, -6, -8, 4, 16, p.amber, ret); box(c, 2, -8, 3, 16, p.amber, ret);
      oval(c, -3, -3, 5, 3, p.mossHi, ret); box(c, 6, -3, 3, 3, p.eye, ret); box(c, 6, 2, 3, 2, p.eye, ret);
    } else if (D === 'firefly') { // светляк: тёмное тельце, светящееся брюшко, прозрачные крылья
      var gl = 0.6 + 0.4 * Math.sin(u.anim * 4 + u.id), fy = Math.sin(u.anim * 3) * 2;
      c.translate(0, -6 + fy);
      if (!ret) { c.fillStyle = 'rgba(220,255,140,' + (0.18 * gl) + ')'; c.beginPath(); c.arc(-4, 2, 14, 0, 7); c.fill(); }
      oval(c, -5, 2, 6, 5, ret ? (gl > 0.6 ? '#e8ff70' : '#a8d040') : 'rgba(220,255,120,' + (0.6 + 0.4 * gl) + ')', ret);
      oval(c, 3, 0, 5, 4, p.bark, ret); box(c, 6, -2, 2, 2, p.eye, ret);
      oval(c, 0, -6, 6, 3, ret ? '#d8e8f0' : 'rgba(230,240,255,0.55)', ret);
    } else if (D === 'swarm') { // рой-опылитель: облачко крошечных пчёлок с пыльцой
      for (var bz = 0; bz < 7; bz++) { var ba = u.anim * (2 + bz * 0.3) + bz * 0.9, bxx = Math.cos(ba) * (5 + (bz % 3) * 3), byy = Math.sin(ba * 1.3) * (4 + (bz % 2) * 3) - 6;
        oval(c, bxx, byy, 2.5, 2, bz % 2 ? p.amber : p.amberHi, ret); box(c, bxx - 1, byy - 1, 2, 1, p.bark, ret); }
      oval(c, 0, 4, 5, 2, ret ? '#f8e070' : 'rgba(255,230,120,0.5)', ret);
    } else if (D === 'frostling') { // стужевик: снежный клубень с ледяными гранями и голубыми глазами
      var sq = u.moving ? Math.sin(u.anim * 8) * 1.5 : 0;
      oval(c, 0, 2, 10 + sq, 8 - sq, ret ? '#d0e8f8' : 'rgba(225,240,252,0.92)', ret);
      for (var ic = 0; ic < 5; ic++) { var ia = -Math.PI * 0.85 + ic * Math.PI * 0.42; tri(c, Math.cos(ia) * 13, Math.sin(ia) * 11 - 2, Math.cos(ia) * 6 - 3, Math.sin(ia) * 5, Math.cos(ia) * 6 + 3, Math.sin(ia) * 5, p.ice, ret); }
      oval(c, -2, -1, 5, 3, p.iceHi, ret); box(c, 3, -2, 3, 3, ret ? '#2878d8' : '#3a8ad8', ret); box(c, 3, 3, 3, 2, ret ? '#2878d8' : '#3a8ad8', ret);
    }
    else if (D === 'mason' || D === 'zoryanka') { // каменщик / резчица Зорянка: приземистые, войлочный капюшон-колпак, каменные наплечники; у Зорянки — охряный платок и резец
      var zo = D === 'zoryanka';
      box(c, -6, 2 + bob * 0.3, 5, 6, p.stoneLo, ret); box(c, 1, 2 - bob * 0.3, 5, 6, p.stoneLo, ret);          // обмотки
      oval(c, 0, -1, 8, 8, zo ? p.feltHi : p.felt, ret);                                                   // войлочная рубаха
      box(c, -5, -2, 10, 8, p.stone, ret, 2); box(c, -5, 2, 10, 1, p.stoneLo, ret);                         // каменный фартук
      oval(c, -8, -5, 4, 3, p.stoneHi, ret); oval(c, 8, -5, 4, 3, p.stoneHi, ret);                         // наплечники
      oval(c, 1, -10, 5, 5, p.skin, ret);
      tri(c, 1, -22, -6, -10, 8, -10, zo ? p.ochre : p.felt, ret); box(c, -6, -11, 14, 2, p.rune, ret);  // колпак с рунной лентой
      if (zo) { box(c, -7, -8, 4, 9, p.ochre, ret, 2); }                                                   // концы платка
      if (u.work) { c.save(); c.translate(6, -2); c.rotate(Math.sin(u.anim * 11) * 0.9 - 0.5); line(c, 0, 0, 0, -10, p.wood2, 2); box(c, -3, -13, 6, 4, p.stoneLo, ret); c.restore(); }
      if (u.carry) { if (u.carry.type === 'stone') { box(c, -14, -8, 9, 8, p.stone, ret, 2); box(c, -13, -8, 4, 3, p.stoneHi, ret); } else if (u.carry.type === 'ore') { oval(c, -9, -4, 5, 4, p.ore, ret); oval(c, -10, -5, 2, 2, p.rune, ret); } else oval(c, -8, -4, 4, 4, u.carry.type === 'timber' ? p.plankHi : p.amber, ret); }
    } else if (D === 'slinger') { // пращник: войлочный плащ до земли, рунный пояс, праща над головой
      tri(c, 0, -12, -9, 9, 9, 9, p.felt, ret); box(c, -6, 0, 12, 2, p.rune, ret);
      oval(c, 1, -11, 5, 5, p.skin, ret); oval(c, 1, -15, 6, 3, p.feltHi, ret);                            // голова, шапочка
      var sa = u.anim * (u.cd > 0.2 ? 14 : 4); line(c, 4, -8, 4 + Math.cos(sa) * 9, -18 + Math.sin(sa) * 4, p.trunk, 1.5); oval(c, 4 + Math.cos(sa) * 9, -18 + Math.sin(sa) * 4, 2.5, 2.5, p.stoneHi, ret);
    } else if (D === 'boulder') { // валун-страж: круглый валун на коротких каменных ножках, вырезанное лицо и рунный пояс
      var rl = u.roll ? u.anim * 14 : 0, sw2 = u.moving && !u.roll ? Math.sin(u.anim * 6) * 2 : 0;
      if (!u.roll) { box(c, -10, 8 + sw2 * 0.5, 7, 6, p.stoneLo, ret); box(c, 3, 8 - sw2 * 0.5, 7, 6, p.stoneLo, ret); }
      oval(c, 0, -1, 15, 13, p.stone, ret); oval(c, -4, -5, 8, 6, p.stoneHi, ret);
      c.save(); c.rotate(rl); box(c, -15, -2, 30, 3, p.rune, ret); c.restore();                           // рунный пояс (крутится при раскате)
      if (!u.roll) { box(c, 4, -7, 3, 3, p.rune, ret); box(c, 9, -7, 3, 3, p.rune, ret); box(c, 5, 2, 7, 2, p.stoneLo, ret); }   // глаза-руны, рот
      oval(c, -9, 5, 3, 2, p.stoneLo, ret); oval(c, 6, 8, 2, 2, p.stoneLo, ret);
      if (u.roll) for (var dz = 0; dz < 3; dz++) oval(c, -16 - dz * 6, 10 - dz, 3 - dz * 0.6, 2, 'rgba(180,170,150,' + (0.6 - dz * 0.18) + ')', ret);   // пыль
    } else if (D === 'vedogor') { // старейшина Ведогор: длинный войлочный плащ, белая борода, посох с рунным камнем
      tri(c, 0, -14, -11, 10, 10, 10, p.felt, ret); tri(c, 0, -10, -5, 10, 6, 10, p.feltHi, ret);
      oval(c, 1, -13, 5, 5, p.skin, ret); tri(c, 1, -2, -3, -11, 6, -11, '#ece8e0', ret);                 // борода
      oval(c, 1, -17, 6, 3, p.stoneHi, ret);                                                             // каменный обруч
      line(c, 9, 10, 9, -22, p.wood2, 2); oval(c, 9, -25, 4, 4, p.stone, ret); oval(c, 9, -25, 2, 2, p.rune, ret);
      if (!ret) { c.fillStyle = 'rgba(95,224,207,0.18)'; c.beginPath(); c.arc(9, -25, 8, 0, 7); c.fill(); }
    } else if (D === 'herder') { // пастух с козой: овчинный тулуп, посох; рядом белая коза
      box(c, -4, 2 + bob * 0.3, 3, 6, p.fur, ret); box(c, 1, 2 - bob * 0.3, 3, 6, p.fur, ret);
      oval(c, 0, -1, 6, 7, ret ? '#c8b088' : '#c9b48e', ret); oval(c, 0, -10, 4, 4, p.skin, ret); box(c, -4, -15, 8, 4, p.felt, ret, 2);
      line(c, -7, 8, -7, -14, p.wood2, 2);
      oval(c, 11, 4, 6, 4, '#ece6da', ret); oval(c, 16, 1, 3, 3, '#ece6da', ret); line(c, 16, -1, 18, -5, p.stoneLo, 1.5); box(c, 8, 7, 2, 4, p.stoneLo, ret); box(c, 13, 7, 2, 4, p.stoneLo, ret);
    } else if (D === 'cart') { // волокуша с очагом: полозья, каменная жаровня с огнём, тягловый каменщик
      box(c, -18, 8, 34, 2, p.trunk, ret); line(c, 16, 9, 22, 2, p.trunk, 2);
      box(c, -15, -2, 24, 10, p.wood2, ret, 2); oval(c, -3, -3, 9, 5, p.stone, ret); oval(c, -3, -4, 6, 3, p.stoneLo, ret);
      var fl2 = Math.sin(u.anim * 9) * 2; tri(c, -3, -16 + fl2, -8, -4, 2, -4, p.ember, ret); tri(c, -3, -11 + fl2, -5, -4, -1, -4, '#fff0b0', ret);
      if (!ret) { c.fillStyle = 'rgba(255,170,70,0.14)'; c.beginPath(); c.arc(-3, -6, 26, 0, 7); c.fill(); }
    }
    if (u.stone) { oval(c, 0, -2, u.r + 1, u.r + 2, ret ? 'rgba(150,146,160,0.55)' : 'rgba(150,146,160,0.45)', ret); line(c, -4, -8, 1, -2, p.stoneLo, 1); line(c, 1, -2, -2, 4, p.stoneLo, 1); line(c, 4, -6, 7, 0, p.stoneLo, 1); }   // окаменел
    if (u.chilled && !ret) { c.fillStyle = 'rgba(200,230,255,0.25)'; c.beginPath(); c.arc(0, -2, u.r + 3, 0, 7); c.fill(); }   // стынет в буран
    if (u.rootT > (u._gt || 0)) { line(c, -10, 8, -4, 2, p.bark, 2); line(c, 10, 8, 4, 1, p.bark, 2); line(c, -6, 10, 6, 10, p.trunk, 2); }   // опутан корнями
    c.restore();
  };

  R.building = function (c, b, p, ret, t, game) {
    var X = b.tx * T, Y = b.ty * T, S = b.s * T, cx = X + S / 2, cy = Y + S / 2, k = b.done ? 1 : b.prog;
    c.save();
    if (!b.done && !game.race(b.owner).grow) c.globalAlpha = 0.55 + 0.45 * k;
    switch (b.type) {
      case 'hall':
        shadow(c, cx + 6, Y + S - 6, S * 0.5, 10, ret);
        box(c, X + 4, Y + 10, S - 8, S - 14, ret ? '#5a4020' : '#5d4630', ret, 4);                      // двор
        for (var i = 0; i < 15; i++) { var sx = X + 4 + i * (S - 8) / 14; box(c, sx - 3, Y + 4 + (i % 2) * 2, 6, 14, p.wood2, ret); tri(c, sx, Y, sx - 3, Y + 5, sx + 3, Y + 5, p.woodHi, ret); }     // частокол
        for (var j = 0; j < 15; j++) { var sx2 = X + 4 + j * (S - 8) / 14; box(c, sx2 - 3, Y + S - 18, 6, 16, p.wood2, ret); }
        box(c, cx - 22, cy - 18, 44, 40, p.woodHi, ret, 3); box(c, cx - 22, cy - 18, 44, 4, p.wood2, ret);  // терем-башня
        for (var r = 0; r < 4; r++) box(c, cx - 22, cy - 8 + r * 8, 44, 1, ret ? '#5a3818' : 'rgba(60,36,18,0.6)', ret);
        tri(c, cx, cy - 46, cx - 28, cy - 16, cx + 28, cy - 16, p.copper, ret); tri(c, cx, cy - 46, cx, cy - 16, cx + 28, cy - 16, p.copperHi, ret);
        box(c, cx - 6, cy + 6, 12, 16, '#2a1a0c', ret, 2);                                                // ворота
        line(c, cx, cy - 46, cx, cy - 62, p.iron, 2); tri(c, cx + 1, cy - 62, cx + 1, cy - 52, cx + 14 + Math.sin(t * 3) * 2, cy - 57, p.cloth, false); // флажок
        break;
      case 'house':
        shadow(c, cx + 4, Y + S - 4, S * 0.5, 7, ret);
        box(c, X + 6, cy - 6, S - 12, S / 2 - 2, p.wood2, ret, 2);
        for (var lg = 0; lg < 4; lg++) box(c, X + 6, cy - 6 + lg * 6, S - 12, 2, p.woodHi, ret);
        tri(c, cx, Y + 2, X + 1, cy - 4, X + S - 1, cy - 4, ret ? '#6a4818' : '#7b5a34', ret);
        box(c, cx - 4, cy + 2, 8, 8, ret ? '#ffd060' : '#f5c96a', ret, 1); box(c, X + S - 18, Y + 6, 6, 12, p.iron, ret);
        break;
      case 'gunhouse':
        shadow(c, cx + 6, Y + S - 4, S * 0.5, 8, ret);
        box(c, X + 6, cy - 14, S - 12, S / 2 + 8, p.wood2, ret, 3);
        tri(c, cx, Y + 2, X + 2, cy - 12, X + S - 2, cy - 12, ret ? '#6a4818' : '#7b5a34', ret);
        box(c, X + 10, cy - 2, 18, 18, '#2a1a0c', ret, 2);
        for (var g2 = 0; g2 < 3; g2++) line(c, X + S - 30 + g2 * 7, cy + 18, X + S - 26 + g2 * 7, cy - 6, p.iron, 2);   // пищали у стены
        oval(c, X + S - 14, Y + 14, 8, 8, ret ? '#e8e0c8' : '#e6dcc4', ret); oval(c, X + S - 14, Y + 14, 5, 5, p.copper, ret); oval(c, X + S - 14, Y + 14, 2, 2, '#2a1a0c', ret);  // мишень
        break;
      case 'boiler':
        if (b.smoke && b.done) for (var sp = 0; sp < 5; sp++) { var sph = (t * 0.35 + sp / 5 + b.id * 0.1) % 1; oval(c, cx - 14 + Math.sin(sph * 6 + sp) * 10, Y - 10 - sph * 70, 8 + sph * 18, 6 + sph * 14, ret ? (sp % 2 ? '#686068' : '#787078') : 'rgba(96,92,98,' + (0.6 - sph * 0.5) + ')', ret); }   // дым котельни (кампания Чащи)
        shadow(c, cx + 6, Y + S - 4, S * 0.5, 8, ret);
        box(c, X + 4, cy - 2, S - 8, S / 2 - 2, ret ? '#8a3c28' : '#8e4a36', ret, 3);                     // кирпичное основание
        for (var bi = 0; bi < 3; bi++) box(c, X + 4, cy + 4 + bi * 9, S - 8, 1, 'rgba(40,16,8,0.5)', ret);
        box(c, X + 12, Y + 12, S - 24, 34, p.copper, ret, 12); box(c, X + 18, Y + 16, 8, 26, p.copperHi, ret, 4);  // котёл
        box(c, X + S - 22, Y - 10, 10, 30, p.iron, ret);                                                  // труба
        for (var sm = 0; sm < 4; sm++) { var ph = (t * 0.5 + sm / 4) % 1; oval(c, X + S - 17 + ph * 10, Y - 12 - ph * 28, 4 + ph * 7, 4 + ph * 7, 'rgba(200,200,200,' + (0.45 - ph * 0.4) + ')', ret); }
        oval(c, cx, cy + 14, 6, 5, ret ? '#ffc040' : '#ffcf7a', ret);
        break;
      case 'span': { // пролёт моста: сваи и настил из плах с перилами; в стройке — сваи и леса над водой
        var pl2 = b.done ? 1 : k;
        for (var pi = 0; pi < 4; pi++) { var px = X + 6 + (pi % 2) * (S - 16), py = Y + 4 + ((pi / 2) | 0) * (S - 12); box(c, px, py, 6, 10, p.trunk, ret, 2); }
        if (pl2 > 0.15) { var nPl = Math.max(1, Math.round(8 * Math.min(1, pl2))); for (var pk = 0; pk < nPl; pk++) box(c, X + 2, Y + 2 + pk * (S - 4) / 8, S - 4, (S - 4) / 8 - 1, pk % 2 ? p.plank : p.plankHi, ret, 1); }
        if (b.done) { box(c, X + 1, Y, 3, S, p.wood2, ret); box(c, X + S - 4, Y, 3, S, p.wood2, ret); for (var rp = 0; rp < 3; rp++) { box(c, X, Y + rp * S / 2 - 2, 5, 6, p.trunk, ret); box(c, X + S - 5, Y + rp * S / 2 - 2, 5, 6, p.trunk, ret); } }
        break; }
      case 'stump':
        if (!b.done && !b.planted) { sprout(c, cx, cy, 0.3, p, ret); break; }
        var gs = b.done ? 1 : 0.35 + 0.65 * k;
        c.translate(cx, cy); c.scale(gs, gs); c.translate(-cx, -cy);
        for (var ro = 0; ro < 6; ro++) { var a = ro / 6 * Math.PI * 2 + 0.4; line(c, cx, cy, cx + Math.cos(a) * S * 0.55, cy + Math.sin(a) * S * 0.45, p.bark, 7); }
        shadow(c, cx + 5, cy + 18, S * 0.42, 12, ret);
        oval(c, cx, cy + 6, S * 0.4, S * 0.3, p.bark, ret);
        oval(c, cx, cy - 4, S * 0.38, S * 0.24, p.barkHi, ret);
        for (var ri = 3; ri > 0; ri--) oval(c, cx, cy - 4, S * 0.1 * ri, S * 0.065 * ri, ri % 2 ? (ret ? '#b08850' : '#b8925c') : (ret ? '#906838' : '#9a764a'), ret);   // годовые кольца
        oval(c, cx - 30, cy - 18, 9, 6, p.cap, ret); box(c, cx - 32, cy - 14, 4, 8, p.capDot, ret); oval(c, cx + 34, cy + 6, 7, 5, p.cap, ret); oval(c, cx + 26, cy - 22, 5, 4, p.mossHi, ret);
        oval(c, cx - 14, cy + 22, 12, 6, p.moss, ret);
        for (var lv = 0; lv < b.larva; lv++) { var lx = cx - 12 + lv * 12, ly = cy - 6 + Math.sin(t * 3 + lv) * 1.5; oval(c, lx, ly, 5, 4, ret ? '#f0e8c0' : '#efe6c4', ret); box(c, lx - 3, ly - 1, 6, 1, 'rgba(120,90,40,0.6)', ret); }
        b.cocoons.forEach(function (co, ci) { oval(c, cx + 24 - ci * 10, cy + 10, 5, 7, ret ? '#a8b070' : '#b5ba84', ret); });
        break;
      case 'hollow':
        if (!b.done && !b.planted) { sprout(c, cx, cy, 0.25, p, ret); break; }
        var hs = b.done ? 1 : 0.3 + 0.7 * k; c.translate(cx, Y + S); c.scale(hs, hs); c.translate(-cx, -(Y + S));
        shadow(c, cx + 4, Y + S - 4, S * 0.4, 6, ret);
        box(c, cx - 11, Y + 8, 22, S - 10, p.bark, ret, 6); box(c, cx - 7, Y + 10, 6, S - 16, p.barkHi, ret, 3);
        oval(c, cx + 2, cy + 2, 6, 8, '#1a0f06', ret); oval(c, cx + 2, cy + 2, 2, 2, p.eye, ret);
        oval(c, cx, Y + 4, 20, 12, p.moss, ret); oval(c, cx - 6, Y, 10, 7, p.mossHi, ret);
        break;
      case 'den':
        if (!b.done && !b.planted) { sprout(c, cx, cy, 0.25, p, ret); break; }
        var ds = b.done ? 1 : 0.3 + 0.7 * k; c.translate(cx, cy); c.scale(ds, ds); c.translate(-cx, -cy);
        shadow(c, cx + 5, cy + 22, S * 0.45, 9, ret);
        oval(c, cx, cy + 6, S * 0.44, S * 0.32, ret ? '#3a5a20' : '#3f5a2c', ret);
        for (var th = 0; th < 14; th++) { var a2 = th / 14 * Math.PI * 2, rx = Math.cos(a2) * S * 0.38, ry = Math.sin(a2) * S * 0.26 + 4;
          tri(c, cx + rx * 1.15, cy + ry * 1.2 - 8, cx + rx - 4, cy + ry, cx + rx + 4, cy + ry, p.lichen, ret); }
        oval(c, cx, cy + 2, S * 0.3, S * 0.2, p.moss, ret); oval(c, cx, cy + 8, 10, 7, '#1a0f06', ret);
        for (var be = 0; be < 5; be++) oval(c, cx - 26 + be * 13, cy - 10 + (be % 2) * 18, 3, 3, ret ? '#d83030' : '#c8384a', ret);  // ягоды
        break;
      case 'barrow':
        if (!b.done && !b.planted) { sprout(c, cx, cy, 0.25, p, ret); break; }
        var bs2 = b.done ? 1 : 0.3 + 0.7 * k; c.translate(cx, cy); c.scale(bs2, bs2); c.translate(-cx, -cy);
        shadow(c, cx + 5, cy + 22, S * 0.46, 9, ret);
        oval(c, cx, cy + 8, S * 0.46, S * 0.34, ret ? '#4a6a28' : '#4c6636', ret); oval(c, cx - 6, cy, S * 0.34, S * 0.22, p.moss, ret);
        for (var stn = 0; stn < 3; stn++) { var sx3 = cx - 24 + stn * 22; box(c, sx3, cy - 30 + (stn === 1 ? -6 : 0), 10, 26, p.rock, ret, 3); box(c, sx3 + 2, cy - 28 + (stn === 1 ? -6 : 0), 3, 20, p.rockHi, ret); }
        oval(c, cx + 20, cy + 14, 5, 4, p.cap, ret); oval(c, cx - 22, cy + 18, 6, 3, p.lichen, ret);
        break;
      // ---- Курганный род: камень, войлок, бирюзовые руны ----
      case 'kurgan': // курган: травяной холм, кольцо стоячих камней, каменные двери с рунами, дымок очага из макушки
        shadow(c, cx + 6, Y + S - 6, S * 0.5, 10, ret);
        oval(c, cx, cy + 14, S * 0.5, S * 0.36, ret ? '#5a4a30' : '#5e4d35', ret); oval(c, cx - 4, cy + 6, S * 0.4, S * 0.27, ret ? '#6a5a38' : '#715d40', ret); oval(c, cx - 8, cy - 2, S * 0.28, S * 0.15, ret ? '#4a6a30' : '#5a7442', ret);   // земляной холм с травяной макушкой
        for (var ks = 0; ks < 7; ks++) { var ka = Math.PI * (0.05 + ks / 6 * 0.9), kx = cx - Math.cos(ka) * S * 0.44, ky = cy + 18 - Math.sin(ka) * S * 0.3; box(c, kx - 5, ky - 22, 10, 24, p.stone, ret, 3); box(c, kx - 3, ky - 20, 3, 18, p.stoneHi, ret); }
        box(c, cx - 14, cy + 4, 28, 26, p.stoneLo, ret, 3); box(c, cx - 10, cy + 8, 20, 22, '#1c1820', ret, 2); box(c, cx - 16, cy + 1, 32, 5, p.stone, ret, 2);   // дверной проём
        box(c, cx - 1, cy + 11, 3, 14, p.rune, ret); line(c, cx, cy + 15, cx - 6, cy + 10, p.rune, 2); line(c, cx, cy + 15, cx + 6, cy + 10, p.rune, 2);   // руна-«ёлочка»
        for (var kf = 0; kf < 3; kf++) { var kp = (t * 0.4 + kf / 3 + b.id * 0.1) % 1; oval(c, cx - 4 + Math.sin(kp * 5) * 4, cy - 28 - kp * 30, 3 + kp * 6, 3 + kp * 6, 'rgba(210,205,200,' + (0.45 - kp * 0.4) + ')', ret); }
        break;
      case 'hearth': // очаг: кольцо камней с огнём и каменный заслон от ветра
        shadow(c, cx + 4, Y + S - 4, S * 0.48, 7, ret);
        box(c, X + 4, Y + 6, S - 8, 16, p.stone, ret, 4); box(c, X + 6, Y + 8, S - 12, 4, p.stoneHi, ret, 2);
        for (var hs2 = 0; hs2 < 8; hs2++) { var ha = hs2 / 8 * Math.PI * 2; oval(c, cx + Math.cos(ha) * 15, cy + 10 + Math.sin(ha) * 8, 5, 4, hs2 % 2 ? p.stone : p.stoneLo, ret); }
        if (b.done) { var hf = Math.sin(t * 8 + b.id) * 2; tri(c, cx, cy - 8 + hf, cx - 8, cy + 10, cx + 8, cy + 10, p.ember, ret); tri(c, cx, cy - 1 + hf, cx - 4, cy + 10, cx + 4, cy + 10, '#fff0b0', ret);
          if (!ret) { c.fillStyle = 'rgba(255,170,70,0.12)'; c.beginPath(); c.arc(cx, cy + 4, S * 0.8, 0, 7); c.fill(); } }
        break;
      case 'slingery': // пращная: каменная ограда, навес из войлока, мишени-камни на столбах
        shadow(c, cx + 6, Y + S - 4, S * 0.5, 8, ret);
        box(c, X + 4, cy - 2, S - 8, S / 2 - 4, p.stone, ret, 3); for (var sr = 0; sr < 4; sr++) box(c, X + 6 + sr * (S - 12) / 4, cy + 4, (S - 12) / 4 - 2, 6, p.stoneHi, ret, 1);
        tri(c, cx, Y + 6, X + 6, cy - 2, X + S - 6, cy - 2, p.felt, ret); box(c, X + 8, cy - 6, S - 16, 3, p.rune, ret);
        for (var sp3 = 0; sp3 < 2; sp3++) { var spx = X + 16 + sp3 * (S - 32); line(c, spx, cy + 26, spx, cy + 8, p.trunk, 2); oval(c, spx, cy + 6, 5, 5, p.stoneHi, ret); oval(c, spx, cy + 6, 2, 2, p.ore, ret); }
        break;
      case 'stoneworks': // каменотёсня: навес на каменных столбах, большой валун в работе, рунная плита
        shadow(c, cx + 6, Y + S - 4, S * 0.5, 8, ret);
        box(c, X + 6, Y + 12, 8, S - 20, p.stoneLo, ret); box(c, X + S - 14, Y + 12, 8, S - 20, p.stoneLo, ret); box(c, X + 2, Y + 6, S - 4, 10, p.felt, ret, 3);
        oval(c, cx, cy + 14, 22, 18, p.stone, ret); oval(c, cx - 6, cy + 8, 10, 8, p.stoneHi, ret); box(c, cx - 22, cy + 13, 44, 3, p.rune, ret);
        box(c, X + S - 30, cy + 22, 18, 12, p.stoneHi, ret, 2); line(c, X + 16, cy + 30, X + 26, cy + 14, p.wood2, 2); box(c, X + 23, cy + 10, 6, 5, p.iron, ret);
        break;
      case 'wall': // каменная стена: тёсаные блоки
        shadow(c, cx + 3, Y + S - 3, S * 0.5, 4, ret);
        box(c, X + 1, Y + 4, S - 2, S - 6, p.stone, ret, 2); box(c, X + 1, Y + 4, S - 2, 4, p.stoneHi, ret, 2);
        box(c, X + 1, Y + 15, S - 2, 1, p.stoneLo, ret); box(c, cx, Y + 8, 1, 7, p.stoneLo, ret); box(c, X + 8, Y + 16, 1, 10, p.stoneLo, ret); box(c, X + S - 9, Y + 16, 1, 10, p.stoneLo, ret);
        break;
      case 'idol': { // идол: стоячий камень с вырезанным ликом; спит — тусклый, проснулся — светятся руны
        var aw = !b.asleep;
        shadow(c, cx + 5, Y + S - 4, S * 0.42, 7, ret);
        box(c, cx - 14, Y - 14, 28, S + 8, p.stoneLo, ret, 8); box(c, cx - 11, Y - 11, 22, S + 2, p.stone, ret, 6); box(c, cx - 8, Y - 8, 6, S - 6, p.stoneHi, ret, 3);
        box(c, cx - 7, Y + 4, 5, 4, aw ? p.rune : p.stoneLo, ret); box(c, cx + 3, Y + 4, 5, 4, aw ? p.rune : p.stoneLo, ret); box(c, cx - 5, Y + 16, 11, 3, aw ? p.rune : p.stoneLo, ret);
        box(c, cx - 11, Y + 30, 22, 3, aw ? p.rune : p.stoneLo, ret);
        if (aw && !ret) { c.fillStyle = 'rgba(95,224,207,' + (0.12 + 0.06 * Math.sin(t * 3)) + ')'; c.beginPath(); c.arc(cx, Y + 10, 26, 0, 7); c.fill(); }
        if (!aw) { c.globalAlpha = 0.85; oval(c, cx + 12, Y - 14, 4, 3, '#e8f0f8', ret); oval(c, cx + 18, Y - 20, 3, 2, '#e8f0f8', ret); c.globalAlpha = 1; }   // «спит»
        break; }
      case 'iceheart': { // сердце Зимнего вала: гроздь ледяных кристаллов с голубым пульсом
        var ip = 0.5 + 0.5 * Math.sin(t * 2);
        shadow(c, cx + 6, Y + S - 8, S * 0.5, 12, ret);
        if (!ret) { c.fillStyle = 'rgba(150,210,255,' + (0.12 + 0.12 * ip) + ')'; c.beginPath(); c.arc(cx, cy, S * 0.7, 0, 7); c.fill(); }
        [[-36, 20, 16, 50], [30, 18, 14, 44], [-14, 12, 18, 70], [14, 8, 16, 62], [0, 20, 22, 90]].forEach(function (q, i) { tri(c, cx + q[0], cy + q[1] - q[3], cx + q[0] - q[2], cy + q[1], cx + q[0] + q[2], cy + q[1], i % 2 ? p.ice : p.iceHi, ret); tri(c, cx + q[0], cy + q[1] - q[3], cx + q[0] - q[2] * 0.3, cy + q[1], cx + q[0] + q[2] * 0.4, cy + q[1], '#f4fbff', ret); });
        oval(c, cx, cy + 6, 10 + ip * 3, 8 + ip * 2, ret ? '#58a8f8' : 'rgba(80,160,240,0.85)', ret);
        break; }
    }
    c.restore();
    if (!b.done && !game.race(b.owner).grow) { // леса стройки
      c.strokeStyle = ret ? '#c8a060' : 'rgba(220,180,110,0.85)'; c.lineWidth = 2; c.strokeRect(X + 3, Y + 3, S - 6, S - 6);
      line(c, X + 3, Y + 3, X + S - 3, Y + S - 3, c.strokeStyle, 1); line(c, X + S - 3, Y + 3, X + 3, Y + S - 3, c.strokeStyle, 1);
    }
  };
  function sprout(c, x, y, s, p, ret) {
    oval(c, x, y + 6, 12, 5, p.bark, ret); line(c, x, y + 6, x, y - 8, p.moss, 3);
    oval(c, x - 6, y - 8, 6, 3, p.mossHi, ret); oval(c, x + 6, y - 11, 6, 3, p.mossHi, ret);
  }
  R.node = function (c, n, p, ret, t) {
    var X = n.tx * T, Y = n.ty * T, cx = X + n.s * T / 2, cy = Y + n.s * T / 2, f = Math.max(0.35, n.amt / (n.amt0 || P.consts.NODE_AMT[n.type]));
    if (n.type === 'timber') { // сухостой: поваленные стволы под снегом и пень
      var nl = Math.max(1, Math.ceil(f * 3));
      shadow(c, cx + 3, cy + 10, 15, 5, ret);
      for (var lg = 0; lg < nl; lg++) { var ly = cy + 6 - lg * 6, lx = cx - 12 + (lg % 2) * 3; box(c, lx, ly - 3, 24, 6, p.trunk, ret, 3); oval(c, lx + 24, ly, 3, 3, p.woodHi, ret); oval(c, lx + 24, ly, 1.5, 1.5, p.wood2, ret); }
      box(c, cx - 10, cy + 3 - nl * 6, 20, 3, p.snow[0], ret, 2);
      box(c, cx + 8, cy - 16, 6, 14, p.trunk, ret); oval(c, cx + 11, cy - 16, 4, 2, p.snow[0], ret);
      return;
    }
    if (n.type === 'stone') { // каменная россыпь: тёсаные глыбы (Курганный род)
      shadow(c, cx + 3, cy + 10, 15, 5, ret); var ns = Math.max(1, Math.ceil(f * 4));
      [[-8, 4, 10, 9], [5, 5, 11, 8], [-2, -4, 10, 9], [8, -5, 7, 7]].slice(0, ns).forEach(function (q) { box(c, cx + q[0] - q[2] / 2, cy + q[1] - q[3] / 2, q[2], q[3], p.stone, ret, 2); box(c, cx + q[0] - q[2] / 2, cy + q[1] - q[3] / 2, q[2], 3, p.stoneHi, ret, 1); });
      return;
    }
    if (n.type === 'ore') { // рудная жила 2×2: скала с рыжими и бирюзовыми прожилками
      shadow(c, cx + 4, cy + 18, 28, 8, ret);
      oval(c, cx, cy + 6, 27, 18, p.stoneLo, ret); oval(c, cx - 4, cy, 22, 14, p.stone, ret); oval(c, cx - 9, cy - 5, 9, 6, p.stoneHi, ret);
      var nv = Math.max(1, Math.ceil(f * 4)); for (var ov = 0; ov < nv; ov++) { line(c, cx - 16 + ov * 9, cy + 10 - ov * 3, cx - 8 + ov * 9, cy - 2 - ov * 2, ov % 2 ? p.rune : p.ore, 3); oval(c, cx - 8 + ov * 9, cy - 2 - ov * 2, 2.5, 2.5, ov % 2 ? p.rune : p.oreHi, ret); }
      return;
    }
    if (n.type === 'amber') {
      shadow(c, cx + 3, cy + 10, 14, 5, ret);
      oval(c, cx, cy + 6, 14, 7, p.rock, ret);
      var cr = [[-6, -2, 6, 14], [3, -5, 5, 18], [8, 2, 4, 10]];
      cr.forEach(function (q) { var h = q[3] * f; tri(c, cx + q[0], cy + q[1] - h + 6, cx + q[0] - q[2], cy + q[1] + 6, cx + q[0] + q[2], cy + q[1] + 6, p.amber, ret); tri(c, cx + q[0], cy + q[1] - h + 6, cx + q[0] - q[2] * 0.3, cy + q[1] + 6, cx + q[0] + q[2] * 0.4, cy + q[1] + 6, p.amberHi, ret); });
      if (!ret) { var tw = (Math.sin(t * 2 + n.id) + 1) / 2; c.fillStyle = 'rgba(255,240,180,' + (0.5 * tw) + ')'; c.fillRect(cx + 2, cy - 10, 2, 2); }
    } else {
      shadow(c, cx + 4, cy + 18, 28, 8, ret);
      oval(c, cx, cy + 6, 27, 16, p.shore, ret); oval(c, cx, cy + 6, 22, 12, p.resin, ret); oval(c, cx - 5, cy + 3, 10, 5, p.resinHi, ret);
      box(c, cx + 8, cy - 22, 12, 22, p.trunk, ret, 3); oval(c, cx + 14, cy - 22, 7, 4, p.barkHi, ret);   // пень-смолокур
      var dr = (t * 0.7 + n.id * 0.3) % 1; oval(c, cx + 9, cy - 10 + dr * 14, 2, 3, p.resinHi, ret);
    }
  };

  // ---------- Мир целиком ----------
  // v: {x, y, w, h, sx, sy} — камера в мире и прямоугольник вида на экране
  R.world = function (c, game, v, theme, st) {
    var p = R.pal(theme), ret = theme === 'retro', t = st.t, pl = 0, MW = game.MW, MH = game.MH;
    c.save(); c.beginPath(); c.rect(v.sx, v.sy, v.w, v.h); c.clip();
    c.translate(v.sx - Math.round(v.x), v.sy - Math.round(v.y));
    c.imageSmoothingEnabled = !ret;
    var terr = R.terrain(game, theme);
    c.drawImage(terr, v.x, v.y, v.w, v.h, v.x, v.y, v.w, v.h);
    var x0 = Math.max(0, Math.floor(v.x / T)), y0 = Math.max(0, Math.floor(v.y / T)), x1 = Math.min(MW - 1, Math.floor((v.x + v.w) / T)), y1 = Math.min(MH - 1, Math.floor((v.y + v.h) / T));
    // грибница Чащи (видимая/разведанная)
    for (var q = 0; q < (game.sides || 2); q++) { var M = game.myc[q]; if (!game.race(q).grow) continue;
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) { if (!M[y * MW + x] || (q !== pl && game.tileVis(pl, x, y) < 2)) continue;
        c.fillStyle = p.myc; c.fillRect(x * T, y * T, T, T);
        var h = hash(x, y); c.fillStyle = p.mycLine;
        if (ret) { c.fillRect(x * T + ((h * 24) | 0), y * T + 6, 3, 3); c.fillRect(x * T + 4, y * T + ((h * 20) | 0) + 8, 3, 3); }
        else { if (h > 0.4) { c.strokeStyle = p.mycLine; c.lineWidth = 1; c.beginPath(); c.moveTo(x * T, y * T + h * T); c.quadraticCurveTo(x * T + T / 2, y * T + (1 - h) * T, x * T + T, y * T + T * hash(x + 1, y)); c.stroke(); }
          c.fillStyle = p.mycLine; c.fillRect(x * T + ((h * 97 % 1) * 28 | 0), y * T + ((h * 53 % 1) * 28 | 0), 2, 2); }
      } }
    if (st.under) st.under(c, p, ret);   // кампания: зоны-подсказки, знамёна (в координатах мира)
    // выделение (под сущностями)
    st.sel.forEach(function (e) { if (e.dead) return; var rr = e.kind === 'u' ? e.r + 3 : e.s * T * 0.6; c.strokeStyle = sideCol(game, e, p); c.lineWidth = 2;
      if (ret) c.strokeRect(e.x - rr, e.y - rr * 0.6 + (e.kind === 'u' ? e.r * 0.5 : 0), rr * 2, rr * 1.2);
      else { c.beginPath(); c.ellipse(e.x, e.y + (e.kind === 'u' ? e.r * 0.55 : e.s * T * 0.2), rr, rr * 0.55, 0, 0, Math.PI * 2); c.stroke(); } });
    // сущности по глубине
    var list = [];
    for (var i = 0; i < game.ents.length; i++) { var e = game.ents[i]; if (e.dead) continue;
      var ex = e.kind === 'u' ? e.x : e.tx * T, ey = e.kind === 'u' ? e.y : e.ty * T, es = e.kind === 'u' ? 40 : e.s * T + 40;
      if (ex + es < v.x - 40 || ex - 40 > v.x + v.w || ey + es < v.y - 40 || ey - 60 > v.y + v.h) continue;
      if (e.kind === 'u' && e.owner !== pl && !game.visibleTo(e, pl)) continue;
      if (e.kind !== 'u' && !game.visibleTo(e, pl)) continue;
      list.push(e); }
    var depth = function (e) { return e.kind === 'u' ? e.y : e.type === 'span' ? -1e9 + e.ty : (e.ty + e.s) * T - 6; }; // настил моста — под всеми
    list.sort(function (a, b) { return depth(a) - depth(b); });
    // третья сторона (союзник/нейтрал): тонкое кольцо её цвета под юнитами — чтобы не путать с врагом той же расы
    if (game.sides > 2) list.forEach(function (e) { if (e.kind !== 'u' || e.owner < 2) return; c.strokeStyle = sideCol(game, e, p); c.globalAlpha = 0.8; c.lineWidth = 2;
      if (ret) c.strokeRect(e.x - e.r - 2, e.y + e.r * 0.2, e.r * 2 + 4, e.r * 0.8); else { c.beginPath(); c.ellipse(e.x, e.y + e.r * 0.6, e.r + 2, e.r * 0.45, 0, 0, 6.29); c.stroke(); } c.globalAlpha = 1; });
    list.forEach(function (e) { if (e.kind === 'n') R.node(c, e, p, ret, t); else if (e.kind === 'b') R.building(c, e, p, ret, t, game); else { e._gt = game.t; R.unit(c, e, p, ret, t, game.races[e.owner]); } });
    // споры в полёте (кампания Чащи): пушистые семена по дуге
    (game.sporeFly || []).forEach(function (f) { var k = Math.max(0, Math.min(1, (game.t - f.t0) / (f.t1 - f.t0))), sx = f.x0 + (f.x1 - f.x0) * k, sy = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 60;
      for (var sd = 0; sd < 4; sd++) { var a = t * 3 + sd * 1.6; oval(c, sx + Math.cos(a) * 6, sy + Math.sin(a) * 4, 3, 3, sd % 2 ? p.lichen : '#f4f0dc', ret); } line(c, sx, sy, sx, sy + 6, p.moss, 1); });
    // выстрелы
    game.shots.forEach(function (s) { if (s.owner !== pl && game.tileVis(pl, Math.floor(s.x1 / T), Math.floor(s.y1 / T)) < 2) return; var k = s.t / s.dur;
      if (s.kind === 'shooter') { line(c, s.x0, s.y0 - 6, s.x1, s.y1, ret ? '#ffe080' : 'rgba(255,230,150,' + (1 - k) + ')', 2); oval(c, s.x0 + (s.x1 - s.x0) * 0.08, s.y0 - 6, 3, 3, '#fff2c0', ret); }
      else if (s.kind === 'walker' || s.kind === 'stomper') { var bx = s.x0 + (s.x1 - s.x0) * k, by = s.y0 + (s.y1 - s.y0) * k - Math.sin(k * Math.PI) * 30; oval(c, bx, by, 4, 4, '#2a2a2a', ret); }
      else if (s.kind === 'slinger' || s.kind === 'vedogor') { var sx2 = s.x0 + (s.x1 - s.x0) * k, sy2 = s.y0 + (s.y1 - s.y0) * k - Math.sin(k * Math.PI) * 22; oval(c, sx2, sy2 - 6, 3, 3, s.kind === 'vedogor' ? p.rune : p.stoneHi, ret); }
      else if (s.kind === 'idol') { line(c, s.x0, s.y0 - 24, s.x1, s.y1, ret ? '#58f0d8' : 'rgba(95,224,207,' + (1 - k) + ')', 3); }
      else if (s.kind === 'shell') { for (var n = 0; n < 3; n++) { var tx = s.x0 + (s.x1 - s.x0) * k + n * 4 - 4, ty = s.y0 + (s.y1 - s.y0) * k - Math.sin(k * Math.PI) * 18 + n * 3; tri(c, tx, ty - 5, tx - 2, ty + 2, tx + 2, ty + 2, p.lichen, ret); } }
      else { oval(c, s.x1, s.y1, 6 * (1 - k) + 2, 6 * (1 - k) + 2, 'rgba(255,255,255,' + (0.7 * (1 - k)) + ')', ret); } });
    // эффекты (взрывы, кольца приказов)
    st.fx.forEach(function (f) { var k = f.t / f.dur;
      if (f.kind === 'boom') { for (var i2 = 0; i2 < 7; i2++) { var a = i2 / 7 * 6.28 + f.seed, d = k * f.r; oval(c, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.7, (1 - k) * f.r * 0.35 + 1, (1 - k) * f.r * 0.35 + 1, i2 % 2 ? f.c1 : f.c2, ret); } }
      else if (f.kind === 'ring') { c.strokeStyle = f.c1; c.globalAlpha = 1 - k; c.lineWidth = 2; if (ret) c.strokeRect(f.x - 12 * (1 - k) - 3, f.y - 7 * (1 - k) - 2, 24 * (1 - k) + 6, 14 * (1 - k) + 4); else { c.beginPath(); c.ellipse(f.x, f.y, 14 * (1 - k) + 3, 8 * (1 - k) + 2, 0, 0, 6.29); c.stroke(); } c.globalAlpha = 1; }
      else if (f.kind === 'text') { c.globalAlpha = 1 - k; c.fillStyle = f.c1; c.font = '700 12px ' + (ret ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif'); c.textAlign = 'center'; c.fillText(f.text, f.x, f.y - 20 * k); c.globalAlpha = 1; } });
    // полоски здоровья: выделенные, повреждённые, стройка
    list.forEach(function (e) { if (e.kind === 'n') return; var hurt = e.hp < e.maxhp - 0.5, isSel = st.selSet.has(e.id);
      if (!hurt && !isSel && (e.kind !== 'b' || e.done)) return;
      var w = e.kind === 'u' ? e.r * 2 + 4 : e.s * T - 12, bx = e.x - w / 2, by = e.kind === 'u' ? e.y - e.r - 16 : e.ty * T - 4, f = Math.max(0, e.hp / e.maxhp);
      box(c, bx - 1, by - 1, w + 2, 5, 'rgba(0,0,0,0.7)', true);
      box(c, bx, by, w * f, 3, f > 0.6 ? p.hpGood : (f > 0.3 ? p.hpMid : p.hpBad), true);
      if (e.kind === 'b' && !e.done) { box(c, bx, by + 5, w, 3, 'rgba(0,0,0,0.6)', true); box(c, bx, by + 5, w * e.prog, 3, game.race(e.owner).grow ? p.mossHi : p.copperHi, true); }
      if (e.kind === 'b' && e.done && e.queue.length && e.owner === pl) { var q0 = e.queue[0], ut = game.race(e.owner).units[q0.type]; box(c, bx, by + 5, w, 3, 'rgba(0,0,0,0.6)', true); box(c, bx, by + 5, w * q0.t / ut.time, 3, p.accent, true); } });
    // точка сбора выбранного здания
    st.sel.forEach(function (e) { if (e.kind === 'b' && e.rally && e.owner === pl) { c.setLineDash([5, 5]); line(c, e.x, e.y, e.rally.x, e.rally.y, 'rgba(120,230,150,0.7)', 1.5); c.setLineDash([]); line(c, e.rally.x, e.rally.y, e.rally.x, e.rally.y - 18, p.iron, 2); tri(c, e.rally.x + 1, e.rally.y - 18, e.rally.x + 1, e.rally.y - 10, e.rally.x + 11, e.rally.y - 14, p.sel, false); } });
    if (st.over) st.over(c, p, ret);
    // туман войны
    if (!game.fogOff) R.fog(c, game, v, theme, x0, y0, x1, y1);
    // призрак здания при установке
    if (st.ghost) { var gh = st.ghost, D = game.race(pl).buildings[gh.type];
      for (var gy = 0; gy < D.s; gy++) for (var gx = 0; gx < D.s; gx++) { c.fillStyle = gh.ok ? 'rgba(95,211,138,0.28)' : 'rgba(255,93,93,0.32)'; c.fillRect((gh.tx + gx) * T + 1, (gh.ty + gy) * T + 1, T - 2, T - 2); }
      c.globalAlpha = 0.6; R.building(c, { type: gh.type, tx: gh.tx, ty: gh.ty, s: D.s, done: true, prog: 1, planted: true, larva: 0, cocoons: [], queue: [], owner: pl, x: (gh.tx + D.s / 2) * T, y: (gh.ty + D.s / 2) * T }, p, ret, t, game); c.globalAlpha = 1;
      if (game.race(pl).grow && !D.anywhere) { c.strokeStyle = 'rgba(232,226,196,0.5)'; c.lineWidth = 1; c.strokeRect(gh.tx * T, gh.ty * T, D.s * T, D.s * T); } }
    c.restore();
  };
  R.fog = function (c, game, v, theme, x0, y0, x1, y1) {
    var ret = theme === 'retro', p = R.pal(theme), MW = game.MW, MH = game.MH;
    var fc = game._fogCv || (game._fogCv = Object.assign(document.createElement('canvas'), { width: MW, height: MH })), fx = fc.getContext('2d');
    var img = game._fogImg || (game._fogImg = fx.createImageData(MW, MH)), V = game.vis[0], d = img.data, col = parseInt(p.fog.slice(1), 16);
    for (var i = 0; i < MW * MH; i++) { var a = V[i] === 2 ? 0 : (V[i] === 1 ? 130 : 255); d[i * 4] = col >> 16 & 255; d[i * 4 + 1] = col >> 8 & 255; d[i * 4 + 2] = col & 255; d[i * 4 + 3] = a; }
    fx.putImageData(img, 0, 0);
    c.imageSmoothingEnabled = !ret;
    if (ret) { c.drawImage(fc, 0, 0, MW * T, MH * T); }
    else { c.drawImage(fc, -T / 2, -T / 2, MW * T + T, MH * T + T); } // мягкий край (сглаживание при растяжении)
    c.imageSmoothingEnabled = !ret;
  };

  // ---------- Мини-карта ----------
  R.minimap = function (c, game, r, theme, cam, view, pings, t) {
    var p = R.pal(theme), ret = theme === 'retro', MW = game.MW, MH = game.MH, k = r.w / (MW * T);
    c.save(); c.imageSmoothingEnabled = false;
    c.drawImage(R.miniBase(game, theme, r.w), r.x, r.y, r.w, r.h);
    var sx = r.w / MW, sy = r.h / MH;
    for (var q = 0; q < (game.sides || 2); q++) if (game.race(q).grow) { c.fillStyle = 'rgba(30,48,22,0.6)'; for (var i = 0; i < MW * MH; i++) if (game.myc[q][i] && (q === 0 || game.vis[0][i] === 2)) c.fillRect(r.x + (i % MW) * sx, r.y + ((i / MW) | 0) * sy, sx, sy); }
    game.ents.forEach(function (e) { if (e.dead || !game.visibleTo(e, 0)) return;
      var col = e.kind === 'n' ? (e.type === 'amber' ? p.amber : e.type === 'timber' ? p.plankHi : e.type === 'stone' ? p.stoneHi : e.type === 'ore' ? p.oreHi : p.resinHi) : sideCol(game, e, p), s = e.kind === 'u' ? 3 : e.s * sx;
      c.fillStyle = col; if (e.kind === 'u') c.fillRect(r.x + e.x * k - 1.5, r.y + e.y * k - 1.5, 3, 3); else c.fillRect(r.x + e.tx * sx, r.y + e.ty * sy, s, s); });
    if (!game.fogOff) { var fc = game._fogCv; if (fc) { c.globalAlpha = 0.85; c.imageSmoothingEnabled = !ret; c.drawImage(fc, r.x, r.y, r.w, r.h); c.globalAlpha = 1; } }
    pings.forEach(function (pg) { var a = (t - pg.t); if (a > 3) return; var rr = 4 + (a % 1) * 14; c.strokeStyle = p.enemy; c.lineWidth = 2; c.strokeRect(r.x + pg.x * k - rr, r.y + pg.y * k - rr, rr * 2, rr * 2); });
    c.strokeStyle = '#ffffff'; c.lineWidth = 1; c.strokeRect(r.x + cam.x * k + 0.5, r.y + cam.y * k + 0.5, view.w * k, view.h * k);
    c.strokeStyle = p.line; c.lineWidth = 2; c.strokeRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    c.restore();
  };
  // Иконка сущности для панели и кнопок (рисуем ту же фигуру в масштабе)
  R.icon = function (c, game, owner, kind, type, x, y, size, theme) {
    var p = R.pal(theme), ret = theme === 'retro';
    c.save(); c.beginPath(); c.rect(x, y, size, size); c.clip();
    if (kind === 'u') { var D = game.race(owner).units[type], sc = size / (D.r * 3.2); c.translate(x + size / 2, y + size / 2 + 3); c.scale(sc, sc);
      R.unit(c, { x: 0, y: 0, r: D.r, fx: 1, fy: 0, type: type, anim: 0, id: 1, moving: false, work: false }, p, ret, 0); }
    else { var B = game.race(owner).buildings[type], s2 = size / (B.s * T * 1.15); c.translate(x + size / 2, y + size / 2 + 4); c.scale(s2, s2); c.translate(-B.s * T / 2, -B.s * T / 2);
      R.building(c, { type: type, tx: 0, ty: 0, s: B.s, done: true, prog: 1, planted: true, larva: 0, cocoons: [], queue: [], owner: owner, x: B.s * T / 2, y: B.s * T / 2 }, p, ret, 0, game); }
    c.restore();
  };
})(typeof window !== 'undefined' ? window : globalThis);
