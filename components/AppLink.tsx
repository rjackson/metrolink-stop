import { anchorClasses } from "@rjackson/rjds";
import { Link, type LinkProps } from "react-router";

/** A link styled like the design system's Anchor, that navigates client-side */
const AppLink = ({ className, ...props }: LinkProps) => (
  <Link className={`${anchorClasses} ${className ?? ""}`} {...props} />
);

export default AppLink;
