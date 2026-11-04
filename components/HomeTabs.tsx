import { NavLink } from "react-router";

const tabs = [
  { to: "/", label: "Stops" },
  { to: "/map", label: "Map" },
];

/** Switches between the stop list and the map, both of which act as the home page */
const HomeTabs = ({ className }: { className?: string }) => (
  <nav aria-label="Home" className={className}>
    <ul className="flex justify-center gap-1 rounded-lg bg-gray-200 p-1 dark:bg-gray-800">
      {tabs.map(({ to, label }) => (
        <li key={to} className="flex-1">
          <NavLink
            to={to}
            end
            className={({ isActive }) =>
              `block rounded-md px-4 py-1 text-center font-semibold transition-colors ${
                isActive
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-50"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-50"
              }`
            }
          >
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);

export default HomeTabs;
