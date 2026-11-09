/* PAC-MAN · аудио: оригинальный чиптюн + SFX на WebAudio (без внешних файлов). PM.audio */
(function (global) {
  'use strict';
  var PM = global.PM = global.PM || {};
  var ctx = null, master = null, musicOn = true, enabled = true, musicTimer = null, step = 0;

  function ac() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) { enabled = false; return null; }
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.16; master.connect(ctx.destination);
    return ctx;
  }
  function beep(freq, dur, type, gain) {
    if (!enabled) return; var c = ac(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(gain || 0.5, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(c.currentTime + dur + 0.02);
  }
  // Оригинальный бодрый луп в духе аркадного лабиринта (не копия известных тем)
  var MELODY = [262, 330, 392, 330, 262, 196, 262, 330, 294, 349, 440, 349, 294, 247, 294, 349];
  function tick() {
    if (!musicOn || !enabled) return;
    var n = MELODY[step % MELODY.length];
    if (n) beep(n, 0.1, 'square', 0.18);
    if (step % 4 === 0) beep(n / 2, 0.14, 'triangle', 0.16); // бас
    step++;
  }
  PM.audio = {
    unlock: function () { ac(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    startMusic: function () { if (musicTimer) return; this.unlock(); step = 0; musicTimer = setInterval(tick, 170); },
    stopMusic: function () { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
    setSound: function (on) { enabled = !!on; if (!on) this.stopMusic(); },
    setMusic: function (on) { musicOn = !!on; },
    sfx: function (name, d) {
      if (!enabled) return;
      switch (name) {
        case 'chomp': beep(step % 2 ? 420 : 300, 0.03, 'square', 0.14); break; // «вака»
        case 'turn': break;
        case 'power': [440, 554, 660, 880].forEach(function (f, i) { setTimeout(function () { beep(f, 0.07, 'square', 0.26); }, i * 55); }); break;
        case 'eatghost': [300, 450, 650, 900].forEach(function (f, i) { setTimeout(function () { beep(f, 0.08, 'sawtooth', 0.3); }, i * 50); }); break;
        case 'death': [392, 349, 311, 262, 220, 165].forEach(function (f, i) { setTimeout(function () { beep(f, 0.18, 'triangle', 0.4); }, i * 130); }); break;
        case 'win': [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { setTimeout(function () { beep(f, 0.12, 'square', 0.35); }, i * 90); }); break;
        case 'over': [330, 262, 196, 131].forEach(function (f, i) { setTimeout(function () { beep(f, 0.2, 'triangle', 0.4); }, i * 150); }); break;
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
