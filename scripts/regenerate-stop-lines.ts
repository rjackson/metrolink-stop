/**
 * Fetch the lines serving each stop from the TfGM API and write them to data/stop-lines.json, which the stop search
 * uses. Lines change rarely, so this is run manually alongside the other data regeneration scripts.
 */
import { writeFile } from "fs/promises";
import path from "path";
import { fetchStopLines } from "./stop-lines";

const OUTPUT_PATH = path.join(__dirname, "../data/stop-lines.json");

async function main() {
  const stopLines = await fetchStopLines();
  await writeFile(OUTPUT_PATH, JSON.stringify(stopLines, null, 2) + "\n");
  console.log(`Wrote lines for ${Object.keys(stopLines).length} stops to ${OUTPUT_PATH}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
