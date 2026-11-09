/* ============================================================================
   DIGGER · main.js — сборка: цикл, ввод, настройки, события движка, debug-хеши
   Владелец: Lead. См. CONTRACT.md §6.5.
   ========================================================================== */
(function (global) {
  'use strict';
  var DG = global.DG = global.DG || {};
  var doc = global.document;

  /* ------------------------------- настройки ------------------------------ */
  var SET_KEY = 'digger.settings.v1';
  var HI_KEY = 'digger.hi.v1';

  var defaults = { gfx: 'classic', lang: 'ru', music: true, sfx: true, crt: true };
  var settings = { gfx: defaults.gfx, lang: defaults.lang, music: defaults.music, sfx: defaults.sfx, crt: defaults.crt };
  DG.settings = settings;

  function storeGet(key) {
    try { var raw = global.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try { global.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* file:// / приватный режим */ }
  }

  /* Графика при каждом запуске — ретро (8-бит), независимо от прошлой сессии.
     Переключение на «Неон» действует в текущей сессии; сохраняются только язык,
     музыка, звуки и CRT. */
  settings.gfx = 'classic';
  var saved = storeGet(SET_KEY);
  if (saved && typeof saved === 'object') {
    if (saved.lang === 'ru' || saved.lang === 'en') settings.lang = saved.lang;
    if (typeof saved.music === 'boolean') settings.music = saved.music;
    if (typeof saved.sfx === 'boolean') settings.sfx = saved.sfx;
    if (typeof saved.crt === 'boolean') settings.crt = saved.crt;
  }
  var hiscore = Math.max(0, (storeGet(HI_KEY) | 0));

  /* -------------------------------- DOM ----------------------------------- */
  var canvas = doc.getElementById('game');
  var stage = doc.getElementById('stage');
  var uiRoot = doc.getElementById('ui');
  var errBox = doc.getElementById('err');
  var testBox = doc.getElementById('testout');
  var ctx = canvas.getContext('2d', { alpha: false });

  function showError(err) {
    if (!errBox) return;
    errBox.style.display = 'block';
    errBox.textContent = 'DIGGER error:\n' + (err && (err.stack || err.message || String(err)));
  }
  global.addEventListener('error', function (ev) { showError(ev.error || ev.message); });
  global.addEventListener('unhandledrejection', function (ev) { showError(ev.reason); });

  var audio = DG.audio || null;
  function tryAudio(fn, arg) { if (!audio || typeof audio[fn] !== 'function') return; try { audio[fn](arg); } catch (e) { showError(e); } }

  /* ------------------------------ параметры -------------------------------- */
  var hash = (global.location.hash || '').replace(/^#/, '');
  var params = {};
  hash.split('&').forEach(function (part) {
    if (!part) return;
    var i = part.indexOf('=');
    var k = i < 0 ? part : part.slice(0, i);
    var v = i < 0 ? '' : decodeURIComponent(part.slice(i + 1));
    params[k] = v;
  });

  if (params.gfx === 'modern' || params.gfx === 'classic') settings.gfx = params.gfx;
  if (params.lang === 'ru' || params.lang === 'en') settings.lang = params.lang;
  if ('mute' in params) { settings.music = false; settings.sfx = false; }
  if (params.crt === '0') settings.crt = false;
  if (params.crt === '1') settings.crt = true;
  var shotMode = params.shot || null;
  var testMode = 'test' in params;
  var freeze = 'freeze' in params || shotMode || testMode;

  DG.i18n.setLang(settings.lang);

  /* ------------------------------- движок --------------------------------- */
  var seed = (Date.now() ^ ((global.Math.random() * 0x7fffffff) | 0)) >>> 0;
  var engine = DG.Game({
    seed: freeze ? 20240501 : seed,
    hiscore: hiscore,
    onEvent: onEngineEvent
  });
  DG.engine = engine;
  var S = engine.state;

  /* ------------------------------- аудио ---------------------------------- */
  var audioReady = false;
  var lastDigAt = 0;
  var currentMusic = null;

  function audioUnlock() {
    if (!audio) return;
    tryAudio('unlock');
    audioReady = !!(audio.isReady && audio.isReady());
    applyAudioSettings();
    if (!audioReady) return;
    if (currentMusic == null) setMusic(S.mode === 'title' ? 'title' : (S.bonus ? 'bonus' : 'game'));
  }

  function applyAudioSettings() {
    if (!audio) return;
    if (typeof audio.setMusicEnabled === 'function') tryAudio('setMusicEnabled', settings.music);
    if (typeof audio.setSfxEnabled === 'function') tryAudio('setSfxEnabled', settings.sfx);
    else if (typeof audio.setMuted === 'function') tryAudio('setMuted', !settings.music && !settings.sfx);
  }

  function setMusic(mode) {
    if (!audio) return;
    if (currentMusic === mode) return;
    currentMusic = mode;
    if (typeof audio.startMusic === 'function') tryAudio('startMusic', mode);
  }
  function stopMusic() {
    currentMusic = null;
    if (audio && typeof audio.stopMusic === 'function') tryAudio('stopMusic', 180);
  }

  function sfx(name) {
    if (!audio || !audioReady || !settings.sfx) return;
    tryAudio('sfx', name);
  }
  function sfxThrottled(name, ms) {
    var now = (global.performance ? global.performance.now() : Date.now());
    if (now - lastDigAt < ms) return;
    lastDigAt = now;
    sfx(name);
  }

  function onEngineEvent(type, data) {
    switch (type) {
      case 'dig': sfxThrottled('dig', 60); break;
      case 'gem': sfx('gem'); break;
      case 'gold': sfx('gold'); break;
      case 'bagPush': sfx('bag_push'); break;
      case 'bagWobble': sfx('bag_wobble'); break;
      case 'bagFall': sfx('bag_fall'); break;
      case 'bagBreak': sfx('bag_break'); break;
      case 'shoot': sfx('shoot'); break;
      case 'monsterDie': sfx('monster_die'); break;
      case 'squash': sfx('squash'); break;
      case 'cherry': sfx('cherry'); break;
      case 'bonusStart': sfx('bonus'); setMusic('bonus'); break;
      case 'bonusEnd': setMusic('game'); break;
      case 'eat': sfx('eat'); break;
      case 'playerDie': sfx('player_die'); setMusic('death'); break;
      case 'extraLife': sfx('extra_life'); break;
      case 'levelClear': sfx('level_clear'); setMusic('clear'); break;
      case 'levelStart':
        setMusic('game');
        if (audio && typeof audio.setGameTheme === 'function') tryAudio('setGameTheme', (data.level || S.level) % 2);
        break;
      case 'gameOver':
        setMusic('gameover');
        saveHiscore(data.hi);
        showGameOver(data);
        break;
      case 'pause': break;
      default: break;
    }
  }

  function saveHiscore(value) {
    var v = Math.max(hiscore, value | 0);
    if (v > hiscore) { hiscore = v; storeSet(HI_KEY, v); }
  }

  /* ------------------------------- UI ------------------------------------- */
  var panel = null;            // 'settings' | 'help' | 'about'
  var panelPausedGame = false;
  var lastScreen = '@none';

  function uiShow(name, data) {
    if (!DG.ui || typeof DG.ui.show !== 'function') return;
    try { DG.ui.show(name, data); } catch (e) { showError(e); }
  }
  function uiCurrent() {
    if (!DG.ui || typeof DG.ui.current !== 'function') return null;
    try { return DG.ui.current(); } catch (e) { return null; }
  }

  function initUI() {
    if (!DG.ui || typeof DG.ui.init !== 'function') return;
    DG.ui.init({
      getSettings: function () { return settings; },
      setSetting: function (key, value) { applySetting(key, value); },
      start: startGame,
      resume: resumeGame,
      restart: startGame,
      menu: goMenu,
      getHiscore: function () { return Math.max(hiscore, S.hi); },
      resetHi: function () { resetHiscore(); },
      openPanel: function (name) { openPanel(name); },
      closePanel: function () { closePanel(); }
    });
  }

  function openPanel(name) {
    if (S.mode === 'play' || S.mode === 'bonus' || S.mode === 'ready') {
      if (!S.paused) { engine.pause(true); panelPausedGame = true; }
    }
    panel = name;
    uiShow(name);
  }
  function closePanel() {
    panel = null;
    if (panelPausedGame) { panelPausedGame = false; engine.pause(false); }
    syncScreens(true);
  }

  function showGameOver(data) {
    panel = null;
    uiShow('gameover', {
      score: data.score,
      hi: Math.max(data.hi, hiscore),
      record: !!data.record,
      stats: data.stats || S.stats
    });
  }

  function syncScreens(force) {
    if (panel) { if (force) uiShow(panel); return; }
    var want = null, data = null;
    if (S.mode === 'title') want = 'title';
    else if (S.paused) want = 'pause';
    else if (S.mode === 'gameover') {
      want = 'gameover';
      data = { score: S.score, hi: Math.max(hiscore, S.hi), record: false, stats: S.stats };
    }
    if (want === null) {
      if (lastScreen !== null) { uiShow(null); lastScreen = null; }
      return;
    }
    var key = want + '|' + (data ? data.score : '');
    if (force || key !== lastScreen) {
      lastScreen = key;
      uiShow(want, data);
    }
  }

  /* ----------------------------- настройки -------------------------------- */
  function syncBodyClasses() {
    var body = doc.body;
    body.classList.remove('gfx-classic', 'gfx-modern');
    body.classList.add('gfx-' + settings.gfx);
    body.classList.toggle('crt-on', !!settings.crt);
    body.classList.toggle('lang-ru', settings.lang === 'ru');
    body.classList.toggle('lang-en', settings.lang === 'en');
  }

  function applySetting(key, value) {
    if (key === 'lang') {
      settings.lang = value === 'en' ? 'en' : 'ru';
      DG.i18n.setLang(settings.lang);
      doc.documentElement.setAttribute('lang', settings.lang);
    } else if (key === 'gfx') {
      settings.gfx = value === 'modern' ? 'modern' : 'classic';
    } else if (key === 'music') {
      settings.music = !!value;
      applyAudioSettings();
      if (settings.music && !audioReady) audioUnlock();
    } else if (key === 'sfx') {
      settings.sfx = !!value;
    } else if (key === 'crt') {
      settings.crt = !!value;
    } else if (key === 'resetHi') {
      resetHiscore();
    }
    syncBodyClasses();
    persistSettings();
    if (DG.ui && typeof DG.ui.refresh === 'function') {
      try { DG.ui.refresh(); } catch (e) { showError(e); }
    }
  }
  DG.applySetting = applySetting;

  function resetHiscore() {
    hiscore = 0;
    engine.resetHi(0);
    storeSet(HI_KEY, 0);
  }

  function persistSettings() {
    storeSet(SET_KEY, {
      lang: settings.lang,
      music: settings.music,
      sfx: settings.sfx,
      crt: settings.crt
    });
  }
  function saveSettings() { persistSettings(); }

  /* ----------------------------- управление ------------------------------- */
  var DIR_KEYS = {
    ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1,
    ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3
  };
  var dirStack = [];
  var lastSentDir = -2;
  var shootHeld = false;
  var started = false;

  function currentDir() { return dirStack.length ? dirStack[dirStack.length - 1].dir : -1; }

  function pushDir(code, dir) {
    for (var i = 0; i < dirStack.length; i++) if (dirStack[i].code === code) return;
    dirStack.push({ code: code, dir: dir });
  }
  function popDir(code) {
    for (var i = dirStack.length - 1; i >= 0; i--) if (dirStack[i].code === code) { dirStack.splice(i, 1); return; }
  }

  function startGame() {
    audioUnlock();
    panel = null;
    panelPausedGame = false;
    engine.start();
    syncScreens(true);
    setMusic('game');
  }
  function resumeGame() {
    panel = null;
    if (S.paused) engine.pause(false);
    syncScreens(true);
    setMusic(S.bonus ? 'bonus' : 'game');
  }
  function goMenu() {
    panel = null;
    panelPausedGame = false;
    engine.toTitle();
    syncScreens(true);
    setMusic('title');
    if (audio && typeof audio.setGameTheme === 'function') tryAudio('setGameTheme', 0);
  }
  function togglePause() {
    if (S.mode !== 'play' && S.mode !== 'bonus' && S.mode !== 'ready') return;
    engine.togglePause();
    if (S.paused) stopMusic(); else setMusic(S.bonus ? 'bonus' : 'game');
    syncScreens(true);
  }

  function toggleFullscreen() {
    try {
      if (!doc.fullscreenElement) {
        if (stage.requestFullscreen) stage.requestFullscreen();
        else if (doc.documentElement.requestFullscreen) doc.documentElement.requestFullscreen();
      } else if (doc.exitFullscreen) doc.exitFullscreen();
    } catch (e) { /* игнор */ }
  }

  function onKeyDown(e) {
    if (e.repeat) {
      if (e.code === 'Space' && (S.mode === 'play' || S.mode === 'bonus')) e.preventDefault();
      return;
    }
    audioUnlock();
    var code = e.code;
    if (code in DIR_KEYS) {
      e.preventDefault();
      pushDir(code, DIR_KEYS[code]);
      return;
    }
    if (code === 'Space') {
      e.preventDefault();
      shootHeld = true;
      return;
    }
    if (code === 'Enter' || code === 'NumpadEnter') {
      e.preventDefault();
      if (panel) { if (DG.ui && DG.ui.activate) DG.ui.activate(); return; }
      if (S.mode === 'title') { startGame(); return; }
      if (S.mode === 'gameover') { startGame(); return; }
      if (S.paused) { resumeGame(); return; }
      return;
    }
    if (code === 'Escape') {
      e.preventDefault();
      if (panel) { closePanel(); return; }
      if (S.mode === 'title') return;
      if (S.mode === 'gameover') { goMenu(); return; }
      togglePause();
      return;
    }
    if (code === 'KeyP') { e.preventDefault(); if (panel) closePanel(); else togglePause(); return; }
    if (code === 'KeyL') { e.preventDefault(); applySetting('lang', settings.lang === 'ru' ? 'en' : 'ru'); return; }
    if (code === 'KeyM') { e.preventDefault(); applySetting('music', !settings.music); return; }
    if (code === 'KeyK') { e.preventDefault(); applySetting('sfx', !settings.sfx); return; }
    if (code === 'KeyG') { e.preventDefault(); applySetting('gfx', settings.gfx === 'classic' ? 'modern' : 'classic'); return; }
    if (code === 'KeyC') { e.preventDefault(); applySetting('crt', !settings.crt); return; }
    if (code === 'KeyH') { e.preventDefault(); if (panel === 'help') closePanel(); else openPanel('help'); return; }
    if (code === 'KeyR') {
      e.preventDefault();
      if (S.mode === 'gameover' || S.mode === 'play' || S.mode === 'bonus' || S.mode === 'paused' || S.mode === 'ready') startGame();
      return;
    }
    if (code === 'KeyF') { e.preventDefault(); toggleFullscreen(); return; }
  }

  function onKeyUp(e) {
    var code = e.code;
    if (code in DIR_KEYS) { e.preventDefault(); popDir(code); return; }
    if (code === 'Space') { shootHeld = false; }
  }

  global.addEventListener('keydown', onKeyDown, { passive: false });
  global.addEventListener('keyup', onKeyUp, { passive: false });

  /* --------------------------- касания/свайпы ----------------------------- */
  var touchState = null;
  function onPointerDown(e) {
    if (e.pointerType === 'mouse') return;
    audioUnlock();
    touchState = { x: e.clientX, y: e.clientY, moved: false };
  }
  function onPointerMove(e) {
    if (!touchState) return;
    var dx = e.clientX - touchState.x;
    var dy = e.clientY - touchState.y;
    if (Math.abs(dx) < 26 && Math.abs(dy) < 26) return;
    var dir;
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 1 : 3;
    else dir = dy > 0 ? 2 : 0;
    engine.setDir(dir);
    dirStack = [{ code: '@touch', dir: dir }];
    touchState = null;
    e.preventDefault();
  }
  function onPointerUp(e) {
    if (!touchState) return;
    var wasTap = !touchState.moved;
    touchState = null;
    if (wasTap) {
      if (S.mode === 'title') { audioUnlock(); return; }
      engine.shoot();
    }
  }
  var touchArea = stage || canvas;
  function inUiPanel(target) {
    return !!(uiRoot && target && target.closest && target.closest('#ui'));
  }
  if (touchArea) {
    touchArea.addEventListener('pointerdown', function (e) {
      if (inUiPanel(e.target)) return;
      onPointerDown(e);
    }, { passive: true });
    touchArea.addEventListener('pointermove', function (e) {
      if (inUiPanel(e.target)) return;
      onPointerMove(e);
    }, { passive: false });
    touchArea.addEventListener('pointerup', function (e) {
      if (inUiPanel(e.target)) return;
      onPointerUp(e);
    }, { passive: true });
  }
  global.addEventListener('pointerdown', function () { audioUnlock(); }, { passive: true });
  global.addEventListener('touchstart', function () { audioUnlock(); }, { passive: true });

  /* ------------------------------- рендер --------------------------------- */
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    var renderer = DG.render && DG.render[settings.gfx];
    if (renderer && typeof renderer.draw === 'function') {
      try { renderer.draw(ctx, S); return; }
      catch (e) { showError(e); }
    }
    ctx.fillStyle = '#0a0d18';
    ctx.fillRect(0, 0, 960, 600);
    ctx.fillStyle = '#7dd3fc';
    ctx.font = '600 28px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DIGGER · renderer "' + settings.gfx + '" is not loaded', 480, 300);
    ctx.textAlign = 'left';
  }

  function tick(dt) {
    // ввод направления: движку отправляем только изменения
    var dir = currentDir();
    if (dir !== lastSentDir) {
      engine.setDir(dir);
      lastSentDir = dir;
    }
    if (shootHeld && (S.mode === 'play' || S.mode === 'bonus')) engine.shoot();
    engine.update(dt);
    syncScreens();
  }

  var lastTs = 0;
  var running = true;

  function frame(ts) {
    if (!running) return;
    var now = ts / 1000;
    var dt = lastTs ? Math.min(0.05, now - lastTs) : 1 / 60;
    lastTs = now;
    tick(dt);
    draw();
    global.requestAnimationFrame(frame);
  }

  /* ------------------------------- boot ----------------------------------- */
  function setupShot(name) {
    var level = Math.max(1, parseInt(params.level || '2', 10) || 2);
    var steps = 0;
    function advance(seconds) {
      var n = Math.round(seconds * 60);
      for (var i = 0; i < n; i++) { engine.update(1 / 60); steps++; }
    }
    engine.setLevel(level);
    if (name === 'title') {
      engine.toTitle();
    } else if (name === 'gameover') {
      S.score = Math.max(12450, level * 3200);
      S.lives = 0;
      engine.forceMode('gameover');
      showGameOver({ score: S.score, hi: Math.max(S.hi, 25000), record: false, stats: S.stats });
    } else if (name === 'help' || name === 'settings' || name === 'about') {
      engine.forceMode('play');
      advance(0.7);
      if (name === 'help') openPanel('help');
      else if (name === 'settings') openPanel('settings');
      else openPanel('about');
    } else if (name === 'pause') {
      engine.forceMode('play');
      advance(0.9);
      engine.pause(true);
      syncScreens(true);
    } else if (name === 'ready') {
      engine.setLevel(level);
      S.mode = 'ready';
      S.readyT = 1.2;
      advance(0.25);
    } else if (name === 'levelclear') {
      engine.forceMode('play');
      advance(0.7);
      engine.forceMode('levelclear');
      advance(0.35);
    } else if (name === 'bonus') {
      engine.forceMode('play');
      advance(0.8);
      engine.forceMode('bonus');
      advance(0.45);
    } else if (name === 'dying') {
      engine.forceMode('play');
      advance(0.6);
      engine.forceMode('dying');
      advance(0.35);
    } else {
      engine.forceMode('play');
      advance(1.1);
    }
    syncScreens(true);
    draw();
    if (testBox) testBox.style.display = 'none';
  }

  /* ------------------------------ self-tests ------------------------------ */
  function runSelfTests() {
    var results = [];
    function t(name, fn) {
      try {
        var res = fn();
        results.push({ name: name, ok: !!res, detail: '' });
      } catch (e) {
        results.push({ name: name, ok: false, detail: (e && e.message) || String(e) });
      }
    }
    var g = DG.Game({ seed: 11 });
    t('engine/state fields', function () {
      return g.state && g.state.grid && g.state.grid.length === 150 && g.state.player && g.state.stats;
    });
    t('level: gems and bags', function () {
      g.setLevel(2);
      return g.state.gemsLeft > 0 && g.state.items.some(function (i) { return i.type === 'bag'; });
    });
    t('level: player stands in tunnel', function () {
      var p = g.state.player;
      return g.state.grid[p.cy * 15 + p.cx] === 1;
    });
    t('level: monster spawn is tunnel', function () { return g.state.grid[14] === 1; });
    t('level: deterministic seed', function () {
      var a = DG.Game({ seed: 5 }).state, b = DG.Game({ seed: 5 }).state;
      for (var i = 0; i < 150; i++) if (a.grid[i] !== b.grid[i]) return false;
      return true;
    });
    t('digging removes dirt', function () {
      var e = DG.Game({ seed: 3 }); e.start(); e.state.mode = 'play';
      var p = e.state.player, before = 0, i;
      for (i = 0; i < 150; i++) if (e.state.grid[i] === 0) before++;
      var dirs = [0, 1, 2, 3];
      for (i = 0; i < 4; i++) e.setDir(dirs[i]);
      for (i = 0; i < 30; i++) e.update(1 / 60);
      var after = 0;
      for (i = 0; i < 150; i++) if (e.state.grid[i] === 0) after++;
      return after < before;
    });
    t('shooting creates bullet', function () {
      var e = DG.Game({ seed: 4 }); e.start(); e.state.mode = 'play'; e.state.readyT = 0;
      e.state.player.shootCd = 0;
      e.shoot();
      return e.state.bullets.length > 0 || e.state.stats.shots > 0;
    });
    t('i18n ru/en', function () {
      return DG.t('score').length > 0 && DG.i18n.setLang('en') && DG.t('score') === 'SCORE' && DG.i18n.setLang('ru');
    });
    t('renderers registered', function () {
      return !!(DG.render && DG.render.classic && DG.render.classic.draw && DG.render.modern && DG.render.modern.draw);
    });
    t('ui api', function () { return !!(DG.ui && DG.ui.show && DG.ui.init && DG.ui.refresh); });
    t('audio api', function () { return !!(DG.audio && DG.audio.sfx && DG.audio.startMusic && DG.audio.unlock); });
    t('canvas 960x600', function () { return canvas.width === 960 && canvas.height === 600; });
    t('simulation 15s stays finite', function () {
      var e = DG.Game({ seed: 9 }); e.start();
      var r = DG.rng(3);
      for (var i = 0; i < 900; i++) {
        if (i % 17 === 0) e.setDir(Math.floor(r() * 4));
        if (i % 29 === 0) e.setDir(-1);
        if (i % 23 === 0) e.shoot();
        e.update(1 / 60);
        if (!isFinite(e.state.player.x) || !isFinite(e.state.player.y)) return false;
      }
      return true;
    });
    var passed = results.filter(function (r) { return r.ok; }).length;
    var lines = results.map(function (r) { return (r.ok ? 'PASS  ' : 'FAIL  ') + r.name + (r.detail ? '  — ' + r.detail : ''); });
    var report = 'DIGGER TESTS ' + passed + '/' + results.length + (passed === results.length ? ' PASS' : ' FAIL');
    doc.title = report;
    if (testBox) { testBox.style.display = 'block'; testBox.textContent = lines.join('\n') + '\n\n' + report; }
    return passed === results.length;
  }

  function boot() {
    doc.documentElement.setAttribute('lang', settings.lang);
    syncBodyClasses();
    if ('nofx' in params) doc.body.classList.add('shot');
    initUI();
    if (audio && typeof audio.setVolume === 'function') { try { audio.setVolume(0.6); } catch (e) {} }
    applyAudioSettings();

    if (testMode) {
      running = false;
      runSelfTests();
      draw();
      return;
    }
    if (shotMode) {
      doc.body.classList.add('shot');
      running = false;
      setupShot(shotMode);
      return;
    }

    syncScreens(true);
    if (S.mode === 'title' && DG.ui) uiShow('title');
    global.requestAnimationFrame(function (ts) { lastTs = ts / 1000; global.requestAnimationFrame(frame); });
    global.addEventListener('blur', function () {
      if (S.mode === 'play' || S.mode === 'bonus') { if (!S.paused) { engine.pause(true); stopMusic(); syncScreens(true); } }
    });
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden && (S.mode === 'play' || S.mode === 'bonus') && !S.paused) {
        engine.pause(true); stopMusic(); syncScreens(true);
      }
    });
    global.addEventListener('pagehide', function () { saveHiscore(S.hi); saveSettings(); });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
