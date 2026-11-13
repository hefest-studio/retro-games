/* ШУСТРИК · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   SHUSTRIK.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var SH = global.SHUSTRIK = global.SHUSTRIK || {};
  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  var gearN = 0;

  SH.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': if (rare('jump', 80)) seq(g, [330, 494], 30, 0.05, 'square', 0.028); break;
      case 'land': if (rare('land', 140) && d.v > 500) g.audio.beep(110, 0.05, 'triangle', 0.03); break;
      case 'gear': if (rare('gear', 35)) { gearN = (gearN + 1) % 4; g.audio.beep([1319, 1480, 1568, 1760][gearN], 0.05, 'square', 0.025); } break;
      case 'spring': seq(g, [262, 392, 523, 784], 28, 0.06, 'square', 0.035); break;
      case 'pipe': seq(g, [196, 247, 294, 392, 494], 35, 0.07, 'sawtooth', 0.025); break;
      case 'pipeOut': g.audio.beep(784, 0.12, 'triangle', 0.04); break;
      case 'rail': if (rare('rail', 200)) seq(g, [988, 880], 40, 0.08, 'sawtooth', 0.02); break;
      case 'steam': if (rare('steam', 400)) seq(g, [180, 160, 140], 50, 0.09, 'sawtooth', 0.02); break;
      case 'tier': if (d.tier > 0) seq(g, d.tier === 2 ? [523, 659, 784, 1047] : [523, 659, 784], 40, 0.06, 'square', 0.03); break;
      case 'crate': if (rare('crate', 60)) seq(g, [150, 90], 30, 0.07, 'sawtooth', 0.045); break;
      case 'fire': if (rare('fire', d.w === 1 ? 70 : 40)) g.audio.beep([880, 1175, 330, 660][d.w || 0], 0.035, d.w === 2 ? 'sawtooth' : 'square', 0.022); break;
      case 'boom': if (rare('boom', 60)) seq(g, [120, 80, 60], 30, 0.08, 'sawtooth', 0.045); break;
      case 'hop': if (rare('hop', 60)) g.audio.beep(740, 0.03, 'triangle', 0.02); break;
      case 'kill': seq(g, [660, 440, 880], 30, 0.05, 'square', 0.032); break;
      case 'enemyHit': case 'bossHit': if (rare('hit', 60)) g.audio.beep(220, 0.04, 'square', 0.03); break;
      case 'cap': seq(g, [523, 784, 1047], 45, 0.07, 'square', 0.034); break;
      case 'secret': seq(g, [784, 988, 1175, 1568, 1976], 60, 0.08, 'triangle', 0.04); break;
      case 'token': seq(g, [1047, 1319, 1568, 2093], 70, 0.1, 'triangle', 0.04); break;
      case 'cp': seq(g, [880, 1109, 1319], 60, 0.08, 'triangle', 0.035); break;
      case 'hurt': case 'shieldHit': seq(g, [330, 220, 165], 40, 0.07, 'sawtooth', 0.04); break;
      case 'die': seq(g, [494, 440, 392, 330, 262, 196], 70, 0.1, 'square', 0.04); break;
      case 'life': seq(g, [659, 784, 1047, 784, 1047, 1319], 70, 0.08, 'square', 0.04); break;
      case 'eshoot': if (rare('eshoot', 120)) g.audio.beep(160, 0.06, 'sawtooth', 0.025); break;
      case 'boss': seq(g, [147, 156, 147, 139], 160, 0.18, 'sawtooth', 0.04); break;
      case 'bossDown': seq(g, [196, 262, 330, 392, 523, 659, 784], 80, 0.12, 'square', 0.045); break;
      case 'bossBump': case 'bossLeap': if (rare('bump', 200)) g.audio.beep(70, 0.12, 'triangle', 0.05); break;
      case 'vent': g.audio.beep(98, 0.2, 'sawtooth', 0.025); break;
      case 'clear': seq(g, [523, 659, 784, 1047, 784, 1047, 1319], 90, 0.1, 'square', 0.04); break;
      case 'bonusEnd': seq(g, d.done ? [784, 1047, 1319, 1568] : [392, 330, 262], 90, 0.1, 'triangle', 0.04); break;
      case 'bump': if (rare('bump2', 250)) g.audio.beep(90, 0.04, 'triangle', 0.02); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
