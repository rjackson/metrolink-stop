import Link from "next/link";
import { Fragment } from "react";
import { slugify } from "../lib/tfgm-metrolink";
import stops from "../public/stops.json";

const customMappings = {
  MCUK: "MediaCityUK",
  "Ashton-under-Lyne": "Ashton-Under-Lyne",
  Ashton: "Ashton-Under-Lyne",
};

const doStuffToDestination = (destination) => {
  const middleDestination = customMappings?.[destination] || destination;

  return (
    <Fragment key={destination}>
      {stops.includes(middleDestination) ? (
        <Link href={`/${slugify(middleDestination)}`}>
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <a>{destination}</a>
        </Link>
      ) : (
        <span>{destination}</span>
      )}
    </Fragment>
  );
};

export default function MetrolinkDestination({ destination }) {
  const finalDestination = destination
    .split(" via ")
    .map(doStuffToDestination)
    .reduce((prev, curr) => (prev === null ? [curr] : [prev, <span key="via"> via </span>, curr]));

  return <>{finalDestination}</>;
}
