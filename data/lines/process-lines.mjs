import { importGtfs, openDb } from "gtfs";
import { readFile, writeFile } from "fs/promises";
const config = JSON.parse(await readFile(new URL("./config.json", import.meta.url)));

const db = await openDb(config);
await importGtfs(config);

// Find trips that represent a whole traversal of the inbound and outbound direction of our lines
const exampleTripsPerLine = await db.all(`SELECT *
FROM (
        SELECT r.route_id,
            r.route_short_name,
            COUNT(*) as stop_count,
            t.trip_id,
            GROUP_CONCAT(s.stop_name) as all_stops,
            time(MIN(st.arrival_timestamp), 'unixepoch') as first_arrival,
            time(MAX(st.arrival_timestamp), 'unixepoch') as last_arrival,
            time(
                MAX(st.arrival_timestamp) - MIN(st.arrival_timestamp),
                'unixepoch'
            ) AS duration,
            IIF(INSTR(r.route_id, ':I:'), 'Inbound', 'Outbound') as direction,
            RANK() OVER (
                PARTITION BY route_short_name,
                INSTR(r.route_id, ':I:')
                ORDER BY COUNT(*) DESC
            ) as rank
        FROM stop_times st
            LEFT JOIN stops s ON st.stop_id = s.stop_id
            LEFT JOIN trips t ON t.trip_id = st.trip_id
            LEFT JOIN routes r ON r.route_id = t.route_id
        GROUP BY t.trip_id
        ORDER BY r.route_short_name,
            COUNT(*) DESC
    )
WHERE rank = 1
GROUP BY route_short_name,
    stop_count,
    direction
ORDER BY route_short_name,
    COUNT(*) DESC`);

// Enrich by looking up the stops per example trip, in-order, highlighting time-to-next-stop and time-from-previous-stop
const stopsPerLine = Object.fromEntries(
  await Promise.all(
    exampleTripsPerLine.map(async ({ route_id, route_short_name, direction, trip_id }) => {
      const stops = await db.all(
        `SELECT
    s.stop_name,
    s.stop_lat,
    s.stop_lon,
    st.arrival_timestamp,
    st.arrival_timestamp - LAG(st.arrival_timestamp) OVER (
        ORDER BY st.stop_sequence ASC
    ) AS "seconds_since_previous_stop",
    LEAD(st.arrival_timestamp) OVER (
        ORDER BY st.stop_sequence ASC
    ) - st.arrival_timestamp AS "seconds_to_next_stop"
FROM stop_times st
    LEFT JOIN stops s ON st.stop_id = s.stop_id
WHERE st.trip_id = ?`,
        [trip_id]
      );

      return [
        route_id,
        {
          route_id,
          route_short_name,
          direction,
          trip_id,
          stops,
        },
      ];
    })
  )
);

await writeFile("lines.json", JSON.stringify(stopsPerLine, null, 2));
