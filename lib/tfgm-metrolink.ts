import { o } from "odata";

const baseUrl = process.env.TFGM_ODATA_ENDPOINT as string;
const subscriptionKey = process.env.TFGM_ODATA_SUBSCRIPTION_KEY as string;

const tfgmO = () => {
  return o(baseUrl, {
    headers: {
      "Ocp-Apim-Subscription-Key": subscriptionKey,
    },
  });
};

type Destination = 'See Tram Front' | 'Not in Service' | string
type Carriages = "Single" | "Double"
type Status = "Due" | "Departing" | "Arrived"

type TfgmMetrolink = {
  Id: number;
  Line: string;
  TLAREF: string;
  PIDREF: string;
  StationLocation: string;
  AtcoCode: string | null;
  Direction: string | null;
  Dest0: string | null;
  Carriages0: Carriages | null;
  Status0: Status | null;
  Wait0: string | null;
  Dest1: string | null;
  Carriages1: Carriages | null;
  Status1: Status | null;
  Wait1: string | null;
  Dest2: string | null;
  Carriages2: Carriages | null;
  Status2: Status | null;
  Wait2: string | null;
  Dest3: string | null;
  Carriages3: Carriages | null;
  Status3: Status | null;
  MessageBoard: string | null;
  Wait3: string | null;
  LastUpdated: string;
}

export async function getAll(): Promise<TfgmMetrolink[]> {
  return await tfgmO().get("Metrolinks").query();
}

type StopsEntry = {
  StationLocation: string;
  Line: string
}

export async function getStops(): Promise<StopsEntry[]> {
  // try quertying this stuff directly from the odata endpoint – actually learn it u boob
  // also figure out unit tests for quicker dev of this lib
  const metrolinks: TfgmMetrolink[] = await tfgmO().get("Metrolinks").query({
    $select: "StationLocation, Line",
  });

  // TODO: Source data only has one line PER location, which isn't useful when allowing users to filter station list by
  // line (St Peter's Square only showing up under Eccles). Maybe add manual corrections to this list?

  // Deduplicate and map and reduce into stop entries
  const seenStops = new Set();
  return metrolinks.reduce((uniqueStops: StopsEntry[], { StationLocation, Line }) => {
    if (!seenStops.has(StationLocation)) {
      seenStops.add(StationLocation)
      uniqueStops.push({ StationLocation, Line })
    }
    return uniqueStops
  }, []);
}

type Departure = {
  destination: Destination
  type: Carriages
  status: Status
  wait: number
}

type StopInfo = {
  name: string
  departures: Departure[]
  messages: string[]
  lastUpdated: string
}

/**
 * Fetch information on a particular stop
 */
export async function getStopInfo(stopLocation: string): Promise<StopInfo> {
  // two consecutive single quotes represent one within a string literal
  // https://github.com/oasis-tcs/odata-abnf/blob/be8f43ca99beae393de370e5a6788f0b81b181bb/abnf/odata-abnf-construction-rules.txt#L958
  const encodedStopLocation = stopLocation.replace("'", "''");

  const metrolinks: TfgmMetrolink[] = await tfgmO()
    .get("Metrolinks")
    .query({
      $filter: `StationLocation eq '${encodedStopLocation}'`,
    });

  if (metrolinks.length === 0) {
    throw new Error(`No metrolink found matching ${stopLocation}`);
  }

  const { StationLocation: name } = metrolinks[0];

  // lastUpdated from the API is falsely presenting GMT as UTC (i.e. summer time
  // coming through with 'Z' timezone designation). Rather than deal with that noise,
  // let's just throw back the current date
  const lastUpdated = new Date().toISOString();

  // Dedupe departures on AtcoCode – each of these is a unique physical stop, so this will be dupe information
  const seenAtcoCodes = new Set();
  const stopsByAtcoCode = metrolinks.reduce((stops: TfgmMetrolink[], stop) => {
    if (!seenAtcoCodes.has(stop.AtcoCode)) {
      seenAtcoCodes.add(stop.AtcoCode)
      stops.push(stop);
    }
    return stops;
  }, [])

  const departures = stopsByAtcoCode
    .flatMap((metrolinkEntity) => {
      const departures: Departure[] = [];
      [0, 1, 2, 3]
        .forEach((i) => {
          const {
            [`Dest${i}` as keyof TfgmMetrolink]: destination,
            [`Carriages${i}` as keyof TfgmMetrolink]: type,
            [`Status${i}` as keyof TfgmMetrolink]: status,
            [`Wait${i}` as keyof TfgmMetrolink]: wait
          } = metrolinkEntity;

          if (destination) {
            departures.push({
              destination,
              type,
              status,
              wait,
            } as Departure);
          }
        })
      return departures;
    })
    .sort((a, b) => a.wait - b.wait);

  const messages = [
    ...new Set(
      metrolinks
        .map(({ MessageBoard }) => MessageBoard)
        .filter((message) => {
          if (!message) {
            return false;
          }

          if (message == "<no message>") {
            return false;
          }

          // Ignore next altrincham departures. They'll be shown in the full departures list
          if (message.startsWith("^F0Next Altrincham Departures")) {
            return false;
          }

          return true;
        })
    ),
  ] as string[];

  return {
    name,
    departures,
    messages,
    lastUpdated,
  };
}
