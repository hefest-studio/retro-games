/* ЩЁЛК · сборка: фреймворк Гефест Arcade (engine.js) + логика (levels.js, game.js) + рендер обеих тем + звук + площадка.
   Сцены title/pause/win/gameover — g.useStandardScreens (титул и финалы перерисованы); свои пункты меню: «Продолжить»
   (сохранение в начале этажа), «Пароль» (сцена pwd), в паузе — «Этаж заново». Сцена play: этажи, «Продолжить?»; сцена card —
   «этаж запущен» перед межстраничной (только когда площадка готова её показать).
   Ввод: ←→/AD — ход; Пробел/Z/K — прыжок; X/J — щелчок фаз; ↑↓ — лестница, ↓ — присед; геймпад: A — прыжок, B — щелчок (раскладка движка);
   тач (площадки): виртуальный стик (js/stick.js: ←→ ход, ↑↓ лестница/присед) + ● прыжок + ✦ щелчок + II пауза.
   Миграция игроков сайта: механика сменилась — прежний рекорд сохраняется как «прежний рекорд», новый начинается с нуля, сохранение стирается. */
(function (global) {
  'use strict';
  var T = global.TSEP, L = T.logic, R = T.R, FX = T.fx;
  // ---------- миграция (до createGame: движок читает рекорд при создании) ----------
  var mig = { migrated: false, oldBest: 0, notice: false };
  try {
    mig = T.migrate({ get: function (k) { return localStorage.getItem(k); }, set: function (k, v) { localStorage.setItem(k, v); }, del: function (k) { localStorage.removeItem(k); } });
  } catch (e) {}
  var TH = Arcade.themes || {}, Store = Arcade.Store, SAVE = 'arcade.save.tsep';
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0b1416', panel: '#142024', ink: '#eef4f2', muted: '#94a8a6', accent: '#f0a93c', good: '#7fe0b0', bad: '#ff6a55', warn: '#ffd36a', grid: '#22343a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#f8c838', muted: '#a8a8a8', ink: '#ffffff', good: '#58f8a8', bad: '#f85838', warn: '#f8d878' })
  };
  var LB = 'tsep';
  var g = Arcade.createGame({ canvas: '#c', width: R.W, height: R.H, gameId: 'tsep', leaderboard: LB, strings: T.STR, theme: 'modern', lives: L.K.LIVES, themes: themes });
  T.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);

  var game = null, ui = { toasts: [], banner: null, msg: null, shake: 0, contT: 0 }, playSince = 0, keys = { flick: false, jump: false }, padBtn = { flick: false }, latch = false;   // latch — короткий тап не теряется между кадрами
  var floorStart = null, pendingStart = null, tut = '';
  var stick = global.ArcadeStick.create(pad && pad.querySelector('[data-stick]'));
  function S() { return game.state(); }
  function th() { return g.th(); }
  function sync() { if (!game) return; var s = S(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = s.fi + 1; }
  function toast(text, color, x, y, big) { ui.toasts.push({ text: text, color: color, x: x, y: y, t: big ? 1.8 : 1.1, big: !!big }); if (ui.toasts.length > 10) ui.toasts.shift(); }
  function msg(text, color, dur) { ui.msg = { text: text, color: color, a: dur || 1.6 }; }
  function loadSave() { try { var o = JSON.parse(Store.get(SAVE, 'null')); return o && o.v === 2 && o.fi >= 0 && o.fi <= 5 ? o : null; } catch (e) { return null; } }
  function writeSave(o) { Store.set(SAVE, JSON.stringify(Object.assign({ v: 2 }, o))); }
  function clearSave() { try { localStorage.removeItem(SAVE); } catch (e) {} }
  function clearNotice() { if (mig.notice) { mig.notice = false; try { localStorage.removeItem('arcade.tsep.notice'); } catch (e) {} } }

  // ---------- Площадка (движок v2.8–2.10): лидерборд «tsep», «Без рекламы» (no_ads) в меню и паузе, реклама за награду ----------
  // Консоль: Яндекс — лидерборд с техническим именем «tsep», GamePush — числовое поле игрока «tsep» + лидерборд; товар no_ads (постоянный).
  // Список — promo/tsep/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  g.persist('arcade.best.tsep', 'max');   // рекорд — и в облако
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys2) { if (keys2.length) lbBest(); });   // облако слито: рекорд с другого устройства — в таблицу
  // «Ещё один шанс» (раз за партию): с отметки, одна жизнь и 60% здоровья; бонус в паузе — полное здоровье и +1 ступень катушки
  g.useRewardedContinue({ revive: function () { if (game) { game.reviveAd(); sync(); } } });
  g.useRewardedBonus({ key: 'rwHeal', scene: 'pause', label: function () { return g.t('rwHeal'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) game.boost(); } });
  // Меню вмещает пункты площадки («Лидеры», «Без рекламы»): если пунктов больше, чем помещается, шаг сжимается (не меньше 17)
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(17, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  // ---------- подсказки первого этажа (по месту, один раз за заход) ----------
  var TUT = [[5.5, 9.4, 'tutFlick'], [15.5, 20.6, 'tutBridge'], [41.5, 46.5, 'tutStones']];
  function tutorial(s) {
    if (s.fi !== 0 || s.phase !== 'play') return;
    var x = s.hero.x, k = '';
    for (var i = 0; i < TUT.length; i++) if (x >= TUT[i][0] && x <= TUT[i][1]) k = TUT[i][2];
    if (k && k !== tut) msg(g.t(k), th().warn, 2.6);
    tut = k;
  }

  function onEvent(type, d) {
    d = d || {};
    T.sfx(g, type, d);
    var s = game ? S() : null, t = th();
    switch (type) {
      case 'level':
        ui.toasts = []; FX.clear(); g.setMusic(T.MUSIC.stage); tut = '';
        if (s) { floorStart = game.saveData(); writeSave(floorStart); }
        ui.banner = { title: g.t('floor').toUpperCase() + ' ' + (d.fi + 1) + ' · ' + g.t('f_' + d.key), sub: g.t('b_' + T.FLOORS[d.key].boss), code: s ? g.t('pwdIs') + ': ' + L.encode(floorStart) : '', a: 2.8 };
        break;
      case 'bossIntro': g.setMusic(d.final ? T.MUSIC.heart : T.MUSIC.boss); ui.banner = { title: g.t('b_' + d.k), sub: g.t('f_' + s.key), a: 1.6 }; break;
      case 'bossHit': FX.puff(d.x, d.y, '#ffe6a0', 5, 5, 0.25); ui.shake = Math.max(ui.shake, 0.12); break;
      case 'bossDie': FX.puff(d.x, d.y, '#ffd36a', 40, 9, 1.2, true); FX.puff(d.x, d.y, '#ffffff', 16, 5, 0.6); ui.shake = 0.7; toast('+' + d.pts, t.accent, d.x, d.y - 1.5, true); g.stopMusic && g.stopMusic(); break;
      case 'hit': FX.puff(d.x, d.y, '#ffe6a0', 4, 4, 0.2); break;
      case 'kill': FX.puff(d.x, d.y, '#d6b25a', 10, 6, 0.5, true); FX.puff(d.x, d.y, '#9aa6ae', 6, 4, 0.4, true); toast('+' + d.pts, t.ink, d.x, d.y - 0.8); break;
      case 'crush': FX.puff(d.x, d.y, '#f0a93c', 10, 5, 0.4, true); ui.shake = Math.max(ui.shake, 0.15); break;
      case 'flick': FX.puff(d.x, d.y, d.ph === 0 ? '#f0a93c' : '#43c9c4', 12, 6, 0.35); break;
      case 'jam': if (s) toast(g.t('jam'), t.muted, d.x, d.y - 1.2); break;
      case 'clank': FX.puff(d.x, d.y, '#c9d3da', 6, 4, 0.25); break;
      case 'hurt': ui.shake = Math.max(ui.shake, 0.25); FX.puff(d.x, d.y, '#ff8a6a', 8, 5, 0.4, true); break;
      case 'die': ui.shake = 0.4; FX.puff(d.x, d.y - 1, '#5b8fb0', 18, 7, 1.0, true); FX.puff(d.x, d.y - 1, '#ea6a12', 10, 5, 0.8, true); msg(g.t('d_' + d.why, d.why), t.bad, 1.6); break;
      case 'pickup':
        if (d.k === 'coil') break;
        if (d.k === 'core') msg(g.t('coreGot'), t.warn, 2);
        else if (d.k === 'oil') toast('+HP', t.good, d.x, d.y - 1.2);
        else if (d.k === 'token') toast('+500', t.warn, d.x, d.y - 1.2);
        else if (d.k === 'spark' || d.k === 'spark5') FX.puff(d.x, d.y - 0.5, '#ffd36a', 5, 3, 0.3);
        break;
      case 'coil': msg(g.t('coilUp') + ' · ' + d.lvl + '/3', t.warn, 1.8); if (s) FX.puff(s.hero.x, s.hero.y - 1, '#8ee8e4', 16, 6, 0.6); break;
      case 'life': msg(g.t('life'), t.good, 1.4); break;
      case 'checkpoint': toast(g.t('checkpoint'), t.muted, d.x, d.y - 2.6, true); break;
      case 'stomp': ui.shake = Math.max(ui.shake, 0.3); break;
      case 'thud': ui.shake = Math.max(ui.shake, 0.1); break;
      case 'clear':
        ui.banner = { title: g.t('clear'), sub: d.bonus ? '+' + d.bonus + ' ' + g.t('bonus') : '', a: 2.8 }; g.stopMusic && g.stopMusic();
        // естественная пауза: если площадка готова показать межстраничную — карточка «нажмите»; иначе этаж запускается сам
        setTimeout(function () { if (g._sceneName === 'play' && game && S().phase === 'clear' && g.adReady && g.adReady()) g.goto('card'); }, 1400);
        break;
      case 'continueQ': ui.contT = 9; g.stopMusic && g.stopMusic(); break;
      case 'continued': g.setMusic(T.MUSIC.stage); break;
      case 'revived': g.setMusic(T.MUSIC.stage); msg(g.t('life'), t.good, 1.4); break;
      case 'win': sync(); clearSave(); setTimeout(function () { if (g._sceneName === 'play' && game && S().phase === 'won') g.win(); }, 3000); break;
      case 'gameover': sync(); setTimeout(function () { if (g._sceneName === 'play' && game && S().phase === 'over') g.gameover(); }, 900); break;
    }
    sync();
  }
  function newGame(start) {
    clearNotice();
    game = T.Game({ onEvent: onEvent, rng: L.mulberry32((Date.now() & 0xffff) + 1), start: start || null });
    T.current = game; ui.toasts = []; ui.banner = null; ui.msg = null; FX.clear(); tut = '';
    game.start(); sync();
  }

  // ---------- стандартные экраны ----------
  g.useStandardScreens({ lives: L.K.LIVES });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  g.menu.addItem({ key: 'continue', after: 'play', label: function () { var sv = loadSave(); return sv ? g.t('cont') + ' · ' + g.t('floor').toLowerCase() + ' ' + (sv.fi + 1) : g.t('cont') + ' —'; },
    onSelect: function () { var sv = loadSave(); if (!sv) return; pendingStart = sv; g.goto('play'); } });
  g.menu.addItem({ key: 'pwd', after: 'continue', label: function () { return g.t('pwd'); }, onSelect: function () { g.goto('pwd'); } });
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); },
    onSelect: function () { if (floorStart) { pendingStart = floorStart; game = null; g.goto('play'); } } });
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name], baseDraw = sc.draw;
    sc.draw = function (ctx) {
      baseDraw.call(this, ctx);
      var retro = g.themeName === 'retro';
      ctx.save(); ctx.translate(this.W / 2, this.H / 2 - 36); ctx.scale(2, 2);
      R.heroFig(ctx, 0, 0, 1, { t: this.time, flick: name === 'win', hurt: name !== 'win' }, retro);
      ctx.restore();
      if (name === 'win') this.text(this.t('winText'), this.W / 2, this.H / 2 + 50, { size: 11, align: 'center', color: th().ink, weight: 700, maxWidth: this.W - 30 });
    };
  });

  // ---------- титул ----------
  var title = g.scenes.title, menu = g.menu.get('title');
  title.draw = function (ctx) {
    var retro = g.themeName === 'retro', Wc = this.W, Hc = this.H, t = this.time, Pc = th(), P = R.PAL.works, Q = retro ? P.r : P;
    ctx.imageSmoothingEnabled = !retro;
    if (retro) { ctx.fillStyle = Q.sky; ctx.fillRect(0, 0, Wc, Hc); }
    else { var gr = ctx.createLinearGradient(0, 0, 0, Hc); gr.addColorStop(0, P.sky[0]); gr.addColorStop(0.6, P.sky[1]); gr.addColorStop(1, P.sky[2]); ctx.fillStyle = gr; ctx.fillRect(0, 0, Wc, Hc); }
    // неподвижные шестерни завода и циферблат
    ctx.fillStyle = Q.far; R.gear(ctx, Q.far, 70, 70, 60, 12, 0.2, null); R.gear(ctx, Q.far, 150, 170, 38, 10, 0.5, null); R.gear(ctx, Q.far, 460, 220, 70, 14, 0.1, null);
    ctx.strokeStyle = Q.top; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(80, 70, 30, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(80, 70); ctx.lineTo(80, 48); ctx.moveTo(80, 70); ctx.lineTo(96, 76); ctx.stroke();
    // пол
    ctx.fillStyle = Q.body; ctx.fillRect(0, Hc - 50, Wc, 50); ctx.fillStyle = Q.top; ctx.fillRect(0, Hc - 50, Wc, 5); ctx.fillStyle = Q.rim; ctx.fillRect(0, Hc - 50, Wc, 1);
    // наладчик щёлкает: каждые 2 с фаза меняется — блок ТИК растёт, ТАК тает (и наоборот), от героя расходится волна
    var cyc = t % 2, n = Math.floor(t / 2), ph = n % 2, pk = cyc < 0.45 ? cyc / 0.45 : 1, PHc = R.PH;
    ctx.save(); ctx.translate(86, Hc - 50); ctx.scale(2.4, 2.4);
    R.heroFig(ctx, 0, 0, 1, { t: t, flick: cyc < 0.3 }, retro);
    ctx.restore();
    [['a', 0], ['b', 1]].forEach(function (q, i) {
      var K2 = PHc[q[0]], on = ph === q[1], x = 130 + i * 34, y = Hc - 50 - 34, col = retro ? K2.r : K2.m, dk = retro ? K2.rD : K2.mD;
      if (on) { ctx.fillStyle = dk; ctx.fillRect(x, y, 30, 30); ctx.fillStyle = col; ctx.fillRect(x + 2, y + 2, 26, 26); ctx.fillStyle = dk; for (var k = 0; k < 3; k++) ctx.fillRect(x + 7 + k * 7, y + 9, 3, 12); }
      else { ctx.strokeStyle = col; ctx.lineWidth = 2; if (ctx.setLineDash) ctx.setLineDash([5, 5]); ctx.strokeRect(x + 2, y + 2, 26, 26); if (ctx.setLineDash) ctx.setLineDash([]); }
    });
    if (cyc < 0.45) { var pc = PHc[ph === 0 ? 'a' : 'b']; ctx.globalAlpha = 1 - pk; ctx.strokeStyle = retro ? pc.r : pc.m; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(92, Hc - 50 - 30, 8 + pk * 60, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    var cx = Wc / 2 + 80;
    this.text(this.t('title'), cx, 56, { size: retro ? 44 : 50, align: 'center', color: Pc.accent, weight: 900, maxWidth: 250 });
    this.text(this.t('subtitle'), cx, 80, { size: retro ? 10 : 12, align: 'center', color: Pc.ink, weight: 700, maxWidth: 300 });
    this.text(this.t('sub2'), cx, 95, { size: retro ? 8 : 9, align: 'center', color: Pc.muted, weight: 600, maxWidth: 300 });
    var mf = menuFit(menu, 114, 20, 106, Hc - 64);
    menu.draw(this, cx, mf[0], mf[1]);
    var foot = this.state.best ? this.t('best') + ': ' + this.state.best : '';
    if (mig.oldBest) foot += (foot ? ' · ' : '') + this.t('oldBest') + ': ' + mig.oldBest;
    if (foot) this.text(foot, cx, Hc - 34, { size: 11, align: 'center', color: Pc.warn, weight: 800, maxWidth: 300 });
    if (mig.notice) this.text(this.t('migrated'), Wc / 2, Hc - 50 - 6 - 24, { size: 10, align: 'center', color: Pc.good, weight: 700, maxWidth: Wc - 30 });
    this.text(this.t('hint'), Wc / 2, Hc - 14, { size: retro ? 8 : 9, align: 'center', color: retro ? '#ffffff' : '#eef4f2', weight: 600, maxWidth: Wc - 20 });
  };

  // ---------- карточка «этаж запущен» (только когда площадка готова показать межстраничную): нажатие → реклама → дальше ----------
  var cardGoing = false;
  function cardGo() { if (cardGoing || g._sceneName !== 'card') return; cardGoing = true; g.adBreak().then(function () { cardGoing = false; if (g._sceneName === 'card') g.goto('play', { resume: true }); }); }
  g.scene('card', {
    enter: function () { cardGoing = false; },
    press: function (a) { if (a === 'action' || a === 'start') cardGo(); else if (a === 'pause') this.goto('play', { resume: true }); },
    draw: function (ctx) {
      var Pc = th(), retro = g.themeName === 'retro';
      if (game && game.state().lv) T.render(g, ctx, game.state(), { toasts: [], banner: null, msg: null, shake: 0 }); else this.clear();
      ctx.fillStyle = retro ? 'rgba(0,0,0,.75)' : 'rgba(6,12,14,.78)'; ctx.fillRect(0, 0, this.W, this.H);
      this.text(this.t('cardClear'), this.W / 2, this.H / 2 - 20, { size: 28, align: 'center', color: Pc.accent, weight: 900, maxWidth: this.W - 40 });
      var s = game && game.state();
      this.text(this.t('floor') + ' ' + (s ? s.fi + 1 + '/6 · ' + this.t('score') + ': ' + s.score : ''), this.W / 2, this.H / 2 + 10, { size: 14, align: 'center', color: Pc.ink, weight: 700, maxWidth: this.W - 40 });
      this.text(this.t('cardNext'), this.W / 2, this.H / 2 + 40, { size: 12, align: 'center', color: Pc.muted, weight: 600, maxWidth: this.W - 40 });
    }
  });
  g.canvas.addEventListener('pointerdown', function (e) { if (g._sceneName === 'card') { e.preventDefault(); cardGo(); } });

  // ---------- ввод пароля ----------
  var pw = { s: [0, 0, 0, 0, 0], i: 0, bad: 0 };
  g.scene('pwd', {
    realtime: true,
    enter: function () { pw.i = 0; pw.bad = 0; },
    update: function (dt) { if (pw.bad > 0) pw.bad -= dt; },
    press: function (a) {
      var n = L.ALPH.length;
      if (a === 'up') pw.s[pw.i] = (pw.s[pw.i] + 1) % n;
      else if (a === 'down') pw.s[pw.i] = (pw.s[pw.i] + n - 1) % n;
      else if (a === 'left') pw.i = (pw.i + 4) % 5;
      else if (a === 'right') pw.i = (pw.i + 1) % 5;
      else if (a === 'action' || a === 'start') {
        var code = pw.s.map(function (k) { return L.ALPH[k]; }).join(''), d = L.decode(code);
        if (d) { pendingStart = { fi: d.fi, coil: d.coil, sparks: d.sparks, score: 0 }; this.goto('play'); }
        else { pw.bad = 1.5; this.audio.beep(160, 0.15, 'sawtooth'); }
        return;
      } else if (a === 'pause') { this.goto('title'); return; }
      this.audio.beep(700, 0.03);
    },
    draw: function (ctx) {
      this.clear(); var Pc = th(), Wc = this.W, retro = g.themeName === 'retro';
      this.text(this.t('pwdTitle'), Wc / 2, 70, { size: 20, align: 'center', color: Pc.accent, weight: 900, maxWidth: Wc - 40 });
      for (var i = 0; i < 5; i++) {
        var x = Wc / 2 - 100 + i * 50, y = 110;
        ctx.strokeStyle = i === pw.i ? Pc.accent : Pc.muted; ctx.lineWidth = i === pw.i ? 2 : 1; ctx.strokeRect(x - 18, y, 36, 44);
        this.text(L.ALPH[pw.s[i]], x, y + 31, { size: 24, align: 'center', color: Pc.ink, weight: 900 });
        if (i === pw.i) { this.text('▲', x, y - 6, { size: 10, align: 'center', color: Pc.accent }); this.text('▼', x, y + 58, { size: 10, align: 'center', color: Pc.accent }); }
      }
      if (pw.bad > 0) this.text(this.t('pwdBad'), Wc / 2, 200, { size: 12, align: 'center', color: Pc.bad, weight: 800 });
      this.text(this.t('pwdHint'), Wc / 2, this.H - 30, { size: retro ? 9 : 10, align: 'center', color: Pc.muted, weight: 600, maxWidth: Wc - 20 });
    }
  });

  // ---------- игровая сцена ----------
  var STEP = 1 / 60;
  function touchDir() {
    if (!stick.active) return null;
    return { x: Math.abs(stick.x) > 0.35 ? Math.sign(stick.x) : 0, up: stick.y < -0.55, down: stick.y > 0.55 };
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
      FX.step(dt);
      if (s.phase === 'cont') { ui.contT -= dt; if (ui.contT <= 0) game.giveUp(); }
      var dir = this.input.dir, live = g.time - playSince > 0.18 && s.phase === 'play', td = touchDir();
      var dx = dir.x, up = dir.y < 0, down = dir.y > 0;
      if (td) { dx = td.x; up = td.up; down = td.down; }
      game.setInput({
        dx: live ? dx : 0, up: live && up, down: live && down,
        jump: live && (this.input.pressed('action') || keys.jump),
        flick: live && (keys.flick || padBtn.flick || latch)
      });
      latch = false;
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n; k++) game.update(STEP);
      tutorial(s);
      sync();
    },
    draw: function (ctx) { if (!game) { this.clear(); return; } T.render(g, ctx, S(), ui); }
  });

  // ---------- доп. клавиши ----------
  var FLK = { KeyX: 1, KeyJ: 1 }, JUMP = { KeyZ: 1, KeyK: 1 }, held = {};
  function recompute() { keys.flick = !!(held.KeyX || held.KeyJ); keys.jump = !!(held.KeyZ || held.KeyK); }
  addEventListener('keydown', function (e) {
    if (FLK[e.code] || JUMP[e.code]) { held[e.code] = true; if (FLK[e.code]) latch = true; recompute(); if (g._sceneName === 'play') e.preventDefault(); }
  });
  addEventListener('keyup', function (e) { if (FLK[e.code] || JUMP[e.code]) { held[e.code] = false; recompute(); } });
  addEventListener('blur', function () { held = {}; recompute(); padBtn.flick = false; });
  function hold(id, on, off) {
    var b = document.getElementById(id); if (!b) return;
    var h1 = function (e) { if (!Arcade.touchOk(e)) return; on(); b.classList.add('on'); }, h0 = function (e) { if (!Arcade.touchOk(e)) return; off(); b.classList.remove('on'); };
    b.addEventListener('touchstart', h1, { passive: false }); b.addEventListener('touchend', h0, { passive: false }); b.addEventListener('touchcancel', h0, { passive: false });
    b.addEventListener('mousedown', h1); b.addEventListener('mouseup', h0); b.addEventListener('mouseleave', function () { if (b.classList.contains('on')) h0(new Event('x')); });
  }
  hold('bFlick', function () { padBtn.flick = true; latch = true; }, function () { padBtn.flick = false; });
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
  T.app = { g: g, game: function () { return game; }, ui: ui, newGame: newGame, mig: mig };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
