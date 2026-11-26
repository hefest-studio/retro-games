/* ПОЛУУСТАВ · сборка игры на фреймворке Гефест Arcade v2: сцены, ввод (клавиши, тач-кнопки, свайп-прыжок),
   сохранение по отметкам (localStorage poluustav.save), музыка и звук среды по страницам, связь логики с рендером.
   Отладка/скриншоты: #z=<страница 0..6>&cp=<отметка> — начать с нужного места (как «Продолжить»).
   Издания вне сайта (необязательно): POLU.Edition — хуки обёртки (Steam-издание кладёт свой js/edition.js в ПРИВАТНОЙ сборке):
   storage (сохранения), quit («Выход»), fullscreen (окно ↔ полный экран), lang(языки) (язык по умолчанию), strings (доп. строки),
   padStyle (подписи геймпада), release (без отладочного старта). На сайте объекта нет — всё как раньше. */
(function (global) {
  'use strict';
  var P = global.POLU, RD = P.render;
  var W = 960, H = 540, SAVE = 'poluustav.save';
  var E = P.Edition || {}, LS = E.storage || null, BEST = 'arcade.best.poluustav';
  if (E.strings) Object.keys(E.strings).forEach(function (l) { if (P.STR[l]) Object.keys(E.strings[l]).forEach(function (k) { P.STR[l][k] = E.strings[l][k]; }); });
  if (LS) { var b0 = parseFloat(LS.getItem(BEST)) || 0; if (b0 > Arcade.Store.getNum(BEST, 0)) Arcade.Store.set(BEST, String(b0)); }   // рекорд из файла — до createGame
  var THEMES = {
    modern: { bg: '#efe3c6', panel: '#e5d4ae', ink: '#3b2817', muted: '#7a6346', accent: '#b4442b', good: '#4f6b2e', bad: '#b4442b', warn: '#b4442b', grid: '#d9c7a0', font: 'Georgia, "Times New Roman", serif', pixel: false, glow: false, radius: 6 },
    retro: { bg: '#f4efe1', panel: '#d8d0bc', ink: '#120e0a', muted: '#4a4038', accent: '#120e0a', good: '#120e0a', bad: '#120e0a', warn: '#120e0a', grid: '#d8d0bc', font: '"Courier New", ui-monospace, monospace', pixel: true, glow: false, radius: 0 }
  };
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'poluustav', strings: P.STR, theme: 'modern', themes: THEMES, lang: E.lang ? E.lang(Object.keys(P.STR)) : undefined });
  if (E.padStyle) g.gamepad.configure({ style: E.padStyle });
  P.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);

  // ---------- сохранение ----------
  // хранилище: на сайте — localStorage (+ облако площадки через g.storeSet); в издании с обёрткой — E.storage (файлы, Steam Cloud)
  var sGet = LS ? function (k, d) { var v = LS.getItem(k); return v == null ? d : v; } : function (k, d) { return Arcade.Store.get(k, d); };
  var sSet = LS ? function (k, v) { LS.setItem(k, String(v)); } : function (k, v) { g.storeSet(k, v); };
  var sNum = function (k, d) { var v = sGet(k, null); return v == null ? d : (parseFloat(v) || d); };
  function loadSave() { try { var s = LS ? LS.getItem(SAVE) : localStorage.getItem(SAVE); var o = s ? JSON.parse(s) : null; return o && P.LEVELS[o.z] ? o : null; } catch (e) { return null; } }
  function writeSave(o) { sSet(SAVE, JSON.stringify(o)); }   // localStorage сразу + облако площадки
  function clearSave() { if (LS) { LS.removeItem(SAVE); return; } try { localStorage.removeItem(SAVE); } catch (e) {} if (g.platform) g.storeSet(SAVE, ''); }
  // ---------- облако и мета-прогрессия: выбор страницы, звёзды (js/meta.js) ----------
  var Store = Arcade.Store, M = P.meta, REACHED = 'arcade.poluustav.reached', START_KEY = 'arcade.poluustav.start';
  var prog = M.Progress({ get: function (k) { return sGet(k, null); }, set: function (k, v) { sSet(k, v); } });
  g.persist(SAVE, 'last'); g.persist(REACHED, 'max'); g.persist(START_KEY, 'last'); g.persist('arcade.best.poluustav', 'max');
  for (var lv = 1; lv <= M.LEVELS; lv++) g.persist(M.key(lv), 'max');
  function reached() { return Math.min(M.LEVELS, Math.max(sNum(REACHED, 1), prog.maxUnlocked())); }
  function startLv() { var v = parseInt(sGet(START_KEY, '1'), 10) || 1; return v >= 1 && v <= reached() ? v : 1; }
  function nextStart(dir) { var m = reached(), n = startLv() + (dir || 1); if (n > m) n = 1; if (n < 1) n = m; sSet(START_KEY, n); }
  var pg = { z: -1, base: 0, skip: false, turned: false, startZ: 0 };   // текущая страница: кляксы на входе, перелистнута ли за рекламу
  function recordPage(z, S) { var r = M.stars({ blots: S.deaths - pg.base, skipped: pg.skip }); if (r.n && prog.record(z + 1, r.n)) pg.note = { text: M.starStr(r.n) + '  ' + g.t('starNew'), t: 2.4 }; else if (r.n) pg.note = { text: M.starStr(r.n), t: 1.8 }; }
  function debugStart() {
    if (E.release) return null;
    var m = /[#&?]z=(\d+)/.exec(location.hash + location.search); if (!m) return null;
    var z = Math.min(P.LEVELS.length - 1, +m[1]), c = /[#&?]cp=(\d+)/.exec(location.hash + location.search), cp = c ? Math.min(P.LEVELS[z].cps.length - 1, +c[1]) : 0;
    return { z: z, cp: cp, snap: null };
  }

  // ---------- игра ----------
  var game = null, blot = null, walk = 0, tj = 0, touch = { jump: false, act: false };
  function music(z) { var T = Arcade.poluTracks; if (T && T[z]) g.audio.setMusic(T[z]); }
  function onEvent(type, d) {
    P.sfx(g, type, d);
    var S = game && game.state();
    if (type === 'checkpoint' && S) { var sv = game.saveData(); sv.deaths = S.deaths; sv.played = S.played; writeSave(sv); }
    if (type === 'death') blot = { x: d.x, y: d.y, t: 0, seed: (Math.random() * 1e6) | 0 };
    if (type === 'page') { pg.skip = !!d.skip; pg.turned = true; }
    if (type === 'zone') { music(d.z); if (S) S._enterT = 1; RD.cam.z = -1;
      if (S && d.z !== pg.z) {
        if (pg.z >= 0 && d.z === pg.z + 1) recordPage(pg.z, S);
        if (pg.turned && d.z > pg.startZ) g.adBreak();   // межстраничная — на перелистывании (игрок сам дошёл до края страницы); частоту режет адаптер
        pg.z = d.z; pg.base = S.deaths; pg.skip = false; pg.turned = false;
        if (d.z + 1 > sNum(REACHED, 1)) sSet(REACHED, d.z + 1);
      } }
    if (type === 'win') {
      if (S) recordPage(S.z, S);
      clearSave(); var s2 = game.state();
      g.state.score = Math.max(100, Math.round(7000 - s2.deaths * 40 - s2.played / 2)); g.state.level = 7;
      setTimeout(function () { if (g._sceneName === 'play') g.win(); if (LS) LS.setItem(BEST, String(g.state.best)); }, 1600); music(7);
    }
  }
  function newGame(save) {
    game = P.Game({ onEvent: onEvent, save: save || null }); P.current = game; game.start();
    var S = game.state(); if (save) { S.deaths = save.deaths || 0; S.played = save.played || 0; }
    RD.cam.z = -1; blot = null; S._enterT = 1;
    pg = { z: S.z, base: S.deaths, skip: false, turned: false, startZ: S.z };
    g.state.score = 0; g.state.level = S.z + 1;
  }

  // ---------- стандартные экраны: меню «Продолжить», пауза «К последней отметке» ----------
  g.useStandardScreens({ get subtitle() { return g.t('subtitle'); }, lives: 0 });
  function contItem() { return { key: 'cont', label: function () { var s = loadSave(); return g.t('cont') + (s ? ' · ' + (s.z + 1) + '/7' : ''); }, onSelect: function () { P._resume = loadSave(); this.goto('play'); }, before: 'play' }; }
  function refreshMenu() {
    var has = !!loadSave(), items = g.menu.items('title');
    if (has && items.indexOf('cont') < 0) g.menu.addItem(contItem());
    if (!has && items.indexOf('cont') >= 0) g.menu.removeItem('cont');
    var m = g.menu.get('title'); if (m) m.sel = 0;
  }
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); }, onSelect: function () { if (game) game.restartCp(); this.goto('play', { resume: true }); } });
  // пункт «Страница N ★★☆» — с какой страницы начинать «Новую рукопись»: выбор/тап — следующая открытая, ← → — по кругу
  g.menu.addItem({ key: 'page', after: 'play', label: function () { var n = startLv(); return g.t('pagePick') + ' ' + n + '/7  ' + M.starStr(prog.get(n)); }, onSelect: function () { nextStart(1); } });
  // Реклама за награду (только площадки с рекламой): бонус в паузе — перелистнуть страницу без решения (раз за партию; звёзд за неё нет).
  // Поражения в игре нет (клякса — сразу у отметки), поэтому «ещё один шанс» движка здесь не появляется сам — экран нужен только для единого API.
  g.useRewardedContinue({ revive: function () { if (game) game.restartCp(); } });
  g.useRewardedBonus({ key: 'rwSkip', scene: 'pause', label: function () { return g.t('rwSkip'); },
    available: function () { return !!game && game.canSkip(); }, grant: function () { if (game) game.skipPage(); } });
  // издание с обёрткой: «Во весь экран: вкл/выкл» и «Выход» (в меню и паузе); прогресс уже в файлах — по отметкам
  if (E.fullscreen) g.menu.addItem({ key: 'fullscreen', after: 'sound', label: function () { return g.t('fullscreen') + ': ' + (E.fullscreen.on() ? g.t('on') : g.t('off')); }, onSelect: function () { E.fullscreen.toggle(); } });
  if (E.quit) {
    g.menu.addItem({ key: 'quit', label: function () { return g.t('quit'); }, onSelect: function () { E.quit(); } });
    g.menu.addItem({ key: 'quit', scene: 'pause', label: function () { return g.t('quit'); }, onSelect: function () { E.quit(); } });
  }
  // подсказка внизу: при геймпаде (только если издание дало строку hint_pad) — значками кнопок
  function hintText() {
    if (!(E.strings && g.padActive && g.padActive())) return g.t('hint');
    return g.t('hint_pad', g.t('hint')).replace(/\{(\w+)\}/g, function (m, n) { return g.gamepad.glyph(n, 0); });
  }
  var title = g.scenes.title, menu = title._menu, oldEnter = title.enter;
  title.press = function (a) { var it = menu && menu.current(); if (it && it.key === 'page' && (a === 'left' || a === 'right')) { nextStart(a === 'left' ? -1 : 1); this.audio.beep(600, 0.03); } };
  title.enter = function (d) { if (oldEnter) oldEnter.call(this, d); refreshMenu(); P.stopAmbience(); };
  // живой фон заставки: первая страница, ученик идёт сам
  var demo = P.Game({ zone: 0 }).start(), demoT = 0;
  title.update = function (dt) {
    demoT += dt; var s = demo.state(), h = s.hero;
    var go = h.x < 380 ? 1 : 0; if (h.x > 360 && demoT > 6) { demo.loadZone(0); demoT = 0; }
    demo.setInput({ x: go }); demo.update(dt); walk += Math.abs(h.vx) * dt * 0.09;
  };
  title.draw = function (ctx) {
    var th = this.th(), retro = this.themeName === 'retro', pal = RD.PAL[retro ? 'retro' : 'modern'];
    RD.draw(ctx, demo.state(), g, { game: demo, dt: 1 / 60, walk: walk, overlay: function (c) {
      // 6+ пунктов («Продолжить», пункты издания) — лист выше и шаг меню меньше: пункты не наезжают на подсказку звёзд
      var nIt = menu ? menu.items.length : 5, pw = 470, ph = 300 + Math.max(0, nIt - 5) * 24, px = (W - pw) / 2, py = 100, step = nIt > 5 ? 26 : 30;
      c.save(); c.globalAlpha = 0.93; c.drawImage(RD.paperTex(retro ? 'retro' : 'modern'), px, py, pw, ph, px, py, pw, ph); c.restore();
      RD.pen(c, RD.rectPts(px, py, pw, ph), 1.8, 51, pal.ink, true); RD.pen(c, RD.rectPts(px + 6, py + 6, pw - 12, ph - 12), 0.8, 52, pal.soft, true);
      // буквица-заставка: киноварный квадрат с завитком (без буквы)
      c.fillStyle = pal.verm; c.fillRect(px + 22, py + 22, 34, 34); RD.pen(c, RD.rectPts(px + 22, py + 22, 34, 34), 1.4, 53, pal.ink, true);
      var sw = []; for (var k = 0; k < 24; k++) { var a = k / 24 * Math.PI * 3; sw.push([px + 39 + Math.cos(a) * (12 - k * 0.4), py + 39 + Math.sin(a) * (12 - k * 0.4)]); } RD.pen(c, sw, 1.2, 54, retro ? '#ffffff' : pal.paper);
      g.text(g.t('title'), W / 2 + 16, py + 62, { size: 46, align: 'center', color: pal.ink, weight: 700, font: th.font });
      g.text(g.t('subtitle'), W / 2, py + 92, { size: 15, align: 'center', color: th.muted, weight: 400, font: th.font });
      menu.draw(g, W / 2, py + 136, step);
      g.text(g.t('starsHint') + ' · ' + prog.total() + '/' + (M.LEVELS * 3) + (g.state.best ? '   ' + g.t('best') + ': ' + g.state.best : ''), W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 30 });
      c.save(); c.globalAlpha = 0.9; c.drawImage(RD.paperTex(retro ? 'retro' : 'modern'), 40, H - 48, W - 80, 28, 40, H - 48, W - 80, 28); c.restore();
      g.text(hintText(), W / 2, H - 29, { size: 12, align: 'center', color: pal.ink, weight: 600, maxWidth: E.strings ? W - 100 : undefined });
    } });
  };

  // ---------- игровая сцена ----------
  var lastDt = 1 / 60;
  g.scene('play', {
    realtime: true,
    enter: function (d) {
      if (d && d.resume) return;
      var sv = P._resume || debugStart(); P._resume = null; g.resetRun();   // «раз за партию» — и для «Продолжить»
      if (!sv) { clearSave(); if (startLv() > 1) sv = { z: startLv() - 1, cp: 0, snap: null }; }
      newGame(sv);
    },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return; lastDt = dt;
      var inp = this.input, c = inp.codes;
      tj = Math.max(0, tj - dt);
      game.setInput({
        x: inp.dir.x, y: inp.dir.y > 0 ? 1 : 0, up: inp.dir.y < 0,
        jump: inp.pressed('action') || !!c.KeyZ || !!c.KeyK || touch.jump || tj > 0,
        act: !!(c.KeyE || c.KeyX || c.KeyJ || c.ShiftLeft || c.ShiftRight || c.KeyF) || touch.act
      });
      game.update(dt);
      var S = game.state(), h = S.hero;
      walk += Math.abs(h.vx) * dt * 0.09;
      if (blot) { blot.t += dt; if (blot.t > 1.2) blot = null; }
      if (S._enterT > 0) S._enterT = Math.max(0, S._enterT - dt * 1.4);
      P.ambience(g, S, dt);
      g.state.level = S.z + 1;
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      RD.draw(ctx, game.state(), g, { game: game, dt: lastDt, walk: walk, blot: blot });
      if (pg.note && pg.note.t > 0) { pg.note.t -= lastDt; var th = this.th(); g.text(pg.note.text, W / 2, 46, { size: 22, align: 'center', color: th.accent, weight: 700, font: th.font, maxWidth: W - 40 }); }
    }
  });
  // пауза: лист бумаги поверх страницы
  g.scenes.pause.draw = function (ctx) {
    var retro = this.themeName === 'retro', pal = RD.PAL[retro ? 'retro' : 'modern'], th = this.th(), pm = g.menu.get('pause');
    if (game) RD.draw(ctx, game.state(), g, { game: game, dt: 0, walk: walk, overlay: function (c) {
      c.fillStyle = retro ? 'rgba(0,0,0,0.35)' : 'rgba(40,25,10,0.35)'; c.fillRect(0, 0, W, H);
      var nIt = pm ? pm.items.length : 4, pw = 360, ph = 256 + Math.max(0, nIt - 4) * 30, px = (W - pw) / 2, py = (H - ph) / 2;   // 5+ пунктов — лист выше
      c.drawImage(RD.paperTex(retro ? 'retro' : 'modern'), px, py, pw, ph, px, py, pw, ph); RD.pen(c, RD.rectPts(px, py, pw, ph), 1.8, 61, pal.ink, true);
      // пиктограмма паузы — две черты пером
      RD.pen(c, [[W / 2 - 9, py + 26], [W / 2 - 9, py + 56]], 4, 62, pal.ink); RD.pen(c, [[W / 2 + 9, py + 26], [W / 2 + 9, py + 56]], 4, 63, pal.ink);
      if (pm) pm.draw(g, W / 2, py + 100, 32);
      var S = game.state(); g.text('● ' + S.deaths + '   ' + (S.z + 1) + '/7', W / 2, py + ph - 14, { size: 13, align: 'center', color: th.muted, weight: 600 });
    } });
  };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  // финал: колофон — рукопись закрыта
  g.scenes.win.draw = function (ctx) {
    var retro = this.themeName === 'retro', pal = RD.PAL[retro ? 'retro' : 'modern'], th = this.th(), t = this.time;
    ctx.drawImage(RD.paperTex(retro ? 'retro' : 'modern'), 0, 0);
    var cx = W / 2, cy = 230, k;
    var book = [[cx - 150, cy + 60], [cx - 140, cy - 60], [cx, cy - 74], [cx + 140, cy - 60], [cx + 150, cy + 60], [cx, cy + 46]];
    RD.poly(ctx, book); ctx.fillStyle = pal.paper2; ctx.fill(); RD.hatch(ctx, book, cx - 160, cy - 80, 320, 150, 0.8, 4, pal.soft, 0.8, 71);
    RD.pen(ctx, book, 2, 72, pal.ink, true); RD.pen(ctx, [[cx, cy - 74], [cx, cy + 46]], 1.6, 73, pal.ink);
    for (k = 0; k < 6; k++) RD.pen(ctx, [[cx - 120 + k * 8, cy + 58 - k], [cx - 4, cy + 44 - k * 2]], 0.6, 74 + k, pal.soft);
    RD.lamp(ctx, cx + 190, cy + 40, pal, t, retro ? 'retro' : 'modern');
    var seal = RD.splat(cx, cy - 4, 26, 9, 7, 0.08); RD.poly(ctx, seal); ctx.fillStyle = pal.verm; ctx.fill(); RD.pen(ctx, seal, 1.4, 81, pal.ink, true);
    this.text(this.t('win'), cx, 372, { size: 40, align: 'center', color: pal.ink, weight: 700, font: th.font });
    var S = game && game.state();
    var line = this.t('score') + ': ' + (this.state.score | 0) + (this.state.best ? '   ' + this.t('best') + ': ' + this.state.best : '') + (S ? '   ● ' + S.deaths + ' ' + this.t('blots') : '');
    this.text(line, cx, 404, { size: 15, align: 'center', color: th.muted, weight: 600, font: th.font });
    this.text(this.t('tapstart'), cx, H - 30, { size: 12, align: 'center', color: th.muted, weight: 600 });
  };

  // ---------- тач: прыжок, действие, пауза; свайп вверх по канве — прыжок ----------
  function hold(id, key) {
    var b = document.getElementById(id); if (!b) return;
    var on = function (e) { if (!Arcade.touchOk(e)) return; touch[key] = true; }, off = function (e) { if (!Arcade.touchOk(e)) return; touch[key] = false; };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off, { passive: false }); b.addEventListener('touchcancel', off, { passive: false });
    b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off);
  }
  hold('bJump', 'jump'); hold('bAct', 'act');
  var bp = document.getElementById('bPause');
  if (bp) { var tp = function (e) { if (!Arcade.touchOk(e)) return; if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); }; bp.addEventListener('touchstart', tp, { passive: false }); bp.addEventListener('mousedown', tp); }
  var cv = g.canvas, sw = null;
  cv.addEventListener('touchstart', function (e) { if (g._sceneName !== 'play') return; var t0 = e.changedTouches[0]; sw = { x: t0.clientX, y: t0.clientY, t: Date.now() }; Arcade.touchOk(e); }, { passive: false });
  cv.addEventListener('touchmove', function (e) { if (!sw || g._sceneName !== 'play') return; var t0 = e.changedTouches[0]; if (sw.y - t0.clientY > 36 && Date.now() - sw.t < 400) { tj = 0.12; sw = null; } Arcade.touchOk(e); }, { passive: false });
  cv.addEventListener('touchend', function () { sw = null; });

  // подпись под канвой — по языку
  var lastLang = null;
  g.onCloud(function () { refreshMenu(); });
  function syncDom() { if (lastLang === g.i18n.lang) return; lastLang = g.i18n.lang; var f = document.getElementById('foot'); if (f) f.textContent = g.t('foot') + ' ' + g.t('hint') + '.'; }
  syncDom(); setInterval(syncDom, 250);

  g.start('title');
})(window);
