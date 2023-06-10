import "tailwindcss/tailwind.css";
import Head from "next/head";
import { usePrefersDark } from "@rjackson/rjds";
import { VisitedStopsProvider } from "../components/context/VisitedStops";
import { useRouter } from "next/dist/client/router";
import MainLayout from "../components/layouts/MainLayout";
import useFathom from "../components/hooks/useFathom";
import { AppProps } from "next/app";
import { ReactElement, ReactNode } from "react";
import { NextPage } from "next";

export type NextPageWithLayout<P = unknown, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

function MyApp({ Component, pageProps }: AppPropsWithLayout) {
  const prefersDark = usePrefersDark();
  const router = useRouter();
  const getLayout = Component.getLayout ?? ((page) => <MainLayout>{page}</MainLayout>);

  useFathom();

  return (
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
  );
}

export default MyApp;
