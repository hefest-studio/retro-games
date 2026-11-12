/* ФИТИЛЬ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   FITIL.sfx(g, type, data) — вызывается из main.js на события логики. */
(function (global) {
  'use strict';
  var F = global.FITIL = global.FITIL || {};

  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var lastBoom = 0, lastCrate = 0;

  F.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    var n = Date.now();
    switch (type) {
      case 'bomb': g.audio.beep(d.owner < 0 ? 90 : 160, 0.07, 'triangle', 0.07); break;
      case 'boom':
        if (n - lastBoom < 35) break; lastBoom = n;
        g.audio.beep(d.chain ? 95 : 70, 0.32, 'sawtooth', 0.08);
        setTimeout(function () { g.audio.beep(48, 0.25, 'square', 0.05); }, 30);
        break;
      case 'crate': if (n - lastCrate > 30) { lastCrate = n; g.audio.beep(330, 0.05, 'square', 0.035); } break;
      case 'reveal': seq(g, [880, 1175], 50, 0.05, 'triangle', 0.04); break;
      case 'power': seq(g, [587, 740, 880, 1175], 55, 0.07, 'square', 0.05); break;
      case 'kick': g.audio.beep(240, 0.05, 'square', 0.05); break;
      case 'stop': g.audio.beep(140, 0.04, 'triangle', 0.04); break;
      case 'detonate': seq(g, [1400, 900], 30, 0.04, 'square', 0.04); break;
      case 'kill': seq(g, [660, 990], 45, 0.06, 'square', 0.05); break;
      case 'die': seq(g, [523, 415, 330, 262, 196], 85, 0.11, 'sawtooth', 0.06); break;
      case 'respawn': seq(g, [392, 523, 659], 60, 0.07, 'triangle', 0.05); break;
      case 'open': seq(g, [523, 659, 784, 1046], 80, 0.1, 'triangle', 0.06); break;
      case 'clear': seq(g, [523, 659, 784, 659, 784, 1046, 1318], 70, 0.09, 'square', 0.055); break;
      case 'life': seq(g, [784, 988, 1175, 1568], 60, 0.08, 'triangle', 0.06); break;
      case 'spawn': g.audio.beep(110, 0.18, 'sawtooth', 0.05); break;
      case 'bossHit': seq(g, [196, 147], 50, 0.09, 'square', 0.07); break;
      case 'bossDie': seq(g, [392, 330, 262, 196, 131, 98, 65], 90, 0.15, 'sawtooth', 0.07); break;
      case 'level': seq(g, [392, 523, 659], 70, 0.08, 'triangle', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
