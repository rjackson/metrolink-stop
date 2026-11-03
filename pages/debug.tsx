import { Button, H2, Panel, Section } from "@rjackson/rjds";
import useSWR from "swr";
import MetrolinkDestination from "../components/MetrolinkDestination";
import LoadingWrapper from "../components/LoadingWrapper";
import { getAll } from "../lib/tfgm-metrolink";
import { stops as allStops } from "../lib/stops";

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

export default function Debug() {
  const { data, error, mutate, isValidating } = useSWR<Dump, unknown>("debug-dump", getAll, {
    revalidateOnFocus: false,
  });

  return (
    <LoadingWrapper isLoading={!data && !error} isError={!!error} errorMessage="Failed to load data">
      {data && <DebugDump dump={data} onRefresh={() => void mutate()} isRefreshing={isValidating} />}
    </LoadingWrapper>
  );
}

function DebugDump({ dump, onRefresh, isRefreshing }: { dump: Dump; onRefresh: () => void; isRefreshing: boolean }) {
  const tramStops = dump.tramStops.flatMap((stop) => (stop ? [stop] : []));
  const departures = tramStops.flatMap(({ departures = [] }) => departures);
  const alerts = [
    ...(dump.lineAlerts[0]?.alerts ?? []),
    ...tramStops.flatMap(({ stopAlerts = [] }) => stopAlerts),
  ];
  const uniqueDestinations = [...new Set(departures.map(({ trip }) => trip.destinationDisplay))];

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
          <Button onClick={onRefresh} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <pre>{JSON.stringify(dump, null, 2)}</pre>
        </Panel>
      </Section>
    </>
  );
}
