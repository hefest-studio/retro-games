/* ТАРАН · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: гоночный «паровой» шаффл в ре миноре, 168 BPM — бочка-поршень на каждую долю, хэт как свист клапана,
   мелодия из коротких восходящих рывков и синкоп; бас — бегущие восьмые D → Bb → C → A. 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.taran, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.taran = {
    bpm: 168, div: 2, vol: 0.8, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 . F5 . A5 - G5 F5 | E5 . D5 . E5 F5 G5 . | F5 . D5 . Bb4 - C5 D5 | C5 - A4 . C5 - . .',
      'D5 . D5 F5 A5 . C6 . | Bb5 - A5 G5 F5 . G5 . | A5 . F5 . E5 - D5 E5 | F5 - E5 - D5 - - .'
    ],
    bass: 'D2 D3 D2 D3 D2 D3 A2 D3 | Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 F2 Bb2 | C2 C3 C2 C3 C2 C3 G2 C3 | A1 A2 A1 A2 C#2 E2 A2 C#3',
    drums: 'k h s h k k s h | k h s h k h s o'
  };
})(window.Arcade = window.Arcade || {});
