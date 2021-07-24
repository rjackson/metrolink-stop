import { useEffect, useState } from "react";

export default function useCountdown(datetime) {
  const [target, setTarget] = useState(datetime);
  const [secondsRemaining, setSecondsRemaining] = useState((target.getTime() - Date.now()) / 1000);

  useEffect(() => {
    const timerInterval = setInterval(() => {
      setSecondsRemaining(() => {
        const remaining = parseInt((target.getTime() - Date.now()) / 1000);
        if (remaining <= 0) {
          clearInterval(timerInterval);
          return 0;
        }

        return remaining;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [target]);

  return { target, secondsRemaining, setTarget };
}
