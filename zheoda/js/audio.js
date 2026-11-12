/* ЖЕОДА · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   ZHEODA.sfx(g, type, data) — вызывается из main.js на события логики. */
(function (global) {
  'use strict';
  var Z = global.ZHEODA = global.ZHEODA || {};
  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var last = {};
  function throttle(k, ms) { var n = Date.now(); if (last[k] && n - last[k] < ms) return false; last[k] = n; return true; }

  Z.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'crystal': seq(g, [1175, 1568, 2093], 38, 0.06, 'triangle', 0.05); break;
      case 'gem': seq(g, [988, 1319, 1760, 2349], 45, 0.07, 'triangle', 0.055); break;
      case 'key': seq(g, [659, 880, 1175], 60, 0.08, 'square', 0.05); break;
      case 'door': seq(g, [220, 330, 440], 70, 0.09, 'square', 0.05); break;
      case 'lever': seq(g, d.on ? [330, 494] : [494, 330], 60, 0.07, 'square', 0.05); break;
      case 'flip': seq(g, d.gs < 0 ? [262, 392, 523, 784] : [784, 523, 392, 262], 35, 0.06, 'triangle', 0.05); break;
      case 'ammo': seq(g, [440, 554, 659], 45, 0.05, 'square', 0.045); break;
      case 'dyn': seq(g, [392, 523], 60, 0.06, 'square', 0.045); break;
      case 'place': g.audio.beep(1800, 0.12, 'sawtooth', 0.025); break;
      case 'blast': seq(g, [110, 82, 62], 60, 0.18, 'sawtooth', 0.08); break;
      case 'wall': if (throttle('wall', 80)) g.audio.beep(140, 0.12, 'square', 0.05); break;
      case 'shot': g.audio.beep(1320, 0.05, 'square', 0.04); setTimeout(function () { g.audio.beep(880, 0.04, 'square', 0.03); }, 30); break;
      case 'empty': if (throttle('empty', 200)) g.audio.beep(160, 0.05, 'square', 0.04); break;
      case 'hit': g.audio.beep(620, 0.04, 'square', 0.04); break;
      case 'kill': seq(g, [523, 392, 784], 40, 0.06, 'square', 0.05); break;
      case 'hurt': seq(g, [300, 200], 50, 0.08, 'sawtooth', 0.06); break;
      case 'die': seq(g, [392, 330, 262, 196, 147], 90, 0.13, 'sawtooth', 0.06); break;
      case 'heal': seq(g, [523, 659, 784, 1046], 55, 0.07, 'triangle', 0.055); break;
      case 'secret': seq(g, [523, 659, 784, 1046, 1319], 70, 0.09, 'square', 0.05); break;
      case 'exitOpen': seq(g, [392, 523, 659, 784], 90, 0.1, 'triangle', 0.06); break;
      case 'clear': seq(g, [523, 659, 784, 1046, 784, 1046, 1319], 80, 0.1, 'square', 0.055); break;
      case 'jump': g.audio.beep(520, 0.05, 'triangle', 0.03); break;
      case 'land': if (throttle('land', 120)) g.audio.beep(160, 0.03, 'triangle', 0.025); break;
      case 'crack': g.audio.beep(900, 0.05, 'triangle', 0.03); break;
      case 'shatter': if (throttle('shatter', 60)) seq(g, [1400, 1100, 800], 25, 0.04, 'square', 0.035); break;
      case 'spit': g.audio.beep(240, 0.06, 'triangle', 0.04); break;
      case 'lift': g.audio.beep(180, 0.06, 'square', 0.03); break;
      case 'dissolve': seq(g, [500, 350, 250], 50, 0.06, 'triangle', 0.04); break;
      case 'hop': if (throttle('hop', 150)) g.audio.beep(300, 0.05, 'triangle', 0.03); break;
      case 'tele': g.audio.beep(1600, 0.12, 'triangle', 0.035); break;
      case 'shard': seq(g, [1760, 1480], 30, 0.05, 'square', 0.035); break;
      case 'slam': seq(g, [98, 73], 70, 0.2, 'sawtooth', 0.08); break;
      case 'thud': seq(g, [130, 98], 60, 0.15, 'square', 0.07); break;
      case 'bossHit': g.audio.beep(330, 0.05, 'square', 0.05); break;
      case 'bossDie': seq(g, [392, 330, 262, 196, 147, 110, 82], 110, 0.16, 'sawtooth', 0.07); break;
      case 'hubMove': g.audio.beep(700, 0.03, 'square', 0.03); break;
      case 'locked': g.audio.beep(160, 0.08, 'square', 0.04); break;
      case 'level': seq(g, [294, 440, 587], 80, 0.08, 'triangle', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
