/* ============================================================
   НЕОН × ЯРОСТЬ: NEON RAGE — 8-bit / synthwave audio engine
   ------------------------------------------------------------
   One classic script, no modules, no assets, no network: defines window.DD_AUDIO.
   Everything is synthesised with WebAudio (pulse / triangle / noise / saw),
   no samples, no external files, file:// and headless safe.

   API (docs/CONTRACT.md §3):
     init()                 idempotent; creates the AudioContext + graph
     unlock()               call from a user gesture; may return a Promise
     ready()                true when the AudioContext is running
     setMusic(bool)         silence/restore music, remembers the current track
     setSfx(bool)           silence/restore SFX
     setVolume(0..1)        master volume (music + sfx), hard-capped
     setStyle('chip'|'synth')  live crossfade between 8-bit and synthwave mixes
     playMusic(id)          'title'|'select'|'battle'|'boss'|'victory'|'gameover'
     stopMusic()            fade out and dispose
     duck(bool)             smooth music ducking for the pause screen
     intensity(0..1)        battle/boss layer density + synth filter opening
     sfx(id)                22 one-shot effects
     state()                { ready, playing, style, music, sfx, volume, notes, ... }

   ARCHITECTURE
     lookahead sequencer (setInterval 25 ms, schedules 120 ms ahead), all note
     times are absolute AudioContext times; 4 channels like NES/ZX —
       lead  pulse (chip) / detuned saw pair (synth),
       harm  pulse arpeggio (chip) / filtered saw arpeggio (synth),
       bass  triangle (chip) / saw+sub (synth),
       drums noise + pitched sines.
     Synth style repaints the same compositions with pads, delay and stereo width.
     Style buses crossfade on the fly; tracks crossfade into each other.
     A DynamicsCompressor is the master limiter (hearing protection).

   PATTERN NOTATION (16 steps = one 4/4 bar):
     lead  "step:Note:length[:velocity]"   e.g. "0:D5:2 4:F#5:4"
     bass  "step:semitones:length"         semitones from the chord root
     arp   chord-tone pattern index, see ARP_DEFS
     drums one char per 16th: k/s/h/o/c/t lanes ('X' = accent)
   All melodies below are original compositions written for this game.
   ============================================================ */
(function () {
  'use strict';

  var ROOT = (typeof window !== 'undefined' && window) ||
             (typeof globalThis !== 'undefined' && globalThis) || {};

  /* never install twice (build may include the file once anyway) */
  if (ROOT.DD_AUDIO && ROOT.DD_AUDIO.__engine === 'dd-neon-1') { return; }

  var AC = (typeof window !== 'undefined') &&
           (window.AudioContext || window.webkitAudioContext) || null;

  /* ============================================================
     0. UTILITIES
     ============================================================ */
  function clamp(v, lo, hi) {
    v = Number(v);
    if (!isFinite(v)) { return lo; }
    return v < lo ? lo : (v > hi ? hi : v);
  }
  function connect(a, b) {
    if (!a || !b) { return false; }
    try { a.connect(b); return true; } catch (e) { return false; }
  }
  function disconnect(n) {
    if (!n) { return; }
    try { n.disconnect(); } catch (e) { /* ignore */ }
  }
  function every(fn, ms) {
    try { return setInterval(fn, ms); } catch (e) { return 0; }
  }
  function later(fn, ms) {
    try { return setTimeout(fn, ms); } catch (e) { return 0; }
  }
  function stopTimer(id) {
    if (!id) { return; }
    try { clearInterval(id); } catch (e) { /* ignore */ }
    try { clearTimeout(id); } catch (e) { /* ignore */ }
  }

  /* ============================================================
     1. MUSIC THEORY
     ============================================================ */
  var PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  var NOTE_RE = /^([A-Ga-g])([#b]?)(-?\d)$/;
  var FREQ_CACHE = {};

  function noteToMidi(name) {
    var m = NOTE_RE.exec(String(name == null ? '' : name));
    if (!m) { return null; }
    var pc = PC[m[1].toUpperCase() + m[2]];
    return pc === undefined ? null : (parseInt(m[3], 10) + 1) * 12 + pc;
  }
  function midiToFreq(midi) { return 440 * Math.pow(2, ((Number(midi) || 0) - 69) / 12); }
  function noteFreq(name) {
    var key = String(name == null ? '' : name);
    if (Object.prototype.hasOwnProperty.call(FREQ_CACHE, key)) { return FREQ_CACHE[key]; }
    var midi = noteToMidi(key);
    return (FREQ_CACHE[key] = midi === null ? null : midiToFreq(midi));
  }

  var CHORD_TYPES = {
    '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10],
    maj7: [0, 4, 7, 11], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9],
    dim: [0, 3, 6], aug: [0, 4, 8], sus: [0, 5, 7], sus2: [0, 2, 7]
  };
  var CHORD_RE = /^([A-G][#b]?)(maj7|sus2|m7|m6|dim|aug|sus|7|6|m)?$/;
  function parseChord(name) {
    var m = CHORD_RE.exec(String(name || ''));
    if (!m) { return { name: 'C', root: 0, intervals: CHORD_TYPES[''] }; }
    var root = PC[m[1]];
    return { name: name, root: root === undefined ? 0 : root, intervals: CHORD_TYPES[m[2] || ''] || CHORD_TYPES[''] };
  }
  function chordTone(baseMidi, intervals, index) {
    var len = intervals.length, oct = Math.floor(index / len);
    return baseMidi + oct * 12 + intervals[index % len];
  }

  /* ============================================================
     2. COMPOSITION VOCABULARY (original score data)
     ============================================================ */
  /* drum lanes, one char per 16th step; uppercase = accent */
  var DRUM_DEFS = {
    titleA:  { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' },
    titleB:  { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x.x.x.' },
    titleF:  { k: 'x...x...x...x...', s: '....x.......xxxx', h: '..x...x.........' },

    selectA: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    selectB: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
    selectF: { k: 'x..x..x.x..x..x.', s: '....x.......xxxx', h: 'x.x.x.x.........' },

    battleA: { k: 'x.k.x.k.x.k.x.k.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    battleB: { k: 'X.x.X.x.X.x.X.x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
    battleF: { k: 'x.k.x.k.x...x...', s: '....x.....xxxxxx', h: 'x.x.x.x.........' },

    bossA:   { k: 'x.k.x.k.x.k.x.k.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', o: '..x...x...x...x.' },
    bossB:   { k: 'X.x.X.x.X.x.X.x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', c: 'x...............' },
    bossF:   { k: 'x.k.x.k.x...x...', s: '....x.....xxxxxx', h: 'xxxxxxxx........', t: '........x..x....' },

    victoryA:{ k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    victoryF:{ k: 'x...x...x...x...', s: '....x.......xxxx', h: 'x.x.x.x.........' },

    overA:   { k: 'x.......x.......', s: '................', h: '..............x.' },
    overF:   { k: 'x...............', s: '................', h: '................' }
  };

  /* bass: step:semitone-offset-from-chord-root:length */
  var BASS_DEFS = {
    long:    '0:0:4 4:0:4 8:7:4 12:12:4',
    long2:   '0:0:4 4:7:4 8:0:4 12:12:2 14:7:2',
    pulse:   '0:0:2 2:0:2 4:7:2 6:0:2 8:0:2 10:12:2 12:7:2 14:0:2',
    drive:   '0:0:2 2:0:2 4:0:2 6:0:2 8:7:2 10:7:2 12:12:2 14:7:2',
    drive2:  '0:0:2 2:12:2 4:0:2 6:7:2 8:0:2 10:7:2 12:12:2 14:7:2',
    minorWalk:'0:0:2 2:3:2 4:5:2 6:7:2 8:10:2 10:7:2 12:5:2 14:3:2',
    battle:  '0:0:2 2:0:1 3:0:1 4:7:2 6:0:2 8:0:2 10:12:2 12:7:2 14:5:2',
    battle2: '0:0:1 1:0:1 2:12:2 4:0:2 6:7:2 8:0:2 10:12:2 12:7:2 14:3:2',
    boss:    '0:0:1 1:0:1 2:0:2 4:6:2 6:0:2 8:7:2 10:0:2 12:6:2 14:1:2',
    boss2:   '0:0:2 2:6:2 4:0:2 6:6:2 8:0:2 10:6:2 12:7:2 14:6:2',
    fanfare: '0:0:2 4:7:2 8:12:2 12:7:2',
    fanfare2:'0:0:4 4:5:4 8:7:4 12:12:4',
    sad:     '0:0:4 4:0:4 8:7:4 12:10:4',
    sad2:    '0:0:4 4:7:4 8:5:4 12:3:4'
  };

  /* arpeggio: rate = steps between notes, pat = chord-tone indices */
  var ARP_DEFS = {
    slow:   { rate: 4, pat: [0, 2, 1, 2] },
    sparse: { rate: 4, pat: [0, 1, 2, 1] },
    bounce: { rate: 2, pat: [0, 2, 1, 2, 0, 2, 1, 3] },
    drive:  { rate: 2, pat: [0, 1, 2, 3, 2, 1, 0, 2] },
    pulse:  { rate: 2, pat: [0, 2, 3, 2, 1, 0, 1, 2] },
    tense:  { rate: 1, pat: [0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 2, 1, 0, 1, 0, 2] }
  };

  /* ------------------------------------------------------------------
     ORIGINAL SOUNDTRACK
     Six pieces, one shared material set, two orchestrations.
     title    — 96 BPM, D minor, moody neon-noir evening
     select   — 132 BPM, A minor, driving arcade menu
     battle   — 152 BPM, D harmonic minor, aggressive street fight
     boss     — 168 BPM, E phrygian dominant + tritone, final boss
     victory  — 128 BPM, C major fanfare
     gameover — 90 BPM, A minor descending one-shot
     ------------------------------------------------------------------ */
  var TRACK_DEFS = {
    title: {
      bpm: 96, loop: true, layers: false,
      leadDuty: 0.5, harmDuty: 0.125, arp: 'slow', arpOctave: 0,
      leadVol: 0.16, harmVol: 0.042, bassVol: 0.19, drumVol: 0.8,
      bars: [
        { chord: 'Dm', lead: '0:D5:4 4:F5:2 6:E5:2 8:D5:4 12:A4:4', bass: 'long', drums: 'titleA' },
        { chord: 'Bb', lead: '0:F5:4 4:D5:2 6:F5:2 8:Bb5:4 12:A5:4', bass: 'long2', drums: 'titleA' },
        { chord: 'F',  lead: '0:C6:4 4:A5:2 6:F5:2 8:A5:4 12:G5:2 14:F5:2', bass: 'long', drums: 'titleA' },
        { chord: 'C',  lead: '0:E5:4 4:G5:2 6:E5:2 8:C5:6 14:D5:2', bass: 'long2', drums: 'titleA' },
        { chord: 'Dm', lead: '0:D5:2 2:F5:2 4:A5:2 6:F5:2 8:E5:4 12:D5:4', bass: 'long', drums: 'titleB' },
        { chord: 'Gm', lead: '0:G5:4 4:Bb5:2 6:G5:2 8:A5:2 10:Bb5:2 12:D6:4', bass: 'minorWalk', drums: 'titleB' },
        { chord: 'Bb', lead: '0:Bb5:4 4:A5:2 6:G5:2 8:F5:4 12:D5:4', bass: 'long2', drums: 'titleB' },
        { chord: 'A7', lead: '0:E5:2 2:G5:2 4:A5:2 6:C#6:2 8:A5:4 12:E5:4', bass: 'long2', drums: 'titleB' },
        { chord: 'Dm', lead: '0:F5:2 2:A5:2 4:D6:4 8:C6:2 10:Bb5:2 12:A5:4', bass: 'long', drums: 'titleA' },
        { chord: 'Bb', lead: '0:D6:4 4:Bb5:2 6:D6:2 8:F6:4 12:D6:4', bass: 'long2', drums: 'titleA' },
        { chord: 'F',  lead: '0:C6:4 4:A5:2 6:C6:2 8:F6:4 12:E6:2 14:C6:2', bass: 'long', drums: 'titleA' },
        { chord: 'C',  lead: '0:G5:2 2:E5:2 4:G5:2 6:C6:2 8:E6:4 12:D6:4', bass: 'long2', drums: 'titleA' },
        { chord: 'Gm', lead: '0:D6:2 2:C6:2 4:Bb5:2 6:G5:2 8:Bb5:4 12:D6:4', bass: 'minorWalk', drums: 'titleB' },
        { chord: 'Dm', lead: '0:A5:2 2:F5:2 4:D5:2 6:F5:2 8:A5:4 12:D6:4', bass: 'long', drums: 'titleB' },
        { chord: 'Bb', lead: '0:F6:4 4:D6:2 6:Bb5:2 8:F5:4 12:Bb5:2 14:D6:2', bass: 'long2', drums: 'titleB' },
        { chord: 'A7', lead: '0:C#6:4 4:A5:2 6:G5:2 8:E5:4 12:A4:4', bass: 'long2', drums: 'titleF' }
      ]
    },

    select: {
      bpm: 132, loop: true, layers: false,
      leadDuty: 0.25, harmDuty: 0.125, arp: 'bounce', arpOctave: 0,
      leadVol: 0.15, harmVol: 0.045, bassVol: 0.2, drumVol: 0.9,
      bars: [
        { chord: 'Am', lead: '0:E5:2 2:A5:2 4:C6:1 5:B5:1 6:A5:2 8:E5:2 10:G5:2 12:A5:4', bass: 'pulse', drums: 'selectA' },
        { chord: 'F',  lead: '0:F5:2 2:A5:2 4:C6:2 6:A5:2 8:F5:2 10:E5:2 12:C5:4', bass: 'drive', drums: 'selectA' },
        { chord: 'C',  lead: '0:C5:2 2:E5:2 4:G5:2 6:C6:2 8:B5:2 10:G5:2 12:E5:4', bass: 'pulse', drums: 'selectA' },
        { chord: 'G',  lead: '0:D5:2 2:G5:2 4:B5:2 6:D6:2 8:B5:2 10:G5:2 12:D5:4', bass: 'drive', drums: 'selectA' },
        { chord: 'Am', lead: '0:E5:2 2:A5:2 4:C6:1 5:B5:1 6:A5:2 8:G5:2 10:E5:2 12:A5:4', bass: 'pulse', drums: 'selectA' },
        { chord: 'F',  lead: '0:C6:2 2:A5:2 4:F5:2 6:A5:2 8:C6:2 10:D6:2 12:C6:4', bass: 'drive', drums: 'selectA' },
        { chord: 'G',  lead: '0:B5:2 2:D6:2 4:B5:2 6:G5:2 8:D6:2 10:B5:2 12:G5:4', bass: 'pulse', drums: 'selectA' },
        { chord: 'E7', lead: '0:E5:2 2:G#5:2 4:B5:2 6:D6:2 8:B5:2 10:G#5:2 12:E5:4', bass: 'drive', drums: 'selectF' },
        { chord: 'Am', lead: '0:A5:1 1:A5:1 2:C6:2 4:E6:2 6:D6:1 7:C6:1 8:A5:2 10:E5:2 12:C6:4', bass: 'pulse', drums: 'selectB' },
        { chord: 'F',  lead: '0:C6:2 2:A5:2 4:C6:2 6:F6:2 8:E6:2 10:C6:2 12:A5:4', bass: 'drive', drums: 'selectB' },
        { chord: 'C',  lead: '0:G5:1 1:G5:1 2:C6:2 4:E6:2 6:G6:2 8:E6:2 10:C6:2 12:G5:4', bass: 'pulse', drums: 'selectB' },
        { chord: 'G',  lead: '0:B5:2 2:D6:2 4:G6:2 6:D6:2 8:B5:2 10:G5:2 12:D6:4', bass: 'drive', drums: 'selectB' },
        { chord: 'Am', lead: '0:E6:2 2:D6:2 4:C6:2 6:A5:2 8:C6:2 10:E6:2 12:A6:4', bass: 'pulse', drums: 'selectB' },
        { chord: 'F',  lead: '0:F6:2 2:E6:2 4:C6:2 6:A5:2 8:C6:2 10:F6:2 12:E6:4', bass: 'drive', drums: 'selectB' },
        { chord: 'G',  lead: '0:D6:2 2:B5:2 4:G5:2 6:D6:2 8:G6:2 10:D6:2 12:B5:4', bass: 'pulse', drums: 'selectB' },
        { chord: 'E7', lead: '0:E6:2 2:D6:2 4:B5:2 6:G#5:2 8:B5:2 10:D6:2 12:E6:4', bass: 'drive', drums: 'selectF' }
      ]
    },

    battle: {
      bpm: 152, loop: true, layers: true,
      leadDuty: 0.25, harmDuty: 0.125, arp: 'drive', arpOctave: 0,
      leadVol: 0.16, harmVol: 0.045, bassVol: 0.21, drumVol: 1,
      bars: [
        { chord: 'Dm', lead: '0:D5:1 1:D5:1 2:A5:2 4:F5:2 6:E5:2 8:D5:2 10:A4:2 12:D5:2 14:F5:2', bass: 'battle', drums: 'battleA' },
        { chord: 'Dm', lead: '0:A5:2 2:A5:2 4:D6:2 6:C#6:2 8:D6:2 10:A5:2 12:F5:2 14:E5:2', bass: 'battle2', drums: 'battleA' },
        { chord: 'Bb', lead: '0:Bb5:2 2:A5:2 4:F5:2 6:D5:2 8:F5:2 10:Bb5:2 12:A5:2 14:G5:2', bass: 'battle', drums: 'battleA' },
        { chord: 'A7', lead: '0:A5:2 2:G5:2 4:E5:2 6:C#5:2 8:E5:2 10:G5:2 12:A5:4', bass: 'battle2', drums: 'battleA' },
        { chord: 'Dm', lead: '0:D6:2 2:C#6:2 4:D6:2 6:F6:2 8:E6:2 10:D6:2 12:A5:2 14:F5:2', bass: 'battle', drums: 'battleA' },
        { chord: 'F',  lead: '0:F5:2 2:A5:2 4:C6:2 6:D6:2 8:C6:2 10:A5:2 12:F5:2 14:E5:2', bass: 'battle2', drums: 'battleA' },
        { chord: 'Gm', lead: '0:G5:2 2:Bb5:2 4:D6:2 6:C6:2 8:Bb5:2 10:A5:2 12:G5:2 14:F5:2', bass: 'battle', drums: 'battleA' },
        { chord: 'A7', lead: '0:E5:2 2:G5:2 4:A5:2 6:C#6:2 8:E6:2 10:D6:2 12:C#6:2 14:A5:2', bass: 'battle2', drums: 'battleF' },
        { chord: 'Dm', lead: '0:D5:1 1:F5:1 2:A5:1 3:D6:1 4:A5:2 6:F5:2 8:E5:2 10:D5:2 12:A4:4', bass: 'battle', drums: 'battleB' },
        { chord: 'Bb', lead: '0:Bb4:1 1:D5:1 2:F5:1 3:Bb5:1 4:F5:2 6:D5:2 8:C5:2 10:Bb4:2 12:D5:4', bass: 'battle2', drums: 'battleB' },
        { chord: 'F',  lead: '0:F5:1 1:A5:1 2:C6:1 3:F6:1 4:C6:2 6:A5:2 8:G5:2 10:F5:2 12:A5:4', bass: 'battle', drums: 'battleB' },
        { chord: 'A7', lead: '0:A5:1 1:C#6:1 2:E6:1 3:A6:1 4:E6:2 6:C#6:2 8:A5:2 10:G5:2 12:E5:4', bass: 'battle2', drums: 'battleB' },
        { chord: 'Dm', lead: '0:D6:2 2:E6:2 4:F6:2 6:E6:2 8:D6:2 10:C#6:2 12:D6:4', bass: 'battle', drums: 'battleB' },
        { chord: 'Gm', lead: '0:G5:2 2:Bb5:2 4:D6:2 6:G6:2 8:F6:2 10:D6:2 12:Bb5:4', bass: 'battle2', drums: 'battleB' },
        { chord: 'A7', lead: '0:A5:2 2:C#6:2 4:E6:2 6:A6:2 8:G6:2 10:E6:2 12:C#6:4', bass: 'battle', drums: 'battleB' },
        { chord: 'Dm', lead: '0:D6:4 4:A5:2 6:F5:2 8:D5:4 12:D6:2 14:C#6:2', bass: 'battle2', drums: 'battleF' }
      ]
    },

    boss: {
      bpm: 168, loop: true, layers: true,
      leadDuty: 0.125, harmDuty: 0.25, arp: 'tense', arpOctave: 0,
      leadVol: 0.16, harmVol: 0.038, bassVol: 0.22, drumVol: 1,
      bars: [
        { chord: 'E7', lead: '0:E5:2 2:G#5:2 4:B5:2 6:D6:2 8:B5:2 10:G#5:2 12:E5:2 14:D5:2', bass: 'boss', drums: 'bossA' },
        { chord: 'E7', lead: '0:E5:1 1:E5:1 2:G#5:1 3:A5:1 4:B5:2 6:D6:2 8:E6:2 10:D6:2 12:B5:2 14:A5:2', bass: 'boss2', drums: 'bossA' },
        { chord: 'F',  lead: '0:F5:2 2:A5:2 4:C6:2 6:B5:2 8:A5:2 10:F5:2 12:E5:2 14:C5:2', bass: 'boss', drums: 'bossA' },
        { chord: 'Bb', lead: '0:Bb5:2 2:A5:2 4:F#5:2 6:F5:2 8:D5:2 10:F5:2 12:Bb5:2 14:A5:2', bass: 'boss2', drums: 'bossA' },
        { chord: 'E7', lead: '0:G#5:1 1:G#5:1 2:B5:1 3:D6:1 4:E6:2 6:D6:2 8:B5:2 10:A5:2 12:G#5:2 14:E5:2', bass: 'boss', drums: 'bossA' },
        { chord: 'F',  lead: '0:F5:2 2:C6:2 4:A5:2 6:F5:2 8:C6:2 10:D6:2 12:C6:2 14:A5:2', bass: 'boss2', drums: 'bossA' },
        { chord: 'C',  lead: '0:C6:2 2:B5:2 4:G5:2 6:E5:2 8:G5:2 10:B5:2 12:C6:4', bass: 'boss', drums: 'bossA' },
        { chord: 'B7', lead: '0:B5:2 2:D#6:2 4:F#6:2 6:D#6:2 8:B5:2 10:A5:2 12:F#5:2 14:D#5:2', bass: 'boss2', drums: 'bossF' },
        { chord: 'E7', lead: '0:E6:2 2:D6:2 4:B5:2 6:G#5:2 8:A5:2 10:B5:2 12:D6:2 14:E6:2', bass: 'boss', drums: 'bossB' },
        { chord: 'F',  lead: '0:F6:2 2:E6:2 4:C6:2 6:A5:2 8:F5:2 10:A5:2 12:C6:2 14:E6:2', bass: 'boss2', drums: 'bossB' },
        { chord: 'F#dim', lead: '0:F#5:2 2:A5:2 4:C6:2 6:A5:2 8:F#5:2 10:C6:2 12:E6:2 14:C6:2', bass: 'boss', drums: 'bossB' },
        { chord: 'G',  lead: '0:G5:2 2:B5:2 4:D6:2 6:B5:2 8:G5:2 10:D6:2 12:G6:2 14:F6:2', bass: 'boss2', drums: 'bossB' },
        { chord: 'E7', lead: '0:E6:2 2:D6:2 4:Bb5:2 6:A5:2 8:G#5:2 10:A5:2 12:B5:2 14:D6:2', bass: 'boss', drums: 'bossB' },
        { chord: 'Bb', lead: '0:Bb5:2 2:D6:2 4:F6:2 6:D6:2 8:Bb5:2 10:A5:2 12:G5:2 14:F5:2', bass: 'boss2', drums: 'bossB' },
        { chord: 'B7', lead: '0:B5:2 2:D#6:2 4:F#6:4 8:E6:2 10:D#6:2 12:B5:2 14:F#5:2', bass: 'boss', drums: 'bossB' },
        { chord: 'E7', lead: '0:E6:4 4:D6:2 6:B5:2 8:G#5:4 12:E5:4', bass: 'boss2', drums: 'bossF' }
      ]
    },

    victory: {
      bpm: 128, loop: true, layers: false,
      leadDuty: 0.25, harmDuty: 0.125, arp: 'bounce', arpOctave: 0,
      leadVol: 0.15, harmVol: 0.05, bassVol: 0.18, drumVol: 0.85,
      bars: [
        { chord: 'C',  lead: '0:C5:2 2:E5:2 4:G5:2 6:C6:4 10:G5:2 12:E5:2 14:G5:2', bass: 'fanfare', drums: 'victoryA' },
        { chord: 'F',  lead: '0:F5:2 2:A5:2 4:C6:2 6:F6:4 10:C6:2 12:A5:2 14:C6:2', bass: 'fanfare', drums: 'victoryA' },
        { chord: 'G',  lead: '0:G5:2 2:B5:2 4:D6:2 6:G6:4 10:D6:2 12:B5:2 14:D6:2', bass: 'fanfare2', drums: 'victoryA' },
        { chord: 'C',  lead: '0:C6:4 4:E6:2 6:G6:2 8:C7:4 12:B6:2 14:G6:2', bass: 'fanfare', drums: 'victoryF' },
        { chord: 'Am', lead: '0:A5:2 2:C6:2 4:E6:2 6:A6:4 10:E6:2 12:C6:2 14:A5:2', bass: 'fanfare', drums: 'victoryA' },
        { chord: 'F',  lead: '0:F5:2 2:A5:2 4:C6:2 6:F6:4 10:C6:2 12:A5:2 14:F5:2', bass: 'fanfare2', drums: 'victoryA' },
        { chord: 'G',  lead: '0:G5:2 2:B5:2 4:D6:2 6:G6:2 8:F6:2 10:D6:2 12:B5:2 14:G5:2', bass: 'fanfare', drums: 'victoryF' },
        { chord: 'C',  lead: '0:C6:2 2:G5:2 4:E5:2 6:G5:2 8:C6:8', bass: 'fanfare2', drums: 'victoryF' }
      ]
    },

    gameover: {
      bpm: 90, loop: false, layers: false,
      leadDuty: 0.5, harmDuty: 0.125, arp: 'sparse', arpOctave: 0,
      leadVol: 0.15, harmVol: 0.038, bassVol: 0.18, drumVol: 0.6,
      bars: [
        { chord: 'Am', lead: '0:E5:4 4:D5:2 6:C5:2 8:B4:4 12:A4:4', bass: 'sad', drums: 'overA' },
        { chord: 'F',  lead: '0:C5:4 4:B4:2 6:A4:2 8:G4:4 12:F4:4', bass: 'sad2', drums: 'overA' },
        { chord: 'Dm', lead: '0:D4:4 4:F4:2 6:A4:2 8:D5:4 12:C5:4', bass: 'sad', drums: 'overA' },
        { chord: 'E7', lead: '0:B4:4 4:G#4:2 6:E4:2 8:D4:4 12:B3:4', bass: 'sad2', drums: 'overA' },
        { chord: 'Am', lead: '0:A4:4 4:C5:2 6:E5:2 8:A5:4 12:G5:2 14:E5:2', bass: 'sad', drums: 'overA' },
        { chord: 'Am', lead: '0:E4:8 8:A3:8', bass: 'sad2', drums: 'overF' }
      ]
    }
  };

  /* ============================================================
     3. COMPILER: bar patterns -> flat step tables
     ============================================================ */
  function emptySlots() {
    var a = [], i;
    for (i = 0; i < 16; i++) { a.push([]); }
    return a;
  }
  function emptyGrid() {
    var a = [], i;
    for (i = 0; i < 16; i++) { a.push(null); }
    return a;
  }

  function compileLead(str) {
    var out = emptySlots(), tokens = String(str || '').replace(/^\s+|\s+$/g, '').split(/\s+/);
    for (var i = 0; i < tokens.length; i++) {
      if (!tokens[i]) { continue; }
      var p = tokens[i].split(':');
      if (p.length < 2) { continue; }
      var pos = parseInt(p[0], 10), hz = noteFreq(p[1]);
      if (!(pos >= 0 && pos < 16) || !hz) { continue; }
      var steps = p.length > 2 ? parseFloat(p[2]) : 2;
      if (!(steps > 0)) { steps = 2; }
      var vel = p.length > 3 ? parseFloat(p[3]) : NaN;
      if (!isFinite(vel) || vel <= 0) {
        vel = pos % 8 === 0 ? 1.08 : (pos % 4 === 0 ? 1.0 : (pos % 2 === 1 ? 0.88 : 0.94));
      }
      out[pos].push({ hz: hz, steps: Math.min(steps, 16), vel: clamp(vel, 0.3, 1.3) });
    }
    return out;
  }

  function compileBass(str, rootMidi) {
    var out = emptySlots(), tokens = String(str || '').replace(/^\s+|\s+$/g, '').split(/\s+/);
    for (var i = 0; i < tokens.length; i++) {
      if (!tokens[i]) { continue; }
      var p = tokens[i].split(':');
      if (p.length < 2) { continue; }
      var pos = parseInt(p[0], 10), off = parseInt(p[1], 10);
      if (!(pos >= 0 && pos < 16) || !isFinite(off)) { continue; }
      var steps = p.length > 2 ? parseFloat(p[2]) : 2;
      if (!(steps > 0)) { steps = 2; }
      out[pos].push({ hz: midiToFreq(rootMidi + off), steps: Math.min(steps, 16), vel: pos % 4 === 0 ? 1.06 : 0.9 });
    }
    return out;
  }

  function compileArp(name, chord, octave) {
    var def = ARP_DEFS[name];
    if (!def) { return null; }
    var base = 60 + chord.root + (octave || 0), out = emptyGrid();
    for (var pos = 0; pos < 16; pos++) {
      if (pos % def.rate !== 0) { continue; }
      var idx = def.pat[(pos / def.rate) % def.pat.length];
      if (!isFinite(idx)) { idx = 0; }
      out[pos] = { hz: midiToFreq(chordTone(base, chord.intervals, idx)), steps: def.rate };
    }
    return out;
  }

  function compileDrums(name) {
    var out = emptySlots(), pat = DRUM_DEFS[name], lanes = ['k', 's', 'h', 'o', 'c', 't'];
    if (!pat) { return out; }
    for (var l = 0; l < lanes.length; l++) {
      var line = pat[lanes[l]] || '';
      for (var i = 0; i < 16 && i < line.length; i++) {
        var ch = line.charAt(i);
        if (ch === '.' || ch === ' ') { continue; }
        out[i].push({ lane: lanes[l], vel: ch === ch.toUpperCase() ? 1.22 : 1 });
      }
    }
    return out;
  }

  function compileTrack(id, def) {
    var song = {
      id: id, bpm: clamp(def.bpm, 40, 220), loop: def.loop !== false,
      layers: !!def.layers,
      leadDuty: clamp(def.leadDuty, 0.05, 0.75),
      harmDuty: clamp(def.harmDuty, 0.05, 0.75),
      leadVol: clamp(def.leadVol, 0.01, 0.3),
      harmVol: clamp(def.harmVol, 0.005, 0.2),
      bassVol: clamp(def.bassVol, 0.01, 0.3),
      drumVol: clamp(def.drumVol === undefined ? 1 : def.drumVol, 0, 1.5),
      arpOctave: def.arpOctave || 0,
      bars: [], barCount: 0, totalSteps: 0
    };
    song.stepDur = 60 / song.bpm / 4;
    song.barDur = song.stepDur * 16;
    var arpDefault = def.arp || null;
    for (var i = 0; i < def.bars.length; i++) {
      var b = def.bars[i] || {};
      var chord = parseChord(b.chord || 'C');
      song.bars.push({
        chord: chord,
        lead: compileLead(b.lead),
        bass: compileBass(b.bass, 36 + chord.root),
        drums: compileDrums(b.drums || def.drums),
        arp: compileArp(b.arp !== undefined ? b.arp : arpDefault, chord, song.arpOctave)
      });
    }
    song.barCount = song.bars.length;
    song.totalSteps = song.barCount * 16;
    return song;
  }

  var SONGS = {};
  (function compileAll() {
    for (var key in TRACK_DEFS) {
      if (Object.prototype.hasOwnProperty.call(TRACK_DEFS, key)) {
        try { SONGS[key] = compileTrack(key, TRACK_DEFS[key]); }
        catch (e) { SONGS[key] = null; }
      }
    }
  })();
  var TRACK_IDS = ['title', 'select', 'battle', 'boss', 'victory', 'gameover'];
  function isTrackId(id) { return TRACK_IDS.indexOf(id) >= 0; }

  /* ============================================================
     4. ENGINE STATE + AUDIO GRAPH
     ============================================================ */
  var TICK_MS = 25;
  var LOOKAHEAD = 0.12;
  var MASTER_LEVEL = 0.9;     // master gain when volume === 1
  var DUCK_GAIN = 0.3;        // music bus level while ducked
  var SFX_LEVEL = 0.9;        // SFX bus level when sfx === true
  var CROSSFADE = 0.42;       // style / track crossfade, seconds
  var MUSIC_TRACK_LEVEL = 0.9; // per-track headroom, keeps SFX on top of the mix

  var state = {
    ctx: null,
    supported: AC ? true : false,
    initialised: false,
    unlocked: false,
    volume: 0.8,
    musicOn: true,
    sfxOn: true,
    style: 'chip',
    ducked: false,
    intensity: 0,
    notes: 0,
    master: null,
    limiter: null,
    musicMix: null,
    sfxMix: null,
    noise: null,
    waves: {},
    players: [],
    current: null,
    desired: null,
    gestureBound: false,
    lastSfx: {},
    stalled: false,
    clockProbeTime: -1,
    clockProbeWall: 0
  };

  function ctxRunning() {
    return !!(state.ctx && state.ctx.state === 'running');
  }

  /* Some environments lose the audio device: the context stays 'running' but
     currentTime freezes. Detect it, stop creating nodes, resume cleanly when
     the clock starts moving again. */
  function audioClockStalled() {
    var ctx = state.ctx;
    if (!ctx) { return true; }
    var wall = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (state.clockProbeTime < 0) {
      state.clockProbeTime = ctx.currentTime;
      state.clockProbeWall = wall;
      state.stalled = false;
      return false;
    }
    if (ctx.currentTime !== state.clockProbeTime) {
      state.clockProbeTime = ctx.currentTime;
      state.clockProbeWall = wall;
      state.stalled = false;
      return false;
    }
    if (wall - state.clockProbeWall > 600) { state.stalled = true; }
    return state.stalled;
  }

  function makeNoiseBuffer(ctx) {
    var len = Math.max(1, Math.floor(ctx.sampleRate * 1.5));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) { data[i] = Math.random() * 2 - 1; }
    return buf;
  }

  function pulseWave(duty) {
    var ctx = state.ctx;
    if (!ctx || typeof ctx.createPeriodicWave !== 'function') { return null; }
    var key = duty <= 0.16 ? 'p12' : (duty <= 0.36 ? 'p25' : 'p50');
    if (Object.prototype.hasOwnProperty.call(state.waves, key)) { return state.waves[key]; }
    try {
      var density = key === 'p12' ? 0.125 : (key === 'p25' ? 0.25 : 0.5);
      var n = 32, real = new Float32Array(n + 1), imag = new Float32Array(n + 1);
      for (var i = 1; i <= n; i++) { imag[i] = (2 / (i * Math.PI)) * Math.sin(Math.PI * i * density); }
      state.waves[key] = ctx.createPeriodicWave(real, imag);
    } catch (e) { state.waves[key] = null; }
    return state.waves[key];
  }

  function buildGraph(ctx) {
    var master = ctx.createGain();
    var musicMix = ctx.createGain();
    var sfxMix = ctx.createGain();
    var limiter = null;

    master.gain.value = state.volume * MASTER_LEVEL;
    musicMix.gain.value = (state.musicOn && !state.ducked) ? 1 : 0;
    sfxMix.gain.value = state.sfxOn ? SFX_LEVEL : 0;

    connect(musicMix, master);
    connect(sfxMix, master);

    if (typeof ctx.createDynamicsCompressor === 'function') {
      try {
        limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -10;
        limiter.knee.value = 8;
        limiter.ratio.value = 12;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.18;
        connect(master, limiter);
        connect(limiter, ctx.destination);
      } catch (e) { limiter = null; }
    }
    if (!limiter) { connect(master, ctx.destination); }

    state.master = master;
    state.limiter = limiter;
    state.musicMix = musicMix;
    state.sfxMix = sfxMix;
  }

  function init() {
    if (!AC) { state.supported = false; return false; }
    if (state.initialised) { return ready(); }
    state.initialised = true;
    var ctx;
    try { ctx = new AC(); } catch (e) { state.supported = false; return false; }
    state.ctx = ctx;
    try {
      state.noise = makeNoiseBuffer(ctx);
      buildGraph(ctx);
    } catch (e) {
      state.supported = false;
      try { ctx.close(); } catch (e2) { /* ignore */ }
      state.ctx = null;
      return false;
    }
    bindGestureUnlock();
    bindCtxState(ctx);
    if (ctxRunning() && state.desired) { startTrack(state.desired); }
    return ready();
  }

  function ready() { return ctxRunning(); }

  function unlockNow() {
    var ctx = state.ctx;
    if (!ctx) { return false; }
    state.unlocked = ctxRunning();
    if (state.unlocked) { onUnlocked(); return true; }
    try {
      var res = ctx.resume();
      if (res && typeof res.then === 'function') {
        return res.then(function () {
          state.unlocked = ctxRunning();
          if (state.unlocked) { onUnlocked(); }
          return state.unlocked;
        }, function () { return false; });
      }
    } catch (e) { return false; }
    state.unlocked = ctxRunning();
    if (state.unlocked) { onUnlocked(); }
    return state.unlocked;
  }

  function unlock() {
    try {
      if (!state.ctx) { init(); }
      if (!state.ctx) { return false; }
      return unlockNow();
    } catch (e) { return false; }
  }

  function onUnlocked() {
    state.clockProbeTime = -1;
    state.stalled = false;
    if (state.desired) {
      if (!state.current || state.current.id !== state.desired) { startTrack(state.desired); }
    }
  }

  function bindCtxState(ctx) {
    try {
      if (ctx && typeof ctx.addEventListener === 'function') {
        ctx.addEventListener('statechange', function () {
          state.unlocked = ctxRunning();
          if (state.unlocked) { onUnlocked(); }
        });
      }
    } catch (e) { /* ignore */ }
  }

  function bindGestureUnlock() {
    if (state.gestureBound || typeof window === 'undefined' || !window.addEventListener) { return; }
    state.gestureBound = true;
    var events = ['pointerdown', 'mousedown', 'touchstart', 'keydown'];
    var handler = function () {
      for (var i = 0; i < events.length; i++) {
        try { window.removeEventListener(events[i], handler, true); } catch (e) { /* ignore */ }
      }
      try { unlock(); } catch (e) { /* ignore */ }
    };
    for (var i = 0; i < events.length; i++) {
      try { window.addEventListener(events[i], handler, true); } catch (e) { /* ignore */ }
    }
  }

  /* ---------- smooth parameter ramps (click-free) ---------- */
  function rampParam(param, target, sec) {
    var ctx = state.ctx;
    if (!param || !ctx) { return; }
    try {
      var now = ctx.currentTime, cur = Number(param.value);
      if (!isFinite(cur)) { cur = 0; }
      param.cancelScheduledValues(now);
      param.setValueAtTime(cur, now);
      if (sec <= 0.001) { param.setValueAtTime(target, now); }
      else { param.linearRampToValueAtTime(target, now + sec); }
    } catch (e) { /* ignore */ }
  }

  /* ============================================================
     5. SYNTHESIS PRIMITIVES
     All voices connect to a destination bus and are garbage
     collected by their own `ended` handler (no node leaks).
     ============================================================ */
  var activeVoices = 0;
  var activeNoise = 0;
  var voiceRegistry = [];
  var lastSweep = 0;
  var MAX_VOICES = 64;   // hard polyphony cap: protects the audio renderer
  var MAX_NOISE = 24;    // simultaneous noise sources (drums + impacts)

  /* Watchdog: releases nodes whose `ended` event never arrived (tab suspend,
     audio device loss) and caps the live node count. Cheap: O(live nodes). */
  function sweepVoices(force) {
    var ctx = state.ctx;
    if (!ctx) {
      voiceRegistry = []; activeVoices = 0; activeNoise = 0; return;
    }
    var now = ctx.currentTime;
    if (!force && now - lastSweep < 0.5) { return; }
    lastSweep = now;
    var keep = [], i, e, k;
    for (i = 0; i < voiceRegistry.length; i++) {
      e = voiceRegistry[i];
      if (!e || e.dead) { continue; }
      if (now > e.until + 0.3) {
        e.dead = true;
        if (e.counted) {
          e.counted = false;
          if (e.kind === 'noise') { if (activeNoise > 0) { activeNoise--; } }
          else if (activeVoices > 0) { activeVoices--; }
        }
        for (k = 0; k < e.nodes.length; k++) { disconnect(e.nodes[k]); }
        continue;
      }
      keep.push(e);
    }
    voiceRegistry = keep;
  }

  function voice(dest, t, hz, dur, peak, o) {
    var ctx = state.ctx;
    if (!ctx || !dest || !isFinite(hz) || hz <= 0 || !isFinite(peak) || peak <= 0) { return; }
    if (state.stalled || activeVoices >= MAX_VOICES) { return; }
    if (voiceRegistry.length > 192) { sweepVoices(true); }
    o = o || {};
    var d = clamp(dur, 0.02, 6);
    var osc, amp;
    try { osc = ctx.createOscillator(); amp = ctx.createGain(); }
    catch (e) { return; }
    try {
      if (o.wave && typeof osc.setPeriodicWave === 'function') { osc.setPeriodicWave(o.wave); }
      else { osc.type = o.type || 'square'; }
    } catch (e) { try { osc.type = 'square'; } catch (e2) { return; } }
    try {
      osc.frequency.setValueAtTime(Math.max(20, hz), t);
      if (o.toHz && isFinite(o.toHz) && o.toHz > 0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.toHz), t + d * (o.glide || 0.9));
      }
      if (o.detune) { osc.detune.setValueAtTime(clamp(o.detune, -1200, 1200), t); }
    } catch (e) { /* ignore */ }

    var tail = dest, filt = null, pan = null;
    if (o.filter) {
      try {
        filt = ctx.createBiquadFilter();
        filt.type = o.filter.type || 'lowpass';
        filt.frequency.setValueAtTime(clamp(o.filter.from || 1200, 40, 18000), t);
        if (o.filter.to) {
          filt.frequency.exponentialRampToValueAtTime(clamp(o.filter.to, 40, 18000), t + d * 0.8);
        }
        filt.Q.value = o.filter.q === undefined ? 0.7 : clamp(o.filter.q, 0.0001, 24);
        if (connect(filt, tail)) { tail = filt; }
      } catch (e) { filt = null; }
    }
    if (o.pan && typeof ctx.createStereoPanner === 'function') {
      try {
        pan = ctx.createStereoPanner();
        pan.pan.value = clamp(o.pan, -1, 1);
        if (connect(pan, tail)) { tail = pan; }
      } catch (e) { pan = null; }
    }
    if (!connect(amp, tail)) { disconnect(amp); disconnect(filt); disconnect(pan); return; }

    var a = clamp(o.attack === undefined ? 0.006 : o.attack, 0.001, Math.max(0.002, d * 0.4));
    var r = clamp(o.release === undefined ? 0.03 : o.release, 0.004, Math.max(0.008, d * 0.5));
    var top = clamp(peak, 0.0002, 1.2);
    try {
      var g = amp.gain;
      g.setValueAtTime(0.0001, t);
      g.linearRampToValueAtTime(top, t + a);
      if (o.pluck) {
        var decay = t + a + Math.max(0.02, o.decay === undefined ? d * 0.35 : o.decay);
        var mid = Math.min(t + d - 0.004, decay);
        g.exponentialRampToValueAtTime(Math.max(0.0004, top * 0.3), mid);
        g.exponentialRampToValueAtTime(0.0004, t + d);
      } else {
        var hold = Math.max(t + a, t + d - r);
        g.setValueAtTime(top, hold);
        g.linearRampToValueAtTime(0.0001, t + d);
      }
    } catch (e) { /* ignore */ }

    if (!connect(osc, amp)) {
      disconnect(osc); disconnect(amp); disconnect(filt); disconnect(pan);
      return;
    }
    activeVoices++;
    var entry = { kind: 'voice', until: t + d + 0.12, nodes: [osc, amp, filt, pan], dead: false, counted: true };
    voiceRegistry.push(entry);
    osc.onended = function () {
      if (entry.dead) { return; }
      entry.dead = true;
      if (entry.counted) { entry.counted = false; if (activeVoices > 0) { activeVoices--; } }
      disconnect(osc); disconnect(amp); disconnect(filt); disconnect(pan);
    };
    try {
      osc.start(t);
      osc.stop(t + d + 0.03);
    } catch (e) {
      if (!entry.dead) {
        entry.dead = true;
        if (entry.counted) { entry.counted = false; if (activeVoices > 0) { activeVoices--; } }
      }
      osc.onended = null;
      try { osc.disconnect(); } catch (e2) { /* ignore */ }
      disconnect(amp); disconnect(filt); disconnect(pan);
    }
  }

  function noiseHit(dest, t, dur, type, f0, f1, q, peak, pan) {
    var ctx = state.ctx;
    if (!ctx || !dest || !state.noise || !isFinite(peak) || peak <= 0) { return; }
    if (state.stalled || activeNoise >= MAX_NOISE) { return; }
    if (voiceRegistry.length > 192) { sweepVoices(true); }
    var d = clamp(dur, 0.02, 3), src, filt, amp, panNode = null;
    try { src = ctx.createBufferSource(); filt = ctx.createBiquadFilter(); amp = ctx.createGain(); }
    catch (e) { return; }
    try { src.buffer = state.noise; } catch (e) { /* ignore */ }
    try {
      filt.type = type || 'bandpass';
      filt.frequency.setValueAtTime(clamp(f0 || 1200, 40, 18000), t);
      if (f1 && f1 > 0) { filt.frequency.exponentialRampToValueAtTime(clamp(f1, 40, 18000), t + d); }
      filt.Q.value = q === undefined ? 0.8 : clamp(q, 0.0001, 24);
    } catch (e) { /* ignore */ }
    var tail = dest;
    if (pan && typeof ctx.createStereoPanner === 'function') {
      try { panNode = ctx.createStereoPanner(); panNode.pan.value = clamp(pan, -1, 1); if (connect(panNode, tail)) { tail = panNode; } }
      catch (e) { panNode = null; }
    }
    if (!connect(amp, tail) || !connect(src, filt) || !connect(filt, amp)) {
      disconnect(src); disconnect(filt); disconnect(amp); disconnect(panNode);
      return;
    }
    try {
      var g = amp.gain, top = clamp(peak, 0.0002, 1.2);
      g.setValueAtTime(0.0001, t);
      g.linearRampToValueAtTime(top, t + 0.003);
      g.exponentialRampToValueAtTime(0.0004, t + d);
    } catch (e) { /* ignore */ }
    activeNoise++;
    var nEntry = { kind: 'noise', until: t + d + 0.12, nodes: [src, filt, amp, panNode], dead: false, counted: true };
    voiceRegistry.push(nEntry);
    src.onended = function () {
      if (nEntry.dead) { return; }
      nEntry.dead = true;
      if (nEntry.counted) { nEntry.counted = false; if (activeNoise > 0) { activeNoise--; } }
      disconnect(src); disconnect(filt); disconnect(amp); disconnect(panNode);
    };
    try { src.start(t); src.stop(t + d + 0.04); }
    catch (e) {
      if (!nEntry.dead) {
        nEntry.dead = true;
        if (nEntry.counted) { nEntry.counted = false; if (activeNoise > 0) { activeNoise--; } }
      }
      src.onended = null;
      disconnect(src); disconnect(filt); disconnect(amp); disconnect(panNode);
    }
  }

  /* ---------- chip instruments (dry, 4-channel NES/ZX feel) ---------- */
  function chipLead(dest, t, hz, dur, vel, song) {
    voice(dest, t, hz, dur, song.leadVol * vel, {
      wave: pulseWave(song.leadDuty), attack: 0.005, release: 0.035,
      pluck: true, decay: Math.min(0.14, dur * 0.5)
    });
  }
  function chipHarm(dest, t, hz, dur, vel, song) {
    voice(dest, t, hz, Math.max(0.05, dur * 0.8), song.harmVol * vel, {
      wave: pulseWave(song.harmDuty), attack: 0.004, release: 0.02, pluck: true
    });
  }
  function chipBass(dest, t, hz, dur, vel, song) {
    voice(dest, t, hz, dur * 0.94, song.bassVol * vel, {
      type: 'triangle', attack: 0.006, release: 0.04
    });
  }

  /* ---------- synth instruments (detuned saws, filters, delay) ---------- */
  function synthLead(dest, t, hz, dur, vel, song) {
    var peak = song.leadVol * 0.62 * vel;
    var cut = 900 + state.intensity * 2600 + (state.ducked ? -500 : 0);
    voice(dest, t, hz, dur, peak * 0.62, {
      type: 'sawtooth', detune: -7, attack: 0.012, release: 0.05, pan: -0.2,
      filter: { type: 'lowpass', from: cut * 1.6, to: cut * 0.8, q: 1.1 }
    });
    voice(dest, t, hz, dur, peak * 0.62, {
      type: 'sawtooth', detune: 7, attack: 0.012, release: 0.05, pan: 0.2,
      filter: { type: 'lowpass', from: cut * 1.6, to: cut * 0.85, q: 1.1 }
    });
    voice(dest, t, hz * 0.5, dur, peak * 0.26, { type: 'triangle', attack: 0.01, release: 0.06 });
  }
  function synthHarm(dest, t, hz, dur, vel, song, pan) {
    var cut = 1200 + state.intensity * 2800 + (state.ducked ? -600 : 0);
    voice(dest, t, hz, dur, song.harmVol * 1.1 * vel, {
      type: 'sawtooth', attack: 0.004, release: 0.02, pluck: true, pan: pan || 0.28,
      filter: { type: 'lowpass', from: cut * 1.5, to: cut, q: 2.2 }
    });
  }
  function synthBass(dest, t, hz, dur, vel, song) {
    var cut = 260 + state.intensity * 260;
    voice(dest, t, hz, dur * 0.96, song.bassVol * 0.82 * vel, {
      type: 'sawtooth', attack: 0.005, release: 0.04,
      filter: { type: 'lowpass', from: cut * 2.4, to: cut, q: 2.6 }
    });
    voice(dest, t, hz * 0.5, dur * 0.96, song.bassVol * 0.42 * vel, {
      type: 'triangle', attack: 0.005, release: 0.04
    });
  }
  function synthPad(dest, t, hz, dur, vel) {
    var cut = 620 + state.intensity * 1500 + (state.ducked ? -380 : 0);
    voice(dest, t, hz, dur, 0.028 * vel, {
      type: 'sawtooth', detune: -9, attack: 0.18, release: 0.32, pan: -0.42,
      filter: { type: 'lowpass', from: cut * 0.7, to: cut * 1.25, q: 0.7 }
    });
    voice(dest, t, hz * 1.004, dur, 0.028 * vel, {
      type: 'sawtooth', detune: 9, attack: 0.2, release: 0.32, pan: 0.42,
      filter: { type: 'lowpass', from: cut * 0.7, to: cut * 1.25, q: 0.7 }
    });
  }

  /* ---------- drums ---------- */
  function chipDrum(dest, t, lane, vol) {
    var v = clamp(vol, 0.05, 1.6);
    if (lane === 'k') {
      voice(dest, t, 152, 0.14, 0.34 * v, { type: 'sine', toHz: 48, attack: 0.002, release: 0.03 });
      noiseHit(dest, t, 0.024, 'highpass', 1800, 3600, 0.7, 0.05 * v);
    } else if (lane === 's') {
      noiseHit(dest, t, 0.12, 'bandpass', 1900, 900, 1.15, 0.2 * v);
      voice(dest, t, 196, 0.08, 0.08 * v, { type: 'triangle', toHz: 118, attack: 0.002, release: 0.02 });
    } else if (lane === 'h') {
      noiseHit(dest, t, 0.028, 'highpass', 7800, 9800, 0.7, 0.042 * v);
    } else if (lane === 'o') {
      noiseHit(dest, t, 0.13, 'highpass', 6800, 8400, 0.7, 0.038 * v);
    } else if (lane === 'c') {
      noiseHit(dest, t, 0.42, 'lowpass', 5600, 1600, 0.7, 0.1 * v, -0.2);
    } else if (lane === 't') {
      voice(dest, t, 190, 0.12, 0.18 * v, { type: 'sine', toHz: 92, attack: 0.002, release: 0.02 });
    }
  }
  function synthDrum(dest, t, lane, vol) {
    var v = clamp(vol, 0.05, 1.6);
    if (lane === 'k') {
      voice(dest, t, 190, 0.22, 0.48 * v, { type: 'sine', toHz: 42, attack: 0.002, release: 0.05 });
      noiseHit(dest, t, 0.018, 'highpass', 2600, 5200, 0.7, 0.06 * v);
    } else if (lane === 's') {
      noiseHit(dest, t, 0.16, 'bandpass', 2100, 800, 1.0, 0.24 * v);
      voice(dest, t, 214, 0.1, 0.1 * v, { type: 'triangle', toHz: 128, attack: 0.002, release: 0.03 });
    } else if (lane === 'h') {
      noiseHit(dest, t, 0.03, 'highpass', 8600, 11000, 0.6, 0.045 * v, 0.3);
    } else if (lane === 'o') {
      noiseHit(dest, t, 0.16, 'highpass', 7200, 9000, 0.6, 0.04 * v, -0.3);
    } else if (lane === 'c') {
      noiseHit(dest, t, 0.55, 'lowpass', 6400, 1400, 0.6, 0.12 * v, 0.4);
    } else if (lane === 't') {
      voice(dest, t, 210, 0.14, 0.2 * v, { type: 'sine', toHz: 86, attack: 0.002, release: 0.03 });
    }
  }

  function playDrum(dest, t, lane, song, style, scale) {
    var vol = (song.drumVol || 1) * (scale === undefined ? 1 : scale);
    if (style === 'synth') { synthDrum(dest, t, lane, vol); }
    else { chipDrum(dest, t, lane, vol); }
  }

  /* ============================================================
     6. MUSIC PLAYER + LOOKAHEAD SEQUENCER
     ============================================================ */
  function Player(id, song) {
    this.id = id;
    this.song = song;
    this.style = state.style;
    this.out = null;
    this.chipIn = null;
    this.chipOut = null;
    this.synthIn = null;
    this.synthFilter = null;
    this.synthOut = null;
    this.delay = null;
    this.fb = null;
    this.damp = null;
    this.wet = null;
    this.timer = 0;
    this.tailTimer = 0;
    this.nextTime = 0;
    this.step = 0;
    this.stopping = false;
    this.finished = false;
    this.disposed = false;
    this.fadeSec = 0.3;
  }

  Player.prototype.start = function (fadeSec) {
    var ctx = state.ctx;
    if (!ctx || this.disposed) { return false; }
    this.fadeSec = clamp(fadeSec === undefined ? 0.3 : fadeSec, 0.05, 2);
    try {
      this.out = ctx.createGain();
      this.chipIn = ctx.createGain();
      this.chipOut = ctx.createGain();
      this.synthIn = ctx.createGain();
      this.synthFilter = ctx.createBiquadFilter();
      this.synthOut = ctx.createGain();
    } catch (e) { this.dispose(); return false; }

    this.synthFilter.type = 'lowpass';
    this.synthFilter.frequency.value = synthCutoff();
    this.synthFilter.Q.value = 0.8;

    var chipTarget = this.style === 'chip' ? 1 : 0;
    var synthTarget = this.style === 'synth' ? 1 : 0;
    try {
      this.out.gain.value = 0.0001;
      this.chipIn.gain.value = 1;
      this.chipOut.gain.value = chipTarget;
      this.synthIn.gain.value = 1;
      this.synthOut.gain.value = synthTarget;
    } catch (e) { this.dispose(); return false; }

    connect(this.chipIn, this.chipOut);
    connect(this.chipOut, this.out);
    connect(this.synthIn, this.synthFilter);
    connect(this.synthFilter, this.synthOut);
    connect(this.synthOut, this.out);

    /* warm synth echo, panned wide via the wet path */
    try {
      this.delay = ctx.createDelay(1.0);
      this.delay.delayTime.value = 0.27;
      this.fb = ctx.createGain();
      this.fb.gain.value = 0.24;
      this.damp = ctx.createBiquadFilter();
      this.damp.type = 'lowpass';
      this.damp.frequency.value = 2600;
      this.wet = ctx.createGain();
      this.wet.gain.value = 0.16;
      connect(this.synthFilter, this.delay);
      connect(this.delay, this.damp);
      connect(this.damp, this.fb);
      connect(this.fb, this.delay);
      connect(this.damp, this.wet);
      connect(this.wet, this.synthOut);
    } catch (e) { /* echo is optional */ }

    if (!connect(this.out, state.musicMix)) { this.dispose(); return false; }

    try {
      var now = ctx.currentTime, p = this.out.gain;
      p.setValueAtTime(0.0001, now);
      p.linearRampToValueAtTime(MUSIC_TRACK_LEVEL, now + this.fadeSec);
    } catch (e) { /* ignore */ }

    this.nextTime = ctx.currentTime + 0.08;
    this.step = 0;
    var self = this;
    this.timer = every(function () { self.tick(); }, TICK_MS);
    this.tick();
    return true;
  };

  Player.prototype.tick = function () {
    var ctx = state.ctx;
    if (!ctx || this.disposed || this.stopping || this.finished) { return; }
    try {
      sweepVoices(false);
      if (ctx.state !== 'running' || audioClockStalled()) {
        this.nextTime = ctx.currentTime + 0.08;
        return;
      }
      var now = ctx.currentTime, song = this.song, guard = 0;
      if (this.nextTime < now - 0.4) { this.nextTime = now + 0.06; }
      while (this.nextTime < now + LOOKAHEAD && guard < 96) {
        if (!song.loop && this.step >= song.totalSteps) { this.finish(); break; }
        this.schedule(this.step % song.totalSteps, this.nextTime);
        this.step++;
        if (song.loop) { this.step %= song.totalSteps; }
        this.nextTime += song.stepDur;
        guard++;
      }
      if (!song.loop && this.step >= song.totalSteps) { this.finish(); }
    } catch (e) { /* a timer must never throw into the host page */ }
  };

  Player.prototype.schedule = function (stepIndex, t) {
    var ctx = state.ctx;
    if (!ctx || this.disposed || !this.chipIn) { return; }
    var song = this.song, sd = song.stepDur;
    var bar = song.bars[Math.floor(stepIndex / 16) % song.barCount];
    if (!bar) { return; }
    var pos = stepIndex % 16;
    var style = this.style;
    var dest = style === 'synth' ? this.synthIn : this.chipIn;
    var inten = song.layers ? state.intensity : 0;
    var i, ev, list;

    /* synth pad: one sustained chord per bar */
    if (style === 'synth' && pos === 0) {
      var padBase = 48 + bar.chord.root, padTones = bar.chord.intervals;
      for (i = 0; i < padTones.length; i++) {
        synthPad(dest, t, midiToFreq(padBase + padTones[i]), sd * 16 * 1.02, 1);
        state.notes++;
      }
    }

    /* lead */
    list = bar.lead[pos];
    for (i = 0; i < list.length; i++) {
      ev = list[i];
      var ldur = ev.steps * sd;
      if (style === 'synth') { synthLead(dest, t, ev.hz, ldur * 0.92, ev.vel, song); }
      else { chipLead(dest, t, ev.hz, ldur * 0.92, ev.vel, song); }
      state.notes++;
      /* high-intensity fifth layer */
      if (inten > 0.82 && ev.steps >= 2) {
        var fifth = ev.hz * 1.4983;
        if (style === 'synth') { synthHarm(dest, t, fifth, ldur * 0.7, 0.5, song, 0.1); }
        else { chipHarm(dest, t, fifth, ldur * 0.7, 0.5, song); }
        state.notes++;
      }
    }

    /* harmony / arpeggio channel */
    if (bar.arp) {
      var slot = bar.arp[pos];
      if (slot) {
        var adur = slot.steps * sd * 0.85;
        if (style === 'synth') { synthHarm(dest, t, slot.hz, adur, 1, song, pos % 4 < 2 ? -0.3 : 0.3); }
        else { chipHarm(dest, t, slot.hz, adur, 1, song); }
        state.notes++;
        if (inten > 0.32) {
          var oct = slot.hz * 2;
          if (style === 'synth') { synthHarm(dest, t, oct, adur * 0.7, 0.42, song, pos % 4 < 2 ? 0.32 : -0.32); }
          else { chipHarm(dest, t, oct, adur * 0.7, 0.45, song); }
          state.notes++;
        }
      }
    }

    /* bass */
    list = bar.bass[pos];
    for (i = 0; i < list.length; i++) {
      ev = list[i];
      if (style === 'synth') { synthBass(dest, t, ev.hz, ev.steps * sd, ev.vel, song); }
      else { chipBass(dest, t, ev.hz, ev.steps * sd, ev.vel, song); }
      state.notes++;
    }

    /* drums */
    list = bar.drums[pos];
    for (i = 0; i < list.length; i++) {
      playDrum(dest, t, list[i].lane, song, style, list[i].vel);
      state.notes++;
    }

    /* intensity: extra percussion drive as the fight heats up */
    if (inten > 0.55 && (pos % 4 === 2 || pos % 4 === 3)) {
      playDrum(dest, t, 'h', song, style, 0.42);
      state.notes++;
    }
    if (inten > 0.72 && pos === 0 && style === 'synth') {
      playDrum(dest, t, 'c', song, style, 0.5);
      state.notes++;
    }
  };

  Player.prototype.finish = function () {
    if (this.finished || this.disposed) { return; }
    this.finished = true;
    if (this.timer) { stopTimer(this.timer); this.timer = 0; }
    var ctx = state.ctx, self = this;
    var wait = 0.4;
    if (ctx && isFinite(this.nextTime)) { wait = Math.max(0.3, this.nextTime - ctx.currentTime) + 0.5; }
    if (state.current === this) { state.current = null; state.desired = null; }
    this.tailTimer = later(function () { self.stop(0.7, true); }, Math.round(wait * 1000));
  };

  Player.prototype.stop = function (fadeSec, silent) {
    if (this.disposed || this.stopping) { return; }
    this.stopping = true;
    if (this.timer) { stopTimer(this.timer); this.timer = 0; }
    if (this.tailTimer) { stopTimer(this.tailTimer); this.tailTimer = 0; }
    var ctx = state.ctx, f = clamp(fadeSec === undefined ? 0.35 : fadeSec, 0.05, 3);
    if (ctx && this.out) {
      try {
        var now = ctx.currentTime, p = this.out.gain, cur = Number(p.value);
        if (!isFinite(cur) || cur <= 0) { cur = 0.0001; }
        p.cancelScheduledValues(now);
        p.setValueAtTime(cur, now);
        p.linearRampToValueAtTime(0.0001, now + f);
      } catch (e) { /* ignore */ }
    }
    var self = this;
    this.tailTimer = later(function () { self.dispose(); }, Math.round((f + 0.18) * 1000));
  };

  Player.prototype.dispose = function () {
    if (this.disposed) { return; }
    this.disposed = true;
    this.stopping = true;
    if (this.timer) { stopTimer(this.timer); this.timer = 0; }
    if (this.tailTimer) { stopTimer(this.tailTimer); this.tailTimer = 0; }
    disconnect(this.chipIn); disconnect(this.chipOut);
    disconnect(this.synthIn); disconnect(this.synthFilter); disconnect(this.synthOut);
    disconnect(this.delay); disconnect(this.fb); disconnect(this.damp); disconnect(this.wet);
    disconnect(this.out);
    this.chipIn = this.chipOut = this.synthIn = this.synthFilter = this.synthOut = null;
    this.delay = this.fb = this.damp = this.wet = this.out = null;
    var idx = state.players.indexOf(this);
    if (idx >= 0) { state.players.splice(idx, 1); }
    if (state.current === this) { state.current = null; }
    sweepVoices(true);
  };

  function synthCutoff() {
    var base = 900 + state.intensity * 2600;
    if (state.ducked) { base *= 0.36; }
    return clamp(base, 180, 12000);
  }
  function applyFilterTargets(sec) {
    for (var i = 0; i < state.players.length; i++) {
      var p = state.players[i];
      if (p.synthFilter) { rampParam(p.synthFilter.frequency, synthCutoff(), sec); }
    }
  }

  function startTrack(id) {
    if (!isTrackId(id)) { return false; }
    var song = SONGS[id];
    if (!song) { return false; }
    if (state.current && state.current.id === id && !state.current.finished) { return true; }
    if (!ctxRunning()) { state.desired = id; return true; }
    var player = new Player(id, song);
    var fade = (state.current && !state.current.finished) ? CROSSFADE : 0.22;
    if (!player.start(fade)) { return false; }
    state.players.push(player);
    var old = state.current;
    state.current = player;
    state.desired = id;
    if (old && old !== player) { old.stop(CROSSFADE); }
    return true;
  }

  /* ============================================================
     7. SOUND EFFECTS (22 one-shots)
     ============================================================ */
  function pl(dest, t, hz, dur, peak, o) { voice(dest, t, hz, dur, peak, o); }

  var SFX_DEFS = {
    ui_move: function (t, b) {
      pl(b, t, 760, 0.05, 0.1, { wave: pulseWave(0.25), attack: 0.001, release: 0.008, pluck: true });
    },
    ui_select: function (t, b) {
      pl(b, t, 660, 0.055, 0.11, { wave: pulseWave(0.25), attack: 0.001, release: 0.01, pluck: true });
      pl(b, t + 0.055, 990, 0.09, 0.11, { wave: pulseWave(0.25), attack: 0.001, release: 0.02, pluck: true });
    },
    ui_back: function (t, b) {
      pl(b, t, 520, 0.05, 0.1, { wave: pulseWave(0.25), attack: 0.001, release: 0.008, pluck: true });
      pl(b, t + 0.05, 370, 0.08, 0.1, { wave: pulseWave(0.125), attack: 0.001, release: 0.015, pluck: true });
    },
    punch: function (t, b) {
      pl(b, t, 182, 0.09, 0.22, { type: 'sine', toHz: 70, attack: 0.002, release: 0.02 });
      noiseHit(b, t, 0.06, 'lowpass', 1200, 380, 0.8, 0.16);
    },
    kick: function (t, b) {
      pl(b, t, 205, 0.13, 0.27, { type: 'sine', toHz: 58, attack: 0.002, release: 0.03 });
      noiseHit(b, t, 0.04, 'bandpass', 1900, 650, 1, 0.1);
    },
    hit: function (t, b) {
      noiseHit(b, t, 0.07, 'bandpass', 2400, 900, 1.1, 0.21);
      pl(b, t, 320, 0.06, 0.17, { type: 'square', toHz: 140, attack: 0.001, release: 0.012 });
    },
    hit_heavy: function (t, b) {
      noiseHit(b, t, 0.16, 'lowpass', 1400, 280, 0.8, 0.28);
      pl(b, t, 120, 0.2, 0.29, { type: 'sine', toHz: 42, attack: 0.002, release: 0.05 });
      pl(b, t, 258, 0.08, 0.11, { type: 'square', toHz: 90, attack: 0.001, release: 0.02 });
      noiseHit(b, t + 0.02, 0.1, 'highpass', 3200, 6200, 0.8, 0.06);
    },
    block: function (t, b) {
      pl(b, t, 520, 0.07, 0.13, { type: 'square', attack: 0.001, release: 0.012 });
      pl(b, t + 0.01, 790, 0.08, 0.09, { type: 'square', attack: 0.001, release: 0.02 });
      noiseHit(b, t, 0.03, 'highpass', 5200, 9000, 0.8, 0.07);
    },
    jump: function (t, b) {
      pl(b, t, 260, 0.16, 0.14, { wave: pulseWave(0.25), toHz: 840, attack: 0.003, release: 0.02 });
    },
    land: function (t, b) {
      pl(b, t, 110, 0.09, 0.2, { type: 'sine', toHz: 50, attack: 0.002, release: 0.02 });
      noiseHit(b, t, 0.07, 'lowpass', 900, 280, 0.9, 0.13);
    },
    special: function (t, b) {
      var notes = [523.25, 659.25, 783.99, 1046.5], i;
      for (i = 0; i < notes.length; i++) {
        pl(b, t + i * 0.045, notes[i], 0.09, 0.11, { wave: pulseWave(0.125), attack: 0.001, release: 0.02, pluck: true });
      }
      noiseHit(b, t, 0.25, 'highpass', 2200, 8200, 0.8, 0.09);
      pl(b, t + 0.18, 1046.5, 0.2, 0.11, { wave: pulseWave(0.25), attack: 0.004, release: 0.03 });
    },
    pickup: function (t, b) {
      pl(b, t, 740, 0.06, 0.1, { wave: pulseWave(0.5), attack: 0.001, release: 0.01, pluck: true });
      pl(b, t + 0.06, 988, 0.1, 0.1, { wave: pulseWave(0.5), attack: 0.001, release: 0.02, pluck: true });
    },
    coin: function (t, b) {
      pl(b, t, 988, 0.06, 0.11, { wave: pulseWave(0.5), attack: 0.001, release: 0.01, pluck: true });
      pl(b, t + 0.06, 1319, 0.16, 0.1, { wave: pulseWave(0.5), attack: 0.001, release: 0.03 });
    },
    heal: function (t, b) {
      var notes = [523.25, 659.25, 783.99, 1046.5], i;
      for (i = 0; i < notes.length; i++) {
        pl(b, t + i * 0.07, notes[i], 0.18, 0.085, { type: 'triangle', attack: 0.004, release: 0.04 });
      }
    },
    ko: function (t, b) {
      noiseHit(b, t, 0.4, 'lowpass', 2000, 120, 0.8, 0.26);
      pl(b, t, 300, 0.35, 0.17, { type: 'square', toHz: 70, attack: 0.002, release: 0.08 });
    },
    crate: function (t, b) {
      noiseHit(b, t, 0.12, 'bandpass', 1400, 500, 0.9, 0.23);
      noiseHit(b, t + 0.05, 0.15, 'lowpass', 1200, 300, 0.8, 0.17);
      pl(b, t, 160, 0.1, 0.13, { type: 'triangle', toHz: 70, attack: 0.002, release: 0.02 });
    },
    wave: function (t, b) {
      var notes = [392, 523.25, 659.25], i;
      for (i = 0; i < notes.length; i++) {
        pl(b, t + i * 0.09, notes[i], 0.14, 0.11, { wave: pulseWave(0.25), attack: 0.004, release: 0.02 });
      }
      pl(b, t + 0.28, 783.99, 0.3, 0.1, { wave: pulseWave(0.25), attack: 0.004, release: 0.06 });
    },
    boss_roar: function (t, b) {
      voice(b, t, 90, 0.9, 0.22, { type: 'sawtooth', toHz: 38, attack: 0.05, release: 0.2, filter: { type: 'lowpass', from: 900, to: 200, q: 2 } });
      noiseHit(b, t, 0.8, 'lowpass', 900, 150, 0.8, 0.16);
      pl(b, t + 0.1, 140, 0.7, 0.11, { type: 'square', toHz: 60, attack: 0.02, release: 0.1 });
    },
    explosion: function (t, b) {
      noiseHit(b, t, 0.5, 'lowpass', 2400, 120, 0.9, 0.32);
      pl(b, t, 120, 0.4, 0.22, { type: 'sine', toHz: 34, attack: 0.002, release: 0.1 });
      noiseHit(b, t + 0.06, 0.2, 'bandpass', 900, 300, 1, 0.13);
    },
    player_hurt: function (t, b) {
      pl(b, t, 430, 0.18, 0.15, { wave: pulseWave(0.5), toHz: 160, attack: 0.002, release: 0.03 });
      noiseHit(b, t, 0.1, 'bandpass', 1600, 500, 0.9, 0.09);
    },
    gameover: function (t, b) {
      var notes = [440, 349.23, 293.66, 220], i;
      for (i = 0; i < notes.length; i++) {
        pl(b, t + i * 0.18, notes[i], 0.26, 0.13, { wave: pulseWave(0.25), attack: 0.005, release: 0.05 });
      }
      pl(b, t + 0.75, 110, 0.6, 0.11, { type: 'triangle', toHz: 55, attack: 0.01, release: 0.2 });
    },
    win: function (t, b) {
      var notes = [523.25, 659.25, 783.99, 1046.5, 1318.51], i;
      for (i = 0; i < notes.length; i++) {
        pl(b, t + i * 0.08, notes[i], 0.14, 0.12, { wave: pulseWave(0.25), attack: 0.003, release: 0.02 });
      }
      pl(b, t + 0.4, 1567.98, 0.5, 0.09, { wave: pulseWave(0.125), attack: 0.01, release: 0.12 });
    }
  };

  function sfx(id) {
    try {
      if (!state.ctx) { init(); }
      sweepVoices(false);
      var ctx = state.ctx;
      if (!ctx || !ctxRunning() || !state.sfxOn || audioClockStalled()) { return false; }
      var def = SFX_DEFS[id];
      if (typeof def !== 'function') { return false; }
      var now = ctx.currentTime;
      var last = state.lastSfx[id] || -1;
      if (now - last < 0.018) { return true; }
      state.lastSfx[id] = now;
      def(now + 0.004, state.sfxMix);
      return true;
    } catch (e) { return false; }
  }

  /* ============================================================
     8. PUBLIC API
     ============================================================ */
  function setMusic(on) {
    state.musicOn = !!on;
    rampParam(state.musicMix && state.musicMix.gain, state.musicOn ? (state.ducked ? DUCK_GAIN : 1) : 0, 0.18);
    return state.musicOn;
  }

  function setSfx(on) {
    state.sfxOn = !!on;
    rampParam(state.sfxMix && state.sfxMix.gain, state.sfxOn ? SFX_LEVEL : 0, 0.04);
    return state.sfxOn;
  }

  function setVolume(v) {
    state.volume = clamp(v, 0, 1);
    rampParam(state.master && state.master.gain, state.volume * MASTER_LEVEL, 0.04);
    return state.volume;
  }

  function setStyle(style) {
    var next = style === 'synth' ? 'synth' : (style === 'chip' ? 'chip' : state.style);
    if (next === state.style) { return state.style; }
    state.style = next;
    for (var i = 0; i < state.players.length; i++) {
      var p = state.players[i];
      if (!p || p.disposed) { continue; }
      p.style = next;
      rampParam(p.chipOut && p.chipOut.gain, next === 'chip' ? 1 : 0, CROSSFADE);
      rampParam(p.synthOut && p.synthOut.gain, next === 'synth' ? 1 : 0, CROSSFADE);
    }
    return state.style;
  }

  function playMusic(id) {
    try {
      if (!isTrackId(id) || !SONGS[id]) { return false; }
      if (!state.ctx) { init(); }
      state.desired = id;
      if (!state.ctx) { return false; }
      if (!ctxRunning()) { return true; }
      return startTrack(id);
    } catch (e) { return false; }
  }

  function stopMusic() {
    try {
      state.desired = null;
      var list = state.players.slice();
      for (var i = 0; i < list.length; i++) {
        try { list[i].stop(0.35); } catch (e) { /* ignore */ }
      }
      state.current = null;
      return true;
    } catch (e) { return false; }
  }

  function duck(on) {
    state.ducked = !!on;
    var target = state.musicOn ? (state.ducked ? DUCK_GAIN : 1) : 0;
    rampParam(state.musicMix && state.musicMix.gain, target, 0.24);
    applyFilterTargets(0.24);
    return state.ducked;
  }

  function setIntensity(v) {
    state.intensity = clamp(typeof v === 'number' ? v : 0, 0, 1);
    applyFilterTargets(0.3);
    return state.intensity;
  }

  function snapshot() {
    return {
      ready: ready(),
      playing: !!state.current,
      style: state.style,
      music: state.musicOn,
      sfx: state.sfxOn,
      volume: state.volume,
      notes: state.notes,
      track: state.current ? state.current.id : null,
      intensity: state.intensity,
      ducked: state.ducked,
      ctxState: state.ctx ? state.ctx.state : 'none',
      ctxTime: state.ctx ? state.ctx.currentTime : 0,
      stalled: !!state.stalled,
      voices: activeVoices,
      noiseVoices: activeNoise,
      registry: voiceRegistry.length,
      maxVoices: MAX_VOICES
    };
  }

  var api = {
    __engine: 'dd-neon-1',
    init: init,
    unlock: unlock,
    ready: ready,
    setMusic: setMusic,
    setSfx: setSfx,
    setVolume: setVolume,
    setStyle: setStyle,
    playMusic: playMusic,
    stopMusic: stopMusic,
    duck: duck,
    intensity: setIntensity,
    sfx: sfx,
    state: snapshot,
    /* QA tap: audio graph handles for analyser-based proof pages */
    _debugNodes: function () {
      return {
        ctx: state.ctx, musicMix: state.musicMix, sfxMix: state.sfxMix,
        master: state.master, limiter: state.limiter,
        players: state.players.map(function (p) {
          return {
            id: p.id, style: p.style, stopping: p.stopping, finished: p.finished,
            out: p.out ? p.out.gain.value : null,
            chip: p.chipOut ? p.chipOut.gain.value : null,
            synth: p.synthOut ? p.synthOut.gain.value : null,
            filter: p.synthFilter ? p.synthFilter.frequency.value : null
          };
        })
      };
    }
  };

  ROOT.DD_AUDIO = api;
})();
