import useSWR from "swr";
import { getStopInfo, StopInfo } from "../../lib/tfgm-metrolink";

/**
 * @param {string} stopName The exact name of a Metrolink stop, as listed in lib/stops
 */
const useMetrolinkStop = (
  stopName: string
): { stopInfo?: StopInfo; isLoading: boolean; isError: boolean; error: unknown } => {
  const { data, error } = useSWR<StopInfo, unknown>(["stop", stopName], () => getStopInfo(stopName), {
    // Auto refresh every minute
    refreshInterval: 60 * 1000,

    // Don't automatically revaluate on focus within 30s of a previous validation (keep request count down,
    // given data only has minute granularity)
    focusThrottleInterval: 30 * 1000,
  });
  return { stopInfo: data, isLoading: !error && !data, isError: error !== undefined, error };
};

export default useMetrolinkStop;
