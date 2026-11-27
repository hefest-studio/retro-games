/* ПОДКОП · звуки событий игры на WebAudio движка (g.audio.beep). PODKOP.sfx(g, type, data). */
(function (global) {
  'use strict';
  var PK = global.PODKOP = global.PODKOP || {};
  function seq(g, notes, gap) { notes.forEach(function (n, i) { setTimeout(function () { g.audio.beep(n[0], n[1], n[2] || 'square', n[3]); }, i * (gap || 70)); }); }
  PK.sfx = function (g, type, d) {
    var A = g.audio; if (!A || !A.beep) return;
    switch (type) {
      case 'dig': A.beep(150 + (d.y || 0) * 4, 0.06, 'sawtooth', 0.05); break;
      case 'pour': A.beep(520 + (d.y || 0) * 6, 0.05, 'triangle', 0.05); break;
      case 'step': A.beep(260, 0.02, 'triangle', 0.02); break;
      case 'full': A.beep(110, 0.08, 'square', 0.04); break;
      case 'nogo': A.beep(90, 0.05, 'square', 0.03); break;
      case 'spout': A.beep(700, 0.02, 'triangle', 0.015); break;
      case 'bury': seq(g, [[300, 0.08, 'sawtooth', 0.08], [180, 0.14, 'sawtooth', 0.08]], 70); break;
      case 'hurt': seq(g, [[300, 0.12, 'sawtooth', 0.09], [200, 0.14, 'sawtooth', 0.09], [120, 0.3, 'sawtooth', 0.09]], 90); break;
      case 'life': seq(g, [[660, 0.07, 'triangle', 0.08], [880, 0.1, 'triangle', 0.08]], 80); break;
      case 'clear': seq(g, [[523, 0.1, 'triangle', 0.1], [659, 0.1, 'triangle', 0.1], [784, 0.1, 'triangle', 0.1], [1047, 0.3, 'triangle', 0.1]], 110); break;
      case 'victory': seq(g, [[523, 0.1, 'triangle', 0.1], [659, 0.1, 'triangle', 0.1], [784, 0.1, 'triangle', 0.1], [1047, 0.12, 'triangle', 0.1], [1319, 0.4, 'triangle', 0.1]], 120); break;
      case 'gameover': seq(g, [[330, 0.16, 'sawtooth', 0.08], [262, 0.16, 'sawtooth', 0.08], [196, 0.4, 'sawtooth', 0.08]], 150); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
