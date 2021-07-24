import { o } from "odata";

const baseUrl = process.env.TFGM_ODATA_ENDPOINT;
const subscriptionKey = process.env.TFGM_ODATA_SUBSCRIPTION_KEY;

const tfgmO = (endpoint) => {
  return o(baseUrl + endpoint, {
    headers: {
      "Ocp-Apim-Subscription-Key": subscriptionKey,
    },
  });
};

export async function getAll() {
  const metrolinks = await tfgmO("Metrolinks").get().query();

  return metrolinks;
}

export async function getStops() {
  const metrolinks = await getAll();

  // Make unique (sort into tuples, station must come first!)
  const stationLineTuples = metrolinks.map(({ Line, StationLocation }) => [StationLocation, Line]);
  const linesByStation = Object.fromEntries(stationLineTuples);

  // Turn back into objs and return
  return Object.entries(linesByStation).map(([StationLocation, Line]) => ({ StationLocation, Line }));
}

export async function getStopInfo(stop) {
  const metrolinks = await getAll();
  const unsluggedStop = stop.replaceAll("-", " ").toLowerCase();

  return metrolinks.filter(({ StationLocation }) => StationLocation.toLowerCase() == unsluggedStop);
}
