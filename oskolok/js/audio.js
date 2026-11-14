/* ОСКОЛОК · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   OSKOLOK.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var O = global.OSKOLOK = global.OSKOLOK || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  O.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': if (rare('jump', 90)) g.audio.beep(330, 0.06, 'triangle', 0.03); break;
      case 'land': if (d.v > 12 && rare('land', 120)) g.audio.beep(110, 0.05, 'square', 0.03); break;
      case 'pulse': seq(g, [1318, 1760, 2349], 30, 0.07, 'sine', 0.045); break;
      case 'shield': g.audio.beep(988, 0.12, 'triangle', 0.035); break;
      case 'charge': g.audio.beep(440, 0.1, 'sine', 0.03); break;
      case 'charged': seq(g, [880, 1175], 40, 0.06, 'triangle', 0.04); break;
      case 'breach': seq(g, [196, 147, 98], 40, 0.1, 'sawtooth', 0.06); break;
      case 'glass': if (rare('glass', 60)) seq(g, [2637, 2093, 3136], 25, 0.05, 'square', 0.03); break;
      case 'droneGo': seq(g, [1568, 2093], 50, 0.05, 'sine', 0.035); break;
      case 'droneAt': if (d.hit) seq(g, [2093, 2637], 40, 0.05, 'sine', 0.035); break;
      case 'dronePick': seq(g, [784, 988, 1175, 1568], 110, 0.12, 'sine', 0.05); break;
      case 'lever': seq(g, [262, 392], 60, 0.05, 'square', 0.04); break;
      case 'button': seq(g, [523, 659], 50, 0.05, 'triangle', 0.04); break;
      case 'door': if (d.open) seq(g, [196, 262, 330], 70, 0.08, 'triangle', 0.04); else seq(g, [262, 196], 60, 0.08, 'triangle', 0.04); break;
      case 'mirror': seq(g, [1760, 1319], 40, 0.06, 'triangle', 0.035); break;
      case 'crystal': seq(g, [2349, 1760, 1319], 50, 0.06, 'sine', 0.035); break;
      case 'crash': seq(g, [3136, 2093, 1568, 1046], 30, 0.07, 'square', 0.035); break;
      case 'shake': if (rare('shake', 150)) g.audio.beep(120, 0.08, 'sawtooth', 0.025); break;
      case 'crumble': if (rare('crumble', 120)) g.audio.beep(82, 0.1, 'sawtooth', 0.035); break;
      case 'alert': seq(g, [622, 740], 60, 0.07, 'square', 0.035); break;
      case 'shard': seq(g, [1661, 1245], 30, 0.06, 'square', 0.04); break;
      case 'reflect': seq(g, [2093, 2794], 30, 0.07, 'triangle', 0.05); break;
      case 'shardBreak': if (rare('sb', 80)) g.audio.beep(2637, 0.03, 'square', 0.02); break;
      case 'shatter': seq(g, [3136, 2637, 2093, 1568, 1175], 35, 0.06, 'square', 0.045); break;
      case 'stun': seq(g, [1175, 880, 1175], 40, 0.05, 'triangle', 0.035); break;
      case 'distract': g.audio.beep(740, 0.08, 'triangle', 0.03); break;
      case 'burn': if (rare('burn', 400)) seq(g, [311, 233], 70, 0.1, 'sawtooth', 0.03); break;
      case 'hunt': if (rare('hunt', 800)) seq(g, [98, 104], 120, 0.18, 'sawtooth', 0.035); break;
      case 'fade': seq(g, [196, 147, 110], 80, 0.12, 'sine', 0.04); break;
      case 'chaseStart': seq(g, [73, 69, 65], 140, 0.25, 'sawtooth', 0.05); break;
      case 'die': seq(g, [523, 415, 330, 262, 196], 90, 0.12, 'sawtooth', 0.05); break;
      case 'exit': if (rare('exit', 300)) seq(g, [659, 880], 70, 0.07, 'triangle', 0.03); break;
      case 'ending': seq(g, [523, 659, 784, 1046, 1318], 140, 0.18, 'sine', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
