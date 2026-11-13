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
  const DATA_URL = 'assets/catalog/games.json';
  const THUMB_BASE = 'assets/catalog/thumbs/';
  /* Ревизия превью: менять при перегенерации thumbs — сбрасывает кэш браузера и CDN.
     Итоговый ключ = версия игры + ревизия набора превью. */
  const THUMB_REV = '20261113c';

  /* На file:// адреса вида "hrum/" открывают листинг каталога, а не игру,
     поэтому в этом режиме ведём прямо на "hrum/index.html". На http(s)
     остаются относительные ссылки с завершающим слешем (как на Vercel). */
  const IS_FILE = window.location.protocol === 'file:';
  const gameHref = (slug) => (IS_FILE ? `${slug}/index.html` : `${slug}/`);

  /* Резервная копия данных — только для file:// и случаев, когда fetch
     недоступен. Основной источник — games.json. */
  const FALLBACK_GAMES = [
    { slug: 'hrum', title: 'ХРУМ', subtitle: 'Лабиринт', year: 1980, developer: 'Гефест', genre: 'Аркада', tags: ['аркада', 'лабиринт', 'оригинал'], summary: 'Собери все кристаллы в лабиринте, уворачивайся от врагов, лови усилители.', accent: '#ffd34d' },
    { slug: 'ruslo', title: 'РУСЛО', subtitle: 'Над рекой', year: 1982, developer: 'Гефест', genre: "Shoot'em-up", tags: ['аркада', 'скролл-шутер', 'оригинал'], summary: 'Лети над рекой: мосты, заправки, враги — не промахнись и не кончи топливо.', accent: '#3ce6a8' },
    { slug: 'krot', title: 'КРОТ', subtitle: 'Подземные туннели', year: 1983, developer: 'Гефест', genre: 'Аркада', tags: ['аркада', 'подземелье', 'оригинал'], summary: 'Копай туннели, собирай алмазы, роняй мешки золота на монстров.', accent: '#f5c542' },
    { slug: 'staratel', title: 'СТАРАТЕЛЬ', subtitle: 'Обвал в шахте', year: 1983, developer: 'Гефест', genre: 'Головоломка', tags: ['головоломка', 'подземелье', 'оригинал'], summary: 'Копай ходы, набери норму золота и уйди в выход — роняй валуны на големов.', accent: '#ffb347' },
    { slug: 'obval', title: 'ОБВАЛ', subtitle: 'Шахта самоцветов', year: 1984, developer: 'Гефест', genre: 'Головоломка', tags: ['головоломка', 'подземелье', 'оригинал'], summary: 'Рой ходы, собирай алмазы, не попади под обвал камней и светлячков.', accent: '#5fe08a' },
    { slug: 'kaskad', title: 'КАСКАД', subtitle: 'Головоломка', year: 1984, developer: 'Гефест', genre: 'Головоломка', tags: ['головоломка', 'падающие фигуры', 'оригинал'], summary: 'Складывай падающие фигуры в линии — и не дай стакану переполниться.', accent: '#36d6ff' },
    { slug: 'rubezh', title: 'РУБЕЖ', subtitle: 'Неоновый рассвет', year: 1987, developer: 'Гефест', genre: 'Run-and-gun', tags: ['run-and-gun', 'экшен', 'оригинал'], summary: 'Пробивайся сквозь орды врагов и боссов: оружие, перекаты, неон.', accent: '#ff3b6b' },
    { slug: 'proryv', title: 'ПРОРЫВ', subtitle: 'Штурмовик', year: 1987, developer: 'Гефест', genre: 'Run-and-gun', tags: ['run-and-gun', 'экшен', 'оригинал'], summary: 'Пробейся через 5 секторов: стреляй, собирай боеприпасы, дойди до края.', accent: '#49d0ff' },
    { slug: 'rubikon', title: 'РУБИКОН', subtitle: 'Робот ТАРАН-7', year: 1987, developer: 'Гефест', genre: 'Аркада', tags: ['аркада', 'робот', 'оригинал'], summary: 'Проведи робота сквозь уровни подземелья к поверхности.', accent: '#c792ea' },
    { slug: 'vihr', title: 'ВИХРЬ', subtitle: 'Над полем боя', year: 1988, developer: 'Гефест', genre: "Shoot'em-up", tags: ['shoot’em-up', 'экшен', 'оригинал'], summary: 'Вертолёт и джип против волн техники — расчищай небо и землю.', accent: '#ffcf3a' },
    { slug: 'saga', title: 'СЕВЕРНАЯ САГА', subtitle: 'Сага о трёх', year: 1992, developer: 'Гефест', genre: 'Платформер', tags: ['головоломка', 'платформер', 'оригинал'], summary: 'Три северянина с разными умениями — проведи всех троих к выходу.', accent: '#7cc6ff' },
    { slug: 'neon-rage', title: 'НЕОН × ЯРОСТЬ', subtitle: 'Neon Yarost', year: 1993, developer: 'Гефест', genre: "Beat'em-up", tags: ["beat'em-up", 'экшен', 'оригинал'], summary: 'Комета Кай и киборг-кузнец Рок пробиваются сквозь банду в неоновом городе.', accent: '#ff3bd0' },
    { slug: 'saga-2', title: 'СЕВЕРНАЯ САГА 2', subtitle: 'Северное сияние', year: 1997, developer: 'Гефест', genre: 'Платформер', tags: ['головоломка', 'платформер', 'оригинал'], summary: 'Шесть саг полярной ночи: три северянина, новые умения, лёд и механизмы.', accent: '#9ad0ff' },
    { slug: 'bolt', title: 'БОЛТ', subtitle: 'Побег со Шлак-9', year: 1993, developer: 'Гефест', genre: 'Run-and-gun', tags: ['run-and-gun', 'платформер', 'оригинал'], summary: 'Робот-наёмник пробивается с планеты Шлак-9: беги, прыгай, стреляй и следи за зарядом батареи.', accent: '#EA6A12' },
    { slug: 'kolobok', title: 'КОЛОБОК', subtitle: 'Приключение', year: 1991, developer: 'Гефест', genre: 'Головоломка', tags: ['головоломка', 'платформер', 'оригинал'], summary: 'Катись Колобком по лесным полянам, собирай ягоды и применяй предметы, чтобы найти дорогу домой.', accent: '#f4c84a' },
    { slug: 'plashch', title: 'ПЛАЩ', subtitle: 'Ночной мститель', year: 1992, developer: 'Гефест', genre: 'Экшен-платформер', tags: ['экшен', 'платформер', 'оригинал'], summary: 'Ночной мститель в плаще зачищает Чёрный квартал: сюрикены, присед от пуль, крюк-кошка и бой с Бароном.', accent: '#9b4dff' },
    { slug: 'redut', title: 'РЕДУТ', subtitle: 'Оборона базы', year: 1985, developer: 'Гефест', genre: 'Аркада', tags: ['аркада', 'танки', 'оригинал'], summary: 'Обороняй базу-редут от волн вражеских танков: разрушай кирпич, прячься в лесу, лови усилители. Кооп на двоих.', accent: '#6dbe45' },
    { slug: 'zvero-otryad', title: 'ЗВЕРО-ОТРЯД', subtitle: 'Старая Мастерская', year: 1990, developer: 'Гефест', genre: 'Платформер', tags: ['платформер', 'ко-оп', 'оригинал'], summary: 'Ко-оп платформер: ёж Пыж и заяц Тяпа хватают ящики и швыряют их во врагов, расчищая Старую Мастерскую.', accent: '#f5a33c' },
    { slug: 'zvero-otryad-2', title: 'ЗВЕРО-ОТРЯД 2', subtitle: 'Новые уровни', year: 1993, developer: 'Гефест', genre: 'Платформер', tags: ['платформер', 'ко-оп', 'сиквел', 'оригинал'], summary: 'Продолжение: тот же движок, новые Ледяные Погреба — хватай ящики и швыряй во врагов. Новый босс — жаба КВАК.', accent: '#5cc8ff' },
    { slug: 'roy', title: 'РОЙ', subtitle: 'Захватчики', year: 1981, developer: 'Гефест', genre: "Shoot'em-up", tags: ['аркада', 'космос', 'оригинал'], summary: 'Отбейся от роя: строй пришельцев пикирует на корабль, а Медуза лучом утаскивает его в плен.', accent: '#7c6cff' },
    { slug: 'razrez', title: 'РАЗРЕЗ', subtitle: 'Захват поля', year: 1984, developer: 'Гефест', genre: "Аркада", tags: ['аркада', 'территория', 'оригинал'], summary: 'Режь поле на части и забирай территорию, пока шары не задели след.', accent: '#2fd3c3' },
    { slug: 'podkop', title: 'ПОДКОП', subtitle: 'Лестницы и ямы', year: 1984, developer: 'Гефест', genre: 'Аркада', tags: ['лабиринт', 'лестницы', 'ловушки', 'оригинал'], summary: 'Лазай по лестницам и канатам, копай ямы-ловушки для стражи, собери всё золото и уйди по проявившейся лестнице.', accent: '#ff7a59' },
    { slug: 'kladka', title: 'КЛАДКА', subtitle: 'Разбей стену', year: 1986, developer: 'Гефест', genre: 'Аркада', tags: ['аркада', 'разбивание блоков', 'оригинал'], summary: 'Отбивай раскалённое ядро мастерком, разбери кладку на 10 уровнях и погаси сердце Плавильни.', accent: '#ff8a3d' },
    { slug: 'zaslon', title: 'ЗАСЛОН', subtitle: 'Скролл-шутер', year: 1994, developer: 'Гефест', genre: "Shoot'em-up", tags: ['аркада', 'космос', 'оригинал'], summary: 'Держи заслон: не пропусти ни одного врага за нижний край, прокачивай корабль за металлолом и разбей пятерых боссов.', accent: '#ff7a1a' },
    { slug: 'fitil', title: 'ФИТИЛЬ', subtitle: 'Лабиринт подрывника', year: 1990, developer: 'Гефест', genre: "Аркада", tags: ['аркада', 'лабиринт', 'кооп', 'оригинал'], summary: 'Ставь бомбы с крестовым взрывом, ломай ящики, собирай бонусы, взорви всех врагов и уходи в люк — 8 уровней и босс в финале, можно вдвоём.', accent: '#e85d3a' },
    { slug: 'katakomby', title: 'КАТАКОМБЫ', subtitle: 'Зачистка подземелий', year: 1985, developer: 'Гефест', genre: "Аркада", tags: ['аркада', 'подземелья', 'кооп', 'оригинал'], summary: 'Спустись через 8 этажей катакомб вдвоём или в одиночку: ломай логова, ищи ключи, ешь, чтобы не угаснуть, и одолей Стража Глубин.', accent: '#f0a64a' },
    { slug: 'yuz', title: 'ЮЗ', subtitle: 'Гонки на мини-машинках', year: 1991, developer: 'Гефест', genre: "Гонки", tags: ['гонки', 'вид сверху', 'оригинал', '2 игрока'], summary: 'Мини-машинки на столе мастерской, верстаке, кухне и в саду: занос, лёд и масло, трамплины и чемпионат из 8 трасс против двух соперников.', accent: '#4fc3f7' },
    { slug: 'puzyr', title: 'ПУЗЫРЬ', subtitle: 'Стеклодувы мастерской', year: 1986, developer: 'Гефест', genre: "Платформер", tags: ['платформер', 'кооп', 'оригинал'], summary: 'Подмастерья Колба и Реторта выдувают стеклянные шары, ловят в них врагов и лопают цепочками — 30 уровней и Котёл в финале.', accent: '#ffb347' },
    { slug: 'pereprava', title: 'ПЕРЕПРАВА', subtitle: 'Переход дороги и реки', year: 1981, developer: 'Гефест', genre: "Аркада", tags: ['аркада', 'тайминг', 'оригинал'], summary: 'Проведи жука-курьера Шурупа через заводской проезд и канал и доставь детали во все 5 ячеек склада за 10 смен.', accent: '#7bd389' },
    { slug: 'zastava', title: 'ЗАСТАВА', subtitle: 'Нашествие ржави', year: 1978, developer: 'Гефест', genre: "Shoot'em-up", tags: ['аркада', 'нашествие', 'оригинал'], summary: 'Удержи заставу мастерской: ржавые механизмы идут рядами, коршуны ныряют под щитом, а матку надо вскрыть через вращающийся пояс.', accent: '#9ccc65' },
    { slug: 'sputnik', title: 'СПУТНИК', subtitle: 'Корабль и дрон-спутник', year: 1987, developer: 'Гефест', genre: "Shoot'em-up", tags: ['аркада', 'скролл-шутер', 'оригинал'], summary: 'Проведи корабль «Горн» сквозь пояс Окалины: неуязвимый дрон «Наковальня» глотает пули, крепится к носу или корме и улетает вперёд по кнопке.', accent: '#e0a96d' },
    { slug: 'eskadrilya', title: 'ЭСКАДРИЛЬЯ', subtitle: 'Летучий отряд', year: 1984, developer: 'Гефест', genre: "Shoot'em-up", tags: ['скролл-шутер', 'самолёты', 'оригинал'], summary: 'Веди паролёт летучего отряда «Гефеста» над морем и островами, крути петли, собирай звено и топи крейсеры-кузни флотилии Окалины.', accent: '#5fb3d9' },
    { slug: 'nalyot', title: 'НАЛЁТ', subtitle: 'Run-and-gun на двоих', year: 1996, developer: 'Гефест', genre: "Run-and-gun", tags: ['run-and-gun', 'кооп', 'боссы', 'оригинал'], summary: 'Ремонтники мастерской «Гефест» против механической банды «Окалина»: 6 миссий, «Котёл» и машины-боссы.', accent: '#e57373' },
    { slug: 'glub', title: 'ГЛУБЬ', subtitle: 'Шахта Древнего Горна', year: 1985, developer: 'Гефест', genre: "Платформер", tags: ['платформер', 'исследование', 'флип-скрин', 'оригинал'], summary: 'Водолаз-рудознатец и механический крот Бурик спускаются в шахту Древнего Горна за восемью кристаллами-ключами.', accent: '#c98b4a' },
    { slug: 'taynik', title: 'ТАЙНИК', subtitle: 'Лабиринт с верёвками', year: 1983, developer: 'Гефест', genre: "Платформер", tags: ['платформер', 'лабиринт', 'верёвки', 'оригинал'], summary: 'Фонарщик Светляк лезет по верёвкам через ярусы старой водонапорной башни, перепрыгивая кислоту и отстреливая обитателей.', accent: '#7fa7c9' },
    { slug: 'zheoda', title: 'ЖЕОДА', subtitle: 'Рудознатка в пещерах', year: 1991, developer: 'Гефест', genre: "Платформер", tags: ['платформер', 'пещеры', 'головоломка', 'оригинал'], summary: 'Геолог Друза собирает все кристаллы в пещерах-жеодах: рычаги, гравитация, взрывчатка и каменный Исполин в финале.', accent: '#b98cff' },
    { slug: 'udalets', title: 'УДАЛЕЦ', subtitle: 'Кубки Мастера в заброшенных цехах', year: 1988, developer: 'Гефест', genre: "Платформер", tags: ['платформер', 'флип-скрин', 'ранец', 'тайники', 'оригинал'], summary: 'Подмастерье-удалец добывает Кубки Мастера: найди Кубок на уровне — и дверь выхода откроется.', accent: '#d6453a' },
    { slug: 'ugolyok', title: 'УГОЛЁК', subtitle: 'Робот-кочегар в угольной шахте', year: 1984, developer: 'Гефест', genre: "Платформер", tags: ['платформер', 'лабиринт', 'шахта', 'оригинал'], summary: 'Робот-кочегар Уголёк собирает весь уголь в шахте из 48 экранов, чтобы раздуть остывающий Горн мастерской «Гефест».', accent: '#ff6b3d' },
    { slug: 'grom', title: 'ГРОМ', subtitle: 'Штурмовик в громовой броне', year: 1990, developer: 'Гефест', genre: "Run-and-gun", tags: ['run-and-gun', 'исследование', 'лабиринт', 'боссы', 'оригинал'], summary: 'Run-and-gun с исследованием огромных уровней-лабиринтов: штурмовик мастерской «Гефест», луч-кнут, форма-колесо и молнии.', accent: '#8fa8ff' },
    { slug: 'druzhina', title: 'ДРУЖИНА', subtitle: 'Дружина «Гефеста» против железной орды', year: 1989, developer: 'Гефест', genre: "Beat'em-up", tags: ['beat\'em-up', 'фэнтези', 'кооп', 'боссы', 'оригинал'], summary: 'Фэнтезийный beat \'em up на двоих: дружина мастерской «Гефест» отбивает Кузнечный тракт у железной орды Чёрного Литейщика — комбо, броски, магия кувшинов и ездовые ящеры.', accent: '#c9773a' },
    { slug: 'chertog', title: 'ЧЕРТОГ', subtitle: 'Спасти мастера до рассвета', year: 1989, developer: 'Гефест', genre: "Платформер", tags: ['платформер', 'кинематографичный', 'фехтование', 'ловушки', 'оригинал'], summary: 'Подмастерье-беглец пробирается через подземный Чертог Медного Наместника, чтобы до рассвета освободить своего учителя.', accent: '#d98a4e' },
    { slug: 'dozor', title: 'ДОЗОР', subtitle: 'Броневики «Гефеста» против Ржавой артели', year: 1986, developer: 'Гефест', genre: "Shoot'em-up", tags: ['вид сверху', 'спасение', 'кооп', 'оригинал'], summary: 'Дозорные броневики освобождают пленных мастеровых с заводов механической Ржавой артели — на одного или вдвоём.', accent: '#a8c256' },
    { slug: 'rikoshet', title: 'РИКОШЕТ', subtitle: 'Наковальня против стен из руды', year: 1987, developer: 'Гефест', genre: "Аркада", tags: ['аркада', 'разбивание блоков', 'оригинал'], summary: 'Наковальня мастерской отбивает раскалённую заклёпку и крушит стены из руды, стекла и металла.', accent: '#ff5e1a' },
    { slug: 'liven', title: 'ЛИВЕНЬ', subtitle: 'Пулевой ад сквозь ливень заклёпок', year: 1997, developer: 'Гефест', genre: "Shoot'em-up", tags: ['пулевой ад', 'вертикальный скролл', 'боссы', 'оригинал'], summary: 'Искра-челнок мастерской «Гефест» пролетает сквозь ливень раскалённых заклёпок механических Звонарей-колоколов.', accent: '#d9a441' },
    { slug: 'oruzheynik', title: 'ОРУЖЕЙНИК', subtitle: 'Восемь цехов, восемь Мастеров, один наруч', year: 1988, developer: 'Гефест', genre: "Экшен-платформер", tags: ['платформер', 'экшен', 'боссы', 'оружие боссов', 'оригинал'], summary: 'Юный оружейник мастерской «Гефест» отвоёвывает восемь цехов у взбунтовавшихся автоматонов-Мастеров и забирает их оружие.', accent: '#c8742c' },
    { slug: 'shustrik', title: 'ШУСТРИК', subtitle: 'Хорёк-курьер против Ржавого Лиса', year: 1994, developer: 'Гефест', genre: "Платформер", tags: ['платформер', 'скорость', 'шутер', 'тайники', 'оригинал'], summary: 'Механический хорёк-курьер Шустрик на всех парах догоняет Ржавого Лиса-автоматона, укравшего чертежи мастерской.', accent: '#ffa62b' }
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
    if (typeof fromData === 'string' && fromData.trim()) return fromData.replace(/^\/+/, '').replace(/\?.*$/, '') + thumbBust(game);
    return `${THUMB_BASE}${game.slug}-${theme}.webp${thumbBust(game)}`;
  };

  const cardAlt = (game, theme) => `${game.title} — превью игры в ${theme === 'modern' ? 'неоновом стиле' : 'ретро-стиле'}`;

  const pluralGames = (count) => {
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
      els.toggle.setAttribute(
        'aria-label',
        modern
          ? 'Сейчас включён неоновый стиль. Переключить на 8-битный ретро-стиль (клавиша G)'
          : 'Сейчас включён 8-битный ретро-стиль. Переключить на неоновый стиль (клавиша G)',
      );
    }
    if (els.toggleMode) els.toggleMode.textContent = modern ? 'неон' : '8-бит';

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
      `${game.title} — ${game.subtitle}. ${game.genre}, ${game.year}. Играть`,
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
    genre.textContent = game.genre || '';

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
    coin.textContent = 'Вставь монетку';

    shot.append(img, coin);

    const body = document.createElement('div');
    body.className = 'card-body';

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = game.title;

    const subtitle = document.createElement('div');
    subtitle.className = 'card-sub';
    subtitle.textContent = game.subtitle || '';

    const summary = document.createElement('p');
    summary.className = 'card-summary';
    summary.textContent = game.summary || '';

    body.append(title, subtitle, summary);

    const foot = document.createElement('div');
    foot.className = 'card-foot';

    const developer = document.createElement('span');
    developer.className = 'card-dev';
    developer.textContent = game.developer || '';
    developer.title = game.developer || '';

    const play = document.createElement('span');
    play.className = 'card-play';
    play.textContent = 'Играть';

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
      if (game.genre && !genres.includes(game.genre)) genres.push(game.genre);
    });

    const fragment = document.createDocumentFragment();
    fragment.append(buildChip('Все', 'all'));
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
    return normalize(game.genre) === normalize(genre);
  }

  function matchesQuery(game, query) {
    if (!query) return true;
    const haystack = normalize([
      game.title,
      game.subtitle,
      game.genre,
      game.developer,
      (Array.isArray(game.tags) ? game.tags : []).join(' '),
    ].join(' '));
    return haystack.includes(query);
  }

  function applyFilters() {
    const query = normalize(state.query);
    let visible = 0;

    state.cards.forEach(({ game, item }) => {
      const matches = matchesGenre(game, state.genre) && matchesQuery(game, query);
      item.hidden = !matches;
      if (matches) visible += 1;
    });

    $$('.chip', els.filters).forEach((chip) => {
      const active = (chip.dataset.genre || 'all') === state.genre;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });

    if (els.results) els.results.textContent = `Показано ${visible} из ${state.games.length}`;
    if (els.empty) els.empty.hidden = visible > 0;
  }

  function resetFilters() {
    state.genre = 'all';
    state.query = '';
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
        applyFilters();
      });
    }

    if (els.search) {
      els.search.addEventListener('input', () => {
        state.query = els.search.value;
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

    bindEvents();

    const games = await loadGames();
    renderGames(games);
  }

  init();
})();
