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
      case 'blast': { var pw = d.power || 0.4; g.audio.beep(180 + pw * 120, 0.05, 'square', 0.05); setTimeout(function () { g.audio.beep(1100 + pw * 500, 0.04, 'triangle', 0.045); }, 20); setTimeout(function () { g.audio.beep(260, 0.12, 'sine', 0.04); }, 45); break; }
      case 'inflate': if (gate('inflate', 90)) g.audio.beep(400 + (d.k || 0) * 500, 0.05, 'sine', 0.025); break;
      case 'hop': g.audio.beep(520, 0.05, 'triangle', 0.035); break;
      case 'jump': if (gate('jump', 60)) g.audio.beep(330, 0.06, 'square', 0.03); break;
      case 'melt': seq(g, [196 * Math.pow(1.12, Math.min(5, d.combo || 1)), 392 * Math.pow(1.12, Math.min(5, d.combo || 1)), 147], 50, 0.09, 'sawtooth', 0.05); break;
      case 'knock': seq(g, [700, 880], 35, 0.05, 'square', 0.045); break;
      case 'ledge': if (gate('ledge', 120)) g.audio.beep(600, 0.04, 'triangle', 0.03); break;
      case 'bonk': if (gate('bonk', 60)) seq(g, [160, 120], 40, 0.06, 'square', 0.05); break;
      case 'thud': if (gate('thud', 80)) g.audio.beep(110, 0.08, 'square', 0.045); break;
      case 'bop': seq(g, [440, 660], 40, 0.05, 'triangle', 0.045); break;
      case 'bump': if (gate('bump', 150)) g.audio.beep(220, 0.04, 'square', 0.03); break;
      case 'zap': if (gate('zap', 50)) seq(g, [660, 990], 40, 0.05, 'square', 0.045); break;
      case 'reflect': if (gate('reflect', 60)) seq(g, [1200, 1600], 30, 0.04, 'triangle', 0.045); break;
      case 'douse': g.audio.beep(1100, 0.04, 'sine', 0.04); break;
      case 'charge': if (gate('charge', 120)) g.audio.beep(180, 0.2, 'sawtooth', 0.025); break;
      case 'shoot': if (gate('shoot', 80)) g.audio.beep(240, 0.06, 'square', 0.035); break;
      case 'die': seq(g, [523, 440, 349, 294, 220], 85, 0.11, 'triangle', 0.06); break;
      case 'respawn': case 'revive': seq(g, [392, 523, 659], 60, 0.07, 'triangle', 0.05); break;
      case 'join': seq(g, [523, 659, 784, 1047], 60, 0.07, 'square', 0.05); break;
      case 'clear': seq(g, [523, 659, 784, 659, 784, 1047, 1319], 70, 0.09, 'square', 0.055); break;
      case 'life': seq(g, [784, 988, 1175, 1568], 60, 0.08, 'triangle', 0.06); break;
      case 'spit': if (gate('spit', 150)) seq(g, [147, 110], 60, 0.1, 'sawtooth', 0.06); break;
      case 'bossHit': seq(g, [196, 147], 50, 0.09, 'square', 0.07); break;
      case 'bossFall': seq(g, [392, 330, 262, 196, 147], 90, 0.1, 'sawtooth', 0.06); break;
      case 'bossDie': seq(g, [1319, 1047, 784, 659, 523, 392, 262], 80, 0.12, 'square', 0.07); break;
      case 'level': seq(g, [392, 523, 659], 70, 0.08, 'triangle', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
