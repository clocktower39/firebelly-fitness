import { apiFetch } from "./client";

export const feedbackApi = {
  submit: (payload) => apiFetch("/feedback", { method: "POST", body: payload }),
  listMine: () => apiFetch("/feedback/mine"),
  listAll: () => apiFetch("/feedback"), // admin only
  update: (id, updates) => apiFetch(`/feedback/${id}`, { method: "POST", body: updates }), // admin only
};

// Shared display metadata for feedback types + statuses (used by the form and the admin inbox).
export const FEEDBACK_TYPES = [
  { value: "feature", label: "Feature request" },
  { value: "improvement", label: "Improvement" },
  { value: "bug", label: "Bug" },
  { value: "other", label: "Other" },
];

export const FEEDBACK_STATUSES = [
  { value: "new", label: "New", color: "default" },
  { value: "reviewing", label: "Under review", color: "info" },
  { value: "planned", label: "Planned", color: "primary" },
  { value: "in_progress", label: "In progress", color: "warning" },
  { value: "done", label: "Done", color: "success" },
  { value: "declined", label: "Declined", color: "default" },
];

export const typeLabel = (v) => FEEDBACK_TYPES.find((t) => t.value === v)?.label || v;
export const statusMeta = (v) =>
  FEEDBACK_STATUSES.find((s) => s.value === v) || { value: v, label: v, color: "default" };
