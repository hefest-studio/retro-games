/* ХРУМ · boot, цикл, ввод, настройки. Владелец: Lead. */
(function (global) {
  'use strict';
  var PM = global.PM;
  var LS = { theme: 'pm-theme', lang: 'pm-lang', snd: 'pm-snd', hi: 'pm-hi' };
  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var G = { W: 960, H: 600 };
  var theme = get(LS.theme, 'classic'), lang = get(LS.lang, 'ru');
  var sound = get(LS.snd, '1') === '1', hi = parseInt(get(LS.hi, '0'), 10) || 0;
  var canvas, ctx, game, last = 0, started = false;

  function boot() {
    canvas = document.getElementById('game'); ctx = canvas.getContext('2d');
    PM.i18n.lang = lang; PM.audio.setSound(sound);
    game = PM.Game({ hi: hi, onEvent: onEvent });
    PM.ui.applyI18n(); updateButtons(); PM.ui.show('ovTitle');
    bindUI(); bindKeys(); requestAnimationFrame(loop);
  }

  function onEvent(type, d) {
    switch (type) {
      case 'chomp': PM.audio.sfx('chomp'); break;
      case 'power': PM.audio.sfx('power'); break;
      case 'eatghost': PM.audio.sfx('eatghost'); break;
      case 'death': PM.audio.sfx('death'); break;
      case 'win': PM.audio.sfx('win'); break;
      case 'gameover':
        PM.audio.sfx('over'); PM.audio.stopMusic(); started = false;
        if (d.score > hi) { hi = d.score; put(LS.hi, hi); }
        PM.ui.setOver(d.score, Math.max(hi, d.score)); PM.ui.show('ovOver'); break;
    }
  }

  function startGame() {
    PM.ui.hideAll(); PM.audio.unlock();
    game = PM.Game({ hi: hi, onEvent: onEvent }); game.start(); started = true;
    if (sound) PM.audio.startMusic();
  }

  function loop(ts) {
    if (!last) last = ts; var dt = Math.min((ts - last) / 1000, 0.1); last = ts;
    if (started) game.step(dt);
    render(); requestAnimationFrame(loop);
  }
  function render() { (theme === 'modern' ? PM.modern : PM.classic).draw(ctx, game.state(), G); }

  function togglePause() {
    if (!started) return; game.pause();
    if (game.isPaused()) { PM.audio.stopMusic(); PM.ui.show('ovPause'); }
    else { PM.ui.hideAll(); if (sound) PM.audio.startMusic(); }
  }
  function updateButtons() {
    var g = document.getElementById('valGfx'); if (g) g.textContent = PM.t(theme === 'modern' ? 'modern' : 'retro');
    var s = document.getElementById('valSnd'); if (s) s.textContent = PM.t(sound ? 'on' : 'off');
    var l = document.getElementById('valLang'); if (l) l.textContent = lang.toUpperCase();
    document.documentElement.setAttribute('data-ptheme', theme);
  }
  function toggleTheme() { theme = theme === 'modern' ? 'classic' : 'modern'; put(LS.theme, theme); updateButtons(); }
  function toggleSound() { sound = !sound; put(LS.snd, sound ? '1' : '0'); PM.audio.setSound(sound); if (sound && started && !game.isPaused()) PM.audio.startMusic(); else PM.audio.stopMusic(); updateButtons(); }
  function toggleLang() { lang = lang === 'ru' ? 'en' : 'ru'; put(LS.lang, lang); PM.i18n.lang = lang; PM.ui.applyI18n(); updateButtons(); }

  function bindUI() {
    var on = function (id, fn) { var e = document.getElementById(id); if (e) e.onclick = fn; };
    on('btnStart', startGame); on('btnAgain', startGame); on('btnResume', togglePause);
    on('btnGfx', toggleTheme); on('btnSnd', toggleSound); on('btnLang', toggleLang); on('btnPause', togglePause);
    on('btnHow', function () { var h = document.getElementById('helpBox'); if (h) h.style.display = h.style.display === 'none' ? 'block' : 'none'; });
  }
  function bindKeys() {
    document.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'Enter') { if (!started) startGame(); return; }
      if (k === 'g' || k === 'G' || k === 'п') { toggleTheme(); return; }
      if (k === 'm' || k === 'M' || k === 'ь') { toggleSound(); return; }
      if (k === 'l' || k === 'L' || k === 'д') { toggleLang(); return; }
      if (k === 'p' || k === 'P' || k === 'з') { togglePause(); e.preventDefault(); return; }
      if (!started || game.isPaused()) return;
      var map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
        'ц': 'up', 'ы': 'down', 'ф': 'left', 'в': 'right' };
      if (map[k]) { game.setDir(map[k]); e.preventDefault(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
