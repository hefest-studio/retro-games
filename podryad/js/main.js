/* ПОДРЯД · сборка: фреймворк Гефест Arcade (engine.js) + экономика (economy.js) + логика задания (game.js) + рендер + звук.
   Сцены title/pause/win — g.useStandardScreens (титул перерисован: за панелью меню — живой полёт над островами).
   Сцена play — три фазы: 'hangar' (ангар-магазин) → 'fly' (задание) → 'debrief' (итог) → снова ангар; после 9-го задания — win.
   Меню: «Играть / Продолжить (сектор, задание)», «Новая кампания», «Сложность». Кампания сохраняется в localStorage
   (arcade.podryad.save) после каждой покупки/продажи и каждого задания. Рекорд — заработок за карьеру (arcade.best.podryad).
   Ввод в полёте: стрелки/WASD, X/пробел — мега-бомба, C — ячейка щита, Q/Tab — орудие; палец/мышь — относительное перемещение;
   тач-кнопки БОМБА / ЩИТ / ОРУДИЕ / II. В ангаре: ↑↓, →/пробел — купить, ←/X/Backspace — продать, Q — орудие в руки; клик/тап. */
(function (global) {
  'use strict';
  var P = global.PODRYAD, D = P.DATA, E = P.Eco, L = P.logic, K = L.K, RN = P.render, Store = Arcade.Store;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#10161c', panel: '#141b22', ink: '#eef3ee', muted: '#93a3a6', accent: '#4caf8e', grid: '#2b3a44' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#55ffff', muted: '#aaaaaa', ink: '#ffffff' })
  };
  var W = 640, H = 640;
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'podryad', strings: P.STR, theme: 'modern', lives: 1, themes: themes });
  P.g = g;

  // ---------- кампания и сложность ----------
  var DKEY = 'arcade.podryad.diff';
  var diff = D.DIFFS.indexOf(Store.get(DKEY, 'normal')) >= 0 ? Store.get(DKEY, 'normal') : 'normal';
  var camp = E.load(Store);
  if (camp && camp.done) camp = null;
  function C() { return g.themeName === 'retro' ? RN.PR : RN.PM; }
  function saveCamp() { if (camp) E.save(Store, camp); }
  function syncScore() { if (camp) { g.state.score = camp.earned; g.state.level = camp.mi + 1; } }
  g.saveBest = function () { syncScore(); if (this.state.score > this.state.best) { this.state.best = this.state.score; Store.set('arcade.best.podryad', String(this.state.best)); } };

  // ---------- фазы сцены play ----------
  var phase = 'hangar', game = null, banner = null, playSince = 0, debrief = null;
  var rows = D.SHOP.slice(), sel = rows.length - 1, msg = null, hits = [];
  function S() { return game.state(); }
  function say(s, col) { msg = { s: s, t: 2.2, col: col }; }
  function showBanner(title, sub, dur, col, y) { banner = { title: title, sub: sub, a: dur || 2, col: col, y: y }; }

  function onEvent(type, a, b, c) {
    P.sfx(g, type, a, b, c);
    var Cc = C();
    switch (type) {
      case 'start': RN.clearFx(); showBanner(g.t('sector') + ' ' + (a + 1) + ' · ' + g.t('mission').toLowerCase() + ' ' + (b + 1), g.t('mn' + (a * 3 + b)), 2.6, Cc.accent); break;
      case 'kill': RN.spawn(a, b, 14, 0, 150, 0.5, 5); RN.spawn(a, b, 6, 4, 110, 0.6, 3); break;
      case 'gkill': RN.spawn(a, b, 22, 0, 120, 0.7, 6); RN.spawn(a, b, 14, 2, 50, 1.4, 9); RN.wave(a, b, 50, 0.4, '#ffcf8a'); RN.shake(0.15); break;
      case 'pay': if (c >= 25) RN.pop(a, b - 10, '+' + c, Cc.gold, c >= 300); break;
      case 'blast': RN.spawn(a, b, 6, 0, 90, 0.3, 4); RN.wave(a, b, c, 0.25, '#ffb35a'); break;
      case 'cut': RN.spawn(a, b, 3, 3, 60, 0.2, 2); break;
      case 'hit': RN.flash(0.06); RN.shake(0.18); RN.spawn(a, b, 8, 1, 120, 0.3, 2); break;
      case 'shieldHit': RN.spawn(a, b, 6, 3, 90, 0.3, 2); break;
      case 'die': RN.spawn(a, b, 50, 0, 240, 1.0, 7); RN.spawn(a, b, 30, 2, 90, 1.6, 10); RN.wave(a, b, 140, 0.6, '#ffd28a'); RN.shake(0.6); break;
      case 'mega': RN.wave(a, b, 560, 0.8, '#fff1c0'); RN.wave(a, b, 380, 0.6, '#ff8a3a'); RN.flash(0.3); RN.shake(0.4); RN.pop(a, b - 30, g.t('megaName'), Cc.bad, true); break;
      case 'cell': RN.wave(a, b, 60, 0.4, Cc.shield); RN.pop(a, b - 30, g.t('cellName'), Cc.shield, true); break;
      case 'armor': RN.pop(a, b - 10, g.t('armorUp'), Cc.good, true); break;
      case 'megaGet': RN.pop(a, b - 10, g.t('megaUp'), Cc.bad, true); break;
      case 'gun': RN.pop(S().P.x, S().P.y - 36, g.t('g_' + a), Cc.accent, true); break;
      case 'midboss': case 'boss': showBanner(g.t('warning'), g.t('b_' + a) + ' · ' + g.t(type === 'midboss' ? 'midboss' : 'bossCome'), 1.8, Cc.bad, 260); break;
      case 'bossLeft': showBanner(g.t('b_zep'), g.t('bossLeft'), 1.6, Cc.muted, 260); break;
      case 'midDown': case 'bossDown': RN.spawn(a, b, 70, 0, 280, 1.2, 7); RN.spawn(a, b, 40, 2, 120, 1.8, 12); RN.wave(a, b, 300, 0.9, '#ffd28a'); RN.shake(type === 'bossDown' ? 1.1 : 0.5); RN.flash(0.3); break;
      case 'done': endFlight(true); break;
      case 'fail': endFlight(false); break;
    }
  }
  function startFlight() {
    if (!camp) return;
    game = P.Game({ load: camp, diff: camp.diff, si: Math.floor(camp.mi / 3), mj: camp.mi % 3, onEvent: onEvent });
    phase = 'fly'; banner = null; debrief = null; playSince = g.time; RN.clearFx();
    game.start(); P.current = game;
    P.sfx(g, 'launch');
  }
  function endFlight(ok) {
    var r = game.result(), s = S(), mi = camp.mi, wasSector = mi % 3 === 2;
    var fin = E.finishMission(camp, r);
    debrief = { ok: ok, mi: mi, money: ok ? r.money : r.earnedRaw, kills: s.kills, gkills: s.gkills, lost: fin.lost ? RN.itemName(g, fin.lost, camp) : null, lostLv: fin.lost, sector: ok && wasSector ? Math.floor(mi / 3) + 1 : 0, t: 0 };
    if (fin.lost) { var lr = E.row(fin.lost.id); if (lr && lr.kind === 'gun') debrief.lost = g.t(fin.lost.id.replace(':', '_')) + (camp.guns[lr.key] ? ' ' + g.t('lvl') + ' ' + (camp.guns[lr.key] + 1) : ''); if (lr && lr.kind === 'gen') debrief.lost = g.t('x_gen') + ' ' + g.t('lvl') + ' ' + (camp.gen + 1); }
    if (!ok) P.sfx(g, 'lost');
    banner = null;
    syncScore(); saveCamp(); g.saveBest();
    phase = 'debrief';
  }
  function leaveDebrief() {
    if (!debrief || debrief.t < 0.6) return;
    if (camp.done) { syncScore(); E.clear(Store); g.win(); return; }
    phase = 'hangar'; sel = rows.length - 1; game = null; debrief = null;
  }

  // ---------- ангар: действия ----------
  function rowId() { return rows[sel].id; }
  function doBuy(i) {
    if (i != null) sel = i;
    var id = rowId();
    if (id === 'go') { startFlight(); return; }
    var p = E.price(camp, id);
    if (p == null) { P.sfx(g, 'deny'); say(rows[sel].kind === 'mod' ? g.t('noSlot') : rows[sel].kind === 'repair' ? g.t('full') : g.t('max'), C().muted); return; }
    var spent = E.buy(camp, id);
    if (!spent) { P.sfx(g, 'deny'); say(g.t('buy') + ': ' + P.money(p) + ' > ' + P.money(camp.money), C().bad); return; }
    P.sfx(g, 'buy'); say('−' + P.money(spent) + ' · ' + g.t(id.replace(':', '_')), C().gold); saveCamp();
  }
  function doSell(i) {
    if (i != null) sel = i;
    var id = rowId(); if (id === 'go' || id === 'repair') { P.sfx(g, 'deny'); return; }
    var v = E.sell(camp, id);
    if (!v) { P.sfx(g, 'deny'); return; }
    P.sfx(g, 'sell'); say('+' + P.money(v) + ' · ' + g.t(id.replace(':', '_')), C().good); saveCamp();
  }
  function equip() {
    var r = rows[sel];
    if (r.kind === 'gun' && camp.guns[r.key]) { camp.gun = r.key; P.sfx(g, 'gun'); saveCamp(); return; }
    var own = D.GUN_IDS.filter(function (k) { return camp.guns[k]; }); camp.gun = own[(own.indexOf(camp.gun) + 1) % own.length]; P.sfx(g, 'gun'); saveCamp();
  }

  // ---------- меню ----------
  g.useStandardScreens({ lives: 1 });
  function newCampaign() { camp = E.create(diff); saveCamp(); phase = 'hangar'; sel = rows.length - 1; game = null; debrief = null; syncScore(); }
  g.menu.addItem({ key: 'play', index: 0, label: function () {
    return camp ? g.t('cont') + ' · ' + g.t('contAt').replace('{s}', Math.floor(camp.mi / 3) + 1).replace('{m}', camp.mi % 3 + 1) : g.t('play');
  }, onSelect: function () { if (!camp) newCampaign(); else { phase = 'hangar'; game = null; debrief = null; sel = rows.length - 1; } syncScore(); g.goto('play', { fresh: true }); } });
  g.menu.addItem({ key: 'newc', after: 'play', label: function () { return g.t('newc') + ' · ' + g.t('d_' + diff); }, onSelect: function () { newCampaign(); g.goto('play', { fresh: true }); } });
  g.menu.addItem({ key: 'diff', after: 'newc', label: function () { return g.t('diff') + ': ' + g.t('d_' + diff); }, onSelect: function () { diff = D.DIFFS[(D.DIFFS.indexOf(diff) + 1) % 3]; Store.set(DKEY, diff); } });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  g.state.best = Store.getNum('arcade.best.podryad', 0);

  // победа: итог карьеры
  g.scenes.win.draw = function (ctx) {
    var Cc = C(); this.clear(Cc.bg);
    if (demo) { ctx.save(); ctx.translate((W - K.FW) / 2, 0); RN.field(ctx, Cc, demo.state(), {}, this.time); ctx.restore(); }
    ctx.fillStyle = 'rgba(6,8,12,.78)'; ctx.fillRect(0, 0, W, H);
    RN.txt(this, this.t('win'), W / 2, H / 2 - 50, { size: 34, align: 'center', weight: 900, color: Cc.good }, Cc);
    RN.txt(this, this.t('winSub'), W / 2, H / 2 - 18, { size: 14, align: 'center', weight: 700, color: Cc.ink }, Cc);
    RN.txt(this, this.t('score') + ': ' + P.money(this.state.score) + '   ' + this.t('best') + ': ' + P.money(this.state.best), W / 2, H / 2 + 14, { size: 14, align: 'center', weight: 800, color: Cc.gold }, Cc);
    if (lastCareer) RN.txt(this, this.t('career').replace('{e}', P.money(lastCareer.earned)).replace('{d}', lastCareer.deaths), W / 2, H / 2 + 38, { size: 12, align: 'center', weight: 700, color: Cc.muted }, Cc);
    RN.txt(this, this.t('tapstart'), W / 2, H - 30, { size: 12, align: 'center', weight: 600, color: Cc.muted }, Cc);
  };
  var lastCareer = null, winEnter = g.scenes.win.enter;
  g.scenes.win.enter = function () { if (camp) lastCareer = { earned: camp.earned, deaths: camp.deaths }; camp = null; winEnter.call(this); };

  // ---------- титул: за панелью — живой полёт ----------
  var demo = null, demoT = 0, demoI = 0;
  function newDemo() { demo = P.Game({ si: demoI % 3, mj: 1, noHit: true, diff: 'easy', rng: D.mulberry32(5 + demoI), load: { guns: { rivet: 3, fan: 2 }, gun: 'fan', mods: ['turret', 'homer'] } }).start(); demoI++; demoT = 0; }
  newDemo();
  var title = g.scenes.title, menu = g.menu.get('title');
  title.update = function (dt) {
    demoT += dt; var s = demo.state(); demo.setInput(Math.sin(demoT * 0.7) * 0.8, s.P.y > 520 ? -0.3 : 0); demo.update(dt); RN.update(dt);
    if (demoT > 24 || s.phase !== 'play') newDemo();
  };
  title.draw = function (ctx) {
    var Cc = C(), retro = Cc.retro, th = this.th();
    ctx.fillStyle = retro ? '#000000' : '#0b1014'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate((W - K.FW) / 2, 0); ctx.beginPath(); ctx.rect(0, 0, K.FW, K.FH); ctx.clip(); RN.field(ctx, Cc, demo.state(), {}, this.time); ctx.restore();
    ctx.fillStyle = retro ? 'rgba(0,0,0,.6)' : 'rgba(8,12,16,.45)'; ctx.fillRect(0, 0, W, H);
    var pw = 480, ph = 430, x0 = (W - pw) / 2, y0 = 80;
    if (retro) { ctx.fillStyle = '#000'; ctx.fillRect(x0, y0, pw, ph); ctx.fillStyle = '#5555ff'; ctx.fillRect(x0, y0, pw, 3); ctx.fillRect(x0, y0 + ph - 3, pw, 3); ctx.fillRect(x0, y0, 3, ph); ctx.fillRect(x0 + pw - 3, y0, 3, ph); }
    else { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 26; ctx.fillStyle = 'rgba(18,25,32,.94)'; ctx.fillRect(x0, y0, pw, ph); ctx.restore(); ctx.strokeStyle = '#33464f'; ctx.strokeRect(x0 + 0.5, y0 + 0.5, pw - 1, ph - 1); }
    RN.txt(this, this.t('title'), W / 2, y0 + 62, { size: retro ? 44 : 54, align: 'center', color: Cc.accent, weight: 900 }, Cc);
    RN.hero(ctx, Cc, W / 2 - (retro ? 160 : 176), y0 + 44, { scale: 1.3, mods: ['turret', 'scythe'], noShadow: true }, this.time);
    RN.hero(ctx, Cc, W / 2 + (retro ? 160 : 176), y0 + 44, { scale: 1.3, mods: ['homer', 'homer'], noShadow: true }, this.time);
    RN.txt(this, this.t('subtitle'), W / 2, y0 + 92, { size: retro ? 11 : 13, align: 'center', color: th.ink, weight: 700 }, Cc);
    RN.txt(this, this.t('sub2'), W / 2, y0 + 112, { size: retro ? 9 : 11, align: 'center', color: th.muted, weight: 600 }, Cc);
    menu.draw(this, W / 2, y0 + 156, 32);
    RN.txt(this, this.t('best') + ': ' + P.money(this.state.best) + (camp ? '   ·   ' + this.t('funds') + ': ' + P.money(camp.money) + ' · ' + this.t('d_' + camp.diff) : ''), W / 2, y0 + ph - 20, { size: 11, align: 'center', color: th.muted, weight: 700 }, Cc);
    RN.txt(this, this.input.touchOnly ? this.t('hintTouch') : this.t('hintKeys'), W / 2, H - 24, { size: retro ? 9 : 10, align: 'center', color: th.muted, weight: 600 }, Cc);
  };

  // ---------- ввод ----------
  var cv = g.canvas;
  function inFly() { return g._sceneName === 'play' && phase === 'fly' && game && g.time - playSince > 0.15; }
  function scale() { var r = cv.getBoundingClientRect(); return W / (r.width || W); }
  function doBomb() { if (inFly()) game.bomb(); }
  function doCell() { if (inFly()) game.cell(); }
  function doGun() { if (inFly()) game.cycleGun(); else if (g._sceneName === 'play' && phase === 'hangar') equip(); }
  addEventListener('keydown', function (e) {
    if (g._sceneName !== 'play') return;
    var c = e.code;
    if (phase === 'fly') {
      if (c === 'KeyX' || c === 'KeyB') { e.preventDefault(); if (!e.repeat) doBomb(); }
      else if (c === 'KeyC' || c === 'KeyV') { e.preventDefault(); if (!e.repeat) doCell(); }
      else if (c === 'KeyQ' || c === 'Tab' || c === 'KeyE') { e.preventDefault(); if (!e.repeat) doGun(); }
    } else if (phase === 'hangar') {
      if (c === 'KeyX' || c === 'Backspace' || c === 'Delete' || c === 'Minus' || c === 'NumpadSubtract') { e.preventDefault(); doSell(); }
      else if (c === 'Equal' || c === 'NumpadAdd') { e.preventDefault(); doBuy(); }
      else if (c === 'KeyQ' || c === 'Tab') { e.preventDefault(); if (!e.repeat) equip(); }
    }
  });
  // палец / мышь: в полёте — относительное перемещение; в ангаре и итогах — клики
  var drag = null;
  function canvasPt(cx, cy) { var r = cv.getBoundingClientRect(), k = scale(); return { x: (cx - r.left) * k, y: (cy - r.top) * k }; }
  function tapUi(cx, cy) {
    if (g._sceneName !== 'play') return false;
    if (phase === 'debrief') { leaveDebrief(); return true; }
    if (phase !== 'hangar') return false;
    var pt = canvasPt(cx, cy);
    for (var i = hits.length - 1; i >= 0; i--) { var h = hits[i]; if (pt.x >= h.x && pt.x <= h.x + h.w && pt.y >= h.y && pt.y <= h.y + h.h) {
      if (h.act === 'buy') doBuy(h.row); else if (h.act === 'sell') doSell(h.row); else if (h.act === 'go') { sel = h.row; startFlight(); }
      else { if (sel === h.row && rows[sel].kind === 'gun' && camp.guns[rows[sel].key]) equip(); sel = h.row; P.sfx(g, 'move'); }
      return true; } }
    return true;
  }
  cv.addEventListener('touchstart', function (e) {
    if (g._sceneName !== 'play') return; e.preventDefault();
    if (phase !== 'fly') { tapUi(e.changedTouches[0].clientX, e.changedTouches[0].clientY); return; }
    for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i]; if (!drag) drag = { id: t.identifier, x: t.clientX, y: t.clientY }; else doBomb(); }
  }, { passive: false });
  cv.addEventListener('touchmove', function (e) {
    if (!drag || !game) return; e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i]; if (t.identifier !== drag.id) continue; var k = scale(); game.drag((t.clientX - drag.x) * k, (t.clientY - drag.y) * k); drag.x = t.clientX; drag.y = t.clientY; }
  }, { passive: false });
  function tEnd(e) { if (!drag) return; for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === drag.id) drag = null; }
  cv.addEventListener('touchend', tEnd, { passive: true }); cv.addEventListener('touchcancel', tEnd, { passive: true });
  cv.addEventListener('mousedown', function (e) {
    if (g._sceneName !== 'play') return;
    if (phase !== 'fly') { tapUi(e.clientX, e.clientY); return; }
    drag = { id: 'm', x: e.clientX, y: e.clientY }; if (e.button === 2) doBomb();
  });
  addEventListener('mousemove', function (e) { if (!drag || drag.id !== 'm' || !game || phase !== 'fly') return; var k = scale(); game.drag((e.clientX - drag.x) * k, (e.clientY - drag.y) * k); drag.x = e.clientX; drag.y = e.clientY; });
  addEventListener('mouseup', function () { if (drag && drag.id === 'm') drag = null; });
  addEventListener('blur', function () { drag = null; });
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  function btn(id, fn) { var b = document.getElementById(id); if (!b) return; var h = function (e) { e.preventDefault(); e.stopPropagation(); fn(b); }; b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h); }
  btn('bBomb', doBomb); btn('bCell', doCell); btn('bGun', doGun);
  btn('bPause', function () { if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });

  // ---------- сцена play ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!camp) newCampaign(); playSince = g.time; drag = null; syncScore(); },
    press: function (a) {
      if (a === 'pause') { this.pause(); return; }
      if (phase === 'hangar') {
        if (a === 'up') { sel = (sel + rows.length - 1) % rows.length; P.sfx(g, 'move'); }
        else if (a === 'down') { sel = (sel + 1) % rows.length; P.sfx(g, 'move'); }
        else if (a === 'right' || a === 'action' || a === 'start') doBuy();
        else if (a === 'left') doSell();
        return;
      }
      if (phase === 'debrief') { if (a === 'action' || a === 'start') leaveDebrief(); return; }
      if (phase === 'fly' && a === 'action') doBomb();
    },
    update: function (dt) {
      RN.update(dt);
      if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
      if (phase === 'fly' && game) {
        if (banner) { banner.a -= dt; if (banner.a <= 0) banner = null; }
        var d = this.input.dir; game.setInput(d.x, d.y); game.update(dt);
      } else if (phase === 'debrief' && debrief) debrief.t += dt;
    },
    draw: function (ctx) {
      var Cc = C();
      if (phase === 'hangar' || !game) { hits = RN.hangar(ctx, this, { camp: camp, sel: sel, rows: rows, msg: msg, touch: this.input.touchOnly }); return; }
      RN.draw(ctx, this, S(), { banner: banner, funds: camp.money, touch: this.input.touchOnly });
      if (phase === 'debrief' && debrief) drawDebrief(ctx, Cc);
    }
  });
  function drawDebrief(ctx, Cc) {
    var b = debrief, k = Math.min(1, b.t * 3), x0 = 40, y0 = 150, w = 360, h = 300;
    ctx.globalAlpha = k;
    ctx.fillStyle = Cc.retro ? '#000000' : 'rgba(10,14,18,.92)'; ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = b.ok ? Cc.good : Cc.bad; ctx.lineWidth = Cc.retro ? 3 : 2; ctx.strokeRect(x0 + 1, y0 + 1, w - 2, h - 2);
    var cx = x0 + w / 2, y = y0 + 44;
    RN.txt(g, b.sector ? g.t('sectorClear').replace('{s}', b.sector) : g.t(b.ok ? 'done' : 'fail'), cx, y, { size: 24, weight: 900, align: 'center', color: b.ok ? Cc.good : Cc.bad }, Cc);
    y += 24; RN.txt(g, g.t('mn' + b.mi), cx, y, { size: 13, weight: 700, align: 'center', color: Cc.muted }, Cc);
    y += 40; RN.txt(g, g.t('earned') + ': ' + P.money(b.money), cx, y, { size: 20, weight: 900, align: 'center', color: b.ok ? Cc.gold : Cc.muted }, Cc);
    y += 22; ctx.font = '600 11px sans-serif'; y = RN.wrapC(g, b.ok ? g.t('paid') : g.t('failNote'), cx, y, w - 40, 15, { size: 11, weight: 600, color: Cc.muted }, Cc);
    y += 16; RN.txt(g, g.t('kills') + ': ' + b.kills + '   ·   ' + g.t('gkills') + ': ' + b.gkills, cx, y, { size: 12, weight: 700, align: 'center', color: Cc.ink }, Cc);
    if (!b.ok) { y += 30; RN.txt(g, b.lost ? g.t('lostMod').replace('{x}', b.lost) : g.t('lostNone'), cx, y, { size: 14, weight: 800, align: 'center', color: b.lost ? Cc.warn : Cc.muted }, Cc); }
    y += 34; RN.txt(g, g.t('funds') + ': ' + P.money(camp.money), cx, y, { size: 13, weight: 800, align: 'center', color: Cc.gold }, Cc);
    RN.txt(g, g.t('next'), cx, y0 + h - 16, { size: 11, weight: 600, align: 'center', color: Cc.muted }, Cc);
    ctx.globalAlpha = 1;
  }

  // ---------- DOM: подгонка канвы, подписи ----------
  function $(id) { return document.getElementById(id); }
  function fit() {
    var wrap = cv.parentElement, pad = document.querySelector('.pad'), padH = (pad && getComputedStyle(pad).display !== 'none') ? 70 : 0;
    var availH = innerHeight - 70 - padH;
    var w = Math.min(860, (wrap && wrap.clientWidth) || W, availH * W / H);
    w = Math.max(280, Math.floor(w)); cv.style.width = w + 'px'; cv.style.height = Math.round(w * H / W) + 'px';
  }
  var lastLang = null, lastTheme = null;
  function domSync() {
    var lang = g.i18n.lang, theme = g.themeName;
    if (lang !== lastLang) {
      lastLang = lang; document.documentElement.lang = lang;
      var b = $('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = $('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
      [['bBomb', 'bBomb'], ['bCell', 'bCell'], ['bGun', 'bGun']].forEach(function (p) { var el = $(p[0]); if (el) el.textContent = g.t(p[1]); });
    }
    if (theme !== lastTheme) { lastTheme = theme; document.body.setAttribute('data-theme', theme); }
  }
  fit(); addEventListener('resize', fit); domSync(); setInterval(domSync, 250);

  g.start('title');
  // для автотестов в браузере
  P.app = { g: g, game: function () { return game; }, camp: function () { return camp; }, phase: function () { return phase; },
    newCampaign: newCampaign, startFlight: startFlight, buy: function (id) { sel = rows.findIndex(function (r) { return r.id === id; }); doBuy(); }, setDiff: function (d) { diff = d; } };
})(typeof window !== 'undefined' ? window : globalThis);
