/* ПРИИСК · музыка: оригинальные темы студии «Гефест» для секвенсора движка (процедурный чиптюн, js/engine.js).
   Характер — суровый северный: натуральный минор и фригийский лад, гулкий бас, редкие удары.
   Три трека: menu — меню и экраны кампании (медленно, ре-минор), priisk — поле: скирмиш и миссия без боя (ми-минор, шаг),
   battle — бой рядом с нашими (ля-фригийский, быстро). Arcade.tracks.priisk — основной трек (его проверяет общий тест
   _shared/tests/music.test.mjs), остальные — Arcade.tracks['priisk-menu'] / ['priisk-battle']. Переключает main.js по сцене и бою. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  var menu = {
    bpm: 70, div: 2, vol: 0.55, lead: { retro: 'triangle', modern: 'triangle' },
    melody: [
      'D4 - - - F4 - E4 D4 | C4 - - - D4 - - - | A4 - - - G4 - F4 E4 | D4 - - - - - . . |',
      'F4 - - - G4 - A4 - | C5 - - - Bb4 - A4 - | G4 - F4 - E4 - C4 - | D4 - - - - - . .'
    ],
    bass: 'D2 - A2 - D3 - A2 - | C2 - G2 - C3 - G2 - | Bb1 - F2 - Bb2 - F2 - | A1 - E2 - A2 - E2 -',
    drums: 'k . . h . . h . | k . . h s . h .'
  };
  var field = {
    bpm: 92, div: 2, vol: 0.55, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'E4 . E4 G4 A4 - G4 E4 | D4 - E4 - - - . . | E4 . E4 G4 B4 - A4 G4 | A4 - - - - - . . |',
      'C5 - B4 A4 G4 - A4 - | B4 - A4 G4 E4 - - - | D4 - E4 G4 A4 - G4 D4 | E4 - - - - - . .'
    ],
    bass: 'E2 . E2 . B2 . E2 . | C2 . C2 . G2 . C2 . | D2 . D2 . A2 . D2 . | E2 . E2 . B1 . E2 .',
    drums: 'k . h . s . h . | k . k h s . h .'
  };
  var battle = {
    bpm: 138, div: 2, vol: 0.6, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'A4 A4 Bb4 A4 G4 A4 . A4 | C5 - Bb4 A4 G4 - F4 - | A4 A4 Bb4 A4 G4 A4 . E5 | D5 - C5 Bb4 A4 - - - |',
      'F4 F4 G4 A4 Bb4 - A4 G4 | A4 - E4 F4 G4 - E4 - | F4 - G4 - A4 - Bb4 C5 | A4 - - - - - . .'
    ],
    bass: 'A1 A2 A1 A2 A1 A2 G1 G2 | F1 F2 F1 F2 G1 G2 G1 G2',
    drums: 'k h s h k k s h | k h s h k h s o'
  };
  A.tracks.priisk = field;
  A.tracks['priisk-menu'] = menu;
  A.tracks['priisk-battle'] = battle;
  A.priiskTracks = { menu: menu, field: field, battle: battle };
})(typeof window !== 'undefined' ? (window.Arcade = window.Arcade || {}) : (globalThis.Arcade = globalThis.Arcade || {}));
