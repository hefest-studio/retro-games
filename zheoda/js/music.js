/* ЖЕОДА · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: таинственная «пещерная» тема ре дорийский — капли-восьмые в мелодии, бас ходит
   квартами, приглушённые ударные. 8 тактов. Трек кладётся в Arcade.tracks.zheoda, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.zheoda = {
    bpm: 118, div: 2, vol: 0.8, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 . F5 A5 G5 . F5 . | E5 . C5 . D5 - - . | A4 . D5 F5 E5 . D5 C5 | D5 - . . A4 . . .',
      'F5 . A5 C6 B5 . A5 . | G5 . E5 . F5 - - . | D5 E5 F5 G5 A5 . G5 F5 | E5 - D5 . . . . .'
    ],
    bass: 'D2 . . A2 D3 . A2 . | C2 . . G2 C3 . G2 . | Bb1 . . F2 Bb2 . F2 . | A1 . . E2 A2 . C3 .',
    drums: 'k . h . s . h . | k . h k s . h o'
  };
})(window.Arcade = window.Arcade || {});
