# Деплой: GitHub → Vercel

Сайт — статика: каталог в корне и 11 игр в подпапках. Сборка не нужна.

**Статус: задеплоено.**

- Production: <https://retro-games-psi.vercel.app>
- Vercel-проект: `retro-games` (<https://vercel.com/sergio-zerg/retro-games>),
  `projectId: prj_wQgRI2z86E6wl4pNtWx6SVinyRRo`
- GitHub: `sergio-zerg/retro-games` (private)
- Проверка прода: `/` → 200, все 11 игр → 200, `/digger/css/style.css` → 200,
  `/contra` → 308 на `/contra/`, служебные пути (`/tools/`, `/reports/`, `*/src/`) → 404.

## 1. GitHub (приватный репозиторий)

```bash
git init -b main
git add -A
git commit -m "Зал ретро-игр: каталог и 11 браузерных ремейков"
git remote add origin git@github.com:sergio-zerg/retro-games.git
git push -u origin main
```

Если репозитория ещё нет:

```bash
gh repo create sergio-zerg/retro-games --private --source=. --remote=origin --push
```

## 2. Vercel

Проект: `retro-games`. Настройки — в `vercel.json`:

- `framework: null` — статика без сборки;
- `trailingSlash: true` — игры открываются как `/contra/`, и относительные
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
> `css/` и `js/` — у digger, lode-runner, lost-vikings-2 и river-raid игра
> состоит из `index.html` + этих папок.

## 3. Проверка после деплоя

```bash
BASE="https://<project>.vercel.app"
for p in / boulder-dash/ contra/ digger/ double-dragon-battletoads/ exolon/ \
         lode-runner/ lost-vikings/ lost-vikings-2/ river-raid/ silkworm/ the-last-mission/; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p")" "$p"
done
```

Ожидаемо: все `200`, у игр с внешними `css/js` эти файлы тоже `200` (например
`/digger/css/style.css`). Визуальную проверку удобно делать
`node tools/shot.mjs --url "$BASE" --out /tmp/prod.png` (нужен локальный Chrome).

## 4. Секреты

Токены Vercel/GitHub в репозиторий не попадают: `.gitignore` исключает `.env*`
и `.vercel/`. CLI-токен передаётся только через переменную окружения или
`--token` в командной строке.
