import { stopIdentities, findStopByName } from "./stops";
import { DEFAULT_TFGM_GRAPHQL_ENDPOINT, tfgmQuery } from "./tfgm-graphql";

/**
 * Live departures and alerts from TfGM's GraphQL API, called directly from the browser.
 *
 * This replaced the deprecated api.tfgm.com OData endpoint. Set VITE_TFGM_GRAPHQL_ENDPOINT to route requests through
 * a proxy instead (e.g. if TfGM ever stop allowing cross-origin requests).
 */
// An empty value (e.g. `VITE_TFGM_GRAPHQL_ENDPOINT=` in an env file) means unset, hence `||` rather than `??`
const endpoint = import.meta.env.VITE_TFGM_GRAPHQL_ENDPOINT || DEFAULT_TFGM_GRAPHQL_ENDPOINT;

function query<T>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
  return tfgmQuery<T>(document, variables, endpoint);
}

/** A stop name, or a message such as "See Tram Front" or "Not in Service" */
export type Destination = string;
export type Carriages = "Single" | "Double";
export type Status = "Due" | "Departing" | "Arrived" | "Approaching";

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
  /** Expected departure time (ISO 8601), if known */
  departureTime?: string;
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
  const atcoCode = findStopByName(stopLocation)?.atcoCode;

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
          ...(timings.expectedDepartureTime ? { departureTime: timings.expectedDepartureTime } : {}),
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

  return {
    name: stopLocation,
    departures,
    alerts,
    lastUpdated: plausibleLastUpdated(stop.departures ?? []),
  };
}
