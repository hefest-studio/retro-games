/* ЛЕДНИК · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   LEDNIK.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var LD = global.LEDNIK = global.LEDNIK || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  LD.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': if (rare('jump', 80)) g.audio.beep(392, 0.06, 'triangle', 0.035); break;
      case 'land': if (rare('land', 140) && d.v > 300) g.audio.beep(120, 0.04, 'square', 0.025); break;
      case 'slide': seq(g, [880, 660, 520], 25, 0.04, 'triangle', 0.025); break;
      case 'climb': if (rare('cl', 200)) g.audio.beep(1568, 0.03, 'triangle', 0.02); break;
      case 'throw': seq(g, [523, 784], 40, 0.05, 'triangle', 0.035); break;
      case 'catch': if (rare('catch', 100)) g.audio.beep(988, 0.04, 'triangle', 0.03); break;
      case 'clink': if (rare('clink', 80)) g.audio.beep(1760, 0.03, 'square', 0.025); break;
      case 'stun': seq(g, [1046, 784, 1046], 50, 0.05, 'square', 0.035); break;
      case 'stomp': seq(g, [330, 494], 40, 0.05, 'square', 0.035); break;
      case 'boing': seq(g, [196, 294, 392, 587], 45, 0.07, 'triangle', 0.045); break;
      case 'flee': seq(g, [659, 784, 988], 50, 0.05, 'triangle', 0.035); break;
      case 'growl': if (rare('gr', 400)) seq(g, [147, 139], 60, 0.08, 'sawtooth', 0.025); break;
      case 'trumpet': seq(g, [233, 311, 233], 80, 0.09, 'sawtooth', 0.035); break;
      case 'thud': if (rare('thud', 120)) seq(g, [90, 65], 50, 0.08, 'sawtooth', 0.045); break;
      case 'sup': if (rare('sup', 50)) { if (d.k === 'hide') seq(g, [587, 740], 35, 0.05, 'triangle', 0.035); else if (d.k === 'flint') seq(g, [1175, 1568], 30, 0.04, 'square', 0.03); else seq(g, [784, 988], 35, 0.05, 'triangle', 0.035); } break;
      case 'enough': seq(g, [523, 659, 784, 1046], 80, 0.09, 'triangle', 0.045); break;
      case 'key': seq(g, [392, 523, 659, 784, 1046], 70, 0.08, 'triangle', 0.05); break;
      case 'heart': seq(g, [659, 880], 60, 0.07, 'triangle', 0.04); break;
      case 'reveal': if (rare('rv', 150)) seq(g, [1318, 1568], 40, 0.04, 'triangle', 0.03); break;
      case 'camp': seq(g, [262, 330, 392], 70, 0.08, 'triangle', 0.04); break;
      case 'fox': seq(g, [880, 1175], 50, 0.05, 'square', 0.03); break;
      case 'foxNo': if (rare('fn', 400)) g.audio.beep(196, 0.06, 'square', 0.03); break;
      case 'foxGrab': seq(g, [1046, 1318], 40, 0.04, 'square', 0.03); break;
      case 'foxHome': if (rare('fh', 120)) g.audio.beep(784, 0.04, 'triangle', 0.025); break;
      case 'need': g.audio.beep(220, 0.1, 'square', 0.035); break;
      case 'crack': seq(g, [1975, 1480, 988], 40, 0.04, 'sawtooth', 0.03); break;
      case 'hurt': seq(g, [392, 294, 220], 45, 0.06, 'sawtooth', 0.045); break;
      case 'die': seq(g, [523, 466, 392, 330, 262, 196], 90, 0.12, 'triangle', 0.05); break;
      case 'shatter': if (rare('sh', 90)) g.audio.beep(2349, 0.03, 'square', 0.02); break;
      case 'spit': seq(g, [698, 587, 494], 40, 0.05, 'square', 0.035); break;
      case 'gust': seq(g, [110, 131, 147, 165, 147], 70, 0.09, 'sawtooth', 0.025); break;
      case 'screech': seq(g, [1760, 1568, 1397], 60, 0.07, 'square', 0.03); break;
      case 'roll': seq(g, [98, 110, 98], 60, 0.06, 'sawtooth', 0.035); break;
      case 'bossIntro': seq(g, [147, 0, 147, 0, 175, 196, 220], 90, 0.09, 'square', 0.045); break;
      case 'bossHit': seq(g, [988, 740, 494], 30, 0.05, 'square', 0.05); break;
      case 'bossDown': seq(g, [784, 659, 523, 392, 523, 659, 784, 1046], 90, 0.11, 'triangle', 0.05); break;
      case 'clear': seq(g, [392, 523, 659, 784, 659, 784, 1046], 100, 0.12, 'triangle', 0.05); break;
      case 'level': seq(g, [392, 587, 784], 90, 0.08, 'triangle', 0.04); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
