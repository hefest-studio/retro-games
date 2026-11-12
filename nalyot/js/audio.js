/* НАЛЁТ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   NALYOT.sfx(g, type, data) — вызывается из main.js на события логики. */
(function (global) {
  'use strict';
  var N = global.NALYOT = global.NALYOT || {};
  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var last = {};
  function throttle(k, ms) { var n = Date.now(); if (n - (last[k] || 0) < ms) return false; last[k] = n; return true; }
  var SHOT = { rivet: [720, 0.035, 'square', 0.03], nail: [960, 0.025, 'square', 0.022], spark: [1400, 0.07, 'sawtooth', 0.035],
    torch: [140, 0.05, 'sawtooth', 0.018], scoop: [180, 0.09, 'sawtooth', 0.05], kotel: [300, 0.05, 'square', 0.04] };

  N.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'shot': { var s = SHOT[d.w] || SHOT.rivet; if (throttle('sh' + d.pi, d.w === 'torch' ? 90 : 45)) g.audio.beep(s[0], s[1], s[2], s[3]); break; }
      case 'melee': g.audio.beep(160, 0.07, 'square', 0.06); break;
      case 'jump': if (throttle('j' + d.pi, 80)) g.audio.beep(d.kotel ? 220 : 380, 0.06, 'triangle', 0.035); break;
      case 'hit': if (throttle('hit', 40)) g.audio.beep(520, 0.03, 'square', 0.03); break;
      case 'wall': if (throttle('wl', 90)) g.audio.beep(260, 0.02, 'triangle', 0.02); break;
      case 'blockHit': if (throttle('bh', 70)) g.audio.beep(200, 0.03, 'triangle', 0.03); break;
      case 'block': seq(g, [180, 120, 90], 50, 0.09, 'sawtooth', 0.06); break;
      case 'kill': if (throttle('kl', 35)) g.audio.beep(d.type === 'wagon' ? 90 : d.type === 'drone' ? 880 : 440, 0.09, 'sawtooth', 0.045); break;
      case 'eshot': if (throttle('es', 80)) g.audio.beep(d.kind === 'shell' ? 150 : 600, 0.04, 'triangle', 0.025); break;
      case 'throw': case 'drop': if (throttle('th', 120)) g.audio.beep(340, 0.05, 'triangle', 0.03); break;
      case 'grenade': g.audio.beep(500, 0.05, 'triangle', 0.04); break;
      case 'shell': g.audio.beep(130, 0.08, 'square', 0.06); break;
      case 'boom': if (throttle('bm', 60)) seq(g, [110, 70], 40, d.r > 60 ? 0.22 : 0.14, 'sawtooth', 0.07); break;
      case 'armor': seq(g, [500, 330], 50, 0.06, 'square', 0.05); break;
      case 'heroDie': seq(g, [523, 392, 294, 196, 131], 80, 0.12, 'sawtooth', 0.06); break;
      case 'respawn': seq(g, [392, 523, 659], 60, 0.07, 'triangle', 0.05); break;
      case 'rescue': seq(g, [659, 784, 988, 1319], 55, 0.07, 'square', 0.04); break;
      case 'pickup': seq(g, d.kind === 'w' ? [523, 784, 1047] : d.kind === 'life' ? [523, 659, 784, 1047, 1319] : [784, 1047], 55, 0.07, 'square', 0.045); break;
      case 'extraLife': seq(g, [784, 988, 1175, 1568], 70, 0.08, 'square', 0.05); break;
      case 'weaponOut': seq(g, [330, 262], 60, 0.06, 'triangle', 0.04); break;
      case 'board': seq(g, [196, 262, 330, 392], 50, 0.07, 'square', 0.05); break;
      case 'eject': seq(g, [392, 523], 50, 0.06, 'triangle', 0.05); break;
      case 'kotelHit': if (throttle('kh', 90)) g.audio.beep(140, 0.04, 'square', 0.04); break;
      case 'kotelCrit': seq(g, [880, 660, 880, 660], 90, 0.07, 'square', 0.05); break;
      case 'kotelBoom': seq(g, [98, 73, 55], 90, 0.3, 'sawtooth', 0.08); break;
      case 'bossIntro': seq(g, [110, 117, 110, 98], 160, 0.2, 'sawtooth', 0.06); break;
      case 'bossHit': if (throttle('bsh', 70)) g.audio.beep(120, 0.04, 'square', 0.045); break;
      case 'phase': seq(g, [220, 208, 196, 185], 70, 0.1, 'sawtooth', 0.06); break;
      case 'mortar': case 'drones': g.audio.beep(180, 0.1, 'triangle', 0.045); break;
      case 'stomp': seq(g, [70, 55], 60, 0.18, 'sawtooth', 0.08); break;
      case 'laserWarn': seq(g, [1200, 1200], 140, 0.05, 'sine', 0.04); break;
      case 'laser': g.audio.beep(90, 0.45, 'sawtooth', 0.05); break;
      case 'rain': seq(g, [1000, 900, 800], 80, 0.05, 'triangle', 0.035); break;
      case 'bossBoom': if (throttle('bb', 150)) g.audio.beep(60 + Math.random() * 40, 0.2, 'sawtooth', 0.07); break;
      case 'bossDie': seq(g, [196, 165, 131, 110, 87, 73, 55], 110, 0.18, 'sawtooth', 0.08); break;
      case 'clear': seq(g, [392, 523, 659, 784, 659, 784, 1047], 90, 0.1, 'square', 0.05); break;
      case 'mission': seq(g, [262, 330, 392], 90, 0.1, 'triangle', 0.05); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
