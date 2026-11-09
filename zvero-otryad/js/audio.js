/* ЗВЕРО-ОТРЯД · аудио: оригинальный чиптюн + SFX на WebAudio (без внешних файлов). Z.audio */
(function (global) {
  'use strict';
  var Z = global.ZVERO = global.ZVERO || {};
  var ctx = null, master = null, musicOn = true, enabled = true, musicTimer = null, step = 0;

  function ac() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) { enabled = false; return null; }
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.16; master.connect(ctx.destination);
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

  // Шумовой удар (треск ящика/урон) — буфер белого шума через фильтр.
  function noise(dur, gain, lp) {
    if (!enabled) return; var c = ac(); if (!c) return;
    var n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1200;
    var g = c.createGain(); g.gain.value = gain || 0.4;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }

  // Оригинальный бодрый мажорный чиптюн-луп «спасателей» (не копия известных тем).
  var MELODY = [
    523, 0, 659, 0, 784, 659, 523, 0, 587, 0, 698, 0, 587, 0, 494, 0,
    523, 0, 659, 784, 880, 784, 659, 587, 523, 0, 784, 0, 659, 0, 523, 0
  ];
  var BASS = [131, 131, 165, 165, 147, 147, 196, 196];

  function tick() {
    if (!musicOn || !enabled) return;
    var n = MELODY[step % MELODY.length];
    if (n) beep(n, 0.11, 'square', 0.14);
    var b = BASS[(step >> 2) % BASS.length];
    if (step % 2 === 0) beep(b, 0.14, 'triangle', 0.24); // бас-пульс
    step++;
  }

  Z.audio = {
    unlock: function () { ac(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    startMusic: function () { if (musicTimer) return; this.unlock(); step = 0; musicTimer = setInterval(tick, 125); },
    stopMusic: function () { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
    setSound: function (on) { enabled = !!on; if (!on) this.stopMusic(); },
    setMusic: function (on) { musicOn = !!on; },
    isOn: function () { return enabled; },
    sfx: function (name) {
      if (!enabled) return;
      switch (name) {
        case 'jump':  beep(380, 0.07, 'square', 0.3); beep(620, 0.07, 'square', 0.22); break;
        case 'grab':  beep(520, 0.05, 'square', 0.28); beep(300, 0.05, 'triangle', 0.2); break;
        case 'throw': beep(700, 0.05, 'sawtooth', 0.24); beep(440, 0.05, 'square', 0.2); break;
        case 'smash': noise(0.22, 0.45, 1400); beep(140, 0.18, 'triangle', 0.3); break;
        case 'pickup': beep(784, 0.05, 'square', 0.3); beep(1047, 0.08, 'square', 0.3); break;
        case 'door':  [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { beep(f, 0.11, 'square', 0.32); }, i * 70); }); break;
        case 'hurt':  beep(240, 0.14, 'sawtooth', 0.34); beep(150, 0.18, 'triangle', 0.3); break;
        case 'bosshit': beep(200, 0.08, 'square', 0.32); noise(0.08, 0.3, 2200); break;
        case 'gameover': [392, 311, 262, 196].forEach(function (f, i) { setTimeout(function () { beep(f, 0.22, 'triangle', 0.4); }, i * 150); }); break;
        case 'win': [523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) { setTimeout(function () { beep(f, 0.14, 'square', 0.33); }, i * 90); }); break;
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
