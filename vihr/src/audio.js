/*!
 * ВИХРЬ (1988 Гефест) — HTML5 original · 8-bit audio engine.
 * Classic script, no modules, no assets, no network: defines window.SWAudio.
 * Everything is synthesised with WebAudio (pulse / triangle / noise).
 *
 * API (safe at any time; no-ops when WebAudio is unavailable, never throws):
 *   unlock()                     -> boolean  create/resume AudioContext from a gesture; idempotent
 *   playMusic(name, opts)        -> boolean  'title'|'stage'|'boss'|'clear'|'gameover'
 *                                             opts { fade: ms=350, restart: bool=false }
 *                                             same track is not restarted unless restart:true
 *   stopMusic(fadeMs)            -> boolean  (fadeMs default 300)
 *   setMusicVolume(v)            -> number   0..1, clamped
 *   setSfxVolume(v)              -> number   0..1, clamped
 *   setMuted(bool)               -> boolean  master mute; music keeps its position (no teardown)
 *   sfx(name)                    -> boolean  'shoot','enemyShoot','hit','explosion','bigExplosion',
 *                                             'powerup','death','select','warning','bossHit','jump','bomb'
 *   selftest()                   -> [{name, ok, msg}]  pure theory/data checks, no audio needed
 *   isReady()                    -> boolean
 *
 * MUSIC: lookahead sequencer (setInterval 25 ms, schedules 120 ms ahead, 16 steps/bar).
 * Two pulse voices (lead + arpeggiated harmony), triangle bass, noise drums
 * (kick/snare/closed+open hat). Subtle lead vibrato, optional dotted-eighth echo,
 * master DynamicsCompressor + soft-clip safety limiter. title/stage/boss/clear loop seamlessly;
 * gameover is a one-shot descending jingle that stops itself. If the tab is
 * throttled the sequencer re-aligns instead of firing a burst of late notes.
 *
 * PATTERN SYNTAX (data lives in DRUM_DEFS / BASS_DEFS / ARP_DEFS / TRACK_DEFS):
 *   lead  "step:Note:length[:velocity]"   step 0..15 (16ths), e.g. "0:D5:2 4:F#5:4"
 *   bass  "step:semitones:length"         semitones from the chord root, e.g. "0:0:2 4:7:2"
 *   drums lane strings, one char per 16th; k/s/h/o = kick/snare/closed hat/open hat,
 *         '.' or space = rest, anything else = hit
 *   arp   chord-tone pattern indices into [root, 3rd, 5th, root+8ve, ...]
 */
(function () {
  'use strict';
  var ROOT = (typeof window !== 'undefined' && window) ||
             (typeof globalThis !== 'undefined' && globalThis) || {};
  if (ROOT.SWAudio && typeof ROOT.SWAudio.selftest === 'function') { return; }

  /* ============================ utilities ============================ */
  function clamp(v, lo, hi) {
    v = Number(v);
    if (!isFinite(v)) { return lo; }
    return v < lo ? lo : (v > hi ? hi : v);
  }
  function later(fn, ms) { try { return setTimeout(fn, ms); } catch (e) { return 0; } }
  function every(fn, ms) { try { return setInterval(fn, ms); } catch (e) { return 0; } }
  function stopTimer(id) {
    if (!id) { return; }
    try { clearInterval(id); } catch (e) { /* ignore */ }
    try { clearTimeout(id); } catch (e) { /* ignore */ }
  }
  function connect(a, b) { if (!a || !b) { return false; } try { a.connect(b); return true; } catch (e) { return false; } }
  function disconnect(n) { if (!n) { return; } try { n.disconnect(); } catch (e) { /* ignore */ } }
  function slots16() { var a = [], i; for (i = 0; i < 16; i++) { a.push([]); } return a; }
  function grid16() { var a = [], i; for (i = 0; i < 16; i++) { a.push(null); } return a; }

  /* ========================= music theory ========================== */
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

  var CHORD_TYPES = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], dim: [0, 3, 6], aug: [0, 4, 8], sus: [0, 5, 7], sus2: [0, 2, 7] };
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

  /* ====================== composition vocabulary ==================== */
  /* drum lanes, one char per 16th step */
  var DRUM_DEFS = {
    titleA: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' },
    titleB: { k: 'x...x...x..x....', s: '....x.......x...', h: '..x...x...x...x.', o: '..x...x...x...x.' },
    titleF: { k: 'x...x...x...x...', s: '....x.......xxxx', h: '..x...x...x...x.' },
    stageA: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    stageB: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
    stageF: { k: 'x..x..x.x...x...', s: '....x.......xxxx', h: 'x.x.x.x.........' },
    bossA: { k: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', o: '..x...x...x...x.' },
    bossB: { k: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
    bossF: { k: 'x.x.x.x.x...x...', s: '....x.....xxxxxx', h: 'xxxxxxxx........' },
    clearA: { k: 'x.......x.......', s: '........x.......', h: '..x...x...x...x.' },
    clearF: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '..............x.' },
    over: { k: 'x.......x.......', s: '................', h: '..............x.' },
    overF: { k: '........x.......', s: '................', h: '................' }
  };
  /* bass: step:semitone-offset-from-chord-root:length */
  var BASS_DEFS = {
    march: '0:0:2 2:0:2 4:7:2 6:0:2 8:12:2 10:0:2 12:7:2 14:10:2',
    march2: '0:0:2 2:12:2 4:0:2 6:7:2 8:0:2 10:12:2 12:7:2 14:5:2',
    octave: '0:0:2 2:12:2 4:0:2 6:12:2 8:0:2 10:12:2 12:7:2 14:12:2',
    walk: '0:0:2 2:3:2 4:7:2 6:10:2 8:12:2 10:10:2 12:7:2 14:3:2',
    walk2: '0:0:2 2:-5:2 4:0:2 6:3:2 8:7:2 10:3:2 12:0:2 14:-5:2',
    half: '0:0:4 4:0:4 8:7:4 12:12:4',
    half2: '0:0:4 4:7:4 8:12:4 12:7:4',
    bossDrive: '0:0:1 1:0:1 2:7:2 4:0:2 6:12:2 8:0:1 9:0:1 10:7:2 12:12:2 14:6:2',
    chromeUp: '0:0:2 2:1:2 4:2:2 6:3:2 8:4:2 10:5:2 12:6:2 14:7:2',
    chromeDn: '0:12:2 2:11:2 4:10:2 6:9:2 8:8:2 10:7:2 12:6:2 14:5:2'
  };
  /* arpeggio: rate = steps between notes, pat = chord-tone indices */
  var ARP_DEFS = {
    bounce: { rate: 2, pat: [0, 2, 1, 2, 0, 2, 1, 3] },
    bounceB: { rate: 2, pat: [0, 1, 2, 3, 2, 1, 0, 1] },
    pulse: { rate: 2, pat: [0, 1, 2, 3, 2, 1, 0, 2] },
    pulseB: { rate: 2, pat: [0, 2, 3, 2, 1, 0, 1, 2] },
    tense: { rate: 2, pat: [0, 1, 0, 1, 2, 1, 0, 2] },
    drive16: { rate: 1, pat: [0, 1, 2, 3, 2, 1, 0, 2, 1, 3, 2, 1, 0, 2, 1, 3] },
    sparse: { rate: 4, pat: [0, 1, 2, 1] }
  };

  /* ======================= original soundtrack ====================== *
   * Helicopters over the desert at sunset: harmonic-minor swagger.     */
  var TRACK_DEFS = {
    title: {
      bpm: 132, loop: true, leadDuty: 0.25, arpDuty: 0.125, leadLen: 2, bassLen: 2,
      leadVol: 0.17, arpVol: 0.055, bassVol: 0.20, drumVol: 0.9, leadDetune: 6,
      arp: 'bounce', arpOctave: 0, echo: { time: 0.34, feedback: 0.22, mix: 0.14 },
      bars: [
        { chord: 'G', lead: '0:G4:2 2:B4:2 4:D5:2 6:G5:4 10:F#5:2 12:G5:4', bass: 'octave', drums: 'titleA' },
        { chord: 'Em', lead: '0:E5:2 2:G5:2 4:B5:2 6:A5:2 8:G5:2 10:E5:2 12:B4:4', bass: 'walk', drums: 'titleA' },
        { chord: 'C', lead: '0:C5:2 2:E5:2 4:G5:2 6:C6:4 10:B5:1 11:A5:1 12:G5:4', bass: 'octave', drums: 'titleA' },
        { chord: 'D', lead: '0:A5:2 2:F#5:2 4:D5:2 6:F#5:2 8:A5:2 10:D6:2 12:C6:2 14:A5:2', bass: 'walk', drums: 'titleA' },
        { chord: 'G', lead: '0:B5:4 4:D6:4 8:B5:2 10:A5:2 12:G5:2 14:A5:2', bass: 'octave', drums: 'titleB' },
        { chord: 'C', lead: '0:C6:4 4:E6:4 8:D6:2 10:C6:2 12:G5:2 14:C6:2', bass: 'octave', drums: 'titleB' },
        { chord: 'Am', lead: '0:A5:2 2:C6:2 4:E6:2 6:A6:4 10:G6:2 12:E6:2 14:C6:2', bass: 'walk', drums: 'titleB' },
        { chord: 'D', lead: '0:D6:2 2:C6:2 4:A5:2 6:F#5:2 8:A5:2 10:C6:2 12:D6:2 14:F#6:2', bass: 'walk', drums: 'titleB' },
        { chord: 'C', lead: '0:G5:1 1:G5:1 2:E5:2 4:G5:2 6:C6:2 8:B5:3 11:A5:1 12:G5:2 14:E5:2', bass: 'octave', drums: 'titleA', arp: 'bounceB' },
        { chord: 'D', lead: '0:F#5:1 1:F#5:1 2:A5:2 4:D6:2 6:A5:2 8:F#5:2 10:A5:2 12:D6:4', bass: 'walk', drums: 'titleA', arp: 'bounceB' },
        { chord: 'Bm', lead: '0:B5:2 2:D6:2 4:B5:2 6:F#5:2 8:B5:4 12:A5:2 14:F#5:2', bass: 'walk', drums: 'titleA', arp: 'bounceB' },
        { chord: 'Em', lead: '0:G5:2 2:B5:2 4:E6:4 8:D6:2 10:B5:2 12:G5:4', bass: 'octave', drums: 'titleA', arp: 'bounceB' },
        { chord: 'C', lead: '0:E6:3 3:D6:1 4:C6:2 6:G5:2 8:E6:2 10:D6:2 12:C6:4', bass: 'octave', drums: 'titleB' },
        { chord: 'D', lead: '0:D6:3 3:C6:1 4:A5:2 6:F#5:2 8:A5:2 10:C6:2 12:D6:4', bass: 'walk', drums: 'titleB' },
        { chord: 'G', lead: '0:G5:2 2:B5:2 4:D6:2 6:G6:4 10:F#6:2 12:G6:4', bass: 'octave', drums: 'titleB' },
        { chord: 'D', lead: '0:F#6:2 2:E6:2 4:D6:2 6:C6:2 8:A5:2 10:F#5:2 12:A5:2 14:D5:2', bass: 'walk', drums: 'titleF' }
      ]
    },
    stage: {
      bpm: 150, loop: true, leadDuty: 0.25, arpDuty: 0.125, leadLen: 2, bassLen: 2,
      leadVol: 0.18, arpVol: 0.05, bassVol: 0.21, drumVol: 1, leadDetune: 4,
      arp: 'pulse', arpOctave: 0, echo: { time: 0.20, feedback: 0.20, mix: 0.12 },
      bars: [
        /* A: the 8-bar hook, D harmonic minor */
        { chord: 'Dm', lead: '0:A4:2 2:D5:2 4:F5:2 6:E5:2 8:D5:3 11:C#5:1 12:D5:4', bass: 'march', drums: 'stageA' },
        { chord: 'Dm', lead: '0:A5:2 2:G5:2 4:F5:2 6:E5:2 8:F5:2 10:E5:2 12:D5:4', bass: 'march2', drums: 'stageA' },
        { chord: 'Bb', lead: '0:Bb4:2 2:D5:2 4:F5:3 7:E5:1 8:D5:2 10:F5:2 12:Bb5:4', bass: 'march', drums: 'stageA' },
        { chord: 'A7', lead: '0:A5:3 3:G5:1 4:E5:2 6:C#5:2 8:E5:2 10:G5:2 12:A5:4', bass: 'march2', drums: 'stageA' },
        { chord: 'Dm', lead: '0:D5:2 2:F5:2 4:A5:2 6:D6:3 9:C#6:1 10:D6:2 12:A5:2 14:F5:2', bass: 'march', drums: 'stageA' },
        { chord: 'F', lead: '0:F5:2 2:A5:2 4:C6:2 6:A5:2 8:F5:2 10:A5:2 12:C6:4', bass: 'march2', drums: 'stageA', arp: 'pulseB' },
        { chord: 'Gm', lead: '0:G5:2 2:Bb5:2 4:D6:2 6:C6:2 8:Bb5:2 10:A5:2 12:G5:2 14:F5:2', bass: 'march', drums: 'stageA', arp: 'pulseB' },
        { chord: 'A7', lead: '0:E5:2 2:G5:2 4:C#6:2 6:E6:3 9:D6:1 10:C#6:2 12:A5:4', bass: 'march2', drums: 'stageF', arp: 'pulseB' },
        /* B: low helicopter ostinato, then a high call */
        { chord: 'Dm', lead: '0:D5:1 1:D5:1 2:A5:2 4:F5:2 6:D5:2 8:E5:1 9:F5:1 10:G5:2 12:A5:4', bass: 'march', drums: 'stageB', arp: 'pulseB' },
        { chord: 'F', lead: '0:F5:1 1:F5:1 2:C6:2 4:A5:2 6:F5:2 8:G5:1 9:A5:1 10:Bb5:2 12:A5:4', bass: 'march2', drums: 'stageB', arp: 'pulseB' },
        { chord: 'Bb', lead: '0:Bb5:2 2:A5:2 4:G5:2 6:F5:2 8:D5:2 10:F5:2 12:Bb5:4', bass: 'march', drums: 'stageB', arp: 'pulseB' },
        { chord: 'A7', lead: '0:A5:2 2:C#6:2 4:E6:2 6:C#6:2 8:A5:2 10:G5:2 12:E5:4', bass: 'march2', drums: 'stageB', arp: 'pulseB' },
        { chord: 'Dm', lead: '0:F5:1 1:G5:1 2:A5:2 4:D6:2 6:A5:2 8:G5:1 9:F5:1 10:E5:2 12:D5:4', bass: 'march', drums: 'stageB', arp: 'pulseB' },
        { chord: 'Bb', lead: '0:D6:2 2:C6:2 4:Bb5:2 6:A5:2 8:F5:2 10:D5:2 12:F5:4', bass: 'march2', drums: 'stageB', arp: 'pulseB' },
        { chord: 'Gm', lead: '0:G5:2 2:Bb5:2 4:D6:3 7:C6:1 8:Bb5:2 10:A5:2 12:G5:4', bass: 'march', drums: 'stageB', arp: 'pulseB' },
        { chord: 'A7', lead: '0:A5:2 2:C#6:2 4:E6:2 6:A6:2 8:G6:2 10:E6:2 12:C#6:4', bass: 'march2', drums: 'stageF', arp: 'pulseB' }
      ]
    },
    boss: {
      bpm: 162, loop: true, leadDuty: 0.25, arpDuty: 0.125, leadLen: 2, bassLen: 2,
      leadVol: 0.16, arpVol: 0.038, bassVol: 0.19, drumVol: 0.85, leadDetune: 8,
      arp: 'tense', arpOctave: 0, echo: null,
      bars: [
        /* A: E phrygian dominant, tritone stabs, chromatic bass */
        { chord: 'E', lead: '0:E5:2 2:G#5:2 4:A5:2 6:B5:2 8:A5:2 10:G#5:2 12:E5:2 14:D5:2', bass: 'bossDrive', drums: 'bossA' },
        { chord: 'F', lead: '0:F5:2 2:A5:2 4:C6:2 6:A5:2 8:F5:2 10:E5:2 12:D5:2 14:C5:2', bass: 'bossDrive', drums: 'bossA' },
        { chord: 'E', lead: '0:E5:2 2:G#5:2 4:B5:2 6:E6:2 8:D6:2 10:B5:2 12:A5:2 14:G#5:2', bass: 'bossDrive', drums: 'bossA' },
        { chord: 'F#', lead: '0:F#5:2 2:A#5:2 4:C#6:2 6:A#5:2 8:F#5:2 10:E5:2 12:C#5:2 14:A#4:2', bass: 'bossDrive', drums: 'bossA' },
        { chord: 'E', lead: '0:E5:1 1:E5:1 2:G#5:2 4:B5:2 6:E6:2 8:D6:2 10:B5:2 12:G#5:2 14:E5:2', bass: 'bossDrive', drums: 'bossA' },
        { chord: 'F', lead: '0:F5:1 1:F5:1 2:A5:2 4:C6:2 6:F6:2 8:E6:2 10:C6:2 12:A5:2 14:F5:2', bass: 'bossDrive', drums: 'bossA' },
        { chord: 'B7', lead: '0:B5:2 2:D#6:2 4:F#6:2 6:D#6:2 8:B5:2 10:A5:2 12:F#5:2 14:D#5:2', bass: 'bossDrive', drums: 'bossA' },
        { chord: 'E', lead: '0:E5:4 4:B5:2 6:E6:2 8:D6:2 10:B5:2 12:G#5:2 14:E5:2', bass: 'bossDrive', drums: 'bossF' },
        /* B: chromatic climb, then the descent */
        { chord: 'E', lead: '0:E5:2 2:F5:2 4:G5:2 6:G#5:2 8:A5:2 10:Bb5:2 12:B5:2 14:C6:2', bass: 'chromeUp', drums: 'bossB', arp: 'drive16' },
        { chord: 'F', lead: '0:C6:2 2:B5:2 4:Bb5:2 6:A5:2 8:G#5:2 10:G5:2 12:F5:2 14:E5:2', bass: 'chromeDn', drums: 'bossB', arp: 'drive16' },
        { chord: 'G', lead: '0:G5:2 2:B5:2 4:D6:2 6:G6:2 8:F#6:2 10:D6:2 12:B5:2 14:G5:2', bass: 'bossDrive', drums: 'bossB', arp: 'drive16' },
        { chord: 'F#', lead: '0:F#5:2 2:A#5:2 4:C#6:2 6:F#6:2 8:E6:2 10:C#6:2 12:A#5:2 14:F#5:2', bass: 'bossDrive', drums: 'bossB', arp: 'drive16' },
        { chord: 'E', lead: '0:E6:2 2:D6:2 4:B5:2 6:G#5:2 8:E6:2 10:D6:2 12:B5:2 14:G#5:2', bass: 'chromeUp', drums: 'bossB', arp: 'drive16' },
        { chord: 'C', lead: '0:C6:2 2:E6:2 4:G6:2 6:E6:2 8:C6:2 10:B5:2 12:G5:2 14:E5:2', bass: 'bossDrive', drums: 'bossB', arp: 'drive16' },
        { chord: 'B7', lead: '0:B5:2 2:D#6:2 4:F#6:2 6:B6:2 8:A6:2 10:F#6:2 12:D#6:2 14:B5:2', bass: 'bossDrive', drums: 'bossB', arp: 'drive16' },
        { chord: 'E', lead: '0:E6:4 4:D6:2 6:B5:2 8:G#5:2 10:E5:2 12:B4:2 14:E5:2', bass: 'bossDrive', drums: 'bossF', arp: 'drive16' }
      ]
    },
    clear: {
      bpm: 140, loop: true, leadDuty: 0.25, arpDuty: 0.125, leadLen: 2, bassLen: 2,
      leadVol: 0.15, arpVol: 0.045, bassVol: 0.17, drumVol: 0.8, leadDetune: 5,
      arp: 'sparse', arpOctave: 12, echo: { time: 0.214, feedback: 0.22, mix: 0.16 },
      bars: [
        { chord: 'C', lead: '0:C5:2 2:E5:2 4:G5:2 6:C6:4 10:G5:2 12:E5:2 14:G5:2', bass: 'march', drums: 'clearA' },
        { chord: 'F', lead: '0:F5:2 2:A5:2 4:C6:2 6:F6:4 10:C6:2 12:A5:2 14:C6:2', bass: 'march', drums: 'clearF' },
        { chord: 'G', lead: '0:G5:2 2:B5:2 4:D6:2 6:G6:4 10:D6:2 12:B5:2 14:G5:2', bass: 'march2', drums: 'clearF' },
        { chord: 'C', lead: '0:C6:4 4:E6:2 6:G6:2 8:C7:8', bass: 'half', drums: 'clearA' }
      ]
    },
    gameover: {
      bpm: 104, loop: false, leadDuty: 0.5, arpDuty: 0.125, leadLen: 2, bassLen: 2,
      leadVol: 0.15, arpVol: 0.04, bassVol: 0.18, drumVol: 0.55, leadDetune: 0,
      arp: 'sparse', arpOctave: 0, echo: null,
      bars: [
        { chord: 'Am', lead: '0:E5:3 3:D5:3 6:C5:3 9:B4:3 12:A4:4', bass: 'half', drums: 'over' },
        { chord: 'F', lead: '0:G4:3 3:F4:3 6:E4:3 9:D4:3 12:C4:4', bass: 'half', drums: 'over' },
        { chord: 'Dm', lead: '0:D4:4 4:F4:2 6:A4:2 8:D5:4 12:C5:2 14:A4:2', bass: 'half2', drums: 'over' },
        { chord: 'E7', lead: '0:B4:4 4:G#4:4 8:E4:4 12:D4:4', bass: 'half2', drums: 'overF' },
        { chord: 'Am', lead: '0:A3:8 8:E4:8', bass: '0:0:16', drums: '', arp: null }
      ]
    }
  };

  /* ================== compiler: patterns -> step tables ============= */
  function compileLead(str) {
    var out = slots16(), tokens = String(str || '').replace(/^\s+|\s+$/g, '').split(/\s+/);
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
        vel = pos % 8 === 0 ? 1.1 : (pos % 4 === 0 ? 1.02 : (pos % 2 === 1 ? 0.88 : 0.96));
      }
      out[pos].push({ hz: hz, steps: Math.min(steps, 16), vel: clamp(vel, 0.3, 1.3) });
    }
    return out;
  }
  function compileBass(str, rootMidi) {
    var out = slots16(), tokens = String(str || '').replace(/^\s+|\s+$/g, '').split(/\s+/);
    for (var i = 0; i < tokens.length; i++) {
      if (!tokens[i]) { continue; }
      var p = tokens[i].split(':');
      if (p.length < 2) { continue; }
      var pos = parseInt(p[0], 10), off = parseInt(p[1], 10);
      if (!(pos >= 0 && pos < 16) || !isFinite(off)) { continue; }
      var steps = p.length > 2 ? parseFloat(p[2]) : 2;
      if (!(steps > 0)) { steps = 2; }
      out[pos].push({ hz: midiToFreq(rootMidi + off), steps: Math.min(steps, 16), vel: pos % 4 === 0 ? 1.06 : 0.92 });
    }
    return out;
  }
  function compileArp(name, chord, octave) {
    if (!name || !ARP_DEFS[name]) { return null; }
    var def = ARP_DEFS[name], base = 60 + chord.root + (octave || 0), out = grid16();
    for (var pos = 0; pos < 16; pos++) {
      if (pos % def.rate !== 0) { continue; }
      var idx = def.pat[(pos / def.rate) % def.pat.length];
      if (!isFinite(idx)) { idx = 0; }
      out[pos] = { hz: midiToFreq(chordTone(base, chord.intervals, idx)), steps: def.rate };
    }
    return out;
  }
  function compileDrums(name) {
    var out = slots16(), pat = DRUM_DEFS[name], lanes = ['k', 's', 'h', 'o'];
    if (!pat) { return out; }
    for (var l = 0; l < lanes.length; l++) {
      var line = pat[lanes[l]] || '';
      for (var i = 0; i < 16 && i < line.length; i++) {
        if (line.charAt(i) !== '.' && line.charAt(i) !== ' ') { out[i].push(lanes[l]); }
      }
    }
    return out;
  }
  function compileTrack(key, def) {
    var song = {
      key: key, bpm: clamp(def.bpm, 40, 220), loop: def.loop !== false,
      leadDuty: clamp(def.leadDuty, 0.05, 0.75), arpDuty: clamp(def.arpDuty, 0.05, 0.75),
      leadVol: clamp(def.leadVol, 0.01, 0.3), arpVol: clamp(def.arpVol, 0.005, 0.2),
      bassVol: clamp(def.bassVol, 0.01, 0.3), drumVol: clamp(def.drumVol === undefined ? 1 : def.drumVol, 0, 1.5),
      leadDetune: clamp(def.leadDetune || 0, 0, 30), arpOctave: def.arpOctave || 0,
      echo: def.echo || null, bars: [], barCount: 0, totalSteps: 0
    };
    song.stepDur = 60 / song.bpm / 4;
    for (var i = 0; i < def.bars.length; i++) {
      var b = def.bars[i] || {}, chord = parseChord(b.chord || 'C');
      song.bars.push({
        lead: compileLead(b.lead),
        bass: compileBass(b.bass, 36 + chord.root),
        drums: compileDrums(b.drums || def.drums),
        arp: compileArp(b.arp !== undefined ? b.arp : def.arp, chord, song.arpOctave)
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
        try { SONGS[key] = compileTrack(key, TRACK_DEFS[key]); } catch (e) { SONGS[key] = null; }
      }
    }
  })();

  /* ===================== engine state + graph ====================== */
  var TICK_MS = 25, LOOKAHEAD = 0.12;
  var KICK_PEAK = 0.42, SNARE_PEAK = 0.30, HAT_PEAK = 0.085, OPEN_HAT_PEAK = 0.07;
  var state = {
    ctx: null, supported: true, unlocked: false, muted: false,
    musicVol: 0.8, sfxVol: 0.85,
    musicBus: null, sfxBus: null, muteGain: null, musicVolGain: null, sfxVolGain: null,
    waves: {}, noise: null,
    current: null, currentKey: null, pending: null, lastSfx: {}
  };

  /* Soft-knee limiter curve: linear below threshold, tanh above it, so the
   * output can never exceed ~0.93 even on randomly aligned drum transients. */
  function makeSoftClipCurve(threshold) {
    var n = 4097, curve = new Float32Array(n), t = clamp(threshold, 0.4, 0.95);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1, a = Math.abs(x), y;
      if (a <= t) { y = a; } else { y = t + (1 - t) * Math.tanh((a - t) / (1 - t)); }
      curve[i] = x < 0 ? -y : y;
    }
    return curve;
  }

  function makeNoiseBuffer(ctx) {
    var len = Math.max(1, Math.floor(ctx.sampleRate * 2));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) { data[i] = Math.random() * 2 - 1; }
    return buf;
  }
  function makePulseWave(ctx, duty) {
    var harmonics = 32, real = new Float32Array(harmonics + 1), imag = new Float32Array(harmonics + 1);
    for (var n = 1; n <= harmonics; n++) { imag[n] = (2 / (n * Math.PI)) * Math.sin(Math.PI * n * duty); }
    return ctx.createPeriodicWave(real, imag);
  }
  function pulseWave(duty) {
    var ctx = state.ctx;
    if (!ctx || typeof ctx.createPeriodicWave !== 'function') { return null; }
    var key = duty <= 0.13 ? 'p12' : (duty <= 0.3 ? 'p25' : 'p50');
    if (state.waves[key] !== undefined) { return state.waves[key]; }
    try { state.waves[key] = makePulseWave(ctx, key === 'p12' ? 0.125 : (key === 'p25' ? 0.25 : 0.5)); }
    catch (e) { state.waves[key] = null; }
    return state.waves[key];
  }
  function makePanner(pan) {
    var ctx = state.ctx;
    if (!ctx || typeof ctx.createStereoPanner !== 'function') { return null; }
    try { var p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); return p; }
    catch (e) { return null; }
  }
  function makeEcho(dest, cfg) {
    var ctx = state.ctx;
    if (!ctx || typeof ctx.createDelay !== 'function' || !cfg) { return null; }
    try {
      var input = ctx.createGain(), dry = ctx.createGain(), delay = ctx.createDelay(1.5);
      var fb = ctx.createGain(), tone = ctx.createBiquadFilter(), wet = ctx.createGain();
      input.gain.value = 1; dry.gain.value = 1; wet.gain.value = clamp(cfg.mix, 0, 0.5);
      delay.delayTime.value = clamp(cfg.time, 0.05, 1.4);
      fb.gain.value = clamp(cfg.feedback, 0, 0.45);
      tone.type = 'lowpass'; tone.frequency.value = 2600; tone.Q.value = 0.5;
      connect(input, dry); connect(dry, dest);
      connect(input, delay); connect(delay, tone);
      connect(tone, fb); connect(fb, delay);
      connect(tone, wet); connect(wet, dest);
      return { input: input, nodes: [input, dry, delay, fb, tone, wet] };
    } catch (e) { return null; }
  }

  function buildGraph(ctx) {
    var mix = ctx.createGain(), master = ctx.createGain(), mute = ctx.createGain();
    var musicBus = ctx.createGain(), sfxBus = ctx.createGain();
    var musicVol = ctx.createGain(), sfxVol = ctx.createGain();
    mix.gain.value = 0.85; master.gain.value = 0.8;
    mute.gain.value = state.muted ? 0 : 1;
    musicBus.gain.value = 1; sfxBus.gain.value = 0.9;
    musicVol.gain.value = state.musicVol; sfxVol.gain.value = state.sfxVol;
    connect(musicBus, musicVol); connect(musicVol, mix);
    connect(sfxBus, sfxVol); connect(sfxVol, mix);

    var comp = null;
    if (typeof ctx.createDynamicsCompressor === 'function') {
      try {
        comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12; comp.knee.value = 6; comp.ratio.value = 8;
        comp.attack.value = 0.004; comp.release.value = 0.18;
      } catch (e) { comp = null; }
    }
    if (comp) { connect(mix, comp); connect(comp, master); } else { connect(mix, master); }

    /* final soft clipper: guarantees the master bus stays below 0 dBFS */
    var shaper = null;
    if (typeof ctx.createWaveShaper === 'function') {
      try {
        shaper = ctx.createWaveShaper();
        shaper.curve = makeSoftClipCurve(0.72);
        shaper.oversample = '2x';
      } catch (e) { shaper = null; }
    }
    if (shaper) { connect(master, shaper); connect(shaper, mute); }
    else { connect(master, mute); }
    connect(mute, ctx.destination);

    state.musicBus = musicBus; state.sfxBus = sfxBus;
    state.musicVolGain = musicVol; state.sfxVolGain = sfxVol;
    state.master = master; state.muteGain = mute;
  }

  function resetGraph() {
    var p = state.current;
    state.current = null; state.currentKey = null;
    if (p) { try { p.dispose(); } catch (e) { /* ignore */ } }
    state.ctx = null; state.waves = {}; state.noise = null;
    state.musicBus = null; state.sfxBus = null;
    state.musicVolGain = null; state.sfxVolGain = null;
    state.master = null; state.muteGain = null;
  }

  function ensureGraph() {
    if (!state.supported) { return false; }
    var ctx = state.ctx;
    if (ctx && ctx.state !== 'closed') { return true; }
    if (ctx && ctx.state === 'closed') { resetGraph(); }
    var Ctor = ROOT.AudioContext || ROOT.webkitAudioContext;
    if (!Ctor) { state.supported = false; return false; }
    try { ctx = new Ctor(); } catch (e) { state.supported = false; return false; }
    try {
      state.ctx = ctx;
      state.waves = {};
      state.noise = makeNoiseBuffer(ctx);
      buildGraph(ctx);
      return true;
    } catch (e) {
      try { if (ctx.close) { ctx.close(); } } catch (e2) { /* ignore */ }
      resetGraph();
      state.supported = false;
      return false;
    }
  }

  function resumeContext() {
    var ctx = state.ctx;
    if (!ctx || typeof ctx.resume !== 'function' || ctx.state !== 'suspended') { return; }
    try {
      var r = ctx.resume();
      if (r && typeof r.then === 'function') { r.then(function () { /* running */ }, function () { /* needs gesture */ }); }
    } catch (e) { /* ignore */ }
  }

  /* ===================== synthesis primitives ====================== */
  /** Enveloped oscillator note. opts: type, attack, release, pluck, detune, toHz, glide, vibrato */
  function tone(dest, t, hz, dur, wave, peak, opts) {
    var ctx = state.ctx;
    if (!ctx || !dest || !isFinite(hz) || hz <= 0 || !isFinite(peak) || peak <= 0) { return; }
    opts = opts || {};
    var d = clamp(dur, 0.02, 4), osc, g;
    try { osc = ctx.createOscillator(); g = ctx.createGain(); } catch (e) { return; }
    try {
      if (wave && typeof osc.setPeriodicWave === 'function') { osc.setPeriodicWave(wave); }
      else { osc.type = opts.type || 'square'; }
    } catch (e) { try { osc.type = 'square'; } catch (e2) { /* ignore */ } }
    try {
      osc.frequency.setValueAtTime(hz, t);
      if (opts.toHz && isFinite(opts.toHz) && opts.toHz > 0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.toHz), t + d * (opts.glide || 1));
      }
      if (opts.detune) { osc.detune.setValueAtTime(opts.detune, t); }
    } catch (e) { /* ignore */ }
    try {
      var atk = clamp(opts.attack === undefined ? 0.006 : opts.attack, 0.001, d * 0.35);
      var top = clamp(peak, 0.0002, 1.5), gain = g.gain;
      gain.setValueAtTime(0.0001, t);
      gain.linearRampToValueAtTime(top, t + atk);
      if (opts.pluck) {
        var dc = Math.min(t + d - 0.004, t + Math.max(atk + 0.01, Math.min(d * 0.5, atk + (opts.decay || 0.07))));
        gain.exponentialRampToValueAtTime(Math.max(0.0004, top * 0.34), dc);
        gain.exponentialRampToValueAtTime(0.0004, t + d);
      } else {
        var sus = clamp(opts.sustain === undefined ? 0.6 : opts.sustain, 0.1, 1);
        var hold = Math.min(t + d - 0.003, t + Math.max(atk + 0.01, d - (opts.release || 0.04)));
        gain.exponentialRampToValueAtTime(Math.max(0.0004, top * sus), hold);
        gain.exponentialRampToValueAtTime(0.0004, t + d);
      }
    } catch (e) { /* ignore */ }
    connect(osc, g); connect(g, dest);
    if (opts.vibrato) {
      /* per-note vibrato: its nodes stop with the note, so nothing accumulates */
      try {
        var lfo = ctx.createOscillator(), depth = ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(5.2, t);
        depth.gain.setValueAtTime(0, t);
        depth.gain.linearRampToValueAtTime(6, t + Math.min(0.14, d * 0.5)); /* cents */
        connect(lfo, depth); connect(depth, osc.detune);
        lfo.start(t); lfo.stop(t + d + 0.04);
      } catch (e) { /* vibrato is optional */ }
    }
    try { osc.start(t); osc.stop(t + d + 0.04); }
    catch (e) { try { osc.disconnect(); } catch (e2) { /* ignore */ } }
  }

  /** Filtered noise burst, optional filter sweep f0 -> f1. */
  function noiseBurst(dest, t, dur, type, f0, f1, q, peak) {
    var ctx = state.ctx;
    if (!ctx || !dest || !state.noise || !isFinite(peak) || peak <= 0) { return; }
    var d = clamp(dur, 0.02, 3), src, filt, g;
    try { src = ctx.createBufferSource(); filt = ctx.createBiquadFilter(); g = ctx.createGain(); } catch (e) { return; }
    try { src.buffer = state.noise; } catch (e) { /* ignore */ }
    try {
      filt.type = type || 'bandpass';
      filt.frequency.setValueAtTime(Math.max(40, f0), t);
      if (f1 && f1 > 0) { filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + d); }
      if (q) { filt.Q.value = q; }
    } catch (e) { /* ignore */ }
    try {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(clamp(peak, 0.0002, 1.5), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0004, t + d);
    } catch (e) { /* ignore */ }
    connect(src, filt); connect(filt, g); connect(g, dest);
    try { src.start(t); src.stop(t + d + 0.05); } catch (e) { /* ignore */ }
  }

  function drumKick(dest, t, vol) {
    var ctx = state.ctx;
    if (!ctx || !dest) { return; }
    var v = clamp(vol, 0.0002, 1), osc, g;
    try { osc = ctx.createOscillator(); g = ctx.createGain(); } catch (e) { return; }
    try {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(168, t);
      osc.frequency.exponentialRampToValueAtTime(46, t + 0.12);
    } catch (e) { /* ignore */ }
    try {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.24);
    } catch (e) { /* ignore */ }
    connect(osc, g); connect(g, dest);
    try { osc.start(t); osc.stop(t + 0.26); } catch (e) { /* ignore */ }
    noiseBurst(dest, t, 0.02, 'highpass', 1600, 2800, 0.6, Math.min(0.08, v * 0.18));
  }

  function drumSnare(dest, t, vol) {
    var ctx = state.ctx;
    if (!ctx || !dest) { return; }
    var v = clamp(vol, 0.0002, 1), osc, g;
    noiseBurst(dest, t, 0.14, 'bandpass', 1900, 900, 1.2, v);
    try { osc = ctx.createOscillator(); g = ctx.createGain(); } catch (e) { return; }
    try {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(195, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.09);
    } catch (e) { /* ignore */ }
    try {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v * 0.45, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.11);
    } catch (e) { /* ignore */ }
    connect(osc, g); connect(g, dest);
    try { osc.start(t); osc.stop(t + 0.13); } catch (e) { /* ignore */ }
  }

  function drumHat(dest, t, vol, open) {
    var d = open ? 0.13 : 0.035, f = open ? 7000 : 8200;
    noiseBurst(dest, t, d, 'highpass', f, f + 2200, 0.7, clamp(vol, 0.0002, 1));
  }

  /* ======================== sound effects ========================== */
  var SFX = {
    shoot: function (t, b) {
      tone(b, t, 1500, 0.075, pulseWave(0.125), 0.17, { type: 'square', toHz: 480, pluck: true, attack: 0.001, release: 0.01 });
      noiseBurst(b, t, 0.03, 'highpass', 3800, 9000, 0.7, 0.05);
    },
    enemyShoot: function (t, b) {
      tone(b, t, 640, 0.11, pulseWave(0.5), 0.13, { type: 'square', toHz: 220, pluck: true, attack: 0.002 });
      tone(b, t, 320, 0.09, null, 0.07, { type: 'triangle', toHz: 110, attack: 0.002 });
    },
    hit: function (t, b) {
      tone(b, t, 900, 0.06, pulseWave(0.25), 0.16, { type: 'square', toHz: 260, pluck: true, attack: 0.001 });
      noiseBurst(b, t, 0.05, 'bandpass', 2600, 1100, 1.1, 0.1);
    },
    explosion: function (t, b) {
      noiseBurst(b, t, 0.45, 'lowpass', 2400, 140, 0.9, 0.34);
      tone(b, t, 120, 0.35, null, 0.22, { type: 'sine', toHz: 38, attack: 0.002, release: 0.16 });
      noiseBurst(b, t + 0.03, 0.18, 'bandpass', 900, 260, 1.1, 0.12);
      noiseBurst(b, t + 0.12, 0.2, 'highpass', 3000, 6000, 0.8, 0.06);
    },
    bigExplosion: function (t, b) {
      noiseBurst(b, t, 0.95, 'lowpass', 3200, 90, 0.8, 0.36);
      tone(b, t, 95, 0.8, null, 0.26, { type: 'sine', toHz: 26, attack: 0.002, release: 0.2 });
      noiseBurst(b, t + 0.16, 0.6, 'lowpass', 1200, 100, 0.9, 0.22);
      noiseBurst(b, t + 0.35, 0.4, 'bandpass', 500, 120, 1.0, 0.14);
      noiseBurst(b, t + 0.02, 0.25, 'highpass', 2500, 5000, 0.8, 0.07);
    },
    powerup: function (t, b) {
      var notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      for (var i = 0; i < notes.length; i++) { tone(b, t + i * 0.055, notes[i], 0.16, pulseWave(0.25), 0.15, { type: 'square', pluck: true, attack: 0.002 }); }
      tone(b, t + 0.28, 1567.98, 0.25, pulseWave(0.125), 0.09, { attack: 0.006, release: 0.08 });
      noiseBurst(b, t + 0.22, 0.2, 'highpass', 5000, 9000, 0.8, 0.045);
    },
    death: function (t, b) {
      var notes = [880, 739.99, 622.25, 523.25, 440, 349.23, 261.63, 196];
      for (var i = 0; i < notes.length; i++) { tone(b, t + i * 0.075, notes[i], 0.14, pulseWave(0.25), 0.17, { type: 'square', pluck: true, attack: 0.002 }); }
      tone(b, t + 0.6, 130, 0.34, null, 0.12, { type: 'triangle', toHz: 42, attack: 0.003 });
      noiseBurst(b, t, 0.6, 'lowpass', 1600, 100, 0.8, 0.16);
    },
    select: function (t, b) {
      tone(b, t, 1046.5, 0.06, pulseWave(0.25), 0.14, { type: 'square', pluck: true, attack: 0.001 });
      tone(b, t + 0.055, 1567.98, 0.07, pulseWave(0.25), 0.13, { type: 'square', pluck: true, attack: 0.001 });
    },
    warning: function (t, b) {
      for (var i = 0; i < 4; i++) {
        tone(b, t + i * 0.16, 880, 0.12, pulseWave(0.5), 0.11, { type: 'square', attack: 0.002, release: 0.03 });
        tone(b, t + i * 0.16 + 0.08, 698.46, 0.07, pulseWave(0.5), 0.08, { type: 'square', attack: 0.002 });
      }
      noiseBurst(b, t, 0.65, 'highpass', 4000, 6000, 0.8, 0.025);
    },
    bossHit: function (t, b) {
      noiseBurst(b, t, 0.22, 'bandpass', 1400, 380, 1.2, 0.22);
      tone(b, t, 170, 0.2, null, 0.14, { type: 'square', toHz: 70, attack: 0.002 });
      noiseBurst(b, t, 0.1, 'highpass', 6000, 9000, 0.8, 0.06);
    },
    jump: function (t, b) {
      tone(b, t, 280, 0.12, pulseWave(0.25), 0.14, { type: 'square', toHz: 920, pluck: true, attack: 0.002 });
      noiseBurst(b, t, 0.035, 'highpass', 5000, 8000, 0.8, 0.03);
    },
    bomb: function (t, b) {
      tone(b, t, 250, 0.18, pulseWave(0.25), 0.1, { type: 'square', toHz: 700, attack: 0.003 });
      noiseBurst(b, t, 0.5, 'lowpass', 6000, 250, 0.8, 0.2);
      noiseBurst(b, t + 0.42, 0.7, 'lowpass', 1800, 80, 0.9, 0.3);
      tone(b, t + 0.42, 90, 0.6, null, 0.22, { type: 'sine', toHz: 30, attack: 0.002, release: 0.15 });
    }
  };

  /* =================== music player + sequencer =================== */
  function Player(key, song, opts) {
    opts = opts || {};
    this.key = key;
    this.song = song;
    this.fadeSec = clamp((opts.fade === undefined ? 350 : opts.fade) / 1000, 0.02, 3);
    this.gain = null; this.echo = null; this.panner = null;
    this.timer = 0; this.disposeTimer = 0;
    this.stepPos = 0; this.nextTime = 0;
    this.stopping = false; this.finished = false; this.disposed = false;
  }
  Player.prototype.isActive = function () { return !this.disposed && !this.stopping && !this.finished; };
  Player.prototype.start = function () {
    var ctx = state.ctx;
    if (!ctx || this.disposed) { return false; }
    try {
      this.gain = ctx.createGain();
      var now = ctx.currentTime;
      this.gain.gain.setValueAtTime(0.0001, now);
      this.gain.gain.linearRampToValueAtTime(1, now + this.fadeSec);
      connect(this.gain, state.musicBus);
      if (this.song.echo) { this.echo = makeEcho(this.gain, this.song.echo); }
      this.panner = makePanner(-0.18);
      if (this.panner) { connect(this.panner, this.gain); }
      this.nextTime = now + 0.08;
      this.stepPos = 0;
      var self = this;
      this.timer = every(function () { self.tick(); }, TICK_MS);
      this.tick();
      return true;
    } catch (e) { this.dispose(); return false; }
  };
  Player.prototype.tick = function () {
    var ctx = state.ctx;
    if (!ctx || this.disposed || this.stopping || this.finished) { return; }
    try {
      var now = ctx.currentTime, song = this.song, guard = 0;
      /* tab throttling / suspend: re-align instead of dumping late notes */
      if (this.nextTime < now - 0.4) { this.nextTime = now + 0.06; }
      while (this.nextTime < now + LOOKAHEAD && guard < 96) {
        if (!song.loop && this.stepPos >= song.totalSteps) { this.finish(); break; }
        this.schedule(song.loop ? (this.stepPos % song.totalSteps) : this.stepPos, this.nextTime);
        this.stepPos++;
        if (song.loop) { this.stepPos %= song.totalSteps; }
        this.nextTime += song.stepDur;
        guard++;
      }
      if (!song.loop && this.stepPos >= song.totalSteps) { this.finish(); }
    } catch (e) { /* a timer must never throw into the host page */ }
  };
  Player.prototype.schedule = function (stepIndex, t) {
    var song = this.song, bar = song.bars[Math.floor(stepIndex / 16) % song.barCount];
    if (!bar || !this.gain) { return; }
    var pos = stepIndex % 16, sd = song.stepDur, dry = this.gain;
    var leadDest = this.echo ? this.echo.input : dry, arpDest = this.panner || dry;
    var i, ev, list, leadWave = pulseWave(song.leadDuty);

    list = bar.lead[pos];
    for (i = 0; i < list.length; i++) {
      ev = list[i];
      tone(leadDest, t, ev.hz, ev.steps * sd, leadWave, song.leadVol * ev.vel,
        { attack: 0.006, pluck: true, release: 0.04, vibrato: true });
      if (song.leadDetune) {
        tone(leadDest, t, ev.hz, ev.steps * sd, leadWave, song.leadVol * ev.vel * 0.28,
          { attack: 0.01, release: 0.05, detune: song.leadDetune });
      }
    }
    list = bar.bass[pos];
    for (i = 0; i < list.length; i++) {
      ev = list[i];
      tone(dry, t, ev.hz, ev.steps * sd, null, song.bassVol * ev.vel,
        { type: 'triangle', attack: 0.004, release: 0.04, pluck: true });
    }
    if (bar.arp) {
      var slot = bar.arp[pos];
      if (slot) {
        tone(arpDest, t, slot.hz, slot.steps * sd * 0.9, pulseWave(song.arpDuty), song.arpVol,
          { attack: 0.003, release: 0.02, pluck: true });
      }
    }
    var dv = song.drumVol;
    list = bar.drums[pos];
    for (i = 0; i < list.length; i++) {
      if (list[i] === 'k') { drumKick(dry, t, KICK_PEAK * dv); }
      else if (list[i] === 's') { drumSnare(dry, t, SNARE_PEAK * dv); }
      else if (list[i] === 'h') { drumHat(dry, t, HAT_PEAK * dv, false); }
      else if (list[i] === 'o') { drumHat(dry, t, OPEN_HAT_PEAK * dv, true); }
    }
  };
  Player.prototype.finish = function () {
    if (this.finished || this.disposed) { return; }
    this.finished = true;
    if (this.timer) { stopTimer(this.timer); this.timer = 0; }
    var self = this;
    this.disposeTimer = later(function () { self.stop(0.8); }, 2300);
  };
  Player.prototype.stop = function (fadeSec) {
    if (this.disposed || this.stopping) { return; }
    this.stopping = true;
    if (this.timer) { stopTimer(this.timer); this.timer = 0; }
    if (this.disposeTimer) { stopTimer(this.disposeTimer); this.disposeTimer = 0; }
    var ctx = state.ctx, f = clamp(fadeSec === undefined ? 0.3 : fadeSec, 0.03, 3);
    if (ctx && this.gain) {
      try {
        var now = ctx.currentTime, p = this.gain.gain, cur = Number(p.value);
        if (!isFinite(cur) || cur <= 0) { cur = 0.0001; }
        p.cancelScheduledValues(now);
        p.setValueAtTime(Math.max(cur, 0.0001), now);
        p.linearRampToValueAtTime(0.0001, now + f);
      } catch (e) { /* ignore */ }
    }
    var self = this;
    this.disposeTimer = later(function () { self.dispose(); }, Math.round((f + 0.15) * 1000));
  };
  Player.prototype.dispose = function () {
    if (this.disposed) { return; }
    this.disposed = true; this.stopping = true;
    if (this.timer) { stopTimer(this.timer); this.timer = 0; }
    if (this.disposeTimer) { stopTimer(this.disposeTimer); this.disposeTimer = 0; }
    if (this.echo) {
      for (var i = 0; i < this.echo.nodes.length; i++) { disconnect(this.echo.nodes[i]); }
      this.echo = null;
    }
    disconnect(this.panner); this.panner = null;
    disconnect(this.gain); this.gain = null;
    if (state.current === this) { state.current = null; state.currentKey = null; }
  };

  /* =========================== public API ========================== */
  function rampGain(node, value, sec) {
    if (!node || !state.ctx) { return; }
    try {
      var now = state.ctx.currentTime, p = node.gain, cur = Number(p.value);
      if (!isFinite(cur)) { cur = 0; }
      p.cancelScheduledValues(now);
      p.setValueAtTime(cur, now);
      p.linearRampToValueAtTime(value, now + sec);
    } catch (e) { /* ignore */ }
  }
  function startTrack(name, opts) {
    var song = SONGS[name];
    if (!song) { return false; }
    var fade = opts && isFinite(Number(opts.fade)) ? clamp(opts.fade, 0, 3000) : 350;
    var p = new Player(name, song, { fade: fade });
    if (!p.start()) { return false; }
    var old = state.current;
    state.current = p; state.currentKey = name;
    if (old && old !== p) { old.stop(Math.max(0.08, fade / 1000)); }
    return true;
  }
  function unlock() {
    try {
      if (!ensureGraph()) { return false; }
      state.unlocked = true;
      resumeContext();
      if (state.pending) { var p = state.pending; state.pending = null; startTrack(p.name, p.opts); }
      return true;
    } catch (e) { return false; }
  }
  function playMusic(name, opts) {
    try {
      opts = opts || {};
      if (!SONGS[name]) { return false; }
      if (!state.ctx && !ensureGraph()) { return false; }
      resumeContext();
      if (state.current && state.currentKey === name && state.current.isActive() && !opts.restart) { return true; }
      return startTrack(name, opts);
    } catch (e) { return false; }
  }
  function stopMusic(fadeMs) {
    try {
      state.pending = null;
      var p = state.current;
      state.current = null; state.currentKey = null;
      if (p) { p.stop(clamp(fadeMs === undefined ? 300 : fadeMs, 0, 3000) / 1000); }
      return true;
    } catch (e) { return false; }
  }
  function setMusicVolume(v) { state.musicVol = clamp(v, 0, 1); rampGain(state.musicVolGain, state.musicVol, 0.06); return state.musicVol; }
  function setSfxVolume(v) { state.sfxVol = clamp(v, 0, 1); rampGain(state.sfxVolGain, state.sfxVol, 0.06); return state.sfxVol; }
  function setMuted(flag) {
    try {
      state.muted = !!flag;
      rampGain(state.muteGain, state.muted ? 0 : 1, 0.08);
      if (!state.muted) { resumeContext(); }
      return state.muted;
    } catch (e) { return state.muted; }
  }
  function sfx(name) {
    var fn = SFX[name];
    if (!fn) { return false; }
    try {
      var ctx = state.ctx;
      if (!ctx || state.muted || ctx.state === 'closed') { return false; }
      var now = ctx.currentTime, last = state.lastSfx[name];
      if (last !== undefined && now - last < 0.03) { return false; }
      state.lastSfx[name] = now;
      if (ctx.state === 'suspended') { resumeContext(); }
      fn(now + 0.005, state.sfxBus);
      return true;
    } catch (e) { return false; }
  }
  function isReady() { try { return !!(state.ctx && state.ctx.state !== 'closed'); } catch (e) { return false; } }

  /* ============ selftest: pure theory/data checks, no audio ========= */
  function selftest() {
    var out = [];
    function add(name, fn) {
      try {
        var r = fn();
        if (r && typeof r === 'object') { out.push({ name: name, ok: !!r.ok, msg: r.msg || (r.ok ? 'ok' : 'failed') }); }
        else { out.push({ name: name, ok: r === true, msg: r === true ? 'ok' : 'failed' }); }
      } catch (e) { out.push({ name: name, ok: false, msg: 'threw: ' + (e && e.message ? e.message : 'error') }); }
    }
    function near(a, b, tol) { return isFinite(a) && isFinite(b) && Math.abs(a - b) <= (tol === undefined ? 0.5 : tol); }

    var TRACK_NAMES = ['title', 'stage', 'boss', 'clear', 'gameover'];
    var SFX_NAMES = ['shoot', 'enemyShoot', 'hit', 'explosion', 'bigExplosion', 'powerup', 'death', 'select', 'warning', 'bossHit', 'jump', 'bomb'];

    add('note table: A4 = 440 Hz', function () {
      var f = noteFreq('A4');
      return near(f, 440, 0.01) ? { ok: true, msg: 'A4 = ' + f.toFixed(2) + ' Hz' } : { ok: false, msg: 'A4 = ' + f };
    });
    add('note table: sharps / flats / octaves', function () {
      var ok = near(noteFreq('C#4'), 277.18, 0.02) && near(noteFreq('Db4'), 277.18, 0.02) &&
        near(noteFreq('Bb4'), 466.16, 0.02) && near(noteFreq('A5'), 880, 0.01) && near(noteFreq('C4'), 261.63, 0.02);
      return { ok: ok, msg: ok ? 'C#4=Db4, Bb4=466.16, A5=880, C4=261.63' : 'bad accidental/octave frequency' };
    });
    add('note table: invalid input rejected', function () {
      var ok = noteFreq('H4') === null && noteFreq('C') === null && noteFreq('') === null &&
        noteFreq(null) === null && noteFreq('A#') === null;
      return { ok: ok, msg: ok ? 'invalid notes return null' : 'invalid note accepted' };
    });
    add('chords parsed', function () {
      var dm = parseChord('Dm'), a7 = parseChord('A7'), g = parseChord('G'), dim = parseChord('Cdim'), sus = parseChord('Csus');
      var ok = dm.root === 2 && dm.intervals.join(',') === '0,3,7' && a7.root === 9 &&
        a7.intervals.join(',') === '0,4,7,10' && g.intervals.join(',') === '0,4,7' &&
        dim.intervals.join(',') === '0,3,6' && sus.intervals.join(',') === '0,5,7';
      return { ok: ok, msg: ok ? 'Dm, A7, G, Cdim, Csus' : 'chord interval mismatch' };
    });
    add('chord tones extend octaves', function () {
      var ok = chordTone(60, [0, 4, 7], 3) === 72 && chordTone(60, [0, 4, 7], 8) === 91 && chordTone(60, [0, 3, 7], 5) === 79;
      return { ok: ok, msg: ok ? 'index extension +12 per octave' : 'chord-tone extension wrong' };
    });
    add('all 5 tracks compiled', function () {
      var missing = [];
      for (var i = 0; i < TRACK_NAMES.length; i++) { if (!SONGS[TRACK_NAMES[i]]) { missing.push(TRACK_NAMES[i]); } }
      return { ok: missing.length === 0, msg: missing.length ? 'missing: ' + missing.join(',') : TRACK_NAMES.length + ' tracks compiled' };
    });
    add('bar grid is 16 steps everywhere', function () {
      var bars = 0;
      for (var t = 0; t < TRACK_NAMES.length; t++) {
        var song = SONGS[TRACK_NAMES[t]];
        if (!song) { return { ok: false, msg: 'missing song ' + TRACK_NAMES[t] }; }
        for (var b = 0; b < song.bars.length; b++) {
          var bar = song.bars[b];
          bars++;
          if (bar.lead.length !== 16 || bar.bass.length !== 16 || bar.drums.length !== 16) {
            return { ok: false, msg: TRACK_NAMES[t] + ' bar ' + (b + 1) + ' not 16 steps' };
          }
          if (bar.arp && bar.arp.length !== 16) { return { ok: false, msg: TRACK_NAMES[t] + ' bar ' + (b + 1) + ' arp not 16 steps' }; }
        }
      }
      return { ok: true, msg: bars + ' bars verified' };
    });
    add('no NaN / out-of-range frequencies or lengths', function () {
      var events = 0;
      for (var t = 0; t < TRACK_NAMES.length; t++) {
        var song = SONGS[TRACK_NAMES[t]];
        if (!song) { return { ok: false, msg: 'missing song ' + TRACK_NAMES[t] }; }
        for (var b = 0; b < song.bars.length; b++) {
          var bar = song.bars[b], i, list;
          list = bar.lead;
          for (i = 0; i < list.length; i++) {
            for (var j = 0; j < list[i].length; j++) {
              var e = list[i][j];
              events++;
              if (!isFinite(e.hz) || e.hz < 20 || e.hz > 6000 || !isFinite(e.steps) || e.steps <= 0 || e.steps > 16 || !isFinite(e.vel) || e.vel <= 0) {
                return { ok: false, msg: 'bad lead event in ' + TRACK_NAMES[t] + ' bar ' + (b + 1) };
              }
            }
          }
          list = bar.bass;
          for (i = 0; i < list.length; i++) {
            for (var k = 0; k < list[i].length; k++) {
              var be = list[i][k];
              events++;
              if (!isFinite(be.hz) || be.hz < 20 || be.hz > 3000 || !isFinite(be.steps) || be.steps <= 0 || be.steps > 16) {
                return { ok: false, msg: 'bad bass event in ' + TRACK_NAMES[t] + ' bar ' + (b + 1) };
              }
            }
          }
          if (bar.arp) {
            for (i = 0; i < bar.arp.length; i++) {
              var ap = bar.arp[i];
              if (!ap) { continue; }
              events++;
              if (!isFinite(ap.hz) || ap.hz < 20 || ap.hz > 6000 || !isFinite(ap.steps) || ap.steps <= 0) {
                return { ok: false, msg: 'bad arp event in ' + TRACK_NAMES[t] + ' bar ' + (b + 1) };
              }
            }
          }
        }
      }
      return { ok: events > 400, msg: events + ' events checked, all finite' };
    });
    add('drum lanes valid', function () {
      var lanes = { k: 1, s: 1, h: 1, o: 1 }, hits = 0;
      for (var t = 0; t < TRACK_NAMES.length; t++) {
        var song = SONGS[TRACK_NAMES[t]];
        for (var b = 0; b < song.bars.length; b++) {
          for (var i = 0; i < 16; i++) {
            for (var j = 0; j < song.bars[b].drums[i].length; j++) {
              if (!lanes[song.bars[b].drums[i][j]]) { return { ok: false, msg: 'unknown drum lane' }; }
              hits++;
            }
          }
        }
      }
      return { ok: hits > 100, msg: hits + ' drum hits across lanes k/s/h/o' };
    });
    add('loop flags / tempos / gains', function () {
      var names = ['title', 'stage', 'boss', 'clear', 'gameover'], i, s;
      for (i = 0; i < names.length; i++) {
        s = SONGS[names[i]];
        if (s.loop !== (names[i] !== 'gameover')) { return { ok: false, msg: names[i] + ' loop flag wrong' }; }
        if (!(s.leadVol > 0.05 && s.leadVol <= 0.22) || !(s.bassVol > 0.05 && s.bassVol <= 0.25) || !(s.arpVol > 0.005 && s.arpVol <= 0.1)) {
          return { ok: false, msg: names[i] + ' voice gain out of range' };
        }
        if (!isFinite(s.stepDur) || s.stepDur < 0.06 || s.stepDur > 0.2) { return { ok: false, msg: names[i] + ' stepDur bad' }; }
      }
      if (!(SONGS.stage.bpm >= 140 && SONGS.stage.bpm <= 165 && SONGS.boss.bpm > SONGS.stage.bpm && SONGS.boss.bpm <= 165)) {
        return { ok: false, msg: 'stage/boss tempo out of range' };
      }
      return { ok: true, msg: 'title 132, stage 150, boss 162, gameover 104 BPM' };
    });
    add('all 12 sfx present', function () {
      var missing = [];
      for (var i = 0; i < SFX_NAMES.length; i++) { if (typeof SFX[SFX_NAMES[i]] !== 'function') { missing.push(SFX_NAMES[i]); } }
      return { ok: missing.length === 0, msg: missing.length ? 'missing: ' + missing.join(',') : SFX_NAMES.length + ' one-shots' };
    });
    add('public API shape', function () {
      var api = ['unlock', 'playMusic', 'stopMusic', 'setMusicVolume', 'setSfxVolume', 'setMuted', 'sfx', 'selftest', 'isReady'], missing = [];
      for (var i = 0; i < api.length; i++) { if (typeof API[api[i]] !== 'function') { missing.push(api[i]); } }
      return { ok: missing.length === 0, msg: missing.length ? 'missing: ' + missing.join(',') : api.length + ' API methods' };
    });
    add('unknown music/sfx names rejected safely', function () {
      var ok = SONGS['nope'] === undefined && SFX['nope'] === undefined && playMusic('__nope__') === false && sfx('__nope__') === false;
      return { ok: ok, msg: ok ? 'unknown names are no-ops' : 'unknown name accepted' };
    });
    add('volume clamps', function () {
      var a = setMusicVolume(-5), b = setMusicVolume(42), c = setSfxVolume(-1), d = setSfxVolume(42);
      setMusicVolume(0.8); setSfxVolume(0.85);
      return { ok: a === 0 && b === 1 && c === 0 && d === 1, msg: 'volumes clamp to 0..1' };
    });
    add('loops are bar-aligned with downbeat hooks', function () {
      var problems = [];
      for (var i = 0; i < TRACK_NAMES.length; i++) {
        var song = SONGS[TRACK_NAMES[i]];
        if (!song.loop) { continue; }
        if (song.totalSteps % 16 !== 0) { problems.push(TRACK_NAMES[i] + ':grid'); }
        if (song.bars[0].lead[0].length === 0) { problems.push(TRACK_NAMES[i] + ':downbeat'); }
      }
      return { ok: problems.length === 0, msg: problems.length ? problems.join(', ') : 'bar-aligned loops' };
    });
    return out;
  }

  var API = {
    unlock: unlock, playMusic: playMusic, stopMusic: stopMusic,
    setMusicVolume: setMusicVolume, setSfxVolume: setSfxVolume, setMuted: setMuted,
    sfx: sfx, selftest: selftest, isReady: isReady
  };
  ROOT.SWAudio = API;
})();
