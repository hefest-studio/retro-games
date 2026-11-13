/* ГОРНИЛО · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   GORNILO.sfx(g, type, data) — вызывается из main.js на события логики; частые звуки прорежены. */
(function (global) {
  'use strict';
  var G = global.GORNILO = global.GORNILO || {};
  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var last = {};
  function throttle(k, ms) { var n = Date.now(); if (n - (last[k] || 0) < ms) return false; last[k] = n; return true; }

  G.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'shot':
        if (d.w === 'flame') { if (throttle('fl' + d.pi, 90)) g.audio.beep(90 + Math.random() * 40, 0.06, 'sawtooth', 0.02); }
        else if (throttle('sh' + d.pi, 85)) g.audio.beep(d.w === 'grenade' ? 260 : d.w === 'disc' ? 1180 : d.pi ? 960 : 880, 0.03, 'square', 0.016);
        break;
      case 'hit': if (throttle('hit', 50)) g.audio.beep(520, 0.02, 'square', 0.02); break;
      case 'shove': g.audio.beep(160, 0.06, 'square', 0.04); break;
      case 'block': if (throttle('blk', 80)) g.audio.beep(1500, 0.02, 'triangle', 0.02); break;
      case 'armor': if (throttle('arm', 90)) g.audio.beep(1700, 0.02, 'triangle', 0.018); break;
      case 'kill': if (throttle('kl', 30)) g.audio.beep(d.type === 'roller' ? 70 : d.type === 'turret' ? 140 : 300 + Math.random() * 120, d.type === 'roller' ? 0.25 : 0.06, 'sawtooth', 0.035); break;
      case 'boom': if (throttle('bm', 60)) seq(g, [130, 80], 40, 0.14, 'sawtooth', 0.06); break;
      case 'fuse': if (throttle('fu', 120)) seq(g, [1400, 1700], 50, 0.03, 'square', 0.025); break;
      case 'eshot': if (throttle('es', 90)) g.audio.beep(420, 0.04, 'triangle', 0.025); break;
      case 'windup': seq(g, [110, 130, 150, 170], 120, 0.1, 'square', 0.035); break;
      case 'charge': g.audio.beep(65, 0.35, 'sawtooth', 0.06); break;
      case 'thud': if (throttle('th', 120)) g.audio.beep(55, 0.18, 'square', 0.06); break;
      case 'bounce': if (throttle('bo', 70)) g.audio.beep(1300, 0.02, 'triangle', 0.015); break;
      case 'power': seq(g, [523, 659, 784, 1047], 55, 0.07, 'square', 0.045); break;
      case 'powerEnd': seq(g, [523, 392], 70, 0.06, 'triangle', 0.035); break;
      case 'gold': g.audio.beep(1568, 0.06, 'square', 0.035); break;
      case 'extraLife': seq(g, [784, 988, 1175, 1568], 70, 0.08, 'square', 0.05); break;
      case 'heroDie': seq(g, [523, 392, 294, 196, 131], 80, 0.12, 'sawtooth', 0.06); break;
      case 'respawn': seq(g, [392, 523, 659], 60, 0.07, 'triangle', 0.05); break;
      case 'wave': seq(g, [330, 392], 90, 0.08, 'square', 0.04); break;
      case 'roomClear': seq(g, [392, 523, 659, 784], 80, 0.09, 'square', 0.05); break;
      case 'exit': seq(g, [659, 784, 988], 60, 0.07, 'triangle', 0.045); break;
      case 'stage': seq(g, [294, 349, 440, 587], 100, 0.1, 'triangle', 0.05); break;
      case 'bossIntro': seq(g, [110, 117, 110, 98, 82], 170, 0.2, 'sawtooth', 0.06); break;
      case 'bossHit': if (throttle('bh', 80)) g.audio.beep(180, 0.03, 'square', 0.035); break;
      case 'partDie': seq(g, [200, 150, 100, 70], 60, 0.12, 'sawtooth', 0.07); break;
      case 'coreOpen': seq(g, [220, 277, 330, 440], 90, 0.12, 'square', 0.06); break;
      case 'slamWarn': if (throttle('sw', 200)) g.audio.beep(240, 0.12, 'triangle', 0.04); break;
      case 'slam': if (throttle('sl', 100)) g.audio.beep(50, 0.25, 'square', 0.08); break;
      case 'bellows': seq(g, [90, 80, 70], 80, 0.12, 'sawtooth', 0.04); break;
      case 'ring': if (throttle('rg', 200)) seq(g, [600, 450], 40, 0.05, 'triangle', 0.035); break;
      case 'bossDie': seq(g, [196, 165, 131, 110, 87, 73, 55], 110, 0.18, 'sawtooth', 0.08); break;
      case 'clear': seq(g, [392, 523, 659, 784, 659, 784, 1047], 90, 0.1, 'square', 0.05); break;
      case 'contAsk': seq(g, [440, 330], 120, 0.12, 'triangle', 0.05); break;
      case 'continue': seq(g, [330, 440, 587], 70, 0.08, 'square', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
