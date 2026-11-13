/* ОРУЖЕЙНИК · музыка: оригинальные темы студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Arcade.tracks.oruzheynik — тема цехов: бодрый марш в ре миноре, фраза «подъём — ответ» (8 тактов мелодии на 4 такта баса).
   ORUZH.MUSIC.boss — тема боя с Мастером: ми минор, синкопы и ход к вводному тону (8 тактов на 2 такта баса).
   Тема цехов подключается движком сама по gameId; боевую main.js включает через g.setMusic на вход в арену. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.oruzheynik = {
    bpm: 144, div: 2, vol: 0.75, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 - F5 - A5 - G5 F5 | E5 - C5 - D5 - - . | Bb4 - D5 - F5 - E5 D5 | C5 - A4 - C5 - - .',
      'D5 F5 A5 - Bb5 - A5 G5 | F5 - G5 - E5 - C5 . | D5 - A4 - Bb4 C5 D5 E5 | F5 - E5 - D5 - - .'
    ],
    bass: 'D3 . D3 A2 D3 . D3 A2 | Bb2 . Bb2 F2 Bb2 . Bb2 F2 | C3 . C3 G2 C3 . C3 G2 | A2 . A2 E2 A2 . C3 E3',
    drums: 'k . h . s . h k | k . h k s . h h'
  };
  var OZ = (typeof window !== 'undefined' ? window : globalThis).ORUZH = (typeof window !== 'undefined' ? window : globalThis).ORUZH || {};
  OZ.MUSIC = {
    stage: A.tracks.oruzheynik,
    boss: {
      bpm: 160, div: 2, vol: 0.75, lead: { retro: 'square', modern: 'triangle' },
      melody: [
        'E5 . E5 G5 . E5 F#5 G5 | A5 - G5 - F#5 - D5 . | E5 . E5 G5 . E5 B5 A5 | G5 - F#5 - E5 - - .',
        'C6 - B5 - A5 - G5 . | A5 - G5 - F#5 - D5 . | E5 G5 B5 - A5 G5 F#5 D#5 | E5 - - - . . B4 .'
      ],
      bass: 'E2 E3 E2 E3 E2 E3 D3 B2 | C3 C2 C3 C2 B2 B1 B2 D#3',
      drums: 'k h s h k k s h'
    }
  };
})(window.Arcade = window.Arcade || {});
