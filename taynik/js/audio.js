/* ТАЙНИК · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   TAYNIK.sfx(g, type, data) — вызывается из main.js на события логики. */
(function (global) {
  'use strict';
  var K = global.TAYNIK = global.TAYNIK || {};
  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  K.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': g.audio.beep(420, 0.05, 'square', 0.035); setTimeout(function () { g.audio.beep(560, 0.04, 'square', 0.03); }, 35); break;
      case 'grab': g.audio.beep(300, 0.04, 'triangle', 0.04); break;
      case 'land': if (d.hard) seq(g, [140, 90], 50, 0.07, 'sawtooth', 0.05); break;
      case 'shot': g.audio.beep(900, 0.04, 'square', 0.035); setTimeout(function () { g.audio.beep(260, 0.05, 'triangle', 0.03); }, 30); break;
      case 'empty': g.audio.beep(160, 0.05, 'square', 0.03); break;
      case 'hit': g.audio.beep(520, 0.05, 'square', 0.04); break;
      case 'kill': seq(g, [660, 440, 880], 45, 0.06, 'square', 0.045); break;
      case 'treasure': seq(g, d.type === 'gem' ? [988, 1319, 1760] : [784, 1047], 55, 0.07, 'triangle', 0.05); break;
      case 'ammo': seq(g, [330, 440, 554], 50, 0.06, 'square', 0.04); break;
      case 'oil': seq(g, [523, 659, 784], 60, 0.08, 'triangle', 0.05); break;
      case 'map': seq(g, [587, 880, 740, 1175], 60, 0.07, 'triangle', 0.045); break;
      case 'lamp': seq(g, [392, 587, 784], 70, 0.09, 'triangle', 0.05); break;
      case 'reveal': seq(g, [220, 247, 220], 60, 0.07, 'sawtooth', 0.04); break;
      case 'hurt': seq(g, [240, 170], 55, 0.08, 'sawtooth', 0.055); break;
      case 'extra': seq(g, [523, 659, 784, 1046], 60, 0.08, 'triangle', 0.06); break;
      case 'die':
        if (d.reason === 'acid') seq(g, [600, 450, 330, 220, 150], 70, 0.1, 'triangle', 0.06);
        else seq(g, [330, 262, 196, 131], 90, 0.12, 'square', 0.055);
        break;
      case 'respawn': seq(g, [392, 523], 70, 0.07, 'triangle', 0.04); break;
      case 'clear': seq(g, [392, 523, 659, 784, 659, 1046], 80, 0.1, 'square', 0.05); break;
      case 'level': seq(g, [294, 392, 466], 80, 0.08, 'triangle', 0.045); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
