/* КАСКАД · аудио: оригинальный чиптюн + SFX на WebAudio (без внешних файлов). TT.audio */
(function (global) {
  'use strict';
  var TT = global.TT = global.TT || {};
  var ctx = null, master = null, musicOn = true, enabled = true, musicTimer = null, step = 0;

  function ac() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) { enabled = false; return null; }
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.18; master.connect(ctx.destination);
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
  // Оригинальный минорный арпеджио-луп (не копия известных тем)
  var MELODY = [220,0,277,330,277,0,220,0,196,0,247,294,247,0,196,0,
                175,0,220,262,220,0,175,0,165,196,247,196,165,147,165,0];
  function tick() {
    if (!musicOn || !enabled) return;
    var n = MELODY[step % MELODY.length];
    if (n) beep(n, 0.14, 'square', 0.22);
    if (step % 2 === 0) beep(n ? n/2 : 110, 0.12, 'triangle', 0.18); // бас
    step++;
  }
  TT.audio = {
    unlock: function () { ac(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    startMusic: function () { if (musicTimer) return; this.unlock(); step = 0; musicTimer = setInterval(tick, 140); },
    stopMusic: function () { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
    setSound: function (on) { enabled = !!on; if (!on) this.stopMusic(); },
    setMusic: function (on) { musicOn = !!on; },
    sfx: function (name) {
      if (!enabled) return;
      switch (name) {
        case 'move': beep(330, 0.03, 'square', 0.25); break;
        case 'rotate': beep(440, 0.05, 'square', 0.3); break;
        case 'lock': beep(160, 0.06, 'triangle', 0.35); break;
        case 'clear': beep(660, 0.08, 'square', 0.4); beep(880, 0.12, 'square', 0.3); break;
        case 'quad': [523,659,784,1047].forEach(function (f, i) { setTimeout(function(){ beep(f,0.12,'square',0.4); }, i*60); }); break;
        case 'level': [392,523,659].forEach(function (f, i) { setTimeout(function(){ beep(f,0.1,'square',0.35); }, i*70); }); break;
        case 'drop': beep(120, 0.07, 'sawtooth', 0.3); break;
        case 'hold': beep(520, 0.05, 'triangle', 0.3); break;
        case 'over': [330,262,196,131].forEach(function (f, i) { setTimeout(function(){ beep(f,0.18,'triangle',0.4); }, i*140); }); break;
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
