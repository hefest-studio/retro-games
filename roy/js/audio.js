/* РОЙ · звук: оригинальные SFX на WebAudio через g.audio.beep (без файлов).
   ROY.sfx(g, type, data) — вызывается на события логики. Поджог в цепи звучит всё выше (место в цепи). */
(function (global) {
  'use strict';
  var R = global.ROY = global.ROY || {};
  var lastIgn = 0;
  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  R.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'shoot': g.audio.beep(1180, 0.04, 'square', 0.03); break;
      case 'ignite': {   // не чаще 30 мс, тон по месту в цепи (пентатоника вверх)
        var now = Date.now(); if (now - lastIgn < 30) break; lastIgn = now;
        var steps = [0, 2, 4, 7, 9], n = Math.min(d.n || 1, 15) - 1, semi = steps[n % 5] + 12 * Math.floor(n / 5);
        g.audio.beep(330 * Math.pow(2, semi / 12), 0.07, 'triangle', 0.05); break;
      }
      case 'crack': g.audio.beep(900, 0.05, 'square', 0.05); break;
      case 'chain': if (d.n >= 8) seq(g, [784, 988, 1175, 1568], 60, 0.09, 'square', 0.05); break;
      case 'qhurt': g.audio.beep(180, 0.05, 'sawtooth', 0.04); break;
      case 'queen': seq(g, [220, 330, 440, 660, 880], 70, 0.12, 'sawtooth', 0.07); break;
      case 'lure': seq(g, [520, 780], 50, 0.06, 'triangle', 0.05); break;
      case 'burst': g.audio.beep(140, 0.2, 'sawtooth', 0.07); break;
      case 'fizzle': g.audio.beep(260, 0.12, 'triangle', 0.03); break;
      case 'lay': g.audio.beep(420, 0.05, 'triangle', 0.025); break;
      case 'spit': g.audio.beep(300, 0.06, 'square', 0.035); break;
      case 'warn': seq(g, [880, 660, 880], 90, 0.07, 'square', 0.045); break;
      case 'surge': seq(g, [330, 294, 262], 60, 0.09, 'sawtooth', 0.05); break;
      case 'die': seq(g, [260, 190, 140, 100, 70], 70, 0.12, 'sawtooth', 0.08); break;
      case 'respawn': g.audio.beep(880, 0.08, 'triangle', 0.06); break;
      case 'life': seq(g, [660, 880, 1046], 70, 0.09, 'square', 0.05); break;
      case 'wave': seq(g, [392, 523, 659, 587, 784], 85, 0.1, 'triangle', 0.05); break;
      case 'clear': seq(g, [659, 784, 988, 1318], 80, 0.11, 'triangle', 0.06); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
