import { useEffect, useState } from "react";

export default function usePrefersDark() {
  const [prefersDark, setPrefersDark] = useState(false);

  useEffect(() => {
    // We running server-side, so we can't check nuffin.
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const prefersDarkMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const onMatchChange = ({ matches }) => setPrefersDark(matches)

    // Initiate on first client side run
    setPrefersDark(prefersDarkMediaQuery.matches);

    // And catch if it ever changes
    prefersDarkMediaQuery.addEventListener("change", onMatchChange );

    return () => {
      prefersDarkMediaQuery.removeEventListener("change", onMatchChange);
    };
  }, []);

  return prefersDark;
}
