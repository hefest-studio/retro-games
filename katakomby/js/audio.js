/* КАТАКОМБЫ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   KATAKOMBY.sfx(g, type, data) — вызывается из main.js на события логики (переделка 2026-11: обруч, чаши, решётки). */
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
      case 'throw': g.audio.beep(d.hot ? 520 : 380, 0.06, 'triangle', 0.045); break;
      case 'recall': g.audio.beep(300, 0.05, 'triangle', 0.035); break;
      case 'catch': g.audio.beep(d.hot ? 660 : 560, 0.04, 'square', 0.03); break;
      case 'bounce': if (throttle('bn', 50)) g.audio.beep(760 + 120 * Math.min(4, d.n || 1), 0.035, 'square', 0.03); break;
      case 'spent': g.audio.beep(240, 0.05, 'triangle', 0.03); break;
      case 'ignite': seq(g, [330, 494, 659], 40, 0.06, 'sawtooth', 0.04); break;
      case 'cool': g.audio.beep(180, 0.12, 'triangle', 0.035); break;
      case 'light': seq(g, [392, 587, 784, 988], 55, 0.09, 'triangle', 0.055); break;
      case 'snuff': seq(g, [494, 330, 220], 60, 0.09, 'sawtooth', 0.045); break;
      case 'gate': seq(g, [147, 196, 247, 294], 70, 0.1, 'square', 0.045); break;
      case 'seal': seq(g, [294, 440, 587, 880, 1175], 80, 0.12, 'triangle', 0.06); break;
      case 'clang': if (throttle('cl', 80)) g.audio.beep(1250, 0.05, 'square', 0.03); break;
      case 'clink': if (throttle('ck', 80)) g.audio.beep(980, 0.03, 'triangle', 0.03); break;
      case 'hit': if (throttle('hit', 40)) g.audio.beep(420, 0.04, 'square', 0.04); break;
      case 'kill': if (throttle('kl', 35)) g.audio.beep((d.type === 'slime' ? 160 : d.type === 'spitter' ? 300 : 620) * (1 + 0.12 * ((d.mult || 1) - 1)), 0.08, 'sawtooth', 0.045); break;
      case 'rise': if (throttle('rs', 200)) g.audio.beep(70, 0.2, 'triangle', 0.03); break;
      case 'fizzle': g.audio.beep(900, 0.05, 'sine', 0.03); break;
      case 'hurt': if (throttle('hu' + d.pi, 160)) g.audio.beep(d.pi ? 230 : 200, 0.09, 'sawtooth', 0.05); break;
      case 'heroDie': seq(g, [392, 311, 233, 175, 131], 90, 0.13, 'sawtooth', 0.06); break;
      case 'revive': seq(g, [392, 523, 659], 70, 0.08, 'triangle', 0.05); break;
      case 'chest': seq(g, [784, 988, 1175, 1568], 50, 0.07, 'square', 0.045); break;
      case 'spit': if (throttle('spt', 90)) g.audio.beep(520, 0.05, 'triangle', 0.03); break;
      case 'ring': seq(g, [262, 220, 175], 40, 0.08, 'square', 0.045); break;
      case 'gust': seq(g, [110, 98, 87], 90, 0.22, 'sawtooth', 0.06); break;
      case 'bossHit': g.audio.beep(110, 0.1, 'square', 0.06); break;
      case 'bossDie': seq(g, [262, 330, 392, 523, 659, 784, 1046], 100, 0.16, 'triangle', 0.07); break;
      case 'clear': seq(g, [392, 523, 659, 784, 1046], 80, 0.1, 'square', 0.05); break;
      case 'upgrade': seq(g, [659, 880], 60, 0.08, 'triangle', 0.05); break;
      case 'boost': seq(g, [523, 784, 1046], 60, 0.1, 'triangle', 0.05); break;
      case 'floor': seq(g, d.boss ? [147, 139, 131] : [294, 262, 220], 110, 0.14, d.boss ? 'sawtooth' : 'triangle', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
