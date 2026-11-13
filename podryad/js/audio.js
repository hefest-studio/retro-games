/* ПОДРЯД · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   PODRYAD.sfx(g, type, a, b, c) — вызывается из main.js на события логики и ангара; частые события прорежены. */
(function (global) {
  'use strict';
  var P = global.PODRYAD = global.PODRYAD || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  P.sfx = function (g, type, a, b, c) {
    if (!g.audio.enabled) return;
    switch (type) {
      case 'shot': if (rare('shot', 150)) g.audio.beep(a === 'hammer' ? 180 : a === 'arc' ? 1400 : 980, 0.02, 'square', 0.008); break;
      case 'missile': if (rare('mis', 300)) g.audio.beep(520, 0.05, 'sawtooth', 0.012); break;
      case 'ehit': case 'ghit': if (rare('eh', 80)) g.audio.beep(300, 0.02, 'square', 0.014); break;
      case 'bhit': if (rare('bh', 100)) g.audio.beep(170, 0.03, 'square', 0.02); break;
      case 'kill': if (rare('kill', 40)) { g.audio.beep(200, 0.07, 'sawtooth', 0.04); g.audio.beep(520, 0.04, 'triangle', 0.03); } break;
      case 'gkill': seq(g, [150, 110, 80], 50, 0.09, 'sawtooth', 0.05); break;
      case 'blast': if (rare('bl', 120)) g.audio.beep(90, 0.08, 'sawtooth', 0.03); break;
      case 'pay': if (rare('pay', 60)) g.audio.beep(1568 + Math.min(c || 0, 600), 0.03, 'triangle', 0.02); break;
      case 'cut': if (rare('cut', 60)) g.audio.beep(2200, 0.02, 'triangle', 0.015); break;
      case 'ring': g.audio.beep(260, 0.08, 'square', 0.025); break;
      case 'hit': g.audio.beep(140, 0.12, 'sawtooth', 0.06); break;
      case 'shieldHit': if (rare('sh', 80)) g.audio.beep(740, 0.05, 'triangle', 0.04); break;
      case 'die': seq(g, [440, 330, 247, 185, 139, 104], 70, 0.14, 'sawtooth', 0.06); break;
      case 'mega': seq(g, [98, 131, 196, 262, 392, 523], 45, 0.16, 'sawtooth', 0.06); break;
      case 'cell': seq(g, [523, 784, 1046], 50, 0.07, 'triangle', 0.05); break;
      case 'armor': case 'megaGet': seq(g, [659, 880], 60, 0.06, 'triangle', 0.05); break;
      case 'gun': g.audio.beep(880, 0.05, 'square', 0.03); break;
      case 'midboss': case 'boss': seq(g, [196, 0, 196, 0, 196, 0, 262], 110, 0.12, 'square', 0.05); break;
      case 'midDown': seq(g, [196, 262, 330, 392, 523], 70, 0.12, 'sawtooth', 0.05); break;
      case 'bossDown': seq(g, [98, 82, 73, 110, 147, 196, 262, 392, 523], 100, 0.16, 'sawtooth', 0.06); break;
      case 'done': seq(g, [523, 659, 784, 1046, 784, 1046, 1318], 100, 0.12, 'triangle', 0.055); break;
      case 'buy': seq(g, [988, 1319], 45, 0.05, 'square', 0.04); break;
      case 'sell': seq(g, [1319, 988], 45, 0.05, 'square', 0.035); break;
      case 'deny': g.audio.beep(110, 0.1, 'square', 0.04); break;
      case 'move': g.audio.beep(600, 0.025, 'square', 0.02); break;
      case 'launch': seq(g, [262, 330, 392, 523, 659], 55, 0.08, 'triangle', 0.05); break;
      case 'lost': seq(g, [392, 311, 233], 120, 0.14, 'triangle', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
