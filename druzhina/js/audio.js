/* ДРУЖИНА · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   DRUZHINA.sfx(g, type, data) — вызывается из main.js на события логики. */
(function (global) {
  'use strict';
  var D = global.DRUZHINA = global.DRUZHINA || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function throttle(k, ms) { var n = Date.now(); if (n - (last[k] || 0) < ms) return false; last[k] = n; return true; }
  var SWING = { zhdan: [150, 0.07, 'sawtooth', 0.04], secha: [620, 0.035, 'triangle', 0.035], olha: [420, 0.045, 'triangle', 0.035] };
  D.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'swing': { var s = SWING[d.hero] || SWING.secha; if (throttle('sw' + d.pi, 50)) g.audio.beep(s[0] * (d.air ? 1.2 : 1), s[1], s[2], s[3]); break; }
      case 'hit': if (throttle('hit', 35)) { g.audio.beep(d.kind === 'boss' ? 110 : 180 + Math.random() * 40, 0.06, 'square', 0.06); g.audio.beep(900, 0.02, 'square', 0.03); } break;
      case 'block': if (throttle('bl', 60)) g.audio.beep(1300, 0.05, 'square', 0.04); break;
      case 'heroHit': if (throttle('hh', 60)) seq(g, [240, 160], 40, 0.07, 'sawtooth', 0.06); break;
      case 'kill': if (throttle('kl', 40)) seq(g, [300, 200, 130], 45, 0.08, 'sawtooth', 0.05); break;
      case 'thud': if (throttle('th', 60)) g.audio.beep(d.big ? 60 : 80, 0.12, 'triangle', 0.08); break;
      case 'jump': if (throttle('j' + d.pi, 80)) g.audio.beep(330, 0.06, 'triangle', 0.035); break;
      case 'grab': g.audio.beep(260, 0.05, 'square', 0.04); break;
      case 'toss': seq(g, [220, 330], 50, 0.07, 'triangle', 0.05); break;
      case 'back': seq(g, [500, 700, 500], 30, 0.05, 'square', 0.04); break;
      case 'arrow': g.audio.beep(1100, 0.04, 'triangle', 0.03); break;
      case 'magic': seq(g, d.kind === 'forge' ? [131, 165, 196, 262] : d.kind === 'whirl' ? [523, 659, 784, 1047] : [294, 370, 440, 587], 70, 0.12, 'square', 0.05); break;
      case 'spell': seq(g, d.kind === 'forge' ? [98, 82, 65] : d.kind === 'whirl' ? [1568, 1319, 1047] : [196, 247, 294], 60, 0.16, 'sawtooth', 0.06); break;
      case 'noMagic': g.audio.beep(140, 0.08, 'square', 0.03); break;
      case 'drop': if (throttle('dr', 60)) seq(g, [880, 1175], 40, 0.05, 'square', 0.035); break;
      case 'pickup': seq(g, d.kind === 'jug' ? [784, 988, 1319] : [523, 659, 784], 50, 0.06, 'square', 0.04); break;
      case 'mount': case 'foeMount': seq(g, [196, 262, 330], 50, 0.07, 'square', 0.045); break;
      case 'knockOff': case 'dismount': seq(g, [330, 220], 50, 0.07, 'triangle', 0.045); break;
      case 'breath': seq(g, [90, 110, 90, 120], 80, 0.12, 'sawtooth', 0.04); break;
      case 'tail': g.audio.beep(120, 0.1, 'sawtooth', 0.05); break;
      case 'leap': g.audio.beep(520, 0.06, 'triangle', 0.035); break;
      case 'heroDie': seq(g, [392, 330, 262, 196, 131], 90, 0.12, 'sawtooth', 0.06); break;
      case 'respawn': seq(g, [392, 523, 659], 60, 0.07, 'triangle', 0.05); break;
      case 'wave': case 'imp': break;
      case 'go': seq(g, [659, 784], 80, 0.08, 'square', 0.04); break;
      case 'boss': seq(g, [110, 117, 110, 98], 170, 0.22, 'sawtooth', 0.06); break;
      case 'bossWind': if (throttle('bw', 120)) g.audio.beep(d.move === 'charge' ? 180 : 240, 0.1, 'square', 0.035); break;
      case 'bossAct': if (d.move === 'slam') seq(g, [70, 55], 60, 0.2, 'sawtooth', 0.08); else if (d.move === 'charge') g.audio.beep(140, 0.3, 'sawtooth', 0.05); else if (d.move === 'pour') seq(g, [600, 500, 400], 60, 0.06, 'triangle', 0.04); break;
      case 'phase': seq(g, [220, 208, 196, 185], 70, 0.1, 'sawtooth', 0.06); break;
      case 'bossDie': seq(g, [196, 165, 131, 110, 87, 73, 55], 110, 0.18, 'sawtooth', 0.08); break;
      case 'clear': seq(g, [392, 523, 659, 784, 659, 784, 1047], 90, 0.1, 'square', 0.05); break;
      case 'stage': seq(g, [262, 330, 392], 90, 0.1, 'triangle', 0.05); break;
      case 'bonus': seq(g, [523, 392, 330, 262], 120, 0.12, 'triangle', 0.04); break;
      case 'extraLife': seq(g, [784, 988, 1175, 1568], 70, 0.08, 'square', 0.05); break;
      case 'continueAsk': seq(g, [330, 294, 262], 160, 0.15, 'triangle', 0.05); break;
      case 'continue': seq(g, [262, 392, 523], 70, 0.08, 'square', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
