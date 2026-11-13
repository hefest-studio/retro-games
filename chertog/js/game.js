/* ЧЕРТОГ · логика без DOM: уровни-сетки из экранов 10×3, «весомая» физика героя как цепочка состояний-анимаций,
   ловушки (шипы, рубящие ножницы, обваливающиеся плиты, нажимные плиты и решётки по таймеру), фехтование один на один
   со стражами разных стилей, зеркальный двойник-автоматон в финале, граф проходимости по настоящей физике.
   Координаты — в клетках: x — колонка (центр героя), y — ряд (подошвы; пол клетки ряда r — на высоте y = r + 1). */
(function (global) {
  'use strict';
  var C = global.CHERTOG = global.CHERTOG || {};
  var RW = 10, RH = 3, STEP = 1 / 60;
  var K = {
    G: 8, VMAX: 7, RUN: 3.6, ACC_T: 0.32, DEC_T: 0.26, TURN_T: 0.2, BUMP_T: 0.3,
    STEP_B: 0.26, STEP_K: 0.3,                         // осторожный шаг: 0,26 с + 0,3 с на клетку
    SJ_PREP: 0.2, SJ_VX: 3.0, SJ_VY: 1.9,              // прыжок с места
    RJ_PREP: 0.06, RJ_VX: 4.3, RJ_VY: 2.1,             // прыжок с разбега
    JU_PREP: 0.16, JU_GRAB: 0.32, HOP_VY: 2.2,         // прыжок вверх: зацеп / подскок
    CLIMB_T: 0.8, CDOWN_T: 0.6, LAND_T: 0.16, HARD_T: 0.7, DRINK_T: 0.9, ENTER_T: 1.1,
    HW: 0.2, HH: 0.62, HANG: 0.8, EDGE: 0.08, BODY: 0.25, HANG_OFF: 0.25, LEDGE_IN: 0.3,
    SAFE_DROP: 1.5, HURT_DROP: 2.5,
    SHAKE: 0.45, GATE_T: 8, GATE_UP: 0.6, GATE_DOWN: 1.2, GATE_SLAM: 0.15, GATE_PASS: 0.75,
    CHOP_P: 1.6, CHOP_C: 0.22, CHOP_W: 0.3, SPIKE_R: 1.6, SPIKE_HOLD: 1.0,
    REACH: 1.25, MIND: 0.75, ENGAGE: 2.6, DISENGAGE: 3.2,
    LUNGE_W: 0.2, LUNGE_R: 0.32, PARRY_T: 0.42, PARRY_A: 0.36, ADV: 0.35, ADV_T: 0.3, HIT_T: 0.38, RECOIL_T: 0.5, PUSH: 0.25,
    TIME: 3600, HP0: 3, HPMAX: 8, DEAD_T: 2.2, CLEAR_T: 1.0
  };
  // стили стражей: hp, замах, реакция, вероятности защиты/атаки, пауза «на подумать», ответный выпад после защиты
  var STYLE = {
    g: { hp: 3, wind: 0.34, react: 0.24, parry: 0.3, atk: 0.45, think: [0.6, 1.0], riposte: 0, pts: 150 },   // стражник
    f: { hp: 3, wind: 0.26, react: 0.18, parry: 0.45, atk: 0.7, think: [0.35, 0.6], riposte: 0.3, pts: 250 }, // дуэлянт
    w: { hp: 4, wind: 0.32, react: 0.16, parry: 0.82, atk: 0.22, think: [0.5, 0.9], riposte: 0.9, pts: 300 }, // щитник
    m: { hp: 4, wind: 0.3, react: 9, parry: 0, atk: 1, think: [1.2, 1.2], riposte: 0, pts: 350, metro: true }, // автоматон
    N: { hp: 6, wind: 0.27, react: 0.17, parry: 0.6, atk: 0.65, think: [0.35, 0.65], riposte: 0.5, pts: 1000, combo: 0.5 } // Наместник
  };
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }

  // ---------- уровень ----------
  // Знаки: ' ' пусто, '#' кладка, '-' пол, '^' шипы, 'x' ножницы, '~' обваливающаяся плита, 'P' старт,
  // 'g' стражник, 'f' дуэлянт, 'w' щитник, 'm' автоматон, 'N' Наместник; 'h' зелье, 'H' большое зелье (+1 к макс.), 'p' яд;
  // '1'..'4' плита, поднимающая решётки 'A'..'D' (группы 1..4) на время; '!' плита, роняющая все решётки;
  // 'e' плита двери выхода, 'E' дверь выхода, 'Z' решётка, которую открывает победа над двойником, 'T' клетка мастера.
  var FLOOR_T = { '-': 1, '^': 1, 'x': 1, '~': 1, 'o': 1, 'G': 1, 'E': 1, 'T': 1 };
  var CACHE = [];
  function build(def, idx) {
    var rows = def.map.map(function (row) { return Array.isArray(row) ? row.join('') : row; });
    var H = rows.length, W = rows[0].length;
    if (H % RH || W % RW) throw new Error('уровень ' + idx + ': размер ' + W + '×' + H + ' не кратен экрану');
    rows.forEach(function (s, i) { if (s.length !== W) throw new Error('уровень ' + idx + ': строка ' + i + ' длиной ' + s.length); });
    var LV = { idx: idx, def: def, W: W, H: H, rx: W / RW, ry: H / RH, t: [], start: null, face: def.face || 1, guards: [], potions: {},
      gates: [], plates: {}, spikes: [], chops: [], loose: [], door: null, exitPlate: null, teacher: null, gateT: def.gateT || K.GATE_T, mirror: null };
    for (var r = 0; r < H; r++) for (var c = 0; c < W; c++) {
      var ch = rows[r][c], b = ch, key = r * W + c;
      if (ch === 'P') { LV.start = { c: c, r: r }; b = '-'; }
      else if (STYLE[ch]) { LV.guards.push({ k: ch, c: c, r: r }); b = '-'; }
      else if (ch === 'h' || ch === 'H' || ch === 'p') { LV.potions[key] = ch; b = '-'; }
      else if (ch >= 'A' && ch <= 'D') { LV.gates.push({ c: c, r: r, grp: ch.charCodeAt(0) - 64 }); b = 'G'; }
      else if (ch === 'Z') { LV.gates.push({ c: c, r: r, grp: 9, boss: true }); b = 'G'; }
      else if (ch >= '1' && ch <= '4') { LV.plates[key] = { kind: 'open', grp: ch.charCodeAt(0) - 48, c: c, r: r }; b = 'o'; }
      else if (ch === '!') { LV.plates[key] = { kind: 'close', c: c, r: r }; b = 'o'; }
      else if (ch === 'e') { LV.plates[key] = { kind: 'exit', c: c, r: r }; LV.exitPlate = { c: c, r: r }; b = 'o'; }
      else if (ch === 'E') { LV.door = { c: c, r: r }; }
      else if (ch === 'T') { LV.teacher = { c: c, r: r }; }
      else if (ch === '^') LV.spikes.push({ c: c, r: r });
      else if (ch === 'x') LV.chops.push({ c: c, r: r, off: ((c * 0.37 + r * 0.61) % 1) * K.CHOP_P });
      else if (ch === '~') LV.loose.push({ c: c, r: r });
      else if (ch !== ' ' && ch !== '#' && ch !== '-') throw new Error('уровень ' + idx + ': неизвестный знак «' + ch + '» в ' + c + ',' + r);
      LV.t[key] = b;
    }
    if (!LV.start) throw new Error('уровень ' + idx + ': нет старта');
    if (!LV.door && !LV.teacher && !def.test) throw new Error('уровень ' + idx + ': нет выхода');
    if (def.mirror) LV.mirror = { cx: def.mirror.room * RW + RW / 2, row: def.mirror.row, room: def.mirror.room };
    return LV;
  }
  function level(idx) { if (!CACHE[idx]) CACHE[idx] = build(C.LEVELS[idx - 1], idx); return CACHE[idx]; }

  // Состояние карты уровня (изменяемое): клетки, решётки, плиты, шипы
  function mapState(LV, o) {
    o = o || {};
    var M = { LV: LV, t: LV.t.slice(), W: LV.W, H: LV.H, gates: LV.gates.map(function (g) { return { c: g.c, r: g.r, grp: g.grp, boss: !!g.boss, open: (o.gatesOpen || g.boss && o.bossOpen) ? 1 : 0 }; }),
      gtimer: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], slam: false, shake: {}, spk: {}, debris: {}, pressed: {}, potions: Object.assign({}, LV.potions) };
    if (o.fallen) LV.loose.forEach(function (q) { var k = q.r * LV.W + q.c; if (o.fallen === 'all' || o.fallen[k]) M.t[k] = ' '; });
    LV.spikes.forEach(function (s) { M.spk[s.r * LV.W + s.c] = { up: 0, hold: 0 }; });
    M.gateAt = {}; M.gates.forEach(function (g) { M.gateAt[g.r * LV.W + g.c] = g; });
    return M;
  }
  function tile(M, c, r) { if (c < 0 || c >= M.W || r < 0) return '#'; if (r >= M.H) return ' '; return M.t[r * M.W + c]; }
  function standable(M, c, r) { var t = tile(M, c, r); if (t === '#') return false; if (FLOOR_T[t]) return true; return tile(M, c, r + 1) === '#' && r + 1 < M.H; }
  function gateClosed(M, c, r) { var g = M.gateAt[r * M.W + c]; return !!g && g.open < K.GATE_PASS; }
  function onRow(y) { return Math.abs(y - Math.round(y)) < 1e-6; }
  // твёрдые прямоугольники рядом с телом: кладка, закрытые решётки, плиты пола (толщина 0,1 под поверхностью)
  function solids(M, x, y) {
    var out = [], c0 = Math.floor(x) - 2, c1 = Math.floor(x) + 2, r0 = Math.floor(y - K.HH) - 1, r1 = Math.floor(y) + 1;
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      var t = tile(M, c, r);
      if (t === '#') out.push([c, r, c + 1, r + 1]);
      else {
        if (FLOOR_T[t]) out.push([c, r + 1, c + 1, r + 1.08]);
        if (t === 'G' && gateClosed(M, c, r)) out.push([c + 0.45, r, c + 0.55, r + 1]);
      }
    }
    return out;
  }
  // сдвиг по горизонтали с упором; → { x, hit }
  function moveX(M, x, y, dx) {
    if (!dx) return { x: x, hit: false };
    var S = solids(M, x + dx / 2, y), top = y - K.HH, nx = x + dx, hit = false;
    for (var i = 0; i < S.length; i++) {
      var b = S[i]; if (!(b[1] < y - 1e-6 && b[3] > top + 1e-6)) continue;
      if (dx > 0 && b[0] >= x + K.HW - 1e-6 && b[0] < nx + K.HW) { nx = b[0] - K.HW - 1e-6; hit = true; }
      if (dx < 0 && b[2] <= x - K.HW + 1e-6 && b[2] > nx - K.HW) { nx = b[2] + K.HW + 1e-6; hit = true; }
    }
    return { x: nx, hit: hit };
  }
  // метки шага в ряду r: центры клеток, края у провала, упоры у кладки/решётки. → отсортированный массив x
  function marks(M, r, c0, c1) {
    var out = [];
    for (var c = c0; c <= c1; c++) {
      if (!standable(M, c, r)) continue;
      var gl = gateClosed(M, c, r);
      out.push(c + 0.5);
      [-1, 1].forEach(function (s) { var n = c + s; if (!standable(M, n, r) && tile(M, n, r) !== '#') out.push(s > 0 ? c + 1 - K.EDGE : c + K.EDGE); });
      if (gl) { out.push(c + 0.45 - K.HW - 1e-6); out.push(c + 0.55 + K.HW + 1e-6); }
    }
    out.sort(function (a, b) { return a - b; }); return out;
  }
  // куда приведёт осторожный шаг: следующая метка впереди (дальше +0,02), не дальше упора/края. null — шагать некуда
  function stepTarget(M, x, y, f) {
    var r = Math.round(y) - 1, c = Math.floor(x), ms = marks(M, r, c - 2, c + 2), tgt = null, i;
    if (f > 0) { for (i = 0; i < ms.length; i++) if (ms[i] > x + 0.02) { tgt = ms[i]; break; } }
    else { for (i = ms.length - 1; i >= 0; i--) if (ms[i] < x - 0.02) { tgt = ms[i]; break; } }
    if (tgt == null) return null;
    // путь до метки: опора под центром на всём пути, без упора
    var lim = moveX(M, x, y, tgt - x).x;
    if (Math.abs(lim - x) < 0.02) return null;
    for (var xx = x; f > 0 ? xx <= lim : xx >= lim; xx += f * 0.05) if (!standable(M, Math.floor(xx), r)) return null;
    return lim;
  }
  function atMark(M, x, y) { var r = Math.round(y) - 1, c = Math.floor(x), ms = marks(M, r, c - 1, c + 1); for (var i = 0; i < ms.length; i++) if (Math.abs(ms[i] - x) <= 0.021) return true; return false; }
  function roomOf(x, y) { return { x: Math.floor(x / RW), y: Math.floor((y - K.HH / 2) / RH) }; }

  // ---------- игра ----------
  // opts: { level=1, rng, onEvent, maxHp, hp, time (остаток, с), score, sim (граф: без стражей, ножниц, часов), fallen, gatesOpen, god }
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || mulberry32(1), emit = opts.onEvent || function () {}, sim = !!opts.sim;
    var S = { phase: 'play', phaseT: 0, level: opts.level || 1, maxHp: opts.maxHp || K.HP0, hp: 0, score: opts.score || 0,
      timeLeft: opts.time != null ? opts.time : K.TIME, time: 0, levelTime: 0, deaths: 0, kills: 0, won: false, over: false,
      hero: null, guards: [], falling: [], twin: null, bossDown: false, doorOpen: false, doorT: 0, room: null, M: null, LV: null, clock: 0, msg: null };
    var I = { x: 0, up: false, down: false, shift: false, atk: false }, P = { up: false, down: false, atk: false };
    var api = {};

    function newHero(LV) { return { x: LV.start.c + 0.5, y: LV.start.r + 1, face: LV.face, st: 'stand', t: 0, v: 0, vx: 0, vy: 0, fy0: 0, hang: null, x0: 0, x1: 0, dur: 0, hitDone: false, stIdle: 0, drop: 0 }; }
    function loadLevel(n, keepHp) {
      S.level = n; var LV = opts.def ? (S._lv || (S._lv = build(opts.def, n))) : level(n); S.LV = LV;
      S.M = mapState(LV, { fallen: opts.fallen, gatesOpen: opts.gatesOpen, bossOpen: sim });
      S.hero = newHero(LV); S.lvlMax = S.maxHp; S.hp = S.maxHp; S.levelTime = 0; S.falling = []; S.phase = 'play'; S.phaseT = 0;
      S.doorOpen = !LV.exitPlate; S.doorT = S.doorOpen ? 1 : 0; S.bossDown = false; S.twin = null; S.msg = null;
      S.guards = sim ? [] : LV.guards.map(function (g, i) {
        var st = STYLE[g.k], r = g.r, lo = g.c, hi = g.c, rx0 = Math.floor(g.c / RW) * RW;
        var safe = function (c) { var t = tile(S.M, c, r); return c >= rx0 && c < rx0 + RW && standable(S.M, c, r) && t !== '^' && t !== 'x' && t !== '~' && t !== 'G'; };
        while (safe(lo - 1)) lo--; while (safe(hi + 1)) hi++;
        return { id: i, k: g.k, x: g.c + 0.5, y: r + 1, face: -1, hp: st.hp, maxHp: st.hp, st: 'stand', t: 0, alive: true, min: lo + 0.3, max: hi + 0.7,
          room: roomOf(g.c + 0.5, r + 1), think: 0.5, react: -1, willParry: false, seen: -1, parried: false, x0: 0, x1: 0, combo: 0, hitDone: false };
      });
      if (LV.mirror && !sim) S.twin = { x: LV.mirror.cx + 4, y: LV.mirror.row + 1, face: -1, st: 'stand', t: 0, on: false, wake: 0, done: false, near: 0, strike: -1 };
      S.room = roomOf(S.hero.x, S.hero.y);
      emit('level', { level: n });
    }
    function M() { return S.M; }

    // ---------- герой ----------
    function setSt(H, st) { H.st = st; H.t = 0; H.stIdle = 0; }
    function grounded(H) { return onRow(H.y) && standable(S.M, Math.floor(H.x), Math.round(H.y) - 1); }
    var RUNNY = { run: 1, stop: 1, land: 1, hardland: 1, bump: 1, rjump: 1 };
    function die(why) {
      var H = S.hero; if (H.st === 'dead') return;
      setSt(H, 'dead'); H.why = why; S.hp = 0; S.phase = 'dead'; S.phaseT = 0; S.deaths++;
      emit('die', { why: why, x: H.x, y: H.y });
    }
    function hurt(n, why) {
      if (opts.god && why === 'sword') return;
      S.hp -= n; emit('hurt', { why: why, x: S.hero.x, y: S.hero.y, hp: S.hp });
      if (S.hp <= 0) die(why);
    }
    // ступень к уступу над головой (прыжок вверх): → { ex, k, side } | null
    function ledgeAbove(H) {
      var r = Math.round(H.y) - 1, hc = Math.floor(H.x), sides = [H.face, -H.face];
      if (tile(S.M, hc, r - 1) === '#' || standable(S.M, hc, r - 1)) return null;
      for (var i = 0; i < 2; i++) {
        var s = sides[i], cl = hc + s, ex = s > 0 ? hc + 1 : hc;
        if (standable(S.M, cl, r - 1) && Math.abs(H.x - ex) <= 0.62 && !gateClosed(S.M, cl, r - 1)) return { ex: ex, k: r, side: -s };
      }
      return null;
    }
    // край для спуска вниз: → { ex, k, side } | null (side — куда свешиваемся)
    function ledgeBelow(H) {
      var r = Math.round(H.y) - 1, c = Math.floor(H.x), sides = [-H.face, H.face];
      for (var i = 0; i < 2; i++) {
        var s = sides[i], n = c + s, ex = s > 0 ? c + 1 : c;
        if (!standable(S.M, n, r) && tile(S.M, n, r) !== '#' && Math.abs(H.x - (s > 0 ? c + 1 - K.EDGE : c + K.EDGE)) <= 0.2) return { ex: ex, k: r + 1, side: s };
      }
      return null;
    }
    function grabCheck(H, yPrev) {
      var h0 = yPrev - K.HANG, h1 = H.y - K.HANG;
      for (var k = Math.floor(h0) + 1; k <= h1 + 1e-9; k++) {
        var hc = Math.floor(H.x);
        for (var s = -1; s <= 1; s += 2) {
          var cl = hc + s, ex = s > 0 ? hc + 1 : hc;
          if (standable(S.M, cl, k - 1) && !standable(S.M, hc, k - 1) && tile(S.M, hc, k - 1) !== '#' && Math.abs(H.x - ex) <= 0.5) {
            H.hang = { ex: ex, k: k, side: -s }; H.x = ex - s * K.HANG_OFF; H.y = k + K.HANG; H.vx = H.vy = 0; H.face = s; setSt(H, 'hang');
            emit('grab', { x: H.x, y: k }); return true;
          }
        }
      }
      return false;
    }
    function startFall(H, vx) { setSt(H, 'air'); H.vx = vx; H.vy = 0; H.fy0 = H.y; }
    function land(H, k) {
      H.y = k; var drop = k - H.fy0, c = Math.floor(H.x), t = tile(S.M, c, k - 1);
      H.vx = H.vy = 0; H.v = 0;
      if (t === '^') { trigSpike(c, k - 1); die('spike'); return; }
      if (drop >= K.HURT_DROP) { die('fall'); return; }
      if (drop >= K.SAFE_DROP) { setSt(H, 'hardland'); emit('thud', { x: H.x, y: H.y, hard: true }); hurt(1, 'fall'); return; }
      setSt(H, 'land'); emit('land', { x: H.x, y: H.y, drop: drop });
    }
    function opponent() {
      var H = S.hero, best = null, bd = 1e9;
      for (var i = 0; i < S.guards.length; i++) {
        var g = S.guards[i]; if (!g.alive || Math.abs(g.y - H.y) > 0.01) continue;
        var rm = roomOf(H.x, H.y); if (rm.x !== g.room.x || rm.y !== g.room.y) continue;
        var d = Math.abs(g.x - H.x); if (d < bd) { bd = d; best = g; }
      }
      return best && bd < (H.st === 'en' || FENCE[H.st] ? K.DISENGAGE : K.ENGAGE) ? best : null;
    }
    var FENCE = { en: 1, lunge: 1, parry: 1, adv: 1, ret: 1, recoil: 1, hit: 1 };
    var CALM = { stand: 1, run: 1, stop: 1, step: 1, turn: 1, land: 1, bump: 1 };

    function heroStep(dt) {
      var H = S.hero, Mm = S.M, dir = I.x, yPrev = H.y, r, c, mv;
      H.t += dt;
      if (H.st === 'dead' || H.st === 'enter' || H.st === 'free') return;
      // фехтование: страж рядом на том же полу
      if (!sim) {
        var O = opponent();
        if (O && CALM[H.st] && grounded(H)) { setSt(H, 'en'); H.v = 0; H.face = O.x > H.x ? 1 : -1; emit('engage', { k: O.k }); }
        if (FENCE[H.st]) {
          if (!O) { if (H.st === 'en' || H.st === 'adv' || H.st === 'ret' || H.t > 0.45) { setSt(H, 'stand'); emit('sheathe', {}); } return; }
          else {
            // буфер: выпад/защита, нажатые во время отдачи или удара, срабатывают, как только герой снова в стойке (0,3 с)
            if (P.atk) { H.buf = 'atk'; H.bufT = 0.3; } else if (P.up) { H.buf = 'parry'; H.bufT = 0.3; }
            if (H.bufT > 0) H.bufT -= dt; else H.buf = null;
            var wasEn = H.st === 'en';
            fenceStep(H, O, { atk: H.buf === 'atk', parry: H.buf === 'parry', adv: dir === (O.x > H.x ? 1 : -1), ret: dir === (O.x > H.x ? -1 : 1) }, dt, HERO_ST, true);
            if (wasEn && H.st !== 'en') H.buf = null;
            return;
          }
        }
      }
      switch (H.st) {
        case 'stand': case 'crouch':
          H.v = 0;
          if (!grounded(H)) { startFall(H, 0); break; }
          H.stIdle += dt;
          if (H.st === 'crouch') { if (!I.down) setSt(H, 'stand'); break; }
          r = Math.round(H.y) - 1; c = Math.floor(H.x);
          if (P.up || I.up && (H.stIdle > 0.25 || dir)) {   // удержание ↑ повторяет прыжок не сразу после подтягивания
            var dk = tile(Mm, c, r);
            if (dk === 'E' && S.doorOpen && S.LV.door && !dir) { setSt(H, 'enter'); emit('enter', {}); break; }
            if (dk === 'T' && !dir && S.LV.teacher && (S.bossDown && (!S.twin || S.twin.done) || sim)) { setSt(H, 'free'); emit('free', {}); break; }
            if (dir && dir !== H.face) { setSt(H, 'turn'); break; }
            if (dir) { setSt(H, 'sjump'); break; }
            setSt(H, 'jumpup'); H.hang = ledgeAbove(H); break;
          }
          if (P.down || I.down) {
            var lb = ledgeBelow(H);
            if (lb) { H.hang = lb; H.x0 = H.x; H.face = -lb.side; setSt(H, 'cdown'); emit('cdown', {}); break; }
            var pk = r * Mm.W + c;
            if (Mm.potions[pk] && !sim) { setSt(H, 'drink'); H.pot = pk; break; }
            setSt(H, 'crouch'); break;
          }
          if (dir) {
            if (dir !== H.face) { setSt(H, 'turn'); break; }
            if (I.shift) { var tg = stepTarget(Mm, H.x, H.y, H.face); if (tg != null) { H.x0 = H.x; H.x1 = tg; H.dur = K.STEP_B + K.STEP_K * Math.abs(tg - H.x); setSt(H, 'step'); } else if (H.st !== 'teeter') { /* край — ни шагу */ } break; }
            setSt(H, 'run'); H.v = 0.6; emit('run', {}); break;
          }
          break;
        case 'turn':
          if (H.t >= K.TURN_T) { H.face = -H.face; setSt(H, 'stand'); }
          break;
        case 'step': {
          var u = H.t / H.dur; H.x = H.x0 + (H.x1 - H.x0) * ease(u);
          if (u >= 1) { H.x = H.x1; setSt(H, 'stand'); if (dir === H.face && I.shift) { var tg2 = stepTarget(Mm, H.x, H.y, H.face); if (tg2 != null) { H.x0 = H.x; H.x1 = tg2; H.dur = K.STEP_B + K.STEP_K * Math.abs(tg2 - H.x); setSt(H, 'step'); } } }
          break;
        }
        case 'run': case 'stop':
          if (H.st === 'run') {
            H.v = Math.min(K.RUN, H.v + K.RUN / K.ACC_T * dt);
            if (P.up || I.up) { if (H.v > K.RUN * 0.6) { setSt(H, 'rjump'); break; } }
            if (dir !== H.face) { setSt(H, 'stop'); }
          } else {
            H.v = Math.max(0, H.v - K.RUN / K.DEC_T * dt);
          }
          mv = moveX(Mm, H.x, H.y, H.face * H.v * dt); H.x = mv.x;
          if (mv.hit) { H.v = 0; setSt(H, 'bump'); emit('bump', { x: H.x, y: H.y }); break; }
          if (!grounded(H)) { startFall(H, H.face * H.v * 0.7); break; }
          if (H.st === 'stop' && H.v <= 0) { setSt(H, 'stand'); }
          break;
        case 'bump': if (H.t >= K.BUMP_T) setSt(H, 'stand'); break;
        case 'sjump':
          if (H.t >= K.SJ_PREP) { setSt(H, 'air'); H.vx = H.face * K.SJ_VX; H.vy = -K.SJ_VY; H.fy0 = H.y; emit('jump', {}); }
          break;
        case 'rjump':
          mv = moveX(Mm, H.x, H.y, H.face * H.v * dt); H.x = mv.x;
          if (!grounded(H) && !mv.hit) { startFall(H, H.face * H.v * 0.7); break; }
          if (H.t >= K.RJ_PREP) { setSt(H, 'air'); H.vx = H.face * K.RJ_VX; H.vy = -K.RJ_VY; H.fy0 = H.y; emit('jump', { run: true }); }
          break;
        case 'jumpup':
          if (H.hang) { if (H.t >= K.JU_PREP + K.JU_GRAB) { var hg = H.hang; H.x = hg.ex + hg.side * K.HANG_OFF; H.y = hg.k + K.HANG; H.face = -hg.side; setSt(H, 'hang'); emit('grab', { x: H.x, y: hg.k }); } }
          else if (H.t >= K.JU_PREP) { setSt(H, 'air'); H.vx = 0; H.vy = -K.HOP_VY; H.fy0 = H.y; emit('jump', {}); }
          break;
        case 'air': {
          H.vy = Math.min(K.VMAX, H.vy + K.G * dt);
          mv = moveX(Mm, H.x, H.y, H.vx * dt); H.x = mv.x; if (mv.hit) { H.vx = 0; emit('bump', { x: H.x, y: H.y }); }
          var ny = H.y + H.vy * dt; c = Math.floor(H.x);
          if (H.vy < 0) { // потолок
            var h0 = H.y - K.HH, h1 = ny - K.HH, ceil = null;
            for (var R = Math.floor(h1) - 1; R <= Math.floor(h0); R++) {
              var tt = tile(Mm, c, R), b = tt === '#' ? R + 1 : FLOOR_T[tt] ? R + 1.08 : null;
              if (b != null && h1 < b && h0 >= b - 1e-6 && (ceil == null || b > ceil)) ceil = b;
            }
            if (ceil != null) { ny = ceil + K.HH; H.vy = 0; }
          }
          H.y = ny;
          if (H.vy > 0) {
            for (var k = Math.floor(yPrev) + 1; k <= H.y + 1e-9; k++) if (standable(Mm, c, k - 1)) { land(H, k); return; }
            if ((I.up || I.shift) && grabCheck(H, yPrev)) return;
          }
          if (H.y > Mm.H + 1.5) die('abyss');
          break;
        }
        case 'hang': {
          var hk = H.hang, lc = hk.side > 0 ? hk.ex - 1 : hk.ex;
          if (!standable(Mm, lc, hk.k - 1)) { startFall(H, 0); break; }      // плита под руками рухнула
          if (tile(Mm, lc, hk.k - 1) === '~') shakeAt(lc, hk.k - 1);
          if (H.t > 0.15 && (P.down || I.down && H.t > 0.3)) { startFall(H, 0); emit('drop', {}); break; }
          if (H.t > 0.12 && I.up) { setSt(H, 'climb'); emit('climb', {}); }
          break;
        }
        case 'climb': {
          var hc2 = H.hang, ux = H.t / K.CLIMB_T;
          if (ux >= 1) { H.x = hc2.ex - hc2.side * K.LEDGE_IN; H.y = hc2.k; setSt(H, 'stand'); H.hang = null; }
          break;
        }
        case 'cdown': {
          var hd = H.hang;
          if (H.t >= K.CDOWN_T) { H.x = hd.ex + hd.side * K.HANG_OFF; H.y = hd.k + K.HANG; setSt(H, 'hang'); }
          break;
        }
        case 'land': if (H.t >= K.LAND_T) setSt(H, 'stand'); break;
        case 'hardland': if (H.t >= K.HARD_T) setSt(H, 'stand'); break;
        case 'drink':
          if (H.t >= K.DRINK_T * 0.55 && H.pot != null && S.M.potions[H.pot]) {
            var kind = S.M.potions[H.pot]; delete S.M.potions[H.pot];
            if (kind === 'h') { S.hp = Math.min(S.maxHp, S.hp + 1); S.score += 50; }
            else if (kind === 'H') { S.maxHp = Math.min(K.HPMAX, S.maxHp + 1); S.hp = S.maxHp; S.score += 200; }
            emit('drink', { kind: kind, x: H.x, y: H.y });
            if (kind === 'p') hurt(1, 'poison');
          }
          if (H.t >= K.DRINK_T && H.st === 'drink') setSt(H, 'stand');
          break;
      }
    }
    var HERO_ST = { wind: K.LUNGE_W, hero: true };
    // общий шаг фехтовальщика (герой и страж): cmd = { atk, parry, adv, ret }
    function fenceStep(F, O, cmd, dt, P2, isHero) {
      F.t += isHero ? 0 : dt;   // у героя t уже увеличен
      F.face = O.x > F.x ? 1 : -1;
      var lo = isHero ? -1e9 : F.min, hi = isHero ? 1e9 : F.max, d;
      switch (F.st) {
        case 'en':
          if (cmd.atk) { F.st = 'lunge'; F.t = 0; F.hitDone = false; emit('lunge', { hero: isHero }); }
          else if (cmd.parry) { F.st = 'parry'; F.t = 0; emit('parry', { hero: isHero }); }
          else if (cmd.adv || cmd.ret) {
            var s = cmd.adv ? F.face : -F.face, tx = F.x + s * K.ADV;
            if (s === F.face) tx = F.face > 0 ? Math.min(tx, O.x - K.MIND) : Math.max(tx, O.x + K.MIND);
            tx = clamp(tx, lo, hi);
            if (isHero) { var lim = moveX(S.M, F.x, F.y, tx - F.x).x; tx = lim; var rr = Math.round(F.y) - 1; if (!standable(S.M, Math.floor(tx), rr)) tx = F.x; }
            if (Math.abs(tx - F.x) > 0.02) { F.x0 = F.x; F.x1 = tx; F.st = cmd.adv ? 'adv' : 'ret'; F.t = 0; }
          }
          break;
        case 'adv': case 'ret':
          F.x = F.x0 + (F.x1 - F.x0) * ease(F.t / K.ADV_T);
          if (F.t >= K.ADV_T) { F.x = F.x1; F.st = 'en'; F.t = 0; }
          break;
        case 'lunge':
          if (!F.hitDone && F.t >= P2.wind) {
            F.hitDone = true; d = Math.abs(O.x - F.x);
            if (d <= K.REACH) {
              if (O.st === 'parry' && O.t <= K.PARRY_A) { F.st = 'recoil'; F.t = 0; O.parried = true; emit('clang', { x: (F.x + O.x) / 2, y: F.y }); }
              else strike(F, O, isHero);
            } else emit('whiff', { hero: isHero });
          }
          if (F.st === 'lunge' && F.t >= P2.wind + K.LUNGE_R) { F.st = 'en'; F.t = 0; }
          break;
        case 'parry': if (F.t >= K.PARRY_T) { F.st = 'en'; F.t = 0; } break;
        case 'recoil': if (F.t >= K.RECOIL_T) { F.st = 'en'; F.t = 0; } break;
        case 'hit': if (F.t >= K.HIT_T) { F.st = 'en'; F.t = 0; } break;
      }
    }
    function strike(F, O, byHero) {
      var push = O.x > F.x ? K.PUSH : -K.PUSH;
      if (byHero) {
        O.hp--; O.st = 'hit'; O.t = 0; O.x = clamp(O.x + push, O.min, O.max);
        emit('hit', { hero: false, x: O.x, y: O.y, hp: O.hp, k: O.k });
        if (O.hp <= 0) {
          O.alive = false; O.st = 'dead'; O.t = 0; S.kills++; S.score += STYLE[O.k].pts; emit('kill', { k: O.k, x: O.x, y: O.y, pts: STYLE[O.k].pts });
          if (O.k === 'N') { S.bossDown = true; emit('boss', {}); }
        }
      } else {
        var H = S.hero; H.st = 'hit'; H.t = 0;
        var nx = moveX(S.M, H.x, H.y, push).x; if (standable(S.M, Math.floor(nx), Math.round(H.y) - 1)) H.x = nx;
        hurt(1, 'sword');
      }
    }
    // ---------- стражи ----------
    function guardStep(g, dt) {
      var H = S.hero, st = STYLE[g.k];
      if (!g.alive) { g.t += dt; return; }
      var rm = roomOf(H.x, H.y), here = rm.x === g.room.x && rm.y === g.room.y;
      var engaged = here && FENCE[H.st] && Math.abs(H.y - g.y) < 0.01 && Math.abs(H.x - g.x) < K.DISENGAGE && H.st !== 'dead';
      if (!engaged) {
        g.t += dt; if (g.st !== 'stand') { g.st = 'stand'; g.t = 0; }
        if (here) g.face = H.x > g.x ? 1 : -1;
        return;
      }
      if (g.st === 'stand') { g.st = 'en'; g.t = 0; g.think = 0.4 + rng() * 0.4; }
      var cmd = { atk: false, parry: false, adv: false, ret: false }, d = Math.abs(H.x - g.x);
      // реакция на замах героя
      if (H.st === 'lunge' && H.t < K.LUNGE_W) {
        if (g.seen < 0) { g.seen = 0; g.willParry = rng() < st.parry; }
        g.seen += dt; if (g.willParry && g.seen >= st.react && g.st === 'en') { cmd.parry = true; g.willParry = false; }
      } else g.seen = -1;
      if (g.st === 'en' && !cmd.parry) {
        if (g.parried && rng() < st.riposte) { cmd.atk = true; g.parried = false; }
        else if (g.combo > 0) { g.combo = 0; if (d <= K.REACH) cmd.atk = true; }
        else {
          g.parried = false;
          g.think -= dt;
          if (g.think <= 0) {
            g.think = st.think[0] + rng() * (st.think[1] - st.think[0]);
            if (d > K.REACH - 0.08) cmd.adv = rng() < 0.85;
            else if (st.metro) cmd.atk = true;
            else if (d < 0.9 && rng() < 0.3) cmd.ret = true;
            else if (rng() < st.atk) cmd.atk = true;
          }
        }
      }
      var was = g.st;
      fenceStep(g, H, cmd, dt, { wind: st.wind }, false);
      if (was === 'lunge' && g.st !== 'lunge' && st.combo && rng() < st.combo) g.combo = 1;
    }
    // ---------- зеркальный двойник ----------
    function twinStep(dt) {
      var T = S.twin, H = S.hero, MI = S.LV.mirror; if (!T || T.done) return;
      var rm = roomOf(H.x, H.y);
      if (!T.on) {
        if (S.bossDown && rm.x === MI.room) { T.wake += dt; if (T.wake > 1.4) { T.on = true; emit('twin', {}); } }
        T.t += dt; return;
      }
      if (rm.x !== MI.room) return;
      var onArena = Math.abs(H.y - (MI.row + 1)) < 0.01;
      if (onArena) { T.x = 2 * MI.cx - H.x; T.face = -H.face; T.st = H.st; T.t = H.t; T.y = H.y; }
      else { T.st = 'stand'; return; }
      var c = Math.floor(T.x), r = MI.row, t = tile(S.M, c, r);
      var why = null;
      if (!standable(S.M, c, r)) why = 'fall';
      else if (t === '^' && RUNNY[H.st]) why = 'spike';
      else if (t === 'x' && chopClosed(c, r) && Math.abs(T.x - (c + 0.5)) < K.CHOP_W) why = 'chop';
      if (why) { T.done = true; T.why = why; T.dieT = 0; if (t === '^') trigSpike(c, r); S.score += 1500; emit('twinDown', { why: why, x: T.x, y: T.y }); openBoss(); return; }
      // сам нападает, если герой рядом
      var d = Math.abs(H.x - T.x);
      if (d < 1.4 && FENCE[H.st] !== 1 && H.st !== 'dead') {
        T.near += dt;
        if (T.strike < 0 && T.near > 0.55) { T.strike = 0; emit('lunge', { twin: true }); }
      } else T.near = Math.max(0, T.near - dt);
      if (T.strike >= 0) { T.strike += dt; if (T.strike >= 0.32) { T.strike = -1; T.near = 0; if (Math.abs(H.x - T.x) <= K.REACH + 0.1 && H.st !== 'dead') { emit('clang', { x: (H.x + T.x) / 2, y: H.y, twin: true }); hurt(1, 'twin'); } } }
    }
    function openBoss() { S.M.gates.forEach(function (g) { if (g.boss) g.target = 1; }); S.bossOpen = true; }

    // ---------- ловушки ----------
    function chopClosed(c, r) { var q = null; for (var i = 0; i < S.LV.chops.length; i++) if (S.LV.chops[i].c === c && S.LV.chops[i].r === r) q = S.LV.chops[i]; if (!q) return false; return ((S.clock + q.off) % K.CHOP_P) < K.CHOP_C; }
    function chopPhase(q) { return (S.clock + q.off) % K.CHOP_P; }
    function trigSpike(c, r) { var s = S.M.spk[r * S.M.W + c]; if (s) { if (s.up < 0.5) emit('spikes', { x: c + 0.5, y: r + 1 }); s.hold = K.SPIKE_HOLD; s.up = Math.max(s.up, 0.01); } }
    function shakeAt(c, r) { var k = r * S.M.W + c; if (S.M.t[k] === '~' && S.M.shake[k] == null) { S.M.shake[k] = 0; emit('shake', { x: c + 0.5, y: r + 1 }); } }
    function trapsStep(dt) {
      var H = S.hero, Mm = S.M, W = Mm.W, k, i;
      var hr = Math.round(H.y) - 1, hc = Math.floor(H.x), gr = grounded(H) && H.st !== 'dead';
      // шипы
      S.LV.spikes.forEach(function (s) {
        var sp = Mm.spk[s.r * W + s.c], near = Math.abs(H.y - (s.r + 1)) < 0.5 && Math.abs(H.x - (s.c + 0.5)) < K.SPIKE_R && H.st !== 'dead';
        if (near) { if (sp.up < 0.05) emit('spikes', { x: s.c + 0.5, y: s.r + 1 }); sp.hold = K.SPIKE_HOLD; }
        if (sp.hold > 0) { sp.hold -= dt; sp.up = Math.min(1, sp.up + dt / 0.1); } else sp.up = Math.max(0, sp.up - dt / 0.4);
      });
      if (gr && tile(Mm, hc, hr) === '^' && RUNNY[H.st] && Mm.spk[hr * W + hc].up > 0.3) die('spike');
      // ножницы
      if (!sim) for (i = 0; i < S.LV.chops.length; i++) {
        var q = S.LV.chops[i], ph = chopPhase(q);
        if (ph < dt + 1e-9 && Math.abs(H.x - (q.c + 0.5)) < 3 && Math.abs(H.y - (q.r + 1)) < 1.2) emit('chop', { x: q.c + 0.5, y: q.r + 1 });
        if (ph < K.CHOP_C && H.st !== 'dead' && Math.abs(H.x - (q.c + 0.5)) < K.CHOP_W && H.y > q.r + 0.15 && H.y - K.HH < q.r + 1) die('chop');
      }
      // плиты: нажатие
      Mm.pressed = {};
      if (gr) {
        k = hr * W + hc; var pl = S.LV.plates[k];
        if (pl && Mm.t[k] === 'o') {
          Mm.pressed[k] = 1;
          if (pl.kind === 'open') { if (Mm.gtimer[pl.grp] <= 0) emit('plate', { x: hc + 0.5, y: hr + 1, grp: pl.grp }); Mm.gtimer[pl.grp] = S.LV.gateT; }
          else if (pl.kind === 'close') { if (!Mm.slam) emit('slam', { x: hc + 0.5, y: hr + 1 }); Mm.slam = true; Mm.slamUntil = S.clock + 0.6; for (var gi = 1; gi < 5; gi++) Mm.gtimer[gi] = 0; }
          else if (pl.kind === 'exit' && !S.doorOpen) { S.doorOpen = true; emit('door', { x: hc + 0.5 }); }
        }
        if (tile(Mm, hc, hr) === '~') shakeAt(hc, hr);
      }
      if (!gr || !(S.LV.plates[hr * W + hc] && S.LV.plates[hr * W + hc].kind === 'close')) Mm.slam = false;
      // решётки
      for (i = 0; i < 10; i++) if (Mm.gtimer[i] > 0) Mm.gtimer[i] = Math.max(0, Mm.gtimer[i] - dt);
      Mm.gates.forEach(function (g) {
        var want = g.boss ? (g.target || (opts.gatesOpen || sim ? 1 : 0)) : (opts.gatesOpen ? 1 : Mm.gtimer[g.grp] > 0 ? 1 : 0);
        var was = g.open;
        if (want > g.open) g.open = Math.min(1, g.open + dt / (g.boss ? 1.2 : K.GATE_UP));
        else if (want < g.open) g.open = Math.max(0, g.open - dt / (S.clock < (Mm.slamUntil || 0) ? K.GATE_SLAM : K.GATE_DOWN));
        if (was < K.GATE_PASS && g.open >= K.GATE_PASS) emit('gateUp', { x: g.c + 0.5, y: g.r + 1 });
        if (was >= K.GATE_PASS && g.open < K.GATE_PASS) {
          emit('gateDown', { x: g.c + 0.5, y: g.r + 1 });
          // решётка опускается на героя — выталкивает в ближнюю сторону
          if (Math.abs(H.y - (g.r + 1)) < 0.9 && Math.abs(H.x - (g.c + 0.5)) < 0.05 + K.HW + 0.05) H.x = H.x < g.c + 0.5 ? g.c + 0.45 - K.HW - 0.001 : g.c + 0.55 + K.HW + 0.001;
        }
      });
      // обваливающиеся плиты
      for (k in Mm.shake) {
        Mm.shake[k] += dt;
        if (Mm.shake[k] >= K.SHAKE) {
          var kc = k % W, kr = (k - kc) / W; delete Mm.shake[k]; Mm.t[k] = ' ';
          [-1, 1].forEach(function (s) { var nk = +k + s; if (kc + s >= 0 && kc + s < W && Mm.t[nk] === '~' && Mm.shake[nk] == null) Mm.shake[nk] = K.SHAKE - 0.12; });   // цепной обвал
          S.falling.push({ c: kc, y: kr + 1, vy: 0, hit: false }); emit('crumble', { x: kc + 0.5, y: kr + 1 });
        }
      }
      for (i = S.falling.length - 1; i >= 0; i--) {
        var f = S.falling[i], y0 = f.y; f.vy = Math.min(K.VMAX, f.vy + K.G * dt); f.y += f.vy * dt;
        if (!f.hit && H.st !== 'dead' && Math.floor(H.x) === f.c && y0 <= H.y - K.HH && f.y > H.y - K.HH) { f.hit = true; if (H.st !== 'hang') hurt(1, 'plate'); }
        var landed = false;
        for (var kk = Math.floor(y0) + 1; kk <= f.y; kk++) if (standable(Mm, f.c, kk - 1)) { landed = true; Mm.debris[(kk - 1) * W + f.c] = (Mm.debris[(kk - 1) * W + f.c] || 0) + 1; emit('smash', { x: f.c + 0.5, y: kk }); break; }
        if (landed || f.y > Mm.H + 2) S.falling.splice(i, 1);
      }
    }

    // ---------- шаг ----------
    api.update = function (dt) {
      dt = dt || STEP;
      if (S.phase === 'won' || S.phase === 'over') return api;
      S.clock += dt;
      if (!sim && S.phase !== 'clear') {
        S.timeLeft -= dt; S.time += dt; S.levelTime += dt;
        if (S.timeLeft <= 0) { S.timeLeft = 0; S.phase = 'over'; S.over = true; emit('timeout', {}); emit('gameover', { score: S.score }); return api; }
      }
      var H = S.hero;
      P.up = I.up && !P._up; P.down = I.down && !P._down; P.atk = I.atk && !P._atk;
      P._up = I.up; P._down = I.down; P._atk = I.atk;
      if (S.phase === 'play') {
        heroStep(dt);
        trapsStep(dt);
        for (var i = 0; i < S.guards.length; i++) guardStep(S.guards[i], dt);
        twinStep(dt);
        if (S.doorOpen && S.doorT < 1) S.doorT = Math.min(1, S.doorT + dt / 1.2);
        if (H.st === 'enter' && H.t >= K.ENTER_T) { S.phase = 'clear'; S.phaseT = 0; S.score += 500; emit('clear', { level: S.level }); }
        if (H.st === 'free' && H.t >= K.ENTER_T * 1.6) { S.phase = 'won'; S.won = true; S.score += Math.floor(S.timeLeft); emit('win', { score: S.score, time: S.time, left: S.timeLeft }); }
        var rm = roomOf(H.x, H.y); if (rm.x !== S.room.x || rm.y !== S.room.y) { S.room = rm; emit('room', { room: rm }); }
      } else if (S.phase === 'dead') {
        S.phaseT += dt; H.t += dt; trapsStep(dt);
        if (S.phaseT >= K.DEAD_T) api.restartLevel(true);
      } else if (S.phase === 'clear') {
        S.phaseT += dt;
        if (S.phaseT >= K.CLEAR_T) { if (S.level >= C.LEVELS.length || opts.def) { S.phase = 'won'; S.won = true; emit('win', { score: S.score }); } else loadLevel(S.level + 1, true); }
      }
      return api;
    };
    api.setInput = function (inp) { I.x = inp.x | 0 ? (inp.x > 0 ? 1 : -1) : 0; I.up = !!inp.up; I.down = !!inp.down; I.shift = !!inp.shift; I.atk = !!inp.atk; return api; };
    api.state = function () { return S; };
    api.start = function () { loadLevel(S.level, false); if (opts.hp) S.hp = opts.hp; return api; };
    api.restartLevel = function (afterDeath) { var n = S.level; if (S.lvlMax) S.maxHp = S.lvlMax; loadLevel(n, false); emit('restart', { death: !!afterDeath }); return api; };
    api.chopPhase = function (q) { return chopPhase(q); };
    api.chopClosed = chopClosed;
    // тестовые хуки
    api._place = function (x, y, face) { var H = S.hero; H.x = x; H.y = y; H.face = face || H.face; H.st = 'stand'; H.t = 0; H.v = H.vx = H.vy = 0; H.hang = null; S.room = roomOf(x, y); return api; };
    api._goLevel = function (n) { loadLevel(n, false); return api; };
    api._die = die;
    api.opts = opts;
    return api;
  }

  // ---------- макро-действия (общие для графа и бота) ----------
  // a: { k:'step', f, n } | { k:'run', f, n } | { k:'rj', f, jx, g } | { k:'sj', f, g } | { k:'ju', g } | { k:'cd' }
  // g: 0 — без зацепа, 1 — зацеп и подтянуться, 2 — зацеп и спрыгнуть. Driver(a) → { next(S) → input | 'done' }
  function Driver(a, o) {
    o = o || {};
    var ph = 'turn', cnt = 0, wait = 0, t = 0, x0 = null, snapTries = 0, lastX0 = null, hold = 0, delay = o.delay || 0, jit = o.jit || 0;
    function blank() { return { x: 0, up: false, down: false, shift: false, atk: false }; }
    function grabPhase(H, inp, f) {
      if (H.st === 'air') { if (a.g) inp.up = true; return inp; }
      if (H.st === 'jumpup') { inp.up = a.k === 'ju' && a.g === 1; return inp; }
      if (H.st === 'sjump' || H.st === 'rjump') { if (a.g) inp.up = true; return inp; }
      if (H.st === 'hang') { if (a.g === 2) { if (H.t > 0.2) inp.down = true; } else inp.up = true; return inp; }
      if (H.st === 'climb') return inp;
      ph = 'settle'; return inp;
    }
    return {
      a: a,
      phase: function () { return ph; },
      next: function (S, dt) {
        var H = S.hero, inp = blank(), f = a.f || H.face;
        t += dt;
        if (H.st === 'dead') return 'dead';
        if (t > 12) return 'fail';
        if (delay > 0) { delay -= dt; return inp; }
        if (x0 == null) x0 = H.x;
        if (ph === 'turn') {
          if (H.face === f && H.st !== 'turn') ph = 'go';
          else { if (H.st === 'stand') inp.x = f; return inp; }
        }
        if (ph === 'go') {
          switch (a.k) {
            case 'step':
              if (H.st === 'step' && H.x0 !== lastX0) { cnt++; lastX0 = H.x0; }
              if (H.st === 'step') { if (cnt < a.n) { inp.x = f; inp.shift = true; } wait = 0; return inp; }
              if (cnt >= a.n) { ph = 'settle'; return inp; }
              wait += dt; if (wait > 0.12) { ph = 'settle'; return inp; }
              inp.x = f; inp.shift = true; return inp;
            case 'run':
              if (H.st === 'air' || H.st === 'bump' || f * (H.x - (x0 + f * (a.n - 0.55))) + jit >= 0) { ph = 'settle'; return inp; }
              inp.x = f; return inp;
            case 'rj':
              if (hold === 0) {
                if (H.st === 'air' || H.st === 'rjump' || H.st === 'sjump') hold = 1;
                else if (H.st === 'bump' || (H.st === 'stand' && t > 2.5)) { ph = 'settle'; return inp; }
                else { inp.x = f; if (f * (H.x - a.jx) + jit >= 0) inp.up = true; return inp; }
              }
              return grabPhase(H, inp, f);
            case 'sj':
              if (hold === 0) { if (H.st === 'stand') { inp.x = f; inp.up = true; return inp; } hold = 1; }
              return grabPhase(H, inp, f);
            case 'ju':
              if (hold === 0) { if (H.st === 'stand') { inp.up = true; return inp; } hold = 1; }
              return grabPhase(H, inp, f);
            case 'cd':
              if (hold === 0) { if (H.st === 'stand') { inp.down = true; return inp; } hold = 1; }
              if (H.st === 'cdown') return inp;
              if (H.st === 'hang') { if (H.t > 0.2) inp.down = true; return inp; }
              ph = 'settle'; return inp;
            default: ph = 'settle';
          }
        }
        if (ph === 'settle') {
          var r = Math.round(H.y) - 1, c = Math.floor(H.x);
          if (H.st === 'stand' && onRow(H.y) && tile(S.M, c, r) !== '~') { wait += dt; if (wait > 0.25) { ph = 'snap'; wait = 0; } }
          else wait = 0;
          if (ph !== 'snap') return inp;
        }
        if (ph === 'snap') {
          if (H.st === 'stand') {
            if (atMark(S.M, H.x, H.y)) return 'done';
            if (++snapTries > 4) return 'fail';
            if (stepTarget(S.M, H.x, H.y, H.face) != null) { inp.x = H.face; inp.shift = true; }
            else inp.x = -H.face;
            return inp;
          }
          if (H.st === 'step') return inp;
          if (H.st !== 'turn') snapTries = 9;
          return inp;
        }
        return inp;
      }
    };
  }
  // прогон действия в отдельной игре-симуляции. → { ok, t, x, y, face, key, cross:{gates}, touch:{plates}, chops, hurt, loose }
  function simulate(idx, from, a, cfg) {
    cfg = cfg || {};
    var G = Game({ level: idx, sim: true, fallen: cfg.fallen, gatesOpen: cfg.gatesOpen }).start();
    var S = G.state(), H = S.hero; G._place(from.x, from.y, from.face);
    var d = Driver(a), res = { ok: false, t: 0, cross: {}, touch: {}, chops: {}, chopT: {}, loose: {}, hurt: false, path: [] }, hp0 = S.hp, LV = S.LV;
    var chopAt = {}; LV.chops.forEach(function (q) { chopAt[q.r * LV.W + q.c] = q; });
    for (var i = 0; i < 700; i++) {
      var inp = d.next(S, STEP);
      if (inp === 'dead' || inp === 'fail') return res;
      if (inp === 'done') break;
      G.setInput(inp); G.update(STEP);
      if (H.st === 'dead') return res;
      var r = Math.round(H.y) - 1, c = Math.floor(H.x);
      if (onRow(H.y) && standable(S.M, c, r)) { var k = r * LV.W + c; if (LV.plates[k]) res.touch[k] = 1; if (LV.t[k] === '~') res.loose[k] = 1; }
      S.M.gates.forEach(function (g) { if (!g.boss && Math.abs(H.x - (g.c + 0.5)) < 0.05 + K.HW && H.y > g.r + 0.05 && H.y - K.HH < g.r + 1) res.cross[g.r * LV.W + g.c] = g.grp; });
      LV.chops.forEach(function (q) {
        if (Math.abs(H.x - (q.c + 0.5)) < K.CHOP_W + 0.06 && H.y > q.r + 0.15 && H.y - K.HH < q.r + 1) {
          var kq = q.r * LV.W + q.c, tq = (i + 1) * STEP; res.chops[kq] = 1;
          if (!res.chopT[kq]) res.chopT[kq] = [tq, tq]; else res.chopT[kq][1] = tq;
        }
      });
      if (i % 6 === 0) res.path.push(Math.round(H.x * 100) / 100);
    }
    if (i >= 700) return res;
    if (S.hp < hp0) res.hurt = true;
    var rr = Math.round(H.y) - 1, cc = Math.floor(H.x), kk = rr * LV.W + cc;
    if (chopAt[kk]) return res;              // стоять в ножницах нельзя
    res.ok = true; res.t = i * STEP; res.x = H.x; res.y = H.y; res.face = H.face; res.key = nodeKey(H.x, H.y);
    return res;
  }
  // ключ узла: клетка + метка внутри неё с точностью 0,05 (метки — 0,1 / 0,25 / 0,5 / 0,75 / 0,9 — различимы)
  function nodeKey(x, y) { var c = Math.floor(x); return c + ',' + (Math.round(y) - 1) + ',' + Math.round((x - c) * 20); }
  // список действий из узла (обе стороны)
  function actionsFrom(M, n) {
    var out = [], r = n.r, c = n.c;
    [1, -1].forEach(function (f) {
      for (var s = 1; s <= 3; s++) out.push({ k: 'step', f: f, n: s });
      // разбег: до первого провала/шипов/стены
      var lastRun = 0;
      for (var m = 1; m <= 7; m++) {
        var cc = c + f * m, t = tile(M, cc, r);
        lastRun = m;
        if (t === '#' || !standable(M, cc, r) || t === '^') break;
      }
      for (m = 1; m <= Math.min(lastRun + 1, 7); m++) out.push({ k: 'run', f: f, n: m });
      // точки толчка для прыжка с разбега: у границ «плохих» клеток впереди
      for (m = 0; m <= 6; m++) {
        var a0 = c + f * m, a1 = a0 + f, t0 = tile(M, a0, r), t1 = tile(M, a1, r);
        if (t0 === '#' || !standable(M, a0, r)) break;
        var pl1 = M.LV.plates[r * M.W + a1];
        var bad = !standable(M, a1, r) || t1 === '^' || t1 === 'x' || t1 === '~' || t1 === '#' || (pl1 && pl1.kind === 'close' && t1 === 'o');
        if (bad && t1 !== '#') {
          var bx = f > 0 ? a0 + 1 : a0;
          [0.12, 0.42].forEach(function (off) { var jx = bx - f * off; if (f * (jx - n.x) > 0.6) for (var g = 0; g < 3; g++) out.push({ k: 'rj', f: f, jx: jx, g: g }); });
        }
        if (t0 === '^' && m > 0) break;
        if (bad) break;
      }
      for (var g2 = 0; g2 < 3; g2++) out.push({ k: 'sj', f: f, g: g2 });
      out.push({ k: 'ju', f: f, g: 1 }); out.push({ k: 'ju', f: f, g: 2 }); out.push({ k: 'cd', f: f });
    });
    return out;
  }
  // Граф проходимости уровня. cfg: { fallen }. → { nodes:Map, edges:[], start, reach(), ... }
  function Nav(idx, cfg) {
    cfg = cfg || {};
    var LV = level(idx), M = mapState(LV, { fallen: cfg.fallen, bossOpen: true }), nodes = new Map(), edges = [], out = new Map();
    var sx = LV.start.c + 0.5, sy = LV.start.r + 1, startKey = nodeKey(sx, sy);
    nodes.set(startKey, { key: startKey, x: sx, y: sy, c: LV.start.c, r: LV.start.r });
    var q = [startKey], seen = new Set(q);
    while (q.length) {
      var key = q.shift(), n = nodes.get(key), list = [];
      var acts = actionsFrom(M, n), faces = {};
      for (var i = 0; i < acts.length; i++) {
        var a = acts[i], face = a.f || 1;
        var res = simulate(idx, { x: n.x, y: n.y, face: face }, a, { fallen: cfg.fallen, gatesOpen: true });
        var gs = Object.keys(res.cross).map(function (k) { return res.cross[k]; });
        var variants = [];
        if (res.ok && !gs.length) variants.push({ res: res, need: 0 });
        else {
          if (res.ok) { var g0 = gs[0], one = gs.every(function (g) { return g === g0; }); if (one) variants.push({ res: res, need: g0 }); }
          var rc = simulate(idx, { x: n.x, y: n.y, face: face }, a, { fallen: cfg.fallen, gatesOpen: false });
          if (rc.ok) variants.push({ res: rc, need: 0 });
        }
        variants.forEach(function (v) {
          var R = v.res; if (R.key === key && !v.need) return;
          var e = { from: key, to: R.key, a: a, face: face, t: R.t, need: v.need, hurt: R.hurt, touch: R.touch, chops: Object.keys(R.chops).map(Number), chopT: R.chopT, loose: Object.keys(R.loose).map(Number) };
          edges.push(e); list.push(e);
          if (!nodes.has(R.key)) nodes.set(R.key, { key: R.key, x: R.x, y: R.y, c: Math.floor(R.x), r: Math.round(R.y) - 1 });
          if (!seen.has(R.key)) { seen.add(R.key); q.push(R.key); }
        });
      }
      out.set(key, list);
    }
    var closers = {}, opens = {}; Object.keys(LV.plates).forEach(function (k) { var p = LV.plates[k]; if (p.kind === 'close') closers[k] = 1; if (p.kind === 'open') opens[k] = p.grp; });
    var touchesCloser = function (e) { for (var k in e.touch) if (closers[k]) return true; return false; };
    // макро-рёбра «плита → за решётку»: путь от плиты успевает до закрытия (с запасом 0,3 с на каждое действие)
    var macros = [];
    nodes.forEach(function (n, key) {
      var pk = n.r * LV.W + n.c, grp = opens[pk]; if (!grp) return;
      var dist = new Map([[key, 0]]), prev = new Map(), heap = [[0, key]];
      while (heap.length) {
        var bi = 0; for (var j = 1; j < heap.length; j++) if (heap[j][0] < heap[bi][0]) bi = j;
        var it = heap.splice(bi, 1)[0], d0 = it[0], u = it[1]; if (d0 > dist.get(u)) continue;
        (out.get(u) || []).forEach(function (e) {
          if (e.need && e.need !== grp) return; if (touchesCloser(e)) return;
          var nd = d0 + e.t + 0.3; if (nd > LV.gateT - 0.3) return;
          if (e.need === grp) { macros.push({ from: key, to: e.to, via: u, edge: e, t: nd, grp: grp }); return; }
          if (nd < (dist.has(e.to) ? dist.get(e.to) : 1e9)) { dist.set(e.to, nd); prev.set(e.to, { u: u, e: e }); heap.push([nd, e.to]); }
        });
      }
      macros.filter(function (m) { return m.from === key && !m.path; }).forEach(function (m) {
        var p = [m.edge], v = m.via; while (v !== key) { var pr = prev.get(v); p.unshift(pr.e); v = pr.u; } m.path = p;
      });
    });
    function adj(u) { var l = (out.get(u) || []).filter(function (e) { return !e.need; }).map(function (e) { return { to: e.to, e: e }; }); macros.forEach(function (m) { if (m.from === u) l.push({ to: m.to, m: m }); }); return l; }
    function reach(from) {
      var R = new Set([from || startKey]), st = [from || startKey];
      while (st.length) { var u = st.pop(); adj(u).forEach(function (x) { if (!R.has(x.to)) { R.add(x.to); st.push(x.to); } }); }
      return R;
    }
    var exitC = LV.door || LV.teacher;
    function isExit(key) { var n = nodes.get(key); return n && n.c === exitC.c && n.r === exitC.r; }
    return { LV: LV, nodes: nodes, edges: edges, out: out, macros: macros, start: startKey, adj: adj, reach: reach, isExit: isExit, exitPlate: LV.exitPlate };
  }

  C.logic = { K: K, RW: RW, RH: RH, STEP: STEP, STYLE: STYLE, mulberry32: mulberry32, build: build, level: level, mapState: mapState, tile: tile, standable: standable,
    gateClosed: gateClosed, marks: marks, stepTarget: stepTarget, atMark: atMark, roomOf: roomOf, moveX: moveX, Driver: Driver, simulate: simulate, nodeKey: nodeKey,
    actionsFrom: actionsFrom, Nav: Nav, FLOOR_T: FLOOR_T, ease: ease };
  C.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
