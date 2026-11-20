/* ПОЛУУСТАВ · музыка — процедурный эмбиент студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Темы не записаны нотами, а выращиваются при загрузке из зерна страницы (детерминированно): лад, тоника,
   гармония на 8 тактов, тихое арпеджио «гуслей» в басу (каждые 2 шестнадцатые) и редкая мелодия-«дыхание»
   с длинными нотами и паузами. Ударных почти нет — лишь редкий «шорох» хэта. Каждая тема — 8 тактов по 16 шагов.
   A.tracks.poluustav — тема 1-й страницы (движок берёт по gameId); A.poluTracks[0..6] — по страницам, [7] — финал. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  var NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function nm(m) { return NAMES[m % 12] + (Math.floor(m / 12) - 1); }
  function rng(seed) { var a = seed >>> 0 || 1; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var MODES = { aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], ionian: [0, 2, 4, 5, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10], phryg: [0, 1, 3, 5, 7, 8, 10] };
  // страница: [зерно, тоника (MIDI), лад, темп, плотность мелодии, ход гармонии (ступени)]
  var PAGES = [
    [11, 50, 'dorian', 72, 0.22, [0, 3, 4, 0, 5, 3, 4, 0]],   // заставка — ре дорийский, светлая тревога
    [23, 52, 'aeolian', 76, 0.26, [0, 5, 3, 4, 0, 5, 6, 4]],  // мельница — ми минор, мерно
    [37, 55, 'mixo', 70, 0.2, [0, 6, 3, 0, 4, 3, 6, 0]],      // река — соль миксолидийский, течёт
    [41, 48, 'aeolian', 66, 0.18, [0, 3, 0, 4, 5, 3, 4, 4]],  // звонница — до минор, гулко
    [53, 49, 'phryg', 74, 0.24, [0, 1, 0, 6, 5, 1, 4, 0]],    // разлив — до-диез фригийский, вязко
    [67, 53, 'ionian', 78, 0.28, [0, 4, 5, 3, 0, 4, 1, 4]],   // перо — фа мажор, лёгкий росчерк
    [71, 47, 'dorian', 64, 0.16, [0, 5, 3, 4, 0, 6, 3, 4]],   // лампада — си дорийский, ночь
    [89, 50, 'ionian', 70, 0.3, [0, 3, 4, 0, 5, 3, 4, 0]]     // колофон — ре мажор, финал
  ];
  function make(p) {
    var R = rng(p[0] * 7919), root = p[1], sc = MODES[p[2]], bars = 8, steps = 16;
    function deg(d, oct) { var o = Math.floor(d / 7); return root + 12 * (oct + o) + sc[((d % 7) + 7) % 7]; }
    var bass = [], mel = [], drums = [];
    for (var b = 0; b < bars; b++) {
      var ch = p[5][b], arp = [deg(ch, -1), deg(ch + 4, -1), deg(ch + 7, -1), deg(ch + 2, 0), deg(ch + 4, 0), deg(ch + 2, 0), deg(ch + 7, -1), deg(ch + 4, -1)];
      if (R() < 0.4) arp.reverse();
      var line = [];
      for (var s = 0; s < steps; s++) line.push(s % 2 === 0 ? nm(arp[s / 2]) : '-');
      bass.push(line.join(' '));
      // мелодия: ноты аккорда и соседние ступени, длинные (4–8 шагов), с паузами
      var ml = [], s2 = 0, last = ch + 7;
      while (s2 < steps) {
        if (R() < p[4] * 2.2) {
          var dd = last + [-2, -1, 0, 1, 2, 3, -3][(R() * 7) | 0]; dd = Math.max(ch + 2, Math.min(ch + 11, dd)); last = dd;
          var len = [2, 4, 4, 6, 8][(R() * 5) | 0]; len = Math.min(len, steps - s2);
          ml.push(nm(deg(dd, 1))); for (var k = 1; k < len; k++) ml.push('-'); s2 += len;
        } else { var rest = Math.min(2 + ((R() * 3) | 0), steps - s2); for (var q = 0; q < rest; q++) ml.push('.'); s2 += rest; }
      }
      mel.push(ml.join(' '));
      var dl = []; for (var s3 = 0; s3 < steps; s3++) dl.push(s3 === 12 && R() < 0.35 ? 'h' : '.'); drums.push(dl.join(' '));
    }
    return { bpm: p[3], div: 4, lead: { retro: 'triangle', modern: 'sine' }, vol: 0.75, melody: mel.join(' | '), bass: bass.join(' | '), drums: drums.join(' | ') };
  }
  var T = PAGES.map(make);
  A.tracks.poluustav = T[0];
  A.poluTracks = T;
})(window.Arcade = window.Arcade || {});
