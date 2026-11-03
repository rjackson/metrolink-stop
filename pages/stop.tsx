import AppLink from "../components/AppLink";
import { useEffect, useState } from "react";
import { useVisitedStopsUpdate } from "../components/context/VisitedStops";
import useMetrolinkStop from "../components/hooks/useMetrolinkStop";
import MetrolinkDestination from "../components/MetrolinkDestination";
import { StopsEntry } from "../lib/stops";
import useDocumentTitle from "../components/hooks/useDocumentTitle";
import LoadingWrapper from "../components/LoadingWrapper";
import Pill from "../components/Pill";
import { Anchor, H2, H3, Panel, Section } from "@rjackson/rjds";

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

type Props = {
  stop: string;
  allStops: StopsEntry[];
};
export default function Stop({ stop: stopName, allStops }: Props) {
  const {
    stopInfo: { name = stopName, departures = [], messages = [], alerts, lastUpdated = "" } = {},
    isLoading,
    isError,
  } = useMetrolinkStop(stopName);

  const [lastUpdatedDateTimeLabel, setLastUpdatedDateTimeLabel] = useState(lastUpdated);

  useEffect(() => {
    const lastUpdatedDate = new Date(lastUpdated);
    setLastUpdatedDateTimeLabel(lastUpdatedDate.toLocaleTimeString("en-GB", { timeStyle: "long" }));
  }, [lastUpdated]);

  useDocumentTitle(`${name} stop info`);

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
              {alerts && alerts.length > 0 ? (
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
              ) : messages.length > 0 ? (
                <ul className="space-y-2">
                  {messages.map((message, i) => (
                    <li key={i} className="whitespace-pre-line">
                      {message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="italic text-center text-gray-700">No messages</p>
              )}
            </LoadingWrapper>
          </Panel>
        </Section>

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
        {/* (a stop chooser at some point in the future) */}
        <AppLink to="/">
            <span aria-hidden>👈</span> Back to list of stops
          </AppLink>
      </nav>
    </>
  );
}
