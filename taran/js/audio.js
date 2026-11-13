/* ТАРАН · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   TARAN.sfx(g, type, data, near) — вызывается из main.js на события логики; near — событие рядом с камерой
   (дальние выстрелы и удары не звучат); частые звуки прорежены. */
(function (global) {
  'use strict';
  var T = global.TARAN = global.TARAN || {};
  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var last = {};
  function throttle(k, ms) { var n = Date.now(); if (n - (last[k] || 0) < ms) return false; last[k] = n; return true; }

  T.sfx = function (g, type, d, near) {
    if (!g.audio.enabled) return;
    d = d || {};
    if (near === false && type !== 'finish' && type !== 'lap' && type !== 'cut') return;
    switch (type) {
      case 'count': g.audio.beep(440, 0.12, 'square', 0.05); break;
      case 'go': seq(g, [880, 1320], 70, 0.14, 'square', 0.06); break;
      case 'shot': if (throttle('sh', 70)) g.audio.beep(1100 + Math.random() * 200, 0.025, 'square', 0.014); break;
      case 'hit': if (throttle('hit', 60)) g.audio.beep(1800, 0.02, 'triangle', 0.02); break;
      case 'rocket': seq(g, [300, 420, 560], 30, 0.08, 'sawtooth', 0.035); break;
      case 'boom': if (throttle('bm', 60)) seq(g, [140, 90, 60], 40, 0.16, 'sawtooth', 0.07); break;
      case 'oilDrop': seq(g, [220, 160], 50, 0.08, 'triangle', 0.04); break;
      case 'mineDrop': seq(g, [900, 600], 40, 0.04, 'square', 0.03); break;
      case 'spin': if (throttle('sp', 200)) seq(g, [700, 500, 700, 500], 45, 0.05, 'triangle', 0.03); break;
      case 'ram': if (throttle('rm', 90)) g.audio.beep(70 + Math.min(80, (d.power || 0) * 4), 0.12, 'square', 0.06); break;
      case 'wall': if (throttle('wl', 140)) g.audio.beep(110, 0.06, 'square', 0.03); break;
      case 'wreck': seq(g, [196, 147, 110, 82, 55], 70, 0.14, 'sawtooth', 0.07); break;
      case 'respawn': seq(g, [392, 523, 659], 60, 0.07, 'triangle', 0.045); break;
      case 'nitro': seq(g, [180, 260, 360, 480], 35, 0.09, 'sawtooth', 0.045); break;
      case 'jump': g.audio.beep(520, 0.1, 'triangle', 0.035); break;
      case 'land': if (throttle('ld', 120)) g.audio.beep(80, 0.1, 'square', 0.05); break;
      case 'slag': if (throttle('sl', 160)) g.audio.beep(90 + Math.random() * 40, 0.08, 'sawtooth', 0.03); break;
      case 'press': seq(g, [60, 45], 50, 0.2, 'square', 0.08); break;
      case 'cart': g.audio.beep(160, 0.15, 'square', 0.06); break;
      case 'cartHorn': if (throttle('hn', 400)) seq(g, [587, 587], 140, 0.1, 'triangle', 0.025); break;
      case 'pit': if (throttle('pt', 250)) g.audio.beep(1400, 0.03, 'triangle', 0.02); break;
      case 'repaired': seq(g, [659, 880], 60, 0.07, 'triangle', 0.04); break;
      case 'lap': if (d.human >= 0) seq(g, d.best ? [523, 659, 784] : [523, 659], 70, 0.08, 'square', 0.045); break;
      case 'finish': if (d.human >= 0) seq(g, d.place <= 3 ? [392, 523, 659, 784, 1047] : [392, 330, 262], 90, 0.1, 'square', 0.055); break;
      case 'cut': seq(g, [330, 262, 196], 100, 0.12, 'triangle', 0.05); break;
      case 'unstuck': g.audio.beep(300, 0.05, 'triangle', 0.03); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
