// Per-user custom exercise names (aliases). Helpers to resolve and search by the name a
// user actually uses, while keeping the canonical title available.

// The name to show for an exercise, honoring the user's custom alias if present.
export const exerciseDisplayName = (exercise, aliases = {}) =>
  (exercise && aliases?.[exercise._id]) || exercise?.exerciseTitle || "";

// Whether an exercise matches a search query — matches the custom name OR the canonical title.
export const exerciseMatchesQuery = (exercise, aliases = {}, query = "") => {
  const q = String(query).trim().toLowerCase();
  if (!q) return true;
  const alias = (exercise && aliases?.[exercise._id]) || "";
  return (
    String(exercise?.exerciseTitle || "").toLowerCase().includes(q) ||
    String(alias).toLowerCase().includes(q)
  );
};
