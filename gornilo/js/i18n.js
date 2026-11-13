/* ГОРНИЛО · i18n (RU/EN). GORNILO.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка, players/touch1p — g.usePlayers; остальные — игре. */
(function (global) {
  'use strict';
  var G = global.GORNILO = global.GORNILO || {};
  G.STR = {
    ru: {
      play: 'Играть', players: 'Игроки', touch1p: 'тач — 1 игрок', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Этап', best: 'Рекорд', win: 'ИСПЫТАНИЕ ПРОЙДЕНО! ВЫ — МАСТЕРА', gameover: 'ГОРНИЛО ОСТЫЛО',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ГОРНИЛО', subtitle: 'Испытание подмастерьев «Гефеста» · два стика · 1–2 игрока',
      back: 'Каталог', p1: 'И1', p2: 'И2', hero_0: 'Окалина', hero_1: 'Зубило',
      stage: 'КРУГ', stageShort: 'Круг', room: 'Комната', roomShort: 'Ком.',
      s_1: 'Литейный двор', s_2: 'Прокатный цех', s_3: 'Сердце горна',
      introSub: 'Двигайся и стреляй раздельно · зачисти арену · выбери ворота',
      b_press: 'КУЗНЕЧНЫЙ ПРЕСС', b_wheel: 'ЖЕРНОВ', b_colossus: 'ГОРН-ИСПОЛИН',
      bossSub: 'Разбей узлы — тогда откроется сердцевина',
      k_crowd: 'толпа', k_blast: 'самоходки', k_turret: 'турели', k_shield: 'щитовики', k_roller: 'катки', k_mixed: 'сборная', k_vault: 'кладовая', k_boss: 'механизм',
      r_weapon: 'оружие', r_gold: 'слитки', r_life: 'жизнь', r_none: '—',
      w_base: 'Клёпочник', w_fan: 'Веер', w_flame: 'Горн', w_grenade: 'Гранаты', w_disc: 'Диски', w_ring: 'Кольцо', w_hammers: 'Молоты',
      wave: 'ВОЛНА', cleared: 'АРЕНА ЗАЧИЩЕНА', choose: 'Выбирай ворота', mapTitle: 'КАРТА ГОРНИЛА', you: 'вы здесь',
      clear: 'КРУГ ПРОЙДЕН', bonus: 'Бонус', coreOpen: 'СЕРДЦЕВИНА ОТКРЫТА!', gold: '+слиток',
      extraLife: '+1 ЖИЗНЬ', out: 'выбыл', lives: 'Жизни',
      cont: 'ПРОДОЛЖИТЬ?', contHint: 'огонь / Enter — снова в горнило', contLeft: 'продолжений', continued: 'ПРОДОЛЖЕНИЕ',
      hint1: 'И1: WASD — ход, стрелки — огонь (8 сторон)',
      hint2: 'И2: Home/Del/End/PgDn — ход, цифр. 8/4/5/6 — огонь · 1/2 — игроки',
      foot: '<b>ГОРНИЛО</b> · И1: WASD — ходьба, стрелки — огонь в 8 сторон (две стрелки — диагональ) · И2: Home/Delete/End/PageDown — ходьба, цифровой блок 8/4/5/6 — огонь (в одиночку работают обе раскладки) · зачисти арену и войди в светящиеся ворота · 1/2 на заставке — игроки · P/Esc пауза · L язык, T тема, M звук. Тач — два стика, 1 игрок.'
    },
    en: {
      play: 'Play', players: 'Players', touch1p: 'touch — 1 player', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Circle', best: 'Best', win: 'TRIAL COMPLETE! YOU ARE MASTERS NOW', gameover: 'THE CRUCIBLE HAS COOLED',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'GORNILO', subtitle: 'The Hefest apprentices’ trial · twin-stick · 1–2 players',
      back: 'Catalog', p1: 'P1', p2: 'P2', hero_0: 'Scale', hero_1: 'Chisel',
      stage: 'CIRCLE', stageShort: 'Circle', room: 'Room', roomShort: 'Rm.',
      s_1: 'Casting Yard', s_2: 'Rolling Mill', s_3: 'Heart of the Forge',
      introSub: 'Move and shoot separately · clear the arena · pick a gate',
      b_press: 'FORGE PRESS', b_wheel: 'GRINDWHEEL', b_colossus: 'FORGE COLOSSUS',
      bossSub: 'Break the limbs — then the core opens',
      k_crowd: 'crowd', k_blast: 'crawlers', k_turret: 'turrets', k_shield: 'shields', k_roller: 'rollers', k_mixed: 'mixed', k_vault: 'vault', k_boss: 'machine',
      r_weapon: 'weapon', r_gold: 'ingots', r_life: 'life', r_none: '—',
      w_base: 'Riveter', w_fan: 'Fan', w_flame: 'Forge flame', w_grenade: 'Grenades', w_disc: 'Discs', w_ring: 'Ring', w_hammers: 'Hammers',
      wave: 'WAVE', cleared: 'ARENA CLEAR', choose: 'Pick a gate', mapTitle: 'CRUCIBLE MAP', you: 'you are here',
      clear: 'CIRCLE COMPLETE', bonus: 'Bonus', coreOpen: 'THE CORE IS OPEN!', gold: '+ingot',
      extraLife: '+1 LIFE', out: 'is out', lives: 'Lives',
      cont: 'CONTINUE?', contHint: 'fire / Enter — back into the crucible', contLeft: 'continues', continued: 'CONTINUE',
      hint1: 'P1: WASD — move, arrows — fire (8 ways)',
      hint2: 'P2: Home/Del/End/PgDn — move, numpad 8/4/5/6 — fire · 1/2 — players',
      foot: '<b>GORNILO</b> · P1: WASD — move, arrows — fire in 8 directions (two arrows — diagonal) · P2: Home/Delete/End/PageDown — move, numpad 8/4/5/6 — fire (solo: both layouts work) · clear the arena and walk into a glowing gate · 1/2 on the title — players · P/Esc pause · L language, T theme, M sound. Touch — twin sticks, 1 player.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
