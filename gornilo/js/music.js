/* ГОРНИЛО · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: тяжёлый «кузнечный» ритм в ми миноре, 152 BPM — бочка как удар молота на каждую долю,
   рваная мелодия из коротких квартовых ходов; бас — пульсирующие восьмые E → C → D → B. 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.gornilo, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.gornilo = {
    bpm: 152, div: 2, vol: 0.8, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'E5 . E5 B4 D5 . E5 . | G5 - F#5 E5 D5 . B4 . | C5 . C5 G4 B4 . C5 . | E5 - D5 C5 B4 - - .',
      'E5 . G5 . A5 - G5 E5 | D5 . B4 . D5 - E5 . | C5 E5 G5 . F#5 . D5 . | E5 - - . B4 - E5 .'
    ],
    bass: 'E2 E2 E3 E2 E2 E2 B2 E2 | C2 C2 C3 C2 C2 C2 G2 C2 | D2 D2 D3 D2 D2 D2 A2 D2 | B1 B1 B2 B1 B1 D2 F#2 B1',
    drums: 'k h s h k k s h | k h s h k h s o'
  };
})(window.Arcade = window.Arcade || {});
