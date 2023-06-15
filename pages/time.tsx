import { H3, Section } from "@rjackson/rjds";
import "leaflet/dist/leaflet.css";
import dynamic from "next/dynamic";
import { LatLngTuple } from "leaflet";
import Head from "next/head";

const initClientOnlyMap = async (): Promise<() => JSX.Element> => {
  const { MapContainer, TileLayer } = await import("react-leaflet");
  const center: LatLngTuple = [53.4781, -2.2433]; // St Peters Square
  const zoom = 10;

  const ClientOnlyMap = () => {
    // TODO: ResizeObserver?
    return (
      <div className="w-full h-full">
        <MapContainer center={center} zoom={zoom} scrollWheelZoom={true} preferCanvas={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
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
export default function TravelTimeMap() {
  return (
    <>
      <Head>
        <title>Travel Time Map</title>
      </Head>
      <div className="space-y-8">
        <Section as="main" className="space-y-2 md:space-y-6" aria-labelledby="travel-time-map">
          <H3 id="travel-time-map">Travel Time Map</H3>

          <Map />
        </Section>
      </div>
    </>
  );
}
