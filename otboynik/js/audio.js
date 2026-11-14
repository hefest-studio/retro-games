/* ОТБОЙНИК · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   OTBOYNIK.sfx(g, type, data) — вызывается из main.js на события логики; частые звуки прорежены. */
(function (global) {
  'use strict';
  var G = global.OTBOYNIK = global.OTBOYNIK || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function throttle(k, ms) { var n = Date.now(); if (n - (last[k] || 0) < ms) return false; last[k] = n; return true; }
  G.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'flip': if (throttle('fl' + d.side, 50)) g.audio.beep(d.side === 'L' ? 190 : 210, 0.04, 'square', 0.04); break;
      case 'launch': seq(g, [220, 330, 440], 35, 0.05, 'triangle', 0.05); break;
      case 'wall': if (throttle('wall', 60)) g.audio.beep(900 + Math.min(600, d.v || 0) * 0.4, 0.015, 'triangle', 0.015); break;
      case 'bump':
        if (!throttle('bump', 40)) break;
        if (d.type === 'forge') g.audio.beep(160, 0.08, 'sawtooth', 0.04);
        else if (d.type === 'spring') g.audio.beep(520, 0.06, 'square', 0.035);
        else if (d.type === 'magnet') g.audio.beep(330, 0.04, 'triangle', 0.03);
        else g.audio.beep(660, 0.05, 'square', 0.035);
        break;
      case 'bell': seq(g, [1318, 988], 90, 0.18, 'triangle', 0.05); break;
      case 'ignite': if (throttle('ig', 300)) g.audio.beep(110, 0.12, 'sawtooth', 0.03); break;
      case 'split': seq(g, [784, 1046], 50, 0.05, 'square', 0.04); break;
      case 'hit': if (throttle('hit', 40)) g.audio.beep(420, 0.03, 'square', 0.03); break;
      case 'kill': if (throttle('kill', 40)) seq(g, [600 + Math.random() * 120, 300], 30, 0.04, 'square', 0.035); break;
      case 'gate': seq(g, [140, 100], 70, 0.12, 'sawtooth', 0.06); break;
      case 'drain': seq(g, [392, 294, 196], 80, 0.1, 'triangle', 0.05); break;
      case 'tilt': g.audio.beep(90, 0.12, 'square', 0.05); break;
      case 'tiltLock': seq(g, [120, 90, 70], 120, 0.15, 'sawtooth', 0.06); break;
      case 'waveStart': seq(g, d.boss ? [196, 185, 175, 165] : [523, 659, 784], d.boss ? 140 : 70, 0.09, d.boss ? 'sawtooth' : 'square', 0.05); break;
      case 'waveClear': seq(g, [523, 659, 784, 1046], 70, 0.08, 'triangle', 0.05); break;
      case 'card': seq(g, [880, 1175], 50, 0.05, 'triangle', 0.04); break;
      case 'place': seq(g, [330, 440, 660], 50, 0.06, 'square', 0.04); break;
      case 'sel': g.audio.beep(600, 0.03, 'square', 0.025); break;
      case 'bossHit': if (throttle('bh', 60)) g.audio.beep(90 + Math.random() * 30, 0.08, 'square', 0.05); break;
      case 'bossDie': seq(g, [196, 262, 330, 392, 523, 659], 90, 0.14, 'triangle', 0.06); break;
      case 'nudge': g.audio.beep(150, 0.05, 'triangle', 0.03); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
