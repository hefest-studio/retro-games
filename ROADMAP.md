**English** | [Русский](ROADMAP.ru.md)

# Roadmap

Status: ✅ done · 🚧 in progress · 🗓 planned · ❌ not planned

## Done

- ✅ **77 original games** in the catalog, all on the shared **Hefest Arcade v2** engine
- ✅ Two styles in every game and in the catalog: 8-bit **retro** and **modern** neon
- ✅ Russian and English: catalog at `/` and `/en/`, games follow `?lang=`
- ✅ Keyboard, touch and gamepad input; co-op for two in many games
- ✅ Catalog: genre filters, search, paging, "Random game", previews for both styles
- ✅ Works offline, from `file://` too: no build step, no CDN, no external requests
- ✅ QA run: static checks, game tests, catalog and per-game browser passes, touch sweep

## Next

- 🗓 New original games — the catalog grows in waves
- 🗓 Playtesting and balance passes on existing games

## Not planned

- ❌ A build step, CDN or npm dependencies — the games stay plain files that work offline
- ❌ Third-party titles, characters, logos or assets — every game is an original work

## Known limits

- Progress and records are kept in the browser (`localStorage`); clearing site data resets them.
- Some games are landscape-only on phones and ask to rotate the device.
- Per-game READMEs are in Russian.
