/* КОЛОБОК · аудио: оригинальный чиптюн + SFX на WebAudio (без внешних файлов). K.audio */
(function (global) {
  'use strict';
  var K = global.KOLOBOK = global.KOLOBOK || {};
  var ctx = null, master = null, musicOn = true, enabled = true, musicTimer = null, step = 0;

  function ac() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) { enabled = false; return null; }
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.16; master.connect(ctx.destination);
    return ctx;
  }

  // Короткий тон заданной волной (pulse/square/triangle/sawtooth).
  function beep(freq, dur, type, gain) {
    if (!enabled) return; var c = ac(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(gain || 0.4, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(c.currentTime + dur + 0.02);
  }

  // Шумовой всплеск (вода/урон) — буфер белого шума через фильтр.
  function noise(dur, gain, lp) {
    if (!enabled) return; var c = ac(); if (!c) return;
    var n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1200;
    var g = c.createGain(); g.gain.value = gain || 0.4;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }

  // Оригинальный напев-луп в народном ладу (не копия известных тем).
  var MELODY = [
    392, 0, 440, 0, 494, 440, 392, 0, 330, 0, 392, 0, 294, 0, 330, 0,
    392, 0, 440, 494, 523, 494, 440, 0, 392, 0, 330, 0, 294, 0, 262, 0
  ];
  var BASS = [131, 131, 165, 165, 98, 98, 147, 147];

  function tick() {
    if (!musicOn || !enabled) return;
    var n = MELODY[step % MELODY.length];
    if (n) beep(n, 0.13, 'triangle', 0.17);
    var b = BASS[(step >> 2) % BASS.length];
    if (step % 2 === 0) beep(b, 0.15, 'square', 0.14); // мягкий бас-пульс
    step++;
  }

  K.audio = {
    unlock: function () { ac(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    startMusic: function () { if (musicTimer) return; this.unlock(); step = 0; musicTimer = setInterval(tick, 140); },
    stopMusic: function () { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
    setSound: function (on) { enabled = !!on; if (!on) this.stopMusic(); },
    setMusic: function (on) { musicOn = !!on; },
    isOn: function () { return enabled; },
    sfx: function (name) {
      if (!enabled) return;
      switch (name) {
        case 'jump':  beep(330, 0.08, 'square', 0.3); beep(560, 0.07, 'square', 0.22); break;
        case 'berry': beep(700, 0.05, 'square', 0.3); beep(1040, 0.08, 'square', 0.3); break;
        case 'pickup': beep(523, 0.06, 'square', 0.28); beep(784, 0.08, 'triangle', 0.28); break;
        case 'door':  [392, 523, 659, 784].forEach(function (f, i) { setTimeout(function () { beep(f, 0.11, 'square', 0.3); }, i * 70); }); break;
        case 'plank': beep(196, 0.1, 'square', 0.3); beep(262, 0.12, 'triangle', 0.26); break;
        case 'splash': noise(0.3, 0.4, 1600); beep(180, 0.16, 'triangle', 0.24); break;
        case 'nope':  beep(150, 0.12, 'sawtooth', 0.22); break;
        case 'warp':  [523, 659, 784].forEach(function (f, i) { setTimeout(function () { beep(f, 0.07, 'triangle', 0.24); }, i * 45); }); break;
        case 'hurt':  beep(240, 0.14, 'sawtooth', 0.32); beep(150, 0.18, 'triangle', 0.3); break;
        case 'gameover': [392, 330, 262, 196].forEach(function (f, i) { setTimeout(function () { beep(f, 0.2, 'triangle', 0.4); }, i * 150); }); break;
        case 'win': [523, 659, 784, 1047, 1319].forEach(function (f, i) { setTimeout(function () { beep(f, 0.14, 'square', 0.32); }, i * 90); }); break;
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
