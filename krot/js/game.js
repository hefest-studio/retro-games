/* МУРАВЕЙНИК · логика (DOM-free). MURAV.Game / MURAV.level. Колония муравьёв идёт змейкой по туннелям, которые прокладывает
   головной муравей (стик). Земля копается медленно, готовый туннель — быстро. Крошки (груз) подбирают по одной на муравья:
   чем длиннее колония, тем больше несёшь за ходку; в камере (верхний ряд) груз сдаётся, каждые 2 сданные крошки выводят нового
   муравья. Жуки заходят в туннели; кнопка «Обвал» засыпает 4 клетки туннеля позади колонны — жук внутри замурован на 12 с,
   остальные отрезаны. Укус в середину цепочки отрывает хвост, укус в голову — минус жизнь. Мир портретный 11×13.
   Состояние S — чистые данные (JSON-клон для бота). Запускается и в браузере, и в node (vm без DOM). */
(function (global) {
  'use strict';
  var MU = global.MURAV = global.MURAV || {};
  var COLS = 11, ROWS = 13, MAX_LEVEL = 8, DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];     // 0 вверх, 1 вправо, 2 вниз, 3 влево
  var QUOTA = [3, 4, 5, 6, 6, 7, 8, 9];
  var BEETLES = [[], ['W'], ['W', 'W'], ['W', 'H'], ['H', 'W'], ['W', 'W', 'H'], ['W', 'H', 'G'], ['H', 'W', 'G']];
  var BDUR = { W: 0.44, H: 0.26, G: 0.28 }, GDIG = 1.0;
  var C = { COLS: COLS, ROWS: ROWS, MAX_LEVEL: MAX_LEVEL, DX: DX, DY: DY, LIVES: 3, WALK: 0.2, DIG: 0.4, CD: 6, MAXLEN: 10, MINLEN: 3, BURY: 12, QUOTA: QUOTA };
  MU.consts = C; MU.beetleTypes = BEETLES;

  function rnd(S) { S.rs = S.rs + 0x6D2B79F5 | 0; var t = Math.imul(S.rs ^ S.rs >>> 15, 1 | S.rs); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function inb(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS; }

  // ---------- уровни: фиксированные по номеру ----------
  function level(i) {
    var R = { rs: 7919 + i * 104729 }, map = [], x, y, k, tries;
    for (y = 0; y < ROWS; y++) { map.push([]); for (x = 0; x < COLS; x++) map[y].push(y === 0 ? 'c' : '1'); }
    var types = BEETLES[i], bt = [], caves = [];
    types.forEach(function (t, n) {
      for (tries = 0; tries < 300; tries++) {
        var w = 3 + (rnd(R) * 2 | 0), h = 1 + (rnd(R) * 2 | 0), x0 = 1 + (rnd(R) * (COLS - 2 - w) | 0), y0 = 4 + (rnd(R) * (ROWS - 5 - h) | 0), bad = false;
        caves.forEach(function (c) { if (x0 < c.x + c.w + 1 && c.x < x0 + w + 1 && y0 < c.y + c.h + 1 && c.y < y0 + h + 1) bad = true; });
        if (bad) continue;
        caves.push({ x: x0, y: y0, w: w, h: h });
        for (y = y0; y < y0 + h; y++) for (x = x0; x < x0 + w; x++) map[y][x] = '.';
        bt.push({ t: t, x: x0 + (w >> 1), y: y0 }); break;
      }
    });
    var rocks = 5 + i;
    for (k = 0, tries = 0; k < rocks && tries < 200; tries++) { x = rnd(R) * COLS | 0; y = 2 + (rnd(R) * (ROWS - 2) | 0); if (map[y][x] !== '1' || (x === 5 && y < 4)) continue; map[y][x] = '#'; k++; }
    var cr = [], total = QUOTA[i] + 3;
    for (tries = 0; cr.length < total && tries < 600; tries++) {
      var f = Math.pow(rnd(R), i === 0 ? 1.6 : 1.1); y = 2 + Math.floor(f * (ROWS - 3)); x = 1 + (rnd(R) * (COLS - 2) | 0);
      if (i === 0) { y = Math.min(y, 5); }
      if (map[y][x] === '#' || cr.some(function (c) { return Math.abs(c[0] - x) + Math.abs(c[1] - y) < 2; }) || bt.some(function (b) { return b.x === x && b.y === y; })) continue;
      cr.push([x, y]);
    }
    return { map: map.map(function (r) { return r.join(''); }), crumbs: cr, beetles: bt, quota: QUOTA[i], start: [5, 0] };
  }
  MU.level = level;

  // ---------- состояние ----------
  function place(S, n) {
    var hx = Math.min(COLS - 1, Math.max(5, n - 1)); S.ants = [];
    for (var i = 0; i < n; i++) S.ants.push({ x: hx - i, y: 0, c: 0 });
    S.mv = null; S.face = 2; S.dir = -1; S.want = -1; S.wantT = 0; S.flipT = 0;
  }
  function load(S, lv, len) {
    var L = level(lv); S.level = lv; S.map = L.map.map(function (r) { return r.split(''); }); S.quota = L.quota; S.got = 0;
    S.crumbs = L.crumbs.map(function (c) { return { x: c[0], y: c[1], on: true }; });
    S.beetles = L.beetles.map(function (b, i) { return { id: i, t: b.t, hx: b.x, hy: b.y, x: b.x, y: b.y, cx: b.x, cy: b.y, tx: -1, ty: -1, p: 0, dur: 1, dig: false, d: i % 2 ? 1 : 3, st: 'walk', tm: 0.8, wait: 0 }; });
    place(S, len); S.cd = 3; S.inv = 0; S.combo = 0; S.comboT = 0; S.pend = 0; S.hatchN = 0; S.time = 0; S.mode = 'play'; S.dieT = 0; S.clearT = 0;
  }
  function pk(S, x, y) { return S.ants.some(function (a) { return a.x === x && a.y === y; }); }
  function buriedAt(S, x, y) { return S.beetles.some(function (b) { return b.st === 'buried' && b.cx === x && b.cy === y; }); }
  function open(S, x, y) { return inb(x, y) && S.map[y][x] === '.'; }

  function dropCrumb(S, x, y) {   // потерянный груз ложится на ближайшую свободную клетку
    for (var r = 0; r < 6; r++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
      var X = x + dx, Y = y + dy; if (!inb(X, Y) || Y < 1 || S.map[Y][X] === '#' || S.map[Y][X] === 'c') continue;
      if (S.crumbs.some(function (c) { return c.on && c.x === X && c.y === Y; })) continue;
      S.crumbs.push({ x: X, y: Y, on: true }); return;
    }
  }
  function bfs(S, b, canDig, maxD) {   // шаг жука к ближайшему муравью (не в камере): направление или -1
    var seen = {}, q = [[b.cx, b.cy, -1, 0]], k = 0; seen[b.cx + ',' + b.cy] = 1;
    while (k < q.length) {
      var c = q[k++]; if (c[3] > maxD) break;
      if (c[3] > 0 && c[1] > 0 && pk(S, c[0], c[1])) return c[2];
      for (var d = 0; d < 4; d++) {
        var x = c[0] + DX[d], y = c[1] + DY[d], key = x + ',' + y;
        if (!inb(x, y) || y < 1 || seen[key]) continue; var ch = S.map[y][x];
        if (ch !== '.' && !(canDig && ch === '1')) continue; seen[key] = 1; q.push([x, y, c[3] ? c[2] : d, c[3] + 1]);
      }
    }
    return -1;
  }
  function decide(S, b) {
    var d = -1;
    if (b.t === 'H') d = bfs(S, b, false, 10); else if (b.t === 'G') d = bfs(S, b, true, 8);
    if (d >= 0 && !b.chase) { b.chase = 1; b.tm = 0.7; b.alert = 0.7; return false; }
    if (d < 0) b.chase = 0;
    if (d < 0) {
      var opts = [], back = (b.d + 2) % 4, k;
      for (k = 0; k < 4; k++) { if (k !== back && open(S, b.cx + DX[k], b.cy + DY[k])) opts.push(k); }
      if (!opts.length) { if (open(S, b.cx + DX[back], b.cy + DY[back])) d = back; }
      else if (opts.indexOf(b.d) >= 0 && rnd(S) < 0.85) d = b.d; else d = opts[rnd(S) * opts.length | 0];
    }
    if (d < 0) return false;
    var x = b.cx + DX[d], y = b.cy + DY[d]; b.d = d; b.tx = x; b.ty = y; b.p = 0; b.dig = S.map[y][x] === '1'; b.dur = b.dig ? GDIG : BDUR[b.t]; return true;
  }
  function moveBeetles(S, dt) {
    S.beetles.forEach(function (b) {
      if (b.st !== 'walk') { b.tm -= dt; if (b.tm <= 0) { if (b.st === 'buried') S.map[b.cy][b.cx] = '.'; b.st = 'walk'; b.tm = 0; } return; }
      var left = dt;
      if (b.tm > 0) { b.tm -= dt; return; }
      while (left > 0) {
        if (b.tx < 0) { if (b.wait > 0) { b.wait -= left; return; } if (!decide(S, b)) { if (!b.chase || b.tm <= 0) b.wait = 0.4; return; } }
        var need = (1 - b.p) * b.dur;
        if (left >= need) {
          left -= need; if (b.dig) S.map[b.ty][b.tx] = '.';
          b.cx = b.tx; b.cy = b.ty; b.x = b.cx; b.y = b.cy; b.tx = -1; b.p = 0;
        } else { b.p += left / b.dur; left = 0; b.x = b.cx + (b.tx - b.cx) * b.p; b.y = b.cy + (b.ty - b.cy) * b.p; }
      }
    });
  }
  function apos(S, i) { var a = S.ants[i]; if (!S.mv) return [a.x, a.y]; var to = i === 0 ? [S.mv.tx, S.mv.ty] : [S.ants[i - 1].x, S.ants[i - 1].y]; return [a.x + (to[0] - a.x) * S.mv.t, a.y + (to[1] - a.y) * S.mv.t]; }

  function startStep(S, ev) {
    var d = S.dir >= 0 ? S.dir : (S.wantT > 0 ? S.want : -1); if (d < 0) return false;
    var a = S.ants, h = a[0], tx = h.x + DX[d], ty = h.y + DY[d];
    if (!inb(tx, ty) && h.y === 0 && d === 0) {   // упёрся в потолок камеры: колонна сама идёт вдоль камеры, подтягивая хвост
      var free = [1, 3].filter(function (k) { var x = h.x + DX[k]; return x >= 0 && x < COLS && !pk(S, x, 0); });
      if (free.length) { d = free.length === 2 ? (h.x < 5 ? 1 : 3) : free[0]; tx = h.x + DX[d]; ty = 0; }
    }
    if (!inb(tx, ty) || S.map[ty][tx] === '#' || buriedAt(S, tx, ty)) { S.wantT = 0; return false; }
    if (a.length > 1 && a[1].x === tx && a[1].y === ty) { if (S.flipT > 0) return false; a.reverse(); S.flipT = 0.3; S.wantT = 0; ev('flip', { x: a[0].x, y: a[0].y }); return false; }
    for (var i = 1; i < a.length; i++) if (a[i].x === tx && a[i].y === ty && !(i === a.length - 1 && !S.pend)) { S.wantT = 0; return false; }
    var dig = S.map[ty][tx] === '1'; S.face = d; S.mv = { d: d, tx: tx, ty: ty, t: 0, dur: dig ? C.DIG : C.WALK, dig: dig }; S.wantT = 0; return true;
  }
  function finishStep(S, ev) {
    var a = S.ants, m = S.mv, n = a.length, tail = { x: a[n - 1].x, y: a[n - 1].y }, i;
    for (i = n - 1; i > 0; i--) { a[i].x = a[i - 1].x; a[i].y = a[i - 1].y; } a[0].x = m.tx; a[0].y = m.ty; S.mv = null;
    if (m.dig) { S.map[m.ty][m.tx] = '.'; ev('dig', { x: m.tx, y: m.ty }); } else ev('step', {});
    if (S.pend > 0 && n < C.MAXLEN) { a.push({ x: tail.x, y: tail.y, c: 0 }); S.pend--; ev('hatch', { x: tail.x, y: tail.y }); }
    S.crumbs.forEach(function (c) {
      if (!c.on || c.x !== m.tx || c.y !== m.ty) return;
      for (var k = 0; k < a.length; k++) if (!a[k].c) { a[k].c = 1; c.on = false; ev('pick', { x: c.x, y: c.y, load: a.filter(function (z) { return z.c; }).length }); return; }
    });
    a.forEach(function (z) {
      if (!z.c || z.y !== 0) return; z.c = 0; S.got++; S.combo++; S.comboT = 3; S.hatchN++; if (S.hatchN % 2 === 0) S.pend++;
      var pts = 50 * Math.min(6, S.combo); S.score += pts; ev('deliver', { x: z.x, y: 0, pts: pts, n: S.combo });
    });
    if (S.got >= S.quota && S.mode === 'play') { var bonus = 200 + 50 * S.lives; S.score += bonus; S.mode = 'clear'; S.clearT = 2.2; S.bonus = bonus; ev('clear', { level: S.level, bonus: bonus }); }
  }
  function moveAnts(S, dt, ev) {
    var left = dt, guard = 0;
    while (left > 0 && S.mode === 'play' && guard++ < 20) {
      if (S.mv) { var need = (1 - S.mv.t) * S.mv.dur; if (left >= need) { left -= need; finishStep(S, ev); } else { S.mv.t += left / S.mv.dur; left = 0; } }
      else if (!startStep(S, ev)) break;
    }
  }
  function respawn(S) {
    S.ants.forEach(function (a) { if (a.c) dropCrumb(S, a.x, a.y); });
    S.beetles.forEach(function (b) { if (b.st === 'buried') S.map[b.cy][b.cx] = '.'; b.x = b.cx = b.hx; b.y = b.cy = b.hy; b.tx = -1; b.p = 0; b.st = 'walk'; b.tm = 1.5; });
    place(S, C.MINLEN); S.inv = 1.8; S.mode = 'play'; S.combo = 0; S.pend = 0;
  }
  function collide(S, ev) {
    if (S.inv > 0 || S.mode !== 'play') return;
    for (var bi = 0; bi < S.beetles.length; bi++) {
      var b = S.beetles[bi]; if (b.st !== 'walk' || b.tm > 0) continue;
      for (var i = 0; i < S.ants.length; i++) {
        var p = apos(S, i); if (Math.abs(p[0] - b.x) + Math.abs(p[1] - b.y) > 0.8) continue;
        b.st = 'stun'; b.tm = 2.0; b.tx = -1; b.p = 0; b.x = b.cx; b.y = b.cy;
        if (i === 0 && b.t === 'W' && S.ants.length > 2) { if (S.ants[0].c) dropCrumb(S, S.ants[0].x, S.ants[0].y); S.inv = 1.0; S.mv = null; S.ants.shift(); ev('bite', { x: p[0], y: p[1], lost: 1, by: b.t, head: 1 }); }
        else if (i === 0) { S.lives--; S.mode = 'dying'; S.dieT = 1.2; ev('hurt', { x: p[0], y: p[1], by: b.t }); }
        else { for (var k = i; k < S.ants.length; k++) if (S.ants[k].c) dropCrumb(S, S.ants[k].x, S.ants[k].y); S.ants.length = i; S.inv = 0.8; ev('bite', { x: p[0], y: p[1], lost: i, by: b.t }); }
        return;
      }
    }
  }
  function collapse(S, ev) {
    if (S.mode !== 'play') return false;
    if (S.cd > 0) { ev('nogo', {}); return false; }
    var t = S.ants[S.ants.length - 1], seen = {}, q = [[t.x, t.y, 0]], k = 0, cells = [];
    seen[t.x + ',' + t.y] = 1;
    while (k < q.length) {
      var c = q[k++]; if (c[2] >= 4) continue;
      for (var d = 0; d < 4; d++) {
        var x = c[0] + DX[d], y = c[1] + DY[d], key = x + ',' + y; if (!inb(x, y) || seen[key] || !open(S, x, y) || pk(S, x, y)) continue;
        if (S.mv && S.mv.tx === x && S.mv.ty === y) continue; seen[key] = 1; q.push([x, y, c[2] + 1]); cells.push([x, y]);
      }
    }
    if (!cells.length) { ev('nogo', {}); return false; }
    var ent = 0;
    cells.forEach(function (c) { S.map[c[1]][c[0]] = '1'; });
    S.beetles.forEach(function (b) {
      if (b.st === 'buried') return;
      var hit = cells.filter(function (c) { return (c[0] === b.cx && c[1] === b.cy) || (c[0] === b.tx && c[1] === b.ty); })[0];
      if (!hit) return; b.cx = hit[0]; b.cy = hit[1]; b.x = b.cx; b.y = b.cy; b.tx = -1; b.p = 0; b.st = 'buried'; b.tm = C.BURY; S.score += 100; ent++;
    });
    S.cd = C.CD; ev('collapse', { cells: cells, ent: ent }); if (ent) ev('entomb', { n: ent }); return true;
  }

  function step(S, dt, ev) {
    if (S.mode === 'clear') { S.clearT -= dt; if (S.clearT <= 0) { if (S.level >= MAX_LEVEL - 1) { S.mode = 'victory'; ev('victory', {}); } else { if (S.level === 1 || S.level === 3 || S.level === 5) { S.lives = Math.min(5, S.lives + 1); ev('life', {}); } load(S, S.level + 1, Math.max(C.MINLEN, Math.min(8, S.ants.length))); ev('level', { level: S.level }); } } return; }
    if (S.mode === 'dying') { S.dieT -= dt; if (S.dieT <= 0) { if (S.lives <= 0) { S.mode = 'gameover'; ev('gameover', {}); } else respawn(S); } return; }
    if (S.mode !== 'play') return;
    S.time += dt; S.cd = Math.max(0, S.cd - dt); S.inv = Math.max(0, S.inv - dt); S.wantT = Math.max(0, S.wantT - dt); S.flipT = Math.max(0, S.flipT - dt);
    if (S.comboT > 0 && (S.comboT -= dt) <= 0) S.combo = 0;
    moveAnts(S, dt, ev); moveBeetles(S, dt); collide(S, ev);
  }

  function wrap(S, onEvent) {
    var ev = function (t, d) { if (onEvent) onEvent(t, d || {}); };
    var api = {
      state: function () { return S; },
      step: function (dt) { step(S, dt, ev); },
      setDir: function (d) { if (d !== S.dir && d >= 0) { S.want = d; S.wantT = 0.25; } S.dir = d; },
      collapse: function () { return collapse(S, ev); },
      clone: function () { return wrap(JSON.parse(JSON.stringify(S)), null); },
      isOver: function () { return S.mode === 'gameover' || S.mode === 'victory'; },
      revive: function () { S.lives = 1; respawn(S); S.inv = 2.5; },
      addAnts: function (n) { S.pend += n; },
      pos: function (i) { return apos(S, i); }
    };
    return api;
  }
  MU.Game = function (o) {
    o = o || {}; var S = { seed: o.seed || 1, rs: o.seed || 1, lives: o.lives || C.LIVES, score: 0, level: 0 };
    load(S, o.level || 0, o.length || C.MINLEN);
    return wrap(S, o.onEvent);
  };
  MU.fromState = wrap;
})(typeof window !== 'undefined' ? window : globalThis);
