/* ЧЕРТОГ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   CHERTOG.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var C = global.CHERTOG = global.CHERTOG || {};
  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  C.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': if (rare('jump', 90)) g.audio.beep(d.run ? 260 : 220, 0.07, 'triangle', 0.035); break;
      case 'land': if (rare('land', 90)) g.audio.beep(d.drop > 0.6 ? 90 : 120, 0.05, 'square', 0.03); break;
      case 'thud': seq(g, [110, 70], 50, 0.09, 'square', 0.05); break;
      case 'grab': g.audio.beep(330, 0.04, 'triangle', 0.03); break;
      case 'climb': seq(g, [196, 247], 120, 0.05, 'triangle', 0.025); break;
      case 'bump': if (rare('bump', 200)) g.audio.beep(80, 0.06, 'square', 0.04); break;
      case 'spikes': if (rare('spk', 150)) seq(g, [1568, 1175], 25, 0.04, 'square', 0.035); break;
      case 'chop': if (rare('chop', 300)) seq(g, [1760, 880], 30, 0.05, 'sawtooth', 0.03); break;
      case 'shake': g.audio.beep(140, 0.12, 'sawtooth', 0.025); break;
      case 'crumble': g.audio.beep(98, 0.08, 'sawtooth', 0.04); break;
      case 'smash': seq(g, [82, 62, 55], 40, 0.08, 'sawtooth', 0.05); break;
      case 'plate': seq(g, [392, 523], 50, 0.05, 'square', 0.04); break;
      case 'gateUp': seq(g, [147, 165, 175, 196], 70, 0.06, 'square', 0.03); break;
      case 'gateDown': seq(g, [196, 147, 110], 60, 0.07, 'square', 0.04); break;
      case 'slam': seq(g, [220, 110, 55], 35, 0.09, 'sawtooth', 0.06); break;
      case 'door': seq(g, [262, 330, 392, 523], 90, 0.1, 'triangle', 0.05); break;
      case 'drink': seq(g, [523, 659], 70, 0.06, 'triangle', 0.04); if (d.kind === 'H') setTimeout(function () { seq(g, [659, 784, 988, 1318], 80, 0.09, 'triangle', 0.05); }, 200); if (d.kind === 'p') setTimeout(function () { seq(g, [330, 277, 233], 90, 0.09, 'sawtooth', 0.05); }, 200); break;
      case 'engage': if (rare('eng', 600)) seq(g, [1318, 1568], 40, 0.05, 'square', 0.035); break;
      case 'lunge': if (rare('lng', 60)) g.audio.beep(d.hero ? 700 : 520, 0.05, 'sawtooth', 0.025); break;
      case 'clang': seq(g, [2093, 1568], 25, 0.06, 'square', 0.05); break;
      case 'hit': seq(g, [330, 220], 40, 0.07, 'sawtooth', 0.05); break;
      case 'hurt': seq(g, [392, 262, 196], 45, 0.07, 'sawtooth', 0.05); break;
      case 'kill': seq(g, [523, 392, 262, 196], 70, 0.09, 'square', 0.045); break;
      case 'die': seq(g, [440, 349, 294, 220, 175, 147], 110, 0.14, 'sawtooth', 0.06); break;
      case 'enter': seq(g, [392, 494, 587, 784], 100, 0.12, 'triangle', 0.05); break;
      case 'boss': seq(g, [196, 233, 277, 330, 415], 120, 0.14, 'sawtooth', 0.05); break;
      case 'twin': seq(g, [1661, 1245, 1661, 1245], 90, 0.08, 'square', 0.04); break;
      case 'twinDown': seq(g, [1760, 1319, 880, 659, 440, 330], 70, 0.1, 'square', 0.05); break;
      case 'free': seq(g, [523, 659, 784, 1046, 784, 1046, 1318, 1568], 120, 0.16, 'triangle', 0.06); break;
      case 'timeout': seq(g, [220, 208, 196, 185, 175], 220, 0.25, 'sawtooth', 0.05); break;
      case 'level': if (rare('lvl', 500)) seq(g, [330, 440, 494], 90, 0.08, 'triangle', 0.035); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
