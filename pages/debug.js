import { useEffect, useState } from "react";
import MetrolinkDestination from "../components/MetrolinkDestination";
import { getStops } from "../lib/tfgm-metrolink";

export default function Debug({ allStops }) {
  const [metrolinksDump, setMetrolinksDump] = useState([]);
  const uniqueMessages = [...new Set(metrolinksDump.map(({ MessageBoard }) => MessageBoard))];
  const uniqueDestinations = [
    ...new Set(metrolinksDump.flatMap(({ Dest0, Dest1, Dest2, Dest3 }) => [Dest0, Dest1, Dest2, Dest3])),
  ];
  const uniqueStatuses = [
    ...new Set(
      metrolinksDump.flatMap(({ Status0, Status1, Status2, Status3 }) => [Status0, Status1, Status2, Status3])
    ),
  ];
  const uniqueCarriages = [
    ...new Set(
      metrolinksDump.flatMap(({ Carriages0, Carriages1, Carriages2, Carriages3 }) => [
        Carriages0,
        Carriages1,
        Carriages2,
        Carriages3,
      ])
    ),
  ];

  const allStopNames = [...new Set(metrolinksDump.map(({ StationLocation }) => StationLocation))];

  const fetchDump = async () => {
    try {
      const req = await fetch(`/api/dump`);
      const data = await req.json();

      return req.status == 200 ? data : null;
    } catch (err) {
      console.log(err);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    fetchDump().then((dump) => {
      if (mounted) {
        setMetrolinksDump(dump);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);
  return (
    <main className="flex flex-col flex-1 w-full max-w-screen-md px-6 py-4 space-y-4">
      <h1 className="text-2xl font-semibold tracking-wide text-center uppercase">Debug</h1>
      <div>
        <h2 className="text-xl font-semibold tracking-wide text-center uppercase">Unique messages</h2>
        <ul>
          {uniqueMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-wide text-center uppercase">Unique statuses</h2>
        <ul>
          {uniqueStatuses.map((status) => (
            <li key={status}>{status}</li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-wide text-center uppercase">Unique carriages</h2>
        <ul>
          {uniqueCarriages.map((carriage) => (
            <li key={carriage}>{carriage}</li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-wide text-center uppercase">Unique destinations</h2>
        <ul>
          {uniqueDestinations.map((destination) => (
            <li key={destination}>
              <MetrolinkDestination destination={destination} allStops={allStops} />
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-wide text-center uppercase">All stops</h2>
        <ul>
          {allStopNames.map((destination) => (
            <li key={destination}>
              <MetrolinkDestination destination={destination} allStops={allStops} />
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-wide text-center uppercase">Dump</h2>
        <button
          onClick={async (e) => {
            setMetrolinksDump(await fetchDump());
          }}
        >
          Refresh
        </button>
        <pre>{JSON.stringify(metrolinksDump, 0, 2)}</pre>
      </div>
    </main>
  );
}

export async function getStaticProps() {
  const allStops = await getStops();

  return {
    props: { allStops }, // will be passed to the page component as props
  };
}
