import { readFile, readdir } from "fs/promises";
import { GeoJsonObject } from "geojson";
import { isGeoJSONObject } from "geojson-validation";
import path from "path";

const GEOJSON_PATH = path.join(process.cwd(), "data/lines/isochrones/geojson");

const tsIsGeoJsonObject = (data: unknown): data is GeoJsonObject => isGeoJSONObject(data);

type isochroneEntry = [string, GeoJsonObject];
type isochroneMap = Record<string, GeoJsonObject>;

export const loadIsochrones = async (): Promise<isochroneMap> => {
  const files = (await readdir(GEOJSON_PATH)).filter((filename) => filename.endsWith(".geojson"));

  const jsons = await Promise.allSettled(
    files.map(async (filename) => {
      const data = await readFile(`${GEOJSON_PATH}/${filename}`);
      const json = JSON.parse(data.toString()) as unknown;

      if (!tsIsGeoJsonObject(json)) {
        throw new Error("Invalid geojson file");
      }

      return [filename.replace(/\.geojson$/, ""), json];
    })
  );

  const geojsons = jsons
    .filter((v): v is PromiseFulfilledResult<isochroneEntry> => v.status === "fulfilled")
    .map((v) => v.value);

  return Object.fromEntries(geojsons);
};
