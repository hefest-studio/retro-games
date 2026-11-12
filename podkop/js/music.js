/* ПОДКОП · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: подкоп в ночной шахте — пружинистый ми-минор, «лопата» на малом барабане,
   вторая половина поднимается к выходу и падает обратно в ми. 8 тактов по 8 шагов.
   Подключается сама: трек кладётся в Arcade.tracks.podkop, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.podkop = {
    bpm: 138, div: 2, vol: 0.85, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'E4 . G4 A4 B4 . A4 G4 | E4 - D4 . E4 . . . | G4 . B4 C5 D5 . C5 B4 | A4 - - . B4 . . .',
      'E5 . D5 B4 C5 . A4 B4 | G4 . E4 G4 A4 - . . | B4 . A4 G4 F#4 . D4 F#4 | E4 - - - . . B3 .'
    ],
    bass: 'E2 . E3 . E2 . B2 . | C3 . C3 G2 C3 . G2 . | A2 . A2 E3 A2 . E2 . | B2 . B2 F#2 B2 . D3 .',
    drums: 'k . h . s . h h | k . h k s . h .'
  };
})(window.Arcade = window.Arcade || {});
