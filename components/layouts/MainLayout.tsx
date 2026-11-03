import AppLink from "../AppLink";
import { SingleColumnLayout, Header, Anchor, Section } from "@rjackson/rjds";
import { PropsWithChildren } from "react";

const MainLayout = ({ children }: PropsWithChildren) => {
  return (
    <SingleColumnLayout
      header={
        <Header className="items-center">
          <AppLink to="/">
              <h1 className="text-2xl font-semibold text-center">{`metrolink stops`}</h1>
            </AppLink>
        </Header>
      }
      footer={
        <Section as="footer" className="text-center">
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
        </Section>
      }
    >
      {children}
    </SingleColumnLayout>
  );
};

export default MainLayout;
