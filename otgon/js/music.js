/* ОТГОН · музыка: оригинальные темы студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Спокойная, по участкам пути: предгорье на рассвете (соль мажор) → ущелье (ля минор) → речная долина в дождь (ре дорийский)
   → перевал в буран (фа-диез минор, прозрачно) → гребень в грозу (ми минор, ударные) → спуск (до мажор)
   → летнее пастбище (соль мажор, финал). Каждая тема — 8 тактов по 8 шагов. A.tracks.otgon — тема 1-го участка
   (движок берёт её по gameId); остальные — A.otgonTracks[1..6], main.js переключает их по участкам. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  var lead = { retro: 'triangle', modern: 'sine' };
  var T = [
    { // 1. Предгорье, рассвет
      bpm: 80, div: 2, lead: lead, vol: 0.9,
      melody: [
        'G4 - B4 - D5 - - - | E5 - D5 - B4 - - - | A4 - B4 - D5 - B4 - | G4 - - - - - . .',
        'B4 - D5 - E5 - G5 - | E5 - D5 - B4 - A4 - | G4 - A4 - B4 - A4 - | G4 - - - - - - .'
      ],
      bass: 'G2 D3 G3 D3 B3 D3 G3 D3 | C3 G3 C4 G3 E3 G3 C4 G3 | D3 A3 D4 A3 F#3 A3 D4 A3 | G2 D3 G3 D3 B2 D3 G3 D3',
      drums: '. . . . h . . . | . . . . . . h .'
    },
    { // 2. Ущелье, карниз
      bpm: 76, div: 2, lead: lead, vol: 0.85,
      melody: [
        'A4 - - - C5 - E5 - | D5 - C5 - A4 - - - | G4 - A4 - C5 - A4 - | E4 - - - - - . .',
        'A4 - C5 - E5 - G5 - | F#5 - E5 - D5 - - - | C5 - B4 - A4 - G4 - | A4 - - - - - - .'
      ],
      bass: 'A2 E3 A3 E3 C3 E3 A3 E3 | D3 A3 D4 A3 F3 A3 D4 A3 | G2 D3 G3 D3 B2 D3 G3 D3 | A2 E3 A3 E3 C3 E3 A3 E3',
      drums: '. . h . . . h . | . . h . . . h .'
    },
    { // 3. Речная долина, дождь
      bpm: 84, div: 2, lead: lead, vol: 0.85,
      melody: [
        'D4 - F4 - A4 - - - | G4 - A4 - C5 - A4 - | B4 - A4 - G4 - F4 - | D4 - - - - - . .',
        'A4 - C5 - D5 - - - | C5 - A4 - G4 - A4 - | F4 - G4 - E4 - F4 - | D4 - - - - - - .'
      ],
      bass: 'D3 A3 D4 A3 D3 A3 F3 A3 | G2 D3 G3 D3 G2 D3 B2 D3 | F2 C3 F3 C3 F2 C3 A2 C3 | D3 A3 D4 A3 D3 A3 F3 A3',
      drums: 'h . h . . . h . | h . h . . . h h'
    },
    { // 4. Перевал, буран — пусто и холодно
      bpm: 72, div: 2, lead: lead, vol: 0.8,
      melody: [
        'F#4 - - - A4 - - - | C#5 - - - B4 - A4 - | F#4 - - - E4 - - - | F#4 - - - - - . .',
        'C#5 - - - E5 - - - | D5 - C#5 - A4 - - - | B4 - A4 - F#4 - G#4 - | F#4 - - - - - - .'
      ],
      bass: 'F#2 C#3 F#3 C#3 A3 C#3 F#3 C#3 | D2 A2 D3 A2 F#3 A2 D3 A2 | B2 F#3 B3 F#3 D3 F#3 B3 F#3 | C#3 G#3 C#4 G#3 F#2 C#3 F#3 C#3',
      drums: 'h . . . . . . . | h . . . o . . .'
    },
    { // 5. Гребень, гроза — тревожно
      bpm: 96, div: 2, lead: { retro: 'square', modern: 'triangle' }, vol: 0.8,
      melody: [
        'E4 . G4 . B4 - A4 . | G4 . F#4 . E4 - - . | C5 . B4 . A4 . G4 . | B4 - - - - - . .',
        'E5 . D5 . B4 . G4 . | A4 - B4 . C5 . B4 . | A4 . G4 . F#4 . D#4 . | E4 - - - - - . .'
      ],
      bass: 'E2 E2 . E3 E2 . B2 . | C3 C3 . C3 G2 . C3 . | A2 A2 . A2 E2 . A2 . | B2 B2 . B2 F#2 . B2 .',
      drums: 'k . h . s . h . | k . h k s . h .'
    },
    { // 6. Спуск к пастбищу — светлеет
      bpm: 88, div: 2, lead: lead, vol: 0.9,
      melody: [
        'E4 - G4 - C5 - - - | D5 - C5 - A4 - G4 - | E4 - G4 - A4 - C5 - | G4 - - - - - . .',
        'C5 - E5 - G5 - E5 - | F5 - E5 - D5 - C5 - | A4 - C5 - D5 - B4 - | C5 - - - - - - .'
      ],
      bass: 'C3 G3 C4 G3 E3 G3 C4 G3 | F2 C3 F3 C3 A2 C3 F3 C3 | A2 E3 A3 E3 C3 E3 A3 E3 | G2 D3 G3 D3 B2 D3 G3 D3',
      drums: 'k . h . . . h . | k . h . s . h .'
    },
    { // 7. Летнее пастбище — финал
      bpm: 92, div: 2, lead: lead, vol: 0.9,
      melody: [
        'D5 - B4 - G4 - B4 - | C5 - E5 - D5 - - - | E5 - D5 - B4 - A4 - | G4 - - - - - . .',
        'G5 - E5 - D5 - B4 - | C5 - D5 - E5 - G5 - | A5 - G5 - E5 - D5 - | G5 - - - - - - .'
      ],
      bass: 'G2 D3 G3 D3 B2 D3 G3 D3 | C3 G3 C4 G3 E3 G3 C4 G3 | E3 B3 E4 B3 G3 B3 E4 B3 | D3 A3 D4 A3 G2 D3 G3 D3',
      drums: 'k . h . . . h . | k . h . s . h h'
    }
  ];
  A.tracks.otgon = T[0];
  A.otgonTracks = T;
})(window.Arcade = window.Arcade || {});
