/* БОЛТ · boot, цикл requestAnimationFrame, ввод, настройки, поток экранов. */
(function (global) {
  'use strict';
  var B = global.BOLT;
  if (!B) return;

  var LS = { gfx: 'bolt-gfx', lang: 'bolt-lang', snd: 'bolt-snd', hi: 'bolt-hi' };
  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // Настройки. По требованию контракта графика при старте всегда ретро.
  var gfx = 'retro';                       // retro | modern (ретро — всегда при загрузке)
  var lang = get(LS.lang, 'ru');
  var sound = get(LS.snd, '1') === '1';
  var hi = parseInt(get(LS.hi, '0'), 10) || 0;

  var canvas, ctx, game, last = 0, running = false;

  function boot() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    B.i18n.lang = lang; B.audio.setSound(sound);
    game = B.Game({ hi: hi, onEvent: onEvent });
    B.ui.applyI18n(); updateButtons(); B.ui.show('ovTitle');
    bindUI(); bindKeys(); bindTouch();
    exposeDebug();
    requestAnimationFrame(loop);
  }

  function onEvent(type, d) {
    switch (type) {
      case 'jump': B.audio.sfx('jump'); break;
      case 'shoot': B.audio.sfx('shoot'); break;
      case 'explode': B.audio.sfx('explode'); break;
      case 'pickup': B.audio.sfx('pickup'); break;
      case 'battery': B.audio.sfx('battery'); break;
      case 'door': B.audio.sfx('door'); break;
      case 'hurt': B.audio.sfx('hurt'); break;
      case 'gameover':
        B.audio.sfx('gameover'); B.audio.stopMusic(); running = false;
        if (d.score > hi) { hi = d.score; put(LS.hi, hi); game.setHi(hi); }
        B.ui.setOver(d.score, hi); B.ui.show('ovOver'); break;
      case 'win':
        B.audio.sfx('win'); B.audio.stopMusic(); running = false;
        if (d.score > hi) { hi = d.score; put(LS.hi, hi); game.setHi(hi); }
        B.ui.setWin(d.score, hi); B.ui.show('ovWin'); break;
    }
  }

  function startGame() {
    B.ui.hideAll(); B.audio.unlock();
    game = B.Game({ hi: hi, onEvent: onEvent });
    game.start(); running = true;
    if (sound) B.audio.startMusic();
  }

  function loop(ts) {
    if (!last) last = ts;
    var dt = Math.min((ts - last) / 1000, 0.05); last = ts;
    try {
      if (running && !game.isPaused()) game.update(dt);
      render();
    } catch (err) { if (global.console) console.error('BOLT loop', err); }
    requestAnimationFrame(loop);
  }

  function render() {
    var st = game.state();
    (gfx === 'modern' ? B.modern : B.classic).draw(ctx, st);
  }

  function togglePause() {
    if (!running) return;
    game.pause();
    if (game.isPaused()) { B.audio.stopMusic(); B.ui.show('ovPause'); }
    else { B.ui.hideAll(); if (sound) B.audio.startMusic(); }
  }

  function updateButtons() {
    var g = document.getElementById('valGfx'); if (g) g.textContent = B.t(gfx === 'modern' ? 'modern' : 'retro');
    var s = document.getElementById('valSnd'); if (s) s.textContent = B.t(sound ? 'on' : 'off');
    var l = document.getElementById('valLang'); if (l) l.textContent = lang.toUpperCase();
    document.documentElement.setAttribute('data-gfx', gfx);
  }
  function toggleGfx() { gfx = gfx === 'modern' ? 'retro' : 'modern'; put(LS.gfx, gfx); updateButtons(); }
  function toggleSound() {
    sound = !sound; put(LS.snd, sound ? '1' : '0'); B.audio.setSound(sound);
    if (sound && running && !game.isPaused()) B.audio.startMusic(); else B.audio.stopMusic();
    updateButtons();
  }
  function toggleLang() { lang = lang === 'ru' ? 'en' : 'ru'; put(LS.lang, lang); B.i18n.lang = lang; B.ui.applyI18n(); updateButtons(); }

  function bindUI() {
    var on = function (id, fn) { var e = document.getElementById(id); if (e) e.onclick = fn; };
    on('btnStart', startGame); on('btnAgain', startGame); on('btnWinAgain', startGame); on('btnResume', togglePause);
    on('btnGfx', toggleGfx); on('btnSnd', toggleSound); on('btnLang', toggleLang); on('btnPause', togglePause);
    on('btnHow', function () { var h = document.getElementById('helpBox'); if (h) h.style.display = h.style.display === 'none' ? 'block' : 'none'; });
  }

  function bindKeys() {
    document.addEventListener('keydown', function (e) {
      var c = e.code;
      if (c === 'Enter' || c === 'NumpadEnter') {
        if (!running) startGame();
        else if (game.phase() === 'gameover' || game.phase() === 'win') startGame();
        return;
      }
      if (c === 'KeyG') { toggleGfx(); return; }
      if (c === 'KeyM') { toggleSound(); return; }
      if (c === 'KeyL') { toggleLang(); return; }
      if (c === 'KeyP') { togglePause(); e.preventDefault(); return; }
      if (!running || game.isPaused()) return;
      switch (c) {
        case 'ArrowLeft': case 'KeyA': game.setHeld('left', true); e.preventDefault(); break;
        case 'ArrowRight': case 'KeyD': game.setHeld('right', true); e.preventDefault(); break;
        case 'Space': case 'ArrowUp': case 'KeyW': if (!e.repeat) game.jump(); e.preventDefault(); break;
        case 'KeyJ': case 'KeyX': game.shoot(); e.preventDefault(); break;
      }
    });
    document.addEventListener('keyup', function (e) {
      if (!running) return;
      var c = e.code;
      if (c === 'ArrowLeft' || c === 'KeyA') game.setHeld('left', false);
      else if (c === 'ArrowRight' || c === 'KeyD') game.setHeld('right', false);
    });
  }

  // Экранные кнопки для телефона.
  function bindTouch() {
    var map = { tLeft: ['left'], tRight: ['right'] };
    function hold(id, name, val) {
      var el = document.getElementById(id); if (!el) return;
      var set = function (v) { return function (ev) { ev.preventDefault(); if (running && !game.isPaused()) game.setHeld(name, v); }; };
      el.addEventListener('touchstart', set(true), { passive: false });
      el.addEventListener('touchend', set(false), { passive: false });
      el.addEventListener('mousedown', set(true)); el.addEventListener('mouseup', set(false)); el.addEventListener('mouseleave', set(false));
    }
    hold('tLeft', 'left'); hold('tRight', 'right');
    function tap(id, fn) {
      var el = document.getElementById(id); if (!el) return;
      var h = function (ev) { ev.preventDefault(); if (!running) { startGame(); return; } if (!game.isPaused()) fn(); };
      el.addEventListener('touchstart', h, { passive: false }); el.addEventListener('mousedown', h);
    }
    tap('tJump', function () { game.jump(); });
    tap('tShoot', function () { game.shoot(); });
  }

  // Отладочный хук для тестов.
  function exposeDebug() {
    global.__BOLT = {
      startGame: startGame,
      setGfx: function (g) { gfx = (g === 'modern') ? 'modern' : 'retro'; updateButtons(); },
      setLang: function (l) { lang = (l === 'en') ? 'en' : 'ru'; B.i18n.lang = lang; B.ui.applyI18n(); updateButtons(); },
      tick: function (dt) { if (running && !game.isPaused()) game.update(dt || 0.016); render(); },
      game: function () { return game; }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
