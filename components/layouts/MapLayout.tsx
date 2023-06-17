import { Header as RjdsHeader, Anchor, Section, Button } from "@rjackson/rjds";
import Link from "next/link";
import { useReducer } from "react";

type MapLayoutProps = {
  children: React.ReactNode;
} & React.ComponentPropsWithoutRef<"div">;

const Header = () => (
  <RjdsHeader className="items-center">
    <Link href="/" passHref>
      <Anchor>
        <h1 className="text-2xl font-semibold text-center">{`metrolink stops`}</h1>
      </Anchor>
    </Link>
  </RjdsHeader>
);

const Footer = () => (
  <Section as="footer" className="text-center">
    <p aria-hidden>💛</p>

    <p>
      <Link href="https://rjackson.dev" passHref>
        <Anchor aria-label="RJackson.dev">rjackson.dev</Anchor>
      </Link>
    </p>

    <p>
      Contains{" "}
      <Link href="https://tfgm.com/" passHref>
        <Anchor target="_blank" rel="noreferrer">
          <abbr className="md:hidden" title="Transport for Greater Manchester">
            TfGM
          </abbr>
          <span className="hidden md:inline">Transport for Greater Manchester</span>
        </Anchor>
      </Link>{" "}
      data.
    </p>
  </Section>
);

const MapLayout = ({ children, ...props }: MapLayoutProps): JSX.Element => {
  const [focusMap, toggleFocusMap] = useReducer((value) => !value, false);

  return (
    <div
      className={`
        flex
        flex-col-reverse
        w-screen
        h-screen
        text-lg

        lg:flex-row

        text-gray-900
        bg-gray-50

        dark:text-gray-50
        dark:bg-gray-900
    `}
      {...props}
    >
      <div className={`flex flex-col lg:h-full lg:w-full lg:max-w-lg ${focusMap ? "h-1/3" : "h-2/3"}`}>
        <div className="flex items-center justify-between px-6">
          <Header />
          <Button
            className="lg:hidden"
            onClick={() => toggleFocusMap()}
            aria-label={focusMap ? "Reduce size of map" : "Increase size of map"}
          >
            {focusMap ? "+" : "-"}
          </Button>
        </div>
        <div className="flex flex-col space-y-4 overflow-y-scroll">
          <p>hello world?</p>
        </div>
        <Footer />
      </div>
      <section className="flex-1 flex-shrink-0 lg:h-full lg:w-full">{children}</section>
    </div>
  );
};

export type { MapLayoutProps };
export { MapLayout };
