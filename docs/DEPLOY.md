# Деплой: GitHub → Vercel

Сайт — статика: каталог в корне и игры в подпапках (список — `assets/catalog/games.json`). Сборка не нужна
(`build.sh` только раскладывает копию `_shared/engine.js` по играм).

**Статус: задеплоено.**

- Production: <https://arcade.hefest.ru>
- Vercel-проект: `retro-games`, `projectId: prj_wQgRI2z86E6wl4pNtWx6SVinyRRo`
- GitHub: [`hefest-studio/retro-games`](https://github.com/hefest-studio/retro-games) (публичный, организация студии)
- Интеграция: GitHub → Vercel привязана (`Production Branch = main`), пуш в `main`
  запускает автодеплой; CLI-деплой (`npx vercel --prod`) тоже работает.
- Проверка прода: `/` → 200, все игры каталога → 200, `/hrum/js/game.js` → 200,
  `/hrum` → 308 на `/hrum/`, служебные пути (`/tools/`, `/reports/`, `*/src/`) → 404.

## 1. GitHub (репозиторий организации)

```bash
git init -b main
git add -A
git commit -m "Зал ретро-игр: каталог и игры студии"
git remote add origin https://github.com/hefest-studio/retro-games.git
git push -u origin main
```

Если репозитория ещё нет:

```bash
gh repo create hefest-studio/retro-games --public --source=. --remote=origin --push
```

## 2. Vercel

Проект: `retro-games`. Настройки — в `vercel.json`:

- `framework: null` — статика без сборки;
- `trailingSlash: true` — игры открываются как `/hrum/`, и относительные
  `css/…`, `js/…` внутри игры резолвятся правильно (важно: без слеша они бы
  искались от корня и ломались);
- `cleanUrls: false` — не переписывать `index.html` в URL;
- заголовки кэша и безопасности для `/assets/…` и всех страниц.

Деплой из корня:

```bash
npx vercel link      # один раз: привязать папку к проекту retro-games
npx vercel --prod    # production-деплой
```

Или импортировать репозиторий на <https://vercel.com/new>: Framework Preset —
**Other**, Build Command — пусто, Output Directory — `.`.

`.vercelignore` оставляет на Vercel только работающий сайт: HTML каталога,
`assets/catalog/**` и игры. Исходники (`src/`, `js/` рядом с `index.html` —
внимание: у части игр `js/` и `css/` являются рабочими, поэтому исключаются
только служебные `src/`, `tools/`, `tests/`, `docs/`), тесты, скриншоты и QA-отчёты
не деплоятся.

> Примечание: `.vercelignore` исключает `**/src/`, но **не** исключает рабочие
> `css/` и `js/` — у большинства игр страница состоит из `index.html` + этих папок.

## 3. Проверка после деплоя

```bash
BASE="https://<project>.vercel.app"
for p in / $(node -e "console.log(require('./assets/catalog/games.json').games.map(g=>g.slug+'/').join(' '))"); do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p")" "$p"
done
```

Ожидаемо: все `200`, у игр с внешними `css/js` эти файлы тоже `200` (например
`/saga/css/style.css`). Визуальную проверку удобно делать
`node tools/shot.mjs --url "$BASE" --out /tmp/prod.png` (нужен локальный Chrome).

## 4. Секреты

Токены Vercel/GitHub в репозиторий не попадают: `.gitignore` исключает `.env*`
и `.vercel/`. CLI-токен передаётся только через переменную окружения или
`--token` в командной строке.
