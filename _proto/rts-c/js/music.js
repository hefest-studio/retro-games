/* ГАТЬ · оригинальная мелодия (дорийский ре, «болотный» наигрыш), 8 тактов по 8 шагов. */
(function (A) {
  A.tracks = A.tracks || {};
  A.tracks.gat = {
    bpm: 108, div: 2, lead: { retro: 'square', modern: 'triangle' }, vol: 0.9,
    melody: [
      'D5 - F5 E5 D5 C5 A4 - |', 'C5 - D5 E5 F5 - E5 . |',
      'D5 - F5 G5 A5 - G5 F5 |', 'E5 C5 D5 E5 D5 - - . |',
      'A5 - C6 A5 G5 - F5 G5 |', 'A5 - G5 F5 E5 - C5 . |',
      'D5 F5 E5 D5 C5 A4 C5 E5 |', 'D5 - - - A4 - D5 . |',
    ],
    bass: 'D3 . A2 . D3 . A2 . | C3 . G2 . C3 . G2 . | Bb2 . F2 . Bb2 . F2 . | A2 . E2 . A2 . C3 . |',
    drums: 'k . h . s . h h',
  };
})(window.Arcade = window.Arcade || {});
