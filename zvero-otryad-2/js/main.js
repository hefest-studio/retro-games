/* ЗВЕРО-ОТРЯД · boot, цикл requestAnimationFrame, ввод 1–2 игроков, настройки, экраны. */
(function (global) {
  'use strict';
  var Z = global.ZVERO2;
  if (!Z) return;

  var LS = { gfx: 'zo2-gfx', lang: 'zo2-lang', snd: 'zo2-snd', hi: 'zo2-hi', two: 'zo2-2p' };
  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var gfx = 'retro';                       // графика при загрузке всегда ретро
  var lang = get(LS.lang, 'ru');
  var sound = get(LS.snd, '1') === '1';
  var hi = parseInt(get(LS.hi, '0'), 10) || 0;
  var twoP = get(LS.two, '0') === '1';

  var canvas, ctx, game, last = 0, running = false;

  function boot() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    Z.i18n.lang = lang; Z.audio.setSound(sound);
    game = Z.Game({ hi: hi, twoP: twoP, onEvent: onEvent });
    Z.ui.applyI18n(); updateButtons(); Z.ui.show('ovTitle');
    bindUI(); bindKeys(); bindTouch(); exposeDebug();
    requestAnimationFrame(loop);
  }

  function onEvent(type, d) {
    switch (type) {
      case 'jump': Z.audio.sfx('jump'); break;
      case 'grab': Z.audio.sfx('grab'); break;
      case 'throw': Z.audio.sfx('throw'); break;
      case 'smash': Z.audio.sfx('smash'); break;
      case 'pickup': Z.audio.sfx('pickup'); break;
      case 'bosshit': Z.audio.sfx('bosshit'); break;
      case 'door': Z.audio.sfx('door'); break;
      case 'hurt': Z.audio.sfx('hurt'); break;
      case 'gameover':
        Z.audio.sfx('gameover'); Z.audio.stopMusic(); running = false;
        if (d.score > hi) { hi = d.score; put(LS.hi, hi); game.setHi(hi); }
        Z.ui.setOver(d.score, hi); Z.ui.show('ovOver'); break;
      case 'win':
        Z.audio.sfx('win'); Z.audio.stopMusic(); running = false;
        if (d.score > hi) { hi = d.score; put(LS.hi, hi); game.setHi(hi); }
        Z.ui.setWin(d.score, hi); Z.ui.show('ovWin'); break;
    }
  }

  function startGame() {
    Z.ui.hideAll(); Z.audio.unlock();
    game = Z.Game({ hi: hi, twoP: twoP, onEvent: onEvent });
    game.start(); running = true;
    if (sound) Z.audio.startMusic();
  }

  function loop(ts) {
    if (!last) last = ts;
    var dt = Math.min((ts - last) / 1000, 0.05); last = ts;
    try {
      if (running && !game.isPaused()) game.update(dt);
      render();
    } catch (err) { if (global.console) console.error('ZVERO2 loop', err); }
    requestAnimationFrame(loop);
  }
  function render() {
    if (!game) return;
    var st = game.state();
    (gfx === 'modern' ? Z.modern : Z.classic).draw(ctx, st);
  }

  function togglePause() {
    if (!running) return;
    game.pause();
    if (game.isPaused()) { Z.audio.stopMusic(); Z.ui.show('ovPause'); }
    else { Z.ui.hideAll(); if (sound) Z.audio.startMusic(); }
  }

  function updateButtons() {
    var g = document.getElementById('valGfx'); if (g) g.textContent = Z.t(gfx === 'modern' ? 'modern' : 'retro');
    var s = document.getElementById('valSnd'); if (s) s.textContent = Z.t(sound ? 'on' : 'off');
    var l = document.getElementById('valLang'); if (l) l.textContent = lang.toUpperCase();
    var m = document.getElementById('valMode'); if (m) m.textContent = Z.t(twoP ? 'twop' : 'onep');
    document.documentElement.setAttribute('data-gfx', gfx);
  }
  function toggleGfx() { gfx = gfx === 'modern' ? 'retro' : 'modern'; put(LS.gfx, gfx); updateButtons(); }
  function toggleSound() {
    sound = !sound; put(LS.snd, sound ? '1' : '0'); Z.audio.setSound(sound);
    if (sound && running && !game.isPaused()) Z.audio.startMusic(); else Z.audio.stopMusic();
    updateButtons();
  }
  function toggleLang() { lang = lang === 'ru' ? 'en' : 'ru'; put(LS.lang, lang); Z.i18n.lang = lang; Z.ui.applyI18n(); updateButtons(); }
  function setMode(on) { twoP = !!on; put(LS.two, twoP ? '1' : '0'); if (game) game.setTwoP(twoP); updateButtons(); }
  function toggleMode() { setMode(!twoP); }

  function bindUI() {
    var on = function (id, fn) { var e = document.getElementById(id); if (e) e.onclick = fn; };
    on('btnStart', startGame); on('btnAgain', startGame); on('btnWinAgain', startGame); on('btnResume', togglePause);
    on('btnGfx', toggleGfx); on('btnSnd', toggleSound); on('btnLang', toggleLang); on('btnMode', toggleMode); on('btnPause', togglePause);
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
      if (c === 'KeyC') { toggleMode(); return; }
      if (c === 'Digit1' || c === 'Numpad1') { setMode(false); return; }
      if (c === 'Digit2' || c === 'Numpad2') { setMode(true); return; }
      if (c === 'KeyP') { togglePause(); e.preventDefault(); return; }
      if (!running || game.isPaused()) return;
      switch (c) {
        // Игрок 1
        case 'ArrowLeft': game.setHeld(0, 'left', true); e.preventDefault(); break;
        case 'ArrowRight': game.setHeld(0, 'right', true); e.preventDefault(); break;
        case 'ArrowUp': if (!e.repeat) game.jump(0); e.preventDefault(); break;
        case 'Space': if (!e.repeat) game.action(0); e.preventDefault(); break;
        // Игрок 2
        case 'KeyA': game.setHeld(1, 'left', true); e.preventDefault(); break;
        case 'KeyD': game.setHeld(1, 'right', true); e.preventDefault(); break;
        case 'KeyW': if (!e.repeat) game.jump(1); e.preventDefault(); break;
        case 'ShiftLeft': case 'ShiftRight': if (!e.repeat) game.action(1); e.preventDefault(); break;
      }
    });
    document.addEventListener('keyup', function (e) {
      if (!running) return;
      var c = e.code;
      if (c === 'ArrowLeft') game.setHeld(0, 'left', false);
      else if (c === 'ArrowRight') game.setHeld(0, 'right', false);
      else if (c === 'KeyA') game.setHeld(1, 'left', false);
      else if (c === 'KeyD') game.setHeld(1, 'right', false);
    });
  }

  // Экранные кнопки для телефона (игрок 1).
  function bindTouch() {
    function hold(id, name) {
      var el = document.getElementById(id); if (!el) return;
      var set = function (v) { return function (ev) { ev.preventDefault(); if (running && !game.isPaused()) game.setHeld(0, name, v); }; };
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
    tap('tJump', function () { game.jump(0); });
    tap('tGrab', function () { game.action(0); });
  }

  function exposeDebug() {
    global.__ZVERO2 = {
      startGame: startGame,
      setGfx: function (g) { gfx = (g === 'modern') ? 'modern' : 'retro'; updateButtons(); },
      setLang: function (l) { lang = (l === 'en') ? 'en' : 'ru'; Z.i18n.lang = lang; Z.ui.applyI18n(); updateButtons(); },
      setTwoP: function (v) { setMode(v); },
      tick: function (dt) { if (running && !game.isPaused()) game.update(dt || 0.016); render(); },
      game: function () { return game; }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
