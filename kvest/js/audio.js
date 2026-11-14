/* МАЯЧНИЦА · звук: короткие оригинальные эффекты поверх g.audio.beep движка (WebAudio, без файлов).
   KVEST.sfx(g, name, data) — вызывается из main.js на события движка квеста. Ноты колокольчиков и птиц — одни и те же
   (пентатоника), чтобы мелодию с площади можно было услышать и повторить в маяке. */
(function (global) {
  'use strict';
  var K = global.KVEST = global.KVEST || {};
  var NOTES = [392, 440, 523, 587, 659];   // соль, ля, до, ре, ми — от низкой к высокой
  K.NOTES = NOTES;
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function rare(name, ms) { var n = Date.now(); if (n - (last[name] || 0) < ms) return false; last[name] = n; return true; }
  K.sfx = function (g, name, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (name) {
      case 'take': seq(g, [660, 880], 60, 0.07, 'triangle', 0.05); break;
      case 'select': g.audio.beep(740, 0.04, 'triangle', 0.035); break;
      case 'push': seq(g, [120, 110, 100], 70, 0.08, 'sawtooth', 0.03); break;
      case 'click': seq(g, [330, 494], 40, 0.04, 'square', 0.035); break;
      case 'clank': seq(g, [196, 147], 50, 0.07, 'square', 0.04); break;
      case 'open': seq(g, [392, 523, 659], 80, 0.09, 'triangle', 0.05); break;
      case 'unlock': seq(g, [880, 660, 988], 60, 0.06, 'square', 0.04); break;
      case 'ok': seq(g, [523, 659, 784], 70, 0.08, 'triangle', 0.05); break;
      case 'nope': if (rare('nope', 200)) seq(g, [220, 185], 70, 0.07, 'triangle', 0.04); break;
      case 'look': if (rare('look', 250)) g.audio.beep(587, 0.05, 'sine', 0.03); break;
      case 'step': g.audio.beep(160, 0.05, 'triangle', 0.03); break;
      case 'wood': seq(g, [180, 140, 200], 60, 0.06, 'square', 0.035); break;
      case 'fire': seq(g, [300, 450, 600, 900], 50, 0.07, 'sawtooth', 0.025); break;
      case 'water': case 'splash': seq(g, [900, 700, 520, 400], 40, 0.06, 'sine', 0.04); break;
      case 'oil': seq(g, [220, 247, 262, 294], 90, 0.1, 'sine', 0.045); break;
      case 'glass': seq(g, [1568, 2093, 2637], 50, 0.08, 'sine', 0.035); break;
      case 'stone': seq(g, [98, 110, 131], 90, 0.12, 'sawtooth', 0.04); break;
      case 'bridge': seq(g, [130, 147, 165, 196, 262], 110, 0.12, 'triangle', 0.05); break;
      case 'goat': seq(g, [330, 311, 330, 294], 70, 0.07, 'sawtooth', 0.025); break;
      case 'cat': seq(g, [700, 900, 760], 80, 0.08, 'triangle', 0.03); break;
      case 'gull': seq(g, [1200, 900, 1300], 70, 0.07, 'square', 0.025); break;
      case 'light': seq(g, [523, 784, 1047], 120, 0.18, 'sine', 0.05); break;
      case 'hint': seq(g, [988, 1319], 70, 0.08, 'sine', 0.04); break;
      case 'page': g.audio.beep(520, 0.04, 'triangle', 0.03); break;
      case 'chime': g.audio.beep(NOTES[d.note] || 523, 0.6, 'sine', 0.07); break;
      case 'birds': [2, 4, 1, 3, 0].forEach(function (n, i) { setTimeout(function () { g.audio.beep(NOTES[n] * 2, 0.16, 'sine', 0.05); setTimeout(function () { g.audio.beep(NOTES[n] * 2, 0.1, 'sine', 0.04); }, 90); }, i * 320); }); break;
      case 'melody': [2, 4, 1, 3, 0].forEach(function (n, i) { setTimeout(function () { g.audio.beep(NOTES[n], 0.5, 'sine', 0.06); }, i * 300); }); break;
      case 'puzzle': seq(g, [659, 784, 988], 90, 0.1, 'triangle', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
