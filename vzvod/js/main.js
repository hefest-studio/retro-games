/* ВЗВОД · сборка: фреймворк Гефест Arcade (engine.js) + логика миссии (game.js) + кампания (campaign.js) + рендер/интерфейс.
   Сцены: title (меню: Продолжить/Новая кампания + язык/тема/звук; фон — живая перестрелка), brief (брифинг: отряд, ремонт,
   фонд, превью карты), play (бой), debrief (итог: опыт, ранги, ремонт, пополнение), pause/win — движок.
   Ввод: мышь (ЛКМ — идти, ПКМ держать — огонь, средняя/Shift+ЛКМ — шестерня), клавиши Q/G, E/R, X, Tab, F, пробел,
   стрелки/WASD — осмотреться; тач: тап — идти, двойной тап — очередь, кнопки режима .pad. Кампания — в localStorage. */
(function (global) {
  'use strict';
  var V = global.VZVOD, L = V.logic, Camp = V.Camp, Store = Arcade.Store, TS = L.TS;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#101318', panel: '#161a22', ink: '#eef2f8', muted: '#9aa4b5', accent: '#8bd450', grid: '#222838' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#98e058', muted: '#a8a8a8' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.W, height: L.SCREEN_H, gameId: 'vzvod', strings: V.STR, theme: 'modern', lives: 1, themes: themes });
  V.g = g;
  V.ui.init(g);
  function pal() { return g.themeName === 'retro' ? V.classic : V.modern; }
  g.useStandardScreens({ lives: 1 });

  var camp = Camp.load(Store), prep = null, game = null, R = null, sure = false;
  var cam = { x: 0, y: 0 }, look = { x: 0, y: 0 }, toasts = [], bannerT = 0, endT = 0;
  var mouse = { x: L.W / 2, y: L.SCREEN_H / 2 }, rmb = false, spaceHeld = false, mode = 'move', touch = null, lastTap = { t: 0, x: 0, y: 0 }, burstT = 0;

  function syncScore() { g.state.score = (camp ? camp.score : 0) + (game && g._sceneName === 'play' ? game.state().score : 0); }

  // ---------- Меню заставки ----------
  function refreshMenu() {
    g.menu.addItem({ key: 'play', index: 0,
      label: function () { return camp ? g.t('cont') + ' · ' + g.t('opShort') + ' ' + Camp.spec(camp).id : g.t('play'); },
      onSelect: function () { if (!camp) newCamp(); toBrief(); } });
    if (camp) g.menu.addItem({ key: 'newc', after: 'play', label: function () { return sure ? g.t('newcSure') : g.t('newc'); },
      onSelect: function () { if (!sure) { sure = true; g.audio.beep(300, 0.06); return; } sure = false; newCamp(); toBrief(); } });
    else g.menu.removeItem('newc');
  }
  function newCamp() { camp = Camp.newCampaign(); camp.seed = 1 + Math.floor(Math.random() * 1e6); Camp.save(Store, camp); }
  function missionSeed() { return ((camp.seed || 1) + camp.missions * 101 + camp.op * 17 + camp.mi * 7) % 1000003; }

  // ---------- Брифинг ----------
  function toBrief() {
    prep = Camp.prepare(camp); Camp.save(Store, camp);
    var spec = Camp.spec(camp), squad = Camp.squadFor(camp).map(function (b) { return { id: b.id, name: V.ui.botName(g, b), rank: b.rank }; });
    game = V.Game({ spec: spec, seed: missionSeed(), squad: squad, onEvent: onEvent });
    R = { squad: squad.map(function (b) { return b.id; }) };
    g.state.score = camp.score;
    g.goto('brief');
  }
  g.scene('brief', {
    realtime: true,
    draw: function (ctx) { V.ui.brief(g, ctx, camp, pal(), prep, game ? game.state() : null); },
    press: function (a) { if (a === 'start' || a === 'action') this.goto('play'); else if (a === 'pause') this.goto('title'); }
  });
  g.scene('debrief', {
    realtime: true,
    draw: function (ctx) { V.ui.debrief(g, ctx, camp, pal(), R); },
    press: function (a) { if (a === 'start' || a === 'action' || a === 'pause') afterDebrief(); }
  });
  function afterDebrief() {
    if (camp.done) { g.state.score = camp.score; Camp.clear(Store); camp = null; game = null; g.win(); return; }
    toBrief();
  }
  function endMission() {
    var S = game.state(), res = S.result;
    var rep = Camp.apply(camp, res, R.squad);
    R.res = res; R.rep = rep; R.spec = S.spec;
    g.state.score = camp.score; g.saveBest();
    if (!camp.done) Camp.save(Store, camp);
    g.goto('debrief');
  }

  // ---------- События боя: звук, частицы, надписи ----------
  function toast(text, color, x, y, big, world) { toasts.push({ text: text, color: color, x: x, y: y, t: 1.6, big: big, world: world }); if (toasts.length > 7) toasts.shift(); }
  function scr(d) { return { x: (d.x - cam.x) * L.ZOOM, y: (d.y - cam.y) * L.ZOOM + L.HUD }; }
  function fx(type, d) {
    if (!d || d.x == null || g._sceneName !== 'play') return;
    var P = pal(), p = scr(d), sz = P.pixel ? 4 : 3;
    if (p.x < -20 || p.y < L.HUD - 20 || p.x > L.W + 20 || p.y > g.H + 20) return;
    if (type === 'kill') g.particles.spawn(p.x, p.y, { color: P.rust, count: 10, speed: 90, life: 0.45, size: sz });
    else if (type === 'broken') g.particles.spawn(p.x, p.y, { color: P.spark, count: 12, speed: 80, life: 0.5, size: 2 });
    else if (type === 'hiveDown') g.particles.spawn(p.x, p.y, { color: P.hiveCore, count: 40, speed: 160, life: 0.9, size: sz + 1 });
    else if (type === 'pickup' || type === 'supply') g.particles.spawn(p.x, p.y, { color: P.pickGear, count: 10, speed: 70, life: 0.5, size: 2 });
    else if (type === 'vehDown') g.particles.spawn(p.x, p.y, { color: P.boom[1], count: 30, speed: 140, life: 0.8, size: sz });
  }
  function onEvent(type, d) {
    V.sfx(g, type, d); fx(type, d);
    var P = pal(), S = game ? game.state() : null;
    if (!S || g._sceneName !== 'play' && g._sceneName !== 'pause') return;
    if (type === 'broken') toast(d.name + ' — ' + g.t('t_broken'), P.warn, d.x, d.y - 14, false, true);
    else if (type === 'hiveDown') toast(g.t('t_hive'), P.good, d.x, d.y - 24, true, true);
    else if (type === 'pickup') toast(g.t('t_pick_' + d.kind), P.pickGear, d.x, d.y - 14, false, true);
    else if (type === 'supply') toast(g.t('t_supply'), P.good, d.x, d.y - 14, true, true);
    else if (type === 'noAmmo') toast(g.t('t_noAmmo_' + d.kind), P.bad, L.W / 2, L.HUD + 60, true);
    else if (type === 'ping') { if (!onEvent.pinged || S.time - onEvent.pinged > 6) { onEvent.pinged = S.time; toast(g.t('t_ping'), P.warn, d.x, d.y - 20, false, true); } }
    else if (type === 'board') toast(g.t('t_board'), P.good, d.x, d.y - 16, false, true);
    else if (type === 'exitV') toast(g.t('t_exit'), P.good, d.x, d.y - 16, false, true);
    else if (type === 'noExit') toast(g.t('t_noExit'), P.bad, L.W / 2, L.HUD + 60, false);
    else if (type === 'vehDown') toast(g.t('t_vehDown'), P.bad, d.x, d.y - 16, true, true);
    else if (type === 'split') toast(g.t('t_split'), P.accent, L.W / 2, L.HUD + 60, false);
    else if (type === 'merge') toast(g.t('t_merge'), P.accent, L.W / 2, L.HUD + 60, false);
    else if (type === 'switch') toast(g.t('t_switch') + ' ' + g.t(d.gi ? 'grpB' : 'grpA'), P.unit[d.gi], L.W / 2, L.HUD + 60, false);
    else if (type === 'vipHit') toast(g.t('t_vip'), P.bad, S.vip.x, S.vip.y - 20, false, true);
    else if (type === 'holdStart') toast(g.t('t_hold'), P.zone, L.W / 2, L.HUD + 80, true);
    else if (type === 'wave') toast(g.t('t_wave'), P.warn, L.W / 2, L.HUD + 80, false);
    if (type === 'won' || type === 'lost') { burstT = 0; rmb = false; }
    syncScore();
  }

  // ---------- Камера и координаты ----------
  function focus(S) {
    var G = S.groups[S.active], f = null;
    if (G.vehicle) f = S.vehicles.filter(function (v) { return v.id === G.vehicle; })[0];
    if (!f && G.order.length) f = game.leader(S.active);
    if (!f) { var u = S.units.filter(function (q) { return q.alive; })[0]; f = u || S.units[0]; }
    return f;
  }
  function camTarget(S) {
    var f = focus(S), mw = S.map.w * TS, mh = S.map.h * TS;
    return { x: Math.max(0, Math.min(mw - L.VIEW_W, f.x - L.VIEW_W / 2 + look.x)), y: Math.max(0, Math.min(mh - L.VIEW_H, f.y - L.VIEW_H / 2 + look.y)) };
  }
  function toCanvas(e) { var r = g.canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * g.W / r.width, y: (e.clientY - r.top) * g.H / r.height }; }
  function toWorld(p) { return { x: p.x / L.ZOOM + cam.x, y: (p.y - L.HUD) / L.ZOOM + cam.y }; }
  function inMM(p, S) { var m = V.ui.mmRect(S); return p.x >= m.x && p.x <= m.x + m.w && p.y >= m.y && p.y <= m.y + m.h ? { x: (p.x - m.x) / m.sc * TS, y: (p.y - m.y) / m.sc * TS } : null; }

  // ---------- Указатель: мышь и тач ----------
  var cv = g.canvas;
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  cv.addEventListener('pointerdown', function (e) {
    var sn = g._sceneName, p = toCanvas(e);
    if (sn === 'brief') { e.preventDefault(); g.goto('play'); return; }
    if (sn === 'debrief') { e.preventDefault(); afterDebrief(); return; }
    if (sn !== 'play' || !game) return;
    e.preventDefault(); mouse = p;
    var S = game.state(); if (S.phase !== 'play' || p.y < L.HUD) return;
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    var mm = inMM(p, S); if (mm) { game.moveTo(mm.x, mm.y); return; }
    var w = toWorld(p);
    if (e.pointerType === 'touch' || e.pointerType === 'pen') { tapAt(e, p, w); return; }
    if (e.button === 2) { rmb = true; game.fire(true, w.x, w.y); }
    else if (e.button === 1 || (e.button === 0 && e.shiftKey)) { e.preventDefault(); game.gear(w.x, w.y); }
    else if (e.button === 0) {
      if (mode === 'gear') { game.gear(w.x, w.y); setMode('move'); }
      else if (mode === 'rocket') { game.rocket(w.x, w.y); setMode('move'); }
      else game.moveTo(w.x, w.y);
    }
  });
  cv.addEventListener('pointermove', function (e) {
    var p = toCanvas(e); mouse = p;
    if (touch && e.pointerId === touch.id) { touch.w = toWorld(p); }
  });
  function pUp(e) {
    if (e.button === 2) rmb = false;
    if (touch && e.pointerId === touch.id) touch = null;
  }
  cv.addEventListener('pointerup', pUp); cv.addEventListener('pointercancel', pUp);
  function tapAt(e, p, w) {
    var now = performance.now();
    if (mode === 'gear') { game.gear(w.x, w.y); setMode('move'); return; }
    if (mode === 'rocket') { game.rocket(w.x, w.y); setMode('move'); return; }
    if (mode === 'fire') { touch = { id: e.pointerId, w: w }; return; }       // режим огня: держать палец — очередь
    if (now - lastTap.t < 330 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 44) { burstT = 0.8; touch = { id: e.pointerId, w: w }; lastTap.t = 0; return; }
    lastTap = { t: now, x: p.x, y: p.y };
    game.moveTo(w.x, w.y);
  }
  // ---------- Клавиши ----------
  addEventListener('keydown', function (e) {
    if (g._sceneName !== 'play' || !game) return;
    if (e.code === 'Tab') e.preventDefault();
    if (e.code === 'Space') { spaceHeld = true; return; }
    if (e.repeat) return;
    var w = toWorld(mouse);
    if (e.code === 'KeyQ' || e.code === 'KeyG') game.gear(w.x, w.y);
    else if (e.code === 'KeyE' || e.code === 'KeyR') game.rocket(w.x, w.y);
    else if (e.code === 'Tab') game.switchGroup();
    else if (e.code === 'KeyX') game.splitMerge();
    else if (e.code === 'KeyF') game.exitVehicle();
  });
  addEventListener('keyup', function (e) { if (e.code === 'Space') spaceHeld = false; });
  addEventListener('blur', function () { spaceHeld = false; rmb = false; touch = null; });
  // ---------- Тач-кнопки ----------
  var pad = document.querySelector('.pad');
  function setMode(m) {
    mode = m;
    if (pad) pad.querySelectorAll('[data-act]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-act') === m); });
  }
  if (pad) {
    pad.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault(); if (g._sceneName !== 'play' || !game) return;
        var a = b.getAttribute('data-act');
        if (a === 'fire' || a === 'gear' || a === 'rocket') setMode(mode === a ? 'move' : a);
        else if (a === 'group') game.switchGroup();
        else if (a === 'split') game.splitMerge();
        else if (a === 'exit') game.exitVehicle();
      });
    });
    var pb = pad.querySelector('[data-pause]');
    if (pb) pb.addEventListener('pointerdown', function (e) { e.preventDefault(); if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });
  }

  // ---------- Сцена боя ----------
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  g.scene('play', {
    realtime: true,
    enter: function (d) {
      if (d && d.resume && game) return;
      if (!game) { if (!camp) newCamp(); toBrief(); return; }
      game.start(); var S = game.state();
      look = { x: 0, y: 0 }; var t = camTarget(S); cam.x = t.x; cam.y = t.y;
      toasts = []; bannerT = 3.2; burstT = 0; rmb = false; spaceHeld = false; touch = null; setMode('move'); syncScore();
    },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return;
      dt = Math.min(dt, 0.05);
      var S = game.state();
      // осмотреться стрелками/WASD
      var dx = this.input.dir.x, dy = this.input.dir.y;
      look.x = Math.max(-220, Math.min(220, look.x + dx * 420 * dt)); look.y = Math.max(-170, Math.min(170, look.y + dy * 420 * dt));
      if (!dx) look.x *= Math.pow(0.08, dt); if (!dy) look.y *= Math.pow(0.08, dt);
      // огонь
      if (burstT > 0) burstT -= dt;
      var fireOn = rmb || spaceHeld || !!touch || burstT > 0;
      var aim = touch ? touch.w : toWorld(mouse);
      if (S.phase === 'play') game.fire(fireOn, aim.x, aim.y);
      game.update(dt);
      var t = camTarget(S), k = Math.min(1, dt * 6); cam.x += (t.x - cam.x) * k; cam.y += (t.y - cam.y) * k;
      if (bannerT > 0) bannerT -= dt;
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      syncScore();
      if (S.phase !== 'play' && S.phaseT > 2.4) endMission();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      var S = game.state(), G = S.groups[S.active], aimP = touch ? touch.w : toWorld(mouse);
      var showAim = mouse.y > L.HUD || touch;
      V.ui.render(g, ctx, S, pal(), cam, { toasts: toasts, banner: bannerT, campScore: camp ? camp.score : 0, mode: mode, time: g.time,
        aim: showAim ? { x: aimP.x, y: aimP.y, fire: rmb || spaceHeld || !!touch || burstT > 0, mode: mode } : null, target: G.vehicle ? null : G.target });
    }
  });

  // ---------- Заставка: живая перестрелка за меню ----------
  var demo = null, demoCam = { x: 0, y: 0 }, demoT = 0;
  function newDemo() {
    var sq = []; for (var i = 0; i < 6; i++) sq.push({ id: i + 1, name: '', rank: i % 3 });
    demo = V.Game({ spec: L.mission(0, 1), seed: 5 + Math.floor(Math.random() * 50), squad: sq, invuln: true }).start();
    var S = demo.state(); demo.split(); demoT = 0;
    var f = demo.leader(0); demoCam.x = Math.max(0, f.x - L.VIEW_W / 2); demoCam.y = Math.max(0, Math.min(S.map.h * TS - L.VIEW_H, f.y - L.VIEW_H / 2));
  }
  function demoStep(dt) {
    if (!demo) newDemo();
    var S = demo.state(); demoT += dt;
    if (S.phase !== 'play' || demoT > 60) { newDemo(); S = demo.state(); }
    var ld = demo.leader(S.active);
    if (ld && Math.floor(demoT * 4) !== Math.floor((demoT - dt) * 4)) {
      var e = null, bd = 220; S.enemies.forEach(function (q) { var d = Math.hypot(q.x - ld.x, q.y - ld.y); if (!q.dead && d < bd && L.los(S.map, ld.x, ld.y, q.x, q.y)) { bd = d; e = q; } });
      if (e) demo.fire(true, e.x, e.y); else { demo.fire(false); if (!ld.q.length) { var h = S.hives.filter(function (q) { return !q.dead; })[0] || S.enemies.filter(function (q) { return !q.dead; })[0]; if (h) demo.moveTo(h.x, h.y + 40); } }
    }
    demo.update(Math.min(dt, 0.05));
    var f = demo.leader(S.active) || ld; if (f) { var tx = Math.max(0, Math.min(S.map.w * TS - L.VIEW_W, f.x - L.VIEW_W / 2)), ty = Math.max(0, Math.min(S.map.h * TS - L.VIEW_H, f.y - L.VIEW_H / 2)); demoCam.x += (tx - demoCam.x) * Math.min(1, dt * 2); demoCam.y += (ty - demoCam.y) * Math.min(1, dt * 2); }
  }
  var title = g.scenes.title, menu = title._menu, tEnter = title.enter;
  title.enter = function () { tEnter.call(this); sure = false; game = null; refreshMenu(); g.state.score = 0; };
  title.update = function (dt) { demoStep(Math.min(dt, 0.05)); };
  title.draw = function (ctx) {
    var th = this.th(), P = pal(), W = this.W, H = this.H;
    if (demo) V.ui.render(this, ctx, demo.state(), P, demoCam, { bare: true, time: this.time });
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.5)' : 'rgba(10,12,16,.5)'; ctx.fillRect(0, 0, W, H);
    var pw = 430, ph = 330, px = (W - pw) / 2, py = 60;
    V.ui.panel(ctx, px, py, pw, ph, P, P.accent);
    V.ui.txt(this, this.t('title'), W / 2, py + 72, { size: 60, align: 'center', color: P.accent, weight: 900 }, P);
    V.ui.txt(this, this.t('subtitle'), W / 2, py + 98, { size: 11, align: 'center', color: th.muted, weight: 600, shadow: false }, P);
    menu.draw(this, W / 2, py + 150, 30);
    if (this.state.best) V.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600, shadow: false }, P);
    V.ui.wrap(this, this.t('hintKeys'), W / 2, H - 58, 560, 16, { size: 11, align: 'center', color: P.ink, weight: 700, shadow: false }, P);
  };
  // финал — поверх заставки
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) { baseClear.call(this, c); if ((this._sceneName === 'win' || this._sceneName === 'gameover') && demo) V.ui.render(this, this.ctx, demo.state(), pal(), demoCam, { bare: true, time: this.time }); };

  refreshMenu();
  g.start('title');
  V.app = { g: g, game: function () { return game; }, camp: function () { return camp; }, cam: cam, toBrief: toBrief, newCamp: newCamp,
    setCamp: function (c) { camp = c; Camp.save(Store, c); }, endMission: endMission };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
