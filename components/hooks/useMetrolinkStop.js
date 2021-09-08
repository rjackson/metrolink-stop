import useSWR from "swr";

/**
 * @param {Object} UseMetrolinkStopResponse
 * @property {null|(import("../lib/tfgm-metrolink").StopInfo)} stopInfo
 * @property {bool} isLoading
 * @property {bool} isError
 * @property {Error} error
 */

/**
 *
 * @param {string} stopName The exact name of a Metrolink stop, as stored in the StationLocation attribute
 * @returns {UseMetrolinkStopResponse}
 */
const useMetrolinkStop = (stopName) => {
  const { data, error } = useSWR(`/api/stop/${encodeURIComponent(stopName)}`, {
    // Auto refresh every minute
    refreshInterval: 60 * 1000,

    // Don't automatically revaluate on focus within 30s of a previous validation (keep request count down,
    // given data only has minute granularity)
    focusThrottleInterval: 30 * 1000,
  });

  return { stopInfo: data, isLoading: !error && !data, isError: error, error };
};

export default useMetrolinkStop;
