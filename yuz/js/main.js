/* ЮЗ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендеры retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; 1–2 игрока за одной клавиатурой — g.usePlayers
   (пункт «Игроки: 1/2», клавиши 1/2, подсказка раскладок, тач — только И1). Титул: заезд ботов на фоне + меню движка.
   Финалы win/gameover переопределены: таблица чемпионата и итоговое место. */
(function (global) {
  'use strict';
  var Y = global.YUZ, L = Y.logic, UI = Y.ui, CW = UI.CW, CH = UI.CH;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#10131b', panel: '#141923', ink: '#f2f5fa', muted: '#a3adbf', accent: '#ff8a3d', grid: '#232a38' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa', ink: '#ffffff' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: CW, height: CH, gameId: 'yuz', strings: Y.STR, theme: 'modern', lives: 1, themes: themes });
  Y.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);

  function rnd() { return g.themeName === 'retro' ? Y.classic : Y.modern; }
  var game = null, toasts = [];
  function toast(text, color) { toasts.push({ text: text, color: color, t: 1.6 }); if (toasts.length > 3) toasts.shift(); }
  function sync() { if (!game) return; var S = game.state(); g.state.score = S.score; g.state.level = S.ti + 1; }
  function nameOf(id) { var c = game && game.car(id); return c ? UI.name(g, c) : id; }

  function onEvent(type, d) {
    Y.sfx(g, type, d);
    var P = rnd().P, S = game && game.state(), c = d && d.id && game ? game.car(d.id) : null;
    if (type === 'pickup') { UI.burst(d.x, d.y, d.k === 'boost' ? '#ffb02e' : '#6cc8ff', 12, 90); if (d.human) toast(nameOf(d.id) + ' · ' + g.t('pk_' + d.k), c.color); }
    else if (type === 'wall' && c && d.f > 90) UI.burst(c.x, c.y, P.pixel ? '#ffff55' : '#ffe08a', 5, 70);
    else if (type === 'lap' && d.human) toast(d.lap === S.laps ? g.t('lastLap') : g.t('lapN') + ' ' + d.lap + '/' + S.laps, c.color);
    else if (type === 'finish' && d.human) toast(nameOf(d.id) + ' · ' + g.t('finish') + ' ' + Y.ordinal(g.i18n.lang, d.place), P.good);
    else if (type === 'out') toast(nameOf(d.id) + ' · ' + g.t('out'), d.human ? P.bad : P.muted);
    else if (type === 'track') { toasts = []; UI.resetLive(); }
    sync();
    if (type === 'win') g.win();
    else if (type === 'gameover') g.gameover();
  }

  function newGame() {
    game = Y.Game({ players: g.input.playerCount, onEvent: onEvent });
    UI.resetLive(); toasts = [];
    game.start(); Y.current = game; sync();
  }
  function advance() {
    if (!game) return;
    var S = game.state();
    if (S.phase === 'results' && S.phaseT > 0.8) { g.audio.beep(660, 0.05); game.next(); }
  }

  // ---------- Стандартные экраны и игроки ----------
  g.useStandardScreens({ lives: 1 });
  g.usePlayers({
    bind: L.BIND,
    actions: ['drift'], repeat: [], pad: pad, touch: { L: 'left', R: 'right', U: 'up', D: 'down', A: 'drift' },
    hint: { ru: [Y.STR.ru.hint1, Y.STR.ru.hint2], en: [Y.STR.en.hint1, Y.STR.en.hint2] }
  });
  UI.init(g);
  g.canvas.addEventListener('pointerdown', function () { if (g._sceneName === 'play') advance(); });

  // ---------- Титул: заезд ботов на фоне + меню движка ----------
  var demo = null, demoTi = 0;
  function newDemo() { demo = Y.Game({ players: 0, track: demoTi, tracks: demoTi + 1, elim: false, laps: 1, rng: UI.mulberry32(5 + demoTi) }).start(); }
  var menu = g.scenes.title._menu, title = g.scenes.title;
  title.enter = function () { this.audio.beep(520, 0.08); Y.motor.stop(g); if (!demo) newDemo(); };
  title.update = function (dt) {
    if (!demo) newDemo();
    demo.update(Math.min(dt, 0.05)); UI.fx(rnd(), demo.state(), dt);
    if (demo.state().phase === 'results') { demoTi = (demoTi + 1) % L.TRACKS.length; newDemo(); }
  };
  title.draw = function (ctx) {
    var th = this.th(), R = rnd(), P = R.P, retro = P.pixel;
    this.clear();
    UI.world(this, ctx, demo.state(), R);
    ctx.fillStyle = retro ? 'rgba(0,0,0,.66)' : 'rgba(10,12,18,.62)'; ctx.fillRect(0, 0, CW, CH);
    var pw = 420, ph = 330, px = (CW - pw) / 2, py = 26;
    UI.panel(ctx, px, py, pw, ph, P, retro ? P.line : null, 0.94);
    UI.txt(this, this.t('title'), CW / 2, py + 66, { size: 58, align: 'center', color: P.accent, weight: 900 }, P);
    // следы заноса под заголовком
    var t = this.time; ctx.fillStyle = retro ? '#555555' : 'rgba(255,255,255,.22)';
    for (var i = 0; i < 26; i++) { var xx = CW / 2 - 90 + i * 7, yy = py + 84 + Math.round(Math.sin(i * 0.45 + t * 2) * 3); ctx.fillRect(xx, yy, 5, 2); ctx.fillRect(xx, yy + 6, 5, 2); }
    UI.txt(this, this.t('subtitle'), CW / 2, py + 112, { size: 12, align: 'center', color: th.muted, weight: 600 }, P);
    menu.draw(this, CW / 2, py + 152, 30);
    if (this.state.best) UI.txt(this, this.t('best') + ': ' + this.state.best, CW / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600 }, P);
    this.menu._drawHint('title');
  };

  // ---------- Финалы: таблица чемпионата и место ----------
  function finale(win) {
    return function (ctx) {
      var R = rnd(), P = R.P;
      this.clear();
      if (!game) return;
      var S = game.state();
      UI.world(this, ctx, S, R);
      UI.results(this, ctx, S, R, true);
      UI.txt(this, UI.up(P, this.t(win ? 'win' : 'gameover')), CW / 2, 50, { size: 30, align: 'center', color: win ? P.good : P.bad, weight: 900 }, P);
      UI.txt(this, this.t('champPlace') + ': ' + Y.ordinal(this.i18n.lang, S.place) + '  ·  ' + this.t('score') + ': ' + S.score + (this.state.best ? '  ·  ' + this.t('best') + ': ' + this.state.best : ''), CW / 2, CH - 46, { size: 14, align: 'center', color: P.ink, weight: 800 }, P);
      UI.txt(this, this.t('tapstart'), CW / 2, CH - 22, { size: 12, align: 'center', color: P.muted, weight: 600 }, P);
    };
  }
  g.scenes.win.draw = finale(true);
  g.scenes.gameover.draw = finale(false);
  var winEnter = g.scenes.win.enter, overEnter = g.scenes.gameover.enter;
  g.scenes.win.enter = function () { Y.motor.stop(g); winEnter.call(this); };
  g.scenes.gameover.enter = function () { Y.motor.stop(g); overEnter.call(this); };
  g.scenes.pause.enter = function () { Y.motor.stop(g); };

  // ---------- Игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); },
    press: function (a) {
      if (a === 'pause') { this.pause(); return; }
      if (a === 'action' || a === 'start' || a === 'up') advance();
    },
    update: function (dt) {
      if (!game) return;
      var S = game.state();
      for (var pi = 0; pi < S.nplayers; pi++) {
        var I = g.input.player(pi), dir = I.dir;
        game.setInput(pi, { steer: dir.x, gas: dir.y < 0, brake: dir.y > 0, drift: I.pressed('drift') });
      }
      game.update(Math.min(dt, 0.05));
      UI.fx(rnd(), S, dt);
      Y.motor.update(g, S.cars.filter(function (c) { return c.human; }), g.audio.enabled && g._sceneName === 'play' && (S.phase === 'race' || S.phase === 'end' || S.phase === 'count'));
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      var S = game.state(), R = rnd();
      this.clear();
      UI.world(this, ctx, S, R, { labels: S.nplayers > 1 ? [this.t('p1'), this.t('p2')] : null });
      if (S.phase === 'results') UI.results(this, ctx, S, R, false);
      else { UI.hud(this, ctx, S, R); UI.toasts(this, ctx, toasts, R.P); }
    }
  });

  g.start('title');
  Y.app = { g: g, game: function () { return game; }, advance: advance };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
