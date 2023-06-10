// i am a bad guy:
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Button, H2, Panel, Section } from "@rjackson/rjds";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useState } from "react";
import MetrolinkDestination from "../components/MetrolinkDestination";
import { TfgmMetrolink, getAll } from "../lib/tfgm-metrolink";

export default function Debug({ allStops }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [metrolinksDump, setMetrolinksDump] = useState(allStops);
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

  const onRefresh = async () => {
    try {
      const req = await fetch(`/api/dump`);
      const data = await req.json();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      setMetrolinksDump(data);
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <>
      <Section>
        <Panel>
          <H2>Unique messages</H2>
          <ul>
            {uniqueMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Panel>
      </Section>
      <Section>
        <Panel>
          <H2>Unique directions</H2>
          <ul>
            {uniqueDirections.map((direction) => (
              <li key={direction}>{direction}</li>
            ))}
          </ul>
        </Panel>
      </Section>
      <Section>
        <Panel>
          <H2>Unique statuses</H2>
          <ul>
            {uniqueStatuses.map((status) => (
              <li key={status}>{status}</li>
            ))}
          </ul>
        </Panel>
      </Section>
      <Section>
        <Panel>
          <H2>Unique carriages</H2>
          <ul>
            {uniqueCarriages.map((carriage) => (
              <li key={carriage}>{carriage}</li>
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
                <MetrolinkDestination destination={destination ?? '(empty)'} allStops={allStops} />
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
          <Button onClick={onRefresh}>Refresh</Button>
          <pre>{JSON.stringify(metrolinksDump, null, 2)}</pre>
        </Panel>
      </Section>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<{ allStops: TfgmMetrolink[] }> = async () => {
  const allStops = await getAll();

  return {
    props: { allStops }, // will be passed to the page component as props
  };
};
