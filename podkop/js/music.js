/* ПОДКОП · музыка: оригинальная тема студии «Гефест» для секвенсора движка — тягучая «осыпающаяся» тема в ре миноре:
   мелодия сползает вниз ступенями, как песок по откосу, и вскарабкивается обратно; бас — тихие шаги по тонике и квинте. Ключ = gameId (podkop). */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.podkop = {
    bpm: 96, div: 2, vol: 0.7, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'A4 - . F4 - . D4 - | E4 - F4 - G4 - A4 - | Bb4 - . G4 - . E4 - | F4 - E4 - D4 - . -',
      'D5 - . A4 - . F4 - | G4 - A4 - Bb4 - C5 - | D5 - . Bb4 - . G4 - | A4 - G4 - F4 - E4 -'
    ],
    bass: 'D2 . . D3 . . A2 . | C2 . . C3 . . G2 . | Bb1 . . Bb2 . . F2 . | A1 . . A2 . . E2 .',
    drums: 'k . . h . . s . | k . h . k . s h'
  };
})(window.Arcade = window.Arcade || {});
