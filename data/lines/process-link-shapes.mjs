/**
 * Write ../link-shapes.json: the track's shape between each pair of neighbouring stops in ../line-stops.json, for the
 * map to draw the lines with. Run from data/lines, after process-line-stops.mjs.
 *
 * Reads the normalised feed in ./gtfs (see normalise-gtfs.mjs), where Metrolink stop_ids are platform-level ATCO codes
 * and the feed is reduced to trams. Which stops are neighbours comes from line-stops.json, so the map shows the same
 * lines as the rest of the site; the timetable only supplies the shapes, from a trip that runs directly between them.
 */
import { readFile, writeFile } from "fs/promises";
import { parse } from "csv-parse/sync";
import { lineString as turfLineString, simplify as turfSimplify } from "@turf/turf";

const LINE_STOPS_PATH = "../line-stops.json";
const OUTPUT_PATH = "../link-shapes.json";

const read = async (filename) => parse(await readFile(`gtfs/${filename}`), { columns: true, bom: true });

/** Platform-level ATCO code (9400ZZMAABM1) to stop-level (9400ZZMAABM) */
const stopLevel = (stopId) => stopId.replace(/\d+$/, "");
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

// Neighbouring stops on any line
const pairs = new Set(
  Object.values(JSON.parse(await readFile(LINE_STOPS_PATH, "utf8"))).flatMap(({ links }) =>
    links.map(([a, b]) => pairKey(a, b))
  )
);

const shapeIdByTrip = new Map((await read("trips.txt")).map((trip) => [trip.trip_id, trip.shape_id]));

// Each stop's position, the middle of its platforms, for any pair without a shape
const platformPositions = new Map();
(await read("stops.txt"))
  .filter(({ stop_id }) => stop_id.startsWith("9400ZZMA"))
  .forEach(({ stop_id, stop_lat, stop_lon }) => {
    const code = stopLevel(stop_id);
    platformPositions.set(code, [...(platformPositions.get(code) ?? []), [parseFloat(stop_lon), parseFloat(stop_lat)]]);
  });
const stopPositions = new Map(
  [...platformPositions].map(([code, positions]) => [
    code,
    [0, 1].map((axis) => positions.reduce((sum, position) => sum + position[axis], 0) / positions.length),
  ])
);

// Stop times, grouped by trip and in order
const stopTimesByTrip = new Map();
(await read("stop_times.txt")).forEach(({ trip_id, stop_id, stop_sequence, shape_dist_traveled }) => {
  const stopTimes = stopTimesByTrip.get(trip_id) ?? [];
  stopTimes.push({ stop: stopLevel(stop_id), sequence: Number(stop_sequence), distance: parseFloat(shape_dist_traveled) });
  stopTimesByTrip.set(trip_id, stopTimes);
});

// For each pair, the first trip found that runs directly between them, and how far along its shape each stop is
const trips = new Map();
for (const [tripId, stopTimes] of stopTimesByTrip) {
  const shapeId = shapeIdByTrip.get(tripId);
  if (!shapeId) {
    continue;
  }
  stopTimes.sort((a, b) => a.sequence - b.sequence);
  for (let i = 0; i < stopTimes.length - 1; i++) {
    const [a, b] = [stopTimes[i], stopTimes[i + 1]];
    const key = pairKey(a.stop, b.stop);
    if (pairs.has(key) && !trips.has(key) && !isNaN(a.distance) && !isNaN(b.distance)) {
      trips.set(key, { shapeId, start: a.distance, end: b.distance, reversed: a.stop > b.stop });
    }
  }
}

// Only the shapes we need
const neededShapes = new Set([...trips.values()].map(({ shapeId }) => shapeId));
const shapes = new Map();
(await read("shapes.txt"))
  .filter(({ shape_id }) => neededShapes.has(shape_id))
  .forEach(({ shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence, shape_dist_traveled }) => {
    const points = shapes.get(shape_id) ?? [];
    points.push({
      sequence: Number(shape_pt_sequence),
      distance: parseFloat(shape_dist_traveled),
      position: [parseFloat(shape_pt_lon), parseFloat(shape_pt_lat)],
    });
    shapes.set(shape_id, points);
  });
shapes.forEach((points) => points.sort((a, b) => a.sequence - b.sequence));

/** The point a given distance along a shape */
function positionAt(points, distance) {
  const after = points.findIndex((point) => point.distance >= distance);
  if (after <= 0) {
    return (after === 0 ? points[0] : points[points.length - 1]).position;
  }
  const [a, b] = [points[after - 1], points[after]];
  const t = (distance - a.distance) / (b.distance - a.distance || 1);
  return [0, 1].map((axis) => a.position[axis] + (b.position[axis] - a.position[axis]) * t);
}

/**
 * The track between two stops, from `from` to `to`. Ends are on the track (where the trip's stop times put the stops)
 * rather than at the stops' platforms, which are off to the side and would put a kink in the line
 */
function geometry(from, to, trip) {
  const points = trip ? (shapes.get(trip.shapeId) ?? []) : [];
  if (points.length === 0) {
    return [stopPositions.get(from), stopPositions.get(to)];
  }
  const [start, end] = [Math.min(trip.start, trip.end), Math.max(trip.start, trip.end)];
  const coordinates = [
    positionAt(points, start),
    ...points.filter(({ distance }) => distance > start && distance < end).map(({ position }) => position),
    positionAt(points, end),
  ];
  return trip.reversed ? coordinates.reverse() : coordinates;
}

const links = [...pairs].sort().map((key) => {
  const [from, to] = key.split("|");
  return { from, to, coordinates: geometry(from, to, trips.get(key)) };
});

// Links drawn from different trips' shapes end a few metres apart at a stop (on different tracks, say), so move every
// link's end at a stop to their average, so they join up
const endsByStop = new Map();
links.forEach(({ from, to, coordinates }) => {
  [
    [from, coordinates[0]],
    [to, coordinates[coordinates.length - 1]],
  ].forEach(([stop, position]) => endsByStop.set(stop, [...(endsByStop.get(stop) ?? []), position]));
});
const stopPoints = new Map(
  [...endsByStop].map(([stop, ends]) => [
    stop,
    [0, 1].map((axis) => ends.reduce((sum, position) => sum + position[axis], 0) / ends.length),
  ])
);
links.forEach((link) => {
  const coordinates = [stopPoints.get(link.from), ...link.coordinates.slice(1, -1), stopPoints.get(link.to)];
  // About 2m tolerance: plenty for a map, and keeps the file small
  const simplified = turfSimplify(turfLineString(coordinates), { tolerance: 0.00002, highQuality: true });
  link.coordinates = simplified.geometry.coordinates.map(([lon, lat]) => [Number(lon.toFixed(5)), Number(lat.toFixed(5))]);
});

const withoutShapes = links.filter(({ from, to }) => !trips.has(pairKey(from, to))).length;
console.log(`${links.length} links, ${withoutShapes} drawn as straight lines for want of a shape`);

await writeFile(OUTPUT_PATH, `${JSON.stringify(links, null, 1)}\n`);
console.log(`Wrote ${OUTPUT_PATH}`);
