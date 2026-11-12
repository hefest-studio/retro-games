/* ЗАСЛОН · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: упрямый марш обороны — ми минор, рубленый бас, мелодия с подъёмом во второй половине. 8 тактов.
   Подключается сама: трек кладётся в Arcade.tracks.zaslon, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.zaslon = {
    bpm: 144, div: 2, vol: 0.85, lead: { retro: 'square', modern: 'sawtooth' },
    melody: [
      'E5 - B4 E5 G5 - F#5 E5 | D5 - A4 D5 F#5 - E5 D5 | C5 - G4 C5 E5 - D5 C5 | B4 - D#5 - F#5 - B5 -',
      'E5 G5 B5 - A5 G5 F#5 - | G5 - - E5 D5 - B4 - | C5 E5 G5 - F#5 E5 D#5 - | E5 - - - B4 - - -'
    ],
    bass: [
      'E2 E2 E3 E2 E2 E3 E2 D3 | D2 D2 D3 D2 D2 D3 D2 C3 | C2 C2 C3 C2 C2 C3 C2 B2 | B1 B1 B2 B1 B1 B2 D#2 F#2',
      'E2 E2 E3 E2 G2 G2 G3 G2 | E2 E2 E3 E2 D2 D2 D3 D2 | C2 C2 C3 C2 A1 A1 A2 A1 | B1 B1 B2 B1 E2 E2 E3 E2'
    ],
    drums: 'k . h k s . h h | k . h k s h s o'
  };
})(window.Arcade = window.Arcade || {});
