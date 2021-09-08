import { useCallback, useState } from "react";
import useAutoRefresh from "./useAutoRefresh";

const useMetrolinkStop = (stopName) => {
  /** @type [(import("../lib/tfgm-metrolink").StopInfo), Function] */
  const [stopInfo, setStopInfo] = useState({
    name: stopName,
    departures: [],
    messages: [],
    lastUpdated: new Date().toISOString(),
  });
  const loadStopInfo = useCallback(async () => {
    try {
      const req = await fetch(`/api/stop/${stopName}`);
      const data = await req.json();

      setStopInfo(req.status == 200 ? data : null);
    } catch (err) {
      console.log(err);
    }
  }, [stopName]);

  const { stop, start, refreshInterval, setRefreshInterval, lastRefresh, refreshingAt, secondsRemaining } =
    useAutoRefresh(loadStopInfo, 60);
  const refreshIntervalMinutes = parseInt(refreshInterval / 60); // maybe do something smarter in the future

  return { ...stopInfo, stop, start, refreshInterval, setRefreshInterval, lastRefresh, refreshingAt, secondsRemaining };
};

export default useMetrolinkStop;
