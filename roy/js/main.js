/* РОЙ · сборка: фреймворк Гефест Arcade (engine.js) + движок игры (game.js)
   + рендеры retro/modern. Сцены title/pause/win/gameover — g.useStandardScreens. */
(function (global) {
  'use strict';
  var R = global.ROY;
  var g = Arcade.createGame({ canvas: '#c', width: R.W, height: R.H, gameId: 'roy', strings: R.STR, theme: 'modern', lives: 3 });
  g.input.bindDpad(document.querySelector('.pad'));
  R.ui.init(g);

  var game = null;
  function rnd() { return g.themeName === 'retro' ? R.classic : R.modern; }

  // Цвета частиц взрыва по виду врага и теме
  var FX = {
    modern: { spore: '#45e08a', wedge: '#ff4f86', medusa: '#9d7dff', ship: '#ff9a4a' },
    retro:  { spore: '#58d854', wedge: '#e40058', medusa: '#9878f8', ship: '#fca044' }
  };
  function fx(type, d) {
    var pal = FX[g.themeName] || FX.modern, pix = g.themeName === 'retro';
    if (type === 'kill') {
      g.particles.spawn(d.x, d.y, { color: pal[d.kind], count: d.kind === 'medusa' ? 22 : 14, speed: 120, life: 0.55, size: pix ? 4 : 3 });
      g.particles.spawn(d.x, d.y, { color: '#ffffff', count: 5, speed: 70, life: 0.3, size: pix ? 3 : 2 });
    } else if (type === 'hurt') {
      g.particles.spawn(d.x, d.y, { color: '#ffffff', count: 6, speed: 60, life: 0.25, size: 2 });
    } else if (type === 'die' || type === 'hull') {
      g.particles.spawn(d.x, d.y, { color: pal.ship, count: 30, speed: 160, life: 0.9, size: pix ? 4 : 3 });
      g.particles.spawn(d.x, d.y, { color: '#ffffff', count: 12, speed: 90, life: 0.6, size: 3 });
    }
  }

  function mkGame() {
    return R.Game({
      lives: 3,
      // сложность волн — через g.difficulty (уровень движка = номер волны)
      diff: function (base, step, max) { return g.difficulty(base, step, max); },
      onEvent: function (type, d) {
        if (type === 'wave') g.state.level = d.wave;
        R.sfx(g, type, d); fx(type, d);
        if (game) { var s = game.state(); g.state.score = s.score; g.state.lives = s.lives; }
        if (type === 'win') g.win();
        else if (type === 'gameover') g.gameover();
      }
    });
  }

  g.useStandardScreens({ lives: 3 }); // заголовок берётся из i18n (title), подзаголовок рисуем сами

  // Фон со звёздами — на всех экранах (меню, победа, конец игры)
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) { baseClear.call(this, c); rnd().bg(this.ctx, this); };

  // Титульный экран: строй-заставка, подзаголовок, «цены» врагов, подсказка
  var title = g.scenes.title, titleDraw = title.draw;
  title.draw = function (ctx) {
    titleDraw.call(this, ctx);
    var th = this.th(), W = this.W, H = this.H, r = rnd(), t = this.time;
    this.text(this.t('subtitle'), W / 2, H / 2 - 40, { size: 14, align: 'center', color: th.muted, weight: 700 });
    var kinds = ['medusa', 'wedge', 'wedge', 'spore', 'spore'];
    for (var i = 0; i < 5; i++) {
      var b = 1 + 0.08 * Math.sin(t * 1.7);
      r.icon(ctx, kinds[i], W / 2 + (i - 2) * 56 * b, 150 + Math.sin(t * 2 + i) * 6, this, ((t * 3) | 0) % 2);
    }
    var KD = R.consts.KINDS, rows = ['spore', 'wedge', 'medusa'];
    for (var k = 0; k < 3; k++) {
      var y = 470 + k * 38, K = KD[rows[k]];
      r.icon(ctx, rows[k], W / 2 - 110, y - 6, this, 0);
      this.text(this.t(rows[k]), W / 2 - 78, y, { size: 13, color: th.ink, weight: 700 });
      this.text(K.pts + ' · ' + this.t('inDive') + ' ' + K.divePts, W / 2 + 150, y, { size: 13, color: th.accent, weight: 700, align: 'right' });
    }
    this.text(this.t('hintMedusa'), W / 2, 585, { size: 11, align: 'center', color: th.muted, weight: 600 });
    this.text(this.t('controls'), W / 2, 604, { size: 11, align: 'center', color: th.muted, weight: 600 });
  };

  g.scene('play', {
    realtime: true,
    enter: function (d) {
      if (!(d && d.resume) || !game) { game = mkGame(); game.start(); }
    },
    press: function (a) {
      if (!game) return;
      if (a === 'pause') { this.pause(); return; }
      if (a === 'action') game.fire();
    },
    update: function (dt) {
      if (!game) return;
      game.setDir(this.input.dir.x);
      game.setFire(this.input.pressed('action'));   // удержание — автоогонь с откатом
      game.update(dt);
      var s = game.state(); g.state.score = s.score; g.state.lives = s.lives;
    },
    draw: function (ctx) { if (game) rnd().draw(ctx, game.state(), this); else this.clear(); }
  });

  g.start('title');
  global.ROY.app = { g: g, game: function () { return game; } }; // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
