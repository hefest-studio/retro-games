/* МАЯЧНИЦА · water.js — подводные механики движка глав (с главы 4). Без DOM, чистая логика: её же используют игра (game.js),
   поиск по состояниям и бот в тестах.
   1) МЯГКИЙ ТАЙМЕР ВОЗДУХА. Глава объявляет puzzles.air = { max: секунды, speed: px/с под водой, home: { scene, x } }.
      Подводная сцена: scene.water = { pockets, murk, sounds, vis }. Под водой воздух убывает (идёшь или тянешься — 1 с за секунду,
      стоишь и думаешь — вдесятеро медленнее: таймер мягкий, он ограничивает путь, а не раздумья), в кармане (pockets[] = { id, x, w, need } — колокол, воздух под лодкой, родник пузырей) пополняется
      за ~1 с. Кончился — мягкий возврат: героиня «выныривает» к последнему карману (или в home), флаги и инвентарь не меняются.
      Вход в подводную сцену с суши — с полным воздухом.
   2) МУТНАЯ ВОДА: scene.water.murk = true | [условия] — видимость снижена (тема затемняет сцену туманом тушью, кроме круга vis
      вокруг героини). Зоны с полем guide: 'id источника' в мути активны, только пока этот источник звучит (его need выполнено):
      их находят по звону, а не перебором пикселей.
   3) ЗВУК КАК ПОДСКАЗКА: scene.water.sounds = [{ id, x, y, note 0..4, need, every, phase, big }] — колокола-ориентиры. Звенят
      сами раз в every секунд (и все по очереди, слева направо — по умению «прислушаться»). Голос: панорама — лево/право от героини,
      высота тона — нота колокола (строй «песни маяка» НЕ меняется: по высоте колокол узнают, это игровая механика); расстояние —
      громкость и «глухота» (срез фильтра). Визуальный дубль (для игры без звука и для доступности) — кольца-волны тушью от источника
      с точками ноты (как у колокольчиков главы 1): чем ближе источник, тем жирнее кольца.
   4) ДОСТИЖИМОСТЬ С УЧЁТОМ ВОЗДУХА (для поиска): воздух НЕ входит в состояние (перебор не растёт) — это ограничение длины пути
      между карманами. reach() — какие сцены достижимы и с каким запасом воздуха (в пикселях пути) героиня оказывается в точках
      входа подводных сцен; hsOk() — успеет ли она дойти до зоны и дотянуться, не выныривая. Поиск считает с запасом (SAFE = 0.85
      от настоящего воздуха): что достижимо для поиска — достижимо и для игрока, который постоял и подумал. */
(function (global) {
  'use strict';
  var K = global.KVEST = global.KVEST || {};
  var SPEED_W = 120, REACH_T = 0.28, IDLE_K = 0.1, REFILL_T = 1, POCKET_W = 56, VIS = 150, EVERY = 4.5, SAFE = 0.85;
  function has(st, c) { var neg = c.charAt(0) === '!'; if (neg) c = c.slice(1); var v = c.slice(0, 4) === 'inv:' ? st.inv.indexOf(c.slice(4)) >= 0 : !!st.flags[c]; return neg ? !v : v; }
  function ok(st, list) { if (!list) return true; for (var i = 0; i < list.length; i++) if (!has(st, list[i])) return false; return true; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function conf(P) { var a = P && P.air; if (!a) return null; return { max: a.max || 12, speed: a.speed || SPEED_W, home: a.home || null }; }
  function isWater(sc) { return !!(sc && sc.water); }
  function budget(P) { var c = conf(P); return c ? c.max * c.speed * SAFE : Infinity; }   // запас воздуха в пикселях пути (для поиска — с запасом SAFE)
  function reachCost(P) { var c = conf(P); return c ? REACH_T * c.speed : 0; }
  function pockets(sc, st) { return isWater(sc) ? (sc.water.pockets || []).filter(function (p) { return ok(st, p.need); }) : []; }
  function pocketAt(sc, st, x) { var ps = pockets(sc, st); for (var i = 0; i < ps.length; i++) if (Math.abs(x - ps[i].x) <= (ps[i].w || POCKET_W)) return ps[i]; return null; }
  function murky(sc, st) { if (!isWater(sc)) return false; var m = sc.water.murk; if (!m) return false; return m === true ? true : ok(st, m); }
  function sources(sc, st) { return isWater(sc) ? (sc.water.sounds || []).filter(function (s) { return ok(st, s.need); }) : []; }
  function source(sc, id) { var a = (sc && sc.water && sc.water.sounds) || []; for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
  // зоны в мути: зона с guide активна, пока звучит её источник
  function filter(sc, st, list) {
    if (!murky(sc, st)) return list;
    return list.filter(function (h) { if (!h.guide) return true; var s = source(sc, h.guide); return !!s && ok(st, s.need); });
  }
  // голос источника для героини в x: панорама −1..1 (лево/право), громкость и срез фильтра — по расстоянию (дальше — тише и глуше);
  // высота тона не меняется (semis = 0): нота колокола — игровая механика, строй «песни маяка» трогать нельзя
  function voice(src, hx, murk) {
    var d = Math.abs(src.x - hx), f = clamp(d / 760, 0, 1);
    return { pan: clamp((src.x - hx) / 420, -1, 1), dist: d, near: 1 - f, gain: (1 - 0.72 * f) * (murk ? 0.85 : 1), semis: 0, cutoff: Math.round(2800 - 2100 * f) };
  }
  // расход воздуха за dt: moving — идёт/тянется; в кармане — пополнение
  function step(air, max, dt, moving, inPocket) { if (inPocket) return Math.min(max, air + dt * max / REFILL_T); return air - dt * (moving ? 1 : IDLE_K); }

  // ---------- достижимость с учётом воздуха (поиск по состояниям и бот) ----------
  // SC — сцены по id; st — состояние; from — сцена старта; o = { hotspots(s) → зоны, pass(s, h) → можно ли пройти выход (кроме воздуха),
  //   stand(s, h) → x, где героиня встанет у зоны, entryX(s, h) → x входа в сцену h.to }. Точки входа подводной сцены — [x, r]:
  //   r — запас воздуха (пиксели пути). Карман даёт полный запас, если до него можно дойти из какой-то точки входа.
  function reach(SC, P, st, from, o) {
    var B = budget(P), RC = reachCost(P), seen = {}, ent = {}, q = [from], guard = 0;
    seen[from] = { prev: null, hs: null };
    function add(s, x, r) {
      var L = ent[s] || (ent[s] = []);
      for (var i = 0; i < L.length; i++) if (r <= L[i][1] - Math.abs(x - L[i][0]) + 1e-6) return false;   // не лучше имеющейся
      ent[s] = L.filter(function (e) { return !(e[1] <= r - Math.abs(e[0] - x) + 1e-6); }); ent[s].push([x, r]); return true;
    }
    function best(s, x) { var L = ent[s] || [], b = -Infinity; for (var i = 0; i < L.length; i++) b = Math.max(b, L[i][1] - Math.abs(L[i][0] - x)); return b; }
    if (isWater(SC[from])) {   // старт под водой (проверка «по положению»): героиня в кармане сцены (мягкий возврат приводит в карман);
      // o.fromX — конкретные точки старта (строгая проверка: из КАЖДОГО кармана можно вернуться)
      if (o.fromX) o.fromX.forEach(function (x) { add(from, x, B); }); else pockets(SC[from], st).forEach(function (p) { add(from, p.x, B); });
    }
    while (q.length && guard++ < 4000) {
      var s = q.shift(), sc = SC[s], wet = isWater(sc);
      if (wet) for (var more = true, k = 0; more && k < 8; k++) { more = false; pockets(sc, st).forEach(function (p) { var b = best(s, p.x); if (b >= 0 && b < B - 1e-6) more = add(s, p.x, B) || more; }); }
      o.hotspots(s).forEach(function (h) {
        if (!h.to || !SC[h.to] || !o.pass(s, h)) return;
        var left = wet ? best(s, o.stand(s, h)) - RC : B;
        if (left < 0) return;
        var to = h.to, changed = false;
        if (isWater(SC[to])) changed = add(to, o.entryX(s, h), wet ? left : B);
        if (!seen[to]) { seen[to] = { prev: s, hs: h.id }; changed = true; }
        if (changed && q.indexOf(to) < 0) q.push(to);
      });
    }
    return { seen: seen, ent: ent, best: best };
  }
  // успеет ли героиня дойти до зоны h сцены s и дотянуться (R — результат reach)
  function hsOk(SC, P, R, s, x) { if (!isWater(SC[s])) return true; return R.best(s, x) - reachCost(P) >= -1e-6; }

  K.Water = { SAFE: SAFE, SPEED_W: SPEED_W, REACH_T: REACH_T, IDLE_K: IDLE_K, REFILL_T: REFILL_T, POCKET_W: POCKET_W, VIS: VIS, EVERY: EVERY,
    conf: conf, isWater: isWater, budget: budget, reachCost: reachCost, pockets: pockets, pocketAt: pocketAt, murky: murky, sources: sources, source: source,
    filter: filter, voice: voice, step: step, reach: reach, hsOk: hsOk };
})(typeof window !== 'undefined' ? window : globalThis);
