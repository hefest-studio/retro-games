/* ЗВЕРО-ОТРЯД 2 · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: «Ледяные Погреба» — звенящий вальсок ля минор на 6/8 (div 3), холодные капли-арпеджио.
   8 тактов по 12 шагов (две доли 6/8 в такте). Трек кладётся в Arcade.tracks['zvero-otryad-2']. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks['zvero-otryad-2'] = {
    bpm: 100, div: 3, vol: 0.85, lead: { retro: 'square', modern: 'sine' },
    melody: [
      'A5 . E5 C5 . E5 A5 . B5 C6 . B5 | G5 . E5 C5 . E5 G5 - - - . . | F5 . C5 A4 . C5 F5 . G5 A5 . G5 | E5 . B4 G#4 . B4 E5 - - - . .',
      'A5 . C6 B5 . A5 G5 . A5 F5 . E5 | D5 . F5 E5 . D5 C5 - - E5 - - | F5 . E5 D5 . C5 B4 . C5 D5 . E5 | A4 - - - . . . . . . . .'
    ],
    bass: [
      'A2 . . E3 . . A2 . . E3 . . | C3 . . G3 . . C3 . . G2 . . | F2 . . C3 . . F2 . . C3 . . | E2 . . B2 . . E2 . . G#2 . .',
      'A2 . . E3 . . A2 . . E3 . . | D2 . . A2 . . D2 . . A2 . . | F2 . . C3 . . G2 . . D3 . . | A2 . . E3 . . A2 . . . . .'
    ],
    drums: 'k . h s . h k . h s . o'
  };
})(window.Arcade = window.Arcade || {});
