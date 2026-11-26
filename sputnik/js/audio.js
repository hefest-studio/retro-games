/* СПУТНИК · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   SPUTNIK.sfx(g, type, data) — вызывается из main.js на события логики. Частые события
   (скольжение у кромки, гашение пуль, выстрелы) прорежены, чтобы не забивать микшер. */
(function (global) {
  'use strict';
  var Sp = global.SPUTNIK = global.SPUTNIK || {};
  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }

  Sp.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'shoot': if (rare('shoot', 45)) g.audio.beep(1180, 0.035, 'square', 0.03); break;
      case 'eshot': if (rare('eshot', 90)) g.audio.beep(360, 0.04, 'sawtooth', 0.02); break;
      case 'kill': seq(g, [300 + (d.pts || 100) / 2, 180], 30, 0.05, 'square', 0.045); break;
      case 'hit': if (rare('hit', 40)) g.audio.beep(700, 0.025, 'square', 0.03); break;
      case 'skim': if (rare('skim', 110)) g.audio.beep(90 + d.k * 120 + Math.random() * 30, 0.06, 'sawtooth', 0.018 + d.k * 0.02); break;
      case 'tier': if (d.up) seq(g, d.tier === 2 ? [523, 784, 1046, 1568] : [392, 523, 659], 45, 0.06, 'triangle', 0.05); break;
      case 'quench': g.audio.beep(1600, 0.25, 'sawtooth', 0.025); seq(g, [880, 659, 440, 330, 220], 40, 0.08, 'triangle', 0.05); break;
      case 'douse': if (rare('douse', 80)) g.audio.beep(2400 + Math.random() * 400, 0.03, 'triangle', 0.02); break;
      case 'tutorQuench': seq(g, [659, 880], 80, 0.07, 'square', 0.04); break;
      case 'clang': if (rare('clang', 70)) g.audio.beep(1900, 0.03, 'triangle', 0.03); break;
      case 'guard': seq(g, [196, 185, 196, 185], 120, 0.12, 'sawtooth', 0.05); break;
      case 'guardDie': seq(g, [392, 294, 196, 131], 80, 0.12, 'sawtooth', 0.06); break;
      case 'boss': seq(g, [131, 139, 131, 123, 131], 150, 0.16, 'sawtooth', 0.06); break;
      case 'bossHit': if (rare('bossHit', 60)) g.audio.beep(520, 0.04, 'square', 0.04); break;
      case 'bossRage': seq(g, [262, 277, 294, 311], 70, 0.1, 'sawtooth', 0.055); break;
      case 'partDie': seq(g, [330, 220, 147], 70, 0.1, 'sawtooth', 0.06); break;
      case 'bossFire': if (rare('bossFire', 120)) g.audio.beep(180, 0.07, 'sawtooth', 0.03); break;
      case 'bossDie': seq(g, [523, 392, 330, 262, 196, 131, 98, 65], 90, 0.16, 'sawtooth', 0.07); break;
      case 'playerHit': seq(g, [440, 330, 247, 185, 139, 104], 70, 0.12, 'sawtooth', 0.065); break;
      case 'respawn': seq(g, [523, 784], 70, 0.08, 'triangle', 0.05); break;
      case 'checkpoint': seq(g, [784, 988], 60, 0.07, 'triangle', 0.04); break;
      case 'life': seq(g, [523, 659, 784, 1046, 1318], 60, 0.08, 'triangle', 0.06); break;
      case 'clear': seq(g, [523, 659, 784, 659, 784, 1046], 80, 0.1, 'square', 0.055); break;
      case 'level': seq(g, [262, 392, 523], 90, 0.09, 'triangle', 0.05); break;
      case 'stingerWarn': seq(g, [1046, 0, 1046], 90, 0.05, 'square', 0.035); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
