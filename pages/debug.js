import { useEffect, useState } from "react";

export default function Debug() {
  const [metrolinksDump, setMetrolinksDump] = useState([]);
  const uniqueMessages = [...new Set(metrolinksDump.map(({ MessageBoard }) => MessageBoard))];
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

  useEffect(async () => {
    let mounted = true;

    const dump = await fetchDump();
    if (mounted) {
      setMetrolinksDump(dump);
    }

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
            <li>{message}</li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-wide text-center uppercase">Unique statuses</h2>
        <ul>
          {uniqueStatuses.map((status) => (
            <li>{status}</li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-wide text-center uppercase">Unique carriages</h2>
        <ul>
          {uniqueCarriages.map((carriage) => (
            <li>{carriage}</li>
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
