/* ПОСОХ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   POSOKH.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var PS = global.POSOKH = global.POSOKH || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  PS.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': if (rare('jump', 80)) g.audio.beep(330, 0.06, 'triangle', 0.035); break;
      case 'bounce': if (rare('bn', 60)) { var c = Math.min(5, d.chain || 1); seq(g, [196 + c * 60, 294 + c * 90], 30, 0.05, 'square', 0.035); } break;
      case 'land': if (rare('land', 140) && d.v > 300) g.audio.beep(110, 0.04, 'square', 0.025); break;
      case 'swing': seq(g, [880, 440], 30, 0.04, 'sawtooth', 0.025); break;
      case 'whack': seq(g, [220, 330], 30, 0.05, 'square', 0.04); break;
      case 'crack': seq(g, [1480, 988, 660], 35, 0.04, 'sawtooth', 0.03); break;
      case 'chest': seq(g, [523, 659, 784, 1046, 1318], 50, 0.06, 'triangle', 0.045); break;
      case 'gem': if (rare('gem', 40)) { if (d.big) seq(g, [1046, 1318, 1568], 35, 0.05, 'triangle', 0.04); else seq(g, [1318, 1760], 30, 0.04, 'square', 0.03); } break;
      case 'pie': seq(g, [523, 659, 784], 60, 0.07, 'triangle', 0.04); break;
      case 'life': seq(g, [392, 523, 659, 784, 1046], 70, 0.08, 'triangle', 0.05); break;
      case 'item': case 'relic': seq(g, [392, 494, 587, 784, 988, 1175], 80, 0.09, 'triangle', 0.05); break;
      case 'flag': seq(g, [587, 784], 70, 0.07, 'triangle', 0.04); break;
      case 'kill': seq(g, [659, 988], 35, 0.05, 'square', 0.035); break;
      case 'hurt': seq(g, [392, 294, 220], 45, 0.06, 'sawtooth', 0.045); break;
      case 'die': seq(g, [523, 440, 349, 294, 220, 175], 90, 0.12, 'triangle', 0.05); break;
      case 'leap': if (rare('lp', 300)) seq(g, [110, 147], 60, 0.08, 'sawtooth', 0.035); break;
      case 'dash': seq(g, [147, 196, 262], 50, 0.06, 'sawtooth', 0.035); break;
      case 'shoot': seq(g, [698, 523], 40, 0.05, 'square', 0.03); break;
      case 'thud': if (rare('thud', 120)) seq(g, [82, 65], 50, 0.08, 'sawtooth', 0.045); break;
      case 'guardWake': case 'bossWake': seq(g, [147, 0, 147, 175, 196, 220], 90, 0.09, 'square', 0.045); break;
      case 'guardHit': case 'bossHit': seq(g, [988, 740, 494], 30, 0.05, 'square', 0.05); break;
      case 'guardDown': seq(g, [523, 659, 784, 1046], 80, 0.08, 'triangle', 0.045); break;
      case 'bossDown': seq(g, [784, 659, 523, 392, 523, 659, 784, 1046], 90, 0.11, 'triangle', 0.05); break;
      case 'key': seq(g, [523, 659, 784, 1046, 784, 1046, 1318], 100, 0.12, 'triangle', 0.05); break;
      case 'door': if (rare('door', 600)) g.audio.beep(196, 0.1, 'square', 0.035); break;
      case 'retreat': seq(g, [523, 440, 392], 90, 0.09, 'triangle', 0.04); break;
      case 'start': seq(g, [392, 587, 784], 90, 0.08, 'triangle', 0.04); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
