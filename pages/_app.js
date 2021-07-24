import "tailwindcss/tailwind.css";
import Head from "next/head";

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link rel="shortcut icon" href="/icon.svg" />
        <title>Metrolink stop, doot doot</title>
      </Head>
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;
