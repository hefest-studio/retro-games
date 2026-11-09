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

  /* На file:// адреса вида "contra/" открывают листинг каталога, а не игру,
     поэтому в этом режиме ведём прямо на "contra/index.html". На http(s)
     остаются относительные ссылки с завершающим слешем (как на Vercel). */
  const IS_FILE = window.location.protocol === 'file:';
  const gameHref = (slug) => (IS_FILE ? `${slug}/index.html` : `${slug}/`);

  /* Резервная копия данных — только для file:// и случаев, когда fetch
     недоступен. Основной источник — games.json. */
  const FALLBACK_GAMES = [
    { slug: 'hrum', title: 'ХРУМ', subtitle: 'Лабиринт', year: 1980, developer: 'Гефест', genre: 'Аркада', tags: ['аркада', 'лабиринт', 'оригинал'], summary: 'Собери все кристаллы в лабиринте, уворачивайся от врагов, лови усилители.', accent: '#ffd34d' },
    { slug: 'ruslo', title: 'РУСЛО', subtitle: 'Над рекой', year: 1982, developer: 'Гефест', genre: "Shoot'em-up", tags: ['аркада', 'скролл-шутер', 'оригинал'], summary: 'Лети над рекой: мосты, заправки, враги — не промахнись и не кончи топливо.', accent: '#3ce6a8' },
    { slug: 'digger', title: 'Digger', subtitle: 'Подземные туннели', year: 1983, developer: 'Windmill Software', genre: 'Аркада', tags: ['аркада', 'лабиринт', 'копание'], summary: 'Копайте туннели, собирайте алмазы и роняйте мешки золота.', accent: '#e8833a' },
    { slug: 'lode-runner', title: 'Lode Runner', subtitle: 'Погружение', year: 1983, developer: 'Douglas E. Smith', genre: 'Головоломка', tags: ['головоломка', 'платформер', 'классика'], summary: 'Золото, лестницы и ямы-ловушки: соберите всё и уйдите от стражи.', accent: '#f0b429' },
    { slug: 'boulder-dash', title: 'Boulder Dash', subtitle: 'Кристальные глубины', year: 1984, developer: 'First Star Software', genre: 'Головоломка', tags: ['головоломка', 'аркада', 'копание'], summary: 'Копайте грунт, собирайте алмазы и уворачивайтесь от камней.', accent: '#f2c14e' },
    { slug: 'kaskad', title: 'КАСКАД', subtitle: 'Головоломка', year: 1984, developer: 'Гефест', genre: 'Головоломка', tags: ['головоломка', 'падающие фигуры', 'оригинал'], summary: 'Складывай падающие фигуры в линии — и не дай стакану переполниться.', accent: '#36d6ff' },
    { slug: 'contra', title: 'Contra', subtitle: 'Неоновый рассвет', year: 1987, developer: 'Konami', genre: 'Run-and-gun', tags: ['run-and-gun', 'платформер', 'аркада'], summary: 'Бег, прыжки и огонь в восьми направлениях: два этапа и два босса.', accent: '#ff4d9d' },
    { slug: 'exolon', title: 'Exolon', subtitle: 'Штурмовик Виторк', year: 1987, developer: 'Hewson Consultants', genre: 'Run-and-gun', tags: ['run-and-gun', 'платформер', 'ZX Spectrum'], summary: 'Пять секторов: бластер по органике, граната по броне, уйдите живым.', accent: '#22e6ff' },
    { slug: 'the-last-mission', title: 'The Last Mission', subtitle: 'Робот OR-CABE-3', year: 1987, developer: 'Opera Soft', genre: 'Аркада', tags: ['аркада', 'платформер', 'sci-fi'], summary: 'Робот OR-CABE-3: отделяйте башню и поднимайтесь с дна базы наверх.', accent: '#ff4fd8' },
    { slug: 'silkworm', title: 'Silkworm', subtitle: 'Шелкопряд', year: 1988, developer: 'Tecmo', genre: "Shoot'em-up", tags: ["shoot'em-up", 'горизонтальный скролл', 'вертолёт'], summary: 'Горизонтальный скролл-шутер: вертолёт, четыре зоны и четыре босса.', accent: '#ff8a3d' },
    { slug: 'lost-vikings', title: 'The Lost Vikings', subtitle: 'Потерянные викинги', year: 1992, developer: 'Interplay / Silicon & Synapse', genre: 'Платформер', tags: ['платформер', 'головоломка', 'три героя'], summary: 'Три викинга, плиты, рычаги и три двери: проведите всех.', accent: '#5eead4' },
    { slug: 'double-dragon-battletoads', title: 'Double Dragon × Battle Toads', subtitle: 'Neon Rage', year: 1993, developer: 'Technōs Japan / Rare', genre: "Beat'em-up", tags: ["beat'em-up", 'кроссовер', 'неон'], summary: 'Дракон Кай и жаба Рок выбивают чип NEON-8 из лап «ТОКСИК».', accent: '#ff2e88' },
    { slug: 'lost-vikings-2', title: 'The Lost Vikings 2', subtitle: 'Северное сияние', year: 1997, developer: 'Interplay / Silicon & Synapse', genre: 'Платформер', tags: ['платформер', 'головоломка', 'викинги'], summary: 'Шесть саг, три героя и полярная ночь: соберите руны и драккар.', accent: '#56e0b0' },
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

  const thumbSrc = (game, theme) => {
    const fromData = game.thumb && game.thumb[theme];
    if (typeof fromData === 'string' && fromData.trim()) return fromData.replace(/^\/+/, '');
    return `${THUMB_BASE}${game.slug}-${theme}.webp`;
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
