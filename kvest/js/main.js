/* МАЯЧНИЦА · сборка: оболочка — фреймворк Гефест Arcade v2.2 (меню, пауза, язык, звук, музыка), игра — KVEST.createGame
   (game.js по данным scenes.js/puzzles.js/widgets.js), отрисовка — только через window.KvestTheme (контракт «КВЕСТ»).
   Сцены движка: title (+ «Глава» — если глав в сборке больше одной: открывает экран chapters — все главы игры, прогресс каждой
   и общий процент; «Продолжить» — сохранение выбранной главы), pause (+ «Прохождение-набросок», «Начать главу заново»),
   win — финал главы с экраном издания (демо: «Продолжение — в полной версии»; полная: «Глава N+1», «Глава N+1 — скоро» или,
   после последней главы, «Конец», см. edition.js); credits — титры после финала последней главы (строки — из словаря i18n);
   своя — play. Главы — реестр chapters/index.js,
   сохранения — по главам (arcade.save.kvest.<id>; старое сохранение пилота переносится в главу 1). ?chapter=N — выбрать главу.
   Ввод: мышь/тач по канве (тап = действие, долгий тап / ПКМ = осмотр, перетаскивание предметов пальцем — предмет приподнят над
   пальцем, крупная зона захвата; на маленьких экранах зоны увеличены), H — подсказка, B — набросок, D — отладка и статистика,
   E — выгрузить статистику (в отладке), F — во весь экран, P/Esc — пауза (в мини-игре и наброске Esc закрывает их).
   Помощники (глава 3+): портреты героев над сценой (тап — переключить, тап по активному помощнику — умение), Tab — следующий герой,
   1/2/3 — герой по номеру, Q — умение (пёс — нюх, след тушью; чайка — взгляд сверху, обзор тушью; Тая под водой — прислушаться
   к колоколам: кольца-волны тушью). Под водой (глава 4+): шкала воздуха пузырьками, муть, звон — хук темы drawWater.
   Экран: HiDPI (канва = размер на экране × devicePixelRatio, логика 960×540; кэши темы в том же масштабе, с потолком по памяти),
   раскладка под телефон/планшет/десктоп с учётом вырезов (safe-area), в портрете на тач-устройстве — «поверните устройство»,
   адаптивное качество: если кадров меньше ~38 в секунду, разрешение канвы снижается ступенями (и возвращается, когда запас есть). */
(function (global) {
  'use strict';
  var K = global.KVEST, A = K.ThemeAPI, W = 960, H = 540;
  // тема: по умолчанию последняя подключённая (paper); ?theme=grey — серый макет для отладки
  (function () { var q = /[?&]theme=([a-z]+)/.exec(location.search || ''); if (q && K.themes && K.themes[q[1]]) global.KvestTheme = K.themes[q[1]]; })();
  function T() { return global.KvestTheme; }
  var PAL = { bg: '#2b2a29', panel: '#3a3836', ink: '#f1ede6', muted: '#b9b3a9', accent: '#f0bf5a', good: '#b7d3a6', bad: '#d99a8c', warn: '#f0bf5a',
    grid: '#45423f', font: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', pixel: false, glow: false, radius: 10 };
  var storedLang = null; try { storedLang = localStorage.getItem('arcade.lang'); } catch (e) {}
  // языки системы; обёртка (издание steam: K.Edition.langs) даёт язык клиента Steam и системы, в конце 'en'
  var LANG = K.pickLang(storedLang, K.Edition.langs ? K.Edition.langs() : (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]));
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'kvest', strings: K.STR, lang: LANG, theme: 'modern', themes: { modern: PAL, retro: PAL } });
  if (K.Edition.attach) K.Edition.attach(g);   // издание «для площадок» (arcade-full/platform): товар full_game, проверка покупок при запуске
  K.g = g;
  var Store = Arcade.Store, CHS = K.Chapters;
  // хранилище для реестра глав (localStorage может быть недоступен — тогда всё молча в памяти);
  // обёртка (издание steam: K.Edition.storage) — сохранения файлами в профиле пользователя (Steam Cloud)
  var LS = K.Edition.storage || (function () { var mem = {}; try { localStorage.setItem('arcade.kvest.t', '1'); localStorage.removeItem('arcade.kvest.t'); return localStorage; } catch (e) {
    return { getItem: function (k) { return k in mem ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; } }; } })();
  CHS.migrate(LS);   // сохранение пилота (arcade.save.kvest) → глава 1
  var prog = CHS.progress(LS);
  (function () { var q = CHS.fromQuery(location.search); if (q && CHS.get(q) && CHS.available(K.EDITION).indexOf(CHS.get(q)) >= 0) { prog.sel = q; prog.open = [q]; } })();
  function chapters() { return CHS.available(K.EDITION).filter(function (c) { return CHS.unlocked(c.id, prog, K.EDITION); }); }
  function chapter() { var c = CHS.get(prog.sel); return c && chapters().indexOf(c) >= 0 ? c : CHS.get('ch1'); }
  function chapterLabel(c) { c = c || chapter(); return c.title ? g.t('chapter') + ' ' + c.n + ' · ' + (c.title[g.i18n.lang] || c.title.ru) : g.t('sub2'); }
  function SAVE() { return CHS.saveKey(chapter().id); }
  function lastChapter(c) { return (K.EDITION === 'full' || !!(K.Edition.owned && K.Edition.owned())) && !!c && c.n === CHS.TOTAL && !CHS.next(c.id, K.EDITION); }
  function useChapter(c) {
    CHS.use(c.id); var tr = typeof c.music === 'string' ? Arcade.tracks[c.music] : c.music;
    if (tr && g.setMusic) g.setMusic(tr);
  }
  var game = null, wantContinue = false, lastWin = null, saveDirty = false, saveT = 0, mouseSeen = false;
  var TOUCH = false;
  try { TOUCH = !!(matchMedia('(pointer: coarse)').matches || ('ontouchstart' in global && navigator.maxTouchPoints > 0)); } catch (e) {}
  var RELEASE = !!K.Edition.release;   // издание steam: без отладки D/E, статистики плейтеста и ?check
  var PLAYTEST = !RELEASE && /[?&]playtest\b/.test(location.search || '');
  var stats = K.Stats.create(), fpsNow = 0;

  // ================= экран: HiDPI, раскладка, адаптивное качество =================
  var cv = g.canvas, ctx0 = g.ctx;
  var view = { css: W, cssH: H, dpr: 1, s: 1, sFull: 1, res: 1, tier: 0, mode: 'rails', portrait: false, budget: 0, cls: 'desktop' };
  // класс устройства, потолок масштаба кэшей и бюджет кэша (физические пиксели; 4 байта на пиксель):
  //   телефон — масштаб ≤ 1,5, ≈ 23 + 6 МБ (спрайты + эскизы тушью); планшет и обычный десктоп — ≤ 2, ≈ 38 + 11 МБ (≤ 60 МБ);
  //   десктоп с ретиной/4K (DPR ≥ 1,5 или ≥ 2560 физ. пикселей по ширине) — ≤ 3, ≈ 92 + 19 МБ; память ≤ 2 ГБ — ≤ 1,25, ≈ 17 + 4 МБ.
  (function () {
    var mem = +navigator.deviceMemory || 0, small = Math.min(screen.width || 9999, screen.height || 9999) < 600, dpr = global.devicePixelRatio || 1;
    view.cls = TOUCH ? (small ? 'phone' : 'tablet') : ((dpr >= 1.5 || (screen.width || 0) * dpr >= 2560) && !(mem && mem < 4) ? 'desktop-hi' : 'desktop');
    var paperPx = { phone: 6e6, tablet: 10e6, desktop: 10e6, 'desktop-hi': 24e6 }[view.cls], inkPx = { phone: 1.5e6, tablet: 3e6, desktop: 3e6, 'desktop-hi': 5e6 }[view.cls];
    view.resCap = { phone: 1.5, tablet: 2, desktop: 2, 'desktop-hi': 3 }[view.cls];
    if (mem && mem <= 2) { paperPx = 4.5e6; inkPx = 1e6; view.resCap = 1.25; }
    view.budget = paperPx + inkPx;
    var th = K.themes && K.themes.paper; if (th && th.setCacheBudget) th.setCacheBudget(paperPx);
    if (K.InkSketch && K.InkSketch.setCacheBudget) K.InkSketch.setCacheBudget(inkPx);
  })();
  // отладочные параметры: ?res=N — потолок масштаба, ?tier=N — ступень качества, ?nogov — без адаптивного качества
  var TIER_KEY = 'arcade.kvest.tier';
  (function () {
    var q = location.search || '', m = /[?&]res=([\d.]+)/.exec(q); if (m) view.resCap = +m[1];
    view.nogov = /[?&]nogov\b/.test(q); m = /[?&]tier=(\d)/.exec(q);
    if (m) view.tier = +m[1]; else { var t = +Store.get(TIER_KEY, 0); view.tier = t >= 0 && t <= 3 ? t : 0; }
  })();
  // Канва и кэши темы — в одном масштабе s (блиты спрайтов 1:1, без пересэмплинга):
  //   ступень 0 — s = min(размер на экране × DPR / 960, потолок); 1 — то же, облегчённые эффекты;
  //   2 — s = 1 (не выше полного), облегчённые; 3 — s = размер на экране / 960 (не меньше 0,75), облегчённые.
  function applyScale() {
    var dpr = global.devicePixelRatio || 1; view.dpr = dpr;
    var sFull = view.css * dpr / W, s = Math.min(sFull, view.resCap);
    if (view.tier >= 2) s = Math.min(s, 1);
    if (view.tier >= 3) s = Math.min(s, Math.max(0.75, view.css / W));
    s = Math.max(0.5, Math.round(s * 8) / 8); view.sFull = sFull;
    if (s !== view.s || cv.width !== Math.round(W * s)) { view.s = s; cv.width = Math.round(W * s); cv.height = Math.round(H * s); ctx0.imageSmoothingEnabled = true; }
    var th = T();
    if (th && th.setResolution && s !== view.res) th.setResolution(s);
    if (th && th.setQuality) th.setQuality(view.tier >= 1 ? 'low' : 'high');
    view.res = s;
  }
  // рисование всех сцен движка — в логических координатах 960×540 поверх физической канвы
  function wrapDraws() {
    Object.keys(g.scenes).forEach(function (name) {
      var sc = g.scenes[name]; if (!sc || sc._hidpi) return; var f = sc.draw; sc._hidpi = true;
      sc.draw = function (ctx) { if (view.portrait && TOUCH) return; ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0); if (f) f.call(this, ctx); };
    });
  }
  // адаптивное качество: окна по ~1,5 с в игре (кадры дольше 150 мс — сборка кэша при входе в сцену — не считаются);
  // меньше 38 к/с — ступень вниз; стабильно 58+ — ступень вверх (не чаще раза в 10 с, и только пока откатов было меньше трёх).
  var gov = { n: 0, t0: 0, prev: 0, busy: 0, lastDrop: -1e9, lastUp: -1e9, drops: 0, ups: 0 };
  function govFrame(now) {
    var dt = gov.prev ? now - gov.prev : 0; gov.prev = now;
    if (g._sceneName !== 'play' || document.hidden) { gov.n = 0; gov.t0 = now; gov.busy = 0; return; }
    if (!gov.t0) { gov.t0 = now; gov.busy = 0; }
    if (dt > 150) gov.busy += dt; else gov.n++;
    var span = now - gov.t0 - gov.busy; if (now - gov.t0 < 1500 || span < 900) return;
    var fps = gov.n * 1000 / span; fpsNow = fps; gov.n = 0; gov.t0 = now; gov.busy = 0;
    if (view.nogov) return;
    if (fps < 38 && view.tier < 3 && now - gov.lastDrop > 1400) { view.tier++; gov.lastDrop = now; gov.drops++; applyScale(); Store.set(TIER_KEY, String(view.tier)); }
    else if (fps > 58 && view.tier > 0 && gov.ups < 2 && now - gov.lastDrop > 10000 && now - gov.lastUp > 10000) { view.tier--; gov.ups++; gov.lastUp = now; applyScale(); Store.set(TIER_KEY, String(view.tier)); }
  }

  // ================= сохранение =================
  function loadSave(c) { try { var s = LS.getItem(CHS.saveKey((c || chapter()).id)); if (!s) return null; var o = JSON.parse(s); return o && o.v === 1 && o.flags ? o : null; } catch (e) { return null; } }
  function writeSave() { if (game && !game.won() && game.chapter) LS.setItem(CHS.saveKey(game.chapter.id), game.serialize()); saveDirty = false; stats.flush(); }
  function clearSave(c) { try { LS.removeItem(CHS.saveKey((c || chapter()).id)); } catch (e) {} }
  function solvedIn(o, c) { return (c || chapter()).puzzles.puzzles.filter(function (p) { return o && o.flags && o.flags[p.id]; }).length; }

  function onEvent(type, d) {
    d = d || {};
    stats.event(type, d);
    if (type === 'sfx') K.sfx(g, d.name, d);
    else if (type === 'ring') K.sfx(g, 'ring', d);   // колокол-ориентир под водой: нота, панорама, глухота — по расстоянию
    else if (type === 'voice') K.sfx(g, 'voice', d);   // хор огней: голос спел ноту (или мимо — огни гаснут)
    else if (type === 'note') K.sfx(g, 'note', d);     // мотив кат-сцены по нотам («песня маяка» в финале)
    else if (type === 'puzzle') { K.sfx(g, 'puzzle'); g.state.score = d.solved; }
    else if (type === 'scene') g.state.level = 1;
    if (type === 'change' || type === 'save') saveDirty = true;
    if (type === 'win') {
      var ch = game.chapter || chapter(); clearSave(ch); var sd = stats.data();
      if (prog.done.indexOf(ch.id) < 0) prog.done.push(ch.id); CHS.setProgress(LS, prog);
      lastWin = { solved: game.solvedCount(), total: K.PUZZLES.puzzles.length, time: sd ? sd.time : 0, ch: ch }; g.state.score = lastWin.solved;
      var last = lastChapter(ch);   // после финала последней главы — титры, потом экран «Конец»
      setTimeout(function () { if (g._sceneName !== 'play') return; if (last) g.goto('credits'); else g.win(); }, last ? 1600 : 900);
    }
  }
  function statsMeta() {
    return { edition: K.EDITION, chapter: chapter().id, lang: g.i18n.lang, device: view.cls, touch: TOUCH, viewport: innerWidth + 'x' + innerHeight, dpr: global.devicePixelRatio || 1,
      canvas: cv.width + 'x' + cv.height, res: view.res, ua: navigator.userAgent };
  }
  function newGame() {
    var sv = wantContinue ? loadSave() : null; wantContinue = false;
    if (!sv) clearSave();
    var ch = chapter(); useChapter(ch);
    game = K.createGame({ chapter: ch, onEvent: onEvent });
    stats.begin(!!sv, statsMeta());
    if (!(sv && game.load(sv))) game.start(); else stats.event('scene', { id: game.state().scene });
    lastWin = null; g.state.score = game.solvedCount(); K.current = game;
  }
  function statsOn() { return !RELEASE && (PLAYTEST || !!(game && game.runtime().debug)); }
  // выгрузка статистики — локальный файл JSON (data:-ссылка с атрибутом download), ничего не отправляется по сети
  function exportStats() {
    if (!stats.data()) return false;
    var json = stats.exportJSON({ view: { s: view.s, tier: view.tier, res: view.res, mode: view.mode }, cache: cacheInfo() });
    try {
      var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
      var name = 'kvest-playtest-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.json';
      var a = document.createElement('a');
      a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { console.log(json); }
    return json;
  }
  function cacheInfo() {
    var th = T(), p = th && th.cacheStats ? th.cacheStats() : null, i = K.InkSketch && K.InkSketch.cacheStats ? K.InkSketch.cacheStats() : null;
    return { paper: p, ink: i, mb: +(((p ? p.mb : 0) + (i ? i.mb : 0))).toFixed(1) };
  }

  // ================= стандартные экраны движка =================
  g.useStandardScreens({});
  g.menu.removeItem('theme');       // оформление игры — тема KvestTheme, не тема движка
  g.menu.addItem({ key: 'continue', after: 'play', label: function () { var sv = loadSave(); return sv ? g.t('cont') + ' · ' + solvedIn(sv) + ' / ' + chapter().puzzles.puzzles.length : g.t('cont') + ' —'; },
    onSelect: function () { if (!loadSave()) { g.audio.beep(200, 0.06); return; } wantContinue = true; g.goto('play'); } });
  // выбор главы — когда открыто больше одной главы (демо и до прохождения главы 1 — пункта нет); пункт открывает экран «Главы»:
  // все главы игры, прогресс каждой и общий процент (закрытые — видны, но не выбираются)
  function chapterItem() {
    if (chapters().length < 2) { g.menu.removeItem('chapter'); return; }
    g.menu.addItem({ key: 'chapter', before: 'play', label: function () { return chapterLabel() + '  ›'; }, onSelect: function () { g.goto('chapters'); } });
  }
  chapterItem();
  function selectChapter(id) {
    var c = CHS.get(id); if (!c || chapters().indexOf(c) < 0) return false;
    prog.sel = id; CHS.setProgress(LS, prog); useChapter(chapter()); return true;
  }
  g.menu.addItem({ key: 'walk', scene: 'pause', before: 'menu', label: function () { return g.t('walk'); },
    onSelect: function () { g.goto('play', { resume: true }); if (game) game.openWalk(); } });
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); },
    onSelect: function () { clearSave(game && game.chapter); g.goto('play'); } });
  // «Анимация штриха» (кипение и перо в эскизах тушью): вкл — спокойное дрожание 2,5 раза в секунду, выкл — статично
  function inkItem(scene) {
    g.menu.addItem({ key: 'inkAnim', scene: scene, before: scene === 'pause' ? 'menu' : undefined, after: scene ? undefined : 'sound',
      label: function () { return g.t('inkAnim') + ': ' + (K.InkSketch && K.InkSketch.anim() ? g.t('on') : g.t('off')); },
      onSelect: function () { if (K.InkSketch) K.InkSketch.setAnim(!K.InkSketch.anim()); } });
  }
  inkItem(); inkItem('pause');
  // обёртка (издание steam): «Во весь экран: вкл/выкл» и «Выход» — закрыть приложение (сохранение пишется до выхода)
  if (K.Edition.fullscreen) g.menu.addItem({ key: 'fullscreen', after: 'inkAnim', label: function () { return g.t('fullscreen') + ': ' + (fsOn() ? g.t('on') : g.t('off')); }, onSelect: function () { toggleFullscreen(); } });
  if (K.Edition.quit) {
    var quitApp = function () { writeSave(); stats.flush(); K.Edition.quit(); };
    g.menu.addItem({ key: 'quit', label: function () { return g.t('quit'); }, onSelect: quitApp });
    g.menu.addItem({ key: 'quit', scene: 'pause', label: function () { return g.t('quit'); }, onSelect: quitApp });
  }
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  // в паузе для плейтеста (?playtest или включена отладка D) — пункт «Статистика плейтеста → файл»
  g.scenes.pause.enter = function () {
    stats.flush();
    if (statsOn()) g.menu.addItem({ key: 'stats', scene: 'pause', before: 'menu', label: function () { return g.t('stats'); }, onSelect: function () { exportStats(); } });
    else g.menu.removeItem('stats', 'pause');
  };

  // фон меню — сцена главы, нарисованная текущей темой
  var titleScene = (function () { var s = JSON.parse(JSON.stringify(K.SCENES.filter(function (x) { return x.id === 'tower'; })[0])); s.objects.forEach(function (o) { if (o.id === 'lighthouse') o.state.lit = true; }); return s; })();
  function panel(ctx, x, y, w, h) { ctx.save(); ctx.fillStyle = 'rgba(30,29,28,0.84)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, 14); else ctx.rect(x, y, w, h); ctx.fill(); ctx.restore(); }
  // текст с переносом по ширине (для длинных EN-строк); возвращает число строк
  function wrapText(sc, s, x, y, maxW, lh, o) {
    var c = sc.ctx; c.save(); c.font = (o.weight || 800) + ' ' + (o.size || 16) + 'px ' + sc.th().font;
    var words = String(s).split(' '), line = '', lines = [];
    words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line); c.restore();
    lines.forEach(function (ln, i) { sc.text(ln, x, y + i * lh, o); });
    return lines.length;
  }
  var title = g.scenes.title, menu = g.menu.get('title');
  var titleEnter = title.enter;
  title.enter = function () { if (titleEnter) titleEnter.apply(this, arguments); chapterItem(); };
  title.draw = function (ctx) {
    var th = this.th(); T().drawScene(ctx, titleScene, this.time, {});
    T().drawHero(ctx, { x: 200, y: 452, dir: 1 }, 'idle', this.time);
    var extra = Math.max(0, menu.items.length - 5) * 32, pw = 460, ph = 316 + extra, x0 = (W - pw) / 2, y0 = 66 - Math.min(40, extra); panel(ctx, x0, y0, pw, ph);
    this.text(this.t('title'), W / 2, y0 + 60, { size: this.t('title').length > 10 ? 40 : 46, align: 'center', color: th.accent, weight: 900 });
    this.text(this.t('subtitle'), W / 2, y0 + 88, { size: 15, align: 'center', color: th.ink, weight: 700 });
    this.text(chapterLabel(), W / 2, y0 + 110, { size: 13, align: 'center', color: th.muted, weight: 600 });
    menu.draw(this, W / 2, y0 + 156, 32);
    panel(ctx, 40, H - 32, W - 80, 24);
    this.text(this.t(TOUCH ? 'hintTouch' : 'hint'), W / 2, H - 15, { size: 12, align: 'center', color: '#efe9dd', weight: 600 });
  };

  // ---------- финал главы + экран издания (демо / полная) ----------
  var MenuCtor = menu.constructor, finMenu = new MenuCtor([]), finale = null;
  function openMore() { K.Edition.goMore(global.location); }   // одно действие: та же вкладка (см. edition.js)
  // издание «для площадок»: остальные главы открываются покупкой внутри площадки (K.Edition.buy → g.purchase('full_game'))
  function buyLabel() { var pr = K.Edition.price ? K.Edition.price() : ''; return g.t('buy') + (pr ? ' · ' + pr : ''); }
  function buyRest() { K.Edition.buy(g).then(function (ok) { g.audio.beep(ok ? 1000 : 200, ok ? 0.15 : 0.06, 'triangle'); if (!ok) return; chapterItem(); if (g._sceneName === 'win') buildFinale(); else if (g._sceneName === 'chapters') buildChapters(); }); }
  function buildFinale() {
    var ch = (lastWin && lastWin.ch) || chapter(), nx = CHS.next(ch.id, K.EDITION);
    finale = K.Edition.finale(K.EDITION, nx, ch.n, lastChapter(ch));
    finMenu.items = finale.items.map(function (k) {
      var act = k === 'more' ? openMore : k === 'buy' ? buyRest : k === 'credits' ? function () { g.goto('credits', { from: 'win' }); } : k === 'next' ? function () { prog.sel = nx.id; CHS.setProgress(LS, prog); g.goto('play'); } : function () { g.goto('title'); };
      return { key: k, label: function () { return k === 'next' ? chapterLabel(nx) : k === 'buy' ? buyLabel() : g.t(k); }, onSelect: act };
    });
    if (statsOn()) finMenu.items.push({ key: 'stats', label: function () { return g.t('stats'); }, onSelect: function () { exportStats(); } });
    finMenu.sel = 0;
  }
  var winEnter = g.scenes.win.enter;
  g.scenes.win._menu = finMenu;
  g.scenes.win.enter = function () { if (winEnter) winEnter.call(this); buildFinale(); };
  g.scenes.win.press = function () {};
  g.scenes.win.draw = function (ctx) {
    var th = this.th(); if (!finale) buildFinale();
    if (game) drawGame(ctx, true); else this.clear();
    var pw = 640, x0 = W / 2 - pw / 2, y0 = 70, ph = 380 + (finMenu.items.length - 2) * 34; panel(ctx, x0, y0, pw, ph);
    var wc = (lastWin && lastWin.ch) || chapter(), wt = wc.win ? (wc.win[g.i18n.lang] || wc.win.ru) : null;
    this.text(wt ? wt.title : this.t('win'), W / 2, y0 + 58, { size: 40, align: 'center', color: th.accent, weight: 900 });
    var y = y0 + 90; y += 20 * wrapText(this, wt ? wt.sub : this.t('winSub'), W / 2, y, pw - 60, 20, { size: 15, align: 'center', color: th.ink, weight: 700 });
    if (lastWin) this.text(this.t('solved') + ': ' + lastWin.solved + ' / ' + lastWin.total + (lastWin.time ? '   ·   ' + this.t('time') + ': ' + K.Stats.fmt(lastWin.time) : ''), W / 2, y + 6, { size: 13, align: 'center', color: th.muted, weight: 700 });
    ctx.save(); ctx.strokeStyle = 'rgba(240,191,90,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0 + 80, y + 26); ctx.lineTo(x0 + pw - 80, y + 26); ctx.stroke(); ctx.restore();
    T().drawIcon(ctx, finale.kind === 'next' ? 'map' : finale.kind === 'end' ? 'tower' : finale.items.length > 1 ? 'boat' : 'book', W / 2, y + 62, 46);
    var y2 = y + 116, ft = this.t(finale.title).replace('{n}', finale.n || ''); y2 += 30 * wrapText(this, ft, W / 2, y2, pw - 60, 30, { size: 24, align: 'center', color: th.accent, weight: 900 });
    y2 += 19 * wrapText(this, this.t(finale.sub), W / 2, y2 - 4, pw - 90, 19, { size: 14, align: 'center', color: th.ink, weight: 600 });
    finMenu.draw(this, W / 2, Math.max(y2 + 22, y0 + ph - 30 - (finMenu.items.length - 1) * 34), 34);
  };

  // ---------- экран «Главы»: все главы игры, прогресс каждой, общий процент ----------
  var chMenu = new MenuCtor([]), chSum = null;
  function rowTitle(r) {
    if (!r.present) return g.t('chapter') + ' ' + r.n;
    return r.title ? g.t('chapter') + ' ' + r.n + ' · ' + (r.title[g.i18n.lang] || r.title.ru) : g.t('sub2');
  }
  function rowState(r) { return !r.present ? g.t('chFull') : !r.unlocked ? g.t('chLocked') : r.done ? g.t('chDone') : r.solved ? r.solved + ' / ' + r.total : g.t('chNew'); }
  function buildChapters() {
    chSum = CHS.summary(LS, K.EDITION, prog);
    chMenu.items = chSum.rows.map(function (r) {
      return { key: r.id, row: r, label: function () { return rowTitle(r); },
        onSelect: function () { if (!selectChapter(r.id)) { if (K.Edition.paid && K.Edition.paid(r.id) && K.Edition.canBuy()) buyRest(); else g.audio.beep(200, 0.06); return; } g.goto('title'); } };
    });
    chMenu.items.push({ key: 'back', label: function () { return g.t('chBack'); }, onSelect: function () { g.goto('title'); } });
    var cur = chapter(); chMenu.sel = 0; chMenu.items.forEach(function (it, i) { if (it.key === cur.id) chMenu.sel = i; });
  }
  g.scene('chapters', {
    _menu: chMenu,
    enter: function () { buildChapters(); },
    press: function (a) { if (a === 'pause') this.goto('title'); },
    draw: function (ctx) {
      var th = this.th(), self = this; if (!chSum) buildChapters();
      T().drawScene(ctx, titleScene, this.time, {});
      var pw = 660, x0 = (W - pw) / 2, y0 = 36, lh = 46, n = chSum.rows.length, ph = 122 + n * lh + 74; panel(ctx, x0, y0, pw, ph);
      this.text(this.t('chapters'), W / 2, y0 + 44, { size: 30, align: 'center', color: th.accent, weight: 900 });
      // общий процент: полоска и число
      var bx = x0 + 60, bw = pw - 120, by = y0 + 62, f = Math.max(0, Math.min(1, chSum.pct / 100));
      ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(bx, by, bw, 8); ctx.fillStyle = th.accent; ctx.fillRect(bx, by, bw * f, 8); ctx.restore();
      this.text(this.t('chTotal') + ': ' + chSum.pct + ' %   ·   ' + chSum.solved + ' / ' + chSum.total, W / 2, by + 28, { size: 13, align: 'center', color: th.muted, weight: 700 });
      chMenu.items.forEach(function (it, i) {
        var on = i === chMenu.sel, y = y0 + 126 + i * lh, r = it.row;
        if (!r) { self.text((on ? '▸ ' : '  ') + self.t('chBack'), W / 2, y + 18, { size: 17, align: 'center', color: on ? th.accent : th.muted, weight: on ? 800 : 600 }); it._y = y + 18; return; }
        var open = r.present && r.unlocked;
        if (on) { ctx.save(); ctx.fillStyle = 'rgba(240,191,90,0.13)'; ctx.fillRect(x0 + 24, y - 20, pw - 48, lh - 6); ctx.restore(); }
        ctx.save(); ctx.globalAlpha = open ? 1 : 0.55; T().drawIcon(ctx, r.done ? 'check' : open ? (r.id === chapter().id ? 'book' : 'map') : 'lock', x0 + 52, y, 24); ctx.restore();
        self.text(rowTitle(r), x0 + 78, y + 6, { size: 17, color: !open ? th.muted : on ? th.accent : th.ink, weight: on ? 800 : 700 });
        self.text(rowState(r), x0 + pw - 40, y + 6, { size: 14, align: 'right', color: r.done ? th.good : open ? th.ink : th.muted, weight: 700 });
        if (open && !r.done && r.total) { ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(x0 + 78, y + 14, pw - 118, 3); ctx.fillStyle = th.accent; ctx.fillRect(x0 + 78, y + 14, (pw - 118) * r.solved / r.total, 3); ctx.restore(); }
        it._y = y + 6;
      });
      this.text(this.t('chHint'), W / 2, y0 + ph - 14, { size: 11, align: 'center', color: th.muted, weight: 600 });
    }
  });

  // ---------- титры (после финала последней главы): строки — из словаря i18n, лента едет по финальной сцене ----------
  var credT = 0, credFrom = null;
  function endCredits() { if (g._sceneName !== 'credits') return; if (credFrom === 'win' || !lastWin) g.goto(credFrom === 'title' ? 'title' : 'win'); else g.win(); }
  g.scene('credits', {
    realtime: true,
    enter: function (d) {
      credT = 0; credFrom = (d && d.from) || null;
      var ch = (lastWin && lastWin.ch) || chapter(), tr = ch && (ch.creditsMusic || ch.music); tr = typeof tr === 'string' ? Arcade.tracks[tr] : tr;
      if (tr && g.setMusic) { g.setMusic(tr); try { g.audio.music.play(true); } catch (e) {} }   // титры идут под мотив «песни маяка»
    },
    press: function (a) { if (credT > 0.6 && (a === 'action' || a === 'start' || a === 'pause')) endCredits(); },
    update: function (dt) { credT += dt; if (game) game.update(dt); if (K.Credits.at(credT).done) endCredits(); },
    draw: function (ctx) {
      var th = this.th(), C = K.Credits.at(credT), self = this;
      if (game) drawGame(ctx, true); else T().drawScene(ctx, titleScene, this.time, {});
      ctx.save(); var k = Math.min(1, credT / 1.2), gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(24,22,26,' + (0.62 * k).toFixed(3) + ')'); gr.addColorStop(0.5, 'rgba(24,22,26,' + (0.5 * k).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(24,22,26,' + (0.7 * k).toFixed(3) + ')');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); ctx.restore();
      C.lines.forEach(function (l) {
        if (l.a <= 0.01) return; ctx.save(); ctx.globalAlpha = l.a;
        if (l.icon) T().drawIcon(ctx, l.icon, W / 2, l.y - 12, 44);
        else self.text(self.t(l.key), W / 2, l.y, { size: l.size, align: 'center', color: l.accent ? th.accent : l.dim ? th.muted : th.ink, weight: l.accent ? 900 : l.dim ? 600 : 800 });
        ctx.restore();
      });
      if (credT > 2) { ctx.save(); ctx.globalAlpha = 0.55; this.text(this.t('credSkip'), W - 24, H - 16, { size: 11, align: 'right', color: th.muted, weight: 600 }); ctx.restore(); }
    }
  });

  // ================= игровая сцена =================
  function drawGame(ctx, still) {
    var m = game.model(), th = T(), t = m.time;
    th.drawScene(ctx, m.scene, t, { debug: m.ui.debug, light: m.light, hover: mouseSeen && !still ? m.cursor : null });
    if (m.trail && th.drawTrail) th.drawTrail(ctx, m.trail, t);   // нюх пса — след под героями
    if (m.party && m.party.length) {   // отряд: Тая — drawHero, помощники — drawHelper (без хука — drawNpc), активный — с меткой
      m.party.forEach(function (p) {
        if (p.id === 'taya') th.drawHero(ctx, p, p.pose, t);
        else if (th.drawHelper) th.drawHelper(ctx, p, p.pose, t);
        else th.drawNpc(ctx, { id: p.id, kind: 'npc', x: p.x - 40, y: p.y - 60, w: 80, h: 60, state: { type: p.id, dir: p.dir } }, p.pose, t);
        if (p.active && m.party.length > 1 && !still && th.drawActiveMark) th.drawActiveMark(ctx, p, t);
      });
    } else if (m.showHero) th.drawHero(ctx, m.hero, m.pose, t);
    // под водой: муть, кольца звона тушью, шкала воздуха (пузырьки); на экране финала шкала воздуха не нужна
    if (m.water && th.drawWater) th.drawWater(ctx, still && m.water.air ? Object.assign({}, m.water, { air: null }) : m.water, t);
    if (m.scene.dream && th.drawDream) th.drawDream(ctx, m.scene.dream, t);   // сцена-сон: вуаль сна (в яви тает)
    if (m.fx && m.fx.length && th.drawFx) th.drawFx(ctx, m.fx, t);            // эффекты финальной кат-сцены: рассвет, туман уходит, кольца песни
    if (m.overview && th.drawOverview) th.drawOverview(ctx, m.overview, t);   // взгляд сверху — калькой поверх сцены
    m.thoughts.forEach(function (q) {   // подсказка и мысли мастера — тушью, если тема умеет (хуки drawHint / drawThought opts.style)
      if (q.style === 'ink' && q.hint && th.drawHint) th.drawHint(ctx, q.x, q.y, q.hint, t, { age: q.age });
      else th.drawThought(ctx, q.x, q.y, q.icons, t, { style: q.style || 'paper', age: q.age });
    });
    if (still) return;
    th.drawUI(ctx, m.ui, t);
    if (m.chorus && th.drawChorus) th.drawChorus(ctx, m.chorus, t);   // хор огней: строка мелодии (какие ноты уже спеты)
    if (mouseSeen && m.cursor.kind && m.cursor.x >= 0) {
      th.drawCursor(ctx, m.cursor.kind, m.cursor.x, m.cursor.y);
      if (m.cursor.item && !m.ui.drag) th.drawIcon(ctx, m.cursor.item, m.cursor.x + 22, m.cursor.y + 22, 28);
    }
    if (!mouseSeen) longPressRing(ctx, game.runtime());
    if (m.ui.debug) debugPanel(ctx);
  }
  // тач: кольцо «долгого тапа» вокруг пальца (через 0,15 с после касания — понятно, что сейчас будет осмотр)
  function longPressRing(ctx, rt) {
    var p = rt.ptr; if (!p || p.moved || p.long || p.slot >= 0 || rt.mode !== 'scene' || rt.cut) return;
    var f = (rt.time - p.t) / (game.longT || 0.5); if (f < 0.3 || f > 1) return; f = (f - 0.3) / 0.7;
    ctx.save(); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(30,20,12,0.35)'; ctx.lineWidth = 7; ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x, p.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.strokeStyle = '#fbf3e0'; ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
  }
  // отладка (D): статистика прохождения, кадры, кэш
  function debugPanel(ctx) {
    var s = stats.summary(), ci = cacheInfo(), lines = [];
    lines.push(g.t('statsTitle') + ' · ' + K.EDITION + ' · ' + g.i18n.lang);
    if (s) {
      lines.push(g.t('time') + ' ' + K.Stats.fmt(s.time) + ' · ' + s.solved + '/' + K.PUZZLES.puzzles.length + ' · ' + g.t('hintsL') + ' ' + s.hints.total + ' (' + s.hints.free + '/' + s.hints.timer + '/' + s.hints.game + ') · ' + g.t('errorsL') + ' ' + s.errors.total);
      s.rows.forEach(function (r) { lines.push('  ' + r.id + ' ' + K.Stats.fmt(r.time) + ' ×' + r.visits + ' · ' + g.t('hintsL') + ' ' + r.hints + ' · ' + g.t('errorsL') + ' ' + r.errors); });
    }
    lines.push(g.t('fpsL') + ' ' + Math.round(fpsNow) + ' · ' + cv.width + '×' + cv.height + ' (×' + view.s + ', ' + 'tier ' + view.tier + ') · res ' + view.res + ' · ' + g.t('cacheL') + ' ' + ci.mb + ' MB');
    lines.push(g.t('statsHint'));
    var w = 430, h = 14 + lines.length * 15;
    ctx.save(); ctx.fillStyle = 'rgba(20,16,12,0.78)'; ctx.fillRect(W - w - 8, 8, w, h); ctx.font = '600 11px monospace'; ctx.textBaseline = 'top'; ctx.fillStyle = '#f1ede6';
    lines.forEach(function (l, i) { ctx.fillText(l, W - w, 14 + i * 15); }); ctx.restore();
  }
  var lastFrame = 0;
  var playSince = 0;
  g.scene('play', {
    realtime: true,
    enter: function (d) { playSince = performance.now(); if (!(d && d.resume) || !game) newGame(); },
    press: function (a) {
      if (!game) return;
      var rt = game.runtime();
      if (a === 'pause') {
        if (rt.mode === 'mini') { game.closeMini(); return; }
        if (rt.mode === 'walk') { game.closeWalk(); return; }
        writeSave(); this.pause(); return;
      }
      if ((a === 'action' || a === 'start') && (rt.cut || rt.cutQ.length)) game.skipCut();
    },
    update: function (dt) {
      if (!game) return;
      game.update(dt); saveT += dt;
      stats.tick(dt, !document.hidden, fpsNow);
      if (saveDirty && saveT > 0.6) { saveT = 0; writeSave(); }
    },
    draw: function (ctx) { var now = performance.now(); govFrame(now); lastFrame = now; if (game) drawGame(ctx); else this.clear(); }
  });

  // ================= клавиши игры =================
  addEventListener('keydown', function (e) {
    if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey) { toggleFullscreen(); return; }
    if (g._sceneName !== 'play' || !game) return;
    if (e.code === 'KeyH') { game.hint(); K.sfx(g, 'hint'); }
    else if (e.code === 'KeyB') { var rt = game.runtime(); if (rt.mode === 'walk') game.closeWalk(); else if (rt.mode === 'scene') game.openWalk(); }
    else if (e.code === 'KeyD' && !RELEASE) game.setDebug();
    else if (e.code === 'Tab' && game.multi) { e.preventDefault(); game.cycleHero(e.shiftKey ? -1 : 1); }
    else if (/^Digit[1-3]$/.test(e.code) && game.multi) { var hl = game.portraits(), hi = +e.code.slice(5) - 1; if (hl[hi]) game.switchHero(hl[hi]); }
    else if (e.code === 'KeyQ') game.ability();   // умение активного героя; у Таи под водой — «прислушаться»
    else if (e.code === 'KeyE' && !RELEASE && game.runtime().debug) exportStats();
  });

  // ================= мышь и тач по канве =================
  var LIFT = 34;   // тач: перетаскиваемый предмет приподнят над пальцем (логические пиксели), отпускается там, где его видно
  function pt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; }
  function inPlay() { return g._sceneName === 'play' && game; }
  function touchPad() { var k = view.css / W; return Math.max(10, Math.min(24, (44 / k - 30) / 2)); }   // мин. цель ≈ 44 css-пикселя, запас под палец ≥ 10
  cv.addEventListener('mousedown', function (e) { if (g._sceneName === 'credits' && credT > 0.6) { endCredits(); return; } if (!inPlay()) return; mouseSeen = true; game.setTouchPad(0); if (e.button === 2) return; var p = pt(e); game.down(p.x, p.y); });
  cv.addEventListener('mousemove', function (e) { if (!inPlay()) return; mouseSeen = true; var p = pt(e); game.move(p.x, p.y); });
  addEventListener('mouseup', function (e) { if (!inPlay() || e.button === 2) return; var p = pt(e); game.up(p.x, p.y); });
  cv.addEventListener('mouseleave', function () { if (inPlay()) game.move(-100, -100); });
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); if (!inPlay()) return; var p = pt(e); game.look(p.x, p.y); });
  var tid = null;   // один палец: второй касанием игнорируется (без случайных «двойных» действий)
  function myTouch(e) { for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === tid) return e.changedTouches[i]; return null; }
  function lifted(p) { if (game.runtime().drag) p.y -= LIFT; return p; }
  cv.addEventListener('touchstart', function (e) {
    if (g._sceneName === 'credits' && credT > 0.6) { e.preventDefault(); endCredits(); return; }
    if (!inPlay()) return; e.preventDefault(); if (tid !== null) return;
    if (performance.now() - playSince < 250) return;   // касание, которым выбрали пункт меню, не должно сразу пропустить вступление
    var t = e.changedTouches[0]; tid = t.identifier; mouseSeen = false; TOUCH = true; game.setTouchPad(touchPad());
    var p = pt(t); game.down(p.x, p.y);
  }, { passive: false });
  cv.addEventListener('touchmove', function (e) { if (!inPlay()) return; e.preventDefault(); var t = myTouch(e); if (!t) return; var p = lifted(pt(t)); game.move(p.x, p.y); }, { passive: false });
  function touchEnd(e) { if (!inPlay()) { tid = null; return; } e.preventDefault(); var t = myTouch(e); if (!t) return; tid = null; var p = lifted(pt(t)); game.up(p.x, p.y); game.move(-100, -100); }
  cv.addEventListener('touchend', touchEnd, { passive: false });
  cv.addEventListener('touchcancel', touchEnd, { passive: false });

  // ================= DOM: кнопки, раскладка, поворот, полноэкранный режим =================
  var $ = function (id) { return document.getElementById(id); };
  var bPause = $('bPause'), bFs = $('bFs'), back = $('backLink'), foot = $('foot'), rot = $('rotate');
  (function () {
    if (!bPause) return;
    var h = function (e) { e.preventDefault(); if (g._sceneName === 'play') { writeSave(); g.pause(); } else if (g._sceneName === 'pause') g.goto('play', { resume: true }); };
    bPause.addEventListener('touchstart', h, { passive: false }); bPause.addEventListener('mousedown', h);
  })();
  var fsEl = document.documentElement, FSX = K.Edition.fullscreen || null;   // обёртка (издание steam): окно приложения ↔ полный экран
  function fsOn() { return FSX ? !!FSX.on() : !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function fsCan() { return FSX ? !!FSX.can() : !!(document.fullscreenEnabled || document.webkitFullscreenEnabled); }
  function toggleFullscreen() {
    if (FSX) { FSX.toggle(); return; }
    if (!fsCan()) return;
    try {
      if (fsOn()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      var r = (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl, { navigationUI: 'hide' });
      var lock = function () { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () {}); } catch (e) {} };
      if (r && r.then) r.then(lock).catch(function () {}); else lock();
    } catch (e) {}
  }
  if (bFs) {
    if (!fsCan()) bFs.hidden = true;
    var hf = function (e) { e.preventDefault(); toggleFullscreen(); };
    bFs.addEventListener('click', hf);
  }
  // страница не масштабируется и не прокручивается во время игры (щипок, двойной тап, «резинка»)
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false }); });
  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('wheel', function (e) { if (e.ctrlKey) e.preventDefault(); }, { passive: false });

  function safeArea() {
    var cs = getComputedStyle(document.documentElement), v = function (n) { return parseFloat(cs.getPropertyValue(n)) || 0; };
    return { t: v('--sat'), r: v('--sar'), b: v('--sab'), l: v('--sal') };
  }
  function place(el, x, y) { if (el) { el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px'; } }
  function fit() {
    var vv = global.visualViewport, vw = Math.round(vv ? vv.width : innerWidth), vh = Math.round(vv ? vv.height : innerHeight);
    // портрет на телефоне — «поверните устройство»; планшет в портрете играет в полосе (канва ≥ 700 css-пикселей — крупнее, чем телефон в ландшафте)
    var portrait = TOUCH && vh > vw * 1.05 && vw < 700;
    if (portrait !== view.portrait) {
      view.portrait = portrait; document.body.classList.toggle('portrait', portrait);
      if (rot) rot.hidden = !portrait;
      if (portrait) { if (g._sceneName === 'play') { writeSave(); g.pause(); } rotLoop(); }
    }
    var sa = safeArea(), aw = Math.max(200, vw - sa.l - sa.r), ah = Math.max(150, vh - sa.t - sa.b), gap = 6;
    var footH = (!TOUCH && ah >= 640) ? 34 : 0, rail = 50, bar = 40;
    var hA = Math.min(ah - 2 * gap - footH, (aw - 2 * rail) * H / W), wA = hA * W / H;    // кнопки в полях слева/справа
    var wB = Math.min(aw - 2 * gap, (ah - bar - gap - footH) * W / H);                     // кнопки над канвой
    var mode = wA >= wB ? 'rails' : 'bar', cw = Math.max(240, Math.floor(mode === 'rails' ? wA : wB)), ch = Math.round(cw * H / W);
    var left = sa.l + (aw - cw) / 2, top = mode === 'rails' ? sa.t + (ah - footH - ch) / 2 : sa.t + bar + (ah - bar - footH - ch) / 2;
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px'; cv.style.left = Math.round(left) + 'px'; cv.style.top = Math.round(top) + 'px';
    document.body.classList.toggle('rails', mode === 'rails'); document.body.classList.toggle('bar', mode === 'bar');
    if (mode === 'rails') { place(back, left - rail + 6, top + 4); place(bPause, left + cw + 8, top + 4); place(bFs, left + cw + 8, top + 50); }
    else { place(back, left, top - bar + 4); place(bPause, left + cw - 38, top - bar + 4); place(bFs, left + cw - 84, top - bar + 4); }
    if (foot) { foot.hidden = !footH; foot.innerHTML = g.t(cw >= 1000 ? 'foot' : 'hint'); foot.dataset.lang = g.i18n.lang; foot.style.top = Math.round(top + ch + 6) + 'px'; foot.style.left = Math.round(left) + 'px'; foot.style.width = cw + 'px'; }
    view.mode = mode; view.css = cw; view.cssH = ch;
    if (game && TOUCH) game.setTouchPad(touchPad());
    applyScale();
  }
  // «поверните устройство»: иллюстрация в стиле игры (бумажный телефон поворачивается, героиня ждёт)
  var rotC = rot && rot.querySelector('canvas'), rotRaf = 0;
  function rotLoop() {
    if (!rotC || rotRaf) return;
    var step = function (ms) {
      rotRaf = 0; if (!view.portrait) return;
      var dpr = Math.min(2, global.devicePixelRatio || 1), cssW = Math.min(320, innerWidth - 40), cssH = Math.round(cssW * 0.75);
      if (rotC.width !== Math.round(cssW * dpr)) { rotC.width = Math.round(cssW * dpr); rotC.height = Math.round(cssH * dpr); rotC.style.width = cssW + 'px'; rotC.style.height = cssH + 'px'; }
      var c = rotC.getContext('2d'), k = rotC.width / 320, t = ms / 1000; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, rotC.width, rotC.height); c.setTransform(k, 0, 0, k, 0, 0);
      drawRotate(c, t); rotRaf = requestAnimationFrame(step);
    };
    rotRaf = requestAnimationFrame(step);
  }
  function drawRotate(c, t) {
    var th = T(), cyc = t % 3.2, f = cyc < 0.8 ? 0 : cyc < 1.8 ? (cyc - 0.8) : 1, e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2, ang = -e * Math.PI / 2;
    c.save(); c.fillStyle = '#e9dcbc'; c.beginPath(); if (c.roundRect) c.roundRect(6, 6, 308, 228, 16); else c.rect(6, 6, 308, 228); c.fill();
    c.strokeStyle = 'rgba(74,48,36,0.35)'; c.lineWidth = 2; c.setLineDash && c.setLineDash([6, 5]); c.stroke(); c.setLineDash && c.setLineDash([]);
    // дуга-стрелка
    c.strokeStyle = '#c63d26'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.arc(196, 118, 74, -Math.PI * 0.95, -Math.PI * 0.55); c.stroke();
    var ax = 196 + Math.cos(-Math.PI * 0.55) * 74, ay = 118 + Math.sin(-Math.PI * 0.55) * 74; c.beginPath(); c.moveTo(ax - 10, ay - 6); c.lineTo(ax + 2, ay); c.lineTo(ax - 8, ay + 10); c.stroke();
    // бумажный телефон
    c.translate(196, 124); c.rotate(ang);
    c.fillStyle = 'rgba(40,22,10,0.3)'; c.fillRect(-31, -51, 66, 108);
    c.fillStyle = '#4a3024'; c.beginPath(); if (c.roundRect) c.roundRect(-34, -56, 68, 108, 10); else c.rect(-34, -56, 68, 108); c.fill();
    c.fillStyle = '#9fc3c8'; c.fillRect(-27, -46, 54, 88);
    c.rotate(-ang); if (th && th.drawIcon) th.drawIcon(c, 'tower', 0, -2, 40); c.restore();
    if (th && th.drawHero) { c.save(); c.translate(70, 50); c.scale(0.95, 0.95); th.drawHero(c, { x: 18, y: 160, dir: 1 }, 'think', t); c.restore(); }
  }

  var lastLang = null, lastScene = null, lastFs = null;
  function domSync() {
    if (g.i18n.lang !== lastLang) {
      lastLang = g.i18n.lang; document.documentElement.lang = lastLang; document.title = g.t('docTitle');
      cv.setAttribute('aria-label', g.t('title'));
      if (back) { back.innerHTML = '&larr; <span class="lbl"></span>'; back.querySelector('.lbl').textContent = g.t('back'); back.title = g.t('back'); back.setAttribute('aria-label', g.t('back')); }
      if (foot) foot.innerHTML = g.t(view.css >= 1000 ? 'foot' : 'hint');   // строки — наши, из i18n.js
      if (bPause) { bPause.setAttribute('aria-label', g.t('pauseBtn')); bPause.title = g.t('pauseBtn'); }
      if (rot) { var r1 = rot.querySelector('.r1'), r2 = rot.querySelector('.r2'); if (r1) r1.textContent = g.t('rotate'); if (r2) r2.textContent = g.t('rotateSub'); }
      lastFs = null;
    }
    var fs = fsOn(); if (bFs && fs !== lastFs) { lastFs = fs; bFs.classList.toggle('on', fs); bFs.setAttribute('aria-label', g.t(fs ? 'fsExit' : 'fullscreen')); bFs.title = g.t(fs ? 'fsExit' : 'fullscreen'); }
    var sn = g._sceneName === 'play' && mouseSeen ? 'play' : 'other';
    if (sn !== lastScene) { lastScene = sn; cv.style.cursor = sn === 'play' ? 'none' : 'pointer'; }
    requestAnimationFrame(domSync);
  }
  addEventListener('resize', fit); addEventListener('orientationchange', function () { setTimeout(fit, 120); });
  if (global.visualViewport) global.visualViewport.addEventListener('resize', fit);
  document.addEventListener('fullscreenchange', fit); document.addEventListener('webkitfullscreenchange', fit);
  if (FSX && FSX.onChange) FSX.onChange(function () { setTimeout(fit, 60); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { if (g._sceneName === 'play') writeSave(); stats.flush(); } });
  addEventListener('pagehide', function () { stats.flush(); });
  fit(); domSync();

  // ?check — проверка темы по API (результат — в консоль)
  if (!RELEASE && /[?&#]check\b/.test(location.search + location.hash)) { var r = A.validateTheme(T(), { ctx: g.ctx }); console.log('KvestTheme ' + T().id + ': ' + (r.ok ? 'OK' : 'ошибки: ' + r.errors.join('; '))); }

  wrapDraws();
  g.start('title');
  // для отладки/автотестов в браузере
  K.app = { g: g, game: function () { return game; }, chapter: chapter, chapters: chapters, selectChapter: selectChapter, summary: function () { return CHS.summary(LS, K.EDITION, prog); }, credits: function () { return { t: credT, at: K.Credits.at(credT) }; }, progress: function () { return prog; }, view: view, stats: stats, exportStats: exportStats, cacheInfo: cacheInfo, fit: fit, applyScale: applyScale, gov: gov, fps: function () { return fpsNow; } };
})(typeof window !== 'undefined' ? window : globalThis);
