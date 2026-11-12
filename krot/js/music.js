/* КРОТ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: подземный бур — упругий ми-минорный грув, «копающий» бас на октавах, 8 тактов.
   Подключается сама: трек кладётся в Arcade.tracks.krot, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.krot = {
    bpm: 138, div: 2, vol: 0.9, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'E5 . G5 E5 B4 . E5 - | D5 . F#5 D5 A4 . D5 - | C5 . E5 G5 F#5 E5 D5 B4 | E5 - - . B4 . . .',
      'G5 . A5 G5 F#5 . E5 - | F#5 . G5 F#5 D5 . B4 - | C5 E5 G5 C6 B5 A5 G5 F#5 | E5 - B4 - E5 - - .'
    ],
    bass: [
      'E2 E3 E2 E3 E2 E3 E2 E3 | D2 D3 D2 D3 D2 D3 D2 D3 | C2 C3 C2 C3 A1 A2 B1 B2 | E2 E3 E2 E3 E2 . B1 .'
    ],
    drums: 'k . h . s . h k | k . h k s . h h'
  };
})(window.Arcade = window.Arcade || {});
