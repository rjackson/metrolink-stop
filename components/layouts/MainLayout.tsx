import { SingleColumnLayout, Header, Anchor, Section } from "@rjackson/rjds";
import Link from "next/link";
import { PropsWithChildren } from "react";

const MainLayout = ({ children }: PropsWithChildren) => {
  return (
    <SingleColumnLayout
      header={
        <Header className="items-center">
          <Link href="/" passHref>
            <Anchor>
              <h1 className="text-2xl font-semibold text-center">{`metrolink stops`}</h1>
            </Anchor>
          </Link>
        </Header>
      }
      footer={
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
      }
    >
      {children}
    </SingleColumnLayout>
  );
};

export default MainLayout;
