import { getStops } from "../lib/tfgm-metrolink";
import Link from "next/link";
import { useState } from "react";
import Fuse from "fuse.js";
import { useVisitedStopsState, useVisitedStopsUpdate } from "../components/context/VisitedStops";
import { Anchor, Button, H3, Input, Panel, Section } from "@rjackson/rjds";
import slugify from "../utils/slugify";

/**
 * @param {Object} props
 * @param {{StationLocation: string, Line: string}[]} props.stops
 */
export default function Home({ stops }) {
  const [searchTerm, setSearchTerm] = useState("");
  const fuse = new Fuse(stops, { keys: ["StationLocation", "Line"], includeScore: true });
  const results = fuse.search(searchTerm);
  const stopResults = searchTerm ? results.map(({ item }) => item) : stops;

  const { recentStops } = useVisitedStopsState();
  const { reset } = useVisitedStopsUpdate();

  return (
    <div className="space-y-8">
      {recentStops.length > 0 && (
        <Section aria-labelledby="recently-visited" className="space-y-4">
          <div className="flex justify-between space-x-2">
            <div>
              <H3 id="recently-visited">Recently visited</H3>
            </div>
            <Button onClick={reset} className="bg-white ">
              Clear <span className="sr-only">recently visited</span>
            </Button>
          </div>
          <Panel>
            <ul className="space-y-2 md:text-center">
              {recentStops.map((StationLocation) => (
                <li key={StationLocation}>
                  <Link href={`/${slugify(StationLocation)}`} passHref>
                    <Anchor>{StationLocation}</Anchor>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </Section>
      )}

      <Section aria-labelledby="all-stops" className="space-y-4">
        <H3 id="all-stops" className={`${recentStops.length == 0 ? "sr-only" : ""}`}>
          All stops
        </H3>
        <Panel className="space-y-6">
          <form onSubmit={(e) => e.preventDefault()}>
            <div role="search" className="flex flex-col space-y-2 md:items-center md:max-w-sm md:mx-auto">
              <label htmlFor="search">Search</label>
              <Input
                type="text"
                name="search"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className=""
                autoComplete="off"
              />
            </div>
          </form>
          <ul className="space-y-2 md:text-center">
            {stopResults.map(({ StationLocation }) => (
              <li key={StationLocation}>
                <Link href={`/${slugify(StationLocation)}`} passHref>
                  {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                  <Anchor>{StationLocation}</Anchor>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </Section>
    </div>
  );
}

export async function getStaticProps() {
  const stops = await getStops();

  // Sort alphabetically by default
  const sortedStops = stops.sort((a, b) => a.StationLocation.localeCompare(b.StationLocation));

  return {
    props: { stops: sortedStops }, // will be passed to the page component as props
  };
}
