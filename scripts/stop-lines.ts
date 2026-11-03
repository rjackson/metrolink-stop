/**
 * Lines serving each stop, from the TfGM API. Shared by the regenerate and check scripts.
 */
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

/**
 * Fetch the lines serving every stop, as written to data/stop-lines.json (keys sorted for stable diffs)
 */
export async function fetchStopLines(): Promise<Record<string, string[]>> {
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

  return Object.fromEntries(
    Object.entries(linesByAtco)
      .flatMap(([atcoCode, lines]) => (lines ? [[atcoCode, lines] as const] : []))
      .sort(([a], [b]) => a.localeCompare(b))
  );
}
