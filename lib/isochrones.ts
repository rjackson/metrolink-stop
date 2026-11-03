import type { GeoJsonObject } from "geojson";

// Each stop's isochrone is bundled as its own chunk and only fetched when that stop is selected, rather than shipping
// all of them (several MB) up front
const loaders = import.meta.glob<string>("../data/lines/isochrones/geojson/*.geojson", {
  query: "?raw",
  import: "default",
});

const loadersByStopId = new Map(
  Object.entries(loaders).map(([path, load]) => [path.replace(/^.*\//, "").replace(/\.geojson$/, ""), load])
);

const cache = new Map<string, Promise<GeoJsonObject>>();

/**
 * Load the isochrone for a GTFS stop ID (e.g. 9400ZZMAABM1). Resolves to undefined if there isn't one
 */
export function loadIsochrone(stopId: string): Promise<GeoJsonObject | undefined> {
  const load = loadersByStopId.get(stopId);

  if (!load) {
    return Promise.resolve(undefined);
  }

  let isochrone = cache.get(stopId);
  if (!isochrone) {
    isochrone = load().then((raw) => JSON.parse(raw) as GeoJsonObject);
    cache.set(stopId, isochrone);
  }

  return isochrone;
}
