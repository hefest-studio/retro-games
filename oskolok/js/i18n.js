/* ОСКОЛОК · i18n (RU/EN). OSKOLOK.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. Кат-сцены — без слов. */
(function (global) {
  'use strict';
  var O = global.OSKOLOK = global.OSKOLOK || {};
  O.STR = {
    ru: {
      play: 'Новая игра', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Глава', best: 'Рекорд', bestTime: 'Лучшее время', time: 'Время',
      win: 'ДОМОЙ', gameover: 'КОНЕЦ', pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ОСКОЛОК', subtitle: 'Застывший стеклянный город чужого мира',
      sub2: 'Инженер мастерской «Гефест» Вера провалилась в осколок через Звёздный Горн',
      cont: 'Продолжить', restart: 'Эпизод заново', back: 'Каталог', chapter: 'Глава', ep: 'эпизод', deaths: 'Попыток',
      ch1: 'Провал', ch2: 'Город стекла', ch3: 'Зеркальная башня', ch4: 'Тёмные ярусы', ch5: 'Сердце осколка',
      endA: 'Финал «Возвращение»', endB: 'Финал «Отданный свет»', endings: 'Финалы', skip: 'Пробел / тап — пропустить',
      aim: 'Дрон: стрелки — цель · F / Пробел — лететь · клик / тап — сразу в точку',
      h_move: '← → бег · ↑ прыжок', h_drone: 'F — послать дрона-светляка (или клик / тап по экрану)',
      h_lever: '↓ — рычаг', h_shield: 'Удерживай Пробел — стеклянный щит отражает осколки',
      h_breach: 'Удерживай C — заряд резонатора, отпусти — пробой стекла', h_pulse: 'Пробел — импульс резонатора: повернуть зеркало, оглушить, уронить кристалл',
      h_dark: 'Свет дрона отгоняет Теней', h_crystal: 'Подвесной кристалл можно уронить',
      hint: '←→ бег · ↑ прыжок · Пробел импульс/щит · C пробой · F дрон · ↓ рычаг · P пауза',
      foot: '<b>ОСКОЛОК</b> · ← → / A D — бег · ↑ / W / Z — прыжок · Пробел / X / J — резонатор: нажать — импульс, удерживать — стеклянный щит · C / K / Shift — удерживать заряд, отпустить — пробой · F / E — дрон-светляк (стрелки — цель, F — лететь), клик / тап по экрану — дрон в точку, R — вернуть дрона · ↓ / S — рычаг · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'New game', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Chapter', best: 'Best', bestTime: 'Best time', time: 'Time',
      win: 'HOME', gameover: 'THE END', pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'OSKOLOK', subtitle: 'A frozen glass city of an alien realm',
      sub2: 'Vera, an engineer of the Hefest workshop, fell into the shard through the Star Forge',
      cont: 'Continue', restart: 'Restart episode', back: 'Catalog', chapter: 'Chapter', ep: 'episode', deaths: 'Tries',
      ch1: 'The Fall', ch2: 'City of Glass', ch3: 'Mirror Tower', ch4: 'Dark Tiers', ch5: 'Heart of the Shard',
      endA: 'Ending “Return”', endB: 'Ending “Light Given”', endings: 'Endings', skip: 'Space / tap — skip',
      aim: 'Drone: arrows — aim · F / Space — fly · click / tap — straight to the point',
      h_move: '← → run · ↑ jump', h_drone: 'F — send the firefly drone (or click / tap the screen)',
      h_lever: '↓ — lever', h_shield: 'Hold Space — the glass shield reflects shards',
      h_breach: 'Hold C — charge the resonator, release — breach the glass', h_pulse: 'Space — resonator pulse: turn a mirror, stun, drop a crystal',
      h_dark: 'The drone’s light drives Shadows away', h_crystal: 'A hanging crystal can be dropped',
      hint: '←→ run · ↑ jump · Space pulse/shield · C breach · F drone · ↓ lever · P pause',
      foot: '<b>OSKOLOK</b> · ← → / A D — run · ↑ / W / Z — jump · Space / X / J — resonator: tap — pulse, hold — glass shield · C / K / Shift — hold to charge, release — breach · F / E — firefly drone (arrows — aim, F — fly), click / tap the screen — drone to the point, R — recall the drone · ↓ / S — lever · P / Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
