/* СКОК · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   SKOK.sfx(g, type, data) — вызывается из main.js на события логики (ключ, лебёдки, пружины…); частые события прорежены. */
(function (global) {
  'use strict';
  var SK = global.SKOK = global.SKOK || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  SK.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': if (rare('jump', 70)) g.audio.beep(440, 0.06, 'square', 0.03); break;
      case 'land': if (rare('land', 140) && d.v > 360) g.audio.beep(110, 0.04, 'square', 0.022); break;
      case 'boing': seq(g, [196, 294, 392, 587], 35, 0.05, 'triangle', 0.04); break;
      case 'swing': if (!d.hit && rare('sw', 120)) seq(g, [880, 660], 20, 0.03, 'triangle', 0.02); break;
      case 'stopE': seq(g, [1318, 988, 740], 30, 0.04, 'square', 0.035); break;
      case 'dismantle': seq(g, [523, 784, 1046, 1568], 30, 0.04, 'square', 0.03); break;
      case 'rewind': if (rare('rw', 200)) seq(g, [392, 523, 659], 40, 0.04, 'sawtooth', 0.022); break;
      case 'clank': if (rare('cl', 120)) seq(g, [220, 196], 30, 0.05, 'square', 0.035); break;
      case 'wind': seq(g, d.fresh ? [262, 330, 392, 523, 659] : [523, 659], 40, 0.05, 'triangle', 0.04); break;
      case 'unwind': seq(g, [659, 523, 392, 262], 50, 0.05, 'triangle', 0.03); break;
      case 'kill': break;
      case 'nut': if (rare('nut', 40)) seq(g, [1568, 2093], 30, 0.035, 'square', 0.022); break;
      case 'crate': seq(g, [330, 494, 1568, 2093], 30, 0.04, 'square', 0.03); break;
      case 'heart': seq(g, [659, 784, 1318, 1046, 1175, 1568], 70, 0.07, 'square', 0.035); break;
      case 'hurt': seq(g, [392, 294, 220], 45, 0.06, 'sawtooth', 0.04); break;
      case 'die': seq(g, [523, 494, 466, 440, 392, 330, 262], 85, 0.11, 'triangle', 0.05); break;
      case 'camp': seq(g, [523, 659, 784], 70, 0.08, 'triangle', 0.04); break;
      case 'squeak': if (rare('sq', 300)) seq(g, [1760, 2349], 40, 0.04, 'square', 0.022); break;
      case 'hop': if (!d.quiet && rare('bo', 300)) seq(g, [196, 294, 392], 40, 0.05, 'triangle', 0.025); break;
      case 'thud': if (rare('thud', 150)) seq(g, [98, 73], 50, 0.08, 'sawtooth', d.big ? 0.05 : 0.03); break;
      case 'bossIntro': seq(g, [110, 0, 110, 0, 131, 147, 165], 90, 0.09, 'square', 0.045); break;
      case 'bossLeap': seq(g, [196, 262], 50, 0.06, 'square', 0.03); break;
      case 'bossWind': seq(g, [880, 988, 880, 988], 70, 0.04, 'triangle', 0.03); break;
      case 'bossHit': seq(g, [988, 740, 494], 30, 0.05, 'square', 0.05); break;
      case 'bossDown': seq(g, [784, 659, 523, 392, 523, 659, 784, 1046], 90, 0.11, 'triangle', 0.05); break;
      case 'finish': seq(g, [1568, 1175, 1568, 1175, 1568].slice(0, 2 + (d.stars || 1)), 140, 0.3, 'triangle', 0.055); break;
      case 'level': seq(g, [392, 523, 784], 90, 0.08, 'triangle', 0.04); break;
      case 'map': if (rare('map', 60)) g.audio.beep(d.ok ? 523 : 175, 0.04, d.ok ? 'triangle' : 'square', 0.03); break;
      case 'win': seq(g, [523, 659, 784, 1046, 1318], 80, 0.1, 'triangle', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
