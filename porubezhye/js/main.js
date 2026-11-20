/* ПОРУБЕЖЬЕ · js/main.js — сборка: движок Arcade (меню/пауза/темы/язык/звук/рекорд) + логика (game.js)
   + рендер (render.js) + мышь/тач (mouse.js — копия общего _shared/mouse.js). Здесь — камера, HUD, панель команд, горячие клавиши, отряды. */
(function (global) {
  'use strict';
  var P = global.PORUB, R = P.render, T = P.T, Store = Arcade.Store, CU = P.campUI || null; // CU — кампания (js/campaign-ui.js)
  var W = 1280, H = 720, TOP = 28, PY = 572;
  var VIEW = { sx: 0, sy: TOP, w: W, h: PY - TOP };
  var MINI = { x: 10, y: 580, w: 176, h: 132 };
  var SELP = { x: 198, y: 578, w: 664, h: 138 };
  var CARD = { x: 872, y: 580, bw: 96, bh: 62, gap: 6 };
  var SLOT_KEYS = ['Q', 'W', 'E', 'R', 'A', 'S', 'X', 'F'];
  var RACE_KEY = 'porubezhye.race';

  // темы движка с медным акцентом (вместо синего по умолчанию)
  var THEMES = { modern: Object.assign({}, Arcade.themes.modern, { accent: '#e8913a', bg: '#0f1310' }), retro: Object.assign({}, Arcade.themes.retro) };
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'porubezhye', strings: P.STR, theme: 'modern', lives: 1, themes: THEMES });
  global.PORUB.g = g;
  var race = Store.get(RACE_KEY, 'wright') === 'thicket' ? 'thicket' : 'wright';
  var game = null, cam = { x: 0, y: 0 }, sel = [], groups = {}, mode = null, hover = null, hoverBtn = -1, notices = [], fx = [], pings = [];
  var keys = {}, lastGroupKey = { n: -1, t: 0 }, endT = -1, shotSnd = 0, attackNoteT = -99, preview = null, uiDown = null;

  // ---------- Масштаб canvas под окно (16:9, без прокрутки) ----------
  var cv = g.canvas;
  function fit() { var w = Math.min(innerWidth, innerHeight * W / H); cv.style.width = Math.floor(w) + 'px'; cv.style.height = Math.floor(w * H / W) + 'px'; }
  addEventListener('resize', fit); fit();
  function syncTheme() { document.body.setAttribute('data-theme', g.themeName); }

  // ---------- Меню: выбор расы + подсказки ----------
  g.menu.addItem({ key: 'race', after: 'play', label: function () { return g.t('race') + ': ' + g.t('r_' + race); },
    onSelect: function () { race = race === 'wright' ? 'thicket' : 'wright'; Store.set(RACE_KEY, race); g.audio.beep(700, 0.04); } });
  g.menu.setHint(function () { return [g.t('rd_' + race), { text: g.t('hint1'), dim: true }, { text: g.t('hint2'), dim: true }]; }, 'title');
  g.useStandardScreens({ title: 'ПОРУБЕЖЬЕ', subtitle: P.STR.ru.subtitle, lives: 1 });

  // ---------- Издание (js/edition.js): пункт «Кампания» и экран «Кампания — в полной версии» / «скоро» ----------
  var ED = P.Edition;
  function campTag() { return ED.campTag(P.EDITION, (P.MISSIONS || []).length); }
  // новая вкладка (окно с 'noopener' всегда возвращает null — тогда не понять, открылась ли вкладка); не открылась — переход в этой же
  function openMore() { var url = ED.MORE_URL, w = null; try { w = global.open(url, '_blank'); } catch (e) {} if (w) { try { w.opener = null; } catch (e) {} } else location.href = url; }
  // издание «для площадок» (arcade-full/platform): кампании открываются покупкой внутри площадки (ED.buy); нечего открывать — пункта нет
  if (ED.attach) ED.attach(g);
  function buyLabel() { var pr = ED.price ? ED.price() : ''; return g.t('more') + (pr ? ' · ' + pr : ''); }
  function moreGo() { if (!(ED.canBuy && ED.canBuy())) { openMore(); return; } ED.buy(g).then(function (ok) { g.audio.beep(ok ? 1000 : 200, ok ? 0.15 : 0.06, 'triangle'); if (ok) g.goto('title'); }); }
  if (!(ED.campaignHidden && ED.campaignHidden((P.MISSIONS || []).length)))
    g.menu.addItem({ key: 'campaign', after: 'race', label: function () { var t = campTag(); return g.t('campaign') + (t ? ' · ' + g.t(t) : ''); },
      onSelect: function () { if (campOpen()) CU.openCamp(); else g.goto('edition'); } });
  // кампания играбельна: есть js/campaign-ui.js и миссии, а издание не ставит пометку (в демо — «в полной версии» → экран издания)
  function campOpen() { return !!CU && CU.available() && !campTag(); }
  var pendingMission = null;
  if (CU) CU.install(g, { startMission: function (id) { pendingMission = id; g.goto('play'); }, centerOn: function (x, y) { centerOn(x, y); }, note: function (t, c) { note(t, c); },
    ping: function (x, y) { pings.push({ x: x, y: y, t: g.time }); }, VIEW: VIEW, TOP: TOP, PY: PY });
  var edMenu = new Arcade.Menu([]), edFin = null;
  g.scene('edition', {
    realtime: true,
    enter: function () {
      edFin = ED.finale(P.EDITION);
      edMenu.items = edFin.items.map(function (k) { return { key: k, label: function () { return k === 'more' && ED.canBuy && ED.canBuy() ? buyLabel() : g.t(k); }, onSelect: k === 'more' ? moreGo : function () { g.goto('title'); } }; });
      edMenu.sel = 0; g.audio.beep(520, 0.05);
    },
    update: function () {},
    draw: function (c) {
      this.clear(); var th = this.th(), pw = 700, ph = 300, x0 = W / 2 - pw / 2, y0 = 190;
      c.fillStyle = 'rgba(10,12,16,0.86)'; c.fillRect(x0, y0, pw, ph); c.strokeStyle = th.accent; c.lineWidth = 2; c.strokeRect(x0 + 1, y0 + 1, pw - 2, ph - 2);
      this.text(this.t('campaign').toUpperCase(), W / 2, y0 + 44, { size: 14, align: 'center', color: th.muted, weight: 800 });
      this.text(this.t(edFin.title), W / 2, y0 + 92, { size: 30, align: 'center', color: th.accent, weight: 900 });
      var words = String(this.t(edFin.sub)).split(' '), line = '', y = y0 + 138; c.font = '600 17px ' + th.font;
      words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (c.measureText(t).width > pw - 100 && line) { g.text(line, W / 2, y, { size: 17, align: 'center', weight: 600 }); y += 26; line = w; } else line = t; });
      if (line) g.text(line, W / 2, y, { size: 17, align: 'center', weight: 600 });
      edMenu.draw(this, W / 2, y0 + ph - 70, 36);
    },
    press: function (a) { if (a === 'pause') g.goto('title'); }
  });
  g.scenes.edition._menu = edMenu;

  // фон заставки и финалов — сама карта под тёмной вуалью
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {
    baseClear.call(this, c); syncTheme();
    if (this._sceneName === 'play') return;
    if (!preview) preview = new P.Game({ seed: 1, noAI: true });
    if (this._sceneName === 'camp' || this._sceneName === 'brief' || this._sceneName === 'result') { var cimg = R.terrain(preview, this.themeName); this.ctx.save(); this.ctx.globalAlpha = 0.35; this.ctx.drawImage(cimg, 200, 300, 1280, 720, 0, 0, W, H); this.ctx.restore(); this.ctx.fillStyle = 'rgba(6,8,12,0.7)'; this.ctx.fillRect(0, 0, W, H); return; }
    var ctx = this.ctx, img = R.terrain(preview, this.themeName), sh = Math.sin(this.time * 0.05) * 120;
    ctx.save(); ctx.globalAlpha = 0.55; ctx.drawImage(img, 300 + sh, 200, 1280, 720, 0, 0, W, H); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(6,8,12,0.55)'; ctx.fillRect(0, 0, W, H);
    // по бойцу каждой расы по бокам заставки
    if (this._sceneName === 'title') { R.icon(ctx, preview, 0, 'u', 'walker', 150, 250, 180, this.themeName); }
    ctx.restore();
    if (this._sceneName === 'title') { var pv2 = preview2(); R.icon(ctx, pv2, 0, 'u', 'shell', W - 330, 250, 180, this.themeName); }
  };
  var _pv2 = null; function preview2() { return _pv2 || (_pv2 = new P.Game({ seed: 1, noAI: true, playerRace: 'thicket' })); }

  // ---------- Игра ----------
  function newGame() {
    if (pendingMission && CU) { game = CU.makeGame(pendingMission, onEvent); pendingMission = null; }
    else game = new P.Game({ seed: 1 + ((Math.random() * 4) | 0), playerRace: race, onEvent: onEvent });
    sel = []; groups = {}; mode = null; notices = []; fx = []; pings = []; endT = -1;
    var main = mine('b').filter(function (b) { return b.type === game.race(0).main; })[0] || mine('u').filter(function (u) { return game.def(u).hero; })[0] || mine()[0];
    if (main) centerOn(main.x, main.y);
    g.state.score = 0;
  }
  function pr() { return game ? game.races[0] : race; }  // раса игрока в этой партии (в кампании — раса миссии)
  function mine(kind) { return game.ents.filter(function (e) { return !e.dead && e.owner === 0 && (!kind || e.kind === kind); }); }
  function centerOn(x, y) { cam.x = x - VIEW.w / 2; cam.y = y - VIEW.h / 2; clampCam(); }
  function clampCam() { if (!game) return; cam.x = Math.max(0, Math.min(game.MW * T - VIEW.w, cam.x)); cam.y = Math.max(0, Math.min(game.MH * T - VIEW.h, cam.y)); }
  function toWorld(p) { return { x: p.x - VIEW.sx + cam.x, y: p.y - VIEW.sy + cam.y }; }
  function inView(x, y) { return x >= cam.x && y >= cam.y && x <= cam.x + VIEW.w && y <= cam.y + VIEW.h; }
  function note(text, col) { notices.push({ text: text, t: g.time, col: col }); if (notices.length > 4) notices.shift(); }
  function addFx(f) { f.t = 0; fx.push(f); }
  function nm(e) { return g.t((e.kind === 'u' ? 'u_' : e.kind === 'b' ? 'b_' : 'n_') + e.type); }

  function onEvent(type, d) {
    var p = R.pal(g.themeName);
    if (type === 'deny' && d.p === 0) { note(g.t(d.why === 'supply' ? 'deny_supply_' + pr() : 'deny_' + d.why), 'bad'); g.audio.beep(160, 0.08, 'square', 0.6); }
    else if (type === 'built' && d.p === 0) { var b = game.get(d.id); note(g.t('builtN') + ': ' + g.t('b_' + d.type), 'good'); g.audio.beep(880, 0.08, 'triangle'); g.audio.beep(1320, 0.1, 'triangle'); if (b) addFx({ kind: 'text', x: b.x, y: b.y - 30, dur: 1.4, text: g.t('b_' + d.type), c1: p.sel }); }
    else if (type === 'trained' && d.p === 0) g.audio.beep(660, 0.05, 'triangle', 0.6);
    else if (type === 'shot') { if (inView(d.x, d.y) && g.time - shotSnd > 0.07) { shotSnd = g.time; g.audio.beep(d.type === 'walker' ? 90 : (d.type === 'shooter' ? 300 : 520), 0.03, d.type === 'stinger' ? 'triangle' : 'square', 0.25); } }
    else if (type === 'death') {
      if (d.silent) return;
      var big = d.kind === 'b', vis = game.tileVis(0, Math.floor(d.x / T), Math.floor(d.y / T)) === 2;
      if (vis) addFx({ kind: 'boom', x: d.x, y: d.y, dur: big ? 1.0 : 0.5, r: big ? 60 : 18, seed: Math.random() * 6, c1: big ? '#ffb040' : '#e8d8b0', c2: game.races[d.p] === 'thicket' ? p.moss : p.copper });
      if (vis && inView(d.x, d.y)) g.audio.beep(big ? 70 : 120, big ? 0.3 : 0.1, 'sawtooth', 0.5);
      sel = sel.filter(function (e) { return e.id !== d.id; });
    }
    else if (type === 'hurt' && d.p === 0) {
      if (!inView(d.x, d.y) && g.time - attackNoteT > 8) { attackNoteT = g.time; note(g.t('underAttack'), 'bad'); pings.push({ x: d.x, y: d.y, t: g.time }); g.audio.beep(330, 0.12, 'square'); g.audio.beep(250, 0.16, 'square'); }
    }
    else if (type === 'wave' && d.p === 1) { note(g.t('waveN') + ' · ' + d.size, 'warn'); }
    else if (type === 'banner' && d.p === 0) { note(g.t('bannerUp'), 'good'); g.audio.beep(520, 0.08, 'triangle'); g.audio.beep(780, 0.12, 'triangle'); addFx({ kind: 'ring', x: d.x, y: d.y, dur: 0.8, c1: p.copperHi }); }
    else if (type === 'end') endT = 0;
  }

  // ---------- Выделение и приказы ----------
  function setSel(list, add) {
    list = list.filter(function (e) { return e && !e.dead; });
    if (add) { var ids = new Set(sel.map(function (e) { return e.id; })), all = sel.slice();
      var allIn = list.length && list.every(function (e) { return ids.has(e.id); });
      if (allIn && list.length === 1) all = all.filter(function (e) { return e.id !== list[0].id; }); // Shift-клик по выбранному — снять
      else list.forEach(function (e) { if (!ids.has(e.id) && e.owner === 0 && e.kind === 'u') all.push(e); });
      list = all.length ? all : list; }
    sel = list; mode = null;
    if (sel.length) g.audio.beep(sel[0].owner === 0 ? 760 : 420, 0.03, 'triangle', 0.5);
  }
  function selUnits() { return sel.filter(function (e) { return !e.dead && e.kind === 'u' && e.owner === 0; }); }
  function selBuilding() { return sel.length === 1 && sel[0].kind === 'b' && sel[0].owner === 0 && !sel[0].dead ? sel[0] : null; }
  function ids(list) { return list.map(function (e) { return e.id; }); }

  function worldClick(pt, mods) {
    var w = toWorld(pt), p = R.pal(g.themeName);
    if (mode && mode.t === 'build') { tryPlace(w, mods.shift); return; }
    if (mode && mode.t === 'amove') {
      var us = selUnits(), tg = game.entAt(w.x, w.y, 0);
      if (tg && tg.owner === 1) { game.cmd(0, { t: 'attack', ids: ids(us), target: tg.id }); }
      else game.cmd(0, { t: 'amove', ids: ids(us), x: w.x, y: w.y });
      addFx({ kind: 'ring', x: w.x, y: w.y, dur: 0.5, c1: p.enemy }); g.audio.beep(520, 0.04);
      if (!mods.shift) mode = null; return;
    }
    var e = game.entAt(w.x, w.y, 0);
    if (!e) { if (!mods.shift) sel = []; return; }
    if ((mods.double || mods.ctrl) && e.kind === 'u' && e.owner === 0) { // все такие же на экране
      setSel(game.sameTypeIn(0, e.type, cam.x, cam.y, cam.x + VIEW.w, cam.y + VIEW.h).map(function (id) { return game.get(id); }), mods.shift); return; }
    setSel([e], mods.shift && e.owner === 0 && e.kind === 'u');
  }
  function worldBox(b, mods) {
    var a = toWorld({ x: b.x0, y: Math.max(VIEW.sy, Math.min(PY, b.y0)) }), c = toWorld({ x: b.x1, y: Math.max(VIEW.sy, Math.min(PY, b.y1)) });
    var list = game.selectRect(0, a.x, a.y, c.x, c.y).map(function (id) { return game.get(id); });
    if (!list.length) { if (!mods.shift) sel = []; return; }
    setSel(list, mods.shift);
  }
  function worldRight(pt, info) {
    if (mode) { mode = null; return; }
    var w = toWorld(pt); order(w, game.entAt(w.x, w.y, 0), info);
  }
  function order(w, tg, info) {
    var p = R.pal(g.themeName), b = selBuilding(), us = selUnits();
    if (b && !us.length) { game.cmd(0, { t: 'rally', id: b.id, x: w.x, y: w.y, target: tg ? tg.id : 0 }); addFx({ kind: 'ring', x: w.x, y: w.y, dur: 0.5, c1: p.sel }); g.audio.beep(600, 0.04); return; }
    if (!us.length) return;
    var r = game.cmd(0, { t: 'smart', ids: ids(us), x: w.x, y: w.y, target: tg ? tg.id : 0 }) || { kind: 'move' };
    var col = r.kind === 'attack' ? p.enemy : (r.kind === 'gather' ? p.amber : (r.kind === 'repair' || r.kind === 'build' ? p.copperHi : p.sel));
    addFx({ kind: 'ring', x: tg && r.kind !== 'move' ? tg.x : w.x, y: tg && r.kind !== 'move' ? tg.y : w.y, dur: 0.5, c1: col });
    g.audio.beep(r.kind === 'attack' ? 440 : 560, 0.04, 'triangle');
  }
  function ghostAt(w) { var D = game.race(0).buildings[mode.type], tx = Math.floor(w.x / T - D.s / 2 + 0.5), ty = Math.floor(w.y / T - D.s / 2 + 0.5); var c = game.canPlace(0, mode.type, tx, ty); return { type: mode.type, tx: tx, ty: ty, ok: c.ok, why: c.why }; }
  function tryPlace(w, keep) {
    var gh = ghostAt(w), ws = selUnits().filter(function (u) { return game.def(u).worker; });
    if (!ws.length) { mode = null; return; }
    if (!gh.ok) { onEvent('deny', { p: 0, why: gh.why }); return; }
    // строит ближайший к месту рабочий (Чаща — один жук; Мастеровые — все выбранные рабочие, если их ≤ 3, иначе ближайший)
    var cx = (gh.tx + 1) * T, cy = (gh.ty + 1) * T; ws.sort(function (a, b) { return Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy); });
    var builders = pr() === 'wright' && ws.length <= 3 ? ws : ws.slice(0, 1);
    if (game.cmd(0, { t: 'build', ids: ids(builders), type: gh.type, tx: gh.tx, ty: gh.ty })) { g.audio.beep(500, 0.05, 'triangle'); if (!keep) mode = null; }
  }

  // ---------- Панель команд ----------
  function card() {
    var btn = [], us = selUnits(), b = selBuilding(), Rc = game.race(0), self = game;
    var set = function (slot, o) { btn[slot] = o; };
    var workers = us.filter(function (u) { return game.def(u).worker; });
    if (workers.length) {
      game.buildList(0).forEach(function (type, i) { var D = Rc.buildings[type], lock = D.req && !game.hasDone(0, D.req);
        set(i, { icon: { kind: 'b', type: type }, label: g.t('b_' + type), cost: D.cost, tip: g.t('d_' + type), dis: lock || !game.afford(0, D.cost), act: function () {
          if (lock) return onEvent('deny', { p: 0, why: 'req' }); if (!game.afford(0, D.cost)) return onEvent('deny', { p: 0, why: game.res[0].a < D.cost.a ? 'amber' : 'resin' }); mode = { t: 'build', type: type }; } }); });
    }
    if (us.length) {
      set(4, { glyph: '⚔', label: g.t('attack'), act: function () { mode = { t: 'amove' }; }, on: mode && mode.t === 'amove' });
      set(5, { glyph: '■', label: g.t('stop'), act: function () { game.cmd(0, { t: 'stop', ids: ids(us) }); } });
      // способность героини: знамя Ярины (F)
      var yar = us.filter(function (u) { return game.def(u).ability === 'banner'; })[0];
      if (yar) { var cdl = Math.max(0, (yar.abT || 0) - game.t); set(7, { glyph: cdl > 0 ? String(Math.ceil(cdl)) : '⚑', label: g.t('banner'), tip: g.t('bannerTip'), dis: cdl > 0, act: function () { game.cmd(0, { t: 'banner', id: yar.id }); } }); }
    }
    if (b) {
      var BD = Rc.buildings[b.type], list = (Rc.grow ? (BD.larva ? Object.keys(Rc.units) : []) : (BD.trains || [])).filter(function (k) { return !Rc.units[k].hero && (!game.allowU || game.allowU[k]); });
      if (b.done) list.forEach(function (type, i) { var D = Rc.units[type], why = game.trainBlock(0, b, type);
        set(i, { icon: { kind: 'u', type: type }, label: g.t('u_' + type), cost: D.cost, sup: D.sup, tip: g.t('d_' + type), dis: !!why, act: function () { game.cmd(0, { t: 'train', id: b.id, type: type }); } }); });
      if (!b.done || b.queue.length || b.cocoons.length) set(6, { glyph: '✕', label: g.t('cancel'), act: function () { game.cmd(0, { t: 'cancel', id: b.id }); } });
    }
    return btn;
  }
  function slotRect(i) { var col = i % 4, row = (i / 4) | 0; return { x: CARD.x + col * (CARD.bw + CARD.gap), y: CARD.y + row * (CARD.bh + CARD.gap), w: CARD.bw, h: CARD.bh }; }
  function slotAt(pt) { for (var i = 0; i < 8; i++) { var r = slotRect(i); if (pt.x >= r.x && pt.x < r.x + r.w && pt.y >= r.y && pt.y < r.y + r.h) return i; } return -1; }
  function pressSlot(i) { var c = card()[i]; if (c && c.act) { c.act(); g.audio.beep(700, 0.03, 'triangle', 0.5); } }
  function inR(pt, r) { return pt.x >= r.x && pt.y >= r.y && pt.x < r.x + r.w && pt.y < r.y + r.h; }
  function miniToWorld(pt) { return { x: (pt.x - MINI.x) / MINI.w * game.MW * T, y: (pt.y - MINI.y) / MINI.h * game.MH * T }; }
  function portraitAt(pt) { var n = sel.length; if (n < 2) return -1; var cols = 12, s = 50; for (var i = 0; i < Math.min(n, 24); i++) { var x = SELP.x + 8 + (i % cols) * (s + 4), y = SELP.y + 14 + ((i / cols) | 0) * (s + 10); if (pt.x >= x && pt.x < x + s && pt.y >= y && pt.y < y + s) return i; } return -1; }
  function groupAt(pt) { if (pt.y > TOP) return -1; for (var n = 1; n <= 9; n++) { var x = 360 + (n - 1) * 46; if (pt.x >= x && pt.x < x + 42) return n; } return -1; }

  // ---------- Мышь/тач ----------
  var m = ArcadeMouse.attach(cv, { W: W, H: H,
    enabled: function () { return g._sceneName === 'play' && game && endT < 0; },
    hitUI: function (pt) { return pt.y < TOP || pt.y >= PY; },
    onUi: function (phase, pt, info) {
      if (phase === 'down') uiDown = { pt: pt, slot: slotAt(pt), mini: inR(pt, MINI), btn: info.btn };
      if (!uiDown) return;
      if (uiDown.mini) { var w = miniToWorld({ x: Math.max(MINI.x, Math.min(MINI.x + MINI.w, pt.x)), y: Math.max(MINI.y, Math.min(MINI.y + MINI.h, pt.y)) });
        if (uiDown.btn === 2) { if (phase === 'up') order(w, null, info); } else centerOn(w.x, w.y);
        if (phase === 'up') uiDown = null; return; }
      if (phase !== 'up') return;
      var s = slotAt(pt); if (s >= 0 && s === uiDown.slot) pressSlot(s);
      var pi = portraitAt(pt); if (pi >= 0 && inR(uiDown.pt, SELP)) { var e = sel[pi]; if (info.mods.shift) sel = sel.filter(function (x) { return x !== e; }); else if (info.mods.ctrl) sel = sel.filter(function (x) { return x.type === e.type; }); else sel = [e]; }
      var gn = groupAt(pt); if (gn > 0) { if (info.mods.ctrl || info.btn === 2) assignGroup(gn); else recallGroup(gn); }
      uiDown = null;
    },
    onClick: function (pt, mods) { worldClick(pt, mods); },
    onBox: function () {},
    onBoxEnd: function (b, mods) { if (mode && mode.t === 'build') return; mode = null; worldBox(b, mods); },
    onRight: function (pt, info) { worldRight(pt, info); },
    onWheel: function (dx, dy) { cam.x += dx * 0.9; cam.y += dy * 0.9; clampCam(); },
    onPan: function (dx, dy) { cam.x -= dx; cam.y -= dy; clampCam(); },
    onHover: function () {}
  });
  global.PORUB.mouse = m;
  function updateHover() {
    if (!game || g._sceneName !== 'play') { m.setCursor('default'); return; }
    hoverBtn = m.inside && m.y >= PY ? slotAt(m) : -1; hover = null;
    if (m.y < TOP || m.y >= PY) { m.setCursor(inR(m, MINI) ? 'move' : (hoverBtn >= 0 && card()[hoverBtn] ? 'select' : 'default')); return; }
    if (mode && mode.t === 'build') { m.setCursor('build'); return; }
    if (mode && mode.t === 'amove') { m.setCursor('amove'); return; }
    var w = toWorld(m); hover = game.entAt(w.x, w.y, 0);
    var us = selUnits(), workers = us.filter(function (u) { return game.def(u).worker; });
    if (hover && hover.owner === 1 && us.length) m.setCursor('attack');
    else if (hover && hover.kind === 'n' && workers.length) m.setCursor('gather');
    else if (hover && hover.owner === 0 && workers.length && pr() === 'wright' && (hover.kind === 'b' ? (!hover.done || hover.hp < hover.maxhp) : (game.def(hover).mech && hover.hp < hover.maxhp))) m.setCursor('repair');
    else if (hover) m.setCursor('select');
    else m.setCursor(us.length ? 'move' : 'default');
  }

  // ---------- Клавиатура: отряды, режимы, камера, горячие клавиши ----------
  function assignGroup(n) { var us = sel.filter(function (e) { return e.owner === 0 && !e.dead; }); if (!us.length) return; groups[n] = us.slice(); note(g.t('groupSet') + ' ' + n + ': ' + us.length, 'good'); g.audio.beep(900, 0.04, 'triangle'); }
  function recallGroup(n) {
    var list = (groups[n] || []).filter(function (e) { return !e.dead; }); groups[n] = list; if (!list.length) return;
    var now = Date.now(); if (lastGroupKey.n === n && now - lastGroupKey.t < 400) { var cx = 0, cy = 0; list.forEach(function (e) { cx += e.x; cy += e.y; }); centerOn(cx / list.length, cy / list.length); }
    lastGroupKey = { n: n, t: now }; sel = list.slice(); mode = null;
  }
  addEventListener('keydown', function (e) {
    if (g._sceneName !== 'play' || !game) return;
    var c = e.code;
    if (/^Arrow/.test(c)) keys[c] = true;
    var dm = /^(Digit|Numpad)([1-9])$/.exec(c);
    if (dm) { var n = +dm[2]; e.preventDefault(); if (e.ctrlKey || e.metaKey) assignGroup(n); else if (e.shiftKey) { setSel((groups[n] || []).filter(function (x) { return !x.dead; }), true); } else recallGroup(n); return; }
    if (c === 'Escape' && (mode || sel.length)) { if (mode) mode = null; else sel = []; e.stopImmediatePropagation(); e.preventDefault(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = { KeyQ: 0, KeyW: 1, KeyE: 2, KeyR: 3, KeyA: 4, KeyS: 5, KeyX: 6, KeyF: 7 }[c];
    if (k != null) { pressSlot(k); e.preventDefault(); return; }
    if (c === 'KeyH' || c === 'Home' || c === 'Backspace') { var mb = mine('b').filter(function (b) { return b.type === game.race(0).main; })[0] || mine('b')[0]; if (mb) centerOn(mb.x, mb.y); e.preventDefault(); }
  }, true);
  addEventListener('keyup', function (e) { keys[e.code] = false; });
  addEventListener('blur', function () { keys = {}; });

  // ---------- Сцена игры ----------
  g.scene('play', {
    realtime: false,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); syncTheme(); },
    press: function (a) {
      if (a === 'pause') { this.pause(); return; }
      if (a === 'action' && sel.length) { var cx = 0, cy = 0; sel.forEach(function (e) { cx += e.x; cy += e.y; }); centerOn(cx / sel.length, cy / sel.length); }
    },
    update: function (dt) {
      if (!game) return;
      if (endT >= 0) { endT += dt; if (endT > 1.6) finish(); return; }
      game.update(dt);
      if (CU && game.mission) CU.drain(game);
      var sp = 900 * dt, ed = m.edge(8);
      cam.x += ((keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0) + ed.x) * sp; cam.y += ((keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0) + ed.y) * sp; clampCam();
      for (var i = fx.length - 1; i >= 0; i--) { fx[i].t += dt; if (fx[i].t >= fx[i].dur) fx.splice(i, 1); }
      sel = sel.filter(function (e) { return !e.dead && (e.owner === 0 || game.visibleTo(e, 0)); });
    },
    draw: function (ctx) { draw(ctx); }
  });
  function finish() {
    if (CU && game.mission) { CU.finish(game); return; }
    var won = game.winner === 0, st = game.stats[0];
    g.state.score = st.kills * 10 + st.built * 25 + Math.round(st.gathered / 10) + (won ? Math.max(0, 3000 - Math.round(game.t) * 2) : 0);
    game.lastTime = game.t; if (won) g.win(); else g.gameover();
  }

  // ---------- Отрисовка HUD ----------
  function draw(ctx) {
    g.clear(); updateHover();
    var th = g.th(), p = R.pal(g.themeName), ret = g.themeName === 'retro', font = th.font;
    var ghost = mode && mode.t === 'build' && m.inside && m.y > TOP && m.y < PY ? ghostAt(toWorld(m)) : null;
    R.world(ctx, game, { x: cam.x, y: cam.y, w: VIEW.w, h: VIEW.h, sx: VIEW.sx, sy: VIEW.sy }, g.themeName,
      { t: g.time, sel: sel, selSet: new Set(sel.map(function (e) { return e.id; })), fx: fx, ghost: ghost, under: CU && (game.mission || game.banners.length) ? CU.under(game) : null, over: CU && game.cold > 0 ? CU.over(game, cam, VIEW) : null });
    if (CU && game.mission) CU.hud(ctx, game, VIEW);
    // рамка выделения
    if (m.box) { var b = m.box; ctx.save(); ctx.strokeStyle = p.sel; ctx.lineWidth = 1.5; ctx.fillStyle = ret ? 'rgba(88,248,88,0.10)' : 'rgba(95,211,138,0.12)'; if (!ret) ctx.setLineDash([6, 3]);
      ctx.fillRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0)); ctx.strokeRect(Math.min(b.x0, b.x1) + 0.5, Math.min(b.y0, b.y1) + 0.5, Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0)); ctx.restore(); }
    // верхняя строка
    ctx.fillStyle = p.panel; ctx.fillRect(0, 0, W, TOP); ctx.fillStyle = p.line; ctx.fillRect(0, TOP - 1, W, 1);
    var txt = function (s, x, y, o) { g.text(s, x, y, Object.assign({ size: 13, weight: 700 }, o || {})); };
    txt(g.t('r_' + pr()), 120, 19, { color: p.accent, size: 13, weight: 800 });
    if (CU) CU.topbar(ctx, game, txt);
    for (var n = 1; n <= 9; n++) { var gl = (groups[n] || []).filter(function (e) { return !e.dead; }); if (!gl.length) continue; var gx = 360 + (n - 1) * 46;
      R.prims.box(ctx, gx, 4, 42, 20, ret ? '#2a2230' : 'rgba(255,255,255,0.07)', ret, 5); txt(n + '·' + gl.length, gx + 21, 19, { align: 'center', size: 12, color: p.ink }); }
    var s = game.supply(0), rs = game.res[0], mm = Math.floor(game.t / 60), ss = Math.floor(game.t % 60);
    var rx = W - 560;
    R.prims.oval(ctx, rx, 14, 6, 6, p.amber, ret); txt(Math.floor(rs.a), rx + 12, 19, { color: p.amberHi }); txt(g.t('amber'), rx + 60, 19, { color: th.muted, size: 11, weight: 600 });
    R.prims.oval(ctx, rx + 140, 14, 6, 6, p.resinHi, ret); txt(Math.floor(rs.r), rx + 152, 19, { color: p.resinHi }); txt(g.t('resin'), rx + 196, 19, { color: th.muted, size: 11, weight: 600 });
    R.prims.box(ctx, rx + 270, 9, 10, 10, s.used >= s.cap ? p.hpBad : p.woodHi, ret, 2); txt(s.used + '/' + s.cap, rx + 286, 19, { color: s.used >= s.cap ? p.hpBad : th.ink }); txt(g.t('sup'), rx + 342, 19, { color: th.muted, size: 11, weight: 600 });
    txt((mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss, rx + 450, 19, { color: th.ink });
    // уведомления
    var ny = TOP + 22; notices = notices.filter(function (nt) { return g.time - nt.t < 3.5; });
    notices.forEach(function (nt) { var a = Math.min(1, 3.5 - (g.time - nt.t)); ctx.globalAlpha = a; var col = nt.col === 'bad' ? p.hpBad : (nt.col === 'warn' ? p.hpMid : p.hpGood);
      ctx.font = '800 15px ' + font; var wv = ctx.measureText(nt.text).width + 24; R.prims.box(ctx, W / 2 - wv / 2, ny - 16, wv, 22, 'rgba(0,0,0,0.55)', ret, 6); txt(nt.text, W / 2, ny, { align: 'center', size: 15, weight: 800, color: col }); ny += 26; ctx.globalAlpha = 1; });
    // подсказка режима
    if (mode) { var mh = g.t(mode.t === 'build' ? 'buildHint' : 'amoveHint'); ctx.font = '700 13px ' + font; var mw = ctx.measureText(mh).width + 20; R.prims.box(ctx, W / 2 - mw / 2, PY - 30, mw, 22, 'rgba(0,0,0,0.6)', ret, 6); txt(mh, W / 2, PY - 14, { align: 'center', color: p.ink }); }
    // нижняя панель
    ctx.fillStyle = p.panel; ctx.fillRect(0, PY, W, H - PY); ctx.fillStyle = p.line; ctx.fillRect(0, PY, W, 1);
    if (!ret) { var gr = ctx.createLinearGradient(0, PY, 0, PY + 30); gr.addColorStop(0, 'rgba(232,145,58,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(0, PY + 1, W, 30); }
    R.minimap(ctx, game, MINI, g.themeName, cam, VIEW, pings, g.time);
    drawSel(ctx, p, th, ret, txt);
    drawCard(ctx, p, th, ret, txt);
  }
  function drawSel(ctx, p, th, ret, txt) {
    R.prims.box(ctx, SELP.x, SELP.y, SELP.w, SELP.h, ret ? '#1e1824' : 'rgba(255,255,255,0.035)', ret, 10);
    if (!sel.length) { txt(g.t('hint1'), SELP.x + SELP.w / 2, SELP.y + 60, { align: 'center', color: th.muted, size: 12, weight: 600 }); txt(g.t('hint2'), SELP.x + SELP.w / 2, SELP.y + 82, { align: 'center', color: th.muted, size: 12, weight: 600 }); return; }
    if (sel.length > 1) {
      var cols = 12, s = 50;
      sel.slice(0, 24).forEach(function (e, i) { var x = SELP.x + 8 + (i % cols) * (s + 4), y = SELP.y + 14 + ((i / cols) | 0) * (s + 10);
        R.prims.box(ctx, x, y, s, s, ret ? '#2a2230' : 'rgba(255,255,255,0.06)', ret, 6); R.icon(ctx, game, e.owner, e.kind, e.type, x, y, s, g.themeName);
        var f = e.hp / e.maxhp; R.prims.box(ctx, x + 2, y + s + 2, s - 4, 4, 'rgba(0,0,0,0.6)', true); R.prims.box(ctx, x + 2, y + s + 2, (s - 4) * f, 4, f > 0.6 ? p.hpGood : f > 0.3 ? p.hpMid : p.hpBad, true); });
      if (sel.length > 24) txt('+' + (sel.length - 24), SELP.x + SELP.w - 30, SELP.y + SELP.h - 10, { color: th.muted });
      return;
    }
    var e = sel[0], D = e.kind === 'n' ? null : game.def(e);
    R.prims.box(ctx, SELP.x + 10, SELP.y + 10, 100, 100, ret ? '#2a2230' : 'rgba(255,255,255,0.06)', ret, 10);
    if (e.kind !== 'n') R.icon(ctx, game, e.owner, e.kind, e.type, SELP.x + 10, SELP.y + 10, 100, g.themeName);
    else { ctx.save(); ctx.translate(SELP.x + 60 - e.x, SELP.y + 60 - e.y); R.node(ctx, e, p, ret, g.time); ctx.restore(); }
    var X = SELP.x + 124, Y = SELP.y + 30;
    txt(nm(e), X, Y, { size: 18, weight: 800, color: e.owner === 1 ? p.enemy : p.ink });
    var desc = e.kind === 'n' ? '' : g.t('d_' + e.type); if (e.owner === 1) desc = g.t('r_' + game.races[1]) + ' · ' + desc;
    txt(desc, X, Y + 20, { size: 12, color: th.muted, weight: 600 });
    if (e.kind === 'n') { txt(g.t('left') + ': ' + Math.floor(e.amt), X, Y + 46, { color: p.amberHi }); return; }
    txt(g.t('hp') + ': ' + Math.ceil(e.hp) + ' / ' + e.maxhp, X, Y + 46, { color: p.ink, size: 13 });
    if (e.kind === 'u') {
      txt(g.t('dmg') + ': ' + D.dmg + (D.splash ? ' ✶' : '') + '   ' + g.t('rng') + ': ' + (D.range < 1 ? '—' : D.range) + (D.armor ? '   ⛨ ' + D.armor : ''), X, Y + 66, { color: th.muted, size: 12 });
      if (e.carry) txt(g.t('carry') + ': ' + e.carry.amt + ' ' + g.t(e.carry.type === 'amber' ? 'amber' : 'resin'), X, Y + 86, { color: p.amberHi, size: 12 });
      return;
    }
    if (!e.done) { var gr = game.race(e.owner).grow; txt((gr ? g.t('growing') + (e.planted ? '' : ' · ' + g.t('needPlant')) : g.t('building')) + ': ' + Math.floor(e.prog * 100) + '%', X, Y + 66, { color: p.copperHi, size: 13 }); return; }
    if (e.owner !== 0) return;
    var Rc = game.race(0);
    if (Rc.grow && D.larva) {
      txt(g.t('larva') + ': ' + e.larva + ' / ' + P.consts.LARVA_MAX, X, Y + 66, { color: p.lichen, size: 13 });
      for (var l = 0; l < P.consts.LARVA_MAX; l++) R.prims.oval(ctx, X + 140 + l * 18, Y + 61, 6, 5, l < e.larva ? p.lichen : 'rgba(255,255,255,0.12)', ret);
      e.cocoons.forEach(function (co, i) { var x = X + 280 + i * 50, y = Y + 34; R.prims.box(ctx, x, y, 44, 30, 'rgba(255,255,255,0.06)', ret, 5); R.icon(ctx, game, 0, 'u', co.type, x + 7, y - 2, 30, g.themeName);
        R.prims.box(ctx, x + 2, y + 26, 40 * co.t / Rc.units[co.type].time, 3, p.mossHi, true); });
    } else if (e.queue.length) {
      e.queue.forEach(function (q, i) { var x = X + 280 + i * 50, y = Y + 34; R.prims.box(ctx, x, y, 44, 40, 'rgba(255,255,255,0.06)', ret, 5); R.icon(ctx, game, 0, 'u', q.type, x + 4, y, 36, g.themeName);
        if (i === 0) R.prims.box(ctx, x + 2, y + 36, 40 * q.t / Rc.units[q.type].time, 3, p.accent, true); });
    } else txt(g.t('rallyHint'), X, Y + 66, { color: th.muted, size: 12, weight: 600 });
  }
  function drawCard(ctx, p, th, ret, txt) {
    var btn = card();
    for (var i = 0; i < 8; i++) {
      var r = slotRect(i), c = btn[i], hov = i === hoverBtn;
      R.prims.box(ctx, r.x, r.y, r.w, r.h, c ? (c.on ? (ret ? '#5a3010' : 'rgba(232,145,58,0.30)') : hov ? (ret ? '#3a3040' : 'rgba(255,255,255,0.13)') : (ret ? '#2a2230' : 'rgba(255,255,255,0.07)')) : (ret ? '#18141c' : 'rgba(255,255,255,0.02)'), ret, 8);
      if (!c) continue;
      ctx.globalAlpha = c.dis ? 0.45 : 1;
      if (c.icon) R.icon(ctx, game, 0, c.icon.kind, c.icon.type, r.x + 4, r.y + 2, 40, g.themeName);
      else txt(c.glyph, r.x + 24, r.y + 34, { align: 'center', size: 22, color: i === 4 ? p.enemy : p.ink });
      txt(c.label, r.x + r.w / 2, r.y + r.h - 7, { align: 'center', size: c.label.length > 11 ? 9 : 11, color: p.ink, weight: 700 });
      if (c.cost) { txt(String(c.cost.a), r.x + r.w - 6, r.y + 16, { align: 'right', size: 11, color: p.amberHi }); if (c.cost.r) txt(String(c.cost.r), r.x + r.w - 6, r.y + 30, { align: 'right', size: 11, color: p.resinHi }); }
      ctx.globalAlpha = 1;
      if (!m.pointerType || m.pointerType === 'mouse') { R.prims.box(ctx, r.x + 3, r.y + 3, 16, 16, 'rgba(0,0,0,0.55)', ret, 4); txt(SLOT_KEYS[i], r.x + 11, r.y + 15, { align: 'center', size: 11, color: p.accent }); }
    }
    var hc = hoverBtn >= 0 && btn[hoverBtn];
    if (hc && hc.tip) { var tw = 360, tx = Math.min(W - tw - 8, slotRect(hoverBtn).x - 40), ty = CARD.y - 64;
      R.prims.box(ctx, tx, ty, tw, 56, ret ? '#1b1620' : 'rgba(12,14,20,0.95)', ret, 8); ctx.strokeStyle = p.line; ctx.strokeRect(tx + 0.5, ty + 0.5, tw, 56);
      txt(hc.label + '  [' + SLOT_KEYS[hoverBtn] + ']', tx + 10, ty + 20, { size: 13, color: p.accent, weight: 800 });
      var cs = hc.cost ? hc.cost.a + ' ' + g.t('amber') + (hc.cost.r ? ' · ' + hc.cost.r + ' ' + g.t('resin') : '') + (hc.sup ? ' · ' + hc.sup + ' ' + g.t('sup') : '') : '';
      txt(cs, tx + tw - 10, ty + 20, { size: 11, align: 'right', color: p.amberHi, weight: 700 });
      txt(hc.tip, tx + 10, ty + 42, { size: 12, color: th.ink, weight: 600 }); }
  }

  // HTML-кнопка паузы (тач)
  var bp = document.getElementById('bPause');
  if (bp) bp.addEventListener('click', function () { if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });
  // для автотестов в браузере
  global.PORUB.debug = { get game() { return game; }, card: function () { return card(); }, startMission: function (id) { pendingMission = id; g.goto('play'); }, get sel() { return sel; }, cam: cam, view: VIEW, toWorld: toWorld, get mode() { return mode; }, PY: PY, TOP: TOP, MINI: MINI, slotRect: slotRect };

  g.start('title');
  // ?mission=<id> — сразу брифинг миссии (плейтест полной версии)
  var qm = /[?&]mission=([a-z0-9-]+)/.exec(location.search || ''); if (qm && CU && campOpen()) CU.openBrief(qm[1]);
})(typeof window !== 'undefined' ? window : globalThis);
