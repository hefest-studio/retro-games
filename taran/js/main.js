/* ТАРАН · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + общий рендер с палитрами retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; 1–2 игрока — g.usePlayers (пункт «Игроки», клавиши 1/2, подсказка).
   Свои сцены: play (заезд), results (итоги), garage (покупки между гонками). Пункты меню: режим (чемпионат / заезд на время),
   «Вдвоём» (кооп / дуэль), управление (танк / аркада), трасса заезда на время, новый чемпионат.
   Хранение: чемпионат — arcade.taran.champ1 / champ2 (по числу игроков), рекорды кругов — arcade.taran.laps, настройки — arcade.taran.opts.
   Тач — крестовина [data-d] (движок) и кнопки действий [data-act], только И1. Титул — заезд четырёх соперников под меню. */
(function (global) {
  'use strict';
  var T = global.TARAN, L = T.logic, C = T.champ;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#121216', panel: '#18181e', ink: '#f3eee4', muted: '#a3a9b3', accent: '#ef5b3f', grid: '#2a2a32' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#f86848', muted: '#a8a8a8' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.W, height: L.H, gameId: 'taran', strings: T.STR, theme: 'modern', lives: 1, themes: themes });
  T.g = g; T._lbl = function (h) { return g.t(h ? 'p2' : 'p1'); };
  var pad = document.querySelector('.pad');
  T.ui.init(g);
  function pal() { return g.themeName === 'retro' ? T.classic : T.modern; }

  // ---------- Хранение ----------
  function sget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  var opt = { mode: 'champ', team: 'coop', ctrl: g.input.touchOnly ? 'arcade' : 'tank', track: 0 };
  try { var o0 = JSON.parse(sget('arcade.taran.opts') || 'null'); if (o0) { if (o0.mode === 'time' || o0.mode === 'champ') opt.mode = o0.mode; if (o0.team === 'duel' || o0.team === 'coop') opt.team = o0.team; if (o0.ctrl === 'tank' || o0.ctrl === 'arcade') opt.ctrl = o0.ctrl; if (o0.track >= 0 && o0.track < L.TRACKS.length) opt.track = o0.track | 0; } } catch (e) {}
  function saveOpt() { sset('arcade.taran.opts', JSON.stringify(opt)); }
  var laps = {}; try { laps = JSON.parse(sget('arcade.taran.laps') || '{}') || {}; } catch (e) { laps = {}; }
  function lapRecord(id) { return laps[id] || 0; }
  function champKey(n) { return 'arcade.taran.champ' + (n === 2 ? 2 : 1); }
  function savedChamp(n) { var s = sget(champKey(n)); return s ? C.load(s) : null; }
  var champ = null;
  function saveChamp() { if (champ) sset(champKey(champ.players), champ.done ? null : C.serialize(champ)); }

  g.useStandardScreens({ lives: 1 });
  g.usePlayers({
    bind: L.BIND, actions: ['fire', 'rocket', 'drop', 'nitro'], pad: pad, touch: { L: 'left', R: 'right', U: 'up', D: 'down' },
    hint: { ru: [T.STR.ru.hint1, T.STR.ru.hint2], en: [T.STR.en.hint1, T.STR.en.hint2] }
  });
  g.input.bindDpad(pad);

  // ---------- Тач: кнопки действий (И1) ----------
  var touchAct = {};
  if (pad) pad.querySelectorAll('[data-act]').forEach(function (el) {
    var a = el.getAttribute('data-act');
    var on = function (e) { e.preventDefault(); touchAct[a] = true; }, off = function (e) { e.preventDefault(); touchAct[a] = false; };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
  });

  // ---------- Пункты меню ----------
  var nP = function () { return g.input.playerCount; };
  function playLabel() {
    if (opt.mode === 'time') return g.t('play') + ' · ' + g.t('m_time');
    var sv = savedChamp(nP());
    return sv ? g.t('contChamp') + ' · ' + g.t('lg_' + sv.league) + ', ' + g.t('race') + ' ' + (sv.race + 1) + '/4' : g.t('play');
  }
  g.menu.addItem({ key: 'play', index: 0, label: playLabel, onSelect: startPlay });
  g.menu.addItem({ key: 'mode', after: 'players', label: function () { return g.t('mode') + ': ' + g.t(opt.mode === 'time' ? 'm_time' : 'm_champ'); }, onSelect: function () { opt.mode = opt.mode === 'time' ? 'champ' : 'time'; saveOpt(); } });
  g.menu.addItem({ key: 'ctrl', after: 'mode', label: function () { return g.t('ctrl') + ': ' + g.t(opt.ctrl === 'arcade' ? 'c_arcade' : 'c_tank'); }, onSelect: function () { opt.ctrl = opt.ctrl === 'arcade' ? 'tank' : 'arcade'; saveOpt(); } });
  var extra = {
    team: { key: 'team', label: function () { return g.t('team') + ': ' + g.t(opt.team === 'duel' ? 't_duel' : 't_coop'); }, onSelect: function () { opt.team = opt.team === 'duel' ? 'coop' : 'duel'; saveOpt(); } },
    track: { key: 'track', label: function () { var t = L.TRACKS[opt.track]; return g.t('trackSel') + ': ' + (opt.track + 1) + '. ' + g.t('tr_' + t.id) + ' · ' + (lapRecord(t.id) ? T.ui.fmtT(lapRecord(t.id)) : g.t('noRec')); }, onSelect: function () { opt.track = (opt.track + 1) % L.TRACKS.length; saveOpt(); } },
    newChamp: { key: 'newChamp', label: function () { return g.t('newChamp'); }, onSelect: function () { champ = C.newChamp({ players: nP(), team: opt.team }); saveChamp(); openGarage(); } }
  };
  function syncMenu() {
    var m = g.menu.get('title'); if (!m) return;
    var want = { team: nP() === 2 && opt.mode === 'champ', track: opt.mode === 'time', newChamp: opt.mode === 'champ' && !!savedChamp(nP()) };
    var after = { team: 'mode', track: 'mode', newChamp: 'play' };
    Object.keys(want).forEach(function (k) {
      var has = m.indexOf(k) >= 0;
      if (want[k] && !has) m.add(extra[k], { after: after[k] }); else if (!want[k] && has) m.remove(k);
    });
  }

  // ---------- Запуск ----------
  var raceOpts = null, kind = 'champ', game = null, toasts = [], shakeT = 0, R = null, seed = 1;
  var TT_CFG = { body: 1, up: { armor: 3, tires: 3, engine: 3, weapon: 1 }, rear: 'oil' };
  function startPlay() {
    if (opt.mode === 'time') {
      kind = 'time';
      raceOpts = { track: opt.track, players: nP(), humans: [TT_CFG, TT_CFG], rivals: [], mode: 'time', laps: L.LAPS };
      g.goto('play'); return;
    }
    var sv = savedChamp(nP());
    champ = sv && !sv.done ? sv : C.newChamp({ players: nP(), team: opt.team });
    saveChamp(); openGarage();
  }
  function startRace() { kind = 'champ'; raceOpts = C.raceOpts(champ); g.goto('play'); }

  // ---------- Гараж ----------
  var GS = { champ: null, pi: 0, menu: null, flash: 0, flashText: '', flashOk: false };
  function money(pi) { return champ.money[C.purse(champ, pi)]; }
  function doBuy(pi, item) {
    var p = C.price(champ, pi, item);
    if (p == null) { GS.flash = 1.2; GS.flashOk = false; GS.flashText = g.t('max'); g.audio.beep(180, 0.08); return; }
    if (C.buy(champ, pi, item)) { saveChamp(); GS.flash = 1.2; GS.flashOk = true; GS.flashText = '−' + p; g.audio.beep(988, 0.06, 'square', 0.05); setTimeout(function () { g.audio.beep(1319, 0.08, 'square', 0.05); }, 60); }
    else { GS.flash = 1.2; GS.flashOk = false; GS.flashText = g.t('noMoney') + ' ' + (p - money(pi)); g.audio.beep(160, 0.12, 'square', 0.05); }
  }
  function garageMenu(pi) {
    var items = L.UPG.map(function (u) {
      return { key: u, label: '', onSelect: function () { doBuy(pi, u); },
        info: function () { var p = C.price(champ, pi, u); return { label: g.t('u_' + u), tier: champ.cars[pi].up[u], right: p == null ? g.t('max') : String(p), ok: p == null ? null : money(pi) >= p }; } };
    });
    [1, 2].forEach(function (b) {
      items.push({ key: 'body' + b, label: '', onSelect: function () { doBuy(pi, 'body' + b); },
        info: function () { var p = C.price(champ, pi, 'body' + b), own = champ.cars[pi].body >= b; return { label: g.t('body') + ': ' + g.t('b_' + L.BODIES[b].id), right: own ? g.t('owned') : String(p), ok: own ? null : money(pi) >= p }; } });
    });
    items.push({ key: 'rear', label: '', onSelect: function () { var c = champ.cars[pi]; c.rear = c.rear === 'oil' ? 'mine' : 'oil'; saveChamp(); g.audio.beep(700, 0.04); },
      info: function () { return { label: g.t('rearSel') + ': ' + g.t(champ.cars[pi].rear), right: '⇄' }; } });
    items.push({ key: 'go', label: '', onSelect: function () { if (pi < champ.players - 1) openGarage(pi + 1); else startRace(); },
      info: function () { return { label: pi < champ.players - 1 ? g.t('nextPlayer') : g.t('toRace') }; } });
    items.push({ key: 'quit', label: '', onSelect: function () { g.goto('title'); }, info: function () { return { label: g.t('toMenu') }; } });
    var m = new Arcade.Menu(items); m.sel = items.length - 2; return m;
  }
  function openGarage(pi) { GS.champ = champ; GS.pi = pi || 0; GS.menu = garageMenu(GS.pi); GS.flash = 0; g.scenes.garage._menu = GS.menu; g.state.score = champ.total; g.goto('garage'); }
  g.scene('garage', {
    realtime: true, _menu: null,
    update: function (dt) { if (GS.flash > 0) GS.flash -= dt; },
    draw: function (ctx) { T.ui.garage(this, ctx, pal(), GS); },
    press: function (a) { if (a === 'pause') this.goto('title'); }
  });

  // ---------- Итоги ----------
  var resMenu = new Arcade.Menu([{ key: 'next', label: '', onSelect: resultsNext }]);
  function resultsNext() {
    if (kind === 'time') { g.goto('title'); return; }
    if (R.sum.champion || R.sum.lost) { g.state.score = champ.total; var won = R.sum.champion; champ = null; if (won) g.win(); else g.gameover(); return; }
    openGarage(0);
  }
  g.scene('results', {
    realtime: true, _menu: resMenu,
    draw: function (ctx) { var P = pal(); T.ui.render(this, ctx, game.state(), P, { bare: true }); T.ui.results(this, ctx, game.state(), P, R); resMenu.items[0]._y = L.H - 26 - 18 + 6; }
  });
  function raceOver() {
    var S = game.state(), res = S.results;
    // рекорды кругов
    var newRec = false;
    S.cars.forEach(function (c) { if (c.human >= 0 && c.bestLap && (!laps[S.track.id] || c.bestLap < laps[S.track.id])) { laps[S.track.id] = Math.round(c.bestLap * 100) / 100; newRec = true; } });
    if (newRec) sset('arcade.taran.laps', JSON.stringify(laps));
    if (kind === 'time') { R = { kind: 'time', record: laps[S.track.id] || 0, newRec: newRec }; g.goto('results'); return; }
    R = { kind: 'champ', sum: C.applyRace(champ, res), champ: champ };
    g.state.score = champ.total; g.saveBest(); saveChamp();
    g.goto('results');
  }

  // ---------- События заезда ----------
  function toast(text, color, big, x, y) { toasts.push({ text: text, color: color, big: big, t: 1.6, life: 1.6, x: x, y: y }); if (toasts.length > 6) toasts.shift(); }
  function scr(S, x, y) { return { x: x - S.cam.x + L.VIEW.w / 2, y: y - S.cam.y + L.VIEW.h / 2 + L.HUD }; }
  function onEvent(type, d) {
    if (!game) return;
    var S = game.state(), P = pal(), near = d.x == null || Math.hypot(d.x - S.cam.x, d.y - S.cam.y) < 420;
    T.sfx(g, type, d, near);
    var car = d.car != null ? S.cars[d.car] : null, p = d.x != null ? scr(S, d.x, d.y) : null, sz = P.pixel ? 4 : 3;
    if (type === 'boom' && near) { g.particles.spawn(p.x, p.y, { color: P.boom[1], count: 18, speed: 150, life: 0.5, size: sz }); shakeT = Math.max(shakeT, 0.18); }
    else if (type === 'wreck' && near) { g.particles.spawn(p.x, p.y, { color: P.flame[2], count: 30, speed: 170, life: 0.8, size: sz }); shakeT = Math.max(shakeT, 0.3); }
    else if (type === 'hit' && near) g.particles.spawn(p.x, p.y, { color: P.rivet, count: 3, speed: 70, life: 0.25, size: 2 });
    else if (type === 'ram' && near && d.power > 3) { g.particles.spawn(p.x, p.y, { color: P.warn, count: 8, speed: 110, life: 0.3, size: 2 }); if (S.cars[d.a].human >= 0 || S.cars[d.b].human >= 0) shakeT = Math.max(shakeT, 0.15); }
    else if (type === 'press' && near) { shakeT = Math.max(shakeT, 0.3); }
    else if (type === 'pit' && near) g.particles.spawn(p.x, p.y, { color: P.good, count: 2, speed: 40, life: 0.4, size: 2 });
    if (type === 'lap' && d.human >= 0 && !S.cars[d.car].finished) {
      if (d.lap === S.laps - 1) toast(g.t('lastLap'), P.warn, true);
      if (d.best && d.lap > 1) toast(T._lbl(d.human) + ': ' + T.ui.fmtT(d.time) + ' · ' + g.t('bestLap'), P.muted, false, null, L.HUD + 60);
    }
    if (type === 'finish' && d.human >= 0) toast(T._lbl(d.human) + ' · ' + g.t('finish') + ' · ' + d.place + ' ' + g.t('place'), d.place <= 3 ? P.good : P.ink, true);
    if (type === 'wreck') {
      if (car && car.human >= 0) toast(T._lbl(car.human) + ' · ' + g.t('wrecked'), P.bad, true);
      else if (d.by >= 0 && S.cars[d.by].human >= 0 && S.mode !== 'time') toast('+' + L.KILL_BONUS + ' ' + g.t('kill'), P.good, false, p.x, p.y - 20);
    }
    if (type === 'cut') toast(T._lbl(d.human) + ' · ' + g.t('cut'), P.bad, true);
    if (type === 'repaired' && car && car.human >= 0) toast(T._lbl(car.human) + ' · ' + g.t('repaired'), P.good, false, null, L.HUD + 80);
  }
  function newRace() {
    seed = (seed * 16807 + Math.floor(Math.random() * 1000)) % 2147483647 || 7;
    game = T.Game(Object.assign({}, raceOpts, { control: opt.ctrl, rng: L.mulberry32(seed), onEvent: onEvent })).start();
    T.app.game = game; toasts = []; shakeT = 0; T.render.clearFx(); g.particles.list = [];
  }

  // ---------- Титул: заезд четырёх соперников под меню ----------
  var demo = null;
  function newDemo() { demo = T.Game({ track: Math.floor(Math.random() * L.TRACKS.length), players: 0, humans: [], demo: true, countT: 0.01, rng: L.mulberry32(Math.floor(Math.random() * 1e6)) }).start(); }
  newDemo();
  var title = g.scenes.title, menu = title._menu, demoT = 0;
  title.enter = function () { this.audio.beep(520, 0.08); if (demoT > 40) { newDemo(); demoT = 0; } };
  title.update = function (dt) { demoT += dt; demo.update(Math.min(dt, 0.05)); syncMenu(); };
  title.draw = function (ctx) {
    var th = this.th(), P = pal(), W = this.W, H = this.H;
    T.ui.render(this, ctx, demo.state(), P, { bare: true });
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.5)' : 'rgba(10,10,14,.5)'; ctx.fillRect(0, 0, W, H);
    var pw = 440, ph = 330, px = (W - pw) / 2, py = 24;
    T.ui.panel(ctx, px, py, pw, ph, P, P.accent);
    T.ui.txt(this, this.t('title'), W / 2, py + 62, { size: 54, align: 'center', color: P.accent, weight: 900 }, P);
    T.ui.txt(this, this.t('subtitle'), W / 2, py + 86, { size: 11, align: 'center', color: th.muted, weight: 600, shadow: false }, P);
    menu.draw(this, W / 2, py + 118, 24);
    if (this.state.best) T.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 10, { size: 12, align: 'center', color: th.muted, weight: 600, shadow: false }, P);
    this.menu._drawHint('title');
  };
  // Финалы — поверх демо-заезда
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {
    baseClear.call(this, c);
    if (this._sceneName === 'win' || this._sceneName === 'gameover') T.ui.render(this, this.ctx, demo.state(), pal(), { bare: true });
  };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- Сцена заезда ----------
  var NAMES = ['left', 'right', 'up', 'down', 'fire', 'rocket', 'drop', 'nitro'];
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newRace(); },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return;
      if (game.state().phase === 'done') { if (!game._over) { game._over = true; raceOver(); } return; }
      game.setControl(opt.ctrl);
      for (var pi = 0; pi < 2; pi++) {
        var P = g.input.player(pi), k = {};
        NAMES.forEach(function (nm) { k[nm] = P.pressed(nm) || (pi === 0 && !!touchAct[nm]); });
        game.setInput(pi, k);
      }
      game.update(Math.min(dt, 0.05));
      if (shakeT > 0) shakeT -= dt;
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
    },
    draw: function (ctx) { if (game) T.ui.render(this, ctx, game.state(), pal(), { toasts: toasts, shake: shakeT > 0 ? 6 * Math.min(1, shakeT * 3) : 0 }); else this.clear(); }
  });

  g.start('title');
  // для отладки/автотестов в браузере
  T.app = { g: g, game: null, newRace: newRace, lapRecord: lapRecord, opt: opt, touchAct: touchAct,
    champ: function () { return champ; }, startChamp: function () { opt.mode = 'champ'; startPlay(); }, startRace: startRace,
    race: function (o) { kind = o && o.time ? 'time' : 'champ'; raceOpts = Object.assign({ track: 0, players: nP() }, o || {}); if (kind === 'champ' && !champ) champ = C.newChamp({ players: nP(), team: opt.team }); g.goto('play'); } };
})(typeof window !== 'undefined' ? window : globalThis);
