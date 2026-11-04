/**
 * Write ../line-stops.json: the stops along each Metrolink line, in order, and which stops are next to each other.
 * The site uses it for the line dropdowns and the previous/next stop links. Run from data/lines.
 *
 * Reads the normalised feed in ./gtfs (see normalise-gtfs.mjs), where Metrolink stop_ids are platform-level ATCO codes
 * and routes/trips/stop_times are reduced to trams. Which stops are on which line comes from the TfGM API instead
 * (../stop-lines.json, from `npm run regenerate-stop-lines`), so run that first. The timetable also has trips the API
 * doesn't count as part of a line, such as Green Line trams running via Exchange Square, or Red Line trams to and from
 * the depot at Trafford Bar: those stops are skipped, and GTFS only supplies the order.
 *
 * Lines aren't simple A-to-B routes: some have short workings, variants (the Green Line runs via Market Street or
 * Exchange Square), branches (the Yellow Line's MediaCityUK spur) or extra legs (the Purple Line's Etihad Campus -
 * Victoria service), and direction_id isn't consistent between a line's routes. So, per line:
 *
 * 1. Collect each distinct stop pattern its trips follow.
 * 2. Start from the longest pattern (ties broken by the most trips), then fold in the others, most trips first. Each is
 *    turned to run the same way as what's been built so far, and stops not yet seen are slotted in next to the stop
 *    where they join. This gives one display order per line.
 * 3. Record every pair of consecutive stops, in display direction, so neighbours reflect where trams actually run,
 *    rather than wherever a branch happened to be slotted into the display order.
 * 4. Run the order the same way as the line's service name from the API (e.g. "Altrincham - Etihad Campus"), which is
 *    how people know the lines. The colour names (and the lines they cover) have changed over the years, and are
 *    secondary on the site.
 */
import { readFile, writeFile } from "fs/promises";
import { parse } from "csv-parse/sync";

const GTFS_DIR = "gtfs";
const OUTPUT_PATH = "../line-stops.json";
const STOP_LINES_PATH = "../stop-lines.json";
const STOP_NAMES_PATH = "../stop-names.json";

const readCsv = async (filename) =>
  parse(await readFile(`${GTFS_DIR}/${filename}`), {
    columns: true,
    bom: true,
  });

// Platform-level ATCO code to stop-level, which is what the site and the TfGM API use (9400ZZMAHTN1 -> 9400ZZMAHTN)
const toStopCode = (stopId) => stopId.replace(/\d+$/, "");

const isLineId = (name) => /Line$/.test(name);
const stopNames = JSON.parse(await readFile(STOP_NAMES_PATH, "utf8"));

/**
 * Stop codes on each line, and each line's service name, according to the TfGM API. stop-lines.json lists each line
 * followed by its services, e.g. ["Green Line", "Altrincham - Bury", "Blue Line", "Ashton-Under-Lyne - Bury"]
 */
const stopsByLine = new Map();
const serviceByLine = new Map();
Object.entries(JSON.parse(await readFile(STOP_LINES_PATH, "utf8"))).forEach(([stopCode, lines]) => {
  lines.forEach((line, i) => {
    if (isLineId(line) && lines[i + 1] && !isLineId(lines[i + 1])) {
      serviceByLine.set(line, lines[i + 1]);
    }
    if (!stopsByLine.has(line)) {
      stopsByLine.set(line, new Set());
    }
    stopsByLine.get(line).add(stopCode);
  });
});

const routes = await readCsv("routes.txt");
const trips = await readCsv("trips.txt");
const stopTimes = await readCsv("stop_times.txt");

const lineByRoute = new Map(routes.map(({ route_id, route_short_name }) => [route_id, route_short_name]));
const lineByTrip = new Map(trips.map(({ trip_id, route_id }) => [trip_id, lineByRoute.get(route_id)]));

/** Stop times per trip, as [stop_sequence, stop code] */
const callsByTrip = new Map();
stopTimes.forEach(({ trip_id, stop_id, stop_sequence }) => {
  if (!stop_id.startsWith("9400ZZMA")) {
    return;
  }
  if (!callsByTrip.has(trip_id)) {
    callsByTrip.set(trip_id, []);
  }
  callsByTrip.get(trip_id).push([Number(stop_sequence), toStopCode(stop_id)]);
});

/** Trip counts per stop pattern (stop codes joined with spaces), per line */
const patternsByLine = new Map();
callsByTrip.forEach((calls, tripId) => {
  const line = lineByTrip.get(tripId);
  const lineStopCodes = stopsByLine.get(line);
  if (!line || !lineStopCodes) {
    return;
  }

  const callingPattern = calls
    .sort(([a], [b]) => a - b)
    .map(([, stopCode]) => stopCode)
    // Platforms of the same stop can appear back to back
    .filter((stopCode, i, stopCodes) => stopCode !== stopCodes[i - 1]);

  // Split at stops that aren't on the line, rather than dropping them, so a tram via Exchange Square doesn't make
  // Victoria the Green Line's next stop after St Peter's Square
  const segments = [[]];
  callingPattern.forEach((stopCode) => {
    if (lineStopCodes.has(stopCode)) {
      segments[segments.length - 1].push(stopCode);
    } else if (segments[segments.length - 1].length > 0) {
      segments.push([]);
    }
  });

  if (!patternsByLine.has(line)) {
    patternsByLine.set(line, new Map());
  }
  const counts = patternsByLine.get(line);
  segments
    .filter((segment) => segment.length >= 2)
    .forEach((segment) => {
      const key = segment.join(" ");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
});

/**
 * Turn a pattern to run the same way as the display order, judged by whether the stops it shares with the order mostly
 * go forwards or backwards through it
 */
function orient(pattern, order) {
  const positions = pattern.map((stopCode) => order.indexOf(stopCode)).filter((position) => position !== -1);
  let forwards = 0;
  for (let i = 1; i < positions.length; i++) {
    forwards += Math.sign(positions[i] - positions[i - 1]);
  }
  return forwards < 0 ? [...pattern].reverse() : pattern;
}

/**
 * Slot a pattern's unseen stops into the display order, next to the stop where they join: straight after the known
 * stop before them, or, for stops at the start of the pattern, straight before the first known stop.
 */
function merge(order, pattern) {
  const merged = [...order];
  let i = 0;
  while (i < pattern.length) {
    if (merged.includes(pattern[i])) {
      i++;
      continue;
    }

    let end = i;
    while (end < pattern.length && !merged.includes(pattern[end])) {
      end++;
    }
    const run = pattern.slice(i, end);

    if (i > 0) {
      merged.splice(merged.indexOf(pattern[i - 1]) + 1, 0, ...run);
    } else if (end < pattern.length) {
      merged.splice(merged.indexOf(pattern[end]), 0, ...run);
    } else {
      // Shares no stops with the line so far. Not seen in practice, but don't lose it
      merged.push(...run);
    }
    i = end;
  }
  return merged;
}

const lineStops = {};
[...patternsByLine.keys()]
  .sort((a, b) => a.localeCompare(b))
  .forEach((line) => {
    const patterns = [...patternsByLine.get(line)]
      .map(([key, trips]) => ({ stops: key.split(" "), trips }))
      .sort((a, b) => b.stops.length - a.stops.length || b.trips - a.trips);

    let stops = patterns[0].stops;
    const oriented = [stops];
    [...patterns.slice(1)]
      .sort((a, b) => b.trips - a.trips)
      .forEach((pattern) => {
        const orientedStops = orient(pattern.stops, stops);
        oriented.push(orientedStops);
        stops = merge(stops, orientedStops);
      });

    // Run from the service name's first stop to its second
    const service = serviceByLine.get(line) ?? null;
    const [origin, destination] = service?.split(" - ") ?? [];
    const nameOf = (stopCode) => stopNames[stopCode];
    if (nameOf(stops[stops.length - 1]) === origin || nameOf(stops[0]) === destination) {
      stops = [...stops].reverse();
    }
    if (nameOf(stops[0]) !== origin || nameOf(stops[stops.length - 1]) !== destination) {
      console.warn(
        `${line}: runs ${nameOf(stops[0])} to ${nameOf(stops[stops.length - 1])}, but its service is "${service}"`
      );
    }

    const links = new Map();
    oriented.forEach((pattern) => {
      for (let i = 1; i < pattern.length; i++) {
        const [from, to] = [pattern[i - 1], pattern[i]];
        // Keep each link once, in display direction
        const pair = stops.indexOf(from) < stops.indexOf(to) ? [from, to] : [to, from];
        links.set(pair.join(" "), pair);
      }
    });

    lineStops[line] = {
      service,
      stops,
      links: [...links.values()].sort(
        ([a1, b1], [a2, b2]) => stops.indexOf(a1) - stops.indexOf(a2) || stops.indexOf(b1) - stops.indexOf(b2)
      ),
    };
  });

// Every stop the API lists should have turned up in the timetable
stopsByLine.forEach((stopCodes, line) => {
  if (!isLineId(line)) {
    return; // Service names, e.g. "Altrincham - Bury"
  }
  const missing = [...stopCodes].filter((stopCode) => !lineStops[line]?.stops.includes(stopCode));
  if (missing.length > 0) {
    throw new Error(`${line}: no timetabled trips call at ${missing.join(", ")}`);
  }
});

await writeFile(OUTPUT_PATH, JSON.stringify(lineStops, null, 2) + "\n");
console.log(
  `Wrote ${Object.keys(lineStops).length} lines to ${OUTPUT_PATH}: ` +
    Object.entries(lineStops)
      .map(([line, { service, stops }]) => `${service} (${line}, ${stops.length} stops)`)
      .join(", ")
);
