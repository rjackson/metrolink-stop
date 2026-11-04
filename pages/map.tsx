import AppLink from "../components/AppLink";
import HomeTabs from "../components/HomeTabs";
import { Anchor, Panel, usePrefersDark } from "@rjackson/rjds";
import "leaflet/dist/leaflet.css";
import { FeatureGroup, LatLngTuple } from "leaflet";
import { loadIsochrone } from "../lib/isochrones";
import { lazy, RefObject, Suspense, useEffect, useRef, useState, type JSX } from "react";
import colors from "tailwindcss/colors";
import useResizeObserver from "@react-hook/resize-observer";
import stops from "../lib/gtfs-stops";

import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import { metrolinkLinesGeoJSON as lines } from "../lib/tfgm-open-data/gm-metrolink-network/loadMetrolinkLines";
import useDocumentTitle from "../components/hooks/useDocumentTitle";
import type { GeoJsonObject } from "geojson";
import { useMediaQuery } from "@react-hook/media-query";

const initClientOnlyMap = async (): Promise<() => JSX.Element> => {
  const { MapContainer, GeoJSON, CircleMarker, useMap, FeatureGroup, Pane, ZoomControl, Tooltip } = await import(
    "react-leaflet"
  );
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

    return (
      <div ref={containerRef} className="relative h-full w-full">
        <main className="absolute bottom-0 left-0 right-0 z-800 mx-4 mb-4 lg:bottom-auto lg:top-0 lg:mt-4 lg:w-full lg:max-w-sm">
          <Panel className="space-y-4 py-3 lg:py-4">
            <header className="space-y-3">
              <AppLink to="/" className="block text-center">
                <h1 className="text-xl font-semibold">{`metrolink stops`}</h1>
              </AppLink>
              <HomeTabs />
            </header>
            <div className="space-y-2">
              <p>Hover over a stop to see how far you can travel in:</p>
              <ul className="px-3">
                {Object.entries(durationColors).map(([duration, color]) => (
                  <li key={duration} className="flex space-x-2">
                    <span className="inline-block h-6 w-6 rounded-md" style={{ backgroundColor: color }} />{" "}
                    <span>{duration} minutes</span>
                  </li>
                ))}
              </ul>
            </div>
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

          <FeatureGroup ref={markersRef}>
            {stops.map((stop) => (
              <CircleMarker
                /* Larger invisible touch-target */
                key={stop.stop_code}
                center={[stop.stop_lat, stop.stop_lon]}
                radius={24}
                pane="markerPane"
                eventHandlers={{
                  click: () => {
                    setSelectedStop(stop.stop_id);
                  },
                  mouseover: () => {
                    setSelectedStop(stop.stop_id);
                  },
                }}
                pathOptions={{
                  opacity: 0,
                  fillOpacity: 0,
                }}
              >
                <CircleMarker
                  center={[stop.stop_lat, stop.stop_lon]}
                  pathOptions={{
                    color: "black",
                    fillOpacity: prefersDark ? 0.8 : 1,
                    fillColor: selectedStop == stop.stop_id ? "yellow" : "white",
                    weight: 1,
                  }}
                  radius={selectedStop == stop.stop_id ? 5 : 3}
                  pane="markerPane"
                />
                <Tooltip>{stop.stop_name.replace(" (Manchester Metrolink)", "")}</Tooltip>
              </CircleMarker>
            ))}
          </FeatureGroup>
        </MapContainer>
        <style>
          {`
            .leaflet-container {
              // min-height: 36rem;
              height: 100%;
              flex: 1;
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
