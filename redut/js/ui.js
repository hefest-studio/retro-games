/* РЕДУТ · DOM-оверлеи (заголовок, пауза, game over, победа). R.ui */
(function (global) {
  'use strict';
  var R = global.REDUT = global.REDUT || {};
  function $(id) { return document.getElementById(id); }

  R.ui = {
    show: function (name) {
      ['ovTitle', 'ovPause', 'ovOver', 'ovWin'].forEach(function (n) {
        var e = $(n); if (e) e.style.display = (n === name) ? 'flex' : 'none';
      });
    },
    hideAll: function () { this.show(''); },
    applyI18n: function () {
      var t = R.t, set = function (id, s) { var e = $(id); if (e) e.textContent = s; };
      set('tSub', t('sub')); set('tTagline', t('tagline'));
      set('btnStart', t('start')); set('btnHow', t('how'));
      set('tPause', t('pause')); set('btnResume', t('resume'));
      set('tOver', t('over')); set('btnAgain', t('again'));
      set('tWin', t('win')); set('tWinSub', t('winSub')); set('btnWinAgain', t('again'));
      set('lblGfx', t('gfx')); set('lblSnd', t('snd')); set('lblPlayers', t('players'));
      set('backLink', '← ' + t('back'));
      var h = $('helpList'); if (h) h.innerHTML = t('help').map(function (s) { return '<li>' + s + '</li>'; }).join('');
    },
    setMode: function (n) { var e = $('btnMode'); if (e) e.textContent = R.t(n === 2 ? 'mode2' : 'mode1'); },
    setOver: function (score, hi) { var a = $('overScore'); if (a) a.textContent = score; var b = $('overBest'); if (b) b.textContent = hi; },
    setWin: function (score, hi) { var a = $('winScore'); if (a) a.textContent = score; var b = $('winBest'); if (b) b.textContent = hi; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
