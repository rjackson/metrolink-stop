import { useEffect, useState } from "react";

/**
 * An accessible auto-refresh hook, with runtime-configurable refresh refreshInterval, and the ability to stop or start (not
 * pause or resume cos that's more thinking than I want to do right now)
 *
 * @param {callback} onRefresh A function with whatever you want to happen when the refresh happens
 * @param {number} initialRefreshInterval How often to refresh, in seconds
 * @param {bool} [invokeImmediately=true]
 * @returns {{stop: function, start: function, refreshInterval, setRefreshInterval: function(seconds: number), lastRefresh: (Date|null), refreshingAt: (Date|null), secondsRemaining: number}
 */
export default function useAutoRefresh(onRefresh, initialRefreshInterval, invokeImmediately = true) {
  const [immediatelyInvoked, setImmediatelyInvoked] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(initialRefreshInterval);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [countingFrom, setCountingFrom] = useState(lastRefresh);
  const refreshingAtTime = countingFrom === null ? null : countingFrom.getTime() + refreshInterval * 1000;
  const refreshingAt = countingFrom === null ? null : new Date(refreshingAtTime);
  const [secondsRemaining, setSecondsRemaining] = useState((refreshingAtTime - Date.now()) / 1000);

  const tick = useCallback(() => {
    const now = new Date();

    if (countingFrom === null) {
      return;
    }

    setSecondsRemaining((oldSeconds) => {
      if (oldSeconds <= 0) {
        setLastRefresh(now);
        setCountingFrom(now);
        onRefresh();
        return refreshInterval;
      }

      return parseInt((countingFrom.getTime() + refreshInterval * 1000 - now.getTime()) / 1000);
    });
  }, [countingFrom, onRefresh, refreshInterval]);

  useEffect(() => {
    if (invokeImmediately && !immediatelyInvoked) {
      onRefresh();
      setImmediatelyInvoked(true);
    }

    const timer = setInterval(tick, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [invokeImmediately, immediatelyInvoked, tick, onRefresh]);

  const stop = () => setCountingFrom(null);
  const start = () => setCountingFrom(new Date());

  return { stop, start, refreshInterval, setRefreshInterval, lastRefresh, refreshingAt, secondsRemaining };
}
