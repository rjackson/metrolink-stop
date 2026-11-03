import gtfsStops from "./gtfs-stops";

/**
 * Client for TfGM's GraphQL API (the backend behind tfgm.com's live departure pages).
 *
 * This replaced the deprecated api.tfgm.com OData endpoint. The API is unauthenticated, has introspection disabled
 * and masks error details, so the query shapes here are taken from what tfgm.com itself uses.
 */
const endpoint = process.env.TFGM_GRAPHQL_ENDPOINT ?? "https://apiary.tfgm.com/";

export type Destination = "See Tram Front" | "Not in Service" | string;
export type Carriages = "Single" | "Double";
export type Status = "Due" | "Departing" | "Arrived" | "Approaching";

type GraphQLResponse<T> = {
  data?: T | null;
  errors?: { message: string; path?: (string | number)[]; extensions?: { code?: string } }[];
};

async function query<T>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: document, variables }),
  });

  // Errors come back as JSON even with non-2xx statuses (e.g. 500 with code TOO_COMPLEX for oversized queries)
  const { data, errors } = (await response.json().catch(() => ({}))) as GraphQLResponse<T>;

  // Partial errors are expected (e.g. an unknown ATCO code yields a null entry and a RESOURCE_NOT_FOUND error), so
  // only treat the response as a failure when there's no data at all
  if (!response.ok || !data) {
    const message = errors?.map(({ message, extensions }) => `${extensions?.code ?? ""} ${message}`).join("; ");
    throw new Error(`TfGM API request failed (${response.status}): ${message ?? response.statusText}`);
  }

  return data;
}

/* -------------------------------------------------------------------------------------------------------------------
 * Stops
 * -----------------------------------------------------------------------------------------------------------------*/

/**
 * Stop names were originally taken from the OData `StationLocation` attribute. They're used to build URL slugs and are
 * persisted in visitors' local storage (recently visited stops), so they must not change. Names now come from GTFS
 * data, and these overrides restore the original names wherever GTFS differs.
 */
const legacyStopNames: Partial<Record<string, string>> = {
  "9400ZZMABOB": "Besses O’ Th’ Barn",
  "9400ZZMAGMX": "Deansgate - Castlefield",
  "9400ZZMAFIR": "Firswood",
  "9400ZZMAEVC": "Trafford Palazzo",
  "9400ZZMANEW": "Newton Heath and Moston",
  "9400ZZMASTW": "St Werburgh’s Road",
};

type StopIdentity = {
  StationLocation: string;
  atcoCode: string;
};

/**
 * Every stop, keyed on the stop-level ATCO code (GTFS uses platform-level codes, e.g. 9400ZZMAHTN1 and 9400ZZMAHTN2,
 * but the API only accepts the stop-level 9400ZZMAHTN).
 */
const stopIdentities: StopIdentity[] = (() => {
  const byAtco = new Map<string, StopIdentity>();
  gtfsStops.forEach(({ stop_id, stop_name }) => {
    const atcoCode = stop_id.replace(/\d+$/, "");
    if (!byAtco.has(atcoCode)) {
      const StationLocation = legacyStopNames[atcoCode] ?? stop_name.replace(/ \(Manchester Metrolink\)$/, "");
      byAtco.set(atcoCode, { StationLocation, atcoCode });
    }
  });
  return [...byAtco.values()];
})();

function findAtcoCode(stopLocation: string): string | undefined {
  return stopIdentities.find(({ StationLocation }) => StationLocation === stopLocation)?.atcoCode;
}

export type StopsEntry = StopIdentity & {
  /** Lines serving this stop, e.g. "Blue Line", "Ashton-Under-Lyne - Bury". Used for search */
  lines: string[];
};

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

let stopsPromise: Promise<StopsEntry[]> | undefined;

/**
 * List every stop, along with the lines that serve it.
 *
 * Line information is fetched from the API. If that fails, stops are still returned (without lines) so the stop list
 * and pages keep working.
 */
export function getStops(): Promise<StopsEntry[]> {
  // Memoised, as this is called for every statically generated page
  stopsPromise ??= (async () => {
    const linesByAtco = new Map<string, string[]>();

    try {
      const { locationByAtco } = await query<StopLinesData>(STOP_LINES_QUERY, {
        atcoCodes: stopIdentities.map(({ atcoCode }) => atcoCode),
      });

      locationByAtco.forEach((location) => {
        if (!location) {
          return;
        }

        const lines = (location.lines ?? []).flatMap(({ id, services }) => [
          id.replace(/_/g, " "),
          ...services.map(({ name }) => name),
        ]);
        linesByAtco.set(location.atcoCode, [...new Set(lines)]);
      });
    } catch (err) {
      console.error("Failed to fetch stop lines", err);
    }

    return stopIdentities.map((stop) => ({ ...stop, lines: linesByAtco.get(stop.atcoCode) ?? [] }));
  })();

  return stopsPromise;
}

/* -------------------------------------------------------------------------------------------------------------------
 * Departures and alerts
 * -----------------------------------------------------------------------------------------------------------------*/

const ALERT_FRAGMENT = `
  fragment AlertFragment on Alert {
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
    link {
      href
      label
    }
    impactedServices {
      name
    }
    impactedLocations {
      atcoCode
      name
    }
    impactedServicesAtLocations {
      locations {
        atcoCode
        name
      }
      services {
        name
      }
    }
  }
`;

const STOP_INFO_QUERY = `
  query GetTramStopTravelInformation($atcoCodes: [String!]!, $limit: Int!) {
    tramStops: locationByAtco(atcoCodes: $atcoCodes) {
      name
      mode
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
        departures(limit: $limit) {
          trip {
            __typename
            mode
            ... on TramTrip {
              carriages
              destinationDisplay
            }
          }
          timings {
            scheduledDepartureTime
            expectedDepartureTime
            lastUpdated
            status
            wait
          }
        }
        stopAlerts: alerts(filters: { validityScopes: NOW }) {
          ...AlertFragment
        }
      }
    }
    lineAlerts: transportModes(modes: [TRAM]) {
      alerts(filters: { validityScopes: NOW }) {
        ...AlertFragment
      }
    }
  }

  ${ALERT_FRAGMENT}
`;

export type TfgmAlert = {
  id: string;
  title: string;
  description: string | null;
  advice: string | null;
  effect: string;
  validityScopes: string[];
  validityPeriods: { start: string | null; end: string | null }[];
  link: { href: string; label: string } | null;
  impactedServices: { name: string }[];
  impactedLocations: { atcoCode: string; name: string }[];
  impactedServicesAtLocations: { locations: { atcoCode: string; name: string }[]; services: { name: string }[] }[];
};

export type TfgmDeparture = {
  trip: { __typename: string; mode: string; carriages?: Carriages; destinationDisplay?: string };
  timings: {
    scheduledDepartureTime: string | null;
    expectedDepartureTime: string | null;
    lastUpdated: string | null;
    status: Status | null;
    wait: number | null;
  };
};

export type TfgmTramStop = {
  name: string;
  mode: string;
  atcoCode: string;
  lines?: { id: string; services: { name: string }[] }[];
  departures?: TfgmDeparture[];
  stopAlerts?: TfgmAlert[];
};

type StopInfoData = {
  tramStops: (TfgmTramStop | null)[];
  lineAlerts: { alerts: TfgmAlert[] }[];
};

async function fetchStopInfo(atcoCodes: string[]): Promise<StopInfoData> {
  return query<StopInfoData>(STOP_INFO_QUERY, { atcoCodes, limit: 20 });
}

/**
 * Raw API data for every stop. Used for debugging
 */
export async function getAll(): Promise<StopInfoData> {
  // The API rejects queries over a complexity limit (TOO_COMPLEX), which departures for ~20+ stops exceeds
  const batchSize = 10;
  const atcoCodes = stopIdentities.map(({ atcoCode }) => atcoCode);
  const batches = [];
  for (let i = 0; i < atcoCodes.length; i += batchSize) {
    batches.push(atcoCodes.slice(i, i + batchSize));
  }

  const results = await Promise.all(batches.map((batch) => fetchStopInfo(batch)));

  return {
    tramStops: results.flatMap(({ tramStops }) => tramStops),
    lineAlerts: results[0]?.lineAlerts ?? [],
  };
}

export type Departure = {
  destination: Destination;
  type: Carriages;
  status: Status;
  wait: number;
};

export type Alert = {
  id: string;
  title: string;
  description: string | null;
  /** GTFS-realtime style effect, e.g. NO_SERVICE, ACCESSIBILITY_ISSUE, OTHER */
  effect: string;
  link: { href: string; label: string } | null;
};

export type StopInfo = {
  name: string;
  departures: Departure[];
  /** Plain text versions of `alerts`. Kept for compatibility with older clients */
  messages: string[];
  alerts: Alert[];
  lastUpdated: string;
};

/**
 * Alerts relevant to a stop: those raised against the stop itself, plus network-wide alerts affecting a service that
 * calls at it (mirroring how tfgm.com selects alerts for its stop pages).
 */
function relevantAlerts(stop: TfgmTramStop, lineAlerts: TfgmAlert[]): TfgmAlert[] {
  const stopServices = new Set((stop.lines ?? []).flatMap(({ services }) => services.map(({ name }) => name)));

  const serviceAlerts = lineAlerts.filter(
    ({ impactedServices, impactedServicesAtLocations }) =>
      impactedServices.some(({ name }) => stopServices.has(name)) ||
      impactedServicesAtLocations.some(({ services }) => services.some(({ name }) => stopServices.has(name)))
  );

  const seenIds = new Set<string>();
  return [...(stop.stopAlerts ?? []), ...serviceAlerts].filter(({ id }) => {
    if (seenIds.has(id)) {
      return false;
    }
    seenIds.add(id);
    return true;
  });
}

/**
 * The API's lastUpdated timestamp, if it's plausible. Falls back to the current time.
 *
 * The OData API reported local time with a UTC designator, so guard against the same happening here: anything more
 * than 15 minutes out is ignored.
 */
function plausibleLastUpdated(departures: TfgmDeparture[]): string {
  const now = Date.now();
  const timestamps = departures
    .map(({ timings }) => (timings.lastUpdated ? Date.parse(timings.lastUpdated) : NaN))
    .filter((timestamp) => !isNaN(timestamp) && Math.abs(now - timestamp) < 15 * 60 * 1000);

  return new Date(timestamps.length > 0 ? Math.max(...timestamps) : now).toISOString();
}

/**
 * Fetch information on a particular stop
 *
 * @param stopLocation The stop's name, as listed by getStops()
 */
export async function getStopInfo(stopLocation: string): Promise<StopInfo> {
  const atcoCode = findAtcoCode(stopLocation);

  if (!atcoCode) {
    throw new Error(`No metrolink found matching ${stopLocation}`);
  }

  const { tramStops, lineAlerts } = await fetchStopInfo([atcoCode]);
  const stop = tramStops[0];

  if (!stop) {
    throw new Error(`No metrolink found matching ${stopLocation}`);
  }

  const departures = (stop.departures ?? [])
    .flatMap(({ trip, timings }): Departure[] => {
      if (!trip.destinationDisplay || !trip.carriages || !timings.status || timings.wait === null) {
        return [];
      }

      return [
        {
          destination: trip.destinationDisplay,
          type: trip.carriages,
          status: timings.status,
          wait: timings.wait,
        },
      ];
    })
    .sort((a, b) => a.wait - b.wait);

  const alerts = relevantAlerts(stop, lineAlerts[0]?.alerts ?? []).map(
    ({ id, title, description, effect, link }): Alert => ({
      id,
      title,
      description: description?.trim() ? description.trim() : null,
      effect,
      link,
    })
  );

  const messages = alerts.map(({ title, description }) => (description ? `${title}\n${description}` : title));

  return {
    name: stopLocation,
    departures,
    messages,
    alerts,
    lastUpdated: plausibleLastUpdated(stop.departures ?? []),
  };
}
