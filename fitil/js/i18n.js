/* ФИТИЛЬ · i18n (RU/EN). FITIL.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/players/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var F = global.FITIL = global.FITIL || {};
  F.STR = {
    ru: {
      play: 'Играть', players: 'Игроки', touch1p: 'тач — 1 игрок', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Ур.', best: 'Рекорд', win: 'ЖЕРНОВ РАСКОЛОТ!', gameover: 'ФИТИЛЬ ДОГОРЕЛ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ФИТИЛЬ', subtitle: 'Лабиринт подрывника · 8 уровней + Жернов · 1–2 игрока',
      back: 'Каталог', ff: 'Огонь по своим', lives: 'Жизни',
      ready: 'УРОВЕНЬ', goal: 'Взорви всех врагов — люк откроется', bossGoal: 'Расколи Жернов взрывами — 10 попаданий',
      clear: 'ЛЮК ПРОЙДЕН', bonus: 'Бонус', open: 'ЛЮК ОТКРЫТ', down: 'ПОДРЫВНИК ВЫБЫЛ', life: '+1 ЖИЗНЬ', mill: 'Жернов',
      p1: 'И1', p2: 'И2', out: 'выбыл',
      lv_yard: 'Двор', lv_store: 'Склад', lv_lanes: 'Переулки', lv_cellar: 'Подвал', lv_mine: 'Шахта',
      lv_foundry: 'Литейка', lv_bridge: 'Мост', lv_citadel: 'Цитадель', lv_lair: 'Логово Жернова',
      pw_bomb: 'ЗАРЯД', pw_flame: 'ЖАР', pw_speed: 'ПРЫТЬ', pw_kick: 'ТОЛЧОК', pw_relay: 'РЕЛЕ',
      en_wander: 'Шатун', en_chaser: 'Ищейка', en_ghost: 'Мгла', en_fast: 'Юла',
      hint1: 'И1: стрелки — ход, пробел или / — бомба, . — РЕЛЕ (подрыв)',
      hint2: 'И2: W A S D — ход, F — бомба, G — РЕЛЕ · 1/2 — число игроков',
      foot: '<b>ФИТИЛЬ</b> · И1: стрелки + пробел или / — бомба, . — подрыв РЕЛЕ · И2: WASD + F — бомба, G — подрыв · 1/2 на заставке — игроки · P/Esc пауза · L язык, T тема, M звук. Тач — только И1.'
    },
    en: {
      play: 'Play', players: 'Players', touch1p: 'touch — 1 player', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Lvl', best: 'Best', win: 'MILLSTONE SHATTERED!', gameover: 'THE FUSE BURNED OUT',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'FITIL', subtitle: 'Sapper maze · 8 levels + the Millstone · 1–2 players',
      back: 'Catalog', ff: 'Friendly fire', lives: 'Lives',
      ready: 'LEVEL', goal: 'Blast every enemy — the hatch will open', bossGoal: 'Crack the Millstone with blasts — 10 hits',
      clear: 'HATCH REACHED', bonus: 'Bonus', open: 'HATCH OPEN', down: 'SAPPER DOWN', life: '+1 LIFE', mill: 'Millstone',
      p1: 'P1', p2: 'P2', out: 'out',
      lv_yard: 'Yard', lv_store: 'Storehouse', lv_lanes: 'Back Lanes', lv_cellar: 'Cellar', lv_mine: 'Mine',
      lv_foundry: 'Foundry', lv_bridge: 'Bridge', lv_citadel: 'Citadel', lv_lair: 'Millstone Lair',
      pw_bomb: 'CHARGE', pw_flame: 'HEAT', pw_speed: 'DASH', pw_kick: 'SHOVE', pw_relay: 'RELAY',
      en_wander: 'Shambler', en_chaser: 'Hound', en_ghost: 'Haze', en_fast: 'Whirl',
      hint1: 'P1: arrows — move, space or / — bomb, . — RELAY (detonate)',
      hint2: 'P2: W A S D — move, F — bomb, G — RELAY · 1/2 — player count',
      foot: '<b>FITIL</b> · P1: arrows + space or / — bomb, . — RELAY detonate · P2: WASD + F — bomb, G — detonate · 1/2 on the title — players · P/Esc pause · L language, T theme, M sound. Touch — P1 only.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
