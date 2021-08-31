import "../styles/globals.css";
import Head from "next/head";
import Link from "next/link";
import usePrefersDark from "../components/hooks/usePrefersDark";
import { VisitedStopsProvider } from "../components/context/VisitedStops";

function MyApp({ Component, pageProps }) {
  const prefersDark = usePrefersDark();
  return (
    <VisitedStopsProvider>
      <div className={prefersDark ? "dark" : ""}>
        <Head>
          <link rel="shortcut icon" href="/icon.svg" />
          <title>Metrolink stops, doot doot</title>
        </Head>

        <div className="flex flex-col items-center w-screen h-screen overflow-auto text-lg text-gray-900 bg-gray-50 dark:text-gray-50 dark:bg-gray-900">
          <Component {...pageProps} />
          <footer className="px-6 py-2 text-center">
            <p aria-hidden>💛</p>
            <p>
              <Link href="https://rjackson.dev">
                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                <a target="_blank" rel="noreferer" aria-label="RJackson.dev">
                  rjackson.dev
                </a>
              </Link>
            </p>
            <p>
              Contains{" "}
              <Link href="https://tfgm.com/">
                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                <a target="_blank" rel="noreferrer">
                  <abbr className="md:hidden" title="Transport for Greater Manchester">
                    TfGM
                  </abbr>
                  <span className="hidden md:inline">Transport for Greater Manchester</span>
                </a>
              </Link>{" "}
              data.
            </p>
          </footer>
        </div>
      </div>
    </VisitedStopsProvider>
  );
}

export default MyApp;
