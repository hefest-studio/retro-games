/* ПАРОВИКИ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + общий рендер с палитрами retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; 1–2 игрока — g.usePlayers (пункт «Игроки», клавиши 1/2, подсказка).
   Свои пункты меню: «Продолжить» (сохранение), «Герой И1», «Герой И2 / Напарник (ИИ)», «Пароль». Своя сцена: password.
   Лавка между уровнями — фаза игры внутри сцены play (у каждого игрока своя колонка).
   Хранение: сохранение — arcade.paroviki.save, выбор героев — arcade.paroviki.heroes.
   Тач (только И1): крестовина [data-d], кнопки [data-act] «огонь»/«спецприём», [data-pause]. */
(function (global) {
  'use strict';
  var PV = global.PAROVIKI, L = PV.logic;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#141312', panel: '#1a1917', ink: '#f2ece0', muted: '#a3a9b3', accent: '#e0b04c', grid: '#2a2826' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#f8c048', muted: '#a8a8a8' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.W, height: L.SCREEN_H, gameId: 'paroviki', strings: PV.STR, theme: 'modern', lives: 3, themes: themes });
  PV.g = g;
  var pad = document.querySelector('.pad');
  PV.ui.init(g);
  function pal() { return g.themeName === 'retro' ? PV.classic : PV.modern; }

  // ---------- Хранение ----------
  var SAVE_KEY = 'arcade.paroviki.save', HERO_KEY = 'arcade.paroviki.heroes';
  function sget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function loadSave() { try { var p = JSON.parse(sget(SAVE_KEY) || 'null'); return p && p.team && p.team.length === 2 ? p : null; } catch (e) { return null; } }
  var heroes = [0, 1];
  try { var hh = JSON.parse(sget(HERO_KEY) || 'null'); if (hh && hh.length === 2 && hh[0] !== hh[1] && hh.every(function (x) { return x >= 0 && x < 4; })) heroes = hh; } catch (e) {}
  function saveHeroes() { sset(HERO_KEY, JSON.stringify(heroes)); }

  g.useStandardScreens({ lives: 3 });
  g.usePlayers({
    bind: L.BIND, actions: ['fire', 'spec'], pad: pad, touch: { L: 'left', R: 'right', U: 'up', D: 'down' },
    hint: { ru: [PV.STR.ru.hint1, PV.STR.ru.hint2], en: [PV.STR.en.hint1, PV.STR.en.hint2] }
  });
  g.input.bindDpad(pad);

  // ---------- Тач: кнопки действий (И1) ----------
  var touchAct = { fire: false, spec: false };
  if (pad) pad.querySelectorAll('[data-act]').forEach(function (el) {
    var a = el.getAttribute('data-act');
    var on = function (e) { e.preventDefault(); if (!touchAct[a]) actPress(0, a); touchAct[a] = true; };
    var off = function (e) { e.preventDefault(); touchAct[a] = false; };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
  });

  // ---------- Меню ----------
  var nP = function () { return g.input.playerCount; };
  function heroName(i) { return g.t('h_' + L.HEROES[i].key); }
  function cycleHero(slot) { var o = heroes[1 - slot], v = heroes[slot]; do { v = (v + 1) % 4; } while (v === o); heroes[slot] = v; saveHeroes(); }
  g.menu.addItem({ key: 'play', index: 0, label: function () { return g.t('play'); }, onSelect: function () { startGame(null); } });
  var contItem = { key: 'cont', label: function () { var s = loadSave(); return g.t('cont') + (s ? ' · ' + g.t('contFrom') + ' ' + s.world + '-' + (s.lvl === L.LEVELS ? '★' : s.lvl) : ''); }, onSelect: function () { var s = loadSave(); if (s) startGame(s); } };
  g.menu.addItem({ key: 'hero1', after: 'players', label: function () { return g.t('hero1') + ': ' + heroName(heroes[0]); }, onSelect: function () { cycleHero(0); } });
  g.menu.addItem({ key: 'hero2', after: 'hero1', label: function () { return (nP() === 2 ? g.t('hero2') : g.t('aiMate')) + ': ' + heroName(heroes[1]); }, onSelect: function () { cycleHero(1); } });
  g.menu.addItem({ key: 'pass', after: 'hero2', label: function () { return g.t('pass'); }, onSelect: function () { openPass(); } });
  function syncMenu() { var m = g.menu.get('title'); if (!m) return; var has = m.indexOf('cont') >= 0, want = !!loadSave(); if (want && !has) m.add(contItem, { after: 'play' }); else if (!want && has) m.remove('cont'); }
  syncMenu();
  var menuTitle = g.menu.get('title'); if (loadSave()) menuTitle.sel = menuTitle.indexOf('cont');

  // ---------- Игра ----------
  var game = null, toasts = [], shakeT = 0, flash = [{ t: 0 }, { t: 0 }];
  function sync() { if (game) g.state.score = game.state().score; }
  function toast(text, color, x, y, big, screen) { toasts.push({ text: text, color: color, x: x, y: y, t: 1.3, big: big, screen: screen }); if (toasts.length > 9) toasts.shift(); }
  function fx(type, d) {
    if (!game || !d || d.x == null) return;
    var P = pal(), S = game.state(), sx = d.x - S.cam.x, sy = d.y - S.cam.y + L.HUD, sz = P.pixel ? 4 : 3;
    if (sx < -40 || sx > L.W + 40 || sy < 0 || sy > L.SCREEN_H + 40) return;
    if (type === 'kill') g.particles.spawn(sx, sy, { color: d.type === 'nest' ? P.nestMouth : P[d.type] || P.tin, count: d.type === 'nest' ? 30 : d.type === 'heavy' ? 18 : 8, speed: d.type === 'nest' ? 170 : 110, life: 0.45, size: sz });
    else if (type === 'heroDie') g.particles.spawn(sx, sy, { color: P.steam, count: 24, speed: 140, life: 0.8, size: sz });
    else if (type === 'valve') g.particles.spawn(sx, sy - 10, { color: P.steam, count: 26, speed: 120, life: 0.9, size: sz });
    else if (type === 'coin' || type === 'chest') g.particles.spawn(sx, sy, { color: P.coin, count: type === 'chest' ? 18 : 5, speed: 80, life: 0.4, size: 2 });
    else if (type === 'warp') g.particles.spawn(sx, sy, { color: P.steam, count: 18, speed: 120, life: 0.5, size: sz });
    else if (type === 'secret' || type === 'crate') g.particles.spawn(sx, sy, { color: P.crate, count: 14, speed: 120, life: 0.5, size: sz });
    else if (type === 'bossDie') g.particles.spawn(sx, sy, { color: P.bossCore, count: 80, speed: 260, life: 1.4, size: sz + 1 });
    else if (type === 'special' && d.kind === 'heal') g.particles.spawn(sx, sy, { color: P.good, count: 20, speed: 90, life: 0.7, size: sz });
  }
  function onEvent(type, d) {
    PV.sfx(g, type, d); fx(type, d);
    var P = pal(), S = game ? game.state() : null; if (!S) return;
    if (type === 'valve') toast(d.left ? g.t('valveOn') + ' · ' + g.t('valveLeft') + ' ' + d.left : g.t('valveOn'), P.valveOn, d.x, d.y - 26, true);
    else if (type === 'exitOpen') toast(g.t('exitOpen'), P.exitOpen, L.W / 2, L.HUD + 110, true, true);
    else if (type === 'secret') toast(g.t('secret'), P.warn, d.x, d.y - 20, true);
    else if (type === 'key') toast(g.t('key'), P.key, d.x, d.y - 16);
    else if (type === 'lever') toast(g.t('lever'), P.warn, d.x, d.y - 20, true);
    else if (type === 'open' && d.kind === 'door') toast(g.t('door'), P.door, d.x, d.y - 20);
    else if (type === 'food') toast(g.t('food'), P.good, d.x, d.y - 16);
    else if (type === 'charge') toast(g.t('charge'), P.charge, d.x, d.y - 16);
    else if (type === 'chest') toast('+' + d.v, P.coin, d.x, d.y - 16, true);
    else if (type === 'armorDown') toast(d.left ? g.t('armorDown') : g.t('armorOff'), P.bossArmor, L.W / 2, L.HUD + 120, true, true);
    else if (type === 'warp') toast(g.t('warp'), P.muted, d.x, d.y - 26);
    else if (type === 'revive') toast(g.t('revive'), P.good, d.x, d.y - 26);
    else if (type === 'continue') toast(g.t('continued'), P.warn, L.W / 2, L.HUD + 200, true, true);
    else if (type === 'special') toast(g.t('s_' + d.kind), P.hero[S.team[d.pi].hid], d.x, d.y - 30, true);
    if (type === 'heroDie' || type === 'thud' || type === 'kill' && d.type === 'nest') shakeT = Math.max(shakeT, 0.25);
    if (type === 'special' && d.kind === 'bomb') shakeT = Math.max(shakeT, 0.4);
    if (type === 'bossDie') shakeT = 1.4;
    if (type === 'shop') { sset(SAVE_KEY, JSON.stringify(game.progress())); syncMenu(); flash = [{ t: 0 }, { t: 0 }]; }
    sync();
    if (type === 'win') { sset(SAVE_KEY, null); syncMenu(); g.win(); }
    else if (type === 'gameover') { sset(SAVE_KEY, null); syncMenu(); g.gameover(); }
  }
  var pending = null;
  function startGame(save) { pending = save; g.state.score = save ? save.score || 0 : 0; g.goto('play'); }
  function newGame(save) {
    var o = { players: nP(), onEvent: onEvent, seed: Math.floor(Math.random() * 1e6), heroes: heroes.slice() };
    if (save) { o.save = save; o.players = save.players === 2 && !g.input.touchOnly ? 2 : 1; g.input.setPlayerCount(o.players); if (save.seed) o.seed = save.seed; }
    game = PV.Game(o); PV.current = game; toasts = []; shakeT = 0; game.start(); sync();
  }

  // ---------- Действия игроков: бой, лавка, продолжение ----------
  function actPress(pi, a) {
    if (!game || g._sceneName !== 'play') return;
    var S = game.state();
    if (S.phase === 'cont') { game.cont(); return; }
    if (S.phase === 'shop') { if (a === 'fire') shopSelect(pi); return; }
    if (a === 'spec' && S.phase === 'play') game.special(pi);
  }
  [0, 1].forEach(function (pi) { g.input.player(pi).onPress(function (a) { actPress(pi, a); }); });
  function shopSelect(pi) {
    var S = game.state(); if (S.aiOn && pi === 1) return; var st = S.shop[pi]; if (st.ready) return;
    var items = game.shopItems(pi), it = items[st.sel];
    if (it === 'ready') { game.shopReady(pi); return; }
    var p = game.price(pi, it), t = S.team[pi];
    if (p == null) { flash[pi] = { t: 1.2, ok: false, text: g.t('max') }; g.audio.beep(180, 0.08); }
    else if (game.buy(pi, it)) { flash[pi] = { t: 1.2, ok: true, text: '−' + p }; sset(SAVE_KEY, JSON.stringify(game.progress())); }
    else { flash[pi] = { t: 1.2, ok: false, text: g.t('noMoney') + ' ' + (p - t.money) }; g.audio.beep(160, 0.12, 'square', 0.05); }
  }
  function shopNav(pi, dir) { var S = game.state(), st = S.shop[pi]; if (st.ready || (S.aiOn && pi === 1)) return; var n = game.shopItems(pi).length; st.sel = (st.sel + dir + n) % n; g.audio.beep(600, 0.03); }
  // навигация по лавке: ↑↓ своей раскладки (в одиночке обе ведут И1); тач-крестовина — И1
  addEventListener('keydown', function (e) {
    if (!game || g._sceneName !== 'play' || game.state().phase !== 'shop' || e.repeat) return;
    for (var pi = 0; pi < 2; pi++) {
      var b = L.BIND[pi ? 'p2' : 'p1'], who = nP() === 2 ? pi : 0;
      if (b.up.indexOf(e.code) >= 0) { shopNav(who, -1); return; }
      if (b.down.indexOf(e.code) >= 0) { shopNav(who, 1); return; }
    }
  });
  if (pad) ['U', 'D'].forEach(function (d) {
    var el = pad.querySelector('[data-d="' + d + '"]');
    if (el) el.addEventListener('pointerdown', function () { if (game && g._sceneName === 'play' && game.state().phase === 'shop') shopNav(0, d === 'U' ? -1 : 1); });
  });
  // клик/тап по строке лавки (И1 — левая колонка, И2 — правая)
  g.canvas.addEventListener('click', function (e) {
    if (!game || g._sceneName !== 'play' || game.state().phase !== 'shop') return;
    var r = g.canvas.getBoundingClientRect(), x = (e.clientX - r.left) * g.W / r.width, y = (e.clientY - r.top) * g.H / r.height;
    var pi = x < g.W / 2 ? 0 : 1, row = Math.round((y - 70 - 72 + 4) / 38), n = game.shopItems(pi).length;
    if (row >= 0 && row < n && (pi === 0 || nP() === 2)) { game.state().shop[pi].sel = row; shopSelect(pi); }
  });

  // ---------- Титул: двое паровиков отбиваются под меню ----------
  var demo = null, demoT = 0;
  function demoInit() {
    demo = PV.Game({ players: 1, seed: 7, rng: L.mulberry32(11), heroes: heroes.slice() }).start();
    var S = demo.state(); S.banner = 0;
  }
  function demoStep(dt) {
    if (!demo || demo.state().team[0].hid !== heroes[0] || demo.state().team[1].hid !== heroes[1]) demoInit();
    var S = demo.state(), h = S.heroes[0];
    S.heroes.forEach(function (x) { x.inv = 0.3; x.hp = x.maxHp; });
    var near = null, bd = 260; S.enemies.forEach(function (e) { var d = Math.hypot(e.x - h.x, e.y - h.y); if (d < bd) { bd = d; near = e; } });
    if (S.enemies.filter(function (e) { return e.type !== 'nest'; }).length < 7) { var a = Math.random() * 6.28, x = h.x + Math.cos(a) * 220, y = h.y + Math.sin(a) * 160; if (!demo._hitsWall(x, y, 12)) demo._addEnemy(['tin', 'bug', 'tin'][Math.floor(Math.random() * 3)], x, y).spawnFx = 0.4; }
    if (near) { var ang = Math.atan2(near.y - h.y, near.x - h.x), k = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8; h.face = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]][k]; demo.setFire(0, true); }
    else demo.setFire(0, false);
    demo.update(Math.min(dt, 0.05));
    if (S.phase !== 'play') demoInit();
  }
  var title = g.scenes.title, menu = title._menu;
  var baseEnter = title.enter;
  title.enter = function () { syncMenu(); if (baseEnter) baseEnter.call(this); };
  title.update = function (dt) { demoT += dt; demoStep(dt); };
  title.draw = function (ctx) {
    var th = this.th(), P = pal(), W = this.W, H = this.H;
    if (!demo) demoInit();
    PV.ui.render(this, ctx, demo.state(), P, { bare: true });
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.5)' : 'rgba(10,9,8,.5)'; ctx.fillRect(0, 0, W, H);
    var n = menu.items.length, pw = 420, ph = 120 + n * 28, px = (W - pw) / 2, py = 30;
    PV.ui.panel(ctx, px, py, pw, ph, P, P.accent);
    PV.ui.txt(this, this.t('title'), W / 2, py + 62, { size: 54, align: 'center', color: P.accent, weight: 900 }, P);
    PV.ui.txt(this, this.t('subtitle'), W / 2, py + 86, { size: 11, align: 'center', color: th.muted, weight: 600, shadow: false }, P);
    menu.draw(this, W / 2, py + 122, 28);
    var hd = this.t('hd_' + L.HEROES[heroes[0]].key) + '  ·  ' + this.t('hd_' + L.HEROES[heroes[1]].key);
    PV.ui.txt(this, hd, W / 2, py + ph + 18, { size: 11, align: 'center', color: th.ink, weight: 600, shadow: true }, P);
    if (this.state.best) PV.ui.txt(this, this.t('best') + ': ' + this.state.best, px + pw - 14, py + 20, { size: 11, align: 'right', color: th.muted, weight: 700, shadow: false }, P);
    this.menu._drawHint('title');
  };
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {
    baseClear.call(this, c);
    if ((this._sceneName === 'win' || this._sceneName === 'gameover') && game) PV.ui.render(this, this.ctx, game.state(), pal(), { bare: true });
  };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- Пароль ----------
  var PS = { chars: [], pos: 0, msg: '', msgT: 0, ok: false };
  function openPass() { PS.chars = new Array(10).fill(0); PS.pos = 0; PS.msg = ''; g.goto('password'); }
  function passStr() { return PS.chars.map(function (c) { return L.ALPHA[c]; }).join(''); }
  function passSubmit() {
    var p = L.decodePass(passStr());
    if (!p) { PS.msg = g.t('passBad'); PS.ok = false; PS.msgT = 2; g.audio.beep(160, 0.15, 'square', 0.05); return; }
    heroes = [p.team[0].hid, p.team[1].hid]; saveHeroes();
    if (!g.input.touchOnly) g.input.setPlayerCount(p.players);
    p.score = 0; startGame(p);
  }
  g.scene('password', {
    realtime: true,
    update: function (dt) { if (PS.msgT > 0) PS.msgT -= dt; },
    press: function (a) {
      if (a === 'pause') { this.goto('title'); return; }
      if (a === 'up') PS.chars[PS.pos] = (PS.chars[PS.pos] + 1) % 32;
      else if (a === 'down') PS.chars[PS.pos] = (PS.chars[PS.pos] + 31) % 32;
      else if (a === 'left') PS.pos = (PS.pos + 9) % 10;
      else if (a === 'right' || a === 'action') PS.pos = (PS.pos + 1) % 10;
      else if (a === 'start') { passSubmit(); return; }
      this.audio.beep(600, 0.03);
    },
    draw: function (ctx) {
      var P = pal(), W = this.W, H = this.H;
      if (!demo) demoInit();
      PV.ui.render(this, ctx, demo.state(), P, { bare: true });
      ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.7)' : 'rgba(10,9,8,.7)'; ctx.fillRect(0, 0, W, H);
      PV.ui.panel(ctx, 70, 120, W - 140, 240, P, P.accent);
      PV.ui.txt(this, PV.ui.up(P, this.t('passTitle')), W / 2, 166, { size: 22, align: 'center', color: P.accent, weight: 900 }, P);
      for (var i = 0; i < 10; i++) {
        var x = W / 2 - 5 * 40 + i * 40 + 20, on = i === PS.pos;
        ctx.fillStyle = on ? P.accent : P.line; ctx.fillRect(x - 15, 236, 30, 3);
        PV.ui.txt(this, L.ALPHA[PS.chars[i]], x, 228, { size: 26, align: 'center', color: on ? P.accent : P.ink, weight: 900 }, P);
        if (on) { PV.ui.txt(this, '▲', x, 198, { size: 11, align: 'center', color: P.muted, weight: 700, shadow: false }, P); PV.ui.txt(this, '▼', x, 256, { size: 11, align: 'center', color: P.muted, weight: 700, shadow: false }, P); }
      }
      PV.ui.txt(this, this.t('passHint'), W / 2, 300, { size: 11, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
      if (PS.msgT > 0) PV.ui.txt(this, PS.msg, W / 2, 334, { size: 14, align: 'center', color: PS.ok ? P.good : P.bad, weight: 800 }, P);
    }
  });
  addEventListener('keydown', function (e) { // буквы и цифры набираются прямо с клавиатуры
    if (g._sceneName !== 'password') return;
    var k = (e.key || '').toUpperCase();
    if (k === 'BACKSPACE') { PS.pos = (PS.pos + 9) % 10; e.preventDefault(); return; }
    if (k.length !== 1) return;
    var ch = k === '0' ? 'Q' : k === '1' ? 'L' : k === 'O' ? 'Q' : k === 'I' ? 'L' : k, idx = L.ALPHA.indexOf(ch);
    if (idx < 0) return;
    e.stopImmediatePropagation();   // иначе WASD/L/T/M/P сработали бы как действия движка
    PS.chars[PS.pos] = idx; PS.pos = Math.min(9, PS.pos + 1); e.preventDefault();
  }, true);

  // ---------- Игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) { newGame(pending); pending = null; } },
    press: function (a) {
      if (a === 'pause') { this.pause(); return; }
      var S = game && game.state(); if (!S) return;
      if ((a === 'start' || a === 'action') && S.phase === 'cont') game.cont();
      else if (a === 'start' && S.phase === 'shop') shopSelect(0);
    },
    update: function (dt) {
      if (!game) return;
      var S = game.state();
      for (var pi = 0; pi < 2; pi++) {
        var P = g.input.player(pi), on = pi < nP(), mx = 0, my = 0, fire = false;
        if (on) {
          mx = (P.pressed('right') ? 1 : 0) - (P.pressed('left') ? 1 : 0); my = (P.pressed('down') ? 1 : 0) - (P.pressed('up') ? 1 : 0);
          fire = P.pressed('fire') || (pi === 0 && touchAct.fire);
          if (S.phase === 'shop') { mx = my = 0; fire = false; }
        }
        game.setMove(pi, mx, my); game.setFire(pi, fire);
      }
      game.update(Math.min(dt, 0.05));
      if (shakeT > 0) shakeT -= dt;
      flash.forEach(function (f) { if (f.t > 0) f.t -= dt; });
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) { if (game) PV.ui.render(this, ctx, game.state(), pal(), { toasts: toasts, shake: shakeT > 0 ? 6 * Math.min(1, shakeT * 3) : 0, game: game, flash: flash }); else this.clear(); }
  });

  g.start('title');
  PV.app = { g: g, game: function () { return game; }, newGame: newGame, demo: function () { return demo; }, touch: touchAct };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
