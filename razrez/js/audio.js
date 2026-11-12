/* РАЗРЕЗ · звук. Оригинальные короткие SFX поверх g.audio.beep движка (WebAudio).
   RAZREZ.sfx(g, type, data) — вызывается из main.js по событиям логики. */
(function (global) {
  'use strict';
  var R = global.RAZREZ = global.RAZREZ || {};

  // Последовательность нот: [частота, длительность, форма, громкость, задержка мс]
  function seq(g, notes) {
    notes.forEach(function (n) {
      var play = function () { g.audio.beep(n[0], n[1], n[2], n[3]); };
      if (n[4]) setTimeout(play, n[4]); else play();
    });
  }

  R.sfx = function (g, type, d) {
    d = d || {};
    switch (type) {
      case 'step':      // тихое «шуршание» резца по полю — на каждой 3-й клетке
        if (d.n % 3 === 1) g.audio.beep(260 + (d.n % 12) * 8, 0.025, 'triangle', 0.025);
        break;
      case 'capture': { // чем больше отрезано, тем выше аккорд
        var k = Math.min(1, (d.count || 0) / 900), base = 420 + k * 380;
        seq(g, [[base, 0.07, 'square', 0.05], [base * 1.25, 0.07, 'square', 0.05, 60], [base * 1.5, 0.12, 'triangle', 0.06, 120]]);
        break;
      }
      case 'clear':
        seq(g, [[523, 0.1, 'square', 0.06], [659, 0.1, 'square', 0.06, 110], [784, 0.1, 'square', 0.06, 220], [1046, 0.25, 'triangle', 0.07, 330]]);
        break;
      case 'death':
        seq(g, [[330, 0.12, 'sawtooth', 0.07], [196, 0.14, 'sawtooth', 0.07, 110], [98, 0.3, 'sawtooth', 0.07, 230]]);
        break;
      case 'go':
        seq(g, [[660, 0.06, 'square', 0.05], [990, 0.09, 'square', 0.05, 70]]);
        break;
      case 'level':
        g.audio.beep(880, 0.08, 'triangle', 0.05);
        break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
