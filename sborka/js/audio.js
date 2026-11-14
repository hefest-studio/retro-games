/* СБОРКА · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   SBORKA.sfx(g, type, data) — вызывается из main.js на события логики; частые звуки прорежены,
   выстрелы за пределами экрана тише (data.far). */
(function (global) {
  'use strict';
  var SB = global.SBORKA = global.SBORKA || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function throttle(k, ms) { var n = Date.now(); if (n - (last[k] || 0) < ms) return false; last[k] = n; return true; }
  SB.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {}; var q = d.far ? 0.4 : 1;
    switch (type) {
      case 'shot':
        if (d.kind === 'rocket') { if (throttle('rk', 120)) seq(g, [260, 420], 30, 0.05, 'sawtooth', 0.025 * q); }
        else if (d.kind === 'turret') { if (throttle('tu', 150)) g.audio.beep(180, 0.07, 'square', 0.035 * q); }
        else if (throttle('sh', 90)) g.audio.beep(d.side ? 520 : 640, 0.03, 'square', 0.018 * q);
        break;
      case 'beam': if (throttle('bm', 140)) g.audio.beep(1500 + Math.random() * 300, 0.04, 'sawtooth', 0.01 * q); break;
      case 'hit': if (throttle('hit', 70)) g.audio.beep(300, 0.02, 'square', 0.012 * q); break;
      case 'kill': if (throttle('kl', 60)) seq(g, [220, 140, 90], 35, 0.08, 'sawtooth', 0.045 * q); break;
      case 'boom': if (throttle('bo', 80)) seq(g, [120, 80], 40, 0.1, 'sawtooth', 0.04 * q); break;
      case 'core': seq(g, [90, 70, 55, 40], 70, 0.18, 'sawtooth', 0.08); break;
      case 'build': if (d.side === 0) seq(g, [392, 523, 659], 60, 0.06, 'square', 0.04); break;
      case 'capture': if (d.side === 0) seq(g, [523, 659, 784, 1047], 70, 0.07, 'triangle', 0.05); else seq(g, [392, 311, 262], 90, 0.08, 'triangle', 0.045); break;
      case 'order': if (throttle('or', 100)) g.audio.beep(880, 0.03, 'triangle', 0.03); break;
      case 'select': g.audio.beep(1040, 0.02, 'triangle', 0.025); break;
      case 'possess': seq(g, [330, 494, 659], 50, 0.06, 'square', 0.04); break;
      case 'release': seq(g, [659, 494, 330], 50, 0.05, 'square', 0.035); break;
      case 'possLost': seq(g, [440, 330, 220], 80, 0.08, 'square', 0.04); break;
      case 'noRes': case 'noTarget': g.audio.beep(150, 0.08, 'square', 0.035); break;
      case 'ui': g.audio.beep(700, 0.025, 'triangle', 0.025); break;
      case 'rebuilt': g.audio.beep(330, 0.06, 'triangle', 0.025); break;
      case 'won': seq(g, [523, 659, 784, 1047, 784, 1047, 1319], 110, 0.11, 'square', 0.05); break;
      case 'lost': seq(g, [392, 349, 294, 262, 196], 150, 0.16, 'triangle', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
