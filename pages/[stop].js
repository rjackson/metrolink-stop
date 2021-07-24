import { useRouter } from "next/dist/client/router";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Stop() {
  const router = useRouter();
  const { stop } = router.query;
  const [stopInfo, setStopInfo] = useState();
  const [error, setError] = useState();
  const [refreshTrigger, setRefreshTrigger] = useState(false);

  const { name, departures = [], messages = [], lastUpdated = "1970-01-01" } = stopInfo ?? {};
  const lastUpdatedDate = new Date(lastUpdated);

  //#region Continually refreshing stop data
  useEffect(async () => {
    let mounted = true;
    if (!stop) {
      return;
    }
    try {
      const req = await fetch(`/api/stop/${stop}`);
      const data = await req.json();

      if (mounted) {
        if (req.status == 200) {
          setStopInfo(data);
          setError(null);
        } else {
          setStopInfo(null);
          setError(data?.error);
        }
      }
    } catch (err) {
      console.log(err);
    }

    return () => {
      mounted = false;
    };
  }, [stop, refreshTrigger]);

  // Refresh every 30s
  useEffect(() => {
    const timeout = setTimeout(() => setRefreshTrigger(!refreshTrigger), 30 * 1000);

    return () => {
      clearTimeout(timeout);
    };
  }, [refreshTrigger]);
  //#endregion

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
      <main className="flex-1 overflow-y-scroll px-6 py-4 flex flex-col space-y-8 md:space-y-16 max-w-screen-md w-full">
        <div>
          <h1 className="text-2xl text-center uppercase tracking-wide font-semibold">{name}</h1>
        </div>
        <div className="space-y-2 md:space-y-6">
          <h2 className="text-center uppercase tracking-wide font-semibold text-gray-800">Departures</h2>
          <table className="w-full table-auto">
            <thead className="text-left">
              <tr>
                <th className="py-2 font-normal text-gray-600">Destination</th>
                <th className="py-2 font-normal text-gray-600">Type</th>
                <th className="py-2 font-normal text-gray-600">Status</th>
                <th className="py-2 font-normal text-gray-600">Wait</th>
              </tr>
            </thead>
            <tbody>
              {departures.map(({ destination, type, status, wait }, i) => (
                <tr key={i}>
                  <td className="py-1">{destination}</td>
                  <td className="py-1">{type}</td>
                  <td className="py-1">{status}</td>
                  <td>
                    <span>{wait}</span>
                    <abbr title="minutes">m</abbr>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot></tfoot>
          </table>
        </div>
        <div className="space-y-2 md:space-y-6">
          <h2 className="text-center uppercase tracking-wide font-semibold text-gray-800">Message board</h2>

          <ul className="md:text-center">
            {messages.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        </div>
        <div className="text-center text-gray-500 py-4">
          <p>Automatically updating every 30 seconds.</p>
          <p>
            Last update <time dateTime={lastUpdatedDate.toISOString()}>{lastUpdatedDate.toLocaleString()}</time>.
          </p>
        </div>
      </main>
    </>
  );
}
