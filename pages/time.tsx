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

  // TODO: Separate vector tile background / details (want labels and road networks _above_ background)
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
            // todo: Possible to overlay labels and road markings over geojson?
            styleKey={prefersDark ? "ArcGIS:DarkGray" : "ArcGIS:LightGray"}
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            apiKey={process.env.NEXT_PUBLIC_ESRI_API_KEY!}
          />
          <Pane name="isochronePane" style={{ zIndex: 300 }} />
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
