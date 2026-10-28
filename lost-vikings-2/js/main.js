/* ==========================================================================
   LOST VIKINGS 2 · NORSE BY NORSEWEST — склейка
   Экраны, ввод, музыка, localStorage, фиксированный цикл 60 Гц.
   ========================================================================== */
(function () {
  'use strict';

  var LV = window.LV = window.LV || {};
  var STEP = 1 / 60;
  var LS = {
    mode: 'lv2.mode',
    lang: 'lv2.lang',
    muted: 'lv2.muted',
    progress: 'lv2.progress'
  };

  var state = {
    mode: 'retro',
    lang: 'ru',
    muted: false,
    screen: 'title',
    progress: { unlocked: 1, levels: {} },
    pendingStats: null,
    completeTimer: 0,
    runStarted: false
  };

  var game = null;
  var render = null;
  var ui = null;
  var audio = null;
  var canvas = null;

  var lastTime = 0;
  var acc = 0;
  var hudTimer = 0;
  var prevScreen = 'title';

  /* ------------------------------------------------------------------ ввод */

  var input = LV.input = {
    left: false, right: false, up: false, down: false,
    jump: false, action: false, special: false, hook: false,
    set: function (name, down) {
      if (name in input) input[name] = !!down;
    },
    clear: function () {
      input.left = input.right = input.up = input.down = false;
      input.jump = input.action = input.special = input.hook = false;
    }
  };

  function readStorage(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeStorage(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* приватный режим */ }
  }

  function loadSettings() {
    var m = readStorage(LS.mode);
    if (m === 'aurora' || m === 'retro') state.mode = m;
    var l = readStorage(LS.lang);
    if (l === 'ru' || l === 'en') state.lang = l;
    var mu = readStorage(LS.muted);
    if (mu === '1') state.muted = true;
    var p = readStorage(LS.progress);
    if (p) {
      try {
        var parsed = JSON.parse(p);
        if (parsed && typeof parsed.unlocked === 'number') {
          state.progress.unlocked = Math.max(1, Math.min(6, parsed.unlocked));
        }
        if (parsed && parsed.levels && typeof parsed.levels === 'object') {
          state.progress.levels = parsed.levels;
        }
      } catch (e) { /* повреждённое сохранение игнорируем */ }
    }
  }

  function saveProgress() {
    writeStorage(LS.mode, state.mode);
    writeStorage(LS.lang, state.lang);
    writeStorage(LS.muted, state.muted ? '1' : '0');
    writeStorage(LS.progress, JSON.stringify(state.progress));
  }

  function t(key, vars) {
    if (LV.i18n && LV.i18n.t) return LV.i18n.t(key, vars);
    return key;
  }

  function langText(ru, en) {
    return state.lang === 'en' ? (en || ru) : (ru || en);
  }

  /* ------------------------------------------------------------------ поток */

  function setScreen(name, data) {
    state.screen = name;
    document.body.setAttribute('data-screen', name);
    if (ui && ui.screen) ui.screen(name, data || {});
  }

  function hasProgress() {
    return state.progress.unlocked > 1 || Object.keys(state.progress.levels).length > 0;
  }

  function titleData() {
    return {
      hasProgress: hasProgress(),
      unlocked: state.progress.unlocked,
      mode: state.mode,
      lang: state.lang,
      muted: state.muted
    };
  }

  function briefData(index) {
    var levels = LV.LEVELS || [];
    var lv = levels[index] || levels[0] || {};
    return {
      index: index,
      levelCount: levels.length,
      name: lv.name || '',
      nameEn: lv.nameEn || '',
      hint: lv.hint || '',
      hintEn: lv.hintEn || '',
      music: lv.music || 0,
      mode: state.mode,
      lang: state.lang,
      stats: state.progress.levels[index] || null
    };
  }

  function startLevel(index) {
    if (!game) return;
    var levels = LV.LEVELS || [];
    if (!levels.length) {
      ui.toast('Нет уровней: js/levels.js не загрузился', { tone: 'warn', duration: 8000 });
      return;
    }
    index = Math.max(0, Math.min(levels.length - 1, index | 0));
    state.pendingStats = null;
    state.completeTimer = 0;
    game.loadLevel(index);
    setScreen('brief', briefData(index));
  }

  function beginLevel() {
    if (!game) return;
    if (state.screen !== 'brief') return;
    game.resume();
    input.clear();
    setScreen('play');
    updateHud(true);
    if (audio) {
      audio.unlock();
      var lv = game.level || {};
      var track = Math.max(0, Math.min(2, lv.music || 0));
      audio.playMusic('game' + track);
    }
  }

  function newGame() {
    if (!game) return;
    state.runStarted = true;
    state.pendingStats = null;
    state.completeTimer = 0;
    game.deaths = 0;
    game.levelDeaths = 0;
    game.runScore = 0;
    game.levelStartScore = 0;
    startLevel(0);
  }

  function continueGame() {
    startLevel(Math.max(0, state.progress.unlocked - 1));
  }

  function pauseGame() {
    if (!game || state.screen !== 'play') return;
    game.pause();
    input.clear();
    prevScreen = 'play';
    setScreen('pause', {
      levelIndex: game.levelIndex,
      levelCount: (LV.LEVELS || []).length,
      name: game.level ? game.level.name : '',
      nameEn: game.level ? game.level.nameEn : ''
    });
    if (audio) audio.pauseMusic();
  }

  function resumeGame() {
    if (!game || state.screen !== 'pause') return;
    game.resume();
    input.clear();
    setScreen('play');
    if (audio) audio.resumeMusic();
  }

  function restartLevel() {
    if (!game) return;
    game.runScore = game.levelStartScore;
    game.restartLevel();
    state.pendingStats = null;
    state.completeTimer = 0;
    input.clear();
    setScreen('play');
    updateHud(true);
    if (audio) {
      audio.unlock();
      var lv = game.level || {};
      audio.playMusic('game' + Math.max(0, Math.min(2, lv.music || 0)));
    }
  }

  function replayLevel() {
    if (!game) return;
    game.runScore = game.levelStartScore;
    game.loadLevel(game.levelIndex);
    state.pendingStats = null;
    state.completeTimer = 0;
    beginLevelFromLoaded();
  }

  function beginLevelFromLoaded() {
    game.resume();
    input.clear();
    setScreen('play');
    updateHud(true);
    if (audio) {
      audio.unlock();
      var lv = game.level || {};
      audio.playMusic('game' + Math.max(0, Math.min(2, lv.music || 0)));
    }
  }

  function nextLevel() {
    if (!game) return;
    var next = game.levelIndex + 1;
    if (next >= (LV.LEVELS || []).length) {
      showEnding();
      return;
    }
    state.pendingStats = null;
    startLevel(next);
  }

  function quitToTitle() {
    if (!game) return;
    game.pause();
    input.clear();
    prevScreen = 'title';
    setScreen('title', titleData());
    if (audio) audio.playMusic('title');
    updateSaveInfo();
  }

  function showEnding() {
    var levels = LV.LEVELS || [];
    var total = { runes: 0, runesTotal: levels.length * 3, time: 0, deaths: 0, score: 0, levels: [] };
    for (var i = 0; i < levels.length; i++) {
      var st = state.progress.levels[i] || {};
      total.runes += st.runes || 0;
      total.time += st.time || 0;
      total.deaths += st.deaths || 0;
      total.score += st.score || 0;
      total.levels.push({
        index: i,
        name: levels[i].name,
        nameEn: levels[i].nameEn,
        runes: st.runes || 0,
        time: st.time || 0,
        deaths: st.deaths || 0,
        score: st.score || 0,
        done: !!st.done
      });
    }
    if (state.pendingStats && state.pendingStats.totalScore > total.score) {
      total.score = state.pendingStats.totalScore;
    }
    setScreen('ending', total);
    if (audio) {
      audio.stopMusic(0.5);
      audio.playMusic('ending');
    }
    updateSaveInfo();
  }

  function openHelp() {
    if (state.screen === 'help') return;
    prevScreen = state.screen;
    setScreen('help');
  }

  function closeHelp() {
    if (state.screen !== 'help') return;
    var back = prevScreen || 'title';
    if (back === 'play') setScreen('play');
    else setScreen(back, back === 'title' ? titleData() : (back === 'pause' ? {} : {}));
  }

  /* ------------------------------------------------------------- завершение */

  function handleComplete(stats) {
    state.pendingStats = stats;
    state.completeTimer = 1.15;
    var idx = stats.levelIndex;
    var prev = state.progress.levels[idx] || {};
    state.progress.levels[idx] = {
      done: true,
      runes: Math.max(prev.runes || 0, stats.runes),
      time: prev.time ? Math.min(prev.time, stats.time) : stats.time,
      deaths: Math.min(prev.deaths === undefined ? 999 : prev.deaths, stats.deaths),
      score: Math.max(prev.score || 0, stats.score)
    };
    var unlocked = Math.min((LV.LEVELS || []).length, idx + 2);
    if (unlocked > state.progress.unlocked) state.progress.unlocked = unlocked;
    saveProgress();
    if (audio) {
      audio.stopMusic(0.4);
      audio.sfx('win');
    }
  }

  function showCompleteScreen() {
    setScreen('complete', state.pendingStats || {});
    updateSaveInfo();
  }

  /* ------------------------------------------------------------- настройки */

  function applyMode() {
    document.body.classList.remove('mode-aurora', 'mode-retro');
    document.body.classList.add('mode-' + state.mode);
    if (render && render.setMode) render.setMode(state.mode);
    if (ui && ui.setMode) ui.setMode(state.mode);
  }

  function toggleGraphics() {
    state.mode = state.mode === 'aurora' ? 'retro' : 'aurora';
    applyMode();
    saveProgress();
    if (audio) audio.sfx('uiClick');
  }

  function toggleLang() {
    state.lang = state.lang === 'ru' ? 'en' : 'ru';
    document.documentElement.lang = state.lang;
    if (ui && ui.setLang) ui.setLang(state.lang);
    saveProgress();
    if (audio) audio.sfx('uiClick');
  }

  function toggleMute() {
    state.muted = !state.muted;
    if (audio) {
      audio.unlock();
      audio.setMuted(state.muted);
    }
    if (ui && ui.setMuted) ui.setMuted(state.muted);
    saveProgress();
  }

  function updateSaveInfo() {
    if (ui && ui.setSaveInfo) {
      ui.setSaveInfo({ unlocked: state.progress.unlocked, hasProgress: hasProgress() });
    }
  }

  function updateHud(force) {
    if (!ui || !ui.updateHud || !game) return;
    ui.updateHud(game.getUIState());
  }

  /* ------------------------------------------------------------- события */

  function handleEvent(ev) {
    if (!ev || !ev.type) return;
    if (ev.type === 'toast') {
      if (ui && ui.toast) ui.toast(ev.text, { tone: ev.tone || 'info', duration: 5200 });
      return;
    }
    if (audio && audio.sfx && ev.type !== 'levelComplete') audio.sfx(ev.type);
    if (render && render.addFx) render.addFx(ev);
    if (ev.type === 'rune' || ev.type === 'switch' || ev.type === 'hurt' ||
        ev.type === 'death' || ev.type === 'respawn' || ev.type === 'checkpoint') {
      updateHud(true);
    }
  }

  /* ------------------------------------------------------------- клавиатура */

  function isPlayKey(code) {
    return code === 'ArrowLeft' || code === 'ArrowRight' || code === 'ArrowUp' ||
      code === 'ArrowDown' || code === 'Space' || code === 'Tab' ||
      code === 'KeyA' || code === 'KeyD' || code === 'KeyW' || code === 'KeyS' ||
      code === 'KeyJ' || code === 'KeyK' || code === 'KeyL' ||
      code === 'Digit1' || code === 'Digit2' || code === 'Digit3';
  }

  function mapKey(code, down) {
    switch (code) {
      case 'ArrowLeft': case 'KeyA': input.set('left', down); return true;
      case 'ArrowRight': case 'KeyD': input.set('right', down); return true;
      case 'ArrowUp': case 'KeyW': input.set('up', down); return true;
      case 'ArrowDown': case 'KeyS': input.set('down', down); return true;
      case 'Space': input.set('jump', down); return true;
      case 'KeyJ': input.set('action', down); return true;
      case 'KeyK': input.set('special', down); return true;
      case 'KeyL': input.set('hook', down); return true;
      default: return false;
    }
  }

  function onKeyDown(e) {
    var code = e.code || '';
    if (isPlayKey(code)) e.preventDefault();
    if (audio) audio.unlock();

    if (code === 'KeyG') { toggleGraphics(); return; }
    if (code === 'KeyM') { toggleMute(); return; }
    if (code === 'KeyY') { toggleLang(); return; }

    if (code === 'Escape' || code === 'KeyP') {
      if (state.screen === 'help') { closeHelp(); return; }
      if (state.screen === 'play') { pauseGame(); return; }
      if (state.screen === 'pause') { resumeGame(); return; }
      return;
    }

    if (state.screen !== 'play' || !game) return;

    if (code === 'KeyR') { restartLevel(); return; }
    if (code === 'KeyH') {
      var lv = game.level;
      if (lv && ui) ui.toast(langText(lv.hint, lv.hintEn), { tone: 'info', duration: 7000 });
      return;
    }
    if (code === 'Digit1') { game.switchTo('erik'); return; }
    if (code === 'Digit2') { game.switchTo('baleog'); return; }
    if (code === 'Digit3') { game.switchTo('olaf'); return; }
    if (code === 'Tab') { e.preventDefault(); game.nextActor(); return; }
    mapKey(code, true);
  }

  function onKeyUp(e) {
    var code = e.code || '';
    if (isPlayKey(code)) e.preventDefault();
    mapKey(code, false);
  }

  function bindKeys() {
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp, { passive: false });
    window.addEventListener('blur', function () {
      input.clear();
      if (state.screen === 'play' && game && game.time > 0.8) pauseGame();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && state.screen === 'play') pauseGame();
    });
  }

  function bindGestures() {
    function unlock() {
      if (audio) audio.unlock();
    }
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  /* ------------------------------------------------------------- цикл */

  function loop(ts) {
    var dt = lastTime ? (ts - lastTime) / 1000 : 0;
    lastTime = ts;
    if (dt > 0.25) dt = 0.25;

    if (state.screen === 'play' && game) {
      acc += dt;
      var steps = 0;
      while (acc >= STEP && steps < 5) {
        game.update(STEP);
        acc -= STEP;
        steps++;
      }
      if (steps === 5) acc = 0;
    } else {
      acc = 0;
    }

    if (render && game && game.world) {
      try { render.draw(game, dt); } catch (err) { /* не роняем цикл */ }
    }

    hudTimer += dt;
    if (hudTimer >= 0.09) {
      hudTimer = 0;
      if (state.screen === 'play') updateHud();
    }

    if (state.completeTimer > 0) {
      state.completeTimer -= dt;
      if (state.completeTimer <= 0) {
        state.completeTimer = 0;
        showCompleteScreen();
      }
    }

    requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------- отладка */

  function parseQuery() {
    var out = {};
    try {
      var q = window.location.search.replace(/^\?/, '');
      if (!q) return out;
      var parts = q.split('&');
      for (var i = 0; i < parts.length; i++) {
        var kv = parts[i].split('=');
        out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
      }
    } catch (e) { /* noop */ }
    return out;
  }

  function applyDebugQuery() {
    var q = parseQuery();
    if (q.mode === 'retro' || q.mode === 'aurora') {
      state.mode = q.mode;
      applyMode();
    }
    if (q.lang === 'ru' || q.lang === 'en') {
      state.lang = q.lang;
      document.documentElement.lang = q.lang;
      if (ui && ui.setLang) ui.setLang(q.lang);
    }
    if (q.level) {
      var idx = parseInt(q.level, 10) - 1;
      if (!isNaN(idx)) {
        idx = Math.max(0, Math.min((LV.LEVELS || []).length - 1, idx));
        state.pendingStats = null;
        game.loadLevel(idx);
        game.resume();
        setScreen('play');
        updateHud(true);
        if (audio) audio.playMusic('game' + Math.max(0, Math.min(2, (game.level.music || 0))));
      }
    } else if (q.screen === 'levels') {
      setScreen('levels', {
        unlocked: state.progress.unlocked,
        levels: (LV.LEVELS || []).map(function (lv, i) {
          return {
            index: i, name: lv.name, nameEn: lv.nameEn,
            stats: state.progress.levels[i] || null
          };
        })
      });
    }
  }

  /* ------------------------------------------------------------- загрузка */

  function boot() {
    loadSettings();
    document.documentElement.lang = state.lang;

    if (!LV.LEVELS || !LV.LEVELS.length) {
      // Уровни ещё не подключены — покажем честную заглушку.
      document.body.setAttribute('data-screen', 'title');
      var msg = document.createElement('div');
      msg.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:#05070f;color:#eaf6ff;font:16px system-ui;padding:24px;text-align:center;z-index:9999';
      msg.textContent = 'LOST VIKINGS 2: не загрузились уровни (js/levels.js).';
      document.body.appendChild(msg);
      return;
    }

    game = new LV.Game({
      levels: LV.LEVELS,
      onEvent: handleEvent,
      onLevelComplete: handleComplete
    });
    LV.game = game;
    game.setInput(input);

    canvas = document.getElementById('game');
    if (canvas && LV.render && LV.render.init) {
      render = LV.render;
      render.init(canvas);
    }
    audio = LV.audio || null;
    ui = LV.ui || null;

    if (ui && ui.init) {
      ui.init({
        callbacks: {
          onStartNew: newGame,
          onContinue: continueGame,
          onSelectLevel: function (i) {
            if (state.screen === 'brief' && game && game.levelIndex === i) beginLevel();
            else startLevel(i);
          },
          onBeginLevel: beginLevel,
          onResume: resumeGame,
          onRestart: restartLevel,
          onNextLevel: nextLevel,
          onReplay: replayLevel,
          onQuitToTitle: quitToTitle,
          onToggleGraphics: toggleGraphics,
          onToggleLang: toggleLang,
          onToggleMute: toggleMute,
          onOpenHelp: openHelp,
          onCloseHelp: closeHelp,
          onPause: pauseGame,
          onInput: function (action, down) { input.set(action, down); }
        },
        getState: function () { return game.getUIState(); }
      });
    }

    applyMode();
    if (ui) {
      if (ui.setLang) ui.setLang(state.lang);
      if (ui.setMuted) ui.setMuted(state.muted);
      if (ui.setSaveInfo) ui.setSaveInfo({ unlocked: state.progress.unlocked, hasProgress: hasProgress() });
    }
    if (audio) {
      if (audio.setMuted) audio.setMuted(state.muted);
      if (audio.setVolume) audio.setVolume(0.9);
      audio.playMusic('title');
    }

    bindKeys();
    bindGestures();
    setScreen('title', titleData());

    window.addEventListener('resize', function () {
      if (render && render.resize) render.resize();
    });

    applyDebugQuery();

    LV.main = {
      boot: boot,
      toggleGraphics: toggleGraphics,
      toggleLang: toggleLang,
      toggleMute: toggleMute,
      startLevel: function (i) { startLevel(i); beginLevelFromLoaded(); },
      showTitle: quitToTitle,
      state: state,
      game: function () { return game; }
    };
    LV.debug = {
      startLevel: function (i) {
        var idx = Math.max(0, Math.min((LV.LEVELS || []).length - 1, (i | 0) - 1));
        state.pendingStats = null;
        game.loadLevel(idx);
        game.resume();
        setScreen('play');
        updateHud(true);
      },
      setMode: function (m) {
        if (m === 'retro' || m === 'aurora') { state.mode = m; applyMode(); }
      },
      win: function () { if (game) game.debugWinLevel(); },
      state: function () { return game ? game.getDebugState() : null; },
      ui: function () { return ui; },
      screen: function (name, data) { setScreen(name, data); }
    };

    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
