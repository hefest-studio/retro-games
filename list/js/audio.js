/* ЛИСТ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   LIST.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var LIST = global.LIST = global.LIST || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  LIST.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': if (rare('jump', 80)) seq(g, [330, 440], 30, 0.05, 'square', 0.025); break;
      case 'land': if (rare('land', 160)) g.audio.beep(120, 0.04, 'triangle', 0.022); break;
      case 'swingHero': if (rare('sw', 60)) g.audio.beep(d.combo === 2 ? 200 : 260, 0.04, 'triangle', 0.02); break;
      case 'jkick': g.audio.beep(240, 0.06, 'triangle', 0.025); break;
      case 'hit': if (rare('hit', 40)) { g.audio.beep(d.big ? 110 : 150, 0.08, 'square', 0.04); g.audio.beep(d.big ? 70 : 90, 0.1, 'sawtooth', 0.03); } break;
      case 'whiff': if (rare('wf', 80)) g.audio.beep(1400, 0.05, 'sawtooth', 0.01); break;
      case 'wall': if (rare('wl', 80)) seq(g, [180, 120], 30, 0.05, 'square', 0.03); break;
      case 'eblock': case 'blocked': if (rare('bl', 60)) seq(g, [1760, 1320], 25, 0.04, 'square', 0.025); break;
      case 'hurt': seq(g, [220, 160, 110], 40, 0.06, 'sawtooth', 0.04); break;
      case 'kill': seq(g, [330, 247, 165], 35, 0.06, 'square', 0.03); break;
      case 'grab': seq(g, [392, 523], 30, 0.04, 'square', 0.03); break;
      case 'throw': seq(g, [523, 392, 262], 30, 0.05, 'triangle', 0.035); break;
      case 'tear': seq(g, [90, 120, 80, 140, 70, 110], 22, 0.05, 'sawtooth', 0.045); break;
      case 'bonk': case 'bonkWall': seq(g, [150, 100], 40, 0.07, 'square', 0.04); break;
      case 'lever': seq(g, [880, 660], 40, 0.04, 'square', 0.03); break;
      case 'pin': g.audio.beep(1200, 0.04, 'square', 0.03); break;
      case 'frameDown': seq(g, [130, 98, 73], 50, 0.1, 'sawtooth', 0.045); break;
      case 'draw': seq(g, [1760, 1568, 1760, 1976, 1760], 90, 0.03, 'sawtooth', 0.012); break;
      case 'drawn': seq(g, [523, 659, 784], 50, 0.07, 'triangle', 0.035); break;
      case 'clear': seq(g, [523, 659, 784, 1047], 70, 0.08, 'triangle', 0.035); break;
      case 'heal': seq(g, [440, 554, 659], 45, 0.06, 'triangle', 0.035); break;
      case 'letter': seq(g, [784, 988, 1175], 45, 0.05, 'square', 0.025); break;
      case 'sheet': seq(g, [523, 659, 784, 1047, 1319], 60, 0.07, 'square', 0.035); break;
      case 'pick': seq(g, [659, 880], 40, 0.05, 'square', 0.028); break;
      case 'slot': g.audio.beep(700, 0.03, 'square', 0.02); break;
      case 'useScis': seq(g, [1500, 1800], 30, 0.03, 'sawtooth', 0.015); break;
      case 'useFlask': g.audio.beep(330, 0.06, 'triangle', 0.03); break;
      case 'boom': seq(g, [80, 60, 45], 60, 0.15, 'sawtooth', 0.06); break;
      case 'useMark': seq(g, [659, 784, 988, 1319], 50, 0.06, 'triangle', 0.03); break;
      case 'noSketch': case 'empty': case 'grabMiss': if (rare('no', 250)) g.audio.beep(140, 0.06, 'square', 0.025); break;
      case 'drip': if (rare('drip', 120)) seq(g, [1320, 660], 60, 0.04, 'sine', 0.03); break;
      case 'windup': if (rare('wu', 150)) g.audio.beep(d.type === 'guard' ? 300 : 500, 0.06, 'triangle', 0.02); break;
      case 'dive': g.audio.beep(900, 0.12, 'sawtooth', 0.012); break;
      case 'fall': seq(g, [523, 392, 262, 131], 70, 0.09, 'triangle', 0.035); break;
      case 'die': seq(g, [392, 330, 262, 196, 131], 120, 0.14, 'triangle', 0.045); break;
      case 'respawn': seq(g, [262, 330, 392], 60, 0.06, 'triangle', 0.03); break;
      case 'turn': seq(g, [196, 262, 330, 392, 523], 90, 0.08, 'triangle', 0.03); break;
      case 'bossIn': seq(g, [110, 117, 110, 98], 140, 0.18, 'sawtooth', 0.045); break;
      case 'slam': seq(g, [70, 55], 60, 0.16, 'sawtooth', 0.06); break;
      case 'charge': seq(g, [110, 147, 196], 40, 0.08, 'sawtooth', 0.04); break;
      case 'erase': seq(g, [2000, 1500, 1000], 40, 0.05, 'sawtooth', 0.012); break;
      case 'bossDown': seq(g, [196, 262, 330, 392, 523, 659, 784], 80, 0.12, 'square', 0.04); break;
      case 'ending': seq(g, [523, 659, 784, 1047, 784, 1047], 110, 0.12, 'triangle', 0.04); break;
      case 'shieldHit': if (rare('sh', 100)) g.audio.beep(1568, 0.05, 'triangle', 0.03); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
