import { H3, Section } from "@rjackson/rjds";
import "leaflet/dist/leaflet.css";
import dynamic from "next/dynamic";
import { LatLngTuple } from "leaflet";
import Head from "next/head";
import stops from "../data/lines/stops.json";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const initClientOnlyMap = async (): Promise<() => JSX.Element> => {
  const L = await import("leaflet");
  const { MapContainer, TileLayer, Marker, Popup } = await import("react-leaflet");

  L.Marker.prototype.options.icon = L.icon({
    iconUrl: icon.src,
    shadowUrl: iconShadow.src,
  });

  const center: LatLngTuple = [53.4781, -2.2433]; // St Peters Square
  const zoom = 10;

  const ClientOnlyMap = () => {
    return (
      <div className="w-full h-full">
        <MapContainer center={center} zoom={zoom} scrollWheelZoom={true} preferCanvas={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {stops.map((stop) => (
            <Marker
              key={stop.stop_code}
              position={[stop.stop_lat, stop.stop_lon]}
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