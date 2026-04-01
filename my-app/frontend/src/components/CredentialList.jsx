import CredentialCard from "./CredentialCard";
import { getCategoryColor } from "../utils/categories";

// Groups an array of credentials by their category field.
// Returns an object like: { "Social Media": [...], "Work": [...] }
function groupByCategory(credentials) {
  return credentials.reduce((groups, cred) => {
    const cat = cred.category || "Others";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(cred);
    return groups;
  }, {});
}

export default function CredentialList({ credentials, search, activeCategory, onDelete, onEdit }) {
  // Step 1: filter by search term (website or username)
  const searchFiltered = credentials.filter(
    (c) =>
      c.website.toLowerCase().includes(search.toLowerCase()) ||
      c.username.toLowerCase().includes(search.toLowerCase())
  );

  // Step 2: filter by active sidebar category
  // If "All" is selected, show everything; otherwise filter to that category
  const filtered =
    activeCategory === "All"
      ? searchFiltered
      : searchFiltered.filter((c) => c.category === activeCategory);

  // Empty states
  if (credentials.length === 0) {
    return <EmptyState icon="key" message="No credentials yet" sub='Click "Add Credential" to get started' />;
  }
  if (filtered.length === 0) {
    return <EmptyState icon="search" message="No credentials found" sub="Try a different search term or category" />;
  }

  // When "All" is selected, group credentials under category headings.
  // When a specific category is selected, just show a flat grid (no heading needed).
  if (activeCategory === "All") {
    const groups = groupByCategory(filtered);
    return (
      <div className="space-y-8">
        {Object.entries(groups).map(([category, items]) => {
          const color = getCategoryColor(category);
          return (
            <section key={category}>
              {/* Category heading */}
              <div className="flex items-center gap-3 mb-4">
                <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                <h2 className={`text-sm font-semibold ${color.text}`}>{category}</h2>
                <span className="text-gray-600 text-xs">({items.length})</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((cred) => (
                  <CredentialCard key={cred._id} credential={cred} onDelete={onDelete} onEdit={onEdit} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  // Flat grid for a specific category
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered.map((cred) => (
        <CredentialCard key={cred._id} credential={cred} onDelete={onDelete} onEdit={onEdit} />
      ))}
    </div>
  );
}

function EmptyState({ icon, message, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
        {icon === "search" ? (
          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        ) : (
          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        )}
      </div>
      <p className="text-gray-400 font-medium">{message}</p>
      <p className="text-gray-600 text-sm mt-1">{sub}</p>
    </div>
  );
}
