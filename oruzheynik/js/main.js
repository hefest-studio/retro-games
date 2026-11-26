/* ОТБОЙ (папка oruzheynik) · сборка: фреймворк Гефест Arcade (engine.js) + логика (levels.js, game.js, save.js) + рендер обеих тем + звук + площадка.
   Сцены title/pause/win/gameover — g.useStandardScreens (титул перерисован); свои пункты меню: «Продолжить» (сохранение в начале цеха),
   в паузе — «Цех заново». Сцена play: шесть цехов и Чёрная Домна подряд; сцена card — «цех отвоёван» перед межстраничной
   (только когда площадка готова её показать).
   Ввод: ←→/AD — бег; Пробел/Z/K/↑ — прыжок; X/J/Ctrl — удар молотом (отбивает снаряды); ↓+прыжок или C/Shift — кувырок;
   геймпад: A — прыжок, B — молот, Y — кувырок (раскладка движка);
   тач: плавающий стик (js/stick.js) + ✦ молот + ● прыжок + ⤳ кувырок + II пауза.
   Миграция игроков сайта: механика сменилась — прежний рекорд сохраняется как «прежний рекорд», сохранение стирается (js/save.js). */
(function (global) {
  'use strict';
  var OZ = global.ORUZH, L = OZ.logic, R = OZ.R;
  // ---------- миграция (до createGame: движок читает рекорд при создании) ----------
  var mig = { migrated: false, oldBest: 0, notice: false };
  try {
    mig = OZ.save.migrate({ get: function (k) { return localStorage.getItem(k); }, set: function (k, v) { localStorage.setItem(k, v); }, del: function (k) { localStorage.removeItem(k); } });
  } catch (e) {}
  var TH = Arcade.themes || {}, Store = Arcade.Store, SAVE = OZ.save.KEY, TUT = 'arcade.oruzheynik.tut';
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0e0a08', panel: '#1d140f', ink: '#f6ece2', muted: '#b39a86', accent: '#ff9a3d', good: '#8ad97a', bad: '#ff5a4a', warn: '#ffd34d', grid: '#33241a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffaa00', muted: '#aaaaaa', ink: '#ffffff', good: '#55ff55', bad: '#ff5555', warn: '#ffff55' })
  };
  var LB = 'oruzheynik', W = R.W, H = R.H;
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'oruzheynik', leaderboard: LB, strings: OZ.STR, theme: 'modern', lives: L.LIVES, themes: themes });
  OZ.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);
  var stick = global.ArcadeStick.create(pad && pad.querySelector('[data-stick]'));

  var game = null, ui = { toasts: [], banner: null, msg: null, shake: 0 }, playSince = 0, pendingStart = null, stageStart = null;
  var keys = { hit: false, jump: false, slide: false }, padBtn = { hit: false, slide: false }, latch = false;   // latch — короткий тап не теряется между кадрами
  function S() { return game.state(); }
  function th() { return g.th(); }
  function sync() { if (!game) return; var s = S(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = Math.max(1, s.stage + 1); }
  function toast(text, color, x, y, big) { ui.toasts.push({ text: text, color: color, x: x, y: y, t: big ? 1.8 : 1.1, big: !!big }); if (ui.toasts.length > 10) ui.toasts.shift(); }
  function msg(text, color, dur) { ui.msg = { text: text, color: color, a: dur || 1.6 }; }
  function loadSave() { try { return OZ.save.parse(Store.get(SAVE, 'null')); } catch (e) { return null; } }
  function writeSave(d) { try { Store.set(SAVE, OZ.save.serialize(d)); } catch (e) {} }
  function tutDone() { try { return localStorage.getItem(TUT) === '1'; } catch (e) { return false; } }
  function markTut() { try { localStorage.setItem(TUT, '1'); } catch (e) {} }
  function clearNotice() { if (mig.notice) { mig.notice = false; try { localStorage.removeItem('arcade.oruzheynik.notice'); } catch (e) {} } }
  var FX = OZ.renderFx;

  // ---------- Площадка (движок v2.8–2.10): лидерборд «oruzheynik», «Без рекламы» (no_ads) в меню и паузе, реклама за награду ----------
  // Консоль: Яндекс — лидерборд с техническим именем «oruzheynik», GamePush — числовое поле игрока «oruzheynik» + лидерборд;
  // товар no_ads (постоянный). Список — promo/oruzheynik/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  g.persist('arcade.best.oruzheynik', 'max');   // рекорд — и в облако
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys2) { if (keys2.length) lbBest(); });   // облако слито: рекорд с другого устройства — в таблицу
  // «Ещё один шанс» (раз за партию): с отметки, одна жизнь и 60% здоровья; бонус в паузе — полное здоровье и жар 2 (раз за партию)
  g.useRewardedContinue({ revive: function () { if (game) { game.reviveAd(); sync(); } } });
  g.useRewardedBonus({ key: 'rwHeal', scene: 'pause', label: function () { return g.t('rwHeal'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) game.boost(); } });
  // Меню вмещает пункты площадки («Лидеры», «Без рекламы»): если пунктов больше, чем помещается, шаг сжимается (не меньше 17)
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(17, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  function onEvent(type, d) {
    d = d || {};
    OZ.sfx(g, type, d);
    var s = game ? S() : null, t = th();
    switch (type) {
      case 'stage': {
        ui.toasts = []; FX.clear(); g.setMusic(OZ.MUSIC.stage);
        if (s) { stageStart = game.saveData(); writeSave(stageStart); }
        ui.banner = { title: g.t('stage').toUpperCase() + ' ' + (d.idx + 1) + ' · ' + g.t('s_' + s.lv.boss), sub: g.t('boss') + ': ' + g.t('b_' + s.lv.boss), a: 2.6 };
        break;
      }
      case 'hint': msg(g.t(d.k === 'swing' ? 'tutSwing' : d.k === 'reflect' ? 'tutReflect' : 'tutBoss'), t.warn, 3.2); break;
      case 'bossIntro': g.setMusic(OZ.MUSIC.boss); ui.banner = { title: g.t('b_' + d.key), sub: d.phase2 ? g.t('s_walker') : g.t('s_' + s.lv.boss), a: 1.8 }; break;
      case 'miniIntro': toast(g.t('f_' + d.type), t.warn, s.hero.x + 4, s.hero.y - 3, true); break;
      case 'swing': if (s && d.hot) FX.puff(s.hero.x + s.hero.face * 1.5, s.hero.y - 1.2, '#ffb347', 6, 5, 0.3); break;
      case 'thump': FX.puff(d.x, d.y, '#ffe1a8', 5, 5, 0.25); break;
      case 'reflect':
        FX.puff(d.x, d.y, d.hot ? '#ffb347' : '#ffffff', 10, 6, 0.35); ui.shake = Math.max(ui.shake, 0.1);
        if (s) { toast(g.t('refl'), t.warn, d.x, d.y - 1, true); if (d.heat >= L.MAX_HEAT) msg(g.t('heatFull'), t.accent, 1.8); }
        break;
      case 'bossHit': FX.puff(d.x, d.y, d.ref ? '#ffe9a0' : '#e0e0e0', d.ref ? 14 : 5, 6, 0.4); if (d.ref) ui.shake = Math.max(ui.shake, 0.18); break;
      case 'bossDie': FX.puff(d.x, d.y, '#ffb35c', 40, 9, 1.2, true); FX.puff(d.x, d.y, '#ffffff', 16, 5, 0.6); ui.shake = 0.6; toast('+' + d.pts, t.accent, d.x, d.y - 1.5, true); g.stopMusic && g.stopMusic(); break;
      case 'kill': FX.puff(d.x, d.y, d.mini ? '#ffb35c' : '#c9b49a', d.mini ? 24 : 8, 6, 0.5, true); if (d.mini) toast('+' + d.pts, t.accent, d.x, d.y - 1, true); break;
      case 'hit': FX.puff(d.x, d.y, '#ffe1a8', 3, 4, 0.2); break;
      case 'hurt': ui.shake = Math.max(ui.shake, 0.25); FX.puff(d.x, d.y, '#ff6a4d', 6, 5, 0.3); break;
      case 'die': ui.shake = 0.4; FX.puff(d.x, d.y, '#e09a44', 26, 7, 1.0, true); FX.puff(d.x, d.y, '#d6452c', 8, 4, 0.8, true); msg(g.t('d_' + d.why, ''), t.bad, 1.6); break;
      case 'pickup': if (d.k === 'life') toast(g.t('life'), t.good, d.x, d.y - 1.4, true); break;
      case 'checkpoint': if (s) toast(g.t('checkpoint'), t.muted, s.hero.x, s.hero.y - 2.2); break;
      case 'gateOpen': FX.puff(d.x, d.y, '#ffd34d', 10, 4, 0.5); break;
      case 'stomp': case 'crash': ui.shake = Math.max(ui.shake, 0.2); break;
      case 'revived': g.setMusic(OZ.MUSIC.stage); msg(g.t('life'), t.good, 1.4); break;
      case 'clear':
        if (d.si === 0) markTut();
        ui.banner = { title: g.t('clear'), sub: d.bonus ? '+' + d.bonus + ' ' + g.t('bonus') : '', a: 3 };
        // естественная пауза: если площадка готова показать межстраничную — карточка «нажмите»; иначе цех запускается сам
        setTimeout(function () { if (g._sceneName === 'play' && game && S().phase === 'clear' && g.adReady && g.adReady()) g.goto('card'); }, 1400);
        break;
      case 'win': markTut(); sync(); try { localStorage.removeItem(SAVE); } catch (e) {} setTimeout(function () { if (g._sceneName === 'play' && game && S().won) g.win(); }, 2200); break;
      case 'gameover': sync(); setTimeout(function () { if (g._sceneName === 'play' && game && S().over) g.gameover(); }, 1200); break;
    }
    sync();
  }
  function newGame(start) {
    clearNotice();
    game = OZ.Game({ onEvent: onEvent, rng: L.mulberry32((Date.now() & 0xffff) + 1), start: start || null, tutorial: !tutDone() });
    OZ.current = game; ui.toasts = []; ui.banner = null; ui.msg = null; FX.clear();
    game.start(); sync();
  }

  // ---------- стандартные экраны и меню ----------
  g.useStandardScreens({ lives: L.LIVES });
  g.menu.addItem({ key: 'continue', after: 'play', label: function () { var sv = loadSave(); return sv ? g.t('cont') + ' · ' + g.t('stage').toLowerCase() + ' ' + (sv.si + 1) : g.t('cont') + ' —'; },
    onSelect: function () { var sv = loadSave(); if (!sv) return; pendingStart = sv; g.goto('play'); } });
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); },
    onSelect: function () { if (stageStart) { pendingStart = stageStart; game = null; g.goto('play'); } } });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name], baseDraw = sc.draw;
    sc.draw = function (ctx) {
      baseDraw.call(this, ctx);
      var retro = g.themeName === 'retro', K = R.HERO[retro ? 'r' : 'm'];
      R.heroFig(ctx, this.W / 2, this.H / 2 - 50, 1, { run: 0, air: false, el: name === 'win' ? (this.time % 1) * 0.3 : 0 }, K, retro, this.time);
    };
  });

  // ---------- титул ----------
  var title = g.scenes.title, menu = g.menu.get('title');
  title.draw = function (ctx) {
    var retro = g.themeName === 'retro', Wc = this.W, Hc = this.H, t = this.time, Pc = th();
    ctx.imageSmoothingEnabled = !retro;
    ctx.fillStyle = retro ? '#000000' : '#0e0a08'; ctx.fillRect(0, 0, Wc, Hc);
    if (!retro) { var gr = ctx.createRadialGradient(Wc * 0.22, Hc * 0.7, 10, Wc * 0.22, Hc * 0.7, 300); gr.addColorStop(0, 'rgba(255,140,60,.22)'); gr.addColorStop(1, 'rgba(255,140,60,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, Wc, Hc); }
    R.gearShape(ctx, Wc - 70, 70, 54, 12, t * 0.2, retro ? '#331a00' : '#24190f', retro ? '#000' : '#0e0a08');
    R.gearShape(ctx, Wc - 140, 140, 32, 9, -t * 0.34, retro ? '#331a00' : '#24190f', retro ? '#000' : '#0e0a08');
    ctx.fillStyle = retro ? '#442200' : '#2a1d15'; ctx.fillRect(0, Hc - 64, Wc, 64);
    ctx.fillStyle = retro ? '#884400' : '#4a3424'; ctx.fillRect(0, Hc - 64, Wc, 4);
    // демонстрация отбоя: самопал стреляет — подмастерье бьёт молотом — шарик летит обратно и гасит самопал
    var K = R.HERO[retro ? 'r' : 'm'], T = 3.2, k = (t % T) / T, sx = 100, tx = 330, gy = Hc - 64;
    var swingAt = 0.46, el = k > swingAt ? Math.min(0.5, (k - swingAt) * T) : 0;
    ctx.save(); ctx.translate(sx, gy); ctx.scale(2.2, 2.2);
    R.heroFig(ctx, 0, 0, 1, { run: 0, air: false, el: el < 0.45 ? el : 0, hot: false, heat: 0 }, K, retro, t);
    ctx.restore();
    ctx.fillStyle = retro ? '#555555' : '#4b4247'; ctx.fillRect(tx - 2, gy - 44, 12, 44); ctx.fillRect(tx - 14, gy - 76, 34, 32); ctx.fillStyle = retro ? '#888888' : '#6a5a61'; ctx.fillRect(tx - 30, gy - 67, 20, 10);
    var hitX = sx + 78, bx, back = k > swingAt + 0.04;
    if (!back) bx = tx - 30 - (tx - 30 - hitX) * Math.min(1, k / swingAt); else bx = hitX + (tx - 30 - hitX) * Math.min(1, (k - swingAt - 0.04) / 0.2);
    var by = gy - 62;
    if (k < 0.9) { var bc = back ? (retro ? '#ffffff' : '#ffffff') : (retro ? '#ff5555' : '#ff5a3d'); ctx.fillStyle = bc; ctx.beginPath(); ctx.arc(bx, by, back ? 7 : 5, 0, Math.PI * 2); ctx.fill(); if (back) { ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2); ctx.fill(); } }
    if (k > 0.72 && k < 0.85) { ctx.fillStyle = '#ffe9a0'; for (var q = 0; q < 6; q++) ctx.fillRect(tx - 30 + Math.cos(q * 1.05 + t * 9) * (k - 0.72) * 140, gy - 40 + Math.sin(q * 1.05) * (k - 0.72) * 140, 5, 5); }
    var cx = Wc / 2 + 90;
    this.text(this.t('title'), cx, 64, { size: retro ? 42 : 48, align: 'center', color: Pc.accent, weight: 900, maxWidth: 250 });
    this.text(this.t('subtitle'), cx, 88, { size: retro ? 11 : 12, align: 'center', color: Pc.ink, weight: 700, maxWidth: 300 });
    this.text(this.t('sub2'), cx, 104, { size: retro ? 8 : 9, align: 'center', color: Pc.muted, weight: 600, maxWidth: 320 });
    var mf = menuFit(menu, 128, 22, 118, Hc - 70);
    menu.draw(this, cx, mf[0], mf[1]);
    var foot = this.state.best ? this.t('best') + ': ' + this.state.best : '';
    if (mig.oldBest) foot += (foot ? ' · ' : '') + this.t('oldBest') + ': ' + mig.oldBest;
    if (foot) this.text(foot, cx, Hc - 38, { size: 11, align: 'center', color: Pc.warn, weight: 800, maxWidth: 320 });
    if (mig.notice) this.text(this.t('migrated'), Wc / 2, Hc - 54, { size: 10, align: 'center', color: Pc.good, weight: 700, maxWidth: Wc - 30 });
    this.text(this.t('hint'), Wc / 2, Hc - 14, { size: retro ? 9 : 10, align: 'center', color: Pc.muted, weight: 600, maxWidth: Wc - 20 });
  };

  // ---------- карточка «цех отвоёван» (только когда площадка готова показать межстраничную): нажатие → реклама → дальше ----------
  var cardGoing = false;
  function cardGo() { if (cardGoing || g._sceneName !== 'card') return; cardGoing = true; g.adBreak().then(function () { cardGoing = false; if (g._sceneName === 'card') g.goto('play', { resume: true }); }); }
  g.scene('card', {
    enter: function () { cardGoing = false; },
    press: function (a) { if (a === 'action' || a === 'start') cardGo(); else if (a === 'pause') this.goto('play', { resume: true }); },
    draw: function (ctx) {
      var Pc = th(), retro = g.themeName === 'retro';
      if (game && game.state().lv) OZ.render(g, ctx, game.state(), { toasts: [], banner: null, msg: null, shake: 0 }); else this.clear();
      ctx.fillStyle = retro ? 'rgba(0,0,0,.75)' : 'rgba(10,6,4,.78)'; ctx.fillRect(0, 0, this.W, this.H);
      this.text(this.t('cardClear'), this.W / 2, this.H / 2 - 20, { size: 28, align: 'center', color: Pc.accent, weight: 900, maxWidth: this.W - 40 });
      var s = game && game.state();
      this.text(this.t('stage') + ' ' + (s ? s.stage + 1 + '/' + OZ.STAGES.length + ' · ' + this.t('score') + ': ' + s.score : ''), this.W / 2, this.H / 2 + 10, { size: 14, align: 'center', color: Pc.ink, weight: 700, maxWidth: this.W - 40 });
      this.text(this.t('cardNext'), this.W / 2, this.H / 2 + 40, { size: 12, align: 'center', color: Pc.muted, weight: 600, maxWidth: this.W - 40 });
    }
  });
  g.canvas.addEventListener('pointerdown', function (e) { if (g._sceneName === 'card') { e.preventDefault(); cardGo(); } });

  // ---------- игровая сцена ----------
  var STEP = 1 / 60;
  function touchDir() { if (!stick.active) return null; return { x: Math.abs(stick.x) > 0.35 ? Math.sign(stick.x) : 0, down: stick.y > 0.55 }; }
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) { newGame(pendingStart); pendingStart = null; } playSince = g.time; },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return;
      var s = S(), i;
      for (i = 0; i < ui.toasts.length; i++) { ui.toasts[i].t -= dt; ui.toasts[i].y -= dt * 0.6; }
      ui.toasts = ui.toasts.filter(function (q) { return q.t > 0; });
      if (ui.banner) { ui.banner.a -= dt; if (ui.banner.a <= 0) ui.banner = null; }
      if (ui.msg) { ui.msg.a -= dt; if (ui.msg.a <= 0) ui.msg = null; }
      if (ui.shake > 0) ui.shake = Math.max(0, ui.shake - dt);
      FX.step(dt);
      var dir = this.input.dir, live = g.time - playSince > 0.18 && s.phase === 'stage', td = touchDir();
      var dx = dir.x, down = dir.y > 0, up = dir.y < 0;
      if (td) { dx = td.x; down = td.down; up = false; }
      game.setInput({
        dx: live ? dx : 0, down: live && down,
        jump: live && (this.input.pressed('action') || up || keys.jump),
        hit: live && (keys.hit || padBtn.hit || latch),
        slide: live && (keys.slide || padBtn.slide)
      });
      latch = false;
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n; k++) game.update(STEP);
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      OZ.render(g, ctx, S(), { toasts: ui.toasts, banner: ui.banner, msg: ui.msg, shake: ui.shake > 0 ? 10 * ui.shake / 0.4 : 0 });
    }
  });

  // ---------- доп. клавиши ----------
  var HIT = { KeyX: 1, KeyJ: 1, ControlLeft: 1, ControlRight: 1 }, JUMP = { KeyZ: 1, KeyK: 1 }, SLIDE = { KeyC: 1, ShiftLeft: 1, ShiftRight: 1 }, held = {};
  function recompute() {
    keys.hit = !!(held.KeyX || held.KeyJ || held.ControlLeft || held.ControlRight);
    keys.jump = !!(held.KeyZ || held.KeyK); keys.slide = !!(held.KeyC || held.ShiftLeft || held.ShiftRight);
  }
  addEventListener('keydown', function (e) {
    if (HIT[e.code] || JUMP[e.code] || SLIDE[e.code]) { held[e.code] = true; if (HIT[e.code] && !e.repeat) latch = true; recompute(); if (g._sceneName === 'play') e.preventDefault(); }
  });
  addEventListener('keyup', function (e) { if (HIT[e.code] || JUMP[e.code] || SLIDE[e.code]) { held[e.code] = false; recompute(); } });
  addEventListener('blur', function () { held = {}; recompute(); padBtn.hit = padBtn.slide = false; });
  // тач-кнопки
  function hold(id, on, off) {
    var b = document.getElementById(id); if (!b) return;
    var h1 = function (e) { if (!Arcade.touchOk(e)) return; on(); b.classList.add('on'); }, h0 = function (e) { if (!Arcade.touchOk(e)) return; off(); b.classList.remove('on'); };
    b.addEventListener('touchstart', h1, { passive: false }); b.addEventListener('touchend', h0, { passive: false }); b.addEventListener('touchcancel', h0, { passive: false });
    b.addEventListener('mousedown', h1); b.addEventListener('mouseup', h0); b.addEventListener('mouseleave', function () { if (b.classList.contains('on')) h0(new Event('x')); });
  }
  hold('bHit', function () { padBtn.hit = true; latch = true; }, function () { padBtn.hit = false; });
  hold('bSlide', function () { padBtn.slide = true; }, function () { padBtn.slide = false; });
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
  OZ.app = { g: g, game: function () { return game; }, ui: ui, newGame: newGame, mig: mig };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
