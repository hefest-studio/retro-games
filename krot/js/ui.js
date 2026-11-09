/* ============================================================================
   DIGGER · js/ui.js — DOM-оверлеи: титул, настройки, справка, «Об игре»,
   пауза, game over. Владелец: ui-i18n. См. CONTRACT.md §6.2, §6.4.

   Только разметка + вызовы колбэков из DG.ui.init(opts). Игровая логика,
   пауза, старт/рестарт и сохранение рекорда — в main.js (через колбэки).
   Все строки — через DG.t (RU/EN), разметка собирается в #ui Lead-каркаса.
   ========================================================================== */
(function (global) {
  'use strict';
  var DG = global.DG = global.DG || {};
  var doc = global.document;

  /* ------------------------------- утилиты -------------------------------- */
  function noop() {}
  function t(key, vars) { return DG.t ? DG.t(key, vars) : key; }

  /** HTML-экранирование динамических значений (числа/строки из data). */
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function num(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) n = 0;
    return String(Math.round(n));
  }

  /** Аркадная запись очков: ведущие нули до 6 разрядов. */
  function pad(value) {
    var s = num(value);
    while (s.length < 6) s = '0' + s;
    return s;
  }

  function isShotMode() {
    return !!(doc && doc.body && doc.body.classList && doc.body.classList.contains('shot'));
  }

  /* -------------------------------- иконки -------------------------------- */
  /* Инлайн-SVG, никаких внешних ассетов и шрифтовых иконок. */
  var ICONS = {
    close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
    pick: '<path d="M3.5 20.5l7.5-7.5"/><path d="M7.5 6.8c3.4-2.1 8.2-1.2 10.8 2.4l-2.4 1.4c-1.9-2.2-4.4-2.7-6.8-1.8z"/><path d="M13.4 11.6l4.6-2.4"/>',
    gem: '<path d="M12 2.8l7.2 6.4L12 21.2 4.8 9.2z"/><path d="M4.8 9.2h14.4"/><path d="M12 2.8l-2.6 6.4L12 21.2l2.6-12z"/>',
    bag: '<path d="M8 8h8l2.4 11.4H5.6z"/><path d="M9.5 8V6.6A2.5 2.5 0 0112 4.1a2.5 2.5 0 012.5 2.5V8"/><path d="M12 11.2v4.8M10.4 11.6h3.2M10.4 15.6h3.2"/>',
    monster: '<path d="M4 19.5v-7.2a8 8 0 0116 0v7.2h-2.6l-1-1.9-1.4 1.9h-6l-1.4-1.9-1 1.9z"/><circle cx="9" cy="10.5" r="1.25" fill="currentColor" stroke="none"/><circle cx="15" cy="10.5" r="1.25" fill="currentColor" stroke="none"/>',
    cherry: '<circle cx="8.3" cy="16.6" r="4"/><circle cx="16.4" cy="18" r="3.2"/><path d="M8.3 12.6C9.3 7.6 12 5.4 16 4.4"/><path d="M16.4 14.8c0-3 1-5 3-6.6"/>',
    weapon: '<path d="M3 12h11"/><path d="M12.8 6.6L19.4 12l-6.6 5.4z"/>',
    crt: '<rect x="3" y="5" width="18" height="12.5" rx="2"/><path d="M8 21.5h8M12 17.5v4"/><path d="M6.5 9.5h11M6.5 13h7"/>',
    neon: '<path d="M12 2.8l2.1 6.1 6.1 2.1-6.1 2.1L12 19.2l-2.1-6.1L3.8 11l6.1-2.1z"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7.5 14h9"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    book: '<path d="M4 5.6A2.6 2.6 0 016.6 3H20v16H6.6A2.6 2.6 0 004 21.6z"/><path d="M4 18.4A2.6 2.6 0 016.6 15.8H20"/>',
    chip: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    pause: '<rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/>',
    rotate: '<path d="M4 9a8 8 0 0113.5-3.5L20 8"/><path d="M20 3v5h-5"/><path d="M20 15a8 8 0 01-13.5 3.5L4 16"/><path d="M4 21v-5h5"/>'
  };

  function icon(name) {
    var body = ICONS[name] || ICONS.info;
    return '<svg class="dg-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  /* ------------------------------ состояние ------------------------------- */
  var options = {
    getSettings: null, setSetting: null,
    start: noop, resume: noop, restart: noop, menu: noop,
    getHiscore: null, resetHi: null,
    openPanel: null, closePanel: null
  };
  var root = null;          // #ui
  var current = null;       // имя открытого экрана
  var data = {};            // данные текущего экрана
  var rendered = null;      // какой экран сейчас в DOM (для анимации входа)
  var renderSeq = 0;        // счётчик перерисовок (чтобы не рисовать дважды)
  var resetFlash = false;   // показать «Рекорд сброшен»
  var resetTimer = 0;
  var bound = false;

  var SCREENS = ['title', 'settings', 'help', 'about', 'pause', 'gameover'];
  var LABEL_KEYS = {
    title: 'appTitle', settings: 'settings', help: 'help',
    about: 'about', pause: 'paused', gameover: 'gameover'
  };

  function settings() {
    var s = null;
    try { if (typeof options.getSettings === 'function') s = options.getSettings(); } catch (e) { s = null; }
    s = s || {};
    return {
      gfx: s.gfx === 'modern' ? 'modern' : 'classic',
      lang: s.lang === 'en' ? 'en' : 'ru',
      music: s.music !== false,
      sfx: s.sfx !== false,
      crt: s.crt !== false
    };
  }

  function hiscore(fallback) {
    var v = null;
    try { if (typeof options.getHiscore === 'function') v = options.getHiscore(); } catch (e) { v = null; }
    if (v == null || !isFinite(Number(v))) v = fallback;
    if (v == null || !isFinite(Number(v))) v = 0;
    return Math.max(0, Number(v) || 0);
  }

  function fire(name) {
    try {
      if (typeof options[name] === 'function') options[name]();
    } catch (e) { /* ошибку покажет main.js через свой error-хендлер */ }
  }

  function setSetting(key, value) {
    try {
      if (typeof options.setSetting === 'function') options.setSetting(key, value);
    } catch (e) { /* см. fire() */ }
  }

  function openPanel(name) {
    if (typeof options.openPanel === 'function') {
      try { options.openPanel(name); return; } catch (e) { /* fallback ниже */ }
    }
    api.show(name);
  }

  function closePanel() {
    if (typeof options.closePanel === 'function') {
      try { options.closePanel(); return; } catch (e) { /* fallback ниже */ }
    }
    api.show(null);
  }

  /* ----------------------------- компоненты ------------------------------- */
  function btn(label, action, value, mods, focusKey, primary) {
    var cls = 'dg-btn' + (mods ? ' ' + mods : '');
    var attrs = ' data-action="' + esc(action) + '"';
    if (value != null) attrs += ' data-value="' + esc(value) + '"';
    attrs += ' data-focus-key="' + esc(focusKey || action) + '"';
    if (primary) attrs += ' data-primary="1"';
    return '<button type="button" class="' + cls + '"' + attrs + '>' + label + '</button>';
  }

  function seg(key, value, entries, groupLabel) {
    var html = '<div class="dg-seg" role="group" aria-label="' + esc(groupLabel) + '">';
    for (var i = 0; i < entries.length; i++) {
      var en = entries[i];
      var active = en.value === value;
      html += '<button type="button" class="dg-seg__btn' + (active ? ' is-active' : '') + '"' +
        ' data-action="set" data-key="' + esc(key) + '" data-value="' + esc(en.value) + '"' +
        ' data-focus-key="set:' + esc(key) + ':' + esc(en.value) + '"' +
        ' aria-pressed="' + (active ? 'true' : 'false') + '">' + esc(en.label) + '</button>';
    }
    return html + '</div>';
  }

  function sw(key, label, on) {
    var state = t(on ? 'on' : 'off');
    return '<button type="button" class="dg-switch' + (on ? ' is-on' : '') + '" role="switch"' +
      ' aria-checked="' + (on ? 'true' : 'false') + '"' +
      ' aria-label="' + esc(label) + ': ' + esc(state) + '"' +
      ' data-action="toggle" data-value="' + esc(key) + '"' +
      ' data-focus-key="toggle:' + esc(key) + '">' +
      '<span class="dg-switch__track" aria-hidden="true"><span class="dg-switch__thumb"></span></span>' +
      '<span class="dg-switch__label" aria-hidden="true">' + esc(state) + '</span>' +
      '</button>';
  }

  function fieldSwitch(key, label, on) {
    return '<div class="dg-field dg-field--row">' +
      '<span class="dg-field__label">' + esc(label) + '</span>' + sw(key, label, on) + '</div>';
  }

  function choice(key, value, active, name, hint, ico) {
    return '<button type="button" class="dg-choice__btn' + (active ? ' is-active' : '') + '"' +
      ' data-action="set" data-key="' + esc(key) + '" data-value="' + esc(value) + '"' +
      ' data-focus-key="set:' + esc(key) + ':' + esc(value) + '"' +
      ' aria-pressed="' + (active ? 'true' : 'false') + '">' + icon(ico) +
      '<span class="dg-choice__txt">' +
      '<span class="dg-choice__name">' + esc(name) + '</span>' +
      '<span class="dg-choice__hint">' + esc(hint) + '</span>' +
      '</span></button>';
  }

  function panelHead(titleKey) {
    return '<header class="dg-panel__head">' +
      '<h2 class="dg-panel__title">' + esc(t(titleKey)) + '</h2>' +
      '<button type="button" class="dg-x" data-action="close" data-focus-key="close"' +
      ' aria-label="' + esc(t('close')) + '">' + icon('close') + '</button>' +
      '</header>';
  }

  function panelFoot() {
    return '<footer class="dg-panel__foot">' +
      btn(esc(t('back')), 'close', null, 'dg-btn--primary', 'back', true) +
      '<span class="dg-foot-hint">' + esc(t('navHint')) + '</span>' +
      '</footer>';
  }

  /* ------------------------------- экраны --------------------------------- */
  function screenTitle(s) {
    var hi = hiscore(data && data.hi);
    return '' +
      '<div class="dg-title">' +
        '<div class="dg-title__top">' +
          '<div class="dg-record">' +
            '<span class="dg-record__k">' + esc(t('hiScoreLabel')) + '</span>' +
            '<span class="dg-record__v">' + pad(hi) + '</span>' +
          '</div>' +
          '<span class="dg-version">' + esc(t('version')) + '</span>' +
        '</div>' +
        '<div class="dg-hero">' +
          '<h1 class="dg-logo" aria-label="' + esc(t('appTitle')) + '">' + esc(t('appTitle')) + '</h1>' +
          '<p class="dg-tagline">' + esc(t('appTagline')) + '</p>' +
        '</div>' +
        '<div class="dg-menu">' +
          btn(icon('play') + '<span>' + esc(t('play')) + '</span>', 'start', null,
            'dg-btn--primary dg-btn--xl', 'start', true) +
          '<div class="dg-menu__row">' +
            btn(esc(t('settings')), 'panel', 'settings', 'dg-btn--ghost', 'panel:settings') +
            btn(esc(t('help')), 'panel', 'help', 'dg-btn--ghost', 'panel:help') +
            btn(esc(t('about')), 'panel', 'about', 'dg-btn--ghost', 'panel:about') +
          '</div>' +
        '</div>' +
        '<div class="dg-quick">' +
          '<div class="dg-quick__item">' +
            '<span class="dg-quick__k">' + esc(t('language')) + '</span>' +
            seg('lang', s.lang, [{ value: 'ru', label: 'RU' }, { value: 'en', label: 'EN' }], t('language')) +
          '</div>' +
          '<div class="dg-quick__item">' +
            '<span class="dg-quick__k">' + esc(t('gfx')) + '</span>' +
            seg('gfx', s.gfx, [
              { value: 'classic', label: t('gfxClassic') },
              { value: 'modern', label: t('gfxModern') }
            ], t('gfx')) +
          '</div>' +
          '<div class="dg-quick__item">' +
            '<span class="dg-quick__k">' + esc(t('music')) + '</span>' + sw('music', t('music'), s.music) +
          '</div>' +
        '</div>' +
        '<p class="dg-hint dg-hint--enter">' + esc(t('pressEnter')) + '</p>' +
        '<p class="dg-hint dg-hint--touch">' + esc(t('touchMove')) + ' · ' + esc(t('touchShoot')) + '</p>' +
        '<p class="dg-rotate">' + icon('rotate') + '<span>' + esc(t('rotateHint')) + '</span></p>' +
      '</div>' +
      '<p class="dg-foot">' + esc(t('footerHint')) + '</p>';
  }

  function screenSettings(s) {
    return '' +
      '<div class="dg-panel dg-panel--settings">' +
        panelHead('settings') +
        '<div class="dg-panel__body">' +
          '<div class="dg-field">' +
            '<span class="dg-field__label">' + esc(t('gfx')) + '</span>' +
            '<div class="dg-choice">' +
              choice('gfx', 'classic', s.gfx === 'classic', t('gfxClassic'),
                t('graphicsClassicHint'), 'crt') +
              choice('gfx', 'modern', s.gfx === 'modern', t('gfxModern'),
                t('graphicsModernHint'), 'neon') +
            '</div>' +
          '</div>' +
          '<div class="dg-field dg-field--row">' +
            '<span class="dg-field__label">' + esc(t('language')) + '</span>' +
            seg('lang', s.lang, [
              { value: 'ru', label: 'RU · ' + t('langRu') },
              { value: 'en', label: 'EN · ' + t('langEn') }
            ], t('language')) +
          '</div>' +
          fieldSwitch('music', t('music'), s.music) +
          fieldSwitch('sfx', t('sfx'), s.sfx) +
          fieldSwitch('crt', t('crt'), s.crt) +
          '<div class="dg-field dg-field--row dg-field--danger">' +
            '<div class="dg-field__block">' +
              '<span class="dg-field__label">' + esc(t('resetRecord')) + '</span>' +
              '<span class="dg-field__note">' + esc(t('resetRecordHint')) + '</span>' +
            '</div>' +
            btn(esc(t('reset')), 'resetHi', null, 'dg-btn--danger dg-btn--sm', 'resetHi') +
          '</div>' +
          (resetFlash ? '<p class="dg-toast" role="status">' + esc(t('recordReset')) + '</p>' : '') +
        '</div>' +
        panelFoot() +
      '</div>';
  }

  function screenHelp() {
    var rows = [
      ['move', t('controlsMoveKeys'), 'controlsMove'],
      ['shoot', t('controlsShootKeys'), 'controlsShoot'],
      ['pause', t('controlsPauseKeys'), 'controlsPause'],
      ['menu', t('controlsMenuKeys'), 'controlsMenu'],
      ['lang', t('controlsLangKeys'), 'controlsLang'],
      ['music', t('controlsMusicKeys'), 'controlsMusic'],
      ['gfx', t('controlsGfxKeys'), 'controlsGfx'],
      ['restart', t('controlsRestartKeys'), 'controlsRestart'],
      ['help', t('controlsHelpKeys'), 'controlsHelp']
    ];
    var keysHtml = rows.map(function (row) {
      var keys = row[1].split(' / ').map(function (k) {
        return '<kbd>' + esc(k) + '</kbd>';
      }).join('');
      return '<li class="dg-keys__row">' +
        '<span class="dg-keys__keys">' + keys + '</span>' +
        '<span class="dg-keys__txt">' + esc(t(row[2])) + '</span>' +
        '</li>';
    }).join('');

    var mech = [
      ['pick', 'mechDigTitle', 'mechDig'],
      ['gem', 'mechGemsTitle', 'mechGems'],
      ['bag', 'mechBagsTitle', 'mechBags'],
      ['monster', 'mechMonstersTitle', 'mechMonsters'],
      ['cherry', 'mechBonusTitle', 'mechBonus'],
      ['weapon', 'mechWeaponTitle', 'mechWeapon']
    ];
    var mechHtml = mech.map(function (item) {
      return '<li class="dg-mech__item">' +
        '<span class="dg-mech__ico">' + icon(item[0]) + '</span>' +
        '<div class="dg-mech__body">' +
          '<b>' + esc(t(item[1])) + '</b>' +
          '<p>' + esc(t(item[2])) + '</p>' +
        '</div>' +
        '</li>';
    }).join('');

    return '' +
      '<div class="dg-panel dg-panel--wide dg-panel--scroll">' +
        panelHead('help') +
        '<div class="dg-panel__body dg-help">' +
          '<section class="dg-help__col">' +
            '<h3 class="dg-sub">' + icon('keyboard') + '<span>' + esc(t('keyboard')) + '</span></h3>' +
            '<ul class="dg-keys">' + keysHtml + '</ul>' +
            '<p class="dg-hint dg-hint--touch">' + esc(t('touchMove')) + ' · ' + esc(t('touchShoot')) + '</p>' +
          '</section>' +
          '<section class="dg-help__col">' +
            '<h3 class="dg-sub">' + icon('book') + '<span>' + esc(t('mechanics')) + '</span></h3>' +
            '<ul class="dg-mech">' + mechHtml + '</ul>' +
          '</section>' +
        '</div>' +
        panelFoot() +
      '</div>';
  }

  function screenAbout() {
    return '' +
      '<div class="dg-panel dg-panel--wide dg-panel--scroll">' +
        panelHead('about') +
        '<div class="dg-panel__body">' +
          '<p class="dg-lead">' + esc(t('aboutText')) + '</p>' +
          '<div class="dg-about-grid">' +
            '<section class="dg-about-card">' +
              '<h3>' + icon('star') + '<span>' + esc(t('originalGame')) + '</span></h3>' +
              '<p>' + esc(t('aboutOriginal')) + '</p>' +
            '</section>' +
            '<section class="dg-about-card">' +
              '<h3>' + icon('chip') + '<span>' + esc(t('technology')) + '</span></h3>' +
              '<p>' + esc(t('aboutTech')) + '</p>' +
            '</section>' +
          '</div>' +
          '<section class="dg-about-card dg-about-card--credits">' +
            '<h3>' + icon('book') + '<span>' + esc(t('credits')) + '</span></h3>' +
            '<p>' + esc(t('aboutCredits')) + '</p>' +
          '</section>' +
          '<div class="dg-about-meta">' +
            '<span>' + esc(t('version')) + '</span>' +
            '<span>' + esc(t('fanPort')) + ' · 2026</span>' +
          '</div>' +
        '</div>' +
        panelFoot() +
      '</div>';
  }

  function screenPause() {
    return '' +
      '<div class="dg-panel dg-panel--pause">' +
        '<div class="dg-pause__head">' +
          '<span class="dg-pause__ico" aria-hidden="true">' + icon('pause') + '</span>' +
          '<h2 class="dg-panel__title">' + esc(t('paused')) + '</h2>' +
        '</div>' +
        '<div class="dg-panel__body dg-pause__body">' +
          btn(esc(t('resume')), 'resume', null, 'dg-btn--primary dg-btn--block', 'resume', true) +
          btn(esc(t('restart')), 'restart', null, 'dg-btn--ghost dg-btn--block', 'restart') +
          btn(esc(t('settings')), 'panel', 'settings', 'dg-btn--ghost dg-btn--block', 'panel:settings') +
          btn(esc(t('toMenu')), 'menu', null, 'dg-btn--ghost dg-btn--block', 'menu') +
          '<p class="dg-hint dg-hint--small">' + esc(t('escBack')) + '</p>' +
        '</div>' +
      '</div>';
  }

  function statsHtml(stats) {
    if (!stats || typeof stats !== 'object') return '';
    var defs = [
      ['gems', 'statGems'], ['kills', 'statKills'], ['levels', 'statLevels'],
      ['bagKills', 'statBags'], ['dug', 'statDug'], ['shots', 'statShots']
    ];
    var rows = '';
    var positive = false;
    for (var i = 0; i < defs.length; i++) {
      var v = stats[defs[i][0]];
      if (v == null || !isFinite(Number(v))) continue;
      if (Number(v) > 0) positive = true;
      rows += '<div class="dg-stats__item">' +
        '<span class="dg-stats__k">' + esc(t(defs[i][1])) + '</span>' +
        '<span class="dg-stats__v">' + num(v) + '</span>' +
        '</div>';
    }
    // Все нули (например, debug-скриншот) — блок скрываем, чтобы не выглядел пустым.
    return rows && positive ? '<div class="dg-stats">' + rows + '</div>' : '';
  }

  function screenGameover() {
    var d = data || {};
    var score = Number(d.score) || 0;
    var hi = hiscore(d.hi);
    var isRecord = !!(d.record || score > hi && score > 0);
    if (score > hi) hi = score;
    return '' +
      '<div class="dg-panel dg-panel--over">' +
        '<h2 class="dg-over__title">' + esc(t('gameover')) + '</h2>' +
        (isRecord ? '<div class="dg-badge">' + icon('star') + '<span>' + esc(t('newRecord')) + '</span></div>' : '') +
        '<div class="dg-scoreboard">' +
          '<span class="dg-scoreboard__k">' + esc(t('yourScore')) + '</span>' +
          '<strong class="dg-scoreboard__v">' + pad(score) + '</strong>' +
          '<span class="dg-scoreboard__hi">' + esc(t('hiscore')) + ' <b>' + pad(hi) + '</b></span>' +
        '</div>' +
        statsHtml(d.stats) +
        '<div class="dg-actions">' +
          btn(esc(t('playAgain')), 'restart', null, 'dg-btn--primary', 'restart', true) +
          btn(esc(t('toMenu')), 'menu', null, 'dg-btn--ghost', 'menu') +
        '</div>' +
      '</div>';
  }

  var RENDER = {
    title: function () { return screenTitle(settings()); },
    settings: function () { return screenSettings(settings()); },
    help: screenHelp,
    about: screenAbout,
    pause: screenPause,
    gameover: screenGameover
  };

  /* ------------------------------ рендеринг ------------------------------- */
  function ensureRoot() {
    if (root && root.parentNode) return root;
    if (!doc) return null;
    root = doc.getElementById('ui');
    if (!root) {
      var stage = doc.getElementById('stage') || doc.body;
      if (!stage) return null;
      root = doc.createElement('div');
      root.id = 'ui';
      stage.appendChild(root);
    }
    if (!bound) {
      bound = true;
      root.addEventListener('click', onRootClick);
      bindViewport();
    }
    return root;
  }

  /* ------------------- подсказка «поверните устройство» ------------------- */
  /* Живёт в #ui постоянно: во время игры экранов нет, поэтому элемент
     пересоздаётся после каждой перерисовки/очистки #ui. */
  var rotateEl = null;

  function isPortraitPhone() {
    if (!global.matchMedia) return false;
    try { return global.matchMedia('(max-width: 720px) and (orientation: portrait)').matches; }
    catch (e) { return false; }
  }

  function updateRotateOverlay() {
    ensureRoot();
    if (!root) return;
    if (!rotateEl || rotateEl.parentNode !== root) {
      rotateEl = root.querySelector('.dg-rotate-overlay');
      if (!rotateEl) {
        rotateEl = doc.createElement('div');
        rotateEl.className = 'dg-rotate-overlay';
        rotateEl.setAttribute('aria-hidden', 'true');
        root.appendChild(rotateEl);
      }
    }
    var show = !current && isPortraitPhone();
    rotateEl.classList.toggle('is-visible', show);
    if (show) {
      var text = t('rotateHint');
      if (rotateEl.__dgText !== text) {
        rotateEl.innerHTML = icon('rotate') + '<span>' + esc(text) + '</span>';
        rotateEl.__dgText = text;
      }
    } else if (rotateEl.innerHTML) {
      rotateEl.innerHTML = '';
      rotateEl.__dgText = '';
    }
  }

  function bindViewport() {
    if (!global.matchMedia) return;
    try {
      var mq = global.matchMedia('(max-width: 720px) and (orientation: portrait)');
      var handler = function () { updateRotateOverlay(); };
      if (mq.addEventListener) mq.addEventListener('change', handler);
      else if (mq.addListener) mq.addListener(handler);
      global.addEventListener('resize', handler);
      global.addEventListener('orientationchange', handler);
    } catch (e) { /* без медиа-запросов играем без подсказки */ }
  }

  function focusedKey() {
    try {
      var el = doc.activeElement;
      if (el && root && root.contains(el) && el.getAttribute) {
        return el.getAttribute('data-focus-key');
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  /* Куда ставить фокус по умолчанию: настройки — на активный контрол,
     остальные панели — на основное действие. */
  var DEFAULT_FOCUS = {
    settings: '.dg-choice__btn.is-active, .dg-seg__btn.is-active, .dg-panel__body .dg-switch',
    help: '[data-primary="1"]',
    about: '[data-primary="1"]',
    pause: '[data-primary="1"]',
    gameover: '[data-primary="1"]'
  };

  function focusInitial(restoreKey) {
    if (!root || isShotMode()) return;
    var target = null;
    if (restoreKey) {
      try { target = root.querySelector('[data-focus-key="' + restoreKey.replace(/"/g, '\\"') + '"]'); }
      catch (e) { target = null; }
    }
    if (!target && DEFAULT_FOCUS[current]) {
      try { target = root.querySelector(DEFAULT_FOCUS[current]); } catch (e2) { target = null; }
    }
    if (!target && current !== 'title') {
      target = root.querySelector('[data-primary="1"]') || root.querySelector('.dg-btn');
    }
    if (!target) return;
    try { target.focus({ preventScroll: true }); }
    catch (e) { try { target.focus(); } catch (e2) { /* ignore */ } }
  }

  function paint() {
    if (!current) return;
    ensureRoot();
    if (!root) return;
    var restore = focusedKey();
    var label = t(LABEL_KEYS[current] || 'appTitle');
    var animate = rendered !== current;
    var cls = 'dg-screen dg-screen--' + current + (animate ? ' dg-screen--enter' : '');
    var inner = RENDER[current] ? RENDER[current]() : '';
    root.innerHTML = '<section class="' + cls + '" role="dialog" aria-modal="true"' +
      ' aria-label="' + esc(label) + '" data-screen="' + esc(current) + '">' + inner + '</section>';
    root.classList.add('dg-open');
    root.setAttribute('aria-hidden', 'false');
    rendered = current;
    renderSeq++;
    updateRotateOverlay();
    focusInitial(restore);
  }

  function clearDom() {
    if (!root) return;
    root.innerHTML = '';
    root.classList.remove('dg-open');
    root.removeAttribute('data-screen');
    root.setAttribute('aria-hidden', 'true');
    rendered = null;
    updateRotateOverlay();
  }

  function show(name, payload) {
    if (!name) { hide(); return api; }
    name = String(name);
    if (SCREENS.indexOf(name) < 0) name = 'title';
    current = name;
    data = payload || {};
    if (name !== 'settings') resetFlash = false;
    paint();
    return api;
  }

  function hide() {
    current = null;
    data = {};
    resetFlash = false;
    if (resetTimer) { global.clearTimeout(resetTimer); resetTimer = 0; }
    clearDom();
    return api;
  }

  function refresh() {
    if (current) paint();
    else updateRotateOverlay();
    return api;
  }

  /* --------------------------- действия кнопок ---------------------------- */
  function onRootClick(e) {
    if (!current) return;
    var el = e.target;
    while (el && el !== root && !(el.getAttribute && el.getAttribute('data-action'))) {
      el = el.parentNode;
    }
    if (!el || el === root) return;
    if (el.disabled) return;
    e.preventDefault();
    fireClickSfx();
    var action = el.getAttribute('data-action');
    var value = el.getAttribute('data-value');
    var key = el.getAttribute('data-key');
    handle(action, value, key);
  }

  function fireClickSfx() {
    try {
      if (DG.audio && typeof DG.audio.sfx === 'function') DG.audio.sfx('ui_click');
    } catch (e) { /* без звука тоже играбельно */ }
  }

  function handle(action, value, key) {
    switch (action) {
      case 'start': fire('start'); break;
      case 'resume': fire('resume'); break;
      case 'restart': fire('restart'); break;
      case 'menu': fire('menu'); break;
      case 'panel': openPanel(value); break;
      case 'close': closePanel(); break;
      case 'set': applySet(key, value); break;
      case 'toggle': toggle(key || value); break;
      case 'resetHi': resetHiscore(); break;
      default: break;
    }
  }

  function applySet(key, value) {
    if (!key) return;
    var before = renderSeq;
    setSetting(key, value);
    // Если main.js не перерисовал экран сам (кастомный setSetting) — рисуем здесь.
    if (key === 'lang' && DG.i18n && typeof DG.i18n.setLang === 'function' && DG.i18n.lang !== value) {
      try { DG.i18n.setLang(value); } catch (e) { /* ignore */ }
    }
    if (renderSeq === before) paint();
  }

  function toggle(key) {
    if (key !== 'music' && key !== 'sfx' && key !== 'crt') return;
    var s = settings();
    var next = !s[key];
    var before = renderSeq;
    setSetting(key, next);
    if (renderSeq === before) paint();
  }

  function resetHiscore() {
    try { if (typeof options.resetHi === 'function') options.resetHi(); } catch (e) { /* ignore */ }
    resetFlash = true;
    paint();
    if (resetTimer) global.clearTimeout(resetTimer);
    resetTimer = global.setTimeout(function () {
      resetTimer = 0;
      resetFlash = false;
      if (current === 'settings') paint();
    }, 2600);
  }

  /* -------------------------------- публичный API ------------------------- */
  var api = {
    /** opts: getSettings, setSetting, start, resume, restart, menu,
     *        getHiscore, resetHi, openPanel, closePanel. */
    init: function (opts) {
      opts = opts || {};
      ['getSettings', 'setSetting', 'start', 'resume', 'restart', 'menu',
        'getHiscore', 'resetHi', 'openPanel', 'closePanel'].forEach(function (key) {
        if (typeof opts[key] === 'function') options[key] = opts[key];
      });
      ensureRoot();
      if (root) {
        root.setAttribute('aria-hidden', current ? 'false' : 'true');
        if (!root.classList.contains('dg-ui')) root.classList.add('dg-ui');
        updateRotateOverlay();
      }
      return api;
    },

    show: show,
    refresh: refresh,
    isOpen: function () { return !!current; },
    current: function () { return current; },

    /** Enter при открытой панели (main.js): активировать фокус или основное действие. */
    activate: function () {
      if (!current) return false;
      ensureRoot();
      if (!root) return false;
      var el = doc.activeElement;
      if (el && el !== doc.body && root.contains(el) &&
          String(el.tagName || '').toLowerCase() === 'button' && !el.disabled) {
        el.click();
        return true;
      }
      var primary = root.querySelector('[data-primary="1"]') || root.querySelector('.dg-btn');
      if (primary) { primary.click(); return true; }
      return false;
    },

    /** Совместимость с rAF-циклом main.js: HUD рисует рендерер, DOM-синк не нужен. */
    sync: function () {}
  };

  DG.ui = api;
})(window);
