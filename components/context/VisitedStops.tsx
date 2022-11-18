import { useLocalStorage, useSet } from "react-use";
import { createContext, useContext, useCallback, useEffect, PropsWithChildren } from "react";

type VisitedStopsStateContextType = {
  recentStops: string[];
};

type VisitedStopsUpdateContextType = {
  track: (stopName: string) => void;
  reset: () => void;
};

const VisitedStopsStateContext = createContext<VisitedStopsStateContextType | null>(null);
const VisitedStopsUpdateContext = createContext<VisitedStopsUpdateContextType | null>(null);

export function VisitedStopsProvider({ capacity = 10, children }: PropsWithChildren<{ capacity: number }>) {
  const [storedSet, setStoredSet] = useLocalStorage<string[]>("visited-stops", []);
  const [set, { add, has, remove, reset }] = useSet<string>(new Set([]));

  // Load persisted stops on mount
  useEffect(() => {
    if (storedSet instanceof Set) {
      storedSet.forEach((v) => add(v));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist any changes to the set
  useEffect(() => {
    setStoredSet([...set]);
  }, [set, setStoredSet]);

  // Yea, not actually clearing extra ones from the set. It'll never be big enough to be a memory concern.
  const recentStops = Array.from(set).reverse().slice(0, capacity);

  const track = useCallback(
    (stopName: string) => {
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

  if (state === null) {
    throw new Error(`useVisitedStopsState must be used within a VisitedStopsProvider`);
  }

  return state;
}

export function useVisitedStopsUpdate() {
  const updateFns = useContext(VisitedStopsUpdateContext);

  if (updateFns === null) {
    throw new Error(`useVisitedStopsUpdate must be used within a VisitedStopsProvider`);
  }

  return updateFns;
}
