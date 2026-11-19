/* МАЯЧНИЦА · dream.js — сцены-сны и живая тушь (движок глав, спринт 4). Без DOM, чистая логика: её же используют игра (game.js),
   поиск по состояниям и бот в тестах.
   1) СЦЕНА-СОН — вариант уже существующей сцены «наоборот»: KVEST.Dream.variant(base, spec) → новая сцена (данные основы не меняются
      и никуда не копируются: вариант строится на лету из сцены, которая уже есть в сборке). spec:
        id, mood, pal, icon          — своё имя и настроение (ночь вместо дня — mood: 'night' и палитра сна);
        mirror: true                 — зеркало: всё, что было слева, — справа (объекты, зоны, полоса ходьбы, точка входа);
        keep: [id…] | drop: [id…]    — какие объекты и зоны основы остаются (keep — только они) или убираются;
        exits: { зона: { to, toX, toNeed, need } } — куда теперь ведут выходы; выходы основы, которых здесь нет, убираются
                                       (они ведут в сцены главы-основы);
        invert: { объект: true | ['open', …] } — «то, что открывало, — закрывает»: условия bind объекта переворачиваются
                                       ('flag' ↔ '!flag'), булевы поля state — тоже;
        objects, hotspots, layers    — добавить своё (объект/зона с тем же id заменяет прежние; координаты — уже в координатах варианта);
        wake: 'флаг', only: { dream: [id…], wake: [id…] }, onlyHs: { … }, palWake — ДВА СОСТОЯНИЯ сна (тот же механизм, что у прилива: scene.phase):
                                       пока флаг снят — 'dream' (сон), поднят — 'wake' (явь / спокойное воспоминание); only — что есть
                                       только в одном из состояний (onlyHs — только зоны: предмет виден всегда, а дотянуться до него
                                       можно в одном состоянии); palWake — палитра яви (сцена «просыпается» в свои настоящие цвета);
        up: true                     — во сне всё течёт вверх (вода, капли, пыль: тема рисует по scene.dream.up);
        walk, walkIf, walkPhase, hero, heroes — свои, если нужны.
      Сцена получает scene.dream = { of: id основы, mirror, up }. Модель кадра: scene.dream = { of, mirror, up, wake, mix 0..1 }
      (mix — плавный переход сон → явь); тема рисует «вуаль сна» хуком drawDream (необязателен).
   2) ЖИВАЯ ТУШЬ — эскиз тушью становится предметом мира (нарисованная дверь открывается, нарисованный мост держит).
      puzzles.inks = [{ id, scene, hs, item, obj, need, hero, keep, do, puzzle }]: предмет-эскиз item (мысль мастера, записанная тушью)
      применяют к зоне hs («пустое место», kind inkspot) — перо рисует объект obj (kind inkdraw) и он оживает: флаг 'ink:<id>'.
      Дальше всё обычными средствами движка: зоны с need: ['ink:<id>'] (дверь — выход), walkIf с need: ['ink:<id>'] (мост держит).
      prepare(P) один раз превращает inks в обычные правила (их видят поиск и бот); действие ['ink', id] — анимация пера.
      Модель: у объекта obj — state.drawn 0..1 (перо ведёт линию INK_T секунд) и state.live (ожил). */
(function (global) {
  'use strict';
  var K = global.KVEST = global.KVEST || {};
  var W = 960, INK_T = 1.5;
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function flipCond(c) { return c.charAt(0) === '!' ? c.slice(1) : '!' + c; }
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return i; return -1; }

  // ---------- зеркало ----------
  function mirrorWalk(w) { return w.map(function (p) { return [W - p[0], p[1]]; }).reverse(); }
  function mirrorItem(it) { if (it && it.x != null) it.x = W - it.x - (it.w || 0); return it; }
  function mirror(s) {
    (s.layers || []).forEach(function (L) { (L.items || []).forEach(mirrorItem); });
    (s.objects || []).forEach(mirrorItem);
    (s.hotspots || []).forEach(function (h) { h.rect[0] = W - h.rect[0] - h.rect[2]; if (h.at != null) h.at = W - h.at; });
    if (s.walk) s.walk = mirrorWalk(s.walk);
    (s.walkIf || []).forEach(function (q) { q.walk = mirrorWalk(q.walk); });
    if (s.walkPhase) for (var k in s.walkPhase) s.walkPhase[k] = mirrorWalk(s.walkPhase[k]);
    if (s.hero) s.hero.x = W - s.hero.x;
    if (s.water) { (s.water.pockets || []).forEach(function (p) { p.x = W - p.x; }); (s.water.sounds || []).forEach(function (p) { p.x = W - p.x; }); }
    return s;
  }
  // «наоборот»: условия bind и булевы поля state
  function invertObj(o, fields) {
    var all = fields === true, k;
    if (o.bind) for (k in o.bind) if ((all || fields.indexOf(k) >= 0) && typeof o.bind[k] === 'string') o.bind[k] = flipCond(o.bind[k]);
    if (o.state) for (k in o.state) if ((all || fields.indexOf(k) >= 0) && typeof o.state[k] === 'boolean') o.state[k] = !o.state[k];
    return o;
  }
  function merge(list, add) { (add || []).forEach(function (o) { var i = byId(list, o.id); if (i >= 0) list[i] = o; else list.push(o); }); }

  function variant(base, spec) {
    spec = spec || {};
    var s = clone(base), drop = {}, keep = null, ex = spec.exits || {}, k;
    (spec.drop || []).forEach(function (id) { drop[id] = 1; });
    if (spec.keep) { keep = {}; spec.keep.forEach(function (id) { keep[id] = 1; }); }
    s.objects = s.objects.filter(function (o) { return !drop[o.id] && (!keep || keep[o.id]); });
    s.hotspots = s.hotspots.filter(function (h) {
      if (drop[h.id]) return false;
      if (h.to) return !!ex[h.id];                     // выход основы остаётся, только если ему дали новое назначение
      return !keep || !!keep[h.id];
    });
    s.hotspots.forEach(function (h) {
      var e = ex[h.id]; if (!e) return;
      h.to = e.to; if (e.toX != null) h.toX = e.toX; else delete h.toX;
      if (e.toNeed) h.toNeed = e.toNeed.slice(); else delete h.toNeed;
      if (e.need) h.need = e.need.slice(); if (e.look) h.look = e.look.slice(); if (e.cursor) h.cursor = e.cursor;
    });
    if (spec.dropKinds) s.layers.forEach(function (L) { L.items = L.items.filter(function (it) { return spec.dropKinds.indexOf(it.kind) < 0; }); });
    if (spec.mirror) mirror(s);
    if (spec.invert) for (k in spec.invert) { var i = byId(s.objects, k); if (i >= 0) invertObj(s.objects[i], spec.invert[k]); }
    merge(s.objects, clone(spec.objects || [])); merge(s.hotspots, clone(spec.hotspots || []));
    (spec.layers || []).forEach(function (L) {
      var hit = null; s.layers.forEach(function (q) { if (q.depth === L.depth && !hit) hit = q; });
      if (hit) hit.items = hit.items.concat(clone(L.items)); else s.layers.push(clone(L));
    });
    if (spec.order) s.objects.sort(function (a, b) { var ia = spec.order.indexOf(a.id), ib = spec.order.indexOf(b.id); return (ia < 0 ? 1e3 : ia) - (ib < 0 ? 1e3 : ib); });
    // два состояния сна — тем же механизмом, что прилив и отлив (scene.phase)
    if (spec.wake) {
      s.phase = { flag: spec.wake, a: 'dream', b: 'wake' };
      var only = spec.only || {}, onlyHs = spec.onlyHs || {};
      ['dream', 'wake'].forEach(function (ph) {
        (only[ph] || []).forEach(function (id) {
          s.objects.forEach(function (o) { if (o.id === id) o.phase = ph; });
          s.hotspots.forEach(function (h) { if (h.id === id) h.phase = ph; });
        });
        (onlyHs[ph] || []).forEach(function (id) { s.hotspots.forEach(function (h) { if (h.id === id) h.phase = ph; }); });   // предмет виден всегда, а дотянуться можно только в одном состоянии
      });
      if (spec.palWake) s.palPhase = { wake: spec.palWake };
    }
    s.id = spec.id || ('dream_' + base.id);
    if (spec.mood) s.mood = spec.mood; if (spec.pal) s.pal = spec.pal; else delete s.pal; if (spec.icon) s.icon = spec.icon;
    if (!spec.dark) delete s.darkUnless;
    ['walk', 'walkIf', 'walkPhase', 'hero', 'heroes'].forEach(function (f) { if (spec[f]) s[f] = clone(spec[f]); });
    s.dream = { of: base.id, mirror: !!spec.mirror, up: !!spec.up };
    return s;
  }
  // сон в модели кадра (тема рисует «вуаль» хуком drawDream): wake — явь, mix — плавный переход 0 (сон) … 1 (явь)
  function view(sc, phase, mix) {
    if (!sc || !sc.dream) return null;
    var wake = !!(sc.phase && phase === sc.phase.b);
    return { of: sc.dream.of, mirror: !!sc.dream.mirror, up: !!sc.dream.up && !wake, wake: wake, mix: sc.phase ? (mix == null ? (wake ? 1 : 0) : mix) : 0 };
  }

  // ---------- живая тушь ----------
  function inks(P) { return (P && P.inks) || []; }
  function ink(P, id) { var a = inks(P); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
  function inkOfObj(P, scene, obj) { var a = inks(P); for (var i = 0; i < a.length; i++) if (a[i].scene === scene && a[i].obj === obj) return a[i]; return null; }
  function flag(id) { return 'ink:' + id; }
  // puzzles.inks → обычные правила (в начало списка: правило туши важнее общих «не то»); один раз на главу
  function prepare(P) {
    if (!P || P._inksReady || !inks(P).length) return P;
    var gen = inks(P).map(function (q) {
      var r = { scene: q.scene, hs: q.hs, need: ['!' + flag(q.id)].concat(q.need || []),
        do: (q.item && !q.keep ? [['take', q.item]] : []).concat([['pose', 'reach', 1.2], ['ink', q.id], ['set', flag(q.id)]], q.do || []), ink: q.id };
      if (q.item) r.item = q.item; if (q.hero) r.hero = q.hero; if (q.puzzle) r.puzzle = q.puzzle;
      return r;
    });
    P.rules = gen.concat(P.rules);
    try { Object.defineProperty(P, '_inksReady', { value: true, enumerable: false }); } catch (e) { P._inksReady = true; }
    return P;
  }
  // состояние нарисованного объекта: t0 — когда перо начало (нет записи — нарисован давно), now — время игры
  function inkState(on, t0, now) {
    var d = !on ? 0 : t0 == null ? 1 : Math.max(0, Math.min(1, (now - t0) / INK_T));
    return { drawn: d, live: on && d >= 1 };
  }

  K.Dream = { INK_T: INK_T, variant: variant, mirror: function (s) { return mirror(clone(s)); }, invertObj: invertObj, flipCond: flipCond, view: view,
    inks: inks, ink: ink, inkOfObj: inkOfObj, flag: flag, prepare: prepare, inkState: inkState };
})(typeof window !== 'undefined' ? window : globalThis);
