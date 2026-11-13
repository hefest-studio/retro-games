/* ТЕНЬ · i18n (RU/EN). TEN.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. Тексты кат-сцен — в story.js. */
(function (global) {
  'use strict';
  var TEN = global.TEN = global.TEN || {};
  TEN.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Акт', best: 'Рекорд', lives: 'Жизни',
      win: 'ЧЕРТЕЖИ ВОЗВРАЩЕНЫ!', gameover: 'ТЕНЬ ПОЙМАНА',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', restart: 'Сцена заново (−1 жизнь)', tapstart: 'пробел / тап',
      title: 'ТЕНЬ', subtitle: 'Разведчица мастерской «Гефест» против Ржавого Синдиката',
      sub2: 'Стены, крюк-трос и серп · 6 актов · вернуть похищенные чертежи',
      hint: '←→ бег · Пробел прыжок (у стены — от стены) · X серп · C крюк · ↑+X или V — приём · ↓ подкат',
      back: 'Каталог',
      a1: 'Предместье крыш', a2: 'Котельная', a3: 'Верфь дирижаблей', a4: 'Небесный рейд', a5: 'Часовой архив', a6: 'Башня прожекторов',
      act: 'Акт', scene: 'Сцена', boss: 'БОСС',
      b_foreman: 'Бригадир Клёпа', b_boiler: 'Котёл-Молот', b_crane: 'Кран-Хват', b_harpoon: 'Гарпунёр', b_pendulum: 'Часовщик', b_chancellor: 'Канцлер Ржавь',
      clear: 'СЦЕНА ПРОЙДЕНА', bossDown: 'БОСС ПОВЕРЖЕН', tBonus: 'За время', tTime: 'Время', alarm: 'ТРЕВОГА!', time: 'ВРЕМЯ', charge: 'ЗАРЯД',
      sp_star: 'Звёзды-шестерёнки', sp_smoke: 'Дымовая шашка', sp_whirl: 'Вихрь', sp_fire: 'Огненная полоса',
      i_c5: '+5 заряда', i_c10: '+10 заряда', i_hp: '+здоровье', i_pts: '+500', i_life: '+жизнь!',
      noCharge: 'мало заряда', life: '+жизнь!', parry: 'отбит!',
      cont: 'Продолжить с начала сцены', contHint: 'Enter / пробел — продолжить (счёт сбросится) · Esc — в меню',
      skip: 'Enter / пробел — дальше · Esc — пропустить', theEnd: 'КОНЕЦ',
      t_hook: 'C — крюк за кольцо, Пробел — бросок', t_wall: 'Прыжок у стены — от стены; ↑ — подтянуться', t_duct: '↓ на бегу — подкат в лаз',
      foot: '<b>ТЕНЬ</b> · ← → / A D — бег · Пробел / Z — прыжок (в полёте у стены — цепляется; прыжок — от стены; ↑ — подтянуться на край) · X / J — серп · C / K — крюк-трос (Пробел — бросок, ↑↓ — трос короче/длиннее) · ↑+X или V / Shift — приём за заряд · ↓ — присед, на бегу — подкат · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Act', best: 'Best', lives: 'Lives',
      win: 'BLUEPRINTS RECOVERED!', gameover: 'SHADE IS CAUGHT',
      pause: 'PAUSED', resume: 'Resume', menu: 'Main menu', restart: 'Restart scene (−1 life)', tapstart: 'space / tap',
      title: 'SHADE', subtitle: 'A Hephaestus workshop scout against the Rust Syndicate',
      sub2: 'Walls, grapple line and sickle · 6 acts · recover the stolen blueprints',
      hint: '←→ run · Space jump (wall-jump) · X sickle · C grapple · ↑+X or V — art · ↓ slide',
      back: 'Catalog',
      a1: 'Rooftop Outskirts', a2: 'Boiler Works', a3: 'Airship Dock', a4: 'Sky Raid', a5: 'Clockwork Archive', a6: 'Searchlight Tower',
      act: 'Act', scene: 'Scene', boss: 'BOSS',
      b_foreman: 'Foreman Rivet', b_boiler: 'Boiler Hammer', b_crane: 'Grab Crane', b_harpoon: 'Harpooner', b_pendulum: 'Clockmaster', b_chancellor: 'Chancellor Rust',
      clear: 'SCENE CLEAR', bossDown: 'BOSS DEFEATED', tBonus: 'Time bonus', tTime: 'Time', alarm: 'ALARM!', time: 'TIME', charge: 'CHARGE',
      sp_star: 'Gear stars', sp_smoke: 'Smoke bomb', sp_whirl: 'Whirlwind', sp_fire: 'Fire trail',
      i_c5: '+5 charge', i_c10: '+10 charge', i_hp: '+health', i_pts: '+500', i_life: '+1 life!',
      noCharge: 'low charge', life: '+1 life!', parry: 'parried!',
      cont: 'Continue from scene start', contHint: 'Enter / space — continue (score resets) · Esc — menu',
      skip: 'Enter / space — next · Esc — skip', theEnd: 'THE END',
      t_hook: 'C — grapple a ring, Space — fling', t_wall: 'Jump at a wall — wall-jump; ↑ — pull up', t_duct: '↓ while running — slide into the duct',
      foot: '<b>SHADE</b> · ← → / A D — run · Space / Z — jump (clings to walls in the air; jump — wall-jump; ↑ — pull up onto a ledge) · X / J — sickle · C / K — grapple line (Space — fling, ↑↓ — reel in/out) · ↑+X or V / Shift — charge art · ↓ — crouch, while running — slide · P / Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
