import { useState } from "react";
import { CATEGORIES, getCategoryColor } from "../utils/categories";

// ── Sidebar item ──────────────────────────────────────────────────────────────

function SidebarItem({ label, count, active, onClick, color, isCustom, onRename, onDelete }) {
  const [hovering, setHovering]     = useState(false);
  const [renaming, setRenaming]     = useState(false);
  const [renameVal, setRenameVal]   = useState(label);
  const [confirmDel, setConfirmDel] = useState(false);

  function submitRename(e) {
    e.preventDefault();
    const trimmed = renameVal.trim();
    if (!trimmed || trimmed === label) { setRenaming(false); return; }
    onRename?.(label, trimmed);
    setRenaming(false);
  }

  // Inline rename input
  if (renaming) {
    return (
      <form onSubmit={submitRename}
        className="flex items-center gap-1 px-2 py-1.5 mb-0.5">
        <input
          autoFocus
          value={renameVal}
          onChange={(e) => setRenameVal(e.target.value)}
          onBlur={submitRename}
          onKeyDown={(e) => e.key === "Escape" && setRenaming(false)}
          className="flex-1 min-w-0 bg-gray-100 dark:bg-gray-800 border border-indigo-400 rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-white outline-none"
        />
        <button type="submit"
          className="text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 text-xs px-1 flex-shrink-0">
          ✓
        </button>
        <button type="button" onClick={() => setRenaming(false)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs px-1 flex-shrink-0">
          ✕
        </button>
      </form>
    );
  }

  // Confirm delete inline
  if (confirmDel) {
    return (
      <div className="px-2 py-2 mb-0.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl">
        <p className="text-xs text-red-600 dark:text-red-400 mb-2 font-medium">
          Delete "{label}"? Credentials move to Others.
        </p>
        <div className="flex gap-1.5">
          <button onClick={() => { onDelete?.(label); setConfirmDel(false); }}
            className="flex-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg py-1 transition-colors">
            Delete
          </button>
          <button onClick={() => setConfirmDel(false)}
            className="flex-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg py-1 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mb-0.5"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}>
      <button onClick={onClick}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all duration-150
          ${active
            ? `${color.bg} ${color.text} font-medium`
            : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
          }
          ${isCustom && hovering ? "pr-16" : ""}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? color.dot : "bg-gray-300 dark:bg-gray-700"}`} />
          <span className="truncate">{label}</span>
        </div>
        {count > 0 && (
          <span className={`text-xs px-1.5 py-0.5 rounded-md flex-shrink-0 ${active ? "bg-white/20 dark:bg-white/10" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
            {count}
          </span>
        )}
      </button>

      {/* Edit / delete actions — only for custom categories, shown on hover */}
      {isCustom && hovering && !renaming && !confirmDel && (
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); setRenameVal(label); setRenaming(true); }}
            className="p-1 rounded-md text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
            title="Rename category"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDel(true); }}
            className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            title="Delete category"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main sidebar ──────────────────────────────────────────────────────────────

export default function Sidebar({
  credentials, activeCategory, onSelect,
  onRenameCategory, onDeleteCategory,
}) {
  const counts = credentials.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1;
    return acc;
  }, {});

  // Built-in categories first, then any custom ones found in credentials
  const customCategories = Object.keys(counts).filter((c) => !CATEGORIES.includes(c));
  const allCategories    = [...CATEGORIES, ...customCategories];

  return (
    <aside className="w-56 flex-shrink-0">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-3 sticky top-24 transition-colors">
        <p className="text-gray-400 dark:text-gray-500 text-xs font-medium uppercase tracking-wider px-2 mb-2">
          Categories
        </p>

        {/* All credentials */}
        <SidebarItem
          label="All Credentials" count={credentials.length}
          active={activeCategory === "All"} onClick={() => onSelect("All")}
          color={{ bg: "bg-indigo-50 dark:bg-indigo-900/40", text: "text-indigo-600 dark:text-indigo-400", dot: "bg-indigo-500" }}
          isCustom={false}
        />

        <div className="border-t border-gray-200 dark:border-gray-800 my-2" />

        {/* Built-in categories — no manage actions */}
        {CATEGORIES.map((cat) => {
          const color = getCategoryColor(cat);
          return (
            <SidebarItem key={cat} label={cat} count={counts[cat] || 0}
              active={activeCategory === cat} onClick={() => onSelect(cat)}
              color={color} isCustom={false} />
          );
        })}

        {/* Custom categories — show rename/delete on hover */}
        {customCategories.length > 0 && (
          <>
            <div className="border-t border-gray-200 dark:border-gray-800 my-2" />
            <p className="text-gray-400 dark:text-gray-600 text-xs px-2 mb-1.5 flex items-center gap-1">
              <span>Custom</span>
              <span className="text-gray-300 dark:text-gray-700 text-xs">— hover to manage</span>
            </p>
            {customCategories.map((cat) => {
              const color = getCategoryColor(cat);
              return (
                <SidebarItem key={cat} label={cat} count={counts[cat] || 0}
                  active={activeCategory === cat} onClick={() => onSelect(cat)}
                  color={color} isCustom={true}
                  onRename={onRenameCategory}
                  onDelete={onDeleteCategory}
                />
              );
            })}
          </>
        )}
      </div>
    </aside>
  );
}