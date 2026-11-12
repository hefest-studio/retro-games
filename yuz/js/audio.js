/* ЮЗ · звук: оригинальные короткие SFX поверх g.audio.beep движка (WebAudio, без файлов)
   и «мотор» — непрерывный гул машинки игрока, тон и громкость которого следуют за скоростью и газом.
   YUZ.sfx(g, type, data) — на события логики; YUZ.motor.update(g, cars, on) — каждый кадр из main.js. */
(function (global) {
  'use strict';
  var Y = global.YUZ = global.YUZ || {};

  function seq(g, notes, gap, dur, type, vol) {
    notes.forEach(function (f, i) { setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); });
  }
  var last = {};
  function rate(k, ms) { var n = Date.now(); if (n - (last[k] || 0) < ms) return false; last[k] = n; return true; }

  Y.sfx = function (g, type, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (type) {
      case 'count': g.audio.beep(440, 0.14, 'square', 0.06); break;
      case 'go': g.audio.beep(880, 0.3, 'square', 0.07); break;
      case 'wall': if (rate('wall', 90)) g.audio.beep(90 + Math.min(80, d.f / 3), 0.07, 'square', 0.05); break;
      case 'bump': if (rate('bump', 90)) { g.audio.beep(160, 0.05, 'square', 0.05); g.audio.beep(120, 0.06, 'triangle', 0.04); } break;
      case 'jump': seq(g, [330, 440, 554], 40, 0.05, 'triangle', 0.045); break;
      case 'land': if (rate('land', 60)) g.audio.beep(110, 0.08, 'square', 0.05); break;
      case 'pickup': if (d.k === 'boost') seq(g, [523, 784, 1046, 1568], 45, 0.06, 'square', 0.05); else seq(g, [392, 523, 659, 784], 55, 0.07, 'triangle', 0.055); break;
      case 'lap': if (d.human) seq(g, [659, 880], 70, 0.08, 'triangle', 0.05); break;
      case 'finish': if (d.human) seq(g, d.place === 1 ? [523, 659, 784, 1046, 1318] : [523, 659, 784], 80, 0.1, 'square', 0.055); break;
      case 'out': if (d.human) seq(g, [392, 330, 262, 196], 90, 0.11, 'sawtooth', 0.06); else seq(g, [523, 392], 60, 0.06, 'triangle', 0.04); break;
      case 'raceEnd': break;
    }
  };

  // ---------- мотор ----------
  var voices = [];
  function voice(ac, i) {
    if (voices[i] && voices[i].ac === ac) return voices[i];
    var o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), gn = ac.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 2;
    gn.gain.value = 0; o1.connect(f); o2.connect(f); f.connect(gn); gn.connect(ac.destination);
    o1.start(); o2.start();
    voices[i] = { ac: ac, o1: o1, o2: o2, f: f, g: gn };
    return voices[i];
  }
  Y.motor = {
    // cars — машинки игроков (до 2); on — идёт ли заезд и включён ли звук
    update: function (g, cars, on) {
      var ac = g.audio.ac; if (!ac) return;
      for (var i = 0; i < 2; i++) {
        var c = cars[i], v = voices[i];
        if (!c || !on || c.out) { if (v) v.g.gain.setTargetAtTime(0, ac.currentTime, 0.05); continue; }
        v = voice(ac, i);
        var spd = Math.hypot(c.vx, c.vy), gas = c.inp && c.inp.gas ? 1 : 0, retro = g.themeName === 'retro';
        var base = (i ? 52 : 46) + spd * 0.5 + (c.boost > 0 ? 30 : 0) + (c.air > 0 ? 25 : 0);
        v.o1.frequency.setTargetAtTime(base, ac.currentTime, 0.04);
        v.o2.frequency.setTargetAtTime(base * 0.5, ac.currentTime, 0.04);
        v.f.frequency.setTargetAtTime(retro ? 1400 : 500 + spd * 3 + gas * 300, ac.currentTime, 0.05);
        v.g.gain.setTargetAtTime((retro ? 0.018 : 0.024) + gas * 0.014 + Math.min(spd, 200) / 200 * 0.01, ac.currentTime, 0.06);
      }
    },
    stop: function (g) { var ac = g.audio.ac; if (!ac) return; voices.forEach(function (v) { if (v) v.g.gain.setTargetAtTime(0, ac.currentTime, 0.03); }); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
