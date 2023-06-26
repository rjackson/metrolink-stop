import { Anchor, Panel, usePrefersDark } from "@rjackson/rjds";
import "leaflet/dist/leaflet.css";
import dynamic from "next/dynamic";
import { FeatureGroup, LatLngTuple } from "leaflet";
import Head from "next/head";
import { GetStaticProps, InferGetStaticPropsType } from "next";
import { loadIsochrones } from "../lib/isochrones";
import { ReactElement, RefObject, useEffect, useRef, useState } from "react";
import { fuchsia, indigo, yellow } from "tailwindcss/colors";
import { MapLayout } from "../components/layouts/MapLayout";
import useResizeObserver from "@react-hook/resize-observer";
import stops from "../lib/gtfs-stops";

import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import { loadMetrolinkLinesGeoJSON } from "../lib/tfgm-open-data/gm-metrolink-network/loadMetrolinkLines";
import Link from "next/link";

const initClientOnlyMap = async (): Promise<(props: InferGetStaticPropsType<typeof getStaticProps>) => JSX.Element> => {
  const { MapContainer, GeoJSON, CircleMarker, useMap, FeatureGroup, Pane, ZoomControl } = await import(
    "react-leaflet"
  );
  const { VectorBasemapLayer } = await import("../components/leaflet/VectorBasemapLayer");

  const center: LatLngTuple = [53.4781, -2.2433]; // St Peters Square
  const zoom = 11;

  const MapZoomer = ({ linesRef }: { linesRef: RefObject<FeatureGroup> }) => {
    const map = useMap();
    const debounceTimeout = useRef<NodeJS.Timeout>();

    useEffect(() => {
      clearTimeout(debounceTimeout.current);

      debounceTimeout.current = setTimeout(() => {
        const bounds = linesRef.current?.getBounds();
        if (bounds?.isValid()) {
          map.fitBounds(bounds, { padding: [100, 100] });
        }
      }, 300);
    }, [map, linesRef]);

    return null;
  };

  const ClientOnlyMap = ({ isochrones, lines }: InferGetStaticPropsType<typeof getStaticProps>) => {
    const prefersDark = usePrefersDark();
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map>(null);
    const linesRef = useRef<FeatureGroup>(null);
    const markersRef = useRef<FeatureGroup>(null);

    const durationColors = {
      "10": prefersDark ? fuchsia[300] : indigo[800],
      "20": prefersDark ? fuchsia[500] : indigo[600],
      "30": prefersDark ? fuchsia[700] : indigo[400],
      "40": prefersDark ? fuchsia[900] : indigo[200],
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
    const activeIsochrone = selectedStop ? isochrones[selectedStop] : undefined;

    useResizeObserver(containerRef, () => {
      mapRef.current?.invalidateSize();
    });

    return (
      <div ref={containerRef} className="relative h-full w-full">
        <Panel
          as="header"
          className="absolute left-1 right-1 top-1 z-[800] mx-4 my-2 space-y-4 pb-4 md:w-full md:max-w-sm"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-center space-x-2 md:flex-col md:items-start md:space-x-0 md:space-y-1">
              <Link href="/" passHref>
                <Anchor>
                  <h1 className="text-xl font-semibold">{`metrolink stops`}</h1>
                </Anchor>
              </Link>
              <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-300 md:text-2xl">Travel Time Map</h2>
            </div>
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
              <Link href="https://rjackson.dev" passHref>
                <Anchor aria-label="RJackson.dev">rjackson.dev</Anchor>
              </Link>
            </p>

            <p>
              Contains{" "}
              <Link href="https://tfgm.com/" passHref>
                <Anchor target="_blank" rel="noreferrer">
                  <abbr title="Transport for Greater Manchester">TfGM</abbr>
                </Anchor>
              </Link>{" "}
              data.
            </p>
          </footer>
        </Panel>
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
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            apiKey={process.env.NEXT_PUBLIC_ESRI_API_KEY!}
            style={(style: StyleSpecification) => {
              return { ...style, layers: style.layers.filter((layer) => includeLayerTypeInBackground[layer.type]) };
            }}
          />
          <VectorBasemapLayer
            styleKey={prefersDark ? "ArcGIS:DarkGray" : "ArcGIS:LightGray"}
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            apiKey={process.env.NEXT_PUBLIC_ESRI_API_KEY!}
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
              key={selectedStop}
              data={activeIsochrone}
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
                  color: yellow[500],
                  opacity: 1,
                  weight: 5,
                }}
              />
            )}
            <GeoJSON
              data={lines}
              pathOptions={{
                color: prefersDark ? yellow[300] : yellow[300],
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
                radius={10}
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
                  key={stop.stop_code}
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

const IsochroneMap = dynamic(initClientOnlyMap, { ssr: false });

export default function TravelTimeMap({ isochrones, lines }: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      <Head>
        <title>Travel Time Map</title>
      </Head>
      {/* <div className="space-y-8">
        <Section as="main" className="space-y-2 md:space-y-6" aria-labelledby="travel-time-map">
          <H3 id="travel-time-map">Travel Time Map</H3>
        </Section> */}

      <IsochroneMap isochrones={isochrones} lines={lines} />
      {/* </div> */}
    </>
  );
}

export const getStaticProps: GetStaticProps<{
  isochrones: Awaited<ReturnType<typeof loadIsochrones>>;
  lines: Awaited<ReturnType<typeof loadMetrolinkLinesGeoJSON>>;
}> = async () => {
  // TODO: Expose this publically and lazy load, rather than shove a ton of data right down the pipe?
  const isochrones = await loadIsochrones();
  const lines = await loadMetrolinkLinesGeoJSON();

  return {
    props: {
      isochrones,
      lines,
    },
  };
};

TravelTimeMap.getLayout = (page: ReactElement) => <MapLayout>{page}</MapLayout>;
