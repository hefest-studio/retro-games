/* ПЕРЕПРАВА · рендер RETRO (8-бит). PEREPRAVA.classic = { P, bg, draw, lifeIcon }
   Тот же двор, что в modern, но пиксельно: ограниченная палитра, спрайты из строк-масок
   (Шуруп, Шайба, паук, деталь-приз), брёвна и транспорт — прямоугольниками с фаской. */
(function (global) {
  'use strict';
  var K = global.PEREPRAVA = global.PEREPRAVA || {};
  var L = K.logic;
  var W = L.W, CW = L.CW, RH = L.RH;

  var P = {
    pixel: true, font: '"Courier New", ui-monospace, monospace',
    hudBg: '#000000', hudLine: '#3c3cbc', ink: '#fcfcfc', muted: '#a4a4a4', accent: '#fc9838',
    good: '#58d854', bad: '#f83800', warn: '#f8b800', panel: '#000000', bar: '#202060',
    life: '#f8b800', lifeOff: '#303030'
  };
  var CAR = { cart: '#e47c24', lift: '#f8b800', moto: '#f83800', roller: '#40a070', truck: '#3c7cf8' };
  function ry(r) { return L.rowY(r); }
  function rect(ctx, c, x, y, w, h) { ctx.fillStyle = c; ctx.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, w, h); }

  // Спрайты: символ → цвет; 1 символ = 2×2 px
  var SPR = {
    hero: ['..a....a..', '...a..a...', '..bbbbbb..', '.bcbbbbcb.', 'l.bbbbbb.l', '.dddddddd.', 'lddeefeddl', '.ddfffffd.', 'lddeefeddl', '.dddddddd.', 'l.dddddd.l', '...dddd...'],
    washer: ['..gggg..', '.gggggg.', 'ggg..ggg', 'gg....gg', 'gg....gg', 'ggg..ggg', '.gggggg.', '..gggg..'],
    spider: ['s..s..s..s', '.s.s..s.s.', '..kkkkkk..', 's.kkkkkkrs', '.kkkkkkkk.', 's.kkkkkk.s', '..s....s..', '.s......s.'],
    gear: ['...yy...', '.yyyyyy.', '.yy..yy.', 'yy....yy', 'yy....yy', '.yy..yy.', '.yyyyyy.', '...yy...']
  };
  var SPIDER_L = SPR.spider.map(function (r) { return r.split('').reverse().join(''); });
  var COL = { a: '#fc9838', b: '#7c4c10', c: '#3cbcfc', d: '#e4a020', e: '#fcfcfc', f: '#6c6c80', l: '#583010',
    g: '#bcbcbc', s: '#202028', k: '#585868', r: '#f83800', y: '#f8d878' };
  // поворот маски на 90° по ходу (up — как нарисовано)
  var ROT = {};
  function rot(m, face) {
    var key = m.join('|') + face; if (ROT[key]) return ROT[key];
    var h = m.length, w = m[0].length, out = [];
    if (face === 'up') out = m;
    else if (face === 'down') out = m.slice().reverse();
    else for (var c = 0; c < w; c++) { var s = ''; for (var r = 0; r < h; r++) s += face === 'right' ? m[h - 1 - r][c] : m[r][w - 1 - c]; out.push(s); }
    return (ROT[key] = out);
  }
  function sprite(ctx, m, cx, cy, px, tint) {
    var h = m.length, w = m[0].length, x0 = Math.round((cx - w * px / 2) / 2) * 2, y0 = Math.round((cy - h * px / 2) / 2) * 2;
    for (var r = 0; r < h; r++) for (var c = 0; c < w; c++) {
      var ch = m[r][c]; if (ch === '.') continue;
      ctx.fillStyle = tint || COL[ch]; ctx.fillRect(x0 + c * px, y0 + r * px, px, px);
    }
  }

  // ---------- Статичный фон (кэш) ----------
  var cache = null;
  function buildBg() {
    var c = document.createElement('canvas'); c.width = W; c.height = L.H;
    var x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, W, L.H);
    var y0 = ry(0);
    x.fillStyle = '#5c5c5c'; x.fillRect(0, y0, W, RH);
    for (var by = 0; by < RH; by += 8) for (var bx = (by / 8) % 2 * 8; bx < W; bx += 16) { x.fillStyle = '#3c3c3c'; x.fillRect(bx, y0 + by, 14, 6); }
    L.BAY_COLS.forEach(function (col) { var cx = L.colX(col); x.fillStyle = '#000'; x.fillRect(cx - 18, y0 + 4, 36, RH - 4); x.fillStyle = '#fc9838'; x.fillRect(cx - 18, y0 + RH - 2, 36, 2); });
    x.fillStyle = '#000060'; x.fillRect(0, ry(L.RIVER0), W, RH * 5);
    var my = ry(L.MEDIAN);
    x.fillStyle = '#8c8c8c'; x.fillRect(0, my, W, RH);
    for (var i = 0; i < W; i += 16) { x.fillStyle = '#6c6c6c'; x.fillRect(i, my, 2, RH); }
    for (i = 0; i < W; i += 8) { x.fillStyle = (i / 8) % 2 ? '#f8b800' : '#000'; x.fillRect(i, my + RH - 4, 8, 4); }
    x.fillStyle = '#101010'; x.fillRect(0, ry(L.ROAD0), W, RH * 5);
    for (var r = L.ROAD0 + 1; r <= L.ROAD1; r++) for (i = 4; i < W; i += 32) { x.fillStyle = '#bcbcbc'; x.fillRect(i, ry(r) - 1, 16, 2); }
    var fy = ry(L.START);
    x.fillStyle = '#583010'; x.fillRect(0, fy, W, RH);
    for (i = 0; i < W; i += 16) { x.fillStyle = '#7c4c10'; x.fillRect(i + 2, fy + 8, 12, RH - 10); }
    for (i = 0; i < W; i += 8) { x.fillStyle = (i / 8) % 2 ? '#f8b800' : '#000'; x.fillRect(i, fy, 8, 4); }
    return c;
  }
  function bg(ctx) { if (!cache) cache = buildBg(); ctx.drawImage(cache, 0, 0); }

  function water(ctx, S) {
    for (var r = L.RIVER0; r <= L.RIVER1; r++) {
      var lane = S.cfg.lanes[r], y = ry(r);
      for (var i = 0; i < 7; i++) {
        var xx = Math.round((L.mod(i * 71 + r * 29 + lane.v * 0.5 * S.time, W + 40) - 20) / 4) * 4;
        rect(ctx, '#2038ec', xx, y + 8 + ((i * 11 + r * 5) % 24), 12, 2);
      }
    }
  }

  function bays(ctx, S) {
    var y = ry(0) + RH / 2 + 2, t = S.time;
    S.bays.forEach(function (b) {
      if (b.filled) {
        rect(ctx, '#7c4c10', b.x - 12, y - 6, 24, 16); rect(ctx, '#c84c0c', b.x - 12, y - 6, 24, 2); rect(ctx, '#c84c0c', b.x - 12, y + 2, 24, 2);
        sprite(ctx, SPR.hero, b.x + 2, y - 6, 1);
        if (b.mate) sprite(ctx, SPR.washer, b.x - 10, y + 6, 1);
      } else if (b.prize > 0) {
        if (!(b.prize < 1.5 && (t * 8 | 0) % 2)) sprite(ctx, SPR.gear, b.x, y, 3);
      } else if (b.warn > 0) {
        if ((t * 10 | 0) % 2) { rect(ctx, '#f83800', b.x - 16, ry(0) + 6, 32, 2); rect(ctx, '#f83800', b.x - 16, ry(0) + RH - 6, 32, 2); }
      } else if (b.trap > 0) {
        var open = (t * 6 | 0) % 2 ? 4 : 0;
        for (var i = 0; i < 4; i++) { rect(ctx, '#bcbcbc', b.x - 14 + i * 8, y - 10, 6, 4 + open); rect(ctx, '#bcbcbc', b.x - 14 + i * 8, y + 6 - open, 6, 4 + open); }
        rect(ctx, '#f83800', b.x - 2, y - 2, 4, 4);
      }
    });
  }

  function floatObj(ctx, S, lane, o, x) {
    var cy = ry(lane.row) + RH / 2, len = o.len, dir = lane.v > 0 ? 1 : -1;
    if (o.type === 'log') {
      rect(ctx, '#7c4c10', x + 2, cy - 12, len - 4, 24); rect(ctx, '#ac7c3c', x + 2, cy - 12, len - 4, 4); rect(ctx, '#583010', x + 2, cy + 8, len - 4, 4);
      for (var i = 12; i < len - 12; i += 20) rect(ctx, '#583010', x + i, cy - 4, 8, 2);
      rect(ctx, '#d8a868', x + len - 8, cy - 10, 6, 20); rect(ctx, '#7c4c10', x + len - 6, cy - 4, 2, 8);
    } else if (o.type === 'raft') {
      for (var p = 0; p < len - 4; p += 8) rect(ctx, (p / 8) % 2 ? '#ac7c3c' : '#c89858', x + 2 + p, cy - 14, 6, 28);
      rect(ctx, '#583010', x + 2, cy - 8, len - 4, 2); rect(ctx, '#583010', x + 2, cy + 6, len - 4, 2);
    } else if (o.type === 'dive') {
      var d = L.diveDepth(S.cfg, o, S.time);
      for (var c = 0; c < len / CW; c++) {
        var bx = x + c * CW + CW / 2;
        if (d >= 1) { rect(ctx, '#3cbcfc', bx - 8, cy - 1, 16, 2); continue; }
        var s = d > 0.3 ? 8 : 12;
        rect(ctx, d > 0 && (S.time * 8 | 0) % 2 ? '#a83c18' : '#f86818', bx - s, cy - s, s * 2, s * 2);
        rect(ctx, '#fcfcfc', bx - s, cy - 2, s * 2, 4);
      }
    } else if (o.type === 'fish') {
      var hx = dir > 0 ? x + len - CW : x, mo = (S.time * 6 | 0) % 2 ? 6 : 2;
      rect(ctx, '#6c5c4c', x + 4, cy - 10, len - 8, 20); rect(ctx, '#a08c70', x + 4, cy - 10, len - 8, 4);
      rect(ctx, '#302820', dir > 0 ? x : x + len - 8, cy - 6, 8, 12);   // хвост
      rect(ctx, '#4c4038', hx + 2, cy - 12, CW - 4, 24);
      rect(ctx, '#fcfcfc', dir > 0 ? hx + CW - 2 : hx - 6, cy - 10, 8, 2); rect(ctx, '#fcfcfc', dir > 0 ? hx + CW - 2 : hx - 6, cy + 8, 8, 2);   // усы
      rect(ctx, '#f83800', dir > 0 ? hx + CW - 12 : hx + 2, cy - mo / 2, 10, mo);
      rect(ctx, '#f8d878', hx + (dir > 0 ? 10 : 18), cy - 8, 4, 4); rect(ctx, '#f8d878', hx + (dir > 0 ? 10 : 18), cy + 4, 4, 4);
    }
  }

  function vehicle(ctx, lane, o, x) {
    var cy = ry(lane.row) + RH / 2, len = o.len, dir = lane.v > 0 ? 1 : -1, col = CAR[o.type];
    var front = dir > 0 ? x + len - 4 : x + 2;
    if (o.type === 'moto') {
      rect(ctx, '#202020', x + 4, cy - 2, len - 8, 4); rect(ctx, col, x + 8, cy - 6, len - 16, 12); rect(ctx, '#fcfcfc', x + len / 2 - 4, cy - 4, 8, 8);
    } else {
      for (var i = 0; i < 2; i++) { var wx = i ? x + len - 12 : x + 4; rect(ctx, '#202020', wx, cy - 14, 8, 4); rect(ctx, '#202020', wx, cy + 10, 8, 4); }
      if (o.type === 'truck') {
        var cab = dir > 0 ? x + len - 22 : x + 2;
        rect(ctx, '#bcbcbc', dir > 0 ? x + 2 : x + 24, cy - 12, len - 26, 24); rect(ctx, '#fc9838', dir > 0 ? x + 6 : x + 28, cy - 2, len - 34, 4);
        rect(ctx, col, cab, cy - 11, 20, 22); rect(ctx, '#a4e4fc', dir > 0 ? cab + 14 : cab + 2, cy - 8, 4, 16);
      } else if (o.type === 'roller') {
        rect(ctx, col, dir > 0 ? x + 2 : x + 16, cy - 11, len - 18, 22);
        rect(ctx, '#bcbcbc', dir > 0 ? x + len - 14 : x + 2, cy - 13, 12, 26); rect(ctx, '#202020', x + len / 2 - 6, cy - 6, 12, 12);
      } else {
        rect(ctx, col, x + 3, cy - 10, len - 6, 20); rect(ctx, '#000', x + 8, cy - 5, len - 16, 10);
        if (o.type === 'lift') { rect(ctx, '#bcbcbc', dir > 0 ? x + len - 2 : x - 6, cy - 8, 8, 2); rect(ctx, '#bcbcbc', dir > 0 ? x + len - 2 : x - 6, cy + 6, 8, 2); }
      }
    }
    rect(ctx, '#fcfc80', front, cy - 8, 2, 4); rect(ctx, '#fcfc80', front, cy + 4, 2, 4);
  }

  function draw(ctx, S, g, o) {
    o = o || {};
    bg(ctx);
    var t = S.time, cfg = S.cfg;
    water(ctx, S); bays(ctx, S);
    for (var r = 1; r < L.ROWS - 1; r++) {
      var lane = cfg.lanes[r]; if (!lane) continue;
      for (var i = 0; i < lane.objs.length; i++) {
        var ob = lane.objs[i], ox = L.objX(lane, ob, t);
        if (ox > W || ox + ob.len < 0) continue;
        if (lane.kind === 'river') floatObj(ctx, S, lane, ob, ox); else vehicle(ctx, lane, ob, ox);
      }
    }
    if (S.mate) { var mx = L.objX(cfg.lanes[S.mate.row], cfg.lanes[S.mate.row].objs[S.mate.idx], t) + S.mate.off; sprite(ctx, SPR.washer, mx, ry(S.mate.row) + RH / 2, 2); }
    cfg.spiders.forEach(function (sp) {
      var d = L.spiderDir(sp, t), m = d > 0 ? SPR.spider : SPIDER_L;
      sprite(ctx, m, L.spiderX(sp, t), ry(L.MEDIAN) + RH / 2 + ((t * 8 | 0) % 2 ? 2 : 0), 3);
    });
    if (!o.bare) {
      if (S.phase === 'dead' && S.death) {
        var dd = S.death, k = 1 - S.phaseT / L.DEAD_T, dx = dd.x, dy = ry(dd.row) + RH / 2;
        if (dd.reason === 'water' || dd.reason === 'edge' || dd.reason === 'fish') {
          var s2 = 6 + Math.floor(k * 4) * 6; rect(ctx, '#3cbcfc', dx - s2, dy - 2, s2 * 2, 2); rect(ctx, '#3cbcfc', dx - 2, dy - s2 / 2, 4, s2);
        } else {
          sprite(ctx, SPR.hero, dx, dy, 3, (t * 10 | 0) % 2 ? '#fcfcfc' : '#6c6c6c');
        }
      } else if (S.phase === 'play' && S.hero) {
        var q = L.heroPos(S.hero), px = 3;
        var hy = ry(0) + q.y * RH + RH / 2;
        if (S.carry) { var bk = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[S.hero.face] || [0, 1]; sprite(ctx, SPR.washer, q.x + bk[0] * 16, hy + bk[1] * 16, 2); }
        sprite(ctx, rot(SPR.hero, S.hero.face), q.x, hy, px);
      }
      K.ui.hud(g, ctx, S, P, lifeIcon);
      K.ui.footer(g, ctx, S, P);
      K.ui.toasts(g, ctx, o.toasts || [], P);
      K.ui.banner(g, ctx, S, P);
    }
  }
  function lifeIcon(ctx, x, y, on) { sprite(ctx, SPR.hero, x, y, 2, on ? null : P.lifeOff); }

  K.classic = { P: P, bg: bg, draw: draw, lifeIcon: lifeIcon };
})(typeof window !== 'undefined' ? window : globalThis);
