/*! Гефест Arcade micro-engine — vanilla JS, 0 зависимостей.
 * Общий движок аркады: цикл с фикс-шагом, ввод (клавиатура+тач-дпад), звук (WebAudio),
 * canvas/пиксель-арт, менеджер сцен (title→play→win/gameover), сетка/коллизии, частицы, HUD,
 * и встроенные помощники под критерии: проходимость (win/lose + финал), непресность (рампа
 * сложности, обратная связь). Игры остаются самодостаточными: build.sh копирует этот файл в игру.
 * API — см. _shared/README.md.  (c) Студия «Гефест».
 */
(function (global) {
  'use strict';

  // ---------- Ввод: клавиатура + экранный тач-дпад ----------
  function Input() {
    this.keys = Object.create(null);
    this.dir = { x: 0, y: 0 };
    this._press = [];
    const map = {
      ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      Space: 'action', Enter: 'start', KeyP: 'pause', KeyM: 'mute',
    };
    const setDir = () => {
      this.dir.x = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
      this.dir.y = (this.keys.down ? 1 : 0) - (this.keys.up ? 1 : 0);
    };
    this._kd = (e) => {
      const a = map[e.code]; if (!a) return;
      if (!this.keys[a]) this._emit(a);
      this.keys[a] = true; setDir();
      if (a !== 'mute') e.preventDefault();
    };
    this._ku = (e) => { const a = map[e.code]; if (!a) return; this.keys[a] = false; setDir(); };
    addEventListener('keydown', this._kd, { passive: false });
    addEventListener('keyup', this._ku);
  }
  Input.prototype.onPress = function (cb) { this._press.push(cb); };
  Input.prototype._emit = function (a) { for (const cb of this._press) cb(a); };
  Input.prototype.pressed = function (a) { return !!this.keys[a]; };
  // Привязать существующий .pad (кнопки data-d="U/D/L/R/A") или создать дпад в контейнере.
  Input.prototype.bindDpad = function (root) {
    if (!root) return;
    const keyFor = { U: 'up', D: 'down', L: 'left', R: 'right', A: 'action' };
    root.querySelectorAll('[data-d]').forEach((btn) => {
      const a = keyFor[btn.dataset.d]; if (!a) return;
      const on = (e) => { e.preventDefault(); if (!this.keys[a]) this._emit(a); this.keys[a] = true; this._setDir(); };
      const off = (e) => { e.preventDefault(); this.keys[a] = false; this._setDir(); };
      btn.addEventListener('touchstart', on, { passive: false });
      btn.addEventListener('touchend', off, { passive: false });
      btn.addEventListener('touchcancel', off, { passive: false });
      btn.addEventListener('mousedown', on); btn.addEventListener('mouseup', off); btn.addEventListener('mouseleave', off);
    });
  };
  Input.prototype._setDir = function () {
    this.dir.x = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    this.dir.y = (this.keys.down ? 1 : 0) - (this.keys.up ? 1 : 0);
  };

  // ---------- Звук: WebAudio беперы ----------
  function Audio() { this.enabled = true; this.ac = null; }
  Audio.prototype._ctx = function () {
    if (this.ac) return this.ac;
    try { this.ac = new (global.AudioContext || global.webkitAudioContext)(); } catch (e) { this.ac = null; }
    return this.ac;
  };
  Audio.prototype.beep = function (freq, dur, type, vol) {
    if (!this.enabled) return; const ac = this._ctx(); if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square'; o.frequency.value = freq || 440;
    o.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(vol == null ? 0.07 : vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + (dur || 0.1));
    o.start(); o.stop(ac.currentTime + (dur || 0.1));
  };
  Audio.prototype.toggle = function () { this.enabled = !this.enabled; return this.enabled; };

  // ---------- Частицы ----------
  function Particles() { this.list = []; }
  Particles.prototype.spawn = function (x, y, o) {
    o = o || {}; const n = o.count || 8;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (o.speed || 60) * (0.3 + Math.random());
      this.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: o.life || 0.5, t: o.life || 0.5, color: o.color || '#ffd15e', size: o.size || 3 });
    }
  };
  Particles.prototype.update = function (dt) {
    for (const p of this.list) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt; p.t -= dt; }
    this.list = this.list.filter((p) => p.t > 0);
  };
  Particles.prototype.draw = function (ctx) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, p.t / p.life); ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  };

  // ---------- Сетка ----------
  function Grid(cols, rows, tile, fill) {
    this.cols = cols; this.rows = rows; this.tile = tile;
    this.cells = new Array(cols * rows).fill(fill == null ? 0 : fill);
  }
  Grid.prototype.idx = function (x, y) { return y * this.cols + x; };
  Grid.prototype.inside = function (x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; };
  Grid.prototype.get = function (x, y) { return this.inside(x, y) ? this.cells[this.idx(x, y)] : undefined; };
  Grid.prototype.set = function (x, y, v) { if (this.inside(x, y)) this.cells[this.idx(x, y)] = v; };
  Grid.prototype.fill = function (v) { this.cells.fill(v); };
  Grid.prototype.forEach = function (cb) {
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) cb(x, y, this.cells[this.idx(x, y)]);
  };
  Grid.prototype.px = function (x, y) { return { x: x * this.tile, y: y * this.tile }; };

  // ---------- Загрузка спрайтов (data-URI/URL) ----------
  function loadSprites(map, done) {
    const out = {}; const keys = Object.keys(map); let left = keys.length;
    if (!left) { done && done(out); return out; }
    keys.forEach((k) => {
      const img = new Image();
      img.onload = img.onerror = () => { out[k] = img; if (--left === 0) done && done(out); };
      img.src = map[k];
    });
    return out;
  }

  // ---------- Движок ----------
  function Engine(opts) {
    opts = opts || {};
    this.canvas = typeof opts.canvas === 'string' ? document.querySelector(opts.canvas) : opts.canvas;
    if (!this.canvas) throw new Error('Arcade: canvas not found');
    this.W = opts.width || this.canvas.width || 480;
    this.H = opts.height || this.canvas.height || 480;
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.ctx = this.canvas.getContext('2d');
    if (opts.pixel !== false) this.ctx.imageSmoothingEnabled = false;
    this.input = new Input();
    this.audio = new Audio();
    this.particles = new Particles();
    this.step = opts.step || 1 / 60;       // фикс-шаг физики (сек)
    this.scenes = Object.create(null);
    this.current = null;
    this.state = { score: 0, lives: opts.lives || 3, level: 1 };
    this.running = false;
    this._acc = 0; this._last = 0; this._raf = 0; this.time = 0;
  }
  Engine.prototype.scene = function (name, def) { this.scenes[name] = def; return this; };
  Engine.prototype.goto = function (name, data) {
    this.current = this.scenes[name]; this._sceneName = name; this._acc = 0;
    if (this.current && this.current.enter) this.current.enter.call(this, data || {});
  };
  Engine.prototype.start = function (name) {
    this.input.onPress((a) => { if (this.current && this.current.press) this.current.press.call(this, a); });
    this.goto(name || 'title');
    this.running = true; this._last = performance.now();
    const loop = (t) => {
      this._raf = requestAnimationFrame(loop);
      let dt = (t - this._last) / 1000; this._last = t; if (dt > 0.25) dt = 0.25;
      this.time += dt; this.particles.update(dt);
      const sc = this.current;
      if (sc) {
        if (sc.realtime) { if (sc.update) sc.update.call(this, dt); }
        else { this._acc += dt; while (this._acc >= this.step) { this._acc -= this.step; if (sc.update) sc.update.call(this, this.step); } }
        this.ctx.save(); if (sc.draw) sc.draw.call(this, this.ctx); this.particles.draw(this.ctx); this.ctx.restore();
      }
    };
    this._raf = requestAnimationFrame(loop);
    return this;
  };
  Engine.prototype.stop = function () { cancelAnimationFrame(this._raf); this.running = false; };

  // Рисование
  Engine.prototype.clear = function (color) { this.ctx.fillStyle = color || '#000'; this.ctx.fillRect(0, 0, this.W, this.H); };
  Engine.prototype.rect = function (x, y, w, h, color) { this.ctx.fillStyle = color; this.ctx.fillRect(x, y, w, h); };
  Engine.prototype.sprite = function (img, x, y, w, h) { if (img) this.ctx.drawImage(img, x, y, w, h); };
  Engine.prototype.text = function (s, x, y, o) {
    o = o || {}; const c = this.ctx;
    c.fillStyle = o.color || '#fff'; c.font = (o.weight || 800) + ' ' + (o.size || 16) + 'px Inter, system-ui, sans-serif';
    c.textAlign = o.align || 'left'; c.textBaseline = o.baseline || 'alphabetic'; c.fillText(s, x, y);
  };
  Engine.prototype.hud = function (o) {
    o = o || this.state; const c = this.ctx; c.save();
    this.text('Счёт ' + (o.score | 0), 10, 22, { size: 14 });
    if (o.level != null) this.text('Ур. ' + o.level, this.W / 2, 22, { size: 14, align: 'center' });
    if (o.lives != null) this.text('♥ ' + o.lives, this.W - 10, 22, { size: 14, align: 'right' });
    c.restore();
  };

  // Готовые оверлейные сцены title/win/gameover + помощники проходимости
  Engine.prototype.overlay = function (title, sub, color) {
    const c = this.ctx; c.save();
    c.fillStyle = 'rgba(8,8,12,.82)'; c.fillRect(0, 0, this.W, this.H);
    this.text(title, this.W / 2, this.H / 2 - 10, { size: Math.min(44, this.W / 9), align: 'center', color: color || '#ffd15e' });
    if (sub) this.text(sub, this.W / 2, this.H / 2 + 26, { size: 15, align: 'center', color: '#cbb79a', weight: 600 });
    this.text('нажми пробел / тап', this.W / 2, this.H - 24, { size: 12, align: 'center', color: '#8a7f6e', weight: 600 });
    c.restore();
  };
  // Стандартные сцены-экраны: передай { onStart } для play-сцены 'play'.
  Engine.prototype.useStandardScreens = function (cfg) {
    cfg = cfg || {};
    const go = (to) => () => this.goto(to);
    this.scene('title', { realtime: true, enter() { this.audio.beep(520, 0.08); },
      draw() { this.clear(cfg.bg || '#101018'); this.overlay(cfg.title || 'ИГРА', cfg.subtitle || '', cfg.accent); },
      press(a) { if (a === 'action' || a === 'start') { this.state.score = 0; this.state.lives = cfg.lives || 3; this.state.level = 1; this.goto('play'); } } });
    this.scene('win', { realtime: true, enter() { this.audio.beep(1200, 0.2, 'triangle'); },
      draw() { this.clear(cfg.bg || '#101018'); this.overlay('ПОБЕДА!', 'Счёт: ' + (this.state.score | 0), '#4ade80'); },
      press: go('title') });
    this.scene('gameover', { realtime: true, enter() { this.audio.beep(140, 0.3, 'sawtooth'); },
      draw() { this.clear(cfg.bg || '#101018'); this.overlay('КОНЕЦ ИГРЫ', 'Счёт: ' + (this.state.score | 0), '#f87171'); },
      press: go('title') });
    return this;
  };
  Engine.prototype.win = function () { this.goto('win'); };
  Engine.prototype.gameover = function () { this.goto('gameover'); };
  Engine.prototype.nextLevel = function () { this.state.level++; };
  // Рампа сложности: base на 1-м уровне, +step за уровень, не круче max.
  Engine.prototype.difficulty = function (base, step, max) {
    const v = base + (this.state.level - 1) * step;
    return max == null ? v : (step >= 0 ? Math.min(v, max) : Math.max(v, max));
  };

  // Адаптивная подгонка canvas по ширине контейнера (CSS), пиксель-арт сохраняется.
  Engine.prototype.fit = function (maxCssWidth) {
    const w = Math.min(maxCssWidth || 520, (this.canvas.parentElement || document.body).clientWidth || this.W);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = (w * this.H / this.W) + 'px';
  };

  const Arcade = {
    createGame(opts) { return new Engine(opts); },
    loadSprites,
    Grid, Input, Audio, Particles,
    version: '1.0.0',
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Arcade;
  global.Arcade = Arcade;
})(typeof window !== 'undefined' ? window : globalThis);
