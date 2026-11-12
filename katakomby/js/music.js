/* КАТАКОМБЫ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: мрачноватый марш вниз по ступеням, ре минор, неторопливо; бас ходит по квинтам,
   мелодия с повышенной вводной (до-диез) в конце. 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.katakomby, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.katakomby = {
    bpm: 100, div: 2, vol: 0.9, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 - - . F5 - E5 . | D5 - A4 - - . . . | Bb4 - - . A4 - G4 . | A4 - - - - . . .',
      'D5 - - . F5 - G5 . | A5 - - . G5 F5 E5 . | F5 - E5 - D5 - C#5 - | D5 - - - - . . .'
    ],
    bass: 'D2 . D2 . A1 . D2 . | Bb1 . Bb1 . F2 . Bb1 . | G1 . G1 . D2 . G1 . | A1 . A1 . E2 . C#2 .',
    drums: 'k . . h s . . h | k . k h s . h .'
  };
})(window.Arcade = window.Arcade || {});
