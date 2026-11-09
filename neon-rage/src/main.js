/* ============================================================
   НЕОН × ЯРОСТЬ: NEON RAGE
   main.js — оболочка: canvas, масштаб, ввод, звук, CRT, rAF, QA-хэши.
   Владелец: Lead. Контракт: docs/CONTRACT.md.
   ============================================================ */
(function () {
  'use strict';

  var DD = window.DD;
  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d', { alpha: false });
  var errBox = document.getElementById('err');
  var testBox = document.getElementById('testout');
  var hint = document.getElementById('hint');

  if (!DD || !canvas || !ctx) return;

  var W = DD.W || 480, H = DD.H || 270;
  var RETRO = window.DD_RENDER_RETRO;
  var MODERN = window.DD_RENDER_MODERN;

  var off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  var offCtx = off.getContext('2d', { alpha: false });
  offCtx.imageSmoothingEnabled = false;

  var dpr = 1, cw = 0, ch = 0;
  var stage = { x: 0, y: 0, w: W, h: H, scale: 1 };
  var lastGfx = null, lastLang = null, lastMusic = null;
  var bootedAudio = false;
  var fatal = false;
  var bgGrad = null, vignette = null;
  var hintTimer = 0;

  function report(msg) {
    if (!errBox) return;
    errBox.style.display = 'block';
    errBox.textContent += String(msg) + '\n';
  }

  window.addEventListener('error', function (ev) {
    try { report((ev.message || 'error') + (ev.filename ? ' @ ' + ev.filename + ':' + ev.lineno : '')); } catch (e) { /* ok */ }
  });
  window.addEventListener('unhandledrejection', function (ev) {
    try { report('promise: ' + String(ev.reason)); } catch (e) { /* ok */ }
  });

  /* ---------- масштаб ---------- */
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = Math.max(280, window.innerWidth || 960);
    ch = Math.max(200, window.innerHeight || 540);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;

    var s;
    if (DD.settings.gfx === 'retro') {
      var availW = Math.max(120, cw);
      var availH = Math.max(90, ch);
      s = Math.min(availW / W, availH / H);
      if (s >= 2) s = Math.floor(s + 0.0001);
      else s = Math.max(0.5, s);
    } else {
      var pad = Math.min(cw, ch) > 900 ? 14 : 0;
      s = Math.min((cw - pad * 2) / W, (ch - pad * 2) / H);
      s = Math.max(0.5, s);
    }
    var sw = Math.round(W * s), sh = Math.round(H * s);
    stage = {
      x: Math.round((cw - sw) / 2),
      y: Math.round((ch - sh) / 2),
      w: sw, h: sh, scale: s
    };
    offCtx.imageSmoothingEnabled = false;

    /* фон вокруг игры */
    bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#0b0820');
    bgGrad.addColorStop(0.5, '#07060f');
    bgGrad.addColorStop(1, '#03020a');

    vignette = ctx.createRadialGradient(
      canvas.width * 0.5, canvas.height * 0.48, Math.min(canvas.width, canvas.height) * 0.18,
      canvas.width * 0.5, canvas.height * 0.5, Math.max(canvas.width, canvas.height) * 0.72
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.68, 'rgba(0,0,0,0.08)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.62)');
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 150); });

  /* ---------- звук ---------- */
  function ensureAudio() {
    var A = window.DD_AUDIO;
    if (!A) return;
    try {
      if (!bootedAudio) {
        bootedAudio = true;
        A.init();
      }
      var r = A.unlock ? A.unlock() : null;
      if (r && r.then) r.then(function () { DD.syncAudio(); }).catch(function () { /* ok */ });
      DD.syncAudio();
    } catch (e) { report('audio: ' + (e && e.message ? e.message : e)); }
  }

  /* ---------- ввод ---------- */
  var heldKeys = {};

  function syncHeld() {
    DD.setHeld('left', !!(heldKeys.ArrowLeft || heldKeys.KeyA));
    DD.setHeld('right', !!(heldKeys.ArrowRight || heldKeys.KeyD));
    DD.setHeld('up', !!(heldKeys.ArrowUp || heldKeys.KeyW));
    DD.setHeld('down', !!(heldKeys.ArrowDown || heldKeys.KeyS));
    DD.setHeld('jump', !!heldKeys.Space);
    DD.setHeld('punch', !!(heldKeys.KeyJ || heldKeys.KeyZ));
    DD.setHeld('kick', !!(heldKeys.KeyK || heldKeys.KeyX));
    DD.setHeld('special', !!(heldKeys.KeyL || heldKeys.KeyV));
  }

  function menuMode() {
    var m = DD.state.mode;
    return m !== 'play' && m !== 'dead';
  }

  function onKeyDown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var code = e.code;
    var gameKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'Escape',
      'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'KeyK', 'KeyL', 'KeyZ', 'KeyX', 'KeyV', 'KeyP',
      'KeyG', 'KeyT', 'KeyM', 'KeyF'];
    if (gameKeys.indexOf(code) >= 0) e.preventDefault();
    if (code === 'Space' && menuMode()) e.preventDefault();
    ensureAudio();
    if (e.repeat) {
      heldKeys[code] = true;
      syncHeld();
      return;
    }
    heldKeys[code] = true;
    syncHeld();
    switch (code) {
      case 'ArrowLeft': case 'KeyA': DD.press('left'); break;
      case 'ArrowRight': case 'KeyD': DD.press('right'); break;
      case 'ArrowUp': case 'KeyW': DD.press('up'); break;
      case 'ArrowDown': case 'KeyS': DD.press('down'); break;
      case 'Space':
        if (menuMode()) DD.press('confirm');
        else DD.press('jump');
        break;
      case 'KeyJ': case 'KeyZ': DD.press('punch'); break;
      case 'KeyK': case 'KeyX': DD.press('kick'); break;
      case 'KeyL': case 'KeyV': DD.press('special'); break;
      case 'Enter': case 'NumpadEnter': DD.press('confirm'); break;
      case 'Escape': DD.press('back'); break;
      case 'KeyP': DD.press('pause'); break;
      case 'KeyG': DD.press('gfx'); break;
      case 'KeyT': DD.press('lang'); break;
      case 'KeyM': DD.press('music'); break;
      case 'KeyF': DD.press('fullscreen'); break;
      default: break;
    }
  }

  function onKeyUp(e) {
    heldKeys[e.code] = false;
    syncHeld();
  }

  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', function () {
    heldKeys = {};
    syncHeld();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && DD.state.mode === 'play') DD.press('pause');
  });

  /* ---------- указатель / тач ---------- */
  function logicalFromEvent(e) {
    var r = canvas.getBoundingClientRect();
    var px = e.clientX - r.left;
    var py = e.clientY - r.top;
    return {
      x: (px - stage.x) / stage.w * W,
      y: (py - stage.y) / stage.h * H
    };
  }

  canvas.addEventListener('pointerdown', function (e) {
    ensureAudio();
    if (e.pointerType === 'touch') document.body.classList.add('touch');
    var p = logicalFromEvent(e);
    DD.input.pointer.x = p.x;
    DD.input.pointer.y = p.y;
    DD.pointerDown(p.x, p.y);
    try { canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('pointermove', function (e) {
    var p = logicalFromEvent(e);
    DD.input.pointer.x = p.x;
    DD.input.pointer.y = p.y;
  });

  canvas.addEventListener('pointerup', function (e) {
    var p = logicalFromEvent(e);
    DD.pointerUp(p.x, p.y);
  });
  canvas.addEventListener('pointercancel', function () { DD.pointerUp(0, 0); });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* тач-кнопки из template.html */
  var touchEl = document.getElementById('touch');
  if (touchEl) {
    var isCoarse = false;
    try {
      isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    } catch (e) { /* ok */ }
    if (isCoarse || (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && window.innerWidth < 1100) {
      document.body.classList.add('touch');
    }
    var holdBtns = touchEl.querySelectorAll('[data-hold]');
    for (var hi = 0; hi < holdBtns.length; hi++) {
      (function (btn) {
        var name = btn.getAttribute('data-hold');
        function down(e) {
          ensureAudio();
          e.preventDefault();
          btn.classList.add('active');
          DD.setHeld(name, true);
          try { btn.setPointerCapture && btn.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
        }
        function up(e) {
          if (e) e.preventDefault();
          btn.classList.remove('active');
          DD.setHeld(name, false);
        }
        btn.addEventListener('pointerdown', down, { passive: false });
        btn.addEventListener('pointerup', up, { passive: false });
        btn.addEventListener('pointercancel', up);
        btn.addEventListener('pointerleave', up);
      })(holdBtns[hi]);
    }
    var pressBtns = touchEl.querySelectorAll('[data-press]');
    for (var pi = 0; pi < pressBtns.length; pi++) {
      (function (btn) {
        var action = btn.getAttribute('data-press');
        btn.addEventListener('pointerdown', function (e) {
          ensureAudio();
          e.preventDefault();
          btn.classList.add('active');
          DD.press(action);
          try { btn.setPointerCapture && btn.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
        }, { passive: false });
        btn.addEventListener('pointerup', function () { btn.classList.remove('active'); });
        btn.addEventListener('pointercancel', function () { btn.classList.remove('active'); });
        btn.addEventListener('pointerleave', function () { btn.classList.remove('active'); });
      })(pressBtns[pi]);
    }
  }

  var touchPause = document.getElementById('tpause');
  if (touchPause) {
    touchPause.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      ensureAudio();
      touchPause.classList.add('active');
      DD.press('pause');
    }, { passive: false });
    touchPause.addEventListener('pointerup', function () { touchPause.classList.remove('active'); });
    touchPause.addEventListener('pointercancel', function () { touchPause.classList.remove('active'); });
    touchPause.addEventListener('pointerleave', function () { touchPause.classList.remove('active'); });
  }

  /* ---------- фуллскрин / подсказки ---------- */
  function handleFullscreen() {
    if (!DD.wantFullscreen) return;
    DD.wantFullscreen = false;
    try {
      if (!document.fullscreenElement) {
        var r = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
        if (r && r.catch) r.catch(function () { /* ok */ });
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    } catch (e) { /* ok */ }
  }

  function showHint(text, ms) {
    if (!hint || !text) return;
    hint.textContent = text;
    hint.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { hint.classList.remove('show'); }, ms || 1900);
  }

  function valueLabel(setting) {
    var s = DD.settings;
    if (setting === 'gfx') return DD.t(s.gfx === 'retro' ? 'gfx.retro' : 'gfx.modern');
    if (setting === 'music') return DD.t(s.music ? 'common.on' : 'common.off');
    if (setting === 'lang') return String(s.lang).toUpperCase();
    return '';
  }

  function watchSettings() {
    if (lastGfx !== null && DD.settings.gfx !== lastGfx) {
      resize();
      showHint(DD.t('quick.gfx') + ' · ' + valueLabel('gfx'));
    }
    if (lastLang !== null && DD.settings.lang !== lastLang) {
      showHint('ЯЗЫК · ' + String(DD.settings.lang).toUpperCase());
    }
    if (lastMusic !== null && DD.settings.music !== lastMusic) {
      showHint(DD.t('quick.music') + ' · ' + valueLabel('music'));
    }
    lastGfx = DD.settings.gfx;
    lastLang = DD.settings.lang;
    lastMusic = DD.settings.music;
    document.documentElement.setAttribute('data-gfx', DD.settings.gfx);
    document.documentElement.lang = DD.settings.lang;
    var touchPlay = DD.state.mode === 'play' || DD.state.mode === 'dead';
    document.body.classList.toggle('in-game', touchPlay);
    document.body.classList.toggle('pausable', touchPlay || DD.state.mode === 'paused');
  }

  /* ---------- отрисовка ---------- */
  function drawCrt(retro) {
    if (!DD.settings.crt) return;
    var sd = dpr;
    var s = stage;
    ctx.save();
    if (retro) {
      /* фосфорное послесвечение */
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.05;
      ctx.imageSmoothingEnabled = false;
      try { ctx.drawImage(off, 0, 0, W, H, s.x * sd, s.y * sd, s.w * sd, s.h * sd); } catch (e) { /* ok */ }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    /* скан-линии */
    var lineStep = Math.max(2, Math.round((s.h * sd) / H * (retro ? 1.7 : 2.4)));
    var lineH = Math.max(1, Math.round(lineStep * (retro ? 0.42 : 0.22)));
    ctx.globalAlpha = retro ? 0.20 : 0.07;
    ctx.fillStyle = '#000';
    for (var y = s.y * sd; y < (s.y + s.h) * sd; y += lineStep) {
      ctx.fillRect(s.x * sd, y, s.w * sd, lineH);
    }
    ctx.globalAlpha = 1;
    /* виньетка */
    if (vignette) {
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    /* тонкая рамка */
    ctx.strokeStyle = retro ? 'rgba(150,160,255,0.20)' : 'rgba(34,230,255,0.16)';
    ctx.lineWidth = Math.max(1, Math.round(dpr));
    ctx.strokeRect(s.x * sd + 0.5, s.y * sd + 0.5, s.w * sd - 1, s.h * sd - 1);
    ctx.restore();
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = bgGrad || '#05040a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var s = stage;
    var sd = dpr;
    var gfx = DD.settings.gfx;

    if (gfx === 'retro') {
      if (!RETRO) return;
      offCtx.setTransform(1, 0, 0, 1, 0, 0);
      offCtx.imageSmoothingEnabled = false;
      RETRO.draw(offCtx, { w: W, h: H, t: DD.state.t });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, W, H, Math.round(s.x * sd), Math.round(s.y * sd),
        Math.round(s.w * sd), Math.round(s.h * sd));
      drawCrt(true);
    } else {
      if (!MODERN) return;
      var scale = s.scale * sd;
      ctx.setTransform(scale, 0, 0, scale, Math.round(s.x * sd), Math.round(s.y * sd));
      MODERN.draw(ctx, { w: W, h: H, t: DD.state.t });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawCrt(false);
    }
  }

  /* ---------- QA URL hash ---------- */
  function applyHash() {
    var raw = String(window.location.hash || '').replace(/^#/, '');
    if (!raw) return;
    var params = {};
    raw.split('&').forEach(function (pair) {
      var i = pair.indexOf('=');
      if (i < 0) params[decodeURIComponent(pair)] = '1';
      else params[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1));
    });
    if (params.gfx === 'modern' || params.gfx === 'retro') DD.settings.gfx = params.gfx;
    if (params.lang === 'ru' || params.lang === 'en') DD.settings.lang = params.lang;
    if (params.scene && DD.debug) DD.debug.scene(params.scene);
    if (params.wave && DD.debug) DD.debug.wave(parseInt(params.wave, 10) || 0);
    if (params.touch === '1') document.body.classList.add('touch');
    if (params.freeze === '1' && DD.debug) DD.debug.freeze(true);
    if (params.demo === '1' && DD.debug) DD.debug.demo();
    watchSettings();
    resize();
  }

  /* ---------- цикл ---------- */
  var last = 0;
  function frame(ts) {
    if (!last) last = ts;
    var dt = (ts - last) / 1000;
    last = ts;
    if (dt > 0.1) dt = 0.033;
    try {
      handleFullscreen();
      DD.update(dt);
      watchSettings();
      render();
    } catch (e) {
      fatal = true;
      report('FATAL: ' + (e && e.stack ? e.stack : e));
      try { console.error(e); } catch (err) { /* ok */ }
    }
    if (!fatal) window.requestAnimationFrame(frame);
  }

  /* ---------- старт ---------- */
  try {
    DD.init();
    resize();
    lastGfx = DD.settings.gfx;
    lastLang = DD.settings.lang;
    lastMusic = DD.settings.music;
    if (window.location.hash) applyHash();
    lastGfx = DD.settings.gfx;
    lastLang = DD.settings.lang;
    lastMusic = DD.settings.music;
    DD.syncAudio();
    render();
    window.requestAnimationFrame(frame);
    setTimeout(function () {
      if (!window.location.hash && !document.body.classList.contains('touch')) {
        showHint(DD.t('help.quickKeys'), 5200);
      }
    }, 900);
  } catch (e) {
    fatal = true;
    report('BOOT: ' + (e && e.stack ? e.stack : e));
  }

  /* отладочный доступ для QA */
  window.DD_SHELL = {
    stage: function () { return stage; },
    resize: resize,
    render: render,
    fatal: function () { return fatal; }
  };
})();
