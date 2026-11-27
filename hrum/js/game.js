/* КАТЫШ · логика (DOM-free). KATYSH.Game / KATYSH.level / KATYSH.analyze
   Хомяк-катыш в прозрачном шаре катится по гладкому полу гумна: любое направление — и шар катится ДО СТЕНЫ или до стога
   (стог гасит ход). По пути подбирает семечки (чем длиннее накат — тем выше множитель). Коты-сторожа ходят по своим правилам;
   тормоз (раз в 3 с) останавливает шар на ближайшей клетке. Мир всегда портретный 13×17; в альбоме рендер поворачивает его.
   Запускается и в браузере, и в node (vm без DOM). Состояние S — чистые данные (клонируется JSON-ом: бот считает прогоны вперёд). */
(function (global) {
  'use strict';
  var KT = global.KATYSH = global.KATYSH || {};
  var COLS = 13, ROWS = 17, MAX_LEVEL = 8;
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];                 // 0 вверх, 1 вправо, 2 вниз, 3 влево
  var NAMES = ['up', 'right', 'down', 'left'];
  // типы котов по уровням: P — сторож (ходит туда-сюда), L — обходчик (идёт вдоль стены по часовой), H — ловчий (прыжок вдоль линии)
  var CATS = [[], ['P'], ['P', 'P'], ['P', 'L'], ['P', 'H'], ['P', 'L', 'H'], ['P', 'P', 'L', 'H'], ['P', 'L', 'H', 'H']];
  var SEEDS = [8, 10, 11, 12, 13, 14, 15, 16];
  var C = { COLS: COLS, ROWS: ROWS, MAX_LEVEL: MAX_LEVEL, DX: DX, DY: DY, HERO_V: 9, BRAKE_T: 3, LIVES: 3 };
  KT.consts = C;

  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- карта ----------
  function wall(map, x, y) { return x < 0 || y < 0 || x >= COLS || y >= ROWS || map[y][x] === '#'; }
  // Анализ скольжения: stops — клетки, где шар может стоять (от старта), trav — клетки, которые шар может пересечь.
  function analyze(map, sx, sy) {
    var stops = {}, trav = {}, q = [[sx, sy]], ns = 1, rev = {}; stops[sx + ',' + sy] = 1; trav[sx + ',' + sy] = 1;
    while (q.length) {
      var c = q.pop();
      for (var d = 0; d < 4; d++) {
        var x = c[0], y = c[1], moved = 0;
        while (!wall(map, x + DX[d], y + DY[d])) { x += DX[d]; y += DY[d]; moved++; trav[x + ',' + y] = 1; if (map[y][x] === 'h') break; }
        if (moved) { var kk = x + ',' + y; (rev[kk] = rev[kk] || []).push(c[0] + ',' + c[1]); if (!stops[kk]) { stops[kk] = 1; ns++; q.push([x, y]); } }
      }
    }
    // «замок»: из любой остановки можно вернуться на старт (иначе шар запирается в тупике навсегда)
    var back = {}, st = [sx + ',' + sy], nb = 1; back[st[0]] = 1;
    while (st.length) { var k0 = st.pop(), rr = rev[k0] || []; for (var ri = 0; ri < rr.length; ri++) if (!back[rr[ri]]) { back[rr[ri]] = 1; nb++; st.push(rr[ri]); } }
    return { stops: stops, nStops: ns, trav: trav, nTrav: Object.keys(trav).length, strong: nb === ns };
  }
  KT.analyze = analyze;

  // Уровень строится детерминированно из номера: рамка, россыпь камней, стога, семечки на путях шара, коты по таблице.
  var cache = {};
  function level(i) {
    i = Math.max(0, Math.min(MAX_LEVEL - 1, i | 0)); if (cache[i]) return cache[i];
    for (var attempt = 0; attempt < 400; attempt++) {
      var rnd = mulberry(7001 + i * 131 + attempt * 17), map = [], x, y;
      for (y = 0; y < ROWS; y++) { var row = ''; for (x = 0; x < COLS; x++) row += (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) ? '#' : '.'; map.push(row.split('')); }
      var nb = 20 + i, k, bx, by;
      for (k = 0; k < nb; k++) {
        bx = 1 + Math.floor(rnd() * (COLS - 2)); by = 1 + Math.floor(rnd() * (ROWS - 2)); map[by][bx] = '#';
        if (rnd() < 0.35) { var bd = Math.floor(rnd() * 4), nx = bx + DX[bd], ny = by + DY[bd]; if (nx > 0 && ny > 0 && nx < COLS - 1 && ny < ROWS - 1) map[ny][nx] = '#'; }
      }
      var sx = 6, sy = 14; map[sy][sx] = '.';
      var nh = i === 0 ? 3 : 2 + (i % 3);
      for (k = 0; k < nh; k++) { bx = 1 + Math.floor(rnd() * (COLS - 2)); by = 1 + Math.floor(rnd() * (ROWS - 2)); if (map[by][bx] === '.' && !(bx === sx && by === sy)) map[by][bx] = 'h'; }
      var an = analyze(map, sx, sy), floor = 0;
      for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) if (map[y][x] !== '#') floor++;
      if (!an.strong || an.nStops < 22 || an.nTrav < floor * 0.72) continue;
      // неоткатываемые клетки — в камень (никаких недоступных карманов)
      for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) if (map[y][x] !== '#' && !an.trav[x + ',' + y]) map[y][x] = '#';
      var cells = []; for (var key in an.trav) { var p = key.split(','); cells.push([+p[0], +p[1]]); }
      // семечки: разбросаны, не ближе 3 клеток друг к другу
      var seeds = [], want = SEEDS[i];
      for (k = cells.length - 1; k > 0; k--) { var j = Math.floor(rnd() * (k + 1)), t = cells[k]; cells[k] = cells[j]; cells[j] = t; }
      for (var md = 4; md >= 2 && seeds.length < want; md--) for (k = 0; k < cells.length && seeds.length < want; k++) {
        var c = cells[k]; if ((c[0] === sx && c[1] === sy) || map[c[1]][c[0]] === 'h') continue;
        var far = true; for (j = 0; j < seeds.length; j++) if (Math.abs(seeds[j][0] - c[0]) + Math.abs(seeds[j][1] - c[1]) < md) { far = false; break; }
        if (far && !seeds.some(function (s) { return s[0] === c[0] && s[1] === c[1]; })) seeds.push(c);
      }
      if (seeds.length < want) continue;
      // коты
      var cats = [], okc = true;
      CATS[i].forEach(function (tp) {
        var best = null;
        for (var tr = 0; tr < 200 && !best; tr++) {
          var c2 = cells[Math.floor(rnd() * cells.length)], cx = c2[0], cy = c2[1];
          if (Math.abs(cx - sx) + Math.abs(cy - sy) < 7 || map[cy][cx] === 'h') continue;
          if (cats.some(function (o) { return Math.abs(o.x - cx) + Math.abs(o.y - cy) < 4; })) continue;
          var d, run = [0, 0, 0, 0];
          for (d = 0; d < 4; d++) { var xx = cx, yy = cy; while (!wall(map, xx + DX[d], yy + DY[d]) && run[d] < 9) { xx += DX[d]; yy += DY[d]; run[d]++; } }
          if (tp === 'P') {
            var ax = run[1] + run[3], ay = run[0] + run[2]; if (Math.max(ax, ay) < 5) continue;
            var pd = ax >= ay ? 1 : 0, tm = map.map(function (r) { return r.slice(); }), dr, qx, qy, e;   // линия сторожа не должна быть единственным проходом к семечкам
            tm[cy][cx] = '#';
            for (dr = 0; dr < 2; dr++) { e = (pd + 2 * dr) % 4; qx = cx; qy = cy; while (!wall(map, qx + DX[e], qy + DY[e])) { qx += DX[e]; qy += DY[e]; tm[qy][qx] = '#'; } }
            var an2 = analyze(tm, sx, sy); if (!seeds.every(function (s) { return tm[s[1]][s[0]] === '#' || an2.trav[s[0] + ',' + s[1]]; })) continue;
            best = { t: 'P', x: cx, y: cy, d: pd };
          }
          else if (tp === 'L') { for (d = 0; d < 4; d++) if (wall(map, cx + DX[(d + 1) % 4], cy + DY[(d + 1) % 4]) && !wall(map, cx + DX[d], cy + DY[d])) { best = { t: 'L', x: cx, y: cy, d: d }; break; }
            if (best) {   // орбита обходчика не должна быть единственным проходом: моделируем обход и «закрываем» его клетки
              var tl = map.map(function (r) { return r.slice(); }), ox = cx, oy = cy, od = best.d, seenS = {}, ord = [1, 0, 3, 2], nn, kq;
              for (nn = 0; nn < 500; nn++) {
                tl[oy][ox] = '#'; kq = ox + ',' + oy + ',' + od; if (seenS[kq]) break; seenS[kq] = 1;
                for (kq = 0; kq < 4; kq++) { var nd = (od + ord[kq]) % 4; if (!wall(map, ox + DX[nd], oy + DY[nd])) { od = nd; ox += DX[nd]; oy += DY[nd]; break; } }
              }
              var an3 = analyze(tl, sx, sy); if (!seeds.every(function (s) { return tl[s[1]][s[0]] !== '#' && an3.trav[s[0] + ',' + s[1]]; })) best = null;
            } }
          else { if (Math.max.apply(null, run) < 4) continue; best = { t: 'H', x: cx, y: cy, d: 0 }; }
        }
        if (!best) okc = false; else cats.push(best);
      });
      if (!okc) continue;
      return (cache[i] = { map: map.map(function (r) { return r.join(''); }), start: [sx, sy], seeds: seeds, cats: cats, stops: an.nStops, trav: an.nTrav });
    }
    throw new Error('не удалось построить уровень ' + i);
  }
  KT.level = level;
  KT.catTypes = CATS;

  // ---------- игра ----------
  KT.Game = function (opts) {
    opts = opts || {};
    var onEvent = opts.onEvent || null, S;
    function emit(t, d) { if (onEvent) { try { onEvent(t, d || {}); } catch (e) { } } }
    function rnd() { var a = S.rng = (S.rng + 0x6D2B79F5) | 0, t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    function blocked(x, y) { return wall(S.map, x, y); }

    function mkCat(c, i) {
      var sp = c.t === 'H' ? 9 : c.t === 'L' ? 2.5 + S.level * 0.12 : 2.6 + S.level * 0.12;
      return { id: i, t: c.t, cx: c.x, cy: c.y, d: c.d, p: 0, moving: c.t !== 'H', v: sp, st: 'idle', tm: 0, x: c.x, y: c.y, hx: c.x, hy: c.y, hd: c.d, sees: -1 };
    }
    function loadLevel(lv) {
      var L = level(lv);
      S.level = lv; S.map = L.map.map(function (r) { return r.split(''); }); S.sx = L.start[0]; S.sy = L.start[1];
      S.seeds = L.seeds.map(function (s) { return { x: s[0], y: s[1], on: true }; }); S.left = S.seeds.length; S.total = S.seeds.length;
      S.cats = L.cats.map(mkCat); S.time = 0;
      respawn();
    }
    function respawn() {
      S.hero = { cx: S.sx, cy: S.sy, d: 0, p: 0, moving: false, x: S.sx, y: S.sy, stopNext: false, chain: 0, face: 0 };
      S.want = -1; S.wantT = 0; S.brakeC = 1; S.inv = 1.8;
      S.cats.forEach(function (c, i) { var L = level(S.level).cats[i]; if (L) S.cats[i] = mkCat(L, i); });
    }
    function fresh() {
      S = { mode: 'play', level: 0, score: 0, lives: opts.lives == null ? C.LIVES : opts.lives, hi: opts.hi || 0, rng: (opts.seed == null ? 12345 : opts.seed) | 0,
        shield: 0, t: 0, clearT: 0, dieT: 0, map: null, seeds: [], cats: [], hero: null, bumped: 0, stats: { slides: 0, brakes: 0, deaths: 0, best: 0 } };
      loadLevel(opts.level || 0);
    }

    // общий мув по клеткам: e.cx,e.cy — последняя клетка; движется к соседней по e.d, прогресс e.p ∈ [0,1)
    function advance(e, dist, onArrive) {
      var guard = 0;
      while (dist > 1e-9 && e.moving && guard++ < 40) {
        var need = 1 - e.p;
        if (dist >= need - 1e-9) { dist -= need; e.cx += DX[e.d]; e.cy += DY[e.d]; e.p = 0; onArrive(e); }
        else { e.p += dist; dist = 0; }
      }
      e.x = e.cx + DX[e.d] * e.p; e.y = e.cy + DY[e.d] * e.p;
    }
    function heroArrive(h) {
      var i, hit = false;
      for (i = 0; i < S.seeds.length; i++) {
        var s = S.seeds[i];
        if (s.on && s.x === h.cx && s.y === h.cy) { s.on = false; S.left--; h.chain++; var pts = 10 * Math.min(h.chain, 6); S.score += pts; hit = true; emit('seed', { x: h.cx, y: h.cy, pts: pts, chain: h.chain }); }
      }
      if (S.map[h.cy][h.cx] === 'h') { h.moving = false; emit('hay', { x: h.cx, y: h.cy }); }
      else if (blocked(h.cx + DX[h.d], h.cy + DY[h.d])) { h.moving = false; emit('bump', { x: h.cx, y: h.cy, d: h.d }); }
      else if (h.stopNext) { h.moving = false; emit('stop', { x: h.cx, y: h.cy }); }
      if (!h.moving) { h.stopNext = false; if (h.chain > S.stats.best) S.stats.best = h.chain; h.chain = 0; }
      if (S.left <= 0) clearLevel();
    }
    function clearLevel() {
      if (S.mode !== 'play') return;
      var bonus = 150 + Math.max(0, Math.round((70 - S.time) * 3)) + (S.lives >= 3 ? 50 : 0);
      S.score += bonus; if ((S.level === 2 || S.level === 5) && S.lives < 5) { S.lives++; emit('life', {}); } S.mode = 'clear'; S.clearT = 1.6; S.bonus = bonus; emit('clear', { bonus: bonus, level: S.level });
    }
    function startSlide(h, d) {
      if (blocked(h.cx + DX[d], h.cy + DY[d])) { h.d = d; S.bumped = 0.2; emit('nogo', { d: d }); return false; }
      h.d = d; h.face = d; h.moving = true; h.p = 0; h.chain = 0; h.stopNext = false; S.stats.slides++; emit('roll', { d: d }); return true;
    }

    // ----- коты -----
    function catArrive(c) {
      if (c.t === 'P') { if (blocked(c.cx + DX[c.d], c.cy + DY[c.d])) { c.d = (c.d + 2) % 4; if (blocked(c.cx + DX[c.d], c.cy + DY[c.d])) c.moving = false; } }
      else if (c.t === 'L') {
        var order = [1, 0, 3, 2];
        for (var k = 0; k < 4; k++) { var d = (c.d + order[k]) % 4; if (!blocked(c.cx + DX[d], c.cy + DY[d])) { c.d = d; return; } }
        c.moving = false;
      } else if (c.st === 'dash') { if (blocked(c.cx + DX[c.d], c.cy + DY[c.d])) { c.moving = false; c.st = 'rest'; c.tm = 1.4; } }
    }
    function sight(c) {      // ловчий видит героя по линии без стен (до 10 клеток)
      var h = S.hero, hx = Math.round(h.x), hy = Math.round(h.y);
      for (var d = 0; d < 4; d++) {
        var x = c.cx, y = c.cy, n = 0;
        while (n < 10 && !blocked(x + DX[d], y + DY[d])) { x += DX[d]; y += DY[d]; n++; if (x === hx && y === hy) return d; }
      }
      return -1;
    }
    function stepCat(c, dt) {
      if (c.t === 'H') {
        if (c.st === 'idle') { var d = sight(c); if (d >= 0) { c.st = 'alert'; c.tm = 0.45; c.hd = d; c.d = d; emit('alert', { id: c.id }); } }
        else if (c.st === 'alert') { c.tm -= dt; if (c.tm <= 0) { c.st = 'dash'; c.moving = true; c.p = 0; c.v = 9; emit('pounce', { id: c.id }); } }
        else if (c.st === 'rest') { c.tm -= dt; if (c.tm <= 0) c.st = 'idle'; }
        if (c.st === 'dash') advance(c, c.v * dt, catArrive); else { c.x = c.cx + (c.moving ? DX[c.d] * c.p : 0); c.y = c.cy + (c.moving ? DY[c.d] * c.p : 0); }
        return;
      }
      if (!c.moving) { c.tm += dt; if (c.tm > 0.5) { c.tm = 0; c.moving = true; c.d = (c.d + 2) % 4; } }
      advance(c, c.v * dt, catArrive);
    }

    function step(dt) {
      if (dt > 0.05) dt = 0.05;
      S.t += dt;
      if (S.bumped > 0) S.bumped -= dt;
      if (S.mode === 'clear') { S.clearT -= dt; if (S.clearT <= 0) { if (S.level + 1 >= MAX_LEVEL) { S.mode = 'victory'; emit('victory', { score: S.score }); } else { S.score += 0; loadLevel(S.level + 1); S.mode = 'play'; emit('level', { level: S.level }); } } return; }
      if (S.mode === 'dying') { S.dieT -= dt; if (S.dieT <= 0) { if (S.lives <= 0) { S.mode = 'gameover'; emit('gameover', { score: S.score }); } else { respawn(); S.mode = 'play'; } } return; }
      if (S.mode !== 'play') return;
      S.time += dt; if (S.inv > 0) S.inv -= dt;
      if (S.brakeC < 1) S.brakeC = Math.min(1, S.brakeC + dt / C.BRAKE_T);
      var h = S.hero;
      if (S.wantT > 0) { S.wantT -= dt; if (S.wantT <= 0) S.want = -1; }
      if (!h.moving && S.want >= 0) { var w = S.want; S.want = -1; startSlide(h, w); }
      if (h.moving) advance(h, C.HERO_V * dt, heroArrive); else { h.x = h.cx; h.y = h.cy; }
      if (S.mode !== 'play') return;
      if (!h.moving && S.want >= 0) { var w2 = S.want; S.want = -1; startSlide(h, w2); }   // буфер сработал сразу после остановки
      for (var i = 0; i < S.cats.length; i++) stepCat(S.cats[i], dt);
      if (S.inv > 0) return;
      for (i = 0; i < S.cats.length; i++) {
        var c = S.cats[i], dx = c.x - h.x, dy = c.y - h.y;
        if (dx * dx + dy * dy < 0.5) { hurt(c); break; }
      }
    }
    function hurt(c) {
      if (S.shield > 0) { S.shield--; S.inv = 1.6; emit('shield', { x: S.hero.x, y: S.hero.y }); return; }
      S.lives--; S.stats.deaths++; S.mode = 'dying'; S.dieT = 1.1; S.hero.moving = false; emit('hurt', { x: S.hero.x, y: S.hero.y, id: c.id, lives: S.lives });
    }

    fresh();
    var api = {
      state: function () { return S; }, step: step, consts: C,
      start: function () { fresh(); },
      // направление: 0..3 или 'up'/'right'/'down'/'left'
      setDir: function (d) { if (typeof d === 'string') d = NAMES.indexOf(d); if (d < 0 || d > 3 || S.mode !== 'play') return; if (!S.hero.moving) { S.want = -1; startSlide(S.hero, d); } else { S.want = d; S.wantT = 0.4; } },
      brake: function () { var h = S.hero; if (S.mode !== 'play' || !h.moving || S.brakeC < 1 || h.stopNext) return false; h.stopNext = true; S.brakeC = 0; S.stats.brakes++; emit('brake', {}); return true; },
      canRoll: function (d) { var h = S.hero; return !blocked(h.cx + DX[d], h.cy + DY[d]); },
      addShield: function () { S.shield = Math.min(2, S.shield + 1); },
      revive: function () { if (S.mode === 'gameover' || S.mode === 'dying') { S.lives = 1; S.shield = 0; respawn(); S.mode = 'play'; S.inv = 2.5; } },
      isOver: function () { return S.mode === 'gameover' || S.mode === 'victory'; },
      clone: function () { var o = KT.Game({ level: 0, lives: 1 }); o._set(JSON.parse(JSON.stringify(S))); return o; },
      _set: function (s) { S = s; }
    };
    return api;
  };
})(typeof window !== 'undefined' ? window : globalThis);
