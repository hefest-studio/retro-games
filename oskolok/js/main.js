/* ОСКОЛОК · сборка: фреймворк Гефест Arcade (engine.js) + логика (levels.js, game.js) + рендер обеих тем + звук + площадка.
   Сцены title/pause/win/gameover — g.useStandardScreens (титул и финалы перерисованы); свои пункты меню: «Продолжить» (сохранение в начале зала),
   в паузе — «Зал заново». Сцена play: залы, «Продолжить?»; сцена card — «зал пройден» перед межстраничной (только когда площадка готова её показать).
   Ввод: ←→/AD — ход; Пробел/Z — прыжок; X/J — бросок осколка / обмен; C/K — вернуть осколок; ↑↓ — наклон броска; геймпад: A — прыжок, B — осколок (раскладка движка);
   тач (площадки): стик (←→ ход, ↑↓ наклон) + ● прыжок + ✦ осколок + ↺ вернуть + II пауза.
   Миграция игроков сайта: механика сменилась — прежнее сохранение стирается, прежний рекорд-время сохраняется как «прежний рекорд». */
(function (global) {
  'use strict';
  var O = global.OSKOLOK, L = O.logic, R = O.R, FX = O.fx;
  var mig = { migrated: false, oldBest: 0, notice: false };
  try {
    mig = O.migrate({ get: function (k) { return localStorage.getItem(k); }, set: function (k, v) { localStorage.setItem(k, v); }, del: function (k) { localStorage.removeItem(k); } });
  } catch (e) {}
  var TH = Arcade.themes || {}, Store = Arcade.Store, SAVE = 'arcade.save.oskolok';
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#150e0c', panel: '#241a16', ink: '#f6ece4', muted: '#b09a8c', accent: '#ffb050', good: '#8cf0c0', bad: '#ff6a55', warn: '#ffd36a', grid: '#3a2820' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#f8a828', muted: '#a8a8a8', ink: '#ffffff', good: '#58f8a8', bad: '#f85838', warn: '#f8d878' })
  };
  var LB = 'oskolok';
  var g = Arcade.createGame({ canvas: '#c', width: R.W, height: R.H, gameId: 'oskolok', leaderboard: 'oskolok', strings: O.STR, theme: 'modern', lives: L.K.LIVES, themes: themes });
  O.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);

  var game = null, ui = { toasts: [], banner: null, msg: null, shake: 0, contT: 0, throwT: 0 }, playSince = 0, keys = { shard: false, jump: false, recall: false }, padBtn = { shard: false, recall: false }, latch = false, latchR = false;
  var levelStart = null, pendingStart = null, tut = '';
  var stick = global.ArcadeStick.create(pad && pad.querySelector('[data-stick]'));
  function S() { return game.state(); }
  function th() { return g.th(); }
  function sync() { if (!game) return; var s = S(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = s.fi + 1; }
  function toast(text, color, x, y, big) { ui.toasts.push({ text: text, color: color, x: x, y: y, t: big ? 1.8 : 1.1, big: !!big }); if (ui.toasts.length > 10) ui.toasts.shift(); }
  function msg(text, color, dur) { ui.msg = { text: text, color: color, a: dur || 1.6 }; }
  function loadSave() { try { var o = JSON.parse(Store.get(SAVE, 'null')); return o && o.v === 2 && o.fi >= 0 && o.fi < O.LEVELS.length ? o : null; } catch (e) { return null; } }
  function writeSave(o) { Store.set(SAVE, JSON.stringify(Object.assign({ v: 2 }, o))); }
  function clearSave() { try { localStorage.removeItem(SAVE); } catch (e) {} }
  function clearNotice() { if (mig.notice) { mig.notice = false; try { localStorage.removeItem('arcade.oskolok.notice'); } catch (e) {} } }

  // ---------- Площадка (движок v2.8–2.10): таблица лидеров «oskolok», «Без рекламы» (no_ads), реклама за награду ----------
  // Консоль: Яндекс — лидерборд с техническим именем «oskolok», GamePush — числовое поле игрока «oskolok» + лидерборд; товар no_ads (постоянный).
  // Список — promo/oskolok/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  g.persist('arcade.best.oskolok', 'max');
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });
  // «Ещё один шанс» (раз за партию): с отметки, одна жизнь и 2 сердечка; бонус в паузе — полное здоровье
  g.useRewardedContinue({ revive: function () { if (game) { game.reviveAd(); sync(); } } });
  g.useRewardedBonus({ key: 'rwHeal', scene: 'pause', label: function () { return g.t('rwHeal'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) game.boost(); } });
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(17, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  // ---------- подсказки первого зала (по месту) ----------
  function tutorial(s) {
    if (s.fi !== 0 || s.phase !== 'play') return;
    var x = s.hero.x, k = '', Z = s.def.zones;
    for (var i = 0; i < Z.length; i++) if (x >= Z[i].x0 && x <= Z[i].x1) k = Z[i].k;
    if (s.shard.st === 'plant' && k) k = 'tutSwap';
    if (k && k !== tut) msg(g.t(k), th().warn, 3);
    tut = k;
  }

  function onEvent(type, d) {
    d = d || {};
    O.sfx(g, type, d);
    var s = game ? S() : null, t = th();
    switch (type) {
      case 'level':
        ui.toasts = []; FX.clear(); g.setMusic(O.TRACK); tut = '';
        if (s) { levelStart = game.saveData(); writeSave(levelStart); }
        ui.banner = { title: g.t('level').toUpperCase() + ' ' + (d.fi + 1) + ' · ' + g.t('f_' + d.key), sub: '', a: 2.4 };
        break;
      case 'throw': ui.throwT = 0.2; FX.puff(d.x, d.y, '#9ff3ff', 5, 4, 0.25); break;
      case 'plant': FX.puff(d.x, d.y, '#9ff3ff', 10, 5, 0.4, true); break;
      case 'swap': FX.swap(d); FX.puff(d.x0, d.y0, '#9ff3ff', 14, 6, 0.5); FX.puff(d.x1, d.y1, '#ffffff', 12, 5, 0.4); break;
      case 'fizzle': msg(g.t('fizzle'), t.bad, 1.2); FX.puff(d.x, d.y, '#6a7a80', 8, 4, 0.4, true); break;
      case 'kill': FX.puff(d.x, d.y - 0.6, '#ffb050', 12, 6, 0.5, true); FX.puff(d.x, d.y - 0.6, '#3a3330', 6, 4, 0.4, true); toast('+' + d.pts, t.ink, d.x, d.y - 1.2); break;
      case 'hurt': ui.shake = Math.max(ui.shake, 0.25); FX.puff(d.x, d.y, '#ff8a6a', 8, 5, 0.4, true); break;
      case 'respawnSafe': msg(g.t('d_' + (d.why || 'spike')), t.muted, 0.01); break;
      case 'die': ui.shake = 0.4; FX.puff(d.x, d.y - 1, '#e9b98f', 16, 7, 1.0, true); FX.puff(d.x, d.y - 1, '#34408a', 10, 5, 0.8, true); msg(g.t('d_' + d.why, d.why), t.bad, 1.6); break;
      case 'pickup': if (d.k === 'heart') toast('+♥', t.good, d.x, d.y - 0.8); else FX.puff(d.x, d.y, '#ffd070', 5, 3, 0.3); break;
      case 'life': msg(g.t('life'), t.good, 1.4); break;
      case 'checkpoint': toast(g.t('checkpoint'), t.muted, d.x, d.y - 2.6, true); FX.puff(d.x, d.y - 1, '#ffd36a', 8, 4, 0.5); break;
      case 'clear':
        ui.banner = { title: g.t('clear'), sub: d.bonus ? '+' + d.bonus + ' ' + g.t('bonus') : '', a: 2.6 }; g.stopMusic && g.stopMusic();
        setTimeout(function () { if (g._sceneName === 'play' && game && S().phase === 'clear' && g.adReady && g.adReady()) g.goto('card'); }, 1400);
        break;
      case 'continueQ': ui.contT = 9; g.stopMusic && g.stopMusic(); break;
      case 'continued': case 'revived': g.setMusic(O.TRACK); if (type === 'revived') msg(g.t('life'), t.good, 1.4); break;
      case 'win': sync(); clearSave(); setTimeout(function () { if (g._sceneName === 'play' && game && S().phase === 'won') g.win(); }, 3000); break;
      case 'gameover': sync(); setTimeout(function () { if (g._sceneName === 'play' && game && S().phase === 'over') g.gameover(); }, 900); break;
    }
    sync();
  }
  O.TRACK = Arcade.tracks && Arcade.tracks.oskolok;
  function newGame(start) {
    clearNotice();
    game = O.Game({ onEvent: onEvent, rng: L.mulberry32((Date.now() & 0xffff) + 1), start: start || null });
    O.current = game; ui.toasts = []; ui.banner = null; ui.msg = null; FX.clear(); tut = '';
    game.start(); sync();
  }

  // ---------- стандартные экраны ----------
  g.useStandardScreens({ lives: L.K.LIVES });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  g.menu.addItem({ key: 'continue', after: 'play', label: function () { var sv = loadSave(); return sv ? g.t('cont') + ' · ' + g.t('level').toLowerCase() + ' ' + (sv.fi + 1) : g.t('cont') + ' —'; },
    onSelect: function () { var sv = loadSave(); if (!sv) return; pendingStart = sv; g.goto('play'); } });
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); },
    onSelect: function () { if (levelStart) { pendingStart = levelStart; game = null; g.goto('play'); } } });
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name], baseDraw = sc.draw;
    sc.draw = function (ctx) {
      baseDraw.call(this, ctx);
      var retro = g.themeName === 'retro';
      ctx.save(); ctx.translate(this.W / 2, this.H / 2 - 12); ctx.scale(2, 2);
      R.heroFig(ctx, 0, 0, 1, { t: this.time, hasShard: true, air: name === 'win' }, retro);
      ctx.restore();
      if (name === 'win') this.text(this.t('winText'), this.W / 2, this.H / 2 + 50, { size: 11, align: 'center', color: th().ink, weight: 700, maxWidth: this.W - 30 });
    };
  });

  // ---------- титул ----------
  var title = g.scenes.title, menu = g.menu.get('title');
  title.draw = function (ctx) {
    var retro = g.themeName === 'retro', Wc = this.W, Hc = this.H, t = this.time, Pc = th(), P = R.PAL.yard, Q = retro ? P.r : P;
    ctx.imageSmoothingEnabled = !retro;
    if (retro) { ctx.fillStyle = Q.sky; ctx.fillRect(0, 0, Wc, Hc); }
    else { var gr = ctx.createLinearGradient(0, 0, 0, Hc); gr.addColorStop(0, P.sky[0]); gr.addColorStop(0.6, P.sky[1]); gr.addColorStop(1, P.sky[2]); ctx.fillStyle = gr; ctx.fillRect(0, 0, Wc, Hc); }
    // дальние арки с горнами
    ctx.fillStyle = Q.far; [[20, 120], [110, 80], [330, 130], [440, 90]].forEach(function (a, i) { ctx.fillRect(a[0], Hc - 50 - a[1], 52, a[1]); ctx.beginPath(); ctx.arc(a[0] + 26, Hc - 50 - a[1], 26, Math.PI, 0); ctx.fill(); ctx.fillStyle = Q.win; ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 3 + i); ctx.fillRect(a[0] + 20, Hc - 50 - a[1] + 10, 12, 18); ctx.globalAlpha = 1; ctx.fillStyle = Q.far; });
    ctx.fillStyle = Q.body; ctx.fillRect(0, Hc - 50, Wc, 50); ctx.fillStyle = Q.top; ctx.fillRect(0, Hc - 50, Wc, 5); ctx.fillStyle = Q.rim; ctx.fillRect(0, Hc - 50, Wc, 1);
    // герой бросает осколок и обменивается: цикл 3 с
    var cyc = t % 3, ax = 70, bx = 200, yy = Hc - 50, hx = cyc < 1.6 ? ax : bx, k = cyc < 0.5 ? cyc / 0.5 : 1;
    ctx.save(); ctx.translate(hx, yy); ctx.scale(2.4, 2.4);
    R.heroFig(ctx, 0, 0, 1, { t: t, hasShard: cyc < 0.15 || cyc > 2.2, throwT: cyc < 0.4 ? 1 : 0 }, retro);
    ctx.restore();
    if (cyc >= 0.1 && cyc < 1.6) { var sx2 = cyc < 0.6 ? ax + 14 + (bx - ax - 14) * ((cyc - 0.1) / 0.5) : bx, sy2 = yy - 30 - Math.sin(Math.min(1, (cyc - 0.1) / 0.5) * Math.PI) * 40 + (cyc >= 0.6 ? 30 : 0); if (cyc >= 0.6) sy2 = yy - 8; R.shardFig(ctx, sx2, sy2, cyc < 0.6 ? t * 20 : -0.2, retro, 1); }
    if (cyc >= 1.6 && cyc < 2.0) { ctx.globalAlpha = 1 - (cyc - 1.6) / 0.4; ctx.strokeStyle = retro ? '#58f8f8' : '#b8faff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, yy - 20, 6 + (cyc - 1.6) * 60, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    var cx = Wc / 2 + 80;
    this.text(this.t('title'), cx, 56, { size: retro ? 40 : 46, align: 'center', color: Pc.accent, weight: 900, maxWidth: 250 });
    this.text(this.t('subtitle'), cx, 80, { size: retro ? 10 : 11, align: 'center', color: Pc.ink, weight: 700, maxWidth: 300 });
    this.text(this.t('sub2'), cx, 95, { size: retro ? 8 : 9, align: 'center', color: Pc.muted, weight: 600, maxWidth: 300 });
    var mf = menuFit(menu, 114, 20, 106, Hc - 64);
    menu.draw(this, cx, mf[0], mf[1]);
    var foot = this.state.best ? this.t('best') + ': ' + this.state.best : '';
    if (mig.oldBest) foot += (foot ? ' · ' : '') + this.t('oldBest') + ': ' + Math.floor(mig.oldBest / 60) + ':' + ('0' + (mig.oldBest % 60)).slice(-2);
    if (foot) this.text(foot, cx, Hc - 34, { size: 11, align: 'center', color: Pc.warn, weight: 800, maxWidth: 300 });
    if (mig.notice) this.text(this.t('migrated'), Wc / 2, Hc - 50 - 6 - 24, { size: 10, align: 'center', color: Pc.good, weight: 700, maxWidth: Wc - 30 });
    this.text(this.t('hint'), Wc / 2, Hc - 14, { size: retro ? 8 : 9, align: 'center', color: '#f6ece4', weight: 600, maxWidth: Wc - 20 });
  };

  // ---------- карточка «зал пройден» (только когда площадка готова показать межстраничную) ----------
  var cardGoing = false;
  function cardGo() { if (cardGoing || g._sceneName !== 'card') return; cardGoing = true; g.adBreak().then(function () { cardGoing = false; if (g._sceneName === 'card') g.goto('play', { resume: true }); }); }
  g.scene('card', {
    enter: function () { cardGoing = false; },
    press: function (a) { if (a === 'action' || a === 'start') cardGo(); else if (a === 'pause') this.goto('play', { resume: true }); },
    draw: function (ctx) {
      var Pc = th(), retro = g.themeName === 'retro';
      if (game && game.state().lv) O.render(g, ctx, game.state(), { toasts: [], banner: null, msg: null, shake: 0 }); else this.clear();
      ctx.fillStyle = retro ? 'rgba(0,0,0,.75)' : 'rgba(14,8,6,.78)'; ctx.fillRect(0, 0, this.W, this.H);
      this.text(this.t('cardClear'), this.W / 2, this.H / 2 - 20, { size: 28, align: 'center', color: Pc.accent, weight: 900, maxWidth: this.W - 40 });
      var s = game && game.state();
      this.text(this.t('level') + ' ' + (s ? s.fi + 1 + '/' + O.LEVELS.length + ' · ' + this.t('score') + ': ' + s.score : ''), this.W / 2, this.H / 2 + 10, { size: 14, align: 'center', color: Pc.ink, weight: 700, maxWidth: this.W - 40 });
      this.text(this.t('cardNext'), this.W / 2, this.H / 2 + 40, { size: 12, align: 'center', color: Pc.muted, weight: 600, maxWidth: this.W - 40 });
    }
  });
  g.canvas.addEventListener('pointerdown', function (e) { if (g._sceneName === 'card') { e.preventDefault(); cardGo(); } });

  // ---------- игровая сцена ----------
  var STEP = 1 / 60;
  function touchDir() {
    if (!stick.active) return null;
    return { x: Math.abs(stick.x) > 0.35 ? Math.sign(stick.x) : 0, y: stick.y < -0.55 ? -1 : stick.y > 0.55 ? 1 : 0 };
  }
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) { newGame(pendingStart); pendingStart = null; } playSince = g.time; },
    press: function (a) {
      if (!game) return;
      var s = S();
      if (s.phase === 'cont') {
        if (a === 'action' || a === 'start') { game.continueGame(); playSince = g.time; }
        else if (a === 'pause') game.giveUp();
        return;
      }
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
      if (ui.throwT > 0) ui.throwT -= dt;
      FX.step(dt); FX.stepSwap(dt);
      if (s.phase === 'cont') { ui.contT -= dt; if (ui.contT <= 0) game.giveUp(); }
      var dir = this.input.dir, live = g.time - playSince > 0.18 && s.phase === 'play', td = touchDir();
      var dx = dir.x, dy = dir.y;
      if (td) { dx = td.x; dy = td.y; }
      var act = live && (keys.shard || padBtn.shard || latch), rec = live && (keys.recall || padBtn.recall || latchR);
      game.setInput({ dx: live ? dx : 0, dy: live ? dy : 0, jump: live && (this.input.pressed('action') || keys.jump), act: act, recall: rec });
      latch = false; latchR = false;
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n; k++) game.update(STEP);
      tutorial(s);
      sync();
    },
    draw: function (ctx) { if (!game) { this.clear(); return; } O.render(g, ctx, S(), ui); }
  });

  // ---------- доп. клавиши ----------
  var SHK = { KeyX: 1, KeyJ: 1 }, JUMP = { KeyZ: 1 }, REC = { KeyC: 1, KeyK: 1 }, held = {};
  function recompute() { keys.shard = !!(held.KeyX || held.KeyJ); keys.jump = !!held.KeyZ; keys.recall = !!(held.KeyC || held.KeyK); }
  addEventListener('keydown', function (e) {
    if (SHK[e.code] || JUMP[e.code] || REC[e.code]) { held[e.code] = true; if (SHK[e.code]) latch = true; if (REC[e.code]) latchR = true; recompute(); if (g._sceneName === 'play') e.preventDefault(); }
  });
  addEventListener('keyup', function (e) { if (SHK[e.code] || JUMP[e.code] || REC[e.code]) { held[e.code] = false; recompute(); } });
  addEventListener('blur', function () { held = {}; recompute(); padBtn.shard = false; padBtn.recall = false; });
  function hold(id, on, off) {
    var b = document.getElementById(id); if (!b) return;
    var h1 = function (e) { if (!Arcade.touchOk(e)) return; on(); b.classList.add('on'); }, h0 = function (e) { if (!Arcade.touchOk(e)) return; off(); b.classList.remove('on'); };
    b.addEventListener('touchstart', h1, { passive: false }); b.addEventListener('touchend', h0, { passive: false }); b.addEventListener('touchcancel', h0, { passive: false });
    b.addEventListener('mousedown', h1); b.addEventListener('mouseup', h0); b.addEventListener('mouseleave', function () { if (b.classList.contains('on')) h0(new Event('x')); });
  }
  hold('bShard', function () { padBtn.shard = true; latch = true; }, function () { padBtn.shard = false; });
  hold('bRecall', function () { padBtn.recall = true; latchR = true; }, function () { padBtn.recall = false; });
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
      var f = document.getElementById('foot'); if (f) f.innerHTML = g.t('foot');
    }
    if (g.themeName !== lastTheme) { lastTheme = g.themeName; document.body.setAttribute('data-theme', lastTheme); }
    requestAnimationFrame(domSync);
  }
  addEventListener('resize', fit); fit(); domSync();

  g.start('title');
  O.app = { g: g, game: function () { return game; }, ui: ui, newGame: newGame, mig: mig };
})(typeof window !== 'undefined' ? window : globalThis);
