/* МЕДНИЦА · сборка: движок (engine.js) + экономика (econ.js) + сохранение (save.js) + рисунок (render.js).
   Сцены движка: title (меню поверх живой мастерской), play (мастерская + панель), pause. Экономика идёт и за меню.
   Время: g.serverTime() — серверное время площадки (на сайте — часы устройства; защита от перевода часов — в econ.offline). */
(function (global) {
  'use strict';
  var M = global.MEDNITSA, R = M.R, X = M.econ, fill = M.fill, CFG = M.CFG;
  // Высота холста — под экран: телефон в портрете получает длинный список (до 1000), десктоп и ландшафт — 800. Ширина всегда 480.
  function pickH() {
    try { var w = global.innerWidth, h = global.innerHeight; if (!(w > 0 && h > 0) || w > h) return 800; var top = global.Platform && global.Platform.name && global.Platform.name !== 'web' ? 4 : 34; return Math.max(800, Math.min(1000, Math.round(480 * (h - top) / w / 10) * 10)); } catch (e) { return 800; }
  }
  var W = 480, H = pickH(), SCENE_Y = 78, BAR_Y = 436, TAB_Y = 488, LIST_Y = 534, LIST_H = H - LIST_Y - 6, ROW = 68;
  var E = X.Econ(CFG);
  if (typeof document !== 'undefined') {
    var cv0 = document.querySelector('#c'), wrap0 = document.querySelector('.wrap');
    // на площадке ссылки «← Каталог» нет (сборщик убирает) — холст от самого верха
    var top0 = document.querySelector('a.back') && !(global.Platform && global.Platform.name && global.Platform.name !== 'web') ? 34 : 4;
    if (cv0) cv0.height = H; if (wrap0) { wrap0.style.width = 'min(100vw, 480px, calc((100dvh - ' + top0 + 'px) * ' + (480 / H).toFixed(4) + '))'; if (top0 < 10) wrap0.style.marginTop = '0'; }
  }

  // флаги площадки (удалённая конфигурация): частота рекламы и баланс — без перевыпуска игры
  var flagDefaults = { rewarded_idle: '1' }; Object.keys(M.FLAG_KEYS).forEach(function (k) { flagDefaults[k] = ''; });
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#1a120e', panel: '#241813', ink: '#f7ead8', muted: '#b59c86', accent: '#ff9a45', grid: '#4b3427', warn: '#ffb35c', good: '#93d36b' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#fca044', muted: '#bcbcbc', warn: '#fcc838' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'mednitsa', strings: M.STR, theme: 'modern', themes: themes,
    leaderboard: 'mednitsa', flags: flagDefaults, products: { starter: {} },
    autoPause: false });   // idle: экономика идёт сама, за скрытую вкладку — окно «пока вас не было» (econ.offline); экран паузы поверх него не нужен (движок v2.10)
  M.g = g;
  function t(k) { return g.t(k); }
  function lang() { return g.i18n.lang; }
  function fmt(n) { return X.fmt(n, lang()); }
  function fmtT(s) { return X.fmtTime(s, lang()); }
  function P() { return R.PAL[g.themeName === 'retro' ? 'retro' : 'modern']; }

  // ---------- состояние и сохранение ----------
  var store = { get: function (k) { return Arcade.Store.get(k, null); }, set: function (k, v) { Arcade.Store.set(k, v); } };
  var cloud = g.platform ? { peek: function (k) { return g.platform.peek(k); }, save: function (k, v) { return g.platform.save(k, v); } } : null;
  var saver = M.save.Saver(store, cloud);
  var S = E.normalize(saver.local()), played = false;
  M.state = function () { return S; }; M.E = function () { return E; };
  g.onCloud(function () {   // облако слито (на сайте — сразу): берём дальше продвинутую копию
    if (!played) { var b = saver.pick(); if (b) S = E.normalize(b); }
    if (S.marksEver > 0) g.leaderboard.submit(S.marksEver, { board: 'mednitsa' });
  });
  g.flags.ready.then(function () { E = X.Econ(X.applyFlags(CFG, function (k) { return g.flags.get(k); })); });
  function save(force) { try { saver.write(S, g.serverTime(), !!force); if (force && g.platform && g.platform.flush) g.platform.flush(); } catch (e) {} }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(true); });
    global.addEventListener('pagehide', function () { save(true); });
  }

  // ---------- UI-состояние ----------
  var ui = { tab: 'ws', scroll: { ws: 0, up: 0, goals: 0, pr: 0 }, sel: 0, mode: Arcade.Store.get('arcade.mednitsa.mode', '1'), hits: [], dlg: null, queue: [], dsel: 0 };
  ui.mode = ui.mode === 'max' ? 'max' : ui.mode === '10' ? 10 : 1;
  var fx = { pressure: 0, squash: 0, puffs: [], floats: [], toasts: [], time: 0 };
  var sessionSec = 0, saveT = 0, lastAd = -1e12, starterPrice = null, reviewAsked = false;
  var IDS = CFG.WS.map(function (w) { return w.id; });
  function wsName(i) { return t('ws_' + IDS[i]); }
  function canAdIdle() { return g.canRewarded() && g.flags.get('rewarded_idle') !== '0'; }
  function toast(text, col) { fx.toasts.push({ text: text, col: col, t: 2.2 }); if (fx.toasts.length > 3) fx.toasts.shift(); }
  function sfx(kind) {
    var a = g.audio;
    if (kind === 'tap') a.beep(110 + Math.random() * 40, 0.05, 'square', 0.05);
    else if (kind === 'buy') a.beep(660, 0.05, 'triangle');
    else if (kind === 'no') a.beep(150, 0.06, 'sawtooth', 0.04);
    else if (kind === 'coin') { a.beep(880, 0.05, 'triangle'); setTimeout(function () { a.beep(1320, 0.07, 'triangle'); }, 60); }
    else if (kind === 'unlock') [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { a.beep(f, 0.09, 'triangle'); }, i * 90); });
    else if (kind === 'whistle') a.beep(1240, 0.18, 'sine', 0.05);
  }
  function maybeAd() {   // межстраничная — только в паузе по действию игрока, не раньше firstSec сессии и не чаще gapSec
    var c = E.cfg.ads; if (sessionSec < c.firstSec) return false; if (performance.now() - lastAd < c.gapSec * 1000) return false;
    if (!g.adReady()) return false; lastAd = performance.now(); g.adBreak(); return true;
  }
  function watch(reward) {   // ролик за награду: награда — только при досмотре (g.rewarded вызывает reward ровно один раз)
    return g.rewarded({ reward: reward }).then(function (ok) { if (!ok) toast(t('adfail'), P().bad); else sfx('coin'); return ok; });
  }

  // ---------- диалоги ----------
  function openDlg(d) { if (d.type === 'offline') { var q = ui.queue.concat(ui.dlg ? [ui.dlg] : []).filter(function (x) { return x.type === 'offline'; })[0]; if (q) { q.r.gain += d.r.gain; q.r.sec += d.r.sec; q.r.capped = q.r.capped || d.r.capped; return; } }
    if (ui.dlg) ui.queue.push(d); else { ui.dlg = d; ui.dsel = 0; } }
  function closeDlg() { var d = ui.dlg; ui.dlg = ui.queue.shift() || null; ui.dsel = 0; if (d && d.after) d.after(); }
  function dlgButtons(d) {
    var b = [];
    if (d.type === 'offline') {
      b.push({ l1: t('take'), l2: '+' + fmt(d.r.gain), kind: 'buy', fn: function () { E.applyOffline(S, d.r, 1); sfx('coin'); closeDlg(); } });
      if (canAdIdle()) b.push({ l1: fill(t('adx'), { x: 2 }), l2: '+' + fmt(d.r.gain * 2), kind: 'ad', fn: function () { watch(function () { E.applyOffline(S, d.r, 2); d.done = true; }).then(function (ok) { if (ok && ui.dlg === d) closeDlg(); }); } });
    } else if (d.type === 'chest') {
      b.push({ l1: t('take'), l2: '+' + fmt(d.v), kind: 'buy', fn: closeDlg });
      if (canAdIdle()) b.push({ l1: fill(t('adx'), { x: E.cfg.chest.adMult }), l2: '+' + fmt(d.v * E.cfg.chest.adMult), kind: 'ad', fn: function () { watch(function () { E.earn(S, d.v * (E.cfg.chest.adMult - 1)); }).then(function (ok) { if (ok && ui.dlg === d) closeDlg(); }); } });
    } else if (d.type === 'daily') {
      b.push({ l1: t('take'), l2: '+' + fmt(d.d.value), kind: 'gold', fn: function () { var r = E.claimDaily(S, g.serverTime()); if (r) { sfx('coin'); if (r.mark) toast(t('dy_mark'), P().brass); save(true); } closeDlg(); } });
    } else if (d.type === 'unlock') {
      b.push({ l1: t('ok'), kind: 'buy', fn: function () { closeDlg(); maybeAd(); } });
    } else if (d.type === 'prconf') {
      b.push({ l1: t('pr_yes'), l2: '+' + E.prestigeGain(S), kind: 'gold', fn: function () { doPrestige(); } });
      b.push({ l1: t('no'), kind: 'plain', fn: closeDlg });
    } else if (d.type === 'prdone') {
      b.push({ l1: t('ok'), kind: 'buy', fn: function () { closeDlg(); if (!reviewAsked && S.prestiges >= 2 && g.platform) { reviewAsked = true; g.requestReview(); } else maybeAd(); } });
    } else if (d.type === 'wharf') {
      b.push({ l1: t('wh_go'), kind: 'gold', fn: function () { closeDlg(); setView(1); } });
      b.push({ l1: t('later'), kind: 'plain', fn: closeDlg });
    } else if (d.type === 'event') {
      b.push({ l1: t('ok'), kind: 'gold', fn: closeDlg });
    }
    return b;
  }
  function doPrestige() {
    var gain = E.prestige(S); if (!gain) { closeDlg(); return; }
    ui.dlg = null; ui.queue = []; ui.scroll.ws = 0; ui.tab = 'ws'; ui.sel = 0;
    sfx('unlock'); g.particles.spawn(W / 2, SCENE_Y + R.BOILER.y, { color: P().brass, count: 40, speed: 220, life: 1.1, size: 4 });
    g.leaderboard.submit(S.marksEver, { board: 'mednitsa' }); save(true);
    openDlg({ type: 'prdone', gain: gain });
    if (S.wharfNew) { delete S.wharfNew; openDlg({ type: 'wharf' }); save(true); }
  }
  // мастерская на экране: 0 — Медная мастерская (горн), 1 — Речная верфь (когда открыта)
  function setView(v) {
    v = v === 1 && E.wharfOpen(S) ? 1 : 0; if (S.view === v) return;
    S.view = v; if (v) S.wharfSeen = true; ui.scroll.ws = 0; ui.scroll.goals = 0; ui.sel = 0; fx.puffs = []; sfx('whistle');
  }
  function toggleView() { if (E.wharfOpen(S)) setView(S.view ? 0 : 1); else sfx('no'); }
  function claimEvent() { var n = E.claimEvent(S); if (n) { sfx('unlock'); toast(t('ev_done') + ' · ' + fill(t('ev_rw'), { n: fmt(n) }), P().brass); save(true); } else sfx('no'); return n; }
  var evInfo = { on: false, id: '', left: 0 };

  // ---------- действия ----------
  function tapBoiler(x, y) {
    var v = E.tap(S); fx.pressure = Math.min(1, fx.pressure + 0.12); fx.squash = 1;
    fx.floats.push({ text: '+' + fmt(v), x: x + (Math.random() - 0.5) * 30, y: y - 10, t: 1 });
    if (fx.floats.length > 24) fx.floats.shift();
    puff(R.BOILER.x + 53, R.BOILER.y - 64 - 70, 10); if (Math.random() < 0.4) puff(R.BOILER.x - 80, R.BOILER.y - 10, 6);
    g.particles.spawn(x, y, { color: P().glow, count: 4, speed: 90, life: 0.35, size: g.themeName === 'retro' ? 4 : 2 });
    sfx('tap');
  }
  function puff(x, y, r) { fx.puffs.push({ x: x, y: y, r: r, vx: (Math.random() - 0.5) * 14, vy: -26 - Math.random() * 18, t: 1.4, life: 1.4 }); if (fx.puffs.length > 40) fx.puffs.shift(); }
  function buyWs(i) {
    var r = E.buy(S, i, ui.mode); if (!r) { sfx('no'); return false; }
    sfx('buy');
    if (r.first && i > 0) { sfx('unlock'); openDlg({ type: 'unlock', ws: i }); save(true); }
    if (r.milestone) toast(wsName(i) + ': ×2', P().brass);
    return true;
  }
  function buyUp(id) { if (E.buyUp(S, id)) { sfx('buy'); var u = E.up(id); if (u.kind === 'boost' || u.kind === 'cap') save(true); return true; } sfx('no'); return false; }
  function claimGoal(id) { var v = E.claimGoal(S, id); if (v) { sfx('coin'); toast('+' + fmt(v), P().good); save(); } return v; }
  function boost() { if (!canAdIdle()) return; watch(function () { E.boostAdd(S); }); }
  function gift() {
    var d = E.daily(S, g.serverTime()); if (d.ready) openDlg({ type: 'daily', d: d });
    else toast(fill(t('giftIn'), { t: fmtT(giftLeft()) }), P().muted);
  }
  function giftLeft() { var now = g.serverTime(), day = E.dayOf(now); return ((day + 1) * 86400000 - 3 * 3600000 - now) / 1000; }
  function catchChest() {
    var v = E.openChest(S, false); if (!v) return; sfx('coin');
    g.particles.spawn(chestPos().x, SCENE_Y + chestPos().y + 40, { color: P().copperHi, count: 18, speed: 140, life: 0.8, size: 3 });
    if (canAdIdle()) openDlg({ type: 'chest', v: v }); else toast('+' + fmt(v), P().good);
  }
  function chestPos() { var p = 1 - S.chestLive / E.cfg.chest.life; return { x: 540 - p * 600, y: 150 + Math.sin(p * 9) * 8 }; }
  function setTab(k) { if (ui.tab !== k) { ui.tab = k; ui.sel = 0; g.audio.beep(600, 0.03); } }
  function cycleMode() { ui.mode = ui.mode === 1 ? 10 : ui.mode === 10 ? 'max' : 1; Arcade.Store.set('arcade.mednitsa.mode', String(ui.mode)); g.audio.beep(700, 0.03); }
  function buyStarter() { g.purchase('starter').then(function (ok) { if (ok) grantStarter(true); }); }
  function grantStarter(msg) { S.starter = true; if (!S.starterGranted) { S.starterGranted = true; E.earn(S, Math.max(1000, E.baseIncome(S) * CFG.starter.copperSec)); } if (msg) { sfx('unlock'); toast(t('st_done'), P().brass); } save(true); }

  // ---------- время: экономика идёт и за меню ----------
  var ownedT = 0;
  function tick(dt) {
    var now = g.serverTime();
    evInfo = E.eventSync(S, now);   // ярмарка (флаги event_*): множитель и особый заказ
    if (evInfo.on && S.evSeen !== evInfo.id && g._sceneName === 'play') { S.evSeen = evInfo.id; sfx('whistle'); toast(fill(t('ev_pill'), { x: E.cfg.event.mult }) + ' · ' + t('ev_s'), P().fair); }   // без окна: не мешает (окно — по плашке)
    if (S.lastSeen && now - S.lastSeen > 2500) {   // кадры стояли (вкладка скрыта, пауза, реклама, игра закрыта)
      var r = E.offline(S, now);
      if (r.sec > 0) { if (r.gain > 0) openDlg({ type: 'offline', r: r }); }
      else if (r.away > 0) E.advance(S, r.away);    // короткий перерыв (< минуты) — полный доход
    } else {
      var ev = E.advance(S, dt); E.touch(S, now);
      if (ev.chest === 'show') sfx('whistle');
    }
    sessionSec += dt; saveT += dt; if (saveT >= 5) { saveT = 0; save(); }
    ownedT += dt; if (ownedT > 2) { ownedT = 0; if (!S.starter && g.owned('starter')) grantStarter(false); }
    if (typeof document !== 'undefined' && document.body && document.body.getAttribute('data-theme') !== g.themeName) document.body.setAttribute('data-theme', g.themeName);
    fx.time += dt; fx.pressure = Math.max(0, fx.pressure - dt * 0.5); fx.squash = Math.max(0, fx.squash - dt * 7);
    if (Math.random() < dt * (1.2 + fx.pressure * 4 + (S.boostLeft > 0 ? 3 : 0))) puff(R.BOILER.x + 53 + (Math.random() - 0.5) * 8, R.BOILER.y - 64 - 72, 7 + Math.random() * 5);
    for (var i = 0; i < fx.puffs.length; i++) { var p = fx.puffs[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 9; p.t -= dt; }
    fx.puffs = fx.puffs.filter(function (p) { return p.t > 0; });
    fx.floats.forEach(function (f) { f.t -= dt * 0.9; f.y -= dt * 60; }); fx.floats = fx.floats.filter(function (f) { return f.t > 0; });
    fx.toasts.forEach(function (f) { f.t -= dt; }); fx.toasts = fx.toasts.filter(function (f) { return f.t > 0; });
  }

  // ---------- рисование ----------
  var low = null;
  function drawScene(ctx) {
    var pal = P(), v0 = S.view === 1 ? 10 : 0, st = { view: S.view, lv: S.lv.slice(v0, v0 + 10), ids: IDS.slice(v0, v0 + 10), pressure: fx.pressure, squash: fx.squash, boost: S.boostLeft > 0, puffs: fx.puffs, chest: S.chestLive > 0 ? chestPos() : null };
    if (pal.pixel && typeof document !== 'undefined') {   // крупный пиксель: сцена в буфер 240×176 и ×2 без сглаживания
      if (!low) { low = document.createElement('canvas'); low.width = R.SW / 2; low.height = R.SH / 2; }
      var c = low.getContext('2d'); c.setTransform(0.5, 0, 0, 0.5, 0, 0); c.imageSmoothingEnabled = false; R.scene(c, st, fx.time, pal);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(low, 0, SCENE_Y, R.SW, R.SH);
    } else { ctx.save(); ctx.translate(0, SCENE_Y); R.scene(ctx, st, fx.time, pal); ctx.restore(); }
  }
  function hit(x, y, w, h, fn, id) { ui.hits.push({ x: x, y: y, w: w, h: h, fn: fn, id: id }); }
  function drawHud(ctx, pal) {
    R.panel(ctx, 0, 0, W, SCENE_Y, pal, { r: 0, fill: pal.panel, line: false }); ctx.fillStyle = pal.line; ctx.fillRect(0, SCENE_Y - 2, W, 2);
    var cs = fmt(S.copper), sz = g.fitSize(cs, 250, 34, 16, 900, pal.font); ctx.font = '900 ' + sz + 'px ' + pal.font; var tw = ctx.measureText(cs).width;
    R.coin(ctx, W / 2 - tw / 2 - 18, 30, 12, pal);
    g.text(cs, W / 2 + 4, 42, { size: sz, align: 'center', color: pal.ink, weight: 900, font: pal.font });
    var inc = '+' + fmt(E.income(S)) + t('perSec');
    g.text(inc, W / 2, 66, { size: 14, align: 'center', color: S.boostLeft > 0 ? pal.brassHi : pal.muted, weight: 700, font: pal.font, maxWidth: 220 });
    // клейма
    R.mark(ctx, 26, 30, 12, pal); g.text(String(S.marks), 44, 36, { size: 16, color: pal.brass, weight: 900, font: pal.font });
    if (S.marks) g.text('+' + Math.round(S.marks * E.cfg.prestige.bonus * 100) + '%', 14, 62, { size: 11, color: pal.muted, weight: 700, font: pal.font, maxWidth: 90 });
    if (S.starter) g.text('×2', 14 + 70, 62, { size: 11, color: pal.brassHi, weight: 900, font: pal.font });
    // пауза
    ctx.fillStyle = pal.btn; R.circ(ctx, W - 32, 34, 20); ctx.fill(); ctx.strokeStyle = pal.line; ctx.lineWidth = 2; R.circ(ctx, W - 32, 34, 20); ctx.stroke();
    ctx.fillStyle = pal.ink; ctx.fillRect(W - 39, 25, 5, 18); ctx.fillRect(W - 30, 25, 5, 18);
    hit(W - 58, 8, 52, 54, function () { g.pause(); }, 'pause');
  }
  function drawBar(ctx, pal) {
    var y = BAR_Y, h = 46, slots = [];
    if (canAdIdle()) slots.push({ id: 'boost', l1: S.boostLeft > 0 ? fill(t('boostLeft'), { t: fmtT(S.boostLeft) }) : t('boost'), l2: fill(t('boostAd'), { x: Math.round(E.boostSec(S) / 60) }), kind: 'ad', fn: boost, on: S.boostLeft < E.cfg.boost.maxMin * 60 - 30 });
    else if (S.boostLeft > 0) slots.push({ id: 'boost', l1: fill(t('boostLeft'), { t: fmtT(S.boostLeft) }), kind: 'plain', fn: function () {}, on: false });
    var d = E.daily(S, g.serverTime());
    slots.push({ id: 'gift', l1: d.ready ? t('giftReady') : t('gift'), l2: d.ready ? d.streak + '/7' : fmtT(giftLeft()), kind: d.ready ? 'gold' : 'plain', fn: gift, on: true, pulse: d.ready });
    slots.push({ id: 'mode', l1: t('mode'), l2: ui.mode === 'max' ? 'MAX' : '×' + ui.mode, kind: 'plain', fn: cycleMode, on: true });
    if (E.wharfOpen(S)) slots.push({ id: 'view', l1: t('sw_' + (S.view ? 0 : 1)), l2: t('wk_' + (S.view ? 0 : 1)), kind: 'gold', fn: toggleView, on: true, pulse: S.view === 0 && !S.wharfSeen });
    else if (S.prestiges > 0) slots.push({ id: 'view', l1: t('wk_1'), l2: fill(t('wh_lock2'), { n: S.prestiges, x: E.cfg.wharf.unlock }), kind: 'plain', fn: function () { sfx('no'); toast(fill(t('pr_wh'), { n: S.prestiges, x: E.cfg.wharf.unlock }), P().muted); }, on: false });
    var gap = 8, bw = (W - 16 - gap * (slots.length - 1)) / slots.length;
    slots.forEach(function (s, i) {
      var x = 8 + i * (bw + gap), yy = y + (s.pulse ? Math.sin(fx.time * 6) * 1.5 : 0);
      R.button(g, ctx, x, yy, bw, h, s.l1, s.l2, pal, { kind: s.kind === 'plain' ? 'buy' : s.kind, on: s.on, size: slots.length > 3 ? 11 : 12, c2: s.kind === 'ad' ? pal.ad : pal.brassHi, c2off: pal.dim });
      hit(x, y, bw, h, s.fn, s.id);
    });
  }
  var TABS = ['ws', 'up', 'goals', 'pr'];
  function drawTabs(ctx, pal) {
    var tw = (W - 16 - 18) / 4, ready = E.goalsReady(S), afford = E.upsVisible(S).filter(function (u) { return E.upCost(u) <= S.copper; }).length;
    TABS.forEach(function (k, i) {
      var x = 8 + i * (tw + 6), on = ui.tab === k;
      R.panel(ctx, x, TAB_Y, tw, 40, pal, { r: 9, fill: on ? pal.panel2 : pal.panel, line: on ? pal.copper : pal.line });
      g.text(t('tab_' + k), x + tw / 2, TAB_Y + 26, { size: 14, align: 'center', color: on ? pal.ink : pal.muted, weight: 800, font: pal.font, maxWidth: tw - 12, minSize: 9 });
      var badge = k === 'goals' ? ready : k === 'up' ? afford : k === 'pr' && E.canPrestige(S) ? '!' : 0;
      if (badge) { ctx.fillStyle = k === 'goals' ? pal.good : pal.accent; R.circ(ctx, x + tw - 8, TAB_Y + 6, 9); ctx.fill(); g.text(String(badge), x + tw - 8, TAB_Y + 10, { size: 11, align: 'center', color: '#1a120e', weight: 900, font: pal.font }); }
      hit(x, TAB_Y, tw, 40, function () { setTab(k); }, 'tab_' + k);
    });
  }
  // строки текущей вкладки: { h, draw(ctx, y, hot), act() }
  function rows() {
    var out = [], pal = P();
    if (ui.tab === 'ws') {
      var L = E.wsOf(S.view);
      for (var j = 0; j < L.length; j++) { var i = L[j]; if (!E.unlocked(S, i)) break; out.push(wsRow(i)); }
      if (!out.length) out.push({ h: ROW, draw: function (ctx, y) { rowBox(ctx, y, ROW, false, pal); R.machine(ctx, IDS[9], 41, y + 35, 40, fx.time, true, pal);
        g.text(fill(t('wh_need'), { ws: wsName(9) }), 76, y + 40, { size: 13, color: pal.brass, weight: 800, font: pal.font, maxWidth: W - 100, minSize: 8 }); }, act: function () { setView(0); } });
    } else if (ui.tab === 'up') {
      E.upsVisible(S).forEach(function (u) { out.push(upRow(u)); });
      if (!out.length) out.push({ h: ROW, draw: function (ctx, y) { g.text(t('noUps'), W / 2, y + 38, { size: 13, align: 'center', color: pal.muted, weight: 700, font: pal.font, maxWidth: W - 40 }); }, act: null });
    } else if (ui.tab === 'goals') {
      if (evInfo.on && S.ev && !S.ev.done) out.push(eventRow());
      E.activeGoals(S, 3, S.view).forEach(function (a) { out.push(goalRow(a)); });
    } else out.push(prRow());
    if (ui.tab === 'pr' && g.platform && g.platform.payments && g.platform.payments.available && !S.starter) out.push(starterRow());
    return out;
  }
  function rowBox(ctx, y, h, hot, pal) { R.panel(ctx, 8, y + 3, W - 16, h - 6, pal, { r: 10, fill: hot ? pal.panel2 : pal.panel, line: hot ? pal.copperHi : pal.line }); }
  function wsRow(i) {
    var pal = P();
    return { h: ROW, act: function () { buyWs(i); }, draw: function (ctx, y, hot) {
      var lv = S.lv[i], own = lv > 0; rowBox(ctx, y, ROW, hot, pal);
      ctx.fillStyle = pal.night; R.rr(ctx, 16, y + 9, 50, 50, pal.pixel ? 0 : 8); ctx.fill();
      if (own) R.machine(ctx, IDS[i], 41, y + 35, 44, fx.time + i, true, pal); else R.silhouette(ctx, IDS[i], 41, y + 35, 44, 0, pal);
      g.text(wsName(i), 76, y + 27, { size: 15, color: pal.ink, weight: 800, font: pal.font, maxWidth: 190, minSize: 9 });
      var n = ui.mode === 'max' ? Math.max(1, E.maxBuy(S, i)) : ui.mode, cost = E.cost(i, lv, n), can = E.buyCount(S, i, ui.mode) > 0;
      if (own) {
        var nm = E.nextMilestone(lv), prev = 0; CFG.MILESTONES.forEach(function (m) { if (m <= lv) prev = m; });
        R.bar(ctx, 76, y + 35, 160, 5, nm ? (lv - prev) / (nm - prev) : 1, pal, pal.brass);
        g.text(t('lvl') + ' ' + lv + ' · ' + (nm ? fill(t('next2'), { n: nm }) : t('maxed')), 76, y + 54, { size: 11, color: pal.muted, weight: 700, font: pal.font, maxWidth: 170, minSize: 8 });
        g.text('+' + fmt(E.wsIncome(S, i) * E.allMult(S) * E.boostMult(S)) + t('perSec'), 244, y + 41, { size: 11, color: pal.good, weight: 800, font: pal.font, maxWidth: 80, minSize: 8 });
      } else g.text(t('locked') + ' ' + fmt(E.cost(i, 0, 1)), 76, y + 50, { size: 12, color: pal.brass, weight: 700, font: pal.font, maxWidth: 240 });
      R.button(g, ctx, W - 150, y + 9, 134, 50, own ? t('buy') + ' ×' + n : t('buy'), fmt(cost), pal, { on: can, hot: hot, size: 12 });
      hit(W - 150, y + 9, 134, 50, function () { buyWs(i); }, 'ws' + i);
    } };
  }
  function upText(u) {
    var p = { x: u.x, p: Math.round(u.x * 100) };
    if (u.kind === 'ws') return { name: t('up_' + u.id.replace(/\d+$/, '')) , eff: fill(t('e_ws'), { ws: wsName(u.ws), x: u.x }) };
    return { name: t('up_' + u.id), eff: fill(t('e_' + u.kind), p) };
  }
  M.upText = upText;
  function upRow(u) {
    var pal = P();
    return { h: ROW, act: function () { buyUp(u.id); }, draw: function (ctx, y, hot) {
      rowBox(ctx, y, ROW, hot, pal); var tx = upText(u), cost = E.upCost(u), can = S.copper >= cost;
      if (u.kind === 'ws') { ctx.fillStyle = pal.night; R.rr(ctx, 16, y + 9, 50, 50, pal.pixel ? 0 : 8); ctx.fill(); R.machine(ctx, IDS[u.ws], 41, y + 35, 40, 0, true, pal); R.blueprint(ctx, 58, y + 52, 18, 'ws', pal); }
      else R.blueprint(ctx, 41, y + 34, 46, u.kind, pal);
      g.text(tx.name, 76, y + 28, { size: 14, color: pal.ink, weight: 800, font: pal.font, maxWidth: 240, minSize: 9 });
      g.text(tx.eff, 76, y + 50, { size: 12, color: pal.good, weight: 700, font: pal.font, maxWidth: 240, minSize: 8 });
      R.button(g, ctx, W - 150, y + 9, 134, 50, t('buy'), fmt(cost), pal, { on: can, hot: hot, size: 12 });
      hit(W - 150, y + 9, 134, 50, function () { buyUp(u.id); }, 'up_' + u.id);
    } };
  }
  function goalText(gl) {
    var o = { n: gl.type === 'earn' ? fmt(gl.n) : gl.n, ws: gl.ws != null ? wsName(gl.ws) : '' };
    if (gl.type === 'lv') return fill(t(gl.n === 1 ? 'g_open' : 'g_lv'), o);
    return fill(t('g_' + gl.type), o);
  }
  M.goalText = goalText;
  function goalRow(a) {
    var pal = P();
    return { h: ROW, act: function () { if (a.done) claimGoal(a.goal.id); }, draw: function (ctx, y, hot) {
      rowBox(ctx, y, ROW, hot, pal);
      ctx.fillStyle = a.done ? pal.good : pal.copperLo; R.rr(ctx, 16, y + 13, 42, 42, pal.pixel ? 0 : 21); ctx.fill();
      if (a.goal.type === 'lv') R.machine(ctx, IDS[a.goal.ws], 37, y + 34, 34, 0, true, pal); else R.coin(ctx, 37, y + 34, 11, pal);
      g.text(goalText(a.goal), 70, y + 28, { size: 13, color: pal.ink, weight: 800, font: pal.font, maxWidth: 250, minSize: 8 });
      R.bar(ctx, 70, y + 38, 180, 6, a.p / a.n, pal, a.done ? pal.good : pal.copper);
      g.text((a.goal.type === 'earn' ? fmt(a.p) + ' / ' + fmt(a.n) : Math.floor(a.p) + ' / ' + a.n), 70, y + 58, { size: 11, color: pal.muted, weight: 700, font: pal.font, maxWidth: 180 });
      R.button(g, ctx, W - 150, y + 9, 134, 50, t('take'), '+' + fmt(a.reward), pal, { on: a.done, hot: hot, size: 12, kind: a.done ? 'gold' : 'buy', c2off: pal.dim });
      hit(W - 150, y + 9, 134, 50, function () { if (a.done) claimGoal(a.goal.id); else sfx('no'); }, 'goal_' + a.goal.id);
    } };
  }
  function eventRow() {
    var pal = P();
    return { h: ROW, act: claimEvent, draw: function (ctx, y, hot) {
      var ev = S.ev, done = E.eventReady(S); rowBox(ctx, y, ROW, hot, pal);
      R.panel(ctx, 8, y + 3, 5, ROW - 6, pal, { r: 2, fill: pal.fair, line: false });
      ctx.fillStyle = done ? pal.good : pal.copperLo; R.rr(ctx, 16, y + 13, 42, 42, pal.pixel ? 0 : 21); ctx.fill(); R.mark(ctx, 37, y + 34, 13, pal);
      g.text(fill(t('ev_goal'), { n: fmt(ev.need) }), 70, y + 28, { size: 13, color: pal.fair, weight: 800, font: pal.font, maxWidth: 250, minSize: 8 });
      R.bar(ctx, 70, y + 38, 180, 6, ev.got / ev.need, pal, done ? pal.good : pal.fair);
      g.text(fmt(Math.min(ev.got, ev.need)) + ' / ' + fmt(ev.need) + ' · ' + fmtT(evInfo.left), 70, y + 58, { size: 11, color: pal.muted, weight: 700, font: pal.font, maxWidth: 180, minSize: 8 });
      R.button(g, ctx, W - 150, y + 9, 134, 50, t('take'), fill(t('ev_rw'), { n: fmt(E.eventMarks(S)) }), pal, { on: done, hot: hot, size: 12, kind: done ? 'gold' : 'buy', c2off: pal.dim });
      hit(W - 150, y + 9, 134, 50, function () { if (E.eventReady(S)) claimEvent(); else sfx('no'); }, 'event');
    } };
  }
  function prRow() {
    var pal = P(), h = E.wharfOpen(S) ? 196 : 218;
    return { h: h, act: function () { if (E.canPrestige(S)) openDlg({ type: 'prconf' }); else sfx('no'); }, draw: function (ctx, y, hot) {
      rowBox(ctx, y, h, hot, pal); var pc = Math.round(E.cfg.prestige.bonus * 100);
      R.mark(ctx, 44, y + 40, 20, pal);
      g.text(fill(t('pr_now'), { n: S.marks, p: Math.round(S.marks * pc) }), 76, y + 46, { size: 14, color: pal.brass, weight: 900, font: pal.font, maxWidth: W - 100, minSize: 9 });
      [t('pr_1'), t('pr_2'), fill(t('pr_3'), { p: pc })].forEach(function (s, k) { g.text(s, 24, y + 82 + k * 18, { size: 13, color: pal.muted, weight: 600, font: pal.font, maxWidth: W - 48, minSize: 8 }); });
      if (!E.wharfOpen(S)) g.text(fill(t('pr_wh'), { n: S.prestiges, x: E.cfg.wharf.unlock }), 24, y + 200, { size: 12, color: pal.teal, weight: 800, font: pal.font, maxWidth: W - 48, minSize: 8 });
      var gain = E.prestigeGain(S), can = E.canPrestige(S);
      var l2 = can ? '+' + gain : fill(t('pr_need'), { n: fmt(E.earnForGain(S)), x: E.cfg.prestige.minGain });
      R.button(g, ctx, 24, y + 134, W - 48, 50, can ? fill(t('pr_gain'), { n: gain }) : t('tab_pr'), l2, pal, { on: can, hot: hot, kind: 'gold', size: 14, c2off: pal.muted });
      hit(24, y + 134, W - 48, 50, function () { if (E.canPrestige(S)) openDlg({ type: 'prconf' }); else sfx('no'); }, 'prestige');
    } };
  }
  function starterRow() {
    var pal = P();
    return { h: ROW, act: buyStarter, draw: function (ctx, y, hot) {
      rowBox(ctx, y, ROW, hot, pal); R.mark(ctx, 41, y + 34, 18, pal);
      g.text(t('st_t'), 76, y + 28, { size: 14, color: pal.brassHi, weight: 900, font: pal.font, maxWidth: 240 });
      g.text(t('st_b'), 76, y + 50, { size: 11, color: pal.muted, weight: 700, font: pal.font, maxWidth: 240, minSize: 8 });
      R.button(g, ctx, W - 150, y + 9, 134, 50, t('buy'), starterPrice || '…', pal, { on: true, hot: hot, kind: 'gold', size: 12 });
      hit(W - 150, y + 9, 134, 50, buyStarter, 'starter');
    } };
  }
  var curRows = [];
  function maxScroll() { var h = 0; curRows.forEach(function (r) { h += r.h; }); return Math.max(0, h - LIST_H); }
  function drawList(ctx, pal) {
    curRows = rows(); if (ui.sel >= curRows.length) ui.sel = Math.max(0, curRows.length - 1);
    var sc = ui.scroll[ui.tab] = Math.max(0, Math.min(ui.scroll[ui.tab], maxScroll()));
    ctx.save(); ctx.beginPath(); ctx.rect(0, LIST_Y, W, LIST_H); ctx.clip();
    var y = LIST_Y - sc, h0 = ui.hits.length;
    curRows.forEach(function (r, k) { if (y + r.h > LIST_Y - 2 && y < LIST_Y + LIST_H) r.draw(ctx, y, k === ui.sel && ui.kb); y += r.h; });
    ctx.restore();
    // кнопки списка за краем видимой области не нажимаются
    for (var i = h0; i < ui.hits.length; i++) { var hb = ui.hits[i]; if (hb.y < LIST_Y || hb.y + hb.h > LIST_Y + LIST_H + 2) { ui.hits.splice(i, 1); i--; } }
    var ms = maxScroll(); if (ms > 0) { var th = LIST_H * LIST_H / (LIST_H + ms); ctx.fillStyle = pal.line; ctx.fillRect(W - 4, LIST_Y + (LIST_H - th) * sc / ms, 3, th); }
  }
  function drawDlg(ctx, pal) {
    var d = ui.dlg; if (!d) return;
    ctx.fillStyle = 'rgba(8,5,3,.72)'; ctx.fillRect(0, 0, W, H);
    var b = dlgButtons(d), x = 36, w = W - 72, h = 250 + b.length * 62, y = Math.max(90, (H - h) / 2);
    R.panel(ctx, x, y, w, h, pal, { r: 18, fill: pal.panel, line: pal.copper, shadow: true });
    ctx.fillStyle = pal.copper; ctx.fillRect(x + 20, y + 52, w - 40, 2);
    var title = '', lines = [], cy = y + 128;
    if (d.type === 'offline') {
      title = t('off_t'); var rate = Math.round(E.offRate(S) * 100);
      lines.push(rate === 50 ? fill(t('off_b'), { t: fmtT(d.r.sec) }) : fill(t('off_rate'), { t: fmtT(d.r.sec), p: rate }));
      if (d.r.capped) lines.push({ s: fill(t('off_cap'), { cap: fmtT(E.capSec(S)) }), c: pal.brass });
      R.coin(ctx, W / 2 - 22, cy - 6, 20, pal); R.coin(ctx, W / 2 + 14, cy + 4, 24, pal); R.coin(ctx, W / 2 - 4, cy - 26, 16, pal);
    } else if (d.type === 'chest') {
      title = t('ch_t'); lines.push(t('ch_b')); R.airship(ctx, W / 2, cy - 40, fx.time, pal);
    } else if (d.type === 'daily') {
      title = fill(t('dy_t'), { d: d.d.streak }); lines.push(t('dy_b')); if (d.d.mark) lines.push({ s: t('dy_mark'), c: pal.brass });
      ctx.fillStyle = pal.copper; ctx.fillRect(W / 2 - 30, cy - 30, 60, 50); ctx.fillStyle = pal.brass; ctx.fillRect(W / 2 - 34, cy - 40, 68, 14); ctx.fillRect(W / 2 - 6, cy - 40, 12, 60);
      for (var k = 0; k < 7; k++) { ctx.fillStyle = k < d.d.streak ? pal.brass : pal.btnOff; R.circ(ctx, W / 2 - 66 + k * 22, cy + 40, 7); ctx.fill(); }
    } else if (d.type === 'unlock') {
      title = t('un_t'); lines.push(fill(t('un_b'), { ws: wsName(d.ws) })); lines.push({ s: t('un_s'), c: pal.muted });
      R.machine(ctx, IDS[d.ws], W / 2, cy - 10, 104, fx.time, true, pal);
    } else if (d.type === 'prconf') {
      title = t('pr_t'); lines.push(fill(t('pr_conf'), { n: E.prestigeGain(S) })); lines.push({ s: t('pr_1') + ' ' + t('pr_2'), c: pal.muted });
      R.mark(ctx, W / 2, cy - 10, 36, pal);
    } else if (d.type === 'wharf') {
      title = t('wh_t'); lines.push(t('wh_b')); lines.push({ s: fill(t('wh_s'), { ws: wsName(9) }), c: pal.muted });
      R.machine(ctx, 'wheel', W / 2 - 50, cy - 10, 80, fx.time, true, pal); R.machine(ctx, 'tug', W / 2 + 50, cy - 6, 80, fx.time, true, pal);
    } else if (d.type === 'event') {
      title = t('ev_t'); lines.push(fill(t('ev_b'), { x: E.cfg.event.mult })); lines.push({ s: t('ev_s'), c: pal.fair });
      R.mark(ctx, W / 2, cy - 10, 36, pal); R.coin(ctx, W / 2 - 60, cy, 18, pal); R.coin(ctx, W / 2 + 60, cy, 18, pal);
    } else if (d.type === 'prdone') {
      title = fill(t('pr_done'), { n: d.gain }); lines.push(fill(t('pr_now'), { n: S.marks, p: Math.round(S.marks * E.cfg.prestige.bonus * 100) }));
      R.mark(ctx, W / 2, cy - 10, 40, pal);
    }
    g.text(title, W / 2, y + 38, { size: 22, align: 'center', color: pal.accent, weight: 900, font: pal.font, maxWidth: w - 30, minSize: 11 });
    lines.forEach(function (ln, k) { var s = typeof ln === 'string' ? ln : ln.s; g.text(s, W / 2, y + 196 + k * 22, { size: 14, align: 'center', color: ln.c || pal.ink, weight: 700, font: pal.font, maxWidth: w - 30, minSize: 8 }); });
    if (ui.dsel >= b.length) ui.dsel = 0;
    b.forEach(function (bt, k) {
      var by = y + 250 + k * 62, bx = x + 24, bw = w - 48;
      R.button(g, ctx, bx, by, bw, 54, bt.l1, bt.l2, pal, { kind: bt.kind === 'plain' ? 'buy' : bt.kind, hot: ui.kb && k === ui.dsel, size: 14, c2: bt.kind === 'ad' ? pal.ad : pal.brassHi });
      hit(bx, by, bw, 54, bt.fn, 'dlg_' + k);
    });
  }
  function drawFloats(ctx, pal) {
    fx.floats.forEach(function (f) { ctx.globalAlpha = Math.min(1, f.t * 1.6); g.text(f.text, f.x, SCENE_Y + f.y, { size: 16, align: 'center', color: pal.brassHi, weight: 900, font: pal.font }); });
    ctx.globalAlpha = 1;
    fx.toasts.forEach(function (f, k) {
      ctx.globalAlpha = Math.min(1, f.t * 2); var y = SCENE_Y + 22 + k * 30;
      R.panel(ctx, 70, y - 18, W - 140, 26, pal, { r: 13, fill: pal.panel, line: f.col || pal.line });
      g.text(f.text, W / 2, y, { size: 13, align: 'center', color: f.col || pal.ink, weight: 800, font: pal.font, maxWidth: W - 160, minSize: 8 });
    });
    ctx.globalAlpha = 1;
  }
  function drawWorld(ctx, withUi) {
    var pal = P(); ui.hits = [];
    ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, H);
    drawScene(ctx);
    if (S.boostLeft > 0) { R.panel(ctx, R.BOILER.x - 44, SCENE_Y + R.BOILER.y + 70, 88, 22, pal, { r: 11, fill: pal.adBg, line: pal.ad }); g.text('×2 ' + fmtT(S.boostLeft), R.BOILER.x, SCENE_Y + R.BOILER.y + 86, { size: 12, align: 'center', color: pal.ad, weight: 900, font: pal.font }); }
    if (evInfo.on && withUi) {   // ярмарка: плашка слева от котла (тап — окно ярмарки)
      var ex = 12, ey = SCENE_Y + 288; R.panel(ctx, ex, ey, 128, 42, pal, { r: 12, fill: pal.panel, line: pal.fair });
      g.text(fill(t('ev_pill'), { x: E.cfg.event.mult }), ex + 64, ey + 18, { size: 13, align: 'center', color: pal.fair, weight: 900, font: pal.font, maxWidth: 116, minSize: 8 });
      g.text(fmtT(evInfo.left), ex + 64, ey + 35, { size: 11, align: 'center', color: pal.muted, weight: 700, font: pal.font, maxWidth: 116 });
      hit(ex, ey, 128, 42, function () { openDlg({ type: 'event' }); }, 'evpill');
    }
    if (S.taps < 15 && withUi && !ui.dlg) { var bob = Math.sin(fx.time * 5) * 4; g.text(t('tapHere'), R.BOILER.x, SCENE_Y + R.BOILER.y - 84 + bob, { size: 16, align: 'center', color: pal.glow, weight: 900, font: pal.font }); }
    ctx.fillStyle = pal.bg; ctx.fillRect(0, SCENE_Y + R.SH, W, H - SCENE_Y - R.SH);
    drawHud(ctx, pal);
    if (!withUi) return;
    drawBar(ctx, pal); drawTabs(ctx, pal); drawList(ctx, pal); drawFloats(ctx, pal); drawDlg(ctx, pal);
  }
  M.debug = { rows: function () { return curRows; }, hits: function () { return ui.hits; }, ui: ui, fx: fx, tick: tick, openDlg: openDlg, save: save, setState: function (s) { S = E.normalize(s); }, maybeAd: maybeAd, catchChest: catchChest, boost: boost,
    setView: setView, toggleView: toggleView, claimEvent: claimEvent, event: function () { return evInfo; }, doPrestige: doPrestige };

  // ---------- ввод: палец / мышь ----------
  var ptr = null;
  function logical(e) { var r = g.canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
  function inBoiler(p) { var B = R.BOILER; return p.x > B.x - B.w / 2 - 10 && p.x < B.x + B.w / 2 + 10 && p.y > SCENE_Y + B.y - B.h / 2 - 40 && p.y < SCENE_Y + B.y + B.h / 2 + 6; }
  function inChest(p) { if (S.chestLive <= 0) return false; var c = chestPos(); return Math.abs(p.x - c.x) < 48 && Math.abs(p.y - (SCENE_Y + c.y + 14)) < 50; }
  function findHit(p) { for (var i = ui.hits.length - 1; i >= 0; i--) { var h = ui.hits[i]; if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h; } return null; }
  M.findHit = function (id) { for (var i = 0; i < ui.hits.length; i++) if (ui.hits[i].id === id) return ui.hits[i]; return null; };
  if (g.canvas.addEventListener) {
    g.canvas.addEventListener('pointerdown', function (e) {
      if (g._sceneName !== 'play') return; var p = logical(e); ui.kb = false;
      if (!ui.dlg && inChest(p)) { catchChest(); return; }
      if (!ui.dlg && inBoiler(p)) { tapBoiler(p.x, p.y - SCENE_Y); return; }
      ptr = { id: e.pointerId, x: p.x, y: p.y, y0: p.y, s0: ui.scroll[ui.tab], drag: false, list: !ui.dlg && p.y > LIST_Y && p.y < LIST_Y + LIST_H };
      try { g.canvas.setPointerCapture(e.pointerId); } catch (er) {}
    });
    g.canvas.addEventListener('pointermove', function (e) {
      if (!ptr || ptr.id !== e.pointerId) return; var p = logical(e);
      if (ptr.list && Math.abs(p.y - ptr.y0) > 8) ptr.drag = true;
      if (ptr.drag) ui.scroll[ui.tab] = Math.max(0, Math.min(maxScroll(), ptr.s0 - (p.y - ptr.y0)));
    });
    var up = function (e) {
      if (!ptr || ptr.id !== e.pointerId) return; var p = logical(e), was = ptr; ptr = null;
      if (was.drag || g._sceneName !== 'play') return;
      var h = findHit(p); if (h) h.fn();
    };
    g.canvas.addEventListener('pointerup', up); g.canvas.addEventListener('pointercancel', function () { ptr = null; });
    g.canvas.addEventListener('wheel', function (e) { if (g._sceneName !== 'play' || ui.dlg) return; e.preventDefault(); ui.scroll[ui.tab] = Math.max(0, Math.min(maxScroll(), ui.scroll[ui.tab] + e.deltaY)); }, { passive: false });
  }
  addEventListener('keydown', function (e) {
    if (g._sceneName !== 'play') return;
    var k = { Digit1: 'ws', Digit2: 'up', Digit3: 'goals', Digit4: 'pr' }[e.code]; if (k && !ui.dlg) { setTab(k); return; }
    if (e.code === 'KeyB' && !ui.dlg) cycleMode();
    if (e.code === 'KeyV' && !ui.dlg) toggleView();
  });
  function scrollToSel() { var y = 0; for (var i = 0; i < ui.sel; i++) y += curRows[i].h; var h = curRows[ui.sel] ? curRows[ui.sel].h : ROW, sc = ui.scroll[ui.tab]; if (y < sc) ui.scroll[ui.tab] = y; else if (y + h > sc + LIST_H) ui.scroll[ui.tab] = y + h - LIST_H; }

  // ---------- сцены ----------
  g.useNoAds({ scene: ['title', 'pause'] });
  g.useStandardScreens({ title: 'МЕДНИЦА', subtitle: t('subtitle'), lives: 1 });
  g.useLeaderboard({ boards: [{ id: 'mednitsa', label: function () { return t('lbBoard'); } }], after: 'play' });
  g.useOwnGames(); g.useShortcut();
  g.menu.setHint(function () { return [t('hint1'), { text: t('hint2'), dim: true }]; }, 'title');
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  g.state.best = 0; g.loadBest = function () { return 0; };

  var title = g.scenes.title, tmenu = title._menu;
  title.update = function (dt) { tick(Math.min(dt, 0.1)); };
  title.draw = function (ctx) {
    drawWorld(ctx, false); var pal = P();
    ctx.fillStyle = pal.pixel ? 'rgba(0,0,0,.72)' : 'rgba(14,9,6,.70)'; ctx.fillRect(0, 0, W, H);
    var tl = t('title'), sz = g.fitSize(tl, W - 40, 58, 20, 900, pal.font);
    if (!pal.pixel) { ctx.save(); ctx.shadowColor = 'rgba(255,140,50,.55)'; ctx.shadowBlur = 24; g.text(tl, W / 2, 196, { size: sz, align: 'center', color: pal.copperHi, weight: 900, font: pal.font }); ctx.restore(); }
    else g.text(tl, W / 2, 196, { size: sz, align: 'center', color: pal.copperHi, weight: 900, font: pal.font });
    g.text(t('subtitle'), W / 2, 230, { size: 15, align: 'center', color: pal.muted, weight: 700, font: pal.font, maxWidth: W - 40 });
    R.gear(ctx, W / 2 - 120, 140, 18, 10, fx.time * 0.8, pal.brassLo, pal.bg); R.gear(ctx, W / 2 + 120, 140, 14, 8, -fx.time, pal.copperLo, pal.bg);
    var n = tmenu.items.length, lh = n > 5 ? 34 : 40, y0 = 400;
    R.panel(ctx, 70, y0 - 34, W - 140, n * lh + 28, pal, { r: 16, fill: pal.panel, line: pal.copper, shadow: true });
    tmenu.draw(this, W / 2, y0, lh);
    if (S.marks || S.lifeEarned > 0) g.text(fmt(S.copper) + ' · ' + t('marks') + ': ' + S.marks, W / 2, y0 + n * lh + 26, { size: 13, align: 'center', color: pal.brass, weight: 700, font: pal.font, maxWidth: W - 40 });
    this.menu._drawHint('title');
  };

  g.scene('play', { realtime: true,
    enter: function (d) {
      played = true;
      if (!(d && d.resume)) { var dd = E.daily(S, g.serverTime()); if (dd.ready) openDlg({ type: 'daily', d: dd }); }
    },
    update: function (dt) { tick(dt); },
    draw: function (ctx) { drawWorld(ctx, true); },
    press: function (a) {
      ui.kb = true;
      if (a === 'pause') { this.pause(); return; }
      var d = ui.dlg;
      if (d) { var b = dlgButtons(d); if (a === 'up' || a === 'left') ui.dsel = (ui.dsel + b.length - 1) % b.length; else if (a === 'down' || a === 'right') ui.dsel = (ui.dsel + 1) % b.length; else if ((a === 'action' || a === 'start') && b[ui.dsel]) b[ui.dsel].fn(); return; }
      if (a === 'action') { tapBoiler(R.BOILER.x, R.BOILER.y); return; }
      if (a === 'left' || a === 'right') { var i = TABS.indexOf(ui.tab); setTab(TABS[(i + (a === 'left' ? 3 : 1)) % 4]); return; }
      if (a === 'up') { ui.sel = Math.max(0, ui.sel - 1); scrollToSel(); return; }
      if (a === 'down') { ui.sel = Math.min(curRows.length - 1, ui.sel + 1); scrollToSel(); return; }
      if (a === 'start') { var r = curRows[ui.sel]; if (r && r.act) r.act(); }
    } });

  g.cloudReady.then(function () { setTimeout(function () { g.products().then(function (list) { (list || []).forEach(function (p) { if (p.id === 'starter') starterPrice = p.price; }); }, function () {}); }, 0); });
  g.start('title');
})(typeof window !== 'undefined' ? window : globalThis);
