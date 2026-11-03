# metrolink stops

Live departures and service alerts for Manchester Metrolink tram stops, plus a travel time map showing how far you can
get from each stop.

## How it works

It's a fully static single page app (Vite, React, React Router). There is no backend:

- **Live data** (departures, alerts) is fetched by the browser directly from TfGM's GraphQL API at
  `https://apiary.tfgm.com/`, the API behind tfgm.com's own departure boards. It needs no key and allows cross-origin
  requests. It is undocumented, so all access goes through `lib/tfgm-graphql.ts` and `lib/tfgm-metrolink.ts`.
- **Everything else** (the stop list, lines per stop, the travel time map) is generated from TfGM data, committed under
  `data/`, and bundled at build time.

| Path | What |
| --- | --- |
| `App.tsx`, `main.tsx`, `index.html` | App shell and routes |
| `pages/` | Home (stop search), stop, travel time map, debug, not found |
| `lib/stops.ts` | The stop list: names, ATCO codes, lines |
| `lib/tfgm-metrolink.ts` | Departures and alerts for a stop |
| `public/sw.js` | Retires old service workers (see below) |
| `scripts/` | Data regeneration and staleness check |
| `data/` | Generated data, committed |
| `deploy/` | Proxmox install script, release script, Caddy config |

### Compatibility

The site has been around a while, so a few things are deliberately kept stable:

- **Stop URLs** (e.g. `/st-peter's-square`) are slugs of stop names, and the same names are stored in visitors' local
  storage as "recently visited". The names are frozen in `data/stop-names.json`; never change an existing entry. New
  stops fall back to their GTFS name; add them to the file once they're live.
- **Old URLs** redirect: `/map` and `/travel` to `/time`, and the `/en-GB/...` prefixed URLs the old Next.js build
  served to their unprefixed equivalents.
- **Old service workers** are retired by `public/sw.js` (see below).

## Development

```bash
cp .env.example .env.local # then fill in as required
npm install
npm run dev
```

`npm run lint` and `npm run type-check` run as a pre-commit hook. `npm run build` builds to `dist/`, and
`npm run preview` serves that build locally.

Configuration is through `VITE_*` environment variables (see `.env.example`). They're baked into the bundle at build
time, so none of them are secret, and changing one needs a rebuild.

| Variable | |
| --- | --- |
| `VITE_ESRI_API_KEY` | Basemap for the travel time map |
| `VITE_FATHOM_TRACKING_CODE`, `VITE_FATHOM_CUSTOM_DOMAIN` | Fathom analytics; leave empty to disable |
| `VITE_TFGM_GRAPHQL_ENDPOINT` | Optional. Send TfGM API requests through a proxy (e.g. a Cloudflare Worker) instead, if TfGM ever stop allowing cross-origin requests. `lib/tfgm-graphql.ts` has no browser-specific code, so it can be reused there |

## Data

Data is regenerated, committed and deployed by hand, so what's committed is always what's deployed. It changes
rarely: only when stops open, close or move, or lines change.

| Data | Source | Regenerate with |
| --- | --- | --- |
| `data/stop-lines.json` | TfGM GraphQL API | `npm run regenerate-stop-lines` |
| `data/lines/isochrones/geojson/`, `data/lines/stops.json` | TfGM GTFS (needs R) | `npm run regenerate-gtfs` |
| `data/tfgm-open-data/` | TfGM open data | Downloaded by hand |
| `data/stop-names.json` | Frozen (see above) | Edited by hand |

`npm run regenerate-gtfs` downloads the feed, calculates travel times between stops (R), builds the isochrones, and
writes `stops.json` with one platform per stop, matching the isochrones. Each step is also available on its own
(`gtfs-prepare`, `gtfs-stop-times`, `gtfs-isochrones`, `gtfs-stops`).

The R step installs its packages into `data/lines/renv` with renv on first run, which takes a few minutes. The feed
is downloaded and normalised by `data/lines/prepare.sh` and `normalise-gtfs.mjs`: TfGM's current feed uses numeric
`stop_id`s with the ATCO code in `stop_code`, and the rest of the pipeline (and the site) keys Metrolink stops on
ATCO codes, so Metrolink stops are re-keyed by ATCO code first.

`npm run check-data` reports whether any of that is out of date, comparing only what the site depends on (the set of
Metrolink stops and their positions, and lines per stop) rather than the raw feed, which TfGM republish frequently. It
runs weekly on GitHub Actions (`.github/workflows/check-data.yml`) and fails when a manual update is needed. GitHub
disables scheduled workflows after 60 days without repository activity; that's fine, it's not critical.

## Deploying

### Proxmox (LXC + Caddy)

`deploy/proxmox-install.sh` creates an unprivileged Debian 13 container that builds the site and serves it with Caddy.
Copy it to the Proxmox host and run it as root:

```sh
bash proxmox-install.sh
```

It's self-contained (nothing else is fetched from the network besides this public repo, the npm packages in its
lockfile, and Debian's own packages), and asks for the optional build settings above on first run. Re-running it
updates an existing container in place, leaving its config alone.

| Variable | Default | Notes |
| --- | --- | --- |
| `CTID` | existing, else next free | Container id |
| `CT_HOSTNAME` | `metrolink-stop` | Also how the script finds an existing container |
| `CT_CPU` / `CT_RAM` / `CT_DISK` | `2` / `1024` MB / `4` GB | The RAM is for builds; serving needs very little |
| `CT_BRIDGE` / `CT_STORAGE` | `vmbr0` / `local-lvm` | |
| `REPO_URL` / `REPO_BRANCH` | this repo / `main` | |

Inside the container:

| Path | What |
| --- | --- |
| `/opt/metrolink-stop` | Git checkout, where builds happen |
| `/srv/metrolink-stop/releases/` | One directory per release, the newest 5 kept |
| `/srv/metrolink-stop/current` | Symlink to the live release, which Caddy serves |
| `/etc/metrolink-stop.env` | Build settings (`VITE_*`) |
| `/etc/caddy/Caddyfile` | Installed from `deploy/Caddyfile` on every release |

Day to day:

```sh
pct exec <CTID> -- update                  # pull, build and release the latest code
pct exec <CTID> -- journalctl -u caddy -f  # Caddy logs
pct enter <CTID>
```

`update` runs `deploy/release.sh` from the freshly pulled code, which builds into a new release directory, then
switches `current` over to it atomically, so visitors never see a half-written site. If the build fails, the previous
release stays live. Each release also keeps the previous release's assets, so visitors with the old version open can
still load its pages until they reload.

To roll back, point `current` at an earlier release:

```sh
ln -sfn /srv/metrolink-stop/releases/<release> /srv/metrolink-stop/current
```

### Exposing it with a Cloudflare tunnel

The tunnel is managed separately: point a public hostname at `http://<container IP>:80`. Caddy serves plain HTTP; the
tunnel terminates TLS.

Traffic through a tunnel always goes through Cloudflare's proxy, so Cloudflare's cache is in front automatically, and
works with the site as is. Caching is controlled by the `Cache-Control` headers set in `deploy/Caddyfile`:

| Files | `Cache-Control` | Effect |
| --- | --- | --- |
| `/assets/*` (content-hashed by Vite) | `public, max-age=31536000, immutable` | Cached by Cloudflare and browsers for a year |
| Everything else: `index.html`, `/sw.js`, page URLs, missing assets | `no-cache` | Always revalidated with the origin (a cheap 304 when unchanged) |

So **there's nothing to purge after a release**. A changed asset always gets a new filename, and the new
`index.html`, which references the new filenames, is never served stale.

That relies on Cloudflare respecting the origin's headers, which is its default. Don't:

- add a Cache Rule that caches everything (HTML included) with an Edge TTL that ignores the origin, or
- change Browser Cache TTL from "Respect Existing Headers".

Either would cache `index.html` and `/sw.js`, so visitors would keep getting the old release until it expired or you
purged the cache. Also leave Rocket Loader off, as it rewrites script tags.

### Hosting elsewhere

`dist/` (from `npm run build`) can be served by any static file server, given:

- a single page app fallback: serve `index.html` for any path that isn't a file, except under `/assets/`
- the `Cache-Control` headers above

`deploy/Caddyfile` does both.

## Service worker

The site doesn't use one. Older versions did (next-pwa), registered at `/sw.js`, and an installed service worker keeps
serving from its own caches until something replaces it. So `public/sw.js` is a self-destroying worker: browsers
re-check that URL for updates, pick it up, and it deletes every cache, unregisters itself, and reloads open pages
once. The app never registers it, so new visitors never get it. Keep it indefinitely.

Esri basemap tiles don't need one either: they're served with a 12-hour `Cache-Control`, and the browser's HTTP cache
also merges the duplicate requests the travel time map makes for its two basemap layers.
