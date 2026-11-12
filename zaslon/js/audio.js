/* ЗАСЛОН · звук: оригинальные SFX на WebAudio через g.audio.beep (без файлов).
   ZASLON.sfx(g, type, data) — вызывается на события логики. */
(function (global) {
  'use strict';
  var Z = global.ZASLON = global.ZASLON || {};

  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }

  Z.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'shoot':
        if (d.weapon === 'shot') g.audio.beep(180, 0.07, 'sawtooth', 0.04);
        else g.audio.beep(1250, 0.04, 'square', 0.025);
        break;
      case 'ray': g.audio.beep(880 + Math.random() * 60, 0.12, 'triangle', 0.018); break;
      case 'eshoot': g.audio.beep(d.ring ? 380 : 520, 0.05, 'triangle', 0.03); break;
      case 'kill':
        if (d.kind === 'hulk' || d.kind === 'carrier') seq(g, [300, 200, 130], 45, 0.09, 'sawtooth', 0.07);
        else g.audio.beep(d.kind === 'dart' ? 420 : 300, 0.08, 'sawtooth', 0.05);
        break;
      case 'dive': g.audio.beep(960, 0.05, 'square', 0.02); break;
      case 'breach': seq(g, [160, 110], 70, 0.16, 'sawtooth', 0.08); break;
      case 'baseDown': seq(g, [220, 165, 110, 80], 120, 0.2, 'sawtooth', 0.09); break;
      case 'shieldHit': seq(g, [900, 600], 40, 0.06, 'triangle', 0.07); break;
      case 'shieldUp': g.audio.beep(1320, 0.06, 'triangle', 0.035); break;
      case 'die': seq(g, [260, 190, 140, 100, 70], 70, 0.12, 'sawtooth', 0.08); break;
      case 'respawn': g.audio.beep(880, 0.08, 'triangle', 0.06); break;
      case 'scrap': g.audio.beep(1600 + (d.v || 1) * 120, 0.03, 'square', 0.02); break;
      case 'capsule': seq(g, d.up ? [660, 880, 1100, 1320] : [520, 780, 1040], 55, 0.08, 'square', 0.055); break;
      case 'bomb':
        g.audio.beep(70, 0.6, 'sawtooth', 0.11); seq(g, [400, 300, 220, 160, 110], 60, 0.14, 'square', 0.06); break;
      case 'warn': seq(g, [880, 660, 880, 660], 200, 0.16, 'square', 0.05); break;
      case 'bossIn': seq(g, [110, 147, 110, 98], 160, 0.22, 'sawtooth', 0.07); break;
      case 'bossHit': g.audio.beep(240, 0.03, 'square', 0.025); break;
      case 'beamWarn': seq(g, [1400, 1400, 1400], 170, 0.06, 'square', 0.04); break;
      case 'beam': g.audio.beep(95, 0.9, 'sawtooth', 0.07); break;
      case 'spawn': g.audio.beep(330, 0.08, 'triangle', 0.04); break;
      case 'bossDie': seq(g, [300, 240, 190, 150, 120, 95, 75, 60], 80, 0.16, 'sawtooth', 0.09); break;
      // короткий оригинальный «позывной» сектора и отбоя
      case 'sector': seq(g, [330, 392, 494, 587, 494, 659], 90, 0.1, 'square', 0.05); break;
      case 'clear': seq(g, [523, 659, 784, 1046, 784, 1046], 85, 0.11, 'triangle', 0.06); break;
      case 'buy': seq(g, [784, 1175], 60, 0.07, 'square', 0.05); break;
      case 'deny': g.audio.beep(150, 0.12, 'square', 0.05); break;
      case 'shopMove': g.audio.beep(600, 0.03, 'square', 0.03); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
