/* МУРАВЕЙНИК · звуки событий игры на WebAudio движка (g.audio.beep). MURAV.sfx(g, type, data). */
(function (global) {
  'use strict';
  var MU = global.MURAV = global.MURAV || {};
  function seq(g, notes, gap) { notes.forEach(function (n, i) { setTimeout(function () { g.audio.beep(n[0], n[1], n[2] || 'square', n[3]); }, i * (gap || n[4] || 70)); }); }
  MU.sfx = function (g, type, d) {
    var A = g.audio; if (!A || !A.beep) return;
    switch (type) {
      case 'dig': A.beep(110 + (d.y || 0) * 9, 0.07, 'sawtooth', 0.045); break;
      case 'step': A.beep(300, 0.025, 'triangle', 0.02); break;
      case 'flip': A.beep(420, 0.06, 'triangle', 0.05); break;
      case 'pick': A.beep(520 + (d.load || 1) * 80, 0.08, 'square', 0.06); break;
      case 'deliver': A.beep(600 + Math.min(d.n || 1, 6) * 90, 0.1, 'triangle', 0.08); break;
      case 'hatch': seq(g, [[660, 0.06, 'triangle', 0.07], [990, 0.08, 'triangle', 0.07]], 70); break;
      case 'collapse': A.beep(90, 0.3, 'sawtooth', 0.1); A.beep(60, 0.4, 'square', 0.07); break;
      case 'entomb': seq(g, [[400, 0.08, 'square', 0.07], [250, 0.12, 'square', 0.07]], 80); break;
      case 'nogo': A.beep(90, 0.05, 'square', 0.03); break;
      case 'bite': A.beep(200, 0.1, 'sawtooth', 0.08); break;
      case 'hurt': seq(g, [[300, 0.12, 'sawtooth', 0.09], [200, 0.14, 'sawtooth', 0.09], [120, 0.3, 'sawtooth', 0.09]], 90); break;
      case 'life': seq(g, [[660, 0.07, 'triangle', 0.08], [880, 0.1, 'triangle', 0.08]], 80); break;
      case 'clear': seq(g, [[523, 0.1, 'triangle', 0.1], [659, 0.1, 'triangle', 0.1], [784, 0.1, 'triangle', 0.1], [1047, 0.3, 'triangle', 0.1]], 110); break;
      case 'victory': seq(g, [[523, 0.1, 'triangle', 0.1], [659, 0.1, 'triangle', 0.1], [784, 0.1, 'triangle', 0.1], [1047, 0.12, 'triangle', 0.1], [1319, 0.4, 'triangle', 0.1]], 120); break;
      case 'gameover': seq(g, [[330, 0.16, 'sawtooth', 0.08], [262, 0.16, 'sawtooth', 0.08], [196, 0.4, 'sawtooth', 0.08]], 150); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
