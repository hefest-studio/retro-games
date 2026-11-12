/* ПУЗЫРЬ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   PUZYR.sfx(g, type, data) — вызывается из main.js на события логики. */
(function (global) {
  'use strict';
  var Z = global.PUZYR = global.PUZYR || {};

  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var last = {};
  function gate(k, ms) { var n = Date.now(); if (n - (last[k] || 0) < ms) return false; last[k] = n; return true; }

  Z.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'blow': g.audio.beep(520, 0.05, 'triangle', 0.045); setTimeout(function () { g.audio.beep(780, 0.06, 'sine', 0.04); }, 35); break;
      case 'jump': if (gate('jump', 60)) g.audio.beep(330, 0.06, 'square', 0.03); break;
      case 'bounce': seq(g, [440, 660], 40, 0.05, 'triangle', 0.045); break;
      case 'trap': seq(g, [392, 523, 392], 45, 0.05, 'square', 0.045); break;
      case 'pop': g.audio.beep(900 + Math.min(6, d.n || 0) * 140, 0.06, 'square', 0.055); setTimeout(function () { g.audio.beep(1400 + (d.n || 0) * 160, 0.04, 'triangle', 0.04); }, 30); break;
      case 'burst': if (gate('burst', 40)) g.audio.beep(1200, 0.025, 'triangle', 0.03); break;
      case 'fizz': if (gate('fizz', 80)) g.audio.beep(1500, 0.02, 'sine', 0.02); break;
      case 'item': seq(g, [880, 1320], 45, 0.05, 'square', 0.045); break;
      case 'letter': seq(g, [659, 880, 1047], 55, 0.06, 'triangle', 0.05); break;
      case 'word': seq(g, [523, 659, 784, 1047, 784, 1047, 1319], 75, 0.09, 'square', 0.055); break;
      case 'special':
        if (d.kind === 'fire') seq(g, [196, 247, 294], 40, 0.08, 'sawtooth', 0.05);
        else if (d.kind === 'water') seq(g, [784, 698, 587, 523], 45, 0.06, 'sine', 0.05);
        else { g.audio.beep(110, 0.25, 'sawtooth', 0.07); setTimeout(function () { g.audio.beep(1760, 0.08, 'square', 0.04); }, 20); }
        break;
      case 'zap': if (gate('zap', 50)) seq(g, [660, 990], 40, 0.05, 'square', 0.045); break;
      case 'charge': if (gate('charge', 120)) g.audio.beep(180, 0.2, 'sawtooth', 0.025); break;
      case 'shoot': if (gate('shoot', 80)) g.audio.beep(240, 0.06, 'square', 0.035); break;
      case 'escape': seq(g, [330, 262, 220], 55, 0.07, 'sawtooth', 0.05); break;
      case 'die': seq(g, [523, 440, 349, 294, 220], 85, 0.11, 'triangle', 0.06); break;
      case 'respawn': seq(g, [392, 523, 659], 60, 0.07, 'triangle', 0.05); break;
      case 'join': seq(g, [523, 659, 784, 1047], 60, 0.07, 'square', 0.05); break;
      case 'clear': seq(g, [523, 659, 784, 659, 784, 1047, 1319], 70, 0.09, 'square', 0.055); break;
      case 'life': seq(g, [784, 988, 1175, 1568], 60, 0.08, 'triangle', 0.06); break;
      case 'hurry': seq(g, [880, 660, 880, 660, 880], 90, 0.07, 'square', 0.05); break;
      case 'spit': if (gate('spit', 150)) seq(g, [147, 110], 60, 0.1, 'sawtooth', 0.06); break;
      case 'douse': g.audio.beep(1100, 0.04, 'sine', 0.04); break;
      case 'bossHit': seq(g, [196, 147], 50, 0.09, 'square', 0.07); break;
      case 'bossTrap': seq(g, [262, 330, 392, 523, 659], 70, 0.09, 'triangle', 0.06); break;
      case 'bossDie': seq(g, [1319, 1047, 784, 659, 523, 392, 262], 80, 0.12, 'square', 0.07); break;
      case 'level': seq(g, [392, 523, 659], 70, 0.08, 'triangle', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
