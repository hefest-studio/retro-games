/* ЗВЕРО-ОТРЯД · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: бодрый деревенский марш соль мажор — два приятеля, связанные одной верёвкой, шагают в ногу; бас «топ-топ», хромая мелодия
   подпрыгивает на синкопе. 8 тактов мелодии и 8 баса. Подключается сама: трек кладётся в Arcade.tracks['zvero-otryad'], движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks['zvero-otryad'] = {
    bpm: 126, div: 2, vol: 0.85, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'G4 . B4 D5 . B4 G4 . | A4 . C5 E5 . C5 A4 . | B4 . D5 G5 . F#5 D5 B4 | A4 - - - . . D5 .',
      'E5 . G5 E5 D5 . B4 G4 | C5 . E5 C5 B4 . A4 . | B4 . D5 B4 A4 . F#4 A4 | G4 - - - D4 . G4 .'
    ],
    bass: [
      'G2 . D3 . G2 . D3 . | A2 . E3 . A2 . E3 . | C3 . G3 . C3 . G3 . | D3 . A2 . D3 . F#2 .',
      'G2 . D3 . G2 . D3 . | C3 . G2 . C3 . G2 . | D3 . A2 . D3 . A2 . | G2 . D3 . G2 . . .'
    ],
    drums: 'k . h . s . h . | k . h k s . h h'
  };
})(window.Arcade = window.Arcade || {});
