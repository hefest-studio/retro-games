/* ui.js — СЕВЕРНАЯ САГА 2 · СТУДИЯ ГЕФЕСТ
   Интерфейс: экраны, HUD, тосты, справка, чипы настроек, сенсорное управление.
   Правила: DOM трогаем только из init(); игру не трогаем — только callbacks и getState.
   API §7: SAGA2.ui {init, screen, updateHud, toast, setMode, setLang, setMuted, setSaveInfo}. */
window.SAGA2 = window.SAGA2 || {};
(function () {
  'use strict';

  /* ============================ утилиты ============================ */

  function T(key, vars) {
    return window.SAGA2 && SAGA2.i18n && SAGA2.i18n.t ? SAGA2.i18n.t(key, vars) : String(key);
  }
  function L(key) {
    return window.SAGA2 && SAGA2.i18n && SAGA2.i18n.list ? SAGA2.i18n.list(key) : [];
  }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function nz() { // первое числовое значение из аргументов
    for (var i = 0; i < arguments.length; i++) if (isNum(arguments[i])) return arguments[i];
    return 0;
  }
  function nzStr() {
    for (var i = 0; i < arguments.length; i++) {
      var v = arguments[i];
      if (typeof v === 'string' && v) return v;
    }
    return '';
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pad2(n) { n = Math.max(0, Math.floor(nz(n, 0))); return (n < 10 ? '0' : '') + n; }
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(nz(sec, 0)));
    var m = Math.floor(sec / 60), s = sec % 60;
    return pad2(m) + ':' + pad2(s);
  }
  function fmtNum(v) {
    var n = Math.round(nz(v, 0));
    var neg = n < 0; n = Math.abs(n);
    var s = String(n), out = '';
    while (s.length > 3) { out = '\u2009' + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? '\u2212' : '') + s + out;
  }
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  var NS = 'http://www.w3.org/2000/svg';

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!hasOwn(attrs, k)) continue;
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class' || k === 'className') el.className = v;
        else if (k === 'text') el.textContent = String(v);
        else if (k === 'dataset') {
          for (var d in v) if (hasOwn(v, d)) el.dataset[d] = String(v[d]);
        } else if (k.indexOf('on') === 0 && typeof v === 'function') {
          el.addEventListener(k.slice(2), v);
        } else if (k === 'style' && typeof v === 'object') {
          for (var s in v) if (hasOwn(v, s)) el.style[s] = v[s];
        } else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, String(v));
      }
    }
    if (kids) appendKids(el, kids);
    return el;
  }
  function appendKids(el, kids) {
    if (kids == null || kids === false) return;
    if (!Array.isArray(kids)) {
      el.appendChild(kids && kids.nodeType ? kids : document.createTextNode(String(kids)));
      return;
    }
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k == null || k === false) continue;
      el.appendChild(k && k.nodeType ? k : document.createTextNode(String(k)));
    }
  }
  function clear(node) { if (node) while (node.firstChild) node.removeChild(node.firstChild); }

  /* ---------- иконки (только SVG-пути, без внешних ассетов) ---------- */
  var ICONS = {
    spark: ['M12 3.5l1.7 5.3 5.3 1.7-5.3 1.7L12 17.5l-1.7-5.3L5 10.5l5.3-1.7z'],
    warn: ['M12 4l8.5 15h-17z', 'M12 9.5v4.2', 'M12 16.6h.01'],
    play: ['M9.2 5.6v12.8L19 12z'],
    pause: ['M9.3 5.5v13', 'M14.7 5.5v13'],
    chevronLeft: ['M14.5 5.5L8 12l6.5 6.5'],
    chevronRight: ['M9.5 5.5L16 12l-6.5 6.5'],
    chevronUp: ['M5.5 14.5L12 8l6.5 6.5'],
    chevronDown: ['M5.5 9.5L12 16l6.5-6.5'],
    close: ['M6 6l12 12', 'M18 6L6 18'],
    help: ['M12 3a9 9 0 100 18 9 9 0 000-18', 'M9.5 9.4a2.6 2.6 0 114.4 2.2c-.8.7-1.6 1.2-1.6 2.6', 'M12.3 17.4h.01'],
    soundOn: ['M4 9.4h3.1L12 6v12l-4.9-3.4H4z', 'M15.4 9.2a4 4 0 010 5.6', 'M18 6.6a7.6 7.6 0 010 10.8'],
    soundOff: ['M4 9.4h3.1L12 6v12l-4.9-3.4H4z', 'M16 9.6l4.6 4.6', 'M20.6 9.6L16 14.2'],
    lock: ['M7.2 10.4V8.2a4.8 4.8 0 019.6 0v2.2', 'M5.6 10.4h12.8V20H5.6z', 'M12 13.8v2.6'],
    rune: ['M12 3v18', 'M12 8.5L6.2 3.6', 'M12 8.5l5.8-4.9'],
    portal: ['M6.4 21V9.6a5.6 5.6 0 0111.2 0V21', 'M10.6 21v-5.2a1.4 1.4 0 012.8 0V21', 'M3.5 21h17'],
    check: ['M5 12.6l4.4 4.4L19 6.6'],
    heart: ['M12 20.4C8.2 17.4 3.8 14 3.8 9.8 3.8 7 5.9 4.8 8.6 4.8c1.6 0 2.8.8 3.4 1.9.6-1.1 1.8-1.9 3.4-1.9 2.7 0 4.8 2.2 4.8 5 0 4.2-4.4 7.6-8.2 10.6z'],
    restart: ['M4.2 5.2v5h5', 'M4.9 10.2A8 8 0 1112 20a8 8 0 01-6.6-3.5'],
    home: ['M4 11l8-7 8 7', 'M6.6 9.6V20h10.8V9.6', 'M10.2 20v-5h3.6v5'],
    switch: ['M6 8.2h11l-3-3', 'M18 15.8H7l3 3'],
    headbutt: ['M4.6 12.2h14.8', 'M6.6 12.2a5.4 5.4 0 0110.8 0v3H6.6z', 'M2.4 10.8L4.6 9.6'],
    glide: ['M20 4C11.4 4 5.6 8.6 4.4 19c9-.2 14.6-5.2 15.6-15z', 'M4.6 18.8L14.2 9.2'],
    sword: ['M4.6 19.4l8-8', 'M10.4 6.8l3.8-3.8 6.8 6.8-3.8 3.8z', 'M12.6 9l2.4 2.4'], // молот (id способности прежний)
    bow: ['M3.6 12h12.8', 'M14 4.4c2.8 2.4 2.8 12.8 0 15.2', 'M14 4.4L9.4 12l4.6 7.6', 'M17.6 9.8l2.6 2.2-2.6 2.2'], // арбалет
    hook: ['M12 3v8a4 4 0 108 0', 'M9 3h6'],
    shield: ['M12 3l7 2.8v5.4c0 4.2-3 7.6-7 9.8-4-2.2-7-5.6-7-9.8V5.8z'],
    snow: ['M12 3v18', 'M4.2 7.5l15.6 9', 'M19.8 7.5l-15.6 9'],
    info: ['M12 3a9 9 0 100 18 9 9 0 000-18', 'M12 11v6', 'M12 7.6h.01']
  };

  function svgEl(name, opts) {
    opts = opts || {};
    var paths = ICONS[name] || ICONS.spark;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', String(opts.weight || 1.6));
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', String(opts.size || 24));
    svg.setAttribute('height', String(opts.size || 24));
    if (opts['class']) svg.setAttribute('class', opts['class']);
    for (var i = 0; i < paths.length; i++) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', paths[i]);
      svg.appendChild(p);
    }
    return svg;
  }

  /* ---------- портреты-заглушки (если render.drawPortrait недоступен) ---------- */
  // viewBox 0 0 64 74: Таран — капюшон с хвостом и наплечник; Стрелок — меховая шапка и шарф;
  // Опора — кузнечные очки на лбу и борода-косица
  var PORTRAITS = {
    snorri: [
      'M12 68c1.6-12.5 9.2-18.5 20-18.5S50.4 55.5 52 68',
      'M22 29c0-8.4 4.5-13.6 10-13.6s10 5.2 10 13.6v4.6c0 7-4.5 11.8-10 11.8s-10-4.8-10-11.8z',
      'M17.4 46c-3-6.6-3.4-16 .4-23.4C21 16 26.2 11.6 32 11.6s11 4.4 14.2 11c3.8 7.4 3.4 16.8.4 23.4',
      'M17.8 22.6c-3.6 1.2-6.2 4.4-7 9.4',
      'M27 33h1.8', 'M35.2 33H37',
      'M28.6 40.6c2.2 1.2 4.6 1.2 6.8 0',
      'M41 50.4c3.4-2.6 7.6-3 10.6-.6'
    ],
    gunnar: [
      'M11 68c1.8-12.8 9.6-19 21-19s19.2 6.2 21 19',
      'M20.4 29c0-9 5-14.6 11.6-14.6S43.6 20 43.6 29v4.4c0 7.4-5 12.4-11.6 12.4S20.4 40.8 20.4 33.4z',
      'M19 24.6V12.2C19 7 25 4.6 32 4.6S45 7 45 12.2v12.4',
      'M18 24.6h28',
      'M26 31.4h2', 'M36 31.4h2',
      'M20.4 37.2c7.6-2.6 15.6-2.6 23.2 0v5.6c-7.6 2.6-15.6 2.6-23.2 0z',
      'M40.6 43.6l3.4 10.6'
    ],
    bjorn: [
      'M8.4 68c2-13.6 10.4-20 23.6-20s21.6 6.4 23.6 20',
      'M20.2 28.6c0-9.2 5.2-15.2 11.8-15.2s11.8 6 11.8 15.2v4.8c0 7.8-5.2 13.4-11.8 13.4s-11.8-5.6-11.8-13.4z',
      'M20.6 23.4h22.8',
      'M27.4 22.4a3.4 3.4 0 1 0 0.01 0', 'M36.6 22.4a3.4 3.4 0 1 0 0.01 0',
      'M27.4 32h1.8', 'M34.8 32h1.8',
      'M22.4 38.4c2.4 5.4 5.6 8.2 9.6 8.2s7.2-2.8 9.6-8.2',
      'M32 46.6v8.4', 'M30.4 55h3.2'
    ]
  };
  function portraitEl(id) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 64 74');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '64');
    svg.setAttribute('height', '74');
    svg.setAttribute('class', 'portrait__fallback');
    var list = PORTRAITS[id] || PORTRAITS.snorri;
    for (var i = 0; i < list.length; i++) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', list[i]);
      svg.appendChild(p);
    }
    return svg;
  }

  /* ============================ данные ============================ */

  var NORTHMEN = [
    { id: 'snorri', abilities: ['headbutt', 'glide'] },
    { id: 'gunnar', abilities: ['sword', 'bow', 'hook'] },
    { id: 'bjorn', abilities: ['shield'] }
  ];
  var NORTHMAN_MAP = {};
  for (var vi = 0; vi < NORTHMEN.length; vi++) NORTHMAN_MAP[NORTHMEN[vi].id] = NORTHMEN[vi];

  // способности для сенсорных кнопок: action (J), special (K/Space), hook (L)
  var TOUCH_ABILITIES = {
    snorri: { action: 'headbutt', special: 'glide', hook: null },
    gunnar: { action: 'sword', special: 'bow', hook: 'hook' },
    bjorn: { action: 'shield', special: null, hook: null }
  };

  var SCREENS = ['title', 'levels', 'brief', 'play', 'pause', 'complete', 'ending'];

  var st = {
    inited: false,
    callbacks: {},
    getState: null,
    mode: 'retro',
    lang: 'ru',
    muted: false,
    save: { unlocked: 1, hasProgress: false, levels: {} },
    screen: 'title',
    prevScreen: null,
    data: null,
    playData: null,
    briefIndex: 0,
    resultData: null,
    endingData: null,
    helpOpen: false,
    helpReturnFocus: null,
    hudState: null,
    hud: null,
    touch: false,
    touchForced: null
  };

  var refs = {
    root: null, help: null, toasts: null, stage: null, canvas: null,
    play: null, hud: null, portraits: [], touch: null
  };

  /* ============================ общие элементы ============================ */

  function safeCall(name, a, b) {
    var fn = st.callbacks ? st.callbacks[name] : null;
    if (typeof fn !== 'function') return;
    try { fn(a, b); } catch (e) { /* UI не должен падать из-за main */ }
  }

  function uiSfx(name) {
    try {
      if (window.SAGA2 && SAGA2.audio && typeof SAGA2.audio.sfx === 'function') SAGA2.audio.sfx(name);
    } catch (e) { /* no-op */ }
  }

  function focusableEls(scope) {
    if (!scope) return [];
    var list = scope.querySelectorAll('button:not([disabled]), [href], [tabindex="0"]');
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.getAttribute('aria-hidden') === 'true') continue;
      if (el.offsetParent === null && el !== document.activeElement) continue;
      out.push(el);
    }
    return out;
  }

  function focusEl(el) {
    if (!el || typeof el.focus !== 'function') return;
    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) { /* no-op */ } }
  }

  function captureFocus() {
    var a = document.activeElement;
    if (!a || !a.getAttribute) return null;
    if (a.getAttribute('data-chip')) return { chip: a.getAttribute('data-chip') };
    var k = a.getAttribute('data-focus');
    return k ? { focus: k } : null;
  }
  function restoreFocus(info) {
    if (!info) return;
    var el = null;
    if (info.chip) el = refs.root ? refs.root.querySelector('[data-chip="' + info.chip + '"]') : null;
    if (!el && refs.help && st.helpOpen) el = refs.help.querySelector('[data-focus="' + info.focus + '"]');
    if (!el && info.focus && refs.root) el = refs.root.querySelector('[data-focus="' + info.focus + '"]');
    if (el) focusEl(el);
  }

  function setText(node, text) {
    if (node && node.textContent !== text) node.textContent = text;
  }
  function toggleCls(node, cls, on) {
    if (!node) return;
    if (on) { if (!node.classList.contains(cls)) node.classList.add(cls); }
    else if (node.classList.contains(cls)) node.classList.remove(cls);
  }
  function setAttr(node, name, value) {
    if (!node) return;
    if (node.getAttribute(name) !== value) node.setAttribute(name, value);
  }

  function btn(label, opts) {
    opts = opts || {};
    var cls = 'btn btn--' + (opts.variant || 'ghost') + (opts.wide ? ' btn--wide' : '') + (opts.cls ? ' ' + opts.cls : '');
    var kids = [];
    if (opts.icon) kids.push(svgEl(opts.icon, { 'class': 'btn__icon' }));
    if (label) kids.push(h('span', { 'class': 'btn__label', text: label }));
    if (opts.key) kids.push(h('kbd', { 'class': 'btn__key', text: opts.key }));
    var b = h('button', {
      type: 'button',
      'class': cls,
      'data-focus': opts.focus || null,
      'data-autofocus': opts.autofocus ? '' : null,
      'aria-label': opts.aria || null,
      disabled: opts.disabled ? true : null,
      onclick: opts.onClick || null
    }, kids);
    return b;
  }

  function iconBtn(icon, label, opts) {
    opts = opts || {};
    return h('button', {
      type: 'button',
      'class': 'btn btn--icon ' + (opts.cls || ''),
      'data-focus': opts.focus || null,
      'data-autofocus': opts.autofocus ? '' : null,
      'aria-label': label,
      title: opts.title || null,
      onclick: opts.onClick || null
    }, [svgEl(icon, { 'class': 'btn__icon' })]);
  }

  /* ---------- чипы настроек ---------- */
  function chipValue(kind) {
    if (kind === 'graphics') return st.mode === 'retro' ? T('chip.retro') : T('chip.aurora');
    if (kind === 'lang') return st.lang === 'en' ? 'EN' : 'RU';
    return st.muted ? T('chip.soundOff') : T('chip.soundOn');
  }
  function chipAria(kind) {
    if (kind === 'graphics') {
      return T('chip.graphicsAria', { mode: st.mode === 'retro' ? T('chip.retro') : T('chip.aurora') });
    }
    if (kind === 'lang') return T('chip.langAria', { lang: st.lang === 'en' ? 'English' : 'Русский' });
    return st.muted ? T('chip.soundAriaOff') : T('chip.soundAriaOn');
  }
  function chipNode(kind) {
    var iconName = kind === 'graphics' ? (st.mode === 'retro' ? 'snow' : 'spark')
      : kind === 'lang' ? 'rune' : (st.muted ? 'soundOff' : 'soundOn');
    var el = h('button', {
      type: 'button',
      'class': 'chip chip--' + kind,
      'data-chip': kind,
      'data-focus': 'chip-' + kind,
      'aria-label': chipAria(kind),
      onclick: function () { onChip(kind); }
    }, [
      h('span', { 'class': 'chip__icon' }, [svgEl(iconName)]),
      h('span', { 'class': 'chip__label', text: T('chip.' + kind) }),
      h('span', { 'class': 'chip__value', text: chipValue(kind) })
    ]);
    if (kind === 'sound') toggleCls(el, 'is-muted', st.muted);
    return el;
  }
  function chipsRow(extraCls) {
    var row = h('div', {
      'class': 'chips ' + (extraCls || ''),
      role: 'group',
      'aria-label': T('a11y.settings')
    }, [chipNode('graphics'), chipNode('lang'), chipNode('sound')]);
    return row;
  }
  function updateChips() {
    var list = document.querySelectorAll('[data-chip]');
    for (var i = 0; i < list.length; i++) {
      var kind = list[i].getAttribute('data-chip');
      var val = list[i].querySelector('.chip__value');
      setText(val, chipValue(kind));
      setAttr(list[i], 'aria-label', chipAria(kind));
      var ic = list[i].querySelector('.chip__icon');
      if (ic) {
        var iconName = kind === 'graphics' ? (st.mode === 'retro' ? 'snow' : 'spark')
          : kind === 'lang' ? 'rune' : (st.muted ? 'soundOff' : 'soundOn');
        clear(ic);
        ic.appendChild(svgEl(iconName));
      }
      if (kind === 'sound') toggleCls(list[i], 'is-muted', st.muted);
    }
  }
  function onChip(kind) {
    uiSfx('uiClick');
    if (kind === 'graphics') {
      applyMode(st.mode === 'retro' ? 'aurora' : 'retro');
      safeCall('onToggleGraphics');
    } else if (kind === 'lang') {
      applyLang(st.lang === 'en' ? 'ru' : 'en');
      safeCall('onToggleLang');
    } else {
      applyMuted(!st.muted);
      safeCall('onToggleMute');
    }
  }

  /* ---------- декоративная шапка ---------- */
  function brandNode() {
    return h('div', { 'class': 'brand', 'aria-hidden': 'true' }, [
      h('span', { 'class': 'brand__mark' }, [svgEl('rune', { 'class': 'brand__rune', weight: 1.7 })]),
      h('span', { 'class': 'brand__lines' }, [
        h('span', { 'class': 'brand__name', text: 'СЕВЕРНАЯ САГА' }),
        h('span', { 'class': 'brand__sub', text: 'II · ' + T('brand.norse') })
      ])
    ]);
  }

  function kicker(text) { return h('p', { 'class': 'kicker', text: text }); }

  function statCell(label, value, cls) {
    return h('div', { 'class': 'stat-cell ' + (cls || '') }, [
      h('span', { 'class': 'stat-cell__label', text: label }),
      h('span', { 'class': 'stat-cell__value', text: value })
    ]);
  }

  function runePip(cls) {
    return h('span', { 'class': 'rune-pip ' + (cls || '') }, [svgEl('rune', { 'class': 'rune-pip__glyph', weight: 1.9 })]);
  }

  function pipsRow(count, total, cls) {
    var row = h('span', { 'class': 'pips ' + (cls || ''), 'aria-hidden': 'true' });
    for (var i = 0; i < total; i++) {
      row.appendChild(h('i', { 'class': 'pip ' + (i < count ? 'is-on' : '') }));
    }
    return row;
  }

  /* ============================ уровни / сохранение ============================ */

  function levelsList() {
    var lv = window.SAGA2 && SAGA2.LEVELS;
    return lv && lv.length ? lv : null;
  }
  function levelAt(i) {
    var list = levelsList();
    return list && list[i] ? list[i] : null;
  }
  function levelName(i, lang) {
    var lv = levelAt(i);
    if (!lv) return T('levels.placeholder');
    var ru = nzStr(lv.name, lv.nameEn);
    var en = nzStr(lv.nameEn, lv.name);
    return lang === 'en' ? en : ru;
  }
  function levelHint(i, lang) {
    var lv = levelAt(i);
    if (!lv) return '';
    var ru = nzStr(lv.hint, lv.hintEn);
    var en = nzStr(lv.hintEn, lv.hint);
    return lang === 'en' ? en : ru;
  }
  function levelCount() {
    var list = levelsList();
    return list ? Math.max(1, list.length) : 6;
  }
  function progressRecord(i) {
    var src = st.save.levels || {};
    var rec = src[i];
    if (!rec) rec = src[String(i)];
    if (!rec) rec = src[i + 1];
    if (!rec) rec = src[String(i + 1)];
    return rec || null;
  }
  function unlockedCount() {
    return clamp(Math.floor(nz(st.save.unlocked, 1)), 1, levelCount());
  }

  /* ============================ HUD: нормализация ============================ */

  function readPair(src, gotKeys, totalKeys, defTotal) {
    var got = null, total = null;
    for (var i = 0; i < gotKeys.length; i++) {
      var v = src[gotKeys[i]];
      if (isNum(v)) { got = v; break; }
      if (v && typeof v === 'object') {
        if (isNum(v.got)) got = v.got;
        else if (isNum(v.collected)) got = v.collected;
        else if (isNum(v.count)) got = v.count;
        else if (isNum(v.done)) got = v.done;
        if (isNum(v.total)) total = v.total;
        else if (isNum(v.max)) total = v.max;
        if (got != null) break;
      }
    }
    for (var j = 0; j < totalKeys.length; j++) {
      var t = src[totalKeys[j]];
      if (isNum(t)) { total = t; break; }
    }
    got = got == null ? 0 : got;
    total = total == null ? defTotal : total;
    if (total <= 0) total = defTotal;
    return { got: clamp(got, 0, total), total: total };
  }

  function normalizeHud(raw) {
    var s = raw && typeof raw === 'object' ? raw : {};
    var pd = st.playData && typeof st.playData === 'object' ? st.playData : {};
    var total = nz(s.levelCount, pd.levelCount, levelCount());
    if (total <= 0) total = levelCount();
    var idx = null;
    if (isNum(s.levelIndex)) idx = s.levelIndex;
    else if (isNum(pd.levelIndex)) idx = pd.levelIndex;
    else if (isNum(s.level)) idx = s.level - 1;
    if (idx == null) idx = 0;
    idx = clamp(Math.floor(idx), 0, Math.max(0, total - 1));

    var name = '';
    var nameRu = nzStr(s.name, pd.name, levelAt(idx) ? levelAt(idx).name : '');
    var nameEn = nzStr(s.nameEn, pd.nameEn, levelAt(idx) ? levelAt(idx).nameEn : '');
    name = st.lang === 'en' ? nzStr(nameEn, nameRu) : nzStr(nameRu, nameEn);
    if (!name) name = levelName(idx, st.lang);

    var runes = readPair(s, ['runes', 'runesGot', 'runesCollected'], ['runesTotal', 'runesMax'], 3);
    var exit = readPair(s, ['exit', 'exitCollected', 'exited'], ['exitTotal'], 3);

    var time = nz(s.time, s.elapsed, pd.time, 0);
    var deaths = nz(s.deaths, s.levelDeaths, s.deathCount, pd.deaths, 0);

    var srcActors = Array.isArray(s.actors) ? s.actors : (Array.isArray(s.northmen) ? s.northmen : null);
    var activeId = typeof s.active === 'string' ? s.active : null;
    var actors = [];
    for (var i = 0; i < NORTHMEN.length; i++) {
      var def = NORTHMEN[i], found = null;
      if (srcActors) {
        for (var j = 0; j < srcActors.length; j++) {
          if (srcActors[j] && (srcActors[j].id === def.id || srcActors[j].key === def.id)) { found = srcActors[j]; break; }
        }
        if (!found && srcActors[i] && typeof srcActors[i] === 'object') found = srcActors[i];
      } else if (s.northmen && typeof s.northmen === 'object' && !Array.isArray(s.northmen)) {
        found = s.northmen[def.id] || null;
      }
      var maxHp = nz(found ? found.maxHp : null, 3);
      var hp = found ? nz(found.hp, maxHp) : maxHp;
      actors.push({
        id: def.id,
        hp: clamp(hp, 0, maxHp),
        maxHp: maxHp,
        dead: !!(found && found.dead),
        exited: !!(found && found.exited),
        active: !!(found && found.active) || activeId === def.id
      });
    }
    if (!activeId) {
      for (var k = 0; k < actors.length; k++) if (actors[k].active) { activeId = actors[k].id; break; }
    }
    if (!activeId) activeId = 'snorri';

    return {
      levelIndex: idx,
      levelNumber: idx + 1,
      levelTotal: total,
      name: name,
      runes: runes,
      exit: exit,
      time: time,
      deaths: deaths,
      actors: actors,
      activeId: activeId
    };
  }

  /* ============================ HUD: карточки северян ============================ */

  function buildNorthmanCard(v, index) {
    var name = T('northman.' + v.id);
    var role = T('northman.' + v.id + '.role');
    var canvas = h('canvas', { 'class': 'portrait__canvas', width: 96, height: 108, 'aria-hidden': 'true' });
    var portrait = h('div', { 'class': 'portrait' }, [portraitEl(v.id), canvas]);
    var hearts = [];
    var heartsWrap = h('div', { 'class': 'hearts', 'aria-hidden': 'true' });
    for (var i = 0; i < 3; i++) {
      var heart = h('span', { 'class': 'heart' }, [svgEl('heart', { weight: 1.8 })]);
      hearts.push(heart);
      heartsWrap.appendChild(heart);
    }
    var pills = h('div', { 'class': 'abilities', 'aria-hidden': 'true' });
    for (var a = 0; a < v.abilities.length; a++) {
      var ab = v.abilities[a];
      pills.appendChild(h('span', {
        'class': 'ability',
        title: T('ability.' + ab) + ' — ' + T('ability.' + ab + '.hint')
      }, [
        svgEl(ab, { 'class': 'ability__icon', weight: 1.7 }),
        h('span', { 'class': 'ability__name', text: T('ability.' + ab) }),
        h('kbd', { 'class': 'ability__key', text: T('ability.' + ab + '.key') })
      ]));
    }
    var meta = h('div', { 'class': 'northman__meta' }, [heartsWrap, pills]);
    var stateEl = h('span', { 'class': 'northman__state', text: '' });
    var el = h('article', {
      'class': 'northman northman--' + v.id,
      'data-actor': v.id,
      'aria-label': name
    }, [
      h('span', { 'class': 'northman__index', text: String(index + 1), 'aria-hidden': 'true' }),
      portrait,
      h('div', { 'class': 'northman__body' }, [
        h('div', { 'class': 'northman__head' }, [
          h('h3', { 'class': 'northman__name', text: name }),
          h('span', { 'class': 'northman__role', text: role })
        ]),
        meta
      ]),
      stateEl
    ]);
    return { el: el, hearts: hearts, stateEl: stateEl, name: name, role: role, id: v.id, canvas: canvas };
  }

  function drawPortraits() {
    if (!refs.portraits || !refs.portraits.length) return;
    var rd = window.SAGA2 && SAGA2.render;
    if (!rd || typeof rd.drawPortrait !== 'function') return;
    for (var i = 0; i < refs.portraits.length; i++) {
      try { rd.drawPortrait(refs.portraits[i].canvas, refs.portraits[i].id); } catch (e) { /* no-op */ }
    }
  }

  /* ============================ HUD: рендер и обновление ============================ */

  function hudEmpty() {
    return normalizeHud(null);
  }

  function renderPlay() {
    var top = h('div', { 'class': 'hud-top' });

    var levelNum = h('span', { 'class': 'hud-level__num', text: '01' });
    var levelNameEl = h('span', { 'class': 'hud-level__name', text: '' });
    var levelTotal = h('span', { 'class': 'hud-level__total', text: '' });
    var levelBlock = h('div', { 'class': 'hud-level' }, [
      h('span', { 'class': 'hud-level__kicker', text: T('hud.levelKicker') }),
      levelNum,
      levelTotal
    ]);
    var levelPanel = h('div', { 'class': 'hud-panel hud-panel--level' }, [levelBlock, levelNameEl]);

    var runePipsArr = [];
    var runesMeter = h('div', { 'class': 'runes-meter', role: 'img', 'aria-label': '' });
    var runesLabel = h('span', { 'class': 'runes-meter__label', text: T('hud.runesLabel') });
    var runesGlyphs = h('span', { 'class': 'runes-meter__glyphs' });
    for (var i = 0; i < 3; i++) {
      var p = runePip();
      runePipsArr.push(p);
      runesGlyphs.appendChild(p);
    }
    var runesCount = h('span', { 'class': 'runes-meter__count', text: '0/3' });
    runesMeter.appendChild(runesLabel);
    runesMeter.appendChild(runesGlyphs);
    runesMeter.appendChild(runesCount);
    var runesPanel = h('div', { 'class': 'hud-panel hud-panel--runes' }, [runesMeter]);

    var timeVal = h('span', { 'class': 'stat__value', text: '00:00' });
    var deathsVal = h('span', { 'class': 'stat__value', text: '0' });
    var clock = h('div', { 'class': 'hud-panel hud-panel--clock' }, [
      h('div', { 'class': 'stat' }, [
        h('span', { 'class': 'stat__label', text: T('hud.timeLabel') }), timeVal
      ]),
      h('div', { 'class': 'stat' }, [
        h('span', { 'class': 'stat__label', text: T('hud.deathsLabel') }), deathsVal
      ])
    ]);

    var exitPips = [];
    var exitPipsWrap = h('span', { 'class': 'exit-pips', 'aria-hidden': 'true' });
    for (var e = 0; e < 3; e++) {
      var ep = h('i', { 'class': 'exit-pip' });
      exitPips.push(ep);
      exitPipsWrap.appendChild(ep);
    }
    var exitCount = h('span', { 'class': 'exit-meter__count', text: '0/3' });
    var exitMeter = h('div', { 'class': 'exit-meter', role: 'img', 'aria-label': '' }, [
      h('span', { 'class': 'exit-meter__icon' }, [svgEl('portal', { 'class': 'exit-meter__glyph' })]),
      h('span', { 'class': 'exit-meter__label', text: T('hud.exitLabel') }),
      exitCount,
      exitPipsWrap
    ]);
    var exitPanel = h('div', { 'class': 'hud-panel hud-panel--exit' }, [exitMeter]);

    var helpBtn = iconBtn('help', T('hud.helpAria'), {
      'class': 'hud-btn', focus: 'hud-help',
      onClick: function () { openHelp(); }
    });
    var pauseBtn = iconBtn('pause', T('hud.pauseAria'), {
      'class': 'hud-btn hud-btn--pause', focus: 'hud-pause',
      onClick: function () { uiSfx('uiClick'); safeCall('onPause'); }
    });
    var actions = h('div', { 'class': 'hud-actions' }, [helpBtn, pauseBtn]);

    top.appendChild(h('div', { 'class': 'hud-group hud-group--left' }, [levelPanel, runesPanel]));
    top.appendChild(clock);
    top.appendChild(h('div', { 'class': 'hud-group hud-group--right' }, [exitPanel, actions]));

    var cards = [];
    var northmenRow = h('div', { 'class': 'northmen', role: 'list', 'aria-label': T('a11y.northmen') });
    for (var v = 0; v < NORTHMEN.length; v++) {
      var card = buildNorthmanCard(NORTHMEN[v], v);
      card.el.setAttribute('role', 'listitem');
      cards.push(card);
      northmenRow.appendChild(card.el);
    }
    var hint = h('p', { 'class': 'hud-hint', title: T('hud.hint') }, [
      h('span', { 'class': 'hud-hint__keys', text: T('hud.hintShort') })
    ]);

    var bottom = h('div', { 'class': 'hud-bottom' }, [
      northmenRow,
      hint
    ]);

    var section = h('section', { 'class': 'screen screen--play' }, [
      top, bottom
    ]);
    refs.hud = {
      levelNum: levelNum, levelName: levelNameEl, levelTotal: levelTotal,
      levelPanel: levelPanel,
      runesPips: runePipsArr, runesCount: runesCount, runesMeter: runesMeter,
      time: timeVal, deaths: deathsVal,
      exitCount: exitCount, exitPips: exitPips, exitMeter: exitMeter,
      cards: cards
    };
    refs.portraits = cards.map(function (c) { return { canvas: c.canvas, id: c.id }; });
    return section;
  }

  function applyHud(n) {
    var r = refs.hud;
    if (!r) return;
    setText(r.levelNum, pad2(n.levelNumber));
    setText(r.levelName, n.name);
    setText(r.levelTotal, '/ ' + pad2(n.levelTotal));
    setAttr(r.levelPanel, 'aria-label', T('common.levelOf', { n: n.levelNumber, total: n.levelTotal }));
    setText(r.time, fmtTime(n.time));
    setText(r.deaths, String(Math.floor(n.deaths)));
    setText(r.runesCount, n.runes.got + '/' + n.runes.total);
    setAttr(r.runesMeter, 'aria-label', T('hud.runesAria', { got: n.runes.got, total: n.runes.total }));
    for (var i = 0; i < r.runesPips.length; i++) toggleCls(r.runesPips[i], 'is-lit', i < n.runes.got);
    setText(r.exitCount, n.exit.got + '/' + n.exit.total);
    setAttr(r.exitMeter, 'aria-label', T('hud.exitAria', { n: n.exit.got, total: n.exit.total }));
    for (var j = 0; j < r.exitPips.length; j++) toggleCls(r.exitPips[j], 'is-on', j < n.exit.got);

    for (var c = 0; c < r.cards.length; c++) {
      var card = r.cards[c], a = null;
      for (var x = 0; x < n.actors.length; x++) if (n.actors[x].id === card.id) { a = n.actors[x]; break; }
      if (!a) a = { hp: 3, maxHp: 3, dead: false, exited: false, active: false };
      var isActive = a.active && a.id === n.activeId && !a.dead && !a.exited;
      toggleCls(card.el, 'is-active', isActive);
      toggleCls(card.el, 'is-dead', !!a.dead);
      toggleCls(card.el, 'is-exited', !!a.exited);
      toggleCls(card.el, 'is-low', a.hp <= 1 && !a.dead);
      var stateText = a.exited ? T('hud.exited') : a.dead ? T('hud.dead') : isActive ? T('hud.active') : T('hud.idle');
      setText(card.stateEl, stateText);
      card.stateEl.className = 'northman__state ' + (a.exited ? 'is-exited' : a.dead ? 'is-dead' : isActive ? 'is-active' : '');
      for (var hh = 0; hh < card.hearts.length; hh++) toggleCls(card.hearts[hh], 'is-empty', hh >= a.hp);
      var stateAria = a.exited ? T('hud.stateExited') : a.dead ? T('hud.stateDead') : isActive ? T('hud.stateActive') : T('hud.stateIdle');
      var abilities = [];
      for (var ab = 0; ab < NORTHMAN_MAP[a.id].abilities.length; ab++) {
        abilities.push(T('ability.' + NORTHMAN_MAP[a.id].abilities[ab]));
      }
      setAttr(card.el, 'aria-label', T('hud.northmanAria', {
        name: card.name, role: card.role, state: stateAria,
        hp: a.hp, max: a.maxHp, abilities: abilities.join(', ')
      }));
    }
    updateTouchAbility(n.activeId, n);
  }

  function updateHud(state) {
    st.hudState = state;
    if (!st.inited) return;
    var n = normalizeHud(state);
    st.hud = n;
    if (st.screen !== 'play' || !refs.hud) return;
    applyHud(n);
  }

  /* ============================ сенсорное управление ============================ */

  var TOUCH_BUTTONS = [
    { act: 'up', icon: 'chevronUp', key: 'touch.up', cls: 'touch-btn--up' },
    { act: 'left', icon: 'chevronLeft', key: 'touch.left', cls: 'touch-btn--left' },
    { act: 'down', icon: 'chevronDown', key: 'touch.down', cls: 'touch-btn--down' },
    { act: 'right', icon: 'chevronRight', key: 'touch.right', cls: 'touch-btn--right' }
  ];

  function touchBtn(spec) {
    var label = T(spec.key);
    var kids = [];
    if (spec.icon) kids.push(svgEl(spec.icon, { 'class': 'touch-btn__icon' }));
    if (spec.text) kids.push(h('span', { 'class': 'touch-btn__label', text: spec.text }));
    var b = h('button', {
      type: 'button',
      'class': 'touch-btn ' + (spec.cls || '') + (spec.action ? ' touch-btn--action' : ''),
      'data-act': spec.act,
      'aria-label': label
    }, kids);
    bindTouchButton(b, spec.act);
    return b;
  }

  function setTouchButtonContent(btn, abilityId, fallbackKey) {
    if (!btn) return;
    clear(btn);
    if (abilityId) {
      btn.classList.remove('is-off');
      btn.removeAttribute('aria-disabled');
      btn.appendChild(svgEl(abilityId, { 'class': 'touch-btn__icon', weight: 1.7 }));
      btn.appendChild(h('span', { 'class': 'touch-btn__label', text: T('ability.' + abilityId) }));
      btn.setAttribute('aria-label', T('ability.' + abilityId) + '. ' + T('ability.' + abilityId + '.hint'));
    } else {
      btn.classList.add('is-off');
      btn.setAttribute('aria-disabled', 'true');
      var label = fallbackKey ? T(fallbackKey) : T('common.dash');
      btn.appendChild(h('span', { 'class': 'touch-btn__label', text: label }));
      btn.setAttribute('aria-label', label);
    }
  }

  function updateTouchAbility(activeId, n) {
    if (!refs.touch) return;
    var map = TOUCH_ABILITIES[activeId] || TOUCH_ABILITIES.snorri;
    setTouchButtonContent(refs.touch.action, map.action, 'touch.action');
    setTouchButtonContent(refs.touch.special, map.special, 'touch.special');
    setTouchButtonContent(refs.touch.hook, map.hook, 'touch.hook');
    if (n && refs.touch.switchLabel) {
      // подпись смены северянина: следующий по кругу
      var order = ['snorri', 'gunnar', 'bjorn'];
      var idx = order.indexOf(activeId);
      var next = order[(idx + 1) % order.length];
      setText(refs.touch.switchLabel, T('northman.' + next));
    }
  }

  function bindTouchButton(btn, action) {
    var pressed = false;
    function press(down, ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      if (btn.classList.contains('is-off')) return;
      if (down === pressed) return;
      pressed = down;
      toggleCls(btn, 'is-pressed', down);
      safeCall('onInput', action, down);
      uiSfx(down ? 'uiClick' : 'uiMove');
    }
    btn.addEventListener('pointerdown', function (ev) {
      try { btn.setPointerCapture(ev.pointerId); } catch (e) { /* no-op */ }
      press(true, ev);
    });
    btn.addEventListener('pointerup', function (ev) { press(false, ev); });
    btn.addEventListener('pointercancel', function (ev) { press(false, ev); });
    btn.addEventListener('lostpointercapture', function () { press(false); });
    btn.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    btn.addEventListener('dragstart', function (ev) { ev.preventDefault(); });
  }

  function buildTouch() {
    var layer = document.getElementById('touch');
    if (!layer) {
      layer = h('div', { id: 'touch', 'class': 'touch-layer' });
      document.body.appendChild(layer);
    }
    clear(layer);
    layer.setAttribute('role', 'group');
    layer.setAttribute('aria-label', T('touch.group'));

    var move = h('div', { 'class': 'touch-cluster touch-cluster--move' });
    for (var i = 0; i < TOUCH_BUTTONS.length; i++) {
      move.appendChild(touchBtn(TOUCH_BUTTONS[i]));
    }

    var switchLabel = h('span', { 'class': 'touch-btn__label touch-btn__label--sub', text: '' });
    var switchBtn = h('button', {
      type: 'button', 'class': 'touch-btn touch-btn--switch', 'data-act': 'switch',
      'aria-label': T('touch.switch')
    }, [svgEl('switch', { 'class': 'touch-btn__icon' }), switchLabel]);
    bindTouchButton(switchBtn, 'switch');

    var act = h('div', { 'class': 'touch-cluster touch-cluster--act' }, [
      h('div', { 'class': 'touch-row touch-row--top' }, [
        switchBtn,
        touchBtn({ act: 'jump', icon: 'chevronUp', key: 'touch.jump', cls: 'touch-btn--jump' })
      ]),
      h('div', { 'class': 'touch-row touch-row--bottom' }, [
        touchBtn({ act: 'action', key: 'touch.action', cls: 'touch-btn--ability' }),
        touchBtn({ act: 'special', key: 'touch.special', cls: 'touch-btn--ability' }),
        touchBtn({ act: 'hook', key: 'touch.hook', cls: 'touch-btn--ability' })
      ])
    ]);

    layer.appendChild(move);
    layer.appendChild(act);

    refs.touch = {
      layer: layer,
      action: act.querySelector('[data-act="action"]'),
      special: act.querySelector('[data-act="special"]'),
      hook: act.querySelector('[data-act="hook"]'),
      jump: act.querySelector('[data-act="jump"]'),
      switchLabel: switchLabel
    };
    // начальные иконки способностей до первого HUD
    setTouchButtonContent(refs.touch.action, 'headbutt', 'touch.action');
    setTouchButtonContent(refs.touch.special, 'glide', 'touch.special');
    setTouchButtonContent(refs.touch.hook, null, 'touch.hook');
    if (st.hud) updateTouchAbility(st.hud.activeId, st.hud);
  }

  function detectTouch() {
    try {
      var m = /[?&]touch=(1|0)/.exec(String(window.location.search || ''));
      if (m) { st.touchForced = m[1] === '1'; return st.touchForced; }
    } catch (e) { /* no-op */ }
    try {
      if (window.navigator && window.navigator.maxTouchPoints > 0) return true;
      if (window.matchMedia) return window.matchMedia('(pointer: coarse)').matches;
      return 'ontouchstart' in window;
    } catch (e2) { return false; }
  }

  /* ============================ экран: title ============================ */

  function screenData() {
    return st.data && typeof st.data === 'object' ? st.data : null;
  }

  /* Сводка о сохранении: main присылает данные и через setSaveInfo, и в screen('title'). */
  function titleSaveInfo() {
    var d = st.screen === 'title' ? screenData() : null;
    var fromData = d && isNum(d.unlocked) ? clamp(Math.floor(d.unlocked), 1, levelCount()) : 0;
    var unlocked = clamp(Math.max(unlockedCount(), fromData), 1, levelCount());
    var has = !!(st.save.hasProgress || (d && d.hasProgress));
    return { unlocked: unlocked, hasProgress: has, total: levelCount() };
  }

  function renderTitle() {
    var total = levelCount();
    var saveInfo = titleSaveInfo();
    var unlocked = saveInfo.unlocked;
    var hasProgress = saveInfo.hasProgress;

    var logo = h('h1', { 'class': 'logo', 'aria-label': 'СЕВЕРНАЯ САГА II · СТУДИЯ ГЕФЕСТ' }, [
      h('span', { 'class': 'logo__line logo__line--north', text: T('brand.north'), 'aria-hidden': 'true' }),
      h('span', { 'class': 'logo__line logo__line--northmen' }, [
        h('span', { 'class': 'logo__word', text: T('brand.northmen') }),
        h('span', { 'class': 'logo__ii', text: T('brand.ii') })
      ]),
      h('span', { 'class': 'logo__glint', 'aria-hidden': 'true' })
    ]);

    var menuButtons = [];
    menuButtons.push(btn(T('title.start'), {
      variant: 'primary', icon: 'play', wide: true, focus: 'title-start', autofocus: true,
      onClick: function () { uiSfx('uiClick'); safeCall('onStartNew'); }
    }));
    if (hasProgress) {
      menuButtons.push(btn(T('title.continue'), {
        variant: 'secondary', icon: 'chevronRight', wide: true, focus: 'title-continue',
        onClick: function () { uiSfx('uiClick'); safeCall('onContinue'); }
      }));
    }
    menuButtons.push(btn(T('title.levels'), {
      variant: 'ghost', icon: 'rune', wide: true, focus: 'title-levels',
      onClick: function () { uiSfx('uiClick'); screen('levels'); }
    }));
    menuButtons.push(btn(T('title.help'), {
      variant: 'ghost', icon: 'help', wide: true, focus: 'title-help',
      onClick: function () { uiSfx('uiClick'); openHelp(); }
    }));

    var saveLine = h('div', { 'class': 'save-line' }, [
      h('span', { 'class': 'save-line__icon' }, [svgEl('rune', { weight: 1.8 })]),
      h('span', { 'class': 'save-line__text', text: hasProgress
        ? T('title.progress', { n: unlocked, total: total })
        : T('title.fresh') }),
      pipsRow(unlocked, total, 'save-line__pips')
    ]);

    var menu = h('div', { 'class': 'title-menu panel panel--glass' }, [
      h('p', { 'class': 'panel__label', text: T('title.menu') }),
      h('nav', { 'class': 'menu', 'aria-label': T('a11y.primaryNav') }, menuButtons),
      saveLine,
      h('p', { 'class': 'title-menu__keys', text: T('title.keys') })
    ]);

    var features = h('ul', { 'class': 'title-features', 'aria-hidden': 'true' }, [
      h('li', { 'class': 'title-feature' }, [
        h('span', { 'class': 'title-feature__icon' }, [svgEl('snow')]),
        h('span', { text: T('title.feature1') })
      ]),
      h('li', { 'class': 'title-feature' }, [
        h('span', { 'class': 'title-feature__icon' }, [svgEl('rune')]),
        h('span', { text: T('title.feature2') })
      ]),
      h('li', { 'class': 'title-feature' }, [
        h('span', { 'class': 'title-feature__icon' }, [svgEl('spark')]),
        h('span', { text: T('title.feature3') })
      ])
    ]);

    var hero = h('div', { 'class': 'title-hero' }, [
      kicker(T('title.kicker')),
      logo,
      h('div', { 'class': 'logo-meta' }, [
        h('span', { 'class': 'rule', 'aria-hidden': 'true' }),
        h('span', { 'class': 'logo-meta__norse', text: T('brand.norse') }),
        h('span', { 'class': 'rule', 'aria-hidden': 'true' })
      ]),
      h('p', { 'class': 'title-subtitle', text: T('title.subtitle') }),
      h('p', { 'class': 'title-tagline', text: T('title.tagline') }),
      features
    ]);

    var top = h('header', { 'class': 'topbar' }, [brandNode(), chipsRow('topbar__chips')]);

    var main = h('main', { 'class': 'title-main' }, [hero, menu]);

    var foot = h('footer', { 'class': 'title-foot' }, [
      h('p', { 'class': 'title-foot__attr', text: T('title.attribution') }),
      h('p', { 'class': 'title-foot__build', text: T('title.build') })
    ]);

    var runeDecor = h('span', { 'class': 'title-decor__runes', 'aria-hidden': 'true' });
    for (var rd = 0; rd < 5; rd++) runeDecor.appendChild(svgEl('rune', { weight: 1.2 }));

    var section = h('section', { 'class': 'screen screen--title' }, [
      h('div', { 'class': 'title-decor', 'aria-hidden': 'true' }, [
        h('span', { 'class': 'title-decor__arc title-decor__arc--a' }),
        h('span', { 'class': 'title-decor__arc title-decor__arc--b' }),
        runeDecor
      ]),
      top, main, foot
    ]);
    return section;
  }

  /* ============================ экран: levels ============================ */

  function renderLevels() {
    var total = levelCount();
    var data = st.screen === 'levels' ? screenData() : null;
    var entries = data && Array.isArray(data.levels) ? data.levels : null;
    var unlocked = unlockedCount();
    if (data && isNum(data.unlocked)) {
      unlocked = clamp(Math.max(unlocked, Math.floor(data.unlocked)), 1, total);
    }
    var grid = h('div', { 'class': 'levels-grid', role: 'list', 'aria-label': T('a11y.levelsGrid') });

    for (var i = 0; i < total; i++) {
      var entry = entries ? entries[i] : null;
      var locked = i >= unlocked;
      var rec = progressRecord(i);
      var name = levelName(i, st.lang);
      if (entry) {
        rec = entry.stats || rec;
        var ruName = nzStr(entry.name, levelName(i, 'ru'));
        var enName = nzStr(entry.nameEn, levelName(i, 'en'));
        name = st.lang === 'en' ? nzStr(enName, ruName) : nzStr(ruName, enName);
      }
      var cardAria = locked
        ? T('levels.cardAriaLocked', { n: i + 1 })
        : T('levels.cardAria', { n: i + 1, name: name });
      var runesGot = rec ? nz(rec.runes, rec.runesGot, 0) : 0;
      var timeVal = rec && isNum(rec.time) ? fmtTime(rec.time) : T('levels.noData');
      var deathsVal = rec && isNum(rec.deaths) ? String(Math.floor(rec.deaths)) : T('levels.noData');

      var runesRow = h('span', { 'class': 'level-card__runes' }, [
        h('span', { 'class': 'level-card__runes-glyphs' }, (function () {
          var wrap = document.createDocumentFragment();
          for (var r = 0; r < 3; r++) {
            var pip = runePip(r < runesGot ? 'is-lit' : '');
            wrap.appendChild(pip);
          }
          return wrap;
        })())
      ]);
      if (rec) runesRow.setAttribute('aria-label', T('levels.runesAria', { got: runesGot, total: 3 }));

      var card = h('button', {
        type: 'button',
        'class': 'level-card' + (locked ? ' is-locked' : ''),
        role: 'listitem',
        'aria-label': cardAria,
        'aria-disabled': locked ? 'true' : null,
        'data-focus': 'level-' + i,
        disabled: locked ? true : null,
        onclick: function (idx, isLocked) {
          return function () {
            if (isLocked) { toast(T('toast.locked'), { tone: 'warn' }); return; }
            uiSfx('uiClick');
            safeCall('onSelectLevel', idx);
          };
        }(i, locked)
      }, [
        h('span', { 'class': 'level-card__num', text: pad2(i + 1), 'aria-hidden': 'true' }),
        h('span', { 'class': 'level-card__body' }, [
          h('span', { 'class': 'level-card__name', text: name }),
          runesRow,
          h('span', { 'class': 'level-card__stats' }, [
            h('span', { 'class': 'level-card__stat' }, [
              h('span', { 'class': 'level-card__stat-label', text: T('common.time') }),
              h('span', { 'class': 'level-card__stat-value', text: timeVal })
            ]),
            h('span', { 'class': 'level-card__stat' }, [
              h('span', { 'class': 'level-card__stat-label', text: T('common.deaths') }),
              h('span', { 'class': 'level-card__stat-value', text: deathsVal })
            ])
          ])
        ]),
        locked ? h('span', { 'class': 'level-card__lock' }, [
          svgEl('lock', { 'class': 'level-card__lock-icon' }),
          h('span', { 'class': 'level-card__lock-text', text: T('levels.lockedHint') })
        ]) : h('span', { 'class': 'level-card__go', 'aria-hidden': 'true' }, [svgEl('chevronRight')])
      ]);
      grid.appendChild(card);
    }

    var head = h('header', { 'class': 'subpage-head' }, [
      h('div', { 'class': 'subpage-head__left' }, [
        btn(T('levels.backToTitle'), {
          variant: 'ghost', icon: 'chevronLeft', cls: 'btn--back', focus: 'levels-back',
          onClick: function () { uiSfx('uiBack'); screen('title'); }
        }),
        h('div', { 'class': 'subpage-titles' }, [
          kicker(T('common.levels').toUpperCase()),
          h('h2', { 'class': 'subpage-title', text: T('levels.heading') }),
          h('p', { 'class': 'subpage-sub', text: T('levels.sub') })
        ])
      ]),
      chipsRow('subpage-head__chips')
    ]);

    var foot = h('footer', { 'class': 'levels-foot' }, [
      h('span', { 'class': 'levels-foot__text', text: T('levels.progress', { unlocked: unlocked, total: total }) }),
      pipsRow(unlocked, total, 'levels-foot__pips')
    ]);

    return h('section', { 'class': 'screen screen--levels' }, [head, grid, foot]);
  }

  /* ============================ экран: brief ============================ */

  function briefIndexFromData(data) {
    if (isNum(data)) return data;
    if (data && typeof data === 'object') {
      if (isNum(data.index)) return data.index;
      if (isNum(data.levelIndex)) return data.levelIndex;
      if (isNum(data.level)) return Math.max(0, data.level - 1);
    }
    return st.briefIndex || 0;
  }

  function levelCounts(idx) {
    var lv = levelAt(idx);
    var list = lv && lv.entities ? lv.entities : [];
    var out = { runes: 0, checkpoints: 0, enemies: 0 };
    for (var i = 0; i < list.length; i++) {
      var type = list[i] && list[i].type;
      if (type === 'rune') out.runes++;
      else if (type === 'checkpoint') out.checkpoints++;
      else if (type === 'enemy') out.enemies++;
    }
    if (!list.length) { out.runes = 3; out.checkpoints = 3; }
    return out;
  }

  function briefMetaCell(icon, label, value, accentCls) {
    return h('div', { 'class': 'brief-meta__cell ' + (accentCls || '') }, [
      h('span', { 'class': 'brief-meta__icon' }, [svgEl(icon)]),
      h('span', { 'class': 'brief-meta__body' }, [
        h('span', { 'class': 'brief-meta__label', text: label }),
        h('span', { 'class': 'brief-meta__value', text: value })
      ])
    ]);
  }

  function crewRow(v) {
    var abilities = h('div', { 'class': 'crew__abilities' });
    for (var a = 0; a < v.abilities.length; a++) {
      var ab = v.abilities[a];
      abilities.appendChild(h('span', {
        'class': 'crew-ability',
        title: T('ability.' + ab) + ' — ' + T('ability.' + ab + '.hint')
      }, [
        svgEl(ab, { 'class': 'crew-ability__icon', weight: 1.7 }),
        h('span', { 'class': 'crew-ability__name', text: T('ability.' + ab) }),
        h('kbd', { 'class': 'crew-ability__key', text: T('ability.' + ab + '.key') })
      ]));
    }
    return h('div', { 'class': 'crew crew--' + v.id }, [
      h('span', { 'class': 'crew__portrait', 'aria-hidden': 'true' }, [portraitEl(v.id)]),
      h('div', { 'class': 'crew__body' }, [
        h('div', { 'class': 'crew__head' }, [
          h('span', { 'class': 'crew__name', text: T('northman.' + v.id) }),
          h('span', { 'class': 'crew__role', text: T('northman.' + v.id + '.role') })
        ]),
        abilities
      ])
    ]);
  }

  function renderBrief() {
    var idx = clamp(st.briefIndex | 0, 0, levelCount() - 1);
    var total = levelCount();
    var d = st.screen === 'brief' ? screenData() : null;
    var name = levelName(idx, st.lang);
    if (d) {
      var ruName = nzStr(d.name, name);
      var enName = nzStr(d.nameEn, levelName(idx, 'en'));
      name = st.lang === 'en' ? nzStr(enName, ruName) : nzStr(ruName, enName);
    }
    var hint = levelHint(idx, st.lang);
    if (d) {
      var ruHint = nzStr(d.hint, hint);
      var enHint = nzStr(d.hintEn, levelHint(idx, 'en'));
      hint = st.lang === 'en' ? nzStr(enHint, ruHint) : nzStr(ruHint, enHint);
    }
    var mech = L('brief.mech.' + idx);
    if (!mech.length) mech = L('brief.mech.default');
    var counts = levelCounts(idx);
    var difficulty = T('brief.diff.' + clamp(idx, 0, 5));

    var back = btn(T('brief.back'), {
      variant: 'ghost', icon: 'chevronLeft', cls: 'btn--back', focus: 'brief-back',
      onClick: function () {
        uiSfx('uiBack');
        if (st.prevScreen === 'levels') screen('levels'); else screen('title');
      }
    });

    var head = h('header', { 'class': 'subpage-head' }, [
      h('div', { 'class': 'subpage-head__left' }, [
        back,
        h('div', { 'class': 'subpage-titles' }, [
          kicker(T('brief.kicker', { n: idx + 1, total: total })),
          h('h2', { 'class': 'subpage-title', text: name }),
          h('p', {
            'class': 'subpage-sub',
            text: T('brief.subline', {
              runes: counts.runes, checkpoints: counts.checkpoints, enemies: counts.enemies
            })
          })
        ])
      ]),
      chipsRow('subpage-head__chips')
    ]);

    var hintPanel = h('div', { 'class': 'brief-hint panel panel--glass' }, [
      h('p', { 'class': 'panel__label', text: T('brief.hint') }),
      h('p', { 'class': 'brief-hint__text', text: hint || T('title.tagline') })
    ]);

    var goals = h('div', { 'class': 'brief-goals' }, [
      h('span', { 'class': 'brief-goal' }, [
        h('span', { 'class': 'brief-goal__icon' }, [svgEl('rune')]),
        h('span', { 'text': T('brief.goal1') })
      ]),
      h('span', { 'class': 'brief-goal' }, [
        h('span', { 'class': 'brief-goal__icon' }, [svgEl('portal')]),
        h('span', { 'text': T('brief.goal2') })
      ])
    ]);

    var meta = h('div', { 'class': 'brief-meta' }, [
      briefMetaCell('rune', T('brief.meta.runes'), String(counts.runes), 'brief-meta__cell--ice'),
      briefMetaCell('check', T('brief.meta.checkpoints'), String(counts.checkpoints), 'brief-meta__cell--aurora'),
      briefMetaCell('sword', T('brief.meta.enemies'), String(counts.enemies), 'brief-meta__cell--magenta'),
      briefMetaCell('spark', T('brief.meta.difficulty'), difficulty, 'brief-meta__cell--gold')
    ]);

    var mechList = h('ul', { 'class': 'brief-mech__list' });
    for (var m = 0; m < mech.length; m++) {
      mechList.appendChild(h('li', { 'class': 'brief-mech__item' }, [
        h('span', { 'class': 'brief-mech__bullet', 'aria-hidden': 'true' }, [svgEl('check')]),
        h('span', { text: mech[m] })
      ]));
    }

    var crew = h('div', { 'class': 'brief-crew panel panel--glass' }, [
      h('div', { 'class': 'brief-crew__head' }, [
        h('p', { 'class': 'panel__label', text: T('brief.crew') }),
        h('span', { 'class': 'brief-crew__sub', text: T('brief.crewSub') })
      ]),
      h('div', { 'class': 'crew-list' }, NORTHMEN.map(crewRow))
    ]);

    var info = h('div', { 'class': 'brief-info' }, [
      h('div', { 'class': 'brief-num', 'aria-hidden': 'true' }, [
        h('span', { 'class': 'brief-num__value', text: pad2(idx + 1) }),
        h('span', { 'class': 'brief-num__total', text: '/ ' + pad2(total) })
      ]),
      hintPanel,
      goals,
      meta
    ]);

    var start = btn(T('brief.start'), {
      variant: 'primary', icon: 'play', wide: true, focus: 'brief-start', autofocus: true,
      onClick: function () {
        uiSfx('uiClick');
        if (typeof st.callbacks.onBeginLevel === 'function') safeCall('onBeginLevel');
        else safeCall('onSelectLevel', idx);
      }
    });

    var side = h('div', { 'class': 'brief-side' }, [
      h('div', { 'class': 'brief-mech panel panel--glass' }, [
        h('p', { 'class': 'panel__label', text: T('brief.mechanics') }),
        mechList
      ]),
      crew,
      h('div', { 'class': 'brief-actions' }, [
        start,
        h('p', { 'class': 'brief-actions__hint', text: T('brief.switchHint') })
      ])
    ]);

    var main = h('main', { 'class': 'brief-main' }, [info, side]);
    return h('section', { 'class': 'screen screen--brief' }, [head, main]);
  }

  /* ============================ экран: pause ============================ */

  function playInfo() {
    var n = st.hud || normalizeHud(st.hudState);
    var info = { index: n.levelIndex, number: n.levelNumber, total: n.levelTotal, name: n.name };
    var d = st.screen === 'pause' ? screenData() : null;
    if (d) {
      if (isNum(d.levelIndex)) { info.index = d.levelIndex; info.number = d.levelIndex + 1; }
      if (isNum(d.levelCount)) info.total = d.levelCount;
    }
    var ruName = nzStr(d && d.name, levelName(info.index, 'ru'));
    var enName = nzStr(d && d.nameEn, levelName(info.index, 'en'));
    info.name = st.lang === 'en' ? nzStr(enName, ruName) : nzStr(ruName, enName);
    return info;
  }

  function modalShell(cls, kickerText, headingText, subText, bodyKids, actionsKids, extraCls) {
    var head = h('div', { 'class': 'modal__head' }, [
      kicker(kickerText),
      h('h2', { 'class': 'modal__title', text: headingText }),
      subText ? h('p', { 'class': 'modal__sub', text: subText }) : null
    ]);
    var actions = h('div', { 'class': 'modal__actions' }, actionsKids || []);
    var modal = h('div', { 'class': 'modal panel panel--glass ' + (extraCls || ''), role: 'dialog', 'aria-label': headingText }, [
      head, bodyKids ? h('div', { 'class': 'modal__body' }, bodyKids) : null, actions
    ]);
    return h('section', { 'class': 'screen screen--modal ' + (cls || '') }, [
      h('div', { 'class': 'modal-backdrop', 'aria-hidden': 'true' }),
      modal
    ]);
  }

  function renderPause() {
    var info = playInfo();
    var kick = T('pause.levelInfo', { n: pad2(info.number), name: info.name });
    var actions = [
      btn(T('pause.resume'), {
        variant: 'primary', icon: 'play', wide: true, focus: 'pause-resume', autofocus: true,
        onClick: function () { uiSfx('uiClick'); safeCall('onResume'); }
      }),
      btn(T('pause.restart'), {
        variant: 'secondary', icon: 'restart', wide: true, focus: 'pause-restart',
        onClick: function () { uiSfx('uiClick'); safeCall('onRestart'); }
      }),
      btn(T('pause.help'), {
        variant: 'ghost', icon: 'help', wide: true, focus: 'pause-help',
        onClick: function () { uiSfx('uiClick'); openHelp(); }
      }),
      btn(T('pause.quit'), {
        variant: 'ghost', icon: 'home', wide: true, focus: 'pause-quit',
        onClick: function () { uiSfx('uiBack'); safeCall('onQuitToTitle'); }
      })
    ];
    var settings = h('div', { 'class': 'pause-settings' }, [
      h('p', { 'class': 'panel__label', text: T('pause.settings') }),
      chipsRow('pause-settings__chips')
    ]);
    return modalShell('screen--pause', kick, T('pause.heading'), T('pause.sub'), [settings], actions, 'modal--pause');
  }

  /* ============================ экран: complete ============================ */

  function normalizeResult(data) {
    var d = data && typeof data === 'object' ? data : {};
    var idx = nz(d.levelIndex, d.index, (st.hud ? st.hud.levelIndex : 0), 0);
    idx = clamp(Math.round(idx), 0, levelCount() - 1);
    var runes = readPair(d, ['runes', 'runesGot', 'runesCollected'], ['runesTotal'], 3);
    var time = nz(d.time, d.levelTime, d.elapsed, st.hud ? st.hud.time : 0, 0);
    var deaths = nz(d.deaths, d.levelDeaths, d.deathCount, st.hud ? st.hud.deaths : 0, 0);
    var score = nz(d.score, d.points, runes.got * 150 + Math.max(0, 900 - Math.floor(time) * 3));
    var name = levelName(idx, st.lang);
    if (d.name || d.nameEn) {
      name = st.lang === 'en' ? nzStr(d.nameEn, d.name) : nzStr(d.name, d.nameEn);
    }
    return {
      index: idx, number: idx + 1, name: name,
      time: time, deaths: deaths, runes: runes, score: score
    };
  }

  function renderComplete() {
    var r = normalizeResult(st.resultData);
    var stats = h('div', { 'class': 'stats-grid' }, [
      statCell(T('complete.timeLabel'), fmtTime(r.time), 'stat-cell--time'),
      statCell(T('complete.runesLabel'), T('complete.runeValue', { got: r.runes.got, total: r.runes.total }), 'stat-cell--runes'),
      statCell(T('complete.deathsLabel'), String(Math.floor(r.deaths)), 'stat-cell--deaths'),
      statCell(T('complete.scoreLabel'), fmtNum(r.score), 'stat-cell--score')
    ]);
    var actions = [
      btn(T('complete.next'), {
        variant: 'primary', icon: 'chevronRight', wide: true, focus: 'complete-next', autofocus: true,
        onClick: function () { uiSfx('uiClick'); safeCall('onNextLevel'); }
      }),
      btn(T('complete.replay'), {
        variant: 'ghost', icon: 'restart', focus: 'complete-replay',
        onClick: function () { uiSfx('uiClick'); safeCall('onReplay'); }
      }),
      btn(T('complete.quit'), {
        variant: 'ghost', icon: 'home', focus: 'complete-quit',
        onClick: function () { uiSfx('uiBack'); safeCall('onQuitToTitle'); }
      })
    ];
    return modalShell(
      'screen--complete',
      T('common.levelOf', { n: pad2(r.number), total: pad2(levelCount()) }),
      T('complete.heading'),
      T('complete.sub'),
      [stats],
      actions,
      'modal--complete'
    );
  }

  /* ============================ экран: ending ============================ */

  function endingTotals(data) {
    var d = data && typeof data === 'object' ? data : {};
    var sumTime = 0, sumDeaths = 0, sumRunes = 0, sumScore = 0, done = 0;
    var levels = st.save.levels || {};
    for (var k in levels) {
      if (!hasOwn(levels, k)) continue;
      var rec = levels[k];
      if (!rec || typeof rec !== 'object') continue;
      done++;
      sumTime += nz(rec.time, 0);
      sumDeaths += nz(rec.deaths, 0);
      sumRunes += nz(rec.runes, 0);
      sumScore += nz(rec.score, 0);
    }
    var givenTime = nz(d.totalTime, d.time, -1);
    var givenDeaths = nz(d.totalDeaths, d.deaths, -1);
    var givenRunes = nz(d.totalRunes, d.runes, -1);
    var givenScore = nz(d.totalScore, d.score, -1);
    var givenLevels = nz(d.levelsCompleted, d.levelsDone, -1);
    if (givenLevels < 0 && Array.isArray(d.levels)) {
      var completedLevels = 0;
      for (var li = 0; li < d.levels.length; li++) {
        if (d.levels[li] && d.levels[li].done) completedLevels++;
      }
      givenLevels = completedLevels || d.levels.length;
    }
    return {
      time: givenTime >= 0 ? givenTime : sumTime,
      deaths: givenDeaths >= 0 ? givenDeaths : sumDeaths,
      runes: givenRunes >= 0 ? givenRunes : sumRunes,
      score: givenScore >= 0 ? givenScore : sumScore,
      levels: givenLevels >= 0 ? givenLevels : Math.max(done, unlockedCount() - 1)
    };
  }

  function renderEnding() {
    var t = endingTotals(st.endingData);
    var total = levelCount();
    var stats = h('div', { 'class': 'stats-grid stats-grid--ending' }, [
      statCell(T('ending.time'), fmtTime(t.time)),
      statCell(T('ending.deaths'), String(Math.floor(t.deaths))),
      statCell(T('ending.runes'), String(Math.floor(t.runes)) + ' / ' + (total * 3)),
      statCell(T('ending.score'), fmtNum(t.score)),
      statCell(T('ending.levels'), T('ending.levelsValue', { n: clamp(Math.floor(t.levels), 0, total), total: total }), 'stat-cell--wide')
    ]);

    var credits = h('ul', { 'class': 'credits' }, [
      h('li', { 'class': 'credits__item', text: T('ending.credit1') }),
      h('li', { 'class': 'credits__item', text: T('ending.credit2') }),
      h('li', { 'class': 'credits__item', text: T('ending.credit3') }),
      h('li', { 'class': 'credits__item credits__item--muted', text: T('ending.credit4') })
    ]);

    var actions = [
      btn(T('ending.back'), {
        variant: 'primary', icon: 'home', wide: true, focus: 'ending-back', autofocus: true,
        onClick: function () { uiSfx('uiBack'); safeCall('onQuitToTitle'); }
      }),
      btn(T('ending.again'), {
        variant: 'ghost', icon: 'restart', wide: true, focus: 'ending-again',
        onClick: function () { uiSfx('uiClick'); safeCall('onStartNew'); }
      })
    ];

    var body = [
      h('p', { 'class': 'panel__label', text: T('ending.creditsTitle') }),
      credits
    ];
    return modalShell(
      'screen--ending',
      T('meta.aurora'),
      T('ending.heading'),
      T('ending.sub'),
      [stats, h('div', { 'class': 'ending-credits panel panel--inset' }, body)],
      actions,
      'modal--ending'
    );
  }

  /* ============================ справка ============================ */

  function keyRow(label, keys) {
    var dd = h('dd', { 'class': 'keys__keys' });
    if (Array.isArray(keys)) {
      for (var i = 0; i < keys.length; i++) {
        if (i) dd.appendChild(h('span', { 'class': 'keys__sep', text: keys[i] }));
        else dd.appendChild(h('kbd', { 'class': 'kbd', text: keys[i] }));
      }
    } else {
      dd.appendChild(h('kbd', { 'class': 'kbd', text: keys }));
    }
    return h('div', { 'class': 'keys__row' }, [
      h('dt', { 'class': 'keys__label', text: label }),
      dd
    ]);
  }

  function abilityCard(abilityId, northmanId) {
    return h('li', { 'class': 'ability-card' }, [
      h('span', { 'class': 'ability-card__icon' }, [svgEl(abilityId)]),
      h('span', { 'class': 'ability-card__body' }, [
        h('span', { 'class': 'ability-card__head' }, [
          h('span', { 'class': 'ability-card__name', text: T('ability.' + abilityId) }),
          h('kbd', { 'class': 'ability-card__key', text: T('ability.' + abilityId + '.key') })
        ]),
        h('span', { 'class': 'ability-card__hint', text: T('ability.' + abilityId + '.hint') })
      ])
    ]);
  }

  var HELP_KEYS = [
    ['help.move', ['←', '→', 'A', 'D']],
    ['help.jump', ['↑', 'W', 'Space']],
    ['help.ability', ['J']],
    ['help.special', ['K']],
    ['help.hook', ['L']],
    ['help.switch', ['1', '2', '3', 'Tab']],
    ['help.pause', ['P', 'Esc']],
    ['help.restart', ['R']],
    ['help.hint', ['H']],
    ['help.mode', ['G']],
    ['help.langKey', ['Y']],
    ['help.mute', ['M']]
  ];

  function renderHelp() {
    if (!refs.help) return;
    clear(refs.help);

    var keysWrap = h('dl', { 'class': 'keys' });
    for (var i = 0; i < HELP_KEYS.length; i++) {
      var spec = HELP_KEYS[i];
      var keyList = spec[1].slice();
      var ddKids = [];
      for (var k = 0; k < keyList.length; k++) {
        if (k) ddKids.push(h('span', { 'class': 'keys__sep', text: '/' }));
        ddKids.push(h('kbd', { 'class': 'kbd', text: keyList[k] }));
      }
      keysWrap.appendChild(h('div', { 'class': 'keys__row' }, [
        h('dt', { 'class': 'keys__label', text: T(spec[0]) }),
        h('dd', { 'class': 'keys__keys' }, ddKids)
      ]));
    }

    var abilityList = h('ul', { 'class': 'ability-cards' });
    for (var v = 0; v < NORTHMEN.length; v++) {
      var vk = NORTHMEN[v];
      var cards = [];
      for (var a = 0; a < vk.abilities.length; a++) cards.push(abilityCard(vk.abilities[a], vk.id));
      abilityList.appendChild(h('li', { 'class': 'ability-group ability-group--' + vk.id }, [
        h('p', { 'class': 'ability-group__title' }, [
          h('span', { 'class': 'ability-group__name', text: T('northman.' + vk.id) }),
          h('span', { 'class': 'ability-group__role', text: T('northman.' + vk.id + '.role') })
        ]),
        h('ul', { 'class': 'ability-group__list' }, cards)
      ]));
    }

    var tips = h('ul', { 'class': 'tips' });
    for (var tip = 1; tip <= 5; tip++) {
      tips.appendChild(h('li', { 'class': 'tips__item' }, [
        h('span', { 'class': 'tips__bullet', 'aria-hidden': 'true' }, [svgEl('spark')]),
        h('span', { text: T('help.tip' + tip) })
      ]));
    }

    var modal = h('div', {
      'class': 'help-modal panel panel--glass',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'saga2-help-title'
    }, [
      h('header', { 'class': 'help-head' }, [
        h('div', { 'class': 'help-head__titles' }, [
          kicker(T('meta.aurora')),
          h('h2', { 'class': 'help-title', id: 'saga2-help-title', text: T('help.heading') }),
          h('p', { 'class': 'help-sub', text: T('help.sub') })
        ]),
        iconBtn('close', T('help.close'), {
          'class': 'help-close', focus: 'help-close', autofocus: true,
          onClick: function () { closeHelp(); }
        })
      ]),
      h('div', { 'class': 'help-grid' }, [
        h('section', { 'class': 'help-col' }, [
          h('p', { 'class': 'panel__label', text: T('help.keysTitle') }),
          keysWrap,
          h('p', { 'class': 'help-note', text: T('help.touchNote') })
        ]),
        h('section', { 'class': 'help-col help-col--abilities' }, [
          h('p', { 'class': 'panel__label', text: T('help.abilitiesTitle') }),
          abilityList
        ]),
        h('section', { 'class': 'help-col' }, [
          h('p', { 'class': 'panel__label', text: T('help.tipsTitle') }),
          tips,
          h('p', { 'class': 'help-note', text: T('help.climb') + ': ' + T('help.climbKeys') })
        ])
      ]),
      h('footer', { 'class': 'help-foot' }, [
        h('span', { 'class': 'help-foot__esc', text: 'Esc' }),
        h('span', { 'class': 'help-foot__hint', text: T('help.close') })
      ])
    ]);

    var backdrop = h('div', { 'class': 'help-backdrop', onclick: function () { closeHelp(); } });
    refs.help.appendChild(backdrop);
    refs.help.appendChild(modal);
  }

  function openHelp() {
    if (!st.inited || st.helpOpen) return;
    st.helpOpen = true;
    st.helpReturnFocus = document.activeElement;
    refs.help.hidden = false;
    refs.help.classList.add('is-open');
    renderHelp();
    document.body.classList.add('help-open');
    var close = refs.help.querySelector('[data-focus="help-close"]');
    focusEl(close);
    safeCall('onOpenHelp');
  }

  function closeHelp(silent) {
    if (!st.helpOpen) return;
    st.helpOpen = false;
    refs.help.classList.remove('is-open');
    refs.help.hidden = true;
    clear(refs.help);
    document.body.classList.remove('help-open');
    if (st.helpReturnFocus && st.helpReturnFocus.focus) {
      try { st.helpReturnFocus.focus({ preventScroll: true }); } catch (e) { /* no-op */ }
    }
    st.helpReturnFocus = null;
    if (!silent) safeCall('onCloseHelp');
  }

  function trapHelpFocus(ev) {
    var modal = refs.help ? refs.help.querySelector('.help-modal') : null;
    if (!modal) return;
    var list = focusableEls(modal);
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); focusEl(last); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); focusEl(first); }
  }

  /* ============================ тосты ============================ */

  function ensureToasts() {
    if (refs.toasts && refs.toasts.parentNode) return refs.toasts;
    var layer = document.getElementById('toasts');
    if (!layer) {
      layer = h('div', { id: 'toasts', 'class': 'toasts', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'false' });
      document.body.appendChild(layer);
    }
    refs.toasts = layer;
    return layer;
  }

  function toast(text, opts) {
    if (!st.inited || text == null || text === '') return;
    opts = opts || {};
    var layer = ensureToasts();
    var tone = opts.tone === 'warn' ? 'warn' : (opts.tone === 'success' ? 'success' : 'info');
    var iconName = tone === 'warn' ? 'warn' : (tone === 'success' ? 'check' : 'info');
    var node = h('div', { 'class': 'toast toast--' + tone }, [
      h('span', { 'class': 'toast__icon' }, [svgEl(iconName, { weight: 1.7 })]),
      h('span', { 'class': 'toast__text', text: String(text) })
    ]);
    layer.appendChild(node);
    while (layer.children.length > 4) layer.removeChild(layer.firstChild);
    var dur = clamp(nz(opts.duration, 2800), 900, 8000);
    window.setTimeout(function () { node.classList.add('is-out'); }, Math.max(400, dur - 320));
    window.setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, dur);
  }

  /* ============================ режим / язык / звук ============================ */

  function applyMode(mode) {
    var next = mode === 'retro' ? 'retro' : 'aurora';
    var changed = st.mode !== next;
    st.mode = next;
    document.body.classList.toggle('mode-retro', next === 'retro');
    document.body.classList.toggle('mode-aurora', next !== 'retro');
    document.body.setAttribute('data-mode', next);
    updateChips();
    if (changed) drawPortraits();
  }

  function applyLang(lang) {
    var next = lang === 'en' ? 'en' : 'ru';
    var changed = st.lang !== next;
    st.lang = next;
    if (window.SAGA2 && SAGA2.i18n) SAGA2.i18n.setLang(next);
    document.documentElement.lang = next;
    document.body.setAttribute('data-lang', next);
    if (!st.inited) return;
    if (!changed) return;
    var focusInfo = captureFocus();
    updateChips();
    if (st.helpOpen) renderHelp();
    if (st.screen === 'play') {
      render();
      updateHud(st.hudState);
    } else {
      render();
    }
    restoreFocus(focusInfo);
  }

  function applyMuted(muted) {
    st.muted = !!muted;
    document.body.classList.toggle('is-muted', st.muted);
    updateChips();
  }

  /* ============================ рендер экранов ============================ */

  var RENDERERS = {
    title: renderTitle,
    levels: renderLevels,
    brief: renderBrief,
    play: renderPlay,
    pause: renderPause,
    complete: renderComplete,
    ending: renderEnding
  };

  function render() {
    if (!refs.root) return;
    clear(refs.root);
    refs.hud = null;
    refs.portraits = [];
    st.touch = detectTouch();
    document.body.classList.toggle('is-touch', st.touch);
    var fn = RENDERERS[st.screen] || renderTitle;
    var section = fn();
    section.setAttribute('data-screen', st.screen);
    section.setAttribute('aria-label', T('a11y.screen.' + st.screen));
    refs.root.appendChild(section);
    document.body.setAttribute('data-screen', st.screen);
    document.body.setAttribute('data-mode', st.mode);
    document.body.setAttribute('data-lang', st.lang);
    if (st.screen === 'play') {
      drawPortraits();
    }
  }

  function focusScreen() {
    var el = refs.root ? refs.root.querySelector('[data-autofocus]') : null;
    if (!el) el = refs.root ? refs.root.querySelector('button:not([disabled])') : null;
    if (el) focusEl(el);
  }

  function screen(name, data) {
    if (!st.inited) return;
    name = String(name || 'title');
    if (name === 'help') { openHelp(); return; }
    if (SCREENS.indexOf(name) < 0) name = 'title';
    var same = name === st.screen;
    if (name !== st.screen) {
      st.prevScreen = st.screen;
      st.screen = name;
      st.data = data === undefined ? null : data;
    } else if (data !== undefined) {
      st.data = data;
    }
    if (name === 'brief') {
      st.briefIndex = clamp(Math.round(briefIndexFromData(data)), 0, levelCount() - 1);
    }
    if (name === 'play') {
      var pd = data && typeof data === 'object' ? data : {};
      st.playData = pd;
      if (isNum(pd.levelIndex) && (!st.hud || st.hud.levelIndex !== pd.levelIndex)) {
        st.hudState = null;
      }
    }
    if (name === 'complete') st.resultData = data && typeof data === 'object' ? data : null;
    if (name === 'ending') st.endingData = data && typeof data === 'object' ? data : null;
    if (name === 'pause' && data && typeof data === 'object' && isNum(data.levelIndex)) {
      st.playData = data;
    }
    if (st.helpOpen) closeHelp(true);
    render();
    if (name === 'play') {
      updateHud(st.hudState);
    }
    if (!same && name !== 'play') focusScreen();
  }

  /* ============================ инициализация ============================ */

  function buildSky() {
    var stage = document.getElementById('stage') || document.body;
    if (stage.querySelector('.sky-layer')) return;
    var sky = h('div', { 'class': 'sky-layer', 'aria-hidden': 'true' }, [
      h('div', { 'class': 'sky__stars' }),
      h('div', { 'class': 'sky__aurora sky__aurora--a' }),
      h('div', { 'class': 'sky__aurora sky__aurora--b' }),
      h('div', { 'class': 'sky__aurora sky__aurora--c' }),
      h('div', { 'class': 'sky__aurora sky__aurora--d' }),
      h('div', { 'class': 'sky__ridge' }),
      h('div', { 'class': 'sky__vignette' })
    ]);
    var canvas = stage.querySelector('#game');
    if (canvas && canvas.parentNode === stage) stage.insertBefore(sky, canvas);
    else stage.appendChild(sky);
  }

  function bindGlobal() {
    document.addEventListener('keydown', function (ev) {
      if (!st.helpOpen) return;
      if (ev.key === 'Escape') {
        ev.preventDefault();
        if (ev.stopPropagation) ev.stopPropagation();
        closeHelp();
        return;
      }
      if (ev.key === 'Tab') trapHelpFocus(ev);
    }, false);

    try {
      if (window.matchMedia) {
        var mq = window.matchMedia('(pointer: coarse)');
        var onChange = function () {
          if (st.touchForced != null) return;
          st.touch = mq.matches || (window.navigator && window.navigator.maxTouchPoints > 0);
          document.body.classList.toggle('is-touch', st.touch);
        };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
      }
    } catch (e) { /* no-op */ }
  }

  function init(opts) {
    opts = opts || {};
    if (st.inited) {
      if (opts.callbacks) st.callbacks = opts.callbacks;
      if (typeof opts.getState === 'function') st.getState = opts.getState;
      return SAGA2.ui;
    }
    st.callbacks = opts.callbacks || {};
    st.getState = typeof opts.getState === 'function' ? opts.getState : null;

    var ui = document.getElementById('ui');
    if (!ui) {
      ui = h('div', { id: 'ui', 'class': 'ui' });
      document.body.appendChild(ui);
    }
    ui.classList.add('ui');
    refs.canvas = document.getElementById('game');
    refs.stage = document.getElementById('stage') || (refs.canvas ? refs.canvas.parentNode : null) || document.body;

    refs.root = h('div', { 'class': 'screen-root' });
    refs.help = h('div', { 'class': 'help-layer', hidden: true });
    ui.appendChild(refs.root);
    ui.appendChild(refs.help);

    ensureToasts();
    buildSky();
    buildTouch();
    st.inited = true;
    st.touch = detectTouch();
    document.body.classList.toggle('is-touch', st.touch);
    bindGlobal();
    return SAGA2.ui;
  }

  /* ============================ public API ============================ */

  SAGA2.ui = {
    init: init,
    screen: screen,
    updateHud: updateHud,
    toast: toast,
    setMode: function (mode) { applyMode(mode); },
    setLang: function (lang) { applyLang(lang); },
    setMuted: function (muted) { applyMuted(muted); },
    setSaveInfo: function (info) {
      if (!info || typeof info !== 'object') return;
      st.save = {
        unlocked: clamp(Math.floor(nz(info.unlocked, st.save.unlocked, 1)), 1, levelCount()),
        hasProgress: !!info.hasProgress,
        levels: info.levels && typeof info.levels === 'object' ? info.levels : st.save.levels
      };
      if (!st.inited) return;
      if (st.screen === 'title' || st.screen === 'levels') {
        var focusInfo = captureFocus();
        render();
        restoreFocus(focusInfo);
      }
    },
    isHelpOpen: function () { return !!st.helpOpen; },
    getMode: function () { return st.mode; },
    getLang: function () { return st.lang; }
  };
})();
