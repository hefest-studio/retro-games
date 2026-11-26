/* КОРОМЫСЛО · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов).
   KOROMYSLO.sfx(g, type, data) — из main.js на события логики. Гирька звенит тем ниже, чем тяжелее; снятая пара — арпеджио,
   выше на дальнем плече; перевес — падающий «скрежет»; фитиль — тиканье на последних 2 секундах. */
(function (global) {
  'use strict';
  var K = global.KOROMYSLO = global.KOROMYSLO || {};
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var LAND = [0, 880, 740, 622, 523, 440, 370];   // 1…6 точек
  K.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'drop': g.audio.beep(660, 0.04, 'triangle', 0.03); break;
      case 'land': g.audio.beep(d.rust ? 150 : (LAND[d.v] || 400), d.rust ? 0.1 : 0.07, d.rust ? 'sawtooth' : 'square', 0.05); setTimeout(function () { g.audio.beep((LAND[d.v] || 400) * 2, 0.05, 'triangle', 0.02); }, 30); break;
      case 'debris': g.audio.beep(110, 0.12, 'sawtooth', 0.03); break;
      case 'clear': { var base = 392 * (1 + (d.d - 1) * 0.12); seq(g, [base, base * 1.25, base * 1.5, base * 2].slice(0, 2 + Math.min(2, d.mult)), 60, 0.09, 'triangle', 0.06); break; }
      case 'even': seq(g, [1046, 1318], 80, 0.12, 'triangle', 0.04); break;
      case 'tip': seq(g, [330, 262, 196, 147, 110], 70, 0.12, 'sawtooth', 0.065); break;
      case 'level': seq(g, [523, 659, 784, 1046, 784, 1046], 70, 0.1, 'square', 0.055); break;
      case 'tick': g.audio.beep(d.last ? 1400 : 1100, 0.025, 'square', 0.03); break;
      case 'full': g.audio.beep(170, 0.06, 'square', 0.04); break;
      case 'move': g.audio.beep(520, 0.02, 'triangle', 0.025); break;
      case 'revive': case 'boost': seq(g, [440, 554, 659, 880], 60, 0.08, 'triangle', 0.05); break;
      case 'tutDone': seq(g, [659, 784, 988], 70, 0.08, 'triangle', 0.045); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
