/*!
 * Lode Runner — 8-bit audio engine.
 * Classic script (no ES modules, no assets): defines window.LR.audio.
 *
 * Everything is synthesised on the fly with WebAudio:
 *   - pulse/square lead (custom PeriodicWave),
 *   - triangle bass,
 *   - noise drums,
 *   - lookahead step sequencer with seamless 8-bar loops.
 *
 * All melodies below are original (do not copy Lode Runner or other games).
 */
(function () {
  'use strict';

  var ROOT = (typeof window !== 'undefined' && window) ||
             (typeof globalThis !== 'undefined' && globalThis) || {};

  ROOT.LR = ROOT.LR || {};
  if (ROOT.LR.audio) { return; }

  /* ------------------------------------------------------------------ *
   *  Small utilities
   * ------------------------------------------------------------------ */

  function clamp(v, lo, hi) {
    v = Number(v);
    if (!isFinite(v)) { return lo; }
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function later(fn, ms) {
    try { return setTimeout(fn, ms); } catch (e) { return 0; }
  }

  function every(fn, ms) {
    try { return setInterval(fn, ms); } catch (e) { return 0; }
  }

  function stopTimer(id) {
    if (!id) { return; }
    try { clearInterval(id); } catch (e) { /* ignore */ }
    try { clearTimeout(id); } catch (e) { /* ignore */ }
  }

  function connect(from, to) {
    if (!from || !to) { return false; }
    try { from.connect(to); return true; } catch (e) { return false; }
  }

  function disconnect(node) {
    if (!node) { return; }
    try { node.disconnect(); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ *
   *  Note / chord helpers
   * ------------------------------------------------------------------ */

  var PC = {
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
    'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11
  };

  var NOTE_RE = /^([A-Ga-g])([#b]?)(-?\d)$/;

  function noteToMidi(name) {
    var m = NOTE_RE.exec(String(name || ''));
    if (!m) { return null; }
    var pc = PC[m[1].toUpperCase() + m[2]];
    if (pc === undefined) { return null; }
    return (parseInt(m[3], 10) + 1) * 12 + pc;
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function noteFreq(name) {
    var midi = noteToMidi(name);
    return midi === null ? null : midiToFreq(midi);
  }

  var CHORD_INTERVALS = {
    '': [0, 4, 7],
    'm': [0, 3, 7],
    '7': [0, 4, 7, 10],
    'm7': [0, 3, 7, 10],
    'maj7': [0, 4, 7, 11],
    'dim': [0, 3, 6],
    'sus': [0, 5, 7]
  };

  function parseChord(name) {
    var m = /^([A-G][#b]?)(m7|maj7|m|7|dim|sus)?$/.exec(String(name || ''));
    if (!m) { return { root: 0, intervals: CHORD_INTERVALS[''] }; }
    var pc = PC[m[1]];
    if (pc === undefined) { pc = 0; }
    var type = m[2] || '';
    return { root: pc, intervals: CHORD_INTERVALS[type] || CHORD_INTERVALS[''] };
  }

  function chordTone(baseMidi, intervals, index) {
    var len = intervals.length;
    var oct = Math.floor(index / len);
    return baseMidi + oct * 12 + intervals[index % len];
  }

  /* ------------------------------------------------------------------ *
   *  Global state
   * ------------------------------------------------------------------ */

  var TICK_MS = 25;
  var LOOKAHEAD = 0.115;

  var state = {
    ctx: null,
    musicBus: null,
    sfxBus: null,
    master: null,
    muteGain: null,
    waves: null,
    noise: null,
    supported: true,
    unlocked: false,
    muted: false,
    volume: 0.8,
    track: 0,
    desired: null,
    current: null,
    lastStepSfx: -1
  };

  /* ------------------------------------------------------------------ *
   *  Audio graph
   * ------------------------------------------------------------------ */

  function makeNoiseBuffer(ctx) {
    var len = Math.max(1, Math.floor(ctx.sampleRate * 2));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  function makePulseWave(ctx, duty) {
    var harmonics = 32;
    var real = new Float32Array(harmonics + 1);
    var imag = new Float32Array(harmonics + 1);
    for (var n = 1; n <= harmonics; n++) {
      real[n] = (2 / (n * Math.PI)) * Math.sin(Math.PI * n * duty);
    }
    return ctx.createPeriodicWave(real, imag);
  }

  function waveFor(duty) {
    var ctx = state.ctx;
    if (!ctx || typeof ctx.createPeriodicWave !== 'function') { return null; }
    if (!state.waves) { state.waves = { p12: null, p25: null, p50: null }; }
    var key = duty < 0.2 ? 'p12' : (duty < 0.4 ? 'p25' : 'p50');
    if (!state.waves[key]) {
      try { state.waves[key] = makePulseWave(ctx, key === 'p12' ? 0.125 : (key === 'p25' ? 0.25 : 0.5)); }
      catch (e) { state.waves[key] = null; }
    }
    return state.waves[key];
  }

  function makePanner(pan) {
    var ctx = state.ctx;
    if (!ctx || typeof ctx.createStereoPanner !== 'function') { return null; }
    try {
      var p = ctx.createStereoPanner();
      p.pan.value = pan;
      return p;
    } catch (e) { return null; }
  }

  function buildGraph(ctx) {
    var mix = ctx.createGain();
    mix.gain.value = 1;
    var master = ctx.createGain();
    master.gain.value = state.volume;
    var mute = ctx.createGain();
    mute.gain.value = state.muted ? 0 : 1;
    var music = ctx.createGain();
    music.gain.value = 0.55;
    var sfx = ctx.createGain();
    sfx.gain.value = 0.95;

    connect(music, mix);
    connect(sfx, mix);

    if (typeof ctx.createDynamicsCompressor === 'function') {
      try {
        var comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 8;
        comp.ratio.value = 6;
        comp.attack.value = 0.004;
        comp.release.value = 0.2;
        connect(mix, comp);
        connect(comp, master);
      } catch (e) {
        connect(mix, master);
      }
    } else {
      connect(mix, master);
    }
    connect(master, mute);
    connect(mute, ctx.destination);

    state.musicBus = music;
    state.sfxBus = sfx;
    state.master = master;
    state.muteGain = mute;
  }

  function ensureGraph() {
    if (state.ctx && state.ctx.state !== 'closed') { return true; }
    if (!state.supported) { return false; }
    var Ctor = ROOT.AudioContext || ROOT.webkitAudioContext;
    if (!Ctor) { state.supported = false; return false; }

    var ctx;
    try { ctx = new Ctor(); } catch (e) { return false; }

    /* A closed context cannot be revived: drop the old player and rebuild. */
    if (state.current) {
      try { state.current.dispose(); } catch (e) { /* ignore */ }
      state.current = null;
    }

    try {
      state.ctx = ctx;
      state.waves = { p12: null, p25: null, p50: null };
      state.noise = makeNoiseBuffer(ctx);
      state.musicBus = null;
      state.sfxBus = null;
      state.master = null;
      state.muteGain = null;
      buildGraph(ctx);
      state.lastStepSfx = -1;
    } catch (e) {
      try { if (ctx.close) { ctx.close(); } } catch (e2) { /* ignore */ }
      state.ctx = null;
      state.musicBus = null;
      state.sfxBus = null;
      state.master = null;
      state.muteGain = null;
      return false;
    }
    return true;
  }

  /* ------------------------------------------------------------------ *
   *  Low-level synth primitives
   * ------------------------------------------------------------------ */

  /**
   * One enveloped oscillator note.
   * opts: { type, toFreq, detune, attack, release, pluck }
   */
  function tone(dest, t, hz, dur, wave, peak, opts) {
    var ctx = state.ctx;
    if (!ctx || !dest || !isFinite(hz) || hz <= 0) { return; }
    opts = opts || {};
    peak = Number(peak);
    if (!isFinite(peak) || peak <= 0) { return; }

    var d = Math.max(0.02, Number(dur) || 0.05);
    var g, osc;
    try {
      g = ctx.createGain();
      osc = ctx.createOscillator();
    } catch (e) { return; }

    try {
      if (wave && typeof osc.setPeriodicWave === 'function') {
        osc.setPeriodicWave(wave);
      } else {
        osc.type = opts.type || 'square';
      }
    } catch (e) {
      try { osc.type = 'square'; } catch (e2) { /* ignore */ }
    }

    try {
      osc.frequency.setValueAtTime(hz, t);
      if (opts.toFreq && opts.toFreq > 0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.toFreq), t + d);
      }
      if (opts.detune) {
        osc.detune.setValueAtTime(opts.detune, t);
      }
    } catch (e) { /* ignore */ }

    var atk = Math.max(0.002, Math.min(opts.attack || 0.006, d * 0.3));
    var rel = Math.min(opts.release || 0.04, d * 0.4);
    var sustain = Math.max(peak * 0.5, 0.0003);
    try {
      var p = g.gain;
      var t1 = t + atk;
      var t2 = t + Math.min(Math.max(atk + 0.075, 0.01), d * 0.5);
      var t3 = t + Math.max(atk + 0.085, d - rel);
      if (t3 >= t + d) { t3 = t + d - 0.002; }
      p.setValueAtTime(0.0001, t);
      p.linearRampToValueAtTime(peak, t1);
      if (opts.pluck) {
        p.exponentialRampToValueAtTime(Math.max(peak * 0.28, 0.0002),
          t + Math.min(d * 0.55, atk + 0.11));
        p.exponentialRampToValueAtTime(0.0006, t + d);
      } else {
        p.exponentialRampToValueAtTime(sustain, t2);
        if (t3 > t2 + 0.001) {
          p.setValueAtTime(sustain, t3);
        }
        p.exponentialRampToValueAtTime(0.0006, t + d);
      }
    } catch (e) { /* ignore */ }

    connect(osc, g);
    connect(g, dest);
    try {
      osc.start(t);
      osc.stop(t + d + 0.03);
    } catch (e) { /* ignore */ }
  }

  /** Filtered noise burst, optionally with a filter sweep. */
  function noiseHit(dest, t, dur, type, f0, f1, q, peak) {
    var ctx = state.ctx;
    if (!ctx || !dest || !state.noise) { return; }
    var src, filt, g;
    try {
      src = ctx.createBufferSource();
      filt = ctx.createBiquadFilter();
      g = ctx.createGain();
    } catch (e) { return; }

    try { src.buffer = state.noise; } catch (e) { /* ignore */ }
    try {
      filt.type = type || 'bandpass';
      filt.frequency.setValueAtTime(Math.max(30, f0), t);
      if (f1 && f1 > 0) {
        filt.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
      }
      if (q) { filt.Q.value = q; }
    } catch (e) { /* ignore */ }

    try {
      g.gain.setValueAtTime(Math.max(peak, 0.0002), t);
      g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    } catch (e) { /* ignore */ }

    connect(src, filt);
    connect(filt, g);
    connect(g, dest);
    try {
      src.start(t);
      src.stop(t + dur + 0.03);
    } catch (e) { /* ignore */ }
  }

  /* ---- drums ------------------------------------------------------- */

  function drumKick(dest, t, vol) {
    var ctx = state.ctx;
    if (!ctx || !dest) { return; }
    var osc, g;
    try {
      osc = ctx.createOscillator();
      g = ctx.createGain();
    } catch (e) { return; }
    try {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(158, t);
      osc.frequency.exponentialRampToValueAtTime(46, t + 0.12);
    } catch (e) { /* ignore */ }
    try {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0006, t + 0.26);
    } catch (e) { /* ignore */ }
    connect(osc, g);
    connect(g, dest);
    try { osc.start(t); osc.stop(t + 0.28); } catch (e) { /* ignore */ }
  }

  function drumSnare(dest, t, vol) {
    noiseHit(dest, t, 0.15, 'bandpass', 1750, 950, 1.1, vol);
    var ctx = state.ctx;
    if (!ctx || !dest) { return; }
    var osc, g;
    try {
      osc = ctx.createOscillator();
      g = ctx.createGain();
    } catch (e) { return; }
    try {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    } catch (e) { /* ignore */ }
    try {
      g.gain.setValueAtTime(vol * 0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0006, t + 0.1);
    } catch (e) { /* ignore */ }
    connect(osc, g);
    connect(g, dest);
    try { osc.start(t); osc.stop(t + 0.12); } catch (e) { /* ignore */ }
  }

  function drumHat(dest, t, vol, open) {
    var d = open ? 0.14 : 0.05;
    noiseHit(dest, t, d, 'highpass', 7200, 9000, 0.8, vol);
  }

  /* ------------------------------------------------------------------ *
   *  Sound effects
   * ------------------------------------------------------------------ */

  function playSfx(name, t) {
    var bus = state.sfxBus;
    if (!bus) { return false; }
    var w25 = waveFor(0.25);
    var w12 = waveFor(0.125);
    var w50 = waveFor(0.5);
    var i, seq;

    switch (name) {
      case 'gold': {
        seq = [1318.5, 1568.0, 2093.0, 2637.0];
        for (i = 0; i < seq.length; i++) {
          tone(bus, t + i * 0.045, seq[i], 0.1, w25, 0.26, { attack: 0.002, pluck: true, release: 0.02 });
        }
        noiseHit(bus, t, 0.035, 'highpass', 6500, 9000, 0.9, 0.05);
        return true;
      }
      case 'dig': {
        noiseHit(bus, t, 0.14, 'lowpass', 2400, 220, 0.7, 0.34);
        noiseHit(bus, t + 0.015, 0.1, 'bandpass', 950, 320, 1.3, 0.2);
        tone(bus, t, 120, 0.1, null, 0.18, { type: 'square', toFreq: 58, attack: 0.002 });
        return true;
      }
      case 'trap': {
        tone(bus, t, 540, 0.3, w50, 0.24, { toFreq: 118, attack: 0.002, release: 0.05 });
        tone(bus, t + 0.03, 270, 0.26, null, 0.1, { type: 'triangle', toFreq: 70, attack: 0.002 });
        noiseHit(bus, t + 0.02, 0.2, 'lowpass', 1600, 240, 1, 0.16);
        return true;
      }
      case 'die': {
        tone(bus, t, 430, 0.7, w25, 0.28, { toFreq: 55, attack: 0.004, release: 0.12 });
        tone(bus, t + 0.04, 215, 0.6, null, 0.11, { type: 'sawtooth', toFreq: 41, attack: 0.004 });
        noiseHit(bus, t, 0.5, 'lowpass', 1400, 120, 0.8, 0.2);
        tone(bus, t + 0.52, 70, 0.22, null, 0.14, { type: 'triangle', toFreq: 38, attack: 0.002 });
        return true;
      }
      case 'win': {
        seq = [523.25, 659.25, 783.99, 1046.5];
        for (i = 0; i < seq.length; i++) {
          tone(bus, t + i * 0.13, seq[i], 0.2, w25, 0.26, { attack: 0.003, pluck: true, release: 0.03 });
        }
        var chord = [1046.5, 1318.5, 1568.0];
        for (i = 0; i < chord.length; i++) {
          tone(bus, t + 0.56, chord[i], 0.55, w25, 0.17, { attack: 0.01, release: 0.15, pluck: false });
        }
        noiseHit(bus, t + 0.55, 0.4, 'highpass', 5000, 9000, 0.8, 0.05);
        return true;
      }
      case 'exit': {
        tone(bus, t, 196, 0.6, null, 0.26, { type: 'triangle', toFreq: 784, attack: 0.05, release: 0.1 });
        tone(bus, t + 0.08, 392, 0.55, w12, 0.15, { toFreq: 1568, attack: 0.03, release: 0.1 });
        tone(bus, t + 0.34, 1046.5, 0.3, w12, 0.08, { toFreq: 2093, attack: 0.02 });
        noiseHit(bus, t + 0.25, 0.3, 'highpass', 3200, 8000, 0.9, 0.06);
        return true;
      }
      case 'click': {
        tone(bus, t, 1250, 0.035, w50, 0.15, { attack: 0.001, release: 0.005 });
        return true;
      }
      case 'step': {
        noiseHit(bus, t, 0.035, 'bandpass', 3200, 2200, 1.4, 0.09);
        tone(bus, t, 150, 0.03, null, 0.06, { type: 'triangle', attack: 0.001 });
        return true;
      }
      case 'life': {
        tone(bus, t, 783.99, 0.16, w25, 0.24, { attack: 0.002, pluck: true, release: 0.02 });
        tone(bus, t + 0.13, 1174.66, 0.4, w25, 0.22, { attack: 0.002, release: 0.08 });
        tone(bus, t + 0.13, 1567.98, 0.35, w12, 0.08, { attack: 0.004, release: 0.06 });
        return true;
      }
      default:
        return false;
    }
  }

  /* ------------------------------------------------------------------ *
   *  Music: rhythm / bass / arp / drum patterns
   * ------------------------------------------------------------------ */

  /* Offsets in semitones from the chord root; token = step:offset[:length]. */
  var BASSLINES = {
    drive:  '0:0 2:0 4:7 6:0 8:0 10:12 12:7 14:0',
    drive2: '0:0 2:0 3:12 4:7 6:0 8:0 10:10 11:12 12:7 13:0 14:0',
    skip:   '1:0 3:12 5:7 7:0 9:0 11:12 13:7 15:10',
    skip2:  '0:0 2:12 3:7 4:0 6:0 8:0 9:12 10:7 12:7 14:12 15:0',
    slow:   '0:0:8 8:7:8',
    slow2:  '0:0:4 4:12:4 8:7:4 12:10:4'
  };

  /* One char per 16th step; '.' = no hit. */
  var DRUM_PATTERNS = {
    main:  { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    main2: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '..............x.' },
    fill:  { k: 'x..x..x.x...x.x.', s: '....x.......x.xx', h: 'x.x.x.x.x.x.....', o: '..............x.' },
    push:  { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', o: '..x...x...x...x.' },
    push2: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '.x...x...x...x..' },
    fill2: { k: 'x..x..x.x...x.xx', s: '....x.......x.x.', h: 'x.x.x.x.x.x.x.x.', o: '' },
    clock: { k: 'x.......x.......', s: '................', h: 'x...x...x...x...' }
  };

  /* Arpeggio patterns: indices into the extended chord [root, 3rd, 5th, oct, ...]. */
  var ARPS = {
    pulse:  { rate: 2, pat: [0, 2, 1, 2, 0, 2, 1, 3] },
    pulseB: { rate: 2, pat: [0, 1, 2, 3, 2, 1, 2, 0] },
    drift:  { rate: 3, pat: [0, 2, 1, 3, 2, 1] },
    drive:  { rate: 1, pat: [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0, 2, 1, 3, 2, 1] },
    driveB: { rate: 1, pat: [0, 2, 1, 3, 2, 4, 3, 5, 4, 2, 1, 3, 2, 0, 1, 2] }
  };

  /* ------------------------------------------------------------------ *
   *  Music: songs (original compositions)
   * ------------------------------------------------------------------ */

  var TITLE_DEF = {
    bpm: 78,
    leadGain: 0.16, bassGain: 0.26, arpGain: 0.05, drumGain: 0.4,
    leadDuty: 0.125, arpDuty: 0.125, leadDetune: 7,
    leadLen: 3, bassLen: 8,
    arp: 'drift', arpOctave: 0, fadeIn: 1.4,
    fx: { echo: { time: 0.36, feedback: 0.34, mix: 0.32 } },
    bars: [
      /* 1 */ { chord: 'Dm', lead: '0:D5:3 3:F5:3 6:A5:4 12:G5:2 14:F5:2', bass: 'slow',  drums: 'clock' },
      /* 2 */ { chord: 'Bb', lead: '0:Bb4:3 3:D5:3 6:F5:4 12:E5:2 14:D5:2', bass: 'slow',  drums: 'clock' },
      /* 3 */ { chord: 'F',  lead: '0:C5:3 3:E5:3 6:A5:6 12:G5:4',            bass: 'slow2', drums: 'clock' },
      /* 4 */ { chord: 'A',  lead: '0:C#5:4 4:E5:4 8:A5:8',                    bass: 'slow',  drums: 'clock' },
      /* 5 */ { chord: 'Dm', lead: '0:A5:3 3:G5:3 6:F5:3 9:E5:3 12:D5:4',      bass: 'slow2', drums: 'clock' },
      /* 6 */ { chord: 'Bb', lead: '0:D6:4 4:C6:4 8:Bb5:4 12:A5:4',            bass: 'slow',  drums: 'clock' },
      /* 7 */ { chord: 'Gm', lead: '0:G5:3 3:Bb5:3 6:D6:4 10:F6:2 12:D6:2 14:Bb5:2', bass: 'slow2', drums: 'clock' },
      /* 8 */ { chord: 'A',  lead: '0:C#6:4 4:E6:4 8:A5:8',                    bass: 'slow',  drums: 'clock' }
    ]
  };

  var GAME0_DEF = {
    bpm: 132,
    leadGain: 0.22, bassGain: 0.30, arpGain: 0.085, drumGain: 1,
    leadDuty: 0.25, arpDuty: 0.125, leadDetune: 0,
    leadLen: 2, bassLen: 1.6,
    arp: 'pulse', arpOctave: 0, fadeIn: 0.7,
    bars: [
      /* A: Am — F — C — G */
      { chord: 'Am', lead: '0:A4:2 2:C5:2 4:E5:2 6:A5:4 12:G5:2 14:E5:2',             bass: 'drive',  drums: 'main' },
      { chord: 'F',  lead: '0:F5:2 2:E5:2 4:C5:4 8:A4:2 10:C5:2 12:F5:2 14:E5:2',    bass: 'drive',  drums: 'main' },
      { chord: 'C',  lead: '0:G5:2 2:E5:2 4:C5:2 6:E5:2 8:G5:4 12:E5:2 14:G5:2',     bass: 'drive',  drums: 'main' },
      { chord: 'G',  lead: '0:B4:2 2:D5:2 4:G5:4 8:F5:2 10:D5:2 12:B4:4',            bass: 'drive',  drums: 'main2' },
      /* B: variation over Am — F — Dm — E */
      { chord: 'Am', lead: '0:E5:2 2:A5:2 4:G5:2 6:E5:2 8:C5:2 10:A4:2 12:C5:2 14:E5:2', bass: 'drive2', drums: 'main',  arp: 'pulseB' },
      { chord: 'F',  lead: '0:A5:2 2:G5:2 4:E5:2 6:C5:2 8:A4:4 12:C5:2 14:E5:2',     bass: 'drive2', drums: 'main',  arp: 'pulseB' },
      { chord: 'Dm', lead: '0:D5:2 2:F5:2 4:A5:4 8:G5:2 10:F5:2 12:E5:4',            bass: 'drive2', drums: 'main',  arp: 'pulseB' },
      { chord: 'E',  lead: '0:E5:2 2:G#5:2 4:B5:2 6:E6:4 12:D6:2 14:B5:2',           bass: 'drive2', drums: 'fill',  arp: 'pulseB' }
    ]
  };

  var GAME1_DEF = {
    bpm: 140,
    leadGain: 0.19, bassGain: 0.30, arpGain: 0.075, drumGain: 1,
    leadDuty: 0.5, arpDuty: 0.25, leadDetune: 0,
    leadLen: 2, bassLen: 1.6,
    arp: 'drive', arpOctave: 0, fadeIn: 0.7,
    bars: [
      /* A: Em — C — D — B (harmonic minor colour) */
      { chord: 'Em', lead: '0:B4:2 2:E5:2 4:G5:2 6:B5:4 12:A5:2 14:G5:2',            bass: 'skip',  drums: 'push' },
      { chord: 'C',  lead: '0:G5:2 2:E5:2 4:C5:2 6:E5:2 8:G5:2 10:C6:2 12:B5:4',     bass: 'skip',  drums: 'push' },
      { chord: 'D',  lead: '0:A5:2 2:F#5:2 4:D5:2 6:F#5:2 8:A5:2 10:D6:2 12:A5:4',   bass: 'skip',  drums: 'push2', arp: 'driveB' },
      { chord: 'B',  lead: '0:F#5:2 2:D#5:2 4:B4:2 6:D#5:2 8:F#5:2 10:B5:4 14:A5:2', bass: 'skip',  drums: 'fill2' },
      /* B: Em — C — Am — B */
      { chord: 'Em', lead: '0:E6:2 2:D6:2 4:B5:2 6:G5:2 8:B5:2 10:E6:2 12:D6:4',     bass: 'skip2', drums: 'push',  arp: 'driveB' },
      { chord: 'C',  lead: '0:C6:2 2:B5:2 4:G5:2 6:E5:2 8:G5:2 10:C6:2 12:E6:4',     bass: 'skip2', drums: 'push' },
      { chord: 'Am', lead: '0:A5:2 2:C6:2 4:E6:2 6:A6:2 8:G6:2 10:E6:2 12:C6:4',     bass: 'skip2', drums: 'push',  arp: 'driveB' },
      { chord: 'B',  lead: '0:B5:2 2:F#6:2 4:D#6:2 6:B5:4 12:F#5:2 14:D#5:2',        bass: 'skip2', drums: 'fill2' }
    ]
  };

  /* ------------------------------------------------------------------ *
   *  Music: compile song data into per-step lookup tables
   * ------------------------------------------------------------------ */

  function compileEvents(str, toFreq, defaultLen) {
    var out = [];
    var i;
    for (i = 0; i < 16; i++) { out.push([]); }
    if (!str) { return out; }

    var tokens = String(str).replace(/^\s+|\s+$/g, '').split(/\s+/);
    for (i = 0; i < tokens.length; i++) {
      if (!tokens[i]) { continue; }
      var parts = tokens[i].split(':');
      var step = parseInt(parts[0], 10);
      if (!(step >= 0 && step < 16)) { continue; }
      var hz = toFreq(parts[1]);
      if (!hz || !isFinite(hz)) { continue; }
      var len = parts.length > 2 ? parseFloat(parts[2]) : defaultLen;
      if (!(len > 0)) { len = defaultLen; }
      out[step].push({ f: hz, d: len });
    }
    return out;
  }

  function compileDrums(name) {
    var out = [];
    var i, lane;
    for (i = 0; i < 16; i++) { out.push([]); }
    var pat = DRUM_PATTERNS[name];
    if (!pat) { return out; }
    var lanes = ['k', 's', 'h', 'o'];
    for (var l = 0; l < lanes.length; l++) {
      lane = lanes[l];
      var line = pat[lane] || '';
      for (i = 0; i < line.length && i < 16; i++) {
        var c = line.charAt(i);
        if (c !== '.' && c !== ' ') { out[i].push(lane); }
      }
    }
    return out;
  }

  function compileSong(def) {
    var song = {
      bpm: def.bpm,
      stepDur: 60 / def.bpm / 4,
      bars: [],
      leadGain: def.leadGain,
      bassGain: def.bassGain,
      arpGain: def.arpGain,
      drumGain: def.drumGain,
      leadDuty: def.leadDuty || 0.25,
      arpDuty: def.arpDuty || 0.125,
      leadDetune: def.leadDetune || 0,
      leadLen: def.leadLen || 2,
      bassLen: def.bassLen || 1.5,
      fadeIn: def.fadeIn || 0.7,
      fx: def.fx || null,
      barCount: def.bars.length
    };

    for (var b = 0; b < def.bars.length; b++) {
      var bar = def.bars[b];
      var ch = parseChord(bar.chord);
      var arpBase = 48 + ch.root + (def.arpOctave || 0) * 12;
      var arpDef = ARPS[bar.arp || def.arp];
      var arp = null;
      var p;

      if (arpDef) {
        arp = { rate: arpDef.rate, slots: [] };
        for (p = 0; p < 16; p++) { arp.slots.push(null); }
        for (p = 0; p < 16; p++) {
          if (p % arpDef.rate !== 0) { continue; }
          var patLen = arpDef.pat.length;
          var idx = arpDef.pat[((p / arpDef.rate) + b * 0) % patLen];
          arp.slots[p] = midiToFreq(chordTone(arpBase, ch.intervals, idx));
        }
      }

      var bassSrc = BASSLINES[bar.bass] || bar.bass || '';
      var bassRoot = 36 + ch.root;

      song.bars.push({
        lead: compileEvents(bar.lead, noteFreq, song.leadLen),
        bass: compileEvents(bassSrc, function (tok) {
          var off = parseInt(tok, 10);
          if (!isFinite(off)) { off = 0; }
          return midiToFreq(bassRoot + off);
        }, song.bassLen),
        drums: compileDrums(bar.drums),
        arp: arp
      });
    }
    return song;
  }

  var SONGS = {
    title: compileSong(TITLE_DEF),
    game0: compileSong(GAME0_DEF),
    game1: compileSong(GAME1_DEF)
  };

  function songFor(mode, track) {
    if (mode === 'title') { return SONGS.title; }
    return track === 1 ? SONGS.game1 : SONGS.game0;
  }

  /* ------------------------------------------------------------------ *
   *  Echo send (used by the title theme)
   * ------------------------------------------------------------------ */

  function makeEcho(dest, cfg) {
    var ctx = state.ctx;
    if (!ctx || typeof ctx.createDelay !== 'function') { return null; }
    var input = ctx.createGain();
    var dry = ctx.createGain();
    dry.gain.value = 1;
    var delay = ctx.createDelay(2);
    delay.delayTime.value = clamp(cfg.time, 0.02, 1.9);
    var fb = ctx.createGain();
    fb.gain.value = clamp(cfg.feedback, 0, 0.8);
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    var wet = ctx.createGain();
    wet.gain.value = clamp(cfg.mix, 0, 0.8);

    connect(input, dry);
    connect(dry, dest);
    connect(input, delay);
    connect(delay, filter);
    connect(filter, fb);
    connect(fb, delay);
    connect(filter, wet);
    connect(wet, dest);

    return { input: input, nodes: [input, dry, delay, fb, filter, wet] };
  }

  /* ------------------------------------------------------------------ *
   *  Music player + lookahead sequencer
   * ------------------------------------------------------------------ */

  function Player(key, song) {
    this.key = key;
    this.song = song;
    this.gain = null;
    this.fx = null;
    this.arpPan = null;
    this.timer = 0;
    this.disposeTimer = 0;
    this.step = 0;
    this.startTime = 0;
    this.stopping = false;
    this.disposed = false;
  }

  Player.prototype.start = function () {
    var ctx = state.ctx;
    if (!ctx || this.disposed) { return; }
    var self = this;
    try {
      this.gain = ctx.createGain();
      var p = this.gain.gain;
      p.setValueAtTime(0.0001, ctx.currentTime);
      p.linearRampToValueAtTime(1, ctx.currentTime + this.song.fadeIn);
      connect(this.gain, state.musicBus);

      if (this.song.fx && this.song.fx.echo) {
        try { this.fx = makeEcho(this.gain, this.song.fx.echo); } catch (e) { this.fx = null; }
      }
      this.arpPan = makePanner(-0.22);
      if (this.arpPan) {
        connect(this.arpPan, this.fx ? this.fx.input : this.gain);
      }

      this.startTime = ctx.currentTime + 0.12;
      this.step = 0;
      this.timer = every(function () { self.tick(); }, TICK_MS);
      this.tick();
    } catch (e) {
      this.dispose();
    }
  };

  Player.prototype.tick = function () {
    var ctx = state.ctx;
    if (!ctx || this.disposed || this.stopping) { return; }
    try {
      var now = ctx.currentTime;
      var stepDur = this.song.stepDur;
      /* If the tab was suspended, re-align instead of dumping a burst of notes. */
      if (this.startTime + this.step * stepDur < now - 0.45) {
        this.startTime = now + 0.06;
        this.step = 0;
      }
      var guard = 0;
      while (this.startTime + this.step * stepDur < now + LOOKAHEAD && guard < 64) {
        this.schedule(this.step, this.startTime + this.step * stepDur);
        this.step++;
        guard++;
      }
    } catch (e) { /* never let the scheduler throw */ }
  };

  Player.prototype.schedule = function (stepIndex, t) {
    var song = this.song;
    var barIdx = Math.floor(stepIndex / 16) % song.barCount;
    var pos = stepIndex % 16;
    var bar = song.bars[barIdx];
    var leadDest = this.fx ? this.fx.input : this.gain;
    var arpDest = this.arpPan || leadDest;
    var stepDur = song.stepDur;
    var i, ev, list;

    /* Lead (pulse) */
    list = bar.lead[pos];
    for (i = 0; i < list.length; i++) {
      ev = list[i];
      var dur = ev.d * stepDur;
      tone(leadDest, t, ev.f, dur, waveFor(song.leadDuty), song.leadGain, { attack: 0.008, release: 0.05 });
      if (song.leadDetune) {
        tone(leadDest, t, ev.f, dur, waveFor(song.leadDuty), song.leadGain * 0.4,
          { attack: 0.012, release: 0.06, detune: song.leadDetune });
      }
    }

    /* Bass (triangle) */
    list = bar.bass[pos];
    for (i = 0; i < list.length; i++) {
      ev = list[i];
      tone(this.gain, t, ev.f, ev.d * stepDur, null, song.bassGain,
        { type: 'triangle', attack: 0.005, release: 0.03, pluck: true });
    }

    /* Arpeggio (pulse, panned a bit) */
    if (bar.arp) {
      var slot = bar.arp.slots[pos];
      if (slot !== null) {
        tone(arpDest, t, slot, stepDur * 0.85, waveFor(song.arpDuty), song.arpGain,
          { attack: 0.003, release: 0.02, pluck: true });
      }
    }

    /* Drums */
    var drumGain = song.drumGain || 0;
    list = bar.drums[pos];
    for (i = 0; i < list.length; i++) {
      if (list[i] === 'k') { drumKick(this.gain, t, 0.9 * drumGain); }
      else if (list[i] === 's') { drumSnare(this.gain, t, 0.5 * drumGain); }
      else if (list[i] === 'h') { drumHat(this.gain, t, 0.17 * drumGain, false); }
      else if (list[i] === 'o') { drumHat(this.gain, t, 0.15 * drumGain, true); }
    }
  };

  Player.prototype.stop = function (fade) {
    if (this.stopping || this.disposed) { return; }
    this.stopping = true;
    if (this.timer) { stopTimer(this.timer); this.timer = 0; }

    var ctx = state.ctx;
    var self = this;
    fade = clamp(fade, 0.05, 3);

    if (ctx && this.gain) {
      try {
        var p = this.gain.gain;
        var cur = Number(p.value);
        if (!isFinite(cur) || cur <= 0) { cur = 0.0001; }
        var now = ctx.currentTime;
        p.cancelScheduledValues(now);
        p.setValueAtTime(cur, now);
        p.linearRampToValueAtTime(0.0001, now + fade);
      } catch (e) { /* ignore */ }
    }

    this.disposeTimer = later(function () { self.dispose(); }, Math.round((fade + 0.2) * 1000));
  };

  Player.prototype.dispose = function () {
    if (this.disposed) { return; }
    this.disposed = true;
    if (this.timer) { stopTimer(this.timer); this.timer = 0; }
    if (this.disposeTimer) { stopTimer(this.disposeTimer); this.disposeTimer = 0; }
    var i;
    if (this.fx) {
      for (i = 0; i < this.fx.nodes.length; i++) { disconnect(this.fx.nodes[i]); }
      this.fx = null;
    }
    disconnect(this.arpPan);
    this.arpPan = null;
    disconnect(this.gain);
    this.gain = null;
  };

  /* ------------------------------------------------------------------ *
   *  Public API implementation
   * ------------------------------------------------------------------ */

  function resumeCtx() {
    var ctx = state.ctx;
    if (!ctx || typeof ctx.resume !== 'function') { return null; }
    if (ctx.state !== 'suspended') { return null; }
    try { return ctx.resume(); } catch (e) { return null; }
  }

  function afterUnlock() {
    try {
      if (!state.ctx) { return; }
      if (state.desired) {
        var mode = state.desired;
        state.desired = null;
        startMusic(mode);
      }
    } catch (e) { /* ignore */ }
  }

  function unlock() {
    try {
      if (!ensureGraph()) { return false; }
      state.unlocked = true;
      var ctx = state.ctx;
      var result = resumeCtx();
      if (result && typeof result.then === 'function') {
        result.then(afterUnlock, function () { /* gesture not accepted yet */ });
      } else if (!result && ctx && ctx.state !== 'suspended') {
        afterUnlock();
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function keyFor(mode) {
    if (mode === 'title') { return 'title'; }
    return state.track === 1 ? 'game1' : 'game0';
  }

  function startMusic(mode) {
    try {
      if (mode !== 'title' && mode !== 'game') { return false; }
      if (!state.ctx) {
        state.desired = mode;
        return true;
      }
      if (state.ctx.state === 'closed') {
        state.ctx = null;
        state.desired = mode;
        return true;
      }

      var key = keyFor(mode);
      if (state.current && state.current.key === key && !state.current.stopping) {
        state.desired = mode;
        return true; /* idempotent: do not spawn a parallel track */
      }

      var player = new Player(key, songFor(mode, state.track));
      player.start();
      if (player.disposed) { return false; }

      state.desired = mode;
      if (state.current) { state.current.stop(0.45); }
      state.current = player;

      resumeCtx();
      return true;
    } catch (e) {
      return false;
    }
  }

  function stopMusic() {
    try {
      state.desired = null;
      if (state.current) {
        state.current.stop(0.35);
        state.current = null;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function setGameTrack(index) {
    try {
      var idx = Number(index) === 1 ? 1 : 0;
      if (state.track === idx) { return idx; }
      state.track = idx;
      if (state.current && (state.current.key === 'game0' || state.current.key === 'game1')) {
        startMusic('game'); /* smooth crossfade to the other game track */
      }
      return idx;
    } catch (e) {
      return state.track;
    }
  }

  function playSfxSafe(name) {
    try {
      var ctx = state.ctx;
      if (!ctx) { return false; }
      if (state.muted) { return false; }
      if (ctx.state !== 'running') { return false; }
      if (name === 'step') {
        var now = ctx.currentTime;
        if (now - state.lastStepSfx < 0.05 && state.lastStepSfx >= 0) { return false; }
        state.lastStepSfx = now;
      }
      var t = ctx.currentTime + 0.006;
      return playSfx(name, t);
    } catch (e) {
      return false;
    }
  }

  function setMuted(muted) {
    try {
      state.muted = !!muted;
      if (state.muteGain && state.ctx) {
        try {
          var p = state.muteGain.gain;
          var now = state.ctx.currentTime;
          p.cancelScheduledValues(now);
          p.setValueAtTime(Number(p.value) || 0, now);
          p.linearRampToValueAtTime(state.muted ? 0 : 1, now + 0.08);
        } catch (e) { /* ignore */ }
      }
      if (!state.muted) { resumeCtx(); }
      return state.muted;
    } catch (e) {
      return state.muted;
    }
  }

  function toggleMuted() {
    return setMuted(!state.muted);
  }

  function getMuted() {
    return !!state.muted;
  }

  function setVolume(v) {
    try {
      var n = Number(v);
      if (!isFinite(n)) { return state.volume; }
      state.volume = clamp(n, 0, 1);
      if (state.master && state.ctx) {
        try {
          var p = state.master.gain;
          var now = state.ctx.currentTime;
          p.cancelScheduledValues(now);
          p.setValueAtTime(Number(p.value) || 0, now);
          p.linearRampToValueAtTime(state.volume, now + 0.06);
        } catch (e) { /* ignore */ }
      }
      return state.volume;
    } catch (e) {
      return state.volume;
    }
  }

  function isReady() {
    try {
      return !!(state.ctx && state.ctx.state !== 'closed');
    } catch (e) {
      return false;
    }
  }

  ROOT.LR.audio = {
    unlock: unlock,
    startMusic: startMusic,
    stopMusic: stopMusic,
    setGameTrack: setGameTrack,
    sfx: playSfxSafe,
    setMuted: setMuted,
    toggleMuted: toggleMuted,
    getMuted: getMuted,
    setVolume: setVolume,
    isReady: isReady
  };
})();
