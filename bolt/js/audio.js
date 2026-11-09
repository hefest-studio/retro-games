/* БОЛТ · аудио: оригинальный чиптюн + SFX на WebAudio (без внешних файлов). B.audio */
(function (global) {
  'use strict';
  var B = global.BOLT = global.BOLT || {};
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

  // Оригинальный боевой чиптюн-луп (минорный, не копия известных тем).
  var MELODY = [
    330, 0, 392, 0, 440, 392, 330, 0, 294, 0, 330, 0, 262, 0, 294, 0,
    330, 0, 392, 0, 523, 494, 440, 392, 349, 0, 440, 0, 330, 0, 262, 0
  ];
  var BASS = [110, 110, 146, 146, 98, 98, 123, 123];

  function tick() {
    if (!musicOn || !enabled) return;
    var n = MELODY[step % MELODY.length];
    if (n) beep(n, 0.12, 'square', 0.16);
    var b = BASS[(step >> 2) % BASS.length];
    if (step % 2 === 0) beep(b, 0.14, 'triangle', 0.22); // бас-пульс
    step++;
  }

  B.audio = {
    unlock: function () { ac(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    startMusic: function () { if (musicTimer) return; this.unlock(); step = 0; musicTimer = setInterval(tick, 125); },
    stopMusic: function () { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
    setSound: function (on) { enabled = !!on; if (!on) this.stopMusic(); },
    setMusic: function (on) { musicOn = !!on; },
    isOn: function () { return enabled; },
    sfx: function (name) {
      if (!enabled) return;
      switch (name) {
        case 'jump':  beep(300, 0.08, 'square', 0.3); beep(520, 0.07, 'square', 0.25); break;
        case 'shoot': beep(820, 0.05, 'sawtooth', 0.25); beep(420, 0.04, 'square', 0.2); break;
        case 'hit':   beep(180, 0.06, 'square', 0.3); noise(0.05, 0.2, 1800); break;
        case 'explode': noise(0.28, 0.5, 900); beep(90, 0.22, 'triangle', 0.3); break;
        case 'pickup': beep(660, 0.05, 'square', 0.3); beep(990, 0.08, 'square', 0.3); break;
        case 'battery': [523, 659, 784].forEach(function (f, i) { setTimeout(function () { beep(f, 0.08, 'square', 0.3); }, i * 55); }); break;
        case 'door':  [392, 523, 659, 784].forEach(function (f, i) { setTimeout(function () { beep(f, 0.11, 'square', 0.32); }, i * 70); }); break;
        case 'hurt':  beep(220, 0.14, 'sawtooth', 0.35); beep(130, 0.18, 'triangle', 0.3); break;
        case 'gameover': [330, 262, 196, 131].forEach(function (f, i) { setTimeout(function () { beep(f, 0.2, 'triangle', 0.4); }, i * 150); }); break;
        case 'win': [523, 659, 784, 1047, 1319].forEach(function (f, i) { setTimeout(function () { beep(f, 0.14, 'square', 0.35); }, i * 90); }); break;
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
