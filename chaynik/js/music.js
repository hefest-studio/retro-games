/* ЧАЙНИК · музыка: оригинальные темы студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Arcade.tracks.chaynik — основная тема («кухонный марш», фа мажор, 150 уд/мин; звучит на 1-м уровне).
   Свои бодрые темы уровней — Arcade.tracks['chaynik:2'] … ['chaynik:6']: галоп гонки, «подводный» вальс-дрейф,
   пиццикато на цыпочках для головоломки, воздушная 6/8 для полёта и тревожный марш Сервиза.
   main.js переключает тему g.setMusic(...) при входе на уровень. Все мелодии — 8 тактов, без цитат. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.chaynik = {
    bpm: 150, div: 2, vol: 0.85, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'F5 . C5 . A4 C5 F5 - | G5 F5 E5 D5 C5 - . . | Bb4 . D5 . F5 D5 Bb4 - | C5 - E5 G5 C6 - . .',
      'A5 . F5 . C5 F5 A5 - | G5 A5 Bb5 A5 G5 - E5 . | F5 E5 D5 C5 Bb4 A4 G4 . | F4 - A4 C5 F5 - . .'
    ],
    bass: 'F2 . C3 . F2 . C3 . | Bb1 . F2 . Bb1 . F2 . | C2 . G2 . C2 . G2 . | F2 . C3 . A2 . C3 .',
    drums: 'k . h s k h s h | k . h s k k s o'
  };
  A.tracks['chaynik:2'] = {   // гонка по скатерти — галоп
    bpm: 176, div: 2, vol: 0.8, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'A4 C5 E5 A5 G5 E5 C5 E5 | F5 - E5 - D5 - C5 - | G4 B4 D5 G5 F5 D5 B4 D5 | E5 - . E5 E5 - . .',
      'A4 C5 E5 A5 B5 A5 G5 E5 | F5 E5 F5 G5 A5 - F5 - | E5 D5 C5 B4 C5 D5 E5 G#4 | A4 - . . A5 - . .'
    ],
    bass: 'A2 A3 A2 A3 F2 F3 F2 F3 | G2 G3 G2 G3 E2 E3 E2 E3',
    drums: 'k h s h k h s h'
  };
  A.tracks['chaynik:3'] = {   // чайная глубина — дрейф
    bpm: 112, div: 2, vol: 0.9, lead: { retro: 'triangle', modern: 'sine' },
    melody: [
      'D5 - - F5 E5 - D5 - | C5 - A4 - . . . . | D5 - - F5 G5 - A5 - | G5 - E5 - . . . .',
      'F5 - E5 - D5 - C5 - | D5 - A4 - F4 - G4 - | A4 - - C5 B4 - G4 - | A4 - - - . . . .'
    ],
    bass: 'D2 . . A2 . . D3 . | C2 . . G2 . . C3 . | Bb1 . . F2 . . Bb2 . | A1 . . E2 . . A2 .',
    drums: 'k . . h . . s . | k . h . . h s .'
  };
  A.tracks['chaynik:4'] = {   // спящий сахарок — на цыпочках
    bpm: 120, div: 2, vol: 0.8, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'E5 . . . B4 . . . | C5 . B4 . A4 . . . | E5 . . . G5 . . . | F#5 . E5 . D#5 . . .',
      'E5 . G5 . B5 . G5 . | A5 . F#5 . D#5 . B4 . | C5 . B4 . A4 . G4 . | F#4 . . . E4 . . .'
    ],
    bass: 'E2 . . . B1 . . . | A1 . . . B1 . . .',
    drums: 'h . . . s . . . | h . h . s . . h'
  };
  A.tracks['chaynik:5'] = {   // пакетик-аэростат — 6/8
    bpm: 140, div: 3, vol: 0.85, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'C5 - E5 G5 - E5 | F5 - A5 C6 - A5 | G5 - E5 C5 - E5 | D5 - - . . .',
      'C5 - E5 G5 - C6 | B5 - G5 D5 - G5 | A5 - F5 D5 - B4 | C5 - - . . .'
    ],
    bass: 'C3 . G2 C3 . G2 | F2 . C3 G2 . D3',
    drums: 'k . h s . h'
  };
  A.tracks['chaynik:6'] = {   // Сервиз — тревожный марш
    bpm: 160, div: 2, vol: 0.85, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'C5 C5 Eb5 C5 G5 - F5 Eb5 | D5 - Bb4 - C5 - . . | C5 C5 Eb5 C5 Ab5 - G5 F5 | G5 - - - . . . .',
      'Ab5 - G5 - F5 - Eb5 - | F5 - Eb5 - D5 - Bb4 - | C5 Eb5 G5 C6 B5 G5 D5 B4 | C5 - - - C6 - . .'
    ],
    bass: 'C2 C3 C2 C3 C2 C3 Bb1 Bb2 | Ab1 Ab2 Ab1 Ab2 G1 G2 G1 G2',
    drums: 'k h s h k k s h | k h s h k s s s'
  };
})(window.Arcade = window.Arcade || {});
