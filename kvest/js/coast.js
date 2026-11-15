/* МАЯЧНИЦА · coast.js — общие механики движка глав (без DOM, чистая логика; их же использует поиск в тестах):
   1) СЦЕНА С ДВУМЯ СОСТОЯНИЯМИ (прилив/отлив, шлюз открыт/закрыт, позже — явь/сон):
      scene.phase = { flag, a, b } — текущее состояние = flags[flag] ? b : a. У элементов слоёв, объектов и зон может быть
      поле phase: 'имя' — элемент есть только в этом состоянии. scene.walkPhase = { a: полоса, b: полоса } — своя полоса ходьбы.
      Переключение — любым действием над флагом (рычаг, событие, кат-сцена) или таймером главы:
      puzzles.timers = [{ flag, every: секунды, where: [сцены] }] — флаг меняется сам, пока героиня в одной из сцен where.
   2) КАРТА ПОБЕРЕЖЬЯ — экран-переход между местами главы по тропе. chapter.map = { id, icon, mood, pal, start, coast,
      nodes: [{ id, scene, x, y, icon, toX, need, lit }], trails: [{ a, b, pts: [[x, y]…], need }] }.
      Узел открыт по need; тропа открыта, если открыты оба её узла и выполнен её need. Кликабельны узлы, связанные открытыми
      тропами с узлом start. Карта — обычная сцена движка (id = map.id): в неё ведут выходы to: map.id из сцен, а зоны узлов
      ведут в сцены (переход — когда фишка героини дошла по тропе). Тема рисует kind: mapsheet, trail, mapnode, maptoken. */
(function (global) {
  'use strict';
  var K = global.KVEST = global.KVEST || {};
  function has(st, c) { var neg = c.charAt(0) === '!'; if (neg) c = c.slice(1); var v = c.slice(0, 4) === 'inv:' ? st.inv.indexOf(c.slice(4)) >= 0 : !!st.flags[c]; return neg ? !v : v; }
  function ok(st, list) { if (!list) return true; for (var i = 0; i < list.length; i++) if (!has(st, list[i])) return false; return true; }

  // ---------- две фазы сцены ----------
  function phaseOf(sc, st) { var p = sc && sc.phase; if (!p) return null; return st.flags[p.flag] ? p.b : p.a; }
  function inPhase(o, ph) { return !o.phase || o.phase === ph; }
  var LCACHE = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  // слои сцены в текущей фазе: массив устойчив (один и тот же объект на сцену и фазу) — тема кэширует статику по ссылке
  function layersOf(sc, ph) {
    if (!sc.phase) return sc.layers;
    var hold = LCACHE ? LCACHE.get(sc) : null; if (!hold) { hold = {}; if (LCACHE) LCACHE.set(sc, hold); }
    if (hold[ph]) return hold[ph];
    var out = (sc.layers || []).map(function (L) { return { depth: L.depth, items: (L.items || []).filter(function (it) { return inPhase(it, ph); }) }; });
    hold[ph] = out; return out;
  }

  // ---------- карта ----------
  function mapScene(map) {
    return { id: map.id, w: 960, h: 540, mood: map.mood || 'day', pal: map.pal || 'map', icon: map.icon || 'map', map: map,
      layers: [{ depth: 0, items: [{ kind: 'mapsheet', x: 0, y: 0, w: 960, h: 540, seed: map.seed || 1, state: { coast: map.coast || null } }] }],
      objects: [], hotspots: [], walk: [[40, 500], [920, 500]], hero: { x: 480, y: 500 } };
  }
  function node(map, id) { for (var i = 0; i < map.nodes.length; i++) if (map.nodes[i].id === id) return map.nodes[i]; return null; }
  function nodeOfScene(map, sid) { for (var i = 0; i < map.nodes.length; i++) if (map.nodes[i].scene === sid) return map.nodes[i]; return null; }
  function trailOpen(map, tr, st) { var a = node(map, tr.a), b = node(map, tr.b); return !!(a && b && ok(st, a.need) && ok(st, b.need) && ok(st, tr.need)); }
  // узлы, связанные открытыми тропами с from (по умолчанию — со стартом карты)
  function reach(map, st, from) {
    var s0 = from || map.start, seen = {}, q = [s0]; seen[s0] = { prev: null, tr: null };
    if (!ok(st, (node(map, s0) || {}).need)) return {};
    while (q.length) {
      var n = q.shift();
      map.trails.forEach(function (tr) {
        if (!trailOpen(map, tr, st)) return;
        var o = tr.a === n ? tr.b : tr.b === n ? tr.a : null;
        if (o && !seen[o]) { seen[o] = { prev: n, tr: tr }; q.push(o); }
      });
    }
    return seen;
  }
  // путь фишки по тропам: точки от узла from до узла to
  function path(map, st, from, to) {
    var r = reach(map, st, from); if (!r[to]) return null;
    var chain = [], cur = to; while (cur !== from) { chain.unshift(r[cur]); cur = r[cur].prev; }
    var pts = [[node(map, from).x, node(map, from).y]], at = from;
    chain.forEach(function (e) { var p = e.tr.pts && e.tr.pts.length ? e.tr.pts.slice() : []; if (e.tr.a !== at) p.reverse(); p.forEach(function (q) { pts.push(q); }); var nn = node(map, e.tr.a === at ? e.tr.b : e.tr.a); pts.push([nn.x, nn.y]); at = nn.id; });
    return pts;
  }
  var R = 34;
  function hotspots(map, st) {
    var r = reach(map, st);
    return map.nodes.filter(function (n) { return r[n.id]; }).map(function (n) {
      return { id: 'n_' + n.id, rect: [n.x - R, n.y - R, R * 2, R * 2], cursor: 'go', to: n.scene, toX: n.toX, at: n.x, node: n.id, look: [n.icon] };
    });
  }
  function objects(map, st, at, token) {
    var r = reach(map, st), out = [];
    map.trails.forEach(function (tr, i) {
      var a = node(map, tr.a), b = node(map, tr.b), pts = [[a.x, a.y]].concat(tr.pts || [], [[b.x, b.y]]), bb = box(pts);
      out.push({ id: 'trail' + i, kind: 'trail', x: bb[0], y: bb[1], w: bb[2], h: bb[3], seed: i + 1, state: { pts: pts, open: trailOpen(map, tr, st) && !!r[tr.a] } });
    });
    map.nodes.forEach(function (n, i) {
      var open = !!r[n.id];
      out.push({ id: 'n_' + n.id, kind: 'mapnode', x: n.x - 30, y: n.y - 30, w: 60, h: 60, seed: i + 1,
        state: { icon: open ? n.icon : 'question', open: open, here: n.id === at, lit: !!(n.lit && ok(st, [n.lit])) } });
    });
    if (token) out.push({ id: 'token', kind: 'maptoken', x: token.x - 14, y: token.y - 40, w: 28, h: 40, state: { dir: token.dir || 1 } });
    return out;
  }
  function box(pts) { var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }); return [x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)]; }

  // зоны сцены в состоянии st (общая функция движка, поиска и бота): need, фаза, для карты — открытые узлы
  function sceneHotspots(sc, st) {
    if (sc.map) return hotspots(sc.map, st);
    var ph = phaseOf(sc, st);
    return sc.hotspots.filter(function (h) { return ok(st, h.need) && inPhase(h, ph); });
  }
  function sceneObjects(sc, st) { var ph = phaseOf(sc, st); return sc.objects.filter(function (o) { return inPhase(o, ph); }); }

  K.Coast = { phaseOf: phaseOf, inPhase: inPhase, layersOf: layersOf, mapScene: mapScene, node: node, nodeOfScene: nodeOfScene, trailOpen: trailOpen,
    reach: reach, path: path, hotspots: hotspots, objects: objects, sceneHotspots: sceneHotspots, sceneObjects: sceneObjects, NODE_R: R };
})(typeof window !== 'undefined' ? window : globalThis);
