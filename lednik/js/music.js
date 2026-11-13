/* ЛЕДНИК · музыка: оригинальные темы студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Arcade.tracks.lednik — тема уровней: весёлая походная в соль мажоре, «прыгающие» кварты и ответ вниз
   (8 тактов мелодии на 4 такта баса). LEDNIK.MUSIC.map — тема карты (спокойнее, ми минор → соль),
   LEDNIK.MUSIC.boss — тема вожака (ре минор, синкопы). Тема уровней подключается движком сама по gameId;
   карту и вожака main.js включает через g.setMusic. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.lednik = {
    bpm: 138, div: 2, vol: 0.75, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'G4 B4 D5 - C5 B4 A4 - | B4 D5 G5 - F#5 E5 D5 . | E5 - C5 E5 D5 - B4 G4 | A4 B4 C5 B4 A4 - - .',
      'G4 B4 D5 - E5 D5 C5 - | B4 C5 D5 - G5 - F#5 . | E5 F#5 G5 E5 D5 C5 B4 A4 | G4 - D5 - G4 - - .'
    ],
    bass: 'G2 . D3 . G2 . D3 . | C3 . G2 . C3 . E3 . | A2 . E3 . D3 . F#2 . | G2 . D3 . G2 B2 D3 .',
    drums: 'k . h . s . h h | k h k . s . h .'
  };
  var LD = (typeof window !== 'undefined' ? window : globalThis).LEDNIK = (typeof window !== 'undefined' ? window : globalThis).LEDNIK || {};
  LD.MUSIC = {
    level: A.tracks.lednik,
    map: {
      bpm: 104, div: 2, vol: 0.7, lead: { retro: 'square', modern: 'triangle' },
      melody: [
        'E5 - - B4 G4 - A4 B4 | C5 - B4 A4 G4 - - . | D5 - - A4 F#4 - G4 A4 | B4 - A4 G4 F#4 - - .',
        'E5 - - G5 F#5 - E5 D5 | C5 - E5 - D5 - B4 . | C5 B4 A4 C5 B4 A4 G4 F#4 | G4 - - - . . . .'
      ],
      bass: 'E2 . B2 . E2 . B2 . | C3 . G2 . C3 . G2 . | D3 . A2 . D3 . A2 . | G2 . D3 . G2 . D3 .',
      drums: 'k . . . h . . . | k . . h . . h .'
    },
    boss: {
      bpm: 156, div: 2, vol: 0.75, lead: { retro: 'square', modern: 'triangle' },
      melody: [
        'D5 . D5 F5 . D5 E5 F5 | G5 - F5 - E5 - C5 . | D5 . D5 F5 . D5 A5 G5 | F5 - E5 - D5 - - .',
        'Bb5 - A5 - G5 - F5 . | G5 - F5 - E5 - C#5 . | D5 F5 A5 - G5 F5 E5 C#5 | D5 - - - . . A4 .'
      ],
      bass: 'D2 D3 D2 D3 D2 D3 C3 A2 | Bb2 Bb1 Bb2 Bb1 A2 A1 A2 C#3',
      drums: 'k h s h k k s h'
    }
  };
})(window.Arcade = window.Arcade || {});
