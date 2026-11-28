/* ЧЕРТОГ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов). CHERTOG.sfx(g, type, data) — из main.js на события хода. */
(function (global) {
  'use strict';
  var C = global.CHERTOG = global.CHERTOG || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  C.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    switch (type) {
      case 'walk': g.audio.beep(330, 0.03, 'triangle', 0.025); break;
      case 'step': seq(g, [330, 440], 30, 0.04, 'triangle', 0.03); break;
      case 'jump': seq(g, [392, 587], 30, 0.05, 'triangle', 0.035); break;
      case 'land': g.audio.beep(140, 0.05, 'square', 0.025); break;
      case 'turn': g.audio.beep(260, 0.02, 'triangle', 0.02); break;
      case 'wait': g.audio.beep(200, 0.03, 'sine', 0.02); break;
      case 'lever': seq(g, [196, 147, 523, 784], 40, 0.06, 'square', 0.04); break;
      case 'undo': seq(g, [494, 392], 35, 0.04, 'triangle', 0.03); break;
      case 'die': seq(g, [330, 262, 196, 147], 80, 0.1, 'sawtooth', 0.05); break;
      case 'clear': seq(g, [523, 659, 784, 1046, 1318], 80, 0.1, 'triangle', 0.05); break;
      case 'win': seq(g, [523, 659, 784, 1046, 1318, 1568, 2093], 120, 0.14, 'triangle', 0.06); break;
      case 'hint': seq(g, [880, 1175], 60, 0.06, 'triangle', 0.04); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
