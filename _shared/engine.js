/*! Гефест Arcade — фреймворк браузерных игр. vanilla JS, 0 зависимостей.
 * Общие системы, которые игры дублировали: цикл, ввод (клавиатура+тач-дпад), звук (WebAudio
 * + интерфейс музыки под modern-тему), i18n (RU/EN), темы (retro/modern), меню (title/пауза/
 * настройки: язык/тема/звук), сцены, сетка, частицы, HUD, счёт+рекорд (localStorage по игре).
 * Встроены критерии: проходимость (win/lose+финал, difficulty), играбельность (отклик, фидбек),
 * непресность (нарастание). Игры самодостаточны: build.sh копирует файл в игру. API — README.
 * (c) Студия «Гефест». v2.0.0
 */
(function (global) {
  'use strict';
  var doc = global.document;

  // ---------- Хранилище (localStorage с try/catch) ----------
  var Store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    getNum: function (k, d) { var v = this.get(k, null); return v == null ? d : (parseFloat(v) || d); },
  };

  // ---------- i18n ----------
  function I18n(tables, lang) {
    this.tables = tables || { ru: {}, en: {} };
    this.lang = lang || Store.get('arcade.lang', 'ru');
  }
  I18n.prototype.t = function (key, fallback) {
    var tb = this.tables[this.lang] || {};
    return tb[key] != null ? tb[key] : (fallback != null ? fallback : key);
  };
  I18n.prototype.set = function (lang) { this.lang = lang; Store.set('arcade.lang', lang); };
  I18n.prototype.toggle = function () { this.set(this.lang === 'ru' ? 'en' : 'ru'); return this.lang; };

  // ---------- Темы (retro / modern). modern — основная (вместо неона). ----------
  var THEMES = {
    modern: { // чистый современный дизайн
      bg: '#0e1016', panel: '#161a24', ink: '#eef2f8', muted: '#9aa4b5', accent: '#4f8cff',
      good: '#37d67a', bad: '#ff5d6c', warn: '#ffb020', grid: '#222838',
      font: 'Inter, system-ui, sans-serif', pixel: false, glow: true, radius: 10,
    },
    retro: { // 8-бит/CGA-дух
      bg: '#101014', panel: '#1b1620', ink: '#f3e9da', muted: '#8a7f6e', accent: '#ea6a12',
      good: '#55ff55', bad: '#ff5555', warn: '#ffd15e', grid: '#2b2230',
      font: '"Courier New", ui-monospace, monospace', pixel: true, glow: false, radius: 2,
    },
    neon: { // опциональная тема (дёшево — оставлена)
      bg: '#04050c', panel: '#0b1026', ink: '#eafcff', muted: '#6ad0e6', accent: '#39e7ff',
      good: '#49ffb0', bad: '#ff2f9c', warn: '#ffe14d', grid: '#13204a',
      font: 'Inter, system-ui, sans-serif', pixel: false, glow: true, radius: 8,
    },
  };

  // ---------- Ввод: клавиатура + тач-дпад (унифицировано) ----------
  function Input() {
    this.keys = Object.create(null); this.dir = { x: 0, y: 0 }; this._press = [];
    var map = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right', Space: 'action', Enter: 'start', Escape: 'pause', KeyP: 'pause', KeyM: 'mute', KeyL: 'lang', KeyT: 'theme' };
    var self = this;
    this._kd = function (e) { var a = map[e.code]; if (!a) return; if (!self.keys[a]) self._emit(a); self.keys[a] = true; self._setDir(); if (a !== 'mute' && a !== 'lang' && a !== 'theme') e.preventDefault(); };
    this._ku = function (e) { var a = map[e.code]; if (!a) return; self.keys[a] = false; self._setDir(); };
    addEventListener('keydown', this._kd, { passive: false }); addEventListener('keyup', this._ku);
  }
  Input.prototype._setDir = function () { this.dir.x = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0); this.dir.y = (this.keys.down ? 1 : 0) - (this.keys.up ? 1 : 0); };
  Input.prototype.onPress = function (cb) { this._press.push(cb); };
  Input.prototype._emit = function (a) { for (var i = 0; i < this._press.length; i++) this._press[i](a); };
  Input.prototype.pressed = function (a) { return !!this.keys[a]; };
  Input.prototype.bindDpad = function (root) {
    if (!root) return; var self = this; var keyFor = { U: 'up', D: 'down', L: 'left', R: 'right', A: 'action' };
    root.querySelectorAll('[data-d]').forEach(function (btn) {
      var a = keyFor[btn.dataset.d]; if (!a) return;
      var on = function (e) { e.preventDefault(); if (!self.keys[a]) self._emit(a); self.keys[a] = true; self._setDir(); };
      var off = function (e) { e.preventDefault(); self.keys[a] = false; self._setDir(); };
      btn.addEventListener('touchstart', on, { passive: false }); btn.addEventListener('touchend', off, { passive: false });
      btn.addEventListener('touchcancel', off, { passive: false }); btn.addEventListener('mousedown', on);
      btn.addEventListener('mouseup', off); btn.addEventListener('mouseleave', off);
    });
  };

  // ---------- Звук: 8-бит SFX + интерфейс музыки (задел под modern richer-music) ----------
  function Audio() {
    this.enabled = Store.get('arcade.sound', '1') !== '0';
    this.ac = null; this._music = {}; this._cur = null;
  }
  Audio.prototype._ctx = function () { if (this.ac) return this.ac; try { this.ac = new (global.AudioContext || global.webkitAudioContext)(); } catch (e) { this.ac = null; } return this.ac; };
  Audio.prototype.beep = function (f, d, type, vol) {
    if (!this.enabled) return; var ac = this._ctx(); if (!ac) return;
    var o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'square'; o.frequency.value = f || 440;
    o.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(vol == null ? 0.07 : vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + (d || 0.1)); o.start(); o.stop(ac.currentTime + (d || 0.1));
  };
  Audio.prototype.toggle = function () { this.enabled = !this.enabled; Store.set('arcade.sound', this.enabled ? '1' : '0'); if (!this.enabled) this.stopMusic(); return this.enabled; };
  // Интерфейс музыки: игра/тема регистрирует проигрыватель { start(ctx), stop() }.
  // 8-бит чиптюн — как сейчас; под modern-тему позже можно зарегистрировать richer-плеер (сэмплы).
  Audio.prototype.registerMusic = function (name, player) { this._music[name] = player; };
  Audio.prototype.playMusic = function (name) {
    if (!this.enabled) return; var p = this._music[name]; if (!p) return; // нет плеера — тихо (задел)
    this.stopMusic(); this._cur = p; try { p.start(this._ctx()); } catch (e) {}
  };
  Audio.prototype.stopMusic = function () { if (this._cur && this._cur.stop) { try { this._cur.stop(); } catch (e) {} } this._cur = null; };

  // ---------- Частицы / Сетка (как v1) ----------
  function Particles() { this.list = []; }
  Particles.prototype.spawn = function (x, y, o) { o = o || {}; var n = o.count || 8; for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, s = (o.speed || 60) * (0.3 + Math.random()); this.list.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: o.life || 0.5, t: o.life || 0.5, color: o.color || '#ffd15e', size: o.size || 3 }); } };
  Particles.prototype.update = function (dt) { for (var i = 0; i < this.list.length; i++) { var p = this.list[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt; p.t -= dt; } this.list = this.list.filter(function (p) { return p.t > 0; }); };
  Particles.prototype.draw = function (ctx) { for (var i = 0; i < this.list.length; i++) { var p = this.list[i]; ctx.globalAlpha = Math.max(0, p.t / p.life); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); } ctx.globalAlpha = 1; };
  function Grid(cols, rows, tile, fill) { this.cols = cols; this.rows = rows; this.tile = tile; this.cells = new Array(cols * rows).fill(fill == null ? 0 : fill); }
  Grid.prototype.idx = function (x, y) { return y * this.cols + x; };
  Grid.prototype.inside = function (x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; };
  Grid.prototype.get = function (x, y) { return this.inside(x, y) ? this.cells[this.idx(x, y)] : undefined; };
  Grid.prototype.set = function (x, y, v) { if (this.inside(x, y)) this.cells[this.idx(x, y)] = v; };
  Grid.prototype.fill = function (v) { this.cells.fill(v); };
  Grid.prototype.forEach = function (cb) { for (var y = 0; y < this.rows; y++) for (var x = 0; x < this.cols; x++) cb(x, y, this.cells[this.idx(x, y)]); };
  Grid.prototype.px = function (x, y) { return { x: x * this.tile, y: y * this.tile }; };

  function loadSprites(map, done) { var out = {}, keys = Object.keys(map), left = keys.length; if (!left) { done && done(out); return out; } keys.forEach(function (k) { var img = new Image(); img.onload = img.onerror = function () { out[k] = img; if (--left === 0) done && done(out); }; img.src = map[k]; }); return out; }

  // ---------- Меню (навигация стрелками + action + клик/тап) ----------
  function Menu(items) { this.items = items; this.sel = 0; }
  Menu.prototype.move = function (d) { this.sel = (this.sel + d + this.items.length) % this.items.length; };
  Menu.prototype.current = function () { return this.items[this.sel]; };
  Menu.prototype.draw = function (g, x, y, lh) {
    lh = lh || 30; var c = g.ctx, th = g.th();
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i], on = i === this.sel, label = typeof it.label === 'function' ? it.label() : it.label;
      g.text((on ? '▸ ' : '  ') + label, x, y + i * lh, { size: 17, align: 'center', color: on ? th.accent : th.muted, weight: on ? 800 : 600 });
      it._y = y + i * lh;
    }
  };
  Menu.prototype.pointer = function (py) { for (var i = 0; i < this.items.length; i++) { if (this.items[i]._y != null && Math.abs(py - (this.items[i]._y - 6)) < 16) { this.sel = i; return true; } } return false; };

  // ---------- Движок ----------
  function Engine(opts) {
    opts = opts || {};
    this.canvas = typeof opts.canvas === 'string' ? doc.querySelector(opts.canvas) : opts.canvas;
    if (!this.canvas) throw new Error('Arcade: canvas not found');
    this.gameId = opts.gameId || 'game';
    this.W = opts.width || this.canvas.width || 480; this.H = opts.height || this.canvas.height || 480;
    this.canvas.width = this.W; this.canvas.height = this.H; this.ctx = this.canvas.getContext('2d');
    this.input = new Input(); this.audio = new Audio(); this.particles = new Particles();
    this.i18n = new I18n(opts.strings, opts.lang);
    this.themeName = Store.get('arcade.theme', opts.theme || 'modern'); // modern по умолчанию
    this.themesMap = Object.assign({}, THEMES, opts.themes || {});
    this.step = opts.step || 1 / 60; this.scenes = Object.create(null); this.current = null;
    this.state = { score: 0, lives: opts.lives || 3, level: 1, best: this.loadBest() };
    this.running = false; this._acc = 0; this._last = 0; this._raf = 0; this.time = 0;
    this._applyPixel();
    var self = this;
    this.canvas.addEventListener('click', function (e) { self._click(e); });
    this.canvas.addEventListener('touchstart', function (e) { if (self.current && self.current._menu) { e.preventDefault(); self._click(e.changedTouches[0]); } }, { passive: false });
  }
  Engine.prototype.th = function () { return this.themesMap[this.themeName] || THEMES.modern; };
  Engine.prototype.t = function (k, f) { return this.i18n.t(k, f); };
  Engine.prototype._applyPixel = function () { this.ctx.imageSmoothingEnabled = !this.th().pixel; };
  Engine.prototype.setTheme = function (name) { this.themeName = name; Store.set('arcade.theme', name); this._applyPixel(); };
  Engine.prototype.toggleTheme = function () { var order = ['modern', 'retro']; if (this.themesMap.neon && this._allowNeon) order.push('neon'); this.setTheme(order[(order.indexOf(this.themeName) + 1) % order.length]); return this.themeName; };
  Engine.prototype.loadBest = function () { return Store.getNum('arcade.best.' + this.gameId, 0); };
  Engine.prototype.saveBest = function () { if (this.state.score > this.state.best) { this.state.best = this.state.score; Store.set('arcade.best.' + this.gameId, String(this.state.best)); } };

  Engine.prototype.scene = function (name, def) { this.scenes[name] = def; return this; };
  Engine.prototype.goto = function (name, data) { this.current = this.scenes[name]; this._sceneName = name; this._acc = 0; if (this.current && this.current.enter) this.current.enter.call(this, data || {}); };
  Engine.prototype._click = function (e) {
    var r = this.canvas.getBoundingClientRect(), py = (e.clientY - r.top) * (this.H / r.height);
    var sc = this.current; if (sc && sc._menu) { if (sc._menu.pointer(py)) { this._selectMenu(); } }
  };
  Engine.prototype._selectMenu = function () { var sc = this.current; if (sc && sc._menu) { var it = sc._menu.current(); if (it && it.onSelect) it.onSelect.call(this); } };
  Engine.prototype.start = function (name) {
    var self = this;
    this.input.onPress(function (a) {
      var sc = self.current;
      if (a === 'mute') { self.audio.toggle(); return; }
      if (sc && sc._menu) {
        if (a === 'up') { sc._menu.move(-1); self.audio.beep(600, 0.03); return; }
        if (a === 'down') { sc._menu.move(1); self.audio.beep(600, 0.03); return; }
        if (a === 'action' || a === 'start') { self._selectMenu(); return; }
      }
      if (a === 'lang') self.i18n.toggle();
      if (a === 'theme') self.toggleTheme();
      if (sc && sc.press) sc.press.call(self, a);
    });
    this.goto(name || 'title'); this.running = true; this._last = performance.now();
    var loop = function (t) {
      self._raf = requestAnimationFrame(loop);
      var dt = (t - self._last) / 1000; self._last = t; if (dt > 0.25) dt = 0.25;
      self.time += dt; self.particles.update(dt);
      var sc = self.current; if (!sc) return;
      if (sc.realtime) { if (sc.update) sc.update.call(self, dt); }
      else { self._acc += dt; while (self._acc >= self.step) { self._acc -= self.step; if (sc.update) sc.update.call(self, self.step); } }
      self.ctx.save(); if (sc.draw) sc.draw.call(self, self.ctx); self.particles.draw(self.ctx); self.ctx.restore();
    };
    this._raf = requestAnimationFrame(loop); return this;
  };
  Engine.prototype.stop = function () { cancelAnimationFrame(this._raf); this.running = false; };

  // Рисование (учитывает тему)
  Engine.prototype.clear = function (c) { var th = this.th(); this.ctx.fillStyle = c || th.bg; this.ctx.fillRect(0, 0, this.W, this.H); };
  Engine.prototype.rect = function (x, y, w, h, c) { this.ctx.fillStyle = c; this.ctx.fillRect(x, y, w, h); };
  Engine.prototype.sprite = function (img, x, y, w, h) { if (img) this.ctx.drawImage(img, x, y, w, h); };
  Engine.prototype.text = function (s, x, y, o) { o = o || {}; var c = this.ctx, th = this.th(); c.fillStyle = o.color || th.ink; c.font = (o.weight || 800) + ' ' + (o.size || 16) + 'px ' + (o.font || th.font); c.textAlign = o.align || 'left'; c.textBaseline = o.baseline || 'alphabetic'; c.fillText(s, x, y); };
  Engine.prototype.hud = function (o) {
    o = o || this.state; var th = this.th(); this.ctx.save();
    this.text(this.t('score', 'Счёт') + ' ' + (o.score | 0), 10, 22, { size: 14 });
    if (o.level != null) this.text(this.t('level', 'Ур.') + ' ' + o.level, this.W / 2, 22, { size: 14, align: 'center' });
    if (o.lives != null) this.text('♥ ' + o.lives, this.W - 10, 22, { size: 14, align: 'right', color: th.bad });
    this.ctx.restore();
  };
  Engine.prototype.overlay = function (title, sub, color) {
    var th = this.th(), c = this.ctx; c.save();
    c.fillStyle = 'rgba(6,8,12,.82)'; c.fillRect(0, 0, this.W, this.H);
    this.text(title, this.W / 2, this.H / 2 - 20, { size: Math.min(44, this.W / 9), align: 'center', color: color || th.accent });
    if (sub) this.text(sub, this.W / 2, this.H / 2 + 14, { size: 15, align: 'center', color: th.muted, weight: 600 });
    c.restore();
  };

  // Меню: title/pause/settings + помощники проходимости
  Engine.prototype.useStandardScreens = function (cfg) {
    cfg = cfg || {}; var self = this; this._allowNeon = !!cfg.neon;
    var startPlay = function () { self.state.score = 0; self.state.lives = cfg.lives || 3; self.state.level = 1; self.goto('play'); };
    var titleMenu = new Menu([
      { label: function () { return self.t('play', 'Играть'); }, onSelect: startPlay },
      { label: function () { return (self.t('language', 'Язык') + ': ' + (self.i18n.lang === 'ru' ? 'RU' : 'EN')); }, onSelect: function () { self.i18n.toggle(); } },
      { label: function () { return (self.t('theme', 'Тема') + ': ' + self.themeName); }, onSelect: function () { self.toggleTheme(); } },
      { label: function () { return (self.t('sound', 'Звук') + ': ' + (self.audio.enabled ? self.t('on', 'вкл') : self.t('off', 'выкл'))); }, onSelect: function () { self.audio.toggle(); } },
    ]);
    this.scene('title', { realtime: true, _menu: titleMenu, enter: function () { this.audio.beep(520, 0.08); },
      draw: function () { this.clear(); this.text(cfg.title || this.t('title', 'ИГРА'), this.W / 2, this.H / 2 - 70, { size: Math.min(40, this.W / 9), align: 'center', color: this.th().accent }); if (cfg.subtitle) this.text(cfg.subtitle, this.W / 2, this.H / 2 - 42, { size: 13, align: 'center', color: this.th().muted, weight: 600 }); titleMenu.draw(this, this.W / 2, this.H / 2, 30); if (this.state.best) this.text((this.t('best', 'Рекорд')) + ': ' + this.state.best, this.W / 2, this.H - 20, { size: 12, align: 'center', color: this.th().muted, weight: 600 }); } });
    var pauseMenu = new Menu([
      { label: function () { return self.t('resume', 'Продолжить'); }, onSelect: function () { self.goto('play', { resume: true }); } },
      { label: function () { return (self.t('sound', 'Звук') + ': ' + (self.audio.enabled ? self.t('on', 'вкл') : self.t('off', 'выкл'))); }, onSelect: function () { self.audio.toggle(); } },
      { label: function () { return self.t('menu', 'В меню'); }, onSelect: function () { self.goto('title'); } },
    ]);
    this.scene('pause', { realtime: true, _menu: pauseMenu, draw: function () { if (this.scenes.play && this.scenes.play.draw) this.scenes.play.draw.call(this, this.ctx); this.overlay(this.t('pause', 'ПАУЗА'), '', this.th().warn); pauseMenu.draw(this, this.W / 2, this.H / 2 + 20, 28); } });
    this.scene('win', { realtime: true, enter: function () { this.saveBest(); this.audio.beep(1200, 0.2, 'triangle'); }, draw: function () { this.clear(); this.overlay(this.t('win', 'ПОБЕДА!'), this.t('score', 'Счёт') + ': ' + (this.state.score | 0) + (this.state.best ? '   ' + this.t('best', 'Рекорд') + ': ' + this.state.best : ''), this.th().good); this.text(this.t('tapstart', 'пробел / тап'), this.W / 2, this.H - 24, { size: 12, align: 'center', color: this.th().muted, weight: 600 }); }, press: function () { this.goto('title'); } });
    this.scene('gameover', { realtime: true, enter: function () { this.saveBest(); this.audio.beep(140, 0.3, 'sawtooth'); }, draw: function () { this.clear(); this.overlay(this.t('gameover', 'КОНЕЦ ИГРЫ'), this.t('score', 'Счёт') + ': ' + (this.state.score | 0) + (this.state.best ? '   ' + this.t('best', 'Рекорд') + ': ' + this.state.best : ''), this.th().bad); this.text(this.t('tapstart', 'пробел / тап'), this.W / 2, this.H - 24, { size: 12, align: 'center', color: this.th().muted, weight: 600 }); }, press: function () { this.goto('title'); } });
    return this;
  };
  Engine.prototype.win = function () { this.goto('win'); };
  Engine.prototype.gameover = function () { this.goto('gameover'); };
  Engine.prototype.pause = function () { this.goto('pause'); };
  Engine.prototype.nextLevel = function () { this.state.level++; };
  Engine.prototype.difficulty = function (base, step, max) { var v = base + (this.state.level - 1) * step; return max == null ? v : (step >= 0 ? Math.min(v, max) : Math.max(v, max)); };
  Engine.prototype.fit = function (maxCssWidth) { var w = Math.min(maxCssWidth || 520, (this.canvas.parentElement || doc.body).clientWidth || this.W); this.canvas.style.width = w + 'px'; this.canvas.style.height = (w * this.H / this.W) + 'px'; };

  var Arcade = { createGame: function (o) { return new Engine(o); }, loadSprites: loadSprites, Grid: Grid, Input: Input, Audio: Audio, Particles: Particles, Menu: Menu, themes: THEMES, Store: Store, version: '2.0.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = Arcade;
  global.Arcade = Arcade;
})(typeof window !== 'undefined' ? window : globalThis);
