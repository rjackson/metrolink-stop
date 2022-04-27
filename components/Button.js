export default function Button({ className, children, ...props }) {
  return (
    <button
      className={`
        items-center
        px-2
        py-1
        text-base
        font-medium
        text-center
        
        bg-white
        dark:border
        dark:border-gray-700
        dark:bg-gray-800
        border-2
        border-transparent
        rounded-md
        shadow

        text-indigo-600
        hover:bg-indigo-100

        focus:outline-none
        focus:bg-indigo-100
        focus:ring
        focus:ring-indigo-500
        
        dark:text-fuchsia-400
        dark:hover:text-fuchsia-300
        dark:hover:bg-fuchsia-800
        dark:focus:text-fuchsia-300
        dark:focus:bg-fuchsia-800
        dark:focus:ring-fuchsia-400

        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
