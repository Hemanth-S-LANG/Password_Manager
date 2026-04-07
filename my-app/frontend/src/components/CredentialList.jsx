import { useState } from "react";
import CredentialCard from "./CredentialCard";
import { CATEGORIES, getCategoryColor } from "../utils/categories";

function groupByCategory(credentials) {
  return credentials.reduce((groups, cred) => {
    const cat = cred.category || "Others";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(cred);
    return groups;
  }, {});
}

// ── Bulk action toolbar ───────────────────────────────────────────────────────

function BulkToolbar({ selectedIds, allIds, onSelectAll, onDeselectAll, onBulkDelete, onBulkMove, onCancel }) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const allSelected = selectedIds.size === allIds.length && allIds.length > 0;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl px-4 py-3 mb-6">
      {/* Select all checkbox */}
      <button
        onClick={allSelected ? onDeselectAll : onSelectAll}
        className="flex items-center gap-2 flex-shrink-0"
        title={allSelected ? "Deselect all" : "Select all"}
      >
        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
          ${allSelected
            ? "bg-indigo-600 border-indigo-600"
            : someSelected
              ? "bg-indigo-200 dark:bg-indigo-800 border-indigo-400"
              : "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
          }`}>
          {allSelected && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {someSelected && !allSelected && (
            <div className="w-2 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded" />
          )}
        </div>
      </button>

      {/* Count label */}
      <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300 flex-1">
        {selectedIds.size === 0
          ? "Select credentials to act on them"
          : `${selectedIds.size} selected`}
      </span>

      {/* Action buttons — only show when something is selected */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2">
          {/* Move to category */}
          <div className="relative">
            <button
              onClick={() => setShowMoveMenu((p) => !p)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 7h.01M7 3h5l2 2h7a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h2z" />
              </svg>
              Move to
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showMoveMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl overflow-hidden w-44">
                {CATEGORIES.map((cat) => {
                  const color = getCategoryColor(cat);
                  return (
                    <button key={cat}
                      onClick={() => { onBulkMove(cat); setShowMoveMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />
                      {cat}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bulk delete */}
          <button
            onClick={onBulkDelete}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete {selectedIds.size}
          </button>
        </div>
      )}

      {/* Cancel bulk mode */}
      <button
        onClick={onCancel}
        className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
        title="Exit bulk mode"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CredentialList({
  credentials, search, activeCategory,
  onDelete, onEdit, onBulkDelete, onBulkMove,
  reusedPasswords = new Set(), onAdd, onHistory,
}) {
  const [bulkMode, setBulkMode]       = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Filter by search
  const searchFiltered = credentials.filter(
    (c) =>
      c.website.toLowerCase().includes(search.toLowerCase()) ||
      c.username.toLowerCase().includes(search.toLowerCase())
  );

  // Filter by category
  const filtered =
    activeCategory === "All"
      ? searchFiltered
      : searchFiltered.filter((c) => c.category === activeCategory);

  const allFilteredIds = filtered.map((c) => c._id);

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll()   { setSelectedIds(new Set(allFilteredIds)); }
  function deselectAll() { setSelectedIds(new Set()); }

  function exitBulkMode() {
    setBulkMode(false);
    setSelectedIds(new Set());
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    onBulkDelete([...selectedIds], exitBulkMode);
  }

  function handleBulkMove(category) {
    if (selectedIds.size === 0) return;
    onBulkMove([...selectedIds], category, exitBulkMode);
  }

  // Empty states
  if (credentials.length === 0) {
    return <EmptyState icon="key" message="No credentials yet" sub='Click "Add Credential" to get started' onAdd={onAdd} />;
  }
  if (filtered.length === 0) {
    return <EmptyState icon="search" message="No credentials found" sub="Try a different search term or category" />;
  }

  const renderGrid = (items) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((cred) => (
        <CredentialCard
          key={cred._id}
          credential={cred}
          onDelete={onDelete}
          onEdit={onEdit}
          onHistory={onHistory}
          isReused={reusedPasswords.has(cred.password)}
          bulkMode={bulkMode}
          isSelected={selectedIds.has(cred._id)}
          onToggleSelect={toggleSelect}
        />
      ))}
    </div>
  );

  return (
    <div>
      {/* ── Bulk mode toggle button ── */}
      <div className="flex justify-end mb-4">
        {!bulkMode ? (
          <button
            onClick={() => setBulkMode(true)}
            className="flex items-center gap-2 text-sm px-3 py-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Select
          </button>
        ) : (
          <span className="text-xs text-indigo-500 dark:text-indigo-400 py-1.5">
            Click cards to select
          </span>
        )}
      </div>

      {/* ── Bulk toolbar ── */}
      {bulkMode && (
        <BulkToolbar
          selectedIds={selectedIds}
          allIds={allFilteredIds}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          onBulkDelete={handleBulkDelete}
          onBulkMove={handleBulkMove}
          onCancel={exitBulkMode}
        />
      )}

      {/* ── Credential grid ── */}
      {activeCategory === "All" ? (
        <div className="space-y-8">
          {Object.entries(groupByCategory(filtered)).map(([category, items]) => {
            const color = getCategoryColor(category);
            // In bulk mode, show a "select all in category" button in the heading
            const categoryIds  = items.map((c) => c._id);
            const allCatSelected = bulkMode && categoryIds.every((id) => selectedIds.has(id));

            return (
              <section key={category}>
                <div className="flex items-center gap-3 mb-4">
                  <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                  <h2 className={`text-sm font-semibold ${color.text}`}>{category}</h2>
                  <span className="text-gray-600 text-xs">({items.length})</span>

                  {/* Select all in this category */}
                  {bulkMode && (
                    <button
                      onClick={() => {
                        if (allCatSelected) {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            categoryIds.forEach((id) => next.delete(id));
                            return next;
                          });
                        } else {
                          setSelectedIds((prev) => new Set([...prev, ...categoryIds]));
                        }
                      }}
                      className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline"
                    >
                      {allCatSelected ? "Deselect all" : "Select all"}
                    </button>
                  )}

                  <div className="flex-1 h-px bg-gray-800" />
                </div>
                {renderGrid(items)}
              </section>
            );
          })}
        </div>
      ) : (
        renderGrid(filtered)
      )}
    </div>
  );
}

function EmptyState({ icon, message, sub, onAdd }) {
  if (icon === "search") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <p className="text-gray-500 dark:text-gray-400 font-medium">{message}</p>
        <p className="text-gray-400 dark:text-gray-600 text-sm mt-1">{sub}</p>
      </div>
    );
  }

  // Rich illustrated empty vault state
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center max-w-sm mx-auto">
      {/* SVG Illustration */}
      <div className="relative mb-8">
        <svg width="160" height="140" viewBox="0 0 160 140" fill="none" className="opacity-90">
          {/* Vault body */}
          <rect x="30" y="30" width="100" height="85" rx="12" fill="#e0e7ff" className="dark:fill-indigo-900/40" stroke="#818cf8" strokeWidth="2"/>
          {/* Vault door */}
          <rect x="45" y="45" width="70" height="55" rx="8" fill="#c7d2fe" className="dark:fill-indigo-800/40" stroke="#6366f1" strokeWidth="1.5"/>
          {/* Lock circle */}
          <circle cx="80" cy="68" r="14" fill="#818cf8" className="dark:fill-indigo-600"/>
          <circle cx="80" cy="68" r="8" fill="#e0e7ff" className="dark:fill-indigo-900"/>
          {/* Lock keyhole */}
          <circle cx="80" cy="65" r="3" fill="#818cf8" className="dark:fill-indigo-400"/>
          <rect x="78.5" y="66" width="3" height="6" rx="1" fill="#818cf8" className="dark:fill-indigo-400"/>
          {/* Handle */}
          <rect x="108" y="63" width="6" height="12" rx="3" fill="#6366f1"/>
          {/* Dial marks */}
          {[0,60,120,180,240,300].map((deg, i) => {
            const r = 14; const cx = 80; const cy = 68;
            const rad = (deg - 90) * Math.PI / 180;
            const x1 = cx + (r-2) * Math.cos(rad); const y1 = cy + (r-2) * Math.sin(rad);
            const x2 = cx + r * Math.cos(rad);       const y2 = cy + r * Math.sin(rad);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e0e7ff" strokeWidth="1.5" className="dark:stroke-indigo-900"/>;
          })}
          {/* Plus icon floating */}
          <circle cx="118" cy="35" r="16" fill="#22c55e" opacity="0.9"/>
          <path d="M118 27v16M110 35h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          {/* Small decorative dots */}
          <circle cx="35" cy="25" r="4" fill="#a5b4fc" opacity="0.5"/>
          <circle cx="130" cy="120" r="5" fill="#818cf8" opacity="0.4"/>
          <circle cx="25" cy="100" r="3" fill="#6366f1" opacity="0.3"/>
        </svg>
      </div>

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        Your vault is empty
      </h3>
      <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
        Save your first credential and SecureVault will remember it for every future visit — encrypted and secure.
      </p>

      {/* Feature hints */}
      <div className="flex flex-col gap-2 w-full mb-8 text-left">
        {[
          { icon: "⚡", text: "Autofill on any website with one click" },
          { icon: "🔐", text: "AES-256 encrypted before storage" },
          { icon: "🛡️", text: "Protected by your master password" },
        ].map(({ icon, text }) => (
          <div key={text} className="flex items-center gap-2.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
            <span className="text-base">{icon}</span>
            <span className="text-xs text-indigo-700 dark:text-indigo-300">{text}</span>
          </div>
        ))}
      </div>

      {onAdd && (
        <button onClick={onAdd}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-lg shadow-indigo-500/20">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add your first credential
        </button>
      )}
    </div>
  );
}