/* УГОЛЁК · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   UGOLYOK.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var U = global.UGOLYOK = global.UGOLYOK || {};
  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }

  U.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': if (rare('jump', 80)) g.audio.beep(392, 0.05, 'square', 0.03); break;
      case 'thud': g.audio.beep(98, 0.06, 'square', 0.035); break;
      case 'coal': { var b = 440 + Math.min(12, d.n % 13) * 30; seq(g, [b, b * 1.5], 45, 0.06, 'triangle', 0.05); break; }
      case 'roomClear': seq(g, [523, 659, 784, 1046], 70, 0.08, 'square', 0.045); break;
      case 'key': seq(g, [784, 988, 1175, 1568], 60, 0.08, 'triangle', 0.06); break;
      case 'helmet': seq(g, [330, 440, 554, 659, 880], 50, 0.07, 'square', 0.045); break;
      case 'helmetEnd': seq(g, [659, 440, 330], 70, 0.07, 'triangle', 0.04); break;
      case 'gear': seq(g, [1318, 1568, 1318], 40, 0.04, 'square', 0.035); break;
      case 'beacon': seq(g, [523, 784, 1046], 70, 0.08, 'triangle', 0.05); break;
      case 'life': seq(g, [659, 784, 988, 1318, 988, 1318], 80, 0.09, 'square', 0.05); break;
      case 'gateOpen': seq(g, [196, 262, 330, 392, 523, 392, 523, 659, 784], 110, 0.14, 'square', 0.055); break;
      case 'slam': if (rare('slam', 150)) { g.audio.beep(70, 0.16, 'sawtooth', 0.06); setTimeout(function () { g.audio.beep(55, 0.1, 'square', 0.04); }, 40); } break;
      case 'splash': if (d.near && rare('splash', 200)) g.audio.beep(1760, 0.03, 'triangle', 0.02); break;
      case 'die': seq(g, [494, 392, 311, 247, 196, 147], 85, 0.12, 'sawtooth', 0.06); break;
      case 'respawn': seq(g, [392, 523, 659], 80, 0.08, 'triangle', 0.05); break;
      case 'room': if (rare('room', 120)) g.audio.beep(140 + d.zone * 20, 0.05, 'triangle', 0.02); break;
      case 'win': seq(g, [523, 659, 784, 1046, 784, 1046, 1318, 1568], 120, 0.16, 'triangle', 0.06); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
