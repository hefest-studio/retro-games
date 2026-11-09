/* РЕДУТ · boot, цикл requestAnimationFrame, ввод (1–2 игрока), настройки, экраны. */
(function (global) {
  'use strict';
  var R = global.REDUT;
  if (!R) return;

  var LS = { gfx: 'redut-gfx', lang: 'redut-lang', snd: 'redut-snd', hi: 'redut-hi', players: 'redut-players' };
  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // Настройки. По требованию контракта графика при старте всегда ретро.
  var gfx = 'retro';
  var lang = get(LS.lang, 'ru');
  var sound = get(LS.snd, '1') === '1';
  var players = parseInt(get(LS.players, '1'), 10) === 2 ? 2 : 1;
  var hi = parseInt(get(LS.hi, '0'), 10) || 0;

  var canvas, ctx, game, last = 0, running = false;

  function boot() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    R.i18n.lang = lang; R.audio.setSound(sound);
    game = R.Game({ hi: hi, players: players, onEvent: onEvent });
    R.ui.applyI18n(); R.ui.setMode(players); updateButtons(); R.ui.show('ovTitle');
    bindUI(); bindKeys(); bindTouch();
    exposeDebug();
    requestAnimationFrame(loop);
  }

  function onEvent(type, d) {
    switch (type) {
      case 'shoot': R.audio.sfx('shoot'); break;
      case 'brick': R.audio.sfx('brick'); break;
      case 'steel': R.audio.sfx('steel'); break;
      case 'explode': R.audio.sfx('explode'); break;
      case 'hit': R.audio.sfx('hit'); break;
      case 'pickup': R.audio.sfx('pickup'); break;
      case 'life': R.audio.sfx('life'); break;
      case 'freeze': R.audio.sfx('freeze'); break;
      case 'spawn': R.audio.sfx('spawn'); break;
      case 'gameover':
        R.audio.sfx('gameover'); R.audio.stopMusic(); running = false;
        if (d.score > hi) { hi = d.score; put(LS.hi, hi); game.setHi(hi); }
        R.ui.setOver(d.score, hi); R.ui.show('ovOver'); break;
      case 'win':
        R.audio.sfx('win'); R.audio.stopMusic(); running = false;
        if (d.score > hi) { hi = d.score; put(LS.hi, hi); game.setHi(hi); }
        R.ui.setWin(d.score, hi); R.ui.show('ovWin'); break;
    }
  }

  function startGame() {
    R.ui.hideAll(); R.audio.unlock();
    game = R.Game({ hi: hi, players: players, onEvent: onEvent });
    game.start(); running = true;
    if (sound) R.audio.startMusic();
  }

  function loop(ts) {
    if (!last) last = ts;
    var dt = Math.min((ts - last) / 1000, 0.05); last = ts;
    try {
      if (running && !game.isPaused()) game.update(dt);
      render();
    } catch (err) { if (global.console) console.error('REDUT loop', err); }
    requestAnimationFrame(loop);
  }

  function render() {
    try {
      var st = game.state();
      (gfx === 'modern' ? R.modern : R.classic).draw(ctx, st);
    } catch (err) { if (global.console) console.error('REDUT render', err); }
  }

  function togglePause() {
    if (!running) return;
    game.pause();
    if (game.isPaused()) { R.audio.stopMusic(); R.ui.show('ovPause'); }
    else { R.ui.hideAll(); if (sound) R.audio.startMusic(); }
  }

  function updateButtons() {
    var g = document.getElementById('valGfx'); if (g) g.textContent = R.t(gfx === 'modern' ? 'modern' : 'retro');
    var s = document.getElementById('valSnd'); if (s) s.textContent = R.t(sound ? 'on' : 'off');
    var l = document.getElementById('valLang'); if (l) l.textContent = lang.toUpperCase();
    var pv = document.getElementById('valPlayers'); if (pv) pv.textContent = String(players);
    document.documentElement.setAttribute('data-gfx', gfx);
  }
  function toggleGfx() { gfx = gfx === 'modern' ? 'retro' : 'modern'; put(LS.gfx, gfx); updateButtons(); }
  function toggleSound() {
    sound = !sound; put(LS.snd, sound ? '1' : '0'); R.audio.setSound(sound);
    if (sound && running && !game.isPaused()) R.audio.startMusic(); else R.audio.stopMusic();
    updateButtons();
  }
  function toggleLang() { lang = lang === 'ru' ? 'en' : 'ru'; put(LS.lang, lang); R.i18n.lang = lang; R.ui.applyI18n(); R.ui.setMode(players); updateButtons(); }
  function togglePlayers() {
    if (running) return; // менять число игроков только до старта
    players = players === 2 ? 1 : 2; put(LS.players, players);
    game.setPlayers(players); R.ui.setMode(players); updateButtons();
  }

  // Индекс игрока для стрелок/слэша: в одиночной игре — И1, в кооп — И2.
  function arrowPlayer() { return players === 2 ? 1 : 0; }

  function bindUI() {
    var on = function (id, fn) { var e = document.getElementById(id); if (e) e.onclick = fn; };
    on('btnStart', startGame); on('btnAgain', startGame); on('btnWinAgain', startGame); on('btnResume', togglePause);
    on('btnGfx', toggleGfx); on('btnSnd', toggleSound); on('btnLang', toggleLang); on('btnPlayers', togglePlayers);
    on('btnMode', togglePlayers); on('btnPause', togglePause);
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
      if (c === 'Digit2') { togglePlayers(); return; }
      if (c === 'KeyP') { togglePause(); e.preventDefault(); return; }
      if (!running || game.isPaused()) return;
      var ap = arrowPlayer();
      switch (c) {
        // Игрок 1 — WASD + Space
        case 'KeyW': game.setHeld(0, 'up', true); e.preventDefault(); break;
        case 'KeyS': game.setHeld(0, 'down', true); e.preventDefault(); break;
        case 'KeyA': game.setHeld(0, 'left', true); e.preventDefault(); break;
        case 'KeyD': game.setHeld(0, 'right', true); e.preventDefault(); break;
        case 'Space': game.fire(0); e.preventDefault(); break;
        // Стрелки — И2 (или И1 в одиночке) + Slash огонь
        case 'ArrowUp': game.setHeld(ap, 'up', true); e.preventDefault(); break;
        case 'ArrowDown': game.setHeld(ap, 'down', true); e.preventDefault(); break;
        case 'ArrowLeft': game.setHeld(ap, 'left', true); e.preventDefault(); break;
        case 'ArrowRight': game.setHeld(ap, 'right', true); e.preventDefault(); break;
        case 'Slash': case 'NumpadDivide': game.fire(ap); e.preventDefault(); break;
      }
    });
    document.addEventListener('keyup', function (e) {
      if (!running) return;
      var c = e.code, ap = arrowPlayer();
      switch (c) {
        case 'KeyW': game.setHeld(0, 'up', false); break;
        case 'KeyS': game.setHeld(0, 'down', false); break;
        case 'KeyA': game.setHeld(0, 'left', false); break;
        case 'KeyD': game.setHeld(0, 'right', false); break;
        case 'ArrowUp': game.setHeld(ap, 'up', false); break;
        case 'ArrowDown': game.setHeld(ap, 'down', false); break;
        case 'ArrowLeft': game.setHeld(ap, 'left', false); break;
        case 'ArrowRight': game.setHeld(ap, 'right', false); break;
      }
    });
  }

  // Экранные кнопки (телефон) — управляют Игроком 1.
  function bindTouch() {
    function hold(id, dir) {
      var el = document.getElementById(id); if (!el) return;
      var set = function (v) { return function (ev) { ev.preventDefault(); if (running && !game.isPaused()) game.setHeld(0, dir, v); }; };
      el.addEventListener('touchstart', set(true), { passive: false });
      el.addEventListener('touchend', set(false), { passive: false });
      el.addEventListener('mousedown', set(true)); el.addEventListener('mouseup', set(false)); el.addEventListener('mouseleave', set(false));
    }
    hold('tUp', 'up'); hold('tDown', 'down'); hold('tLeft', 'left'); hold('tRight', 'right');
    var f = document.getElementById('tFire');
    if (f) {
      var h = function (ev) { ev.preventDefault(); if (!running) { startGame(); return; } if (!game.isPaused()) game.fire(0); };
      f.addEventListener('touchstart', h, { passive: false }); f.addEventListener('mousedown', h);
    }
  }

  // Отладочный хук для тестов.
  function exposeDebug() {
    global.__REDUT = {
      startGame: startGame,
      setGfx: function (g) { gfx = (g === 'modern') ? 'modern' : 'retro'; updateButtons(); },
      setLang: function (l) { lang = (l === 'en') ? 'en' : 'ru'; R.i18n.lang = lang; R.ui.applyI18n(); updateButtons(); },
      setPlayers: function (n) { players = n === 2 ? 2 : 1; game.setPlayers(players); R.ui.setMode(players); updateButtons(); },
      tick: function (dt) { if (running && !game.isPaused()) game.update(dt || 0.016); render(); },
      game: function () { return game; }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
