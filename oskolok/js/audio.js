/* ОСКОЛОК · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   OSKOLOK.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены.
   Бросок — свист вверх, воткнулся — звонкий «тинь», обмен — стеклянный глиссандо вниз-вверх, бусины — перезвон. */
(function (global) {
  'use strict';
  var O = global.OSKOLOK = global.OSKOLOK || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  O.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': if (rare('jump', 80)) g.audio.beep(320, 0.06, 'triangle', 0.03); break;
      case 'land': if (rare('land', 120)) g.audio.beep(120, 0.04, 'square', 0.02); break;
      case 'throw': seq(g, [700, 1000, 1400], 22, 0.04, 'triangle', 0.045); break;
      case 'plant': seq(g, [1760, 2349], 30, 0.07, 'triangle', 0.05); break;
      case 'swap': seq(g, [1568, 1046, 659, 988, 1318, 1760], 28, 0.05, 'triangle', 0.05); break;
      case 'fizzle': seq(g, [220, 165], 50, 0.07, 'sawtooth', 0.04); break;
      case 'recall': case 'lost': seq(g, [1318, 988], 30, 0.04, 'triangle', 0.035); break;
      case 'kill': seq(g, [523, 392, 262], 40, 0.05, 'square', 0.04); break;
      case 'hurt': seq(g, [220, 165, 110], 40, 0.07, 'sawtooth', 0.05); break;
      case 'respawnSafe': seq(g, [330, 440], 60, 0.06, 'triangle', 0.035); break;
      case 'die': seq(g, [494, 440, 392, 330, 294, 247, 196], 90, 0.12, 'square', 0.05); break;
      case 'pickup': if (d.k === 'heart') seq(g, [659, 880, 1046, 1318], 50, 0.06, 'triangle', 0.045); else if (rare('bd', 40)) seq(g, [1318, 1760], 40, 0.05, 'triangle', 0.035); break;
      case 'spark': if (rare('sp', 150)) g.audio.beep(520, 0.05, 'sawtooth', 0.025); break;
      case 'life': seq(g, [659, 784, 988, 1318], 70, 0.08, 'triangle', 0.05); break;
      case 'checkpoint': seq(g, [784, 0, 784, 1046], 70, 0.06, 'triangle', 0.04); break;
      case 'clear': seq(g, [523, 659, 784, 1046, 784, 1046, 1318], 90, 0.1, 'square', 0.05); break;
      case 'win': seq(g, [523, 659, 784, 1046, 1318, 1568, 2093], 120, 0.14, 'triangle', 0.06); break;
      case 'boost': case 'revived': seq(g, [523, 784, 1046], 70, 0.09, 'triangle', 0.05); break;
      case 'gameover': seq(g, [392, 330, 262, 196], 150, 0.18, 'sawtooth', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
