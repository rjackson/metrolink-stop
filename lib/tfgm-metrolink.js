import { o } from "odata";

const baseUrl = process.env.TFGM_ODATA_ENDPOINT;
const subscriptionKey = process.env.TFGM_ODATA_SUBSCRIPTION_KEY;

const tfgmO = () => {
  return o(baseUrl, {
    headers: {
      "Ocp-Apim-Subscription-Key": subscriptionKey,
    },
  });
};

/**
 * A "Metrolink" entity from the TfGM OData API
 * (be cool if we could autogen these from $metadata, maybe i'll build that one day)
 *
 * @typedef {Object} TfgmMetrolink
 * @property {number} Id
 * @property {string} [Line]
 * @property {string} [TLAREF]
 * @property {string} [PIDREF]
 * @property {string} [StationLocation]
 * @property {string} [AtcoCode]
 * @property {string} [Direction]
 * @property {string} [Dest0]
 * @property {string} [Carriages0]
 * @property {string} [Status0]
 * @property {string} [Wait0]
 * @property {string} [Dest1]
 * @property {string} [Carriages1]
 * @property {string} [Status1]
 * @property {string} [Wait1]
 * @property {string} [Dest2]
 * @property {string} [Carriages2]
 * @property {string} [Status2]
 * @property {string} [Wait2]
 * @property {string} [Dest3]
 * @property {string} [Carriages3]
 * @property {string} [Status3]
 * @property {string} [MessageBoard]
 * @property {string} [Wait3]
 * @property {string} [LastUpdated]
 */

/**
 * @return {Promise<TfgmMetrolink[]>}
 */
export async function getAll() {
  return await tfgmO().get("Metrolinks").query();
}

/**
 * @returns {Promise<{StationLocation: string, Line: string}[]>}
 */
export async function getStops() {
  // try quertying this stuff directly from the odata endpoint – actually learn it u boob
  // also figure out unit tests for quicker dev of this lib
  /** @type {TfgmMetrolink[]} */
  const metrolinks = await tfgmO().get("Metrolinks").query({
    $select: "StationLocation, Line",
  });

  // TODO: Source data only has one line PER location, which isn't useful when allowing users to filter station list by
  // line (St Peter's Square only showing up under Eccles). Maybe add manual corrections to this list?

  // Make unique (sort into tuples, station must come first!)
  const stationLineTuples = metrolinks.map(({ Line, StationLocation }) => [StationLocation, Line]);
  const linesByStation = Object.fromEntries(stationLineTuples);

  // Turn back into objs and return
  return Object.entries(linesByStation).map(([StationLocation, Line]) => ({ StationLocation, Line }));
}

/**
 * A departure record
 * @typedef {Object} Departure
 * @property {'See Tram Front' | 'Not in Service' | string} destination
 * @property {'Single' | 'Double'} type
 * @property {'Departing' | 'Due' | 'Arrived'} status
 * @property {number} wait
 */

/**
 * Information on a stop, departures, and any message board announcements.
 * @typedef {Object} StopInfo
 * @property {string} name - The name of the stop, which is equivalent to its locaton in the raw data.
 * @property {Departure[]} departures
 * @property {string[]} messages - Any message board announcements
 * @property {string} lastUpdated
 */

/**
 * Fetch information on a particular stop
 * @param {string} stopLocation
 * @returns {Promise<StopInfo>}
 */
export async function getStopInfo(stopLocation) {
  // two consecutive single quotes represent one within a string literal
  // https://github.com/oasis-tcs/odata-abnf/blob/be8f43ca99beae393de370e5a6788f0b81b181bb/abnf/odata-abnf-construction-rules.txt#L958
  const encodedStopLocation = stopLocation.replace("'", "''");
  /** @type {TfgmMetrolink[]} */
  const metrolinks = await tfgmO()
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
  const departuresByAtcoCode = Object.values(
    Object.fromEntries(
      metrolinks.map(({ AtcoCode, ...metrolinkEntity }) => [AtcoCode, { AtcoCode, ...metrolinkEntity }])
    )
  );
  const departures = departuresByAtcoCode
    .flatMap((metrolinkEntity) => {
      return [0, 1, 2, 3]
        .map((i) => {
          if (metrolinkEntity[`Dest${i}`].length === 0) {
            return false;
          }

          return {
            destination: metrolinkEntity[`Dest${i}`],
            type: metrolinkEntity[`Carriages${i}`],
            status: metrolinkEntity[`Status${i}`],
            wait: metrolinkEntity[`Wait${i}`],
          };
        })
        .filter((departure) => departure !== false);
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
  ];

  return {
    name,
    departures,
    messages,
    lastUpdated,
  };
}

export const slugify = (station) => encodeURIComponent(station.replace(/ /g, "-").toLowerCase());
