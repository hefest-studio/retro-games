/* ЭСКАДРИЛЬЯ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   ESKADRILYA.sfx(g, type, data) — вызывается из main.js на события логики. Частые звуки (выстрел, попадание)
   прорежены, чтобы не забивать микс. */
(function (global) {
  'use strict';
  var E = global.ESKADRILYA = global.ESKADRILYA || {};

  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var last = {};
  function every(key, ms) { var n = Date.now(); if (n - (last[key] || 0) < ms) return false; last[key] = n; return true; }

  E.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'shoot': if (every('shoot', 110)) g.audio.beep(d.power >= 3 ? 1040 : 960, 0.03, 'square', 0.025); break;
      case 'hitAir': case 'groundHit': if (every('hit', 60)) g.audio.beep(520, 0.03, 'triangle', 0.03); break;
      case 'turretHit': if (every('thit', 70)) g.audio.beep(300, 0.04, 'square', 0.035); break;
      case 'clang': if (every('clang', 90)) g.audio.beep(1700, 0.03, 'triangle', 0.03); break;
      case 'kill': seq(g, d.type === 'blimp' ? [330, 247, 185, 139, 104] : [620, 410], d.type === 'blimp' ? 70 : 35, d.type === 'blimp' ? 0.1 : 0.05, d.type === 'blimp' ? 'sawtooth' : 'square', 0.05); break;
      case 'groundKill': seq(g, [180, 120, 80], 50, 0.09, 'sawtooth', 0.055); break;
      case 'turretKill': seq(g, [392, 262, 175, 131], 60, 0.1, 'sawtooth', 0.06); break;
      case 'enemyShot': if (every('es', 120)) g.audio.beep(d.kind === 'flak' ? 200 : d.kind === 'shell' ? 150 : 360, 0.04, 'sawtooth', 0.02); break;
      case 'hurt': seq(g, [220, 165], 50, 0.07, 'sawtooth', 0.06); break;
      case 'lowEnergy': seq(g, [880, 660, 880, 660], 120, 0.08, 'square', 0.045); break;
      case 'wingLost': seq(g, [520, 390, 290], 60, 0.07, 'square', 0.045); break;
      case 'loop': seq(g, [392, 523, 659, 784, 659, 523], 120, 0.09, 'triangle', 0.045); break;
      case 'pickup':
        if (d.kind === 'fuel') seq(g, [523, 659, 784], 55, 0.07, 'triangle', 0.055);
        else if (d.kind === 'wing') seq(g, [392, 523, 659, 784, 1046], 60, 0.07, 'square', 0.05);
        else if (d.kind === 'loop') seq(g, [659, 880, 659, 880], 50, 0.06, 'triangle', 0.05);
        else seq(g, [440, 554, 659, 880], 50, 0.07, 'square', 0.05);
        break;
      case 'drop': g.audio.beep(1320, 0.05, 'triangle', 0.035); break;
      case 'raid': if (d.pat === 'blimp') seq(g, [110, 98], 160, 0.18, 'triangle', 0.04); break;
      case 'bossArrive': seq(g, [98, 98, 131, 98], 260, 0.22, 'sawtooth', 0.05); break;
      case 'bossAnchor': seq(g, [147, 196], 140, 0.15, 'square', 0.05); break;
      case 'bossSink': seq(g, [392, 330, 262, 196, 165, 131, 98, 73], 110, 0.16, 'sawtooth', 0.07); break;
      case 'playerLost': seq(g, [330, 262, 196, 147, 110, 82], 85, 0.13, 'sawtooth', 0.065); break;
      case 'respawn': seq(g, [523, 784], 80, 0.08, 'triangle', 0.05); break;
      case 'life': seq(g, [523, 659, 784, 1046], 60, 0.08, 'triangle', 0.06); break;
      case 'clear': seq(g, [392, 494, 587, 784, 587, 784, 988], 85, 0.11, 'square', 0.055); break;
      case 'level': seq(g, [294, 392, 494, 587], 90, 0.09, 'triangle', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
