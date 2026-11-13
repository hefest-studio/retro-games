/* СОСЕДИ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   SOSEDI.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var SO = global.SOSEDI = global.SOSEDI || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  SO.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'shot':
        if (d.w === 'water') { if (rare('w', 70)) g.audio.beep(1400 + Math.random() * 300, 0.03, 'triangle', 0.018); }
        else if (d.w === 'bubble') seq(g, [520, 780], 30, 0.05, 'sine', 0.03);
        else if (d.w === 'pie') seq(g, [330, 262], 50, 0.06, 'triangle', 0.03);
        else seq(g, [440, 660], 40, 0.05, 'square', 0.025);
        break;
      case 'hit': if (rare('hit', 60)) g.audio.beep(d.how === 'box' ? 180 : 620, 0.03, 'square', 0.02); break;
      case 'kill': seq(g, d.how === 'bubble' ? [880, 1175, 1568] : [660, 990, 1320], 35, 0.05, 'square', 0.03); break;
      case 'splash': seq(g, [300, 200], 30, 0.06, 'sawtooth', 0.025); break;
      case 'boom': seq(g, [120, 90, 1568, 1976, 1319, 2349], 45, 0.09, 'sawtooth', 0.04); break;
      case 'bait': seq(g, [392, 494, 587], 50, 0.06, 'triangle', 0.03); break;
      case 'pop': if (rare('pop', 120)) g.audio.beep(1200, 0.03, 'sine', 0.02); break;
      case 'stun': seq(g, [988, 784], 40, 0.05, 'sine', 0.025); break;
      case 'saved': seq(g, d.bonus ? [784, 988, 1175, 1568, 1976] : [659, 784, 988, 1319], 60, 0.08, 'square', 0.035); break;
      case 'lost': seq(g, [523, 466, 415, 349, 262], 80, 0.1, 'triangle', 0.04); break;
      case 'grab': seq(g, [1319, 1047, 1319, 1047], 60, 0.05, 'square', 0.03); break;
      case 'pickup': seq(g, d.kind === 'ticket' ? [784, 988, 1175, 1568, 1175, 1568, 2093] : d.kind === 'key' ? [1175, 1568] : [880, 1175], 50, 0.06, 'square', 0.03); break;
      case 'door': seq(g, [262, 392, 523], 50, 0.07, 'square', 0.03); break;
      case 'nokey': seq(g, [196, 165], 70, 0.08, 'square', 0.03); break;
      case 'crack': seq(g, [98, 147, 196, 1568, 2093], 60, 0.1, 'sawtooth', 0.04); break;
      case 'exitOpen': seq(g, [523, 659, 784, 1047], 80, 0.1, 'triangle', 0.04); break;
      case 'portal': seq(g, [1568, 1175, 784, 523, 784, 1175, 1568], 30, 0.05, 'sine', 0.03); break;
      case 'noAmmo': g.audio.beep(140, 0.08, 'square', 0.03); break;
      case 'swap': if (rare('swap', 60)) g.audio.beep(740, 0.03, 'triangle', 0.025); break;
      case 'hurt': seq(g, [330, 220], 50, 0.08, 'sawtooth', 0.04); break;
      case 'block': g.audio.beep(1760, 0.05, 'triangle', 0.03); break;
      case 'die': seq(g, [784, 659, 523, 392, 330, 262], 70, 0.09, 'square', 0.04); break;
      case 'respawn': seq(g, [523, 784, 1047], 60, 0.07, 'triangle', 0.03); break;
      case 'life': seq(g, [659, 784, 1047, 784, 1047, 1319], 70, 0.08, 'square', 0.04); break;
      case 'spawn': if (rare('spawn', 400)) seq(g, [1568, 1319, 1047], 40, 0.04, 'square', 0.018); break;   // «пружинка» из сундука
      case 'spawnerDie': seq(g, [196, 147, 110, 1047, 1319], 50, 0.08, 'sawtooth', 0.04); break;
      case 'drumWarn': g.audio.beep(d.big ? 98 : 147, 0.08, 'triangle', 0.04); break;
      case 'drum': seq(g, d.big ? [65, 0, 65, 98] : [98, 131], 60, 0.12, 'sawtooth', 0.05); break;
      case 'throw': seq(g, [659, 880, 1175], 40, 0.04, 'square', 0.025); break;
      case 'organ': seq(g, [523, 659, 784, 659, 523], 50, 0.07, 'square', 0.03); break;
      case 'chargeWarn': seq(g, [110, 117, 123], 120, 0.12, 'sawtooth', 0.04); break;
      case 'charge': g.audio.beep(82, 0.3, 'sawtooth', 0.05); break;
      case 'thud': seq(g, [70, 55], 50, 0.15, 'sawtooth', 0.06); break;
      case 'teleport': seq(g, [2093, 1568, 1047], 30, 0.05, 'sine', 0.03); break;
      case 'stringsWarn': seq(g, [880, 932], 90, 0.08, 'triangle', 0.03); break;
      case 'strings': seq(g, [1760, 1319], 40, 0.06, 'sawtooth', 0.03); break;
      case 'bossHit': if (rare('bh', 90)) g.audio.beep(240, 0.03, 'square', 0.025); break;
      case 'bossDie': seq(g, [196, 262, 330, 392, 523, 659, 784, 1047], 80, 0.12, 'square', 0.045); break;
      case 'clear': seq(g, [523, 659, 784, 1047, 784, 1047, 1319], 90, 0.1, 'square', 0.04); break;
      case 'bonusEnd': seq(g, [784, 988, 1175, 1568], 90, 0.1, 'triangle', 0.04); break;
      case 'level': if (d.boss) seq(g, [196, 185, 175, 165], 120, 0.15, 'sawtooth', 0.04); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
