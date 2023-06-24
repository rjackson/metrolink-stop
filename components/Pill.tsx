const Pill = ({ children, ...props }: React.ComponentPropsWithoutRef<"span">): JSX.Element => (
  <span
    className={`
      px-2
      py-1
      rounded-full
      text-sm
      font-semibold
      
      bg-indigo-100
      text-indigo-900
  
      dark:bg-fuchsia-100
      dark:text-fuchsia-900
      `}
    {...props}
  >
    {children}
  </span>
);

export default Pill;
