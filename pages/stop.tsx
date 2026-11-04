import AppLink from "../components/AppLink";
import { ChangeEvent, useEffect, useState } from "react";
import { useVisitedStopsUpdate } from "../components/context/VisitedStops";
import useMetrolinkStop from "../components/hooks/useMetrolinkStop";
import MetrolinkDestination from "../components/MetrolinkDestination";
import { findStopByName, StopsEntry } from "../lib/stops";
import { Line, lineEnds, linesAtStop, neighbours } from "../lib/lines";
import LineSwatch from "../components/LineSwatch";
import LineRoute from "../components/LineRoute";
import slugify from "../utils/slugify";
import useDocumentTitle from "../components/hooks/useDocumentTitle";
import LoadingWrapper from "../components/LoadingWrapper";
import Pill from "../components/Pill";
import { Anchor, H2, H3, H4, Panel, Section } from "@rjackson/rjds";
import Select from "../components/Select";

/** Short labels for TfGM alert effects worth highlighting. Others (e.g. OTHER) are shown without a label */
const alertEffectLabels: Partial<Record<string, string>> = {
  NO_SERVICE: "No service",
  REDUCED_SERVICE: "Reduced service",
  SIGNIFICANT_DELAYS: "Delays",
  DETOUR: "Diversion",
  MODIFIED_SERVICE: "Service change",
  STOP_MOVED: "Stop moved",
  ACCESSIBILITY_ISSUE: "Step-free access",
};

/** e.g. "14:05", in UK time regardless of the viewer's timezone */
const formatClockTime = (isoTime: string) =>
  new Date(isoTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

/** Links to stops, e.g. "MediaCityUK or Harbour City" where a line branches */
const StopLinks = ({ stops }: { stops: StopsEntry[] }) => (
  <>
    {stops.map(({ StationLocation, atcoCode }, i) => (
      <span key={atcoCode}>
        {i > 0 && " or "}
        <AppLink to={`/${slugify(StationLocation)}`}>{StationLocation}</AppLink>
      </span>
    ))}
  </>
);

type DirectionProps = {
  arrow: string;
  towards: StopsEntry;
  nextStops: StopsEntry[];
};
/** The next stop(s) in one direction along a line */
const Direction = ({ arrow, towards, nextStops }: DirectionProps) => (
  <div className="flex gap-2">
    <span aria-hidden className="text-gray-500 dark:text-gray-400">
      {arrow}
    </span>
    <div className="min-w-0">
      <p className="text-sm text-gray-600 dark:text-gray-400">Towards {towards.StationLocation}</p>
      <p>
        {nextStops.length > 0 ? (
          <StopLinks stops={nextStops} />
        ) : (
          <span className="italic text-gray-600 dark:text-gray-400">End of the line</span>
        )}
      </p>
    </div>
  </div>
);

/**
 * One line through a stop: its name, the stops either side, and the whole line with this stop marked. The line's
 * first stop is at the top, so "towards" it is up.
 */
function LineColumn({ line, atcoCode, className = "" }: { line: Line; atcoCode: string; className?: string }) {
  const { towardsStart, towardsEnd } = neighbours(line, atcoCode);
  const [start, end] = lineEnds(line);

  return (
    // On big screens, each column's heading, neighbours and route line up with the other columns' (via subgrid)
    <div className={`min-w-0 space-y-4 lg:space-y-0 lg:grid lg:grid-rows-subgrid lg:row-span-3 lg:gap-y-4 ${className}`}>
      <H4 className="text-left!">
        <span className="flex items-center gap-2">
          <LineSwatch line={line} />
          {line.name}
        </span>
        <span className="block text-sm font-normal text-gray-600 pl-5 dark:text-gray-400">
          <span className="sr-only">(</span>
          {line.colourName}
          <span className="sr-only"> line)</span>
        </span>
      </H4>
      <div className="space-y-2">
        <Direction arrow="↑" towards={start} nextStops={towardsStart} />
        <Direction arrow="↓" towards={end} nextStops={towardsEnd} />
      </div>
      <LineRoute line={line} currentAtcoCode={atcoCode} />
    </div>
  );
}

type Props = {
  stop: string;
  allStops: StopsEntry[];
};
export default function Stop({ stop: stopName, allStops }: Props) {
  const {
    stopInfo: { name = stopName, departures = [], alerts = [], lastUpdated = "" } = {},
    isLoading,
    isError,
  } = useMetrolinkStop(stopName);

  const lastUpdatedDateTimeLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-GB", { timeStyle: "long" })
    : "";

  useDocumentTitle(`${name} stop info`);

  const atcoCode = findStopByName(stopName)?.atcoCode;
  const stopLines = atcoCode ? linesAtStop(atcoCode) : [];
  const hasManyLines = stopLines.length > 1;

  // On narrow screens, where a stop's lines don't fit side by side, one is shown at a time
  const [selectedLineId, setSelectedLineId] = useState(stopLines[0]?.id);

  const { track } = useVisitedStopsUpdate();
  useEffect(() => {
    track(stopName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="space-y-6 md:space-y-10">
        <div className="flex flex-col items-center md:flex-row">
          <div className="flex-1">
            <AppLink to="/">
                <span aria-hidden>👈</span> Back
                <span className="sr-only">to list of stops</span>
              </AppLink>
          </div>
          <div>
            <H2>{name}</H2>
          </div>
          <div className="flex-1 hidden md:block">&nbsp;</div>
        </div>

        <Section as="main" className="space-y-2 md:space-y-6" aria-labelledby="departures">
          <H3 id="departures">Departures</H3>
          <Panel>
            <LoadingWrapper
              isLoading={isLoading}
              isError={isError}
              errorMessage={"Failed to load departure information"}
            >
              <table className="w-full text-center table-fixed" aria-describedby="departures">
                <thead>
                  <tr>
                    <th className="py-2 font-normal text-left text-gray-600 dark:text-gray-400">Destination</th>
                    <th className="py-2 font-normal text-gray-600 dark:text-gray-400">Wait</th>
                    <th className="py-2 font-normal text-right text-gray-600 dark:text-gray-400">Carriages</th>
                  </tr>
                </thead>
                <tbody aria-live="polite" aria-atomic>
                  {departures.length > 0 ? (
                    departures.map(({ destination, type, wait, departureTime }, i) => (
                      <tr key={i}>
                        <th scope="row" className="py-1 font-normal text-left truncate">
                          <MetrolinkDestination destination={destination} allStops={allStops} />
                        </th>
                        <td className="tabular-nums">
                          <time dateTime={`PT${wait}M`} aria-label={`${wait} minutes`}>
                            <span>{wait}</span>
                            <abbr title="minutes">m</abbr>
                          </time>
                          {departureTime && (
                            <>
                              {" "}
                              <time dateTime={departureTime} className="text-sm text-gray-500 dark:text-gray-400">
                                ({formatClockTime(departureTime)})
                              </time>
                            </>
                          )}
                        </td>
                        <td className="py-1 text-right">{type}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-1 text-center">
                        (No departures currently listed)
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot></tfoot>
              </table>
            </LoadingWrapper>
          </Panel>
        </Section>

        <Section className="space-y-2 md:space-y-6" aria-labelledby="messageboard">
          <H3
            id="messageboard"
            className="font-semibold tracking-wide text-center text-gray-800 uppercase dark:text-gray-300"
          >
            Message board
          </H3>
          <Panel aria-live="polite">
            <LoadingWrapper
              isLoading={isLoading}
              isError={isError}
              errorMessage={"Failed to load message board information"}
            >
              {alerts.length > 0 ? (
                <ul className="space-y-6">
                  {alerts.map(({ id, title, description, effect, link }) => (
                    <li key={id} className="space-y-1">
                      <p className="font-semibold">
                        {alertEffectLabels[effect] && (
                          <>
                            <Pill>{alertEffectLabels[effect]}</Pill>{" "}
                          </>
                        )}
                        {title}
                      </p>
                      {description && <p className="whitespace-pre-line">{description}</p>}
                      {link && (
                        <p>
                          <Anchor href={link.href} target="_blank" rel="noopener noreferrer">
                            {link.label.charAt(0).toUpperCase() + link.label.slice(1)}
                          </Anchor>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="italic text-center text-gray-700">No messages</p>
              )}
            </LoadingWrapper>
          </Panel>
        </Section>

        {atcoCode && stopLines.length > 0 && (
          <Section
            className={`space-y-2 md:space-y-6 ${
              // Wider than the page on big screens, so each line gets a column (up to six, at Cornbrook)
              hasManyLines ? "lg:relative lg:left-1/2 lg:-translate-x-1/2 lg:w-[min(calc(100vw-2rem),96rem)]" : ""
            }`}
            aria-labelledby="lines"
          >
            <H3 id="lines">{hasManyLines ? "Lines" : "Line"}</H3>
            <Panel>
              <nav aria-labelledby="lines" className="space-y-6">
                {hasManyLines && (
                  <div className="flex flex-col space-y-2 lg:hidden">
                    <label htmlFor="line">Line</label>
                    <Select
                      id="line"
                      value={selectedLineId}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        setSelectedLineId(e.target.value);
                      }}
                    >
                      {stopLines.map(({ id, name, colourName }) => (
                        <option key={id} value={id}>
                          {name} ({colourName})
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
                <div
                  className="lg:grid lg:gap-x-8 lg:gap-y-10"
                  style={{ gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))" }}
                >
                  {stopLines.map((line) => (
                    <LineColumn
                      key={line.id}
                      line={line}
                      atcoCode={atcoCode}
                      // Shown regardless on big screens, as the column's own lg:grid wins over hidden
                      className={line.id === selectedLineId ? "" : "hidden"}
                    />
                  ))}
                </div>
              </nav>
            </Panel>
          </Section>
        )}

        <Section className="py-4 text-center text-gray-500 dark:text-gray-400" aria-labelledby="metadata">
          <H3 id="metadata" className="sr-only">
            Metadata
          </H3>
          <p>
            Last update <time dateTime={lastUpdated}>{lastUpdatedDateTimeLabel}</time>.
          </p>
        </Section>
      </div>
      <nav className="px-6 py-2">
        <AppLink to="/">
            <span aria-hidden>👈</span> Back to list of stops
          </AppLink>
      </nav>
    </>
  );
}
