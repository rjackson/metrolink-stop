import type { Line } from "../lib/lines";

/**
 * A dot in the line's colour. Decorative: lines are named by their service (e.g. "Altrincham – Bury"), which is how
 * people know them, with the colour name given as text where it matters
 */
const LineSwatch = ({ line }: { line: Line }) => (
  <span
    aria-hidden
    className={`inline-block w-3 h-3 rounded-full shrink-0 ring-1 ring-black/10 ${
      line.outlineOnDark ? "dark:ring-white" : "dark:ring-white/20"
    }`}
    style={{ backgroundColor: line.colour }}
  />
);

export default LineSwatch;
