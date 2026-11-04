import linkShapesJson from "../data/link-shapes.json";
import { lines, type Line } from "./lines";

/**
 * The links between neighbouring stops that the map draws, with the lines that run along each and the track's shape.
 * Which lines run where comes from line-stops.json (via lib/lines), the same as the rest of the site; the shapes from
 * `npm run gtfs-link-shapes`.
 */
export type MapLink = {
  /** Stop-level ATCO codes */
  from: string;
  to: string;
  /** Lines running along this link, in drawing order */
  lines: Line[];
  /** [lon, lat] pairs from `from` to `to` */
  coordinates: [number, number][];
};

/**
 * The order lines are drawn side by side where they share track. Neighbours in this order tend to share track, which
 * keeps lines from crossing over each other as they join and leave
 */
const DRAWING_ORDER = ["Yellow Line", "Red Line", "Pink Line", "Navy Line", "Green Line", "Purple Line", "Blue Line"];
const drawingIndex = ({ id }: Line) => {
  const index = DRAWING_ORDER.indexOf(id);
  return index === -1 ? DRAWING_ORDER.length : index;
};

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

const linesByPair = new Map<string, Line[]>();
lines.forEach((line) => {
  line.links.forEach(([from, to]) => {
    const key = pairKey(from.atcoCode, to.atcoCode);
    const pairLines = linesByPair.get(key) ?? [];
    if (!pairLines.includes(line)) {
      linesByPair.set(key, [...pairLines, line]);
    }
  });
});

const mapLinks: MapLink[] = (linkShapesJson as { from: string; to: string; coordinates: [number, number][] }[])
  .map((link) => ({
    ...link,
    lines: [...(linesByPair.get(pairKey(link.from, link.to)) ?? [])].sort((a, b) => drawingIndex(a) - drawingIndex(b)),
  }))
  .filter(({ lines }) => lines.length > 0);

/**
 * Links pointing away from the city centre (St Peter's Square). Lines are drawn offset to one side of a link's
 * direction, so links along a branch need to point the same way for each line to stay on the same side
 */
export const orientedMapLinks: MapLink[] = (() => {
  const ROOT = "9400ZZMASTP";
  const byStop = new Map<string, MapLink[]>();
  mapLinks.forEach((link) => {
    [link.from, link.to].forEach((stop) => byStop.set(stop, [...(byStop.get(stop) ?? []), link]));
  });

  const oriented = new Map<MapLink, MapLink>();
  const queue = [ROOT];
  const visited = new Set(queue);
  while (queue.length > 0) {
    const stop = queue.shift() as string;
    (byStop.get(stop) ?? []).forEach((link) => {
      if (oriented.has(link)) {
        return;
      }
      const next = link.from === stop ? link.to : link.from;
      oriented.set(
        link,
        link.from === stop
          ? link
          : { ...link, from: link.to, to: link.from, coordinates: [...link.coordinates].reverse() }
      );
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    });
  }

  // Anything not connected to the centre (which shouldn't happen) keeps its original direction
  return mapLinks.map((link) => oriented.get(link) ?? link);
})();
