import { readFile } from "fs/promises";
import { FeatureCollection } from "geojson";
import { isFeatureCollection } from "geojson-validation";
import path from "path";

const METROLINK_LINES_PATH = path.join(process.cwd(), "data/tfgm-open-data/gm-metrolink-network/Metrolink_Lines_Functional.json");

const tsIsFeatureCollection = (data: unknown): data is FeatureCollection => isFeatureCollection(data);

export const loadMetrolinkLinesGeoJSON = async (): Promise<FeatureCollection> => {
  const data = await readFile(METROLINK_LINES_PATH);
  const json = JSON.parse(data.toString()) as unknown;

  if (!tsIsFeatureCollection(json)) {
    throw new Error("Invalid geojson file");
  }

  return json;
};