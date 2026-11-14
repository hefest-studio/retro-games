/* СБОРКА · сборка: фреймворк Гефест Arcade (engine.js) + логика боя (game.js, maps.js) + рендер/интерфейс.
   Сцены: title (меню: Кампания / Продолжить бой + язык/тема/звук; фон — живая схватка двух ИИ), maps (выбор долины),
   play (бой; конструктор — модальная панель, пока открыта — время стоит), result (итог), pause/win — движок.
   Ввод: мышь (ЛКМ — выбрать робота / тащить обзор, ПКМ — точка охраны, двойной клик — все на экране), клавиши
   WASD/стрелки, 1–5, B, F, X, Q, Tab, пробел; тач — тап/перетаскивание + кнопки .pad. Прогресс — localStorage. */
(function (global) {
  'use strict';
  var SB = global.SBORKA, L = SB.logic, MP = SB.maps, U = SB.ui, Store = Arcade.Store, TS = L.TS;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0f1216', panel: '#161a22', ink: '#eef2f8', muted: '#9aa4b5', accent: '#f2b23a', grid: '#222838' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#f8d838', muted: '#a8a8a8' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: U.W, height: U.H, gameId: 'sborka', strings: SB.STR, theme: 'modern', lives: 1, themes: themes });
  SB.g = g; U.init(g);
  function pal() { return g.themeName === 'retro' ? SB.classic : SB.modern; }
  g.useStandardScreens({ lives: 1 });

  // ---------- Прогресс и сохранение боя ----------
  var SAVE_KEY = 'arcade.sborka.save', BATTLE_KEY = 'arcade.sborka.battle';
  function loadProg() {
    try { var o = JSON.parse(Store.get(SAVE_KEY, '') || 'null'); if (o && o.v === 1 && o.best) return o; } catch (e) {}
    return { v: 1, open: 1, best: {}, done: false, sk: 1 };
  }
  function saveProg() { Store.set(SAVE_KEY, JSON.stringify(prog)); }
  function loadBattle() { try { var o = JSON.parse(Store.get(BATTLE_KEY, '') || 'null'); return o && o.v === 1 && o.S && o.S.phase === 'play' ? o : null; } catch (e) { return null; } }
  function saveBattle() { if (!game || game.state().phase !== 'play' || demoMode) return; try { Store.set(BATTLE_KEY, JSON.stringify({ v: 1, S: game.snapshot() })); } catch (e) {} }
  function clearBattle() { try { localStorage.removeItem(BATTLE_KEY); } catch (e) {} }
  var prog = loadProg();

  var game = null, demoMode = false, cam = { x: 0, y: 0 }, sel = {}, kOpen = false, k = null, toasts = [], banner = 0, guardPick = false, saveT = 0;
  var drag = null, lastTap = { t: 0, x: 0, y: 0 }, touchFire = false, R = null, mapsM = { sel: 0, list: [] };

  function mapName(spec) { return spec.id ? g.t('mapN') + ' ' + spec.id + ' · ' + g.t('m' + spec.id) : g.t('sk') + ' #' + spec.seed; }
  function toast(text, color) { toasts.push({ text: text, color: color, t: 2.6 }); if (toasts.length > 4) toasts.shift(); }

  // ---------- Меню заставки ----------
  function refreshMenu() {
    g.menu.addItem({ key: 'play', index: 0, label: function () { return g.t('campaign'); }, onSelect: function () { openMaps(); } });
    if (loadBattle()) g.menu.addItem({ key: 'cont', after: 'play', label: function () { return g.t('cont'); }, onSelect: function () { var b = loadBattle(); if (b) startBattle(null, b.S); } });
    else g.menu.removeItem('cont');
  }

  // ---------- Выбор карты ----------
  var previews = {};
  function preview(spec) { var key = spec.id + ':' + spec.seed; if (!previews[key]) previews[key] = SB.Game({ spec: spec, startRobots: false }).state(); return previews[key]; }
  function openMaps(selIdx) {
    var list = MP.MAPS.map(function (m) { return { id: m.id, spec: m, name: g.t('m' + m.id), desc: g.t('d' + m.id), locked: m.id > prog.open, best: prog.best[m.id] || 0, lvl: m.lvl }; });
    var sk = MP.skirmish(prog.sk || 1);
    list.push({ id: 0, spec: sk, name: g.t('sk'), desc: g.t('dsk') + ' #' + sk.seed, locked: false, best: prog.best[0] || 0, lvl: sk.lvl });
    list.forEach(function (e) { if (!e.locked) e.preview = preview(e.spec); });
    mapsM = { sel: selIdx != null ? selIdx : Math.min(prog.open, 5) - 1, list: list };
    g.goto('maps');
  }
  function mapsGo() { var e = mapsM.list[mapsM.sel]; if (!e || e.locked) { SB.sfx(g, 'noRes'); return; } startBattle(e.spec); }
  g.scene('maps', {
    realtime: true,
    update: function (dt) { demoStep(Math.min(dt, 0.05)); },
    draw: function (ctx) { drawDemo(ctx); U.maps(g, ctx, pal(), mapsM); },
    press: function (a) {
      if (a === 'up' || a === 'down') { mapsM.sel = (mapsM.sel + (a === 'up' ? -1 : 1) + mapsM.list.length) % mapsM.list.length; SB.sfx(g, 'ui'); }
      else if (a === 'start' || a === 'action') mapsGo();
      else if (a === 'pause') g.goto('title');
      else if (a === 'lang') openMaps(mapsM.sel);
    }
  });

  // ---------- Бой ----------
  function startBattle(spec, restore) {
    demoMode = false;
    game = SB.Game(restore ? { restore: restore, onEvent: onEvent } : { spec: spec, seed: spec.seed + Math.floor(Math.random() * 1000), onEvent: onEvent });
    var S = game.state(); sel = {}; kOpen = false; guardPick = false; toasts = []; banner = restore ? 0 : 5; saveT = 0; touchFire = false;
    var b = game.baseOf(0) || S.factories[0];
    k = { row: 0, tpl: 'scout', d: L.norm(L.TPL.scout), where: b.id, order: 'capture', why: null };
    if (!restore) clearBattle();
    centerCam(); g.state.score = 0;
    g.goto('play');
  }
  function centerCam() {
    var S = game.state(), f = S.poss != null ? game.robot(S.poss) : null, c = f || S.ship;
    cam.x = Math.max(0, Math.min(S.map.w * TS - U.VW, c.x - U.VW / 2));
    cam.y = Math.max(0, Math.min(S.map.h * TS - U.VH, c.y - U.VH / 2));
  }
  function onEvent(type, d) {
    if (demoMode) return;
    var S = game ? game.state() : null; if (!S) return;
    var P = pal(), far = d && d.x != null && (d.x < cam.x - 40 || d.x > cam.x + U.VW + 40 || d.y < cam.y - 40 || d.y > cam.y + U.VH + 40);
    SB.sfx(g, type, Object.assign({ far: far }, d));
    if (type === 'build' && d.side === 0) toast(g.t('toast_build'), P.good);
    else if (type === 'capture') {
      if (d.side === 0) toast(g.t('toast_cap') + ' ' + g.t('f_' + d.type), P.good);
      else if (d.from === 0) toast(g.t('toast_lostF') + ': ' + g.t('f_' + d.type), P.bad);
      else toast(g.t('toast_eCap'), P.warn);
    }
    else if (type === 'core') { if (d.side === 0) toast(d.base ? g.t('toast_baseOff') : g.t('toast_core'), P.accent); else toast(d.base ? g.t('toast_ourBaseOff') : g.t('toast_lostF'), P.bad); }
    else if (type === 'possLost') toast(g.t('toast_possLost'), P.bad);
    else if (type === 'noTarget') toast(g.t('toast_noTarget'), P.bad);
    if ((type === 'kill' || type === 'boom' || type === 'core') && !far) {
      var p = { x: (d.x - cam.x) * U.ZOOM, y: (d.y - cam.y) * U.ZOOM + U.HUD };
      g.particles.spawn(p.x, p.y, { color: type === 'core' ? P.boom[1] : d.side === 0 ? P.team[0] : P.team[1], count: type === 'core' ? 36 : 12, speed: type === 'core' ? 150 : 90, life: 0.6, size: P.pixel ? 4 : 3 });
    }
  }
  function selList() { var S = game.state(), out = []; S.robots.forEach(function (r) { if (sel[r.id] && r.side === 0) out.push(r); }); return out; }
  function prune() { var S = game.state(), alive = {}; S.robots.forEach(function (r) { alive[r.id] = 1; }); for (var id in sel) if (!alive[id]) delete sel[id]; }
  function giveOrder(kind) {
    var S = game.state(), ids = selList().map(function (r) { return r.id; });
    if (!ids.length || S.poss != null) { SB.sfx(g, 'noRes'); return; }
    if (kind === 'guard') {
      if (!guardPick) { guardPick = true; toast(g.t('toast_guardPick'), pal().accent); SB.sfx(g, 'ui'); return; }
      guardPick = false; ids.forEach(function (id) { var r = game.robot(id); game.order([id], 'guard', r.x, r.y); }); return;
    }
    guardPick = false;
    if (kind === 'follow') game.setShip(S.ship.x, S.ship.y);
    game.order(ids, kind);
  }
  function togglePoss() {
    var S = game.state();
    if (S.poss != null) { game.release(); centerCam(); return; }
    var l = selList(); if (l.length !== 1) { SB.sfx(g, 'noRes'); return; }
    game.possess(l[0].id);
  }
  function nextRobot() {
    var S = game.state(), mine = S.robots.filter(function (r) { return r.side === 0; }); if (!mine.length) return;
    var cur = selList()[0], i = cur ? mine.indexOf(cur) : -1, r = mine[(i + 1) % mine.length];
    sel = {}; sel[r.id] = true; game.setShip(r.x, r.y); SB.sfx(g, 'select');
  }
  function selectAll(onScreen) {
    var S = game.state(); sel = {};
    S.robots.forEach(function (r) { if (r.side === 0 && (!onScreen || (r.x > cam.x && r.x < cam.x + U.VW && r.y > cam.y && r.y < cam.y + U.VH))) sel[r.id] = true; });
    SB.sfx(g, 'select');
  }
  // ---------- Конструктор ----------
  function myFactories() { return game.state().factories.filter(function (f) { return f.owner === 0 && f.ruinT <= 0; }); }
  function cycle(list, v, dir) { var i = list.indexOf(v); return list[(i + dir + list.length) % list.length]; }
  var TPLS = Object.keys(L.TPL);
  function kChange(row, dir) {
    var d = k.d;
    if (row === 0) { k.tpl = cycle(TPLS, k.tpl || TPLS[TPLS.length - 1], dir); k.d = L.norm(L.TPL[k.tpl]); k.order = L.TPL_ORDER[k.tpl]; }
    else if (row === 1) d.chassis = cycle(L.CH_LIST, d.chassis, dir);
    else if (row >= 2 && row <= 4) d.w[row - 2] = cycle(L.W_LIST, d.w[row - 2], dir);
    else if (row === 5) d.brain = cycle(L.BR_LIST, d.brain, dir);
    else if (row === 6) { var fs = myFactories().map(function (f) { return f.id; }); if (fs.length) k.where = cycle(fs, fs.indexOf(k.where) >= 0 ? k.where : fs[0], dir); }
    else if (row === 7) k.order = cycle(L.ORDERS, k.order, dir);
    if (row >= 1 && row <= 5) k.tpl = U.tplName(g, k.d) === g.t('k_custom') ? null : TPLS.filter(function (n) { return U.tplName(g, L.TPL[n]) === U.tplName(g, k.d); })[0];
    SB.sfx(g, 'ui'); kCheck();
  }
  function kCheck() {
    var S = game.state(), v = L.validate(k.d), f = S.factories.filter(function (q) { return q.id === k.where; })[0];
    if (!f || f.owner !== 0 || f.ruinT > 0) { var b = game.baseOf(0) || myFactories()[0]; if (b) k.where = b.id; f = b; }
    k.why = !v.ok ? v.why : !f ? 'factory' : S.robots.filter(function (r) { return r.side === 0; }).length >= L.ROBOT_CAP ? 'cap' : !L.canAfford(S.res[0], L.costOf(k.d)) ? 'res' : null;
  }
  function kBuild() {
    kCheck(); if (k.why) { SB.sfx(g, 'noRes'); return; }
    var r = game.build(0, k.d, k.where, k.order);
    if (r.ok) { kOpen = false; sel = {}; sel[r.robot.id] = true; if (k.order === 'guard') game.order([r.robot.id], 'guard', r.robot.x, r.robot.y); }
    else { k.why = r.why; SB.sfx(g, 'noRes'); }
  }
  function kToggle() { if (game.state().phase !== 'play') return; kOpen = !kOpen; guardPick = false; if (kOpen) kCheck(); SB.sfx(g, 'ui'); }

  // ---------- Указатель ----------
  var cv = g.canvas;
  function toCanvas(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * g.W / r.width, y: (e.clientY - r.top) * g.H / r.height }; }
  function toWorld(p) { return { x: p.x / U.ZOOM + cam.x, y: (p.y - U.HUD) / U.ZOOM + cam.y }; }
  function hitAt(p) { for (var i = U.hits.length - 1; i >= 0; i--) { var h = U.hits[i]; if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h; } return null; }
  function inMM(p) { var S = game.state(), m = U.mmRect(S); return p.x >= m.x && p.x <= m.x + m.w && p.y >= m.y && p.y <= m.y + m.h ? { x: (p.x - m.x) / m.sc * TS, y: (p.y - m.y) / m.sc * TS } : null; }
  function doHit(h) {
    var a = h.act;
    if (a === 'order') giveOrder(h.arg);
    else if (a === 'poss') togglePoss();
    else if (a === 'build') kToggle();
    else if (a === 'kPrev' || a === 'kNext') { k.row = h.arg; kChange(h.arg, a === 'kPrev' ? -1 : 1); }
    else if (a === 'kRow') { k.row = h.arg; SB.sfx(g, 'ui'); }
    else if (a === 'kBuild') { k.row = 8; kBuild(); }
    else if (a === 'kOut') { kOpen = false; }
    else if (a === 'map') { if (mapsM.sel === h.arg) mapsGo(); else { mapsM.sel = h.arg; SB.sfx(g, 'ui'); } }
    else if (a === 'mapGo') mapsGo();
    return true;
  }
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  cv.addEventListener('pointerdown', function (e) {
    var sn = g._sceneName, p = toCanvas(e);
    if (sn === 'maps') { e.preventDefault(); var hm = hitAt(p); if (hm) doHit(hm); return; }
    if (sn === 'result') { e.preventDefault(); afterResult(); return; }
    if (sn !== 'play' || !game) return;
    e.preventDefault();
    var h = hitAt(p);
    if (h && h.act !== 'kIn') { doHit(h); return; }
    if (kOpen) return;
    var S = game.state(); if (S.phase !== 'play') return;
    if (p.y < U.HUD || p.y > U.H - U.BAR) return;
    var mm = inMM(p); if (mm) { game.setShip(mm.x, mm.y); if (S.poss == null) centerCam(); return; }
    var w = toWorld(p);
    if (e.button === 2) { var ids = selList().map(function (r) { return r.id; }); if (ids.length && S.poss == null) { game.order(ids, 'guard', w.x, w.y); guardPick = false; } return; }
    if (guardPick) { var ids2 = selList().map(function (r) { return r.id; }); if (ids2.length) game.order(ids2, 'guard', w.x, w.y); guardPick = false; return; }
    var r = game.robotAt(w.x, w.y, 0, e.pointerType === 'mouse' ? 12 : 18), now = performance.now();
    if (r) {
      if (now - lastTap.t < 330 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) { selectAll(true); lastTap.t = 0; return; }
      lastTap = { t: now, x: p.x, y: p.y };
      if (e.shiftKey || e.ctrlKey) { if (sel[r.id]) delete sel[r.id]; else sel[r.id] = true; }
      else { sel = {}; sel[r.id] = true; }
      SB.sfx(g, 'select'); return;
    }
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    drag = { id: e.pointerId, x: p.x, y: p.y, sx: S.ship.x, sy: S.ship.y, moved: false };
  });
  cv.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id || !game) return;
    var p = toCanvas(e), dx = p.x - drag.x, dy = p.y - drag.y;
    if (Math.hypot(dx, dy) > 6) drag.moved = true;
    if (drag.moved && game.state().poss == null) { game.setShip(drag.sx - dx / U.ZOOM, drag.sy - dy / U.ZOOM); centerCam(); }
  });
  function pUp(e) { if (drag && e.pointerId === drag.id) { if (!drag.moved && game && game.state().poss == null && !e.shiftKey) sel = {}; drag = null; } }
  cv.addEventListener('pointerup', pUp); cv.addEventListener('pointercancel', pUp);

  // ---------- Клавиши ----------
  addEventListener('keydown', function (e) {
    if (g._sceneName !== 'play' || !game) return;
    if (e.code === 'Tab') e.preventDefault();
    if (e.repeat) return;
    var c = e.code;
    if (c === 'KeyB') { kToggle(); return; }
    if (kOpen) return;
    var n = { Digit1: 'capture', Digit2: 'robots', Digit3: 'factories', Digit4: 'guard', Digit5: 'follow', Numpad1: 'capture', Numpad2: 'robots', Numpad3: 'factories', Numpad4: 'guard', Numpad5: 'follow' }[c];
    if (n) giveOrder(n);
    else if (c === 'KeyF') togglePoss();
    else if (c === 'KeyX') game.detonate();
    else if (c === 'KeyQ') selectAll(false);
    else if (c === 'Tab') nextRobot();
  });
  // ---------- Тач-кнопки ----------
  var pad = document.querySelector('.pad');
  if (pad) {
    g.input.bindDpad(pad);
    pad.querySelectorAll('[data-act]').forEach(function (b) {
      var a = b.getAttribute('data-act');
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault(); if (g._sceneName !== 'play' || !game) return;
        if (a === 'fire') touchFire = true;
        else if (a === 'build') kToggle();
        else if (a === 'poss') togglePoss();
        else if (a === 'next') nextRobot();
        else if (a === 'core') game.detonate();
      });
      if (a === 'fire') { var off = function () { touchFire = false; }; b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off); }
    });
    var pb = pad.querySelector('[data-pause]');
    if (pb) pb.addEventListener('pointerdown', function (e) { e.preventDefault(); if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });
  }
  addEventListener('blur', function () { touchFire = false; drag = null; });
  addEventListener('pagehide', saveBattle);
  document.addEventListener('visibilitychange', function () { if (document.hidden && (g._sceneName === 'play' || g._sceneName === 'pause')) saveBattle(); });

  // ---------- Сцена боя ----------
  var basePause = g.pause;
  g.pause = function () { saveBattle(); basePause.call(g); };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (d && d.resume && game) return; if (!game || demoMode) { openMaps(); } },
    press: function (a) {
      if (!game) return;
      if (kOpen) {
        if (a === 'pause') { kOpen = false; return; }
        if (a === 'up' || a === 'down') { k.row = (k.row + (a === 'up' ? -1 : 1) + U.K_ROWS) % U.K_ROWS; SB.sfx(g, 'ui'); }
        else if (a === 'left' || a === 'right') { if (k.row < 8) kChange(k.row, a === 'left' ? -1 : 1); }
        else if (a === 'start') kBuild();
        else if (a === 'action') { if (k.row === 8) kBuild(); else kChange(k.row, 1); }
        return;
      }
      if (a === 'pause') { if (guardPick) { guardPick = false; return; } this.pause(); }
      else if (a === 'action' && game.state().poss == null) nextRobot();
    },
    update: function (dt) {
      if (!game) return;
      dt = Math.min(dt, 0.05);
      var S = game.state(), dir = this.input.dir;
      prune();
      if (!kOpen) {
        if (S.poss != null) { game.drive(dir.x, dir.y, this.input.pressed('action') || touchFire); var pr = game.robot(S.poss); if (pr) game.setShip(pr.x, pr.y); }
        else if (dir.x || dir.y) { var l = Math.hypot(dir.x, dir.y); game.setShip(S.ship.x + dir.x / l * 300 * dt, S.ship.y + dir.y / l * 300 * dt); }
        game.update(dt);
        if (!drag || S.poss != null) centerCam();
        if (banner > 0) banner -= dt;
        saveT += dt; if (saveT > 20) { saveT = 0; saveBattle(); }
      } else kCheck();
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      if (S.phase !== 'play' && S.phaseT > 2.6) endBattle();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      var S = game.state();
      U.play(g, ctx, S, pal(), cam, { sel: sel, selList: selList(), time: g.time, toasts: toasts, banner: banner, mapName: mapName(S.spec), kOpen: kOpen, k: k, guardPick: guardPick });
    }
  });
  function endBattle() {
    var S = game.state(), res = S.result, id = S.spec.id, prev = prog.best[id] || 0, newBest = false, campDone = false;
    if (res.won) {
      if (!prev || res.time < prev) { prog.best[id] = Math.round(res.time); newBest = true; }
      if (id && id >= prog.open && id < 5) prog.open = id + 1;
      if (id === 5 && !prog.done) { prog.done = true; campDone = true; }
      if (!id) prog.sk = (prog.sk || 1) + 1;
      g.state.score = (id || 3) * 1000 + Math.max(0, 1500 - Math.round(res.time)); g.saveBest();
    }
    saveProg(); clearBattle();
    R = { won: res.won, how: res.how, time: res.time, best: prog.best[id] || 0, newBest: newBest, built: res.built, lost: res.lost, kills: res.kills, caps: res.caps, mapName: mapName(S.spec), campDone: campDone, id: id };
    game = null; g.goto('result');
  }
  function afterResult() {
    if (!R) { g.goto('title'); return; }
    if (R.campDone) { R = null; g.win(); return; }
    var idx = R.id ? (R.won && R.id < 5 ? R.id : R.id - 1) : 5; R = null; openMaps(idx);
  }
  g.scene('result', {
    realtime: true,
    update: function (dt) { demoStep(Math.min(dt, 0.05)); },
    draw: function (ctx) { drawDemo(ctx); if (R) U.result(g, ctx, pal(), R); },
    press: function (a) { if (a === 'start' || a === 'action' || a === 'pause') afterResult(); }
  });

  // ---------- Заставка: живая схватка двух ИИ ----------
  var demo = null, demoCam = { x: 0, y: 0 }, demoT = 0, demoSeed = 3;
  function newDemo() {
    demo = SB.Game({ spec: MP.skirmish(demoSeed++), aiSides: [0, 1] }); demoT = 0;
    var S = demo.state(); demoCam.x = S.map.w * TS / 2 - U.VW / 2; demoCam.y = S.map.h * TS / 2 - U.VH / 2;
  }
  function demoStep(dt) {
    if (!demo) newDemo();
    var S = demo.state(); demoT += dt;
    if (S.phase !== 'play' || demoT > 200) { newDemo(); S = demo.state(); }
    demo.update(dt);
    // камера медленно ходит за самым горячим местом — центром масс роботов
    if (S.robots.length) {
      var cx = 0, cy = 0; S.robots.forEach(function (r) { cx += r.x; cy += r.y; }); cx /= S.robots.length; cy /= S.robots.length;
      var tx = Math.max(0, Math.min(S.map.w * TS - U.VW, cx - U.VW / 2)), ty = Math.max(0, Math.min(S.map.h * TS - U.VH, cy - U.VH / 2));
      demoCam.x += (tx - demoCam.x) * Math.min(1, dt * 0.6); demoCam.y += (ty - demoCam.y) * Math.min(1, dt * 0.6);
    }
  }
  function drawDemo(ctx) {
    var P = pal(); g.clear();
    if (demo) U.world(g, ctx, demo.state(), P, demoCam, { bare: true, time: g.time });
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.55)' : 'rgba(10,12,16,.55)'; ctx.fillRect(0, 0, g.W, g.H);
  }
  var title = g.scenes.title, menu = title._menu, tEnter = title.enter;
  title.enter = function () { tEnter.call(this); if (game && !demoMode) saveBattle(); game = null; refreshMenu(); g.state.score = 0; };
  title.update = function (dt) { demoStep(Math.min(dt, 0.05)); };
  title.draw = function (ctx) {
    var th = this.th(), P = pal(), W = this.W, H = this.H;
    drawDemo(ctx);
    var pw = 440, ph = 300, px = (W - pw) / 2, py = 70;
    U.panel(ctx, px, py, pw, ph, P, P.accent);
    SB.render.ship(ctx, px + pw / 2, py + 40, P, this.time, 1);
    U.txt(this, this.t('title'), W / 2, py + 108, { size: 56, align: 'center', color: P.accent, weight: 900, shadow: true }, P);
    U.txt(this, this.t('subtitle'), W / 2, py + 132, { size: 11, align: 'center', color: th.muted, weight: 600, up: false }, P);
    menu.draw(this, W / 2, py + 172, 28);
    if (this.state.best) U.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 10, { size: 11, align: 'center', color: th.muted, weight: 600 }, P);
    U.wrap(this, this.t('hintKeys'), W / 2, H - 70, 560, 16, { size: 11, align: 'center', color: P.ink, weight: 700 }, P);
  };
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) { baseClear.call(this, c); if ((this._sceneName === 'win' || this._sceneName === 'gameover') && demo) U.world(this, this.ctx, demo.state(), pal(), demoCam, { bare: true, time: this.time }); };

  refreshMenu();
  g.start('title');
  SB.app = { g: g, game: function () { return game; }, startBattle: startBattle, openMaps: openMaps, prog: function () { return prog; }, cam: cam, sel: function () { return sel; },
    selectAll: selectAll, endBattle: endBattle, setGame: function (x) { game = x; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
