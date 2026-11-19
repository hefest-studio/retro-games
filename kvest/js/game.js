/* МАЯЧНИЦА · game.js — движок point-and-click: интерпретирует данные главы — сцены, логику (puzzles), механизмы (widgets.js).
   Глава: createGame({ chapter }) — { scenes, puzzles, map } из реестра глав (chapters/index.js); без chapter — K.SCENES/K.PUZZLES.
   Общие механики глав (coast.js): сцена с двумя состояниями (scene.phase — прилив/отлив), таймеры главы (puzzles.timers),
   карта побережья (chapter.map — экран-переход; фишка героини идёт по тропе к узлу, затем вход в сцену).
   Помощники (helpers.js, с главы 3): несколько героев (Тая, пёс Вьюн, чайка Кира), переключение портретом, глаголы помощников
   (правила с полем hero), удержания (puzzles.holds — «X держит, пока Y действует»), умения: нюх пса (след тушью, G.ability)
   и «взгляд сверху» чайки (обзор тушью). Модель отдаёт отряд (party), портреты (ui.heroes), след (trail) и обзор (overview).
   Под водой (water.js, с главы 4): мягкий таймер воздуха (puzzles.air, карманы scene.water.pockets; кончился — мягкий возврат
   к последнему карману без потери прогресса), мутная вода (видимость снижена, зоны guide — по звону), колокола-ориентиры
   (scene.water.sounds: звенят сами и по умению Таи «прислушаться»; событие 'ring' с панорамой и высотой тона по расстоянию).
   Модель отдаёт model.water (воздух, муть, кольца звука) — тема рисует хуком drawWater.
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
  // правило героя: без поля hero — только Тая (главы 1–2), иначе — герой из hero (строка или список); st.hero — активный герой
  function heroOk(r, hero) { hero = hero || 'taya'; var h = r && r.hero; if (!h) return hero === 'taya'; return typeof h === 'string' ? h === hero : h.indexOf(hero) >= 0; }
  function resolve(P, st, scene, hs, item) {
    item = item || null;
    for (var i = 0; i < P.rules.length; i++) { var r = P.rules[i]; if (r.scene === scene && r.hs === hs && (r.item || null) === item && heroOk(r, st.hero) && ok(st, r.need)) return r; }
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
    if (sc.walkPhase && K.Coast) { var ph = K.Coast.phaseOf(sc, st); if (sc.walkPhase[ph]) return sc.walkPhase[ph]; }
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

  // зоны сцены в состоянии st: need + фаза сцены; у карты — открытые узлы (coast.js)
  function hotspotsOf(sc, st) { var l = K.Coast ? K.Coast.sceneHotspots(sc, st) : sc.hotspots.filter(function (h) { return ok(st, h.need); }); return K.Water ? K.Water.filter(sc, st, l) : l; }
  // сцены главы с картой (карта — обычная сцена движка с id = map.id)
  function withMap(scenes, map) { if (!map || !K.Coast || scenes.some(function (s) { return s.map; })) return scenes; return scenes.concat([K.Coast.mapScene(map)]); }

  K.logic = { has: has, ok: ok, resolve: resolve, resolveCombo: resolveCombo, apply: apply, runRule: runRule, autos: autos,
    solveWidget: solveWidget, widget: widget, walkOf: walkOf, heroOk: heroOk, yAt: yAt, clampX: clampX, inRect: inRect, stateStep: stateStep,
    hotspots: hotspotsOf, withMap: withMap };

  // ---------- игра ----------
  K.createGame = function (opts) {
    opts = opts || {};
    var CH = opts.chapter || null;
    var P = opts.puzzles || (CH && CH.puzzles) || K.PUZZLES, WT = K.Widgets.types, LAY = K.ThemeAPI.LAYOUT;
    var SCN = withMap(opts.scenes || (CH && CH.scenes) || K.SCENES, opts.map || (CH && CH.map) || null);
    var TIMERS = P.timers || [], TIMERS_ON = opts.timers !== false, TRAVEL = 260, PHASE_T = 1.8;
    var emit = opts.onEvent || function () {};
    var SC = {}; SCN.forEach(function (s) { SC[s.id] = s; });
    var hsWidget = {}; P.widgets.forEach(function (w) { if (w.scene) w.hs.forEach(function (h, i) { hsWidget[w.scene + ':' + h] = { w: w, i: i }; }); });
    // помощники (helpers.js): в главах без puzzles.heroes — одна Тая, всё как раньше
    var HL = K.Helpers || null, MULTI = !!(HL && HL.multi(P)), HEROES = HL ? HL.list(P) : ['taya'], ICON = HL ? HL.ICON : { taya: 'taya' };
    var HOFF = { taya: 132, dog: 84, gull: 60 }, TRAIL_T = 4.5, OVER_T = 6;
    // подводные механики (water.js): в главах без puzzles.air и без scene.water — всё как раньше
    var WT_ = K.Water || null, AIR = WT_ ? WT_.conf(P) : null, SURF_OUT = 0.8, SURF_IN = 0.7, LISTEN_GAP = 0.65;
    var st, rt;

    function fresh() {
      var s = { v: SAVE_V, scene: P.start.scene, flags: clone(P.start.flags || {}), inv: (P.start.inv || []).slice(), local: {}, heroX: 0, hintFree: {}, hintCD: 0 };
      if (CH && CH.id) s.ch = CH.id;
      if (TIMERS.length) s.tt = {};
      if (MULTI) s.hero = 'taya';
      if (AIR) { s.air = AIR.max; s.pocket = null; }
      return s;
    }
    function freshRt() {
      return { mode: 'scene', hero: { x: 0, y: 0, dir: 1 }, target: null, reach: null, thoughts: {}, cut: null, cutQ: [], pose: 'idle', poseT: 0, npcPose: {},
        ring: {}, mini: null, miniDone: 0, walk: null, sel: null, drag: null, ptr: null, hover: { x: -1, y: -1 }, time: 0, debug: !!opts.debug, hintAfterMini: false,
        pad: rt ? rt.pad : (+opts.pad || 0), phase: { name: null, t0: -99 }, token: null, travel: null, timerSeen: {},
        pos: {}, hpose: {}, reachY: null, trail: null, overview: null, rings: {}, ringN: {}, listenQ: [], surf: null, airLow: false };
    }
    st = fresh(); rt = freshRt(); rt.pos.taya = rt.hero;

    function sc() { return SC[st.scene]; }
    function local(w) { return st.local[w.id] || (st.local[w.id] = WT[w.type].init(w)); }
    function think(who, icons, dur, meta) { if (who && who !== 'hero') dur = Math.max(dur || 2.4, 3.6); /* мысль мастера тушью: перо рисует ~1.4 с, готовый эскиз должен постоять */ rt.thoughts[who || 'hero'] = { icons: icons.slice(), t: dur || 2.4, dur: dur || 2.4, meta: meta || null }; if (!who || who === 'hero') { rt.pose = 'think'; rt.poseT = Math.min(dur || 2.4, 1.2); } emit('think', { who: who || 'hero', icons: icons }); }
    function pose(p, d) { rt.pose = p; rt.poseT = d || 0.8; }
    var fx = {
      think: function (icons, d) { think('hero', icons, d); },
      npcThink: function (id, icons, d) { think(id, icons, d); },
      npcPose: function (id, p) { rt.npcPose[id] = p; },
      heroPose: function (id, p, d) { rt.hpose[id] = { p: p, until: rt.time + (d || 1) }; },
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
    function runAutos() {
      autos(P, st, fx, cutGuard);
      if (MULTI) HL.autoRelease(P, st).forEach(function (r) { if (r.hero === active()) { rt.pose = 'idle'; rt.poseT = 0; } emit('sfx', { name: 'release' }); emit('hold', { id: r.id, hero: r.hero, on: false, auto: true }); });
    }

    // ---------- сцены ----------
    function placeHero(x) { var w = walkOf(sc(), st); rt.hero.x = clampX(w, x); rt.hero.y = yAt(w, rt.hero.x); }
    function go(id, x) {
      if (!SC[id]) return;
      var prev = st.scene;
      st.scene = id; rt.target = null; rt.reach = null; rt.thoughts = {}; rt.sel = null; rt.travel = null;
      placeHero(x != null ? x : SC[id].hero.x); rt.hero.dir = rt.hero.x > 480 ? -1 : 1;
      rt.trail = null; rt.overview = null; placeParty();
      if (AIR && !(SC[prev] && wet(SC[prev]) && wet(SC[id]))) st.air = AIR.max;   // с суши под воду — с полным воздухом
      rt.listenQ = []; rt.ringN = {}; rt.ringK = {}; rt.rings = {};
      rt.phase = { name: K.Coast ? K.Coast.phaseOf(SC[id], st) : null, t0: -99 };
      if (SC[id].map) {   // карта: фишка героини — у узла сцены, из которой пришли
        var M = SC[id].map, n = K.Coast.nodeOfScene(M, prev); if (n) st.mapAt = n.id; if (!st.mapAt || !K.Coast.node(M, st.mapAt)) st.mapAt = M.start;
        var nn = K.Coast.node(M, st.mapAt); rt.token = { x: nn.x, y: nn.y, dir: 1 };
      }
      emit('scene', { id: id });
      P.enter.forEach(function (r) { if (r.scene === id && ok(st, r.need)) { apply(P, st, r.do, fx); setPuzzle(st, r.puzzle, fx); } });
      runAutos(); changed();
    }

    // ---------- помощники: отряд, переключение, удержания, умения ----------
    function active() { return st.hero || 'taya'; }
    function presentHere(id) { return !MULTI ? id === 'taya' : HL.present(P, st, sc(), id); }
    function holdHs(b) { var h = null; sc().hotspots.forEach(function (q) { if (q.id === b.hs) h = q; }); return h; }
    function holdStand(b) { var w = walkOf(sc(), st), h = holdHs(b); return clampX(w, b.at != null ? b.at : (h ? standX(h) : rt.hero.x)); }
    function holdDir(b, x) { var h = holdHs(b); if (!h) return x > 480 ? -1 : 1; var cx = h.rect[0] + h.rect[2] / 2; return Math.abs(cx - x) < 3 ? (x > 480 ? -1 : 1) : cx < x ? -1 : 1; }   // держащий смотрит на то, что держит
    // место в отряде: k-й позади активного; у края полосы — впереди (чтобы не стоять друг на друге)
    function slotX(w, L, k) { var d = L.dir || 1, gap = 46 * k + 8, x = L.x - d * gap, lo = w[0][0], hi = w[w.length - 1][0]; if (x < lo + 4 || x > hi - 4) x = L.x + d * gap; return clampX(w, x); }
    // положения героев в сцене: активный — rt.hero; свободные — следом за ним; держащий здесь — у своей зоны
    function placeParty() {
      var a = active(), w = walkOf(sc(), st), k = 0, d = rt.hero.dir || 1; rt.pos = {}; rt.pos[a] = rt.hero;
      if (!MULTI) return;
      HEROES.forEach(function (id) {
        if (id === a || !presentHere(id)) return;
        var b = HL.busy(P, st, id), x;
        if (b) x = holdStand(b); else { k++; x = slotX(w, rt.hero, k); }
        rt.pos[id] = { x: x, y: yAt(w, x), dir: b ? holdDir(b, x) : d, pose: b ? (b.pose || 'hold') : 'idle', alt: yAt(w, x) };
      });
      rt.hero.alt = rt.hero.y;
    }
    // каждый кадр: состав отряда в сцене (кто-то начал/закончил держать, присоединился) и шаги следом за активным
    function partyStep(dt) {
      if (!MULTI) return;
      var a = active(), w = walkOf(sc(), st), L = rt.hero, k = 0;
      for (var id0 in rt.pos) if (id0 !== a && !presentHere(id0)) delete rt.pos[id0];
      HEROES.forEach(function (id) {
        var p = rt.pos[id];
        if (id === a) { flyStep(id, L, dt); return; }
        if (!presentHere(id)) return;
        if (!p) { var nx = clampX(w, L.x - (L.dir || 1) * 60); p = rt.pos[id] = { x: nx, y: yAt(w, nx), dir: L.dir || 1, pose: 'idle', alt: yAt(w, nx) - 40 }; }
        var b = HL.busy(P, st, id);
        if (b) { p.pose = b.pose || 'hold'; p.dir = holdDir(b, p.x); p.y = yAt(w, p.x); flyStep(id, p, dt); return; }
        k++;
        var tx = slotX(w, L, k), d = tx - p.x;
        if (Math.abs(d) > 30 || (p.moving && Math.abs(d) > 2)) { p.moving = true; var stp = SPEED * 1.08 * dt; p.x += Math.abs(d) <= stp ? d : Math.sign(d) * stp; p.dir = d < 0 ? -1 : 1; p.pose = 'walk'; }
        else { p.moving = false; p.pose = 'idle'; if (Math.abs(L.x - p.x) > 4) p.dir = L.x < p.x ? -1 : 1; }
        p.y = yAt(w, p.x); flyStep(id, p, dt);
      });
    }
    // чайка: высота полёта (alt — абсолютный y): тянется к зоне — взлетает к ней; идёт — парит; стоит — садится
    function flyStep(id, p, dt) {
      if (id !== 'gull') { p.alt = p.y; p.ax = p.x; return; }
      var moving = id === active() ? (rt.pose === 'walk' || !!rt.target) : p.moving, tgt = p.y, tx = p.x, up = id === active() && rt.reach && rt.reachY != null;
      if (up) { tgt = rt.reachY; tx = rt.reachX; }   // взлёт к зоне: и вверх, и вбок (над водой, к уступу скалы)
      else if (moving) tgt = p.y - 70;
      if (p.alt == null) p.alt = p.y; if (p.ax == null) p.ax = p.x;
      var k = Math.min(1, dt * (up ? 7 : 4)); p.alt += (tgt - p.alt) * k; p.ax += (tx - p.ax) * k;
      if (!up && Math.abs(p.ax - p.x) > 1 && Math.abs(tx - p.ax) > 2 && p.alt > p.y - 30) p.alt = Math.min(p.alt, p.y - 30);   // возвращается к отряду — по воздуху
    }
    function heroIcon(id) { return ICON[id] || 'question'; }
    function switchTo(id, quiet) {
      if (!MULTI || HEROES.indexOf(id) < 0) return false;
      if (id === active()) return true;
      if (!presentHere(id)) { think('hero', [heroIcon(id), HL.busy(P, st, id) ? 'hold' : 'cross'], 1.6); emit('sfx', { name: 'nope' }); return false; }
      var old = active(), ob = HL.busy(P, st, old), po = rt.pos[old] || rt.hero;
      po.pose = ob ? (ob.pose || 'hold') : 'idle'; po.moving = false;
      if (!rt.pos[id]) { var ww = walkOf(sc(), st), nx = clampX(ww, po.x - (po.dir || 1) * 50); rt.pos[id] = { x: nx, y: yAt(ww, nx), dir: po.dir || 1, pose: 'idle', alt: yAt(ww, nx) }; }
      st.hero = id; rt.hero = rt.pos[id]; rt.target = null; rt.reach = null; rt.reachY = null; rt.sel = null;
      var b = HL.busy(P, st, id); rt.pose = b ? (b.pose || 'hold') : 'idle'; rt.poseT = 0;
      emit('hero', { id: id, from: old }); if (!quiet) emit('sfx', { name: id === 'dog' ? 'bark' : id === 'gull' ? 'gull' : 'switch' });
      changed(); return true;
    }
    function cycleHero(d) {
      if (!MULTI) return false; var a = HEROES.indexOf(active());
      for (var k = 1; k <= HEROES.length; k++) { var id = HEROES[(a + k * (d || 1) + HEROES.length * 4) % HEROES.length]; if (id !== active() && presentHere(id)) return switchTo(id); }
      return false;
    }
    function startHold(hd, hero) {
      HL.start(P, st, hd, hero); rt.pose = hd.pose || 'hold'; rt.poseT = 0; rt.hero.dir = holdDir(hd, rt.hero.x);
      emit('sfx', { name: hd.sfx || 'pull' }); emit('hold', { id: hd.id, hero: hero, on: true });
      setPuzzle(st, hd.puzzle, fx); runAutos(); changed(); emit('save', {});
      // держит помощник — управление переходит к Тае (или к другому свободному герою в сцене)
      var c = ['taya'].concat(HEROES).filter(function (id) { return id !== hero && presentHere(id) && HL.free(P, st, id); });
      if (c.length) switchTo(c[0], true);
    }
    function releaseHold(hid) {
      var b = HL.hold(P, hid), who = HL.holder(P, st, hid); if (!b || !who) return false;
      HL.release(P, st, hid); if (who === active()) { rt.pose = 'idle'; rt.poseT = 0; }
      emit('sfx', { name: 'release' }); emit('hold', { id: hid, hero: who, on: false }); runAutos(); changed(); emit('save', {});
      return true;
    }
    // умение активного помощника: пёс — нюх (след тушью к спрятанному), чайка — взгляд сверху (обзор тушью)
    function ability() {
      if (rt.mode !== 'scene' || rt.cut || rt.cutQ.length || rt.travel || rt.surf || sc().map) return null;
      var a = active(); if (a === 'taya') return canListen() ? listen() : null;   // Тая под водой — «прислушаться» (и в главах без помощников)
      if (!MULTI) return null;
      if (a === 'dog') return sniff(); if (a === 'gull') return overview(); return null;
    }
    // ---------- под водой: воздух, мягкий возврат, колокола-ориентиры ----------
    function wet(s) { return !!(WT_ && s && s.water); }
    function canListen() { return wet(sc()) && WT_.sources(sc(), st).length > 0; }
    // «прислушаться» (умение Таи под водой, Q или тап по её портрету): все звучащие колокола сцены звенят по очереди, слева направо
    function listen() {
      if (!wet(sc())) return null;
      var srcs = WT_.sources(sc(), st).slice().sort(function (a, b) { return a.x - b.x; });
      if (!srcs.length) { think('hero', ['ear', 'cross'], 1.4); return 0; }
      rt.listenQ = srcs.map(function (s, i) { return { id: s.id, at: rt.time + 0.2 + i * LISTEN_GAP }; });
      pose('think', 0.4 + srcs.length * LISTEN_GAP); emit('ability', { hero: 'taya', listen: srcs.length });
      return srcs.length;
    }
    function ring(src, how) {
      rt.rings[src.id] = rt.time; rt.ringN[src.id] = (rt.ringN[src.id] || 0) + 1;
      var v = WT_.voice(src, rt.hero.x, WT_.murky(sc(), st));
      emit('ring', { id: src.id, note: src.note, big: !!src.big, harsh: !!src.harsh, pan: v.pan, gain: v.gain, semis: v.semis, cutoff: v.cutoff, dist: v.dist, how: how || 'auto' });
    }
    function ringStep() {
      var s = sc(); if (!wet(s) || rt.mode !== 'scene' || rt.surf) return;   // в мини-игре и наброске колокола сцены молчат
      var srcs = WT_.sources(s, st);
      for (var i = 0; i < srcs.length; i++) {
        var q = srcs[i], ev = q.every || WT_.EVERY, k = Math.floor((rt.time + (q.phase || 0)) / ev);
        if (rt.ringK && rt.ringK[s.id + ':' + q.id] != null && k > rt.ringK[s.id + ':' + q.id]) ring(q, 'auto');
        (rt.ringK = rt.ringK || {})[s.id + ':' + q.id] = k;
      }
      while (rt.listenQ.length && rt.listenQ[0].at <= rt.time) { var L = rt.listenQ.shift(), src = WT_.source(s, L.id); if (src) ring(src, 'listen'); }
    }
    function airStep(dt) {
      if (!AIR) return;
      var s = sc();
      if (!wet(s)) { st.air = AIR.max; return; }
      if (rt.surf || rt.mode !== 'scene' || rt.cut || rt.cutQ.length || st.flags.won) return;   // в кат-сцене, мини-игре, наброске и после финала воздух не убывает
      var p = WT_.pocketAt(s, st, rt.hero.x), moving = !!(rt.target || rt.reach);
      if (p) st.pocket = { scene: s.id, x: p.x, id: p.id };
      var a0 = st.air; st.air = WT_.step(st.air, AIR.max, dt, moving, !!p);
      if (p && a0 < AIR.max - 0.01 && st.air >= AIR.max - 0.01) emit('sfx', { name: 'air' });
      var low = st.air < AIR.max * 0.3; if (low && !rt.airLow) emit('sfx', { name: 'airlow' }); rt.airLow = low;
      if (st.air <= 0) { st.air = 0; surface(); }
    }
    // мягкий возврат: темнеет тушью — героиня у последнего кармана (или в home главы); прогресс не меняется
    function surface() {
      rt.surf = { t0: rt.time, phase: 'out' }; rt.outs = (rt.outs || 0) + 1; rt.target = null; rt.reach = null; rt.sel = null; rt.listenQ = [];
      emit('sfx', { name: 'surface' }); emit('air', { out: true, scene: st.scene }); emit('error', { kind: 'air', scene: st.scene });
    }
    function surfStep() {
      var f = rt.surf; if (!f) return;
      if (f.phase === 'out' && rt.time - f.t0 >= SURF_OUT) {
        var pk = st.pocket && SC[st.pocket.scene] && WT_.pocketAt(SC[st.pocket.scene], st, st.pocket.x) ? st.pocket : null, h = AIR.home;
        var to = pk ? pk.scene : h && SC[h.scene] ? h.scene : P.start.scene, x = pk ? pk.x : h ? h.x : SC[to].hero.x;
        if (to !== st.scene) go(to, x); else placeHero(x);
        st.air = AIR.max; rt.surf = { t0: rt.time, phase: 'in' }; think('hero', [pk ? 'air' : 'divebell', 'heart'], 1.6); changed(); emit('save', {});
      } else if (f.phase === 'in' && rt.time - f.t0 >= SURF_IN) rt.surf = null;
    }
    function waterView() {
      var s = sc(); if (!wet(s)) return null;
      var f = rt.surf, fade = !f ? 0 : f.phase === 'out' ? Math.min(1, (rt.time - f.t0) / SURF_OUT) : Math.max(0, 1 - (rt.time - f.t0) / SURF_IN);
      return { murk: WT_.murky(s, st), vis: s.water.vis || WT_.VIS, hero: { x: rt.hero.x, y: rt.hero.y }, fade: fade,
        air: AIR ? { left: st.air, max: AIR.max, f: Math.max(0, st.air / AIR.max), low: st.air < AIR.max * 0.3, pocket: !!WT_.pocketAt(s, st, rt.hero.x), bubbles: 10 } : null,
        pockets: WT_.pockets(s, st).map(function (p) { return { id: p.id, x: p.x, w: p.w || WT_.POCKET_W }; }),
        sounds: (s.water.sounds || []).map(function (q) { var on = ok(st, q.need), t0 = rt.rings[q.id], v = WT_.voice(q, rt.hero.x, false);
          return { id: q.id, x: q.x, y: q.y == null ? 300 : q.y, note: q.note, big: !!q.big, harsh: !!q.harsh, active: on, age: t0 == null ? 99 : rt.time - t0, n: rt.ringN[q.id] || 0, near: v.near, pan: v.pan }; }),
        time: rt.time };
    }
    function useful(r) { if (!r) return false; if (r.puzzle && !st.flags[r.puzzle]) return true; return r.do.some(function (x) { return x[0] === 'give' || x[0] === 'cut' || x[0] === 'mini' || x[0] === 'set' || x[0] === 'toggle'; }); }
    function sniff() {
      var s = sc(), d = rt.hero, best = null, bd = 1e9;
      visibleHs().forEach(function (h) {
        if (!h.scent) return; var r = resolve(P, st, s.id, h.id, null); if (!useful(r)) return;
        var dd = Math.abs(standX(h) - d.x); if (dd < bd) { bd = dd; best = h; }
      });
      rt.overview = null;
      if (!best) { think('hero', ['scent', 'cross'], 1.6); emit('sfx', { name: 'nope' }); emit('ability', { hero: 'dog', found: false }); return false; }
      var w = walkOf(s, st), tx = best.rect[0] + best.rect[2] / 2, ty = Math.min(best.rect[1] + best.rect[3], yAt(w, tx)), pts = [], n = 14, sx = d.x + (d.dir || 1) * 26, sy = d.y;
      for (var i = 0; i <= n; i++) { var f = i / n, wig = Math.sin(f * Math.PI * 3 + tx * 0.01) * 12 * Math.sin(f * Math.PI); pts.push([Math.round(sx + (tx - sx) * f), Math.round(sy + (ty - sy) * f * f + wig)]); }
      rt.trail = { pts: pts, rect: best.rect.slice(), hs: best.id, t0: rt.time };
      pose('sniff', 1.2); rt.hero.dir = tx < d.x ? -1 : 1;
      emit('sfx', { name: 'sniff' }); emit('ability', { hero: 'dog', found: true, hs: best.id });
      return best.id;
    }
    function overview() {
      var s = sc(), marks = [], seen = {};
      function mark(h, hero, item) { var k = h.id + '|' + hero + '|' + (item || ''); if (seen[k]) return; seen[k] = 1; marks.push({ hs: h.id, rect: h.rect.slice(), hero: hero, item: item || null }); }
      visibleHs().forEach(function (h) {
        if (h.to && h.cursor === 'go') {   // выход туда, где есть дело
          var tp = hintTarget(); if (tp && tp.scene === h.to && h.to !== s.id) marks.push({ hs: h.id, rect: h.rect.slice(), exit: true, icon: SC[h.to].icon });
          return;
        }
        HEROES.forEach(function (id) {
          if (!presentHere(id)) return;
          var s2 = { flags: st.flags, inv: st.inv, hero: id }, hd = HL.holdFor(P, s2, s.id, h.id, id), wk = hsWidget[s.id + ':' + h.id];
          if (hd && (!hd.puzzle || !st.flags[hd.puzzle] || !hd.puzzle)) { mark(h, id); return; }
          if (id === 'taya' && wk && ok(st, wk.w.need) && !st.flags['w:' + wk.w.id]) { mark(h, id); return; }
          if (useful(resolve(P, s2, s.id, h.id, null))) mark(h, id);
          st.inv.forEach(function (it) { if (useful(resolve(P, s2, s.id, h.id, it))) mark(h, id, it); });
        });
      });
      rt.trail = null; rt.overview = { marks: marks, t0: rt.time };
      emit('sfx', { name: 'gull' }); emit('ability', { hero: 'gull', marks: marks.length });
      return marks.length;
    }

    // ---------- взаимодействие ----------
    function visibleHs() { return hotspotsOf(sc(), st); }
    function hsAt(x, y) { var list = visibleHs(); for (var i = list.length - 1; i >= 0; i--) if (inRect(list[i].rect, x, y)) return list[i]; return null; }
    // тач на маленьком экране: если точного попадания нет — ближайшая зона в пределах rt.pad (логических пикселей)
    function hsAtTouch(x, y) {
      var h = hsAt(x, y); if (h || !(rt.pad > 0) || y >= LAY.inv.y) return h;
      var list = visibleHs(), best = null, bd = rt.pad + 1e-6;
      for (var i = list.length - 1; i >= 0; i--) {
        var r = list[i].rect, dx = Math.max(r[0] - x, 0, x - r[0] - r[2]), dy = Math.max(r[1] - y, 0, y - r[1] - r[3]), d = Math.hypot(dx, dy);
        if (d < bd) { bd = d; best = list[i]; }
      }
      return best;
    }
    function hsById(id) { var list = visibleHs(); for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
    function standX(h) { return h.at != null ? h.at : h.rect[0] + h.rect[2] / 2; }
    function approach(h, item) {
      var w = walkOf(sc(), st), tx = clampX(w, standX(h));
      rt.target = { x: tx, hs: h.id, item: item || null };
      rt.reach = null; emit('walk', { x: tx, hs: h.id });
    }
    function perform(hsId, item) {
      var h = hsById(hsId); if (!h) return;
      var s = st.scene, wk = hsWidget[s + ':' + hsId], hero = active();
      if (!item && MULTI) { var hd = HL.holdFor(P, st, s, hsId, hero); if (hd) { startHold(hd, hero); return; } }
      if (!item && wk && hero === 'taya' && ok(st, wk.w.need) && !st.flags['w:' + wk.w.id]) { widgetAct(wk.w, wk.i); return; }
      var r = resolve(P, st, s, hsId, item);
      if (r) { runRule(P, st, r, fx); runAutos(); changed(); return; }
      if (!item && h.to && ok(st, h.toNeed)) {
        if (MULTI && !HL.allowed(SC[h.to], hero, P)) { think('hero', [heroIcon(hero), SC[h.to].icon || 'door', 'cross'], 1.8); emit('sfx', { name: 'nope' }); return; }   // помощника туда не пускают
        emit('sfx', { name: 'step' }); go(h.to, h.toX); return;
      }
      think('hero', item ? [item, 'cross'] : (hero !== 'taya' ? [heroIcon(hero), 'cross'] : (h.look || ['question'])), 2);
      emit('sfx', { name: item ? 'nope' : 'look' });
      if (item) emit('error', { kind: 'item', scene: s, hs: hsId, item: item });
    }
    function widgetAct(w, i) {
      var L = local(w), res = WT[w.type].act(w, L, i) || {};
      emit('sfx', { name: res.fail ? 'clank' : (w.type === 'melody' ? 'chime' : 'click'), note: res.note, widget: w.id });
      if (res.fail && !w.hintGame) emit('error', { kind: 'mech', widget: w.id });
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
      think('hero', [a, b, 'cross'], 1.8); emit('sfx', { name: 'nope' }); emit('error', { kind: 'combo', a: a, b: b });
    }
    function lookAt(x, y) {
      if (rt.mode !== 'scene' || busy()) return;
      var h = hsAt(x, y);
      rt.hero.dir = x < rt.hero.x ? -1 : 1;
      if (!h) { think('hero', ['eye'], 1.2); return; }
      var o = sc().objects.filter(function (ob) { return ob.id === h.id; })[0];
      var icons = h.look || (o && o.item ? [o.item] : (h.to ? [SC[h.to].icon] : ['eye']));
      think('hero', icons, 2.2); emit('sfx', { name: 'look' }); emit('look', { hs: h.id });
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
      if (wasHint && won) { st.hintCD = HINT_CD; showHint('game'); }
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
    function showHint(how) {   // мысль-подсказка: тема может нарисовать её эскизом (drawHint) по данным цели (puzzle.ink)
      var ic = hintIcons(), p = hintTarget();
      think('hero', ic, 4.2, { hint: true, target: p ? p.id : null, scene: p ? p.scene : null, here: !p || !p.scene || p.scene === st.scene });
      emit('hint', { icons: ic, target: (p || {}).id, how: how || 'free' });
    }
    function hintReady() { return !st.hintFree[st.scene] || st.hintCD <= 0; }
    function hint() {
      if (rt.mode !== 'scene' || rt.cut) return 'busy';
      if (!st.hintFree[st.scene]) { st.hintFree[st.scene] = true; st.hintCD = Math.max(st.hintCD, HINT_CD); showHint('free'); changed(); return 'free'; }
      if (st.hintCD <= 0) { st.hintCD = HINT_CD; showHint('timer'); changed(); return 'timer'; }
      openMini('fireflies'); return 'game';
    }
    // шаги наброска: все головоломки; open — пройденные и текущая цель (остальные в блокноте не показываются)
    function walkSteps() {
      var cur = hintTarget(), cid = cur ? cur.id : null;
      return P.puzzles.map(function (p) {
        var done = !!st.flags[p.id];
        return { id: p.id, scene: p.scene, icons: [p.scene ? SC[p.scene].icon : 'gear'].concat(p.sketch || p.hint), done: done, current: p.id === cid, open: done || p.id === cid, ink: p.ink || null };
      });
    }
    function openSteps() { return walkSteps().filter(function (s) { return s.open; }); }
    function openWalk() {   // открывается на развороте с текущей целью
      if (rt.cut) return; var os = openSteps(), ci = 0; os.forEach(function (s, i) { if (s.current) ci = i; });
      rt.mode = 'walk'; rt.walk = { page: Math.floor(ci / walkPer()), open: rt.time }; rt.target = null; emit('walkthrough', { open: true });
    }
    function closeWalk() { rt.mode = 'scene'; rt.walk = null; emit('walkthrough', { open: false }); }
    function walkPer() { return LAY.walk.per || LAY.walk.cols * LAY.walk.rows; }
    function walkPages() { return Math.max(1, Math.ceil(openSteps().length / walkPer())); }
    function walkFlip(d) { if (!rt.walk) return; var p = Math.max(0, Math.min(walkPages() - 1, rt.walk.page + d)); if (p !== rt.walk.page) { rt.walk.page = p; rt.walk.flip = { d: d, t: rt.time }; } }

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

    // ---------- карта: фишка идёт по открытым тропам к узлу, затем вход в сцену ----------
    function mapGo(h) {
      var M = sc().map, from = st.mapAt || M.start;
      if (h.node === from) { emit('sfx', { name: 'step' }); go(h.to, h.toX); return; }
      var pts = K.Coast.path(M, st, from, h.node);
      if (!pts) { think('hero', [K.Coast.node(M, h.node).icon, 'cross'], 1.6); emit('sfx', { name: 'nope' }); return; }
      rt.travel = { pts: pts, i: 1, hs: h }; emit('walk', { map: true, to: h.node });
    }
    function travelStep(dt) {
      var tv = rt.travel, tk = rt.token, left = TRAVEL * dt;
      while (left > 0 && tv.i < tv.pts.length) {
        var p = tv.pts[tv.i], dx = p[0] - tk.x, dy = p[1] - tk.y, d = Math.hypot(dx, dy);
        if (Math.abs(dx) > 0.5) tk.dir = dx < 0 ? -1 : 1;
        if (d <= left) { tk.x = p[0]; tk.y = p[1]; tv.i++; left -= d; } else { tk.x += dx / d * left; tk.y += dy / d * left; left = 0; }
      }
      if (tv.i >= tv.pts.length) { var h = tv.hs; rt.travel = null; st.mapAt = h.node; emit('sfx', { name: 'step' }); go(h.to, h.toX); emit('save', {}); }
    }
    // ---------- две фазы сцены и таймеры главы ----------
    function phaseWatch() {
      var s = sc(), ph = K.Coast ? K.Coast.phaseOf(s, st) : null;
      if (ph === rt.phase.name) return;
      rt.phase = { name: ph, t0: rt.time, from: rt.phase.name };
      emit('phase', { scene: s.id, phase: ph });
      var w = walkOf(s, st), cx = clampX(w, rt.hero.x);   // полоса ходьбы стала короче (прилив) — героиня отходит
      if (Math.abs(cx - rt.hero.x) > 0.5) { rt.reach = null; rt.target = { x: cx, hs: null }; }
      else rt.hero.y = yAt(w, rt.hero.x);
      changed();
    }
    function timerStep(dt) {
      if (!TIMERS.length) return;
      st.tt = st.tt || {};
      TIMERS.forEach(function (T) {
        var f = T.flag, v = !!st.flags[f];
        if (rt.timerSeen[f] !== undefined && rt.timerSeen[f] !== v) st.tt[f] = 0;   // флаг сменило действие (вешка, рычаг) — отсчёт заново
        rt.timerSeen[f] = v;
        if (T.where && T.where.indexOf(st.scene) < 0) return;
        if (T.need && !ok(st, T.need)) return;   // таймер с условием: например, ветер стихает, когда дело сделано
        if (TIMERS_ON) st.tt[f] = (st.tt[f] || 0) + dt;
        if ((st.tt[f] || 0) >= T.every) {
          st.tt[f] = 0; if (st.flags[f]) delete st.flags[f]; else st.flags[f] = true; rt.timerSeen[f] = !!st.flags[f];
          emit('sfx', { name: T.sfx || 'tide' }); emit('timer', { flag: f, on: !!st.flags[f] }); runAutos(); changed(); emit('save', {});
        }
      });
    }
    // «подождать»: таймер сработает на следующем шаге (бот, тесты; в игре — то же, что дождаться)
    function waitTimer(flag) {
      for (var i = 0; i < TIMERS.length; i++) if (TIMERS[i].flag === flag) { if ((TIMERS[i].where && TIMERS[i].where.indexOf(st.scene) < 0) || (TIMERS[i].need && !ok(st, TIMERS[i].need))) return false; st.tt = st.tt || {}; st.tt[flag] = TIMERS[i].every; return true; }
      return false;
    }

    // ---------- ходьба ----------
    function stepHero(tx, dt) {
      var d = tx - rt.hero.x, w = walkOf(sc(), st), sp = AIR && wet(sc()) ? AIR.speed : SPEED;   // под водой шаг медленнее
      if (Math.abs(d) <= sp * dt) rt.hero.x = tx; else rt.hero.x += Math.sign(d) * sp * dt;
      if (d) rt.hero.dir = d < 0 ? -1 : 1;
      rt.hero.y = yAt(w, rt.hero.x); rt.pose = 'walk'; rt.poseT = 0.05;
    }
    function busy() { return !!(rt.cut || rt.cutQ.length || rt.target || rt.reach || rt.travel || rt.surf); }

    // ---------- ввод ----------
    function slotAt(x, y) {
      for (var i = 0; i < LAY.inv.slots; i++) if (inRect(K.ThemeAPI.slotRect(i), x, y)) return i;
      if (rt.pad > 0 && y >= LAY.inv.y - rt.pad * 0.5) {   // тач: крупная зона захвата — вся высота полосы и промежутки между ячейками
        var I = LAY.inv, k = Math.floor((x - I.slot0 + I.gap / 2) / (I.slotW + I.gap));
        if (k >= 0 && k < I.slots) return k;
      }
      return -1;
    }
    // портреты героев (LAYOUT.heroes): только в главах с помощниками, по порядку присоединившихся
    function portraitList() { return MULTI ? HEROES.filter(function (id) { return HL.joined(P, st, id); }) : (canListen() ? ['taya'] : []); }   // без помощников: портрет Таи — только под водой, где есть что слушать
    function portraitAt(x, y) {
      var LH = LAY.heroes; if (!LH || rt.mode !== 'scene' || sc().map) return null;
      var l = portraitList(); for (var i = 0; i < l.length; i++) if (near({ x: LH.x + i * LH.gap, y: LH.y, r: LH.r }, x, y)) return l[i];
      return null;
    }
    function near(b, x, y) { return Math.hypot(x - b.x, y - b.y) <= b.r + 4 + (rt.pad > 0 ? Math.min(12, rt.pad * 0.5) : 0); }
    function tap(x, y) {
      if (rt.cut || rt.cutQ.length) { skipCut(); return; }
      if (rt.surf) return;   // мягкий возврат идёт — ввод ждёт
      if (rt.mode === 'walk') {
        var Lw = LAY.walk;
        if (near(Lw.close, x, y)) closeWalk();
        else if (near(Lw.prev, x, y)) walkFlip(-1);
        else if (near(Lw.next, x, y)) walkFlip(1);
        emit('sfx', { name: 'page' }); return;
      }
      if (rt.mode === 'mini') { if (near(LAY.close, x, y)) { closeMini(); emit('sfx', { name: 'page' }); return; } miniTap(x, y); return; }
      if (rt.overview) { rt.overview = null; emit('sfx', { name: 'page' }); return; }   // обзор сверху закрывается тапом
      if (near(LAY.hint, x, y)) { hint(); emit('sfx', { name: 'hint' }); return; }
      if (near(LAY.book, x, y)) { openWalk(); emit('sfx', { name: 'page' }); return; }
      var pi = portraitAt(x, y);
      if (pi) { if (pi === active()) ability(); else switchTo(pi); return; }   // портрет: другой герой — переключить, активный помощник — умение
      if (y >= LAY.inv.y) {
        var si = slotAt(x, y), item = st.inv[si];
        if (si >= 0 && item) {
          if (rt.sel && rt.sel !== item) { var a = rt.sel; rt.sel = null; combine(a, item); }
          else rt.sel = rt.sel === item ? null : item;
          emit('sfx', { name: 'select' });
        } else rt.sel = null;
        return;
      }
      var h = hsAtTouch(x, y);
      if (MULTI && !sc().map) {   // держащий герой отпускает от любого действия; нажал свою же зону — только отпустил
        var hb = HL.busy(P, st, active());
        if (hb) { releaseHold(hb.id); if (h && h.id === hb.hs && hb.scene === st.scene && !rt.sel) return; }
      }
      if (h && sc().map && !rt.sel) { mapGo(h); return; }
      if (h) { var it = rt.sel; rt.sel = null; approach(h, it); return; }
      rt.sel = null;
      if (sc().map) return;
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
      if (rt.mode === 'walk' && Math.abs(x - p.x0) > 60 && Math.abs(x - p.x0) > Math.abs(y - p.y0) * 1.5) { walkFlip(x < p.x0 ? 1 : -1); emit('sfx', { name: 'page' }); return; }   // свайп — листать
      tap(x, y);
    }
    function drop(item, x, y) {
      if (rt.mode !== 'scene' || rt.cut) return;
      if (MULTI && y < LAY.inv.y) { var hb = HL.busy(P, st, active()); if (hb) releaseHold(hb.id); }
      if (y >= LAY.inv.y) { var si = slotAt(x, y), other = st.inv[si]; if (other && other !== item) combine(item, other); return; }
      var h = hsAtTouch(x, y); if (h) approach(h, item);
    }

    // ---------- цикл ----------
    function update(dt) {
      dt = Math.min(dt, 0.1); rt.time += dt;
      for (var k in rt.thoughts) { rt.thoughts[k].t -= dt; if (rt.thoughts[k].t <= 0) delete rt.thoughts[k]; }
      if (rt.poseT > 0) { rt.poseT -= dt; if (rt.poseT <= 0 && rt.pose !== 'walk') rt.pose = 'idle'; }
      if (st.hintCD > 0) st.hintCD = Math.max(0, st.hintCD - dt);
      if (rt.ptr && !rt.ptr.moved && !rt.ptr.long && rt.time - rt.ptr.t >= LONG_T && rt.ptr.slot < 0 && rt.mode === 'scene') { rt.ptr.long = true; lookAt(rt.ptr.x, rt.ptr.y); }
      if (rt.mode === 'mini' && rt.miniDone && rt.time - rt.miniDone > 0.9) closeMini();
      phaseWatch();
      for (var hp in rt.hpose) if (rt.hpose[hp].until <= rt.time) delete rt.hpose[hp];
      if (rt.trail && rt.time - rt.trail.t0 > TRAIL_T) rt.trail = null;
      if (rt.overview && rt.time - rt.overview.t0 > OVER_T) rt.overview = null;
      partyStep(dt);
      if (WT_) { ringStep(); airStep(dt); if (rt.surf) { surfStep(); return; } }
      if (rt.cut || rt.cutQ.length) { cutStep(dt); return; }
      if (rt.mode === 'scene') timerStep(dt);
      if (rt.travel) { travelStep(dt); return; }
      if (rt.reach) {
        rt.reach.t -= dt;
        if (rt.reach.t <= 0) { var R = rt.reach; rt.reach = null; perform(R.hs, R.item); rt.reachY = null; if (!rt.cut && !rt.cutQ.length) emit('save', {}); }
        return;
      }
      if (rt.target) {
        var t = rt.target;
        if (Math.abs(rt.hero.x - t.x) > 0.5) stepHero(t.x, dt);
        else {
          rt.target = null; if (rt.pose === 'walk') rt.pose = 'idle';
          if (t.hs) {
            var h = hsById(t.hs);
            if (h) {
              var cx = h.rect[0] + h.rect[2] / 2, rT = REACH_T; if (Math.abs(cx - rt.hero.x) > 4) rt.hero.dir = cx < rt.hero.x ? -1 : 1;
              if (active() === 'gull' && !(h.to && !t.item)) {   // чайка взлетает к зоне (и подлетает к ней по горизонтали)
                rt.reachY = Math.max(40, Math.min(rt.hero.y - 10, h.rect[1] + h.rect[3] * 0.5)); rt.reachX = Math.max(30, Math.min(930, cx));
                rT = 0.3 + Math.max(Math.max(0, rt.hero.y - rt.reachY), Math.abs(rt.reachX - rt.hero.x)) / 560;
              }
              rt.reach = { hs: t.hs, item: t.item, t: rT }; pose(h.to && !t.item ? 'walk' : 'reach', rT + 0.1);
            }
          }
        }
      }
    }

    // ---------- модель для отрисовки ----------
    function sceneView() {
      var s = sc(), wv = {}, ph = K.Coast ? K.Coast.phaseOf(s, st) : null;
      P.widgets.forEach(function (w) { if (w.scene === s.id) { var v = WT[w.type].view(w, local(w), st); for (var id in v) wv[id] = v[id]; } });
      var objs = [];
      if (s.map) objs = K.Coast.objects(s.map, st, st.mapAt, rt.token);
      (s.map ? [] : K.Coast ? K.Coast.sceneObjects(s, st) : s.objects).forEach(function (o) {
        if (!ok(st, o.show)) return;
        var state = {}, k;
        if (o.state) for (k in o.state) state[k] = o.state[k];
        if (o.bind) for (k in o.bind) state[k] = Array.isArray(o.bind[k]) ? ok(st, o.bind[k]) : has(st, o.bind[k]);   // список — «и» (поворот крыльев: ветер + парус + нет тормоза)
        if (wv[o.id]) for (k in wv[o.id]) state[k] = wv[o.id][k];
        if (rt.npcPose[o.id]) state.pose = rt.npcPose[o.id];
        if (o.kind === 'npc' && o.state && o.state.type === 'bird' && rt.ring.birds != null) { var dtb = rt.time - rt.ring.birds; state.sing = Math.max(0, 1 - Math.abs(dtb - (+o.id.slice(4) - 1) * 0.32) / 0.3); }
        objs.push({ id: o.id, kind: o.kind, item: o.item, x: o.x, y: o.y, w: o.w, h: o.h, seed: o.seed, state: state });
      });
      var mix = null;
      if (s.phase) { var k = Math.max(0, Math.min(1, (rt.time - rt.phase.t0) / PHASE_T)); mix = ph === s.phase.b ? k : 1 - k; }
      return { id: s.id, w: s.w, h: s.h, mood: s.mood, pal: s.pal, layers: K.Coast ? K.Coast.layersOf(s, ph) : s.layers, objects: objs, hotspots: visibleHs(),
        walk: walkOf(s, st), hero: s.hero, dark: !!(s.darkUnless && !st.flags[s.darkUnless]), phase: ph, phaseMix: mix, map: !!s.map };
    }
    function thoughtsView() {
      var out = [], s = sc();
      for (var who in rt.thoughts) {
        var th = rt.thoughts[who], x, y;
        if (who === 'hero' && s.map && rt.token) { x = rt.token.x; y = rt.token.y - 70; }
        else if (who === 'hero' || (MULTI && rt.pos[who])) { var hp = who === 'hero' ? rt.hero : rt.pos[who], hid = who === 'hero' ? active() : who; x = hp.x; y = (hid === 'gull' ? Math.min(hp.alt == null ? hp.y : hp.alt, hp.y) : hp.y) - (HOFF[hid] || 132); }
        else { var o = s.objects.filter(function (ob) { return ob.id === who; })[0]; if (!o) continue; x = o.x + o.w / 2; y = o.y - 8; }
        var q = { who: who, x: x, y: y, icons: th.icons, age: (th.dur || th.t) - th.t };
        if (th.meta && th.meta.hint) { q.style = 'ink'; q.hint = { target: th.meta.target, scene: th.meta.scene, here: th.meta.here, icons: th.icons, ink: (P.puzzles.filter(function (p) { return p.id === th.meta.target; })[0] || {}).ink || null }; }
        else if (who === 'master' && (rt.cut || rt.cutQ.length)) q.style = 'ink';   // мастер «рисует» мысль тушью
        out.push(q);
      }
      return out;
    }
    function cursorKind() {
      var x = rt.hover.x, y = rt.hover.y;
      if (rt.mode !== 'scene' || rt.cut) return null;
      if (y >= LAY.inv.y || near(LAY.hint, x, y) || near(LAY.book, x, y) || portraitAt(x, y)) return slotAt(x, y) >= 0 && st.inv[slotAt(x, y)] ? 'take' : 'use';
      var h = hsAt(x, y);
      // в мутной воде курсор не выдаёт то, чего не видно: зона дальше круга видимости — как пустое место (тап туда — идти и действовать)
      if (h && WT_ && wet(sc()) && WT_.murky(sc(), st) && Math.hypot(Math.max(h.rect[0] - rt.hero.x, 0, rt.hero.x - h.rect[0] - h.rect[2]), Math.max(h.rect[1] - (rt.hero.y - 70), 0, rt.hero.y - 70 - h.rect[1] - h.rect[3])) > (sc().water.vis || WT_.VIS)) return 'walk';
      if (h) return (rt.sel || rt.drag) ? 'use' : (h.to && !(h.toNeed && !ok(st, h.toNeed)) && h.cursor === 'go' ? 'go' : h.cursor);
      return 'walk';
    }
    // отряд для отрисовки: позы (активный — rt.pose; держащий — поза удержания; кат-сцена может задать heroPose), высота чайки
    function partyView() {
      var a = active(), out = [];
      HEROES.forEach(function (id) {
        var p = rt.pos[id]; if (!p || !presentHere(id)) return;
        var b = HL.busy(P, st, id), ps = id === a ? rt.pose : p.pose;
        if (b && (ps === 'idle' || !ps)) ps = b.pose || 'hold';
        if (rt.hpose[id]) ps = rt.hpose[id].p;
        out.push({ id: id, x: id === 'gull' && p.ax != null ? p.ax : p.x, y: p.y, dir: p.dir || 1, alt: p.alt == null ? p.y : p.alt, pose: ps || 'idle', active: id === a, hold: b ? b.id : null });
      });
      out.sort(function (u, v) { return (u.active ? 1 : 0) - (v.active ? 1 : 0) || (u.id === 'gull') - (v.id === 'gull'); });   // активный — поверх
      return out;
    }
    function model() {
      var mini = rt.mode === 'mini' && rt.mini, w = mini && rt.mini.w;
      var scene = mini ? WT[w.type].scene(w, local(w), rt.time, rt) : sceneView();
      var ui = { mode: rt.cut || rt.cutQ.length ? 'cut' : rt.mode, layout: LAY, inv: st.inv.slice(), sel: rt.sel, drag: rt.drag,
        hover: slotAt(rt.hover.x, rt.hover.y),
        hint: { ready: hintReady(), free: !st.hintFree[st.scene], cd: st.hintCD > 0 ? st.hintCD / HINT_CD : 0 },
        close: !!mini, solvedMini: !!(mini && rt.miniDone), debug: rt.debug, progress: { solved: solvedCount(), total: P.puzzles.length },
        walk: rt.mode === 'walk' ? { page: rt.walk.page, pages: walkPages(), per: walkPer(), steps: openSteps(), total: P.puzzles.length, flip: rt.walk.flip || null, open: rt.walk.open, time: rt.time } : null };
      // портреты: кто здесь, кого сцена не пускает (allowed: false — погашен, значок «нельзя»), кто держит в другой сцене (where — её пиктограмма)
      if (!MULTI && !sc().map && canListen()) ui.heroes = [{ id: 'taya', icon: 'taya', active: true, here: true, busy: false, hold: null, ability: 'ear', allowed: true, where: null }];
      if (MULTI && !sc().map) ui.heroes = portraitList().map(function (id) {
        var b = HL.busy(P, st, id), here = presentHere(id), al = HL.allowed(sc(), id, P), ab = id === active() ? (HL.ABILITY[id] || (id === 'taya' && canListen() ? 'ear' : null)) : null;
        return { id: id, icon: heroIcon(id), active: id === active(), here: here, busy: !!b, hold: b ? b.id : null, ability: ab, allowed: al,
          where: here ? null : b && b.scene !== st.scene && SC[b.scene] ? SC[b.scene].icon : !al ? (wet(sc()) ? 'water' : 'cross') : null };
      });
      return { mode: ui.mode, scene: scene, showHero: !mini && !sc().map, hero: { x: rt.hero.x, y: rt.hero.y, dir: rt.hero.dir, id: active() }, pose: rt.pose,
        party: !mini && MULTI && !sc().map ? partyView() : [], active: active(),
        trail: !mini && rt.trail ? { pts: rt.trail.pts, rect: rt.trail.rect, age: rt.time - rt.trail.t0, dur: TRAIL_T } : null,
        overview: !mini && rt.overview ? { marks: rt.overview.marks, age: rt.time - rt.overview.t0, dur: OVER_T } : null,
        water: !mini && WT_ ? waterView() : null,
        thoughts: mini ? [] : thoughtsView(), ui: ui, cursor: { kind: cursorKind(), x: rt.hover.x, y: rt.hover.y, item: rt.sel },
        light: { x: rt.hero.x, y: rt.hero.y - 60, r: st.inv.indexOf('lantern_lit') >= 0 ? 260 : 70 }, time: rt.time };
    }

    // ---------- сохранение ----------
    function serialize() { st.heroX = Math.round(rt.hero.x); return JSON.stringify(st); }
    function load(json) {
      var o; try { o = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { return false; }
      if (!o || o.v !== SAVE_V || !SC[o.scene] || typeof o.flags !== 'object' || !Array.isArray(o.inv)) return false;
      if (o.inv.some(function (i) { return P.items.indexOf(i) < 0; })) return false;
      if (CH && CH.id && o.ch && o.ch !== CH.id) return false;   // сохранение другой главы
      st = { v: SAVE_V, scene: o.scene, flags: o.flags, inv: o.inv.slice(), local: o.local || {}, heroX: o.heroX || 0, hintFree: o.hintFree || {}, hintCD: +o.hintCD || 0 };
      if (CH && CH.id) st.ch = CH.id;
      if (TIMERS.length) st.tt = o.tt && typeof o.tt === 'object' ? o.tt : {};
      if (o.mapAt) st.mapAt = o.mapAt;
      if (MULTI) st.hero = HEROES.indexOf(o.hero) >= 0 ? o.hero : 'taya';
      if (AIR) { st.air = typeof o.air === 'number' && o.air > 0 ? Math.min(AIR.max, o.air) : AIR.max; st.pocket = o.pocket && SC[o.pocket.scene] ? o.pocket : null; }
      rt = freshRt(); rt.pos.taya = rt.hero;
      if (MULTI && !presentHere(st.hero)) st.hero = HEROES.filter(function (id) { return presentHere(id); })[0] || 'taya';
      placeHero(st.heroX || SC[st.scene].hero.x); placeParty();
      rt.phase = { name: K.Coast ? K.Coast.phaseOf(SC[st.scene], st) : null, t0: -99 };
      if (SC[st.scene].map) { var M = SC[st.scene].map, nn = K.Coast.node(M, st.mapAt) || K.Coast.node(M, M.start); st.mapAt = nn.id; rt.token = { x: nn.x, y: nn.y, dir: 1 }; }
      runAutos(); changed(); return true;
    }
    function start() { go(st.scene, SC[st.scene].hero.x); return api; }

    var api = {
      start: start, update: update, model: model, down: down, move: move, up: up, tap: tap, look: lookAt, hint: hint, combine: combine,
      openWalk: openWalk, closeWalk: closeWalk, closeMini: closeMini, skipCut: skipCut, busy: busy, serialize: serialize, load: load,
      setDebug: function (v) { rt.debug = v == null ? !rt.debug : !!v; return rt.debug; },
      setTouchPad: function (px) { rt.pad = Math.max(0, +px || 0); return rt.pad; },   // тач: увеличенные зоны (логические пиксели), 0 — мышь
      longT: LONG_T,
      ringBirds: function () { rt.ring.birds = rt.time; },
      state: function () { return st; }, runtime: function () { return rt; }, scene: function () { return sc(); },
      hotspot: hsById, hotspotAt: hsAt, slotAt: slotAt, solvedCount: solvedCount, hintTarget: hintTarget, hintIcons: hintIcons, walkSteps: walkSteps, openSteps: openSteps, walkFlip: walkFlip,
      won: function () { return !!st.flags.won; }, data: { scenes: SCN, puzzles: P, map: opts.map || (CH && CH.map) || null }, chapter: CH,
      switchHero: switchTo, cycleHero: cycleHero, ability: ability, sniff: sniff, overview: overview, activeHero: active, heroes: function () { return HEROES.slice(); },
      present: presentHere, releaseHold: releaseHold, portraitAt: portraitAt, portraits: portraitList, multi: MULTI,
      air: function () { return AIR ? { left: st.air, max: AIR.max, speed: AIR.speed, pocket: st.pocket, outs: rt.outs || 0 } : null; }, listen: listen, water: waterView, surfacing: function () { return !!rt.surf; },
      waitTimer: waitTimer, setTimers: function (v) { TIMERS_ON = !!v; return TIMERS_ON; }, mapGo: function (nodeId) { var h = hsById('n_' + nodeId); if (h && sc().map) mapGo(h); return !!h; }
    };
    return api;
  };
})(typeof window !== 'undefined' ? window : globalThis);
