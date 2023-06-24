import { readdir, writeFile } from "fs/promises";
import { openDb, importGtfs } from "gtfs";

const STOP_TIMES_PATH = "./isochrones/time-between-stops";
const STOPS_PATH = "./stops.json";

await importGtfs({
  agencies: [{ path: "gtfs/" }],
});
const db = await openDb();

const isochroneStops = (await readdir(STOP_TIMES_PATH))
  .filter((filename) => filename.endsWith(".csv"))
  .map((filename) => filename.split(".")[0]);

const isochroneStopsMap = new Map(isochroneStops.map((stop_id) => [stop_id, undefined]));

const stops = (await db
  .all(`SELECT * FROM stops WHERE stop_id LIKE '9400ZZMA%'`))
  .filter(({ stop_id }) => isochroneStopsMap.has(stop_id));

writeFile(STOPS_PATH, JSON.stringify(stops, null, 2));
