/* РОЙ · звук: оригинальные SFX на WebAudio через g.audio.beep (без файлов).
   ROY.sfx(g, type, data) — вызывается на события движка игры. */
(function (global) {
  'use strict';
  var R = global.ROY = global.ROY || {};

  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) {
      setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap);
    });
  }

  R.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'shoot': g.audio.beep(1320, 0.05, 'square', 0.035); break;
      case 'eshoot': g.audio.beep(520, 0.05, 'triangle', 0.04); break;
      case 'hurt': g.audio.beep(760, 0.06, 'square', 0.06); break;
      case 'kill':
        if (d.kind === 'medusa') seq(g, [420, 300, 210], 45, 0.08, 'sawtooth', 0.07);
        else g.audio.beep(d.kind === 'wedge' ? 260 : 330, 0.1, 'sawtooth', 0.06);
        break;
      case 'dive': seq(g, [980, 840, 720, 610], 35, 0.04, 'square', 0.025); break;
      case 'beam': for (var i = 0; i < 12; i++) (function (k) { setTimeout(function () { g.audio.beep(k % 2 ? 470 : 350, 0.13, 'triangle', 0.045); }, k * 120); })(i); break;
      case 'captured': seq(g, [700, 590, 500, 420, 350], 110, 0.12, 'triangle', 0.07); break;
      case 'release': seq(g, [500, 640], 60, 0.08, 'square', 0.05); break;
      case 'rescue': seq(g, [523, 659, 784, 1046], 70, 0.1, 'square', 0.06); break;
      case 'lost': seq(g, [300, 220], 90, 0.14, 'sawtooth', 0.05); break;
      case 'hull': g.audio.beep(220, 0.18, 'sawtooth', 0.07); break;
      case 'die': seq(g, [260, 190, 140, 100, 70], 70, 0.12, 'sawtooth', 0.08); break;
      case 'respawn': g.audio.beep(880, 0.08, 'triangle', 0.06); break;
      // короткий оригинальный «позывной» волны (не копия известных мелодий)
      case 'wave': seq(g, [392, 466, 587, 698, 587, 784], 85, 0.1, 'square', 0.05); break;
      case 'clear': seq(g, [659, 784, 988, 1175], 80, 0.11, 'triangle', 0.06); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
