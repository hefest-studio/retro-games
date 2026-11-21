/* ЗАСЛОН · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js)
   + рендеры retro/modern + звук. Сцены title/pause/win/gameover — g.useStandardScreens,
   титул переопределён (параллакс + панель с меню). Мастерская — фаза внутри сцены play. */
(function (global) {
  'use strict';
  var Z = global.ZASLON, C = Z.consts;
  // Палитры движка (меню, пауза, финалы) — в тон игре: тёмно-синий космос, оранжевый акцент
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#060914', panel: '#121a2c', ink: '#eef2f8', muted: '#8d9ab3', accent: '#ff7a1a', grid: '#1c2740' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#fc9838', muted: '#a49484' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: C.W, height: C.H, gameId: 'zaslon', leaderboard: 'zaslon', strings: Z.STR, theme: 'modern', lives: 3, themes: themes });
  Z.g = g;
  g.input.bindDpad(document.querySelector('.pad'));

  // ---------- Мета-прогрессия: выбор открытого сектора и звёзды (js/meta.js); прогресс — и в облако площадки ----------
  var M = Z.meta, prog = M.Progress({ get: function (k) { return Arcade.Store.get(k, null); }, set: function (k, v) { g.storeSet(k, v); } });
  for (var lv = 1; lv <= M.LEVELS; lv++) g.persist(M.key(lv), 'max');
  var START_KEY = 'arcade.zaslon.start'; g.persist(START_KEY, 'last');
  function startLv() { var v = parseInt(Arcade.Store.get(START_KEY, '1'), 10) || 1; return prog.unlocked(v) ? v : prog.maxUnlocked(); }
  function setStart(v) { g.storeSet(START_KEY, v); }
  var runStart = 1;
  function onClearStars(d) {
    var r = M.stars({ level: d.sector, lost: d.lost, base: d.base }), before = prog.maxUnlocked(), isNew = prog.record(d.sector, r.n), after = prog.maxUnlocked();
    if (after > before) setStart(after);
    return { n: r.n, isNew: isNew, opened: after > before ? after : 0 };
  }
  // Реклама за награду (только на площадках с рекламой): «ещё один шанс» раз за партию — корабль и/или заслон до 50%;
  // бонус в паузе — починка заслона +25% (раз за партию, если поврежден). Межстраничная — при выходе из мастерской («В бой →»).
  g.useRewardedContinue({ revive: function () { if (game) { game.reviveAd(); sync(); } } });
  g.useRewardedBonus({ key: 'rwRepair', scene: 'pause', label: function () { return g.t('rwRepair'); },
    available: function () { var s = game && game.state(); return !!s && !s.over && s.base < C.BASE_MAX; },
    grant: function () { if (game) { game.repairAd(); sync(); } } });

  function rnd() { return g.themeName === 'retro' ? Z.classic : Z.modern; }
  var game = null, toasts = [], playSince = 0;

  function diff(base, step, max) {   // уровень движка = номер сектора
    if (game) g.state.level = game.state().sector || 1;
    return g.difficulty(base, step, max);
  }
  function sync() { if (!game) return; var s = game.state(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = s.sector; }
  function toast(text, color, x, y) {
    for (var i = 0; i < toasts.length; i++) if (toasts[i].t > 0.8 && Math.abs(toasts[i].y - y) < 16) y -= 18;
    toasts.push({ text: text, color: color, x: Math.max(70, Math.min(C.W - 70, x)), y: y, t: 1.3 });
  }

  function fx(type, d) {
    var P = rnd().P, pix = P.pixel, sz = pix ? 4 : 3;
    if (type === 'kill') {
      g.particles.spawn(d.x, d.y, { color: P.en[d.kind] || P.accent, count: d.kind === 'hulk' ? 22 : 12, speed: 130, life: 0.55, size: sz });
      g.particles.spawn(d.x, d.y, { color: '#ffffff', count: 5, speed: 70, life: 0.3, size: pix ? 3 : 2 });
    } else if (type === 'breach') {
      g.particles.spawn(d.x, C.BREACH_Y, { color: P.cyan, count: 18, speed: 150, life: 0.6, size: sz });
      toast('−' + d.dmg + '% ' + g.t('base'), P.bad, d.x, C.BREACH_Y - 26);
    } else if (type === 'shieldHit' || type === 'die') {
      g.particles.spawn(d.x, d.y, { color: type === 'die' ? P.accent : P.cyan, count: type === 'die' ? 34 : 12, speed: type === 'die' ? 170 : 90, life: type === 'die' ? 0.9 : 0.4, size: sz });
      if (type === 'die') g.particles.spawn(d.x, d.y, { color: '#ffffff', count: 12, speed: 90, life: 0.6, size: 3 });
    } else if (type === 'bossHit') {
      g.particles.spawn(d.x, d.y, { color: '#ffd36a', count: 3, speed: 60, life: 0.25, size: 2 });
    } else if (type === 'bossDie') {
      g.particles.spawn(d.x, d.y, { color: P.accent, count: 60, speed: 230, life: 1.3, size: sz + 1 });
      g.particles.spawn(d.x, d.y, { color: '#fff3c8', count: 30, speed: 140, life: 1.0, size: sz });
      g.particles.spawn(d.x, d.y, { color: P.cyan, count: 20, speed: 260, life: 0.8, size: sz });
      toast('+' + d.pts, P.accent, d.x, d.y - 10); toast('+' + d.scrap + ' ' + g.t('scrap'), P.scrap, d.x, d.y + 14);
    } else if (type === 'bomb') {
      var S = game && game.state();
      for (var i = 0; i < 6; i++) g.particles.spawn(Math.random() * C.W, Math.random() * C.H * 0.8, { color: P.cyan, count: 8, speed: 120, life: 0.6, size: sz });
      if (S) toast(g.t('bombs') + ': ' + S.player.bombs, P.cyan, S.player.x, S.player.y - 40);
    }
  }

  function onEvent(type, d) {
    Z.sfx(g, type, d); fx(type, d);
    var S = game && game.state(), P = rnd().P;
    if (S) {
      if (type === 'capsule') toast(g.t('w_' + d.type) + (d.bonus ? ' +' + d.bonus : ' · ' + g.t('lvl') + ' ' + d.lv), P.wpn[d.type], S.player.x, S.player.y - 36);
      else if (type === 'clear') { toast(g.t('bonus') + ' +' + d.bonus + ' · +' + d.scrap + ' ' + g.t('scrap'), P.good, C.W / 2, 330);
        var st = onClearStars(d); toast(M.starStr(st.n) + (st.isNew ? '  ' + g.t('starNew') : ''), P.accent, C.W / 2, 362);
        if (st.opened) toast(g.t('opened').replace('{n}', st.opened), P.cyan, C.W / 2, 392); }
      else if (type === 'sector' && d.sector > runStart) g.adBreak();   // игрок нажал «В бой →» в мастерской — естественная пауза
      else if (type === 'revive') toast(g.t('revived'), P.accent, C.W / 2, 380);
      else if (type === 'repair') toast(g.t('base') + ' +25%', P.cyan, C.W / 2, C.BREACH_Y - 26);
      else if (type === 'buy') toast(g.t('bought') + ': ' + g.t('s_' + d.key), P.good, C.W / 2, 560);
      else if (type === 'deny') toast(g.t('noScrap'), P.bad, C.W / 2, 560);
    }
    sync();
    if (type === 'win') g.win();
    else if (type === 'gameover') g.gameover();
  }

  function newGame() {
    runStart = startLv();
    game = Z.Game({ lives: 3, diff: diff, onEvent: onEvent, startSector: runStart });
    game.start(); Z.current = game; toasts = []; sync();
  }
  function doBomb() { if (g._sceneName === 'play' && game && g.time - playSince > 0.15) game.bomb(); }
  Z.ui.init(g, doBomb);
  addEventListener('keydown', function (e) {
    if ((e.code === 'KeyB' || e.code === 'KeyX') && !e.repeat) { if (g._sceneName === 'play') { e.preventDefault(); doBomb(); } }
  });

  // ---------- Стандартные экраны + параллакс на всех экранах ----------
  g.useStandardScreens({ lives: 3 });
  // ---------- Площадка (движок v2.8): таблица лидеров «zaslon» и «Без рекламы» (товар no_ads) в меню и паузе ----------
  // Консоль: Яндекс — лидерборд с техническим именем «zaslon», GamePush — числовое поле игрока «zaslon» + лидерборд; товар no_ads
  // (постоянный). Список — promo/zaslon/platform.json (arcade-full). На сайте (без площадки) пунктов нет. После покупки межстраничной
  // и стики нет, ролики за награду остаются по желанию игрока.
  var LB = 'zaslon';
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });   // облако слито: рекорд с другого устройства — в таблицу
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) { baseClear.call(this, c); rnd().bg(this.ctx, this, this.time * 40, 1); };

  var title = g.scenes.title, menu = g.menu.get('title');
  // пункт «Сектор N ★★☆»: выбор/тап — следующий открытый, ← → — по кругу
  g.menu.addItem({ key: 'level', scene: 'title', after: 'play', label: function () { var n = startLv(); return g.t('lvPick') + ' ' + n + '  ' + M.starStr(prog.get(n)); },
    onSelect: function () { setStart(prog.next(startLv(), 1)); } });
  title.press = function (a) { var it = menu && menu.current(); if (it && it.key === 'level' && (a === 'left' || a === 'right')) { setStart(prog.next(startLv(), a === 'left' ? -1 : 1)); this.audio.beep(600, 0.03); } };
  // Меню заставки вмещает пункты площадки («Лидеры», «Без рекламы»; 21.11): если пунктов больше, чем помещается, шаг сжимается (не меньше 19)
  // и меню поднимается, но не выше yMin; на сайте (без пунктов площадки) — как раньше.
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }
  title.draw = function (ctx) {
    var r = rnd(), P = r.P, retro = P.pixel, W = this.W, H = this.H, t = this.time;
    r.bg(ctx, this, t * 50, 1 + ((t / 9) | 0) % 5);
    var px = 50, pw = W - 100, py = 92, ph = 400;
    Z.ui.panel(ctx, px, py, pw, ph, P);
    Z.ui.txt(this, this.t('title'), W / 2, py + 64, { size: 52, align: 'center', color: P.accent, weight: 900 }, P);
    // «заслон» под заголовком — светящаяся полоса
    Z.ui.barrier(ctx, W / 2 - 120, py + 80, 240, 1, t, P);
    Z.ui.txt(this, this.t('subtitle'), W / 2, py + 108, { size: 12, align: 'center', color: P.muted, weight: 600 }, P);
    var mf = menuFit(menu, py + 148, 28, py + 134, py + 288); menu.draw(this, W / 2, mf[0], mf[1]);
    // ряд врагов
    var kinds = ['mite', 'dart', 'weaver', 'carrier', 'hulk'];
    for (var i = 0; i < kinds.length; i++) {
      var x = W / 2 + (i - 2) * 66, y = py + 314 + Math.sin(t * 2 + i) * 4;
      r.icon(ctx, kinds[i], x, y, this);
      Z.ui.txt(this, this.t('e_' + kinds[i]), x, py + 350, { size: 11, align: 'center', color: P.muted, weight: 700 }, P);
    }
    if (this.state.best) Z.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 12, { size: 12, align: 'center', color: P.muted, weight: 600 }, P);
    // корабль под панелью
    r.ship(ctx, W / 2, 548 + Math.sin(t * 1.5) * 4, this, { modules: 2, shield: true });
    Z.ui.txt(this, this.t('hint1'), W / 2, H - 34, { size: 11, align: 'center', color: P.muted, weight: 600 }, P);
    Z.ui.txt(this, this.t('hint2'), W / 2, H - 16, { size: 11, align: 'center', color: P.muted, weight: 600 }, P);
  };

  // ---------- Игровая сцена ----------
  function inShop() { return game && game.state().phase === 'shop'; }
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; },
    press: function (a) {
      if (!game) return;
      if (a === 'pause') { this.pause(); return; }
      if (inShop()) {
        if (a === 'up') game.shopMove(-1);
        else if (a === 'down') game.shopMove(1);
        else if (a === 'action' || a === 'start') game.shopConfirm();
      }
    },
    update: function (dt) {
      if (!game) return;
      var shop = inShop();
      game.setDir(shop ? 0 : this.input.dir.x, shop ? 0 : this.input.dir.y);
      game.setFire(!shop && this.input.pressed('action'));
      game.update(dt);
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      var S = game.state(), r = rnd();
      r.draw(ctx, S, this);
      Z.ui.hud(this, S, r.P);
      if (S.phase === 'shop') Z.ui.shop(this, S, game.shopItems(), r.P, r);
      Z.ui.toasts(this, toasts, r.P);
    }
  });

  // ---------- Мышь/палец в мастерской ----------
  var cv = g.canvas;
  function canvasY(e) { var b = cv.getBoundingClientRect(); return (e.clientY - b.top) * (g.H / b.height); }
  function shopTap(e) {
    if (g._sceneName !== 'play' || !inShop()) return;
    var p = e.changedTouches ? e.changedTouches[0] : e, i = Z.ui.shopRowAt(canvasY(p));
    if (i < 0) return;
    if (e.cancelable) e.preventDefault();
    if (game.state().shop.sel === i) game.shopConfirm(); else { game.shopSelect(i); Z.sfx(g, 'shopMove'); }
  }
  cv.addEventListener('mousedown', shopTap);
  cv.addEventListener('touchstart', shopTap, { passive: false });

  g.start('title');
  Z.app = { g: g, game: function () { return game; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
