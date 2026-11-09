/* КОЛОБОК · boot, цикл requestAnimationFrame, ввод, настройки, поток экранов. */
(function (global) {
  'use strict';
  var K = global.KOLOBOK;
  if (!K) return;

  var LS = { gfx: 'kolobok-gfx', lang: 'kolobok-lang', snd: 'kolobok-snd', hi: 'kolobok-hi' };
  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // Графика при каждой загрузке принудительно ретро (8-бит).
  var gfx = 'retro';
  var lang = get(LS.lang, 'ru');
  var sound = get(LS.snd, '1') === '1';
  var hi = parseInt(get(LS.hi, '0'), 10) || 0;

  var canvas, ctx, game, last = 0, running = false;

  function boot() {
    canvas = document.getElementById('game');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    K.i18n.lang = lang; K.audio.setSound(sound);
    game = K.Game({ hi: hi, onEvent: onEvent });
    K.ui.applyI18n(); updateButtons(); K.ui.show('ovTitle');
    bindUI(); bindKeys(); bindTouch();
    exposeDebug();
    requestAnimationFrame(loop);
  }

  function onEvent(type, d) {
    switch (type) {
      case 'jump': K.audio.sfx('jump'); break;
      case 'berry': K.audio.sfx('berry'); break;
      case 'pickup': K.audio.sfx('pickup'); break;
      case 'door': K.audio.sfx('door'); break;
      case 'plank': K.audio.sfx('plank'); break;
      case 'splash': K.audio.sfx('splash'); break;
      case 'nope': K.audio.sfx('nope'); break;
      case 'warp': K.audio.sfx('warp'); break;
      case 'hurt': K.audio.sfx('hurt'); break;
      case 'gameover':
        K.audio.sfx('gameover'); K.audio.stopMusic(); running = false;
        if (d.score > hi) { hi = d.score; put(LS.hi, hi); game.setHi(hi); }
        K.ui.setOver(d.score, hi); K.ui.show('ovOver'); break;
      case 'win':
        K.audio.sfx('win'); K.audio.stopMusic(); running = false;
        if (d.score > hi) { hi = d.score; put(LS.hi, hi); game.setHi(hi); }
        K.ui.setWin(d.score, hi); K.ui.show('ovWin'); break;
    }
  }

  function startGame() {
    K.ui.hideAll(); K.audio.unlock();
    game = K.Game({ hi: hi, onEvent: onEvent });
    game.start(); running = true;
    if (sound) K.audio.startMusic();
  }

  function loop(ts) {
    if (!last) last = ts;
    var dt = Math.min((ts - last) / 1000, 0.05); last = ts;
    try {
      if (running && !game.isPaused()) game.update(dt);
      render();
    } catch (err) { if (global.console) console.error('KOLOBOK loop', err); }
    requestAnimationFrame(loop);
  }

  function render() {
    if (!game) return;
    var st = game.state();
    (gfx === 'modern' ? K.modern : K.classic).draw(ctx, st);
  }

  function togglePause() {
    if (!running) return;
    game.pause();
    if (game.isPaused()) { K.audio.stopMusic(); K.ui.show('ovPause'); }
    else { K.ui.hideAll(); if (sound) K.audio.startMusic(); }
  }

  function updateButtons() {
    var g = document.getElementById('valGfx'); if (g) g.textContent = K.t(gfx === 'modern' ? 'modern' : 'retro');
    var s = document.getElementById('valSnd'); if (s) s.textContent = K.t(sound ? 'on' : 'off');
    var l = document.getElementById('valLang'); if (l) l.textContent = lang.toUpperCase();
    document.documentElement.setAttribute('data-gfx', gfx);
  }
  function toggleGfx() { gfx = gfx === 'modern' ? 'retro' : 'modern'; put(LS.gfx, gfx); updateButtons(); }
  function toggleSound() {
    sound = !sound; put(LS.snd, sound ? '1' : '0'); K.audio.setSound(sound);
    if (sound && running && !game.isPaused()) K.audio.startMusic(); else K.audio.stopMusic();
    updateButtons();
  }
  function toggleLang() { lang = lang === 'ru' ? 'en' : 'ru'; put(LS.lang, lang); K.i18n.lang = lang; K.ui.applyI18n(); updateButtons(); }

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
        case 'KeyE': case 'ArrowDown': case 'KeyS': if (!e.repeat) game.use(); e.preventDefault(); break;
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
    function hold(id, name) {
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
    tap('tUse', function () { game.use(); });
  }

  // Отладочный хук для тестов.
  function exposeDebug() {
    global.__KOLOBOK = {
      startGame: startGame,
      setGfx: function (g) { gfx = (g === 'modern') ? 'modern' : 'retro'; updateButtons(); },
      setLang: function (l) { lang = (l === 'en') ? 'en' : 'ru'; K.i18n.lang = lang; K.ui.applyI18n(); updateButtons(); },
      tick: function (dt) { if (running && !game.isPaused()) game.update(dt || 0.016); render(); },
      game: function () { return game; }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
