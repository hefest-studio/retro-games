/* ЧАЙНИК · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   CHAYNIK.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var CH = global.CHAYNIK = global.CHAYNIK || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  var sugN = 0;
  CH.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': if (rare('jump', 80)) seq(g, d.water ? [262, 330] : [392, 523], 30, 0.05, 'square', 0.028); break;
      case 'stroke': if (rare('stroke', 150)) g.audio.beep(220, 0.08, 'triangle', 0.03); break;
      case 'land': if (rare('land', 140)) g.audio.beep(140, 0.04, 'triangle', 0.025); break;
      case 'steam': if (rare('steam', 90)) g.audio.beep(1800 + Math.random() * 900, 0.04, 'sawtooth', 0.008); break;
      case 'overheat': seq(g, [1568, 1760, 1976, 2093, 2093], 70, 0.12, 'square', 0.03); break;      // свисток!
      case 'cooled': seq(g, [880, 1175], 60, 0.06, 'triangle', 0.03); break;
      case 'tap': if (rare('tap', 500)) seq(g, [1319, 988, 1319], 40, 0.04, 'triangle', 0.025); break;
      case 'boil': seq(g, [110, 147, 196, 262, 392], 25, 0.08, 'sawtooth', 0.045); break;
      case 'noCharge': if (rare('noc', 300)) g.audio.beep(120, 0.06, 'square', 0.03); break;
      case 'grab': seq(g, [660, 990], 30, 0.04, 'square', 0.03); break;
      case 'release': if (rare('rel', 100)) g.audio.beep(520, 0.05, 'triangle', 0.03); break;
      case 'sugar': if (rare('sug', 35)) { sugN = (sugN + 1) % 5; g.audio.beep([1047, 1175, 1319, 1397, 1568][sugN], 0.05, 'square', 0.022); } break;
      case 'leaf': seq(g, d.full ? [523, 784, 1047, 1319] : [659, 880], 50, 0.07, 'triangle', 0.035); break;
      case 'heart': seq(g, [523, 659, 784], 60, 0.07, 'square', 0.034); break;
      case 'life': seq(g, [659, 784, 1047, 784, 1047, 1319], 70, 0.08, 'square', 0.04); break;
      case 'kill': seq(g, [880, 660, 1320], 30, 0.05, 'square', 0.03); break;
      case 'enemyHit': if (rare('eh', 60)) g.audio.beep(330, 0.03, 'square', 0.02); break;
      case 'hop': if (rare('hop', 120)) g.audio.beep(700, 0.04, 'triangle', 0.02); break;
      case 'toast': if (rare('toast', 200)) seq(g, [180, 360], 40, 0.05, 'square', 0.03); break;
      case 'hurt': seq(g, [392, 262, 196], 40, 0.07, 'sawtooth', 0.04); break;
      case 'scald': seq(g, [1200, 1500, 1200], 40, 0.06, 'square', 0.035); break;
      case 'die':
        if (d.kind === 'boil') seq(g, [1568, 1760, 1976, 2349, 2637, 0, 196, 147], 70, 0.1, 'square', 0.035);
        else if (d.kind === 'crack') seq(g, [2093, 0, 1568, 1047, 523, 262], 60, 0.07, 'sawtooth', 0.04);
        else if (d.kind === 'magnet') seq(g, [196, 392, 784, 1568, 0, 2093], 50, 0.06, 'square', 0.035);
        else if (d.kind === 'fall') seq(g, [1568, 1397, 1245, 1109, 988, 880, 784, 698, 622], 80, 0.09, 'triangle', 0.035);
        else if (d.kind === 'cold') seq(g, [392, 349, 311, 262, 0, 131, 0, 131], 110, 0.14, 'triangle', 0.035);
        else if (d.kind === 'pop') seq(g, [90, 0, 1568, 1319, 1047, 784, 523], 60, 0.08, 'sawtooth', 0.04);
        else if (d.kind === 'woke') seq(g, [1568, 1319, 1568, 1319, 1568], 60, 0.06, 'square', 0.035);
        else seq(g, [494, 440, 392, 330, 262], 90, 0.1, 'square', 0.04);
        break;
      case 'cp': seq(g, [784, 988, 1175], 60, 0.08, 'triangle', 0.035); break;
      case 'demag': seq(g, [1568, 784, 392, 196], 50, 0.08, 'sawtooth', 0.035); break;
      case 'bubble': if (rare('bub', 400)) seq(g, [392, 523, 659], 40, 0.05, 'triangle', 0.03); break;
      case 'idle': if (d.stage === 1) seq(g, [1319, 1568, 1760, 1568, 1319, 1175], 140, 0.12, 'triangle', 0.03); else if (d.stage === 2) seq(g, [330, 0, 330, 0, 330], 120, 0.05, 'triangle', 0.02); else if (d.stage === 3) seq(g, [131, 0, 0, 123], 200, 0.25, 'triangle', 0.03); break;
      case 'clear': seq(g, [523, 659, 784, 1047, 784, 1047, 1319], 90, 0.1, 'square', 0.04); break;
      case 'count': g.audio.beep(d.n > 0 ? 660 : 1320, 0.12, 'square', 0.04); break;
      case 'crash': seq(g, [220, 110, 80], 40, 0.1, 'sawtooth', 0.045); break;
      case 'bumpCrumb': if (rare('crumb', 120)) g.audio.beep(160, 0.05, 'square', 0.03); break;
      case 'spoon': seq(g, [392, 523, 784, 1047], 30, 0.06, 'square', 0.035); break;
      case 'jam': if (rare('jam', 600)) seq(g, [130, 110], 80, 0.12, 'triangle', 0.03); break;
      case 'holeFall': seq(g, [880, 698, 523, 392], 70, 0.08, 'triangle', 0.035); break;
      case 'rivalTrip': seq(g, [262, 220], 60, 0.06, 'square', 0.025); break;
      case 'blast': seq(g, [196, 98], 40, 0.08, 'sawtooth', 0.04); break;
      case 'pz_step': if (rare('pzs', 60)) g.audio.beep(330, 0.03, 'triangle', 0.02); break;
      case 'pz_push': g.audio.beep(180, 0.06, 'square', 0.03); break;
      case 'pz_puff': seq(g, [1800, 2200], 25, 0.04, 'sawtooth', 0.012); break;
      case 'pz_blow': seq(g, [523, 784], 40, 0.05, 'triangle', 0.03); break;
      case 'pz_pick': seq(g, [523, 659, 523], 60, 0.06, 'triangle', 0.03); break;
      case 'pz_clockOff': seq(g, [1047, 784], 70, 0.07, 'square', 0.03); break;
      case 'pz_cool': seq(g, [1319, 988], 50, 0.05, 'triangle', 0.03); break;
      case 'pz_squash': g.audio.beep(110, 0.06, 'square', 0.025); break;
      case 'pzBump': if (rare('pzb', 150)) g.audio.beep(110, 0.04, 'square', 0.02); break;
      case 'pzHot': if (rare('pzh', 300)) seq(g, [1568, 1976], 50, 0.06, 'square', 0.025); break;
      case 'dive': if (rare('dive', 300)) g.audio.beep(600, 0.1, 'sawtooth', 0.02); break;
      case 'sting': if (rare('sting', 200)) g.audio.beep(1400, 0.04, 'square', 0.015); break;
      case 'swatter': seq(g, [147, 156, 147, 139], 160, 0.18, 'sawtooth', 0.04); break;
      case 'swatAim': g.audio.beep(98, 0.15, 'triangle', 0.035); break;
      case 'swat': seq(g, [80, 60], 30, 0.12, 'sawtooth', 0.05); break;
      case 'swatHit': if (rare('swh', 80)) g.audio.beep(260, 0.03, 'square', 0.02); break;
      case 'swatDown': seq(g, [196, 262, 330, 392, 523, 659, 784], 80, 0.12, 'square', 0.045); break;
      case 'ting': if (rare('ting', 70)) g.audio.beep(2637, 0.03, 'triangle', 0.015); break;
      case 'crack': seq(g, [2093, 1568, 2349], 40, 0.06, 'square', 0.04); break;
      case 'shield': seq(g, [880, 880], 60, 0.05, 'triangle', 0.03); break;
      case 'shatter': seq(g, [2637, 2349, 2093, 1760, 1568, 1319, 1047], 45, 0.07, 'square', 0.04); break;
      case 'lob': if (rare('lob', 300)) seq(g, [330, 440], 40, 0.05, 'square', 0.025); break;
      case 'squirt': if (rare('sq', 300)) seq(g, [220, 330, 440], 40, 0.05, 'triangle', 0.03); break;
      case 'spit': if (rare('spit', 300)) g.audio.beep(300, 0.08, 'sawtooth', 0.025); break;
      case 'slam': seq(g, [90, 70], 40, 0.12, 'sawtooth', 0.05); break;
      case 'stage2': seq(g, [196, 185, 175, 165], 120, 0.15, 'sawtooth', 0.04); break;
      case 'lidOut': seq(g, [784, 988, 1175, 1568], 70, 0.09, 'triangle', 0.04); break;
      case 'lid': seq(g, [1047, 1319, 1568, 2093, 1568, 2093], 80, 0.1, 'square', 0.045); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
