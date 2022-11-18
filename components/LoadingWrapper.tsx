import { PropsWithChildren } from "react";
import { BarLoader } from "react-spinners";
import colors from "tailwindcss/colors";

const DefaultLoadingContent = () => (
  <div className="flex justify-center">
    <BarLoader color={colors.gray[500]} loading={true} />
  </div>
);

const DefaultErrorContent = ({ errorMessage }: { errorMessage: string }) => (
  <p className="italic text-center text-gray-700">{errorMessage}</p>
);

type Props = {
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  errorContent: JSX.Element;
  loadingContent: JSX.Element;
} & PropsWithChildren;

/**
 * Show a spinner for any content whilst it loads, but do it properly accessibly and all that
 */
const LoadingWrapper = ({
  isLoading,
  isError,
  errorMessage = "Could not load content",
  children,
  errorContent = <DefaultErrorContent errorMessage={errorMessage} />,
  loadingContent = <DefaultLoadingContent />,
  ...props
}: Props) => (
  <div aria-live="polite" aria-busy={isLoading} aria-atomic={true} {...props}>
    {isError && errorContent}
    {isLoading && loadingContent}
    {!isLoading && !isError && children}
  </div>
);

export default LoadingWrapper;
