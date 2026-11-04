import AppLink from "../components/AppLink";
import { ChangeEvent, useState } from "react";
import { useSearchParams } from "react-router";
import Fuse from "fuse.js";
import { useVisitedStopsState, useVisitedStopsUpdate } from "../components/context/VisitedStops";
import { Button, H3, Input, Panel, Section } from "@rjackson/rjds";
import Select from "../components/Select";
import slugify from "../utils/slugify";
import { stops } from "../lib/stops";
import { lines, linesAtStop } from "../lib/lines";
import LineSwatch from "../components/LineSwatch";
import LineRoute from "../components/LineRoute";

const fuse = new Fuse(stops, { keys: ["StationLocation", "lines"], includeScore: true });

const lineSlug = (lineId: string) => slugify(lineId);

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const results = fuse.search(searchTerm);
  const stopResults = searchTerm ? results.map(({ item }) => item) : stops;

  // The line filter is kept in the URL (e.g. ?line=green-line), so it survives going back from a stop
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedLine = lines.find(({ id }) => lineSlug(id) === searchParams.get("line"));
  const setSelectedLine = (slug: string) => {
    setSearchParams(slug ? { line: slug } : {}, { replace: true });
  };

  // On a line, its stops in line order, narrowed by any search
  const matchingAtcoCodes = new Set(stopResults.map(({ atcoCode }) => atcoCode));
  const lineStopResults = selectedLine?.stops.filter(({ atcoCode }) => matchingAtcoCodes.has(atcoCode)) ?? [];
  const resultCount = selectedLine ? lineStopResults.length : stopResults.length;

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
            <ul className="space-y-1">
              {recentStops.map((StationLocation) => (
                <li key={StationLocation}>
                  <AppLink to={`/${slugify(StationLocation)}`}>{StationLocation}</AppLink>
                </li>
              ))}
            </ul>
          </Panel>
        </Section>
      )}

      <Section aria-labelledby="all-stops" className="space-y-4">
        <H3 id="all-stops" className={recentStops.length == 0 ? "sr-only" : ""}>
          All stops
        </H3>

        <Panel className="space-y-5">
          <nav>
            <p>
              <AppLink to={`/time`}>Travel time map</AppLink> &ndash; see how far you can travel from each stop
            </p>
          </nav>

          <form
            role="search"
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <div className="flex flex-col gap-1">
              <label htmlFor="search" className="text-base text-gray-700 dark:text-gray-300">
                Search
              </label>
              <Input
                type="text"
                name="search"
                id="search"
                value={searchTerm}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setSearchTerm(e.target.value);
                }}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="line" className="text-base text-gray-700 dark:text-gray-300">
                Line
              </label>
              <Select
                name="line"
                id="line"
                value={selectedLine ? lineSlug(selectedLine.id) : ""}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  setSelectedLine(e.target.value);
                }}
              >
                <option value="">All lines</option>
                {lines.map(({ id, name, colourName }) => (
                  <option key={id} value={lineSlug(id)}>
                    {name} ({colourName})
                  </option>
                ))}
              </Select>
            </div>
          </form>

          <p className="sr-only" aria-live="polite">
            {resultCount} {resultCount === 1 ? "stop" : "stops"}
          </p>

          {resultCount === 0 && <p className="italic text-gray-700 dark:text-gray-400">No matching stops</p>}

          {selectedLine ? (
            <LineRoute line={selectedLine} stops={lineStopResults} />
          ) : (
            <ul className="gap-8 sm:columns-2">
              {stopResults.map(({ StationLocation, atcoCode }) => {
                const stopLines = linesAtStop(atcoCode);
                return (
                  <li key={StationLocation} className="flex items-center gap-2 py-0.5 break-inside-avoid">
                    <AppLink to={`/${slugify(StationLocation)}`}>{StationLocation}</AppLink>
                    {/* Decorative: the line filter is the accessible way to find stops by line */}
                    <span
                      aria-hidden
                      className="inline-flex gap-1"
                      title={stopLines.map(({ name, colourName }) => `${name} (${colourName})`).join(", ")}
                    >
                      {stopLines.map((line) => (
                        <LineSwatch key={line.id} line={line} />
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </Section>
    </div>
  );
}
