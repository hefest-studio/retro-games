/* РЕДУТ · аудио: оригинальный чиптюн + SFX на WebAudio (без внешних файлов). R.audio */
(function (global) {
  'use strict';
  var R = global.REDUT = global.REDUT || {};
  var ctx = null, master = null, musicOn = true, enabled = true, musicTimer = null, step = 0;

  function ac() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) { enabled = false; return null; }
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.15; master.connect(ctx.destination);
    return ctx;
  }

  // Короткий тон с заданной волной (pulse/square/triangle/sawtooth).
  function beep(freq, dur, type, gain) {
    if (!enabled) return; var c = ac(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(gain || 0.4, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(c.currentTime + dur + 0.02);
  }

  // Шумовой удар (взрыв/рикошет) — буфер белого шума через фильтр.
  function noise(dur, gain, lp) {
    if (!enabled) return; var c = ac(); if (!c) return;
    var n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1100;
    var g = c.createGain(); g.gain.value = gain || 0.4;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }

  // Оригинальный маршевый чиптюн-луп (минорный, своя тема — не копия).
  var MELODY = [
    294, 0, 294, 349, 392, 0, 349, 294, 262, 0, 294, 0, 220, 0, 0, 0,
    294, 0, 349, 392, 440, 0, 392, 349, 330, 0, 294, 262, 294, 0, 0, 0
  ];
  var BASS = [98, 98, 110, 110, 87, 87, 110, 98];

  function tick() {
    if (!musicOn || !enabled) return;
    var n = MELODY[step % MELODY.length];
    if (n) beep(n, 0.13, 'square', 0.14);
    var b = BASS[(step >> 2) % BASS.length];
    if (step % 2 === 0) beep(b, 0.16, 'triangle', 0.22); // бас-марш
    step++;
  }

  R.audio = {
    unlock: function () { ac(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    startMusic: function () { if (musicTimer) return; this.unlock(); step = 0; musicTimer = setInterval(tick, 140); },
    stopMusic: function () { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
    setSound: function (on) { enabled = !!on; if (!on) this.stopMusic(); },
    setMusic: function (on) { musicOn = !!on; },
    isOn: function () { return enabled; },
    sfx: function (name) {
      if (!enabled) return;
      switch (name) {
        case 'shoot':   beep(760, 0.05, 'square', 0.22); beep(380, 0.04, 'square', 0.16); break;
        case 'brick':   noise(0.06, 0.25, 2200); beep(240, 0.04, 'square', 0.18); break;
        case 'steel':   beep(1200, 0.04, 'square', 0.22); noise(0.05, 0.2, 3000); break;
        case 'explode': noise(0.3, 0.5, 850); beep(80, 0.24, 'triangle', 0.32); break;
        case 'hit':     beep(160, 0.08, 'square', 0.32); noise(0.06, 0.22, 1600); break;
        case 'pickup':  beep(620, 0.05, 'square', 0.3); beep(930, 0.08, 'square', 0.3); break;
        case 'life':    [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { beep(f, 0.09, 'square', 0.3); }, i * 60); }); break;
        case 'spawn':   beep(440, 0.06, 'sawtooth', 0.2); beep(660, 0.06, 'sawtooth', 0.18); break;
        case 'freeze':  [880, 740, 620, 520].forEach(function (f, i) { setTimeout(function () { beep(f, 0.1, 'sine', 0.28); }, i * 55); }); break;
        case 'gameover':[262, 220, 196, 147].forEach(function (f, i) { setTimeout(function () { beep(f, 0.22, 'triangle', 0.4); }, i * 160); }); break;
        case 'win':     [392, 523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { beep(f, 0.14, 'square', 0.33); }, i * 95); }); break;
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
