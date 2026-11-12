/* ЗАСТАВА · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   ZASTAVA.sfx(g, type, data) — вызывается из main.js на события логики.
   Шаг строя — механический «тик-так» из двух нот, темп растёт вместе со строем. */
(function (global) {
  'use strict';
  var Z = global.ZASTAVA = global.ZASTAVA || {};

  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var MARCH = [98, 92, 104, 87];   // ржавая «поступь»: четыре разных удара
  var lastGround = 0;

  Z.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'march': g.audio.beep(MARCH[(d.beat || 0) % 4], 0.06, 'square', 0.05); break;
      case 'drop': g.audio.beep(70, 0.12, 'sawtooth', 0.05); break;
      case 'shoot': g.audio.beep(880, 0.05, 'square', 0.04); setTimeout(function () { g.audio.beep(1320, 0.03, 'triangle', 0.03); }, 25); break;
      case 'alienShot': g.audio.beep(d.kind === 'drill' ? 300 : 420, 0.04, 'sawtooth', 0.025); break;
      case 'kill': seq(g, [520 + (d.pts || 10) * 8, 330], 35, 0.05, 'square', 0.05); break;
      case 'bunker': g.audio.beep(150 + Math.random() * 60, 0.03, 'triangle', 0.03); break;
      case 'clash': g.audio.beep(d.kill ? 1500 : 900, 0.04, 'triangle', 0.035); break;
      case 'ground': { var n = Date.now(); if (n - lastGround > 60) { lastGround = n; g.audio.beep(110, 0.03, 'triangle', 0.02); } break; }
      case 'probe': seq(g, [660, 740, 660, 740], 110, 0.07, 'triangle', 0.035); break;
      case 'probeKill': seq(g, [784, 988, 1175, 1568], 55, 0.07, 'square', 0.05); break;
      case 'deflect': case 'clang': g.audio.beep(1800, 0.04, 'triangle', 0.04); break;
      case 'shieldOff': break;
      case 'birdDive': seq(g, [880, 660, 494], 60, 0.07, 'sawtooth', 0.035); break;
      case 'birdHit': g.audio.beep(600, 0.05, 'square', 0.045); break;
      case 'birdKill': seq(g, [700, 520, 390], 40, 0.06, 'square', 0.05); break;
      case 'bomb': g.audio.beep(240, 0.06, 'triangle', 0.03); break;
      case 'bossSeg': g.audio.beep(d.broken ? 330 : 520, 0.04, 'square', 0.04); break;
      case 'bossCore': seq(g, [196, 262], 40, 0.07, 'square', 0.06); break;
      case 'bossFire': g.audio.beep(180, 0.08, 'sawtooth', 0.035); break;
      case 'repair': g.audio.beep(1050, 0.03, 'triangle', 0.025); break;
      case 'bossDie': seq(g, [392, 330, 262, 196, 131, 98, 65], 90, 0.15, 'sawtooth', 0.07); break;
      case 'playerHit': seq(g, [330, 247, 185, 139, 104], 80, 0.12, 'sawtooth', 0.065); break;
      case 'respawn': g.audio.beep(660, 0.08, 'triangle', 0.05); break;
      case 'life': seq(g, [523, 659, 784, 1046], 60, 0.08, 'triangle', 0.06); break;
      case 'clear': seq(g, [523, 659, 784, 659, 784, 1046], 75, 0.1, 'square', 0.055); break;
      case 'wave': seq(g, [262, 392, 523], 90, 0.09, 'triangle', 0.05); break;
      case 'invade': seq(g, [196, 185, 175, 165, 156, 147], 110, 0.16, 'sawtooth', 0.07); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
