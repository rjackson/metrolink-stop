import useSWR from "swr";
import { StopInfo } from "../../lib/tfgm-metrolink";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * @param {string} stopName The exact name of a Metrolink stop, as stored in the StationLocation attribute
 */
const useMetrolinkStop = (
  stopName: string
): { stopInfo?: StopInfo; isLoading: boolean; isError: boolean; error: unknown } => {
  const { data, error } = useSWR<StopInfo>(`/api/stop/${encodeURIComponent(stopName)}`, fetcher, {
    // Auto refresh every minute
    refreshInterval: 60 * 1000,

    // Don't automatically revaluate on focus within 30s of a previous validation (keep request count down,
    // given data only has minute granularity)
    focusThrottleInterval: 30 * 1000,
  });
  return { stopInfo: data, isLoading: !error && !data, isError: error !== undefined, error };
};

export default useMetrolinkStop;
