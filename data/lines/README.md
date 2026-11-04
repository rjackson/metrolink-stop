# GTFS Processing

This folder downloads TfGM's General Transit Feed Specification (GTFS) dataset,
[GM Public Transport Schedules – GTFS dataset](https://data.gov.uk/dataset/c3ca6469-7955-4a57-8bfc-58ef2361b797/gm-public-transport-schedules-gtfs-dataset),
and derives the data behind the travel time map. See the main README for when and how to run it.

| Step | Script | Output |
| --- | --- | --- |
| Download and normalise the feed | `prepare.sh`, `normalise-gtfs.mjs` | `gtfs/` (not committed) |
| Travel times between stops | `calculate-stop-times.R` (R, packages via renv) | `isochrones/time-between-stops/` (not committed) |
| Isochrones | `process-isochrones.mjs` | `isochrones/geojson/` |
| Stops | `process-stops.mjs` | `stops.json` |
| Stop order along each line | `process-line-stops.mjs` | `../line-stops.json` |

## Feed format

TfGM's feed format has changed over time. Older feeds used ATCO codes as Metrolink `stop_id`s (e.g. `9400ZZMAHTN1`) and
prefixed Metrolink route and trip ids with `METL`. Current feeds use numeric `stop_id`s with the ATCO code in
`stop_code`. `normalise-gtfs.mjs` re-keys Metrolink stops by ATCO code, so everything downstream (and the site) can
rely on them, and handles both formats.

Metrolink routes are named for the colour of the line on TfGM's network map (`route_short_name`, e.g. "Blue Line"),
which is how tram routes are told apart from the replacement buses that share the Metrolink agency.

## Stop names

GTFS stop names are suffixed with "(Manchester Metrolink)", and differ in places from the names TfGM use elsewhere,
and from each other over time. For example:

| GTFS stop name | Name used by the site |
| --- | --- |
| Newton Heath & Moston (Manchester Metrolink) | Newton Heath and Moston |
| Deansgate-Castlefield (Manchester Metrolink) | Deansgate - Castlefield |
| Besses o'th'Barn (Manchester Metrolink) | Besses O’ Th’ Barn |

The site's names are frozen in `../stop-names.json`, so GTFS renames don't change stop URLs.

## Travel Time Map (isochrones)

Adapted from [chriswhong/nyc-subway-isochrones](https://github.com/chriswhong/nyc-subway-isochrones).

For each stop, `calculate-stop-times.R` computes the travel time to every other stop around midday on a Wednesday
(with gtfsrouter), merging each stop's platforms into one. `process-isochrones.mjs` then buffers each reachable stop
by the distance walkable in the time left over, for 10, 20, 30 and 40 minute bands.
