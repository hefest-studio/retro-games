/* ЧЕРТОГ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: шкатулочный, чуть таинственный марш театра теней — ре минор, высокий регистр «музыкальной шкатулки», шагающий бас.
   8 тактов мелодии и 8 тактов баса. Подключается сама: трек в Arcade.tracks.chertog (по gameId). */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.chertog = {
    bpm: 96, div: 2, vol: 0.7, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 . F5 A5 - G5 F5 . | E5 . G5 Bb5 - A5 G5 . | F5 . A5 D6 - C6 A5 . | A5 - - - G5 - F5 E5',
      'D5 . F5 A5 - G5 F5 . | C5 . E5 G5 - F5 E5 . | D5 . F5 A5 - Bb5 A5 G5 | A5 - - - D5 - - .'
    ],
    bass: 'D3 . A2 . D3 . A2 . | Bb2 . F3 . Bb2 . F3 . | F2 . C3 . F2 . C3 . | A2 . E3 . A2 . E3 . | D3 . A2 . D3 . A2 . | C3 . G2 . C3 . G2 . | Bb2 . F3 . Bb2 . F3 . | A2 . E3 . A2 . C#3 .',
    drums: 'k . h . s . h . | k . h . s . h o'
  };
})(window.Arcade = window.Arcade || {});
