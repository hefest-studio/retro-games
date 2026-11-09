/* ЗВЕРО-ОТРЯД · DOM-оверлеи (заголовок, пауза, game over, победа). Z.ui */
(function (global) {
  'use strict';
  var Z = global.ZVERO2 = global.ZVERO2 || {};
  function $(id) { return document.getElementById(id); }

  Z.ui = {
    show: function (name) {
      ['ovTitle', 'ovPause', 'ovOver', 'ovWin'].forEach(function (n) {
        var e = $(n); if (e) e.style.display = (n === name) ? 'flex' : 'none';
      });
    },
    hideAll: function () { this.show(''); },
    applyI18n: function () {
      var t = Z.t, set = function (id, s) { var e = $(id); if (e) e.textContent = s; };
      set('tSub', t('sub')); set('tTagline', t('tagline'));
      set('btnStart', t('start')); set('btnHow', t('how'));
      set('tPause', t('pause')); set('btnResume', t('resume'));
      set('tOver', t('over')); set('btnAgain', t('again'));
      set('tWin', t('win')); set('tWinSub', t('winSub')); set('btnWinAgain', t('again'));
      set('lblGfx', t('gfx')); set('lblSnd', t('snd')); set('lblMode', t('mode'));
      set('backLink', '← ' + t('back'));
      var h = $('helpList'); if (h) h.innerHTML = t('help').map(function (s) { return '<li>' + s + '</li>'; }).join('');
    },
    setOver: function (score, hi) { var a = $('overScore'); if (a) a.textContent = score; var b = $('overBest'); if (b) b.textContent = hi; },
    setWin: function (score, hi) { var a = $('winScore'); if (a) a.textContent = score; var b = $('winBest'); if (b) b.textContent = hi; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
