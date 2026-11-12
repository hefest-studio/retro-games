/*! Гефест Arcade · host.js — «оболочка» движка v2 поверх самостоятельной игры.
 *
 * Для крупных игр со своим циклом, своим <canvas> и своими рендерерами (retro / modern),
 * которые небезопасно разбирать на части. Игра работает своим кодом без изменений логики,
 * а движок (engine.js) поверх неё даёт стандарт аркады:
 *   • меню (Играть / [доп. пункт игры] / Язык / Тема / Звук + рекорд), пауза, финалы win/gameover;
 *   • тема движка retro|modern ⇄ графика игры (gfx), язык движка ⇄ язык игры (двусторонне);
 *   • звук движка (M / меню) → звук игры; рекорд arcade.best.<slug> (старый рекорд игры переносится);
 *   • клавиши: P/Esc — пауза, T и G — тема, L — язык, M — звук; остальное в игре идёт в игру.
 * Движок рисует в отдельный прозрачный <canvas> поверх игрового (в сцене play он пуст и
 * пропускает касания к игре). Связь с игрой — только через адаптер из её публичных функций.
 *
 * Отладочные адреса игры (#shot= / #sim= / #test) — оболочка не включается, игра работает
 * как раньше (на них завязаны tools/ игр). #gfx=retro|modern и #lang=ru|en — задают тему/язык
 * движка на этот запуск (без сохранения), их же понимает игра (tools/thumbs.mjs).
 *
 * Копии файла: obval/js/host.js, rubikon/js/host.js, vihr/js/host.js (одинаковые).
 */
(function (global) {
  'use strict';
  var doc = global.document;

  function hashParams() {
    var h = String((global.location && global.location.hash) || '').replace(/^#/, '');
    try { return new URLSearchParams(h); } catch (e) { return { has: function () { return false; }, get: function () { return null; } }; }
  }

  /**
   * ArcadeHost.mount(o)
   *  o.gameId   — slug (ключ рекорда arcade.best.<slug>)
   *  o.mount    — элемент/селектор, внутрь которого кладётся canvas движка (position:relative, размер = кадр игры)
   *  o.width, o.height — логический размер canvas движка (пропорции кадра игры); o.scale — задний буфер (2)
   *  o.strings  — {ru:{…}, en:{…}} строк движка (title, subtitle, extra и стандартные)
   *  o.adapter  — {
   *     mode()  → 'title' | 'sub' | 'play' | 'paused' | 'gameover' | 'win'
   *     start(), toTitle(), pause(), resume(), openSub() (если есть доп. пункт меню)
   *     score() → число, best() → старый рекорд игры
   *     gfx() → 'retro'|'modern', setGfx(v); lang() → 'ru'|'en', setLang(v); setSound(on)
   *  }
   *  o.extra    — ключ строки доп. пункта меню (уровни / брифинг / управление) или null
   */
  function mount(o) {
    var Arcade = global.Arcade, A = o.adapter, P = hashParams();
    if (P.has('shot') || P.has('sim') || P.has('test')) { // отладка игры — без оболочки
      doc.documentElement.setAttribute('data-arcade-scene', 'off');
      return null;
    }

    // Рекорд: переносим старый рекорд игры в arcade.best.<slug> (берём максимум).
    var key = 'arcade.best.' + o.gameId, old = Math.floor(+A.best() || 0);
    if (old > Arcade.Store.getNum(key, 0)) Arcade.Store.set(key, String(old));

    var root = typeof o.mount === 'string' ? doc.querySelector(o.mount) : o.mount;
    var cv = doc.createElement('canvas');
    cv.className = 'arcade-host';
    cv.setAttribute('aria-label', 'menu');
    root.appendChild(cv);

    var g = Arcade.createGame({ canvas: cv, width: o.width, height: o.height, gameId: o.gameId,
      strings: o.strings, theme: 'modern', lives: 0 });
    // чёткий текст меню: задний буфер ×scale, рисуем в логических координатах W×H
    var k = o.scale || 2;
    cv.width = o.width * k; cv.height = o.height * k;
    g.ctx.setTransform(k, 0, 0, k, 0, 0); g._applyPixel();

    // Параметры адреса: тема/язык только на этот запуск
    var hg = P.get('gfx'), hl = P.get('lang');
    if (hg === 'retro' || hg === 'modern') { g.themeName = hg; g._applyPixel(); }
    if (hl === 'ru' || hl === 'en') g.i18n.lang = hl;

    // Стандартные экраны; заголовок/подзаголовок — по текущему языку
    var cfg = { lives: 0 };
    Object.defineProperty(cfg, 'title', { get: function () { return g.t('title'); } });
    Object.defineProperty(cfg, 'subtitle', { get: function () { return g.t('subtitle', ''); } });
    g.useStandardScreens(cfg);
    if (o.extra && A.openSub) {
      g.scenes.title._menu.items.splice(1, 0, {
        label: function () { return g.t(o.extra); },
        onSelect: function () { g.goto('play', { sub: true }); }
      });
    }

    // Сцена play: игра идёт своим циклом и рисует сама, canvas движка прозрачен
    g.scene('play', {
      realtime: true,
      enter: function (d) {
        d = d || {};
        if (d.adopt) return;               // игра уже идёт
        if (d.resume) A.resume();
        else if (d.sub) A.openSub();
        else A.start();
      },
      update: function () {},
      draw: function (ctx) { ctx.clearRect(0, 0, g.W, g.H); },
      press: function (a) {
        if (a !== 'pause') return;
        if (A.mode() === 'sub') g.goto('title'); // из уровней/брифинга/управления — назад в меню
        else g.pause();
      }
    });
    // Пауза движка: ставим игру на паузу; если игра в непрерываемом моменте (гибель, лифт…) —
    // дожимаем паузу в sync(), как только станет можно. wasPaused — игра уже стояла на паузе:
    // если она снялась сама (тач-кнопка паузы игры и т.п.), движок следует за игрой.
    var wasPaused = false;
    g.scenes.pause.enter = function () { if (A.mode() === 'play') A.pause(); wasPaused = A.mode() === 'paused'; };
    g.scenes.pause.press = function (a) { if (a === 'pause') g.goto('play', { resume: true }); }; // P/Esc — снять паузу
    var titleEnter = g.scenes.title.enter;
    g.scenes.title.enter = function (d) {
      if (titleEnter) titleEnter.call(this, d);
      if (A.mode() !== 'title') A.toTitle();
    };

    // Сцена → атрибут на <html> (CSS прячет родные меню игры) и касания: в play — к игре
    var goto0 = g.goto;
    g.goto = function (name, data) {
      cv.style.pointerEvents = name === 'play' ? 'none' : 'auto';
      doc.documentElement.setAttribute('data-arcade-scene', name);
      return goto0.call(this, name, data);
    };

    // Клавиатура: движок слушает сам (capture), в игру пропускаем только игровые клавиши в play
    var OWN = { KeyP: 1, Escape: 1, KeyL: 1, KeyT: 1, KeyM: 1, KeyG: 1 };
    global.removeEventListener('keydown', g.input._kd);
    global.removeEventListener('keyup', g.input._ku);
    global.addEventListener('keydown', function (e) {
      if (g._sceneName === 'play' && !OWN[e.code]) { g.input._kd(e); return; }
      e.stopPropagation();
      if (e.code === 'KeyG') { e.preventDefault(); if (!e.repeat) g.toggleTheme(); return; }
      if (e.repeat && OWN[e.code]) { e.preventDefault(); return; }
      g.input._kd(e);
    }, true);
    global.addEventListener('keyup', function (e) { g.input._ku(e); }, true);

    // Синхронизация каждый кадр: тема, язык, звук, сцены по состоянию игры
    var lastTheme = null, lastLang = null, lastSound = true;
    function gfxOf(theme) { return theme === 'retro' ? 'retro' : 'modern'; }
    function sync() {
      global.requestAnimationFrame(sync);
      if (g.themeName !== lastTheme) { lastTheme = g.themeName; if (A.gfx() !== gfxOf(lastTheme)) A.setGfx(gfxOf(lastTheme)); }
      else if (A.gfx() !== gfxOf(lastTheme)) { lastTheme = A.gfx(); g.setTheme(lastTheme); }
      if (g.i18n.lang !== lastLang) { lastLang = g.i18n.lang; if (A.lang() !== lastLang) A.setLang(lastLang); }
      else if (A.lang() !== lastLang) { lastLang = A.lang(); g.i18n.set(lastLang); }
      if (g.audio.enabled !== lastSound) { lastSound = g.audio.enabled; A.setSound(lastSound); }

      var m = A.mode(), sc = g._sceneName;
      if (sc !== 'play' && sc !== 'pause') {
        // игру запустили её собственным интерфейсом (кнопки уровней и т.п.) — движок следует за ней
        if (m === 'play' || m === 'sub') g.goto('play', { adopt: true });
        return;
      }
      if (sc === 'play') g.state.score = Math.floor(A.score()) || 0;
      if (m === 'gameover' || m === 'win') {
        g.state.score = Math.floor(A.score()) || 0;
        if (m === 'win') g.win(); else g.gameover();
      } else if (m === 'title') g.goto('title');
      else if (sc === 'play' && m === 'paused') g.goto('pause');
      else if (sc === 'pause' && m === 'paused') wasPaused = true;
      else if (sc === 'pause' && m === 'play') {
        if (wasPaused) g.goto('play', { adopt: true }); // игру сняли с паузы её собственным интерфейсом
        else { A.pause(); wasPaused = A.mode() === 'paused'; }
      }
    }

    g.start('title');
    global.requestAnimationFrame(sync);
    global.__arcadeHost = { g: g, adapter: A };
    return g;
  }

  /** Экранные кнопки → настоящие события клавиатуры (их разбирают движок и игра как обычные). */
  function bindKeyPad(rootSel) {
    var root = typeof rootSel === 'string' ? doc.querySelector(rootSel) : rootSel;
    if (!root) return;
    root.querySelectorAll('[data-code]').forEach(function (btn) {
      var code = btn.getAttribute('data-code'), key = btn.getAttribute('data-key') || code, held = false;
      var send = function (type) {
        var ev = new KeyboardEvent(type, { code: code, key: key, bubbles: true, cancelable: true });
        (doc.body || doc).dispatchEvent(ev);
      };
      var on = function (e) { e.preventDefault(); if (held) return; held = true; btn.classList.add('on'); send('keydown'); };
      var off = function (e) { e.preventDefault(); if (!held) return; held = false; btn.classList.remove('on'); send('keyup'); };
      btn.addEventListener('pointerdown', on); btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off); btn.addEventListener('pointerleave', off);
      btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
  }

  global.ArcadeHost = { mount: mount, bindKeyPad: bindKeyPad };
})(typeof window !== 'undefined' ? window : globalThis);
