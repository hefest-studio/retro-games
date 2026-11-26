/* КИСТЕНЬ · сборка: фреймворк Гефест Arcade (engine.js) + логика (levels.js, game.js) + рендер обеих тем + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens (титул и финалы перерисованы). Сцена play: уровни, «Продолжить?»,
   экран конца первого круга, второй круг; сцена card — карточка «путь открыт» (только если площадка готова показать рекламу).
   Ввод: ←→/AD — ход; Пробел/Z/K — прыжок; ↑/W, ↓/S — лестница, ↓ — присед; X/J/Ctrl — цепь (тап — коротко, держи — дальше,
   ↑ — вверх/по диагонали; при полном жаре удержание — вихрь); тач: плавающий стик (js/stick.js: ход, ↑↓ — лестница/присед) + ● прыжок
   + ✦ цепь + II пауза. Площадка (движок v2.8–2.10): лидерборд «dospeh», «Без рекламы», ещё один шанс, бонус «горн на полный жар». */
(function (global) {
  'use strict';
  var D = global.DOSPEH, L = D.logic, R = D.R, FX = D.fx, LB = 'dospeh', TUT = 'arcade.dospeh.tut';
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#120c0e', panel: '#1f1517', ink: '#f4ebe2', muted: '#b09a8c', accent: '#e8913a', good: '#8ad97a', bad: '#ff5a4a', warn: '#ffd34d', grid: '#33242a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ff8800', muted: '#aaaaaa', ink: '#ffffff', good: '#55ff55', bad: '#ff5555', warn: '#ffff55' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: R.W, height: R.H, gameId: 'dospeh', leaderboard: 'dospeh', strings: D.STR, theme: 'modern', lives: L.LIVES, themes: themes });
  D.g = g;
  var padEl = document.querySelector('.pad');
  g.input.bindDpad(padEl);
  var stick = global.ArcadeStick.create(padEl && padEl.querySelector('[data-stick]'));

  var game = null, ui = { toasts: [], banner: null, msg: null, shake: 0, contT: 0 }, playSince = 0, keys = { fire: false, jump: false }, pad = { fire: false }, latch = false, cardShown = false;   // latch — короткий тап не теряется между кадрами
  function S() { return game.state(); }
  function th() { return g.th(); }
  function sync() { if (!game) return; var s = S(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = s.li + 1; }
  function toast(text, color, x, y, big) { ui.toasts.push({ text: text, color: color, x: x, y: y, t: big ? 1.8 : 1.1, big: !!big }); if (ui.toasts.length > 10) ui.toasts.shift(); }
  function msg(text, color, dur) { ui.msg = { text: text, color: color, a: dur || 1.6 }; }
  function tutDone() { try { return localStorage.getItem(TUT) === '1'; } catch (e) { return false; } }
  function markTut() { try { localStorage.setItem(TUT, '1'); } catch (e) {} }

  // ---------- Площадка (движок v2.8–2.10): лидерборд «dospeh», «Без рекламы» (no_ads) в меню и паузе, реклама за награду ----------
  // Консоль: Яндекс — лидерборд с техническим именем «dospeh», GamePush — числовое поле игрока «dospeh» + лидерборд; товар no_ads (постоянный).
  // Список — promo/dospeh/platform.json (приватный arcade-full). На сайте (без площадки) пунктов нет.
  g.persist('arcade.best.dospeh', 'max');   // рекорд — и в облако
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });   // облако слито: рекорд с другого устройства — в таблицу
  // «Ещё один шанс» (раз за партию): с отметки, одна жизнь и жар 2; бонус в паузе — горн на полный жар (раз за партию)
  g.useRewardedContinue({ revive: function () { if (game && game.reviveAd()) { cardShown = false; sync(); } } });
  g.useRewardedBonus({ key: 'rwHeal', scene: 'pause', label: function () { return g.t('rwHeal'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) game.boost(); } });
  // Меню вмещает пункты площадки («Лидеры», «Без рекламы»): если пунктов больше, чем помещается, шаг сжимается (не меньше 17)
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(17, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  function onEvent(type, d) {
    d = d || {};
    D.sfx(g, type, d);
    var s = game ? S() : null, t = th();
    switch (type) {
      case 'level':
        ui.toasts = []; FX.clear(); g.setMusic(D.MUSIC.stage); cardShown = false;
        ui.banner = { title: g.t('lv_' + d.key), sub: (d.loop === 2 ? g.t('loop2') + ' · ' : '') + g.t('b_' + d.key), a: 2.4 };
        break;
      case 'loop2': ui.banner = { title: g.t('loopStart'), sub: g.t('lv_' + s.lv.key), a: 2.6 }; break;
      case 'bossIntro': g.setMusic(D.MUSIC.boss); ui.banner = { title: g.t('b_' + s.lv.key), sub: g.t('lv_' + s.lv.key), a: 1.6 }; break;
      case 'bossHit': FX.puff(d.x, d.y, '#ffe1a8', 4, 5, 0.25); break;
      case 'clink': toast(g.t('clink'), t.muted, d.x, d.y - 1.5); FX.puff(d.x, d.y, '#c8d0d8', 3, 4, 0.2); break;
      case 'bossDie': FX.puff(d.x, d.y, '#ffb35c', 40, 9, 1.2, true); FX.puff(d.x, d.y, '#ffffff', 16, 5, 0.6); ui.shake = 0.6; toast('+' + d.pts, t.accent, d.x, d.y - 1.5, true); break;
      case 'kill': FX.puff(d.x, d.y, d.type === 'kite' ? '#c8d4dc' : '#ff9a4a', 10, 6, 0.5, true); break;
      case 'hit': FX.puff(d.x, d.y, '#ffe1a8', 3, 4, 0.2); break;
      case 'heatDown': ui.shake = Math.max(ui.shake, 0.3); FX.puff(d.x, d.y, '#ff9a3a', 14, 7, 0.8, true); FX.puff(d.x, d.y, '#6a6672', 8, 5, 0.6, true); msg(g.t('heatDown'), t.bad, 1.2); break;
      case 'die': ui.shake = 0.4; FX.puff(d.x, d.y, '#e09a44', 26, 7, 1.0, true); FX.puff(d.x, d.y, '#efe6d2', 10, 4, 0.8, true); msg(g.t('d_' + d.why, ''), t.bad, 1.6); break;
      case 'pickup':
        if (d.k === 'ember') toast(g.t('emberUp'), t.good, d.x, d.y - 1.4, true);
        else if (d.k === 'horn') { msg(g.t('hornUp'), t.warn, 2.4); FX.puff(d.x, d.y, '#ffd24a', 20, 6, 0.8); }
        else if (d.k.indexOf('w:') === 0) toast(g.t('w_' + d.k.slice(2)), t.ink, d.x, d.y - 1.4, true);
        break;
      case 'chest': FX.puff(d.x, d.y - 0.5, '#ffd24a', 10, 5, 0.5); toast('+' + L.PTS.chest, t.accent, d.x, d.y - 1.4); break;
      case 'trap': msg(g.t('trap'), t.bad, 1.2); break;
      case 'charged': if (s) toast(g.t('charged'), t.warn, s.hero.x, s.hero.y - 2.4); break;
      case 'special': ui.shake = Math.max(ui.shake, 0.25); FX.puff(d.x, d.y, '#ffd24a', 24, 9, 0.6); break;
      case 'life': msg(g.t('life'), t.good, 1.4); break;
      case 'checkpoint': toast(g.t('checkpoint'), t.muted, d.x, d.y - 2.4, true); break;
      case 'rise': FX.puff(d.x, d.y - 3, '#ffb04a', 3, 3, 0.4); break;
      case 'hint': msg(g.t(d.k), t.warn, 3.4); if (d.k === 'tutChest') markTut(); break;
      case 'splash': FX.puff(d.x, L.R - 0.4, s && s.lv.liquid === 'lava' ? '#ffb040' : '#c4621e', 8, 5, 0.5, true); break;
      case 'stomp': ui.shake = Math.max(ui.shake, 0.2); break;
      case 'clear':
        cardShown = false;
        if (d.final) { ui.banner = { title: g.t('b_forge'), sub: g.t('clear'), a: 3 }; }
        else ui.banner = { title: g.t('clear'), sub: d.bonus ? '+' + d.bonus + ' ' + g.t('bonus') : '', a: 3 };
        g.stopMusic && g.stopMusic();
        break;
      case 'loopEnd': g.stopMusic && g.stopMusic(); break;
      case 'continueQ': ui.contT = 9; g.stopMusic && g.stopMusic(); break;
      case 'continued': g.setMusic(D.MUSIC.stage); break;
      case 'win': sync(); setTimeout(function () { if (g._sceneName === 'play' && game && S().phase === 'won') g.win(); }, 2400); break;
      case 'gameover': sync(); setTimeout(function () { if (g._sceneName === 'play' && game && S().phase === 'over') g.gameover(); }, 900); break;
    }
    sync();
  }
  function newGame() {
    game = D.Game({ onEvent: onEvent, rng: L.mulberry32((Date.now() & 0xffff) + 1), tutorial: !tutDone() });
    D.current = game; ui.toasts = []; ui.banner = null; ui.msg = null; FX.clear();
    game.start(); sync();
  }

  // ---------- стандартные экраны ----------
  g.useStandardScreens({ lives: L.LIVES });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name], baseDraw = sc.draw;
    sc.draw = function (ctx) {
      baseDraw.call(this, ctx);
      var retro = g.themeName === 'retro';
      ctx.save(); ctx.translate(this.W / 2, this.H / 2 - 40); ctx.scale(2, 2); R.heroFig(ctx, 0, 0, 1, { heat: name === 'win' ? 4 : 1, t: this.time, throwT: name === 'win' ? 1 : 0 }, retro); ctx.restore();
      if (name === 'win') this.text(this.t('winText'), this.W / 2, this.H / 2 + 50, { size: 11, align: 'center', color: th().ink, weight: 700 });
    };
  });

  // ---------- титул ----------
  var title = g.scenes.title, menu = g.menu.get('title');
  title.draw = function (ctx) {
    var retro = g.themeName === 'retro', Wc = this.W, Hc = this.H, t = this.time, Pc = th(), P = R.PAL.wastes;
    ctx.imageSmoothingEnabled = !retro;
    if (retro) { ctx.fillStyle = P.r.sky; ctx.fillRect(0, 0, Wc, Hc); }
    else { var gr = ctx.createLinearGradient(0, 0, 0, Hc); gr.addColorStop(0, P.sky[0]); gr.addColorStop(0.65, P.sky[1]); gr.addColorStop(1, P.sky[2]); ctx.fillStyle = gr; ctx.fillRect(0, 0, Wc, Hc); }
    // кучи окалины и трубы
    ctx.fillStyle = retro ? P.r.far : P.far;
    for (var i = 0; i < 5; i++) { var x = i * 120 - 20; ctx.beginPath(); ctx.moveTo(x, Hc); ctx.lineTo(x + 40, Hc - 110 - (i % 2) * 20); ctx.lineTo(x + 70, Hc - 95); ctx.lineTo(x + 120, Hc); ctx.fill(); if (i % 2) { ctx.fillRect(x + 90, Hc - 170, 9, 120); ctx.fillRect(x + 86, Hc - 176, 17, 7); } }
    ctx.fillStyle = retro ? P.r.body : P.body; ctx.fillRect(0, Hc - 50, Wc, 50);
    ctx.fillStyle = retro ? P.r.top : P.top; ctx.fillRect(0, Hc - 50, Wc, 5);
    // демонстрация: капля шлака падает, кочегар бьёт цепью — окалыш разлетается
    var T = 3.4, k = (t % T) / T, gy = Hc - 50, hx0 = 92, tx = 330, sc = 2.6;
    var swing = k > 0.5 && k < 0.8, len = k < 0.5 ? 0 : k < 0.64 ? (k - 0.5) / 0.14 * (tx - hx0 - 20) : k < 0.8 ? (1 - (k - 0.64) / 0.16) * (tx - hx0 - 20) : 0;
    ctx.save(); ctx.translate(hx0, gy); ctx.scale(sc, sc);
    R.heroFig(ctx, 0, 0, 1, { heat: 4, t: t, throwT: swing ? 1 : 0 }, retro);
    ctx.restore();
    if (k < 0.58) R.foeFig(ctx, k < 0.4 ? { type: 'riser', st: 'rise', t: k / 0.4 * 0.72, face: -1 } : { type: 'riser', st: 'live', t: 1, face: -1 }, tx, gy, t, retro, null);
    else if (k < 0.7) { ctx.fillStyle = retro ? '#ffaa00' : '#ffb04a'; for (var q = 0; q < 8; q++) ctx.fillRect(tx + Math.cos(q * 0.8) * (k - 0.58) * 260, gy - 14 + Math.sin(q * 0.8) * (k - 0.58) * 260, 4, 4); }
    if (len > 0) {
      var cx0 = hx0 + 10, cy0 = gy - 46;
      for (var lk = 0; lk < len; lk += 9) { ctx.fillStyle = (lk / 9) % 2 ? '#b4b8c4' : '#6a6e7a'; ctx.fillRect(cx0 + lk, cy0 - 1, 4, 3); }
      R.weaponFig(ctx, 'ball', cx0 + len, cy0, 2.2, t * 10, retro);
    }
    this.text(this.t('title'), Wc / 2 + 60, 62, { size: retro ? 42 : 48, align: 'center', color: Pc.accent, weight: 900, maxWidth: 270 });
    this.text(this.t('subtitle'), Wc / 2 + 60, 86, { size: retro ? 11 : 13, align: 'center', color: Pc.ink, weight: 700, maxWidth: 300 });
    this.text(this.t('sub2'), Wc / 2 + 60, 103, { size: retro ? 8 : 9, align: 'center', color: Pc.muted, weight: 600, maxWidth: 300 });
    var mf = menuFit(menu, 134, 24, 118, Hc - 70);
    menu.draw(this, Wc / 2 + 60, mf[0], mf[1]);
    if (this.state.best) this.text(this.t('best') + ': ' + this.state.best, Wc / 2 + 60, Hc - 62, { size: 11, align: 'center', color: Pc.warn, weight: 800 });
    this.text(this.t('hint'), Wc / 2, Hc - 14, { size: retro ? 8 : 9, align: 'center', color: retro ? '#ffffff' : '#f4ebe2', weight: 600 });
  };

  // ---------- игровая сцена ----------
  var cardGoing = false;
  function cardGo() { if (cardGoing || g._sceneName !== 'card') return; cardGoing = true; g.adBreak().then(function () { cardGoing = false; if (g._sceneName === 'card') g.goto('play', { resume: true }); }); }
  g.scene('card', {
    enter: function () { cardGoing = false; },
    press: function (a) { if (a === 'action' || a === 'start') cardGo(); else if (a === 'pause') this.goto('play', { resume: true }); },
    draw: function (ctx) {
      var Pc = th(), retro = g.themeName === 'retro';
      if (game && game.state().lv) D.render(g, ctx, game.state(), { toasts: [], banner: null, msg: null, shake: 0 }); else this.clear();
      ctx.fillStyle = retro ? 'rgba(0,0,0,.75)' : 'rgba(10,6,4,.78)'; ctx.fillRect(0, 0, this.W, this.H);
      var s = game && game.state();
      this.text(this.t('clear'), this.W / 2, this.H / 2 - 20, { size: 28, align: 'center', color: Pc.accent, weight: 900, maxWidth: this.W - 40 });
      if (s) this.text(this.t('lv_' + s.lv.key) + ' · ' + (s.li + 1) + '/7 · ' + this.t('score') + ': ' + s.score, this.W / 2, this.H / 2 + 10, { size: 14, align: 'center', color: Pc.ink, weight: 700, maxWidth: this.W - 40 });
      this.text(this.t('tapstart'), this.W / 2, this.H / 2 + 40, { size: 12, align: 'center', color: Pc.muted, weight: 600, maxWidth: this.W - 40 });
    }
  });
  g.canvas.addEventListener('pointerdown', function (e) { if (g._sceneName === 'card') { e.preventDefault(); cardGo(); } });

  var STEP = 1 / 60;
  function touchDir() { if (!stick.active) return null; return { x: Math.abs(stick.x) > 0.35 ? Math.sign(stick.x) : 0, up: stick.y < -0.55, down: stick.y > 0.55 }; }
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; },
    press: function (a) {
      if (!game) return;
      var s = S();
      if (s.phase === 'cont') {
        if (a === 'action' || a === 'start') { game.continueGame(); playSince = g.time; }
        else if (a === 'pause') game.giveUp();
        return;
      }
      if (s.phase === 'loopEnd') { if (a === 'action' || a === 'start') game.skipLoopEnd(); else if (a === 'pause') this.pause(); return; }
      if (a === 'pause') this.pause();
    },
    update: function (dt) {
      if (!game) return;
      var s = S(), i;
      for (i = 0; i < ui.toasts.length; i++) { ui.toasts[i].t -= dt; ui.toasts[i].y -= dt * 0.6; }
      ui.toasts = ui.toasts.filter(function (q) { return q.t > 0; });
      if (ui.banner) { ui.banner.a -= dt; if (ui.banner.a <= 0) ui.banner = null; }
      if (ui.msg) { ui.msg.a -= dt; if (ui.msg.a <= 0) ui.msg = null; }
      if (ui.shake > 0) ui.shake = Math.max(0, ui.shake - dt);
      FX.step(dt);
      if (s.phase === 'cont') { ui.contT -= dt; if (ui.contT <= 0) game.giveUp(); }
      var dir = this.input.dir, live = g.time - playSince > 0.18 && s.phase === 'play', td = touchDir();
      var dx = dir.x, up = dir.y < 0, down = dir.y > 0;
      if (td) { dx = td.x; up = td.up; down = td.down; }
      game.setInput({
        dx: live ? dx : 0, up: live && up, down: live && down,
        jump: live && (this.input.pressed('action') || keys.jump),
        fire: live && (keys.fire || pad.fire || latch)
      });
      latch = false;
      // карточка «путь открыт» — естественная пауза для межстраничной рекламы (только если площадка готова её показать)
      if (s.phase === 'clear' && !s.lv.final && s.phaseT > 2.2 && !cardShown && g.adReady && g.adReady()) { cardShown = true; g.goto('card'); return; }
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n; k++) game.update(STEP);
      sync();
    },
    draw: function (ctx) { if (!game) { this.clear(); return; } D.render(g, ctx, S(), ui); }
  });

  // ---------- доп. клавиши ----------
  var FIRE = { KeyX: 1, KeyJ: 1, ControlLeft: 1, ControlRight: 1 }, JUMP = { KeyZ: 1, KeyK: 1 }, held = {};
  function recompute() { keys.fire = !!(held.KeyX || held.KeyJ || held.ControlLeft || held.ControlRight); keys.jump = !!(held.KeyZ || held.KeyK); }
  addEventListener('keydown', function (e) {
    if (FIRE[e.code] || JUMP[e.code]) { held[e.code] = true; if (FIRE[e.code] && !e.repeat) latch = true; recompute(); if (g._sceneName === 'play') e.preventDefault(); }
  });
  addEventListener('keyup', function (e) { if (FIRE[e.code] || JUMP[e.code]) { held[e.code] = false; recompute(); } });
  addEventListener('blur', function () { held = {}; recompute(); pad.fire = false; });
  // тач-кнопки
  function hold(id, on, off) {
    var b = document.getElementById(id); if (!b) return;
    var h1 = function (e) { if (!Arcade.touchOk(e)) return; on(); b.classList.add('on'); }, h0 = function (e) { if (!Arcade.touchOk(e)) return; off(); b.classList.remove('on'); };
    b.addEventListener('touchstart', h1, { passive: false }); b.addEventListener('touchend', h0, { passive: false }); b.addEventListener('touchcancel', h0, { passive: false });
    b.addEventListener('mousedown', h1); b.addEventListener('mouseup', h0); b.addEventListener('mouseleave', function () { if (b.classList.contains('on')) h0(new Event('x')); });
  }
  hold('bFire', function () { pad.fire = true; latch = true; }, function () { pad.fire = false; });
  var bp = document.getElementById('bPause');
  if (bp) { var hp = function (e) { if (!Arcade.touchOk(e)) return; if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); }; bp.addEventListener('touchstart', hp, { passive: false }); bp.addEventListener('mousedown', hp); }

  // ---------- DOM: подгонка канвы, подписи, тема страницы ----------
  function fit() {
    var c = g.canvas, wrap = c.parentElement, padEl = document.querySelector('.pad');
    var padFixed = padEl && getComputedStyle(padEl).position === 'fixed';
    var padH = padEl && !padFixed && getComputedStyle(padEl).display !== 'none' ? padEl.offsetHeight + 16 : 0;
    var w = Math.min(1100, (wrap && wrap.clientWidth) || g.W, (innerHeight - padH - 64) * g.W / g.H);
    w = Math.max(240, Math.floor(w)); c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
  }
  var lastLang = null, lastTheme = null;
  function domSync() {
    if (g.i18n.lang !== lastLang) {
      lastLang = g.i18n.lang; document.documentElement.lang = lastLang;
      var b = document.getElementById('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = document.getElementById('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
    }
    if (g.themeName !== lastTheme) { lastTheme = g.themeName; document.body.setAttribute('data-theme', lastTheme); }
    requestAnimationFrame(domSync);
  }
  addEventListener('resize', fit); fit(); domSync();

  g.start('title');
  D.app = { g: g, game: function () { return game; }, ui: ui };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
