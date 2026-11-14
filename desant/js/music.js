/* ДЕСАНТ · музыка: оригинальный походный марш студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: ми минор, 138 BPM, восьмые; мелодия — призывные кварты и «шаг» на сильных долях, во второй половине —
   подъём к си и возврат через ре; бас — маршевый «раз-и» E → C → D → B; ударные — дробь малого и бочка на долю.
   8 тактов мелодии на 4 такта баса и 2 такта ударных. Трек — Arcade.tracks.desant (движок берёт по gameId). */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.desant = {
    bpm: 138, div: 2, vol: 0.9, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'E5 . B4 . E5 - G5 . | F#5 . E5 . D5 - B4 . | C5 . E5 . A5 - G5 . | F#5 - D5 . F#5 - . . ',
      'E5 . G5 . B5 - A5 . | G5 . F#5 . E5 - D5 . | C5 . D5 . E5 . F#5 . | E5 - - - B4 . E5 . '
    ],
    bass: 'E2 . E3 E2 . E2 B2 . | C2 . C3 C2 . C2 G2 . | D2 . D3 D2 . D2 A2 . | B1 . B2 B1 . F#2 B1 . ',
    drums: 'k . s . k s s . | k . s . k . s s '
  };
})(window.Arcade = window.Arcade || {});
