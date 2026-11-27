/* ШПУЛЬКА · звуки событий игры на WebAudio движка (g.audio.beep). SPOOL.sfx(g, type, data). */
(function (global) {
  'use strict';
  var SP = global.SPOOL = global.SPOOL || {};
  function seq(g, notes, step) { notes.forEach(function (n, i) { setTimeout(function () { g.audio.beep(n[0], n[1], n[2] || 'square', n[3]); }, i * (step || 70)); }); }
  SP.sfx = function (g, type, d) {
    var A = g.audio; if (!A || !A.beep) return;
    switch (type) {
      case 'hook': A.beep(d && d.rust ? 330 : 520, 0.06, 'triangle', 0.07); break;
      case 'release': A.beep(300, 0.05, 'sine', 0.04); break;
      case 'bump': A.beep(120, 0.05, 'square', 0.05); break;
      case 'button': A.beep(600 + Math.min((d && d.combo) || 1, 6) * 110, 0.08, 'square', 0.07); break;
      case 'snap': A.beep(180, 0.12, 'sawtooth', 0.07); break;
      case 'warn': A.beep(880, 0.07, 'square', 0.05); break;
      case 'dash': A.beep(140, 0.2, 'sawtooth', 0.06); break;
      case 'exitOpen': seq(g, [[660, 0.08, 'triangle', 0.09], [880, 0.08, 'triangle', 0.09], [1320, 0.14, 'triangle', 0.09]]); break;
      case 'shield': seq(g, [[700, 0.06, 'triangle', 0.08], [1000, 0.08, 'triangle', 0.08]]); break;
      case 'hurt': seq(g, [[300, 0.12, 'sawtooth', 0.09], [200, 0.14, 'sawtooth', 0.09], [120, 0.3, 'sawtooth', 0.09]], 90); break;
      case 'life': seq(g, [[660, 0.07, 'triangle', 0.08], [880, 0.1, 'triangle', 0.08]]); break;
      case 'clear': seq(g, [[523, 0.1, 'triangle', 0.1], [659, 0.1, 'triangle', 0.1], [784, 0.1, 'triangle', 0.1], [1047, 0.3, 'triangle', 0.1]], 110); break;
      case 'victory': seq(g, [[523, 0.1, 'triangle', 0.1], [659, 0.1, 'triangle', 0.1], [784, 0.1, 'triangle', 0.1], [1047, 0.12, 'triangle', 0.1], [1319, 0.4, 'triangle', 0.1]], 120); break;
      case 'gameover': seq(g, [[330, 0.16, 'sawtooth', 0.08], [262, 0.16, 'sawtooth', 0.08], [196, 0.4, 'sawtooth', 0.08]], 150); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
