import { CATEGORIES, getCategoryColor } from "../utils/categories";

// Sidebar navigation for category filtering.
// "activeCategory" is the currently selected filter ("All" or a category name).
// Clicking a category calls onSelect(category) to update the filter in Dashboard.
export default function Sidebar({ credentials, activeCategory, onSelect }) {
  // Count credentials per category for the badge numbers
  const counts = credentials.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1;
    return acc;
  }, {});

  // Collect any custom categories not in the default list
  const allCategories = [
    ...CATEGORIES,
    ...Object.keys(counts).filter((c) => !CATEGORIES.includes(c)),
  ];

  return (
    <aside className="w-56 flex-shrink-0">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-3 sticky top-24 transition-colors">
        <p className="text-gray-400 dark:text-gray-500 text-xs font-medium uppercase tracking-wider px-2 mb-2">
          Categories
        </p>
        <SidebarItem label="All Credentials" count={credentials.length}
          active={activeCategory === "All"} onClick={() => onSelect("All")}
          color={{ bg: "bg-indigo-50 dark:bg-indigo-900/40", text: "text-indigo-600 dark:text-indigo-400", dot: "bg-indigo-500" }} />
        <div className="border-t border-gray-200 dark:border-gray-800 my-2" />
        {allCategories.map((cat) => {
          const color = getCategoryColor(cat);
          return (
            <SidebarItem key={cat} label={cat} count={counts[cat] || 0}
              active={activeCategory === cat} onClick={() => onSelect(cat)} color={color} />
          );
        })}
      </div>
    </aside>
  );
}

function SidebarItem({ label, count, active, onClick, color }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all duration-150 mb-0.5
        ${active
          ? `${color.bg} ${color.text} font-medium`
          : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
        }`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? color.dot : "bg-gray-300 dark:bg-gray-700"}`} />
        <span className="truncate">{label}</span>
      </div>
      {count > 0 && (
        <span className={`text-xs px-1.5 py-0.5 rounded-md ${active ? "bg-white/20 dark:bg-white/10" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
          {count}
        </span>
      )}
    </button>
  );
}
