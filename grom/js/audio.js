/* ГРОМ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   GROM.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var GR = global.GROM = global.GROM || {};
  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  var beamOsc = 0;

  GR.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': if (rare('jump', 80)) g.audio.beep(300, 0.06, 'triangle', 0.035); break;
      case 'land': if (rare('land', 120)) g.audio.beep(110, 0.04, 'square', 0.025); break;
      case 'shot':
        if (d.k === 'L') { if (rare('shot', 90)) g.audio.beep(1320, 0.05, 'sawtooth', 0.025); }
        else if (d.k === 'B') { if (rare('shot', 90)) g.audio.beep(660, 0.05, 'square', 0.025); }
        else if (rare('shot', 70)) g.audio.beep(880, 0.03, 'square', 0.022);
        break;
      case 'bounce': if (rare('bounce', 60)) g.audio.beep(990, 0.02, 'triangle', 0.02); break;
      case 'beam': if (d.on) seq(g, [220, 440], 30, 0.05, 'sawtooth', 0.03); break;
      case 'mine': g.audio.beep(196, 0.05, 'square', 0.035); break;
      case 'boom': if (rare('boom', 60)) seq(g, [98, 73, 55], 40, 0.1, 'sawtooth', 0.06); break;
      case 'thunder': seq(g, [1760, 110, 1318, 82, 988, 65], 45, 0.12, 'sawtooth', 0.07); break;
      case 'wheel': g.audio.beep(d.on ? 523 : 392, 0.05, 'triangle', 0.035); if (d.on) setTimeout(function () { g.audio.beep(784, 0.05, 'triangle', 0.03); }, 50); break;
      case 'noWheel': g.audio.beep(140, 0.06, 'square', 0.03); break;
      case 'hurt': seq(g, [392, 262, 196], 40, 0.06, 'sawtooth', 0.05); break;
      case 'die': seq(g, [523, 392, 311, 233, 175, 131], 85, 0.12, 'sawtooth', 0.06); break;
      case 'respawn': case 'continue': seq(g, [392, 523, 659, 784], 70, 0.08, 'triangle', 0.05); break;
      case 'kill': if (rare('kill', 50)) seq(g, [523, 330, 784], 35, 0.05, 'square', 0.04); break;
      case 'hit': if (rare('hit', 50)) g.audio.beep(1500, 0.02, 'square', 0.018); break;
      case 'break': seq(g, d.k === 'bonus' ? [659, 880, 1175] : [147, 110], 45, 0.06, 'square', 0.04); break;
      case 'pickup':
        if (d.k === 'gem') { if (rare('gem', 50)) seq(g, [1318, 1760], 35, 0.04, 'square', 0.03); }
        else if (d.k === 'life') seq(g, [523, 659, 784, 1046, 1318], 70, 0.09, 'triangle', 0.06);
        else seq(g, [440, 554, 659, 880], 45, 0.06, 'triangle', 0.045);
        break;
      case 'weapon': seq(g, [330, 494, 659, 988], 50, 0.07, 'square', 0.045); break;
      case 'beacon': seq(g, [659, 988, 1318], 70, 0.08, 'triangle', 0.05); break;
      case 'secret': seq(g, [784, 988, 1175, 1568, 1175, 1568], 70, 0.08, 'triangle', 0.05); break;
      case 'extraLife': seq(g, [523, 784, 1046, 1568], 80, 0.1, 'triangle', 0.06); break;
      case 'eshot': if (rare('eshot', 90)) g.audio.beep(d.boss ? 220 : 330, 0.05, 'sawtooth', 0.025); break;
      case 'deflect': if (rare('defl', 60)) g.audio.beep(1760, 0.02, 'triangle', 0.02); break;
      case 'stomp': seq(g, [82, 61], 50, 0.12, 'sawtooth', 0.06); break;
      case 'markWarn': g.audio.beep(1046, 0.08, 'square', 0.03); break;
      case 'strike': seq(g, [1568, 98], 30, 0.1, 'sawtooth', 0.06); break;
      case 'bossIntro': seq(g, [110, 0, 110, 0, 147, 131, 110], 110, 0.14, 'sawtooth', 0.06); break;
      case 'phase': seq(g, [196, 185, 175, 165], 60, 0.08, 'square', 0.05); break;
      case 'bossHit': if (rare('bhit', 70)) g.audio.beep(180, 0.03, 'square', 0.025); break;
      case 'bossDie': seq(g, [262, 196, 147, 110, 82, 65, 49], 120, 0.18, 'sawtooth', 0.07); break;
      case 'portal': seq(g, [392, 523, 659, 784, 1046], 90, 0.1, 'triangle', 0.05); break;
      case 'clear': seq(g, [523, 659, 784, 1046, 784, 1046, 1318], 110, 0.14, 'triangle', 0.06); break;
      case 'timeLow': seq(g, [880, 0, 880, 0, 880], 120, 0.08, 'square', 0.04); break;
      case 'cont': seq(g, [440, 330, 262], 120, 0.12, 'triangle', 0.05); break;
      case 'win': seq(g, [523, 659, 784, 1046, 784, 1046, 1318, 1568], 120, 0.16, 'triangle', 0.06); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
