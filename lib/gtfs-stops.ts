import stopsJson from "../data/lines/stops.json";

type GTFSStop = {
  stop_id: string;
  stop_code: string;
  stop_name: string;
  //   tts_stop_name: null;
  //   stop_desc: null;
  stop_lat: number;
  stop_lon: number;
  //   zone_id: null;
  //   stop_url: null;
  //   location_type: null;
  //   parent_station: null;
  //   stop_timezone: null;
  //   wheelchair_boarding: null;
  //   level_id: null;
  //   platform_code: null;
};

const stops = Array.isArray(stopsJson)
  ? stopsJson.filter((stop: unknown): stop is GTFSStop => {
      return (
        typeof stop === "object" &&
        typeof (stop as GTFSStop).stop_id === "string" &&
        typeof (stop as GTFSStop).stop_code === "string" &&
        typeof (stop as GTFSStop).stop_name === "string" &&
        typeof (stop as GTFSStop).stop_lat === "number" &&
        typeof (stop as GTFSStop).stop_lon === "number"
      );
    })
  : [];

export default stops;
