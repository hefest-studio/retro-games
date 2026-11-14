/* ЛАЗУТЧИК · i18n (RU/EN). LZ.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var LZ = global.LZ = global.LZ || {};
  LZ.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Сложность', best: 'Рекорд', lives: 'Попытки',
      win: 'МАТРИЦА ДОМА!', gameover: 'ФИЛИН ПОЙМАН',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ЛАЗУТЧИК', subtitle: 'Ночной сторож мастерской «Гефест» по прозвищу Филин',
      sub2: 'Проникни в Ржавый Арсенал · верни матрицу-печать Мастера · заведи будильник в машинном зале',
      hint: '←→ шаг · Shift бег · ↓ присесть (в тени — невидим) · ↑ лестница/рычаг · Пробел рука · C нога · Z предмет · F фонарик',
      back: 'Каталог', diff: 'Сложность', bestTime: 'Лучшее время',
      d1: 'Сторож', d2: 'Обходчик', d3: 'Лазутчик', d4: 'Невидимка', d5: 'Призрак',
      d1s: 'мало стражи, долгий завод будильника', d2s: 'стража бдительнее', d3s: 'изменённые маршруты обходов', d4s: 'больше стражи, короткий завод', d5s: 'стража видит дальше и бьёт больнее',
      z_roof: 'Крыша', z_loft: 'Антресоли склада', z_office: 'Контора', z_store: 'Нижний склад', z_shop: 'Цех', z_mine: 'Шахта', z_assembly: 'Сборочный цех', z_boiler: 'Котельная', z_foundry: 'Литейка', z_engine: 'Машинный зал', z_sewer: 'Канализация',
      hp: 'ЗДОРОВЬЕ', en: 'ЭНЕРГИЯ', time: 'ВРЕМЯ', bomb: 'БУДИЛЬНИК', alarm: 'ТРЕВОГА!', hand: 'в руке',
      c_red: 'красная', c_blue: 'синяя', c_yellow: 'жёлтая',
      i_wrench: 'гаечный ключ', i_brick: 'кирпич', i_crowbar: 'лом', i_washer: 'шайба-звезда',
      k_boxer: 'вахтёр', k_heavy: 'кочегар', k_thrower: 'метальщик', k_dog: 'пёс-автомат',
      m_card: 'Карта: ', m_locked: 'Нужна карта: ', m_grate: 'Решётка заперта с той стороны', m_grateOpen: 'Рычаг — решётка открыта',
      m_matrix: 'МАТРИЦА МАСТЕРА! Теперь — в машинный зал', m_needMatrix: 'Сначала найди матрицу', m_planted: 'БУДИЛЬНИК ЗАВЕДЁН! Беги к водостоку',
      m_short: 'Люк в полу машинного зала — короткий путь в канализацию', m_tired: 'нет сил', m_noItem: 'тут нечего взять',
      m_thermos: 'чай из термоса', m_take: 'тихо!', m_block: 'блок', m_whiff: 'мимо — пёс низко', m_heavy: 'не поднять', m_duck: 'уклон', m_hidden: 'в тени',
      m_cartCall: 'дрезина едет…', m_liftEnd: 'дальше лифт не идёт', m_calm: 'тревога стихла', m_flashOn: 'фонарик: вкл (виден в темноте)', m_flashOff: 'фонарик: выкл',
      m_hint1: 'Присядь у ящиков (↓) — в тени стража не видит', m_hint2: 'Удар сзади по ничего не подозревающему — тихий нокаут',
      brief1: 'Конкуренты из Ржавого Арсенала выкрали матрицу-печать Мастера «Гефеста».',
      brief2: 'Ночной сторож по прозвищу Филин спускается в водосток их подземного завода.',
      brief3: 'Найти матрицу, заложить заводной будильник в машинном зале — и успеть уйти.',
      brief4: 'Пробел / Enter — начать',
      w1: 'Матрица возвращена, конвейер Арсенала встал.', lose_caught: 'Стража скрутила Филина.', lose_ring: 'Будильник прозвенел, а Филин ещё внутри.',
      t_time: 'Время', t_kos: 'Стража в нокауте', t_alarms: 'Тревог', t_new: 'НОВЫЙ РЕКОРД ВРЕМЕНИ!',
      b_punch: 'РУКА', b_kick: 'НОГА', b_item: 'ВЕЩЬ', b_run: 'БЕГ', b_flash: 'СВЕТ',
      foot: '<b>ЛАЗУТЧИК</b> · ← → / A D — шаг · Shift — бег (шумно) · ↓ / S — присесть, красться; на люке — открыть · ↑ / W — лестница, лифт, дрезина, рычаг, заложить будильник · Пробел / X — рука (↑ + рука — бросок) · C / K — нога (↓ + нога — подсечка) · Z — поднять / метнуть предмет · F — фонарик · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Difficulty', best: 'Best', lives: 'Tries',
      win: 'THE DIE IS HOME!', gameover: 'THE OWL IS CAUGHT',
      pause: 'PAUSED', resume: 'Resume', menu: 'Main menu', tapstart: 'space / tap',
      title: 'INFILTRATOR', subtitle: 'The Hephaestus workshop night watchman nicknamed the Owl',
      sub2: 'Sneak into the Rusty Arsenal · recover the Master’s seal die · wind up the alarm clock in the engine hall',
      hint: '←→ step · Shift run · ↓ crouch (hidden in shadow) · ↑ ladder/lever · Space punch · C kick · Z item · F torch',
      back: 'Catalog', diff: 'Difficulty', bestTime: 'Best time',
      d1: 'Watchman', d2: 'Patroller', d3: 'Infiltrator', d4: 'Unseen', d5: 'Phantom',
      d1s: 'few guards, long clock spring', d2s: 'guards are more alert', d3s: 'changed patrol routes', d4s: 'more guards, short clock spring', d5s: 'guards see farther and hit harder',
      z_roof: 'Roof', z_loft: 'Warehouse loft', z_office: 'Front office', z_store: 'Lower store', z_shop: 'Workshop', z_mine: 'Mine shaft', z_assembly: 'Assembly hall', z_boiler: 'Boiler room', z_foundry: 'Foundry', z_engine: 'Engine hall', z_sewer: 'Sewer',
      hp: 'HEALTH', en: 'ENERGY', time: 'TIME', bomb: 'ALARM CLOCK', alarm: 'ALARM!', hand: 'in hand',
      c_red: 'red', c_blue: 'blue', c_yellow: 'yellow',
      i_wrench: 'spanner', i_brick: 'brick', i_crowbar: 'crowbar', i_washer: 'star washer',
      k_boxer: 'gatekeeper', k_heavy: 'stoker', k_thrower: 'nut-thrower', k_dog: 'clockwork hound',
      m_card: 'Card: ', m_locked: 'Card needed: ', m_grate: 'The grate is locked from the other side', m_grateOpen: 'Lever pulled — grate open',
      m_matrix: 'THE MASTER’S DIE! Now to the engine hall', m_needMatrix: 'Find the seal die first', m_planted: 'CLOCK WOUND! Run to the outfall',
      m_short: 'A hatch in the engine hall floor drops into the sewer', m_tired: 'out of breath', m_noItem: 'nothing to pick up', m_thermos: 'tea from the flask', m_take: 'quiet!', m_block: 'block', m_whiff: 'miss — the hound is low', m_heavy: 'too heavy', m_duck: 'ducked', m_hidden: 'in shadow',
      m_cartCall: 'handcar coming…', m_liftEnd: 'the lift goes no further', m_calm: 'alarm is over', m_flashOn: 'torch on (seen in the dark)', m_flashOff: 'torch off',
      m_hint1: 'Crouch by crates (↓) — guards can’t see you in shadow', m_hint2: 'Hit an unaware guard from behind — a silent knockout',
      brief1: 'The rivals from the Rusty Arsenal have stolen the Hephaestus Master’s seal die.',
      brief2: 'A night watchman nicknamed the Owl slips into the outfall of their underground works.',
      brief3: 'Find the die, plant a wind-up alarm clock in the engine hall — and get out in time.',
      brief4: 'Space / Enter — begin',
      w1: 'The die is recovered and the Arsenal conveyor has stopped.', lose_caught: 'The guards have pinned the Owl down.', lose_ring: 'The clock rang while the Owl was still inside.',
      t_time: 'Time', t_kos: 'Guards knocked out', t_alarms: 'Alarms', t_new: 'NEW BEST TIME!',
      b_punch: 'PUNCH', b_kick: 'KICK', b_item: 'ITEM', b_run: 'RUN', b_flash: 'TORCH',
      foot: '<b>INFILTRATOR</b> · ← → / A D — step · Shift — run (noisy) · ↓ / S — crouch, sneak; on a hatch — open · ↑ / W — ladder, lift, handcar, lever, plant the clock · Space / X — punch (↑ + punch — throw) · C / K — kick (↓ + kick — sweep) · Z — pick up / throw an item · F — torch · P / Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
