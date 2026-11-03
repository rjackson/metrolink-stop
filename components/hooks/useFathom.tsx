import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import * as Fathom from "fathom-client";

const customDomain = import.meta.env.VITE_FATHOM_CUSTOM_DOMAIN;
const trackingCode = import.meta.env.VITE_FATHOM_TRACKING_CODE;

const useFathom = () => {
  const { pathname } = useLocation();
  const loaded = useRef(false);

  useEffect(() => {
    if (!trackingCode) {
      return;
    }

    if (!loaded.current) {
      // Loading records the initial pageview
      Fathom.load(trackingCode, {
        ...(customDomain ? { url: `https://${customDomain}/script.js` } : {}),
      });
      loaded.current = true;
      return;
    }

    // Record a pageview when route changes
    Fathom.trackPageview();
  }, [pathname]);
};

export default useFathom;
