# Poe2WebAdmin

The web admin site of the **Path of Exile 2 client 0.5.5e.hotfix1 private server**
([Poe2Server](https://github.com/Distorbed678/Poe2Server) serves and packages it; the hub
[Poe2ModdingProject](https://github.com/Distorbed678/Poe2ModdingProject) has it as the submodule
`modules/web-admin`, the dev source of truth). A single-page app in **Svelte 5 + Vite + TypeScript** that talks to the server's web API
(`crates/poe-web-api` of Poe2Server, documented in `docs/architecture/web-api.md` of the hub).

## Pages

| Page | What it does |
|---|---|
| Login | `POST /api/v1/login` with `kind: "web"` (12 hour token). Only admin accounts get in |
| `#/token-login?t=<token>` | One-time sign-in link (the launcher's "Open web admin"): removes the token from the address bar and history, redeems it once with `POST /api/v1/web-token/redeem` for a web session. Expired, used or malformed links land on the login page with a notice |
| Dashboard | **Server control** (Restart and Stop, each behind a confirmation dialog with an optional message for the players and a countdown in seconds; a running countdown with Cancel), server info, players online, instance summary, busiest instances. Refreshes every 5 s. **Activity charts** (players and instances, simulation frame time, memory, CPU; range 15 min / 1 h / 6 h / 24 h; hand-rolled SVG on the theme tokens) and the **message of the day** card |
| Live logs | WebSocket log stream: level, target prefix and text filters (applied by the server), pause and resume, autoscroll, at most 3000 lines in the DOM, colour by level, reconnect with backoff |
| Players (`#/players`, `#/sessions` still works) | **Online**: class and level, account, area, instance, connected for, IP address (admins only), filter and sort; kick, mute (minutes, or until unmuted), unmute, transfer (to an instance id, or a new area, seed, topology, orientation), ban. **Bans**: the list with expiry and history, new ban (account or address), lift. The Accounts page has a Ban button too |
| Instances | List, close, create (area, seed, topology, orientation) |
| Accounts | List, change role, disable and enable, ban |
| Characters | List (filter by account), detail view |
| Schedule | Scheduled tasks (restart with a countdown and message) by day, weekdays, interval or cron in the server's time zone; preview of the next runs, on/off, edit, delete, history |
| Config | The server's config file: form for the common keys, raw TOML with a syntax check (line and column), diff, Save or Save and restart, backups |
| Announce | Button at the foot of the sidebar: a chat line to everyone |
| Inventory, Passive tree | Stubs ("waiting for the inventory work"), shown only when `VITE_FEATURE_INVENTORY` / `VITE_FEATURE_PASSIVES` is `true` at build time |

Every page shows a banner at the top while a stop or restart is pending (countdown, Cancel), while the server restarts, when it has stopped and when it cannot be reached. The page polls `GET /api/v1/server` and `GET /api/v1/admin/server/shutdown` (every 5 s, every 1.5 s during an outage or countdown); when the server answers again it checks the session (`GET /api/v1/me`; web sessions live in the database and survive a restart), says so in a toast and reloads the dashboard.

Close, kick, unmute, ban, lift, disable, delete, role changes, stop and restart ask for confirmation. The token is kept in `sessionStorage` (gone when the tab
closes); any `401` returns to the login.

## Design

The look is the launcher's (`modules/launcher`, MIT like this repo): the design tokens in `src/tokens.css` and `src/lib/motion.ts` are identical copies of the launcher's ("Ash & Blood": red-black, gold, crimson; Cinzel headings over Inter, both bundled from `@fontsource-variable`, SIL OFL; change both repos together). Dark by default, `data-theme="light"` for the parchment variant (`main.ts` sets it from the saved choice or the system preference, the sun/moon button at the foot of the sidebar toggles and saves it in `localStorage`). The logo (`public/logo.png`, `public/favicon.svg`) is the launcher's *rune seal*. The shell is a grouped sidebar (brand and server status; Dashboard; People; World; Advanced, folded by default, its state in `localStorage`; Announce, account, theme and Sign out at the foot; an icon rail below 900 px, a bottom tab bar below 640 px), then cards, status chips, progress bars, empty states, dialogs and toasts. The small components are copies of the launcher's (`src/lib/ui/`: `Icon`, `Chip`, `Empty`, `Progress`, `Spinner`, `Toasts`, `Modal`, `ConfirmDialog`, `PageHead`, `Switch`), so this repo has no dependency on the launcher's. Motion is fade and slide only with one easing curve: CSS uses the duration tokens (`--dur-fast` 150 ms to `--dur-page` 350 ms), Svelte transitions `DUR`, `ease` and `ms()` from `src/lib/motion.ts`; skeletons while the dashboard loads; under `prefers-reduced-motion` everything is 0.

## Develop

Needs Node 22 and npm.

```sh
npm ci
npm run dev        # http://localhost:5173, /api (and the log WebSocket) proxied to http://127.0.0.1:8080
```

The proxy target is the server's `[web] bind` (`config/server.toml`); change it with `POE_API_TARGET=http://host:port npm run dev`.
Start the server with `cargo run -p poe-server` in Poe2Server (or `cargo xtask server run` in the hub) and create an admin first:

```sh
cargo run -p poe-server -- account create alice "a long password"
cargo run -p poe-server -- account role alice admin
```

Feature flags for the stub panels: `VITE_FEATURE_INVENTORY=true VITE_FEATURE_PASSIVES=true npm run dev` (or in `.env.local`).

| Script | |
|---|---|
| `npm run dev` | Vite dev server with the API proxy |
| `npm run build` | production build into `dist/`; also writes `dist/build.json` (name, version, build time, commit), which the server logs at start and the hub's `cargo xtask server` uses to decide whether to rebuild |
| `npm run check` | `svelte-check` plus `tsc` |
| `npm test` | vitest unit tests (API client and token handling, log filter and ring buffer, socket reconnect, routes, formatting, theme, motion, the server link state machine and the shutdown form's countdown parser) |
| `npm run gen:api` | regenerate the API types, see below |

## Build and serve with poe-server

```sh
npm run build
```

Then, in the server's `config/server.toml`:

```toml
[web]
static_dir = "modules/web-admin/dist"
```

`poe-server` serves the files at `/` on the `[web] bind` address (default `http://127.0.0.1:8080`) and answers any other
non-API path with `index.html`. The app uses hash routes (`#/accounts`) and relative asset URLs, and calls the API on its
own origin at `/api/v1/...`, so it must be served from the root of the server's origin. CI uploads the built `dist/` as an artifact.

During development you can instead run `npm run dev` and, if you prefer calling the API directly from the Vite origin,
list `http://localhost:5173` in `[web] cors_origins`. That is not needed with the proxy.

## API types

`src/lib/api/schema.d.ts` is generated by [`openapi-typescript`](https://openapi-ts.dev) from the OpenAPI document that
`poe-web-api` emits (`cargo xtask openapi` in Poe2Server writes `docs/openapi.json`) and is committed.

```sh
npm run gen:api                                   # reads docs/openapi.json of Poe2Server (../../docs/openapi.json here, ../server/docs/openapi.json inside the hub)
npm run gen:api -- path/to/openapi.json           # any file
npm run gen:api -- http://127.0.0.1:8080/api/v1/openapi.json   # a running server
```

Regenerate after the API changes, fix whatever `npm run check` then reports, and commit the new file. The typed client is in
`src/lib/api/client.ts` ([`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/)); the token store in `src/lib/api/token.ts`.

## Layout

```
src/
  main.ts, App.svelte, app.css      shell (grouped sidebar, banner), announce dialog, the one stylesheet
  tokens.css                        design tokens (identical copy of the launcher's)
  pages/                            one component per page
  lib/api/                          schema.d.ts (generated), client.ts, token.ts
  lib/logs/                         log filter + ring buffer + message parsing (ring.ts), reconnecting WebSocket (socket.ts)
  lib/*.svelte.ts                   auth, router, theme, polling Resource, toasts and confirmations, the server link (Svelte runes)
  lib/serverLink.ts, shutdown.ts    the reconnect state machine (pure), the countdown field's limits
  lib/ui/                           Icon, Chip, Empty, Progress, Modal, ConfirmDialog, Toasts, ServerControl, ShutdownBanner, ...
  lib/ui/LineChart.svelte           the SVG chart (scales and paths in lib/chart.ts), ActivityCharts, MotdCard, BanDialog, DiffView
  lib/chart.ts, duration.ts         chart scaling, ticks, number formats; "7d" and "1h30m" parsing for bans
  lib/schedule.ts, configForm.ts    task and schedule forms and their checks; the config form (values, changes, bounds)
  lib/diff.ts, players.ts, motd.ts  the line diff of the config review; player filters and ban wording; the message limits
scripts/gen-api.mjs                 the gen:api script
```

## Security notes

Passwords are sent in request bodies. The server listens on loopback by default; put a TLS reverse proxy in front before
exposing it. The log WebSocket does not take the session token in its URL (browsers cannot set headers on a WebSocket):
the page asks `POST /api/v1/admin/logs/ws-ticket` for a single-use ticket before every connection attempt and puts that in
the query string, so a proxy's access log never holds a usable credential. The server sends a content security policy
(own scripts, styles and connections only) with the files. Report vulnerabilities as described in [SECURITY.md](SECURITY.md).

## Disclaimer

This is an unofficial, fan-made project for personal and educational use. It is **not affiliated with, endorsed by or connected to Grinding Gear Games**; "Path of Exile" is their trademark. **No game files are distributed** in this repository (no assets, bundles, tables or executables): you need your own legal copy of the game. Use is at your own risk. This site only administers the private server of Poe2ModdingProject.

Contributing: [CONTRIBUTING.md](https://github.com/Distorbed678/Poe2ModdingProject/blob/main/CONTRIBUTING.md) in the main repository (checks for this repo: `npm run check`, `npm test`, `npm run build`).

## License

MIT: [LICENSE](LICENSE). Copyright (c) 2026 Distorbed678 and contributors.
