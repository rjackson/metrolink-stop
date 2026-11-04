/**
 * Record a snapshot of departures at every stop, plus network alerts when they change.
 *
 * Run once a minute by deploy/metrolink-poller.timer. Each run appends one line to the day's file, so recordings can
 * be replayed later to build statistics or develop features against real data. See README.md for the format.
 *
 *   POLLER_DATA_DIR  where to write (default /var/lib/metrolink-stop/snapshots)
 */
import { createHash } from "crypto";
import { createReadStream, createWriteStream } from "fs";
import { appendFile, mkdir, readdir, readFile, rename, rm, writeFile } from "fs/promises";
import path from "path";
import { pipeline } from "stream/promises";
import { createGzip } from "zlib";
import { stopIdentities } from "../lib/stops";
import { tfgmQuery, type TfgmRequestOptions } from "../lib/tfgm-graphql";

const DATA_DIR = process.env.POLLER_DATA_DIR ?? "/var/lib/metrolink-stop/snapshots";
const FORMAT_VERSION = 1;

// The API rejects queries over a complexity limit (TOO_COMPLEX); departures for 20 stops fits
const BATCH_SIZE = 20;

const requestOptions = (): TfgmRequestOptions => ({
  headers: { "user-agent": "metrolink-stop-poller (+https://github.com/rjackson/metrolink-stop)" },
  signal: AbortSignal.timeout(20_000),
});

type ApiDeparture = {
  trip: { carriages?: string; destinationDisplay?: string };
  timings: { status: string | null; wait: number | null; lastUpdated: string | null };
};

type DeparturesData = {
  locationByAtco: ({ atcoCode: string; departures?: ApiDeparture[] } | null)[];
};

const DEPARTURES_QUERY = `
  query PollDepartures($atcoCodes: [String!]!) {
    locationByAtco(atcoCodes: $atcoCodes) {
      atcoCode
      ... on MassTransportLocation {
        departures(limit: 20) {
          trip {
            ... on TramTrip {
              carriages
              destinationDisplay
            }
          }
          timings {
            status
            wait
            lastUpdated
          }
        }
      }
    }
  }
`;

const ALERTS_QUERY = `
  query PollAlerts {
    transportModes(modes: [TRAM]) {
      alerts {
        id
        title
        description
        advice
        effect
        validityScopes
        validityPeriods {
          start
          end
        }
        impactedServices {
          name
        }
        impactedLocations {
          atcoCode
        }
        impactedServicesAtLocations {
          locations {
            atcoCode
          }
          services {
            name
          }
        }
      }
    }
  }
`;

/** A departure, as [destination, carriages, status, wait in minutes] */
type DepartureRecord = [string | null, string | null, string | null, number | null];

type DeparturesSnapshot = {
  v: number;
  fetchedAt: string;
  durationMs: number;
  stops: Record<string, { lastUpdated: string | null; departures: DepartureRecord[] }>;
  /** Stops with no data in this snapshot, because their request failed */
  missing: string[];
  errors: string[];
};

async function snapshotDepartures(): Promise<DeparturesSnapshot> {
  const startedAt = Date.now();
  const snapshot: DeparturesSnapshot = {
    v: FORMAT_VERSION,
    fetchedAt: new Date(startedAt).toISOString(),
    durationMs: 0,
    stops: {},
    missing: [],
    errors: [],
  };

  const atcoCodes = stopIdentities.map(({ atcoCode }) => atcoCode);

  // One batch at a time, to keep the load on TfGM's API gentle
  for (let i = 0; i < atcoCodes.length; i += BATCH_SIZE) {
    const batch = atcoCodes.slice(i, i + BATCH_SIZE);
    try {
      const { locationByAtco } = await tfgmQuery<DeparturesData>(
        DEPARTURES_QUERY,
        { atcoCodes: batch },
        undefined,
        requestOptions()
      );

      locationByAtco.forEach((location) => {
        if (!location) {
          return;
        }
        const departures = location.departures ?? [];
        const lastUpdated = departures
          .map(({ timings }) => timings.lastUpdated)
          .filter((value): value is string => value !== null)
          .sort()
          .at(-1);

        snapshot.stops[location.atcoCode] = {
          lastUpdated: lastUpdated ?? null,
          departures: departures.map(({ trip, timings }) => [
            trip.destinationDisplay ?? null,
            trip.carriages ?? null,
            timings.status,
            timings.wait,
          ]),
        };
      });
    } catch (err) {
      snapshot.errors.push(`Stops ${batch[0]}..${batch.at(-1)}: ${String(err)}`);
    }
  }

  snapshot.missing = atcoCodes.filter((atcoCode) => !(atcoCode in snapshot.stops));
  snapshot.durationMs = Date.now() - startedAt;
  return snapshot;
}

/** The network's alerts, sorted by id so unchanged alerts produce identical output */
async function fetchAlerts(): Promise<unknown[]> {
  const { transportModes } = await tfgmQuery<{ transportModes: { alerts: { id: string }[] }[] }>(
    ALERTS_QUERY,
    {},
    undefined,
    requestOptions()
  );
  return (transportModes[0]?.alerts ?? []).sort((a, b) => a.id.localeCompare(b.id));
}

const today = () => new Date().toISOString().slice(0, 10);
const dayFile = (kind: string) => path.join(DATA_DIR, kind, `${today()}.jsonl`);

async function appendLine(file: string, record: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(record)}\n`);
}

/**
 * Record alerts only when they've changed since the last recording: they change rarely, and their descriptions are
 * long. The state file remembers what was last recorded.
 */
async function recordAlertsIfChanged(fetchedAt: string) {
  const alerts = await fetchAlerts();
  const hash = createHash("sha256").update(JSON.stringify(alerts)).digest("hex");
  const stateFile = path.join(DATA_DIR, "state.json");

  const state = JSON.parse(await readFile(stateFile, "utf8").catch(() => "{}")) as { alertsHash?: string };
  if (state.alertsHash === hash) {
    return false;
  }

  await appendLine(dayFile("alerts"), { v: FORMAT_VERSION, fetchedAt, alerts });
  await writeFile(stateFile, JSON.stringify({ ...state, alertsHash: hash }));
  return true;
}

/**
 * Gzip completed days' files. A whole day compresses far better than individual snapshots, as consecutive snapshots
 * are very similar.
 */
async function compressCompletedDays() {
  for (const kind of ["departures", "alerts"]) {
    const dir = path.join(DATA_DIR, kind);
    const files = await readdir(dir).catch(() => []);

    for (const file of files) {
      const match = /^(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(file);
      if (!match || match[1] >= today()) {
        continue;
      }

      const source = path.join(dir, file);
      const tmp = `${source}.gz.tmp`;
      await pipeline(createReadStream(source), createGzip({ level: 9 }), createWriteStream(tmp));
      await rename(tmp, `${source}.gz`);
      await rm(source);
      console.log(`Compressed ${kind}/${file}`);
    }
  }
}

async function main() {
  const snapshot = await snapshotDepartures();
  const stopCount = Object.keys(snapshot.stops).length;

  if (stopCount === 0) {
    throw new Error(`No stops returned. ${snapshot.errors.join("; ")}`);
  }

  await appendLine(dayFile("departures"), snapshot);

  const departureCount = Object.values(snapshot.stops).reduce((total, { departures }) => total + departures.length, 0);
  let summary = `${stopCount} stops, ${departureCount} departures in ${snapshot.durationMs}ms`;
  if (snapshot.missing.length > 0) {
    summary += `; missing ${snapshot.missing.length} stops: ${snapshot.errors.join("; ")}`;
  }

  try {
    if (await recordAlertsIfChanged(snapshot.fetchedAt)) {
      summary += "; alerts changed";
    }
  } catch (err) {
    summary += `; alerts failed: ${String(err)}`;
  }

  console.log(summary);
  await compressCompletedDays();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
