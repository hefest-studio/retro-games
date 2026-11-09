/* PAC-MAN · DOM-оверлеи. PM.ui */
(function (global) {
  'use strict';
  var PM = global.PM = global.PM || {};
  function $(id) { return document.getElementById(id); }
  PM.ui = {
    show: function (name) { ['ovTitle', 'ovPause', 'ovOver'].forEach(function (n) { var e = $(n); if (e) e.style.display = (n === name) ? 'flex' : 'none'; }); },
    hideAll: function () { this.show(''); },
    applyI18n: function () {
      var t = PM.t, set = function (id, s) { var e = $(id); if (e) e.textContent = s; };
      set('tSub', t('sub')); set('tTagline', t('tagline')); set('btnStart', t('start')); set('btnHow', t('how'));
      set('btnResume', t('resume')); set('tPause', t('pause')); set('tOver', t('over')); set('btnAgain', t('again'));
      set('lblGfx', t('gfx')); set('lblSnd', t('snd')); set('backLink', '← ' + t('back'));
      var h = $('helpList'); if (h) h.innerHTML = t('help').map(function (s) { return '<li>' + s + '</li>'; }).join('');
    },
    setOver: function (score, hi) { var a = $('overScore'); if (a) a.textContent = score; var b = $('overBest'); if (b) b.textContent = hi; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
