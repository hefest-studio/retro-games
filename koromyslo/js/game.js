/* КОРОМЫСЛО · логика без DOM (тестируется в Node). KOROMYSLO.Game, KOROMYSLO.logic.
   Коромысло весов на опоре: по 4 чаши с каждой стороны (плечо 1…4). Сверху приходит гирька (1…5 точек) — игрок выбирает чашу.
   Пара зеркальных чаш (одно плечо слева и справа) с РАВНЫМ весом снимается и даёт очки (вес × плечо × число гирек × комбо).
   Момент T = Σ сторона·плечо·вес; |T| > допуска (10; с 4-го уровня 9, с 6-го 8, с 9-го 7) — перевес: худшая (крайняя) чаша тяжёлой стороны опрокидывается, −1 жизнь.
   Сложность по уровням (каждые 5 снятых пар): тяжелее гирьки, фитиль на ход (гирька падает сама), окалина — ржавые гирьки сверху. */
(function (global) {
  'use strict';
  var K = global.KOROMYSLO = global.KOROMYSLO || {};

  var PANS = 8, DIST = [4, 3, 2, 1, 1, 2, 3, 4], SIDE = [-1, -1, -1, -1, 1, 1, 1, 1];
  var CAP = 4, LIMIT = 10, MAX_LIVES = 3, PER_LEVEL = 4;
  // Геометрия поля 450×800 (портрет 9:16) — общая для логики (падение), рендера и ввода
  var GEO = { W: 450, H: 800, CX: 225, BEAM_Y: 292, STEP: 50, HANG: 150, PAN_W: 48, CUR_Y: 150, MAXANG: 0.2 };
  var TUT_W = [2, 2, 1, 1];          // обучение (первая партия): две пары — у опоры и на краях
  var FALL = 0.26, DEBRIS_FALL = 0.42;

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function mirror(i) { return PANS - 1 - i; }
  function sumPan(p) { var s = 0; for (var i = 0; i < p.length; i++) s += p[i].v; return s; }
  function torque(pans) { var t = 0; for (var i = 0; i < PANS; i++) t += SIDE[i] * DIST[i] * sumPan(pans[i]); return t; }
  function defDiff(level, base, step, max) { var v = base + (level - 1) * step; return max == null ? v : (step >= 0 ? Math.min(v, max) : Math.max(v, max)); }
  // индекс чаши по стороне (-1/1) и плечу (1…4)
  function panAt(side, d) { return side < 0 ? 4 - d : 3 + d; }

  // Параметры уровня. diff(level, base, step, max) — g.difficulty движка (main.js), по умолчанию — та же формула.
  function levelParams(level, diff) {
    diff = diff || defDiff;
    return {
      maxW: level <= 1 ? 2 : level <= 2 ? 3 : level <= 4 ? 4 : level <= 8 ? 5 : 6,
      fuse: level <= 1 ? 0 : Math.round(diff(level, 8.4, -0.7, 2.5) * 10) / 10,        // с на ход: 2 → 7.7 … 10+ → 2.5
      debrisEvery: level < 3 ? 0 : Math.round(diff(level, 6.4, -0.7, 2)),             // окалина раз в N ходов: 3 → 5, 4 → 4, 5 → 4, 6 → 3 … 8+ → 2
      limit: level < 4 ? LIMIT : level < 6 ? LIMIT - 1 : level < 9 ? LIMIT - 2 : LIMIT - 3,  // допуск перевеса: 10 → 9 (4–5) → 8 (6–8) → 7 (9+)
      debrisMax: level < 4 ? 2 : level < 7 ? 3 : level < 10 ? 4 : 5
    };
  }

  // Ход «по уму» (подсказка обучения, демо заставки, бот тестов): оценка каждой чаши для гирьки w.
  // o: { noise, rng } — разброс оценки (человечность). → индекс чаши или -1 (некуда).
  function evalMoves(pans, w, lim) {
    lim = lim || LIMIT;
    var sums = pans.map(sumPan), T = torque(pans), out = [];
    for (var i = 0; i < PANS; i++) {
      if (pans[i].length >= CAP) { out.push(null); continue; }
      var j = mirror(i), ns = sums[i] + w, T1 = T + SIDE[i] * DIST[i] * w, sc = 0;
      var clears = pans[j].length > 0 && ns === sums[j];
      if (clears) sc += 100 + ns * DIST[i] * (pans[i].length + 1 + pans[j].length) * 0.5;
      else {
        var diffAfter = Math.abs(ns - sums[j]), diffBefore = Math.abs(sums[i] - sums[j]);
        sc -= diffAfter * 1.5; if (pans[j].length === 0) sc -= w; if (diffAfter < diffBefore) sc += 2;
        if (pans[i].length + 1 >= CAP) sc -= 25;
      }
      if (Math.abs(T1) > lim) sc -= 1000; else sc -= Math.abs(T1) * 3;
      sc += DIST[i] * 0.5;
      out.push(sc);
    }
    return out;
  }
  function bestMove(pans, w, o) {
    o = o || {}; var sc = evalMoves(pans, w, o.limit), best = -1, bv = -Infinity;
    for (var i = 0; i < PANS; i++) { if (sc[i] == null) continue; var v = sc[i] + (o.noise ? (o.rng() - 0.5) * o.noise : 0); if (v > bv) { bv = v; best = i; } }
    return best;
  }

  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, onEvent = opts.onEvent || function () {}, diff = opts.difficulty || defDiff;
    var nid = 1, gen = 0;
    var S = {
      pans: [], cur: null, next: null, cursor: 3, phase: 'aim', falls: [], torque: 0, angle: 0,
      lives: opts.lives || MAX_LIVES, score: 0, level: opts.level || 1, clears: 0, lvlClears: 0, combo: 0, maxCombo: 0, drops: 0,
      fuse: 0, fuseMax: 0, tut: opts.tutorial ? 0 : -1, hint: -1, tutLast: -1, time: 0, over: false, won: false, ver: 0,
      debrisDue: false, dropCleared: false, playerFall: false, tips: 0
    };
    for (var i = 0; i < PANS; i++) S.pans.push([]);
    function emit(t, d) { try { onEvent(t, d || {}); } catch (e) { if (global.console) console.error(e); } }
    function params() { return levelParams(S.level, diff); }
    function lim() { return params().limit; }
    function mk(v, rust) { return { v: v, rust: !!rust, id: nid++ }; }
    function roll() {
      if (opts.tutorial && gen < TUT_W.length) return mk(TUT_W[gen++]);
      gen++; var P = params(); return mk(1 + Math.floor(rng() * P.maxW));
    }
    function pending(i) { var n = 0; for (var k = 0; k < S.falls.length; k++) if (S.falls[k].pan === i) n++; return n; }
    function free(i) { return S.pans[i].length + pending(i) < CAP; }
    function anyFree() { for (var i = 0; i < PANS; i++) if (free(i)) return true; return false; }
    function total() { var n = 0; for (var i = 0; i < PANS; i++) n += S.pans[i].length; return n; }

    function setHint() {
      if (S.tut < 0) { S.hint = -1; return; }
      var h = [2, -2, 0, -2][S.tut];
      if (h === -2) { var m = S.tutLast >= 0 ? mirror(S.tutLast) : 5; h = free(m) ? m : 5; }
      S.hint = h; S.cursor = h;   // клавиатура/геймпад: каретка сразу над подсказанной чашей
    }
    function armFuse() { var P = params(); S.fuseMax = P.fuse; S.fuse = P.fuse; }

    function start() {
      S.cur = roll(); S.next = roll(); S.phase = 'aim'; armFuse(); setHint(); S.ver++;
      emit('start', { level: S.level, tutorial: S.tut >= 0 });
      return api;
    }

    function drop(i) {
      if (S.over || S.phase !== 'aim' || !S.cur) return false;
      i = Math.max(0, Math.min(PANS - 1, i | 0));
      if (!free(i)) { emit('full', { pan: i }); return false; }
      var P = params();
      S.falls.push({ pan: i, w: S.cur, t: 0, dur: FALL, from: GEO.CUR_Y, player: true });
      emit('drop', { pan: i, v: S.cur.v });
      S.cur = null; S.phase = 'fall'; S.drops++; S.dropCleared = false; S.playerFall = true; S.cursor = i;
      if (S.tut >= 0) S.tutLast = i;
      S.debrisDue = !!(P.debrisEvery && S.drops % P.debrisEvery === 0);
      return true;
    }
    function nearestFree(i) {
      for (var r = 0; r < PANS; r++) { if (i - r >= 0 && free(i - r)) return i - r; if (i + r < PANS && free(i + r)) return i + r; }
      return -1;
    }

    function land(f) {
      S.pans[f.pan].push(f.w);
      emit('land', { pan: f.pan, v: f.w.v, rust: f.w.rust, n: S.pans[f.pan].length });
      resolve();
    }
    function resolve() {
      var cleared = 0;
      for (var k = 0; k < 4; k++) {
        var a = k, b = mirror(k), A = S.pans[a], B = S.pans[b];
        if (!A.length || !B.length) continue;
        var s = sumPan(A); if (s !== sumPan(B)) continue;
        var n = A.length + B.length, mult = 1 + S.combo, pts = s * DIST[a] * n * 5 * mult;
        S.score += pts; S.clears++; S.lvlClears++; cleared++;
        emit('clear', { a: a, b: b, d: DIST[a], sum: s, n: n, pts: pts, mult: mult, ws: A.concat(B) });
        S.pans[a] = []; S.pans[b] = [];
      }
      if (cleared) S.dropCleared = true;
      if (Math.abs(torque(S.pans)) > lim()) tip(false);
      S.torque = torque(S.pans); S.ver++;
    }
    function tip(jam) {
      var T = torque(S.pans), side = T > 0 ? 1 : T < 0 ? -1 : -1, dumped = [];
      S.lives--; S.tips++; S.combo = 0;
      if (jam) {   // все чаши полны: опрокидывается самая полная крайняя чаша тяжёлой (или левой) стороны
        for (var d = 4; d >= 1; d--) { var j = panAt(side, d); if (S.pans[j].length) { dumped.push({ pan: j, ws: S.pans[j] }); S.pans[j] = []; break; } }
      }
      for (var g = 0; g < 8 && Math.abs(torque(S.pans)) > lim(); g++) {
        side = torque(S.pans) > 0 ? 1 : -1; var found = false;
        for (var dd = 4; dd >= 1; dd--) { var p = panAt(side, dd); if (S.pans[p].length) { dumped.push({ pan: p, ws: S.pans[p] }); S.pans[p] = []; found = true; break; } }
        if (!found) break;
      }
      S.torque = torque(S.pans); S.ver++;
      emit('tip', { side: side, dumped: dumped, lives: S.lives, jam: !!jam });
      if (S.lives <= 0) { S.over = true; S.phase = 'over'; S.falls = []; S.cur = null; emit('gameover', { score: S.score }); }
    }
    function spawnDebris() {
      var P = params(), v = 1 + Math.floor(rng() * P.debrisMax), T = torque(S.pans), ok = [], ok2 = [];
      for (var i = 0; i < PANS; i++) {
        if (!free(i)) continue;
        var T1 = T + SIDE[i] * DIST[i] * v;
        if (Math.abs(T1) <= lim()) ok.push(i); else if (Math.abs(T1) < Math.abs(T)) ok2.push(i);
      }
      var list = ok.length ? ok : ok2; if (!list.length) return false;
      var pan = list[Math.floor(rng() * list.length)];
      S.falls.push({ pan: pan, w: mk(v, true), t: 0, dur: DEBRIS_FALL, from: -30, player: false });
      emit('debris', { pan: pan, v: v });
      return true;
    }
    function endDrop() {
      if (S.over) return;
      if (S.debrisDue) { S.debrisDue = false; if (spawnDebris()) return; }
      if (S.playerFall) {
        S.playerFall = false;
        if (S.dropCleared) { S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo); } else S.combo = 0;
        if (!S.dropCleared && S.torque === 0 && total() > 0) { var pe = 10 * S.level; S.score += pe; emit('even', { pts: pe }); }
        if (S.lvlClears >= PER_LEVEL) {
          S.level++; S.lvlClears = 0; if (S.level % 3 === 1 && S.lives < MAX_LIVES) S.lives++;   // жизнь — за уровни 4, 7, 10…
          emit('level', { level: S.level, lives: S.lives });
        }
        if (S.tut >= 0) { S.tut++; if (S.tut >= TUT_W.length) { S.tut = -1; emit('tutDone', {}); } }
      }
      S.cur = S.next; S.next = roll();
      if (!anyFree()) { tip(true); if (S.over) return; }
      S.phase = 'aim'; armFuse(); setHint(); S.ver++;
    }

    function update(dt) {
      S.time += dt;
      var target = Math.max(-1.35, Math.min(1.35, S.torque / LIMIT)) * GEO.MAXANG;   // угол — от базового допуска (одинаковый наклон за тот же момент)
      S.angle += (target - S.angle) * Math.min(1, dt * 7);
      if (S.over) return;
      if (S.phase === 'aim') {
        if (S.fuseMax > 0) { S.fuse -= dt; if (S.fuse <= 0) { var p = free(S.cursor) ? S.cursor : nearestFree(S.cursor); if (p >= 0) { emit('fuse', { pan: p }); drop(p); } } }
      } else if (S.phase === 'fall') {
        for (var k = 0; k < S.falls.length; k++) S.falls[k].t += dt;
        var landed = S.falls.filter(function (f) { return f.t >= f.dur; });
        if (landed.length) { S.falls = S.falls.filter(function (f) { return f.t < f.dur; }); for (var m = 0; m < landed.length && !S.over; m++) land(landed[m]); }
        if (!S.falls.length && !S.over) endDrop();
      }
    }

    // реклама за награду: «ещё один шанс» — 1 жизнь, крайние чаши (плечо 3–4) пустеют; бонус в паузе — +1 жизнь
    function reviveAd() {
      if (!S.over || S.won) return false;
      [0, 1, 6, 7].forEach(function (i) { S.pans[i] = []; });
      S.over = false; S.lives = 1; S.falls = []; S.combo = 0; S.torque = torque(S.pans);
      if (!S.cur) { S.cur = S.next || roll(); S.next = roll(); }
      S.phase = 'aim'; armFuse(); setHint(); S.ver++; emit('revive', {});
      return true;
    }
    function canBoost() { return !S.over && S.lives < MAX_LIVES; }
    function boost() { if (!canBoost()) return false; S.lives++; S.ver++; emit('boost', { lives: S.lives }); return true; }

    var api = {
      start: start, update: update, drop: drop, state: function () { return S; },
      setCursor: function (i) { S.cursor = Math.max(0, Math.min(PANS - 1, i | 0)); },
      moveCursor: function (d) { S.cursor = Math.max(0, Math.min(PANS - 1, S.cursor + d)); },
      canDrop: function (i) { return S.phase === 'aim' && !S.over && free(i); },
      params: params, reviveAd: reviveAd, canBoost: canBoost, boost: boost,
      _S: S, _tip: tip, _resolve: resolve, _mk: mk
    };
    return api;
  }

  K.Game = Game;
  K.logic = { PANS: PANS, DIST: DIST, SIDE: SIDE, CAP: CAP, LIMIT: LIMIT, MAX_LIVES: MAX_LIVES, PER_LEVEL: PER_LEVEL, GEO: GEO, TUT_W: TUT_W,
    mirror: mirror, sumPan: sumPan, torque: torque, levelParams: levelParams, evalMoves: evalMoves, bestMove: bestMove, panAt: panAt, mulberry32: mulberry32 };
})(typeof window !== 'undefined' ? window : globalThis);
