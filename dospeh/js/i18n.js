/* ДОСПЕХ · i18n (RU/EN). DOSPEH.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре.
   lv_<уровень> — название места, b_<уровень> — страж уровня, w_<оружие>, f_<враг>, d_<причина гибели>. */
(function (global) {
  'use strict';
  var D = global.DOSPEH = global.DOSPEH || {};
  D.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Уровень', best: 'Рекорд', pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      win: 'СЕРДЦЕ ГОРИТ!', gameover: 'ДОСПЕХ ПОВЕРЖЕН',
      title: 'ДОСПЕХ', subtitle: 'Кованый витязь против Ржавого Кощея',
      sub2: 'Кузнец «Гефеста» идёт за украденной Наковальней-Сердцем',
      back: 'Каталог', lives: 'Жизни', cont: 'Прод.', loop1: 'Круг 1', loop2: 'Круг 2',
      armOn: 'ДОСПЕХ', armGold: 'ЗОЛОТОЙ', armOff: 'В ФАРТУКЕ',
      contQ: 'ПРОДОЛЖИТЬ?', contHint: 'пробел — да · Esc — нет', ready: 'В ПУТЬ',
      checkpoint: 'Наковальня-отметка', clear: 'ПУТЬ ОТКРЫТ', bonus: 'за время',
      loopEnd: 'НАКОВАЛЬНЯ-СЕРДЦЕ ХОЛОДНА',
      loopEndText: 'Кощей рассыпался, Сердце вернулось в мастерскую — но не горит.\nРазжечь его может только Молот Горна, а ржавь уже собирает Кощея заново.\nВторой круг: пустоши злее, а в сундуках ждёт Молот Горна.\nТолько им можно разбить ржавый ключ в груди Кощея.',
      tapGo: 'пробел — на второй круг', needHammer: 'Ключ Кощея берёт только Молот Горна!', loopStart: 'ВТОРОЙ КРУГ',
      winText: 'Молот Горна разбил ключ Кощея. Наковальня-Сердце снова горит!',
      armorOff: 'Доспех сбит!', armorUp: 'Новый доспех', goldUp: 'Золотой доспех: держи бросок — особый удар', life: '+1 жизнь',
      trap: 'Ловушка!', charged: 'Удар готов!', hammerGot: 'Молот Горна!', clink: 'дзинь',
      hint: '←→ ход · Пробел/Z прыжок · X бросок (держи в золоте) · ↑↓ лестница/присед · P пауза',
      d_pit: 'Пропасть', d_liquid: 'Сгорел в жиже', d_time: 'Время вышло', d_riser: 'Окалыш', d_blub: 'Бульк', d_kite: 'Коршун', d_vent: 'Свищ', d_brute: 'Шатун',
      d_slag: 'Шлак', d_bubble: 'Пузырь', d_bolt: 'Болт', d_rust: 'Ржавь', d_boss: 'Страж',
      lv_wastes: 'Окалинная пустошь', lv_river: 'Ржавая река', lv_hills: 'Дымные холмы', lv_cave: 'Литейная пещера',
      lv_bridge: 'Цепной мост', lv_tower: 'Башня Кощея', lv_forge: 'Кузня Кощея',
      b_wastes: 'Котельный голем', b_river: 'Ржавый рак', b_hills: 'Медный змей', b_cave: 'Литой голем',
      b_bridge: 'Цепной рак', b_tower: 'Башенный змей', b_forge: 'Ржавый Кощей',
      w_spear: 'Копьё', w_axe: 'Топорик', w_torch: 'Факел', w_blades: 'Клинки-тройка', w_shield: 'Щит-отражатель', w_hammer: 'Молот Горна',
      f_riser: 'Окалыш', f_blub: 'Бульк', f_kite: 'Жестяной коршун', f_vent: 'Свищ', f_brute: 'Шатун',
      foot: '<b>ДОСПЕХ</b> · ← → / A D — ход · Пробел / Z / K — прыжок (дуга не меняется в полёте!) · X / J — бросок, в золотом доспехе удерживай — особый удар · ↑ ↓ — лестница, ↓ — присед · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Level', best: 'Best', pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      win: 'THE HEART BURNS!', gameover: 'THE ARMOR HAS FALLEN',
      title: 'DOSPEKH', subtitle: 'The forged knight vs the Rust Koschei',
      sub2: 'A Hefest smith goes after the stolen Anvil Heart',
      back: 'Catalog', lives: 'Lives', cont: 'Cont.', loop1: 'Round 1', loop2: 'Round 2',
      armOn: 'ARMOR', armGold: 'GOLDEN', armOff: 'IN APRON',
      contQ: 'CONTINUE?', contHint: 'space — yes · Esc — no', ready: 'ONWARD',
      checkpoint: 'Anvil checkpoint', clear: 'THE WAY IS OPEN', bonus: 'time bonus',
      loopEnd: 'THE ANVIL HEART IS COLD',
      loopEndText: 'Koschei crumbled and the Heart is back in the workshop — but it will not burn.\nOnly the Hearth Hammer can kindle it, and the rust is already rebuilding Koschei.\nRound two: the wastes are angrier, and the chests hold the Hearth Hammer.\nOnly it can shatter the rusty key in Koschei\'s chest.',
      tapGo: 'space — start round two', needHammer: 'Only the Hearth Hammer breaks Koschei\'s key!', loopStart: 'ROUND TWO',
      winText: 'The Hearth Hammer shattered Koschei\'s key. The Anvil Heart burns again!',
      armorOff: 'Armor knocked off!', armorUp: 'New armor', goldUp: 'Golden armor: hold throw — special strike', life: '+1 life',
      trap: 'A trap!', charged: 'Strike ready!', hammerGot: 'Hearth Hammer!', clink: 'clink',
      hint: '←→ move · Space/Z jump · X throw (hold in gold) · ↑↓ ladder/crouch · P pause',
      d_pit: 'Pit', d_liquid: 'Burned in the sludge', d_time: 'Time is up', d_riser: 'Slagling', d_blub: 'Blubber', d_kite: 'Tin kite', d_vent: 'Fumarole', d_brute: 'Lumberer',
      d_slag: 'Slag', d_bubble: 'Bubble', d_bolt: 'Bolt', d_rust: 'Rust', d_boss: 'Guardian',
      lv_wastes: 'Scale Wastes', lv_river: 'Rust River', lv_hills: 'Smoke Hills', lv_cave: 'Foundry Cave',
      lv_bridge: 'Chain Bridge', lv_tower: 'Koschei\'s Tower', lv_forge: 'Koschei\'s Forge',
      b_wastes: 'Boiler Golem', b_river: 'Rust Crayfish', b_hills: 'Copper Serpent', b_cave: 'Cast Golem',
      b_bridge: 'Chain Crayfish', b_tower: 'Tower Serpent', b_forge: 'Rust Koschei',
      w_spear: 'Spear', w_axe: 'Hatchet', w_torch: 'Torch', w_blades: 'Triple Blades', w_shield: 'Deflector Shield', w_hammer: 'Hearth Hammer',
      f_riser: 'Slagling', f_blub: 'Blubber', f_kite: 'Tin Kite', f_vent: 'Fumarole', f_brute: 'Lumberer',
      foot: '<b>DOSPEKH</b> · ← → / A D — move · Space / Z / K — jump (the arc is fixed in the air!) · X / J — throw, hold in golden armor — special strike · ↑ ↓ — ladders, ↓ — crouch · P / Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
