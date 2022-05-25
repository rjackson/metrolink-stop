import "tailwindcss/tailwind.css";
import Head from "next/head";
import { usePrefersDark } from "@rjackson/rjds";
import { VisitedStopsProvider } from "../components/context/VisitedStops";
import { useRouter } from "next/dist/client/router";
import { SWRConfig } from "swr";
import MainLayout from "../components/layouts/MainLayout";
import useFathom from "../components/hooks/useFathom";

function MyApp({ Component, pageProps }) {
  const prefersDark = usePrefersDark();
  const router = useRouter();
  const getLayout = Component.getLayout || ((page) => <MainLayout>{page}</MainLayout>);

  useFathom();

  const fetcher = async (url) => {
    const res = await fetch(url);

    if (!res.ok) {
      const error = new Error("An error occurred while fetching the data.");
      // Attach extra info to the error object.
      error.info = await res.json();
      error.status = res.status;
      throw error;
    }

    return res.json();
  };

  return (
    <SWRConfig value={{ fetcher }}>
      <VisitedStopsProvider>
        <div className={prefersDark ? "dark" : ""}>
          <Head>
            <link rel="shortcut icon" href="/icon.svg" />
            <title>{`Metrolink stops, doot doot`}</title>
            <meta name="description" content="Departure information from metrolink stops" key="description" />
          </Head>

          {getLayout(<Component {...pageProps} key={router.asPath} />)}
        </div>
      </VisitedStopsProvider>
    </SWRConfig>
  );
}

export default MyApp;
