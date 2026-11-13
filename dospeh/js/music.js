/* ДОСПЕХ · музыка: оригинальные темы студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Arcade.tracks.dospeh — тема пустошей: суровый шаг в ля миноре, фраза «зов — отклик» на 8 тактов мелодии и 4 такта баса.
   DOSPEH.MUSIC.boss — тема стража: ре минор, тревожные повторы и ход вниз по хроматике (8 тактов на 2 такта баса).
   Тема пустошей подключается движком сама по gameId; тему стража main.js включает через g.setMusic на входе в арену. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.dospeh = {
    bpm: 132, div: 2, vol: 0.75, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'A4 - C5 - E5 - D5 C5 | B4 - G4 - A4 - - . | E5 - G5 - A5 - G5 E5 | F5 - E5 - D5 - - .',
      'C5 D5 E5 - A5 - G5 F5 | E5 - D5 - C5 - B4 . | A4 - E5 - D5 C5 B4 G4 | A4 - - - . . E4 .'
    ],
    bass: 'A2 . A2 E2 A2 . A2 E2 | F2 . F2 C3 F2 . F2 C3 | G2 . G2 D3 G2 . G2 D3 | E2 . E2 B2 E2 . G#2 B2',
    drums: 'k . h . s . h . | k . h k s . h h'
  };
  var root = typeof window !== 'undefined' ? window : globalThis;
  var D = root.DOSPEH = root.DOSPEH || {};
  D.MUSIC = {
    stage: A.tracks.dospeh,
    boss: {
      bpm: 156, div: 2, vol: 0.75, lead: { retro: 'square', modern: 'triangle' },
      melody: [
        'D5 D5 . F5 E5 . D5 C#5 | D5 - A4 - Bb4 - A4 . | D5 D5 . F5 E5 . G5 F5 | E5 - C#5 - A4 - - .',
        'Bb5 - A5 - G5 - F5 . | G5 - F5 - E5 - D5 . | C#5 E5 A5 - G5 F5 E5 C#5 | D5 - - - . . A4 .'
      ],
      bass: 'D2 D3 D2 D3 D2 D3 C3 A2 | Bb1 Bb2 Bb1 Bb2 A1 A2 A1 C#3',
      drums: 'k h s h k k s h'
    }
  };
})(window.Arcade = window.Arcade || {});
