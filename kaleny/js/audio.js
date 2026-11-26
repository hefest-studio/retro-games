/* КАЛЁНЫЙ ДВОР · звуки событий игры на WebAudio движка (g.audio.beep). KALENY.sfx(g, type, data). */
(function (global) {
  'use strict';
  var KL = global.KALENY = global.KALENY || {};
  function seq(g, notes) { notes.forEach(function (n, i) { setTimeout(function () { g.audio.beep(n[0], n[1], n[2] || 'square', n[3]); }, i * (n[4] || 70)); }); }
  KL.sfx = function (g, type, d) {
    var A = g.audio; if (!A || !A.beep) return;
    switch (type) {
      case 'throw': A.beep(180 + (d.heat || 0) * 260, 0.09, 'sawtooth', 0.06); break;
      case 'pass': A.beep(420, 0.05, 'triangle', 0.05); break;
      case 'hit': A.beep(110, 0.16, 'square', 0.1); seq(g, [[70, 0.14, 'sawtooth', 0.08]]); break;
      case 'wound': A.beep(150, 0.1, 'square', 0.08); break;
      case 'catch': if (d.perfect) seq(g, [[520, 0.08, 'triangle', 0.1], [780, 0.08, 'triangle', 0.1], [1170, 0.16, 'triangle', 0.1]]); else A.beep(560, 0.09, 'triangle', 0.09); break;
      case 'stance': A.beep(340, 0.04, 'triangle', 0.04); break;
      case 'dash': A.beep(260, 0.07, 'triangle', 0.04); break;
      case 'dodge': A.beep(900, 0.05, 'triangle', 0.05); break;
      case 'wall': A.beep(200, 0.03, 'square', 0.04); break;
      case 'plate': A.beep(150, 0.05, 'square', 0.06); break;
      case 'steam': A.beep(1300, 0.12, 'sawtooth', 0.02); break;
      case 'burn': seq(g, [[900, 0.06, 'sawtooth', 0.08], [500, 0.1, 'sawtooth', 0.08]]); break;
      case 'revive': seq(g, [[392, 0.07, 'triangle', 0.08], [523, 0.1, 'triangle', 0.08]]); break;
      case 'pick': A.beep(300, 0.03, 'square', 0.03); break;
      case 'time': seq(g, [[440, 0.1, 'square', 0.08], [330, 0.2, 'square', 0.08]], 100); break;
      case 'tick': A.beep(d && d.last ? 880 : 660, 0.05, 'square', 0.05); break;
      case 'end': if (d.result === 'win') seq(g, [[523, 0.1, 'triangle', 0.1], [659, 0.1, 'triangle', 0.1], [784, 0.1, 'triangle', 0.1], [1047, 0.3, 'triangle', 0.1]], 110); else if (d.result === 'lose') seq(g, [[330, 0.16, 'sawtooth', 0.08], [262, 0.16, 'sawtooth', 0.08], [196, 0.4, 'sawtooth', 0.08]], 150); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
