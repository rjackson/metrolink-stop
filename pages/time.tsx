import { H3, Section, usePrefersDark } from "@rjackson/rjds";
import "leaflet/dist/leaflet.css";
import dynamic from "next/dynamic";
import { LatLngTuple } from "leaflet";
import Head from "next/head";
import { GetStaticProps, InferGetStaticPropsType } from "next";
import { loadIsochrones } from "../lib/isochrones";
import { useState } from "react";
import stops from "../data/lines/stops.json";

type MapProps = {
  isochrones: Awaited<ReturnType<typeof loadIsochrones>>;
};

const initClientOnlyMap = async (): Promise<(props: MapProps) => JSX.Element> => {
  const { MapContainer, GeoJSON, CircleMarker } = await import("react-leaflet");
  const { VectorBasemapLayer } = await import("../components/leaflet/VectorBasemapLayer");

  const center: LatLngTuple = [53.4781, -2.2433]; // St Peters Square
  const zoom = 10;

  const ClientOnlyMap = ({ isochrones }: MapProps) => {
    const prefersDark = usePrefersDark();

    const durationColors = {
      "10": `hsl(60, 100%, ${prefersDark ? 50 : 50}%)`,
      "20": `hsl(60, 100%, ${prefersDark ? 33.4 : 67}%)`,
      "30": `hsl(60, 100%, ${prefersDark ? 17 : 84}%)`,
      "40": `hsl(60, 100%, ${prefersDark ? 0 : 100}%)`,
    };

    const [selectedStop, setSelectedStop] = useState<string | undefined>();
    const activeIsochrone = selectedStop ? isochrones[selectedStop] : undefined;
    return (
      <div className="w-full h-full">
        <MapContainer center={center} zoom={zoom} scrollWheelZoom={true} preferCanvas={false}>
          <VectorBasemapLayer
            // todo: Possible to overlay labels and road markings over geojson?
            styleKey={prefersDark ? "ArcGIS:DarkGray" : "ArcGIS:LightGray"}
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            apiKey={process.env.NEXT_PUBLIC_ESRI_API_KEY!}
          />
          {activeIsochrone && (
            <GeoJSON
              key={selectedStop}
              data={activeIsochrone}
              style={(feature) => {
                return {
                  // TODO: make typescript happy again
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-expect-error
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                  fillColor: durationColors[feature.properties.duration],
                  fillOpacity: 0.5,
                  color: prefersDark ? "black" : "white",
                  weight: prefersDark ? 1 : 2,
                };
              }}
            />
          )}
          {stops.map((stop) => (
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
              eventHandlers={{
                mouseover: () => {
                  setSelectedStop(stop.stop_id);
                },
              }}
            />
          ))}
        </MapContainer>
        <style>
          {`
            .leaflet-container {
              min-height: 36rem;
              flex: 1;
            }
          `}
        </style>
      </div>
    );
  };

  return ClientOnlyMap;
};

const Map = dynamic(initClientOnlyMap, { ssr: false });

export default function TravelTimeMap({ isochrones }: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      <Head>
        <title>Travel Time Map</title>
      </Head>
      <div className="space-y-8">
        <Section as="main" className="space-y-2 md:space-y-6" aria-labelledby="travel-time-map">
          <H3 id="travel-time-map">Travel Time Map</H3>

          <Map isochrones={isochrones} />
        </Section>
      </div>
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
