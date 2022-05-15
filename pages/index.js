import { getStops } from "../lib/tfgm-metrolink";
import Link from "next/link";
import { useState } from "react";
import Fuse from "fuse.js";
import { useVisitedStopsState, useVisitedStopsUpdate } from "../components/context/VisitedStops";
import Button from "../components/Button";
import { Anchor, H3, Panel, Section } from "@rjackson/rjds";
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
            <Button onClick={reset}>
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

      <Section aria-labelledby="all-stops">
        <H3 id="all-stops" className={`${recentStops.length == 0 ? "sr-only" : ""}`}>
          All stops
        </H3>
        <div className="space-y-4">
          <form onSubmit={(e) => e.preventDefault()}>
            <div role="search" className="flex flex-col items-start space-y-2 md:items-center">
              <label htmlFor="search">Search</label>
              <input
                type="text"
                name="search"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-2 py-1 bg-white border-gray-300 rounded-md shadow-sm dark:bg-gray-800 dark:border dark:border-gray-700 md:max-w-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                autoComplete="off"
              />
            </div>
          </form>

          <Panel>
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
        </div>
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
