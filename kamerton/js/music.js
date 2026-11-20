/* КАМЕРТОН · музыка — процедурный эмбиент студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   «Шкатулка в сумерках»: темы не записаны нотами, а выращиваются при загрузке из зерна зоны (детерминированно).
   Счёт на три (div 3 — триоли, 12 шагов в такте): в басу — медленный «маятник» тоника—квинта, сверху — звон шкатулки
   (короткие ноты аккорда через шаг, иногда с запинкой — завод кончается), изредка тянется низкий «гудок» мелодии.
   Ударных почти нет — лишь тихий «тик» часов на долю. Каждая тема — 8 тактов.
   A.tracks.kamerton — тема 1-й зоны (движок берёт по gameId); A.kamerTracks[0..5] — по зонам, [6] — финал. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  var NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function nm(m) { return NAMES[m % 12] + (Math.floor(m / 12) - 1); }
  function rng(seed) { var a = seed >>> 0 || 1; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var MODES = { aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], harm: [0, 2, 3, 5, 7, 8, 11], lydian: [0, 2, 4, 6, 7, 9, 11], ionian: [0, 2, 4, 5, 7, 9, 11] };
  // зона: [зерно, тоника (MIDI), лад, темп, частота звона, ход гармонии]
  var ZONES = [
    [5, 57, 'aeolian', 84, 0.55, [0, 5, 3, 4, 0, 5, 6, 4]],   // мастерская — ля минор, тихо тикает
    [13, 55, 'dorian', 88, 0.6, [0, 3, 6, 4, 0, 3, 4, 0]],    // часовая улица — соль дорийский
    [29, 60, 'lydian', 96, 0.75, [0, 4, 1, 4, 0, 5, 1, 4]],   // ярмарка — до лидийский, кружится
    [31, 52, 'harm', 76, 0.45, [0, 3, 4, 0, 5, 3, 4, 4]],     // колокольный двор — ми гармонический
    [43, 54, 'aeolian', 92, 0.65, [0, 6, 5, 4, 0, 6, 3, 4]],  // депо — фа-диез минор, торопит
    [59, 50, 'dorian', 80, 0.5, [0, 5, 3, 4, 0, 6, 3, 4]],    // башня — ре дорийский, высоко
    [71, 57, 'ionian', 78, 0.7, [0, 3, 4, 0, 5, 3, 4, 0]]     // финал — ля мажор, город просыпается
  ];
  function make(p) {
    var R = rng(p[0] * 104729), root = p[1], sc = MODES[p[2]], bars = 8, steps = 12;
    function deg(d, oct) { var o = Math.floor(d / 7); return root + 12 * (oct + o) + sc[((d % 7) + 7) % 7]; }
    var bass = [], mel = [], drums = [];
    for (var b = 0; b < bars; b++) {
      var ch = p[5][b], bl = [];
      // бас: маятник — тоника, квинта, октава, квинта
      bl.push(nm(deg(ch, -1)), '-', '-', nm(deg(ch + 4, -1)), '-', '-', nm(deg(ch + 7, -1)), '-', '-', nm(deg(ch + 4, -1)), '-', '-');
      bass.push(bl.join(' '));
      // звон шкатулки: ноты аккорда во 2-й октаве через шаг, с паузами-«запинками»
      var ml = [], pool = [ch, ch + 2, ch + 4, ch + 7, ch + 9], last = (R() * pool.length) | 0;
      for (var s = 0; s < steps; s += 2) {
        if (R() < p[4]) { last = Math.max(0, Math.min(pool.length - 1, last + [-1, 1, 1, -2, 2, 0][(R() * 6) | 0])); ml.push(nm(deg(pool[last], 1)), R() < 0.35 ? '-' : '.'); }
        else ml.push('.', '.');
      }
      if (b % 4 === 3) { ml[8] = nm(deg(ch + 4, 0)); ml[9] = '-'; ml[10] = '-'; ml[11] = '-'; }   // «гудок» в конце фразы
      mel.push(ml.join(' '));
      var dl = []; for (var s3 = 0; s3 < steps; s3++) dl.push(s3 % 3 === 0 && R() < 0.5 ? 'h' : '.'); drums.push(dl.join(' '));
    }
    return { bpm: p[3], div: 3, lead: { retro: 'square', modern: 'triangle' }, vol: 0.7, melody: mel.join(' | '), bass: bass.join(' | '), drums: drums.join(' | ') };
  }
  var T = ZONES.map(make);
  A.tracks.kamerton = T[0];
  A.kamerTracks = T;
})(window.Arcade = window.Arcade || {});
