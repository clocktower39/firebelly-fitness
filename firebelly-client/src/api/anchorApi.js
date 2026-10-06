import { apiFetch } from "./client";

// Per-exercise progression: one working weight per (client, program, exercise), with each
// occurrence in the week stored as a percentage of it. See the server's anchorController.
export const anchorApi = {
  forExercise: (payload) =>
    apiFetch("/anchors/forExercise", { method: "POST", body: payload }),

  setAnchor: (payload) => apiFetch("/anchors/set", { method: "POST", body: payload }),

  // Removes the anchor and unlinks its slots, returning the exercise to ordinary
  // feedback-driven seeding.
  clearAnchor: (payload) => apiFetch("/anchors/clear", { method: "POST", body: payload }),
};

export default anchorApi;
