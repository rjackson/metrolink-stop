import AppLink from "../components/AppLink";
import HomeTabs from "../components/HomeTabs";
import { Anchor, Panel, usePrefersDark } from "@rjackson/rjds";
import "leaflet/dist/leaflet.css";
import type { FeatureGroup, LatLngBounds, LatLngTuple, Map as LeafletMap } from "leaflet";
import { loadIsochrone } from "../lib/isochrones";
import { Fragment, lazy, RefObject, Suspense, useEffect, useMemo, useRef, useState, type JSX } from "react";
import colors from "tailwindcss/colors";
import useResizeObserver from "@react-hook/resize-observer";
import useSWR from "swr";
import gtfsStops from "../lib/gtfs-stops";
import { findStopByAtco } from "../lib/stops";
import { getDepartures, getStopInfo, type Departure, type StopInfo } from "../lib/tfgm-metrolink";
import slugify from "../utils/slugify";

import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import { metrolinkLinesGeoJSON as lines } from "../lib/tfgm-open-data/gm-metrolink-network/loadMetrolinkLines";
import useDocumentTitle from "../components/hooks/useDocumentTitle";
import type { GeoJsonObject } from "geojson";
import { useMediaQuery } from "@react-hook/media-query";

/** A GTFS stop on the map, joined to the stop-level identity the rest of the site (and the TfGM API) uses */
type MapStop = {
  /** GTFS stop ID, which isochrones are keyed by (e.g. 9400ZZMAABM1) */
  stopId: string;
  /** Stop-level ATCO code (e.g. 9400ZZMAABM) */
  atcoCode: string;
  name: string;
  lat: number;
  lon: number;
};

const stops: MapStop[] = gtfsStops.map(({ stop_id, stop_name, stop_lat, stop_lon }) => {
  const atcoCode = stop_id.replace(/\d+$/, "");
  return {
    stopId: stop_id,
    atcoCode,
    name: findStopByAtco(atcoCode)?.StationLocation ?? stop_name.replace(/ \(Manchester Metrolink\)$/, ""),
    lat: stop_lat,
    lon: stop_lon,
  };
});

/** Below this zoom level stops are too close together to label, and fetching every stop's departures is wasteful */
const LABEL_MIN_ZOOM = 13;

/**
 * Stops grouped into fixed batches of neighbours (west to east), one API request each. Fixed batches mean panning
 * around reuses already-fetched departures rather than requesting a fresh set for every slightly different view.
 */
const DEPARTURE_BATCH_SIZE = 20;
const departureBatches: string[][] = (() => {
  const byLongitude = [...stops].sort((a, b) => a.lon - b.lon);
  const batches: string[][] = [];
  for (let i = 0; i < byLongitude.length; i += DEPARTURE_BATCH_SIZE) {
    batches.push(byLongitude.slice(i, i + DEPARTURE_BATCH_SIZE).map(({ atcoCode }) => atcoCode));
  }
  return batches;
})();

const swrOptions = {
  // Data has minute granularity, so refresh every minute and don't revalidate on focus more than every 30s
  refreshInterval: 60 * 1000,
  focusThrottleInterval: 30 * 1000,
};

type LabelRow = { destination: string; time: string };
type LabelContent = { name: string; rows?: LabelRow[] };

const formatWait = (wait: number) => (wait === 0 ? "due" : `${wait} min`);

/**
 * The next tram to each of the first few destinations, soonest first. One row per destination, so a label shows
 * where trams are heading rather than three trams to the same place
 */
function nextByDestination(departures: Departure[], limit = 3): LabelRow[] {
  const rows: LabelRow[] = [];
  const seen = new Set<string>();
  for (const { destination, wait } of departures) {
    if (seen.has(destination)) {
      continue;
    }
    seen.add(destination);
    rows.push({ destination, time: formatWait(wait) });
    if (rows.length === limit) {
      break;
    }
  }
  return rows;
}

/** Lines of text in a label, for estimating its size */
const labelTextLines = ({ name, rows }: LabelContent) =>
  rows === undefined
    ? [name]
    : rows.length === 0
      ? [name, "No trams due"]
      : [name, ...rows.map(({ destination, time }) => `${destination}   ${time}`)];

type LabelPlacement = "right" | "left";

/**
 * Decide which stops get a permanent label, and on which side, so that labels don't overlap each other or other
 * stops. Stops earlier in the list win. Label sizes are estimated from their text, which is close enough at this font
 * size and avoids measuring the DOM.
 */
function placeLabels(map: LeafletMap, candidates: MapStop[], labelText: (stop: MapStop) => string[]) {
  const CHAR_WIDTH = 6.5; // px, at the label font size
  const LINE_HEIGHT = 16;
  const PADDING = 8;
  const GAP = 10; // between the stop and its label

  type Rect = { left: number; right: number; top: number; bottom: number };
  const overlaps = (a: Rect, b: Rect) =>
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

  const points = new Map(candidates.map((stop) => [stop.stopId, map.latLngToContainerPoint([stop.lat, stop.lon])]));
  // Stop dots are obstacles too, so labels don't cover neighbouring stops
  const placed: Rect[] = [...points.values()].map(({ x, y }) => ({
    left: x - 4,
    right: x + 4,
    top: y - 4,
    bottom: y + 4,
  }));
  const placements = new Map<string, LabelPlacement>();

  candidates.forEach((stop) => {
    const point = points.get(stop.stopId);
    if (!point) {
      return;
    }

    const lines = labelText(stop);
    const width = Math.max(...lines.map((line) => line.length)) * CHAR_WIDTH + PADDING * 2;
    const height = lines.length * LINE_HEIGHT + PADDING;
    const top = point.y - height / 2;
    const bottom = point.y + height / 2;

    const options: [LabelPlacement, Rect][] = [
      ["right", { left: point.x + GAP, right: point.x + GAP + width, top, bottom }],
      ["left", { left: point.x - GAP - width, right: point.x - GAP, top, bottom }],
    ];

    const fit = options.find(([, rect]) => !placed.some((other) => overlaps(rect, other)));
    if (fit) {
      placements.set(stop.stopId, fit[0]);
      placed.push(fit[1]);
    }
  });

  return placements;
}

const SelectedStopDepartures = ({ stopInfo, isError }: { stopInfo?: StopInfo; isError: boolean }) => {
  if (isError) {
    return <p className="text-sm">Couldn&rsquo;t load live departures.</p>;
  }
  if (!stopInfo) {
    return <p className="text-sm text-gray-600 dark:text-gray-300">Loading departures&hellip;</p>;
  }
  if (stopInfo.departures.length === 0) {
    return <p className="text-sm">No trams due.</p>;
  }

  return (
    <ul className="space-y-1 text-sm">
      {stopInfo.departures.slice(0, 4).map(({ destination, wait, type }, i) => (
        <li key={`${destination}-${wait}-${i}`} className="flex justify-between space-x-2">
          <span>
            {destination}
            {type === "Double" && <span className="text-gray-600 dark:text-gray-300"> (double)</span>}
          </span>
          <span className="tabular-nums">{wait === 0 ? "due" : `${wait} min`}</span>
        </li>
      ))}
    </ul>
  );
};

const initClientOnlyMap = async (): Promise<() => JSX.Element> => {
  const { MapContainer, GeoJSON, CircleMarker, useMap, useMapEvents, FeatureGroup, Pane, ZoomControl, Tooltip } =
    await import("react-leaflet");
  const { VectorBasemapLayer } = await import("../components/leaflet/VectorBasemapLayer");

  const center: LatLngTuple = [53.4781, -2.2433]; // St Peters Square
  const zoom = 11;

  const MapZoomer = ({ linesRef }: { linesRef: RefObject<FeatureGroup | null> }) => {
    const map = useMap();
    const breakpointLg = useMediaQuery("(min-width: 1024px)"); // tailwind lg breakpoint
    const debounceTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

    useEffect(() => {
      clearTimeout(debounceTimeout.current);

      debounceTimeout.current = setTimeout(() => {
        const bounds = linesRef.current?.getBounds();
        if (bounds?.isValid()) {
          map.fitBounds(bounds, {
            paddingBottomRight: [0, breakpointLg ? 0 : 288], // px
          });
        }
      }, 300);
    }, [map, linesRef, breakpointLg]);

    return null;
  };

  type MapView = { map: LeafletMap; zoom: number; bounds: LatLngBounds };

  /** Reports the map's view whenever it settles after panning or zooming */
  const ViewTracker = ({ onChange }: { onChange: (view: MapView) => void }) => {
    const map = useMapEvents({
      moveend: () => {
        onChange({ map, zoom: map.getZoom(), bounds: map.getBounds() });
      },
    });

    useEffect(() => {
      onChange({ map, zoom: map.getZoom(), bounds: map.getBounds() });
    }, [map, onChange]);

    return null;
  };

  const ClientOnlyMap = () => {
    const prefersDark = usePrefersDark();
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map>(null);
    const linesRef = useRef<FeatureGroup>(null);
    const markersRef = useRef<FeatureGroup>(null);

    const durationColors = {
      "10": prefersDark ? colors.fuchsia[300] : colors.indigo[800],
      "20": prefersDark ? colors.fuchsia[500] : colors.indigo[600],
      "30": prefersDark ? colors.fuchsia[700] : colors.indigo[400],
      "40": prefersDark ? colors.fuchsia[900] : colors.indigo[200],
    };

    // We need to separate vector maps into 2 layers so we can display part of it as the basemap, and more detailed
    // parts above our isochrone (higher zIndex). We could do custom vector tiles in ArcGIS but then we double our API
    // usage costs.
    // Alternatively, we can do it all render-side from one base map (requests deduplicated via service workers)
    // Firstly, what layers do we want in the background vs foreground
    const includeLayerTypeInBackground: Record<LayerSpecification["type"], boolean> = {
      fill: true,
      line: false,
      symbol: false, // text labels
      circle: true,
      heatmap: true,
      "fill-extrusion": true,
      raster: true,
      hillshade: true,
      background: true,
    };

    // We'll exclude all road layers, except a few whitelisted ones (to avoid too much visual noise when zoomed in)
    const permittedRoadLayers: Partial<Record<LayerSpecification["id"], undefined>> = {
      // "Road/4WD/0": undefined,
      // "Road/4WD/1": undefined,
      "Road/Freeway Motorway, ramp or traffic circle/0": undefined,
      "Road/Freeway Motorway, ramp or traffic circle/1": undefined,
      "Road/Freeway Motorway/0": undefined,
      "Road/Freeway Motorway/1": undefined,
      "Road/Highway/0": undefined,
      "Road/Highway/1": undefined,
      // "Road/Local/0": undefined,
      // "Road/Local/1": undefined,
      "Road/Major, ramp or traffic circle/0": undefined,
      "Road/Major, ramp or traffic circle/1": undefined,
      "Road/Major/0": undefined,
      "Road/Major/1": undefined,
      "Road/Minor, ramp or traffic circle/0": undefined,
      "Road/Minor, ramp or traffic circle/1": undefined,
      "Road/Minor/0": undefined,
      "Road/Minor/1": undefined,
      // "Road/Pedestrian/0": undefined,
      // "Road/Pedestrian/1": undefined,
      // "Road/Service/0": undefined,
      // "Road/Service/1": undefined,
      // "Road/label/Freeway Motorway, alt name": undefined,
      // "Road/label/Freeway Motorway": undefined,
      // "Road/label/Highway": undefined,
      // "Road/label/Local": undefined,
      // "Road/label/Major, alt name": undefined,
      // "Road/label/Major": undefined,
      // "Road/label/Minor": undefined,
      // "Road/label/Pedestrian": undefined,
      // "Road/label/Rectangle white black (Alt)": undefined,
      // "Road/label/Rectangle white black": undefined,
    };

    const textLayersToEmphasize: Partial<Record<LayerSpecification["id"], undefined>> = {
      "Admin0 point/2x large": undefined,
      "Admin0 point/large": undefined,
      "Admin0 point/medium": undefined,
      "Admin0 point/small": undefined,
      "Admin0 point/x large": undefined,
      "Admin0 point/x small": undefined,
      "City large scale/large": undefined,
      "City large scale/medium": undefined,
      "City large scale/small": undefined,
      "City large scale/town large": undefined,
      "City large scale/town small": undefined,
      "City large scale/x large": undefined,
      "City small scale/large admin0 capital": undefined,
      "City small scale/large non capital": undefined,
      "City small scale/large other capital": undefined,
      "City small scale/medium admin0 capital": undefined,
      "City small scale/medium non capital": undefined,
      "City small scale/medium other capital": undefined,
      "City small scale/other capital": undefined,
      "City small scale/small admin0 capital": undefined,
      "City small scale/small non capital": undefined,
      "City small scale/small other capital": undefined,
      "City small scale/town large admin0 capital": undefined,
      "City small scale/town large non capital": undefined,
      "City small scale/town large other capital": undefined,
      "City small scale/town small admin0 capital": undefined,
      "City small scale/town small non capital": undefined,
      "City small scale/x large admin0 capital": undefined,
      "City small scale/x large admin1 capital": undefined,
      "City small scale/x large admin2 capital": undefined,
      "City small scale/x large non capital": undefined,
      Neighborhood: undefined,
    };

    const [selectedStop, setSelectedStop] = useState<string | undefined>();
    const [activeIsochrone, setActiveIsochrone] = useState<{ stopId: string; data: GeoJsonObject } | undefined>();

    // Keep showing the previous isochrone until the newly selected one has loaded
    useEffect(() => {
      if (!selectedStop) {
        return;
      }

      let cancelled = false;
      loadIsochrone(selectedStop)
        .then((data) => {
          if (!cancelled) {
            setActiveIsochrone(data ? { stopId: selectedStop, data } : undefined);
          }
        })
        .catch((err: unknown) => {
          console.error(`Failed to load isochrone for ${selectedStop}`, err);
        });

      return () => {
        cancelled = true;
      };
    }, [selectedStop]);

    useResizeObserver(containerRef, () => {
      mapRef.current?.invalidateSize();
    });

    const [view, setView] = useState<MapView | undefined>();
    const [showLiveTimes, setShowLiveTimes] = useState(true);
    const labelsEnabled = showLiveTimes && view !== undefined && view.zoom >= LABEL_MIN_ZOOM;

    // Stops in (or just outside) the current view
    const visibleStops = useMemo(() => {
      if (!labelsEnabled) {
        return [];
      }
      const bounds = view.bounds.pad(0.1);
      return stops.filter(({ lat, lon }) => bounds.contains([lat, lon]));
    }, [labelsEnabled, view]);

    // Departures for every batch with a visible stop
    const neededBatches = departureBatches.filter((batch) =>
      visibleStops.some(({ atcoCode }) => batch.includes(atcoCode))
    );
    const { data: departures } = useSWR(
      neededBatches.length > 0 ? ["map-departures", ...neededBatches.map((batch) => batch[0])] : null,
      () => getDepartures(neededBatches.flat()),
      { ...swrOptions, keepPreviousData: true }
    );

    const labelContent = (stop: MapStop): LabelContent => {
      const stopDepartures = departures?.[stop.atcoCode];
      return { name: stop.name, rows: stopDepartures && nextByDestination(stopDepartures) };
    };

    const selected = stops.find(({ stopId }) => stopId === selectedStop);

    const labelPlacements = useMemo(() => {
      if (!labelsEnabled) {
        return new Map<string, LabelPlacement>();
      }
      // The selected stop's label takes priority
      const candidates = selected ? [selected, ...visibleStops.filter((stop) => stop !== selected)] : visibleStops;
      return placeLabels(view.map, candidates, (stop) => labelTextLines(labelContent(stop)));
      // `view` is a dependency because label positions depend on where the map is
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [labelsEnabled, visibleStops, departures, selected, view]);

    // The stop the pointer has settled on. Departures follow this rather than `selected`, so sweeping the mouse across
    // several stops only fetches the one it lands on
    const [settledStop, setSettledStop] = useState<MapStop | undefined>();
    useEffect(() => {
      const timeout = setTimeout(() => {
        setSettledStop(selected);
      }, 300);
      return () => {
        clearTimeout(timeout);
      };
    }, [selected]);

    // Same key as useMetrolinkStop, so the stop page can reuse what's fetched here
    const { data: stopInfo, error: stopInfoError } = useSWR<StopInfo, unknown>(
      settledStop ? ["stop", settledStop.name] : null,
      () => getStopInfo(settledStop?.name ?? ""),
      swrOptions
    );

    return (
      <div ref={containerRef} className="relative h-full w-full">
        <main className="absolute bottom-0 left-0 right-0 z-800 mx-4 mb-4 lg:bottom-auto lg:top-0 lg:mt-4 lg:w-full lg:max-w-sm">
          <Panel className="max-h-[50dvh] space-y-4 overflow-y-auto py-3 lg:max-h-[calc(100dvh-2rem)] lg:py-4">
            <header className="space-y-3">
              <AppLink to="/" className="block text-center">
                <h1 className="text-xl font-semibold">{`metrolink stops`}</h1>
              </AppLink>
              <HomeTabs />
            </header>

            <section aria-labelledby="selected-stop" className="space-y-2">
              {selected ? (
                <>
                  <h2 id="selected-stop" className="font-semibold">
                    <AppLink to={`/${slugify(selected.name)}`}>{selected.name}</AppLink>
                  </h2>
                  <SelectedStopDepartures
                    stopInfo={stopInfo?.name === selected.name ? stopInfo : undefined}
                    isError={stopInfoError !== undefined && settledStop === selected}
                  />
                </>
              ) : (
                <p id="selected-stop">Hover over or tap a stop to see its next trams, and how far you can travel.</p>
              )}
            </section>

            <section aria-label="Travel time key" className="space-y-1 text-sm">
              <p>{selected ? `Travel time from ${selected.name}:` : "Travel time:"}</p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {Object.entries(durationColors).map(([duration, color]) => (
                  <li key={duration} className="flex items-center space-x-1">
                    <span className="inline-block h-4 w-4 rounded" style={{ backgroundColor: color }} />
                    <span>{duration} min</span>
                  </li>
                ))}
              </ul>
            </section>

            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={showLiveTimes}
                onChange={(e) => {
                  setShowLiveTimes(e.target.checked);
                }}
              />
              <span>
                Label stops with live times
                {showLiveTimes && view && view.zoom < LABEL_MIN_ZOOM && (
                  <span className="text-gray-600 dark:text-gray-300"> (zoom in to see them)</span>
                )}
              </span>
            </label>

            <footer className="flex justify-center space-x-2 text-sm">
              <p>
                <span aria-hidden>💛</span>{" "}
                <Anchor href="https://rjackson.dev" aria-label="RJackson.dev">rjackson.dev</Anchor>
              </p>

              <p>
                Contains{" "}
                <Anchor href="https://tfgm.com/" target="_blank" rel="noreferrer">
                    <abbr title="Transport for Greater Manchester">TfGM</abbr>
                  </Anchor>{" "}
                data.
              </p>
            </footer>
          </Panel>
        </main>
        <MapContainer
          ref={mapRef}
          center={center}
          zoom={zoom}
          scrollWheelZoom={true}
          preferCanvas={true}
          zoomControl={false}
        >
          <MapZoomer linesRef={linesRef} />
          <ZoomControl position="topright" />
          <VectorBasemapLayer
            styleKey={prefersDark ? "ArcGIS:DarkGray" : "ArcGIS:LightGray"}
            apiKey={import.meta.env.VITE_ESRI_API_KEY ?? ""}
            style={(style: StyleSpecification) => {
              return { ...style, layers: style.layers.filter((layer) => includeLayerTypeInBackground[layer.type]) };
            }}
          />
          <VectorBasemapLayer
            styleKey={prefersDark ? "ArcGIS:DarkGray" : "ArcGIS:LightGray"}
            apiKey={import.meta.env.VITE_ESRI_API_KEY ?? ""}
            pane="esri-labels"
            style={(style: StyleSpecification) => {
              return {
                ...style,
                layers: style.layers
                  .filter((layer) => {
                    if (includeLayerTypeInBackground[layer.type]) {
                      return false;
                    }

                    // Only allow certain roads
                    if (layer.id.startsWith("Road/") && !Object.hasOwn(permittedRoadLayers, layer.id)) {
                      return false;
                    }

                    // Hide all labels
                    if (layer.id.includes("/label/")) {
                      return false;
                    }

                    return true;
                  })
                  .map((layer) => {
                    if (Object.hasOwn(permittedRoadLayers, layer.id)) {
                      // Knock back the transparency of permitted road layers
                      return {
                        ...layer,
                        paint: {
                          ...layer.paint,
                          "line-width": 1,
                          "line-opacity": 0.2,
                        },
                      };
                    }

                    if (Object.hasOwn(textLayersToEmphasize, layer.id)) {
                      return {
                        ...layer,
                        paint: {
                          ...layer.paint,
                          "text-color": prefersDark ? "white" : "black",
                          "text-halo-width": 2,
                          "text-halo-blur": 1,
                        },
                      };
                    }
                    return layer;
                  }),
              };
            }}
          />
          <Pane name="isochronePane" style={{ zIndex: 290 }} />
          {activeIsochrone && (
            <GeoJSON
              key={activeIsochrone.stopId}
              data={activeIsochrone.data}
              pane="isochronePane"
              style={(feature) => {
                return {
                  // TODO: make typescript happy again
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-expect-error
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                  fillColor: durationColors[feature.properties.duration],
                  fillOpacity: 0.66,
                  weight: 0,
                };
              }}
            />
          )}
          <FeatureGroup ref={linesRef}>
            {!prefersDark && (
              <GeoJSON
                data={lines}
                pathOptions={{
                  color: colors.yellow[500],
                  opacity: 1,
                  weight: 5,
                }}
              />
            )}
            <GeoJSON
              data={lines}
              pathOptions={{
                color: prefersDark ? colors.yellow[300] : colors.yellow[300],
                opacity: 1,
                weight: 3,
              }}
            />
          </FeatureGroup>

          <ViewTracker onChange={setView} />
          <FeatureGroup ref={markersRef}>
            {stops.map((stop) => {
              const placement = labelPlacements.get(stop.stopId);
              const content = labelContent(stop);
              return (
                <CircleMarker
                  /* Larger invisible touch-target */
                  key={stop.stopId}
                  center={[stop.lat, stop.lon]}
                  radius={24}
                  pane="markerPane"
                  eventHandlers={{
                    click: () => {
                      setSelectedStop(stop.stopId);
                    },
                    mouseover: () => {
                      setSelectedStop(stop.stopId);
                    },
                  }}
                  pathOptions={{
                    opacity: 0,
                    fillOpacity: 0,
                  }}
                >
                  <CircleMarker
                    center={[stop.lat, stop.lon]}
                    pathOptions={{
                      color: "black",
                      fillOpacity: prefersDark ? 0.8 : 1,
                      fillColor: selectedStop == stop.stopId ? "yellow" : "white",
                      weight: 1,
                    }}
                    radius={selectedStop == stop.stopId ? 5 : 3}
                    pane="markerPane"
                  />
                  <Tooltip
                    /* Leaflet doesn't update tooltip options in place, so remount when the placement changes */
                    key={placement ?? "hover"}
                    permanent={placement !== undefined}
                    direction={placement ?? "auto"}
                    offset={placement === "left" ? [-6, 0] : placement === "right" ? [6, 0] : [0, 0]}
                    className="stop-label"
                  >
                    <span className="stop-label-name">{content.name}</span>
                    {content.rows?.length === 0 && <span className="stop-label-muted">No trams due</span>}
                    {content.rows && content.rows.length > 0 && (
                      <span className="stop-label-rows">
                        {content.rows.map(({ destination, time }) => (
                          <Fragment key={destination}>
                            <span>{destination}</span>
                            <span className="stop-label-time">{time}</span>
                          </Fragment>
                        ))}
                      </span>
                    )}
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </FeatureGroup>
        </MapContainer>
        <style>
          {`
            .leaflet-container {
              // min-height: 36rem;
              height: 100%;
              flex: 1;
            }

            .leaflet-tooltip.stop-label {
              padding: 2px 6px;
              font-size: 12px;
              line-height: 16px;
              box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
            }
            .stop-label-name {
              display: block;
              font-weight: 600;
            }
            .stop-label-rows {
              display: grid;
              grid-template-columns: auto auto;
              column-gap: 10px;
            }
            .stop-label-time {
              text-align: right;
              font-variant-numeric: tabular-nums;
              color: ${colors.gray[600]};
            }
            .stop-label-muted {
              display: block;
              color: ${colors.gray[600]};
            }
            .dark .leaflet-tooltip.stop-label {
              background-color: ${colors.gray[800]};
              border-color: ${colors.gray[700]};
              color: ${colors.gray[50]};
            }
            .dark .stop-label-time,
            .dark .stop-label-muted {
              color: ${colors.gray[300]};
            }
            .dark .leaflet-tooltip-right.stop-label::before {
              border-right-color: ${colors.gray[800]};
            }
            .dark .leaflet-tooltip-left.stop-label::before {
              border-left-color: ${colors.gray[800]};
            }
            .dark .leaflet-tooltip-top.stop-label::before {
              border-top-color: ${colors.gray[800]};
            }
            .dark .leaflet-tooltip-bottom.stop-label::before {
              border-bottom-color: ${colors.gray[800]};
            }
          `}
        </style>
      </div>
    );
  };

  return ClientOnlyMap;
};

// Leaflet and friends are imported dynamically within, so they're only loaded alongside the map
const IsochroneMap = lazy(async () => ({ default: await initClientOnlyMap() }));

export default function MetrolinkMap() {
  useDocumentTitle("Metrolink map");

  return (
    <Suspense>
      <IsochroneMap />
    </Suspense>
  );
}
