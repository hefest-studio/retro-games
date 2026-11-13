/* ПАРОВИКИ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   PAROVIKI.sfx(g, type, data) — вызывается из main.js на события логики; частые звуки прорежены. */
(function (global) {
  'use strict';
  var PV = global.PAROVIKI = global.PAROVIKI || {};
  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var last = {};
  function throttle(k, ms) { var n = Date.now(); if (n - (last[k] || 0) < ms) return false; last[k] = n; return true; }
  var GUN = { rivet: [900, 0.025, 'square', 0.014], steam: [180, 0.07, 'sawtooth', 0.03], saw: [1250, 0.03, 'triangle', 0.02], bolt: [1500, 0.03, 'square', 0.013] };

  PV.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'shot': { var s = GUN[d.gun] || GUN.rivet; if (throttle('sh' + d.pi, 80)) g.audio.beep(s[0] * (d.pi ? 1.06 : 1), s[1], s[2], s[3]); break; }
      case 'hit': if (throttle('hit', 50)) g.audio.beep(520, 0.02, 'square', 0.018); break;
      case 'chip': if (throttle('chip', 90)) g.audio.beep(300, 0.02, 'square', 0.015); break;
      case 'bounce': if (throttle('bo', 70)) g.audio.beep(1400, 0.02, 'triangle', 0.014); break;
      case 'block': if (throttle('blk', 80)) g.audio.beep(1700, 0.02, 'triangle', 0.02); break;
      case 'kill': if (throttle('kl', 30)) g.audio.beep(d.type === 'nest' ? 70 : d.type === 'heavy' ? 90 : 260 + Math.random() * 140, d.type === 'nest' ? 0.3 : 0.07, 'sawtooth', 0.035); break;
      case 'boom': if (throttle('bm', 60)) seq(g, [140, 85], 40, 0.13, 'sawtooth', 0.05); break;
      case 'spawn': if (throttle('sp', 200)) g.audio.beep(220, 0.05, 'triangle', 0.02); break;
      case 'eshot': if (throttle('es', 90)) g.audio.beep(440, 0.04, 'triangle', 0.022); break;
      case 'hurt': if (throttle('hu' + d.pi, 120)) g.audio.beep(150, 0.08, 'square', 0.04); break;
      case 'coin': if (throttle('co', 40)) seq(g, [1318, 1760], 45, 0.04, 'square', 0.03); break;
      case 'chest': seq(g, [784, 988, 1318, 1568], 60, 0.06, 'square', 0.04); break;
      case 'food': seq(g, [523, 784], 70, 0.07, 'triangle', 0.04); break;
      case 'key': seq(g, [1046, 1318, 1568], 60, 0.06, 'square', 0.04); break;
      case 'charge': seq(g, [880, 1174, 1568], 60, 0.06, 'triangle', 0.04); break;
      case 'lever': seq(g, [200, 160], 90, 0.1, 'square', 0.05); break;
      case 'open': seq(g, [150, 200, 260], 70, 0.1, 'sawtooth', 0.04); break;
      case 'secret': seq(g, [523, 659, 784, 1046, 1318], 70, 0.07, 'square', 0.045); break;
      case 'crate': if (throttle('cr', 80)) g.audio.beep(160, 0.06, 'square', 0.035); break;
      case 'valve': seq(g, [330, 440, 554, 659], 70, 0.08, 'square', 0.045); setTimeout(function () { g.audio.beep(90, 0.4, 'sawtooth', 0.02); }, 300); break;
      case 'exitOpen': seq(g, [392, 523, 659, 784, 1046], 90, 0.1, 'triangle', 0.05); break;
      case 'warp': seq(g, [700, 1100, 1500], 35, 0.04, 'triangle', 0.03); break;
      case 'heroDie': seq(g, [523, 392, 294, 196, 131], 80, 0.12, 'sawtooth', 0.05); break;
      case 'respawn': case 'revive': seq(g, [392, 523, 659], 60, 0.07, 'triangle', 0.045); break;
      case 'special':
        if (d.kind === 'bomb') seq(g, [110, 70, 50], 70, 0.25, 'sawtooth', 0.08);
        else if (d.kind === 'heal') seq(g, [523, 659, 784, 1046], 60, 0.08, 'triangle', 0.05);
        else if (d.kind === 'shield') seq(g, [1046, 1318, 1046, 1318], 50, 0.06, 'triangle', 0.04);
        else seq(g, [880, 660, 880, 1320], 70, 0.07, 'square', 0.04);
        break;
      case 'windup': seq(g, [110, 130, 150, 170], 120, 0.1, 'square', 0.035); break;
      case 'charge': g.audio.beep(65, 0.35, 'sawtooth', 0.06); break;
      case 'thud': if (throttle('th', 120)) g.audio.beep(55, 0.2, 'square', 0.06); break;
      case 'drop': g.audio.beep(330, 0.12, 'triangle', 0.035); break;
      case 'bossHit': if (throttle('bh', 80)) g.audio.beep(190, 0.03, 'square', 0.03); break;
      case 'armorDown': seq(g, [220, 277, 330, 440], 90, 0.12, 'square', 0.055); break;
      case 'bossDie': seq(g, [196, 165, 131, 110, 87, 73, 55], 110, 0.18, 'sawtooth', 0.07); break;
      case 'levelDone': seq(g, [392, 523, 659, 784, 659, 784, 1046], 90, 0.1, 'square', 0.05); break;
      case 'buy': seq(g, [988, 1318], 60, 0.06, 'square', 0.045); break;
      case 'contAsk': seq(g, [440, 330], 120, 0.12, 'triangle', 0.05); break;
      case 'continue': seq(g, [330, 440, 587], 70, 0.08, 'square', 0.05); break;
      case 'level': seq(g, [294, 392, 440, 587], 100, 0.1, 'triangle', 0.045); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
