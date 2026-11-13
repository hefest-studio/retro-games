/* ДОЗОР · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   DOZOR.sfx(g, type, data) — вызывается из main.js на события логики. */
(function (global) {
  'use strict';
  var D = global.DOZOR = global.DOZOR || {};
  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var last = {};
  function throttle(k, ms) { var n = Date.now(); if (n - (last[k] || 0) < ms) return false; last[k] = n; return true; }

  D.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'mg': if (throttle('mg' + d.pi, 70)) g.audio.beep(d.pi ? 820 : 760, 0.025, 'square', 0.018); break;
      case 'sec': if (d.tier === 1) g.audio.beep(330, 0.06, 'triangle', 0.045); else seq(g, [220, 440], 30, 0.05, 'sawtooth', 0.035); break;
      case 'hit': if (throttle('hit', 45)) g.audio.beep(540, 0.025, 'square', 0.025); break;
      case 'wall': if (throttle('wl', 110)) g.audio.beep(250, 0.02, 'triangle', 0.015); break;
      case 'boom': if (throttle('bm', 55)) seq(g, d.enemy ? [140, 90] : [120, 75], 40, d.r > 32 ? 0.2 : 0.13, 'sawtooth', 0.065); break;
      case 'block': if (throttle('bl', 80)) seq(g, [170, 110], 45, 0.08, 'sawtooth', 0.05); break;
      case 'kill': if (throttle('kl', 35)) g.audio.beep(d.type === 'tank' || d.type === 'car' ? 85 : d.type === 'heli' ? 180 : 420, 0.1, 'sawtooth', 0.045); break;
      case 'squash': g.audio.beep(160, 0.06, 'square', 0.05); break;
      case 'eshot': if (throttle('es', 70)) g.audio.beep(d.kind === 'shell' ? 140 : 620, 0.04, 'triangle', 0.022); break;
      case 'barracksHit': if (throttle('bh', 70)) g.audio.beep(190, 0.04, 'square', 0.04); break;
      case 'barracks': seq(g, [196, 147, 110, 659, 784], 60, 0.1, 'sawtooth', 0.06); break;
      case 'pow': seq(g, d.master ? [659, 880, 1175] : [880, 1175], 50, 0.06, 'square', 0.04); break;
      case 'upgrade': seq(g, [523, 659, 784, 1047, 1319], 70, 0.08, 'square', 0.05); break;
      case 'deliver': g.audio.beep(988 + (8 - (d.left || 0)) * 40, 0.06, 'square', 0.04); break;
      case 'scatter': seq(g, [880, 660, 440], 60, 0.07, 'triangle', 0.045); break;
      case 'powLost': g.audio.beep(300, 0.08, 'triangle', 0.03); break;
      case 'heroDie': seq(g, [523, 392, 294, 196, 131], 80, 0.12, 'sawtooth', 0.06); break;
      case 'respawn': seq(g, [392, 523, 659], 60, 0.07, 'triangle', 0.05); break;
      case 'extraLife': seq(g, [784, 988, 1175, 1568], 70, 0.08, 'square', 0.05); break;
      case 'trainWarn': seq(g, [880, 660, 880, 660], 160, 0.1, 'square', 0.04); break;
      case 'train': seq(g, [110, 98, 110, 98], 120, 0.12, 'sawtooth', 0.05); break;
      case 'heli': seq(g, [300, 320, 300, 320], 60, 0.04, 'square', 0.03); break;
      case 'bossIntro': seq(g, [110, 117, 110, 98], 160, 0.2, 'sawtooth', 0.06); break;
      case 'bossHit': if (throttle('bsh', 80)) g.audio.beep(120, 0.04, 'square', 0.045); break;
      case 'phase': seq(g, [220, 208, 196, 185], 70, 0.1, 'sawtooth', 0.06); break;
      case 'mortar': seq(g, [700, 500], 70, 0.06, 'triangle', 0.04); break;
      case 'bossBoom': if (throttle('bb', 160)) g.audio.beep(60 + Math.random() * 40, 0.2, 'sawtooth', 0.07); break;
      case 'bossDie': seq(g, [196, 165, 131, 110, 87, 73, 55], 110, 0.18, 'sawtooth', 0.08); break;
      case 'clear': seq(g, [392, 523, 659, 784, 659, 784, 1047], 90, 0.1, 'square', 0.05); break;
      case 'stage': seq(g, [294, 349, 440], 90, 0.1, 'triangle', 0.05); break;
      case 'contAsk': seq(g, [440, 330], 120, 0.12, 'triangle', 0.05); break;
      case 'continue': seq(g, [330, 440, 587], 70, 0.08, 'square', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
