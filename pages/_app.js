import "../styles/globals.css";
import Head from "next/head";
import Link from "next/link";

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link rel="shortcut icon" href="/icon.svg" />
        <title>Metrolink stops, doot doot</title>
      </Head>

      <div className="h-screen w-screen flex flex-col text-lg items-center">
        <Component {...pageProps} />
        <footer className="px-6 py-2 text-center">
          <p>💛</p>
          <p>
            <Link href="">
              <a target="_blank" rel="noreferer">
                rjackson.dev
              </a>
            </Link>{" "}
          </p>
          <p>
            Contains{" "}
            <Link href="https://tfgm.com/">
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
    </>
  );
}

export default MyApp;
