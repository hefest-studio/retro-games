/* ==========================================================================
   Зал ретро-игр — логика каталога.

   • загружает список игр из assets/catalog/games.json (единственный источник
     данных: карточки, жанры, годы, акценты);
   • рисует карточки, фильтры по жанрам и поиск по названию;
   • переключает графику retro ↔ modern (кнопка в шапке + клавиша G),
     запоминает выбор в localStorage и заранее готовит превью второй темы,
     чтобы смена стиля происходила без мигания;
   • учитывает prefers-reduced-motion (анимации отключаются в CSS).

   Без сборки и зависимостей. На file:// fetch недоступен — используется
   встроенный компактный список игр, чтобы каталог открывался двойным щелчком.
   ========================================================================== */
(() => {
  'use strict';

  const THEME_KEY = 'retro-games-catalog-theme';
  /* Язык страницы: RU-главная (/) и EN-главная (/en/) — один скрипт. Язык берём из <html lang>,
     корень сайта относительно страницы — из <html data-base> ('' для /, '../' для /en/). */
  const EN = /^en/i.test(document.documentElement.getAttribute('lang') || '');
  const BASE = document.documentElement.getAttribute('data-base') || '';
  const DATA_URL = `${BASE}assets/catalog/games.json`;
  const THUMB_BASE = `${BASE}assets/catalog/thumbs/`;
  /* Ревизия превью: менять при перегенерации thumbs — сбрасывает кэш браузера и CDN.
     Итоговый ключ = версия игры + ревизия набора превью. */
  const THUMB_REV = '20261120a';

  /* На file:// адреса вида "hrum/" открывают листинг каталога, а не игру,
     поэтому в этом режиме ведём прямо на "hrum/index.html". На http(s)
     остаются относительные ссылки с завершающим слешем (как на Vercel). */
  const IS_FILE = window.location.protocol === 'file:';
  /* С EN-страницы игры открываются по-английски (?lang=en — единое правило движка),
     с RU-страницы — без параметра (язык по умолчанию ru или сохранённый выбор игрока). */
  const gameHref = (slug) => `${BASE}${IS_FILE ? `${slug}/index.html` : `${slug}/`}${EN ? '?lang=en' : ''}`;

  /* Тексты интерфейса каталога (то, что рисует скрипт; статичная разметка — в самих страницах). */
  const UI = EN ? {
    all: 'All',
    play: 'Play',
    coin: 'Insert coin',
    altRetro: 'retro style', altModern: 'neon style', altPreview: 'game preview in',
    modeRetro: '8-bit', modeModern: 'neon',
    toggleToModern: 'The 8-bit retro style is on. Switch to the neon style (G key)',
    toggleToRetro: 'The neon style is on. Switch to the 8-bit retro style (G key)',
    prevPage: 'Previous page', nextPage: 'Next page', page: (n) => `Page ${n}`,
    shownRange: (a, b, n) => `Showing ${a}–${b} of ${n}`,
    shownAll: (n, total) => `Showing ${n} of ${total}`,
  } : {
    all: 'Все',
    play: 'Играть',
    coin: 'Вставь монетку',
    altRetro: 'ретро-стиле', altModern: 'неоновом стиле', altPreview: 'превью игры в',
    modeRetro: '8-бит', modeModern: 'неон',
    toggleToModern: 'Сейчас включён 8-битный ретро-стиль. Переключить на неоновый стиль (клавиша G)',
    toggleToRetro: 'Сейчас включён неоновый стиль. Переключить на 8-битный ретро-стиль (клавиша G)',
    prevPage: 'Предыдущая страница', nextPage: 'Следующая страница', page: (n) => `Страница ${n}`,
    shownRange: (a, b, n) => `Показано ${a}–${b} из ${n}`,
    shownAll: (n, total) => `Показано ${n} из ${total}`,
  };

  /* Поле игры на языке страницы: title_en/subtitle_en/genre_en/summary_en, иначе русское. */
  const loc = (game, key) => String((EN && game[`${key}_en`]) || game[key] || '');
  const devName = (game) => (EN && game.developer === 'Гефест' ? 'Hefest' : String(game.developer || ''));

  /* Резервная копия данных — только для file:// и случаев, когда fetch
     недоступен. Основной источник — games.json. */
  const FALLBACK_GAMES = [
    { slug: 'hrum', title: 'ХРУМ', title_en: 'HRUM', subtitle: 'Лабиринт', subtitle_en: 'Maze', year: 1980, developer: 'Гефест', genre: 'Аркада', genre_en: 'Arcade', tags: ['аркада', 'лабиринт', 'оригинал'], summary: 'Собери все кристаллы в лабиринте, уворачивайся от врагов, лови усилители.', summary_en: 'Collect every crystal in the maze, dodge the enemies and grab power-ups.', accent: '#ffd34d' },
    { slug: 'ruslo', title: 'РУСЛО', title_en: 'RUSLO', subtitle: 'Над рекой', subtitle_en: 'Over the River', year: 1982, developer: 'Гефест', genre: "Shoot'em-up", genre_en: "Shoot'em-up", tags: ['аркада', 'скролл-шутер', 'оригинал'], summary: 'Лети над рекой: мосты, заправки, враги — не промахнись и не кончи топливо.', summary_en: "Fly up the river past bridges, fuel depots and enemies — don't miss, and don't run out of fuel.", accent: '#3ce6a8' },
    { slug: 'krot', title: 'КРОТ', title_en: 'KROT', subtitle: 'Подземные туннели', subtitle_en: 'Underground Tunnels', year: 1983, developer: 'Гефест', genre: 'Аркада', genre_en: 'Arcade', tags: ['аркада', 'подземелье', 'оригинал'], summary: 'Копай туннели, собирай алмазы, роняй мешки золота на монстров.', summary_en: 'Dig tunnels, collect gems and drop gold bags on the monsters.', accent: '#e8833a' },
    { slug: 'staratel', title: 'СТАРАТЕЛЬ', title_en: 'STARATEL', subtitle: 'Обвал в шахте', subtitle_en: 'Mine Cave-in', year: 1983, developer: 'Гефест', genre: 'Головоломка', genre_en: 'Puzzle', tags: ['головоломка', 'подземелье', 'оригинал'], summary: 'Копай ходы, набери норму золота и уйди в выход — роняй валуны на големов.', summary_en: 'Dig passages, meet your gold quota and reach the exit — drop boulders on the golems.', accent: '#f0b429' },
    { slug: 'obval', title: 'ОБВАЛ', title_en: 'OBVAL', subtitle: 'Шахта самоцветов', subtitle_en: 'Gem Shaft', year: 1984, developer: 'Гефест', genre: 'Головоломка', genre_en: 'Puzzle', tags: ['головоломка', 'подземелье', 'оригинал'], summary: 'Рой ходы, собирай алмазы, не попади под обвал камней и светлячков.', summary_en: 'Dig your way through, collect gems and stay clear of falling rocks and fireflies.', accent: '#f2c14e' },
    { slug: 'kaskad', title: 'КАСКАД', title_en: 'CASCADE', subtitle: 'Головоломка', subtitle_en: 'Puzzle', year: 1984, developer: 'Гефест', genre: 'Головоломка', genre_en: 'Puzzle', tags: ['головоломка', 'падающие фигуры', 'оригинал'], summary: 'Складывай падающие фигуры в линии — и не дай стакану переполниться.', summary_en: "Stack the falling pieces into full lines — and don't let the well overflow.", accent: '#36d6ff' },
    { slug: 'rubezh', title: 'РУБЕЖ', title_en: 'RUBEZH', subtitle: 'Неоновый рассвет', subtitle_en: 'Neon Dawn', year: 1987, developer: 'Гефест', genre: 'Run-and-gun', genre_en: 'Run-and-gun', tags: ['run-and-gun', 'экшен', 'оригинал'], summary: 'Пробивайся сквозь орды врагов и боссов: оружие, перекаты, неон.', summary_en: 'Blast through hordes of enemies and bosses: weapons, dodge rolls, neon.', accent: '#ff4d9d' },
    { slug: 'proryv', title: 'ПРОРЫВ', title_en: 'PRORYV', subtitle: 'Штурмовик', subtitle_en: 'Stormtrooper', year: 1987, developer: 'Гефест', genre: 'Run-and-gun', genre_en: 'Run-and-gun', tags: ['run-and-gun', 'экшен', 'оригинал'], summary: 'Пробейся через 5 секторов: стреляй, собирай боеприпасы, дойди до края.', summary_en: 'Fight through five sectors: shoot, pick up ammo and reach the far edge.', accent: '#22e6ff' },
    { slug: 'rubikon', title: 'РУБИКОН', title_en: 'DEEPRISE', subtitle: 'Робот ТАРАН-7', subtitle_en: 'Robot TARAN-7', year: 1987, developer: 'Гефест', genre: 'Аркада', genre_en: 'Arcade', tags: ['аркада', 'робот', 'оригинал'], summary: 'Проведи робота сквозь уровни подземелья к поверхности.', summary_en: 'Guide the robot through dungeon levels up to the surface.', accent: '#ff4fd8' },
    { slug: 'vihr', title: 'ВИХРЬ', title_en: 'VIHR', subtitle: 'Над полем боя', subtitle_en: 'Above the Battlefield', year: 1988, developer: 'Гефест', genre: "Shoot'em-up", genre_en: "Shoot'em-up", tags: ['shoot’em-up', 'экшен', 'оригинал'], summary: 'Вертолёт и джип против волн техники — расчищай небо и землю.', summary_en: 'A helicopter and a jeep take on waves of war machines — clear the skies and the ground.', accent: '#ff8a3d' },
    { slug: 'saga', title: 'СЕВЕРНАЯ САГА', title_en: 'NORTHERN SAGA', subtitle: 'Сага о трёх', subtitle_en: 'A Tale of Three', year: 1992, developer: 'Гефест', genre: 'Платформер', genre_en: 'Platformer', tags: ['головоломка', 'платформер', 'оригинал'], summary: 'Три северянина с разными умениями — проведи всех троих к выходу.', summary_en: 'Three northerners with different skills — get all three of them to the exit.', accent: '#5eead4' },
    { slug: 'neon-yarost', title: 'НЕОН × ЯРОСТЬ', title_en: 'NEON × YAROST', subtitle: 'Neon Yarost', subtitle_en: 'Neon Yarost', year: 1993, developer: 'Гефест', genre: "Beat'em-up", genre_en: "Beat'em-up", tags: ["beat'em-up", 'экшен', 'оригинал'], summary: 'Комета Кай и киборг-кузнец Рок пробиваются сквозь банду в неоновом городе.', summary_en: 'Kai the Comet and Rock the Hammer, a cyborg smith, fight their way through a gang in a neon city.', accent: '#ff2e88' },
    { slug: 'saga-2', title: 'СЕВЕРНАЯ САГА 2', title_en: 'NORTHERN SAGA 2', subtitle: 'Северное сияние', subtitle_en: 'Northern Lights', year: 1997, developer: 'Гефест', genre: 'Платформер', genre_en: 'Platformer', tags: ['головоломка', 'платформер', 'оригинал'], summary: 'Шесть саг полярной ночи: три северянина, новые умения, лёд и механизмы.', summary_en: 'Six sagas of the polar night: three northerners, new skills, ice and machinery.', accent: '#56e0b0' },
    { slug: 'bolt', title: 'БОЛТ', title_en: 'SLAGBREAK', subtitle: 'Побег со Шлак-9', subtitle_en: 'Escape from Slag-9', year: 1993, developer: 'Гефест', genre: 'Run-and-gun', genre_en: 'Run-and-gun', tags: ['run-and-gun', 'платформер', 'оригинал'], summary: 'Робот-наёмник пробивается с планеты Шлак-9: беги, прыгай, стреляй и следи за зарядом батареи.', summary_en: 'A mercenary robot fights its way off the planet Slag-9: run, jump, shoot and keep an eye on your battery.', accent: '#EA6A12' },
    { slug: 'kolobok', title: 'КОЛОБОК', title_en: 'KOLOBOK', subtitle: 'Приключение', subtitle_en: 'Adventure', year: 1991, developer: 'Гефест', genre: 'Головоломка', genre_en: 'Puzzle', tags: ['головоломка', 'платформер', 'оригинал'], summary: 'Катись Колобком по лесным полянам, собирай ягоды и применяй предметы, чтобы найти дорогу домой.', summary_en: 'Roll as Kolobok across forest glades, gather berries and use items to find your way home.', accent: '#f4c84a' },
    { slug: 'plashch', title: 'ПЛАЩ', title_en: 'PLASHCH', subtitle: 'Ночной мститель', subtitle_en: 'Night Avenger', year: 1992, developer: 'Гефест', genre: 'Экшен-платформер', genre_en: 'Action platformer', tags: ['экшен', 'платформер', 'оригинал'], summary: 'Ночной мститель в плаще зачищает Чёрный квартал: сюрикены, присед от пуль, крюк-кошка и бой с Бароном.', summary_en: 'A caped night avenger cleans up the Black Quarter: throwing stars, ducking bullets, a grappling hook and a showdown with the Baron.', accent: '#9b4dff' },
    { slug: 'redut', title: 'РЕДУТ', title_en: 'REDUT', subtitle: 'Оборона базы', subtitle_en: 'Base Defense', year: 1985, developer: 'Гефест', genre: 'Аркада', genre_en: 'Arcade', tags: ['аркада', 'танки', 'оригинал'], summary: 'Обороняй базу-редут от волн вражеских танков: разрушай кирпич, прячься в лесу, лови усилители. Кооп на двоих.', summary_en: 'Defend the redoubt from waves of enemy tanks: smash brick, hide in the woods, grab power-ups. Two-player co-op.', accent: '#6dbe45' },
    { slug: 'zvero-otryad', title: 'ЗВЕРО-ОТРЯД', title_en: 'ZVERO-OTRYAD', subtitle: 'Старая Мастерская', subtitle_en: 'The Old Workshop', year: 1990, developer: 'Гефест', genre: 'Платформер', genre_en: 'Platformer', tags: ['платформер', 'ко-оп', 'оригинал'], summary: 'Ко-оп платформер: ёж Пыж и заяц Тяпа хватают ящики и швыряют их во врагов, расчищая Старую Мастерскую.', summary_en: 'Co-op platformer: Pyzh the hedgehog and Tyapa the hare grab crates and hurl them at enemies to clear the Old Workshop.', accent: '#f5a33c' },
    { slug: 'zvero-otryad-2', title: 'ЗВЕРО-ОТРЯД 2', title_en: 'ZVERO-OTRYAD 2', subtitle: 'Новые уровни', subtitle_en: 'New Levels', year: 1993, developer: 'Гефест', genre: 'Платформер', genre_en: 'Platformer', tags: ['платформер', 'ко-оп', 'сиквел', 'оригинал'], summary: 'Продолжение: тот же движок, новые Ледяные Погреба — хватай ящики и швыряй во врагов. Новый босс — жаба КВАК.', summary_en: 'The sequel: same engine, brand-new Ice Cellars — grab crates and hurl them at enemies. New boss: KVAK the toad.', accent: '#5cc8ff' },
    { slug: 'roy', title: 'РОЙ', title_en: 'BROODLINE', subtitle: 'Захватчики', subtitle_en: 'Invaders', year: 1981, developer: 'Гефест', genre: "Shoot'em-up", genre_en: "Shoot'em-up", tags: ['аркада', 'космос', 'оригинал'], summary: 'Отбейся от роя: строй пришельцев пикирует на корабль, а Медуза лучом утаскивает его в плен.', summary_en: 'Hold the line against the brood: alien formations dive at your ship, and the Jellyfish tries to drag it away with a tractor beam.', accent: '#7c6cff' },
    { slug: 'razrez', title: 'РАЗРЕЗ', title_en: 'RAZREZ', subtitle: 'Захват поля', subtitle_en: 'Field Capture', year: 1984, developer: 'Гефест', genre: 'Аркада', genre_en: 'Arcade', tags: ['аркада', 'территория', 'оригинал'], summary: 'Режь поле на части и забирай территорию, пока шары не задели след.', summary_en: 'Slice the field apart and claim territory before the balls touch your trail.', accent: '#2fd3c3' },
    { slug: 'podkop', title: 'ПОДКОП', title_en: 'PODKOP', subtitle: 'Лестницы и ямы', subtitle_en: 'Ladders and Pits', year: 1984, developer: 'Гефест', genre: 'Аркада', genre_en: 'Arcade', tags: ['лабиринт', 'лестницы', 'ловушки', 'оригинал'], summary: 'Лазай по лестницам и канатам, копай ямы-ловушки для стражи, собери всё золото и уйди по проявившейся лестнице.', summary_en: 'Climb ladders and ropes, dig pit traps for the guards, grab all the gold and escape up the ladder that appears.', accent: '#ff7a59' },
    { slug: 'kladka', title: 'КЛАДКА', title_en: 'MASONRY', subtitle: 'Разбей стену', subtitle_en: 'Break the Wall', year: 1986, developer: 'Гефест', genre: 'Аркада', genre_en: 'Arcade', tags: ['аркада', 'разбивание блоков', 'оригинал'], summary: 'Отбивай раскалённое ядро мастерком, разбери кладку на 10 уровнях и погаси сердце Плавильни.', summary_en: 'Bounce a red-hot core back with your trowel, tear down the masonry over 10 levels and put out the heart of the Smelter.', accent: '#ff8a3d' },
    { slug: 'zaslon', title: 'ЗАСЛОН', title_en: 'ZASLON', subtitle: 'Скролл-шутер', subtitle_en: 'Scrolling Shooter', year: 1994, developer: 'Гефест', genre: "Shoot'em-up", genre_en: "Shoot'em-up", tags: ['аркада', 'космос', 'оригинал'], summary: 'Держи заслон: не пропусти ни одного врага за нижний край, прокачивай корабль за металлолом и разбей пятерых боссов.', summary_en: 'Hold the line: let no enemy slip past the bottom edge, upgrade your ship with scrap and destroy five bosses.', accent: '#ff7a1a' },
    { slug: 'fitil', title: 'ФИТИЛЬ', title_en: 'FITIL', subtitle: 'Лабиринт подрывника', subtitle_en: "Sapper's Maze", year: 1990, developer: 'Гефест', genre: 'Аркада', genre_en: 'Arcade', tags: ['аркада', 'лабиринт', 'кооп', 'оригинал'], summary: 'Ставь бомбы с крестовым взрывом, ломай ящики, собирай бонусы, взорви всех врагов и уходи в люк — 8 уровней и босс в финале, можно вдвоём.', summary_en: 'Plant bombs with cross-shaped blasts, smash crates, collect bonuses, blow up every enemy and escape through the hatch — 8 levels and a final boss, solo or with a friend.', accent: '#e85d3a' },
    { slug: 'katakomby', title: 'КАТАКОМБЫ', title_en: 'KATAKOMBY', subtitle: 'Зачистка подземелий', subtitle_en: 'Dungeon Sweep', year: 1985, developer: 'Гефест', genre: 'Аркада', genre_en: 'Arcade', tags: ['аркада', 'подземелья', 'кооп', 'оригинал'], summary: 'Спустись через 8 этажей катакомб вдвоём или в одиночку: ломай логова, ищи ключи, ешь, чтобы не угаснуть, и одолей Стража Глубин.', summary_en: 'Descend through 8 floors of catacombs, solo or in co-op: smash lairs, find keys, eat to keep from fading and defeat the Deep Warden.', accent: '#f0a64a' },
    { slug: 'yuz', title: 'ЮЗ', title_en: 'YUZ', subtitle: 'Гонки на мини-машинках', subtitle_en: 'Micro-car Racing', year: 1991, developer: 'Гефест', genre: 'Гонки', genre_en: 'Racing', tags: ['гонки', 'вид сверху', 'оригинал', '2 игрока'], summary: 'Мини-машинки на столе мастерской, верстаке, кухне и в саду: занос, лёд и масло, трамплины и чемпионат из 8 трасс против двух соперников.', summary_en: 'Micro cars race across a workshop table, a workbench, a kitchen and a garden: drifts, ice and oil, ramps and an 8-track championship against two rivals.', accent: '#4fc3f7' },
    { slug: 'puzyr', title: 'ПУЗЫРЬ', title_en: 'PUZYR', subtitle: 'Стеклодувы мастерской', subtitle_en: 'Workshop Glassblowers', year: 1986, developer: 'Гефест', genre: 'Платформер', genre_en: 'Platformer', tags: ['платформер', 'кооп', 'оригинал'], summary: 'Подмастерья Колба и Реторта выдувают стеклянные шары, ловят в них врагов и лопают цепочками — 30 уровней и Котёл в финале.', summary_en: 'Apprentices Flask and Retort blow glass bubbles, trap enemies inside and pop them in chains — 30 levels and the Cauldron at the end.', accent: '#ffb347' },
    { slug: 'pereprava', title: 'ПЕРЕПРАВА', title_en: 'PEREPRAVA', subtitle: 'Переход дороги и реки', subtitle_en: 'Road and River Crossing', year: 1981, developer: 'Гефест', genre: 'Аркада', genre_en: 'Arcade', tags: ['аркада', 'тайминг', 'оригинал'], summary: 'Проведи жука-курьера Шурупа через заводской проезд и канал и доставь детали во все 5 ячеек склада за 10 смен.', summary_en: 'Guide Shurup the courier beetle across a factory road and a canal, delivering parts to all 5 warehouse bays over 10 shifts.', accent: '#7bd389' },
    { slug: 'zastava', title: 'ЗАСТАВА', title_en: 'ZASTAVA', subtitle: 'Нашествие ржави', subtitle_en: 'Rust Invasion', year: 1978, developer: 'Гефест', genre: "Shoot'em-up", genre_en: "Shoot'em-up", tags: ['аркада', 'нашествие', 'оригинал'], summary: 'Удержи заставу мастерской: ржавые механизмы идут рядами, коршуны ныряют под щитом, а матку надо вскрыть через вращающийся пояс.', summary_en: 'Hold the workshop outpost: rusty machines march in rows, kites dive under your shield, and the mothership has to be cracked through its spinning belt.', accent: '#9ccc65' },
    { slug: 'sputnik', title: 'СПУТНИК', title_en: 'SPUTNIK', subtitle: 'Корабль и дрон-спутник', subtitle_en: 'Ship and Satellite Drone', year: 1987, developer: 'Гефест', genre: "Shoot'em-up", genre_en: "Shoot'em-up", tags: ['аркада', 'скролл-шутер', 'оригинал'], summary: 'Проведи корабль «Горн» сквозь пояс Окалины: неуязвимый дрон «Наковальня» глотает пули, крепится к носу или корме и улетает вперёд по кнопке.', summary_en: 'Fly the ship Furnace through the Scale belt: the invulnerable Anvil drone soaks up bullets, docks to the nose or tail and launches forward at the press of a button.', accent: '#e0a96d' },
    { slug: 'eskadrilya', title: 'ЭСКАДРИЛЬЯ', title_en: 'ESKADRILYA', subtitle: 'Летучий отряд', subtitle_en: 'The Flying Squad', year: 1984, developer: 'Гефест', genre: "Shoot'em-up", genre_en: "Shoot'em-up", tags: ['скролл-шутер', 'самолёты', 'оригинал'], summary: 'Веди паролёт летучего отряда «Гефеста» над морем и островами, крути петли, собирай звено и топи крейсеры-кузни флотилии Окалины.', summary_en: "Pilot the Hefest flying squad's steam plane over sea and islands, loop the loop, gather your wingmen and sink the Scale flotilla's forge cruisers.", accent: '#5fb3d9' },
    { slug: 'nalyot', title: 'НАЛЁТ', title_en: 'NALYOT', subtitle: 'Run-and-gun на двоих', subtitle_en: 'Two-player Run-and-gun', year: 1996, developer: 'Гефест', genre: 'Run-and-gun', genre_en: 'Run-and-gun', tags: ['run-and-gun', 'кооп', 'боссы', 'оригинал'], summary: 'Ремонтники мастерской «Гефест» против механической банды «Окалина»: 6 миссий, «Котёл» и машины-боссы.', summary_en: 'The Hefest workshop repair crew versus the mechanical Scale gang: 6 missions, the Cauldron and boss machines.', accent: '#e57373' },
    { slug: 'glub', title: 'ГЛУБЬ', title_en: 'GLUB', subtitle: 'Шахта Древнего Горна', subtitle_en: 'The Ancient Forge Mine', year: 1985, developer: 'Гефест', genre: 'Платформер', genre_en: 'Platformer', tags: ['платформер', 'исследование', 'флип-скрин', 'оригинал'], summary: 'Водолаз-рудознатец и механический крот Бурик спускаются в шахту Древнего Горна за восемью кристаллами-ключами.', summary_en: 'A diver-prospector and Burik the mechanical mole descend into the Ancient Forge mine for eight crystal keys.', accent: '#c98b4a' },
    { slug: 'taynik', title: 'ТАЙНИК', title_en: 'TAYNIK', subtitle: 'Лабиринт с верёвками', subtitle_en: 'Rope Maze', year: 1983, developer: 'Гефест', genre: 'Платформер', genre_en: 'Platformer', tags: ['платформер', 'лабиринт', 'верёвки', 'оригинал'], summary: 'Фонарщик Светляк лезет по верёвкам через ярусы старой водонапорной башни, перепрыгивая кислоту и отстреливая обитателей.', summary_en: 'Svetlyak the lamplighter climbs ropes through the tiers of an old water tower, leaping over acid and shooting its inhabitants.', accent: '#7fa7c9' },
    { slug: 'zheoda', title: 'ЖЕОДА', title_en: 'GEODELVE', subtitle: 'Рудознатка в пещерах', subtitle_en: 'Prospector in the Caves', year: 1991, developer: 'Гефест', genre: 'Платформер', genre_en: 'Platformer', tags: ['платформер', 'пещеры', 'головоломка', 'оригинал'], summary: 'Геолог Друза собирает все кристаллы в пещерах-жеодах: рычаги, гравитация, взрывчатка и каменный Исполин в финале.', summary_en: 'Geologist Druza collects every crystal in the geode caves: levers, gravity, explosives and a stone Colossus at the end.', accent: '#b98cff' },
    { slug: 'udalets', title: 'УДАЛЕЦ', title_en: 'UDALETS', subtitle: 'Кубки Мастера в заброшенных цехах', subtitle_en: 'Master Cups in the Abandoned Workshops', year: 1988, developer: 'Гефест', genre: 'Платформер', genre_en: 'Platformer', tags: ['платформер', 'флип-скрин', 'ранец', 'тайники', 'оригинал'], summary: 'Подмастерье-удалец добывает Кубки Мастера: найди Кубок на уровне — и дверь выхода откроется.', summary_en: 'A daring apprentice hunts for the Master Cups: find the Cup on each level and the exit door opens.', accent: '#d6453a' },
    { slug: 'ugolyok', title: 'УГОЛЁК', title_en: 'UGOLYOK', subtitle: 'Робот-кочегар в угольной шахте', subtitle_en: 'Stoker Robot in a Coal Mine', year: 1984, developer: 'Гефест', genre: 'Платформер', genre_en: 'Platformer', tags: ['платформер', 'лабиринт', 'шахта', 'оригинал'], summary: 'Робот-кочегар Уголёк собирает весь уголь в шахте из 48 экранов, чтобы раздуть остывающий Горн мастерской «Гефест».', summary_en: 'Ugolyok the stoker robot collects all the coal in a 48-screen mine to rekindle the cooling forge of the Hefest workshop.', accent: '#ff6b3d' },
    { slug: 'grom', title: 'ГРОМ', title_en: 'STORMCLAD', subtitle: 'Штурмовик в громовой броне', subtitle_en: 'Trooper in Thunder Armor', year: 1990, developer: 'Гефест', genre: 'Run-and-gun', genre_en: 'Run-and-gun', tags: ['run-and-gun', 'исследование', 'лабиринт', 'боссы', 'оригинал'], summary: 'Run-and-gun с исследованием огромных уровней-лабиринтов: штурмовик мастерской «Гефест», луч-кнут, форма-колесо и молнии.', summary_en: 'A run-and-gun with huge maze levels to explore: a Hefest workshop trooper with a whip beam, a wheel form and lightning.', accent: '#8fa8ff' },
    { slug: 'druzhina', title: 'ДРУЖИНА', title_en: 'DRUZHINA', subtitle: 'Дружина «Гефеста» против железной орды', subtitle_en: 'The Hefest War Band vs the Iron Horde', year: 1989, developer: 'Гефест', genre: "Beat'em-up", genre_en: "Beat'em-up", tags: ["beat'em-up", 'фэнтези', 'кооп', 'боссы', 'оригинал'], summary: "Фэнтезийный beat 'em up на двоих: дружина мастерской «Гефест» отбивает Кузнечный тракт у железной орды Чёрного Литейщика — комбо, броски, магия кувшинов и ездовые ящеры.", summary_en: "A two-player fantasy beat 'em up: the Hefest war band wins back the Smiths' Road from the Black Founder's iron horde — combos, throws, jug magic and riding lizards.", accent: '#c9773a' },
    { slug: 'chertog', title: 'ЧЕРТОГ', title_en: 'CHERTOG', subtitle: 'Спасти мастера до рассвета', subtitle_en: 'Save the Master Before Dawn', year: 1989, developer: 'Гефест', genre: 'Платформер', genre_en: 'Platformer', tags: ['платформер', 'кинематографичный', 'фехтование', 'ловушки', 'оригинал'], summary: 'Подмастерье-беглец пробирается через подземный Чертог Медного Наместника, чтобы до рассвета освободить своего учителя.', summary_en: 'A runaway apprentice sneaks through the underground Hall of the Copper Viceroy to free his teacher before dawn.', accent: '#d98a4e' },
    { slug: 'dozor', title: 'ДОЗОР', title_en: 'DOZOR', subtitle: 'Броневики «Гефеста» против Ржавой артели', subtitle_en: 'Hefest Armored Cars vs the Rust Artel', year: 1986, developer: 'Гефест', genre: "Shoot'em-up", genre_en: "Shoot'em-up", tags: ['вид сверху', 'спасение', 'кооп', 'оригинал'], summary: 'Дозорные броневики освобождают пленных мастеровых с заводов механической Ржавой артели — на одного или вдвоём.', summary_en: 'Patrol armored cars free captured craftsmen from the factories of the mechanical Rust Artel — solo or with a friend.', accent: '#a8c256' },
    { slug: 'rikoshet', title: 'РИКОШЕТ', title_en: 'RIKOSHET', subtitle: 'Наковальня против стен из руды', subtitle_en: 'Anvil vs Walls of Ore', year: 1987, developer: 'Гефест', genre: 'Аркада', genre_en: 'Arcade', tags: ['аркада', 'разбивание блоков', 'оригинал'], summary: 'Наковальня мастерской отбивает раскалённую заклёпку и крушит стены из руды, стекла и металла.', summary_en: 'The workshop anvil bats back a red-hot rivet and smashes walls of ore, glass and metal.', accent: '#ff5e1a' },
    { slug: 'liven', title: 'ЛИВЕНЬ', title_en: 'RIVETFALL', subtitle: 'Пулевой ад сквозь ливень заклёпок', subtitle_en: 'Bullet Hell Through a Rain of Rivets', year: 1997, developer: 'Гефест', genre: "Shoot'em-up", genre_en: "Shoot'em-up", tags: ['пулевой ад', 'вертикальный скролл', 'боссы', 'оригинал'], summary: 'Искра-челнок мастерской «Гефест» пролетает сквозь ливень раскалённых заклёпок механических Звонарей-колоколов.', summary_en: 'A Hefest workshop spark-shuttle flies through a downpour of red-hot rivets from the mechanical Bell Ringers.', accent: '#d9a441' },
    { slug: 'oruzheynik', title: 'ОРУЖЕЙНИК', title_en: 'ORUZHEYNIK', subtitle: 'Восемь цехов, восемь Мастеров, один наруч', subtitle_en: 'Eight Workshops, Eight Masters, One Bracer', year: 1988, developer: 'Гефест', genre: 'Экшен-платформер', genre_en: 'Action platformer', tags: ['платформер', 'экшен', 'боссы', 'оружие боссов', 'оригинал'], summary: 'Юный оружейник мастерской «Гефест» отвоёвывает восемь цехов у взбунтовавшихся автоматонов-Мастеров и забирает их оружие.', summary_en: 'A young Hefest armorer wins back eight workshops from rebel automaton Masters and takes their weapons.', accent: '#c8742c' },
    { slug: 'shustrik', title: 'ШУСТРИК', title_en: 'SHUSTRIK', subtitle: 'Хорёк-курьер против Ржавого Лиса', subtitle_en: 'Courier Ferret vs the Rust Fox', year: 1994, developer: 'Гефест', genre: 'Платформер', genre_en: 'Platformer', tags: ['платформер', 'скорость', 'шутер', 'тайники', 'оригинал'], summary: 'Механический хорёк-курьер Шустрик на всех парах догоняет Ржавого Лиса-автоматона, укравшего чертежи мастерской.', summary_en: "Shustrik the mechanical courier ferret races full steam after the Rust Fox, an automaton that stole the workshop's blueprints.", accent: '#ffa62b' },
    { slug: 'podryad', title: 'ПОДРЯД', title_en: 'SKYHIRE', subtitle: 'Скролл-шутер с ангаром', subtitle_en: 'Scrolling Shooter with a Hangar', year: 1994, developer: 'Гефест', genre: "Shoot'em-up", genre_en: "Shoot'em-up", tags: ['скролл-шутер', 'экономика', 'ангар', 'оригинал'], summary: 'Бери заказы мастерской, сбивай машины Ржавой артели, громи цеха на парящих островах и трать заработок в ангаре на орудия, модули и щит.', summary_en: 'Take workshop contracts, shoot down Rust Artel machines, wreck factories on floating islands and spend your earnings in the hangar on guns, modules and shields.', accent: '#4caf8e' },
    { slug: 'dospeh', title: 'ДОСПЕХ', title_en: 'DOSPEKH', subtitle: 'Кованый витязь против Ржавого Кощея', subtitle_en: 'The Forged Knight vs the Rust Koschei', year: 1985, developer: 'Гефест', genre: 'Экшен-платформер', genre_en: 'Action platformer', tags: ['экшен', 'платформер', 'хардкор', 'оригинал'], summary: 'Доспех — это здоровье: первый удар сбивает броню, второй — гибель. Пройди Окалинные пустоши дважды и верни Наковальню-Сердце.', summary_en: 'Your armor is your health: the first hit knocks it off, the second is fatal. Cross the Scale Wastes twice and bring back the Anvil Heart.', accent: '#b8662e' },
    { slug: 'lednik', title: 'ЛЕДНИК', title_en: 'RIMETRAIL', subtitle: 'Искра и песец Бураш против Великой Стужи', subtitle_en: 'Iskra and Burash the Arctic Fox vs the Great Cold', year: 1992, developer: 'Гефест', genre: 'Платформер', genre_en: 'Platformer', tags: ['платформер', 'карта мира', 'лёд', 'оригинал'], summary: 'Девочка-охотница Искра с костяным бумерангом и её песец Бураш собирают припасы племени, пока с севера не пришла Великая Стужа.', summary_en: 'Young huntress Iskra, armed with a bone boomerang, and her arctic fox Burash gather supplies for the tribe before the Great Cold sweeps in from the north.', accent: '#8fd8ff' },
    { slug: 'gornilo', title: 'ГОРНИЛО', title_en: 'GORNILO', subtitle: 'Аренный шутер на двоих', subtitle_en: 'Two-player Arena Shooter', year: 1990, developer: 'Гефест', genre: "Shoot'em-up", genre_en: "Shoot'em-up", tags: ['арена', 'два стика', 'вид сверху', 'кооп', 'оригинал'], summary: 'Испытание Горнила: подмастерья «Гефеста» зачищают арены-кузни от толп механических заготовок, двигаясь и стреляя раздельно.', summary_en: 'The Crucible trial: Hefest apprentices clear forge arenas of mechanical blank swarms, moving and shooting independently.', accent: '#f2703a' },
    { slug: 'tsep', title: 'ЦЕПЬ', title_en: 'TSEP', subtitle: 'Звонарь в башне Остановленных Часов', subtitle_en: 'Bell Ringer in the Tower of Stopped Clocks', year: 1987, developer: 'Гефест', genre: 'Экшен-платформер', genre_en: 'Action platformer', tags: ['экшен-платформер', 'цепь', 'маятники', 'оригинал'], summary: 'Звонарь-обходчик мастерской «Гефест» с цепью-кистенём поднимается по башне Остановленных Часов к Часовому Сердцу, чтобы снова запустить время.', summary_en: 'A Hefest bell-ringer with a chain flail climbs the Tower of Stopped Clocks to the Clock Heart to set time running again.', accent: '#d8b25a' },
    { slug: 'ten', title: 'ТЕНЬ', title_en: 'DUSKHOOK', subtitle: 'Акробатика на стенах и крюке', subtitle_en: 'Acrobatics on Walls and Hooks', year: 1990, developer: 'Гефест', genre: 'Экшен-платформер', genre_en: 'Action platformer', tags: ['экшен', 'платформер', 'акробатика', 'оригинал'], summary: 'Разведчица Тень с серпом на тросе проникает в цитадель Ржавого Синдиката: прыжки от стены к стене, раскачка на крюке, прожекторы и стражи.', summary_en: "Scout Duskhook, armed with a sickle on a cable, infiltrates the Rust Syndicate's citadel: wall jumps, hook swings, searchlights and guards.", accent: '#6fd38c' },
    { slug: 'skok', title: 'СКОК', title_en: 'SKOK', subtitle: 'Прыжки, костюмы и карта Заплатных земель', subtitle_en: 'Jumps, Costumes and the Patchwork Lands Map', year: 1988, developer: 'Гефест', genre: 'Платформер', genre_en: 'Platformer', tags: ['платформер', 'карта мира', 'костюмы', 'оригинал'], summary: 'Лис-лудильщик Скок из мастерской «Гефест» прыгает по врагам, меняет костюмы и звонит в колокола часовен, собирая разбежавшиеся детали Большого Часового Механизма.', summary_en: 'Skok the tinker fox from the Hefest workshop stomps enemies, swaps costumes and rings chapel bells to gather the scattered parts of the Great Clockwork.', accent: '#e2672f' },
    { slug: 'posokh', title: 'ПОСОХ', title_en: 'POSOKH', subtitle: 'Бабушка Ярослава и пять Ключей Звездочёта', subtitle_en: 'Granny Yaroslava and the Five Stargazer Keys', year: 1989, developer: 'Гефест', genre: 'Платформер', genre_en: 'Platformer', tags: ['платформер', 'пого', 'экспедиции', 'оригинал'], summary: 'Бабушка-картограф Ярослава с окованным посохом-пружиной ищет пять Ключей Звездочёта, чтобы открыть заброшенную обсерваторию.', summary_en: 'Cartographer Granny Yaroslava, with her iron-shod spring staff, hunts for the five Stargazer Keys to open an abandoned observatory.', accent: '#d39b2a' },
    { slug: 'chaynik', title: 'ЧАЙНИК', title_en: 'CHAYNIK', subtitle: 'Заводной чайник против Сервиза', subtitle_en: 'Wind-up Kettle vs the Tea Set', year: 1994, developer: 'Гефест', genre: 'Платформер', genre_en: 'Platformer', tags: ['платформер', 'юмор', 'экшен', 'оригинал'], summary: 'Заводной латунный чайник из мастерской «Гефест» ожил и отправился вернуть украденную Крышку — без неё ему не закипеть.', summary_en: 'A wind-up brass kettle from the Hefest workshop comes to life and sets out to recover its stolen Lid — without it, it can never boil.', accent: '#e05d8a' },
    { slug: 'list', title: 'ЛИСТ', title_en: 'SHEET', subtitle: 'Печатник против клякс в недопечатанной книге', subtitle_en: 'Printer vs Ink Blots in an Unfinished Book', year: 1995, developer: 'Гефест', genre: "Beat'em-up", genre_en: "Beat'em-up", tags: ["beat'em-up", 'головоломки', 'комикс', 'оригинал'], summary: 'Печатник-гравёр Литер из мастерской «Гефест» затянут в недопечатанную книгу-лубок и пробивается панель за панелью сквозь кляксы, чернильных стражей и Злого Корректора.', summary_en: 'Liter, an engraver-printer from the Hefest workshop, is pulled into an unfinished picture book and fights panel by panel through ink blots, ink guards and the Wicked Proofreader.', accent: '#5a7be0' },
    { slug: 'taran', title: 'ТАРАН', title_en: 'TARAN', subtitle: 'Боевые гонки паровых самоходов', subtitle_en: 'Steam-car Combat Racing', year: 1992, developer: 'Гефест', genre: 'Гонки', genre_en: 'Racing', tags: ['боевые гонки', 'вид сверху', 'апгрейды', 'кооп', 'оригинал'], summary: 'Кубок Заводских Дворов: паровые самоходы мастерских гоняют по цехам, крышам, рельсам и складам — с заклёпочниками, ракетами, маслом и таранами.', summary_en: 'The Factory Yards Cup: workshop steam cars race through shops, over rooftops, rails and warehouses — with rivet guns, rockets, oil slicks and ramming.', accent: '#e9573f' },
    { slug: 'vzvod', title: 'ВЗВОД', title_en: 'VZVOD', subtitle: 'Отряд ремонтников против Ржавого Улья', subtitle_en: 'Repair Squad vs the Rust Hive', year: 1993, developer: 'Гефест', genre: 'Аркада', genre_en: 'Arcade', tags: ['экшен-тактика', 'вид сверху', 'оригинал'], summary: 'Веди дружину заводных болванчиков гуськом, жги механизмы паяльниками и взрывай ульи шестернями.', summary_en: 'Lead a single-file squad of clockwork dummies, torch machines with soldering irons and blow up hives with gears.', accent: '#8bd450' },
    { slug: 'paroviki', title: 'ПАРОВИКИ', title_en: 'PAROVIKI', subtitle: 'Стимпанк-экшен на двоих с ИИ-напарником', subtitle_en: 'Two-player Steampunk Action with an AI Partner', year: 1993, developer: 'Гефест', genre: "Shoot'em-up", genre_en: "Shoot'em-up", tags: ['вид сверху', 'стимпанк', 'ИИ-напарник', 'кооп', 'оригинал'], summary: 'Два паровика-подрядчика «Гефеста» открывают узлы-вентили в лабиринтах и гасят взбесившуюся Паровую Машину Губернии; играешь один — второго героя ведёт ИИ-напарник.', summary_en: "Two Hefest steam contractors open valve hubs in mazes and shut down the province's runaway Steam Machine; play solo and an AI partner controls the second hero.", accent: '#e0b04c' },
    { slug: 'otsek', title: 'ОТСЕК', title_en: 'OTSEK', subtitle: 'Коридорный шутер на двоих', subtitle_en: 'Two-player Corridor Shooter', year: 1991, developer: 'Гефест', genre: "Shoot'em-up", genre_en: "Shoot'em-up", tags: ['вид сверху', 'коридоры', 'темнота', 'кооп', 'оригинал'], summary: 'Ремонтная бригада «Гефеста» с фонарями пробивается по тёмным палубам станции-кузни «Наковальня-7», экономя патроны и ключ-карты, и успевает к шлюзу до самоуничтожения.', summary_en: 'A Hefest repair crew with flashlights fights through the dark decks of the forge station Anvil-7, saving ammo and key cards, and reaches the airlock before self-destruct.', accent: '#d6e04f' },
    { slug: 'sosedi', title: 'СОСЕДИ', title_en: 'SOSEDI', subtitle: 'Заводной Цирк сбежал — спасайте соседей!', subtitle_en: 'The Clockwork Circus Has Escaped — Save the Neighbors!', year: 1993, developer: 'Гефест', genre: 'Аркада', genre_en: 'Arcade', tags: ['экшен', 'вид сверху', 'юмор', 'кооп', 'оригинал'], summary: 'Ася и Тимоша из мастерской спасают соседей от оживших игрушек водяным пистолетом, краской, пирожками, пузырями и фейерверком.', summary_en: 'Asya and Timosha from the workshop rescue their neighbors from runaway toys with a water pistol, paint, pies, bubbles and fireworks.', accent: '#ff7eb6' },
    { slug: 'oskolok', title: 'ОСКОЛОК', title_en: 'OSKOLOK', subtitle: 'Застывший стеклянный город чужого мира', subtitle_en: 'A Frozen Glass City in an Alien World', year: 1991, developer: 'Гефест', genre: 'Экшен-платформер', genre_en: 'Action platformer', tags: ['кинематографичный', 'sci-fi', 'головоломки', 'оригинал'], summary: 'Инженер мастерской «Гефест» Вера проваливается через Звёздный Горн в осколок чужого мира — застывший город из стекла — и ищет путь домой с резонатором и дроном-светляком.', summary_en: 'Vera, a Hefest workshop engineer, falls through the Star Forge into a shard of an alien world — a frozen city of glass — and searches for a way home with a resonator and a firefly drone.', accent: '#7ee8fa' },
    { slug: 'operatsiya', title: 'ОПЕРАЦИЯ', title_en: 'OPERATSIYA', subtitle: 'Пошаговая тактика ремонтной бригады', subtitle_en: 'Turn-based Tactics for a Repair Crew', year: 1988, developer: 'Гефест', genre: 'Тактика', genre_en: 'Tactics', tags: ['тактика', 'пошаговая', 'вид сверху', 'оригинал'], summary: 'Шесть механиков мастерской с инструментами-излучателями шаг за шагом отбивают Завод-Город у автоматонов: очки действия, укрытия, туман и реакционный огонь.', summary_en: 'Six workshop mechanics armed with tool-emitters retake Factory City from the automatons step by step: action points, cover, fog of war and reaction fire.', accent: '#64b5f6' },
    { slug: 'lazutchik', title: 'ЛАЗУТЧИК', title_en: 'OWLSTEP', subtitle: 'Ночная вылазка в Ржавый Арсенал', subtitle_en: 'Night Raid on the Rust Arsenal', year: 1985, developer: 'Гефест', genre: 'Экшен', genre_en: 'Action', tags: ['экшен', 'стелс', 'рукопашка', 'оригинал'], summary: 'Ночной сторож Филин крадётся по подземному заводу конкурентов: тени ящиков, конусы взгляда стражи, рукопашка и будильник в машинном зале.', summary_en: "Night watchman Owl sneaks through a rival's underground factory: crate shadows, guards' vision cones, hand-to-hand fights and an alarm clock in the engine room.", accent: '#e0a23a' },
    { slug: 'sborka', title: 'СБОРКА', title_en: 'SBORKA', subtitle: 'Собери робота — отбей Долину Заводов', subtitle_en: 'Build a Robot — Win Back the Factory Valley', year: 1987, developer: 'Гефест', genre: 'Стратегия', genre_en: 'Strategy', tags: ['стратегия', 'реальное время', 'роботы', 'оригинал'], summary: 'С дирижабля «Наковальня» вы собираете роботов из модулей, отдаёте им приказы и отбиваете заводы долины у Ржавой Артели.', summary_en: "From the airship Anvil you build robots out of modules, give them orders and win back the valley's factories from the Rust Artel.", accent: '#c45ab3' },
    { slug: 'podgorye', title: 'ПОДГОРЬЕ', title_en: 'PODGORYE', subtitle: 'Разожги пять Спящих Горнов', subtitle_en: 'Kindle the Five Sleeping Forges', year: 1994, developer: 'Гефест', genre: 'Экшен-платформер', genre_en: 'Action platformer', tags: ['открытый мир', 'приключение', 'боссы', 'оригинал'], summary: 'Фонарщица Огнёвка с фонарём-искрой спускается в Подгорье — заброшенный город древних Кузнецов под мастерской «Гефест» — чтобы разжечь пять Спящих Горнов.', summary_en: 'Lamplighter Ognyovka, carrying a spark lantern, descends into Podgorye — the abandoned city of the ancient Smiths beneath the Hefest workshop — to kindle the five Sleeping Forges.', accent: '#d96a2b' },
    { slug: 'kvest', title: 'МАЯЧНИЦА', title_en: 'MAYACHNITSA', subtitle: 'Демо: глава 1 «Погасший маяк»', subtitle_en: 'Demo: Chapter 1 “The Dark Lighthouse”', year: 1997, developer: 'Гефест', genre: 'Приключение', genre_en: 'Adventure', tags: ['приключение', 'головоломки', 'без слов', 'демо', 'оригинал'], summary: 'В шторм погас маяк, рыбацкие лодки не могут вернуться. Подмастерье Тая собирает линзу, фитиль, масло и огонь, чтобы снова зажечь свет. Рисованное приключение без слов.', summary_en: "A storm has put out the lighthouse and the fishing boats can't get home. Apprentice Taya gathers a lens, a wick, oil and fire to light the beacon again. A hand-drawn adventure without words.", accent: '#e8a25c' },
    { slug: 'desant', title: 'ДЕСАНТ', title_en: 'SOOTBREAKERS', subtitle: 'Кооперативный run-and-gun', subtitle_en: 'Co-op Run-and-gun', year: 1989, developer: 'Гефест', genre: 'Run-and-gun', genre_en: 'Run-and-gun', tags: ['вид сверху', 'скролл', 'кооп', 'танкетка', 'оригинал'], summary: 'Десант мастерской «Гефест» в маскхалатах-штормовках пешком пробивается на север через посты сажевиков — тайга, топи, каменоломня, пороги и старая крепость мастеровых.', summary_en: "The Hefest workshop drop team, in storm-proof camo, marches north on foot through Sooter outposts — taiga, swamps, a quarry, rapids and an old craftsmen's fortress.", accent: '#ea6a12' },
    { slug: 'otboynik', title: 'ОТБОЙНИК', title_en: 'BUMPERWRIGHT', subtitle: 'Пинбол-оборона мастерской', subtitle_en: 'Workshop Pinball Defense', year: 1990, developer: 'Гефест', genre: 'Pinball', genre_en: 'Pinball', tags: ['пинбол', 'оборона', 'колода', 'роглайт', 'оригинал'], summary: 'Заводные механизмы сбежали с верстаков и ползут к воротам мастерской — мастеровой отбивает их стальным шаром двумя флипперами и между волнами строит на столе горн, колокольню и пружинные стенки.', summary_en: 'Clockwork contraptions have escaped the workbenches and are crawling toward the workshop gates — a craftsman knocks them back with a steel ball and two flippers, and between waves builds a forge, a bell tower and spring walls on the table.', accent: '#e0a33a' },
    { slug: 'priisk', title: 'ПРИИСК', title_en: 'PRIISK', subtitle: 'Стратегия в реальном времени · Демо', subtitle_en: 'Real-time Strategy · Demo', year: 1995, developer: 'Гефест', genre: 'RTS', genre_en: 'RTS', tags: ['стратегия', 'база и экономика', 'пар и медь', 'кампания', 'оригинал', 'демо'], summary: 'Две артели старателей делят северное медное плато: ставь котельные и плавильню, гоняй рудовозы, собирай стрелков и самоходы на пару — и снеси Контору соседей.', summary_en: "Two prospector artels fight over a northern copper plateau: build boiler houses and a smelter, run ore carts, raise riflemen and steam walkers — and raze the neighbors' Office.", accent: '#e0a53a' },
    { slug: 'porubezhye', title: 'ПОРУБЕЖЬЕ', title_en: 'PORUBEZHYE', subtitle: 'Стратегия с асимметричными расами · Демо', subtitle_en: 'Strategy with Asymmetric Factions · Demo', year: 1996, developer: 'Гефест', genre: 'RTS', genre_en: 'RTS', tags: ['стратегия', 'две расы', 'грибница', 'туман войны', 'оригинал', 'демо'], summary: 'Сказочный северный порубежный край: Мастеровые с медью и шагоходами против Живой чащи, что растит здания на грибнице. Выбери расу и отстой заставу.', summary_en: 'A fairy-tale northern borderland: the Craftsmen with copper and walkers versus the Living Thicket, which grows its buildings on mycelium. Pick a faction and defend your outpost.', accent: '#e8913a' },
    { slug: 'volok', title: 'ВОЛОК', subtitle: 'Изба-мастерская на колёсах и на воде', year: 1994, developer: 'Гефест', genre: "Приключение", tags: ['медитативная', 'без слов', 'вид сбоку', 'головоломки', 'оригинал'], summary: 'Подмастерье ведёт изнутри избу-мастерскую на колёсах через тундру, реку и берег, где она становится судном, — сквозь шторм и под льдами колоколом к зимовью.', title_en: 'KETTLEWAKE', subtitle_en: 'A Workshop Hut on Wheels — and on Water', genre_en: 'Adventure', summary_en: 'An apprentice runs a workshop hut on wheels from the inside — across tundra and river to the shore, where it becomes a boat, then through a storm and under the ice as a diving bell to the winter camp.', accent: '#f0a04b' },
    { slug: 'otgon', title: 'ОТГОН', subtitle: 'Стадо ветроногов через северные перевалы', year: 1995, developer: 'Гефест', genre: "Приключение", tags: ['перегон стада', 'без слов', 'медитативная', 'вид сверху', 'оригинал'], summary: 'Подпасок мастерской ведёт стадо длинноногих ветроногов через броды, перевалы и непогоду к летнему пастбищу: свист собирает, посох направляет.', title_en: 'WINDSHANKS', subtitle_en: 'A Herd of Stilt-Legged Woollies Across the Northern Passes', genre_en: 'Adventure', summary_en: 'The workshop\'s herd-boy drives a herd of stilt-legged windshanks across fords, passes and bad weather to the summer pasture: the whistle gathers, the staff points the way.', accent: '#6fbf73' },
    { slug: 'poluustav', title: 'ПОЛУУСТАВ', subtitle: 'Ученик переписчика внутри рукописи', year: 1995, developer: 'Гефест', genre: "Пазл-платформер", tags: ['атмосферная', 'без слов', 'вид сбоку', 'головоломки', 'тушь', 'оригинал'], summary: 'Ученик переписчика бредёт по семи страницам старой рукописи, нарисованной тушью: ящики, верёвки, противовесы, вода; песок сушит кляксы, перо дорисовывает мосты, наброски твердеют в свете лампады.', title_en: 'GALLWICK', subtitle_en: 'A Scribe’s Apprentice Within the Manuscript', genre_en: 'Puzzle Platformer', summary_en: 'A scribe’s apprentice wanders seven pages of an old ink-drawn manuscript: crates, ropes, counterweights and water; sand dries the blots, the quill draws bridges, and sketches turn solid in the lamp’s light.', accent: '#b4442b' }
  ];

  const root = document.documentElement;

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

  const els = {
    grid: $('#game-grid'),
    filters: $('#genre-filters'),
    search: $('#game-search'),
    results: $('#results'),
    empty: $('#empty-state'),
    reset: $('#reset-filters'),
    pager: $('#pager'),
    perPage: $('#per-page'),
    toggle: $('#theme-toggle'),
    toggleMode: $('#theme-mode'),
    random: $('#random-game'),
    catalogCount: $('#catalog-count'),
    catalogYears: $('#catalog-years'),
    heroGames: $('#hero-games'),
    metaTheme: $('meta[name="theme-color"]'),
  };

  const state = {
    theme: 'retro',
    genre: 'all',
    query: '',
    page: 1,
    perPage: 15,
    games: [],
    cards: [],
  };

  const scheduleIdle = (task) => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(task, { timeout: 1400 });
    } else {
      window.setTimeout(task, 180);
    }
  };

  /* ---------- утилиты ---------- */

  const normalize = (value) => String(value || '')
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();

  const thumbBust = (game) => `?v=${encodeURIComponent(game.version || '0')}-${THUMB_REV}`;
  const thumbSrc = (game, theme) => {
    const fromData = game.thumb && game.thumb[theme];
    if (typeof fromData === 'string' && fromData.trim()) return BASE + fromData.replace(/^\/+/, '').replace(/\?.*$/, '') + thumbBust(game);
    return `${THUMB_BASE}${game.slug}-${theme}.webp${thumbBust(game)}`;
  };

  const cardAlt = (game, theme) => `${loc(game, 'title')} — ${UI.altPreview} ${theme === 'modern' ? UI.altModern : UI.altRetro}`;

  const pluralGames = (count) => {
    if (EN) return count === 1 ? 'game' : 'games';
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'игра';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'игры';
    return 'игр';
  };

  /* ---------- тема ---------- */

  const storedTheme = () => {
    try {
      const stored = window.localStorage.getItem(THEME_KEY);
      return stored === 'modern' ? 'modern' : 'retro';
    } catch (error) {
      return root.getAttribute('data-theme') === 'modern' ? 'modern' : 'retro';
    }
  };

  function applyTheme(theme, options = {}) {
    const next = theme === 'modern' ? 'modern' : 'retro';
    const modern = next === 'modern';
    const changed = state.theme !== next;
    state.theme = next;

    root.setAttribute('data-theme', next);

    if (els.metaTheme) els.metaTheme.setAttribute('content', modern ? '#070912' : '#06070b');

    if (els.toggle) {
      els.toggle.setAttribute('aria-pressed', String(modern));
      els.toggle.setAttribute('aria-label', modern ? UI.toggleToRetro : UI.toggleToModern);
    }
    if (els.toggleMode) els.toggleMode.textContent = modern ? UI.modeModern : UI.modeRetro;

    if (state.cards.length) {
      state.cards.forEach(({ game, img }) => {
        const source = thumbSrc(game, next);
        if (img.getAttribute('src') !== source) img.setAttribute('src', source);
        img.setAttribute('alt', cardAlt(game, next));
        /* После явного переключения превью нужны сразу — не ждём скролла. */
        if (changed) img.loading = 'eager';
      });
    }

    if (options.persist) {
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch (error) { /* приватный режим — переключаемся без запоминания */ }
    }
  }

  function toggleTheme() {
    applyTheme(state.theme === 'modern' ? 'retro' : 'modern', { persist: true });
  }

  /* Заранее грузим превью второй темы: это и есть «без мигания». */
  function preloadThemeImages(theme) {
    state.games.forEach((game) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = thumbSrc(game, theme);
      if (typeof image.decode === 'function') image.decode().catch(() => {});
    });
  }

  /* ---------- карточки ---------- */

  function buildCard(game, number) {
    const item = document.createElement('li');
    item.className = 'card';

    const accent = String(game.accent || '');
    if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(accent)) {
      item.style.setProperty('--game-accent', accent);
      item.style.setProperty('--game-accent-soft', `${accent}40`);
    }

    const link = document.createElement('a');
    link.className = 'card-link';
    link.href = gameHref(game.slug);
    link.setAttribute(
      'aria-label',
      `${loc(game, 'title')} — ${loc(game, 'subtitle')}. ${loc(game, 'genre')}, ${game.year}. ${UI.play}`,
    );

    const top = document.createElement('div');
    top.className = 'card-top';

    const num = document.createElement('span');
    num.className = 'card-num';
    num.textContent = `#${String(number).padStart(2, '0')}`;

    const swatch = document.createElement('span');
    swatch.className = 'card-swatch';

    const genre = document.createElement('span');
    genre.className = 'card-genre';
    genre.textContent = loc(game, 'genre');

    const year = document.createElement('span');
    year.className = 'card-year';
    year.textContent = String(game.year || '');

    top.append(num, swatch, genre, year);

    const shot = document.createElement('div');
    shot.className = 'card-shot';

    const img = document.createElement('img');
    img.className = 'card-img';
    img.width = 720;
    img.height = 405;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = thumbSrc(game, state.theme);
    img.alt = cardAlt(game, state.theme);

    const coin = document.createElement('div');
    coin.className = 'card-coin';
    coin.setAttribute('aria-hidden', 'true');
    coin.textContent = UI.coin;

    shot.append(img, coin);

    const body = document.createElement('div');
    body.className = 'card-body';

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = loc(game, 'title');

    const subtitle = document.createElement('div');
    subtitle.className = 'card-sub';
    subtitle.textContent = loc(game, 'subtitle');

    const summary = document.createElement('p');
    summary.className = 'card-summary';
    summary.textContent = loc(game, 'summary');

    body.append(title, subtitle, summary);

    const foot = document.createElement('div');
    foot.className = 'card-foot';

    const developer = document.createElement('span');
    developer.className = 'card-dev';
    developer.textContent = devName(game);
    developer.title = devName(game);

    const play = document.createElement('span');
    play.className = 'card-play';
    play.textContent = UI.play;

    foot.append(developer, play);

    link.append(top, shot, body, foot);
    item.append(link);

    return { item, img };
  }

  function buildChip(label, value) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = label;
    chip.dataset.genre = value;
    chip.dataset.filterGenre = value;
    chip.setAttribute('aria-pressed', String(state.genre === value));
    return chip;
  }

  function buildFilters() {
    const genres = [];
    state.games.forEach((game) => {
      const genre = loc(game, 'genre');
      if (genre && !genres.includes(genre)) genres.push(genre);
    });

    const fragment = document.createDocumentFragment();
    fragment.append(buildChip(UI.all, 'all'));
    genres.forEach((genre) => fragment.append(buildChip(genre, genre)));
    els.filters.replaceChildren(fragment);
  }

  function renderGames(games) {
    state.games = games
      .filter((game) => game && game.slug)
      .slice()
      .sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0));

    const fragment = document.createDocumentFragment();
    state.cards = [];

    state.games.forEach((game, index) => {
      const card = buildCard(game, index + 1);
      state.cards.push({ game, img: card.img, item: card.item });
      fragment.append(card.item);
    });

    els.grid.replaceChildren(fragment);
    els.grid.setAttribute('aria-busy', 'false');

    buildFilters();
    updateMeta();
    applyFilters();

    /* После первой отрисовки:
       • готовим превью второй темы — поэтому переключение стиля идёт без мигания;
       • догружаем ещё не подтянутые превью текущей темы (они лёгкие), чтобы
         прокрутка и снимки страницы не показывали пустые места. */
    scheduleIdle(() => {
      state.cards.forEach(({ img }) => {
        if (!img.complete) img.loading = 'eager';
      });
      preloadThemeImages(state.theme === 'modern' ? 'retro' : 'modern');
    });
  }

  function updateMeta() {
    const years = state.games
      .map((game) => Number(game.year))
      .filter((year) => Number.isFinite(year));
    const min = years.length ? Math.min(...years) : 1982;
    const max = years.length ? Math.max(...years) : 1997;
    const count = state.games.length;
    const label = `${count} ${pluralGames(count)}`;

    if (els.catalogCount) els.catalogCount.textContent = label;
    if (els.catalogYears) els.catalogYears.textContent = `${min}–${max}`;
    if (els.heroGames) els.heroGames.textContent = label;
  }

  /* ---------- фильтры и поиск ---------- */

  function matchesGenre(game, genre) {
    if (!genre || genre === 'all') return true;
    /* Фильтр строго по жанру: чипы подписаны жанрами из games.json, поэтому
       не «размазываем» выборку по тегам (иначе «Аркада» — 5 игр вместо 2). */
    return normalize(loc(game, 'genre')) === normalize(genre);
  }

  function matchesQuery(game, query) {
    if (!query) return true;
    /* Ищем сразу по обоим языкам: «KROT» и «крот» находят одну игру на любой странице. */
    const haystack = normalize([
      game.title,
      game.title_en,
      game.subtitle,
      game.subtitle_en,
      game.genre,
      game.genre_en,
      game.developer,
      devName(game),
      (Array.isArray(game.tags) ? game.tags : []).join(' '),
    ].join(' '));
    return haystack.includes(query);
  }

  /* Пейджинг: по умолчанию 15 игр на странице (3 в ряд × 5). Выбор «на странице» и номер
     страницы — в адресе (?page=, ?per=), чтобы ссылкой можно было поделиться. */
  const PER_PAGE_OPTIONS = [15, 30, 0]; // 0 — все

  function readPagingFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const perRaw = params.get('per');
      const per = perRaw === null || perRaw === '' ? NaN : Number(perRaw);
      if (PER_PAGE_OPTIONS.includes(per)) state.perPage = per;
      const page = parseInt(params.get('page'), 10);
      if (page > 0) state.page = page;
    } catch (_) { /* старые браузеры — без параметров */ }
  }

  function writePagingToUrl() {
    try {
      const url = new URL(window.location.href);
      if (state.page > 1) url.searchParams.set('page', String(state.page)); else url.searchParams.delete('page');
      if (state.perPage !== 15) url.searchParams.set('per', String(state.perPage)); else url.searchParams.delete('per');
      window.history.replaceState(null, '', url.toString());
    } catch (_) { /* file:// и т.п. */ }
    updateLangLinks();
  }

  /* Переключатель RU | EN в шапке: ссылка на ту же страницу каталога на другом языке
     с сохранением ?page= и ?per= (data-lang-target — путь до другой главной, напр. "en/" или "../"). */
  function updateLangLinks() {
    const params = new URLSearchParams();
    if (state.page > 1) params.set('page', String(state.page));
    if (state.perPage !== 15) params.set('per', String(state.perPage));
    const query = params.toString();
    $$('[data-lang-target]').forEach((link) => {
      const target = link.getAttribute('data-lang-target') || './';
      const path = IS_FILE ? `${target.replace(/\/?$/, '/')}index.html` : target;
      link.setAttribute('href', query ? `${path}?${query}` : path);
    });
  }

  function renderPager(totalPages) {
    if (!els.pager) return;
    const fragment = document.createDocumentFragment();
    const button = (label, page, opts = {}) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pager-btn' + (opts.current ? ' is-current' : '');
      b.textContent = label;
      if (opts.aria) b.setAttribute('aria-label', opts.aria);
      if (opts.current) b.setAttribute('aria-current', 'page');
      if (opts.disabled) b.disabled = true; else b.dataset.page = String(page);
      return b;
    };
    if (totalPages > 1) {
      fragment.append(button('‹', state.page - 1, { aria: UI.prevPage, disabled: state.page <= 1 }));
      for (let i = 1; i <= totalPages; i += 1) {
        fragment.append(button(String(i), i, { current: i === state.page, aria: UI.page(i) }));
      }
      fragment.append(button('›', state.page + 1, { aria: UI.nextPage, disabled: state.page >= totalPages }));
    }
    els.pager.replaceChildren(fragment);
    els.pager.hidden = totalPages <= 1;
  }

  function applyFilters() {
    const query = normalize(state.query);
    const matched = [];

    state.cards.forEach((card) => {
      if (matchesGenre(card.game, state.genre) && matchesQuery(card.game, query)) matched.push(card);
      else card.item.hidden = true;
    });

    const per = state.perPage > 0 ? state.perPage : Math.max(matched.length, 1);
    const totalPages = Math.max(1, Math.ceil(matched.length / per));
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;
    const start = (state.page - 1) * per;
    const end = Math.min(start + per, matched.length);

    matched.forEach((card, i) => {
      card.item.hidden = i < start || i >= end;
    });

    $$('.chip', els.filters).forEach((chip) => {
      const active = (chip.dataset.genre || 'all') === state.genre;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });

    if (els.results) {
      els.results.textContent = matched.length > (end - start)
        ? UI.shownRange(start + 1, end, matched.length)
        : UI.shownAll(matched.length, state.games.length);
    }
    if (els.empty) els.empty.hidden = matched.length > 0;
    if (els.perPage) els.perPage.value = String(state.perPage);
    renderPager(totalPages);
    writePagingToUrl();
  }

  function goToPage(page) {
    state.page = page;
    applyFilters();
    if (els.grid && els.grid.scrollIntoView) {
      const top = els.grid.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) {
        els.grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  function resetFilters() {
    state.genre = 'all';
    state.query = '';
    state.page = 1;
    if (els.search) els.search.value = '';
    applyFilters();
    if (els.search) els.search.focus();
  }

  /* ---------- случайная игра ---------- */

  function openRandomGame() {
    const query = normalize(state.query);
    const filtered = state.cards
      .filter(({ game }) => matchesGenre(game, state.genre) && matchesQuery(game, query))
      .map(({ game }) => game);
    const pool = filtered.length ? filtered : state.games;
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    window.location.assign(gameHref(pick.slug));
  }

  /* ---------- загрузка данных ---------- */

  async function loadGames() {
    if (window.location.protocol === 'file:') return FALLBACK_GAMES;
    try {
      const response = await window.fetch(DATA_URL, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.games) || payload.games.length === 0) {
        throw new Error('в games.json нет списка игр');
      }
      return payload.games;
    } catch (error) {
      window.console.warn('[catalog] games.json недоступен, использую встроенный список:', error && error.message);
      return FALLBACK_GAMES;
    }
  }

  /* ---------- события ---------- */

  function bindEvents() {
    if (els.toggle) els.toggle.addEventListener('click', toggleTheme);
    if (els.random) els.random.addEventListener('click', openRandomGame);
    if (els.reset) els.reset.addEventListener('click', resetFilters);

    if (els.filters) {
      els.filters.addEventListener('click', (event) => {
        const chip = event.target.closest('.chip');
        if (!chip || !els.filters.contains(chip)) return;
        state.genre = chip.dataset.genre || 'all';
        state.page = 1;
        applyFilters();
      });
    }

    if (els.search) {
      els.search.addEventListener('input', () => {
        state.query = els.search.value;
        state.page = 1;
        applyFilters();
      });
    }

    if (els.pager) {
      els.pager.addEventListener('click', (event) => {
        const b = event.target.closest('.pager-btn');
        if (!b || b.disabled || !b.dataset.page) return;
        goToPage(Number(b.dataset.page));
      });
    }

    if (els.perPage) {
      els.perPage.addEventListener('change', () => {
        const per = Number(els.perPage.value);
        state.perPage = PER_PAGE_OPTIONS.includes(per) ? per : 15;
        state.page = 1;
        applyFilters();
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT' || target.isContentEditable)) return;
      const key = String(event.key || '').toLowerCase();
      if (key === 'g' || key === 'п' || event.code === 'KeyG') {
        event.preventDefault();
        toggleTheme();
      }
    });
  }

  async function init() {
    state.theme = storedTheme();
    applyTheme(state.theme);

    /* На file:// ссылка-логотип "./" тоже ведёт в листинг — указываем явно. */
    if (IS_FILE) {
      const brand = $('.brand');
      if (brand) brand.setAttribute('href', 'index.html');
    }

    readPagingFromUrl();
    bindEvents();

    const games = await loadGames();
    renderGames(games);
  }

  init();
})();
