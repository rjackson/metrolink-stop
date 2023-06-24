type MapLayoutProps = {
  children: React.ReactNode;
} & React.ComponentPropsWithoutRef<"div">;

const MapLayout = ({ children, ...props }: MapLayoutProps): JSX.Element => {
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
      {children}
    </div>
  );
};

export type { MapLayoutProps };
export { MapLayout };
