/* СКОК · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   SKOK.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
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
      case 'jump': if (rare('jump', 70)) { if (d.suit === 'boots') seq(g, [330, 523, 784], 25, 0.05, 'triangle', 0.035); else g.audio.beep(440, 0.06, 'square', 0.03); } break;
      case 'land': if (rare('land', 140) && d.v > 360) g.audio.beep(110, 0.04, 'square', 0.022); break;
      case 'slide': seq(g, [660, 520, 440], 25, 0.04, 'triangle', 0.025); break;
      case 'pound': seq(g, [880, 660, 440, 330], 25, 0.04, 'square', 0.03); break;
      case 'quake': seq(g, [82, 62], 50, 0.1, 'sawtooth', 0.05); break;
      case 'stomp': seq(g, [523 + Math.min(6, d.combo || 1) * 60, 784 + Math.min(6, d.combo || 1) * 80], 35, 0.05, 'square', 0.035); break;
      case 'kill': if (d.how !== 'stomp' && rare('kill', 60)) seq(g, [988, 659], 30, 0.04, 'square', 0.03); break;
      case 'nut': if (rare('nut', 40)) seq(g, [1568, 2093], 30, 0.035, 'square', 0.022); break;
      case 'crate': if (d.k === 'nut') seq(g, [1568, 2093], 30, 0.035, 'square', 0.022); else seq(g, [392, 523, 659, 784], 45, 0.06, 'triangle', 0.04); break;
      case 'bonk': if (rare('bonk', 90)) g.audio.beep(147, 0.05, 'square', 0.03); break;
      case 'suit': seq(g, [523, 659, 784, 1046, 784, 1046], 55, 0.07, 'triangle', 0.045); break;
      case 'unsuit': seq(g, [784, 659, 523, 392], 50, 0.06, 'sawtooth', 0.035); break;
      case 'hurt': seq(g, [392, 294, 220], 45, 0.06, 'sawtooth', 0.04); break;
      case 'die': seq(g, [523, 494, 466, 440, 392, 330, 262], 85, 0.11, 'triangle', 0.05); break;
      case 'life': seq(g, [659, 784, 1318, 1046, 1175, 1568], 70, 0.07, 'square', 0.035); break;
      case 'key': seq(g, [784, 988, 1175, 1568], 70, 0.08, 'triangle', 0.045); break;
      case 'door': seq(g, [262, 330, 392, 523, 659, 784, 1046], 70, 0.09, 'triangle', 0.045); break;
      case 'camp': seq(g, [523, 659, 784], 70, 0.08, 'triangle', 0.04); break;
      case 'fire': seq(g, [1175, 880], 25, 0.04, 'sawtooth', 0.025); break;
      case 'fizz': if (rare('fz', 80)) g.audio.beep(196, 0.04, 'sawtooth', 0.02); break;
      case 'break': if (rare('br', 60)) seq(g, [220, 165], 30, 0.05, 'sawtooth', 0.035); break;
      case 'squeak': if (rare('sq', 300)) seq(g, [1760, 2349], 40, 0.04, 'square', 0.022); break;
      case 'boing': if (!d.quiet && rare('bo', 300)) seq(g, [196, 294, 392], 40, 0.05, 'triangle', 0.025); break;
      case 'thud': if (rare('thud', 150)) seq(g, [98, 73], 50, 0.08, 'sawtooth', d.big ? 0.05 : 0.03); break;
      case 'chip': if (rare('chip', 60)) g.audio.beep(1318, 0.03, 'square', 0.025); break;
      case 'bossIntro': seq(g, [110, 0, 110, 0, 131, 147, 165], 90, 0.09, 'square', 0.045); break;
      case 'bossLeap': seq(g, [196, 262], 50, 0.06, 'square', 0.03); break;
      case 'bossHit': seq(g, [988, 740, 494], 30, 0.05, 'square', 0.05); break;
      case 'bossDown': seq(g, [784, 659, 523, 392, 523, 659, 784, 1046], 90, 0.11, 'triangle', 0.05); break;
      case 'bell': if (d.hit) seq(g, [1568, 1175, 1568, 1175, 1568].slice(0, 2 + Math.min(3, d.tier || 0)), 160, 0.35, 'triangle', 0.06); else seq(g, [523, 392], 120, 0.2, 'triangle', 0.045); break;
      case 'ambushWon': seq(g, [523, 659, 784, 1046], 80, 0.09, 'triangle', 0.045); break;
      case 'level': if (!d.respawn) seq(g, [392, 523, 784], 90, 0.08, 'triangle', 0.04); break;
      case 'map': if (rare('map', 60)) g.audio.beep(d.ok ? 523 : 175, 0.04, d.ok ? 'triangle' : 'square', 0.03); break;
      case 'pick': seq(g, [659, 784], 40, 0.05, 'square', 0.03); break;
      case 'win': seq(g, [523, 659, 784, 1046, 1318], 80, 0.1, 'triangle', 0.05); break;
      case 'lose': seq(g, [330, 262, 196], 90, 0.1, 'square', 0.04); break;
      case 'lever': seq(g, [147, 220], 60, 0.06, 'square', 0.04); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
