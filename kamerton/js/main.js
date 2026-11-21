/* КАМЕРТОН · сборка игры на фреймворке Гефест Arcade v2: сцены, ввод (клавиши и тач-кнопки), сохранение по фонарикам
   (localStorage kamerton.save), музыка и звук среды по зонам, камера-кадр, связь логики с рендером.
   Отладка/скриншоты: #z=<зона 0..5>&cp=<отметка> — начать с нужного места (как «Продолжить»). */
(function (global) {
  'use strict';
  var K = global.KAMER, RD = K.render;
  var W = 960, H = 540, SAVE = 'kamerton.save', ZN = K.LEVELS.length;
  var THEMES = {
    modern: { bg: '#171a2e', panel: '#2a2030', ink: '#f3e6cc', muted: '#b9a283', accent: '#e0a24a', good: '#8fdcff', bad: '#d0705a', warn: '#e0a24a', grid: '#3a2e36', font: 'Georgia, "Times New Roman", serif', pixel: false, glow: false, radius: 6 },
    retro: { bg: '#000044', panel: '#220022', ink: '#ffeedd', muted: '#ddaa44', accent: '#ffaa22', good: '#55ffff', bad: '#ff5555', warn: '#ffaa22', grid: '#331144', font: '"Courier New", ui-monospace, monospace', pixel: true, glow: false, radius: 0 }
  };
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'kamerton', leaderboard: 'kamerton', strings: K.STR, theme: 'modern', themes: THEMES });
  K.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);

  // ---------- сохранение ----------
  function loadSave() { try { var s = localStorage.getItem(SAVE); var o = s ? JSON.parse(s) : null; return o && K.LEVELS[o.z] ? o : null; } catch (e) { return null; } }
  function writeSave(o) { g.storeSet(SAVE, JSON.stringify(o)); }
  function clearSave() { try { localStorage.removeItem(SAVE); } catch (e) {} if (g.platform) g.storeSet(SAVE, ''); }
  g.persist(SAVE, 'last'); g.persist('arcade.best.kamerton', 'max');
  // ---------- мета-прогрессия: выбор зоны, звёзды за зону (js/meta.js), всё — в облако площадки ----------
  var Store = Arcade.Store, M = K.meta, START_KEY = 'arcade.kamerton.start';
  var prog = M.Progress({ get: function (k) { return Store.get(k, null); }, set: function (k, v) { g.storeSet(k, v); } });
  g.persist(START_KEY, 'last'); g.persist(M.REACH, 'max');
  for (var lv = 1; lv <= M.LEVELS; lv++) g.persist(M.key(lv), 'max');
  function startZ() { var v = parseInt(Store.get(START_KEY, '1'), 10) || 1; return prog.unlocked(v) ? v : 1; }
  function nextStart(dir) { g.storeSet(START_KEY, prog.next(startZ(), dir || 1)); }
  var zoneStops0 = 0, zoneEnded = false, starNote = null;
  function recordZone(z, skipped) {   // z — номер пройденной зоны (1..6)
    var S = game.state(), stops = S.deaths - zoneStops0; prog.reached(Math.min(M.LEVELS, z + 1));
    if (skipped) { starNote = null; return; }
    var r = M.stars({ stops: stops }), isNew = prog.record(z, r.n); starNote = { z: z, text: M.starStr(r.n) + (isNew ? '  ' + g.t('starNew') : ''), t: 3.4 };
  }
  function debugStart() {
    var src = location.hash + location.search, m = /[#&?]z=(\d+)/.exec(src); if (!m) return null;
    var z = Math.min(ZN - 1, +m[1]), c = /[#&?]cp=(\d+)/.exec(src), cp = c ? Math.min(K.LEVELS[z].cps.length - 1, +c[1]) : 0;
    return { z: z, cp: cp, snap: null };
  }

  // ---------- игра ----------
  var game = null, touch = { jump: false, act: false, sw: false };
  function music(z) { var T = Arcade.kamerTracks; if (T && T[z]) g.audio.setMusic(T[z]); }
  function onEvent(type, d) {
    K.sfx(g, type, d);
    var S = game && game.state();
    if (type === 'checkpoint' && S) { var sv = game.saveData(); sv.deaths = S.deaths; sv.played = S.played; writeSave(sv); }
    if (type === 'zoneEnd' && S) { recordZone(d.z + 1, !!d.skip); zoneEnded = true; }
    if (type === 'zone') {
      music(d.z); if (S) { S._enterT = 1.2; zoneStops0 = S.deaths; } RD.cam.z = -1;
      if (zoneEnded) { zoneEnded = false; if (g.adReady()) { cardZ = d.z; g.goto('card'); } }   // межстраничная — по нажатию на карточке зоны (Яндекс 4.4)
    }
    if (type === 'win') {
      recordZone(ZN, false); clearSave(); var s2 = game.state();
      g.state.score = Math.max(100, Math.round(8000 - s2.deaths * 50 - s2.played / 2)); g.state.level = ZN;
      music(ZN); setTimeout(function () { if (g._sceneName === 'play') g.win(); }, 2200);
    }
  }
  function newGame(save) {
    game = K.Game({ onEvent: onEvent, save: save || null }); K.current = game; game.start();
    var S = game.state(); if (save) { S.deaths = save.deaths || 0; S.played = save.played || 0; } zoneStops0 = S.deaths; zoneEnded = false;
    RD.cam.z = -1; S._enterT = 1.2; g.state.score = 0; g.state.level = S.z + 1;
  }

  // ---------- стандартные экраны: «Продолжить», пауза «К последнему фонарику» ----------
  g.useStandardScreens({ get subtitle() { return g.t('subtitle'); }, lives: 0 });
  // ---------- Площадка (движок v2.8): таблица лидеров «kamerton» и «Без рекламы» (товар no_ads) в меню и паузе ----------
  // Консоль: Яндекс — лидерборд с техническим именем «kamerton», GamePush — числовое поле игрока «kamerton» + лидерборд; товар no_ads
  // (постоянный). Список — promo/kamerton/platform.json (arcade-full). На сайте (без площадки) пунктов нет. После покупки межстраничной
  // и стики нет, ролики за награду остаются по желанию игрока.
  var LB = 'kamerton';
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });   // облако слито: рекорд с другого устройства — в таблицу
  function contItem() { return { key: 'cont', label: function () { var s = loadSave(); return g.t('cont') + (s ? ' · ' + (s.z + 1) + '/' + ZN : ''); }, onSelect: function () { K._resume = loadSave(); this.goto('play'); }, before: 'play' }; }
  function refreshMenu() {
    var has = !!loadSave(), items = g.menu.items('title');
    if (has && items.indexOf('cont') < 0) g.menu.addItem(contItem());
    if (!has && items.indexOf('cont') >= 0) g.menu.removeItem('cont');
    var m = g.menu.get('title'); if (m) m.sel = 0;
  }
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); }, onSelect: function () { if (game) game.restartCp(); this.goto('play', { resume: true }); } });
  // Реклама за награду (только площадки с рекламой): гибели-«поражения» нет (остановился завод → снова у фонарика), поэтому «ещё шанс» не нужен;
  // бонус в паузе — пропустить зону, если головоломка не даётся (раз за партию; звёзд за пропущенную зону нет).
  g.useRewardedBonus({ key: 'rwSkip', scene: 'pause', label: function () { return g.t('rwSkip'); }, available: function () { return !!game && game.canSkip(); }, grant: function () { if (game) game.skipZone(); } });
  var title = g.scenes.title, menu = title._menu, oldEnter = title.enter;
  // пункт «Зона N/6 ★★☆» — с какой зоны начинать «Новый путь»: выбор/тап — следующая открытая, ← → — по кругу
  g.menu.addItem({ key: 'zonepick', after: 'play', label: function () { var n = startZ(); return g.t('zonePick') + ' ' + n + '/' + ZN + '  ' + M.starStr(prog.get(n)); }, onSelect: function () { nextStart(1); } });
  title.press = function (a) { var it = menu && menu.current(); if (it && it.key === 'zonepick' && (a === 'left' || a === 'right')) { nextStart(a === 'left' ? -1 : 1); this.audio.beep(600, 0.03); } };
  title.enter = function (d) { if (oldEnter) oldEnter.call(this, d); refreshMenu(); K.stopAmbience(); };
  // живой фон заставки: мастерская, подмастерье будит носильщика и ведёт его к плите
  var demo = null, demoT = 0;
  function demoReset() { demo = K.Game({ save: { z: 0, cp: 1, snap: null } }).start(); demoT = 0; RD.cam.z = -1; }
  demoReset();
  title.update = function (dt) {
    demoT += dt; var s = demo.state(), h = demo.hero(), p1 = demo.body('p1'), inp = { x: 0 };
    if (s.d.ctl === 'hero' && !p1.att) { if (h.x + 9 < 1176) inp.x = 1; else inp = { act: demoT % 0.4 < 0.2 }; }
    else if (s.d.ctl === 'p1') { if (p1.x + 14 < 1350) inp.x = 1; else if (demoT > 9) inp = { sw: true }; }
    else { inp.x = h.x < 1700 ? 1 : 0; if (demoT > 22) demoReset(); }
    demo.setInput(inp); demo.update(dt); RD.updateCam(demo.state(), demo, dt);
  };
  // Меню заставки вмещает пункты площадки («Лидеры», «Без рекламы»; 21.11): если пунктов больше, чем помещается, шаг сжимается (не меньше 19)
  // и меню поднимается, но не выше yMin; на сайте (без пунктов площадки) — как раньше.
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }
  title.draw = function (ctx) {
    var th = this.th();
    RD.draw(ctx, demo.state(), g, { game: demo, hud: false, overlay: function (c, p, flat) {
      var pw = 500, ph = 300, px = (W - pw) / 2, py = 96;
      c.save(); c.fillStyle = flat ? 'rgba(0,0,30,0.82)' : 'rgba(18,12,16,0.78)'; c.fillRect(px, py, pw, ph);
      c.strokeStyle = p.brass; c.lineWidth = 2; c.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1); c.strokeStyle = p.brassD; c.lineWidth = 1; c.strokeRect(px + 6.5, py + 6.5, pw - 13, ph - 13);
      // камертон-эмблема
      var ex = px + 40, ey = py + 50; c.strokeStyle = p.core; c.lineWidth = 3; c.beginPath(); c.moveTo(ex, ey + 22); c.lineTo(ex, ey + 8); c.moveTo(ex - 7, ey - 16); c.lineTo(ex - 7, ey + 8); c.lineTo(ex + 7, ey + 8); c.lineTo(ex + 7, ey - 16); c.stroke();
      c.globalAlpha = 0.25 + 0.15 * Math.sin(g.time * 4); c.fillStyle = p.core; c.beginPath(); c.arc(ex, ey - 4, 16, 0, Math.PI * 2); c.fill(); c.restore();
      g.text(g.t('title'), W / 2 + 14, py + 64, { size: 46, align: 'center', color: p.warm, weight: 700, font: th.font, maxWidth: pw - 110 });
      g.text(g.t('subtitle'), W / 2, py + 94, { size: 15, align: 'center', color: th.muted, weight: 400, font: th.font, maxWidth: pw - 40 });
      var mf = menuFit(menu, py + 128, 26, py + 116, py + ph - 36); menu.draw(g, W / 2, mf[0], mf[1]);
      g.text(g.t('starsHint') + ' · ' + prog.total() + '/' + (M.LEVELS * 3) + (g.state.best ? '   ' + g.t('best') + ': ' + g.state.best : ''), W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 24 });
      g.text(g.t(g.input.touchOnly ? 'hintTouch' : 'hint'), W / 2, g.input.touchOnly ? RD.BAR - 8 : H - 13, { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: W - 130 });
    } });
  };

  // ---------- игровая сцена ----------
  var lastDt = 1 / 60;
  g.scene('play', {
    realtime: true,
    enter: function (d) {
      if (d && d.resume) return;
      var sv = K._resume || debugStart(); K._resume = null; g.resetRun();
      if (!sv) { clearSave(); if (startZ() > 1) sv = { z: startZ() - 1, cp: 0, snap: null }; }
      newGame(sv);
    },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return; lastDt = dt;
      var inp = this.input, c = inp.codes;
      game.setInput({
        x: inp.dir.x, y: inp.dir.y > 0 ? 1 : 0, up: inp.dir.y < 0,
        jump: inp.pressed('action') || !!c.KeyZ || !!c.KeyK || touch.jump,
        act: !!(c.KeyE || c.KeyX || c.KeyJ || c.KeyF) || touch.act,
        sw: !!(c.KeyQ || c.Tab || c.KeyC || c.ShiftLeft || c.ShiftRight) || touch.sw
      });
      game.update(dt);
      var S = game.state();
      if (S._enterT > 0) S._enterT = Math.max(0, S._enterT - dt * 1.1);
      RD.updateCam(S, game, dt);
      K.ambience(g, S, dt);
      g.state.level = S.z + 1;
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; } RD.draw(ctx, game.state(), g, { game: game });
      if (starNote && starNote.t > 0) { starNote.t -= lastDt; var th = this.th(); this.text(g.t('zoneDone') + ' ' + starNote.z + '  ' + starNote.text, W / 2, RD.BAR + 30, { size: 20, align: 'center', color: th.accent, weight: 700, font: th.font, maxWidth: W - 140 }); }
    }
  });
  // ---------- Карточка «зона пройдена» (только когда площадка готова показать межстраничную): нажатие → реклама → дальше ----------
  var cardZ = 0, cardGoing = false;
  function cardGo() { if (cardGoing || g._sceneName !== 'card') return; cardGoing = true; g.adBreak().then(function () { cardGoing = false; if (g._sceneName === 'card') g.goto('play', { resume: true }); }); }
  g.scene('card', {
    enter: function () { cardGoing = false; },
    press: function (a) { if (a === 'action' || a === 'start') cardGo(); else if (a === 'pause') this.goto('play', { resume: true }); },
    draw: function (ctx) {
      var th = this.th();
      if (game) RD.draw(ctx, game.state(), g, { game: game, overlay: function (c) { c.fillStyle = 'rgba(8,6,12,0.62)'; c.fillRect(0, 0, W, H); } });
      this.text(this.t('zoneDone') + ' ' + cardZ + '/' + ZN, W / 2, H / 2 - 30, { size: 34, align: 'center', color: th.accent, weight: 700, font: th.font, maxWidth: W - 160 });
      if (starNote) this.text(starNote.text, W / 2, H / 2 + 12, { size: 26, align: 'center', color: th.ink, weight: 700, maxWidth: W - 160 });
      this.text(this.t('cardNext'), W / 2, H / 2 + 56, { size: 15, align: 'center', color: th.muted, weight: 600, maxWidth: W - 160 });
    }
  });
  g.canvas.addEventListener('mousedown', function () { if (g._sceneName === 'card') cardGo(); });
  g.canvas.addEventListener('touchstart', function (e) { if (g._sceneName === 'card') { e.preventDefault(); cardGo(); } }, { passive: false });
  // Tab не уводит фокус из игры
  global.addEventListener('keydown', function (e) { if (e.code === 'Tab' && g._sceneName === 'play') e.preventDefault(); });
  // пауза: тёмная плашка поверх замершего кадра
  g.scenes.pause.draw = function (ctx) {
    var th = this.th(), pm = g.menu.get('pause');
    if (game) RD.draw(ctx, game.state(), g, { game: game, overlay: function (c, p, flat) {
      c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, 0, W, H);
      var pw = 380, ph = 270, px = (W - pw) / 2, py = (H - ph) / 2;
      c.fillStyle = flat ? '#110022' : 'rgba(22,15,20,0.92)'; c.fillRect(px, py, pw, ph); c.strokeStyle = p.brass; c.lineWidth = 2; c.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
      c.fillStyle = p.brass; c.fillRect(W / 2 - 12, py + 24, 7, 28); c.fillRect(W / 2 + 5, py + 24, 7, 28);
      if (pm) { var pf = menuFit(pm, py + 96, 32, py + 70, py + ph - 40); pm.draw(g, W / 2, pf[0], pf[1]); }   // с «Без рекламы» пунктов больше — сжать (21.11)
      var S = game.state(); g.text('◷ ' + S.deaths + '   ' + (S.z + 1) + '/' + ZN, W / 2, py + ph - 14, { size: 13, align: 'center', color: th.muted, weight: 600 });
    } });
  };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  // финал: город просыпается — окна загораются, куклы стоят в ряд
  g.scenes.win.draw = function (ctx) {
    var th = this.th(), t = this.time, retro = this.themeName === 'retro', p = RD.PAL[retro ? 'retro' : 'modern'];
    var sg = ctx.createLinearGradient(0, 0, 0, H); sg.addColorStop(0, retro ? '#442266' : '#2c2a48'); sg.addColorStop(1, retro ? '#ffaa22' : '#f0b070'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = p.mid; for (var i = 0; i < 14; i++) { var bx = i * 72, bh = 120 + ((i * 53) % 90); ctx.fillRect(bx, 400 - bh, 66, bh + 140); ctx.fillStyle = p.warm; for (var w = 0; w < 4; w++) if (((i + w) * 7 + Math.floor(t * 2)) % 5 < Math.min(4, t)) ctx.fillRect(bx + 10 + w * 13, 420 - bh + 20, 8, 12); ctx.fillStyle = p.mid; }
    ctx.fillStyle = p.ground; ctx.fillRect(0, 400, W, 140);
    var kinds = ['soldier', 'soldier', 'porter', 'hero', 'dancer', 'giant'], x0 = W / 2 - 180;
    kinds.forEach(function (k, j) { var kk = K.KIND[k]; RD.drawBody(ctx, { kind: k, x: x0 + j * 66 - kk.w / 2, y: 400 - kk.h, w: kk.w, h: kk.h, vx: 0, gr: true, face: 1, att: true }, p, t, 'hero'); });
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, RD.BAR); ctx.fillRect(0, H - RD.BAR, W, RD.BAR);
    this.text(this.t('win'), W / 2, 120, { size: 40, align: 'center', color: p.porcelain, weight: 700, font: th.font, maxWidth: W - 40 });
    var S = game && game.state();
    var line = this.t('score') + ': ' + (this.state.score | 0) + (this.state.best ? '   ' + this.t('best') + ': ' + this.state.best : '') + (S ? '   ◷ ' + S.deaths + ' ' + this.t('stops') : '');
    this.text(line, W / 2, 156, { size: 15, align: 'center', color: p.porcelain, weight: 600, font: th.font });
    this.text(this.t('tapstart'), W / 2, H - 12, { size: 12, align: 'center', color: th.muted, weight: 600 });
  };

  // ---------- тач: прыжок, действие, переключение, пауза ----------
  function hold(id, key) {
    var b = document.getElementById(id); if (!b) return;
    var on = function (e) { e.preventDefault(); touch[key] = true; }, off = function (e) { e.preventDefault(); touch[key] = false; };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off, { passive: false }); b.addEventListener('touchcancel', off, { passive: false });
    b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off);
  }
  hold('bJump', 'jump'); hold('bAct', 'act'); hold('bSw', 'sw');
  var bp = document.getElementById('bPause');
  if (bp) { var tp = function (e) { e.preventDefault(); if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); }; bp.addEventListener('touchstart', tp, { passive: false }); bp.addEventListener('mousedown', tp); }

  var lastLang = null;
  g.onCloud(function () { if (g._sceneName === 'title') refreshMenu(); });
  function syncDom() { if (lastLang === g.i18n.lang) return; lastLang = g.i18n.lang; var f = document.getElementById('foot'); if (f) f.textContent = g.t('foot') + ' ' + g.t('hint') + '.'; }
  syncDom(); setInterval(syncDom, 250);

  g.start('title');
})(window);
