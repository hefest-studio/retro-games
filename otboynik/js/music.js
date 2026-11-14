/* ОТБОЙНИК · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: бойкая «часовая» пьеса ре мажор/си минор в духе заводной игрушки — бас ходит качелями тоника–квинта,
   мелодия из отрывистых «тиков» и коротких подъёмов, во второй половине уходит в си минор и возвращается.
   8 тактов мелодии (восьмые) на 4 такта баса. Трек кладётся в Arcade.tracks.otboynik — движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.otboynik = {
    bpm: 128, div: 2, vol: 0.75, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 . F#5 A5 . F#5 E5 D5 | E5 . G5 B5 . A5 G5 . | F#5 A5 D6 . C#6 B5 A5 . | G5 . E5 F#5 G5 - A5 .',
      'B4 . D5 F#5 . D5 C#5 B4 | C#5 . E5 G5 F#5 E5 D5 . | E5 F#5 G5 A5 B5 . C#6 . | D6 - A5 . F#5 . D5 .'
    ],
    bass: 'D3 . A2 . D3 A2 F#2 A2 | G2 . D3 . G2 D3 B2 D3 | B2 . F#2 . B2 F#2 D3 F#2 | A2 . E3 . A2 C#3 E3 A2',
    drums: 'k h s h k k s h | k h s h k . s o'
  };
})(window.Arcade = window.Arcade || {});
