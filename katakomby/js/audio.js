/* КАТАКОМБЫ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   KATAKOMBY.sfx(g, type, data) — вызывается из main.js на события логики. */
(function (global) {
  'use strict';
  var K = global.KATAKOMBY = global.KATAKOMBY || {};

  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var last = {};
  function throttle(k, ms) { var n = Date.now(); if (n - (last[k] || 0) < ms) return false; last[k] = n; return true; }

  K.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'swing': if (throttle('sw', 60)) g.audio.beep(180, 0.06, 'square', 0.045); break;
      case 'shot': if (throttle('sh', 50)) g.audio.beep(980, 0.04, 'triangle', 0.035); break;
      case 'hit': if (throttle('hit', 40)) g.audio.beep(420, 0.04, 'square', 0.04); break;
      case 'wall': if (throttle('wl', 70)) g.audio.beep(240, 0.03, 'triangle', 0.025); break;
      case 'kill': if (throttle('kl', 35)) g.audio.beep(d.type === 'slime' ? 160 : d.type === 'spitter' ? 300 : 620, 0.08, 'sawtooth', 0.045); break;
      case 'lairHit': g.audio.beep(140, 0.06, 'square', 0.05); break;
      case 'lairDie': seq(g, [330, 247, 185, 139], 60, 0.1, 'sawtooth', 0.06); break;
      case 'spawn': if (throttle('sp', 120)) g.audio.beep(95, 0.08, 'triangle', 0.035); break;
      case 'hurt': if (throttle('hu' + d.pi, 160)) g.audio.beep(d.pi ? 230 : 200, 0.09, 'sawtooth', 0.05); break;
      case 'heroDie': seq(g, [392, 311, 233, 175, 131], 90, 0.13, 'sawtooth', 0.06); break;
      case 'revive': seq(g, [392, 523, 659], 70, 0.08, 'triangle', 0.05); break;
      case 'key': seq(g, [1046, 1318], 60, 0.07, 'triangle', 0.05); break;
      case 'door': seq(g, [196, 262, 330], 70, 0.09, 'square', 0.05); break;
      case 'chest': seq(g, [784, 988, 1175, 1568], 50, 0.07, 'square', 0.045); break;
      case 'food': seq(g, [523, 659], 60, 0.08, 'triangle', 0.05); break;
      case 'potion': seq(g, [660, 880, 660], 50, 0.07, 'sine', 0.05); break;
      case 'bomb': seq(g, [110, 82, 62], 70, 0.25, 'sawtooth', 0.08); break;
      case 'spit': if (throttle('spt', 90)) g.audio.beep(520, 0.05, 'triangle', 0.03); break;
      case 'ring': seq(g, [262, 220, 175], 40, 0.08, 'square', 0.045); break;
      case 'bossHit': if (throttle('bh', 70)) g.audio.beep(110, 0.06, 'square', 0.05); break;
      case 'bossDie': seq(g, [262, 220, 175, 147, 110, 87, 73], 100, 0.16, 'sawtooth', 0.07); break;
      case 'clear': seq(g, [392, 523, 659, 784, 1046], 80, 0.1, 'square', 0.05); break;
      case 'upgrade': seq(g, [659, 880], 60, 0.08, 'triangle', 0.05); break;
      case 'floor': seq(g, d.boss ? [147, 139, 131] : [294, 262, 220], 110, 0.14, d.boss ? 'sawtooth' : 'triangle', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
