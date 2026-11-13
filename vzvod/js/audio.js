/* ВЗВОД · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   VZVOD.sfx(g, type, data) — вызывается из main.js на события логики; частые звуки прорежены. */
(function (global) {
  'use strict';
  var V = global.VZVOD = global.VZVOD || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function throttle(k, ms) { var n = Date.now(); if (n - (last[k] || 0) < ms) return false; last[k] = n; return true; }
  V.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'shot': if (throttle('sh', 70)) g.audio.beep(1250 + Math.random() * 200, 0.025, 'square', 0.012); break;
      case 'eshot': if (throttle('es', 110)) g.audio.beep(d.type === 'heavy' ? 240 : 420, 0.05, 'triangle', 0.025); break;
      case 'hit': if (throttle('hit', 60)) g.audio.beep(600, 0.02, 'square', 0.018); break;
      case 'kill': if (throttle('kl', 40)) seq(g, [320, 180], 30, 0.05, 'sawtooth', 0.035); break;
      case 'ping': if (throttle('pg', 160)) g.audio.beep(1900, 0.03, 'triangle', 0.02); break;
      case 'boom': if (throttle('bm', 50)) seq(g, [140, 90, 60], 35, 0.14, 'sawtooth', 0.07); break;
      case 'throw': seq(g, [700, 900], 40, 0.04, 'triangle', 0.035); break;
      case 'rocket': case 'shell': seq(g, [300, 520, 800], 25, 0.05, 'square', 0.035); break;
      case 'hiveHit': g.audio.beep(110, 0.12, 'square', 0.05); break;
      case 'hiveDown': seq(g, [220, 165, 131, 98, 73], 70, 0.14, 'sawtooth', 0.07); break;
      case 'broken': seq(g, [880, 660, 440, 330], 60, 0.07, 'square', 0.05); break;
      case 'zap': g.audio.beep(160, 0.1, 'sawtooth', 0.05); break;
      case 'pickup': seq(g, [660, 880, 1100], 50, 0.06, 'square', 0.04); break;
      case 'supply': seq(g, [523, 659, 784, 1047], 70, 0.07, 'triangle', 0.045); break;
      case 'noAmmo': g.audio.beep(150, 0.08, 'square', 0.035); break;
      case 'order': if (throttle('or', 120)) g.audio.beep(980, 0.02, 'triangle', 0.02); break;
      case 'split': seq(g, [523, 392], 60, 0.05, 'triangle', 0.035); break;
      case 'merge': seq(g, [392, 523], 60, 0.05, 'triangle', 0.035); break;
      case 'switch': g.audio.beep(740, 0.04, 'triangle', 0.03); break;
      case 'board': seq(g, [220, 330, 440], 50, 0.06, 'square', 0.04); break;
      case 'exitV': seq(g, [440, 330], 50, 0.06, 'square', 0.035); break;
      case 'vhit': if (throttle('vh', 100)) g.audio.beep(200, 0.04, 'square', 0.03); break;
      case 'vehDown': seq(g, [180, 120, 80, 50], 70, 0.15, 'sawtooth', 0.07); break;
      case 'vipHit': g.audio.beep(330, 0.08, 'triangle', 0.04); break;
      case 'spawn': if (throttle('sp', 400)) g.audio.beep(95, 0.12, 'sawtooth', 0.025); break;
      case 'holdStart': case 'wave': seq(g, [330, 392, 330], 90, 0.07, 'square', 0.035); break;
      case 'won': seq(g, [523, 659, 784, 1047, 784, 1047], 100, 0.1, 'square', 0.05); break;
      case 'lost': seq(g, [392, 330, 262, 196], 140, 0.15, 'triangle', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
