/* ЧАЙНИК · i18n (RU/EN). CHAYNIK.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var CH = global.CHAYNIK = global.CHAYNIK || {};
  CH.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Уровень', best: 'Рекорд', lives: 'Жизни',
      win: 'КРЫШКА ДОМА!', gameover: 'ЧАЙНИК ОСТЫЛ', pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню',
      restart: 'Заново уровень (−1 жизнь)', tapstart: 'пробел / тап', back: 'Каталог',
      title: 'ЧАЙНИК', subtitle: 'Заводной латунный чайник из мастерской «Гефест»',
      sub2: 'Верни украденную Крышку — без неё не закипеть! · 6 уровней',
      hint: '←→ ход · Пробел прыжок · X пар (↑/↓ — прицел) · C кипяток · ↑ у крюка — хват · P пауза',
      steam: 'ПАР', overheat: 'ПЕРЕГРЕВ!', boil: 'КИПЯТОК', boilReady: 'КИПЯТОК — C!', warm: 'ТЕПЛО', rival: 'перечница',
      moves: 'Ходы', pzKeys: 'Стрелки — шаг · X — пар в сторону взгляда · R — заново (без потерь)', swatter: 'МУХОБОЙКА',
      b_sugar: 'Сахарница', b_teapot: 'Заварник', b_creamer: 'Молочник',
      l1: 'Кухонные джунгли', l2: 'Гонка по скатерти', l3: 'Чайная глубина', l4: 'Спящий сахарок', l5: 'Пакетик-аэростат', l6: 'Сервиз',
      g1: 'Вилки-лианы, конфорки и магниты на холодильнике', g2: 'Ножка стола подломилась — скатерть стала горкой! Обгони перечницу',
      g3: 'Чайник тонет: вверх — на горячих пузырях. Береги тепло', g4: 'Перенеси сахарок в чашку и не разбуди. Сначала — будильник!',
      g5: 'Пар в пакетик — и в полёт над плитой', g6: 'Крышка — на голове у Заварника. Фарфор боится кипятка',
      clear: 'УРОВЕНЬ ПРОЙДЕН', tTime: 'Время', tBonus: 'За скорость', tNoDeath: 'Без потерь', tTotal: 'Итого',
      d_boil: 'ВЫКИПЕЛ!', d_crack: 'ТРЕСНУЛ!', d_magnet: 'ПРИЛИП!', d_fall: 'УЛЕТЕЛ ПОД СТОЛ!', d_cold: 'ОСТЫЛ… ХРР…', d_pop: 'ПАКЕТИК ЛОПНУЛ!', d_race: 'ПЕРЕЧНИЦА ПЕРВАЯ!',
      d_woke_crunch: 'ХРУСТ! КРОШКА РАЗБУДИЛА', d_woke_melt: 'САХАРОК РАСТАЯЛ НА КОНФОРКЕ', d_woke_puff: 'ПШШ! ПАР РАЗБУДИЛ', d_woke_alarm: 'ДЗЫНЬ! БУДИЛЬНИК',
      dsub: 'Ещё жизней: {n}', contTitle: 'ПРОДОЛЖИТЬ?', contYes: 'Продолжить ({n})', contNo: 'Закончить', contHint: 'уровень заново, счёт с нуля',
      cp: 'Ложка-отметка', life: '+жизнь!', heart: '+давление', leafFull: 'Кипяток готов!', demag: 'Размагнитил!', grab: 'Хвать!', crackTxt: 'Трещина!', shield: 'Не берёт!',
      stage2: 'Заварник рассвирепел!', lid: 'КРЫШКА!', cooled: 'Остыл — можно пар', noCharge: 'Мало заряда', sugarHint: 'Сахарок', hot3: 'Перегрев — к крану!',
      s_move: '→ иди', s_hook: '↑ у вилки — хват', s_tap: 'кран — остудись', s_magnet: 'магнит! кипяток размагнитит', s_bubble: 'пузыри — вверх', s_warm: 'тепло тает',
      count: 'Старт!', story6: 'Сервиз: Сахарница, Заварник и Молочник — одна шайка',
      foot: '<b>ЧАЙНИК</b> · ← → / A D — ход · Пробел / Z — прыжок · X / J / F — пар (держать; с ↑ / ↓ — вверх / вниз, перегрев!) · C / K — кипяток (по заряду) · ↑ рядом с крюком — хват, Пробел — отпустить · R — заново головоломку · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Level', best: 'Best', lives: 'Lives',
      win: 'THE LID IS HOME!', gameover: 'THE KETTLE WENT COLD', pause: 'PAUSED', resume: 'Resume', menu: 'Main menu',
      restart: 'Restart level (−1 life)', tapstart: 'space / tap', back: 'Catalog',
      title: 'CHAYNIK', subtitle: 'A wind-up brass kettle from the Hefest workshop',
      sub2: 'Get the stolen Lid back — no lid, no boil! · 6 levels',
      hint: '←→ move · Space jump · X steam (↑/↓ aim) · C boil · ↑ by a hook — grab · P pause',
      steam: 'STEAM', overheat: 'OVERHEAT!', boil: 'BOIL', boilReady: 'BOIL — C!', warm: 'WARMTH', rival: 'pepper mill',
      moves: 'Moves', pzKeys: 'Arrows — step · X — steam where you face · R — reset (free)', swatter: 'FLY SWATTER',
      b_sugar: 'Sugar Bowl', b_teapot: 'Brew Pot', b_creamer: 'Creamer',
      l1: 'Kitchen Jungle', l2: 'Tablecloth Race', l3: 'Tea Depths', l4: 'The Sleeping Sugar', l5: 'Teabag Balloon', l6: 'The Tea Set',
      g1: 'Fork vines, burners and fridge magnets', g2: 'A table leg gave way — the tablecloth is a slope! Beat the pepper mill',
      g3: 'Kettles sink: go up on hot bubbles. Keep warm', g4: 'Carry the sugar cube to the cup without waking it. Alarm first!',
      g5: 'Steam into the teabag — and fly over the stove', g6: 'The Lid sits on the Brew Pot. Porcelain fears boiling water',
      clear: 'LEVEL CLEAR', tTime: 'Time', tBonus: 'Speed bonus', tNoDeath: 'No losses', tTotal: 'Total',
      d_boil: 'BOILED DRY!', d_crack: 'CRACKED!', d_magnet: 'STUCK!', d_fall: 'FELL UNDER THE TABLE!', d_cold: 'COLD… SNORE…', d_pop: 'TEABAG POPPED!', d_race: 'PEPPER MILL WINS!',
      d_woke_crunch: 'CRUNCH! A CRUMB WOKE IT', d_woke_melt: 'THE SUGAR MELTED ON A BURNER', d_woke_puff: 'PSSH! STEAM WOKE IT', d_woke_alarm: 'RING! THE ALARM',
      dsub: 'Lives left: {n}', contTitle: 'CONTINUE?', contYes: 'Continue ({n})', contNo: 'Give up', contHint: 'level restarts, score resets',
      cp: 'Spoon checkpoint', life: '+life!', heart: '+pressure', leafFull: 'Boil ready!', demag: 'Demagnetized!', grab: 'Grab!', crackTxt: 'Crack!', shield: 'No effect!',
      stage2: 'The Brew Pot is furious!', lid: 'THE LID!', cooled: 'Cooled — steam OK', noCharge: 'Not charged', sugarHint: 'Sugar', hot3: 'Overheated — to the tap!',
      s_move: '→ go', s_hook: '↑ by a fork — grab', s_tap: 'tap — cool down', s_magnet: 'magnet! boil demagnetizes', s_bubble: 'bubbles — up', s_warm: 'warmth fades',
      count: 'Go!', story6: 'The Tea Set: Sugar Bowl, Brew Pot and Creamer — one gang',
      foot: '<b>CHAYNIK</b> · ← → / A D — move · Space / Z — jump · X / J / F — steam (hold; with ↑ / ↓ — up / down, mind the overheat!) · C / K — boil shot (when charged) · ↑ near a hook — grab, Space — let go · R — reset the puzzle · P / Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
