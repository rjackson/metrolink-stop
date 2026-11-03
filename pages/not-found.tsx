import { H2 } from "@rjackson/rjds";
import AppLink from "../components/AppLink";
import useDocumentTitle from "../components/hooks/useDocumentTitle";

export default function NotFound() {
  useDocumentTitle("Page not found");

  return (
    <div className="space-y-4 text-center">
      <H2>Page not found</H2>
      <p>
        <AppLink to="/">Back to list of stops</AppLink>
      </p>
    </div>
  );
}
