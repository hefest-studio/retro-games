/* МЕДНАЯ СЛОБОДА · спрайты как матрицы индексов палитры (v2: крупные бойцы ~58 px, мимика, ключевые позы целиком).
   Формат матрицы: массив строк одинаковой длины, один символ = один пиксель, '.' — прозрачный; символ → индекс PAL (KEY).
   Две части системы:
   1) СКЕЛЕТ-СБОРКА (этот файл) — для idle/ходьбы: голова (матрица + мимика-патч), торс (матрица, сдвиг рядов = наклон
      без поворота на дробный угол), конечности — «капсулы» по суставам (2 кости, IK), шар-светотень 3 тонами рампы,
      перчатка/сапог — матрицы. Дальняя рука/нога — на ступень темнее (SHADE). Поворот только на 90° (без потерь).
   2) КЛЮЧЕВЫЕ ПОЗЫ (js/poses.js) — ЦЕЛЫЕ МАТРИЦЫ кадров (замах/удар/возврат для джеба, кросса, пинка; урон, падение,
      лёжа, подъём, прыжок). Черновик каждой позы снят со скелета (tools/bake-poses.mjs), дальше правится в матрице.
   Вторичное движение: повязка (хвосты) и фартук-полог рисуются в точке крепления ПРЕДЫДУЩЕГО кадра цепочки
   (полог — на 1 кадр, хвосты — на 2), смещение ограничено ±2 px — отстают и догоняют.
   Модуль UMD: браузер (window.HB.sprites) и Node (тесты/запекание). */
(function (global) {
  'use strict';

  // ---------- Палитра: 16 цветов на весь прототип (персонажи, фон, частицы, шрифт, HUD) ----------
  var PAL = [
    null,       // 0 прозрачный (не считается)
    '#141013',  // 1 k  чернила (контур, зрачок)
    '#2e1f30',  // 2 p  слива (внутренний контур, сапоги, брови врага)
    '#563043',  // 3 w  вино (глубокая тень, рот, мостовая)
    '#8f4536',  // 4 r  ржа (тень меди, брови героя)
    '#c96a3a',  // 5 c  медь (фартук, перчатки, волосы)
    '#f0a050',  // 6 o  рыжий (свет меди, волосы)
    '#ffe08a',  // 7 g  латунь-золото (пряжки, искры, текст)
    '#fff6e6',  // 8 W  белый тёплый (блик глаза, зубы, вспышка)
    '#f2b58e',  // 9 s  кожа
    '#c27566',  // 10 S кожа в тени (сдвиг к розовому)
    '#1b1d33',  // 11 n ночь
    '#2f3a5c',  // 12 l сланец (штаны, кепка врага)
    '#4f6b8f',  // 13 b сталь
    '#92b4c8',  // 14 m пар
    '#2f5e55',  // 15 t патина тёмная (рубаха, повязка в тени)
    '#5f9c7c'   // 16 v патина светлая
  ];
  var KEY = { '.': 0, k: 1, p: 2, w: 3, r: 4, c: 5, o: 6, g: 7, W: 8, s: 9, S: 10, n: 11, l: 12, b: 13, m: 14, t: 15, v: 16 };
  var CHR = []; Object.keys(KEY).forEach(function (k) { CHR[KEY[k]] = k; });
  // Контур на освещённой стороне (сверху/слева) — на ступень темнее материала; дальний план — на ступень темнее.
  var LIT = [0, 1, 1, 2, 3, 4, 4, 5, 14, 10, 3, 1, 11, 12, 13, 2, 15];
  var SHADE = [0, 1, 1, 2, 3, 4, 5, 6, 14, 10, 3, 1, 11, 12, 13, 2, 15];
  var FW = 80, FH = 72, FOOT_X = 40, GROUND = 70;   // канонический кадр; подошва — ряд 70, контур — 71

  // ---------- Детали (смотрят вправо, свет сверху-слева) ----------
  var P = {};
  // ГЕРОЙ — подмастерье Искрен: рыжие вихры назад, тканевая повязка цвета патины (узел сзади, хвосты — отдельно).
  P.heroHead = [
    '..........o..o..........',
    '......o..oo.oo..o.......',
    '.....oo.ooooooooo.......',
    '...o.oooooooooooooo.....',
    '..ooooooooccoooooooo....',
    '.cooooocccoooooocooo....',
    'ccooocccoooooccooooc....',
    '.vvvvvvvvvvvvvvvvvvvc...',
    'vtvvvvvvvvvvvvvvvvvvvo..',
    'ttttttttttttttttttttto..',
    '.rrcsssssssssssssssco...',
    '.rrcssssssssssssssssss..',
    '..rcSsssssssssssssssss..',
    '..rcSSsssssssssssssssss.',
    '..rSSwsssssssssssssssss.',
    '...rSSssssssssssssssssss',
    '...rSSssssssssssssssssS.',
    '....SSsssssssssssssssS..',
    '.....SSsssssssssssssSS..',
    '......SSSsssssssssSS....',
    '........SSSSSSSSSSS.....',
    '..........SSSSSSS.......'
  ];
  P.heroTorso = [
    '.....tvvvvt.....',
    '..ttvvcvvcvvtt..',
    '.tvvvvcvvcvvvvt.',
    'tvvvvrccccrvvvvt',
    'tvvvvrcoccrvvvtt',
    'tvvvvrcocccrvvtt',
    'ttvvvrcocccrvttt',
    'ttvvrccocccrvttt',
    '.ttvrcccccccrtt.',
    '.ttrcccccccccrt.',
    '..bbbbbggbbbbb..',
    '..lllllgWglllll.',
    '..nllllllllllln.',
    '..nlllllllllln..',
    '..nnllllllllnn..'
  ];
  P.heroFlap = [   // полог фартука ниже ремня (вторичное движение)
    'rcocccrw',
    'rcoccccr',
    'rcocccrw',
    '.rcoccrw',
    '.rccccw.',
    '..wrrw..'
  ];
  P.heroTailsA = [ // хвосты повязки, точка крепления — правый верх
    '....tvvt',
    '..tvvtt.',
    '.tvt.vt.',
    'tt...vt.',
    '....vt..'
  ];
  P.heroTailsB = [
    '.....tvt',
    'ttvvvvt.',
    '.tt..vt.',
    '.....vvt',
    '......t.'
  ];
  P.heroGlove = [   // тёмная кожа рукавицы — отдельно от медного фартука
    '.wrcc.',
    'wrcccr',
    'wrcrrr',
    'wrrrrr',
    'pwrrrw',
    '.pwww.'
  ];
  P.boot = [
    '.pwwp....',
    '.pwwwwp..',
    'ppwwwwwwp',
    'ppppppppp',
    '.kkkkkkk.'
  ];
  // ВРАГ — кочегар: вязаная кепка, тяжёлые брови, усы щёткой, жилетка на голое тело.
  P.foeHead = [
    '.......lllllll..........',
    '.....llbbbbbbbll........',
    '....lbbmbbbbbbbbl.......',
    '...lbbmbbbbbbbbbbl......',
    '..lbbbbbbbbbbbbbbbl.....',
    '..lbbbbbbbbbbbbbbbbl....',
    '.nlllllllllllllllllln...',
    '.nlnlnlnlnlnlnlnlnlln...',
    '..SSsssssssssssssssS....',
    '..SsssssssssssssssssS...',
    '.SSssssssssssssssssssS..',
    '.SwSsssssssssssssssssss.',
    '.SwSssssssssssssssssssss',
    '.SSssssssssssssssssssss.',
    '..SsssssssssssssssssssS.',
    '..SSssssssssssssssssssS.',
    '..SSSsssssssssssssssssS.',
    '...SSSsssssssssssssssSS.',
    '...SSSSSsssssssssssSSS..',
    '....SSSSSSSSSSSSSSSSS...',
    '.....SSSSSSSSSSSSSSS....',
    '........SSSSSSSSS.......'
  ];
  P.foeTorso = [
    '.......ssssss.......',
    '...lbbbSsssssSbbl...',
    '..lbbmbbSsssSbbbbl..',
    '.lbbmbbbSsssSbbbbbl.',
    'lbbmbbbbbSsSbbbbbbbl',
    'lbbbbbbbbSsSbbbbgbbl',
    'lbgbbbbbbSsSbbbbbbbl',
    'lbbbbbbbbSSSbbbbbbll',
    'llbbbbbbbbSbbbbbbbll',
    '.llbbbbbbbbbbbbbbll.',
    '.lllbbbbbbbbbbbblll.',
    '..pppppppppgpppppp..',
    '..pppppppppgWgpppp..',
    '..wrrrrrrrrrrrrrrrw.',
    '..wrrrrrrrrrrrrrrw..',
    '..wwrrrrrrrrrrrrww..'
  ];
  P.foeFlap = [    // тряпка на ремне
    'pwwp.',
    'pwwrp',
    '.pwrp',
    '.pwwp',
    '..pwp',
    '..pp.'
  ];
  P.foeFist = [
    '.SSss.',
    'Ssssss',
    'SSSSss',
    'Ssssss',
    'wSSSSS',
    '.wwww.'
  ];
  // Мимика: патчи поверх головы [ряд, столбец, строка] ('_' — не трогать). n — обычное, a — удар, h — урон.
  var FACES = {
    hero: {
      n: [[11, 12, 'rrr'], [11, 19, 'rr'], [12, 13, 'Wk'], [13, 13, 'kk'], [14, 13, 'kk'], [12, 19, 'Wk'], [13, 19, 'kk'], [14, 19, 'kk'],
        [16, 22, 'S'], [18, 16, 'ww']],
      a: [[11, 12, 'rr'], [12, 14, 'r'], [11, 20, 'rr'], [12, 19, 'r'], [13, 13, 'kW'], [14, 13, 'kk'], [13, 20, 'k'], [14, 20, 'k'],
        [16, 22, 'S'], [17, 16, 'kkkk'], [18, 16, 'kWWk'], [19, 17, 'kk']],
      h: [[10, 13, 'rr'], [11, 12, 'r'], [10, 19, 'r'], [11, 20, 'rr'], [12, 13, 'k'], [13, 14, 'k'], [14, 13, 'k'], [12, 20, 'k'], [13, 19, 'k'], [14, 20, 'k'],
        [16, 22, 'S'], [17, 17, 'kk'], [18, 16, 'kwwk'], [19, 17, 'kk']]
    },
    foe: {
      n: [[9, 11, 'ppppp'], [9, 19, 'ppp'], [11, 13, 'Wk'], [12, 13, 'kk'], [11, 20, 'k'], [12, 20, 'k'], [13, 23, 'S'], [14, 22, 'SS'],
        [16, 16, 'ppppppp'], [17, 15, 'pp'], [17, 22, 'p']],
      a: [[9, 11, 'ppp'], [10, 13, 'ppp'], [9, 20, 'ppp'], [10, 19, 'p'], [11, 13, 'kk'], [12, 13, 'kk'], [11, 20, 'k'], [12, 20, 'k'], [13, 23, 'S'], [14, 22, 'SS'],
        [16, 16, 'ppppppp'], [17, 16, 'kWWWWk'], [18, 17, 'kkkk']],
      h: [[8, 13, 'ppp'], [9, 11, 'pp'], [8, 19, 'pp'], [9, 21, 'pp'], [11, 13, 'k'], [12, 14, 'k'], [13, 13, 'k'], [11, 20, 'k'], [12, 19, 'k'], [13, 20, 'k'],
        [14, 22, 'SS'], [16, 16, 'ppppppp'], [17, 17, 'kkk'], [18, 17, 'kwk'], [19, 18, 'k']]
    }
  };
  function patch(rows, list) {
    var r = rows.slice();
    (list || []).forEach(function (p) { var y = p[0], x = p[1], s = p[2], row = r[y];
      for (var i = 0; i < s.length; i++) if (s[i] !== '_') row = row.slice(0, x + i) + s[i] + row.slice(x + i + 1);
      r[y] = row; });
    return r;
  }

  // ---------- Матрицы ----------
  function parse(rows) {
    var h = rows.length, w = rows[0].length, a = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) {
      if (rows[y].length !== w) throw new Error('спрайт: строка ' + y + ' длиной ' + rows[y].length + ', ждали ' + w);
      for (var x = 0; x < w; x++) { var v = KEY[rows[y][x]]; if (v === undefined) throw new Error('спрайт: неизвестный символ «' + rows[y][x] + '»'); a[y * w + x] = v; }
    }
    return { w: w, h: h, a: a };
  }
  function toRows(f) { var o = []; for (var y = 0; y < f.h; y++) { var s = ''; for (var x = 0; x < f.w; x++) s += CHR[f.a[y * f.w + x]]; o.push(s); } return o; }
  function recolor(p, map) { var o = { w: p.w, h: p.h, a: new Uint8Array(p.a.length) }; for (var i = 0; i < p.a.length; i++) o.a[i] = map[p.a[i]]; return o; }
  function charMap(m) { var o = []; for (var i = 0; i < PAL.length; i++) o[i] = i; Object.keys(m || {}).forEach(function (k) { o[KEY[k]] = KEY[m[k]]; }); return o; }
  function rot90(p) { var o = { w: p.h, h: p.w, a: new Uint8Array(p.a.length) };
    for (var y = 0; y < p.h; y++) for (var x = 0; x < p.w; x++) o.a[x * o.w + (p.h - 1 - y)] = p.a[y * p.w + x]; return o; }
  function rotPt(x, y, w, h, k) { for (var i = 0; i < k; i++) { var nx = h - 1 - y; y = x; x = nx; var t = w; w = h; h = t; } return [x, y]; }
  function rotN(p, k) { for (var i = 0; i < (k || 0); i++) p = rot90(p); return p; }
  function flipX(p) { var o = { w: p.w, h: p.h, a: new Uint8Array(p.a.length) };
    for (var y = 0; y < p.h; y++) for (var x = 0; x < p.w; x++) o.a[y * p.w + x] = p.a[y * p.w + p.w - 1 - x]; return o; }
  // Наклон торса без поворота на дробный угол: ряд y сдвигается на round(lean·(низ − y)) — целые сдвиги, без потерь.
  function shear(p, lean) {
    var sh = [], mn = 0, mx = 0, y, x;
    for (y = 0; y < p.h; y++) { sh[y] = Math.round(lean * (p.h - 1 - y)); mn = Math.min(mn, sh[y]); mx = Math.max(mx, sh[y]); }
    var o = { w: p.w + mx - mn, h: p.h, a: new Uint8Array((p.w + mx - mn) * p.h) };
    for (y = 0; y < p.h; y++) for (x = 0; x < p.w; x++) o.a[y * o.w + x + sh[y] - mn] = p.a[y * p.w + x];
    o.map = function (px, py) { var yy = Math.max(0, Math.min(p.h - 1, py)); return [px + sh[yy] - mn, py]; };
    return o;
  }

  // ---------- Персонажи: детали, материалы конечностей, суставы ----------
  var JH = { neck: [8, 0], sN: [4, 3], sF: [11, 3], hN: [5, 13], hF: [10, 13], hip: [8, 14], belt: [5, 12], headNeck: [13, 21], knot: [1, 8],
    r: [2.1, 1.7, 2.6, 2.2] };   // радиусы: плечо, предплечье, бедро, голень
  var JF = { neck: [10, 0], sN: [5, 3], sF: [14, 3], hN: [6, 14], hF: [13, 14], hip: [10, 15], belt: [5, 13], headNeck: [13, 21], knot: [1, 8],
    r: [2.8, 2.3, 3.1, 2.6] };
  var CH = {
    hero: { head: P.heroHead, face: FACES.hero, torso: P.heroTorso, flap: P.heroFlap, tails: [P.heroTailsA, P.heroTailsB], hand: P.heroGlove, boot: P.boot,
      upper: 'vvt', fore: 'ssS', thigh: 'bln', shin: 'bln', J: JH },
    foe: { head: P.foeHead, face: FACES.foe, torso: P.foeTorso, flap: P.foeFlap, tails: null, hand: P.foeFist, boot: P.boot,
      upper: 'bln', fore: 'ssS', thigh: 'rwp', shin: 'rwp', J: JF }
  };
  var PARTS = {};
  Object.keys(CH).forEach(function (c) {
    var d = CH[c], o = { head: {}, torso: parse(d.torso), flap: parse(d.flap), hand: parse(d.hand), boot: parse(d.boot), tails: d.tails && d.tails.map(parse), d: d };
    ['n', 'a', 'h'].forEach(function (e) { o.head[e] = parse(patch(d.head, d.face[e])); });
    PARTS[c] = o;
  });

  // ---------- Рендер позы со скелета ----------
  var LEN = { up: 7, fore: 7, thigh: 9, shin: 9.5 }, LIGHT = [-0.6, -0.8];
  function layer() { return new Uint8Array(FW * FH); }
  function stampL(L, p, ox, oy) { for (var y = 0; y < p.h; y++) for (var x = 0; x < p.w; x++) { var v = p.a[y * p.w + x], X = ox + x, Y = oy + y;
    if (v && X >= 0 && Y >= 0 && X < FW && Y < FH) L[Y * FW + X] = v; } }
  function capsuleL(L, A, B, r, ramp) {
    var ids = [KEY[ramp[0]], KEY[ramp[1]], KEY[ramp[2]]], dx = B[0] - A[0], dy = B[1] - A[1], dd = dx * dx + dy * dy || 1;
    var x0 = Math.floor(Math.min(A[0], B[0]) - r - 1), x1 = Math.ceil(Math.max(A[0], B[0]) + r + 1), y0 = Math.floor(Math.min(A[1], B[1]) - r - 1), y1 = Math.ceil(Math.max(A[1], B[1]) + r + 1);
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= FW || y >= FH) continue;
      var t = Math.max(0, Math.min(1, ((x - A[0]) * dx + (y - A[1]) * dy) / dd)), vx = x - (A[0] + t * dx), vy = y - (A[1] + t * dy), d = Math.sqrt(vx * vx + vy * vy);
      if (d > r + 0.15) continue;
      var s = d < 0.01 ? 0 : (vx * LIGHT[0] + vy * LIGHT[1]) / r;
      L[y * FW + x] = s > 0.35 ? ids[0] : s < -0.3 ? ids[2] : ids[1];
    }
  }
  // Слой → кадр. edge: где слой лёг поверх нарисованного, по кромке слоя — внутренний контур сливой. shade — дальний план.
  function comp(F, L, o) {
    o = o || {}; var i, x, y;
    if (o.edge) for (y = 0; y < FH; y++) for (x = 0; x < FW; x++) {
      i = y * FW + x; if (L[i] || !F[i] || F[i] === 1) continue;
      if ((x > 0 && L[i - 1]) || (x < FW - 1 && L[i + 1]) || (y > 0 && L[i - FW]) || (y < FH - 1 && L[i + FW])) F[i] = 2;
    }
    for (i = 0; i < L.length; i++) if (L[i]) F[i] = o.shade ? SHADE[L[i]] : L[i];
  }
  function ik(A, T, l1, l2, pref) {
    var dx = T[0] - A[0], dy = T[1] - A[1], d = Math.sqrt(dx * dx + dy * dy) || 0.001, max = l1 + l2 - 0.05;
    if (d > max) { T = [A[0] + dx / d * max, A[1] + dy / d * max]; dx = T[0] - A[0]; dy = T[1] - A[1]; d = max; }
    var ca = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))), a = Math.acos(ca), ux = dx / d, uy = dy / d, best = null;
    [a, -a].forEach(function (an) { var c = Math.cos(an), s = Math.sin(an), ex = A[0] + (ux * c - uy * s) * l1, ey = A[1] + (ux * s + uy * c) * l1;
      var sc = (ex - (A[0] + T[0]) / 2) * pref[0] + (ey - (A[1] + T[1]) / 2) * pref[1]; if (!best || sc > best.sc) best = { sc: sc, p: [ex, ey] }; });
    return { mid: best.p, end: T };
  }
  function R(p) { return [Math.round(p[0]), Math.round(p[1])]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function clampLag(cur, prev, n) { if (!prev) return cur; return [cur[0] + Math.max(-n, Math.min(n, prev[0] - cur[0])), cur[1] + Math.max(-n, Math.min(n, prev[1] - cur[1]))]; }

  // spec: { hip:[x,y], lean, rot (k·90° по часовой), head:[dx,dy], face:'n'|'a'|'h', aN/aF:[x,y] кисть ближней/дальней руки,
  //         lN/lF:[x,y] щиколотка, ebN/ebF/kbN/kbF — куда гнуть локоть/колено, bootN/bootF — поворот сапога, handN/handF — поворот кулака }
  // lag: { belt:[x,y], knot:[x,y] } — точки крепления из предыдущих кадров (вторичное движение). Возвращает { f, anchors }.
  function renderPose(spec, ch, lag, tick) {
    var C = PARTS[ch], J = C.d.J, rot = spec.rot || 0, F = layer();
    var t0 = shear(C.torso, spec.lean || 0), tor = rotN(t0, rot);
    function tp(pt) { var m = t0.map(pt[0], pt[1]); return rotPt(m[0], m[1], t0.w, t0.h, rot); }
    var hipL = tp(J.hip), org = [spec.hip[0] - hipL[0], spec.hip[1] - hipL[1]];
    function TP(pt) { var q = tp(pt); return [org[0] + q[0], org[1] + q[1]]; }
    var head = rotN(C.head[spec.face || 'n'], rot), hn = rotPt(J.headNeck[0], J.headNeck[1], C.head.n.w, C.head.n.h, rot);
    var neck = add(TP(J.neck), rot === 3 ? [0, 0] : [0, 1]), hOrg = add([neck[0] - hn[0], neck[1] - hn[1]], spec.head || [0, 0]);
    var kn = rotPt(J.knot[0], J.knot[1], C.head.n.w, C.head.n.h, rot), knot = [hOrg[0] + kn[0], hOrg[1] + kn[1]], belt = TP(J.belt);
    var anchors = { knot: knot, belt: belt };
    var d = C.d, L;
    function arm(sh, hand, eb, hrot, shade, edge) {
      var s = ik(sh, hand, LEN.up, LEN.fore, eb || [0.3, 1]); L = layer();
      capsuleL(L, sh, s.mid, J.r[0], d.upper); capsuleL(L, s.mid, s.end, J.r[1], d.fore);
      var dir = [s.end[0] - s.mid[0], s.end[1] - s.mid[1]], hp = C.hand; if (dir[0] < -0.5) hp = flipX(hp); hp = rotN(hp, hrot || 0);
      var e = R(s.end); stampL(L, hp, e[0] - (hp.w >> 1) + (dir[0] < -0.5 ? -1 : 1), e[1] - (hp.h >> 1));
      comp(F, L, { shade: shade, edge: edge });
    }
    function leg(hp, foot, kb, brot, shade, edge) {
      var s = ik(hp, foot, LEN.thigh, LEN.shin, kb || [1, 0]); L = layer();
      capsuleL(L, hp, s.mid, J.r[2], d.thigh); capsuleL(L, s.mid, s.end, J.r[3], d.shin);
      var b = rotN(C.boot, brot || 0), a = rotPt(3, 0, C.boot.w, C.boot.h, brot || 0), e = R(s.end); stampL(L, b, e[0] - a[0], e[1] - a[1]);
      comp(F, L, { shade: shade, edge: edge });
    }
    // 1) хвосты повязки (позади всего), 2) дальняя рука, 3) дальняя нога, 4) ближняя нога, 5) торс, 6) полог, 7) голова, 8) ближняя рука
    if (C.tails && !spec.noTails) {
      var tl = C.tails[(tick || 0) & 1], tk = R(clampLag(knot, lag && lag.knot, 2)); L = layer(); stampL(L, tl, tk[0] - tl.w + 1, tk[1] - 1); comp(F, L, {});
    }
    if (spec.aF) arm(TP(J.sF), spec.aF, spec.ebF, spec.handF, true, false);
    leg(TP(J.hF), spec.lF, spec.kbF, spec.bootF, true, false);
    leg(TP(J.hN), spec.lN, spec.kbN, spec.bootN, false, spec.edgeLegN);
    L = layer(); stampL(L, tor, org[0], org[1]); comp(F, L, { edge: !!spec.lN2 });
    var fl = rotN(C.flap, rot), fa = rotPt(C.flap.w >> 1, 0, C.flap.w, C.flap.h, rot), bp = R(clampLag(belt, lag && lag.belt, 2));
    L = layer(); stampL(L, fl, bp[0] - fa[0] + (rot ? 0 : 3), bp[1] - fa[1] + (rot ? 0 : 1)); comp(F, L, {});
    if (spec.aN && spec.armBehind) arm(TP(J.sN), spec.aN, spec.ebN, spec.handN, false, true);   // рука за головой (полёт навзничь)
    L = layer(); stampL(L, head, hOrg[0], hOrg[1]); comp(F, L, { edge: true });
    if (spec.aN && !spec.armBehind) arm(TP(J.sN), spec.aN, spec.ebN, spec.handN, false, true);
    // Опора: в наземных позах нижний пиксель — ряд подошвы (если IK не дотянулся до земли, кадр «садится» на неё).
    if (!spec.air) { var low = -1; for (var i = 0; i < F.length; i++) if (F[i]) low = (i / FW) | 0; var dy = GROUND - low;
      if (dy > 0 && dy < 6) { F.copyWithin(dy * FW, 0, F.length - dy * FW); F.fill(0, 0, dy * FW); anchors.knot[1] += dy; anchors.belt[1] += dy; } }
    var f = outline({ w: FW, h: FH, a: F });
    return { f: f, anchors: anchors };
  }
  // Селективный внешний контур: прозрачный пиксель рядом с телом → контур; свет сверху-слева: на освещённой кромке —
  // на ступень темнее материала (LIT), иначе чернила.
  function outline(f) {
    var w = f.w, h = f.h, s = f.a, a = new Uint8Array(s);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (s[y * w + x]) continue;
      var dn = y < h - 1 ? s[(y + 1) * w + x] : 0, rt = x < w - 1 ? s[y * w + x + 1] : 0, up = y > 0 ? s[(y - 1) * w + x] : 0, lf = x > 0 ? s[y * w + x - 1] : 0;
      if (!(dn || rt || up || lf)) continue;
      a[y * w + x] = (up || lf) ? 1 : LIT[dn || rt];
    }
    return { w: w, h: h, a: a };
  }

  // ---------- Сборка idle/ходьбы со скелета (кадры, где важна плавность, а не поза) ----------
  // Стойка: кулаки у подбородка, ноги на ширине плеч. Ходьба — 6 кадров: контакт → просадка → проход (тело выше).
  var G = GROUND - 4;   // щиколотка на земле
  var RUN = {
    idle0: { hip: [40, 49], lean: 0.05, aN: [44, 42], aF: [50, 41], lN: [35, G], lF: [46, G], prev: 'idle1', prev2: 'idle0' },
    idle1: { hip: [40, 50], lean: 0.05, head: [0, 0], aN: [44, 43], aF: [50, 42], lN: [35, G], lF: [46, G], prev: 'idle0', prev2: 'idle1' }
  };
  var WALK = [ // [бедро dy, ближняя стопа x,y, дальняя стопа x,y, мах рук]
    [0, 47, G, 33, G - 1, 0], [1, 44, G, 35, G - 2, 1], [-1, 40, G, 41, G - 4, 1],
    [0, 33, G - 1, 47, G, 0], [1, 35, G - 2, 44, G, -1], [-1, 41, G - 4, 40, G, -1]];
  WALK.forEach(function (w, i) {
    RUN['walk' + i] = { hip: [40, 49 + w[0]], lean: 0.1, lN: [w[1], w[2]], lF: [w[3], w[4]], aN: [43 - w[5], 43 + w[0]], aF: [49 + w[5], 42 + w[0]],
      prev: 'walk' + ((i + 5) % 6), prev2: 'walk' + ((i + 4) % 6) };
  });

  // Запекание набора: кадры по спецификациям + отставание вторичных деталей по цепочке prev/prev2.
  function bakeSet(specs, ch) {
    var anc = {}, out = {}, k;
    for (k in specs) anc[k] = renderPose(specs[k], ch, null, 0).anchors;
    var i = 0;
    for (k in specs) { var s = specs[k], lag = { belt: s.prev && anc[s.prev] && anc[s.prev].belt, knot: s.prev2 && anc[s.prev2] && anc[s.prev2].knot };
      out[k] = renderPose(s, ch, lag, s.tick != null ? s.tick : i++).f; }
    return { frames: out, anchors: anc };
  }

  // ---------- Ключевые позы: целые матрицы из js/poses.js (обрезаны по рамке, ox/oy — место в каноническом кадре) ----------
  var POSES = global.HB && global.HB.POSES;
  if (!POSES && typeof require === 'function') { try { POSES = require('./poses.js'); } catch (e) { POSES = null; } }
  function unpack(m) { var p = parse(m.rows), f = { w: FW, h: FH, a: new Uint8Array(FW * FH) };
    for (var y = 0; y < p.h; y++) for (var x = 0; x < p.w; x++) f.a[(y + m.oy) * FW + x + m.ox] = p.a[y * p.w + x]; return f; }

  var FOE_B = charMap({ b: 'r', l: 'w', m: 'c', n: 'p' });   // вариант врага: ржавая жилетка и кепка
  var SETS = {}, RUNSETS = {};
  function build() {
    var hero = bakeSet(RUN, 'hero').frames, foe = bakeSet(RUN, 'foe').frames, k;
    RUNSETS = { hero: hero, foe: foe };
    if (POSES) { for (k in POSES.hero) hero[k] = unpack(POSES.hero[k]); for (k in POSES.foe) foe[k] = unpack(POSES.foe[k]); }
    var b = {}; for (k in foe) b[k] = recolor(foe[k], FOE_B);
    SETS.hero = hero; SETS.stokerA = foe; SETS.stokerB = b;
  }
  build();
  var FRAMES = {}; Object.keys(SETS).forEach(function (s) { Object.keys(SETS[s]).forEach(function (k) { FRAMES[s + '.' + k] = SETS[s][k]; }); });

  var api = { PAL: PAL, KEY: KEY, CHR: CHR, LIT: LIT, SHADE: SHADE, SETS: SETS, FRAMES: FRAMES, RUN: RUN, P: P, FACES: FACES, PARTS: PARTS,
    parse: parse, toRows: toRows, patch: patch, renderPose: renderPose, bakeSet: bakeSet, outline: outline,
    FW: FW, FH: FH, FOOT_X: FOOT_X, GROUND: GROUND, hasPoses: !!POSES };
  global.HB = global.HB || {}; global.HB.sprites = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
