#!/usr/bin/env node
/**
 * check-catalog-extras.mjs — точечные UX-проверки каталога, которые не входят
 * в основной прогон: якорная навигация под sticky-шапкой, кнопка «Случайная
 * игра», активация чипа с клавиатуры, поведение поиска в обеих темах.
 *
 * Запуск: node tools/qa/check-catalog-extras.mjs [--base http://127.0.0.1:8098]
 */
import { mkdirSync } from 'node:fs';
import { launch, parseArgs } from './lib.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2), { base: 'http://127.0.0.1:8098', outDir: 'reports/qa-shots' });
  mkdirSync(args.outDir, { recursive: true });
  const base = String(args.base).replace(/\/$/, '');
  const out = {};
  const session = await launch({ width: 1440, height: 900 });
  try {
    // 1) Якорь «Смотреть каталог» (#games) и sticky-шапка
    await session.goto(`${base}/`, { wait: 1500 });
    const anchor = await session.evaluate(`(async () => {
      const link = document.querySelector('a.btn-ghost[href="#games"], a[href="#games"]');
      if (!link) return { found: false };
      link.click();
      await new Promise((r) => setTimeout(r, 900));
      const topbar = document.querySelector('.topbar');
      const games = document.querySelector('#games');
      const title = document.querySelector('#games-title');
      const tb = topbar ? topbar.getBoundingClientRect() : null;
      const g = games ? games.getBoundingClientRect() : null;
      const t = title ? title.getBoundingClientRect() : null;
      return {
        found: true,
        hash: location.hash,
        topbarHeight: tb ? Math.round(tb.height) : 0,
        gamesTop: g ? Math.round(g.top) : null,
        titleTop: t ? Math.round(t.top) : null,
        titleCoveredByHeader: Boolean(tb && t && t.top < tb.bottom),
        scrollY: Math.round(window.scrollY),
      };
    })()`);
    out.anchorGames = anchor;
    out.anchorShot = await session.screenshot(`${args.outDir}/catalog-anchor-games.png`);

    // 2) Кнопка «Случайная игра» ведёт на игру
    await session.goto(`${base}/`, { wait: 1500 });
    await session.evaluate(`document.querySelector('#random-game')?.click()`);
    await sleep(1600);
    out.randomGame = await session.evaluate(`({ url: location.href, title: document.title })`);
    out.randomNavigated = /\/(river-raid|digger|lode-runner|boulder-dash|contra|exolon|the-last-mission|silkworm|lost-vikings|double-dragon-battletoads|lost-vikings-2)\//.test(out.randomGame.url);

    // 3) Чип фильтра с клавиатуры: Tab'ом не ищем, фокусируем и жмём Enter
    await session.goto(`${base}/`, { wait: 1500 });
    out.keyboardChip = await session.evaluate(`(async () => {
      const chips = [...document.querySelectorAll('#genre-filters .chip')];
      const chip = chips.find((c) => c.textContent.trim() === 'Платформер') || chips[1];
      if (!chip) return { found: false };
      chip.focus();
      return { found: true, label: chip.textContent.trim(), focused: document.activeElement === chip, ariaPressedBefore: chip.getAttribute('aria-pressed') };
    })()`);
    if (out.keyboardChip.found) {
      await session.pressKey('Enter');
      await sleep(600);
      out.keyboardChip = {
        ...out.keyboardChip,
        ...(await session.evaluate(`(() => {
          const chips = [...document.querySelectorAll('#genre-filters .chip')];
          const active = chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.textContent.trim());
          const visible = [...document.querySelectorAll('#game-grid .card')].filter((c) => !c.hidden).length;
          const results = document.querySelector('#results')?.textContent || '';
          return { ariaPressedActive: active, visibleCards: visible, results };
        })()`)),
      };
    }

    // 4) Поиск в обеих темах: строка запроса и пустое состояние
    for (const theme of ['retro', 'modern']) {
      if (theme === 'modern') {
        await session.evaluate(`localStorage.setItem('retro-games-catalog-theme','modern')`);
        await session.goto(`${base}/`, { wait: 1500 });
      } else {
        await session.evaluate(`localStorage.removeItem('retro-games-catalog-theme')`);
        await session.goto(`${base}/`, { wait: 1500 });
      }
      const themeNow = await session.evaluate(`document.documentElement.getAttribute('data-theme')`);
      await session.evaluate(`(() => {
        const inp = document.querySelector('#game-search');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(inp, 'Contra');
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      await sleep(600);
      const result = await session.evaluate(`(() => {
        const visible = [...document.querySelectorAll('#game-grid .card')].filter((c) => !c.hidden).map((c) => c.querySelector('.card-title')?.textContent);
        return { visible, results: document.querySelector('#results')?.textContent || '', emptyHidden: document.querySelector('#empty-state')?.hidden };
      })()`);
      out[`searchTheme_${theme}`] = { themeNow, ...result, shot: await session.screenshot(`${args.outDir}/catalog-${theme}-search.png`) };

      // пустое состояние
      await session.evaluate(`(() => {
        const inp = document.querySelector('#game-search');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(inp, 'zzzqqq');
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      await sleep(500);
      out[`emptyTheme_${theme}`] = {
        ...(await session.evaluate(`(() => ({
          emptyHidden: document.querySelector('#empty-state')?.hidden,
          visibleCards: [...document.querySelectorAll('#game-grid .card')].filter((c) => !c.hidden).length,
          results: document.querySelector('#results')?.textContent || '',
          resetButton: Boolean(document.querySelector('#reset-filters')),
        }))()`)),
        shot: await session.screenshot(`${args.outDir}/catalog-${theme}-empty.png`),
      };
    }

    // 5) Сброс фильтров из пустого состояния
    await session.evaluate(`document.querySelector('#reset-filters')?.click()`);
    await sleep(500);
    out.resetAfterEmpty = await session.evaluate(`(() => ({
      visibleCards: [...document.querySelectorAll('#game-grid .card')].filter((c) => !c.hidden).length,
      searchValue: document.querySelector('#game-search')?.value,
      focusedIsSearch: document.activeElement === document.querySelector('#game-search'),
      results: document.querySelector('#results')?.textContent || '',
    }))()`);

    // 6) Ошибки консоли за все сценарии, внешние запросы
    out.consoleErrors = session.consoleErrors;
    out.pageErrors = session.pageErrors;
    const external = new Map();
    for (const req of session.requests.values()) {
      try {
        const u = new URL(req.url);
        if (/^https?:$/.test(u.protocol) && !['127.0.0.1', 'localhost'].includes(u.hostname)) external.set(u.hostname, true);
      } catch { /* ignore */ }
    }
    out.externalHosts = [...external.keys()];
  } finally {
    await session.close();
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
