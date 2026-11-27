/* ЗВЕРО-ОТРЯД · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   ZVERO.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var Z = global.ZVERO = global.ZVERO || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }

  Z.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': if (rare('jump', 60)) g.audio.beep(d.i ? 620 : 470, 0.07, 'square', 0.035); break;
      case 'land': if (rare('land', 80)) g.audio.beep(110, 0.06, 'sawtooth', 0.04); break;
      case 'swap': seq(g, [523, 784], 40, 0.06, 'triangle', 0.035); break;
      case 'star': seq(g, [988, 1319, 1760], 45, 0.07, 'triangle', 0.04); break;
      case 'kill': seq(g, [330, 523, 262], 35, 0.06, 'square', 0.04); break;
      case 'die': seq(g, [330, 247, 185, 131], 50, 0.09, 'sawtooth', 0.05); break;
      case 'respawn': seq(g, [330, 494, 659], 55, 0.07, 'triangle', 0.035); break;
      case 'plate': g.audio.beep(180, 0.08, 'square', 0.04); break;
      case 'gate': seq(g, d.open ? [262, 330, 392] : [392, 330, 262], 50, 0.07, 'triangle', 0.035); break;
      case 'taut': if (rare('taut', 400)) g.audio.beep(95, 0.05, 'triangle', 0.03); break;
      case 'bossCharge': seq(g, [98, 110, 98], 90, 0.14, 'sawtooth', 0.04); break;
      case 'bossBash': seq(g, [82, 65], 70, 0.12, 'square', 0.05); break;
      case 'bossHit': seq(g, [196, 262, 330, 392, 523], 60, 0.1, 'square', 0.045); break;
      case 'bossDie': seq(g, [196, 262, 330, 392, 523, 659, 784], 80, 0.12, 'square', 0.045); break;
      case 'gear': if (rare('gear', 200)) seq(g, [740, 560], 70, 0.06, 'square', 0.03); break;
      case 'clear': seq(g, [523, 659, 784, 1047, 784, 1047, 1319], 85, 0.1, 'square', 0.04); break;
      case 'win': seq(g, [523, 659, 784, 1047, 1319, 1568, 2093], 100, 0.14, 'triangle', 0.045); break;
      case 'gameover': seq(g, [392, 330, 262, 196, 147], 110, 0.14, 'sawtooth', 0.04); break;
      case 'boost': case 'revive': seq(g, [659, 784, 1047], 70, 0.09, 'triangle', 0.04); break;
      case 'level': seq(g, [392, 494, 587], 80, 0.09, 'triangle', 0.035); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
