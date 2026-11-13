/* ДОСПЕХ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   DOSPEH.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var D = global.DOSPEH = global.DOSPEH || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  var THROW = { spear: [660, 'square'], axe: [330, 'sawtooth'], torch: [220, 'sawtooth'], blades: [990, 'square'], shield: [440, 'triangle'], hammer: [180, 'square'] };
  D.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': if (rare('jump', 80)) g.audio.beep(280, 0.07, 'triangle', 0.035); break;
      case 'land': if (rare('land', 120)) g.audio.beep(110, 0.04, 'square', 0.025); break;
      case 'throw': { var s = THROW[d.w] || THROW.spear; if (rare('thr', 50)) seq(g, [s[0], s[0] * 0.75], 25, 0.04, s[1], 0.035); break; }
      case 'special': seq(g, [523, 784, 1046, 1568], 40, 0.08, 'square', 0.05); break;
      case 'charged': seq(g, [880, 1320], 50, 0.06, 'triangle', 0.04); break;
      case 'hit': if (rare('hit', 50)) g.audio.beep(260, 0.04, 'square', 0.035); break;
      case 'kill': seq(g, [440, 294, 196], 40, 0.05, 'square', 0.04); break;
      case 'knock': if (rare('kn', 60)) g.audio.beep(160, 0.05, 'square', 0.035); break;
      case 'chest': seq(g, [392, 523, 659], 60, 0.07, 'triangle', 0.045); break;
      case 'trap': seq(g, [196, 185, 175, 165], 70, 0.09, 'sawtooth', 0.05); break;
      case 'armorOff': seq(g, [880, 660, 440, 330], 35, 0.06, 'square', 0.06); break;
      case 'die': seq(g, [523, 440, 349, 262, 196, 131], 90, 0.12, 'square', 0.055); break;
      case 'pickup': if (d.k === 'gold' || d.k === 'hammer') seq(g, [523, 659, 784, 1046, 1318], 60, 0.08, 'triangle', 0.055); else if (d.k === 'arm') seq(g, [392, 523, 659, 784], 60, 0.07, 'triangle', 0.05); else seq(g, [660, 880], 50, 0.06, 'triangle', 0.04); break;
      case 'weapon': break;
      case 'life': seq(g, [659, 784, 988, 1318], 70, 0.08, 'triangle', 0.05); break;
      case 'checkpoint': seq(g, [523, 784], 80, 0.08, 'triangle', 0.04); break;
      case 'rise': if (rare('rise', 200)) seq(g, [90, 110, 130], 60, 0.07, 'sawtooth', 0.03); break;
      case 'bubble': if (rare('bub', 200)) seq(g, [300, 360, 420], 70, 0.04, 'sine', 0.03); break;
      case 'splash': if (rare('spl', 150)) g.audio.beep(140, 0.08, 'sawtooth', 0.03); break;
      case 'kiteWarn': if (rare('kw', 200)) seq(g, [1200, 1400], 60, 0.04, 'square', 0.03); break;
      case 'dive': seq(g, [900, 700, 500], 40, 0.05, 'square', 0.035); break;
      case 'spit': if (rare('sp', 120)) g.audio.beep(d.big ? 150 : 220, 0.07, 'sawtooth', 0.03); break;
      case 'hop': if (rare('hop', 150)) g.audio.beep(d.big ? 100 : 160, 0.07, 'square', 0.03); break;
      case 'stomp': seq(g, [80, 55], 50, 0.1, 'sawtooth', 0.05); break;
      case 'dash': seq(g, [220, 330, 440], 30, 0.05, 'sawtooth', 0.035); break;
      case 'cast': seq(g, [330, 311, 294], 50, 0.07, 'sawtooth', 0.04); break;
      case 'clink': if (rare('clk', 90)) g.audio.beep(2093, 0.03, 'square', 0.03); break;
      case 'block': if (rare('blk', 60)) g.audio.beep(1568, 0.03, 'square', 0.03); break;
      case 'flame': if (rare('fl', 100)) g.audio.beep(150, 0.08, 'sawtooth', 0.03); break;
      case 'clank': if (rare('cln', 80)) g.audio.beep(196, 0.05, 'square', 0.03); break;
      case 'bossIntro': seq(g, [147, 0, 147, 0, 175, 196, 220], 90, 0.09, 'square', 0.045); break;
      case 'bossHit': if (rare('bh', 60)) g.audio.beep(330, 0.05, 'square', 0.04); break;
      case 'bossDie': seq(g, [784, 659, 523, 392, 330, 262, 196, 131], 80, 0.12, 'sawtooth', 0.05); break;
      case 'clear': seq(g, [392, 523, 659, 784, 659, 784, 1046], 110, 0.13, 'triangle', 0.06); break;
      case 'level': seq(g, [220, 330, 440], 90, 0.09, 'triangle', 0.04); break;
      case 'loopEnd': seq(g, [440, 392, 349, 330, 294], 160, 0.18, 'triangle', 0.05); break;
      case 'loop2': seq(g, [220, 277, 330, 440, 554], 90, 0.1, 'square', 0.045); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
