import { useSet } from "react-use";

const { createContext, useContext, useState, useCallback, useEffect } = require("react");

const VisitedStopsStateContext = createContext();
const VisitedStopsUpdateContext = createContext();

export function VisitedStopsProvider({ capacity = 10, children }) {
  const [set, { add, has, remove, toggle, reset }] = useSet(new Set());

  // Yea, not actually clearing extra ones from the set. It'll never be big enough to be a memory concern.
  const recentStops = Array.from(set).reverse().slice(0, capacity);

  const track = useCallback(
    (stopName) => {
      // Re-insert, so insertion order matches visited order
      if (has(stopName)) {
        remove(stopName);
      }

      add(stopName);
    },
    [has, add, remove]
  );

  const state = { recentStops };

  const updateFns = {
    track,
    reset,
  };

  return (
    <VisitedStopsStateContext.Provider value={state}>
      <VisitedStopsUpdateContext.Provider value={updateFns}>{children}</VisitedStopsUpdateContext.Provider>
    </VisitedStopsStateContext.Provider>
  );
}

export function useVisitedStopsState() {
  const state = useContext(VisitedStopsStateContext);

  if (state === undefined) {
    throw new Error(`useVisitedStopsState must be used within a VisitedStopsProvider`);
  }

  return state;
}

export function useVisitedStopsUpdate() {
  const updateFns = useContext(VisitedStopsUpdateContext);

  if (updateFns === undefined) {
    throw new Error(`useVisitedStopsUpdate must be used within a VisitedStopsProvider`);
  }

  return updateFns;
}
