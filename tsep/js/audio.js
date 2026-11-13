/* ЦЕПЬ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   TSEP.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены.
   Удар цепью — низкий «свист» замаха и звонкий «дзынь» гири; искры — стеклянный перезвон; часы — тиканье. */
(function (global) {
  'use strict';
  var T = global.TSEP = global.TSEP || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  var SUBS = { key: [880, 'square'], flask: [330, 'triangle'], gear: [660, 'square'], spring: [523, 'triangle'], stopper: [1046, 'triangle'] };
  T.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': if (rare('jump', 80)) g.audio.beep(300, 0.06, 'triangle', 0.03); break;
      case 'land': if (rare('land', 120)) g.audio.beep(120, 0.04, 'square', 0.02); break;
      case 'thud': g.audio.beep(80, 0.08, 'square', 0.04); break;
      case 'swing': seq(g, [140, 180, 0, 0, 0], 40, 0.05, 'sawtooth', 0.03); break;
      case 'hit': if (rare('hit', 50)) seq(g, [1568, 784], 20, 0.04, 'square', 0.04); break;
      case 'lamp': seq(g, [1760, 2093, 2637], 35, 0.05, 'triangle', 0.035); break;
      case 'clank': if (rare('clk', 60)) g.audio.beep(1318, 0.04, 'square', 0.03); break;
      case 'kill': seq(g, [523, 392, 262], 40, 0.05, 'square', 0.04); break;
      case 'hurt': seq(g, [220, 165, 110], 40, 0.07, 'sawtooth', 0.05); break;
      case 'die': seq(g, [494, 440, 392, 330, 294, 247, 196], 90, 0.12, 'square', 0.05); break;
      case 'sub': { var s = SUBS[d.k] || SUBS.key; seq(g, [s[0], s[0] * 1.25], 30, 0.05, s[1], 0.035); break; }
      case 'nosparks': g.audio.beep(110, 0.08, 'square', 0.03); break;
      case 'freeze': seq(g, [1318, 1046, 784, 1046, 1318], 60, 0.07, 'triangle', 0.045); break;
      case 'catch': g.audio.beep(988, 0.04, 'triangle', 0.03); break;
      case 'flame': if (rare('fl', 120)) g.audio.beep(150, 0.1, 'sawtooth', 0.03); break;
      case 'pickup': if (d.k === 'spark' || d.k === 'spark5') seq(g, [1318, 1760], 40, 0.05, 'triangle', 0.035); else if (d.k === 'core') seq(g, [523, 659, 784, 1046, 1318, 1568], 70, 0.09, 'triangle', 0.055); else seq(g, [659, 880, 1046], 50, 0.06, 'triangle', 0.04); break;
      case 'chain': seq(g, [392, 523, 659, 784, 1046], 60, 0.08, 'square', 0.045); break;
      case 'life': seq(g, [659, 784, 988, 1318], 70, 0.08, 'triangle', 0.05); break;
      case 'checkpoint': seq(g, [784, 0, 784, 1046], 70, 0.06, 'triangle', 0.04); break;
      case 'stair': if (rare('st', 300)) g.audio.beep(200, 0.03, 'square', 0.02); break;
      case 'boing': if (rare('bo', 150)) seq(g, [220, 440], 40, 0.05, 'triangle', 0.03); break;
      case 'lob': if (rare('lob', 150)) g.audio.beep(180, 0.06, 'sawtooth', 0.03); break;
      case 'ready': if (rare('rd', 200)) seq(g, [988, 988], 70, 0.04, 'square', 0.03); break;
      case 'jab': g.audio.beep(330, 0.05, 'square', 0.035); break;
      case 'dive': seq(g, [900, 700, 500], 40, 0.04, 'square', 0.03); break;
      case 'flutter': if (rare('ft', 400)) seq(g, [1200, 1400, 1200], 30, 0.03, 'square', 0.02); break;
      case 'swoop': seq(g, [700, 900, 1100, 900], 50, 0.06, 'square', 0.04); break;
      case 'egg': case 'nut': case 'gearDrop': if (rare('drop', 120)) seq(g, [660, 440], 40, 0.05, 'square', 0.035); break;
      case 'crack': if (rare('cr', 80)) g.audio.beep(240, 0.05, 'sawtooth', 0.035); break;
      case 'sweep': seq(g, [220, 233, 247, 262], 80, 0.1, 'sawtooth', 0.045); break;
      case 'hop': seq(g, [150, 300], 50, 0.07, 'triangle', 0.04); break;
      case 'stomp': seq(g, [90, 60], 50, 0.1, 'sawtooth', 0.05); break;
      case 'breath': if (rare('br', 120)) g.audio.beep(200, 0.12, 'sawtooth', 0.035); break;
      case 'blow': seq(g, [120, 110, 100, 90], 90, 0.12, 'sawtooth', 0.04); break;
      case 'leap': seq(g, [196, 262, 330], 50, 0.07, 'square', 0.04); break;
      case 'strike': g.audio.beep(1046, 0.05, 'square', 0.04); break;
      case 'ring': seq(g, [1318, 1318, 988], 90, 0.18, 'triangle', 0.05); break;
      case 'dart': if (rare('dt', 120)) seq(g, [1568, 1175], 30, 0.04, 'square', 0.03); break;
      case 'bossIntro': seq(g, [196, 0, 196, 0, 233, 262, 294], 90, 0.09, 'square', 0.045); break;
      case 'bossHit': if (rare('bh', 60)) seq(g, [392, 1568], 25, 0.05, 'square', 0.04); break;
      case 'bossDie': seq(g, [784, 659, 523, 392, 330, 262, 196, 131], 80, 0.12, 'sawtooth', 0.05); break;
      case 'branch': seq(g, [523, 659, 523, 784], 110, 0.1, 'triangle', 0.045); break;
      case 'clear': seq(g, [392, 523, 659, 784, 659, 784, 1046], 110, 0.13, 'triangle', 0.06); break;
      case 'level': seq(g, [294, 440, 587], 90, 0.09, 'triangle', 0.04); break;
      case 'win': seq(g, [523, 659, 784, 1046, 784, 1046, 1318, 1568], 120, 0.15, 'triangle', 0.06); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
