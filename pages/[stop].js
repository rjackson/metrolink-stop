import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useVisitedStopsUpdate } from "../components/context/VisitedStops";
import useMetrolinkStop from "../components/hooks/useMetrolinkStop";
import MetrolinkDestination from "../components/MetrolinkDestination";
import { getStops } from "../lib/tfgm-metrolink";
import LoadingWrapper from "../components/LoadingWrapper";
import { Anchor, H2, H3, Panel, Section } from "@rjackson/rjds";
import slugify from "../utils/slugify";

export default function Stop({ stop: stopName, allStops }) {
  const {
    stopInfo: { name = stopName, departures = [], messages = [], lastUpdated = "" } = {},
    isLoading,
    isError,
  } = useMetrolinkStop(stopName);
  
  const [lastUpdatedDateTimeLabel, setLastUpdatedDateTimeLabel] = useState(lastUpdated);

  useEffect(() => {
    const lastUpdatedDate = new Date(lastUpdated);
    setLastUpdatedDateTimeLabel(lastUpdatedDate.toLocaleTimeString("en-GB", { timeStyle: "long" }));
  }, [lastUpdated]);

  const { track } = useVisitedStopsUpdate();
  useEffect(() => {
    track(stopName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Head>
        <title>{name} stop info</title>
      </Head>
      <div className="space-y-6 md:space-y-10">
        <div className="flex flex-col items-center md:flex-row">
          <div className="flex-1">
            <Link href="/" passHref>
              {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
              <Anchor>
                <span aria-hidden>👈</span> Back
                <span className="sr-only">to list of stops</span>
              </Anchor>
            </Link>
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
                    departures.map(({ destination, type, wait }, i) => (
                      <tr key={i}>
                        <th scope="row" className="py-1 font-normal text-left truncate">
                          <MetrolinkDestination destination={destination} allStops={allStops} />
                        </th>
                        <td className="tabular-nums">
                          <time dateTime="PT{wait}M" aria-label={`${wait} minutes`}>
                            <span>{wait}</span>
                            <abbr title="minutes">m</abbr>
                          </time>
                        </td>
                        <td className="py-1 text-right">{type}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="py-1 text-center">
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
              {messages.length > 0 ? (
                <ul className="space-y-2">
                  {messages.map((message, i) => (
                    <li key={i}>{message}</li>
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
        <Link href="/" passHref>
          <Anchor>
            <span aria-hidden>👈</span> Back to list of stops
          </Anchor>
        </Link>
      </nav>
    </>
  );
}

// const slugify = (stop) => stop?.toLowerCase().replace(/ /g, "-");

export async function getStaticProps({ params: { stop: sluggedStop } }) {
  const stops = await getStops();
  const { StationLocation: stop } = stops.filter(
    ({ StationLocation }) => slugify(StationLocation) === sluggedStop
  )?.[0];

  return {
    props: { stop, allStops: stops }, // will be passed to the page component as props
  };
}

export async function getStaticPaths() {
  const gottenStops = await getStops();
  const stops = gottenStops.map(({ StationLocation }) => StationLocation);
  const paths = stops.map((stop) => ({ params: { stop: slugify(stop) } }));

  return {
    paths,
    fallback: false,
  };
}
