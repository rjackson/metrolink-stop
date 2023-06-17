import linesJson from "../data/lines/lines.json";

type GTFSLine = {
  route_id: string
  route_short_name: string
  direction: string
  trip_id: string
  stops: GTFSStop[]
}

type GTFSStop = {
  stop_name: string
  stop_lat: number
  stop_lon: number
  arrival_timestamp: number
  seconds_since_previous_stop: number | null
  seconds_to_next_stop: number
};

const lines = Object.values(linesJson).filter((line: unknown): line is GTFSLine => {
  return (
    typeof line === "object" &&
    typeof (line as GTFSLine).route_id === "string" &&
    typeof (line as GTFSLine).route_short_name === "string" &&
    typeof (line as GTFSLine).direction === "string" &&
    typeof (line as GTFSLine).trip_id === "string" &&
    Array.isArray((line as GTFSLine).stops) &&
    (line as GTFSLine).stops.every((stop: unknown): stop is GTFSStop => {
      // balls to checking this array any further, ill take the risk
      return typeof stop === "object" &&
        typeof (stop as GTFSStop).stop_name === "string" &&
        typeof (stop as GTFSStop).stop_lat === "number" &&
        typeof (stop as GTFSStop).stop_lon === "number";
    })

  );
})

export default lines;
