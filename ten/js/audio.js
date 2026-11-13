/* ТЕНЬ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   TEN.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var TEN = global.TEN = global.TEN || {};
  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }

  TEN.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': if (rare('jump', 80)) seq(g, [392, 587], 28, 0.045, 'square', 0.026); break;
      case 'walljump': seq(g, [523, 784, 659], 26, 0.045, 'square', 0.03); break;
      case 'cling': if (rare('cling', 90)) g.audio.beep(196, 0.04, 'triangle', 0.035); break;
      case 'pull': seq(g, [262, 330, 392], 30, 0.04, 'triangle', 0.03); break;
      case 'land': if (rare('land', 140) && d.v > 450) g.audio.beep(110, 0.05, 'triangle', 0.03); break;
      case 'slide': seq(g, [220, 196, 175], 30, 0.05, 'sawtooth', 0.018); break;
      case 'hook': seq(g, [880, 1175, 1568], 22, 0.04, 'square', 0.03); break;
      case 'hookMiss': g.audio.beep(330, 0.05, 'triangle', 0.02); break;
      case 'fling': seq(g, [523, 698, 932, 1245], 24, 0.05, 'square', 0.03); break;
      case 'strike': if (rare('strike', 60)) seq(g, [1480, 988], 18, 0.035, 'sawtooth', 0.022); break;
      case 'special':
        if (d.k === 'star') seq(g, [1760, 1319], 22, 0.04, 'square', 0.026);
        else if (d.k === 'smoke') seq(g, [180, 160, 140, 120], 40, 0.09, 'sawtooth', 0.025);
        else if (d.k === 'whirl') seq(g, [659, 784, 988, 1175, 988, 784], 30, 0.05, 'triangle', 0.035);
        else seq(g, [147, 196, 262, 349], 30, 0.08, 'sawtooth', 0.035);
        break;
      case 'noCharge': g.audio.beep(140, 0.08, 'square', 0.025); break;
      case 'kill': seq(g, [784, 523, 1047], 28, 0.05, 'square', 0.03); break;
      case 'enemyHit': case 'bossHit': if (rare('hit', 60)) g.audio.beep(247, 0.04, 'square', 0.03); break;
      case 'parry': seq(g, [2093, 1568], 20, 0.03, 'square', 0.025); break;
      case 'lamp': seq(g, [1319, 988], 30, 0.04, 'triangle', 0.03); break;
      case 'pickup': seq(g, d.item === 'life' ? [659, 784, 1047, 1319] : [988, 1319], 40, 0.06, 'square', 0.03); break;
      case 'hurt': seq(g, [330, 233, 175], 40, 0.07, 'sawtooth', 0.04); break;
      case 'die': seq(g, [494, 440, 370, 330, 247, 196], 75, 0.1, 'square', 0.04); break;
      case 'alarm': seq(g, [880, 659, 880, 659], 120, 0.1, 'square', 0.03); break;
      case 'eshoot': if (rare('eshoot', 120)) g.audio.beep(175, 0.05, 'sawtooth', 0.022); break;
      case 'hop': if (rare('hop', 90)) g.audio.beep(523, 0.03, 'triangle', 0.018); break;
      case 'baton': g.audio.beep(123, 0.08, 'square', 0.03); break;
      case 'boom': seq(g, [110, 82, 62], 30, 0.08, 'sawtooth', 0.045); break;
      case 'boss': seq(g, [131, 139, 131, 123], 150, 0.18, 'sawtooth', 0.04); break;
      case 'bossWind': g.audio.beep(98, 0.2, 'square', 0.035); break;
      case 'bossCharge': seq(g, [147, 196], 50, 0.1, 'sawtooth', 0.04); break;
      case 'bossBump': case 'bossLeap': if (rare('bump', 200)) g.audio.beep(65, 0.14, 'triangle', 0.05); break;
      case 'bossRage': seq(g, [196, 185, 175, 165], 70, 0.1, 'sawtooth', 0.04); break;
      case 'bossDown': seq(g, [196, 262, 330, 392, 523, 659, 784], 80, 0.12, 'square', 0.045); break;
      case 'clear': seq(g, [523, 659, 784, 988, 784, 988, 1319], 85, 0.1, 'square', 0.04); break;
      case 'life': seq(g, [659, 784, 1047, 784, 1047, 1319], 70, 0.08, 'square', 0.04); break;
      case 'bonk': if (rare('bonk', 200)) g.audio.beep(150, 0.03, 'triangle', 0.02); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
