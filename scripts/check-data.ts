/**
 * Check whether the committed data is out of date, and needs regenerating by hand (see README).
 *
 * Compares only what the site depends on, rather than the raw GTFS feed (which TfGM republish frequently with
 * timetable changes):
 *
 * - The set of Metrolink stops, and their positions, against the latest TfGM GTFS feed
 * - The lines serving each stop, against the TfGM API (data/stop-lines.json)
 *
 * Exits non-zero, with a report, if anything differs. Run by .github/workflows/check-data.yml.
 */
import { execFileSync } from "child_process";
import { mkdtemp, readFile, rm, writeFile, appendFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { parse } from "csv-parse/sync";
import { fetchStopLines } from "./stop-lines";

const GTFS_URL = "https://odata.tfgm.com/opendata/downloads/TfGMgtfsnew.zip";
const DATA_DIR = path.join(__dirname, "../data");

// ~50m. Small enough to catch a stop being rebuilt, big enough to ignore coordinate rounding
const MOVED_THRESHOLD_DEGREES = 0.0005;

type GtfsStopRow = { stop_id: string; stop_code?: string; stop_name: string; stop_lat: string; stop_lon: string };
type CommittedStop = { stop_id: string; stop_name: string; stop_lat: number; stop_lon: number };

const toStopCode = (platformCode: string) => platformCode.replace(/\d+$/, "");

async function downloadGtfsStops(): Promise<GtfsStopRow[]> {
  const response = await fetch(GTFS_URL);
  if (!response.ok) {
    throw new Error(`Failed to download GTFS feed: ${response.status} ${response.statusText}`);
  }

  const dir = await mkdtemp(path.join(tmpdir(), "gtfs-"));
  try {
    const zipPath = path.join(dir, "gtfs.zip");
    await writeFile(zipPath, Buffer.from(await response.arrayBuffer()));
    const stopsTxt = execFileSync("unzip", ["-p", zipPath, "stops.txt"], { maxBuffer: 64 * 1024 * 1024 });
    return parse<GtfsStopRow>(stopsTxt, { columns: true, bom: true, relax_quotes: true });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Metrolink platforms in the GTFS feed, keyed by platform-level ATCO code (e.g. 9400ZZMAHTN1).
 *
 * Older feeds used the ATCO code as stop_id; newer ones use a numeric stop_id and put the ATCO code in stop_code.
 */
function metrolinkPlatforms(rows: GtfsStopRow[]): Map<string, GtfsStopRow> {
  const platforms = new Map<string, GtfsStopRow>();
  rows.forEach((row) => {
    const atcoCode = [row.stop_code, row.stop_id].find((code) => code?.startsWith("9400ZZMA"));
    if (atcoCode) {
      platforms.set(atcoCode, row);
    }
  });
  return platforms;
}

async function checkStops(problems: string[]) {
  const committed = JSON.parse(await readFile(path.join(DATA_DIR, "lines/stops.json"), "utf8")) as CommittedStop[];
  const platforms = metrolinkPlatforms(await downloadGtfsStops());

  if (platforms.size === 0) {
    problems.push("The GTFS feed contains no Metrolink stops. Its format may have changed.");
    return;
  }

  const committedStops = new Set(committed.map(({ stop_id }) => toStopCode(stop_id)));
  const gtfsStops = new Map<string, string>();
  platforms.forEach(({ stop_name }, atcoCode) => gtfsStops.set(toStopCode(atcoCode), stop_name));

  gtfsStops.forEach((name, stopCode) => {
    if (!committedStops.has(stopCode)) {
      problems.push(`New stop: ${name} (${stopCode})`);
    }
  });

  committed.forEach(({ stop_id, stop_name, stop_lat, stop_lon }) => {
    const stopCode = toStopCode(stop_id);
    if (!gtfsStops.has(stopCode)) {
      problems.push(`Stop no longer in GTFS: ${stop_name} (${stopCode})`);
      return;
    }

    const platform = platforms.get(stop_id);
    if (!platform) {
      problems.push(`Platform no longer in GTFS: ${stop_name} (${stop_id})`);
      return;
    }

    const moved =
      Math.abs(Number(platform.stop_lat) - stop_lat) > MOVED_THRESHOLD_DEGREES ||
      Math.abs(Number(platform.stop_lon) - stop_lon) > MOVED_THRESHOLD_DEGREES;
    if (moved) {
      problems.push(
        `Stop moved: ${stop_name} (${stop_id}) from ${stop_lat},${stop_lon} to ${platform.stop_lat},${platform.stop_lon}`
      );
    }
  });
}

async function checkStopLines(problems: string[]) {
  const committed = JSON.parse(await readFile(path.join(DATA_DIR, "stop-lines.json"), "utf8")) as Partial<
    Record<string, string[]>
  >;
  const latest: Partial<Record<string, string[]>> = await fetchStopLines();

  new Set([...Object.keys(committed), ...Object.keys(latest)]).forEach((stopCode) => {
    const before = JSON.stringify(committed[stopCode] ?? []);
    const after = JSON.stringify(latest[stopCode] ?? []);
    if (before !== after) {
      problems.push(`Lines changed for ${stopCode}: ${before} -> ${after}`);
    }
  });
}

async function main() {
  const problems: string[] = [];

  // Run both, even if one fails, so the report is complete
  const results = await Promise.allSettled([checkStops(problems), checkStopLines(problems)]);
  results.forEach((result) => {
    if (result.status === "rejected") {
      problems.push(`Check failed to run: ${String(result.reason)}`);
    }
  });

  const report =
    problems.length === 0
      ? "Committed data is up to date."
      : [
          "Committed data is out of date. Regenerate it by hand (see README), then rebuild and redeploy.",
          "",
          ...problems.map((problem) => `- ${problem}`),
        ].join("\n");

  console.log(report);

  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Data check\n\n${report}\n`);
  }

  process.exit(problems.length === 0 ? 0 : 1);
}

void main();
