/* СКОК · музыка: оригинальные темы студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Arcade.tracks.skok — тема уровней: задорная «мастеровая» в фа мажоре, прыгающие сексты и ответ с синкопой
   (8 тактов мелодии на 4 такта баса). SKOK.MUSIC.map — тема карты (размеренная, ре минор → фа),
   SKOK.MUSIC.fort — тема крепости (ля минор, «кузнечные» удары), SKOK.MUSIC.game — мини-игры (лёгкий вальсок 6/8).
   Тема уровней подключается движком сама по gameId; остальные main.js включает через g.setMusic. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.skok = {
    bpm: 144, div: 2, vol: 0.75, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'F4 A4 C5 F5 - D5 C5 . | A4 - Bb4 C5 D5 - C5 . | G4 Bb4 D5 G5 - F5 E5 . | C5 - D5 E5 F5 - - .',
      'F5 - E5 D5 C5 - A4 C5 | Bb4 - A4 G4 A4 - F4 . | G4 A4 Bb4 D5 C5 - E5 . | F5 - C5 - F4 - - .'
    ],
    bass: 'F2 . C3 . F2 . A2 . | Bb2 . F2 . Bb2 . D3 . | C3 . G2 . C3 . E3 . | F2 . C3 . F2 C3 F2 .',
    drums: 'k . h . s . h k | k h k . s . h h'
  };
  var root = typeof window !== 'undefined' ? window : globalThis;
  var SK = root.SKOK = root.SKOK || {};
  SK.MUSIC = {
    level: A.tracks.skok,
    map: {
      bpm: 108, div: 2, vol: 0.7, lead: { retro: 'square', modern: 'triangle' },
      melody: [
        'D5 - A4 - F4 A4 D5 E5 | F5 - E5 D5 C5 - A4 . | Bb4 - D5 - F5 - E5 D5 | C#5 - E5 - A4 - - .',
        'D5 - F5 - A5 - G5 F5 | E5 - C5 - A4 - C5 . | Bb4 C5 D5 Bb4 A4 G4 F4 E4 | F4 - - - . . . .'
      ],
      bass: 'D3 . A2 . D3 . A2 . | F2 . C3 . F2 . C3 . | Bb2 . F2 . Bb2 . F2 . | A2 . E3 . A2 . C#3 .',
      drums: 'k . . h . . h . | k . . h . h . .'
    },
    fort: {
      bpm: 152, div: 2, vol: 0.75, lead: { retro: 'square', modern: 'triangle' },
      melody: [
        'A4 . A4 C5 . A4 E5 D5 | C5 - B4 - A4 - G#4 . | A4 . A4 C5 . E5 A5 G5 | F5 - E5 - D5 - E5 .',
        'F5 - E5 - D5 - C5 . | D5 - C5 - B4 - G#4 . | A4 C5 E5 - D5 C5 B4 G#4 | A4 - - - . . E4 .'
      ],
      bass: 'A2 A3 A2 A3 A2 A3 G2 E2 | F2 F3 F2 F3 E2 E3 E2 G#2',
      drums: 'k h s h k k s h'
    },
    game: {
      bpm: 120, div: 3, vol: 0.65, lead: { retro: 'square', modern: 'triangle' },
      melody: 'C5 E5 G5 | A5 - G5 | F5 A5 F5 | E5 - . | D5 F5 A5 | G5 - F5 | E5 D5 C5 | C5 - .',
      bass: 'C3 . G2 | F2 . C3 | F2 . A2 | C3 . G2 | D3 . A2 | G2 . D3 | C3 . G2 | C3 . .',
      drums: 'k . h | k h h | k . h | s . h | k . h | k h h | k . h | s . .'
    }
  };
})(window.Arcade = window.Arcade || {});
