/* ДЕСАНТ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   DESANT.sfx(g, type, data) — из main.js на события логики; частые звуки прорежены. */
(function (global) {
  'use strict';
  var DS = global.DESANT = global.DESANT || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function th(k, ms) { var n = Date.now(); if (n - (last[k] || 0) < ms) return false; last[k] = n; return true; }
  DS.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'shot': if (th('s' + d.pi, 70)) g.audio.beep(d.w === 'spread' ? 520 : d.w === 'rapid' ? 980 : d.pi ? 820 : 720, 0.03, 'square', 0.018); break;
      case 'shell': g.audio.beep(110, 0.12, 'sawtooth', 0.05); break;
      case 'eshot': if (th('es', 60)) g.audio.beep(d.mg ? 300 : 360, 0.035, 'square', 0.016); break;
      case 'aim': if (th('aim', 160)) g.audio.beep(1500, 0.02, 'sine', 0.012); break;
      case 'hit': if (th('hit', 45)) g.audio.beep(430, 0.02, 'square', 0.016); break;
      case 'armor': if (th('ar', 90)) g.audio.beep(1900, 0.02, 'triangle', 0.016); break;
      case 'wallHit': if (th('wh', 80)) g.audio.beep(1500, 0.01, 'triangle', 0.008); break;
      case 'kill': if (th('kl', 40)) g.audio.beep(d.type === 'car' || d.type === 'bunker' ? 70 : d.type === 'nest' ? 95 : 210 + Math.random() * 60, d.type === 'rifle' ? 0.06 : 0.22, 'sawtooth', 0.04); break;
      case 'crush': g.audio.beep(90, 0.08, 'square', 0.04); break;
      case 'nade': g.audio.beep(330, 0.05, 'triangle', 0.03); break;
      case 'lob': if (th('lob', 200)) g.audio.beep(260, 0.06, 'triangle', 0.025); break;
      case 'boom': if (th('bm', 60)) { g.audio.beep(d.enemy ? 90 : 70, 0.22, 'sawtooth', 0.06); g.audio.beep(45, 0.3, 'square', 0.03); } break;
      case 'crate': if (th('cr', 80)) g.audio.beep(160, 0.06, 'square', 0.03); break;
      case 'heroHurt': seq(g, [220, 150], 50, 0.07, 'square', 0.05); break;
      case 'heroDie': seq(g, [523, 392, 311, 233, 175], 80, 0.12, 'sawtooth', 0.06); break;
      case 'respawn': seq(g, [392, 523, 659], 60, 0.07, 'triangle', 0.05); break;
      case 'tankHit': if (th('th', 90)) g.audio.beep(140, 0.05, 'square', 0.04); break;
      case 'tankDie': seq(g, [120, 90, 70, 50], 110, 0.25, 'sawtooth', 0.08); break;
      case 'board': seq(g, [196, 247, 294, 392], 60, 0.08, 'square', 0.04); break;
      case 'exit': seq(g, [392, 294], 60, 0.06, 'square', 0.035); break;
      case 'noFuel': if (th('nf', 900)) seq(g, [196, 165, 147], 90, 0.08, 'triangle', 0.04); break;
      case 'noNade': if (th('nn', 300)) seq(g, [300, 220], 60, 0.05, 'square', 0.03); break;
      case 'pickup': seq(g, d.kind === 'spread' || d.kind === 'rapid' ? [659, 880, 1175] : [880, 1175], 45, 0.05, 'square', 0.035); break;
      case 'life': seq(g, [523, 659, 784, 1046, 1318], 70, 0.08, 'square', 0.05); break;
      case 'checkpoint': seq(g, [587, 740, 880], 80, 0.09, 'triangle', 0.05); break;
      case 'spawn': if (th('sp', 400)) g.audio.beep(120, 0.1, 'sawtooth', 0.025); break;
      case 'rumble': seq(g, [70, 60, 55], 120, 0.14, 'sawtooth', 0.05); break;
      case 'rock': if (th('rk', 100)) g.audio.beep(80, 0.12, 'square', 0.04); break;
      case 'portOpen': seq(g, [150, 200], 80, 0.1, 'sawtooth', 0.04); break;
      case 'bossIntro': seq(g, [82, 87, 82, 73, 65], 170, 0.22, 'sawtooth', 0.06); break;
      case 'bossHit': if (th('bh', 80)) g.audio.beep(180, 0.03, 'square', 0.03); break;
      case 'partDie': seq(g, [220, 165, 110], 70, 0.14, 'sawtooth', 0.06); break;
      case 'bossDie': seq(g, [196, 165, 131, 110, 87, 73, 55], 110, 0.22, 'sawtooth', 0.08); break;
      case 'clear': seq(g, [330, 392, 494, 659, 784], 100, 0.12, 'square', 0.05); break;
      case 'zone': seq(g, [247, 330, 392], 130, 0.12, 'triangle', 0.05); break;
      case 'contAsk': seq(g, [392, 330, 262], 160, 0.16, 'triangle', 0.05); break;
      case 'continue': seq(g, [262, 330, 392, 523], 70, 0.08, 'square', 0.05); break;
      case 'out': seq(g, [262, 196, 131], 140, 0.15, 'triangle', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
