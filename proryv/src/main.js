/* ============================================================
   ПРОРЫВ HTML5 — оболочка: загрузка, масштабирование, цикл,
   ввод, звук, отладочные режимы (#test, #shot=...).
   ============================================================ */
(function () {
  'use strict';

  const PR = window.PR;
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d', { alpha: false });
  const errBox = document.getElementById('err');
  const testBox = document.getElementById('testout');

  const W = 256, VH = 208;
  const RETRO = window.PR_RENDER_RETRO;
  const MODERN = window.PR_RENDER_MODERN;
  const HASH = PR.HASH || {};

  /* offscreen для RETRO: ровно 256×208, потом масштабируем целым числом */
  const off = document.createElement('canvas');
  off.width = W; off.height = VH;
  const offCtx = off.getContext('2d', { alpha: false });
  offCtx.imageSmoothingEnabled = false;

  let dpr = 1, cw = 0, ch = 0, stage = { x: 0, y: 0, w: W, h: VH, scale: 1 };
  let acc = 0, last = 0, t = 0, booted = false;

  function reportError(msg) {
    if (!errBox) return;
    errBox.style.display = 'block';
    errBox.textContent += msg + '\n';
  }
  window.addEventListener('error', function (ev) { try { reportError(String(ev.message || ev.error || 'error')); } catch (e) { /* ok */ } });
  window.addEventListener('unhandledrejection', function (ev) { try { reportError('promise: ' + String(ev.reason)); } catch (e) { /* ok */ } });

  /* ---------- размеры ---------- */
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = Math.max(320, window.innerWidth);
    ch = Math.max(240, window.innerHeight);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;

    if (PR.settings.gfx === 'retro') {
      const s = Math.max(1, Math.floor(Math.min(cw / W, (ch - 8) / VH)));
      stage = { x: Math.round((cw - W * s) / 2), y: Math.round((ch - VH * s) / 2), w: W * s, h: VH * s, scale: s };
    } else {
      const pad = Math.min(cw, ch) > 700 ? 22 : 6;
      const sw = cw - pad * 2, sh = ch - pad * 2;
      const sc = Math.min(sw / W, sh / VH);
      const w = Math.round(W * sc), h = Math.round(VH * sc);
      stage = { x: Math.round((cw - w) / 2), y: Math.round((ch - h) / 2), w, h, scale: sc };
    }
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });

  /* ---------- звук ---------- */
  let audioBooted = false;
  function bootAudio() {
    if (audioBooted) return;
    audioBooted = true;
    const A = window.PR_AUDIO;
    if (!A) return;
    try {
      A.init();
      A.unlock();
      A.setMusic(PR.settings.music);
      A.setSfx(PR.settings.sfx);
      A.setVolume(0.8);
      if (PR.state.mode === 'title') A.playMusic('title');
    } catch (e) { reportError('audio: ' + e.message); }
  }

  /* ---------- ввод ---------- */
  const heldKey = {};
  function setHeld(code, down) {
    heldKey[code] = down;
    const i = PR.input;
    i.left = !!(heldKey.ArrowLeft || heldKey.KeyA);
    i.right = !!(heldKey.ArrowRight || heldKey.KeyD);
    i.up = !!(heldKey.ArrowUp || heldKey.KeyW);
    i.down = !!(heldKey.ArrowDown || heldKey.KeyS);
    i.fire = !!(heldKey.Space || heldKey.KeyZ);
  }

  const GAME_MODES = { play: 1, dead: 1 };

  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const code = e.code;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'Escape'].indexOf(code) >= 0) e.preventDefault();
    bootAudio();
    if (e.repeat) { setHeld(code, true); return; }
    switch (code) {
      case 'ArrowLeft': case 'KeyA': setHeld(code, true); PR.pushAction('left'); break;
      case 'ArrowRight': case 'KeyD': setHeld(code, true); PR.pushAction('right'); break;
      case 'ArrowUp': case 'KeyW': setHeld(code, true); PR.pushAction('up'); break;
      case 'ArrowDown': case 'KeyS': setHeld(code, true); PR.pushAction('down'); break;
      case 'Space': case 'KeyZ':
        setHeld(code, true);
        if (GAME_MODES[PR.state.mode]) { /* огонь */ }
        else PR.pushAction('action');
        break;
      case 'Enter': case 'NumpadEnter': PR.pushAction('enter'); break;
      case 'Escape': case 'KeyP': PR.pushAction('pause'); break;
      case 'KeyL': PR.pushAction('lang'); break;
      case 'KeyG': PR.pushAction('gfx'); resize(); break;
      case 'KeyM': PR.pushAction('music'); break;
      case 'KeyN': PR.pushAction('sfx'); break;
      case 'KeyF': toggleFullscreen(); break;
      case 'KeyR': PR.pushAction('restart'); break;
      default: break;
    }
  });
  window.addEventListener('keyup', function (e) { setHeld(e.code, false); });
  window.addEventListener('blur', function () {
    Object.keys(heldKey).forEach(function (k) { heldKey[k] = false; });
    setHeld('x', false);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && PR.state.mode === 'play') PR.setMode('paused');
  });

  function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    } catch (e) { /* ok */ }
  }

  /* ---------- указатель (мышь/тап) ---------- */
  function logical(x, y) {
    return { x: (x - stage.x) / stage.scale, y: (y - stage.y) / stage.scale };
  }
  canvas.addEventListener('pointerdown', function (e) {
    bootAudio();
    const p = logical(e.clientX, e.clientY);
    PR.input.pointer.x = p.x;
    PR.input.pointer.y = p.y;
    PR.input.pointer.clicked = true;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    const p = logical(e.clientX, e.clientY);
    PR.input.pointer.x = p.x;
    PR.input.pointer.y = p.y;
    if (PR.hover) PR.hover(p.x, p.y);
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------- отрисовка ---------- */
  function render() {
    const usingRetro = PR.settings.gfx === 'retro';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;

    if (usingRetro) {
      /* фон-подложка под «кинескопом» */
      ctx.fillStyle = '#04030a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      offCtx.setTransform(1, 0, 0, 1, 0, 0);
      offCtx.imageSmoothingEnabled = false;
      RETRO.draw(offCtx, { w: W, h: VH, t: t });

      const d = dpr;
      /* мягкое свечение вокруг */
      ctx.save();
      ctx.shadowColor = 'rgba(80,120,255,0.35)';
      ctx.shadowBlur = 24 * d;
      ctx.fillStyle = '#000';
      ctx.fillRect(stage.x * d, stage.y * d, stage.w * d, stage.h * d);
      ctx.restore();

      ctx.drawImage(off, 0, 0, W, VH, stage.x * d, stage.y * d, stage.w * d, stage.h * d);

      if (PR.settings.crt) {
        /* фосфорное послесвечение */
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.07;
        ctx.drawImage(off, 0, 0, W, VH, stage.x * d, stage.y * d, stage.w * d, stage.h * d);
        ctx.restore();
        /* скан-линии */
        ctx.save();
        ctx.globalAlpha = 0.30;
        ctx.fillStyle = '#000';
        const step = Math.max(2, Math.round(stage.scale * d));
        for (let y = stage.y * d; y < (stage.y + stage.h) * d; y += step) {
          ctx.fillRect(stage.x * d, y, stage.w * d, Math.max(1, Math.round(step * 0.25)));
        }
        ctx.restore();
      }
      /* тонкая рамка */
      ctx.strokeStyle = 'rgba(130,150,255,0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(stage.x * d + 0.5, stage.y * d + 0.5, stage.w * d - 1, stage.h * d - 1);
    } else {
      ctx.fillStyle = '#05030f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);
      MODERN.draw(ctx, {
        cw: cw, ch: ch,
        stage: { x: stage.x * dpr / dpr, y: stage.y, w: stage.w, h: stage.h },
        t: t
      });
      ctx.restore();
    }
  }

  /* ---------- цикл ---------- */
  function frame(ts) {
    if (!last) last = ts;
    let dt = (ts - last) / 1000;
    last = ts;
    if (dt > 0.25) dt = 0.25;
    t += dt;
    acc += dt;
    const STEP = 1 / 60;
    let guard = 0;
    while (acc >= STEP && guard < 4) {
      PR.update(STEP);
      acc -= STEP;
      guard++;
    }
    if (guard >= 4) acc = 0;
    render();
    requestAnimationFrame(frame);
  }

  /* ---------- отладка ---------- */
  function runTests() {
    const res = PR.runTests();
    const fails = res.filter(function (r) { return !r.ok; });
    const lines = res.map(function (r) { return (r.ok ? '  ok  ' : ' FAIL ') + r.name; });
    document.title = 'ПРОРЫВ TESTS ' + (res.length - fails.length) + '/' + res.length + (fails.length ? ' FAIL' : ' PASS');
    if (testBox) {
      testBox.style.display = 'block';
      testBox.textContent = 'ПРОРЫВ TESTS\n' + lines.join('\n') + '\n\n' +
        (fails.length ? 'ПРОВАЛЕНО: ' + fails.length : 'ВСЁ ПРОШЛО: ' + res.length + '/' + res.length) +
        (PR.state.debug.missingGlyphs ? '\nнет глифов: ' + PR.state.debug.missingGlyphs : '');
    }
    return res;
  }
  PR.renderTests = runTests;

  /* ---------- загрузка ---------- */
  function boot() {
    /* RETRO — режим по умолчанию при КАЖДОМ запуске.
       NEON включается только клавишей G в текущей сессии (и #gfx=modern для отладки). */
    PR.settings.gfx = (PR.HASH && PR.HASH.gfx === 'modern') ? 'modern' : 'retro';
    try { PR.saveSettings(); } catch (e) { /* ok */ }
    PR.BUILD = '28.10.2026';
    resize();
    PR.prepareTitle();
    if (PR.settings.gfx === 'modern') resize();

    const shot = HASH.shot;
    if (shot) {
      const level = HASH.level != null ? parseInt(HASH.level, 10) - 1 : 0;
      const screen = HASH.screen != null ? parseInt(HASH.screen, 10) - 1 : 0;
      PR.prepareShot(String(shot), { level: Math.max(0, level), screen: Math.max(0, screen) });
      if (HASH.mode) PR.setMode(String(HASH.mode));
    }
    if (HASH.test) {
      /* кадр для инициализации, затем тесты */
      requestAnimationFrame(function () {
        runTests();
        PR.prepareShot('title');
        if (PR.settings.gfx === 'modern') resize();
      });
    }
    if (HASH.music === 'off') {
      PR.settings.music = false;
      if (window.PR_AUDIO && window.PR_AUDIO.setMusic) window.PR_AUDIO.setMusic(false);
    }
    if (HASH.crt === 'off') PR.settings.crt = false;

    booted = true;
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* экспорт для QA-скриптов */
  window.PR_MAIN = {
    resize: resize,
    render: render,
    tests: runTests,
    stage: function () { return stage; },
    booted: function () { return booted; }
  };
})();
