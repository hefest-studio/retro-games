/* КАСКАД · boot, цикл, ввод, настройки. Владелец: Lead. */
(function (global) {
  'use strict';
  var TT = global.TT;
  var LS = { theme: 'tt-theme', lang: 'tt-lang', snd: 'tt-snd', hi: 'tt-hi' };
  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var W = 960, H = 600, CELL = 24;
  var G = { W: W, H: H, cell: CELL, cols: 10, rows: 20, ox: Math.round((W - 10 * CELL) / 2), oy: Math.round((H - 20 * CELL) / 2) };

  var theme = get(LS.theme, 'classic');       // classic | modern
  var lang = get(LS.lang, 'ru');
  var sound = get(LS.snd, '1') === '1';
  var hi = parseInt(get(LS.hi, '0'), 10) || 0;

  var canvas, ctx, game, last = 0, running = false;

  function boot() {
    canvas = document.getElementById('game'); ctx = canvas.getContext('2d');
    TT.i18n.lang = lang; TT.audio.setSound(sound);
    game = TT.Game({ hi: hi, onEvent: onEvent });
    TT.ui.applyI18n(); updateButtons(); TT.ui.show('ovTitle');
    bindUI(); bindKeys();
    requestAnimationFrame(loop);
  }

  function onEvent(type, d) {
    switch (type) {
      case 'move': TT.audio.sfx('move'); break;
      case 'rotate': TT.audio.sfx('rotate'); break;
      case 'lock': TT.audio.sfx('lock'); break;
      case 'harddrop': TT.audio.sfx('drop'); break;
      case 'hold': TT.audio.sfx('hold'); break;
      case 'levelup': TT.audio.sfx('level'); break;
      case 'clear': TT.audio.sfx(d.count >= 4 ? 'quad' : 'clear'); break;
      case 'gameover':
        TT.audio.sfx('over'); TT.audio.stopMusic(); running = false;
        if (d.score > hi) { hi = d.score; put(LS.hi, hi); }
        var _lt = document.getElementById('tOver'); if (_lt) _lt.textContent = 'ИГРА ОКОНЧЕНА · GAME OVER';
        TT.ui.setOver(d.score, hi); TT.ui.show('ovOver'); break;
      case 'win':
        TT.audio.sfx('quad'); TT.audio.stopMusic(); running = false;
        if (d.score > hi) { hi = d.score; put(LS.hi, hi); }
        var _wt = document.getElementById('tOver'); if (_wt) _wt.textContent = 'ПОБЕДА! · YOU WIN';
        TT.ui.setOver(d.score, hi); TT.ui.show('ovOver'); break;
    }
  }

  function startGame() {
    TT.ui.hideAll(); TT.audio.unlock();
    game = TT.Game({ hi: hi, onEvent: onEvent });
    game.start(); running = true; if (sound) TT.audio.startMusic();
  }

  function loop(ts) {
    if (!last) last = ts; var dt = Math.min((ts - last) / 1000, 0.1); last = ts;
    if (running && !game.isPaused()) game.step(dt);
    render();
    requestAnimationFrame(loop);
  }

  function render() {
    var st = game.state();
    (theme === 'modern' ? TT.modern : TT.classic).draw(ctx, st, G);
  }

  function togglePause() {
    if (!running) return;
    game.pause();
    if (game.isPaused()) { TT.audio.stopMusic(); TT.ui.show('ovPause'); }
    else { TT.ui.hideAll(); if (sound) TT.audio.startMusic(); }
  }

  function updateButtons() {
    var g = document.getElementById('valGfx'); if (g) g.textContent = TT.t(theme === 'modern' ? 'modern' : 'retro');
    var s = document.getElementById('valSnd'); if (s) s.textContent = TT.t(sound ? 'on' : 'off');
    var l = document.getElementById('valLang'); if (l) l.textContent = lang.toUpperCase();
    document.documentElement.setAttribute('data-ttheme', theme);
  }
  function toggleTheme() { theme = theme === 'modern' ? 'classic' : 'modern'; put(LS.theme, theme); updateButtons(); }
  function toggleSound() { sound = !sound; put(LS.snd, sound ? '1' : '0'); TT.audio.setSound(sound); if (sound && running && !game.isPaused()) TT.audio.startMusic(); else TT.audio.stopMusic(); updateButtons(); }
  function toggleLang() { lang = lang === 'ru' ? 'en' : 'ru'; put(LS.lang, lang); TT.i18n.lang = lang; TT.ui.applyI18n(); updateButtons(); }

  function bindUI() {
    var on = function (id, fn) { var e = document.getElementById(id); if (e) e.onclick = fn; };
    on('btnStart', startGame); on('btnAgain', startGame); on('btnResume', togglePause);
    on('btnGfx', toggleTheme); on('btnSnd', toggleSound); on('btnLang', toggleLang); on('btnPause', togglePause);
    on('btnHow', function () { var h = document.getElementById('helpBox'); if (h) h.style.display = h.style.display === 'none' ? 'block' : 'none'; });
  }

  function bindKeys() {
    document.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'Enter') { if (!running) startGame(); return; }
      if (k === 'g' || k === 'G' || k === 'п') { toggleTheme(); return; }
      if (k === 'm' || k === 'M' || k === 'ь') { toggleSound(); return; }
      if (k === 'l' || k === 'L' || k === 'д') { toggleLang(); return; }
      if (k === 'p' || k === 'P' || k === 'з') { togglePause(); e.preventDefault(); return; }
      if (!running || game.isPaused()) return;
      switch (k) {
        case 'ArrowLeft': game.left(); e.preventDefault(); break;
        case 'ArrowRight': game.right(); e.preventDefault(); break;
        case 'ArrowDown': game.softDrop(); e.preventDefault(); break;
        case 'ArrowUp': case 'x': case 'X': case 'ч': if (!e.repeat) game.rotateCW(); e.preventDefault(); break;
        case 'z': case 'Z': case 'я': if (!e.repeat) game.rotateCCW(); e.preventDefault(); break;
        case ' ': if (!e.repeat) game.hardDrop(); e.preventDefault(); break;
        case 'c': case 'C': case 'с': case 'Shift': if (!e.repeat) game.hold(); e.preventDefault(); break;
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
