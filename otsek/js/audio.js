/* ОТСЕК · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   OTSEK.sfx(g, type, data) — вызывается из main.js на события логики; частые звуки прорежены. */
(function (global) {
  'use strict';
  var G = global.OTSEK = global.OTSEK || {};
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
        if (d.w === 'flame') { if (throttle('fl' + d.pi, 90)) g.audio.beep(80 + Math.random() * 40, 0.07, 'sawtooth', 0.02); }
        else if (d.w === 'cutter') g.audio.beep(1900, 0.06, 'sawtooth', 0.025);
        else if (d.w === 'fan') g.audio.beep(180, 0.06, 'square', 0.035);
        else if (throttle('sh' + d.pi, 60)) g.audio.beep(d.w === 'nail' ? 1240 : d.pi ? 760 : 680, 0.03, 'square', 0.018);
        break;
      case 'swing': g.audio.beep(140, 0.05, 'triangle', 0.03); break;
      case 'empty': seq(g, [300, 200], 60, 0.05, 'square', 0.03); break;
      case 'hit': if (throttle('hit', 45)) g.audio.beep(420, 0.02, 'square', 0.018); break;
      case 'wallHit': if (throttle('wh', 70)) g.audio.beep(1600, 0.012, 'triangle', 0.01); break;
      case 'kill': if (throttle('kl', 40)) g.audio.beep(d.type === 'nest' ? 70 : d.type === 'carpet' ? 110 : 240 + Math.random() * 80, d.type === 'nest' ? 0.25 : 0.06, 'sawtooth', 0.035); break;
      case 'heroHurt': if (throttle('hh' + d.pi, 160)) g.audio.beep(120, 0.08, 'square', 0.05); break;
      case 'heroDie': seq(g, [440, 330, 247, 185, 139], 80, 0.12, 'sawtooth', 0.06); break;
      case 'respawn': seq(g, [330, 440, 554], 60, 0.07, 'triangle', 0.05); break;
      case 'card': seq(g, [988, 1319, 1568], 55, 0.06, 'square', 0.04); break;
      case 'pickup': g.audio.beep(d.kind === 'tok' ? 1568 : d.kind === 'med' ? 784 : 1046, 0.05, 'square', 0.03); break;
      case 'door': seq(g, [90, 120, 160, 220], 70, 0.12, 'sawtooth', 0.05); break;
      case 'doorDenied': if (throttle('dd', 300)) seq(g, [196, 147], 110, 0.1, 'square', 0.05); break;
      case 'term': seq(g, [1318, 1760], 50, 0.04, 'square', 0.03); break;
      case 'termMove': g.audio.beep(1200, 0.02, 'square', 0.02); break;
      case 'termClose': g.audio.beep(880, 0.03, 'square', 0.02); break;
      case 'buy': seq(g, [784, 1046, 1318], 50, 0.05, 'square', 0.04); break;
      case 'noBuy': seq(g, [220, 196], 70, 0.06, 'square', 0.035); break;
      case 'swap': g.audio.beep(600, 0.03, 'triangle', 0.03); break;
      case 'breach': seq(g, [2400, 1800, 900], 40, 0.05, 'sawtooth', 0.035); break;
      case 'spark': if (throttle('sp', 90)) g.audio.beep(520, 0.04, 'triangle', 0.022); break;
      case 'sparkWarn': if (throttle('sw', 220)) g.audio.beep(1500, 0.03, 'sine', 0.02); break;
      case 'spawn': if (throttle('spn', 300)) g.audio.beep(95, 0.12, 'sawtooth', 0.03); break;
      case 'vent': if (throttle('vt', 600)) g.audio.beep(60, 0.18, 'triangle', 0.03); break;
      case 'wake': if (throttle('wk', 700)) g.audio.beep(140, 0.05, 'sawtooth', 0.018); break;
      case 'console': seq(g, [220, 277, 330, 440], 120, 0.14, 'square', 0.06); break;
      case 'alarm': seq(g, [880, 660, 880, 660], 220, 0.18, 'square', 0.05); break;
      case 'countdown': g.audio.beep(d.s <= 3 ? 1320 : 990, 0.07, 'square', 0.04); break;
      case 'clear': seq(g, [392, 523, 659, 784, 1046], 90, 0.1, 'square', 0.05); break;
      case 'blast': seq(g, [110, 82, 65, 49], 120, 0.3, 'sawtooth', 0.08); break;
      case 'deck': seq(g, [294, 349, 440], 120, 0.12, 'triangle', 0.05); break;
      case 'bossIntro': seq(g, [98, 104, 98, 87, 73], 170, 0.22, 'sawtooth', 0.06); break;
      case 'armor': if (throttle('ar', 90)) g.audio.beep(1800, 0.02, 'triangle', 0.018); break;
      case 'bossHit': if (throttle('bh', 80)) g.audio.beep(170, 0.03, 'square', 0.035); break;
      case 'ring': if (throttle('rg', 300)) seq(g, [400, 300], 50, 0.06, 'triangle', 0.04); break;
      case 'heartOpen': seq(g, [147, 196], 90, 0.1, 'sawtooth', 0.04); break;
      case 'bossDie': seq(g, [196, 165, 131, 110, 87, 73, 55], 110, 0.2, 'sawtooth', 0.08); break;
      case 'out': seq(g, [262, 196, 131], 140, 0.15, 'triangle', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
