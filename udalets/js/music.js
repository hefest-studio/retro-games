/* УДАЛЕЦ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: бодрый «приключенческий» марш соль мажор — бас скачет октавами (соль → ми минор → до → ре),
   мелодия из коротких прыгучих фраз с синкопой и взлётом во второй половине. 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.udalets, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.udalets = {
    bpm: 138, div: 2, vol: 0.8, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'G4 . B4 D5 . B4 G4 . | E4 - G4 B4 A4 G4 E4 . | C5 . E5 C5 B4 . A4 G4 | A4 - - . D5 - C5 B4',
      'G4 . B4 D5 G5 - F#5 E5 | E5 . D5 B4 G4 - E4 . | C5 E5 G5 E5 D5 . F#5 . | G5 - - - . . . .'
    ],
    bass: 'G2 . G3 . D3 . G3 . | E2 . E3 . B2 . E3 . | C3 . C2 . G2 . C3 . | D3 . D2 . A2 . F#2 .',
    drums: 'k . h . s . h h | k . h k s . h .'
  };
})(window.Arcade = window.Arcade || {});
