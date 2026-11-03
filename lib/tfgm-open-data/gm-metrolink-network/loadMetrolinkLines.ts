import type { FeatureCollection } from "geojson";
import metrolinkLinesJson from "../../../data/tfgm-open-data/gm-metrolink-network/Metrolink_Lines_Functional.json";

export const metrolinkLinesGeoJSON = metrolinkLinesJson as FeatureCollection;
