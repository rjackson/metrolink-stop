import { Anchor } from "@rjackson/rjds";
import { Link, type LinkProps } from "react-router";

/** A design system anchor that navigates client-side */
const AppLink = (props: LinkProps) => <Anchor as={Link} {...props} />;

export default AppLink;
