/* ЛИВЕНЬ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   LIVEN.sfx(g, type, a, b, c) — вызывается из main.js на события логики; частые события (выстрел, грейз, попадания) прорежены. */
(function (global) {
  'use strict';
  var LV = global.LIVEN = global.LIVEN || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  LV.sfx = function (g, type, a, b, c) {
    if (!g.audio.enabled) return;
    switch (type) {
      case 'shot': if (rare('shot', 140)) g.audio.beep(1760, 0.015, 'square', 0.008); break;
      case 'graze': if (rare('graze', 45)) g.audio.beep(2400 + Math.min(c || 0, 400), 0.02, 'triangle', 0.025); break;
      case 'enemyHit': if (rare('eh', 70)) g.audio.beep(330, 0.02, 'square', 0.015); break;
      case 'bossHit': if (rare('bh', 90)) g.audio.beep(196, 0.03, 'square', 0.02); break;
      case 'kill': if (rare('kill', 40)) { g.audio.beep(220, 0.06, 'sawtooth', 0.04); g.audio.beep(660, 0.04, 'triangle', 0.03); } break;
      case 'spark': if (rare('spark', 35)) g.audio.beep(1320, 0.02, 'triangle', 0.02); break;
      case 'card': seq(g, [784, 0, 587, 0, 659, 0, 523], 90, 0.18, 'triangle', 0.045); break;   // перезвон: колокольный ход
      case 'cardEnd': if (a > 0) seq(g, [784, 988, 1175, 1568, 1175, 1568], 70, 0.09, 'triangle', 0.05); else seq(g, [440, 330], 90, 0.1, 'triangle', 0.04); break;
      case 'cancel': g.audio.beep(1046, 0.12, 'triangle', 0.04); break;
      case 'bomb': seq(g, [110, 147, 220, 330, 440, 660], 40, 0.14, 'sawtooth', 0.06); break;
      case 'hit': g.audio.beep(880, 0.06, 'square', 0.05); break;
      case 'die': seq(g, [523, 392, 311, 233, 175, 131], 60, 0.12, 'sawtooth', 0.06); break;
      case 'respawn': seq(g, [392, 523, 659], 60, 0.06, 'triangle', 0.04); break;
      case 'extend': seq(g, [659, 784, 988, 1319, 988, 1319, 1568], 70, 0.1, 'triangle', 0.06); break;
      case 'midboss': case 'boss': seq(g, [220, 0, 220, 0, 220, 0, 294], 120, 0.12, 'square', 0.05); break;
      case 'midDown': seq(g, [196, 262, 330, 392, 523], 70, 0.12, 'sawtooth', 0.05); break;
      case 'bossDown': seq(g, [98, 82, 73, 110, 147, 196, 262, 392, 523], 100, 0.16, 'sawtooth', 0.06); break;
      case 'clear': seq(g, [523, 659, 784, 1046, 784, 1046, 1318], 100, 0.12, 'triangle', 0.055); break;
      case 'win': seq(g, [523, 659, 784, 1046, 784, 1046, 1318, 1568, 2093], 120, 0.16, 'triangle', 0.06); break;
      case 'contAsk': seq(g, [330, 262, 196], 120, 0.14, 'triangle', 0.05); break;
      case 'continue': seq(g, [262, 392, 523], 70, 0.08, 'square', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
