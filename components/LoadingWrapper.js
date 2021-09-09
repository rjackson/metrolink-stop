import { BarLoader } from "react-spinners";
import colors from "tailwindcss/colors";

const DefaultLoadingContent = () => (
  <div className="flex justify-center">
    <BarLoader color={colors.gray[500]} loading={true} size={150} css={{ display: "block" }} />
  </div>
);

const DefaultErrorContent = ({ errorMessage }) => <p className="italic text-center text-gray-700">{errorMessage}</p>;

/**
 * Show a spinner for any content whilst it loads, but do it properly accessibly and all that
 *
 * (I can't figure out how to typehint this properly. VS Code doesn't seem to pick up the "Documenting a destructuring
 * parameter" syntax.)
 */
const LoadingWrapper = ({
  isLoading,
  isError,
  errorMessage = "Could not load content",
  className = "",
  children,
  errorContent = <DefaultErrorContent errorMessage={errorMessage} />,
  loadingContent = <DefaultLoadingContent />,
  ...props
}) => (
  <div aria-live="polite" aria-busy={isLoading} aria-atomic={true} {...props}>
    {isError && errorContent}
    {isLoading && loadingContent}
    {!isLoading && !isError && children}
  </div>
);

export default LoadingWrapper;
