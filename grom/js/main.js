/* РАСКАТ (папка grom; EN — CLAPBOLT) · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендеры retro/modern + звук + площадка.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул переопределён: панорама Литейного двора + меню движка.
   Ввод — g.input.setPlayers (одна раскладка): ←→/AD бег, ↑↓/WS прицел и сторона броска, Пробел/K прыжок, X/J огонь,
   Z/C/Shift бросок-молния; геймпад: A — прыжок, B — огонь, X — бросок.
   Тач (площадки): плавающий стик (js/stick.js) + ● огонь + ⤒ прыжок + ϟ бросок + II пауза (стик + 3 кнопки).
   Миграция: старый рекорд (очки) сохраняется; один раз показывается сообщение «игра обновлена» (ключ arcade.grom.v). */
(function (global) {
  'use strict';
  var GR = global.GROM, L = GR.logic, UI = GR.ui;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0d0f14', panel: '#151820', ink: '#f1eee8', muted: '#9aa2b2', accent: '#ffb347', grid: '#2a2f3c' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa', ink: '#ffffff' })
  };
  var W = L.VIEW_W * L.T, H = L.HUD + L.VIEW_H * L.T;
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'grom', leaderboard: 'grom', strings: GR.STR, theme: 'modern', lives: L.LIVES, themes: themes });
  GR.g = g;
  var pad = document.querySelector('.pad');
  var stick = global.ArcadeStick.create(pad && pad.querySelector('[data-stick]'));
  // миграция: механика сменилась (колесо и луч → бросок-молния); рекорд в очках остаётся, игроку один раз сообщаем
  var migrated = false;
  try { if (localStorage.getItem('arcade.grom.v') !== '2') { migrated = !!localStorage.getItem('arcade.best.grom'); localStorage.setItem('arcade.grom.v', '2'); } } catch (e) {}
  var migNote = migrated ? 3.5 : 0;
  // ---------- Площадка: таблица лидеров «grom», «Без рекламы», реклама за награду; на сайте пунктов нет ----------
  // Консоль: Яндекс — лидерборд с техническим именем «grom», GamePush — поле игрока «grom» + лидерборд; товар no_ads. Список — promo/grom/platform.json.
  g.persist('arcade.best.grom', 'max');
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: 'grom' }); }
  g.useLeaderboard({ boards: [{ id: 'grom', label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });
  g.useRewardedContinue({ revive: function () { if (game) { game.revive(); sync(); } } });
  g.useRewardedBonus({ key: 'rwHeal', scene: 'pause', label: function () { return g.t('rwHeal'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) game.boost(); } });
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(17, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }
  g.input.setPlayers({
    bind: { p1: { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
      jump: ['Space', 'KeyK'], fire: ['KeyX', 'KeyJ'], dash: ['KeyZ', 'KeyC', 'ShiftLeft', 'ShiftRight'] } },
    actions: ['jump', 'fire', 'dash'], count: 1
  });
  var P1 = g.input.player(0);
  function rnd() { return g.themeName === 'retro' ? GR.classic : GR.modern; }

  var game = null, shakeT = 0, touch = { jump: false, fire: false }, endT = null, adHold = false, tut = { a: false, b: false, c: false }, playT = 0;
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
      case 'noDash': UI.toast(g.t('noDash'), P.muted, S.hero.x, S.hero.y - 3); break;
      case 'dash': UI.spawn(d.x, d.y, { color: P.wheel, count: 10, speed: 5, life: 0.3, size: 2 }); break;
      case 'clap': shakeT = Math.max(shakeT, 0.3); UI.spawn(d.x, d.y, { color: P.wheel, count: 22, speed: 9, life: 0.5, size: sz }); UI.spawn(d.x, d.y, { color: '#ffffff', count: 8, speed: 6, life: 0.3, size: sz }); break;
      case 'deflect': UI.spawn(d.x, d.y, { color: P.wheel, count: 4, speed: 5, life: 0.2, size: 2 }); break;
      case 'stomp': shakeT = Math.max(shakeT, 0.3); UI.spawn(d.x, d.y - 0.2, { color: '#9b8a78', count: 16, speed: 6, life: 0.5, size: sz }); break;
      case 'strike': shakeT = Math.max(shakeT, 0.2); break;
      case 'phase': UI.toast(g.t('phase') + ' ' + (d.phase + 1), P.bad, d.x, d.y - 3, true); break;
      case 'bossDie': shakeT = 1.4; for (var k = 0; k < 4; k++) UI.spawn(d.x + (k - 1.5), d.y, { color: k % 2 ? P.warn : P.bad, count: 20, speed: 10, life: 1.2, size: sz + 1 }); break;
      case 'portal': UI.toast(g.t('portal'), P.wheel, d.x, d.y - 4, true); break;
      case 'timeLow': UI.toast(g.t('timeLow'), P.warn, S.hero.x, S.hero.y - 4, true); break;
      case 'level': UI.clearFx(); break;
      case 'clear': adHold = false; if (g.adReady && g.adReady()) { adHold = true; setTimeout(function () { g.adBreak().then(function () { adHold = false; }, function () { adHold = false; }); }, 1600); } break;
      case 'win': endT = { at: g.time + 1.2, to: 'win' }; break;
      case 'gameover': endT = { at: g.time + 1.0, to: 'gameover' }; break;
    }
    sync();
  }
  function newGame(o) {
    game = GR.Game(Object.assign({ onEvent: onEvent }, o || {}));
    GR.current = game; UI.clearFx(); shakeT = 0; endT = null; adHold = false; playT = 0; tut = { a: false, b: false, c: false }; game.start(); sync();
  }
  function act(name) {
    if (g._sceneName !== 'play' || !game) return;
    var S = game.state();
    if (S.phase === 'cont') { if (name === 'fire' || name === 'jump' || name === 'start') game.cont(); return; }
    if (name === 'dash') game.dash();
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
    // молнии по краям названия: отступ от измеренной ширины (ctx.font выставлен последним text())
    var gx = Math.min(pw / 2 - 14, Math.max(92, ctx.measureText(P.pixel ? this.t('title').toUpperCase() : this.t('title')).width / 2 + 16));
    R.boltGlyph(ctx, Wc / 2 - gx, y0 + 38, 12, P.wheel); R.boltGlyph(ctx, Wc / 2 + gx, y0 + 38, 12, P.wheel);
    UI.txt(this, this.t('subtitle'), Wc / 2, y0 + 84, { size: P.pixel ? 10 : 12, align: 'center', color: th.ink, weight: 700 }, P);
    UI.txt(this, this.t('sub2'), Wc / 2, y0 + 101, { size: P.pixel ? 9 : 11, align: 'center', color: th.muted, weight: 600 }, P);
    var fake = L.newHero(0, 0); fake.ground = true; fake.vx = 1; fake.runT = demoT * 0.5; fake.aim = { x: 1, y: 0 };
    R.hero(ctx, fake, x0 + 46, y0 + 236, demoT, DS, 2);
    var wh = L.newHero(0, 0); wh.dash = 1; wh.ddx = -1; wh.ddy = 0; wh.x = demoT * 3; wh.face = -1;
    R.hero(ctx, wh, x0 + pw - 46, y0 + 236, demoT, DS, 2);
    var mf = menuFit(menu, y0 + 128, 26, y0 + 112, y0 + ph - 30);
    menu.draw(this, Wc / 2, mf[0], mf[1]);
    if (migNote > 0) UI.txt(this, this.t('migrated'), Wc / 2, Hc - 12, { size: 10, align: 'center', color: P.good, weight: 700, maxWidth: Wc - 24 }, P);
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
      if (migNote > 0) migNote -= dt;
      var dir = P1.dir;
      if (adHold) return;
      var sd = stick.active ? stick.dir(0.4) : null, dx = dir.x || (sd ? (sd.right ? 1 : sd.left ? -1 : 0) : 0), dy = dir.y || (sd ? (sd.up ? -1 : sd.down ? 1 : 0) : 0);
      game.setInput({ dx: dx, dy: dy, jump: P1.pressed('jump') || touch.jump, fire: P1.pressed('fire') || touch.fire });
      tutorial(dt);
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n; k++) game.update(STEP);
      UI.updFx(dt);
      if (shakeT > 0) shakeT -= dt;
      if (endT && g.time >= endT.at) { var to = endT.to; endT = null; sync(); if (to === 'win') g.win(); else g.gameover(); lbBest(); }
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      UI.render(this, ctx, game.state(), rnd(), { shake: shakeT > 0 ? (rnd().P.pixel ? 4 : 5) * Math.min(1, shakeT * 3) : 0 });
    }
  });

  // ---------- подсказки первого уровня (по месту) ----------
  function tutorial(dt) {
    var S = game.state(); if (S.level !== 1 || S.phase !== 'play') return;
    var h = S.hero; playT += dt;
    if (!tut.a && playT > 2.5) { tut.a = true; UI.toast(g.t('tutDash'), rnd().P.warn, S.cam.x + L.VIEW_W / 2, S.cam.y + 5, true); return; }
    if (!tut.b && tut.a) {
      var r0 = Math.floor(h.y) - 3, c0 = Math.floor(h.x) - 9, c1 = Math.floor(h.x) + 9, near = false;
      for (var r = r0; r <= r0 + 3 && !near; r++) for (var c = c0; c <= c1; c++) if (c > 0 && c < S.W && r > 0 && r < S.H && S.t[r * S.W + c] === L.M) { near = true; break; }
      if (near) { tut.b = true; UI.toast(g.t('tutPlate'), rnd().P.warn, S.cam.x + L.VIEW_W / 2, S.cam.y + 5, true); return; }
    }
    if (!tut.c && tut.a && playT > 14 && S.enemies.some(function (e) { return !e.dead && Math.abs(e.x - h.x) < 7 && Math.abs(e.y - h.y) < 3; })) { tut.c = true; UI.toast(g.t('tutClap'), rnd().P.warn, S.cam.x + L.VIEW_W / 2, S.cam.y + 5, true); }
  }
  g.start('title');
  GR.app = { g: g, game: function () { return game; }, newGame: newGame };   // для отладки/автотестов в браузере: newGame({ level: 3 })
})(typeof window !== 'undefined' ? window : globalThis);
