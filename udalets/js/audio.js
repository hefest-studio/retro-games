/* УДАЛЕЦ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   UDALETS.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var U = global.UDALETS = global.UDALETS || {};
  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  var GEM = { '.': [1175, 1568], g: [880, 1175, 1397], b: [988, 1319, 1661], R: [1047, 1319, 1568, 2093] };   // переделка 2026-11: выдох, жар и горны

  U.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': if (rare('jump', 90)) seq(g, [392, 523], 35, 0.05, 'square', 0.03); break;
      case 'land': if (rare('land', 120)) g.audio.beep(140, 0.04, 'triangle', 0.025); break;
      case 'item':
        if (GEM[d.k]) { if (rare('gem', 50)) seq(g, GEM[d.k], 45, 0.06, 'square', 0.035); }
        else if (d.k === '+') seq(g, [523, 659, 784, 1047, 1319], 70, 0.09, 'triangle', 0.055);
        break;
      case 'puff': if (rare('puff', 80)) { g.audio.beep(220, 0.08, 'sawtooth', 0.02); setTimeout(function () { g.audio.beep(150, 0.1, 'triangle', 0.03); }, 20); } break;
      case 'lift': seq(g, [262, 392, 523], 35, 0.05, 'triangle', 0.035); break;
      case 'heat': seq(g, [196 + d.heat * 60, 262 + d.heat * 80], 45, 0.07, 'sawtooth', 0.035); break;
      case 'lit': seq(g, [392, 523, 659, 784, 1047, 784, 1047], 75, 0.1, 'square', 0.05); break;
      case 'vane': seq(g, [330, 440, 330, 440, 523, 659], 50, 0.06, 'triangle', 0.045); break;
      case 'stun': if (rare('stun', 100)) seq(g, [880, 660, 880], 30, 0.04, 'square', 0.03); break;
      case 'snuff': if (rare('snuff', 100)) g.audio.beep(1200, 0.04, 'triangle', 0.03); break;
      case 'kill': seq(g, [660, 440, 880, 330], 35, 0.05, 'square', 0.045); break;
      case 'eshoot': if (rare('esh', 150)) seq(g, [180, 140], 40, 0.06, 'sawtooth', 0.03); break;
      case 'die': seq(g, [784, 622, 523, 415, 330, 262, 196], 80, 0.11, 'square', 0.055); break;
      case 'respawn': seq(g, [392, 523, 659, 784], 60, 0.07, 'triangle', 0.045); break;
      case 'clear': seq(g, [392, 494, 587, 784, 587, 784, 988, 1175], 95, 0.12, 'triangle', 0.055); break;
      case 'continue': seq(g, [392, 523, 659, 784], 60, 0.07, 'triangle', 0.045); break;
      case 'life': seq(g, [659, 784, 988, 1319], 80, 0.09, 'square', 0.05); break;
      case 'room': if (rare('room', 150)) g.audio.beep(196, 0.03, 'triangle', 0.02); break;
      case 'win': seq(g, [523, 659, 784, 1047, 784, 1047, 1319, 1568, 2093], 120, 0.16, 'triangle', 0.06); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
