import AppLink from "../AppLink";
import { SingleColumnLayout, Header, Anchor } from "@rjackson/rjds";
import { PropsWithChildren } from "react";

const MainLayout = ({ children }: PropsWithChildren) => {
  return (
    <SingleColumnLayout
      // The layout scrolls itself, rather than the page. Without a positioned ancestor, absolutely positioned content
      // (e.g. sr-only headings) is placed against the page instead, making it taller than the window, so it scrolls on
      // past the footer into blank space
      className="relative"
      header={
        <Header className="items-center">
          <AppLink to="/">
              <h1 className="text-2xl font-semibold text-center">{`metrolink stops`}</h1>
            </AppLink>
        </Header>
      }
      footer={
        <footer className="w-full px-6 py-2 text-center">
          <p aria-hidden>💛</p>

          <p>
            <Anchor href="https://rjackson.dev" aria-label="RJackson.dev">rjackson.dev</Anchor>
          </p>

          <p>
            Contains{" "}
            <Anchor href="https://tfgm.com/" target="_blank" rel="noreferrer">
                <abbr className="md:hidden" title="Transport for Greater Manchester">
                  TfGM
                </abbr>
                <span className="hidden md:inline">Transport for Greater Manchester</span>
              </Anchor>{" "}
            data.
          </p>
        </footer>
      }
    >
      {children}
    </SingleColumnLayout>
  );
};

export default MainLayout;
