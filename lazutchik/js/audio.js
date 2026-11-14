/* ЛАЗУТЧИК · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   LZ.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var LZ = global.LZ = global.LZ || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  LZ.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'step': if (rare('step', 120)) g.audio.beep(90 + Math.random() * 20, 0.04, 'triangle', 0.035); break;
      case 'climb': if (rare('climb', 200)) g.audio.beep(330, 0.03, 'triangle', 0.02); break;
      case 'land': if (d.h > 80 || d.hatch) seq(g, [120, 80], 40, 0.06, 'triangle', 0.04); break;
      case 'atk': if (rare('atk', 60)) g.audio.beep(d.k === 'kick' || d.k === 'sweep' ? 260 : 420, 0.03, 'sawtooth', 0.016); break;
      case 'swing': case 'eswing': break;
      case 'hit': if (rare('hit', 50)) seq(g, [180, 120], 25, 0.05, 'square', 0.035); break;
      case 'block': seq(g, [1200, 900], 20, 0.03, 'square', 0.025); break;
      case 'whiff': case 'tooHeavy': g.audio.beep(200, 0.06, 'triangle', 0.02); break;
      case 'duck': g.audio.beep(660, 0.03, 'triangle', 0.02); break;
      case 'ko': if (d.how === 'takedown') seq(g, [392, 262], 50, 0.07, 'triangle', 0.035); else seq(g, [330, 247, 165], 50, 0.08, 'square', 0.035); break;
      case 'hurt': seq(g, [300, 220], 40, 0.07, 'sawtooth', 0.04); break;
      case 'die': seq(g, [392, 349, 311, 262, 196], 90, 0.12, 'square', 0.04); break;
      case 'spot': seq(g, [880, 1175], 60, 0.07, 'square', 0.03); break;
      case 'hear': if (rare('hear', 400)) g.audio.beep(740, 0.05, 'triangle', 0.025); break;
      case 'alarm': seq(g, [988, 740, 988, 740, 988, 740], 110, 0.1, 'square', 0.03); break;
      case 'calm': seq(g, [523, 392], 90, 0.08, 'triangle', 0.03); break;
      case 'shutter': if (rare('shut', 300)) seq(g, [110, 98, 87], 50, 0.07, 'sawtooth', 0.03); break;
      case 'door': seq(g, [523, 659, 784], 45, 0.06, 'square', 0.03); break;
      case 'locked': if (rare('locked', 900)) seq(g, [180, 150], 70, 0.07, 'square', 0.03); break;
      case 'grateLocked': if (rare('grl', 900)) g.audio.beep(140, 0.08, 'square', 0.03); break;
      case 'grate': seq(g, [196, 262, 330], 70, 0.08, 'sawtooth', 0.03); break;
      case 'hatch': seq(g, [150, 110], 50, 0.08, 'sawtooth', 0.035); break;
      case 'lift': seq(g, [196, 220, 247], 70, 0.08, 'triangle', 0.03); break;
      case 'liftStop': g.audio.beep(330, 0.06, 'triangle', 0.03); break;
      case 'cart': case 'cartCall': seq(g, [262, 330, 262, 330], 90, 0.05, 'square', 0.025); break;
      case 'cartStop': g.audio.beep(196, 0.08, 'triangle', 0.03); break;
      case 'pick': seq(g, [523, 784], 40, 0.05, 'square', 0.03); break;
      case 'toss': g.audio.beep(600, 0.04, 'sawtooth', 0.02); break;
      case 'clang': seq(g, [1480, 1245], 30, 0.05, 'square', 0.03); break;
      case 'thermos': seq(g, [523, 659, 784, 1047], 60, 0.06, 'triangle', 0.035); break;
      case 'card': seq(g, [784, 988, 1319], 55, 0.07, 'square', 0.03); break;
      case 'matrix': seq(g, [523, 659, 784, 1047, 784, 1047, 1319], 90, 0.1, 'square', 0.04); break;
      case 'planted': seq(g, [1568, 1319, 1568, 1319, 1568, 1319, 1568], 70, 0.05, 'square', 0.035); break;
      case 'tick': g.audio.beep(d.t < 5 ? 1760 : 1320, 0.03, 'square', 0.03); break;
      case 'nutThrow': if (rare('nut', 150)) g.audio.beep(500, 0.03, 'triangle', 0.02); break;
      case 'nutHit': g.audio.beep(900, 0.03, 'square', 0.03); break;
      case 'flash': g.audio.beep(d.on ? 1200 : 800, 0.03, 'square', 0.02); break;
      case 'wake': g.audio.beep(440, 0.08, 'triangle', 0.03); break;
      case 'tired': g.audio.beep(160, 0.06, 'triangle', 0.025); break;
      case 'needMatrix': g.audio.beep(200, 0.1, 'square', 0.025); break;
      case 'win': seq(g, [523, 659, 784, 1047, 1319, 1047, 1319, 1568], 95, 0.11, 'square', 0.04); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
