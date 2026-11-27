/* РЕДУТ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   REDUT.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var R = global.REDUT = global.REDUT || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  var kn = 0;

  R.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'zap': if (rare('zap', 70)) g.audio.beep(1400, 0.03, 'square', 0.02); break;
      case 'kill': kn = (kn + 1) % 4; if (rare('kill', 30)) seq(g, [[660, 784, 880, 988][kn], 1320], 28, 0.05, 'triangle', 0.035); break;
      case 'pylon': seq(g, [392, 587], 40, 0.07, 'square', 0.035); break;
      case 'unpylon': seq(g, [587, 392], 40, 0.06, 'square', 0.03); break;
      case 'noPlace': g.audio.beep(140, 0.08, 'sawtooth', 0.03); break;
      case 'flare': seq(g, [262, 523, 784, 1047, 1568], 28, 0.09, 'triangle', 0.05); break;
      case 'flareReady': seq(g, [880, 1319], 60, 0.08, 'sine', 0.035); break;
      case 'hurt': seq(g, [330, 220, 165], 40, 0.08, 'sawtooth', 0.045); break;
      case 'respawn': seq(g, [330, 494], 60, 0.07, 'triangle', 0.03); break;
      case 'coreHit': seq(g, [196, 147, 110], 50, 0.1, 'sawtooth', 0.05); break;
      case 'splat': if (rare('splat', 40)) g.audio.beep(90, 0.05, 'sawtooth', 0.03); break;
      case 'pylonDie': seq(g, [330, 247, 185], 45, 0.08, 'sawtooth', 0.04); break;
      case 'leap': if (rare('leap', 90)) g.audio.beep(520, 0.05, 'triangle', 0.02); break;
      case 'wave': seq(g, [330, 392, 494], 90, 0.1, 'triangle', 0.035); break;
      case 'bossSpawn': seq(g, [98, 104, 98, 92], 170, 0.2, 'sawtooth', 0.045); break;
      case 'bossHit': if (rare('bhit', 80)) g.audio.beep(150, 0.05, 'square', 0.035); break;
      case 'bossDie': seq(g, [196, 262, 330, 392, 523, 659, 784], 80, 0.12, 'square', 0.045); break;
      case 'clear': seq(g, [523, 659, 784, 1047, 784, 1047, 1319], 85, 0.1, 'square', 0.04); break;
      case 'win': seq(g, [523, 659, 784, 1047, 1319, 1568, 2093], 100, 0.14, 'triangle', 0.045); break;
      case 'gameover': seq(g, [392, 330, 262, 196, 147], 110, 0.14, 'sawtooth', 0.04); break;
      case 'boost': case 'revive': seq(g, [659, 784, 1047], 70, 0.09, 'triangle', 0.04); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
