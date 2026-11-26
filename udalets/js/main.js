/* УДАЛЕЦ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js, levels.js) + рендер обеих тем + звук.
   Переделка 2026-11: главная механика — кузнечные мехи (раздуть горны, сдуть обитателей, подскок выдохом вниз).
   Сцены title/pause/win/gameover — g.useStandardScreens; титул перерисован. Камера плавно следует за героем.
   Ввод: ←→/AD — ходить; ↑/W/Пробел/Z — прыжок; X/K/Ctrl/F — выдох мехов (с ↓ — вниз);
   тач (площадки): виртуальный стик слева (js/stick.js) — ход, вниз — выдох вниз; ● — прыжок, ◆ — выдох, II — пауза.
   Геймпад (движок): стик/крестовина — ход, A — прыжок, B — выдох. */
(function (global) {
  'use strict';
  var U = global.UDALETS, L = U.logic, R = U.R, T = L.T, HUD = R.HUD;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#120d0b', panel: '#1a1411', ink: '#f4eee6', muted: '#a49a92', accent: '#ffb347', grid: '#2e2622' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa', ink: '#ffffff' })
  };
  var W = L.COLS * T, H = HUD + L.ROWS * T;
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'udalets', leaderboard: 'udalets', strings: U.STR, theme: 'modern', lives: L.LIVES, themes: themes });
  U.g = g;
  g.input.bindDpad(document.querySelector('.pad'));

  var game = null, toasts = [], banner = null, playSince = 0, extraJump = false, cam = null;
  function S() { return game.state(); }
  function sync() { if (!game) return; var s = S(); g.state.score = s.score; g.state.lives = Math.max(0, s.lives); g.state.level = s.level; }
  function toast(text, color, x, y, big) {
    for (var i = 0; i < toasts.length; i++) if (Math.abs(toasts[i].y - y) < 0.7 && toasts[i].t > toasts[i].life - 0.6) y -= 0.8;
    var life = big ? 2.2 : 1.3; toasts.push({ text: text, color: color, x: x, y: y, t: life, life: life, big: !!big });
  }
  function P() { return g.themeName === 'retro' ? R.PR : R.PM; }
  function lvName(n) { return g.t('lv' + n); }
  function showBanner(title, sub, dur) { banner = { title: title, sub: sub, a: dur || 2.4 }; }
  function scr(x, y) { var c = cam || R.camFor(S()); return { x: (x - c.x) * T, y: HUD + (y - c.y) * T }; }
  function burst(x, y, color, n, sp) { var p = scr(x, y); g.particles.spawn(p.x, p.y, { color: color, count: n || 14, speed: sp || 110, life: 0.6, size: g.themeName === 'retro' ? 4 : 3 }); }

  var GEMC = { '.': '#d9b25a', g: '#3fdc7a', b: '#3f8cff', R: '#ff3d5a' };
  function onEvent(type, d) {
    d = d || {};
    U.sfx(g, type, d);
    var C = P(), s = game ? S() : null;
    switch (type) {
      case 'level': toasts = []; cam = null; showBanner(g.t('level') + ' ' + d.level + ' · ' + lvName(d.level), g.t('intro') + ': ' + d.furn); break;
      case 'item':
        if (GEMC[d.k]) { toast('+' + d.pts, C.accent, d.x, d.y - 0.6); burst(d.x, d.y, GEMC[d.k], 10, 80); }
        else if (d.k === '+') { toast(g.t('life'), C.bad, d.x, d.y - 0.8, true); burst(d.x, d.y, '#ff5d6c', 18); }
        break;
      case 'heat': burst(d.x, d.y + 0.2, '#ff9b2e', 8 + d.heat * 4, 70); break;
      case 'lit': toast(g.t('lit') + (d.left ? ' · ' + g.t('left') + ': ' + d.left : ''), C.accent, d.x, d.y - 1.4, true); burst(d.x, d.y, '#ffd25a', 30, 160); break;
      case 'vane': if (d.opened) toast(g.t('vane'), C.good, d.x, d.y - 1, true); burst(d.x, d.y, '#bfe8ff', 14, 90); break;
      case 'stun': burst(d.x, d.y - 0.5, '#fff1a0', 6, 60); break;
      case 'snuff': burst(d.x, d.y, '#aaaaaa', 6, 50); break;
      case 'kill': toast('+' + d.pts, C.accent, d.x, d.y - 0.8); burst(d.x, d.y, d.k === 'w' ? '#c98a3a' : d.k === 'v' ? '#9aa4b2' : '#ff8a3d', 18, 130); break;
      case 'die': burst(d.x, d.y - 0.7, '#ffd166', 34, 170); burst(d.x, d.y - 0.7, C.bad, 16, 90); break;
      case 'life': if (s) toast(g.t('life'), C.bad, s.hero.x, s.hero.y - 2.2, true); break;
      case 'clear': showBanner(g.t('clear'), g.t('timeBonus') + ' +' + d.bonus, 2.2); if (d.level < U.LEVELS.length) setTimeout(function () { maybeCard(d.level); }, 2100); break;
      case 'room': toasts = toasts.filter(function (q) { return q.big; }); break;
      case 'win': sync(); setTimeout(function () { if (g._sceneName === 'play') g.win(); }, 1500); break;
      case 'gameover': sync(); g.state.lives = 0; setTimeout(function () { if (g._sceneName === 'play') g.gameover(); }, 900); break;
    }
    sync();
  }
  function newGame() { game = U.Game({ onEvent: onEvent }); toasts = []; cam = null; game.start(); U.current = game; sync(); }
  function inPlay() { return g._sceneName === 'play' && game && g.time - playSince > 0.15; }
  function puffAct(dir) { if (inPlay()) game.puff(dir); }

  // ---------- Стандартные экраны ----------
  g.useStandardScreens({ lives: L.LIVES });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name], baseDraw = sc.draw;
    sc.draw = function (ctx) {
      baseDraw.call(this, ctx);
      if (!game) return;
      var s = S(), Pc = P();
      if (name === 'win') R.furnace(ctx, this.W / 2 - 12, this.H / 2 - 120, 3, this.time, g.themeName === 'retro', 0);
      this.text(this.t('level') + ': ' + (s.won ? 10 : s.level) + '/10', this.W / 2, this.H / 2 + 46, { size: 13, align: 'center', color: Pc.muted, weight: 700 });
    };
  });

  // ---------- Площадка (движок v2.8/2.9): таблица лидеров «udalets», «Без рекламы» (no_ads) в меню и паузе, реклама за награду ----------
  // Консоль: Яндекс — лидерборд с техническим именем «udalets», GamePush — числовое поле игрока «udalets» + лидерборд; товар no_ads
  // (постоянный). Список — promo/udalets/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  var LB = 'udalets';
  g.persist('arcade.best.udalets', 'max');   // рекорд — и в облако (ключ прежний: рекорды игроков сайта сохраняются)
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });   // облако слито: рекорд с другого устройства — в таблицу
  // «Ещё один шанс» (раз за партию): после последней жизни — 1 жизнь у точки возврата; бонус в паузе — +1 жизнь
  g.useRewardedContinue({ revive: function () { if (game) { game.reviveAd(); sync(); } } });
  g.useRewardedBonus({ key: 'rwLife', scene: 'pause', label: function () { return g.t('rwLife'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) { game.boost(); sync(); } } });
  // Меню вмещает пункты площадки («Лидеры», «Без рекламы»): если пунктов больше, чем помещается, шаг сжимается (не меньше 19)
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }
  // ---------- Карточка «цех ожил» (только когда площадка готова показать межстраничную): нажатие → реклама → следующий цех ----------
  var cardLv = 0, cardGoing = false;
  function maybeCard(lv) { if (g._sceneName === 'play' && game && g.adReady && g.adReady()) { cardLv = lv; g.goto('card'); } }
  function cardGo() { if (cardGoing || g._sceneName !== 'card') return; cardGoing = true; g.adBreak().then(function () { cardGoing = false; if (g._sceneName === 'card') { playSince = g.time; g.goto('play', { resume: true }); } }); }
  g.scene('card', {
    enter: function () { cardGoing = false; },
    press: function (a) { if (a === 'action' || a === 'start') cardGo(); else if (a === 'pause') this.goto('play', { resume: true }); },
    draw: function (ctx) {
      var th = this.th();
      if (game) U.render(this, ctx, S(), { cam: cam }); else this.clear();
      ctx.fillStyle = 'rgba(12,8,6,.78)'; ctx.fillRect(0, 0, this.W, this.H);
      this.text(this.t('cardDone'), this.W / 2, this.H / 2 - 30, { size: 26, align: 'center', color: th.accent, weight: 900, maxWidth: this.W - 30 });
      this.text(this.t('level') + ' ' + cardLv + '/10' + (game ? ' · ' + this.t('score') + ': ' + S().score : ''), this.W / 2, this.H / 2 + 4, { size: 14, align: 'center', color: th.ink, weight: 700, maxWidth: this.W - 30 });
      this.text(this.t('cardNext'), this.W / 2, this.H / 2 + 36, { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: this.W - 30 });
    }
  });
  g.canvas.addEventListener('pointerdown', function (e) { if (g._sceneName === 'card') { e.preventDefault(); cardGo(); } });

  // ---------- Титул ----------
  var title = g.scenes.title, menu = g.menu.get('title'), demoLV = L.build(U.LEVELS[0], 1);
  title.draw = function (ctx) {
    var isRetro = g.themeName === 'retro', Pc = P(), Wc = this.W, Hc = this.H, th = this.th();
    ctx.fillStyle = isRetro ? '#000' : '#120d0b'; ctx.fillRect(0, 0, Wc, Hc);
    ctx.drawImage(R.roomLayer(demoLV, 0, isRetro), 0, HUD);
    ctx.fillStyle = isRetro ? 'rgba(0,0,0,.72)' : 'rgba(10,7,6,.6)'; ctx.fillRect(0, 0, Wc, Hc);
    var pw = 430, ph = Math.min(Hc - 40, Math.max(330, 200 + menu.items.length * 28)), x0 = (Wc - pw) / 2, y0 = 22;
    if (isRetro) { ctx.fillStyle = '#000'; ctx.fillRect(x0, y0, pw, ph); ctx.fillStyle = '#00aaaa'; ctx.fillRect(x0, y0, pw, 3); ctx.fillRect(x0, y0 + ph - 3, pw, 3); ctx.fillRect(x0, y0, 3, ph); ctx.fillRect(x0 + pw - 3, y0, 3, ph); }
    else { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 26; ctx.fillStyle = 'rgba(26,20,17,.94)'; R.rr(ctx, x0, y0, pw, ph, 16); ctx.fill(); ctx.restore(); ctx.strokeStyle = '#4a3a2e'; ctx.lineWidth = 1.5; R.rr(ctx, x0 + 0.75, y0 + 0.75, pw - 1.5, ph - 1.5, 16); ctx.stroke(); }
    this.text(this.t('title'), Wc / 2, y0 + 58, { size: isRetro ? 40 : 46, align: 'center', color: Pc.accent, weight: 900, font: isRetro ? '"Courier New", monospace' : undefined, maxWidth: pw - 150 });
    R.furnace(ctx, x0 + 26, y0 + 34, 3, this.time, isRetro, 0); R.furnace(ctx, x0 + pw - 50, y0 + 34, 3, this.time + 0.7, isRetro, 1);
    this.text(this.t('subtitle'), Wc / 2, y0 + 86, { size: isRetro ? 11 : 13, align: 'center', color: th.ink, weight: 700, maxWidth: pw - 24 });
    this.text(this.t('sub2'), Wc / 2, y0 + 105, { size: isRetro ? 10 : 11, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 24 });
    var HH = { x: 0, y: 0, vx: 0, vy: 0, face: 1, ground: true, walkT: this.time * 3 };
    R.hero(ctx, x0 + 46, y0 + ph - 26, HH, this.time, { retro: isRetro, puff: (this.time % 1.6) });
    R.enemy(ctx, { k: 'f', dir: -1, cd: 1 }, x0 + pw - 52, y0 + ph - 76 + Math.sin(this.time * 2.6) * 6, this.time, isRetro);
    R.enemy(ctx, { k: 'w', dir: -1, cd: 1, stun: 1 }, x0 + pw - 50, y0 + ph - 26, this.time, isRetro);
    var mf = menuFit(menu, y0 + 146, 28, y0 + 124, y0 + ph - 34);
    menu.draw(this, Wc / 2, mf[0], mf[1]);
    if (this.state.best) this.text(this.t('best') + ': ' + this.state.best, Wc / 2, y0 + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 700 });
    this.text(this.t('hint'), Wc / 2, Hc - 10, { size: isRetro ? 10 : 11, align: 'center', color: th.muted, weight: 600, maxWidth: Wc - 20 });
  };

  // ---------- Игровая сцена ----------
  var STEP = 1 / 60;
  function promptFor(s) {   // подсказка «дунь!» у остывшего горна / крыльчатки — на первых двух уровнях
    if (s.level > 2 || s.phase !== 'play' || !s.hero.ground) return null;
    var H = s.hero, n = L.nodeOf(s.LV, H); if (n == null) return null;
    var all = s.LV.furn.filter(function (f) { return s.heat[f.id] < L.HEAT_NEED; });
    for (var i = 0; i < all.length; i++) if (L.spotsFor(s.LV, all[i].c, all[i].r).some(function (p) { return p.n === n && p.face === H.face; })) return touchMode() ? '◆' : 'X';
    return null;
  }
  function touchMode() { return g.input.device === 'touch' || g.input.touchOnly; }
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return;
      var i;
      for (i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (q) { return q.t > 0; });
      if (banner) { banner.a -= dt; if (banner.a <= 0) banner = null; }
      var dir = this.input.dir, live = g.time - playSince > 0.15;
      if (stick.active) dir = { x: Math.abs(stick.x) > 0.3 ? stick.x : 0, y: stick.y > 0.55 ? 1 : 0 };   // тач-стик: ход, вниз — выдох вниз
      var jump = live && (this.input.pressed('action') || this.input.pressed('up') || extraJump);
      game.setInput(dir.x, live ? dir.y : 0, jump);
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n; k++) game.update(STEP);
      // камера: мягко за героем
      var s = S(), want = R.camFor(s);
      if (!cam || s.phase === 'clear' && s.phaseT < 0.05) cam = { x: want.x, y: want.y };
      else { var kk = Math.min(1, dt * 7); cam.x += (want.x - cam.x) * kk; cam.y += (want.y - cam.y) * Math.min(1, dt * 5); }
      if (Math.abs(want.x - cam.x) > 6 || Math.abs(want.y - cam.y) > 6) cam = { x: want.x, y: want.y };   // возврат после гибели
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      U.render(this, ctx, S(), { toasts: toasts, banner: banner, cam: cam, prompt: promptFor(S()) });
    }
  });

  // ---------- Тач-стик (площадки) ----------
  var stick = global.ArcadeStick.create(document.querySelector('.pad [data-stick]'));

  // ---------- Доп. клавиши и тач-кнопки ----------
  var JUMP = { KeyZ: 1, KeyJ: 1 }, PUFF = { KeyX: 1, KeyK: 1, ControlLeft: 1, ControlRight: 1, KeyF: 1 }, held = {};
  addEventListener('keydown', function (e) {
    var ip = g._sceneName === 'play';
    if (JUMP[e.code]) { held[e.code] = true; extraJump = true; if (ip) e.preventDefault(); }
    if (PUFF[e.code] && ip) { e.preventDefault(); if (!e.repeat) puffAct(); }
  });
  addEventListener('keyup', function (e) { if (JUMP[e.code]) { held[e.code] = false; extraJump = !!(held.KeyZ || held.KeyJ); } });
  addEventListener('blur', function () { held = {}; extraJump = false; });
  function tap(id, fn) {
    var b = document.getElementById(id); if (!b) return;
    var h = function (e) { e.preventDefault(); fn(); };
    b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h);
  }
  tap('bPuff', function () { puffAct(); });
  tap('bPause', function () { if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });

  // ---------- DOM: подгонка канвы, подписи, тема страницы ----------
  function fit() {
    var c = g.canvas, wrap = c.parentElement, pad = document.querySelector('.pad');
    var padFixed = pad && getComputedStyle(pad).position === 'fixed';
    var padOn = pad && getComputedStyle(pad).display !== 'none';
    var padH = padOn && !padFixed ? pad.offsetHeight + 16 : 0;
    var vw = Math.min(innerWidth, document.documentElement.clientWidth || innerWidth), vh = Math.min(innerHeight, (global.visualViewport && global.visualViewport.height) || innerHeight);
    var w = Math.min(1000, padFixed && padOn ? vw - 300 : ((wrap && wrap.clientWidth) || g.W), (vh - padH - (padH ? 64 : 40)) * g.W / g.H);   // «лёжа»: поля по бокам под стик и кнопки
    w = Math.max(240, Math.floor(w)); c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
    var se = document.scrollingElement || document.documentElement, over = se.scrollHeight - vh;   // страховка от прокрутки (площадки)
    if (over > 0 && w > 240) { w = Math.max(240, Math.floor(w - over * g.W / g.H) - 2); c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px'; }
  }
  var lastLang = null, lastTheme = null;
  function domSync() {
    if (g.i18n.lang !== lastLang) {
      lastLang = g.i18n.lang; document.documentElement.lang = lastLang;
      var b = document.getElementById('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = document.getElementById('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
      fit();
    }
    if (g.themeName !== lastTheme) { lastTheme = g.themeName; document.body.setAttribute('data-theme', lastTheme); }
    requestAnimationFrame(domSync);
  }
  addEventListener('resize', fit); fit(); domSync();

  g.start('title');
  U.app = { g: g, game: function () { return game; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
