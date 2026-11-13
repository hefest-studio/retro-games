/* ПОСОХ · музыка: оригинальные темы студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Arcade.tracks.posokh — тема экспедиций: бодрый походный марш в ми миноре с «пружинящими» скачками на кварту
   и октаву (8 тактов мелодии на 4 такта баса). POSOKH.MUSIC.camp — тема лагеря у глобуса (соль мажор, неспешно),
   POSOKH.MUSIC.boss — тема хозяина экспедиции (ля минор, настойчивые повторы). Тема экспедиций подключается
   движком сама по gameId; лагерь и хозяина main.js включает через g.setMusic. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.posokh = {
    bpm: 144, div: 2, vol: 0.75, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'E5 . B4 . E5 F#5 G5 . | F#5 E5 D5 - B4 - . . | C5 . G4 . C5 D5 E5 . | D5 C5 B4 - A4 - . .',
      'B4 . E5 . G5 . B5 A5 | G5 F#5 E5 - D5 E5 F#5 . | G5 . E5 . C5 . A4 B4 | E5 - - - . . B4 .'
    ],
    bass: 'E2 . B2 . E2 . B2 . | C3 . G2 . C3 . G2 . | A2 . E3 . A2 . E3 . | B2 . F#2 . B2 . D3 .',
    drums: 'k . h . s . h . | k k h . s . h h'
  };
  var G = typeof window !== 'undefined' ? window : globalThis;
  var PS = G.POSOKH = G.POSOKH || {};
  PS.MUSIC = {
    level: A.tracks.posokh,
    camp: {
      bpm: 96, div: 2, vol: 0.7, lead: { retro: 'square', modern: 'triangle' },
      melody: [
        'D5 - B4 - G4 - A4 B4 | C5 - - B4 A4 - - . | B4 - G4 - E4 - F#4 G4 | A4 - - - . . . .',
        'D5 - E5 - D5 - B4 G4 | C5 - E5 - D5 - A4 . | B4 A4 G4 A4 B4 - D5 - | G4 - - - . . . .'
      ],
      bass: 'G2 . D3 . G2 . D3 . | C3 . G2 . C3 . G2 . | E2 . B2 . E2 . B2 . | D3 . A2 . D3 . F#2 .',
      drums: 'k . . . h . . . | k . . . h . h .'
    },
    boss: {
      bpm: 160, div: 2, vol: 0.75, lead: { retro: 'square', modern: 'triangle' },
      melody: 'A4 A4 C5 A4 E5 . D5 C5 | B4 B4 D5 B4 F5 . E5 D5 | C5 C5 E5 C5 A5 . G5 F5 | E5 - G#4 - B4 - E5 .',
      bass: 'A2 A3 A2 A3 A2 A3 A2 A3 | G2 G3 G2 G3 E2 E3 E2 E3',
      drums: 'k h s h k k s h'
    }
  };
})(window.Arcade = window.Arcade || {});
