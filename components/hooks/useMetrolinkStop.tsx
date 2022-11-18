import useSWR from "swr";
import { StopInfo } from "../../lib/tfgm-metrolink";

/**
 * @param {string} stopName The exact name of a Metrolink stop, as stored in the StationLocation attribute
 */
const useMetrolinkStop = (stopName: string) => {
  const { data, error } = useSWR<StopInfo>(`/api/stop/${encodeURIComponent(stopName)}`, {
    // Auto refresh every minute
    refreshInterval: 60 * 1000,

    // Don't automatically revaluate on focus within 30s of a previous validation (keep request count down,
    // given data only has minute granularity)
    focusThrottleInterval: 30 * 1000,
  });
  return { stopInfo: data, isLoading: !error && !data, isError: error, error };
};

export default useMetrolinkStop;
