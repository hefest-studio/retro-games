/* ==========================================================================
   СТАРАТЕЛЬ · Погружение — интерфейс, меню, i18n, ввод
   ========================================================================== */
(function () {
  'use strict';

  var LS = {
    theme: 'loderunner.theme',
    lang: 'loderunner.lang',
    muted: 'loderunner.muted',
    best: 'loderunner.best'
  };

  var STR = {
    ru: {
      brand_sub: 'ПОДЗЕМЕЛЬЕ · 1983',
      graphics: 'ГРАФИКА',
      theme_neon: 'НЕОН',
      theme_retro: '8-БИТ',
      hud_level: 'УРОВЕНЬ',
      hud_gold: 'ЗОЛОТО',
      hud_score: 'ОЧКИ',
      hud_lives: 'ЖИЗНИ',
      best_short: 'РЕКОРД',
      exit_closed: 'ВЫХОД ЗАКРЫТ',
      exit_open: 'ВЫХОД ОТКРЫТ',
      level_word: 'УРОВЕНЬ',
      sound_on: 'ЗВУК ВКЛ',
      sound_off: 'ЗВУК ВЫКЛ',
      title_eyebrow: 'КЛАССИКА 1983 · ПЕРЕОСМЫСЛЕНА',
      title_sub: 'ПОГРУЖЕНИЕ',
      title_lead: 'Копай. Кради золото. Уходи от стражи. Одна ошибка — и ты уже легенда подземелья.',
      start: 'НАЧАТЬ ПОГРУЖЕНИЕ',
      help: 'КАК ИГРАТЬ',
      record: 'РЕКОРД',
      levels: 'УРОВНЕЙ',
      music: 'МУЗЫКА',
      title_hint: 'Enter — старт · G — графика · M — звук · L — язык',
      help_kicker: 'ПОЛЕВОЙ УСТАВ',
      help_title: 'КАК ИГРАТЬ',
      help_lead: 'Собери всё золото, открой выход и доберись до него. Стража не дремлет. Кирпич под ногами — твоё главное оружие.',
      help_controls: 'УПРАВЛЕНИЕ',
      help_move: 'бежать',
      help_climb: 'лестницы',
      help_dig: 'копать влево / вправо',
      help_pause: 'пауза',
      help_sys: 'графика / звук / язык',
      help_rules_h: 'ПРАВИЛА ВЫЖИВАНИЯ',
      help_rule_1: 'Золото даёт 100 очков. Собери всё — и выход наверху откроется.',
      help_rule_2: 'Выкопай яму под стражем: он свалится и погибнет, когда яма закроется. +150 очков.',
      help_rule_3: 'В яму можно упасть самому. Выбирайся клавишей ↑, пока она не схлопнулась.',
      help_rule_4: 'Страж не умеет копать, но отлично видит тебя. Лестницы и канаты — его стихия.',
      close: 'ПОНЯТНО',
      pause_btn: 'Пауза',
      pause_kicker: 'ПЕРЕДЫШКА',
      pause_title: 'ПАУЗА',
      pause_lead: 'Подземелье подождёт. Недолго.',
      resume: 'ПРОДОЛЖИТЬ',
      restart: 'НАЧАТЬ ЗАНОВО',
      to_menu: 'В МЕНЮ',
      complete_title: 'УРОВЕНЬ ПРОЙДЕН',
      time: 'ВРЕМЯ',
      bonus: 'БОНУС',
      total_score: 'ОЧКИ',
      next: 'ДАЛЬШЕ',
      finish: 'К ФИНАЛУ',
      gameover_kicker: 'КОНЕЦ ПОГРУЖЕНИЯ',
      gameover_title: 'ТЕБЯ ПОЙМАЛИ',
      gameover_lead: 'Подземелье не прощает жадности. Но золото всё ещё там.',
      again: 'ЕЩЁ РАЗ',
      victory_kicker: 'ФИНАЛ',
      victory_title: 'ПОГРУЖЕНИЕ ЗАВЕРШЕНО',
      victory_lead: 'Ты вынес всё золото и растворился в рассветном свете. Стража осталась с носом.',
      new_record: 'НОВЫЙ РЕКОРД',
      legend_gold: 'золото +100',
      legend_brick: 'кирпич копается',
      legend_exit: 'выход',
      hint_move: 'движение',
      hint_dig: 'копать',
      hint_pause: 'пауза',
      hint_gfx: 'графика',
      footer_left: 'СТАРАТЕЛЬ · ни единой картинки: canvas + WebAudio',
      footer_right: 'Классика 1983 · Браузер · Русский язык',
      toast_exit: 'ВЫХОД ОТКРЫТ — УХОДИ НАВЕРХ',
      toast_death: 'ВАС ПОЙМАЛИ',
      toast_trap: 'СТРАЖ В ЛОВУШКЕ +150',
      toast_respawn: 'ПОПЫТКА ПРОДОЛЖАЕТСЯ',
      touch_dig: 'копать',
      sound_hint: 'ЗВУК — ПОСЛЕ ПЕРВОГО КАСАНИЯ'
    },
    en: {
      brand_sub: 'UNDERGROUND · 1983',
      graphics: 'GRAPHICS',
      theme_neon: 'NEON',
      theme_retro: '8-BIT',
      hud_level: 'LEVEL',
      hud_gold: 'GOLD',
      hud_score: 'SCORE',
      hud_lives: 'LIVES',
      best_short: 'BEST',
      exit_closed: 'EXIT LOCKED',
      exit_open: 'EXIT OPEN',
      level_word: 'LEVEL',
      sound_on: 'SOUND ON',
      sound_off: 'SOUND OFF',
      title_eyebrow: '1983 CLASSIC · REIMAGINED',
      title_sub: 'DESCENT',
      title_lead: 'Dig. Steal gold. Outrun the guard. One mistake and you are already a dungeon legend.',
      start: 'START THE DESCENT',
      help: 'HOW TO PLAY',
      record: 'BEST',
      levels: 'LEVELS',
      music: 'MUSIC',
      title_hint: 'Enter — start · G — graphics · M — sound · L — language',
      help_kicker: 'FIELD MANUAL',
      help_title: 'HOW TO PLAY',
      help_lead: 'Collect all gold, unlock the exit and reach it. The guard never sleeps. The brick under your feet is your best weapon.',
      help_controls: 'CONTROLS',
      help_move: 'run',
      help_climb: 'climb ladders',
      help_dig: 'dig left / right',
      help_pause: 'pause',
      help_sys: 'graphics / sound / language',
      help_rules_h: 'SURVIVAL RULES',
      help_rule_1: 'Gold is 100 points. Collect it all and the exit above opens.',
      help_rule_2: 'Dig a pit under a guard: he drops in and dies when it snaps shut. +150 points.',
      help_rule_3: 'You can fall into your own pit. Press ↑ to get out before it closes.',
      help_rule_4: 'The guard cannot dig — but he sees you perfectly. Ladders and ropes are his element.',
      close: 'GOT IT',
      pause_btn: 'Pause',
      pause_kicker: 'BREATHER',
      pause_title: 'PAUSED',
      pause_lead: 'The dungeon can wait. Not for long.',
      resume: 'RESUME',
      restart: 'RESTART RUN',
      to_menu: 'MAIN MENU',
      complete_title: 'LEVEL CLEARED',
      time: 'TIME',
      bonus: 'BONUS',
      total_score: 'SCORE',
      next: 'NEXT',
      finish: 'TO THE FINALE',
      gameover_kicker: 'DESCENT OVER',
      gameover_title: 'YOU GOT CAUGHT',
      gameover_lead: 'The dungeon does not forgive greed. But the gold is still down there.',
      again: 'TRY AGAIN',
      victory_kicker: 'FINALE',
      victory_title: 'DESCENT COMPLETE',
      victory_lead: 'You carried out all the gold and vanished into the dawn. The guard was left empty-handed.',
      new_record: 'NEW RECORD',
      legend_gold: 'gold +100',
      legend_brick: 'diggable brick',
      legend_exit: 'exit',
      hint_move: 'move',
      hint_dig: 'dig',
      hint_pause: 'pause',
      hint_gfx: 'graphics',
      footer_left: 'СТАРАТЕЛЬ · zero images: canvas + WebAudio',
      footer_right: 'Classic 1983 · Browser · Russian & English',
      toast_exit: 'EXIT OPEN — HEAD UP',
      toast_death: 'YOU GOT CAUGHT',
      toast_trap: 'GUARD TRAPPED +150',
      toast_respawn: 'TRY AGAIN',
      touch_dig: 'dig',
      sound_hint: 'SOUND STARTS ON FIRST TOUCH'
    }
  };

  function $(id) { return document.getElementById(id); }
  function storeGet(key, fallback) {
    try { var v = localStorage.getItem(key); return v === null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function storeSet(key, val) {
    try { localStorage.setItem(key, String(val)); } catch (e) { /* без хранилища */ }
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function formatScore(n) {
    n = Math.max(0, Math.floor(n || 0));
    var s = String(n);
    while (s.length < 6) s = '0' + s;
    return s;
  }
  function formatTime(sec) {
    sec = Math.max(0, sec || 0);
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return pad2(m) + ':' + pad2(s);
  }
  function noop() {}

  var TOUCH_KEYS = { up: 1, down: 1, left: 1, right: 1 };

  function UI(opts) {
    this.game = opts.game;
    this.renderer = opts.renderer;
    this.audio = opts.audio || {};
    this.lang = 'ru';
    this.theme = 'retro';
    this.muted = false;
    this.best = 0;
    this.screen = 'title';
    this.paused = true;
    this.dom = {};
    this.hudAt = 0;
    this._bannerTimer = null;
    this._toastTimer = null;
    this._musicMode = 'title';
    this._musicStarted = false;
    this._helpFrom = 'title';
    this._lastUnlock = 0;
    this._recordGameover = false;
    this._recordVictory = false;
  }

  UI.prototype.init = function () {
    var d = this.dom;
    d.overlay = $('overlay');
    d.screens = Array.prototype.slice.call(document.querySelectorAll('.screen'));
    d.lb = $('level-banner');
    d.lbIndex = $('lb-index');
    d.lbTitle = $('lb-title');
    d.lbHint = $('lb-hint');
    d.toast = $('toast');
    d.hudLevel = $('hud-level');
    d.hudTotal = $('hud-total');
    d.hudName = $('hud-name');
    d.hudGold = $('hud-gold');
    d.hudGoldTotal = $('hud-gold-total');
    d.goldBar = $('gold-bar');
    d.hudScore = $('hud-score');
    d.hudBest = $('hud-best');
    d.hudLives = $('hud-lives');
    d.hudExit = $('hud-exit-state');
    d.lvDots = $('lv-dots');
    d.titleBest = $('title-best');
    d.titleLevels = $('title-levels');
    d.titleTheme = $('title-theme');
    d.themeLabel = $('theme-label');
    d.muteLabel = $('mute-label');
    d.langLabel = $('lang-label');
    d.pauseBtn = $('btn-pause');
    d.completeEyebrow = $('complete-eyebrow');
    d.completeTime = $('complete-time');
    d.completeBonus = $('complete-bonus');
    d.completeScore = $('complete-score');
    d.completeNextLabel = $('complete-next-label');
    d.gameoverScore = $('gameover-score');
    d.gameoverBest = $('gameover-best');
    d.victoryScore = $('victory-score');
    d.victoryBest = $('victory-best');
    d.themeSwitchButtons = Array.prototype.slice.call(document.querySelectorAll('[data-theme]'));

    // настройки
    // По умолчанию — 8-битная графика. Один раз мигрируем со старой
    // настройки, чтобы после обновления игрок увидел именно ретро-режим.
    var retroDefaultApplied = storeGet('loderunner.theme.retroDefault', '0') === '1';
    var savedTheme = storeGet(LS.theme, 'retro');
    if (!retroDefaultApplied) {
      savedTheme = 'retro';
      storeSet('loderunner.theme.retroDefault', '1');
    }
    var savedLang = storeGet(LS.lang, 'ru');
    this.best = parseInt(storeGet(LS.best, '0'), 10) || 0;
    this.muted = storeGet(LS.muted, '0') === '1';

    // точки уровней
    var total = this.game.levels.length;
    d.lvDots.textContent = '';
    for (var i = 0; i < total; i++) {
      var dot = document.createElement('i');
      d.lvDots.appendChild(dot);
    }
    d.hudTotal.textContent = total;
    d.titleLevels.textContent = total;

    this.game.hooks = this.game.hooks || {};
    this.game.hooks.audio = this.audio;
    this.game.hooks.onEvent = this.onGameEvent.bind(this);

    this.applyLanguage(savedLang === 'en' ? 'en' : 'ru', true);
    this.applyTheme(savedTheme === 'neon' ? 'neon' : 'retro', true);
    this.applyMute(this.muted, true);

    this.game.showTitlePreview();
    this.setScreen('title');
    this.updateHud(true);
    this.updateBestDisplay();

    this.bindEvents();
  };

  /* ------------------------------------------------------------ настройки */

  UI.prototype.t = function (key) {
    var table = STR[this.lang] || STR.ru;
    return table[key] !== undefined ? table[key] : (STR.ru[key] !== undefined ? STR.ru[key] : key);
  };

  UI.prototype.applyTheme = function (theme, initial) {
    this.theme = theme === 'retro' ? 'retro' : 'neon';
    document.body.classList.toggle('theme-retro', this.theme === 'retro');
    document.body.classList.toggle('theme-neon', this.theme === 'neon');
    if (this.renderer) this.renderer.setTheme(this.theme, !!initial);
    var label = this.t(this.theme === 'retro' ? 'theme_retro' : 'theme_neon');
    if (this.dom.themeLabel) this.dom.themeLabel.textContent = label;
    if (this.dom.titleTheme) this.dom.titleTheme.textContent = label;
    if (this.dom.themeSwitchButtons) {
      this.dom.themeSwitchButtons.forEach(function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-theme') === this.theme);
      }, this);
    }
    storeSet(LS.theme, this.theme);
  };

  UI.prototype.toggleTheme = function () {
    this.applyTheme(this.theme === 'neon' ? 'retro' : 'neon', false);
    this.click();
  };

  UI.prototype.applyLanguage = function (lang, initial) {
    this.lang = lang === 'en' ? 'en' : 'ru';
    document.documentElement.lang = this.lang;
    document.body.classList.toggle('lang-ru', this.lang === 'ru');
    document.body.classList.toggle('lang-en', this.lang === 'en');
    if (this.dom.langLabel) this.dom.langLabel.textContent = this.lang.toUpperCase();

    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var key = els[i].getAttribute('data-i18n');
      els[i].textContent = this.t(key);
    }
    var aria = document.querySelectorAll('[data-i18n-aria]');
    for (var j = 0; j < aria.length; j++) {
      aria[j].setAttribute('aria-label', this.t(aria[j].getAttribute('data-i18n-aria')));
    }
    if (this.dom.pauseBtn) this.dom.pauseBtn.setAttribute('aria-label', this.t('pause_btn'));
    if (this.dom.themeLabel) this.dom.themeLabel.textContent = this.t(this.theme === 'retro' ? 'theme_retro' : 'theme_neon');
    if (this.dom.titleTheme) this.dom.titleTheme.textContent = this.t(this.theme === 'retro' ? 'theme_retro' : 'theme_neon');
    if (this.dom.muteLabel) this.dom.muteLabel.textContent = this.t(this.muted ? 'sound_off' : 'sound_on');

    storeSet(LS.lang, this.lang);

    this.updateBestDisplay();
    this.updateHud(true);
    if (this.dom.lb && this.dom.lb.classList.contains('is-on')) this.showBanner();
    this.updateCompleteLabels();
  };

  UI.prototype.toggleLang = function () {
    this.applyLanguage(this.lang === 'ru' ? 'en' : 'ru', false);
    this.click();
  };

  UI.prototype.applyMute = function (muted, initial) {
    this.muted = !!muted;
    document.body.classList.toggle('is-muted', this.muted);
    if (this.audio && this.audio.setMuted) {
      try { this.audio.setMuted(this.muted); } catch (e) { /* тишина */ }
    }
    if (this.dom.muteLabel) this.dom.muteLabel.textContent = this.t(this.muted ? 'sound_off' : 'sound_on');
    storeSet(LS.muted, this.muted ? '1' : '0');
    if (!initial && !this.muted) {
      this._musicStarted = false;
      this.music(this._musicMode || 'title');
    }
    if (!initial && this.muted) this._musicStarted = false;
  };

  UI.prototype.toggleMute = function () {
    this.applyMute(!this.muted, false);
    if (!this.muted) this.click();
  };

  /* ---------------------------------------------------------------- музыка */

  UI.prototype.click = function () {
    if (this.audio && this.audio.sfx) {
      try { this.audio.sfx('click'); } catch (e) { /* тишина */ }
    }
  };

  UI.prototype.music = function (mode) {
    this._musicMode = mode;
    if (this.muted) return;
    if (!this.audio || !this.audio.startMusic) return;
    try {
      if (this.audio.unlock) this.audio.unlock();
      this.audio.startMusic(mode);
      if (mode === 'game' && this.audio.setGameTrack) {
        this.audio.setGameTrack(this.game.levelIndex % 2);
      }
      this._musicStarted = true;
    } catch (e) { /* тишина */ }
  };

  UI.prototype.stopMusic = function () {
    if (this.audio && this.audio.stopMusic) {
      try { this.audio.stopMusic(); } catch (e) { /* тишина */ }
    }
    this._musicStarted = false;
  };

  UI.prototype.onGesture = function () {
    if (this.audio && this.audio.unlock) {
      var now = (window.performance && performance.now) ? performance.now() : Date.now();
      if (now - this._lastUnlock > 700) {
        this._lastUnlock = now;
        try { this.audio.unlock(); } catch (e) { /* тишина */ }
      }
    }
    if (this._musicStarted || this.muted) return;
    this.music(this._musicMode || 'title');
  };

  /* ---------------------------------------------------------------- экраны */

  UI.prototype.setScreen = function (name) {
    this.screen = name || 'none';
    document.body.setAttribute('data-screen', this.screen);
    for (var i = 0; i < this.dom.screens.length; i++) {
      var el = this.dom.screens[i];
      el.classList.toggle('is-active', el.getAttribute('data-screen') === this.screen);
    }
    this.paused = this.screen !== 'none';
    this.clearInput();
    if (this.screen !== 'none') this.hideBanner();
    if (this.dom.pauseBtn) {
      this.dom.pauseBtn.textContent = this.screen === 'pause' ? '▶' : 'Ⅱ';
      this.dom.pauseBtn.setAttribute('aria-label', this.screen === 'pause' ? this.t('resume') : this.t('pause_btn'));
    }
    if (document.activeElement && document.activeElement.blur) {
      try { document.activeElement.blur(); } catch (e) { /* ok */ }
    }
  };

  UI.prototype.startRun = function () {
    this.onGesture();
    this.game.startRun();
    this.setScreen('none');
    this.paused = false;
    this._musicStarted = false;
    this.music('game');
    this.showBanner();
    this.updateHud(true);
    this.updateBestDisplay();
    this.click();
  };

  UI.prototype.pauseToggle = function () {
    if (this.screen === 'pause') {
      this.resume();
      return;
    }
    if (this.screen !== 'none') return;
    if (this.game.state !== 'playing') return;
    this.setScreen('pause');
    this.click();
  };

  UI.prototype.resume = function () {
    if (this.screen !== 'pause') return;
    this.setScreen('none');
    this.paused = false;
    this.click();
  };

  UI.prototype.restart = function () {
    this.startRun();
  };

  UI.prototype.menu = function () {
    this.updateBest();
    this.game.showTitlePreview();
    this.setScreen('title');
    this.paused = true;
    this._musicStarted = false;
    this.music('title');
    this.updateHud(true);
    this.updateBestDisplay();
    this.click();
  };

  UI.prototype.showHelp = function () {
    this._helpFrom = this.screen;
    this.setScreen('help');
    this.click();
  };

  UI.prototype.closeHelp = function () {
    if (this._helpFrom === 'pause') {
      this.setScreen('pause');
    } else {
      this.setScreen('title');
    }
    this.click();
  };

  UI.prototype.advance = function () {
    if (this.screen === 'title') {
      this.startRun();
      return;
    }
    if (this.screen === 'help') {
      this.closeHelp();
      return;
    }
    if (this.screen === 'pause') {
      this.resume();
      return;
    }
    if (this.screen === 'complete') {
      var last = this.game.levelIndex >= this.game.levels.length - 1;
      this.game.nextLevel();
      if (last) {
        // состояние victory придёт событием и покажет экран финала
        return;
      }
      this.setScreen('none');
      this.paused = false;
      this.showBanner();
      this._musicStarted = false;
      this.music('game');
      this.updateHud(true);
      this.click();
      return;
    }
    if (this.screen === 'gameover' || this.screen === 'victory') {
      this.startRun();
    }
  };

  /* ---------------------------------------------------------------- события */

  UI.prototype.onGameEvent = function (type, data) {
    switch (type) {
      case 'level':
        this.updateHud(true);
        if (this.audio && this.audio.setGameTrack && !this.paused) {
          try { this.audio.setGameTrack(this.game.levelIndex % 2); } catch (e) { /* ok */ }
        }
        break;
      case 'run':
        this.updateHud(true);
        break;
      case 'gold':
        this.updateHud(true);
        break;
      case 'exitOpen':
        this.updateHud(true);
        this.toast(this.t('toast_exit'), 2400);
        break;
      case 'enemyTrap':
        this.updateHud(true);
        this.toast(this.t('toast_trap'), 1700);
        break;
      case 'die':
        this.clearInput();
        this.toast(this.t('toast_death'), 1300);
        break;
      case 'respawn':
        this.updateHud(true);
        this.toast(this.t('toast_respawn'), 1500);
        break;
      case 'complete':
        this.showComplete(data);
        break;
      case 'gameover':
        this.showGameover(data);
        break;
      case 'victory':
        this.showVictory(data);
        break;
      default:
        break;
    }
  };

  UI.prototype.showComplete = function (data) {
    this.updateBest();
    this.dom.completeEyebrow.textContent = this.t('level_word') + ' ' + pad2(data.level + 1);
    this.dom.completeTime.textContent = formatTime(data.time);
    this.dom.completeBonus.textContent = '+' + data.total;
    this.dom.completeScore.textContent = formatScore(data.score);
    this.updateCompleteLabels();
    this.setScreen('complete');
    this.paused = true;
  };

  UI.prototype.updateCompleteLabels = function () {
    if (!this.dom.completeNextLabel) return;
    var last = this.game.levelIndex >= this.game.levels.length - 1;
    this.dom.completeNextLabel.textContent = this.t(last ? 'finish' : 'next');
  };

  UI.prototype.updateBest = function () {
    if (this.game.score > this.best) {
      this.best = this.game.score;
      storeSet(LS.best, this.best);
    }
    this.updateBestDisplay();
    return this.best;
  };

  UI.prototype.updateBestDisplay = function () {
    var score = formatScore(this.best);
    if (this.dom.titleBest) this.dom.titleBest.textContent = score;
    if (this.dom.hudBest) this.dom.hudBest.textContent = this.t('best_short') + ' ' + score;
    if (this.dom.gameoverBest) {
      var recG = this.screen === 'gameover' && this._recordGameover;
      this.dom.gameoverBest.textContent = (recG ? this.t('new_record') : this.t('best_short')) + ' ' + score;
      this.dom.gameoverBest.classList.toggle('is-record', recG);
    }
    if (this.dom.victoryBest) {
      var recV = this.screen === 'victory' && this._recordVictory;
      this.dom.victoryBest.textContent = (recV ? this.t('new_record') : this.t('best_short')) + ' ' + score;
      this.dom.victoryBest.classList.toggle('is-record', recV);
    }
  };

  UI.prototype.showGameover = function (data) {
    var isRecord = data.score > this.best;
    if (isRecord) {
      this.best = data.score;
      storeSet(LS.best, this.best);
    }
    this.dom.gameoverScore.textContent = formatScore(data.score);
    this._recordGameover = isRecord;
    this.setScreen('gameover');
    this.updateBestDisplay();
    this.paused = true;
    this.stopMusic();
    this._musicMode = 'title';
  };

  UI.prototype.showVictory = function (data) {
    var isRecord = data.score > this.best;
    if (isRecord) {
      this.best = data.score;
      storeSet(LS.best, this.best);
    }
    this.dom.victoryScore.textContent = formatScore(data.score);
    this._recordVictory = isRecord;
    this.setScreen('victory');
    this.updateBestDisplay();
    this.paused = true;
    this.stopMusic();
    this._musicMode = 'title';
    this.music('title');
    if (this.audio && this.audio.sfx) {
      try { this.audio.sfx('win'); } catch (e) { /* ok */ }
    }
  };

  /* --------------------------------------------------------------- HUD */

  UI.prototype.updateHud = function (force) {
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    if (!force && now - this.hudAt < 90) return;
    this.hudAt = now;
    var g = this.game;
    var h = g.getHud();
    var total = g.levels.length;
    if (this.dom.hudLevel) this.dom.hudLevel.textContent = pad2(h.level);
    if (this.dom.hudTotal) this.dom.hudTotal.textContent = total;
    if (this.dom.hudName) this.dom.hudName.textContent = g.levelName(this.lang);
    if (this.dom.hudGold) this.dom.hudGold.textContent = pad2(h.goldTotal - h.goldLeft);
    if (this.dom.hudGoldTotal) this.dom.hudGoldTotal.textContent = pad2(h.goldTotal);
    if (this.dom.goldBar) {
      var pct = h.goldTotal > 0 ? ((h.goldTotal - h.goldLeft) / h.goldTotal) * 100 : 0;
      this.dom.goldBar.style.width = pct.toFixed(1) + '%';
    }
    if (this.dom.hudScore) this.dom.hudScore.textContent = formatScore(h.score);
    if (this.dom.hudLives) {
      var full = Math.max(0, Math.min(3, h.lives));
      this.dom.hudLives.textContent = '♥'.repeat(full) + '♡'.repeat(3 - full);
    }
    if (this.dom.hudExit) {
      this.dom.hudExit.textContent = h.exitOpen ? this.t('exit_open') : this.t('exit_closed');
      this.dom.hudExit.classList.toggle('is-open', h.exitOpen);
    }
    if (this.dom.hudBest) this.dom.hudBest.textContent = this.t('best_short') + ' ' + formatScore(this.best);

    var dots = this.dom.lvDots ? this.dom.lvDots.children : [];
    for (var i = 0; i < dots.length; i++) {
      dots[i].className = i < g.levelIndex ? 'is-done' : (i === g.levelIndex ? 'is-active' : '');
    }
    if (this.dom.pauseBtn && this.screen !== 'pause') {
      this.dom.pauseBtn.textContent = 'Ⅱ';
    }
  };

  UI.prototype.showBanner = function () {
    var g = this.game;
    if (!this.dom.lb) return;
    this.dom.lbIndex.textContent = this.t('level_word') + ' ' + pad2(g.levelIndex + 1);
    this.dom.lbTitle.textContent = g.levelName(this.lang);
    this.dom.lbHint.textContent = g.levelHint(this.lang);
    this.dom.lb.classList.add('is-on');
    clearTimeout(this._bannerTimer);
    var self = this;
    this._bannerTimer = setTimeout(function () {
      self.hideBanner();
    }, 3000);
  };

  UI.prototype.hideBanner = function () {
    if (this._bannerTimer) { clearTimeout(this._bannerTimer); this._bannerTimer = null; }
    if (this.dom.lb) this.dom.lb.classList.remove('is-on');
  };

  UI.prototype.toast = function (text, ms) {
    if (!this.dom.toast) return;
    this.dom.toast.textContent = text;
    this.dom.toast.classList.add('is-on');
    clearTimeout(this._toastTimer);
    var self = this;
    this._toastTimer = setTimeout(function () {
      self.dom.toast.classList.remove('is-on');
    }, ms || 2000);
  };

  /* ---------------------------------------------------------------- ввод */

  UI.prototype.clearInput = function () {
    this.game.setInput({ left: false, right: false, up: false, down: false });
  };

  UI.prototype.bindEvents = function () {
    var self = this;

    document.addEventListener('keydown', function (e) { self.onKeyDown(e); });
    document.addEventListener('keyup', function (e) { self.onKeyUp(e); });
    document.addEventListener('pointerdown', function () { self.onGesture(); }, { passive: true });

    document.addEventListener('click', function (e) {
      var themeBtn = e.target.closest ? e.target.closest('[data-theme]') : null;
      if (themeBtn) {
        self.applyTheme(themeBtn.getAttribute('data-theme'), false);
        self.click();
        return;
      }
      var actionEl = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!actionEl) return;
      var action = actionEl.getAttribute('data-action');
      switch (action) {
        case 'theme': self.toggleTheme(); break;
        case 'lang': self.toggleLang(); break;
        case 'mute': self.toggleMute(); break;
        case 'pause': self.pauseToggle(); break;
        case 'start': self.startRun(); break;
        case 'help': self.showHelp(); break;
        case 'close-help': self.closeHelp(); break;
        case 'resume': self.resume(); break;
        case 'restart': self.restart(); break;
        case 'menu': self.menu(); break;
        case 'next': self.advance(); break;
        case 'again': self.startRun(); break;
        default: break;
      }
      if (document.activeElement && document.activeElement.blur) {
        try { document.activeElement.blur(); } catch (err) { /* ok */ }
      }
    });

    // touch
    var touchBtns = document.querySelectorAll('[data-touch]');
    for (var i = 0; i < touchBtns.length; i++) {
      (function (btn) {
        var type = btn.getAttribute('data-touch');
        function down(e) {
          e.preventDefault();
          self.onGesture();
          if (self.screen !== 'none' || self.game.state !== 'playing') return;
          btn.classList.add('is-down');
          if (type === 'digL') self.game.dig(-1);
          else if (type === 'digR') self.game.dig(1);
          else if (TOUCH_KEYS[type]) {
            self.game.input[type] = true;
            if (self.audio && self.audio.sfx) {
              try { self.audio.sfx('click'); } catch (err) { /* ok */ }
            }
          }
        }
        function up(e) {
          if (e) e.preventDefault();
          btn.classList.remove('is-down');
          if (TOUCH_KEYS[type]) self.game.input[type] = false;
        }
        btn.addEventListener('pointerdown', down);
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointercancel', up);
        btn.addEventListener('pointerleave', up);
      })(touchBtns[i]);
    }
    window.addEventListener('pointerup', function () {
      self.clearInput();
      var els = document.querySelectorAll('.is-down');
      for (var k = 0; k < els.length; k++) els[k].classList.remove('is-down');
    });

    window.addEventListener('blur', function () {
      if (self.screen === 'none' && self.game.state === 'playing') self.pauseToggle();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && self.screen === 'none' && self.game.state === 'playing') self.pauseToggle();
    });
  };

  UI.prototype.onKeyDown = function (e) {
    var code = e.code || '';
    var repeat = !!e.repeat;
    this.onGesture();

    // глобальные переключатели
    if (!repeat) {
      if (code === 'KeyG') { e.preventDefault(); this.toggleTheme(); return; }
      if (code === 'KeyM') { e.preventDefault(); this.toggleMute(); return; }
      if (code === 'KeyL') { e.preventDefault(); this.toggleLang(); return; }
    }

    if (code === 'Escape' || code === 'KeyP') {
      if (this.screen === 'pause') { e.preventDefault(); this.resume(); return; }
      if (this.screen === 'help') { e.preventDefault(); this.closeHelp(); return; }
      if (this.screen === 'none' && this.game.state === 'playing') { e.preventDefault(); this.pauseToggle(); return; }
      if (code === 'Escape' && (this.screen === 'complete' || this.screen === 'gameover' || this.screen === 'victory')) {
        e.preventDefault();
        this.menu();
        return;
      }
      return;
    }

    if (code === 'Enter' || code === 'NumpadEnter') {
      if (['title', 'help', 'pause', 'complete', 'gameover', 'victory'].indexOf(this.screen) >= 0) {
        e.preventDefault();
        this.advance();
        return;
      }
    }

    if (this.screen !== 'none' || this.paused || this.game.state !== 'playing') return;

    var map = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up',
      ArrowDown: 'down', KeyS: 'down'
    };
    if (map[code]) {
      e.preventDefault();
      this.game.input[map[code]] = true;
      return;
    }
    if (!repeat && (code === 'KeyZ' || code === 'Comma' || code === 'BracketLeft')) {
      e.preventDefault();
      this.game.dig(-1);
      return;
    }
    if (!repeat && (code === 'KeyX' || code === 'Period' || code === 'BracketRight')) {
      e.preventDefault();
      this.game.dig(1);
      return;
    }
  };

  UI.prototype.onKeyUp = function (e) {
    var map = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up',
      ArrowDown: 'down', KeyS: 'down'
    };
    var dir = map[e.code];
    if (dir) this.game.input[dir] = false;
  };

  /* ---------------------------------------------------------------- цикл */

  UI.prototype.tick = function (dt) {
    if (!this.paused) this.game.update(dt);
    this.updateHud(false);
    if (this.renderer) this.renderer.draw(this.game, dt);
  };

  window.LR = window.LR || {};
  window.LR.UI = UI;
})();
