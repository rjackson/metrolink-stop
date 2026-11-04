import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router";
import { usePrefersDark } from "@rjackson/rjds";
import { VisitedStopsProvider } from "./components/context/VisitedStops";
import MainLayout from "./components/layouts/MainLayout";
import { MapLayout } from "./components/layouts/MapLayout";
import useFathom from "./components/hooks/useFathom";
import Home from "./pages/index";
import Stop from "./pages/stop";
import NotFound from "./pages/not-found";
import { findStopBySlug, stops } from "./lib/stops";

// Loaded on demand, to keep the map libraries and debug tooling out of the main bundle
const MetrolinkMap = lazy(() => import("./pages/map"));
const Debug = lazy(() => import("./pages/debug"));

function StopRoute() {
  const { stop: slug = "" } = useParams();
  const stop = findStopBySlug(slug);

  if (!stop) {
    return <NotFound />;
  }

  // Keyed so that state is reset when navigating between stops
  return <Stop key={stop.atcoCode} stop={stop.StationLocation} allStops={stops} />;
}

/** The Next.js build served every page under an /en-GB prefix too. Keep those URLs working */
function StripLocalePrefix() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`${pathname.replace(/^\/en-GB/, "") || "/"}${search}${hash}`} replace />;
}

export default function App() {
  const prefersDark = usePrefersDark();

  useFathom();

  return (
    <VisitedStopsProvider>
      <div className={prefersDark ? "dark" : ""}>
        <Routes>
          <Route
            element={
              <MainLayout>
                <Outlet />
              </MainLayout>
            }
          >
            <Route index element={<Home />} />
            <Route
              path="debug"
              element={
                <Suspense>
                  <Debug />
                </Suspense>
              }
            />
            <Route path=":stop" element={<StopRoute />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route
            path="map"
            element={
              <MapLayout>
                <Suspense>
                  <MetrolinkMap />
                </Suspense>
              </MapLayout>
            }
          />
          <Route path="time" element={<Navigate to="/map" replace />} />
          <Route path="travel" element={<Navigate to="/map" replace />} />
          <Route path="en-GB/*" element={<StripLocalePrefix />} />
        </Routes>
      </div>
    </VisitedStopsProvider>
  );
}
