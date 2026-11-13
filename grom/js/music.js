/* ГРОМ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: напористый марш-боевик фа-диез минор, бас «молотом» восьмыми с октавными скачками,
   мелодия — короткие рубленые мотивы с ответом на кварту выше и громовым подъёмом в конце. 8 тактов на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.grom, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.grom = {
    bpm: 144, div: 2, vol: 0.8, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'F#4 . F#4 A4 C#5 - B4 A4 | G#4 - E4 - F#4 - . . | B4 . B4 D5 F#5 - E5 D5 | C#5 - A4 - B4 - . .',
      'F#5 - E5 . D5 - C#5 . | D5 . B4 . C#5 - A4 . | B4 . C#5 . D5 . E5 . | F#5 - - - C#5 - . .'
    ],
    bass: 'F#2 F#2 F#3 F#2 F#2 F#2 E3 F#2 | D2 D2 D3 D2 E2 E2 E3 E2 | B1 B1 B2 B1 D2 D2 D3 D2 | C#2 C#2 C#3 C#2 C#2 E2 F2 G#2',
    drums: 'k . h k s . h . | k k h . s . h o'
  };
})(window.Arcade = window.Arcade || {});
