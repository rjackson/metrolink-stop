import { writeFile } from "fs/promises";
import { openDb, importGtfs } from "gtfs";

const STOPS_PATH = "./stops.json";

await importGtfs({
  agencies: [{ path: "gtfs/" }],
});
const db = await openDb();

const stops = await db.all(`SELECT * FROM stops WHERE stop_id LIKE '9400ZZMA%'`);


writeFile(STOPS_PATH, JSON.stringify(stops));
