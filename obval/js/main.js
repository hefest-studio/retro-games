/* ОБВАЛ · «Крепильщик»: сборка — фреймворк Гефест Arcade (engine.js) + логика (game.js, levels.js) + рендер обеих тем (render.js) + звук + площадка.
   Сцены: title (живая шахта на фоне + меню движка) → levels (выбор шахты, звёзды) → play (одна шахта) → clear (звёзды, дальше) → win (все шахты).
   Ввод: мышь/тач — тронуть крепь (выбить) или пустую клетку у опоры (поставить); стрелки/D-pad выбирают клетку, Пробел/A — действие; Z/X/⌫ — отмена, R — заново, C/H — подсказка.
   Площадка: лидерборд «звёзды», «Без рекламы», подсказка за рекламу (пауза и кнопка ?), adBreak между шахтами. */
(function (global) {
  'use strict';
  var SW = global.OBVAL, R = SW.render, LV = SW.LEVELS, COUNT = LV.length;
  var mig = { migrated: false, oldBest: 0, notice: false };
  try { mig = SW.save.migrate({ get: function (k) { return localStorage.getItem(k); }, set: function (k, v) { localStorage.setItem(k, v); }, del: function (k) { localStorage.removeItem(k); } }); } catch (e) { }
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#10151c', panel: '#1b2430', ink: '#eef3f8', muted: '#93a4b8', accent: '#f0b429', grid: '#34455a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffcc33', muted: '#aaaaaa' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: 450, height: 660, gameId: 'obval', leaderboard: 'obval', strings: SW.STR, theme: 'modern', themes: themes });
  SW.g = g; SW.ui.init(g);
  var pad = document.getElementById('pad'), Store = Arcade.Store;
  var prog = SW.save.Progress({ get: function (k) { return Store.get(k, null); }, set: function (k, v) { g.storeSet(k, v); } }, COUNT);
  g.persist('arcade.best.obval', 'max'); g.persist(SW.save.REACH, 'max');
  for (var li = 1; li <= COUNT; li++) g.persist(SW.save.PREFIX + li, 'max');
  function P() { return R.pal(g); }
  function syncScore() { g.state.score = prog.score(); }

  g.useStandardScreens({ lives: 0 });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  var LB = 'obval';
  function lbSubmit() { var sc = prog.score(); if (sc > 0) g.leaderboard.submit(sc, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: 'obval', label: function () { return g.t('lbAll'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) { syncScore(); g.saveBest(); lbSubmit(); } });   // облако слито: звёзды с другого устройства — в таблицу
  g.useOwnGames(); g.useShortcut(); g.useReview({ minSessions: 3, gap: 3 });
  // награда за рекламу: подсказка (клетка следующего хода) — пункт в паузе; на площадках с рекламой кнопка ? тоже идёт через ролик
  g.useRewardedBonus({ key: 'rwHint', scene: 'pause', once: false, label: function () { return g.t('rwHint'); }, available: function () { return !!game && !game.state().cleared; }, grant: function () { showHint(); } });
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  // ---------- партия ----------
  var game = null, cur = 1, toasts = [], hintCell = -1, hintT = 0, cursor = -1, stuck = false, clearT = -1, lastNew = false, G0 = null;
  function toast(text, color, x, y, size) { toasts.push({ text: text, color: color, x: x, y: y, t: 1.2, size: size }); if (toasts.length > 5) toasts.shift(); }
  function burst(i, color, n) { if (!G0) return; var p = R.cellCenter(G0.geo, i); g.particles.spawn(p.x, p.y, { color: color, count: n, speed: 90, life: 0.5, size: P().pixel ? 4 : 3 }); }
  var fx = [];   // отложенные эффекты (пыль, звук) по кадрам обрушения
  function onEvent(type, d) {
    var pal = P();
    if (type === 'place' || type === 'remove') { SW.sfx(g, type, d); burst(d.cell, pal.wood, 7); }
    else if (type === 'crush' || type === 'fall') { SW.sfx(g, type, d); g.rumble({ ms: 200, strong: 0.5, weak: 0.4 }); if (d.cell != null) burst(d.cell, pal.bad, 12); }
    else if (type === 'save') { SW.sfx(g, 'save', d); if (d.cell != null) { var p = R.cellCenter(G0.geo, d.cell); toast('✓', pal.good, p.x, p.y - 6, 24); } }
    else if (type === 'dead') SW.sfx(g, 'dead', d);
    else if (type === 'clear') {
      var isNew = prog.record(cur, d.stars); prog.reached(Math.min(COUNT, cur + 1)); lastNew = isNew; syncScore(); g.saveBest(); lbSubmit(); clearT = 1.9; hintCell = -1;
      g.rumble({ ms: 160, strong: 0.4, weak: 0.3 });
    } else SW.sfx(g, type, d);
  }
  // после хода: пыль и грохот в клетках, где порода легла (по кадрам анимации)
  function afterAct(res) {
    if (!res || !res.ok || !game) return; var A = game.state().anim; if (!A || !G0) return; var fr = A.frames, first = {}, last = {}, k, id, moved = false;
    for (k = 0; k < fr.length; k++) for (var j = 0; j < fr[k].r.length; j += 2) { id = fr[k].r[j]; var cell = fr[k].r[j + 1]; if (first[id] == null) first[id] = cell; else if (last[id] == null || cell !== last[id].c) { if (cell !== first[id] || last[id]) moved = true; last[id] = { c: cell, f: k }; } }
    if (!moved) return; fx.push({ t: 0, kind: 'rumble' });
    Object.keys(last).forEach(function (key) { fx.push({ t: last[key].f * R.FD + 0.05, kind: 'land', cell: last[key].c }); });
  }
  function updateFx(dt) {
    for (var i = fx.length - 1; i >= 0; i--) { var e = fx[i]; e.t -= dt; if (e.t <= 0) { fx.splice(i, 1); if (e.kind === 'rumble') SW.sfx(g, 'rumble'); else { burst(e.cell, P().pixel ? '#ffaa55' : '#c9ab7c', 8); } } }
  }
  function refreshStuck() { var was = stuck; stuck = !!game && game.stuck(); if (stuck && !was) SW.sfx(g, 'stuck'); }
  function ensureCursor() { if (!game) return; var acts = SW.actions(game.L, curState()); if (!acts.length) { cursor = -1; return; } if (acts.indexOf(cursor) < 0) cursor = hintCellOrFirst(acts); }
  function curState() { return game.state(); }
  function hintCellOrFirst(acts) { return acts[0]; }
  function startLevel(n) { cur = Math.max(1, Math.min(COUNT, n)); g.storeSet(START_KEY, cur); var def = LV[cur - 1]; game = SW.Game({ level: def, par: def.par, onEvent: onEvent }); SW.current = game; G0 = { L: game.L, geo: R.geo(g, game.L) };
    toasts = []; fx = []; hintCell = -1; hintT = 0; stuck = false; clearT = -1; cursor = -1; ensureCursor(); }
  function geoNow() { if (game) G0 = { L: game.L, geo: R.geo(g, game.L) }; return G0; }
  function doAct(i) {
    if (!game || g._sceneName !== 'play' || clearT >= 0) return false; var r = game.act(i);
    if (!r.ok) { SW.sfx(g, 'no'); if (r.why === 'stock' || r.why === 'nofloor' || r.why === 'miner') toast(r.why === 'stock' ? '0' : '✕', P().bad, R.cellCenter(geoNow().geo, i).x, R.cellCenter(G0.geo, i).y, 22); return false; }
    hintCell = -1; afterAct(r); refreshStuck(); ensureCursor(); return true;
  }
  function doUndo() { if (game && g._sceneName === 'play' && clearT < 0 && game.undo()) { hintCell = -1; refreshStuck(); ensureCursor(); } }
  function doRestart() { if (game && g._sceneName === 'play' && clearT < 0) { game.restart(); hintCell = -1; stuck = false; ensureCursor(); } }
  function showHint() { if (!game) return; var h = game.hint(); hintCell = h; hintT = 5; if (h < 0 && !game.state().cleared) { stuck = true; } }
  function askHint() {
    if (!game || g._sceneName !== 'play' || clearT >= 0) return;
    if (g.canRewarded()) { g.rewarded({ reward: function () { showHint(); } }); } else showHint();
  }
  function moveCursor(dx, dy) {
    if (!game) return; var acts = SW.actions(game.L, curState()); if (!acts.length) return; var W = game.L.W;
    if (acts.indexOf(cursor) < 0) { cursor = acts[0]; return; }
    var cx = cursor % W, cy = Math.floor(cursor / W), best = -1, bs = 1e9;
    acts.forEach(function (i) { if (i === cursor) return; var x = i % W - cx, y = Math.floor(i / W) - cy, along = dx ? x * dx : y * dy, across = dx ? Math.abs(y) : Math.abs(x); if (along <= 0) return; var sc = along + across * 2.2; if (sc < bs) { bs = sc; best = i; } });
    if (best >= 0) { cursor = best; g.audio.beep(520, 0.02, 'square', 0.03); }
  }

  // ---------- титул: живая шахта ----------
  var demo = null, demoT = 0, demoStep = 0, demoPath = [], demoDef = 2;
  function makeDemo() { var def = LV[demoDef % Math.min(COUNT, 8)]; demo = SW.Game({ level: def, par: def.par }); demoPath = SW.solve(demo.L).path; demoStep = 0; demoT = 0; demoDef += 1; }
  makeDemo();
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoT += dt; demo.tick(dt); if (demoT > 1.6) { demoT = 0; if (demoStep < demoPath.length) demo.act(demoPath[demoStep++]); else if (demoStep++ > demoPath.length + 2) makeDemo(); } };
  title.draw = function (ctx) {
    var th = this.th(), pal = P(), W = this.W, H = this.H, L = R.land(this), S = demo.state(), dg = { L: demo.L, geo: R.geo(this, demo.L) };
    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H); R.drawBoard(ctx, this, dg, S, null);
    ctx.fillStyle = pal.pixel ? 'rgba(0,0,0,.6)' : 'rgba(10,14,20,.5)'; ctx.fillRect(0, 0, W, H);
    var pw = Math.min(400, W - 30), ph = Math.min(L ? H - 24 : 380, H - 40), px = (W - pw) / 2, py = (H - ph) / 2;
    if (pal.pixel) { ctx.fillStyle = '#000'; ctx.fillRect(px, py, pw, ph); ctx.fillStyle = pal.line; ctx.fillRect(px, py, pw, 4); ctx.fillRect(px, py + ph - 4, pw, 4); ctx.fillRect(px, py, 4, ph); ctx.fillRect(px + pw - 4, py, 4, ph); }
    else { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30; ctx.fillStyle = th.panel; R.rr(ctx, px, py, pw, ph, 18); ctx.fill(); ctx.restore(); ctx.strokeStyle = pal.line; ctx.lineWidth = 1; R.rr(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, 18); ctx.stroke(); }
    this.text(this.t('title'), W / 2, py + (L ? 30 : 46), { size: L ? 34 : 40, align: 'center', color: pal.accent, weight: 900, maxWidth: pw - 30 });
    this.text(this.t('subtitle'), W / 2, py + (L ? 62 : 82), { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 24, minSize: 9 });
    var top = py + (L ? 96 : 132), mf = menuFit(menu, top, 32, top - 6, py + ph - (L ? 34 : 56)); menu.draw(this, W / 2, mf[0], mf[1]);
    var foot = this.t('stars') + ': ' + prog.total() + '/' + COUNT * 3; if (mig.oldBest) foot += ' · ' + this.t('oldBest') + ': ' + mig.oldBest;
    this.text(foot, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 24 });
    if (mig.notice) this.text(this.t('migrated'), W / 2, py + ph + 14, { size: 10, align: 'center', color: pal.good, weight: 700, maxWidth: W - 30 });
    this.text(this.t(this.input.touchOnly ? 'hintTouch' : 'hint0'), W / 2, H - (L ? 4 : 18), { size: 11, align: 'center', color: th.muted, weight: 600, maxWidth: W - 20 });
  };
  // «Играть» — с последней начатой открытой шахты; «Шахты» — выбор из списка
  var START_KEY = 'arcade.obval.start'; g.persist(START_KEY, 'last');
  function startAt() { var v = parseInt(Store.get(START_KEY, '1'), 10) || 1; return prog.unlocked(v) ? v : prog.maxUnlocked(); }
  { var tm = g.menu.get('title'); tm.items[tm.indexOf('play')].onSelect = function () { g.resetRun(); game = null; cur = startAt(); g.goto('play'); }; }
  g.menu.addItem({ key: 'shafts', scene: 'title', after: 'play', label: function () { return g.t('shafts') + ' ' + prog.total() + '/' + COUNT * 3 + ' ★'; }, onSelect: function () { g.resetRun(); g.goto('levels'); } });

  // ---------- выбор шахты ----------
  var sel = 1;
  function cardGeo() {
    var L = g.W > g.H, cols = L ? 8 : 6, rows = Math.ceil(COUNT / cols), mx = L ? 24 : 14, top = L ? 84 : 110, gap = 8, cw = Math.floor((g.W - mx * 2 - gap * (cols - 1)) / cols), ch = L ? 84 : 78;
    return { cols: cols, rows: rows, mx: mx, top: top, gap: gap, cw: cw, ch: ch };
  }
  function cardRect(n) { var C = cardGeo(), k = n - 1, cx = k % C.cols, cy = Math.floor(k / C.cols); return { x: C.mx + cx * (C.cw + C.gap), y: C.top + cy * (C.ch + C.gap), w: C.cw, h: C.ch }; }
  g.scene('levels', {
    realtime: true,
    enter: function () { sel = Math.min(prog.maxUnlocked(), sel || 1); if (cur > 0 && cur <= prog.maxUnlocked()) sel = cur; },
    press: function (a) {
      var C = cardGeo();
      if (a === 'pause') this.goto('title');
      else if (a === 'left') sel = Math.max(1, sel - 1); else if (a === 'right') sel = Math.min(COUNT, sel + 1);
      else if (a === 'up') sel = Math.max(1, sel - C.cols); else if (a === 'down') sel = Math.min(COUNT, sel + C.cols);
      else if (a === 'action' || a === 'start') openLevel(sel);
    },
    draw: function (ctx) {
      var th = this.th(), pal = P(), W = this.W, H = this.H, C = cardGeo();
      ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
      this.text(this.t('shafts'), W / 2, 34, { size: 26, align: 'center', color: pal.accent, weight: 900, maxWidth: W - 40 });
      this.text(this.t('stars') + ': ' + prog.total() + '/' + COUNT * 3, W / 2, C.top - 20, { size: 14, align: 'center', color: th.muted, weight: 700, maxWidth: W - 40 });
      for (var n = 1; n <= COUNT; n++) {
        var r = cardRect(n), open = prog.unlocked(n), st = prog.get(n), on = n === sel;
        ctx.fillStyle = pal.pixel ? '#000' : (open ? th.panel : 'rgba(27,36,48,.45)'); if (pal.pixel) ctx.fillRect(r.x, r.y, r.w, r.h); else { R.rr(ctx, r.x, r.y, r.w, r.h, 10); ctx.fill(); }
        ctx.strokeStyle = on ? pal.accent : pal.line; ctx.lineWidth = on ? 3 : 1; if (pal.pixel) ctx.strokeRect(r.x, r.y, r.w, r.h); else { R.rr(ctx, r.x, r.y, r.w, r.h, 10); ctx.stroke(); }
        this.text(open ? String(n) : '🔒', r.x + r.w / 2, r.y + r.h * 0.38, { size: open ? 26 : 20, align: 'center', color: open ? th.ink : th.muted, weight: 900 });
        if (open) R.drawStars(ctx, pal, r.x + r.w / 2, r.y + r.h * 0.74, Math.min(15, r.w * 0.26), st, Math.min(17, r.w * 0.3));
      }
      this.text(this.t(this.input.touchOnly ? 'hintTouch' : 'hint0'), W / 2, H - 14, { size: 11, align: 'center', color: th.muted, weight: 600, maxWidth: W - 20 });
    }
  });
  function openLevel(n) { if (!prog.unlocked(n)) { g.audio.beep(120, 0.08, 'square', 0.05); return; } cur = n; sel = n; g.goto('play'); }
  g.canvas.addEventListener('mousedown', function (e) { if (g._sceneName === 'levels' && Arcade.touchOk(e)) levelsClick(e); });
  g.canvas.addEventListener('touchstart', function (e) { if (g._sceneName === 'levels') { Arcade.touchOk(e); levelsClick(e.changedTouches[0]); } }, { passive: false });
  function canvasXY(e) { var rc = g.canvas.getBoundingClientRect(); return { x: (e.clientX - rc.left) * g.W / rc.width, y: (e.clientY - rc.top) * g.H / rc.height }; }
  function levelsClick(e) { var p = canvasXY(e); for (var n = 1; n <= COUNT; n++) { var r = cardRect(n); if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) { sel = n; openLevel(n); return; } } }

  // ---------- игровая сцена ----------
  function tutText() {
    if (!game || prog.get(cur) > 0 || cur > 6) return ''; var k = g.input.touchOnly || g.input.device === 'touch' ? '' : 'K';
    return g.t('tut' + k + cur);
  }
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) startLevel(cur); },
    press: function (a) {
      if (a === 'pause') this.pause();
      else if (a === 'left') moveCursor(-1, 0); else if (a === 'right') moveCursor(1, 0); else if (a === 'up') moveCursor(0, -1); else if (a === 'down') moveCursor(0, 1);
      else if ((a === 'action' || a === 'start') && cursor >= 0) doAct(cursor);
    },
    update: function (dt) {
      if (!game) return; game.tick(dt); updateFx(dt);
      var i; for (i = 0; i < toasts.length; i++) toasts[i].t -= dt; toasts = toasts.filter(function (o) { return o.t > 0; });
      if (hintT > 0) { hintT -= dt; if (hintT <= 0) hintCell = -1; }
      if (clearT >= 0) { clearT -= dt; if (clearT < 0) { clearT = -1; this.goto('clear'); } }
    },
    draw: function (ctx) { if (game) drawPlay(ctx, this); else this.clear(); }
  });
  function drawPlay(ctx, gg) {
    var S = game.state(), def = LV[cur - 1], showCur = g.input.device !== 'touch' && !g.input.touchOnly, marks = null;
    if (!S.cleared && !S.dead && S.stock > 0) { marks = new Uint8Array(game.L.N); for (var i = 0; i < game.L.N; i++) marks[i] = SW.canPlace(game.L, S, i) ? 1 : 0; }
    R.draw(ctx, gg, S, geoNow(), { level: cur, count: COUNT, par: def.par, tut: tutText(), hint: hintCell, cursor: showCur && !S.cleared ? cursor : -1, stuck: stuck, toasts: toasts, marks: marks,
      stockTotal: S.stock > 0 || game.L.stock0 > 0 ? Math.min(6, Math.max(game.L.stock0, S.stock)) : 0, pulseTut: cur <= 2 && prog.get(cur) === 0 && S.moves === 0, tutCell: cur <= 2 ? (hintCell >= 0 ? hintCell : -1) : -1, footer: gg.t(gg.input.touchOnly ? 'hintTouch' : 'hint0') });
  }
  // нажатие мышью/пальцем по полю
  function playPointer(e) {
    if (g._sceneName !== 'play' || !game || clearT >= 0) return; var p = canvasXY(e), i = R.cellAt(geoNow().geo, p.x, p.y); if (i < 0) return;
    if (game.L.wall[i]) return; cursor = i; doAct(i);
  }
  g.canvas.addEventListener('mousedown', function (e) { if (Arcade.touchOk(e)) playPointer(e); });
  g.canvas.addEventListener('touchstart', function (e) { if (g._sceneName === 'play') { Arcade.touchOk(e); playPointer(e.changedTouches[0]); } }, { passive: false });
  addEventListener('keydown', function (e) {
    if (e.repeat || g._sceneName !== 'play') { if (g._sceneName === 'clear' && e.code === 'KeyR' && !e.repeat) clearAgain(); return; }
    if (e.code === 'KeyZ' || e.code === 'KeyX' || e.code === 'Backspace') { e.preventDefault(); doUndo(); } else if (e.code === 'KeyR') doRestart(); else if (e.code === 'KeyC' || e.code === 'KeyH') askHint();
  });
  function btn(el, fn) { if (!el) return; var h = function (e) { if (!Arcade.touchOk(e)) return; fn(); }; el.addEventListener('touchstart', h, { passive: false }); el.addEventListener('mousedown', h); }
  btn(pad && pad.querySelector('[data-act="undo"]'), doUndo); btn(pad && pad.querySelector('[data-act="restart"]'), doRestart); btn(pad && pad.querySelector('[data-act="hint"]'), askHint);
  btn(pad && pad.querySelector('[data-pause]'), function () { if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); }, onSelect: function () { if (game) game.restart(); hintCell = -1; stuck = false; ensureCursor(); this.goto('play', { resume: true }); } });
  g.menu.addItem({ key: 'shafts', scene: 'pause', before: 'menu', label: function () { return g.t('shafts'); }, onSelect: function () { this.goto('levels'); } });

  // ---------- шахта пройдена ----------
  function clearAgain() { startLevel(cur); g.goto('play', { resume: true }); }
  function clearNext() {
    if (cur >= COUNT) { syncScore(); g.win(); return; }
    cur += 1; sel = cur; var go = function () { g.goto('play'); }; if (cur >= 3) g.adBreak().then(go, go); else go();
  }
  function clearBtns() { var W = g.W, H = g.H, bw = Math.min(170, (W - 50) / 2), by = H / 2 + (g.W > g.H ? 62 : 74); return [{ x: W / 2 - bw - 8, y: by, w: bw, h: 44, k: 'again' }, { x: W / 2 + 8, y: by, w: bw, h: 44, k: 'next' }]; }
  g.scene('clear', {
    realtime: true,
    enter: function () { this.audio.beep(1200, 0.12, 'triangle'); },
    press: function (a) { if (a === 'action' || a === 'start') clearNext(); else if (a === 'pause') this.goto('levels'); },
    draw: function (ctx) {
      var th = this.th(), pal = P(), W = this.W, H = this.H, S = game ? game.state() : null;
      if (game) drawPlay(ctx, this); ctx.fillStyle = pal.pixel ? 'rgba(0,0,0,.8)' : 'rgba(8,12,18,.72)'; ctx.fillRect(0, 0, W, H);
      this.text(this.t('cleared'), W / 2, H / 2 - 74, { size: 30, align: 'center', color: pal.accent, weight: 900, maxWidth: W - 30 });
      R.drawStars(ctx, pal, W / 2, H / 2 - 20, 44, S ? S.stars : 0, 58);
      this.text(this.t('moves') + ' ' + (S ? S.moves : 0) + ' · ' + this.t('norm') + ' ' + LV[cur - 1].par + (lastNew ? ' · ' + this.t('newStar') : ''), W / 2, H / 2 + 26, { size: 15, align: 'center', color: th.muted, weight: 700, maxWidth: W - 30 });
      clearBtns().forEach(function (b) { var primary = b.k === 'next'; ctx.fillStyle = pal.pixel ? '#000' : (primary ? pal.accent : th.panel); if (pal.pixel) ctx.fillRect(b.x, b.y, b.w, b.h); else { R.rr(ctx, b.x, b.y, b.w, b.h, 12); ctx.fill(); }
        ctx.strokeStyle = primary ? pal.accent : pal.line; ctx.lineWidth = 2; if (pal.pixel) ctx.strokeRect(b.x, b.y, b.w, b.h); else { R.rr(ctx, b.x, b.y, b.w, b.h, 12); ctx.stroke(); }
        g.text(g.t(b.k), b.x + b.w / 2, b.y + 28, { size: 17, align: 'center', color: primary && !pal.pixel ? '#1b1405' : th.ink, weight: 900, maxWidth: b.w - 16 }); });
      this.text(this.t('tapstart'), W / 2, H - 14, { size: 12, align: 'center', color: th.muted, weight: 600 });
    }
  });
  function clearClick(e) { if (g._sceneName !== 'clear') return; var p = canvasXY(e); clearBtns().forEach(function (b) { if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { if (b.k === 'next') clearNext(); else clearAgain(); } }); }
  g.canvas.addEventListener('mousedown', function (e) { if (Arcade.touchOk(e)) clearClick(e); });
  g.canvas.addEventListener('touchstart', function (e) { if (g._sceneName === 'clear') { Arcade.touchOk(e); clearClick(e.changedTouches[0]); } }, { passive: false });

  global.__i18nScenes = ['levels', 'clear'];   // для tools/promo/i18n-overflow.mjs
  g.start('title');
  SW.app = { g: g, prog: prog, game: function () { return game; }, setLevel: function (n) { toasts = []; startLevel(n); g.goto('play', { resume: true }); return game; }, act: doAct, hint: showHint, clear: function () { toasts = []; hintCell = -1; },
    cursor: function (i) { cursor = i; }, openLevels: function () { g.goto('levels'); } };
})(typeof window !== 'undefined' ? window : globalThis);
