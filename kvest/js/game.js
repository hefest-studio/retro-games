/* МАЯЧНИЦА · game.js — движок point-and-click: интерпретирует данные сцен (scenes.js) и логики (puzzles.js, widgets.js).
   Без DOM: ввод — G.down/move/up/look в логических координатах 960×540, время — G.update(dt), отрисовка — G.model()
   (main.js отдаёт модель в window.KvestTheme). Чистая логика правил — KVEST.logic (её же использует поиск в тестах). */
(function (global) {
  'use strict';
  var K = global.KVEST = global.KVEST || {};
  var SPEED = 230, REACH_T = 0.28, LONG_T = 0.5, HINT_CD = 45, SAVE_V = 1;

  // ---------- чистая логика (общая для игры и поиска) ----------
  function has(st, c) {
    var neg = c.charAt(0) === '!'; if (neg) c = c.slice(1);
    var v = c.slice(0, 4) === 'inv:' ? st.inv.indexOf(c.slice(4)) >= 0 : !!st.flags[c];
    return neg ? !v : v;
  }
  function ok(st, list) { if (!list) return true; for (var i = 0; i < list.length; i++) if (!has(st, list[i])) return false; return true; }
  function resolve(P, st, scene, hs, item) {
    item = item || null;
    for (var i = 0; i < P.rules.length; i++) { var r = P.rules[i]; if (r.scene === scene && r.hs === hs && (r.item || null) === item && ok(st, r.need)) return r; }
    return null;
  }
  function resolveCombo(P, st, a, b) {
    for (var i = 0; i < P.combos.length; i++) { var c = P.combos[i]; if (((c.a === a && c.b === b) || (c.a === b && c.b === a)) && ok(st, c.need)) return c; }
    return null;
  }
  function widget(P, id) { for (var i = 0; i < P.widgets.length; i++) if (P.widgets[i].id === id) return P.widgets[i]; return null; }
  // Применить действия к состоянию. fx — обработчик «визуальных» действий; без fx (поиск) кат-сцена и мини-игра применяются сразу.
  function apply(P, st, acts, fx) {
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i], k = a[0];
      if (k === 'set') st.flags[a[1]] = true;
      else if (k === 'clear') delete st.flags[a[1]];
      else if (k === 'toggle') { if (st.flags[a[1]]) delete st.flags[a[1]]; else st.flags[a[1]] = true; }
      else if (k === 'give') { if (st.inv.indexOf(a[1]) < 0) st.inv.push(a[1]); }
      else if (k === 'take') { var j = st.inv.indexOf(a[1]); if (j >= 0) st.inv.splice(j, 1); }
      else if (k === 'win') { st.flags.won = true; if (fx && fx.win) fx.win(); }
      else if (k === 'cut') { if (fx && fx.cut) fx.cut(a[1]); else apply(P, st, P.cuts[a[1]].filter(stateStep), null); }
      else if (k === 'mini') { if (fx && fx.mini) fx.mini(a[1]); else solveWidget(P, st, widget(P, a[1]), null); }
      else if (fx && fx[k]) fx[k].apply(null, a.slice(1));
    }
  }
  var STATE_ACTS = { set: 1, clear: 1, toggle: 1, give: 1, take: 1, win: 1 };
  function stateStep(s) { return !!STATE_ACTS[s[0]]; }
  function setPuzzle(st, id, fx) { if (!id || st.flags[id]) return; st.flags[id] = true; if (fx && fx.puzzle) fx.puzzle(id); }
  function runRule(P, st, r, fx) { apply(P, st, r.do, fx); setPuzzle(st, r.puzzle, fx); autos(P, st, fx); }
  function solveWidget(P, st, w, fx) {
    if (!w || st.flags['w:' + w.id]) return;
    st.flags['w:' + w.id] = true; apply(P, st, w.onSolve || [], fx); setPuzzle(st, w.puzzle, fx);
  }
  // Авто-правила: каждое — не более раза за вызов; guard(r) может запретить (кат-сцена уже идёт).
  function autos(P, st, fx, guard) {
    for (var i = 0; i < P.autos.length; i++) {
      var r = P.autos[i];
      if (ok(st, r.need) && (!guard || guard(r))) { apply(P, st, r.do, fx); setPuzzle(st, r.puzzle, fx); }
    }
  }
  function walkOf(sc, st) {
    if (sc.walkIf) for (var i = 0; i < sc.walkIf.length; i++) if (ok(st, sc.walkIf[i].need)) return sc.walkIf[i].walk;
    return sc.walk;
  }
  function clampX(poly, x) { return Math.max(poly[0][0], Math.min(poly[poly.length - 1][0], x)); }
  function yAt(poly, x) {
    x = clampX(poly, x);
    for (var i = 0; i < poly.length - 1; i++) { var a = poly[i], b = poly[i + 1]; if (x >= a[0] && x <= b[0]) return a[1] + (b[1] - a[1]) * ((x - a[0]) / Math.max(1, b[0] - a[0])); }
    return poly[poly.length - 1][1];
  }
  function inRect(r, x, y) { return x >= r[0] && y >= r[1] && x <= r[0] + r[2] && y <= r[1] + r[3]; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  K.logic = { has: has, ok: ok, resolve: resolve, resolveCombo: resolveCombo, apply: apply, runRule: runRule, autos: autos,
    solveWidget: solveWidget, widget: widget, walkOf: walkOf, yAt: yAt, clampX: clampX, inRect: inRect, stateStep: stateStep };

  // ---------- игра ----------
  K.createGame = function (opts) {
    opts = opts || {};
    var SCN = opts.scenes || K.SCENES, P = opts.puzzles || K.PUZZLES, WT = K.Widgets.types, LAY = K.ThemeAPI.LAYOUT;
    var emit = opts.onEvent || function () {};
    var SC = {}; SCN.forEach(function (s) { SC[s.id] = s; });
    var hsWidget = {}; P.widgets.forEach(function (w) { if (w.scene) w.hs.forEach(function (h, i) { hsWidget[w.scene + ':' + h] = { w: w, i: i }; }); });
    var st, rt;

    function fresh() {
      var s = { v: SAVE_V, scene: P.start.scene, flags: clone(P.start.flags || {}), inv: (P.start.inv || []).slice(), local: {}, heroX: 0, hintFree: {}, hintCD: 0 };
      return s;
    }
    function freshRt() {
      return { mode: 'scene', hero: { x: 0, y: 0, dir: 1 }, target: null, reach: null, thoughts: {}, cut: null, cutQ: [], pose: 'idle', poseT: 0, npcPose: {},
        ring: {}, mini: null, miniDone: 0, walk: null, sel: null, drag: null, ptr: null, hover: { x: -1, y: -1 }, time: 0, debug: !!opts.debug, hintAfterMini: false };
    }
    st = fresh(); rt = freshRt();

    function sc() { return SC[st.scene]; }
    function local(w) { return st.local[w.id] || (st.local[w.id] = WT[w.type].init(w)); }
    function think(who, icons, dur) { rt.thoughts[who || 'hero'] = { icons: icons.slice(), t: dur || 2.4 }; if (!who || who === 'hero') { rt.pose = 'think'; rt.poseT = Math.min(dur || 2.4, 1.2); } emit('think', { who: who || 'hero', icons: icons }); }
    function pose(p, d) { rt.pose = p; rt.poseT = d || 0.8; }
    var fx = {
      think: function (icons, d) { think('hero', icons, d); },
      npcThink: function (id, icons, d) { think(id, icons, d); },
      npcPose: function (id, p) { rt.npcPose[id] = p; },
      pose: function (p, d) { pose(p, d); },
      sfx: function (name) { if (name === 'birds') rt.ring.birds = rt.time; emit('sfx', { name: name }); },
      go: function (id, x) { go(id, x); },
      cut: function (id) { if ((rt.cut && rt.cut.id === id) || rt.cutQ.some(function (c) { return c.id === id; })) return; rt.cutQ.push({ id: id, i: 0, t: 0 }); },
      mini: function (id) { openMini(id); },
      win: function () { emit('win', {}); },
      puzzle: function (id) { pose('happy', 0.9); emit('puzzle', { id: id, solved: solvedCount() }); }
    };
    function cutGuard(r) {
      for (var i = 0; i < r.do.length; i++) if (r.do[i][0] === 'cut') { var id = r.do[i][1]; if ((rt.cut && rt.cut.id === id) || rt.cutQ.some(function (c) { return c.id === id; })) return false; }
      return true;
    }
    function changed() { emit('change', {}); }
    function runAutos() { autos(P, st, fx, cutGuard); }

    // ---------- сцены ----------
    function placeHero(x) { var w = walkOf(sc(), st); rt.hero.x = clampX(w, x); rt.hero.y = yAt(w, rt.hero.x); }
    function go(id, x) {
      if (!SC[id]) return;
      st.scene = id; rt.target = null; rt.reach = null; rt.thoughts = {}; rt.sel = null;
      placeHero(x != null ? x : SC[id].hero.x); rt.hero.dir = rt.hero.x > 480 ? -1 : 1;
      emit('scene', { id: id });
      P.enter.forEach(function (r) { if (r.scene === id && ok(st, r.need)) { apply(P, st, r.do, fx); setPuzzle(st, r.puzzle, fx); } });
      runAutos(); changed();
    }

    // ---------- взаимодействие ----------
    function visibleHs() { var s = sc(); return s.hotspots.filter(function (h) { return ok(st, h.need); }); }
    function hsAt(x, y) { var list = visibleHs(); for (var i = list.length - 1; i >= 0; i--) if (inRect(list[i].rect, x, y)) return list[i]; return null; }
    function hsById(id) { var list = visibleHs(); for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
    function standX(h) { return h.at != null ? h.at : h.rect[0] + h.rect[2] / 2; }
    function approach(h, item) {
      var w = walkOf(sc(), st), tx = clampX(w, standX(h));
      rt.target = { x: tx, hs: h.id, item: item || null };
      rt.reach = null; emit('walk', { x: tx, hs: h.id });
    }
    function perform(hsId, item) {
      var h = hsById(hsId); if (!h) return;
      var s = st.scene, wk = hsWidget[s + ':' + hsId];
      if (!item && wk && ok(st, wk.w.need) && !st.flags['w:' + wk.w.id]) { widgetAct(wk.w, wk.i); return; }
      var r = resolve(P, st, s, hsId, item);
      if (r) { runRule(P, st, r, fx); runAutos(); changed(); return; }
      if (!item && h.to && ok(st, h.toNeed)) { emit('sfx', { name: 'step' }); go(h.to, h.toX); return; }
      think('hero', item ? [item, 'cross'] : (h.look || ['question']), 2);
      emit('sfx', { name: item ? 'nope' : 'look' });
    }
    function widgetAct(w, i) {
      var L = local(w), res = WT[w.type].act(w, L, i) || {};
      emit('sfx', { name: res.fail ? 'clank' : (w.type === 'melody' ? 'chime' : 'click'), note: res.note, widget: w.id });
      if (w.type === 'melody' && res.note != null) rt.ring['c' + res.note] = rt.time;
      if (WT[w.type].solved(w, L)) {
        if (w.hintGame) { rt.miniDone = Math.max(rt.time, 1e-6); return; }
        solveWidget(P, st, w, fx); runAutos();
        if (w.mini) rt.miniDone = Math.max(rt.time, 1e-6);
      }
      changed();
    }
    function combine(a, b) {
      if (a === b) return;
      var c = resolveCombo(P, st, a, b);
      if (c) { runRule(P, st, c, fx); runAutos(); changed(); return; }
      think('hero', [a, b, 'cross'], 1.8); emit('sfx', { name: 'nope' });
    }
    function lookAt(x, y) {
      if (rt.mode !== 'scene' || busy()) return;
      var h = hsAt(x, y);
      rt.hero.dir = x < rt.hero.x ? -1 : 1;
      if (!h) { think('hero', ['eye'], 1.2); return; }
      var o = sc().objects.filter(function (ob) { return ob.id === h.id; })[0];
      var icons = h.look || (o && o.item ? [o.item] : (h.to ? [SC[h.to].icon] : ['eye']));
      think('hero', icons, 2.2); emit('sfx', { name: 'look' });
    }

    // ---------- мини-игры ----------
    function openMini(id) {
      var w = widget(P, id); if (!w) return;
      if (w.hintGame) st.local[w.id] = WT[w.type].init(w); else local(w);
      rt.mode = 'mini'; rt.mini = { id: id, w: w, t0: rt.time }; rt.miniDone = 0; rt.target = null; rt.sel = null; rt.drag = null;
      emit('mini', { id: id, open: true });
    }
    function closeMini() {
      if (!rt.mini) return; var w = rt.mini.w, wasHint = w.hintGame, won = wasHint && WT[w.type].solved(w, local(w));
      rt.mode = 'scene'; rt.mini = null; rt.miniDone = 0; emit('mini', { id: w.id, open: false }); changed();
      if (wasHint && won) { st.hintCD = HINT_CD; showHint(); }
    }
    function miniTap(x, y) {
      var w = rt.mini.w, T = WT[w.type], L = local(w);
      if (rt.miniDone) return;
      var i = T.hit(w, L, x, y, rt.time); if (i < 0) return;
      widgetAct(w, i);
    }

    // ---------- подсказка и прохождение ----------
    function solvedCount() { return P.puzzles.filter(function (p) { return st.flags[p.id]; }).length; }
    function hintTarget() {
      var avail = P.puzzles.filter(function (p) { return !st.flags[p.id] && ok(st, p.avail); });
      if (!avail.length) return null;
      var here = avail.filter(function (p) { return p.scene === st.scene || p.scene == null; });
      return here[0] || avail[0];
    }
    function hintIcons() {
      var p = hintTarget(); if (!p) return ['heart'];
      if (p.scene && p.scene !== st.scene) return ['door', SC[p.scene].icon].concat(p.hint.slice(0, 1));
      return p.hint.slice();
    }
    function showHint() { var ic = hintIcons(); think('hero', ic, 3.6); emit('hint', { icons: ic, target: (hintTarget() || {}).id }); }
    function hintReady() { return !st.hintFree[st.scene] || st.hintCD <= 0; }
    function hint() {
      if (rt.mode !== 'scene' || rt.cut) return 'busy';
      if (!st.hintFree[st.scene]) { st.hintFree[st.scene] = true; st.hintCD = Math.max(st.hintCD, HINT_CD); showHint(); changed(); return 'free'; }
      if (st.hintCD <= 0) { st.hintCD = HINT_CD; showHint(); changed(); return 'timer'; }
      openMini('fireflies'); return 'game';
    }
    function walkSteps() {
      return P.puzzles.map(function (p) { return { id: p.id, icons: [p.scene ? SC[p.scene].icon : 'gear'].concat(p.sketch || p.hint), done: !!st.flags[p.id] }; });
    }
    function openWalk() { if (rt.cut) return; rt.mode = 'walk'; rt.walk = { page: 0 }; rt.target = null; emit('walkthrough', { open: true }); }
    function closeWalk() { rt.mode = 'scene'; rt.walk = null; emit('walkthrough', { open: false }); }
    function walkPages() { var per = LAY.walk.cols * LAY.walk.rows; return Math.ceil(P.puzzles.length / per); }

    // ---------- кат-сцены ----------
    function cutStep(dt) {
      if (!rt.cut) { if (!rt.cutQ.length) return; rt.cut = rt.cutQ.shift(); rt.cut.i = 0; rt.cut.t = 0; rt.target = null; emit('cut', { id: rt.cut.id, start: true }); }
      var c = rt.cut, steps = P.cuts[c.id], guard = 0;
      while (c.i < steps.length && guard++ < 50) {
        var s = steps[c.i], k = s[0];
        if (k === 'wait') { c.t += dt; dt = 0; if (c.t < s[1]) return; c.t = 0; c.i++; continue; }
        if (k === 'think' || k === 'npcThink' || k === 'pose') {
          if (!c.started) { c.started = true; if (k === 'think') think('hero', s[1], s[2]); else if (k === 'npcThink') think(s[1], s[2], s[3]); else pose(s[1], s[2]); }
          c.t += dt; dt = 0; var dur = k === 'npcThink' ? s[3] : s[2];
          if (c.t < (dur || 1)) return; c.t = 0; c.started = false; c.i++; continue;
        }
        if (k === 'walk') {
          var w = walkOf(sc(), st), tx = clampX(w, s[1]);
          if (Math.abs(rt.hero.x - tx) > 2) { stepHero(tx, dt); return; } c.i++; continue;
        }
        if (k === 'npcPose') { rt.npcPose[s[1]] = s[2]; c.i++; continue; }
        apply(P, st, [s], fx); runAutos(); changed(); c.i++;
      }
      if (c.i >= steps.length) { emit('cut', { id: c.id, end: true }); rt.cut = null; runAutos(); changed(); emit('save', {}); }
    }
    function skipCut() {
      var guard = 0;
      while ((rt.cut || rt.cutQ.length) && guard++ < 20) {
        if (!rt.cut) { rt.cut = rt.cutQ.shift(); rt.cut.i = 0; }
        var c = rt.cut, steps = P.cuts[c.id];
        for (; c.i < steps.length; c.i++) {
          var s = steps[c.i];
          if (s[0] === 'walk') { placeHero(s[1]); continue; }
          if (s[0] === 'npcPose') { rt.npcPose[s[1]] = s[2]; continue; }
          if (stateStep(s) || s[0] === 'sfx') { apply(P, st, [s], fx); runAutos(); }
        }
        emit('cut', { id: c.id, end: true, skipped: true }); rt.cut = null; runAutos();
      }
      rt.thoughts = {}; rt.pose = 'idle'; changed(); emit('save', {});
    }

    // ---------- ходьба ----------
    function stepHero(tx, dt) {
      var d = tx - rt.hero.x, w = walkOf(sc(), st);
      if (Math.abs(d) <= SPEED * dt) rt.hero.x = tx; else rt.hero.x += Math.sign(d) * SPEED * dt;
      if (d) rt.hero.dir = d < 0 ? -1 : 1;
      rt.hero.y = yAt(w, rt.hero.x); rt.pose = 'walk'; rt.poseT = 0.05;
    }
    function busy() { return !!(rt.cut || rt.cutQ.length || rt.target || rt.reach); }

    // ---------- ввод ----------
    function slotAt(x, y) {
      for (var i = 0; i < LAY.inv.slots; i++) if (inRect(K.ThemeAPI.slotRect(i), x, y)) return i;
      return -1;
    }
    function near(b, x, y) { return Math.hypot(x - b.x, y - b.y) <= b.r + 4; }
    function tap(x, y) {
      if (rt.cut || rt.cutQ.length) { skipCut(); return; }
      if (rt.mode === 'walk') {
        var Lw = LAY.walk;
        if (near(Lw.close, x, y)) closeWalk();
        else if (near(Lw.prev, x, y)) rt.walk.page = Math.max(0, rt.walk.page - 1);
        else if (near(Lw.next, x, y)) rt.walk.page = Math.min(walkPages() - 1, rt.walk.page + 1);
        emit('sfx', { name: 'page' }); return;
      }
      if (rt.mode === 'mini') { if (near(LAY.close, x, y)) { closeMini(); emit('sfx', { name: 'page' }); return; } miniTap(x, y); return; }
      if (near(LAY.hint, x, y)) { hint(); emit('sfx', { name: 'hint' }); return; }
      if (near(LAY.book, x, y)) { openWalk(); emit('sfx', { name: 'page' }); return; }
      if (y >= LAY.inv.y) {
        var si = slotAt(x, y), item = st.inv[si];
        if (si >= 0 && item) {
          if (rt.sel && rt.sel !== item) { var a = rt.sel; rt.sel = null; combine(a, item); }
          else rt.sel = rt.sel === item ? null : item;
          emit('sfx', { name: 'select' });
        } else rt.sel = null;
        return;
      }
      var h = hsAt(x, y);
      if (h) { var it = rt.sel; rt.sel = null; approach(h, it); return; }
      rt.sel = null;
      var w = walkOf(sc(), st); rt.target = { x: clampX(w, x), hs: null }; rt.reach = null;
    }
    function down(x, y) {
      rt.hover = { x: x, y: y };
      rt.ptr = { x0: x, y0: y, x: x, y: y, t: rt.time, moved: false, long: false, slot: rt.mode === 'scene' && !rt.cut ? slotAt(x, y) : -1 };
    }
    function move(x, y) {
      rt.hover = { x: x, y: y };
      var p = rt.ptr; if (!p) { if (rt.drag) rt.drag = null; return; }
      p.x = x; p.y = y;
      if (!p.moved && Math.hypot(x - p.x0, y - p.y0) > 12) p.moved = true;
      if (p.moved && p.slot >= 0 && st.inv[p.slot] && !rt.drag) { rt.drag = { item: st.inv[p.slot], x: x, y: y }; rt.sel = null; }
      if (rt.drag) { rt.drag.x = x; rt.drag.y = y; }
    }
    function up(x, y) {
      var p = rt.ptr; rt.ptr = null;
      if (!p) return;
      if (rt.drag) { var item = rt.drag.item; rt.drag = null; drop(item, x, y); return; }
      if (p.long) return;
      tap(x, y);
    }
    function drop(item, x, y) {
      if (rt.mode !== 'scene' || rt.cut) return;
      if (y >= LAY.inv.y) { var si = slotAt(x, y), other = st.inv[si]; if (other && other !== item) combine(item, other); return; }
      var h = hsAt(x, y); if (h) approach(h, item);
    }

    // ---------- цикл ----------
    function update(dt) {
      dt = Math.min(dt, 0.1); rt.time += dt;
      for (var k in rt.thoughts) { rt.thoughts[k].t -= dt; if (rt.thoughts[k].t <= 0) delete rt.thoughts[k]; }
      if (rt.poseT > 0) { rt.poseT -= dt; if (rt.poseT <= 0 && rt.pose !== 'walk') rt.pose = 'idle'; }
      if (st.hintCD > 0) st.hintCD = Math.max(0, st.hintCD - dt);
      if (rt.ptr && !rt.ptr.moved && !rt.ptr.long && rt.time - rt.ptr.t >= LONG_T && rt.ptr.slot < 0 && rt.mode === 'scene') { rt.ptr.long = true; lookAt(rt.ptr.x, rt.ptr.y); }
      if (rt.mode === 'mini' && rt.miniDone && rt.time - rt.miniDone > 0.9) closeMini();
      if (rt.cut || rt.cutQ.length) { cutStep(dt); return; }
      if (rt.reach) {
        rt.reach.t -= dt;
        if (rt.reach.t <= 0) { var R = rt.reach; rt.reach = null; perform(R.hs, R.item); if (!rt.cut && !rt.cutQ.length) emit('save', {}); }
        return;
      }
      if (rt.target) {
        var t = rt.target;
        if (Math.abs(rt.hero.x - t.x) > 0.5) stepHero(t.x, dt);
        else {
          rt.target = null; if (rt.pose === 'walk') rt.pose = 'idle';
          if (t.hs) {
            var h = hsById(t.hs);
            if (h) { var cx = h.rect[0] + h.rect[2] / 2; if (Math.abs(cx - rt.hero.x) > 4) rt.hero.dir = cx < rt.hero.x ? -1 : 1; rt.reach = { hs: t.hs, item: t.item, t: REACH_T }; pose(h.to && !t.item ? 'walk' : 'reach', REACH_T + 0.1); }
          }
        }
      }
    }

    // ---------- модель для отрисовки ----------
    function sceneView() {
      var s = sc(), wv = {};
      P.widgets.forEach(function (w) { if (w.scene === s.id) { var v = WT[w.type].view(w, local(w), st); for (var id in v) wv[id] = v[id]; } });
      var objs = [];
      s.objects.forEach(function (o) {
        if (!ok(st, o.show)) return;
        var state = {}, k;
        if (o.state) for (k in o.state) state[k] = o.state[k];
        if (o.bind) for (k in o.bind) state[k] = has(st, o.bind[k]);
        if (wv[o.id]) for (k in wv[o.id]) state[k] = wv[o.id][k];
        if (rt.npcPose[o.id]) state.pose = rt.npcPose[o.id];
        if (o.kind === 'npc' && o.state && o.state.type === 'bird' && rt.ring.birds != null) { var dtb = rt.time - rt.ring.birds; state.sing = Math.max(0, 1 - Math.abs(dtb - (+o.id.slice(4) - 1) * 0.32) / 0.3); }
        objs.push({ id: o.id, kind: o.kind, item: o.item, x: o.x, y: o.y, w: o.w, h: o.h, seed: o.seed, state: state });
      });
      return { id: s.id, w: s.w, h: s.h, mood: s.mood, layers: s.layers, objects: objs, hotspots: visibleHs(),
        walk: walkOf(s, st), hero: s.hero, dark: !!(s.darkUnless && !st.flags[s.darkUnless]) };
    }
    function thoughtsView() {
      var out = [], s = sc();
      for (var who in rt.thoughts) {
        var th = rt.thoughts[who], x, y;
        if (who === 'hero') { x = rt.hero.x; y = rt.hero.y - 132; }
        else { var o = s.objects.filter(function (ob) { return ob.id === who; })[0]; if (!o) continue; x = o.x + o.w / 2; y = o.y - 8; }
        out.push({ who: who, x: x, y: y, icons: th.icons });
      }
      return out;
    }
    function cursorKind() {
      var x = rt.hover.x, y = rt.hover.y;
      if (rt.mode !== 'scene' || rt.cut) return null;
      if (y >= LAY.inv.y || near(LAY.hint, x, y) || near(LAY.book, x, y)) return slotAt(x, y) >= 0 && st.inv[slotAt(x, y)] ? 'take' : 'use';
      var h = hsAt(x, y);
      if (h) return (rt.sel || rt.drag) ? 'use' : (h.to && !(h.toNeed && !ok(st, h.toNeed)) && h.cursor === 'go' ? 'go' : h.cursor);
      return 'walk';
    }
    function model() {
      var mini = rt.mode === 'mini' && rt.mini, w = mini && rt.mini.w;
      var scene = mini ? WT[w.type].scene(w, local(w), rt.time, rt) : sceneView();
      var ui = { mode: rt.cut || rt.cutQ.length ? 'cut' : rt.mode, layout: LAY, inv: st.inv.slice(), sel: rt.sel, drag: rt.drag,
        hover: slotAt(rt.hover.x, rt.hover.y),
        hint: { ready: hintReady(), free: !st.hintFree[st.scene], cd: st.hintCD > 0 ? st.hintCD / HINT_CD : 0 },
        close: !!mini, solvedMini: !!(mini && rt.miniDone), debug: rt.debug, progress: { solved: solvedCount(), total: P.puzzles.length },
        walk: rt.mode === 'walk' ? { page: rt.walk.page, pages: walkPages(), steps: walkSteps() } : null };
      return { mode: ui.mode, scene: scene, showHero: !mini, hero: { x: rt.hero.x, y: rt.hero.y, dir: rt.hero.dir }, pose: rt.pose,
        thoughts: mini ? [] : thoughtsView(), ui: ui, cursor: { kind: cursorKind(), x: rt.hover.x, y: rt.hover.y, item: rt.sel },
        light: { x: rt.hero.x, y: rt.hero.y - 60, r: st.inv.indexOf('lantern_lit') >= 0 ? 260 : 70 }, time: rt.time };
    }

    // ---------- сохранение ----------
    function serialize() { st.heroX = Math.round(rt.hero.x); return JSON.stringify(st); }
    function load(json) {
      var o; try { o = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { return false; }
      if (!o || o.v !== SAVE_V || !SC[o.scene] || typeof o.flags !== 'object' || !Array.isArray(o.inv)) return false;
      if (o.inv.some(function (i) { return P.items.indexOf(i) < 0; })) return false;
      st = { v: SAVE_V, scene: o.scene, flags: o.flags, inv: o.inv.slice(), local: o.local || {}, heroX: o.heroX || 0, hintFree: o.hintFree || {}, hintCD: +o.hintCD || 0 };
      rt = freshRt(); placeHero(st.heroX || SC[st.scene].hero.x);
      runAutos(); changed(); return true;
    }
    function start() { go(st.scene, SC[st.scene].hero.x); return api; }

    var api = {
      start: start, update: update, model: model, down: down, move: move, up: up, tap: tap, look: lookAt, hint: hint, combine: combine,
      openWalk: openWalk, closeWalk: closeWalk, closeMini: closeMini, skipCut: skipCut, busy: busy, serialize: serialize, load: load,
      setDebug: function (v) { rt.debug = v == null ? !rt.debug : !!v; return rt.debug; },
      ringBirds: function () { rt.ring.birds = rt.time; },
      state: function () { return st; }, runtime: function () { return rt; }, scene: function () { return sc(); },
      hotspot: hsById, hotspotAt: hsAt, slotAt: slotAt, solvedCount: solvedCount, hintTarget: hintTarget, hintIcons: hintIcons, walkSteps: walkSteps,
      won: function () { return !!st.flags.won; }, data: { scenes: SCN, puzzles: P }
    };
    return api;
  };
})(typeof window !== 'undefined' ? window : globalThis);
