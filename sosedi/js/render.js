/* СОСЕДИ · рендер обеих тем (retro — пиксельные блоки, насыщенная 16-бит палитра, без сглаживания;
   modern — мягкие формы, тени, градиенты). Тема меняет только отрисовку. SOSEDI.R.
   Экран 640×404: HUD 32 px сверху, вид на посёлок 640×372 (камера — в main.js). */
(function (global) {
  'use strict';
  var SO = global.SOSEDI = global.SOSEDI || {};
  var LV = SO.levels, T = LV.T, TS = LV.TS, MW = LV.MW, MH = LV.MH;
  var VW = 640, VH = 404, HUD = 32, Z = 1.4;   // Z — масштаб мира на экране
  var R = SO.R = { VW: VW, VH: VH, HUD: HUD, Z: Z };
  var retro = false;
  R.setRetro = function (v) { retro = !!v; };

  // ---------- палитры районов ----------
  var PAL = {
    modern: {
      yard:   { g: '#a3b45e', g2: '#97a954', r: '#d6bf8e', w: '#b8664a', wt: '#7e3a2c', f: '#d9bb8b', f2: '#cfae7c', h: '#7a5532', h2: '#5c3e22', hk: '#6aa04a', p: '#4f9fcf', p2: '#79bde4', fence: '#8a5a34', leaf: '#d9822b' },
      street: { g: '#c7c0b4', g2: '#bcb5a8', r: '#5d6068', w: '#7d8ea8', wt: '#47546b', f: '#d8c3a0', f2: '#ccb592', h: '#e2a73e', h2: '#a8731f', hk: '#3f6fa3', p: '#6c9cc2', p2: '#9cc4e0', fence: '#56606e', leaf: '#e6d27a' },
      market: { g: '#b9a07e', g2: '#ae9573', r: '#cdb690', w: '#9d6e4c', wt: '#5f3d27', f: '#dcc49b', f2: '#d0b68c', h: '#d6544c', h2: '#f4ead8', hk: '#8a5a32', p: '#57acd6', p2: '#8fcbe9', fence: '#6e4a30', leaf: '#ea9a3a' },
      fair:   { g: '#8fbf6a', g2: '#85b562', r: '#e6d09a', w: '#e0627f', wt: '#fff1df', f: '#f0dcb4', f2: '#e7cfa2', h: '#e0bf57', h2: '#b89236', hk: '#c79a2e', p: '#51b0de', p2: '#88cdee', fence: '#7a4fa0', leaf: '#ff6fae' },
      cellar: { g: '#8c7b68', g2: '#827160', r: '#9c8b76', w: '#5c4f46', wt: '#3d342e', f: '#a48b6c', f2: '#987f61', h: '#b5803f', h2: '#7c5527', hk: '#d9a25a', p: '#4f8099', p2: '#78a7bf', fence: '#463c35', leaf: '#c9b07a' }
    },
    retro: {
      yard:   { g: '#88a838', g2: '#70902c', r: '#d8b870', w: '#c05030', wt: '#802818', f: '#e0b078', f2: '#c89860', h: '#885020', h2: '#583010', hk: '#50b030', p: '#2878d8', p2: '#68b0f8', fence: '#905828', leaf: '#f08820' },
      street: { g: '#b8b0a0', g2: '#a09888', r: '#484858', w: '#6880b8', wt: '#384878', f: '#e0c090', f2: '#c8a878', h: '#f0a820', h2: '#a86808', hk: '#2860c0', p: '#4888d0', p2: '#88c0f0', fence: '#505868', leaf: '#f8e070' },
      market: { g: '#b89870', g2: '#a08058', r: '#d8b880', w: '#a86840', wt: '#603818', f: '#e8c890', f2: '#d0b078', h: '#e03838', h2: '#f8f0e0', hk: '#885028', p: '#3898e0', p2: '#80c8f8', fence: '#704020', leaf: '#f89830' },
      fair:   { g: '#68b840', g2: '#50a030', r: '#f0d088', w: '#f04878', wt: '#fff0d8', f: '#f8d8a0', f2: '#e8c088', h: '#f0c040', h2: '#c09020', hk: '#d09020', p: '#30a0f0', p2: '#80d0f8', fence: '#8040b0', leaf: '#ff58b0' },
      cellar: { g: '#887058', g2: '#706048', r: '#a08870', w: '#584840', wt: '#302820', f: '#b08860', f2: '#987048', h: '#c88038', h2: '#805018', hk: '#f0a850', p: '#3878a0', p2: '#70b0d8', fence: '#403830', leaf: '#d8b870' }
    }
  };
  // общие цвета персонажей
  var C = {
    modern: { skin: '#f2c6a0', skin2: '#d9a27c', ink: '#2a2420', white: '#fbf7ef', water: '#6cc7ff', bubble: 'rgba(200,240,255,.55)', shadow: 'rgba(20,16,10,.28)',
      asya: { suit: '#2aa59a', suit2: '#1d7f76', hair: '#e2672f', bow: '#ffd23f' }, tim: { suit: '#e0a43a', suit2: '#b97f1d', hair: '#4a2d1e', scarf: '#d6453a' },
      tin: '#c9d1d9', tin2: '#8d98a4', red: '#e2463c', gold: '#f4c247', key: '#e6b84a', box: '#7b3fa0', box2: '#f2c94c', good: '#7bd389', bad: '#ff6b5a' },
    retro: { skin: '#f8c088', skin2: '#d08850', ink: '#181010', white: '#f8f8f8', water: '#58c8f8', bubble: '#a8e8f8', shadow: '#00000055',
      asya: { suit: '#00a8a0', suit2: '#007068', hair: '#f06020', bow: '#f8e000' }, tim: { suit: '#f0a000', suit2: '#b06800', hair: '#583018', scarf: '#e02828' },
      tin: '#d0d8e0', tin2: '#8090a0', red: '#f02828', gold: '#f8d030', key: '#f8c030', box: '#8030b0', box2: '#f8d040', good: '#58f858', bad: '#f85858' }
  };
  function P() { return C[retro ? 'retro' : 'modern']; }
  R.pal = function (style) { return PAL[retro ? 'retro' : 'modern'][style]; };
  R.C = P;

  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  // ---------- примитивы (retro — по пиксельной сетке 2 px) ----------
  function q(v) { return retro ? Math.round(v / 2) * 2 : v; }
  function rect(c, x, y, w, h, col) { c.fillStyle = col; if (retro) c.fillRect(q(x), q(y), Math.max(2, q(w)), Math.max(2, q(h))); else c.fillRect(x, y, w, h); }
  function dot(c, x, y, r, col) {
    c.fillStyle = col;
    if (!retro) { c.beginPath(); c.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); c.fill(); return; }
    x = q(x); y = q(y); r = Math.max(2, Math.round(r));
    for (var dy = -r; dy < r; dy += 2) { var w = Math.round(Math.sqrt(Math.max(0, r * r - (dy + 1) * (dy + 1)))); w = Math.round(w / 2) * 2; if (w > 0) c.fillRect(x - w, y + dy, w * 2, 2); }
  }
  function ell(c, x, y, rx, ry, col) {
    c.fillStyle = col;
    if (!retro) { c.beginPath(); c.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); c.fill(); return; }
    x = q(x); y = q(y); rx = Math.max(2, Math.round(rx)); ry = Math.max(2, Math.round(ry));
    for (var dy = -ry; dy < ry; dy += 2) { var k = (dy + 1) / ry, w = Math.round(rx * Math.sqrt(Math.max(0, 1 - k * k)) / 2) * 2; if (w > 0) c.fillRect(x - w, y + dy, w * 2, 2); }
  }
  function rrect(c, x, y, w, h, r, col) {
    if (retro) { rect(c, x, y, w, h, col); return; }
    c.fillStyle = col; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fill();
  }
  function line(c, x1, y1, x2, y2, col, w) { c.strokeStyle = col; c.lineWidth = w || 1; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  function shadow(c, x, y, rx) { ell(c, x, y, rx, rx * 0.42, P().shadow); }
  function txt(c, s, x, y, o) {
    o = o || {}; c.font = (o.w || 800) + ' ' + (o.size || 12) + 'px ' + (retro ? '"Courier New", ui-monospace, monospace' : 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif');
    c.textAlign = o.align || 'left'; c.textBaseline = o.base || 'alphabetic';
    if (o.stroke) { c.lineWidth = o.lw || 3; c.strokeStyle = o.stroke; c.lineJoin = 'round'; c.strokeText(s, x, y); }
    c.fillStyle = o.color || '#fff'; c.fillText(s, x, y);
  }
  R.txt = txt; R.dot = dot; R.rect = rect; R.ell = ell; R.rrect = rrect;

  // ---------- карта (кэш в offscreen-канве; пересборка при смене темы/дверей/трещин) ----------
  var cache = { key: '', cv: null };
  function mapKey(M) { var n = 0; for (var i = 0; i < M.t.length; i++) if (M.t[i] === T.D || M.t[i] === T.C) n += i; return M.kind + M.n + ':' + M.d + ':' + retro + ':' + n; }
  function tileAt(M, x, y) { if (x < 0 || y < 0 || x >= MW || y >= MH) return T.W; return M.t[y * MW + x]; }
  function drawTile(c, M, x, y) {
    var k = tileAt(M, x, y), p = R.pal(M.style), X = x * TS, Y = y * TS, h = hash(x, y), st = M.style, cp = P();
    var border = x === 0 || y === 0 || x === MW - 1 || y === MH - 1;
    function ground() {
      if (st === 'cellar') { rect(c, X, Y, TS, TS, (y & 1) ? p.g : p.g2); rect(c, X, Y + TS - 1, TS, 1, p.g2); if ((x + (y & 1) * 2) % 4 === 0) rect(c, X, Y, 1, TS, p.g2); }
      else if (st === 'street' || st === 'market') { rect(c, X, Y, TS, TS, ((x + y) & 1) ? p.g : p.g2); if (!retro) { c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(X, Y, TS, 1); c.fillRect(X, Y, 1, TS); } }
      else { rect(c, X, Y, TS, TS, p.g); if (retro) { if (((x + y) & 1) === 0) { rect(c, X + 2, Y + 4, 2, 2, p.g2); rect(c, X + 10, Y + 12, 2, 2, p.g2); } } else if (h < 0.5) { c.fillStyle = p.g2; c.fillRect(X + h * 12, Y + (1 - h) * 12, 3, 2); } }
      if (h > 0.93 && st !== 'cellar') { rect(c, X + 5, Y + 6, 3, 2, p.leaf); rect(c, X + 6, Y + 5, 1, 4, p.leaf); }
    }
    switch (k) {
      case T.G: ground(); break;
      case T.R:
        if (st === 'street') { rect(c, X, Y, TS, TS, p.r); if (y === 16 && (x % 3) !== 0) rect(c, X + 2, Y + 7, 10, 2, '#e8d890'); }
        else { rect(c, X, Y, TS, TS, p.r); if (h < 0.5) rect(c, X + 3 + h * 8, Y + 4 + h * 6, 3, 2, p.g2); }
        break;
      case T.F: rect(c, X, Y, TS, TS, (x & 1) ? p.f : p.f2); rect(c, X, Y + ((x & 1) ? 7 : 15), TS, 1, p.f2); break;
      case T.P:
        rect(c, X, Y, TS, TS, p.p);
        if (tileAt(M, x, y - 1) !== T.P) rect(c, X, Y, TS, 3, p.p2);
        if (h < 0.6) rect(c, X + 3 + h * 6, Y + 8, 5, 1, p.p2);
        break;
      case T.H:
        ground();
        if (st === 'yard') {          // поленница / грядка с капустой
          if (h < 0.5) { rect(c, X + 1, Y + 3, 14, 11, p.h2); for (var i = 0; i < 3; i++) { dot(c, X + 4 + i * 4, Y + 6, 2, p.h); dot(c, X + 4 + i * 4, Y + 11, 2, p.h); dot(c, X + 4 + i * 4, Y + 6, 1, '#e8c08a'); dot(c, X + 4 + i * 4, Y + 11, 1, '#e8c08a'); } }
          else { rect(c, X + 1, Y + 2, 14, 12, p.h2); dot(c, X + 5, Y + 6, 3, p.hk); dot(c, X + 11, Y + 10, 3, p.hk); dot(c, X + 11, Y + 5, 2, p.hk); }
        } else if (st === 'street') { // газетный киоск / скамейка
          if (h < 0.55) { rrect(c, X + 1, Y + 2, 14, 12, 2, p.h); rect(c, X + 1, Y + 2, 14, 3, p.h2); rect(c, X + 4, Y + 7, 8, 4, cp.white); }
          else { rect(c, X + 1, Y + 6, 14, 4, p.hk); rect(c, X + 2, Y + 10, 2, 4, cp.ink); rect(c, X + 12, Y + 10, 2, 4, cp.ink); }
        } else if (st === 'market') { // прилавок с полосатым навесом
          rect(c, X, Y + 6, TS, 9, p.hk); for (i = 0; i < 4; i++) rect(c, X + i * 4, Y + 1, 4, 6, (i + x) & 1 ? p.h : p.h2);
          dot(c, X + 4, Y + 10, 2, (h < 0.5) ? '#e2463c' : '#f2a93b'); dot(c, X + 10, Y + 11, 2, (h < 0.5) ? '#6aa04a' : '#e2463c');
        } else if (st === 'fair') {   // тюк сена
          rrect(c, X + 1, Y + 3, 14, 11, 3, p.h); rect(c, X + 1, Y + 7, 14, 1, p.h2); rect(c, X + 5, Y + 3, 1, 11, p.h2); rect(c, X + 10, Y + 3, 1, 11, p.h2);
        } else {                      // ящик с гайками
          rect(c, X + 1, Y + 1, 14, 14, p.h); rect(c, X + 1, Y + 1, 14, 2, p.hk); rect(c, X + 1, Y + 7, 14, 2, p.h2); rect(c, X + 7, Y + 1, 2, 14, p.h2);
        }
        break;
      case T.W: case T.D: case T.C: case T.O:
        if (border) { ground(); rect(c, X, Y + 2, TS, 12, p.fence); rect(c, X, Y + 4, TS, 2, cp.ink + (retro ? '' : '44')); rect(c, X, Y + 10, TS, 2, cp.ink + (retro ? '' : '44')); for (i = 0; i < 2; i++) rect(c, X + 3 + i * 8, Y, 3, TS, p.fence); break; }
        if (k === T.O) { rect(c, X, Y, TS, TS, p.f2); rect(c, X + 2, Y + 2, 12, 12, retro ? '#000' : 'rgba(0,0,0,.18)'); break; }
        // стена дома: фасад + «крыша» по верхней кромке
        var top = !LV.WALK[tileAt(M, x, y - 1)] && tileAt(M, x, y - 1) !== T.F ? false : true;
        rect(c, X, Y, TS, TS, p.w);
        if (st === 'fair') { for (i = 0; i < 4; i++) rect(c, X + i * 4, Y, 2, TS, p.wt); }
        else if (st === 'cellar') { rect(c, X, Y + 7, TS, 1, p.wt); rect(c, X + ((y & 1) ? 4 : 10), Y, 1, 7, p.wt); rect(c, X + ((y & 1) ? 10 : 4), Y + 8, 1, 8, p.wt); }
        else { rect(c, X, Y + 5, TS, 1, p.wt); rect(c, X, Y + 11, TS, 1, p.wt); rect(c, X + ((y & 1) ? 3 : 9), Y, 1, 5, p.wt); rect(c, X + ((y & 1) ? 11 : 5), Y + 6, 1, 5, p.wt); }
        if (top) rect(c, X, Y, TS, 3, p.wt);
        if (k === T.D) { rect(c, X + 2, Y + 1, 12, 14, '#8a5a2b'); rect(c, X + 3, Y + 2, 10, 12, '#a8743a'); rect(c, X + 6, Y + 6, 4, 4, cp.key); rect(c, X + 7, Y + 8, 2, 3, cp.ink); }
        if (k === T.C) { line(c, X + 3, Y + 2, X + 8, Y + 8, cp.ink, retro ? 2 : 1.4); line(c, X + 8, Y + 8, X + 6, Y + 14, cp.ink, retro ? 2 : 1.4); line(c, X + 8, Y + 8, X + 13, Y + 11, cp.ink, retro ? 2 : 1.4); }
        break;
    }
  }
  function mapCanvas(M) {
    var key = mapKey(M);
    if (cache.key === key && cache.cv) return cache.cv;
    var cv = global.document.createElement('canvas'); cv.width = MW * TS; cv.height = MH * TS;
    var c = cv.getContext('2d');
    for (var y = 0; y < MH; y++) for (var x = 0; x < MW; x++) drawTile(c, M, x, y);
    // декор: окна домов и «таблички»
    M.houses.forEach(function (b) {
      for (var i = 2; i < b.w - 2; i += 3) { var wx = (b.x + i) * TS + 3, wy = b.y * TS + 4; if (!(b.door.y === b.y && Math.abs(b.door.x - b.x - i) < 1)) { rect(c, wx, wy, 10, 7, retro ? '#f8f0a0' : '#ffe9a8'); rect(c, wx + 4, wy, 2, 7, R.pal(M.style).wt); } }
    });
    cache.key = key; cache.cv = cv; return cv;
  }
  R.invalidate = function () { cache.key = ''; };

  // ---------- персонажи ----------
  // герой: Ася (И1) — бирюзовый комбинезон, рыжие хвостики с жёлтыми бантами; Тимоша (И2) — горчичный комбинезон, тёмные кудри, красный шарф
  R.hero = function (c, h, t, scale) {
    var cp = P(), s = h.id ? cp.tim : cp.asya, x = h.x, y = h.y, sc = scale || 1, fx = h.fx, fy = h.fy, back = fy < -0.3 && Math.abs(fx) < 0.8;
    var step = h.moving ? Math.sin((h.walkT || t) * 14) : 0;
    c.save(); c.translate(x, y); if (sc !== 1) c.scale(sc, sc);
    shadow(c, 0, 7, 7);
    if (h.shieldT > 0) { ell(c, 0, -6, 14, 10, retro ? '#f04878' : 'rgba(240,72,120,.35)'); if (!retro) { c.strokeStyle = '#f04878'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, -6, 14, 10, 0, Math.PI, 0); c.stroke(); } }
    // ноги
    rect(c, -4, 2 + Math.max(0, step) * 2, 3, 5, cp.ink); rect(c, 1, 2 + Math.max(0, -step) * 2, 3, 5, cp.ink);
    if (h.shoesT > 0) { rect(c, -5, 6, 4, 2, '#ff5050'); rect(c, 1, 6, 4, 2, '#ff5050'); }
    // туловище-комбинезон
    rrect(c, -5, -6, 10, 10, 3, s.suit); rect(c, -5, 0, 10, 2, s.suit2);
    if (h.id) rect(c, -5, -6, 10, 2, s.scarf);
    // руки + «оружие» по направлению взгляда
    var ax = Math.round(fx * 7), ay = Math.round(fy * 5) - 2;
    dot(c, ax, ay, 2, cp.skin);
    if (!back) { rect(c, ax + (fx < 0 ? -4 : 0), ay - 1, 4, 3, h.id ? '#3f7fd6' : '#e2463c'); }
    // голова
    dot(c, 0, -11, 6, cp.skin);
    if (h.id) { dot(c, -3, -15, 3, s.hair); dot(c, 2, -16, 3, s.hair); dot(c, 5, -13, 2, s.hair); dot(c, -5, -12, 2, s.hair); if (back) dot(c, 0, -11, 5, s.hair); }
    else { ell(c, 0, -15, 6, 3, s.hair); dot(c, -7, -11, 2.5, s.hair); dot(c, 7, -11, 2.5, s.hair); rect(c, -9, -14, 3, 2, s.bow); rect(c, 6, -14, 3, 2, s.bow); if (back) dot(c, 0, -12, 5, s.hair); }
    if (!back) { var ex = fx * 2; rect(c, -3 + ex, -11, 2, 2, cp.ink); rect(c, 1 + ex, -11, 2, 2, cp.ink); if (!retro) { c.fillStyle = '#e88a7a'; c.fillRect(-1 + ex, -8, 2, 1); } }
    c.restore();
  };

  // соседи: свои силуэты по профессии
  R.neighbor = function (c, nb, t) {
    var cp = P(), x = nb.x, y = nb.y, pan = nb.panic || nb.grab > 0, wob = pan ? Math.sin(t * 22) * 1.5 : 0, bob = Math.sin(nb.t * 3) * 0.6;
    c.save(); c.translate(x + wob, y);
    shadow(c, 0, 7, 7);
    var body = { granny: '#8e5bb0', postman: '#3f6fb8', twins: '#e86a8a', fisher: '#5b7f3a', teacher: '#d6453a', fireman: '#c8452f', baker: '#f3efe6', gardener: '#7a8f3a' }[nb.type] || '#888';
    if (retro) body = { granny: '#a050c8', postman: '#3060d0', twins: '#f05890', fisher: '#508028', teacher: '#e03030', fireman: '#d84020', baker: '#f8f8f0', gardener: '#789828' }[nb.type] || body;
    if (nb.type === 'twins') {      // близнецы на батуте
      ell(c, 0, 4, 11, 4, '#3a3a48'); ell(c, 0, 3, 9, 3, '#4fa3e0');
      var j1 = Math.abs(Math.sin(nb.t * 5)) * 7, j2 = Math.abs(Math.sin(nb.t * 5 + 1.6)) * 7;
      [[-4, j1], [4, j2]].forEach(function (k) { rrect(c, k[0] - 3, -5 - k[1], 6, 7, 2, body); dot(c, k[0], -9 - k[1], 3.5, cp.skin); rect(c, k[0] - 3, -12 - k[1], 6, 2, '#6a3a1e'); });
    } else {
      rect(c, -3, 2, 2, 5, cp.ink); rect(c, 1, 2, 2, 5, cp.ink);
      rrect(c, -5, -6 + bob, 10, 10, 3, body);
      dot(c, 0, -11 + bob, 5.5, cp.skin);
      var arm = pan ? -14 : -2;
      dot(c, -7, arm + bob, 2, cp.skin); dot(c, 7, arm + bob, 2, cp.skin);
      switch (nb.type) {
        case 'granny': dot(c, 0, -15 + bob, 4, '#d8d8e0'); dot(c, 0, -18 + bob, 2.5, '#d8d8e0'); ell(c, 9, 5, 4, 3, '#f0a040'); dot(c, 12, 2, 2.5, '#f0a040'); rect(c, 11, -1, 1, 2, '#f0a040'); rect(c, 13, -1, 1, 2, '#f0a040'); break;
        case 'postman': ell(c, 0, -15 + bob, 6, 2.5, '#2a4f8f'); rect(c, 3, -2 + bob, 6, 6, '#8a5a2b'); rect(c, 4, -1 + bob, 4, 3, cp.white); break;
        case 'fisher': ell(c, 0, -15 + bob, 7, 2.5, '#3f5f2a'); line(c, 6, -2, 15, -16, '#8a5a2b', retro ? 2 : 1.4); line(c, 15, -16, 16, -4, '#dddddd', 1); break;
        case 'teacher': dot(c, 0, -15 + bob, 4.5, '#5a2e1e'); dot(c, -4, -12 + bob, 2.5, '#5a2e1e'); dot(c, 4, -12 + bob, 2.5, '#5a2e1e'); if (!pan) { txt(c, '♪', 10, -12 + Math.sin(nb.t * 2) * 3, { size: 10, color: retro ? '#f8f8f8' : '#ffffff', w: 900 }); } break;
        case 'fireman': ell(c, 0, -15 + bob, 7, 3.5, retro ? '#f8d030' : '#f2c94c'); rect(c, -2, -19 + bob, 4, 2, retro ? '#f8d030' : '#f2c94c'); break;
        case 'baker': rect(c, -4, -21 + bob, 8, 6, cp.white); dot(c, 0, -21 + bob, 4.5, cp.white); ell(c, 9, 0 + bob, 4, 2.5, '#d29a4a'); break;
        case 'gardener': ell(c, 0, -15 + bob, 8, 2.5, '#e0c060'); rect(c, -3, -18 + bob, 6, 3, '#e0c060'); rect(c, 7, -1 + bob, 6, 5, '#5f9fd8'); rect(c, 12, -3 + bob, 3, 2, '#5f9fd8'); break;
      }
      rect(c, -2, -12 + bob, 1.5, 1.5, cp.ink); rect(c, 1, -12 + bob, 1.5, 1.5, cp.ink);
    }
    c.restore();
    // «!» над головой и полоса «тащат»
    if (nb.grab > 0) {
      var k = Math.min(1, nb.grab / SO.logic.K.GRAB);
      rect(c, x - 10, y - 30, 20, 4, retro ? '#000' : 'rgba(0,0,0,.5)'); rect(c, x - 10, y - 30, 20 * k, 4, cp.bad);
      txt(c, '!', x, y - 33, { size: 13, align: 'center', color: cp.bad, stroke: '#000', lw: 3 });
    } else if (nb.panic) txt(c, '!', x + 8, y - 22 + Math.sin(t * 10) * 2, { size: 12, align: 'center', color: '#ffd23f', stroke: '#000', lw: 3 });
    if (nb.bonus && !nb.secret) { dot(c, x, y - 28 + Math.sin(t * 3) * 2, 4, cp.gold); txt(c, '+1', x, y - 25 + Math.sin(t * 3) * 2, { size: 7, align: 'center', color: '#3a2a00', w: 900 }); }
  };

  // игрушки «Заводного Цирка»
  R.toy = function (c, o, t) {
    var cp = P(), x = o.x, y = o.y, fl = o.flash > 0, k = o.type, sc = 1;
    if (o.rise > 0) { sc = 1 - o.rise / 0.6; }
    c.save(); c.translate(x, y); if (sc !== 1) c.scale(Math.max(0.1, sc), Math.max(0.1, sc));
    shadow(c, 0, o.r * 0.8, o.r);
    var tin = fl ? '#ffffff' : cp.tin, tin2 = fl ? '#ffffff' : cp.tin2, st = o.stun > 0;
    var keyA = t * (st ? 1 : 8) + o.id;
    function windKey(kx, ky) { rect(c, kx - 1, ky - 1, 2, 4, cp.gold); var w = Math.abs(Math.cos(keyA)) * 4 + 1; rect(c, kx - w, ky - 3, w * 2, 2, cp.gold); }
    switch (k) {
      case 'clown':
        rect(c, -4, 2, 3, 5, tin2); rect(c, 1, 2, 3, 5, tin2);
        rrect(c, -6, -6, 12, 10, 3, fl ? '#fff' : (retro ? '#38b048' : '#4fae5a')); dot(c, -2, -2, 1.5, cp.gold); dot(c, 2, 1, 1.5, cp.gold);
        dot(c, 0, -11, 6, tin); dot(c, 0, -10, 2, cp.red); rect(c, -3, -13, 2, 2, cp.ink); rect(c, 1, -13, 2, 2, cp.ink);
        dot(c, -6, -14, 3, '#f0a0d8'); dot(c, 6, -14, 3, '#f0a0d8'); rect(c, -3, -19, 6, 3, retro ? '#4878f0' : '#5b7fe0');
        windKey(8, -2); break;
      case 'goose':
        var hop = Math.abs(Math.sin(o.t * 6)) * 4;
        line(c, -2, 4, -2, 7, cp.tin2, 1); line(c, 2, 4, 2, 7, cp.tin2, 1);
        c.translate(0, -hop);
        ell(c, 0, 0, 6, 4, fl ? '#fff' : cp.white); rect(c, 3, -8, 3, 8, fl ? '#fff' : cp.white); dot(c, 5, -9, 2.5, cp.white); rect(c, 7, -9, 4, 2, '#f08a20'); rect(c, 4, -10, 1, 1, cp.ink);
        for (var i = 0; i < 3; i++) rect(c, -4 + i * 2, 4, 1, 3 + hop * 0.5, tin2);
        break;
      case 'mouse':
        ell(c, 0, 0, 6, 4, tin); dot(c, 5, -1, 2.5, tin); dot(c, 4, -4, 1.5, '#f0a0b0'); rect(c, 7, -1, 1, 1, cp.ink); line(c, -6, 0, -10, -2 + Math.sin(t * 9) * 2, tin2, 1); windKey(0, -5); break;
      case 'bear':
        var tele = o.tele > 0;
        rect(c, -6, 4, 4, 5, '#7a4a2a'); rect(c, 2, 4, 4, 5, '#7a4a2a');
        dot(c, 0, -2, 9, fl ? '#fff' : '#9a6236'); dot(c, 0, -13, 6.5, fl ? '#fff' : '#9a6236'); dot(c, -5, -18, 2.5, '#9a6236'); dot(c, 5, -18, 2.5, '#9a6236'); dot(c, 0, -11, 2.5, '#d9b38a');
        rect(c, -3, -15, 2, 2, cp.ink); rect(c, 1, -15, 2, 2, cp.ink);
        ell(c, 0, 2, 7, 5, cp.red); ell(c, 0, 0, 7, 3, cp.white); line(c, -7, 2, 7, 2, cp.gold, 1);
        var st2 = tele ? -10 : -4 + Math.sin(t * 8) * 2; line(c, -6, -4, -3, st2, '#e8d0a0', 2); line(c, 6, -4, 3, st2, '#e8d0a0', 2);
        windKey(9, -6);
        if (tele && !retro) { c.strokeStyle = 'rgba(255,90,60,.7)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 54, 0, Math.PI * 2); c.stroke(); }
        if (tele && retro) { c.strokeStyle = '#f85858'; c.lineWidth = 2; c.strokeRect(-54, -54, 108, 108); }
        break;
      case 'top':
        ell(c, 0, 0, 8, 6, fl ? '#fff' : '#e86a3a'); for (i = 0; i < 4; i++) { var a = t * 14 + i * Math.PI / 2; rect(c, Math.cos(a) * 5 - 1, Math.sin(a) * 3 - 1, 3, 3, cp.white); } rect(c, -1, -9, 2, 4, '#5b3a1a'); break;
      case 'puppet':
        line(c, -4, -14, -4, -60, 'rgba(240,240,240,.7)', 1); line(c, 4, -12, 4, -60, 'rgba(240,240,240,.7)', 1);
        var sw = Math.sin(o.t * 4) * 2;
        rect(c, -4 + sw, 2, 2, 6, '#c08a50'); rect(c, 2 - sw, 2, 2, 6, '#c08a50');
        rrect(c, -5, -6, 10, 9, 2, fl ? '#fff' : (retro ? '#c040c0' : '#b553b5')); dot(c, 0, -11, 5, fl ? '#fff' : '#e8c090'); rect(c, -2, -12, 1.5, 1.5, cp.ink); rect(c, 1, -12, 1.5, 1.5, cp.ink); dot(c, -2, -9, 1, '#e86a6a'); dot(c, 2, -9, 1, '#e86a6a');
        dot(c, -7, -3 - sw, 2, '#e8c090'); dot(c, 7, -3 + sw, 2, '#e8c090'); break;
    }
    if (st) { for (i = 0; i < 3; i++) { var aa = t * 5 + i * 2.1; txt(c, '✦', Math.cos(aa) * 8, -o.r - 10 + Math.sin(aa) * 3, { size: 7, align: 'center', color: '#ffd23f' }); } }
    c.restore();
    if (o.hp < o.max && o.max > 1) { rect(c, x - 7, y - o.r - 14, 14, 2, '#0008'); rect(c, x - 7, y - o.r - 14, 14 * o.hp / o.max, 2, cp.good); }
  };

  // боссы районов
  R.boss = function (c, B, t) {
    var cp = P(), fl = B.flash > 0, x = B.x, y = B.y, tin = fl ? '#fff' : cp.tin, tin2 = fl ? '#fff' : cp.tin2, i;
    c.save(); c.translate(x, y);
    if (B.st === 'stun') c.rotate(Math.sin(t * 20) * 0.08);
    shadow(c, 0, B.r * 0.9, B.r * 1.1);
    switch (B.kind) {
      case 'bear':
        dot(c, 0, -4, 18, fl ? '#fff' : '#8e5a30'); dot(c, 0, -26, 12, fl ? '#fff' : '#8e5a30'); dot(c, -10, -35, 4.5, '#8e5a30'); dot(c, 10, -35, 4.5, '#8e5a30'); dot(c, 0, -22, 5, '#d9b38a');
        rect(c, -5, -29, 3, 3, cp.ink); rect(c, 2, -29, 3, 3, cp.ink);
        ell(c, 0, 4, 15, 10, cp.red); ell(c, 0, 0, 15, 6, cp.white); for (i = -2; i <= 2; i++) line(c, i * 6, 0, i * 6 + 3, 12, cp.gold, 1.5);
        var s = B.st === 'tele' ? -24 : -8 + Math.sin(t * 7) * 3; line(c, -12, -8, -6, s, '#f0dcb0', 3); line(c, 12, -8, 6, s, '#f0dcb0', 3);
        if (B.st === 'tele') { c.strokeStyle = retro ? '#f85858' : 'rgba(255,90,60,.6)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 150 * (1 - B.stT / 0.8), 0, Math.PI * 2); c.stroke(); }
        break;
      case 'stilts':
        var w = Math.sin(t * 6) * 6; line(c, -5, 0, -5 + w, 14, '#8a5a2b', 3); line(c, 5, 0, 5 - w, 14, '#8a5a2b', 3);
        rrect(c, -9, -24, 18, 24, 4, fl ? '#fff' : (retro ? '#f04848' : '#e05050')); for (i = 0; i < 3; i++) dot(c, 0, -20 + i * 7, 2, cp.gold);
        dot(c, 0, -32, 9, tin); dot(c, 0, -30, 3, cp.red); rect(c, -4, -35, 3, 3, cp.ink); rect(c, 1, -35, 3, 3, cp.ink); dot(c, -9, -37, 4, '#60d0f0'); dot(c, 9, -37, 4, '#60d0f0');
        for (i = 0; i < 3; i++) { var a = t * 6 + i * 2.1; ell(c, Math.cos(a) * 14, -50 + Math.sin(a) * 6, 2.5, 5, i === 1 ? cp.gold : cp.white); }
        break;
      case 'organ':
        rect(c, -18, 8, 6, 6, cp.ink); rect(c, 12, 8, 6, 6, cp.ink);
        rrect(c, -18, -20, 36, 30, 4, fl ? '#fff' : (retro ? '#a05028' : '#9c5a34')); rect(c, -14, -16, 28, 10, cp.gold);
        for (i = 0; i < 6; i++) rect(c, -15 + i * 5, -34 + (i % 2) * 4, 4, 16 - (i % 2) * 4, tin);
        var ca = t * 5; line(c, 18, -4, 18 + Math.cos(ca) * 8, -4 + Math.sin(ca) * 8, cp.ink, 2);
        dot(c, -6, 0, 3, cp.white); dot(c, 6, 0, 3, cp.white); dot(c, -6, 0, 1.5, cp.ink); dot(c, 6, 0, 1.5, cp.ink);
        break;
      case 'strong':
        rect(c, -8, 6, 6, 8, tin2); rect(c, 2, 6, 6, 8, tin2);
        rrect(c, -13, -14, 26, 22, 6, fl ? '#fff' : tin); for (i = 0; i < 3; i++) rect(c, -13, -10 + i * 6, 26, 2, retro ? '#f04848' : '#d6453a');
        dot(c, 0, -22, 8, tin); rect(c, -9, -19, 18, 3, cp.ink); rect(c, -4, -25, 2, 2, cp.ink); rect(c, 2, -25, 2, 2, cp.ink);
        var gx = B.st === 'tele' || B.st === 'charge' ? 18 : 16; dot(c, gx, -6, 7, '#3a3a44'); rect(c, gx - 3, -16, 6, 4, '#3a3a44'); txt(c, '16', gx, -3, { size: 7, align: 'center', color: '#ddd', w: 900 });
        if (B.st === 'tele') { c.strokeStyle = retro ? '#f85858' : 'rgba(255,90,60,.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(B.ax * 90, B.ay * 90); c.stroke(); }
        break;
      case 'puppeteer':
        rrect(c, -10, -22, 20, 32, 5, fl ? '#fff' : (retro ? '#5028a0' : '#4b3a8f')); dot(c, 0, -28, 8, '#e8c090'); rect(c, -9, -42, 18, 8, '#2a2030'); rect(c, -12, -35, 24, 2, '#2a2030');
        rect(c, -4, -30, 2, 2, cp.ink); rect(c, 2, -30, 2, 2, cp.ink);
        rect(c, -18, -46, 36, 3, '#c08a50'); rect(c, -1.5, -52, 3, 12, '#c08a50');
        for (i = -1; i <= 1; i += 2) line(c, i * 16, -44, i * 22, -10 + Math.sin(t * 4 + i) * 6, 'rgba(240,240,240,.8)', 1);
        break;
    }
    if (B.st === 'stun') for (i = 0; i < 4; i++) { var aa = t * 5 + i * 1.6; txt(c, '✦', Math.cos(aa) * 16, -B.r * 2 - 4 + Math.sin(aa) * 4, { size: 9, align: 'center', color: '#ffd23f' }); }
    c.restore();
  };

  R.spawner = function (c, s, t) {
    var cp = P(), x = s.x, y = s.y, lid = s.open > 0 ? -6 : 0, fl = s.flash > 0;
    shadow(c, x, y + 7, 10);
    rect(c, x - 9, y - 6, 18, 13, fl ? '#fff' : cp.box); for (var i = 0; i < 3; i++) rect(c, x - 9 + i * 6, y - 6, 3, 13, cp.box2);
    rect(c, x - 10, y - 9 + lid, 20, 4, fl ? '#fff' : cp.box); rect(c, x - 2, y - 2, 4, 4, cp.gold);
    if (s.open > 0) dot(c, x, y - 12, 3 + Math.sin(t * 30) * 1, '#ffe08a');
    if (s.hp < s.max) { rect(c, x - 9, y - 16, 18, 2, '#0008'); rect(c, x - 9, y - 16, 18 * s.hp / s.max, 2, cp.bad); }
  };
  var PICK = { paint: '#e85d8a', pie: '#d29a4a', bubble: '#8fdcff', fire: '#ff8a3d', key: '#f4c247', soda: '#d6453a', shoes: '#ff5050', umbrella: '#f04878', bag: '#a8743a', ticket: '#ffd23f' };
  R.pickIcon = function (c, kind, x, y, t) {
    var cp = P(), col = PICK[kind] || '#fff';
    switch (kind) {
      case 'water': rect(c, x - 6, y - 3, 10, 4, '#3f7fd6'); rect(c, x - 6, y - 1, 3, 6, '#3f7fd6'); rect(c, x + 4, y - 2, 2, 2, cp.ink); dot(c, x + 7, y - 1, 1.5, cp.water); break;
      case 'paint': dot(c, x - 3, y, 3, '#e85d8a'); dot(c, x + 3, y, 3, '#5bc0eb'); dot(c, x, y - 4, 3, '#f4d35e'); break;
      case 'pie': ell(c, x, y, 6, 3.5, '#d29a4a'); ell(c, x, y - 1, 5, 2.5, '#e8b46a'); rect(c, x - 2, y - 2, 1, 1, '#8a5a2b'); rect(c, x + 2, y - 1, 1, 1, '#8a5a2b'); break;
      case 'bubble': dot(c, x, y, 5, retro ? '#a8e8f8' : 'rgba(170,230,255,.8)'); dot(c, x - 2, y - 2, 1.5, cp.white); rect(c, x + 4, y + 2, 3, 4, '#f0a040'); break;
      case 'fire': rect(c, x - 2, y - 6, 4, 10, '#e2463c'); rect(c, x - 3, y - 7, 6, 2, cp.gold); line(c, x, y + 4, x, y + 8, '#8a5a2b', 1); break;
      case 'key': dot(c, x - 3, y, 3, col); dot(c, x - 3, y, 1.2, '#7a5a10'); rect(c, x, y - 1, 7, 2, col); rect(c, x + 4, y + 1, 1, 2, col); rect(c, x + 6, y + 1, 1, 2, col); break;
      case 'soda': rect(c, x - 3, y - 5, 6, 10, '#e8d0b0'); rect(c, x - 3, y - 1, 6, 6, '#d6453a'); rect(c, x - 2, y - 7, 4, 2, '#8a5a2b'); break;
      case 'shoes': rect(c, x - 6, y - 2, 6, 4, col); rect(c, x + 1, y, 6, 4, col); rect(c, x - 6, y + 2, 6, 1, cp.white); rect(c, x + 1, y + 4, 6, 1, cp.white); break;
      case 'umbrella': ell(c, x, y - 2, 7, 4, col); rect(c, x - 7, y - 2, 14, 2, col); rect(c, x, y - 2, 1, 8, cp.ink); rect(c, x - 2, y + 5, 3, 1, cp.ink); break;
      case 'bag': dot(c, x, y + 1, 6, col); rect(c, x - 2, y - 6, 4, 3, col); line(c, x - 3, y - 3, x + 3, y - 3, cp.gold, 1); txt(c, '?', x, y + 4, { size: 8, align: 'center', color: '#3a2a10', w: 900 }); break;
      case 'ticket': rrect(c, x - 7, y - 4, 14, 8, 2, col); rect(c, x - 2, y - 4, 1, 8, '#b08a10'); txt(c, '★', x + 3, y + 3, { size: 7, align: 'center', color: '#b05010' }); break;
    }
  };
  R.pickup = function (c, p, t) {
    var y = p.y + Math.sin(t * 4 + p.x) * 1.5;
    shadow(c, p.x, p.y + 6, 6);
    if (!retro && (p.kind === 'ticket' || p.kind === 'key')) { c.fillStyle = 'rgba(255,220,100,' + (0.25 + 0.15 * Math.sin(t * 5)) + ')'; c.beginPath(); c.arc(p.x, y, 11, 0, Math.PI * 2); c.fill(); }
    R.pickIcon(c, p.kind, p.x, y, t);
  };
  // выход: калитка мастерской с вывеской-шестерёнкой
  R.exit = function (c, M, S, t) {
    if (!M.exit) return;
    var cp = P(), x = M.exit.x * TS + 8, y = M.exit.y * TS + 8, open = S.exitOpen;
    if (open && !retro) { var gr = c.createRadialGradient(x, y, 2, x, y, 26); gr.addColorStop(0, 'rgba(255,230,120,.75)'); gr.addColorStop(1, 'rgba(255,230,120,0)'); c.fillStyle = gr; c.fillRect(x - 26, y - 26, 52, 52); }
    rect(c, x - 9, y - 10, 3, 18, '#6a4a2a'); rect(c, x + 6, y - 10, 3, 18, '#6a4a2a'); rect(c, x - 9, y - 12, 18, 3, '#6a4a2a');
    rect(c, x - 6, y - 8, 12, 15, open ? (retro ? '#f8e070' : '#ffe9a0') : '#5a4636');
    if (!open) { rect(c, x - 2, y - 2, 4, 4, cp.tin2); }
    else for (var i = 0; i < 3; i++) { var k = (t * 1.6 + i / 3) % 1; rect(c, x - 1, y + 4 - k * 14, 2, 2, cp.white); }
    dot(c, x, y - 16, 5, cp.gold); dot(c, x, y - 16, 2, '#6a4a2a');
    for (i = 0; i < 6; i++) { var a = i * Math.PI / 3 + t * (open ? 2 : 0.2); rect(c, x + Math.cos(a) * 6 - 1, y - 16 + Math.sin(a) * 6 - 1, 2, 2, cp.gold); }
  };

  // ---------- сцена целиком ----------
  R.world = function (c, S, M, cam, t) {
    var cp = P();
    c.save(); c.beginPath(); c.rect(0, HUD, VW, VH - HUD); c.clip();
    c.translate(0, HUD); c.scale(Z, Z); c.translate(-Math.round(cam.x * Z) / Z, -Math.round(cam.y * Z) / Z);
    c.drawImage(mapCanvas(M), 0, 0);
    // клетки, видимые на экране
    var x0 = cam.x - 40, x1 = cam.x + VW / Z + 40, y0 = cam.y - 40, y1 = cam.y + VH / Z + 40;
    function vis(o) { return o.x > x0 && o.x < x1 && o.y > y0 && o.y < y1; }
    R.exit(c, M, S, t);
    S.pies.forEach(function (p) { if (!vis(p)) return; R.pickIcon(c, 'pie', p.x, p.y, t); if (!retro) { c.strokeStyle = 'rgba(255,220,150,' + (0.2 + 0.2 * Math.sin(t * 6)) + ')'; c.lineWidth = 1; c.beginPath(); c.arc(p.x, p.y, 14 + Math.sin(t * 6) * 2, 0, Math.PI * 2); c.stroke(); } else txt(c, '~', p.x, p.y - 8 - (t * 10 % 6), { size: 9, align: 'center', color: '#fff' }); });
    S.booms.forEach(function (b) {
      var k = b.t / b.max;
      if (b.k === 'paint') { var cols = ['#e85d8a', '#5bc0eb', '#f4d35e', '#9bc53d']; for (var i = 0; i < 8; i++) { var a = i * 0.785 + b.x; dot(c, b.x + Math.cos(a) * b.r * (0.4 + k * 0.6), b.y + Math.sin(a) * b.r * (0.4 + k * 0.6), 4 * (1 - k) + 1, cols[i % 4]); } }
      else { var cols2 = ['#ff5e5e', '#ffd23f', '#5bc0eb', '#9bff7a', '#ff8af0']; for (i = 0; i < 16; i++) { var a2 = i * 0.3927; dot(c, b.x + Math.cos(a2) * b.r * k, b.y + Math.sin(a2) * b.r * k - k * 6, 2.5 * (1 - k) + 1, cols2[i % 5]); } if (k < 0.3) dot(c, b.x, b.y, 14 * (1 - k * 3), '#fff6c0'); }
    });
    // строим по Y для глубины
    var list = [];
    S.pickups.forEach(function (p) { if (vis(p)) list.push({ y: p.y - 4, f: function () { R.pickup(c, p, t); } }); });
    S.spawners.forEach(function (s) { if (!s.dead && vis(s)) list.push({ y: s.y, f: function () { R.spawner(c, s, t); } }); });
    S.neighbors.forEach(function (nb) {
      if (!vis(nb)) return;
      if (nb.state === 'wait') list.push({ y: nb.y, f: function () { R.neighbor(c, nb, t); } });
      else if (nb.t < 1.2) list.push({ y: nb.y, f: function () {
        var k = nb.t / 1.2;
        if (nb.state === 'saved') { for (var i = 0; i < 6; i++) { var a = i * 1.05 + k * 4; dot(c, nb.x + Math.cos(a) * 16 * k, nb.y - 8 + Math.sin(a) * 16 * k, 2 * (1 - k) + 0.5, i & 1 ? cp.gold : cp.white); } c.globalAlpha = 1 - k; R.neighbor(c, { x: nb.x, y: nb.y - k * 20, t: nb.t, type: nb.type, panic: 0, grab: 0 }, t); c.globalAlpha = 1; }
        else { c.globalAlpha = 1 - k; R.neighbor(c, { x: nb.x + k * 30, y: nb.y - k * 6, t: nb.t, type: nb.type, panic: 1, grab: 0 }, t); c.globalAlpha = 1; }
      } });
    });
    S.toys.forEach(function (o) { if (vis(o)) list.push({ y: o.y, f: function () { R.toy(c, o, t); } }); });
    if (S.boss && !S.boss.dead) list.push({ y: S.boss.y, f: function () { R.boss(c, S.boss, t); } });
    S.heroes.forEach(function (h) {
      if (h.out) return;
      list.push({ y: h.y, f: function () {
        if (!h.alive) { c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 20); txt(c, '✦', h.x, h.y - 6, { size: 14, align: 'center', color: '#ffd23f' }); c.globalAlpha = 1; return; }
        if (h.inv > 0 && Math.floor(t * 16) % 2 === 0) c.globalAlpha = 0.45;
        R.hero(c, h, t); c.globalAlpha = 1;
      } });
    });
    list.sort(function (a, b) { return a.y - b.y; }).forEach(function (e) { e.f(); });
    // снаряды
    S.shots.forEach(function (o) {
      if (o.k === 'water') { dot(c, o.x, o.y, 2.5, cp.water); dot(c, o.x - o.vx * 0.015, o.y - o.vy * 0.015, 1.5, cp.water); }
      else if (o.k === 'bubble') { dot(c, o.x, o.y, 6, cp.bubble); dot(c, o.x - 2, o.y - 2, 1.5, cp.white); if (!retro) { c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1; c.beginPath(); c.arc(o.x, o.y, 6, 0, Math.PI * 2); c.stroke(); } }
      else { shadow(c, o.x, o.y + 4, 3); var yy = o.y - o.z; if (o.k === 'paint') dot(c, o.x, yy, 3.5, ['#e85d8a', '#5bc0eb', '#f4d35e'][o.pi % 3]); else R.pickIcon(c, o.k, o.x, yy, t); }
    });
    S.eshots.forEach(function (o) {
      if (o.k === 'pin') { ell(c, o.x, o.y, 2.5, 5, cp.white); rect(c, o.x - 2, o.y - 1, 4, 1, cp.red); }
      else { dot(c, o.x, o.y, 4, '#ff7ad9'); txt(c, '♪', o.x, o.y + 4, { size: 11, align: 'center', color: '#fff' }); }
    });
    S.rings.forEach(function (g) {
      c.strokeStyle = retro ? '#f8a030' : 'rgba(255,170,60,' + (1 - g.r / g.max) + ')'; c.lineWidth = retro ? 4 : 5;
      if (retro) { c.strokeRect(q(g.x - g.r), q(g.y - g.r), q(g.r * 2), q(g.r * 2)); } else { c.beginPath(); c.arc(g.x, g.y, g.r, 0, Math.PI * 2); c.stroke(); }
    });
    S.lines.forEach(function (l) {
      var on = l.warn <= 0 && l.on > 0;
      c.strokeStyle = on ? (retro ? '#f8f8f8' : 'rgba(255,255,255,.95)') : (retro ? '#f85858' : 'rgba(255,90,90,.6)');
      c.lineWidth = on ? 4 : 1.5; if (!on && c.setLineDash) c.setLineDash([6, 5]);
      c.beginPath(); c.moveTo(l.x - Math.cos(l.a) * l.len, l.y - Math.sin(l.a) * l.len); c.lineTo(l.x + Math.cos(l.a) * l.len, l.y + Math.sin(l.a) * l.len); c.stroke();
      if (c.setLineDash) c.setLineDash([]);
    });
    c.restore();
    // стрелки к соседям за краем экрана
    var cx0 = VW / 2, cy0 = HUD + (VH - HUD) / 2;
    function edgeArrow(wx, wy, col, big) {
      var sx = (wx - cam.x) * Z, sy = (wy - cam.y) * Z + HUD;
      if (sx > 6 && sx < VW - 6 && sy > HUD + 6 && sy < VH - 6) return;
      var a = Math.atan2(sy - cy0, sx - cx0), kx = (VW / 2 - 14) / Math.abs(Math.cos(a) || 1e-6), ky = ((VH - HUD) / 2 - 14) / Math.abs(Math.sin(a) || 1e-6), k = Math.min(kx, ky);
      var ax = cx0 + Math.cos(a) * k, ay = cy0 + Math.sin(a) * k, s = big ? 9 : 7;
      c.save(); c.translate(ax, ay); c.rotate(a); c.fillStyle = col; c.strokeStyle = '#000'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(s, 0); c.lineTo(-s, -s * 0.8); c.lineTo(-s * 0.4, 0); c.lineTo(-s, s * 0.8); c.closePath(); c.stroke(); c.fill(); c.restore();
    }
    S.neighbors.forEach(function (nb) { if (nb.state === 'wait' && !nb.secret) edgeArrow(nb.x, nb.y, nb.grab > 0 ? cp.bad : (nb.panic ? '#ffd23f' : cp.white), nb.grab > 0); });
    if (S.exitOpen && M.exit) edgeArrow(M.exit.x * TS + 8, M.exit.y * TS + 8, cp.good, true);
  };

  // ---------- HUD ----------
  R.hud = function (g, c, S, M) {
    var cp = P(), th = g.th(), two = S.heroes.length > 1;
    rect(c, 0, 0, VW, HUD, retro ? '#000' : '#1b1612'); rect(c, 0, HUD - 1, VW, 1, retro ? '#f8d030' : '#3a2e24');
    function heroBlock(h, x, right) {
      var al = right ? 'right' : 'left', dir = right ? -1 : 1, col = h.id ? cp.tim.suit : cp.asya.suit, x0 = x;
      txt(c, g.t(h.id ? 'p2' : 'p1'), x, 13, { size: 11, color: col, align: al, w: 900 });
      var nx = x + dir * (c.measureText(g.t(h.id ? 'p2' : 'p1')).width + 6);
      for (var i = 0; i < 3; i++) { var hx = nx + dir * (i * 11 + 5); txt(c, '♥', hx, 13, { size: 11, align: 'center', color: h.out ? '#555' : i < h.hp && h.alive ? cp.bad : (retro ? '#555' : '#4a3a34') }); }
      txt(c, '×' + Math.max(0, h.lives), nx + dir * 36, 13, { size: 11, align: al, color: th.ink });
      var w = SO.logic.WEAP[h.w], am = h.ammo[w];
      R.pickIcon(c, w, x0 + dir * 7, 23, 0);
      txt(c, g.t('w_' + w) + (w === 'water' ? ' ∞' : ' ' + am), x0 + dir * 17, 28, { size: 10, align: al, color: th.muted, w: 700 });
    }
    heroBlock(S.heroes[0], 8, false);
    if (two) heroBlock(S.heroes[1], VW - 8, true);
    var mid = VW / 2;
    var name = S.inBonus ? g.t('bonusTitle') : (S.level + '. ' + g.t('l' + S.level));
    txt(c, name, mid, 13, { size: 11, align: 'center', color: th.accent, w: 900 });
    var wait = S.neighbors.filter(function (n) { return n.state === 'wait' && !n.secret; }).length;
    var line2 = g.t('pool') + ': ' + S.pool + ' · ' + g.t('waiting') + ': ' + wait + (S.keys ? ' · ' + g.t('keys') + ': ' + S.keys : '') + (S.inBonus ? ' · ' + g.t('bonusTime') + ': ' + Math.max(0, Math.ceil(S.bonusT)) : '');
    txt(c, line2, mid, 27, { size: 10, align: 'center', color: th.ink, w: 700 });
    var sc = g.t('score') + ' ' + S.score;
    if (!two) txt(c, sc, VW - 8, 13, { size: 11, align: 'right', color: th.ink, w: 800 });
    else txt(c, sc, mid + 150, 27, { size: 9, align: 'center', color: th.muted, w: 700 });
    if (!two && g.state.best) txt(c, g.t('best') + ' ' + Math.max(g.state.best, S.score), VW - 8, 27, { size: 9, align: 'right', color: th.muted, w: 700 });
    if (S.ticket) R.pickIcon(c, 'ticket', mid - 150, 22, 0);
    // полоса здоровья босса
    if (S.boss && !S.boss.dead && S.phase !== 'intro') {
      var B = S.boss, bw = 240; rect(c, mid - bw / 2, VH - 16, bw, 8, retro ? '#000' : 'rgba(0,0,0,.6)'); rect(c, mid - bw / 2 + 1, VH - 15, (bw - 2) * B.hp / B.max, 6, cp.bad);
      txt(c, g.t('b_' + B.kind), mid, VH - 20, { size: 10, align: 'center', color: '#fff', stroke: '#000', lw: 3, w: 900 });
    }
  };
  R.VW = VW; R.VH = VH;
})(typeof window !== 'undefined' ? window : globalThis);
