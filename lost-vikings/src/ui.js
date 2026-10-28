/* LOST VIKINGS · UI — экраны, HUD, i18n, настройки, прогресс, ввод.
   Владелец: Lead. Контракт: CONTRACT.md §7. */
(function () {
  "use strict";

  var ORDER = ["erik", "baleog", "olaf"];
  var PREFS_KEY = "lv.prefs.v1";
  var PROG_KEY = "lv.progress.v1";
  var STORY_KEY = "lv.story.v1";

  var game = null, audio = null, levels = [], renderers = null, renderer = null;
  var app, stage, hud, screens = [], levelGrid, toastEl, touchpad;
  var dom = {};

  var UI = {
    screen: "title",
    returnScreen: "title",
    pendingLevel: 0,
    prefs: { lang: "ru", gfx: "modern", muted: false, volume: 80 },
    progress: { maxLevel: 0, completed: {}, best: {} },
    seenStory: false,
    lastComplete: null,
    deadKey: "dead.spikes",
    toastTimer: 0,
    portraitTimer: 0,
    started: false
  };

  /* ───────────────────────── storage ───────────────────────── */

  function readJSON(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v && typeof v === "object" ? v : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function loadPrefs() {
    var p = readJSON(PREFS_KEY, {});
    if (p.lang === "ru" || p.lang === "en") UI.prefs.lang = p.lang;
    if (p.gfx === "retro" || p.gfx === "modern") UI.prefs.gfx = p.gfx;
    if (typeof p.muted === "boolean") UI.prefs.muted = p.muted;
    if (typeof p.volume === "number") UI.prefs.volume = Math.max(0, Math.min(100, p.volume));
  }
  function savePrefs() { writeJSON(PREFS_KEY, UI.prefs); }
  function loadProgress() {
    var p = readJSON(PROG_KEY, {});
    if (typeof p.maxLevel === "number") UI.progress.maxLevel = Math.max(0, Math.min(levels.length - 1, p.maxLevel | 0));
    if (p.completed && typeof p.completed === "object") UI.progress.completed = p.completed;
    if (p.best && typeof p.best === "object") UI.progress.best = p.best;
    UI.seenStory = readJSON(STORY_KEY, { seen: false }).seen === true;
  }
  function saveProgress() { writeJSON(PROG_KEY, UI.progress); }
  function markStorySeen() {
    UI.seenStory = true;
    writeJSON(STORY_KEY, { seen: true });
  }

  /* ───────────────────────── helpers ───────────────────────── */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }
  function t(key, fallback) { return window.LV_T(key, fallback); }
  function lvlName(lv) { return window.LV_I18N.levelName(lv); }
  function lvlHint(lv) { return window.LV_I18N.levelHint(lv); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  function clampLevel(i) { return Math.max(0, Math.min(levels.length - 1, i | 0)); }
  function countTreasures(lv) {
    var n = 0, rows = (lv && lv.rows) || [];
    for (var y = 0; y < rows.length; y++) {
      for (var x = 0; x < rows[y].length; x++) if (rows[y].charAt(x) === "*") n++;
    }
    return n;
  }

  /* ───────────────────────── init ───────────────────────── */

  UI.init = function (opts) {
    game = opts.game;
    audio = opts.audio;
    levels = opts.levels || [];
    renderers = opts.renderers;

    app = document.getElementById("app");
    stage = document.getElementById("stage");
    hud = document.getElementById("hud");
    levelGrid = document.getElementById("level-grid");
    toastEl = document.getElementById("toast");
    touchpad = document.getElementById("touchpad");
    screens = $all(".screen");

    dom = {
      levelNum: document.getElementById("hud-levelnum"),
      levelName: document.getElementById("hud-levelname"),
      levelHint: document.getElementById("hud-levelhint"),
      treasure: document.getElementById("stat-treasure"),
      deaths: document.getElementById("stat-deaths"),
      time: document.getElementById("stat-time"),
      muteGlyph: document.getElementById("mute-glyph"),
      chipGfx: document.getElementById("chip-gfx"),
      chipLang: document.getElementById("chip-lang"),
      chipSound: document.getElementById("chip-sound"),
      btnContinue: document.getElementById("btn-continue"),
      continueHint: document.getElementById("menu-continue-hint"),
      introNum: document.getElementById("intro-num"),
      introTheme: document.getElementById("intro-theme"),
      introName: document.getElementById("intro-name"),
      introHint: document.getElementById("intro-hint"),
      introTreasures: document.getElementById("intro-treasures"),
      introDeaths: document.getElementById("intro-deaths"),
      introTime: document.getElementById("intro-time"),
      resultTime: document.getElementById("result-time"),
      resultTreasure: document.getElementById("result-treasure"),
      resultDeaths: document.getElementById("result-deaths"),
      resultScore: document.getElementById("result-score"),
      completeNote: document.getElementById("complete-note"),
      nextHint: document.getElementById("next-hint"),
      deadText: document.getElementById("dead-text"),
      deadCountdown: document.getElementById("dead-countdown"),
      finaleTime: document.getElementById("finale-time"),
      finaleTreasure: document.getElementById("finale-treasure"),
      finaleDeaths: document.getElementById("finale-deaths"),
      finaleScore: document.getElementById("finale-score"),
      volume: document.getElementById("volume"),
      volumeOut: document.getElementById("volume-out"),
      settingsMute: document.getElementById("settings-mute"),
      reset: document.getElementById("reset-progress")
    };

    loadPrefs();
    loadProgress();
    window.LV_I18N.setLang(UI.prefs.lang);
    app.dataset.lang = UI.prefs.lang;

    // инициализация рендереров (оба, чтобы переключение было мгновенным)
    [["retro", "cv-retro"], ["modern", "cv-modern"]].forEach(function (pair) {
      var r = renderers[pair[0]], c = document.getElementById(pair[1]);
      if (r && r.init) { try { r.init(c); } catch (e) { /* рендерер может быть заглушкой */ } }
    });

    bindGlobalEvents();
    bindMenuEvents();
    bindTouch();
    applyGfx(UI.prefs.gfx, true);
    applyI18n();
    updateChrome();
    buildLevelGrid();
    showScreen("title");
    redrawPortraits();
    if (audio) {
      try { audio.setMuted(UI.prefs.muted); audio.setVolume(UI.prefs.volume / 100); } catch (e) {}
    }
    UI.started = true;
  };

  /* ───────────────────────── экраны ───────────────────────── */

  function showScreen(name) {
    UI.screen = name;
    app.dataset.screen = name;
    screens.forEach(function (s) {
      s.classList.toggle("is-active", s.dataset.screen === name);
    });
    var inGame = name === "playing" || name === "pause" || name === "dead";
    if (hud) hud.hidden = !inGame;
    if (touchpad) touchpad.setAttribute("aria-hidden", name === "playing" ? "false" : "true");
    if (name === "playing" && game) updateHUD();
  }

  UI.isWorldVisible = function () {
    return UI.screen === "playing" || UI.screen === "pause" || UI.screen === "dead" || UI.screen === "complete";
  };
  UI.getRenderTarget = function () {
    var canvas = document.getElementById(UI.prefs.gfx === "retro" ? "cv-retro" : "cv-modern");
    return { renderer: renderer, canvas: canvas };
  };
  UI.getScreen = function () { return UI.screen; };

  /* ───────────────────────── i18n / chrome ───────────────────────── */

  function applyI18n() {
    window.LV_I18N.setLang(UI.prefs.lang);
    app.dataset.lang = UI.prefs.lang;
    document.documentElement.lang = UI.prefs.lang;
    $all("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var s = t(key);
      if (s && s !== key) el.textContent = s;
    });
    $all("[data-i18n-aria]").forEach(function (el) {
      var s = t(el.getAttribute("data-i18n-aria"));
      if (s) el.setAttribute("aria-label", s);
    });
    updateChips();
    updateSettingsUI();
    buildLevelGrid();
    if (UI.screen === "playing" || UI.screen === "pause" || UI.screen === "dead") updateHUD();
    if (UI.screen === "levelIntro") fillIntro(UI.pendingLevel);
    if (UI.screen === "dead") setText(dom.deadText, t(UI.deadKey));
    if (UI.screen === "complete" && UI.lastComplete) {
      setText(dom.completeNote, t("complete.note"));
      if (game && !game.isLastLevel()) {
        setText(dom.nextHint, t("levels.level") + " " + (UI.lastComplete.index + 2));
      }
    }
    updateContinueButton();
  }

  function updateChips() {
    setText(dom.chipGfx, t(UI.prefs.gfx === "retro" ? "settings.gfx.retro" : "settings.gfx.modern"));
    setText(dom.chipLang, UI.prefs.lang === "ru" ? "RU" : "EN");
    setText(dom.chipSound, t(UI.prefs.muted ? "chip.off" : "chip.on"));
    setText(dom.muteGlyph, UI.prefs.muted ? "⨯" : "♪");
  }

  function updateSettingsUI() {
    $all("[data-gfx-set]").forEach(function (b) {
      b.classList.toggle("is-selected", b.getAttribute("data-gfx-set") === UI.prefs.gfx);
    });
    $all("[data-lang-set]").forEach(function (b) {
      b.classList.toggle("is-selected", b.getAttribute("data-lang-set") === UI.prefs.lang);
    });
    if (dom.volume) dom.volume.value = String(UI.prefs.volume);
    setText(dom.volumeOut, UI.prefs.volume + "%");
    if (dom.settingsMute) {
      var label = dom.settingsMute.querySelector(".btn__label");
      if (label) label.textContent = t(UI.prefs.muted ? "settings.mute.on" : "settings.mute.toggle");
    }
  }

  function updateChrome() {
    updateChips();
    updateSettingsUI();
    if (hud) hud.hidden = !(UI.screen === "playing" || UI.screen === "pause" || UI.screen === "dead");
  }

  function updateContinueButton() {
    if (!dom.btnContinue) return;
    var can = UI.progress.maxLevel > 0 || UI.progress.completed[0] === 1;
    dom.btnContinue.hidden = !can;
    if (can) setText(dom.continueHint, t("levels.level") + " " + (UI.progress.maxLevel + 1));
  }

  /* ───────────────────────── HUD ───────────────────────── */

  function updateHUD() {
    if (!game) return;
    var st = game.state;
    var lv = game.getLevelInfo(st.levelIndex);
    setText(dom.levelNum, pad2(st.levelIndex + 1));
    setText(dom.levelName, lvlName(lv));
    setText(dom.levelHint, lvlHint(lv));
    setText(dom.treasure, st.treasuresTaken + "/" + st.treasuresTotal);
    setText(dom.deaths, String(st.levelDeaths));
    setText(dom.time, fmtTime(st.time));

    ORDER.forEach(function (id) {
      var tab = $('.viking-tab[data-char="' + id + '"]');
      var a = st.actors[id];
      if (!tab || !a) return;
      tab.classList.toggle("is-active", st.activeId === id);
      tab.classList.toggle("is-dead", !!a.dead);
      tab.classList.toggle("is-gone", !!a.gone);
      var stateEl = tab.querySelector(".viking-tab__state");
      if (stateEl) {
        var label = a.gone ? t("hud.gone") : a.dead ? t("hud.dead") : t("hud.ready");
        if (stateEl.textContent !== label) stateEl.textContent = label;
      }
    });
  }

  /* ───────────────────────── портреты ───────────────────────── */

  function redrawPortraits() {
    if (!renderer || !renderer.drawPortrait) return;
    var now = (window.performance && performance.now ? performance.now() : Date.now()) / 1000;
    $all("[data-portrait]").forEach(function (cv) {
      try { renderer.drawPortrait(cv, cv.getAttribute("data-portrait"), now); } catch (e) {}
    });
    $all("[data-portrait-big]").forEach(function (cv) {
      try { renderer.drawPortrait(cv, cv.getAttribute("data-portrait-big"), now); } catch (e) {}
    });
  }

  /* ───────────────────────── графика / язык / звук ───────────────────────── */

  function applyGfx(gfx, silent) {
    UI.prefs.gfx = gfx === "retro" ? "retro" : "modern";
    app.dataset.gfx = UI.prefs.gfx;
    renderer = renderers[UI.prefs.gfx] || renderers.modern;
    savePrefs();
    updateChips();
    redrawPortraits();
    if (!silent) {
      try { if (audio) audio.sfx("click"); } catch (e) {}
      showToast(t("toast.gfx"));
    }
  }
  UI.toggleGfx = function () { applyGfx(UI.prefs.gfx === "retro" ? "modern" : "retro"); };

  function applyLang(lang, silent) {
    UI.prefs.lang = lang === "en" ? "en" : "ru";
    savePrefs();
    applyI18n();
    if (!silent) {
      try { if (audio) audio.sfx("click"); } catch (e) {}
      showToast(t("toast.lang"));
    }
  }
  UI.toggleLang = function () { applyLang(UI.prefs.lang === "ru" ? "en" : "ru"); };

  function applyMute(silent) {
    UI.prefs.muted = !UI.prefs.muted;
    savePrefs();
    try {
      if (audio) {
        if (audio.setMuted) audio.setMuted(UI.prefs.muted);
        if (!UI.prefs.muted && audio.unlock) audio.unlock();
      }
    } catch (e) {}
    updateChips();
    updateSettingsUI();
    if (!silent) showToast(t(UI.prefs.muted ? "toast.muted" : "toast.unmuted"));
  }
  UI.toggleMute = function () { applyMute(); };

  function ensureAudio() {
    try {
      if (!audio) return;
      if (audio.unlock) audio.unlock();
      if (!UI.started || UI._audioStarted) return;
      UI._audioStarted = true;
      if (UI.screen === "title") audio.startMusic("title");
    } catch (e) {}
  }
  UI.ensureAudio = ensureAudio;

  /* ───────────────────────── меню / навигация ───────────────────────── */

  function startNewGame() {
    if (game) game.resetSession();
    if (!UI.seenStory) {
      markStorySeen();
      showScreen("story");
    } else {
      openLevelIntro(0);
    }
  }

  function openLevelIntro(index) {
    index = clampLevel(index);
    UI.pendingLevel = index;
    fillIntro(index);
    showScreen("levelIntro");
    try { if (audio) audio.startMusic("title"); } catch (e) {}
  }

  function fillIntro(index) {
    index = clampLevel(index);
    var lv = levels[index];
    if (!lv) return;
    setText(dom.introNum, pad2(index + 1));
    setText(dom.introTheme, t("theme." + (lv.theme || "cave")));
    setText(dom.introName, lvlName(lv));
    setText(dom.introHint, lvlHint(lv));
    setText(dom.introTreasures, String(countTreasures(lv)));
    setText(dom.introDeaths, "0");
    setText(dom.introTime, UI.progress.best[index] != null ? fmtTime(UI.progress.best[index]) : "0:00");
  }

  function beginLevel(index) {
    if (!game) return;
    game.startLevel(clampLevel(index));
    showScreen("playing");
    updateHUD();
  }

  function openPause() {
    if (!game) return;
    game.pause(true);
    showScreen("pause");
  }
  function resumeGame() {
    if (!game) return;
    game.pause(false);
    showScreen("playing");
  }
  function quitToTitle() {
    if (game) game.pause(false);
    showScreen("title");
    try { if (audio) audio.startMusic("title"); } catch (e) {}
    updateContinueButton();
    redrawPortraits();
  }

  function nextLevel() {
    if (!game) return;
    if (game.isLastLevel()) {
      showFinale();
    } else {
      openLevelIntro(game.state.levelIndex + 1);
    }
  }

  function showComplete(stats) {
    UI.lastComplete = stats;
    setText(dom.resultTime, fmtTime(stats.time));
    setText(dom.resultTreasure, stats.treasures + "/" + stats.totalTreasures);
    setText(dom.resultDeaths, String(stats.deaths));
    setText(dom.resultScore, String(stats.score));
    setText(dom.completeNote, t("complete.note"));
    setText(dom.nextHint, game && game.isLastLevel() ? "" : t("levels.level") + " " + (stats.index + 2));
    showScreen("complete");
  }

  function showFinale() {
    var s = (game && game.state.session) || { time: 0, treasure: 0, deaths: 0, score: 0 };
    var total = 0;
    for (var i = 0; i < levels.length; i++) total += countTreasures(levels[i]);
    setText(dom.finaleTime, fmtTime(s.time));
    setText(dom.finaleTreasure, s.treasure + "/" + total);
    setText(dom.finaleDeaths, String(s.deaths));
    setText(dom.finaleScore, String(s.score));
    showScreen("finale");
  }

  function nav(action) {
    ensureAudio();
    try { if (audio) audio.sfx("click"); } catch (e) {}
    switch (action) {
      case "play": startNewGame(); break;
      case "continue": openLevelIntro(UI.progress.maxLevel); break;
      case "levels": if (UI.screen === "playing" || UI.screen === "pause") game.pause(true); showScreen("levels"); break;
      case "help": showScreen("help"); break;
      case "settings":
        UI.returnScreen = UI.screen;
        updateSettingsUI();
        showScreen("settings");
        break;
      case "back":
        if (UI.screen === "settings") showScreen(UI.returnScreen || "title");
        else if (UI.screen === "levelIntro") showScreen("levels");
        else showScreen("title");
        break;
      case "story": showScreen("story"); break;
      case "begin": markStorySeen(); openLevelIntro(0); break;
      case "go": beginLevel(UI.pendingLevel); break;
      case "resume": resumeGame(); break;
      case "restart":
        if (game) { game.startLevel(game.state.levelIndex); showScreen("playing"); }
        break;
      case "next": nextLevel(); break;
      case "pause":
        if (UI.screen === "playing") openPause();
        else if (UI.screen === "levelIntro") showScreen("levels");
        break;
      case "title": quitToTitle(); break;
      default: break;
    }
  }

  function primaryAction() {
    switch (UI.screen) {
      case "title": nav("play"); break;
      case "story": nav("begin"); break;
      case "levelIntro": nav("go"); break;
      case "pause": resumeGame(); break;
      case "complete": nextLevel(); break;
      case "dead": if (game) { game.startLevel(game.state.levelIndex); showScreen("playing"); } break;
      case "finale": quitToTitle(); break;
      case "levels":
        if (UI.progress.maxLevel >= 0) openLevelIntro(UI.progress.maxLevel);
        break;
      case "settings": 
      case "help": nav("back"); break;
      default: break;
    }
  }

  function backAction() {
    if (UI.screen === "playing") openPause();
    else if (UI.screen === "pause") resumeGame();
    else if (UI.screen === "settings") nav("back");
    else if (UI.screen === "levelIntro") showScreen("levels");
    else if (UI.screen === "dead") showScreen("levels");
    else if (UI.screen === "complete") showScreen("levels");
    else if (UI.screen === "levels" || UI.screen === "help" || UI.screen === "story") showScreen("title");
    else if (UI.screen === "finale") quitToTitle();
  }

  UI.nav = nav;

  /* ───────────────────────── события игры ───────────────────────── */

  UI.onGameEvent = function (name, data) {
    if (name === "levelStart") {
      if (UI.screen !== "playing") showScreen("playing");
      updateHUD();
      updateContinueButton();
    } else if (name === "restart") {
      showScreen("playing");
      updateHUD();
    } else if (name === "death") {
      UI.deadKey = "dead." + (data.reason || "spikes");
      setText(dom.deadText, t(UI.deadKey));
      showScreen("dead");
      updateHUD();
    } else if (name === "complete") {
      UI.progress.completed[data.index] = 1;
      if (data.index + 1 < levels.length) {
        UI.progress.maxLevel = Math.max(UI.progress.maxLevel, data.index + 1);
      } else {
        UI.progress.maxLevel = Math.max(UI.progress.maxLevel, data.index);
      }
      if (UI.progress.best[data.index] == null || data.time < UI.progress.best[data.index]) {
        UI.progress.best[data.index] = data.time;
      }
      saveProgress();
      buildLevelGrid();
      updateContinueButton();
      UI.lastComplete = data;
      if (data.index >= levels.length - 1) showFinale();
      else showComplete(data);
    } else if (name === "wrongExit") {
      var who = t("char." + data.who);
      showToast(t("exit.wrong").replace("{name}", who));
    } else if (name === "switch") {
      updateHUD();
    } else if (name === "treasure") {
      updateHUD();
    } else if (name === "sessionReset") {
      UI.lastComplete = null;
      updateContinueButton();
    }
  };

  /* ───────────────────────── level grid ───────────────────────── */

  function buildLevelGrid() {
    if (!levelGrid) return;
    levelGrid.innerHTML = "";
    levels.forEach(function (lv, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "level-cell";
      var unlocked = i <= UI.progress.maxLevel;
      if (!unlocked) btn.disabled = true;
      if (UI.progress.completed[i] === 1) btn.classList.add("is-cleared");
      if (i === UI.progress.maxLevel) btn.classList.add("is-current");

      var num = document.createElement("span");
      num.className = "level-cell__num";
      num.textContent = pad2(i + 1);
      btn.appendChild(num);

      var name = document.createElement("span");
      name.className = "level-cell__name";
      name.textContent = lvlName(lv);
      btn.appendChild(name);

      var theme = document.createElement("span");
      theme.className = "level-cell__theme";
      theme.textContent = t("theme." + (lv.theme || "cave"));
      btn.appendChild(theme);

      var foot = document.createElement("span");
      foot.className = "level-cell__foot";
      if (!unlocked) {
        foot.textContent = "✦ " + t("levels.locked");
      } else if (UI.progress.best[i] != null) {
        foot.textContent = "◷ " + fmtTime(UI.progress.best[i]);
      } else {
        foot.textContent = UI.progress.completed[i] ? "✓" : t("levels.level");
      }
      btn.appendChild(foot);

      btn.addEventListener("click", function () {
        if (!unlocked) { showToast(t("toast.locked")); return; }
        ensureAudio();
        try { if (audio) audio.sfx("click"); } catch (e) {}
        openLevelIntro(i);
      });
      levelGrid.appendChild(btn);
    });
  }

  /* ───────────────────────── тост ───────────────────────── */

  function showToast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add("is-on");
    UI.toastTimer = 2.2;
  }

  /* ───────────────────────── события DOM ───────────────────────── */

  function bindGlobalEvents() {
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("pointerdown", ensureAudioOnce, { passive: true });
    window.addEventListener("blur", function () {
      if (game) {
        ["left", "right", "jump", "action", "down"].forEach(function (a) { try { game.input(a, false); } catch (e) {} });
      }
    });
  }

  var audioOnceDone = false;
  function ensureAudioOnce() {
    if (audioOnceDone) return;
    audioOnceDone = true;
    ensureAudio();
  }

  function bindMenuEvents() {
    app.addEventListener("click", function (e) {
      var navEl = e.target.closest ? e.target.closest("[data-nav]") : null;
      if (navEl) { e.preventDefault(); nav(navEl.getAttribute("data-nav")); return; }

      var toolEl = e.target.closest ? e.target.closest("[data-tool]") : null;
      if (toolEl) {
        e.preventDefault();
        var tool = toolEl.getAttribute("data-tool");
        if (tool === "gfx") UI.toggleGfx();
        else if (tool === "lang") UI.toggleLang();
        else if (tool === "mute") UI.toggleMute();
        else if (tool === "pause") { if (UI.screen === "playing") openPause(); else if (UI.screen === "pause") resumeGame(); }
        return;
      }

      var gfxEl = e.target.closest ? e.target.closest("[data-gfx-set]") : null;
      if (gfxEl) { applyGfx(gfxEl.getAttribute("data-gfx-set")); return; }

      var langEl = e.target.closest ? e.target.closest("[data-lang-set]") : null;
      if (langEl) { applyLang(langEl.getAttribute("data-lang-set")); return; }

      var charEl = e.target.closest ? e.target.closest("[data-char]") : null;
      if (charEl && game && UI.screen === "playing") {
        game.switchTo(charEl.getAttribute("data-char"));
        updateHUD();
      }
    });

    if (dom.volume) {
      dom.volume.addEventListener("input", function () {
        UI.prefs.volume = Math.max(0, Math.min(100, parseInt(dom.volume.value, 10) || 0));
        setText(dom.volumeOut, UI.prefs.volume + "%");
        try { if (audio && audio.setVolume) audio.setVolume(UI.prefs.volume / 100); } catch (e) {}
        savePrefs();
      });
    }

    if (dom.reset) {
      dom.reset.addEventListener("click", function () {
        var ok = window.confirm(t("settings.reset.confirm", "Сбросить весь прогресс и настройки?"));
        if (!ok) return;
        try { window.localStorage.removeItem(PROG_KEY); window.localStorage.removeItem(STORY_KEY); } catch (e) {}
        UI.progress = { maxLevel: 0, completed: {}, best: {} };
        UI.seenStory = false;
        saveProgress();
        UI.lastComplete = null;
        buildLevelGrid();
        updateContinueButton();
        showToast(t("toast.reset"));
      });
    }
  }

  function bindTouch() {
    if (!touchpad) return;
    $all("[data-hold]", touchpad).forEach(function (btn) {
      var action = btn.getAttribute("data-hold");
      var press = function (e) {
        e.preventDefault();
        ensureAudio();
        if (!game || UI.screen !== "playing") return;
        game.input(action, true);
        btn.classList.add("is-down");
      };
      var release = function (e) {
        if (e) e.preventDefault();
        if (game) game.input(action, false);
        btn.classList.remove("is-down");
      };
      btn.addEventListener("pointerdown", press);
      btn.addEventListener("pointerup", release);
      btn.addEventListener("pointercancel", release);
      btn.addEventListener("pointerleave", release);
      btn.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    });
  }

  /* ───────────────────────── клавиатура ───────────────────────── */

  var MOVE_KEYS = {
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    ArrowUp: "jump", KeyW: "jump", Space: "jump",
    ArrowDown: "down", KeyS: "down",
    KeyJ: "action", KeyK: "action", KeyF: "action"
  };

  function onKeyDown(e) {
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    ensureAudio();
    var code = e.code || "";

    if (!e.repeat) {
      if (code === "KeyG") { e.preventDefault(); UI.toggleGfx(); return; }
      if (code === "KeyL") { e.preventDefault(); UI.toggleLang(); return; }
      if (code === "KeyM") { e.preventDefault(); UI.toggleMute(); return; }
    }

    if (UI.screen === "playing") {
      var act = MOVE_KEYS[code];
      if (act) {
        e.preventDefault();
        if (!e.repeat) game.input(act, true);
        return;
      }
      if (code === "Enter") { e.preventDefault(); if (!e.repeat) game.input("action", true); return; }
      if (code === "Digit1") { e.preventDefault(); game.input("switch1", true); return; }
      if (code === "Digit2") { e.preventDefault(); game.input("switch2", true); return; }
      if (code === "Digit3") { e.preventDefault(); game.input("switch3", true); return; }
      if (code === "Tab" || code === "KeyQ" || code === "KeyE") {
        e.preventDefault();
        if (!e.repeat) game.input("switch", true);
        return;
      }
      if (code === "KeyR") {
        e.preventDefault();
        if (!e.repeat) { game.startLevel(game.state.levelIndex); showScreen("playing"); }
        return;
      }
      if (code === "KeyP" || code === "Escape") { e.preventDefault(); if (!e.repeat) openPause(); return; }
      return;
    }

    if (code === "Enter" || code === "Space") {
      e.preventDefault();
      if (!e.repeat) primaryAction();
      return;
    }
    if (code === "Escape" || code === "KeyP") {
      e.preventDefault();
      if (!e.repeat) backAction();
      return;
    }
    if (code === "Tab") e.preventDefault();
  }

  function onKeyUp(e) {
    var code = e.code || "";
    if (UI.screen !== "playing" && !MOVE_KEYS[code] && code !== "Enter") return;
    var act = MOVE_KEYS[code];
    if (act && game) game.input(act, false);
    else if (code === "Enter" && game) game.input("action", false);
    if (code === "Space" || code === "ArrowLeft" || code === "ArrowRight" ||
        code === "ArrowUp" || code === "ArrowDown" || code === "Tab") {
      e.preventDefault();
    }
  }

  /* ───────────────────────── кадр ───────────────────────── */

  UI.frame = function (dt) {
    if (!UI.started) return;
    UI.portraitTimer -= dt;
    if (UI.portraitTimer <= 0) {
      UI.portraitTimer = 0.22;
      if (UI.screen === "title" || UI.screen === "story" || UI.screen === "finale" || UI.screen === "settings") {
        redrawPortraits();
      } else if (UI.screen === "playing" || UI.screen === "pause" || UI.screen === "dead") {
        redrawPortraits();
      }
    }
    if (UI.toastTimer > 0) {
      UI.toastTimer -= dt;
      if (UI.toastTimer <= 0 && toastEl) toastEl.classList.remove("is-on");
    }
    if (UI.screen === "dead" && game) {
      var n = Math.max(1, Math.ceil(game.state.deathTimer));
      setText(dom.deadCountdown, String(n));
    }
    if (UI.screen === "playing" || UI.screen === "pause" || UI.screen === "dead") updateHUD();
  };

  UI.debug = {
    setGfx: function (g) { applyGfx(g, true); },
    setLang: function (l) { applyLang(l, true); },
    beginLevel: beginLevel,
    openIntro: openLevelIntro,
    showScreen: showScreen,
    showComplete: showComplete,
    showFinale: showFinale,
    setAudioMuted: function (m) {
      if (audio && audio.setMuted) audio.setMuted(!!m);
      UI.prefs.muted = !!m;
      updateChips();
      updateSettingsUI();
    }
  };

  window.LV_UI = UI;
})();
