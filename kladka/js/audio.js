/* КЛАДКА · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   KLADKA.sfx(g, type, data) — вызывается из main.js на события логики. */
(function (global) {
  'use strict';
  var K = global.KLADKA = global.KLADKA || {};

  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var lastWall = 0;

  K.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'paddle': g.audio.beep(330 + Math.abs(d.rel || 0) * 120, 0.05, 'square', 0.05); break;
      case 'wall': { var n = Date.now(); if (n - lastWall > 40) { lastWall = n; g.audio.beep(220, 0.03, 'triangle', 0.035); } break; }
      case 'hit': g.audio.beep(520 + (d.hp || 1) * 60, 0.05, 'square', 0.045); break;
      case 'break': g.audio.beep(660 + (d.tone || 0) * 55 + (d.max > 1 ? 180 : 0), 0.06, 'square', 0.05); break;
      case 'iron': g.audio.beep(1250, 0.04, 'triangle', 0.035); break;
      case 'drop': g.audio.beep(900, 0.04, 'triangle', 0.03); break;
      case 'power':
        if (d.kind === 'narrow') seq(g, [500, 380], 60, 0.08, 'sawtooth', 0.05);
        else if (d.kind === 'life') seq(g, [523, 659, 784, 1046], 60, 0.08, 'triangle', 0.06);
        else seq(g, [587, 784, 988], 50, 0.07, 'square', 0.05);
        break;
      case 'stick': g.audio.beep(180, 0.06, 'triangle', 0.05); break;
      case 'launch': case 'unstick': seq(g, [440, 660], 45, 0.05, 'square', 0.045); break;
      case 'bolt': g.audio.beep(1500, 0.04, 'sawtooth', 0.025); break;
      case 'mouth': g.audio.beep(140, 0.25, 'sawtooth', 0.04); break;
      case 'spark': g.audio.beep(780, 0.07, 'triangle', 0.04); break;
      case 'burn': seq(g, [300, 200], 50, 0.08, 'sawtooth', 0.06); break;
      case 'bossHit': seq(g, [196, 247], 40, 0.07, 'square', 0.06); break;
      case 'bossDie': seq(g, [392, 330, 262, 196, 131, 98], 90, 0.14, 'sawtooth', 0.07); break;
      case 'lose': seq(g, [392, 311, 233, 175], 90, 0.12, 'sawtooth', 0.06); break;
      case 'respawn': g.audio.beep(660, 0.08, 'triangle', 0.05); break;
      case 'clear': seq(g, [523, 659, 784, 659, 784, 1046], 75, 0.1, 'square', 0.055); break;
      case 'level': seq(g, [392, 523, 659], 70, 0.08, 'triangle', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
