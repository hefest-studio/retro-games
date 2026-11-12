/* ГЛУБЬ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   GLUB.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var Gb = global.GLUB = global.GLUB || {};
  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  var CRY = [0, 523, 587, 659, 698, 784, 880, 988, 1046];

  Gb.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': if (rare('jump', 80)) g.audio.beep(330, 0.06, 'triangle', 0.035); break;
      case 'thud': g.audio.beep(110, 0.07, 'square', 0.04); break;
      case 'stun': seq(g, [220, 165, 123, 92], 70, 0.09, 'square', 0.05); setTimeout(function () { seq(g, [1318, 1568, 1318], 90, 0.05, 'triangle', 0.03); }, 320); break;
      case 'hurt': seq(g, [392, 262, 196], 45, 0.07, 'sawtooth', 0.05); break;
      case 'slag': g.audio.beep(160, 0.12, 'sawtooth', 0.045); break;
      case 'die': seq(g, [523, 392, 311, 233, 175, 131], 90, 0.13, 'sawtooth', 0.06); break;
      case 'respawn': seq(g, [392, 523, 659], 80, 0.08, 'triangle', 0.05); break;
      case 'crystal': { var b = CRY[d.cid] || 784; seq(g, [b, b * 1.25, b * 1.5, b * 2], 60, 0.09, 'triangle', 0.06); break; }
      case 'gateOpen': seq(g, [262, 330, 392, 523, 392, 523, 659, 784, 1046], 110, 0.14, 'square', 0.055); break;
      case 'beacon': if (d.fresh) seq(g, [659, 880, 1175], 70, 0.08, 'triangle', 0.05); else seq(g, [880, 1175], 60, 0.06, 'triangle', 0.035); break;
      case 'nugget': if (rare('nug', 60)) seq(g, [1318, 1760], 40, 0.04, 'square', 0.035); break;
      case 'tank': seq(g, [440, 554, 659, 880], 50, 0.06, 'triangle', 0.045); break;
      case 'moleOut': seq(g, [196, 294], 40, 0.05, 'square', 0.04); break;
      case 'digStart': g.audio.beep(98, 0.2, 'sawtooth', 0.04); break;
      case 'dug': seq(g, [147, 110, 196, 294], 50, 0.07, 'sawtooth', 0.05); break;
      case 'clank': g.audio.beep(1760, 0.04, 'square', 0.035); break;
      case 'moleHome': g.audio.beep(988, 0.04, 'triangle', 0.03); break;
      case 'kill': seq(g, [523, 392, 784], 40, 0.06, 'square', 0.045); break;
      case 'room': if (rare('room', 120)) g.audio.beep(d.zone >= 4 ? 196 : 147 + d.zone * 22, 0.05, 'triangle', 0.02); break;
      case 'win': seq(g, [523, 659, 784, 1046, 784, 1046, 1318, 1568], 120, 0.16, 'triangle', 0.06); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
