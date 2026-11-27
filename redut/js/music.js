/* РЕДУТ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: ночной маяк — мерцающий арпеджио ми минора, бас ходит Em → C → D → B, мягкий «тикающий» ритм;
   8 тактов мелодии на 4 такта баса. Подключается сама: трек кладётся в Arcade.tracks.redut, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.redut = {
    bpm: 116, div: 2, vol: 0.85, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'E5 - B4 - E5 - G5 - | G5 - E5 - C5 - . . | F#5 - A5 - D5 - . . | B4 - D#5 - F#5 - - -',
      'G5 - B5 - E6 - B5 - | E5 - G5 - C6 - G5 - | D5 - F#5 - A5 - F#5 - | D#5 - F#5 - B5 - - -'
    ],
    bass: 'E2 . E3 . B2 . E3 . | C2 . C3 . G2 . C3 . | D2 . D3 . A2 . D3 . | B1 . B2 . F#2 . B2 .',
    drums: 'k . h . s . h . | k . h k s . h h'
  };
})(window.Arcade = window.Arcade || {});
