import { usePrefersDark } from "@rjackson/rjds";
import "leaflet/dist/leaflet.css";
import dynamic from "next/dynamic";
import { FeatureGroup, LatLngExpression, LatLngTuple } from "leaflet";
import Head from "next/head";
import { GetStaticProps, InferGetStaticPropsType } from "next";
import { loadIsochrones } from "../lib/isochrones";
import { ReactElement, RefObject, useEffect, useRef, useState } from "react";
import { emerald, fuchsia, indigo, pink, purple, red, sky, yellow } from "tailwindcss/colors";
import { MapLayout } from "../components/layouts/MapLayout";
import useResizeObserver from "@react-hook/resize-observer";
import stops from "../lib/gtfs-stops";
import lines from "../lib/gtfs-lines";

import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

type MapProps = {
  isochrones: Awaited<ReturnType<typeof loadIsochrones>>;
};

const initClientOnlyMap = async (): Promise<(props: MapProps) => JSX.Element> => {
  const { MapContainer, GeoJSON, CircleMarker, useMap, FeatureGroup, Polyline, Pane } = await import("react-leaflet");
  const { VectorBasemapLayer } = await import("../components/leaflet/VectorBasemapLayer");

  const center: LatLngTuple = [53.4781, -2.2433]; // St Peters Square
  const zoom = 11;

  const MapZoomer = ({ markersRef }: { markersRef: RefObject<FeatureGroup> }) => {
    const map = useMap();
    const debounceTimeout = useRef<NodeJS.Timeout>();

    useEffect(() => {
      clearTimeout(debounceTimeout.current);

      debounceTimeout.current = setTimeout(() => {
        const bounds = markersRef.current?.getBounds();
        if (bounds?.isValid()) {
          map.fitBounds(bounds, { padding: [100, 100] });
        }
      }, 300);
    }, [map, markersRef]);

    return null;
  };

  const ClientOnlyMap = ({ isochrones }: MapProps) => {
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

    const lineColors = {
      "Blue Line": sky[500],
      "Green Line": emerald[500],
      "Navy Line": indigo[500],
      "Pink Line": pink[500],
      "Purple Line": purple[500],
      "Red Line": red[500],
      "Yellow Line": yellow[500],
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
    const outboundLines = lines.filter((line) => line.route_id.endsWith(":O:CURRENT"));

    useResizeObserver(containerRef, () => {
      mapRef.current?.invalidateSize();
    });
    return (
      <div ref={containerRef} className="w-full h-full">
        <MapContainer ref={mapRef} center={center} zoom={zoom} scrollWheelZoom={true} preferCanvas={false}>
          <MapZoomer markersRef={markersRef} />
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
                  color: prefersDark ? "black" : "white",
                  weight: prefersDark ? 1 : 2,
                };
              }}
            />
          )}
          <FeatureGroup ref={linesRef}>
            {outboundLines.map((line) => (
              <Polyline
                key={line.route_id}
                positions={line.stops.map(({ stop_lat, stop_lon }): LatLngExpression => [stop_lat, stop_lon])}
                pathOptions={{
                  // TODO: make typescript happy again
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-expect-error
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  color: lineColors[line.route_short_name],
                  opacity: 1,
                  weight: 2,
                }}
              />
            ))}
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

export default function TravelTimeMap({ isochrones }: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      <Head>
        <title>Travel Time Map</title>
      </Head>
      {/* <div className="space-y-8">
        <Section as="main" className="space-y-2 md:space-y-6" aria-labelledby="travel-time-map">
          <H3 id="travel-time-map">Travel Time Map</H3>
        </Section> */}

      <IsochroneMap isochrones={isochrones} />
      {/* </div> */}
    </>
  );
}

export const getStaticProps: GetStaticProps<{
  isochrones: Awaited<ReturnType<typeof loadIsochrones>>;
}> = async () => {
  // TODO: Expose this publically and lazy load, rather than shove a ton of data right down the pipe?
  const isochrones = await loadIsochrones();

  return {
    props: {
      isochrones,
    },
  };
};

TravelTimeMap.getLayout = (page: ReactElement) => <MapLayout>{page}</MapLayout>;
