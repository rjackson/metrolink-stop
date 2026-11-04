import AppLink from "./AppLink";
import type { Line } from "../lib/lines";
import type { StopsEntry } from "../lib/stops";
import slugify from "../utils/slugify";

type Props = {
  line: Line;
  /** The stops to show, in line order. Defaults to all of them; fewer when filtered by a search */
  stops?: StopsEntry[];
  /** The stop being viewed, if any, which is marked on the route rather than linked */
  currentAtcoCode?: string;
  className?: string;
};

/**
 * A line's stops in order, drawn as a route: a line in the line's colour, with a dot per stop, each linking to its stop
 * page
 */
export default function LineRoute({ line, stops = line.stops, currentAtcoCode, className = "" }: Props) {
  return (
    <ol className={className}>
      {stops.map(({ StationLocation, atcoCode }, i) => {
        const isCurrent = atcoCode === currentAtcoCode;
        return (
          <li key={atcoCode} className="relative py-1 pl-7">
            {/* The line, joining this stop's dot to its neighbours' */}
            <span
              aria-hidden
              className={`absolute left-[5px] w-1 ${i === 0 ? "top-1/2" : "top-0"} ${i === stops.length - 1 ? "bottom-1/2" : "bottom-0"} ${
                // Outlined on the sides only, so the segments join up seamlessly
                line.outlineOnDark ? "dark:shadow-[-1px_0_0_white,1px_0_0_white]" : ""
              }`}
              style={{ backgroundColor: line.colour }}
            />
            <span
              aria-hidden
              className={`absolute top-1/2 -translate-y-1/2 rounded-full border-[3px] ${
                isCurrent ? "-left-0.5 w-[18px] h-[18px]" : "left-0 w-3.5 h-3.5 bg-white dark:bg-gray-800"
              } ${line.outlineOnDark ? "dark:ring-1 dark:ring-white" : ""}`}
              style={{ borderColor: line.colour, ...(isCurrent ? { backgroundColor: line.colour } : {}) }}
            />
            {isCurrent ? (
              <span aria-current="page" className="font-semibold">
                {StationLocation}
              </span>
            ) : (
              <AppLink to={`/${slugify(StationLocation)}`}>{StationLocation}</AppLink>
            )}
          </li>
        );
      })}
    </ol>
  );
}
