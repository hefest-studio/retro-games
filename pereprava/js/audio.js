/* ПЕРЕПРАВА · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   PEREPRAVA.sfx(g, type, data) — вызывается из main.js на события логики. */
(function (global) {
  'use strict';
  var K = global.PEREPRAVA = global.PEREPRAVA || {};

  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var hopTone = 0;

  K.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': hopTone = (hopTone + 1) % 2; g.audio.beep(hopTone ? 520 : 600, 0.045, 'square', 0.04); break;
      case 'row': g.audio.beep(880, 0.03, 'triangle', 0.025); break;
      case 'bay': seq(g, [523, 659, 784], 60, 0.08, 'square', 0.05); break;
      case 'prize': seq(g, [988, 1319, 1568], 50, 0.07, 'triangle', 0.055); break;
      case 'mate': seq(g, [659, 880, 1047, 1319], 55, 0.07, 'triangle', 0.05); break;
      case 'pickup': seq(g, [784, 1047], 60, 0.07, 'triangle', 0.05); break;
      case 'mateShow': case 'prizeShow': g.audio.beep(1175, 0.05, 'triangle', 0.03); break;
      case 'trap': seq(g, [220, 165], 70, 0.08, 'sawtooth', 0.045); break;
      case 'extra': seq(g, [523, 659, 784, 1046], 60, 0.08, 'triangle', 0.06); break;
      case 'die':
        if (d.reason === 'water' || d.reason === 'edge') seq(g, [440, 330, 220, 147], 60, 0.09, 'triangle', 0.06);
        else if (d.reason === 'time') seq(g, [330, 330, 196], 120, 0.1, 'square', 0.05);
        else seq(g, [180, 120, 90], 60, 0.1, 'sawtooth', 0.065);
        break;
      case 'respawn': g.audio.beep(660, 0.06, 'triangle', 0.04); break;
      case 'clear': seq(g, [523, 659, 784, 659, 784, 1046], 75, 0.1, 'square', 0.055); break;
      case 'level': seq(g, [392, 523, 659], 70, 0.08, 'triangle', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
