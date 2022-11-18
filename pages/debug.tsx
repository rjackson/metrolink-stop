import { H2, Panel, Section } from "@rjackson/rjds";
import { GetStaticProps } from "next";
import { useEffect, useState } from "react";
import MetrolinkDestination from "../components/MetrolinkDestination";
import { getStops, StopsEntry } from "../lib/tfgm-metrolink";

type Props = {
  allStops: StopsEntry[];
};
export default function Debug({ allStops }: Props) {
  const [metrolinksDump, setMetrolinksDump] = useState([]);
  const uniqueMessages = [...new Set(metrolinksDump.map(({ MessageBoard }) => MessageBoard))];
  const uniqueDirections = [...new Set(metrolinksDump.map(({ Direction }) => Direction))];
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
    <>
      <Section>
        <Panel>
          <H2>Unique messages</H2>
          <ul>
            {uniqueMessages.map((message) => (
              <li key={message}>{message || "(empty)"}</li>
            ))}
          </ul>
        </Panel>
      </Section>
      <Section>
        <Panel>
          <H2>Unique directions</H2>
          <ul>
            {uniqueDirections.map((direction) => (
              <li key={direction}>{direction || "(empty)"}</li>
            ))}
          </ul>
        </Panel>
      </Section>
      <Section>
        <Panel>
          <H2>Unique statuses</H2>
          <ul>
            {uniqueStatuses.map((status) => (
              <li key={status}>{status || "(empty)"}</li>
            ))}
          </ul>
        </Panel>
      </Section>
      <Section>
        <Panel>
          <H2>Unique carriages</H2>
          <ul>
            {uniqueCarriages.map((carriage) => (
              <li key={carriage}>{carriage || "(empty)"}</li>
            ))}
          </ul>
        </Panel>
      </Section>
      <Section>
        <Panel>
          <H2>Unique destinations</H2>
          <ul>
            {uniqueDestinations.map((destination) => (
              <li key={destination}>
                <MetrolinkDestination destination={destination} allStops={allStops} />
              </li>
            ))}
          </ul>
        </Panel>
      </Section>
      <Section>
        <Panel>
          <H2>All stops</H2>
          <ul>
            {allStopNames.map((destination) => (
              <li key={destination}>
                <MetrolinkDestination destination={destination} allStops={allStops} />
              </li>
            ))}
          </ul>
        </Panel>
      </Section>
      <Section>
        <Panel>
          <H2>Dump</H2>
          <button
            onClick={async () => {
              setMetrolinksDump(await fetchDump());
            }}
          >
            Refresh
          </button>
          <pre>{JSON.stringify(metrolinksDump, null, 2)}</pre>
        </Panel>
      </Section>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const allStops = await getStops();

  return {
    props: { allStops }, // will be passed to the page component as props
  };
};
