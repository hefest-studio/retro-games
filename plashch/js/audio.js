/* ПЛАЩ · аудио: оригинальный «ночной» чиптюн + SFX на WebAudio (без файлов). P.audio */
(function (global) {
  'use strict';
  var P = global.PLASHCH = global.PLASHCH || {};
  var ctx = null, master = null, musicOn = true, enabled = true, musicTimer = null, step = 0;

  function ac() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) { enabled = false; return null; }
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.15; master.connect(ctx.destination);
    return ctx;
  }

  // Короткий тон заданной волны (pulse/square/triangle/sawtooth).
  function beep(freq, dur, type, gain) {
    if (!enabled) return; var c = ac(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(gain || 0.4, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(c.currentTime + dur + 0.02);
  }

  // Шумовой удар (взрыв/урон) — буфер белого шума через фильтр.
  function noise(dur, gain, lp) {
    if (!enabled) return; var c = ac(); if (!c) return;
    var n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1200;
    var g = c.createGain(); g.gain.value = gain || 0.4;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }

  // Оригинальный «нуар»-луп в до-миноре — не копия известных тем.
  var MELODY = [
    262, 0, 311, 0, 349, 0, 311, 262, 233, 0, 262, 0, 196, 0, 0, 0,
    262, 0, 311, 349, 392, 0, 466, 0, 440, 392, 349, 0, 311, 0, 262, 0
  ];
  var BASS = [131, 131, 155, 155, 117, 117, 98, 98];

  function tick() {
    if (!musicOn || !enabled) return;
    var n = MELODY[step % MELODY.length];
    if (n) beep(n, 0.13, 'square', 0.14);
    var b = BASS[(step >> 2) % BASS.length];
    if (step % 2 === 0) beep(b, 0.16, 'triangle', 0.22); // бас-пульс
    step++;
  }

  P.audio = {
    unlock: function () { ac(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    startMusic: function () { if (musicTimer) return; this.unlock(); step = 0; musicTimer = setInterval(tick, 130); },
    stopMusic: function () { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
    setSound: function (on) { enabled = !!on; if (!on) this.stopMusic(); },
    setMusic: function (on) { musicOn = !!on; },
    isOn: function () { return enabled; },
    sfx: function (name) {
      if (!enabled) return;
      switch (name) {
        case 'jump':  beep(280, 0.08, 'square', 0.3); beep(500, 0.07, 'square', 0.22); break;
        case 'shoot': beep(900, 0.04, 'square', 0.22); beep(1300, 0.03, 'square', 0.16); break;
        case 'grapple': beep(400, 0.05, 'sawtooth', 0.25); beep(760, 0.09, 'triangle', 0.2); break;
        case 'explode': noise(0.26, 0.5, 900); beep(90, 0.22, 'triangle', 0.3); break;
        case 'pickup': beep(620, 0.05, 'square', 0.28); beep(930, 0.08, 'square', 0.28); break;
        case 'medkit': [392, 523, 659].forEach(function (f, i) { setTimeout(function () { beep(f, 0.09, 'triangle', 0.3); }, i * 55); }); break;
        case 'door':  [349, 466, 587, 698].forEach(function (f, i) { setTimeout(function () { beep(f, 0.11, 'square', 0.3); }, i * 70); }); break;
        case 'hurt':  beep(200, 0.14, 'sawtooth', 0.35); beep(120, 0.18, 'triangle', 0.3); break;
        case 'bosshit': beep(160, 0.06, 'square', 0.3); noise(0.06, 0.25, 1600); break;
        case 'gameover': [311, 262, 196, 131].forEach(function (f, i) { setTimeout(function () { beep(f, 0.22, 'triangle', 0.4); }, i * 160); }); break;
        case 'win': [523, 587, 698, 880, 1047].forEach(function (f, i) { setTimeout(function () { beep(f, 0.14, 'square', 0.33); }, i * 95); }); break;
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
