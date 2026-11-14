/* ПОДГОРЬЕ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   PODGORYE.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var P = global.PODGORYE = global.PODGORYE || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  P.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': if (rare('jump', 80)) g.audio.beep(392, 0.05, 'triangle', 0.03); break;
      case 'djump': seq(g, [523, 784], 30, 0.05, 'triangle', 0.035); break;
      case 'walljump': seq(g, [440, 659], 30, 0.05, 'square', 0.03); break;
      case 'land': if (d.v > 14 && rare('land', 120)) g.audio.beep(98, 0.05, 'square', 0.03); break;
      case 'dash': seq(g, [220, 330, 494], 18, 0.05, 'sawtooth', 0.03); break;
      case 'hook': seq(g, [880, 1175], 25, 0.04, 'square', 0.035); break;
      case 'release': g.audio.beep(659, 0.05, 'triangle', 0.03); break;
      case 'slam': g.audio.beep(196, 0.06, 'sawtooth', 0.04); break;
      case 'slamLand': seq(g, [110, 82, 65], 40, 0.09, 'square', 0.06); break;
      case 'splash': if (rare('splash', 200)) seq(g, [1318, 880, 587], 30, 0.05, 'sine', 0.03); break;
      case 'shot': if (rare('shot', 50)) g.audio.beep(1046, 0.04, 'square', 0.025); break;
      case 'bigShot': seq(g, [523, 784, 1046, 1568], 25, 0.07, 'sawtooth', 0.05); break;
      case 'charged': seq(g, [1568, 2093], 40, 0.05, 'triangle', 0.035); break;
      case 'hitWall': if (rare('hw', 70)) g.audio.beep(330, 0.03, 'square', 0.015); break;
      case 'hit': if (rare('hit', 50)) g.audio.beep(740, 0.04, 'square', 0.03); break;
      case 'clang': if (rare('clang', 80)) seq(g, [1976, 1480], 25, 0.04, 'square', 0.03); break;
      case 'kill': seq(g, [523, 392, 262], 35, 0.06, 'square', 0.04); break;
      case 'hurt': seq(g, [220, 165], 50, 0.08, 'sawtooth', 0.05); break;
      case 'die': seq(g, [523, 415, 330, 262, 196, 147], 110, 0.14, 'sawtooth', 0.05); break;
      case 'respawn': seq(g, [392, 523, 659], 90, 0.1, 'triangle', 0.04); break;
      case 'save': seq(g, [523, 659, 784, 1046], 90, 0.1, 'triangle', 0.045); break;
      case 'item': break;
      case 'vessel': seq(g, [659, 784, 988, 1318], 80, 0.1, 'triangle', 0.05); break;
      case 'tank': seq(g, [784, 1175, 1568], 70, 0.08, 'square', 0.04); break;
      case 'upgrade': seq(g, [523, 784, 1046, 1318, 1568], 70, 0.08, 'triangle', 0.05); break;
      case 'ability': seq(g, [392, 523, 659, 784, 1046, 784, 1046, 1318], 110, 0.13, 'triangle', 0.055); break;
      case 'forge': seq(g, [131, 196, 262, 392, 523, 784], 120, 0.18, 'sawtooth', 0.05); break;
      case 'sealOpen': seq(g, [262, 330, 392, 523, 659, 784, 1046], 140, 0.2, 'triangle', 0.05); break;
      case 'open': if (d.kind === 9) seq(g, [1318, 1760, 2349], 50, 0.06, 'sine', 0.04); else if (d.kind === 10) seq(g, [330, 262, 196], 40, 0.06, 'square', 0.04); else seq(g, [147, 110, 82], 40, 0.08, 'sawtooth', 0.05); break;
      case 'liftOn': seq(g, [196, 262, 330], 80, 0.1, 'square', 0.04); break;
      case 'travel': seq(g, [330, 262, 196, 262, 330, 392], 70, 0.08, 'triangle', 0.04); break;
      case 'liftSel': g.audio.beep(660, 0.03, 'square', 0.025); break;
      case 'eshot': if (rare('es', 90)) g.audio.beep(277, 0.05, 'square', 0.025); break;
      case 'warn': if (rare('warn', 200)) seq(g, [880, 0, 880], 60, 0.04, 'square', 0.025); break;
      case 'thud': g.audio.beep(73, 0.12, 'sawtooth', 0.05); break;
      case 'bossStart': seq(g, [110, 117, 110, 98], 150, 0.22, 'sawtooth', 0.05); break;
      case 'bossHit': if (rare('bh', 60)) g.audio.beep(523, 0.03, 'square', 0.025); break;
      case 'bossDown': seq(g, [1046, 784, 523, 392, 262, 196, 131], 90, 0.15, 'square', 0.055); break;
      case 'phase2': seq(g, [98, 104, 110, 117, 123], 120, 0.2, 'sawtooth', 0.05); break;
      case 'pickup': g.audio.beep(d.kind === 'hp' ? 988 : 1318, 0.06, 'triangle', 0.035); break;
      case 'shatter': if (rare('sh', 80)) seq(g, [2637, 2093], 25, 0.04, 'square', 0.025); break;
      case 'pop': g.audio.beep(1568, 0.03, 'sine', 0.03); break;
      case 'snap': g.audio.beep(330, 0.05, 'sawtooth', 0.03); break;
      case 'heat': if (rare('heat', 300)) seq(g, [196, 185], 60, 0.1, 'sawtooth', 0.04); break;
      case 'win': seq(g, [523, 659, 784, 1046, 1318, 1568], 160, 0.22, 'triangle', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
