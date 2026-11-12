/* СПУТНИК · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: упругий космический «полёт» ми минор — бас пульсирует восьмыми с октавными скачками,
   мелодия из коротких фраз-«сигналов» с подъёмом к си во второй половине. 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.sputnik, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.sputnik = {
    bpm: 138, div: 2, vol: 0.8, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'E5 . G5 . B5 - A5 G5 | F#5 - . D5 E5 - - . | E5 . G5 . B5 - D6 . | C6 - B5 . A5 - - .',
      'G5 . A5 B5 . G5 E5 . | F#5 . G5 A5 - - F#5 . | E5 . B4 . E5 G5 F#5 D5 | E5 - - - . . B4 .'
    ],
    bass: 'E2 E3 E2 E3 E2 E3 D3 B2 | C2 C3 C2 C3 C2 C3 D3 C3 | G2 G3 G2 G3 D2 D3 D2 D3 | A2 A3 A2 A3 B2 B3 B2 F#2',
    drums: 'k . h . s . h h | k k h . s . h o'
  };
})(window.Arcade = window.Arcade || {});
