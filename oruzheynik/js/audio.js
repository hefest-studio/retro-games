/* ОРУЖЕЙНИК · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   ORUZH.sfx(g, type, data) — вызывается из main.js на события логики; частые события прорежены. */
(function (global) {
  'use strict';
  var OZ = global.ORUZH = global.ORUZH || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function rare(type, ms) { var n = Date.now(); if (n - (last[type] || 0) < ms) return false; last[type] = n; return true; }
  var SHOT = { spark: [880, 'square'], boomer: [330, 'sawtooth'], gear: [520, 'square'], mine: [196, 'square'], fan: [700, 'sawtooth'],
    frost: [1320, 'triangle'], harpoon: [440, 'sawtooth'], chain: [1760, 'square'], smoke: [150, 'sawtooth'] };
  OZ.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'jump': if (rare('jump', 80)) g.audio.beep(300, 0.06, 'triangle', 0.035); break;
      case 'land': if (rare('land', 120)) g.audio.beep(110, 0.04, 'square', 0.025); break;
      case 'slide': seq(g, [200, 160], 30, 0.05, 'sawtooth', 0.03); break;
      case 'shot': {
        var s = SHOT[d.k] || SHOT.spark;
        if (d.k === 'chain' && !rare('chain', 70)) break;
        if (d.lv === 2) seq(g, [660, 990, 1320], 25, 0.07, 'square', 0.05);
        else if (d.lv === 1) seq(g, [660, 990], 25, 0.06, 'square', 0.045);
        else if (rare('shot', 40)) g.audio.beep(s[0], 0.05, s[1], 0.035);
        break;
      }
      case 'charge': g.audio.beep(d.lv === 2 ? 1175 : 784, 0.06, 'triangle', 0.035); break;
      case 'noEnergy': if (rare('ne', 300)) g.audio.beep(140, 0.08, 'square', 0.04); break;
      case 'tink': if (rare('tink', 60)) g.audio.beep(2093, 0.03, 'square', 0.03); break;
      case 'hit': if (rare('hit', 50)) g.audio.beep(260, 0.04, 'square', 0.035); break;
      case 'kill': seq(g, [523, 330, 196], 40, 0.05, 'square', 0.04); break;
      case 'hurt': seq(g, [330, 220, 165], 40, 0.06, 'sawtooth', 0.05); break;
      case 'die': seq(g, [523, 440, 349, 262, 196, 131], 90, 0.12, 'square', 0.055); break;
      case 'pickup': if (d.k === 'tank' || d.k === 'life') seq(g, [523, 659, 784, 1046], 60, 0.07, 'triangle', 0.05); else if (rare('pk', 80)) seq(g, [784, 1046], 40, 0.05, 'triangle', 0.04); break;
      case 'tank': seq(g, [392, 494, 587, 784, 988], 70, 0.08, 'triangle', 0.05); break;
      case 'weapon': g.audio.beep(660, 0.05, 'triangle', 0.035); break;
      case 'checkpoint': seq(g, [587, 880], 70, 0.06, 'triangle', 0.035); break;
      case 'eshot': if (rare('es', 140)) g.audio.beep(420, 0.04, 'triangle', 0.02); break;
      case 'hop': if (rare('hop', 150)) g.audio.beep(d.big ? 120 : 180, 0.06, 'square', 0.03); break;
      case 'stomp': case 'crash': seq(g, [90, 60], 50, 0.09, 'sawtooth', 0.05); break;
      case 'dash': seq(g, [220, 330, 440], 30, 0.05, 'sawtooth', 0.035); break;
      case 'dive': seq(g, [880, 660, 440], 40, 0.05, 'square', 0.035); break;
      case 'gust': seq(g, [150, 180, 210, 240], 50, 0.07, 'sawtooth', 0.03); break;
      case 'sizzle': if (rare('sz', 160)) g.audio.beep(1800, 0.05, 'sawtooth', 0.02); break;
      case 'clang': if (rare('cl', 90)) g.audio.beep(1568, 0.03, 'square', 0.025); break;
      case 'dong': seq(g, d.big ? [196, 98] : [392, 294], 60, 0.18, 'triangle', 0.05); break;
      case 'pour': seq(g, [262, 247, 233], 60, 0.07, 'sawtooth', 0.035); break;
      case 'gateOpen': seq(g, [196, 262, 330, 392], 70, 0.07, 'square', 0.04); break;
      case 'miniIntro': seq(g, [147, 147, 196], 120, 0.1, 'sawtooth', 0.045); break;
      case 'bossIntro': seq(g, [196, 0, 196, 0, 233, 262, 294], 90, 0.09, 'square', 0.045); break;
      case 'bossHit': if (d.weak) seq(g, [988, 740, 494], 30, 0.05, 'square', 0.05); else if (rare('bh', 60)) g.audio.beep(330, 0.05, 'square', 0.04); break;
      case 'bossDie': seq(g, [784, 659, 523, 392, 330, 262, 196, 131], 80, 0.12, 'sawtooth', 0.05); break;
      case 'got': seq(g, [392, 523, 659, 784, 659, 784, 1046], 110, 0.13, 'triangle', 0.06); break;
      case 'clear': seq(g, [523, 659, 784, 1046], 100, 0.12, 'triangle', 0.05); break;
      case 'stage': seq(g, [294, 440, 587], 90, 0.09, 'triangle', 0.04); break;
      case 'select': break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
