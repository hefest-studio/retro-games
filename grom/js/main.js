/* ГРОМ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендеры retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул переопределён: панорама Литейного двора + меню движка.
   Ввод — g.input.setPlayers (одна раскладка): ←→/AD бег, ↑↓/WS прицел и направление луча, Пробел/Z/K прыжок,
   X/J огонь (в колесе — мина), C/U луч-кнут (держать), V/Shift колесо, B/Q молния.
   Тач: крестовина, ● огонь, ⤒ прыжок, ≈ луч, ◎ колесо, ϟ молния, II пауза. */
(function (global) {
  'use strict';
  var GR = global.GROM, L = GR.logic, UI = GR.ui;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0d0f14', panel: '#151820', ink: '#f1eee8', muted: '#9aa2b2', accent: '#ffb347', grid: '#2a2f3c' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa', ink: '#ffffff' })
  };
  var W = L.VIEW_W * L.T, H = L.HUD + L.VIEW_H * L.T;
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'grom', strings: GR.STR, theme: 'modern', lives: L.LIVES, themes: themes });
  GR.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);
  g.input.setPlayers({
    bind: { p1: { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
      jump: ['Space', 'KeyZ', 'KeyK'], fire: ['KeyX', 'KeyJ'], beam: ['KeyC', 'KeyU'], wheel: ['KeyV', 'ShiftLeft', 'ShiftRight'], thunder: ['KeyB', 'KeyQ'] } },
    actions: ['wheel', 'thunder', 'fire', 'jump'], touch: { L: 'left', R: 'right', U: 'up', D: 'down' }, count: 1
  });
  var P1 = g.input.player(0);
  function rnd() { return g.themeName === 'retro' ? GR.classic : GR.modern; }

  var game = null, shakeT = 0, touch = { jump: false, fire: false, beam: false }, endT = null;
  function sync() { if (!game) return; var S = game.state(); g.state.score = S.score; g.state.lives = S.lives; g.state.level = S.level; }
  function onEvent(type, d) {
    d = d || {};
    GR.sfx(g, type, d);
    var P = rnd().P, S = game ? game.state() : null, sz = P.pixel ? 4 : 3;
    switch (type) {
      case 'kill': UI.spawn(d.x, d.y, { color: P.foe, count: 12, speed: 7, life: 0.5, size: sz }); UI.spawn(d.x, d.y, { color: P.warn, count: 6, speed: 4, life: 0.3, size: sz - 1 }); UI.toast('+' + d.pts, P.accent, d.x, d.y - 1); break;
      case 'hit': UI.spawn(d.x, d.y, { color: '#ffffff', count: 2, speed: 3, life: 0.15, size: 2 }); break;
      case 'bossHit': if (Math.random() < 0.3) UI.spawn(d.x + (Math.random() - 0.5) * 2, d.y + (Math.random() - 0.5) * 2, { color: P.warn, count: 3, speed: 4, life: 0.2, size: 2 }); break;
      case 'hurt': UI.spawn(d.x, d.y, { color: P.bad, count: 10, speed: 6, life: 0.4, size: sz }); shakeT = Math.max(shakeT, 0.15); break;
      case 'die': UI.spawn(d.x, d.y, { color: P.wheel, count: 36, speed: 10, life: 1, size: sz }); UI.spawn(d.x, d.y, { color: P.heroB, count: 20, speed: 7, life: 0.8, size: sz }); shakeT = 0.4; break;
      case 'break': UI.spawn(d.x, d.y, { color: d.k === 'bonus' ? P.bonusHi : '#9b8a78', count: 16, speed: 7, life: 0.6, size: sz }); if (d.k === 'crack') UI.toast('?', P.warn, d.x, d.y - 1); break;
      case 'boom': UI.spawn(d.x, d.y, { color: P.warn, count: 14, speed: 8, life: 0.4, size: sz }); shakeT = Math.max(shakeT, 0.2); break;
      case 'pickup':
        if (d.k === 'gem') UI.spawn(d.x, d.y, { color: P.gem, count: 6, speed: 4, life: 0.3, size: 2 });
        else if (d.k !== 'cap') UI.toast(g.t('pk_' + d.k), d.k === 'life' ? P.accent : P.good, d.x, d.y - 1);
        break;
      case 'weapon': UI.toast(g.t('w_' + d.k) + ' ' + 'I'.repeat(d.lv), P.wcol[d.k], S.hero.x, S.hero.y - 3, true); break;
      case 'beacon': UI.toast(g.t('beacon'), P.wheel, d.x, d.y - 2); UI.spawn(d.x, d.y - 1, { color: P.wheel, count: 14, speed: 5, life: 0.6, size: sz }); break;
      case 'secret': UI.toast(g.t('secret'), P.warn, d.x, d.y - 3, true); break;
      case 'extraLife': UI.toast(g.t('extraLife'), P.accent, S.hero.x, S.hero.y - 4, true); break;
      case 'noWheel': UI.toast(g.t('noWheel'), P.muted, S.hero.x, S.hero.y - 3); break;
      case 'deflect': UI.spawn(d.x, d.y, { color: P.wheel, count: 4, speed: 5, life: 0.2, size: 2 }); break;
      case 'stomp': shakeT = Math.max(shakeT, 0.3); UI.spawn(d.x, d.y - 0.2, { color: '#9b8a78', count: 16, speed: 6, life: 0.5, size: sz }); break;
      case 'strike': shakeT = Math.max(shakeT, 0.2); break;
      case 'thunder': shakeT = Math.max(shakeT, 0.5); break;
      case 'phase': UI.toast(g.t('phase') + ' ' + (d.phase + 1), P.bad, d.x, d.y - 3, true); break;
      case 'bossDie': shakeT = 1.4; for (var k = 0; k < 4; k++) UI.spawn(d.x + (k - 1.5), d.y, { color: k % 2 ? P.warn : P.bad, count: 20, speed: 10, life: 1.2, size: sz + 1 }); break;
      case 'portal': UI.toast(g.t('portal'), P.wheel, d.x, d.y - 4, true); break;
      case 'timeLow': UI.toast(g.t('timeLow'), P.warn, S.hero.x, S.hero.y - 4, true); break;
      case 'level': UI.clearFx(); break;
      case 'win': endT = { at: g.time + 1.2, to: 'win' }; break;
      case 'gameover': endT = { at: g.time + 1.0, to: 'gameover' }; break;
    }
    sync();
  }
  function newGame(o) {
    game = GR.Game(Object.assign({ onEvent: onEvent }, o || {}));
    GR.current = game; UI.clearFx(); shakeT = 0; endT = null; game.start(); sync();
  }
  function act(name) {
    if (g._sceneName !== 'play' || !game) return;
    var S = game.state();
    if (S.phase === 'cont') { if (name === 'fire' || name === 'jump' || name === 'start') game.cont(); return; }
    if (name === 'wheel') game.wheel();
    else if (name === 'thunder') game.thunder();
  }
  P1.onPress(act);
  UI.init(g, {
    hold: function (name, on) { touch[name] = on; if (on && (name === 'fire' || name === 'jump')) act(name); },
    tap: function (name) {
      if (name === 'pause') { if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); return; }
      act(name);
    }
  });

  // ---------- Стандартные экраны ----------
  g.useStandardScreens({ lives: L.LIVES });
  g.menu.setHint(function () { return [g.t('hint1'), { text: g.t('hint2'), dim: true }]; }, 'title');
  var demo = GR.Game({ rng: L.mulberry32(7) }).start(), DS = demo.state(), demoT = 0;
  DS.banner = 0;
  function demoCam() { var span = L.RW * 2.2; return { x: 1 + span * (0.5 + 0.5 * Math.sin(demoT * 0.06 - 1.4)), y: 2 }; }
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {
    baseClear.call(this, c);
    var R = rnd();
    if (this._sceneName === 'win' || this._sceneName === 'gameover') {
      UI.render(this, this.ctx, game ? game.state() : DS, R, { bare: true, noHero: true, cam: game ? null : demoCam() });
      this.ctx.fillStyle = R.P.pixel ? 'rgba(0,0,0,.6)' : 'rgba(8,9,14,.6)'; this.ctx.fillRect(0, 0, this.W, this.H);
    }
  };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoT += Math.min(dt, 0.05); DS.time = demoT; };
  title.draw = function (ctx) {
    var th = this.th(), R = rnd(), P = R.P, Wc = this.W, Hc = this.H;
    ctx.fillStyle = P.bg2; ctx.fillRect(0, 0, Wc, Hc);
    UI.render(this, ctx, DS, R, { bare: true, noHero: true, cam: demoCam() });
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.55)' : 'rgba(8,9,14,.5)'; ctx.fillRect(0, 0, Wc, Hc);
    var pw = 440, ph = 262, x0 = (Wc - pw) / 2, y0 = 30;
    UI.panel(ctx, x0, y0, pw, ph, P, P.pixel ? P.line : '#4a5266');
    UI.txt(this, this.t('title'), Wc / 2, y0 + 58, { size: P.pixel ? 46 : 54, align: 'center', color: P.accent, weight: 900 }, P);
    R.boltGlyph(ctx, Wc / 2 - 92, y0 + 38, 12, P.wheel); R.boltGlyph(ctx, Wc / 2 + 92, y0 + 38, 12, P.wheel);
    UI.txt(this, this.t('subtitle'), Wc / 2, y0 + 84, { size: P.pixel ? 10 : 12, align: 'center', color: th.ink, weight: 700 }, P);
    UI.txt(this, this.t('sub2'), Wc / 2, y0 + 101, { size: P.pixel ? 9 : 11, align: 'center', color: th.muted, weight: 600 }, P);
    var fake = L.newHero(0, 0); fake.ground = true; fake.vx = 1; fake.runT = demoT * 0.5; fake.aim = { x: 1, y: 0 };
    R.hero(ctx, fake, x0 + 46, y0 + 236, demoT, DS, 2);
    var wh = L.newHero(0, 0); wh.form = 'wheel'; wh.x = demoT * 3; wh.face = -1;
    R.hero(ctx, wh, x0 + pw - 46, y0 + 236, demoT, DS, 2);
    menu.draw(this, Wc / 2, y0 + 134, 27);
    if (this.state.best) UI.txt(this, this.t('best') + ': ' + this.state.best, Wc / 2, y0 + ph - 14, { size: 11, align: 'center', color: th.muted, weight: 600 }, P);
    this.menu._drawHint('title');
  };

  // ---------- Игровая сцена ----------
  var STEP = 1 / 60;
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); },
    press: function (a) { if (a === 'pause') this.pause(); else if (a === 'start' || a === 'action') act('start'); },
    update: function (dt) {
      if (!game) return;
      var dir = P1.dir;
      game.setInput({ dx: dir.x, dy: dir.y, jump: P1.pressed('jump') || touch.jump, fire: P1.pressed('fire') || touch.fire, beam: P1.pressed('beam') || touch.beam });
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n; k++) game.update(STEP);
      UI.updFx(dt);
      if (shakeT > 0) shakeT -= dt;
      if (endT && g.time >= endT.at) { var to = endT.to; endT = null; sync(); if (to === 'win') g.win(); else g.gameover(); }
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      UI.render(this, ctx, game.state(), rnd(), { shake: shakeT > 0 ? (rnd().P.pixel ? 4 : 5) * Math.min(1, shakeT * 3) : 0 });
    }
  });

  g.start('title');
  GR.app = { g: g, game: function () { return game; }, newGame: newGame };   // для отладки/автотестов в браузере: newGame({ level: 3 })
})(typeof window !== 'undefined' ? window : globalThis);
