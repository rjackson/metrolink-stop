import { getStops } from "../lib/tfgm-metrolink";
import Link from "next/link";
import { useState } from "react";
import Fuse from "fuse.js";

/**
 * @param {Object} props
 * @param {{StationLocation: string, Line: string}[]} props.stops
 */
export default function Home({ stops }) {
  // These are funky cause map operations mutate, and thus dont trigger a re-render. New maps force rerenders.
  const slugify = (station) => encodeURIComponent(station.replace(/ /g, "-").toLowerCase());
  const [searchTerm, setSearchTerm] = useState("");
  const fuse = new Fuse(stops, { keys: ["StationLocation", "Line"], includeScore: true });
  const results = fuse.search(searchTerm);
  const stopResults = !!searchTerm ? results.map(({ item }) => item) : stops;

  return (
    <main className="flex flex-col flex-1 w-full max-w-screen-md px-6 py-4 space-y-4">
      <h1 className="text-2xl font-semibold tracking-wide text-center uppercase">Metrolink stops</h1>

      <form onSubmit={(e) => e.preventDefault()}>
        <div role="search" className="flex flex-col items-start space-y-2 md:items-center">
          <label htmlFor="search">Search</label>
          <input
            type="text"
            name="search"
            id="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-2 py-1 bg-white border-gray-300 rounded-md shadow-sm md:max-w-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>
      </form>

      <ul className="px-4 py-4 space-y-2 bg-white rounded-md shadow md:text-center">
        {stopResults.map(({ StationLocation }) => (
          <li key={StationLocation}>
            <Link href={`/${slugify(StationLocation)}`}>
              <a>{StationLocation}</a>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

export async function getStaticProps(context) {
  const stops = await getStops();

  // Sort alphabetically by default
  const sortedStops = stops.sort((a, b) => a.StationLocation.localeCompare(b.StationLocation));

  return {
    props: { stops: sortedStops }, // will be passed to the page component as props
  };
}
