import { Anchor } from "@rjackson/rjds";
import Link from "next/link";
import { Fragment } from "react";
import slugify from "../utils/slugify";

const customMappings = {
  MCUK: "MediaCityUK",
  "Ashton-under-Lyne": "Ashton-Under-Lyne",
  Ashton: "Ashton-Under-Lyne",
};

const doStuffToDestination = (destination, stopNames) => {
  const middleDestination = customMappings?.[destination] || destination;

  return (
    <Fragment key={destination}>
      {stopNames.includes(middleDestination) ? (
        <Link href={`/${slugify(middleDestination)}`} passHref>
          <Anchor>{destination}</Anchor>
        </Link>
      ) : (
        <span>{destination}</span>
      )}
    </Fragment>
  );
};

export default function MetrolinkDestination({ destination, allStops = [] }) {
  const stopNames = allStops.map(({ StationLocation }) => StationLocation);

  const finalDestination = destination
    .split(" via ")
    .map((destination) => {
      return doStuffToDestination(destination, stopNames);
    })
    .reduce((prev, curr) => (prev === null ? [curr] : [prev, <span key="via"> via </span>, curr]));

  return <>{finalDestination}</>;
}
