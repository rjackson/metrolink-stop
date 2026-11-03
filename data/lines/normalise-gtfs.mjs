/**
 * Normalise TfGM's GTFS feed (unzipped in ./gtfs) into the shape the rest of this pipeline expects.
 *
 * TfGM's feed format has changed over time. Older feeds used ATCO codes as Metrolink stop_ids (e.g. 9400ZZMAHTN1)
 * and prefixed Metrolink route and trip ids with METL. Current feeds use numeric stop_ids, with the ATCO code in
 * stop_code, and no prefixes. So:
 *
 * 1. Metrolink stops get their ATCO code as stop_id, in stops.txt and stop_times.txt. The R script, the isochrone
 *    filenames, and the site all key stops on these. Other stops are left alone.
 * 2. The full feed (minus shapes, which nothing uses) is re-zipped as gtfs/tfgm.zip for the R script, which needs
 *    every stop to build walking transfers.
 * 3. routes.txt, trips.txt and stop_times.txt are then reduced to Metrolink trams only (not replacement buses), for
 *    the node-gtfs scripts.
 *
 * Works with both old and new feed formats. Run from data/lines, after unzipping the feed into ./gtfs.
 */
import { createReadStream, createWriteStream } from "fs";
import { readFile, rename, rm } from "fs/promises";
import { once } from "events";
import { execFileSync } from "child_process";
import readline from "readline";

const GTFS_DIR = "gtfs";

/** Parse one CSV line (RFC 4180 quoting, no embedded newlines) */
function parseLine(line) {
  const fields = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

function formatLine(fields) {
  return fields.map((field) => (/[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field)).join(",");
}

/**
 * Rewrite a GTFS file row by row. `transform` receives each row as an object keyed by column, and returns the row to
 * write (possibly modified), or null to drop it. Streams, as stop_times.txt is a few hundred MB.
 */
async function rewrite(filename, transform) {
  const path = `${GTFS_DIR}/${filename}`;
  const tmpPath = `${path}.tmp`;
  const input = readline.createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  const output = createWriteStream(tmpPath);

  let header;
  let kept = 0;
  let dropped = 0;

  for await (const rawLine of input) {
    const line = header ? rawLine : rawLine.replace(/^﻿/, "");
    if (line === "") {
      continue;
    }

    if (!header) {
      header = parseLine(line);
      output.write(`${formatLine(header)}\n`);
      continue;
    }

    const values = parseLine(line);
    const row = Object.fromEntries(header.map((column, i) => [column, values[i] ?? ""]));
    const result = transform(row);

    if (result) {
      if (!output.write(`${formatLine(header.map((column) => result[column] ?? ""))}\n`)) {
        await once(output, "drain");
      }
      kept++;
    } else {
      dropped++;
    }
  }

  output.end();
  await once(output, "finish");
  await rename(tmpPath, path);
  console.log(`${filename}: kept ${kept}, dropped ${dropped}`);
}

async function readRows(filename) {
  const [headerLine, ...lines] = (await readFile(`${GTFS_DIR}/${filename}`, "utf8"))
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => line !== "");
  const header = parseLine(headerLine);
  return lines.map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(header.map((column, i) => [column, values[i] ?? ""]));
  });
}

// --- 1. Metrolink stops keyed by ATCO code ---------------------------------------------------------------------------

const atcoByStopId = new Map();
(await readRows("stops.txt")).forEach(({ stop_id, stop_code }) => {
  if (stop_code?.startsWith("9400ZZMA") && stop_id !== stop_code) {
    atcoByStopId.set(stop_id, stop_code);
  }
});
console.log(`Re-keying ${atcoByStopId.size} Metrolink platforms by ATCO code`);

const toAtco = (row) => ({ ...row, stop_id: atcoByStopId.get(row.stop_id) ?? row.stop_id });
await rewrite("stops.txt", toAtco);
await rewrite("stop_times.txt", toAtco);

// --- 2. Full feed, re-zipped for the R script -------------------------------------------------------------------------

await rm(`${GTFS_DIR}/shapes.txt`, { force: true });
await rm(`${GTFS_DIR}/tfgm.zip`, { force: true });
execFileSync("sh", ["-c", "cd gtfs && zip -q tfgm.zip *.txt"], { stdio: "inherit" });
console.log("Wrote gtfs/tfgm.zip");

// --- 3. Metrolink trams only, for node-gtfs ---------------------------------------------------------------------------

const metrolinkAgencyIds = new Set(
  (await readRows("agency.txt"))
    .filter(({ agency_name, agency_noc }) => agency_noc === "METL" || agency_name === "Metrolink")
    .map(({ agency_id }) => agency_id)
);
if (metrolinkAgencyIds.size === 0) {
  throw new Error("No Metrolink agency found in agency.txt");
}

// Tram routes are named for their line colour ("Blue Line"); replacement buses share the agency but not the naming
const isTramRoute = ({ agency_id, route_id, route_short_name }) =>
  (metrolinkAgencyIds.has(agency_id) || route_id.startsWith("METL")) && /Line$/.test(route_short_name);

const routeIds = new Set();
await rewrite("routes.txt", (route) => {
  if (!isTramRoute(route)) {
    return null;
  }
  routeIds.add(route.route_id);
  return route;
});

const tripIds = new Set();
await rewrite("trips.txt", (trip) => {
  if (!routeIds.has(trip.route_id)) {
    return null;
  }
  tripIds.add(trip.trip_id);
  return trip;
});

await rewrite("stop_times.txt", (stopTime) => (tripIds.has(stopTime.trip_id) ? stopTime : null));

