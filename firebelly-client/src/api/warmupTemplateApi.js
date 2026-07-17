import { apiFetch } from "./client";

// A trainer's reusable named warm-ups (saved warm-up lists they can insert into any workout).
export const warmupTemplateApi = {
  list: () => apiFetch("/warmupTemplates"),
  create: (payload) => apiFetch("/warmupTemplates", { method: "POST", body: payload }),
  remove: (id) => apiFetch(`/warmupTemplates/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
