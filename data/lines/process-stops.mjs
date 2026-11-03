/**
 * Write stops.json: one platform per Metrolink stop, the one the isochrones were calculated from (see
 * calculate-stop-times.R, which merges each stop's platforms). Run after the isochrones, from data/lines.
 *
 * Reads the normalised feed in ./gtfs (see normalise-gtfs.mjs), where Metrolink stop_ids are ATCO codes.
 */
import { readdir, readFile, writeFile } from "fs/promises";
import { parse } from "csv-parse/sync";

const STOP_TIMES_PATH = "./isochrones/time-between-stops";
const STOPS_PATH = "./stops.json";

// The GTFS stops.txt columns, in the order they're written. Missing or empty values are written as null
const COLUMNS = [
  "stop_id",
  "stop_code",
  "stop_name",
  "tts_stop_name",
  "stop_desc",
  "stop_lat",
  "stop_lon",
  "zone_id",
  "stop_url",
  "location_type",
  "parent_station",
  "stop_timezone",
  "wheelchair_boarding",
  "level_id",
  "platform_code",
];
const NUMERIC_COLUMNS = new Set(["stop_lat", "stop_lon", "location_type", "wheelchair_boarding"]);

const isochroneStops = new Set(
  (await readdir(STOP_TIMES_PATH))
    .filter((filename) => filename.endsWith(".csv"))
    .map((filename) => filename.split(".")[0])
);

const rows = parse(await readFile("gtfs/stops.txt"), { columns: true, bom: true });

const stops = rows
  .filter(({ stop_id }) => stop_id.startsWith("9400ZZMA") && isochroneStops.has(stop_id))
  .sort((a, b) => a.stop_id.localeCompare(b.stop_id))
  .map((row) =>
    Object.fromEntries(
      COLUMNS.map((column) => {
        const value = row[column] ?? "";
        if (value === "") {
          return [column, null];
        }
        return [column, NUMERIC_COLUMNS.has(column) ? Number(value) : value];
      })
    )
  );

await writeFile(STOPS_PATH, JSON.stringify(stops, null, 2));
console.log(`Wrote ${stops.length} stops to ${STOPS_PATH}`);
