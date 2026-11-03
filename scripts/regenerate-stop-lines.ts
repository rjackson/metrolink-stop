/**
 * Fetch the lines serving each stop from the TfGM API and write them to data/stop-lines.json, which the stop search
 * uses. Lines change rarely, so this is run manually alongside the other data regeneration scripts.
 */
import { writeFile } from "fs/promises";
import path from "path";
import { stopIdentities } from "../lib/stops";
import { tfgmQuery } from "../lib/tfgm-graphql";

type StopLinesData = {
  locationByAtco: ({
    atcoCode: string;
    lines?: { id: string; services: { name: string }[] }[];
  } | null)[];
};

const STOP_LINES_QUERY = `
  query GetTramStopLines($atcoCodes: [String!]!) {
    locationByAtco(atcoCodes: $atcoCodes) {
      atcoCode
      ... on MassTransportLocation {
        lines {
          ... on TramLine {
            id
            services {
              name
            }
          }
        }
      }
    }
  }
`;

const OUTPUT_PATH = path.join(__dirname, "../data/stop-lines.json");

async function main() {
  const { locationByAtco } = await tfgmQuery<StopLinesData>(STOP_LINES_QUERY, {
    atcoCodes: stopIdentities.map(({ atcoCode }) => atcoCode),
  });

  const linesByAtco: Partial<Record<string, string[]>> = {};
  locationByAtco.forEach((location) => {
    if (!location) {
      return;
    }

    const lines = (location.lines ?? []).flatMap(({ id, services }) => [
      id.replace(/_/g, " "),
      ...services.map(({ name }) => name),
    ]);
    linesByAtco[location.atcoCode] = [...new Set(lines)];
  });

  const missing = stopIdentities.filter(({ atcoCode }) => !linesByAtco[atcoCode]);
  if (missing.length > 0) {
    throw new Error(`No lines found for: ${missing.map(({ StationLocation }) => StationLocation).join(", ")}`);
  }

  // Sorted keys for stable diffs
  const sorted = Object.fromEntries(Object.entries(linesByAtco).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(OUTPUT_PATH, JSON.stringify(sorted, null, 2) + "\n");
  console.log(`Wrote lines for ${Object.keys(sorted).length} stops to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
