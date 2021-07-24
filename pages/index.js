import { getStops } from "../lib/tfgm-metrolink";
import Link from "next/link";
import { useState } from "react";

export default function Home({ stops }) {
  const lines = [...new Set(stops.map(({ Line }) => Line))];
  const [selectedLines, setSelectedLines] = useState(new Map(lines.map((line) => [line, false])));
  const showAllLines = Array.from(selectedLines.values()).filter((checked) => !!checked).length === 0;

  // These are funky cause map operations mutate, and thus dont trigger a re-render. New maps force rerenders.
  const selectLine = (line) => setSelectedLines((prev) => new Map([...prev, [line, true]]));
  const deselectLine = (line) => setSelectedLines((prev) => new Map([...prev, [line, false]]));
  const selectedStops = showAllLines ? stops : stops.filter(({ Line }) => selectedLines.get(Line));

  const slugify = (station) => encodeURIComponent(station.replace(/ /g, "-").toLowerCase());

  return (
    <main className="flex flex-col flex-1 w-full max-w-screen-md px-6 py-4 space-y-4">
      <h1 className="text-2xl font-semibold tracking-wide text-center uppercase">Metrolink stops</h1>
      <div aria-labelledby="lineGroup">
        <label id="lineGroup">Filter by lines</label>

        <div className="flex flex-wrap space-y-2">
          {lines.map((line) => (
            <div key={line} className="flex items-center w-full space-x-2 md:w-1/3">
              <input
                id={`lines_${line}`}
                type="checkbox"
                value={line}
                checked={selectedLines.get(line)}
                onChange={(e) => (e.target.checked ? selectLine(e.target.value) : deselectLine(e.target.value))}
              />
              <label htmlFor={`lines_${line}`}>{line}</label>
            </div>
          ))}
        </div>
      </div>
      <table className="w-full table-auto">
        <thead>
          <tr className="text-left">
            <th className="py-2">Location</th>
            <th className="py-2">Line</th>
          </tr>
        </thead>
        <tbody>
          {selectedStops.map(({ Line, StationLocation }) => (
            <tr key={StationLocation}>
              <td className="py-1">
                <Link href={`/${slugify(StationLocation)}`}>
                  <a>
                    {StationLocation}
                  </a>
                </Link>
              </td>
              <td className="py-1">{Line}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

export async function getStaticProps(context) {
  const stops = await getStops();
  return {
    props: { stops }, // will be passed to the page component as props
  };
}
