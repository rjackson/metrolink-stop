import { useEffect, useState } from "react";

export default function usePrefersDark() {
  const [prefersDark, setPrefersDark] = useState(false);

  // We running server-side, give em the light (client side will recalc dw)
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return prefersDark;
  }

  useEffect(() => {
    const prefersDarkMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    // Initiate on first client side run
    setPrefersDark(prefersDarkMediaQuery.matches);

    // And catch if it ever changes
    prefersDarkMediaQuery.addEventListener("change", ({ matches }) => setPrefersDark(matches));

    return () => {
      prefersDarkMediaQuery.removeEventListener();
    };
  }, []);

  return prefersDark;
}
