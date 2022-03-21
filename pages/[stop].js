import Head from "next/head";
import Link from "next/link";
import { useEffect } from "react";
import { useVisitedStopsUpdate } from "../components/context/VisitedStops";
import useMetrolinkStop from "../components/hooks/useMetrolinkStop";
import MetrolinkDestination from "../components/MetrolinkDestination";
import { getStops } from "../lib/tfgm-metrolink";
import LoadingWrapper from "../components/LoadingWrapper";

export default function Stop({ stop: stopName, allStops }) {
  const {
    stopInfo: { name = stopName, departures = [], messages = [], lastUpdated = new Date().toISOString() } = {},
    isLoading,
    isError,
  } = useMetrolinkStop(stopName);
  const lastUpdatedDate = new Date(lastUpdated);

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
      <main className="flex flex-col flex-1 w-full max-w-screen-md px-6 py-4 space-y-8 md:space-y-10">
        <div className="flex flex-col items-center sm:flex-row">
          <div className="flex-1">
            <Link href="/">
              {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
              <a>
                <span aria-hidden>👈</span> Back
                <span className="sr-only">to list of stops</span>
              </a>
            </Link>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-wide text-center uppercase">{name}</h1>
          </div>
          <div className="flex-1">&nbsp;</div>
        </div>
        <section className="space-y-2 md:space-y-6" aria-labelledby="departures">
          <h2
            id="departures"
            className="font-semibold tracking-wide text-center text-gray-800 uppercase dark:text-gray-300"
          >
            Departures
          </h2>
          <div className="px-4 py-4 bg-white rounded-md shadow dark:bg-gray-800 dark:border dark:border-gray-700">
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
                    departures.map(({ destination, type, status, wait }, i) => (
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
          </div>
        </section>
        <section className="space-y-2 md:space-y-6" aria-labelledby="messageboard">
          <h2
            id="messageboard"
            className="font-semibold tracking-wide text-center text-gray-800 uppercase dark:text-gray-300"
          >
            Message board
          </h2>
          <div
            className="px-4 py-4 bg-white rounded-md shadow md:text-center dark:bg-gray-800 dark:border dark:border-gray-700"
            aria-live="polite"
          >
            <LoadingWrapper
              isLoading={isLoading}
              isError={isError}
              errorMessage={"Failed to load message board information"}
            >
              {messages.length > 0 ? (
                <ul className="space-y-2 ">
                  {messages.map((message, i) => (
                    <li key={i}>{message}</li>
                  ))}
                </ul>
              ) : (
                <p className="italic text-center text-gray-700">No messages</p>
              )}
            </LoadingWrapper>
          </div>
        </section>
        <section className="py-4 text-center text-gray-500 dark:text-gray-400" aria-labelledby="metadata">
          <h2 id="metadata" className="sr-only">
            Metadata
          </h2>
          <p>
            Last update{" "}
            <time dateTime={lastUpdatedDate.toISOString()}>
              {lastUpdatedDate.toLocaleTimeString("en-GB", { timeStyle: "long" })}
            </time>
            .
          </p>
        </section>
      </main>
      <nav className="px-6 py-2">
        {/* (a stop chooser at some point in the future) */}
        <Link href="/">
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <a>
            <span aria-hidden>👈</span> Back to list of stops
          </a>
        </Link>
      </nav>
    </>
  );
}

const slugify = (stop) => stop?.toLowerCase().replace(/ /g, "-");

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
