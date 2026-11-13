/* РИКОШЕТ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   RIK.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var R = global.RIK = global.RIK || {};
  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  var combo = 0, comboT = 0;

  R.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'paddle': combo = 0; g.audio.beep(196 + Math.abs(d.off || 0) * 90, 0.06, 'square', 0.05); break;
      case 'wall': if (rare('wall', 40)) g.audio.beep(330, 0.03, 'triangle', 0.03); break;
      case 'barrier': g.audio.beep(520, 0.05, 'triangle', 0.04); break;
      case 'hit': if (rare('hit', 30)) g.audio.beep(660 - d.hp * 60, 0.05, 'square', 0.04); break;
      case 'clank': if (rare('clank', 50)) g.audio.beep(1480, 0.04, 'square', 0.03); break;
      case 'break': {
        var n = Date.now(); if (n - comboT > 900) combo = 0; comboT = n; combo = Math.min(combo + 1, 14);
        if (rare('break', 25)) g.audio.beep(440 * Math.pow(1.06, combo), 0.06, 'triangle', 0.05); break;
      }
      case 'boom': if (rare('boom', 60)) { g.audio.beep(90, 0.18, 'sawtooth', 0.06); g.audio.beep(60, 0.25, 'square', 0.04); } break;
      case 'regrow': if (rare('regrow', 200)) seq(g, [392, 523], 50, 0.05, 'triangle', 0.025); break;
      case 'gates': seq(g, [262, 392, 523, 784], 70, 0.08, 'square', 0.05); break;
      case 'launch': g.audio.beep(784, 0.05, 'triangle', 0.05); break;
      case 'stick': g.audio.beep(247, 0.06, 'triangle', 0.04); break;
      case 'laser': if (rare('laser', 90)) g.audio.beep(1320, 0.03, 'sawtooth', 0.025); break;
      case 'catch': if (d.bad) seq(g, [330, 247, 185], 50, 0.06, 'sawtooth', 0.045); else seq(g, [523, 659, 784, 1046], 45, 0.06, 'triangle', 0.05); break;
      case 'lose': seq(g, [440, 349, 262, 196], 90, 0.12, 'sawtooth', 0.055); break;
      case 'respawn': seq(g, [392, 523], 70, 0.06, 'triangle', 0.04); break;
      case 'clear': seq(g, [523, 659, 784, 1046, 784, 1046], 90, 0.1, 'triangle', 0.055); break;
      case 'shot': if (rare('shot', 120)) g.audio.beep(160, 0.08, 'square', 0.035); break;
      case 'beamWarn': seq(g, [880, 0, 880, 0, 880], 120, 0.05, 'square', 0.03); break;
      case 'beam': g.audio.beep(110, 0.4, 'sawtooth', 0.05); break;
      case 'zap': seq(g, [220, 147, 110], 50, 0.08, 'sawtooth', 0.06); break;
      case 'bossHit': if (rare('bossHit', 80)) g.audio.beep(140, 0.09, 'square', 0.06); break;
      case 'bossDie': seq(g, [98, 82, 73, 110, 147, 196, 262, 392], 110, 0.16, 'sawtooth', 0.06); break;
      case 'win': seq(g, [523, 659, 784, 1046, 784, 1046, 1318, 1568], 120, 0.16, 'triangle', 0.06); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
