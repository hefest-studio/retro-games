/* ПЛАЩ · boot, цикл requestAnimationFrame, ввод, настройки, поток экранов. */
(function (global) {
  'use strict';
  var P = global.PLASHCH;
  if (!P) return;

  var LS = { gfx: 'plashch-gfx', lang: 'plashch-lang', snd: 'plashch-snd', hi: 'plashch-hi' };
  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // Графика при старте всегда ретро (как в контракте семейства).
  var gfx = 'retro';
  var lang = get(LS.lang, 'ru');
  var sound = get(LS.snd, '1') === '1';
  var hi = parseInt(get(LS.hi, '0'), 10) || 0;

  var canvas, ctx, game, last = 0, running = false;

  function boot() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    P.i18n.lang = lang; P.audio.setSound(sound);
    game = P.Game({ hi: hi, onEvent: onEvent });
    P.ui.applyI18n(); updateButtons(); P.ui.show('ovTitle');
    bindUI(); bindKeys(); bindTouch();
    exposeDebug();
    requestAnimationFrame(loop);
  }

  function onEvent(type, d) {
    switch (type) {
      case 'jump': P.audio.sfx('jump'); break;
      case 'shoot': P.audio.sfx('shoot'); break;
      case 'grapple': P.audio.sfx('grapple'); break;
      case 'explode': P.audio.sfx('explode'); break;
      case 'pickup': P.audio.sfx('pickup'); break;
      case 'medkit': P.audio.sfx('medkit'); break;
      case 'bosshit': P.audio.sfx('bosshit'); break;
      case 'door': P.audio.sfx('door'); break;
      case 'hurt': P.audio.sfx('hurt'); break;
      case 'gameover':
        P.audio.sfx('gameover'); P.audio.stopMusic(); running = false;
        if (d.score > hi) { hi = d.score; put(LS.hi, hi); game.setHi(hi); }
        P.ui.setOver(d.score, hi); P.ui.show('ovOver'); break;
      case 'win':
        P.audio.sfx('win'); P.audio.stopMusic(); running = false;
        if (d.score > hi) { hi = d.score; put(LS.hi, hi); game.setHi(hi); }
        P.ui.setWin(d.score, hi); P.ui.show('ovWin'); break;
    }
  }

  function startGame() {
    P.ui.hideAll(); P.audio.unlock();
    game = P.Game({ hi: hi, onEvent: onEvent });
    game.start(); running = true;
    if (sound) P.audio.startMusic();
  }

  function loop(ts) {
    if (!last) last = ts;
    var dt = Math.min((ts - last) / 1000, 0.05); last = ts;
    try {
      if (running && !game.isPaused()) game.update(dt);
      render();
    } catch (err) { if (global.console) console.error('PLASHCH loop', err); }
    requestAnimationFrame(loop);
  }

  function render() {
    if (!game) return;
    var st = game.state();
    (gfx === 'modern' ? P.modern : P.classic).draw(ctx, st);
  }

  function togglePause() {
    if (!running) return;
    game.pause();
    if (game.isPaused()) { P.audio.stopMusic(); P.ui.show('ovPause'); }
    else { P.ui.hideAll(); if (sound) P.audio.startMusic(); }
  }

  function updateButtons() {
    var g = document.getElementById('valGfx'); if (g) g.textContent = P.t(gfx === 'modern' ? 'modern' : 'retro');
    var s = document.getElementById('valSnd'); if (s) s.textContent = P.t(sound ? 'on' : 'off');
    var l = document.getElementById('valLang'); if (l) l.textContent = lang.toUpperCase();
    document.documentElement.setAttribute('data-gfx', gfx);
  }
  function toggleGfx() { gfx = gfx === 'modern' ? 'retro' : 'modern'; put(LS.gfx, gfx); updateButtons(); }
  function toggleSound() {
    sound = !sound; put(LS.snd, sound ? '1' : '0'); P.audio.setSound(sound);
    if (sound && running && !game.isPaused()) P.audio.startMusic(); else P.audio.stopMusic();
    updateButtons();
  }
  function toggleLang() { lang = lang === 'ru' ? 'en' : 'ru'; put(LS.lang, lang); P.i18n.lang = lang; P.ui.applyI18n(); updateButtons(); }

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
        case 'ArrowDown': case 'KeyS': game.setHeld('down', true); e.preventDefault(); break;
        case 'ArrowUp': case 'KeyW': game.setHeld('up', true); if (!e.repeat) game.jump(); e.preventDefault(); break;
        case 'Space': if (!e.repeat) game.jump(); e.preventDefault(); break;
        case 'KeyJ': case 'KeyX': game.shoot(); e.preventDefault(); break;
        case 'KeyK': case 'ShiftLeft': case 'ShiftRight': if (!e.repeat) game.grapple(); e.preventDefault(); break;
      }
    });
    document.addEventListener('keyup', function (e) {
      if (!running) return;
      var c = e.code;
      if (c === 'ArrowLeft' || c === 'KeyA') game.setHeld('left', false);
      else if (c === 'ArrowRight' || c === 'KeyD') game.setHeld('right', false);
      else if (c === 'ArrowDown' || c === 'KeyS') game.setHeld('down', false);
      else if (c === 'ArrowUp' || c === 'KeyW') game.setHeld('up', false);
    });
  }

  // Экранные кнопки для телефона.
  function bindTouch() {
    function hold(id, name) {
      var el = document.getElementById(id); if (!el) return;
      var set = function (v) { return function (ev) { ev.preventDefault(); if (running && !game.isPaused()) game.setHeld(name, v); }; };
      el.addEventListener('touchstart', set(true), { passive: false });
      el.addEventListener('touchend', set(false), { passive: false });
      el.addEventListener('mousedown', set(true)); el.addEventListener('mouseup', set(false)); el.addEventListener('mouseleave', set(false));
    }
    hold('tLeft', 'left'); hold('tRight', 'right'); hold('tDuck', 'down');
    function tap(id, fn) {
      var el = document.getElementById(id); if (!el) return;
      var h = function (ev) { ev.preventDefault(); if (!running) { startGame(); return; } if (!game.isPaused()) fn(); };
      el.addEventListener('touchstart', h, { passive: false }); el.addEventListener('mousedown', h);
    }
    tap('tJump', function () { game.jump(); });
    tap('tShoot', function () { game.shoot(); });
    tap('tHook', function () { game.grapple(); });
  }

  // Отладочный хук для тестов.
  function exposeDebug() {
    global.__PLASHCH = {
      startGame: startGame,
      setGfx: function (g) { gfx = (g === 'modern') ? 'modern' : 'retro'; updateButtons(); },
      setLang: function (l) { lang = (l === 'en') ? 'en' : 'ru'; P.i18n.lang = lang; P.ui.applyI18n(); updateButtons(); },
      tick: function (dt) { if (running && !game.isPaused()) game.update(dt || 0.016); render(); },
      game: function () { return game; }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
