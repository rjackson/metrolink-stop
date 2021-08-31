export default function Button({ className, children, ...props }) {
  return (
    <button
      className={`items-center px-2 py-1 text-base font-medium text-center text-indigo-600 dark:text-indigo-400  bg-white dark:border dark:border-gray-700 dark:bg-gray-800 border-2 border-transparent rounded-md shadow-sm focus:outline-none hover:text-indigo-700 dark:hover:text-indigo-200 hover:border-indigo-500 focus:ring focus:ring-indigo-200 dark:focus:ring-indigo-800 focus:ring-opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
