import { Anchor } from "@rjackson/rjds";
import Link from "next/link";
import { StopsEntry } from "../lib/tfgm-metrolink";
import slugify from "../utils/slugify";

const customMappings: Record<string, string> = {
  MCUK: "MediaCityUK",
  "Ashton-under-Lyne": "Ashton-Under-Lyne",
  Ashton: "Ashton-Under-Lyne",
  Deansgate: "Deansgate - Castlefield",
  "Deansgate Castlefield": "Deansgate - Castlefield",
};

type DestinationProps = {
  destination: string;
  stopNames: string[];
};
const Destination = ({ destination, stopNames }: DestinationProps) => {
  const middleDestination = customMappings[destination] || destination;

  return (
    <>
      {stopNames.includes(middleDestination) ? (
        <Link href={`/${slugify(middleDestination)}`} passHref>
          <Anchor>{destination}</Anchor>
        </Link>
      ) : (
        <span>{destination}</span>
      )}
    </>
  );
};

type Props = {
  destination: string;
  allStops: StopsEntry[];
};
export default function MetrolinkDestination({ destination, allStops = [] }: Props) {
  const stopNames = allStops.map(({ StationLocation }) => StationLocation);

  if (destination.includes(" via ")) {
    const [first, second] = destination.split(" via ");

    return (
      <>
        <Destination destination={first} stopNames={stopNames} /> via{" "}
        <Destination destination={second} stopNames={stopNames} />
      </>
    );
  }

  return <Destination destination={destination} stopNames={stopNames} />;
}
