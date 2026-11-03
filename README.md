# metrolink stops

Live departures for Manchester Metrolink stops, plus a travel time map.

It's a fully static single page app (Vite + React). Live departures and alerts are fetched by the browser directly from
TfGM's GraphQL API (`https://apiary.tfgm.com/`), which needs no key and allows cross-origin requests. Everything else
(stops, lines, the travel time map) is generated from TfGM data, committed under `data/`, and bundled at build time.

## Development

```bash
cp .env.example .env.local # then fill in as required
npm install
npm run dev
```

`npm run lint` and `npm run type-check` run as a pre-commit hook.

## Building and hosting

```bash
npm run build   # outputs to dist/
npm run preview # serve dist/ locally
```

`dist/` can be served by any static file server, with two requirements:

- **Single page app fallback**: serve `index.html` for any path that isn't a file, so stop URLs like `/cornbrook`
  work on direct visits and refreshes.
- **Don't cache `/sw.js` long-term**, so browsers pick up the worker that retires old service workers. Everything under `/assets/` is content-hashed
  and can be cached forever.

For example, with Caddy:

```caddy
metrolink.example.com {
	root * /srv/metrolink-stop/dist
	encode gzip zstd
	try_files {path} /index.html
	file_server

	header /sw.js Cache-Control "no-cache"
	header /assets/* Cache-Control "public, max-age=31536000, immutable"
}
```

Environment variables (see `.env.example`) are baked in at build time, so rebuild after changing them.

If TfGM ever stop allowing cross-origin requests, set `VITE_TFGM_GRAPHQL_ENDPOINT` to a proxy that forwards to
`https://apiary.tfgm.com/` (e.g. a small Cloudflare Worker). `lib/tfgm-graphql.ts` has no browser-specific code, so
it can be reused there.

### URL compatibility

Stop URLs are slugs of the stop names originally used by the TfGM OData API, and the same names are stored in
visitors' local storage (recently visited stops). `lib/stops.ts` keeps those names stable; check it when stops are
added or renamed. Older URLs with an `/en-GB` prefix, and `/map` and `/travel`, redirect to their current equivalents.

## Data

Generated data lives in `data/` and is committed:

| Data                                   | Source              | Regenerate with                       |
| -------------------------------------- | ------------------- | ------------------------------------- |
| `data/lines/stops.json`                | TfGM GTFS           | `npm run regenerate-gtfs-stops`       |
| `data/lines/lines.json`                | TfGM GTFS           | `npm run regenerate-gtfs-lines`       |
| `data/lines/isochrones/`               | TfGM GTFS (needs R) | `npm run regenerate-gtfs-isochrones`  |
| `data/stop-lines.json`                 | TfGM GraphQL API    | `npm run regenerate-stop-lines`       |
| `data/tfgm-open-data/`                 | TfGM open data      | Manually downloaded                   |

After regenerating, rebuild and redeploy.
