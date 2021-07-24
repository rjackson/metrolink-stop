import { getStops } from "../lib/tfgm-metrolink";
import Link from "next/link";
import { useState } from "react";

export default function Home({ stops }) {
  const [selectedLine, setSelectedLine] = useState();
  const lines = [...new Set(stops.map(({ Line }) => Line))];

  const slugify = (station) => encodeURIComponent(station.replaceAll(" ", "-").toLowerCase());

  return (
    <main>
      <h1>Choose your stop</h1>
      <label for="lines">Filter by lines</label>
      <select name="lines" id="lines" onChange={(e) => setSelectedLine(e.target.value)}>
        <option value="">All lines</option>
        {lines.map((line) => (
          <option value={line} selected={line === selectedLine}>
            {line}
          </option>
        ))}
      </select>
      <table>
        <thead>
          <th>Location</th>
          <th>Line</th>
        </thead>
        <tbody>
          {stops.map(({ Line, StationLocation }) => (
            <>
              {(!selectedLine || selectedLine == Line) && (
                <tr key={StationLocation}>
                  <td>
                    <Link href={`/${slugify(StationLocation)}`}>
                      <a>{StationLocation}</a>
                    </Link>
                  </td>
                  <td>{Line}</td>
                </tr>
              )}
            </>
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
