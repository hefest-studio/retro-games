/* ВОЛОК · сборка игры на фреймворке Гефест Arcade v2: сцены, ввод (клавиши, тач-кнопки, тап по месту
   в избе), сохранение пути по чекпоинтам, музыка по участкам, связь логики (game.js) с рендером. */
(function (global) {
  'use strict';
  var V = global.VOLOK, L = V.logic, RD = V.render;
  var W = 960, H = 540, SAVE = 'volok.save';

  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'volok', strings: V.STR, theme: 'modern' });
  V.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);
  g.fit(980); addEventListener('resize', function () { g.fit(980); });

  // ---------- Сохранение ----------
  function loadSave() { try { var s = localStorage.getItem(SAVE); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function writeSave(sn) { try { localStorage.setItem(SAVE, JSON.stringify(sn)); } catch (e) {} }
  function clearSave() { try { localStorage.removeItem(SAVE); } catch (e) {} }
  // отладка/скриншоты: #at=<x> — начать с точки пути (препятствия до неё считаются пройденными)
  function debugSnap() {
    var m = /[#&?]at=(\d+)/.exec(location.hash + location.search); if (!m) return null;
    var x = +m[1], sn = { mx: x, water: x > L.SHORE_X, prog: { barrier: 0, rubble: 0, floatsWood: 0, floats: 0, launch: 0 }, solved: {}, breaks: {}, taken: {}, bunker: ['wood', 'coal', 'wood', 'wood'], F: 70, P: 70 };
    L.OB.forEach(function (o) { if (o.x < x - 10) { sn.solved[o.id] = 1; if (o.need) sn.prog[o.id] = o.need; } });
    if (sn.water) { sn.prog.floatsWood = 2; sn.prog.floats = 100; sn.prog.launch = 100; }
    L.BREAKS.forEach(function (b, i) { if (b < x) sn.breaks[i] = 1; });
    return sn;
  }

  var game = null, banner = null, bannerT = 0, flash = 0;
  function music(sec) { var T = Arcade.volokTracks; if (T && T[sec]) g.audio.setMusic(T[sec]); }
  function onEvent(type, d) {
    V.sfx(g, type, d);
    if (type === 'checkpoint') { writeSave(d.save); banner = 'cp'; bannerT = 1.6; }
    if (type === 'section') music(d.sec);
    if (type === 'finale') { music(6); banner = 'fin'; bannerT = 7; }
    if (type === 'wreck') { flash = 1; banner = 'wreck'; bannerT = 2.2; }
    if (type === 'win') { clearSave(); sync(); g.win(); }
  }
  function sync() { if (!game) return; var s = game.state(); g.state.score = Math.round(s.score + s.mx / 100); g.state.level = s.sec + 1; }
  function newGame(snap) {
    game = V.Game({ onEvent: onEvent, snapshot: snap || null }).start(); V.current = game;
    var s = game.state(); s._piles = game.piles; RD.resetCam(); music(s.sec); sync();
    if (!snap) writeSave(s.cp);
  }

  // ---------- Стандартные экраны + свой титул с живым фоном ----------
  g.useStandardScreens({ get subtitle() { return g.t('subtitle'); }, lives: 0 });
  g.menu.addItem({ key: 'cont', label: function () { var s = loadSave(); return g.t('cont') + (s ? ' · ' + (L.secOf(s.mx) + 1) + '/6' : ''); },
    onSelect: function () { V._resume = loadSave(); this.goto('play'); }, before: 'play' });
  var title = g.scenes.title, menu = title._menu;
  function refreshMenu() {
    var has = !!loadSave(), items = g.menu.items('title');
    if (has && items.indexOf('cont') < 0) g.menu.addItem({ key: 'cont', label: function () { var s = loadSave(); return g.t('cont') + (s ? ' · ' + (L.secOf(s.mx) + 1) + '/6' : ''); }, onSelect: function () { V._resume = loadSave(); this.goto('play'); }, before: 'play' });
    if (!has && items.indexOf('cont') >= 0) g.menu.removeItem('cont');
    var m = g.menu.get('title'); if (m) m.sel = 0;
  }
  var oldEnter = title.enter;
  title.enter = function (d) { if (oldEnter) oldEnter.call(this, d); refreshMenu(); };
  // «Новый путь» (play) начинает заново; «Продолжить» ставит V._resume
  var demo = V.Game({ snapshot: { mx: 33200, water: true, prog: { floatsWood: 2, floats: 100, launch: 100, barrier: 100, rubble: 140 }, solved: { barrier: 1, hill: 1, rubble: 1, ford: 1, shore: 1 }, breaks: { 0: 1, 1: 1, 2: 1 }, F: 80, P: 70, bunker: ['wood', 'wood', 'coal'] } }).start();
  (function () { var s = demo.state(); s._piles = demo.piles; s.mode = 1; s.sailUp = true; s.hero.x = 180; s.hero.lv = 0; })();
  title.update = function (dt) { var s = demo.state(); s.F = 80; s.P = 70; s.mode = 1; s.sailUp = true; if (s.mx > 35200) { s.mx = 33200; RD.resetCam(); } demo.update(dt); };
  title.draw = function (ctx) {
    var th = this.th(), retro = this.themeName === 'retro', s = demo.state();
    RD.draw(ctx, s, g, { title: true, dt: 1 / 60 });
    ctx.fillStyle = retro ? 'rgba(0,0,0,.55)' : 'rgba(18,14,10,.45)'; ctx.fillRect(0, 0, W, H);
    var pw = 440, ph = 300, px = (W - pw) / 2, py = 96;
    if (retro) { ctx.fillStyle = '#100c08'; ctx.fillRect(px, py, pw, ph); ctx.fillStyle = '#d87838'; ctx.fillRect(px, py, pw, 4); ctx.fillRect(px, py + ph - 4, pw, 4); ctx.fillRect(px, py, 4, ph); ctx.fillRect(px + pw - 4, py, 4, ph); }
    else { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 30; ctx.fillStyle = 'rgba(30,22,16,.88)'; ctx.beginPath(); rr(ctx, px, py, pw, ph, 18); ctx.fill(); ctx.restore(); ctx.strokeStyle = '#7c3f1c'; ctx.lineWidth = 1.5; ctx.beginPath(); rr(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, 18); ctx.stroke(); }
    this.text(this.t('title'), W / 2, py + 64, { size: 50, align: 'center', color: retro ? '#f8a040' : '#f0a04b', weight: 900 });
    this.text(this.t('subtitle'), W / 2, py + 96, { size: 14, align: 'center', color: th.muted, weight: 600 });
    menu.draw(this, W / 2, py + 140, 30);
    if (this.state.best) this.text(this.t('best') + ': ' + this.state.best, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600 });
    this.text(this.t('hint'), W / 2, H - 14, { size: 12, align: 'center', color: '#e8dcc6', weight: 600 });
  };
  function rr(ctx, x, y, w, h, r) { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // ---------- Игровая сцена ----------
  var ventA = 0, winchA = 0, lastDt = 1 / 60, prevX = 0;
  g.scene('play', {
    realtime: true,
    enter: function (d) {
      if (d && d.resume) return;
      var snap = V._resume || debugSnap(); V._resume = null;
      if (!snap) clearSave();
      newGame(snap);
    },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return; lastDt = dt;
      var inp = this.input, held = inp.pressed('action') || !!inp.codes.KeyE;
      game.setInput(inp.dir.x, inp.dir.y, held);
      game.update(dt);
      var s = game.state();
      s._heroMoving = Math.abs(s.hero.x - prevX) > 0.01 || (s.hero.lad >= 0 && (inp.dir.y || s.hero.auto)); prevX = s.hero.x;
      s._venting = s.hint && s.hint.kind === 'vent' && (held || (s.hero.auto && s.hero.auto.started)); if (s._venting) ventA += dt * 8; s._ventA = ventA;
      var crank = s.hint && s.hint.kind === 'winch' && (held || (s.hero.auto && s.hero.auto.started)) && game.winchTask(); if (crank) winchA += dt * 9; s._winchA = winchA;
      s._winchTask = game.winchTask();
      V.machineSound(g, s, dt);
      bannerT -= dt; flash = Math.max(0, flash - dt);
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      var s = game.state(); RD.draw(ctx, s, g, { game: game, dt: lastDt });
      if (flash > 0) { ctx.fillStyle = 'rgba(240,90,50,' + flash * 0.4 + ')'; ctx.fillRect(0, 0, W, H); }
      if (bannerT > 0 && banner) drawBanner(ctx, s);
    }
  });
  // баннеры-пиктограммы: чекпоинт (флажок), авария (сломанная изба), финал (зимовье)
  function drawBanner(ctx, s) {
    var P = RD.PAL[g.themeName === 'retro' ? 'retro' : 'modern'], a = Math.min(1, bannerT * 2);
    ctx.save(); ctx.globalAlpha = a;
    if (banner === 'cp') { var x = W - 70, y = 96; ctx.fillStyle = P.hud; ctx.fillRect(x - 26, y - 26, 52, 52); ctx.fillStyle = P.woodL; ctx.fillRect(x - 10, y - 18, 3, 36); ctx.fillStyle = P.accent; ctx.beginPath(); ctx.moveTo(x - 7, y - 18); ctx.lineTo(x + 16, y - 10); ctx.lineTo(x - 7, y - 2); ctx.fill(); }
    if (banner === 'wreck') { ctx.fillStyle = P.hud; ctx.fillRect(W / 2 - 60, 110, 120, 70); V.icons.draw(ctx, 'hut', W / 2 - 18, 146, P, s.t, 2.2); ctx.strokeStyle = P.bad; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(W / 2 + 10, 128); ctx.lineTo(W / 2 + 40, 162); ctx.moveTo(W / 2 + 40, 128); ctx.lineTo(W / 2 + 10, 162); ctx.stroke(); }
    if (banner === 'fin') { ctx.globalAlpha = Math.min(1, (7 - bannerT) / 2) * 0.9; V.icons.draw(ctx, 'hut', W / 2, 150, P, s.t, 3); V.icons.draw(ctx, 'flame', W / 2, 108, P, s.t, 1.6); }
    ctx.restore();
  }

  // ---------- Тап по месту в избе: подмастерье идёт туда и делает дело ----------
  var cv = g.canvas;
  function tap(clientX, clientY) {
    if (g._sceneName !== 'play' || !game) return;
    var r = cv.getBoundingClientRect(), px = (clientX - r.left) * W / r.width, py = (clientY - r.top) * H / r.height;
    var loc = RD.toLocal(game.state(), px, py); if (!loc) return;
    var s = game.state(), best = null, bd = 46;
    s.fires.forEach(function (f) { var d = Math.abs(f.x - loc.x); if (f.f === loc.f && d < bd) { bd = d; best = { spot: f }; } });
    s.leaks.forEach(function (l) { var d = Math.abs(l.x - loc.x); if (l.f === loc.f && d < bd) { bd = d; best = { spot: l }; } });
    if (!best) for (var id in L.ST) { var st = L.ST[id], d2 = Math.abs(st.x - loc.x); if (st.f === loc.f && d2 < bd) { bd = d2; best = { id: id }; } }
    if (best && best.id) game.goTo(best.id); else if (best) game.goToSpot(best.spot.f, best.spot.x);
    else game.goToSpot(loc.f, Math.max(L.FB[loc.f][0], Math.min(L.FB[loc.f][1], loc.x)));
  }
  cv.addEventListener('mousedown', function (e) { tap(e.clientX, e.clientY); });
  cv.addEventListener('touchstart', function (e) { if (g._sceneName === 'play') { e.preventDefault(); var t0 = e.changedTouches[0]; tap(t0.clientX, t0.clientY); } }, { passive: false });

  // P / Esc на паузе — продолжить
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // тач-кнопка паузы
  var bp = document.getElementById('bPause');
  if (bp) { var tp = function (e) { e.preventDefault(); if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); }; bp.addEventListener('touchstart', tp, { passive: false }); bp.addEventListener('mousedown', tp); }

  // подпись под канвой — язык
  var lastLang = null;
  function syncDom() { if (lastLang === g.i18n.lang) return; lastLang = g.i18n.lang; var f = document.getElementById('foot'); if (f) f.textContent = g.t('foot') + ' ' + g.t('hint') + '.'; }
  syncDom(); setInterval(syncDom, 250);

  g.start('title');
})(window);
