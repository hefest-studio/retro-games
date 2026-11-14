/* СБОРКА · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: деловитый «конвейерный» марш в ре дорийском, 118 BPM — мелодия-перекличка цехов (вопрос в первых
   четырёх тактах, ответ — в следующих), бас шагает D → C → Bb → C с «молоточком» на слабую долю. 8 тактов на 4.
   Подключается сама: трек кладётся в Arcade.tracks.sborka, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.sborka = {
    bpm: 118, div: 2, vol: 0.7, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 . F5 . A5 G5 F5 . | E5 . C5 . D5 - . . | F5 . A5 . C6 B5 A5 . | G5 - E5 . F5 - . .',
      'A5 . G5 F5 E5 . D5 . | C5 . E5 G5 F5 - E5 . | D5 . F5 A5 G5 . E5 C5 | D5 - - . A4 . D5 .'
    ],
    bass: 'D3 . D3 A2 D3 . F3 . | C3 . C3 G2 C3 . E3 . | Bb2 . Bb2 F2 Bb2 . D3 . | C3 . C3 G2 A2 . C#3 .',
    drums: 'k . h s k h s h | k k h s k h s o'
  };
})(window.Arcade = window.Arcade || {});
