import { H3, Section } from "@rjackson/rjds";
import "leaflet/dist/leaflet.css";
import dynamic from "next/dynamic";
import { LatLngTuple } from "leaflet";
import Head from "next/head";
import { GetStaticProps, InferGetStaticPropsType } from "next";
import { loadIsochrones } from "../lib/isochrones";
import { useState } from "react";
import stops from "../data/lines/stops.json";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

type MapProps = {
  isochrones: Awaited<ReturnType<typeof loadIsochrones>>;
};

const initClientOnlyMap = async (): Promise<(props: MapProps) => JSX.Element> => {
  const L = await import("leaflet");
  const { MapContainer, TileLayer, GeoJSON, Marker, Popup } = await import("react-leaflet");

  L.Marker.prototype.options.icon = L.icon({
    iconUrl: icon.src,
    shadowUrl: iconShadow.src,
  });

  const center: LatLngTuple = [53.4781, -2.2433]; // St Peters Square
  const zoom = 10;

  const ClientOnlyMap = ({ isochrones }: MapProps) => {
    const [selectedStop, setSelectedStop] = useState<string | undefined>();
    const activeIsochrone = selectedStop ? isochrones[selectedStop] : undefined;

    return (
      <div className="w-full h-full">
        <MapContainer center={center} zoom={zoom} scrollWheelZoom={true} preferCanvas={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {activeIsochrone && <GeoJSON key={selectedStop} data={activeIsochrone} />}
          {stops.map((stop) => (
            <Marker
              key={stop.stop_code}
              position={[stop.stop_lat, stop.stop_lon]}
              eventHandlers={{
                click: () => {
                  setSelectedStop(stop.stop_id);
                },
              }}
            >
              <Popup>{stop.stop_name}</Popup>
            </Marker>
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
