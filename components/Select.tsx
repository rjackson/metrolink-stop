import { inputClasses } from "@rjackson/rjds";
import type { ComponentPropsWithoutRef } from "react";

/**
 * A select styled like the design system's Input, with its own chevron. The design system's Select keeps the browser's
 * native appearance, which draws its own arrow and inner styling inside the ring, and differs between browsers.
 */
const Select = ({ className = "", ...props }: ComponentPropsWithoutRef<"select">) => (
  <span className="grid">
    <select
      className={`${inputClasses} col-start-1 row-start-1 pr-8 cursor-pointer bg-white ${className}`}
      {...props}
    />
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="currentColor"
      className="col-start-1 row-start-1 mr-2 pointer-events-none size-4 self-center justify-self-end text-gray-500 dark:text-gray-400"
    >
      <path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" />
    </svg>
  </span>
);

export default Select;
