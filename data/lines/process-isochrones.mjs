import { readFile, readdir, unlink, writeFile } from "fs/promises";
import {
  buffer as turfBuffer,
  dissolve as turfDissolve,
  point as turfPoint,
  truncate as turfTruncate,
} from "@turf/turf";
import { parse } from "csv-parse/sync";

const GEOJSON_PATH = "./isochrones/geojson";
const STOP_TIMES_PATH = "./isochrones/time-between-stops";

// Clear out existing geojsons
const geojsonFilenames = (await readdir(GEOJSON_PATH)).filter((filename) => filename.endsWith(".geojson"));
geojsonFilenames.forEach((filename) => unlink(`${GEOJSON_PATH}/${filename}`));

// Parse all stop-time CSVs and generate isochrone geojsons
const csvFilenames = (await readdir(STOP_TIMES_PATH)).filter((filename) => filename.endsWith(".csv"));

await Promise.all(
  csvFilenames.map(async (csvFilename) => {
    const [stopId] = csvFilename.split(".");
    console.log(`processing ${stopId}`);

    // Load and normalise inputs
    const csvContents = await readFile(`${STOP_TIMES_PATH}/${csvFilename}`);
    const records = parse(csvContents, {
      columns: true,
      cast: (value, context) => {
        if (context.header) {
          return value;
        }

        switch (context.column) {
          case "stop_lon":
          case "stop_lat":
            return parseFloat(value);

          case "duration":
            return parseInt(value);

          default:
            return value;
        }
      },
    });

    const TEN_MINUTES_IN_SECONDS = 600;
    const TWENTY_MINUTES_IN_SECONDS = 1200;
    const THIRTY_MINUTES_IN_SECONDS = 1800;
    const FORTY_MINUTES_IN_SECONDS = 2400;

    const groupTimeBreaks = [
      TEN_MINUTES_IN_SECONDS,
      TWENTY_MINUTES_IN_SECONDS,
      THIRTY_MINUTES_IN_SECONDS,
      FORTY_MINUTES_IN_SECONDS,
    ];

    const colorBreaks = ["#0570b0", "#74a9cf", "#bdc9e1", "#f1eef6"];

    const durationBreaks = ["10", "20", "30", "40"];

    const tenMinuteStations = records.filter((d) => d.duration <= TEN_MINUTES_IN_SECONDS);
    const twentyMinuteStations = records.filter((d) => {
      return d.duration > TEN_MINUTES_IN_SECONDS && d.duration <= TWENTY_MINUTES_IN_SECONDS;
    });
    const thirtyMinuteStations = records.filter((d) => {
      return d.duration > TWENTY_MINUTES_IN_SECONDS && d.duration <= THIRTY_MINUTES_IN_SECONDS;
    });
    const fortyMinuteStations = records.filter((d) => {
      return d.duration > THIRTY_MINUTES_IN_SECONDS && d.duration <= FORTY_MINUTES_IN_SECONDS;
    });

    const groupedStations = [tenMinuteStations, twentyMinuteStations, thirtyMinuteStations, fortyMinuteStations];

    const theIsochrones = [];

    groupedStations.forEach((group, i) => {
      let buffers = [];

      group.forEach(({ stop_lon, stop_lat, duration }) => {
        // 10 minutes - duration = leftover seconds to walk
        // leftover seconds to walk / 1.2 m/s = buffer distance
        const leftoverSeconds = groupTimeBreaks[i] - duration;
        const bufferInMeters = leftoverSeconds * 1.2;
        const bufferInKm = bufferInMeters <= 0 ? 0.01 : bufferInMeters / 1000;
        buffers = [...buffers, turfBuffer(turfPoint([stop_lon, stop_lat]), bufferInKm)];
      });

      // buffer the previous buffer
      if (i > 0) {
        const nextWalkingBuffer = turfBuffer(
          theIsochrones[i - 1],
          0.72 // 10 minutes walking
        );
        buffers = [...buffers, ...nextWalkingBuffer.features];
      }

      const FC = {
        type: "FeatureCollection",
        features: buffers,
      };
      const dissolvedFC = turfDissolve(FC);

      dissolvedFC.features = dissolvedFC.features.map((d) => {
        return {
          ...d,
          properties: {
            fill: colorBreaks[i],
            duration: durationBreaks[i],
          },
        };
      });

      theIsochrones.push(dissolvedFC);
    });

    // walking = 72 meters/minute
    const arrayOfAllFeatures = theIsochrones
      .map((d) => d.features)
      .reduce((curr, acc) => {
        return [...acc, ...curr];
      }, []);

    const consolidatedFC = {
      type: "FeatureCollection",
      features: arrayOfAllFeatures,
    };

    var options = { precision: 5, coordinates: 2 };
    const truncatedFC = turfTruncate(consolidatedFC, options);

    writeFile(`${GEOJSON_PATH}/${stopId}.geojson`, JSON.stringify(truncatedFC));
  })
);
