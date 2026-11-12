/* РАЗРЕЗ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: гипнотичный фа-диез минор, ровный пульс — сосредоточенная резка поля. 8 тактов.
   Подключается сама: трек кладётся в Arcade.tracks.razrez, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.razrez = {
    bpm: 124, div: 2, lead: { retro: 'square', modern: 'sine' },
    melody: [
      'F#4 . C#5 . F#4 . B4 A4 | F#4 . C#5 . E5 . C#5 . | D5 . A4 . F#4 . A4 B4 | C#5 - - - G#4 - E#4 -',
      'F#5 . C#5 . F#5 . E5 D5 | C#5 . A4 . F#4 . A4 C#5 | D5 . E5 . F#5 - E5 D5 | C#5 - - - . . . .'
    ],
    bass: [
      'F#2 F#2 . F#2 F#3 . F#2 . | F#2 F#2 . F#2 F#3 . F#2 . | D2 D2 . D2 D3 . D2 . | C#2 C#2 . C#2 C#3 . C#2 .',
      'F#2 F#2 . F#2 F#3 . F#2 . | A2 A2 . A2 A3 . A2 . | D2 D2 . D2 D3 . D2 . | C#2 C#2 . C#2 C#3 . G#2 .'
    ],
    drums: 'k . h . s . h h | k . h k s . h .'
  };
})(window.Arcade = window.Arcade || {});
