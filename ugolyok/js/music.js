/* УГОЛЁК · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: деловитый «рабочий» ход ми минор — бас пыхтит как паровая машина (тоника с октавным подскоком),
   мелодия из коротких «ударных» фраз с подъёмом во второй половине. 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.ugolyok, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.ugolyok = {
    bpm: 126, div: 2, vol: 0.75, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'E5 . G5 E5 B4 - . . | D5 . E5 D5 B4 - A4 . | G4 - A4 B4 D5 - B4 . | E5 - - - . . . .',
      'E5 . G5 A5 B5 - A5 G5 | F#5 - E5 - D5 . B4 . | C5 - D5 E5 G5 - F#5 E5 | E5 - - - B4 . . .'
    ],
    bass: 'E2 . E2 E3 E2 . B2 . | C2 . C2 C3 C2 . G2 . | G1 . G1 G2 D2 . D3 . | B1 . B1 B2 B1 . F#2 B2',
    drums: 'k . h k s . h . | k k h . s . h h'
  };
})(window.Arcade = window.Arcade || {});
