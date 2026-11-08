#!/usr/bin/env node
/**
 * check-file-proto.mjs — проверка каталога в режиме double-click (file://):
 * 11 карточек, переключение темы, загрузка превью и переход по карточке
 * на file:///<slug>/index.html (а не на листинг каталога).
 *
 * Запуск: node tools/qa/check-file-proto.mjs [--catalog /abs/path/index.html]
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch, parseArgs } from './lib.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    catalog: resolve('index.html'),
    outDir: 'reports/qa-shots',
  });
  if (!existsSync(args.catalog)) throw new Error(`Нет файла ${args.catalog}`);
  const fileUrl = `file://${args.catalog}`;
  const out = { fileUrl, checks: {} };
  const session = await launch({ width: 1440, height: 900 });
  try {
    await session.goto(fileUrl, { wait: 1800 });
    const base = await session.evaluate(`(() => {
      const cards = [...document.querySelectorAll('a[href]')].filter((a) => /\\/index\\.html$/.test(a.getAttribute('href') || ''));
      return {
        title: document.title,
        theme: document.documentElement.getAttribute('data-theme'),
        cards: cards.length,
        hrefs: cards.map((a) => a.getAttribute('href')),
        brandHref: document.querySelector('.brand')?.getAttribute('href'),
        thumbs: [...document.images].map((i) => ({ src: i.getAttribute('src'), nw: i.naturalWidth })),
        alts: [...document.images].map((i) => i.getAttribute('alt')),
        consoleLoading: document.readyState,
      };
    })()`);
    out.checks.initial = {
      title: base.title,
      defaultTheme: base.theme,
      cardCount: base.cards,
      allCardsIndexHtml: base.hrefs.length === 11 && base.hrefs.every((h) => /^[a-z0-9-]+\/index\.html$/.test(h)),
      brandHref: base.brandHref,
      thumbsLoaded: base.thumbs.filter((t) => t.nw > 0).length,
      thumbsTotal: base.thumbs.length,
      altsAllSet: base.alts.every((a) => a && a.trim()),
      hrefs: base.hrefs,
    };
    out.checks.consoleErrors = session.consoleErrors;
    out.checks.pageErrors = session.pageErrors;
    out.checks.shotRetro = await session.screenshot(`${args.outDir}/catalog-file-retro-1440.png`);

    // смена темы клавишей G
    await session.pressKey('g');
    await sleep(1000);
    out.checks.afterG = await session.evaluate(`(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      pressed: document.querySelector('#theme-toggle')?.getAttribute('aria-pressed'),
      firstThumb: document.querySelector('#game-grid .card-img')?.getAttribute('src'),
      thumbsLoaded: [...document.images].filter((i) => i.naturalWidth > 0).length,
    }))()`);
    out.checks.shotModern = await session.screenshot(`${args.outDir}/catalog-file-modern-1440.png`);

    // клик по первой карточке → должна открыться игра, а не листинг
    const firstHref = await session.evaluate(`document.querySelector('#game-grid a[href]')?.getAttribute('href') || ''`);
    await session.evaluate(`document.querySelector('#game-grid a[href]')?.click()`);
    await sleep(2000);
    out.checks.cardClick = {
      href: firstHref,
      ...(await session.evaluate(`({
        url: location.href,
        title: document.title,
        isDirectoryListing: Boolean(document.querySelector('title') && /Index of|Directory listing/i.test(document.title + ' ' + document.body.innerText)),
        canvas: Boolean(document.querySelector('canvas')),
      })`)),
    };
    out.checks.cardClick.urlEndsWithIndexHtml = /\/index\.html$/.test(out.checks.cardClick.url);
    out.checks.shotCardClick = await session.screenshot(`${args.outDir}/catalog-file-card-click.png`);
  } finally {
    await session.close();
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
