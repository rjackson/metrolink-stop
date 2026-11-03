// i am a bad guy:
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Button, H2, Panel, Section } from "@rjackson/rjds";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useState } from "react";
import MetrolinkDestination from "../components/MetrolinkDestination";
import { getAll, getStops, StopsEntry } from "../lib/tfgm-metrolink";

type Dump = Awaited<ReturnType<typeof getAll>>;

const UniqueList = ({ title, values }: { title: string; values: (string | null | undefined)[] }) => (
  <Section>
    <Panel>
      <H2>{title}</H2>
      <ul>
        {[...new Set(values)].map((value) => (
          <li key={value ?? "(empty)"} className="whitespace-pre-line">
            {value ?? "(empty)"}
          </li>
        ))}
      </ul>
    </Panel>
  </Section>
);

export default function Debug({ dump: initialDump, allStops }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [dump, setDump] = useState(initialDump);
  const tramStops = dump.tramStops.flatMap((stop) => (stop ? [stop] : []));
  const departures = tramStops.flatMap(({ departures = [] }) => departures);
  const alerts = [
    ...(dump.lineAlerts[0]?.alerts ?? []),
    ...tramStops.flatMap(({ stopAlerts = [] }) => stopAlerts),
  ];
  const uniqueDestinations = [...new Set(departures.map(({ trip }) => trip.destinationDisplay))];

  const onRefresh = async () => {
    try {
      const req = await fetch(`/api/dump`);
      const data = await req.json();

      setDump(data as Dump);
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <>
      <UniqueList title="Unique alerts" values={alerts.map(({ effect, title }) => `[${effect}] ${title}`)} />
      <UniqueList title="Unique statuses" values={departures.map(({ timings }) => timings.status)} />
      <UniqueList title="Unique carriages" values={departures.map(({ trip }) => trip.carriages)} />
      <Section>
        <Panel>
          <H2>Unique destinations</H2>
          <ul>
            {uniqueDestinations.map((destination) => (
              <li key={destination ?? "(empty)"}>
                <MetrolinkDestination destination={destination ?? "(empty)"} allStops={allStops} />
              </li>
            ))}
          </ul>
        </Panel>
      </Section>
      <Section>
        <Panel>
          <H2>All stops</H2>
          <ul>
            {allStops.map(({ StationLocation, atcoCode, lines }) => (
              <li key={atcoCode}>
                <MetrolinkDestination destination={StationLocation} allStops={allStops} /> ({atcoCode}):{" "}
                {lines.join(", ")}
              </li>
            ))}
          </ul>
        </Panel>
      </Section>
      <Section>
        <Panel>
          <H2>Dump</H2>
          <Button onClick={onRefresh}>Refresh</Button>
          <pre>{JSON.stringify(dump, null, 2)}</pre>
        </Panel>
      </Section>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<{ dump: Dump; allStops: StopsEntry[] }> = async () => {
  const [dump, allStops] = await Promise.all([getAll(), getStops()]);

  return {
    props: { dump, allStops }, // will be passed to the page component as props
  };
};
