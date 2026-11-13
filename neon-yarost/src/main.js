/* ============================================================
   НЕОН × ЯРОСТЬ: NEON YAROST
   main.js — оболочка: canvas, масштаб, ввод, звук, CRT, rAF, QA-хэши.
   Владелец: Lead. Контракт: docs/CONTRACT.md.
   ============================================================ */
(function () {
  'use strict';

  var NR = window.NR;
  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d', { alpha: false });
  var errBox = document.getElementById('err');
  var testBox = document.getElementById('testout');
  var hint = document.getElementById('hint');

  if (!NR || !canvas || !ctx) return;

  var W = NR.W || 480, H = NR.H || 270;
  var RETRO = window.NR_RENDER_RETRO;
  var MODERN = window.NR_RENDER_MODERN;

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
    if (NR.settings.gfx === 'retro') {
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
    var A = window.NR_AUDIO;
    if (!A) return;
    try {
      if (!bootedAudio) {
        bootedAudio = true;
        A.init();
      }
      var r = A.unlock ? A.unlock() : null;
      if (r && r.then) r.then(function () { NR.syncAudio(); }).catch(function () { /* ok */ });
      NR.syncAudio();
    } catch (e) { report('audio: ' + (e && e.message ? e.message : e)); }
  }

  /* ---------- ввод ---------- */
  var heldKeys = {};

  function syncHeld() {
    NR.setHeld('left', !!(heldKeys.ArrowLeft || heldKeys.KeyA));
    NR.setHeld('right', !!(heldKeys.ArrowRight || heldKeys.KeyD));
    NR.setHeld('up', !!(heldKeys.ArrowUp || heldKeys.KeyW));
    NR.setHeld('down', !!(heldKeys.ArrowDown || heldKeys.KeyS));
    NR.setHeld('jump', !!heldKeys.Space);
    NR.setHeld('punch', !!(heldKeys.KeyJ || heldKeys.KeyZ));
    NR.setHeld('kick', !!(heldKeys.KeyK || heldKeys.KeyX));
    NR.setHeld('special', !!heldKeys.KeyV);  /* L — язык (стандарт аркады), ярость — V */
  }

  function menuMode() {
    var m = NR.state.mode;
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
      case 'ArrowLeft': case 'KeyA': NR.press('left'); break;
      case 'ArrowRight': case 'KeyD': NR.press('right'); break;
      case 'ArrowUp': case 'KeyW': NR.press('up'); break;
      case 'ArrowDown': case 'KeyS': NR.press('down'); break;
      case 'Space':
        if (menuMode()) NR.press('confirm');
        else NR.press('jump');
        break;
      case 'KeyJ': case 'KeyZ': NR.press('punch'); break;
      case 'KeyK': case 'KeyX': NR.press('kick'); break;
      case 'KeyV': NR.press('special'); break;
      case 'Enter': case 'NumpadEnter': NR.press('confirm'); break;
      case 'Escape': NR.press('back'); break;
      case 'KeyP': NR.press('pause'); break;
      /* раскладка аркады «Гефест»: T и G — тема (графика), L — язык */
      case 'KeyG': case 'KeyT': NR.press('gfx'); break;
      case 'KeyL': NR.press('lang'); break;
      case 'KeyM': NR.press('music'); break;
      case 'KeyF': NR.press('fullscreen'); break;
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
    if (document.hidden && NR.state.mode === 'play') NR.press('pause');
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
    NR.input.pointer.x = p.x;
    NR.input.pointer.y = p.y;
    NR.pointerDown(p.x, p.y);
    try { canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('pointermove', function (e) {
    var p = logicalFromEvent(e);
    NR.input.pointer.x = p.x;
    NR.input.pointer.y = p.y;
  });

  canvas.addEventListener('pointerup', function (e) {
    var p = logicalFromEvent(e);
    NR.pointerUp(p.x, p.y);
  });
  canvas.addEventListener('pointercancel', function () { NR.pointerUp(0, 0); });
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
          NR.setHeld(name, true);
          try { btn.setPointerCapture && btn.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
        }
        function up(e) {
          if (e) e.preventDefault();
          btn.classList.remove('active');
          NR.setHeld(name, false);
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
          NR.press(action);
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
      NR.press('pause');
    }, { passive: false });
    touchPause.addEventListener('pointerup', function () { touchPause.classList.remove('active'); });
    touchPause.addEventListener('pointercancel', function () { touchPause.classList.remove('active'); });
    touchPause.addEventListener('pointerleave', function () { touchPause.classList.remove('active'); });
  }

  /* ---------- фуллскрин / подсказки ---------- */
  function handleFullscreen() {
    if (!NR.wantFullscreen) return;
    NR.wantFullscreen = false;
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
    var s = NR.settings;
    if (setting === 'gfx') return NR.t(s.gfx === 'retro' ? 'gfx.retro' : 'gfx.modern');
    if (setting === 'music') return NR.t(s.music ? 'common.on' : 'common.off');
    if (setting === 'lang') return String(s.lang).toUpperCase();
    return '';
  }

  function watchSettings() {
    if (lastGfx !== null && NR.settings.gfx !== lastGfx) {
      resize();
      showHint(NR.t('quick.gfx') + ' · ' + valueLabel('gfx'));
    }
    if (lastLang !== null && NR.settings.lang !== lastLang) {
      showHint('ЯЗЫК · ' + String(NR.settings.lang).toUpperCase());
    }
    if (lastMusic !== null && NR.settings.music !== lastMusic) {
      showHint(NR.t('quick.music') + ' · ' + valueLabel('music'));
    }
    lastGfx = NR.settings.gfx;
    lastLang = NR.settings.lang;
    lastMusic = NR.settings.music;
    document.documentElement.setAttribute('data-gfx', NR.settings.gfx);
    document.documentElement.lang = NR.settings.lang;
    var touchPlay = NR.state.mode === 'play' || NR.state.mode === 'dead';
    document.body.classList.toggle('in-game', touchPlay);
    document.body.classList.toggle('pausable', touchPlay || NR.state.mode === 'paused');
  }

  /* ---------- отрисовка ---------- */
  function drawCrt(retro) {
    if (!NR.settings.crt) return;
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
    var gfx = NR.settings.gfx;

    if (gfx === 'retro') {
      if (!RETRO) return;
      offCtx.setTransform(1, 0, 0, 1, 0, 0);
      offCtx.imageSmoothingEnabled = false;
      RETRO.draw(offCtx, { w: W, h: H, t: NR.state.t });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, W, H, Math.round(s.x * sd), Math.round(s.y * sd),
        Math.round(s.w * sd), Math.round(s.h * sd));
      drawCrt(true);
    } else {
      if (!MODERN) return;
      var scale = s.scale * sd;
      ctx.setTransform(scale, 0, 0, scale, Math.round(s.x * sd), Math.round(s.y * sd));
      MODERN.draw(ctx, { w: W, h: H, t: NR.state.t });
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
    if (params.gfx === 'modern' || params.gfx === 'retro') NR.settings.gfx = params.gfx;
    if (params.lang === 'ru' || params.lang === 'en') NR.settings.lang = params.lang;
    if (params.scene && NR.debug) NR.debug.scene(params.scene);
    if (params.wave && NR.debug) NR.debug.wave(parseInt(params.wave, 10) || 0);
    if (params.touch === '1') document.body.classList.add('touch');
    if (params.freeze === '1' && NR.debug) NR.debug.freeze(true);
    if (params.demo === '1' && NR.debug) NR.debug.demo();
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
      NR.update(dt);
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
    NR.init();
    resize();
    lastGfx = NR.settings.gfx;
    lastLang = NR.settings.lang;
    lastMusic = NR.settings.music;
    if (window.location.hash) applyHash();
    lastGfx = NR.settings.gfx;
    lastLang = NR.settings.lang;
    lastMusic = NR.settings.music;
    NR.syncAudio();
    render();
    window.requestAnimationFrame(frame);
    setTimeout(function () {
      if (!window.location.hash && !document.body.classList.contains('touch')) {
        showHint(NR.t('help.quickKeys'), 5200);
      }
    }, 900);
  } catch (e) {
    fatal = true;
    report('BOOT: ' + (e && e.stack ? e.stack : e));
  }

  /* отладочный доступ для QA */
  window.NR_SHELL = {
    stage: function () { return stage; },
    resize: resize,
    render: render,
    fatal: function () { return fatal; }
  };
})();
