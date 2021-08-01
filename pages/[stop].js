import { useRouter } from "next/dist/client/router";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useAutoRefresh from "../hooks/useAutoRefresh";
import { getStops } from "../lib/tfgm-metrolink";

export default function Stop({ stop: fullStopName }) {
  /** @type [(import("../lib/tfgm-metrolink").StopInfo), Function] */
  const [stopInfo, setStopInfo] = useState({
    name: fullStopName,
    departures: [],
    messages: [],
    lastUpdated: new Date().toISOString(),
  });
  const { name, departures, messages, lastUpdated } = stopInfo ?? {};
  const lastUpdatedDate = new Date(lastUpdated);

  const loadStopInfo = async () => {
    try {
      const req = await fetch(`/api/stop/${fullStopName}`);
      const data = await req.json();

      setStopInfo(req.status == 200 ? data : null);
    } catch (err) {
      console.log(err);
    }
  };

  const { stop, start, refreshInterval, setRefreshInterval, lastRefresh, refreshingAt, secondsRemaining } =
    useAutoRefresh(loadStopInfo, 60);
  const refreshIntervalMinutes = parseInt(refreshInterval / 60); // maybe do something smarter in the future

  return (
    <>
      <Head>
        <title>{name} stop info</title>
      </Head>
      <nav className="px-6 py-2">
        {/* (a stop chooser at some point in the future) */}
        <Link href="/">
          <a>
            <span aria-hidden>👈</span> Back to list of stops
          </a>
        </Link>
      </nav>
      <main className="flex flex-col flex-1 w-full max-w-screen-md px-6 py-4 space-y-8 md:space-y-16">
        <div>
          <h1 className="text-2xl font-semibold tracking-wide text-center uppercase">{name}</h1>
        </div>
        <div className="space-y-2 md:space-y-6">
          <h2
            id="departures"
            className="font-semibold tracking-wide text-center text-gray-800 uppercase dark:text-gray-300"
          >
            Departures
          </h2>
          <table className="w-full text-center table-fixed" aria-describedby="departures">
            <thead>
              <tr>
                <th className="w-1/4 py-2 font-normal text-left text-gray-600 sm:w-1/2 dark:text-gray-400">
                  Destination
                </th>
                <th className="w-1/4 py-2 font-normal text-gray-600 sm:w-1/6 dark:text-gray-400">Carriages</th>
                <th className="w-1/4 py-2 font-normal text-gray-600 sm:w-1/6 dark:text-gray-400">Status</th>
                <th className="w-1/4 py-2 font-normal text-gray-600 sm:w-1/6 dark:text-gray-400">Wait</th>
              </tr>
            </thead>
            <tbody aria-live="polite" aria-atomic>
              {departures.length > 1 ? (
                departures.map(({ destination, type, status, wait }, i) => (
                  <tr key={i}>
                    <th scope="row" className="py-1 font-normal text-left truncate">
                      {destination}
                    </th>
                    <td className="py-1">{type}</td>
                    <td className="py-1">{status}</td>
                    <td className="tabular-nums">
                      <time dateTime="PT{wait}M" aria-label={`${wait} minutes`}>
                        <span>{wait}</span>
                        <abbr title="minutes">m</abbr>
                      </time>
                    </td>
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
        </div>
        <div className="space-y-2 md:space-y-6">
          <h2 className="font-semibold tracking-wide text-center text-gray-800 uppercase dark:text-gray-300">
            Message board
          </h2>

          <ul className="space-y-2 md:text-center">
            {messages.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        </div>
        <div className="py-4 text-center text-gray-500 dark:text-gray-400">
          <p>
            Last update{" "}
            <time dateTime={lastUpdatedDate.toISOString()}>
              {lastUpdatedDate.toLocaleTimeString("en-GB", { timeStyle: "long" })}
            </time>
            .
          </p>
          <div aria-live="polite">
            {refreshingAt !== null ? (
              <p>
                Automatically refreshing every{" "}
                {refreshIntervalMinutes === 0 ? (
                  <time dateTime="PT{refreshInterval}S" aria-label={`${refreshInterval} seconds`}>
                    {refreshInterval}
                    <abbr title="seconds">s</abbr>
                  </time>
                ) : (
                  <time dateTime="PT{refreshIntervalMinutes}M" aria-label={`${refreshIntervalMinutes} minutes`}>
                    {refreshIntervalMinutes}
                    <abbr title="minutes">m</abbr>
                  </time>
                )}
                .{" "}
                <button
                  className="inline-block text-indigo-600 border-b-2 border-transparent cursor-pointer dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 hover:border-indigo-500 focus:outline-none focus:ring focus:ring-indigo-200 dark:focus:ring-indigo-800 focus:ring-opacity-50"
                  onClick={() => stop()}
                >
                  Disable automatic refresh.
                </button>
              </p>
            ) : (
              <p>
                <button
                  className="inline-block text-indigo-600 border-b-2 border-transparent cursor-pointer dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 hover:border-indigo-500 focus:outline-none focus:ring focus:ring-indigo-200 dark:focus:ring-indigo-800 focus:ring-opacity-50"
                  onClick={() => {
                    setRefreshInterval(1 * 60);
                    start();
                  }}
                >
                  Enable automatic refresh (5 minutes)
                </button>
              </p>
            )}
          </div>
        </div>
      </main>
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
    props: { stop }, // will be passed to the page component as props
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
