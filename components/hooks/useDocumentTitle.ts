import { useEffect } from "react";

const DEFAULT_TITLE = "Metrolink stops, doot doot";

const useDocumentTitle = (title: string) => {
  useEffect(() => {
    document.title = title;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
};

export default useDocumentTitle;
