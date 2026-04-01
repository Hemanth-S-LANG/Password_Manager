// Central list of categories — used in modal dropdown, sidebar, and badge colors
export const CATEGORIES = [
  "Social Media",
  "Work",
  "Shopping",
  "Banking",
  "Entertainment",
  "Others",
];

// Color mapping per category for badges and sidebar accents
export const CATEGORY_COLORS = {
  "Social Media": { bg: "bg-pink-900/40", text: "text-pink-400", border: "border-pink-800/50", dot: "bg-pink-400" },
  "Work":         { bg: "bg-blue-900/40", text: "text-blue-400", border: "border-blue-800/50", dot: "bg-blue-400" },
  "Shopping":     { bg: "bg-yellow-900/40", text: "text-yellow-400", border: "border-yellow-800/50", dot: "bg-yellow-400" },
  "Banking":      { bg: "bg-green-900/40", text: "text-green-400", border: "border-green-800/50", dot: "bg-green-400" },
  "Entertainment":{ bg: "bg-purple-900/40", text: "text-purple-400", border: "border-purple-800/50", dot: "bg-purple-400" },
  "Others":       { bg: "bg-gray-800/60", text: "text-gray-400", border: "border-gray-700/50", dot: "bg-gray-400" },
};

// Fallback for custom/unknown categories
export function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS["Others"];
}
