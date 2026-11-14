/* ОПЕРАЦИЯ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   OPERATSIYA.sfx(g, type, data) — вызывается из main.js на события логики; частые звуки прорежены. */
(function (global) {
  'use strict';
  var O = global.OPERATSIYA = global.OPERATSIYA || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function throttle(k, ms) { var n = Date.now(); if (n - (last[k] || 0) < ms) return false; last[k] = n; return true; }
  O.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'step': if (throttle('st', 70)) g.audio.beep(d.team === 0 ? 180 : 120, 0.02, 'square', 0.012); break;
      case 'shot': if (d.team === 0) seq(g, d.weapon === 'cutter' ? [520, 260] : d.weapon === 'spark' ? [1400, 700] : [1100, 820], 25, 0.04, d.weapon === 'cutter' ? 'sawtooth' : 'square', 0.03); else seq(g, [380, 300], 30, 0.05, 'sawtooth', 0.03); break;
      case 'hit': if (throttle('hit', 50)) g.audio.beep(d.team === 0 ? 240 : 640, 0.05, 'square', 0.035); break;
      case 'down': seq(g, d.team === 0 ? [660, 440, 330, 220] : [300, 200, 140, 90], 60, 0.08, 'sawtooth', 0.05); break;
      case 'react': seq(g, [990, 1320], 40, 0.04, 'triangle', 0.04); break;
      case 'throw': seq(g, [600, 760, 900], 40, 0.04, 'triangle', 0.035); break;
      case 'boom': setTimeout(function () { seq(g, [150, 100, 70, 50], 40, 0.14, 'sawtooth', 0.07); }, 380); break;
      case 'break': setTimeout(function () { seq(g, [220, 160], 40, 0.08, 'square', 0.04); }, 60); break;
      case 'chip': if (throttle('ch', 80)) g.audio.beep(900, 0.02, 'square', 0.02); break;
      case 'door': seq(g, [330, 440], 70, 0.06, 'triangle', 0.035); break;
      case 'crouch': g.audio.beep(260, 0.04, 'triangle', 0.025); break;
      case 'reload': seq(g, [500, 800], 90, 0.04, 'square', 0.03); break;
      case 'pickup': seq(g, [660, 880, 1100], 50, 0.06, 'square', 0.035); break;
      case 'kit': seq(g, [523, 659, 784], 70, 0.07, 'triangle', 0.04); break;
      case 'freed': case 'evac': seq(g, [523, 659, 784, 1047], 80, 0.08, 'triangle', 0.045); break;
      case 'hack': seq(g, [1200, 900, 1500, 1100], 45, 0.04, 'square', 0.035); break;
      case 'holdTick': seq(g, [440, 554, 659], 80, 0.07, 'triangle', 0.04); break;
      case 'overheat': case 'boil': seq(g, [880, 830, 780], 50, 0.05, 'sawtooth', 0.035); break;
      case 'reinf': if (throttle('rf', 500)) seq(g, [110, 98, 110], 120, 0.12, 'square', 0.04); break;
      case 'spotted': if (throttle('sp', 300)) seq(g, [1500, 1500], 90, 0.03, 'square', 0.03); break;
      case 'turn': if (d.side === 0) seq(g, [392, 523], 90, 0.07, 'triangle', 0.035); else seq(g, [220, 196], 90, 0.08, 'square', 0.03); break;
      case 'won': seq(g, [523, 659, 784, 1047, 784, 1047], 110, 0.1, 'square', 0.05); break;
      case 'lost': seq(g, [392, 330, 262, 196], 150, 0.15, 'triangle', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
